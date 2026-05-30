import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVENT_REPLAY_HARNESS_OUT_DIR = "artifacts/event-replay/latest";
export const DEFAULT_EVENT_REPLAY_HARNESS_INPUTS = {
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  eventCorrelationLedgerPath: "artifacts/event-correlation/latest/event-correlation-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  reviewDashboardPath: "artifacts/dashboard/latest/review-dashboard.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "event-replay-harness.v1";
const EVENT_STREAM_REPLAY_SCHEMA_VERSION = "replayed-event-stream.v1";
const RUN_SUMMARY_REPLAY_SCHEMA_VERSION = "replayed-run-summary.v1";
const DASHBOARD_REPLAY_METRIC_SCHEMA_VERSION = "dashboard-replay-metric.v1";

export async function runEventReplayHarness(options = {}) {
  const result = await buildEventReplayHarness(options);
  if (options.write !== false) await writeEventReplayHarness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Event replay harness validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEventReplayHarness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVENT_REPLAY_HARNESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    appendOnlyEventStore: await readJsonOrError(inputs.append_only_event_store_path),
    eventCorrelationLedger: await readJsonOrError(inputs.event_correlation_ledger_path),
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    reviewDashboard: inputs.review_dashboard_path
      ? await readJsonOrError(inputs.review_dashboard_path)
      : { ok: false, value: null, error: "disabled" },
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const projection = buildReplayProjection(sources, generatedAt);
  const validationItems = validateEventReplayHarness({ sources, projection });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    event_replay_harness_id: `event-replay-harness.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    event_replay_contract: buildContract(generatedAt),
    event_replay_catalog: {
      schema_version: "event-replay-catalog.v1",
      generated_at: generatedAt,
      replayed_event_streams: projection.replayedEventStreams,
      replayed_run_summaries: projection.replayedRunSummaries,
      dashboard_replay_projection: projection.dashboardReplayProjection,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeProjection(projection, validation),
  };
  return {
    ...result,
    markdown: renderEventReplayHarnessMarkdown(result),
  };
}

export async function writeEventReplayHarness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "event-replay-harness.json"), serializableHarness(result));
  await writeJson(path.join(outDir, "replayed-event-streams.json"), {
    schema_version: "replayed-event-streams.v1",
    generated_at: result.generated_at,
    replayed_event_stream_count: result.event_replay_catalog.replayed_event_streams.length,
    replayed_event_streams: result.event_replay_catalog.replayed_event_streams,
  });
  await writeJson(path.join(outDir, "replayed-run-summaries.json"), {
    schema_version: "replayed-run-summaries.v1",
    generated_at: result.generated_at,
    replayed_run_summary_count: result.event_replay_catalog.replayed_run_summaries.length,
    replayed_run_summaries: result.event_replay_catalog.replayed_run_summaries,
  });
  await writeJson(path.join(outDir, "dashboard-replay-projection.json"), result.event_replay_catalog.dashboard_replay_projection);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "event-replay-validation-report.v1",
    generated_at: result.generated_at,
    event_replay_harness_id: result.event_replay_harness_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEventReplayHarnessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEventReplayHarness(args);
    console.log(`Event replay harness written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.event_replay_status}`);
    console.log(`Events replayed: ${result.summary.replayed_event_count}/${result.summary.source_stored_event_count}`);
    console.log(`Run summaries: ${result.summary.replayed_run_summary_count}/${result.summary.source_workflow_run_record_count}`);
    console.log(`Dashboard metrics: ${result.summary.dashboard_metric_match_count}/${result.summary.dashboard_projection_metric_count} matched`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildReplayProjection(sources, generatedAt) {
  const appendOnlyEventStore = sources.appendOnlyEventStore.value ?? {};
  const eventCorrelationLedger = sources.eventCorrelationLedger.value ?? {};
  const workflowRunLedger = sources.workflowRunLedger.value ?? {};
  const reviewDashboard = sources.reviewDashboard.value ?? {};

  const storedEvents = [...(appendOnlyEventStore.event_store_catalog?.stored_events ?? [])].sort(compareEvents);
  const sourceEventStreams = appendOnlyEventStore.event_store_catalog?.event_streams ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const dashboardSummary = reviewDashboard.summary ?? {};

  const replayedEventStreams = buildReplayedEventStreams({ storedEvents, sourceEventStreams, generatedAt });
  const replayedRunSummaries = buildReplayedRunSummaries({ storedEvents, workflowRunRecords, generatedAt });
  const globalHashChainMismatchCount = countGlobalHashChainMismatches(storedEvents);
  const dashboardReplayProjection = buildDashboardReplayProjection({
    appendOnlyEventStore,
    eventCorrelationLedger,
    workflowRunLedger,
    storedEvents,
    replayedEventStreams,
    replayedRunSummaries,
    dashboardSummary,
    dashboardAvailable: sources.reviewDashboard.ok,
    generatedAt,
  });

  return {
    replayedEventStreams,
    replayedRunSummaries,
    dashboardReplayProjection,
    sourceCounts: {
      source_stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? storedEvents.length,
      source_event_stream_count: appendOnlyEventStore.summary?.event_stream_count ?? sourceEventStreams.length,
      source_correlation_trace_count: eventCorrelationLedger.summary?.correlation_trace_count ?? eventCorrelationLedger.event_correlation_catalog?.correlation_traces?.length ?? 0,
      source_workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
      source_workflow_event_binding_count: workflowRunLedger.summary?.event_binding_count ?? workflowRunLedger.workflow_run_catalog?.workflow_event_bindings?.length ?? 0,
      source_workflow_state_transition_count: workflowRunLedger.summary?.state_transition_count ?? workflowRunLedger.workflow_run_catalog?.workflow_state_transitions?.length ?? 0,
      source_dashboard_available: sources.reviewDashboard.ok,
      global_hash_chain_mismatch_count: globalHashChainMismatchCount,
    },
  };
}

function buildReplayedEventStreams({ storedEvents, sourceEventStreams, generatedAt }) {
  const sourceById = new Map(sourceEventStreams.map((stream) => [stream.event_stream_id, stream]));
  return [...groupBy(storedEvents, "event_stream_id").entries()]
    .map(([eventStreamId, events]) => {
      const ordered = [...events].sort(compareStreamEvents);
      const source = sourceById.get(eventStreamId);
      const sequenceGapCount = countSequenceGaps(ordered, "stream_sequence");
      const sourceEventCount = source?.event_count ?? 0;
      const eventCountMatchStatus = source ? matchStatus(ordered.length, sourceEventCount) : "missing_source";
      const hashChainStatus = ordered.every((event) => event.event_hash?.startsWith("sha256:") && event.chain_hash?.startsWith("sha256:"))
        ? "verified"
        : "missing_hash";
      const sequenceStatus = sequenceGapCount === 0 ? "contiguous" : "gapped";
      const replay = {
        schema_version: EVENT_STREAM_REPLAY_SCHEMA_VERSION,
        event_stream_replay_id: `event-stream-replay.${slugify(eventStreamId)}`,
        replayed_event_stream_id: `replayed-event-stream.${slugify(eventStreamId)}`,
        event_stream_id: eventStreamId,
        source_stream_status: source?.stream_status ?? "missing_source",
        stream_scope: source?.stream_scope ?? inferStreamScope(ordered),
        replayed_event_count: ordered.length,
        source_event_count: sourceEventCount,
        event_count_match_status: eventCountMatchStatus,
        first_global_sequence: ordered[0]?.global_sequence ?? null,
        last_global_sequence: ordered.at(-1)?.global_sequence ?? null,
        first_stream_sequence: ordered[0]?.stream_sequence ?? null,
        last_stream_sequence: ordered.at(-1)?.stream_sequence ?? null,
        sequence_gap_count: sequenceGapCount,
        sequence_status: sequenceStatus,
        hash_chain_status: hashChainStatus,
        event_types: sortedUnique(ordered.map((event) => event.event_type)),
        event_envelope_ids: ordered.map((event) => event.event_envelope_id).filter(Boolean),
        stored_event_ids: ordered.map((event) => event.stored_event_id).filter(Boolean),
        matter_ids: sortedUnique(ordered.map((event) => event.matter_id).filter(Boolean)),
        workflow_run_ids: sortedUnique(ordered.map((event) => event.workflow_run_id).filter(Boolean)),
        run_ledger_ids: sortedUnique(ordered.map((event) => event.run_ledger_id).filter(Boolean)),
        event_stream_replay_status: eventCountMatchStatus === "matched" && sequenceStatus === "contiguous" && hashChainStatus === "verified"
          ? "replayed"
          : "blocked",
        replayed_at: generatedAt,
      };
      const replayHash = hashValue(replay);
      return {
        ...replay,
        event_stream_replay_hash: replayHash,
        replay_hash: replayHash,
      };
    })
    .sort(by("event_stream_replay_id"));
}

function buildReplayedRunSummaries({ storedEvents, workflowRunRecords, generatedAt }) {
  const workflowByRunLedger = new Map(workflowRunRecords.map((record) => [record.run_ledger_id, record]));
  return [...groupBy(storedEvents.filter((event) => event.run_ledger_id), "run_ledger_id").entries()]
    .map(([runLedgerId, events]) => {
      const ordered = [...events].sort(compareEvents);
      const source = workflowByRunLedger.get(runLedgerId);
      const sourceEventCount = source?.event_envelope_ids?.length ?? 0;
      const replayedTerminalState = deriveTerminalState(ordered);
      const sourceTerminalState = source?.terminal_state ?? "missing_source";
      const eventCountMatchStatus = source ? matchStatus(ordered.length, sourceEventCount) : "missing_source";
      const terminalStateMatchStatus = source ? matchStatus(replayedTerminalState, sourceTerminalState) : "missing_source";
      const runReplayStatus = eventCountMatchStatus === "matched" && terminalStateMatchStatus === "matched" ? "replayed" : "blocked";
      const replay = {
        schema_version: RUN_SUMMARY_REPLAY_SCHEMA_VERSION,
        run_summary_replay_id: `run-summary-replay.${slugify(runLedgerId)}`,
        replayed_run_summary_id: `replayed-run-summary.${slugify(runLedgerId)}`,
        run_ledger_id: runLedgerId,
        source_workflow_run_record_id: source?.workflow_run_record_id ?? null,
        workflow_run_id: source?.workflow_run_id ?? ordered.find((event) => event.workflow_run_id)?.workflow_run_id ?? null,
        correlation_id: source?.correlation_id ?? ordered.find((event) => event.correlation_id)?.correlation_id ?? null,
        tenant_id: source?.tenant_id ?? ordered.find((event) => event.tenant_id)?.tenant_id ?? null,
        matter_id: source?.matter_id ?? ordered.find((event) => event.matter_id)?.matter_id ?? null,
        domain_pack: source?.domain_pack ?? null,
        replayed_event_count: ordered.length,
        source_event_count: sourceEventCount,
        event_count_match_status: eventCountMatchStatus,
        replayed_terminal_state: replayedTerminalState,
        source_terminal_state: sourceTerminalState,
        terminal_state_match_status: terminalStateMatchStatus,
        first_event_time: ordered[0]?.event_time ?? null,
        last_event_time: ordered.at(-1)?.event_time ?? null,
        event_types: sortedUnique(ordered.map((event) => event.event_type)),
        event_envelope_ids: ordered.map((event) => event.event_envelope_id).filter(Boolean),
        stored_event_ids: ordered.map((event) => event.stored_event_id).filter(Boolean),
        gate_failed_event_count: ordered.filter((event) => event.event_type === "gate.failed").length,
        approval_requested_event_count: ordered.filter((event) => event.event_type === "approval.requested").length,
        output_rendered_event_count: ordered.filter((event) => event.event_type === "output.rendered").length,
        cost_recorded_event_count: ordered.filter((event) => event.event_type === "cost.recorded").length,
        run_replay_status: runReplayStatus,
        replayed_at: generatedAt,
      };
      const replayHash = hashValue(replay);
      return {
        ...replay,
        run_summary_replay_hash: replayHash,
        replay_hash: replayHash,
      };
    })
    .sort(by("run_summary_replay_id"));
}

function buildDashboardReplayProjection({
  appendOnlyEventStore,
  eventCorrelationLedger,
  workflowRunLedger,
  storedEvents,
  replayedEventStreams,
  replayedRunSummaries,
  dashboardSummary,
  dashboardAvailable,
  generatedAt,
}) {
  const metrics = [
    dashboardMetric("append_only_event_store_stored_event_count", storedEvents.length, appendOnlyEventStore.summary?.stored_event_count, dashboardSummary.append_only_event_store_stored_event_count, dashboardAvailable),
    dashboardMetric("append_only_event_store_event_stream_count", replayedEventStreams.length, appendOnlyEventStore.summary?.event_stream_count, dashboardSummary.append_only_event_store_event_stream_count, dashboardAvailable),
    dashboardMetric("append_only_event_store_hash_chained_event_count", storedEvents.filter((event) => event.hash_chain_status === "chained").length, appendOnlyEventStore.summary?.hash_chained_event_count, dashboardSummary.append_only_event_store_hash_chained_event_count, dashboardAvailable),
    dashboardMetric("append_only_event_store_validation_error_count", appendOnlyEventStore.summary?.validation_error_count ?? 0, appendOnlyEventStore.summary?.validation_error_count ?? 0, dashboardSummary.append_only_event_store_validation_error_count, dashboardAvailable),
    dashboardMetric("event_correlation_ledger_correlation_trace_count", eventCorrelationLedger.event_correlation_catalog?.correlation_traces?.length ?? 0, eventCorrelationLedger.summary?.correlation_trace_count, dashboardSummary.event_correlation_ledger_correlation_trace_count, dashboardAvailable),
    dashboardMetric("event_correlation_ledger_run_bound_trace_count", eventCorrelationLedger.summary?.run_bound_trace_count ?? 0, eventCorrelationLedger.summary?.run_bound_trace_count, dashboardSummary.event_correlation_ledger_run_bound_trace_count, dashboardAvailable),
    dashboardMetric("event_correlation_ledger_external_control_trace_count", eventCorrelationLedger.summary?.external_control_trace_count ?? 0, eventCorrelationLedger.summary?.external_control_trace_count, dashboardSummary.event_correlation_ledger_external_control_trace_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_workflow_run_record_count", replayedRunSummaries.length, workflowRunLedger.summary?.workflow_run_record_count, dashboardSummary.workflow_run_ledger_workflow_run_record_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_event_binding_count", workflowRunLedger.workflow_run_catalog?.workflow_event_bindings?.length ?? 0, workflowRunLedger.summary?.event_binding_count, dashboardSummary.workflow_run_ledger_event_binding_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_state_transition_count", workflowRunLedger.workflow_run_catalog?.workflow_state_transitions?.length ?? 0, workflowRunLedger.summary?.state_transition_count, dashboardSummary.workflow_run_ledger_state_transition_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_terminal_transition_count", replayedRunSummaries.length, workflowRunLedger.summary?.terminal_transition_count, dashboardSummary.workflow_run_ledger_terminal_transition_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_terminal_state_aligned_count", replayedRunSummaries.filter((summary) => summary.terminal_state_match_status === "matched").length, workflowRunLedger.summary?.terminal_state_aligned_count, dashboardSummary.workflow_run_ledger_terminal_state_aligned_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_terminal_state_mismatch_count", replayedRunSummaries.filter((summary) => summary.terminal_state_match_status !== "matched").length, workflowRunLedger.summary?.terminal_state_mismatch_count, dashboardSummary.workflow_run_ledger_terminal_state_mismatch_count, dashboardAvailable),
    dashboardMetric("workflow_run_ledger_validation_error_count", workflowRunLedger.summary?.validation_error_count ?? 0, workflowRunLedger.summary?.validation_error_count ?? 0, dashboardSummary.workflow_run_ledger_validation_error_count, dashboardAvailable),
  ];
  const dashboardProjection = {
    schema_version: "dashboard-replay-projection.v1",
    generated_at: generatedAt,
    dashboard_replay_projection_id: `dashboard-replay-projection.${dateStamp(generatedAt)}`,
    projection_id: `dashboard-replay-projection.${dateStamp(generatedAt)}`,
    source_dashboard_available: dashboardAvailable,
    dashboard_projection_status: metrics.every((metric) => metric.metric_status === "matched" || metric.metric_status === "dashboard_not_available") ? "replayed" : "blocked",
    projection_status: metrics.every((metric) => metric.metric_status === "matched" || metric.metric_status === "dashboard_not_available") ? "replayed" : "blocked",
    projection_metrics: metrics,
    replayed_metrics: metrics,
  };
  const projectionHash = hashValue(dashboardProjection);
  return {
    ...dashboardProjection,
    dashboard_replay_projection_hash: projectionHash,
    projection_hash: projectionHash,
  };
}

function dashboardMetric(metricKey, replayedValue, sourceValue, dashboardValue, dashboardAvailable) {
  const sourceMatchStatus = matchStatus(replayedValue, sourceValue ?? 0);
  const dashboardMatchStatus = dashboardAvailable ? matchStatus(replayedValue, dashboardValue ?? 0) : "dashboard_not_available";
  const metric = {
    schema_version: DASHBOARD_REPLAY_METRIC_SCHEMA_VERSION,
    dashboard_replay_metric_id: `dashboard-replay-metric.${slugify(metricKey)}`,
    metric_key: metricKey,
    replayed_value: replayedValue,
    source_value: sourceValue ?? 0,
    dashboard_value: dashboardAvailable ? dashboardValue ?? 0 : null,
    source_match_status: sourceMatchStatus,
    dashboard_match_status: dashboardMatchStatus,
    metric_status: sourceMatchStatus === "matched" && (dashboardMatchStatus === "matched" || dashboardMatchStatus === "dashboard_not_available")
      ? dashboardMatchStatus === "dashboard_not_available" ? "dashboard_not_available" : "matched"
      : "mismatched",
  };
  return {
    ...metric,
    dashboard_replay_metric_hash: hashValue(metric),
  };
}

function validateEventReplayHarness({ sources, projection }) {
  const items = [];
  for (const [sourceName, source] of Object.entries(sources)) {
    const optional = sourceName === "reviewDashboard";
    items.push(validationItem(`source.${sourceName}`, `source_${sourceName}_available`, optional || source.ok, `${sourceName} is available.`));
  }
  const packageScripts = sources.packageJson.value?.scripts ?? {};
  const roadmapText = String(sources.roadmap.value ?? "");
  const summary = summarizeProjection(projection, { errors: [] });
  items.push(validationItem("package.scripts.events:replay", "package_script_declared", Boolean(packageScripts["events:replay"]), "`events:replay` package script must be declared."));
  items.push(validationItem("roadmap.phase_172", "roadmap_phase_declared", roadmapText.includes("Phase 172: Event Replay Harness"), "Phase 172 roadmap entry must be declared."));
  items.push(validationItem("source.append_only_event_store", "source_event_store_complete", sources.appendOnlyEventStore.value?.summary?.event_store_status === "complete", "Append-only event store must be complete."));
  items.push(validationItem("source.event_correlation_ledger", "source_event_correlation_ledger_complete", sources.eventCorrelationLedger.value?.summary?.event_correlation_status === "complete", "Event correlation ledger must be complete."));
  items.push(validationItem("source.workflow_run_ledger", "source_workflow_run_ledger_complete", sources.workflowRunLedger.value?.summary?.workflow_run_ledger_status === "complete", "Workflow run ledger must be complete."));
  items.push(validationItem("replay.events", "stored_events_replayed", summary.replayed_event_count > 0 && summary.replayed_event_count === summary.source_stored_event_count, "All stored events must be replayed."));
  items.push(validationItem("replay.event_streams", "event_stream_count_matches_source", summary.replayed_event_stream_count === summary.source_event_stream_count, "Replay stream count must match source event stream count."));
  items.push(validationItem("replay.event_streams.sequence", "event_stream_sequences_contiguous", summary.sequence_gap_count === 0, "Replayed event streams must have contiguous stream sequence numbers."));
  items.push(validationItem("replay.event_streams.hash", "event_stream_hashes_verified", summary.verified_event_stream_count === summary.replayed_event_stream_count, "Every replayed event stream must have verified hashes."));
  items.push(validationItem("replay.global_hash_chain", "global_hash_chain_verified", summary.hash_chain_mismatch_count === 0, "Global append-only event hash chain must replay without mismatch."));
  items.push(validationItem("replay.run_summaries", "run_summary_count_matches_source", summary.replayed_run_summary_count === summary.source_workflow_run_record_count, "Replay run summary count must match workflow run ledger record count."));
  items.push(validationItem("replay.run_summaries.events", "run_summary_event_counts_match", summary.run_summary_event_count_mismatch_count === 0, "Replayed run event counts must match workflow run ledger event counts."));
  items.push(validationItem("replay.run_summaries.terminal", "run_terminal_states_match", summary.terminal_state_mismatch_count === 0, "Replayed terminal states must match workflow run ledger terminal states."));
  items.push(validationItem("replay.dashboard_projection", "dashboard_projection_metrics_present", summary.dashboard_projection_metric_count >= 10, "Dashboard replay projection must include core event/run metrics."));
  items.push(validationItem("replay.dashboard_projection.matches", "dashboard_projection_matches_sources", summary.dashboard_metric_mismatch_count === 0, "Dashboard replay projection must match source ledger metrics and the dashboard when available."));
  items.push(validationItem("replay.hashes", "replay_hashes_present", projection.replayedEventStreams.every((record) => record.event_stream_replay_hash) && projection.replayedRunSummaries.every((record) => record.run_summary_replay_hash) && projection.dashboardReplayProjection.dashboard_replay_projection_hash, "Replay rows must have hashes."));
  return items;
}

function summarizeProjection(projection, validation) {
  const streams = projection.replayedEventStreams;
  const runs = projection.replayedRunSummaries;
  const metrics = projection.dashboardReplayProjection.projection_metrics ?? projection.dashboardReplayProjection.replayed_metrics ?? [];
  const dashboardMismatchCount = metrics.filter((metric) => metric.metric_status === "mismatched").length;
  const runSummaryEventCountMismatchCount = runs.filter((run) => run.event_count_match_status !== "matched").length;
  const terminalStateMismatchCount = runs.filter((run) => run.terminal_state_match_status !== "matched").length;
  return {
    event_replay_status: validation.errors.length === 0 ? "complete" : "blocked",
    event_replay_contract_id: CONTRACT_ID,
    source_stored_event_count: projection.sourceCounts.source_stored_event_count,
    replayed_event_count: streams.reduce((count, stream) => count + stream.replayed_event_count, 0),
    source_event_stream_count: projection.sourceCounts.source_event_stream_count,
    replayed_event_stream_count: streams.length,
    verified_event_stream_count: streams.filter((stream) => stream.hash_chain_status === "verified").length,
    blocked_event_stream_count: streams.filter((stream) => stream.event_stream_replay_status !== "replayed").length,
    sequence_gap_count: streams.reduce((count, stream) => count + stream.sequence_gap_count, 0),
    hash_chain_mismatch_count: projection.sourceCounts.global_hash_chain_mismatch_count,
    source_correlation_trace_count: projection.sourceCounts.source_correlation_trace_count,
    source_workflow_run_record_count: projection.sourceCounts.source_workflow_run_record_count,
    source_workflow_event_binding_count: projection.sourceCounts.source_workflow_event_binding_count,
    source_workflow_state_transition_count: projection.sourceCounts.source_workflow_state_transition_count,
    replayed_run_summary_count: runs.length,
    replayed_run_event_count: runs.reduce((count, run) => count + run.replayed_event_count, 0),
    run_summary_event_count_match_count: runs.filter((run) => run.event_count_match_status === "matched").length,
    run_summary_event_count_mismatch_count: runSummaryEventCountMismatchCount,
    run_terminal_state_match_count: runs.filter((run) => run.terminal_state_match_status === "matched").length,
    run_terminal_state_mismatch_count: terminalStateMismatchCount,
    run_summary_mismatch_count: runSummaryEventCountMismatchCount + terminalStateMismatchCount,
    terminal_state_match_count: runs.filter((run) => run.terminal_state_match_status === "matched").length,
    terminal_state_mismatch_count: terminalStateMismatchCount,
    replayed_blocked_run_count: runs.filter((run) => run.replayed_terminal_state === "blocked").length,
    dashboard_replay_projection_status: projection.dashboardReplayProjection.dashboard_projection_status,
    source_dashboard_available: projection.sourceCounts.source_dashboard_available,
    dashboard_projection_metric_count: metrics.length,
    dashboard_replay_metric_count: metrics.length,
    dashboard_metric_match_count: metrics.filter((metric) => metric.metric_status === "matched" || metric.metric_status === "dashboard_not_available").length,
    dashboard_metric_mismatch_count: dashboardMismatchCount,
    dashboard_metric_source_match_count: metrics.filter((metric) => metric.source_match_status === "matched").length,
    dashboard_metric_dashboard_match_count: metrics.filter((metric) => metric.dashboard_match_status === "matched").length,
    validation_item_count: validation.items?.length ?? 0,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_run_terminal_state: countBy(runs, "replayed_terminal_state"),
    by_run_replay_status: countBy(runs, "run_replay_status"),
    by_stream_replay_status: countBy(streams, "event_stream_replay_status"),
    by_dashboard_metric_status: countBy(metrics, "metric_status"),
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "event-replay-contract.v1",
    generated_at: generatedAt,
    event_replay_contract_id: CONTRACT_ID,
    replay_sources: ["append_only_event_store", "event_correlation_ledger", "workflow_run_ledger"],
    replay_outputs: ["replayed_event_streams", "replayed_run_summaries", "dashboard_replay_projection"],
    deterministic_replay: true,
    side_effect_policy: "read_only_no_execution",
    notes: [
      "Replay reconstructs summaries from append-only stored events and ledger rows.",
      "Replay does not mutate source ledgers, execute runtime adapters, or approve protected actions.",
      "Dashboard metrics are independently rebuilt from event and run ledgers, then compared with the dashboard when one is available.",
    ],
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    append_only_event_store: sourceContract(sources.appendOnlyEventStore, inputs.append_only_event_store_path, {
      event_store_status: sources.appendOnlyEventStore.value?.summary?.event_store_status ?? null,
      stored_event_count: sources.appendOnlyEventStore.value?.summary?.stored_event_count ?? 0,
    }),
    event_correlation_ledger: sourceContract(sources.eventCorrelationLedger, inputs.event_correlation_ledger_path, {
      event_correlation_status: sources.eventCorrelationLedger.value?.summary?.event_correlation_status ?? null,
      correlation_trace_count: sources.eventCorrelationLedger.value?.summary?.correlation_trace_count ?? 0,
    }),
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, {
      workflow_run_ledger_status: sources.workflowRunLedger.value?.summary?.workflow_run_ledger_status ?? null,
      workflow_run_record_count: sources.workflowRunLedger.value?.summary?.workflow_run_record_count ?? 0,
    }),
    review_dashboard: sourceContract(sources.reviewDashboard, inputs.review_dashboard_path, {
      dashboard_status: sources.reviewDashboard.value?.summary?.overall_status ?? null,
      source_count: sources.reviewDashboard.value?.summary?.source_count ?? 0,
    }),
  };
}

function sourceContract(source, sourcePath, extra = {}) {
  return {
    source_path: sourcePath,
    available: source.ok,
    schema_version: source.value?.schema_version ?? null,
    generated_at: source.value?.generated_at ?? null,
    error: source.ok ? null : source.error,
    ...extra,
  };
}

function serializableHarness(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    event_replay_harness_id: result.event_replay_harness_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_contracts: result.source_contracts,
    event_replay_contract: result.event_replay_contract,
    event_replay_catalog: result.event_replay_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function renderEventReplayHarnessMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Event Replay Harness");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.event_replay_status}`);
  lines.push("");
  lines.push(`- Events replayed/source: ${summary.replayed_event_count}/${summary.source_stored_event_count}`);
  lines.push(`- Streams replayed/source: ${summary.replayed_event_stream_count}/${summary.source_event_stream_count}`);
  lines.push(`- Run summaries replayed/source: ${summary.replayed_run_summary_count}/${summary.source_workflow_run_record_count}`);
  lines.push(`- Run event mismatches: ${summary.run_summary_event_count_mismatch_count}`);
  lines.push(`- Run terminal mismatches: ${summary.terminal_state_mismatch_count}`);
  lines.push(`- Hash-chain mismatches: ${summary.hash_chain_mismatch_count}`);
  lines.push(`- Dashboard metrics matched/total: ${summary.dashboard_metric_match_count}/${summary.dashboard_projection_metric_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Replayed Runs");
  lines.push("");
  for (const run of result.event_replay_catalog.replayed_run_summaries) {
    lines.push(`- ${run.run_ledger_id}: events=${run.replayed_event_count}/${run.source_event_count}, terminal=${run.replayed_terminal_state}/${run.source_terminal_state}, status=${run.run_replay_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.appendOnlyEventStorePath),
    event_correlation_ledger_path: path.resolve(options.eventCorrelationLedgerPath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.eventCorrelationLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.workflowRunLedgerPath),
    review_dashboard_path: options.reviewDashboardPath === false
      ? null
      : path.resolve(options.reviewDashboardPath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.reviewDashboardPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVENT_REPLAY_HARNESS_INPUTS.roadmapPath),
  };
}

