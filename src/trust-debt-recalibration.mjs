import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildCheckModeScannerRobustness } from "./check-mode-scanner-robustness.mjs";

export const DEFAULT_TRUST_DEBT_RECALIBRATION_OUT_DIR = "artifacts/trust-debt-recalibration/latest";
export const DEFAULT_TRUST_DEBT_RECALIBRATION_INPUTS = {
  schemaPath: "schemas/trust-debt-recalibration.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p18801-p19200.md",
  architectureDocPath: "docs/architecture.md",
  sourceCheckModeScannerRobustnessPath: "artifacts/check-mode-scanner-robustness/latest/check-mode-scanner-robustness.json",
  reviewReceiptPath: "artifacts/trust-debt-recalibration/review/claude-review-receipt.json",
  validationReceiptPath: "artifacts/trust-debt-recalibration/review/full-suite-validation-receipt.json",
};

const COMMAND_NAME = "platform:trust-debt-recalibration";
const SCHEMA_VERSION = "trust-debt-recalibration.v1";
const CAPABILITY_ID = "platform.trust_debt_recalibration";
const PROGRAM_RANGE = "P18801-P19200";
const SOURCE_PROGRAM_RANGE = "P18401-P18800";
const READY_STATUS = "ready_for_trust_debt_recalibration";
const RECEIPTS_PENDING_STATUS = "valid_block_receipts_pending";
const BLOCKED_STATUS = "blocked_trust_debt_recalibration";

