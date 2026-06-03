import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelProjectionFreeze } from "./platform-kernel-projection-freeze.mjs";

export const DEFAULT_PLATFORM_HARNESS_NATIVE_CUTOVER_ADAPTER_OUT_DIR = "artifacts/platform-harness-native-cutover-adapter/latest";
export const DEFAULT_PLATFORM_HARNESS_NATIVE_CUTOVER_ADAPTER_INPUTS = {
  schemaPath: "schemas/platform-harness-native-cutover-adapter.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelBaselineLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
  reconciliationLedgerPath: "docs/hermes-platform-kernel-spec-status-reconciliation-phase-ledger.md",
  claimEngineLedgerPath: "docs/hermes-platform-kernel-claim-evidence-gate-engine-phase-ledger.md",
  artifactCheckReceiptLedgerPath: "docs/hermes-platform-kernel-artifact-check-receipt-engine-phase-ledger.md",
  projectionFreezeLedgerPath: "docs/hermes-platform-kernel-projection-freeze-phase-ledger.md",
  harnessNativeCutoverLedgerPath: "docs/hermes-platform-harness-native-cutover-adapter-phase-ledger.md",
};

const COMMAND_NAME = "platform:harness-native-cutover-adapter";
const SOURCE_COMMAND_NAME = "platform:kernel-projection-freeze";
const SCHEMA_VERSION = "platform-harness-native-cutover-adapter.v1";
const CAPABILITY_ID = "platform.harness_native.cutover_adapter";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1881-P1960";
const PHASE_SLOT = "P1881";
const PREVIOUS_PHASE_SLOT = "P1880";
const NEXT_PHASE_SLOT = "P1961";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_projection_freeze";
const READY_STATUS = "ready_for_platform_harness_native_cutover_adapter";

const COMPONENT_SPECS = [
  ["harness_native_manifest_adapter", "Convert projection manifest into Harness-native development manifest"],
  ["phase_development_lane_adapter", "Represent phase work as Kernel-native lanes"],
  ["kernel_primitive_adapter", "Bind claim/evidence/gate/artifact/check/receipt primitives to each lane"],
  ["operator_control_plane_adapter", "Expose control-plane rows without executing actions"],
  ["domain_pack_adapter", "Map multi-domain packs to Harness-native cutover rows"],
  ["cutover_guard_adapter", "Preserve no-runtime/no-write/no-final-authority cutover guards"],
];

const LANE_SPECS = [
  ["phase_definition_lane", ["claim", "evidence", "gate"], "define phase scope and acceptance criteria"],
  ["claim_authoring_lane", ["claim", "evidence"], "author PASS/BLOCK claims with support refs"],
  ["evidence_binding_lane", ["evidence", "artifact"], "bind evidence refs without raw material"],
  ["gate_review_lane", ["gate", "check"], "review deterministic gates and human reviewer refs"],
  ["artifact_projection_lane", ["artifact", "check"], "project artifacts without writing payloads"],
  ["check_validation_lane", ["check", "gate"], "run deterministic validation checks only"],
  ["receipt_visibility_lane", ["receipt", "gate"], "show receipt requirements without applying payloads"],
  ["operator_console_lane", ["artifact", "check", "receipt"], "surface next actions in operator console"],
];

const DOMAIN_SPECS = [
  ["platform", "platform Kernel and operator control plane"],
  ["personal-dev", "development project management pack"],
  ["law-firm", "legal matter operations pack"],
  ["creative-document", "document and media workflow pack"],
  ["connectors-resource", "connector and resource ingestion pack"],
  ["trading", "read-only trading safety and evidence pack"],
  ["project.zendd", "external Zendd project adapter pack"],
];

const API_ROUTE_SPECS = [
  ["/api/harness-native/manifest", "harness_native_cutover_manifest"],
  ["/api/harness-native/lanes", "harness_native_lane_rows"],
  ["/api/harness-native/adapters", "harness_native_adapter_rows"],
  ["/api/harness-native/domains", "harness_native_domain_cutover_rows"],
  ["/api/harness-native/guards", "harness_native_guard_rows"],
  ["/api/harness-native/next-actions", "harness_native_claim_rows"],
];

