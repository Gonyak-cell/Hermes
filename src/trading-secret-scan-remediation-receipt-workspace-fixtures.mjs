import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptValidationRulesFixtures,
} from "./trading-secret-scan-remediation-receipt-validation-rules-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-workspace-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS,
  secretScanRemediationReceiptValidationRulesSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-workspace-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-workspace-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_workspace_fixtures";
const PHASE_SLOT = "P432";
const PREVIOUS_PHASE_SLOT = "P431";
const NEXT_PHASE_SLOT = "P433";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_workspace";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_validation_rules";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-workspace-fixtures";

export async function runTradingSecretScanRemediationReceiptWorkspaceFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptWorkspaceFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptWorkspaceFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt workspace fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptWorkspaceFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationRules = await buildTradingSecretScanRemediationReceiptValidationRulesFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    secretScanRemediationReceiptTemplateSchemaPath: inputs.secret_scan_remediation_receipt_template_schema_path,
    secretScanRemediationReceiptIntakeSchemaPath: inputs.secret_scan_remediation_receipt_intake_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_validation_rules_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const workspaceRows = buildWorkspaceRows(validationRules);
  const coverage = buildWorkspaceCoverage({ validationRules, workspaceRows });
  const anchor = buildWorkspaceAnchor(validationRules, coverage);
  const boundary = buildWorkspaceBoundary({ generatedAt, writeRequested: options.write !== false, validationRules, workspaceRows, coverage });
  const gateRows = buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationRules, workspaceRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_workspace_fixtures_id: `trading-secret-scan-remediation-receipt-workspace-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_workspace_anchor: anchor,
    secret_scan_remediation_receipt_workspace_rows: workspaceRows,
    secret_scan_remediation_receipt_workspace_gate_rows: gateRows,
    secret_scan_remediation_receipt_workspace_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_workspace_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationRules, workspaceRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_workspace_fixtures_id = result.trading_secret_scan_remediation_receipt_workspace_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptWorkspaceFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-workspace-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-workspace-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-workspace-rows.v1", "secret_scan_remediation_receipt_workspace_rows", result.secret_scan_remediation_receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-workspace-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-workspace-gate-rows.v1", "secret_scan_remediation_receipt_workspace_gate_rows", result.secret_scan_remediation_receipt_workspace_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-workspace-boundary.json"), result.secret_scan_remediation_receipt_workspace_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-workspace-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptWorkspaceFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptWorkspaceFixtures(args);
    console.log(`Trading secret scan remediation receipt workspace fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_workspace_fixtures_status}`);
    console.log(`Secret scan remediation receipt workspace rows: ${result.summary.ready_secret_scan_remediation_receipt_workspace_row_count}/${result.summary.secret_scan_remediation_receipt_workspace_row_count}`);
    console.log(`Secret scan remediation receipt workspace gates: ${result.summary.ready_secret_scan_remediation_receipt_workspace_gate_count}/${result.summary.secret_scan_remediation_receipt_workspace_gate_count}`);
    console.log(`Receipt input materialized: ${result.summary.receipt_input_file_materialized}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildWorkspaceRows(validationRules) {
  const sourceReady = validationRules.validation.valid && validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS;
  return validationRules.secret_scan_remediation_receipt_validation_rule_rows.map((ruleRow, index) => {
    const workspaceReady = sourceReady && ruleRow.secret_scan_remediation_receipt_validation_rules_status === SOURCE_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-workspace-row.v1",
      secret_scan_remediation_receipt_workspace_row_id: `trading-secret-scan-remediation-receipt-workspace.row.${ruleRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_rule_row_id: ruleRow.secret_scan_remediation_receipt_validation_rule_row_id,
      source_receipt_template_id: ruleRow.source_receipt_template_id,
      template_key: ruleRow.template_key,
      intake_key: ruleRow.intake_key,
      workspace_status: workspaceReady ? READY_STATUS : "blocked",
      source_receipt_validation_rules_status: ruleRow.secret_scan_remediation_receipt_validation_rules_status,
      required_receipt_fields: ruleRow.required_receipt_fields,
      allowed_outcomes: ruleRow.allowed_outcomes,
      required_validation_rules: ruleRow.required_validation_rules,
      editable_receipt_fields_declared: true,
      external_human_workspace_reference: `external-human-workspace://trading-secret-scan-remediation/${ruleRow.template_key}`,
      receipt_input_file_materialized: false,
      actor_workspace_file_read: false,
      actor_workspace_payload_read: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      receipt_received_by_workspace: false,
      receipt_validated_by_workspace: false,
      receipt_application_performed_by_workspace: false,
      approval_applied_by_workspace: false,
      secret_values_read_by_workspace: false,
      env_file_read_by_workspace: false,
      desktop_config_content_inspected_by_workspace: false,
      desktop_config_read_by_workspace: false,
      raw_secret_material_materialized_by_workspace: false,
      raw_secret_material_exposed_by_workspace: false,
      provider_key_material_present_by_workspace: false,
      forbidden_receipt_fields_allowed_by_workspace: false,
      auto_fix_command_registered_by_workspace: false,
      auto_redaction_allowed_by_workspace: false,
      auto_deletion_allowed_by_workspace: false,
      auto_rotation_allowed_by_workspace: false,
      credential_lookup_allowed_by_workspace: false,
      plaintext_secret_allowed_by_workspace: false,
      model_context_secret_allowed_by_workspace: false,
      broker_write_allowed_by_workspace: false,
      exchange_write_allowed_by_workspace: false,
      command_execution_performed_by_workspace: false,
      artifact_read_performed_by_workspace: false,
      artifact_write_performed_by_workspace: false,
      release_published_by_workspace: false,
      git_operation_performed_by_workspace: false,
      protected_action_executed_by_workspace: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Editable fields are declared for future ${ruleRow.template_key} receipt input; no receipt file or payload is materialized.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_workspace_hash");
  });
}

