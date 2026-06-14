import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildTrustDebtRecalibration } from "./trust-debt-recalibration.mjs";

export const DEFAULT_POST_HANDOFF_TRUST_INTAKE_OUT_DIR = "artifacts/post-handoff-trust-intake/latest";
export const DEFAULT_POST_HANDOFF_TRUST_INTAKE_INPUTS = {
  schemaPath: "schemas/post-handoff-trust-intake.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p19201-p19600.md",
  architectureDocPath: "docs/architecture.md",
  sourceTrustDebtRecalibrationPath: "artifacts/trust-debt-recalibration/latest/trust-debt-recalibration.json",
};

const COMMAND_NAME = "platform:post-handoff-trust-intake";
const SCHEMA_VERSION = "post-handoff-trust-intake.v1";
const CAPABILITY_ID = "platform.post_handoff_trust_intake";
const PROGRAM_RANGE = "P19201-P19600";
const SOURCE_PROGRAM_RANGE = "P18801-P19200";
const READY_STATUS = "ready_for_post_handoff_trust_intake";
const BLOCK_PENDING_STATUS = "valid_block_handoff_pending";
const BLOCKED_STATUS = "blocked_post_handoff_trust_intake";
const DEFAULT_MAX_EVIDENCE_AGE_DAYS = 14;

