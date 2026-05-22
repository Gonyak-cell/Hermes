import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REVIEW_DASHBOARD_OUT_DIR = "artifacts/dashboard/latest";
export const DEFAULT_REVIEW_DASHBOARD_INPUTS = {
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  evidenceViewerPath: "artifacts/evidence-viewer/latest/evidence-viewer.json",
  approvalQueuePath: "artifacts/approval-queue/latest/approval-queue.json",
  approvalDecisionPath: "artifacts/approval-decisions/latest/approval-decision-result.json",
  personalDevSummaryPath: "artifacts/personal-dev-slice/latest/summary.json",
};

const SOURCE_DEFINITIONS = [
  {
    option: "resourceExpansionPath",
    source_id: "resource_expansion",
    label: "Resource Expansion",
  },
  {
    option: "resourceIngestPath",
    source_id: "resource_ingest",
    label: "Resource Ingest",
  },
  {
    option: "evidenceViewerPath",
    source_id: "evidence_viewer",
    label: "Evidence Viewer",
  },
  {
    option: "approvalQueuePath",
    source_id: "approval_queue",
    label: "Approval Queue",
  },
  {
    option: "approvalDecisionPath",
    source_id: "approval_decisions",
    label: "Approval Decisions",
  },
  {
    option: "personalDevSummaryPath",
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
  },
];

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runReviewDashboard(options = {}) {
  const result = await buildReviewDashboard(options);
  if (options.write !== false) await writeReviewDashboard(result, result.output_dir);
  return result;
}

export async function buildReviewDashboard(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REVIEW_DASHBOARD_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceReadResults = await readDashboardSources(options);
  const artifacts = Object.fromEntries(
    sourceReadResults
      .filter((source) => source.available)
      .map((source) => [source.source_id, source.data]),
  );
  const sources = sourceReadResults.map(({ data, ...source }) => source);
  const stageStatuses = buildStageStatuses(artifacts, sources);
  const actionItems = buildActionItems(artifacts).sort(compareActionItems);
  const summary = buildDashboardSummary(artifacts, stageStatuses, actionItems);
  const result = {
    schema_version: "review-dashboard.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary,
    sources,
    stage_statuses: stageStatuses,
    action_items: actionItems,
  };

  return {
    ...result,
    html: renderReviewDashboardHtml(result),
    markdown: renderReviewDashboardMarkdown(result),
  };
}

export async function writeReviewDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "review-dashboard.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    stage_statuses: result.stage_statuses,
    action_items: result.action_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runReviewDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runReviewDashboard(args);
  console.log(`Review dashboard written to ${result.output_dir}`);
  console.log(`Overall status: ${result.summary.overall_status}`);
  console.log(`Pending approvals: ${result.summary.pending_approval_count}`);
  console.log(`Blocking gates: ${result.summary.blocking_gate_count}`);
  console.log(`Action items: ${result.summary.action_item_count}`);
}

async function readDashboardSources(options) {
  const results = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const configuredPath = options[definition.option] ?? DEFAULT_REVIEW_DASHBOARD_INPUTS[definition.option];
    if (configuredPath === false) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: null,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: "disabled",
      });
      continue;
    }

    const resolvedPath = path.resolve(configuredPath);
    try {
      const data = JSON.parse(await readFile(resolvedPath, "utf8"));
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: true,
        schema_version: data.schema_version ?? null,
        generated_at: data.generated_at ?? null,
        summary: summarizeSource(definition.source_id, data),
        error: null,
        data,
      });
    } catch (error) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: error.code === "ENOENT" ? "not_found" : error.message,
      });
    }
  }
  return results;
}

function summarizeSource(sourceId, data) {
  if (sourceId === "resource_expansion") {
    return {
      discovered_count: data.summary?.discovered_count ?? 0,
      extracted_count: data.summary?.extracted_count ?? 0,
      quarantine_count: data.summary?.quarantine_count ?? 0,
      failed_count: data.summary?.failed_count ?? 0,
      remaining_count: data.summary?.remaining_count ?? data.batch?.remaining_count ?? 0,
    };
  }
  if (sourceId === "resource_ingest") return data.summary ?? {};
  if (sourceId === "evidence_viewer") return data.summary ?? data.review_packet?.summary ?? {};
  if (sourceId === "approval_queue") return data.summary ?? {};
  if (sourceId === "approval_decisions") return data.summary ?? {};
  if (sourceId === "personal_dev_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      actual_isolation: data.actual_isolation ?? null,
      approval_id: data.approval_id ?? null,
    };
  }
  return {};
}

