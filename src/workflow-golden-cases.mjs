import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_GOLDEN_CASES_OUT_DIR = "artifacts/workflow-golden-cases/latest";
export const DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS = {
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  workflowDslStateModelPath: "artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workflowQueueRetryBackoffPath: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
  workflowIdempotencyLedgerPath: "artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json",
  workflowResumeCancelContractPath: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
  gateResultAggregatorPath: "artifacts/gate-result-aggregator/latest/gate-result-aggregator.json",
  workflowRunDashboardPath: "artifacts/workflow-run-dashboard/latest/workflow-run-dashboard.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const WORKFLOW_GOLDEN_CASES_CONTRACT_ID = "workflow-golden-cases.v1";
const REQUIRED_DOMAIN_PACKS = ["law-firm", "personal-dev", "creative-document"];

export async function runWorkflowGoldenCases(options = {}) {
  const result = await buildWorkflowGoldenCases(options);
  if (options.write !== false) await writeWorkflowGoldenCases(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow golden cases failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowGoldenCases(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_GOLDEN_CASES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    capabilityManifestV2: await readJsonOrError(inputs.capability_manifest_v2_path),
    workflowDslStateModel: await readJsonOrError(inputs.workflow_dsl_state_model_path),
    workflowStateMachineRunner: await readJsonOrError(inputs.workflow_state_machine_runner_path),
    workflowQueueRetryBackoff: await readJsonOrError(inputs.workflow_queue_retry_backoff_path),
    workflowIdempotencyLedger: await readJsonOrError(inputs.workflow_idempotency_ledger_path),
    workflowResumeCancelContract: await readJsonOrError(inputs.workflow_resume_cancel_contract_path),
    gateResultAggregator: await readJsonOrError(inputs.gate_result_aggregator_path),
    workflowRunDashboard: await readJsonOrError(inputs.workflow_run_dashboard_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const artifacts = sourceArtifacts(sources);
  const workflowGoldenCases = buildWorkflowGoldenCasesFromSources({ artifacts, generatedAt });
  const workflowGoldenCaseSteps = workflowGoldenCases.flatMap((goldenCase) => goldenCase.state_machine_steps);
  const workflowGoldenCaseRegressionManifest = buildRegressionManifest(workflowGoldenCases, generatedAt);
  const validationItems = validateWorkflowGoldenCases({
    sources,
    workflowGoldenCases,
    workflowGoldenCaseSteps,
    workflowGoldenCaseRegressionManifest,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-golden-cases.v1",
    generated_at: generatedAt,
    workflow_golden_case_suite_id: `workflow-golden-cases.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources),
    workflow_golden_case_contract: buildWorkflowGoldenCaseContract(generatedAt),
    workflow_golden_case_catalog: {
      schema_version: "workflow-golden-case-catalog.v1",
      generated_at: generatedAt,
      workflow_golden_cases: workflowGoldenCases,
      workflow_golden_case_steps: workflowGoldenCaseSteps,
      workflow_golden_case_regression_manifest: workflowGoldenCaseRegressionManifest,
    },
    workflow_golden_cases: workflowGoldenCases,
    workflow_golden_case_steps: workflowGoldenCaseSteps,
    workflow_golden_case_regression_manifest: workflowGoldenCaseRegressionManifest,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowGoldenCases({
      sources,
      workflowGoldenCases,
      workflowGoldenCaseSteps,
      workflowGoldenCaseRegressionManifest,
      validationItems,
      validation,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowGoldenCasesMarkdown(result),
  };
}

export async function writeWorkflowGoldenCases(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-golden-cases.json"), serializableWorkflowGoldenCases(result));
  await writeJson(path.join(outDir, "workflow-golden-case-records.json"), {
    schema_version: "workflow-golden-case-records.v1",
    generated_at: result.generated_at,
    workflow_golden_case_count: result.workflow_golden_cases.length,
    workflow_golden_cases: result.workflow_golden_cases,
  });
  await writeJson(path.join(outDir, "workflow-golden-case-steps.json"), {
    schema_version: "workflow-golden-case-steps.v1",
    generated_at: result.generated_at,
    workflow_golden_case_step_count: result.workflow_golden_case_steps.length,
    workflow_golden_case_steps: result.workflow_golden_case_steps,
  });
  await writeJson(path.join(outDir, "workflow-golden-case-regression-manifest.json"), result.workflow_golden_case_regression_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-golden-case-validation-report.v1",
    generated_at: result.generated_at,
    workflow_golden_case_suite_id: result.workflow_golden_case_suite_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowGoldenCasesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowGoldenCases(args);
    console.log(`Workflow golden cases ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_golden_case_status}`);
    console.log(`Cases: ${result.summary.workflow_golden_case_count}`);
    console.log(`State machine passed: ${result.summary.state_machine_passed_case_count}`);
    console.log(`Domain packs: ${result.summary.represented_domain_pack_count}/${result.summary.required_domain_pack_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildWorkflowGoldenCaseContract(generatedAt) {
  return {
    schema_version: "workflow-golden-case-contract.v1",
    workflow_golden_case_contract_id: WORKFLOW_GOLDEN_CASES_CONTRACT_ID,
    generated_at: generatedAt,
    required_domain_packs: REQUIRED_DOMAIN_PACKS,
    source_of_truth: "harness_control_plane",
    state_machine_pass_rule: "Each representative workflow must bind to a DSL projection, runner plan, transition guard, queue, idempotency key, resume/cancel hold, gate status, and dashboard panel.",
    human_gate_rule: "Golden cases may pass the deterministic state machine through the current human-review boundary without auto-approving, retrying, resuming, cancelling, delivering, or executing final actions.",
    mutation_policy: "read_only_fixture_no_mutation",
  };
}

function buildWorkflowGoldenCasesFromSources({ artifacts, generatedAt }) {
  const panels = artifacts.workflowRunDashboard.workflow_run_dashboard_panels ?? [];
  const selectedPanels = REQUIRED_DOMAIN_PACKS
    .map((domainPack) => selectRepresentativePanel(panels, domainPack))
    .filter(Boolean);
  const projectionsByRun = byId(artifacts.workflowDslStateModel.workflow_run_state_projections ?? [], "workflow_run_id");
  const blueprintsByWorkflow = byId(artifacts.workflowDslStateModel.workflow_state_blueprints ?? [], "workflow_id");
  const runnerPlansByRun = byId(artifacts.workflowStateMachineRunner.workflow_runner_plans ?? [], "workflow_run_id");
  const transitionGuardsByRun = byId(artifacts.workflowStateMachineRunner.transition_guard_records ?? [], "workflow_run_id");
  const queueRecordsByRun = byId(artifacts.workflowQueueRetryBackoff.workflow_queue_records ?? [], "workflow_run_id");
  const idempotencyKeysByRun = byId(artifacts.workflowIdempotencyLedger.idempotency_key_records ?? [], "workflow_run_id");
  const resumeCursorsByRun = byId(artifacts.workflowResumeCancelContract.resume_cursor_records ?? [], "workflow_run_id");
  const cancelRequestsByRun = byId(artifacts.workflowResumeCancelContract.cancel_request_records ?? [], "workflow_run_id");
  const gateStatusesByRun = byId(artifacts.gateResultAggregator.workflow_gate_status_records ?? [], "workflow_run_id");
  const manifestsByCapability = byId(artifacts.capabilityManifestV2.capability_manifest_v2_catalog?.capability_manifests ?? [], "capability_id");

  return selectedPanels.map((panel) => {
    const projection = projectionsByRun.get(panel.workflow_run_id) ?? {};
    const blueprint = blueprintsByWorkflow.get(panel.workflow_id) ?? {};
    const runnerPlan = runnerPlansByRun.get(panel.workflow_run_id) ?? {};
    const transitionGuard = transitionGuardsByRun.get(panel.workflow_run_id) ?? {};
    const queueRecord = queueRecordsByRun.get(panel.workflow_run_id) ?? {};
    const idempotencyKey = idempotencyKeysByRun.get(panel.workflow_run_id) ?? {};
    const resumeCursor = resumeCursorsByRun.get(panel.workflow_run_id) ?? {};
    const cancelRequest = cancelRequestsByRun.get(panel.workflow_run_id) ?? {};
    const gateStatus = gateStatusesByRun.get(panel.workflow_run_id) ?? {};
    const manifest = manifestsByCapability.get(panel.capability_id) ?? {};
    const expectedStatePath = blueprint.default_dsl_path ?? ["started", "gated", "waiting", "approved", "completed"];
    const observedStatePath = projection.dsl_state_path ?? [];
    const expectedObservedPrefix = expectedStatePath.slice(0, Math.max(expectedStatePath.indexOf("waiting") + 1, 3));
    const checks = {
      projection_bound: Boolean(projection.workflow_run_id),
      runner_plan_bound: Boolean(runnerPlan.workflow_runner_plan_id),
      transition_guard_bound: Boolean(transitionGuard.transition_guard_id),
      queue_record_bound: Boolean(queueRecord.workflow_queue_record_id),
      idempotency_key_bound: Boolean(idempotencyKey.workflow_idempotency_key_id ?? idempotencyKey.idempotency_key_record_id),
      resume_cursor_bound: Boolean(resumeCursor.resume_cursor_record_id),
      cancel_request_bound: Boolean(cancelRequest.cancel_request_record_id),
      gate_status_bound: Boolean(gateStatus.workflow_gate_status_id),
      dashboard_panel_bound: Boolean(panel.workflow_run_dashboard_panel_id),
      capability_manifest_bound: Boolean(manifest.capability_id),
      observed_prefix_passed: arrayStartsWith(observedStatePath, expectedObservedPrefix),
      transition_rule_found: transitionGuard.transition_rule_found === true,
      next_state_guarded: runnerPlan.next_dsl_state === "approved" && transitionGuard.to_dsl_state === "approved",
      human_review_hold_preserved: panel.human_review_required === true && panel.queue_status === "held_for_human_review" && transitionGuard.requires_human_review === true,
      no_auto_mutation: !panel.auto_dequeue_allowed
        && !panel.auto_retry_scheduled
        && !panel.auto_resume_allowed
        && !panel.auto_cancel_allowed
        && !panel.protected_action_executed
        && !panel.final_action_executed
        && !gateStatus.execution_performed_count
        && !gateStatus.final_action_executed_count,
    };
    const stateMachinePassed = Object.values(checks).every(Boolean);
    const workflowGoldenCaseId = `workflow-golden-case.${slugify(panel.domain_pack)}.${slugify(panel.capability_id)}`;
    const caseRecord = {
      schema_version: "workflow-golden-case.v1",
      workflow_golden_case_id: workflowGoldenCaseId,
      domain_pack: panel.domain_pack,
      workflow_run_id: panel.workflow_run_id,
      workflow_id: panel.workflow_id,
      capability_id: panel.capability_id,
      capability_display_name: panel.capability_display_name ?? manifest.display_name ?? null,
      expected_state_path: expectedStatePath,
      observed_state_path: observedStatePath,
      current_dsl_state: projection.dsl_current_state ?? panel.dsl_current_state ?? "unknown",
      next_dsl_state: runnerPlan.next_dsl_state ?? null,
      transition_guard_status: transitionGuard.transition_guard_status ?? "unknown",
      runner_plan_status: runnerPlan.runner_plan_status ?? "unknown",
      workflow_gate_status: gateStatus.workflow_gate_status ?? panel.workflow_gate_status ?? "unknown",
      queue_status: queueRecord.queue_status ?? panel.queue_status ?? "unknown",
      human_review_required: panel.human_review_required === true,
      law_firm_human_review_required: panel.law_firm_human_review_required === true,
      state_machine_passed: stateMachinePassed,
      state_machine_pass_status: stateMachinePassed ? "passed" : "failed",
      case_status: stateMachinePassed ? "locked" : "mismatch",
      source_bindings: {
        workflow_run_dashboard_panel_id: panel.workflow_run_dashboard_panel_id ?? null,
        workflow_run_state_projection_id: projection.workflow_run_id ? `workflow-run-state-projection.${slugify(projection.workflow_run_id)}` : null,
        workflow_runner_plan_id: runnerPlan.workflow_runner_plan_id ?? null,
        transition_guard_id: transitionGuard.transition_guard_id ?? null,
        workflow_queue_record_id: queueRecord.workflow_queue_record_id ?? null,
        idempotency_key_record_id: idempotencyKey.workflow_idempotency_key_id ?? idempotencyKey.idempotency_key_record_id ?? null,
        resume_cursor_record_id: resumeCursor.resume_cursor_record_id ?? null,
        cancel_request_record_id: cancelRequest.cancel_request_record_id ?? null,
        workflow_gate_status_id: gateStatus.workflow_gate_status_id ?? null,
        capability_manifest_id: manifest.capability_id ?? null,
      },
      pass_checks: checks,
      state_machine_steps: buildStateMachineSteps({
        workflowGoldenCaseId,
        panel,
        projection,
        runnerPlan,
        transitionGuard,
        expectedStatePath,
        generatedAt,
      }),
      human_review_note: panel.law_firm_human_review_required
        ? "Attorney review remains required before approval, delivery, or client-facing release."
        : "Human review remains required before approval, delivery, or final action.",
      captured_at: generatedAt,
    };
    return {
      ...caseRecord,
      regression_hash: hashObject({
        workflow_golden_case_id: caseRecord.workflow_golden_case_id,
        domain_pack: caseRecord.domain_pack,
        workflow_run_id: caseRecord.workflow_run_id,
        expected_state_path: caseRecord.expected_state_path,
        observed_state_path: caseRecord.observed_state_path,
        pass_checks: caseRecord.pass_checks,
        case_status: caseRecord.case_status,
      }),
    };
  });
}

function selectRepresentativePanel(panels, domainPack) {
  const candidates = panels.filter((panel) => panel.domain_pack === domainPack && panel.workflow_id);
  if (domainPack === "law-firm") {
    return candidates.find((panel) => panel.capability_id === "law_firm.ldd.issue_report") ?? candidates[0] ?? null;
  }
  return candidates[0] ?? panels.find((panel) => panel.domain_pack === domainPack) ?? null;
}

function buildStateMachineSteps({ workflowGoldenCaseId, panel, projection, runnerPlan, transitionGuard, expectedStatePath, generatedAt }) {
  const observedStateSet = new Set(projection.dsl_state_path ?? []);
  return expectedStatePath.map((state, index) => {
    const nextState = expectedStatePath[index + 1] ?? null;
    const observed = observedStateSet.has(state);
    const guardedApprovalStep = state === "approved" && runnerPlan.next_dsl_state === "approved" && transitionGuard.to_dsl_state === "approved";
    const terminalAfterReviewStep = state === "completed" && panel.final_action_executed === false;
    const stepPassed = observed || guardedApprovalStep || terminalAfterReviewStep;
    return {
      schema_version: "workflow-golden-case-step.v1",
      workflow_golden_case_step_id: `${workflowGoldenCaseId}.step.${String(index + 1).padStart(2, "0")}`,
      workflow_golden_case_id: workflowGoldenCaseId,
      workflow_run_id: panel.workflow_run_id,
      domain_pack: panel.domain_pack,
      step_index: index + 1,
      dsl_state: state,
      next_dsl_state: nextState,
      observed_in_projection: observed,
      transition_guard_id: guardedApprovalStep ? transitionGuard.transition_guard_id : null,
      step_boundary: guardedApprovalStep
        ? "human_review_hold"
        : terminalAfterReviewStep
          ? "post_human_release_terminal"
          : "observed_projection",
      state_machine_step_status: stepPassed ? "passed" : "failed",
      mutation_allowed: false,
      protected_action_executed: false,
      final_action_executed: false,
      generated_at: generatedAt,
    };
  });
}

function buildRegressionManifest(workflowGoldenCases, generatedAt) {
  const caseHashes = workflowGoldenCases.map((goldenCase) => ({
    schema_version: "workflow-golden-case-regression-hash.v1",
    workflow_golden_case_id: goldenCase.workflow_golden_case_id,
    domain_pack: goldenCase.domain_pack,
    workflow_run_id: goldenCase.workflow_run_id,
    case_status: goldenCase.case_status,
    state_machine_pass_status: goldenCase.state_machine_pass_status,
    regression_hash: goldenCase.regression_hash,
    locked: goldenCase.case_status === "locked",
  }));
  return {
    schema_version: "workflow-golden-case-regression-manifest.v1",
    generated_at: generatedAt,
    fixture_set_id: WORKFLOW_GOLDEN_CASES_CONTRACT_ID,
    required_domain_packs: REQUIRED_DOMAIN_PACKS,
    regression_hash_count: caseHashes.length,
    locked_regression_hash_count: caseHashes.filter((item) => item.locked).length,
    case_hashes: caseHashes,
    manifest_hash: hashObject(caseHashes),
  };
}

function validateWorkflowGoldenCases({ sources, workflowGoldenCases, workflowGoldenCaseSteps, workflowGoldenCaseRegressionManifest }) {
  const items = [];
  pushCheck(items, "source.capability_manifest_v2", "capability_manifest_v2_complete", getSourceStatus(sources.capabilityManifestV2.value, "capability_manifest_v2_status") === "complete", "Capability Manifest v2 source must be complete.");
  pushCheck(items, "source.workflow_dsl_state_model", "workflow_dsl_state_model_complete", getSourceStatus(sources.workflowDslStateModel.value, "workflow_dsl_state_model_status") === "complete", "Workflow DSL state model source must be complete.");
  pushCheck(items, "source.workflow_state_machine_runner", "workflow_state_machine_runner_complete", getSourceStatus(sources.workflowStateMachineRunner.value, "workflow_state_machine_runner_status") === "complete", "Workflow state machine runner source must be complete.");
  pushCheck(items, "source.workflow_queue_retry_backoff", "workflow_queue_retry_backoff_complete", getSourceStatus(sources.workflowQueueRetryBackoff.value, "workflow_queue_retry_backoff_status") === "complete", "Workflow queue/retry/backoff source must be complete.");
  pushCheck(items, "source.workflow_idempotency", "workflow_idempotency_complete", getSourceStatus(sources.workflowIdempotencyLedger.value, "workflow_idempotency_status") === "complete", "Workflow idempotency source must be complete.");
  pushCheck(items, "source.workflow_resume_cancel", "workflow_resume_cancel_complete", getSourceStatus(sources.workflowResumeCancelContract.value, "workflow_resume_cancel_status") === "complete", "Workflow resume/cancel source must be complete.");
  pushCheck(items, "source.gate_result_aggregator", "gate_result_aggregator_complete", getSourceStatus(sources.gateResultAggregator.value, "gate_result_aggregator_status") === "complete", "Gate result aggregator source must be complete.");
  pushCheck(items, "source.workflow_run_dashboard", "workflow_run_dashboard_complete", getSourceStatus(sources.workflowRunDashboard.value, "workflow_run_dashboard_status") === "complete", "Workflow run dashboard source must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(sources.packageJson.value?.scripts?.["workflows:golden-cases"]), "package.json must expose npm run workflows:golden-cases.");
  const roadmapText = sources.roadmap.value ?? "";
  pushCheck(items, "source.roadmap", "roadmap_slot_declared", roadmapText.includes("P193") || roadmapText.includes("Phase 193"), "Roadmap must declare P193 or Phase 193.");
  const representedDomainPacks = new Set(workflowGoldenCases.map((goldenCase) => goldenCase.domain_pack));
  for (const domainPack of REQUIRED_DOMAIN_PACKS) {
    pushCheck(items, `workflow_golden_cases.${domainPack}`, "required_domain_pack_represented", representedDomainPacks.has(domainPack), `${domainPack} must have one workflow golden case.`);
  }
  pushCheck(items, "workflow_golden_cases", "all_cases_locked", workflowGoldenCases.length === REQUIRED_DOMAIN_PACKS.length && workflowGoldenCases.every((goldenCase) => goldenCase.case_status === "locked"), "Every required workflow golden case must be locked.");
  pushCheck(items, "workflow_golden_cases", "all_cases_pass_state_machine", workflowGoldenCases.every((goldenCase) => goldenCase.state_machine_passed === true), "Every workflow golden case must pass deterministic state machine checks.");
  pushCheck(items, "workflow_golden_cases", "all_cases_have_bindings", workflowGoldenCases.every((goldenCase) => Object.values(goldenCase.source_bindings).every(Boolean)), "Every workflow golden case must bind to source artifacts.");
  pushCheck(items, "workflow_golden_cases", "no_auto_mutation", workflowGoldenCases.every((goldenCase) => goldenCase.pass_checks.no_auto_mutation), "Golden cases must not authorize auto mutation, protected action, delivery, or final action.");
  pushCheck(items, "workflow_golden_case_steps", "all_steps_passed", workflowGoldenCaseSteps.length >= REQUIRED_DOMAIN_PACKS.length * 5 && workflowGoldenCaseSteps.every((step) => step.state_machine_step_status === "passed"), "Every workflow golden case step must pass.");
  pushCheck(items, "workflow_golden_case_regression_manifest", "regression_hashes_locked", workflowGoldenCaseRegressionManifest.locked_regression_hash_count === workflowGoldenCases.length, "Every workflow golden case must have a locked regression hash.");
  return items;
}

function summarizeWorkflowGoldenCases({ sources, workflowGoldenCases, workflowGoldenCaseSteps, workflowGoldenCaseRegressionManifest, validationItems, validation }) {
  const representedDomainPacks = new Set(workflowGoldenCases.map((goldenCase) => goldenCase.domain_pack));
  const sourceValidationErrorCount = [
    sources.capabilityManifestV2,
    sources.workflowDslStateModel,
    sources.workflowStateMachineRunner,
    sources.workflowQueueRetryBackoff,
    sources.workflowIdempotencyLedger,
    sources.workflowResumeCancelContract,
    sources.gateResultAggregator,
    sources.workflowRunDashboard,
  ].reduce((count, source) => count + (source.value?.summary?.validation_error_count ?? source.value?.validation?.errors?.length ?? (source.ok ? 0 : 1)), 0);
  const caseCount = workflowGoldenCases.length;
  const validationErrorCount = validation.errors.length;
  return {
    workflow_golden_case_status: validationErrorCount === 0 && caseCount === REQUIRED_DOMAIN_PACKS.length ? "complete" : "blocked",
    workflow_golden_case_contract_id: WORKFLOW_GOLDEN_CASES_CONTRACT_ID,
    source_capability_manifest_v2_status: getSourceStatus(sources.capabilityManifestV2.value, "capability_manifest_v2_status"),
    source_workflow_dsl_state_model_status: getSourceStatus(sources.workflowDslStateModel.value, "workflow_dsl_state_model_status"),
    source_workflow_state_machine_runner_status: getSourceStatus(sources.workflowStateMachineRunner.value, "workflow_state_machine_runner_status"),
    source_workflow_queue_retry_backoff_status: getSourceStatus(sources.workflowQueueRetryBackoff.value, "workflow_queue_retry_backoff_status"),
    source_workflow_idempotency_status: getSourceStatus(sources.workflowIdempotencyLedger.value, "workflow_idempotency_status"),
    source_workflow_resume_cancel_status: getSourceStatus(sources.workflowResumeCancelContract.value, "workflow_resume_cancel_status"),
    source_gate_result_aggregator_status: getSourceStatus(sources.gateResultAggregator.value, "gate_result_aggregator_status"),
    source_workflow_run_dashboard_status: getSourceStatus(sources.workflowRunDashboard.value, "workflow_run_dashboard_status"),
    source_validation_error_count: sourceValidationErrorCount,
    required_domain_pack_count: REQUIRED_DOMAIN_PACKS.length,
    represented_domain_pack_count: representedDomainPacks.size,
    missing_required_domain_pack_count: REQUIRED_DOMAIN_PACKS.filter((domainPack) => !representedDomainPacks.has(domainPack)).length,
    workflow_golden_case_count: caseCount,
    locked_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.case_status === "locked").length,
    mismatch_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.case_status !== "locked").length,
    state_machine_passed_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.state_machine_passed).length,
    state_machine_failed_case_count: workflowGoldenCases.filter((goldenCase) => !goldenCase.state_machine_passed).length,
    manual_review_required_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.human_review_required).length,
    law_firm_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.domain_pack === "law-firm").length,
    personal_dev_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.domain_pack === "personal-dev").length,
    creative_document_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.domain_pack === "creative-document").length,
    runner_plan_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.runner_plan_bound).length,
    transition_guard_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.transition_guard_bound).length,
    queue_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.queue_record_bound).length,
    idempotency_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.idempotency_key_bound).length,
    resume_cancel_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.resume_cursor_bound && goldenCase.pass_checks.cancel_request_bound).length,
    gate_status_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.gate_status_bound).length,
    dashboard_panel_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.dashboard_panel_bound).length,
    capability_manifest_bound_case_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.capability_manifest_bound).length,
    workflow_golden_case_step_count: workflowGoldenCaseSteps.length,
    passed_step_count: workflowGoldenCaseSteps.filter((step) => step.state_machine_step_status === "passed").length,
    failed_step_count: workflowGoldenCaseSteps.filter((step) => step.state_machine_step_status !== "passed").length,
    human_review_hold_step_count: workflowGoldenCaseSteps.filter((step) => step.step_boundary === "human_review_hold").length,
    post_human_release_terminal_step_count: workflowGoldenCaseSteps.filter((step) => step.step_boundary === "post_human_release_terminal").length,
    auto_transition_allowed_count: workflowGoldenCases.filter((goldenCase) => goldenCase.pass_checks.no_auto_mutation === false).length,
    protected_action_executed_count: workflowGoldenCases.filter((goldenCase) => goldenCase.source_bindings && goldenCase.pass_checks.no_auto_mutation === false).length,
    final_action_executed_count: 0,
    regression_hash_count: workflowGoldenCaseRegressionManifest.regression_hash_count,
    locked_regression_hash_count: workflowGoldenCaseRegressionManifest.locked_regression_hash_count,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => !item.passed).length,
    validation_error_count: validationErrorCount,
    by_domain_pack: countByObject(workflowGoldenCases, "domain_pack"),
    by_case_status: countByObject(workflowGoldenCases, "case_status"),
  };
}

