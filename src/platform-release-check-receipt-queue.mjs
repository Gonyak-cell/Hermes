import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS,
  buildPlatformReleaseCheckStatusLedger,
} from "./platform-release-check-status-ledger.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_OUT_DIR = "artifacts/platform-release-check-receipt-queue/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS,
  releaseCheckStatusLedgerSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_STATUS_LEDGER_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-queue.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-queue.v1";
const CAPABILITY_ID = "platform.release_check_receipt_queue";
const PHASE_SLOT = "P372";
const PREVIOUS_PHASE_SLOT = "P371";
const NEXT_PHASE_SLOT = "P373";

export async function runPlatformReleaseCheckReceiptQueue(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptQueue(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptQueue(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const statusLedger = await buildPlatformReleaseCheckStatusLedger({
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
    schemaPath: inputs.release_check_status_ledger_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const queueAnchor = buildQueueAnchor(statusLedger);
  const queueRows = buildQueueRows(statusLedger);
  const queueBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const queueGateRows = buildQueueGateRows({ statusLedger, packageJson, platformOpsLedger, queueRows, queueBoundary });
  const validationItems = buildValidationItems({ statusLedger, packageJson, platformOpsLedger, queueRows, queueGateRows, queueBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_queue_id: `platform-release-check-receipt-queue.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_queue_anchor: queueAnchor,
    release_check_receipt_queue_rows: queueRows,
    release_check_receipt_queue_gate_rows: queueGateRows,
    release_check_receipt_queue_boundary: queueBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_queue") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_queue_id = result.platform_release_check_receipt_queue_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-queue.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-queue-rows.json"), collectionEnvelope("platform-release-check-receipt-queue-rows.v1", "release_check_receipt_queue_rows", result.release_check_receipt_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-queue-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-queue-gate-rows.v1", "release_check_receipt_queue_gate_rows", result.release_check_receipt_queue_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-queue-boundary.json"), result.release_check_receipt_queue_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-queue-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptQueue(args);
    console.log(`Platform release-check receipt queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_queue_status}`);
    console.log(`Queue rows: ${result.summary.ready_queue_row_count}/${result.summary.queue_row_count}`);
    console.log(`Queue gates: ${result.summary.ready_queue_gate_count}/${result.summary.queue_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildQueueAnchor(statusLedger) {
  return {
    schema_version: "platform-release-check-receipt-queue-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_ledger_id: statusLedger.platform_release_check_status_ledger_id,
    source_status_ledger_status: statusLedger.summary.platform_release_check_status_ledger_status,
    source_status_ledger_hash: hashValue({
      id: statusLedger.platform_release_check_status_ledger_id,
      status: statusLedger.summary.platform_release_check_status_ledger_status,
      status_rows: statusLedger.summary.status_row_count,
      gate_rows: statusLedger.summary.status_gate_count,
    }),
  };
}

function buildQueueRows(statusLedger) {
  const sourceReady = statusLedger.validation.valid && statusLedger.summary.platform_release_check_status_ledger_status === "ready_pending_human_receipt";
  return statusLedger.release_check_status_rows.map((statusRow, index) => {
    const queueStatus = sourceReady && statusRow.release_check_status === "ready_pending_human_receipt" ? "queued_for_human_receipt" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-queue-row.v1",
      release_check_receipt_queue_row_id: `platform-release-check-receipt-queue.row.${statusRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_status_row_id: statusRow.release_check_status_row_id,
      source_evidence_row_key: statusRow.source_evidence_row_key,
      queue_position: index + 1,
      package_script_name: statusRow.package_script_name,
      required_reviewer_role: statusRow.required_reviewer_role,
      receipt_queue_status: queueStatus,
      source_release_check_status: statusRow.release_check_status,
      human_receipt_collection_required: true,
      human_receipt_pending: true,
      ready_for_human_input: true,
      ready_for_validation: false,
      release_ready_without_human_receipt: false,
      receipt_received_by_queue: false,
      receipt_validated_by_queue: false,
      signoff_completed_by_queue: false,
      approval_applied_by_queue: false,
      status_ledger_consumed_in_memory: true,
      status_ledger_artifact_read_performed_by_queue: false,
      command_execution_performed_by_queue: false,
      package_command_execution_performed_by_queue: false,
      release_check_execution_performed_by_queue: false,
      artifact_read_performed_by_queue: false,
      artifact_write_performed_by_queue: false,
      release_published_by_queue: false,
      git_operation_performed_by_queue: false,
      protected_action_executed_by_queue: false,
      trading_order_submission_performed_by_queue: false,
      desktop_source_of_truth_by_queue: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_queue_row_hash");
  });
}

function buildQueueGateRows({ statusLedger, packageJson, platformOpsLedger, queueRows, queueBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p371_status_ledger_ready", "P371 release-check status ledger source is ready.", statusLedger.validation.valid && statusLedger.summary.platform_release_check_status_ledger_status === "ready_pending_human_receipt"),
    gateRow("platform_package_script_registered", "package.json registers the P372 release-check receipt queue command.", typeof scripts["platform:release-check-receipt-queue"] === "string" && scripts["platform:release-check-receipt-queue"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P372 release-check receipt queue.", validateScript.includes("npm run platform:release-check-receipt-queue -- --check")),
    gateRow("p372_ledger_acceptance_declared", "P372 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P372: `platform:release-check-receipt-queue`")),
    gateRow("queue_rows_ready", "All release-check receipt queue rows are ready for external human input.", queueRows.length >= 4 && queueRows.every((row) => row.receipt_queue_status === "queued_for_human_receipt" && row.human_receipt_collection_required && row.human_receipt_pending && row.ready_for_human_input && !row.ready_for_validation)),
    gateRow("human_receipts_still_pending", "Receipt queue records pending human receipt collection without receiving receipts, validating receipts, completing signoff, or applying approval.", queueBoundary.human_receipt_collection_required && queueBoundary.human_receipt_pending && queueBoundary.ready_for_human_input && !queueBoundary.ready_for_validation && !queueBoundary.receipt_received && !queueBoundary.receipt_validated && !queueBoundary.signoff_completed && !queueBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Receipt queue does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !queueBoundary.command_execution_performed && !queueBoundary.artifact_read_performed && !queueBoundary.artifact_write_performed && !queueBoundary.release_published && !queueBoundary.git_operation_performed && !queueBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !queueBoundary.trading_live_enabled && !queueBoundary.trading_full_auto_enabled && !queueBoundary.trading_order_submission_allowed && !queueBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_queue_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-queue-gate-row.v1",
    release_check_receipt_queue_gate_row_id: `platform-release-check-receipt-queue.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_queue: false,
    receipt_validated_by_queue: false,
    signoff_completed_by_queue: false,
    approval_applied_by_queue: false,
    status_ledger_artifact_read_performed_by_queue: false,
    command_execution_performed_by_queue: false,
    release_check_execution_performed_by_queue: false,
    artifact_read_performed_by_queue: false,
    artifact_write_performed_by_queue: false,
    release_published_by_queue: false,
    git_operation_performed_by_queue: false,
    protected_action_executed_by_queue: false,
    trading_order_submission_performed_by_queue: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-queue-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_queue_artifact_write_requested: writeRequested,
    status_ledger_consumed_in_memory: true,
    status_ledger_artifact_read_performed: false,
    human_receipt_collection_required: true,
    human_receipt_pending: true,
    ready_for_human_input: true,
    ready_for_validation: false,
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

function buildValidationItems({ statusLedger, packageJson, platformOpsLedger, queueRows, queueGateRows, queueBoundary }) {
  return [
    validationItem("source.release_check_status_ledger", "p371_status_ledger_ready", statusLedger.validation.valid && statusLedger.summary.platform_release_check_status_ledger_status === "ready_pending_human_receipt", "P371 release-check status ledger source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P372 receipt queue checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_queue_rows", "queue_rows_ready", queueRows.length >= 4 && queueRows.every((row) => row.receipt_queue_status === "queued_for_human_receipt" && row.human_receipt_collection_required && row.human_receipt_pending && row.ready_for_human_input && !row.ready_for_validation), "Release-check receipt queue rows must be ready for human input while receipts remain pending."),
    validationItem("release_check_receipt_queue_gate_rows", "queue_gates_ready", queueGateRows.length >= 8 && queueGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_queue && !row.protected_action_executed_by_queue), "P372 release-check receipt queue gates are ready."),
    validationItem("boundary.receipts_pending", "receipts_pending", queueBoundary.read_only && queueBoundary.report_only && queueBoundary.status_ledger_consumed_in_memory && !queueBoundary.status_ledger_artifact_read_performed && queueBoundary.human_receipt_collection_required && queueBoundary.human_receipt_pending && queueBoundary.ready_for_human_input && !queueBoundary.ready_for_validation && !queueBoundary.release_ready_without_human_receipt && !queueBoundary.receipt_received && !queueBoundary.receipt_validated && !queueBoundary.signoff_completed && !queueBoundary.approval_applied, "Release-check receipt queue remains pending human receipts and does not complete signoff."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !queueBoundary.command_execution_performed && !queueBoundary.package_command_execution_performed && !queueBoundary.release_check_execution_performed && !queueBoundary.artifact_read_performed && !queueBoundary.artifact_write_performed, "Release-check receipt queue does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !queueBoundary.dependency_install_performed && !queueBoundary.package_mutation_performed && !queueBoundary.lockfile_mutation_performed && !queueBoundary.release_published && !queueBoundary.git_operation_performed && !queueBoundary.protected_action_executed, "Release-check receipt queue performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !queueBoundary.trading_live_enabled && !queueBoundary.trading_full_auto_enabled && !queueBoundary.trading_order_submission_allowed && !queueBoundary.broker_write_allowed && !queueBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !queueBoundary.desktop_source_of_truth && !queueBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation }) {
  return {
    platform_release_check_receipt_queue_status: validation.valid ? "queued_for_human_receipt" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_ledger_status: statusLedger.summary.platform_release_check_status_ledger_status,
    queue_row_count: queueRows.length,
    ready_queue_row_count: queueRows.filter((row) => row.receipt_queue_status === "queued_for_human_receipt").length,
    queue_gate_count: queueGateRows.length,
    ready_queue_gate_count: queueGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: queueBoundary.read_only,
    report_only: queueBoundary.report_only,
    status_ledger_consumed_in_memory: queueBoundary.status_ledger_consumed_in_memory,
    status_ledger_artifact_read_performed: queueBoundary.status_ledger_artifact_read_performed,
    human_receipt_collection_required: queueBoundary.human_receipt_collection_required,
    human_receipt_pending: queueBoundary.human_receipt_pending,
    ready_for_human_input: queueBoundary.ready_for_human_input,
    ready_for_validation: queueBoundary.ready_for_validation,
    release_ready_without_human_receipt: queueBoundary.release_ready_without_human_receipt,
    receipt_received: queueBoundary.receipt_received,
    receipt_validated: queueBoundary.receipt_validated,
    signoff_completed: queueBoundary.signoff_completed,
    approval_applied: queueBoundary.approval_applied,
    command_execution_performed: queueBoundary.command_execution_performed,
    package_command_execution_performed: queueBoundary.package_command_execution_performed,
    release_check_execution_performed: queueBoundary.release_check_execution_performed,
    artifact_read_performed: queueBoundary.artifact_read_performed,
    artifact_write_performed: queueBoundary.artifact_write_performed,
    dependency_install_performed: queueBoundary.dependency_install_performed,
    package_mutation_performed: queueBoundary.package_mutation_performed,
    lockfile_mutation_performed: queueBoundary.lockfile_mutation_performed,
    release_published: queueBoundary.release_published,
    git_operation_performed: queueBoundary.git_operation_performed,
    protected_action_executed: queueBoundary.protected_action_executed,
    trading_live_enabled: queueBoundary.trading_live_enabled,
    trading_full_auto_enabled: queueBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: queueBoundary.trading_order_submission_allowed,
    broker_write_allowed: queueBoundary.broker_write_allowed,
    exchange_write_allowed: queueBoundary.exchange_write_allowed,
    desktop_source_of_truth: queueBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: queueBoundary.desktop_mutation_allowed,
    human_review_required: queueBoundary.human_review_required,
    human_signoff_required: queueBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Queue",
    "",
    `Status: ${result.summary.platform_release_check_receipt_queue_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source status ledger: ${result.summary.source_status_ledger_status}`,
    `Queue rows: ${result.summary.ready_queue_row_count}/${result.summary.queue_row_count}`,
    `Queue gates: ${result.summary.ready_queue_gate_count}/${result.summary.queue_gate_count}`,
    "",
    "## Queue Rows",
    "",
    ...result.release_check_receipt_queue_rows.map((row) => `- ${row.queue_position}. ${row.package_script_name} (${row.required_reviewer_role}): ${row.receipt_queue_status}`),
    "",
    "## Queue Gates",
    "",
    ...result.release_check_receipt_queue_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-queue.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.releaseCheckStatusLedgerSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_QUEUE_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-queue.${slugify(itemPath)}.${checkId}`,
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