function buildWorkspaceCoverage({ validationRules, workspaceRows }) {
  const sourceReady = validationRules.validation.valid && validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS;
  const ruleRows = validationRules.secret_scan_remediation_receipt_validation_rule_rows ?? [];
  const allRuleRowsCovered = ruleRows.length > 0 && ruleRows.every((ruleRow) => workspaceRows.some((row) => row.source_validation_rule_row_id === ruleRow.secret_scan_remediation_receipt_validation_rule_row_id));
  const workspaceRowsReady = workspaceRows.every((row) => row.workspace_status === READY_STATUS && row.editable_receipt_fields_declared);
  const noReceiptInputMaterialized = workspaceRows.every((row) => row.receipt_input_file_materialized === false
    && row.actor_workspace_file_read === false
    && row.actor_workspace_payload_read === false
    && row.receipt_payload_present === false
    && row.ready_for_validation === false
    && row.receipt_received_by_workspace === false
    && row.receipt_validated_by_workspace === false
    && row.receipt_application_performed_by_workspace === false
    && row.approval_applied_by_workspace === false);
  const noSecretMaterialRead = validationRules.summary.no_secret_material_read === true
    && validationRules.summary.secret_values_read === false
    && validationRules.summary.env_file_read === false
    && validationRules.summary.desktop_config_content_inspected === false
    && validationRules.summary.desktop_config_read === false
    && workspaceRows.every((row) => row.secret_values_read_by_workspace === false
      && row.env_file_read_by_workspace === false
      && row.desktop_config_content_inspected_by_workspace === false
      && row.desktop_config_read_by_workspace === false);
  const noSecretOrTradingMutation = validationRules.summary.no_secret_or_trading_mutation === true
    && workspaceRows.every((row) => row.auto_fix_command_registered_by_workspace === false
      && row.auto_redaction_allowed_by_workspace === false
      && row.auto_deletion_allowed_by_workspace === false
      && row.auto_rotation_allowed_by_workspace === false
      && row.credential_lookup_allowed_by_workspace === false
      && row.broker_write_allowed_by_workspace === false
      && row.exchange_write_allowed_by_workspace === false
      && row.command_execution_performed_by_workspace === false
      && row.artifact_write_performed_by_workspace === false
      && row.protected_action_executed_by_workspace === false);
  return {
    p431_ready: sourceReady,
    source_validation_rule_count: ruleRows.length,
    workspace_row_count: workspaceRows.length,
    expected_workspace_row_count: ruleRows.length,
    all_validation_rule_rows_covered: allRuleRowsCovered,
    workspace_rows_ready: workspaceRowsReady,
    editable_receipt_fields_declared: workspaceRows.every((row) => row.editable_receipt_fields_declared === true),
    external_workspace_references_declared: workspaceRows.every((row) => typeof row.external_human_workspace_reference === "string" && row.external_human_workspace_reference.startsWith("external-human-workspace://")),
    no_receipt_input_materialized: noReceiptInputMaterialized,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildWorkspaceAnchor(validationRules, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-workspace-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_validation_rules_fixtures_id: validationRules.trading_secret_scan_remediation_receipt_validation_rules_fixtures_id,
    source_secret_scan_remediation_receipt_validation_rules_status: validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status,
    expected_workspace_row_count: coverage.expected_workspace_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: validationRules.trading_secret_scan_remediation_receipt_validation_rules_fixtures_id,
      status: validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status,
      rule_rows: validationRules.summary.secret_scan_remediation_receipt_validation_rule_count,
      gates: validationRules.summary.secret_scan_remediation_receipt_validation_rules_gate_count,
    }),
  };
}

