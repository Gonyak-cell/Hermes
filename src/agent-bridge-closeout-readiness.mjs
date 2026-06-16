import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { AUTHORITY_FLAGS } from "./agent-bridge-manifest.mjs";

export const DEFAULT_AGENT_BRIDGE_CLOSEOUT_READINESS_OUT_DIR = "artifacts/agent-bridge-closeout-readiness/latest";
export const DEFAULT_AGENT_BRIDGE_CLOSEOUT_READINESS_INPUTS = {
  schemaPath: "schemas/agent-bridge-closeout-readiness.schema.json",
  packagePath: "package.json",
  runbookPath: "docs/hermes-agent-bridge-local-operator-runbook-2026-06-16.md",
  sourceAgentBridgeManifestPath: "artifacts/agent-bridge-manifest/latest/agent-bridge-manifest.json",
  sourceAgentBridgeRequestReceiptPath: "artifacts/agent-bridge-request-receipt/latest/agent-bridge-request-receipt.json",
  sourceAgentBridgeRequestPacketExportPath: "artifacts/agent-bridge-request-packet-export/latest/agent-bridge-request-packet-export.json",
  sourceAgentBridgeReceiptImportWorkspacePath: "artifacts/agent-bridge-receipt-import-workspace/latest/agent-bridge-receipt-import-workspace.json",
  sourceAgentBridgeReviewFindingWorkbenchPath: "artifacts/agent-bridge-review-finding-workbench/latest/agent-bridge-review-finding-workbench.json",
  sourceAgentBridgeExecutionCandidatePath: "artifacts/agent-bridge-execution-candidate/latest/agent-bridge-execution-candidate.json",
  sourceDesktopReadModelPath: "artifacts/desktop-read-model/latest/desktop-read-model.json",
};

const SCHEMA_VERSION = "agent-bridge-closeout-readiness.v1";
const CAPABILITY_ID = "platform.agent_bridge_closeout_readiness";
const COMMAND_NAME = "platform:agent-bridge-closeout-readiness";
const PROGRAM_RANGE = "AGENT-BRIDGE-L9-L10-SLICE-F";
const READY_STATUS = "ready_for_agent_bridge_local_operator_handoff";
const BLOCKED_STATUS = "blocked_agent_bridge_local_operator_handoff";

const REQUIRED_RUNBOOK_TERMS = [
  "Desktop cannot execute commands",
  "Desktop cannot apply receipts",
  "Desktop cannot create production PASS",
  "Desktop cannot create enterprise PASS",
  "Desktop cannot complete protected closeout",
  "not production launch approval",
];

