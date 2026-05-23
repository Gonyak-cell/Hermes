import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_ACTION_PLAN_OUT_DIR = "artifacts/control-plane-action-plan/latest";
export const DEFAULT_CONTROL_PLANE_ACTION_PLAN_DASHBOARD_PATH = "artifacts/dashboard/latest/review-dashboard.json";
export const DEFAULT_CONTROL_PLANE_ACTION_PLAN_HEALTH_PATH = "artifacts/control-plane-health/latest/control-plane-health.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER = {
  blocked: 0,
  waiting_for_human: 1,
  ready_to_run: 2,
  open: 3,
};

const HUMAN_ACTIONS = new Set([
  "apply_approval_decisions",
  "confirm_attorney_delivery_approval",
  "confirm_citation_spot_check_completed",
  "fill_closeout_receipts",
  "open_approval_inbox",
  "open_review_dashboard",
  "perform_manual_delivery_or_merge",
  "record_delivery_reference",
  "resolve_dashboard_action_queue",
  "review_blocked_items_next",
  "review_blocking_gates",
  "triage_high_priority_actions",
]);

const PROTECTED_ACTIONS = new Set([
  "perform_manual_delivery_or_merge",
]);

const ACTION_COMMANDS = {
  apply_approval_decisions: ["npm run approval:inbox:apply", "npm run dashboard:build"],
  fill_closeout_receipts: ["npm run delivery:closeout:validate", "npm run delivery:closeout:apply"],
  fix_closeout_receipts: ["npm run delivery:closeout:validate", "npm run delivery:closeout:apply"],
  fix_receipt_input: ["npm run delivery:closeout:validate"],
  inspect_pipeline_step_logs: ["node scripts/review-api.mjs --once \"/api/pipeline-steps?status=failed\""],
  inspect_loop_step_logs: ["node scripts/review-api.mjs --once \"/api/control-plane-loop-steps?status=failed\""],
  open_approval_inbox: ["npm run approval:inbox"],
  open_matter_cockpit: ["npm run matter:cockpit"],
  open_review_dashboard: ["npm run dashboard:build"],
  query_api_actions: ["node scripts/review-api.mjs --once \"/api/actions?priority=high\""],
  rebuild_dashboard: ["npm run dashboard:build"],
  rerun_control_plane_pipeline: ["npm run control-plane:pipeline"],
  rerun_control_plane_loop: ["npm run control-plane:loop"],
  rerun_goal_checkpoint: ["npm run control-plane:goal-checkpoint", "npm run dashboard:build"],
  rerun_delivery_closeout_apply: ["npm run delivery:closeout:apply"],
  rerun_delivery_closeout_validate: ["npm run delivery:closeout:validate"],
  rerun_matter_cockpit: ["npm run matter:cockpit"],
  rerun_post_delivery_reconciliation: ["npm run delivery:reconcile"],
  run_control_plane_pipeline: ["npm run control-plane:pipeline"],
  run_dashboard_build: ["npm run dashboard:build"],
};

export async function runControlPlaneActionPlan(options = {}) {
  const result = await buildControlPlaneActionPlan(options);
  if (options.write !== false) await writeControlPlaneActionPlan(result, result.output_dir);
  return result;
}