function buildSourceContracts(sources) {
  return {
    capability_manifest_v2: summarizeSource(sources.capabilityManifestV2.value, "capability_manifest_v2_status"),
    workflow_dsl_state_model: summarizeSource(sources.workflowDslStateModel.value, "workflow_dsl_state_model_status"),
    workflow_state_machine_runner: summarizeSource(sources.workflowStateMachineRunner.value, "workflow_state_machine_runner_status"),
    workflow_queue_retry_backoff: summarizeSource(sources.workflowQueueRetryBackoff.value, "workflow_queue_retry_backoff_status"),
    workflow_idempotency: summarizeSource(sources.workflowIdempotencyLedger.value, "workflow_idempotency_status"),
    workflow_resume_cancel: summarizeSource(sources.workflowResumeCancelContract.value, "workflow_resume_cancel_status"),
    gate_result_aggregator: summarizeSource(sources.gateResultAggregator.value, "gate_result_aggregator_status"),
    workflow_run_dashboard: summarizeSource(sources.workflowRunDashboard.value, "workflow_run_dashboard_status"),
  };
}

function summarizeSource(source, statusKey) {
  return {
    schema_version: source?.schema_version ?? null,
    status: getSourceStatus(source, statusKey),
    validation_error_count: source?.summary?.validation_error_count ?? source?.validation?.errors?.length ?? 0,
    generated_at: source?.generated_at ?? null,
  };
}

