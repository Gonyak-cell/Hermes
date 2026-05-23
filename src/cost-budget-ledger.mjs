import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_COST_BUDGET_LEDGER_OUT_DIR = "artifacts/cost-budget/latest";
export const DEFAULT_COST_BUDGET_MODEL_ROUTING_LEDGER = "artifacts/model-routing/latest/model-routing-ledger.json";
export const DEFAULT_COST_BUDGET_DOMAIN_PACK_REGISTRY = "artifacts/domain-packs/latest/domain-pack-registry.json";
export const DEFAULT_COST_BUDGET_OBSERVABILITY_CATALOG = "artifacts/observability/latest/observability-catalog.json";
export const DEFAULT_COST_BUDGET_POLICY_MATRIX_CATALOG = "artifacts/policy-matrix/latest/policy-matrix-catalog.json";

export async function runCostBudgetLedger(options = {}) {
  const result = await buildCostBudgetLedger(options);
  if (options.write !== false) await writeCostBudgetLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Cost budget ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCostBudgetLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_COST_BUDGET_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const modelRoutingLedgerPath = path.resolve(options.modelRoutingLedgerPath ?? DEFAULT_COST_BUDGET_MODEL_ROUTING_LEDGER);
  const domainPackRegistryPath = path.resolve(options.domainPackRegistryPath ?? DEFAULT_COST_BUDGET_DOMAIN_PACK_REGISTRY);
  const observabilityCatalogPath = path.resolve(options.observabilityCatalogPath ?? DEFAULT_COST_BUDGET_OBSERVABILITY_CATALOG);
  const policyMatrixCatalogPath = path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_COST_BUDGET_POLICY_MATRIX_CATALOG);
  const routingResult = await readJsonOrError(modelRoutingLedgerPath);
  const registryResult = await readJsonOrError(domainPackRegistryPath);
  const observabilityResult = await readJsonOrError(observabilityCatalogPath);
  const policyMatrixResult = await readJsonOrError(policyMatrixCatalogPath);
  const capabilityIndex = await buildCapabilityIndex(registryResult.value, observabilityResult.value);
  const costIndex = buildCostIndex(observabilityResult.value);
  const costBudgetGate = (policyMatrixResult.value?.gate_rules ?? []).find((gate) => gate.gate_id === "cost_budget_gate") ?? null;
  const budgetDecisions = (routingResult.value?.routing_decisions ?? []).map((route) => buildBudgetDecision(route, {
    capabilityIndex,
    costIndex,
    costBudgetGate,
  }));
  const validation = validateCostBudgetLedger({
    routingResult,
    registryResult,
    observabilityResult,
    policyMatrixResult,
    capabilityIndex,
    costBudgetGate,
    budgetDecisions,
  });
  const ledger = {
    schema_version: "cost-budget-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `cost-budget-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    model_routing_ledger_path: modelRoutingLedgerPath,
    domain_pack_registry_path: domainPackRegistryPath,
    observability_catalog_path: observabilityCatalogPath,
    policy_matrix_catalog_path: policyMatrixCatalogPath,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeCostBudgetLedger({ budgetDecisions, validation }),
    sources: buildSources({ routingResult, registryResult, observabilityResult, policyMatrixResult }, {
      modelRoutingLedgerPath,
      domainPackRegistryPath,
      observabilityCatalogPath,
      policyMatrixCatalogPath,
    }),
    budget_decisions: budgetDecisions,
    validation,
  };

  return {
    ...ledger,
    markdown: renderCostBudgetLedgerMarkdown(ledger),
  };
}

