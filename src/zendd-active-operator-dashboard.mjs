import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildZenddCommandEvidenceExecutionBridge } from "./zendd-command-evidence-execution-bridge.mjs";
import { buildZenddFrontendOperationShell } from "./zendd-frontend-operation-shell.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddProtectedActionEscalation } from "./zendd-protected-action-escalation.mjs";
import { buildZenddRecoveryIncidentDrafts } from "./zendd-recovery-incident-drafts.mjs";
import { buildZenddWorkOrderIntake } from "./zendd-work-order-intake.mjs";

export const DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_OUT_DIR = "artifacts/zendd-active-operator-dashboard/latest";
export const DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS = {
  schemaPath: "schemas/zendd-active-operator-dashboard.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  designTokensPath: "configs/hermes/operator-design-tokens.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-active-operator-dashboard";
const FRONTEND_SHELL_COMMAND_NAME = "project:zendd-frontend-operation-shell";
const WORK_ORDER_COMMAND_NAME = "project:zendd-work-order-intake";
const COMMAND_BRIDGE_COMMAND_NAME = "project:zendd-command-evidence-execution-bridge";
const PROTECTED_ESCALATION_COMMAND_NAME = "project:zendd-protected-action-escalation";
const RECOVERY_INCIDENT_COMMAND_NAME = "project:zendd-recovery-incident-drafts";
const SCHEMA_VERSION = "zendd-active-operator-dashboard.v1";
const CAPABILITY_ID = "project.zendd.active_operator_dashboard";
const PHASE_RANGE = "P961-P980";
const PHASE_SLOT = "P961";
const PREVIOUS_PHASE_SLOT = "P960";
const NEXT_PHASE_SLOT = "P981";
const READY_STATUS = "ready_for_zendd_active_operator_dashboard";

export async function runZenddActiveOperatorDashboard(options = {}) {
  const result = await buildZenddActiveOperatorDashboard(options);
  if (options.write !== false) await writeZenddActiveOperatorDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd active operator dashboard failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddActiveOperatorDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const designTokenSource = await readJsonSource(inputs.design_tokens_path);
  const commonOptions = {
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  };
  const frontendShell = await buildZenddFrontendOperationShell({
    ...commonOptions,
    designTokensPath: inputs.design_tokens_path,
  });
  const workOrderIntake = await buildZenddWorkOrderIntake(commonOptions);
  const commandBridge = await buildZenddCommandEvidenceExecutionBridge(commonOptions);
  const protectedEscalation = await buildZenddProtectedActionEscalation(commonOptions);
  const recoveryIncidents = await buildZenddRecoveryIncidentDrafts(commonOptions);

  const policy = buildDashboardPolicy(generatedAt, { frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents });
  const widgetRows = buildDashboardWidgetRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents });
  const apiRows = buildDashboardApiRouteRows();
  const bindingRows = buildDashboardDataBindingRows({ frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents });
  const missingRows = buildDashboardMissingInputRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents });
  const nextActionRows = buildDashboardNextActionRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents });
  const uiArtifactRows = buildDashboardUiArtifactRows();
  const failClosedRows = buildFailClosedRows({ policy, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows });
  const closeoutRows = buildCloseoutRows({ policy, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, designTokenSource, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_active_operator_dashboard_id: `zendd-active-operator-dashboard.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    active_operator_dashboard_anchor: anchor,
    source_frontend_operation_shell_summary: frontendShell.summary,
    source_work_order_intake_summary: workOrderIntake.summary,
    source_command_evidence_execution_bridge_summary: commandBridge.summary,
    source_protected_action_escalation_summary: protectedEscalation.summary,
    source_recovery_incident_drafts_summary: recoveryIncidents.summary,
    active_operator_dashboard_policy: policy,
    active_dashboard_widget_rows: widgetRows,
    active_dashboard_api_route_rows: apiRows,
    active_dashboard_data_binding_rows: bindingRows,
    active_dashboard_missing_input_rows: missingRows,
    active_dashboard_next_action_rows: nextActionRows,
    active_dashboard_ui_artifact_rows: uiArtifactRows,
    active_dashboard_fail_closed_rows: failClosedRows,
    active_dashboard_closeout_rows: closeoutRows,
    active_dashboard_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_active_operator_dashboard")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_active_operator_dashboard_id = result.zendd_active_operator_dashboard_id;
  const html = renderDashboardHtml(result, designTokenSource.data);
  const css = renderDashboardCss(designTokenSource.data);
  return { ...result, html, css, markdown: renderMarkdown(result) };
}

export async function writeZenddActiveOperatorDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-active-operator-dashboard.json"), serializableResult(result));
  await writeJson(path.join(outDir, "active-operator-dashboard-policy.json"), result.active_operator_dashboard_policy);
  await writeJson(path.join(outDir, "active-dashboard-widget-rows.json"), collectionEnvelope("zendd-active-dashboard-widget-rows.v1", "active_dashboard_widget_rows", result.active_dashboard_widget_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-api-route-rows.json"), collectionEnvelope("zendd-active-dashboard-api-route-rows.v1", "active_dashboard_api_route_rows", result.active_dashboard_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-data-binding-rows.json"), collectionEnvelope("zendd-active-dashboard-data-binding-rows.v1", "active_dashboard_data_binding_rows", result.active_dashboard_data_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-missing-input-rows.json"), collectionEnvelope("zendd-active-dashboard-missing-input-rows.v1", "active_dashboard_missing_input_rows", result.active_dashboard_missing_input_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-next-action-rows.json"), collectionEnvelope("zendd-active-dashboard-next-action-rows.v1", "active_dashboard_next_action_rows", result.active_dashboard_next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-ui-artifact-rows.json"), collectionEnvelope("zendd-active-dashboard-ui-artifact-rows.v1", "active_dashboard_ui_artifact_rows", result.active_dashboard_ui_artifact_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-fail-closed-rows.json"), collectionEnvelope("zendd-active-dashboard-fail-closed-rows.v1", "active_dashboard_fail_closed_rows", result.active_dashboard_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-closeout-rows.json"), collectionEnvelope("zendd-active-dashboard-closeout-rows.v1", "active_dashboard_closeout_rows", result.active_dashboard_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-dashboard-gate-rows.json"), collectionEnvelope("zendd-active-dashboard-gate-rows.v1", "active_dashboard_gate_rows", result.active_dashboard_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-active-operator-dashboard-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "active-dashboard.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "active-dashboard.css"), result.css, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddActiveOperatorDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddActiveOperatorDashboard(args);
    console.log(`Zendd active operator dashboard ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_active_operator_dashboard_status}`);
    console.log(`Widgets: ${result.summary.active_dashboard_widget_count}`);
    console.log(`API routes: ${result.summary.active_dashboard_api_route_count}`);
    console.log(`Missing inputs: ${result.summary.active_dashboard_missing_input_count}`);
    console.log(`Next actions: ${result.summary.active_dashboard_next_action_count}`);
    console.log(`Server started: ${result.summary.server_started}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildDashboardPolicy(generatedAt, sources) {
  return {
    schema_version: "zendd-active-operator-dashboard-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_frontend_operation_shell_ref: sources.frontendShell.zendd_frontend_operation_shell_id,
    source_work_order_intake_ref: sources.workOrderIntake.zendd_work_order_intake_id,
    source_command_evidence_execution_bridge_ref: sources.commandBridge.zendd_command_evidence_execution_bridge_id,
    source_protected_action_escalation_ref: sources.protectedEscalation.zendd_protected_action_escalation_id,
    source_recovery_incident_drafts_ref: sources.recoveryIncidents.zendd_recovery_incident_drafts_id,
    active_dashboard_surface_creation_allowed: true,
    read_only_dashboard: true,
    server_started: false,
    api_projection_only: true,
    route_mutation_performed: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    client_delivery_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    dashboard_widgets_required: ["work_orders", "blocked_actions", "missing_evidence", "missing_receipts", "command_evidence", "incident_drafts", "next_actions"],
    api_routes_required: ["claims", "work_orders", "blocked_actions", "missing_inputs", "command_evidence", "incidents", "next_actions"],
    next_allowed_action: "use deterministic dashboard artifacts to inspect blocked Zendd work without executing protected actions",
    created_at: generatedAt,
  };
}

function buildDashboardWidgetRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents }) {
  const widgets = [
    ["work_orders", "Work orders", workOrderIntake.work_order_rows.length, "work_order_rows", "Show planning-only PASS rows and protected BLOCK rows."],
    ["blocked_actions", "Blocked actions", protectedEscalation.protected_action_escalation_packet_rows.length + workOrderIntake.protected_work_order_block_rows.length, "protected_action_escalation_packet_rows", "Show protected actions blocked by hard gates and missing receipts."],
    ["missing_evidence", "Missing evidence", recoveryIncidents.operator_incident_surface_rows.length, "operator_incident_surface_rows", "Show missing command, rollback, receipt, and evidence slots."],
    ["missing_receipts", "Missing receipts", protectedEscalation.protected_action_human_gate_rows.length + recoveryIncidents.recovery_receipt_draft_rows.length, "protected_action_human_gate_rows", "Show human receipt queues and recovery receipt drafts."],
    ["command_evidence", "Command evidence", commandBridge.command_execution_packet_rows.length, "command_execution_packet_rows", "Show command packets without running commands."],
    ["incident_drafts", "Incident drafts", recoveryIncidents.recovery_incident_draft_rows.length, "recovery_incident_draft_rows", "Show incident drafts, rollback targets, and next action."],
    ["release_and_client_blocks", "Release/client blocks", recoveryIncidents.recovery_incident_draft_rows.filter((row) => row.client_delivery_allowed_now === false).length, "recovery_incident_draft_rows", "Show release, client-output, and delivery blocks."],
    ["next_actions", "Next actions", nextActionSourceRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents }).length, "active_dashboard_next_action_rows", "Show next allowed action without executing it."],
  ];
  return widgets.map(([widgetId, title, count, sourceCollection, description], index) => ({
    schema_version: "zendd-active-dashboard-widget-row.v1",
    phase_slot: "P964-P966",
    row_id: `zendd-active-dashboard-widget.row.${String(index + 1).padStart(2, "0")}`,
    widget_id: widgetId,
    title,
    description,
    source_collection: sourceCollection,
    display_count: count,
    widget_status: "ready_read_only",
    current_verdict: "pass",
    read_only: true,
    server_started: false,
    route_mutation_performed: false,
    action_execution_allowed_now: false,
    next_allowed_action: "render widget from deterministic artifact rows only",
  }));
}