export async function buildControlPlaneActionPlan(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_ACTION_PLAN_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const dashboardPath = path.resolve(options.dashboardPath ?? DEFAULT_CONTROL_PLANE_ACTION_PLAN_DASHBOARD_PATH);
  const healthPath = path.resolve(options.healthPath ?? DEFAULT_CONTROL_PLANE_ACTION_PLAN_HEALTH_PATH);
  const dashboardResult = await readJsonOrError(dashboardPath);
  const healthResult = await readJsonOrError(healthPath);
  const planItems = buildPlanItems(dashboardResult, healthResult).sort(comparePlanItems);
  const plan = {
    schema_version: "control-plane-action-plan.v1",
    generated_at: generatedAt,
    plan_id: `control-plane-action-plan.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    plan_status: derivePlanStatus(planItems, dashboardResult, healthResult),
    sources: [
      buildSource("review_dashboard", "Review Dashboard", dashboardPath, dashboardResult),
      buildSource("control_plane_health", "Control Plane Health", healthPath, healthResult),
    ],
    summary: summarizePlan(planItems),
    plan_items: planItems,
  };

  return {
    ...plan,
    markdown: renderActionPlanMarkdown(plan),
  };
}

export async function writeControlPlaneActionPlan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-action-plan.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    plan_id: result.plan_id,
    output_dir: result.output_dir,
    plan_status: result.plan_status,
    sources: result.sources,
    summary: result.summary,
    plan_items: result.plan_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneActionPlanCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneActionPlan(args);
  console.log(`Control plane action plan written to ${result.output_dir}`);
  console.log(`Plan status: ${result.plan_status}`);
  console.log(`Plan items: ${result.summary.plan_item_count}`);
  console.log(`Waiting for human: ${result.summary.waiting_for_human_count}`);
  console.log(`Ready to run: ${result.summary.ready_to_run_count}`);
}

function buildPlanItems(dashboardResult, healthResult) {
  const items = [];
  if (!dashboardResult.ok) {
    items.push(missingSourcePlanItem("review_dashboard", "Review Dashboard", dashboardResult.error, ["run_dashboard_build"]));
  }
  if (!healthResult.ok) {
    items.push(missingSourcePlanItem("control_plane_health", "Control Plane Health", healthResult.error, ["run_control_plane_pipeline", "run_dashboard_build"]));
  }

  for (const healthCheck of healthResult.value?.health_checks ?? []) {
    if (healthCheck.status === "passed") continue;
    items.push(planItemFromHealthCheck(healthCheck));
  }

  for (const actionItem of dashboardResult.value?.action_items ?? []) {
    if (["control_plane_action_plan", "control_plane_health"].includes(actionItem.source_stage)) continue;
    items.push(planItemFromDashboardAction(actionItem));
  }

  return dedupePlanItems(items);
}

function missingSourcePlanItem(sourceStage, label, error, recommendedActions) {
  return buildPlanItem({
    plan_item_id: `action-plan.${sourceStage}.missing`,
    source_type: "source_availability",
    source_stage: sourceStage,
    priority: "critical",
    raw_status: "missing",
    title: `${label} artifact is missing`,
    subject_ref: {
      subject_type: "source_artifact",
      subject_id: sourceStage,
    },
    reason: `${label} could not be read: ${error}`,
    recommended_actions: recommendedActions,
    source_refs: [
      {
        source_id: sourceStage,
        ref_id: sourceStage,
        path: null,
      },
    ],
  });
}

function planItemFromHealthCheck(healthCheck) {
  return buildPlanItem({
    plan_item_id: `action-plan.health.${slugify(healthCheck.check_id)}`,
    source_type: "health_check",
    source_stage: healthCheck.source_stage,
    priority: healthSeverityToPriority(healthCheck.severity),
    raw_status: healthCheck.status,
    title: `Resolve health check: ${healthCheck.label}`,
    subject_ref: {
      subject_type: "control_plane_health_check",
      subject_id: healthCheck.check_id,
    },
    reason: healthCheck.reason,
    recommended_actions: healthCheck.recommended_actions ?? [],
    source_refs: [
      {
        source_id: "control_plane_health",
        ref_id: healthCheck.check_id,
        path: null,
      },
    ],
  });
}

function planItemFromDashboardAction(actionItem) {
  return buildPlanItem({
    plan_item_id: `action-plan.dashboard.${slugify(actionItem.action_item_id)}`,
    source_type: "dashboard_action",
    source_stage: actionItem.source_stage,
    priority: actionItem.priority,
    raw_status: actionItem.status,
    title: actionItem.title,
    subject_ref: actionItem.subject_ref,
    reason: actionItem.reason,
    recommended_actions: actionItem.recommended_actions ?? [],
    source_refs: [
      {
        source_id: "review_dashboard",
        ref_id: actionItem.action_item_id,
        path: null,
      },
    ],
  });
}

function buildPlanItem(input) {
  const recommendedActions = unique(input.recommended_actions ?? []);
  const requiresHuman = recommendedActions.some((action) => HUMAN_ACTIONS.has(action)) || isHumanStage(input.source_stage);
  const protectedAction = recommendedActions.some((action) => PROTECTED_ACTIONS.has(action));
  return {
    plan_item_id: input.plan_item_id,
    source_type: input.source_type,
    source_stage: input.source_stage,
    priority: input.priority ?? "medium",
    status: deriveItemStatus(input.raw_status, requiresHuman, protectedAction),
    title: input.title,
    subject_ref: input.subject_ref,
    reason: input.reason,
    recommended_actions: recommendedActions,
    next_commands: commandsForActions(recommendedActions),
    requires_human: requiresHuman,
    protected_action: protectedAction,
    source_refs: input.source_refs ?? [],
  };
}

function deriveItemStatus(rawStatus, requiresHuman, protectedAction) {
  if (protectedAction || rawStatus === "missing" || String(rawStatus ?? "").includes("blocked")) return "blocked";
  if (requiresHuman) return "waiting_for_human";
  if (rawStatus === "attention" || rawStatus === "pending" || rawStatus === "failed") return "ready_to_run";
  return "open";
}

function derivePlanStatus(planItems, dashboardResult, healthResult) {
  if (!dashboardResult.ok || !healthResult.ok) return "blocked";
  if (planItems.some((item) => item.status === "blocked")) return "blocked";
  if (planItems.length > 0) return "open";
  return "clear";
}

function summarizePlan(planItems) {
  return {
    plan_status: planItems.length === 0 ? "clear" : planItems.some((item) => item.status === "blocked") ? "blocked" : "open",
    plan_item_count: planItems.length,
    open_item_count: planItems.filter((item) => item.status !== "blocked").length,
    blocked_item_count: planItems.filter((item) => item.status === "blocked").length,
    waiting_for_human_count: planItems.filter((item) => item.status === "waiting_for_human").length,
    ready_to_run_count: planItems.filter((item) => item.status === "ready_to_run").length,
    protected_action_count: planItems.filter((item) => item.protected_action).length,
    human_required_count: planItems.filter((item) => item.requires_human).length,
    critical_count: planItems.filter((item) => item.priority === "critical").length,
    high_count: planItems.filter((item) => item.priority === "high").length,
    medium_count: planItems.filter((item) => item.priority === "medium").length,
    low_count: planItems.filter((item) => item.priority === "low").length,
    health_item_count: planItems.filter((item) => item.source_type === "health_check").length,
    dashboard_item_count: planItems.filter((item) => item.source_type === "dashboard_action").length,
    by_priority: countBy(planItems, "priority"),
    by_status: countBy(planItems, "status"),
    by_source_stage: countBy(planItems, "source_stage"),
  };
}

function renderActionPlanMarkdown(plan) {
  const lines = [];
  lines.push("# Control Plane Action Plan");
  lines.push("");
  lines.push(`Generated: ${plan.generated_at}`);
  lines.push(`Plan status: ${plan.plan_status}`);
  lines.push("");
  lines.push(`- Plan items: ${plan.summary.plan_item_count}`);
  lines.push(`- Blocked: ${plan.summary.blocked_item_count}`);
  lines.push(`- Waiting for human: ${plan.summary.waiting_for_human_count}`);
  lines.push(`- Ready to run: ${plan.summary.ready_to_run_count}`);
  lines.push(`- Protected actions: ${plan.summary.protected_action_count}`);
  lines.push("");
  lines.push("## Ordered Items");
  lines.push("");
  for (const item of plan.plan_items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.status})`);
    if (item.next_commands.length > 0) {
      lines.push(`  - Commands: ${item.next_commands.join("; ")}`);
    }
    if (item.requires_human) lines.push("  - Human review required.");
  }
  if (plan.plan_items.length === 0) lines.push("- No open action items.");
  return `${lines.join("\n")}\n`;
}