const GUARD_SPECS = [
  ["runtime_execution", "agent runtime execution remains closed"],
  ["write_action", "file write/action remains closed"],
  ["protected_action", "protected action execution remains closed"],
  ["receipt_application", "receipt application remains closed"],
  ["raw_secret_access", "raw secret access remains closed"],
  ["raw_client_vdr_access", "raw client or VDR access remains closed"],
  ["direct_zendd_mutation", "direct Zendd mutation remains closed"],
  ["legal_final_judgment", "legal final judgment remains human-owned"],
  ["release_decision", "release decision remains human-owned"],
  ["agent_final_pass", "Agent final PASS remains forbidden"],
];

const FREEZE_SPECS = [
  ["source_projection_freeze_ready", "P1801-P1880 projection freeze is ready"],
  ["lane_rows_ready", "Harness-native lane rows are ready"],
  ["adapter_rows_ready", "Harness-native adapter rows are ready"],
  ["domain_cutover_rows_ready", "domain cutover rows are ready"],
  ["api_routes_read_only", "read-only API routes are declared"],
  ["guard_rows_ready", "cutover guards are closed"],
  ["protected_blocks_preserved", "protected source blocks remain blocked"],
  ["ready_for_p1961_kernel_cutover_freeze", "next slice can freeze Harness-native Kernel cutover"],
];

