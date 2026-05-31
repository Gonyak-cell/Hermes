import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS,
  buildPlatformReleaseCheckReviewPacket,
} from "./platform-release-check-review-packet.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_OUT_DIR = "artifacts/platform-release-check-signoff-ledger/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS,
  releaseCheckReviewPacketSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-signoff-ledger.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-signoff-ledger.v1";
const CAPABILITY_ID = "platform.release_check_signoff_ledger";
const PHASE_SLOT = "P367";
const PREVIOUS_PHASE_SLOT = "P366";
const NEXT_PHASE_SLOT = "P368";

export async function runPlatformReleaseCheckSignoffLedger(options = {}) {
  const result = await buildPlatformReleaseCheckSignoffLedger(options);
  if (options.write !== false) await writePlatformReleaseCheckSignoffLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check signoff ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckSignoffLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const reviewPacket = await buildPlatformReleaseCheckReviewPacket({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    releaseCheckEvidenceIndexSchemaPath: inputs.release_check_evidence_index_schema_path,
    schemaPath: inputs.release_check_review_packet_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const signoffAnchor = buildSignoffAnchor(reviewPacket);
  const signoffRows = buildSignoffRows(reviewPacket);
  const signoffBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const signoffGateRows = buildSignoffGateRows({
    reviewPacket,
    packageJson,
    platformOpsLedger,
    signoffRows,
    signoffBoundary,
  });
  const validationItems = buildValidationItems({
    reviewPacket,
    packageJson,
    platformOpsLedger,
    signoffRows,
    signoffGateRows,
    signoffBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ reviewPacket, signoffRows, signoffGateRows, signoffBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_signoff_ledger_id: `platform-release-check-signoff-ledger.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_signoff_ledger_anchor: signoffAnchor,
    release_check_signoff_rows: signoffRows,
    release_check_signoff_gate_rows: signoffGateRows,
    release_check_signoff_boundary: signoffBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_signoff_ledger") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ reviewPacket, signoffRows, signoffGateRows, signoffBoundary, validation: result.validation });
  result.summary.platform_release_check_signoff_ledger_id = result.platform_release_check_signoff_ledger_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckSignoffLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-signoff-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-signoff-rows.json"), collectionEnvelope("platform-release-check-signoff-rows.v1", "release_check_signoff_rows", result.release_check_signoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-gate-rows.json"), collectionEnvelope("platform-release-check-signoff-gate-rows.v1", "release_check_signoff_gate_rows", result.release_check_signoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-signoff-boundary.json"), result.release_check_signoff_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-signoff-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckSignoffLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckSignoffLedger(args);
    console.log(`Platform release-check signoff ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_signoff_ledger_status}`);
    console.log(`Signoff rows: ${result.summary.ready_signoff_row_count}/${result.summary.signoff_row_count}`);
    console.log(`Signoff gates: ${result.summary.ready_signoff_gate_count}/${result.summary.signoff_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSignoffAnchor(reviewPacket) {
  return {
    schema_version: "platform-release-check-signoff-ledger-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_review_packet_id: reviewPacket.platform_release_check_review_packet_id,
    source_review_packet_status: reviewPacket.summary.platform_release_check_review_packet_status,
    source_review_packet_hash: hashValue({
      id: reviewPacket.platform_release_check_review_packet_id,
      status: reviewPacket.summary.platform_release_check_review_packet_status,
      review_rows: reviewPacket.summary.review_packet_row_count,
      gate_rows: reviewPacket.summary.review_packet_gate_count,
    }),
  };
}

function buildSignoffRows(reviewPacket) {
  const sourceReady = reviewPacket.validation.valid && reviewPacket.summary.platform_release_check_review_packet_status === "ready";
  return reviewPacket.release_check_review_packet_rows.map((reviewRow, index) => {
    const signoffStatus = sourceReady && reviewRow.review_packet_status === "ready" ? "ready_for_human_signoff" : "blocked";
    const row = {
      schema_version: "platform-release-check-signoff-ledger-row.v1",
      release_check_signoff_row_id: `platform-release-check-signoff-ledger.row.${reviewRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_review_packet_row_id: reviewRow.release_check_review_packet_row_id,
      source_evidence_row_key: reviewRow.source_evidence_row_key,
      source_phase_slot: reviewRow.source_phase_slot,
      package_script_name: reviewRow.package_script_name,
      check_command: reviewRow.check_command,
      required_reviewer_role: reviewRow.required_reviewer_role,
      signoff_requirement_id: `release-check-signoff.${slugify(reviewRow.package_script_name)}`,
      expected_signoff_decision: "signoff_ready_or_return_with_blocker",
      required_receipt_type: "human_release_check_signoff_receipt",
      signoff_status: signoffStatus,
      source_review_packet_status: reviewRow.review_packet_status,
      review_completed_by_ledger: false,
      signoff_completed_by_ledger: false,
      approval_applied_by_ledger: false,
      receipt_materialized_by_ledger: false,
      review_packet_consumed_in_memory: true,
      review_packet_artifact_read_performed_by_ledger: false,
      command_execution_performed_by_ledger: false,
      package_command_execution_performed_by_ledger: false,
      release_check_execution_performed_by_ledger: false,
      artifact_read_performed_by_ledger: false,
      artifact_write_performed_by_ledger: false,
      release_published_by_ledger: false,
      git_operation_performed_by_ledger: false,
      protected_action_executed_by_ledger: false,
      trading_order_submission_performed_by_ledger: false,
      desktop_source_of_truth_by_ledger: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Human signoff receipt is required before using ${reviewRow.package_script_name} as release-facing signoff evidence.`,
    };
    return withOrdinalAndHash(row, index, "release_check_signoff_row_hash");
  });
}

function buildSignoffGateRows({ reviewPacket, packageJson, platformOpsLedger, signoffRows, signoffBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p366_review_packet_ready", "P366 release-check review packet source is ready.", reviewPacket.validation.valid && reviewPacket.summary.platform_release_check_review_packet_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P367 release-check signoff ledger command.", typeof scripts["platform:release-check-signoff-ledger"] === "string" && scripts["platform:release-check-signoff-ledger"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P367 release-check signoff ledger.", validateScript.includes("npm run platform:release-check-signoff-ledger -- --check")),
    gateRow("p367_ledger_acceptance_declared", "P367 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P367: `platform:release-check-signoff-ledger`")),
    gateRow("signoff_rows_ready", "All release-check signoff rows are ready for human signoff.", signoffRows.length >= 4 && signoffRows.every((row) => row.signoff_status === "ready_for_human_signoff")),
    gateRow("no_signoff_or_approval_application", "Signoff ledger records signoff requirements without completing signoff or applying approval.", !signoffBoundary.signoff_completed && !signoffBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Signoff ledger does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !signoffBoundary.command_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !signoffBoundary.trading_live_enabled && !signoffBoundary.trading_full_auto_enabled && !signoffBoundary.trading_order_submission_allowed && !signoffBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_signoff_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-signoff-ledger-gate-row.v1",
    release_check_signoff_gate_row_id: `platform-release-check-signoff-ledger.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_ledger: false,
    signoff_completed_by_ledger: false,
    approval_applied_by_ledger: false,
    receipt_materialized_by_ledger: false,
    review_packet_artifact_read_performed_by_ledger: false,
    command_execution_performed_by_ledger: false,
    release_check_execution_performed_by_ledger: false,
    artifact_read_performed_by_ledger: false,
    artifact_write_performed_by_ledger: false,
    release_published_by_ledger: false,
    git_operation_performed_by_ledger: false,
    protected_action_executed_by_ledger: false,
    trading_order_submission_performed_by_ledger: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-signoff-ledger-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    signoff_ledger_artifact_write_requested: writeRequested,
    review_packet_consumed_in_memory: true,
    review_packet_artifact_read_performed: false,
    review_completed: false,
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
    human_review_note: "Human signoff receipts must be collected outside this ledger before release-check readiness can be treated as signed off.",
  };
}

function buildValidationItems({ reviewPacket, packageJson, platformOpsLedger, signoffRows, signoffGateRows, signoffBoundary }) {
  return [
    validationItem("source.release_check_review_packet", "p366_review_packet_ready", reviewPacket.validation.valid && reviewPacket.summary.platform_release_check_review_packet_status === "ready", "P366 release-check review packet source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P367 signoff ledger checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_signoff_rows", "signoff_rows_ready", signoffRows.length >= 4 && signoffRows.every((row) => row.signoff_status === "ready_for_human_signoff" && !row.signoff_completed_by_ledger && !row.approval_applied_by_ledger && !row.command_execution_performed_by_ledger), "Release-check signoff rows are ready and ledger-only."),
    validationItem("release_check_signoff_gate_rows", "signoff_gates_ready", signoffGateRows.length >= 8 && signoffGateRows.every((row) => row.gate_status === "ready" && !row.signoff_completed_by_ledger && !row.protected_action_executed_by_ledger), "P367 release-check signoff gates are ready and ledger-only."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", signoffBoundary.read_only && signoffBoundary.report_only && signoffBoundary.review_packet_consumed_in_memory && !signoffBoundary.review_packet_artifact_read_performed && !signoffBoundary.signoff_completed && !signoffBoundary.approval_applied && !signoffBoundary.receipt_materialized, "Release-check signoff ledger consumes P366 in memory and does not complete signoff, apply approval, or materialize receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !signoffBoundary.command_execution_performed && !signoffBoundary.package_command_execution_performed && !signoffBoundary.release_check_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed, "Release-check signoff ledger does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !signoffBoundary.dependency_install_performed && !signoffBoundary.package_mutation_performed && !signoffBoundary.lockfile_mutation_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed, "Release-check signoff ledger performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !signoffBoundary.trading_live_enabled && !signoffBoundary.trading_full_auto_enabled && !signoffBoundary.trading_order_submission_allowed && !signoffBoundary.broker_write_allowed && !signoffBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !signoffBoundary.desktop_source_of_truth && !signoffBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ reviewPacket, signoffRows, signoffGateRows, signoffBoundary, validation }) {
  return {
    platform_release_check_signoff_ledger_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_review_packet_status: reviewPacket.summary.platform_release_check_review_packet_status,
    signoff_row_count: signoffRows.length,
    ready_signoff_row_count: signoffRows.filter((row) => row.signoff_status === "ready_for_human_signoff").length,
    signoff_gate_count: signoffGateRows.length,
    ready_signoff_gate_count: signoffGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: signoffBoundary.read_only,
    report_only: signoffBoundary.report_only,
    signoff_ledger_artifact_write_requested: signoffBoundary.signoff_ledger_artifact_write_requested,
    review_packet_consumed_in_memory: signoffBoundary.review_packet_consumed_in_memory,
    review_packet_artifact_read_performed: signoffBoundary.review_packet_artifact_read_performed,
    review_completed: signoffBoundary.review_completed,
    signoff_completed: signoffBoundary.signoff_completed,
    approval_applied: signoffBoundary.approval_applied,
    receipt_materialized: signoffBoundary.receipt_materialized,
    command_execution_performed: signoffBoundary.command_execution_performed,
    package_command_execution_performed: signoffBoundary.package_command_execution_performed,
    release_check_execution_performed: signoffBoundary.release_check_execution_performed,
    artifact_read_performed: signoffBoundary.artifact_read_performed,
    artifact_write_performed: signoffBoundary.artifact_write_performed,
    dependency_install_performed: signoffBoundary.dependency_install_performed,
    package_mutation_performed: signoffBoundary.package_mutation_performed,
    lockfile_mutation_performed: signoffBoundary.lockfile_mutation_performed,
    release_published: signoffBoundary.release_published,
    git_operation_performed: signoffBoundary.git_operation_performed,
    protected_action_executed: signoffBoundary.protected_action_executed,
    trading_live_enabled: signoffBoundary.trading_live_enabled,
    trading_full_auto_enabled: signoffBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: signoffBoundary.trading_order_submission_allowed,
    broker_write_allowed: signoffBoundary.broker_write_allowed,
    exchange_write_allowed: signoffBoundary.exchange_write_allowed,
    desktop_source_of_truth: signoffBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: signoffBoundary.desktop_mutation_allowed,
    human_review_required: signoffBoundary.human_review_required,
    human_signoff_required: signoffBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Signoff Ledger",
    "",
    `Status: ${result.summary.platform_release_check_signoff_ledger_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source review packet: ${result.summary.source_review_packet_status}`,
    `Signoff rows: ${result.summary.ready_signoff_row_count}/${result.summary.signoff_row_count}`,
    `Signoff gates: ${result.summary.ready_signoff_gate_count}/${result.summary.signoff_gate_count}`,
    "",
    "## Signoff Rows",
    "",
    ...result.release_check_signoff_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.signoff_status}`),
    "",
    "## Signoff Gates",
    "",
    ...result.release_check_signoff_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-signoff-ledger.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.releaseCheckReviewPacketSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_SIGNOFF_LEDGER_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-signoff-ledger.${slugify(itemPath)}.${checkId}`,
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
