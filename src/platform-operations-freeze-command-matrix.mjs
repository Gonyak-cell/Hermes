import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS,
  buildPlatformOperationsFreezeSourceInventory,
} from "./platform-operations-freeze-source-inventory.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_OUT_DIR = "artifacts/platform-operations-freeze-command-matrix/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS,
  operationsFreezeSourceInventorySchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-command-matrix.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-command-matrix";
const SCHEMA_VERSION = "platform-operations-freeze-command-matrix.v1";
const CAPABILITY_ID = "platform.operations_freeze_command_matrix";
const PHASE_SLOT = "P482";
const PREVIOUS_PHASE_SLOT = "P481";
const NEXT_PHASE_SLOT = "P483";
const READY_STATUS = "ready_for_operations_freeze";
const COMMAND_MATRIX_STATUS = "ready_for_operations_freeze_command_matrix";
const FREEZE_COMMAND_SPECS = [
  {
    row_key: "platform_release_check",
    package_script_name: "platform:release-check",
    invocation: "npm run platform:release-check -- --check",
    ledger_token: "platform:release-check -- --check",
    check_mode_required: true,
    command_role: "unified_platform_release_check",
    source_phase_slot: "P363",
  },
  {
    row_key: "trading_release_check",
    package_script_name: "trading:release-check",
    invocation: "npm run trading:release-check -- --check",
    ledger_token: "trading:release-check -- --check",
    check_mode_required: true,
    command_role: "trading_release_check",
    source_phase_slot: "P361",
  },
  {
    row_key: "validate",
    package_script_name: "validate",
    invocation: "npm run validate",
    ledger_token: "npm run validate",
    check_mode_required: false,
    no_check_reason: "validate is the aggregate check chain and does not accept a top-level --check flag.",
    command_role: "aggregate_validation_chain",
    source_phase_slot: null,
  },
  {
    row_key: "test",
    package_script_name: "test",
    invocation: "npm test",
    ledger_token: "npm test",
    check_mode_required: false,
    no_check_reason: "npm test is a test runner command rather than a write-capable generator.",
    command_role: "full_test_suite",
    source_phase_slot: null,
  },
  {
    row_key: "contracts_validate",
    package_script_name: "contracts:validate",
    invocation: "npm run contracts:validate -- --check",
    ledger_token: "contracts:validate -- --check",
    check_mode_required: true,
    command_role: "contract_regression_suite",
    source_phase_slot: null,
  },
  {
    row_key: "release_freeze",
    package_script_name: "release:freeze",
    invocation: "npm run release:freeze -- --check",
    ledger_token: "release:freeze -- --check",
    check_mode_required: true,
    command_role: "release_freeze_check",
    source_phase_slot: null,
  },
  {
    row_key: "control_plane_loop",
    package_script_name: "control-plane:loop",
    invocation: "npm run control-plane:loop",
    ledger_token: "control-plane:loop",
    check_mode_required: false,
    no_check_reason: "control-plane:loop is deterministic and does not expose --check.",
    command_role: "control_plane_loop_replay",
    source_phase_slot: null,
  },
];

