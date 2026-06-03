import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformHarnessNativeCutoverAdapter } from "./platform-harness-native-cutover-adapter.mjs";

export const DEFAULT_PLATFORM_KERNEL_HARNESS_NATIVE_CUTOVER_FREEZE_OUT_DIR = "artifacts/platform-kernel-harness-native-cutover-freeze/latest";
export const DEFAULT_PLATFORM_KERNEL_HARNESS_NATIVE_CUTOVER_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-kernel-harness-native-cutover-freeze.schema.json",
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
  kernelCutoverFreezeLedgerPath: "docs/hermes-platform-kernel-harness-native-cutover-freeze-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-harness-native-cutover-freeze";
const SOURCE_COMMAND_NAME = "platform:harness-native-cutover-adapter";
const SCHEMA_VERSION = "platform-kernel-harness-native-cutover-freeze.v1";
const CAPABILITY_ID = "platform.kernel.harness_native_cutover_freeze";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1961-P2040";
const PHASE_SLOT = "P1961";
const PREVIOUS_PHASE_SLOT = "P1960";
const NEXT_PHASE_SLOT = "P2041";
const SOURCE_READY_STATUS = "ready_for_platform_harness_native_cutover_adapter";
const READY_STATUS = "ready_for_platform_kernel_harness_native_cutover_freeze";

const COMPONENT_SPECS = [
  ["kernel_cutover_manifest_freeze", "Freeze P1501-P2040 Kernel manifest"],
  ["harness_native_lane_freeze", "Freeze Harness-native development lane contract"],
  ["domain_rollout_level_freeze", "Freeze domain rollout levels at no-execution"],
  ["operator_control_plane_freeze", "Freeze operator control-plane API projections"],
  ["protected_boundary_freeze", "Freeze unsafe action guards"],
  ["p2041_suspension_freeze", "Suspend P2041 limited execution until the Nous overlap audit is complete"],
];

const ASSERTION_SPECS = [
  ["kernel_primitives_commonized", "claim/evidence/gate/artifact/check/receipt primitives are commonized"],
  ["projection_surface_frozen", "read-only Kernel projection surface is frozen"],
  ["harness_native_lanes_bound", "Harness-native development lanes are bound"],
  ["domain_cutover_bound", "domain cutover rows are bound"],
  ["operator_console_bound", "operator console and API projection are bound"],
  ["validation_chain_bound", "package validate chain includes Kernel cutover commands"],
  ["protected_blocks_preserved", "protected BLOCK rows remain blocked"],
  ["no_execution_boundary", "runtime/protected/tool execution remains disabled"],
  ["no_write_boundary", "write/mutation/receipt application remains disabled"],
  ["p2041_suspended_pending_nous_overlap_audit", "P2041 limited execution is suspended pending the Nous overlap audit"],
];

const DOMAIN_ROLLOUT_SPECS = [
  ["platform", "kernel_native_no_execution"],
  ["personal-dev", "kernel_native_no_execution"],
  ["law-firm", "kernel_native_no_execution"],
  ["creative-document", "kernel_native_no_execution"],
  ["connectors-resource", "kernel_native_no_execution"],
  ["trading", "kernel_native_no_execution"],
  ["project.zendd", "kernel_native_no_write_external_adapter"],
];

const API_ROUTE_SPECS = [
  ["/api/kernel-cutover/manifest", "kernel_cutover_manifest"],
  ["/api/kernel-cutover/assertions", "kernel_cutover_assertion_rows"],
  ["/api/kernel-cutover/domains", "kernel_cutover_domain_rollout_rows"],
  ["/api/kernel-cutover/guards", "kernel_cutover_guard_rows"],
  ["/api/kernel-cutover/handoff", "kernel_cutover_handoff_rows"],
];

const GUARD_SPECS = [
  ["runtime_execution", "closed"],
  ["terminal_execution", "closed"],
  ["mcp_connection", "closed"],
  ["api_or_cron_start", "closed"],
  ["write_action", "closed"],
  ["protected_action", "closed"],
  ["receipt_application", "closed"],
  ["raw_material_access", "closed"],
  ["final_legal_release_authority", "closed"],
  ["agent_final_pass", "closed"],
];

