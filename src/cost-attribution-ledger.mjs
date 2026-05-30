import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_COST_ATTRIBUTION_LEDGER_OUT_DIR = "artifacts/cost-attribution/latest";
export const DEFAULT_COST_ATTRIBUTION_COST_BUDGET_LEDGER = "artifacts/cost-budget/latest/cost-budget-ledger.json";
export const DEFAULT_COST_ATTRIBUTION_TOKEN_USAGE_LEDGER = "artifacts/token-usage/latest/token-usage-ledger.json";
export const DEFAULT_COST_ATTRIBUTION_OBSERVABILITY_CATALOG = "artifacts/observability/latest/observability-catalog.json";
export const DEFAULT_ESTIMATED_TOKEN_USD_PER_1K = 0.002;

export async function runCostAttributionLedger(options = {}) {
  const result = await buildCostAttributionLedger(options);
  if (options.write !== false) await writeCostAttributionLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Cost attribution ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCostAttributionLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_COST_ATTRIBUTION_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const costBudgetLedgerPath = path.resolve(options.costBudgetLedgerPath ?? DEFAULT_COST_ATTRIBUTION_COST_BUDGET_LEDGER);
  const tokenUsageLedgerPath = path.resolve(options.tokenUsageLedgerPath ?? DEFAULT_COST_ATTRIBUTION_TOKEN_USAGE_LEDGER);
  const observabilityCatalogPath = path.resolve(options.observabilityCatalogPath ?? DEFAULT_COST_ATTRIBUTION_OBSERVABILITY_CATALOG);
  const estimatedTokenUsdPer1k = Number(options.estimatedTokenUsdPer1k ?? DEFAULT_ESTIMATED_TOKEN_USD_PER_1K);
  const costBudgetResult = await readJsonOrError(costBudgetLedgerPath);
  const tokenUsageResult = await readJsonOrError(tokenUsageLedgerPath);
  const observabilityResult = await readJsonOrError(observabilityCatalogPath);
  const indexes = buildIndexes({
    budget: costBudgetResult.value,
    tokens: tokenUsageResult.value,
    observability: observabilityResult.value,
  });
  const attributionRecords = (costBudgetResult.value?.budget_decisions ?? []).map((decision) => buildAttributionRecord(decision, indexes, {
    estimatedTokenUsdPer1k,
  }));
  const rollups = buildRollups(attributionRecords);
  const validation = validateCostAttributionLedger({
    costBudgetResult,
    tokenUsageResult,
    observabilityResult,
    estimatedTokenUsdPer1k,
    attributionRecords,
  });
  const ledger = {
    schema_version: "cost-attribution-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `cost-attribution-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cost_budget_ledger_path: costBudgetLedgerPath,
    token_usage_ledger_path: tokenUsageLedgerPath,
    observability_catalog_path: observabilityCatalogPath,
    estimated_token_usd_per_1k: estimatedTokenUsdPer1k,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeCostAttributionLedger({ attributionRecords, validation }),
    sources: buildSources({ costBudgetResult, tokenUsageResult, observabilityResult }, {
      costBudgetLedgerPath,
      tokenUsageLedgerPath,
      observabilityCatalogPath,
    }),
    attribution_records: attributionRecords,
    rollups,
    validation,
  };

  return {
    ...ledger,
    markdown: renderCostAttributionLedgerMarkdown(ledger),
  };
}

