import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPostHandoffTrustIntake } from "./post-handoff-trust-intake.mjs";

export const DEFAULT_TRUST_EVIDENCE_CLEAN_CHECKPOINT_OUT_DIR = "artifacts/trust-evidence-clean-checkpoint/latest";
export const DEFAULT_TRUST_EVIDENCE_CLEAN_CHECKPOINT_INPUTS = {
  schemaPath: "schemas/trust-evidence-clean-checkpoint.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p19601-p20000.md",
  architectureDocPath: "docs/architecture.md",
  sourcePostHandoffTrustIntakePath: "artifacts/post-handoff-trust-intake/latest/post-handoff-trust-intake.json",
};

const COMMAND_NAME = "platform:trust-evidence-clean-checkpoint";
const SCHEMA_VERSION = "trust-evidence-clean-checkpoint.v1";
const CAPABILITY_ID = "platform.trust_evidence_clean_checkpoint";
const PROGRAM_RANGE = "P19601-P20000";
const SOURCE_PROGRAM_RANGE = "P19201-P19600";
const READY_STATUS = "ready_for_trust_evidence_clean_checkpoint";
const BLOCK_PENDING_STATUS = "valid_block_checkpoint_pending";
const BLOCKED_STATUS = "blocked_trust_evidence_clean_checkpoint";

const PHASE_SPECS = [
  ["P19601-P19640", "P19600 Source Binding", "p19600_source_binding_rows"],
  ["P19641-P19700", "Trust Evidence Chain Index", "trust_evidence_chain_index_rows"],
  ["P19701-P19760", "Verification-Of-Verification Matrix", "verification_of_verification_rows"],
  ["P19761-P19820", "Operator Trust Projection", "operator_trust_checkpoint_rows"],
  ["P19821-P19900", "Remaining Authority Debt", "remaining_authority_debt_rows"],
  ["P19901-P19960", "Regression Command Packet", "regression_command_packet_rows"],
  ["P19961-P20000", "P20000 Clean Checkpoint", "p20000_clean_checkpoint_rows"],
];

