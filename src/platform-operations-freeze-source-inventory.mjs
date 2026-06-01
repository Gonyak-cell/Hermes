import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_OUT_DIR = "artifacts/platform-operations-freeze-source-inventory/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS = {
  packagePath: "package.json",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  schemaPath: "schemas/platform-operations-freeze-source-inventory.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-source-inventory";
const SCHEMA_VERSION = "platform-operations-freeze-source-inventory.v1";
const CAPABILITY_ID = "platform.operations_freeze_source_inventory";
const PHASE_SLOT = "P481";
const PREVIOUS_PHASE_SLOT = "P480";
const NEXT_PHASE_SLOT = "P482";
const SOURCE_PHASE_START = 341;
const SOURCE_PHASE_END = 480;
const EXPECTED_SOURCE_COUNT = SOURCE_PHASE_END - SOURCE_PHASE_START + 1;

export async function runPlatformOperationsFreezeSourceInventory(options = {}) {
  const result = await buildPlatformOperationsFreezeSourceInventory(options);
  if (options.write !== false) await writePlatformOperationsFreezeSourceInventory(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze source inventory failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeSourceInventory(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const sourceRows = buildSourceInventoryRows({ ledgerText: platformOpsLedger.text ?? "", scripts, validateScript });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ packageJson, platformOpsLedger, sourceRows });
  const gateRows = buildGateRows({ scripts, validateScript, ledgerText: platformOpsLedger.text ?? "", sourceRows, boundary });
  const validationItems = buildValidationItems({ packageJson, platformOpsLedger, sourceRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_source_inventory_id: `platform-operations-freeze-source-inventory.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_source_inventory_anchor: anchor,
    operations_freeze_source_inventory_rows: sourceRows,
    operations_freeze_source_inventory_gate_rows: gateRows,
    operations_freeze_source_inventory_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_source_inventory") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_source_inventory_id = result.platform_operations_freeze_source_inventory_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeSourceInventory(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-source-inventory.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-inventory-rows.json"), collectionEnvelope("platform-operations-freeze-source-inventory-rows.v1", "operations_freeze_source_inventory_rows", result.operations_freeze_source_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-inventory-gate-rows.json"), collectionEnvelope("platform-operations-freeze-source-inventory-gates.v1", "operations_freeze_source_inventory_gate_rows", result.operations_freeze_source_inventory_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-inventory-boundary.json"), result.operations_freeze_source_inventory_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-source-inventory-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeSourceInventoryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeSourceInventory(args);
    console.log(`Platform operations freeze source inventory ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_source_inventory_status}`);
    console.log(`Source rows: ${result.summary.complete_source_row_count}/${result.summary.source_inventory_row_count}`);
    console.log(`Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ packageJson, platformOpsLedger, sourceRows }) {
  return {
    schema_version: "platform-operations-freeze-source-inventory-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_phase_start: `P${SOURCE_PHASE_START}`,
    source_phase_end: `P${SOURCE_PHASE_END}`,
    expected_source_count: EXPECTED_SOURCE_COUNT,
    platform_source_count: sourceRows.filter((row) => row.source_domain === "platform").length,
    trading_source_count: sourceRows.filter((row) => row.source_domain === "trading").length,
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    source_inventory_hash: hashValue(sourceRows.map((row) => ({
      phase_slot: row.source_phase_slot,
      command_name: row.command_name,
      source_inventory_status: row.source_inventory_status,
    }))),
  };
}

