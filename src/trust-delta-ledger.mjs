import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFreezeEvidenceCompletion } from "./freeze-evidence-completion.mjs";

export const DEFAULT_TRUST_DELTA_LEDGER_OUT_DIR = "artifacts/trust-delta-ledger/latest";
export const DEFAULT_TRUST_DELTA_LEDGER_INPUTS = {
  schemaPath: "schemas/trust-delta-ledger.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p17601-p18000.md",
  architectureDocPath: "docs/architecture.md",
  sourceFreezeEvidenceCompletionPath: "artifacts/freeze-evidence-completion/latest/freeze-evidence-completion.json",
};

const COMMAND_NAME = "platform:trust-delta-ledger";
const SCHEMA_VERSION = "trust-delta-ledger.v1";
const CAPABILITY_ID = "platform.trust_delta_ledger";
const PROGRAM_RANGE = "P17601-P18000";
const SOURCE_PROGRAM_RANGE = "P17201-P17600";
const READY_STATUS = "ready_for_trust_delta_ledger";
const BLOCKED_STATUS = "blocked_trust_delta_ledger";

const PHASE_SPECS = [
  ["P17601-P17640", "P17600 Source Binding", "trust_source_binding_rows"],
  ["P17641-P17680", "Trust Baseline Snapshot", "trust_baseline_snapshot_rows"],
  ["P17681-P17720", "Evidence Quality Delta", "evidence_quality_delta_rows"],
  ["P17721-P17760", "Review Finding Delta", "review_finding_delta_rows"],
  ["P17761-P17800", "Validation Freshness Delta", "validation_freshness_delta_rows"],
  ["P17801-P17840", "Authority Boundary Delta", "authority_boundary_delta_rows"],
  ["P17841-P17880", "Operator Trust Projection", "operator_trust_projection_rows"],
  ["P17881-P17920", "Trust Debt Ledger", "trust_debt_ledger_rows"],
  ["P17921-P17960", "P18001 Handoff Gate", "p18001_handoff_gate_rows"],
  ["P17961-P18000", "P18000 Trust Delta Freeze", "p18000_freeze_rows"],
];

const SOURCE_TERMS = ["P17600 source availability", "source range", "source status", "current handoff state", "blocker visibility", "source chain"];
const BASELINE_TERMS = ["production trust baseline", "enterprise trust baseline", "review baseline", "validation baseline", "evidence baseline", "authority baseline"];
const EVIDENCE_TERMS = ["source evidence delta", "receipt evidence delta", "validation evidence delta", "freshness delta", "blocker evidence delta", "citation/ref delta"];
const REVIEW_TERMS = ["Claude finding count", "P0/P1 state", "P2/P3 state", "remediation state", "re-review need", "no reviewer final approval"];
const VALIDATION_TERMS = ["targeted validation state", "adjacent regression state", "full npm test state", "stale validation state", "command evidence state", "validation blocker"];
const AUTHORITY_TERMS = ["no deployment", "no release approval", "no production PASS", "no enterprise PASS", "no review bypass", "no final automated approval"];
const OPERATOR_TERMS = ["read-only trust dashboard row", "trust debt rollup", "evidence delta rollup", "review delta rollup", "next action rollup", "no mutation"];
const DEBT_TERMS = ["source debt", "review debt", "finding debt", "validation debt", "full-suite debt", "next debt action"];
const HANDOFF_TERMS = ["source ready", "debt clear", "review clear", "validation clear", "authority ready", "handoff blocker"];
const FREEZE_TERMS = ["trust delta closeout id", "committed source ref", "validation command list", "review/finding state", "debt state", "blocked handoff note"];

