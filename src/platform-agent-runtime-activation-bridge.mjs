import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentRuntimePilotFreeze } from "./platform-agent-runtime-pilot-freeze.mjs";

export const DEFAULT_PLATFORM_AGENT_RUNTIME_ACTIVATION_BRIDGE_OUT_DIR = "artifacts/platform-agent-runtime-activation-bridge/latest";
export const DEFAULT_PLATFORM_AGENT_RUNTIME_ACTIVATION_BRIDGE_INPUTS = {
  schemaPath: "schemas/platform-agent-runtime-activation-bridge.schema.json",
  packagePath: "package.json",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
  agentRuntimeActivationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-runtime-activation-bridge";
const SOURCE_COMMAND_NAME = "platform:agent-runtime-pilot-freeze";
const SCHEMA_VERSION = "platform-agent-runtime-activation-bridge.v1";
const CAPABILITY_ID = "platform.agent_runtime_activation.bridge";
const PROGRAM_RANGE = "P1201-P1320";
const PHASE_RANGE = "P1201-P1320";
const PHASE_SLOT = "P1201";
const PREVIOUS_PHASE_SLOT = "P1200";
const NEXT_PHASE_SLOT = "P1321";
const SOURCE_READY_STATUS = "ready_for_human_approved_agent_runtime_pilot";
const READY_STATUS = "ready_for_agent_runtime_activation_bridge";

const PHASE_SPECS = [
  ["runtime_human_receipt_intake", "P1201-P1220", "receipt templates, validation, quarantine, and missing-receipt blocks"],
  ["approved_install_lane", "P1221-P1240", "validated-receipt install lane candidates without package download or install"],
  ["doctor_smoke_evidence_capture", "P1241-P1260", "future doctor/smoke evidence templates without command execution"],
  ["l0_runtime_adapter_pilot", "P1261-P1280", "read-only planner and evidence summarizer adapter pilot"],
  ["zendd_no_write_agent_pilot", "P1281-P1300", "Zendd work-order, diff review, rollback, command evidence, and VDR/LDD candidates without writes"],
  ["activation_bridge_freeze", "P1301-P1320", "P1201-P1300 PASS/BLOCK closeout and no-execution proof"],
];

const RECEIPT_CLASS_SPECS = [
  ["install_execution", "package install or package download", "rollback.install_packet"],
  ["doctor_smoke_execution", "version, doctor, config-check, help, or tool-policy probe", "rollback.doctor_probe"],
  ["runtime_start", "Agent runtime start", "rollback.runtime_stop"],
  ["terminal_execution", "terminal command execution", "rollback.command_execution"],
  ["mcp_connection", "MCP connection", "rollback.mcp_disconnect"],
  ["api_server_start", "Agent API server start", "rollback.api_stop"],
  ["cron_gateway_start", "cron or gateway start", "rollback.cron_disable"],
  ["provider_secret_setup", "provider secret setup by secret-handle refs", "rollback.secret_handle_disable"],
  ["raw_material_access", "raw secret, client, or VDR material access", "rollback.raw_access_revoke"],
  ["zendd_action", "Zendd external checkout action", "rollback.zendd_safe_patch_lane"],
  ["protected_action_execution", "protected action execution", "rollback.protected_action"],
  ["receipt_application", "receipt application or state patch", "rollback.receipt_patch"],
  ["release_legal_final_authority", "release decision, legal final judgment, or final approval", "rollback.final_authority"],
  ["final_readiness_freeze", "future P1320/P1500 readiness freeze input", "rollback.freeze_reopen"],
];

const QUARANTINE_SPECS = [
  ["unsigned_receipt", "receipt_signature_missing", "collect signed human receipt"],
  ["stale_receipt", "receipt_expired", "collect fresh receipt before activation"],
  ["unscoped_receipt", "receipt_scope_missing", "bind receipt to one action class and domain"],
  ["cross_domain_receipt", "domain_boundary_mismatch", "route to responsible domain owner"],
  ["agent_authored_receipt", "agent_cannot_author_receipt", "require human actor receipt"],
  ["raw_secret_payload", "raw_secret_access", "replace with secret-handle evidence ref"],
  ["raw_client_vdr_payload", "raw_client_or_vdr_exposure", "replace with source-span refs and redacted summary"],
  ["direct_zendd_write_receipt", "direct_zendd_mutation", "route through Zendd safe patch lane"],
  ["direct_pass_promotion", "agent_final_authority_forbidden", "route through human owner and freeze adjudication"],
];

const INSTALL_MODE_SPECS = [
  ["repo_local_venv", "pass", "default isolated candidate scoped to Hermes checkout"],
  ["pipx", "pass", "user-scoped candidate with rollback candidate"],
  ["docker", "pass", "container-scoped candidate with image rollback candidate"],
  ["curl_git_main", "blocked", "one-line git-main installer is not accepted"],
  ["global_pip", "blocked", "global pip install is not accepted"],
  ["root_sudo", "blocked", "root or sudo install is not accepted"],
];

const DOCTOR_PROBE_SPECS = [
  ["version_probe", "agent --version"],
  ["doctor_probe", "agent doctor"],
  ["config_check_probe", "agent config check"],
  ["help_probe", "agent --help"],
  ["tool_policy_probe", "agent tool-policy inspect"],
];

const DOMAIN_ADAPTER_SPECS = [
  ["platform", "platform planning and evidence summarization"],
  ["personal-dev", "issue, plan, diff, test, rollback candidate drafting"],
  ["law-firm", "VDR/LDD/citation/review packet candidate drafting"],
  ["creative-document", "template, style, layout, and output review candidate drafting"],
  ["connectors-resource", "ingestion, classification, quarantine, and evidence candidate drafting"],
  ["trading", "read-only safety and evidence candidate drafting"],
  ["project.zendd", "external Zendd work-order and no-write candidate drafting"],
];

const ZENDD_PACKET_SPECS = [
  ["work_order_candidate", "convert request refs into work-order candidate rows"],
  ["diff_review_candidate", "draft diff review packet without applying patch"],
  ["rollback_plan_candidate", "draft rollback target and recovery plan"],
  ["command_evidence_candidate", "draft command evidence packet without command execution"],
  ["release_sandbox_candidate", "draft release sandbox packet without materialization or publish"],
  ["vdr_ldd_review_candidate", "draft VDR/LDD review packet through source-span refs only"],
];

const PROTECTED_BLOCK_SPECS = [
  ["missing_receipt_runtime", "runtime_execution_requires_human_receipt", "collect scoped runtime receipt"],
  ["missing_receipt_install", "package_install_requires_install_receipt", "collect install receipt and rollback target"],
  ["missing_install_evidence", "install_evidence_required", "complete approved install lane before doctor/runtime"],
  ["missing_doctor_evidence", "doctor_evidence_required", "capture redacted doctor evidence after install"],
  ["terminal_execution", "terminal_execution_requires_human_receipt", "create command packet and receipt"],
  ["mcp_connection", "unreviewed_mcp_connection", "register MCP plan behind operator review"],
  ["api_cron_start", "api_or_cron_start_forbidden", "keep API/cron disabled until later execution lane"],
  ["provider_secret_setup", "raw_secret_access", "use secret-handle refs and human-approved setup"],
  ["raw_material_access", "raw_client_or_vdr_exposure", "use source-span refs and redacted summaries"],
  ["direct_zendd_mutation", "direct_zendd_mutation", "use Zendd no-write pilot and safe patch lane"],
  ["protected_action_execution", "protected_action_requires_human_receipt", "queue protected action receipt"],
  ["receipt_application", "receipt_application_forbidden", "validate receipt in future application lane"],
  ["legal_final_judgment", "legal_final_judgment_forbidden", "route to qualified human legal review"],
  ["release_decision", "release_decision_requires_human_receipt", "route release decision through human owner"],
  ["agent_final_pass", "agent_final_authority_forbidden", "route final PASS through human owner and freeze"],
];

export async function runPlatformAgentRuntimeActivationBridge(options = {}) {
  const result = await buildPlatformAgentRuntimeActivationBridge(options);
  if (options.write !== false) await writePlatformAgentRuntimeActivationBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent runtime activation bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentRuntimeActivationBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_RUNTIME_ACTIVATION_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const activationLedger = await readTextSource(inputs.agent_runtime_activation_bridge_ledger_path);
  const sourceRuntimePilotFreeze = await buildPlatformAgentRuntimePilotFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });

  const phaseRows = buildPhaseRows();
  const receiptTemplateRows = buildReceiptTemplateRows();
  const receiptQuarantineRows = buildReceiptQuarantineRows();
  const installLaneRows = buildInstallLaneRows();
  const doctorEvidenceRows = buildDoctorEvidenceRows();
  const l0AdapterRows = buildL0AdapterRows();
  const zenddPilotRows = buildZenddPilotRows();
  const protectedBlockRows = buildProtectedBlockRows();
  const freezeRows = buildFreezeRows({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows });
  const claimRows = buildClaimRows({ phaseRows, receiptTemplateRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, activationLedger, sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, activationLedger, sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows });
  const boundary = buildBoundary({ generatedAt, sourceRuntimePilotFreeze, receiptTemplateRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_runtime_activation_bridge_id: `platform-agent-runtime-activation-bridge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_runtime_activation_bridge_anchor: anchor,
    source_agent_runtime_pilot_freeze_summary: sourceRuntimePilotFreeze.summary,
    agent_runtime_activation_phase_rows: phaseRows,
    agent_runtime_activation_receipt_template_rows: receiptTemplateRows,
    agent_runtime_activation_receipt_quarantine_rows: receiptQuarantineRows,
    agent_runtime_activation_install_lane_rows: installLaneRows,
    agent_runtime_activation_doctor_evidence_rows: doctorEvidenceRows,
    agent_runtime_activation_l0_adapter_rows: l0AdapterRows,
    agent_runtime_activation_zendd_no_write_rows: zenddPilotRows,
    agent_runtime_activation_protected_block_rows: protectedBlockRows,
    agent_runtime_activation_freeze_rows: freezeRows,
    agent_runtime_activation_claim_rows: claimRows,
    agent_runtime_activation_gate_rows: gateRows,
    agent_runtime_activation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_runtime_activation_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_runtime_activation_bridge_id = result.platform_agent_runtime_activation_bridge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentRuntimeActivationBridge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-runtime-activation-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-runtime-activation-phase-rows.json"), collectionEnvelope("agent-runtime-activation-phase-rows.v1", "agent_runtime_activation_phase_rows", result.agent_runtime_activation_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-receipt-template-rows.json"), collectionEnvelope("agent-runtime-activation-receipt-template-rows.v1", "agent_runtime_activation_receipt_template_rows", result.agent_runtime_activation_receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-install-lane-rows.json"), collectionEnvelope("agent-runtime-activation-install-lane-rows.v1", "agent_runtime_activation_install_lane_rows", result.agent_runtime_activation_install_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-doctor-evidence-rows.json"), collectionEnvelope("agent-runtime-activation-doctor-evidence-rows.v1", "agent_runtime_activation_doctor_evidence_rows", result.agent_runtime_activation_doctor_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-l0-adapter-rows.json"), collectionEnvelope("agent-runtime-activation-l0-adapter-rows.v1", "agent_runtime_activation_l0_adapter_rows", result.agent_runtime_activation_l0_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-zendd-no-write-rows.json"), collectionEnvelope("agent-runtime-activation-zendd-no-write-rows.v1", "agent_runtime_activation_zendd_no_write_rows", result.agent_runtime_activation_zendd_no_write_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-protected-block-rows.json"), collectionEnvelope("agent-runtime-activation-protected-block-rows.v1", "agent_runtime_activation_protected_block_rows", result.agent_runtime_activation_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-freeze-rows.json"), collectionEnvelope("agent-runtime-activation-freeze-rows.v1", "agent_runtime_activation_freeze_rows", result.agent_runtime_activation_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-claim-rows.json"), collectionEnvelope("agent-runtime-activation-claim-rows.v1", "agent_runtime_activation_claim_rows", result.agent_runtime_activation_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-gate-rows.json"), collectionEnvelope("agent-runtime-activation-gate-rows.v1", "agent_runtime_activation_gate_rows", result.agent_runtime_activation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-activation-boundary.json"), result.agent_runtime_activation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-runtime-activation-bridge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentRuntimeActivationBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentRuntimeActivationBridge(args);
    console.log(`Platform agent runtime activation bridge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_runtime_activation_bridge_status}`);
    console.log(`Receipt templates: ${result.summary.receipt_template_count}`);
    console.log(`Install lane rows: ${result.summary.install_lane_count}`);
    console.log(`L0 adapters: ${result.summary.l0_adapter_count}`);
    console.log(`Zendd no-write packets: ${result.summary.zendd_no_write_packet_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPhaseRows() {
  return PHASE_SPECS.map(([phase_id, phase_range, description], index) => ({
    schema_version: "agent-runtime-activation-phase-row.v1",
    row_id: `agent-runtime-activation-phase.row.${String(index + 1).padStart(2, "0")}`,
    phase_id,
    phase_range,
    current_verdict: "pass",
    description,
    source_ready_status_required: SOURCE_READY_STATUS,
    execution_enabled_now: false,
    evidence_ref: `evidence.platform.agent.runtime_activation.phase.${phase_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_phase",
    hard_gate_ref: `gate.platform.agent.runtime_activation.phase.${phase_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep phase row attached to activation bridge; do not execute runtime actions",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildReceiptTemplateRows() {
  return RECEIPT_CLASS_SPECS.map(([receipt_class_id, description, rollback_target_ref], index) => ({
    schema_version: "agent-runtime-activation-receipt-template-row.v1",
    row_id: `agent-runtime-activation-receipt-template.row.${String(index + 1).padStart(2, "0")}`,
    receipt_class_id,
    current_verdict: "pass",
    template_status: "ready_for_human_receipt_input",
    description,
    required_fields: ["receipt_id", "receipt_actor", "receipt_scope", "decision", "evidence_refs", "rollback_target_ref", "expires_at", "signed_at", "human_receipt_ref"],
    allowed_decisions: ["approve_single_scoped_action", "return_with_missing_evidence", "keep_blocked"],
    rollback_target_ref,
    human_receipt_required: true,
    receipt_payload_present: false,
    receipt_validated: false,
    receipt_applied: false,
    execution_allowed_without_receipt: false,
    evidence_ref: `evidence.platform.agent.runtime_activation.receipt_template.${receipt_class_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_receipt_template",
    hard_gate_ref: `gate.platform.agent.runtime_activation.receipt_template.${receipt_class_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "collect scoped human receipt in a future receipt payload lane",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildReceiptQuarantineRows() {
  return QUARANTINE_SPECS.map(([quarantine_id, block_reason, next_allowed_action], index) => ({
    schema_version: "agent-runtime-activation-receipt-quarantine-row.v1",
    row_id: `agent-runtime-activation-receipt-quarantine.row.${String(index + 1).padStart(2, "0")}`,
    quarantine_id,
    current_verdict: "blocked",
    block_reason,
    receipt_payload_accepted: false,
    quarantine_required: true,
    evidence_ref: `evidence.platform.agent.runtime_activation.receipt_quarantine.${quarantine_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_receipt_quarantine",
    hard_gate_ref: `gate.platform.agent.runtime_activation.receipt_quarantine.${quarantine_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildInstallLaneRows() {
  return INSTALL_MODE_SPECS.map(([install_mode_id, verdict, description], index) => ({
    schema_version: "agent-runtime-activation-install-lane-row.v1",
    row_id: `agent-runtime-activation-install-lane.row.${String(index + 1).padStart(2, "0")}`,
    install_mode_id,
    current_verdict: verdict,
    install_candidate_status: verdict === "pass" ? "candidate_ready_requires_validated_receipt" : "blocked_unsafe_install_mode",
    description,
    recommended_default: install_mode_id === "repo_local_venv",
    human_receipt_required: true,
    validated_receipt_present: false,
    package_download_performed: false,
    package_install_performed: false,
    install_execution_allowed_now: false,
    rollback_execution_performed: false,
    block_reason: verdict === "blocked" ? `unsafe_install_mode.${install_mode_id}` : null,
    rollback_target_ref: `rollback.platform.agent.install.${install_mode_id}`,
    evidence_ref: `evidence.platform.agent.runtime_activation.install_lane.${install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_install_lane",
    hard_gate_ref: `gate.platform.agent.runtime_activation.install_lane.${install_mode_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: verdict === "pass" ? "collect validated install receipt; keep package download and install disabled" : "do not use this install mode",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildDoctorEvidenceRows() {
  return DOCTOR_PROBE_SPECS.map(([probe_id, command_display], index) => ({
    schema_version: "agent-runtime-activation-doctor-evidence-row.v1",
    row_id: `agent-runtime-activation-doctor-evidence.row.${String(index + 1).padStart(2, "0")}`,
    probe_id,
    current_verdict: "pass",
    command_display,
    template_status: "ready_for_future_redacted_output",
    install_evidence_required_before_run: true,
    validated_install_receipt_present: false,
    command_execution_performed: false,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    stdout_hash_required_for_future_output: true,
    stderr_hash_required_for_future_output: true,
    redacted_summary_required_for_future_output: true,
    raw_secret_stored: false,
    raw_client_or_vdr_material_stored: false,
    tool_enablement_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: `evidence.platform.agent.runtime_activation.doctor.${probe_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_doctor",
    hard_gate_ref: `gate.platform.agent.runtime_activation.doctor.${probe_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "wait for approved install evidence before doctor/smoke execution",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildL0AdapterRows() {
  return DOMAIN_ADAPTER_SPECS.map(([domain_id, description], index) => ({
    schema_version: "agent-runtime-activation-l0-adapter-row.v1",
    row_id: `agent-runtime-activation-l0-adapter.row.${String(index + 1).padStart(2, "0")}`,
    domain_id,
    rollout_level: "L0",
    current_verdict: "pass",
    adapter_status: "read_only_planner_evidence_summarizer_candidate",
    description,
    allowed_inputs: ["normalized_refs", "policy_rows", "source_span_refs", "redacted_summaries"],
    allowed_outputs: ["work_order_candidate", "evidence_candidate", "review_candidate", "rollback_candidate", "next_allowed_action"],
    forbidden_outputs: ["final_pass", "final_approval", "legal_final_judgment", "release_decision", "protected_action_execution"],
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    file_write_allowed_now: false,
    package_install_allowed_now: false,
    provider_secret_setup_allowed_now: false,
    raw_material_access_allowed_now: false,
    cross_domain_forwarding_allowed_now: false,
    protected_action_allowed_now: false,
    evidence_ref: `evidence.platform.agent.runtime_activation.l0_adapter.${domain_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_l0_adapter",
    hard_gate_ref: `gate.platform.agent.runtime_activation.l0_adapter.${domain_id}`,
    rollback_target_ref: `rollback.platform.agent.l0_adapter.${domain_id}`,
    responsible_owner: `${domain_id}.owner`,
    next_allowed_action: "surface L0 adapter candidate to domain pilot expansion without enabling execution",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildZenddPilotRows() {
  return ZENDD_PACKET_SPECS.map(([packet_type, description], index) => ({
    schema_version: "agent-runtime-activation-zendd-no-write-row.v1",
    row_id: `agent-runtime-activation-zendd-no-write.row.${String(index + 1).padStart(2, "0")}`,
    packet_type,
    current_verdict: "pass",
    packet_status: "candidate_ready_no_write",
    description,
    external_project_adapter_selected: true,
    source_refs_only: true,
    raw_vdr_or_client_material_accessed: false,
    file_write_performed: false,
    source_tree_movement_performed: false,
    terminal_command_executed: false,
    protected_action_executed: false,
    receipt_applied: false,
    release_publish_performed: false,
    legal_final_judgment_created: false,
    human_receipt_required_before_write: true,
    rollback_target_ref: `rollback.project.zendd.no_write.${packet_type}`,
    evidence_ref: `evidence.platform.agent.runtime_activation.zendd.${packet_type}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_zendd",
    hard_gate_ref: `gate.platform.agent.runtime_activation.zendd.${packet_type}`,
    responsible_owner: "project.zendd.owner",
    next_allowed_action: "keep Zendd packet as no-write candidate until future human-approved patch lane",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProtectedBlockRows() {
  return PROTECTED_BLOCK_SPECS.map(([protected_block_id, block_reason, next_allowed_action], index) => ({
    schema_version: "agent-runtime-activation-protected-block-row.v1",
    row_id: `agent-runtime-activation-protected-block.row.${String(index + 1).padStart(2, "0")}`,
    protected_block_id,
    current_verdict: "blocked",
    block_reason,
    documented_human_gate_ref: `human_gate.platform.agent.runtime_activation.${protected_block_id}`,
    human_receipt_required: true,
    receipt_payload_present: false,
    action_allowed_now: false,
    evidence_ref: `evidence.platform.agent.runtime_activation.protected_block.${protected_block_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_protected_block",
    hard_gate_ref: `gate.platform.agent.runtime_activation.protected_block.${protected_block_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows }) {
  const checks = [
    ["source_p1200_ready", sourceRuntimePilotFreeze.summary.platform_agent_runtime_pilot_freeze_status === SOURCE_READY_STATUS, "P1200 source freeze is ready"],
    ["phase_rows_complete", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all P1201-P1320 phase rows are present"],
    ["receipt_templates_ready", receiptTemplateRows.length === RECEIPT_CLASS_SPECS.length && receiptTemplateRows.every((row) => row.receipt_payload_present === false), "receipt templates exist with no payloads"],
    ["quarantine_rows_blocked", receiptQuarantineRows.every((row) => row.current_verdict === "blocked"), "unsafe receipt payload classes are quarantined"],
    ["install_lane_no_execution", installLaneRows.every((row) => row.package_download_performed === false && row.package_install_performed === false), "install lane performs no download or install"],
    ["doctor_rows_no_command", doctorEvidenceRows.every((row) => row.command_execution_performed === false && row.raw_stdout_stored === false && row.raw_stderr_stored === false), "doctor rows execute no command and store no raw output"],
    ["l0_adapters_no_tools", l0AdapterRows.every((row) => row.terminal_execution_allowed_now === false && row.file_write_allowed_now === false), "L0 adapters are read-only"],
    ["zendd_no_write", zenddPilotRows.every((row) => row.file_write_performed === false && row.raw_vdr_or_client_material_accessed === false), "Zendd packets remain no-write and source-ref only"],
    ["protected_blocks_documented", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "protected blocks have reason and next action"],
    ["no_runtime_execution", sourceRuntimePilotFreeze.summary.agent_runtime_execution_allowed_now === false, "runtime execution remains disabled"],
    ["no_final_authority", sourceRuntimePilotFreeze.summary.final_pass_or_approval_allowed_now === false, "Agent final authority remains disabled"],
    ["ready_for_next_program", true, "activation bridge can feed P1321 domain pilot expansion"],
  ];
  return checks.map(([freeze_id, pass, description], index) => ({
    schema_version: "agent-runtime-activation-freeze-row.v1",
    row_id: `agent-runtime-activation-freeze.row.${String(index + 1).padStart(2, "0")}`,
    freeze_id,
    current_verdict: pass ? "pass" : "blocked",
    description,
    block_reason: pass ? null : `freeze_check_failed.${freeze_id}`,
    evidence_ref: `evidence.platform.agent.runtime_activation.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_freeze",
    hard_gate_ref: `gate.platform.agent.runtime_activation.freeze.${freeze_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1320 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ phaseRows, receiptTemplateRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows }) {
  const passSources = [
    ...phaseRows.map((row) => ["phase", row.phase_id, row]),
    ...receiptTemplateRows.map((row) => ["receipt_template", row.receipt_class_id, row]),
    ...installLaneRows.filter((row) => row.current_verdict === "pass").map((row) => ["install_lane", row.install_mode_id, row]),
    ...doctorEvidenceRows.map((row) => ["doctor_evidence", row.probe_id, row]),
    ...l0AdapterRows.map((row) => ["l0_adapter", row.domain_id, row]),
    ...zenddPilotRows.map((row) => ["zendd_no_write", row.packet_type, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = [
    ...installLaneRows.filter((row) => row.current_verdict === "blocked").map((row) => ["install_lane", row.install_mode_id, row]),
    ...protectedBlockRows.map((row) => ["protected_block", row.protected_block_id, row]),
  ];
  return [...passSources, ...blockedSources].map(([claim_type, claim_id, row], index) => ({
    schema_version: "agent-runtime-activation-claim-row.v1",
    row_id: `agent-runtime-activation-claim.row.${String(index + 1).padStart(3, "0")}`,
    claim_type,
    claim_id,
    current_verdict: row.current_verdict,
    block_reason: row.current_verdict === "blocked" ? row.block_reason : null,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: row.unsafe_flags_false === true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, activationLedger, sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows }) {
  return {
    schema_version: "platform-agent-runtime-activation-bridge-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    activation_bridge_ledger_present: activationLedger.available,
    source_runtime_pilot_freeze_status: sourceRuntimePilotFreeze.summary.platform_agent_runtime_pilot_freeze_status,
    phase_count: phaseRows.length,
    receipt_template_count: receiptTemplateRows.length,
    receipt_quarantine_count: receiptQuarantineRows.length,
    install_lane_count: installLaneRows.length,
    doctor_evidence_count: doctorEvidenceRows.length,
    l0_adapter_count: l0AdapterRows.length,
    zendd_no_write_packet_count: zenddPilotRows.length,
    protected_block_count: protectedBlockRows.length,
    freeze_count: freezeRows.length,
    claim_count: claimRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, activationLedger, sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json registers activation bridge command"],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes activation bridge check"],
    ["p1200_source_ready", sourceRuntimePilotFreeze.summary.platform_agent_runtime_pilot_freeze_status === SOURCE_READY_STATUS, "P1200 source freeze is ready"],
    ["activation_ledger_present", activationLedger.available && ["P1201-P1320", "P1201-P1220", "P1301-P1320", COMMAND_NAME].every((token) => activationLedger.text.includes(token)), "activation bridge ledger declares full range"],
    ["runtime_pilot_ledger_present", runtimePilotLedger.available && runtimePilotLedger.text.includes("P1199-P1200"), "runtime pilot ledger exists"],
    ["phase_rows_ready", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "phase rows ready"],
    ["receipt_templates_no_payload", receiptTemplateRows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false), "receipt templates contain no payload"],
    ["quarantine_blocks_ready", receiptQuarantineRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "quarantine rows block unsafe receipts"],
    ["install_no_execution", installLaneRows.every((row) => row.package_download_performed === false && row.package_install_performed === false), "install lane performs no execution"],
    ["doctor_no_raw_output", doctorEvidenceRows.every((row) => row.raw_stdout_stored === false && row.raw_stderr_stored === false), "doctor evidence stores no raw output"],
    ["l0_read_only", l0AdapterRows.every((row) => row.file_write_allowed_now === false && row.terminal_execution_allowed_now === false), "L0 adapter rows are read-only"],
    ["zendd_no_write", zenddPilotRows.every((row) => row.file_write_performed === false && row.raw_vdr_or_client_material_accessed === false), "Zendd pilot rows are no-write"],
    ["protected_blocks_ready", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.documented_human_gate_ref), "protected blocks documented"],
    ["claims_supported", claimRows.every(isSupportedClaim), "claim rows support PASS/BLOCK contract"],
    ["freeze_rows_ready", freezeRows.every((row) => row.current_verdict === "pass"), "freeze rows pass"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "agent-runtime-activation-gate-row.v1",
    row_id: `agent-runtime-activation-gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.agent.runtime_activation.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_activation_gate",
    hard_gate_ref: `gate.platform.agent.runtime_activation.${gate_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1320 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ generatedAt, sourceRuntimePilotFreeze, receiptTemplateRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    receiptTemplateRows.some((row) => row.receipt_payload_present || row.receipt_applied),
    installLaneRows.some((row) => row.package_download_performed || row.package_install_performed),
    doctorEvidenceRows.some((row) => row.command_execution_performed || row.raw_stdout_stored || row.raw_stderr_stored),
    l0AdapterRows.some((row) => row.file_write_allowed_now || row.terminal_execution_allowed_now),
    zenddPilotRows.some((row) => row.file_write_performed || row.raw_vdr_or_client_material_accessed || row.protected_action_executed),
    protectedBlockRows.some((row) => row.action_allowed_now),
    sourceRuntimePilotFreeze.summary.agent_runtime_execution_allowed_now,
    sourceRuntimePilotFreeze.summary.final_pass_or_approval_allowed_now,
  ];
  return {
    schema_version: "agent-runtime-activation-boundary.v1",
    generated_at: generatedAt,
    activation_bridge_ready_for_future_receipt: freezeRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    receipt_payload_present: false,
    validated_human_receipt_present: false,
    receipt_applied: false,
    package_download_performed: false,
    package_install_performed: false,
    doctor_smoke_execution_performed: false,
    command_execution_performed: false,
    agent_runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    provider_secret_setup_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_client_or_vdr_access_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    zendd_file_write_performed: false,
    protected_action_execution_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    agent_final_pass_allowed_now: false,
    l0_read_only_adapter_pilot_ready: true,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary }) {
  return [
    validationItem("source.p1200", "source_ready", sourceRuntimePilotFreeze.summary.platform_agent_runtime_pilot_freeze_status === SOURCE_READY_STATUS, "P1200 source freeze must be ready"),
    validationItem("phase.count", "phase_rows", phaseRows.length === PHASE_SPECS.length, "all activation phase rows must exist"),
    validationItem("receipt.no_payload", "receipt_boundary", receiptTemplateRows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false), "receipt templates cannot contain or apply payloads"),
    validationItem("receipt.quarantine", "receipt_boundary", receiptQuarantineRows.every((row) => row.current_verdict === "blocked"), "unsafe receipt rows must be blocked"),
    validationItem("install.no_execution", "install_boundary", installLaneRows.every((row) => row.package_download_performed === false && row.package_install_performed === false), "install lane cannot download or install"),
    validationItem("doctor.no_command", "doctor_boundary", doctorEvidenceRows.every((row) => row.command_execution_performed === false), "doctor rows cannot execute commands"),
    validationItem("doctor.no_raw_output", "doctor_boundary", doctorEvidenceRows.every((row) => row.raw_stdout_stored === false && row.raw_stderr_stored === false), "doctor rows cannot store raw stdout/stderr"),
    validationItem("l0.read_only", "adapter_boundary", l0AdapterRows.every((row) => row.file_write_allowed_now === false && row.terminal_execution_allowed_now === false), "L0 adapters must remain read-only"),
    validationItem("zendd.no_write", "zendd_boundary", zenddPilotRows.every((row) => row.file_write_performed === false && row.raw_vdr_or_client_material_accessed === false), "Zendd pilot must remain no-write"),
    validationItem("protected.blocks", "protected_boundary", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "protected paths must be documented blocks"),
    validationItem("claims.supported", "claim_contract", claimRows.every(isSupportedClaim), "all claim rows must support PASS/BLOCK contract"),
    validationItem("gates.ready", "gate_contract", gateRows.every((row) => row.gate_status === "ready"), "all gate rows must be ready"),
    validationItem("freeze.ready", "freeze_contract", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function isSupportedClaim(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function buildSummary({ sourceRuntimePilotFreeze, phaseRows, receiptTemplateRows, receiptQuarantineRows, installLaneRows, doctorEvidenceRows, l0AdapterRows, zenddPilotRows, protectedBlockRows, freezeRows, claimRows, gateRows, boundary, validation }) {
  return {
    schema_version: "platform-agent-runtime-activation-bridge-summary.v1",
    platform_agent_runtime_activation_bridge_status: validation.valid && boundary.activation_bridge_ready_for_future_receipt ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_runtime_pilot_freeze_status: sourceRuntimePilotFreeze.summary.platform_agent_runtime_pilot_freeze_status,
    phase_count: phaseRows.length,
    receipt_template_count: receiptTemplateRows.length,
    receipt_quarantine_count: receiptQuarantineRows.length,
    install_lane_count: installLaneRows.length,
    safe_install_candidate_count: installLaneRows.filter((row) => row.current_verdict === "pass").length,
    blocked_install_mode_count: installLaneRows.filter((row) => row.current_verdict === "blocked").length,
    doctor_evidence_count: doctorEvidenceRows.length,
    l0_adapter_count: l0AdapterRows.length,
    zendd_no_write_packet_count: zenddPilotRows.length,
    protected_block_count: protectedBlockRows.length,
    freeze_count: freezeRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    receipt_payload_present: boundary.receipt_payload_present,
    validated_human_receipt_present: boundary.validated_human_receipt_present,
    package_install_performed: boundary.package_install_performed,
    doctor_smoke_execution_performed: boundary.doctor_smoke_execution_performed,
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    direct_zendd_mutation_allowed_now: boundary.direct_zendd_mutation_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Agent Runtime Activation Bridge",
    "",
    `Status: ${result.summary.platform_agent_runtime_activation_bridge_status}`,
    `Program: ${result.summary.program_range}`,
    `Source P1200 status: ${result.summary.source_runtime_pilot_freeze_status}`,
    `Receipt templates: ${result.summary.receipt_template_count}`,
    `Install lane rows: ${result.summary.install_lane_count}`,
    `Doctor evidence rows: ${result.summary.doctor_evidence_count}`,
    `L0 adapters: ${result.summary.l0_adapter_count}`,
    `Zendd no-write packets: ${result.summary.zendd_no_write_packet_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Direct Zendd mutation allowed now: ${result.summary.direct_zendd_mutation_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Surface P1201-P1320 as the activation bridge baseline, then start P1321 domain Agent pilot expansion without enabling runtime execution or Zendd writes.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_RUNTIME_ACTIVATION_BRIDGE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    agent_runtime_pilot_ledger_path: options.agentRuntimePilotLedgerPath ?? defaults.agentRuntimePilotLedgerPath,
    agent_runtime_activation_bridge_ledger_path: options.agentRuntimeActivationBridgeLedgerPath ?? defaults.agentRuntimeActivationBridgeLedgerPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function collectionEnvelope(schema_version, key, rows, generated_at) {
  return {
    schema_version,
    generated_at,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--schema") args.schemaPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--runtime-pilot-ledger") args.agentRuntimePilotLedgerPath = argv[++index];
    else if (arg === "--activation-ledger") args.agentRuntimeActivationBridgeLedgerPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-runtime-activation-bridge.mjs [--check] [--out-dir DIR]\n\nCreates the P1201-P1320 Agent runtime activation bridge while keeping install, runtime, tools, services, secrets, raw material, Zendd mutation, protected actions, receipt application, legal judgment, release decisions, and Agent final authority disabled or documented BLOCK.`);
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
