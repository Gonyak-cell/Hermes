import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformKernelSpecStatusReconciliation } from "./platform-kernel-spec-status-reconciliation.mjs";

export const DEFAULT_PLATFORM_KERNEL_CLAIM_EVIDENCE_GATE_ENGINE_OUT_DIR = "artifacts/platform-kernel-claim-evidence-gate-engine/latest";
export const DEFAULT_PLATFORM_KERNEL_CLAIM_EVIDENCE_GATE_ENGINE_INPUTS = {
  schemaPath: "schemas/platform-kernel-claim-evidence-gate-engine.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelBaselineLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
  reconciliationLedgerPath: "docs/hermes-platform-kernel-spec-status-reconciliation-phase-ledger.md",
  engineLedgerPath: "docs/hermes-platform-kernel-claim-evidence-gate-engine-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-claim-evidence-gate-engine";
const SOURCE_COMMAND_NAME = "platform:kernel-spec-status-reconciliation";
const SCHEMA_VERSION = "platform-kernel-claim-evidence-gate-engine.v1";
const CAPABILITY_ID = "platform.kernel.claim_evidence_gate_engine";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1641-P1720";
const PHASE_SLOT = "P1641";
const PREVIOUS_PHASE_SLOT = "P1640";
const NEXT_PHASE_SLOT = "P1721";
const SOURCE_READY_STATUS = "ready_for_platform_kernel_spec_status_reconciliation";
const READY_STATUS = "ready_for_platform_kernel_claim_evidence_gate_engine";

const COMPONENT_SPECS = [
  ["claim_engine", "Normalize PASS/BLOCK claims into reusable Kernel rows"],
  ["evidence_engine", "Bind every claim to evidence_ref without exposing raw payloads"],
  ["gate_engine", "Bind every claim to hard gate and reviewer refs"],
  ["artifact_engine", "Keep artifact refs as projection rows without writing"],
  ["check_engine", "Evaluate deterministic support and invariant checks"],
  ["receipt_engine", "Represent receipt requirements without applying payloads"],
];

const VERDICT_RULE_SPECS = [
  ["pass_requires_evidence", "PASS claims require evidence_ref"],
  ["pass_requires_reviewer", "PASS claims require reviewer_ref"],
  ["pass_requires_hard_gate", "PASS claims require hard_gate_ref"],
  ["pass_requires_owner", "PASS claims require responsible_owner"],
  ["pass_requires_next_action", "PASS claims require next_allowed_action"],
  ["blocked_requires_reason", "BLOCK claims require block_reason"],
  ["unsafe_flags_false_required", "All engine claims require unsafe_flags_false"],
  ["harness_only_authority_required", "All engine claims require harness_only verdict authority"],
  ["protected_blocks_preserved", "Protected BLOCK claims remain blocked"],
];

const API_ROUTE_SPECS = [
  ["/api/kernel-claim-engine/claims", "kernel_engine_claim_input_rows", "Kernel claim engine inputs"],
  ["/api/kernel-claim-engine/evidence", "kernel_engine_evidence_binding_rows", "Kernel evidence bindings"],
  ["/api/kernel-claim-engine/gates", "kernel_engine_gate_binding_rows", "Kernel gate bindings"],
  ["/api/kernel-claim-engine/evaluations", "kernel_engine_evaluation_rows", "Kernel claim support evaluations"],
];

const FREEZE_SPECS = [
  ["source_reconciliation_ready", "P1561-P1640 Kernel spec/status reconciliation is ready"],
  ["component_rows_ready", "Kernel engine component rows are ready"],
  ["verdict_rules_ready", "PASS/BLOCK verdict rules are ready"],
  ["claim_inputs_supported", "Claim input rows are supported"],
  ["evidence_bindings_ready", "Evidence binding rows are ready"],
  ["gate_bindings_ready", "Gate binding rows are ready"],
  ["evaluations_ready", "Claim evaluation rows are ready"],
  ["ready_for_p1721_artifact_check_receipt_engine", "Next slice can extract artifact/check/receipt engine"],
];

export async function runPlatformKernelClaimEvidenceGateEngine(options = {}) {
  const result = await buildPlatformKernelClaimEvidenceGateEngine(options);
  if (options.write !== false) await writePlatformKernelClaimEvidenceGateEngine(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel claim/evidence/gate engine failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelClaimEvidenceGateEngine(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_CLAIM_EVIDENCE_GATE_ENGINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const reconciliationLedger = await readTextSource(inputs.reconciliation_ledger_path);
  const engineLedger = await readTextSource(inputs.engine_ledger_path);
  const sourceReconciliation = options.sourceKernelSpecStatusReconciliation ?? await buildPlatformKernelSpecStatusReconciliation({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    kernelBaselineLedgerPath: inputs.kernel_baseline_ledger_path,
    reconciliationLedgerPath: inputs.reconciliation_ledger_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const verdictRuleRows = buildVerdictRuleRows();
  const claimInputRows = buildClaimInputRows(sourceReconciliation);
  const evidenceBindingRows = buildEvidenceBindingRows(claimInputRows);
  const gateBindingRows = buildGateBindingRows(claimInputRows);
  const evaluationRows = buildEvaluationRows(claimInputRows);
  const protectedBlockRows = buildProtectedBlockRows(sourceReconciliation);
  const apiRouteRows = buildApiRouteRows();
  const freezeRows = buildFreezeRows({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, apiRouteRows });
  const anchor = buildAnchor({ packageJson, reconciliationLedger, engineLedger, sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows });
  const gateRows = buildGateRows({ packageJson, reconciliationLedger, engineLedger, sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows });
  const claimRows = buildEngineClaimRows({ componentRows, verdictRuleRows, evidenceBindingRows, gateBindingRows, evaluationRows, apiRouteRows, freezeRows, protectedBlockRows });
  const boundary = buildBoundary({ sourceReconciliation, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_claim_evidence_gate_engine_id: `platform-kernel-claim-evidence-gate-engine.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_claim_evidence_gate_engine_anchor: anchor,
    source_kernel_spec_status_reconciliation_summary: sourceReconciliation.summary,
    kernel_engine_component_rows: componentRows,
    kernel_engine_verdict_rule_rows: verdictRuleRows,
    kernel_engine_claim_input_rows: claimInputRows,
    kernel_engine_evidence_binding_rows: evidenceBindingRows,
    kernel_engine_gate_binding_rows: gateBindingRows,
    kernel_engine_evaluation_rows: evaluationRows,
    kernel_engine_protected_block_rows: protectedBlockRows,
    kernel_engine_api_projection_rows: apiRouteRows,
    kernel_engine_freeze_rows: freezeRows,
    kernel_engine_gate_rows: gateRows,
    kernel_engine_claim_rows: claimRows,
    kernel_engine_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_claim_evidence_gate_engine")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_claim_evidence_gate_engine_id = result.platform_kernel_claim_evidence_gate_engine_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelClaimEvidenceGateEngine(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-claim-evidence-gate-engine.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-engine-component-rows.json"), collectionEnvelope("kernel-engine-component-rows.v1", "kernel_engine_component_rows", result.kernel_engine_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-verdict-rule-rows.json"), collectionEnvelope("kernel-engine-verdict-rule-rows.v1", "kernel_engine_verdict_rule_rows", result.kernel_engine_verdict_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-claim-input-rows.json"), collectionEnvelope("kernel-engine-claim-input-rows.v1", "kernel_engine_claim_input_rows", result.kernel_engine_claim_input_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-evidence-binding-rows.json"), collectionEnvelope("kernel-engine-evidence-binding-rows.v1", "kernel_engine_evidence_binding_rows", result.kernel_engine_evidence_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-gate-binding-rows.json"), collectionEnvelope("kernel-engine-gate-binding-rows.v1", "kernel_engine_gate_binding_rows", result.kernel_engine_gate_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-evaluation-rows.json"), collectionEnvelope("kernel-engine-evaluation-rows.v1", "kernel_engine_evaluation_rows", result.kernel_engine_evaluation_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-protected-block-rows.json"), collectionEnvelope("kernel-engine-protected-block-rows.v1", "kernel_engine_protected_block_rows", result.kernel_engine_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-api-projection-rows.json"), collectionEnvelope("kernel-engine-api-projection-rows.v1", "kernel_engine_api_projection_rows", result.kernel_engine_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-freeze-rows.json"), collectionEnvelope("kernel-engine-freeze-rows.v1", "kernel_engine_freeze_rows", result.kernel_engine_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-gate-rows.json"), collectionEnvelope("kernel-engine-gate-rows.v1", "kernel_engine_gate_rows", result.kernel_engine_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-claim-rows.json"), collectionEnvelope("kernel-engine-claim-rows.v1", "kernel_engine_claim_rows", result.kernel_engine_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-engine-boundary.json"), result.kernel_engine_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-claim-evidence-gate-engine-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelClaimEvidenceGateEngineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelClaimEvidenceGateEngine(args);
    console.log(`Platform Kernel claim/evidence/gate engine ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_claim_evidence_gate_engine_status}`);
    console.log(`Claim inputs: ${result.summary.claim_input_count}`);
    console.log(`Evidence bindings: ${result.summary.evidence_binding_count}`);
    console.log(`Gate bindings: ${result.summary.gate_binding_count}`);
    console.log(`Engine claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
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
    schema_version: "kernel-engine-component-row.v1",
    row_id: `kernel.engine.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id,
    component_status: "ready",
    description,
    read_only_component: true,
    evidence_ref: `evidence.platform.kernel.engine.component.${component_id}`,
    reviewer_ref: "reviewer.platform_kernel_claim_evidence_gate_engine_component",
    hard_gate_ref: `gate.platform.kernel.engine.component.${component_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "promote component into reusable Kernel module after P1720 freeze",
  }));
}

function buildVerdictRuleRows() {
  return VERDICT_RULE_SPECS.map(([rule_id, description], index) => passRow({
    schema_version: "kernel-engine-verdict-rule-row.v1",
    row_id: `kernel.engine.verdict_rule.row.${String(index + 1).padStart(2, "0")}`,
    rule_id,
    rule_status: "ready",
    description,
    fail_closed: true,
    evidence_ref: `evidence.platform.kernel.engine.verdict_rule.${rule_id}`,
    reviewer_ref: "reviewer.platform_kernel_claim_evidence_gate_engine_rule",
    hard_gate_ref: `gate.platform.kernel.engine.verdict_rule.${rule_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "apply rule to claim inputs in evaluation rows",
  }));
}

function buildClaimInputRows(sourceReconciliation) {
  return sourceReconciliation.kernel_reconciliation_claim_rows.map((row, index) => ({
    schema_version: "kernel-engine-claim-input-row.v1",
    row_id: `kernel.engine.claim_input.row.${String(index + 1).padStart(3, "0")}`,
    source_claim_row_ref: row.row_id,
    claim_type: row.claim_type,
    claim_id: row.claim_id,
    domain_id: row.domain_id,
    current_verdict: row.current_verdict,
    block_reason: row.block_reason,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    claim_support_status: claimSupportStatus(row),
    unsafe_flags_false: row.unsafe_flags_false === true,
    verdict_authority: "harness_only",
  }));
}

function buildEvidenceBindingRows(claimInputRows) {
  return claimInputRows.map((row, index) => passRow({
    schema_version: "kernel-engine-evidence-binding-row.v1",
    row_id: `kernel.engine.evidence_binding.row.${String(index + 1).padStart(3, "0")}`,
    claim_input_row_ref: row.row_id,
    claim_id: row.claim_id,
    domain_id: row.domain_id,
    evidence_ref: row.evidence_ref,
    evidence_binding_status: row.evidence_ref ? "bound" : "missing",
    raw_material_exposed: false,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep evidence_ref bound without raw payload exposure",
  }));
}

function buildGateBindingRows(claimInputRows) {
  return claimInputRows.map((row, index) => passRow({
    schema_version: "kernel-engine-gate-binding-row.v1",
    row_id: `kernel.engine.gate_binding.row.${String(index + 1).padStart(3, "0")}`,
    claim_input_row_ref: row.row_id,
    claim_id: row.claim_id,
    domain_id: row.domain_id,
    gate_binding_status: row.hard_gate_ref && row.reviewer_ref ? "bound" : "missing",
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    evidence_ref: row.evidence_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep gate and reviewer refs bound for claim evaluation",
  }));
}

function buildEvaluationRows(claimInputRows) {
  return claimInputRows.map((row, index) => {
    const supported = row.claim_support_status === "supported";
    const fields = {
      schema_version: "kernel-engine-evaluation-row.v1",
      row_id: `kernel.engine.evaluation.row.${String(index + 1).padStart(3, "0")}`,
      claim_input_row_ref: row.row_id,
      claim_id: row.claim_id,
      domain_id: row.domain_id,
      source_verdict: row.current_verdict,
      evaluation_status: supported ? "supported" : "blocked",
      evaluation_passed: supported,
      mutation_required: false,
      execution_allowed_now: false,
      evidence_ref: row.evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      responsible_owner: row.responsible_owner,
      next_allowed_action: supported ? "keep evaluation result attached" : `repair claim support for ${row.claim_id}`,
    };
    return supported ? passRow(fields) : blockedRow({ ...fields, block_reason: `claim_input_unsupported.${row.claim_id}` });
  });
}

function buildProtectedBlockRows(sourceReconciliation) {
  return sourceReconciliation.kernel_reconciliation_protected_block_rows.map((row, index) => ({
    schema_version: "kernel-engine-protected-block-row.v1",
    row_id: `kernel.engine.protected_block.row.${String(index + 1).padStart(3, "0")}`,
    source_protected_block_row_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
    current_verdict: "blocked",
    engine_block_status: "preserved",
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
    schema_version: "kernel-engine-api-projection-row.v1",
    row_id: `kernel.engine.api_projection.row.${String(index + 1).padStart(2, "0")}`,
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
    evidence_ref: `evidence.platform.kernel.engine.api.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_kernel_claim_evidence_gate_engine_api",
    hard_gate_ref: `gate.platform.kernel.engine.api.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "wire as read-only Review API route after Kernel projection freeze",
  }));
}

function buildFreezeRows({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, apiRouteRows }) {
  const checks = {
    source_reconciliation_ready: sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status === SOURCE_READY_STATUS,
    component_rows_ready: componentRows.length === 6,
    verdict_rules_ready: verdictRuleRows.length === 9 && verdictRuleRows.every((row) => row.fail_closed === true),
    claim_inputs_supported: claimInputRows.length === 101 && claimInputRows.every((row) => row.claim_support_status === "supported"),
    evidence_bindings_ready: evidenceBindingRows.length === 101 && evidenceBindingRows.every((row) => row.evidence_binding_status === "bound"),
    gate_bindings_ready: gateBindingRows.length === 101 && gateBindingRows.every((row) => row.gate_binding_status === "bound"),
    evaluations_ready: evaluationRows.length === 101 && evaluationRows.every((row) => row.evaluation_passed === true),
    ready_for_p1721_artifact_check_receipt_engine: apiRouteRows.length === 4,
  };
  return FREEZE_SPECS.map(([freeze_id, description], index) => {
    const pass = checks[freeze_id] === true;
    const fields = {
      schema_version: "kernel-engine-freeze-row.v1",
      row_id: `kernel.engine.freeze.row.${String(index + 1).padStart(2, "0")}`,
      freeze_id,
      freeze_status: pass ? "ready" : "blocked",
      description,
      evidence_ref: `evidence.platform.kernel.engine.freeze.${freeze_id}`,
      reviewer_ref: "reviewer.platform_kernel_claim_evidence_gate_engine_freeze",
      hard_gate_ref: `gate.platform.kernel.engine.freeze.${freeze_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: pass ? "keep freeze evidence attached" : `repair ${freeze_id} before P1720 closeout`,
    };
    return pass ? passRow(fields) : blockedRow({ ...fields, block_reason: `kernel_engine_freeze_failed.${freeze_id}` });
  });
}

function buildAnchor({ packageJson, reconciliationLedger, engineLedger, sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  return {
    schema_version: "kernel-claim-evidence-gate-engine-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    reconciliation_ledger_present: reconciliationLedger.available,
    engine_ledger_present: engineLedger.available,
    source_reconciliation_status: sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status,
    component_count: componentRows.length,
    verdict_rule_count: verdictRuleRows.length,
    claim_input_count: claimInputRows.length,
    evidence_binding_count: evidenceBindingRows.length,
    gate_binding_count: gateBindingRows.length,
    evaluation_count: evaluationRows.length,
    protected_block_count: protectedBlockRows.length,
    api_route_count: apiRouteRows.length,
    freeze_count: freezeRows.length,
  };
}

function buildGateRows({ packageJson, reconciliationLedger, engineLedger, sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_reconciliation_ready", sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status === SOURCE_READY_STATUS],
    ["reconciliation_ledger_present", reconciliationLedger.available && reconciliationLedger.text.includes("P1561-P1640")],
    ["engine_ledger_present", engineLedger.available && ["P1641-P1720", "P1641-P1660", "P1701-P1720", COMMAND_NAME].every((token) => engineLedger.text.includes(token))],
    ["component_rows_ready", componentRows.length === 6 && componentRows.every((row) => row.current_verdict === "pass")],
    ["verdict_rules_ready", verdictRuleRows.length === 9 && verdictRuleRows.every((row) => row.fail_closed === true)],
    ["claim_inputs_supported", claimInputRows.length === 101 && claimInputRows.every((row) => row.claim_support_status === "supported")],
    ["evidence_bindings_ready", evidenceBindingRows.length === 101 && evidenceBindingRows.every((row) => row.evidence_binding_status === "bound")],
    ["gate_bindings_ready", gateBindingRows.length === 101 && gateBindingRows.every((row) => row.gate_binding_status === "bound")],
    ["evaluations_ready", evaluationRows.length === 101 && evaluationRows.every((row) => row.current_verdict === "pass")],
    ["protected_blocks_preserved", protectedBlockRows.length === 20 && protectedBlockRows.every((row) => row.current_verdict === "blocked")],
    ["api_routes_projected", apiRouteRows.length === 4 && apiRouteRows.every((row) => row.method === "GET" && row.mutation_route === false)],
    ["freeze_rows_ready", freezeRows.length === 8 && freezeRows.every((row) => row.current_verdict === "pass")],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-engine-gate-row.v1",
    row_id: `kernel.engine.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.engine.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_claim_evidence_gate_engine_gate",
    hard_gate_ref: `gate.platform.kernel.engine.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1720 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildEngineClaimRows({ componentRows, verdictRuleRows, evidenceBindingRows, gateBindingRows, evaluationRows, apiRouteRows, freezeRows, protectedBlockRows }) {
  const passSources = [
    ...componentRows.map((row) => ["component", row.component_id, row]),
    ...verdictRuleRows.map((row) => ["verdict_rule", row.rule_id, row]),
    ...evidenceBindingRows.map((row) => ["evidence_binding", row.claim_input_row_ref, row]),
    ...gateBindingRows.map((row) => ["gate_binding", row.claim_input_row_ref, row]),
    ...evaluationRows.filter((row) => row.current_verdict === "pass").map((row) => ["evaluation", row.claim_input_row_ref, row]),
    ...apiRouteRows.map((row) => ["api_projection", row.route_path, row]),
    ...freezeRows.filter((row) => row.current_verdict === "pass").map((row) => ["freeze", row.freeze_id, row]),
  ];
  const blockedSources = protectedBlockRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-engine-claim-row.v1",
    row_id: `kernel.engine.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildBoundary({ sourceReconciliation, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows }) {
  const sourceBoundary = sourceReconciliation.kernel_reconciliation_boundary;
  const unsafeFlags = [
    sourceBoundary.agent_runtime_execution_allowed_now,
    sourceBoundary.write_action_allowed_now,
    sourceBoundary.protected_action_execution_allowed_now,
    sourceBoundary.receipt_application_allowed_now,
    sourceBoundary.raw_secret_read_allowed_now,
    sourceBoundary.raw_client_or_vdr_access_allowed_now,
    sourceBoundary.direct_zendd_mutation_allowed_now,
    sourceBoundary.agent_final_pass_allowed_now,
    claimInputRows.some((row) => row.claim_support_status !== "supported"),
    evidenceBindingRows.some((row) => row.evidence_binding_status !== "bound" || row.raw_material_exposed),
    gateBindingRows.some((row) => row.gate_binding_status !== "bound"),
    evaluationRows.some((row) => row.current_verdict !== "pass" || row.execution_allowed_now || row.mutation_required),
    protectedBlockRows.some((row) => row.action_allowed_now),
    apiRouteRows.some((row) => row.server_started || row.mutation_route || row.protected_action_route || row.receipt_application_route || row.raw_material_route),
    freezeRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-engine-boundary.v1",
    kernel_claim_evidence_gate_engine_ready_for_artifact_check_receipt: evaluationRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_reconciliation_status: sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status,
    read_only_engine: true,
    server_started: false,
    api_projection_only: true,
    mutation_performed: false,
    raw_material_exposed: false,
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

function buildValidationItems({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.reconciliation", "source_ready", sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status === SOURCE_READY_STATUS, "source reconciliation must be ready"),
    validationItem("component.count", "component_rows", componentRows.length === 6, "all engine component rows must exist"),
    validationItem("rule.count", "verdict_rule_rows", verdictRuleRows.length === 9, "all verdict rule rows must exist"),
    validationItem("claim_input.count", "claim_input_rows", claimInputRows.length === 101, "all claim input rows must exist"),
    validationItem("evidence_binding.count", "evidence_binding_rows", evidenceBindingRows.length === 101, "all evidence binding rows must exist"),
    validationItem("gate_binding.count", "gate_binding_rows", gateBindingRows.length === 101, "all gate binding rows must exist"),
    validationItem("evaluation.count", "evaluation_rows", evaluationRows.length === 101, "all evaluation rows must exist"),
    validationItem("protected_block.count", "protected_block_rows", protectedBlockRows.length === 20, "all protected block rows must exist"),
    validationItem("api_projection.count", "api_projection_rows", apiRouteRows.length === 4, "all API projection rows must exist"),
    validationItem("freeze.ready", "freeze_rows", freezeRows.every((row) => row.current_verdict === "pass"), "all freeze rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all engine claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceReconciliation, componentRows, verdictRuleRows, claimInputRows, evidenceBindingRows, gateBindingRows, evaluationRows, protectedBlockRows, apiRouteRows, freezeRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-claim-evidence-gate-engine-summary.v1",
    platform_kernel_claim_evidence_gate_engine_status: validation.valid && boundary.kernel_claim_evidence_gate_engine_ready_for_artifact_check_receipt ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reconciliation_status: sourceReconciliation.summary.platform_kernel_spec_status_reconciliation_status,
    component_count: componentRows.length,
    verdict_rule_count: verdictRuleRows.length,
    claim_input_count: claimInputRows.length,
    evidence_binding_count: evidenceBindingRows.length,
    gate_binding_count: gateBindingRows.length,
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
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function claimSupportStatus(row) {
  const commonSupported = Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.unsafe_flags_false === true && row.verdict_authority === "harness_only");
  if (row.current_verdict === "pass") return commonSupported ? "supported" : "unsupported";
  if (row.current_verdict === "blocked") return commonSupported && Boolean(row.block_reason) ? "supported" : "unsupported";
  return "unsupported";
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
    "# Platform Kernel Claim/Evidence/Gate Engine",
    "",
    `Status: ${result.summary.platform_kernel_claim_evidence_gate_engine_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source reconciliation status: ${result.summary.source_reconciliation_status}`,
    `Claim inputs: ${result.summary.claim_input_count}`,
    `Evidence bindings: ${result.summary.evidence_binding_count}`,
    `Gate bindings: ${result.summary.gate_binding_count}`,
    `Engine claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1721-P1800 Kernel artifact/check/receipt engine extraction while preserving no-execution invariants.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_CLAIM_EVIDENCE_GATE_ENGINE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
    console_ledger_path: options.consoleLedgerPath ?? defaults.consoleLedgerPath,
    kernel_baseline_ledger_path: options.kernelBaselineLedgerPath ?? defaults.kernelBaselineLedgerPath,
    reconciliation_ledger_path: options.reconciliationLedgerPath ?? defaults.reconciliationLedgerPath,
    engine_ledger_path: options.engineLedgerPath ?? defaults.engineLedgerPath,
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
    engineLedgerPath: undefined,
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
    } else if (arg === "--engine-ledger") {
      args.engineLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-claim-evidence-gate-engine.mjs [options]

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
  --engine-ledger <path>
  --help                          Show this help.
`);
}
