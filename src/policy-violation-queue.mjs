import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_VIOLATION_QUEUE_OUT_DIR = "artifacts/policy-violation-queue/latest";
export const DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS = {
  packageJsonPath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  policyOperationsSurfacePath: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  matterCockpitUiPath: "artifacts/matter-cockpit-ui/latest/matter-cockpit-ui.json",
};

const PHASE_SLOT = "P294";
const PREVIOUS_PHASE_SLOT = "P293";
const NEXT_PHASE_SLOT = "P295";
const CAPABILITY_ID = "desktop.policy_violation_queue";
const REQUIRED_FAMILIES = ["model", "tool", "access", "output"];
const PANEL_DEFINITIONS = [
  ["model", "Model policy", "External model, provider boundary, and redaction policy blocks."],
  ["tool", "Tool/runtime policy", "Forbidden tool, protected tool, and runtime permission blocks."],
  ["access", "Access policy", "Matter, store, workspace, and classification boundary blocks."],
  ["output", "Output policy", "Output destination and final action holds requiring human approval."],
];

export async function runPolicyViolationQueue(options = {}) {
  const result = await buildPolicyViolationQueue(options);
  if (options.write !== false) await writePolicyViolationQueue(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy violation queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicyViolationQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_VIOLATION_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = JSON.parse(await readText(inputs.package_json_path));
  const roadmapText = await readText(inputs.roadmap_path);
  const implementationRoadmapText = await readText(inputs.implementation_roadmap_path);
  const reviewDashboardText = await readText(inputs.review_dashboard_path);
  const reviewApiText = await readText(inputs.review_api_path);
  const reviewApiDocText = await readText(inputs.review_api_doc_path);
  const sources = {
    policyOperationsSurface: await readJson(inputs.policy_operations_surface_path),
    matterAccessPolicyEvaluator: await readJson(inputs.matter_access_policy_evaluator_path),
    modelPolicyEnforcement: await readJson(inputs.model_policy_enforcement_path),
    toolRuntimePolicyEnforcement: await readJson(inputs.tool_runtime_policy_enforcement_path),
    outputDestinationPolicyEnforcement: await readJson(inputs.output_destination_policy_enforcement_path),
    matterCockpitUi: await readJson(inputs.matter_cockpit_ui_path),
  };
  const queueItems = buildQueueItems({ sources, generatedAt });
  const actorActions = buildActorActions({ queueItems, generatedAt });
  const panels = buildPanels({ queueItems, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    sources,
    queueItems,
    actorActions,
    panels,
    boundary,
    generatedAt,
  });
  const validation = summarizeValidation(checks);
  const summary = buildSummary({ sources, queueItems, actorActions, panels, checks, validation, boundary, generatedAt });
  const result = {
    schema_version: "policy-violation-queue.v1",
    policy_violation_queue_id: summary.policy_violation_queue_id,
    policy_violation_queue_status: summary.policy_violation_queue_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources),
    policy_violation_queue_contract: buildQueueContract(generatedAt),
    policy_violation_queue_panels: panels,
    policy_violation_queue_items: queueItems,
    policy_violation_actor_actions: actorActions,
    policy_violation_queue_boundary: boundary,
    policy_violation_queue_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

function buildQueueItems({ sources, generatedAt }) {
  const catalog = sources.policyOperationsSurface.policy_operations_catalog ?? {};
  const decisionsById = new Map((catalog.policy_decision_rows ?? []).map((row) => [row.policy_decision_row_id, row]));
  const violationItems = (catalog.policy_violation_rows ?? [])
    .filter((row) => policyFamilyFor(row.policy_layer) !== null)
    .map((row) => {
      const decision = decisionsById.get(row.policy_decision_row_id);
      return buildQueueItem({
        source: "violation",
        row,
        decision,
        generatedAt,
      });
    });
  const outputHoldItems = (catalog.policy_pending_approval_rows ?? [])
    .filter((row) => row.policy_layer === "output_destination")
    .map((row) => {
      const decision = decisionsById.get(row.policy_decision_row_id);
      return buildQueueItem({
        source: "policy_hold",
        row,
        decision,
        generatedAt,
      });
    });
  return [...violationItems, ...outputHoldItems].sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity);
    if (severity !== 0) return severity;
    return a.policy_violation_queue_item_id.localeCompare(b.policy_violation_queue_item_id);
  });
}

