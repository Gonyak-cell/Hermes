import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildEnterpriseTrustHardeningControlPlane } from "./enterprise-trust-hardening-control-plane.mjs";

export const DEFAULT_OBSERVABILITY_COST_PLANE_OUT_DIR = "artifacts/observability-cost-plane/latest";
export const DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS = {
  schemaPath: "schemas/observability-cost-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p13401-p13800.md",
  architectureDocPath: "docs/architecture.md",
  sourceEnterpriseTrustHardeningPath: "artifacts/enterprise-trust-hardening-control-plane/latest/enterprise-trust-hardening-control-plane.json",
};

const COMMAND_NAME = "platform:observability-cost-plane";
const SCHEMA_VERSION = "observability-cost-plane.v1";
const CAPABILITY_ID = "platform.observability_cost_plane";
const PROGRAM_RANGE = "P13401-P13800";
const SOURCE_PROGRAM_RANGE = "P13001-P13400";
const READY_STATUS = "ready_for_observability_cost_plane";
const BLOCKED_STATUS = "blocked_observability_cost_plane";

const PHASE_SPECS = [
  ["P13401-P13440", "P13400 Source Binding", "observability_source_binding_rows"],
  ["P13441-P13480", "Test Duration Signal", "test_duration_signal_rows"],
  ["P13481-P13520", "Flaky Check Signal", "flaky_check_signal_rows"],
  ["P13521-P13560", "Review Latency Signal", "review_latency_signal_rows"],
  ["P13561-P13600", "Token And Cost Signal", "token_cost_signal_rows"],
  ["P13601-P13640", "Evidence Freshness Signal", "evidence_freshness_signal_rows"],
  ["P13641-P13680", "Gate Failure Signal", "gate_failure_signal_rows"],
  ["P13681-P13720", "Validation Drift Signal", "validation_drift_signal_rows"],
  ["P13721-P13760", "Read-Only Projection Surface", "observability_projection_rows"],
  ["P13761-P13800", "Observability And Cost Freeze", "p13800_freeze_rows"],
];

const TEST_DURATION_TERMS = ["test command id", "duration ms", "started at", "completed at", "exit status", "timeout state"];
const FLAKY_TERMS = ["historical pass/fail count", "retry count", "quarantine status", "owner route", "flake reason", "stability window"];
const REVIEW_LATENCY_TERMS = ["review requested at", "review completed at", "review engine", "finding count", "turnaround minutes", "stale review blocker"];
const TOKEN_COST_TERMS = ["engine id", "input token count", "output token count", "estimated cost", "budget policy ref", "cost overrun blocker"];
const EVIDENCE_FRESHNESS_TERMS = ["evidence ref", "generated at", "freshness ttl", "stale evidence blocker", "source binding", "uncited memory blocker"];
const GATE_FAILURE_TERMS = ["gate id", "failure count", "last failure reason", "blocking severity", "owner route", "next action ref"];
const VALIDATION_DRIFT_TERMS = ["validator id", "expected status", "observed status", "drift detected at", "schema version", "drift blocker"];
const PROJECTION_TERMS = ["read-only API row", "dashboard row", "phase status rollup", "blocker summary", "metric snapshot ref", "no metric mutation"];
const AUTHORITY_TERMS = [
  "no metric write",
  "no telemetry collector start",
  "no budget mutation",
  "no external provider call",
  "no raw source exposure",
  "no production PASS",
  "no enterprise trust claim",
  "no final automated approval",
];

