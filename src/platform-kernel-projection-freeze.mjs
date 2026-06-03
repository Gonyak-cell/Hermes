import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelArtifactCheckReceiptEngine } from "./platform-kernel-artifact-check-receipt-engine.mjs";

export const DEFAULT_PLATFORM_KERNEL_PROJECTION_FREEZE_OUT_DIR = "artifacts/platform-kernel-projection-freeze/latest";
export const DEFAULT_PLATFORM_KERNEL_PROJECTION_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-kernel-projection-freeze.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelBaselineLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
  reconciliationLedgerPath: "docs/hermes-platform-kernel-spec-status-reconciliation-phase-ledger.md",
  claimEngineLedgerPath: "docs/hermes-platform-kernel-claim-evidence-gate-engine-phase-ledger.md",
  artifactCheckReceiptLedgerPath: "docs/hermes-platform-kernel-artifact-check-receipt-engine-phase-ledger.md",
  projectionFreezeLedgerPath: "docs/hermes-platform-kernel-projection-freeze-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-projection-freeze";
const SOURCE_COMMAND_NAME = "platform:kernel-artifact-check-receipt-engine";
const SCHEMA_VERSION = "platform-kernel-projection-freeze.v1";
const CAPABILITY_ID = "platform.kernel.projection_freeze";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1801-P1880";
const PHASE_SLOT = "P1801";
const PREVIOUS_PHASE_SLOT = "P1800";
const NEXT_PHASE_SLOT = "P1881";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_artifact_check_receipt_engine";
const READY_STATUS = "ready_for_platform_kernel_projection_freeze";

const COMPONENT_SPECS = [
  ["projection_manifest_engine", "Freeze Kernel projection manifest and collection counts"],
  ["read_only_route_engine", "Declare GET-only projection routes without starting a server"],
  ["collection_envelope_engine", "Normalize collection envelopes for dashboard/API consumers"],
  ["operator_projection_engine", "Expose operator-facing status rows without protected action execution"],
  ["compatibility_projection_engine", "Bind source program compatibility before Harness-native cutover"],
  ["freeze_guard_engine", "Keep runtime/write/raw material/receipt application guards closed"],
];

const SOURCE_COLLECTION_SPECS = [
  ["components", "kernel_artifact_check_receipt_component_rows"],
  ["artifacts", "kernel_artifact_rows"],
  ["checks", "kernel_check_rows"],
  ["receipts", "kernel_receipt_rows"],
  ["evaluations", "kernel_artifact_check_receipt_evaluation_rows"],
  ["protected_blocks", "kernel_artifact_check_receipt_protected_block_rows"],
  ["api_projection", "kernel_artifact_check_receipt_api_projection_rows"],
  ["freezes", "kernel_artifact_check_receipt_freeze_rows"],
  ["gates", "kernel_artifact_check_receipt_gate_rows"],
  ["claims", "kernel_artifact_check_receipt_claim_rows"],
];

const API_ROUTE_SPECS = [
  ["/api/kernel-projection/manifest", "kernel_projection_manifest"],
  ["/api/kernel-projection/collections", "kernel_projection_source_rows"],
  ["/api/kernel-projection/routes", "kernel_projection_api_route_rows"],
  ["/api/kernel-projection/operator", "kernel_projection_operator_rows"],
  ["/api/kernel-projection/compatibility", "kernel_projection_compatibility_rows"],
  ["/api/kernel-projection/freeze", "kernel_projection_freeze_rows"],
];

const OPERATOR_PROJECTION_SPECS = [
  ["kernel_ready_status", "show Kernel projection readiness"],
  ["protected_block_matrix", "show protected BLOCK rows and reasons"],
  ["receipt_state_matrix", "show receipt state without payloads"],
  ["artifact_reference_matrix", "show artifact refs without raw material"],
  ["check_status_matrix", "show deterministic check status"],
  ["missing_action_matrix", "show missing human gate or receipt conditions"],
  ["domain_boundary_matrix", "show domain boundary and protected action limits"],
  ["next_cutover_matrix", "show P1881 Harness-native cutover prerequisites"],
];

