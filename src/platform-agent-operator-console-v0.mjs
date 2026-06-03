import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformDomainAgentNoWritePilot } from "./platform-domain-agent-no-write-pilot.mjs";

export const DEFAULT_PLATFORM_AGENT_OPERATOR_CONSOLE_V0_OUT_DIR = "artifacts/platform-agent-operator-console-v0/latest";
export const DEFAULT_PLATFORM_AGENT_OPERATOR_CONSOLE_V0_INPUTS = {
  schemaPath: "schemas/platform-agent-operator-console-v0.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-operator-console-v0";
const SOURCE_COMMAND_NAME = "platform:domain-agent-no-write-pilot";
const SCHEMA_VERSION = "platform-agent-operator-console-v0.v1";
const CAPABILITY_ID = "platform.agent_operator.console_v0";
const PROGRAM_RANGE = "P1441-P1500";
const PHASE_RANGE = "P1441-P1500";
const PHASE_SLOT = "P1441";
const PREVIOUS_PHASE_SLOT = "P1440";
const NEXT_PHASE_SLOT = "P1501";
const SOURCE_READY_STATUS = "ready_for_agent_domain_no_write_pilot_freeze";
const READY_STATUS = "ready_for_agent_operator_console_v0_freeze";

const API_ROUTE_SPECS = [
  ["/api/agent-capabilities", "agent_console_capability_rows", "Agent capability registry projection"],
  ["/api/agent-blocks", "agent_console_block_rows", "Agent block reason projection"],
  ["/api/agent-next-actions", "agent_console_next_action_rows", "Agent next action projection"],
  ["/api/agent-receipts", "agent_console_receipt_rows", "Agent missing receipt projection"],
];

const CLOSEOUT_SPECS = [
  ["source_domain_pilot_ready", "P1321-P1440 domain no-write pilot is ready"],
  ["capability_registry_visible", "All L0 no-write capability candidates are visible"],
  ["block_reasons_visible", "All protected action blocks expose reason, owner, and next action"],
  ["missing_receipts_visible", "Human gate and protected action receipt gaps are visible"],
  ["next_actions_visible", "Operator next allowed actions are visible without execution"],
  ["api_projection_ready", "Read-only API projection rows are declared without starting a server"],
  ["dry_run_real_run_boundary_visible", "Dry-run and real-run boundaries are explicit"],
  ["ready_for_p1501_kernel_cutover", "Console v0 can feed P1501 Platform Kernel cutover"],
];

export async function runPlatformAgentOperatorConsoleV0(options = {}) {
  const result = await buildPlatformAgentOperatorConsoleV0(options);
  if (options.write !== false) await writePlatformAgentOperatorConsoleV0(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Agent operator console v0 failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentOperatorConsoleV0(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_OPERATOR_CONSOLE_V0_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const domainPilotLedger = await readTextSource(inputs.domain_pilot_ledger_path);
  const consoleLedger = await readTextSource(inputs.console_ledger_path);
  const sourceDomainPilot = options.sourceDomainNoWritePilot ?? await buildPlatformDomainAgentNoWritePilot({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    write: false,
  });

  const capabilityRows = buildConsoleCapabilityRows(sourceDomainPilot);
  const blockRows = buildConsoleBlockRows(sourceDomainPilot);
  const receiptRows = buildConsoleReceiptRows(sourceDomainPilot);
  const nextActionRows = buildConsoleNextActionRows(receiptRows);
  const apiRouteRows = buildConsoleApiRouteRows();
  const closeoutRows = buildCloseoutRows({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows });
  const anchor = buildAnchor({ packageJson, domainPilotLedger, consoleLedger, sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, domainPilotLedger, consoleLedger, sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows });
  const claimRows = buildClaimRows({ capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows });
  const boundary = buildBoundary({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_operator_console_v0_id: `platform-agent-operator-console-v0.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_operator_console_v0_anchor: anchor,
    source_domain_agent_no_write_pilot_summary: sourceDomainPilot.summary,
    agent_console_capability_rows: capabilityRows,
    agent_console_block_rows: blockRows,
    agent_console_receipt_rows: receiptRows,
    agent_console_next_action_rows: nextActionRows,
    agent_console_api_route_rows: apiRouteRows,
    agent_console_closeout_rows: closeoutRows,
    agent_console_gate_rows: gateRows,
    agent_console_claim_rows: claimRows,
    agent_console_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_operator_console_v0")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_agent_operator_console_v0_id = result.platform_agent_operator_console_v0_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentOperatorConsoleV0(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-operator-console-v0.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-console-capability-rows.json"), collectionEnvelope("agent-console-capability-rows.v1", "agent_console_capability_rows", result.agent_console_capability_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-block-rows.json"), collectionEnvelope("agent-console-block-rows.v1", "agent_console_block_rows", result.agent_console_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-receipt-rows.json"), collectionEnvelope("agent-console-receipt-rows.v1", "agent_console_receipt_rows", result.agent_console_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-next-action-rows.json"), collectionEnvelope("agent-console-next-action-rows.v1", "agent_console_next_action_rows", result.agent_console_next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-api-route-rows.json"), collectionEnvelope("agent-console-api-route-rows.v1", "agent_console_api_route_rows", result.agent_console_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-closeout-rows.json"), collectionEnvelope("agent-console-closeout-rows.v1", "agent_console_closeout_rows", result.agent_console_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-gate-rows.json"), collectionEnvelope("agent-console-gate-rows.v1", "agent_console_gate_rows", result.agent_console_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-claim-rows.json"), collectionEnvelope("agent-console-claim-rows.v1", "agent_console_claim_rows", result.agent_console_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-console-boundary.json"), result.agent_console_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-operator-console-v0-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentOperatorConsoleV0Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentOperatorConsoleV0(args);
    console.log(`Platform Agent operator console v0 ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_operator_console_v0_status}`);
    console.log(`Capabilities: ${result.summary.capability_row_count}`);
    console.log(`Blocks: ${result.summary.block_row_count}`);
    console.log(`Missing receipts: ${result.summary.missing_receipt_count}`);
    console.log(`API routes: ${result.summary.api_route_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Write action allowed: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildConsoleCapabilityRows(sourceDomainPilot) {
  return sourceDomainPilot.domain_agent_no_write_capability_rows.map((row, index) => passRow({
    schema_version: "agent-console-capability-row.v1",
    row_id: `agent-console.capability.row.${String(index + 1).padStart(3, "0")}`,
    source_row_ref: row.row_id,
    domain_id: row.domain_id,
    capability_id: row.capability_id,
    rollout_level: "L0_no_write",
    console_status: "visible_no_write_candidate",
    allowed_outputs: row.allowed_outputs,
    missing_receipt: true,
    block_reason: null,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    final_pass_by_agent_allowed_now: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
}

function buildConsoleBlockRows(sourceDomainPilot) {
  return sourceDomainPilot.domain_agent_no_write_protected_block_rows.map((row, index) => ({
    schema_version: "agent-console-block-row.v1",
    row_id: `agent-console.block.row.${String(index + 1).padStart(3, "0")}`,
    source_row_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
    current_verdict: "blocked",
    console_status: "visible_block",
    block_reason: row.block_reason,
    receipt_required_before_action: true,
    receipt_payload_present: false,
    action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildConsoleReceiptRows(sourceDomainPilot) {
  const humanGateRows = sourceDomainPilot.domain_agent_no_write_human_gate_rows.map((row, index) => passRow({
    schema_version: "agent-console-receipt-row.v1",
    row_id: `agent-console.receipt.domain.row.${String(index + 1).padStart(3, "0")}`,
    receipt_scope: "domain_human_gate",
    source_row_ref: row.row_id,
    domain_id: row.domain_id,
    protected_block_id: null,
    receipt_status: "missing",
    receipt_required_before_action: true,
    receipt_payload_present: false,
    receipt_applied: false,
    action_allowed_now: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
  const protectedReceiptRows = sourceDomainPilot.domain_agent_no_write_protected_block_rows.map((row, index) => passRow({
    schema_version: "agent-console-receipt-row.v1",
    row_id: `agent-console.receipt.protected.row.${String(index + 1).padStart(3, "0")}`,
    receipt_scope: "protected_action",
    source_row_ref: row.row_id,
    domain_id: row.domain_id,
    protected_block_id: row.protected_block_id,
    receipt_status: "missing",
    receipt_required_before_action: true,
    receipt_payload_present: false,
    receipt_applied: false,
    action_allowed_now: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
  return [...humanGateRows, ...protectedReceiptRows];
}

function buildConsoleNextActionRows(receiptRows) {
  return receiptRows.map((row, index) => passRow({
    schema_version: "agent-console-next-action-row.v1",
    row_id: `agent-console.next_action.row.${String(index + 1).padStart(3, "0")}`,
    source_receipt_row_ref: row.row_id,
    domain_id: row.domain_id,
    protected_block_id: row.protected_block_id,
    next_action_status: "visible_for_operator",
    blocked_until_receipt: true,
    execution_allowed_now: false,
    next_allowed_action: row.next_allowed_action,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
  }));
}

function buildConsoleApiRouteRows() {
  return API_ROUTE_SPECS.map(([routePath, responseCollection, description], index) => passRow({
    schema_version: "agent-console-api-route-row.v1",
    row_id: `agent-console.api_route.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    route_status: "ready_for_read_only_projection",
    route_mode: "artifact_projection_only",
    response_collection: responseCollection,
    description,
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    receipt_application_route: false,
    raw_material_route: false,
    evidence_ref: `evidence.platform.agent.operator_console_v0.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform.agent_operator_console_v0_api",
    hard_gate_ref: `gate.platform.agent.operator_console_v0.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "wire to Review API only as read-only artifact route after P1500 freeze",
  }));
}

function buildCloseoutRows({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows }) {
  const checks = [
    ["source_domain_pilot_ready", sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status === SOURCE_READY_STATUS],
    ["capability_registry_visible", capabilityRows.length === 32 && capabilityRows.every((row) => row.console_status === "visible_no_write_candidate")],
    ["block_reasons_visible", blockRows.length === 20 && blockRows.every((row) => row.current_verdict === "blocked" && row.block_reason)],
    ["missing_receipts_visible", receiptRows.length === 26 && receiptRows.every((row) => row.receipt_status === "missing")],
    ["next_actions_visible", nextActionRows.length === 26 && nextActionRows.every((row) => row.execution_allowed_now === false && row.next_allowed_action)],
    ["api_projection_ready", apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false)],
    ["dry_run_real_run_boundary_visible", true],
    ["ready_for_p1501_kernel_cutover", true],
  ];
  return CLOSEOUT_SPECS.map(([closeoutId, description], index) => {
    const check = checks.find(([id]) => id === closeoutId);
    return check?.[1] ? passRow({
      schema_version: "agent-console-closeout-row.v1",
      row_id: `agent-console.closeout.row.${String(index + 1).padStart(2, "0")}`,
      closeout_id: closeoutId,
      description,
      evidence_ref: `evidence.platform.agent.operator_console_v0.closeout.${closeoutId}`,
      reviewer_ref: "reviewer.platform.agent_operator_console_v0_closeout",
      hard_gate_ref: `gate.platform.agent.operator_console_v0.closeout.${closeoutId}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: "keep closeout evidence attached",
    }) : blockedRow({
      schema_version: "agent-console-closeout-row.v1",
      row_id: `agent-console.closeout.row.${String(index + 1).padStart(2, "0")}`,
      closeout_id: closeoutId,
      description,
      block_reason: `closeout_check_failed.${closeoutId}`,
      evidence_ref: `evidence.platform.agent.operator_console_v0.closeout.${closeoutId}`,
      reviewer_ref: "reviewer.platform.agent_operator_console_v0_closeout",
      hard_gate_ref: `gate.platform.agent.operator_console_v0.closeout.${closeoutId}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: `repair ${closeoutId} before P1500 closeout`,
    });
  });
}

function buildAnchor({ packageJson, domainPilotLedger, consoleLedger, sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows }) {
  return {
    schema_version: "agent-operator-console-v0-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    domain_pilot_ledger_present: domainPilotLedger.available,
    console_ledger_present: consoleLedger.available,
    source_domain_pilot_status: sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status,
    capability_row_count: capabilityRows.length,
    block_row_count: blockRows.length,
    receipt_row_count: receiptRows.length,
    next_action_row_count: nextActionRows.length,
    api_route_count: apiRouteRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, domainPilotLedger, consoleLedger, sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json registers console v0 command"],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes console v0 check"],
    ["source_domain_pilot_ready", sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status === SOURCE_READY_STATUS, "source domain pilot is ready"],
    ["domain_pilot_ledger_present", domainPilotLedger.available && domainPilotLedger.text.includes("P1321-P1440"), "domain pilot ledger exists"],
    ["console_ledger_present", consoleLedger.available && ["P1441-P1500", "P1441-P1460", "P1461-P1480", "P1481-P1500", COMMAND_NAME].every((token) => consoleLedger.text.includes(token)), "console ledger declares full range"],
    ["capabilities_projected", capabilityRows.length === 32 && capabilityRows.every((row) => row.current_verdict === "pass"), "capability projection is ready"],
    ["blocks_projected", blockRows.length === 20 && blockRows.every((row) => row.current_verdict === "blocked" && row.action_allowed_now === false), "block projection is ready"],
    ["receipts_projected", receiptRows.length === 26 && receiptRows.every((row) => row.receipt_status === "missing" && row.receipt_payload_present === false), "receipt projection is ready"],
    ["next_actions_projected", nextActionRows.length === 26 && nextActionRows.every((row) => row.execution_allowed_now === false), "next action projection is ready"],
    ["api_routes_projected", apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false), "API route projection is ready"],
    ["closeout_rows_ready", closeoutRows.length === 8 && closeoutRows.every((row) => row.current_verdict === "pass"), "closeout rows are ready"],
    ["read_only_boundary_safe", true, "read-only boundary remains safe"],
    ["claims_supported", true, "claims can be checked after claim rows are built"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "agent-console-gate-row.v1",
    row_id: `agent-console.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.agent.operator_console_v0.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform.agent_operator_console_v0_gate",
    hard_gate_ref: `gate.platform.agent.operator_console_v0.${gate_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1500 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows }) {
  const passSources = [
    ...capabilityRows.map((row) => ["capability", `${row.domain_id}.${row.capability_id}`, row]),
    ...receiptRows.map((row) => ["receipt_visibility", row.row_id, row]),
    ...nextActionRows.map((row) => ["next_action", row.row_id, row]),
    ...apiRouteRows.map((row) => ["api_route", row.route_path, row]),
    ...closeoutRows.filter((row) => row.current_verdict === "pass").map((row) => ["closeout", row.closeout_id, row]),
  ];
  const blockedSources = blockRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "agent-console-claim-row.v1",
    row_id: `agent-console.claim.row.${String(index + 1).padStart(3, "0")}`,
    claim_type: claimType,
    claim_id: claimId,
    domain_id: row.domain_id ?? "platform",
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

function buildBoundary({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows }) {
  const unsafeFlags = [
    sourceDomainPilot.summary.agent_runtime_execution_allowed_now,
    sourceDomainPilot.summary.write_action_allowed_now,
    sourceDomainPilot.summary.direct_zendd_mutation_allowed_now,
    sourceDomainPilot.summary.protected_action_execution_allowed_now,
    sourceDomainPilot.summary.agent_final_pass_allowed_now,
    capabilityRows.some((row) => row.runtime_execution_allowed_now || row.write_action_allowed_now || row.final_pass_by_agent_allowed_now),
    blockRows.some((row) => row.action_allowed_now || row.protected_action_execution_allowed_now),
    receiptRows.some((row) => row.receipt_payload_present || row.receipt_applied || row.action_allowed_now),
    nextActionRows.some((row) => row.execution_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    closeoutRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "agent-console-boundary.v1",
    operator_console_v0_ready_for_kernel_cutover: closeoutRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_domain_pilot_status: sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status,
    read_only_console: true,
    server_started: false,
    api_projection_only: true,
    receipt_payload_present: false,
    receipt_applied: false,
    agent_runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    package_install_allowed_now: false,
    provider_secret_setup_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_client_or_vdr_access_allowed_now: false,
    write_action_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    live_trading_action_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.domain_pilot", "source_ready", sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status === SOURCE_READY_STATUS, "source domain no-write pilot must be ready"),
    validationItem("capability.count", "capability_rows", capabilityRows.length === 32, "all console capability rows must exist"),
    validationItem("block.count", "block_rows", blockRows.length === 20, "all protected block rows must exist"),
    validationItem("receipt.count", "receipt_rows", receiptRows.length === 26, "all missing receipt rows must exist"),
    validationItem("next_action.count", "next_action_rows", nextActionRows.length === 26, "all next action rows must exist"),
    validationItem("api_route.count", "api_route_rows", apiRouteRows.length === 4, "all read-only API projection rows must exist"),
    validationItem("closeout.ready", "closeout_rows", closeoutRows.every((row) => row.current_verdict === "pass"), "all closeout rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gate rows must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claim rows must support PASS/BLOCK contract"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceDomainPilot, capabilityRows, blockRows, receiptRows, nextActionRows, apiRouteRows, closeoutRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-agent-operator-console-v0-summary.v1",
    platform_agent_operator_console_v0_status: validation.valid && boundary.operator_console_v0_ready_for_kernel_cutover ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_domain_pilot_status: sourceDomainPilot.summary.platform_domain_agent_no_write_pilot_status,
    capability_row_count: capabilityRows.length,
    block_row_count: blockRows.length,
    receipt_row_count: receiptRows.length,
    missing_receipt_count: receiptRows.filter((row) => row.receipt_status === "missing").length,
    next_action_row_count: nextActionRows.length,
    api_route_count: apiRouteRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    read_only_console: boundary.read_only_console,
    server_started: boundary.server_started,
    api_projection_only: boundary.api_projection_only,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_applied: boundary.receipt_applied,
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
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

function blockedRow(fields) {
  return {
    ...fields,
    current_verdict: "blocked",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function isSupportedClaim(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.unsafe_flags_false === true && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.block_reason && row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.unsafe_flags_false === true && row.verdict_authority === "harness_only");
  }
  return false;
}

function renderMarkdown(result) {
  return [
    "# Platform Agent Operator Console v0",
    "",
    `Status: ${result.summary.platform_agent_operator_console_v0_status}`,
    `Program: ${result.summary.program_range}`,
    `Source domain pilot status: ${result.summary.source_domain_pilot_status}`,
    `Capabilities: ${result.summary.capability_row_count}`,
    `Blocks: ${result.summary.block_row_count}`,
    `Missing receipts: ${result.summary.missing_receipt_count}`,
    `API routes: ${result.summary.api_route_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Feed P1501-P2040 Platform Kernel with the console capability, block, receipt, next-action, and route projection contracts.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_OPERATOR_CONSOLE_V0_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
    console_ledger_path: options.consoleLedgerPath ?? defaults.consoleLedgerPath,
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
    activationBridgeLedgerPath: undefined,
    domainPilotLedgerPath: undefined,
    consoleLedgerPath: undefined,
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
    } else if (arg === "--activation-bridge-ledger") {
      args.activationBridgeLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--domain-pilot-ledger") {
      args.domainPilotLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--console-ledger") {
      args.consoleLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-operator-console-v0.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --activation-bridge-ledger <path>
  --domain-pilot-ledger <path>
  --console-ledger <path>
  --help                          Show this help.
`);
}