export async function runAgentBridgeCloseoutReadiness(options = {}) {
  const result = await buildAgentBridgeCloseoutReadiness(options);
  if (options.write !== false) await writeAgentBridgeCloseoutReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Agent Bridge closeout readiness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAgentBridgeCloseoutReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AGENT_BRIDGE_CLOSEOUT_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const runbook = await readTextSource(inputs.runbook_path);
  const sourceManifest = options.sourceAgentBridgeManifest
    ? normalizeInlineJsonSource("inline.agent_bridge_manifest", options.sourceAgentBridgeManifest)
    : await readJsonSource(inputs.source_agent_bridge_manifest_path);
  const sourceRequestReceipt = options.sourceAgentBridgeRequestReceipt
    ? normalizeInlineJsonSource("inline.agent_bridge_request_receipt", options.sourceAgentBridgeRequestReceipt)
    : await readJsonSource(inputs.source_agent_bridge_request_receipt_path);
  const sourceRequestPacketExport = options.sourceAgentBridgeRequestPacketExport
    ? normalizeInlineJsonSource("inline.agent_bridge_request_packet_export", options.sourceAgentBridgeRequestPacketExport)
    : await readJsonSource(inputs.source_agent_bridge_request_packet_export_path);
  const sourceReceiptImportWorkspace = options.sourceAgentBridgeReceiptImportWorkspace
    ? normalizeInlineJsonSource("inline.agent_bridge_receipt_import_workspace", options.sourceAgentBridgeReceiptImportWorkspace)
    : await readJsonSource(inputs.source_agent_bridge_receipt_import_workspace_path);
  const sourceReviewFindingWorkbench = options.sourceAgentBridgeReviewFindingWorkbench
    ? normalizeInlineJsonSource("inline.agent_bridge_review_finding_workbench", options.sourceAgentBridgeReviewFindingWorkbench)
    : await readJsonSource(inputs.source_agent_bridge_review_finding_workbench_path);
  const sourceExecutionCandidate = options.sourceAgentBridgeExecutionCandidate
    ? normalizeInlineJsonSource("inline.agent_bridge_execution_candidate", options.sourceAgentBridgeExecutionCandidate)
    : await readJsonSource(inputs.source_agent_bridge_execution_candidate_path);
  const sourceDesktopReadModel = options.sourceDesktopReadModel
    ? normalizeInlineJsonSource("inline.desktop_read_model", options.sourceDesktopReadModel)
    : await readJsonSource(inputs.source_desktop_read_model_path);

  const context = {
    generatedAt,
    inputs,
    packageJson,
    runbook,
    sourceManifest,
    sourceRequestReceipt,
    sourceRequestPacketExport,
    sourceReceiptImportWorkspace,
    sourceReviewFindingWorkbench,
    sourceExecutionCandidate,
    sourceDesktopReadModel,
  };
  const contract = buildContract(context);
  const sourceRows = buildSourceRows(context);
  const runbookRows = buildRunbookRows(context);
  const handoffRows = buildHandoffRows(context);
  const gateRows = buildGateRows({ context, sourceRows, runbookRows, handoffRows });
  const boundary = buildBoundary({ context, sourceRows, runbookRows, handoffRows, gateRows });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_agent_bridge_manifest_summary: sourceManifest.data?.summary ?? null,
    source_agent_bridge_request_receipt_summary: sourceRequestReceipt.data?.summary ?? null,
    source_agent_bridge_request_packet_export_summary: sourceRequestPacketExport.data?.summary ?? null,
    source_agent_bridge_receipt_import_workspace_summary: sourceReceiptImportWorkspace.data?.summary ?? null,
    source_agent_bridge_review_finding_workbench_summary: sourceReviewFindingWorkbench.data?.summary ?? null,
    source_agent_bridge_execution_candidate_summary: sourceExecutionCandidate.data?.summary ?? null,
    source_desktop_read_model_summary: sourceDesktopReadModel.data?.summary ?? null,
    agent_bridge_closeout_contract: contract,
    agent_bridge_closeout_source_rows: sourceRows,
    agent_bridge_closeout_runbook_rows: runbookRows,
    agent_bridge_operator_handoff_rows: handoffRows,
    agent_bridge_closeout_gate_rows: gateRows,
    agent_bridge_closeout_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validation = validateAgentBridgeCloseoutReadinessResult(result, schema.available ? schema.data : null);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateAgentBridgeCloseoutReadinessResult(result, schema = null) {
  const items = buildValidationItems(result);
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "agent_bridge_closeout_readiness")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  const validationItems = [...items, ...schemaItems];
  return {
    validation_items: validationItems,
    validation: summarizeValidation(validationItems),
  };
}

export async function writeAgentBridgeCloseoutReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "agent-bridge-closeout-readiness.json"), serializable);
  await writeJson(path.join(outDir, "agent-bridge-closeout-source-rows.json"), collectionEnvelope("agent-bridge-closeout-source-rows.v1", "agent_bridge_closeout_source_rows", result.agent_bridge_closeout_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-bridge-closeout-runbook-rows.json"), collectionEnvelope("agent-bridge-closeout-runbook-rows.v1", "agent_bridge_closeout_runbook_rows", result.agent_bridge_closeout_runbook_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-bridge-operator-handoff-rows.json"), collectionEnvelope("agent-bridge-operator-handoff-rows.v1", "agent_bridge_operator_handoff_rows", result.agent_bridge_operator_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-bridge-closeout-gate-rows.json"), collectionEnvelope("agent-bridge-closeout-gate-rows.v1", "agent_bridge_closeout_gate_rows", result.agent_bridge_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-bridge-closeout-boundary.json"), result.agent_bridge_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "agent-bridge-closeout-readiness-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAgentBridgeCloseoutReadinessCli(argv = process.argv.slice(2)) {
  try {
    const args = parseAgentBridgeCloseoutReadinessArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runAgentBridgeCloseoutReadiness(args);
    console.log(`Agent Bridge closeout readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.agent_bridge_closeout_readiness_status}`);
    console.log(`Sources: ${result.summary.source_ready_count}/${result.summary.source_count}`);
    console.log(`Runbook rows: ${result.summary.runbook_pass_count}/${result.summary.runbook_count}`);
    console.log(`Local operator handoff ready: ${result.summary.local_operator_handoff_ready}`);
    console.log(`Protected closeout enabled: ${result.summary.protected_closeout_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(context) {
  return {
    schema_version: "agent-bridge-closeout-contract.v1",
    generated_at: context.generatedAt,
    contract_id: "contract.hermes.agent_bridge_closeout_readiness.local_operator_handoff",
    local_only: true,
    read_only: true,
    source_of_truth: false,
    local_operator_handoff_ready: true,
    request_queue_enabled_now: true,
    receipt_intake_enabled_now: true,
    request_packet_export_enabled_now: true,
    receipt_import_workspace_enabled_now: true,
    review_finding_workbench_enabled_now: true,
    controlled_execution_candidate_enabled_now: true,
    desktop_projection_enabled_now: true,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    deployment_authorization: false,
    production_launch_approval: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    github_independent_approval: false,
    provider_output_authoritative: false,
    ...falseAuthorityFlags(),
  };
}

function buildSourceRows(context) {
  const rows = [
    ["agent_bridge_manifest", context.inputs.source_agent_bridge_manifest_path, context.sourceManifest, "agent_bridge_manifest_status", "ready_for_agent_bridge_manifest"],
    ["agent_bridge_request_receipt", context.inputs.source_agent_bridge_request_receipt_path, context.sourceRequestReceipt, "agent_bridge_request_receipt_status", "ready_for_agent_bridge_request_receipt"],
    ["agent_bridge_request_packet_export", context.inputs.source_agent_bridge_request_packet_export_path, context.sourceRequestPacketExport, "agent_bridge_request_packet_export_status", "ready_for_agent_bridge_request_packet_export"],
    ["agent_bridge_receipt_import_workspace", context.inputs.source_agent_bridge_receipt_import_workspace_path, context.sourceReceiptImportWorkspace, "agent_bridge_receipt_import_workspace_status", "ready_for_agent_bridge_receipt_import_workspace"],
    ["agent_bridge_review_finding_workbench", context.inputs.source_agent_bridge_review_finding_workbench_path, context.sourceReviewFindingWorkbench, "agent_bridge_review_finding_workbench_status", "ready_for_agent_bridge_review_finding_workbench"],
    ["agent_bridge_execution_candidate", context.inputs.source_agent_bridge_execution_candidate_path, context.sourceExecutionCandidate, "agent_bridge_execution_candidate_status", "ready_for_agent_bridge_execution_candidate"],
    ["desktop_read_model", context.inputs.source_desktop_read_model_path, context.sourceDesktopReadModel, "desktop_read_model_status", "ready_for_desktop_shell"],
  ];
  return rows.map(([sourceId, sourcePath, source, summaryField, readyStatus], index) => {
    const observedStatus = source.data?.summary?.[summaryField] ?? "missing";
    const ready = source.available === true && source.parse_status === "parsed" && observedStatus === readyStatus;
    return verdictRow({
      schema_version: "agent-bridge-closeout-source-row.v1",
      row_id: `agent.bridge.closeout.source.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      source_id: sourceId,
      source_path: sourcePath,
      source_available: source.available === true,
      source_parse_status: source.parse_status ?? "missing",
      source_hash: source.content_hash ?? null,
      observed_status: observedStatus,
      ready_status: readyStatus,
      source_ready: ready,
      source_error: source.error ?? null,
      authority_effect: "closeout_readiness_evidence_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
    }, ready);
  });
}