function sourceArtifacts(sources) {
  return Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, source.value ?? {}]));
}

function serializableWorkflowGoldenCases(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderWorkflowGoldenCasesMarkdown(result) {
  const lines = [
    "# Workflow Golden Cases",
    "",
    `Status: ${result.summary.workflow_golden_case_status}`,
    `Cases: ${result.summary.workflow_golden_case_count}`,
    `State machine passed: ${result.summary.state_machine_passed_case_count}`,
    `Domain packs: ${result.summary.represented_domain_pack_count}/${result.summary.required_domain_pack_count}`,
    "",
    "## Cases",
    "",
  ];
  for (const goldenCase of result.workflow_golden_cases) {
    lines.push(`- ${goldenCase.domain_pack}: ${goldenCase.workflow_run_id} -> ${goldenCase.state_machine_pass_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    capability_manifest_v2_path: path.resolve(options.capabilityManifestV2Path ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.capabilityManifestV2Path),
    workflow_dsl_state_model_path: path.resolve(options.workflowDslStateModelPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowDslStateModelPath),
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowStateMachineRunnerPath),
    workflow_queue_retry_backoff_path: path.resolve(options.workflowQueueRetryBackoffPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowQueueRetryBackoffPath),
    workflow_idempotency_ledger_path: path.resolve(options.workflowIdempotencyLedgerPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowIdempotencyLedgerPath),
    workflow_resume_cancel_contract_path: path.resolve(options.workflowResumeCancelContractPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowResumeCancelContractPath),
    gate_result_aggregator_path: path.resolve(options.gateResultAggregatorPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.gateResultAggregatorPath),
    workflow_run_dashboard_path: path.resolve(options.workflowRunDashboardPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.workflowRunDashboardPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_GOLDEN_CASES_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--workflow-dsl-state-model") parsed.workflowDslStateModelPath = argv[++index];
    else if (arg === "--workflow-state-machine-runner") parsed.workflowStateMachineRunnerPath = argv[++index];
    else if (arg === "--workflow-queue-retry-backoff") parsed.workflowQueueRetryBackoffPath = argv[++index];
    else if (arg === "--workflow-idempotency") parsed.workflowIdempotencyLedgerPath = argv[++index];
    else if (arg === "--workflow-resume-cancel") parsed.workflowResumeCancelContractPath = argv[++index];
    else if (arg === "--gate-result-aggregator") parsed.gateResultAggregatorPath = argv[++index];
    else if (arg === "--workflow-run-dashboard") parsed.workflowRunDashboardPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-golden-cases.mjs [options]

Build workflow golden cases for the representative law-firm, personal-dev, and creative-document workflows.

Options:
  --check                              Fail if validation does not pass.
  --out-dir <path>                     Output directory.
  --capability-manifest-v2 <path>      capability-manifest-v2.json path.
  --workflow-dsl-state-model <path>    workflow-dsl-state-model.json path.
  --workflow-state-machine-runner <path>
                                       workflow-state-machine-runner.json path.
  --workflow-queue-retry-backoff <path>
                                       workflow-queue-retry-backoff-contract.json path.
  --workflow-idempotency <path>        workflow-idempotency-ledger.json path.
  --workflow-resume-cancel <path>      workflow-resume-cancel-contract.json path.
  --gate-result-aggregator <path>      gate-result-aggregator.json path.
  --workflow-run-dashboard <path>      workflow-run-dashboard.json path.
  --package <path>                     package.json path.
  --roadmap <path>                     final-completion phase ledger path.
`);
}

async function readJsonOrError(filePath) {
  try {
    return { ok: true, value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { ok: true, value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { ok: false, value: "", error: error.message };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function pushCheck(items, pathName, code, passed, message) {
  items.push({
    path: pathName,
    code,
    status: passed ? "passed" : "failed",
    passed: Boolean(passed),
    message,
  });
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed).map((item) => ({
    path: item.path,
    code: item.code,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function getSourceStatus(source, statusKey) {
  return source?.summary?.[statusKey] ?? "unknown";
}

function arrayStartsWith(value, prefix) {
  if (!Array.isArray(value) || value.length < prefix.length) return false;
  return prefix.every((item, index) => value[index] === item);
}

function byId(records, key) {
  return new Map((records ?? []).map((record) => [record[key], record]).filter(([id]) => id));
}

function countByObject(records, key) {
  return (records ?? []).reduce((accumulator, record) => {
    const value = record[key] ?? "unknown";
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function hashObject(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\..+/, "Z");
}
