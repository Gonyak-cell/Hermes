import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_HEALTH_OUT_DIR = "artifacts/control-plane-health/latest";
export const DEFAULT_CONTROL_PLANE_HEALTH_DASHBOARD_PATH = "artifacts/dashboard/latest/review-dashboard.json";
export const DEFAULT_CONTROL_PLANE_HEALTH_PIPELINE_PATH = "artifacts/control-plane-pipeline/latest/control-plane-pipeline.json";

export async function runControlPlaneHealth(options = {}) {
  const result = await buildControlPlaneHealth(options);
  if (options.write !== false) await writeControlPlaneHealth(result, result.output_dir);
  return result;
}

export async function buildControlPlaneHealth(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_HEALTH_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const dashboardPath = path.resolve(options.dashboardPath ?? DEFAULT_CONTROL_PLANE_HEALTH_DASHBOARD_PATH);
  const pipelinePath = path.resolve(options.pipelinePath ?? DEFAULT_CONTROL_PLANE_HEALTH_PIPELINE_PATH);
  const dashboardResult = await readJsonOrError(dashboardPath);
  const pipelineResult = await readJsonOrError(pipelinePath);
  const healthChecks = buildHealthChecks(dashboardResult, pipelineResult);
  const health = {
    schema_version: "control-plane-health.v1",
    generated_at: generatedAt,
    health_id: `control-plane-health.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    overall_health: deriveOverallHealth(healthChecks),
    sources: [
      buildSource("review_dashboard", "Review Dashboard", dashboardPath, dashboardResult),
      buildSource("control_plane_pipeline", "Control Plane Pipeline", pipelinePath, pipelineResult),
    ],
    summary: summarizeHealth(dashboardResult, pipelineResult, healthChecks),
    health_checks: healthChecks,
  };

  return {
    ...health,
    markdown: renderHealthMarkdown(health),
  };
}

export async function writeControlPlaneHealth(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-health.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    health_id: result.health_id,
    overall_health: result.overall_health,
    summary: result.summary,
    sources: result.sources,
    health_checks: result.health_checks,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneHealthCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneHealth(args);
  console.log(`Control plane health written to ${result.output_dir}`);
  console.log(`Overall health: ${result.overall_health}`);
  console.log(`Blocked checks: ${result.summary.blocked_check_count}`);
  console.log(`Attention checks: ${result.summary.attention_check_count}`);
}

function buildHealthChecks(dashboardResult, pipelineResult) {
  const dashboard = dashboardResult.value;
  const pipeline = pipelineResult.value;
  const dashboardSummary = dashboard?.summary ?? {};
  const pipelineSummary = pipeline?.summary ?? {};
  return [
    check({
      check_id: "dashboard_available",
      label: "Review Dashboard Available",
      source_stage: "review_dashboard",
      status: dashboardResult.ok ? "passed" : "missing",
      severity: dashboardResult.ok ? "low" : "critical",
      reason: dashboardResult.ok ? "Review Dashboard artifact is readable." : `Review Dashboard unavailable: ${dashboardResult.error}`,
      metrics: {
        available: dashboardResult.ok,
      },
      recommended_actions: dashboardResult.ok ? [] : ["run_dashboard_build"],
    }),
    check({
      check_id: "pipeline_available",
      label: "Control Plane Pipeline Available",
      source_stage: "control_plane_pipeline",
      status: pipelineResult.ok ? "passed" : "missing",
      severity: pipelineResult.ok ? "low" : "critical",
      reason: pipelineResult.ok ? "Control Plane Pipeline artifact is readable." : `Control Plane Pipeline unavailable: ${pipelineResult.error}`,
      metrics: {
        available: pipelineResult.ok,
      },
      recommended_actions: pipelineResult.ok ? [] : ["run_control_plane_pipeline"],
    }),
    check({
      check_id: "pipeline_execution",
      label: "Pipeline Execution",
      source_stage: "control_plane_pipeline",
      status: !pipelineResult.ok
        ? "missing"
        : (pipelineSummary.failed_step_count ?? 0) > 0
          ? "blocked"
          : (pipelineSummary.missing_artifact_count ?? 0) > 0 || (pipelineSummary.skipped_step_count ?? 0) > 0
            ? "attention"
            : "passed",
      severity: (pipelineSummary.failed_step_count ?? 0) > 0 ? "high" : "medium",
      reason: `${pipelineSummary.passed_step_count ?? 0}/${pipelineSummary.step_count ?? 0} pipeline step(s) passed.`,
      metrics: {
        step_count: pipelineSummary.step_count ?? 0,
        passed_step_count: pipelineSummary.passed_step_count ?? 0,
        failed_step_count: pipelineSummary.failed_step_count ?? 0,
        missing_artifact_count: pipelineSummary.missing_artifact_count ?? 0,
      },
      recommended_actions: ["inspect_pipeline_steps", "rerun_control_plane_pipeline"],
    }),
    check({
      check_id: "dashboard_overall_status",
      label: "Dashboard Overall Status",
      source_stage: "review_dashboard",
      status: !dashboardResult.ok
        ? "missing"
        : ["blocked", "incomplete"].includes(dashboardSummary.overall_status)
          ? "blocked"
          : ["attention", "pending_review"].includes(dashboardSummary.overall_status)
            ? "attention"
            : "passed",
      severity: ["blocked", "incomplete"].includes(dashboardSummary.overall_status) ? "high" : "medium",
      reason: `Review Dashboard overall status is ${dashboardSummary.overall_status ?? "unknown"}.`,
      metrics: {
        overall_status: dashboardSummary.overall_status ?? "unknown",
        missing_stage_count: dashboardSummary.missing_stage_count ?? 0,
        blocked_stage_count: dashboardSummary.blocked_stage_count ?? 0,
        pending_stage_count: dashboardSummary.pending_stage_count ?? 0,
      },
      recommended_actions: ["open_review_dashboard", "resolve_dashboard_action_queue"],
    }),
    check({
      check_id: "blocking_gates",
      label: "Blocking Gates",
      source_stage: "review_dashboard",
      status: (dashboardSummary.blocking_gate_count ?? 0) > 0 ? "blocked" : "passed",
      severity: (dashboardSummary.blocking_gate_count ?? 0) > 0 ? "high" : "low",
      reason: `${dashboardSummary.blocking_gate_count ?? 0} blocking gate(s) are open.`,
      metrics: {
        blocking_gate_count: dashboardSummary.blocking_gate_count ?? 0,
        blocked_resource_count: dashboardSummary.blocked_resource_count ?? 0,
      },
      recommended_actions: ["review_blocking_gates", "rerun_relevant_stage"],
    }),
    check({
      check_id: "approval_backlog",
      label: "Approval Backlog",
      source_stage: "review_dashboard",
      status: (dashboardSummary.pending_approval_count ?? 0) > 0 ? "attention" : "passed",
      severity: (dashboardSummary.pending_approval_count ?? 0) > 0 ? "medium" : "low",
      reason: `${dashboardSummary.pending_approval_count ?? 0} approval item(s) are pending.`,
      metrics: {
        pending_approval_count: dashboardSummary.pending_approval_count ?? 0,
        approval_inbox_item_count: dashboardSummary.approval_inbox_item_count ?? 0,
      },
      recommended_actions: ["open_approval_inbox", "apply_approval_decisions"],
    }),
    check({
      check_id: "action_queue",
      label: "Action Queue",
      source_stage: "review_dashboard",
      status: (dashboardSummary.action_item_count ?? 0) > 0 ? "attention" : "passed",
      severity: (dashboardSummary.action_item_count ?? 0) > 0 ? "medium" : "low",
      reason: `${dashboardSummary.action_item_count ?? 0} dashboard action item(s) are open.`,
      metrics: {
        action_item_count: dashboardSummary.action_item_count ?? 0,
      },
      recommended_actions: ["query_api_actions", "triage_high_priority_actions"],
    }),
    check({
      check_id: "closeout_receipts",
      label: "Closeout Receipts",
      source_stage: "closeout_receipt_validation",
      status: (dashboardSummary.closeout_receipt_error_count ?? 0) > 0 || (dashboardSummary.closeout_receipt_invalid_count ?? 0) > 0
        ? "blocked"
        : (dashboardSummary.closeout_receipt_pending_count ?? 0) > 0
          ? "attention"
          : "passed",
      severity: (dashboardSummary.closeout_receipt_error_count ?? 0) > 0 ? "high" : "medium",
      reason: `${dashboardSummary.closeout_receipt_pending_count ?? 0} closeout receipt(s) pending, ${dashboardSummary.closeout_receipt_error_count ?? 0} error(s).`,
      metrics: {
        closeout_receipt_ready_count: dashboardSummary.closeout_receipt_ready_count ?? 0,
        closeout_receipt_pending_count: dashboardSummary.closeout_receipt_pending_count ?? 0,
        closeout_receipt_invalid_count: dashboardSummary.closeout_receipt_invalid_count ?? 0,
        closeout_receipt_error_count: dashboardSummary.closeout_receipt_error_count ?? 0,
      },
      recommended_actions: ["fill_closeout_receipts", "rerun_delivery_closeout_validate", "rerun_delivery_closeout_apply"],
    }),
  ];
}

function check(value) {
  return {
    ...value,
    recommended_actions: value.status === "passed" ? [] : value.recommended_actions,
  };
}

function summarizeHealth(dashboardResult, pipelineResult, healthChecks) {
  const dashboardSummary = dashboardResult.value?.summary ?? {};
  const pipelineSummary = pipelineResult.value?.summary ?? {};
  return {
    overall_health: deriveOverallHealth(healthChecks),
    dashboard_available: dashboardResult.ok,
    pipeline_available: pipelineResult.ok,
    check_count: healthChecks.length,
    passed_check_count: healthChecks.filter((item) => item.status === "passed").length,
    attention_check_count: healthChecks.filter((item) => item.status === "attention").length,
    blocked_check_count: healthChecks.filter((item) => item.status === "blocked").length,
    missing_check_count: healthChecks.filter((item) => item.status === "missing").length,
    action_item_count: dashboardSummary.action_item_count ?? 0,
    pending_approval_count: dashboardSummary.pending_approval_count ?? 0,
    blocking_gate_count: dashboardSummary.blocking_gate_count ?? 0,
    pipeline_step_count: pipelineSummary.step_count ?? 0,
    pipeline_failed_step_count: pipelineSummary.failed_step_count ?? 0,
    pipeline_missing_artifact_count: pipelineSummary.missing_artifact_count ?? 0,
    by_status: countBy(healthChecks, "status"),
    by_severity: countBy(healthChecks, "severity"),
  };
}

function deriveOverallHealth(healthChecks) {
  if (healthChecks.some((item) => item.status === "missing")) return "incomplete";
  if (healthChecks.some((item) => item.status === "blocked")) return "blocked";
  if (healthChecks.some((item) => item.status === "attention")) return "attention";
  return "healthy";
}

function renderHealthMarkdown(health) {
  const lines = [];
  lines.push("# Control Plane Health");
  lines.push("");
  lines.push(`Generated: ${health.generated_at}`);
  lines.push(`Overall health: ${health.overall_health}`);
  lines.push("");
  lines.push(`- Checks: ${health.summary.check_count}`);
  lines.push(`- Passed: ${health.summary.passed_check_count}`);
  lines.push(`- Attention: ${health.summary.attention_check_count}`);
  lines.push(`- Blocked: ${health.summary.blocked_check_count}`);
  lines.push(`- Missing: ${health.summary.missing_check_count}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  for (const item of health.health_checks) {
    lines.push(`- ${item.check_id}: ${item.status} (${item.severity}) - ${item.reason}`);
  }
  return `${lines.join("\n")}\n`;
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
    dashboardPath: DEFAULT_CONTROL_PLANE_HEALTH_DASHBOARD_PATH,
    pipelinePath: DEFAULT_CONTROL_PLANE_HEALTH_PIPELINE_PATH,
    outDir: DEFAULT_CONTROL_PLANE_HEALTH_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--pipeline") parsed.pipelinePath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-health.mjs [options]

Options:
  --dashboard <path>       review-dashboard.json path.
  --pipeline <path>        control-plane-pipeline.json path.
  --out-dir <folder>       Output directory.
  --run-at <iso>           Deterministic generated_at timestamp.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