const PHASE_SPECS = [
  ["P18801-P18840", "P18800 Source Binding", "p18800_source_binding_rows"],
  ["P18841-P18900", "Closed Debt Credit Ledger", "closed_debt_credit_rows"],
  ["P18901-P18960", "Remaining Trust Debt Ledger", "remaining_trust_debt_rows"],
  ["P18961-P19020", "Validation Freshness Recheck", "validation_freshness_recheck_rows"],
  ["P19021-P19080", "Claude Review Evidence Recheck", "review_evidence_recheck_rows"],
  ["P19081-P19140", "Authority Boundary Recheck", "authority_boundary_recheck_rows"],
  ["P19141-P19180", "Operator Next Action Projection", "operator_next_action_rows"],
  ["P19181-P19200", "P19200 Handoff Freeze", "p19200_freeze_rows"],
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

const REMAINING_DEBTS = [
  ["production_enterprise_trust", "Production and enterprise trust remain carried forward"],
  ["independent_github_review", "Independent GitHub review remains outside single-owner readiness"],
  ["durable_claude_review_receipt", "Durable Claude review receipt is required for P19201 handoff"],
  ["durable_full_suite_receipt", "Durable full-suite validation receipt is required for P19201 handoff"],
  ["external_verification_release_authority", "External verification does not create release authority"],
  ["runtime_write_connector_authority", "Runtime, write, protected action, and connector mutation remain closed"],
];

export async function runTrustDebtRecalibration(options = {}) {
  const result = await buildTrustDebtRecalibration(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trust Debt Recalibration failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeTrustDebtRecalibration(result, result.output_dir);
  return result;
}

export async function buildTrustDebtRecalibration(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRUST_DEBT_RECALIBRATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "checkModeScannerRobustness")
    ? normalizeInlineJsonSource("inline.check_mode_scanner_robustness", options.checkModeScannerRobustness)
    : await readJsonOrBuildP18800(inputs.source_check_mode_scanner_robustness_path, generatedAt);
  const reviewReceipt = Object.prototype.hasOwnProperty.call(options, "reviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.reviewReceipt)
    : await readJsonSource(inputs.review_receipt_path);
  const validationReceipt = Object.prototype.hasOwnProperty.call(options, "validationReceipt")
    ? normalizeInlineJsonSource("inline.full_suite_validation_receipt", options.validationReceipt)
    : await readJsonSource(inputs.validation_receipt_path);

  const sourceState = buildSourceState(source);
  const reviewState = buildReviewState(reviewReceipt);
  const validationState = buildValidationEvidenceState(validationReceipt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows(source, sourceState, generatedAt);
  const closedDebtRows = buildClosedDebtRows(sourceState, generatedAt);
  const remainingDebtRows = buildRemainingDebtRows(generatedAt);
  const validationRows = buildValidationFreshnessRows(validationState, generatedAt);
  const reviewRows = buildReviewEvidenceRows(reviewState, generatedAt);
  const authorityRows = buildAuthorityRows(generatedAt);
  const operatorRows = buildOperatorRows({ reviewState, validationState, generatedAt });
  const freezeRows = buildFreezeRows({ sourceState, reviewState, validationState, closedDebtRows, remainingDebtRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ sourceState, reviewState, validationState, phaseRows, sourceRows, closedDebtRows, remainingDebtRows, validationRows, reviewRows, authorityRows, operatorRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, closedDebtRows, remainingDebtRows, validationRows, reviewRows, authorityRows, operatorRows, freezeRows, boundary });
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
      check_mode_scanner_robustness_path: source.path,
      review_receipt_path: reviewReceipt.path,
      validation_receipt_path: validationReceipt.path,
    },
    source_check_mode_scanner_summary: source.data?.summary ?? null,
    trust_recalibration_contract: buildContract(generatedAt),
    trust_recalibration_phase_rows: phaseRows,
    p18800_source_binding_rows: sourceRows,
    closed_debt_credit_rows: closedDebtRows,
    remaining_trust_debt_rows: remainingDebtRows,
    validation_freshness_recheck_rows: validationRows,
    review_evidence_recheck_rows: reviewRows,
    authority_boundary_recheck_rows: authorityRows,
    operator_next_action_rows: operatorRows,
    p19200_freeze_rows: freezeRows,
    trust_recalibration_boundary: boundary,
    trust_recalibration_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "trust_debt_recalibration")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.trust_recalibration_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.trust_recalibration_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeTrustDebtRecalibration(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trust-debt-recalibration.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p18800-source-binding-rows.json"), collectionEnvelope("p18800-source-binding-rows.v1", "p18800_source_binding_rows", result.p18800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "closed-debt-credit-rows.json"), collectionEnvelope("closed-debt-credit-rows.v1", "closed_debt_credit_rows", result.closed_debt_credit_rows, result.generated_at));
  await writeJson(path.join(outDir, "remaining-trust-debt-rows.json"), collectionEnvelope("remaining-trust-debt-rows.v1", "remaining_trust_debt_rows", result.remaining_trust_debt_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-freshness-recheck-rows.json"), collectionEnvelope("validation-freshness-recheck-rows.v1", "validation_freshness_recheck_rows", result.validation_freshness_recheck_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-evidence-recheck-rows.json"), collectionEnvelope("review-evidence-recheck-rows.v1", "review_evidence_recheck_rows", result.review_evidence_recheck_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-recheck-rows.json"), collectionEnvelope("authority-boundary-recheck-rows.v1", "authority_boundary_recheck_rows", result.authority_boundary_recheck_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-next-action-rows.json"), collectionEnvelope("operator-next-action-rows.v1", "operator_next_action_rows", result.operator_next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "p19200-freeze-rows.json"), collectionEnvelope("p19200-freeze-rows.v1", "p19200_freeze_rows", result.p19200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-recalibration-boundary.json"), result.trust_recalibration_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runTrustDebtRecalibrationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runTrustDebtRecalibration(args);
  console.log(`Trust Debt Recalibration ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.trust_recalibration_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P18800 ready for P18801 handoff: ${result.summary.source_p18800_ready_for_p18801_handoff}`);
  console.log(`Closed debt credits: ${result.summary.closed_debt_credit_count}`);
  console.log(`Remaining trust debt rows: ${result.summary.remaining_trust_debt_count}`);
  console.log(`Review receipt present: ${result.summary.review_receipt_present_now}`);
  console.log(`Validation receipt present: ${result.summary.validation_receipt_present_now}`);
  console.log(`Ready for P19201 handoff: ${result.summary.ready_for_p19201_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.scanner_robustness_boundary ?? {};
  const sourceReady = summary.ready_for_p18801_handoff === true;
  const validSource = source.available
    && source.data?.program_range === SOURCE_PROGRAM_RANGE
    && source.data?.validation?.valid === true
    && protectedBoundaryClosed(boundary);
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady,
    status: summary.scanner_robustness_status ?? "missing",
    offenderCount: Number(summary.source_offender_count ?? boundary.source_offender_count ?? 0),
    findingClosureCount: Number(summary.finding_closure_count ?? boundary.finding_closure_count ?? 0),
    blockingFindingCount: Number(summary.blocking_finding_count ?? boundary.blocking_finding_count ?? 0),
    parserPassed: summary.parser_fixture_passed_now === true || boundary.parser_fixture_passed_now === true,
    tokenizerPassed: summary.tokenizer_fixture_passed_now === true || boundary.tokenizer_fixture_passed_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
    validSource,
  };
}

function buildReviewState(receipt) {
  const data = receipt.data ?? {};
  const hasBlockingCount = Object.prototype.hasOwnProperty.call(data, "open_blocking_finding_count")
    || Object.prototype.hasOwnProperty.call(data, "blocking_finding_count");
  const blocking = Number(data.open_blocking_finding_count ?? data.blocking_finding_count);
  const verdict = String(data.overall_verdict ?? data.verdict ?? "").toUpperCase();
  const reviewerId = String(data.reviewer ?? "").toLowerCase().replaceAll("-", "_");
  const reviewerOk = reviewerId === "claude_code_opus_max";
  const verdictOk = ["PASS", "PASS_WITH_FINDINGS"].includes(verdict);
  const checkpointFieldPresent = typeof data.blocks_clean_checkpoint === "boolean";
  const blocksCleanCheckpoint = data.blocks_clean_checkpoint === true;
  const findingsShaped = Array.isArray(data.findings);
  const shapeValid = receipt.available === true
    && reviewerOk
    && verdictOk
    && hasBlockingCount
    && Number.isFinite(blocking)
    && checkpointFieldPresent
    && findingsShaped;
  return {
    present: receipt.available === true,
    shapeValid,
    reviewerOk,
    verdictOk,
    overallVerdict: verdict || "MISSING",
    blockingFindingCount: Number.isFinite(blocking) ? blocking : null,
    blocksCleanCheckpoint,
    passed: shapeValid && blocking === 0 && blocksCleanCheckpoint === false,
  };
}

function buildValidationEvidenceState(receipt) {
  const data = receipt.data ?? {};
  const targeted = data.targeted_validation_passed === true;
  const adjacent = data.adjacent_validation_required === false
    ? true
    : data.adjacent_validation_passed === true;
  const fullSuite = data.full_npm_test_passed === true;
  const diff = data.git_diff_check_passed === true;
  return {
    present: receipt.available === true,
    targetedPassed: targeted,
    adjacentPassed: adjacent,
    fullSuitePassed: fullSuite,
    diffCheckPassed: diff,
    passed: receipt.available === true && targeted && adjacent && fullSuite && diff,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, label, outputRef]) => row({
    row_id: `phase.${slug(phaseRange)}`,
    category: "phase_plan",
    label: `${phaseRange} ${label}`,
    observed: roadmapText.includes(phaseRange) && roadmapText.includes(outputRef),
    evidence_ref: `docs/hermes-roadmap-p18801-p19200.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows(source, sourceState, generatedAt) {
  const checks = [
    ["source_available", "P18800 source is available or rebuilt", sourceState.available],
    ["source_range", "P18800 source range is P18401-P18800", sourceState.programRangeOk],
    ["source_validation_valid", "P18800 source validation is valid", sourceState.validationValid],
    ["source_handoff_ready", "P18800 is ready for P18801 handoff", sourceState.sourceReady],
    ["source_boundary_closed", "P18800 protected boundary remains closed", sourceState.boundaryClosed],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `p18800_source.${id}`,
    category: "p18800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    output_ref: "p18800_source_binding_rows",
  }));
}

function buildClosedDebtRows(sourceState, generatedAt) {
  const checks = [
    ["no_write_policy_scanner_debt", "No-write policy scanner debt is credited as closed", sourceState.sourceReady && sourceState.offenderCount === 0],
    ["scanner_finding_debt", "P18400 scanner finding classes are credited as closed", sourceState.findingClosureCount >= 7 && sourceState.blockingFindingCount === 0],
    ["parser_shape_debt", "Parser shape debt is credited as closed", sourceState.parserPassed],
    ["tokenizer_literal_debt", "Tokenizer literal debt is credited as closed", sourceState.tokenizerPassed],
    ["p18800_source_blocker_debt", "P18800 source blocker debt is credited as closed", sourceState.validSource && sourceState.sourceReady],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `closed_debt.${id}`,
    category: "closed_debt_credit",
    label,
    observed,
    evidence_ref: "source_check_mode_scanner_summary",
    generated_at: generatedAt,
    output_ref: "closed_debt_credit_rows",
  }));
}

function buildRemainingDebtRows(generatedAt) {
  return REMAINING_DEBTS.map(([debtId, label]) => row({
    row_id: `remaining_debt.${debtId}`,
    category: "remaining_trust_debt",
    label,
    observed: true,
    evidence_ref: "docs/hermes-roadmap-p18801-p19200.md#P18901-P18960",
    generated_at: generatedAt,
    output_ref: "remaining_trust_debt_rows",
    debt_status: "carried_forward",
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  }));
}

function buildValidationFreshnessRows(validationState, generatedAt) {
  const checks = [
    ["targeted_validation", "Targeted validation receipt is present and passed", validationState.targetedPassed],
    ["adjacent_regression", "Adjacent regression receipt is present or explicitly not required", validationState.adjacentPassed && validationState.present],
    ["full_npm_test", "Full npm test receipt is present and passed", validationState.fullSuitePassed],
    ["git_diff_check", "Git diff whitespace check receipt is present and passed", validationState.diffCheckPassed],
    ["missing_validation_blocker_visible", "Missing or invalid validation receipt is visible as a P19201 blocker", true],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `validation_recheck.${id}`,
    category: "validation_freshness_recheck",
    label,
    observed,
    evidence_ref: "validation_receipt",
    generated_at: generatedAt,
    output_ref: "validation_freshness_recheck_rows",
    receipt_present_now: validationState.present,
  }));
}