function buildQueueItem({ source, row, decision, generatedAt }) {
  const policyLayer = row.policy_layer;
  const policyFamily = source === "policy_hold" ? "output" : policyFamilyFor(policyLayer);
  const sourceRecordId = row.source_record_id;
  const queueItemType = source === "policy_hold" ? "policy_hold" : "policy_violation";
  const severity = source === "policy_hold" ? "warning" : row.severity;
  const decisionValue = row.decision ?? decision?.decision ?? "review";
  const gateStatus = row.gate_status ?? decision?.gate_status ?? "requires_approval";
  const requiredGates = unique(row.required_gates ?? decision?.required_gates ?? ["human_approval_gate"]);
  const reasonCodes = unique(row.reason_codes ?? decision?.reason_codes ?? [row.pending_reason].filter(Boolean));
  const actionType = actorActionTypeFor(policyFamily, queueItemType, severity);
  return {
    schema_version: "policy-violation-queue-item.v1",
    policy_violation_queue_item_id: `policy-violation-queue-item.${slugify(queueItemType)}.${slugify(row.policy_violation_row_id ?? row.policy_pending_approval_id ?? sourceRecordId)}`,
    queue_item_status: "open",
    queue_item_type: queueItemType,
    policy_family: policyFamily,
    policy_layer: policyLayer,
    source_artifact_id: row.source_artifact_id,
    source_record_type: row.source_record_type,
    source_record_id: sourceRecordId,
    policy_decision_row_id: row.policy_decision_row_id ?? null,
    policy_violation_row_id: row.policy_violation_row_id ?? null,
    policy_pending_approval_id: row.policy_pending_approval_id ?? null,
    violation_type: row.violation_type ?? `${policyLayer}_hold`,
    severity,
    decision: decisionValue,
    gate_status: gateStatus,
    control_effect: decision?.control_effect ?? (decisionValue === "deny" ? "block" : "hold_for_review"),
    tenant_id: row.tenant_id ?? decision?.tenant_id ?? null,
    matter_id: row.matter_id ?? decision?.matter_id ?? null,
    resource_id: row.resource_id ?? decision?.resource_id ?? null,
    runtime_id: row.runtime_id ?? decision?.runtime_id ?? null,
    classification: row.classification ?? decision?.classification ?? null,
    policy_snapshot_id: row.policy_snapshot_id ?? decision?.policy_snapshot_id ?? null,
    required_gates: requiredGates,
    reason_codes: reasonCodes,
    remediation: row.remediation ?? "Keep final output or protected action blocked until the required human gate is satisfied.",
    required_actor: requiredActorFor(policyFamily, queueItemType, row),
    actor_action_type: actionType,
    actor_action_label: actorActionLabelFor(actionType),
    actor_action_status: "open",
    read_only: true,
    preview_only: true,
    queue_projection_only: true,
    source_content_read_performed: false,
    policy_mutation_allowed: false,
    approval_application_allowed: false,
    protected_action_execution_allowed: false,
    delivery_execution_allowed: false,
    route_execution_allowed: false,
    server_start_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    detected_at: row.detected_at ?? row.created_at ?? generatedAt,
    created_at: generatedAt,
  };
}

function buildActorActions({ queueItems, generatedAt }) {
  return queueItems.map((item) => ({
    schema_version: "policy-violation-actor-action.v1",
    policy_violation_actor_action_id: `policy-violation-actor-action.${slugify(item.policy_violation_queue_item_id)}`,
    policy_violation_queue_item_id: item.policy_violation_queue_item_id,
    policy_family: item.policy_family,
    policy_layer: item.policy_layer,
    actor_role: item.required_actor,
    actor_action_type: item.actor_action_type,
    action_status: "open",
    required_gates: item.required_gates,
    source_artifact_id: item.source_artifact_id,
    source_record_id: item.source_record_id,
    tenant_id: item.tenant_id,
    matter_id: item.matter_id,
    resource_id: item.resource_id,
    runtime_id: item.runtime_id,
    read_only: true,
    preview_only: true,
    queue_projection_only: true,
    policy_mutation_allowed: false,
    approval_application_allowed: false,
    protected_action_execution_allowed: false,
    delivery_execution_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  }));
}

