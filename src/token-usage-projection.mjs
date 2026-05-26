import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TOKEN_USAGE_PROJECTION_OUT_DIR = "artifacts/token-usage-projection/latest";
export const DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS = {
  tokenUsageLedgerPath: "artifacts/token-usage/latest/token-usage-ledger.json",
  costRecordProjectionPath: "artifacts/cost-record-projection/latest/cost-record-projection.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "token-usage-projection.v1";
const RECORD_SCHEMA_VERSION = "projected-token-usage-record.v1";
const ROLLUP_SCHEMA_VERSION = "token-usage-rollup.v1";

export async function runTokenUsageProjection(options = {}) {
  const result = await buildTokenUsageProjection(options);
  if (options.write !== false) await writeTokenUsageProjection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Token usage projection validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTokenUsageProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TOKEN_USAGE_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    tokenUsageLedger: await readJsonOrError(inputs.token_usage_ledger_path),
    costRecordProjection: await readJsonOrError(inputs.cost_record_projection_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const projection = buildProjection(sources, generatedAt);
  const validationItems = validateTokenUsageProjection({ sources, projection });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    token_usage_projection_id: `token-usage-projection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    token_usage_projection_contract: buildContract(generatedAt),
    token_usage_projection_catalog: {
      schema_version: "token-usage-projection-catalog.v1",
      generated_at: generatedAt,
      projected_token_usage_records: projection.projectedTokenUsageRecords,
      capability_token_rollups: projection.capabilityTokenRollups,
      runtime_token_rollups: projection.runtimeTokenRollups,
      capability_runtime_token_rollups: projection.capabilityRuntimeTokenRollups,
      domain_pack_token_rollups: projection.domainPackTokenRollups,
      matter_token_rollups: projection.matterTokenRollups,
      tracking_status_token_rollups: projection.trackingStatusTokenRollups,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeProjection(projection, validation),
  };
  return {
    ...result,
    markdown: renderTokenUsageProjectionMarkdown(result),
  };
}

export async function writeTokenUsageProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "token-usage-projection.json"), serializableProjection(result));
  await writeJson(path.join(outDir, "projected-token-usage-records.json"), {
    schema_version: "projected-token-usage-records.v1",
    generated_at: result.generated_at,
    projected_token_usage_record_count: result.token_usage_projection_catalog.projected_token_usage_records.length,
    projected_token_usage_records: result.token_usage_projection_catalog.projected_token_usage_records,
  });
  await writeJson(path.join(outDir, "token-capability-rollups.json"), {
    schema_version: "token-capability-rollups.v1",
    generated_at: result.generated_at,
    capability_token_rollup_count: result.token_usage_projection_catalog.capability_token_rollups.length,
    capability_token_rollups: result.token_usage_projection_catalog.capability_token_rollups,
  });
  await writeJson(path.join(outDir, "token-runtime-rollups.json"), {
    schema_version: "token-runtime-rollups.v1",
    generated_at: result.generated_at,
    runtime_token_rollup_count: result.token_usage_projection_catalog.runtime_token_rollups.length,
    runtime_token_rollups: result.token_usage_projection_catalog.runtime_token_rollups,
  });
  await writeJson(path.join(outDir, "token-capability-runtime-rollups.json"), {
    schema_version: "token-capability-runtime-rollups.v1",
    generated_at: result.generated_at,
    capability_runtime_token_rollup_count: result.token_usage_projection_catalog.capability_runtime_token_rollups.length,
    capability_runtime_token_rollups: result.token_usage_projection_catalog.capability_runtime_token_rollups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "token-usage-projection-validation-report.v1",
    generated_at: result.generated_at,
    token_usage_projection_id: result.token_usage_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTokenUsageProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runTokenUsageProjection(args);
    console.log(`Token usage projection written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.token_usage_projection_status}`);
    console.log(`Projected token usage records: ${result.summary.projected_token_usage_record_count}`);
    console.log(`Capability/runtime rollups: ${result.summary.capability_token_rollup_count}/${result.summary.runtime_token_rollup_count}`);
    console.log(`Input/output/cache/total: ${result.summary.total_input_token_count}/${result.summary.total_output_token_count}/${result.summary.total_cache_token_count}/${result.summary.total_token_count}`);
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
  const tokenUsageLedger = sources.tokenUsageLedger.value ?? {};
  const costRecordProjection = sources.costRecordProjection.value ?? {};
  const providerCostRecordsByTokenUsageId = new Map(
    (costRecordProjection.cost_record_projection_catalog?.projected_cost_records ?? [])
      .filter((record) => record.cost_category === "provider")
      .map((record) => [record.source_record_id, record]),
  );
  const projectedTokenUsageRecords = (tokenUsageLedger.token_usage_records ?? [])
    .map((record) => projectedTokenUsageRecord({
      record,
      providerCostRecord: providerCostRecordsByTokenUsageId.get(record.token_usage_id) ?? null,
      generatedAt,
    }))
    .sort(by("projected_token_usage_record_id"));
  return {
    projectedTokenUsageRecords,
    capabilityTokenRollups: buildTokenRollups(projectedTokenUsageRecords, "capability_id", "capability-token-rollup", generatedAt),
    runtimeTokenRollups: buildTokenRollups(projectedTokenUsageRecords, "runtime_id", "runtime-token-rollup", generatedAt),
    capabilityRuntimeTokenRollups: buildTokenRollups(projectedTokenUsageRecords, (record) => `${record.capability_id}:${record.runtime_id}`, "capability-runtime-token-rollup", generatedAt),
    domainPackTokenRollups: buildTokenRollups(projectedTokenUsageRecords, "domain_pack", "domain-pack-token-rollup", generatedAt),
    matterTokenRollups: buildTokenRollups(projectedTokenUsageRecords, "matter_id", "matter-token-rollup", generatedAt),
    trackingStatusTokenRollups: buildTokenRollups(projectedTokenUsageRecords, "tracking_status", "tracking-status-token-rollup", generatedAt),
    sourceCounts: {
      token_usage_record_count: tokenUsageLedger.summary?.token_usage_record_count ?? tokenUsageLedger.token_usage_records?.length ?? 0,
      provider_cost_record_count: (costRecordProjection.cost_record_projection_catalog?.projected_cost_records ?? []).filter((record) => record.cost_category === "provider").length,
      ledger_total_input_token_count: tokenUsageLedger.summary?.total_input_token_count ?? 0,
      ledger_total_output_token_count: tokenUsageLedger.summary?.total_output_token_count ?? 0,
      ledger_total_token_count: tokenUsageLedger.summary?.total_token_count ?? 0,
    },
  };
}

function projectedTokenUsageRecord({ record, providerCostRecord, generatedAt }) {
  const inputTokenCount = Number(record.input_token_count ?? 0);
  const outputTokenCount = Number(record.output_token_count ?? 0);
  const cacheTokenCount = Number(record.cache_token_count ?? record.cached_token_count ?? record.metadata?.cache_token_count ?? 0);
  const totalTokenCount = Number(record.total_token_count ?? inputTokenCount + outputTokenCount + cacheTokenCount);
  const projection = {
    schema_version: RECORD_SCHEMA_VERSION,
    projected_token_usage_record_id: `projected-token-usage.${slugify(record.token_usage_id)}`,
    token_usage_id: record.token_usage_id,
    budget_decision_id: record.budget_decision_id,
    routing_decision_id: record.routing_decision_id,
    context_packet_id: record.context_packet_id,
    workflow_run_id: record.workflow_run_id,
    agent_run_id: record.agent_run_id,
    runtime_id: record.runtime_id,
    capability_id: record.capability_id,
    domain_pack: record.domain_pack,
    tenant_id: record.tenant_id,
    matter_id: record.matter_id,
    classification: record.classification,
    tracking_status: record.tracking_status,
    estimation_method: record.estimation_method,
    input_token_count: inputTokenCount,
    output_token_count: outputTokenCount,
    cache_token_count: cacheTokenCount,
    total_token_count: totalTokenCount,
    context_item_count: record.context_item_count ?? 0,
    context_mode: record.context_mode ?? "unknown",
    redaction_applied: Boolean(record.redaction_applied),
    token_record_count: record.token_record_count ?? 0,
    provider_cost_record_id: providerCostRecord?.projected_cost_record_id ?? null,
    provider_cost_projected_usd: providerCostRecord?.projected_usd ?? 0,
    provider_cost_binding_status: providerCostRecord ? "bound" : "missing_provider_cost_record",
    audit_required: true,
    projected_at: generatedAt,
    metadata: {
      source_usage_hash: record.usage_hash ?? null,
      cost_record_ids: record.cost_record_ids ?? [],
      required_gates: record.required_gates ?? [],
    },
  };
  return {
    ...projection,
    token_usage_hash: hashValue(projection),
  };
}

function buildTokenRollups(records, groupKey, prefix, generatedAt) {
  return [...groupBy(records, groupKey).entries()]
    .map(([key, groupedRecords]) => {
      const [capabilityId, runtimeId] = prefix === "capability-runtime-token-rollup" ? String(key).split(":") : [null, null];
      return {
        schema_version: ROLLUP_SCHEMA_VERSION,
        token_rollup_id: `${prefix}.${slugify(key)}`,
        rollup_type: prefix.replace(/-token-rollup$/, "").replace(/-/g, "_"),
        rollup_key: key,
        capability_id: capabilityId ?? (prefix === "capability-token-rollup" ? key : null),
        runtime_id: runtimeId ?? (prefix === "runtime-token-rollup" ? key : null),
        domain_pack: prefix === "domain-pack-token-rollup" ? key : null,
        matter_id: prefix === "matter-token-rollup" ? key : null,
        tracking_status: prefix === "tracking-status-token-rollup" ? key : null,
        projected_token_usage_record_count: groupedRecords.length,
        input_token_count: sum(groupedRecords, "input_token_count"),
        output_token_count: sum(groupedRecords, "output_token_count"),
        cache_token_count: sum(groupedRecords, "cache_token_count"),
        total_token_count: sum(groupedRecords, "total_token_count"),
        estimated_record_count: groupedRecords.filter((record) => record.tracking_status === "estimated").length,
        recorded_record_count: groupedRecords.filter((record) => record.tracking_status === "recorded").length,
        unknown_record_count: groupedRecords.filter((record) => record.tracking_status === "unknown").length,
        provider_cost_projected_usd: roundMoney(groupedRecords.reduce((total, record) => total + Number(record.provider_cost_projected_usd ?? 0), 0)),
        projected_at: generatedAt,
        projected_token_usage_record_ids: groupedRecords.map((record) => record.projected_token_usage_record_id).sort(),
      };
    })
    .sort(by("token_rollup_id"));
}

function validateTokenUsageProjection({ sources, projection }) {
  const items = [];
  for (const [sourceName, source] of Object.entries(sources)) {
    items.push(validationItem(`source.${sourceName}`, `source_${sourceName}_available`, source.ok, `${sourceName} is available.`));
  }
  const packageScripts = sources.packageJson.value?.scripts ?? {};
  const summary = summarizeProjection(projection, { errors: [] });
  items.push(validationItem("package.scripts.token:projection", "package_script_declared", Boolean(packageScripts["token:projection"]), "`token:projection` package script must be declared."));
  items.push(validationItem("roadmap.phase_169", "roadmap_phase_declared", String(sources.roadmap.value ?? "").includes("Phase 169: Token Usage Projection"), "Phase 169 roadmap entry must be declared."));
  items.push(validationItem("projected_token_usage_records", "projection_records_present", summary.projected_token_usage_record_count > 0, "Projected token usage records must be produced."));
  items.push(validationItem("projected_token_usage_records.count", "all_source_records_projected", summary.projected_token_usage_record_count === projection.sourceCounts.token_usage_record_count, "Every token usage record must be projected."));
  items.push(validationItem("projected_token_usage_records.cache", "cache_token_field_present", projection.projectedTokenUsageRecords.every((record) => Number.isFinite(record.cache_token_count)), "Every projected record must carry an explicit cache token count."));
  items.push(validationItem("projected_token_usage_records.binding", "provider_cost_records_bound", summary.missing_provider_cost_record_count === 0, "Every projected token usage record must bind to its provider cost record from the cost record projection."));
  items.push(validationItem("projected_token_usage_records.provider_count", "provider_record_count_matches_token_usage", projection.sourceCounts.provider_cost_record_count === projection.sourceCounts.token_usage_record_count, "Provider cost record count must match source token usage record count."));
  items.push(validationItem("token_totals.input", "input_token_total_matches_ledger", summary.total_input_token_count === projection.sourceCounts.ledger_total_input_token_count, "Projected input tokens must match the source token usage ledger."));
  items.push(validationItem("token_totals.output", "output_token_total_matches_ledger", summary.total_output_token_count === projection.sourceCounts.ledger_total_output_token_count, "Projected output tokens must match the source token usage ledger."));
  items.push(validationItem("token_totals.total", "total_token_count_matches_ledger", summary.total_token_count === projection.sourceCounts.ledger_total_token_count, "Projected total tokens must match the source token usage ledger."));
  items.push(validationItem("token_rollups.capability", "capability_rollups_present", summary.capability_token_rollup_count > 0, "Capability token rollups must be produced."));
  items.push(validationItem("token_rollups.runtime", "runtime_rollups_present", summary.runtime_token_rollup_count > 0, "Runtime token rollups must be produced."));
  items.push(validationItem("token_rollups.capability_runtime", "capability_runtime_rollups_present", summary.capability_runtime_token_rollup_count > 0, "Capability/runtime token rollups must be produced."));
  items.push(validationItem("token_rollups.capability_total", "capability_rollups_sum_to_total", sum(projection.capabilityTokenRollups, "total_token_count") === summary.total_token_count, "Capability rollups must sum to the projected total token count."));
  items.push(validationItem("token_rollups.runtime_total", "runtime_rollups_sum_to_total", sum(projection.runtimeTokenRollups, "total_token_count") === summary.total_token_count, "Runtime rollups must sum to the projected total token count."));
  items.push(validationItem("projected_token_usage_records.hash", "usage_hashes_present", projection.projectedTokenUsageRecords.every((record) => record.token_usage_hash), "Every projected token usage record must have a hash."));
  return items;
}

function summarizeProjection(projection, validation) {
  const records = projection.projectedTokenUsageRecords;
  return {
    token_usage_projection_status: validation.errors.length === 0 ? "complete" : "blocked",
    token_usage_projection_contract_id: CONTRACT_ID,
    projected_token_usage_record_count: records.length,
    source_token_usage_record_count: projection.sourceCounts.token_usage_record_count,
    provider_cost_record_count: projection.sourceCounts.provider_cost_record_count,
    provider_cost_bound_record_count: records.filter((record) => record.provider_cost_binding_status === "bound").length,
    missing_provider_cost_record_count: records.filter((record) => record.provider_cost_binding_status !== "bound").length,
    capability_token_rollup_count: projection.capabilityTokenRollups.length,
    runtime_token_rollup_count: projection.runtimeTokenRollups.length,
    capability_runtime_token_rollup_count: projection.capabilityRuntimeTokenRollups.length,
    domain_pack_token_rollup_count: projection.domainPackTokenRollups.length,
    matter_token_rollup_count: projection.matterTokenRollups.length,
    tracking_status_token_rollup_count: projection.trackingStatusTokenRollups.length,
    estimated_record_count: records.filter((record) => record.tracking_status === "estimated").length,
    recorded_record_count: records.filter((record) => record.tracking_status === "recorded").length,
    unknown_record_count: records.filter((record) => record.tracking_status === "unknown").length,
    blocked_record_count: records.filter((record) => record.tracking_status === "blocked").length,
    total_input_token_count: sum(records, "input_token_count"),
    total_output_token_count: sum(records, "output_token_count"),
    total_cache_token_count: sum(records, "cache_token_count"),
    total_token_count: sum(records, "total_token_count"),
    total_provider_cost_projected_usd: roundMoney(records.reduce((total, record) => total + Number(record.provider_cost_projected_usd ?? 0), 0)),
    validation_item_count: validation.items?.length ?? 0,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(records, "runtime_id"),
    by_capability_id: countBy(records, "capability_id"),
    by_domain_pack: countBy(records, "domain_pack"),
    by_tracking_status: countBy(records, "tracking_status"),
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "token-usage-projection-contract.v1",
    generated_at: generatedAt,
    token_usage_projection_contract_id: CONTRACT_ID,
    required_record_fields: ["token_usage_id", "runtime_id", "capability_id", "input_token_count", "output_token_count", "cache_token_count", "total_token_count", "provider_cost_record_id", "token_usage_hash"],
    rollup_dimensions: ["capability_id", "runtime_id", "capability_id+runtime_id", "domain_pack", "matter_id", "tracking_status"],
    cache_token_rule: "Cache token count is explicit on every projected record; absent source cache usage is represented as zero, not omitted.",
    cost_binding_rule: "Each projected token usage record binds to the provider cost record emitted by the Cost Record Projection phase.",
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    token_usage_ledger: sourceContract(sources.tokenUsageLedger, inputs.token_usage_ledger_path, {
      ledger_status: sources.tokenUsageLedger.value?.ledger_status ?? null,
      token_usage_record_count: sources.tokenUsageLedger.value?.summary?.token_usage_record_count ?? 0,
      total_token_count: sources.tokenUsageLedger.value?.summary?.total_token_count ?? 0,
    }),
    cost_record_projection: sourceContract(sources.costRecordProjection, inputs.cost_record_projection_path, {
      cost_record_projection_status: sources.costRecordProjection.value?.summary?.cost_record_projection_status ?? null,
      provider_cost_record_count: sources.costRecordProjection.value?.summary?.provider_cost_record_count ?? 0,
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

function serializableProjection(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    token_usage_projection_id: result.token_usage_projection_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_contracts: result.source_contracts,
    token_usage_projection_contract: result.token_usage_projection_contract,
    token_usage_projection_catalog: result.token_usage_projection_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function renderTokenUsageProjectionMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Token Usage Projection");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.token_usage_projection_status}`);
  lines.push("");
  lines.push(`- Projected records: ${summary.projected_token_usage_record_count}`);
  lines.push(`- Capability/runtime rollups: ${summary.capability_token_rollup_count}/${summary.runtime_token_rollup_count}`);
  lines.push(`- Capability-runtime rollups: ${summary.capability_runtime_token_rollup_count}`);
  lines.push(`- Input/output/cache/total tokens: ${summary.total_input_token_count}/${summary.total_output_token_count}/${summary.total_cache_token_count}/${summary.total_token_count}`);
  lines.push(`- Provider cost bindings: ${summary.provider_cost_bound_record_count}/${summary.projected_token_usage_record_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Runtime Rollups");
  lines.push("");
  for (const rollup of result.token_usage_projection_catalog.runtime_token_rollups) {
    lines.push(`- ${rollup.rollup_key}: ${rollup.total_token_count} tokens (${rollup.input_token_count} input, ${rollup.output_token_count} output, ${rollup.cache_token_count} cache)`);
  }
  lines.push("");
  lines.push("## Capability Rollups");
  lines.push("");
  for (const rollup of result.token_usage_projection_catalog.capability_token_rollups) {
    lines.push(`- ${rollup.rollup_key}: ${rollup.total_token_count} tokens`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    token_usage_ledger_path: path.resolve(options.tokenUsageLedgerPath ?? DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.tokenUsageLedgerPath),
    cost_record_projection_path: path.resolve(options.costRecordProjectionPath ?? DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.costRecordProjectionPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.roadmapPath),
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
  for (const item of items) {
    const key = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    const normalizedKey = key ?? "unknown";
    if (!grouped.has(normalizedKey)) grouped.set(normalizedKey, []);
    grouped.get(normalizedKey).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 10000) / 10000;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TOKEN_USAGE_PROJECTION_OUT_DIR,
    tokenUsageLedgerPath: DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.tokenUsageLedgerPath,
    costRecordProjectionPath: DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.costRecordProjectionPath,
    packagePath: DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.packagePath,
    roadmapPath: DEFAULT_TOKEN_USAGE_PROJECTION_INPUTS.roadmapPath,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--token-usage-ledger") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--cost-record-projection") parsed.costRecordProjectionPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/token-usage-projection.mjs [options]

Options:
  --token-usage-ledger <path>       token-usage-ledger.json path.
  --cost-record-projection <path>   cost-record-projection.json path.
  --package <path>                  package.json path.
  --roadmap <path>                  implementation-roadmap.md path.
  --out-dir <folder>                Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Exit non-zero when the projection is invalid.
  -h, --help                        Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
