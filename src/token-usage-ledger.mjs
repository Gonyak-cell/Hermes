import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TOKEN_USAGE_LEDGER_OUT_DIR = "artifacts/token-usage/latest";
export const DEFAULT_TOKEN_USAGE_COST_BUDGET_LEDGER = "artifacts/cost-budget/latest/cost-budget-ledger.json";
export const DEFAULT_TOKEN_USAGE_CONTEXT_PACKET_LEDGER = "artifacts/context-packets/latest/context-packet-ledger.json";
export const DEFAULT_TOKEN_USAGE_OBSERVABILITY_CATALOG = "artifacts/observability/latest/observability-catalog.json";

export async function runTokenUsageLedger(options = {}) {
  const result = await buildTokenUsageLedger(options);
  if (options.write !== false) await writeTokenUsageLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Token usage ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTokenUsageLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TOKEN_USAGE_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const costBudgetLedgerPath = path.resolve(options.costBudgetLedgerPath ?? DEFAULT_TOKEN_USAGE_COST_BUDGET_LEDGER);
  const contextPacketLedgerPath = path.resolve(options.contextPacketLedgerPath ?? DEFAULT_TOKEN_USAGE_CONTEXT_PACKET_LEDGER);
  const observabilityCatalogPath = path.resolve(options.observabilityCatalogPath ?? DEFAULT_TOKEN_USAGE_OBSERVABILITY_CATALOG);
  const costBudgetResult = await readJsonOrError(costBudgetLedgerPath);
  const contextResult = await readJsonOrError(contextPacketLedgerPath);
  const observabilityResult = await readJsonOrError(observabilityCatalogPath);
  const indexes = buildIndexes({ context: contextResult.value, observability: observabilityResult.value });
  const tokenUsageRecords = (costBudgetResult.value?.budget_decisions ?? []).map((decision) => buildTokenUsageRecord(decision, indexes));
  const validation = validateTokenUsageLedger({
    costBudgetResult,
    contextResult,
    observabilityResult,
    tokenUsageRecords,
  });
  const ledger = {
    schema_version: "token-usage-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `token-usage-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cost_budget_ledger_path: costBudgetLedgerPath,
    context_packet_ledger_path: contextPacketLedgerPath,
    observability_catalog_path: observabilityCatalogPath,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeTokenUsageLedger({ tokenUsageRecords, validation }),
    sources: buildSources({ costBudgetResult, contextResult, observabilityResult }, {
      costBudgetLedgerPath,
      contextPacketLedgerPath,
      observabilityCatalogPath,
    }),
    token_usage_records: tokenUsageRecords,
    validation,
  };

  return {
    ...ledger,
    markdown: renderTokenUsageLedgerMarkdown(ledger),
  };
}

