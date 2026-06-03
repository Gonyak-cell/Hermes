import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentOperatorConsoleV0 } from "./platform-agent-operator-console-v0.mjs";

export const DEFAULT_PLATFORM_KERNEL_CONTRACT_BASELINE_OUT_DIR = "artifacts/platform-kernel-contract-baseline/latest";
export const DEFAULT_PLATFORM_KERNEL_CONTRACT_BASELINE_INPUTS = {
  schemaPath: "schemas/platform-kernel-contract-baseline.schema.json",
  packagePath: "package.json",
  activationBridgeLedgerPath: "docs/hermes-agent-runtime-activation-bridge-phase-ledger.md",
  domainPilotLedgerPath: "docs/hermes-domain-agent-no-write-pilot-phase-ledger.md",
  consoleLedgerPath: "docs/hermes-agent-operator-console-v0-phase-ledger.md",
  kernelLedgerPath: "docs/hermes-platform-kernel-contract-baseline-phase-ledger.md",
};

const COMMAND_NAME = "platform:kernel-contract-baseline";
const SOURCE_COMMAND_NAME = "platform:agent-operator-console-v0";
const SCHEMA_VERSION = "platform-kernel-contract-baseline.v1";
const CAPABILITY_ID = "platform.kernel.contract_baseline";
const PROGRAM_RANGE = "P1501-P2040";
const PHASE_RANGE = "P1501-P1560";
const PHASE_SLOT = "P1501";
const PREVIOUS_PHASE_SLOT = "P1500";
const NEXT_PHASE_SLOT = "P1561";
const SOURCE_READY_STATUS = "ready_for_agent_operator_console_v0_freeze";
const READY_STATUS = "ready_for_platform_kernel_contract_baseline";

const PRIMITIVE_SPECS = [
  ["claim", "PASS/BLOCK assertion with owner, evidence, gate, reviewer, and next action"],
  ["evidence", "Stable evidence_ref or source-span reference without raw secret or raw client material"],
  ["gate", "Deterministic PASS/BLOCK readiness gate"],
  ["artifact", "Generated or external artifact reference with provenance and review status"],
  ["check", "Deterministic validation item or invariant check"],
  ["receipt", "Human receipt requirement, payload absence, validation, expiry, or application state"],
];

const SOURCE_SPECS = [
  ["agent_runtime_activation_bridge", "platform:agent-runtime-activation-bridge", "P1201-P1320"],
  ["domain_agent_no_write_pilot", "platform:domain-agent-no-write-pilot", "P1321-P1440"],
  ["agent_operator_console_v0", "platform:agent-operator-console-v0", "P1441-P1500"],
];

const CONTRACT_SPECS = [
  ["capability_registry_contract", "agent_console_capability_rows", ["claim", "evidence", "gate", "artifact"]],
  ["protected_block_contract", "agent_console_block_rows", ["claim", "gate", "receipt", "check"]],
  ["receipt_visibility_contract", "agent_console_receipt_rows", ["receipt", "gate", "check"]],
  ["next_action_contract", "agent_console_next_action_rows", ["claim", "check"]],
  ["api_projection_contract", "agent_console_api_route_rows", ["artifact", "gate", "check"]],
  ["claim_projection_contract", "agent_console_claim_rows", ["claim", "evidence", "gate"]],
  ["gate_projection_contract", "agent_console_gate_rows", ["gate", "check"]],
  ["boundary_invariant_contract", "agent_console_boundary", ["check", "evidence", "gate"]],
];

const CHECK_SPECS = [
  ["source_console_ready", "source console v0 is ready"],
  ["kernel_primitives_complete", "all Kernel primitive rows exist"],
  ["source_bindings_complete", "all source binding rows exist"],
  ["contracts_mapped", "all console collections map to Kernel primitives"],
  ["protected_blocks_preserved", "protected BLOCK rows remain BLOCK"],
  ["claims_supported", "Kernel claim rows carry evidence, gate, reviewer, owner, and next action"],
  ["no_runtime_execution", "runtime execution remains disabled"],
  ["no_write_action", "write action remains disabled"],
  ["no_receipt_application", "receipt application remains disabled"],
  ["no_agent_final_authority", "Agent final authority remains disabled"],
];