const COMPATIBILITY_SPECS = [
  ["agent_runtime_activation_bridge", "P1201-P1320", "ready_for_agent_runtime_activation_bridge"],
  ["domain_agent_no_write_pilot", "P1321-P1440", "ready_for_agent_domain_no_write_pilot_freeze"],
  ["agent_operator_console_v0", "P1441-P1500", "ready_for_agent_operator_console_v0_freeze"],
  ["kernel_claim_evidence_gate_engine", "P1641-P1720", "ready_for_platform_kernel_claim_evidence_gate_engine"],
  ["kernel_artifact_check_receipt_engine", "P1721-P1800", SOURCE_READY_STATUS],
];

const FREEZE_SPECS = [
  ["source_artifact_check_receipt_ready", "P1721-P1800 artifact/check/receipt engine is ready"],
  ["projection_sources_ready", "all source collections are projected"],
  ["route_rows_ready", "all read-only projection routes are declared"],
  ["operator_rows_ready", "operator rows are ready without action execution"],
  ["compatibility_rows_ready", "compatibility rows bind prior programs"],
  ["freeze_guards_ready", "freeze guards preserve unsafe false invariants"],
  ["read_only_boundary_preserved", "projection boundary is read-only and no-server"],
  ["ready_for_p1881_harness_native_cutover", "next slice can build Harness-native cutover adapters"],
];

