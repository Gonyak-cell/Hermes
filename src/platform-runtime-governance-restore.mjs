import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformNousNonAdoptionReversal } from "./platform-nous-non-adoption-reversal.mjs";

export const DEFAULT_PLATFORM_RUNTIME_GOVERNANCE_RESTORE_OUT_DIR = "artifacts/platform-runtime-governance-restore/latest";
export const DEFAULT_PLATFORM_RUNTIME_GOVERNANCE_RESTORE_INPUTS = {
  schemaPath: "schemas/platform-runtime-governance-restore.schema.json",
  packagePath: "package.json",
  reversalLedgerPath: "docs/nous-non-adoption-reversal.md",
  runtimeGovernanceLedgerPath: "docs/hermes-runtime-governance-restore.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:runtime-governance-restore";
const SOURCE_COMMAND_NAME = "platform:nous-non-adoption-reversal";
const SCHEMA_VERSION = "platform-runtime-governance-restore.v1";
const CAPABILITY_ID = "platform.runtime_governance_restore";
const READY_STATUS = "ready_for_platform_runtime_governance_restore";
const SOURCE_READY_STATUS = "ready_for_platform_nous_non_adoption_reversal";
const PROGRAM_RANGE = "P2121-P2240";
const PHASE_RANGE = "P2121-P2240";
const PHASE_SLOT = "P2121";
const PREVIOUS_PHASE_SLOT = "P2120";
const NEXT_PHASE_SLOT = "P2241";

const COMPONENT_SPECS = [
  ["runtime_api_contract_restore", "Restore runtime governance API contracts"],
  ["mcp_registry_contract_restore", "Restore MCP registry and health contract rows"],
  ["tool_gateway_policy_restore", "Restore tool gateway policy, redaction, timeout, and allowlist rows"],
  ["job_scheduler_ledger_restore", "Restore scheduled job ledger rows"],
  ["doctor_health_evidence_restore", "Restore install, doctor, smoke, and health evidence classes"],
  ["hard_hook_scaffold_restore", "Restore deterministic hard hook scaffold rows"],
  ["limited_execution_handoff_restore", "Freeze P2241 limited execution handoff"],
];

const API_CONTRACT_SPECS = [
  ["/api/runtime-governance/manifest", "runtime_governance_manifest"],
  ["/api/runtime-governance/api-contracts", "runtime_api_contract_rows"],
  ["/api/runtime-governance/mcp-registries", "mcp_registry_rows"],
  ["/api/runtime-governance/tool-policies", "tool_gateway_policy_rows"],
  ["/api/runtime-governance/job-ledgers", "job_scheduler_ledger_rows"],
  ["/api/runtime-governance/doctor-evidence", "doctor_health_evidence_rows"],
  ["/api/runtime-governance/hard-hooks", "hard_hook_scaffold_rows"],
];

const MCP_REGISTRY_SPECS = [
  ["local_mcp_registry", "repo-local MCP server registry contract"],
  ["external_mcp_registry", "external MCP server registry contract"],
  ["mcp_health_check_contract", "MCP health check evidence contract"],
  ["mcp_secret_boundary", "MCP credential and secret-handle boundary contract"],
];

const TOOL_POLICY_SPECS = [
  ["terminal_command", "Terminal commands require allowlist, receipt, timeout, redaction, and rollback evidence"],
  ["file_write", "File writes require controlled write lane, generated patch, diff review, and human receipt"],
  ["install_command", "Install commands require approved install receipt and doctor evidence"],
  ["mcp_tool", "MCP tool calls require registry row, health evidence, and receipt when protected"],
  ["browser_or_network", "Browser or network tools require domain policy and raw material guard"],
  ["secret_or_credential", "Secret and credential lookup is blocked unless handled through approved secret handles"],
  ["job_run", "Scheduled job run is blocked until job ledger and receipt closeout exist"],
];

const JOB_LEDGER_SPECS = [
  ["doctor_refresh_job", "doctor and smoke evidence refresh job contract"],
  ["memory_sync_job", "Memory Bank sync job contract"],
  ["connector_ingestion_job", "connector ingestion quarantine job contract"],
  ["runtime_health_job", "runtime health and capability check job contract"],
  ["evidence_compaction_job", "evidence index compaction job contract"],
];

const DOCTOR_EVIDENCE_SPECS = [
  ["version_evidence", "version and capability evidence"],
  ["doctor_evidence", "doctor command redacted evidence"],
  ["smoke_evidence", "smoke command evidence"],
  ["health_evidence", "health endpoint or local status evidence"],
  ["config_policy_evidence", "config and tool policy evidence"],
  ["redaction_evidence", "stdout/stderr redaction evidence"],
];

const HARD_HOOK_SPECS = [
  ["evidence_required", "completion claim requires evidence"],
  ["receipt_required", "protected runtime or execution action requires human receipt"],
  ["secret_scan_required", "secret scan gate blocks unsafe outputs"],
  ["timeout_required", "execution lanes require timeout policy"],
  ["redaction_required", "stdout/stderr evidence requires redaction"],
  ["rollback_required", "write and execution lanes require rollback target"],
  ["no_agent_final_pass", "Agent-created final PASS is blocked"],
  ["raw_material_quarantine", "raw sensitive material must remain quarantined"],
];

const HANDOFF_SPECS = [
  ["p2241_limited_execution", "P2241-P2400", "Limited execution can consume restored runtime governance contracts only after receipt gates."],
  ["p2401_controlled_write_console", "P2401-P2560", "Controlled write and console can consume tool policy, hard hook, and evidence contracts."],
  ["p2561_memory_event_plane", "P2561-P2720", "Memory and event plane can consume job and evidence contracts."],
];

export async function runPlatformRuntimeGovernanceRestore(options = {}) {
  const result = await buildPlatformRuntimeGovernanceRestore(options);
  if (options.write !== false) await writePlatformRuntimeGovernanceRestore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform runtime governance restore failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformRuntimeGovernanceRestore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RUNTIME_GOVERNANCE_RESTORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const reversalLedger = await readTextSource(inputs.reversal_ledger_path);
  const runtimeGovernanceLedger = await readTextSource(inputs.runtime_governance_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceReversal = options.sourceReversal ?? await buildPlatformNousNonAdoptionReversal({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    reversalLedgerPath: inputs.reversal_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const apiContractRows = buildApiContractRows();
  const mcpRegistryRows = buildMcpRegistryRows();
  const toolPolicyRows = buildToolPolicyRows();
  const jobLedgerRows = buildJobLedgerRows();
  const doctorEvidenceRows = buildDoctorEvidenceRows();
  const hardHookRows = buildHardHookRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, reversalLedger, runtimeGovernanceLedger, roadmapDoc, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows });
  const guardRows = buildGuardRows({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows });
  const boundary = buildBoundary({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, reversalLedger, runtimeGovernanceLedger, roadmapDoc, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_runtime_governance_restore_id: `platform-runtime-governance-restore.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    runtime_governance_restore_anchor: anchor,
    source_nous_non_adoption_reversal_summary: sourceReversal.summary,
    runtime_governance_manifest: manifest,
    runtime_governance_component_rows: componentRows,
    runtime_api_contract_rows: apiContractRows,
    mcp_registry_rows: mcpRegistryRows,
    tool_gateway_policy_rows: toolPolicyRows,
    job_scheduler_ledger_rows: jobLedgerRows,
    doctor_health_evidence_rows: doctorEvidenceRows,
    hard_hook_scaffold_rows: hardHookRows,
    runtime_governance_handoff_rows: handoffRows,
    runtime_governance_guard_rows: guardRows,
    runtime_governance_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_runtime_governance_restore")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_runtime_governance_restore_id = result.platform_runtime_governance_restore_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformRuntimeGovernanceRestore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-runtime-governance-restore.json"), serializableResult(result));
  await writeJson(path.join(outDir, "runtime-governance-manifest.json"), result.runtime_governance_manifest);
  await writeJson(path.join(outDir, "runtime-governance-component-rows.json"), collectionEnvelope("runtime-governance-component-rows.v1", "runtime_governance_component_rows", result.runtime_governance_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-api-contract-rows.json"), collectionEnvelope("runtime-api-contract-rows.v1", "runtime_api_contract_rows", result.runtime_api_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "mcp-registry-rows.json"), collectionEnvelope("mcp-registry-rows.v1", "mcp_registry_rows", result.mcp_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "tool-gateway-policy-rows.json"), collectionEnvelope("tool-gateway-policy-rows.v1", "tool_gateway_policy_rows", result.tool_gateway_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "job-scheduler-ledger-rows.json"), collectionEnvelope("job-scheduler-ledger-rows.v1", "job_scheduler_ledger_rows", result.job_scheduler_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "doctor-health-evidence-rows.json"), collectionEnvelope("doctor-health-evidence-rows.v1", "doctor_health_evidence_rows", result.doctor_health_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "hard-hook-scaffold-rows.json"), collectionEnvelope("hard-hook-scaffold-rows.v1", "hard_hook_scaffold_rows", result.hard_hook_scaffold_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-governance-handoff-rows.json"), collectionEnvelope("runtime-governance-handoff-rows.v1", "runtime_governance_handoff_rows", result.runtime_governance_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-governance-guard-rows.json"), collectionEnvelope("runtime-governance-guard-rows.v1", "runtime_governance_guard_rows", result.runtime_governance_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-governance-boundary.json"), result.runtime_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-runtime-governance-restore-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformRuntimeGovernanceRestoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformRuntimeGovernanceRestore(args);
    console.log(`Platform runtime governance restore ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_runtime_governance_restore_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`API contracts: ${result.summary.api_contract_count}`);
    console.log(`Tool policies: ${result.summary.tool_policy_count}`);
    console.log(`Hard hooks: ${result.summary.hard_hook_count}`);
    console.log(`P2241 handoff ready: ${result.summary.p2241_ready_as_next_goal}`);
    console.log(`Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Write action allowed now: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "runtime-governance-component-row.v1",
    row_id: `runtime.governance.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "restored_contract",
    description,
    evidence_ref: `evidence.platform.runtime_governance.component.${componentId}`,
    reviewer_ref: "reviewer.platform_runtime_governance",
    hard_gate_ref: `gate.platform.runtime_governance.component.${componentId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "preserve as P2241 limited execution input",
  }));
}

function buildApiContractRows() {
  return API_CONTRACT_SPECS.map(([routePath, responseCollection], index) => passRow({
    schema_version: "runtime-api-contract-row.v1",
    row_id: `runtime.api.contract.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    response_collection: responseCollection,
    route_status: "contract_restored_read_only",
    server_started: false,
    mutation_route: false,
    execution_route: false,
    receipt_application_route: false,
    evidence_ref: `evidence.platform.runtime_governance.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_runtime_governance_api",
    hard_gate_ref: `gate.platform.runtime_governance.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "project route contract without starting server",
  }));
}

function buildMcpRegistryRows() {
  return MCP_REGISTRY_SPECS.map(([registryId, description], index) => passRow({
    schema_version: "mcp-registry-row.v1",
    row_id: `mcp.registry.row.${String(index + 1).padStart(2, "0")}`,
    registry_id: registryId,
    registry_status: "contract_restored",
    description,
    connection_opened_now: false,
    tool_call_allowed_now: false,
    secret_read_allowed_now: false,
    evidence_ref: `evidence.platform.runtime_governance.mcp.${registryId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_mcp",
    hard_gate_ref: `gate.platform.runtime_governance.mcp.${registryId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind health evidence before any live MCP connection",
  }));
}

function buildToolPolicyRows() {
  return TOOL_POLICY_SPECS.map(([toolPolicyId, description], index) => passRow({
    schema_version: "tool-gateway-policy-row.v1",
    row_id: `tool.gateway.policy.row.${String(index + 1).padStart(2, "0")}`,
    tool_policy_id: toolPolicyId,
    policy_status: "contract_restored",
    description,
    requires_allowlist: true,
    requires_receipt: true,
    requires_redaction: true,
    requires_timeout: true,
    requires_evidence: true,
    requires_rollback: ["terminal_command", "file_write", "install_command", "job_run"].includes(toolPolicyId),
    tool_execution_allowed_now: false,
    write_action_allowed_now: false,
    secret_read_allowed_now: false,
    evidence_ref: `evidence.platform.runtime_governance.tool.${toolPolicyId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_tool",
    hard_gate_ref: `gate.platform.runtime_governance.tool.${toolPolicyId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in P2241 limited execution gate design",
  }));
}

function buildJobLedgerRows() {
  return JOB_LEDGER_SPECS.map(([jobId, description], index) => passRow({
    schema_version: "job-scheduler-ledger-row.v1",
    row_id: `job.scheduler.ledger.row.${String(index + 1).padStart(2, "0")}`,
    job_id: jobId,
    job_status: "contract_restored",
    description,
    scheduled_now: false,
    job_run_allowed_now: false,
    pause_resume_allowed_now: false,
    requires_receipt: true,
    requires_evidence: true,
    evidence_ref: `evidence.platform.runtime_governance.job.${jobId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_job",
    hard_gate_ref: `gate.platform.runtime_governance.job.${jobId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind to P2561 event plane before any scheduler execution",
  }));
}

function buildDoctorEvidenceRows() {
  return DOCTOR_EVIDENCE_SPECS.map(([evidenceClassId, description], index) => passRow({
    schema_version: "doctor-health-evidence-row.v1",
    row_id: `doctor.health.evidence.row.${String(index + 1).padStart(2, "0")}`,
    evidence_class_id: evidenceClassId,
    evidence_status: "contract_restored",
    description,
    raw_stdout_allowed: false,
    secret_exposure_allowed: false,
    redacted_summary_required: true,
    evidence_ref_required: true,
    evidence_ref: `evidence.platform.runtime_governance.doctor.${evidenceClassId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_doctor",
    hard_gate_ref: `gate.platform.runtime_governance.doctor.${evidenceClassId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "capture redacted evidence in P2241 or later runtime lane",
  }));
}

function buildHardHookRows() {
  return HARD_HOOK_SPECS.map(([hookId, description], index) => passRow({
    schema_version: "hard-hook-scaffold-row.v1",
    row_id: `hard.hook.scaffold.row.${String(index + 1).padStart(2, "0")}`,
    hook_id: hookId,
    hook_status: "scaffold_restored",
    description,
    deterministic_check_required: true,
    enforcement_enabled_now: false,
    protected_action_blocked_without_hook: true,
    evidence_ref: `evidence.platform.runtime_governance.hook.${hookId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_hook",
    hard_gate_ref: `gate.platform.runtime_governance.hook.${hookId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "promote to enforcement in the relevant execution or write tranche",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "runtime-governance-handoff-row.v1",
    row_id: `runtime.governance.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    execution_enabled_by_handoff: false,
    write_enabled_by_handoff: false,
    protected_action_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.runtime_governance.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_handoff",
    hard_gate_ref: `gate.platform.runtime_governance.handoff.${handoffId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in later phase without treating handoff as execution permission",
  }));
}

function buildAnchor({ packageJson, reversalLedger, runtimeGovernanceLedger, roadmapDoc, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows }) {
  return {
    schema_version: "runtime-governance-restore-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    reversal_ledger_present: reversalLedger.available,
    runtime_governance_ledger_present: runtimeGovernanceLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_reversal_status: sourceReversal.summary.platform_nous_non_adoption_reversal_status,
    source_nous_adopted: sourceReversal.summary.nous_adopted,
    component_count: componentRows.length,
    api_contract_count: apiContractRows.length,
    mcp_registry_count: mcpRegistryRows.length,
    tool_policy_count: toolPolicyRows.length,
    job_ledger_count: jobLedgerRows.length,
    doctor_evidence_count: doctorEvidenceRows.length,
    hard_hook_count: hardHookRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows }) {
  return {
    schema_version: "runtime-governance-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_reversal_status: sourceReversal.summary.platform_nous_non_adoption_reversal_status,
    nous_adopted: sourceReversal.summary.nous_adopted,
    component_count: componentRows.length,
    api_contract_count: apiContractRows.length,
    mcp_registry_count: mcpRegistryRows.length,
    tool_policy_count: toolPolicyRows.length,
    job_ledger_count: jobLedgerRows.length,
    doctor_evidence_count: doctorEvidenceRows.length,
    hard_hook_count: hardHookRows.length,
    handoff_count: handoffRows.length,
    runtime_governance_restored_as_contracts: true,
    next_allowed_action: "start P2241-P2400 human-approved limited execution planning",
  };
}

function buildGuardRows({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows }) {
  const guards = [
    ["source_reversal_ready", sourceReversal.summary.platform_nous_non_adoption_reversal_status === SOURCE_READY_STATUS, "Source non-adoption reversal must be ready"],
    ["nous_not_adopted", sourceReversal.summary.nous_adopted === false, "Nous must remain not adopted"],
    ["components_ready", componentRows.length === 7 && componentRows.every((row) => row.current_verdict === "pass"), "All runtime governance components must pass"],
    ["api_contracts_read_only", apiContractRows.length === 7 && apiContractRows.every((row) => row.method === "GET" && row.server_started === false), "API contracts must be read-only and not started"],
    ["mcp_connections_closed", mcpRegistryRows.every((row) => row.connection_opened_now === false && row.tool_call_allowed_now === false), "MCP connections must remain closed"],
    ["tool_execution_closed", toolPolicyRows.every((row) => row.tool_execution_allowed_now === false && row.write_action_allowed_now === false), "Tool execution must remain closed"],
    ["jobs_not_running", jobLedgerRows.every((row) => row.scheduled_now === false && row.job_run_allowed_now === false), "Jobs must not run"],
    ["doctor_evidence_redacted", doctorEvidenceRows.every((row) => row.raw_stdout_allowed === false && row.redacted_summary_required === true), "Doctor evidence must require redaction"],
    ["hard_hooks_scaffolded", hardHookRows.length === 8 && hardHookRows.every((row) => row.deterministic_check_required === true), "Hard hook scaffolds must exist"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.execution_enabled_by_handoff === false && row.write_enabled_by_handoff === false), "Handoffs must not enable execution"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "runtime-governance-guard-row.v1",
    row_id: `runtime.governance.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.runtime_governance.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_runtime_governance_guard",
    hard_gate_ref: `gate.platform.runtime_governance.guard.${guardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2240 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceReversal.summary.platform_nous_non_adoption_reversal_status !== SOURCE_READY_STATUS,
    sourceReversal.summary.nous_adopted !== false,
    sourceReversal.summary.runtime_execution_allowed_now,
    sourceReversal.summary.write_action_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    apiContractRows.some((row) => row.server_started || row.mutation_route || row.execution_route || row.receipt_application_route),
    mcpRegistryRows.some((row) => row.connection_opened_now || row.tool_call_allowed_now || row.secret_read_allowed_now),
    toolPolicyRows.some((row) => row.tool_execution_allowed_now || row.write_action_allowed_now || row.secret_read_allowed_now),
    jobLedgerRows.some((row) => row.scheduled_now || row.job_run_allowed_now || row.pause_resume_allowed_now),
    doctorEvidenceRows.some((row) => row.raw_stdout_allowed || row.secret_exposure_allowed),
    hardHookRows.some((row) => row.enforcement_enabled_now),
    handoffRows.some((row) => row.execution_enabled_by_handoff || row.write_enabled_by_handoff || row.protected_action_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "runtime-governance-boundary.v1",
    source_reversal_status: sourceReversal.summary.platform_nous_non_adoption_reversal_status,
    nous_adopted: false,
    runtime_governance_restored_as_contracts: true,
    p2241_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    server_started: false,
    mcp_connection_opened: false,
    tool_execution_performed: false,
    job_scheduled_or_run: false,
    mutation_performed: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_material_access_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, reversalLedger, runtimeGovernanceLedger, roadmapDoc, sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:runtime-governance-restore"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:runtime-governance-restore -- --check"),
    validationItem("source.reversal", "source_ready", sourceReversal.summary.platform_nous_non_adoption_reversal_status === SOURCE_READY_STATUS, "source reversal must be ready"),
    validationItem("source.nous_false", "source_ready", sourceReversal.summary.nous_adopted === false, "source reversal must set Nous adopted false"),
    validationItem("ledger.reversal", "ledger", reversalLedger.available && reversalLedger.text.includes(SOURCE_COMMAND_NAME), "reversal ledger must be present"),
    validationItem("ledger.runtime_governance", "ledger", runtimeGovernanceLedger.available && runtimeGovernanceLedger.text.includes("P2121-P2240") && runtimeGovernanceLedger.text.includes(COMMAND_NAME), "runtime governance ledger must be present"),
    validationItem("roadmap.runtime_governance", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2121-P2240") && roadmapDoc.text.includes("Hermes Runtime Governance Restore"), "roadmap must reflect runtime governance restore"),
    validationItem("components.count", "component_rows", componentRows.length === 7, "all component rows must exist"),
    validationItem("api.count", "api_rows", apiContractRows.length === 7, "all runtime API contract rows must exist"),
    validationItem("mcp.count", "mcp_rows", mcpRegistryRows.length === 4, "all MCP registry rows must exist"),
    validationItem("tools.count", "tool_rows", toolPolicyRows.length === 7, "all tool policy rows must exist"),
    validationItem("jobs.count", "job_rows", jobLedgerRows.length === 5, "all job ledger rows must exist"),
    validationItem("doctor.count", "doctor_rows", doctorEvidenceRows.length === 6, "all doctor evidence rows must exist"),
    validationItem("hooks.count", "hook_rows", hardHookRows.length === 8, "all hard hook rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all handoff rows must exist"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all runtime governance guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "unsafe_invariants", boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "runtime governance restore must not enable runtime or write"),
  ];
}

function buildSummary({ sourceReversal, componentRows, apiContractRows, mcpRegistryRows, toolPolicyRows, jobLedgerRows, doctorEvidenceRows, hardHookRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-runtime-governance-restore-summary.v1",
    platform_runtime_governance_restore_status: validation.valid && boundary.p2241_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reversal_status: sourceReversal.summary.platform_nous_non_adoption_reversal_status,
    nous_adopted: boundary.nous_adopted,
    component_count: componentRows.length,
    api_contract_count: apiContractRows.length,
    mcp_registry_count: mcpRegistryRows.length,
    tool_policy_count: toolPolicyRows.length,
    job_ledger_count: jobLedgerRows.length,
    doctor_evidence_count: doctorEvidenceRows.length,
    hard_hook_count: hardHookRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    runtime_governance_restored_as_contracts: boundary.runtime_governance_restored_as_contracts,
    p2241_ready_as_next_goal: boundary.p2241_ready_as_next_goal,
    server_started: boundary.server_started,
    mcp_connection_opened: boundary.mcp_connection_opened,
    tool_execution_performed: boundary.tool_execution_performed,
    job_scheduled_or_run: boundary.job_scheduled_or_run,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Runtime Governance Restore",
    "",
    `Status: ${result.summary.platform_runtime_governance_restore_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source reversal status: ${result.summary.source_reversal_status}`,
    `Nous adopted: ${result.summary.nous_adopted}`,
    `Components: ${result.summary.component_count}`,
    `API contracts: ${result.summary.api_contract_count}`,
    `MCP registries: ${result.summary.mcp_registry_count}`,
    `Tool policies: ${result.summary.tool_policy_count}`,
    `Job ledgers: ${result.summary.job_ledger_count}`,
    `Doctor evidence rows: ${result.summary.doctor_evidence_count}`,
    `Hard hooks: ${result.summary.hard_hook_count}`,
    `P2241 ready as next goal: ${result.summary.p2241_ready_as_next_goal}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2241-P2400 Human-Approved Limited Execution. This restore does not start servers, connect MCP, execute tools, run jobs, apply receipts, or write files.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_RUNTIME_GOVERNANCE_RESTORE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    reversal_ledger_path: options.reversalLedgerPath ?? defaults.reversalLedgerPath,
    runtime_governance_ledger_path: options.runtimeGovernanceLedgerPath ?? defaults.runtimeGovernanceLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
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

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    reversalLedgerPath: undefined,
    runtimeGovernanceLedgerPath: undefined,
    roadmapDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--reversal-ledger") {
      args.reversalLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--runtime-governance-ledger") {
      args.runtimeGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-runtime-governance-restore.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --reversal-ledger <path>        Nous non-adoption reversal ledger path.
  --runtime-governance-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