export async function runTrustDeltaLedger(options = {}) {
  const result = await buildTrustDeltaLedger(options);
  if (options.write !== false) await writeTrustDeltaLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trust Delta Ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTrustDeltaLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRUST_DELTA_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "freezeEvidenceCompletion")
    ? normalizeInlineJsonSource("inline.freeze_evidence_completion", options.freezeEvidenceCompletion)
    : await readJsonOrBuildP17600(inputs.source_freeze_evidence_completion_path, generatedAt);

  const sourceState = buildSourceState(source);
  const debtState = buildDebtState(sourceState);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows(source, sourceState, generatedAt);
  const baselineRows = buildBaselineRows(roadmapDoc.text, sourceState, generatedAt);
  const evidenceRows = buildEvidenceRows(roadmapDoc.text, sourceState, generatedAt);
  const reviewRows = buildReviewRows(roadmapDoc.text, sourceState, generatedAt);
  const validationRows = buildValidationFreshnessRows(roadmapDoc.text, sourceState, generatedAt);
  const authorityRows = buildTermRows("authority_boundary_delta", "Authority boundary delta", AUTHORITY_TERMS, roadmapDoc.text, "authority_boundary_delta_rows", generatedAt, authorityExtras);
  const operatorRows = buildTermRows("operator_trust_projection", "Operator trust projection", OPERATOR_TERMS, roadmapDoc.text, "operator_trust_projection_rows", generatedAt, operatorExtras);
  const debtRows = buildDebtRows(roadmapDoc.text, debtState, generatedAt);
  const handoffRows = buildHandoffRows(sourceState, debtState, generatedAt);
  const freezeRows = buildFreezeRows(roadmapDoc.text, sourceState, debtState, generatedAt);
  const boundary = buildBoundary({ sourceState, debtState, sourceRows, baselineRows, evidenceRows, reviewRows, validationRows, authorityRows, operatorRows, debtRows, handoffRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, baselineRows, evidenceRows, reviewRows, validationRows, authorityRows, operatorRows, debtRows, handoffRows, freezeRows, boundary });
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
      freeze_evidence_completion_path: source.path,
    },
    source_freeze_evidence_completion_summary: source.data?.summary ?? null,
    trust_delta_contract: buildContract(generatedAt),
    trust_delta_phase_rows: phaseRows,
    trust_source_binding_rows: sourceRows,
    trust_baseline_snapshot_rows: baselineRows,
    evidence_quality_delta_rows: evidenceRows,
    review_finding_delta_rows: reviewRows,
    validation_freshness_delta_rows: validationRows,
    authority_boundary_delta_rows: authorityRows,
    operator_trust_projection_rows: operatorRows,
    trust_debt_ledger_rows: debtRows,
    p18001_handoff_gate_rows: handoffRows,
    p18000_freeze_rows: freezeRows,
    trust_delta_boundary: boundary,
    trust_delta_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, sourceRows, baselineRows, evidenceRows, reviewRows, validationRows, authorityRows, operatorRows, debtRows, handoffRows, freezeRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "trust_delta_ledger")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.trust_delta_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.trust_delta_validation_items);
  result.summary = buildSummary({ boundary, sourceRows, baselineRows, evidenceRows, reviewRows, validationRows, authorityRows, operatorRows, debtRows, handoffRows, freezeRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeTrustDeltaLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trust-delta-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "trust-delta-phase-rows.json"), collectionEnvelope("trust-delta-phase-rows.v1", "trust_delta_phase_rows", result.trust_delta_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-source-binding-rows.json"), collectionEnvelope("trust-source-binding-rows.v1", "trust_source_binding_rows", result.trust_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-baseline-snapshot-rows.json"), collectionEnvelope("trust-baseline-snapshot-rows.v1", "trust_baseline_snapshot_rows", result.trust_baseline_snapshot_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-quality-delta-rows.json"), collectionEnvelope("evidence-quality-delta-rows.v1", "evidence_quality_delta_rows", result.evidence_quality_delta_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-finding-delta-rows.json"), collectionEnvelope("review-finding-delta-rows.v1", "review_finding_delta_rows", result.review_finding_delta_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-freshness-delta-rows.json"), collectionEnvelope("validation-freshness-delta-rows.v1", "validation_freshness_delta_rows", result.validation_freshness_delta_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-delta-rows.json"), collectionEnvelope("authority-boundary-delta-rows.v1", "authority_boundary_delta_rows", result.authority_boundary_delta_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-trust-projection-rows.json"), collectionEnvelope("operator-trust-projection-rows.v1", "operator_trust_projection_rows", result.operator_trust_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-debt-ledger-rows.json"), collectionEnvelope("trust-debt-ledger-rows.v1", "trust_debt_ledger_rows", result.trust_debt_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "p18001-handoff-gate-rows.json"), collectionEnvelope("p18001-handoff-gate-rows.v1", "p18001_handoff_gate_rows", result.p18001_handoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "p18000-freeze-rows.json"), collectionEnvelope("p18000-freeze-rows.v1", "p18000_freeze_rows", result.p18000_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-delta-boundary.json"), result.trust_delta_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trust-delta-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.trust_delta_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runTrustDeltaLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTrustDeltaLedger(args);
    console.log(`Trust Delta Ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trust_delta_ledger_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`P17600 ready for P17601 handoff: ${result.summary.source_p17600_ready_for_p17601_handoff}`);
    console.log(`Trust debt count: ${result.summary.trust_debt_count}`);
    console.log(`Unresolved findings: ${result.summary.unresolved_finding_count}`);
    console.log(`Full-suite debt present: ${result.summary.full_suite_debt_present_now}`);
    console.log(`Ready for P18001 handoff: ${result.summary.ready_for_p18001_handoff}`);
    console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "trust-delta-ledger.contract.v1",
    generated_at: generatedAt,
    source_p17600_required: true,
    trust_delta_is_not_trust_score: true,
    trust_debt_required: true,
    p18001_handoff_gate_required: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
  };
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.freeze_completion_boundary ?? {};
  const sourceStatus = summary.freeze_evidence_completion_status ?? "missing";
  const sourceReady = summary.ready_for_p17601_handoff === true;
  const statusVisible = sourceStatus === "ready_for_freeze_evidence_completion" || sourceStatus === "blocked_freeze_evidence_completion";
  const boundaryClosed = boundary.deployment_allowed_now === false
    && boundary.release_approval_allowed_now === false
    && boundary.production_pass_enabled === false
    && boundary.enterprise_pass_enabled === false
    && boundary.enterprise_trust_claim_allowed_now === false
    && boundary.protected_closeout_enabled === false
    && boundary.human_gate_bypass_allowed_now === false
    && boundary.independent_review_bypass_allowed_now === false
    && boundary.single_owner_enterprise_trust_allowed_now === false
    && boundary.environment_config_write_allowed_now === false
    && boundary.migration_execution_allowed_now === false
    && boundary.rollback_execution_allowed_now === false
    && boundary.runtime_execution_allowed_now === false
    && boundary.write_action_allowed_now === false
    && boundary.protected_action_allowed_now === false
    && boundary.connector_write_enabled === false
    && boundary.external_service_mutation_allowed_now === false
    && boundary.secret_read_allowed_now === false
    && boundary.raw_source_exposure_allowed === false
    && boundary.reviewer_mutation_allowed_now === false
    && boundary.codex_final_approval_ui_enabled === false
    && boundary.claude_final_approval_ui_enabled === false;
  const validSource = source.available === true
    && source.data?.program_range === SOURCE_PROGRAM_RANGE
    && source.data?.validation?.valid === true
    && statusVisible
    && boundaryClosed;
  const unresolvedFindingCount = Number(summary.unresolved_finding_count ?? boundary.unresolved_finding_count ?? 0);
  const blockingFindingCount = Number(summary.blocking_finding_count ?? boundary.blocking_finding_count ?? 0);
  const validationBlocked = boundary.revalidation_receipt_present_now === false || summary.revalidation_block_visible_now === true || boundary.revalidation_block_visible_now === true;
  const fullSuiteDebt = Boolean(source.data?.observed_revalidation_summary?.full_npm_test_passed === false || source.data?.observed_revalidation_summary?.validation_status === "blocked");
  const blockVisible = source.available === true && (sourceReady === false || summary.source_block_visible_now === true || unresolvedFindingCount > 0 || validationBlocked || fullSuiteDebt);
  return {
    sourceAvailable: source.available === true,
    summary,
    boundary,
    sourceStatus,
    sourceReady,
    statusVisible,
    boundaryClosed,
    validSource,
    unresolvedFindingCount,
    blockingFindingCount,
    validationBlocked,
    fullSuiteDebt,
    blockVisible,
  };
}

function buildDebtState(sourceState) {
  const debts = [
    ["source", !sourceState.sourceReady || !sourceState.validSource],
    ["review", sourceState.unresolvedFindingCount > 0 || sourceState.blockingFindingCount > 0],
    ["finding", sourceState.unresolvedFindingCount > 0 || sourceState.blockingFindingCount > 0],
    ["validation", sourceState.validationBlocked],
    ["full_suite", sourceState.fullSuiteDebt],
  ].filter(([, present]) => present).map(([name]) => name);
  return {
    debts,
    debtCount: debts.length,
    debtClear: debts.length === 0,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p17601-p18000.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceRows(source, sourceState, generatedAt) {
  const states = new Map([
    ["P17600 source availability", source.available],
    ["source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source status", sourceState.statusVisible],
    ["current handoff state", sourceState.sourceReady],
    ["blocker visibility", sourceState.sourceReady || sourceState.blockVisible],
    ["source chain", source.available && source.data?.source_program_range === "P16801-P17200"],
  ]);
  return SOURCE_TERMS.map((term) => verdictRow({
    row_id: `trust_source_binding.${slug(term)}`,
    category: "trust_source_binding",
    label: `Trust source binding: ${term}`,
    required: true,
    observed: states.get(term),
    evidence_ref: source.path,
    generated_at: generatedAt,
    output_ref: "trust_source_binding_rows",
    term_id: slug(term),
  }));
}

function buildBaselineRows(roadmapText, sourceState, generatedAt) {
  return BASELINE_TERMS.map((term) => verdictRow({
    row_id: `trust_baseline_snapshot.${slug(term)}`,
    category: "trust_baseline_snapshot",
    label: `Trust baseline snapshot: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17641-P17680",
    generated_at: generatedAt,
    output_ref: "trust_baseline_snapshot_rows",
    term_id: slug(term),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    source_status: sourceState.sourceStatus,
  }));
}