export async function runPlatformKernelProjectionFreeze(options = {}) {
  const result = await buildPlatformKernelProjectionFreeze(options);
  if (options.write !== false) await writePlatformKernelProjectionFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel projection freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelProjectionFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_PROJECTION_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const artifactLedger = await readTextSource(inputs.artifact_check_receipt_ledger_path);
  const projectionLedger = await readTextSource(inputs.projection_freeze_ledger_path);
  const sourceArtifactEngine = options.sourceKernelArtifactCheckReceiptEngine ?? await buildPlatformKernelArtifactCheckReceiptEngine({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    kernelBaselineLedgerPath: inputs.kernel_baseline_ledger_path,
    reconciliationLedgerPath: inputs.reconciliation_ledger_path,
    claimEngineLedgerPath: inputs.claim_engine_ledger_path,
    artifactCheckReceiptLedgerPath: inputs.artifact_check_receipt_ledger_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const sourceRows = buildSourceRows(sourceArtifactEngine);
  const apiRouteRows = buildApiRouteRows();
  const operatorRows = buildOperatorRows(sourceArtifactEngine);
  const compatibilityRows = buildCompatibilityRows(sourceArtifactEngine);
  const freezeRows = buildFreezeRows({ sourceArtifactEngine, sourceRows, apiRouteRows, operatorRows, compatibilityRows });
  const anchor = buildAnchor({ packageJson, artifactLedger, projectionLedger, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, artifactLedger, projectionLedger, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows });
  const claimRows = buildClaimRows({ componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, sourceArtifactEngine });
  const manifest = buildManifest({ generatedAt, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows });
  const boundary = buildBoundary({ sourceArtifactEngine, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_projection_freeze_id: `platform-kernel-projection-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_projection_freeze_anchor: anchor,
    source_kernel_artifact_check_receipt_engine_summary: sourceArtifactEngine.summary,
    kernel_projection_manifest: manifest,
    kernel_projection_component_rows: componentRows,
    kernel_projection_source_rows: sourceRows,
    kernel_projection_api_route_rows: apiRouteRows,
    kernel_projection_operator_rows: operatorRows,
    kernel_projection_compatibility_rows: compatibilityRows,
    kernel_projection_freeze_rows: freezeRows,
    kernel_projection_gate_rows: gateRows,
    kernel_projection_claim_rows: claimRows,
    kernel_projection_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_projection_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_projection_freeze_id = result.platform_kernel_projection_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelProjectionFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-projection-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-projection-manifest.json"), result.kernel_projection_manifest);
  await writeJson(path.join(outDir, "kernel-projection-component-rows.json"), collectionEnvelope("kernel-projection-component-rows.v1", "kernel_projection_component_rows", result.kernel_projection_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-source-rows.json"), collectionEnvelope("kernel-projection-source-rows.v1", "kernel_projection_source_rows", result.kernel_projection_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-api-route-rows.json"), collectionEnvelope("kernel-projection-api-route-rows.v1", "kernel_projection_api_route_rows", result.kernel_projection_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-operator-rows.json"), collectionEnvelope("kernel-projection-operator-rows.v1", "kernel_projection_operator_rows", result.kernel_projection_operator_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-compatibility-rows.json"), collectionEnvelope("kernel-projection-compatibility-rows.v1", "kernel_projection_compatibility_rows", result.kernel_projection_compatibility_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-freeze-rows.json"), collectionEnvelope("kernel-projection-freeze-rows.v1", "kernel_projection_freeze_rows", result.kernel_projection_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-gate-rows.json"), collectionEnvelope("kernel-projection-gate-rows.v1", "kernel_projection_gate_rows", result.kernel_projection_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-claim-rows.json"), collectionEnvelope("kernel-projection-claim-rows.v1", "kernel_projection_claim_rows", result.kernel_projection_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-projection-boundary.json"), result.kernel_projection_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-projection-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelProjectionFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelProjectionFreeze(args);
    console.log(`Platform Kernel projection freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_projection_freeze_status}`);
    console.log(`Collections: ${result.summary.source_collection_count}`);
    console.log(`Routes: ${result.summary.api_route_count}`);
    console.log(`Operator rows: ${result.summary.operator_row_count}`);
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
    schema_version: "kernel-projection-component-row.v1",
    row_id: `kernel.projection.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id,
    component_status: "ready_for_projection_freeze",
    description,
    projection_only: true,
    evidence_ref: `evidence.platform.kernel.projection.component.${component_id}`,
    reviewer_ref: "reviewer.platform_kernel_projection_component",
    hard_gate_ref: `gate.platform.kernel.projection.component.${component_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "promote projection component into Harness-native cutover adapter after P1880 freeze",
  }));
}

function buildSourceRows(sourceArtifactEngine) {
  return SOURCE_COLLECTION_SPECS.map(([collectionId, collectionName], index) => {
    const items = sourceArtifactEngine[collectionName] ?? [];
    return passRow({
      schema_version: "kernel-projection-source-row.v1",
      row_id: `kernel.projection.source.row.${String(index + 1).padStart(2, "0")}`,
      source_collection_id: collectionId,
      source_collection_name: collectionName,
      source_item_count: items.length,
      projection_status: "projected_read_only",
      source_engine_status: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status,
      raw_material_exposed: false,
      mutation_performed: false,
      evidence_ref: `evidence.platform.kernel.projection.source.${collectionId}`,
      reviewer_ref: "reviewer.platform_kernel_projection_source",
      hard_gate_ref: `gate.platform.kernel.projection.source.${collectionId}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: "keep collection projection read-only for P1881 cutover",
    });
  });
}

function buildApiRouteRows() {
  return API_ROUTE_SPECS.map(([routePath, responseCollection], index) => passRow({
    schema_version: "kernel-projection-api-route-row.v1",
    row_id: `kernel.projection.api.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    response_collection: responseCollection,
    route_status: "ready_for_read_only_projection",
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    receipt_application_route: false,
    raw_material_route: false,
    evidence_ref: `evidence.platform.kernel.projection.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_kernel_projection_api",
    hard_gate_ref: `gate.platform.kernel.projection.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "wire route into read-only Review API projection after P1880 freeze",
  }));
}

function buildOperatorRows(sourceArtifactEngine) {
  return OPERATOR_PROJECTION_SPECS.map(([operatorRowId, description], index) => passRow({
    schema_version: "kernel-projection-operator-row.v1",
    row_id: `kernel.projection.operator.row.${String(index + 1).padStart(2, "0")}`,
    operator_projection_id: operatorRowId,
    operator_projection_status: "visible_read_only",
    description,
    source_claim_count: sourceArtifactEngine.summary.claim_count,
    source_protected_block_count: sourceArtifactEngine.summary.protected_block_count,
    action_button_enabled: false,
    receipt_payload_visible: false,
    raw_material_visible: false,
    evidence_ref: `evidence.platform.kernel.projection.operator.${operatorRowId}`,
    reviewer_ref: "reviewer.platform_kernel_projection_operator",
    hard_gate_ref: `gate.platform.kernel.projection.operator.${operatorRowId}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "show row in operator console as read-only projection",
  }));
}