function buildStageStatuses(artifacts, sources) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  return [
    buildResourceExpansionStage(artifacts.resource_expansion, sourceById.get("resource_expansion")),
    buildResourceIngestStage(artifacts.resource_ingest, sourceById.get("resource_ingest")),
    buildEvidenceViewerStage(artifacts.evidence_viewer, sourceById.get("evidence_viewer")),
    buildApprovalQueueStage(artifacts.approval_queue, sourceById.get("approval_queue"), artifacts.approval_decisions),
    buildApprovalDecisionStage(artifacts.approval_decisions, sourceById.get("approval_decisions")),
    buildPersonalDevStage(artifacts.personal_dev_slice, sourceById.get("personal_dev_slice")),
  ];
}

function buildResourceExpansionStage(expansion, source) {
  if (!expansion) return missingStage("resource_expansion", "Resource Expansion", source);
  const remaining = expansion.summary?.remaining_count ?? expansion.batch?.remaining_count ?? 0;
  const quarantine = expansion.summary?.quarantine_count ?? 0;
  const failed = expansion.summary?.failed_count ?? 0;
  const status = failed > 0 || quarantine > 0 ? "attention" : remaining > 0 ? "pending" : "passed";
  return {
    stage_id: "resource_expansion",
    label: "Resource Expansion",
    status,
    message: status === "passed"
      ? "All discovered resources reached terminal states."
      : `${remaining} remaining, ${quarantine} quarantined, ${failed} failed.`,
    source_path: source?.path ?? null,
    metrics: {
      discovered_count: expansion.summary?.discovered_count ?? 0,
      extracted_count: expansion.summary?.extracted_count ?? 0,
      remaining_count: remaining,
      quarantine_count: quarantine,
      failed_count: failed,
    },
  };
}

function buildResourceIngestStage(ingest, source) {
  if (!ingest) return missingStage("resource_ingest", "Resource Ingest", source);
  const blocked = ingest.summary?.blocked_count ?? 0;
  const status = ingest.summary?.gate_status === "blocked" || blocked > 0 ? "blocked" : "passed";
  return {
    stage_id: "resource_ingest",
    label: "Resource Ingest",
    status,
    message: status === "passed"
      ? "Extracted resources were promoted into Resource/Evidence contracts."
      : `${blocked} blocked item(s) require review before full promotion.`,
    source_path: source?.path ?? null,
    metrics: {
      promoted_resource_count: ingest.summary?.promoted_resource_count ?? 0,
      promoted_evidence_count: ingest.summary?.promoted_evidence_count ?? 0,
      blocked_count: blocked,
      duplicate_count: ingest.summary?.duplicate_count ?? 0,
    },
  };
}

function buildEvidenceViewerStage(viewer, source) {
  if (!viewer) return missingStage("evidence_viewer", "Evidence Viewer", source);
  const summary = viewer.summary ?? viewer.review_packet?.summary ?? {};
  const status = summary.blocking_gate_count > 0 ? "blocked" : summary.needs_review_count > 0 ? "pending" : "passed";
  return {
    stage_id: "evidence_viewer",
    label: "Evidence Viewer",
    status,
    message: `${summary.evidence_count ?? 0} evidence card(s), ${summary.needs_review_count ?? 0} waiting for review.`,
    source_path: source?.path ?? null,
    metrics: {
      evidence_count: summary.evidence_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
      blocked_item_count: summary.blocked_item_count ?? 0,
    },
  };
}

function buildApprovalQueueStage(queue, source, decisions) {
  if (!queue) return missingStage("approval_queue", "Approval Queue", source);
  const appliedIds = new Set((decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const remainingItems = (queue.items ?? []).filter((item) => !appliedIds.has(item.queue_item_id));
  const pending = remainingItems.filter((item) => item.status === "pending").length;
  const critical = remainingItems.filter((item) => item.priority === "critical").length;
  const criticalOrHigh = remainingItems.filter((item) => ["critical", "high"].includes(item.priority)).length;
  const status = critical > 0 ? "blocked" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_queue",
    label: "Approval Queue",
    status,
    message: `${pending} pending approval item(s), ${critical} critical.`,
    source_path: source?.path ?? null,
    metrics: {
      total_items: queue.summary?.total_items ?? 0,
      remaining_items: remainingItems.length,
      pending_count: pending,
      critical_count: critical,
      critical_or_high_count: criticalOrHigh,
    },
  };
}

function buildApprovalDecisionStage(decisions, source) {
  if (!decisions) return missingStage("approval_decisions", "Approval Decisions", source);
  const errors = decisions.decision_errors?.length ?? 0;
  const pending = decisions.summary?.pending_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_decisions",
    label: "Approval Decisions",
    status,
    message: `${decisions.summary?.applied_count ?? 0} decision(s) applied, ${pending} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      applied_count: decisions.summary?.applied_count ?? 0,
      pending_count: pending,
      approved_count: decisions.summary?.approved_count ?? 0,
      rejected_count: decisions.summary?.rejected_count ?? 0,
      audit_event_count: decisions.audit_events?.length ?? 0,
      decision_error_count: errors,
    },
  };
}

function buildPersonalDevStage(summary, source) {
  if (!summary) return missingStage("personal_dev_slice", "Personal Dev Slice", source);
  const status = summary.status === "blocked" ? "pending" : summary.status === "passed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.status}: ${summary.blocked_reason}`
      : `${summary.status ?? "unknown"} with ${summary.actual_isolation ?? "unknown"} isolation.`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      actual_isolation: summary.actual_isolation ?? null,
    },
  };
}