const PHASE_SPECS = [
  ["P19201-P19240", "P19200 Source Binding", "p19200_source_binding_rows"],
  ["P19241-P19300", "Handoff Receipt Materialization", "handoff_receipt_materialization_rows"],
  ["P19301-P19360", "Trust Carry-Forward Normalization", "trust_carry_forward_rows"],
  ["P19361-P19420", "Evidence Freshness Window", "evidence_freshness_window_rows"],
  ["P19421-P19500", "Operator Handoff Packet", "operator_handoff_packet_rows"],
  ["P19501-P19560", "Authority Boundary Continuation", "authority_boundary_continuation_rows"],
  ["P19561-P19600", "P19600 Handoff Freeze", "p19600_freeze_rows"],
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

const CARRY_FORWARD_DEBTS = [
  ["production_pass", "Production PASS remains carried forward and closed"],
  ["enterprise_trust", "Enterprise trust remains carried forward and closed"],
  ["independent_github_review", "Independent GitHub review is not manufactured by single-owner mode"],
  ["release_deployment_authority", "Release approval and deployment remain closed"],
  ["runtime_write_connector_authority", "Runtime, write, protected action, and connector mutation remain closed"],
  ["raw_secret_final_approval", "Raw exposure, secret read, reviewer mutation, and final automated approval remain closed"],
];

export async function runPostHandoffTrustIntake(options = {}) {
  const result = await buildPostHandoffTrustIntake(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-Handoff Trust Intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostHandoffTrustIntake(result, result.output_dir);
  return result;
}

export async function buildPostHandoffTrustIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_HANDOFF_TRUST_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "trustDebtRecalibration")
    ? normalizeInlineJsonSource("inline.trust_debt_recalibration", options.trustDebtRecalibration)
    : await readJsonOrBuildP19200(inputs.source_trust_debt_recalibration_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const maxEvidenceAgeDays = Number(options.maxEvidenceAgeDays ?? DEFAULT_MAX_EVIDENCE_AGE_DAYS);

  const sourceState = buildSourceState(source);
  const receiptState = buildReceiptState(source);
  const freshnessState = buildFreshnessState({ source, commitRef, generatedAt, maxEvidenceAgeDays });
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const receiptRows = buildReceiptRows({ source, receiptState, generatedAt });
  const carryRows = buildCarryForwardRows(generatedAt);
  const freshnessRows = buildFreshnessRows({ freshnessState, generatedAt });
  const operatorRows = buildOperatorRows({ sourceState, receiptState, freshnessState, generatedAt });
  const authorityRows = buildAuthorityRows(generatedAt);
  const freezeRows = buildFreezeRows({ sourceState, receiptState, freshnessState, authorityRows, generatedAt });
  const boundary = buildBoundary({ sourceState, receiptState, freshnessState, phaseRows, sourceRows, receiptRows, carryRows, freshnessRows, operatorRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, receiptRows, carryRows, freshnessRows, operatorRows, authorityRows, freezeRows, boundary });
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
      trust_debt_recalibration_path: source.path,
      source_review_receipt_path: source.data?.source_refs?.review_receipt_path ?? null,
      source_validation_receipt_path: source.data?.source_refs?.validation_receipt_path ?? null,
      source_commit_ref: commitRef || null,
    },
    source_trust_debt_recalibration_summary: source.data?.summary ?? null,
    post_handoff_trust_contract: buildContract(generatedAt),
    post_handoff_phase_rows: phaseRows,
    p19200_source_binding_rows: sourceRows,
    handoff_receipt_materialization_rows: receiptRows,
    trust_carry_forward_rows: carryRows,
    evidence_freshness_window_rows: freshnessRows,
    operator_handoff_packet_rows: operatorRows,
    authority_boundary_continuation_rows: authorityRows,
    p19600_freeze_rows: freezeRows,
    post_handoff_trust_boundary: boundary,
    post_handoff_trust_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_handoff_trust_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_handoff_trust_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_handoff_trust_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writePostHandoffTrustIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-handoff-trust-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p19200-source-binding-rows.json"), collectionEnvelope("p19200-source-binding-rows.v1", "p19200_source_binding_rows", result.p19200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-receipt-materialization-rows.json"), collectionEnvelope("handoff-receipt-materialization-rows.v1", "handoff_receipt_materialization_rows", result.handoff_receipt_materialization_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-carry-forward-rows.json"), collectionEnvelope("trust-carry-forward-rows.v1", "trust_carry_forward_rows", result.trust_carry_forward_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-freshness-window-rows.json"), collectionEnvelope("evidence-freshness-window-rows.v1", "evidence_freshness_window_rows", result.evidence_freshness_window_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handoff-packet-rows.json"), collectionEnvelope("operator-handoff-packet-rows.v1", "operator_handoff_packet_rows", result.operator_handoff_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-continuation-rows.json"), collectionEnvelope("authority-boundary-continuation-rows.v1", "authority_boundary_continuation_rows", result.authority_boundary_continuation_rows, result.generated_at));
  await writeJson(path.join(outDir, "p19600-freeze-rows.json"), collectionEnvelope("p19600-freeze-rows.v1", "p19600_freeze_rows", result.p19600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-handoff-trust-boundary.json"), result.post_handoff_trust_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runPostHandoffTrustIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostHandoffTrustIntake(args);
  console.log(`Post-Handoff Trust Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.post_handoff_trust_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P19200 ready for P19201 handoff: ${result.summary.source_p19200_ready_for_p19201_handoff}`);
  console.log(`Receipts passed: ${result.summary.handoff_receipts_passed_now}`);
  console.log(`Freshness passed: ${result.summary.evidence_freshness_passed_now}`);
  console.log(`Commit ref present: ${result.summary.source_commit_ref_present_now}`);
  console.log(`Ready for P19601 handoff: ${result.summary.ready_for_p19601_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.trust_recalibration_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    status: summary.trust_recalibration_status ?? "missing",
    sourceReady: summary.ready_for_p19201_handoff === true,
    contractReady: boundary.p19200_contract_ready === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildReceiptState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.trust_recalibration_boundary ?? {};
  const reviewPresent = summary.review_receipt_present_now === true || boundary.review_receipt_present_now === true;
  const validationPresent = summary.validation_receipt_present_now === true || boundary.validation_receipt_present_now === true;
  const reviewPassed = boundary.review_evidence_passed_now === true;
  const validationPassed = boundary.validation_evidence_passed_now === true;
  return {
    reviewPresent,
    validationPresent,
    reviewPassed,
    validationPassed,
    receiptRefsPresent: Boolean(source.data?.source_refs?.review_receipt_path && source.data?.source_refs?.validation_receipt_path),
    passed: reviewPresent && validationPresent && reviewPassed && validationPassed,
  };
}

function buildFreshnessState({ source, commitRef, generatedAt, maxEvidenceAgeDays }) {
  const sourceGeneratedAt = source.data?.generated_at ?? null;
  const ageDays = ageInDays(sourceGeneratedAt, generatedAt);
  const sourceGeneratedAtValid = Number.isFinite(ageDays);
  const sourceFresh = sourceGeneratedAtValid && ageDays <= maxEvidenceAgeDays;
  const validationCommandsVisible = source.data?.summary?.validation_receipt_present_now === true
    || source.data?.trust_recalibration_boundary?.validation_evidence_passed_now === true;
  return {
    sourceGeneratedAt,
    sourceGeneratedAtValid,
    sourceAgeDays: Number.isFinite(ageDays) ? Number(ageDays.toFixed(4)) : null,
    maxEvidenceAgeDays,
    sourceFresh,
    commitRefPresent: Boolean(commitRef),
    validationCommandsVisible,
    noSourceMutation: true,
    passed: sourceFresh && Boolean(commitRef) && validationCommandsVisible,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p19201-p19600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P19200 trust recalibration source is available", sourceState.available],
    ["program_range", "P19200 source program range is P18801-P19200", sourceState.programRangeOk],
    ["validation_valid", "P19200 source validation is valid", sourceState.validationValid],
    ["p19201_handoff_open", "P19200 source opened P19201 handoff", sourceState.sourceReady],
    ["boundary_closed", "P19200 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Source commit ref is present for handoff intake", Boolean(commitRef)],
    ["source_blocker_visible", "P19200 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p19200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildReceiptRows({ source, receiptState, generatedAt }) {
  return [
    ["claude_review_present", "Claude review receipt is present in the P19200 source", receiptState.reviewPresent],
    ["claude_review_passed", "Claude review evidence passed with zero blocking findings", receiptState.reviewPassed],
    ["full_suite_receipt_present", "Full-suite validation receipt is present in the P19200 source", receiptState.validationPresent],
    ["full_suite_receipt_passed", "Full-suite validation evidence passed", receiptState.validationPassed],
    ["source_receipt_refs_present", "P19200 source preserves receipt refs", receiptState.receiptRefsPresent],
    ["receipt_non_finality", "Receipt evidence does not create final approval", true],
    ["receipt_blocker_visible", "Missing or failing receipt is visible as a handoff blocker", true],
  ].map(([id, label, observed]) => row({
    row_id: `receipt_materialization.${id}`,
    category: "handoff_receipt_materialization",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildCarryForwardRows(generatedAt) {
  return CARRY_FORWARD_DEBTS.map(([id, label]) => row({
    row_id: `carry_forward.${id}`,
    category: "trust_carry_forward",
    label,
    observed: true,
    evidence_ref: "trust_carry_forward_rows",
    debt_status: "carried_forward",
    generated_at: generatedAt,
  }));
}

function buildFreshnessRows({ freshnessState, generatedAt }) {
  return [
    ["source_generated_at_valid", "P19200 generated_at is parseable", freshnessState.sourceGeneratedAtValid],
    ["source_within_freshness_window", `P19200 source is within ${freshnessState.maxEvidenceAgeDays} day freshness window`, freshnessState.sourceFresh],
    ["source_commit_ref_present", "Current commit ref is present", freshnessState.commitRefPresent],
    ["validation_command_evidence_visible", "Validation command evidence is visible through P19200 receipt state", freshnessState.validationCommandsVisible],
    ["no_source_mutation", "Freshness check does not mutate source or receipts", freshnessState.noSourceMutation],
    ["freshness_blocker_visible", "Stale or missing evidence is visible as a handoff blocker", true],
  ].map(([id, label, observed]) => row({
    row_id: `freshness_window.${id}`,
    category: "evidence_freshness_window",
    label,
    observed,
    evidence_ref: "evidence_freshness_window_rows",
    source_generated_at: freshnessState.sourceGeneratedAt,
    source_age_days: freshnessState.sourceAgeDays,
    generated_at: generatedAt,
  }));
}

function buildOperatorRows({ sourceState, receiptState, freshnessState, generatedAt }) {
  return [
    ["source_packet", "Operator can see P19200 source state", sourceState.available],
    ["receipt_packet", "Operator can see receipt pass/block state", true],
    ["freshness_packet", "Operator can see freshness and commit-ref state", freshnessState.sourceGeneratedAtValid],
    ["carry_forward_packet", "Operator can see carried-forward trust debt", true],
    ["next_action_packet", "Operator can see next allowed action without mutation", true],
  ].map(([id, label, observed]) => row({
    row_id: `operator_handoff.${id}`,
    category: "operator_handoff_packet",
    label,
    observed,
    evidence_ref: "operator_handoff_packet_rows",
    generated_at: generatedAt,
  }));
}

function buildAuthorityRows(generatedAt) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => row({
    row_id: `authority_boundary.${flag}`,
    category: "authority_boundary_continuation",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "post_handoff_trust_boundary",
    authority_flag: flag,
    generated_at: generatedAt,
  }));
}

function buildFreezeRows({ sourceState, receiptState, freshnessState, authorityRows, generatedAt }) {
  const authorityClosed = allPass(authorityRows);
  const handoffReady = sourceState.sourceReady && sourceState.boundaryClosed && receiptState.passed && freshnessState.passed && authorityClosed;
  return [
    ["source_state_visible", "P19200 source state is visible", sourceState.available],
    ["receipt_state_visible", "Receipt state is visible", receiptState.reviewPresent || receiptState.validationPresent],
    ["freshness_state_visible", "Freshness state is visible", freshnessState.sourceGeneratedAtValid],
    ["authority_boundary_closed", "Authority boundary remains closed", authorityClosed],
    ["p19601_handoff_gate", "P19601 handoff gate is open only when source, receipts, freshness, and authority pass", handoffReady],
    ["p19601_handoff_blocker_visible", "P19601 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p19600_freeze.${id}`,
    category: "p19600_freeze",
    label,
    observed,
    evidence_ref: "p19600_freeze_rows",
    generated_at: generatedAt,
  }));
}

