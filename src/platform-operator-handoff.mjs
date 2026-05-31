import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS,
  buildPlatformRuntimeReplayWindow,
} from "./platform-runtime-replay-window.mjs";

export const DEFAULT_PLATFORM_OPERATOR_HANDOFF_OUT_DIR = "artifacts/platform-operator-handoff/latest";
export const DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS = {
  ...DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS,
  replayWindowSchemaPath: DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operator-handoff.schema.json",
};

const SCHEMA_VERSION = "platform-operator-handoff.v1";
const CAPABILITY_ID = "platform.operator_handoff";
const PHASE_SLOT = "P344";
const PREVIOUS_PHASE_SLOT = "P343";
const NEXT_PHASE_SLOT = "P345";
const BASELINE_PHASE_SLOT = "P341";
const DRIFT_PHASE_SLOT = "P342";
const REPLAY_WINDOW_PHASE_SLOT = "P343";

export async function runPlatformOperatorHandoff(options = {}) {
  const result = await buildPlatformOperatorHandoff(options);
  if (options.write !== false) await writePlatformOperatorHandoff(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operator handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperatorHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const replayWindow = await buildPlatformRuntimeReplayWindow({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    nvmrcPath: inputs.nvmrc_path,
    nodeVersionPath: inputs.node_version_path,
    npmrcPath: inputs.npmrc_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingPhaseLedgerPath: inputs.trading_phase_ledger_path,
    baselineSchemaPath: inputs.baseline_schema_path,
    driftSchemaPath: inputs.drift_schema_path,
    schemaPath: inputs.replay_window_schema_path,
  });
  const handoffAnchor = buildHandoffAnchor(replayWindow);
  const handoffPackets = buildHandoffPackets(replayWindow);
  const evidenceRows = buildEvidenceRows(replayWindow);
  const decisionRows = buildDecisionRows(replayWindow);
  const handoffBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    replayWindow,
    handoffPackets,
    evidenceRows,
    decisionRows,
    handoffBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    replayWindow,
    handoffPackets,
    evidenceRows,
    decisionRows,
    handoffBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operator_handoff_id: `platform-operator-handoff.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    handoff_anchor: handoffAnchor,
    operator_handoff_packets: handoffPackets,
    handoff_evidence_rows: evidenceRows,
    handoff_decision_rows: decisionRows,
    operator_handoff_boundary: handoffBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operator_handoff") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    replayWindow,
    handoffPackets,
    evidenceRows,
    decisionRows,
    handoffBoundary,
    validation: result.validation,
  });
  result.summary.platform_operator_handoff_id = result.platform_operator_handoff_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperatorHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-operator-handoff.json"), serializable);
  await writeJson(path.join(outDir, "operator-handoff-packets.json"), collectionEnvelope("platform-operator-handoff-packets.v1", "operator_handoff_packets", result.operator_handoff_packets, result.generated_at));
  await writeJson(path.join(outDir, "handoff-evidence-rows.json"), collectionEnvelope("platform-operator-handoff-evidence-rows.v1", "handoff_evidence_rows", result.handoff_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-decision-rows.json"), collectionEnvelope("platform-operator-handoff-decision-rows.v1", "handoff_decision_rows", result.handoff_decision_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handoff-boundary.json"), result.operator_handoff_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operator-handoff-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperatorHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperatorHandoff(args);
    console.log(`Platform operator handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operator_handoff_status}`);
    console.log(`Handoff packets: ${result.summary.ready_handoff_packet_count}/${result.summary.handoff_packet_count}`);
    console.log(`Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`);
    console.log(`Decision rows: ${result.summary.ready_decision_row_count}/${result.summary.decision_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildHandoffAnchor(replayWindow) {
  return {
    schema_version: "platform-operator-handoff-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    source_replay_window_id: replayWindow.platform_runtime_replay_window_id,
    source_replay_window_status: replayWindow.summary.platform_runtime_replay_window_status,
    source_replay_window_count: replayWindow.summary.replay_window_count,
    source_replay_command_count: replayWindow.summary.replay_command_count,
    source_executed_command_count: replayWindow.summary.executed_command_count,
    source_replay_window_hash: hashValue({
      id: replayWindow.platform_runtime_replay_window_id,
      status: replayWindow.summary.platform_runtime_replay_window_status,
      windows: replayWindow.summary.replay_window_count,
      commands: replayWindow.summary.replay_command_count,
    }),
  };
}

function buildHandoffPackets(replayWindow) {
  const commandRowsByWindow = groupBy(replayWindow.replay_command_rows, (row) => row.replay_window_key);
  return replayWindow.replay_windows.map((window, index) => {
    const commands = commandRowsByWindow.get(window.replay_window_key) ?? [];
    const row = {
      schema_version: "platform-operator-handoff-packet.v1",
      handoff_packet_id: `platform-operator-handoff.${window.replay_window_key}`,
      phase_slot: PHASE_SLOT,
      replay_window_key: window.replay_window_key,
      title: `${window.title} handoff`,
      packet_status: "ready",
      owner_role: ownerRole(window.replay_window_key),
      source_replay_window_status: window.replay_window_status,
      source_command_count: commands.length,
      required_evidence_keys: evidenceKeysFor(window.replay_window_key),
      required_decision_keys: decisionKeysFor(window.replay_window_key),
      next_operator_action: nextOperatorAction(window.replay_window_key),
      source_of_truth: "repository_and_generated_artifacts",
      desktop_source_of_truth: false,
      command_execution_allowed_by_report: false,
      mutation_allowed_by_report: false,
      protected_action_allowed_by_report: false,
      client_facing_ready: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "handoff_packet_hash");
  });
}

function buildEvidenceRows(replayWindow) {
  const rows = [
    evidenceRow("p341_runtime_baseline", "P341 runtime baseline command and schema are the reproducibility anchor.", "platform:runtime-baseline -- --check", "current_runtime_dependency"),
    evidenceRow("p342_drift_check", "P342 drift check reports zero current runtime/dependency drift before handoff.", "platform:drift-check -- --check", "current_runtime_dependency", {
      source_status: replayWindow.summary.source_drift_status,
    }),
    evidenceRow("p343_replay_window", "P343 replay-window map is ready and report-only.", "platform:replay-window -- --check", "validation_and_tests", {
      source_status: replayWindow.summary.platform_runtime_replay_window_status,
    }),
    evidenceRow("contract_release_replay", "Contract golden fixtures, contract validation, and release freeze checks remain separate replay evidence.", "contracts:golden-fixtures/contracts:validate/release:freeze --check", "contract_release_gate"),
    evidenceRow("validation_test_replay", "The validation chain and Node test suite are required before phase closeout.", "npm run validate && npm test", "validation_and_tests"),
    evidenceRow("artifact_regeneration_manual", "Control-plane loop is manual artifact regeneration evidence and is not executed by this handoff.", "npm run control-plane:loop", "artifact_regeneration"),
    evidenceRow("cross_os_history_review", "Windows history bundle and Mac replay stabilization remain human-reviewed history evidence.", "Hermes-P340-history.bundle and 8e4323d", "cross_os_history"),
    evidenceRow("trading_safety_disabled", "Trading validation evidence must preserve disabled live/full-auto/order submission and broker writes.", "trading:* --check", "trading_safety"),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "handoff_evidence_hash"));
}

function evidenceRow(evidenceKey, description, sourceRef, replayWindowKey, details = {}) {
  return {
    schema_version: "platform-operator-handoff-evidence-row.v1",
    evidence_row_id: `platform-operator-handoff.evidence.${evidenceKey}`,
    phase_slot: PHASE_SLOT,
    evidence_key: evidenceKey,
    replay_window_key: replayWindowKey,
    evidence_status: "ready",
    description,
    source_ref: sourceRef,
    source_status: details.source_status ?? "ready",
    evidence_read_only: true,
    evidence_generated_by_report: false,
    command_execution_allowed_by_report: false,
    human_review_required: true,
  };
}

function buildDecisionRows(replayWindow) {
  const rows = [
    decisionRow("runtime_drift_review", "If P342 drift is nonzero, stop phase closeout and review runtime/dependency drift first.", "current_runtime_dependency", replayWindow.summary.source_drifted_row_count === 0),
    decisionRow("schema_or_contract_change_review", "If schemas or contract sources changed, run contract/release replay checks before claiming stability.", "contract_release_gate", true),
    decisionRow("full_validation_before_closeout", "Run the registered validation chain and Node tests before closing a platform operations phase.", "validation_and_tests", true),
    decisionRow("artifact_regeneration_is_manual", "Regenerate ignored artifacts only as an explicit operator action; this handoff does not execute it.", "artifact_regeneration", true),
    decisionRow("history_import_requires_human_gate", "Windows history bundle import remains a separate human-reviewed git decision.", "cross_os_history", true),
    decisionRow("trading_live_stays_disabled", "Trading safety replay must prove live/full-auto/order submission and broker writes remain disabled.", "trading_safety", true),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "handoff_decision_hash"));
}

