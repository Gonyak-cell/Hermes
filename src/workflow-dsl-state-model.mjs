import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_DSL_STATE_MODEL_OUT_DIR = "artifacts/workflow-dsl-state-model/latest";
export const DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS = {
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const WORKFLOW_DSL_STATES = [
  stateDefinition("started", "active", false, "Workflow has started or is executing deterministic/agent work."),
  stateDefinition("waiting", "human_or_external_wait", false, "Workflow is blocked on human review, approval, or external input."),
  stateDefinition("gated", "gate", false, "Workflow is at a pre/in/post-run gate boundary."),
  stateDefinition("approved", "approval", false, "Required human or policy approval has been recorded."),
  stateDefinition("failed", "terminal", true, "Workflow ended unsuccessfully, was cancelled, or failed a non-recoverable gate."),
  stateDefinition("completed", "terminal", true, "Workflow completed after all required gates and reviews."),
];

const REQUIRED_STATE_IDS = WORKFLOW_DSL_STATES.map((state) => state.dsl_state);

const WORKFLOW_DSL_TRANSITION_RULES = [
  transitionRule("started", "gated", "gate_required", "Workflow reaches a declared gate boundary."),
  transitionRule("started", "waiting", "human_input_required", "Workflow starts and immediately waits for human or external input."),
  transitionRule("started", "failed", "execution_failed", "Workflow execution fails before a gate or approval is reached."),
  transitionRule("gated", "waiting", "approval_or_receipt_required", "A gate blocks until human review, approval, or receipt is supplied."),
  transitionRule("gated", "approved", "gate_approved", "A gate passes with an approval decision already available."),
  transitionRule("gated", "failed", "gate_failed", "A required gate fails."),
  transitionRule("waiting", "approved", "human_approved", "The required human review or approval is recorded."),
  transitionRule("waiting", "failed", "human_rejected_or_timeout", "The required human review rejects, times out, or fails."),
  transitionRule("approved", "completed", "all_work_complete", "Approved workflow finishes finalization."),
  transitionRule("approved", "failed", "post_approval_failure", "Approved workflow fails during finalization."),
];

const SOURCE_STATE_TO_DSL_STATE = new Map([
  ["queued", "started"],
  ["running", "started"],
  ["input_collected", "started"],
  ["input_normalized", "started"],
  ["agent_running", "started"],
  ["agent_completed", "started"],
  ["evidence_linked", "started"],
  ["fact_extracted", "started"],
  ["issue_created", "started"],
  ["output_rendered", "started"],
  ["gate_passed", "gated"],
  ["gate_failed", "failed"],
  ["blocked", "waiting"],
  ["approval_pending", "waiting"],
  ["approval_decided", "approved"],
  ["completed", "completed"],
  ["failed", "failed"],
  ["cancelled", "failed"],
]);

export async function runWorkflowDslStateModel(options = {}) {
  const result = await buildWorkflowDslStateModel(options);
  if (options.write !== false) await writeWorkflowDslStateModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow DSL state model validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowDslStateModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_OUT_DIR);
  const inputs = {
    capability_workflow_contract_freeze_path: path.resolve(
      options.capabilityWorkflowContractFreezePath ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.capabilityWorkflowContractFreezePath,
    ),
    capability_manifest_v2_path: path.resolve(options.capabilityManifestV2Path ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.capabilityManifestV2Path),
    pack_manifest_compatibility_path: path.resolve(options.packManifestCompatibilityPath ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.packManifestCompatibilityPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.workflowRunLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.roadmapPath),
  };

  const capabilityWorkflowContractFreeze = await readJson(inputs.capability_workflow_contract_freeze_path);
  const capabilityManifestV2 = await readJson(inputs.capability_manifest_v2_path);
  const packManifestCompatibility = await readJson(inputs.pack_manifest_compatibility_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");
  const workflows = capabilityWorkflowContractFreeze.capability_workflow_contract?.workflows ?? [];
  const workflowRuns = capabilityWorkflowContractFreeze.capability_workflow_contract?.workflow_runs ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const workflowTransitions = workflowRunLedger.workflow_run_catalog?.workflow_state_transitions ?? [];
  const capabilityManifests = capabilityManifestV2.capability_manifests ?? [];
  const packRecords = packManifestCompatibility.pack_compatibility_records ?? [];
  const workflowBlueprints = buildWorkflowStateBlueprints({
    workflows,
    workflowRuns,
    capabilityManifests,
    packRecords,
    generatedAt,
  });
  const workflowRunStateProjections = buildWorkflowRunStateProjections({
    workflowRunRecords,
    workflowTransitions,
    workflowBlueprints,
    capabilityManifests,
    generatedAt,
  });
  const validationItems = validateWorkflowDslStateModel({
    capabilityWorkflowContractFreeze,
    capabilityManifestV2,
    packManifestCompatibility,
    workflowRunLedger,
    packageJson,
    roadmapText,
    workflowBlueprints,
    workflowRunStateProjections,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-dsl-state-model.v1",
    generated_at: generatedAt,
    workflow_dsl_state_model_id: `workflow-dsl-state-model.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      capability_workflow_contract_freeze: {
        schema_version: capabilityWorkflowContractFreeze.schema_version ?? null,
        freeze_status: capabilityWorkflowContractFreeze.summary?.freeze_status ?? "unknown",
        workflow_count: capabilityWorkflowContractFreeze.summary?.workflow_count ?? workflows.length,
        workflow_run_count: capabilityWorkflowContractFreeze.summary?.workflow_run_count ?? workflowRuns.length,
        validation_error_count: capabilityWorkflowContractFreeze.summary?.validation_error_count ?? capabilityWorkflowContractFreeze.validation?.errors?.length ?? 0,
      },
      capability_manifest_v2: {
        schema_version: capabilityManifestV2.schema_version ?? null,
        capability_manifest_v2_status: capabilityManifestV2.summary?.capability_manifest_v2_status ?? "unknown",
        capability_manifest_count: capabilityManifestV2.summary?.capability_manifest_count ?? capabilityManifests.length,
        validation_error_count: capabilityManifestV2.summary?.validation_error_count ?? capabilityManifestV2.validation?.errors?.length ?? 0,
      },
      pack_manifest_compatibility: {
        schema_version: packManifestCompatibility.schema_version ?? null,
        compatibility_status: packManifestCompatibility.summary?.compatibility_status ?? "unknown",
        pack_count: packManifestCompatibility.summary?.pack_count ?? packRecords.length,
        validation_error_count: packManifestCompatibility.summary?.validation_error_count ?? packManifestCompatibility.validation?.errors?.length ?? 0,
      },
      workflow_run_ledger: {
        schema_version: workflowRunLedger.schema_version ?? null,
        workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
        workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
        state_transition_count: workflowRunLedger.summary?.state_transition_count ?? workflowTransitions.length,
        validation_error_count: workflowRunLedger.summary?.validation_error_count ?? workflowRunLedger.validation?.errors?.length ?? 0,
      },
    },
    workflow_dsl_state_model: {
      schema_version: "workflow-dsl-state-model.v1",
      state_model_version: "workflow-dsl-state.v1",
      required_dsl_states: REQUIRED_STATE_IDS,
      workflow_dsl_states: WORKFLOW_DSL_STATES,
      transition_rules: WORKFLOW_DSL_TRANSITION_RULES,
      source_state_mapping: Object.fromEntries(SOURCE_STATE_TO_DSL_STATE.entries()),
      workflow_state_blueprints: workflowBlueprints,
      workflow_run_state_projections: workflowRunStateProjections,
    },
    workflow_dsl_states: WORKFLOW_DSL_STATES,
    workflow_dsl_transition_rules: WORKFLOW_DSL_TRANSITION_RULES,
    workflow_state_blueprints: workflowBlueprints,
    workflow_run_state_projections: workflowRunStateProjections,
    summary: summarizeWorkflowDslStateModel({
      workflowBlueprints,
      workflowRunStateProjections,
      validation,
      validationItems,
    }),
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderWorkflowDslStateModelMarkdown(result),
  };
}

export async function writeWorkflowDslStateModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-dsl-state-model.json"), serializableWorkflowDslStateModel(result));
  await writeJson(path.join(outDir, "workflow-dsl-states.json"), {
    generated_at: result.generated_at,
    state_count: result.workflow_dsl_states.length,
    workflow_dsl_states: result.workflow_dsl_states,
  });
  await writeJson(path.join(outDir, "workflow-dsl-transition-rules.json"), {
    generated_at: result.generated_at,
    transition_rule_count: result.workflow_dsl_transition_rules.length,
    workflow_dsl_transition_rules: result.workflow_dsl_transition_rules,
  });
  await writeJson(path.join(outDir, "workflow-state-blueprints.json"), {
    generated_at: result.generated_at,
    blueprint_count: result.workflow_state_blueprints.length,
    workflow_state_blueprints: result.workflow_state_blueprints,
  });
  await writeJson(path.join(outDir, "workflow-run-state-projections.json"), {
    generated_at: result.generated_at,
    projection_count: result.workflow_run_state_projections.length,
    workflow_run_state_projections: result.workflow_run_state_projections,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    workflow_dsl_state_model_id: result.workflow_dsl_state_model_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowDslStateModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowDslStateModel(args);
    console.log(`Workflow DSL state model written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_dsl_state_model_status}`);
    console.log(`DSL states: ${result.summary.dsl_state_count}`);
    console.log(`Workflow blueprints: ${result.summary.workflow_state_blueprint_count}`);
    console.log(`Run projections: ${result.summary.workflow_run_state_projection_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildWorkflowStateBlueprints({ workflows, workflowRuns, capabilityManifests, packRecords, generatedAt }) {
  const manifestByCapability = new Map(capabilityManifests.map((manifest) => [manifest.capability_id, manifest]));
  const packById = new Map(packRecords.map((record) => [record.pack_id, record]));
  const runCountByWorkflow = countBy(workflowRuns, "workflow_id");
  return workflows.map((workflow) => {
    const manifest = manifestByCapability.get(workflow.capability_id);
    const hasApprovalStep = (workflow.steps ?? []).some((step) => step.step_type === "approval" || step.runtime_id === "manual");
    const hasGateStep = (workflow.steps ?? []).some((step) => step.step_type === "gate" || step.gate_phase);
    const humanReviewRequired = Boolean(manifest?.approval_policy?.required) || hasApprovalStep;
    const defaultPath = humanReviewRequired
      ? ["started", "gated", "waiting", "approved", "completed"]
      : ["started", hasGateStep ? "gated" : null, "completed"].filter(Boolean);
    return {
      schema_version: "workflow-state-blueprint.v1",
      workflow_id: workflow.workflow_id,
      capability_id: workflow.capability_id,
      capability_version: workflow.capability_version ?? manifest?.version ?? null,
      domain_pack: workflow.domain_pack ?? manifest?.domain_pack ?? inferDomainPack(workflow.capability_id),
      pack_compatibility_status: packById.get(workflow.domain_pack)?.compatibility_status ?? "unknown",
      source_initial_state: workflow.state_machine?.initial ?? null,
      source_terminal_states: workflow.state_machine?.terminal ?? [],
      source_blocked_state: workflow.state_machine?.blocked_state ?? null,
      dsl_initial_state: "started",
      dsl_terminal_states: ["completed", "failed"],
      required_dsl_states: REQUIRED_STATE_IDS,
      default_dsl_path: defaultPath,
      approval_state_required: humanReviewRequired,
      gate_state_required: hasGateStep || (manifest?.gate_requirements?.length ?? 0) > 0,
      waiting_state_required: humanReviewRequired,
      run_count: runCountByWorkflow.get(workflow.workflow_id) ?? 0,
      blueprint_status: "complete",
      created_at: generatedAt,
    };
  }).sort((left, right) => left.workflow_id.localeCompare(right.workflow_id));
}

function buildWorkflowRunStateProjections({ workflowRunRecords, workflowTransitions, workflowBlueprints, capabilityManifests, generatedAt }) {
  const transitionsByRun = groupBy(workflowTransitions, "workflow_run_id");
  const blueprintByWorkflow = new Map(workflowBlueprints.map((blueprint) => [blueprint.workflow_id, blueprint]));
  const manifestByCapability = new Map(capabilityManifests.map((manifest) => [manifest.capability_id, manifest]));
  return workflowRunRecords.map((record) => {
    const sourceTransitions = transitionsByRun.get(record.workflow_run_id) ?? [];
    const mappedTransitions = buildDslTransitionProjection(sourceTransitions);
    const sourceStates = unique(sourceTransitions.flatMap((transition) => [transition.from_state, transition.to_state]));
    const unknownSourceStates = sourceStates.filter((state) => !SOURCE_STATE_TO_DSL_STATE.has(state));
    const dslStatePath = unique(mappedTransitions.flatMap((transition) => [transition.from_dsl_state, transition.to_dsl_state]));
    const currentDslState = dslStateForRunRecord(record);
    const manifest = manifestByCapability.get(record.capability_id);
    const blueprint = blueprintByWorkflow.get(record.workflow_id);
    const humanReviewRequired = Boolean(record.human_review_required || manifest?.approval_policy?.required || blueprint?.approval_state_required);
    const stateProjectionStatus = unknownSourceStates.length === 0 && currentDslState !== "unknown" ? "clear" : "blocked";
    return {
      schema_version: "workflow-run-state-projection.v1",
      workflow_run_id: record.workflow_run_id,
      workflow_id: record.workflow_id,
      capability_id: record.capability_id,
      domain_pack: record.domain_pack,
      source_run_status: record.run_status,
      run_status: record.run_status,
      source_terminal_state: record.terminal_state,
      dsl_current_state: currentDslState,
      dsl_terminal_state: ["completed", "failed"].includes(currentDslState) ? currentDslState : null,
      dsl_state_path: dslStatePath.includes(currentDslState) ? dslStatePath : [...dslStatePath, currentDslState],
      dsl_transition_count: mappedTransitions.length,
      source_transition_count: sourceTransitions.length,
      unknown_source_state_count: unknownSourceStates.length,
      unknown_source_states: unknownSourceStates,
      human_review_required: humanReviewRequired,
      law_firm_human_review_required: record.domain_pack === "law-firm" && humanReviewRequired,
      waiting_reason: currentDslState === "waiting" ? record.blocked_reason ?? "human_review_pending" : null,
      state_projection_status: stateProjectionStatus,
      projection_status: stateProjectionStatus === "clear" ? "complete" : "blocked",
      terminal_classification: classifyDslTerminalState(currentDslState),
      mapped_transitions: mappedTransitions,
      recorded_at: generatedAt,
    };
  }).sort((left, right) => left.workflow_run_id.localeCompare(right.workflow_run_id));
}

function buildDslTransitionProjection(sourceTransitions) {
  const mapped = [];
  let lastDslState = null;
  for (const transition of sourceTransitions.sort((left, right) => (left.transition_sequence ?? 0) - (right.transition_sequence ?? 0))) {
    const fromDslState = SOURCE_STATE_TO_DSL_STATE.get(transition.from_state) ?? "unknown";
    const toDslState = SOURCE_STATE_TO_DSL_STATE.get(transition.to_state) ?? "unknown";
    if (fromDslState === "unknown" || toDslState === "unknown") {
      mapped.push(dslTransitionRow(transition, fromDslState, toDslState, "blocked"));
      lastDslState = toDslState;
      continue;
    }
    if (fromDslState === toDslState && lastDslState === toDslState) continue;
    if (fromDslState === toDslState && lastDslState !== null) continue;
    mapped.push(dslTransitionRow(transition, fromDslState, toDslState, isAllowedTransition(fromDslState, toDslState) ? "allowed" : "blocked"));
    lastDslState = toDslState;
  }
  return mapped;
}

function dslTransitionRow(sourceTransition, fromDslState, toDslState, transitionStatus) {
  return {
    schema_version: "workflow-dsl-transition-projection.v1",
    source_transition_id: sourceTransition.workflow_state_transition_id,
    workflow_run_id: sourceTransition.workflow_run_id,
    from_source_state: sourceTransition.from_state,
    to_source_state: sourceTransition.to_state,
    from_dsl_state: fromDslState,
    to_dsl_state: toDslState,
    transition_status: transitionStatus,
    event_envelope_id: sourceTransition.event_envelope_id ?? null,
    event_type: sourceTransition.transition_event_type ?? null,
  };
}

function validateWorkflowDslStateModel({
  capabilityWorkflowContractFreeze,
  capabilityManifestV2,
  packManifestCompatibility,
  workflowRunLedger,
  packageJson,
  roadmapText,
  workflowBlueprints,
  workflowRunStateProjections,
}) {
  const items = [];
  pushCheck(items, "source.capability_workflow_contract_freeze", "capability_workflow_contract_freeze_complete", capabilityWorkflowContractFreeze.summary?.freeze_status === "complete" && capabilityWorkflowContractFreeze.validation?.valid !== false, "Capability/workflow contract freeze must be complete.");
  pushCheck(items, "source.capability_manifest_v2", "capability_manifest_v2_complete", capabilityManifestV2.summary?.capability_manifest_v2_status === "complete" && capabilityManifestV2.validation?.valid !== false, "Capability Manifest v2 catalog must be complete.");
  pushCheck(items, "source.pack_manifest_compatibility", "pack_manifest_compatibility_complete", packManifestCompatibility.summary?.compatibility_status === "complete" && packManifestCompatibility.validation?.valid !== false, "Pack manifest compatibility must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:state-model"]), "package.json must expose npm run workflows:state-model.");
  pushCheck(items, "roadmap.phase_179", "phase_179_documented", roadmapText.includes("P179") && roadmapText.includes("workflow DSL state model"), "Roadmap must keep the P179 workflow DSL state model slot visible.");
  pushCheck(items, "workflow_dsl_states", "required_six_state_model_declared", REQUIRED_STATE_IDS.every((state) => WORKFLOW_DSL_STATES.some((definition) => definition.dsl_state === state)), "The DSL state model must declare started, waiting, gated, approved, failed, and completed.");
  pushCheck(items, "workflow_dsl_transition_rules", "core_transition_rules_declared", [
    "started->gated",
    "gated->waiting",
    "waiting->approved",
    "approved->completed",
    "started->failed",
  ].every((edge) => WORKFLOW_DSL_TRANSITION_RULES.some((rule) => `${rule.from_state}->${rule.to_state}` === edge)), "The DSL state model must declare the core transition edges.");
  pushCheck(items, "workflow_state_blueprints", "workflow_blueprints_cover_contract_workflows", workflowBlueprints.length === (capabilityWorkflowContractFreeze.capability_workflow_contract?.workflows?.length ?? 0) && workflowBlueprints.length > 0, "Workflow state blueprints must cover every workflow contract.");
  pushCheck(items, "workflow_run_state_projections", "workflow_run_projections_cover_ledger_records", workflowRunStateProjections.length === (workflowRunLedger.workflow_run_catalog?.workflow_run_records?.length ?? 0) && workflowRunStateProjections.length > 0, "Workflow run state projections must cover every workflow run ledger record.");
  pushCheck(items, "workflow_run_state_projections", "all_projection_states_known", workflowRunStateProjections.every((projection) => projection.state_projection_status === "clear"), "Every workflow run projection must map source states to known DSL states.");
  pushCheck(items, "workflow_run_state_projections.waiting", "blocked_runs_project_to_waiting", workflowRunStateProjections.filter((projection) => projection.run_status === "blocked").every((projection) => projection.dsl_current_state === "waiting"), "Blocked workflow runs must project to the waiting DSL state.");
  pushCheck(items, "workflow_state_blueprints.law_firm", "law_firm_workflows_require_waiting_review_state", workflowBlueprints.filter((blueprint) => blueprint.domain_pack === "law-firm").every((blueprint) => blueprint.waiting_state_required), "Law-firm workflows must include the waiting state for human review.");
  pushCheck(items, "workflow_run_state_projections.law_firm", "law_firm_blocked_runs_wait_for_human_review", workflowRunStateProjections.filter((projection) => projection.domain_pack === "law-firm" && projection.run_status === "blocked").every((projection) => projection.dsl_current_state === "waiting" && projection.law_firm_human_review_required), "Blocked law-firm workflow runs must remain waiting for human review.");
  return items;
}

function summarizeWorkflowDslStateModel({ workflowBlueprints, workflowRunStateProjections, validation, validationItems }) {
  const waitingProjectionCount = workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "waiting").length;
  const clearProjectionCount = workflowRunStateProjections.filter((projection) => projection.state_projection_status === "clear").length;
  return {
    workflow_dsl_state_model_status: validation.valid ? "complete" : "blocked",
    state_model_version: "workflow-dsl-state.v1",
    dsl_state_count: WORKFLOW_DSL_STATES.length,
    required_state_count: REQUIRED_STATE_IDS.length,
    terminal_state_count: WORKFLOW_DSL_STATES.filter((state) => state.terminal).length,
    transition_rule_count: WORKFLOW_DSL_TRANSITION_RULES.length,
    workflow_blueprint_count: workflowBlueprints.length,
    workflow_state_blueprint_count: workflowBlueprints.length,
    approval_state_required_blueprint_count: workflowBlueprints.filter((blueprint) => blueprint.approval_state_required).length,
    waiting_state_required_blueprint_count: workflowBlueprints.filter((blueprint) => blueprint.waiting_state_required).length,
    workflow_run_projection_count: workflowRunStateProjections.length,
    workflow_run_state_projection_count: workflowRunStateProjections.length,
    clear_projection_count: clearProjectionCount,
    blocked_projection_count: workflowRunStateProjections.length - clearProjectionCount,
    waiting_run_count: waitingProjectionCount,
    gated_run_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "gated").length,
    approved_run_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "approved").length,
    completed_run_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "completed").length,
    failed_run_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "failed").length,
    waiting_projection_count: waitingProjectionCount,
    completed_projection_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "completed").length,
    failed_projection_count: workflowRunStateProjections.filter((projection) => projection.dsl_current_state === "failed").length,
    unknown_source_state_count: workflowRunStateProjections.reduce((count, projection) => count + (projection.unknown_source_state_count ?? 0), 0),
    blocked_transition_count: workflowRunStateProjections.reduce((count, projection) => count + projection.mapped_transitions.filter((transition) => transition.transition_status !== "allowed").length, 0),
    human_review_waiting_count: workflowRunStateProjections.filter((projection) => projection.human_review_required && projection.dsl_current_state === "waiting").length,
    law_firm_waiting_count: workflowRunStateProjections.filter((projection) => projection.law_firm_human_review_required && projection.dsl_current_state === "waiting").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_dsl_current_state: countByObject(workflowRunStateProjections, "dsl_current_state"),
  };
}