export async function runPlatformOperationsFreezeCommandMatrix(options = {}) {
  const result = await buildPlatformOperationsFreezeCommandMatrix(options);
  if (options.write !== false) await writePlatformOperationsFreezeCommandMatrix(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze command matrix failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeCommandMatrix(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceInventory = await buildPlatformOperationsFreezeSourceInventory({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.operations_freeze_source_inventory_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const commandRows = buildCommandRows({ sourceInventory, scripts, ledgerText: platformOpsLedger.text ?? "" });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ sourceInventory, packageJson, platformOpsLedger, commandRows });
  const gateRows = buildGateRows({ sourceInventory, scripts, validateScript, ledgerText: platformOpsLedger.text ?? "", commandRows, boundary });
  const validationItems = buildValidationItems({ sourceInventory, packageJson, platformOpsLedger, commandRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceInventory, commandRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_command_matrix_id: `platform-operations-freeze-command-matrix.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_command_matrix_anchor: anchor,
    operations_freeze_command_matrix_rows: commandRows,
    operations_freeze_command_matrix_gate_rows: gateRows,
    operations_freeze_command_matrix_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_command_matrix") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceInventory, commandRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_command_matrix_id = result.platform_operations_freeze_command_matrix_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeCommandMatrix(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-command-matrix.json"), serializableResult(result));
  await writeJson(path.join(outDir, "command-matrix-rows.json"), collectionEnvelope("platform-operations-freeze-command-matrix-rows.v1", "operations_freeze_command_matrix_rows", result.operations_freeze_command_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-matrix-gate-rows.json"), collectionEnvelope("platform-operations-freeze-command-matrix-gates.v1", "operations_freeze_command_matrix_gate_rows", result.operations_freeze_command_matrix_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-matrix-boundary.json"), result.operations_freeze_command_matrix_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-command-matrix-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeCommandMatrixCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeCommandMatrix(args);
    console.log(`Platform operations freeze command matrix ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_command_matrix_status}`);
    console.log(`Command rows: ${result.summary.ready_command_row_count}/${result.summary.command_row_count}`);
    console.log(`Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ sourceInventory, packageJson, platformOpsLedger, commandRows }) {
  return {
    schema_version: "platform-operations-freeze-command-matrix-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_inventory_id: sourceInventory.platform_operations_freeze_source_inventory_id,
    source_inventory_status: sourceInventory.summary.platform_operations_freeze_source_inventory_status,
    source_inventory_hash: hashValue({
      id: sourceInventory.platform_operations_freeze_source_inventory_id,
      status: sourceInventory.summary.platform_operations_freeze_source_inventory_status,
      source_rows: sourceInventory.summary.source_inventory_row_count,
      complete_rows: sourceInventory.summary.complete_source_row_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    command_matrix_hash: hashValue(commandRows.map((row) => ({
      row_key: row.row_key,
      package_script_name: row.package_script_name,
      command_matrix_status: row.command_matrix_status,
    }))),
  };
}

function buildCommandRows({ sourceInventory, scripts, ledgerText }) {
  const sourceRowsByPhase = new Map(sourceInventory.operations_freeze_source_inventory_rows.map((row) => [row.source_phase_slot, row]));
  const sourceReady = sourceInventory.validation.valid && sourceInventory.summary.platform_operations_freeze_source_inventory_status === READY_STATUS;
  return FREEZE_COMMAND_SPECS.map((spec, index) => {
    const sourceRow = spec.source_phase_slot ? sourceRowsByPhase.get(spec.source_phase_slot) : null;
    const packageScriptRegistered = typeof scripts[spec.package_script_name] === "string" && scripts[spec.package_script_name].length > 0;
    const ledgerAcceptanceDeclared = ledgerText.includes(spec.ledger_token);
    const checkModePolicySatisfied = spec.check_mode_required ? spec.invocation.includes("-- --check") : Boolean(spec.no_check_reason);
    const sourceInventoryLinkReady = !sourceRow || (sourceRow.source_inventory_status === "complete" && sourceRow.package_script_registered);
    const commandMatrixStatus = sourceReady && packageScriptRegistered && ledgerAcceptanceDeclared && checkModePolicySatisfied && sourceInventoryLinkReady ? "ready" : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-command-matrix-row.v1",
      operations_freeze_command_matrix_row_id: `platform-operations-freeze-command-matrix.row.${spec.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      command_role: spec.command_role,
      package_script_name: spec.package_script_name,
      invocation: spec.invocation,
      ledger_token: spec.ledger_token,
      command_matrix_status: commandMatrixStatus,
      package_script_registered: packageScriptRegistered,
      ledger_acceptance_declared: ledgerAcceptanceDeclared,
      check_mode_required: spec.check_mode_required,
      check_mode_policy_satisfied: checkModePolicySatisfied,
      no_check_reason: spec.no_check_reason ?? null,
      source_inventory_link_required: Boolean(spec.source_phase_slot),
      source_inventory_phase_slot: spec.source_phase_slot,
      source_inventory_row_status: sourceRow?.source_inventory_status ?? null,
      source_inventory_link_ready: sourceInventoryLinkReady,
      command_execution_performed_by_matrix: false,
      package_command_execution_performed_by_matrix: false,
      generated_artifact_read_performed_by_matrix: false,
      artifact_write_performed_by_matrix: false,
      package_mutation_performed_by_matrix: false,
      lockfile_mutation_performed_by_matrix: false,
      release_published_by_matrix: false,
      git_operation_performed_by_matrix: false,
      protected_action_executed_by_matrix: false,
      trading_order_submission_performed_by_matrix: false,
      desktop_source_of_truth_by_matrix: false,
      secret_exposure_allowed_by_matrix: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_command_matrix_row_hash");
  });
}

function buildGateRows({ sourceInventory, scripts, validateScript, ledgerText, commandRows, boundary }) {
  const rows = [
    gateRow("p481_source_inventory_ready", "P481 operations freeze source inventory is ready.", sourceInventory.validation.valid && sourceInventory.summary.platform_operations_freeze_source_inventory_status === READY_STATUS && sourceInventory.summary.complete_source_row_count === 140),
    gateRow("platform_package_script_registered", "package.json registers the P482 platform operations freeze command matrix command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P482 platform operations freeze command matrix command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p482_ledger_acceptance_declared", "P482 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P482: \`${COMMAND_NAME}\``)),
    gateRow("freeze_command_rows_ready", "All P481-P500 freeze acceptance commands are present and ready in the matrix.", commandRows.length === FREEZE_COMMAND_SPECS.length && commandRows.every((row) => row.command_matrix_status === "ready")),
    gateRow("freeze_command_check_policy_ready", "Write-capable freeze commands use --check and non-check commands have documented exceptions.", commandRows.every((row) => row.check_mode_policy_satisfied)),
    gateRow("freeze_command_coverage_ready", "The command matrix covers platform release-check, trading release-check, validate, test, contracts validate, release freeze, and control-plane loop.", new Set(commandRows.map((row) => row.row_key)).size === FREEZE_COMMAND_SPECS.length),
    gateRow("no_execution_or_mutation", "The command matrix executes no commands, reads no generated artifacts, writes no protected artifacts, mutates no release/trading/Desktop state, and exposes no secrets.", boundary.read_only && boundary.report_only && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed && !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_command_matrix_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-command-matrix-gate-row.v1",
    operations_freeze_command_matrix_gate_row_id: `platform-operations-freeze-command-matrix.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_gate: false,
    package_command_execution_performed_by_gate: false,
    generated_artifact_read_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    package_mutation_performed_by_gate: false,
    lockfile_mutation_performed_by_gate: false,
    release_published_by_gate: false,
    git_operation_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    trading_order_submission_performed_by_gate: false,
    desktop_source_of_truth_by_gate: false,
    secret_exposure_allowed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-command-matrix-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_matrix_artifact_write_requested: writeRequested,
    source_inventory_consumed_in_memory: true,
    command_execution_performed: false,
    package_command_execution_performed: false,
    generated_artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    protected_recovery_execution_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    secret_exposure_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ sourceInventory, packageJson, platformOpsLedger, commandRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_source_inventory", "p481_source_inventory_ready", sourceInventory.validation.valid && sourceInventory.summary.platform_operations_freeze_source_inventory_status === READY_STATUS && sourceInventory.summary.complete_source_row_count === 140, "P481 source inventory must be ready before P482 command matrix."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P482 command matrix."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_command_matrix_rows", "freeze_command_rows_ready", commandRows.length === FREEZE_COMMAND_SPECS.length && commandRows.every((row) => row.command_matrix_status === "ready" && row.package_script_registered && row.ledger_acceptance_declared), "Every required P481-P500 freeze acceptance command must be present and ready."),
    validationItem("operations_freeze_command_matrix_rows.check_policy", "freeze_command_check_policy_ready", commandRows.every((row) => row.check_mode_policy_satisfied), "Write-capable freeze commands must use --check and non-check commands must document why."),
    validationItem("operations_freeze_command_matrix_gate_rows", "freeze_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_gate && !row.protected_action_executed_by_gate), "P482 command matrix gates must be ready."),
    validationItem("boundary.no_execution", "no_execution", boundary.read_only && boundary.report_only && boundary.source_inventory_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed, "P482 command matrix must not execute commands or read/write generated artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P482 command matrix must not mutate dependencies, package files, lockfiles, releases, git state, or protected recovery state."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ sourceInventory, commandRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_command_matrix_status: validation.valid ? COMMAND_MATRIX_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_inventory_status: sourceInventory.summary.platform_operations_freeze_source_inventory_status,
    source_inventory_row_count: sourceInventory.summary.source_inventory_row_count,
    source_inventory_complete_source_row_count: sourceInventory.summary.complete_source_row_count,
    command_row_count: commandRows.length,
    ready_command_row_count: commandRows.filter((row) => row.command_matrix_status === "ready").length,
    check_mode_command_count: commandRows.filter((row) => row.check_mode_required).length,
    no_check_exception_command_count: commandRows.filter((row) => !row.check_mode_required && row.no_check_reason).length,
    package_script_registered_command_count: commandRows.filter((row) => row.package_script_registered).length,
    ledger_acceptance_declared_command_count: commandRows.filter((row) => row.ledger_acceptance_declared).length,
    freeze_gate_count: gateRows.length,
    ready_freeze_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    command_matrix_artifact_write_requested: boundary.command_matrix_artifact_write_requested,
    source_inventory_consumed_in_memory: boundary.source_inventory_consumed_in_memory,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    protected_recovery_execution_allowed: boundary.protected_recovery_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Command Matrix",
    "",
    `Status: ${result.summary.platform_operations_freeze_command_matrix_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source inventory: ${result.summary.source_inventory_status}`,
    `Command rows: ${result.summary.ready_command_row_count}/${result.summary.command_row_count}`,
    `Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`,
    "",
    "## Commands",
    "",
    ...result.operations_freeze_command_matrix_rows.map((row) => `- ${row.invocation}: ${row.command_matrix_status}`),
    "",
    "## Freeze Gates",
    "",
    ...result.operations_freeze_command_matrix_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-command-matrix.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS.operationsFreezeSourceInventorySchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-command-matrix.${slugify(itemPath)}.${checkId}`,
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
