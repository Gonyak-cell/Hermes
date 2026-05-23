import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BUDGET_ALERT_LEDGER_OUT_DIR = "artifacts/budget-alerts/latest";
export const DEFAULT_BUDGET_ALERT_COST_ATTRIBUTION_LEDGER = "artifacts/cost-attribution/latest/cost-attribution-ledger.json";
export const DEFAULT_WARNING_THRESHOLD = 0.8;
export const DEFAULT_CRITICAL_THRESHOLD = 1;

export async function runBudgetAlertLedger(options = {}) {
  const result = await buildBudgetAlertLedger(options);
  if (options.write !== false) await writeBudgetAlertLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Budget alert ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildBudgetAlertLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_BUDGET_ALERT_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const costAttributionLedgerPath = path.resolve(options.costAttributionLedgerPath ?? DEFAULT_BUDGET_ALERT_COST_ATTRIBUTION_LEDGER);
  const warningThreshold = Number(options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD);
  const criticalThreshold = Number(options.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD);
  const attributionResult = await readJsonOrError(costAttributionLedgerPath);
  const alertRecords = (attributionResult.value?.attribution_records ?? []).map((record) => buildAlertRecord(record, {
    warningThreshold,
    criticalThreshold,
  }));
  const validation = validateBudgetAlertLedger({
    attributionResult,
    warningThreshold,
    criticalThreshold,
    alertRecords,
  });
  const ledger = {
    schema_version: "budget-alert-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `budget-alert-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cost_attribution_ledger_path: costAttributionLedgerPath,
    warning_threshold: warningThreshold,
    critical_threshold: criticalThreshold,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeBudgetAlertLedger({ alertRecords, validation }),
    sources: [
      source("cost_attribution_ledger", "Cost Attribution Ledger", costAttributionLedgerPath, attributionResult),
    ],
    alert_records: alertRecords,
    validation,
  };

  return {
    ...ledger,
    markdown: renderBudgetAlertLedgerMarkdown(ledger),
  };
}