export async function writeCostBudgetLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "cost-budget-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    model_routing_ledger_path: result.model_routing_ledger_path,
    domain_pack_registry_path: result.domain_pack_registry_path,
    observability_catalog_path: result.observability_catalog_path,
    policy_matrix_catalog_path: result.policy_matrix_catalog_path,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    budget_decisions: result.budget_decisions,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "budget-decisions.json"), {
    generated_at: result.generated_at,
    count: result.budget_decisions.length,
    budget_decisions: result.budget_decisions,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCostBudgetLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCostBudgetLedger(args);
    console.log(`Cost budget ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Budget decisions: ${result.summary.budget_decision_count}`);
    console.log(`Blocked decisions: ${result.summary.blocked_decision_count}`);
    console.log(`Token tracking pending: ${result.summary.token_tracking_pending_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function buildCapabilityIndex(registry, observability) {
  const capabilities = new Map();
  const errors = [];
  for (const record of registry?.capabilities ?? []) {
    try {
      const manifest = JSON.parse(await readFile(record.path, "utf8"));
      capabilities.set(record.capability_id, {
        record,
        manifest,
        cost_policy: manifest.cost_policy ?? null,
      });
    } catch (error) {
      errors.push({
        path: `capabilities.${record.capability_id}`,
        message: error.code === "ENOENT" ? "Capability manifest not found" : error.message,
      });
    }
  }
  for (const sourceRecord of observability?.sources ?? []) {
    if (!sourceRecord.available || !sourceRecord.slice_path) continue;
    try {
      const slice = JSON.parse(await readFile(sourceRecord.slice_path, "utf8"));
      for (const capability of slice.workflow_runtime?.capabilities ?? []) {
        if (capabilities.has(capability.id)) continue;
        capabilities.set(capability.id, {
          record: {
            capability_id: capability.id,
            pack_id: capability.domain_pack,
            path: `${sourceRecord.slice_path}#workflow_runtime.capabilities.${capability.id}`,
          },
          manifest: capability,
          cost_policy: capability.cost_policy ?? null,
        });
      }
    } catch (error) {
      errors.push({
        path: `observability.sources.${sourceRecord.source_id}.slice_path`,
        message: error.code === "ENOENT" ? "Slice artifact not found" : error.message,
      });
    }
  }
  return { capabilities, errors };
}

function buildCostIndex(observability) {
  const byWorkflowCapability = new Map();
  for (const record of observability?.cost_records ?? []) {
    const key = costKey(record.workflow_run_id, record.capability_id);
    if (!byWorkflowCapability.has(key)) byWorkflowCapability.set(key, []);
    byWorkflowCapability.get(key).push(record);
  }
  return { byWorkflowCapability };
}

