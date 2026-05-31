import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS,
  buildPlatformReleaseCheckEvidenceIndex,
} from "./platform-release-check-evidence-index.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_OUT_DIR = "artifacts/platform-release-check-review-packet/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS,
  releaseCheckEvidenceIndexSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_EVIDENCE_INDEX_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-review-packet.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-review-packet.v1";
const CAPABILITY_ID = "platform.release_check_review_packet";
const PHASE_SLOT = "P366";
const PREVIOUS_PHASE_SLOT = "P365";
const NEXT_PHASE_SLOT = "P367";

const REVIEW_ROLE_BY_COMMAND = {
  "trading:release-check": "trading_safety_reviewer",
  "platform:ops-check": "platform_operator",
  "platform:release-check": "release_manager",
  "platform:release-check-no-write-audit": "qa_reviewer",
};

export async function runPlatformReleaseCheckReviewPacket(options = {}) {
  const result = await buildPlatformReleaseCheckReviewPacket(options);
  if (options.write !== false) await writePlatformReleaseCheckReviewPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check review packet failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReviewPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceIndex = await buildPlatformReleaseCheckEvidenceIndex({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    schemaPath: inputs.release_check_evidence_index_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewAnchor = buildReviewAnchor(evidenceIndex);
  const reviewRows = buildReviewRows(evidenceIndex);
  const reviewBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const reviewGateRows = buildReviewGateRows({
    evidenceIndex,
    packageJson,
    platformOpsLedger,
    reviewRows,
    reviewBoundary,
  });
  const validationItems = buildValidationItems({
    evidenceIndex,
    packageJson,
    platformOpsLedger,
    reviewRows,
    reviewGateRows,
    reviewBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ evidenceIndex, reviewRows, reviewGateRows, reviewBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_review_packet_id: `platform-release-check-review-packet.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_review_packet_anchor: reviewAnchor,
    release_check_review_packet_rows: reviewRows,
    release_check_review_packet_gate_rows: reviewGateRows,
    release_check_review_packet_boundary: reviewBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_review_packet") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ evidenceIndex, reviewRows, reviewGateRows, reviewBoundary, validation: result.validation });
  result.summary.platform_release_check_review_packet_id = result.platform_release_check_review_packet_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReviewPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-review-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-review-packet-rows.json"), collectionEnvelope("platform-release-check-review-packet-rows.v1", "release_check_review_packet_rows", result.release_check_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-review-packet-gate-rows.json"), collectionEnvelope("platform-release-check-review-packet-gate-rows.v1", "release_check_review_packet_gate_rows", result.release_check_review_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-review-packet-boundary.json"), result.release_check_review_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-review-packet-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReviewPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReviewPacket(args);
    console.log(`Platform release-check review packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_review_packet_status}`);
    console.log(`Review rows: ${result.summary.ready_review_packet_row_count}/${result.summary.review_packet_row_count}`);
    console.log(`Review gates: ${result.summary.ready_review_packet_gate_count}/${result.summary.review_packet_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReviewAnchor(evidenceIndex) {
  return {
    schema_version: "platform-release-check-review-packet-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_evidence_index_id: evidenceIndex.evidence_index_id,
    source_evidence_index_status: evidenceIndex.summary.evidence_index_status,
    source_evidence_index_hash: hashValue({
      id: evidenceIndex.evidence_index_id,
      status: evidenceIndex.summary.evidence_index_status,
      evidence_rows: evidenceIndex.summary.evidence_row_count,
      gate_rows: evidenceIndex.summary.evidence_gate_count,
    }),
  };
}

function buildReviewRows(evidenceIndex) {
  const sourceReady = evidenceIndex.validation.valid && evidenceIndex.summary.evidence_index_status === "ready";
  return evidenceIndex.release_check_evidence_rows.map((evidenceRow, index) => {
    const packetStatus = sourceReady && evidenceRow.evidence_status === "ready" ? "ready" : "blocked";
    const row = {
      schema_version: "platform-release-check-review-packet-row.v1",
      release_check_review_packet_row_id: `platform-release-check-review-packet.row.${evidenceRow.row_key}`,
      phase_slot: PHASE_SLOT,
      source_evidence_row_key: evidenceRow.row_key,
      source_phase_slot: evidenceRow.source_phase_slot,
      package_script_name: evidenceRow.package_script_name,
      check_command: evidenceRow.check_command,
      doc_path: evidenceRow.doc_path,
      expected_artifact_dir: evidenceRow.expected_artifact_dir,
      validation_chain_policy: evidenceRow.validation_chain_policy,
      required_reviewer_role: REVIEW_ROLE_BY_COMMAND[evidenceRow.package_script_name] ?? "platform_operator",
      expected_review_decision: "accept_ready_or_return_with_blocker",
      review_packet_status: packetStatus,
      source_evidence_status: evidenceRow.evidence_status,
      validation_chain_policy_satisfied: evidenceRow.validation_chain_policy_satisfied,
      review_completed_by_packet: false,
      approval_applied_by_packet: false,
      evidence_index_consumed_in_memory: true,
      evidence_index_artifact_read_performed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      release_check_execution_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      evidence_collected_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      trading_order_submission_performed_by_packet: false,
      desktop_source_of_truth_by_packet: false,
      human_review_required: true,
      human_review_note: `Review ${evidenceRow.package_script_name} documentation, validation-chain policy, and latest operator-run output before treating this command as release-ready evidence.`,
    };
    return withOrdinalAndHash(row, index, "release_check_review_packet_row_hash");
  });
}

function buildReviewGateRows({ evidenceIndex, packageJson, platformOpsLedger, reviewRows, reviewBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p365_evidence_index_ready", "P365 release-check evidence index source is ready.", evidenceIndex.validation.valid && evidenceIndex.summary.evidence_index_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P366 release-check review packet command.", typeof scripts["platform:release-check-review-packet"] === "string" && scripts["platform:release-check-review-packet"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P366 release-check review packet.", validateScript.includes("npm run platform:release-check-review-packet -- --check")),
    gateRow("p366_ledger_acceptance_declared", "P366 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P366: `platform:release-check-review-packet`")),
    gateRow("review_packet_rows_ready", "All release-check review packet rows are ready.", reviewRows.length >= 4 && reviewRows.every((row) => row.review_packet_status === "ready")),
    gateRow("no_review_or_approval_application", "Review packet records required review without completing review or applying approval.", !reviewBoundary.review_completed && !reviewBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Review packet does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !reviewBoundary.command_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed && !reviewBoundary.release_published && !reviewBoundary.git_operation_performed && !reviewBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !reviewBoundary.trading_live_enabled && !reviewBoundary.trading_full_auto_enabled && !reviewBoundary.trading_order_submission_allowed && !reviewBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_review_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-review-packet-gate-row.v1",
    release_check_review_packet_gate_row_id: `platform-release-check-review-packet.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_packet: false,
    approval_applied_by_packet: false,
    evidence_index_artifact_read_performed_by_packet: false,
    command_execution_performed_by_packet: false,
    release_check_execution_performed_by_packet: false,
    artifact_read_performed_by_packet: false,
    artifact_write_performed_by_packet: false,
    release_published_by_packet: false,
    git_operation_performed_by_packet: false,
    protected_action_executed_by_packet: false,
    trading_order_submission_performed_by_packet: false,
    human_review_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-review-packet-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    review_packet_artifact_write_requested: writeRequested,
    review_completed: false,
    approval_applied: false,
    evidence_index_consumed_in_memory: true,
    evidence_index_artifact_read_performed: false,
    evidence_collected: false,
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
    human_review_note: "An operator must review the release-check review packet before relying on it as release-facing readiness evidence.",
  };
}

function buildValidationItems({ evidenceIndex, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary }) {
  return [
    validationItem("source.release_check_evidence_index", "p365_evidence_index_ready", evidenceIndex.validation.valid && evidenceIndex.summary.evidence_index_status === "ready", "P365 release-check evidence index source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P366 review packet checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_review_packet_rows", "review_packet_rows_ready", reviewRows.length >= 4 && reviewRows.every((row) => row.review_packet_status === "ready" && !row.review_completed_by_packet && !row.approval_applied_by_packet && !row.command_execution_performed_by_packet), "Release-check review packet rows are ready and report-only."),
    validationItem("release_check_review_packet_gate_rows", "review_packet_gates_ready", reviewGateRows.length >= 8 && reviewGateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_packet && !row.protected_action_executed_by_packet), "P366 release-check review packet gates are ready and report-only."),
    validationItem("boundary.review_not_completed", "review_not_completed", reviewBoundary.read_only && reviewBoundary.report_only && !reviewBoundary.review_completed && !reviewBoundary.approval_applied && reviewBoundary.evidence_index_consumed_in_memory && !reviewBoundary.evidence_index_artifact_read_performed, "Release-check review packet is read-only, consumes P365 in memory, and does not complete review or apply approval."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !reviewBoundary.command_execution_performed && !reviewBoundary.package_command_execution_performed && !reviewBoundary.release_check_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed, "Release-check review packet does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !reviewBoundary.dependency_install_performed && !reviewBoundary.package_mutation_performed && !reviewBoundary.lockfile_mutation_performed && !reviewBoundary.release_published && !reviewBoundary.git_operation_performed && !reviewBoundary.protected_action_executed, "Release-check review packet performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !reviewBoundary.trading_live_enabled && !reviewBoundary.trading_full_auto_enabled && !reviewBoundary.trading_order_submission_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !reviewBoundary.desktop_source_of_truth && !reviewBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ evidenceIndex, reviewRows, reviewGateRows, reviewBoundary, validation }) {
  return {
    platform_release_check_review_packet_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_evidence_index_status: evidenceIndex.summary.evidence_index_status,
    review_packet_row_count: reviewRows.length,
    ready_review_packet_row_count: reviewRows.filter((row) => row.review_packet_status === "ready").length,
    review_packet_gate_count: reviewGateRows.length,
    ready_review_packet_gate_count: reviewGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: reviewBoundary.read_only,
    report_only: reviewBoundary.report_only,
    review_packet_artifact_write_requested: reviewBoundary.review_packet_artifact_write_requested,
    review_completed: reviewBoundary.review_completed,
    approval_applied: reviewBoundary.approval_applied,
    evidence_index_consumed_in_memory: reviewBoundary.evidence_index_consumed_in_memory,
    evidence_index_artifact_read_performed: reviewBoundary.evidence_index_artifact_read_performed,
    evidence_collected: reviewBoundary.evidence_collected,
    command_execution_performed: reviewBoundary.command_execution_performed,
    package_command_execution_performed: reviewBoundary.package_command_execution_performed,
    release_check_execution_performed: reviewBoundary.release_check_execution_performed,
    artifact_read_performed: reviewBoundary.artifact_read_performed,
    artifact_write_performed: reviewBoundary.artifact_write_performed,
    dependency_install_performed: reviewBoundary.dependency_install_performed,
    package_mutation_performed: reviewBoundary.package_mutation_performed,
    lockfile_mutation_performed: reviewBoundary.lockfile_mutation_performed,
    release_published: reviewBoundary.release_published,
    git_operation_performed: reviewBoundary.git_operation_performed,
    protected_action_executed: reviewBoundary.protected_action_executed,
    trading_live_enabled: reviewBoundary.trading_live_enabled,
    trading_full_auto_enabled: reviewBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: reviewBoundary.trading_order_submission_allowed,
    broker_write_allowed: reviewBoundary.broker_write_allowed,
    exchange_write_allowed: reviewBoundary.exchange_write_allowed,
    desktop_source_of_truth: reviewBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: reviewBoundary.desktop_mutation_allowed,
    human_review_required: reviewBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Review Packet",
    "",
    `Status: ${result.summary.platform_release_check_review_packet_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source evidence index: ${result.summary.source_evidence_index_status}`,
    `Review rows: ${result.summary.ready_review_packet_row_count}/${result.summary.review_packet_row_count}`,
    `Review gates: ${result.summary.ready_review_packet_gate_count}/${result.summary.review_packet_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.release_check_review_packet_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.review_packet_status}`),
    "",
    "## Review Gates",
    "",
    ...result.release_check_review_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-review-packet.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --trading-release-check-doc <path>     Trading release-check doc path.
  --platform-ops-check-doc <path>        Platform ops-check doc path.
  --platform-release-check-doc <path>    Platform release-check doc path.
  --no-write-audit-doc <path>            Release-check no-write audit doc path.
  --release-check-evidence-index-schema <path>
                                         P365 evidence index schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_REVIEW_PACKET_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-review-packet.${slugify(itemPath)}.${checkId}`,
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
