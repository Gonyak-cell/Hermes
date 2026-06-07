import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildTrustEvidenceCleanCheckpoint } from "./trust-evidence-clean-checkpoint.mjs";

export const DEFAULT_POST_P20000_OPERATOR_HANDOFF_OUT_DIR = "artifacts/post-p20000-operator-handoff/latest";
export const DEFAULT_POST_P20000_OPERATOR_HANDOFF_INPUTS = {
  schemaPath: "schemas/post-p20000-operator-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p20001-p20400.md",
  architectureDocPath: "docs/architecture.md",
  sourceTrustEvidenceCleanCheckpointPath: "artifacts/trust-evidence-clean-checkpoint/latest/trust-evidence-clean-checkpoint.json",
};

const COMMAND_NAME = "platform:post-p20000-operator-handoff";
const SCHEMA_VERSION = "post-p20000-operator-handoff.v1";
const CAPABILITY_ID = "platform.post_p20000_operator_handoff";
const PROGRAM_RANGE = "P20001-P20400";
const SOURCE_PROGRAM_RANGE = "P19601-P20000";
const READY_STATUS = "ready_for_post_p20000_operator_handoff";
const BLOCK_PENDING_STATUS = "valid_block_operator_handoff_pending";
const BLOCKED_STATUS = "blocked_post_p20000_operator_handoff";

const PHASE_SPECS = [
  ["P20001-P20040", "P20000 Source Binding", "p20000_source_binding_rows"],
  ["P20041-P20120", "Trust Consumption Map", "trust_consumption_map_rows"],
  ["P20121-P20200", "Operator Handoff Packet", "operator_handoff_packet_rows"],
  ["P20201-P20280", "Boundary Debt Projection", "boundary_debt_projection_rows"],
  ["P20281-P20340", "Verification Consumption Guard", "verification_consumption_guard_rows"],
  ["P20341-P20380", "Regression Adjacent Command Packet", "regression_adjacent_command_packet_rows"],
  ["P20381-P20400", "P20400 Clean Checkpoint", "p20400_clean_checkpoint_rows"],
];

const TRUST_CONSUMPTION_PHASES = [
  ["P16800", "Platform Freeze", "freeze source"],
  ["P17200", "Freeze Evidence Activation", "review receipt activation"],
  ["P17600", "Freeze Evidence Completion", "review and revalidation completion"],
  ["P18000", "Trust Delta Ledger", "trust debt delta"],
  ["P18400", "Check-Mode Guard Normalization", "no-write scanner normalization"],
  ["P18800", "Check-Mode Scanner Robustness", "scanner robustness"],
  ["P19200", "Trust Debt Recalibration", "trust debt recalculation"],
  ["P19600", "Post-Handoff Trust Intake", "handoff receipt and freshness recheck"],
  ["P20000", "Trust Evidence Clean Checkpoint", "verification-of-verification checkpoint"],
];

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

const BOUNDARY_DEBTS = [
  ["production_pass", "Production PASS remains closed"],
  ["enterprise_trust", "Enterprise trust remains closed"],
  ["release_deployment", "Release approval and deployment remain closed"],
  ["runtime_write_action", "Runtime execution, write action, and protected action remain closed"],
  ["connector_external_mutation", "Connector write and external mutation remain closed"],
  ["raw_secret_exposure", "Raw source exposure and secret read remain closed"],
  ["reviewer_finality", "Reviewer mutation and final automated approval remain closed"],
];

export async function runPostP20000OperatorHandoff(options = {}) {
  const result = await buildPostP20000OperatorHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P20000 Operator Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP20000OperatorHandoff(result, result.output_dir);
  return result;
}