function buildSources(results, paths) {
  return [
    source("model_routing_ledger", "Model Routing Ledger", paths.modelRoutingLedgerPath, results.routingResult),
    source("domain_pack_registry", "Domain Pack Registry", paths.domainPackRegistryPath, results.registryResult),
    source("observability_catalog", "Observability Catalog", paths.observabilityCatalogPath, results.observabilityResult),
    source("policy_matrix_catalog", "Policy Matrix Catalog", paths.policyMatrixCatalogPath, results.policyMatrixResult),
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

function buildBudgetDecision(route, { capabilityIndex, costIndex, costBudgetGate }) {
  const capability = capabilityIndex.capabilities.get(route.capability_id) ?? null;
  const costPolicy = capability?.cost_policy ?? null;
  const costRecords = costIndex.byWorkflowCapability.get(costKey(route.workflow_run_id, route.capability_id)) ?? [];
  const observedUsd = sumObservedUsd(costRecords);
  const observedRuntimeSeconds = sumCostRecords(costRecords, (record) => record.cost_type === "runtime_seconds" || record.unit === "seconds");
  const tokenRecords = costRecords.filter((record) => record.cost_type.includes("token") || record.unit.includes("token"));
  const maxUsd = typeof costPolicy?.max_usd === "number" ? costPolicy.max_usd : null;
  const trackTokens = typeof costPolicy?.track_tokens === "boolean" ? costPolicy.track_tokens : null;
  const blockerReasons = buildBlockers({ route, capability, costPolicy, maxUsd, observedUsd, costBudgetGate });
  const budgetStatus = blockerReasons.length > 0 ? "blocked" : "passed";
  const tokenTrackingStatus = trackTokens === true
    ? tokenRecords.length > 0
      ? "recorded"
      : "pending_records"
    : trackTokens === false
      ? "not_required"
      : "unknown";
  const decision = {
    budget_decision_id: `cost-budget.${slugify(route.routing_decision_id)}`,
    routing_decision_id: route.routing_decision_id,
    context_packet_id: route.context_packet_id,
    workflow_run_id: route.workflow_run_id,
    agent_run_id: route.agent_run_id,
    runtime_id: route.runtime_id,
    capability_id: route.capability_id,
    domain_pack: route.domain_pack,
    tenant_id: route.tenant_id,
    matter_id: route.matter_id,
    classification: route.classification,
    route_status: route.route_status,
    route_mode: route.route_mode,
    budget_status: budgetStatus,
    cost_budget_gate_present: Boolean(costBudgetGate),
    cost_policy_present: Boolean(costPolicy),
    max_usd: maxUsd,
    observed_usd: roundMoney(observedUsd),
    budget_margin_usd: maxUsd === null ? null : roundMoney(maxUsd - observedUsd),
    observed_runtime_seconds: observedRuntimeSeconds,
    cost_record_count: costRecords.length,
    token_tracking_required: trackTokens === true,
    token_tracking_status: tokenTrackingStatus,
    token_record_count: tokenRecords.length,
    blocker_reasons: blockerReasons,
    required_gates: unique(["cost_budget_gate", ...(route.required_gates ?? [])]),
    audit_required: true,
    decision_hash: hashValue({
      routing_decision_id: route.routing_decision_id,
      capability_id: route.capability_id,
      runtime_id: route.runtime_id,
      maxUsd,
      observedUsd: roundMoney(observedUsd),
      observedRuntimeSeconds,
      tokenTrackingStatus,
      budgetStatus,
      blockerReasons,
    }),
    metadata: {
      capability_manifest_path: capability?.record?.path ?? null,
      cost_record_ids: costRecords.map((record) => record.cost_record_id),
    },
  };
  return decision;
}

function buildBlockers({ route, capability, costPolicy, maxUsd, observedUsd, costBudgetGate }) {
  const blockers = [];
  if (route.route_status === "blocked") blockers.push("model_route_blocked");
  if (!costBudgetGate) blockers.push("cost_budget_gate_not_declared");
  if (!capability) blockers.push("capability_manifest_missing");
  if (!costPolicy) blockers.push("cost_policy_missing");
  if (costPolicy && maxUsd === null) blockers.push("cost_policy_max_usd_missing");
  if (maxUsd !== null && observedUsd > maxUsd) blockers.push("cost_budget_exceeded");
  return unique(blockers);
}

function validateCostBudgetLedger({ routingResult, registryResult, observabilityResult, policyMatrixResult, capabilityIndex, costBudgetGate, budgetDecisions }) {
  const errors = [];
  if (!routingResult.ok) errors.push({ path: "model_routing_ledger", message: `Model routing ledger unavailable: ${routingResult.error}` });
  if (!registryResult.ok) errors.push({ path: "domain_pack_registry", message: `Domain pack registry unavailable: ${registryResult.error}` });
  if (!observabilityResult.ok) errors.push({ path: "observability_catalog", message: `Observability catalog unavailable: ${observabilityResult.error}` });
  if (!policyMatrixResult.ok) errors.push({ path: "policy_matrix_catalog", message: `Policy matrix catalog unavailable: ${policyMatrixResult.error}` });
  if (policyMatrixResult.ok && !costBudgetGate) errors.push({ path: "policy_matrix_catalog.gate_rules.cost_budget_gate", message: "cost_budget_gate is not declared" });
  errors.push(...capabilityIndex.errors);
  for (const decision of budgetDecisions) {
    if (decision.budget_status === "blocked") {
      errors.push({
        path: `budget_decisions.${decision.budget_decision_id}`,
        message: `Cost budget blocked: ${decision.blocker_reasons.join(", ")}`,
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCostBudgetLedger({ budgetDecisions, validation }) {
  return {
    budget_decision_count: budgetDecisions.length,
    passed_decision_count: budgetDecisions.filter((decision) => decision.budget_status === "passed").length,
    blocked_decision_count: budgetDecisions.filter((decision) => decision.budget_status === "blocked").length,
    token_tracking_required_count: budgetDecisions.filter((decision) => decision.token_tracking_required).length,
    token_tracking_pending_count: budgetDecisions.filter((decision) => decision.token_tracking_status === "pending_records").length,
    cost_record_count: budgetDecisions.reduce((sum, decision) => sum + decision.cost_record_count, 0),
    total_max_usd: roundMoney(budgetDecisions.reduce((sum, decision) => sum + Number(decision.max_usd ?? 0), 0)),
    total_observed_usd: roundMoney(budgetDecisions.reduce((sum, decision) => sum + decision.observed_usd, 0)),
    total_observed_runtime_seconds: budgetDecisions.reduce((sum, decision) => sum + decision.observed_runtime_seconds, 0),
    validation_error_count: validation.errors.length,
    by_budget_status: countBy(budgetDecisions, "budget_status"),
    by_token_tracking_status: countBy(budgetDecisions, "token_tracking_status"),
    by_runtime_id: countBy(budgetDecisions, "runtime_id"),
    by_capability_id: countBy(budgetDecisions, "capability_id"),
  };
}

function renderCostBudgetLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Cost Budget Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Budget decisions: ${ledger.summary.budget_decision_count}`);
  lines.push(`- Passed decisions: ${ledger.summary.passed_decision_count}`);
  lines.push(`- Blocked decisions: ${ledger.summary.blocked_decision_count}`);
  lines.push(`- Token tracking required: ${ledger.summary.token_tracking_required_count}`);
  lines.push(`- Token tracking pending: ${ledger.summary.token_tracking_pending_count}`);
  lines.push(`- Total max USD: ${ledger.summary.total_max_usd}`);
  lines.push(`- Observed USD: ${ledger.summary.total_observed_usd}`);
  lines.push(`- Observed runtime seconds: ${ledger.summary.total_observed_runtime_seconds}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Decisions");
  lines.push("");
  for (const decision of ledger.budget_decisions) {
    lines.push(`- ${decision.budget_decision_id}: ${decision.budget_status}, max=$${decision.max_usd ?? "unknown"}, observed=$${decision.observed_usd}, tokens=${decision.token_tracking_status}`);
  }
  if (ledger.budget_decisions.length === 0) lines.push("- No budget decisions found.");
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
  return sumCostRecords(costRecords, (record) => (
    record.unit.toLowerCase() === "usd"
    || record.cost_type === "usd"
    || record.cost_type === "estimated_usd"
    || record.cost_type === "api_usd"
  ));
}

function sumCostRecords(costRecords, predicate) {
  return costRecords.reduce((sum, record) => sum + (predicate(record) ? Number(record.amount ?? 0) : 0), 0);
}

function costKey(workflowRunId, capabilityId) {
  return `${workflowRunId}:${capabilityId}`;
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
    outDir: DEFAULT_COST_BUDGET_LEDGER_OUT_DIR,
    modelRoutingLedgerPath: DEFAULT_COST_BUDGET_MODEL_ROUTING_LEDGER,
    domainPackRegistryPath: DEFAULT_COST_BUDGET_DOMAIN_PACK_REGISTRY,
    observabilityCatalogPath: DEFAULT_COST_BUDGET_OBSERVABILITY_CATALOG,
    policyMatrixCatalogPath: DEFAULT_COST_BUDGET_POLICY_MATRIX_CATALOG,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--model-routing-ledger") parsed.modelRoutingLedgerPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/cost-budget-ledger.mjs [options]

Options:
  --model-routing-ledger <path> model-routing-ledger.json path.
  --domain-pack-registry <path> domain-pack-registry.json path.
  --observability-catalog <path>
                                 observability-catalog.json path.
  --policy-matrix-catalog <path>
                                 policy-matrix-catalog.json path.
  --out-dir <folder>            Output directory.
  --run-at <iso>                Deterministic generated_at timestamp.
  --check                       Exit non-zero when the ledger is invalid.
  -h, --help                    Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