export async function writeBudgetAlertLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "budget-alert-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    cost_attribution_ledger_path: result.cost_attribution_ledger_path,
    warning_threshold: result.warning_threshold,
    critical_threshold: result.critical_threshold,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    alert_records: result.alert_records,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "budget-alert-records.json"), {
    generated_at: result.generated_at,
    count: result.alert_records.length,
    alert_records: result.alert_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runBudgetAlertLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runBudgetAlertLedger(args);
    console.log(`Budget alert ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Alert records: ${result.summary.alert_record_count}`);
    console.log(`Active alerts: ${result.summary.active_alert_count}`);
    console.log(`Critical alerts: ${result.summary.critical_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
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

function buildAlertRecord(record, { warningThreshold, criticalThreshold }) {
  const ratio = deriveBudgetUsageRatio(record);
  const alertReasons = buildAlertReasons(record, ratio, { warningThreshold, criticalThreshold });
  const alertStatus = deriveAlertStatus(record, ratio, alertReasons);
  return {
    alert_record_id: `budget-alert.${slugify(record.attribution_id)}`,
    attribution_id: record.attribution_id,
    budget_decision_id: record.budget_decision_id,
    token_usage_id: record.token_usage_id,
    routing_decision_id: record.routing_decision_id,
    workflow_run_id: record.workflow_run_id,
    agent_run_id: record.agent_run_id,
    runtime_id: record.runtime_id,
    capability_id: record.capability_id,
    domain_pack: record.domain_pack,
    tenant_id: record.tenant_id,
    matter_id: record.matter_id,
    classification: record.classification,
    alert_status: alertStatus,
    alert_reasons: alertReasons,
    max_usd: record.max_usd,
    projected_usd: record.projected_usd,
    budget_remaining_usd: record.budget_remaining_usd,
    budget_usage_ratio: ratio,
    warning_threshold: warningThreshold,
    critical_threshold: criticalThreshold,
    over_budget: record.over_budget,
    untracked_cost: record.untracked_cost,
    requires_human: ["warning", "critical", "unbudgeted"].includes(alertStatus),
    recommended_actions: recommendedActions(alertStatus),
    audit_required: true,
    alert_hash: hashValue({
      attribution_id: record.attribution_id,
      projected_usd: record.projected_usd,
      max_usd: record.max_usd,
      ratio,
      alertStatus,
      alertReasons,
    }),
    metadata: {
      attribution_status: record.attribution_status,
      total_token_count: record.total_token_count,
      observed_runtime_seconds: record.observed_runtime_seconds,
    },
  };
}

function deriveBudgetUsageRatio(record) {
  if (typeof record.max_usd !== "number") return null;
  if (record.max_usd === 0) return record.projected_usd > 0 ? Number.POSITIVE_INFINITY : 0;
  return roundRatio(record.projected_usd / record.max_usd);
}

function buildAlertReasons(record, ratio, { warningThreshold, criticalThreshold }) {
  const reasons = [];
  if (typeof record.max_usd !== "number") reasons.push("budget_missing");
  if (record.untracked_cost) reasons.push("untracked_cost");
  if (record.over_budget) reasons.push("over_budget");
  if (ratio === Number.POSITIVE_INFINITY || (typeof ratio === "number" && ratio >= criticalThreshold)) reasons.push("critical_threshold_reached");
  else if (typeof ratio === "number" && ratio >= warningThreshold) reasons.push("warning_threshold_reached");
  return unique(reasons);
}

function deriveAlertStatus(record, ratio, alertReasons) {
  if (alertReasons.includes("budget_missing")) return "unbudgeted";
  if (record.over_budget || alertReasons.includes("critical_threshold_reached")) return "critical";
  if (alertReasons.includes("untracked_cost") || alertReasons.includes("warning_threshold_reached")) return "warning";
  return "clear";
}

function recommendedActions(alertStatus) {
  if (alertStatus === "critical") return ["pause_runtime", "review_budget", "increase_budget_or_reduce_scope"];
  if (alertStatus === "warning") return ["review_budget", "monitor_next_run"];
  if (alertStatus === "unbudgeted") return ["add_cost_policy", "rerun_cost_attribution"];
  return [];
}

function validateBudgetAlertLedger({ attributionResult, warningThreshold, criticalThreshold, alertRecords }) {
  const errors = [];
  if (!attributionResult.ok) {
    errors.push({ path: "cost_attribution_ledger", message: `Cost attribution ledger unavailable: ${attributionResult.error}` });
  }
  if (!Number.isFinite(warningThreshold) || warningThreshold < 0) {
    errors.push({ path: "warning_threshold", message: "Warning threshold must be a non-negative number" });
  }
  if (!Number.isFinite(criticalThreshold) || criticalThreshold < 0) {
    errors.push({ path: "critical_threshold", message: "Critical threshold must be a non-negative number" });
  }
  if (Number.isFinite(warningThreshold) && Number.isFinite(criticalThreshold) && warningThreshold > criticalThreshold) {
    errors.push({ path: "warning_threshold", message: "Warning threshold must be less than or equal to critical threshold" });
  }
  for (const record of alertRecords) {
    if (record.alert_status === "critical") {
      errors.push({
        path: `alert_records.${record.alert_record_id}.alert_status`,
        message: `Critical budget alert: ${record.alert_reasons.join(", ")}`,
      });
    }
    if (record.alert_status === "unbudgeted") {
      errors.push({
        path: `alert_records.${record.alert_record_id}.max_usd`,
        message: "Budget alert record has no max_usd budget",
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeBudgetAlertLedger({ alertRecords, validation }) {
  return {
    alert_record_count: alertRecords.length,
    clear_count: alertRecords.filter((record) => record.alert_status === "clear").length,
    warning_count: alertRecords.filter((record) => record.alert_status === "warning").length,
    critical_count: alertRecords.filter((record) => record.alert_status === "critical").length,
    unbudgeted_count: alertRecords.filter((record) => record.alert_status === "unbudgeted").length,
    active_alert_count: alertRecords.filter((record) => record.alert_status !== "clear").length,
    human_required_count: alertRecords.filter((record) => record.requires_human).length,
    total_projected_usd: roundMoney(alertRecords.reduce((sum, record) => sum + record.projected_usd, 0)),
    total_budget_remaining_usd: roundMoney(alertRecords.reduce((sum, record) => sum + Number(record.budget_remaining_usd ?? 0), 0)),
    validation_error_count: validation.errors.length,
    by_alert_status: countBy(alertRecords, "alert_status"),
    by_runtime_id: countBy(alertRecords, "runtime_id"),
    by_capability_id: countBy(alertRecords, "capability_id"),
    by_matter_id: countBy(alertRecords, "matter_id"),
  };
}

function renderBudgetAlertLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Budget Alert Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Alert records: ${ledger.summary.alert_record_count}`);
  lines.push(`- Clear: ${ledger.summary.clear_count}`);
  lines.push(`- Warning: ${ledger.summary.warning_count}`);
  lines.push(`- Critical: ${ledger.summary.critical_count}`);
  lines.push(`- Unbudgeted: ${ledger.summary.unbudgeted_count}`);
  lines.push(`- Active alerts: ${ledger.summary.active_alert_count}`);
  lines.push(`- Projected USD: ${ledger.summary.total_projected_usd}`);
  lines.push(`- Budget remaining USD: ${ledger.summary.total_budget_remaining_usd}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Records");
  lines.push("");
  for (const record of ledger.alert_records) {
    lines.push(`- ${record.alert_record_id}: ${record.alert_status}, ratio=${record.budget_usage_ratio ?? "n/a"}, projected=$${record.projected_usd}`);
  }
  if (ledger.alert_records.length === 0) lines.push("- No budget alert records found.");
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

function roundRatio(value) {
  return Math.round(Number(value ?? 0) * 10000) / 10000;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_BUDGET_ALERT_LEDGER_OUT_DIR,
    costAttributionLedgerPath: DEFAULT_BUDGET_ALERT_COST_ATTRIBUTION_LEDGER,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
    criticalThreshold: DEFAULT_CRITICAL_THRESHOLD,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--cost-attribution-ledger") parsed.costAttributionLedgerPath = argv[++index];
    else if (arg === "--warning-threshold") parsed.warningThreshold = Number(argv[++index]);
    else if (arg === "--critical-threshold") parsed.criticalThreshold = Number(argv[++index]);
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/budget-alert-ledger.mjs [options]

Options:
  --cost-attribution-ledger <path> cost-attribution-ledger.json path.
  --warning-threshold <n>          Warning budget usage ratio threshold.
  --critical-threshold <n>         Critical budget usage ratio threshold.
  --out-dir <folder>               Output directory.
  --run-at <iso>                   Deterministic generated_at timestamp.
  --check                          Exit non-zero when the ledger is invalid.
  -h, --help                       Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
