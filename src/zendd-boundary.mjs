import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_ZENDD_PROJECT_ROOT,
  buildZenddIntegrationSetup,
} from "./zendd-integration-setup.mjs";

export const DEFAULT_ZENDD_BOUNDARY_OUT_DIR = "artifacts/zendd-boundary/latest";
export const DEFAULT_ZENDD_BOUNDARY_INPUTS = {
  schemaPath: "schemas/zendd-boundary.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-boundary";
const SETUP_COMMAND_NAME = "project:zendd-integration-setup";
const SCHEMA_VERSION = "zendd-boundary.v1";
const CAPABILITY_ID = "project.zendd.boundary";
const PHASE_RANGE = "P526-P540";
const PHASE_SLOT = "P526";
const PREVIOUS_PHASE_SLOT = "P525";
const NEXT_PHASE_SLOT = "P541";

export async function runZenddBoundary(options = {}) {
  const result = await buildZenddBoundary(options);
  if (options.write !== false) await writeZenddBoundary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd boundary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const setup = await buildZenddIntegrationSetup({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const registration = buildProjectRegistration({ generatedAt, setup });
  const observationRows = buildObservationPolicyRows(setup);
  const commandCatalogRows = buildCommandCatalogRows(setup);
  const prohibitedOperationRows = buildProhibitedOperationRows();
  const rawMaterialPolicy = buildRawMaterialPolicy(generatedAt);
  const secretBoundaryPolicy = buildSecretBoundaryPolicy(generatedAt, setup);
  const protectedPassPolicy = buildProtectedPassPolicy(generatedAt);
  const dirtyTreePolicy = buildDirtyTreeMutationPolicy(generatedAt, setup);
  const blockedCapabilityRows = buildBlockedCapabilityLedgerRows(setup);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    setup,
    registration,
    observationRows,
    commandCatalogRows,
    prohibitedOperationRows,
    blockedCapabilityRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    setup,
    registration,
    observationRows,
    commandCatalogRows,
    prohibitedOperationRows,
    rawMaterialPolicy,
    secretBoundaryPolicy,
    protectedPassPolicy,
    dirtyTreePolicy,
    blockedCapabilityRows,
  });
  const validationItems = buildValidationItems({ gateRows, registration, commandCatalogRows, prohibitedOperationRows, blockedCapabilityRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    setup,
    registration,
    observationRows,
    commandCatalogRows,
    prohibitedOperationRows,
    blockedCapabilityRows,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_boundary_id: `zendd-boundary.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    boundary_anchor: anchor,
    source_setup_summary: setup.summary,
    project_zendd_registration: registration,
    observation_policy_rows: observationRows,
    zendd_command_catalog_rows: commandCatalogRows,
    prohibited_operation_rows: prohibitedOperationRows,
    raw_material_reference_policy: rawMaterialPolicy,
    secret_boundary_policy: secretBoundaryPolicy,
    protected_pass_policy: protectedPassPolicy,
    dirty_tree_mutation_policy: dirtyTreePolicy,
    blocked_capability_ledger_rows: blockedCapabilityRows,
    boundary_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_boundary")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    setup,
    registration,
    observationRows,
    commandCatalogRows,
    prohibitedOperationRows,
    blockedCapabilityRows,
    validation: result.validation,
  });
  result.summary.zendd_boundary_id = result.zendd_boundary_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-boundary.json"), serializableResult(result));
  await writeJson(path.join(outDir, "project-zendd-registration.json"), result.project_zendd_registration);
  await writeJson(path.join(outDir, "observation-policy-rows.json"), collectionEnvelope("zendd-observation-policy-rows.v1", "observation_policy_rows", result.observation_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-command-catalog-rows.json"), collectionEnvelope("zendd-command-catalog-rows.v1", "zendd_command_catalog_rows", result.zendd_command_catalog_rows, result.generated_at));
  await writeJson(path.join(outDir, "prohibited-operation-rows.json"), collectionEnvelope("zendd-prohibited-operation-rows.v1", "prohibited_operation_rows", result.prohibited_operation_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-capability-ledger-rows.json"), collectionEnvelope("zendd-blocked-capability-ledger-rows.v1", "blocked_capability_ledger_rows", result.blocked_capability_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-boundary-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddBoundary(args);
    console.log(`Zendd boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_boundary_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Command rows: ${result.summary.command_catalog_row_count}`);
    console.log(`Blocked capabilities: ${result.summary.blocked_capability_count}`);
    console.log(`Mutation allowed: ${result.summary.zendd_mutation_allowed}`);
    console.log(`Raw VDR copy allowed: ${result.summary.raw_vdr_copy_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildProjectRegistration({ generatedAt, setup }) {
  return {
    schema_version: "project-zendd-registration.v1",
    phase_slot: "P526",
    project_id: "project.zendd",
    project_name: "Zendd",
    domain_pack_id: "law-firm",
    parent_harness_id: "hermes",
    registration_mode: "external_project_adapter",
    external_project_root: setup.zendd_baseline.project_root,
    external_git_head_short: setup.zendd_baseline.source_control.git_head_short,
    source_of_truth: "external_zendd_checkout",
    hermes_role: "project_operations_evidence_claim_receipt_and_freeze_harness",
    zendd_role: "execution_engine_for_mna_vdr_ldd_report_and_desktop_workflows",
    code_directory_move_allowed: false,
    mutation_allowed: false,
    command_execution_allowed: false,
    raw_vdr_copy_allowed: false,
    protected_pass_allowed_without_receipt: false,
    registration_status: setup.validation.valid && setup.summary.zendd_integration_setup_status === "ready_for_project_zendd_boundary"
      ? "registered_read_only_external_project"
      : "documented_block_pending_setup",
    next_allowed_action: "implement project:zendd-dev-harness adapter with read-only evidence refs only",
    created_at: generatedAt,
  };
}

function buildObservationPolicyRows(setup) {
  const baseline = setup.zendd_baseline;
  const rows = [
    ["zendd.git_head", "P527", "git rev-parse --short HEAD", baseline.source_control.git_head_short, "metadata_only"],
    ["zendd.git_status", "P527", "git status --short", String(baseline.source_control.dirty_tree_count), "path_status_only"],
    ["zendd.root_package_scripts", "P527", "package.json scripts", baseline.runtime_profile.root_package_scripts, "metadata_only"],
    ["zendd.frontend_package_scripts", "P527", "frontend/package.json scripts", baseline.runtime_profile.frontend_package_scripts, "metadata_only"],
    ["zendd.backend_pyproject", "P527", "backend/pyproject.toml project metadata", baseline.runtime_profile.backend_project_name, "metadata_only"],
    ["zendd.electron_marker", "P527", "electron/main.cjs presence", baseline.runtime_profile.electron_entry_present, "presence_only"],
    ["zendd.vdr_ldd_markers", "P527", "VDR/LDD capability marker files", baseline.detected_capabilities, "presence_only"],
  ];
  return rows.map(([observationId, phaseSlot, source, observedValue, observationScope]) => ({
    schema_version: "zendd-observation-policy-row.v1",
    phase_slot: phaseSlot,
    observation_id: observationId,
    source,
    observation_scope: observationScope,
    observed_value_hash: hashValue(observedValue ?? null),
    allowed_in_boundary_phase: true,
    read_only: true,
    mutation_allowed: false,
    raw_content_allowed: false,
    secret_value_allowed: false,
    next_allowed_action: "bind observation to evidence_ref in later command evidence bridge",
  }));
}

function buildCommandCatalogRows(setup) {
  const rootScripts = setup.zendd_baseline.runtime_profile.root_package_scripts.map((scriptName) => ({
    scope: "root",
    package_path: "package.json",
    script_name: scriptName,
  }));
  const frontendScripts = setup.zendd_baseline.runtime_profile.frontend_package_scripts.map((scriptName) => ({
    scope: "frontend",
    package_path: "frontend/package.json",
    script_name: scriptName,
  }));
  const allScripts = [...rootScripts, ...frontendScripts];
  if (!allScripts.length) {
    return [commandCatalogRow({ scope: "none", packagePath: null, scriptName: "no_scripts_detected", index: 1 })];
  }
  return allScripts.map((script, index) => commandCatalogRow({
    scope: script.scope,
    packagePath: script.package_path,
    scriptName: script.script_name,
    index: index + 1,
  }));
}

function commandCatalogRow({ scope, packagePath, scriptName, index }) {
  const classification = classifyCommand(scriptName);
  return {
    schema_version: "zendd-command-catalog-row.v1",
    phase_slot: classification.phase_slot,
    row_id: `zendd-command-catalog.row.${String(index).padStart(3, "0")}`,
    project_id: "project.zendd",
    command_scope: scope,
    package_path: packagePath,
    script_name: scriptName,
    command_classification: classification.command_classification,
    execution_policy: classification.execution_policy,
    execution_allowed_in_boundary_phase: false,
    observed_only: true,
    evidence_ref: null,
    reviewer_ref: null,
    human_receipt_ref: null,
    verdict: classification.verdict,
    block_reason: classification.block_reason,
    next_allowed_action: classification.next_allowed_action,
  };
}

function classifyCommand(scriptName) {
  const lower = String(scriptName ?? "").toLowerCase();
  if (/(migrate|migration|alembic|db|seed|postgres|sql)/.test(lower)) {
    return commandClassification("P534", "database", "blocked_database_command", "database_command_not_allowed_in_boundary_phase", "create command evidence bridge and database receipt gate before execution");
  }
  if (/(package|electron|installer|dist|release|publish|sign|notar)/.test(lower)) {
    return commandClassification("P534", "packaging_or_release", "blocked_packaging_command", "packaging_command_not_allowed_in_boundary_phase", "defer to release/recovery bridge with human receipt");
  }
  if (/^(dev|start|serve|preview)$|(:dev|dev:|server|watch)/.test(lower)) {
    return commandClassification("P534", "runtime_or_server", "blocked_runtime_command", "runtime_command_not_allowed_in_boundary_phase", "defer to Zendd dev harness with sandbox and receipt policy");
  }
  if (/(test|lint|typecheck|check|verify|validate)/.test(lower)) {
    return commandClassification("P533", "check_mode_candidate", "candidate_not_executed", "check_candidate_requires_evidence_bridge", "map to command evidence bridge before execution");
  }
  if (/(install|postinstall|prepare|clean|rm|write|generate)/.test(lower)) {
    return commandClassification("P532", "mutating_or_dependency", "blocked_mutating_command", "mutating_command_not_allowed_in_boundary_phase", "require explicit work order and human receipt before execution");
  }
  return commandClassification("P531", "observed_unknown", "blocked_until_classified", "command_not_classified_for_execution", "classify command before adding evidence bridge");
}

function commandClassification(phaseSlot, commandClassificationValue, verdict, blockReason, nextAllowedAction) {
  return {
    phase_slot: phaseSlot,
    command_classification: commandClassificationValue,
    execution_policy: "catalog_only_no_execution",
    verdict,
    block_reason: blockReason,
    next_allowed_action: nextAllowedAction,
  };
}

function buildProhibitedOperationRows() {
  const rows = [
    ["copy_raw_vdr_material", "P528", "raw_vdr_copy", "raw_vdr_material_must_remain_in_zendd", "bind redacted evidence_ref only"],
    ["read_env_or_secret_values", "P528", "secret_read", "secret_values_are_not_integration_inputs", "use external secret handle and human triage"],
    ["run_zendd_mutating_command", "P528", "zendd_mutation", "mutating_commands_require_later_work_order", "create protected action request with receipt"],
    ["execute_zendd_command_now", "P529", "zendd_command_execution", "boundary_phase_is_catalog_only", "implement command evidence bridge"],
    ["promote_protected_pass_without_receipt", "P530", "protected_pass", "protected_outputs_require_human_receipt", "collect human_receipt_ref before PASS"],
    ["move_zendd_code_directory", "P536", "physical_code_move", "physical_integration_deferred_until_p741_p760", "wait for physical integration decision tranche"],
    ["mix_cross_project_confidential_data", "P537", "confidentiality_boundary", "domain_scoped_data_must_not_cross_project_boundary", "preserve project_id and matter_id scoping"],
    ["run_database_migration", "P538", "database_write", "database_migration_requires_dedicated_receipt_gate", "defer to command evidence and release/recovery bridge"],
  ];
  return rows.map(([operation_id, phase_slot, operation_type, block_reason, next_allowed_action]) => ({
    schema_version: "zendd-prohibited-operation-row.v1",
    phase_slot,
    operation_id,
    operation_type,
    allowed: false,
    verdict: "blocked",
    block_reason,
    responsible_owner: "integration_operator",
    next_allowed_action,
  }));
}

function buildRawMaterialPolicy(generatedAt) {
  return {
    schema_version: "zendd-raw-material-reference-policy.v1",
    phase_slot: "P529",
    project_id: "project.zendd",
    raw_vdr_copy_allowed: false,
    raw_client_document_copy_allowed: false,
    hermes_allowed_input_types: ["stable_reference_id", "redacted_summary", "evidence_ref", "review_receipt_ref"],
    prohibited_input_types: ["raw_vdr_file", "raw_client_document", "secret_file", "credential_value"],
    verdict: "pass",
    next_allowed_action: "create VDR/LDD source contract bridge with reference-only evidence refs",
    created_at: generatedAt,
  };
}

function buildSecretBoundaryPolicy(generatedAt, setup) {
  const secretRows = setup.dirty_tree_safety_inventory_rows.filter((row) => row.path_classification === "secret_or_environment_candidate");
  return {
    schema_version: "zendd-secret-boundary-policy.v1",
    phase_slot: "P530",
    project_id: "project.zendd",
    secret_value_read_allowed: false,
    env_file_read_allowed: false,
    secret_candidate_count: secretRows.length,
    secret_candidate_paths_hash: hashValue(secretRows.map((row) => row.path)),
    secret_candidate_policy: secretRows.length
      ? "documented_block_do_not_read_contents_require_user_triage"
      : "no_secret_candidates_observed_by_git_status",
    verdict: "pass",
    next_allowed_action: "keep secrets as external handles only",
    created_at: generatedAt,
  };
}

function buildProtectedPassPolicy(generatedAt) {
  return {
    schema_version: "zendd-protected-pass-policy.v1",
    phase_slot: "P530",
    project_id: "project.zendd",
    protected_claim_types: ["client_output", "release", "migration", "vdr_source", "ldd_fact_issue", "recovery"],
    pass_formula: "claim_to_evidence_to_review_gate_to_human_receipt_when_protected_to_pass_or_block",
    pass_without_human_receipt_allowed: false,
    pending_human_receipt_status: "pending_human_receipt",
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    verdict: "pass",
    next_allowed_action: "bind Zendd reviewer decisions to Hermes human_receipt_ref in P621-P640",
    created_at: generatedAt,
  };
}

function buildDirtyTreeMutationPolicy(generatedAt, setup) {
  const dirtyRows = setup.dirty_tree_safety_inventory_rows.filter((row) => row.status_code !== "clean");
  return {
    schema_version: "zendd-dirty-tree-mutation-policy.v1",
    phase_slot: "P535",
    project_id: "project.zendd",
    dirty_tree_row_count: dirtyRows.length,
    mutation_allowed: false,
    dirty_tree_blocks_mutation: true,
    all_dirty_rows_have_next_action: dirtyRows.every((row) => Boolean(row.next_allowed_action)),
    human_review_required_count: dirtyRows.filter((row) => row.human_review_required).length,
    verdict: "pass",
    next_allowed_action: dirtyRows.length
      ? "complete dirty-tree review receipt before any Zendd mutation"
      : "create explicit work order before any Zendd mutation",
    created_at: generatedAt,
  };
}

function buildBlockedCapabilityLedgerRows(setup) {
  return setup.feature_parity_matrix_rows.map((row, index) => ({
    schema_version: "zendd-blocked-capability-ledger-row.v1",
    phase_slot: "P536-P540",
    row_id: `zendd-blocked-capability.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    capability_id: row.feature_id,
    current_verdict: row.integration_decision === "defer_until_evidence" ? "blocked" : "documented_block",
    block_reason: blockReasonForFeature(row),
    missing_evidence: ["command_evidence_ref", "reviewer_or_gate_ref"],
    missing_receipt: row.pass_policy.includes("receipt") ? "human_receipt_ref_when_protected" : null,
    responsible_owner: row.standard_owner ?? "hermes",
    next_allowed_action: row.next_allowed_action,
  }));
}

function blockReasonForFeature(row) {
  if (row.integration_decision === "defer_until_evidence") return "physical_integration_requires_later_evidence";
  if (row.integration_decision === "bridge_status_only") return "status_bridge_missing_operator_surface";
  if (row.integration_decision === "mutual_hardening") return "combined_hard_gate_matrix_missing";
  return "bridge_contract_missing_evidence_review_and_receipt";
}

function buildAnchor({ packageJson, phaseLedger, setup, registration, observationRows, commandCatalogRows, prohibitedOperationRows, blockedCapabilityRows }) {
  return {
    schema_version: "zendd-boundary-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    setup_command_name: SETUP_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    setup_summary_hash: hashValue(setup.summary),
    project_registration_hash: hashValue(registration),
    observation_rows_hash: hashRows(observationRows, ["observation_id", "observation_scope", "read_only", "mutation_allowed"]),
    command_catalog_hash: hashRows(commandCatalogRows, ["script_name", "command_classification", "execution_allowed_in_boundary_phase", "verdict"]),
    prohibited_operations_hash: hashRows(prohibitedOperationRows, ["operation_id", "allowed", "block_reason", "next_allowed_action"]),
    blocked_capability_hash: hashRows(blockedCapabilityRows, ["capability_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({
  packageJson,
  phaseLedger,
  setup,
  registration,
  observationRows,
  commandCatalogRows,
  prohibitedOperationRows,
  rawMaterialPolicy,
  secretBoundaryPolicy,
  protectedPassPolicy,
  dirtyTreePolicy,
  blockedCapabilityRows,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  const hasBlockedDbOrPackageOrRuntime = commandCatalogRows.some((row) => (
    ["database", "packaging_or_release", "runtime_or_server"].includes(row.command_classification)
      && row.execution_allowed_in_boundary_phase === false
  ));
  return [
    gateRow("p526_project_registration_declared", "P526", registration.registration_status === "registered_read_only_external_project" && registration.code_directory_move_allowed === false, "project.zendd is registered as a read-only external project.", "complete P521-P525 setup before registration"),
    gateRow("p527_observation_policy_read_only", "P527", observationRows.length >= 7 && observationRows.every((row) => row.read_only && !row.mutation_allowed && !row.raw_content_allowed), "Observation policy allows metadata/presence only.", "restrict observations to metadata and presence"),
    gateRow("p528_prohibited_operations_fail_closed", "P528", prohibitedOperationRows.length >= 8 && prohibitedOperationRows.every((row) => row.allowed === false && row.block_reason && row.next_allowed_action), "Prohibited operations fail closed with reasons and next actions.", "document every prohibited operation with a next action"),
    gateRow("p529_raw_material_reference_only", "P529", rawMaterialPolicy.raw_vdr_copy_allowed === false && rawMaterialPolicy.raw_client_document_copy_allowed === false, "Raw VDR/client material remains reference-only.", "disable raw material copy into Hermes"),
    gateRow("p530_secret_and_protected_pass_boundary", "P530", secretBoundaryPolicy.secret_value_read_allowed === false && protectedPassPolicy.pass_without_human_receipt_allowed === false, "Secret values are not read and protected PASS requires receipt.", "enforce secret and receipt boundary"),
    gateRow("p531_command_catalog_declared", "P531", commandCatalogRows.length >= 1 && commandCatalogRows.every((row) => row.script_name && row.command_classification), "Zendd package scripts are cataloged without execution.", "catalog Zendd commands before evidence bridge"),
    gateRow("p532_no_zendd_commands_executed", "P532", commandCatalogRows.every((row) => row.execution_allowed_in_boundary_phase === false && row.observed_only === true), "Boundary phase does not execute Zendd commands.", "keep command execution disabled"),
    gateRow("p533_check_candidates_not_promoted", "P533", commandCatalogRows.filter((row) => row.command_classification === "check_mode_candidate").every((row) => row.verdict === "candidate_not_executed" && row.evidence_ref === null), "Check-mode candidates remain unexecuted until evidence bridge.", "map check commands to evidence refs before execution"),
    gateRow("p534_db_packaging_runtime_blocked", "P534", hasBlockedDbOrPackageOrRuntime || commandCatalogRows.every((row) => row.execution_allowed_in_boundary_phase === false), "Database, packaging, and runtime commands are blocked in boundary phase.", "defer DB/runtime/package commands to later receipt gates"),
    gateRow("p535_dirty_tree_blocks_mutation", "P535", dirtyTreePolicy.mutation_allowed === false && dirtyTreePolicy.dirty_tree_blocks_mutation && dirtyTreePolicy.all_dirty_rows_have_next_action, "Dirty tree policy blocks mutation and records next actions.", "complete dirty-tree review receipt before mutation"),
    gateRow("p536_blocked_capability_ledger_has_reasons", "P536-P540", blockedCapabilityRows.length >= 8 && blockedCapabilityRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Every blocked capability has reason, owner, and next action.", "complete blocked capability ledger"),
    gateRow("package_script_registered", "P540", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P540", phaseLedger.available && phaseLedger.text.includes("P526-P540") && phaseLedger.text.includes(COMMAND_NAME), "P526-P540 phase ledger declares boundary acceptance.", "record P526-P540 in phase ledger"),
    gateRow("setup_chain_valid", "P540", setup.validation.valid && setup.summary.zendd_integration_setup_status === "ready_for_project_zendd_boundary", "P521-P525 setup remains valid before P526-P540 boundary.", "repair setup validation before boundary"),
  ];
}

function buildValidationItems({ gateRows, registration, commandCatalogRows, prohibitedOperationRows, blockedCapabilityRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "boundary_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("registration.mutation_allowed", "safety_boundary", registration.mutation_allowed === false, "project.zendd registration does not permit mutation"));
  items.push(validationItem("registration.command_execution_allowed", "safety_boundary", registration.command_execution_allowed === false, "project.zendd registration does not permit command execution"));
  items.push(validationItem("registration.raw_vdr_copy_allowed", "safety_boundary", registration.raw_vdr_copy_allowed === false, "project.zendd registration does not permit raw VDR copies"));
  items.push(validationItem("commands.execution_allowed", "safety_boundary", commandCatalogRows.every((row) => row.execution_allowed_in_boundary_phase === false), "Zendd commands are cataloged only"));
  items.push(validationItem("prohibited.allowed", "safety_boundary", prohibitedOperationRows.every((row) => row.allowed === false), "Prohibited operations are blocked"));
  items.push(validationItem("blocked_capabilities.next_allowed_action", "claim_boundary", blockedCapabilityRows.every((row) => row.block_reason && row.next_allowed_action), "Blocked capabilities include block reason and next action"));
  return items;
}

function buildSummary({ setup, registration, observationRows, commandCatalogRows, prohibitedOperationRows, blockedCapabilityRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_boundary_status: validation.valid
      ? "ready_for_zendd_dev_harness_adapter"
      : "documented_block_pending_boundary_gate",
    zendd_project_root: registration.external_project_root,
    zendd_git_head_short: setup.summary.zendd_git_head_short,
    source_setup_status: setup.summary.zendd_integration_setup_status,
    registration_mode: registration.registration_mode,
    domain_pack_id: registration.domain_pack_id,
    observation_policy_row_count: observationRows.length,
    command_catalog_row_count: commandCatalogRows.length,
    prohibited_operation_count: prohibitedOperationRows.length,
    blocked_capability_count: blockedCapabilityRows.length,
    check_mode_candidate_count: commandCatalogRows.filter((row) => row.command_classification === "check_mode_candidate").length,
    zendd_mutation_allowed: registration.mutation_allowed,
    command_execution_allowed: registration.command_execution_allowed,
    raw_vdr_copy_allowed: registration.raw_vdr_copy_allowed,
    code_directory_move_allowed: registration.code_directory_move_allowed,
    protected_pass_allowed_without_receipt: registration.protected_pass_allowed_without_receipt,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-boundary-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_boundary_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_BOUNDARY_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_BOUNDARY_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_BOUNDARY_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_BOUNDARY_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.phaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P526-P540 Zendd-Hermes read-only boundary verifier.
--check validates without writing artifacts.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Boundary Summary",
    "",
    `- Status: ${summary.zendd_boundary_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Domain pack: ${summary.domain_pack_id}`,
    `- Command rows: ${summary.command_catalog_row_count}`,
    `- Blocked capabilities: ${summary.blocked_capability_count}`,
    `- Mutation allowed: ${summary.zendd_mutation_allowed}`,
    `- Command execution allowed: ${summary.command_execution_allowed}`,
    `- Raw VDR copy allowed: ${summary.raw_vdr_copy_allowed}`,
    `- Code move allowed: ${summary.code_directory_move_allowed}`,
    `- Protected PASS without receipt allowed: ${summary.protected_pass_allowed_without_receipt}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.project_zendd_registration.next_allowed_action,
    "",
  ].join("\n");
}