function missingStage(stageId, label, source) {
  return {
    stage_id: stageId,
    label,
    status: "missing",
    message: source?.error === "disabled" ? "Stage disabled for this dashboard run." : "Source artifact is not available.",
    source_path: source?.path ?? null,
    metrics: {},
  };
}

function buildActionItems(artifacts) {
  const items = [];
  const queueItems = artifacts.approval_queue?.items ?? [];
  const appliedIds = new Set((artifacts.approval_decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const unappliedIds = new Set((artifacts.approval_decisions?.unapplied_items ?? []).map((item) => item.queue_item_id));

  for (const item of queueItems) {
    if (appliedIds.has(item.queue_item_id)) continue;
    items.push({
      action_item_id: `dashboard.action.${item.queue_item_id}`,
      source_stage: "approval_queue",
      priority: item.priority,
      status: unappliedIds.has(item.queue_item_id) ? "pending_decision" : item.status,
      title: item.title,
      subject_ref: item.subject_ref,
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.queue_item_id,
    });
  }

  for (const error of artifacts.approval_decisions?.decision_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.decision_error.${error.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: "high",
      status: "needs_fix",
      title: `Fix approval decision: ${error.queue_item_id}`,
      subject_ref: {
        subject_type: "approval_decision",
        subject_id: error.queue_item_id,
      },
      reason: error.message,
      recommended_actions: ["fix_decision_file", "rerun_approval_apply"],
      source_ref: error.queue_item_id,
    });
  }

  for (const item of artifacts.approval_decisions?.applied_items ?? []) {
    if (!item.follow_up_action) continue;
    items.push({
      action_item_id: `dashboard.action.follow_up.${item.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: item.priority ?? "medium",
      status: "follow_up_required",
      title: `Follow up: ${item.follow_up_action}`,
      subject_ref: item.subject_ref,
      reason: item.comment || item.follow_up_action,
      recommended_actions: [item.follow_up_action],
      source_ref: item.queue_item_id,
    });
  }

  if (artifacts.personal_dev_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.personal_dev.${artifacts.personal_dev_slice.approval_id ?? "merge"}`,
      source_stage: "personal_dev_slice",
      priority: "high",
      status: "pending_approval",
      title: "Review personal-dev merge approval",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.personal_dev_slice.approval_id ?? "personal_dev.merge",
      },
      reason: artifacts.personal_dev_slice.blocked_reason ?? "merge approval pending",
      recommended_actions: ["review_pr_draft", "run_canonical_tests", "approve_or_request_changes"],
      source_ref: artifacts.personal_dev_slice.workflow_run_id ?? null,
    });
  }

  return items;
}

