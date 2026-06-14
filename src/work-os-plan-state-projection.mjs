import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P35600_FALSE_FLAGS,
  buildPlanRegistryControlPlaneCandidate,
} from "./plan-registry-control-plane-candidate.mjs";

export const DEFAULT_WORK_OS_PLAN_STATE_PROJECTION_OUT_DIR = "artifacts/work-os-plan-state-projection/latest";
export const DEFAULT_WORK_OS_PLAN_STATE_PROJECTION_INPUTS = {
  schemaPath: "schemas/work-os-plan-state-projection.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p35601-p36000.md",
  architectureDocPath: "docs/architecture.md",
  sourcePlanRegistryControlPlaneCandidatePath: "artifacts/plan-registry-control-plane-candidate/latest/plan-registry-control-plane-candidate.json",
};

const COMMAND_NAME = "platform:work-os-plan-state-projection";
const SCHEMA_VERSION = "work-os-plan-state-projection.v1";
const CAPABILITY_ID = "platform.work_os_plan_state_projection";
const PROGRAM_RANGE = "P35601-P36000";
const SOURCE_PROGRAM_RANGE = "P35201-P35600";
const READY_STATUS = "ready_for_work_os_plan_state_projection";
const BLOCK_PENDING_STATUS = "valid_block_work_os_plan_state_projection_pending";
const BLOCKED_STATUS = "blocked_work_os_plan_state_projection";

const PHASE_SPECS = [
  ["P35601-P35640", "P35600 Source Binding", "p35600_source_binding_rows"],
  ["P35641-P35700", "Work OS Plan State Projection", "work_os_plan_state_projection_rows"],
  ["P35701-P35760", "Goal Phase Workflow Read Model", "goal_phase_workflow_read_model_rows"],
  ["P35761-P35820", "Plan State Stale Blocker Ledger", "plan_state_stale_blocker_ledger_rows"],
  ["P35821-P35880", "Operator UI API Handoff Projection", "operator_plan_state_handoff_rows"],
  ["P35881-P35940", "No State Mutation Boundary and Wiring", "no_state_mutation_boundary_rows"],
  ["P35941-P36000", "P36000 Clean Checkpoint", "p36000_clean_checkpoint_rows"],
];

