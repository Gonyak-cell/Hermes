import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MODEL_ROUTING_LEDGER_OUT_DIR = "artifacts/model-routing/latest";
export const DEFAULT_MODEL_ROUTING_CONTEXT_PACKET_LEDGER = "artifacts/context-packets/latest/context-packet-ledger.json";
export const DEFAULT_MODEL_ROUTING_POLICY_MATRIX_CATALOG = "artifacts/policy-matrix/latest/policy-matrix-catalog.json";
export const DEFAULT_MODEL_ROUTING_POLICY_SNAPSHOT_LEDGER = "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json";
export const DEFAULT_MODEL_ROUTING_RUNTIME_ADAPTERS = "examples/core/runtime-adapters.json";

export async function runModelRoutingLedger(options = {}) {
  const result = await buildModelRoutingLedger(options);
  if (options.write !== false) await writeModelRoutingLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Model routing ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildModelRoutingLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MODEL_ROUTING_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const contextPacketLedgerPath = path.resolve(options.contextPacketLedgerPath ?? DEFAULT_MODEL_ROUTING_CONTEXT_PACKET_LEDGER);
  const policyMatrixCatalogPath = path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_MODEL_ROUTING_POLICY_MATRIX_CATALOG);
  const policySnapshotLedgerPath = path.resolve(options.policySnapshotLedgerPath ?? DEFAULT_MODEL_ROUTING_POLICY_SNAPSHOT_LEDGER);
  const runtimeAdaptersPath = path.resolve(options.runtimeAdaptersPath ?? DEFAULT_MODEL_ROUTING_RUNTIME_ADAPTERS);
  const contextResult = await readJsonOrError(contextPacketLedgerPath);
  const matrixResult = await readJsonOrError(policyMatrixCatalogPath);
  const snapshotResult = await readJsonOrError(policySnapshotLedgerPath);
  const runtimeResult = await readJsonOrError(runtimeAdaptersPath);
  const indexes = buildIndexes({ matrix: matrixResult.value, snapshots: snapshotResult.value, runtimes: runtimeResult.value });
  const routingDecisions = (contextResult.value?.context_packets ?? []).map((packet) => buildRoutingDecision(packet, indexes));
  const validation = validateModelRoutingLedger({
    contextResult,
    matrixResult,
    snapshotResult,
    runtimeResult,
    routingDecisions,
  });
  const ledger = {
    schema_version: "model-routing-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `model-routing-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    context_packet_ledger_path: contextPacketLedgerPath,
    policy_matrix_catalog_path: policyMatrixCatalogPath,
    policy_snapshot_ledger_path: policySnapshotLedgerPath,
    runtime_adapters_path: runtimeAdaptersPath,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeModelRoutingLedger({ routingDecisions, validation }),
    sources: buildSources({ contextResult, matrixResult, snapshotResult, runtimeResult }, {
      contextPacketLedgerPath,
      policyMatrixCatalogPath,
      policySnapshotLedgerPath,
      runtimeAdaptersPath,
    }),
    routing_decisions: routingDecisions,
    validation,
  };

  return {
    ...ledger,
    markdown: renderModelRoutingLedgerMarkdown(ledger),
  };
}