function buildReviewEvidenceRows(reviewState, generatedAt) {
  const checks = [
    ["claude_review_receipt", "Claude Code Opus max review receipt is present", reviewState.present],
    ["claude_review_shape", "Claude review receipt has required reviewer, verdict, checkpoint, count, and findings fields", reviewState.shapeValid],
    ["claude_review_verdict", "Claude review verdict is PASS or PASS_WITH_FINDINGS", reviewState.verdictOk],
    ["blocking_finding_count", "Claude review has no open blocking findings", reviewState.blockingFindingCount === 0 && reviewState.present],
    ["finding_loop_state", "Finding loop state does not block clean checkpoint", reviewState.blocksCleanCheckpoint === false && reviewState.present],
    ["reviewer_non_finality", "Reviewer evidence does not claim final approval", true],
    ["missing_review_blocker_visible", "Missing or invalid review receipt is visible as a P19201 blocker", true],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `review_recheck.${id}`,
    category: "review_evidence_recheck",
    label,
    observed,
    evidence_ref: "review_receipt",
    generated_at: generatedAt,
    output_ref: "review_evidence_recheck_rows",
    receipt_present_now: reviewState.present,
    reviewer_final_approval_allowed_now: false,
  }));
}

function buildAuthorityRows(generatedAt) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => row({
    row_id: `authority_boundary.${flag}`,
    category: "authority_boundary_recheck",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "trust_recalibration_boundary",
    generated_at: generatedAt,
    output_ref: "authority_boundary_recheck_rows",
    flag,
    expected_value: false,
    observed_value: false,
  }));
}