function renderWorkflowDslStateModelMarkdown(result) {
  const lines = [];
  lines.push("# Workflow DSL State Model");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.workflow_dsl_state_model_status}`);
  lines.push("");
  lines.push(`- DSL states: ${result.summary.dsl_state_count}`);
  lines.push(`- Transition rules: ${result.summary.transition_rule_count}`);
  lines.push(`- Workflow blueprints: ${result.summary.workflow_state_blueprint_count}`);
  lines.push(`- Run projections: ${result.summary.workflow_run_state_projection_count}`);
  lines.push(`- Waiting projections: ${result.summary.waiting_projection_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## States");
  lines.push("");
  for (const state of result.workflow_dsl_states) {
    lines.push(`- ${state.dsl_state}: ${state.description}`);
  }
  lines.push("");
  lines.push("## Run Projections");
  lines.push("");
  for (const projection of result.workflow_run_state_projections) {
    lines.push(`- ${projection.workflow_run_id}: ${projection.run_status} -> ${projection.dsl_current_state}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    lines.push("");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function stateDefinition(dslState, stateCategory, terminal, description) {
  return {
    schema_version: "workflow-dsl-state.v1",
    dsl_state: dslState,
    state_category: stateCategory,
    terminal,
    description,
  };
}

function transitionRule(fromState, toState, transition_reason, description) {
  return {
    schema_version: "workflow-dsl-transition-rule.v1",
    transition_rule_id: `workflow-dsl-transition.${fromState}.${toState}`,
    from_state: fromState,
    to_state: toState,
    transition_reason,
    description,
    allowed: true,
  };
}

function isAllowedTransition(fromState, toState) {
  if (fromState === toState) return true;
  return WORKFLOW_DSL_TRANSITION_RULES.some((rule) => rule.from_state === fromState && rule.to_state === toState);
}

function dslStateForRunRecord(record) {
  if (record.run_status === "completed" || record.terminal_state === "completed") return "completed";
  if (record.run_status === "failed" || record.run_status === "cancelled" || record.terminal_state === "failed" || record.terminal_state === "cancelled") return "failed";
  if (record.run_status === "blocked" || record.terminal_state === "blocked") return "waiting";
  if (record.terminal_state === "gate_passed" || record.terminal_state === "gate_failed") return "gated";
  if (record.terminal_state === "approval_decided") return "approved";
  if (record.run_status === "queued" || record.run_status === "running") return "started";
  return SOURCE_STATE_TO_DSL_STATE.get(record.terminal_state) ?? "unknown";
}

function classifyDslTerminalState(dslState) {
  if (dslState === "completed" || dslState === "failed") return "terminal";
  if (dslState === "waiting") return "non_terminal_waiting";
  return "active";
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function countByObject(items, key) {
  return Object.fromEntries([...countBy(items, key).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function inferDomainPack(capabilityId) {
  if (String(capabilityId ?? "").startsWith("law_firm.")) return "law-firm";
  if (String(capabilityId ?? "").startsWith("personal_dev.")) return "personal-dev";
  if (String(capabilityId ?? "").startsWith("creative_document.")) return "creative-document";
  return "common";
}

function serializableWorkflowDslStateModel(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    capabilityWorkflowContractFreezePath: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.capabilityWorkflowContractFreezePath,
    capabilityManifestV2Path: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.capabilityManifestV2Path,
    packManifestCompatibilityPath: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.packManifestCompatibilityPath,
    workflowRunLedgerPath: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.workflowRunLedgerPath,
    packagePath: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_DSL_STATE_MODEL_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_DSL_STATE_MODEL_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-dsl-state-model.mjs [options]

Options:
  --capability-workflow-contract-freeze <path>  capability-workflow-contract-freeze.json path.
  --capability-manifest-v2 <path>               capability-manifest-v2.json path.
  --pack-manifest-compatibility <path>          pack-manifest-compatibility.json path.
  --workflow-run-ledger <path>                  workflow-run-ledger.json path.
  --package <path>                              package.json path.
  --roadmap <path>                              phase ledger path.
  --out-dir <folder>                            Output directory.
  --run-at <iso>                                Deterministic generated_at timestamp.
  --check                                       Validate only, do not write artifacts.
  -h, --help                                    Show this help.
`);
}

function dateStamp(isoTimestamp) {
  return String(isoTimestamp).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