function deriveTerminalState(events) {
  if (events.some((event) => event.event_type === "workflow.failed")) return "failed";
  if (events.some((event) => event.event_type === "workflow.cancelled")) return "cancelled";
  if (events.some((event) => event.event_type === "gate.failed" || event.event_type === "approval.requested")) return "blocked";
  if (events.some((event) => event.event_type === "output.rendered" || event.event_type === "cost.recorded")) return "completed";
  if (events.some((event) => event.event_type === "workflow.started")) return "running";
  return "unknown";
}

function countSequenceGaps(events, sequenceKey) {
  let gaps = 0;
  for (let index = 0; index < events.length; index += 1) {
    if (Number(events[index]?.[sequenceKey] ?? 0) !== index + 1) gaps += 1;
  }
  return gaps;
}

function countGlobalHashChainMismatches(events) {
  let mismatches = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const previous = events[index - 1];
    const expectedSequence = index + 1;
    if (Number(event?.global_sequence ?? 0) !== expectedSequence) mismatches += 1;
    if (!event?.event_hash?.startsWith("sha256:")) mismatches += 1;
    if (!event?.chain_hash?.startsWith("sha256:")) mismatches += 1;
    if (index === 0 && event?.previous_chain_hash !== null) mismatches += 1;
    if (index > 0 && event?.previous_chain_hash !== previous?.chain_hash) mismatches += 1;
  }
  return mismatches;
}