function decisionRow(decisionKey, description, replayWindowKey, ready) {
  return {
    schema_version: "platform-operator-handoff-decision-row.v1",
    decision_row_id: `platform-operator-handoff.decision.${decisionKey}`,
    phase_slot: PHASE_SLOT,
    decision_key: decisionKey,
    replay_window_key: replayWindowKey,
    decision_status: ready ? "ready" : "blocked",
    description,
    requires_human_gate: true,
    command_execution_allowed_by_report: false,
    mutation_allowed_by_report: false,
    protected_action_allowed_by_report: false,
    client_facing_ready: false,
  };
}

function ownerRole(windowKey) {
  const roles = {
    current_runtime_dependency: "platform_operator",
    contract_release_gate: "release_operator",
    validation_and_tests: "platform_operator",
    artifact_regeneration: "control_plane_operator",
    cross_os_history: "repository_maintainer",
    trading_safety: "trading_pack_operator",
  };
  return roles[windowKey] ?? "platform_operator";
}

function evidenceKeysFor(windowKey) {
  const keys = {
    current_runtime_dependency: ["p341_runtime_baseline", "p342_drift_check"],
    contract_release_gate: ["contract_release_replay"],
    validation_and_tests: ["p343_replay_window", "validation_test_replay"],
    artifact_regeneration: ["artifact_regeneration_manual"],
    cross_os_history: ["cross_os_history_review"],
    trading_safety: ["trading_safety_disabled"],
  };
  return keys[windowKey] ?? [];
}