function buildDashboardApiRouteRows() {
  const routes = [
    ["/api/project-zendd/dashboard/claims", "claims"],
    ["/api/project-zendd/dashboard/work-orders", "work_orders"],
    ["/api/project-zendd/dashboard/blocked-actions", "blocked_actions"],
    ["/api/project-zendd/dashboard/missing-inputs", "missing_inputs"],
    ["/api/project-zendd/dashboard/command-evidence", "command_evidence"],
    ["/api/project-zendd/dashboard/incidents", "incidents"],
    ["/api/project-zendd/dashboard/next-actions", "next_actions"],
    ["/operator/zendd/active-dashboard", "static_dashboard"],
  ];
  return routes.map(([routePath, routeKey], index) => ({
    schema_version: "zendd-active-dashboard-api-route-row.v1",
    phase_slot: "P967-P968",
    row_id: `zendd-active-dashboard-api-route.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    route_key: routeKey,
    route_status: "ready_read_only_projection",
    allowed_methods: ["GET"],
    mutating_method_allowed: false,
    server_started: false,
    route_mutation_performed: false,
    zendd_file_write_allowed_now: false,
    protected_action_execution_allowed_now: false,
    next_allowed_action: "serve only deterministic artifact projection if a future read-only server is started",
  }));
}

function buildDashboardDataBindingRows({ frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents }) {
  const bindings = [
    ["frontend_shell", frontendShell.zendd_frontend_operation_shell_id, "source_frontend_operation_shell_summary"],
    ["work_orders", workOrderIntake.zendd_work_order_intake_id, "work_order_rows"],
    ["command_evidence", commandBridge.zendd_command_evidence_execution_bridge_id, "command_execution_packet_rows"],
    ["protected_actions", protectedEscalation.zendd_protected_action_escalation_id, "protected_action_escalation_packet_rows"],
    ["human_gates", protectedEscalation.zendd_protected_action_escalation_id, "protected_action_human_gate_rows"],
    ["recovery_incidents", recoveryIncidents.zendd_recovery_incident_drafts_id, "recovery_incident_draft_rows"],
    ["incident_operator_surface", recoveryIncidents.zendd_recovery_incident_drafts_id, "operator_incident_surface_rows"],
    ["recovery_receipts", recoveryIncidents.zendd_recovery_incident_drafts_id, "recovery_receipt_draft_rows"],
  ];
  return bindings.map(([bindingKey, sourceArtifactRef, sourceCollection], index) => ({
    schema_version: "zendd-active-dashboard-data-binding-row.v1",
    phase_slot: "P969-P970",
    row_id: `zendd-active-dashboard-data-binding.row.${String(index + 1).padStart(2, "0")}`,
    binding_key: bindingKey,
    source_artifact_ref: sourceArtifactRef,
    source_collection: sourceCollection,
    binding_status: "ready_read_only",
    stable_ref_required: true,
    raw_payload_materialized: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    next_allowed_action: "refresh dashboard only by regenerating deterministic Hermes artifacts",
  }));
}

function buildDashboardMissingInputRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents }) {
  const rows = [];
  for (const row of workOrderIntake.protected_work_order_block_rows) {
    rows.push(missingInputRow("work_order", row.work_order_id, row.evidence_ref, row.human_receipt_ref, row.hard_gate_ref, ["human_receipt", "protected_action_approval"], row.next_allowed_action, row.responsible_owner));
  }
  for (const row of commandBridge.protected_command_execution_block_rows) {
    rows.push(missingInputRow("command_evidence", row.command_execution_block_id, row.command_execution_evidence_ref, row.documented_human_gate_ref, row.hard_gate_ref, ["command_execution_evidence", "human_gate", "rollback_target"], row.next_allowed_action, row.responsible_owner));
  }
  for (const row of protectedEscalation.protected_action_human_gate_rows) {
    rows.push(missingInputRow("protected_human_gate", row.human_gate_ref, row.escalation_packet_ref, row.human_receipt_ref, row.human_gate_ref, ["human_receipt_payload", "validated_receipt"], row.next_allowed_action, row.responsible_owner));
  }
  for (const row of recoveryIncidents.operator_incident_surface_rows) {
    rows.push(missingInputRow("recovery_incident", row.incident_draft_ref, row.incident_draft_ref, row.missing_receipt, row.hard_gate_ref, row.missing_evidence, row.next_allowed_action, row.responsible_owner));
  }
  return rows.map((row, index) => ({
    schema_version: "zendd-active-dashboard-missing-input-row.v1",
    phase_slot: "P971-P973",
    row_id: `zendd-active-dashboard-missing-input.row.${String(index + 1).padStart(3, "0")}`,
    ...row,
    current_verdict: "blocked",
    block_reason: "missing_evidence_or_human_receipt",
    action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
  }));
}

function missingInputRow(sourceType, sourceRef, evidenceRef, humanReceiptRef, hardGateRef, missingFields, nextAllowedAction, responsibleOwner) {
  return {
    project_id: "project.zendd",
    source_type: sourceType,
    source_ref: sourceRef,
    evidence_ref: evidenceRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    missing_fields: missingFields.filter(Boolean),
    responsible_owner: responsibleOwner ?? "integration_operator",
    next_allowed_action: nextAllowedAction,
  };
}

function buildDashboardNextActionRows(sources) {
  return nextActionSourceRows(sources).map((source, index) => ({
    schema_version: "zendd-active-dashboard-next-action-row.v1",
    phase_slot: "P974-P976",
    row_id: `zendd-active-dashboard-next-action.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    source_type: source.source_type,
    source_ref: source.source_ref,
    current_verdict: source.current_verdict ?? "blocked",
    block_reason: source.block_reason ?? "action_requires_evidence_review_or_receipt",
    responsible_owner: source.responsible_owner ?? "integration_operator",
    next_allowed_action: source.next_allowed_action,
    action_execution_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    client_delivery_allowed_now: false,
  }));
}

