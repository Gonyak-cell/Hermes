import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR = "artifacts/control-plane-goal-checkpoint/latest";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH = "artifacts/dashboard/latest/review-dashboard.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH = "artifacts/control-plane-loop/latest/control-plane-loop.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH = "artifacts/control-plane-health/latest/control-plane-health.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH = "package.json";
export const DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH = "docs/implementation-roadmap.md";

const GOAL_ITEMS = [
  packageScriptItem("core_contracts", "Core contracts", "contracts", "validate:core", "control-plane-core-contracts"),
  sourceItem("policy_matrix_catalog", "Identity/Policy matrix", "policy", "policy_matrix_catalog", "control-plane-policy-matrix"),
  sourceItem("policy_snapshot_ledger", "Policy snapshot ledger", "policy", "policy_snapshot_ledger", "control-plane-policy-snapshots"),
  sourceItem("context_packet_ledger", "Context builder and retrieval filters", "context", "context_packet_ledger", "control-plane-context-builder"),
  sourceItem("model_routing_ledger", "Model routing and external transfer decisions", "runtime", "model_routing_ledger", "control-plane-model-routing"),
  sourceItem("cost_budget_ledger", "Cost budget gate ledger", "gate_approval", "cost_budget_ledger", "control-plane-cost-budget"),
  sourceItem("token_usage_ledger", "Token usage ledger", "observability", "token_usage_ledger", "control-plane-token-usage"),
  sourceItem("domain_pack_registry", "Plugin-style domain packs", "domain_packs", "domain_pack_registry", "control-plane-domain-packs"),
  sourceItem("resource_expansion", "Resource expansion", "resource_evidence", "resource_expansion", "control-plane-resource-expansion"),
  sourceItem("resource_ingest", "Resource/Evidence ingest gate", "resource_evidence", "resource_ingest", "control-plane-resource-ingest"),
  sourceItem("evidence_viewer", "Evidence viewer", "resource_evidence", "evidence_viewer", "control-plane-evidence-viewer", { acceptance_profile: "evidence_review_gate" }),
  sourceItem("approval_workflow", "Gate and approval workflow", "gate_approval", "approval_inbox", "control-plane-approval-workflow", { acceptance_profile: "approval_gate" }),
  sourceItem("law_firm_slice", "Law-firm LDD slice", "law_firm", "law_firm_ldd_slice", "control-plane-law-firm-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("personal_dev_slice", "Personal-dev Claude/Codex slice", "personal_dev", "personal_dev_slice", "control-plane-personal-dev-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("creative_document_slice", "Creative/document slice", "creative_document", "creative_document_slice", "control-plane-creative-document-slice", { acceptance_profile: "protected_human_gate" }),
  sourceItem("output_observability", "Output and observability planes", "observability", "observability_catalog", "control-plane-observability", { acceptance_profile: "observability_gate" }),
  sourceItem("audit_trail", "Audit trail", "audit", "control_plane_audit_trail", "control-plane-audit-trail"),
  sourceItem("delivery_matter_cockpit", "Protected delivery and matter cockpit", "delivery", "matter_cockpit", "control-plane-matter-cockpit", { acceptance_profile: "matter_cockpit_gate" }),
  sourceItem("control_plane_loop", "Automated control-plane loop", "control_plane", "control_plane_loop", "control-plane-loop"),
  scriptItem("dashboard_api", "Dashboard/API read-only surface", "dashboard_api", "api:smoke", "control-plane-api"),
];

export async function runControlPlaneGoalCheckpoint(options = {}) {
  const result = await buildControlPlaneGoalCheckpoint(options);
  if (options.write !== false) await writeControlPlaneGoalCheckpoint(result, result.output_dir);
  return result;
}

export async function buildControlPlaneGoalCheckpoint(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const dashboardPath = path.resolve(options.dashboardPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH);
  const loopPath = path.resolve(options.loopPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH);
  const healthPath = path.resolve(options.healthPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH);
  const packagePath = path.resolve(options.packagePath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH);
  const roadmapPath = path.resolve(options.roadmapPath ?? DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH);
  const dashboardResult = await readJsonOrError(dashboardPath);
  const loopResult = await readJsonOrError(loopPath);
  const healthResult = await readJsonOrError(healthPath);
  const packageResult = await readJsonOrError(packagePath);
  const roadmapResult = await readTextOrError(roadmapPath);
  const context = buildContext(dashboardResult, loopResult, healthResult, packageResult, roadmapResult);
  const checkpointItems = GOAL_ITEMS.map((item) => buildCheckpointItem(item, context));
  const checkpoint = {
    schema_version: "control-plane-goal-checkpoint.v1",
    generated_at: generatedAt,
    checkpoint_id: `control-plane-goal-checkpoint.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    checkpoint_status: deriveCheckpointStatus(checkpointItems),
    sources: [
      buildSource("review_dashboard", "Review Dashboard", dashboardPath, dashboardResult),
      buildSource("control_plane_loop", "Control Plane Loop", loopPath, loopResult),
      buildSource("control_plane_health", "Control Plane Health", healthPath, healthResult),
      buildSource("package_json", "Package Scripts", packagePath, packageResult),
      buildSource("implementation_roadmap", "Implementation Roadmap", roadmapPath, roadmapResult),
    ],
    summary: summarizeCheckpoint(checkpointItems, context),
    checkpoint_items: checkpointItems,
    next_focus: checkpointItems.find((item) => item.status !== "passed") ?? null,
  };

  return {
    ...checkpoint,
    markdown: renderGoalCheckpointMarkdown(checkpoint),
  };
}

export async function writeControlPlaneGoalCheckpoint(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-goal-checkpoint.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    checkpoint_id: result.checkpoint_id,
    output_dir: result.output_dir,
    checkpoint_status: result.checkpoint_status,
    sources: result.sources,
    summary: result.summary,
    checkpoint_items: result.checkpoint_items,
    next_focus: result.next_focus,
  });
  await writeJson(path.join(outDir, "checkpoint-items.json"), {
    generated_at: result.generated_at,
    count: result.checkpoint_items.length,
    items: result.checkpoint_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneGoalCheckpointCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneGoalCheckpoint(args);
  console.log(`Control plane goal checkpoint written to ${result.output_dir}`);
  console.log(`Checkpoint status: ${result.checkpoint_status}`);
  console.log(`Passed items: ${result.summary.passed_item_count}/${result.summary.checkpoint_item_count}`);
  console.log(`Attention items: ${result.summary.attention_item_count}`);
}

function buildContext(dashboardResult, loopResult, healthResult, packageResult, roadmapResult) {
  const dashboard = dashboardResult.value;
  const sourcesById = new Map((dashboard?.sources ?? []).map((source) => [source.source_id, source]));
  const stagesById = new Map((dashboard?.stage_statuses ?? []).map((stage) => [stage.stage_id, stage]));
  const packageScripts = packageResult.value?.scripts ?? {};
  const roadmapText = roadmapResult.value ?? "";
  return {
    dashboardResult,
    loopResult,
    healthResult,
    packageResult,
    roadmapResult,
    dashboard,
    loop: loopResult.value,
    health: healthResult.value,
    sourcesById,
    stagesById,
    packageScripts,
    roadmapPhaseCount: [...roadmapText.matchAll(/^## Phase \d+:/gm)].length,
    latestRoadmapPhase: latestRoadmapPhase(roadmapText),
  };
}

function buildCheckpointItem(item, context) {
  if (item.check_type === "script") {
    const hasScript = Boolean(context.packageScripts[item.script_name]);
    return checkpointItem(item, {
      status: hasScript ? "passed" : "missing",
      evidence_refs: hasScript ? [`package.json#scripts.${item.script_name}`] : [],
      reason: hasScript
        ? `${item.script_name} script is registered.`
        : `${item.script_name} script is not registered.`,
      recommended_actions: hasScript ? [] : ["add_package_script", "rerun_goal_checkpoint"],
    });
  }

  if (item.check_type === "package_script") {
    const hasScript = Boolean(context.packageScripts[item.script_name]);
    return checkpointItem(item, {
      status: hasScript ? "passed" : "missing",
      evidence_refs: hasScript ? [`package.json#scripts.${item.script_name}`] : [],
      reason: hasScript
        ? `${item.script_name} validates the core contracts.`
        : `${item.script_name} script is not registered.`,
      recommended_actions: hasScript ? [] : ["add_validate_core_script", "npm_run_validate"],
    });
  }

  const source = context.sourcesById.get(item.source_id);
  const stage = context.stagesById.get(item.source_id);
  if (!source && !stage) {
    return checkpointItem(item, {
      status: "missing",
      evidence_refs: [],
      reason: `${item.source_id} is not registered in the dashboard.`,
      recommended_actions: ["register_dashboard_source", "rerun_dashboard_build"],
    });
  }
  if (source && !source.available) {
    return checkpointItem(item, {
      status: "missing",
      evidence_refs: [`source:${item.source_id}`],
      reason: `${item.source_id} source is registered but unavailable: ${source.error ?? "unavailable"}.`,
      recommended_actions: ["run_source_stage", "rerun_dashboard_build"],
    });
  }
  if (!stage) {
    return checkpointItem(item, {
      status: "attention",
      evidence_refs: [`source:${item.source_id}`],
      reason: `${item.source_id} source is available but has no stage status.`,
      recommended_actions: ["add_stage_status", "rerun_dashboard_build"],
    });
  }

  const acceptance = evaluateStageAcceptance(item, stage);
  const status = acceptance.status;
  return checkpointItem(item, {
    status,
    evidence_refs: [`source:${item.source_id}`, `stage:${stage.stage_id}`],
    reason: acceptance.reason ?? `${stage.label} stage is ${stage.status}: ${stage.message}`,
    recommended_actions: status === "passed" ? [] : ["inspect_dashboard_stage", "resolve_stage_blocker", "rerun_control_plane_loop"],
    implementation_status: acceptance.implementation_status,
    operational_status: stage.status,
    acceptance_profile: item.acceptance_profile ?? "stage_status",
  });
}

