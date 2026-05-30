import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_GATE_FREEZE_OUT_DIR = "artifacts/workflow-gate-freeze/latest";
export const DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS = {
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  workflowDslStateModelPath: "artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workflowQueueRetryBackoffPath: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
  workflowIdempotencyLedgerPath: "artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json",
  workflowResumeCancelContractPath: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
  workflowContextBuilderContractPath: "artifacts/workflow-context-builder/latest/workflow-context-builder-contract.json",
  workflowRetrievalCompilerPath: "artifacts/workflow-retrieval-compiler/latest/workflow-retrieval-compiler.json",
  workflowPromptInjectionBoundaryPath: "artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json",
  workflowPreRunGateFrameworkPath: "artifacts/workflow-pre-run-gates/latest/workflow-pre-run-gate-framework.json",
  workflowInRunGateFrameworkPath: "artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json",
  workflowPostRunGateFrameworkPath: "artifacts/workflow-post-run-gates/latest/workflow-post-run-gate-framework.json",
  gateResultAggregatorPath: "artifacts/gate-result-aggregator/latest/gate-result-aggregator.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  workflowRunDashboardPath: "artifacts/workflow-run-dashboard/latest/workflow-run-dashboard.json",
  workflowGoldenCasesPath: "artifacts/workflow-golden-cases/latest/workflow-golden-cases.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  workflowRunRecordsPath: "artifacts/workflow-run-ledger/latest/workflow-run-records.json",
  workflowEventBindingsPath: "artifacts/workflow-run-ledger/latest/workflow-event-bindings.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  auditTrailRecordsPath: "artifacts/audit-event-ledger/latest/audit-trail-records.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const WORKFLOW_GATE_FREEZE_CONTRACT_ID = "workflow-gate-freeze.v1";
const REQUIRED_DOMAIN_PACKS = ["law-firm", "personal-dev", "creative-document"];

const FREEZE_SOURCE_DEFINITIONS = [
  sourceDefinition("capability_manifest_v2", "Capability Manifest v2", "capabilityManifestV2", "capability_manifest_v2_path", "capability_manifest_v2_status", "complete", "P177"),
  sourceDefinition("pack_manifest_compatibility", "Pack Manifest Compatibility", "packManifestCompatibility", "pack_manifest_compatibility_path", "compatibility_status", "complete", "P178"),
  sourceDefinition("workflow_dsl_state_model", "Workflow DSL State Model", "workflowDslStateModel", "workflow_dsl_state_model_path", "workflow_dsl_state_model_status", "complete", "P179"),
  sourceDefinition("workflow_state_machine_runner", "Workflow State Machine Runner", "workflowStateMachineRunner", "workflow_state_machine_runner_path", "workflow_state_machine_runner_status", "complete", "P180"),
  sourceDefinition("workflow_queue_retry_backoff", "Workflow Queue/Retry/Backoff", "workflowQueueRetryBackoff", "workflow_queue_retry_backoff_path", "workflow_queue_retry_backoff_status", "complete", "P181", "workflow_queue_retry_backoff_contract"),
  sourceDefinition("workflow_idempotency_ledger", "Workflow Idempotency Ledger", "workflowIdempotencyLedger", "workflow_idempotency_ledger_path", "workflow_idempotency_status", "complete", "P182"),
  sourceDefinition("workflow_resume_cancel_contract", "Workflow Resume/Cancel Contract", "workflowResumeCancelContract", "workflow_resume_cancel_contract_path", "workflow_resume_cancel_status", "complete", "P183"),
  sourceDefinition("workflow_context_builder_contract", "Workflow Context Builder Contract", "workflowContextBuilderContract", "workflow_context_builder_contract_path", "workflow_context_builder_status", "complete", "P184"),
  sourceDefinition("workflow_retrieval_compiler", "Workflow Retrieval Compiler", "workflowRetrievalCompiler", "workflow_retrieval_compiler_path", "workflow_retrieval_compiler_status", "complete", "P185"),
  sourceDefinition("workflow_prompt_injection_boundary", "Workflow Prompt Injection Boundary", "workflowPromptInjectionBoundary", "workflow_prompt_injection_boundary_path", "workflow_prompt_injection_boundary_status", "complete", "P186"),
  sourceDefinition("workflow_pre_run_gate_framework", "Workflow Pre-run Gate Framework", "workflowPreRunGateFramework", "workflow_pre_run_gate_framework_path", "workflow_pre_run_gate_framework_status", "complete", "P187"),
  sourceDefinition("workflow_in_run_gate_framework", "Workflow In-run Gate Framework", "workflowInRunGateFramework", "workflow_in_run_gate_framework_path", "workflow_in_run_gate_framework_status", "complete", "P188"),
  sourceDefinition("workflow_post_run_gate_framework", "Workflow Post-run Gate Framework", "workflowPostRunGateFramework", "workflow_post_run_gate_framework_path", "workflow_post_run_gate_framework_status", "complete", "P189"),
  sourceDefinition("gate_result_aggregator", "Gate Result Aggregator", "gateResultAggregator", "gate_result_aggregator_path", "gate_result_aggregator_status", "complete", "P190"),
  sourceDefinition("capability_registry_api", "Capability Registry API", "capabilityRegistryApi", "capability_registry_api_path", "capability_registry_api_status", "complete", "P191"),
  sourceDefinition("workflow_run_dashboard", "Workflow Run Dashboard", "workflowRunDashboard", "workflow_run_dashboard_path", "workflow_run_dashboard_status", "complete", "P192"),
  sourceDefinition("workflow_golden_cases", "Workflow Golden Cases", "workflowGoldenCases", "workflow_golden_cases_path", "workflow_golden_case_status", "complete", "P193"),
  sourceDefinition("workflow_run_ledger", "Workflow Run Ledger", "workflowRunLedger", "workflow_run_ledger_path", "workflow_run_ledger_status", "complete", "P163"),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "auditEventLedger", "audit_event_ledger_path", "audit_event_ledger_status", "complete", "P166"),
];