function nextActionSourceRows({ workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents }) {
  return [
    ...workOrderIntake.work_order_rows.map((row) => ({ source_type: "work_order", source_ref: row.work_order_id, current_verdict: row.current_verdict, block_reason: row.block_reason, responsible_owner: row.responsible_owner, next_allowed_action: row.next_allowed_action })),
    ...commandBridge.protected_command_execution_block_rows.map((row) => ({ source_type: "command_execution_block", source_ref: row.command_execution_block_id, current_verdict: row.current_verdict, block_reason: row.block_reason, responsible_owner: row.responsible_owner, next_allowed_action: row.next_allowed_action })),
    ...protectedEscalation.protected_action_escalation_packet_rows.map((row) => ({ source_type: "protected_action_packet", source_ref: row.escalation_packet_ref, current_verdict: row.current_verdict, block_reason: row.block_reason, responsible_owner: row.responsible_owner, next_allowed_action: row.next_allowed_action })),
    ...recoveryIncidents.recovery_incident_draft_rows.map((row) => ({ source_type: "recovery_incident", source_ref: row.incident_draft_ref, current_verdict: row.current_verdict, block_reason: row.block_reason, responsible_owner: row.responsible_owner, next_allowed_action: row.next_allowed_action })),
  ].filter((row) => row.next_allowed_action);
}