export async function writeCostAttributionLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "cost-attribution-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    cost_budget_ledger_path: result.cost_budget_ledger_path,
    token_usage_ledger_path: result.token_usage_ledger_path,
    observability_catalog_path: result.observability_catalog_path,
    estimated_token_usd_per_1k: result.estimated_token_usd_per_1k,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    attribution_records: result.attribution_records,
    rollups: result.rollups,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "cost-attribution-records.json"), {
    generated_at: result.generated_at,
    count: result.attribution_records.length,
    attribution_records: result.attribution_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCostAttributionLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCostAttributionLedger(args);
    console.log(`Cost attribution ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Attribution records: ${result.summary.attribution_record_count}`);
    console.log(`Projected USD: ${result.summary.total_projected_usd}`);
    console.log(`Over-budget records: ${result.summary.over_budget_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildIndexes({ tokens, observability }) {
  return {
    tokenUsageByBudgetDecision: new Map((tokens?.token_usage_records ?? []).map((record) => [record.budget_decision_id, record])),
    costRecordsByWorkflowCapability: groupBy(observability?.cost_records ?? [], (record) => costKey(record.workflow_run_id, record.capability_id)),
  };
}

function buildSources(results, paths) {
  return [
    source("cost_budget_ledger", "Cost Budget Ledger", paths.costBudgetLedgerPath, results.costBudgetResult),
    source("token_usage_ledger", "Token Usage Ledger", paths.tokenUsageLedgerPath, results.tokenUsageResult),
    source("observability_catalog", "Observability Catalog", paths.observabilityCatalogPath, results.observabilityResult),
  ];
}

function source(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    error: result.ok ? null : result.error,
  };
}

function buildAttributionRecord(decision, indexes, { estimatedTokenUsdPer1k }) {
  const tokenUsage = indexes.tokenUsageByBudgetDecision.get(decision.budget_decision_id) ?? null;
  const costRecords = indexes.costRecordsByWorkflowCapability.get(costKey(decision.workflow_run_id, decision.capability_id)) ?? [];
  const observedUsd = roundMoney(decision.observed_usd ?? sumObservedUsd(costRecords));
  const estimatedTokenUsd = roundMoney(((tokenUsage?.total_token_count ?? 0) / 1000) * estimatedTokenUsdPer1k);
  const projectedUsd = roundMoney(Math.max(observedUsd, estimatedTokenUsd));
  const maxUsd = typeof decision.max_usd === "number" ? decision.max_usd : null;
  const budgetRemainingUsd = maxUsd === null ? null : roundMoney(maxUsd - projectedUsd);
  const overBudget = maxUsd !== null && projectedUsd > maxUsd;
  const untrackedCost = decision.token_tracking_required && !tokenUsage;
  const status = decision.budget_status === "blocked" || overBudget
    ? "blocked"
    : untrackedCost
      ? "attention"
      : "attributed";
  return {
    attribution_id: `cost-attribution.${slugify(decision.budget_decision_id)}`,
    budget_decision_id: decision.budget_decision_id,
    token_usage_id: tokenUsage?.token_usage_id ?? null,
    routing_decision_id: decision.routing_decision_id,
    context_packet_id: decision.context_packet_id,
    workflow_run_id: decision.workflow_run_id,
    agent_run_id: decision.agent_run_id,
    runtime_id: decision.runtime_id,
    capability_id: decision.capability_id,
    domain_pack: decision.domain_pack,
    tenant_id: decision.tenant_id,
    matter_id: decision.matter_id,
    classification: decision.classification,
    budget_status: decision.budget_status,
    token_tracking_status: tokenUsage?.tracking_status ?? decision.token_tracking_status,
    attribution_status: status,
    max_usd: maxUsd,
    observed_usd: observedUsd,
    estimated_token_usd: estimatedTokenUsd,
    projected_usd: projectedUsd,
    budget_remaining_usd: budgetRemainingUsd,
    over_budget: overBudget,
    untracked_cost: untrackedCost,
    total_token_count: tokenUsage?.total_token_count ?? 0,
    observed_runtime_seconds: decision.observed_runtime_seconds ?? 0,
    cost_record_count: costRecords.length,
    required_gates: unique(["cost_budget_gate", ...(decision.required_gates ?? [])]),
    audit_required: true,
    attribution_hash: hashValue({
      budget_decision_id: decision.budget_decision_id,
      token_usage_id: tokenUsage?.token_usage_id ?? null,
      observedUsd,
      estimatedTokenUsd,
      projectedUsd,
      maxUsd,
      status,
    }),
    metadata: {
      cost_record_ids: costRecords.map((record) => record.cost_record_id),
      estimated_token_usd_per_1k: estimatedTokenUsdPer1k,
      estimate_source: tokenUsage?.estimated ? "token_usage_estimate" : tokenUsage ? "token_usage_record" : "cost_budget_only",
    },
  };
}

function buildRollups(records) {
  return {
    by_domain_pack: rollupBy(records, "domain_pack"),
    by_runtime_id: rollupBy(records, "runtime_id"),
    by_capability_id: rollupBy(records, "capability_id"),
    by_matter_id: rollupBy(records, "matter_id"),
  };
}

function rollupBy(records, key) {
  const groups = new Map();
  for (const record of records) {
    const value = record[key] ?? "unknown";
    if (!groups.has(value)) {
      groups.set(value, {
        key: value,
        record_count: 0,
        total_budget_usd: 0,
        total_observed_usd: 0,
        total_estimated_token_usd: 0,
        total_projected_usd: 0,
        total_token_count: 0,
        over_budget_count: 0,
      });
    }
    const group = groups.get(value);
    group.record_count += 1;
    group.total_budget_usd = roundMoney(group.total_budget_usd + Number(record.max_usd ?? 0));
    group.total_observed_usd = roundMoney(group.total_observed_usd + record.observed_usd);
    group.total_estimated_token_usd = roundMoney(group.total_estimated_token_usd + record.estimated_token_usd);
    group.total_projected_usd = roundMoney(group.total_projected_usd + record.projected_usd);
    group.total_token_count += record.total_token_count;
    group.over_budget_count += record.over_budget ? 1 : 0;
  }
  return [...groups.values()].sort((left, right) => String(left.key).localeCompare(String(right.key)));
}

function validateCostAttributionLedger({ costBudgetResult, tokenUsageResult, observabilityResult, estimatedTokenUsdPer1k, attributionRecords }) {
  const errors = [];
  if (!costBudgetResult.ok) errors.push({ path: "cost_budget_ledger", message: `Cost budget ledger unavailable: ${costBudgetResult.error}` });
  if (!tokenUsageResult.ok) errors.push({ path: "token_usage_ledger", message: `Token usage ledger unavailable: ${tokenUsageResult.error}` });
  if (!observabilityResult.ok) errors.push({ path: "observability_catalog", message: `Observability catalog unavailable: ${observabilityResult.error}` });
  if (!Number.isFinite(estimatedTokenUsdPer1k) || estimatedTokenUsdPer1k < 0) {
    errors.push({ path: "estimated_token_usd_per_1k", message: "Estimated token USD rate must be a non-negative number" });
  }
  for (const record of attributionRecords) {
    if (record.over_budget) {
      errors.push({
        path: `attribution_records.${record.attribution_id}.projected_usd`,
        message: `Projected USD ${record.projected_usd} exceeds max USD ${record.max_usd}`,
      });
    }
    if (record.untracked_cost) {
      errors.push({
        path: `attribution_records.${record.attribution_id}.token_usage_id`,
        message: "Token tracking is required but no token usage record was found",
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCostAttributionLedger({ attributionRecords, validation }) {
  const totalBudget = roundMoney(attributionRecords.reduce((sum, record) => sum + Number(record.max_usd ?? 0), 0));
  const totalProjected = roundMoney(attributionRecords.reduce((sum, record) => sum + record.projected_usd, 0));
  return {
    attribution_record_count: attributionRecords.length,
    attributed_record_count: attributionRecords.filter((record) => record.attribution_status === "attributed").length,
    attention_record_count: attributionRecords.filter((record) => record.attribution_status === "attention").length,
    blocked_record_count: attributionRecords.filter((record) => record.attribution_status === "blocked").length,
    over_budget_count: attributionRecords.filter((record) => record.over_budget).length,
    untracked_cost_count: attributionRecords.filter((record) => record.untracked_cost).length,
    total_budget_usd: totalBudget,
    total_observed_usd: roundMoney(attributionRecords.reduce((sum, record) => sum + record.observed_usd, 0)),
    total_estimated_token_usd: roundMoney(attributionRecords.reduce((sum, record) => sum + record.estimated_token_usd, 0)),
    total_projected_usd: totalProjected,
    total_budget_remaining_usd: roundMoney(totalBudget - totalProjected),
    total_token_count: attributionRecords.reduce((sum, record) => sum + record.total_token_count, 0),
    validation_error_count: validation.errors.length,
    by_attribution_status: countBy(attributionRecords, "attribution_status"),
    by_domain_pack: countBy(attributionRecords, "domain_pack"),
    by_runtime_id: countBy(attributionRecords, "runtime_id"),
    by_capability_id: countBy(attributionRecords, "capability_id"),
    by_matter_id: countBy(attributionRecords, "matter_id"),
  };
}

function renderCostAttributionLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Cost Attribution Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Attribution records: ${ledger.summary.attribution_record_count}`);
  lines.push(`- Attributed records: ${ledger.summary.attributed_record_count}`);
  lines.push(`- Attention records: ${ledger.summary.attention_record_count}`);
  lines.push(`- Blocked records: ${ledger.summary.blocked_record_count}`);
  lines.push(`- Total budget USD: ${ledger.summary.total_budget_usd}`);
  lines.push(`- Total observed USD: ${ledger.summary.total_observed_usd}`);
  lines.push(`- Total estimated token USD: ${ledger.summary.total_estimated_token_usd}`);
  lines.push(`- Total projected USD: ${ledger.summary.total_projected_usd}`);
  lines.push(`- Total token count: ${ledger.summary.total_token_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Records");
  lines.push("");
  for (const record of ledger.attribution_records) {
    lines.push(`- ${record.attribution_id}: ${record.attribution_status}, projected=$${record.projected_usd}, matter=${record.matter_id}, runtime=${record.runtime_id}`);
  }
  if (ledger.attribution_records.length === 0) lines.push("- No attribution records found.");
  if (ledger.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of ledger.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
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

function sumObservedUsd(costRecords) {
  return costRecords.reduce((sum, record) => {
    const type = String(record.cost_type ?? "").toLowerCase();
    const unit = String(record.unit ?? "").toLowerCase();
    return unit === "usd" || type.includes("usd") ? sum + Number(record.amount ?? 0) : sum;
  }, 0);
}

function costKey(workflowRunId, capabilityId) {
  return `${workflowRunId}:${capabilityId}`;
}

function groupBy(items, keyOrFn) {
  const groups = new Map();
  for (const item of items) {
    const value = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
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

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_COST_ATTRIBUTION_LEDGER_OUT_DIR,
    costBudgetLedgerPath: DEFAULT_COST_ATTRIBUTION_COST_BUDGET_LEDGER,
    tokenUsageLedgerPath: DEFAULT_COST_ATTRIBUTION_TOKEN_USAGE_LEDGER,
    observabilityCatalogPath: DEFAULT_COST_ATTRIBUTION_OBSERVABILITY_CATALOG,
    estimatedTokenUsdPer1k: DEFAULT_ESTIMATED_TOKEN_USD_PER_1K,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--cost-budget-ledger") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--token-usage-ledger") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--estimated-token-usd-per-1k") parsed.estimatedTokenUsdPer1k = Number(argv[++index]);
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/cost-attribution-ledger.mjs [options]

Options:
  --cost-budget-ledger <path>       cost-budget-ledger.json path.
  --token-usage-ledger <path>       token-usage-ledger.json path.
  --observability-catalog <path>    observability-catalog.json path.
  --estimated-token-usd-per-1k <n>  Deterministic estimated USD per 1k tokens.
  --out-dir <folder>                Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Exit non-zero when the ledger is invalid.
  -h, --help                        Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