function buildBoundary(context) {
  const authorityClosed = allPass(context.authorityRows);
  const p19600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && visibleOrPassed(context.receiptRows, "receipt_materialization.receipt_blocker_visible")
    && allPass(context.carryRows)
    && visibleOrPassed(context.freshnessRows, "freshness_window.freshness_blocker_visible")
    && allPass(context.operatorRows)
    && authorityClosed
    && visibleOrPassed(context.freezeRows, "p19600_freeze.p19601_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.boundaryClosed
    && context.sourceState.validationValid
    && context.receiptState.passed
    && context.freshnessState.passed
    && authorityClosed;
  return {
    p19600_contract_ready: p19600ContractReady,
    ready_for_p19601_handoff: handoffReady,
    source_p19200_ready_for_p19201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    handoff_receipts_passed_now: context.receiptState.passed,
    evidence_freshness_passed_now: context.freshnessState.passed,
    source_commit_ref_present_now: context.freshnessState.commitRefPresent,
    carried_forward_trust_debt_count: context.carryRows.length,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P19201-P19600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P19201-P19600 Post-Handoff Trust Intake"), "Architecture doc missing P19201-P19600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P19200 source state is not visible"),
    validationItem("receipt.visible", "receipt", visibleOrPassed(context.receiptRows, "receipt_materialization.receipt_blocker_visible"), "Handoff receipt state is not visible"),
    validationItem("carry_forward.visible", "debt", allPass(context.carryRows), "Carried-forward trust debt rows are missing"),
    validationItem("freshness.visible", "freshness", visibleOrPassed(context.freshnessRows, "freshness_window.freshness_blocker_visible"), "Evidence freshness state is not visible"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator handoff packet rows are not visible"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("freeze.visible", "freeze", visibleOrPassed(context.freezeRows, "p19600_freeze.p19601_handoff_blocker_visible"), "P19600 freeze handoff blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "post_handoff_trust_intake.contract.v1",
    generated_at: generatedAt,
    source_p19200_required_or_rebuilt: true,
    p19200_summary_must_be_rechecked: true,
    receipt_and_freshness_recheck_required: true,
    authority_carry_forward_required: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p19601_handoff
    ? READY_STATUS
    : validation.valid && boundary.p19600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    post_handoff_trust_status: status,
    source_p19200_ready_for_p19201_handoff: boundary.source_p19200_ready_for_p19201_handoff,
    handoff_receipts_passed_now: boundary.handoff_receipts_passed_now,
    evidence_freshness_passed_now: boundary.evidence_freshness_passed_now,
    source_commit_ref_present_now: boundary.source_commit_ref_present_now,
    carried_forward_trust_debt_count: boundary.carried_forward_trust_debt_count,
    ready_for_p19601_handoff: validation.valid && boundary.ready_for_p19601_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Post-Handoff Trust Intake",
    "",
    `Status: ${result.summary.post_handoff_trust_status}`,
    `Program: ${result.program_range}`,
    `P19200 ready for P19201 handoff: ${result.summary.source_p19200_ready_for_p19201_handoff}`,
    `Receipts passed: ${result.summary.handoff_receipts_passed_now}`,
    `Freshness passed: ${result.summary.evidence_freshness_passed_now}`,
    `Commit ref present: ${result.summary.source_commit_ref_present_now}`,
    `Ready for P19601 handoff: ${result.summary.ready_for_p19601_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.trust_carry_forward_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.debt_status)}</td><td>${escapeHtml(item.label)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Post-Handoff Trust Intake</title>
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
    <h1>Hermes Post-Handoff Trust Intake</h1>
    <p class="notice">This artifact rechecks P19200 handoff evidence. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Debt</th><th>Status</th><th>Meaning</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP19200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildTrustDebtRecalibration({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.trust_debt_recalibration", built);
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
  const defaults = DEFAULT_POST_HANDOFF_TRUST_INTAKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_trust_debt_recalibration_path: path.resolve(repoRoot, options.sourceTrustDebtRecalibrationPath ?? defaults.sourceTrustDebtRecalibrationPath),
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
      args.sourceTrustDebtRecalibrationPath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--max-evidence-age-days") {
      args.maxEvidenceAgeDays = Number(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF] [--max-evidence-age-days DAYS]`);
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

function ageInDays(olderIso, newerIso) {
  const older = Date.parse(olderIso);
  const newer = Date.parse(newerIso);
  if (!Number.isFinite(older) || !Number.isFinite(newer) || newer < older) return Number.NaN;
  return (newer - older) / 86400000;
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