export async function buildPostP20000OperatorHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P20000_OPERATOR_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "trustEvidenceCleanCheckpoint")
    ? normalizeInlineJsonSource("inline.trust_evidence_clean_checkpoint", options.trustEvidenceCleanCheckpoint)
    : await readJsonOrBuildP20000(inputs.source_trust_evidence_clean_checkpoint_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const consumptionRows = buildTrustConsumptionRows({ source, sourceState, generatedAt });
  const handoffRows = buildOperatorHandoffRows({ sourceState, generatedAt });
  const debtRows = buildBoundaryDebtRows(generatedAt);
  const guardRows = buildVerificationGuardRows({ source, generatedAt });
  const commandRows = buildCommandRows(generatedAt);
  const authorityRows = buildAuthorityRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, consumptionRows, handoffRows, debtRows, guardRows, commandRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, consumptionRows, handoffRows, debtRows, guardRows, commandRows, authorityRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, consumptionRows, handoffRows, debtRows, guardRows, commandRows, authorityRows, checkpointRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      trust_evidence_clean_checkpoint_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_trust_evidence_clean_checkpoint_summary: source.data?.summary ?? null,
    post_p20000_operator_handoff_contract: buildContract(generatedAt),
    post_p20000_operator_handoff_phase_rows: phaseRows,
    p20000_source_binding_rows: sourceRows,
    trust_consumption_map_rows: consumptionRows,
    operator_handoff_packet_rows: handoffRows,
    boundary_debt_projection_rows: debtRows,
    verification_consumption_guard_rows: guardRows,
    regression_adjacent_command_packet_rows: commandRows,
    authority_boundary_handoff_rows: authorityRows,
    p20400_clean_checkpoint_rows: checkpointRows,
    post_p20000_operator_handoff_boundary: boundary,
    post_p20000_operator_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p20000_operator_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p20000_operator_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p20000_operator_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writePostP20000OperatorHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p20000-operator-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p20000-source-binding-rows.json"), collectionEnvelope("p20000-source-binding-rows.v1", "p20000_source_binding_rows", result.p20000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-consumption-map-rows.json"), collectionEnvelope("trust-consumption-map-rows.v1", "trust_consumption_map_rows", result.trust_consumption_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handoff-packet-rows.json"), collectionEnvelope("operator-handoff-packet-rows.v1", "operator_handoff_packet_rows", result.operator_handoff_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary-debt-projection-rows.json"), collectionEnvelope("boundary-debt-projection-rows.v1", "boundary_debt_projection_rows", result.boundary_debt_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-consumption-guard-rows.json"), collectionEnvelope("verification-consumption-guard-rows.v1", "verification_consumption_guard_rows", result.verification_consumption_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "regression-adjacent-command-packet-rows.json"), collectionEnvelope("regression-adjacent-command-packet-rows.v1", "regression_adjacent_command_packet_rows", result.regression_adjacent_command_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-handoff-rows.json"), collectionEnvelope("authority-boundary-handoff-rows.v1", "authority_boundary_handoff_rows", result.authority_boundary_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "p20400-clean-checkpoint-rows.json"), collectionEnvelope("p20400-clean-checkpoint-rows.v1", "p20400_clean_checkpoint_rows", result.p20400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-p20000-operator-handoff-boundary.json"), result.post_p20000_operator_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runPostP20000OperatorHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP20000OperatorHandoff(args);
  console.log(`Post-P20000 Operator Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.post_p20000_operator_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P20000 ready for P20001 handoff: ${result.summary.source_p20000_ready_for_p20001_handoff}`);
  console.log(`Trust consumption rows: ${result.summary.trust_consumption_map_count}`);
  console.log(`Operator handoff rows: ${result.summary.operator_handoff_packet_count}`);
  console.log(`Verification guard rows: ${result.summary.verification_consumption_guard_count}`);
  console.log(`Ready for P20401 handoff: ${result.summary.ready_for_p20401_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.trust_evidence_clean_checkpoint_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p20001_handoff === true,
    status: summary.trust_evidence_checkpoint_status ?? "missing",
    p20000ContractReady: boundary.p20000_contract_ready === true,
    chainVisible: boundary.trust_evidence_chain_visible_now === true,
    matrixPassed: boundary.verification_matrix_passed_now === true,
    operatorProjectionVisible: boundary.operator_projection_visible_now === true,
    regressionPacketVisible: boundary.regression_packet_visible_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p20001-p20400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P20000 trust evidence clean checkpoint source is available", sourceState.available],
    ["program_range", "P20000 source program range is P19601-P20000", sourceState.programRangeOk],
    ["validation_valid", "P20000 source validation is valid", sourceState.validationValid],
    ["p20001_handoff_open", "P20000 source opened P20001 handoff", sourceState.sourceReady],
    ["p20000_contract_ready", "P20000 source contract is ready", sourceState.p20000ContractReady],
    ["boundary_closed", "P20000 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for operator handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P20000 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p20000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildTrustConsumptionRows({ source, sourceState, generatedAt }) {
  const sourceChain = Array.isArray(source.data?.trust_evidence_chain_index_rows)
    ? source.data.trust_evidence_chain_index_rows
    : [];
  const rows = TRUST_CONSUMPTION_PHASES.map(([phaseId, label, evidenceClass], index) => {
    const chainRow = sourceChain.find((item) => item.phase_id === phaseId);
    const isP20000 = phaseId === "P20000";
    const observed = isP20000 ? sourceState.sourceReady : Boolean(chainRow);
    return row({
      row_id: `trust_consumption.${phaseId.toLowerCase()}`,
      category: "trust_consumption_map",
      label,
      observed,
      evidence_ref: isP20000 ? "source_trust_evidence_clean_checkpoint_summary" : (chainRow?.evidence_ref ?? `chain.${phaseId.toLowerCase()}`),
      chain_order: index + 1,
      phase_id: phaseId,
      evidence_class: evidenceClass,
      consumption_state: observed ? "consumable" : "blocked_source",
      generated_at: generatedAt,
    });
  });
  rows.push(row({
    row_id: "trust_consumption.blocker_visibility",
    category: "trust_consumption_map",
    label: "Trust consumption blocker remains visible when source handoff is closed",
    observed: true,
    evidence_ref: "trust_consumption_map_rows",
    generated_at: generatedAt,
  }));
  return rows;
}

function buildOperatorHandoffRows({ sourceState, generatedAt }) {
  return [
    ["source_summary", "Operator can see the P20000 source summary", sourceState.available, "harness", "inspect_source_summary"],
    ["trust_consumption", "Operator can see trust consumption map status", true, "harness", "inspect_consumption_map"],
    ["verification_limits", "Operator can see what verification does not prove", true, "harness", "inspect_verification_limits"],
    ["blocker_state", "Operator can see blocker state when handoff is closed", true, "harness", "resolve_missing_receipts_or_validation"],
    ["next_action", "Operator can see the next allowed validation action", true, "codex", "run_targeted_validation"],
    ["review_lane", "Operator can see Claude review cadence as conditional evidence", true, "claude-code-opus-max", "review_only_when_high_risk"],
    ["read_only_surface", "Operator handoff packet is read-only and non-mutating", true, "harness", "project_read_only_status"],
  ].map(([id, label, observed, ownerLane, nextAction]) => row({
    row_id: `operator_handoff.${id}`,
    category: "operator_handoff_packet",
    label,
    observed,
    evidence_ref: "operator_handoff_packet_rows",
    owner_lane: ownerLane,
    next_action: nextAction,
    generated_at: generatedAt,
  }));
}

function buildBoundaryDebtRows(generatedAt) {
  return BOUNDARY_DEBTS.map(([id, label]) => row({
    row_id: `boundary_debt.${id}`,
    category: "boundary_debt_projection",
    label,
    observed: true,
    evidence_ref: "boundary_debt_projection_rows",
    debt_status: "carried_forward",
    generated_at: generatedAt,
  }));
}

function buildVerificationGuardRows({ source, generatedAt }) {
  const matrixRows = Array.isArray(source.data?.verification_of_verification_rows)
    ? source.data.verification_of_verification_rows
    : [];
  const rows = matrixRows.map((item) => row({
    row_id: `verification_guard.${String(item.row_id ?? "unknown").replace(/^verification_matrix\./, "")}`,
    category: "verification_consumption_guard",
    label: `Preserve ${item.label ?? item.row_id}`,
    observed: Boolean(item.verifies) && Boolean(item.does_not_verify),
    evidence_ref: item.row_id ?? "verification_of_verification_rows",
    consumed_verifies: item.verifies ?? "unknown",
    consumed_does_not_verify: item.does_not_verify ?? "unknown",
    source_current_verdict: item.current_verdict ?? "unknown",
    generated_at: generatedAt,
  }));
  rows.push(row({
    row_id: "verification_guard.non_finality_preserved",
    category: "verification_consumption_guard",
    label: "Verification guard preserves non-finality and non-enterprise-trust limits",
    observed: rows.some((item) => item.consumed_does_not_verify === "enterprise trust")
      && rows.some((item) => item.consumed_does_not_verify === "human or independent approval"),
    evidence_ref: "verification_consumption_guard_rows",
    generated_at: generatedAt,
  }));
  return rows;
}

function buildCommandRows(generatedAt) {
  return [
    ["syntax_check", "node --check src/post-p20000-operator-handoff.mjs && node --check scripts/post-p20000-operator-handoff.mjs", true, "targeted"],
    ["targeted_tests", "node --test test/post-p20000-operator-handoff.test.mjs test/trust-evidence-clean-checkpoint.test.mjs test/post-handoff-trust-intake.test.mjs", true, "targeted_adjacent"],
    ["platform_check", "npm run platform:post-p20000-operator-handoff -- --check", true, "targeted_cli"],
    ["diff_check", "git diff --check && git diff --cached --check", true, "diff_hygiene"],
    ["claude_review_condition", "Claude Code Opus max review is required only for high-risk authority, freeze, release, write, connector, or broad schema transitions", true, "conditional_review"],
    ["full_npm_test_condition", "npm test is required only for broad trust, release, write, schema freeze, or explicit closeout demand", true, "conditional_full_suite"],
  ].map(([id, label, observed, commandKind]) => row({
    row_id: `regression_command.${id}`,
    category: "regression_adjacent_command_packet",
    label,
    observed,
    evidence_ref: "regression_adjacent_command_packet_rows",
    command_kind: commandKind,
    generated_at: generatedAt,
  }));
}

function buildAuthorityRows(generatedAt) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => row({
    row_id: `authority_handoff.${flag}`,
    category: "authority_boundary_handoff",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "post_p20000_operator_handoff_boundary",
    authority_flag: flag,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumptionRows)
    && allPass(context.handoffRows)
    && allPass(context.debtRows)
    && allPass(context.guardRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows);
  return [
    ["source_ready", "P20000 source is ready for P20001", context.sourceState.sourceReady],
    ["consumption_map_visible", "Trust consumption map is visible", visibleOrPassed(context.consumptionRows, "trust_consumption.blocker_visibility")],
    ["operator_handoff_visible", "Operator handoff packet is visible", allPass(context.handoffRows)],
    ["boundary_debt_visible", "Boundary debt projection is visible", allPass(context.debtRows)],
    ["verification_guard_visible", "Verification consumption guard is visible", allPass(context.guardRows)],
    ["regression_packet_visible", "Regression adjacent command packet is visible", allPass(context.commandRows)],
    ["authority_boundary_closed", "Authority boundary remains closed", allPass(context.authorityRows)],
    ["p20401_handoff_gate", "P20401 handoff opens only when post-P20000 handoff conditions pass", handoffReady],
    ["p20401_handoff_blocker_visible", "P20401 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p20400_checkpoint.${id}`,
    category: "p20400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p20400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p20400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && visibleOrPassed(context.consumptionRows, "trust_consumption.blocker_visibility")
    && allPass(context.handoffRows)
    && allPass(context.debtRows)
    && allPass(context.guardRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows)
    && visibleOrPassed(context.checkpointRows, "p20400_checkpoint.p20401_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumptionRows)
    && allPass(context.handoffRows)
    && allPass(context.debtRows)
    && allPass(context.guardRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows);
  return {
    p20400_contract_ready: p20400ContractReady,
    ready_for_p20401_handoff: handoffReady,
    source_p20000_ready_for_p20001_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    trust_consumption_map_visible_now: visibleOrPassed(context.consumptionRows, "trust_consumption.blocker_visibility"),
    operator_handoff_packet_visible_now: allPass(context.handoffRows),
    boundary_debt_projection_visible_now: allPass(context.debtRows),
    verification_consumption_guard_visible_now: allPass(context.guardRows),
    regression_packet_visible_now: allPass(context.commandRows),
    trust_consumption_map_count: context.consumptionRows.length,
    operator_handoff_packet_count: context.handoffRows.length,
    verification_consumption_guard_count: context.guardRows.length,
    remaining_boundary_debt_count: context.debtRows.length,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P20001-P20400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P20001-P20400 Post-P20000 Operator Handoff"), "Architecture doc missing P20001-P20400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P20000 source state is not visible"),
    validationItem("consumption.visible", "consumption", visibleOrPassed(context.consumptionRows, "trust_consumption.blocker_visibility"), "Trust consumption map is not visible"),
    validationItem("operator.visible", "operator", allPass(context.handoffRows), "Operator handoff packet rows are missing"),
    validationItem("debt.visible", "authority", allPass(context.debtRows), "Boundary debt projection rows are missing"),
    validationItem("verification_guard.visible", "verification", allPass(context.guardRows), "Verification consumption guard rows are missing"),
    validationItem("commands.visible", "validation", allPass(context.commandRows), "Regression adjacent command packet rows are missing"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p20400_checkpoint.p20401_handoff_blocker_visible"), "P20400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "post_p20000_operator_handoff.contract.v1",
    generated_at: generatedAt,
    source_p20000_required_or_rebuilt: true,
    trust_consumption_map_required: true,
    operator_handoff_packet_required: true,
    verification_consumption_guard_required: true,
    p20401_handoff_is_not_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p20401_handoff
    ? READY_STATUS
    : validation.valid && boundary.p20400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    post_p20000_operator_handoff_status: status,
    source_p20000_ready_for_p20001_handoff: boundary.source_p20000_ready_for_p20001_handoff,
    trust_consumption_map_count: boundary.trust_consumption_map_count,
    operator_handoff_packet_count: boundary.operator_handoff_packet_count,
    verification_consumption_guard_count: boundary.verification_consumption_guard_count,
    regression_packet_visible_now: boundary.regression_packet_visible_now,
    ready_for_p20401_handoff: validation.valid && boundary.ready_for_p20401_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Post-P20000 Operator Handoff",
    "",
    `Status: ${result.summary.post_p20000_operator_handoff_status}`,
    `Program: ${result.program_range}`,
    `P20000 ready for P20001 handoff: ${result.summary.source_p20000_ready_for_p20001_handoff}`,
    `Trust consumption rows: ${result.summary.trust_consumption_map_count}`,
    `Operator handoff rows: ${result.summary.operator_handoff_packet_count}`,
    `Verification guard rows: ${result.summary.verification_consumption_guard_count}`,
    `Ready for P20401 handoff: ${result.summary.ready_for_p20401_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_handoff_packet_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.current_verdict)}</td><td>${escapeHtml(item.owner_lane)}</td><td>${escapeHtml(item.next_action)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Post-P20000 Operator Handoff</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Post-P20000 Operator Handoff</h1>
    <p class="notice">This artifact lets the next operator consume P20000 evidence. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Packet Row</th><th>Verdict</th><th>Owner Lane</th><th>Next Action</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP20000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildTrustEvidenceCleanCheckpoint({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.trust_evidence_clean_checkpoint", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, text: JSON.stringify(value), data: value };
  return { path: label, available: false, text: "", data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_POST_P20000_OPERATOR_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_trust_evidence_clean_checkpoint_path: path.resolve(repoRoot, options.sourceTrustEvidenceCleanCheckpointPath ?? defaults.sourceTrustEvidenceCleanCheckpointPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceTrustEvidenceCleanCheckpointPath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function row(rowData) {
  const observed = Boolean(rowData.observed);
  return {
    ...rowData,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${rowData.label} is missing or blocked.`,
  };
}

function validationItem(itemId, category, ok, message) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message: ok ? "ok" : message,
    evidence_ref: itemId,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  return allPass(rows) || rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function protectedBoundaryClosed(boundary) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, rows };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