function buildRunbookRows(context) {
  return REQUIRED_RUNBOOK_TERMS.map((term, index) => {
    const passed = context.runbook.available === true && context.runbook.text.includes(term);
    return verdictRow({
      schema_version: "agent-bridge-closeout-runbook-row.v1",
      row_id: `agent.bridge.closeout.runbook.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      term,
      term_present: passed,
      runbook_path: context.inputs.runbook_path,
      authority_effect: "operator_instruction_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
    }, passed);
  });
}

function buildHandoffRows(context) {
  const manifest = context.sourceManifest.data?.summary ?? {};
  const requestReceipt = context.sourceRequestReceipt.data?.summary ?? {};
  const packetExport = context.sourceRequestPacketExport.data?.summary ?? {};
  const receiptImport = context.sourceReceiptImportWorkspace.data?.summary ?? {};
  const reviewFinding = context.sourceReviewFindingWorkbench.data?.summary ?? {};
  const execution = context.sourceExecutionCandidate.data?.summary ?? {};
  const desktop = context.sourceDesktopReadModel.data?.summary ?? {};
  const desktopAgentProjection = context.sourceDesktopReadModel.data?.agent_projection ?? {};
  const specs = [
    ["identity_inventory_visible", "Agent runtime/capability identity is visible", manifest.runtime_count >= 4 && manifest.capability_count >= 25],
    ["request_receipt_visible", "Request and receipt chain is visible", requestReceipt.request_count >= 4 && requestReceipt.receipt_count >= 4],
    ["request_packet_export_visible", "Request packet export chain is visible and transport remains closed", packetExport.packet_count >= 4 && packetExport.request_transport_submission_allowed_now === false],
    ["receipt_import_workspace_visible", "Receipt import workspace is visible and raw receipt storage remains closed", receiptImport.import_candidate_count >= 4 && receiptImport.raw_receipt_storage_allowed === false && receiptImport.receipt_application_allowed_now === false],
    ["review_findings_visible", "Review finding workbench is visible and cannot resolve findings", reviewFinding.finding_seed_count >= 4 && reviewFinding.blocking_finding_count >= 1 && reviewFinding.finding_resolution_allowed_now === false],
    ["execution_candidates_visible", "Execution candidates and gates are visible", execution.execution_candidate_count >= 5 && execution.gate_pass_count === execution.gate_count],
    ["desktop_agents_projection_visible", "Desktop Agents projection includes packet, import, finding, and execution rows", desktop.desktop_read_model_status === "ready_for_desktop_shell" && desktopAgentProjection.request_packet_export_count >= 4 && desktopAgentProjection.receipt_import_candidate_count >= 4 && desktopAgentProjection.review_finding_count >= 4 && desktopAgentProjection.execution_candidate_count >= 5],
    ["authority_boundary_closed", "No closeout source opens authority", summariesClosed([manifest, requestReceipt, packetExport, receiptImport, reviewFinding, execution, desktop, desktopAgentProjection])],
  ];
  return specs.map(([handoffId, description, passed], index) => verdictRow({
    schema_version: "agent-bridge-operator-handoff-row.v1",
    row_id: `agent.bridge.operator.handoff.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    handoff_id: handoffId,
    description,
    handoff_status: passed ? "ready" : "blocked",
    next_allowed_action: "inspect Hermes Desktop Agents view locally; do not execute from Desktop",
    authority_effect: "local_operator_handoff_only",
    opens_authority: false,
    ...falseAuthorityFlags(),
  }, passed));
}

function buildGateRows({ context, sourceRows, runbookRows, handoffRows }) {
  const contract = buildContract(context);
  const specs = [
    ["package.script.registered", `${COMMAND_NAME} is registered`, Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME])],
    ["sources.ready", "All Agent Bridge closeout sources are ready", sourceRows.every((row) => row.source_ready === true)],
    ["runbook.ready", "Runbook declares required authority boundaries", runbookRows.every((row) => row.current_verdict === "pass")],
    ["handoff.ready", "Local operator handoff rows are ready", handoffRows.every((row) => row.current_verdict === "pass")],
    ["authority.closed", "Closeout readiness does not open authority", allAuthorityFlagsFalse(contract) && contract.protected_closeout_enabled === false && contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false],
  ];
  return specs.map(([gateId, description, passed], index) => verdictRow({
    schema_version: "agent-bridge-closeout-gate-row.v1",
    row_id: `agent.bridge.closeout.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id: gateId,
    gate_status: passed ? "pass" : "blocked",
    description,
    blocks_local_operator_handoff_when_failed: true,
    execution_allowed_now: false,
    command_executed_now: false,
    mutation_performed: false,
    authority_effect: "closeout_gate_only",
    opens_authority: false,
    ...falseAuthorityFlags(),
  }, passed));
}

function buildBoundary({ context, sourceRows, runbookRows, handoffRows, gateRows }) {
  const contract = buildContract(context);
  const ready = sourceRows.every((row) => row.current_verdict === "pass")
    && runbookRows.every((row) => row.current_verdict === "pass")
    && handoffRows.every((row) => row.current_verdict === "pass")
    && gateRows.every((row) => row.current_verdict === "pass");
  const boundary = {
    schema_version: "agent-bridge-closeout-boundary.v1",
    generated_at: context.generatedAt,
    ready_for_agent_bridge_local_operator_handoff: ready,
    ...contract,
  };
  return {
    ...boundary,
    unsafe_flag_count: countUnsafeFlags(boundary),
    source_ready_count: sourceRows.filter((row) => row.source_ready === true).length,
    source_count: sourceRows.length,
    runbook_pass_count: runbookRows.filter((row) => row.current_verdict === "pass").length,
    runbook_count: runbookRows.length,
    handoff_pass_count: handoffRows.filter((row) => row.current_verdict === "pass").length,
    handoff_count: handoffRows.length,
    gate_pass_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    gate_count: gateRows.length,
  };
}

function buildValidationItems(result) {
  return [
    validationItem("package.script.registered", result.agent_bridge_closeout_gate_rows.some((row) => row.gate_id === "package.script.registered" && row.current_verdict === "pass"), `package.json must register ${COMMAND_NAME}`, "package.json"),
    validationItem("sources.ready", result.agent_bridge_closeout_source_rows.every((row) => row.source_ready === true), "Closeout source is not ready.", "agent_bridge_closeout_source_rows"),
    validationItem("runbook.ready", result.agent_bridge_closeout_runbook_rows.every((row) => row.current_verdict === "pass"), "Runbook is missing required boundary text.", result.inputs?.runbook_path),
    validationItem("handoff.ready", result.agent_bridge_operator_handoff_rows.every((row) => row.current_verdict === "pass"), "Operator handoff row is blocked.", "agent_bridge_operator_handoff_rows"),
    validationItem("authority.closed", result.agent_bridge_closeout_contract.execution_allowed_now === false && result.agent_bridge_closeout_contract.production_pass_enabled === false && result.agent_bridge_closeout_contract.enterprise_pass_enabled === false && result.agent_bridge_closeout_contract.protected_closeout_enabled === false && allAuthorityFlagsFalse(result.agent_bridge_closeout_contract), "Closeout readiness opened forbidden authority.", "agent_bridge_closeout_contract"),
    validationItem("boundary.ready", result.agent_bridge_closeout_boundary.ready_for_agent_bridge_local_operator_handoff === true && result.agent_bridge_closeout_boundary.unsafe_flag_count === 0, "Closeout boundary is not ready.", "agent_bridge_closeout_boundary"),
    validationItem("gates.pass", result.agent_bridge_closeout_gate_rows.every((row) => row.current_verdict === "pass"), "Closeout gate row is blocked.", "agent_bridge_closeout_gate_rows"),
  ];
}

function buildSummary(result) {
  const validation = result.validation ?? summarizeValidation([]);
  return {
    schema_version: "agent-bridge-closeout-readiness-summary.v1",
    agent_bridge_closeout_readiness_status: validation.valid && result.agent_bridge_closeout_boundary?.ready_for_agent_bridge_local_operator_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_ready_count: result.agent_bridge_closeout_boundary?.source_ready_count ?? 0,
    source_count: result.agent_bridge_closeout_boundary?.source_count ?? 0,
    runbook_pass_count: result.agent_bridge_closeout_boundary?.runbook_pass_count ?? 0,
    runbook_count: result.agent_bridge_closeout_boundary?.runbook_count ?? 0,
    handoff_pass_count: result.agent_bridge_closeout_boundary?.handoff_pass_count ?? 0,
    handoff_count: result.agent_bridge_closeout_boundary?.handoff_count ?? 0,
    gate_pass_count: result.agent_bridge_closeout_boundary?.gate_pass_count ?? 0,
    gate_count: result.agent_bridge_closeout_boundary?.gate_count ?? 0,
    local_operator_handoff_ready: result.agent_bridge_closeout_boundary?.ready_for_agent_bridge_local_operator_handoff === true,
    request_queue_enabled_now: true,
    receipt_intake_enabled_now: true,
    request_packet_export_enabled_now: true,
    receipt_import_workspace_enabled_now: true,
    review_finding_workbench_enabled_now: true,
    controlled_execution_candidate_enabled_now: true,
    desktop_projection_enabled_now: true,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    deployment_authorization: false,
    production_launch_approval: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    github_independent_approval: false,
    provider_output_authoritative: false,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    ...falseAuthorityFlags(),
    unsafe_flag_count: result.agent_bridge_closeout_boundary?.unsafe_flag_count ?? 0,
    validation_error_count: validation.errors.length,
  };
}

function summariesClosed(summaries) {
  return summaries.every((summary) => (
    summary.production_pass_enabled !== true
    && summary.enterprise_pass_enabled !== true
    && summary.protected_closeout_enabled !== true
    && summary.request_transport_submission_allowed_now !== true
    && summary.execution_allowed_now !== true
    && summary.command_executed_now !== true
    && summary.command_output_captured_now !== true
    && summary.mutation_performed !== true
    && summary.receipt_application_allowed_now !== true
    && summary.approval_application_allowed_now !== true
    && summary.finding_resolution_allowed_now !== true
    && summary.clean_checkpoint_allowed_now !== true
    && summary.patch_apply_allowed_now !== true
    && summary.provider_output_authoritative !== true
  ));
}

export function parseAgentBridgeCloseoutReadinessArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--out-dir") {
      args.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      args.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--package-path") {
      args.packagePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--runbook-path") {
      args.runbookPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-manifest-path") {
      args.sourceAgentBridgeManifestPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-request-receipt-path") {
      args.sourceAgentBridgeRequestReceiptPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-request-packet-export-path") {
      args.sourceAgentBridgeRequestPacketExportPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-receipt-import-workspace-path") {
      args.sourceAgentBridgeReceiptImportWorkspacePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-review-finding-workbench-path") {
      args.sourceAgentBridgeReviewFindingWorkbenchPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-execution-candidate-path") {
      args.sourceAgentBridgeExecutionCandidatePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-desktop-read-model-path") {
      args.sourceDesktopReadModelPath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readArgValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--runbook-path PATH] [--source-agent-bridge-request-packet-export-path PATH] [--source-agent-bridge-receipt-import-workspace-path PATH] [--source-agent-bridge-review-finding-workbench-path PATH] [--source-agent-bridge-execution-candidate-path PATH]`);
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      const data = JSON.parse(text);
      return { available: true, path: filePath, resolved_path: resolvedPath, text, data, parse_status: "parsed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
    } catch (error) {
      return { available: false, path: filePath, resolved_path: resolvedPath, text, data: null, parse_status: "malformed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: error.message };
    }
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, parse_status: "missing", content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { available: true, path: filePath, resolved_path: resolvedPath, text, parse_status: "parsed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", parse_status: "missing", content_hash: null, error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data), parse_status: "parsed", content_hash: `sha256:${sha256(data)}`, error: null };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_AGENT_BRIDGE_CLOSEOUT_READINESS_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    runbook_path: options.runbookPath ?? defaults.runbookPath,
    source_agent_bridge_manifest_path: options.sourceAgentBridgeManifestPath ?? defaults.sourceAgentBridgeManifestPath,
    source_agent_bridge_request_receipt_path: options.sourceAgentBridgeRequestReceiptPath ?? defaults.sourceAgentBridgeRequestReceiptPath,
    source_agent_bridge_request_packet_export_path: options.sourceAgentBridgeRequestPacketExportPath ?? defaults.sourceAgentBridgeRequestPacketExportPath,
    source_agent_bridge_receipt_import_workspace_path: options.sourceAgentBridgeReceiptImportWorkspacePath ?? defaults.sourceAgentBridgeReceiptImportWorkspacePath,
    source_agent_bridge_review_finding_workbench_path: options.sourceAgentBridgeReviewFindingWorkbenchPath ?? defaults.sourceAgentBridgeReviewFindingWorkbenchPath,
    source_agent_bridge_execution_candidate_path: options.sourceAgentBridgeExecutionCandidatePath ?? defaults.sourceAgentBridgeExecutionCandidatePath,
    source_desktop_read_model_path: options.sourceDesktopReadModelPath ?? defaults.sourceDesktopReadModelPath,
  };
}