function buildEvidenceRows(roadmapText, sourceState, generatedAt) {
  return EVIDENCE_TERMS.map((term) => verdictRow({
    row_id: `evidence_quality_delta.${slug(term)}`,
    category: "evidence_quality_delta",
    label: `Evidence quality delta: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17681-P17720",
    generated_at: generatedAt,
    output_ref: "evidence_quality_delta_rows",
    term_id: slug(term),
    source_ready: sourceState.sourceReady,
    validation_blocked_now: sourceState.validationBlocked,
  }));
}

function buildReviewRows(roadmapText, sourceState, generatedAt) {
  return REVIEW_TERMS.map((term) => {
    const observed = term === "Claude finding count"
      ? true
      : term === "P0/P1 state"
        ? sourceState.blockingFindingCount === 0
        : term === "P2/P3 state" || term === "remediation state"
          ? sourceState.unresolvedFindingCount === 0
          : term === "re-review need"
            ? sourceState.unresolvedFindingCount === 0 || sourceState.blockingFindingCount > 0
            : includesText(roadmapText, term);
    return verdictRow({
      row_id: `review_finding_delta.${slug(term)}`,
      category: "review_finding_delta",
      label: `Review finding delta: ${term}`,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17721-P17760",
      generated_at: generatedAt,
      output_ref: "review_finding_delta_rows",
      term_id: slug(term),
      unresolved_finding_count: sourceState.unresolvedFindingCount,
      blocking_finding_count: sourceState.blockingFindingCount,
      reviewer_final_approval_allowed_now: false,
    });
  });
}

function buildValidationFreshnessRows(roadmapText, sourceState, generatedAt) {
  return VALIDATION_TERMS.map((term) => verdictRow({
    row_id: `validation_freshness_delta.${slug(term)}`,
    category: "validation_freshness_delta",
    label: `Validation freshness delta: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17761-P17800",
    generated_at: generatedAt,
    output_ref: "validation_freshness_delta_rows",
    term_id: slug(term),
    validation_blocked_now: sourceState.validationBlocked,
    full_suite_debt_present_now: sourceState.fullSuiteDebt,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#trust-delta-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildDebtRows(roadmapText, debtState, generatedAt) {
  return DEBT_TERMS.map((term) => verdictRow({
    row_id: `trust_debt_ledger.${slug(term)}`,
    category: "trust_debt_ledger",
    label: `Trust debt ledger: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17881-P17920",
    generated_at: generatedAt,
    output_ref: "trust_debt_ledger_rows",
    term_id: slug(term),
    debt_count: debtState.debtCount,
    debt_clear: debtState.debtClear,
  }));
}

function buildHandoffRows(sourceState, debtState, generatedAt) {
  const reviewClear = sourceState.unresolvedFindingCount === 0 && sourceState.blockingFindingCount === 0;
  const validationClear = sourceState.validationBlocked === false && sourceState.fullSuiteDebt === false;
  const authorityReady = sourceState.boundaryClosed;
  const handoffReady = sourceState.sourceReady && sourceState.validSource && debtState.debtClear && reviewClear && validationClear && authorityReady;
  const handoffBlocker = handoffReady || sourceState.blockVisible || debtState.debtCount > 0 || !reviewClear || !validationClear || !authorityReady;
  const states = new Map([
    ["source ready", sourceState.sourceReady && sourceState.validSource],
    ["debt clear", debtState.debtClear],
    ["review clear", reviewClear],
    ["validation clear", validationClear],
    ["authority ready", authorityReady],
    ["handoff blocker", handoffBlocker],
  ]);
  return HANDOFF_TERMS.map((term) => verdictRow({
    row_id: `p18001_handoff_gate.${slug(term)}`,
    category: "p18001_handoff_gate",
    label: `P18001 handoff gate: ${term}`,
    required: true,
    observed: states.get(term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17921-P17960",
    generated_at: generatedAt,
    output_ref: "p18001_handoff_gate_rows",
    term_id: slug(term),
  }));
}

function buildFreezeRows(roadmapText, sourceState, debtState, generatedAt) {
  return FREEZE_TERMS.map((term) => verdictRow({
    row_id: `p18000_freeze.${slug(term)}`,
    category: "p18000_freeze",
    label: `P18000 trust delta freeze: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p17601-p18000.md#P17961-P18000",
    generated_at: generatedAt,
    output_ref: "p18000_freeze_rows",
    term_id: slug(term),
    source_ready: sourceState.sourceReady,
    debt_count: debtState.debtCount,
    production_pass_enabled: false,
  }));
}

function buildBoundary(context) {
  const reviewClear = context.sourceState.unresolvedFindingCount === 0 && context.sourceState.blockingFindingCount === 0;
  const validationClear = context.sourceState.validationBlocked === false && context.sourceState.fullSuiteDebt === false;
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validSource
    && context.debtState.debtClear
    && reviewClear
    && validationClear
    && context.sourceState.boundaryClosed
    && allPass(context.authorityRows)
    && allPass(context.operatorRows)
    && allPass(context.debtRows)
    && allPass(context.freezeRows);
  return {
    source_p17600_available: context.sourceState.sourceAvailable,
    source_p17600_ready_for_p17601_handoff: context.sourceState.sourceReady,
    source_block_visible_now: context.sourceState.blockVisible && context.sourceState.sourceReady === false,
    trust_debt_count: context.debtState.debtCount,
    unresolved_finding_count: context.sourceState.unresolvedFindingCount,
    blocking_finding_count: context.sourceState.blockingFindingCount,
    validation_blocked_now: context.sourceState.validationBlocked,
    full_suite_debt_present_now: context.sourceState.fullSuiteDebt,
    p18001_handoff_gate_ready: allPass(context.handoffRows),
    ready_for_p18001_handoff: handoffReady,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P17601-P18000 phase rows incomplete", "docs/hermes-roadmap-p17601-p18000.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P17601-P18000"), "Architecture doc missing P17601-P18000 reference", "docs/architecture.md");
  add("source.available", "source", rowPass(context.sourceRows, "trust_source_binding.p17600_source_availability"), "P17600 source artifact is required", "trust_source_binding_rows");
  add("source.state.visible", "source", rowPass(context.sourceRows, "trust_source_binding.source_range") && rowPass(context.sourceRows, "trust_source_binding.source_status") && rowPass(context.sourceRows, "trust_source_binding.blocker_visibility"), "P17600 source chain/status/blocker must be visible", "trust_source_binding_rows");
  add("baseline.ready", "baseline", context.baselineRows.length === BASELINE_TERMS.length && allPass(context.baselineRows), "Trust baseline rows incomplete", "trust_baseline_snapshot_rows");
  add("evidence.ready", "evidence", context.evidenceRows.length === EVIDENCE_TERMS.length && allPass(context.evidenceRows), "Evidence delta rows incomplete", "evidence_quality_delta_rows");
  add("review.visible", "review", context.reviewRows.length === REVIEW_TERMS.length && (allPass(context.reviewRows) || context.boundary.unresolved_finding_count > 0 || context.boundary.blocking_finding_count > 0), "Review finding delta rows missing finding visibility", "review_finding_delta_rows");
  add("validation.visible", "validation", context.validationRows.length === VALIDATION_TERMS.length && allPass(context.validationRows), "Validation freshness delta rows incomplete", "validation_freshness_delta_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority boundary delta rows incomplete", "authority_boundary_delta_rows");
  add("operator.ready", "operator", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Operator trust projection rows incomplete", "operator_trust_projection_rows");
  add("debt.ready", "debt", context.debtRows.length === DEBT_TERMS.length && allPass(context.debtRows), "Trust debt ledger rows incomplete", "trust_debt_ledger_rows");
  add("handoff.visible", "handoff", context.handoffRows.length === HANDOFF_TERMS.length && (context.boundary.p18001_handoff_gate_ready === true || rowPass(context.handoffRows, "p18001_handoff_gate.handoff_blocker")), "P18001 handoff gate missing blocker visibility", "p18001_handoff_gate_rows");
  add("freeze.ready", "freeze", context.freezeRows.length === FREEZE_TERMS.length && allPass(context.freezeRows), "P18000 freeze rows incomplete", "p18000_freeze_rows");
  add("boundary.no.production.claim", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false, "Trust delta opened production or enterprise authority", "trust_delta_boundary");
  add("boundary.no.execution.raw.secret", "boundary", context.boundary.environment_config_write_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Trust delta opened config migration rollback runtime write connector mutation secret or raw exposure", "trust_delta_boundary");
  add("boundary.no.final.or.bypass", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false && context.boundary.human_gate_bypass_allowed_now === false && context.boundary.independent_review_bypass_allowed_now === false && context.boundary.reviewer_mutation_allowed_now === false, "Trust delta opened final approval or review/human bypass", "trust_delta_boundary");
  return items;
}

function buildSummary(context) {
  return {
    trust_delta_ledger_status: context.boundary.ready_for_p18001_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p17600_ready_for_p17601_handoff: context.boundary.source_p17600_ready_for_p17601_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    trust_debt_count: context.boundary.trust_debt_count,
    unresolved_finding_count: context.boundary.unresolved_finding_count,
    blocking_finding_count: context.boundary.blocking_finding_count,
    validation_blocked_now: context.boundary.validation_blocked_now,
    full_suite_debt_present_now: context.boundary.full_suite_debt_present_now,
    trust_source_binding_row_count: context.sourceRows.length,
    trust_baseline_snapshot_row_count: context.baselineRows.length,
    evidence_quality_delta_row_count: context.evidenceRows.length,
    review_finding_delta_row_count: context.reviewRows.length,
    validation_freshness_delta_row_count: context.validationRows.length,
    authority_boundary_delta_row_count: context.authorityRows.length,
    operator_trust_projection_row_count: context.operatorRows.length,
    trust_debt_ledger_row_count: context.debtRows.length,
    p18001_handoff_gate_row_count: context.handoffRows.length,
    p18000_freeze_row_count: context.freezeRows.length,
    p18001_handoff_gate_ready: context.boundary.p18001_handoff_gate_ready,
    ready_for_p18001_handoff: context.boundary.ready_for_p18001_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Trust Delta Ledger",
    "",
    `Status: ${result.summary.trust_delta_ledger_status}`,
    `Program: ${result.program_range}`,
    `P17600 ready for P17601 handoff: ${result.summary.source_p17600_ready_for_p17601_handoff}`,
    `Trust debt count: ${result.summary.trust_debt_count}`,
    `Unresolved findings: ${result.summary.unresolved_finding_count}`,
    `Full-suite debt present: ${result.summary.full_suite_debt_present_now}`,
    `Ready for P18001 handoff: ${result.summary.ready_for_p18001_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.trust_debt_ledger_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.debt_count)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Trust Delta Ledger</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Trust Delta Ledger</h1>
    <p class="notice">This plane records trust deltas and trust debt. It does not create enterprise trust, shipment approval, execution authority, write authority, raw access, or final approval.</p>
    <table><thead><tr><th>Trust Debt</th><th>Verdict</th><th>Debt Count</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP17600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildFreezeEvidenceCompletion({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.freeze_evidence_completion", built);
}

function operatorExtras() {
  return { read_only_projection_required: true, api_write_allowed_now: false, dashboard_mutation_allowed_now: false };
}

function authorityExtras() {
  return {
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function verdictRow(row) {
  const observed = Boolean(row.observed);
  return {
    ...row,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${row.label} is missing or not ready.`,
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function allPass(rows) {
  return rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
}

function includesAll(text, terms) {
  return terms.every((term) => includesText(text, term));
}

function includesText(text, term) {
  return String(text ?? "").toLowerCase().includes(String(term).toLowerCase());
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const data = JSON.parse(await readFile(resolved, "utf8"));
    return { path: resolved, available: true, data };
  } catch (error) {
    return { path: resolved, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, data: value };
  return { path: label, available: false, data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_TRUST_DELTA_LEDGER_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? defaults.architectureDocPath),
    source_freeze_evidence_completion_path: path.resolve(options.sourceFreezeEvidenceCompletionPath ?? defaults.sourceFreezeEvidenceCompletionPath),
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
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--source") {
      args.sourceFreezeEvidenceCompletionPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE]`);
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