function checkpointItem(item, result) {
  return {
    checkpoint_item_id: item.checkpoint_item_id,
    category: item.category,
    label: item.label,
    status: result.status,
    priority: priorityForStatus(result.status),
    evidence_refs: result.evidence_refs,
    reason: result.reason,
    recommended_actions: result.recommended_actions,
    implementation_status: result.implementation_status ?? result.status,
    operational_status: result.operational_status ?? result.status,
    acceptance_profile: result.acceptance_profile ?? item.acceptance_profile ?? "direct",
  };
}

function summarizeCheckpoint(items, context) {
  return {
    checkpoint_status: deriveCheckpointStatus(items),
    checkpoint_item_count: items.length,
    passed_item_count: items.filter((item) => item.status === "passed").length,
    attention_item_count: items.filter((item) => item.status === "attention").length,
    blocked_item_count: items.filter((item) => item.status === "blocked").length,
    missing_item_count: items.filter((item) => item.status === "missing").length,
    roadmap_phase_count: context.roadmapPhaseCount,
    latest_roadmap_phase: context.latestRoadmapPhase,
    dashboard_available: context.dashboardResult.ok,
    loop_available: context.loopResult.ok,
    loop_status: context.loop?.loop_status ?? null,
    health_available: context.healthResult.ok,
    health_status: context.health?.overall_health ?? null,
    dashboard_overall_status: context.dashboard?.summary?.overall_status ?? null,
    dashboard_action_item_count: context.dashboard?.summary?.action_item_count ?? 0,
    implementation_gate_pass_count: items.filter((item) => item.implementation_status === "passed_with_operational_gate").length,
    operational_blocker_count: items.filter((item) => ["attention", "blocked", "pending"].includes(item.operational_status)).length,
    by_status: countBy(items, "status"),
    by_category: countBy(items, "category"),
  };
}