const REQUIRED_LOOP_STEP_IDS = FREEZE_SOURCE_DEFINITIONS
  .filter((definition) => definition.phase >= "P177" && definition.phase <= "P193")
  .map((definition) => definition.loop_step_id ?? definition.source_id);

export async function runWorkflowGateFreeze(options = {}) {
  const result = await buildWorkflowGateFreeze(options);
  if (options.write !== false) await writeWorkflowGateFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow/Gate freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowGateFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_GATE_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    capabilityManifestV2: await readJsonOrError(inputs.capability_manifest_v2_path),
    packManifestCompatibility: await readJsonOrError(inputs.pack_manifest_compatibility_path),
    workflowDslStateModel: await readJsonOrError(inputs.workflow_dsl_state_model_path),
    workflowStateMachineRunner: await readJsonOrError(inputs.workflow_state_machine_runner_path),
    workflowQueueRetryBackoff: await readJsonOrError(inputs.workflow_queue_retry_backoff_path),
    workflowIdempotencyLedger: await readJsonOrError(inputs.workflow_idempotency_ledger_path),
    workflowResumeCancelContract: await readJsonOrError(inputs.workflow_resume_cancel_contract_path),
    workflowContextBuilderContract: await readJsonOrError(inputs.workflow_context_builder_contract_path),
    workflowRetrievalCompiler: await readJsonOrError(inputs.workflow_retrieval_compiler_path),
    workflowPromptInjectionBoundary: await readJsonOrError(inputs.workflow_prompt_injection_boundary_path),
    workflowPreRunGateFramework: await readJsonOrError(inputs.workflow_pre_run_gate_framework_path),
    workflowInRunGateFramework: await readJsonOrError(inputs.workflow_in_run_gate_framework_path),
    workflowPostRunGateFramework: await readJsonOrError(inputs.workflow_post_run_gate_framework_path),
    gateResultAggregator: await readJsonOrError(inputs.gate_result_aggregator_path),
    capabilityRegistryApi: await readJsonOrError(inputs.capability_registry_api_path),
    workflowRunDashboard: await readJsonOrError(inputs.workflow_run_dashboard_path),
    workflowGoldenCases: await readJsonOrError(inputs.workflow_golden_cases_path),
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    workflowRunRecords: await readJsonOrError(inputs.workflow_run_records_path),
    workflowEventBindings: await readJsonOrError(inputs.workflow_event_bindings_path),
    auditEventLedger: await readJsonOrError(inputs.audit_event_ledger_path),
    auditTrailRecords: await readJsonOrError(inputs.audit_trail_records_path),
    controlPlaneLoop: await readJsonOrError(inputs.control_plane_loop_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const artifacts = sourceArtifacts(sources);
  const freezeSourceStatuses = buildFreezeSourceStatuses({ sources, inputs, generatedAt });
  const workflowGateVerticalSlices = buildWorkflowGateVerticalSlices({ artifacts, generatedAt });
  const workflowGateLoopBindings = buildWorkflowGateLoopBindings({ artifacts, generatedAt });
  const freezeCheckpoints = buildFreezeCheckpoints({
    sources,
    freezeSourceStatuses,
    workflowGateVerticalSlices,
    workflowGateLoopBindings,
    generatedAt,
  });
  const validationItems = validateWorkflowGateFreeze({
    sources,
    freezeSourceStatuses,
    workflowGateVerticalSlices,
    workflowGateLoopBindings,
    freezeCheckpoints,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: WORKFLOW_GATE_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    workflow_gate_freeze_id: `workflow-gate-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources),
    workflow_gate_freeze_contract: buildWorkflowGateFreezeContract(generatedAt),
    workflow_gate_freeze_sources: freezeSourceStatuses,
    workflow_gate_freeze_checkpoints: freezeCheckpoints,
    workflow_gate_vertical_slices: workflowGateVerticalSlices,
    workflow_gate_loop_bindings: workflowGateLoopBindings,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowGateFreeze({
      sources,
      freezeSourceStatuses,
      freezeCheckpoints,
      workflowGateVerticalSlices,
      workflowGateLoopBindings,
      validationItems,
      validation,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowGateFreezeMarkdown(result),
  };
}

export async function writeWorkflowGateFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-gate-freeze.json"), serializableWorkflowGateFreeze(result));
  await writeJson(path.join(outDir, "workflow-gate-freeze-sources.json"), {
    schema_version: "workflow-gate-freeze-sources.v1",
    generated_at: result.generated_at,
    source_count: result.workflow_gate_freeze_sources.length,
    workflow_gate_freeze_sources: result.workflow_gate_freeze_sources,
  });
  await writeJson(path.join(outDir, "workflow-gate-freeze-checkpoints.json"), {
    schema_version: "workflow-gate-freeze-checkpoints.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.workflow_gate_freeze_checkpoints.length,
    workflow_gate_freeze_checkpoints: result.workflow_gate_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "workflow-gate-vertical-slices.json"), {
    schema_version: "workflow-gate-vertical-slices.v1",
    generated_at: result.generated_at,
    workflow_gate_vertical_slice_count: result.workflow_gate_vertical_slices.length,
    workflow_gate_vertical_slices: result.workflow_gate_vertical_slices,
  });
  await writeJson(path.join(outDir, "workflow-gate-loop-bindings.json"), {
    schema_version: "workflow-gate-loop-bindings.v1",
    generated_at: result.generated_at,
    loop_binding_count: result.workflow_gate_loop_bindings.length,
    workflow_gate_loop_bindings: result.workflow_gate_loop_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-gate-freeze-validation-report.v1",
    generated_at: result.generated_at,
    workflow_gate_freeze_id: result.workflow_gate_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowGateFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowGateFreeze(args);
    console.log(`Workflow/Gate freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_gate_freeze_status}`);
    console.log(`Vertical slices: ${result.summary.passed_vertical_slice_count}/${result.summary.workflow_gate_vertical_slice_count}`);
    console.log(`Source contracts: ${result.summary.passed_source_count}/${result.summary.freeze_source_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildWorkflowGateFreezeContract(generatedAt) {
  return {
    schema_version: "workflow-gate-freeze-contract.v1",
    workflow_gate_freeze_contract_id: WORKFLOW_GATE_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    freeze_scope: "capability_to_workflow_to_gate_to_audit",
    source_of_truth: "harness_control_plane",
    required_domain_packs: REQUIRED_DOMAIN_PACKS,
    acceptance_rule: "Each representative workflow must bind capability manifest, workflow run, dashboard/golden case, gate aggregate, and run/audit ledger evidence without enabling mutation.",
    desktop_companion_rule: "Desktop Companion surfaces may read pack, capability, workflow, gate, run, cost, and audit status; protected mutations remain human-gated requests outside this freeze.",
    mutation_policy: "read_only_freeze_no_auto_execution",
  };
}

function buildFreezeSourceStatuses({ sources, inputs, generatedAt }) {
  return FREEZE_SOURCE_DEFINITIONS.map((definition) => {
    const source = sources[definition.source_key];
    const artifact = source?.value ?? {};
    const observedStatus = getSourceStatus(artifact, definition.status_key);
    const validationErrorCount = validationErrorCountFor(artifact, source?.ok);
    const passed = source?.ok === true
      && observedStatus === definition.expected_status
      && validationErrorCount === 0;
    return {
      schema_version: "workflow-gate-freeze-source-status.v1",
      source_id: definition.source_id,
      label: definition.label,
      phase: definition.phase,
      source_path: inputs[definition.path_key],
      source_schema_version: artifact.schema_version ?? null,
      expected_status: definition.expected_status,
      observed_status: observedStatus,
      validation_error_count: validationErrorCount,
      generated_at: artifact.generated_at ?? null,
      source_status: passed ? "passed" : "failed",
      content_hash: source?.ok ? hashObject(artifact.summary ?? artifact) : null,
    };
  });
}

function buildWorkflowGateVerticalSlices({ artifacts, generatedAt }) {
  const goldenCases = artifacts.workflowGoldenCases.workflow_golden_cases ?? [];
  const manifestsByCapability = byId(
    artifacts.capabilityManifestV2.capability_manifest_v2_catalog?.capability_manifests
      ?? artifacts.capabilityManifestV2.capability_manifests
      ?? [],
    "capability_id",
  );
  const capabilityCardsByCapability = byId(artifacts.capabilityRegistryApi.capability_api_cards ?? [], "capability_id");
  const panelsByRun = byId(artifacts.workflowRunDashboard.workflow_run_dashboard_panels ?? [], "workflow_run_id");
  const runRecordsByRun = byId(artifacts.workflowRunRecords.workflow_run_records ?? [], "workflow_run_id");
  const eventBindingsByRun = groupBy(artifacts.workflowEventBindings.workflow_event_bindings ?? [], "workflow_run_id");
  const gateStatusesByRun = byId(artifacts.gateResultAggregator.workflow_gate_status_records ?? [], "workflow_run_id");
  const gateAggregatesByRun = groupBy(artifacts.gateResultAggregator.gate_aggregate_records ?? [], "workflow_run_id");
  const auditRecordsByMatter = groupBy(artifacts.auditTrailRecords.audit_trail_records ?? [], "matter_id");
  const auditEventLedgerComplete = getSourceStatus(artifacts.auditEventLedger, "audit_event_ledger_status") === "complete";
  const workflowRunLedgerComplete = getSourceStatus(artifacts.workflowRunLedger, "workflow_run_ledger_status") === "complete";

  return goldenCases.map((goldenCase) => {
    const runRecord = runRecordsByRun.get(goldenCase.workflow_run_id) ?? {};
    const panel = panelsByRun.get(goldenCase.workflow_run_id) ?? {};
    const manifest = manifestsByCapability.get(goldenCase.capability_id) ?? {};
    const capabilityCard = capabilityCardsByCapability.get(goldenCase.capability_id) ?? {};
    const gateStatus = gateStatusesByRun.get(goldenCase.workflow_run_id) ?? {};
    const gateAggregates = gateAggregatesByRun.get(goldenCase.workflow_run_id) ?? [];
    const eventBindings = eventBindingsByRun.get(goldenCase.workflow_run_id) ?? [];
    const matterId = runRecord.matter_id ?? panel.matter_id ?? null;
    const auditRecords = auditRecordsByMatter.get(matterId) ?? [];
    const sourceBindings = {
      capability_manifest_id: manifest.capability_id ?? goldenCase.source_bindings?.capability_manifest_id ?? null,
      capability_api_card_id: capabilityCard.capability_api_card_id ?? null,
      workflow_golden_case_id: goldenCase.workflow_golden_case_id ?? null,
      workflow_run_dashboard_panel_id: panel.workflow_run_dashboard_panel_id ?? goldenCase.source_bindings?.workflow_run_dashboard_panel_id ?? null,
      workflow_run_record_id: runRecord.workflow_run_record_id ?? null,
      workflow_gate_status_id: gateStatus.workflow_gate_status_id ?? goldenCase.source_bindings?.workflow_gate_status_id ?? null,
      representative_gate_aggregate_record_ids: gateAggregates.slice(0, 5).map((record) => record.gate_aggregate_record_id),
      representative_workflow_event_binding_ids: eventBindings.slice(0, 5).map((record) => record.workflow_event_binding_id),
      representative_audit_trail_record_ids: auditRecords.slice(0, 5).map((record) => record.audit_trail_record_id),
    };
    const passChecks = {
      capability_bound: Boolean(manifest.capability_id && capabilityCard.capability_api_card_id),
      workflow_bound: Boolean(runRecord.workflow_run_record_id && goldenCase.workflow_run_id && goldenCase.case_status === "locked"),
      gate_bound: Boolean(gateStatus.workflow_gate_status_id && gateAggregates.length > 0 && gateStatus.workflow_gate_status === "manual_review_required"),
      audit_bound: auditEventLedgerComplete && workflowRunLedgerComplete && eventBindings.length > 0 && (runRecord.event_binding_count ?? 0) > 0,
      desktop_bound: panel.read_only === true && panel.mutation_allowed === false && panel.workflow_run_dashboard_panel_id,
      human_review_hold_preserved: goldenCase.human_review_required === true && panel.human_review_required === true && gateStatus.human_review_required === true,
      no_auto_mutation: !panel.auto_dequeue_allowed
        && !panel.auto_retry_scheduled
        && !panel.auto_resume_allowed
        && !panel.auto_cancel_allowed
        && !panel.protected_action_executed
        && !panel.final_action_executed
        && !gateStatus.execution_performed_count
        && !gateStatus.final_action_executed_count,
      source_validation_clean: auditEventLedgerComplete && workflowRunLedgerComplete,
    };
    const passed = Object.values(passChecks).every(Boolean);
    const record = {
      schema_version: "workflow-gate-vertical-slice.v1",
      workflow_gate_vertical_slice_id: `workflow-gate-vertical-slice.${slugify(goldenCase.domain_pack)}.${slugify(goldenCase.capability_id)}`,
      domain_pack: goldenCase.domain_pack,
      capability_id: goldenCase.capability_id,
      workflow_id: goldenCase.workflow_id,
      workflow_run_id: goldenCase.workflow_run_id,
      run_ledger_id: runRecord.run_ledger_id ?? panel.run_ledger_id ?? null,
      matter_id: matterId,
      workflow_gate_status: gateStatus.workflow_gate_status ?? goldenCase.workflow_gate_status ?? "unknown",
      workflow_gate_vertical_slice_status: passed ? "passed" : "blocked",
      audit_binding_status: passChecks.audit_bound ? "event_run_audit_bound" : "missing_audit_binding",
      gate_aggregate_record_count: gateAggregates.length,
      workflow_event_binding_count: eventBindings.length,
      audit_trail_record_count: auditRecords.length,
      event_envelope_count: runRecord.event_envelope_ids?.length ?? 0,
      stored_event_count: runRecord.stored_event_ids?.length ?? 0,
      human_review_required: goldenCase.human_review_required === true,
      read_only: panel.read_only === true,
      mutation_allowed: panel.mutation_allowed === true,
      protected_action_executed: panel.protected_action_executed === true || Boolean(gateStatus.protected_action_executed_count),
      final_action_executed: panel.final_action_executed === true || Boolean(gateStatus.final_action_executed_count),
      source_bindings: sourceBindings,
      pass_checks: passChecks,
      freeze_note: "Capability, workflow, gate, dashboard, and run/audit ledger evidence are frozen as a read-only operator slice.",
      recorded_at: generatedAt,
    };
    return {
      ...record,
      workflow_gate_vertical_slice_hash: hashObject({
        workflow_gate_vertical_slice_id: record.workflow_gate_vertical_slice_id,
        workflow_run_id: record.workflow_run_id,
        source_bindings: record.source_bindings,
        pass_checks: record.pass_checks,
        workflow_gate_vertical_slice_status: record.workflow_gate_vertical_slice_status,
      }),
    };
  });
}

function buildWorkflowGateLoopBindings({ artifacts, generatedAt }) {
  const stepsById = byId(artifacts.controlPlaneLoop.step_results ?? [], "step_id");
  return REQUIRED_LOOP_STEP_IDS.map((stepId) => {
    const stepResult = stepsById.get(stepId);
    const passed = stepResult?.status === "passed";
    return {
      schema_version: "workflow-gate-loop-binding.v1",
      workflow_gate_loop_binding_id: `workflow-gate-loop-binding.${slugify(stepId)}`,
      loop_step_id: stepId,
      loop_step_label: stepResult?.label ?? stepId,
      loop_step_category: stepResult?.category ?? "workflow",
      loop_binding_status: passed ? "passed" : stepResult ? "failed" : "missing",
      expected_artifact_count: stepResult?.expected_artifacts?.length ?? 0,
      missing_artifact_count: (stepResult?.expected_artifacts ?? []).filter((artifactPath) => !artifactPath).length,
      exit_code: stepResult?.exit_code ?? null,
      duration_ms: stepResult?.duration_ms ?? null,
      generated_at: generatedAt,
    };
  });
}

function buildFreezeCheckpoints({ sources, freezeSourceStatuses, workflowGateVerticalSlices, workflowGateLoopBindings, generatedAt }) {
  const sourcePassed = freezeSourceStatuses.every((source) => source.source_status === "passed");
  const representedDomainPacks = new Set(workflowGateVerticalSlices.map((slice) => slice.domain_pack));
  const sourceValidationErrorCount = freezeSourceStatuses.reduce((count, source) => count + (source.validation_error_count ?? 0), 0);
  const allSlicesPassed = workflowGateVerticalSlices.length === REQUIRED_DOMAIN_PACKS.length
    && workflowGateVerticalSlices.every((slice) => slice.workflow_gate_vertical_slice_status === "passed");
  const allLoopBindingsPassed = workflowGateLoopBindings.every((binding) => binding.loop_binding_status === "passed");
  const checkpoints = [
    checkpoint("source_contracts_complete", "Source Contracts Complete", sourcePassed && sourceValidationErrorCount === 0, `${freezeSourceStatuses.filter((source) => source.source_status === "passed").length}/${freezeSourceStatuses.length} source contract(s) passed.`, generatedAt),
    checkpoint("domain_pack_coverage_locked", "Domain Pack Coverage Locked", representedDomainPacks.size === REQUIRED_DOMAIN_PACKS.length, `${representedDomainPacks.size}/${REQUIRED_DOMAIN_PACKS.length} required domain pack(s) represented.`, generatedAt),
    checkpoint("capability_workflow_bindings", "Capability To Workflow Bindings", workflowGateVerticalSlices.every((slice) => slice.pass_checks.capability_bound && slice.pass_checks.workflow_bound), `${workflowGateVerticalSlices.filter((slice) => slice.pass_checks.capability_bound && slice.pass_checks.workflow_bound).length} slice(s) bind capability and workflow.`, generatedAt),
    checkpoint("gate_hold_bindings", "Gate Hold Bindings", workflowGateVerticalSlices.every((slice) => slice.pass_checks.gate_bound && slice.pass_checks.human_review_hold_preserved), `${workflowGateVerticalSlices.filter((slice) => slice.pass_checks.gate_bound).length} slice(s) bind manual-review gate state.`, generatedAt),
    checkpoint("audit_event_bindings", "Run/Audit Event Bindings", workflowGateVerticalSlices.every((slice) => slice.pass_checks.audit_bound), `${workflowGateVerticalSlices.filter((slice) => slice.pass_checks.audit_bound).length} slice(s) bind run event evidence and audit source.`, generatedAt),
    checkpoint("desktop_read_only_boundary", "Desktop Read-only Boundary", workflowGateVerticalSlices.every((slice) => slice.pass_checks.desktop_bound), `${workflowGateVerticalSlices.filter((slice) => slice.pass_checks.desktop_bound).length} slice(s) are read-only Desktop Companion candidates.`, generatedAt),
    checkpoint("no_auto_mutation", "No Auto Mutation", workflowGateVerticalSlices.every((slice) => slice.pass_checks.no_auto_mutation && !slice.mutation_allowed && !slice.protected_action_executed && !slice.final_action_executed), "No slice enables auto mutation, protected action, or final execution.", generatedAt),
    checkpoint("control_plane_loop_bindings", "Control-plane Loop Bindings", allLoopBindingsPassed, `${workflowGateLoopBindings.filter((binding) => binding.loop_binding_status === "passed").length}/${workflowGateLoopBindings.length} workflow loop step(s) passed.`, generatedAt),
    checkpoint("workflow_golden_case_source", "Workflow Golden Case Source", getSourceStatus(sources.workflowGoldenCases.value, "workflow_golden_case_status") === "complete" && allSlicesPassed, `${workflowGateVerticalSlices.length} golden-backed vertical slice(s) frozen.`, generatedAt),
  ];
  return checkpoints;
}

function validateWorkflowGateFreeze({ sources, freezeSourceStatuses, workflowGateVerticalSlices, workflowGateLoopBindings, freezeCheckpoints }) {
  const items = [];
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(sources.packageJson.value?.scripts?.["workflows:gate-freeze"]), "package.json must expose npm run workflows:gate-freeze.");
  const roadmapText = sources.roadmap.value ?? "";
  pushCheck(items, "source.roadmap", "roadmap_slot_declared", roadmapText.includes("P194") || roadmapText.includes("Phase 194"), "Roadmap must declare P194 or Phase 194.");
  for (const sourceStatus of freezeSourceStatuses) {
    pushCheck(items, `sources.${sourceStatus.source_id}`, "source_contract_passed", sourceStatus.source_status === "passed", `${sourceStatus.label} source must be passed.`);
  }
  const representedDomainPacks = new Set(workflowGateVerticalSlices.map((slice) => slice.domain_pack));
  for (const domainPack of REQUIRED_DOMAIN_PACKS) {
    pushCheck(items, `workflow_gate_vertical_slices.${domainPack}`, "required_domain_pack_represented", representedDomainPacks.has(domainPack), `${domainPack} must have a workflow/gate vertical slice.`);
  }
  pushCheck(items, "workflow_gate_vertical_slices", "all_slices_passed", workflowGateVerticalSlices.length === REQUIRED_DOMAIN_PACKS.length && workflowGateVerticalSlices.every((slice) => slice.workflow_gate_vertical_slice_status === "passed"), "Every required workflow/gate vertical slice must pass.");
  pushCheck(items, "workflow_gate_vertical_slices", "capability_workflow_gate_audit_bound", workflowGateVerticalSlices.every((slice) => slice.pass_checks.capability_bound && slice.pass_checks.workflow_bound && slice.pass_checks.gate_bound && slice.pass_checks.audit_bound), "Every slice must bind capability, workflow, gate, and audit evidence.");
  pushCheck(items, "workflow_gate_vertical_slices", "desktop_read_only", workflowGateVerticalSlices.every((slice) => slice.read_only === true && slice.mutation_allowed === false), "Every slice must remain read-only for Desktop Companion usage.");
  pushCheck(items, "workflow_gate_vertical_slices", "no_auto_mutation", workflowGateVerticalSlices.every((slice) => slice.pass_checks.no_auto_mutation && !slice.protected_action_executed && !slice.final_action_executed), "No slice may enable auto mutation, protected action, or final action.");
  pushCheck(items, "workflow_gate_loop_bindings", "loop_bindings_passed", workflowGateLoopBindings.length === REQUIRED_LOOP_STEP_IDS.length && workflowGateLoopBindings.every((binding) => binding.loop_binding_status === "passed"), "Every P177-P193 workflow loop binding must be passed.");
  pushCheck(items, "workflow_gate_freeze_checkpoints", "all_checkpoints_passed", freezeCheckpoints.every((checkpointItem) => checkpointItem.checkpoint_status === "passed"), "Every workflow/gate freeze checkpoint must pass.");
  return items;
}

function summarizeWorkflowGateFreeze({ sources, freezeSourceStatuses, freezeCheckpoints, workflowGateVerticalSlices, workflowGateLoopBindings, validationItems, validation }) {
  const representedDomainPacks = new Set(workflowGateVerticalSlices.map((slice) => slice.domain_pack));
  const sourceValidationErrorCount = freezeSourceStatuses.reduce((count, source) => count + (source.validation_error_count ?? 0), 0);
  const validationErrorCount = validation.errors.length;
  const sliceCount = workflowGateVerticalSlices.length;
  const passedSliceCount = workflowGateVerticalSlices.filter((slice) => slice.workflow_gate_vertical_slice_status === "passed").length;
  return {
    workflow_gate_freeze_status: validationErrorCount === 0 && passedSliceCount === REQUIRED_DOMAIN_PACKS.length ? "complete" : "blocked",
    workflow_gate_freeze_contract_id: WORKFLOW_GATE_FREEZE_CONTRACT_ID,
    desktop_companion_readiness_status: validationErrorCount === 0 ? "read_only_ready" : "blocked",
    source_capability_manifest_v2_status: getSourceStatus(sources.capabilityManifestV2.value, "capability_manifest_v2_status"),
    source_pack_manifest_compatibility_status: getSourceStatus(sources.packManifestCompatibility.value, "compatibility_status"),
    source_workflow_dsl_state_model_status: getSourceStatus(sources.workflowDslStateModel.value, "workflow_dsl_state_model_status"),
    source_workflow_state_machine_runner_status: getSourceStatus(sources.workflowStateMachineRunner.value, "workflow_state_machine_runner_status"),
    source_workflow_queue_retry_backoff_status: getSourceStatus(sources.workflowQueueRetryBackoff.value, "workflow_queue_retry_backoff_status"),
    source_workflow_idempotency_status: getSourceStatus(sources.workflowIdempotencyLedger.value, "workflow_idempotency_status"),
    source_workflow_resume_cancel_status: getSourceStatus(sources.workflowResumeCancelContract.value, "workflow_resume_cancel_status"),
    source_workflow_context_builder_status: getSourceStatus(sources.workflowContextBuilderContract.value, "workflow_context_builder_status"),
    source_workflow_retrieval_compiler_status: getSourceStatus(sources.workflowRetrievalCompiler.value, "workflow_retrieval_compiler_status"),
    source_workflow_prompt_injection_boundary_status: getSourceStatus(sources.workflowPromptInjectionBoundary.value, "workflow_prompt_injection_boundary_status"),
    source_workflow_pre_run_gate_framework_status: getSourceStatus(sources.workflowPreRunGateFramework.value, "workflow_pre_run_gate_framework_status"),
    source_workflow_in_run_gate_framework_status: getSourceStatus(sources.workflowInRunGateFramework.value, "workflow_in_run_gate_framework_status"),
    source_workflow_post_run_gate_framework_status: getSourceStatus(sources.workflowPostRunGateFramework.value, "workflow_post_run_gate_framework_status"),
    source_gate_result_aggregator_status: getSourceStatus(sources.gateResultAggregator.value, "gate_result_aggregator_status"),
    source_capability_registry_api_status: getSourceStatus(sources.capabilityRegistryApi.value, "capability_registry_api_status"),
    source_workflow_run_dashboard_status: getSourceStatus(sources.workflowRunDashboard.value, "workflow_run_dashboard_status"),
    source_workflow_golden_cases_status: getSourceStatus(sources.workflowGoldenCases.value, "workflow_golden_case_status"),
    source_workflow_run_ledger_status: getSourceStatus(sources.workflowRunLedger.value, "workflow_run_ledger_status"),
    source_audit_event_ledger_status: getSourceStatus(sources.auditEventLedger.value, "audit_event_ledger_status"),
    source_validation_error_count: sourceValidationErrorCount,
    freeze_source_count: freezeSourceStatuses.length,
    passed_source_count: freezeSourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_count: freezeSourceStatuses.filter((source) => source.source_status !== "passed").length,
    required_domain_pack_count: REQUIRED_DOMAIN_PACKS.length,
    represented_domain_pack_count: representedDomainPacks.size,
    missing_required_domain_pack_count: REQUIRED_DOMAIN_PACKS.filter((domainPack) => !representedDomainPacks.has(domainPack)).length,
    workflow_gate_vertical_slice_count: sliceCount,
    passed_vertical_slice_count: passedSliceCount,
    blocked_vertical_slice_count: workflowGateVerticalSlices.filter((slice) => slice.workflow_gate_vertical_slice_status !== "passed").length,
    capability_bound_slice_count: workflowGateVerticalSlices.filter((slice) => slice.pass_checks.capability_bound).length,
    workflow_bound_slice_count: workflowGateVerticalSlices.filter((slice) => slice.pass_checks.workflow_bound).length,
    gate_bound_slice_count: workflowGateVerticalSlices.filter((slice) => slice.pass_checks.gate_bound).length,
    audit_bound_slice_count: workflowGateVerticalSlices.filter((slice) => slice.pass_checks.audit_bound).length,
    desktop_bound_slice_count: workflowGateVerticalSlices.filter((slice) => slice.pass_checks.desktop_bound).length,
    human_review_required_slice_count: workflowGateVerticalSlices.filter((slice) => slice.human_review_required).length,
    read_only_slice_count: workflowGateVerticalSlices.filter((slice) => slice.read_only).length,
    mutation_allowed_count: workflowGateVerticalSlices.filter((slice) => slice.mutation_allowed).length,
    protected_action_executed_count: workflowGateVerticalSlices.filter((slice) => slice.protected_action_executed).length,
    final_action_executed_count: workflowGateVerticalSlices.filter((slice) => slice.final_action_executed).length,
    gate_aggregate_record_count: workflowGateVerticalSlices.reduce((count, slice) => count + (slice.gate_aggregate_record_count ?? 0), 0),
    workflow_event_binding_count: workflowGateVerticalSlices.reduce((count, slice) => count + (slice.workflow_event_binding_count ?? 0), 0),
    audit_trail_record_count: workflowGateVerticalSlices.reduce((count, slice) => count + (slice.audit_trail_record_count ?? 0), 0),
    loop_binding_count: workflowGateLoopBindings.length,
    passed_loop_binding_count: workflowGateLoopBindings.filter((binding) => binding.loop_binding_status === "passed").length,
    failed_loop_binding_count: workflowGateLoopBindings.filter((binding) => binding.loop_binding_status === "failed").length,
    missing_loop_binding_count: workflowGateLoopBindings.filter((binding) => binding.loop_binding_status === "missing").length,
    freeze_checkpoint_count: freezeCheckpoints.length,
    passed_checkpoint_count: freezeCheckpoints.filter((checkpointItem) => checkpointItem.checkpoint_status === "passed").length,
    failed_checkpoint_count: freezeCheckpoints.filter((checkpointItem) => checkpointItem.checkpoint_status !== "passed").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => !item.passed).length,
    validation_error_count: validationErrorCount,
    by_domain_pack: countByObject(workflowGateVerticalSlices, "domain_pack"),
    by_workflow_gate_status: countByObject(workflowGateVerticalSlices, "workflow_gate_status"),
    by_audit_binding_status: countByObject(workflowGateVerticalSlices, "audit_binding_status"),
  };
}

function buildSourceContracts(sources) {
  return Object.fromEntries(FREEZE_SOURCE_DEFINITIONS.map((definition) => [
    definition.source_id,
    summarizeSource(sources[definition.source_key]?.value, definition.status_key),
  ]));
}

function renderWorkflowGateFreezeMarkdown(result) {
  const lines = [
    "# Workflow/Gate Freeze",
    "",
    `Status: ${result.summary.workflow_gate_freeze_status}`,
    `Contract: ${result.summary.workflow_gate_freeze_contract_id}`,
    `Sources: ${result.summary.passed_source_count}/${result.summary.freeze_source_count}`,
    `Vertical slices: ${result.summary.passed_vertical_slice_count}/${result.summary.workflow_gate_vertical_slice_count}`,
    `Loop bindings: ${result.summary.passed_loop_binding_count}/${result.summary.loop_binding_count}`,
    "",
    "## Vertical Slices",
    "",
  ];
  for (const slice of result.workflow_gate_vertical_slices) {
    lines.push(`- ${slice.domain_pack}: ${slice.capability_id} -> ${slice.workflow_gate_vertical_slice_status} (${slice.audit_binding_status})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    capability_manifest_v2_path: path.resolve(options.capabilityManifestV2Path ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.capabilityManifestV2Path),
    pack_manifest_compatibility_path: path.resolve(options.packManifestCompatibilityPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.packManifestCompatibilityPath),
    workflow_dsl_state_model_path: path.resolve(options.workflowDslStateModelPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowDslStateModelPath),
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowStateMachineRunnerPath),
    workflow_queue_retry_backoff_path: path.resolve(options.workflowQueueRetryBackoffPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowQueueRetryBackoffPath),
    workflow_idempotency_ledger_path: path.resolve(options.workflowIdempotencyLedgerPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowIdempotencyLedgerPath),
    workflow_resume_cancel_contract_path: path.resolve(options.workflowResumeCancelContractPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowResumeCancelContractPath),
    workflow_context_builder_contract_path: path.resolve(options.workflowContextBuilderContractPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowContextBuilderContractPath),
    workflow_retrieval_compiler_path: path.resolve(options.workflowRetrievalCompilerPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowRetrievalCompilerPath),
    workflow_prompt_injection_boundary_path: path.resolve(options.workflowPromptInjectionBoundaryPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowPromptInjectionBoundaryPath),
    workflow_pre_run_gate_framework_path: path.resolve(options.workflowPreRunGateFrameworkPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowPreRunGateFrameworkPath),
    workflow_in_run_gate_framework_path: path.resolve(options.workflowInRunGateFrameworkPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowInRunGateFrameworkPath),
    workflow_post_run_gate_framework_path: path.resolve(options.workflowPostRunGateFrameworkPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowPostRunGateFrameworkPath),
    gate_result_aggregator_path: path.resolve(options.gateResultAggregatorPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.gateResultAggregatorPath),
    capability_registry_api_path: path.resolve(options.capabilityRegistryApiPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.capabilityRegistryApiPath),
    workflow_run_dashboard_path: path.resolve(options.workflowRunDashboardPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowRunDashboardPath),
    workflow_golden_cases_path: path.resolve(options.workflowGoldenCasesPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowGoldenCasesPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowRunLedgerPath),
    workflow_run_records_path: path.resolve(options.workflowRunRecordsPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowRunRecordsPath),
    workflow_event_bindings_path: path.resolve(options.workflowEventBindingsPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.workflowEventBindingsPath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.auditEventLedgerPath),
    audit_trail_records_path: path.resolve(options.auditTrailRecordsPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.auditTrailRecordsPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.controlPlaneLoopPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_GATE_FREEZE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--workflow-dsl-state-model") parsed.workflowDslStateModelPath = argv[++index];
    else if (arg === "--workflow-state-machine-runner") parsed.workflowStateMachineRunnerPath = argv[++index];
    else if (arg === "--workflow-queue-retry-backoff") parsed.workflowQueueRetryBackoffPath = argv[++index];
    else if (arg === "--workflow-idempotency") parsed.workflowIdempotencyLedgerPath = argv[++index];
    else if (arg === "--workflow-resume-cancel") parsed.workflowResumeCancelContractPath = argv[++index];
    else if (arg === "--workflow-context-builder") parsed.workflowContextBuilderContractPath = argv[++index];
    else if (arg === "--workflow-retrieval-compiler") parsed.workflowRetrievalCompilerPath = argv[++index];
    else if (arg === "--workflow-prompt-injection-boundary") parsed.workflowPromptInjectionBoundaryPath = argv[++index];
    else if (arg === "--workflow-pre-run-gates") parsed.workflowPreRunGateFrameworkPath = argv[++index];
    else if (arg === "--workflow-in-run-gates") parsed.workflowInRunGateFrameworkPath = argv[++index];
    else if (arg === "--workflow-post-run-gates") parsed.workflowPostRunGateFrameworkPath = argv[++index];
    else if (arg === "--gate-result-aggregator") parsed.gateResultAggregatorPath = argv[++index];
    else if (arg === "--capability-registry-api") parsed.capabilityRegistryApiPath = argv[++index];
    else if (arg === "--workflow-run-dashboard") parsed.workflowRunDashboardPath = argv[++index];
    else if (arg === "--workflow-golden-cases") parsed.workflowGoldenCasesPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--workflow-run-records") parsed.workflowRunRecordsPath = argv[++index];
    else if (arg === "--workflow-event-bindings") parsed.workflowEventBindingsPath = argv[++index];
    else if (arg === "--audit-event-ledger") parsed.auditEventLedgerPath = argv[++index];
    else if (arg === "--audit-trail-records") parsed.auditTrailRecordsPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-gate-freeze.mjs [options]

Freeze the P177-P193 capability/workflow/gate/audit vertical slice for Desktop-ready read-only operation.

Options:
  --check                              Fail if validation does not pass.
  --out-dir <path>                     Output directory.
  --workflow-golden-cases <path>       workflow-golden-cases.json path.
  --workflow-run-ledger <path>         workflow-run-ledger.json path.
  --workflow-run-records <path>        workflow-run-records.json path.
  --workflow-event-bindings <path>     workflow-event-bindings.json path.
  --audit-event-ledger <path>          audit-event-ledger.json path.
  --audit-trail-records <path>         audit-trail-records.json path.
  --control-plane-loop <path>          control-plane-loop.json path.
  --package <path>                     package.json path.
  --roadmap <path>                     final-completion phase ledger path.
`);
}

function sourceDefinition(sourceId, label, sourceKey, pathKey, statusKey, expectedStatus, phase, loopStepId = sourceId) {
  return {
    source_id: sourceId,
    label,
    source_key: sourceKey,
    path_key: pathKey,
    status_key: statusKey,
    expected_status: expectedStatus,
    phase,
    loop_step_id: loopStepId,
  };
}

function checkpoint(checkpointId, label, passed, message, generatedAt) {
  return {
    schema_version: "workflow-gate-freeze-checkpoint.v1",
    workflow_gate_freeze_checkpoint_id: `workflow-gate-freeze-checkpoint.${slugify(checkpointId)}`,
    checkpoint_id: checkpointId,
    label,
    checkpoint_status: passed ? "passed" : "failed",
    passed: Boolean(passed),
    message,
    generated_at: generatedAt,
  };
}

function sourceArtifacts(sources) {
  return Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, source.value ?? {}]));
}

function summarizeSource(source, statusKey) {
  return {
    schema_version: source?.schema_version ?? null,
    status: getSourceStatus(source, statusKey),
    validation_error_count: validationErrorCountFor(source, Boolean(source)),
    generated_at: source?.generated_at ?? null,
  };
}

function getSourceStatus(source, statusKey) {
  return source?.summary?.[statusKey] ?? "unknown";
}

function validationErrorCountFor(artifact, ok = true) {
  if (!ok) return 1;
  return artifact?.summary?.validation_error_count ?? artifact?.validation?.errors?.length ?? 0;
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

function byId(records, key) {
  return new Map((records ?? []).map((record) => [record[key], record]).filter(([id]) => id));
}

function groupBy(records, key) {
  return (records ?? []).reduce((accumulator, record) => {
    const value = record[key] ?? "unknown";
    if (!accumulator.has(value)) accumulator.set(value, []);
    accumulator.get(value).push(record);
    return accumulator;
  }, new Map());
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

function serializableWorkflowGateFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}