function decisionKeysFor(windowKey) {
  const keys = {
    current_runtime_dependency: ["runtime_drift_review"],
    contract_release_gate: ["schema_or_contract_change_review"],
    validation_and_tests: ["full_validation_before_closeout"],
    artifact_regeneration: ["artifact_regeneration_is_manual"],
    cross_os_history: ["history_import_requires_human_gate"],
    trading_safety: ["trading_live_stays_disabled"],
  };
  return keys[windowKey] ?? [];
}

function nextOperatorAction(windowKey) {
  const actions = {
    current_runtime_dependency: "Review P341/P342 status and keep package changes blocked until drift is resolved.",
    contract_release_gate: "Run contract and release replay checks after schema or generated-contract source changes.",
    validation_and_tests: "Run validation and tests before phase closeout.",
    artifact_regeneration: "Run control-plane loop only when ignored artifact outputs must be regenerated.",
    cross_os_history: "Review history bundle import separately from current-checkout stability claims.",
    trading_safety: "Run Trading safety checks and verify live/full-auto/order submission remain disabled.",
  };
  return actions[windowKey] ?? "Review packet before continuing.";
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-operator-handoff-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    artifact_regeneration_performed: false,
    git_operation_performed: false,
    release_published: false,
    recovery_execution_performed: false,
    protected_action_executed: false,
    approval_applied: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    human_review_required_for_handoff: true,
  };
}