export async function writeTokenUsageLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "token-usage-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    cost_budget_ledger_path: result.cost_budget_ledger_path,
    context_packet_ledger_path: result.context_packet_ledger_path,
    observability_catalog_path: result.observability_catalog_path,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    token_usage_records: result.token_usage_records,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "token-usage-records.json"), {
    generated_at: result.generated_at,
    count: result.token_usage_records.length,
    token_usage_records: result.token_usage_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTokenUsageLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runTokenUsageLedger(args);
    console.log(`Token usage ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Token usage records: ${result.summary.token_usage_record_count}`);
    console.log(`Estimated records: ${result.summary.estimated_record_count}`);
    console.log(`Total tokens: ${result.summary.total_token_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildIndexes({ context, observability }) {
  const contextPacketsById = new Map((context?.context_packets ?? []).map((packet) => [packet.context_packet_id, packet]));
  const contextItemsByPacket = groupBy(context?.context_items ?? [], "context_packet_id");
  const tokenRecordsByWorkflowCapability = new Map();
  for (const record of observability?.cost_records ?? []) {
    if (!isTokenCostRecord(record)) continue;
    const key = costKey(record.workflow_run_id, record.capability_id);
    if (!tokenRecordsByWorkflowCapability.has(key)) tokenRecordsByWorkflowCapability.set(key, []);
    tokenRecordsByWorkflowCapability.get(key).push(record);
  }
  return {
    contextPacketsById,
    contextItemsByPacket,
    tokenRecordsByWorkflowCapability,
  };
}

function buildSources(results, paths) {
  return [
    source("cost_budget_ledger", "Cost Budget Ledger", paths.costBudgetLedgerPath, results.costBudgetResult),
    source("context_packet_ledger", "Context Packet Ledger", paths.contextPacketLedgerPath, results.contextResult),
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

function buildTokenUsageRecord(decision, indexes) {
  const contextPacket = indexes.contextPacketsById.get(decision.context_packet_id) ?? null;
  const contextItems = indexes.contextItemsByPacket.get(decision.context_packet_id) ?? [];
  const tokenRecords = indexes.tokenRecordsByWorkflowCapability.get(costKey(decision.workflow_run_id, decision.capability_id)) ?? [];
  const actualTokenCounts = sumTokenRecords(tokenRecords);
  const estimate = estimateTokens({ decision, contextPacket, contextItems });
  const blocked = decision.budget_status === "blocked" || decision.route_status === "blocked";
  const trackingStatus = deriveTrackingStatus({ decision, tokenRecords, blocked });
  const inputTokenCount = trackingStatus === "recorded" ? actualTokenCounts.input : trackingStatus === "estimated" ? estimate.input : 0;
  const outputTokenCount = trackingStatus === "recorded" ? actualTokenCounts.output : trackingStatus === "estimated" ? estimate.output : 0;
  const totalTokenCount = trackingStatus === "recorded" ? actualTokenCounts.total : trackingStatus === "estimated" ? estimate.total : 0;
  const previewCharacterCount = contextItems.reduce((sum, item) => sum + String(item.preview ?? "").length, 0);
  const record = {
    token_usage_id: `token-usage.${slugify(decision.budget_decision_id)}`,
    budget_decision_id: decision.budget_decision_id,
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
    route_status: decision.route_status,
    route_mode: decision.route_mode,
    token_tracking_required: decision.token_tracking_required,
    tracking_status: trackingStatus,
    estimated: trackingStatus === "estimated",
    input_token_count: inputTokenCount,
    output_token_count: outputTokenCount,
    total_token_count: totalTokenCount,
    context_item_count: contextPacket?.context_item_count ?? contextItems.length,
    context_mode: contextPacket?.context_mode ?? "unknown",
    redaction_applied: Boolean(contextPacket?.redaction_applied),
    estimation_method: trackingStatus === "estimated" ? estimate.method : trackingStatus === "recorded" ? "observability_cost_records" : "not_applicable",
    token_record_count: tokenRecords.length,
    cost_record_ids: tokenRecords.map((record) => record.cost_record_id),
    required_gates: unique(["cost_budget_gate", ...(decision.required_gates ?? [])]),
    audit_required: true,
    usage_hash: hashValue({
      budget_decision_id: decision.budget_decision_id,
      trackingStatus,
      inputTokenCount,
      outputTokenCount,
      totalTokenCount,
      tokenRecordCount: tokenRecords.length,
      contextItemCount: contextItems.length,
    }),
    metadata: {
      context_packet_present: Boolean(contextPacket),
      preview_character_count: previewCharacterCount,
      estimate_base_tokens: estimate.base,
      estimate_item_overhead_tokens: estimate.itemOverhead,
    },
  };
  return record;
}

function deriveTrackingStatus({ decision, tokenRecords, blocked }) {
  if (blocked) return "blocked";
  if (tokenRecords.length > 0) return "recorded";
  if (decision.token_tracking_required) return "estimated";
  if (decision.token_tracking_status === "not_required") return "not_required";
  return "unknown";
}

function estimateTokens({ decision, contextPacket, contextItems }) {
  const previewChars = contextItems.reduce((sum, item) => sum + String(item.preview ?? "").length, 0);
  const contextModeFactor = contextPacket?.context_mode === "redacted" ? 0.65 : 1;
  const base = runtimeBaseOutputTokens(decision.runtime_id);
  const itemOverhead = contextItems.length * 24;
  const input = Math.max(contextItems.length * 8, Math.ceil(((previewChars * contextModeFactor) + itemOverhead + 128) / 4));
  const output = base;
  return {
    input,
    output,
    total: input + output,
    base,
    itemOverhead,
    method: "context_preview_characters_div4_plus_runtime_baseline",
  };
}

function runtimeBaseOutputTokens(runtimeId) {
  if (runtimeId === "codex" || runtimeId === "claude_code") return 512;
  if (runtimeId === "document_renderer") return 256;
  return 128;
}

function sumTokenRecords(tokenRecords) {
  let input = 0;
  let output = 0;
  let total = 0;
  for (const record of tokenRecords) {
    const amount = Number(record.amount ?? 0);
    const type = String(record.cost_type ?? "").toLowerCase();
    const unit = String(record.unit ?? "").toLowerCase();
    if (type.includes("input") || unit.includes("input")) input += amount;
    else if (type.includes("output") || unit.includes("output")) output += amount;
    else total += amount;
  }
  return {
    input,
    output,
    total: total + input + output,
  };
}

function validateTokenUsageLedger({ costBudgetResult, contextResult, observabilityResult, tokenUsageRecords }) {
  const errors = [];
  if (!costBudgetResult.ok) errors.push({ path: "cost_budget_ledger", message: `Cost budget ledger unavailable: ${costBudgetResult.error}` });
  if (!contextResult.ok) errors.push({ path: "context_packet_ledger", message: `Context packet ledger unavailable: ${contextResult.error}` });
  if (!observabilityResult.ok) errors.push({ path: "observability_catalog", message: `Observability catalog unavailable: ${observabilityResult.error}` });
  for (const record of tokenUsageRecords) {
    if (record.token_tracking_required && !["recorded", "estimated", "blocked"].includes(record.tracking_status)) {
      errors.push({
        path: `token_usage_records.${record.token_usage_id}.tracking_status`,
        message: "Token tracking is required but no recorded or estimated usage is available",
      });
    }
    if (["recorded", "estimated"].includes(record.tracking_status) && record.total_token_count <= 0) {
      errors.push({
        path: `token_usage_records.${record.token_usage_id}.total_token_count`,
        message: "Tracked token usage must have positive total_token_count",
      });
    }
    if (!record.metadata.context_packet_present && record.token_tracking_required) {
      errors.push({
        path: `token_usage_records.${record.token_usage_id}.context_packet_id`,
        message: "Token estimate requires a matching context packet",
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeTokenUsageLedger({ tokenUsageRecords, validation }) {
  return {
    token_usage_record_count: tokenUsageRecords.length,
    tracking_required_count: tokenUsageRecords.filter((record) => record.token_tracking_required).length,
    recorded_record_count: tokenUsageRecords.filter((record) => record.tracking_status === "recorded").length,
    estimated_record_count: tokenUsageRecords.filter((record) => record.tracking_status === "estimated").length,
    not_required_record_count: tokenUsageRecords.filter((record) => record.tracking_status === "not_required").length,
    unknown_record_count: tokenUsageRecords.filter((record) => record.tracking_status === "unknown").length,
    blocked_record_count: tokenUsageRecords.filter((record) => record.tracking_status === "blocked").length,
    total_input_token_count: tokenUsageRecords.reduce((sum, record) => sum + record.input_token_count, 0),
    total_output_token_count: tokenUsageRecords.reduce((sum, record) => sum + record.output_token_count, 0),
    total_token_count: tokenUsageRecords.reduce((sum, record) => sum + record.total_token_count, 0),
    validation_error_count: validation.errors.length,
    by_tracking_status: countBy(tokenUsageRecords, "tracking_status"),
    by_runtime_id: countBy(tokenUsageRecords, "runtime_id"),
    by_capability_id: countBy(tokenUsageRecords, "capability_id"),
  };
}

function renderTokenUsageLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Token Usage Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Token usage records: ${ledger.summary.token_usage_record_count}`);
  lines.push(`- Tracking required: ${ledger.summary.tracking_required_count}`);
  lines.push(`- Recorded records: ${ledger.summary.recorded_record_count}`);
  lines.push(`- Estimated records: ${ledger.summary.estimated_record_count}`);
  lines.push(`- Unknown records: ${ledger.summary.unknown_record_count}`);
  lines.push(`- Total input tokens: ${ledger.summary.total_input_token_count}`);
  lines.push(`- Total output tokens: ${ledger.summary.total_output_token_count}`);
  lines.push(`- Total tokens: ${ledger.summary.total_token_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Records");
  lines.push("");
  for (const record of ledger.token_usage_records) {
    lines.push(`- ${record.token_usage_id}: ${record.tracking_status}, runtime=${record.runtime_id}, total=${record.total_token_count}`);
  }
  if (ledger.token_usage_records.length === 0) lines.push("- No token usage records found.");
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

function isTokenCostRecord(record) {
  const type = String(record.cost_type ?? "").toLowerCase();
  const unit = String(record.unit ?? "").toLowerCase();
  return type.includes("token") || unit.includes("token");
}

function costKey(workflowRunId, capabilityId) {
  return `${workflowRunId}:${capabilityId}`;
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

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TOKEN_USAGE_LEDGER_OUT_DIR,
    costBudgetLedgerPath: DEFAULT_TOKEN_USAGE_COST_BUDGET_LEDGER,
    contextPacketLedgerPath: DEFAULT_TOKEN_USAGE_CONTEXT_PACKET_LEDGER,
    observabilityCatalogPath: DEFAULT_TOKEN_USAGE_OBSERVABILITY_CATALOG,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--cost-budget-ledger") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--context-packet-ledger") parsed.contextPacketLedgerPath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/token-usage-ledger.mjs [options]

Options:
  --cost-budget-ledger <path>   cost-budget-ledger.json path.
  --context-packet-ledger <path>
                                  context-packet-ledger.json path.
  --observability-catalog <path>
                                  observability-catalog.json path.
  --out-dir <folder>             Output directory.
  --run-at <iso>                 Deterministic generated_at timestamp.
  --check                        Exit non-zero when the ledger is invalid.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
