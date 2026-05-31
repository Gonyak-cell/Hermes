import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS,
  buildPlatformReleaseCheckSignoffReceiptIntake,
} from "./platform-release-check-signoff-receipt-intake.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_OUT_DIR = "artifacts/platform-release-check-signoff-closeout/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS,
  releaseCheckSignoffReceiptIntakeSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_RECEIPT_INTAKE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-signoff-closeout.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-signoff-closeout.v1";
const CAPABILITY_ID = "platform.release_check_signoff_closeout";
const PHASE_SLOT = "P370";
const PREVIOUS_PHASE_SLOT = "P369";
const NEXT_PHASE_SLOT = "P371";

export async function runPlatformReleaseCheckSignoffCloseout(options = {}) {
  const result = await buildPlatformReleaseCheckSignoffCloseout(options);
  if (options.write !== false) await writePlatformReleaseCheckSignoffCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check signoff closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckSignoffCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptIntake = await buildPlatformReleaseCheckSignoffReceiptIntake({
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
    schemaPath: inputs.release_check_signoff_receipt_intake_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutAnchor = buildCloseoutAnchor(receiptIntake);
  const closeoutRows = buildCloseoutRows(receiptIntake);
  const closeoutBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const closeoutGateRows = buildCloseoutGateRows({
    receiptIntake,
    packageJson,
    platformOpsLedger,
    closeoutRows,
    closeoutBoundary,
  });
  const validationItems = buildValidationItems({
    receiptIntake,
    packageJson,
    platformOpsLedger,
    closeoutRows,
    closeoutGateRows,
    closeoutBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_signoff_closeout_id: `platform-release-check-signoff-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_signoff_closeout_anchor: closeoutAnchor,
    release_check_signoff_closeout_rows: closeoutRows,
    release_check_signoff_closeout_gate_rows: closeoutGateRows,
    release_check_signoff_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_signoff_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.platform_release_check_signoff_closeout_id = result.platform_release_check_signoff_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckSignoffCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-signoff-closeout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-signoff-closeout-rows.json"), collectionEnvelope("platform-release-check-signoff-closeout-rows.v1", "release_check_signoff_closeout_rows", result.release_check_signoff_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-closeout-gate-rows.json"), collectionEnvelope("platform-release-check-signoff-closeout-gate-rows.v1", "release_check_signoff_closeout_gate_rows", result.release_check_signoff_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-closeout-boundary.json"), result.release_check_signoff_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-signoff-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckSignoffCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckSignoffCloseout(args);
    console.log(`Platform release-check signoff closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_signoff_closeout_status}`);
    console.log(`Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`);
    console.log(`Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor(receiptIntake) {
  return {
    schema_version: "platform-release-check-signoff-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_intake_id: receiptIntake.platform_release_check_signoff_receipt_intake_id,
    source_receipt_intake_status: receiptIntake.summary.platform_release_check_signoff_receipt_intake_status,
    source_receipt_intake_hash: hashValue({
      id: receiptIntake.platform_release_check_signoff_receipt_intake_id,
      status: receiptIntake.summary.platform_release_check_signoff_receipt_intake_status,
      intake_rows: receiptIntake.summary.intake_row_count,
      gate_rows: receiptIntake.summary.intake_gate_count,
    }),
  };
}

function buildCloseoutRows(receiptIntake) {
  const sourceReady = receiptIntake.validation.valid && receiptIntake.summary.platform_release_check_signoff_receipt_intake_status === "ready";
  return receiptIntake.release_check_signoff_receipt_intake_rows.map((intakeRow, index) => {
    const closeoutStatus = sourceReady && intakeRow.receipt_intake_status === "awaiting_human_receipt" ? "ready_for_human_receipt_collection" : "blocked";
    const row = {
      schema_version: "platform-release-check-signoff-closeout-row.v1",
      release_check_signoff_closeout_row_id: `platform-release-check-signoff-closeout.row.${intakeRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_intake_row_id: intakeRow.release_check_signoff_receipt_intake_row_id,
      source_evidence_row_key: intakeRow.source_evidence_row_key,
      package_script_name: intakeRow.package_script_name,
      required_reviewer_role: intakeRow.required_reviewer_role,
      closeout_status: closeoutStatus,
      source_receipt_intake_status: intakeRow.receipt_intake_status,
      human_receipt_collection_required: true,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      signoff_completed_by_closeout: false,
      approval_applied_by_closeout: false,
      receipt_intake_consumed_in_memory: true,
      receipt_intake_artifact_read_performed_by_closeout: false,
      command_execution_performed_by_closeout: false,
      package_command_execution_performed_by_closeout: false,
      release_check_execution_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      release_published_by_closeout: false,
      git_operation_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      trading_order_submission_performed_by_closeout: false,
      desktop_source_of_truth_by_closeout: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_signoff_closeout_row_hash");
  });
}

function buildCloseoutGateRows({ receiptIntake, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p369_receipt_intake_ready", "P369 release-check signoff receipt intake source is ready.", receiptIntake.validation.valid && receiptIntake.summary.platform_release_check_signoff_receipt_intake_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P370 release-check signoff closeout command.", typeof scripts["platform:release-check-signoff-closeout"] === "string" && scripts["platform:release-check-signoff-closeout"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P370 release-check signoff closeout.", validateScript.includes("npm run platform:release-check-signoff-closeout -- --check")),
    gateRow("p370_ledger_acceptance_declared", "P370 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P370: `platform:release-check-signoff-closeout`")),
    gateRow("closeout_rows_ready", "All release-check signoff closeout rows are ready for human receipt collection.", closeoutRows.length >= 4 && closeoutRows.every((row) => row.closeout_status === "ready_for_human_receipt_collection")),
    gateRow("no_receipt_or_signoff_completion", "Closeout records readiness without receiving receipts, validating receipts, completing signoff, or applying approval.", !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Closeout does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !closeoutBoundary.command_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_signoff_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-signoff-closeout-gate-row.v1",
    release_check_signoff_closeout_gate_row_id: `platform-release-check-signoff-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    signoff_completed_by_closeout: false,
    approval_applied_by_closeout: false,
    receipt_intake_artifact_read_performed_by_closeout: false,
    command_execution_performed_by_closeout: false,
    release_check_execution_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    release_published_by_closeout: false,
    git_operation_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    trading_order_submission_performed_by_closeout: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-signoff-closeout-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    closeout_artifact_write_requested: writeRequested,
    receipt_intake_consumed_in_memory: true,
    receipt_intake_artifact_read_performed: false,
    receipt_received: false,
    receipt_validated: false,
    human_receipt_collection_required: true,
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

function buildValidationItems({ receiptIntake, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.release_check_signoff_receipt_intake", "p369_receipt_intake_ready", receiptIntake.validation.valid && receiptIntake.summary.platform_release_check_signoff_receipt_intake_status === "ready", "P369 release-check signoff receipt intake source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P370 signoff closeout checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_signoff_closeout_rows", "closeout_rows_ready", closeoutRows.length >= 4 && closeoutRows.every((row) => row.closeout_status === "ready_for_human_receipt_collection" && !row.receipt_received_by_closeout && !row.approval_applied_by_closeout), "Release-check signoff closeout rows are ready for human receipt collection."),
    validationItem("release_check_signoff_closeout_gate_rows", "closeout_gates_ready", closeoutGateRows.length >= 8 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_closeout && !row.protected_action_executed_by_closeout), "P370 release-check signoff closeout gates are ready."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", closeoutBoundary.read_only && closeoutBoundary.report_only && closeoutBoundary.receipt_intake_consumed_in_memory && !closeoutBoundary.receipt_intake_artifact_read_performed && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied, "Release-check signoff closeout consumes P369 in memory and does not receive, validate, or apply receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.release_check_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed, "Release-check signoff closeout does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed, "Release-check signoff closeout performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    platform_release_check_signoff_closeout_status: validation.valid ? "ready_for_human_receipt_collection" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_intake_status: receiptIntake.summary.platform_release_check_signoff_receipt_intake_status,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === "ready_for_human_receipt_collection").length,
    closeout_gate_count: closeoutGateRows.length,
    ready_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
    receipt_intake_consumed_in_memory: closeoutBoundary.receipt_intake_consumed_in_memory,
    receipt_intake_artifact_read_performed: closeoutBoundary.receipt_intake_artifact_read_performed,
    receipt_received: closeoutBoundary.receipt_received,
    receipt_validated: closeoutBoundary.receipt_validated,
    human_receipt_collection_required: closeoutBoundary.human_receipt_collection_required,
    signoff_completed: closeoutBoundary.signoff_completed,
    approval_applied: closeoutBoundary.approval_applied,
    command_execution_performed: closeoutBoundary.command_execution_performed,
    package_command_execution_performed: closeoutBoundary.package_command_execution_performed,
    release_check_execution_performed: closeoutBoundary.release_check_execution_performed,
    artifact_read_performed: closeoutBoundary.artifact_read_performed,
    artifact_write_performed: closeoutBoundary.artifact_write_performed,
    dependency_install_performed: closeoutBoundary.dependency_install_performed,
    package_mutation_performed: closeoutBoundary.package_mutation_performed,
    lockfile_mutation_performed: closeoutBoundary.lockfile_mutation_performed,
    release_published: closeoutBoundary.release_published,
    git_operation_performed: closeoutBoundary.git_operation_performed,
    protected_action_executed: closeoutBoundary.protected_action_executed,
    trading_live_enabled: closeoutBoundary.trading_live_enabled,
    trading_full_auto_enabled: closeoutBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: closeoutBoundary.trading_order_submission_allowed,
    broker_write_allowed: closeoutBoundary.broker_write_allowed,
    exchange_write_allowed: closeoutBoundary.exchange_write_allowed,
    desktop_source_of_truth: closeoutBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: closeoutBoundary.desktop_mutation_allowed,
    human_review_required: closeoutBoundary.human_review_required,
    human_signoff_required: closeoutBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Signoff Closeout",
    "",
    `Status: ${result.summary.platform_release_check_signoff_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt intake: ${result.summary.source_receipt_intake_status}`,
    `Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`,
    `Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`,
    "",
    "## Closeout Rows",
    "",
    ...result.release_check_signoff_closeout_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.closeout_status}`),
    "",
    "## Closeout Gates",
    "",
    ...result.release_check_signoff_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-signoff-closeout.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_CLOSEOUT_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-signoff-closeout.${slugify(itemPath)}.${checkId}`,
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
