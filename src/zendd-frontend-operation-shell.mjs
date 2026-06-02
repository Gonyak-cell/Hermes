import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddPhysicalIntegrationDecision } from "./zendd-physical-integration-decision.mjs";

export const DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_OUT_DIR = "artifacts/zendd-frontend-operation-shell/latest";
export const DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS = {
  schemaPath: "schemas/zendd-frontend-operation-shell.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  designTokensPath: "configs/hermes/operator-design-tokens.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-frontend-operation-shell";
const PHYSICAL_INTEGRATION_COMMAND_NAME = "project:zendd-physical-integration-decision";
const SCHEMA_VERSION = "zendd-frontend-operation-shell.v1";
const CAPABILITY_ID = "project.zendd.frontend_operation_shell";
const PHASE_RANGE = "P761-P780";
const PHASE_SLOT = "P761";
const PREVIOUS_PHASE_SLOT = "P760";
const NEXT_PHASE_SLOT = "P781";
const READY_STATUS = "ready_for_zendd_frontend_operation_shell";

export async function runZenddFrontendOperationShell(options = {}) {
  const result = await buildZenddFrontendOperationShell(options);
  if (options.write !== false) await writeZenddFrontendOperationShell(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd frontend operation shell failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddFrontendOperationShell(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const designTokenSource = await readJsonSource(inputs.design_tokens_path);
  const physicalIntegration = await buildZenddPhysicalIntegrationDecision({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });

  const phasePlanRows = buildPhasePlanRows();
  const designTokenRows = buildDesignTokenRows(designTokenSource.data);
  const operationContractRows = buildOperationContractRows(physicalIntegration);
  const frontendShellRows = buildFrontendShellRows();
  const routeSurfaceRows = buildRouteSurfaceRows();
  const protectedMutationBlockRows = buildProtectedMutationBlockRows();
  const closeoutRows = buildCloseoutRows({ physicalIntegration, designTokenRows, phasePlanRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, designTokenSource, physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, designTokenSource, physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const html = renderOperatorShellHtml({ generatedAt, physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows });
  const css = renderOperatorShellCss(designTokenSource.data);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_frontend_operation_shell_id: `zendd-frontend-operation-shell.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    frontend_operation_anchor: anchor,
    physical_integration_summary: physicalIntegration.summary,
    phase_plan_rows: phasePlanRows,
    design_token_rows: designTokenRows,
    operation_contract_rows: operationContractRows,
    frontend_shell_rows: frontendShellRows,
    route_surface_rows: routeSurfaceRows,
    protected_mutation_block_rows: protectedMutationBlockRows,
    frontend_operation_closeout_rows: closeoutRows,
    frontend_operation_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_frontend_operation_shell")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows, validation: result.validation });
  result.summary.zendd_frontend_operation_shell_id = result.zendd_frontend_operation_shell_id;
  return { ...result, html, css, markdown: renderMarkdown(result) };
}

export async function writeZenddFrontendOperationShell(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-frontend-operation-shell.json"), serializableResult(result));
  await writeJson(path.join(outDir, "phase-plan-rows.json"), collectionEnvelope("zendd-development-phase-plan-rows.v1", "phase_plan_rows", result.phase_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "design-token-rows.json"), collectionEnvelope("hermes-operator-design-token-rows.v1", "design_token_rows", result.design_token_rows, result.generated_at));
  await writeJson(path.join(outDir, "operation-contract-rows.json"), collectionEnvelope("zendd-operation-contract-rows.v1", "operation_contract_rows", result.operation_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "frontend-shell-rows.json"), collectionEnvelope("zendd-frontend-shell-rows.v1", "frontend_shell_rows", result.frontend_shell_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-surface-rows.json"), collectionEnvelope("zendd-route-surface-rows.v1", "route_surface_rows", result.route_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-mutation-block-rows.json"), collectionEnvelope("zendd-protected-mutation-block-rows.v1", "protected_mutation_block_rows", result.protected_mutation_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "frontend-operation-closeout-rows.json"), collectionEnvelope("zendd-frontend-operation-closeout-rows.v1", "frontend_operation_closeout_rows", result.frontend_operation_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "frontend-operation-gate-rows.json"), collectionEnvelope("zendd-frontend-operation-gate-rows.v1", "frontend_operation_gate_rows", result.frontend_operation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-frontend-operation-shell-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "operator-shell.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "operator-shell.css"), result.css, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddFrontendOperationShellCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddFrontendOperationShell(args);
    console.log(`Zendd frontend operation shell ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_frontend_operation_shell_status}`);
    console.log(`Selected mode: ${result.summary.selected_integration_mode}`);
    console.log(`Design tokens: ${result.summary.design_token_row_count}`);
    console.log(`Phase plan rows: ${result.summary.phase_plan_row_count}`);
    console.log(`Route surfaces: ${result.summary.route_surface_row_count}`);
    console.log(`Protected mutation blocks: ${result.summary.protected_mutation_block_count}`);
    console.log(`Static shell ready: ${result.summary.static_shell_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPhasePlanRows() {
  const rows = [
    ["P761-P780", "Frontend Shell And External Adapter Operation", "current", "Normalize design tokens and create a read-only Zendd operator shell."],
    ["P781-P800", "Work Order Intake", "planned", "Convert Zendd requests into evidence-backed work order rows."],
    ["P801-P820", "Safe Patch Lane", "planned", "Open a limited patch lane while protected actions remain blocked."],
    ["P821-P840", "Command Evidence Execution Bridge", "planned", "Run allowed Zendd verification commands and bind evidence refs."],
    ["P841-P860", "Protected Action Escalation", "planned", "Escalate DB, release, receipt, and client-output actions behind human gates."],
    ["P861-P880", "Diff Review And Rollback Binding", "planned", "Bind Zendd diffs to review packets, rollback targets, and tests."],
    ["P881-P900", "Release Candidate Sandbox", "planned", "Model sandbox release candidates without packaging or publishing."],
    ["P901-P920", "VDR/LDD Workflow Adapter", "planned", "Bridge VDR/LDD workflows by stable refs and redacted summaries."],
    ["P921-P940", "Human Receipt Intake For Zendd", "planned", "Add Zendd receipt templates, queues, validation, and quarantine rows."],
    ["P941-P960", "Recovery And Incident Drafts", "planned", "Draft recovery scenarios without executing recovery or rollback."],
    ["P961-P980", "Active Operator Dashboard", "planned", "Promote the shell into dashboard/API surfaces over deterministic artifacts."],
    ["P981-P1000", "Development Freeze Cockpit", "planned", "Re-adjudicate P761-P980 claims as PASS or documented BLOCK."],
  ];
  return rows.map(([phaseRange, phaseTitle, phaseStatus, purpose], index) => ({
    schema_version: "zendd-development-phase-plan-row.v1",
    row_id: `zendd-development-phase-plan.row.${String(index + 1).padStart(2, "0")}`,
    phase_range: phaseRange,
    phase_title: phaseTitle,
    phase_status: phaseStatus,
    purpose,
    operator_surface_ref: `operator-surface.zendd.${normalizeKey(phaseTitle)}`,
    safety_boundary: "external_adapter_reference_only_until_evidence_review_receipt_and_rollback_allow_mutation",
    next_allowed_action: phaseStatus === "current" ? "validate frontend shell and external adapter operation contract" : `advance only after ${phaseRange} implementation is explicitly opened`,
  }));
}

function buildDesignTokenRows(source) {
  if (!source) return [];
  const rows = [];
  const designRef = source.design_profile_id ?? "hermes.operator.supabase_inspired.v1";
  for (const [theme, tokens] of Object.entries(source.themes ?? {})) {
    for (const [tokenName, tokenValue] of Object.entries(tokens)) {
      rows.push(tokenRow("color", theme, tokenName, tokenValue, designRef));
    }
  }
  for (const [tokenName, tokenValue] of Object.entries(source.spacing ?? {})) rows.push(tokenRow("spacing", "all", tokenName, tokenValue, designRef));
  for (const [tokenName, tokenValue] of Object.entries(source.radius ?? {})) rows.push(tokenRow("radius", "all", tokenName, tokenValue, designRef));
  for (const [tokenName, token] of Object.entries(source.typography ?? {})) {
    rows.push(tokenRow("typography", "all", `${tokenName}.font_family`, fontStack(token.font_family, source.normalization_policy?.font_fallbacks), designRef));
    rows.push(tokenRow("typography", "all", `${tokenName}.font_size`, token.font_size, designRef));
    rows.push(tokenRow("typography", "all", `${tokenName}.line_height`, token.line_height, designRef));
    rows.push(tokenRow("typography", "all", `${tokenName}.letter_spacing`, normalizeLetterSpacing(token.letter_spacing), designRef));
  }
  return rows.map((row, index) => ({ ...row, row_id: `hermes-operator-design-token.row.${String(index + 1).padStart(2, "0")}` }));
}

function tokenRow(group, theme, name, value, sourceRef) {
  return {
    schema_version: "hermes-operator-design-token-row.v1",
    token_id: `hermes.${group}.${theme}.${normalizeKey(name)}`,
    token_group: group,
    theme,
    token_name: name,
    token_value: String(value),
    source_design_ref: sourceRef,
    normalized: true,
    ui_safe: true,
  };
}

function buildOperationContractRows(physicalIntegration) {
  const sourceRef = physicalIntegration.zendd_physical_integration_decision_id;
  const rows = [
    ["external_adapter_status", "pass", "Show selected external adapter and movement boundary."],
    ["phase_plan", "pass", "Show P761-P1000 plan without executing future phases."],
    ["claim_matrix", "pass", "Show PASS/BLOCK, evidence, owner, and next action projections."],
    ["work_order_draft_queue", "blocked", "Work order intake is not active until P781-P800."],
    ["command_evidence_projection", "blocked", "Command execution bridge is not active until P821-P840."],
    ["protected_action_queue", "blocked", "Protected actions require escalation and receipts before execution."],
  ];
  return rows.map(([surface, verdict, nextAllowedAction], index) => ({
    schema_version: "zendd-operation-contract-row.v1",
    row_id: `zendd-operation-contract.row.${String(index + 1).padStart(2, "0")}`,
    phase_slot: "P763",
    project_id: "project.zendd",
    operation_surface: surface,
    surface_status: verdict === "pass" ? "ready_read_only" : "documented_block_pending_future_phase",
    read_only: true,
    evidence_ref: sourceRef,
    reviewer_ref: "reviewer.integration_operator",
    current_verdict: verdict,
    block_reason: verdict === "blocked" ? "future_phase_not_opened" : null,
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildFrontendShellRows() {
  const rows = [
    ["design_token_contract", "artifacts/zendd-frontend-operation-shell/latest/design-token-rows.json"],
    ["status_band", "artifacts/zendd-frontend-operation-shell/latest/operator-shell.html#status"],
    ["phase_plan_table", "artifacts/zendd-frontend-operation-shell/latest/operator-shell.html#phase-plan"],
    ["claim_matrix", "artifacts/zendd-frontend-operation-shell/latest/operator-shell.html#claim-matrix"],
    ["blocked_action_queue", "artifacts/zendd-frontend-operation-shell/latest/operator-shell.html#blocked-actions"],
    ["next_action_panel", "artifacts/zendd-frontend-operation-shell/latest/operator-shell.html#next-actions"],
  ];
  return rows.map(([surface, artifactRef], index) => ({
    schema_version: "zendd-frontend-shell-row.v1",
    row_id: `zendd-frontend-shell.row.${String(index + 1).padStart(2, "0")}`,
    phase_slot: "P764-P766",
    shell_surface: surface,
    shell_status: "ready_read_only_static_artifact",
    artifact_ref: artifactRef,
    read_only: true,
    mutation_allowed: false,
    next_allowed_action: "render shell from deterministic artifacts only",
  }));
}

function buildRouteSurfaceRows() {
  const rows = [
    ["/operator/zendd", "static_operator_shell"],
    ["/api/project-zendd/frontend-shell", "future_read_only_api"],
    ["/api/project-zendd/operation-contract", "future_read_only_api"],
    ["/api/project-zendd/development-phase-plan", "future_read_only_api"],
  ];
  return rows.map(([routePath, routeType], index) => ({
    schema_version: "zendd-route-surface-row.v1",
    row_id: `zendd-route-surface.row.${String(index + 1).padStart(2, "0")}`,
    phase_slot: "P767-P770",
    route_path: routePath,
    route_type: routeType,
    read_only: true,
    server_started: false,
    protected_action_execution_allowed: false,
    next_allowed_action: "register as read-only route contract in a future dashboard/API phase",
  }));
}

function buildProtectedMutationBlockRows() {
  const actions = [
    ["zendd_code_write", "safe_patch_lane_not_opened", "rollback-target.zendd.external_checkout"],
    ["raw_vdr_or_client_material_copy", "raw_material_boundary_forbids_copy", "rollback-target.zendd.raw_material_quarantine"],
    ["secret_or_env_read", "secret_boundary_forbids_raw_secret_reads", "rollback-target.zendd.secret_handle_boundary"],
    ["database_migration", "database_migration_requires_protected_work_order", "rollback-target.zendd.database_state"],
    ["release_or_package_execution", "release_package_requires_protected_receipt", "rollback-target.zendd.package_state"],
    ["human_receipt_application", "receipt_application_requires_future_validation_chain", "rollback-target.zendd.receipt_quarantine"],
    ["physical_code_movement", "p760_selected_external_adapter_and_blocked_physical_move", "rollback-target.zendd.integration_state"],
  ];
  return actions.map(([action, reason, rollbackTarget], index) => ({
    schema_version: "zendd-protected-mutation-block-row.v1",
    row_id: `zendd-protected-mutation-block.row.${String(index + 1).padStart(2, "0")}`,
    phase_slot: "P771-P775",
    protected_action: action,
    current_verdict: "blocked",
    block_reason: reason,
    responsible_owner: "integration_operator",
    rollback_target_ref: rollbackTarget,
    human_receipt_required: action !== "physical_code_movement",
    next_allowed_action: `open a scoped future work order before reconsidering ${action}`,
  }));
}

function buildCloseoutRows({ physicalIntegration, designTokenRows, phasePlanRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows }) {
  const ready = physicalIntegration.validation.valid
    && physicalIntegration.summary.zendd_physical_integration_decision_status === "external_adapter_selected_for_safe_operation"
    && designTokenRows.length >= 20
    && phasePlanRows.length >= 12
    && operationContractRows.every((row) => row.read_only)
    && frontendShellRows.every((row) => row.read_only && !row.mutation_allowed)
    && routeSurfaceRows.every((row) => row.read_only && !row.server_started && !row.protected_action_execution_allowed)
    && protectedMutationBlockRows.every(documentedBlock);
  return [{
    schema_version: "zendd-frontend-operation-closeout-row.v1",
    phase_slot: "P780",
    closeout_status: ready ? READY_STATUS : "blocked",
    static_shell_ready: ready,
    external_adapter_active: true,
    physical_code_move_allowed_now: false,
    zendd_mutation_allowed_now: false,
    raw_material_copy_allowed_now: false,
    protected_action_execution_allowed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P781-P800 work order intake after frontend shell validation remains green",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, designTokenSource, physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows }) {
  return {
    schema_version: "zendd-frontend-operation-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    physical_integration_command_name: PHYSICAL_INTEGRATION_COMMAND_NAME,
    source_physical_integration_id: physicalIntegration.zendd_physical_integration_decision_id,
    source_physical_integration_status: physicalIntegration.summary.zendd_physical_integration_decision_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    design_tokens_hash: designTokenSource.content_hash,
    phase_plan_rows_hash: hashRows(phasePlanRows, ["phase_range", "phase_title", "phase_status", "next_allowed_action"]),
    design_token_rows_hash: hashRows(designTokenRows, ["token_id", "token_value", "ui_safe"]),
    operation_contract_rows_hash: hashRows(operationContractRows, ["operation_surface", "current_verdict", "next_allowed_action"]),
    frontend_shell_rows_hash: hashRows(frontendShellRows, ["shell_surface", "artifact_ref", "mutation_allowed"]),
    route_surface_rows_hash: hashRows(routeSurfaceRows, ["route_path", "read_only", "server_started"]),
    protected_mutation_block_rows_hash: hashRows(protectedMutationBlockRows, ["protected_action", "current_verdict", "block_reason"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "static_shell_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, designTokenSource, physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p761_physical_integration_ready", "P761", physicalIntegration.validation.valid && physicalIntegration.summary.zendd_physical_integration_decision_status === "external_adapter_selected_for_safe_operation", "P760 physical integration decision selected the external adapter.", "repair P741-P760 physical integration decision"),
    gateRow("p762_design_tokens_normalized", "P762", designTokenSource.available && designTokenRows.length >= 20 && designTokenRows.every((row) => row.ui_safe), "Hermes operator design tokens are normalized.", "normalize attached design resources into Hermes tokens"),
    gateRow("p763_operation_contract_read_only", "P763", operationContractRows.length >= 5 && operationContractRows.every((row) => row.read_only), "External adapter operation contract is read-only.", "complete operation contract rows"),
    gateRow("p764_shell_rows_ready", "P764-P766", frontendShellRows.length >= 5 && frontendShellRows.every((row) => row.read_only && !row.mutation_allowed), "Frontend shell rows are ready and non-mutating.", "complete frontend shell rows"),
    gateRow("p767_routes_read_only", "P767-P770", routeSurfaceRows.length >= 4 && routeSurfaceRows.every((row) => row.read_only && !row.server_started), "Route surface rows are read-only contracts.", "complete route surface rows"),
    gateRow("p771_protected_mutations_blocked", "P771-P775", protectedMutationBlockRows.length >= 7 && protectedMutationBlockRows.every(documentedBlock), "Protected mutation rows are documented BLOCK.", "complete protected mutation block rows"),
    gateRow("p776_static_shell_ready", "P776-P779", closeoutRows.every((row) => row.static_shell_ready), "Static shell artifacts are ready.", "render static shell artifacts"),
    gateRow("p780_closeout_ready", "P780", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.zendd_mutation_allowed_now), "P761-P780 closes without Zendd mutation.", "complete frontend operation closeout"),
    gateRow("package_script_registered", "P780", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P780", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P780", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P761-P1000") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P761-P1000.", "record P761-P1000 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "frontend_operation_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("tokens.no_negative_letter_spacing", "design_token_boundary", designTokenRows.filter((row) => row.token_name.includes("letter_spacing")).every((row) => !String(row.token_value).startsWith("-") && row.token_value !== "undefined"), "Typography letter spacing is normalized."));
  items.push(validationItem("operation.read_only", "operation_boundary", operationContractRows.every((row) => row.read_only), "Operation contract is read-only."));
  items.push(validationItem("shell.no_mutation", "frontend_boundary", frontendShellRows.every((row) => row.read_only && !row.mutation_allowed), "Frontend shell cannot mutate Zendd."));
  items.push(validationItem("routes.no_server", "route_boundary", routeSurfaceRows.every((row) => row.read_only && !row.server_started && !row.protected_action_execution_allowed), "Route contracts do not start servers or execute protected actions."));
  items.push(validationItem("mutations.blocked", "protected_action_boundary", protectedMutationBlockRows.every(documentedBlock), "Protected mutations are documented BLOCK."));
  items.push(validationItem("closeout.safe", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.zendd_mutation_allowed_now && !row.protected_action_execution_allowed), "Closeout is ready without mutation."));
  return items;
}

function buildSummary({ physicalIntegration, phasePlanRows, designTokenRows, operationContractRows, frontendShellRows, routeSurfaceRows, protectedMutationBlockRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_frontend_operation_shell_status: validation.valid ? READY_STATUS : "documented_block_pending_frontend_operation_shell",
    zendd_project_root: physicalIntegration.summary.zendd_project_root,
    selected_integration_mode: physicalIntegration.summary.selected_integration_mode,
    phase_plan_row_count: phasePlanRows.length,
    design_token_row_count: designTokenRows.length,
    operation_contract_row_count: operationContractRows.length,
    frontend_shell_row_count: frontendShellRows.length,
    route_surface_row_count: routeSurfaceRows.length,
    protected_mutation_block_count: protectedMutationBlockRows.length,
    static_shell_ready: closeoutRows.every((row) => row.static_shell_ready),
    physical_code_move_allowed_now: false,
    zendd_mutation_allowed_now: false,
    raw_material_copy_allowed_now: false,
    protected_action_execution_allowed: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedBlock(row) {
  return row.current_verdict === "blocked" && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-frontend-operation-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_frontend_operation_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.developmentPhaseLedgerPath,
    design_tokens_path: options.designTokensPath ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.designTokensPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_FRONTEND_OPERATION_SHELL_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--design-tokens") {
      args.designTokensPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P761-P780 Zendd-Hermes frontend operation shell.
--check validates without writing artifacts, moving Zendd code, copying raw
material, reading secrets, running Zendd commands, applying receipts, starting
servers, or executing protected actions.
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

function renderOperatorShellCss(source) {
  const light = source?.themes?.light ?? {};
  const dark = source?.themes?.dark ?? {};
  return `:root {
  color-scheme: dark light;
  --hermes-bg: ${dark.background ?? "#171717"};
  --hermes-surface: ${dark.surface ?? "#121212"};
  --hermes-surface-raised: ${dark.surface_raised ?? "#1f1f1f"};
  --hermes-border: ${dark.border ?? "#2e2e2e"};
  --hermes-text: ${dark.text_primary ?? "#fafafa"};
  --hermes-text-secondary: ${dark.text_secondary ?? "#898989"};
  --hermes-text-muted: ${dark.text_muted ?? "#6f6f6f"};
  --hermes-accent: ${dark.accent ?? "#3ecf8e"};
  --hermes-pass: ${dark.pass ?? "#34d399"};
  --hermes-blocked: ${dark.blocked ?? "#fb7185"};
  --hermes-pending: ${dark.pending ?? "#f59e0b"};
  --hermes-radius: 8px;
  --hermes-font: "Circular", Inter, Arial, sans-serif;
  --hermes-code-font: "Source Code Pro", Menlo, monospace;
}

@media (prefers-color-scheme: light) {
  :root {
    --hermes-bg: ${light.background ?? "#ffffff"};
    --hermes-surface: ${light.surface ?? "#fcfcfc"};
    --hermes-surface-raised: ${light.surface_raised ?? "#f6f7f8"};
    --hermes-border: ${light.border ?? "#dfdfdf"};
    --hermes-text: ${light.text_primary ?? "#171717"};
    --hermes-text-secondary: ${light.text_secondary ?? "#707070"};
    --hermes-text-muted: ${light.text_muted ?? "#525252"};
    --hermes-accent: ${light.accent ?? "#3fcf8e"};
    --hermes-pass: ${light.pass ?? "#059669"};
    --hermes-blocked: ${light.blocked ?? "#f43f5e"};
    --hermes-pending: ${light.pending ?? "#d97706"};
  }
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--hermes-bg);
  color: var(--hermes-text);
  font-family: var(--hermes-font);
  font-size: 14px;
  letter-spacing: 0;
}
.shell { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--hermes-border);
  background: var(--hermes-surface);
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mark { width: 12px; height: 12px; border-radius: 50%; background: var(--hermes-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--hermes-accent) 14%, transparent); }
.brand-title { margin: 0; font-size: 16px; font-weight: 500; line-height: 20px; }
.brand-subtitle { margin: 0; color: var(--hermes-text-secondary); font-size: 12px; line-height: 16px; }
.topnav { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.nav-item { padding: 6px 10px; border: 1px solid var(--hermes-border); border-radius: var(--hermes-radius); color: var(--hermes-text-secondary); font-size: 12px; line-height: 16px; }
.content { width: min(1280px, 100%); margin: 0 auto; padding: 24px; }
.status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.metric { min-height: 92px; padding: 16px; border: 1px solid var(--hermes-border); border-radius: var(--hermes-radius); background: var(--hermes-surface); }
.metric-label { color: var(--hermes-text-secondary); font-size: 12px; line-height: 16px; }
.metric-value { margin-top: 10px; font-size: 20px; line-height: 28px; font-weight: 500; overflow-wrap: anywhere; }
.layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 16px; align-items: start; }
.panel { border: 1px solid var(--hermes-border); border-radius: var(--hermes-radius); background: var(--hermes-surface); overflow: hidden; margin-bottom: 16px; }
.panel-header { display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--hermes-border); }
.panel-title { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; }
.panel-meta { color: var(--hermes-text-muted); font-family: var(--hermes-code-font); font-size: 11px; line-height: 16px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--hermes-border); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { color: var(--hermes-text-secondary); font-size: 12px; line-height: 16px; font-weight: 500; }
td { color: var(--hermes-text); font-size: 13px; line-height: 18px; }
.status { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 999px; font-size: 12px; line-height: 16px; font-weight: 500; }
.status.pass { color: var(--hermes-pass); background: color-mix(in srgb, var(--hermes-pass) 12%, transparent); }
.status.blocked { color: var(--hermes-blocked); background: color-mix(in srgb, var(--hermes-blocked) 12%, transparent); }
.status.pending { color: var(--hermes-pending); background: color-mix(in srgb, var(--hermes-pending) 12%, transparent); }
.code { font-family: var(--hermes-code-font); font-size: 12px; letter-spacing: 1.2px; color: var(--hermes-text-secondary); }
@media (max-width: 900px) {
  .topbar { align-items: flex-start; flex-direction: column; padding: 16px; }
  .topnav { justify-content: flex-start; }
  .content { padding: 16px; }
  .status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .layout { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .status-grid { grid-template-columns: 1fr; }
  th, td { padding: 9px 10px; }
}
`;
}

function renderOperatorShellHtml({ generatedAt, physicalIntegration, phasePlanRows, operationContractRows, routeSurfaceRows, protectedMutationBlockRows }) {
  const metrics = [
    ["Selected mode", physicalIntegration.summary.selected_integration_mode, "pass"],
    ["Physical movement", "false", "blocked"],
    ["Zendd mutation", "false", "blocked"],
    ["Protected execution", "false", "blocked"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Zendd Operator</title>
  <link rel="stylesheet" href="./operator-shell.css">
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="mark"></div>
        <div>
          <h1 class="brand-title">Hermes Zendd Operator</h1>
          <p class="brand-subtitle">External adapter status</p>
        </div>
      </div>
      <nav class="topnav" aria-label="Zendd operator sections">
        <span class="nav-item">Status</span>
        <span class="nav-item">Plan</span>
        <span class="nav-item">Claims</span>
        <span class="nav-item">Blocks</span>
      </nav>
    </header>
    <main class="content">
      <section class="status-grid" id="status">
        ${metrics.map(([label, value, status]) => `<article class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><span class="status ${status}">${status.toUpperCase()}</span></article>`).join("\n        ")}
      </section>
      <section class="layout">
        <div>
          <section class="panel" id="phase-plan">
            <div class="panel-header"><h2 class="panel-title">Phase Plan</h2><span class="panel-meta">${escapeHtml(generatedAt)}</span></div>
            <table><thead><tr><th>Phase</th><th>Status</th><th>Surface</th></tr></thead><tbody>
              ${phasePlanRows.map((row) => `<tr><td>${escapeHtml(row.phase_range)}</td><td><span class="status ${row.phase_status === "current" ? "pass" : "pending"}">${escapeHtml(row.phase_status)}</span></td><td>${escapeHtml(row.phase_title)}</td></tr>`).join("\n              ")}
            </tbody></table>
          </section>
          <section class="panel" id="claim-matrix">
            <div class="panel-header"><h2 class="panel-title">Claim Matrix</h2><span class="panel-meta">read only</span></div>
            <table><thead><tr><th>Surface</th><th>Verdict</th><th>Next action</th></tr></thead><tbody>
              ${operationContractRows.map((row) => `<tr><td>${escapeHtml(row.operation_surface)}</td><td><span class="status ${row.current_verdict}">${escapeHtml(row.current_verdict)}</span></td><td>${escapeHtml(row.next_allowed_action)}</td></tr>`).join("\n              ")}
            </tbody></table>
          </section>
        </div>
        <aside>
          <section class="panel" id="blocked-actions">
            <div class="panel-header"><h2 class="panel-title">Blocked Actions</h2><span class="panel-meta">${protectedMutationBlockRows.length}</span></div>
            <table><thead><tr><th>Action</th><th>Reason</th></tr></thead><tbody>
              ${protectedMutationBlockRows.map((row) => `<tr><td>${escapeHtml(row.protected_action)}</td><td>${escapeHtml(row.block_reason)}</td></tr>`).join("\n              ")}
            </tbody></table>
          </section>
          <section class="panel" id="next-actions">
            <div class="panel-header"><h2 class="panel-title">Route Surfaces</h2><span class="panel-meta">future</span></div>
            <table><thead><tr><th>Route</th><th>Type</th></tr></thead><tbody>
              ${routeSurfaceRows.map((row) => `<tr><td class="code">${escapeHtml(row.route_path)}</td><td>${escapeHtml(row.route_type)}</td></tr>`).join("\n              ")}
            </tbody></table>
          </section>
        </aside>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Frontend Operation Shell Summary",
    "",
    `- Status: ${summary.zendd_frontend_operation_shell_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Selected mode: ${summary.selected_integration_mode}`,
    `- Design tokens: ${summary.design_token_row_count}`,
    `- Phase plan rows: ${summary.phase_plan_row_count}`,
    `- Route surfaces: ${summary.route_surface_row_count}`,
    `- Protected mutation blocks: ${summary.protected_mutation_block_count}`,
    `- Static shell ready: ${summary.static_shell_ready}`,
    `- Zendd mutation allowed: ${summary.zendd_mutation_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function normalizeLetterSpacing(value) {
  const text = String(value ?? "0px");
  if (text === "undefined" || text.startsWith("-")) return "0px";
  return text;
}

function fontStack(fontFamily, fallbacks = ["Inter", "Arial", "sans-serif"]) {
  const family = String(fontFamily ?? "Inter");
  const parts = [family, ...fallbacks].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serializableResult(result) {
  const { html, css, markdown, ...rest } = result;
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

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}