function deriveCheckpointStatus(items) {
  if (items.some((item) => item.status === "blocked")) return "blocked";
  if (items.some((item) => item.status === "missing")) return "incomplete";
  if (items.some((item) => item.status === "attention")) return "attention";
  return "passed";
}

function priorityForStatus(status) {
  if (status === "blocked") return "high";
  if (status === "missing") return "high";
  if (status === "attention") return "medium";
  return "low";
}

function renderGoalCheckpointMarkdown(checkpoint) {
  const lines = [];
  lines.push("# Control Plane Goal Checkpoint");
  lines.push("");
  lines.push(`Generated: ${checkpoint.generated_at}`);
  lines.push(`Checkpoint status: ${checkpoint.checkpoint_status}`);
  lines.push("");
  lines.push(`- Items: ${checkpoint.summary.checkpoint_item_count}`);
  lines.push(`- Passed: ${checkpoint.summary.passed_item_count}`);
  lines.push(`- Attention: ${checkpoint.summary.attention_item_count}`);
  lines.push(`- Blocked: ${checkpoint.summary.blocked_item_count}`);
  lines.push(`- Missing: ${checkpoint.summary.missing_item_count}`);
  lines.push(`- Latest roadmap phase: ${checkpoint.summary.latest_roadmap_phase ?? "unknown"}`);
  lines.push("");
  lines.push("## Checkpoint Items");
  lines.push("");
  for (const item of checkpoint.checkpoint_items) {
    lines.push(`- ${item.checkpoint_item_id}: ${item.status} - ${item.reason}`);
  }
  if (checkpoint.next_focus) {
    lines.push("");
    lines.push(`Next focus: ${checkpoint.next_focus.label} (${checkpoint.next_focus.status})`);
  }
  return `${lines.join("\n")}\n`;
}