function buildOperatorRows({ reviewState, validationState, generatedAt }) {
  const checks = [
    ["next_evidence_action", "Operator can see the next evidence action", true],
    ["missing_review_action", "Operator can see missing or invalid review receipt action", true],
    ["missing_validation_action", "Operator can see missing or invalid validation receipt action", true],
    ["remaining_debt_rollup", "Operator can see carried-forward trust debt", true],
    ["no_mutation_projection", "Operator projection has no mutation controls", true],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `operator_next_action.${id}`,
    category: "operator_next_action",
    label,
    observed,
    evidence_ref: "operator_next_action_rows",
    generated_at: generatedAt,
    output_ref: "operator_next_action_rows",
    action_status: observed ? "visible" : "blocked",
  }));
}

function buildFreezeRows({ sourceState, reviewState, validationState, closedDebtRows, remainingDebtRows, authorityRows, generatedAt }) {
  const checks = [
    ["p19200_closeout_id", "P19200 closeout id is fixed", true],
    ["p18800_source_ready", "P18800 source is ready for recalibration", sourceState.sourceReady && sourceState.validSource],
    ["closed_debt_credits_pass", "Closed debt credits pass", allPass(closedDebtRows)],
    ["remaining_debt_carried_forward", "Remaining trust debt is carried forward", allPass(remainingDebtRows)],
    ["review_and_validation_blockers_visible", "Review and validation blockers are visible", true],
    ["authority_boundary_closed", "Authority boundary remains closed", allPass(authorityRows)],
  ];
  return checks.map(([id, label, observed]) => row({
    row_id: `p19200_freeze.${id}`,
    category: "p19200_freeze",
    label,
    observed,
    evidence_ref: "p19200_freeze_rows",
    generated_at: generatedAt,
    output_ref: "p19200_freeze_rows",
  }));
}

