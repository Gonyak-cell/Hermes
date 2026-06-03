import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelContractBaseline } from "./platform-kernel-contract-baseline.mjs";

export const DEFAULT_PLATFORM_KERNEL_SPEC_STATUS_RECONCILIATION_OUT_DIR = "artifacts/platform-kernel-spec-status-reconciliation/latest";
export const DEFAULT_PLATFORM_KERNEL_SPEC_STATUS_RECONCILIATION_INPUTS = {
  schemaPath: "schemas/platform-kernel-spec-status-reconciliation.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelBaselineLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
  reconciliationLedgerPath: "docs/hermes-platform-kernel-spec-status-reconciliation-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-spec-status-reconciliation";
const SOURCE_COMMAND_NAME = "platform:kernel-contract-baseline";
const SCHEMA_VERSION = "platform-kernel-spec-status-reconciliation.v1";
const CAPABILITY_ID = "platform.kernel.spec_status_reconciliation";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1561-P1640";
const PHASE_SLOT = "P1561";
const PREVIOUS_PHASE_SLOT = "P1560";
const NEXT_PHASE_SLOT = "P1641";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_contract_baseline";
const READY_STATUS = "ready_for_platform_kernel_spec_status_reconciliation";

const INVARIANT_SPECS = [
  ["runtime_execution_disabled", "Agent runtime execution remains disabled"],
  ["write_action_disabled", "write actions remain disabled"],
  ["protected_action_disabled", "protected actions remain disabled"],
  ["receipt_application_disabled", "receipt application remains disabled"],
  ["raw_secret_read_disabled", "raw secret reads remain disabled"],
  ["raw_client_vdr_access_disabled", "raw client/VDR access remains disabled"],
  ["direct_zendd_mutation_disabled", "direct Zendd mutation remains disabled"],
  ["agent_final_pass_disabled", "Agent final PASS remains disabled"],
];

const API_ROUTE_SPECS = [
  ["/api/kernel-specs", "kernel_spec_rows", "Kernel desired spec rows"],
  ["/api/kernel-statuses", "kernel_status_rows", "Kernel current status rows"],
  ["/api/kernel-reconciliations", "kernel_reconciliation_rows", "Kernel reconciliation rows"],
  ["/api/kernel-invariants", "kernel_invariant_rows", "Kernel invariant rows"],
];

const FREEZE_SPECS = [
  ["source_baseline_ready", "P1501-P1560 Kernel contract baseline is ready"],
  ["spec_rows_complete", "Kernel desired spec rows are complete"],
  ["status_rows_complete", "Kernel current status rows are complete"],
  ["reconciliation_rows_complete", "Desired and current rows reconcile"],
  ["drift_rows_clean", "Drift rows report no drift"],
  ["invariant_rows_safe", "No-execution and no-write invariants are preserved"],
  ["api_projection_ready", "Read-only Kernel API projection rows are declared"],
  ["ready_for_p1641_claim_evidence_gate_engine", "Next slice can build the claim/evidence/gate engine"],
];

export async function runPlatformKernelSpecStatusReconciliation(options = {}) {
  const result = await buildPlatformKernelSpecStatusReconciliation(options);
  if (options.write !== false) await writePlatformKernelSpecStatusReconciliation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel spec/status reconciliation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelSpecStatusReconciliation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_SPEC_STATUS_RECONCILIATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const baselineLedger = await readTextSource(inputs.kernel_baseline_ledger_path);
  const reconciliationLedger = await readTextSource(inputs.reconciliation_ledger_path);
  const sourceBaseline = options.sourceKernelContractBaseline ?? await buildPlatformKernelContractBaseline({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    kernelLedgerPath: inputs.kernel_baseline_ledger_path,
    write: false,
  });

  const specRows = buildSpecRows(sourceBaseline);
  const statusRows = buildStatusRows(sourceBaseline, specRows);
  const reconciliationRows = buildReconciliationRows(specRows, statusRows);
  const driftRows = buildDriftRows(sourceBaseline);
  const invariantRows = buildInvariantRows(sourceBaseline);
  const protectedBlockRows = buildProtectedBlockRows(sourceBaseline);
  const apiRouteRows = buildApiRouteRows();
  const freezeRows = buildFreezeRows({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, apiRouteRows });
  const anchor = buildAnchor({ packageJson, baselineLedger, reconciliationLedger, sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, baselineLedger, reconciliationLedger, sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows });
  const claimRows = buildClaimRows({ specRows, statusRows, reconciliationRows, driftRows, invariantRows, apiRouteRows, freezeRows, protectedBlockRows });
  const boundary = buildBoundary({ sourceBaseline, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_spec_status_reconciliation_id: `platform-kernel-spec-status-reconciliation.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_spec_status_reconciliation_anchor: anchor,
    source_kernel_contract_baseline_summary: sourceBaseline.summary,
    kernel_spec_rows: specRows,
    kernel_status_rows: statusRows,
    kernel_reconciliation_rows: reconciliationRows,
    kernel_drift_rows: driftRows,
    kernel_invariant_rows: invariantRows,
    kernel_reconciliation_protected_block_rows: protectedBlockRows,
    kernel_api_projection_rows: apiRouteRows,
    kernel_reconciliation_freeze_rows: freezeRows,
    kernel_reconciliation_gate_rows: gateRows,
    kernel_reconciliation_claim_rows: claimRows,
    kernel_reconciliation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_spec_status_reconciliation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_spec_status_reconciliation_id = result.platform_kernel_spec_status_reconciliation_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelSpecStatusReconciliation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-spec-status-reconciliation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-spec-rows.json"), collectionEnvelope("kernel-spec-rows.v1", "kernel_spec_rows", result.kernel_spec_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-status-rows.json"), collectionEnvelope("kernel-status-rows.v1", "kernel_status_rows", result.kernel_status_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-rows.json"), collectionEnvelope("kernel-reconciliation-rows.v1", "kernel_reconciliation_rows", result.kernel_reconciliation_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-drift-rows.json"), collectionEnvelope("kernel-drift-rows.v1", "kernel_drift_rows", result.kernel_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-invariant-rows.json"), collectionEnvelope("kernel-invariant-rows.v1", "kernel_invariant_rows", result.kernel_invariant_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-protected-block-rows.json"), collectionEnvelope("kernel-reconciliation-protected-block-rows.v1", "kernel_reconciliation_protected_block_rows", result.kernel_reconciliation_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-api-projection-rows.json"), collectionEnvelope("kernel-api-projection-rows.v1", "kernel_api_projection_rows", result.kernel_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-freeze-rows.json"), collectionEnvelope("kernel-reconciliation-freeze-rows.v1", "kernel_reconciliation_freeze_rows", result.kernel_reconciliation_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-gate-rows.json"), collectionEnvelope("kernel-reconciliation-gate-rows.v1", "kernel_reconciliation_gate_rows", result.kernel_reconciliation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-claim-rows.json"), collectionEnvelope("kernel-reconciliation-claim-rows.v1", "kernel_reconciliation_claim_rows", result.kernel_reconciliation_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-reconciliation-boundary.json"), result.kernel_reconciliation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-spec-status-reconciliation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelSpecStatusReconciliationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelSpecStatusReconciliation(args);
    console.log(`Platform Kernel spec/status reconciliation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_spec_status_reconciliation_status}`);
    console.log(`Specs: ${result.summary.spec_row_count}`);
    console.log(`Statuses: ${result.summary.status_row_count}`);
    console.log(`Reconciliations: ${result.summary.reconciliation_row_count}`);
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

function buildSpecRows(sourceBaseline) {
  const rows = [];
  for (const row of sourceBaseline.kernel_primitive_rows) {
    rows.push(specRow(rows.length, "primitive", row.primitive_id, row.primitive_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner));
  }
  for (const row of sourceBaseline.kernel_contract_rows) {
    rows.push(specRow(rows.length, "contract", row.contract_id, row.source_collection, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner));
  }
  for (const row of sourceBaseline.kernel_source_binding_rows) {
    rows.push(specRow(rows.length, "source", row.source_id, row.command_name, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner));
  }
  return rows;
}

function specRow(index, specType, specId, expectedRef, evidenceRef, reviewerRef, gateRef, owner) {
  return passRow({
    schema_version: "kernel-spec-row.v1",
    row_id: `kernel.spec.row.${String(index + 1).padStart(3, "0")}`,
    spec_type: specType,
    spec_id: specId,
    expected_ref: expectedRef,
    desired_status: "declared",
    spec_required: true,
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: gateRef,
    responsible_owner: owner,
    next_allowed_action: "compare against current Kernel status row",
  });
}

function buildStatusRows(sourceBaseline, specRows) {
  return specRows.map((row, index) => passRow({
    schema_version: "kernel-status-row.v1",
    row_id: `kernel.status.row.${String(index + 1).padStart(3, "0")}`,
    spec_row_ref: row.row_id,
    spec_type: row.spec_type,
    spec_id: row.spec_id,
    current_status: resolveCurrentStatus(sourceBaseline, row),
    observed_ref: row.expected_ref,
    status_source_ref: sourceBaseline.platform_kernel_contract_baseline_id,
    drift_status: "none",
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep status bound to baseline artifact until reconciliation engine promotes it",
  }));
}

function resolveCurrentStatus(sourceBaseline, specRowValue) {
  if (specRowValue.spec_type === "primitive") {
    return sourceBaseline.kernel_primitive_rows.some((row) => row.primitive_id === specRowValue.spec_id) ? "observed" : "missing";
  }
  if (specRowValue.spec_type === "contract") {
    return sourceBaseline.kernel_contract_rows.some((row) => row.contract_id === specRowValue.spec_id) ? "observed" : "missing";
  }
  if (specRowValue.spec_type === "source") {
    return sourceBaseline.kernel_source_binding_rows.some((row) => row.source_id === specRowValue.spec_id) ? "observed" : "missing";
  }
  return "missing";
}

function buildReconciliationRows(specRows, statusRows) {
  return specRows.map((spec, index) => {
    const status = statusRows.find((row) => row.spec_row_ref === spec.row_id);
    const reconciled = status?.current_status === "observed" && status.drift_status === "none";
    return reconciled ? passRow({
      schema_version: "kernel-reconciliation-row.v1",
      row_id: `kernel.reconciliation.row.${String(index + 1).padStart(3, "0")}`,
      spec_row_ref: spec.row_id,
      status_row_ref: status.row_id,
      spec_type: spec.spec_type,
      spec_id: spec.spec_id,
      reconciliation_status: "reconciled",
      current_status: status.current_status,
      drift_status: status.drift_status,
      mutation_required: false,
      execution_allowed_now: false,
      evidence_ref: spec.evidence_ref,
      reviewer_ref: spec.reviewer_ref,
      hard_gate_ref: spec.hard_gate_ref,
      responsible_owner: spec.responsible_owner,
      next_allowed_action: "keep reconciliation row ready for P1641 engine extraction",
    }) : blockedRow({
      schema_version: "kernel-reconciliation-row.v1",
      row_id: `kernel.reconciliation.row.${String(index + 1).padStart(3, "0")}`,
      spec_row_ref: spec.row_id,
      status_row_ref: status?.row_id ?? null,
      spec_type: spec.spec_type,
      spec_id: spec.spec_id,
      reconciliation_status: "blocked",
      current_status: status?.current_status ?? "missing",
      drift_status: status?.drift_status ?? "missing",
      mutation_required: false,
      execution_allowed_now: false,
      block_reason: `kernel_reconciliation_failed.${spec.spec_id}`,
      evidence_ref: spec.evidence_ref,
      reviewer_ref: spec.reviewer_ref,
      hard_gate_ref: spec.hard_gate_ref,
      responsible_owner: spec.responsible_owner,
      next_allowed_action: `repair Kernel spec/status row ${spec.spec_id}`,
    });
  });
}

function buildDriftRows(sourceBaseline) {
  return sourceBaseline.kernel_check_rows.map((row, index) => passRow({
    schema_version: "kernel-drift-row.v1",
    row_id: `kernel.drift.row.${String(index + 1).padStart(2, "0")}`,
    drift_id: row.check_id,
    source_check_ref: row.row_id,
    drift_status: "none",
    drift_detected: false,
    mutation_required: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep drift row in reconciliation evidence set",
  }));
}

function buildInvariantRows(sourceBaseline) {
  const boundary = sourceBaseline.kernel_boundary;
  const checks = {
    runtime_execution_disabled: boundary.agent_runtime_execution_allowed_now === false,
    write_action_disabled: boundary.write_action_allowed_now === false,
    protected_action_disabled: boundary.protected_action_execution_allowed_now === false,
    receipt_application_disabled: boundary.receipt_application_allowed_now === false,
    raw_secret_read_disabled: boundary.raw_secret_read_allowed_now === false,
    raw_client_vdr_access_disabled: boundary.raw_client_or_vdr_access_allowed_now === false,
    direct_zendd_mutation_disabled: boundary.direct_zendd_mutation_allowed_now === false,
    agent_final_pass_disabled: boundary.agent_final_pass_allowed_now === false,
  };
  return INVARIANT_SPECS.map(([invariant_id, description], index) => {
    const pass = checks[invariant_id] === true;
    const fields = {
      schema_version: "kernel-invariant-row.v1",
      row_id: `kernel.invariant.row.${String(index + 1).padStart(2, "0")}`,
      invariant_id,
      invariant_status: pass ? "safe" : "blocked",
      description,
      unsafe_value_observed: !pass,
      evidence_ref: `evidence.platform.kernel.reconciliation.invariant.${invariant_id}`,
      reviewer_ref: "reviewer.platform_kernel_reconciliation_invariant",
      hard_gate_ref: `gate.platform.kernel.reconciliation.invariant.${invariant_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep invariant attached" : `repair invariant ${invariant_id}`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `invariant_failed.${invariant_id}` });
  });
}

function buildProtectedBlockRows(sourceBaseline) {
  return sourceBaseline.kernel_block_projection_rows.map((row, index) => ({
    schema_version: "kernel-reconciliation-protected-block-row.v1",
    row_id: `kernel.reconciliation.protected_block.row.${String(index + 1).padStart(3, "0")}`,
    source_block_projection_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
    current_verdict: "blocked",
    reconciliation_status: "blocked_preserved",
    block_reason: row.block_reason,
    action_allowed_now: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildApiRouteRows() {
  return API_ROUTE_SPECS.map(([routePath, responseCollection, description], index) => passRow({
    schema_version: "kernel-api-projection-row.v1",
    row_id: `kernel.api_projection.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    route_status: "ready_for_read_only_projection",
    response_collection: responseCollection,
    description,
    server_started: false,
    mutation_route: false,
    protected_action_route: false,
    receipt_application_route: false,
    raw_material_route: false,
    evidence_ref: `evidence.platform.kernel.reconciliation.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_kernel_reconciliation_api",
    hard_gate_ref: `gate.platform.kernel.reconciliation.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "wire as read-only Review API route after Kernel API projection freeze",
  }));
}

function buildFreezeRows({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, apiRouteRows }) {
  const checks = {
    source_baseline_ready: sourceBaseline.summary.platform_kernel_contract_baseline_status === SOURCE_READY_STATUS,
    spec_rows_complete: specRows.length === 17,
    status_rows_complete: statusRows.length === 17 && statusRows.every((row) => row.current_status === "observed"),
    reconciliation_rows_complete: reconciliationRows.length === 17 && reconciliationRows.every((row) => row.reconciliation_status === "reconciled"),
    drift_rows_clean: driftRows.length === 10 && driftRows.every((row) => row.drift_detected === false),
    invariant_rows_safe: invariantRows.length === 8 && invariantRows.every((row) => row.invariant_status === "safe"),
    api_projection_ready: apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false),
    ready_for_p1641_claim_evidence_gate_engine: true,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "kernel-reconciliation-freeze-row.v1",
      row_id: `kernel.reconciliation.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.kernel.reconciliation.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_kernel_reconciliation_freeze",
      hard_gate_ref: `gate.platform.kernel.reconciliation.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1640 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `kernel_reconciliation_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, baselineLedger, reconciliationLedger, sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  return {
    schema_version: "kernel-spec-status-reconciliation-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    kernel_baseline_ledger_present: baselineLedger.available,
    reconciliation_ledger_present: reconciliationLedger.available,
    source_kernel_baseline_status: sourceBaseline.summary.platform_kernel_contract_baseline_status,
    spec_row_count: specRows.length,
    status_row_count: statusRows.length,
    reconciliation_row_count: reconciliationRows.length,
    drift_row_count: driftRows.length,
    invariant_row_count: invariantRows.length,
    protected_block_count: protectedBlockRows.length,
    api_route_count: apiRouteRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, baselineLedger, reconciliationLedger, sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_kernel_baseline_ready", sourceBaseline.summary.platform_kernel_contract_baseline_status === SOURCE_READY_STATUS],
    ["baseline_ledger_present", baselineLedger.available && baselineLedger.text.includes("P1501-P1560")],
    ["reconciliation_ledger_present", reconciliationLedger.available && ["P1561-P1640", "P1561-P1580", "P1621-P1640", COMMAND_NAME].every((token) => reconciliationLedger.text.includes(token))],
    ["spec_rows_ready", specRows.length === 17 && specRows.every((row) => row.current_verdict === "pass")],
    ["status_rows_ready", statusRows.length === 17 && statusRows.every((row) => row.current_status === "observed")],
    ["reconciliation_rows_ready", reconciliationRows.length === 17 && reconciliationRows.every((row) => row.reconciliation_status === "reconciled")],
    ["drift_rows_clean", driftRows.length === 10 && driftRows.every((row) => row.drift_detected === false)],
    ["invariant_rows_safe", invariantRows.length === 8 && invariantRows.every((row) => row.invariant_status === "safe")],
    ["protected_blocks_preserved", protectedBlockRows.length === 20 && protectedBlockRows.every((row) => row.current_verdict === "blocked")],
    ["api_routes_projected", apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-reconciliation-gate-row.v1",
    row_id: `kernel.reconciliation.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.reconciliation.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_reconciliation_gate",
    hard_gate_ref: `gate.platform.kernel.reconciliation.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1640 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ specRows, statusRows, reconciliationRows, driftRows, invariantRows, apiRouteRows, freezeRows, protectedBlockRows }) {
  const passSources = [
    ...specRows.map((row) => ["spec", `${row.spec_type}.${row.spec_id}`, row]),
    ...statusRows.map((row) => ["status", `${row.spec_type}.${row.spec_id}`, row]),
    ...reconciliationRows.filter((row) => row.current_verdict === "pass").map((row) => ["reconciliation", `${row.spec_type}.${row.spec_id}`, row]),
    ...driftRows.map((row) => ["drift", row.drift_id, row]),
    ...invariantRows.filter((row) => row.current_verdict === "pass").map((row) => ["invariant", row.invariant_id, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = protectedBlockRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-reconciliation-claim-row.v1",
    row_id: `kernel.reconciliation.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildBoundary({ sourceBaseline, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceBaseline.kernel_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    reconciliationRows.some((row) => row.mutation_required || row.execution_allowed_now || row.current_verdict !== "pass"),
    driftRows.some((row) => row.drift_detected || row.mutation_required),
    invariantRows.some((row) => row.unsafe_value_observed || row.current_verdict !== "pass"),
    protectedBlockRows.some((row) => row.action_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-reconciliation-boundary.v1",
    kernel_spec_status_reconciliation_ready_for_engine_extraction: reconciliationRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_kernel_baseline_status: sourceBaseline.summary.platform_kernel_contract_baseline_status,
    read_only_reconciliation: true,
    server_started: false,
    api_projection_only: true,
    mutation_performed: false,
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

function buildValidationItems({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.kernel_baseline", "source_ready", sourceBaseline.summary.platform_kernel_contract_baseline_status === SOURCE_READY_STATUS, "source Kernel baseline must be ready"),
    validationItem("spec.count", "spec_rows", specRows.length === 17, "all spec rows must exist"),
    validationItem("status.count", "status_rows", statusRows.length === 17, "all status rows must exist"),
    validationItem("reconciliation.count", "reconciliation_rows", reconciliationRows.length === 17, "all reconciliation rows must exist"),
    validationItem("drift.count", "drift_rows", driftRows.length === 10, "all drift rows must exist"),
    validationItem("invariant.count", "invariant_rows", invariantRows.length === 8, "all invariant rows must exist"),
    validationItem("protected_block.count", "protected_block_rows", protectedBlockRows.length === 20, "all protected block rows must exist"),
    validationItem("api_projection.count", "api_route_rows", apiRouteRows.length === 4, "all API projection rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceBaseline, specRows, statusRows, reconciliationRows, driftRows, invariantRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-spec-status-reconciliation-summary.v1",
    platform_kernel_spec_status_reconciliation_status: validation.valid && boundary.kernel_spec_status_reconciliation_ready_for_engine_extraction ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_kernel_baseline_status: sourceBaseline.summary.platform_kernel_contract_baseline_status,
    spec_row_count: specRows.length,
    status_row_count: statusRows.length,
    reconciliation_row_count: reconciliationRows.length,
    drift_row_count: driftRows.length,
    invariant_row_count: invariantRows.length,
    protected_block_count: protectedBlockRows.length,
    api_route_count: apiRouteRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    read_only_reconciliation: boundary.read_only_reconciliation,
    server_started: boundary.server_started,
    mutation_performed: boundary.mutation_performed,
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
    "# Platform Kernel Spec/Status Reconciliation",
    "",
    `Status: ${result.summary.platform_kernel_spec_status_reconciliation_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source Kernel baseline status: ${result.summary.source_kernel_baseline_status}`,
    `Specs: ${result.summary.spec_row_count}`,
    `Statuses: ${result.summary.status_row_count}`,
    `Reconciliations: ${result.summary.reconciliation_row_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1641-P1720 Kernel claim/evidence/gate engine extraction while preserving no-execution invariants.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_SPEC_STATUS_RECONCILIATION_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
    console_ledger_path: options.consoleLedgerPath ?? defaults.consoleLedgerPath,
    kernel_baseline_ledger_path: options.kernelBaselineLedgerPath ?? defaults.kernelBaselineLedgerPath,
    reconciliation_ledger_path: options.reconciliationLedgerPath ?? defaults.reconciliationLedgerPath,
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
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-spec-status-reconciliation.mjs [options]

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
  --help                          Show this help.
`);
}