function buildDashboardSummary(artifacts, stageStatuses, actionItems) {
  const patchedEvidence = artifacts.approval_decisions?.patched_resource_evidence;
  const reviewCounts = countReviewStatuses(patchedEvidence?.evidence_items ?? []);
  const viewerSummary = artifacts.evidence_viewer?.summary ?? artifacts.evidence_viewer?.review_packet?.summary ?? {};
  const decisionSummary = artifacts.approval_decisions?.summary ?? {};
  const queueSummary = artifacts.approval_queue?.summary ?? {};
  const blockingGateCount = viewerSummary.blocking_gate_count ?? countBlockingGates(artifacts.resource_ingest?.gate_results ?? []);
  const pendingApprovalCount = decisionSummary.pending_count ?? queueSummary.by_status?.pending ?? queueSummary.total_items ?? 0;
  const blockedResourceCount = artifacts.resource_ingest?.summary?.blocked_count ?? viewerSummary.blocked_item_count ?? 0;
  const decisionErrorCount = artifacts.approval_decisions?.decision_errors?.length ?? 0;

  return {
    overall_status: deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount),
    stage_count: stageStatuses.length,
    missing_stage_count: stageStatuses.filter((stage) => stage.status === "missing").length,
    blocked_stage_count: stageStatuses.filter((stage) => stage.status === "blocked").length,
    pending_stage_count: stageStatuses.filter((stage) => stage.status === "pending").length,
    resource_count: artifacts.resource_ingest?.summary?.promoted_resource_count ?? viewerSummary.resource_count ?? 0,
    evidence_count: artifacts.resource_ingest?.summary?.promoted_evidence_count ?? viewerSummary.evidence_count ?? 0,
    evidence_needs_review_count: patchedEvidence ? reviewCounts.needs_review ?? 0 : viewerSummary.needs_review_count ?? 0,
    evidence_approved_count: patchedEvidence ? reviewCounts.approved ?? 0 : 0,
    evidence_rejected_count: patchedEvidence ? reviewCounts.rejected ?? 0 : 0,
    blocking_gate_count: blockingGateCount,
    blocked_resource_count: blockedResourceCount,
    approval_queue_item_count: queueSummary.total_items ?? 0,
    approval_applied_count: decisionSummary.applied_count ?? 0,
    pending_approval_count: pendingApprovalCount,
    audit_event_count: artifacts.approval_decisions?.audit_events?.length ?? 0,
    follow_up_count: decisionSummary.follow_up_count ?? 0,
    decision_error_count: decisionErrorCount,
    action_item_count: actionItems.length,
  };
}

function deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount) {
  if (stageStatuses.some((stage) => stage.status === "missing")) return "incomplete";
  if (decisionErrorCount > 0) return "attention";
  if (stageStatuses.some((stage) => stage.status === "blocked")) return "blocked";
  if (pendingApprovalCount > 0 || stageStatuses.some((stage) => stage.status === "pending")) return "pending_review";
  if (stageStatuses.some((stage) => stage.status === "attention")) return "attention";
  return "ready";
}

