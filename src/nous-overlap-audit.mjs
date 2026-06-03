import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelHarnessNativeCutoverFreeze } from "./platform-kernel-harness-native-cutover-freeze.mjs";

export const DEFAULT_NOUS_OVERLAP_AUDIT_OUT_DIR = "artifacts/nous-overlap-audit/latest";
export const DEFAULT_NOUS_OVERLAP_AUDIT_INPUTS = {
  schemaPath: "schemas/nous-overlap-audit.schema.json",
  packagePath: "package.json",
  p2040FreezeLedgerPath: "docs/hermes-platform-kernel-harness-native-cutover-freeze-phase-ledger.md",
  overlapAuditLedgerPath: "docs/nous-overlap-audit.md",
};

const COMMAND_NAME = "platform:nous-overlap-audit";
const SOURCE_COMMAND_NAME = "platform:kernel-harness-native-cutover-freeze";
const SCHEMA_VERSION = "nous-overlap-audit.v1";
const CAPABILITY_ID = "platform.nous_overlap_audit";
const PROGRAM_RANGE = "P2041-P2120";
const PHASE_RANGE = "P2041-P2120";
const PHASE_SLOT = "P2041";
const PREVIOUS_PHASE_SLOT = "P2040";
const NEXT_PHASE_SLOT = "P2121";
const READY_STATUS = "ready_for_nous_overlap_audit";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_harness_native_cutover_freeze";

const NOUS_SOURCE_SPECS = [
  {
    source_id: "nous.api_server",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server",
    source_label: "API Server",
    documented_surfaces: ["/v1/chat/completions", "/v1/responses", "/v1/capabilities", "/v1/runs", "/v1/runs/{run_id}/events", "/api/sessions", "/v1/skills", "/v1/toolsets"],
    overlap_domain: "runtime_api_and_session_control",
  },
  {
    source_id: "nous.web_dashboard",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard",
    source_label: "Web Dashboard",
    documented_surfaces: ["dashboard", "sessions", "logs", "analytics", "cron", "skills", "mcp"],
    overlap_domain: "operator_ui_and_runtime_management",
  },
  {
    source_id: "nous.tools_toolsets",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/tools",
    source_label: "Tools and Toolsets",
    documented_surfaces: ["toolsets", "terminal", "file operations", "web search", "browser", "skills"],
    overlap_domain: "tool_gateway_and_skill_execution",
  },
  {
    source_id: "nous.security",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/security",
    source_label: "Security",
    documented_surfaces: ["approvals", "sandboxing", "dangerous command controls", "local credential boundaries"],
    overlap_domain: "runtime_safety_boundary",
  },
  {
    source_id: "nous.memory",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/memory",
    source_label: "Persistent Memory",
    documented_surfaces: ["session memory", "long-term memory", "scoped memory provider"],
    overlap_domain: "agent_memory_and_session_state",
  },
  {
    source_id: "nous.mcp",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp",
    source_label: "MCP",
    documented_surfaces: ["mcp servers", "mcp tools", "gateway restart boundary", "server testing"],
    overlap_domain: "mcp_gateway_management",
  },
  {
    source_id: "nous.architecture",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/architecture",
    source_label: "Architecture",
    documented_surfaces: ["agent runtime", "gateway", "providers", "tool gateway", "session store"],
    overlap_domain: "agent_runtime_architecture",
  },
  {
    source_id: "nous.jobs_api",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server",
    source_label: "Jobs API",
    documented_surfaces: ["/api/jobs", "/api/jobs/{job_id}", "/api/jobs/{job_id}/pause", "/api/jobs/{job_id}/resume", "/api/jobs/{job_id}/run"],
    overlap_domain: "scheduled_agent_runs",
  },
];