function buildDashboardUiArtifactRows() {
  const artifacts = [
    ["active_dashboard_html", "artifacts/zendd-active-operator-dashboard/latest/active-dashboard.html"],
    ["active_dashboard_css", "artifacts/zendd-active-operator-dashboard/latest/active-dashboard.css"],
    ["active_dashboard_json", "artifacts/zendd-active-operator-dashboard/latest/zendd-active-operator-dashboard.json"],
    ["active_dashboard_api_manifest", "artifacts/zendd-active-operator-dashboard/latest/active-dashboard-api-route-rows.json"],
  ];
  return artifacts.map(([artifactKey, artifactRef], index) => ({
    schema_version: "zendd-active-dashboard-ui-artifact-row.v1",
    phase_slot: "P977",
    row_id: `zendd-active-dashboard-ui-artifact.row.${String(index + 1).padStart(2, "0")}`,
    artifact_key: artifactKey,
    artifact_ref: artifactRef,
    artifact_status: "ready_deterministic_artifact",
    read_only: true,
    server_started: false,
    route_mutation_performed: false,
    zendd_file_write_allowed_now: false,
    next_allowed_action: "open or serve artifact read-only; do not use as mutation source of truth",
  }));
}

function buildFailClosedRows({ policy, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows }) {
  const guardedRows = [...widgetRows, ...apiRows, ...bindingRows, ...missingRows, ...nextActionRows, ...uiArtifactRows];
  const rows = [
    ["frontend_shell_ready", frontendShell.validation.valid && frontendShell.summary.zendd_frontend_operation_shell_status === "ready_for_zendd_frontend_operation_shell", "P761-P780 frontend shell is ready.", "repair frontend shell"],
    ["work_order_ready", workOrderIntake.validation.valid && workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake", "P781-P800 work order intake is ready.", "repair work order intake"],
    ["command_bridge_ready", commandBridge.validation.valid && commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "P821-P840 command bridge is ready.", "repair command bridge"],
    ["protected_escalation_ready", protectedEscalation.validation.valid && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation", "P841-P860 protected escalation is ready.", "repair protected escalation"],
    ["recovery_incidents_ready", recoveryIncidents.validation.valid && recoveryIncidents.summary.zendd_recovery_incident_drafts_status === "ready_for_zendd_recovery_incident_drafts", "P941-P960 recovery incidents are ready.", "repair recovery incident drafts"],
    ["widgets_ready", widgetRows.length >= 7 && widgetRows.every(documentedWidget), "Dashboard widgets are read-only.", "complete dashboard widgets"],
    ["api_routes_read_only", apiRows.length >= 7 && apiRows.every(documentedApiRoute), "Dashboard API routes are GET-only projections.", "complete API route rows"],
    ["missing_and_next_actions_visible", missingRows.length >= 10 && nextActionRows.length >= missingRows.length && missingRows.every(documentedMissingInput) && nextActionRows.every(documentedNextAction), "Missing inputs and next actions are visible.", "complete missing input and next action rows"],
    ["ui_artifacts_read_only", uiArtifactRows.length >= 4 && uiArtifactRows.every(documentedUiArtifact), "UI artifacts are deterministic and read-only.", "complete UI artifact rows"],
    ["no_dashboard_execution_or_mutation", noDashboardMutation(policy) && guardedRows.every(noDashboardMutation), "Dashboard starts no server and performs no mutation, execution, receipt application, pass promotion, raw copy, or secret read.", "restore read-only dashboard boundary"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-active-dashboard-fail-closed-row.v1",
    phase_slot: "P978-P979",
    row_id: `zendd-active-dashboard-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.active_dashboard.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    server_started: false,
    route_mutation_performed: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_active_dashboard_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ policy, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows }) {
  const ready = frontendShell.validation.valid
    && frontendShell.summary.zendd_frontend_operation_shell_status === "ready_for_zendd_frontend_operation_shell"
    && workOrderIntake.validation.valid
    && workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake"
    && commandBridge.validation.valid
    && commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge"
    && protectedEscalation.validation.valid
    && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation"
    && recoveryIncidents.validation.valid
    && recoveryIncidents.summary.zendd_recovery_incident_drafts_status === "ready_for_zendd_recovery_incident_drafts"
    && policy.active_dashboard_surface_creation_allowed
    && noDashboardMutation(policy)
    && widgetRows.every(documentedWidget)
    && apiRows.every(documentedApiRoute)
    && bindingRows.every(documentedBinding)
    && missingRows.every(documentedMissingInput)
    && nextActionRows.every(documentedNextAction)
    && uiArtifactRows.every(documentedUiArtifact)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-active-dashboard-closeout-row.v1",
    phase_slot: "P980",
    row_id: "zendd-active-dashboard-closeout.p980",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    active_operator_dashboard_ready: ready,
    active_dashboard_widget_count: widgetRows.length,
    active_dashboard_api_route_count: apiRows.length,
    active_dashboard_data_binding_count: bindingRows.length,
    active_dashboard_missing_input_count: missingRows.length,
    active_dashboard_next_action_count: nextActionRows.length,
    active_dashboard_ui_artifact_count: uiArtifactRows.length,
    server_started: false,
    route_mutation_performed: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    client_delivery_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P981-P1000 development freeze cockpit without dashboard mutation",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, designTokenSource, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-active-operator-dashboard-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    frontend_shell_command_name: FRONTEND_SHELL_COMMAND_NAME,
    work_order_command_name: WORK_ORDER_COMMAND_NAME,
    command_bridge_command_name: COMMAND_BRIDGE_COMMAND_NAME,
    protected_escalation_command_name: PROTECTED_ESCALATION_COMMAND_NAME,
    recovery_incident_command_name: RECOVERY_INCIDENT_COMMAND_NAME,
    source_frontend_operation_shell_status: frontendShell.summary.zendd_frontend_operation_shell_status,
    source_work_order_intake_status: workOrderIntake.summary.zendd_work_order_intake_status,
    source_command_evidence_execution_bridge_status: commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    source_recovery_incident_drafts_status: recoveryIncidents.summary.zendd_recovery_incident_drafts_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    design_token_hash: designTokenSource.content_hash,
    policy_hash: hashValue(policy),
    widget_rows_hash: hashRows(widgetRows, ["widget_id", "display_count", "widget_status"]),
    api_rows_hash: hashRows(apiRows, ["route_path", "mutating_method_allowed", "server_started"]),
    binding_rows_hash: hashRows(bindingRows, ["binding_key", "source_artifact_ref", "raw_payload_materialized"]),
    missing_rows_hash: hashRows(missingRows, ["source_type", "source_ref", "missing_fields"]),
    next_action_rows_hash: hashRows(nextActionRows, ["source_type", "source_ref", "next_allowed_action"]),
    ui_artifact_rows_hash: hashRows(uiArtifactRows, ["artifact_key", "artifact_ref", "read_only"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "active_operator_dashboard_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p961_frontend_shell_ready", "P961", frontendShell.validation.valid && frontendShell.summary.zendd_frontend_operation_shell_status === "ready_for_zendd_frontend_operation_shell", "P761-P780 frontend shell is ready.", "repair frontend shell"),
    gateRow("p962_sources_ready", "P962-P963", workOrderIntake.validation.valid && commandBridge.validation.valid && protectedEscalation.validation.valid && recoveryIncidents.validation.valid, "Dashboard source artifacts are ready.", "repair dashboard sources"),
    gateRow("p964_widgets_ready", "P964-P966", widgetRows.length >= 7 && widgetRows.every(documentedWidget), "Dashboard widgets cover work orders, blocked actions, missing inputs, command evidence, incidents, and next actions.", "complete widget rows"),
    gateRow("p967_api_read_only", "P967-P968", apiRows.length >= 7 && apiRows.every(documentedApiRoute), "API routes are GET-only projections and start no server.", "complete API route rows"),
    gateRow("p969_bindings_ready", "P969-P970", bindingRows.length >= 7 && bindingRows.every(documentedBinding), "Data bindings point to deterministic artifacts only.", "complete data binding rows"),
    gateRow("p971_missing_inputs", "P971-P973", missingRows.length >= 10 && missingRows.every(documentedMissingInput), "Missing evidence and receipt rows are visible.", "complete missing input rows"),
    gateRow("p974_next_actions", "P974-P976", nextActionRows.length >= missingRows.length && nextActionRows.every(documentedNextAction), "Next actions are visible and not executable.", "complete next action rows"),
    gateRow("p977_ui_artifacts", "P977", uiArtifactRows.length >= 4 && uiArtifactRows.every(documentedUiArtifact), "UI artifacts are deterministic and read-only.", "complete UI artifact rows"),
    gateRow("p978_fail_closed", "P978-P979", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove dashboard is not a mutation surface.", "complete fail-closed rows"),
    gateRow("p980_closeout_ready", "P980", closeoutRows.every((row) => row.closeout_status === READY_STATUS && row.active_operator_dashboard_ready), "P961-P980 closes with active operator dashboard ready.", "complete active dashboard closeout"),
    gateRow("package_script_registered", "P980", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P980", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P980", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P961-P980") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P961-P980.", "record P961-P980 in phase ledger"),
    gateRow("p980_no_mutation", "P980", noDashboardMutation(policy) && [...widgetRows, ...apiRows, ...bindingRows, ...missingRows, ...nextActionRows, ...uiArtifactRows].every(noDashboardMutation), "Dashboard performs no server start, route mutation, protected execution, receipt application, pass promotion, raw copy, or secret read.", "restore dashboard no-mutation boundary"),
  ];
}

function buildValidationItems({ gateRows, policy, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "active_dashboard_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_mutation", "dashboard_boundary", noDashboardMutation(policy), "Dashboard policy is read-only."));
  items.push(validationItem("widgets.ready", "dashboard_surface", widgetRows.every(documentedWidget), "Widgets are ready."));
  items.push(validationItem("api.read_only", "dashboard_surface", apiRows.every(documentedApiRoute), "API routes are read-only."));
  items.push(validationItem("bindings.reference_only", "dashboard_surface", bindingRows.every(documentedBinding), "Data bindings are reference-only."));
  items.push(validationItem("missing.visible", "dashboard_surface", missingRows.every(documentedMissingInput), "Missing input rows are visible."));
  items.push(validationItem("next_actions.not_executed", "dashboard_surface", nextActionRows.every(documentedNextAction), "Next actions are not executed."));
  items.push(validationItem("ui.read_only", "dashboard_surface", uiArtifactRows.every(documentedUiArtifact), "UI artifacts are read-only."));
  items.push(validationItem("fail_closed.pass", "dashboard_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS), "Closeout is ready."));
  return items;
}

function buildSummary({ frontendShell, workOrderIntake, commandBridge, protectedEscalation, recoveryIncidents, widgetRows, apiRows, bindingRows, missingRows, nextActionRows, uiArtifactRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_active_operator_dashboard_status: validation.valid ? READY_STATUS : "documented_block_pending_active_operator_dashboard",
    source_frontend_operation_shell_status: frontendShell.summary.zendd_frontend_operation_shell_status,
    source_work_order_intake_status: workOrderIntake.summary.zendd_work_order_intake_status,
    source_command_evidence_execution_bridge_status: commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    source_recovery_incident_drafts_status: recoveryIncidents.summary.zendd_recovery_incident_drafts_status,
    active_dashboard_widget_count: widgetRows.length,
    active_dashboard_api_route_count: apiRows.length,
    active_dashboard_data_binding_count: bindingRows.length,
    active_dashboard_missing_input_count: missingRows.length,
    active_dashboard_next_action_count: nextActionRows.length,
    active_dashboard_ui_artifact_count: uiArtifactRows.length,
    active_dashboard_fail_closed_count: failClosedRows.length,
    active_operator_dashboard_ready: closeoutRows.every((row) => row.active_operator_dashboard_ready),
    server_started: false,
    route_mutation_performed: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedWidget(row) {
  return row.widget_status === "ready_read_only"
    && row.current_verdict === "pass"
    && row.read_only === true
    && row.display_count >= 0
    && noDashboardMutation(row);
}

function documentedApiRoute(row) {
  return row.route_status === "ready_read_only_projection"
    && Array.isArray(row.allowed_methods)
    && row.allowed_methods.length === 1
    && row.allowed_methods[0] === "GET"
    && row.mutating_method_allowed === false
    && noDashboardMutation(row);
}

function documentedBinding(row) {
  return row.binding_status === "ready_read_only"
    && Boolean(row.source_artifact_ref)
    && Boolean(row.source_collection)
    && row.stable_ref_required === true
    && row.raw_payload_materialized === false
    && noDashboardMutation(row);
}

function documentedMissingInput(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.source_ref)
    && Boolean(row.hard_gate_ref)
    && Array.isArray(row.missing_fields)
    && row.missing_fields.length >= 1
    && Boolean(row.next_allowed_action)
    && noDashboardMutation(row);
}

function documentedNextAction(row) {
  return Boolean(row.source_ref)
    && Boolean(row.next_allowed_action)
    && row.action_execution_allowed_now === false
    && noDashboardMutation(row);
}

function documentedUiArtifact(row) {
  return row.artifact_status === "ready_deterministic_artifact"
    && row.read_only === true
    && Boolean(row.artifact_ref)
    && noDashboardMutation(row);
}

function noDashboardMutation(row) {
  return row.server_started !== true
    && row.route_mutation_performed !== true
    && row.zendd_file_write_allowed_now !== true
    && row.command_execution_allowed_now !== true
    && row.protected_action_execution_allowed_now !== true
    && row.recovery_execution_allowed_now !== true
    && row.rollback_execution_allowed_now !== true
    && row.receipt_application_allowed_now !== true
    && row.approval_application_allowed_now !== true
    && row.pass_promotion_allowed_now !== true
    && row.client_delivery_allowed_now !== true
    && row.raw_vdr_or_client_material_copy_allowed_now !== true
    && row.raw_log_storage_allowed !== true
    && row.secret_read_allowed_now !== true;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-active-dashboard-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_active_dashboard_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.developmentPhaseLedgerPath,
    design_tokens_path: options.designTokensPath ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.designTokensPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_ACTIVE_OPERATOR_DASHBOARD_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--design-tokens") {
      args.designTokensPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P961-P980 Zendd active operator dashboard artifact and read-only API
projection contract. --check validates without starting a server, mutating
routes, executing commands or protected actions, applying receipts, promoting
PASS, copying raw material, storing raw logs, or reading secrets.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function renderDashboardHtml(result) {
  const summary = result.summary;
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "  <title>Zendd Active Operator Dashboard</title>",
    "  <link rel=\"stylesheet\" href=\"active-dashboard.css\">",
    "</head>",
    "<body>",
    "  <main>",
    "    <header class=\"topbar\">",
    "      <div>",
    "        <p class=\"eyebrow\">project.zendd</p>",
    "        <h1>Active Operator Dashboard</h1>",
    "      </div>",
    `      <span class=\"status\">${escapeHtml(summary.zendd_active_operator_dashboard_status)}</span>`,
    "    </header>",
    "    <section class=\"metrics\" aria-label=\"Dashboard metrics\">",
    `      ${metricCard("Widgets", summary.active_dashboard_widget_count)}`,
    `      ${metricCard("Missing Inputs", summary.active_dashboard_missing_input_count)}`,
    `      ${metricCard("Next Actions", summary.active_dashboard_next_action_count)}`,
    `      ${metricCard("Server Started", String(summary.server_started))}`,
    "    </section>",
    "    <section class=\"panel\">",
    "      <h2>Queues</h2>",
    "      <table>",
    "        <thead><tr><th>Widget</th><th>Count</th><th>Status</th><th>Action</th></tr></thead>",
    "        <tbody>",
    result.active_dashboard_widget_rows.map((row) => `          <tr><td>${escapeHtml(row.title)}</td><td>${row.display_count}</td><td>${escapeHtml(row.widget_status)}</td><td>${escapeHtml(row.next_allowed_action)}</td></tr>`).join("\n"),
    "        </tbody>",
    "      </table>",
    "    </section>",
    "    <section class=\"panel\">",
    "      <h2>Next Actions</h2>",
    "      <table>",
    "        <thead><tr><th>Source</th><th>Verdict</th><th>Owner</th><th>Next</th></tr></thead>",
    "        <tbody>",
    result.active_dashboard_next_action_rows.slice(0, 24).map((row) => `          <tr><td>${escapeHtml(row.source_type)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.responsible_owner)}</td><td>${escapeHtml(row.next_allowed_action)}</td></tr>`).join("\n"),
    "        </tbody>",
    "      </table>",
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function renderDashboardCss(source) {
  const light = source?.themes?.light ?? {};
  const dark = source?.themes?.dark ?? {};
  return `
:root {
  color-scheme: dark light;
  --background: ${dark.background ?? "#171717"};
  --surface: ${dark.surface ?? "#121212"};
  --surface-raised: ${dark.surface_raised ?? "#1f1f1f"};
  --border: ${dark.border ?? "#2e2e2e"};
  --text: ${dark.text_primary ?? "#fafafa"};
  --muted: ${dark.text_secondary ?? "#898989"};
  --accent: ${dark.accent ?? "#3ecf8e"};
  --blocked: ${dark.blocked ?? "#fb7185"};
  --radius: ${source?.radius?.md ?? "8px"};
  font-family: Inter, Arial, sans-serif;
}
@media (prefers-color-scheme: light) {
  :root {
    --background: ${light.background ?? "#ffffff"};
    --surface: ${light.surface ?? "#fcfcfc"};
    --surface-raised: ${light.surface_raised ?? "#f6f7f8"};
    --border: ${light.border ?? "#dfdfdf"};
    --text: ${light.text_primary ?? "#171717"};
    --muted: ${light.text_secondary ?? "#707070"};
    --accent: ${light.accent ?? "#3fcf8e"};
    --blocked: ${light.blocked ?? "#f43f5e"};
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--text); font-size: 14px; line-height: 1.5; }
main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 40px; }
.topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 0 20px; border-bottom: 1px solid var(--border); }
.eyebrow { margin: 0 0 4px; color: var(--accent); font-size: 12px; text-transform: uppercase; }
h1 { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 500; }
h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
.status { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; color: var(--accent); background: var(--surface); white-space: nowrap; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.metric { min-height: 84px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.metric strong { display: block; font-size: 22px; line-height: 1.2; margin-bottom: 4px; }
.metric span { color: var(--muted); font-size: 12px; }
.panel { margin-top: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); padding: 14px; overflow: auto; }
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th, td { padding: 9px 8px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { color: var(--muted); font-size: 12px; font-weight: 500; }
td { color: var(--text); }
@media (max-width: 760px) {
  main { width: min(100vw - 20px, 1180px); padding-top: 12px; }
  .topbar { flex-direction: column; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
}

function metricCard(label, value) {
  return `<article class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></article>`;
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Active Operator Dashboard Summary",
    "",
    `- Status: ${summary.zendd_active_operator_dashboard_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Widgets: ${summary.active_dashboard_widget_count}`,
    `- API routes: ${summary.active_dashboard_api_route_count}`,
    `- Missing inputs: ${summary.active_dashboard_missing_input_count}`,
    `- Next actions: ${summary.active_dashboard_next_action_count}`,
    `- Server started: ${summary.server_started}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function serializableResult(result) {
  const { markdown, html, css, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
