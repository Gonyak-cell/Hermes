import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OBSERVABILITY_FREEZE_OUT_DIR = "artifacts/observability-freeze/latest";
export const DEFAULT_OBSERVABILITY_FREEZE_INPUTS = {
  eventEnvelopeLedgerPath: "artifacts/event-envelope-ledger/latest/event-envelope-ledger.json",
  eventTypeRegistryPath: "artifacts/event-type-registry/latest/event-type-registry.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  eventCorrelationLedgerPath: "artifacts/event-correlation/latest/event-correlation-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  toolInvocationLedgerPath: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  policySnapshotEventBindingPath: "artifacts/policy-snapshot-event-bindings/latest/policy-snapshot-event-binding.json",
  costRecordProjectionPath: "artifacts/cost-record-projection/latest/cost-record-projection.json",
  tokenUsageProjectionPath: "artifacts/token-usage-projection/latest/token-usage-projection.json",
  observabilityTraceProjectionPath: "artifacts/observability-trace-projection/latest/observability-trace-projection.json",
  errorRetryLedgerPath: "artifacts/error-retry-ledger/latest/error-retry-ledger.json",
  eventReplayHarnessPath: "artifacts/event-replay/latest/event-replay-harness.json",
  retentionArchiveLedgerPath: "artifacts/retention-archive/latest/retention-archive-ledger.json",
  ledgerApiDashboardPath: "artifacts/ledger-api-dashboard/latest/ledger-api-dashboard.json",
  ledgerGoldenFixturesPath: "artifacts/ledger-golden-fixtures/latest/ledger-golden-fixtures.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
};

const OBSERVABILITY_FREEZE_CONTRACT_ID = "observability-freeze.v1";
const REQUIRED_LOOP_STEP_IDS = [
  "event_envelope_ledger",
  "event_type_registry",
  "append_only_event_store",
  "event_correlation_ledger",
  "workflow_run_ledger",
  "agent_run_ledger",
  "tool_invocation_ledger",
  "audit_event_ledger",
  "policy_snapshot_event_binding",
  "cost_record_projection",
  "token_usage_projection",
  "observability_trace_projection",
  "error_retry_ledger",
  "event_replay_harness",
  "retention_archive_ledger",
  "ledger_api_dashboard",
  "ledger_golden_fixtures",
];

const OBSERVABILITY_SOURCE_DEFINITIONS = [
  sourceDefinition("event_envelope_ledger", "Event Envelope Ledger", "eventEnvelopeLedgerPath", "P159", "event", "event_envelope_status", "complete"),
  sourceDefinition("event_type_registry", "Event Type Registry", "eventTypeRegistryPath", "P160", "event", "event_type_registry_status", "complete"),
  sourceDefinition("append_only_event_store", "Append-only Event Store", "appendOnlyEventStorePath", "P161", "event", "event_store_status", "complete"),
  sourceDefinition("event_correlation_ledger", "Event Correlation Ledger", "eventCorrelationLedgerPath", "P162", "event", "event_correlation_status", "complete"),
  sourceDefinition("workflow_run_ledger", "Workflow Run Ledger", "workflowRunLedgerPath", "P163", "run", "workflow_run_ledger_status", "complete"),
  sourceDefinition("agent_run_ledger", "Agent Run Ledger", "agentRunLedgerPath", "P164", "run", "agent_run_ledger_status", "complete"),
  sourceDefinition("tool_invocation_ledger", "Tool Invocation Ledger", "toolInvocationLedgerPath", "P165", "run", "tool_invocation_ledger_status", "complete"),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "auditEventLedgerPath", "P166", "audit", "audit_event_ledger_status", "complete"),
  sourceDefinition("policy_snapshot_event_binding", "Policy Snapshot Event Binding", "policySnapshotEventBindingPath", "P167", "policy", "policy_snapshot_event_binding_status", "complete"),
  sourceDefinition("cost_record_projection", "Cost Record Projection", "costRecordProjectionPath", "P168", "cost", "cost_record_projection_status", "complete"),
  sourceDefinition("token_usage_projection", "Token Usage Projection", "tokenUsageProjectionPath", "P169", "cost", "token_usage_projection_status", "complete"),
  sourceDefinition("observability_trace_projection", "Observability Trace Projection", "observabilityTraceProjectionPath", "P170", "trace", "observability_trace_projection_status", "complete"),
  sourceDefinition("error_retry_ledger", "Error/Retry Ledger", "errorRetryLedgerPath", "P171", "error", "error_retry_ledger_status", "complete"),
  sourceDefinition("event_replay_harness", "Event Replay Harness", "eventReplayHarnessPath", "P172", "replay", "event_replay_status", "complete"),
  sourceDefinition("retention_archive_ledger", "Retention/Archive Ledger", "retentionArchiveLedgerPath", "P173", "retention", "retention_archive_status", "complete"),
  sourceDefinition("ledger_api_dashboard", "Ledger API Dashboard", "ledgerApiDashboardPath", "P174", "api", "ledger_api_dashboard_status", "complete"),
  sourceDefinition("ledger_golden_fixtures", "Ledger Golden Fixtures", "ledgerGoldenFixturesPath", "P175", "fixture", "ledger_golden_fixture_status", "complete"),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "controlPlaneLoopPath", "P176", "control_plane", "overall_status", "passed"),
];