const HARNESS_SURFACE_SPECS = [
  {
    surface_id: "p1201_agent_runtime_activation_bridge",
    phase_range: "P1201-P1320",
    surface_name: "Agent Runtime Activation Bridge",
    original_intent: "Turn receipts, install proof, doctor evidence, and domain no-write pilots into an activation-adjacent contract.",
    overlap_source_ids: ["nous.api_server", "nous.architecture", "nous.security"],
    overlap_level: "direct",
    classification: "adapter_boundary",
    decision_reason: "Keep the receipt and policy envelope, but delegate execution to Nous runtime surfaces instead of building a second runtime.",
    next_allowed_action: "Rewrite as a pre-invocation and post-run governance adapter around Nous runs.",
  },
  {
    surface_id: "p1221_approved_install_doctor_lane",
    phase_range: "P1221-P1320",
    surface_name: "Approved Install and Doctor Evidence Lane",
    original_intent: "Record operator-approved install and smoke evidence without enabling runtime execution.",
    overlap_source_ids: ["nous.api_server", "nous.web_dashboard"],
    overlap_level: "partial",
    classification: "adapter_boundary",
    decision_reason: "Install trust and doctor receipts are still harness-owned, while live health/session state should come from Nous endpoints.",
    next_allowed_action: "Bind local receipts to /health, /v1/capabilities, and dashboard evidence without wrapping private internals.",
  },
  {
    surface_id: "p1321_domain_agent_no_write_pilot",
    phase_range: "P1321-P1440",
    surface_name: "Domain Agent No-Write Pilot",
    original_intent: "Classify domain work as no-write/no-final-authority and preserve external-project boundaries.",
    overlap_source_ids: ["nous.security", "nous.tools_toolsets"],
    overlap_level: "partial",
    classification: "keep_harness_native",
    decision_reason: "Domain/matter/project authority is Hermes control-plane policy, not a generic agent runtime primitive.",
    next_allowed_action: "Keep as policy gate and request-packet classifier before a Nous run is allowed.",
  },
  {
    surface_id: "p1441_agent_operator_console_v0",
    phase_range: "P1441-P1500",
    surface_name: "Agent Operator Console V0",
    original_intent: "Expose runtime-adjacent status and operator console rows.",
    overlap_source_ids: ["nous.web_dashboard", "nous.api_server"],
    overlap_level: "direct",
    classification: "deprecate_into_governance",
    decision_reason: "Nous already owns live dashboard/session/log/cron management; Hermes should expose only read-only governance verdicts.",
    next_allowed_action: "Do not implement a second runtime console; collapse to read-only audit widgets sourced from harness ledgers.",
  },
  {
    surface_id: "p1501_kernel_contract_baseline",
    phase_range: "P1501-P1560",
    surface_name: "Kernel Contract Baseline",
    original_intent: "Commonize claim, evidence, gate, check, receipt, status, and artifact primitives.",
    overlap_source_ids: [],
    overlap_level: "none",
    classification: "keep_harness_native",
    decision_reason: "These are deterministic governance records and should remain independent of the agent runtime.",
    next_allowed_action: "Keep as the canonical Hermes governance contract.",
  },
  {
    surface_id: "p1561_kernel_spec_status_reconciliation",
    phase_range: "P1561-P1640",
    surface_name: "Kernel Spec Status Reconciliation",
    original_intent: "Reconcile spec rows, status rows, and claim statuses across platform/domain packs.",
    overlap_source_ids: [],
    overlap_level: "none",
    classification: "keep_harness_native",
    decision_reason: "Spec/status reconciliation is harness ledger logic, not a runtime/session-store feature.",
    next_allowed_action: "Keep and feed reconciled rows into pre-run eligibility checks.",
  },
  {
    surface_id: "p1641_claim_evidence_gate_engine",
    phase_range: "P1641-P1720",
    surface_name: "Claim Evidence Gate Engine",
    original_intent: "Bind claims to evidence, reviewers, hard gates, responsible owners, and verdict authority.",
    overlap_source_ids: ["nous.security"],
    overlap_level: "partial",
    classification: "keep_harness_native",
    decision_reason: "Nous can enforce runtime approvals, but domain-specific claim authority and legal/release gates belong to Hermes.",
    next_allowed_action: "Keep as the hard PASS/BLOCK adjudicator after Nous outputs return.",
  },
  {
    surface_id: "p1721_artifact_check_receipt_engine",
    phase_range: "P1721-P1800",
    surface_name: "Artifact Check Receipt Engine",
    original_intent: "Bind artifacts, checks, receipts, and validation packet rows.",
    overlap_source_ids: ["nous.api_server", "nous.web_dashboard"],
    overlap_level: "partial",
    classification: "deprecate_into_governance",
    decision_reason: "Keep receipt rows, but avoid building a separate run artifact/event engine that competes with Nous run events.",
    next_allowed_action: "Do not implement run event storage; retain only hash, receipt, and reviewer references.",
  },
  {
    surface_id: "p1801_kernel_projection_freeze",
    phase_range: "P1801-P1880",
    surface_name: "Kernel Projection Freeze",
    original_intent: "Project read-only API/dashboard routes for Kernel rows.",
    overlap_source_ids: ["nous.api_server", "nous.web_dashboard"],
    overlap_level: "direct",
    classification: "deprecate_into_governance",
    decision_reason: "Projection is useful only as read-only governance status; live API/dashboard operations belong to Nous.",
    next_allowed_action: "Do not add mutating or live runtime routes; expose static governance projections only.",
  },
  {
    surface_id: "p1881_harness_native_cutover_adapter",
    phase_range: "P1881-P1960",
    surface_name: "Harness Native Cutover Adapter",
    original_intent: "Bind development lanes, adapters, domains, and cutover claims.",
    overlap_source_ids: ["nous.architecture", "nous.tools_toolsets", "nous.mcp"],
    overlap_level: "direct",
    classification: "deprecate_into_governance",
    decision_reason: "Development-lane control should not become a second tool runner, MCP gateway, or scheduler.",
    next_allowed_action: "Do not implement workers; keep only lane policy, input packets, and after-action receipts.",
  },
  {
    surface_id: "p1961_kernel_harness_native_cutover_freeze",
    phase_range: "P1961-P2040",
    surface_name: "Kernel Harness Native Cutover Freeze",
    original_intent: "Close P1501-P2040 and freeze no-execution boundaries.",
    overlap_source_ids: [],
    overlap_level: "none",
    classification: "keep_harness_native",
    decision_reason: "The freeze is a governance checkpoint and suspension declaration, not runtime functionality.",
    next_allowed_action: "Keep as checkpoint evidence and audit input.",
  },
  {
    surface_id: "p2041_limited_execution_program",
    phase_range: "P2041+",
    surface_name: "P2041 Limited Execution Program",
    original_intent: "Begin human-approved limited execution behind receipts.",
    overlap_source_ids: ["nous.api_server", "nous.web_dashboard", "nous.jobs_api", "nous.memory", "nous.mcp"],
    overlap_level: "direct",
    classification: "drop_suspended",
    decision_reason: "Starting limited execution now would duplicate Nous runtime, jobs, memory, MCP, and dashboard surfaces.",
    next_allowed_action: "Do not implement; replace with a future Nous adapter spec only after this audit is accepted.",
  },
];