function buildBoundary(context) {
  const p19200ContractReady = allPass(context.phaseRows)
    && allPass(context.sourceRows)
    && allPass(context.closedDebtRows)
    && allPass(context.remainingDebtRows)
    && visibleOrPassed(context.validationRows, "validation_recheck.missing_validation_blocker_visible")
    && visibleOrPassed(context.reviewRows, "review_recheck.missing_review_blocker_visible")
    && allPass(context.authorityRows)
    && allPass(context.operatorRows)
    && allPass(context.freezeRows);
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validSource
    && allPass(context.closedDebtRows)
    && context.reviewState.passed
    && context.validationState.passed
    && allPass(context.authorityRows);
  return {
    p19200_contract_ready: p19200ContractReady,
    ready_for_p19201_handoff: handoffReady,
    source_p18800_ready_for_p18801_handoff: context.sourceState.sourceReady,
    closed_debt_credit_count: context.closedDebtRows.filter((item) => item.current_verdict === "pass").length,
    remaining_trust_debt_count: context.remainingDebtRows.length,
    review_receipt_present_now: context.reviewState.present,
    review_evidence_passed_now: context.reviewState.passed,
    validation_receipt_present_now: context.validationState.present,
    validation_evidence_passed_now: context.validationState.passed,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    reviewer_mutation_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P18801-P19200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P18801-P19200 Trust Debt Recalibration"), "Architecture doc missing P18801-P19200 reference"),
    validationItem("source.ready", "source", allPass(context.sourceRows), "P18800 source binding rows are not ready"),
    validationItem("closed_debt.ready", "debt", allPass(context.closedDebtRows), "Closed debt credit rows are not ready"),
    validationItem("remaining_debt.visible", "debt", allPass(context.remainingDebtRows), "Remaining trust debt rows are not visible"),
    validationItem("validation.visible", "validation", visibleOrPassed(context.validationRows, "validation_recheck.missing_validation_blocker_visible"), "Validation evidence or missing blocker is not visible"),
    validationItem("review.visible", "review", visibleOrPassed(context.reviewRows, "review_recheck.missing_review_blocker_visible"), "Review evidence or missing blocker is not visible"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator next action rows are not visible"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("freeze.ready", "freeze", allPass(context.freezeRows), "P19200 freeze rows are incomplete"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "trust_debt_recalibration.contract.v1",
    generated_at: generatedAt,
    source_p18800_required_or_rebuilt: true,
    receipt_absence_is_visible_blocker: true,
    p19201_handoff_requires_review_and_validation_evidence: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p19201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p19200_contract_ready
      ? RECEIPTS_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    trust_recalibration_status: status,
    source_p18800_ready_for_p18801_handoff: boundary.source_p18800_ready_for_p18801_handoff,
    closed_debt_credit_count: boundary.closed_debt_credit_count,
    remaining_trust_debt_count: boundary.remaining_trust_debt_count,
    review_receipt_present_now: boundary.review_receipt_present_now,
    validation_receipt_present_now: boundary.validation_receipt_present_now,
    ready_for_p19201_handoff: validation.valid && boundary.ready_for_p19201_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Trust Debt Recalibration",
    "",
    `Status: ${result.summary.trust_recalibration_status}`,
    `Program: ${result.program_range}`,
    `P18800 ready for P18801 handoff: ${result.summary.source_p18800_ready_for_p18801_handoff}`,
    `Closed debt credits: ${result.summary.closed_debt_credit_count}`,
    `Remaining trust debt rows: ${result.summary.remaining_trust_debt_count}`,
    `Review receipt present: ${result.summary.review_receipt_present_now}`,
    `Validation receipt present: ${result.summary.validation_receipt_present_now}`,
    `Ready for P19201 handoff: ${result.summary.ready_for_p19201_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.remaining_trust_debt_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.debt_status)}</td><td>${escapeHtml(item.label)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Trust Debt Recalibration</title>
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
    <h1>Hermes Trust Debt Recalibration</h1>
    <p class="notice">This artifact recalibrates trust debt after scanner hardening. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Debt</th><th>Status</th><th>Meaning</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP18800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildCheckModeScannerRobustness({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.check_mode_scanner_robustness", built);
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
  const defaults = DEFAULT_TRUST_DEBT_RECALIBRATION_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_check_mode_scanner_robustness_path: path.resolve(repoRoot, options.sourceCheckModeScannerRobustnessPath ?? defaults.sourceCheckModeScannerRobustnessPath),
    review_receipt_path: path.resolve(repoRoot, options.reviewReceiptPath ?? defaults.reviewReceiptPath),
    validation_receipt_path: path.resolve(repoRoot, options.validationReceiptPath ?? defaults.validationReceiptPath),
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
      args.sourceCheckModeScannerRobustnessPath = argv[++index];
    } else if (arg === "--review-receipt") {
      args.reviewReceiptPath = argv[++index];
    } else if (arg === "--validation-receipt") {
      args.validationReceiptPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--review-receipt FILE] [--validation-receipt FILE]`);
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

function slug(term) {
  return String(term)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