const SUPPORT_SOURCE_DEFINITIONS = [
  sourceDefinition("control_plane_loop_source", "Control Plane Loop Source", "controlPlaneLoopSourcePath", "P176", "support", null, null, "text"),
  sourceDefinition("package_json", "Package Scripts", "packagePath", "P176", "support", null, null, "json"),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "roadmapPath", "P176", "support", null, null, "text"),
  sourceDefinition("review_api_source", "Review API Source", "reviewApiPath", "P176", "support", null, null, "text"),
  sourceDefinition("review_dashboard_source", "Review Dashboard Source", "reviewDashboardPath", "P176", "support", null, null, "text"),
];

export async function runObservabilityFreeze(options = {}) {
  const result = await buildObservabilityFreeze(options);
  if (options.write !== false) await writeObservabilityFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Observability freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildObservabilityFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OBSERVABILITY_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const freezeSources = await readSources(OBSERVABILITY_SOURCE_DEFINITIONS, inputs);
  const supportSources = await readSources(SUPPORT_SOURCE_DEFINITIONS, inputs);
  const artifacts = Object.fromEntries([...freezeSources, ...supportSources].map((source) => [source.source_id, source.data]));
  const freezeSourceStatuses = freezeSources.map((source) => buildFreezeSourceStatus(source));
  const controlPlaneLoopBindings = buildControlPlaneLoopBindings(artifacts, generatedAt);
  const representativeTraces = buildRepresentativeTraces(artifacts, controlPlaneLoopBindings, generatedAt);
  const freezeCheckpoints = buildFreezeCheckpoints({ artifacts, freezeSourceStatuses, controlPlaneLoopBindings, representativeTraces });
  const validationItems = freezeCheckpoints.map(({ checkpoint_id: checkpointId, check_id: checkId, status, message, ...details }) => ({
    path: checkpointId,
    check_id: checkId,
    status,
    message,
    ...details,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeFreeze({
    freezeSourceStatuses,
    controlPlaneLoopBindings,
    representativeTraces,
    freezeCheckpoints,
    artifacts,
    validation,
  });
  const result = {
    schema_version: OBSERVABILITY_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    observability_freeze_id: `observability-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    observability_freeze_status: summary.observability_freeze_status,
    safe_handling: {
      freeze_report_only: true,
      source_artifact_mutation_allowed: false,
      protected_actions_executed: false,
      external_delivery_executed: false,
      external_model_call_executed: false,
      auto_approval_allowed: false,
      retention_or_deletion_executed: false,
    },
    inputs,
    freeze_scope: {
      track: "Event, Run Ledger, Audit, Observability",
      frozen_slots: ["P159", "P160", "P161", "P162", "P163", "P164", "P165", "P166", "P167", "P168", "P169", "P170", "P171", "P172", "P173", "P174", "P175", "P176"],
      source_phase_range: "Phase 159-175",
      loop_binding_range: "Phase 159-175 control-plane loop steps",
      next_planned_slot: "P177",
      next_track: "Briefing, deadlines, and attorney review surfaces",
    },
    observability_freeze_contract: buildObservabilityFreezeContract(generatedAt),
    freeze_source_statuses: freezeSourceStatuses,
    freeze_checkpoints: freezeCheckpoints,
    representative_traces: representativeTraces,
    control_plane_loop_bindings: controlPlaneLoopBindings,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderObservabilityFreezeMarkdown(result),
  };
}

export async function writeObservabilityFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "observability-freeze.json"), serializableObservabilityFreeze(result));
  await writeJson(path.join(outDir, "freeze-source-statuses.json"), {
    schema_version: "observability-freeze-source-statuses.v1",
    generated_at: result.generated_at,
    freeze_source_status_count: result.freeze_source_statuses.length,
    freeze_source_statuses: result.freeze_source_statuses,
  });
  await writeJson(path.join(outDir, "freeze-checkpoints.json"), {
    schema_version: "observability-freeze-checkpoints.v1",
    generated_at: result.generated_at,
    freeze_checkpoint_count: result.freeze_checkpoints.length,
    freeze_checkpoints: result.freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "representative-traces.json"), {
    schema_version: "observability-freeze-traces.v1",
    generated_at: result.generated_at,
    representative_trace_count: result.representative_traces.length,
    representative_traces: result.representative_traces,
  });
  await writeJson(path.join(outDir, "control-plane-loop-bindings.json"), {
    schema_version: "observability-freeze-loop-bindings.v1",
    generated_at: result.generated_at,
    control_plane_loop_binding_count: result.control_plane_loop_bindings.length,
    control_plane_loop_bindings: result.control_plane_loop_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "observability-freeze-validation-report.v1",
    generated_at: result.generated_at,
    observability_freeze_id: result.observability_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runObservabilityFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runObservabilityFreeze(args);
    console.log(`Observability freeze written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.observability_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_freeze_source_count}/${result.summary.freeze_source_count}`);
    console.log(`Loop bindings: ${result.summary.passed_control_plane_loop_binding_count}/${result.summary.control_plane_loop_binding_count}`);
    console.log(`Representative traces: ${result.summary.complete_representative_trace_count}/${result.summary.representative_trace_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readSources(definitions, inputs) {
  const sources = [];
  for (const definition of definitions) {
    const configuredPath = inputs[snakeCase(definition.option)];
    const readResult = definition.format === "text"
      ? await readTextOrError(configuredPath)
      : await readJsonOrError(configuredPath);
    const summary = readResult.value?.summary ?? {};
    sources.push({
      ...definition,
      path: configuredPath,
      available: readResult.ok,
      schema_version: readResult.value?.schema_version ?? null,
      generated_at: readResult.value?.generated_at ?? null,
      summary,
      observed_status: definition.status_key ? summary[definition.status_key] ?? readResult.value?.[definition.status_key] ?? null : readResult.ok ? "available" : null,
      validation_error_count: sourceValidationErrors(readResult.value),
      content_hash: readResult.raw ? sha256(readResult.raw) : null,
      data: readResult.value,
      error: readResult.error,
    });
  }
  return sources;
}

function buildFreezeSourceStatus(source) {
  const statusMatches = source.expected_status === null || source.observed_status === source.expected_status;
  return {
    schema_version: "observability-freeze-source-status.v1",
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    source_group: source.source_group,
    path: source.path,
    available: source.available,
    schema_version_observed: source.schema_version,
    generated_at: source.generated_at,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: source.observed_status,
    source_status: source.available && statusMatches && source.validation_error_count === 0 ? "passed" : "failed",
    validation_error_count: source.validation_error_count,
    content_hash: source.content_hash,
    error: source.error,
  };
}

function buildControlPlaneLoopBindings(artifacts, generatedAt) {
  const loopSourceText = artifacts.control_plane_loop_source ?? "";
  const stepResults = artifacts.control_plane_loop?.step_results ?? [];
  const loopPassed = artifacts.control_plane_loop?.summary?.overall_status === "passed" || artifacts.control_plane_loop?.loop_status === "passed";
  return REQUIRED_LOOP_STEP_IDS.map((stepId) => {
    const stepResult = stepResults.find((item) => item.step_id === stepId);
    const stepDeclared = loopSourceText.includes(`step("${stepId}"`);
    const stepStatus = stepResult?.status ?? "not_executed_in_current_loop_artifact";
    return {
      schema_version: "observability-freeze-loop-binding.v1",
      binding_id: `observability-freeze-loop-binding.${stepId}`,
      generated_at: generatedAt,
      step_id: stepId,
      step_declared: stepDeclared,
      source_loop_status: loopPassed ? "passed" : "blocked",
      observed_step_status: stepStatus,
      loop_binding_status: stepDeclared && loopPassed ? "passed" : "missing",
      required_artifact_paths: normalizeArtifactPaths(stepResult?.expected_artifacts ?? []),
    };
  });
}

function normalizeArtifactPaths(artifacts) {
  return artifacts
    .map((artifact) => {
      if (typeof artifact === "string") return artifact;
      if (artifact && typeof artifact.path === "string") return artifact.path;
      return null;
    })
    .filter(Boolean);
}

function buildRepresentativeTraces(artifacts, controlPlaneLoopBindings, generatedAt) {
  const summaries = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value?.summary ?? {}]));
  const loop = Object.fromEntries(controlPlaneLoopBindings.map((binding) => [binding.step_id, binding.loop_binding_status]));
  const traces = [
    traceCase({
      traceId: "run-ledger-loop-binding",
      traceKind: "run",
      label: "Workflow, agent, and tool run ledger loop binding",
      sourceArtifactIds: ["workflow_run_ledger", "agent_run_ledger", "tool_invocation_ledger"],
      controlPlaneStepIds: ["workflow_run_ledger", "agent_run_ledger", "tool_invocation_ledger"],
      metrics: [
        assertion("workflow_run_record_count", summaries.workflow_run_ledger.workflow_run_record_count, "gte", 1),
        assertion("agent_run_record_count", summaries.agent_run_ledger.agent_run_record_count, "gte", 1),
        assertion("tool_invocation_record_count", summaries.tool_invocation_ledger.tool_invocation_record_count, "gte", 1),
        assertion("terminal_state_aligned_count", summaries.workflow_run_ledger.terminal_state_aligned_count, "equals", summaries.workflow_run_ledger.workflow_run_record_count ?? null),
        assertion("missing_event_binding_count", summaries.tool_invocation_ledger.missing_event_binding_count, "equals", 0),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "audit-separation-loop-binding",
      traceKind: "audit",
      label: "Audit trail separation and protected action guardrail",
      sourceArtifactIds: ["audit_event_ledger", "append_only_event_store"],
      controlPlaneStepIds: ["audit_event_ledger", "append_only_event_store"],
      metrics: [
        assertion("audit_trail_record_count", summaries.audit_event_ledger.audit_trail_record_count, "gte", 1),
        assertion("mixed_observability_record_count", summaries.audit_event_ledger.mixed_observability_record_count, "equals", 0),
        assertion("separated_audit_record_count", summaries.audit_event_ledger.separated_audit_record_count, "equals", summaries.audit_event_ledger.audit_trail_record_count ?? null),
        assertion("stored_event_count", summaries.append_only_event_store.stored_event_count, "gte", 1),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "cost-token-loop-binding",
      traceKind: "cost",
      label: "Cost and token usage projection loop binding",
      sourceArtifactIds: ["cost_record_projection", "token_usage_projection"],
      controlPlaneStepIds: ["cost_record_projection", "token_usage_projection"],
      metrics: [
        assertion("projected_cost_record_count", summaries.cost_record_projection.projected_cost_record_count, "gte", 1),
        assertion("projected_token_usage_record_count", summaries.token_usage_projection.projected_token_usage_record_count, "gte", 1),
        assertion("missing_run_cost_rollup_count", summaries.cost_record_projection.missing_run_cost_rollup_count, "equals", 0),
        assertion("missing_provider_cost_record_count", summaries.token_usage_projection.missing_provider_cost_record_count, "equals", 0),
        assertion("total_token_count", summaries.token_usage_projection.total_token_count, "gte", 1),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "trace-projection-loop-binding",
      traceKind: "trace",
      label: "Observability trace projection component binding",
      sourceArtifactIds: ["event_correlation_ledger", "observability_trace_projection"],
      controlPlaneStepIds: ["event_correlation_ledger", "observability_trace_projection"],
      metrics: [
        assertion("observability_trace_record_count", summaries.observability_trace_projection.observability_trace_record_count, "gte", 1),
        assertion("unknown_workflow_trace_binding_count", summaries.observability_trace_projection.unknown_workflow_trace_binding_count, "equals", 0),
        assertion("unknown_agent_trace_binding_count", summaries.observability_trace_projection.unknown_agent_trace_binding_count, "equals", 0),
        assertion("unknown_gate_trace_binding_count", summaries.observability_trace_projection.unknown_gate_trace_binding_count, "equals", 0),
        assertion("unknown_output_trace_binding_count", summaries.observability_trace_projection.unknown_output_trace_binding_count, "equals", 0),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "error-retry-loop-binding",
      traceKind: "error",
      label: "Error/retry ledger human-review boundary",
      sourceArtifactIds: ["error_retry_ledger", "observability_trace_projection"],
      controlPlaneStepIds: ["error_retry_ledger", "observability_trace_projection"],
      metrics: [
        assertion("projected_error_record_count", summaries.error_retry_ledger.projected_error_record_count, "gte", 1),
        assertion("trace_bound_error_count", summaries.error_retry_ledger.trace_bound_error_count, "gte", 1),
        assertion("missing_trace_binding_count", summaries.error_retry_ledger.missing_trace_binding_count, "equals", 0),
        assertion("auto_retry_scheduled_count", summaries.error_retry_ledger.auto_retry_scheduled_count, "equals", 0),
        assertion("human_approval_required_resume_count", summaries.error_retry_ledger.human_approval_required_resume_count, "gte", 1),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "replay-retention-loop-binding",
      traceKind: "replay_retention",
      label: "Replay parity and retention archive guardrail",
      sourceArtifactIds: ["event_replay_harness", "retention_archive_ledger"],
      controlPlaneStepIds: ["event_replay_harness", "retention_archive_ledger"],
      metrics: [
        assertion("replayed_event_count", summaries.event_replay_harness.replayed_event_count, "equals", summaries.event_replay_harness.source_stored_event_count ?? null),
        assertion("hash_chain_mismatch_count", summaries.event_replay_harness.hash_chain_mismatch_count, "equals", 0),
        assertion("deletion_allowed_candidate_count", summaries.retention_archive_ledger.deletion_allowed_candidate_count, "equals", 0),
        assertion("missing_legal_hold_binding_count", summaries.retention_archive_ledger.missing_legal_hold_binding_count, "equals", 0),
      ],
      loop,
      generatedAt,
    }),
    traceCase({
      traceId: "ledger-surface-golden-loop-binding",
      traceKind: "surface_fixture",
      label: "Ledger API/dashboard and golden fixture freeze binding",
      sourceArtifactIds: ["ledger_api_dashboard", "ledger_golden_fixtures"],
      controlPlaneStepIds: ["ledger_api_dashboard", "ledger_golden_fixtures"],
      metrics: [
        assertion("ledger_dashboard_panel_count", summaries.ledger_api_dashboard.ledger_dashboard_panel_count, "equals", 5),
        assertion("blocked_panel_count", summaries.ledger_api_dashboard.blocked_panel_count, "equals", 0),
        assertion("locked_case_count", summaries.ledger_golden_fixtures.locked_case_count, "equals", summaries.ledger_golden_fixtures.ledger_golden_case_count ?? null),
        assertion("protected_action_case_count", summaries.ledger_golden_fixtures.protected_action_case_count, "equals", 0),
      ],
      loop,
      generatedAt,
    }),
  ];
  return traces.sort((left, right) => left.trace_id.localeCompare(right.trace_id));
}

function traceCase({ traceId, traceKind, label, sourceArtifactIds, controlPlaneStepIds, metrics, loop, generatedAt }) {
  const loopStatuses = controlPlaneStepIds.map((stepId) => ({
    step_id: stepId,
    loop_binding_status: loop[stepId] ?? "missing",
  }));
  const loopComplete = loopStatuses.every((item) => item.loop_binding_status === "passed");
  const metricsPassed = metrics.every((item) => item.assertion_status === "passed");
  return {
    schema_version: "observability-freeze-trace.v1",
    trace_id: `observability-freeze-trace.${traceId}`,
    trace_kind: traceKind,
    label,
    generated_at: generatedAt,
    source_artifact_ids: sourceArtifactIds,
    control_plane_step_ids: controlPlaneStepIds,
    control_plane_loop_statuses: loopStatuses,
    metric_assertions: metrics,
    trace_status: loopComplete && metricsPassed ? "complete" : "blocked",
    human_review_required: true,
    client_facing_ready: false,
    delivery_blocked: true,
    external_transfer_blocked: true,
    protected_action_executed: false,
    review_note: "Observability freeze traces are internal operational evidence only; attorney review remains required before legal, client-facing, retry, retention, delivery, deletion, or filing decisions.",
  };
}

function buildFreezeCheckpoints({ artifacts, freezeSourceStatuses, controlPlaneLoopBindings, representativeTraces }) {
  const checkpoints = [];
  const packageJson = artifacts.package_json ?? {};
  const roadmapText = artifacts.implementation_roadmap ?? "";
  const reviewApiText = artifacts.review_api_source ?? "";
  const reviewDashboardText = artifacts.review_dashboard_source ?? "";
  const loopStatus = artifacts.control_plane_loop?.summary?.overall_status ?? artifacts.control_plane_loop?.loop_status ?? "unknown";
  const sourceValidationErrors = freezeSourceStatuses.reduce((sum, source) => sum + source.validation_error_count, 0);
  const summaries = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value?.summary ?? {}]));
  const traceFailureDetails = representativeTraces
    .filter((trace) => trace.trace_status !== "complete")
    .map((trace) => {
      const failedMetrics = trace.metric_assertions
        .filter((metric) => metric.assertion_status !== "passed")
        .map((metric) => metric.metric_key)
        .join(",");
      return `${trace.trace_id}${failedMetrics ? `(${failedMetrics})` : ""}`;
    })
    .join("; ");

  pushCheckpoint(checkpoints, "freeze_sources", "all_sources_passed", freezeSourceStatuses.every((source) => source.source_status === "passed"), "All observability source artifacts must be complete and validation-clean.");
  pushCheckpoint(checkpoints, "freeze_sources", "source_validation_clean", sourceValidationErrors === 0, "Observability freeze sources must not carry validation errors.");
  pushCheckpoint(checkpoints, "control_plane_loop", "loop_artifact_passed", loopStatus === "passed", "Control-plane loop artifact must report passed.");
  pushCheckpoint(checkpoints, "control_plane_loop", "required_steps_declared", controlPlaneLoopBindings.every((binding) => binding.step_declared), "Every P159-P175 observability step must be declared in the default control-plane loop.");
  pushCheckpoint(checkpoints, "control_plane_loop", "required_bindings_passed", controlPlaneLoopBindings.every((binding) => binding.loop_binding_status === "passed"), "Every P159-P175 observability step must be bound to a passed control-plane loop.");
  pushCheckpoint(checkpoints, "event_plane", "event_store_complete", (summaries.append_only_event_store.stored_event_count ?? 0) > 0 && (summaries.append_only_event_store.sequence_gap_count ?? 1) === 0, "Append-only event store must contain contiguous stored events.");
  pushCheckpoint(checkpoints, "run_plane", "run_ledgers_complete", (summaries.workflow_run_ledger.workflow_run_record_count ?? 0) > 0 && (summaries.agent_run_ledger.agent_run_record_count ?? 0) > 0 && (summaries.tool_invocation_ledger.tool_invocation_record_count ?? 0) > 0, "Workflow, agent, and tool invocation ledgers must have run records.");
  pushCheckpoint(checkpoints, "audit_plane", "audit_separated", (summaries.audit_event_ledger.audit_trail_record_count ?? 0) > 0 && (summaries.audit_event_ledger.mixed_observability_record_count ?? 1) === 0, "Audit event ledger must preserve a separated audit trail.");
  pushCheckpoint(checkpoints, "cost_plane", "cost_token_bound", (summaries.cost_record_projection.projected_cost_record_count ?? 0) > 0 && (summaries.token_usage_projection.projected_token_usage_record_count ?? 0) > 0 && (summaries.token_usage_projection.missing_provider_cost_record_count ?? 1) === 0, "Cost and token projections must be populated and provider-bound.");
  pushCheckpoint(checkpoints, "trace_plane", "trace_components_bound", (summaries.observability_trace_projection.observability_trace_record_count ?? 0) > 0 && (summaries.observability_trace_projection.unknown_workflow_trace_binding_count ?? 1) === 0 && (summaries.observability_trace_projection.unknown_agent_trace_binding_count ?? 1) === 0, "Trace projection must bind workflow and agent components.");
  pushCheckpoint(checkpoints, "error_plane", "error_retry_human_review_bound", (summaries.error_retry_ledger.projected_error_record_count ?? 0) > 0 && (summaries.error_retry_ledger.auto_retry_scheduled_count ?? 1) === 0 && (summaries.error_retry_ledger.human_approval_required_resume_count ?? 0) > 0, "Error/retry ledger must preserve human-review resume boundaries and never auto-schedule retries.");
  pushCheckpoint(checkpoints, "replay_retention", "replay_and_retention_safe", (summaries.event_replay_harness.hash_chain_mismatch_count ?? 1) === 0 && (summaries.retention_archive_ledger.deletion_allowed_candidate_count ?? 1) === 0, "Replay must have no hash drift and retention must not authorize deletion.");
  pushCheckpoint(checkpoints, "ledger_surface", "ledger_surface_complete", (summaries.ledger_api_dashboard.blocked_panel_count ?? 1) === 0 && (summaries.ledger_golden_fixtures.mismatch_case_count ?? 1) === 0, "Ledger API/dashboard and golden fixtures must be complete.");
  pushCheckpoint(checkpoints, "representative_traces", "traces_complete", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.trace_status === "complete"), traceFailureDetails ? `Representative observability freeze traces must be complete. Blocked traces: ${traceFailureDetails}.` : "Representative observability freeze traces must be complete.");
  pushCheckpoint(checkpoints, "representative_traces", "human_review_guardrail", representativeTraces.every((trace) => trace.human_review_required && trace.client_facing_ready === false && trace.delivery_blocked && trace.external_transfer_blocked && trace.protected_action_executed === false), "Representative traces must preserve human review and block client-facing delivery/transfer/protected actions.");
  pushCheckpoint(checkpoints, "package_json", "freeze_script_registered", Boolean(packageJson.scripts?.["observability:freeze"]), "package.json must expose npm run observability:freeze.");
  pushCheckpoint(checkpoints, "roadmap", "phase_176_recorded", String(roadmapText).includes("Phase 176: Observability Freeze") || String(roadmapText).includes("| P176 | Observability freeze |"), "Roadmap must record the Phase 176 observability freeze slot.");
  pushCheckpoint(checkpoints, "review_dashboard", "observability_freeze_stage_present", String(reviewDashboardText).includes("observability_freeze") && String(reviewDashboardText).includes("Observability Freeze"), "Review dashboard must expose the Observability Freeze stage.");
  pushCheckpoint(checkpoints, "review_api", "observability_freeze_routes_present", [
    "/api/observability-freezes",
    "/api/observability-freeze-sources",
    "/api/observability-freeze-checkpoints",
    "/api/observability-freeze-traces",
    "/api/observability-freeze-loop-bindings",
    "/api/observability-freeze-validations",
  ].every((routePath) => String(reviewApiText).includes(`"${routePath}"`)), "Review API must expose observability freeze routes.");
  return checkpoints;
}

function summarizeFreeze({ freezeSourceStatuses, controlPlaneLoopBindings, representativeTraces, freezeCheckpoints, artifacts, validation }) {
  const summaries = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value?.summary ?? {}]));
  const sourceValidationErrorCount = freezeSourceStatuses.reduce((sum, source) => sum + source.validation_error_count, 0);
  const metricAssertions = representativeTraces.flatMap((trace) => trace.metric_assertions ?? []);
  const status = validation.valid && representativeTraces.every((trace) => trace.trace_status === "complete") ? "complete" : "blocked";
  return {
    observability_freeze_status: status,
    observability_freeze_contract_id: OBSERVABILITY_FREEZE_CONTRACT_ID,
    freeze_source_count: freezeSourceStatuses.length,
    passed_freeze_source_count: freezeSourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_freeze_source_count: freezeSourceStatuses.filter((source) => source.source_status !== "passed").length,
    source_validation_error_count: sourceValidationErrorCount,
    freeze_checkpoint_count: freezeCheckpoints.length,
    passed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length,
    failed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status !== "passed").length,
    representative_trace_count: representativeTraces.length,
    complete_representative_trace_count: representativeTraces.filter((trace) => trace.trace_status === "complete").length,
    blocked_representative_trace_count: representativeTraces.filter((trace) => trace.trace_status !== "complete").length,
    metric_assertion_count: metricAssertions.length,
    passed_metric_assertion_count: metricAssertions.filter((assertionItem) => assertionItem.assertion_status === "passed").length,
    failed_metric_assertion_count: metricAssertions.filter((assertionItem) => assertionItem.assertion_status !== "passed").length,
    control_plane_loop_binding_count: controlPlaneLoopBindings.length,
    passed_control_plane_loop_binding_count: controlPlaneLoopBindings.filter((binding) => binding.loop_binding_status === "passed").length,
    missing_control_plane_loop_binding_count: controlPlaneLoopBindings.filter((binding) => binding.loop_binding_status !== "passed").length,
    trace_projection_count: summaries.observability_trace_projection.observability_trace_record_count ?? 0,
    cost_record_count: summaries.cost_record_projection.projected_cost_record_count ?? 0,
    token_projection_count: summaries.token_usage_projection.projected_token_usage_record_count ?? 0,
    audit_trail_record_count: summaries.audit_event_ledger.audit_trail_record_count ?? 0,
    stored_event_count: summaries.append_only_event_store.stored_event_count ?? 0,
    event_replay_count: summaries.event_replay_harness.replayed_event_count ?? 0,
    workflow_run_record_count: summaries.workflow_run_ledger.workflow_run_record_count ?? 0,
    agent_run_record_count: summaries.agent_run_ledger.agent_run_record_count ?? 0,
    tool_invocation_record_count: summaries.tool_invocation_ledger.tool_invocation_record_count ?? 0,
    ledger_api_route_count: summaries.ledger_api_dashboard.ledger_api_route_record_count ?? 0,
    ledger_golden_case_count: summaries.ledger_golden_fixtures.ledger_golden_case_count ?? 0,
    retention_archive_candidate_count: summaries.retention_archive_ledger.archive_candidate_count ?? 0,
    human_review_required_trace_count: representativeTraces.filter((trace) => trace.human_review_required).length,
    delivery_blocked_trace_count: representativeTraces.filter((trace) => trace.delivery_blocked).length,
    external_transfer_blocked_trace_count: representativeTraces.filter((trace) => trace.external_transfer_blocked).length,
    client_facing_ready_count: representativeTraces.filter((trace) => trace.client_facing_ready).length,
    protected_action_executed_count: representativeTraces.filter((trace) => trace.protected_action_executed).length,
    validation_item_count: freezeCheckpoints.length,
    failed_validation_item_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildObservabilityFreezeContract(generatedAt) {
  return {
    schema_version: "observability-freeze-contract.v1",
    observability_freeze_contract_id: OBSERVABILITY_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    source_rule: "Freeze reads P159-P175 event, run, audit, cost, trace, replay, retention, API, and ledger fixture artifacts without mutating any source artifact.",
    loop_rule: "Every P159-P175 observability artifact must have a declared default control-plane loop step and the current loop artifact must pass.",
    guardrail_rule: "The freeze does not approve legal advice, client-facing delivery, retry execution, retention/deletion execution, external transfer, filing, or protected actions.",
    api_routes: [
      "/api/observability-freezes",
      "/api/observability-freeze-sources",
      "/api/observability-freeze-checkpoints",
      "/api/observability-freeze-traces",
      "/api/observability-freeze-loop-bindings",
      "/api/observability-freeze-validations",
    ],
  };
}

function assertion(metricKey, observedValue, expectedOperator, expectedValue) {
  let assertionStatus = "failed";
  if (expectedOperator === "equals") assertionStatus = Object.is(observedValue ?? null, expectedValue ?? null) ? "passed" : "failed";
  if (expectedOperator === "gte") assertionStatus = Number(observedValue ?? 0) >= Number(expectedValue ?? 0) ? "passed" : "failed";
  return {
    assertion_id: `observability-freeze-assertion.${slugify(metricKey)}`,
    metric_key: metricKey,
    expected_operator: expectedOperator,
    expected_value: expectedValue,
    observed_value: observedValue ?? null,
    assertion_status: assertionStatus,
  };
}

function pushCheckpoint(checkpoints, checkpointId, checkId, passed, message) {
  checkpoints.push({
    schema_version: "observability-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderObservabilityFreezeMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Observability Freeze");
  lines.push("");
  lines.push("Attorney review is required before legal, client-facing, retry, retention, delivery, deletion, filing, or protected-action decisions.");
  lines.push("");
  lines.push(`- Status: ${summary.observability_freeze_status}`);
  lines.push(`- Sources: ${summary.passed_freeze_source_count}/${summary.freeze_source_count}`);
  lines.push(`- Control-plane loop bindings: ${summary.passed_control_plane_loop_binding_count}/${summary.control_plane_loop_binding_count}`);
  lines.push(`- Representative traces: ${summary.complete_representative_trace_count}/${summary.representative_trace_count}`);
  lines.push(`- Metric assertions: ${summary.passed_metric_assertion_count}/${summary.metric_assertion_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Representative Traces");
  for (const trace of result.representative_traces) {
    lines.push(`- ${trace.label}: ${trace.trace_status}; ${trace.metric_assertions.filter((item) => item.assertion_status === "passed").length}/${trace.metric_assertions.length} assertions`);
  }
  lines.push("");
  lines.push("## Failed Checkpoints");
  const failed = result.freeze_checkpoints.filter((checkpoint) => checkpoint.status !== "passed");
  if (failed.length === 0) lines.push("- none");
  else for (const checkpoint of failed) lines.push(`- ${checkpoint.checkpoint_id}.${checkpoint.check_id}: ${checkpoint.message}`);
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    event_envelope_ledger_path: path.resolve(options.eventEnvelopeLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.eventEnvelopeLedgerPath),
    event_type_registry_path: path.resolve(options.eventTypeRegistryPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.eventTypeRegistryPath),
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.appendOnlyEventStorePath),
    event_correlation_ledger_path: path.resolve(options.eventCorrelationLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.eventCorrelationLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.workflowRunLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.agentRunLedgerPath),
    tool_invocation_ledger_path: path.resolve(options.toolInvocationLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.toolInvocationLedgerPath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.auditEventLedgerPath),
    policy_snapshot_event_binding_path: path.resolve(options.policySnapshotEventBindingPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.policySnapshotEventBindingPath),
    cost_record_projection_path: path.resolve(options.costRecordProjectionPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.costRecordProjectionPath),
    token_usage_projection_path: path.resolve(options.tokenUsageProjectionPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.tokenUsageProjectionPath),
    observability_trace_projection_path: path.resolve(options.observabilityTraceProjectionPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.observabilityTraceProjectionPath),
    error_retry_ledger_path: path.resolve(options.errorRetryLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.errorRetryLedgerPath),
    event_replay_harness_path: path.resolve(options.eventReplayHarnessPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.eventReplayHarnessPath),
    retention_archive_ledger_path: path.resolve(options.retentionArchiveLedgerPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.retentionArchiveLedgerPath),
    ledger_api_dashboard_path: path.resolve(options.ledgerApiDashboardPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.ledgerApiDashboardPath),
    ledger_golden_fixtures_path: path.resolve(options.ledgerGoldenFixturesPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.ledgerGoldenFixturesPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.controlPlaneLoopPath),
    control_plane_loop_source_path: path.resolve(options.controlPlaneLoopSourcePath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.controlPlaneLoopSourcePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.roadmapPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.reviewApiPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_OBSERVABILITY_FREEZE_INPUTS.reviewDashboardPath),
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--event-envelope-ledger") parsed.eventEnvelopeLedgerPath = argv[++index];
    else if (arg === "--event-type-registry") parsed.eventTypeRegistryPath = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--event-correlation-ledger") parsed.eventCorrelationLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--tool-invocation-ledger") parsed.toolInvocationLedgerPath = argv[++index];
    else if (arg === "--audit-event-ledger") parsed.auditEventLedgerPath = argv[++index];
    else if (arg === "--policy-snapshot-event-binding") parsed.policySnapshotEventBindingPath = argv[++index];
    else if (arg === "--cost-record-projection") parsed.costRecordProjectionPath = argv[++index];
    else if (arg === "--token-usage-projection") parsed.tokenUsageProjectionPath = argv[++index];
    else if (arg === "--observability-trace-projection") parsed.observabilityTraceProjectionPath = argv[++index];
    else if (arg === "--error-retry-ledger") parsed.errorRetryLedgerPath = argv[++index];
    else if (arg === "--event-replay") parsed.eventReplayHarnessPath = argv[++index];
    else if (arg === "--retention-archive-ledger") parsed.retentionArchiveLedgerPath = argv[++index];
    else if (arg === "--ledger-api-dashboard") parsed.ledgerApiDashboardPath = argv[++index];
    else if (arg === "--ledger-golden-fixtures") parsed.ledgerGoldenFixturesPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--control-plane-loop-source") parsed.controlPlaneLoopSourcePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/observability-freeze.mjs [options]

Options:
  --check                             fail when validation is not complete
  --out-dir <dir>                    output directory
  --control-plane-loop <path>        control-plane-loop.json path
  --control-plane-loop-source <path> control-plane-loop source path
  --ledger-golden-fixtures <path>    ledger-golden-fixtures.json path
  --run-at <iso>                     deterministic generated_at timestamp
  --help                             show this help
`);
}

function sourceDefinition(sourceId, label, option, plannedSlot, sourceGroup, statusKey, expectedStatus, format = "json") {
  return {
    source_id: sourceId,
    label,
    option,
    planned_slot: plannedSlot,
    source_group: sourceGroup,
    status_key: statusKey,
    expected_status: expectedStatus,
    format,
  };
}

function sourceValidationErrors(artifact) {
  return artifact?.summary?.validation_error_count
    ?? artifact?.summary?.failed_validation_item_count
    ?? artifact?.validation?.errors?.length
    ?? 0;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map(({ path: itemPath, message, check_id: checkId, ...details }) => ({
      path: itemPath,
      message,
      check_id: checkId,
      ...details,
    }));
  return { valid: errors.length === 0, errors };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw), raw, error: null };
  } catch (error) {
    return { ok: false, value: null, raw: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: raw, raw, error: null };
  } catch (error) {
    return { ok: false, value: "", raw: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableObservabilityFreeze(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(iso) {
  return iso.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function snakeCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function slugify(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runObservabilityFreezeCli();
}