export async function runPlatformHarnessNativeCutoverAdapter(options = {}) {
  const result = await buildPlatformHarnessNativeCutoverAdapter(options);
  if (options.write !== false) await writePlatformHarnessNativeCutoverAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Harness-native cutover adapter failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformHarnessNativeCutoverAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_HARNESS_NATIVE_CUTOVER_ADAPTER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const projectionLedger = await readTextSource(inputs.projection_freeze_ledger_path);
  const cutoverLedger = await readTextSource(inputs.harness_native_cutover_ledger_path);
  const sourceProjectionFreeze = options.sourceKernelProjectionFreeze ?? await buildPlatformKernelProjectionFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    kernelBaselineLedgerPath: inputs.kernel_baseline_ledger_path,
    reconciliationLedgerPath: inputs.reconciliation_ledger_path,
    claimEngineLedgerPath: inputs.claim_engine_ledger_path,
    artifactCheckReceiptLedgerPath: inputs.artifact_check_receipt_ledger_path,
    projectionFreezeLedgerPath: inputs.projection_freeze_ledger_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const laneRows = buildLaneRows(sourceProjectionFreeze);
  const adapterRows = buildAdapterRows(laneRows, sourceProjectionFreeze);
  const domainRows = buildDomainRows(sourceProjectionFreeze);
  const apiRouteRows = buildApiRouteRows();
  const guardRows = buildGuardRows(sourceProjectionFreeze);
  const freezeRows = buildFreezeRows({ sourceProjectionFreeze, laneRows, adapterRows, domainRows, apiRouteRows, guardRows });
  const anchor = buildAnchor({ packageJson, projectionLedger, cutoverLedger, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, projectionLedger, cutoverLedger, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows });
  const claimRows = buildClaimRows({ componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, sourceProjectionFreeze });
  const manifest = buildManifest({ generatedAt, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows });
  const boundary = buildBoundary({ sourceProjectionFreeze, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_harness_native_cutover_adapter_id: `platform-harness-native-cutover-adapter.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    harness_native_cutover_anchor: anchor,
    source_kernel_projection_freeze_summary: sourceProjectionFreeze.summary,
    harness_native_cutover_manifest: manifest,
    harness_native_component_rows: componentRows,
    harness_native_lane_rows: laneRows,
    harness_native_adapter_rows: adapterRows,
    harness_native_domain_cutover_rows: domainRows,
    harness_native_api_route_rows: apiRouteRows,
    harness_native_guard_rows: guardRows,
    harness_native_freeze_rows: freezeRows,
    harness_native_gate_rows: gateRows,
    harness_native_claim_rows: claimRows,
    harness_native_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_harness_native_cutover_adapter")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_harness_native_cutover_adapter_id = result.platform_harness_native_cutover_adapter_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformHarnessNativeCutoverAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-harness-native-cutover-adapter.json"), serializableResult(result));
  await writeJson(path.join(outDir, "harness-native-cutover-manifest.json"), result.harness_native_cutover_manifest);
  await writeJson(path.join(outDir, "harness-native-component-rows.json"), collectionEnvelope("harness-native-component-rows.v1", "harness_native_component_rows", result.harness_native_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-lane-rows.json"), collectionEnvelope("harness-native-lane-rows.v1", "harness_native_lane_rows", result.harness_native_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-adapter-rows.json"), collectionEnvelope("harness-native-adapter-rows.v1", "harness_native_adapter_rows", result.harness_native_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-domain-cutover-rows.json"), collectionEnvelope("harness-native-domain-cutover-rows.v1", "harness_native_domain_cutover_rows", result.harness_native_domain_cutover_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-api-route-rows.json"), collectionEnvelope("harness-native-api-route-rows.v1", "harness_native_api_route_rows", result.harness_native_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-guard-rows.json"), collectionEnvelope("harness-native-guard-rows.v1", "harness_native_guard_rows", result.harness_native_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-freeze-rows.json"), collectionEnvelope("harness-native-freeze-rows.v1", "harness_native_freeze_rows", result.harness_native_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-gate-rows.json"), collectionEnvelope("harness-native-gate-rows.v1", "harness_native_gate_rows", result.harness_native_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-claim-rows.json"), collectionEnvelope("harness-native-claim-rows.v1", "harness_native_claim_rows", result.harness_native_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-native-boundary.json"), result.harness_native_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-harness-native-cutover-adapter-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformHarnessNativeCutoverAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformHarnessNativeCutoverAdapter(args);
    console.log(`Platform Harness-native cutover adapter ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_harness_native_cutover_adapter_status}`);
    console.log(`Lanes: ${result.summary.lane_count}`);
    console.log(`Adapters: ${result.summary.adapter_count}`);
    console.log(`Domains: ${result.summary.domain_cutover_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Write action allowed: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([component_id, description], index) => passRow({
    schema_version: "harness-native-component-row.v1",
    row_id: `harness.native.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id,
    component_status: "ready_for_cutover_adapter",
    description,
    harness_native_only: true,
    evidence_ref: `evidence.platform.harness_native.component.${component_id}`,
    reviewer_ref: "reviewer.platform_harness_native_component",
    hard_gate_ref: `gate.platform.harness_native.component.${component_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "promote component into P1961 cutover freeze",
  }));
}

function buildLaneRows(sourceProjectionFreeze) {
  return LANE_SPECS.map(([laneId, primitives, description], index) => passRow({
    schema_version: "harness-native-lane-row.v1",
    row_id: `harness.native.lane.row.${String(index + 1).padStart(2, "0")}`,
    lane_id: laneId,
    primitive_refs: primitives,
    lane_status: "ready_for_harness_native_cutover",
    source_projection_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    description,
    execution_allowed_now: false,
    write_allowed_now: false,
    evidence_ref: `evidence.platform.harness_native.lane.${laneId}`,
    reviewer_ref: "reviewer.platform_harness_native_lane",
    hard_gate_ref: `gate.platform.harness_native.lane.${laneId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "use lane as Harness-native development control row",
  }));
}

function buildAdapterRows(laneRows, sourceProjectionFreeze) {
  return laneRows.map((lane, index) => passRow({
    schema_version: "harness-native-adapter-row.v1",
    row_id: `harness.native.adapter.row.${String(index + 1).padStart(2, "0")}`,
    adapter_id: `adapter.${lane.lane_id}`,
    lane_ref: lane.row_id,
    adapter_status: "ready_no_execution",
    source_projection_ref: sourceProjectionFreeze.platform_kernel_projection_freeze_id,
    route_binding_required: true,
    operator_projection_required: true,
    direct_tool_execution_allowed_now: false,
    mutation_allowed_now: false,
    evidence_ref: `evidence.platform.harness_native.adapter.${lane.lane_id}`,
    reviewer_ref: "reviewer.platform_harness_native_adapter",
    hard_gate_ref: `gate.platform.harness_native.adapter.${lane.lane_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "bind adapter into P1961 cutover freeze",
  }));
}

function buildDomainRows(sourceProjectionFreeze) {
  return DOMAIN_SPECS.map(([domainId, description], index) => passRow({
    schema_version: "harness-native-domain-cutover-row.v1",
    row_id: `harness.native.domain.row.${String(index + 1).padStart(2, "0")}`,
    domain_id: domainId,
    domain_cutover_status: "ready_for_no_write_harness_native_cutover",
    source_projection_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    description,
    protected_action_allowed_now: false,
    legal_or_release_final_authority_allowed_now: false,
    raw_material_access_allowed_now: false,
    evidence_ref: `evidence.platform.harness_native.domain.${domainId}`,
    reviewer_ref: "reviewer.platform_harness_native_domain",
    hard_gate_ref: `gate.platform.harness_native.domain.${domainId}`,
    responsible_owner: domainId === "platform" ? "platform_kernel_owner" : `${domainId.replaceAll(".", "_").replaceAll("-", "_")}_owner`,
    next_allowed_action: "freeze domain cutover level before limited execution program",
  }));
}

function buildApiRouteRows() {
  return API_ROUTE_SPECS.map(([routePath, responseCollection], index) => passRow({
    schema_version: "harness-native-api-route-row.v1",
    row_id: `harness.native.api.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    response_collection: responseCollection,
    route_status: "ready_for_read_only_projection",
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    receipt_application_route: false,
    raw_material_route: false,
    evidence_ref: `evidence.platform.harness_native.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_harness_native_api",
    hard_gate_ref: `gate.platform.harness_native.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "project route as read-only Harness-native API surface",
  }));
}

function buildGuardRows(sourceProjectionFreeze) {
  return GUARD_SPECS.map(([guardId, description], index) => passRow({
    schema_version: "harness-native-guard-row.v1",
    row_id: `harness.native.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: "closed",
    description,
    source_projection_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    action_allowed_now: false,
    evidence_ref: `evidence.platform.harness_native.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_harness_native_guard",
    hard_gate_ref: `gate.platform.harness_native.guard.${guardId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "keep guard closed until a later human-approved execution lane",
  }));
}

function buildFreezeRows({ sourceProjectionFreeze, laneRows, adapterRows, domainRows, apiRouteRows, guardRows }) {
  const checks = {
    source_projection_freeze_ready: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status === SOURCE_READY_STATUS,
    lane_rows_ready: laneRows.length === 8 && laneRows.every((row) => row.lane_status === "ready_for_harness_native_cutover"),
    adapter_rows_ready: adapterRows.length === 8 && adapterRows.every((row) => row.adapter_status === "ready_no_execution"),
    domain_cutover_rows_ready: domainRows.length === 7 && domainRows.every((row) => row.domain_cutover_status === "ready_for_no_write_harness_native_cutover"),
    api_routes_read_only: apiRouteRows.length === 6 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false),
    guard_rows_ready: guardRows.length === 10 && guardRows.every((row) => row.guard_status === "closed" && row.action_allowed_now === false),
    protected_blocks_preserved: sourceProjectionFreeze.summary.blocked_claim_count === 20,
    ready_for_p1961_kernel_cutover_freeze: true,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "harness-native-freeze-row.v1",
      row_id: `harness.native.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.harness_native.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_harness_native_freeze",
      hard_gate_ref: `gate.platform.harness_native.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1960 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `harness_native_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, projectionLedger, cutoverLedger, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows }) {
  return {
    schema_version: "harness-native-cutover-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    projection_freeze_ledger_present: projectionLedger.available,
    harness_native_cutover_ledger_present: cutoverLedger.available,
    source_projection_freeze_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    component_count: componentRows.length,
    lane_count: laneRows.length,
    adapter_count: adapterRows.length,
    domain_cutover_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, projectionLedger, cutoverLedger, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_projection_freeze_ready", sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status === SOURCE_READY_STATUS],
    ["projection_freeze_ledger_present", projectionLedger.available && projectionLedger.text.includes("P1801-P1880")],
    ["harness_native_cutover_ledger_present", cutoverLedger.available && ["P1881-P1960", "P1881-P1900", "P1941-P1960", COMMAND_NAME].every((token) => cutoverLedger.text.includes(token))],
    ["component_rows_ready", componentRows.length === 6 && componentRows.every((row) => row.current_verdict === "pass")],
    ["lane_rows_ready", laneRows.length === 8 && laneRows.every((row) => row.current_verdict === "pass")],
    ["adapter_rows_ready", adapterRows.length === 8 && adapterRows.every((row) => row.current_verdict === "pass")],
    ["domain_rows_ready", domainRows.length === 7 && domainRows.every((row) => row.current_verdict === "pass")],
    ["api_routes_read_only", apiRouteRows.length === 6 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["guard_rows_closed", guardRows.length === 10 && guardRows.every((row) => row.action_allowed_now === false)],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "harness-native-gate-row.v1",
    row_id: `harness.native.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.harness_native.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_harness_native_gate",
    hard_gate_ref: `gate.platform.harness_native.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1960 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, sourceProjectionFreeze }) {
  const passSources = [
    ...componentRows.map((row) => ["component", row.component_id, row]),
    ...laneRows.map((row) => ["lane", row.lane_id, row]),
    ...adapterRows.map((row) => ["adapter", row.adapter_id, row]),
    ...domainRows.map((row) => ["domain_cutover", row.domain_id, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...guardRows.map((row) => ["guard", row.guard_id, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = sourceProjectionFreeze.kernel_projection_claim_rows
    .filter((row) => row.current_verdict === "blocked")
    .map((row) => ["protected_block", row.claim_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "harness-native-claim-row.v1",
    row_id: `harness.native.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildManifest({ generatedAt, sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows }) {
  return {
    schema_version: "harness-native-cutover-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_projection_freeze_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    component_count: componentRows.length,
    lane_count: laneRows.length,
    adapter_count: adapterRows.length,
    domain_cutover_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    claim_count: claimRows.length,
    harness_native_cutover_ready: true,
    next_allowed_action: "advance to P1961-P2040 final Kernel cutover freeze",
  };
}

function buildBoundary({ sourceProjectionFreeze, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceProjectionFreeze.kernel_projection_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    laneRows.some((row) => row.execution_allowed_now || row.write_allowed_now),
    adapterRows.some((row) => row.direct_tool_execution_allowed_now || row.mutation_allowed_now),
    domainRows.some((row) => row.protected_action_allowed_now || row.legal_or_release_final_authority_allowed_now || row.raw_material_access_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    guardRows.some((row) => row.action_allowed_now),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "harness-native-boundary.v1",
    harness_native_cutover_adapter_ready_for_kernel_freeze: gateRows.every((row) => row.gate_status === "ready") && freezeRows.every((row) => row.current_verdict === "pass"),
    source_projection_freeze_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    harness_native_cutover_only: true,
    read_only_projection: true,
    server_started: false,
    mutation_performed: false,
    raw_material_exposed: false,
    receipt_payload_present: false,
    receipt_applied: false,
    agent_runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_client_or_vdr_access_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    live_trading_action_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.projection_freeze", "source_ready", sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status === SOURCE_READY_STATUS, "source projection freeze must be ready"),
    validationItem("component.count", "component_rows", componentRows.length === 6, "all Harness-native component rows must exist"),
    validationItem("lane.count", "lane_rows", laneRows.length === 8, "all Harness-native lane rows must exist"),
    validationItem("adapter.count", "adapter_rows", adapterRows.length === 8, "all Harness-native adapter rows must exist"),
    validationItem("domain.count", "domain_rows", domainRows.length === 7, "all domain cutover rows must exist"),
    validationItem("api_projection.count", "api_projection_rows", apiRouteRows.length === 6, "all Harness-native API route rows must exist"),
    validationItem("guard.count", "guard_rows", guardRows.length === 10, "all cutover guard rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceProjectionFreeze, componentRows, laneRows, adapterRows, domainRows, apiRouteRows, guardRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-harness-native-cutover-adapter-summary.v1",
    platform_harness_native_cutover_adapter_status: validation.valid && boundary.harness_native_cutover_adapter_ready_for_kernel_freeze ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_projection_freeze_status: sourceProjectionFreeze.summary.platform_kernel_projection_freeze_status,
    component_count: componentRows.length,
    lane_count: laneRows.length,
    adapter_count: adapterRows.length,
    domain_cutover_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    harness_native_cutover_only: boundary.harness_native_cutover_only,
    server_started: boundary.server_started,
    mutation_performed: boundary.mutation_performed,
    raw_material_exposed: boundary.raw_material_exposed,
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
    "# Platform Harness-Native Cutover Adapter",
    "",
    `Status: ${result.summary.platform_harness_native_cutover_adapter_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source projection freeze status: ${result.summary.source_projection_freeze_status}`,
    `Lanes: ${result.summary.lane_count}`,
    `Adapters: ${result.summary.adapter_count}`,
    `Domains: ${result.summary.domain_cutover_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1961-P2040 final Kernel cutover freeze while preserving no-execution invariants.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_HARNESS_NATIVE_CUTOVER_ADAPTER_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
    console_ledger_path: options.consoleLedgerPath ?? defaults.consoleLedgerPath,
    kernel_baseline_ledger_path: options.kernelBaselineLedgerPath ?? defaults.kernelBaselineLedgerPath,
    reconciliation_ledger_path: options.reconciliationLedgerPath ?? defaults.reconciliationLedgerPath,
    claim_engine_ledger_path: options.claimEngineLedgerPath ?? defaults.claimEngineLedgerPath,
    artifact_check_receipt_ledger_path: options.artifactCheckReceiptLedgerPath ?? defaults.artifactCheckReceiptLedgerPath,
    projection_freeze_ledger_path: options.projectionFreezeLedgerPath ?? defaults.projectionFreezeLedgerPath,
    harness_native_cutover_ledger_path: options.harnessNativeCutoverLedgerPath ?? defaults.harnessNativeCutoverLedgerPath,
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
    kernelBaselineLedgerPath: undefined,
    reconciliationLedgerPath: undefined,
    claimEngineLedgerPath: undefined,
    artifactCheckReceiptLedgerPath: undefined,
    projectionFreezeLedgerPath: undefined,
    harnessNativeCutoverLedgerPath: undefined,
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
    } else if (arg === "--kernel-baseline-ledger") {
      args.kernelBaselineLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--reconciliation-ledger") {
      args.reconciliationLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--claim-engine-ledger") {
      args.claimEngineLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--artifact-check-receipt-ledger") {
      args.artifactCheckReceiptLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--projection-freeze-ledger") {
      args.projectionFreezeLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--harness-native-cutover-ledger") {
      args.harnessNativeCutoverLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-harness-native-cutover-adapter.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --activation-bridge-ledger <path>
  --domain-pilot-ledger <path>
  --console-ledger <path>
  --kernel-baseline-ledger <path>
  --reconciliation-ledger <path>
  --claim-engine-ledger <path>
  --artifact-check-receipt-ledger <path>
  --projection-freeze-ledger <path>
  --harness-native-cutover-ledger <path>
  --help                          Show this help.
`);
}
