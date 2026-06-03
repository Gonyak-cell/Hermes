import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelClaimEvidenceGateEngine } from "./platform-kernel-claim-evidence-gate-engine.mjs";

export const DEFAULT_PLATFORM_KERNEL_ARTIFACT_CHECK_RECEIPT_ENGINE_OUT_DIR = "artifacts/platform-kernel-artifact-check-receipt-engine/latest";
export const DEFAULT_PLATFORM_KERNEL_ARTIFACT_CHECK_RECEIPT_ENGINE_INPUTS = {
  schemaPath: "schemas/platform-kernel-artifact-check-receipt-engine.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelBaselineLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
  reconciliationLedgerPath: "docs/hermes-platform-kernel-spec-status-reconciliation-phase-ledger.md",
  claimEngineLedgerPath: "docs/hermes-platform-kernel-claim-evidence-gate-engine-phase-ledger.md",
  artifactCheckReceiptLedgerPath: "docs/hermes-platform-kernel-artifact-check-receipt-engine-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-artifact-check-receipt-engine";
const SOURCE_COMMAND_NAME = "platform:kernel-claim-evidence-gate-engine";
const SCHEMA_VERSION = "platform-kernel-artifact-check-receipt-engine.v1";
const CAPABILITY_ID = "platform.kernel.artifact_check_receipt_engine";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1721-P1800";
const PHASE_SLOT = "P1721";
const PREVIOUS_PHASE_SLOT = "P1720";
const NEXT_PHASE_SLOT = "P1801";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_claim_evidence_gate_engine";
const READY_STATUS = "ready_for_platform_kernel_artifact_check_receipt_engine";

const COMPONENT_SPECS = [
  ["artifact_registry_engine", "Normalize artifact projections from Kernel components, routes, and freezes"],
  ["artifact_projection_engine", "Expose artifact refs without writing or copying raw payloads"],
  ["check_registry_engine", "Normalize deterministic check and gate rows"],
  ["check_evaluation_engine", "Evaluate check rows without executing commands"],
  ["receipt_state_engine", "Represent required/missing receipt state without payloads"],
  ["receipt_gate_engine", "Bind receipt state to protected blocks and human gates"],
];

const API_ROUTE_SPECS = [
  ["/api/kernel-artifact-engine/artifacts", "kernel_artifact_rows", "Kernel artifact projections"],
  ["/api/kernel-artifact-engine/checks", "kernel_check_rows", "Kernel check projections"],
  ["/api/kernel-artifact-engine/receipts", "kernel_receipt_rows", "Kernel receipt state projections"],
  ["/api/kernel-artifact-engine/evaluations", "kernel_artifact_check_receipt_evaluation_rows", "Kernel artifact/check/receipt evaluations"],
];

const FREEZE_SPECS = [
  ["source_claim_engine_ready", "P1641-P1720 claim/evidence/gate engine is ready"],
  ["component_rows_ready", "artifact/check/receipt component rows are ready"],
  ["artifact_rows_ready", "artifact projection rows are ready"],
  ["check_rows_ready", "check projection rows are ready"],
  ["receipt_rows_ready", "receipt state rows are ready without payload application"],
  ["evaluations_ready", "artifact/check/receipt evaluation rows are ready"],
  ["api_projection_ready", "read-only API projection rows are declared"],
  ["ready_for_p1801_kernel_projection_freeze", "next slice can freeze Kernel projection before limited execution"],
];

export async function runPlatformKernelArtifactCheckReceiptEngine(options = {}) {
  const result = await buildPlatformKernelArtifactCheckReceiptEngine(options);
  if (options.write !== false) await writePlatformKernelArtifactCheckReceiptEngine(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel artifact/check/receipt engine failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelArtifactCheckReceiptEngine(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_ARTIFACT_CHECK_RECEIPT_ENGINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const claimEngineLedger = await readTextSource(inputs.claim_engine_ledger_path);
  const artifactCheckReceiptLedger = await readTextSource(inputs.artifact_check_receipt_ledger_path);
  const sourceClaimEngine = options.sourceKernelClaimEvidenceGateEngine ?? await buildPlatformKernelClaimEvidenceGateEngine({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    kernelBaselineLedgerPath: inputs.kernel_baseline_ledger_path,
    reconciliationLedgerPath: inputs.reconciliation_ledger_path,
    engineLedgerPath: inputs.claim_engine_ledger_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const artifactRows = buildArtifactRows(sourceClaimEngine);
  const checkRows = buildCheckRows(sourceClaimEngine);
  const receiptRows = buildReceiptRows(sourceClaimEngine);
  const evaluationRows = buildEvaluationRows({ artifactRows, checkRows, receiptRows });
  const protectedBlockRows = buildProtectedBlockRows(sourceClaimEngine);
  const apiRouteRows = buildApiRouteRows();
  const freezeRows = buildFreezeRows({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, apiRouteRows });
  const anchor = buildAnchor({ packageJson, claimEngineLedger, artifactCheckReceiptLedger, sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, claimEngineLedger, artifactCheckReceiptLedger, sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows });
  const claimRows = buildClaimRows({ componentRows, artifactRows, checkRows, receiptRows, evaluationRows, apiRouteRows, freezeRows, protectedBlockRows });
  const boundary = buildBoundary({ sourceClaimEngine, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_artifact_check_receipt_engine_id: `platform-kernel-artifact-check-receipt-engine.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_artifact_check_receipt_engine_anchor: anchor,
    source_kernel_claim_evidence_gate_engine_summary: sourceClaimEngine.summary,
    kernel_artifact_check_receipt_component_rows: componentRows,
    kernel_artifact_rows: artifactRows,
    kernel_check_rows: checkRows,
    kernel_receipt_rows: receiptRows,
    kernel_artifact_check_receipt_evaluation_rows: evaluationRows,
    kernel_artifact_check_receipt_protected_block_rows: protectedBlockRows,
    kernel_artifact_check_receipt_api_projection_rows: apiRouteRows,
    kernel_artifact_check_receipt_freeze_rows: freezeRows,
    kernel_artifact_check_receipt_gate_rows: gateRows,
    kernel_artifact_check_receipt_claim_rows: claimRows,
    kernel_artifact_check_receipt_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_artifact_check_receipt_engine")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_artifact_check_receipt_engine_id = result.platform_kernel_artifact_check_receipt_engine_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelArtifactCheckReceiptEngine(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-artifact-check-receipt-engine.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-component-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-component-rows.v1", "kernel_artifact_check_receipt_component_rows", result.kernel_artifact_check_receipt_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-rows.json"), collectionEnvelope("kernel-artifact-rows.v1", "kernel_artifact_rows", result.kernel_artifact_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-check-rows.json"), collectionEnvelope("kernel-check-rows.v1", "kernel_check_rows", result.kernel_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-receipt-rows.json"), collectionEnvelope("kernel-receipt-rows.v1", "kernel_receipt_rows", result.kernel_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-evaluation-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-evaluation-rows.v1", "kernel_artifact_check_receipt_evaluation_rows", result.kernel_artifact_check_receipt_evaluation_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-protected-block-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-protected-block-rows.v1", "kernel_artifact_check_receipt_protected_block_rows", result.kernel_artifact_check_receipt_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-api-projection-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-api-projection-rows.v1", "kernel_artifact_check_receipt_api_projection_rows", result.kernel_artifact_check_receipt_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-freeze-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-freeze-rows.v1", "kernel_artifact_check_receipt_freeze_rows", result.kernel_artifact_check_receipt_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-gate-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-gate-rows.v1", "kernel_artifact_check_receipt_gate_rows", result.kernel_artifact_check_receipt_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-claim-rows.json"), collectionEnvelope("kernel-artifact-check-receipt-claim-rows.v1", "kernel_artifact_check_receipt_claim_rows", result.kernel_artifact_check_receipt_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-artifact-check-receipt-boundary.json"), result.kernel_artifact_check_receipt_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-artifact-check-receipt-engine-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelArtifactCheckReceiptEngineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelArtifactCheckReceiptEngine(args);
    console.log(`Platform Kernel artifact/check/receipt engine ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_artifact_check_receipt_engine_status}`);
    console.log(`Artifacts: ${result.summary.artifact_row_count}`);
    console.log(`Checks: ${result.summary.check_row_count}`);
    console.log(`Receipts: ${result.summary.receipt_row_count}`);
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
    schema_version: "kernel-artifact-check-receipt-component-row.v1",
    row_id: `kernel.artifact_check_receipt.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id,
    component_status: "ready",
    description,
    read_only_component: true,
    evidence_ref: `evidence.platform.kernel.artifact_check_receipt.component.${component_id}`,
    reviewer_ref: "reviewer.platform_kernel_artifact_check_receipt_component",
    hard_gate_ref: `gate.platform.kernel.artifact_check_receipt.component.${component_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "promote component into reusable artifact/check/receipt module after P1800 freeze",
  }));
}

function buildArtifactRows(sourceClaimEngine) {
  const sourceRows = [
    ...sourceClaimEngine.kernel_engine_component_rows.map((row) => ["component", row.component_id, row]),
    ...sourceClaimEngine.kernel_engine_api_projection_rows.map((row) => ["api_projection", row.route_path, row]),
    ...sourceClaimEngine.kernel_engine_freeze_rows.map((row) => ["freeze", row.freeze_id, row]),
  ];
  return sourceRows.map(([artifactType, artifactId, row], index) => passRow({
    schema_version: "kernel-artifact-row.v1",
    row_id: `kernel.artifact.row.${String(index + 1).padStart(3, "0")}`,
    artifact_type: artifactType,
    artifact_id: artifactId,
    source_row_ref: row.row_id,
    artifact_status: "projected",
    write_performed: false,
    raw_material_exposed: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep artifact as read-only projection",
  }));
}

function buildCheckRows(sourceClaimEngine) {
  const sourceRows = [
    ...sourceClaimEngine.kernel_engine_verdict_rule_rows.map((row) => ["verdict_rule", row.rule_id, row]),
    ...sourceClaimEngine.kernel_engine_gate_rows.map((row) => ["gate", row.gate_id, row]),
  ];
  return sourceRows.map(([checkType, checkId, row], index) => passRow({
    schema_version: "kernel-check-row.v1",
    row_id: `kernel.artifact_check_receipt.check.row.${String(index + 1).padStart(3, "0")}`,
    check_type: checkType,
    check_id: checkId,
    source_row_ref: row.row_id,
    check_status: "pass",
    execution_allowed_now: false,
    mutation_required: false,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep deterministic check bound to Kernel engine",
  }));
}

function buildReceiptRows(sourceClaimEngine) {
  return sourceClaimEngine.kernel_engine_protected_block_rows.map((row, index) => passRow({
    schema_version: "kernel-receipt-row.v1",
    row_id: `kernel.receipt.row.${String(index + 1).padStart(3, "0")}`,
    source_protected_block_row_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
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
}

function buildEvaluationRows({ artifactRows, checkRows, receiptRows }) {
  const rows = [
    ...artifactRows.map((row) => ["artifact", row.artifact_id, row, row.write_performed === false && row.raw_material_exposed === false]),
    ...checkRows.map((row) => ["check", row.check_id, row, row.check_status === "pass" && row.execution_allowed_now === false]),
    ...receiptRows.map((row) => ["receipt", row.protected_block_id, row, row.receipt_payload_present === false && row.receipt_applied === false && row.action_allowed_now === false]),
  ];
  return rows.map(([evaluationType, evaluationId, row, passed], index) => {
    const fields = {
      schema_version: "kernel-artifact-check-receipt-evaluation-row.v1",
      row_id: `kernel.artifact_check_receipt.evaluation.row.${String(index + 1).padStart(3, "0")}`,
      evaluation_type: evaluationType,
      evaluation_id: evaluationId,
      source_row_ref: row.row_id,
      evaluation_status: passed ? "supported" : "blocked",
      evaluation_passed: passed,
      execution_allowed_now: false,
      mutation_required: false,
      evidence_ref: row.evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      responsible_owner: row.responsible_owner,
      next_allowed_action: passed ? "keep evaluation attached" : `repair ${evaluationType}.${evaluationId}`,
    };
    return passed ? passRow(fields) : blockedRow({ ...fields, block_reason: `artifact_check_receipt_evaluation_failed.${evaluationType}.${evaluationId}` });
  });
}

function buildProtectedBlockRows(sourceClaimEngine) {
  return sourceClaimEngine.kernel_engine_protected_block_rows.map((row, index) => ({
    schema_version: "kernel-artifact-check-receipt-protected-block-row.v1",
    row_id: `kernel.artifact_check_receipt.protected_block.row.${String(index + 1).padStart(3, "0")}`,
    source_protected_block_row_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    receipt_required_before_action: true,
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
    schema_version: "kernel-artifact-check-receipt-api-projection-row.v1",
    row_id: `kernel.artifact_check_receipt.api_projection.row.${String(index + 1).padStart(2, "0")}`,
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
    evidence_ref: `evidence.platform.kernel.artifact_check_receipt.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_kernel_artifact_check_receipt_api",
    hard_gate_ref: `gate.platform.kernel.artifact_check_receipt.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "wire as read-only Review API route after Kernel projection freeze",
  }));
}

function buildFreezeRows({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, apiRouteRows }) {
  const checks = {
    source_claim_engine_ready: sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status === SOURCE_READY_STATUS,
    component_rows_ready: componentRows.length === 6,
    artifact_rows_ready: artifactRows.length === 18 && artifactRows.every((row) => row.artifact_status === "projected" && row.write_performed === false),
    check_rows_ready: checkRows.length === 23 && checkRows.every((row) => row.check_status === "pass"),
    receipt_rows_ready: receiptRows.length === 20 && receiptRows.every((row) => row.receipt_status === "missing" && row.receipt_payload_present === false),
    evaluations_ready: evaluationRows.length === 61 && evaluationRows.every((row) => row.evaluation_passed === true),
    api_projection_ready: apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.server_started === false),
    ready_for_p1801_kernel_projection_freeze: true,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "kernel-artifact-check-receipt-freeze-row.v1",
      row_id: `kernel.artifact_check_receipt.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.kernel.artifact_check_receipt.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_kernel_artifact_check_receipt_freeze",
      hard_gate_ref: `gate.platform.kernel.artifact_check_receipt.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1800 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `artifact_check_receipt_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, claimEngineLedger, artifactCheckReceiptLedger, sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  return {
    schema_version: "kernel-artifact-check-receipt-engine-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    claim_engine_ledger_present: claimEngineLedger.available,
    artifact_check_receipt_ledger_present: artifactCheckReceiptLedger.available,
    source_claim_engine_status: sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status,
    component_count: componentRows.length,
    artifact_row_count: artifactRows.length,
    check_row_count: checkRows.length,
    receipt_row_count: receiptRows.length,
    evaluation_count: evaluationRows.length,
    protected_block_count: protectedBlockRows.length,
    api_route_count: apiRouteRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, claimEngineLedger, artifactCheckReceiptLedger, sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_claim_engine_ready", sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status === SOURCE_READY_STATUS],
    ["claim_engine_ledger_present", claimEngineLedger.available && claimEngineLedger.text.includes("P1641-P1720")],
    ["artifact_check_receipt_ledger_present", artifactCheckReceiptLedger.available && ["P1721-P1800", "P1721-P1740", "P1781-P1800", COMMAND_NAME].every((token) => artifactCheckReceiptLedger.text.includes(token))],
    ["component_rows_ready", componentRows.length === 6 && componentRows.every((row) => row.current_verdict === "pass")],
    ["artifact_rows_ready", artifactRows.length === 18 && artifactRows.every((row) => row.write_performed === false && row.raw_material_exposed === false)],
    ["check_rows_ready", checkRows.length === 23 && checkRows.every((row) => row.check_status === "pass")],
    ["receipt_rows_ready", receiptRows.length === 20 && receiptRows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false)],
    ["evaluations_ready", evaluationRows.length === 61 && evaluationRows.every((row) => row.current_verdict === "pass")],
    ["protected_blocks_preserved", protectedBlockRows.length === 20 && protectedBlockRows.every((row) => row.current_verdict === "blocked")],
    ["api_routes_projected", apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-artifact-check-receipt-gate-row.v1",
    row_id: `kernel.artifact_check_receipt.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.artifact_check_receipt.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_artifact_check_receipt_gate",
    hard_gate_ref: `gate.platform.kernel.artifact_check_receipt.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1800 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ componentRows, artifactRows, checkRows, receiptRows, evaluationRows, apiRouteRows, freezeRows, protectedBlockRows }) {
  const passSources = [
    ...componentRows.map((row) => ["component", row.component_id, row]),
    ...artifactRows.map((row) => ["artifact", row.artifact_id, row]),
    ...checkRows.map((row) => ["check", row.check_id, row]),
    ...receiptRows.map((row) => ["receipt", row.protected_block_id, row]),
    ...evaluationRows.filter((row) => row.current_verdict === "pass").map((row) => ["evaluation", row.row_id, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = protectedBlockRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-artifact-check-receipt-claim-row.v1",
    row_id: `kernel.artifact_check_receipt.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildBoundary({ sourceClaimEngine, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceClaimEngine.kernel_engine_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    artifactRows.some((row) => row.write_performed || row.raw_material_exposed),
    checkRows.some((row) => row.execution_allowed_now || row.mutation_required || row.check_status !== "pass"),
    receiptRows.some((row) => row.receipt_payload_present || row.receipt_applied || row.action_allowed_now),
    evaluationRows.some((row) => row.current_verdict !== "pass" || row.execution_allowed_now || row.mutation_required),
    protectedBlockRows.some((row) => row.action_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-artifact-check-receipt-boundary.v1",
    kernel_artifact_check_receipt_engine_ready_for_projection_freeze: evaluationRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_claim_engine_status: sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status,
    read_only_engine: true,
    server_started: false,
    api_projection_only: true,
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

function buildValidationItems({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.claim_engine", "source_ready", sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status === SOURCE_READY_STATUS, "source claim/evidence/gate engine must be ready"),
    validationItem("component.count", "component_rows", componentRows.length === 6, "all artifact/check/receipt component rows must exist"),
    validationItem("artifact.count", "artifact_rows", artifactRows.length === 18, "all artifact rows must exist"),
    validationItem("check.count", "check_rows", checkRows.length === 23, "all check rows must exist"),
    validationItem("receipt.count", "receipt_rows", receiptRows.length === 20, "all receipt rows must exist"),
    validationItem("evaluation.count", "evaluation_rows", evaluationRows.length === 61, "all evaluation rows must exist"),
    validationItem("protected_block.count", "protected_block_rows", protectedBlockRows.length === 20, "all protected block rows must exist"),
    validationItem("api_projection.count", "api_projection_rows", apiRouteRows.length === 4, "all API projection rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceClaimEngine, componentRows, artifactRows, checkRows, receiptRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-artifact-check-receipt-engine-summary.v1",
    platform_kernel_artifact_check_receipt_engine_status: validation.valid && boundary.kernel_artifact_check_receipt_engine_ready_for_projection_freeze ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_claim_engine_status: sourceClaimEngine.summary.platform_kernel_claim_evidence_gate_engine_status,
    component_count: componentRows.length,
    artifact_row_count: artifactRows.length,
    check_row_count: checkRows.length,
    receipt_row_count: receiptRows.length,
    evaluation_count: evaluationRows.length,
    protected_block_count: protectedBlockRows.length,
    api_route_count: apiRouteRows.length,
    freeze_count: freezeRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    read_only_engine: boundary.read_only_engine,
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
    "# Platform Kernel Artifact/Check/Receipt Engine",
    "",
    `Status: ${result.summary.platform_kernel_artifact_check_receipt_engine_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source claim/evidence/gate engine status: ${result.summary.source_claim_engine_status}`,
    `Artifacts: ${result.summary.artifact_row_count}`,
    `Checks: ${result.summary.check_row_count}`,
    `Receipts: ${result.summary.receipt_row_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1801-P1880 Kernel projection freeze while preserving no-execution invariants.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_ARTIFACT_CHECK_RECEIPT_ENGINE_INPUTS;
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
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-artifact-check-receipt-engine.mjs [options]

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
  --help                          Show this help.
`);
}
