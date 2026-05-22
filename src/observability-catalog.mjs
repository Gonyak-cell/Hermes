import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OBSERVABILITY_CATALOG_OUT_DIR = "artifacts/observability/latest";

export const DEFAULT_OBSERVABILITY_SOURCES = [
  {
    source_id: "vertical_slice",
    label: "First Vertical Slice",
    slice_path: "artifacts/vertical-slice/latest/vertical-slice.json",
    event_ledger_path: "artifacts/vertical-slice/latest/event-ledger.json",
  },
  {
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    slice_path: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
    event_ledger_path: "artifacts/law-firm-ldd-slice/latest/event-ledger.json",
  },
  {
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    slice_path: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
    event_ledger_path: "artifacts/personal-dev-slice/latest/event-ledger.json",
  },
  {
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
    slice_path: "artifacts/creative-document-slice/latest/creative-document-slice.json",
    event_ledger_path: "artifacts/creative-document-slice/latest/event-ledger.json",
  },
];

export async function runObservabilityCatalog(options = {}) {
  const result = await buildObservabilityCatalog(options);
  if (options.write !== false) await writeObservabilityCatalog(result, result.output_dir);
  return result;
}

export async function buildObservabilityCatalog(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OBSERVABILITY_CATALOG_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceDefinitions = normalizeSourceDefinitions(options.sources ?? buildSourceDefinitionsFromOptions(options));
  const sources = await readObservabilitySources(sourceDefinitions);
  const availableSources = sources.filter((source) => source.available);
  const runRecords = availableSources.flatMap(extractRunRecords);
  const eventRecords = availableSources.flatMap(extractEventRecords);
  const costRecords = availableSources.flatMap(extractCostRecords);
  const catalog = {
    schema_version: "observability-catalog.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary: summarizeObservability(sources, runRecords, eventRecords, costRecords),
    sources: sources.map(({ slice, event_ledger: _eventLedger, ...source }) => source),
    run_records: runRecords,
    event_records: eventRecords,
    cost_records: costRecords,
  };

  return {
    ...catalog,
    markdown: renderObservabilityCatalogMarkdown(catalog),
  };
}

export async function writeObservabilityCatalog(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "observability-catalog.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    run_records: result.run_records,
    event_records: result.event_records,
    cost_records: result.cost_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runObservabilityCatalogCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runObservabilityCatalog(args);
  console.log(`Observability catalog written to ${result.output_dir}`);
  console.log(`Workflow runs: ${result.summary.workflow_run_count}`);
  console.log(`Events: ${result.summary.event_count}`);
  console.log(`Runtime seconds: ${result.summary.total_runtime_seconds}`);
}

function normalizeSourceDefinitions(sources) {
  return sources.map((source) => ({
    source_id: source.source_id,
    label: source.label,
    slice_path: path.resolve(source.slice_path),
    event_ledger_path: path.resolve(source.event_ledger_path),
  }));
}

function buildSourceDefinitionsFromOptions(options) {
  const overrides = new Map();
  setSourceOverride(overrides, "vertical_slice", options.verticalSlicePath, options.verticalLedgerPath);
  setSourceOverride(overrides, "law_firm_ldd_slice", options.lawFirmSlicePath, options.lawFirmLedgerPath);
  setSourceOverride(overrides, "personal_dev_slice", options.personalDevSlicePath, options.personalDevLedgerPath);
  setSourceOverride(overrides, "creative_document_slice", options.creativeDocumentSlicePath, options.creativeDocumentLedgerPath);

  return DEFAULT_OBSERVABILITY_SOURCES
    .filter((source) => overrides.get(source.source_id)?.enabled !== false)
    .map((source) => {
      const override = overrides.get(source.source_id) ?? {};
      return {
        ...source,
        slice_path: override.slice_path ?? source.slice_path,
        event_ledger_path: override.event_ledger_path ?? source.event_ledger_path,
      };
    });
}

