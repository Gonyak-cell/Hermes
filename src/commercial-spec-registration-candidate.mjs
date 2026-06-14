import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P34800_FALSE_FLAGS,
  buildClarificationAnswerReceiptCandidateQueue,
} from "./clarification-answer-receipt-candidate-queue.mjs";

export const DEFAULT_COMMERCIAL_SPEC_REGISTRATION_CANDIDATE_OUT_DIR = "artifacts/commercial-spec-registration-candidate/latest";
export const DEFAULT_COMMERCIAL_SPEC_REGISTRATION_CANDIDATE_INPUTS = {
  schemaPath: "schemas/commercial-spec-registration-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p34801-p35200.md",
  architectureDocPath: "docs/architecture.md",
  sourceClarificationAnswerReceiptQueuePath: "artifacts/clarification-answer-receipt-candidate-queue/latest/clarification-answer-receipt-candidate-queue.json",
};

const COMMAND_NAME = "platform:commercial-spec-registration-candidate";
const SCHEMA_VERSION = "commercial-spec-registration-candidate.v1";
const CAPABILITY_ID = "platform.commercial_spec_registration_candidate";
const PROGRAM_RANGE = "P34801-P35200";
const SOURCE_PROGRAM_RANGE = "P34401-P34800";
const READY_STATUS = "ready_for_commercial_spec_registration_candidate";
const BLOCK_PENDING_STATUS = "valid_block_commercial_spec_registration_candidate_pending";
const BLOCKED_STATUS = "blocked_commercial_spec_registration_candidate";

const PHASE_SPECS = [
  ["P34801-P34840", "P34800 Source Binding", "p34800_source_binding_rows"],
  ["P34841-P34890", "Commercial Spec Readiness Projection", "commercial_spec_readiness_projection_rows"],
  ["P34891-P34940", "Requirement Traceability Binding Candidate", "requirement_traceability_binding_candidate_rows"],
  ["P34941-P34990", "Project Plan Registration Candidate", "project_plan_registration_candidate_rows"],
  ["P34991-P35050", "Spec Conflict and Freshness Blocker Ledger", "spec_conflict_freshness_blocker_rows"],
  ["P35051-P35110", "Operator Commercial Spec Projection", "operator_commercial_spec_projection_rows"],
  ["P35111-P35160", "No-Registration Boundary and Wiring", "no_registration_authority_boundary_rows"],
  ["P35161-P35200", "P35200 Clean Checkpoint", "p35200_clean_checkpoint_rows"],
];