function buildSourceInventoryRows({ ledgerText, scripts, validateScript }) {
  const ledgerEntries = parseLedgerEntries(ledgerText);
  const entriesByPhase = new Map();
  for (const entry of ledgerEntries) {
    if (entry.phase_number < SOURCE_PHASE_START || entry.phase_number > SOURCE_PHASE_END) continue;
    const entries = entriesByPhase.get(entry.phase_number) ?? [];
    entries.push(entry);
    entriesByPhase.set(entry.phase_number, entries);
  }

  const rows = [];
  for (let phaseNumber = SOURCE_PHASE_START; phaseNumber <= SOURCE_PHASE_END; phaseNumber += 1) {
    const phaseSlot = `P${phaseNumber}`;
    const entries = entriesByPhase.get(phaseNumber) ?? [];
    const ledgerEntry = entries[0] ?? null;
    const commandName = ledgerEntry?.command_name ?? null;
    const sourceDomain = inferSourceDomain(phaseNumber, commandName);
    const expectedNamespace = `${sourceDomain}:`;
    const ledgerRowPresent = entries.length === 1;
    const duplicateLedgerRows = entries.length > 1;
    const commandNamespaceMatches = typeof commandName === "string" && commandName.startsWith(expectedNamespace);
    const packageScriptRegistered = typeof commandName === "string" && typeof scripts[commandName] === "string" && scripts[commandName].length > 0;
    const validationChainRegistered = typeof commandName === "string" && validateScript.includes(`npm run ${commandName} -- --check`);
    const validationChainExceptionDocumented = commandName === "platform:release-check" && /without registering itself in `npm run validate`/.test(ledgerEntry?.description ?? "");
    const validationChainSatisfied = validationChainRegistered || validationChainExceptionDocumented;
    const sourceInventoryStatus = ledgerRowPresent && commandNamespaceMatches && packageScriptRegistered && validationChainSatisfied ? "complete" : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-source-inventory-row.v1",
      operations_freeze_source_inventory_row_id: `platform-operations-freeze-source-inventory.row.${phaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: phaseSlot,
      source_phase_number: phaseNumber,
      source_domain: sourceDomain,
      command_name: commandName,
      expected_command_namespace: expectedNamespace,
      source_inventory_status: sourceInventoryStatus,
      source_review_status: sourceInventoryStatus === "complete" ? "ready_for_operations_freeze" : "needs_human_attention",
      ledger_row_present: ledgerRowPresent,
      ledger_row_count: entries.length,
      duplicate_ledger_rows: duplicateLedgerRows,
      ledger_line_number: ledgerEntry?.line_number ?? null,
      ledger_description_hash: ledgerEntry ? sha256(ledgerEntry.description) : null,
      command_namespace_matches: commandNamespaceMatches,
      package_script_registered: packageScriptRegistered,
      validation_chain_registered: validationChainRegistered,
      validation_chain_exception_documented: validationChainExceptionDocumented,
      validation_chain_satisfied: validationChainSatisfied,
      validation_chain_policy: validationChainRegistered ? "direct_validation_chain_registration" : validationChainExceptionDocumented ? "documented_recursive_validation_exclusion" : "missing_validation_chain_registration",
      complete_or_human_gated: sourceInventoryStatus === "complete",
      human_gate_documented: false,
      documented_blocker: sourceInventoryStatus === "complete" ? null : buildBlocker({ ledgerRowPresent, duplicateLedgerRows, commandNamespaceMatches, packageScriptRegistered, validationChainSatisfied }),
      command_execution_performed_by_inventory: false,
      package_command_execution_performed_by_inventory: false,
      source_command_execution_performed_by_inventory: false,
      generated_artifact_read_performed_by_inventory: false,
      artifact_write_performed_by_inventory: false,
      package_mutation_performed_by_inventory: false,
      lockfile_mutation_performed_by_inventory: false,
      release_published_by_inventory: false,
      git_operation_performed_by_inventory: false,
      protected_action_executed_by_inventory: false,
      trading_order_submission_performed_by_inventory: false,
      desktop_source_of_truth_by_inventory: false,
      secret_exposure_allowed_by_inventory: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    rows.push(withOrdinalAndHash(row, rows.length, "operations_freeze_source_inventory_row_hash"));
  }
  return rows;
}

function inferSourceDomain(phaseNumber, commandName) {
  if (typeof commandName === "string") {
    const namespace = commandName.split(":")[0];
    if (namespace === "platform" || namespace === "trading") return namespace;
  }
  return phaseNumber >= 381 ? "trading" : "platform";
}

function buildBlocker({ ledgerRowPresent, duplicateLedgerRows, commandNamespaceMatches, packageScriptRegistered, validationChainSatisfied }) {
  const blockers = [];
  if (!ledgerRowPresent) blockers.push(duplicateLedgerRows ? "duplicate ledger rows" : "missing ledger row");
  if (!commandNamespaceMatches) blockers.push("command namespace mismatch");
  if (!packageScriptRegistered) blockers.push("missing package script");
  if (!validationChainSatisfied) blockers.push("missing validation-chain entry or documented exception");
  return blockers.join("; ");
}

function parseLedgerEntries(ledgerText) {
  const entries = [];
  const rowPattern = /^- P(\d{3}): `([^`]+)`(.*)$/gm;
  let match;
  while ((match = rowPattern.exec(ledgerText)) !== null) {
    entries.push({
      phase_number: Number(match[1]),
      phase_slot: `P${match[1]}`,
      command_name: match[2],
      description: match[3].trim(),
      line_number: ledgerText.slice(0, match.index).split("\n").length,
    });
  }
  return entries;
}

function buildGateRows({ scripts, validateScript, ledgerText, sourceRows, boundary }) {
  const missingPhaseCount = sourceRows.filter((row) => !row.ledger_row_present).length;
  const duplicatePhaseCount = sourceRows.filter((row) => row.duplicate_ledger_rows).length;
  const rows = [
    gateRow("platform_package_script_registered", "package.json registers the P481 platform operations freeze source inventory command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P481 platform operations freeze source inventory command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p481_ledger_acceptance_declared", "P481 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P481: \`${COMMAND_NAME}\``)),
    gateRow("source_phase_range_complete", "Every P341-P480 phase is present exactly once in the platform operations ledger.", sourceRows.length === EXPECTED_SOURCE_COUNT && missingPhaseCount === 0 && duplicatePhaseCount === 0),
    gateRow("source_package_scripts_registered", "Every P341-P480 ledger command has a package.json script.", sourceRows.every((row) => row.package_script_registered)),
    gateRow("source_validation_chain_satisfied", "Every P341-P480 ledger command is present in the validation chain or has a documented recursive-exclusion policy.", sourceRows.every((row) => row.validation_chain_satisfied)),
    gateRow("source_rows_complete_or_human_gated", "Every P341-P480 source row is complete or explicitly human-gated.", sourceRows.every((row) => row.complete_or_human_gated || row.human_gate_documented)),
    gateRow("no_execution_or_mutation", "The inventory executes no commands, writes no protected artifacts, performs no trading action, mutates no Desktop/source-of-truth state, and exposes no secrets.", boundary.read_only && boundary.report_only && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.source_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_source_inventory_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-source-inventory-gate-row.v1",
    operations_freeze_source_inventory_gate_row_id: `platform-operations-freeze-source-inventory.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_gate: false,
    package_command_execution_performed_by_gate: false,
    source_command_execution_performed_by_gate: false,
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
    schema_version: "platform-operations-freeze-source-inventory-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    source_inventory_artifact_write_requested: writeRequested,
    source_file_read_performed: true,
    command_execution_performed: false,
    package_command_execution_performed: false,
    source_command_execution_performed: false,
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

function buildValidationItems({ packageJson, platformOpsLedger, sourceRows, gateRows, boundary }) {
  return [
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P481 operations freeze inventory."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_source_inventory_rows", "source_phase_range_complete", sourceRows.length === EXPECTED_SOURCE_COUNT && sourceRows.every((row) => row.ledger_row_present && !row.duplicate_ledger_rows), "Every P341-P480 phase must be present exactly once in the source inventory."),
    validationItem("operations_freeze_source_inventory_rows.package_scripts", "source_package_scripts_registered", sourceRows.every((row) => row.package_script_registered), "Every P341-P480 ledger command must have a package.json script."),
    validationItem("operations_freeze_source_inventory_rows.validation_chain", "source_validation_chain_satisfied", sourceRows.every((row) => row.validation_chain_satisfied), "Every P341-P480 ledger command must be included in npm run validate or document a recursive validation-chain exclusion."),
    validationItem("operations_freeze_source_inventory_rows.namespaces", "source_namespaces_stable", sourceRows.every((row) => row.command_namespace_matches), "P341-P480 commands must remain in an explicit platform or trading namespace."),
    validationItem("operations_freeze_source_inventory_rows.status", "source_rows_complete_or_human_gated", sourceRows.every((row) => row.complete_or_human_gated || row.human_gate_documented), "Every P341-P480 source row must be complete or explicitly blocked by a documented human gate."),
    validationItem("operations_freeze_source_inventory_gate_rows", "freeze_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_gate && !row.protected_action_executed_by_gate), "P481 source inventory gates must be ready."),
    validationItem("boundary.no_execution", "no_execution", boundary.read_only && boundary.report_only && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.source_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed, "P481 inventory must not execute commands or read/write generated artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P481 inventory must not mutate dependencies, package files, lockfiles, releases, git state, or protected recovery state."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ sourceRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_source_inventory_status: validation.valid ? "ready_for_operations_freeze" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_phase_start: `P${SOURCE_PHASE_START}`,
    source_phase_end: `P${SOURCE_PHASE_END}`,
    expected_source_count: EXPECTED_SOURCE_COUNT,
    source_inventory_row_count: sourceRows.length,
    discovered_ledger_row_count: sourceRows.filter((row) => row.ledger_row_present).length,
    complete_source_row_count: sourceRows.filter((row) => row.source_inventory_status === "complete").length,
    human_gated_source_row_count: sourceRows.filter((row) => row.source_inventory_status === "human_gated").length,
    blocked_source_row_count: sourceRows.filter((row) => row.source_inventory_status === "blocked").length,
    platform_source_row_count: sourceRows.filter((row) => row.source_domain === "platform").length,
    trading_source_row_count: sourceRows.filter((row) => row.source_domain === "trading").length,
    package_script_registered_source_count: sourceRows.filter((row) => row.package_script_registered).length,
    validation_chain_registered_source_count: sourceRows.filter((row) => row.validation_chain_registered).length,
    validation_chain_satisfied_source_count: sourceRows.filter((row) => row.validation_chain_satisfied).length,
    validation_chain_exception_source_count: sourceRows.filter((row) => row.validation_chain_exception_documented).length,
    missing_source_phase_count: sourceRows.filter((row) => !row.ledger_row_present && !row.duplicate_ledger_rows).length,
    missing_source_phases: sourceRows.filter((row) => !row.ledger_row_present && !row.duplicate_ledger_rows).map((row) => row.source_phase_slot),
    duplicate_source_phase_count: sourceRows.filter((row) => row.duplicate_ledger_rows).length,
    duplicate_source_phases: sourceRows.filter((row) => row.duplicate_ledger_rows).map((row) => row.source_phase_slot),
    freeze_gate_count: gateRows.length,
    ready_freeze_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    source_inventory_artifact_write_requested: boundary.source_inventory_artifact_write_requested,
    source_file_read_performed: boundary.source_file_read_performed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    source_command_execution_performed: boundary.source_command_execution_performed,
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
    "# Platform Operations Freeze Source Inventory",
    "",
    `Status: ${result.summary.platform_operations_freeze_source_inventory_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Sources: ${result.summary.complete_source_row_count}/${result.summary.source_inventory_row_count}`,
    `Ledger rows discovered: ${result.summary.discovered_ledger_row_count}/${result.summary.expected_source_count}`,
    `Freeze gates: ${result.summary.ready_freeze_gate_count}/${result.summary.freeze_gate_count}`,
    "",
    "## Source Summary",
    "",
    `- Platform rows: ${result.summary.platform_source_row_count}`,
    `- Trading rows: ${result.summary.trading_source_row_count}`,
    `- Missing phases: ${result.summary.missing_source_phases.join(", ") || "none"}`,
    `- Duplicate phases: ${result.summary.duplicate_source_phases.join(", ") || "none"}`,
    "",
    "## Freeze Gates",
    "",
    ...result.operations_freeze_source_inventory_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-source-inventory.mjs [options]

Options:
  --out-dir <folder>             Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_OUT_DIR}
  --run-at <iso>                 Deterministic generated_at timestamp.
  --package <path>               package.json path.
  --platform-ops-ledger <path>   P341-P500 platform operations ledger path.
  --schema <path>                Output schema path.
  --check                        Validate only, do not write artifacts.
  -h, --help                     Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS.platformOpsLedgerPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SOURCE_INVENTORY_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-source-inventory.${slugify(itemPath)}.${checkId}`,
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