const TRUST_CHAIN = [
  ["P16800", "Platform Freeze", "platform freeze source"],
  ["P17200", "Freeze Evidence Activation", "review receipt activation"],
  ["P17600", "Freeze Evidence Completion", "review and revalidation completion"],
  ["P18000", "Trust Delta Ledger", "trust debt delta"],
  ["P18400", "Check-Mode Guard Normalization", "no-write scanner normalization"],
  ["P18800", "Check-Mode Scanner Robustness", "scanner robustness and finding closure"],
  ["P19200", "Trust Debt Recalibration", "trust debt recalculation"],
  ["P19600", "Post-Handoff Trust Intake", "handoff receipt and freshness recheck"],
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

const REMAINING_AUTHORITY_DEBTS = [
  ["production_pass", "Production PASS remains closed"],
  ["enterprise_trust", "Enterprise trust remains closed"],
  ["release_deployment", "Release approval and deployment remain closed"],
  ["runtime_write", "Runtime execution and write action remain closed"],
  ["connector_external_mutation", "Connector write and external mutation remain closed"],
  ["raw_secret", "Raw exposure and secret read remain closed"],
  ["reviewer_finality", "Reviewer mutation and final automated approval remain closed"],
];

export async function runTrustEvidenceCleanCheckpoint(options = {}) {
  const result = await buildTrustEvidenceCleanCheckpoint(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trust Evidence Clean Checkpoint failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeTrustEvidenceCleanCheckpoint(result, result.output_dir);
  return result;
}

export async function buildTrustEvidenceCleanCheckpoint(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRUST_EVIDENCE_CLEAN_CHECKPOINT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "postHandoffTrustIntake")
    ? normalizeInlineJsonSource("inline.post_handoff_trust_intake", options.postHandoffTrustIntake)
    : await readJsonOrBuildP19600(inputs.source_post_handoff_trust_intake_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const chainRows = buildChainRows({ sourceState, generatedAt });
  const verificationRows = buildVerificationRows({ sourceState, commitRef, generatedAt });
  const operatorRows = buildOperatorRows({ sourceState, generatedAt });
  const debtRows = buildDebtRows(generatedAt);
  const commandRows = buildCommandRows(generatedAt);
  const authorityRows = buildAuthorityRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, chainRows, verificationRows, operatorRows, debtRows, commandRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, chainRows, verificationRows, operatorRows, debtRows, commandRows, authorityRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, chainRows, verificationRows, operatorRows, debtRows, commandRows, authorityRows, checkpointRows, boundary });
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
      post_handoff_trust_intake_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_post_handoff_trust_summary: source.data?.summary ?? null,
    trust_evidence_clean_checkpoint_contract: buildContract(generatedAt),
    trust_evidence_checkpoint_phase_rows: phaseRows,
    p19600_source_binding_rows: sourceRows,
    trust_evidence_chain_index_rows: chainRows,
    verification_of_verification_rows: verificationRows,
    operator_trust_checkpoint_rows: operatorRows,
    remaining_authority_debt_rows: debtRows,
    regression_command_packet_rows: commandRows,
    authority_boundary_checkpoint_rows: authorityRows,
    p20000_clean_checkpoint_rows: checkpointRows,
    trust_evidence_clean_checkpoint_boundary: boundary,
    trust_evidence_clean_checkpoint_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "trust_evidence_clean_checkpoint")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.trust_evidence_clean_checkpoint_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.trust_evidence_clean_checkpoint_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeTrustEvidenceCleanCheckpoint(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trust-evidence-clean-checkpoint.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p19600-source-binding-rows.json"), collectionEnvelope("p19600-source-binding-rows.v1", "p19600_source_binding_rows", result.p19600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-evidence-chain-index-rows.json"), collectionEnvelope("trust-evidence-chain-index-rows.v1", "trust_evidence_chain_index_rows", result.trust_evidence_chain_index_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-of-verification-rows.json"), collectionEnvelope("verification-of-verification-rows.v1", "verification_of_verification_rows", result.verification_of_verification_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-trust-checkpoint-rows.json"), collectionEnvelope("operator-trust-checkpoint-rows.v1", "operator_trust_checkpoint_rows", result.operator_trust_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "remaining-authority-debt-rows.json"), collectionEnvelope("remaining-authority-debt-rows.v1", "remaining_authority_debt_rows", result.remaining_authority_debt_rows, result.generated_at));
  await writeJson(path.join(outDir, "regression-command-packet-rows.json"), collectionEnvelope("regression-command-packet-rows.v1", "regression_command_packet_rows", result.regression_command_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-checkpoint-rows.json"), collectionEnvelope("authority-boundary-checkpoint-rows.v1", "authority_boundary_checkpoint_rows", result.authority_boundary_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "p20000-clean-checkpoint-rows.json"), collectionEnvelope("p20000-clean-checkpoint-rows.v1", "p20000_clean_checkpoint_rows", result.p20000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-evidence-clean-checkpoint-boundary.json"), result.trust_evidence_clean_checkpoint_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runTrustEvidenceCleanCheckpointCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runTrustEvidenceCleanCheckpoint(args);
  console.log(`Trust Evidence Clean Checkpoint ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.trust_evidence_checkpoint_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P19600 ready for P19601 handoff: ${result.summary.source_p19600_ready_for_p19601_handoff}`);
  console.log(`Chain rows: ${result.summary.trust_evidence_chain_count}`);
  console.log(`Verification matrix rows: ${result.summary.verification_matrix_count}`);
  console.log(`Regression packet visible: ${result.summary.regression_packet_visible_now}`);
  console.log(`Ready for P20001 handoff: ${result.summary.ready_for_p20001_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.post_handoff_trust_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p19601_handoff === true,
    status: summary.post_handoff_trust_status ?? "missing",
    receiptsPassed: summary.handoff_receipts_passed_now === true,
    freshnessPassed: summary.evidence_freshness_passed_now === true,
    commitRefPresent: summary.source_commit_ref_present_now === true,
    contractReady: boundary.p19600_contract_ready === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p19601-p20000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P19600 post-handoff trust intake source is available", sourceState.available],
    ["program_range", "P19600 source program range is P19201-P19600", sourceState.programRangeOk],
    ["validation_valid", "P19600 source validation is valid", sourceState.validationValid],
    ["p19601_handoff_open", "P19600 source opened P19601 handoff", sourceState.sourceReady],
    ["boundary_closed", "P19600 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for clean checkpoint", Boolean(commitRef)],
    ["source_blocker_visible", "P19600 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p19600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildChainRows({ sourceState, generatedAt }) {
  return TRUST_CHAIN.map(([phaseId, label, evidenceClass], index) => {
    const isCurrentSource = phaseId === "P19600";
    return row({
      row_id: `trust_chain.${phaseId.toLowerCase()}`,
      category: "trust_evidence_chain_index",
      label,
      observed: isCurrentSource ? sourceState.available : true,
      evidence_ref: isCurrentSource ? "source_post_handoff_trust_summary" : `chain.${phaseId.toLowerCase()}`,
      chain_order: index + 1,
      phase_id: phaseId,
      evidence_class: evidenceClass,
      evidence_state: isCurrentSource ? (sourceState.sourceReady ? "ready_source" : "blocked_source") : "carried_forward_index",
      generated_at: generatedAt,
    });
  });
}

function buildVerificationRows({ sourceState, commitRef, generatedAt }) {
  return [
    ["source_artifact_validation", "P19600 artifact schema and validation were rechecked", sourceState.available && sourceState.programRangeOk && sourceState.validationValid, "source format and validation", "production readiness"],
    ["source_handoff_validation", "P19601 handoff flag was rechecked", sourceState.sourceReady, "handoff readiness", "release approval"],
    ["receipt_validation", "Review and validation receipts were rechecked through P19600", sourceState.receiptsPassed, "receipt evidence state", "final approval"],
    ["freshness_validation", "Freshness and commit-ref state were rechecked through P19600", sourceState.freshnessPassed && sourceState.commitRefPresent && Boolean(commitRef), "fresh evidence state", "enterprise trust"],
    ["authority_validation", "Protected authority boundary remains closed", sourceState.boundaryClosed, "closed authority boundary", "permission to act"],
    ["non_finality_validation", "Verification evidence is not a final approval", true, "non-finality invariant", "human or independent approval"],
    ["blocker_visibility_validation", "Missing source, receipt, freshness, or authority blockers stay visible", true, "blocker visibility", "automatic remediation"],
  ].map(([id, label, observed, verifies, doesNotVerify]) => row({
    row_id: `verification_matrix.${id}`,
    category: "verification_of_verification",
    label,
    observed,
    verifies,
    does_not_verify: doesNotVerify,
    evidence_ref: "verification_of_verification_rows",
    generated_at: generatedAt,
  }));
}

function buildOperatorRows({ sourceState, generatedAt }) {
  return [
    ["verified_state", "Operator can see what was verified", sourceState.available],
    ["not_enterprise_state", "Operator can see this is not enterprise trust", true],
    ["blocked_state", "Operator can see blocker state when handoff is closed", true],
    ["next_action_state", "Operator can see next allowed validation action", true],
    ["no_mutation_state", "Operator projection is read-only and non-mutating", true],
  ].map(([id, label, observed]) => row({
    row_id: `operator_checkpoint.${id}`,
    category: "operator_trust_checkpoint",
    label,
    observed,
    evidence_ref: "operator_trust_checkpoint_rows",
    generated_at: generatedAt,
  }));
}

function buildDebtRows(generatedAt) {
  return REMAINING_AUTHORITY_DEBTS.map(([id, label]) => row({
    row_id: `remaining_authority_debt.${id}`,
    category: "remaining_authority_debt",
    label,
    observed: true,
    evidence_ref: "remaining_authority_debt_rows",
    debt_status: "carried_forward",
    generated_at: generatedAt,
  }));
}

function buildCommandRows(generatedAt) {
  return [
    ["syntax_check", "node --check src/trust-evidence-clean-checkpoint.mjs && node --check scripts/trust-evidence-clean-checkpoint.mjs", true, "targeted"],
    ["targeted_tests", "node --test test/trust-evidence-clean-checkpoint.test.mjs test/post-handoff-trust-intake.test.mjs test/trust-debt-recalibration.test.mjs", true, "targeted_adjacent"],
    ["platform_check", "npm run platform:trust-evidence-clean-checkpoint -- --check", true, "targeted_cli"],
    ["diff_check", "git diff --check && git diff --cached --check", true, "diff_hygiene"],
    ["full_npm_test_condition", "npm test is required only for broad trust/release/write/schema freeze or explicit closeout demand", true, "conditional_full_suite"],
  ].map(([id, label, observed, commandKind]) => row({
    row_id: `regression_command.${id}`,
    category: "regression_command_packet",
    label,
    observed,
    evidence_ref: "regression_command_packet_rows",
    command_kind: commandKind,
    generated_at: generatedAt,
  }));
}

function buildAuthorityRows(generatedAt) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => row({
    row_id: `authority_checkpoint.${flag}`,
    category: "authority_boundary_checkpoint",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "trust_evidence_clean_checkpoint_boundary",
    authority_flag: flag,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.chainRows)
    && allPass(context.verificationRows)
    && allPass(context.operatorRows)
    && allPass(context.debtRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows);
  return [
    ["source_ready", "P19600 source is ready for P19601", context.sourceState.sourceReady],
    ["chain_visible", "Trust evidence chain index is visible", allPass(context.chainRows)],
    ["verification_matrix_passed", "Verification-of-verification matrix passed", allPass(context.verificationRows)],
    ["operator_projection_visible", "Operator trust checkpoint projection is visible", allPass(context.operatorRows)],
    ["authority_debt_carried", "Remaining authority debt is carried forward", allPass(context.debtRows)],
    ["regression_packet_visible", "Regression command packet is visible", allPass(context.commandRows)],
    ["authority_boundary_closed", "Authority boundary remains closed", allPass(context.authorityRows)],
    ["p20001_handoff_gate", "P20001 handoff opens only when clean checkpoint conditions pass", handoffReady],
    ["p20001_handoff_blocker_visible", "P20001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p20000_checkpoint.${id}`,
    category: "p20000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p20000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p20000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.chainRows)
    && visibleOrPassed(context.verificationRows, "verification_matrix.blocker_visibility_validation")
    && allPass(context.operatorRows)
    && allPass(context.debtRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows)
    && visibleOrPassed(context.checkpointRows, "p20000_checkpoint.p20001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.chainRows)
    && allPass(context.verificationRows)
    && allPass(context.operatorRows)
    && allPass(context.debtRows)
    && allPass(context.commandRows)
    && allPass(context.authorityRows);
  return {
    p20000_contract_ready: p20000ContractReady,
    ready_for_p20001_handoff: handoffReady,
    source_p19600_ready_for_p19601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    trust_evidence_chain_visible_now: allPass(context.chainRows),
    verification_matrix_passed_now: allPass(context.verificationRows),
    operator_projection_visible_now: allPass(context.operatorRows),
    regression_packet_visible_now: allPass(context.commandRows),
    remaining_authority_debt_count: context.debtRows.length,
    trust_evidence_chain_count: context.chainRows.length,
    verification_matrix_count: context.verificationRows.length,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P19601-P20000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P19601-P20000 Trust Evidence Clean Checkpoint"), "Architecture doc missing P19601-P20000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P19600 source state is not visible"),
    validationItem("chain.visible", "chain", allPass(context.chainRows), "Trust evidence chain index is not visible"),
    validationItem("verification.visible", "verification", visibleOrPassed(context.verificationRows, "verification_matrix.blocker_visibility_validation"), "Verification-of-verification matrix is not visible"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator checkpoint rows are not visible"),
    validationItem("debt.visible", "authority", allPass(context.debtRows), "Remaining authority debt rows are missing"),
    validationItem("commands.visible", "validation", allPass(context.commandRows), "Regression command packet rows are missing"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p20000_checkpoint.p20001_handoff_blocker_visible"), "P20000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "trust_evidence_clean_checkpoint.contract.v1",
    generated_at: generatedAt,
    source_p19600_required_or_rebuilt: true,
    verification_of_verification_required: true,
    operator_projection_required: true,
    regression_command_packet_required: true,
    p20001_handoff_is_not_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p20001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p20000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    trust_evidence_checkpoint_status: status,
    source_p19600_ready_for_p19601_handoff: boundary.source_p19600_ready_for_p19601_handoff,
    trust_evidence_chain_count: boundary.trust_evidence_chain_count,
    verification_matrix_count: boundary.verification_matrix_count,
    operator_projection_visible_now: boundary.operator_projection_visible_now,
    regression_packet_visible_now: boundary.regression_packet_visible_now,
    ready_for_p20001_handoff: validation.valid && boundary.ready_for_p20001_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Trust Evidence Clean Checkpoint",
    "",
    `Status: ${result.summary.trust_evidence_checkpoint_status}`,
    `Program: ${result.program_range}`,
    `P19600 ready for P19601 handoff: ${result.summary.source_p19600_ready_for_p19601_handoff}`,
    `Chain rows: ${result.summary.trust_evidence_chain_count}`,
    `Verification matrix rows: ${result.summary.verification_matrix_count}`,
    `Regression packet visible: ${result.summary.regression_packet_visible_now}`,
    `Ready for P20001 handoff: ${result.summary.ready_for_p20001_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.verification_of_verification_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.current_verdict)}</td><td>${escapeHtml(item.verifies)}</td><td>${escapeHtml(item.does_not_verify)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Trust Evidence Clean Checkpoint</title>
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
    <h1>Hermes Trust Evidence Clean Checkpoint</h1>
    <p class="notice">This artifact verifies the verification chain. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Check</th><th>Verdict</th><th>Verifies</th><th>Does Not Verify</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP19600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildPostHandoffTrustIntake({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.post_handoff_trust_intake", built);
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
  const defaults = DEFAULT_TRUST_EVIDENCE_CLEAN_CHECKPOINT_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_post_handoff_trust_intake_path: path.resolve(repoRoot, options.sourcePostHandoffTrustIntakePath ?? defaults.sourcePostHandoffTrustIntakePath),
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
      args.sourcePostHandoffTrustIntakePath = argv[++index];
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

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, html, ...serializable } = result;
  return serializable;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
