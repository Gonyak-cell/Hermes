import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS,
  buildPlatformReleaseCheckSignoffLedger,
} from "./platform-release-check-signoff-ledger.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR = "artifacts/platform-release-check-signoff-receipt-template/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS,
  releaseCheckSignoffLedgerSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-signoff-receipt-template.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-signoff-receipt-template.v1";
const CAPABILITY_ID = "platform.release_check_signoff_receipt_template";
const PHASE_SLOT = "P368";
const PREVIOUS_PHASE_SLOT = "P367";
const NEXT_PHASE_SLOT = "P369";

export async function runPlatformReleaseCheckSignoffReceiptTemplate(options = {}) {
  const result = await buildPlatformReleaseCheckSignoffReceiptTemplate(options);
  if (options.write !== false) await writePlatformReleaseCheckSignoffReceiptTemplate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check signoff receipt template failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckSignoffReceiptTemplate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffLedger = await buildPlatformReleaseCheckSignoffLedger({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    releaseCheckEvidenceIndexSchemaPath: inputs.release_check_evidence_index_schema_path,
    releaseCheckReviewPacketSchemaPath: inputs.release_check_review_packet_schema_path,
    schemaPath: inputs.release_check_signoff_ledger_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const templateAnchor = buildTemplateAnchor(signoffLedger);
  const receiptTemplates = buildReceiptTemplates(signoffLedger);
  const templateBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const templateGateRows = buildTemplateGateRows({
    signoffLedger,
    packageJson,
    platformOpsLedger,
    receiptTemplates,
    templateBoundary,
  });
  const validationItems = buildValidationItems({
    signoffLedger,
    packageJson,
    platformOpsLedger,
    receiptTemplates,
    templateGateRows,
    templateBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffLedger, receiptTemplates, templateGateRows, templateBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_signoff_receipt_template_id: `platform-release-check-signoff-receipt-template.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_signoff_receipt_template_anchor: templateAnchor,
    release_check_signoff_receipt_templates: receiptTemplates,
    release_check_signoff_receipt_template_gate_rows: templateGateRows,
    release_check_signoff_receipt_template_boundary: templateBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_signoff_receipt_template") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffLedger, receiptTemplates, templateGateRows, templateBoundary, validation: result.validation });
  result.summary.platform_release_check_signoff_receipt_template_id = result.platform_release_check_signoff_receipt_template_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckSignoffReceiptTemplate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-signoff-receipt-template.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-templates.json"), collectionEnvelope("platform-release-check-signoff-receipt-templates.v1", "release_check_signoff_receipt_templates", result.release_check_signoff_receipt_templates, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-template-gate-rows.json"), collectionEnvelope("platform-release-check-signoff-receipt-template-gate-rows.v1", "release_check_signoff_receipt_template_gate_rows", result.release_check_signoff_receipt_template_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-receipt-template-boundary.json"), result.release_check_signoff_receipt_template_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-signoff-receipt-template-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckSignoffReceiptTemplateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckSignoffReceiptTemplate(args);
    console.log(`Platform release-check signoff receipt template ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_signoff_receipt_template_status}`);
    console.log(`Receipt templates: ${result.summary.ready_receipt_template_count}/${result.summary.receipt_template_count}`);
    console.log(`Template gates: ${result.summary.ready_template_gate_count}/${result.summary.template_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildTemplateAnchor(signoffLedger) {
  return {
    schema_version: "platform-release-check-signoff-receipt-template-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_ledger_id: signoffLedger.platform_release_check_signoff_ledger_id,
    source_signoff_ledger_status: signoffLedger.summary.platform_release_check_signoff_ledger_status,
    source_signoff_ledger_hash: hashValue({
      id: signoffLedger.platform_release_check_signoff_ledger_id,
      status: signoffLedger.summary.platform_release_check_signoff_ledger_status,
      signoff_rows: signoffLedger.summary.signoff_row_count,
      gate_rows: signoffLedger.summary.signoff_gate_count,
    }),
  };
}

function buildReceiptTemplates(signoffLedger) {
  const sourceReady = signoffLedger.validation.valid && signoffLedger.summary.platform_release_check_signoff_ledger_status === "ready";
  return signoffLedger.release_check_signoff_rows.map((signoffRow, index) => {
    const templateStatus = sourceReady && signoffRow.signoff_status === "ready_for_human_signoff" ? "ready_for_human_receipt" : "blocked";
    const template = {
      schema_version: "platform-release-check-signoff-receipt-template-row.v1",
      release_check_signoff_receipt_template_id: `platform-release-check-signoff-receipt-template.row.${signoffRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_signoff_row_id: signoffRow.release_check_signoff_row_id,
      source_evidence_row_key: signoffRow.source_evidence_row_key,
      package_script_name: signoffRow.package_script_name,
      check_command: signoffRow.check_command,
      required_reviewer_role: signoffRow.required_reviewer_role,
      required_receipt_type: signoffRow.required_receipt_type,
      expected_signoff_decision: signoffRow.expected_signoff_decision,
      receipt_template_status: templateStatus,
      source_signoff_status: signoffRow.signoff_status,
      required_receipt_fields: [
        "reviewer_id",
        "reviewed_at",
        "source_signoff_row_id",
        "decision",
        "evidence_reference",
        "blocker_note",
      ],
      allowed_decisions: ["signoff_ready", "return_with_blocker"],
      signoff_ledger_consumed_in_memory: true,
      signoff_ledger_artifact_read_performed_by_template: false,
      receipt_completed_by_template: false,
      signoff_completed_by_template: false,
      approval_applied_by_template: false,
      receipt_materialized_by_template: false,
      command_execution_performed_by_template: false,
      package_command_execution_performed_by_template: false,
      release_check_execution_performed_by_template: false,
      artifact_read_performed_by_template: false,
      artifact_write_performed_by_template: false,
      release_published_by_template: false,
      git_operation_performed_by_template: false,
      protected_action_executed_by_template: false,
      trading_order_submission_performed_by_template: false,
      desktop_source_of_truth_by_template: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Fill this template externally before ${signoffRow.package_script_name} can be treated as signed off.`,
    };
    return withOrdinalAndHash(template, index, "release_check_signoff_receipt_template_hash");
  });
}

function buildTemplateGateRows({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates, templateBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p367_signoff_ledger_ready", "P367 release-check signoff ledger source is ready.", signoffLedger.validation.valid && signoffLedger.summary.platform_release_check_signoff_ledger_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P368 release-check signoff receipt template command.", typeof scripts["platform:release-check-signoff-receipt-template"] === "string" && scripts["platform:release-check-signoff-receipt-template"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P368 release-check signoff receipt template.", validateScript.includes("npm run platform:release-check-signoff-receipt-template -- --check")),
    gateRow("p368_ledger_acceptance_declared", "P368 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P368: `platform:release-check-signoff-receipt-template`")),
    gateRow("receipt_templates_ready", "All release-check signoff receipt templates are ready for human receipt completion.", receiptTemplates.length >= 4 && receiptTemplates.every((row) => row.receipt_template_status === "ready_for_human_receipt")),
    gateRow("no_receipt_or_approval_application", "Receipt template records required receipt fields without completing receipts, signoff, or approvals.", !templateBoundary.receipt_completed && !templateBoundary.signoff_completed && !templateBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Receipt template does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !templateBoundary.command_execution_performed && !templateBoundary.artifact_read_performed && !templateBoundary.artifact_write_performed && !templateBoundary.release_published && !templateBoundary.git_operation_performed && !templateBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !templateBoundary.trading_live_enabled && !templateBoundary.trading_full_auto_enabled && !templateBoundary.trading_order_submission_allowed && !templateBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_signoff_receipt_template_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-signoff-receipt-template-gate-row.v1",
    release_check_signoff_receipt_template_gate_row_id: `platform-release-check-signoff-receipt-template.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_completed_by_template: false,
    signoff_completed_by_template: false,
    approval_applied_by_template: false,
    receipt_materialized_by_template: false,
    signoff_ledger_artifact_read_performed_by_template: false,
    command_execution_performed_by_template: false,
    release_check_execution_performed_by_template: false,
    artifact_read_performed_by_template: false,
    artifact_write_performed_by_template: false,
    release_published_by_template: false,
    git_operation_performed_by_template: false,
    protected_action_executed_by_template: false,
    trading_order_submission_performed_by_template: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-signoff-receipt-template-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_template_artifact_write_requested: writeRequested,
    signoff_ledger_consumed_in_memory: true,
    signoff_ledger_artifact_read_performed: false,
    receipt_completed: false,
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
    human_review_note: "Receipt templates must be completed externally by humans before release-check signoff can be claimed.",
  };
}

function buildValidationItems({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates, templateGateRows, templateBoundary }) {
  return [
    validationItem("source.release_check_signoff_ledger", "p367_signoff_ledger_ready", signoffLedger.validation.valid && signoffLedger.summary.platform_release_check_signoff_ledger_status === "ready", "P367 release-check signoff ledger source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P368 receipt template checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_signoff_receipt_templates", "receipt_templates_ready", receiptTemplates.length >= 4 && receiptTemplates.every((row) => row.receipt_template_status === "ready_for_human_receipt" && !row.receipt_completed_by_template && !row.signoff_completed_by_template && !row.approval_applied_by_template), "Release-check signoff receipt templates are ready and template-only."),
    validationItem("release_check_signoff_receipt_template_gate_rows", "template_gates_ready", templateGateRows.length >= 8 && templateGateRows.every((row) => row.gate_status === "ready" && !row.receipt_completed_by_template && !row.protected_action_executed_by_template), "P368 release-check signoff receipt template gates are ready and template-only."),
    validationItem("boundary.receipt_not_completed", "receipt_not_completed", templateBoundary.read_only && templateBoundary.report_only && templateBoundary.signoff_ledger_consumed_in_memory && !templateBoundary.signoff_ledger_artifact_read_performed && !templateBoundary.receipt_completed && !templateBoundary.signoff_completed && !templateBoundary.approval_applied && !templateBoundary.receipt_materialized, "Release-check signoff receipt template consumes P367 in memory and does not complete receipts, signoff, approvals, or receipt materialization."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !templateBoundary.command_execution_performed && !templateBoundary.package_command_execution_performed && !templateBoundary.release_check_execution_performed && !templateBoundary.artifact_read_performed && !templateBoundary.artifact_write_performed, "Release-check signoff receipt template does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !templateBoundary.dependency_install_performed && !templateBoundary.package_mutation_performed && !templateBoundary.lockfile_mutation_performed && !templateBoundary.release_published && !templateBoundary.git_operation_performed && !templateBoundary.protected_action_executed, "Release-check signoff receipt template performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !templateBoundary.trading_live_enabled && !templateBoundary.trading_full_auto_enabled && !templateBoundary.trading_order_submission_allowed && !templateBoundary.broker_write_allowed && !templateBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !templateBoundary.desktop_source_of_truth && !templateBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ signoffLedger, receiptTemplates, templateGateRows, templateBoundary, validation }) {
  return {
    platform_release_check_signoff_receipt_template_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_ledger_status: signoffLedger.summary.platform_release_check_signoff_ledger_status,
    receipt_template_count: receiptTemplates.length,
    ready_receipt_template_count: receiptTemplates.filter((row) => row.receipt_template_status === "ready_for_human_receipt").length,
    template_gate_count: templateGateRows.length,
    ready_template_gate_count: templateGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: templateBoundary.read_only,
    report_only: templateBoundary.report_only,
    receipt_template_artifact_write_requested: templateBoundary.receipt_template_artifact_write_requested,
    signoff_ledger_consumed_in_memory: templateBoundary.signoff_ledger_consumed_in_memory,
    signoff_ledger_artifact_read_performed: templateBoundary.signoff_ledger_artifact_read_performed,
    receipt_completed: templateBoundary.receipt_completed,
    signoff_completed: templateBoundary.signoff_completed,
    approval_applied: templateBoundary.approval_applied,
    receipt_materialized: templateBoundary.receipt_materialized,
    command_execution_performed: templateBoundary.command_execution_performed,
    package_command_execution_performed: templateBoundary.package_command_execution_performed,
    release_check_execution_performed: templateBoundary.release_check_execution_performed,
    artifact_read_performed: templateBoundary.artifact_read_performed,
    artifact_write_performed: templateBoundary.artifact_write_performed,
    dependency_install_performed: templateBoundary.dependency_install_performed,
    package_mutation_performed: templateBoundary.package_mutation_performed,
    lockfile_mutation_performed: templateBoundary.lockfile_mutation_performed,
    release_published: templateBoundary.release_published,
    git_operation_performed: templateBoundary.git_operation_performed,
    protected_action_executed: templateBoundary.protected_action_executed,
    trading_live_enabled: templateBoundary.trading_live_enabled,
    trading_full_auto_enabled: templateBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: templateBoundary.trading_order_submission_allowed,
    broker_write_allowed: templateBoundary.broker_write_allowed,
    exchange_write_allowed: templateBoundary.exchange_write_allowed,
    desktop_source_of_truth: templateBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: templateBoundary.desktop_mutation_allowed,
    human_review_required: templateBoundary.human_review_required,
    human_signoff_required: templateBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Signoff Receipt Template",
    "",
    `Status: ${result.summary.platform_release_check_signoff_receipt_template_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff ledger: ${result.summary.source_signoff_ledger_status}`,
    `Receipt templates: ${result.summary.ready_receipt_template_count}/${result.summary.receipt_template_count}`,
    `Template gates: ${result.summary.ready_template_gate_count}/${result.summary.template_gate_count}`,
    "",
    "## Receipt Templates",
    "",
    ...result.release_check_signoff_receipt_templates.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.receipt_template_status}`),
    "",
    "## Template Gates",
    "",
    ...result.release_check_signoff_receipt_template_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-signoff-receipt-template.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.schemaPath),
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
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: sha256(raw),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-release-check-signoff-receipt-template.${slugify(itemPath)}.${checkId}`,
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