function setSourceOverride(overrides, sourceId, slicePath, ledgerPath) {
  if (slicePath === undefined && ledgerPath === undefined) return;
  overrides.set(sourceId, {
    enabled: slicePath !== false,
    slice_path: slicePath === false ? undefined : slicePath,
    event_ledger_path: ledgerPath,
  });
}

async function readObservabilitySources(sourceDefinitions) {
  const results = [];
  for (const source of sourceDefinitions) {
    const sliceResult = await readJsonOrError(source.slice_path);
    const ledgerResult = await readJsonOrError(source.event_ledger_path);
    const available = sliceResult.ok && ledgerResult.ok;
    const slice = sliceResult.value;
    const eventLedger = ledgerResult.value;
    const errors = [
      sliceResult.ok ? null : `slice:${sliceResult.error}`,
      ledgerResult.ok ? null : `event_ledger:${ledgerResult.error}`,
    ].filter(Boolean);

    results.push({
      source_id: source.source_id,
      label: source.label,
      slice_path: source.slice_path,
      event_ledger_path: source.event_ledger_path,
      available,
      schema_version: slice?.schema_version ?? null,
      generated_at: slice?.generated_at ?? null,
      event_ledger_generated_at: eventLedger?.generated_at ?? null,
      workflow_run_count: slice?.workflow_runtime?.workflow_runs?.length ?? 0,
      agent_run_count: slice?.workflow_runtime?.agent_runs?.length ?? 0,
      event_count: eventLedger?.events?.length ?? 0,
      run_ledger_count: eventLedger?.run_ledgers?.length ?? 0,
      error: errors.length > 0 ? errors.join("; ") : null,
      slice,
      event_ledger: eventLedger,
    });
  }
  return results;
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

function extractRunRecords(source) {
  const slice = source.slice;
  const ledger = source.event_ledger;
  const capabilities = new Map((slice.workflow_runtime?.capabilities ?? []).map((capability) => [capability.id, capability]));
  const runLedgers = new Map((ledger.run_ledgers ?? []).map((runLedger) => [runLedger.workflow_run_id, runLedger]));
  const eventsByCorrelation = groupBy(ledger.events ?? [], "correlation_id");
  const agentRunsByWorkflow = groupBy(slice.workflow_runtime?.agent_runs ?? [], "workflow_run_id");
  const gatesByWorkflow = groupBy(slice.governance_output?.gate_results ?? [], "workflow_run_id");
  const approvalsByWorkflow = groupBy(slice.governance_output?.approvals ?? [], "workflow_run_id");
  const outputsById = new Map((slice.governance_output?.output_artifacts ?? []).map((artifact) => [artifact.id, artifact]));

  return (slice.workflow_runtime?.workflow_runs ?? []).map((workflowRun) => {
    const runLedger = runLedgers.get(workflowRun.id) ?? null;
    const capability = capabilities.get(workflowRun.capability_id) ?? null;
    const events = eventsByCorrelation.get(workflowRun.id) ?? [];
    const agentRuns = agentRunsByWorkflow.get(workflowRun.id) ?? [];
    const gates = gatesByWorkflow.get(workflowRun.id) ?? [];
    const approvals = approvalsByWorkflow.get(workflowRun.id) ?? [];
    const outputArtifacts = (workflowRun.output_refs ?? []).map((id) => outputsById.get(id)).filter(Boolean);
    const failedGates = gates.filter((gate) => gate.status !== "passed");
    const blockingGates = gates.filter((gate) => gate.blocking && gate.status !== "passed");
    const runtimeSeconds = sumRuntimeSeconds(runLedger?.cost_records ?? []);

    return {
      run_id: runLedger?.id ?? `run-ledger.${workflowRun.id}`,
      source_id: source.source_id,
      source_label: source.label,
      workflow_run_id: workflowRun.id,
      capability_id: workflowRun.capability_id,
      domain_pack: capability?.domain_pack ?? inferDomainPackFromSource(source.source_id),
      tenant_id: workflowRun.tenant_id,
      matter_id: workflowRun.matter_id,
      status: workflowRun.status,
      blocked_reason: workflowRun.metadata?.blocked_reason ?? runLedger?.metadata?.blocked_reason ?? null,
      policy_snapshot_id: workflowRun.policy_snapshot_id,
      runtime_ids: unique(agentRuns.map((agentRun) => agentRun.runtime_id)),
      agent_run_count: agentRuns.length,
      event_count: events.length,
      gate_count: gates.length,
      failed_gate_count: failedGates.length,
      blocking_gate_count: blockingGates.length,
      pending_approval_count: approvals.filter((approval) => approval.approval_status === "pending").length,
      output_artifact_count: outputArtifacts.length,
      cost_record_count: runLedger?.cost_records?.length ?? 0,
      runtime_seconds: runtimeSeconds,
      error_count: runLedger?.error_records?.length ?? 0,
      started_at: workflowRun.created_at,
      updated_at: runLedger?.updated_at ?? workflowRun.created_at,
      metadata: {
        input_ref_count: workflowRun.input_refs?.length ?? 0,
        output_artifact_ids: outputArtifacts.map((artifact) => artifact.id),
        event_ledger_id: ledger.ledger_id ?? null,
      },
    };
  });
}

function extractEventRecords(source) {
  return (source.event_ledger.events ?? []).map((event) => ({
    event_id: event.id,
    source_id: source.source_id,
    source_label: source.label,
    event_type: event.type,
    time: event.time,
    tenant_id: event.tenant_id,
    workflow_run_id: event.correlation_id,
    causation_id: event.causation_id ?? null,
    actor_type: event.actor.actor_type,
    actor_id: event.actor.actor_id,
    subject_type: event.subject.subject_type,
    subject_id: event.subject.subject_id,
    policy_snapshot_id: event.policy_snapshot_id ?? null,
    data: event.data ?? {},
  }));
}

function extractCostRecords(source) {
  const runLedgers = source.event_ledger.run_ledgers ?? [];
  return runLedgers.flatMap((runLedger) => (runLedger.cost_records ?? []).map((costRecord) => ({
    cost_record_id: costRecord.cost_record_id,
    source_id: source.source_id,
    source_label: source.label,
    workflow_run_id: runLedger.workflow_run_id,
    capability_id: runLedger.capability_id,
    cost_type: costRecord.cost_type,
    amount: costRecord.amount,
    unit: costRecord.unit,
    created_at: costRecord.created_at,
    metadata: costRecord.metadata ?? {},
  })));
}

function summarizeObservability(sources, runRecords, eventRecords, costRecords) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    workflow_run_count: runRecords.length,
    run_ledger_count: sources.reduce((count, source) => count + source.run_ledger_count, 0),
    agent_run_count: runRecords.reduce((count, run) => count + run.agent_run_count, 0),
    event_count: eventRecords.length,
    gate_passed_count: eventRecords.filter((event) => event.event_type === "gate.passed").length,
    gate_failed_count: eventRecords.filter((event) => event.event_type === "gate.failed").length,
    failed_gate_count: runRecords.reduce((count, run) => count + run.failed_gate_count, 0),
    blocking_gate_count: runRecords.reduce((count, run) => count + run.blocking_gate_count, 0),
    approval_requested_count: eventRecords.filter((event) => event.event_type === "approval.requested").length,
    pending_approval_count: runRecords.reduce((count, run) => count + run.pending_approval_count, 0),
    output_rendered_count: eventRecords.filter((event) => event.event_type === "output.rendered").length,
    cost_record_count: costRecords.length,
    total_runtime_seconds: sumBy(costRecords.filter((record) => record.cost_type === "runtime_seconds"), "amount"),
    error_record_count: runRecords.reduce((count, run) => count + run.error_count, 0),
    blocked_run_count: runRecords.filter((run) => run.status === "blocked").length,
    completed_run_count: runRecords.filter((run) => run.status === "completed").length,
    by_event_type: countBy(eventRecords, "event_type"),
    by_runtime_id: countRuntimeIds(runRecords),
    by_run_status: countBy(runRecords, "status"),
    by_capability_id: countBy(runRecords, "capability_id"),
    by_source: countBy(runRecords, "source_id"),
  };
}