export function renderReviewDashboardHtml(dashboard) {
  const stages = dashboard.stage_statuses.map(renderStageHtml).join("\n");
  const actions = dashboard.action_items.map(renderActionHtml).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Review Dashboard</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#5d6673; --line:#d8dee8; --panel:#f7f9fb; --ok:#166534; --warn:#9a6700; --danger:#b42318; --accent:#0f766e; }
    * { box-sizing:border-box; }
    body { margin:0; background:#fff; color:var(--ink); font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding:28px 32px 20px; border-bottom:1px solid var(--line); }
    main { max-width:1200px; margin:0 auto; padding:22px 32px 42px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.2; }
    h2 { margin:28px 0 12px; font-size:18px; }
    h3 { margin:0 0 8px; font-size:16px; }
    .meta { color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:18px; }
    .stat, .stage, .action { border:1px solid var(--line); border-radius:8px; background:#fff; }
    .stat { padding:12px; background:var(--panel); }
    .stat strong { display:block; font-size:24px; }
    .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0; }
    .section { border-top:1px solid var(--line); margin-top:24px; padding-top:4px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
    .stage, .action { padding:14px; }
    .badge { display:inline-flex; align-items:center; min-height:24px; border-radius:999px; padding:3px 9px; font-size:12px; border:1px solid var(--line); color:var(--muted); }
    .status-passed, .status-ready { color:var(--ok); border-color:#b7dec2; background:#f0faf3; }
    .status-pending, .status-pending_review { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-blocked, .priority-critical { color:var(--danger); border-color:#efb4ad; background:#fff1f0; }
    .status-attention, .status-incomplete, .priority-high { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-missing { color:var(--muted); border-color:var(--line); background:#f2f4f7; }
    .muted { color:var(--muted); }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
    ul { padding-left:20px; }
    @media (max-width:640px) { header, main { padding-left:18px; padding-right:18px; } h1 { font-size:24px; } }
  </style>
</head>
<body>
  <header>
    <h1>Hermes Review Dashboard</h1>
    <div class="meta">Generated ${escapeHtml(dashboard.generated_at)}</div>
    <div class="meta">Overall <span class="badge status-${escapeHtml(dashboard.summary.overall_status)}">${escapeHtml(dashboard.summary.overall_status)}</span></div>
    <div class="stats">
      ${stat("Resources", dashboard.summary.resource_count)}
      ${stat("Evidence", dashboard.summary.evidence_count)}
      ${stat("Needs Review", dashboard.summary.evidence_needs_review_count)}
      ${stat("Pending Approvals", dashboard.summary.pending_approval_count)}
      ${stat("Blocking Gates", dashboard.summary.blocking_gate_count)}
      ${stat("Action Items", dashboard.summary.action_item_count)}
    </div>
  </header>
  <main>
    <section class="section">
      <h2>Control Plane Stages</h2>
      <div class="grid">${stages}</div>
    </section>
    <section class="section">
      <h2>Action Queue</h2>
      ${actions || "<p class=\"muted\">No action items.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

export function renderReviewDashboardMarkdown(dashboard) {
  const lines = [];
  lines.push("# Hermes Review Dashboard");
  lines.push("");
  lines.push(`Generated: ${dashboard.generated_at}`);
  lines.push(`Overall status: ${dashboard.summary.overall_status}`);
  lines.push("");
  lines.push(`- Resources: ${dashboard.summary.resource_count}`);
  lines.push(`- Evidence: ${dashboard.summary.evidence_count}`);
  lines.push(`- Evidence needs review: ${dashboard.summary.evidence_needs_review_count}`);
  lines.push(`- Pending approvals: ${dashboard.summary.pending_approval_count}`);
  lines.push(`- Blocking gates: ${dashboard.summary.blocking_gate_count}`);
  lines.push(`- Blocked resources: ${dashboard.summary.blocked_resource_count}`);
  lines.push(`- Audit events: ${dashboard.summary.audit_event_count}`);
  lines.push(`- Action items: ${dashboard.summary.action_item_count}`);
  lines.push("");
  lines.push("## Stages");
  lines.push("");
  for (const stage of dashboard.stage_statuses) {
    lines.push(`- ${stage.label}: ${stage.status} - ${stage.message}`);
  }
  lines.push("");
  lines.push("## Action Items");
  lines.push("");
  for (const item of dashboard.action_items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.status})`);
  }
  if (dashboard.action_items.length === 0) lines.push("- No action items.");
  return `${lines.join("\n")}\n`;
}

function renderStageHtml(stage) {
  const metricItems = Object.entries(stage.metrics ?? {})
    .map(([key, value]) => `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>`)
    .join("");
  return `<article class="stage">
  <h3>${escapeHtml(stage.label)}</h3>
  <div class="badge status-${escapeHtml(stage.status)}">${escapeHtml(stage.status)}</div>
  <p>${escapeHtml(stage.message)}</p>
  <div class="meta">${escapeHtml(stage.source_path ?? "no source")}</div>
  ${metricItems ? `<ul>${metricItems}</ul>` : ""}
</article>`;
}

function renderActionHtml(item) {
  const actions = item.recommended_actions.map((action) => `<span class="badge">${escapeHtml(action)}</span>`).join(" ");
  return `<article class="action">
  <h3>${escapeHtml(item.title)}</h3>
  <div>
    <span class="badge priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
    <span class="badge">${escapeHtml(item.status)}</span>
  </div>
  <p>${escapeHtml(item.reason)}</p>
  <div class="meta">${escapeHtml(item.subject_ref.subject_type)}:<code>${escapeHtml(item.subject_ref.subject_id)}</code></div>
  <p>${actions}</p>
</article>`;
}

function stat(label, value) {
  return `<div class="stat"><strong>${Number(value ?? 0)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function compareActionItems(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

function countReviewStatuses(evidenceItems) {
  return evidenceItems.reduce((counts, item) => {
    const status = item.review_status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function countBlockingGates(gates) {
  return gates.filter((gate) => gate.blocking || gate.status !== "passed").length;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_REVIEW_DASHBOARD_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--evidence-viewer") parsed.evidenceViewerPath = argv[++index];
    else if (arg === "--approval-queue") parsed.approvalQueuePath = argv[++index];
    else if (arg === "--approval-decisions") parsed.approvalDecisionPath = argv[++index];
    else if (arg === "--personal-dev-summary") parsed.personalDevSummaryPath = argv[++index];
    else if (arg === "--no-personal-dev-summary") parsed.personalDevSummaryPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/review-dashboard.mjs [options]

Options:
  --resource-expansion <path>    resource-expansion-job.json path.
  --resource-ingest <path>       resource-ingest.json path.
  --evidence-viewer <path>       evidence-viewer.json path.
  --approval-queue <path>        approval-queue.json path.
  --approval-decisions <path>    approval-decision-result.json path.
  --personal-dev-summary <path>  personal-dev summary.json path.
  --no-personal-dev-summary      Do not include personal-dev slice status.
  --out-dir <folder>             Output directory.
  --run-at <iso>                 Deterministic generated_at timestamp.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