function buildWorkspaceBoundary({ generatedAt, writeRequested, validationRules, workspaceRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-workspace-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_workspace_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_validation_rules_status: validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status,
    source_secret_scan_remediation_receipt_validation_rules_ready: coverage.p431_ready,
    secret_scan_remediation_receipt_workspace_row_count: workspaceRows.length,
    ready_secret_scan_remediation_receipt_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === READY_STATUS).length,
    all_validation_rule_rows_covered: coverage.all_validation_rule_rows_covered,
    workspace_rows_declared: true,
    editable_receipt_fields_declared: coverage.editable_receipt_fields_declared,
    external_workspace_references_declared: coverage.external_workspace_references_declared,
    validation_rules_consumed_in_memory: true,
    validation_rules_artifact_read_performed: false,
    receipt_input_file_materialized: false,
    actor_workspace_file_read: false,
    actor_workspace_payload_read: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    receipt_applied: false,
    approval_applied: false,
    no_receipt_input_materialized: coverage.no_receipt_input_materialized,
    no_secret_material_read: coverage.no_secret_material_read,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    forbidden_receipt_fields_allowed: false,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p431_secret_scan_remediation_receipt_validation_rules_ready", "P431 secret scan remediation receipt validation rules source is ready.", validationRules.validation.valid && validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P432 trading secret scan remediation receipt workspace fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P432 trading secret scan remediation receipt workspace fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p432_ledger_acceptance_declared", "P432 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P432: `trading:secret-scan-remediation-receipt-workspace-fixtures`")],
    ["all_validation_rule_rows_covered", "Every P431 validation-rule row has a matching workspace row.", coverage.all_validation_rule_rows_covered],
    ["workspace_rows_ready", "Workspace rows are ready for future human receipt input.", coverage.workspace_rows_ready],
    ["editable_fields_and_external_refs_declared", "Editable receipt fields and external human workspace references are declared.", coverage.editable_receipt_fields_declared && coverage.external_workspace_references_declared],
    ["no_receipt_input_materialized", "No receipt input file, actor workspace file, actor payload, or receipt payload is materialized.", boundary.no_receipt_input_materialized && !boundary.receipt_input_file_materialized && !boundary.actor_workspace_file_read && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P432 reads no secret values, env files, or Desktop config content.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P432 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_workspace_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-workspace-gate-row.v1",
    secret_scan_remediation_receipt_workspace_gate_row_id: `trading-secret-scan-remediation-receipt-workspace-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_input_file_materialized_by_workspace: false,
    actor_workspace_file_read_by_workspace: false,
    actor_workspace_payload_read_by_workspace: false,
    receipt_payload_present_by_workspace: false,
    ready_for_validation_by_workspace: false,
    receipt_received_by_workspace: false,
    receipt_validated_by_workspace: false,
    receipt_application_performed_by_workspace: false,
    approval_applied_by_workspace: false,
    secret_values_read_by_workspace: false,
    env_file_read_by_workspace: false,
    desktop_config_content_inspected_by_workspace: false,
    desktop_config_read_by_workspace: false,
    command_execution_performed_by_workspace: false,
    artifact_write_performed_by_workspace: false,
    protected_action_executed_by_workspace: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_validation_rules", "p431_secret_scan_remediation_receipt_validation_rules_ready", validationRules.validation.valid && validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS, "P431 secret scan remediation receipt validation rules fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P432 secret scan remediation receipt workspace fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_workspace_rows", "workspace_rows_ready", workspaceRows.length === coverage.expected_workspace_row_count && workspaceRows.length === 5 && workspaceRows.every((row) => row.workspace_status === READY_STATUS), "All secret scan remediation receipt workspace rows must be ready."),
    validationItem("secret_scan_remediation_receipt_workspace_gate_rows", "workspace_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_workspace), "P432 secret scan remediation receipt workspace gates are ready."),
    validationItem("coverage.validation_rule_rows", "all_validation_rule_rows_covered", coverage.all_validation_rule_rows_covered, "All P431 validation-rule rows must have workspace rows."),
    validationItem("coverage.editable_fields", "editable_receipt_fields_declared", coverage.editable_receipt_fields_declared && coverage.external_workspace_references_declared, "Editable fields and external workspace references must be declared."),
    validationItem("boundary.no_receipt_input", "no_receipt_input_materialized", boundary.no_receipt_input_materialized && !boundary.receipt_input_file_materialized && !boundary.actor_workspace_file_read && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied, "P432 must not materialize receipt input or read actor workspace payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P432 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P432 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ validationRules, workspaceRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_workspace_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_validation_rules_status: validationRules.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status,
    source_secret_scan_remediation_receipt_validation_rules_ready: boundary.source_secret_scan_remediation_receipt_validation_rules_ready,
    expected_workspace_row_count: coverage.expected_workspace_row_count,
    secret_scan_remediation_receipt_workspace_row_count: workspaceRows.length,
    ready_secret_scan_remediation_receipt_workspace_row_count: boundary.ready_secret_scan_remediation_receipt_workspace_row_count,
    secret_scan_remediation_receipt_workspace_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_workspace_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_validation_rule_rows_covered: boundary.all_validation_rule_rows_covered,
    workspace_rows_declared: boundary.workspace_rows_declared,
    editable_receipt_fields_declared: boundary.editable_receipt_fields_declared,
    external_workspace_references_declared: boundary.external_workspace_references_declared,
    no_receipt_input_materialized: boundary.no_receipt_input_materialized,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_input_file_materialized: boundary.receipt_input_file_materialized,
    actor_workspace_file_read: boundary.actor_workspace_file_read,
    actor_workspace_payload_read: boundary.actor_workspace_payload_read,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_for_validation: boundary.ready_for_validation,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    receipt_application_performed: boundary.receipt_application_performed,
    receipt_applied: boundary.receipt_applied,
    approval_applied: boundary.approval_applied,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    auto_fix_command_registered: boundary.auto_fix_command_registered,
    auto_redaction_allowed: boundary.auto_redaction_allowed,
    auto_deletion_allowed: boundary.auto_deletion_allowed,
    auto_rotation_allowed: boundary.auto_rotation_allowed,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Workspace Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_workspace_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation rules: ${result.summary.source_secret_scan_remediation_receipt_validation_rules_status}`,
    `Workspace rows: ${result.summary.ready_secret_scan_remediation_receipt_workspace_row_count}/${result.summary.secret_scan_remediation_receipt_workspace_row_count}`,
    `Workspace gates: ${result.summary.ready_secret_scan_remediation_receipt_workspace_gate_count}/${result.summary.secret_scan_remediation_receipt_workspace_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_workspace_rows.map((row) => `- ${row.template_key}: ${row.workspace_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_workspace_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-intake-schema") parsed.secretScanRemediationReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-validation-rules-schema") parsed.secretScanRemediationReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else {
      parsed.__passthrough ??= [];
      parsed.__passthrough.push(arg);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-workspace-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                   Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR}
  --run-at <iso>                                                       Deterministic generated_at timestamp.
  --package <path>                                                     package.json path.
  --platform-ops-ledger <path>                                         P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-template-schema <path>             P429 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-intake-schema <path>               P430 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-validation-rules-schema <path>     P431 receipt validation rules fixtures schema path.
  --control-plane-human-gate-receipts <path>                           Control-plane human gate receipts source path.
  --schema <path>                                                      Output schema path.
  --check                                                              Validate only, do not write artifacts.
  -h, --help                                                           Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.secretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.secretScanRemediationReceiptValidationRulesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, count: rows.length, [key]: rows };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashField) {
  const withoutHash = { ...row, ordinal: index + 1 };
  return { ...withoutHash, [hashField]: hashValue(withoutHash) };
}

function validationItem(pathValue, rule, passed, message) {
  return { path: pathValue, rule, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

async function readJsonSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
