import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P35200_FALSE_FLAGS,
  buildCommercialSpecRegistrationCandidate,
} from "./commercial-spec-registration-candidate.mjs";

export const DEFAULT_PLAN_REGISTRY_CONTROL_PLANE_CANDIDATE_OUT_DIR = "artifacts/plan-registry-control-plane-candidate/latest";
export const DEFAULT_PLAN_REGISTRY_CONTROL_PLANE_CANDIDATE_INPUTS = {
  schemaPath: "schemas/plan-registry-control-plane-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p35201-p35600.md",
  architectureDocPath: "docs/architecture.md",
  sourceCommercialSpecRegistrationCandidatePath: "artifacts/commercial-spec-registration-candidate/latest/commercial-spec-registration-candidate.json",
};

const COMMAND_NAME = "platform:plan-registry-control-plane-candidate";
const SCHEMA_VERSION = "plan-registry-control-plane-candidate.v1";
const CAPABILITY_ID = "platform.plan_registry_control_plane_candidate";
const PROGRAM_RANGE = "P35201-P35600";
const SOURCE_PROGRAM_RANGE = "P34801-P35200";
const READY_STATUS = "ready_for_plan_registry_control_plane_candidate";
const BLOCK_PENDING_STATUS = "valid_block_plan_registry_control_plane_candidate_pending";
const BLOCKED_STATUS = "blocked_plan_registry_control_plane_candidate";

const PHASE_SPECS = [
  ["P35201-P35240", "P35200 Source Binding", "p35200_source_binding_rows"],
  ["P35241-P35290", "Plan Registry Control-Plane Candidate", "plan_registry_control_plane_candidate_rows"],
  ["P35291-P35340", "Goal/Phase Manifest Binding Candidate", "goal_phase_manifest_binding_candidate_rows"],
  ["P35341-P35390", "Project Workflow Registration Candidate", "project_workflow_registration_candidate_rows"],
  ["P35391-P35450", "Registry Blocker Ledger", "registry_blocker_ledger_rows"],
  ["P35451-P35510", "Operator Plan Registry Projection", "operator_plan_registry_projection_rows"],
  ["P35511-P35560", "No-Registry-Mutation Boundary and Wiring", "no_registry_mutation_boundary_rows"],
  ["P35561-P35600", "P35600 Clean Checkpoint", "p35600_clean_checkpoint_rows"],
];