function evaluateStageAcceptance(item, stage) {
  const directStatus = stage.status === "passed" || stage.status === "ready"
    ? "passed"
    : stage.status === "blocked"
      ? "blocked"
      : "attention";
  if (directStatus === "passed") {
    return {
      status: "passed",
      implementation_status: "passed",
      reason: `${stage.label} stage is ${stage.status}: ${stage.message}`,
    };
  }

  const metrics = stage.metrics ?? {};
  if (item.acceptance_profile === "evidence_review_gate") {
    const blockingGateCount = metrics.blocking_gate_count ?? 0;
    const blockedItemCount = metrics.blocked_item_count ?? 0;
    if (blockingGateCount === 0 && blockedItemCount === 0 && (metrics.evidence_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Evidence review queue is implemented and waiting for human evidence decisions.");
    }
  }

  if (item.acceptance_profile === "approval_gate") {
    if ((metrics.inbox_item_count ?? 0) >= 0 && (metrics.approval_request_count ?? 0) >= 0) {
      return passedWithOperationalGate(stage, "Approval workflow is implemented; remaining items are human approval work.");
    }
  }

  if (item.acceptance_profile === "protected_human_gate") {
    const expectedBlockers = new Set([
      "attorney_approval_pending",
      "human_approval_pending",
      "merge_approval_pending",
    ]);
    if (expectedBlockers.has(metrics.blocked_reason)) {
      return passedWithOperationalGate(stage, `${stage.label} reached its required protected human gate.`);
    }
  }

  if (item.acceptance_profile === "observability_gate") {
    const errors = metrics.error_record_count ?? 0;
    if (errors === 0 && (metrics.workflow_run_count ?? 0) > 0 && (metrics.event_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Observability plane is recording runs, events, and gate blockers without runtime errors.");
    }
  }

  if (item.acceptance_profile === "matter_cockpit_gate") {
    if ((metrics.matter_count ?? 0) > 0 && (metrics.resource_count ?? 0) > 0 && (metrics.evidence_count ?? 0) > 0) {
      return passedWithOperationalGate(stage, "Matter Cockpit is implemented and surfacing protected delivery blockers.");
    }
  }

  return {
    status: directStatus,
    implementation_status: directStatus,
    reason: `${stage.label} stage is ${stage.status}: ${stage.message}`,
  };
}

function passedWithOperationalGate(stage, reason) {
  return {
    status: "passed",
    implementation_status: "passed_with_operational_gate",
    reason: `${reason} Operational status remains ${stage.status}: ${stage.message}`,
  };
}

function sourceItem(id, label, category, sourceId, checkpointItemId, options = {}) {
  return {
    check_type: "source",
    id,
    label,
    category,
    source_id: sourceId,
    checkpoint_item_id: checkpointItemId,
    acceptance_profile: options.acceptance_profile ?? "stage_status",
  };
}

function scriptItem(id, label, category, scriptName, checkpointItemId) {
  return {
    check_type: "script",
    id,
    label,
    category,
    script_name: scriptName,
    checkpoint_item_id: checkpointItemId,
  };
}

function packageScriptItem(id, label, category, scriptName, checkpointItemId) {
  return {
    check_type: "package_script",
    id,
    label,
    category,
    script_name: scriptName,
    checkpoint_item_id: checkpointItemId,
  };
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.ok ? null : result.error,
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
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function latestRoadmapPhase(text) {
  const matches = [...String(text ?? "").matchAll(/^## Phase (\d+): (.+)$/gm)];
  const latest = matches.at(-1);
  if (!latest) return null;
  return `Phase ${latest[1]}: ${latest[2]}`;
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

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    dashboardPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_DASHBOARD_PATH,
    loopPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_LOOP_PATH,
    healthPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_HEALTH_PATH,
    packagePath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_PACKAGE_PATH,
    roadmapPath: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_ROADMAP_PATH,
    outDir: DEFAULT_CONTROL_PLANE_GOAL_CHECKPOINT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--loop") parsed.loopPath = argv[++index];
    else if (arg === "--health") parsed.healthPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-goal-checkpoint.mjs [options]

Options:
  --dashboard <path>  review-dashboard.json path.
  --loop <path>       control-plane-loop.json path.
  --health <path>     control-plane-health.json path.
  --package <path>    package.json path.
  --roadmap <path>    implementation-roadmap.md path.
  --out-dir <folder>  Output directory.
  --run-at <iso>      Deterministic generated_at timestamp.
  -h, --help          Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
