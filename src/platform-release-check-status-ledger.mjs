import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS,
  buildPlatformReleaseCheckSignoffCloseout,
} from "./platform-release-check-signoff-closeout.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_OUT_DIR = "artifacts/platform-release-check-status-ledger/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS,
  releaseCheckSignoffCloseoutSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-status-ledger.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-status-ledger.v1";
const CAPABILITY_ID = "platform.release_check_status_ledger";
const PHASE_SLOT = "P371";
const PREVIOUS_PHASE_SLOT = "P370";
const NEXT_PHASE_SLOT = "P372";

export async function runPlatformReleaseCheckStatusLedger(options = {}) {
  const result = await buildPlatformReleaseCheckStatusLedger(options);
  if (options.write !== false) await writePlatformReleaseCheckStatusLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check status ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckStatusLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const closeout = await buildPlatformReleaseCheckSignoffCloseout({
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
    schemaPath: inputs.release_check_signoff_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const statusAnchor = buildStatusAnchor(closeout);
  const statusRows = buildStatusRows(closeout);
  const statusBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const statusGateRows = buildStatusGateRows({ closeout, packageJson, platformOpsLedger, statusRows, statusBoundary });
  const validationItems = buildValidationItems({ closeout, packageJson, platformOpsLedger, statusRows, statusGateRows, statusBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_status_ledger_id: `platform-release-check-status-ledger.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_status_ledger_anchor: statusAnchor,
    release_check_status_rows: statusRows,
    release_check_status_gate_rows: statusGateRows,
    release_check_status_boundary: statusBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_status_ledger") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation: result.validation });
  result.summary.platform_release_check_status_ledger_id = result.platform_release_check_status_ledger_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckStatusLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-status-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-status-rows.json"), collectionEnvelope("platform-release-check-status-rows.v1", "release_check_status_rows", result.release_check_status_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-status-gate-rows.json"), collectionEnvelope("platform-release-check-status-gate-rows.v1", "release_check_status_gate_rows", result.release_check_status_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-status-boundary.json"), result.release_check_status_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-status-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckStatusLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckStatusLedger(args);
    console.log(`Platform release-check status ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_status_ledger_status}`);
    console.log(`Status rows: ${result.summary.ready_status_row_count}/${result.summary.status_row_count}`);
    console.log(`Status gates: ${result.summary.ready_status_gate_count}/${result.summary.status_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildStatusAnchor(closeout) {
  return {
    schema_version: "platform-release-check-status-ledger-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_closeout_id: closeout.platform_release_check_signoff_closeout_id,
    source_signoff_closeout_status: closeout.summary.platform_release_check_signoff_closeout_status,
    source_signoff_closeout_hash: hashValue({
      id: closeout.platform_release_check_signoff_closeout_id,
      status: closeout.summary.platform_release_check_signoff_closeout_status,
      closeout_rows: closeout.summary.closeout_row_count,
      gate_rows: closeout.summary.closeout_gate_count,
    }),
  };
}

function buildStatusRows(closeout) {
  const sourceReady = closeout.validation.valid && closeout.summary.platform_release_check_signoff_closeout_status === "ready_for_human_receipt_collection";
  return closeout.release_check_signoff_closeout_rows.map((closeoutRow, index) => {
    const status = sourceReady && closeoutRow.closeout_status === "ready_for_human_receipt_collection" ? "ready_pending_human_receipt" : "blocked";
    const row = {
      schema_version: "platform-release-check-status-ledger-row.v1",
      release_check_status_row_id: `platform-release-check-status-ledger.row.${closeoutRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_closeout_row_id: closeoutRow.release_check_signoff_closeout_row_id,
      source_evidence_row_key: closeoutRow.source_evidence_row_key,
      package_script_name: closeoutRow.package_script_name,
      required_reviewer_role: closeoutRow.required_reviewer_role,
      release_check_status: status,
      source_closeout_status: closeoutRow.closeout_status,
      human_receipt_collection_required: true,
      human_receipt_pending: true,
      release_ready_without_human_receipt: false,
      receipt_received_by_status_ledger: false,
      receipt_validated_by_status_ledger: false,
      signoff_completed_by_status_ledger: false,
      approval_applied_by_status_ledger: false,
      signoff_closeout_consumed_in_memory: true,
      signoff_closeout_artifact_read_performed_by_status_ledger: false,
      command_execution_performed_by_status_ledger: false,
      package_command_execution_performed_by_status_ledger: false,
      release_check_execution_performed_by_status_ledger: false,
      artifact_read_performed_by_status_ledger: false,
      artifact_write_performed_by_status_ledger: false,
      release_published_by_status_ledger: false,
      git_operation_performed_by_status_ledger: false,
      protected_action_executed_by_status_ledger: false,
      trading_order_submission_performed_by_status_ledger: false,
      desktop_source_of_truth_by_status_ledger: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_status_row_hash");
  });
}

function buildStatusGateRows({ closeout, packageJson, platformOpsLedger, statusRows, statusBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p370_signoff_closeout_ready", "P370 release-check signoff closeout source is ready.", closeout.validation.valid && closeout.summary.platform_release_check_signoff_closeout_status === "ready_for_human_receipt_collection"),
    gateRow("platform_package_script_registered", "package.json registers the P371 release-check status ledger command.", typeof scripts["platform:release-check-status-ledger"] === "string" && scripts["platform:release-check-status-ledger"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P371 release-check status ledger.", validateScript.includes("npm run platform:release-check-status-ledger -- --check")),
    gateRow("p371_ledger_acceptance_declared", "P371 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P371: `platform:release-check-status-ledger`")),
    gateRow("status_rows_ready", "All release-check status rows are ready and pending human receipts.", statusRows.length >= 4 && statusRows.every((row) => row.release_check_status === "ready_pending_human_receipt" && row.human_receipt_collection_required && row.human_receipt_pending && !row.release_ready_without_human_receipt)),
    gateRow("human_receipts_still_pending", "Status ledger records pending human receipt collection without receiving receipts, validating receipts, completing signoff, or applying approval.", statusBoundary.human_receipt_collection_required && statusBoundary.human_receipt_pending && !statusBoundary.receipt_received && !statusBoundary.receipt_validated && !statusBoundary.signoff_completed && !statusBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Status ledger does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !statusBoundary.command_execution_performed && !statusBoundary.artifact_read_performed && !statusBoundary.artifact_write_performed && !statusBoundary.release_published && !statusBoundary.git_operation_performed && !statusBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !statusBoundary.trading_live_enabled && !statusBoundary.trading_full_auto_enabled && !statusBoundary.trading_order_submission_allowed && !statusBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_status_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-status-ledger-gate-row.v1",
    release_check_status_gate_row_id: `platform-release-check-status-ledger.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_status_ledger: false,
    receipt_validated_by_status_ledger: false,
    signoff_completed_by_status_ledger: false,
    approval_applied_by_status_ledger: false,
    signoff_closeout_artifact_read_performed_by_status_ledger: false,
    command_execution_performed_by_status_ledger: false,
    release_check_execution_performed_by_status_ledger: false,
    artifact_read_performed_by_status_ledger: false,
    artifact_write_performed_by_status_ledger: false,
    release_published_by_status_ledger: false,
    git_operation_performed_by_status_ledger: false,
    protected_action_executed_by_status_ledger: false,
    trading_order_submission_performed_by_status_ledger: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-status-ledger-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    status_ledger_artifact_write_requested: writeRequested,
    signoff_closeout_consumed_in_memory: true,
    signoff_closeout_artifact_read_performed: false,
    human_receipt_collection_required: true,
    human_receipt_pending: true,
    release_ready_without_human_receipt: false,
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

function buildValidationItems({ closeout, packageJson, platformOpsLedger, statusRows, statusGateRows, statusBoundary }) {
  return [
    validationItem("source.release_check_signoff_closeout", "p370_signoff_closeout_ready", closeout.validation.valid && closeout.summary.platform_release_check_signoff_closeout_status === "ready_for_human_receipt_collection", "P370 release-check signoff closeout source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P371 status ledger checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_status_rows", "status_rows_ready", statusRows.length >= 4 && statusRows.every((row) => row.release_check_status === "ready_pending_human_receipt" && row.human_receipt_collection_required && row.human_receipt_pending && !row.release_ready_without_human_receipt), "Release-check status rows must be ready while pending human receipts."),
    validationItem("release_check_status_gate_rows", "status_gates_ready", statusGateRows.length >= 8 && statusGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_status_ledger && !row.protected_action_executed_by_status_ledger), "P371 release-check status ledger gates are ready."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", statusBoundary.read_only && statusBoundary.report_only && statusBoundary.signoff_closeout_consumed_in_memory && !statusBoundary.signoff_closeout_artifact_read_performed && statusBoundary.human_receipt_collection_required && statusBoundary.human_receipt_pending && !statusBoundary.release_ready_without_human_receipt && !statusBoundary.receipt_received && !statusBoundary.receipt_validated && !statusBoundary.signoff_completed && !statusBoundary.approval_applied, "Release-check status ledger remains pending human receipts and does not complete signoff."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !statusBoundary.command_execution_performed && !statusBoundary.package_command_execution_performed && !statusBoundary.release_check_execution_performed && !statusBoundary.artifact_read_performed && !statusBoundary.artifact_write_performed, "Release-check status ledger does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !statusBoundary.dependency_install_performed && !statusBoundary.package_mutation_performed && !statusBoundary.lockfile_mutation_performed && !statusBoundary.release_published && !statusBoundary.git_operation_performed && !statusBoundary.protected_action_executed, "Release-check status ledger performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !statusBoundary.trading_live_enabled && !statusBoundary.trading_full_auto_enabled && !statusBoundary.trading_order_submission_allowed && !statusBoundary.broker_write_allowed && !statusBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !statusBoundary.desktop_source_of_truth && !statusBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation }) {
  return {
    platform_release_check_status_ledger_status: validation.valid ? "ready_pending_human_receipt" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_closeout_status: closeout.summary.platform_release_check_signoff_closeout_status,
    status_row_count: statusRows.length,
    ready_status_row_count: statusRows.filter((row) => row.release_check_status === "ready_pending_human_receipt").length,
    status_gate_count: statusGateRows.length,
    ready_status_gate_count: statusGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: statusBoundary.read_only,
    report_only: statusBoundary.report_only,
    signoff_closeout_consumed_in_memory: statusBoundary.signoff_closeout_consumed_in_memory,
    signoff_closeout_artifact_read_performed: statusBoundary.signoff_closeout_artifact_read_performed,
    human_receipt_collection_required: statusBoundary.human_receipt_collection_required,
    human_receipt_pending: statusBoundary.human_receipt_pending,
    release_ready_without_human_receipt: statusBoundary.release_ready_without_human_receipt,
    receipt_received: statusBoundary.receipt_received,
    receipt_validated: statusBoundary.receipt_validated,
    signoff_completed: statusBoundary.signoff_completed,
    approval_applied: statusBoundary.approval_applied,
    command_execution_performed: statusBoundary.command_execution_performed,
    package_command_execution_performed: statusBoundary.package_command_execution_performed,
    release_check_execution_performed: statusBoundary.release_check_execution_performed,
    artifact_read_performed: statusBoundary.artifact_read_performed,
    artifact_write_performed: statusBoundary.artifact_write_performed,
    dependency_install_performed: statusBoundary.dependency_install_performed,
    package_mutation_performed: statusBoundary.package_mutation_performed,
    lockfile_mutation_performed: statusBoundary.lockfile_mutation_performed,
    release_published: statusBoundary.release_published,
    git_operation_performed: statusBoundary.git_operation_performed,
    protected_action_executed: statusBoundary.protected_action_executed,
    trading_live_enabled: statusBoundary.trading_live_enabled,
    trading_full_auto_enabled: statusBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: statusBoundary.trading_order_submission_allowed,
    broker_write_allowed: statusBoundary.broker_write_allowed,
    exchange_write_allowed: statusBoundary.exchange_write_allowed,
    desktop_source_of_truth: statusBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: statusBoundary.desktop_mutation_allowed,
    human_review_required: statusBoundary.human_review_required,
    human_signoff_required: statusBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Status Ledger",
    "",
    `Status: ${result.summary.platform_release_check_status_ledger_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff closeout: ${result.summary.source_signoff_closeout_status}`,
    `Status rows: ${result.summary.ready_status_row_count}/${result.summary.status_row_count}`,
    `Status gates: ${result.summary.ready_status_gate_count}/${result.summary.status_gate_count}`,
    "",
    "## Status Rows",
    "",
    ...result.release_check_status_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.release_check_status}`),
    "",
    "## Status Gates",
    "",
    ...result.release_check_status_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-status-ledger.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-status-ledger.${slugify(itemPath)}.${checkId}`,
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