export async function writeModelRoutingLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "model-routing-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    context_packet_ledger_path: result.context_packet_ledger_path,
    policy_matrix_catalog_path: result.policy_matrix_catalog_path,
    policy_snapshot_ledger_path: result.policy_snapshot_ledger_path,
    runtime_adapters_path: result.runtime_adapters_path,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    routing_decisions: result.routing_decisions,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "routing-decisions.json"), {
    generated_at: result.generated_at,
    count: result.routing_decisions.length,
    routing_decisions: result.routing_decisions,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runModelRoutingLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runModelRoutingLedger(args);
    console.log(`Model routing ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Routing decisions: ${result.summary.routing_decision_count}`);
    console.log(`External transfers: ${result.summary.external_transfer_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildIndexes({ matrix, snapshots, runtimes }) {
  return {
    modelRules: new Map((matrix?.model_rules ?? []).map((rule) => [rule.classification, rule])),
    runtimeRules: new Map((matrix?.runtime_rules ?? []).map((rule) => [rule.classification, rule])),
    policyDecisions: new Map((snapshots?.policy_decisions ?? []).map((decision) => [
      `${decision.policy_snapshot_id}:${decision.classification}`,
      decision,
    ])),
    runtimeAdapters: new Map((runtimes?.adapters ?? []).map((adapter) => [adapter.runtime_id, adapter])),
  };
}

function buildSources(results, paths) {
  return [
    source("context_packet_ledger", "Context Packet Ledger", paths.contextPacketLedgerPath, results.contextResult),
    source("policy_matrix_catalog", "Policy Matrix Catalog", paths.policyMatrixCatalogPath, results.matrixResult),
    source("policy_snapshot_ledger", "Policy Snapshot Ledger", paths.policySnapshotLedgerPath, results.snapshotResult),
    source("runtime_adapter_registry", "Runtime Adapter Registry", paths.runtimeAdaptersPath, results.runtimeResult),
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

function buildRoutingDecision(packet, indexes) {
  const runtimeAdapter = indexes.runtimeAdapters.get(packet.runtime_id) ?? null;
  const modelRule = indexes.modelRules.get(packet.max_classification) ?? null;
  const runtimeRule = indexes.runtimeRules.get(packet.max_classification) ?? null;
  const policyDecision = indexes.policyDecisions.get(`${packet.policy_snapshot_id}:${packet.max_classification}`) ?? null;
  const externalTransfer = Boolean(runtimeAdapter?.execution_environment?.external_execution);
  const runtimePolicyStatus = runtimeStatus(packet.runtime_id, runtimeRule);
  const externalModelPolicy = policyDecision?.external_model_policy ?? modelRule?.external_model_policy ?? "unknown";
  const localModelPolicy = policyDecision?.local_model_policy ?? modelRule?.local_model_policy ?? "unknown";
  const redactionPolicy = policyDecision?.redaction_policy ?? modelRule?.redaction_policy ?? "unknown";
  const redactionStatus = deriveRedactionStatus({ packet, externalTransfer, redactionPolicy });
  const blockerReasons = buildBlockers({
    packet,
    runtimeAdapter,
    modelRule,
    runtimePolicyStatus,
    externalTransfer,
    externalModelPolicy,
    localModelPolicy,
    redactionStatus,
  });
  const approvalReasons = buildApprovalReasons({
    externalTransfer,
    externalModelPolicy,
    localModelPolicy,
    runtimePolicyStatus,
    modelRule,
  });
  const routeMode = deriveRouteMode({
    blockerReasons,
    approvalReasons,
    externalTransfer,
    externalModelPolicy,
    localModelPolicy,
    runtimePolicyStatus,
  });
  const routeStatus = blockerReasons.length > 0 ? "blocked" : approvalReasons.length > 0 ? "approval_required" : "ready";
  const requiredGates = unique([
    ...(runtimeRule?.required_gates ?? []),
    ...(policyDecision?.required_gates ?? []),
    ...(runtimeAdapter?.tool_policy?.required_gates ?? []),
  ]);
  const decision = {
    routing_decision_id: `model-route.${slugify(packet.context_packet_id)}`,
    context_packet_id: packet.context_packet_id,
    source_id: packet.source_id,
    workflow_run_id: packet.workflow_run_id,
    agent_run_id: packet.agent_run_id,
    runtime_id: packet.runtime_id,
    capability_id: packet.capability_id,
    domain_pack: packet.domain_pack,
    tenant_id: packet.tenant_id,
    matter_id: packet.matter_id,
    client_id: packet.client_id,
    policy_snapshot_id: packet.policy_snapshot_id,
    policy_decision_id: policyDecision?.decision_id ?? null,
    classification: packet.max_classification,
    context_mode: packet.context_mode,
    route_status: routeStatus,
    route_mode: routeMode,
    external_transfer: externalTransfer,
    provider_boundary: deriveProviderBoundary(runtimeAdapter),
    runtime_policy_status: runtimePolicyStatus,
    external_model_policy: externalModelPolicy,
    local_model_policy: localModelPolicy,
    redaction_policy: redactionPolicy,
    redaction_status: redactionStatus,
    audit_required: true,
    approval_required: approvalReasons.length > 0,
    approval_reasons: approvalReasons,
    blocker_reasons: blockerReasons,
    required_gates: requiredGates,
    prompt_injection_handling: packet.prompt_injection_handling,
    routing_hash: hashValue({
      context_packet_id: packet.context_packet_id,
      runtime_id: packet.runtime_id,
      classification: packet.max_classification,
      routeStatus,
      routeMode,
      externalTransfer,
      externalModelPolicy,
      localModelPolicy,
      redactionPolicy,
      redactionStatus,
      requiredGates,
    }),
    metadata: {
      context_item_count: packet.context_item_count,
      packet_status: packet.packet_status,
      runtime_execution_mode: runtimeAdapter?.execution_environment?.execution_mode ?? null,
      runtime_network_policy: runtimeAdapter?.execution_environment?.network_policy ?? null,
    },
  };
  return decision;
}

function runtimeStatus(runtimeId, runtimeRule) {
  if (!runtimeRule) return "unknown";
  if ((runtimeRule.forbidden_runtimes ?? []).includes(runtimeId)) return "forbidden";
  if ((runtimeRule.restricted_runtimes ?? []).includes(runtimeId)) return "restricted";
  if ((runtimeRule.allowed_runtimes ?? []).includes(runtimeId)) return "allowed";
  return "unlisted";
}

function deriveRedactionStatus({ packet, externalTransfer, redactionPolicy }) {
  if (packet.redaction_applied) return "enforced";
  if (externalTransfer && redactionPolicy === "required") return "missing_required_redaction";
  if (redactionPolicy === "recommended") return "not_applied_recommended";
  if (redactionPolicy === "not_required") return "not_required";
  if (redactionPolicy === "not_applicable") return "not_applicable";
  return "not_required";
}

function buildBlockers({ packet, runtimeAdapter, modelRule, runtimePolicyStatus, externalTransfer, externalModelPolicy, localModelPolicy, redactionStatus }) {
  const blockers = [];
  if (packet.packet_status !== "ready") blockers.push("context_packet_not_ready");
  if (!runtimeAdapter) blockers.push("runtime_adapter_missing");
  if (!modelRule) blockers.push("model_policy_missing");
  if (runtimePolicyStatus === "forbidden") blockers.push("runtime_forbidden_by_policy");
  if (runtimePolicyStatus === "unlisted") blockers.push("runtime_unlisted_by_policy");
  if (externalTransfer && externalModelPolicy === "forbidden") blockers.push("external_model_forbidden");
  if (!externalTransfer && localModelPolicy === "forbidden") blockers.push("local_model_forbidden");
  if (redactionStatus === "missing_required_redaction") blockers.push("redaction_required_before_external_transfer");
  return unique(blockers);
}

function buildApprovalReasons({ externalTransfer, externalModelPolicy, localModelPolicy, runtimePolicyStatus, modelRule }) {
  const reasons = [];
  if (runtimePolicyStatus === "restricted") reasons.push("runtime_restricted_by_policy");
  if (externalTransfer && externalModelPolicy === "approval_required") reasons.push("external_model_approval_required");
  if (!externalTransfer && localModelPolicy === "approval_required") reasons.push("local_model_approval_required");
  if (modelRule?.approval_required && externalTransfer) reasons.push("classification_model_approval_required");
  return unique(reasons);
}

function deriveRouteMode({ blockerReasons, approvalReasons, externalTransfer, externalModelPolicy, localModelPolicy, runtimePolicyStatus }) {
  if (blockerReasons.length > 0) return "blocked";
  if (externalTransfer) {
    if (approvalReasons.length > 0) return "external_requires_approval";
    if (externalModelPolicy === "allowed_with_audit") return "external_allowed_with_audit";
    return "external_restricted";
  }
  if (approvalReasons.length > 0) return "local_requires_approval";
  if (runtimePolicyStatus === "restricted" || localModelPolicy === "restricted") return "local_restricted";
  return "local_allowed";
}

function deriveProviderBoundary(runtimeAdapter) {
  if (!runtimeAdapter) return "unknown";
  if (runtimeAdapter.execution_environment?.external_execution) return "external_runtime";
  if (runtimeAdapter.runtime_id === "manual") return "manual";
  if (runtimeAdapter.runtime_id === "harness") return "control_plane";
  return "local_or_sandboxed";
}

function validateModelRoutingLedger({ contextResult, matrixResult, snapshotResult, runtimeResult, routingDecisions }) {
  const errors = [];
  if (!contextResult.ok) errors.push({ path: "context_packet_ledger", message: `Context packet ledger unavailable: ${contextResult.error}` });
  if (!matrixResult.ok) errors.push({ path: "policy_matrix_catalog", message: `Policy matrix catalog unavailable: ${matrixResult.error}` });
  if (!snapshotResult.ok) errors.push({ path: "policy_snapshot_ledger", message: `Policy snapshot ledger unavailable: ${snapshotResult.error}` });
  if (!runtimeResult.ok) errors.push({ path: "runtime_adapters", message: `Runtime adapter registry unavailable: ${runtimeResult.error}` });
  for (const decision of routingDecisions) {
    if (decision.route_status === "blocked") {
      errors.push({
        path: `routing_decisions.${decision.routing_decision_id}`,
        message: `Model route blocked: ${decision.blocker_reasons.join(", ")}`,
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeModelRoutingLedger({ routingDecisions, validation }) {
  return {
    routing_decision_count: routingDecisions.length,
    ready_route_count: routingDecisions.filter((decision) => decision.route_status === "ready").length,
    approval_required_route_count: routingDecisions.filter((decision) => decision.route_status === "approval_required").length,
    blocked_route_count: routingDecisions.filter((decision) => decision.route_status === "blocked").length,
    external_transfer_count: routingDecisions.filter((decision) => decision.external_transfer).length,
    local_route_count: routingDecisions.filter((decision) => !decision.external_transfer).length,
    audit_required_count: routingDecisions.filter((decision) => decision.audit_required).length,
    redaction_enforced_count: routingDecisions.filter((decision) => decision.redaction_status === "enforced").length,
    runtime_restricted_count: routingDecisions.filter((decision) => decision.runtime_policy_status === "restricted").length,
    validation_error_count: validation.errors.length,
    by_route_status: countBy(routingDecisions, "route_status"),
    by_route_mode: countBy(routingDecisions, "route_mode"),
    by_runtime_id: countBy(routingDecisions, "runtime_id"),
    by_classification: countBy(routingDecisions, "classification"),
    by_external_model_policy: countBy(routingDecisions, "external_model_policy"),
    by_runtime_policy_status: countBy(routingDecisions, "runtime_policy_status"),
  };
}

function renderModelRoutingLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Model Routing Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Routing decisions: ${ledger.summary.routing_decision_count}`);
  lines.push(`- Ready routes: ${ledger.summary.ready_route_count}`);
  lines.push(`- Approval required routes: ${ledger.summary.approval_required_route_count}`);
  lines.push(`- Blocked routes: ${ledger.summary.blocked_route_count}`);
  lines.push(`- External transfers: ${ledger.summary.external_transfer_count}`);
  lines.push(`- Redaction enforced: ${ledger.summary.redaction_enforced_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Decisions");
  lines.push("");
  for (const decision of ledger.routing_decisions) {
    lines.push(`- ${decision.routing_decision_id}: ${decision.runtime_id}, ${decision.route_mode}, ${decision.classification}`);
  }
  if (ledger.routing_decisions.length === 0) lines.push("- No routing decisions found.");
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

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_MODEL_ROUTING_LEDGER_OUT_DIR,
    contextPacketLedgerPath: DEFAULT_MODEL_ROUTING_CONTEXT_PACKET_LEDGER,
    policyMatrixCatalogPath: DEFAULT_MODEL_ROUTING_POLICY_MATRIX_CATALOG,
    policySnapshotLedgerPath: DEFAULT_MODEL_ROUTING_POLICY_SNAPSHOT_LEDGER,
    runtimeAdaptersPath: DEFAULT_MODEL_ROUTING_RUNTIME_ADAPTERS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--context-packet-ledger") parsed.contextPacketLedgerPath = argv[++index];
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--runtime-adapters") parsed.runtimeAdaptersPath = argv[++index];
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
  console.log(`Usage: node scripts/model-routing-ledger.mjs [options]

Options:
  --context-packet-ledger <path> context-packet-ledger.json path.
  --policy-matrix-catalog <path> policy-matrix-catalog.json path.
  --policy-snapshot-ledger <path>
                                  policy-snapshot-ledger.json path.
  --runtime-adapters <path>      runtime-adapter-registry.v1 JSON path.
  --out-dir <folder>             Output directory.
  --run-at <iso>                 Deterministic generated_at timestamp.
  --check                        Exit non-zero when the ledger is invalid.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