const BLOCKED_NEXT_PHASE_SPECS = [
  ["p2041_limited_execution", "P2041-P2160", "limited execution is suspended until a Nous adapter spec exists"],
  ["p2161_work_order_delegation", "P2161-P2280", "delegation cannot start before runtime ownership is externalized to Nous"],
  ["p2281_controlled_write", "P2281-P2560", "controlled writes remain blocked until after adapter-only dry-run evidence"],
  ["p2561_storage_event_plane", "P2561-P3200", "storage/event plane must not clone Nous run/session/job storage"],
];

export async function runNousOverlapAudit(options = {}) {
  const result = await buildNousOverlapAudit(options);
  if (options.write !== false) await writeNousOverlapAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Nous overlap audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildNousOverlapAudit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_NOUS_OVERLAP_AUDIT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const p2040FreezeLedger = await readTextSource(inputs.p2040_freeze_ledger_path);
  const overlapAuditLedger = await readTextSource(inputs.overlap_audit_ledger_path);
  const sourceP2040Freeze = options.sourceP2040Freeze ?? await buildPlatformKernelHarnessNativeCutoverFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    kernelCutoverFreezeLedgerPath: inputs.p2040_freeze_ledger_path,
    write: false,
  });

  const sourceRows = buildNousSourceRows();
  const surfaceRows = buildHarnessSurfaceRows();
  const blockedNextPhaseRows = buildBlockedNextPhaseRows();
  const anchor = buildAnchor({ packageJson, p2040FreezeLedger, overlapAuditLedger, sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows });
  const policy = buildPolicy({ sourceP2040Freeze, surfaceRows, blockedNextPhaseRows });
  const boundary = buildBoundary({ sourceP2040Freeze, surfaceRows, blockedNextPhaseRows, policy });
  const validationItems = buildValidationItems({ packageJson, p2040FreezeLedger, overlapAuditLedger, sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    nous_overlap_audit_id: `nous-overlap-audit.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    nous_overlap_audit_anchor: anchor,
    source_p2040_freeze_summary: sourceP2040Freeze.summary,
    nous_source_rows: sourceRows,
    harness_surface_classification_rows: surfaceRows,
    blocked_next_phase_rows: blockedNextPhaseRows,
    nous_overlap_policy: policy,
    nous_overlap_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows, policy, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "nous_overlap_audit")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows, policy, boundary, validation: result.validation });
  result.summary.nous_overlap_audit_id = result.nous_overlap_audit_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeNousOverlapAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "nous-overlap-audit.json"), serializableResult(result));
  await writeJson(path.join(outDir, "nous-source-rows.json"), collectionEnvelope("nous-source-rows.v1", "nous_source_rows", result.nous_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-surface-classification-rows.json"), collectionEnvelope("harness-surface-classification-rows.v1", "harness_surface_classification_rows", result.harness_surface_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-next-phase-rows.json"), collectionEnvelope("blocked-next-phase-rows.v1", "blocked_next_phase_rows", result.blocked_next_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "nous-overlap-policy.json"), result.nous_overlap_policy);
  await writeJson(path.join(outDir, "nous-overlap-boundary.json"), result.nous_overlap_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "nous-overlap-audit-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runNousOverlapAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runNousOverlapAudit(args);
    console.log(`Nous overlap audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.nous_overlap_audit_status}`);
    console.log(`Surfaces: ${result.summary.surface_count}`);
    console.log(`Classifications: keep ${result.summary.keep_harness_native_count}, adapter ${result.summary.adapter_boundary_count}, deprecate ${result.summary.deprecate_into_governance_count}, drop ${result.summary.drop_suspended_count}`);
    console.log(`P2041 suspended: ${result.summary.p2041_suspended_pending_nous_overlap_audit}`);
    console.log(`Runtime execution allowed: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildNousSourceRows() {
  return NOUS_SOURCE_SPECS.map((spec, index) => passRow({
    schema_version: "nous-source-row.v1",
    row_id: `nous.source.row.${String(index + 1).padStart(2, "0")}`,
    ...spec,
    evidence_ref: `evidence.nous.source.${spec.source_id}`,
    reviewer_ref: "reviewer.nous_overlap_audit",
    hard_gate_ref: `gate.nous.source.${spec.source_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "use as external-source evidence only; do not vendor or reimplement",
  }));
}

function buildHarnessSurfaceRows() {
  return HARNESS_SURFACE_SPECS.map((spec, index) => passRow({
    schema_version: "harness-surface-classification-row.v1",
    row_id: `harness.surface.classification.row.${String(index + 1).padStart(2, "0")}`,
    ...spec,
    implementation_allowed_now: ["keep_harness_native", "adapter_boundary"].includes(spec.classification),
    nous_runtime_reimplementation_allowed: false,
    evidence_ref: `evidence.nous.overlap.surface.${spec.surface_id}`,
    reviewer_ref: "reviewer.nous_overlap_audit",
    hard_gate_ref: `gate.nous.overlap.surface.${spec.surface_id}`,
    responsible_owner: "platform_kernel_owner",
  }));
}

function buildBlockedNextPhaseRows() {
  return BLOCKED_NEXT_PHASE_SPECS.map(([blocked_phase_id, phase_range, block_reason], index) => blockedRow({
    schema_version: "blocked-next-phase-row.v1",
    row_id: `blocked.next.phase.row.${String(index + 1).padStart(2, "0")}`,
    blocked_phase_id,
    phase_range,
    block_reason,
    execution_allowed_now: false,
    write_action_allowed_now: false,
    runtime_reimplementation_allowed: false,
    evidence_ref: `evidence.nous.overlap.blocked_phase.${blocked_phase_id}`,
    reviewer_ref: "reviewer.nous_overlap_audit",
    hard_gate_ref: `gate.nous.overlap.blocked_phase.${blocked_phase_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "do not implement until a Nous adapter-only spec is accepted",
  }));
}

function buildAnchor({ packageJson, p2040FreezeLedger, overlapAuditLedger, sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows }) {
  return {
    schema_version: "nous-overlap-audit-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    p2040_freeze_ledger_present: p2040FreezeLedger.available,
    p2040_freeze_suspension_declared: p2040FreezeLedger.text.includes("P2041") && p2040FreezeLedger.text.includes("Nous overlap audit"),
    overlap_audit_ledger_present: overlapAuditLedger.available,
    source_p2040_freeze_status: sourceP2040Freeze.summary.platform_kernel_harness_native_cutover_freeze_status,
    source_count: sourceRows.length,
    surface_count: surfaceRows.length,
    blocked_next_phase_count: blockedNextPhaseRows.length,
  };
}

function buildPolicy({ sourceP2040Freeze, surfaceRows, blockedNextPhaseRows }) {
  return {
    schema_version: "nous-overlap-policy.v1",
    p2041_suspended_pending_nous_overlap_audit: true,
    p2041_limited_execution_allowed_now: false,
    direct_nous_runtime_call_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    nous_runtime_reimplementation_allowed: false,
    nous_mcp_gateway_reimplementation_allowed: false,
    nous_memory_store_reimplementation_allowed: false,
    nous_jobs_scheduler_reimplementation_allowed: false,
    nous_dashboard_reimplementation_allowed: false,
    source_p2040_freeze_suspended: sourceP2040Freeze.summary.p2041_suspended_pending_nous_overlap_audit === true,
    drop_or_deprecate_count: surfaceRows.filter((row) => ["deprecate_into_governance", "drop_suspended"].includes(row.classification)).length,
    blocked_next_phase_count: blockedNextPhaseRows.length,
    next_allowed_action: "write a Nous adapter-only spec before any further execution tranche",
  };
}

function buildBoundary({ sourceP2040Freeze, surfaceRows, blockedNextPhaseRows, policy }) {
  const unsafeFlags = [
    sourceP2040Freeze.summary.agent_runtime_execution_allowed_now,
    sourceP2040Freeze.summary.write_action_allowed_now,
    policy.p2041_limited_execution_allowed_now,
    policy.direct_nous_runtime_call_allowed_now,
    policy.runtime_execution_allowed_now,
    policy.write_action_allowed_now,
    policy.protected_action_execution_allowed_now,
    policy.receipt_application_allowed_now,
    policy.nous_runtime_reimplementation_allowed,
    policy.nous_mcp_gateway_reimplementation_allowed,
    policy.nous_memory_store_reimplementation_allowed,
    policy.nous_jobs_scheduler_reimplementation_allowed,
    policy.nous_dashboard_reimplementation_allowed,
    surfaceRows.some((row) => !row.classification),
    surfaceRows.some((row) => ["deprecate_into_governance", "drop_suspended"].includes(row.classification) && row.nous_runtime_reimplementation_allowed !== false),
    blockedNextPhaseRows.some((row) => row.execution_allowed_now || row.write_action_allowed_now || row.runtime_reimplementation_allowed),
  ];
  return {
    schema_version: "nous-overlap-boundary.v1",
    source_p2040_freeze_status: sourceP2040Freeze.summary.platform_kernel_harness_native_cutover_freeze_status,
    p2041_suspended_pending_nous_overlap_audit: policy.p2041_suspended_pending_nous_overlap_audit,
    p2041_limited_execution_allowed_now: false,
    server_started: false,
    mutation_performed: false,
    direct_nous_runtime_call_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_material_exposed: false,
    nous_runtime_reimplementation_allowed: false,
    nous_mcp_gateway_reimplementation_allowed: false,
    nous_memory_store_reimplementation_allowed: false,
    nous_jobs_scheduler_reimplementation_allowed: false,
    nous_dashboard_reimplementation_allowed: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, p2040FreezeLedger, overlapAuditLedger, sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows, boundary }) {
  const classifications = new Set(surfaceRows.map((row) => row.classification));
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:nous-overlap-audit"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:nous-overlap-audit -- --check"),
    validationItem("source.p2040_freeze", "source_ready", sourceP2040Freeze.summary.platform_kernel_harness_native_cutover_freeze_status === SOURCE_READY_STATUS, "P2040 freeze must be ready"),
    validationItem("source.p2040_suspension", "source_ready", sourceP2040Freeze.summary.p2041_suspended_pending_nous_overlap_audit === true, "P2040 freeze must declare P2041 suspension"),
    validationItem("ledger.p2040_suspension", "ledger", p2040FreezeLedger.available && p2040FreezeLedger.text.includes("P2041") && p2040FreezeLedger.text.includes("Nous overlap audit"), "P2040 ledger must declare Nous overlap audit suspension"),
    validationItem("ledger.overlap_audit", "ledger", overlapAuditLedger.available && overlapAuditLedger.text.includes("P2041-P2120") && overlapAuditLedger.text.includes(COMMAND_NAME), "Nous overlap audit ledger must be present"),
    validationItem("nous.sources", "source_rows", sourceRows.length === 8 && sourceRows.every((row) => row.source_url.startsWith("https://hermes-agent.nousresearch.com/")), "all Nous source rows must cite official docs"),
    validationItem("surfaces.count", "surface_rows", surfaceRows.length === 12, "all P1201-P2040 plus P2041 surfaces must be classified"),
    validationItem("surfaces.classified", "surface_rows", ["keep_harness_native", "adapter_boundary", "deprecate_into_governance", "drop_suspended"].every((value) => classifications.has(value)), "surface rows must cover all classification types"),
    validationItem("surfaces.no_runtime_clone", "surface_rows", surfaceRows.every((row) => row.nous_runtime_reimplementation_allowed === false), "surface rows must prohibit Nous runtime reimplementation"),
    validationItem("next_phase.blocked", "blocked_rows", blockedNextPhaseRows.length === 4 && blockedNextPhaseRows.every((row) => row.current_verdict === "blocked" && row.execution_allowed_now === false), "future execution phases must be blocked"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceP2040Freeze, sourceRows, surfaceRows, blockedNextPhaseRows, policy, boundary, validation }) {
  return {
    schema_version: "nous-overlap-audit-summary.v1",
    nous_overlap_audit_status: validation.valid && boundary.unsafe_flag_count === 0 ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_p2040_freeze_status: sourceP2040Freeze.summary.platform_kernel_harness_native_cutover_freeze_status,
    source_count: sourceRows.length,
    surface_count: surfaceRows.length,
    keep_harness_native_count: surfaceRows.filter((row) => row.classification === "keep_harness_native").length,
    adapter_boundary_count: surfaceRows.filter((row) => row.classification === "adapter_boundary").length,
    deprecate_into_governance_count: surfaceRows.filter((row) => row.classification === "deprecate_into_governance").length,
    drop_suspended_count: surfaceRows.filter((row) => row.classification === "drop_suspended").length,
    blocked_next_phase_count: blockedNextPhaseRows.length,
    p2041_suspended_pending_nous_overlap_audit: policy.p2041_suspended_pending_nous_overlap_audit,
    p2041_limited_execution_allowed_now: policy.p2041_limited_execution_allowed_now,
    direct_nous_runtime_call_allowed_now: policy.direct_nous_runtime_call_allowed_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    nous_runtime_reimplementation_allowed: boundary.nous_runtime_reimplementation_allowed,
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

function blockedRow(fields) {
  return {
    ...fields,
    current_verdict: "blocked",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Nous Overlap Audit",
    "",
    `Status: ${result.summary.nous_overlap_audit_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source P2040 freeze status: ${result.summary.source_p2040_freeze_status}`,
    `Sources: ${result.summary.source_count}`,
    `Surfaces: ${result.summary.surface_count}`,
    `Classifications: keep ${result.summary.keep_harness_native_count}, adapter ${result.summary.adapter_boundary_count}, deprecate ${result.summary.deprecate_into_governance_count}, drop ${result.summary.drop_suspended_count}`,
    `Blocked next phases: ${result.summary.blocked_next_phase_count}`,
    `P2041 suspended pending Nous overlap audit: ${result.summary.p2041_suspended_pending_nous_overlap_audit}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Nous runtime reimplementation allowed now: ${result.summary.nous_runtime_reimplementation_allowed}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Write a Nous adapter-only spec before any further execution tranche.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_NOUS_OVERLAP_AUDIT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    p2040_freeze_ledger_path: options.p2040FreezeLedgerPath ?? defaults.p2040FreezeLedgerPath,
    overlap_audit_ledger_path: options.overlapAuditLedgerPath ?? defaults.overlapAuditLedgerPath,
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
    p2040FreezeLedgerPath: undefined,
    overlapAuditLedgerPath: undefined,
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
    } else if (arg === "--p2040-freeze-ledger") {
      args.p2040FreezeLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--overlap-audit-ledger") {
      args.overlapAuditLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/nous-overlap-audit.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --p2040-freeze-ledger <path>    P2040 freeze ledger path.
  --overlap-audit-ledger <path>   Nous overlap audit ledger path.
  --help                          Show this help.
`);
}