function buildPanels({ queueItems, generatedAt }) {
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => {
    const items = queueItems.filter((item) => item.policy_family === panelKey);
    return {
      schema_version: "policy-violation-queue-panel.v1",
      policy_violation_queue_panel_id: `policy-violation-queue-panel.${panelKey}`,
      panel_key: panelKey,
      panel_label: panelLabel,
      panel_order: index + 1,
      panel_status: "ready",
      description,
      queue_item_count: items.length,
      critical_item_count: items.filter((item) => item.severity === "critical").length,
      warning_item_count: items.filter((item) => item.severity === "warning").length,
      read_only: true,
      preview_only: true,
      queue_projection_only: true,
      actor_action_execution_allowed: false,
      policy_mutation_allowed: false,
      approval_application_allowed: false,
      protected_action_execution_allowed: false,
      delivery_execution_allowed: false,
      human_review_required: true,
      client_facing_ready: false,
      generated_at: generatedAt,
    };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "policy-violation-queue-boundary.v1",
    boundary_status: "enforced",
    generated_at: generatedAt,
    read_only: true,
    preview_only: true,
    queue_projection_only: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    policy_mutation_allowed: false,
    approval_application_performed: false,
    receipt_application_performed: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildQueueContract(generatedAt) {
  return {
    schema_version: "policy-violation-queue-contract.v1",
    policy_violation_queue_contract_id: "policy-violation-queue.v1",
    generated_at: generatedAt,
    queue_rule: "Project model, tool, access, and output policy blocks or holds into read-only operator queue items.",
    actor_action_rule: "Actor actions are instructions for human review only; they do not execute approvals, protected actions, deliveries, routes, or server starts.",
    source_rule: "Read only policy operation metadata and source artifact summaries; do not read source document/log contents.",
  };
}

function buildChecks({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  reviewDashboardText,
  reviewApiText,
  reviewApiDocText,
  sources,
  queueItems,
  actorActions,
  panels,
  boundary,
  generatedAt,
}) {
  const checks = [];
  const check = (pathValue, checkId, passed, message) => checks.push({
    validation_item_id: `policy-violation-queue-check.${slugify(checkId)}`,
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
    generated_at: generatedAt,
  });
  check("package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["policy:violation-queue"]), "package.json registers policy:violation-queue.");
  check("docs.final_completion_ledger", "ledger_promotes_phase_294", includesAll(roadmapText, ["P294", "Policy Violation Queue"]), "Final completion ledger tracks P294.");
  check("docs.implementation_roadmap", "implementation_roadmap_promotes_phase_294", includesAll(implementationRoadmapText, ["Phase 294 - Policy Violation Queue", "policy_violation_queue"]), "Implementation roadmap documents Phase 294.");
  check("src.review_dashboard", "dashboard_registered", includesAll(reviewDashboardText, ["policy_violation_queue", "buildPolicyViolationQueueStage"]), "Review Dashboard registers Policy Violation Queue.");
  check("src.review_api", "review_api_registered", includesAll(reviewApiText, ["/api/policy-violation-queue-artifacts", "/api/policy-violation-actor-actions"]), "Review API exposes Policy Violation Queue routes.");
  check("docs.review_api", "review_api_doc_registered", includesAll(reviewApiDocText, ["Policy Violation Queue routes", "/api/policy-violation-queue-items"]), "Review API docs include Policy Violation Queue routes.");
  check("sources.policy_operations_surface", "policy_operations_surface_ready", sourceStatus(sources.policyOperationsSurface, "policy_operations_surface_status") === "complete", "Policy Operations Surface is complete.");
  check("sources.model_policy_enforcement", "model_policy_ready", sourceStatus(sources.modelPolicyEnforcement, "model_policy_enforcement_status") === "complete", "Model Policy Enforcement is complete.");
  check("sources.tool_runtime_policy_enforcement", "tool_runtime_policy_ready", sourceStatus(sources.toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status") === "complete", "Tool Runtime Policy Enforcement is complete.");
  check("sources.matter_access_policy_evaluator", "matter_access_policy_ready", sourceStatus(sources.matterAccessPolicyEvaluator, "access_policy_status") === "complete", "Matter Access Policy Evaluator is complete.");
  check("sources.output_destination_policy_enforcement", "output_destination_policy_ready", sourceStatus(sources.outputDestinationPolicyEnforcement, "output_destination_policy_status") === "complete", "Output Destination Policy Enforcement is complete.");
  check("sources.matter_cockpit_ui", "matter_cockpit_ui_guard_ready", sources.matterCockpitUi.summary?.matter_cockpit_ui_status === "complete" && sources.matterCockpitUi.summary?.phase_slot === PREVIOUS_PHASE_SLOT && sources.matterCockpitUi.summary?.next_phase_slot === PHASE_SLOT, "P293 Matter Cockpit UI guard is complete and points to P294.");
  check("policy_violation_queue_items", "queue_items_present", queueItems.length > 0, `${queueItems.length} queue item(s) projected.`);
  for (const family of REQUIRED_FAMILIES) {
    check(`policy_violation_queue_items.${family}`, `${family}_family_present`, queueItems.some((item) => item.policy_family === family), `${family} policy queue items are visible.`);
  }
  check("policy_violation_actor_actions", "actor_actions_match_queue", actorActions.length === queueItems.length && actorActions.every((action) => action.action_status === "open"), "Every queue item has an open actor action.");
  check("policy_violation_queue_panels", "required_panels_ready", panels.length === REQUIRED_FAMILIES.length && panels.every((panel) => panel.panel_status === "ready"), "All required queue panels are ready.");
  check("policy_violation_queue_boundary", "read_only_boundary_enforced", boundary.read_only && !boundary.policy_mutation_allowed && !boundary.approval_application_performed && !boundary.protected_action_executed && !boundary.delivery_execution_performed, "Read-only/no-execution boundary is enforced.");
  check("policy_violation_actor_actions.execution", "actor_actions_are_non_executing", actorActions.every((action) => !action.policy_mutation_allowed && !action.approval_application_allowed && !action.protected_action_execution_allowed && !action.delivery_execution_allowed), "Actor actions do not execute policy changes, approvals, protected actions, or delivery.");
  check("policy_violation_queue_items.client", "no_client_facing_output", queueItems.every((item) => !item.client_facing_ready && !item.client_facing_output_generated), "Queue items are not client-facing output.");
  return checks;
}

function buildSummary({ sources, queueItems, actorActions, panels, checks, validation, boundary, generatedAt }) {
  return {
    policy_violation_queue_status: validation.valid ? "complete" : "attention",
    policy_violation_queue_id: `policy-violation-queue.${dateStamp(generatedAt)}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_policy_operations_surface_status: sourceStatus(sources.policyOperationsSurface, "policy_operations_surface_status"),
    source_policy_decision_row_count: sources.policyOperationsSurface.summary?.policy_decision_row_count ?? 0,
    source_policy_violation_row_count: sources.policyOperationsSurface.summary?.policy_violation_row_count ?? 0,
    source_policy_pending_approval_row_count: sources.policyOperationsSurface.summary?.policy_pending_approval_row_count ?? 0,
    source_model_policy_enforcement_status: sourceStatus(sources.modelPolicyEnforcement, "model_policy_enforcement_status"),
    source_tool_runtime_policy_enforcement_status: sourceStatus(sources.toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status"),
    source_matter_access_policy_status: sourceStatus(sources.matterAccessPolicyEvaluator, "access_policy_status"),
    source_output_destination_policy_status: sourceStatus(sources.outputDestinationPolicyEnforcement, "output_destination_policy_status"),
    source_matter_cockpit_ui_status: sources.matterCockpitUi.summary?.matter_cockpit_ui_status ?? "unknown",
    source_matter_cockpit_ui_phase_slot: sources.matterCockpitUi.summary?.phase_slot ?? null,
    source_matter_cockpit_ui_next_phase_slot: sources.matterCockpitUi.summary?.next_phase_slot ?? null,
    policy_violation_queue_panel_count: panels.length,
    required_panel_count: REQUIRED_FAMILIES.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    queue_item_count: queueItems.length,
    policy_violation_item_count: queueItems.filter((item) => item.queue_item_type === "policy_violation").length,
    policy_hold_item_count: queueItems.filter((item) => item.queue_item_type === "policy_hold").length,
    model_queue_item_count: queueItems.filter((item) => item.policy_family === "model").length,
    tool_queue_item_count: queueItems.filter((item) => item.policy_family === "tool").length,
    access_queue_item_count: queueItems.filter((item) => item.policy_family === "access").length,
    output_queue_item_count: queueItems.filter((item) => item.policy_family === "output").length,
    critical_queue_item_count: queueItems.filter((item) => item.severity === "critical").length,
    warning_queue_item_count: queueItems.filter((item) => item.severity === "warning").length,
    open_actor_action_count: actorActions.filter((action) => action.action_status === "open").length,
    human_review_required_action_count: actorActions.filter((action) => action.human_review_required).length,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    queue_projection_only: boundary.queue_projection_only,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    policy_mutation_allowed: boundary.policy_mutation_allowed,
    approval_application_performed: boundary.approval_application_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    protected_action_executed: boundary.protected_action_executed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: checks.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_policy_family: countBy(queueItems, "policy_family"),
    by_policy_layer: countBy(queueItems, "policy_layer"),
    by_actor_action_type: countBy(actorActions, "actor_action_type"),
  };
}

export async function writePolicyViolationQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "policy-violation-queue.json"), serializable);
  await writeJson(path.join(outDir, "policy-violation-queue-panels.json"), collectionEnvelope("policy-violation-queue-panels.v1", "policy_violation_queue_panels", result.policy_violation_queue_panels, result.generated_at));
  await writeJson(path.join(outDir, "policy-violation-queue-items.json"), collectionEnvelope("policy-violation-queue-items.v1", "policy_violation_queue_items", result.policy_violation_queue_items, result.generated_at));
  await writeJson(path.join(outDir, "policy-violation-actor-actions.json"), collectionEnvelope("policy-violation-actor-actions.v1", "policy_violation_actor_actions", result.policy_violation_actor_actions, result.generated_at));
  await writeJson(path.join(outDir, "policy-violation-queue-boundary.json"), result.policy_violation_queue_boundary);
  await writeJson(path.join(outDir, "policy-violation-queue-checks.json"), collectionEnvelope("policy-violation-queue-checks.v1", "policy_violation_queue_checks", result.policy_violation_queue_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    policy_violation_queue_id: result.policy_violation_queue_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Policy Violation Queue");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.policy_violation_queue_status}`);
  lines.push("");
  lines.push(`- Queue items: ${summary.queue_item_count}`);
  lines.push(`- Violation/hold items: ${summary.policy_violation_item_count}/${summary.policy_hold_item_count}`);
  lines.push(`- Model/tool/access/output: ${summary.model_queue_item_count}/${summary.tool_queue_item_count}/${summary.access_queue_item_count}/${summary.output_queue_item_count}`);
  lines.push(`- Actor actions: ${summary.open_actor_action_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("- Read-only queue projection.");
  lines.push("- No policy mutation, approval application, protected action execution, delivery execution, route execution, legal advice, or client-facing output.");
  return `${lines.join("\n")}\n`;
}

export async function runPolicyViolationQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPolicyViolationQueue(args);
    console.log(`Policy Violation Queue validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.policy_violation_queue_status}`);
    console.log(`Queue items: ${result.summary.queue_item_count}`);
    console.log(`Actor actions: ${result.summary.open_actor_action_count}`);
    console.log(`Model/tool/access/output: ${result.summary.model_queue_item_count}/${result.summary.tool_queue_item_count}/${result.summary.access_queue_item_count}/${result.summary.output_queue_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildSourceContracts(sources) {
  return {
    policy_operations_surface: sourceContract(sources.policyOperationsSurface, "policy_operations_surface_status"),
    matter_access_policy_evaluator: sourceContract(sources.matterAccessPolicyEvaluator, "access_policy_status"),
    model_policy_enforcement: sourceContract(sources.modelPolicyEnforcement, "model_policy_enforcement_status"),
    tool_runtime_policy_enforcement: sourceContract(sources.toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status"),
    output_destination_policy_enforcement: sourceContract(sources.outputDestinationPolicyEnforcement, "output_destination_policy_status"),
    matter_cockpit_ui: sourceContract(sources.matterCockpitUi, "matter_cockpit_ui_status"),
  };
}

function sourceContract(artifact, statusField) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: sourceStatus(artifact, statusField),
    generated_at: artifact.generated_at ?? null,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function sourceStatus(artifact, statusField) {
  return artifact.summary?.[statusField] ?? artifact[statusField] ?? "unknown";
}

function policyFamilyFor(policyLayer) {
  if (["model_policy", "golden_model_policy"].includes(policyLayer)) return "model";
  if (["tool_runtime", "golden_tool_runtime"].includes(policyLayer)) return "tool";
  if (["matter_access", "store_policy", "workspace_boundary", "data_classification", "golden_matter_access", "golden_store_policy", "golden_workspace_boundary"].includes(policyLayer)) return "access";
  if (["output_destination", "golden_output_destination"].includes(policyLayer)) return "output";
  return null;
}

function actorActionTypeFor(policyFamily, queueItemType, severity) {
  if (policyFamily === "output") return queueItemType === "policy_hold" ? "review_output_destination_hold" : "investigate_output_policy_block";
  if (policyFamily === "tool") return "review_tool_runtime_block";
  if (policyFamily === "model") return "review_model_policy_block";
  if (severity === "critical") return "investigate_access_block";
  return "review_access_policy_block";
}

function actorActionLabelFor(actionType) {
  return actionType.replaceAll("_", " ");
}

function requiredActorFor(policyFamily, queueItemType, row) {
  if (row.required_actor) return row.required_actor;
  if (policyFamily === "output") return queueItemType === "policy_hold" ? "output_approver" : "policy_operator";
  if (policyFamily === "tool") return "runtime_operator";
  if (policyFamily === "model") return "policy_operator";
  return "matter_security_reviewer";
}

function severityRank(severity) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  if (severity === "info") return 1;
  return 0;
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "passed"),
    errors: items.filter((item) => item.status === "failed").map((item) => ({
      path: item.path,
      message: item.message,
      check_id: item.check_id,
    })),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== null && value !== undefined && value !== ""))];
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  return {
    package_json_path: path.resolve(options.packageJsonPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.packageJsonPath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.reviewApiDocPath),
    policy_operations_surface_path: path.resolve(options.policyOperationsSurfacePath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.policyOperationsSurfacePath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.matterAccessPolicyEvaluatorPath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.modelPolicyEnforcementPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.toolRuntimePolicyEnforcementPath),
    output_destination_policy_enforcement_path: path.resolve(options.outputDestinationPolicyEnforcementPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.outputDestinationPolicyEnforcementPath),
    matter_cockpit_ui_path: path.resolve(options.matterCockpitUiPath ?? DEFAULT_POLICY_VIOLATION_QUEUE_INPUTS.matterCockpitUiPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--policy-operations-surface") parsed.policyOperationsSurfacePath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--model-policy") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else if (arg === "--matter-cockpit-ui") parsed.matterCockpitUiPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/policy-violation-queue.mjs [--check] [--out-dir DIR]");
}