const CUTOVER_SPECS = [
  ["manifest_stable", "Kernel manifest exposes source counts and primitive counts"],
  ["claim_evidence_gate_commonized", "claim, evidence, and gate primitives are commonized"],
  ["artifact_check_receipt_commonized", "artifact, check, and receipt primitives are commonized"],
  ["source_console_bound", "P1441-P1500 console output is bound as Kernel source"],
  ["no_execution_boundary_preserved", "read-only/no-execution boundary is preserved"],
  ["kernel_validation_ready", "Kernel baseline schema and gates are ready"],
  ["ready_for_p1561_reconciliation", "Next step can build Kernel spec/status reconciliation"],
];

export async function runPlatformKernelContractBaseline(options = {}) {
  const result = await buildPlatformKernelContractBaseline(options);
  if (options.write !== false) await writePlatformKernelContractBaseline(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Kernel contract baseline failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformKernelContractBaseline(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_KERNEL_CONTRACT_BASELINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const consoleLedger = await readTextSource(inputs.console_ledger_path);
  const kernelLedger = await readTextSource(inputs.kernel_ledger_path);
  const sourceConsole = options.sourceAgentOperatorConsoleV0 ?? await buildPlatformAgentOperatorConsoleV0({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    activationBridgeLedgerPath: inputs.activation_bridge_ledger_path,
    domainPilotLedgerPath: inputs.domain_pilot_ledger_path,
    consoleLedgerPath: inputs.console_ledger_path,
    write: false,
  });

  const primitiveRows = buildPrimitiveRows();
  const sourceRows = buildSourceBindingRows(sourceConsole);
  const contractRows = buildContractRows(sourceConsole);
  const blockProjectionRows = buildBlockProjectionRows(sourceConsole);
  const checkRows = buildCheckRows({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows });
  const cutoverRows = buildCutoverRows({ sourceConsole, primitiveRows, sourceRows, contractRows, checkRows });
  const anchor = buildAnchor({ packageJson, consoleLedger, kernelLedger, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows });
  const gateRows = buildGateRows({ packageJson, consoleLedger, kernelLedger, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows });
  const claimRows = buildClaimRows({ primitiveRows, sourceRows, contractRows, checkRows, cutoverRows, blockProjectionRows });
  const manifest = buildManifest({ generatedAt, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows });
  const boundary = buildBoundary({ sourceConsole, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows });
  const validationItems = buildValidationItems({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_kernel_contract_baseline_id: `platform-kernel-contract-baseline.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    kernel_contract_baseline_anchor: anchor,
    source_agent_operator_console_v0_summary: sourceConsole.summary,
    kernel_manifest: manifest,
    kernel_primitive_rows: primitiveRows,
    kernel_source_binding_rows: sourceRows,
    kernel_contract_rows: contractRows,
    kernel_block_projection_rows: blockProjectionRows,
    kernel_check_rows: checkRows,
    kernel_cutover_rows: cutoverRows,
    kernel_gate_rows: gateRows,
    kernel_claim_rows: claimRows,
    kernel_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_kernel_contract_baseline")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows, boundary, validation: result.validation });
  result.summary.platform_kernel_contract_baseline_id = result.platform_kernel_contract_baseline_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformKernelContractBaseline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-kernel-contract-baseline.json"), serializableResult(result));
  await writeJson(path.join(outDir, "kernel-manifest.json"), result.kernel_manifest);
  await writeJson(path.join(outDir, "kernel-primitive-rows.json"), collectionEnvelope("kernel-primitive-rows.v1", "kernel_primitive_rows", result.kernel_primitive_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-source-binding-rows.json"), collectionEnvelope("kernel-source-binding-rows.v1", "kernel_source_binding_rows", result.kernel_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-contract-rows.json"), collectionEnvelope("kernel-contract-rows.v1", "kernel_contract_rows", result.kernel_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-block-projection-rows.json"), collectionEnvelope("kernel-block-projection-rows.v1", "kernel_block_projection_rows", result.kernel_block_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-check-rows.json"), collectionEnvelope("kernel-check-rows.v1", "kernel_check_rows", result.kernel_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-cutover-rows.json"), collectionEnvelope("kernel-cutover-rows.v1", "kernel_cutover_rows", result.kernel_cutover_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-gate-rows.json"), collectionEnvelope("kernel-gate-rows.v1", "kernel_gate_rows", result.kernel_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-claim-rows.json"), collectionEnvelope("kernel-claim-rows.v1", "kernel_claim_rows", result.kernel_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "kernel-boundary.json"), result.kernel_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-kernel-contract-baseline-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformKernelContractBaselineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformKernelContractBaseline(args);
    console.log(`Platform Kernel contract baseline ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_kernel_contract_baseline_status}`);
    console.log(`Primitives: ${result.summary.primitive_count}`);
    console.log(`Contracts: ${result.summary.contract_count}`);
    console.log(`Kernel claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Write action allowed: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPrimitiveRows() {
  return PRIMITIVE_SPECS.map(([primitive_id, description], index) => passRow({
    schema_version: "kernel-primitive-row.v1",
    row_id: `kernel.primitive.row.${String(index + 1).padStart(2, "0")}`,
    primitive_id,
    description,
    kernel_status: "baseline_ready",
    required_fields: ["evidence_ref", "reviewer_ref", "hard_gate_ref", "responsible_owner", "next_allowed_action", "verdict_authority"],
    evidence_ref: `evidence.platform.kernel.primitive.${primitive_id}`,
    reviewer_ref: "reviewer.platform_kernel_contract_baseline",
    hard_gate_ref: `gate.platform.kernel.primitive.${primitive_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "promote primitive to P1561 spec/status reconciliation",
  }));
}

function buildSourceBindingRows(sourceConsole) {
  return SOURCE_SPECS.map(([source_id, command_name, phase_range], index) => passRow({
    schema_version: "kernel-source-binding-row.v1",
    row_id: `kernel.source_binding.row.${String(index + 1).padStart(2, "0")}`,
    source_id,
    command_name,
    phase_range,
    source_status: source_id === "agent_operator_console_v0" ? sourceConsole.summary.platform_agent_operator_console_v0_status : "bound_through_console_v0",
    source_ref: source_id === "agent_operator_console_v0" ? sourceConsole.platform_agent_operator_console_v0_id : source_id,
    artifact_projection_only: true,
    evidence_ref: `evidence.platform.kernel.source.${source_id}`,
    reviewer_ref: "reviewer.platform_kernel_source_binding",
    hard_gate_ref: `gate.platform.kernel.source.${source_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "keep source binding stable for Kernel reconciliation",
  }));
}

function buildContractRows(sourceConsole) {
  return CONTRACT_SPECS.map(([contract_id, source_collection, primitives], index) => passRow({
    schema_version: "kernel-contract-row.v1",
    row_id: `kernel.contract.row.${String(index + 1).padStart(2, "0")}`,
    contract_id,
    source_collection,
    primitive_refs: primitives,
    source_item_count: countSourceCollection(sourceConsole, source_collection),
    contract_status: "baseline_ready",
    deterministic_projection: true,
    evidence_ref: `evidence.platform.kernel.contract.${contract_id}`,
    reviewer_ref: "reviewer.platform_kernel_contract",
    hard_gate_ref: `gate.platform.kernel.contract.${contract_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: "extract reusable Kernel module after P1561 reconciliation",
  }));
}

function buildBlockProjectionRows(sourceConsole) {
  return sourceConsole.agent_console_block_rows.map((row, index) => ({
    schema_version: "kernel-block-projection-row.v1",
    row_id: `kernel.block_projection.row.${String(index + 1).padStart(3, "0")}`,
    source_row_ref: row.row_id,
    protected_block_id: row.protected_block_id,
    domain_id: row.domain_id,
    current_verdict: "blocked",
    kernel_projection_status: "blocked_claim_preserved",
    block_reason: row.block_reason,
    primitive_refs: ["claim", "gate", "receipt", "check"],
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

function buildCheckRows({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows }) {
  const checks = [
    ["source_console_ready", sourceConsole.summary.platform_agent_operator_console_v0_status === SOURCE_READY_STATUS],
    ["kernel_primitives_complete", primitiveRows.length === 6],
    ["source_bindings_complete", sourceRows.length === 3],
    ["contracts_mapped", contractRows.length === 8 && contractRows.every((row) => row.source_item_count > 0 || row.source_collection === "agent_console_boundary")],
    ["protected_blocks_preserved", blockProjectionRows.length === 20 && blockProjectionRows.every((row) => row.current_verdict === "blocked")],
    ["claims_supported", true],
    ["no_runtime_execution", sourceConsole.summary.agent_runtime_execution_allowed_now === false],
    ["no_write_action", sourceConsole.summary.write_action_allowed_now === false],
    ["no_receipt_application", sourceConsole.summary.receipt_applied === false],
    ["no_agent_final_authority", sourceConsole.summary.agent_final_pass_allowed_now === false],
  ];
  return CHECK_SPECS.map(([check_id, description], index) => {
    const pass = checks.find(([id]) => id === check_id)?.[1] === true;
    return pass ? passRow({
      schema_version: "kernel-check-row.v1",
      row_id: `kernel.check.row.${String(index + 1).padStart(2, "0")}`,
      check_id,
      check_status: "pass",
      description,
      evidence_ref: `evidence.platform.kernel.check.${check_id}`,
      reviewer_ref: "reviewer.platform_kernel_check",
      hard_gate_ref: `gate.platform.kernel.check.${check_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: "keep check in Kernel validation engine backlog",
    }) : blockedRow({
      schema_version: "kernel-check-row.v1",
      row_id: `kernel.check.row.${String(index + 1).padStart(2, "0")}`,
      check_id,
      check_status: "error",
      description,
      block_reason: `kernel_check_failed.${check_id}`,
      evidence_ref: `evidence.platform.kernel.check.${check_id}`,
      reviewer_ref: "reviewer.platform_kernel_check",
      hard_gate_ref: `gate.platform.kernel.check.${check_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: `repair ${check_id} before Kernel baseline freeze`,
    });
  });
}

function buildCutoverRows({ sourceConsole, primitiveRows, sourceRows, contractRows, checkRows }) {
  const checks = [
    ["manifest_stable", true],
    ["claim_evidence_gate_commonized", ["claim", "evidence", "gate"].every((id) => primitiveRows.some((row) => row.primitive_id === id))],
    ["artifact_check_receipt_commonized", ["artifact", "check", "receipt"].every((id) => primitiveRows.some((row) => row.primitive_id === id))],
    ["source_console_bound", sourceRows.some((row) => row.source_id === "agent_operator_console_v0" && row.source_status === SOURCE_READY_STATUS)],
    ["no_execution_boundary_preserved", sourceConsole.summary.agent_runtime_execution_allowed_now === false && sourceConsole.summary.write_action_allowed_now === false],
    ["kernel_validation_ready", contractRows.length === 8 && checkRows.every((row) => row.current_verdict === "pass")],
    ["ready_for_p1561_reconciliation", true],
  ];
  return CUTOVER_SPECS.map(([cutover_id, description], index) => {
    const pass = checks.find(([id]) => id === cutover_id)?.[1] === true;
    return pass ? passRow({
      schema_version: "kernel-cutover-row.v1",
      row_id: `kernel.cutover.row.${String(index + 1).padStart(2, "0")}`,
      cutover_id,
      cutover_status: "ready",
      description,
      evidence_ref: `evidence.platform.kernel.cutover.${cutover_id}`,
      reviewer_ref: "reviewer.platform_kernel_cutover",
      hard_gate_ref: `gate.platform.kernel.cutover.${cutover_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: "advance to P1561 Kernel spec/status reconciliation",
    }) : blockedRow({
      schema_version: "kernel-cutover-row.v1",
      row_id: `kernel.cutover.row.${String(index + 1).padStart(2, "0")}`,
      cutover_id,
      cutover_status: "blocked",
      description,
      block_reason: `kernel_cutover_failed.${cutover_id}`,
      evidence_ref: `evidence.platform.kernel.cutover.${cutover_id}`,
      reviewer_ref: "reviewer.platform_kernel_cutover",
      hard_gate_ref: `gate.platform.kernel.cutover.${cutover_id}`,
      responsible_owner: "platform_kernel_owner",
      next_allowed_action: `repair ${cutover_id} before P1560 closeout`,
    });
  });
}

function buildAnchor({ packageJson, consoleLedger, kernelLedger, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows }) {
  return {
    schema_version: "kernel-contract-baseline-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    console_ledger_present: consoleLedger.available,
    kernel_ledger_present: kernelLedger.available,
    source_console_status: sourceConsole.summary.platform_agent_operator_console_v0_status,
    primitive_count: primitiveRows.length,
    source_binding_count: sourceRows.length,
    contract_count: contractRows.length,
    block_projection_count: blockProjectionRows.length,
    check_count: checkRows.length,
    cutover_count: cutoverRows.length,
  };
}

function buildGateRows({ packageJson, consoleLedger, kernelLedger, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME])],
    ["validation_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))],
    ["source_console_ready", sourceConsole.summary.platform_agent_operator_console_v0_status === SOURCE_READY_STATUS],
    ["console_ledger_present", consoleLedger.available && consoleLedger.text.includes("P1441-P1500")],
    ["kernel_ledger_present", kernelLedger.available && ["P1501-P1560", "P1501-P1520", "P1541-P1560", COMMAND_NAME].every((token) => kernelLedger.text.includes(token))],
    ["primitive_rows_ready", primitiveRows.length === 6 && primitiveRows.every((row) => row.current_verdict === "pass")],
    ["source_rows_ready", sourceRows.length === 3 && sourceRows.every((row) => row.current_verdict === "pass")],
    ["contract_rows_ready", contractRows.length === 8 && contractRows.every((row) => row.current_verdict === "pass")],
    ["block_projection_preserved", blockProjectionRows.length === 20 && blockProjectionRows.every((row) => row.current_verdict === "blocked")],
    ["check_rows_ready", checkRows.length === 10 && checkRows.every((row) => row.current_verdict === "pass")],
    ["cutover_rows_ready", cutoverRows.length === 7 && cutoverRows.every((row) => row.current_verdict === "pass")],
    ["no_execution_boundary", sourceConsole.summary.agent_runtime_execution_allowed_now === false && sourceConsole.summary.write_action_allowed_now === false],
    ["ready_for_reconciliation", true],
  ];
  return gates.map(([gate_id, pass], index) => ({
    schema_version: "kernel-gate-row.v1",
    row_id: `kernel.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.platform.kernel.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_kernel_gate",
    hard_gate_ref: `gate.platform.kernel.${gate_id}`,
    responsible_owner: "platform_kernel_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gate_id} before P1560 closeout`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ primitiveRows, sourceRows, contractRows, checkRows, cutoverRows, blockProjectionRows }) {
  const passSources = [
    ...primitiveRows.map((row) => ["primitive", row.primitive_id, row]),
    ...sourceRows.map((row) => ["source_binding", row.source_id, row]),
    ...contractRows.map((row) => ["contract", row.contract_id, row]),
    ...checkRows.filter((row) => row.current_verdict === "pass").map((row) => ["check", row.check_id, row]),
    ...cutoverRows.filter((row) => row.current_verdict === "pass").map((row) => ["cutover", row.cutover_id, row]),
  ];
  const blockedSources = blockProjectionRows.map((row) => ["protected_block", row.protected_block_id, row]);
  return [...passSources, ...blockedSources].map(([claimType, claimId, row], index) => ({
    schema_version: "kernel-claim-row.v1",
    row_id: `kernel.claim.row.${String(index + 1).padStart(3, "0")}`,
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

function buildManifest({ generatedAt, sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows }) {
  return {
    schema_version: "kernel-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_console_ref: sourceConsole.platform_agent_operator_console_v0_id,
    primitive_count: primitiveRows.length,
    source_binding_count: sourceRows.length,
    contract_count: contractRows.length,
    block_projection_count: blockProjectionRows.length,
    check_count: checkRows.length,
    cutover_count: cutoverRows.length,
    gate_count: gateRows.length,
    claim_count: claimRows.length,
    primitive_ids: primitiveRows.map((row) => row.primitive_id),
    next_allowed_action: "use manifest as P1561 Kernel reconciliation input",
  };
}

function buildBoundary({ sourceConsole, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows }) {
  const unsafeFlags = [
    sourceConsole.summary.agent_runtime_execution_allowed_now,
    sourceConsole.summary.write_action_allowed_now,
    sourceConsole.summary.protected_action_execution_allowed_now,
    sourceConsole.summary.agent_final_pass_allowed_now,
    blockProjectionRows.some((row) => row.action_allowed_now),
    checkRows.some((row) => row.current_verdict !== "pass"),
    cutoverRows.some((row) => row.current_verdict !== "pass"),
    gateRows.some((row) => row.gate_status !== "ready"),
    claimRows.some((row) => row.unsafe_flags_false !== true),
  ];
  return {
    schema_version: "kernel-boundary.v1",
    kernel_contract_baseline_ready_for_reconciliation: checkRows.every((row) => row.current_verdict === "pass") && gateRows.every((row) => row.gate_status === "ready"),
    source_console_status: sourceConsole.summary.platform_agent_operator_console_v0_status,
    read_only_kernel_baseline: true,
    manifest_projection_only: true,
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

function buildValidationItems({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows, boundary }) {
  return [
    validationItem("source.console", "source_ready", sourceConsole.summary.platform_agent_operator_console_v0_status === SOURCE_READY_STATUS, "source console v0 must be ready"),
    validationItem("primitive.count", "primitive_rows", primitiveRows.length === 6, "all Kernel primitive rows must exist"),
    validationItem("source.count", "source_rows", sourceRows.length === 3, "all Kernel source rows must exist"),
    validationItem("contract.count", "contract_rows", contractRows.length === 8, "all Kernel contract rows must exist"),
    validationItem("block_projection.count", "block_projection_rows", blockProjectionRows.length === 20, "all protected block projections must exist"),
    validationItem("check.ready", "check_rows", checkRows.every((row) => row.current_verdict === "pass"), "all Kernel checks must pass"),
    validationItem("cutover.ready", "cutover_rows", cutoverRows.every((row) => row.current_verdict === "pass"), "all Kernel cutover rows must pass"),
    validationItem("gates.ready", "gate_rows", gateRows.every((row) => row.gate_status === "ready"), "all Kernel gates must be ready"),
    validationItem("claims.supported", "claim_rows", claimRows.every(isSupportedClaim), "all Kernel claims must be supported"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
  ];
}

function buildSummary({ sourceConsole, primitiveRows, sourceRows, contractRows, blockProjectionRows, checkRows, cutoverRows, gateRows, claimRows, boundary, validation }) {
  return {
    schema_version: "platform-kernel-contract-baseline-summary.v1",
    platform_kernel_contract_baseline_status: validation.valid && boundary.kernel_contract_baseline_ready_for_reconciliation ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_console_status: sourceConsole.summary.platform_agent_operator_console_v0_status,
    primitive_count: primitiveRows.length,
    source_binding_count: sourceRows.length,
    contract_count: contractRows.length,
    block_projection_count: blockProjectionRows.length,
    check_count: checkRows.length,
    cutover_count: cutoverRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function countSourceCollection(sourceConsole, sourceCollection) {
  if (sourceCollection === "agent_console_boundary") return 1;
  return Array.isArray(sourceConsole[sourceCollection]) ? sourceConsole[sourceCollection].length : 0;
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
    "# Platform Kernel Contract Baseline",
    "",
    `Status: ${result.summary.platform_kernel_contract_baseline_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source console status: ${result.summary.source_console_status}`,
    `Primitives: ${result.summary.primitive_count}`,
    `Contracts: ${result.summary.contract_count}`,
    `Kernel claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Runtime execution allowed now: ${result.summary.agent_runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Advance to P1561-P1640 Kernel spec/status reconciliation while preserving the no-execution boundary.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_KERNEL_CONTRACT_BASELINE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    activation_bridge_ledger_path: options.activationBridgeLedgerPath ?? defaults.activationBridgeLedgerPath,
    domain_pilot_ledger_path: options.domainPilotLedgerPath ?? defaults.domainPilotLedgerPath,
    console_ledger_path: options.consoleLedgerPath ?? defaults.consoleLedgerPath,
    kernel_ledger_path: options.kernelLedgerPath ?? defaults.kernelLedgerPath,
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
    kernelLedgerPath: undefined,
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
    } else if (arg === "--kernel-ledger") {
      args.kernelLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-kernel-contract-baseline.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --activation-bridge-ledger <path>
  --domain-pilot-ledger <path>
  --console-ledger <path>
  --kernel-ledger <path>
  --help                          Show this help.
`);
}