function falseAuthorityFlags() {
  return Object.fromEntries(AUTHORITY_FLAGS.map((flag) => [flag, false]));
}

function allAuthorityFlagsFalse(value) {
  return AUTHORITY_FLAGS.every((flag) => value?.[flag] === false);
}

function countUnsafeFlags(value) {
  return AUTHORITY_FLAGS.reduce((sum, flag) => sum + (value?.[flag] === true ? 1 : 0), 0);
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return {
    schema_version: "agent-bridge-closeout-readiness-validation-item.v1",
    path: pathValue,
    check_id: pathValue,
    status: passed ? "passed" : "failed",
    message: passed ? "ok" : message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${key}_count`]: rows.length, [key]: rows };
}

function renderMarkdown(result) {
  return [
    "# Agent Bridge Closeout Readiness",
    "",
    `- Status: ${result.summary.agent_bridge_closeout_readiness_status}`,
    `- Program: ${result.program_range}`,
    `- Sources: ${result.summary.source_ready_count}/${result.summary.source_count}`,
    `- Runbook rows: ${result.summary.runbook_pass_count}/${result.summary.runbook_count}`,
    `- Handoff rows: ${result.summary.handoff_pass_count}/${result.summary.handoff_count}`,
    `- Gates: ${result.summary.gate_pass_count}/${result.summary.gate_count}`,
    `- Local operator handoff ready: ${result.summary.local_operator_handoff_ready}`,
    `- Execution allowed now: ${result.summary.execution_allowed_now}`,
    `- Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `- Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `- Protected closeout enabled: ${result.summary.protected_closeout_enabled}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This is local operator handoff readiness only. It is not production launch approval, deployment authorization, GitHub independent approval, enterprise approval, or protected closeout.",
    "",
  ].join("\n");
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
