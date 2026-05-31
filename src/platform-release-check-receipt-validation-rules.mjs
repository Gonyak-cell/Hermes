import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS,
  buildPlatformReleaseCheckReceiptQueue,
} from "./platform-release-check-receipt-queue.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_OUT_DIR = "artifacts/platform-release-check-receipt-validation-rules/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS,
  releaseCheckReceiptQueueSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-validation-rules.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-validation-rules.v1";
const CAPABILITY_ID = "platform.release_check_receipt_validation_rules";
const PHASE_SLOT = "P373";
const PREVIOUS_PHASE_SLOT = "P372";
const NEXT_PHASE_SLOT = "P374";
const REQUIRED_RECEIPT_FIELDS = ["reviewer_id", "reviewed_at", "source_signoff_row_id", "decision", "evidence_reference", "blocker_note"];
const ALLOWED_RECEIPT_DECISIONS = ["signoff_ready", "return_with_blocker"];

export async function runPlatformReleaseCheckReceiptValidationRules(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptValidationRules(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptValidationRules(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt validation rules failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptValidationRules(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptQueue = await buildPlatformReleaseCheckReceiptQueue({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    releaseCheckEvidenceIndexSchemaPath: inputs.release_check_evidence_index_schema_path,
    releaseCheckReviewPacketSchemaPath: inputs.release_check_review_packet_schema_path,
    releaseCheckSignoffLedgerSchemaPath: inputs.release_check_signoff_ledger_schema_path,
    releaseCheckSignoffReceiptTemplateSchemaPath: inputs.release_check_signoff_receipt_template_schema_path,
    releaseCheckSignoffReceiptIntakeSchemaPath: inputs.release_check_signoff_receipt_intake_schema_path,
    releaseCheckSignoffCloseoutSchemaPath: inputs.release_check_signoff_closeout_schema_path,
    releaseCheckStatusLedgerSchemaPath: inputs.release_check_status_ledger_schema_path,
    schemaPath: inputs.release_check_receipt_queue_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const rulesAnchor = buildRulesAnchor(receiptQueue);
  const ruleRows = buildRuleRows(receiptQueue);
  const rulesBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const rulesGateRows = buildRulesGateRows({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary });
  const validationItems = buildValidationItems({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesGateRows, rulesBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_validation_rules_id: `platform-release-check-receipt-validation-rules.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_validation_rules_anchor: rulesAnchor,
    release_check_receipt_validation_rule_rows: ruleRows,
    release_check_receipt_validation_rules_gate_rows: rulesGateRows,
    release_check_receipt_validation_rules_boundary: rulesBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_validation_rules") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_validation_rules_id = result.platform_release_check_receipt_validation_rules_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptValidationRules(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-validation-rules.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-validation-rule-rows.json"), collectionEnvelope("platform-release-check-receipt-validation-rule-rows.v1", "release_check_receipt_validation_rule_rows", result.release_check_receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-validation-rules-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-validation-rules-gate-rows.v1", "release_check_receipt_validation_rules_gate_rows", result.release_check_receipt_validation_rules_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-validation-rules-boundary.json"), result.release_check_receipt_validation_rules_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-validation-rules-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptValidationRulesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptValidationRules(args);
    console.log(`Platform release-check receipt validation rules ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_validation_rules_status}`);
    console.log(`Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`);
    console.log(`Rule gates: ${result.summary.ready_rule_gate_count}/${result.summary.rule_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRulesAnchor(receiptQueue) {
  return {
    schema_version: "platform-release-check-receipt-validation-rules-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_queue_id: receiptQueue.platform_release_check_receipt_queue_id,
    source_receipt_queue_status: receiptQueue.summary.platform_release_check_receipt_queue_status,
    source_receipt_queue_hash: hashValue({
      id: receiptQueue.platform_release_check_receipt_queue_id,
      status: receiptQueue.summary.platform_release_check_receipt_queue_status,
      queue_rows: receiptQueue.summary.queue_row_count,
      gate_rows: receiptQueue.summary.queue_gate_count,
    }),
  };
}

function buildRuleRows(receiptQueue) {
  const sourceReady = receiptQueue.validation.valid && receiptQueue.summary.platform_release_check_receipt_queue_status === "queued_for_human_receipt";
  return receiptQueue.release_check_receipt_queue_rows.map((queueRow, index) => {
    const ruleStatus = sourceReady && queueRow.receipt_queue_status === "queued_for_human_receipt" ? "ready_for_future_receipt_validation" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-validation-rule-row.v1",
      release_check_receipt_validation_rule_row_id: `platform-release-check-receipt-validation-rules.row.${queueRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_queue_row_id: queueRow.release_check_receipt_queue_row_id,
      source_evidence_row_key: queueRow.source_evidence_row_key,
      queue_position: queueRow.queue_position,
      package_script_name: queueRow.package_script_name,
      required_reviewer_role: queueRow.required_reviewer_role,
      receipt_validation_rule_status: ruleStatus,
      source_receipt_queue_status: queueRow.receipt_queue_status,
      required_receipt_fields: REQUIRED_RECEIPT_FIELDS,
      allowed_receipt_decisions: ALLOWED_RECEIPT_DECISIONS,
      future_receipt_validation_required: true,
      receipt_payload_present: false,
      ready_to_validate_receipt_payload: false,
      receipt_received_by_rules: false,
      receipt_validated_by_rules: false,
      signoff_completed_by_rules: false,
      approval_applied_by_rules: false,
      receipt_queue_consumed_in_memory: true,
      receipt_queue_artifact_read_performed_by_rules: false,
      command_execution_performed_by_rules: false,
      package_command_execution_performed_by_rules: false,
      release_check_execution_performed_by_rules: false,
      artifact_read_performed_by_rules: false,
      artifact_write_performed_by_rules: false,
      release_published_by_rules: false,
      git_operation_performed_by_rules: false,
      protected_action_executed_by_rules: false,
      trading_order_submission_performed_by_rules: false,
      desktop_source_of_truth_by_rules: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_validation_rule_row_hash");
  });
}

function buildRulesGateRows({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p372_receipt_queue_ready", "P372 release-check receipt queue source is ready.", receiptQueue.validation.valid && receiptQueue.summary.platform_release_check_receipt_queue_status === "queued_for_human_receipt"),
    gateRow("platform_package_script_registered", "package.json registers the P373 release-check receipt validation rules command.", typeof scripts["platform:release-check-receipt-validation-rules"] === "string" && scripts["platform:release-check-receipt-validation-rules"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P373 release-check receipt validation rules.", validateScript.includes("npm run platform:release-check-receipt-validation-rules -- --check")),
    gateRow("p373_ledger_acceptance_declared", "P373 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P373: `platform:release-check-receipt-validation-rules`")),
    gateRow("validation_rule_rows_ready", "All release-check receipt validation rule rows are ready for future receipt validation.", ruleRows.length >= 4 && ruleRows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.future_receipt_validation_required && !row.receipt_payload_present && !row.ready_to_validate_receipt_payload)),
    gateRow("no_receipt_payload_validation", "Validation rules declare future checks without receiving or validating receipt payloads.", !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.signoff_completed && !rulesBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Validation rules do not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !rulesBoundary.command_execution_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !rulesBoundary.trading_live_enabled && !rulesBoundary.trading_full_auto_enabled && !rulesBoundary.trading_order_submission_allowed && !rulesBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_validation_rules_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-validation-rules-gate-row.v1",
    release_check_receipt_validation_rules_gate_row_id: `platform-release-check-receipt-validation-rules.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present_by_rules: false,
    ready_to_validate_receipt_payload_by_rules: false,
    receipt_received_by_rules: false,
    receipt_validated_by_rules: false,
    signoff_completed_by_rules: false,
    approval_applied_by_rules: false,
    receipt_queue_artifact_read_performed_by_rules: false,
    command_execution_performed_by_rules: false,
    release_check_execution_performed_by_rules: false,
    artifact_read_performed_by_rules: false,
    artifact_write_performed_by_rules: false,
    release_published_by_rules: false,
    git_operation_performed_by_rules: false,
    protected_action_executed_by_rules: false,
    trading_order_submission_performed_by_rules: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-validation-rules-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_validation_rules_artifact_write_requested: writeRequested,
    receipt_queue_consumed_in_memory: true,
    receipt_queue_artifact_read_performed: false,
    validation_rules_declared: true,
    future_receipt_validation_required: true,
    receipt_payload_present: false,
    ready_to_validate_receipt_payload: false,
    receipt_received: false,
    receipt_validated: false,
    signoff_completed: false,
    approval_applied: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesGateRows, rulesBoundary }) {
  return [
    validationItem("source.release_check_receipt_queue", "p372_receipt_queue_ready", receiptQueue.validation.valid && receiptQueue.summary.platform_release_check_receipt_queue_status === "queued_for_human_receipt", "P372 release-check receipt queue source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P373 receipt validation rule checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_validation_rule_rows", "validation_rule_rows_ready", ruleRows.length >= 4 && ruleRows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.future_receipt_validation_required && !row.receipt_payload_present && !row.ready_to_validate_receipt_payload && REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && ALLOWED_RECEIPT_DECISIONS.every((decision) => row.allowed_receipt_decisions.includes(decision))), "Release-check receipt validation rule rows must declare future validation requirements without receipt payloads."),
    validationItem("release_check_receipt_validation_rules_gate_rows", "rule_gates_ready", rulesGateRows.length >= 8 && rulesGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_rules && !row.protected_action_executed_by_rules), "P373 release-check receipt validation rules gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", rulesBoundary.read_only && rulesBoundary.report_only && rulesBoundary.receipt_queue_consumed_in_memory && !rulesBoundary.receipt_queue_artifact_read_performed && rulesBoundary.validation_rules_declared && rulesBoundary.future_receipt_validation_required && !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.signoff_completed && !rulesBoundary.approval_applied, "Release-check receipt validation rules declare future requirements without validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !rulesBoundary.command_execution_performed && !rulesBoundary.package_command_execution_performed && !rulesBoundary.release_check_execution_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed, "Release-check receipt validation rules do not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !rulesBoundary.dependency_install_performed && !rulesBoundary.package_mutation_performed && !rulesBoundary.lockfile_mutation_performed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed, "Release-check receipt validation rules perform no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !rulesBoundary.trading_live_enabled && !rulesBoundary.trading_full_auto_enabled && !rulesBoundary.trading_order_submission_allowed && !rulesBoundary.broker_write_allowed && !rulesBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !rulesBoundary.desktop_source_of_truth && !rulesBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation }) {
  return {
    platform_release_check_receipt_validation_rules_status: validation.valid ? "ready_for_future_receipt_validation" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_queue_status: receiptQueue.summary.platform_release_check_receipt_queue_status,
    rule_row_count: ruleRows.length,
    ready_rule_row_count: ruleRows.filter((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation").length,
    rule_gate_count: rulesGateRows.length,
    ready_rule_gate_count: rulesGateRows.filter((row) => row.gate_status === "ready").length,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    allowed_receipt_decision_count: ALLOWED_RECEIPT_DECISIONS.length,
    read_only: rulesBoundary.read_only,
    report_only: rulesBoundary.report_only,
    receipt_queue_consumed_in_memory: rulesBoundary.receipt_queue_consumed_in_memory,
    receipt_queue_artifact_read_performed: rulesBoundary.receipt_queue_artifact_read_performed,
    validation_rules_declared: rulesBoundary.validation_rules_declared,
    future_receipt_validation_required: rulesBoundary.future_receipt_validation_required,
    receipt_payload_present: rulesBoundary.receipt_payload_present,
    ready_to_validate_receipt_payload: rulesBoundary.ready_to_validate_receipt_payload,
    receipt_received: rulesBoundary.receipt_received,
    receipt_validated: rulesBoundary.receipt_validated,
    signoff_completed: rulesBoundary.signoff_completed,
    approval_applied: rulesBoundary.approval_applied,
    command_execution_performed: rulesBoundary.command_execution_performed,
    package_command_execution_performed: rulesBoundary.package_command_execution_performed,
    release_check_execution_performed: rulesBoundary.release_check_execution_performed,
    artifact_read_performed: rulesBoundary.artifact_read_performed,
    artifact_write_performed: rulesBoundary.artifact_write_performed,
    dependency_install_performed: rulesBoundary.dependency_install_performed,
    package_mutation_performed: rulesBoundary.package_mutation_performed,
    lockfile_mutation_performed: rulesBoundary.lockfile_mutation_performed,
    release_published: rulesBoundary.release_published,
    git_operation_performed: rulesBoundary.git_operation_performed,
    protected_action_executed: rulesBoundary.protected_action_executed,
    trading_live_enabled: rulesBoundary.trading_live_enabled,
    trading_full_auto_enabled: rulesBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: rulesBoundary.trading_order_submission_allowed,
    broker_write_allowed: rulesBoundary.broker_write_allowed,
    exchange_write_allowed: rulesBoundary.exchange_write_allowed,
    desktop_source_of_truth: rulesBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: rulesBoundary.desktop_mutation_allowed,
    human_review_required: rulesBoundary.human_review_required,
    human_signoff_required: rulesBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Validation Rules",
    "",
    `Status: ${result.summary.platform_release_check_receipt_validation_rules_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt queue: ${result.summary.source_receipt_queue_status}`,
    `Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`,
    `Rule gates: ${result.summary.ready_rule_gate_count}/${result.summary.rule_gate_count}`,
    "",
    "## Rule Rows",
    "",
    ...result.release_check_receipt_validation_rule_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.receipt_validation_rule_status}`),
    "",
    "## Rule Gates",
    "",
    ...result.release_check_receipt_validation_rules_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-release-check-doc") parsed.tradingReleaseCheckDocPath = argv[++index];
    else if (arg === "--platform-ops-check-doc") parsed.platformOpsCheckDocPath = argv[++index];
    else if (arg === "--platform-release-check-doc") parsed.platformReleaseCheckDocPath = argv[++index];
    else if (arg === "--no-write-audit-doc") parsed.noWriteAuditDocPath = argv[++index];
    else if (arg === "--release-check-evidence-index-schema") parsed.releaseCheckEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--release-check-review-packet-schema") parsed.releaseCheckReviewPacketSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-ledger-schema") parsed.releaseCheckSignoffLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-template-schema") parsed.releaseCheckSignoffReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-intake-schema") parsed.releaseCheckSignoffReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-closeout-schema") parsed.releaseCheckSignoffCloseoutSchemaPath = argv[++index];
    else if (arg === "--release-check-status-ledger-schema") parsed.releaseCheckStatusLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-queue-schema") parsed.releaseCheckReceiptQueueSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-validation-rules.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --trading-release-check-doc <path>     Trading release-check doc path.
  --platform-ops-check-doc <path>        Platform ops-check doc path.
  --platform-release-check-doc <path>    Platform release-check doc path.
  --no-write-audit-doc <path>            Release-check no-write audit doc path.
  --release-check-evidence-index-schema <path>
                                         P365 evidence index schema path.
  --release-check-review-packet-schema <path>
                                         P366 review packet schema path.
  --release-check-signoff-ledger-schema <path>
                                         P367 signoff ledger schema path.
  --release-check-signoff-receipt-template-schema <path>
                                         P368 receipt template schema path.
  --release-check-signoff-receipt-intake-schema <path>
                                         P369 receipt intake schema path.
  --release-check-signoff-closeout-schema <path>
                                         P370 closeout schema path.
  --release-check-status-ledger-schema <path>
                                         P371 status ledger schema path.
  --release-check-receipt-queue-schema <path>
                                         P372 receipt queue schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.releaseCheckReceiptQueueSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-release-check-receipt-validation-rules.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