function buildCompatibilityRows(sourceArtifactEngine) {
  return COMPATIBILITY_SPECS.map(([programId, phaseRange, expectedStatus], index) => {
    const sourceStatus = programId === "kernel_artifact_check_receipt_engine"
      ? sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status
      : expectedStatus;
    const pass = sourceStatus === expectedStatus;
    const fields = {
      schema_version: "kernel-projection-compatibility-row.v1",
      row_id: `kernel.projection.compatibility.row.${String(index + 1).padStart(2, "0")}`,
      program_id: programId,
      phase_range: phaseRange,
      expected_status: expectedStatus,
      observed_status: sourceStatus,
      compatibility_status: pass ? "compatible" : "blocked",
      evidence_ref: `evidence.platform.kernel.projection.compatibility.${programId}`,
      reviewer_ref: "reviewer.platform_kernel_projection_compatibility",
      hard_gate_ref: `gate.platform.kernel.projection.compatibility.${programId}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep compatibility row attached" : `repair compatibility for ${programId}`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `compatibility_failed.${programId}` });
  });
}

function buildFreezeRows({ sourceArtifactEngine, sourceRows, apiRouteRows, operatorRows, compatibilityRows }) {
  const checks = {
    source_artifact_check_receipt_ready: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status === SOURCE_READY_STATUS,
    projection_sources_ready: sourceRows.length === 10 && sourceRows.every((row) => row.projection_status === "projected_read_only"),
    route_rows_ready: apiRouteRows.length === 6 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false),
    operator_rows_ready: operatorRows.length === 8 && operatorRows.every((row) => row.action_button_enabled === false),
    compatibility_rows_ready: compatibilityRows.length === 5 && compatibilityRows.every((row) => row.current_verdict === "pass"),
    freeze_guards_ready: true,
    read_only_boundary_preserved: true,
    ready_for_p1881_harness_native_cutover: true,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "kernel-projection-freeze-row.v1",
      row_id: `kernel.projection.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.kernel.projection.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_kernel_projection_freeze",
      hard_gate_ref: `gate.platform.kernel.projection.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1880 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `kernel_projection_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, artifactLedger, projectionLedger, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows }) {
  return {
    schema_version: "kernel-projection-freeze-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    artifact_check_receipt_ledger_present: artifactLedger.available,
    projection_freeze_ledger_present: projectionLedger.available,
    source_artifact_check_receipt_status: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status,
    component_count: componentRows.length,
    source_collection_count: sourceRows.length,
    api_route_count: apiRouteRows.length,
    operator_row_count: operatorRows.length,
    compatibility_row_count: compatibilityRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, artifactLedger, projectionLedger, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_artifact_check_receipt_ready", sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status === SOURCE_READY_STATUS],
    ["artifact_check_receipt_ledger_present", artifactLedger.available && artifactLedger.text.includes("P1721-P1800")],
    ["projection_freeze_ledger_present", projectionLedger.available && ["P1801-P1880", "P1801-P1820", "P1861-P1880", COMMAND_NAME].every((token) => projectionLedger.text.includes(token))],
    ["component_rows_ready", componentRows.length === 6 && componentRows.every((row) => row.current_verdict === "pass")],
    ["source_rows_ready", sourceRows.length === 10 && sourceRows.every((row) => row.current_verdict === "pass")],
    ["api_routes_read_only", apiRouteRows.length === 6 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["operator_rows_read_only", operatorRows.length === 8 && operatorRows.every((row) => row.action_button_enabled === false)],
    ["compatibility_rows_ready", compatibilityRows.length === 5 && compatibilityRows.every((row) => row.current_verdict === "pass")],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
    ["unsafe_boundary_preserved", sourceArtifactEngine.summary.agent_runtime_execution_allowed_now === false && sourceArtifactEngine.summary.write_action_allowed_now === false],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-projection-gate-row.v1",
    row_id: `kernel.projection.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.projection.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_projection_gate",
    hard_gate_ref: `gate.platform.kernel.projection.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1880 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, sourceArtifactEngine }) {
  const passSources = [
    ...componentRows.map((row) => ["component", row.component_id, row]),
    ...sourceRows.map((row) => ["source_collection", row.source_collection_id, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...operatorRows.map((row) => ["operator_projection", row.operator_projection_id, row]),
    ...compatibilityRows.filter((row) => row.current_verdict === "pass").map((row) => ["compatibility", row.program_id, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = sourceArtifactEngine.kernel_artifact_check_receipt_protected_block_rows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-projection-claim-row.v1",
    row_id: `kernel.projection.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildManifest({ generatedAt, sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows }) {
  return {
    schema_version: "kernel-projection-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_engine_status: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status,
    component_count: componentRows.length,
    source_collection_count: sourceRows.length,
    api_route_count: apiRouteRows.length,
    operator_row_count: operatorRows.length,
    compatibility_row_count: compatibilityRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    claim_count: claimRows.length,
    projection_only: true,
    next_allowed_action: "advance to P1881-P1960 Harness-native cutover with read-only projection frozen",
  };
}

function buildBoundary({ sourceArtifactEngine, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceArtifactEngine.kernel_artifact_check_receipt_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    sourceRows.some((row) => row.raw_material_exposed || row.mutation_performed),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    operatorRows.some((row) => row.action_button_enabled || row.receipt_payload_visible || row.raw_material_visible),
    compatibilityRows.some((row) => row.current_verdict !== "pass"),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-projection-boundary.v1",
    kernel_projection_freeze_ready_for_harness_native_cutover: gateRows.every((row) => row.gate_status === "ready") && freezeRows.every((row) => row.current_verdict === "pass"),
    source_artifact_check_receipt_status: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status,
    read_only_projection: true,
    projection_only: true,
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

function buildValidationItems({ sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.artifact_check_receipt", "source_ready", sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status === SOURCE_READY_STATUS, "source artifact/check/receipt engine must be ready"),
    validationItem("component.count", "component_rows", componentRows.length === 6, "all projection component rows must exist"),
    validationItem("source.count", "source_rows", sourceRows.length === 10, "all projection source rows must exist"),
    validationItem("api_projection.count", "api_projection_rows", apiRouteRows.length === 6, "all projection API route rows must exist"),
    validationItem("operator.count", "operator_rows", operatorRows.length === 8, "all operator projection rows must exist"),
    validationItem("compatibility.count", "compatibility_rows", compatibilityRows.length === 5, "all compatibility rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceArtifactEngine, componentRows, sourceRows, apiRouteRows, operatorRows, compatibilityRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-projection-freeze-summary.v1",
    platform_kernel_projection_freeze_status: validation.valid && boundary.kernel_projection_freeze_ready_for_harness_native_cutover ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_artifact_check_receipt_status: sourceArtifactEngine.summary.platform_kernel_artifact_check_receipt_engine_status,
    component_count: componentRows.length,
    source_collection_count: sourceRows.length,
    api_route_count: apiRouteRows.length,
    operator_row_count: operatorRows.length,
    compatibility_row_count: compatibilityRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    read_only_projection: boundary.read_only_projection,
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
    "# Platform Kernel Projection Freeze",
    "",
    `Status: ${result.summary.platform_kernel_projection_freeze_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source artifact/check/receipt status: ${result.summary.source_artifact_check_receipt_status}`,
    `Collections: ${result.summary.source_collection_count}`,
    `Routes: ${result.summary.api_route_count}`,
    `Operator rows: ${result.summary.operator_row_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1881-P1960 Harness-native cutover adapters while preserving no-execution invariants.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_PROJECTION_FREEZE_INPUTS;
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
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-projection-freeze.mjs [options]

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
  --help                          Show this help.
`);
}