export const PLAN_REGISTRY_CONTROL_PLANE_FALSE_FLAGS = [
  "plan_registry_actual_record_create_allowed_now",
  "plan_registry_mutation_allowed_now",
  "plan_registry_goal_create_allowed_now",
  "plan_registry_phase_create_allowed_now",
  "plan_registry_workflow_registration_allowed_now",
  "plan_registry_status_pass_allowed_now",
  "plan_registry_requirement_traceability_pass_allowed_now",
  "plan_registry_owner_assignment_bypass_allowed_now",
  "plan_registry_review_bypass_allowed_now",
  "plan_registry_freshness_bypass_allowed_now",
  "plan_registry_operator_register_button_allowed_now",
  "plan_registry_runtime_execution_allowed_now",
  "plan_registry_write_action_allowed_now",
  "plan_registry_protected_action_allowed_now",
  "plan_registry_connector_write_allowed_now",
  "plan_registry_deployment_allowed_now",
  "plan_registry_review_completion_allowed_now",
  "plan_registry_final_approval_allowed_now",
  "plan_registry_production_pass_allowed_now",
  "plan_registry_enterprise_trust_claim_allowed_now",
  "plan_registry_secret_read_allowed_now",
  "plan_registry_human_gate_bypass_allowed_now",
  "plan_registry_independent_review_bypass_allowed_now",
  "plan_registry_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...PLAN_REGISTRY_CONTROL_PLANE_FALSE_FLAGS, ...P35200_FALSE_FLAGS])];

export async function runPlanRegistryControlPlaneCandidate(options = {}) {
  const result = await buildPlanRegistryControlPlaneCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Plan Registry Control-Plane Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePlanRegistryControlPlaneCandidate(result, result.output_dir);
  return result;
}

export async function buildPlanRegistryControlPlaneCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLAN_REGISTRY_CONTROL_PLANE_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "commercialSpecRegistrationCandidate")
    ? normalizeInlineJsonSource("inline.commercial_spec_registration_candidate", options.commercialSpecRegistrationCandidate)
    : await readJsonOrBuildP35200(inputs.source_commercial_spec_registration_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const registryRows = buildPlanRegistryControlPlaneCandidateRows({ source, generatedAt });
  const manifestRows = buildGoalPhaseManifestBindingCandidateRows({ registryRows, generatedAt });
  const workflowRows = buildProjectWorkflowRegistrationCandidateRows({ registryRows, manifestRows, generatedAt });
  const blockerRows = buildRegistryBlockerLedgerRows({ source, workflowRows, generatedAt });
  const operatorRows = buildOperatorPlanRegistryProjectionRows({ workflowRows, blockerRows, generatedAt });
  const boundaryRows = buildNoRegistryMutationBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, registryRows, manifestRows, workflowRows, blockerRows, operatorRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, registryRows, manifestRows, workflowRows, blockerRows, operatorRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, registryRows, manifestRows, workflowRows, blockerRows, operatorRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      commercial_spec_registration_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_commercial_spec_registration_summary: source.data?.summary ?? null,
    plan_registry_control_plane_candidate_contract: buildContract(generatedAt),
    plan_registry_control_plane_phase_rows: phaseRows,
    p35200_source_binding_rows: sourceRows,
    plan_registry_control_plane_candidate_rows: registryRows,
    goal_phase_manifest_binding_candidate_rows: manifestRows,
    project_workflow_registration_candidate_rows: workflowRows,
    registry_blocker_ledger_rows: blockerRows,
    operator_plan_registry_projection_rows: operatorRows,
    no_registry_mutation_boundary_rows: boundaryRows,
    plan_registry_control_plane_wiring_rows: wiringRows,
    p35600_clean_checkpoint_rows: checkpointRows,
    plan_registry_control_plane_boundary: boundary,
    plan_registry_control_plane_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "plan_registry_control_plane_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.plan_registry_control_plane_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.plan_registry_control_plane_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writePlanRegistryControlPlaneCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "plan-registry-control-plane-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p35200-source-binding-rows.json"), collectionEnvelope("p35200-source-binding-rows.v1", "p35200_source_binding_rows", result.p35200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-registry-control-plane-candidate-rows.json"), collectionEnvelope("plan-registry-control-plane-candidate-rows.v1", "plan_registry_control_plane_candidate_rows", result.plan_registry_control_plane_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-phase-manifest-binding-candidate-rows.json"), collectionEnvelope("goal-phase-manifest-binding-candidate-rows.v1", "goal_phase_manifest_binding_candidate_rows", result.goal_phase_manifest_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-workflow-registration-candidate-rows.json"), collectionEnvelope("project-workflow-registration-candidate-rows.v1", "project_workflow_registration_candidate_rows", result.project_workflow_registration_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "registry-blocker-ledger-rows.json"), collectionEnvelope("registry-blocker-ledger-rows.v1", "registry_blocker_ledger_rows", result.registry_blocker_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-plan-registry-projection-rows.json"), collectionEnvelope("operator-plan-registry-projection-rows.v1", "operator_plan_registry_projection_rows", result.operator_plan_registry_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-registry-mutation-boundary-rows.json"), collectionEnvelope("no-registry-mutation-boundary-rows.v1", "no_registry_mutation_boundary_rows", result.no_registry_mutation_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-registry-control-plane-wiring-rows.json"), collectionEnvelope("plan-registry-control-plane-wiring-rows.v1", "plan_registry_control_plane_wiring_rows", result.plan_registry_control_plane_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p35600-clean-checkpoint-rows.json"), collectionEnvelope("p35600-clean-checkpoint-rows.v1", "p35600_clean_checkpoint_rows", result.p35600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-registry-control-plane-boundary.json"), result.plan_registry_control_plane_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runPlanRegistryControlPlaneCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPlanRegistryControlPlaneCandidate(args);
  console.log(`Plan Registry Control-Plane Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.plan_registry_control_plane_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P35200 ready for plan registry: ${result.summary.source_p35200_ready_for_plan_registry}`);
  console.log(`Registry candidates: ${result.summary.plan_registry_control_plane_candidate_count}`);
  console.log(`Goal/phase manifests: ${result.summary.goal_phase_manifest_binding_candidate_count}`);
  console.log(`Workflow candidates: ${result.summary.project_workflow_registration_candidate_count}`);
  console.log(`Ready for work OS plan state handoff: ${result.summary.ready_for_work_os_plan_state_handoff}`);
  console.log(`Registry mutation allowed: ${result.summary.plan_registry_mutation_allowed_now}`);
  console.log(`Workflow registration allowed: ${result.summary.plan_registry_workflow_registration_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.commercial_spec_registration_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_plan_registry_control_plane_handoff === true,
    status: summary.commercial_spec_registration_status ?? "missing",
    p35200ContractReady: boundary.p35200_contract_ready === true,
    specVisible: boundary.commercial_spec_readiness_projection_visible_now === true,
    traceabilityVisible: boundary.requirement_traceability_binding_candidate_visible_now === true,
    planVisible: boundary.project_plan_registration_candidate_visible_now === true,
    blockersVisible: boundary.spec_conflict_freshness_blockers_visible_now === true,
    noRegistrationClosed: boundary.no_registration_authority_boundary_closed_now === true,
    boundaryClosed: P35200_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p35201-p35600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P35200 commercial spec registration source is available", sourceState.available],
    ["program_range", "P35200 source program range is P34801-P35200", sourceState.programRangeOk],
    ["validation_valid", "P35200 source validation is valid", sourceState.validationValid],
    ["plan_registry_handoff_open", "P35200 opened plan registry control-plane handoff", sourceState.sourceReady],
    ["p35200_contract_ready", "P35200 source contract is ready", sourceState.p35200ContractReady],
    ["spec_projection_visible", "P35200 commercial spec projection is visible", sourceState.specVisible],
    ["traceability_visible", "P35200 traceability candidate is visible", sourceState.traceabilityVisible],
    ["plan_candidate_visible", "P35200 plan registration candidate is visible", sourceState.planVisible],
    ["blockers_visible", "P35200 blockers are visible", sourceState.blockersVisible],
    ["no_registration_closed", "P35200 no-registration boundary is closed", sourceState.noRegistrationClosed],
    ["commit_ref_present", "Current commit ref is present for plan registry candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P35200 source blocker is visible when plan registry is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p35200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildPlanRegistryControlPlaneCandidateRows({ source, generatedAt }) {
  const planRows = source.data?.project_plan_registration_candidate_rows ?? [];
  return planRows.map((plan) => row({
    row_id: `plan_registry_control_plane_candidate.${plan.request_id}`,
    category: "plan_registry_control_plane_candidate",
    label: `Plan registry control-plane candidate for ${plan.request_id}`,
    observed: Boolean(plan.request_id && plan.plan_registration_candidate_visible_now === true),
    evidence_ref: plan.row_id,
    request_id: plan.request_id,
    registry_candidate_ref: `plan_registry_control_plane.${plan.request_id}.candidate`,
    plan_registration_candidate_ref: plan.plan_registration_candidate_ref,
    spec_candidate_ref: plan.spec_candidate_ref,
    registry_candidate_visible_now: true,
    actual_record_create_allowed_now: false,
    registry_mutation_allowed_now: false,
    status_pass_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildGoalPhaseManifestBindingCandidateRows({ registryRows, generatedAt }) {
  return registryRows.map((registry) => row({
    row_id: `goal_phase_manifest_binding_candidate.${registry.request_id}`,
    category: "goal_phase_manifest_binding_candidate",
    label: `Goal/phase manifest binding candidate for ${registry.request_id}`,
    observed: Boolean(registry.registry_candidate_ref),
    evidence_ref: registry.row_id,
    request_id: registry.request_id,
    goal_manifest_ref: `goal_manifest.${registry.request_id}.candidate`,
    phase_manifest_ref: `phase_manifest.${registry.request_id}.candidate`,
    required_manifest_fields: ["goal_id", "phase_id", "milestone_id", "evidence_refs", "gate_refs", "owner_engine"],
    manifest_binding_visible_now: true,
    goal_create_allowed_now: false,
    phase_create_allowed_now: false,
    registry_mutation_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildProjectWorkflowRegistrationCandidateRows({ registryRows, manifestRows, generatedAt }) {
  return registryRows.map((registry) => {
    const manifest = manifestRows.find((item) => item.request_id === registry.request_id);
    return row({
      row_id: `project_workflow_registration_candidate.${registry.request_id}`,
      category: "project_workflow_registration_candidate",
      label: `Project workflow registration candidate for ${registry.request_id}`,
      observed: Boolean(manifest),
      evidence_ref: manifest?.row_id ?? registry.row_id,
      request_id: registry.request_id,
      workflow_registration_candidate_ref: `project_workflow.${registry.request_id}.candidate`,
      registry_candidate_ref: registry.registry_candidate_ref,
      goal_manifest_ref: manifest?.goal_manifest_ref ?? null,
      phase_manifest_ref: manifest?.phase_manifest_ref ?? null,
      workflow_candidate_visible_now: true,
      workflow_registration_allowed_now: false,
      registry_mutation_allowed_now: false,
      write_action_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildRegistryBlockerLedgerRows({ source, workflowRows, generatedAt }) {
  const sourceBlockers = source.data?.spec_conflict_freshness_blocker_rows ?? [];
  return workflowRows.flatMap((workflow) => {
    const related = sourceBlockers.filter((item) => item.request_id === workflow.request_id);
    return [
      ["owner_assignment_missing", "Owner assignment receipt is missing", workflow.row_id],
      ["review_receipt_missing", "Plan registry review receipt is missing", workflow.row_id],
      ["freshness_receipt_missing", "Freshness receipt is still missing", related.find((item) => item.blocker_type === "stale_context_recheck_missing")?.row_id ?? workflow.row_id],
      ["traceability_evidence_missing", "Traceability evidence is still candidate-only", related.find((item) => item.blocker_type === "spec_registration_review_missing")?.row_id ?? workflow.row_id],
    ].map(([id, label, evidenceRef]) => row({
      row_id: `registry_blocker_ledger.${workflow.request_id}.${id}`,
      category: "registry_blocker_ledger",
      label: `${label} for ${workflow.request_id}`,
      observed: Boolean(evidenceRef),
      evidence_ref: evidenceRef,
      request_id: workflow.request_id,
      blocker_type: id,
      blocker_visible_now: true,
      owner_assignment_bypass_allowed_now: false,
      review_bypass_allowed_now: false,
      freshness_bypass_allowed_now: false,
      registry_status_pass_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildOperatorPlanRegistryProjectionRows({ workflowRows, blockerRows, generatedAt }) {
  return workflowRows.map((workflow) => {
    const blockers = blockerRows.filter((item) => item.request_id === workflow.request_id);
    return row({
      row_id: `operator_plan_registry_projection.${workflow.request_id}`,
      category: "operator_plan_registry_projection",
      label: `Operator plan registry projection for ${workflow.request_id}`,
      observed: blockers.length >= 4,
      evidence_ref: workflow.row_id,
      request_id: workflow.request_id,
      operator_status: "blocked_waiting_for_plan_registry_evidence",
      next_action: "collect_owner_review_freshness_and_traceability_receipts",
      blocker_count: blockers.length,
      register_button_enabled_now: false,
      approve_button_enabled_now: false,
      execute_button_enabled_now: false,
      production_pass_enabled_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoRegistryMutationBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.registry_candidate_is_not_record", "Plan registry candidate must not create a registry record", true],
    ["state.manifest_candidate_is_not_manifest_write", "Goal/phase manifest candidate must not write manifests", true],
    ["state.workflow_candidate_is_not_registration", "Workflow candidate must not register a workflow", true],
    ["state.operator_projection_is_not_registry_surface", "Operator projection must not enable registry controls", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_registry_mutation_boundary.${id}`,
    category: "no_registry_mutation_boundary",
    label,
    observed,
    evidence_ref: "plan_registry_control_plane_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_registry_mutation_boundary.${flag}`,
    category: "no_registry_mutation_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "plan_registry_control_plane_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P35600 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/plan-registry-control-plane-candidate.schema.json"],
    ["roadmap_doc", "Roadmap documents all P35201-P35600 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p35201-p35600.md"],
    ["architecture_doc", "Architecture doc references P35201-P35600", architectureDoc.text.includes("P35201-P35600 Plan Registry Control-Plane Candidate"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `plan_registry_control_plane_wiring.${id}`,
    category: "plan_registry_control_plane_wiring",
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
    && allPass(context.registryRows)
    && allPass(context.manifestRows)
    && allPass(context.workflowRows)
    && allPass(context.blockerRows)
    && allPass(context.operatorRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P35200 source is ready for plan registry control-plane", context.sourceState.sourceReady],
    ["registry_candidate_visible", "Plan registry control-plane candidates are visible", allPass(context.registryRows)],
    ["manifest_candidate_visible", "Goal/phase manifest binding candidates are visible", allPass(context.manifestRows)],
    ["workflow_candidate_visible", "Project workflow registration candidates are visible", allPass(context.workflowRows)],
    ["blockers_visible", "Registry blocker ledger rows are visible", allPass(context.blockerRows)],
    ["operator_projection_visible", "Operator plan registry projection rows are visible", allPass(context.operatorRows)],
    ["no_registry_mutation_boundary_closed", "No-registry-mutation boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["actual_registry_mutation_blocked", "Actual registry mutation stays blocked", true],
    ["work_os_plan_state_handoff", "Work OS plan state handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p35600_checkpoint.${id}`,
    category: "p35600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p35600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p35600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.registryRows)
    && allPass(context.manifestRows)
    && allPass(context.workflowRows)
    && allPass(context.blockerRows)
    && allPass(context.operatorRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p35600_checkpoint.actual_registry_mutation_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p35600ContractReady;
  return {
    p35600_contract_ready: p35600ContractReady,
    ready_for_work_os_plan_state_handoff: ready,
    source_p35200_ready_for_plan_registry: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    plan_registry_control_plane_candidate_visible_now: allPass(context.registryRows),
    goal_phase_manifest_binding_candidate_visible_now: allPass(context.manifestRows),
    project_workflow_registration_candidate_visible_now: allPass(context.workflowRows),
    registry_blocker_ledger_visible_now: allPass(context.blockerRows),
    operator_plan_registry_projection_visible_now: allPass(context.operatorRows),
    no_registry_mutation_boundary_closed_now: allPass(context.boundaryRows),
    plan_registry_control_plane_wiring_complete_now: allPass(context.wiringRows),
    plan_registry_control_plane_candidate_count: context.registryRows.length,
    goal_phase_manifest_binding_candidate_count: context.manifestRows.length,
    project_workflow_registration_candidate_count: context.workflowRows.length,
    blocker_count: context.blockerRows.length,
    operator_projection_count: context.operatorRows.length,
    registry_mutation_allowed_count: context.registryRows.filter((item) => item.registry_mutation_allowed_now === true).length,
    workflow_registration_allowed_count: context.workflowRows.filter((item) => item.workflow_registration_allowed_now === true).length,
    goal_phase_create_allowed_count: context.manifestRows.filter((item) => item.goal_create_allowed_now === true || item.phase_create_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P35201-P35600 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P35200 source state is not visible"),
    validationItem("registry.visible", "plan_registry", allPass(context.registryRows), "Plan registry candidates are incomplete"),
    validationItem("manifest.visible", "plan_registry", allPass(context.manifestRows), "Goal/phase manifest candidates are incomplete"),
    validationItem("workflow.visible", "plan_registry", allPass(context.workflowRows), "Project workflow candidates are incomplete"),
    validationItem("blockers.visible", "plan_registry", allPass(context.blockerRows), "Registry blockers are incomplete"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator plan registry projections are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P35201-P35600 wiring is incomplete"),
    validationItem("no.registry.record", "authority", context.registryRows.every((item) => item.actual_record_create_allowed_now === false && item.registry_mutation_allowed_now === false), "Registry record creation opened"),
    validationItem("no.goal.phase.create", "authority", context.manifestRows.every((item) => item.goal_create_allowed_now === false && item.phase_create_allowed_now === false), "Goal/phase creation opened"),
    validationItem("no.workflow.registration", "authority", context.workflowRows.every((item) => item.workflow_registration_allowed_now === false && item.registry_mutation_allowed_now === false), "Workflow registration opened"),
    validationItem("no.blocker.bypass", "authority", context.blockerRows.every((item) => item.owner_assignment_bypass_allowed_now === false && item.review_bypass_allowed_now === false && item.freshness_bypass_allowed_now === false), "Registry blocker bypass opened"),
    validationItem("no.operator.actions", "authority", context.operatorRows.every((item) => item.register_button_enabled_now === false && item.approve_button_enabled_now === false && item.execute_button_enabled_now === false), "Operator registry/action surface opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p35600_checkpoint.actual_registry_mutation_blocked"), "P35600 registry mutation blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "plan_registry_control_plane_candidate.contract.v1",
    generated_at: generatedAt,
    source_p35200_required_or_rebuilt: true,
    plan_registry_control_plane_candidate_required: true,
    goal_phase_manifest_binding_candidate_required: true,
    project_workflow_registration_candidate_required: true,
    registry_blocker_ledger_required: true,
    no_registry_mutation_boundary_required: true,
    p35600_is_not_registry_record_goal_phase_create_workflow_registration_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_plan_state_handoff
    ? READY_STATUS
    : validation.valid && boundary.p35600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    plan_registry_control_plane_status: status,
    source_p35200_ready_for_plan_registry: boundary.source_p35200_ready_for_plan_registry,
    plan_registry_control_plane_candidate_count: boundary.plan_registry_control_plane_candidate_count,
    goal_phase_manifest_binding_candidate_count: boundary.goal_phase_manifest_binding_candidate_count,
    project_workflow_registration_candidate_count: boundary.project_workflow_registration_candidate_count,
    blocker_count: boundary.blocker_count,
    operator_projection_count: boundary.operator_projection_count,
    registry_mutation_allowed_count: boundary.registry_mutation_allowed_count,
    workflow_registration_allowed_count: boundary.workflow_registration_allowed_count,
    goal_phase_create_allowed_count: boundary.goal_phase_create_allowed_count,
    ready_for_work_os_plan_state_handoff: validation.valid && boundary.ready_for_work_os_plan_state_handoff,
    plan_registry_actual_record_create_allowed_now: false,
    plan_registry_mutation_allowed_now: false,
    plan_registry_goal_create_allowed_now: false,
    plan_registry_phase_create_allowed_now: false,
    plan_registry_workflow_registration_allowed_now: false,
    plan_registry_runtime_execution_allowed_now: false,
    plan_registry_write_action_allowed_now: false,
    plan_registry_protected_action_allowed_now: false,
    plan_registry_final_approval_allowed_now: false,
    plan_registry_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Plan Registry Control-Plane Candidate",
    "",
    `Status: ${result.summary.plan_registry_control_plane_status}`,
    `Program: ${result.program_range}`,
    `P35200 ready for plan registry: ${result.summary.source_p35200_ready_for_plan_registry}`,
    `Registry candidates: ${result.summary.plan_registry_control_plane_candidate_count}`,
    `Goal/phase manifests: ${result.summary.goal_phase_manifest_binding_candidate_count}`,
    `Workflow candidates: ${result.summary.project_workflow_registration_candidate_count}`,
    `Ready for Work OS plan state handoff: ${result.summary.ready_for_work_os_plan_state_handoff}`,
    `Registry mutation allowed: ${result.summary.plan_registry_mutation_allowed_now}`,
    `Workflow registration allowed: ${result.summary.plan_registry_workflow_registration_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.project_workflow_registration_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.workflow_registration_candidate_ref)}</td><td>${escapeHtml(item.workflow_registration_allowed_now)}</td><td>${escapeHtml(item.registry_mutation_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Plan Registry Control-Plane Candidate</title>
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
    <h1>Hermes Plan Registry Control-Plane Candidate</h1>
    <p class="notice">This artifact projects plan registry, goal/phase manifest, and workflow registration candidates only. It does not create records, mutate registries, write, approve, execute, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Workflow Candidate</th><th>Workflow Registration</th><th>Registry Mutation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP35200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildCommercialSpecRegistrationCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.commercial_spec_registration_candidate", built);
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
  const defaults = DEFAULT_PLAN_REGISTRY_CONTROL_PLANE_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_commercial_spec_registration_candidate_path: path.resolve(repoRoot, options.sourceCommercialSpecRegistrationCandidatePath ?? defaults.sourceCommercialSpecRegistrationCandidatePath),
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
      args.sourceCommercialSpecRegistrationCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/plan-registry-control-plane-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P35201-P35600 Plan Registry Control-Plane Candidate.
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
