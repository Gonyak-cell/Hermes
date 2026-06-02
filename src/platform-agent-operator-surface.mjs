import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentAdoptionFreeze } from "./platform-agent-adoption-freeze.mjs";

export const DEFAULT_PLATFORM_AGENT_OPERATOR_SURFACE_OUT_DIR = "artifacts/platform-agent-operator-surface/latest";
export const DEFAULT_PLATFORM_AGENT_OPERATOR_SURFACE_INPUTS = {
  schemaPath: "schemas/platform-agent-operator-surface.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-operator-surface";
const SOURCE_COMMAND_NAME = "platform:agent-adoption-freeze";
const SCHEMA_VERSION = "platform-agent-operator-surface.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.operator_surface";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1125-P1132";
const PHASE_SLOT = "P1125";
const PREVIOUS_PHASE_SLOT = "P1124";
const NEXT_PHASE_SLOT = "P1133";
const SOURCE_READY_STATUS = "ready_for_agent_adoption_freeze";
const READY_STATUS = "ready_for_agent_operator_surface";
const BASELINE_COMMIT_REF = "4cfda48";

const DASHBOARD_WIDGET_SPECS = [
  ["agent_freeze_summary", "Agent adoption freeze status, source count, and total claim audit posture."],
  ["agent_source_health", "Per-source readiness for authority, install trust, isolated install, registry, and rollout."],
  ["agent_claim_audit", "Unsupported claim count and PASS/BLOCK support by source."],
  ["agent_invariant_watch", "Unsafe runtime, secret, raw material, Zendd mutation, and approval-off invariants."],
  ["agent_protected_blocks", "Protected Agent actions that remain documented BLOCK."],
  ["agent_next_actions", "Next allowed action list for blocked Agent runtime and protected operations."],
];

const MUTATION_BLOCK_SPECS = [
  ["post_runtime_start", "runtime_start_route_forbidden", "keep runtime start behind future receipt contract"],
  ["post_install_execute", "install_execution_route_forbidden", "route install through P1133 receipt contract"],
  ["post_receipt_apply", "receipt_application_route_forbidden", "surface receipt templates only until validation contract exists"],
  ["post_mcp_connect", "mcp_connection_route_forbidden", "review MCP policy and collect owner receipt"],
  ["post_api_server_start", "api_server_start_route_forbidden", "keep API server start as planned surface only"],
  ["post_cron_gateway_start", "cron_gateway_start_route_forbidden", "keep scheduler/gateway start disabled"],
  ["post_raw_material_export", "raw_material_export_forbidden", "use source-span refs and quarantine review packet"],
  ["post_zendd_write", "direct_zendd_mutation_forbidden", "use external Zendd adapter safe patch lane with receipt"],
];

export async function runPlatformAgentOperatorSurface(options = {}) {
  const result = await buildPlatformAgentOperatorSurface(options);
  if (options.write !== false) await writePlatformAgentOperatorSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent operator surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentOperatorSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_OPERATOR_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const adoptionFreeze = await buildPlatformAgentAdoptionFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const baselineRows = buildBaselineRows(adoptionFreeze);
  const dashboardRows = buildDashboardRows(adoptionFreeze);
  const apiRouteRows = buildApiRouteRows(adoptionFreeze);
  const protectedQueueRows = buildProtectedQueueRows(adoptionFreeze);
  const nextActionRows = buildNextActionRows(adoptionFreeze);
  const mutationBlockRows = buildMutationBlockRows();
  const claimRows = buildClaimRows({ baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows });
  const closeoutRows = buildCloseoutRows({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_operator_surface_id: `platform-agent-operator-surface.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_operator_surface_anchor: anchor,
    source_agent_adoption_freeze_summary: adoptionFreeze.summary,
    agent_operator_baseline_rows: baselineRows,
    agent_operator_dashboard_rows: dashboardRows,
    agent_operator_api_route_rows: apiRouteRows,
    agent_operator_protected_queue_rows: protectedQueueRows,
    agent_operator_next_action_rows: nextActionRows,
    agent_operator_mutation_block_rows: mutationBlockRows,
    agent_operator_claim_rows: claimRows,
    agent_operator_closeout_rows: closeoutRows,
    agent_operator_gate_rows: gateRows,
    agent_operator_surface_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_operator_surface")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_operator_surface_id = result.platform_agent_operator_surface_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentOperatorSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-operator-surface.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-operator-baseline-rows.json"), collectionEnvelope("agent-operator-baseline-rows.v1", "agent_operator_baseline_rows", result.agent_operator_baseline_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-dashboard-rows.json"), collectionEnvelope("agent-operator-dashboard-rows.v1", "agent_operator_dashboard_rows", result.agent_operator_dashboard_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-api-route-rows.json"), collectionEnvelope("agent-operator-api-route-rows.v1", "agent_operator_api_route_rows", result.agent_operator_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-protected-queue-rows.json"), collectionEnvelope("agent-operator-protected-queue-rows.v1", "agent_operator_protected_queue_rows", result.agent_operator_protected_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-next-action-rows.json"), collectionEnvelope("agent-operator-next-action-rows.v1", "agent_operator_next_action_rows", result.agent_operator_next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-mutation-block-rows.json"), collectionEnvelope("agent-operator-mutation-block-rows.v1", "agent_operator_mutation_block_rows", result.agent_operator_mutation_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-claim-rows.json"), collectionEnvelope("agent-operator-claim-rows.v1", "agent_operator_claim_rows", result.agent_operator_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-closeout-rows.json"), collectionEnvelope("agent-operator-closeout-rows.v1", "agent_operator_closeout_rows", result.agent_operator_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-gate-rows.json"), collectionEnvelope("agent-operator-gate-rows.v1", "agent_operator_gate_rows", result.agent_operator_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-operator-surface-boundary.json"), result.agent_operator_surface_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-operator-surface-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentOperatorSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentOperatorSurface(args);
    console.log(`Platform agent operator surface ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_operator_surface_status}`);
    console.log(`Dashboard rows: ${result.summary.dashboard_row_count}`);
    console.log(`API route rows: ${result.summary.api_route_count}`);
    console.log(`Protected queue rows: ${result.summary.protected_queue_count}`);
    console.log(`Mutation blocks: ${result.summary.mutation_block_count}`);
    console.log(`Server started: ${result.summary.server_started}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildBaselineRows(adoptionFreeze) {
  const rows = [
    ["p1122_agent_adoption_commit_locked", "P1041-P1121 adoption freeze commit is recorded as the P1122 baseline.", BASELINE_COMMIT_REF],
    ["p1123_adoption_freeze_revalidated", "P1122 baseline consumes a ready adoption freeze without runtime execution.", adoptionFreeze.platform_agent_adoption_freeze_id],
    ["p1124_runtime_pilot_chain_opened", "P1122-P1200 runtime pilot chain starts from documented freeze evidence.", "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
  ];
  return rows.map(([baseline_id, description, source_ref], index) => ({
    schema_version: "agent-operator-baseline-row.v1",
    row_id: `agent-operator-baseline.row.${String(index + 1).padStart(3, "0")}`,
    baseline_id,
    phase_slot: `P112${index + 2}`,
    current_verdict: "pass",
    baseline_commit_ref: BASELINE_COMMIT_REF,
    source_ref,
    description,
    evidence_ref: `evidence.platform.agent.operator_surface.baseline.${baseline_id}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_baseline",
    hard_gate_ref: `gate.platform.agent.operator_surface.baseline.${baseline_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep baseline evidence attached before runtime pilot work",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildDashboardRows(adoptionFreeze) {
  return DASHBOARD_WIDGET_SPECS.map(([widgetId, description], index) => ({
    schema_version: "agent-operator-dashboard-row.v1",
    row_id: `agent-operator-dashboard.row.${String(index + 1).padStart(3, "0")}`,
    widget_id: widgetId,
    current_verdict: "pass",
    widget_status: "ready_for_agent_operator_dashboard",
    description,
    source_adoption_freeze_ref: adoptionFreeze.platform_agent_adoption_freeze_id,
    source_claim_count: adoptionFreeze.summary.source_claim_count,
    source_blocked_claim_count: adoptionFreeze.summary.source_blocked_claim_count,
    protected_block_count: adoptionFreeze.agent_adoption_protected_block_rows.length,
    next_action_count: adoptionFreeze.agent_adoption_protected_block_rows.filter((row) => row.next_allowed_action).length,
    read_only: true,
    server_started: false,
    mutation_performed: false,
    protected_action_executed: false,
    raw_material_exposed: false,
    evidence_ref: `evidence.platform.agent.operator_surface.dashboard.${widgetId}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_dashboard",
    hard_gate_ref: `gate.platform.agent.operator_surface.dashboard.${widgetId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "render widget from adoption freeze artifacts only",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildApiRouteRows(adoptionFreeze) {
  return adoptionFreeze.agent_adoption_operator_surface_rows.map((row, index) => ({
    schema_version: "agent-operator-api-route-row.v1",
    row_id: `agent-operator-api-route.row.${String(index + 1).padStart(3, "0")}`,
    route_path: row.route_path,
    method: "GET",
    current_verdict: "pass",
    route_status: "ready_for_agent_operator_read_only_route",
    source_surface_ref: row.row_id,
    source_adoption_freeze_ref: adoptionFreeze.platform_agent_adoption_freeze_id,
    route_mode: "read_only_planned_surface",
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    raw_material_route: false,
    response_fields: responseFieldsForRoute(row.route_path),
    evidence_ref: `evidence.platform.agent.operator_surface.api.${String(index + 1).padStart(3, "0")}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_api",
    hard_gate_ref: `gate.platform.agent.operator_surface.api.${String(index + 1).padStart(3, "0")}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "wire route to read-only API implementation after receipt contract is declared",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProtectedQueueRows(adoptionFreeze) {
  return adoptionFreeze.agent_adoption_protected_block_rows.map((row, index) => ({
    schema_version: "agent-operator-protected-queue-row.v1",
    row_id: `agent-operator-protected-queue.row.${String(index + 1).padStart(3, "0")}`,
    protected_action_id: row.protected_action_id,
    source_protected_block_ref: row.row_id,
    source_block_reason: row.block_reason,
    protected_action_verdict: row.current_verdict,
    current_verdict: "pass",
    queue_status: "ready_for_operator_attention",
    displayed_fields: ["protected_action_id", "block_reason", "responsible_owner", "human_receipt_ref", "next_allowed_action"],
    human_receipt_ref: row.human_receipt_ref,
    receipt_payload_present: false,
    protected_action_execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.operator_surface.protected_queue.${row.protected_action_id}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_protected_queue",
    hard_gate_ref: `gate.platform.agent.operator_surface.protected_queue.${row.protected_action_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNextActionRows(adoptionFreeze) {
  return adoptionFreeze.agent_adoption_protected_block_rows.map((row, index) => ({
    schema_version: "agent-operator-next-action-row.v1",
    row_id: `agent-operator-next-action.row.${String(index + 1).padStart(3, "0")}`,
    next_action_id: `agent_operator.next_action.${String(index + 1).padStart(3, "0")}`,
    source_protected_block_ref: row.row_id,
    protected_action_id: row.protected_action_id,
    current_verdict: "pass",
    action_status: "ready_for_operator_review",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.operator_surface.next_action.${row.protected_action_id}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_next_action",
    hard_gate_ref: `gate.platform.agent.operator_surface.next_action.${row.protected_action_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildMutationBlockRows() {
  return MUTATION_BLOCK_SPECS.map(([routeId, blockReason, nextAction], index) => ({
    schema_version: "agent-operator-mutation-block-row.v1",
    row_id: `agent-operator-mutation-block.row.${String(index + 1).padStart(3, "0")}`,
    blocked_route_id: routeId,
    method: "POST",
    current_verdict: "blocked",
    block_reason: blockReason,
    route_registered: false,
    server_started: false,
    mutation_performed: false,
    protected_action_executed: false,
    raw_material_exposed: false,
    human_receipt_required: true,
    receipt_payload_present: false,
    evidence_ref: `evidence.platform.agent.operator_surface.mutation_block.${routeId}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_mutation_block",
    hard_gate_ref: `gate.platform.agent.operator_surface.mutation_block.${routeId}`,
    responsible_owner: ownerForBlockedRoute(routeId),
    next_allowed_action: nextAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows }) {
  const passRows = [
    ...baselineRows.map((row) => passClaim("agent_operator_baseline", `claim.platform.agent.operator_surface.baseline.${row.baseline_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...dashboardRows.map((row) => passClaim("agent_operator_dashboard", `claim.platform.agent.operator_surface.dashboard.${row.widget_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...apiRouteRows.map((row) => passClaim("agent_operator_api_route", `claim.platform.agent.operator_surface.api.${row.route_path}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...protectedQueueRows.map((row) => passClaim("agent_operator_protected_queue", `claim.platform.agent.operator_surface.protected_queue.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action, row.human_receipt_ref)),
    ...nextActionRows.map((row) => passClaim("agent_operator_next_action", `claim.platform.agent.operator_surface.next_action.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
  ];
  const blockedRows = mutationBlockRows.map((row) => blockedClaim("agent_operator_mutation_block", `claim.platform.agent.operator_surface.mutation_block.${row.blocked_route_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-operator-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows }) {
  const rows = [
    ["source_adoption_freeze_ready", adoptionFreeze.summary.platform_agent_adoption_freeze_status === SOURCE_READY_STATUS, "source_agent_adoption_freeze_summary"],
    ["baseline_commit_recorded", baselineRows.length === 3 && baselineRows.every((row) => row.baseline_commit_ref === BASELINE_COMMIT_REF), "agent_operator_baseline_rows"],
    ["dashboard_rows_ready", dashboardRows.length === 6 && dashboardRows.every((row) => row.current_verdict === "pass" && row.read_only), "agent_operator_dashboard_rows"],
    ["api_routes_read_only", apiRouteRows.length === 5 && apiRouteRows.every((row) => row.method === "GET" && !row.mutation_route && !row.server_started), "agent_operator_api_route_rows"],
    ["protected_queue_visible", protectedQueueRows.length === 16 && protectedQueueRows.every((row) => row.protected_action_verdict === "blocked" && row.next_allowed_action), "agent_operator_protected_queue_rows"],
    ["next_actions_visible", nextActionRows.length === 16 && nextActionRows.every((row) => row.next_allowed_action && !row.execution_allowed_now), "agent_operator_next_action_rows"],
    ["mutation_routes_blocked", mutationBlockRows.length === 8 && mutationBlockRows.every((row) => row.current_verdict === "blocked" && !row.route_registered), "agent_operator_mutation_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_operator_claim_rows"],
    ["no_runtime_or_raw_surface", apiRouteRows.every((row) => !row.server_started && !row.raw_material_route) && mutationBlockRows.every((row) => !row.mutation_performed && !row.raw_material_exposed), "agent_operator_surface_boundary"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-operator-closeout-row.v1",
    row_id: `agent-operator-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.operator_surface.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_closeout",
    hard_gate_ref: `gate.platform.agent.operator_surface.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1132 closeout`,
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-operator-surface-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    baseline_commit_ref: BASELINE_COMMIT_REF,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_adoption_freeze_status: adoptionFreeze.summary.platform_agent_adoption_freeze_status,
    baseline_count: baselineRows.length,
    dashboard_row_count: dashboardRows.length,
    api_route_count: apiRouteRows.length,
    protected_queue_count: protectedQueueRows.length,
    next_action_count: nextActionRows.length,
    mutation_block_count: mutationBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_adoption_freeze", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_surface", runtimePilotLedger.available && ["P1125-P1132", COMMAND_NAME, "Agent Operator Surface"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_adoption_freeze_ready", adoptionFreeze.summary.platform_agent_adoption_freeze_status === SOURCE_READY_STATUS, "source_agent_adoption_freeze_summary"],
    ["baseline_rows_ready", baselineRows.length === 3 && baselineRows.every((row) => row.current_verdict === "pass"), "agent_operator_baseline_rows"],
    ["dashboard_rows_ready", dashboardRows.length === 6 && dashboardRows.every((row) => row.current_verdict === "pass" && row.read_only), "agent_operator_dashboard_rows"],
    ["api_routes_read_only", apiRouteRows.length === 5 && apiRouteRows.every((row) => row.method === "GET" && !row.mutation_route && !row.server_started), "agent_operator_api_route_rows"],
    ["protected_queue_visible", protectedQueueRows.length === 16 && protectedQueueRows.every((row) => row.protected_action_verdict === "blocked" && !row.protected_action_execution_allowed_now), "agent_operator_protected_queue_rows"],
    ["next_actions_visible", nextActionRows.length === 16 && nextActionRows.every((row) => row.next_allowed_action && !row.execution_allowed_now), "agent_operator_next_action_rows"],
    ["mutation_routes_blocked", mutationBlockRows.length === 8 && mutationBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && !row.route_registered), "agent_operator_mutation_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_operator_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_operator_closeout_rows"],
    ["no_server_or_raw_exposure", apiRouteRows.every((row) => !row.server_started && !row.raw_material_route) && mutationBlockRows.every((row) => !row.raw_material_exposed), "agent_operator_surface_boundary"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-operator-gate-row.v1",
    row_id: `agent-operator-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.operator_surface.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_operator_surface_gate",
    hard_gate_ref: `gate.platform.agent.operator_surface.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    server_started_by_gate: false,
    mutation_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    raw_material_exposed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1132 closeout`,
  }));
}

function buildBoundary({ generatedAt, adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "platform-agent-operator-surface-boundary.v1",
    generated_at: generatedAt,
    source_adoption_freeze_ref: adoptionFreeze.platform_agent_adoption_freeze_id,
    source_adoption_freeze_status: adoptionFreeze.summary.platform_agent_adoption_freeze_status,
    read_only: true,
    server_started: false,
    api_server_started: false,
    mutation_route_registered: false,
    mutation_performed: false,
    protected_action_executed: false,
    receipt_payload_present: false,
    receipt_applied: false,
    install_execution_performed: false,
    runtime_execution_performed: false,
    terminal_execution_performed: false,
    mcp_connection_started: false,
    cron_gateway_started: false,
    provider_secret_configured: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    direct_zendd_mutation_performed: false,
    agent_final_pass_created: false,
    baseline_count: baselineRows.length,
    dashboard_row_count: dashboardRows.length,
    api_route_count: apiRouteRows.length,
    protected_queue_count: protectedQueueRows.length,
    next_action_count: nextActionRows.length,
    mutation_block_count: mutationBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
  };
}

function buildValidationItems({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["source.adoption_freeze", adoptionFreeze.summary.platform_agent_adoption_freeze_status === SOURCE_READY_STATUS, "Source adoption freeze must be ready."],
    ["baseline.rows", baselineRows.length === 3 && baselineRows.every((row) => row.current_verdict === "pass"), "P1122-P1124 baseline rows must pass."],
    ["dashboard.rows", dashboardRows.length === 6 && dashboardRows.every((row) => row.read_only && !row.server_started), "Dashboard rows must be read-only."],
    ["api.routes", apiRouteRows.length === 5 && apiRouteRows.every((row) => row.method === "GET" && !row.mutation_route), "API routes must be GET-only planned routes."],
    ["protected.queue", protectedQueueRows.length === 16 && protectedQueueRows.every((row) => row.protected_action_verdict === "blocked" && row.next_allowed_action), "Protected queue must surface all documented blocks."],
    ["next.actions", nextActionRows.length === 16 && nextActionRows.every((row) => row.next_allowed_action && !row.execution_allowed_now), "Next action rows must be visible but non-executing."],
    ["mutation.blocks", mutationBlockRows.length === 8 && mutationBlockRows.every((row) => row.current_verdict === "blocked" && !row.route_registered), "Mutation routes must stay documented BLOCK."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "Gate rows must be ready."],
    ["boundary.no_execution", boundary.read_only && !boundary.server_started && !boundary.mutation_performed && !boundary.protected_action_executed && !boundary.raw_secret_exposed && !boundary.raw_client_or_vdr_exposed && !boundary.direct_zendd_mutation_performed, "Operator surface must not execute or expose protected material."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_operator_surface", passed, message));
}

function passClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, nextAllowedAction, humanReceiptRef = null) {
  return {
    schema_version: "agent-operator-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: null,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, blockReason, nextAllowedAction) {
  return {
    schema_version: "agent-operator-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: null,
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

function buildSummary({ adoptionFreeze, baselineRows, dashboardRows, apiRouteRows, protectedQueueRows, nextActionRows, mutationBlockRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_operator_surface_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    baseline_commit_ref: BASELINE_COMMIT_REF,
    source_adoption_freeze_status: adoptionFreeze.summary.platform_agent_adoption_freeze_status,
    source_claim_count: adoptionFreeze.summary.source_claim_count,
    source_blocked_claim_count: adoptionFreeze.summary.source_blocked_claim_count,
    baseline_count: baselineRows.length,
    dashboard_row_count: dashboardRows.length,
    api_route_count: apiRouteRows.length,
    protected_queue_count: protectedQueueRows.length,
    next_action_count: nextActionRows.length,
    mutation_block_count: mutationBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    server_started: boundary.server_started,
    api_server_started: boundary.api_server_started,
    mutation_route_registered: boundary.mutation_route_registered,
    mutation_performed: boundary.mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_applied: boundary.receipt_applied,
    install_execution_performed: boundary.install_execution_performed,
    runtime_execution_performed: boundary.runtime_execution_performed,
    terminal_execution_performed: boundary.terminal_execution_performed,
    mcp_connection_started: boundary.mcp_connection_started,
    cron_gateway_started: boundary.cron_gateway_started,
    provider_secret_configured: boundary.provider_secret_configured,
    raw_secret_exposed: boundary.raw_secret_exposed,
    raw_client_or_vdr_exposed: boundary.raw_client_or_vdr_exposed,
    direct_zendd_mutation_performed: boundary.direct_zendd_mutation_performed,
    agent_final_pass_created: boundary.agent_final_pass_created,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function responseFieldsForRoute(routePath) {
  if (routePath.endsWith("/sources")) return ["source_id", "source_status", "claim_count", "pass_claim_count", "blocked_claim_count"];
  if (routePath.endsWith("/claim-audit")) return ["source_id", "audited_claim_count", "unsupported_claim_count", "verdict_authority_required"];
  if (routePath.endsWith("/invariants")) return ["invariant_id", "policy_field", "expected_value", "observed_value"];
  if (routePath.endsWith("/protected-blocks")) return ["protected_action_id", "block_reason", "responsible_owner", "human_receipt_ref", "next_allowed_action"];
  return ["protected_action_id", "block_reason", "responsible_owner", "next_allowed_action"];
}

function ownerForBlockedRoute(routeId) {
  if (routeId.includes("zendd")) return "project_zendd_owner";
  if (routeId.includes("raw")) return "data_boundary_owner";
  if (routeId.includes("install") || routeId.includes("runtime")) return "platform_agent_runtime_owner";
  if (routeId.includes("mcp")) return "platform_agent_tooling_owner";
  return "platform_agent_owner";
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Operator Surface",
    "",
    `Status: ${result.summary.platform_agent_operator_surface_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Baseline commit: ${result.summary.baseline_commit_ref}`,
    `Dashboard rows: ${result.summary.dashboard_row_count}`,
    `API routes: ${result.summary.api_route_count}`,
    `Protected queue rows: ${result.summary.protected_queue_count}`,
    `Mutation blocks: ${result.summary.mutation_block_count}`,
    "",
    "## Boundary",
    "",
    "- Read-only: true",
    "- Server started: false",
    "- Mutation performed: false",
    "- Raw secret/client/VDR exposed: false",
    "- Direct Zendd mutation: false",
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
  const defaults = DEFAULT_PLATFORM_AGENT_OPERATOR_SURFACE_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-operator-surface.mjs [--check] [--out-dir DIR]\n\nCreates the P1125-P1132 read-only Agent operator surface without starting a server or running Hermes Agent.`);
}