export const WORK_OS_PLAN_STATE_FALSE_FLAGS = [
  "work_os_plan_state_record_write_allowed_now",
  "work_os_plan_state_mutation_allowed_now",
  "work_os_goal_status_update_allowed_now",
  "work_os_phase_status_update_allowed_now",
  "work_os_workflow_registration_allowed_now",
  "work_os_task_create_allowed_now",
  "work_os_blocker_clear_allowed_now",
  "work_os_stale_context_pass_allowed_now",
  "work_os_operator_register_button_allowed_now",
  "work_os_operator_status_edit_allowed_now",
  "work_os_api_write_allowed_now",
  "work_os_runtime_execution_allowed_now",
  "work_os_write_action_allowed_now",
  "work_os_protected_action_allowed_now",
  "work_os_connector_write_allowed_now",
  "work_os_deployment_allowed_now",
  "work_os_review_completion_allowed_now",
  "work_os_final_approval_allowed_now",
  "work_os_production_pass_allowed_now",
  "work_os_enterprise_trust_claim_allowed_now",
  "work_os_secret_read_allowed_now",
  "work_os_human_gate_bypass_allowed_now",
  "work_os_independent_review_bypass_allowed_now",
  "work_os_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_PLAN_STATE_FALSE_FLAGS, ...P35600_FALSE_FLAGS])];

export async function runWorkOsPlanStateProjection(options = {}) {
  const result = await buildWorkOsPlanStateProjection(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Plan State Projection failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsPlanStateProjection(result, result.output_dir);
  return result;
}

export async function buildWorkOsPlanStateProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_PLAN_STATE_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "planRegistryControlPlaneCandidate")
    ? normalizeInlineJsonSource("inline.plan_registry_control_plane_candidate", options.planRegistryControlPlaneCandidate)
    : await readJsonOrBuildP35600(inputs.source_plan_registry_control_plane_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const projectionRows = buildWorkOsPlanStateProjectionRows({ source, generatedAt });
  const readModelRows = buildGoalPhaseWorkflowReadModelRows({ projectionRows, source, generatedAt });
  const blockerRows = buildPlanStateStaleBlockerLedgerRows({ projectionRows, source, generatedAt });
  const handoffRows = buildOperatorPlanStateHandoffRows({ projectionRows, readModelRows, blockerRows, generatedAt });
  const boundaryRows = buildNoStateMutationBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, projectionRows, readModelRows, blockerRows, handoffRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, projectionRows, readModelRows, blockerRows, handoffRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, projectionRows, readModelRows, blockerRows, handoffRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      plan_registry_control_plane_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_plan_registry_control_plane_summary: source.data?.summary ?? null,
    work_os_plan_state_projection_contract: buildContract(generatedAt),
    work_os_plan_state_phase_rows: phaseRows,
    p35600_source_binding_rows: sourceRows,
    work_os_plan_state_projection_rows: projectionRows,
    goal_phase_workflow_read_model_rows: readModelRows,
    plan_state_stale_blocker_ledger_rows: blockerRows,
    operator_plan_state_handoff_rows: handoffRows,
    no_state_mutation_boundary_rows: boundaryRows,
    work_os_plan_state_wiring_rows: wiringRows,
    p36000_clean_checkpoint_rows: checkpointRows,
    work_os_plan_state_boundary: boundary,
    work_os_plan_state_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_plan_state_projection")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_plan_state_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_plan_state_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsPlanStateProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-plan-state-projection.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p35600-source-binding-rows.json"), collectionEnvelope("p35600-source-binding-rows.v1", "p35600_source_binding_rows", result.p35600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-plan-state-projection-rows.json"), collectionEnvelope("work-os-plan-state-projection-rows.v1", "work_os_plan_state_projection_rows", result.work_os_plan_state_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-phase-workflow-read-model-rows.json"), collectionEnvelope("goal-phase-workflow-read-model-rows.v1", "goal_phase_workflow_read_model_rows", result.goal_phase_workflow_read_model_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-state-stale-blocker-ledger-rows.json"), collectionEnvelope("plan-state-stale-blocker-ledger-rows.v1", "plan_state_stale_blocker_ledger_rows", result.plan_state_stale_blocker_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-plan-state-handoff-rows.json"), collectionEnvelope("operator-plan-state-handoff-rows.v1", "operator_plan_state_handoff_rows", result.operator_plan_state_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-state-mutation-boundary-rows.json"), collectionEnvelope("no-state-mutation-boundary-rows.v1", "no_state_mutation_boundary_rows", result.no_state_mutation_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-plan-state-wiring-rows.json"), collectionEnvelope("work-os-plan-state-wiring-rows.v1", "work_os_plan_state_wiring_rows", result.work_os_plan_state_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p36000-clean-checkpoint-rows.json"), collectionEnvelope("p36000-clean-checkpoint-rows.v1", "p36000_clean_checkpoint_rows", result.p36000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-plan-state-boundary.json"), result.work_os_plan_state_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsPlanStateProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsPlanStateProjection(args);
  console.log(`Work OS Plan State Projection ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_plan_state_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P35600 ready for Work OS state: ${result.summary.source_p35600_ready_for_work_os_state}`);
  console.log(`Plan state projections: ${result.summary.work_os_plan_state_projection_count}`);
  console.log(`Goal/phase/workflow read models: ${result.summary.goal_phase_workflow_read_model_count}`);
  console.log(`Stale/blocker rows: ${result.summary.plan_state_stale_blocker_count}`);
  console.log(`Ready for operator plan state handoff: ${result.summary.ready_for_work_os_operator_plan_state_handoff}`);
  console.log(`Plan state mutation allowed: ${result.summary.work_os_plan_state_mutation_allowed_now}`);
  console.log(`API write allowed: ${result.summary.work_os_api_write_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.plan_registry_control_plane_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_plan_state_handoff === true,
    status: summary.plan_registry_control_plane_status ?? "missing",
    p35600ContractReady: boundary.p35600_contract_ready === true,
    registryVisible: boundary.plan_registry_control_plane_candidate_visible_now === true,
    manifestVisible: boundary.goal_phase_manifest_binding_candidate_visible_now === true,
    workflowVisible: boundary.project_workflow_registration_candidate_visible_now === true,
    blockersVisible: boundary.registry_blocker_ledger_visible_now === true,
    operatorVisible: boundary.operator_plan_registry_projection_visible_now === true,
    noMutationClosed: boundary.no_registry_mutation_boundary_closed_now === true,
    boundaryClosed: P35600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p35601-p36000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P35600 plan registry control-plane source is available", sourceState.available],
    ["program_range", "P35600 source program range is P35201-P35600", sourceState.programRangeOk],
    ["validation_valid", "P35600 source validation is valid", sourceState.validationValid],
    ["work_os_plan_state_handoff_open", "P35600 opened Work OS plan state handoff", sourceState.sourceReady],
    ["p35600_contract_ready", "P35600 source contract is ready", sourceState.p35600ContractReady],
    ["registry_candidate_visible", "P35600 registry candidates are visible", sourceState.registryVisible],
    ["manifest_binding_visible", "P35600 manifest binding candidates are visible", sourceState.manifestVisible],
    ["workflow_candidate_visible", "P35600 workflow candidates are visible", sourceState.workflowVisible],
    ["registry_blockers_visible", "P35600 registry blockers are visible", sourceState.blockersVisible],
    ["operator_projection_visible", "P35600 operator projections are visible", sourceState.operatorVisible],
    ["no_mutation_closed", "P35600 no-registry-mutation boundary is closed", sourceState.noMutationClosed],
    ["commit_ref_present", "Current commit ref is present for Work OS plan state projection", Boolean(commitRef)],
    ["source_blocker_visible", "P35600 source blocker is visible when Work OS plan state projection is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p35600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildWorkOsPlanStateProjectionRows({ source, generatedAt }) {
  const workflowRows = source.data?.project_workflow_registration_candidate_rows ?? [];
  const blockerRows = source.data?.registry_blocker_ledger_rows ?? [];
  return workflowRows.map((workflow) => {
    const blockers = blockerRows.filter((item) => item.request_id === workflow.request_id);
    return row({
      row_id: `work_os_plan_state_projection.${workflow.request_id}`,
      category: "work_os_plan_state_projection",
      label: `Work OS plan state projection for ${workflow.request_id}`,
      observed: Boolean(workflow.request_id && workflow.workflow_candidate_visible_now === true),
      evidence_ref: workflow.row_id,
      request_id: workflow.request_id,
      plan_state_projection_ref: `work_os_plan_state.${workflow.request_id}.projection`,
      workflow_registration_candidate_ref: workflow.workflow_registration_candidate_ref,
      registry_candidate_ref: workflow.registry_candidate_ref,
      goal_manifest_ref: workflow.goal_manifest_ref,
      phase_manifest_ref: workflow.phase_manifest_ref,
      source_blocker_refs: blockers.map((item) => item.row_id),
      current_plan_state: "blocked_waiting_for_plan_registry_evidence",
      read_model_visible_now: true,
      plan_state_record_write_allowed_now: false,
      plan_state_mutation_allowed_now: false,
      runtime_execution_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildGoalPhaseWorkflowReadModelRows({ projectionRows, source, generatedAt }) {
  const registryRows = source.data?.plan_registry_control_plane_candidate_rows ?? [];
  return projectionRows.map((projection) => {
    const registry = registryRows.find((item) => item.request_id === projection.request_id);
    return row({
      row_id: `goal_phase_workflow_read_model.${projection.request_id}`,
      category: "goal_phase_workflow_read_model",
      label: `Goal/phase/workflow read model for ${projection.request_id}`,
      observed: Boolean(registry && projection.plan_state_projection_ref),
      evidence_ref: projection.row_id,
      request_id: projection.request_id,
      goal_id_candidate: `goal.${projection.request_id}.candidate`,
      phase_id_candidate: `phase.${projection.request_id}.candidate`,
      workflow_id_candidate: `workflow.${projection.request_id}.candidate`,
      registry_candidate_ref: projection.registry_candidate_ref,
      plan_state_projection_ref: projection.plan_state_projection_ref,
      read_model_visible_now: true,
      goal_status_update_allowed_now: false,
      phase_status_update_allowed_now: false,
      workflow_registration_allowed_now: false,
      task_create_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildPlanStateStaleBlockerLedgerRows({ projectionRows, source, generatedAt }) {
  const sourceBlockers = source.data?.registry_blocker_ledger_rows ?? [];
  return projectionRows.flatMap((projection) => {
    const related = sourceBlockers.filter((item) => item.request_id === projection.request_id);
    return [
      ["source_candidate_only", "Plan state is candidate-only and not registered", projection.row_id],
      ["owner_assignment_missing", "Owner assignment receipt is still missing", related.find((item) => item.blocker_type === "owner_assignment_missing")?.row_id ?? projection.row_id],
      ["review_receipt_missing", "Review receipt is still missing", related.find((item) => item.blocker_type === "review_receipt_missing")?.row_id ?? projection.row_id],
      ["freshness_receipt_missing", "Freshness/stale-context receipt is still missing", related.find((item) => item.blocker_type === "freshness_receipt_missing")?.row_id ?? projection.row_id],
    ].map(([id, label, evidenceRef]) => row({
      row_id: `plan_state_stale_blocker_ledger.${projection.request_id}.${id}`,
      category: "plan_state_stale_blocker_ledger",
      label: `${label} for ${projection.request_id}`,
      observed: Boolean(evidenceRef),
      evidence_ref: evidenceRef,
      request_id: projection.request_id,
      blocker_type: id,
      blocker_visible_now: true,
      blocker_clear_allowed_now: false,
      stale_context_pass_allowed_now: false,
      status_pass_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildOperatorPlanStateHandoffRows({ projectionRows, readModelRows, blockerRows, generatedAt }) {
  return projectionRows.map((projection) => {
    const readModel = readModelRows.find((item) => item.request_id === projection.request_id);
    const blockers = blockerRows.filter((item) => item.request_id === projection.request_id);
    return row({
      row_id: `operator_plan_state_handoff.${projection.request_id}`,
      category: "operator_plan_state_handoff",
      label: `Operator plan state handoff for ${projection.request_id}`,
      observed: Boolean(readModel && blockers.length >= 4),
      evidence_ref: readModel?.row_id ?? projection.row_id,
      request_id: projection.request_id,
      read_api_candidate_ref: `/api/work-os/plan-state/${projection.request_id}`,
      ui_slot_candidate_ref: `work-os.plan-state.${projection.request_id}`,
      operator_status: "blocked_read_only_projection_ready",
      next_action: "collect_owner_review_freshness_and_traceability_receipts_before_registry_write",
      blocker_count: blockers.length,
      api_read_visible_now: true,
      api_write_allowed_now: false,
      register_button_enabled_now: false,
      status_edit_enabled_now: false,
      execute_button_enabled_now: false,
      production_pass_enabled_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoStateMutationBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.projection_is_not_registry_record", "Work OS plan state projection must not create registry records", true],
    ["state.read_model_is_not_status_update", "Goal/phase/workflow read model must not update status", true],
    ["state.blocker_ledger_is_not_clearance", "Blocker ledger visibility must not clear blockers", true],
    ["state.operator_handoff_is_not_write_api", "Operator handoff must not enable write API or UI actions", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_state_mutation_boundary.${id}`,
    category: "no_state_mutation_boundary",
    label,
    observed,
    evidence_ref: "work_os_plan_state_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_state_mutation_boundary.${flag}`,
    category: "no_state_mutation_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_plan_state_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P36000 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-plan-state-projection.schema.json"],
    ["roadmap_doc", "Roadmap documents all P35601-P36000 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p35601-p36000.md"],
    ["architecture_doc", "Architecture doc references P35601-P36000", architectureDoc.text.includes("P35601-P36000 Work OS Plan State Projection"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_plan_state_wiring.${id}`,
    category: "work_os_plan_state_wiring",
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
    && allPass(context.projectionRows)
    && allPass(context.readModelRows)
    && allPass(context.blockerRows)
    && allPass(context.handoffRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P35600 source is ready for Work OS plan state handoff", context.sourceState.sourceReady],
    ["projection_visible", "Work OS plan state projections are visible", allPass(context.projectionRows)],
    ["read_model_visible", "Goal/phase/workflow read models are visible", allPass(context.readModelRows)],
    ["stale_blockers_visible", "Plan state stale/blocker ledger rows are visible", allPass(context.blockerRows)],
    ["operator_handoff_visible", "Operator plan state handoff rows are visible", allPass(context.handoffRows)],
    ["no_state_mutation_boundary_closed", "No-state-mutation boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["api_write_blocked", "Operator/API write path stays blocked", true],
    ["status_update_blocked", "Goal/phase/workflow status updates stay blocked", true],
    ["operator_plan_state_handoff", "Operator plan state handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p36000_checkpoint.${id}`,
    category: "p36000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p36000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p36000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.projectionRows)
    && allPass(context.readModelRows)
    && allPass(context.blockerRows)
    && allPass(context.handoffRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p36000_checkpoint.api_write_blocked")
    && visibleOrPassed(context.checkpointRows, "p36000_checkpoint.status_update_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p36000ContractReady;
  return {
    p36000_contract_ready: p36000ContractReady,
    ready_for_work_os_operator_plan_state_handoff: ready,
    source_p35600_ready_for_work_os_state: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    work_os_plan_state_projection_visible_now: allPass(context.projectionRows),
    goal_phase_workflow_read_model_visible_now: allPass(context.readModelRows),
    plan_state_stale_blocker_ledger_visible_now: allPass(context.blockerRows),
    operator_plan_state_handoff_visible_now: allPass(context.handoffRows),
    no_state_mutation_boundary_closed_now: allPass(context.boundaryRows),
    work_os_plan_state_wiring_complete_now: allPass(context.wiringRows),
    work_os_plan_state_projection_count: context.projectionRows.length,
    goal_phase_workflow_read_model_count: context.readModelRows.length,
    plan_state_stale_blocker_count: context.blockerRows.length,
    operator_plan_state_handoff_count: context.handoffRows.length,
    plan_state_mutation_allowed_count: context.projectionRows.filter((item) => item.plan_state_mutation_allowed_now === true).length,
    api_write_allowed_count: context.handoffRows.filter((item) => item.api_write_allowed_now === true).length,
    status_update_allowed_count: context.readModelRows.filter((item) => item.goal_status_update_allowed_now === true || item.phase_status_update_allowed_now === true).length,
    blocker_clear_allowed_count: context.blockerRows.filter((item) => item.blocker_clear_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P35601-P36000 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P35600 source state is not visible"),
    validationItem("projection.visible", "work_os_plan_state", allPass(context.projectionRows), "Work OS plan state projections are incomplete"),
    validationItem("read_model.visible", "work_os_plan_state", allPass(context.readModelRows), "Goal/phase/workflow read models are incomplete"),
    validationItem("blockers.visible", "work_os_plan_state", allPass(context.blockerRows), "Plan state stale/blocker ledger is incomplete"),
    validationItem("operator.visible", "operator", allPass(context.handoffRows), "Operator plan state handoff rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P35601-P36000 wiring is incomplete"),
    validationItem("no.plan.state.mutation", "authority", context.projectionRows.every((item) => item.plan_state_record_write_allowed_now === false && item.plan_state_mutation_allowed_now === false), "Plan state mutation opened"),
    validationItem("no.status.update", "authority", context.readModelRows.every((item) => item.goal_status_update_allowed_now === false && item.phase_status_update_allowed_now === false), "Goal/phase status update opened"),
    validationItem("no.workflow.registration", "authority", context.readModelRows.every((item) => item.workflow_registration_allowed_now === false && item.task_create_allowed_now === false), "Workflow registration or task creation opened"),
    validationItem("no.blocker.clear", "authority", context.blockerRows.every((item) => item.blocker_clear_allowed_now === false && item.stale_context_pass_allowed_now === false), "Blocker clear or stale-context PASS opened"),
    validationItem("no.operator.write", "authority", context.handoffRows.every((item) => item.api_write_allowed_now === false && item.register_button_enabled_now === false && item.status_edit_enabled_now === false && item.execute_button_enabled_now === false), "Operator write/action surface opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.api_write_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p36000_checkpoint.api_write_blocked"), "P36000 API write blocker checkpoint is not visible"),
    validationItem("checkpoint.status_update_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p36000_checkpoint.status_update_blocked"), "P36000 status update blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_plan_state_projection.contract.v1",
    generated_at: generatedAt,
    source_p35600_required_or_rebuilt: true,
    work_os_plan_state_projection_required: true,
    goal_phase_workflow_read_model_required: true,
    stale_blocker_ledger_required: true,
    operator_read_only_handoff_required: true,
    no_state_mutation_boundary_required: true,
    p36000_is_not_registry_write_status_update_task_create_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_operator_plan_state_handoff
    ? READY_STATUS
    : validation.valid && boundary.p36000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_plan_state_status: status,
    source_p35600_ready_for_work_os_state: boundary.source_p35600_ready_for_work_os_state,
    work_os_plan_state_projection_count: boundary.work_os_plan_state_projection_count,
    goal_phase_workflow_read_model_count: boundary.goal_phase_workflow_read_model_count,
    plan_state_stale_blocker_count: boundary.plan_state_stale_blocker_count,
    operator_plan_state_handoff_count: boundary.operator_plan_state_handoff_count,
    plan_state_mutation_allowed_count: boundary.plan_state_mutation_allowed_count,
    api_write_allowed_count: boundary.api_write_allowed_count,
    status_update_allowed_count: boundary.status_update_allowed_count,
    blocker_clear_allowed_count: boundary.blocker_clear_allowed_count,
    ready_for_work_os_operator_plan_state_handoff: validation.valid && boundary.ready_for_work_os_operator_plan_state_handoff,
    work_os_plan_state_record_write_allowed_now: false,
    work_os_plan_state_mutation_allowed_now: false,
    work_os_goal_status_update_allowed_now: false,
    work_os_phase_status_update_allowed_now: false,
    work_os_workflow_registration_allowed_now: false,
    work_os_task_create_allowed_now: false,
    work_os_blocker_clear_allowed_now: false,
    work_os_api_write_allowed_now: false,
    work_os_runtime_execution_allowed_now: false,
    work_os_write_action_allowed_now: false,
    work_os_protected_action_allowed_now: false,
    work_os_final_approval_allowed_now: false,
    work_os_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Plan State Projection",
    "",
    `Status: ${result.summary.work_os_plan_state_status}`,
    `Program: ${result.program_range}`,
    `P35600 ready for Work OS state: ${result.summary.source_p35600_ready_for_work_os_state}`,
    `Plan state projections: ${result.summary.work_os_plan_state_projection_count}`,
    `Goal/phase/workflow read models: ${result.summary.goal_phase_workflow_read_model_count}`,
    `Stale/blocker rows: ${result.summary.plan_state_stale_blocker_count}`,
    `Ready for operator plan state handoff: ${result.summary.ready_for_work_os_operator_plan_state_handoff}`,
    `Plan state mutation allowed: ${result.summary.work_os_plan_state_mutation_allowed_now}`,
    `API write allowed: ${result.summary.work_os_api_write_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_plan_state_handoff_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.operator_status)}</td><td>${escapeHtml(item.api_read_visible_now)}</td><td>${escapeHtml(item.api_write_allowed_now)}</td><td>${escapeHtml(item.status_edit_enabled_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Plan State Projection</title>
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
    <h1>Hermes Work OS Plan State Projection</h1>
    <p class="notice">This artifact projects candidate plan state for read-only Work OS consumption. It does not write registry records, update goal or phase status, clear blockers, execute, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Status</th><th>Read API</th><th>Write API</th><th>Status Edit</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP35600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildPlanRegistryControlPlaneCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.plan_registry_control_plane_candidate", built);
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
  const defaults = DEFAULT_WORK_OS_PLAN_STATE_PROJECTION_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_plan_registry_control_plane_candidate_path: path.resolve(repoRoot, options.sourcePlanRegistryControlPlaneCandidatePath ?? defaults.sourcePlanRegistryControlPlaneCandidatePath),
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
      args.sourcePlanRegistryControlPlaneCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-plan-state-projection.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P35601-P36000 Work OS Plan State Projection.
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