function dedupePlanItems(items) {
  const seen = new Map();
  for (const item of items) {
    const key = `${item.source_type}:${item.source_stage}:${item.subject_ref.subject_type}:${item.subject_ref.subject_id}`;
    const existing = seen.get(key);
    if (!existing || comparePlanItems(item, existing) < 0) seen.set(key, item);
  }
  return [...seen.values()];
}

function commandsForActions(actions) {
  return unique(actions.flatMap((action) => ACTION_COMMANDS[action] ?? []));
}

function isHumanStage(sourceStage) {
  return [
    "approval_decisions",
    "approval_inbox",
    "approval_inbox_decisions",
    "closeout_receipt_validation",
    "delivery_closeout_queue",
    "law_firm_ldd_slice",
    "protected_delivery_queue",
  ].includes(sourceStage);
}

function comparePlanItems(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    a.source_stage.localeCompare(b.source_stage) ||
    a.title.localeCompare(b.title)
  );
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

function healthSeverityToPriority(severity) {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
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
  return [...new Set(values.filter(Boolean))];
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    dashboardPath: DEFAULT_CONTROL_PLANE_ACTION_PLAN_DASHBOARD_PATH,
    healthPath: DEFAULT_CONTROL_PLANE_ACTION_PLAN_HEALTH_PATH,
    outDir: DEFAULT_CONTROL_PLANE_ACTION_PLAN_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--health") parsed.healthPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-action-plan.mjs [options]

Options:
  --dashboard <path>       review-dashboard.json path.
  --health <path>          control-plane-health.json path.
  --out-dir <folder>       Output directory.
  --run-at <iso>           Deterministic generated_at timestamp.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