export async function runObservabilityCostPlane(options = {}) {
  const result = await buildObservabilityCostPlane(options);
  if (options.write !== false) await writeObservabilityCostPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Observability And Cost Plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildObservabilityCostPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OBSERVABILITY_COST_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "enterpriseTrustHardeningControlPlane")
    ? normalizeInlineJsonSource("inline.enterprise_trust_hardening_control_plane", options.enterpriseTrustHardeningControlPlane)
    : await readJsonOrBuildEnterpriseTrust(inputs.source_enterprise_trust_hardening_path, generatedAt);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const testRows = buildTermRows("test_duration_signal", "Test duration", TEST_DURATION_TERMS, roadmapDoc.text, "test_duration_signal_rows", generatedAt, testDurationExtras);
  const flakyRows = buildTermRows("flaky_check_signal", "Flaky check", FLAKY_TERMS, roadmapDoc.text, "flaky_check_signal_rows", generatedAt, flakyExtras);
  const reviewLatencyRows = buildTermRows("review_latency_signal", "Review latency", REVIEW_LATENCY_TERMS, roadmapDoc.text, "review_latency_signal_rows", generatedAt, reviewLatencyExtras);
  const tokenCostRows = buildTermRows("token_cost_signal", "Token and cost", TOKEN_COST_TERMS, roadmapDoc.text, "token_cost_signal_rows", generatedAt, tokenCostExtras);
  const evidenceFreshnessRows = buildTermRows("evidence_freshness_signal", "Evidence freshness", EVIDENCE_FRESHNESS_TERMS, roadmapDoc.text, "evidence_freshness_signal_rows", generatedAt, evidenceFreshnessExtras);
  const gateFailureRows = buildTermRows("gate_failure_signal", "Gate failure", GATE_FAILURE_TERMS, roadmapDoc.text, "gate_failure_signal_rows", generatedAt, gateFailureExtras);
  const validationDriftRows = buildTermRows("validation_drift_signal", "Validation drift", VALIDATION_DRIFT_TERMS, roadmapDoc.text, "validation_drift_signal_rows", generatedAt, validationDriftExtras);
  const projectionRows = buildTermRows("observability_projection", "Read-only projection", PROJECTION_TERMS, roadmapDoc.text, "observability_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("observability_authority_guard", "Observability authority guard", AUTHORITY_TERMS, roadmapDoc.text, "observability_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, testRows, flakyRows, reviewLatencyRows, tokenCostRows, evidenceFreshnessRows, gateFailureRows, validationDriftRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, testRows, flakyRows, reviewLatencyRows, tokenCostRows, evidenceFreshnessRows, gateFailureRows, validationDriftRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, testRows, flakyRows, reviewLatencyRows, tokenCostRows, evidenceFreshnessRows, gateFailureRows, validationDriftRows, projectionRows, authorityRows, freezeRows, boundary });
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
      enterprise_trust_hardening_control_plane_path: source.path,
    },
    source_enterprise_trust_hardening_summary: source.data?.summary ?? null,
    observability_cost_contract: buildContract(generatedAt),
    observability_cost_phase_rows: phaseRows,
    observability_source_binding_rows: sourceRows,
    test_duration_signal_rows: testRows,
    flaky_check_signal_rows: flakyRows,
    review_latency_signal_rows: reviewLatencyRows,
    token_cost_signal_rows: tokenCostRows,
    evidence_freshness_signal_rows: evidenceFreshnessRows,
    gate_failure_signal_rows: gateFailureRows,
    validation_drift_signal_rows: validationDriftRows,
    observability_projection_rows: projectionRows,
    observability_authority_guard_rows: authorityRows,
    p13800_freeze_rows: freezeRows,
    observability_cost_boundary: boundary,
    observability_cost_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, testRows, flakyRows, reviewLatencyRows, tokenCostRows, evidenceFreshnessRows, gateFailureRows, validationDriftRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "observability_cost_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.observability_cost_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.observability_cost_validation_items);
  result.summary = buildSummary({ boundary, testRows, flakyRows, reviewLatencyRows, tokenCostRows, evidenceFreshnessRows, gateFailureRows, validationDriftRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeObservabilityCostPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "observability-cost-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "observability-cost-phase-rows.json"), collectionEnvelope("observability-cost-phase-rows.v1", "observability_cost_phase_rows", result.observability_cost_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "observability-source-binding-rows.json"), collectionEnvelope("observability-source-binding-rows.v1", "observability_source_binding_rows", result.observability_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "test-duration-signal-rows.json"), collectionEnvelope("test-duration-signal-rows.v1", "test_duration_signal_rows", result.test_duration_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "flaky-check-signal-rows.json"), collectionEnvelope("flaky-check-signal-rows.v1", "flaky_check_signal_rows", result.flaky_check_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-latency-signal-rows.json"), collectionEnvelope("review-latency-signal-rows.v1", "review_latency_signal_rows", result.review_latency_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "token-cost-signal-rows.json"), collectionEnvelope("token-cost-signal-rows.v1", "token_cost_signal_rows", result.token_cost_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-freshness-signal-rows.json"), collectionEnvelope("evidence-freshness-signal-rows.v1", "evidence_freshness_signal_rows", result.evidence_freshness_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-failure-signal-rows.json"), collectionEnvelope("gate-failure-signal-rows.v1", "gate_failure_signal_rows", result.gate_failure_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-drift-signal-rows.json"), collectionEnvelope("validation-drift-signal-rows.v1", "validation_drift_signal_rows", result.validation_drift_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "observability-projection-rows.json"), collectionEnvelope("observability-projection-rows.v1", "observability_projection_rows", result.observability_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "observability-authority-guard-rows.json"), collectionEnvelope("observability-authority-guard-rows.v1", "observability_authority_guard_rows", result.observability_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p13800-freeze-rows.json"), collectionEnvelope("p13800-freeze-rows.v1", "p13800_freeze_rows", result.p13800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "observability-cost-boundary.json"), result.observability_cost_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "observability-cost-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.observability_cost_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runObservabilityCostPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runObservabilityCostPlane(args);
    console.log(`Observability And Cost Plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.observability_cost_plane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P13401: ${result.summary.source_ready_for_p13401_handoff}`);
    console.log(`Ready for P13801 handoff: ${result.summary.ready_for_p13801_handoff}`);
    console.log(`Metric write allowed: ${result.summary.metric_write_allowed_now}`);
    console.log(`Telemetry collector start allowed: ${result.summary.telemetry_collector_start_allowed_now}`);
    console.log(`Budget mutation allowed: ${result.summary.budget_mutation_allowed_now}`);
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
    contract_id: "observability-cost-plane.contract.v1",
    generated_at: generatedAt,
    source_enterprise_trust_hardening_required: true,
    test_duration_signal_required: true,
    flaky_check_signal_required: true,
    review_latency_signal_required: true,
    token_cost_signal_required: true,
    evidence_freshness_signal_required: true,
    gate_failure_signal_required: true,
    validation_drift_signal_required: true,
    read_only_projection_required: true,
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p13401-p13800.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.enterprise_trust_boundary ?? {};
  const sourceStatus = summary.enterprise_trust_hardening_control_plane_status ?? "missing";
  const sourceReady = summary.ready_for_p13401_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P13001-P13400 source artifact available", source.available],
    ["source.range", "P13001-P13400 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P13400 source status visible", sourceStatus === "ready_for_enterprise_trust_hardening_control_plane" || sourceStatus === "blocked_enterprise_trust_hardening_control_plane"],
    ["source.handoff", "P13400 ready_for_p13401_handoff", sourceReady],
    ["source.block_visible", "P13400 blocker visible", sourceReady || sourceBlocked],
    ["source.trust_contract", "P13400 enterprise trust hardening contract rows available", Number(summary.independent_review_hardening_row_count ?? 0) >= 6 && Number(summary.attestation_hardening_row_count ?? 0) >= 6 && Number(summary.sbom_dependency_evidence_row_count ?? 0) >= 6],
    ["source.no_trust_release", "P13400 source did not open trust production release or deployment", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false && boundary.deployment_allowed_now === false && boundary.release_approval_allowed_now === false],
    ["source.no_write_final", "P13400 source did not open write protected action runtime or final approval", boundary.write_action_allowed_now === false && boundary.protected_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p13401-p13800.md#observability-and-cost-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  return [
    ["freeze.source", "P13400 source ready for P13401", sourceReady],
    ["freeze.source_block_visible", "P13400 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.test_duration", "test duration signal ready", allPass(context.testRows)],
    ["freeze.flaky_check", "flaky check signal ready", allPass(context.flakyRows)],
    ["freeze.review_latency", "review latency signal ready", allPass(context.reviewLatencyRows)],
    ["freeze.token_cost", "token cost signal ready", allPass(context.tokenCostRows)],
    ["freeze.evidence_freshness", "evidence freshness signal ready", allPass(context.evidenceFreshnessRows)],
    ["freeze.gate_failure", "gate failure signal ready", allPass(context.gateFailureRows)],
    ["freeze.validation_drift", "validation drift signal ready", allPass(context.validationDriftRows)],
    ["freeze.projection", "read-only observability projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "observability authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_metric_or_unsafe_action", "no metric write collector start budget mutation trust PASS deployment write or final approval opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p13800_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p13800-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const testReady = allPass(context.testRows);
  const flakyReady = allPass(context.flakyRows);
  const reviewLatencyReady = allPass(context.reviewLatencyRows);
  const tokenCostReady = allPass(context.tokenCostRows);
  const evidenceReady = allPass(context.evidenceFreshnessRows);
  const gateReady = allPass(context.gateFailureRows);
  const driftReady = allPass(context.validationDriftRows);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = testReady && flakyReady && reviewLatencyReady && tokenCostReady && evidenceReady && gateReady && driftReady && projectionReady && authorityReady;
  const freezeReady = sourceReady && contractReady && allPass(context.freezeRows);
  return {
    source_enterprise_trust_hardening_available: sourceAvailable,
    source_ready_for_p13401_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    test_duration_signal_ready: testReady,
    flaky_check_signal_ready: flakyReady,
    review_latency_signal_ready: reviewLatencyReady,
    token_cost_signal_ready: tokenCostReady,
    evidence_freshness_signal_ready: evidenceReady,
    gate_failure_signal_ready: gateReady,
    validation_drift_signal_ready: driftReady,
    observability_projection_ready: projectionReady,
    observability_authority_guard_ready: authorityReady,
    p13800_observability_cost_freeze_ready: freezeReady,
    ready_for_p13801_handoff: freezeReady,
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
    external_provider_call_allowed_now: false,
    raw_source_exposure_allowed: false,
    raw_transcript_exposure_allowed: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P13401-P13800 phase rows incomplete", "docs/hermes-roadmap-p13401-p13800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P13401-P13800"), "Architecture doc missing P13401-P13800 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P13400 source state must be available and blocker-visible", "observability_source_binding_rows");
  add("test_duration.ready", "observability", context.testRows.length === TEST_DURATION_TERMS.length && allPass(context.testRows), "Test duration signal rows incomplete", "test_duration_signal_rows");
  add("flaky.ready", "observability", context.flakyRows.length === FLAKY_TERMS.length && allPass(context.flakyRows), "Flaky check signal rows incomplete", "flaky_check_signal_rows");
  add("review_latency.ready", "observability", context.reviewLatencyRows.length === REVIEW_LATENCY_TERMS.length && allPass(context.reviewLatencyRows), "Review latency signal rows incomplete", "review_latency_signal_rows");
  add("token_cost.ready", "observability", context.tokenCostRows.length === TOKEN_COST_TERMS.length && allPass(context.tokenCostRows), "Token cost signal rows incomplete", "token_cost_signal_rows");
  add("evidence_freshness.ready", "observability", context.evidenceFreshnessRows.length === EVIDENCE_FRESHNESS_TERMS.length && allPass(context.evidenceFreshnessRows), "Evidence freshness signal rows incomplete", "evidence_freshness_signal_rows");
  add("gate_failure.ready", "observability", context.gateFailureRows.length === GATE_FAILURE_TERMS.length && allPass(context.gateFailureRows), "Gate failure signal rows incomplete", "gate_failure_signal_rows");
  add("validation_drift.ready", "observability", context.validationDriftRows.length === VALIDATION_DRIFT_TERMS.length && allPass(context.validationDriftRows), "Validation drift signal rows incomplete", "validation_drift_signal_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Projection rows incomplete", "observability_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "observability_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P13800 freeze rows missing", "p13800_freeze_rows");
  add("boundary.no.metric.mutation", "boundary", context.boundary.metric_write_allowed_now === false && context.boundary.telemetry_collector_start_allowed_now === false && context.boundary.budget_mutation_allowed_now === false && context.boundary.external_provider_call_allowed_now === false, "Observability plane opened metric collector budget or provider action", "observability_cost_boundary");
  add("boundary.no.trust.release", "boundary", context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Observability plane opened trust production release or deployment", "observability_cost_boundary");
  add("boundary.no.write.final.raw", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.raw_transcript_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Observability plane opened write runtime raw exposure or final approval", "observability_cost_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p13801_handoff === context.boundary.p13800_observability_cost_freeze_ready, "P13801 handoff state must match P13800 freeze state", "observability_cost_boundary");
  return items;
}

function buildSummary(context) {
  return {
    observability_cost_plane_status: context.boundary.ready_for_p13801_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p13401_handoff: context.boundary.source_ready_for_p13401_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    test_duration_signal_row_count: context.testRows.length,
    flaky_check_signal_row_count: context.flakyRows.length,
    review_latency_signal_row_count: context.reviewLatencyRows.length,
    token_cost_signal_row_count: context.tokenCostRows.length,
    evidence_freshness_signal_row_count: context.evidenceFreshnessRows.length,
    gate_failure_signal_row_count: context.gateFailureRows.length,
    validation_drift_signal_row_count: context.validationDriftRows.length,
    observability_projection_row_count: context.projectionRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p13800_observability_cost_freeze_ready: context.boundary.p13800_observability_cost_freeze_ready,
    ready_for_p13801_handoff: context.boundary.ready_for_p13801_handoff,
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
    external_provider_call_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Observability And Cost Plane",
    "",
    `Status: ${result.summary.observability_cost_plane_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P13401: ${result.summary.source_ready_for_p13401_handoff}`,
    `Test duration rows: ${result.summary.test_duration_signal_row_count}`,
    `Flaky check rows: ${result.summary.flaky_check_signal_row_count}`,
    `Review latency rows: ${result.summary.review_latency_signal_row_count}`,
    `Token/cost rows: ${result.summary.token_cost_signal_row_count}`,
    `Evidence freshness rows: ${result.summary.evidence_freshness_signal_row_count}`,
    `Gate failure rows: ${result.summary.gate_failure_signal_row_count}`,
    `Validation drift rows: ${result.summary.validation_drift_signal_row_count}`,
    `Ready for P13801 handoff: ${result.summary.ready_for_p13801_handoff}`,
    `Metric write allowed: ${result.summary.metric_write_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.observability_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.metric_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Observability And Cost Plane</title>
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
    <h1>Hermes Observability And Cost Plane</h1>
    <p class="notice">This plane tracks validation duration, flake, review latency, cost, freshness, failures, and drift as read-only signals. Metric snapshots remain read-only; collectors, budgets, production approval, deployment, and protected finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Metric Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildEnterpriseTrust(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildEnterpriseTrustHardeningControlPlane({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.enterprise_trust_hardening_control_plane", built);
}

function testDurationExtras() {
  return { duration_observed_required: true, timeout_state_required: true, runtime_control_allowed_now: false };
}

function flakyExtras() {
  return { flaky_signal_required: true, retry_execution_allowed_now: false, quarantine_mutation_allowed_now: false };
}

function reviewLatencyExtras() {
  return { review_latency_required: true, stale_review_blocker_required: true, review_auto_approval_allowed: false };
}

function tokenCostExtras() {
  return { token_cost_signal_required: true, budget_policy_required: true, budget_mutation_allowed_now: false };
}

function evidenceFreshnessExtras() {
  return { evidence_freshness_required: true, raw_source_exposure_allowed: false, uncited_memory_allowed: false };
}

function gateFailureExtras() {
  return { gate_failure_signal_required: true, owner_route_required: true, gate_auto_override_allowed: false };
}

function validationDriftExtras() {
  return { validation_drift_signal_required: true, drift_blocker_required: true, validator_mutation_allowed_now: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, metric_snapshot_ref_required: true, metric_mutation_allowed_now: false };
}

function authorityExtras() {
  return {
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
    external_provider_call_allowed_now: false,
    raw_source_exposure_allowed: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS.architectureDocPath,
    source_enterprise_trust_hardening_path: options.sourceEnterpriseTrustHardeningPath ?? DEFAULT_OBSERVABILITY_COST_PLANE_INPUTS.sourceEnterpriseTrustHardeningPath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-enterprise-trust-hardening-path") args.sourceEnterpriseTrustHardeningPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P13401-P13800 Observability And Cost Plane artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