function inferStreamScope(events) {
  if (events.some((event) => event.matter_id)) return "matter";
  if (events.some((event) => event.tenant_id)) return "tenant";
  return "global";
}

function matchStatus(left, right) {
  return String(left) === String(right) ? "matched" : "mismatched";
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      ok: true,
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  const getter = typeof keyOrFn === "function" ? keyOrFn : (item) => item?.[keyOrFn];
  for (const item of items) {
    const key = getter(item) ?? "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  return Object.fromEntries([...groupBy(items, key).entries()].map(([groupKey, values]) => [groupKey, values.length]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))].sort();
}

function compareEvents(left, right) {
  return Number(left.global_sequence ?? 0) - Number(right.global_sequence ?? 0)
    || String(left.event_envelope_id ?? "").localeCompare(String(right.event_envelope_id ?? ""));
}

function compareStreamEvents(left, right) {
  return Number(left.stream_sequence ?? 0) - Number(right.stream_sequence ?? 0)
    || compareEvents(left, right);
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--event-correlation-ledger") parsed.eventCorrelationLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--no-review-dashboard") parsed.reviewDashboardPath = false;
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/event-replay-harness.mjs [options]

Options:
  --check                                Fail when validation does not pass.
  --out-dir <path>                      Output directory.
  --append-only-event-store <path>       append-only-event-store.json path.
  --event-correlation-ledger <path>      event-correlation-ledger.json path.
  --workflow-run-ledger <path>           workflow-run-ledger.json path.
  --review-dashboard <path>              review-dashboard.json path.
  --no-review-dashboard                  Skip dashboard comparison and validate source-only replay.
  --package <path>                       package.json path.
  --roadmap <path>                       implementation-roadmap.md path.
`);
}