const FREEZE_SPECS = [
  ["source_harness_native_cutover_ready", "P1881-P1960 Harness-native cutover adapter is ready"],
  ["component_rows_ready", "Kernel cutover freeze components are ready"],
  ["assertion_rows_ready", "cutover assertion rows are ready"],
  ["domain_rollout_rows_ready", "domain rollout rows are frozen"],
  ["api_routes_read_only", "read-only API routes are declared"],
  ["guard_rows_closed", "all protected guards are closed"],
  ["protected_blocks_preserved", "protected source blocks remain blocked"],
  ["p2041_suspension_declared", "P2041 limited execution is suspended pending the Nous overlap audit"],
];

export async function runPlatformKernelHarnessNativeCutoverFreeze(options = {}) {
  const result = await buildPlatformKernelHarnessNativeCutoverFreeze(options);
  if (options.write !== false) await writePlatformKernelHarnessNativeCutoverFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel Harness-native cutover freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelHarnessNativeCutoverFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_HARNESS_NATIVE_CUTOVER_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const cutoverLedger = await readTextSource(inputs.harness_native_cutover_ledger_path);
  const freezeLedger = await readTextSource(inputs.kernel_cutover_freeze_ledger_path);
  const sourceHarnessNativeCutover = options.sourceHarnessNativeCutoverAdapter ?? await buildPlatformHarnessNativeCutoverAdapter({
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
    harnessNativeCutoverLedgerPath: inputs.harness_native_cutover_ledger_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const assertionRows = buildAssertionRows(sourceHarnessNativeCutover);
  const domainRows = buildDomainRows(sourceHarnessNativeCutover);
  const apiRouteRows = buildApiRouteRows();
  const guardRows = buildGuardRows(sourceHarnessNativeCutover);
  const handoffRows = buildHandoffRows(sourceHarnessNativeCutover);
  const freezeRows = buildFreezeRows({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows });
  const anchor = buildAnchor({ packageJson, cutoverLedger, freezeLedger, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, cutoverLedger, freezeLedger, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows });
  const claimRows = buildClaimRows({ componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, sourceHarnessNativeCutover });
  const manifest = buildManifest({ generatedAt, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows });
  const boundary = buildBoundary({ sourceHarnessNativeCutover, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_harness_native_cutover_freeze_id: `platform-kernel-harness-native-cutover-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_harness_native_cutover_freeze_anchor: anchor,
    source_harness_native_cutover_adapter_summary: sourceHarnessNativeCutover.summary,
    kernel_cutover_manifest: manifest,
    kernel_cutover_component_rows: componentRows,
    kernel_cutover_assertion_rows: assertionRows,
    kernel_cutover_domain_rollout_rows: domainRows,
    kernel_cutover_api_route_rows: apiRouteRows,
    kernel_cutover_guard_rows: guardRows,
    kernel_cutover_handoff_rows: handoffRows,
    kernel_cutover_freeze_rows: freezeRows,
    kernel_cutover_gate_rows: gateRows,
    kernel_cutover_claim_rows: claimRows,
    kernel_cutover_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_harness_native_cutover_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_harness_native_cutover_freeze_id = result.platform_kernel_harness_native_cutover_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelHarnessNativeCutoverFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-harness-native-cutover-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-cutover-manifest.json"), result.kernel_cutover_manifest);
  await writeJson(path.join(outDir, "kernel-cutover-component-rows.json"), collectionEnvelope("kernel-cutover-component-rows.v1", "kernel_cutover_component_rows", result.kernel_cutover_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-assertion-rows.json"), collectionEnvelope("kernel-cutover-assertion-rows.v1", "kernel_cutover_assertion_rows", result.kernel_cutover_assertion_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-domain-rollout-rows.json"), collectionEnvelope("kernel-cutover-domain-rollout-rows.v1", "kernel_cutover_domain_rollout_rows", result.kernel_cutover_domain_rollout_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-api-route-rows.json"), collectionEnvelope("kernel-cutover-api-route-rows.v1", "kernel_cutover_api_route_rows", result.kernel_cutover_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-guard-rows.json"), collectionEnvelope("kernel-cutover-guard-rows.v1", "kernel_cutover_guard_rows", result.kernel_cutover_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-handoff-rows.json"), collectionEnvelope("kernel-cutover-handoff-rows.v1", "kernel_cutover_handoff_rows", result.kernel_cutover_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-freeze-rows.json"), collectionEnvelope("kernel-cutover-freeze-rows.v1", "kernel_cutover_freeze_rows", result.kernel_cutover_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-gate-rows.json"), collectionEnvelope("kernel-cutover-gate-rows.v1", "kernel_cutover_gate_rows", result.kernel_cutover_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-claim-rows.json"), collectionEnvelope("kernel-cutover-claim-rows.v1", "kernel_cutover_claim_rows", result.kernel_cutover_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-boundary.json"), result.kernel_cutover_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-harness-native-cutover-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelHarnessNativeCutoverFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelHarnessNativeCutoverFreeze(args);
    console.log(`Platform Kernel Harness-native cutover freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_harness_native_cutover_freeze_status}`);
    console.log(`Assertions: ${result.summary.assertion_count}`);
    console.log(`Domains: ${result.summary.domain_rollout_count}`);
    console.log(`Handoffs: ${result.summary.handoff_count}`);
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
    schema_version: "kernel-cutover-component-row.v1",
    row_id: `kernel.cutover.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id,
    component_status: "frozen",
    description,
    evidence_ref: `evidence.platform.kernel.cutover.component.${component_id}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_component",
    hard_gate_ref: `gate.platform.kernel.cutover.component.${component_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "preserve component as Nous overlap audit input",
  }));
}

function buildAssertionRows(sourceHarnessNativeCutover) {
  return ASSERTION_SPECS.map(([assertionId, description], index) => passRow({
    schema_version: "kernel-cutover-assertion-row.v1",
    row_id: `kernel.cutover.assertion.row.${String(index + 1).padStart(2, "0")}`,
    assertion_id: assertionId,
    assertion_status: "frozen",
    source_harness_native_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    description,
    evidence_ref: `evidence.platform.kernel.cutover.assertion.${assertionId}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_assertion",
    hard_gate_ref: `gate.platform.kernel.cutover.assertion.${assertionId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: assertionId === "p2041_suspended_pending_nous_overlap_audit" ? "run platform:nous-overlap-audit before any P2041 limited execution work" : "keep assertion frozen",
  }));
}

function buildDomainRows(sourceHarnessNativeCutover) {
  const sourceDomains = new Map(sourceHarnessNativeCutover.harness_native_domain_cutover_rows.map((row) => [row.domain_id, row]));
  return DOMAIN_ROLLOUT_SPECS.map(([domainId, rolloutLevel], index) => {
    const source = sourceDomains.get(domainId);
    return passRow({
      schema_version: "kernel-cutover-domain-rollout-row.v1",
      row_id: `kernel.cutover.domain.row.${String(index + 1).padStart(2, "0")}`,
      domain_id: domainId,
      rollout_level: rolloutLevel,
      source_domain_cutover_ref: source?.row_id ?? `missing.${domainId}`,
      domain_rollout_status: "frozen_no_execution",
      protected_action_allowed_now: false,
      write_action_allowed_now: false,
      raw_material_access_allowed_now: false,
      final_authority_allowed_now: false,
      evidence_ref: `evidence.platform.kernel.cutover.domain.${domainId}`,
      reviewer_ref: "reviewer.platform_kernel_cutover_domain",
      hard_gate_ref: `gate.platform.kernel.cutover.domain.${domainId}`,
      responsible_owner: source?.responsible_owner ?? "platform_kernel_owner",
      next_allowed_action: "use domain rollout row as Nous overlap audit input before any P2041 limited execution",
    });
  });
}

function buildApiRouteRows() {
  return API_ROUTE_SPECS.map(([routePath, responseCollection], index) => passRow({
    schema_version: "kernel-cutover-api-route-row.v1",
    row_id: `kernel.cutover.api.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    response_collection: responseCollection,
    route_status: "frozen_read_only",
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    receipt_application_route: false,
    raw_material_route: false,
    evidence_ref: `evidence.platform.kernel.cutover.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_api",
    hard_gate_ref: `gate.platform.kernel.cutover.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "project route as read-only cutover API surface",
  }));
}

function buildGuardRows(sourceHarnessNativeCutover) {
  return GUARD_SPECS.map(([guardId, guardStatus], index) => passRow({
    schema_version: "kernel-cutover-guard-row.v1",
    row_id: `kernel.cutover.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: guardStatus,
    source_harness_native_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    action_allowed_now: false,
    evidence_ref: `evidence.platform.kernel.cutover.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_guard",
    hard_gate_ref: `gate.platform.kernel.cutover.guard.${guardId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "keep guard closed until explicit P2041 human receipt lane",
  }));
}

function buildHandoffRows(sourceHarnessNativeCutover) {
  return [
    ["p2041_suspended_pending_nous_overlap_audit", "limited execution is suspended until the Nous overlap audit classifies the surface"],
    ["p2161_work_order_delegation", "work order/delegation program can consume cutover rows"],
    ["p2281_controlled_write", "controlled write remains future and human-approved"],
    ["p2561_storage_event_plane", "storage/event plane can consume frozen Kernel rows"],
  ].map(([handoffId, description], index) => passRow({
    schema_version: "kernel-cutover-handoff-row.v1",
    row_id: `kernel.cutover.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    handoff_status: "ready_as_input",
    source_harness_native_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    execution_enabled_by_handoff: false,
    write_enabled_by_handoff: false,
    description,
    evidence_ref: `evidence.platform.kernel.cutover.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_handoff",
    hard_gate_ref: `gate.platform.kernel.cutover.handoff.${handoffId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "consume as planning input only until the target program adds human receipt gates",
  }));
}

function buildFreezeRows({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows }) {
  const checks = {
    source_harness_native_cutover_ready: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status === SOURCE_READY_STATUS,
    component_rows_ready: componentRows.length === 6 && componentRows.every((row) => row.component_status === "frozen"),
    assertion_rows_ready: assertionRows.length === 10 && assertionRows.every((row) => row.assertion_status === "frozen"),
    domain_rollout_rows_ready: domainRows.length === 7 && domainRows.every((row) => row.domain_rollout_status === "frozen_no_execution"),
    api_routes_read_only: apiRouteRows.length === 5 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false),
    guard_rows_closed: guardRows.length === 10 && guardRows.every((row) => row.guard_status === "closed" && row.action_allowed_now === false),
    protected_blocks_preserved: sourceHarnessNativeCutover.summary.blocked_claim_count === 20,
    p2041_suspension_declared: true,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "kernel-cutover-freeze-row.v1",
      row_id: `kernel.cutover.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.kernel.cutover.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_kernel_cutover_freeze",
      hard_gate_ref: `gate.platform.kernel.cutover.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P2040 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `kernel_cutover_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, cutoverLedger, freezeLedger, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows }) {
  return {
    schema_version: "kernel-harness-native-cutover-freeze-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    harness_native_cutover_ledger_present: cutoverLedger.available,
    kernel_cutover_freeze_ledger_present: freezeLedger.available,
    source_harness_native_cutover_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    component_count: componentRows.length,
    assertion_count: assertionRows.length,
    domain_rollout_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    handoff_count: handoffRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, cutoverLedger, freezeLedger, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_harness_native_cutover_ready", sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status === SOURCE_READY_STATUS],
    ["harness_native_cutover_ledger_present", cutoverLedger.available && cutoverLedger.text.includes("P1881-P1960")],
    ["kernel_cutover_freeze_ledger_present", freezeLedger.available && ["P1961-P2040", "P1961-P1980", "P2021-P2040", COMMAND_NAME].every((token) => freezeLedger.text.includes(token))],
    ["component_rows_ready", componentRows.length === 6 && componentRows.every((row) => row.current_verdict === "pass")],
    ["assertion_rows_ready", assertionRows.length === 10 && assertionRows.every((row) => row.current_verdict === "pass")],
    ["domain_rows_ready", domainRows.length === 7 && domainRows.every((row) => row.current_verdict === "pass")],
    ["api_routes_read_only", apiRouteRows.length === 5 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["guard_rows_closed", guardRows.length === 10 && guardRows.every((row) => row.action_allowed_now === false)],
    ["handoff_rows_ready", handoffRows.length === 4 && handoffRows.every((row) => row.execution_enabled_by_handoff === false)],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-cutover-gate-row.v1",
    row_id: `kernel.cutover.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.cutover.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_cutover_gate",
    hard_gate_ref: `gate.platform.kernel.cutover.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P2040 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, sourceHarnessNativeCutover }) {
  const passSources = [
    ...componentRows.map((row) => ["component", row.component_id, row]),
    ...assertionRows.map((row) => ["assertion", row.assertion_id, row]),
    ...domainRows.map((row) => ["domain_rollout", row.domain_id, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...guardRows.map((row) => ["guard", row.guard_id, row]),
    ...handoffRows.map((row) => ["handoff", row.handoff_id, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = sourceHarnessNativeCutover.harness_native_claim_rows
    .filter((row) => row.current_verdict === "blocked")
    .map((row) => ["protected_block", row.claim_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-cutover-claim-row.v1",
    row_id: `kernel.cutover.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildManifest({ generatedAt, sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows }) {
  return {
    schema_version: "kernel-cutover-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_harness_native_cutover_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    component_count: componentRows.length,
    assertion_count: assertionRows.length,
    domain_rollout_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    handoff_count: handoffRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    claim_count: claimRows.length,
    platform_kernel_program_complete: true,
    next_allowed_action: "run platform:nous-overlap-audit before any P2041 limited execution work",
  };
}

function buildBoundary({ sourceHarnessNativeCutover, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceHarnessNativeCutover.harness_native_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    assertionRows.some((row) => row.current_verdict !== "pass"),
    domainRows.some((row) => row.protected_action_allowed_now || row.write_action_allowed_now || row.raw_material_access_allowed_now || row.final_authority_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    guardRows.some((row) => row.action_allowed_now),
    handoffRows.some((row) => row.execution_enabled_by_handoff || row.write_enabled_by_handoff),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-cutover-boundary.v1",
    kernel_harness_native_cutover_freeze_ready_for_limited_execution_program: gateRows.every((row) => row.gate_status === "ready") && freezeRows.every((row) => row.current_verdict === "pass"),
    source_harness_native_cutover_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    platform_kernel_program_complete: true,
    p2041_handoff_only: true,
    p2041_suspended_pending_nous_overlap_audit: true,
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

function buildValidationItems({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.harness_native_cutover", "source_ready", sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status === SOURCE_READY_STATUS, "source Harness-native cutover adapter must be ready"),
    validationItem("component.count", "component_rows", componentRows.length === 6, "all cutover component rows must exist"),
    validationItem("assertion.count", "assertion_rows", assertionRows.length === 10, "all cutover assertion rows must exist"),
    validationItem("domain.count", "domain_rows", domainRows.length === 7, "all domain rollout rows must exist"),
    validationItem("api_projection.count", "api_projection_rows", apiRouteRows.length === 5, "all cutover API route rows must exist"),
    validationItem("guard.count", "guard_rows", guardRows.length === 10, "all cutover guard rows must exist"),
    validationItem("handoff.count", "handoff_rows", handoffRows.length === 4, "all handoff rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceHarnessNativeCutover, componentRows, assertionRows, domainRows, apiRouteRows, guardRows, handoffRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-harness-native-cutover-freeze-summary.v1",
    platform_kernel_harness_native_cutover_freeze_status: validation.valid && boundary.kernel_harness_native_cutover_freeze_ready_for_limited_execution_program ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_harness_native_cutover_status: sourceHarnessNativeCutover.summary.platform_harness_native_cutover_adapter_status,
    component_count: componentRows.length,
    assertion_count: assertionRows.length,
    domain_rollout_count: domainRows.length,
    api_route_count: apiRouteRows.length,
    guard_count: guardRows.length,
    handoff_count: handoffRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    platform_kernel_program_complete: boundary.platform_kernel_program_complete,
    p2041_handoff_only: boundary.p2041_handoff_only,
    p2041_suspended_pending_nous_overlap_audit: boundary.p2041_suspended_pending_nous_overlap_audit,
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
    "# Platform Kernel Harness-Native Cutover Freeze",
    "",
    `Status: ${result.summary.platform_kernel_harness_native_cutover_freeze_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source Harness-native cutover status: ${result.summary.source_harness_native_cutover_status}`,
    `Assertions: ${result.summary.assertion_count}`,
    `Domains: ${result.summary.domain_rollout_count}`,
    `Handoffs: ${result.summary.handoff_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `P2041 suspended pending Nous overlap audit: ${result.summary.p2041_suspended_pending_nous_overlap_audit}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Run platform:nous-overlap-audit before any P2041-P2160 limited execution work.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_HARNESS_NATIVE_CUTOVER_FREEZE_INPUTS;
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
    kernel_cutover_freeze_ledger_path: options.kernelCutoverFreezeLedgerPath ?? defaults.kernelCutoverFreezeLedgerPath,
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
    kernelCutoverFreezeLedgerPath: undefined,
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
    } else if (arg === "--kernel-cutover-freeze-ledger") {
      args.kernelCutoverFreezeLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-harness-native-cutover-freeze.mjs [options]

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
  --kernel-cutover-freeze-ledger <path>
  --help                          Show this help.
`);
}