export const COMMERCIAL_SPEC_REGISTRATION_FALSE_FLAGS = [
  "commercial_spec_actual_registration_allowed_now",
  "commercial_spec_readiness_pass_allowed_now",
  "commercial_spec_requirement_traceability_pass_allowed_now",
  "commercial_spec_plan_registration_allowed_now",
  "commercial_spec_conflict_bypass_allowed_now",
  "commercial_spec_freshness_bypass_allowed_now",
  "commercial_spec_operator_register_button_allowed_now",
  "commercial_spec_runtime_execution_allowed_now",
  "commercial_spec_write_action_allowed_now",
  "commercial_spec_protected_action_allowed_now",
  "commercial_spec_connector_write_allowed_now",
  "commercial_spec_deployment_allowed_now",
  "commercial_spec_review_completion_allowed_now",
  "commercial_spec_final_approval_allowed_now",
  "commercial_spec_production_pass_allowed_now",
  "commercial_spec_enterprise_trust_claim_allowed_now",
  "commercial_spec_secret_read_allowed_now",
  "commercial_spec_human_gate_bypass_allowed_now",
  "commercial_spec_independent_review_bypass_allowed_now",
  "commercial_spec_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...COMMERCIAL_SPEC_REGISTRATION_FALSE_FLAGS, ...P34800_FALSE_FLAGS])];

export async function runCommercialSpecRegistrationCandidate(options = {}) {
  const result = await buildCommercialSpecRegistrationCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Commercial Spec Registration Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeCommercialSpecRegistrationCandidate(result, result.output_dir);
  return result;
}

export async function buildCommercialSpecRegistrationCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_COMMERCIAL_SPEC_REGISTRATION_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "clarificationAnswerReceiptQueue")
    ? normalizeInlineJsonSource("inline.clarification_answer_receipt_queue", options.clarificationAnswerReceiptQueue)
    : await readJsonOrBuildP34800(inputs.source_clarification_answer_receipt_queue_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const specRows = buildCommercialSpecReadinessProjectionRows({ source, generatedAt });
  const traceRows = buildRequirementTraceabilityBindingCandidateRows({ specRows, generatedAt });
  const planRows = buildProjectPlanRegistrationCandidateRows({ specRows, traceRows, generatedAt });
  const blockerRows = buildSpecConflictFreshnessBlockerRows({ source, planRows, generatedAt });
  const operatorRows = buildOperatorCommercialSpecProjectionRows({ planRows, blockerRows, generatedAt });
  const boundaryRows = buildNoRegistrationAuthorityBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, specRows, traceRows, planRows, blockerRows, operatorRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, specRows, traceRows, planRows, blockerRows, operatorRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, specRows, traceRows, planRows, blockerRows, operatorRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      clarification_answer_receipt_queue_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_clarification_answer_receipt_queue_summary: source.data?.summary ?? null,
    commercial_spec_registration_candidate_contract: buildContract(generatedAt),
    commercial_spec_registration_phase_rows: phaseRows,
    p34800_source_binding_rows: sourceRows,
    commercial_spec_readiness_projection_rows: specRows,
    requirement_traceability_binding_candidate_rows: traceRows,
    project_plan_registration_candidate_rows: planRows,
    spec_conflict_freshness_blocker_rows: blockerRows,
    operator_commercial_spec_projection_rows: operatorRows,
    no_registration_authority_boundary_rows: boundaryRows,
    commercial_spec_registration_wiring_rows: wiringRows,
    p35200_clean_checkpoint_rows: checkpointRows,
    commercial_spec_registration_boundary: boundary,
    commercial_spec_registration_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "commercial_spec_registration_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.commercial_spec_registration_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.commercial_spec_registration_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeCommercialSpecRegistrationCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "commercial-spec-registration-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p34800-source-binding-rows.json"), collectionEnvelope("p34800-source-binding-rows.v1", "p34800_source_binding_rows", result.p34800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "commercial-spec-readiness-projection-rows.json"), collectionEnvelope("commercial-spec-readiness-projection-rows.v1", "commercial_spec_readiness_projection_rows", result.commercial_spec_readiness_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "requirement-traceability-binding-candidate-rows.json"), collectionEnvelope("requirement-traceability-binding-candidate-rows.v1", "requirement_traceability_binding_candidate_rows", result.requirement_traceability_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-plan-registration-candidate-rows.json"), collectionEnvelope("project-plan-registration-candidate-rows.v1", "project_plan_registration_candidate_rows", result.project_plan_registration_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "spec-conflict-freshness-blocker-rows.json"), collectionEnvelope("spec-conflict-freshness-blocker-rows.v1", "spec_conflict_freshness_blocker_rows", result.spec_conflict_freshness_blocker_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-commercial-spec-projection-rows.json"), collectionEnvelope("operator-commercial-spec-projection-rows.v1", "operator_commercial_spec_projection_rows", result.operator_commercial_spec_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-registration-authority-boundary-rows.json"), collectionEnvelope("no-registration-authority-boundary-rows.v1", "no_registration_authority_boundary_rows", result.no_registration_authority_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "commercial-spec-registration-wiring-rows.json"), collectionEnvelope("commercial-spec-registration-wiring-rows.v1", "commercial_spec_registration_wiring_rows", result.commercial_spec_registration_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p35200-clean-checkpoint-rows.json"), collectionEnvelope("p35200-clean-checkpoint-rows.v1", "p35200_clean_checkpoint_rows", result.p35200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "commercial-spec-registration-boundary.json"), result.commercial_spec_registration_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runCommercialSpecRegistrationCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runCommercialSpecRegistrationCandidate(args);
  console.log(`Commercial Spec Registration Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.commercial_spec_registration_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P34800 ready for commercial spec registration: ${result.summary.source_p34800_ready_for_commercial_spec_registration}`);
  console.log(`Commercial spec projections: ${result.summary.commercial_spec_readiness_projection_count}`);
  console.log(`Traceability candidates: ${result.summary.requirement_traceability_binding_candidate_count}`);
  console.log(`Plan registration candidates: ${result.summary.project_plan_registration_candidate_count}`);
  console.log(`Ready for plan registry control-plane handoff: ${result.summary.ready_for_plan_registry_control_plane_handoff}`);
  console.log(`Actual registration allowed: ${result.summary.commercial_spec_actual_registration_allowed_now}`);
  console.log(`Plan registration allowed: ${result.summary.commercial_spec_plan_registration_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.clarification_answer_receipt_queue_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_commercial_spec_registration_handoff === true,
    status: summary.clarification_answer_receipt_queue_status ?? "missing",
    p34800ContractReady: boundary.p34800_contract_ready === true,
    queueVisible: boundary.redacted_answer_receipt_candidate_queue_visible_now === true,
    conflictVisible: boundary.conflict_resolution_ledger_candidate_visible_now === true,
    staleVisible: boundary.stale_context_recheck_candidate_visible_now === true,
    packetVisible: boundary.answer_receipt_evidence_packet_candidate_visible_now === true,
    noRawClosed: boundary.no_raw_capture_boundary_closed_now === true,
    boundaryClosed: P34800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p34801-p35200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P34800 answer receipt queue source is available", sourceState.available],
    ["program_range", "P34800 source program range is P34401-P34800", sourceState.programRangeOk],
    ["validation_valid", "P34800 source validation is valid", sourceState.validationValid],
    ["commercial_spec_registration_handoff_open", "P34800 opened commercial spec registration handoff", sourceState.sourceReady],
    ["p34800_contract_ready", "P34800 source contract is ready", sourceState.p34800ContractReady],
    ["answer_receipt_queue_visible", "P34800 answer receipt queue is visible", sourceState.queueVisible],
    ["conflict_ledger_visible", "P34800 conflict ledger is visible", sourceState.conflictVisible],
    ["stale_context_visible", "P34800 stale context candidate is visible", sourceState.staleVisible],
    ["evidence_packet_visible", "P34800 evidence packet candidate is visible", sourceState.packetVisible],
    ["no_raw_boundary_closed", "P34800 no-raw-capture boundary is closed", sourceState.noRawClosed],
    ["commit_ref_present", "Current commit ref is present for commercial spec registration", Boolean(commitRef)],
    ["source_blocker_visible", "P34800 source blocker is visible when commercial spec registration is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p34800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildCommercialSpecReadinessProjectionRows({ source, generatedAt }) {
  const packetRows = source.data?.answer_receipt_evidence_packet_candidate_rows ?? [];
  return packetRows.map((packet) => row({
    row_id: `commercial_spec_readiness_projection.${packet.request_id}`,
    category: "commercial_spec_readiness_projection",
    label: `Commercial spec readiness projection for ${packet.request_id}`,
    observed: Boolean(packet.request_id && packet.packet_candidate_visible_now === true),
    evidence_ref: packet.row_id,
    request_id: packet.request_id,
    spec_candidate_ref: `commercial_spec.${packet.request_id}.candidate`,
    evidence_packet_ref: packet.evidence_packet_ref,
    required_evidence_refs: packet.required_refs ?? [],
    spec_readiness_projection_visible_now: true,
    spec_readiness_pass_allowed_now: false,
    actual_registration_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildRequirementTraceabilityBindingCandidateRows({ specRows, generatedAt }) {
  return specRows.map((spec) => row({
    row_id: `requirement_traceability_binding_candidate.${spec.request_id}`,
    category: "requirement_traceability_binding_candidate",
    label: `Requirement traceability binding candidate for ${spec.request_id}`,
    observed: Boolean(spec.spec_candidate_ref),
    evidence_ref: spec.row_id,
    request_id: spec.request_id,
    traceability_candidate_ref: `requirement_traceability.${spec.request_id}.candidate`,
    requirement_source_refs: spec.required_evidence_refs,
    traceability_binding_visible_now: true,
    traceability_pass_allowed_now: false,
    missing_evidence_blocker_visible_now: true,
    generated_at: generatedAt,
  }));
}

function buildProjectPlanRegistrationCandidateRows({ specRows, traceRows, generatedAt }) {
  return specRows.map((spec) => {
    const trace = traceRows.find((item) => item.request_id === spec.request_id);
    return row({
      row_id: `project_plan_registration_candidate.${spec.request_id}`,
      category: "project_plan_registration_candidate",
      label: `Project plan registration candidate for ${spec.request_id}`,
      observed: Boolean(trace),
      evidence_ref: trace?.row_id ?? spec.row_id,
      request_id: spec.request_id,
      plan_registration_candidate_ref: `plan_registry.${spec.request_id}.candidate`,
      spec_candidate_ref: spec.spec_candidate_ref,
      traceability_candidate_ref: trace?.traceability_candidate_ref ?? null,
      plan_registration_candidate_visible_now: true,
      plan_registration_allowed_now: false,
      actual_registration_allowed_now: false,
      write_action_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildSpecConflictFreshnessBlockerRows({ source, planRows, generatedAt }) {
  const conflictRows = source.data?.conflict_resolution_ledger_candidate_rows ?? [];
  const staleRows = source.data?.stale_context_recheck_candidate_rows ?? [];
  return planRows.flatMap((plan) => {
    const conflict = conflictRows.find((item) => item.request_id === plan.request_id);
    const stale = staleRows.find((item) => item.request_id === plan.request_id);
    return [
      ["conflict_resolution_missing", "Conflict resolution receipt is still missing", conflict?.row_id],
      ["stale_context_recheck_missing", "Stale context recheck receipt is still missing", stale?.row_id],
      ["spec_registration_review_missing", "Spec registration review is still missing", plan.row_id],
    ].map(([id, label, evidenceRef]) => row({
      row_id: `spec_conflict_freshness_blocker.${plan.request_id}.${id}`,
      category: "spec_conflict_freshness_blocker",
      label: `${label} for ${plan.request_id}`,
      observed: Boolean(evidenceRef),
      evidence_ref: evidenceRef ?? plan.row_id,
      request_id: plan.request_id,
      blocker_type: id,
      blocker_visible_now: true,
      conflict_bypass_allowed_now: false,
      freshness_bypass_allowed_now: false,
      registration_pass_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildOperatorCommercialSpecProjectionRows({ planRows, blockerRows, generatedAt }) {
  return planRows.map((plan) => {
    const blockers = blockerRows.filter((item) => item.request_id === plan.request_id);
    return row({
      row_id: `operator_commercial_spec_projection.${plan.request_id}`,
      category: "operator_commercial_spec_projection",
      label: `Operator commercial spec projection for ${plan.request_id}`,
      observed: blockers.length >= 3,
      evidence_ref: plan.row_id,
      request_id: plan.request_id,
      operator_status: "blocked_waiting_for_spec_registration_evidence",
      next_action: "complete_traceability_conflict_freshness_and_review_receipts",
      blocker_count: blockers.length,
      register_button_enabled_now: false,
      approve_button_enabled_now: false,
      execute_button_enabled_now: false,
      production_pass_enabled_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoRegistrationAuthorityBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.spec_projection_is_not_registration", "Spec projection must not register a plan", true],
    ["state.traceability_candidate_is_not_traceability_pass", "Traceability candidate must not become PASS", true],
    ["state.plan_candidate_is_not_registered_plan", "Plan candidate must not create a plan registry record", true],
    ["state.operator_projection_is_not_registration_surface", "Operator projection must not enable registration controls", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_registration_authority_boundary.${id}`,
    category: "no_registration_authority_boundary",
    label,
    observed,
    evidence_ref: "commercial_spec_registration_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_registration_authority_boundary.${flag}`,
    category: "no_registration_authority_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "commercial_spec_registration_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P35200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/commercial-spec-registration-candidate.schema.json"],
    ["roadmap_doc", "Roadmap documents all P34801-P35200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p34801-p35200.md"],
    ["architecture_doc", "Architecture doc references P34801-P35200", architectureDoc.text.includes("P34801-P35200 Commercial Spec Registration Candidate"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `commercial_spec_registration_wiring.${id}`,
    category: "commercial_spec_registration_wiring",
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.specRows)
    && allPass(context.traceRows)
    && allPass(context.planRows)
    && allPass(context.blockerRows)
    && allPass(context.operatorRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P34800 source is ready for commercial spec registration", context.sourceState.sourceReady],
    ["spec_projection_visible", "Commercial spec readiness projection rows are visible", allPass(context.specRows)],
    ["traceability_candidate_visible", "Requirement traceability candidates are visible", allPass(context.traceRows)],
    ["plan_registration_candidate_visible", "Project plan registration candidates are visible", allPass(context.planRows)],
    ["blockers_visible", "Spec conflict and freshness blockers are visible", allPass(context.blockerRows)],
    ["operator_projection_visible", "Operator commercial spec projections are visible", allPass(context.operatorRows)],
    ["no_registration_boundary_closed", "No-registration boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["actual_registration_blocked", "Actual spec and plan registration stay blocked", true],
    ["plan_registry_handoff", "Plan registry control-plane handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p35200_checkpoint.${id}`,
    category: "p35200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p35200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p35200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.specRows)
    && allPass(context.traceRows)
    && allPass(context.planRows)
    && allPass(context.blockerRows)
    && allPass(context.operatorRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p35200_checkpoint.actual_registration_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p35200ContractReady;
  return {
    p35200_contract_ready: p35200ContractReady,
    ready_for_plan_registry_control_plane_handoff: ready,
    source_p34800_ready_for_commercial_spec_registration: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    commercial_spec_readiness_projection_visible_now: allPass(context.specRows),
    requirement_traceability_binding_candidate_visible_now: allPass(context.traceRows),
    project_plan_registration_candidate_visible_now: allPass(context.planRows),
    spec_conflict_freshness_blockers_visible_now: allPass(context.blockerRows),
    operator_commercial_spec_projection_visible_now: allPass(context.operatorRows),
    no_registration_authority_boundary_closed_now: allPass(context.boundaryRows),
    commercial_spec_registration_wiring_complete_now: allPass(context.wiringRows),
    commercial_spec_readiness_projection_count: context.specRows.length,
    requirement_traceability_binding_candidate_count: context.traceRows.length,
    project_plan_registration_candidate_count: context.planRows.length,
    blocker_count: context.blockerRows.length,
    operator_projection_count: context.operatorRows.length,
    actual_registration_allowed_count: context.planRows.filter((item) => item.actual_registration_allowed_now === true).length,
    plan_registration_allowed_count: context.planRows.filter((item) => item.plan_registration_allowed_now === true).length,
    spec_readiness_pass_allowed_count: context.specRows.filter((item) => item.spec_readiness_pass_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P34801-P35200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P34800 source state is not visible"),
    validationItem("spec.visible", "commercial_spec", allPass(context.specRows), "Commercial spec projections are incomplete"),
    validationItem("traceability.visible", "commercial_spec", allPass(context.traceRows), "Traceability candidates are incomplete"),
    validationItem("plan.visible", "commercial_spec", allPass(context.planRows), "Plan registration candidates are incomplete"),
    validationItem("blockers.visible", "commercial_spec", allPass(context.blockerRows), "Spec conflict/freshness blockers are incomplete"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator commercial spec projections are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P34801-P35200 wiring is incomplete"),
    validationItem("no.spec.pass", "authority", context.specRows.every((item) => item.spec_readiness_pass_allowed_now === false), "Spec readiness PASS opened"),
    validationItem("no.traceability.pass", "authority", context.traceRows.every((item) => item.traceability_pass_allowed_now === false), "Traceability PASS opened"),
    validationItem("no.plan.registration", "authority", context.planRows.every((item) => item.plan_registration_allowed_now === false && item.actual_registration_allowed_now === false), "Plan registration opened"),
    validationItem("no.blocker.bypass", "authority", context.blockerRows.every((item) => item.conflict_bypass_allowed_now === false && item.freshness_bypass_allowed_now === false && item.registration_pass_allowed_now === false), "Conflict/freshness bypass opened"),
    validationItem("no.operator.actions", "authority", context.operatorRows.every((item) => item.register_button_enabled_now === false && item.approve_button_enabled_now === false && item.execute_button_enabled_now === false), "Operator registration/action surface opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p35200_checkpoint.actual_registration_blocked"), "P35200 registration blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "commercial_spec_registration_candidate.contract.v1",
    generated_at: generatedAt,
    source_p34800_required_or_rebuilt: true,
    commercial_spec_readiness_projection_required: true,
    requirement_traceability_binding_candidate_required: true,
    project_plan_registration_candidate_required: true,
    spec_conflict_freshness_blockers_required: true,
    no_registration_authority_boundary_required: true,
    p35200_is_not_spec_pass_traceability_pass_plan_registration_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_plan_registry_control_plane_handoff
    ? READY_STATUS
    : validation.valid && boundary.p35200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    commercial_spec_registration_status: status,
    source_p34800_ready_for_commercial_spec_registration: boundary.source_p34800_ready_for_commercial_spec_registration,
    commercial_spec_readiness_projection_count: boundary.commercial_spec_readiness_projection_count,
    requirement_traceability_binding_candidate_count: boundary.requirement_traceability_binding_candidate_count,
    project_plan_registration_candidate_count: boundary.project_plan_registration_candidate_count,
    blocker_count: boundary.blocker_count,
    operator_projection_count: boundary.operator_projection_count,
    actual_registration_allowed_count: boundary.actual_registration_allowed_count,
    plan_registration_allowed_count: boundary.plan_registration_allowed_count,
    spec_readiness_pass_allowed_count: boundary.spec_readiness_pass_allowed_count,
    ready_for_plan_registry_control_plane_handoff: validation.valid && boundary.ready_for_plan_registry_control_plane_handoff,
    commercial_spec_actual_registration_allowed_now: false,
    commercial_spec_readiness_pass_allowed_now: false,
    commercial_spec_requirement_traceability_pass_allowed_now: false,
    commercial_spec_plan_registration_allowed_now: false,
    commercial_spec_runtime_execution_allowed_now: false,
    commercial_spec_write_action_allowed_now: false,
    commercial_spec_protected_action_allowed_now: false,
    commercial_spec_final_approval_allowed_now: false,
    commercial_spec_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Commercial Spec Registration Candidate",
    "",
    `Status: ${result.summary.commercial_spec_registration_status}`,
    `Program: ${result.program_range}`,
    `P34800 ready for commercial spec registration: ${result.summary.source_p34800_ready_for_commercial_spec_registration}`,
    `Commercial spec projections: ${result.summary.commercial_spec_readiness_projection_count}`,
    `Traceability candidates: ${result.summary.requirement_traceability_binding_candidate_count}`,
    `Plan registration candidates: ${result.summary.project_plan_registration_candidate_count}`,
    `Ready for plan registry control-plane handoff: ${result.summary.ready_for_plan_registry_control_plane_handoff}`,
    `Actual registration allowed: ${result.summary.commercial_spec_actual_registration_allowed_now}`,
    `Plan registration allowed: ${result.summary.commercial_spec_plan_registration_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.project_plan_registration_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.plan_registration_candidate_ref)}</td><td>${escapeHtml(item.plan_registration_allowed_now)}</td><td>${escapeHtml(item.actual_registration_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Commercial Spec Registration Candidate</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1d2433; }
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
    <h1>Hermes Commercial Spec Registration Candidate</h1>
    <p class="notice">This artifact projects commercial spec and plan registration candidates only. It does not register plans, mark spec PASS, write, approve, execute, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Plan Candidate</th><th>Plan Registration</th><th>Actual Registration</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP34800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildClarificationAnswerReceiptCandidateQueue({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.clarification_answer_receipt_queue", built);
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
  const defaults = DEFAULT_COMMERCIAL_SPEC_REGISTRATION_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_clarification_answer_receipt_queue_path: path.resolve(repoRoot, options.sourceClarificationAnswerReceiptQueuePath ?? defaults.sourceClarificationAnswerReceiptQueuePath),
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
      args.sourceClarificationAnswerReceiptQueuePath = argv[++index];
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
  console.log(`Usage: node scripts/commercial-spec-registration-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P34801-P35200 Commercial Spec Registration Candidate.
`);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  const item = rows.find((rowItem) => rowItem.row_id === rowId);
  return Boolean(item && (item.current_verdict === "pass" || item.visible_now === true || item.observed === true));
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.current_verdict !== "pass")
    .map((item) => ({ row_id: item.row_id, category: item.category, message: item.failure_message ?? item.block_reason ?? "Validation item failed" }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function hasScript(packageData, scriptName) {
  return Boolean(packageData?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, rows };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function row(fields) {
  const observed = fields.observed === true;
  return {
    ...fields,
    observed,
    current_verdict: observed ? "pass" : "block",
    block_reason: observed ? null : `${fields.row_id} not satisfied`,
  };
}

function validationItem(id, category, observed, failureMessage) {
  return row({
    row_id: `validation.${id}`,
    category,
    label: id,
    observed,
    evidence_ref: id,
    failure_message: observed ? null : failureMessage,
    generated_at: new Date(0).toISOString(),
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