function buildValidationItems({ replayWindow, handoffPackets, evidenceRows, decisionRows, handoffBoundary }) {
  return [
    validationItem("source.replay_window", "p343_replay_window_ready", replayWindow.validation.valid && replayWindow.summary.platform_runtime_replay_window_status === "ready", "P343 replay-window source must be ready."),
    validationItem("handoff_packets", "handoff_packets_ready", handoffPackets.length >= 6 && handoffPackets.every((row) => row.packet_status === "ready" && row.human_review_required && row.command_execution_allowed_by_report === false), "Operator handoff packets are ready and human-review gated."),
    validationItem("handoff_evidence", "handoff_evidence_ready", evidenceRows.length >= 8 && evidenceRows.every((row) => row.evidence_status === "ready" && row.evidence_read_only && row.command_execution_allowed_by_report === false), "Handoff evidence rows are ready and read-only."),
    validationItem("handoff_decisions", "handoff_decisions_ready", decisionRows.length >= 6 && decisionRows.every((row) => row.decision_status === "ready" && row.requires_human_gate && row.command_execution_allowed_by_report === false), "Handoff decision rows are ready and human-gated."),
    validationItem("boundary.read_only", "read_only_report", handoffBoundary.read_only && handoffBoundary.report_only && !handoffBoundary.command_execution_performed && !handoffBoundary.package_mutation_performed && !handoffBoundary.artifact_regeneration_performed, "Operator handoff is read-only and does not execute commands."),
    validationItem("boundary.protected_actions", "no_protected_actions", !handoffBoundary.protected_action_executed && !handoffBoundary.approval_applied && !handoffBoundary.recovery_execution_performed, "Operator handoff does not execute protected actions or apply approvals."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !handoffBoundary.trading_live_enabled && !handoffBoundary.trading_full_auto_enabled && !handoffBoundary.trading_order_submission_allowed && !handoffBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !handoffBoundary.desktop_source_of_truth && !handoffBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ replayWindow, handoffPackets, evidenceRows, decisionRows, handoffBoundary, validation }) {
  return {
    platform_operator_handoff_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    source_replay_window_status: replayWindow.summary.platform_runtime_replay_window_status,
    source_replay_window_count: replayWindow.summary.replay_window_count,
    source_executed_command_count: replayWindow.summary.executed_command_count,
    handoff_packet_count: handoffPackets.length,
    ready_handoff_packet_count: handoffPackets.filter((row) => row.packet_status === "ready").length,
    evidence_row_count: evidenceRows.length,
    ready_evidence_row_count: evidenceRows.filter((row) => row.evidence_status === "ready").length,
    decision_row_count: decisionRows.length,
    ready_decision_row_count: decisionRows.filter((row) => row.decision_status === "ready").length,
    human_review_packet_count: handoffPackets.filter((row) => row.human_review_required).length,
    human_gate_decision_count: decisionRows.filter((row) => row.requires_human_gate).length,
    read_only: handoffBoundary.read_only,
    report_only: handoffBoundary.report_only,
    command_execution_performed: handoffBoundary.command_execution_performed,
    dependency_install_performed: handoffBoundary.dependency_install_performed,
    package_mutation_performed: handoffBoundary.package_mutation_performed,
    lockfile_mutation_performed: handoffBoundary.lockfile_mutation_performed,
    artifact_regeneration_performed: handoffBoundary.artifact_regeneration_performed,
    git_operation_performed: handoffBoundary.git_operation_performed,
    release_published: handoffBoundary.release_published,
    recovery_execution_performed: handoffBoundary.recovery_execution_performed,
    protected_action_executed: handoffBoundary.protected_action_executed,
    approval_applied: handoffBoundary.approval_applied,
    desktop_source_of_truth: handoffBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: handoffBoundary.desktop_mutation_allowed,
    trading_live_enabled: handoffBoundary.trading_live_enabled,
    trading_full_auto_enabled: handoffBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: handoffBoundary.trading_order_submission_allowed,
    broker_write_allowed: handoffBoundary.broker_write_allowed,
    validation_error_count: validation.errors.length,
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

function renderMarkdown(result) {
  const lines = [
    "# Platform Operator Handoff",
    "",
    `Status: ${result.summary.platform_operator_handoff_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source replay window: ${result.summary.source_replay_window_status}`,
    `Handoff packets: ${result.summary.ready_handoff_packet_count}/${result.summary.handoff_packet_count}`,
    `Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`,
    `Decision rows: ${result.summary.ready_decision_row_count}/${result.summary.decision_row_count}`,
    "",
    "## Handoff Packets",
    "",
    ...result.operator_handoff_packets.map((row) => `- ${row.replay_window_key}: ${row.packet_status} (${row.owner_role})`),
    "",
    "## Decisions",
    "",
    ...result.handoff_decision_rows.map((row) => `- ${row.decision_key}: ${row.decision_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATOR_HANDOFF_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--package-lock") parsed.packageLockPath = argv[++index];
    else if (arg === "--nvmrc") parsed.nvmrcPath = argv[++index];
    else if (arg === "--node-version") parsed.nodeVersionPath = argv[++index];
    else if (arg === "--npmrc") parsed.npmrcPath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-phase-ledger") parsed.tradingPhaseLedgerPath = argv[++index];
    else if (arg === "--baseline-schema") parsed.baselineSchemaPath = argv[++index];
    else if (arg === "--drift-schema") parsed.driftSchemaPath = argv[++index];
    else if (arg === "--replay-window-schema") parsed.replayWindowSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operator-handoff.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_PLATFORM_OPERATOR_HANDOFF_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --nvmrc <path>                  .nvmrc path.
  --node-version <path>           .node-version path.
  --npmrc <path>                  .npmrc path.
  --platform-ops-ledger <path>    P341-P500 ledger path.
  --trading-phase-ledger <path>   Trading P001-P340 ledger path.
  --baseline-schema <path>        P341 runtime baseline schema path.
  --drift-schema <path>           P342 runtime drift schema path.
  --replay-window-schema <path>   P343 replay-window schema path.
  --schema <path>                 Output schema path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.replayWindowSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.schemaPath),
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-operator-handoff.${slugify(itemPath)}.${checkId}`,
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
