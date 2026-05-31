import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS,
  buildPlatformReleaseCheckSignoffReceiptTemplate,
} from "./platform-release-check-signoff-receipt-template.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_OUT_DIR = "artifacts/platform-release-check-signoff-receipt-intake/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS,
  releaseCheckSignoffReceiptTemplateSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-signoff-receipt-intake.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-signoff-receipt-intake.v1";
const CAPABILITY_ID = "platform.release_check_signoff_receipt_intake";
const PHASE_SLOT = "P369";
const PREVIOUS_PHASE_SLOT = "P368";
const NEXT_PHASE_SLOT = "P370";

export async function runPlatformReleaseCheckSignoffReceiptIntake(options = {}) {
  const result = await buildPlatformReleaseCheckSignoffReceiptIntake(options);
  if (options.write !== false) await writePlatformReleaseCheckSignoffReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check signoff receipt intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckSignoffReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptTemplate = await buildPlatformReleaseCheckSignoffReceiptTemplate({
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
    schemaPath: inputs.release_check_signoff_receipt_template_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const intakeAnchor = buildIntakeAnchor(receiptTemplate);
  const intakeRows = buildIntakeRows(receiptTemplate);
  const intakeBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const intakeGateRows = buildIntakeGateRows({
    receiptTemplate,
    packageJson,
    platformOpsLedger,
    intakeRows,
    intakeBoundary,
  });
  const validationItems = buildValidationItems({
    receiptTemplate,
    packageJson,
    platformOpsLedger,
    intakeRows,
    intakeGateRows,
    intakeBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptTemplate, intakeRows, intakeGateRows, intakeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_signoff_receipt_intake_id: `platform-release-check-signoff-receipt-intake.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_signoff_receipt_intake_anchor: intakeAnchor,
    release_check_signoff_receipt_intake_rows: intakeRows,
    release_check_signoff_receipt_intake_gate_rows: intakeGateRows,
    release_check_signoff_receipt_intake_boundary: intakeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_signoff_receipt_intake") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptTemplate, intakeRows, intakeGateRows, intakeBoundary, validation: result.validation });
  result.summary.platform_release_check_signoff_receipt_intake_id = result.platform_release_check_signoff_receipt_intake_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckSignoffReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-signoff-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-intake-rows.json"), collectionEnvelope("platform-release-check-signoff-receipt-intake-rows.v1", "release_check_signoff_receipt_intake_rows", result.release_check_signoff_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-intake-gate-rows.json"), collectionEnvelope("platform-release-check-signoff-receipt-intake-gate-rows.v1", "release_check_signoff_receipt_intake_gate_rows", result.release_check_signoff_receipt_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-intake-boundary.json"), result.release_check_signoff_receipt_intake_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-signoff-receipt-intake-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckSignoffReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckSignoffReceiptIntake(args);
    console.log(`Platform release-check signoff receipt intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_signoff_receipt_intake_status}`);
    console.log(`Intake rows: ${result.summary.ready_intake_row_count}/${result.summary.intake_row_count}`);
    console.log(`Intake gates: ${result.summary.ready_intake_gate_count}/${result.summary.intake_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntakeAnchor(receiptTemplate) {
  return {
    schema_version: "platform-release-check-signoff-receipt-intake-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_template_id: receiptTemplate.platform_release_check_signoff_receipt_template_id,
    source_receipt_template_status: receiptTemplate.summary.platform_release_check_signoff_receipt_template_status,
    source_receipt_template_hash: hashValue({
      id: receiptTemplate.platform_release_check_signoff_receipt_template_id,
      status: receiptTemplate.summary.platform_release_check_signoff_receipt_template_status,
      templates: receiptTemplate.summary.receipt_template_count,
      gate_rows: receiptTemplate.summary.template_gate_count,
    }),
  };
}

function buildIntakeRows(receiptTemplate) {
  const sourceReady = receiptTemplate.validation.valid && receiptTemplate.summary.platform_release_check_signoff_receipt_template_status === "ready";
  return receiptTemplate.release_check_signoff_receipt_templates.map((template, index) => {
    const intakeStatus = sourceReady && template.receipt_template_status === "ready_for_human_receipt" ? "awaiting_human_receipt" : "blocked";
    const row = {
      schema_version: "platform-release-check-signoff-receipt-intake-row.v1",
      release_check_signoff_receipt_intake_row_id: `platform-release-check-signoff-receipt-intake.row.${template.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_template_id: template.release_check_signoff_receipt_template_id,
      source_evidence_row_key: template.source_evidence_row_key,
      package_script_name: template.package_script_name,
      check_command: template.check_command,
      required_reviewer_role: template.required_reviewer_role,
      required_receipt_type: template.required_receipt_type,
      required_receipt_fields: template.required_receipt_fields,
      allowed_decisions: template.allowed_decisions,
      receipt_intake_status: intakeStatus,
      source_receipt_template_status: template.receipt_template_status,
      ready_for_human_input: intakeStatus === "awaiting_human_receipt",
      ready_for_validation: false,
      receipt_received_by_intake: false,
      receipt_validated_by_intake: false,
      signoff_completed_by_intake: false,
      approval_applied_by_intake: false,
      receipt_materialized_by_intake: false,
      receipt_template_consumed_in_memory: true,
      receipt_template_artifact_read_performed_by_intake: false,
      command_execution_performed_by_intake: false,
      package_command_execution_performed_by_intake: false,
      release_check_execution_performed_by_intake: false,
      artifact_read_performed_by_intake: false,
      artifact_write_performed_by_intake: false,
      release_published_by_intake: false,
      git_operation_performed_by_intake: false,
      protected_action_executed_by_intake: false,
      trading_order_submission_performed_by_intake: false,
      desktop_source_of_truth_by_intake: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Await an external human receipt for ${template.package_script_name}; this intake row does not validate or apply it.`,
    };
    return withOrdinalAndHash(row, index, "release_check_signoff_receipt_intake_row_hash");
  });
}

function buildIntakeGateRows({ receiptTemplate, packageJson, platformOpsLedger, intakeRows, intakeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p368_receipt_template_ready", "P368 release-check signoff receipt template source is ready.", receiptTemplate.validation.valid && receiptTemplate.summary.platform_release_check_signoff_receipt_template_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P369 release-check signoff receipt intake command.", typeof scripts["platform:release-check-signoff-receipt-intake"] === "string" && scripts["platform:release-check-signoff-receipt-intake"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P369 release-check signoff receipt intake.", validateScript.includes("npm run platform:release-check-signoff-receipt-intake -- --check")),
    gateRow("p369_ledger_acceptance_declared", "P369 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P369: `platform:release-check-signoff-receipt-intake`")),
    gateRow("intake_rows_ready", "All release-check signoff receipt intake rows are awaiting external human receipts.", intakeRows.length >= 4 && intakeRows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input)),
    gateRow("no_receipt_validation_or_approval_application", "Receipt intake records pending receipt slots without validating receipts, completing signoff, or applying approval.", !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.signoff_completed && !intakeBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Receipt intake does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !intakeBoundary.command_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !intakeBoundary.trading_live_enabled && !intakeBoundary.trading_full_auto_enabled && !intakeBoundary.trading_order_submission_allowed && !intakeBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_signoff_receipt_intake_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-signoff-receipt-intake-gate-row.v1",
    release_check_signoff_receipt_intake_gate_row_id: `platform-release-check-signoff-receipt-intake.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_intake: false,
    receipt_validated_by_intake: false,
    signoff_completed_by_intake: false,
    approval_applied_by_intake: false,
    receipt_materialized_by_intake: false,
    receipt_template_artifact_read_performed_by_intake: false,
    command_execution_performed_by_intake: false,
    release_check_execution_performed_by_intake: false,
    artifact_read_performed_by_intake: false,
    artifact_write_performed_by_intake: false,
    release_published_by_intake: false,
    git_operation_performed_by_intake: false,
    protected_action_executed_by_intake: false,
    trading_order_submission_performed_by_intake: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-signoff-receipt-intake-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_intake_artifact_write_requested: writeRequested,
    receipt_template_consumed_in_memory: true,
    receipt_template_artifact_read_performed: false,
    receipt_received: false,
    receipt_validated: false,
    ready_for_validation: false,
    signoff_completed: false,
    approval_applied: false,
    receipt_materialized: false,
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
    human_review_note: "Receipt intake rows wait for external human receipts; this command does not receive, validate, or apply them.",
  };
}

function buildValidationItems({ receiptTemplate, packageJson, platformOpsLedger, intakeRows, intakeGateRows, intakeBoundary }) {
  return [
    validationItem("source.release_check_signoff_receipt_template", "p368_receipt_template_ready", receiptTemplate.validation.valid && receiptTemplate.summary.platform_release_check_signoff_receipt_template_status === "ready", "P368 release-check signoff receipt template source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P369 receipt intake checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_signoff_receipt_intake_rows", "intake_rows_ready", intakeRows.length >= 4 && intakeRows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input && !row.receipt_received_by_intake && !row.approval_applied_by_intake), "Release-check signoff receipt intake rows are awaiting external human receipts."),
    validationItem("release_check_signoff_receipt_intake_gate_rows", "intake_gates_ready", intakeGateRows.length >= 8 && intakeGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_intake && !row.protected_action_executed_by_intake), "P369 release-check signoff receipt intake gates are ready and intake-only."),
    validationItem("boundary.receipt_not_received", "receipt_not_received", intakeBoundary.read_only && intakeBoundary.report_only && intakeBoundary.receipt_template_consumed_in_memory && !intakeBoundary.receipt_template_artifact_read_performed && !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.ready_for_validation && !intakeBoundary.signoff_completed && !intakeBoundary.approval_applied, "Release-check signoff receipt intake consumes P368 in memory and does not receive, validate, or apply receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !intakeBoundary.command_execution_performed && !intakeBoundary.package_command_execution_performed && !intakeBoundary.release_check_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed, "Release-check signoff receipt intake does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !intakeBoundary.dependency_install_performed && !intakeBoundary.package_mutation_performed && !intakeBoundary.lockfile_mutation_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed, "Release-check signoff receipt intake performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !intakeBoundary.trading_live_enabled && !intakeBoundary.trading_full_auto_enabled && !intakeBoundary.trading_order_submission_allowed && !intakeBoundary.broker_write_allowed && !intakeBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !intakeBoundary.desktop_source_of_truth && !intakeBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ receiptTemplate, intakeRows, intakeGateRows, intakeBoundary, validation }) {
  return {
    platform_release_check_signoff_receipt_intake_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_template_status: receiptTemplate.summary.platform_release_check_signoff_receipt_template_status,
    intake_row_count: intakeRows.length,
    ready_intake_row_count: intakeRows.filter((row) => row.receipt_intake_status === "awaiting_human_receipt").length,
    intake_gate_count: intakeGateRows.length,
    ready_intake_gate_count: intakeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: intakeBoundary.read_only,
    report_only: intakeBoundary.report_only,
    receipt_intake_artifact_write_requested: intakeBoundary.receipt_intake_artifact_write_requested,
    receipt_template_consumed_in_memory: intakeBoundary.receipt_template_consumed_in_memory,
    receipt_template_artifact_read_performed: intakeBoundary.receipt_template_artifact_read_performed,
    receipt_received: intakeBoundary.receipt_received,
    receipt_validated: intakeBoundary.receipt_validated,
    ready_for_validation: intakeBoundary.ready_for_validation,
    signoff_completed: intakeBoundary.signoff_completed,
    approval_applied: intakeBoundary.approval_applied,
    receipt_materialized: intakeBoundary.receipt_materialized,
    command_execution_performed: intakeBoundary.command_execution_performed,
    package_command_execution_performed: intakeBoundary.package_command_execution_performed,
    release_check_execution_performed: intakeBoundary.release_check_execution_performed,
    artifact_read_performed: intakeBoundary.artifact_read_performed,
    artifact_write_performed: intakeBoundary.artifact_write_performed,
    dependency_install_performed: intakeBoundary.dependency_install_performed,
    package_mutation_performed: intakeBoundary.package_mutation_performed,
    lockfile_mutation_performed: intakeBoundary.lockfile_mutation_performed,
    release_published: intakeBoundary.release_published,
    git_operation_performed: intakeBoundary.git_operation_performed,
    protected_action_executed: intakeBoundary.protected_action_executed,
    trading_live_enabled: intakeBoundary.trading_live_enabled,
    trading_full_auto_enabled: intakeBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: intakeBoundary.trading_order_submission_allowed,
    broker_write_allowed: intakeBoundary.broker_write_allowed,
    exchange_write_allowed: intakeBoundary.exchange_write_allowed,
    desktop_source_of_truth: intakeBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: intakeBoundary.desktop_mutation_allowed,
    human_review_required: intakeBoundary.human_review_required,
    human_signoff_required: intakeBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Signoff Receipt Intake",
    "",
    `Status: ${result.summary.platform_release_check_signoff_receipt_intake_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt template: ${result.summary.source_receipt_template_status}`,
    `Intake rows: ${result.summary.ready_intake_row_count}/${result.summary.intake_row_count}`,
    `Intake gates: ${result.summary.ready_intake_gate_count}/${result.summary.intake_gate_count}`,
    "",
    "## Intake Rows",
    "",
    ...result.release_check_signoff_receipt_intake_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.receipt_intake_status}`),
    "",
    "## Intake Gates",
    "",
    ...result.release_check_signoff_receipt_intake_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-signoff-receipt-intake.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-signoff-receipt-intake.${slugify(itemPath)}.${checkId}`,
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
