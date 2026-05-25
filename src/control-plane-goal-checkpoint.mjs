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
  sourceItem("contract_inventory", "Contract inventory and owner map", "contracts", "contract_inventory", "control-plane-contract-inventory", { acceptance_profile: "contract_inventory_gate" }),
  sourceItem("contract_dependency_map", "Contract dependency map and breaking risk list", "contracts", "contract_dependency_map", "control-plane-contract-dependency-map", { acceptance_profile: "contract_dependency_map_gate" }),
  sourceItem("resource_contract_freeze", "Resource and ResourceVersion v2 contract freeze", "resource_evidence", "resource_contract_freeze", "control-plane-resource-contract-freeze", { acceptance_profile: "resource_contract_freeze_gate" }),
  sourceItem("matter_contract_freeze", "Matter, client, party, team, and boundary v2 contract freeze", "identity_policy", "matter_contract_freeze", "control-plane-matter-contract-freeze", { acceptance_profile: "matter_contract_freeze_gate" }),
  sourceItem("policy_contract_freeze", "Data classification and policy reference v2 contract freeze", "policy", "policy_contract_freeze", "control-plane-policy-contract-freeze", { acceptance_profile: "policy_contract_freeze_gate" }),
  sourceItem("evidence_contract_freeze", "Evidence, fact, issue, citation, and lineage v2 contract freeze", "resource_evidence", "evidence_contract_freeze", "control-plane-evidence-contract-freeze", { acceptance_profile: "evidence_contract_freeze_gate" }),
  sourceItem("policy_matrix_catalog", "Identity/Policy matrix", "policy", "policy_matrix_catalog", "control-plane-policy-matrix"),
  sourceItem("policy_snapshot_ledger", "Policy snapshot ledger", "policy", "policy_snapshot_ledger", "control-plane-policy-snapshots"),
  sourceItem("context_packet_ledger", "Context builder and retrieval filters", "context", "context_packet_ledger", "control-plane-context-builder"),
  sourceItem("model_routing_ledger", "Model routing and external transfer decisions", "runtime", "model_routing_ledger", "control-plane-model-routing"),
  sourceItem("cost_budget_ledger", "Cost budget gate ledger", "gate_approval", "cost_budget_ledger", "control-plane-cost-budget"),
  sourceItem("token_usage_ledger", "Token usage ledger", "observability", "token_usage_ledger", "control-plane-token-usage"),
  sourceItem("cost_attribution_ledger", "Cost attribution ledger", "observability", "cost_attribution_ledger", "control-plane-cost-attribution"),
  sourceItem("budget_alert_ledger", "Budget alert ledger", "observability", "budget_alert_ledger", "control-plane-budget-alerts"),
  sourceItem("domain_pack_registry", "Plugin-style domain packs", "domain_packs", "domain_pack_registry", "control-plane-domain-packs"),
  sourceItem("resource_expansion", "Resource expansion", "resource_evidence", "resource_expansion", "control-plane-resource-expansion"),
  sourceItem("resource_ingest", "Resource/Evidence ingest gate", "resource_evidence", "resource_ingest", "control-plane-resource-ingest"),
  sourceItem("evidence_viewer", "Evidence viewer", "resource_evidence", "evidence_viewer", "control-plane-evidence-viewer", { acceptance_profile: "evidence_review_gate" }),
  sourceItem("approval_workflow", "Gate and approval workflow", "gate_approval", "approval_inbox", "control-plane-approval-workflow", { acceptance_profile: "approval_gate" }),
  sourceItem("human_review_packets", "Human review packets", "gate_approval", "human_review_packet_ledger", "control-plane-human-review-packets", { acceptance_profile: "human_review_packet_gate" }),
  sourceItem("human_review_agenda", "Human review agenda", "gate_approval", "human_review_agenda", "control-plane-human-review-agenda", { acceptance_profile: "human_review_agenda_gate" }),
  sourceItem("human_review_agenda_receipt_intake", "Human review agenda receipt intake", "gate_approval", "human_review_agenda_receipt_intake", "control-plane-human-review-agenda-intake", { acceptance_profile: "human_review_agenda_receipt_intake_gate" }),
  sourceItem("human_review_receipt_workspace", "Human review receipt workspace", "gate_approval", "human_review_receipt_workspace", "control-plane-human-review-receipt-workspace", { acceptance_profile: "human_review_receipt_workspace_gate" }),
  sourceItem("human_review_receipt_workspace_merge", "Human review receipt workspace merge", "gate_approval", "human_review_receipt_workspace_merge", "control-plane-human-review-receipt-workspace-merge", { acceptance_profile: "human_review_receipt_workspace_merge_gate" }),
  sourceItem("human_review_context_bundle", "Human review context bundle", "gate_approval", "human_review_context_bundle", "control-plane-human-review-context-bundle", { acceptance_profile: "human_review_context_bundle_gate" }),
  sourceItem("human_review_decision_register", "Human review decision register", "gate_approval", "human_review_decision_register", "control-plane-human-review-decision-register", { acceptance_profile: "human_review_decision_register_gate" }),
  sourceItem("human_review_decision_register_merge", "Human review decision register merge", "gate_approval", "human_review_decision_register_merge", "control-plane-human-review-decision-register-merge", { acceptance_profile: "human_review_decision_register_merge_gate" }),
  sourceItem("human_review_validation_feedback", "Human review validation feedback", "gate_approval", "human_review_validation_feedback", "control-plane-human-review-validation-feedback", { acceptance_profile: "human_review_validation_feedback_gate" }),
  sourceItem("human_review_correction_workspace", "Human review correction workspace", "gate_approval", "human_review_correction_workspace", "control-plane-human-review-correction-workspace", { acceptance_profile: "human_review_correction_workspace_gate" }),
  sourceItem("human_review_correction_workspace_merge", "Human review correction workspace merge", "gate_approval", "human_review_correction_workspace_merge", "control-plane-human-review-correction-workspace-merge", { acceptance_profile: "human_review_correction_workspace_merge_gate" }),
  sourceItem("human_review_correction_validation", "Human review correction validation", "gate_approval", "human_review_correction_validation", "control-plane-human-review-correction-validation", { acceptance_profile: "human_review_correction_validation_gate" }),
  sourceItem("human_review_correction_feedback", "Human review correction feedback", "gate_approval", "human_review_correction_feedback", "control-plane-human-review-correction-feedback", { acceptance_profile: "human_review_correction_feedback_gate" }),
  sourceItem("human_review_cycle_ledger", "Human review cycle ledger", "gate_approval", "human_review_cycle_ledger", "control-plane-human-review-cycle-ledger", { acceptance_profile: "human_review_cycle_ledger_gate" }),
  sourceItem("human_review_cycle_work_orders", "Human review cycle work orders", "gate_approval", "human_review_cycle_work_orders", "control-plane-human-review-cycle-work-orders", { acceptance_profile: "human_review_cycle_work_orders_gate" }),
  sourceItem("human_review_cycle_target_audit", "Human review cycle target audit", "gate_approval", "human_review_cycle_target_audit", "control-plane-human-review-cycle-target-audit", { acceptance_profile: "human_review_cycle_target_audit_gate" }),
  sourceItem("human_review_cycle_triage_inbox", "Human review cycle triage inbox", "gate_approval", "human_review_cycle_triage_inbox", "control-plane-human-review-cycle-triage-inbox", { acceptance_profile: "human_review_cycle_triage_inbox_gate" }),
  sourceItem("human_review_cycle_reviewer_console", "Human review cycle reviewer console", "gate_approval", "human_review_cycle_reviewer_console", "control-plane-human-review-cycle-reviewer-console", { acceptance_profile: "human_review_cycle_reviewer_console_gate" }),
  sourceItem("human_review_cycle_receipt_field_audit", "Human review cycle receipt field audit", "gate_approval", "human_review_cycle_receipt_field_audit", "control-plane-human-review-cycle-receipt-field-audit", { acceptance_profile: "human_review_cycle_receipt_field_audit_gate" }),
  sourceItem("human_review_cycle_receipt_completion_pack", "Human review cycle receipt completion pack", "gate_approval", "human_review_cycle_receipt_completion_pack", "control-plane-human-review-cycle-receipt-completion-pack", { acceptance_profile: "human_review_cycle_receipt_completion_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_verification", "Human review cycle receipt completion verification", "gate_approval", "human_review_cycle_receipt_completion_verification", "control-plane-human-review-cycle-receipt-completion-verification", { acceptance_profile: "human_review_cycle_receipt_completion_verification_gate" }),
  sourceItem("human_review_cycle_receipt_completion_workbench", "Human review cycle receipt completion workbench", "gate_approval", "human_review_cycle_receipt_completion_workbench", "control-plane-human-review-cycle-receipt-completion-workbench", { acceptance_profile: "human_review_cycle_receipt_completion_workbench_gate" }),
  sourceItem("human_review_cycle_receipt_completion_runbook", "Human review cycle receipt completion runbook", "gate_approval", "human_review_cycle_receipt_completion_runbook", "control-plane-human-review-cycle-receipt-completion-runbook", { acceptance_profile: "human_review_cycle_receipt_completion_runbook_gate" }),
  sourceItem("human_review_cycle_receipt_completion_readiness", "Human review cycle receipt completion readiness", "gate_approval", "human_review_cycle_receipt_completion_readiness", "control-plane-human-review-cycle-receipt-completion-readiness", { acceptance_profile: "human_review_cycle_receipt_completion_readiness_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_queue", "Human review cycle receipt completion command queue", "gate_approval", "human_review_cycle_receipt_completion_command_queue", "control-plane-human-review-cycle-receipt-completion-command-queue", { acceptance_profile: "human_review_cycle_receipt_completion_command_queue_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipts", "Human review cycle receipt completion command receipts", "gate_approval", "human_review_cycle_receipt_completion_command_receipts", "control-plane-human-review-cycle-receipt-completion-command-receipts", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipts_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_validation", "Human review cycle receipt completion command receipt validation", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_validation", "control-plane-human-review-cycle-receipt-completion-command-receipt-validation", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_validation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_feedback", "Human review cycle receipt completion command receipt feedback", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_feedback", "control-plane-human-review-cycle-receipt-completion-command-receipt-feedback", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_feedback_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace", "Human review cycle receipt completion command receipt workspace", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace_merge", "Human review cycle receipt completion command receipt workspace merge", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace_merge", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-merge", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_workspace_validation", "Human review cycle receipt completion command receipt workspace validation", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_workspace_validation", "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-validation", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_receipt_application", "Human review cycle receipt completion command receipt application", "gate_approval", "human_review_cycle_receipt_completion_command_receipt_application", "control-plane-human-review-cycle-receipt-completion-command-receipt-application", { acceptance_profile: "human_review_cycle_receipt_completion_command_receipt_application_gate" }),
  sourceItem("human_review_cycle_receipt_completion_reconciliation", "Human review cycle receipt completion reconciliation", "gate_approval", "human_review_cycle_receipt_completion_reconciliation", "control-plane-human-review-cycle-receipt-completion-reconciliation", { acceptance_profile: "human_review_cycle_receipt_completion_reconciliation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_baseline", "Human review cycle receipt completion baseline", "gate_approval", "human_review_cycle_receipt_completion_baseline", "control-plane-human-review-cycle-receipt-completion-baseline", { acceptance_profile: "human_review_cycle_receipt_completion_baseline_gate" }),
  sourceItem("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human review cycle receipt completion manual command receipt pack", "gate_approval", "human_review_cycle_receipt_completion_manual_command_receipt_pack", "control-plane-human-review-cycle-receipt-completion-manual-command-receipt-pack", { acceptance_profile: "human_review_cycle_receipt_completion_manual_command_receipt_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_held_command_resolution", "Human review cycle receipt completion held command resolution", "gate_approval", "human_review_cycle_receipt_completion_held_command_resolution", "control-plane-human-review-cycle-receipt-completion-held-command-resolution", { acceptance_profile: "human_review_cycle_receipt_completion_held_command_resolution_gate" }),
  sourceItem("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human review cycle receipt completion protected approval request pack", "gate_approval", "human_review_cycle_receipt_completion_protected_approval_request_pack", "control-plane-human-review-cycle-receipt-completion-protected-approval-request-pack", { acceptance_profile: "human_review_cycle_receipt_completion_protected_approval_request_pack_gate" }),
  sourceItem("human_review_cycle_receipt_completion_manual_revalidation", "Human review cycle receipt completion manual revalidation", "gate_approval", "human_review_cycle_receipt_completion_manual_revalidation", "control-plane-human-review-cycle-receipt-completion-manual-revalidation", { acceptance_profile: "human_review_cycle_receipt_completion_manual_revalidation_gate" }),
  sourceItem("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human review cycle receipt completion command queue patch projection", "gate_approval", "human_review_cycle_receipt_completion_command_queue_patch_projection", "control-plane-human-review-cycle-receipt-completion-command-queue-patch-projection", { acceptance_profile: "human_review_cycle_receipt_completion_command_queue_patch_projection_gate" }),
  sourceItem("human_review_cycle_receipt_completion_closeout_ledger", "Human review cycle receipt completion closeout ledger", "gate_approval", "human_review_cycle_receipt_completion_closeout_ledger", "control-plane-human-review-cycle-receipt-completion-closeout-ledger", { acceptance_profile: "human_review_cycle_receipt_completion_closeout_ledger_gate" }),
  sourceItem("human_review_v1_regression_freeze", "Human Review v1 regression freeze", "gate_approval", "human_review_v1_regression_freeze", "control-plane-human-review-v1-regression-freeze", { acceptance_profile: "human_review_v1_regression_freeze_gate" }),
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

  if (item.acceptance_profile === "human_review_packet_gate") {
    if ((metrics.review_packet_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review packets are implemented and grouping pending gate receipts for human review.");
    }
  }

  if (item.acceptance_profile === "human_review_agenda_gate") {
    if ((metrics.agenda_item_count ?? 0) > 0 && (metrics.decision_template_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review agenda is implemented and producing reviewer-specific receipt templates.");
    }
  }

  if (item.acceptance_profile === "human_review_agenda_receipt_intake_gate") {
    if ((metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review agenda receipt intake is implemented and feeding receipt validation safely.");
    }
  }

  if (item.acceptance_profile === "human_review_receipt_workspace_gate") {
    if ((metrics.actor_workspace_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review receipt workspace is implemented and writing actor-specific editable receipt inputs.");
    }
  }

  if (item.acceptance_profile === "human_review_receipt_workspace_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review receipt workspace merge is implemented and recombining actor receipt inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_context_bundle_gate") {
    if ((metrics.context_card_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review context bundle is implemented and binding pending receipt decisions to gate, evidence, approval, and matter context.");
    }
  }

  if (item.acceptance_profile === "human_review_decision_register_gate") {
    if ((metrics.decision_row_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review decision register is implemented and producing context-bound receipt input for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_decision_register_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review decision register merge is implemented and recombining actor decision inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_validation_feedback_gate") {
    if ((metrics.actor_feedback_count ?? 0) > 0 && (metrics.feedback_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review validation feedback is implemented and routing validation results back to actor review bundles.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_workspace_gate") {
    if ((metrics.actor_workspace_count ?? 0) > 0 && (metrics.correction_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction workspace is implemented and preparing actor-editable correction receipt inputs.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_workspace_merge_gate") {
    if ((metrics.actor_input_count ?? 0) > 0 && (metrics.receipt_row_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction workspace merge is implemented and recombining actor correction receipt inputs for validation.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_validation_gate") {
    const errors = (metrics.error_count ?? 0) + (metrics.invalid_receipt_count ?? 0) + (metrics.unknown_receipt_count ?? 0) + (metrics.missing_receipt_count ?? 0);
    if ((metrics.validation_item_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review correction validation is implemented and checking merged correction receipts before any application.");
    }
  }

  if (item.acceptance_profile === "human_review_correction_feedback_gate") {
    if ((metrics.actor_feedback_count ?? 0) > 0 && (metrics.feedback_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review correction feedback is implemented and routing correction validation results back to actor feedback bundles.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_ledger_gate") {
    if ((metrics.actor_cycle_count ?? 0) > 0 && (metrics.cycle_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review cycle ledger is implemented and linking feedback, correction, merge, validation, and feedback state.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_work_orders_gate") {
    if ((metrics.actor_work_order_count ?? 0) > 0 && (metrics.work_order_item_count ?? 0) > 0 && (metrics.validation_error_count ?? 0) === 0) {
      return passedWithOperationalGate(stage, "Human review cycle work orders are implemented and routing pending cycle items into actor-specific work queues.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_target_audit_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_target_file_count ?? 0) + (metrics.missing_receipt_row_count ?? 0);
    if ((metrics.target_audit_item_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle target audit is implemented and confirming work order receipt files and rows exist.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_triage_inbox_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_target_audit_count ?? 0);
    if ((metrics.triage_item_count ?? 0) > 0 && (metrics.actor_triage_inbox_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle triage inbox is implemented and turning verified work orders into actor-ready queues.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_reviewer_console_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_context_card_count ?? 0) + (metrics.missing_decision_row_count ?? 0);
    if ((metrics.console_item_count ?? 0) > 0 && (metrics.actor_console_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle reviewer console is implemented and exposing actor-ready review queues with context and decision rows.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_field_audit_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_receipt_row_count ?? 0) + (metrics.missing_required_field_key_count ?? 0);
    if ((metrics.field_audit_item_count ?? 0) > 0 && (metrics.actor_field_audit_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt field audit is implemented and surfacing pending receipt fields without auto-applying protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_pack_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    if ((metrics.completion_item_count ?? 0) > 0 && (metrics.actor_completion_pack_count ?? 0) > 0 && (metrics.template_field_prompt_count ?? 0) > 0 && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion pack is implemented and preparing actor-specific manual receipt completion templates.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_verification_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0) + (metrics.missing_receipt_row_count ?? 0);
    const hasVerificationItems = (metrics.verification_item_count ?? 0) > 0 && (metrics.actor_verification_count ?? 0) > 0;
    const hasPromptAccounting = (metrics.field_prompt_count ?? 0) > 0 && ((metrics.pending_prompt_count ?? 0) + (metrics.completed_prompt_count ?? 0)) > 0;
    if (hasVerificationItems && hasPromptAccounting && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion verification is implemented and checking manual receipt input completion without editing receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_workbench_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    const hasWorkbenchItems = (metrics.workbench_item_count ?? 0) > 0 && (metrics.actor_workbench_count ?? 0) > 0;
    const hasWorkbenchLinks = (metrics.receipt_completion_template_count ?? 0) > 0 && (metrics.target_file_count ?? 0) > 0;
    if (hasWorkbenchItems && hasWorkbenchLinks && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion workbench is implemented and exposing actor-specific manual receipt input queues without editing receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_runbook_gate") {
    const errors = (metrics.validation_error_count ?? 0) + (metrics.blocked_count ?? 0);
    const hasRunbook = (metrics.runbook_step_count ?? 0) > 0 && (metrics.actor_runbook_count ?? 0) > 0;
    const hasManualAndCommandSteps = (metrics.command_step_count ?? 0) > 0 && (metrics.manual_step_count ?? 0) > 0;
    if (hasRunbook && hasManualAndCommandSteps && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion runbook is implemented and sequencing manual receipt input, verification reruns, and protected application approval without executing them.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_readiness_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReadinessRecords = (metrics.command_gate_count ?? 0) > 0 && (metrics.actor_readiness_count ?? 0) > 0;
    const hasGateSplit = (metrics.allowed_command_count ?? 0) > 0 && (metrics.blocked_command_count ?? 0) > 0;
    const hasManualHold = (metrics.manual_input_required_count ?? 0) > 0 && (metrics.blocked_until_manual_input_count ?? 0) > 0;
    if (hasReadinessRecords && hasGateSplit && hasManualHold && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion readiness is implemented and separating safe refresh commands from commands held until manual receipt input.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_queue_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReadyCommands = (metrics.command_queue_item_count ?? 0) > 0;
    const hasHeldCommands = (metrics.held_command_item_count ?? 0) > 0;
    const hasActors = (metrics.actor_command_queue_count ?? 0) > 0;
    if (hasReadyCommands && hasHeldCommands && hasActors && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command queue is implemented and surfacing safe manual refresh commands while holding protected and post-input commands.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipts_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReceipts = (metrics.receipt_draft_count ?? 0) > 0 && (metrics.receipt_requirement_count ?? 0) > 0;
    const hasHeldReferences = (metrics.held_command_reference_count ?? 0) > 0;
    if (hasReceipts && hasHeldReferences && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipts are implemented and drafting manual command-run receipts while keeping held commands as references.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_validation_gate") {
    const errors = metrics.error_count ?? 0;
    const hasValidation = (metrics.validation_item_count ?? 0) > 0 && (metrics.receipt_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasValidation && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt validation is implemented and holding pending command receipts until a human records manual execution.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_feedback_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasFeedback = (metrics.feedback_item_count ?? 0) > 0 && (metrics.actor_feedback_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasFeedback && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt feedback is implemented and routing pending command receipt work back to actors without executing commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasWorkspace = (metrics.workspace_item_count ?? 0) > 0 && (metrics.actor_workspace_count ?? 0) > 0;
    const hasEditableReceipts = (metrics.receipt_row_count ?? 0) > 0 && (metrics.editable_file_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasWorkspace && hasEditableReceipts && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace is implemented and preparing actor-specific editable command receipt inputs without running commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasMerge = (metrics.merge_item_count ?? 0) > 0 && (metrics.actor_input_count ?? 0) > 0;
    const hasMergedInput = (metrics.receipt_row_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasMerge && hasMergedInput && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace merge is implemented and combining actor command receipt inputs into a validation-ready receipt input without running commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate") {
    const errors = metrics.error_count ?? 0;
    const hasValidation = (metrics.validation_item_count ?? 0) > 0 && (metrics.receipt_count ?? 0) > 0;
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    if (hasValidation && hasPendingGate && errors === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt workspace validation is implemented and validating merged actor command receipt inputs before any confirmation or protected action.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_receipt_application_gate") {
    const errors = metrics.validation_error_count ?? metrics.receipt_error_count ?? 0;
    const hasApplicationDecision = ["nothing_to_apply", "applied"].includes(metrics.application_status);
    const hasPendingGate = (metrics.pending_receipt_count ?? 0) > 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasApplicationDecision && hasPendingGate && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command receipt application is implemented and can apply validated manual command receipts while preserving no-execution safety.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_reconciliation_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasReconciliation = (metrics.reconciliation_item_count ?? 0) > 0 && (metrics.actor_status_count ?? 0) > 0;
    const hasPendingCommandReceipts = (metrics.pending_command_receipt_count ?? 0) > 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasReconciliation && hasPendingCommandReceipts && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion reconciliation is implemented and summarizing pending command receipts, held commands, and actor follow-up without executing commands or protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_baseline_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const mismatches = metrics.mismatched_count_check_count ?? 0;
    const hasBaseline = ["frozen_with_blockers", "frozen_clear"].includes(metrics.baseline_status);
    const matchesSourceCounts = (metrics.pending_command_receipt_count ?? 0) === (metrics.source_pending_command_receipt_count ?? -1)
      && (metrics.held_command_count ?? 0) === (metrics.source_held_command_count ?? -1)
      && (metrics.protected_hold_count ?? 0) === (metrics.source_protected_held_command_count ?? -1);
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasBaseline && matchesSourceCounts && mismatches === 0 && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion baseline is implemented and freezing reconciliation blocker counts without mutating receipts or executing protected actions.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_manual_command_receipt_pack_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasActorPacks = (metrics.actor_receipt_pack_count ?? 0) > 0;
    const hasReceiptRows = (metrics.receipt_pack_item_count ?? 0) > 0;
    const matchesPendingBlockers = (metrics.receipt_pack_item_count ?? 0) === (metrics.pending_command_receipt_blocker_count ?? -1);
    const hasTargetPaths = (metrics.target_receipt_path_count ?? 0) > 0 && (metrics.missing_target_receipt_path_count ?? 0) === 0;
    const hasRequiredFields = (metrics.required_field_count ?? 0) > 0 && (metrics.missing_required_field_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasActorPacks && hasReceiptRows && matchesPendingBlockers && hasTargetPaths && hasRequiredFields && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion manual command receipt pack is implemented and exposes actor target receipt paths with complete required field placeholders.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_held_command_resolution_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasResolutionPlans = (metrics.resolution_plan_count ?? 0) > 0 && (metrics.actor_resolution_plan_count ?? 0) > 0;
    const matchesSources = (metrics.resolution_plan_count ?? 0) === (metrics.held_command_blocker_count ?? -1)
      && (metrics.resolution_plan_count ?? 0) === (metrics.source_held_command_count ?? -1)
      && (metrics.resolution_plan_count ?? 0) === (metrics.command_queue_held_item_count ?? -1);
    const hasResolutionContract = (metrics.unblock_condition_count ?? 0) === (metrics.resolution_plan_count ?? -1)
      && (metrics.follow_on_action_count ?? 0) === (metrics.resolution_plan_count ?? -1)
      && (metrics.missing_required_actor_count ?? 0) === 0
      && (metrics.missing_unblock_condition_count ?? 0) === 0
      && (metrics.missing_follow_on_action_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasResolutionPlans && matchesSources && hasResolutionContract && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion held command resolution is implemented and assigning each held command to an actor with an unblock condition and follow-on action.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_protected_approval_request_pack_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const sourceProtectedCount = metrics.source_protected_resolution_count ?? 0;
    const hasApprovalRequests = (metrics.approval_request_count ?? 0) > 0 && (metrics.actor_approval_pack_count ?? 0) > 0;
    const matchesProtectedSources = (metrics.approval_request_count ?? 0) === sourceProtectedCount
      && (metrics.protected_resolution_count ?? 0) === sourceProtectedCount
      && (metrics.protected_action_request_count ?? 0) === (metrics.approval_request_count ?? -1);
    const isSeparatedFromCommandReceipts = (metrics.command_receipt_mixed_count ?? 0) === 0
      && (metrics.non_protected_request_count ?? 0) === 0;
    const hasApprovalContract = (metrics.target_approval_input_path_count ?? 0) > 0
      && (metrics.missing_target_approval_input_path_count ?? 0) === 0
      && (metrics.required_approval_field_count ?? 0) > 0
      && (metrics.missing_required_approval_field_count ?? 0) === 0
      && (metrics.pending_explicit_approval_count ?? 0) === (metrics.approval_request_count ?? -1);
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (sourceProtectedCount === 0 && stage.status === "passed" && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion protected approval request pack is implemented and correctly found no protected approvals to request.");
    }
    if (hasApprovalRequests && matchesProtectedSources && isSeparatedFromCommandReceipts && hasApprovalContract && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion protected approval request pack is implemented and tracking protected actions as pending explicit approvals separate from command receipts.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_manual_revalidation_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasItems = (metrics.revalidation_item_count ?? 0) > 0 && (metrics.actor_revalidation_count ?? 0) > 0;
    const matchesManualPack = (metrics.revalidation_item_count ?? 0) === (metrics.source_pack_item_count ?? -1);
    const readyAppliedCandidates = metrics.ready_or_applied_candidate_count ?? 0;
    const humanReady = metrics.human_entered_ready_receipt_count ?? 0;
    const humanApplied = metrics.human_entered_applied_receipt_count ?? 0;
    const onlyHumanCandidates = readyAppliedCandidates === humanReady + humanApplied
      && (metrics.non_human_ready_or_applied_candidate_count ?? 0) === 0;
    const noUnsafeOverlap = (metrics.protected_approval_overlap_count ?? 0) === 0
      && (metrics.auto_executed_receipt_count ?? 0) === 0;
    const protectedActionsExecuted = metrics.protected_action_executed_count ?? 0;
    const refreshCommandsExecuted = metrics.refresh_command_executed_by_harness_count ?? 0;
    if (hasItems && matchesManualPack && onlyHumanCandidates && noUnsafeOverlap && errors === 0 && protectedActionsExecuted === 0 && refreshCommandsExecuted === 0) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion manual revalidation is implemented and allows only human-entered receipts to become ready/applied candidates while keeping harness execution at zero.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_command_queue_patch_projection_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasProjection = (metrics.projection_item_count ?? 0) > 0 && (metrics.audit_event_candidate_count ?? 0) > 0;
    const matchesRevalidation = (metrics.projection_item_count ?? 0) === (metrics.source_revalidation_item_count ?? -1);
    const targetsCovered = (metrics.patch_target_count ?? 0) === (metrics.projection_item_count ?? -1)
      && (metrics.missing_queue_item_count ?? 0) === 0;
    const readyPatchMatchesSource = (metrics.ready_patch_count ?? 0) === (metrics.source_ready_or_applied_candidate_count ?? -1)
      && (metrics.emittable_audit_event_candidate_count ?? 0) === (metrics.ready_patch_count ?? -1);
    const unsafeCandidates = (metrics.non_human_patch_candidate_count ?? 0)
      + (metrics.protected_overlap_count ?? 0)
      + (metrics.auto_executed_receipt_count ?? 0)
      + (metrics.blocked_patch_count ?? 0);
    const noExecution = (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.command_executed_count ?? 0) === 0
      && (metrics.refresh_command_executed_by_harness_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (hasProjection && matchesRevalidation && targetsCovered && readyPatchMatchesSource && unsafeCandidates === 0 && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion command queue patch projection is implemented and verifying patch targets, before/after states, and audit event candidates without applying them.");
    }
  }

  if (item.acceptance_profile === "human_review_cycle_receipt_completion_closeout_ledger_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const hasCloseout = (metrics.closeout_item_count ?? 0) > 0 && (metrics.actor_closeout_count ?? 0) > 0;
    const matchesBaseline = (metrics.closeout_item_count ?? 0) === (metrics.source_baseline_blocker_count ?? -1);
    const normalizedStatuses = (metrics.pending_count ?? 0)
      + (metrics.approved_count ?? 0)
      + (metrics.rejected_count ?? 0)
      + (metrics.superseded_count ?? 0);
    const statusesExhaustive = normalizedStatuses === (metrics.closeout_item_count ?? -1)
      && (metrics.normalized_status_total_count ?? 0) === (metrics.closeout_item_count ?? -1)
      && (metrics.unknown_status_count ?? 0) === 0;
    const noExecution = (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.command_executed_count ?? 0) === 0
      && (metrics.refresh_command_executed_by_harness_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (hasCloseout && matchesBaseline && statusesExhaustive && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human review cycle receipt completion closeout ledger is implemented and normalizing every blocker into pending, approved, rejected, or superseded without mutating sources or executing commands.");
    }
  }

  if (item.acceptance_profile === "human_review_v1_regression_freeze_gate") {
    const errors = metrics.validation_error_count ?? 0;
    const sourcesAvailable = (metrics.required_source_count ?? 0) > 0
      && (metrics.available_required_source_count ?? 0) === (metrics.required_source_count ?? -1);
    const fixtureHasHashes = (metrics.regression_fixture_artifact_count ?? 0) > 0
      && (metrics.regression_fixture_hash_count ?? 0) === (metrics.regression_fixture_artifact_count ?? -1);
    const checkpointsPassed = (metrics.verification_checkpoint_count ?? 0) > 0
      && (metrics.failed_verification_checkpoint_count ?? 1) === 0;
    const loopClean = metrics.loop_status === "passed"
      && (metrics.loop_failed_step_count ?? 1) === 0
      && (metrics.loop_missing_artifact_count ?? 1) === 0;
    const closeoutFrozen = (metrics.closeout_item_count ?? 0) > 0
      && (metrics.closeout_unknown_status_count ?? 1) === 0;
    const noExecution = (metrics.command_executed_count ?? 0) === 0
      && (metrics.patch_applied_count ?? 0) === 0
      && (metrics.audit_event_emitted_count ?? 0) === 0
      && (metrics.protected_action_executed_count ?? 0) === 0;
    if (sourcesAvailable && fixtureHasHashes && checkpointsPassed && loopClean && closeoutFrozen && errors === 0 && noExecution) {
      return passedWithOperationalGate(stage, "Human Review v1 regression freeze is implemented and locking the closure fixture, checkpoint contract, and no-execution handling before P097.");
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
