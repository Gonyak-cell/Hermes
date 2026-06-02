import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddFrontendOperationShell } from "./zendd-frontend-operation-shell.mjs";

export const DEFAULT_ZENDD_WORK_ORDER_INTAKE_OUT_DIR = "artifacts/zendd-work-order-intake/latest";
export const DEFAULT_ZENDD_WORK_ORDER_INTAKE_INPUTS = {
  schemaPath: "schemas/zendd-work-order-intake.schema.json",
  packagePath: "package.json",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-work-order-intake";
const FRONTEND_SHELL_COMMAND_NAME = "project:zendd-frontend-operation-shell";
const SCHEMA_VERSION = "zendd-work-order-intake.v1";
const CAPABILITY_ID = "project.zendd.work_order_intake";
const PHASE_RANGE = "P781-P800";
const PHASE_SLOT = "P781";
const PREVIOUS_PHASE_SLOT = "P780";
const NEXT_PHASE_SLOT = "P801";
const READY_STATUS = "ready_for_zendd_work_order_intake";

export async function runZenddWorkOrderIntake(options = {}) {
  const result = await buildZenddWorkOrderIntake(options);
  if (options.write !== false) await writeZenddWorkOrderIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd work order intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddWorkOrderIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_WORK_ORDER_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const frontendShell = await buildZenddFrontendOperationShell({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });

  const intakePolicy = buildIntakePolicy(generatedAt, frontendShell);
  const sourceRows = buildWorkOrderSourceRows();
  const classificationRows = buildClassificationRows(sourceRows);
  const workOrderRows = buildWorkOrderRows(sourceRows, classificationRows);
  const protectedBlockRows = buildProtectedWorkOrderBlockRows(workOrderRows);
  const routeRows = buildWorkOrderRouteRows();
  const closeoutRows = buildCloseoutRows({ frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, intakePolicy, workOrderRows, protectedBlockRows, routeRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_work_order_intake_id: `zendd-work-order-intake.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    work_order_intake_anchor: anchor,
    frontend_operation_summary: frontendShell.summary,
    intake_policy: intakePolicy,
    work_order_source_rows: sourceRows,
    work_order_classification_rows: classificationRows,
    work_order_rows: workOrderRows,
    protected_work_order_block_rows: protectedBlockRows,
    work_order_route_rows: routeRows,
    work_order_intake_closeout_rows: closeoutRows,
    work_order_intake_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ frontendShell, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_work_order_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ frontendShell, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows, validation: result.validation });
  result.summary.zendd_work_order_intake_id = result.zendd_work_order_intake_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddWorkOrderIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-work-order-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "intake-policy.json"), result.intake_policy);
  await writeJson(path.join(outDir, "work-order-source-rows.json"), collectionEnvelope("zendd-work-order-source-rows.v1", "work_order_source_rows", result.work_order_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-order-classification-rows.json"), collectionEnvelope("zendd-work-order-classification-rows.v1", "work_order_classification_rows", result.work_order_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-order-rows.json"), collectionEnvelope("zendd-work-order-rows.v1", "work_order_rows", result.work_order_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-work-order-block-rows.json"), collectionEnvelope("zendd-protected-work-order-block-rows.v1", "protected_work_order_block_rows", result.protected_work_order_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-order-route-rows.json"), collectionEnvelope("zendd-work-order-route-rows.v1", "work_order_route_rows", result.work_order_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-order-intake-closeout-rows.json"), collectionEnvelope("zendd-work-order-intake-closeout-rows.v1", "work_order_intake_closeout_rows", result.work_order_intake_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-order-intake-gate-rows.json"), collectionEnvelope("zendd-work-order-intake-gate-rows.v1", "work_order_intake_gate_rows", result.work_order_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-work-order-intake-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddWorkOrderIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddWorkOrderIntake(args);
    console.log(`Zendd work order intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_work_order_intake_status}`);
    console.log(`Source requests: ${result.summary.work_order_source_row_count}`);
    console.log(`Work orders: ${result.summary.work_order_row_count}`);
    console.log(`Planning pass rows: ${result.summary.planning_pass_work_order_count}`);
    console.log(`Protected blocks: ${result.summary.protected_work_order_block_count}`);
    console.log(`Zendd mutation allowed: ${result.summary.zendd_mutation_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntakePolicy(generatedAt, frontendShell) {
  return {
    schema_version: "zendd-work-order-intake-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_frontend_operation_ref: frontendShell.zendd_frontend_operation_shell_id,
    intake_mode: "deterministic_reference_only_work_order_drafts",
    work_order_intake_allowed: true,
    planning_only_pass_allowed: true,
    zendd_mutation_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    protected_action_execution_allowed: false,
    command_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    required_pass_fields: ["work_order_id", "evidence_ref", "reviewer_ref", "hard_gate_ref", "rollback_target_ref", "next_allowed_action"],
    required_block_fields: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "advance to P801-P820 only for explicitly scoped safe patch lane candidates",
    created_at: generatedAt,
  };
}

function buildWorkOrderSourceRows() {
  const rows = [
    ["frontend_feature_request", "Add or adjust a Zendd frontend interaction", "frontend", "non_protected_code_planning"],
    ["backend_bugfix_request", "Fix deterministic Zendd backend behavior", "backend", "non_protected_code_planning"],
    ["electron_shell_request", "Adjust the Zendd Electron desktop shell", "electron", "non_protected_code_planning"],
    ["vdr_analysis_request", "Analyze VDR workflow behavior by redacted refs", "vdr", "protected_raw_material_boundary"],
    ["ldd_fact_engine_request", "Improve LDD fact extraction or issue routing", "ldd_fact_engine", "protected_client_output_boundary"],
    ["database_migration_request", "Change Zendd schema or Alembic migration state", "database", "protected_database_migration"],
    ["release_package_request", "Build, package, publish, or deliver Zendd", "release", "protected_release_package"],
    ["recovery_or_rollback_request", "Recover from failed build, command, or bad patch", "recovery", "protected_recovery_execution"],
    ["secret_or_env_request", "Inspect secret, credential, or environment behavior", "security", "protected_secret_boundary"],
    ["human_receipt_application_request", "Apply a human receipt to unlock a protected Zendd outcome", "receipt", "protected_receipt_application"],
  ];
  return rows.map(([requestType, summary, domainArea, protectionClass], index) => ({
    schema_version: "zendd-work-order-source-row.v1",
    row_id: `zendd-work-order-source.row.${String(index + 1).padStart(2, "0")}`,
    phase_slot: "P782-P784",
    project_id: "project.zendd",
    request_type: requestType,
    request_summary: summary,
    domain_area: domainArea,
    protection_class: protectionClass,
    source_ref_policy: protectionClass.startsWith("protected") ? "stable_ref_or_redacted_summary_only" : "repo_path_or_issue_ref_only",
    raw_material_payload_allowed: false,
    next_allowed_action: "classify request into a work order without executing Zendd actions",
  }));
}

function buildClassificationRows(sourceRows) {
  return sourceRows.map((source, index) => {
    const protectedAction = source.protection_class.startsWith("protected");
    return {
      schema_version: "zendd-work-order-classification-row.v1",
      row_id: `zendd-work-order-classification.row.${String(index + 1).padStart(2, "0")}`,
      phase_slot: "P785-P787",
      source_row_ref: source.row_id,
      request_type: source.request_type,
      protected_action: protectedAction,
      risk_level: protectedAction ? riskLevelFor(source.protection_class) : "medium",
      required_reviewer_ref: protectedAction ? "reviewer.protected_action_operator" : "reviewer.zendd_maintainer",
      required_hard_gate_ref: protectedAction ? `hard-gate.zendd.${normalizeKey(source.protection_class)}` : "hard-gate.zendd.non_protected_patch_scope",
      human_receipt_required: protectedAction,
      classification_verdict: "pass",
      next_allowed_action: protectedAction ? "queue protected work order as documented BLOCK" : "queue planning-only work order for safe patch lane consideration",
    };
  });
}

function buildWorkOrderRows(sourceRows, classificationRows) {
  return sourceRows.map((source, index) => {
    const classification = classificationRows[index];
    const protectedAction = classification.protected_action;
    const workOrderId = `work-order.zendd.${normalizeKey(source.request_type)}`;
    const blockedReason = protectedAction ? blockReasonFor(source.protection_class) : null;
    return {
      schema_version: "zendd-work-order-row.v1",
      phase_slot: "P788-P793",
      work_order_id: workOrderId,
      source_row_ref: source.row_id,
      project_id: "project.zendd",
      request_type: source.request_type,
      domain_area: source.domain_area,
      work_order_status: protectedAction ? "blocked_protected_action_pending_receipt" : "accepted_for_planning_only",
      work_order_scope: source.request_summary,
      protected_action_class: source.protection_class,
      risk_level: classification.risk_level,
      evidence_ref: `evidence.zendd.work_order_intake.${normalizeKey(source.request_type)}`,
      reviewer_ref: classification.required_reviewer_ref,
      hard_gate_ref: classification.required_hard_gate_ref,
      human_receipt_required: classification.human_receipt_required,
      human_receipt_ref: protectedAction ? `receipt.zendd.pending.${normalizeKey(source.request_type)}` : null,
      rollback_target_ref: rollbackTargetFor(source.protection_class),
      command_execution_allowed_now: false,
      zendd_mutation_allowed_now: false,
      raw_material_copy_allowed_now: false,
      secret_read_allowed_now: false,
      protected_action_execution_allowed: false,
      current_verdict: protectedAction ? "blocked" : "pass",
      block_reason: blockedReason,
      responsible_owner: protectedAction ? "protected_action_operator" : "zendd_maintainer",
      next_allowed_action: protectedAction ? nextActionForProtected(source.protection_class) : "advance to P801 safe patch lane only after scope and rollback target stay non-protected",
    };
  });
}

function buildProtectedWorkOrderBlockRows(workOrderRows) {
  return workOrderRows.filter((row) => row.current_verdict === "blocked")
    .map((row, index) => ({
      schema_version: "zendd-protected-work-order-block-row.v1",
      phase_slot: "P794-P797",
      row_id: `zendd-protected-work-order-block.row.${String(index + 1).padStart(2, "0")}`,
      work_order_id: row.work_order_id,
      request_type: row.request_type,
      protected_action_class: row.protected_action_class,
      current_verdict: "blocked",
      block_reason: row.block_reason,
      responsible_owner: row.responsible_owner,
      evidence_ref: row.evidence_ref,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_required: row.human_receipt_required,
      human_receipt_ref: row.human_receipt_ref,
      rollback_target_ref: row.rollback_target_ref,
      next_allowed_action: row.next_allowed_action,
    }));
}

function buildWorkOrderRouteRows() {
  const rows = [
    ["/operator/zendd/work-orders", "read_only_work_order_table"],
    ["/operator/zendd/work-orders/blocked", "read_only_protected_block_queue"],
    ["/api/project-zendd/work-orders", "future_read_only_api"],
    ["/api/project-zendd/work-order-blocks", "future_read_only_api"],
  ];
  return rows.map(([routePath, routeType], index) => ({
    schema_version: "zendd-work-order-route-row.v1",
    phase_slot: "P798",
    row_id: `zendd-work-order-route.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    route_type: routeType,
    read_only: true,
    server_started: false,
    zendd_mutation_allowed_now: false,
    protected_action_execution_allowed: false,
    next_allowed_action: "surface work order artifacts without accepting live operator mutation",
  }));
}

function buildCloseoutRows({ frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows }) {
  const ready = frontendShell.validation.valid
    && frontendShell.summary.zendd_frontend_operation_shell_status === "ready_for_zendd_frontend_operation_shell"
    && intakePolicy.work_order_intake_allowed
    && sourceRows.length >= 8
    && classificationRows.every((row) => row.classification_verdict === "pass")
    && workOrderRows.some((row) => row.current_verdict === "pass")
    && protectedBlockRows.length >= 5
    && protectedBlockRows.every(documentedProtectedBlock)
    && routeRows.every((row) => row.read_only && !row.server_started && !row.protected_action_execution_allowed)
    && workOrderRows.every((row) => !row.zendd_mutation_allowed_now && !row.command_execution_allowed_now && !row.raw_material_copy_allowed_now && !row.secret_read_allowed_now);
  return [{
    schema_version: "zendd-work-order-intake-closeout-row.v1",
    phase_slot: "P800",
    closeout_status: ready ? READY_STATUS : "blocked",
    work_order_intake_ready: ready,
    planning_only_pass_allowed: true,
    protected_work_orders_blocked: protectedBlockRows.every(documentedProtectedBlock),
    zendd_mutation_allowed_now: false,
    command_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    protected_action_execution_allowed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P801-P820 safe patch lane with non-protected planning work orders only",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows }) {
  return {
    schema_version: "zendd-work-order-intake-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    frontend_shell_command_name: FRONTEND_SHELL_COMMAND_NAME,
    source_frontend_operation_ref: frontendShell.zendd_frontend_operation_shell_id,
    source_frontend_operation_status: frontendShell.summary.zendd_frontend_operation_shell_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    intake_policy_hash: hashValue(intakePolicy),
    work_order_source_rows_hash: hashRows(sourceRows, ["request_type", "protection_class", "source_ref_policy"]),
    work_order_classification_rows_hash: hashRows(classificationRows, ["request_type", "protected_action", "risk_level"]),
    work_order_rows_hash: hashRows(workOrderRows, ["work_order_id", "current_verdict", "block_reason", "next_allowed_action"]),
    protected_work_order_block_rows_hash: hashRows(protectedBlockRows, ["work_order_id", "block_reason", "human_receipt_required"]),
    work_order_route_rows_hash: hashRows(routeRows, ["route_path", "read_only", "server_started"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "work_order_intake_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, frontendShell, intakePolicy, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const passRows = workOrderRows.filter((row) => row.current_verdict === "pass");
  return [
    gateRow("p781_frontend_shell_ready", "P781", frontendShell.validation.valid && frontendShell.summary.zendd_frontend_operation_shell_status === "ready_for_zendd_frontend_operation_shell", "P761-P780 frontend operation shell is ready.", "repair P761-P780 frontend operation shell"),
    gateRow("p782_intake_policy_reference_only", "P782", intakePolicy.work_order_intake_allowed && !intakePolicy.zendd_mutation_allowed_now && !intakePolicy.command_execution_allowed_now, "Work order intake is reference-only.", "restore reference-only intake policy"),
    gateRow("p783_source_requests_declared", "P783-P784", sourceRows.length >= 8 && sourceRows.every((row) => !row.raw_material_payload_allowed), "Zendd request classes are declared without raw payloads.", "declare work order source rows"),
    gateRow("p785_classification_complete", "P785-P787", classificationRows.length === sourceRows.length && classificationRows.every((row) => row.required_reviewer_ref && row.required_hard_gate_ref), "Every request class has reviewer and hard gate classification.", "complete classification rows"),
    gateRow("p788_work_orders_evidence_bound", "P788-P793", workOrderRows.length === sourceRows.length && workOrderRows.every(hasClaimVerdictFields), "Work orders bind evidence, reviewer, gate, rollback, verdict, and next action.", "complete work order verdict fields"),
    gateRow("p794_protected_orders_blocked", "P794-P797", protectedBlockRows.length >= 5 && protectedBlockRows.every(documentedProtectedBlock), "Protected Zendd work orders are documented BLOCK.", "complete protected work order block rows"),
    gateRow("p798_routes_read_only", "P798", routeRows.length >= 4 && routeRows.every((row) => row.read_only && !row.server_started && !row.protected_action_execution_allowed), "Work order route rows are read-only contracts.", "complete read-only work order route rows"),
    gateRow("p799_no_execution_or_mutation", "P799", workOrderRows.every((row) => !row.zendd_mutation_allowed_now && !row.command_execution_allowed_now && !row.raw_material_copy_allowed_now && !row.secret_read_allowed_now && !row.protected_action_execution_allowed), "Intake does not mutate Zendd or run commands.", "restore no-execution intake boundary"),
    gateRow("p800_closeout_ready", "P800", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.zendd_mutation_allowed_now), "P781-P800 closes with intake ready and protected actions blocked.", "complete work order intake closeout"),
    gateRow("planning_pass_is_not_mutation", "P800", passRows.length >= 1 && passRows.every((row) => row.work_order_status === "accepted_for_planning_only" && !row.zendd_mutation_allowed_now), "PASS at intake means planning-only, not mutation approval.", "restrict PASS rows to planning-only status"),
    gateRow("package_script_registered", "P800", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P800", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P800", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P781-P800") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P781-P800.", "record P781-P800 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, intakePolicy, workOrderRows, protectedBlockRows, routeRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "work_order_intake_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_mutation", "intake_policy_boundary", !intakePolicy.zendd_mutation_allowed_now && !intakePolicy.command_execution_allowed_now && !intakePolicy.secret_read_allowed_now, "Intake policy blocks mutation, commands, and secret reads."));
  items.push(validationItem("work_orders.claim_fields", "claim_verdict_boundary", workOrderRows.every(hasClaimVerdictFields), "Work orders have evidence, reviewer, gate, rollback, verdict, and next action."));
  items.push(validationItem("work_orders.pass_is_planning_only", "planning_pass_boundary", workOrderRows.filter((row) => row.current_verdict === "pass").every((row) => row.work_order_status === "accepted_for_planning_only" && !row.zendd_mutation_allowed_now), "PASS work orders are planning-only."));
  items.push(validationItem("protected_orders.documented_block", "protected_action_boundary", protectedBlockRows.every(documentedProtectedBlock), "Protected work orders are documented BLOCK."));
  items.push(validationItem("routes.no_server", "route_boundary", routeRows.every((row) => row.read_only && !row.server_started && !row.protected_action_execution_allowed), "Work order routes do not start servers or execute actions."));
  items.push(validationItem("closeout.safe", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.zendd_mutation_allowed_now && !row.protected_action_execution_allowed), "Closeout is ready without execution."));
  return items;
}

function buildSummary({ frontendShell, sourceRows, classificationRows, workOrderRows, protectedBlockRows, routeRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_work_order_intake_status: validation.valid ? READY_STATUS : "documented_block_pending_work_order_intake",
    source_frontend_operation_status: frontendShell.summary.zendd_frontend_operation_shell_status,
    selected_integration_mode: frontendShell.summary.selected_integration_mode,
    work_order_source_row_count: sourceRows.length,
    work_order_classification_row_count: classificationRows.length,
    work_order_row_count: workOrderRows.length,
    planning_pass_work_order_count: workOrderRows.filter((row) => row.current_verdict === "pass").length,
    protected_work_order_block_count: protectedBlockRows.length,
    route_surface_row_count: routeRows.length,
    work_order_intake_ready: closeoutRows.every((row) => row.work_order_intake_ready),
    zendd_mutation_allowed_now: false,
    command_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    protected_action_execution_allowed: false,
    validation_error_count: validation.errors.length,
  };
}

function hasClaimVerdictFields(row) {
  const common = Boolean(row.work_order_id && row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.rollback_target_ref && row.current_verdict && row.next_allowed_action);
  if (!common) return false;
  if (row.current_verdict === "pass") return !row.block_reason && !row.zendd_mutation_allowed_now && row.work_order_status === "accepted_for_planning_only";
  return Boolean(row.block_reason && row.responsible_owner && row.human_receipt_required && row.human_receipt_ref);
}

function documentedProtectedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.evidence_ref)
    && Boolean(row.hard_gate_ref)
    && row.human_receipt_required === true
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.next_allowed_action);
}

function riskLevelFor(protectionClass) {
  if (protectionClass.includes("database") || protectionClass.includes("release") || protectionClass.includes("secret")) return "critical";
  if (protectionClass.includes("client") || protectionClass.includes("raw_material") || protectionClass.includes("receipt")) return "high";
  return "medium";
}

function blockReasonFor(protectionClass) {
  const map = {
    protected_raw_material_boundary: "raw_vdr_or_client_material_requires_stable_ref_and_human_gate",
    protected_client_output_boundary: "client_output_or_legal_analysis_requires_review_receipt",
    protected_database_migration: "database_migration_requires_protected_work_order_receipt",
    protected_release_package: "release_package_requires_human_receipt_and_release_sandbox",
    protected_recovery_execution: "recovery_execution_requires_rollback_receipt_and_operator_gate",
    protected_secret_boundary: "secret_or_env_access_requires_secret_handle_evidence",
    protected_receipt_application: "receipt_application_requires_validation_chain_before_effect",
  };
  return map[protectionClass] ?? "protected_action_requires_human_receipt";
}

function rollbackTargetFor(protectionClass) {
  const map = {
    non_protected_code_planning: "rollback-target.zendd.safe_patch_lane",
    protected_raw_material_boundary: "rollback-target.zendd.raw_material_quarantine",
    protected_client_output_boundary: "rollback-target.zendd.client_output_gate",
    protected_database_migration: "rollback-target.zendd.database_state",
    protected_release_package: "rollback-target.zendd.release_candidate_sandbox",
    protected_recovery_execution: "rollback-target.zendd.external_checkout",
    protected_secret_boundary: "rollback-target.zendd.secret_handle_boundary",
    protected_receipt_application: "rollback-target.zendd.receipt_quarantine",
  };
  return map[protectionClass] ?? "rollback-target.zendd.external_checkout";
}

function nextActionForProtected(protectionClass) {
  const map = {
    protected_raw_material_boundary: "replace raw payload with stable VDR ref, redacted summary, reviewer, and receipt request",
    protected_client_output_boundary: "bind client-output review gate and attorney or owner receipt before reconsidering",
    protected_database_migration: "prepare protected migration work order with rollback target and human receipt",
    protected_release_package: "defer to release candidate sandbox and protected release receipt flow",
    protected_recovery_execution: "draft recovery packet with rollback target before any execution",
    protected_secret_boundary: "use secret handle evidence only and keep raw env reads blocked",
    protected_receipt_application: "queue receipt for future validation without applying it",
  };
  return map[protectionClass] ?? "collect missing protected action evidence and receipt";
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-work-order-intake-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_work_order_intake_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_WORK_ORDER_INTAKE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_WORK_ORDER_INTAKE_INPUTS.packagePath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_WORK_ORDER_INTAKE_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_WORK_ORDER_INTAKE_INPUTS.zenddProjectRoot,
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

Creates the P781-P800 Zendd work order intake contract. --check validates
without writing artifacts, mutating Zendd, running Zendd commands, reading
secrets, copying raw VDR/client material, applying receipts, or executing
protected recovery/release/database actions.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Work Order Intake Summary",
    "",
    `- Status: ${summary.zendd_work_order_intake_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Source requests: ${summary.work_order_source_row_count}`,
    `- Work orders: ${summary.work_order_row_count}`,
    `- Planning PASS rows: ${summary.planning_pass_work_order_count}`,
    `- Protected BLOCK rows: ${summary.protected_work_order_block_count}`,
    `- Zendd mutation allowed: ${summary.zendd_mutation_allowed_now}`,
    `- Command execution allowed: ${summary.command_execution_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
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
