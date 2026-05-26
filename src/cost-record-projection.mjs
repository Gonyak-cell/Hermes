import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_COST_RECORD_PROJECTION_OUT_DIR = "artifacts/cost-record-projection/latest";
export const DEFAULT_COST_RECORD_PROJECTION_INPUTS = {
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  costAttributionLedgerPath: "artifacts/cost-attribution/latest/cost-attribution-ledger.json",
  tokenUsageLedgerPath: "artifacts/token-usage/latest/token-usage-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  toolInvocationLedgerPath: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "cost-record-projection.v1";
const RECORD_SCHEMA_VERSION = "projected-cost-record.v1";
const RUN_ROLLUP_SCHEMA_VERSION = "run-cost-rollup.v1";
const CATEGORY_ROLLUP_SCHEMA_VERSION = "cost-category-rollup.v1";

export async function runCostRecordProjection(options = {}) {
  const result = await buildCostRecordProjection(options);
  if (options.write !== false) await writeCostRecordProjection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Cost record projection validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCostRecordProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_COST_RECORD_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    observabilityCatalog: await readJsonOrError(inputs.observability_catalog_path),
    costAttributionLedger: await readJsonOrError(inputs.cost_attribution_ledger_path),
    tokenUsageLedger: await readJsonOrError(inputs.token_usage_ledger_path),
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    agentRunLedger: await readJsonOrError(inputs.agent_run_ledger_path),
    toolInvocationLedger: await readJsonOrError(inputs.tool_invocation_ledger_path),
    outputCatalog: await readJsonOrError(inputs.output_catalog_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };

  const projection = buildProjection(sources, generatedAt);
  const validationItems = validateCostRecordProjection({ sources, projection });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    cost_record_projection_id: `cost-record-projection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    cost_record_projection_contract: buildContract(generatedAt),
    cost_record_projection_catalog: {
      schema_version: "cost-record-projection-catalog.v1",
      generated_at: generatedAt,
      projected_cost_records: projection.projectedCostRecords,
      run_cost_rollups: projection.runCostRollups,
      cost_category_rollups: projection.costCategoryRollups,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeProjection(projection, validation),
  };
  return {
    ...result,
    markdown: renderCostRecordProjectionMarkdown(result),
  };
}

export async function writeCostRecordProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "cost-record-projection.json"), serializableProjection(result));
  await writeJson(path.join(outDir, "projected-cost-records.json"), {
    schema_version: "projected-cost-records.v1",
    generated_at: result.generated_at,
    projected_cost_record_count: result.cost_record_projection_catalog.projected_cost_records.length,
    projected_cost_records: result.cost_record_projection_catalog.projected_cost_records,
  });
  await writeJson(path.join(outDir, "run-cost-rollups.json"), {
    schema_version: "run-cost-rollups.v1",
    generated_at: result.generated_at,
    run_cost_rollup_count: result.cost_record_projection_catalog.run_cost_rollups.length,
    run_cost_rollups: result.cost_record_projection_catalog.run_cost_rollups,
  });
  await writeJson(path.join(outDir, "cost-category-rollups.json"), {
    schema_version: "cost-category-rollups.v1",
    generated_at: result.generated_at,
    cost_category_rollup_count: result.cost_record_projection_catalog.cost_category_rollups.length,
    cost_category_rollups: result.cost_record_projection_catalog.cost_category_rollups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "cost-record-projection-validation-report.v1",
    generated_at: result.generated_at,
    cost_record_projection_id: result.cost_record_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCostRecordProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCostRecordProjection(args);
    console.log(`Cost record projection written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.cost_record_projection_status}`);
    console.log(`Projected cost records: ${result.summary.projected_cost_record_count}`);
    console.log(`Run rollups: ${result.summary.run_cost_rollup_count}`);
    console.log(`Provider/runtime/storage/API: ${result.summary.provider_cost_record_count}/${result.summary.runtime_cost_record_count}/${result.summary.storage_cost_record_count}/${result.summary.api_cost_record_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildProjection(sources, generatedAt) {
  const observability = sources.observabilityCatalog.value ?? {};
  const attribution = sources.costAttributionLedger.value ?? {};
  const tokenUsage = sources.tokenUsageLedger.value ?? {};
  const workflowLedger = sources.workflowRunLedger.value ?? {};
  const agentLedger = sources.agentRunLedger.value ?? {};
  const toolLedger = sources.toolInvocationLedger.value ?? {};
  const outputCatalog = sources.outputCatalog.value ?? {};
  const workflowRecords = workflowLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const workflowById = new Map(workflowRecords.map((record) => [record.workflow_run_id, record]));
  const attributionByBudget = new Map((attribution.attribution_records ?? []).map((record) => [record.budget_decision_id, record]));
  const attributionByWorkflowCapability = groupBy(attribution.attribution_records ?? [], (record) => costKey(record.workflow_run_id, record.capability_id));
  const agentRunsByWorkflow = groupBy(agentLedger.agent_run_catalog?.agent_run_records ?? [], "workflow_run_id");
  const toolInvocationsByWorkflowTool = groupBy(toolLedger.tool_invocation_catalog?.tool_invocation_records ?? [], (record) => `${record.workflow_run_id}:${record.tool_id}`);
  const outputArtifactsByWorkflow = groupBy(outputCatalog.artifacts ?? [], "workflow_run_id");

  const runtimeRecords = (observability.cost_records ?? []).map((record) => rawCostRecordProjection({
    record,
    workflow: workflowById.get(record.workflow_run_id),
    attribution: attributionByWorkflowCapability.get(costKey(record.workflow_run_id, record.capability_id))?.[0],
    generatedAt,
  }));
  const providerRecords = (tokenUsage.token_usage_records ?? []).map((record) => providerTokenProjection({
    record,
    workflow: workflowById.get(record.workflow_run_id),
    attribution: attributionByBudget.get(record.budget_decision_id),
    generatedAt,
  }));
  const apiRecords = [...toolInvocationsByWorkflowTool.entries()].map(([key, records]) => {
    const [workflowRunId, toolId] = key.split(":");
    return apiToolProjection({
      workflowRunId,
      toolId,
      records,
      workflow: workflowById.get(workflowRunId),
      generatedAt,
    });
  });
  const storageRecords = [...outputArtifactsByWorkflow.entries()].map(([workflowRunId, artifacts]) => storageArtifactProjection({
    workflowRunId,
    artifacts,
    workflow: workflowById.get(workflowRunId),
    agentRuns: agentRunsByWorkflow.get(workflowRunId) ?? [],
    generatedAt,
  }));

  const projectedCostRecords = [
    ...runtimeRecords,
    ...providerRecords,
    ...apiRecords,
    ...storageRecords,
  ].sort(by("projected_cost_record_id"));
  const runCostRollups = buildRunCostRollups({ workflowRecords, projectedCostRecords, generatedAt });
  const costCategoryRollups = buildCostCategoryRollups(projectedCostRecords, generatedAt);
  return {
    projectedCostRecords,
    runCostRollups,
    costCategoryRollups,
    sourceCounts: {
      raw_cost_record_count: observability.summary?.cost_record_count ?? observability.cost_records?.length ?? 0,
      token_usage_record_count: tokenUsage.summary?.token_usage_record_count ?? tokenUsage.token_usage_records?.length ?? 0,
      workflow_run_record_count: workflowLedger.summary?.workflow_run_record_count ?? workflowRecords.length,
      tool_invocation_record_count: toolLedger.summary?.tool_invocation_record_count ?? toolLedger.tool_invocation_catalog?.tool_invocation_records?.length ?? 0,
      output_artifact_count: outputCatalog.summary?.artifact_count ?? outputCatalog.artifacts?.length ?? 0,
    },
  };
}

function rawCostRecordProjection({ record, workflow, attribution, generatedAt }) {
  const category = classifyCostCategory(record.cost_type, record.unit);
  const observedUsd = observedUsdFor(record);
  const runtimeSeconds = isRuntimeSeconds(record) ? Number(record.amount ?? 0) : 0;
  return baseProjectedCostRecord({
    projectionId: `cost-record.${slugify(record.cost_record_id)}`,
    sourceCostRecordId: record.cost_record_id,
    sourceRecordId: record.cost_record_id,
    sourceLedger: "observability_catalog",
    costCategory: category,
    costDriver: record.cost_type,
    workflow,
    fallback: {
      workflow_run_id: record.workflow_run_id,
      capability_id: record.capability_id,
      source_id: record.source_id,
      source_label: record.source_label,
    },
    meteredQuantity: Number(record.amount ?? 0),
    meteredUnit: record.unit,
    observedUsd,
    estimatedUsd: observedUsd,
    totalTokenCount: 0,
    runtimeSeconds,
    pricingStatus: observedUsd > 0 ? "priced_observed" : "unpriced_observed",
    recordedAt: record.created_at ?? generatedAt,
    generatedAt,
    metadata: {
      source_metadata: record.metadata ?? {},
      attribution_id: attribution?.attribution_id ?? null,
      budget_decision_id: attribution?.budget_decision_id ?? null,
    },
  });
}

function providerTokenProjection({ record, workflow, attribution, generatedAt }) {
  const estimatedUsd = roundMoney(attribution?.estimated_token_usd ?? 0);
  return baseProjectedCostRecord({
    projectionId: `cost-record.provider.${slugify(record.token_usage_id)}`,
    sourceCostRecordId: record.token_usage_id,
    sourceRecordId: record.token_usage_id,
    sourceLedger: "token_usage_ledger",
    costCategory: "provider",
    costDriver: "tokens",
    workflow,
    fallback: record,
    meteredQuantity: record.total_token_count ?? 0,
    meteredUnit: "tokens",
    observedUsd: 0,
    estimatedUsd,
    totalTokenCount: record.total_token_count ?? 0,
    runtimeSeconds: 0,
    pricingStatus: estimatedUsd > 0 ? "estimated" : "unpriced_estimate",
    recordedAt: generatedAt,
    generatedAt,
    metadata: {
      token_usage_id: record.token_usage_id,
      budget_decision_id: record.budget_decision_id,
      attribution_id: attribution?.attribution_id ?? null,
      input_token_count: record.input_token_count ?? 0,
      output_token_count: record.output_token_count ?? 0,
      tracking_status: record.tracking_status,
      estimation_method: record.estimation_method,
    },
  });
}

function apiToolProjection({ workflowRunId, toolId, records, workflow, generatedAt }) {
  const first = records[0] ?? {};
  return baseProjectedCostRecord({
    projectionId: `cost-record.api.${slugify(workflowRunId)}.${slugify(toolId)}`,
    sourceCostRecordId: null,
    sourceRecordId: toolId,
    sourceLedger: "tool_invocation_ledger",
    costCategory: "api",
    costDriver: "tool_invocations",
    workflow,
    fallback: first,
    meteredQuantity: records.length,
    meteredUnit: "invocations",
    observedUsd: 0,
    estimatedUsd: 0,
    totalTokenCount: 0,
    runtimeSeconds: 0,
    pricingStatus: "unpriced_observed",
    recordedAt: generatedAt,
    generatedAt,
    metadata: {
      tool_id: toolId,
      permitted_invocation_count: records.filter((record) => record.invocation_state === "permitted").length,
      blocked_invocation_count: records.filter((record) => record.invocation_state === "blocked").length,
      protected_action_invocation_count: records.filter((record) => record.protected_action).length,
      tool_invocation_ids: records.map((record) => record.tool_invocation_id),
      agent_run_ids: unique(records.map((record) => record.agent_run_id)),
    },
  });
}

function storageArtifactProjection({ workflowRunId, artifacts, workflow, agentRuns, generatedAt }) {
  const first = artifacts[0] ?? {};
  return baseProjectedCostRecord({
    projectionId: `cost-record.storage.${slugify(workflowRunId)}`,
    sourceCostRecordId: null,
    sourceRecordId: workflowRunId,
    sourceLedger: "output_artifact_catalog",
    costCategory: "storage",
    costDriver: "output_artifacts",
    workflow,
    fallback: {
      ...first,
      workflow_run_id: workflowRunId,
      created_by_run_id: first.created_by_run_id ?? agentRuns[0]?.agent_run_id,
    },
    meteredQuantity: artifacts.length,
    meteredUnit: "artifacts",
    observedUsd: 0,
    estimatedUsd: 0,
    totalTokenCount: 0,
    runtimeSeconds: 0,
    pricingStatus: "unpriced_observed",
    recordedAt: generatedAt,
    generatedAt,
    metadata: {
      artifact_ids: artifacts.map((artifact) => artifact.artifact_id),
      content_hash_count: artifacts.filter((artifact) => artifact.content_hash).length,
      artifact_types: unique(artifacts.map((artifact) => artifact.artifact_type)),
      agent_run_ids: unique([
        ...artifacts.map((artifact) => artifact.created_by_run_id),
        ...agentRuns.map((agentRun) => agentRun.agent_run_id),
      ]),
    },
  });
}

function baseProjectedCostRecord({
  projectionId,
  sourceCostRecordId,
  sourceRecordId,
  sourceLedger,
  costCategory,
  costDriver,
  workflow,
  fallback,
  meteredQuantity,
  meteredUnit,
  observedUsd,
  estimatedUsd,
  totalTokenCount,
  runtimeSeconds,
  pricingStatus,
  recordedAt,
  generatedAt,
  metadata,
}) {
  const workflowRunId = workflow?.workflow_run_id ?? fallback?.workflow_run_id ?? null;
  const record = {
    schema_version: RECORD_SCHEMA_VERSION,
    projected_cost_record_id: projectionId,
    source_cost_record_id: sourceCostRecordId,
    source_record_id: sourceRecordId,
    source_ledger: sourceLedger,
    workflow_run_id: workflowRunId,
    run_ledger_id: workflow?.run_ledger_id ?? fallback?.run_ledger_id ?? null,
    correlation_id: workflow?.correlation_id ?? fallback?.correlation_id ?? workflowRunId,
    correlation_trace_id: workflow?.correlation_trace_id ?? fallback?.correlation_trace_id ?? null,
    agent_run_id: fallback?.agent_run_id ?? fallback?.created_by_run_id ?? null,
    runtime_id: fallback?.runtime_id ?? workflow?.runtime_id ?? "unknown",
    capability_id: workflow?.capability_id ?? fallback?.capability_id ?? null,
    domain_pack: workflow?.domain_pack ?? fallback?.domain_pack ?? null,
    tenant_id: workflow?.tenant_id ?? fallback?.tenant_id ?? null,
    matter_id: workflow?.matter_id ?? fallback?.matter_id ?? null,
    policy_snapshot_id: workflow?.policy_snapshot_id ?? fallback?.policy_snapshot_id ?? null,
    cost_category: costCategory,
    cost_driver: costDriver,
    metered_quantity: Number(meteredQuantity ?? 0),
    metered_unit: meteredUnit ?? "count",
    observed_usd: roundMoney(observedUsd),
    estimated_usd: roundMoney(estimatedUsd),
    projected_usd: roundMoney(Math.max(Number(observedUsd ?? 0), Number(estimatedUsd ?? 0))),
    total_token_count: Number(totalTokenCount ?? 0),
    runtime_seconds: Number(runtimeSeconds ?? 0),
    pricing_status: pricingStatus,
    attribution_status: workflowRunId ? "run_attributed" : "run_missing",
    audit_required: true,
    recorded_at: recordedAt,
    projected_at: generatedAt,
    metadata: metadata ?? {},
  };
  return {
    ...record,
    cost_hash: hashValue({
      projected_cost_record_id: record.projected_cost_record_id,
      workflow_run_id: record.workflow_run_id,
      source_ledger: record.source_ledger,
      source_record_id: record.source_record_id,
      cost_category: record.cost_category,
      metered_quantity: record.metered_quantity,
      metered_unit: record.metered_unit,
      projected_usd: record.projected_usd,
    }),
  };
}

function buildRunCostRollups({ workflowRecords, projectedCostRecords, generatedAt }) {
  const recordsByWorkflow = groupBy(projectedCostRecords, "workflow_run_id");
  return workflowRecords.map((workflow) => {
    const records = recordsByWorkflow.get(workflow.workflow_run_id) ?? [];
    const categoryCounts = countBy(records, "cost_category");
    return {
      schema_version: RUN_ROLLUP_SCHEMA_VERSION,
      run_cost_rollup_id: `run-cost-rollup.${slugify(workflow.workflow_run_id)}`,
      workflow_run_id: workflow.workflow_run_id,
      run_ledger_id: workflow.run_ledger_id,
      correlation_id: workflow.correlation_id,
      correlation_trace_id: workflow.correlation_trace_id,
      tenant_id: workflow.tenant_id,
      matter_id: workflow.matter_id,
      capability_id: workflow.capability_id,
      domain_pack: workflow.domain_pack,
      run_status: workflow.run_status,
      policy_snapshot_id: workflow.policy_snapshot_id ?? null,
      projected_cost_record_count: records.length,
      provider_cost_record_count: categoryCounts.provider ?? 0,
      runtime_cost_record_count: categoryCounts.runtime ?? 0,
      storage_cost_record_count: categoryCounts.storage ?? 0,
      api_cost_record_count: categoryCounts.api ?? 0,
      total_observed_usd: roundMoney(records.reduce((sum, record) => sum + record.observed_usd, 0)),
      total_estimated_usd: roundMoney(records.reduce((sum, record) => sum + record.estimated_usd, 0)),
      total_projected_usd: roundMoney(records.reduce((sum, record) => sum + record.projected_usd, 0)),
      total_token_count: records.reduce((sum, record) => sum + record.total_token_count, 0),
      total_runtime_seconds: roundNumber(records.reduce((sum, record) => sum + record.runtime_seconds, 0)),
      api_invocation_count: records.filter((record) => record.cost_category === "api").reduce((sum, record) => sum + record.metered_quantity, 0),
      storage_artifact_count: records.filter((record) => record.cost_category === "storage").reduce((sum, record) => sum + record.metered_quantity, 0),
      pricing_status: records.every((record) => record.pricing_status.startsWith("priced")) ? "priced" : "partially_unpriced",
      attribution_status: records.length > 0 ? "run_attributed" : "missing_cost_records",
      projected_at: generatedAt,
      projected_cost_record_ids: records.map((record) => record.projected_cost_record_id),
    };
  }).sort(by("run_cost_rollup_id"));
}

function buildCostCategoryRollups(records, generatedAt) {
  return ["provider", "runtime", "storage", "api"].map((category) => {
    const categoryRecords = records.filter((record) => record.cost_category === category);
    return {
      schema_version: CATEGORY_ROLLUP_SCHEMA_VERSION,
      cost_category_rollup_id: `cost-category-rollup.${category}`,
      cost_category: category,
      projected_cost_record_count: categoryRecords.length,
      total_observed_usd: roundMoney(categoryRecords.reduce((sum, record) => sum + record.observed_usd, 0)),
      total_estimated_usd: roundMoney(categoryRecords.reduce((sum, record) => sum + record.estimated_usd, 0)),
      total_projected_usd: roundMoney(categoryRecords.reduce((sum, record) => sum + record.projected_usd, 0)),
      total_metered_quantity: roundNumber(categoryRecords.reduce((sum, record) => sum + record.metered_quantity, 0)),
      total_token_count: categoryRecords.reduce((sum, record) => sum + record.total_token_count, 0),
      total_runtime_seconds: roundNumber(categoryRecords.reduce((sum, record) => sum + record.runtime_seconds, 0)),
      priced_record_count: categoryRecords.filter((record) => record.pricing_status.startsWith("priced")).length,
      unpriced_record_count: categoryRecords.filter((record) => record.pricing_status.startsWith("unpriced")).length,
      estimated_record_count: categoryRecords.filter((record) => record.pricing_status === "estimated").length,
      projected_at: generatedAt,
    };
  });
}

function validateCostRecordProjection({ sources, projection }) {
  const items = [];
  for (const [sourceId, result] of Object.entries(sources)) {
    if (sourceId === "roadmap") {
      items.push(validationItem(`source.${sourceId}`, `source_${sourceId}_available`, result.ok, result.ok ? "Roadmap was read." : `Roadmap unavailable: ${result.error}`));
      continue;
    }
    if (sourceId === "packageJson") {
      items.push(validationItem(`source.${sourceId}`, `source_${sourceId}_available`, result.ok, result.ok ? "package.json was read." : `package.json unavailable: ${result.error}`));
      continue;
    }
    items.push(validationItem(`source.${sourceId}`, `source_${sourceId}_available`, result.ok, result.ok ? `${sourceId} is available.` : `${sourceId} unavailable: ${result.error}`));
  }
  const packageScripts = sources.packageJson.value?.scripts ?? {};
  items.push(validationItem("package.scripts.cost:records", "package_script_declared", Boolean(packageScripts["cost:records"]), "`cost:records` package script must be declared."));
  items.push(validationItem("roadmap.phase_168", "roadmap_phase_declared", String(sources.roadmap.value ?? "").includes("Phase 168: Cost Record Projection"), "Phase 168 roadmap entry must be declared."));

  const summary = summarizeProjection(projection, { errors: [] });
  items.push(validationItem("projected_cost_records", "projection_records_present", summary.projected_cost_record_count > 0, "Projected cost records must be produced."));
  items.push(validationItem("projected_cost_records.runtime", "runtime_costs_present", summary.runtime_cost_record_count > 0, "Runtime cost records must be projected."));
  items.push(validationItem("projected_cost_records.provider", "provider_costs_present", summary.provider_cost_record_count > 0, "Provider/token cost records must be projected."));
  items.push(validationItem("projected_cost_records.storage", "storage_costs_present", summary.storage_cost_record_count > 0, "Storage/artifact cost records must be projected."));
  items.push(validationItem("projected_cost_records.api", "api_costs_present", summary.api_cost_record_count > 0, "API/tool invocation cost records must be projected."));
  items.push(validationItem("projected_cost_records.raw_count", "raw_cost_records_projected", summary.raw_cost_record_count === projection.sourceCounts.raw_cost_record_count, "Raw observability cost record count must match projection."));
  items.push(validationItem("projected_cost_records.provider_count", "token_usage_records_projected", summary.provider_cost_record_count === projection.sourceCounts.token_usage_record_count, "Token usage record count must match provider projections."));
  items.push(validationItem("run_cost_rollups", "all_workflow_runs_have_rollups", summary.run_cost_rollup_count === projection.sourceCounts.workflow_run_record_count, "Each workflow run must have a run cost rollup."));
  items.push(validationItem("run_cost_rollups", "all_workflow_runs_attributed", summary.missing_run_cost_rollup_count === 0, "Each workflow run must have at least one cost record."));
  items.push(validationItem("projected_cost_records", "all_records_run_attributed", summary.run_missing_record_count === 0, "Every projected cost record must be attributed to a workflow run."));
  items.push(validationItem("projected_cost_records", "cost_hashes_present", projection.projectedCostRecords.every((record) => record.cost_hash), "Every projected cost record must have a cost hash."));
  items.push(validationItem("projected_cost_records", "estimated_usd_matches_cost_attribution", summary.total_estimated_usd === roundMoney(sources.costAttributionLedger.value?.summary?.total_estimated_token_usd ?? 0), "Projected estimated USD must match Cost Attribution estimated token USD."));
  return items;
}

function summarizeProjection(projection, validation) {
  const records = projection.projectedCostRecords;
  const runRollups = projection.runCostRollups;
  return {
    cost_record_projection_status: validation.errors.length === 0 ? "complete" : "blocked",
    cost_record_projection_contract_id: CONTRACT_ID,
    projected_cost_record_count: records.length,
    raw_cost_record_count: records.filter((record) => record.source_ledger === "observability_catalog").length,
    provider_cost_record_count: records.filter((record) => record.cost_category === "provider").length,
    runtime_cost_record_count: records.filter((record) => record.cost_category === "runtime").length,
    storage_cost_record_count: records.filter((record) => record.cost_category === "storage").length,
    api_cost_record_count: records.filter((record) => record.cost_category === "api").length,
    run_cost_rollup_count: runRollups.length,
    attributed_run_cost_rollup_count: runRollups.filter((rollup) => rollup.attribution_status === "run_attributed").length,
    missing_run_cost_rollup_count: runRollups.filter((rollup) => rollup.attribution_status === "missing_cost_records").length,
    run_missing_record_count: records.filter((record) => record.attribution_status === "run_missing").length,
    priced_record_count: records.filter((record) => record.pricing_status.startsWith("priced")).length,
    estimated_record_count: records.filter((record) => record.pricing_status === "estimated").length,
    unpriced_record_count: records.filter((record) => record.pricing_status.startsWith("unpriced")).length,
    total_observed_usd: roundMoney(records.reduce((sum, record) => sum + record.observed_usd, 0)),
    total_estimated_usd: roundMoney(records.reduce((sum, record) => sum + record.estimated_usd, 0)),
    total_projected_usd: roundMoney(records.reduce((sum, record) => sum + record.projected_usd, 0)),
    total_token_count: records.reduce((sum, record) => sum + record.total_token_count, 0),
    total_runtime_seconds: roundNumber(records.reduce((sum, record) => sum + record.runtime_seconds, 0)),
    api_invocation_count: records.filter((record) => record.cost_category === "api").reduce((sum, record) => sum + record.metered_quantity, 0),
    storage_artifact_count: records.filter((record) => record.cost_category === "storage").reduce((sum, record) => sum + record.metered_quantity, 0),
    validation_item_count: validation.items?.length ?? 0,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_cost_category: countBy(records, "cost_category"),
    by_source_ledger: countBy(records, "source_ledger"),
    by_runtime_id: countBy(records, "runtime_id"),
    by_domain_pack: countBy(records, "domain_pack"),
    by_pricing_status: countBy(records, "pricing_status"),
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "cost-record-projection-contract.v1",
    generated_at: generatedAt,
    cost_record_projection_contract_id: CONTRACT_ID,
    required_cost_categories: ["provider", "runtime", "storage", "api"],
    required_record_fields: ["workflow_run_id", "run_ledger_id", "cost_category", "metered_quantity", "metered_unit", "projected_usd", "cost_hash"],
    run_attribution_rule: "Every projected cost record must be attributed to a workflow run and roll up by run ledger.",
    pricing_rule: "Unpriced runtime, storage, and API meters are retained as operational cost records with projected_usd=0 until real provider rates are configured.",
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    observability_catalog: sourceContract(sources.observabilityCatalog, inputs.observability_catalog_path, {
      cost_record_count: sources.observabilityCatalog.value?.summary?.cost_record_count ?? 0,
      total_runtime_seconds: sources.observabilityCatalog.value?.summary?.total_runtime_seconds ?? 0,
    }),
    cost_attribution_ledger: sourceContract(sources.costAttributionLedger, inputs.cost_attribution_ledger_path, {
      ledger_status: sources.costAttributionLedger.value?.ledger_status ?? null,
      attribution_record_count: sources.costAttributionLedger.value?.summary?.attribution_record_count ?? 0,
    }),
    token_usage_ledger: sourceContract(sources.tokenUsageLedger, inputs.token_usage_ledger_path, {
      ledger_status: sources.tokenUsageLedger.value?.ledger_status ?? null,
      token_usage_record_count: sources.tokenUsageLedger.value?.summary?.token_usage_record_count ?? 0,
    }),
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, {
      workflow_run_ledger_status: sources.workflowRunLedger.value?.summary?.workflow_run_ledger_status ?? null,
      workflow_run_record_count: sources.workflowRunLedger.value?.summary?.workflow_run_record_count ?? 0,
    }),
    agent_run_ledger: sourceContract(sources.agentRunLedger, inputs.agent_run_ledger_path, {
      agent_run_ledger_status: sources.agentRunLedger.value?.summary?.agent_run_ledger_status ?? null,
      agent_run_record_count: sources.agentRunLedger.value?.summary?.agent_run_record_count ?? 0,
    }),
    tool_invocation_ledger: sourceContract(sources.toolInvocationLedger, inputs.tool_invocation_ledger_path, {
      tool_invocation_ledger_status: sources.toolInvocationLedger.value?.summary?.tool_invocation_ledger_status ?? null,
      tool_invocation_record_count: sources.toolInvocationLedger.value?.summary?.tool_invocation_record_count ?? 0,
    }),
    output_catalog: sourceContract(sources.outputCatalog, inputs.output_catalog_path, {
      artifact_count: sources.outputCatalog.value?.summary?.artifact_count ?? 0,
    }),
  };
}

function sourceContract(result, sourcePath, metrics) {
  return {
    source_path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    error: result.ok ? null : result.error,
    ...metrics,
  };
}

function renderCostRecordProjectionMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Cost Record Projection");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.cost_record_projection_status}`);
  lines.push("");
  lines.push(`- Projected cost records: ${summary.projected_cost_record_count}`);
  lines.push(`- Run cost rollups: ${summary.run_cost_rollup_count}`);
  lines.push(`- Provider records: ${summary.provider_cost_record_count}`);
  lines.push(`- Runtime records: ${summary.runtime_cost_record_count}`);
  lines.push(`- Storage records: ${summary.storage_cost_record_count}`);
  lines.push(`- API records: ${summary.api_cost_record_count}`);
  lines.push(`- Total estimated USD: ${summary.total_estimated_usd}`);
  lines.push(`- Total runtime seconds: ${summary.total_runtime_seconds}`);
  lines.push(`- API invocations: ${summary.api_invocation_count}`);
  lines.push(`- Storage artifacts: ${summary.storage_artifact_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Run Rollups");
  lines.push("");
  for (const rollup of result.cost_record_projection_catalog.run_cost_rollups) {
    lines.push(`- ${rollup.workflow_run_id}: records=${rollup.projected_cost_record_count}, estimated=$${rollup.total_estimated_usd}, runtime=${rollup.total_runtime_seconds}s, api=${rollup.api_invocation_count}, storage=${rollup.storage_artifact_count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableProjection(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    cost_record_projection_id: result.cost_record_projection_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_contracts: result.source_contracts,
    cost_record_projection_contract: result.cost_record_projection_contract,
    cost_record_projection_catalog: result.cost_record_projection_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function normalizeInputs(options) {
  return {
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.observabilityCatalogPath),
    cost_attribution_ledger_path: path.resolve(options.costAttributionLedgerPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.costAttributionLedgerPath),
    token_usage_ledger_path: path.resolve(options.tokenUsageLedgerPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.tokenUsageLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.workflowRunLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.agentRunLedgerPath),
    tool_invocation_ledger_path: path.resolve(options.toolInvocationLedgerPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.toolInvocationLedgerPath),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.outputCatalogPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_COST_RECORD_PROJECTION_INPUTS.roadmapPath),
  };
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
    return { ok: true, value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return {
      ok: false,
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function classifyCostCategory(costType, unit) {
  const type = String(costType ?? "").toLowerCase();
  const normalizedUnit = String(unit ?? "").toLowerCase();
  if (type.includes("token") || normalizedUnit.includes("token")) return "provider";
  if (type.includes("storage") || normalizedUnit.includes("byte") || normalizedUnit.includes("artifact")) return "storage";
  if (type.includes("api") || normalizedUnit.includes("request") || normalizedUnit.includes("invocation")) return "api";
  return "runtime";
}

function isRuntimeSeconds(record) {
  return String(record.cost_type ?? "").toLowerCase().includes("runtime") || String(record.unit ?? "").toLowerCase() === "seconds";
}

function observedUsdFor(record) {
  const type = String(record.cost_type ?? "").toLowerCase();
  const unit = String(record.unit ?? "").toLowerCase();
  return unit === "usd" || type.includes("usd") ? roundMoney(record.amount) : 0;
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
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function groupBy(items, keyOrFn) {
  const groups = new Map();
  for (const item of items ?? []) {
    const value = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    const key = value ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function costKey(workflowRunId, capabilityId) {
  return `${workflowRunId}:${capabilityId}`;
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 10000) / 10000;
}

function roundNumber(value) {
  return Math.round(Number(value ?? 0) * 10000) / 10000;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_COST_RECORD_PROJECTION_OUT_DIR,
    observabilityCatalogPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.observabilityCatalogPath,
    costAttributionLedgerPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.costAttributionLedgerPath,
    tokenUsageLedgerPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.tokenUsageLedgerPath,
    workflowRunLedgerPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.workflowRunLedgerPath,
    agentRunLedgerPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.agentRunLedgerPath,
    toolInvocationLedgerPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.toolInvocationLedgerPath,
    outputCatalogPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.outputCatalogPath,
    packagePath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.packagePath,
    roadmapPath: DEFAULT_COST_RECORD_PROJECTION_INPUTS.roadmapPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--cost-attribution-ledger") parsed.costAttributionLedgerPath = argv[++index];
    else if (arg === "--token-usage-ledger") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--tool-invocation-ledger") parsed.toolInvocationLedgerPath = argv[++index];
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/cost-record-projection.mjs [options]

Options:
  --observability-catalog <path>      observability-catalog.json path.
  --cost-attribution-ledger <path>    cost-attribution-ledger.json path.
  --token-usage-ledger <path>         token-usage-ledger.json path.
  --workflow-run-ledger <path>        workflow-run-ledger.json path.
  --agent-run-ledger <path>           agent-run-ledger.json path.
  --tool-invocation-ledger <path>     tool-invocation-ledger.json path.
  --output-catalog <path>             output-catalog.json path.
  --package <path>                    package.json path.
  --roadmap <path>                    implementation-roadmap.md path.
  --out-dir <folder>                  Output directory.
  --run-at <iso>                      Deterministic generated_at timestamp.
  --check                             Exit non-zero when the projection is invalid.
  -h, --help                          Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