function sumRuntimeSeconds(costRecords) {
  return sumBy(costRecords.filter((record) => record.cost_type === "runtime_seconds"), "amount");
}

function renderObservabilityCatalogMarkdown(catalog) {
  const lines = [];
  lines.push("# Observability Catalog");
  lines.push("");
  lines.push(`Generated: ${catalog.generated_at}`);
  lines.push("");
  lines.push(`- Workflow runs: ${catalog.summary.workflow_run_count}`);
  lines.push(`- Events: ${catalog.summary.event_count}`);
  lines.push(`- Agent runs: ${catalog.summary.agent_run_count}`);
  lines.push(`- Pending approvals: ${catalog.summary.pending_approval_count}`);
  lines.push(`- Blocking gates: ${catalog.summary.blocking_gate_count}`);
  lines.push(`- Runtime seconds: ${catalog.summary.total_runtime_seconds}`);
  lines.push("");
  lines.push("## Runs");
  lines.push("");
  for (const run of catalog.run_records) {
    lines.push(`- ${run.workflow_run_id} (${run.capability_id}, ${run.status}, ${run.runtime_seconds}s)`);
  }
  if (catalog.run_records.length === 0) lines.push("- No workflow runs found.");
  return `${lines.join("\n")}\n`;
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function countRuntimeIds(runRecords) {
  const counts = new Map();
  for (const run of runRecords) {
    for (const runtimeId of run.runtime_ids) counts.set(runtimeId, (counts.get(runtimeId) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function unique(items) {
  return [...new Set(items)].sort();
}

function inferDomainPackFromSource(sourceId) {
  if (sourceId === "law_firm_ldd_slice" || sourceId === "vertical_slice") return "law-firm";
  if (sourceId === "personal_dev_slice") return "personal-dev";
  if (sourceId === "creative_document_slice") return "creative-document";
  return "platform";
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_OBSERVABILITY_CATALOG_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--vertical-ledger") parsed.verticalLedgerPath = argv[++index];
    else if (arg === "--no-vertical-slice") parsed.verticalSlicePath = false;
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--law-firm-ledger") parsed.lawFirmLedgerPath = argv[++index];
    else if (arg === "--no-law-firm-slice") parsed.lawFirmSlicePath = false;
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--personal-dev-ledger") parsed.personalDevLedgerPath = argv[++index];
    else if (arg === "--no-personal-dev-slice") parsed.personalDevSlicePath = false;
    else if (arg === "--creative-document-slice") parsed.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--creative-document-ledger") parsed.creativeDocumentLedgerPath = argv[++index];
    else if (arg === "--no-creative-document-slice") parsed.creativeDocumentSlicePath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/observability-catalog.mjs [options]

Options:
  --vertical-slice <path>              vertical-slice.json path.
  --vertical-ledger <path>             vertical slice event-ledger.json path.
  --no-vertical-slice                  Skip the first vertical slice source.
  --law-firm-slice <path>              law-firm-ldd-slice.json path.
  --law-firm-ledger <path>             Law Firm event-ledger.json path.
  --no-law-firm-slice                  Skip Law Firm LDD source.
  --personal-dev-slice <path>          personal-dev-slice.json path.
  --personal-dev-ledger <path>         Personal Dev event-ledger.json path.
  --no-personal-dev-slice              Skip Personal Dev source.
  --creative-document-slice <path>     creative-document-slice.json path.
  --creative-document-ledger <path>    Creative Document event-ledger.json path.
  --no-creative-document-slice         Skip Creative Document source.
  --out-dir <folder>                   Output directory.
  --run-at <iso>                       Deterministic generated_at timestamp.
  -h, --help                           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
