import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";

const execFileAsync = promisify(execFile);

export const DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_OUT_DIR = "artifacts/zendd-actual-checkout-preflight/latest";
export const DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS = {
  schemaPath: "schemas/zendd-actual-checkout-preflight.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  designTokensPath: "configs/hermes/operator-design-tokens.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-actual-checkout-preflight";
const DEVELOPMENT_FREEZE_COMMAND_NAME = "project:zendd-development-freeze-cockpit";
const SCHEMA_VERSION = "zendd-actual-checkout-preflight.v1";
const CAPABILITY_ID = "project.zendd.actual_checkout_preflight";
const PHASE_RANGE = "P1001-P1040";
const PHASE_SLOT = "P1001";
const PREVIOUS_PHASE_SLOT = "P1000";
const NEXT_PHASE_SLOT = "P1041";
const READY_STATUS = "ready_for_zendd_actual_checkout_preflight";

const ROOT_SCRIPT_COMMANDS = [
  ["root.dev", "root_package_script", "dev", "interactive_runtime", true],
  ["root.build", "root_package_script", "build", "release_or_build", true],
  ["root.build_frontend", "root_package_script", "build:frontend", "frontend_build", true],
  ["root.lint_frontend", "root_package_script", "lint:frontend", "frontend_lint", false],
  ["root.dev_backend", "root_package_script", "dev:backend", "backend_runtime", true],
  ["root.dev_electron", "root_package_script", "dev:electron", "desktop_runtime", true],
  ["root.dist_win", "root_package_script", "dist:win", "desktop_release", true],
  ["root.setup", "root_package_script", "setup", "environment_setup", true],
];

const FRONTEND_SCRIPT_COMMANDS = [
  ["frontend.lint", "frontend_package_script", "lint", "frontend_lint", false],
  ["frontend.test", "frontend_package_script", "test", "frontend_test", false],
  ["frontend.test_coverage", "frontend_package_script", "test:coverage", "frontend_test", false],
  ["frontend.test_e2e", "frontend_package_script", "test:e2e", "browser_or_e2e_test", true],
  ["frontend.build", "frontend_package_script", "build", "frontend_build", true],
  ["frontend.preview", "frontend_package_script", "preview", "interactive_runtime", true],
];

export async function runZenddActualCheckoutPreflight(options = {}) {
  const result = await buildZenddActualCheckoutPreflight(options);
  if (options.write !== false) await writeZenddActualCheckoutPreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd actual checkout preflight failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddActualCheckoutPreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const developmentFreeze = buildDevelopmentFreezeSource({ generatedAt, packageJson, developmentPhaseLedger });
  const checkoutProbe = await probeActualCheckout(inputs.zendd_project_root);
  const policy = buildPreflightPolicy(generatedAt, developmentFreeze, checkoutProbe);
  const locatorRows = buildLocatorRows(checkoutProbe);
  const stackRows = buildStackInventoryRows(checkoutProbe);
  const commandRows = buildCommandCandidateRows(checkoutProbe);
  const protectedRows = buildProtectedActionRows({ checkoutProbe, commandRows });
  const boundaryRows = buildBoundaryRows({ checkoutProbe, commandRows, protectedRows });
  const claimRows = buildClaimRows({ locatorRows, stackRows, commandRows, protectedRows, boundaryRows });
  const closeoutRows = buildCloseoutRows({ policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, developmentFreeze, checkoutProbe, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, developmentFreeze, checkoutProbe, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_actual_checkout_preflight_id: `zendd-actual-checkout-preflight.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    actual_checkout_preflight_anchor: anchor,
    source_development_freeze_summary: developmentFreeze.summary,
    actual_checkout_identity: checkoutProbe.identity,
    actual_checkout_read_only_probe: checkoutProbe.read_only_probe,
    actual_checkout_preflight_policy: policy,
    actual_checkout_locator_rows: locatorRows,
    actual_checkout_stack_inventory_rows: stackRows,
    actual_checkout_command_candidate_rows: commandRows,
    actual_checkout_protected_action_rows: protectedRows,
    actual_checkout_boundary_rows: boundaryRows,
    actual_checkout_claim_rows: claimRows,
    actual_checkout_closeout_rows: closeoutRows,
    actual_checkout_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ checkoutProbe, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_actual_checkout_preflight")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ checkoutProbe, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.zendd_actual_checkout_preflight_id = result.zendd_actual_checkout_preflight_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddActualCheckoutPreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-actual-checkout-preflight.json"), serializableResult(result));
  await writeJson(path.join(outDir, "actual-checkout-identity.json"), result.actual_checkout_identity);
  await writeJson(path.join(outDir, "actual-checkout-preflight-policy.json"), result.actual_checkout_preflight_policy);
  await writeJson(path.join(outDir, "actual-checkout-locator-rows.json"), collectionEnvelope("zendd-actual-checkout-locator-rows.v1", "actual_checkout_locator_rows", result.actual_checkout_locator_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-stack-inventory-rows.json"), collectionEnvelope("zendd-actual-checkout-stack-inventory-rows.v1", "actual_checkout_stack_inventory_rows", result.actual_checkout_stack_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-command-candidate-rows.json"), collectionEnvelope("zendd-actual-checkout-command-candidate-rows.v1", "actual_checkout_command_candidate_rows", result.actual_checkout_command_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-protected-action-rows.json"), collectionEnvelope("zendd-actual-checkout-protected-action-rows.v1", "actual_checkout_protected_action_rows", result.actual_checkout_protected_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-boundary-rows.json"), collectionEnvelope("zendd-actual-checkout-boundary-rows.v1", "actual_checkout_boundary_rows", result.actual_checkout_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-claim-rows.json"), collectionEnvelope("zendd-actual-checkout-claim-rows.v1", "actual_checkout_claim_rows", result.actual_checkout_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-closeout-rows.json"), collectionEnvelope("zendd-actual-checkout-closeout-rows.v1", "actual_checkout_closeout_rows", result.actual_checkout_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "actual-checkout-gate-rows.json"), collectionEnvelope("zendd-actual-checkout-gate-rows.v1", "actual_checkout_gate_rows", result.actual_checkout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-actual-checkout-preflight-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddActualCheckoutPreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddActualCheckoutPreflight(args);
    console.log(`Zendd actual checkout preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_actual_checkout_preflight_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Stack markers: ${result.summary.stack_marker_count}`);
    console.log(`Command candidates: ${result.summary.command_candidate_count}`);
    console.log(`Protected candidates: ${result.summary.protected_action_candidate_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Mutation allowed: ${result.summary.zendd_mutation_allowed_now}`);
    console.log(`Command execution allowed: ${result.summary.command_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPreflightPolicy(generatedAt, developmentFreeze, checkoutProbe) {
  return {
    schema_version: "zendd-actual-checkout-preflight-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_development_freeze_ref: developmentFreeze.zendd_development_freeze_cockpit_id,
    actual_zendd_root_ref: checkoutProbe.identity.zendd_project_root_ref,
    preflight_surface_creation_allowed: true,
    actual_checkout_reference_allowed: true,
    actual_checkout_mutation_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    package_install_allowed_now: false,
    database_migration_allowed_now: false,
    release_or_build_allowed_now: false,
    server_start_allowed_now: false,
    git_write_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_read_allowed_now: false,
    raw_log_storage_allowed_now: false,
    secret_read_allowed_now: false,
    env_file_open_allowed_now: false,
    manifest_content_read_allowed: true,
    manifest_script_values_stored: false,
    dirty_path_values_stored: false,
    dirty_path_hashes_allowed: true,
    command_candidates_are_advisory_only: true,
    pass_without_evidence_allowed: false,
    block_without_next_action_allowed: false,
    protected_claim_requires_human_receipt: true,
    next_allowed_action: "advance to P1041-P1080 Zendd development work loop only after this preflight remains green and a scoped work order exists",
    created_at: generatedAt,
  };
}

function buildDevelopmentFreezeSource({ generatedAt, packageJson, developmentPhaseLedger }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateChain = scripts.validate ?? "";
  const p1000Command = `npm run ${DEVELOPMENT_FREEZE_COMMAND_NAME} -- --check`;
  const p1001Command = `npm run ${COMMAND_NAME} -- --check`;
  const p1000Index = validateChain.indexOf(p1000Command);
  const p1001Index = validateChain.indexOf(p1001Command);
  const scriptRegistered = typeof scripts[DEVELOPMENT_FREEZE_COMMAND_NAME] === "string";
  const validateOrderReady = p1000Index >= 0 && p1001Index > p1000Index;
  const ledgerReady = developmentPhaseLedger.available
    && developmentPhaseLedger.text.includes("P761-P1000")
    && developmentPhaseLedger.text.includes("P981-P1000")
    && developmentPhaseLedger.text.includes(DEVELOPMENT_FREEZE_COMMAND_NAME)
    && developmentPhaseLedger.text.includes("P1001-P1040");
  const errors = [];
  if (!scriptRegistered) errors.push({ path: "source.p1000.script", message: `${DEVELOPMENT_FREEZE_COMMAND_NAME} is not registered.` });
  if (!validateOrderReady) errors.push({ path: "source.p1000.validate_order", message: `${DEVELOPMENT_FREEZE_COMMAND_NAME} must run before ${COMMAND_NAME} in validate.` });
  if (!ledgerReady) errors.push({ path: "source.p1000.ledger", message: "Development ledger must declare P761-P1000, P981-P1000, and P1001-P1040." });
  const valid = errors.length === 0;
  return {
    zendd_development_freeze_cockpit_id: `zendd-development-freeze-cockpit.source-ref.${dateStamp(generatedAt)}`,
    summary: {
      phase_range: "P981-P1000",
      phase_slot: "P981",
      command_name: DEVELOPMENT_FREEZE_COMMAND_NAME,
      source_model: "validate_chain_source_ref",
      source_ref_requires_prior_validate_execution: true,
      p1000_command_registered: scriptRegistered,
      p1000_runs_before_p1001_in_validate: validateOrderReady,
      development_phase_ledger_declares_p1000_and_p1001: ledgerReady,
      zendd_development_freeze_cockpit_status: valid
        ? "ready_for_zendd_development_freeze_cockpit"
        : "documented_block_pending_development_freeze_source_ref",
    },
    validation: {
      valid,
      errors,
    },
  };
}

function buildLocatorRows(checkoutProbe) {
  const identity = checkoutProbe.identity;
  return [
    locatorRow("project_root", "P1001", identity.project_root_exists, "external_zendd_checkout_root", "Locate the external Zendd root without moving code.", "confirm the configured Zendd root path"),
    locatorRow("git_worktree", "P1002", identity.git_present, "external_zendd_git_worktree", "Confirm Zendd is still a standalone git worktree.", "confirm Zendd git checkout before development loop"),
    locatorRow("source_of_truth", "P1003", identity.source_of_truth === "external_zendd_checkout", "external_source_of_truth", "Keep Zendd source of truth outside Hermes.", "restore external adapter source-of-truth declaration"),
    locatorRow("read_only_probe", "P1004", checkoutProbe.read_only_probe.checkout_mutation_performed === false && checkoutProbe.read_only_probe.protected_command_executed === false, "read_only_probe_only", "Only read-only filesystem and git probes were used.", "remove mutating checkout probes"),
    locatorRow("path_redaction", "P1005", checkoutProbe.read_only_probe.dirty_path_values_stored === false, "dirty_paths_hashed_not_stored", "Dirty path values are not stored in Hermes preflight artifacts.", "redact dirty paths and store hashes only"),
  ];
}

function buildStackInventoryRows(checkoutProbe) {
  const markers = checkoutProbe.markers;
  const rows = [
    stackRow("root_package_json", "P1011", "package_manifest", markers.root_package.available, true, markers.root_package.content_read_performed, "Root package manifest is available for script-key inventory.", "confirm root package.json"),
    stackRow("root_package_lock", "P1012", "lockfile", markers.root_package_lock.available, false, false, "Root npm lockfile is present.", "confirm root package lockfile"),
    stackRow("frontend_package_json", "P1013", "package_manifest", markers.frontend_package.available, true, markers.frontend_package.content_read_performed, "Frontend package manifest is available for script-key inventory.", "confirm frontend package.json"),
    stackRow("frontend_package_lock", "P1014", "lockfile", markers.frontend_package_lock.available, false, false, "Frontend npm lockfile is present.", "confirm frontend package lockfile"),
    stackRow("frontend_vite_config", "P1015", "frontend_config", markers.frontend_vite.available, false, false, "Vite frontend marker is present.", "confirm frontend Vite config"),
    stackRow("frontend_src", "P1016", "frontend_source_dir", markers.frontend_src.available, false, false, "Frontend source directory marker is present.", "confirm frontend source directory"),
    stackRow("backend_pyproject", "P1017", "python_project_manifest", markers.backend_pyproject.available, true, markers.backend_pyproject.content_read_performed, "Backend pyproject metadata is available.", "confirm backend pyproject"),
    stackRow("backend_tests", "P1018", "python_tests_dir", markers.backend_tests.available, false, false, "Backend tests directory marker is present.", "confirm backend tests directory"),
    stackRow("backend_alembic_ini", "P1019", "database_migration_config", markers.backend_alembic_ini.available, false, false, "Alembic config marker is present without opening database URL content.", "confirm Alembic config marker"),
    stackRow("backend_migrations", "P1020", "database_migrations_dir", markers.backend_migrations.available, false, false, "Migration directory marker is present.", "confirm backend migrations directory"),
  ];
  return rows.map((row, index) => ({ ...row, row_id: `zendd-actual-stack.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildCommandCandidateRows(checkoutProbe) {
  const rootScriptKeys = checkoutProbe.markers.root_package.script_keys;
  const frontendScriptKeys = checkoutProbe.markers.frontend_package.script_keys;
  const rows = [];
  for (const [candidateId, sourceType, scriptKey, commandClass, protectedByDefault] of ROOT_SCRIPT_COMMANDS) {
    if (rootScriptKeys.includes(scriptKey)) rows.push(commandRow(candidateId, "P1031", sourceType, scriptKey, commandClass, protectedByDefault));
  }
  for (const [candidateId, sourceType, scriptKey, commandClass, protectedByDefault] of FRONTEND_SCRIPT_COMMANDS) {
    if (frontendScriptKeys.includes(scriptKey)) rows.push(commandRow(candidateId, "P1032", sourceType, scriptKey, commandClass, protectedByDefault));
  }
  if (checkoutProbe.markers.backend_tests.available) rows.push(commandRow("backend.pytest", "P1033", "backend_inferred_command", "pytest", "backend_test", false));
  if (checkoutProbe.markers.backend_alembic_ini.available) rows.push(commandRow("backend.alembic_current", "P1034", "backend_inferred_command", "alembic current", "database_inspection", true));
  if (checkoutProbe.markers.backend_migrations.available) rows.push(commandRow("backend.alembic_upgrade_head", "P1034", "backend_inferred_command", "alembic upgrade head", "database_migration", true));
  return rows.map((row, index) => ({ ...row, row_id: `zendd-actual-command-candidate.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildProtectedActionRows({ checkoutProbe, commandRows }) {
  const protectedCommandRows = commandRows.filter((row) => row.protected_command);
  const rows = protectedCommandRows.map((row, index) => ({
    schema_version: "zendd-actual-protected-action-row.v1",
    phase_slot: index < 5 ? "P1023" : "P1024",
    action_id: `protected-action.zendd.actual.${row.command_candidate_id}`,
    source_command_candidate_ref: row.command_candidate_id,
    action_class: row.command_class,
    current_verdict: "blocked",
    block_reason: protectedBlockReason(row.command_class),
    responsible_owner: "zendd_integration_operator",
    evidence_ref: row.evidence_ref,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.protected.${row.command_candidate_id}`,
    human_receipt_ref: `receipt.zendd.actual.protected.${row.command_candidate_id}`,
    rollback_target_ref: rollbackTargetForCommand(row.command_class),
    action_execution_allowed_now: false,
    next_allowed_action: "create scoped work order, command evidence packet, human receipt, and rollback plan before this protected action",
  }));
  rows.push({
    schema_version: "zendd-actual-protected-action-row.v1",
    phase_slot: "P1025",
    action_id: "protected-action.zendd.actual.mutate_external_checkout",
    source_command_candidate_ref: null,
    action_class: "external_checkout_mutation",
    current_verdict: "blocked",
    block_reason: "external_checkout_mutation_not_allowed_in_preflight",
    responsible_owner: "zendd_integration_operator",
    evidence_ref: "evidence.zendd.actual.mutation.block",
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: "hard-gate.zendd.actual.mutation.block",
    human_receipt_ref: "receipt.zendd.actual.mutation.block",
    rollback_target_ref: "rollback-target.zendd.actual.external_checkout_unmodified",
    action_execution_allowed_now: false,
    next_allowed_action: "open a future scoped Zendd work order before any file write",
  });
  if (checkoutProbe.risk_markers.some((row) => row.risk_marker_type === "run_log_surface")) {
    rows.push({
      schema_version: "zendd-actual-protected-action-row.v1",
      phase_slot: "P1026",
      action_id: "protected-action.zendd.actual.read_run_logs",
      source_command_candidate_ref: null,
      action_class: "raw_log_read",
      current_verdict: "blocked",
      block_reason: "raw_log_read_not_allowed_in_preflight",
      responsible_owner: "zendd_integration_operator",
      evidence_ref: "evidence.zendd.actual.raw_log.block",
      reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
      hard_gate_ref: "hard-gate.zendd.actual.raw_log.block",
      human_receipt_ref: "receipt.zendd.actual.raw_log.block",
      rollback_target_ref: "rollback-target.zendd.actual.no_raw_log_storage",
      action_execution_allowed_now: false,
      next_allowed_action: "request explicit redacted log evidence through a future receipt-gated incident work order",
    });
  }
  return rows.map((row, index) => ({ ...row, row_id: `zendd-actual-protected-action.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildBoundaryRows({ checkoutProbe, commandRows, protectedRows }) {
  const riskRows = checkoutProbe.risk_markers.map((riskRow, index) => ({
    schema_version: "zendd-actual-boundary-row.v1",
    phase_slot: index < 4 ? "P1021" : "P1022",
    boundary_id: `boundary.zendd.actual.${riskRow.risk_marker_id}`,
    boundary_type: riskRow.risk_marker_type,
    marker_observed: riskRow.observed,
    current_verdict: "blocked",
    block_reason: riskRow.block_reason,
    responsible_owner: "zendd_integration_operator",
    evidence_ref: riskRow.evidence_ref,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.${riskRow.risk_marker_id}`,
    human_receipt_ref: riskRow.human_receipt_required ? `receipt.zendd.actual.${riskRow.risk_marker_id}` : null,
    rollback_target_ref: riskRow.rollback_target_ref,
    content_read_allowed_now: false,
    content_read_performed: false,
    raw_payload_stored: false,
    next_allowed_action: riskRow.next_allowed_action,
  }));
  const fixedRows = [
    boundaryRow("command_execution", "P1027", commandRows.length > 0, "command_execution_disabled_in_preflight", "evidence.zendd.actual.command_execution.block", "rollback-target.zendd.actual.no_command_execution", "advance to a future evidence execution bridge only after work order receipt"),
    boundaryRow("protected_action_execution", "P1028", protectedRows.length > 0, "protected_actions_disabled_in_preflight", "evidence.zendd.actual.protected_action.block", "rollback-target.zendd.actual.no_protected_action_execution", "keep protected actions blocked until human receipt and rollback plan exist"),
    boundaryRow("external_checkout_mutation", "P1029", true, "external_checkout_mutation_disabled_in_preflight", "evidence.zendd.actual.checkout_mutation.block", "rollback-target.zendd.actual.external_checkout_unmodified", "keep Zendd checkout unmodified during preflight"),
    boundaryRow("claim_preflight_freeze", "P1030", true, "claims_require_pass_or_documented_block", "evidence.zendd.actual.claim_freeze.block", "rollback-target.zendd.actual.preflight_claim_surface", "adjudicate every preflight claim before P1041"),
  ];
  return [...riskRows, ...fixedRows].map((row, index) => ({ ...row, row_id: `zendd-actual-boundary.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildClaimRows({ locatorRows, stackRows, commandRows, protectedRows, boundaryRows }) {
  const rows = [];
  for (const row of [...locatorRows, ...stackRows]) {
    rows.push(preflightClaim({
      sourceType: row.schema_version.includes("locator") ? "locator" : "stack_marker",
      sourceRef: row.locator_id ?? row.stack_marker_id,
      claimType: row.current_verdict === "pass" ? "actual_checkout_readiness" : "actual_checkout_missing_marker",
      verdict: row.current_verdict,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      humanReceiptRef: null,
      rollbackTargetRef: row.rollback_target_ref,
      blockReason: row.block_reason,
      nextAllowedAction: row.next_allowed_action,
    }));
  }
  for (const row of [...commandRows, ...protectedRows, ...boundaryRows]) {
    rows.push(preflightClaim({
      sourceType: row.schema_version.includes("command") ? "command_candidate" : row.schema_version.includes("protected") ? "protected_action" : "boundary",
      sourceRef: row.command_candidate_id ?? row.action_id ?? row.boundary_id,
      claimType: "actual_checkout_blocked_surface",
      verdict: "blocked",
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      humanReceiptRef: row.human_receipt_ref ?? null,
      rollbackTargetRef: row.rollback_target_ref,
      blockReason: row.block_reason,
      nextAllowedAction: row.next_allowed_action,
    }));
  }
  return rows.map((row, index) => ({
    ...row,
    row_id: `zendd-actual-claim.row.${String(index + 1).padStart(3, "0")}`,
    claim_id: `claim.zendd.actual.${String(index + 1).padStart(3, "0")}.${row.source_type}.${sanitizeId(row.source_ref)}`,
  }));
}

function buildCloseoutRows({ policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows }) {
  const rows = [
    closeoutRow("p1001_locator_ready", "P1001", locatorRows.every((row) => row.current_verdict === "pass"), "Actual Zendd checkout locator is ready.", "repair actual checkout locator rows"),
    closeoutRow("p1011_stack_inventory_ready", "P1011", stackRows.filter((row) => row.required_marker).every((row) => row.current_verdict === "pass"), "Stack inventory required markers are ready.", "repair stack inventory markers"),
    closeoutRow("p1021_boundaries_documented", "P1021", boundaryRows.every(isDocumentedBlocked), "Risk boundaries are documented as BLOCK with next actions.", "document every boundary block reason and next action"),
    closeoutRow("p1031_command_candidates_blocked", "P1031", commandRows.length >= 6 && commandRows.every(isDocumentedBlocked), "Command candidates are inventoried and blocked from execution.", "document command candidate blocks"),
    closeoutRow("p1035_protected_candidates_blocked", "P1035", protectedRows.length >= 4 && protectedRows.every(isDocumentedBlocked), "Protected action candidates remain receipt-gated and blocked.", "document protected action blocks"),
    closeoutRow("p1040_claims_adjudicated", "P1040", claimRows.every((row) => row.verdict === "pass" ? isPassClaim(row) : isBlockedClaim(row)), "Every preflight claim is PASS or documented BLOCK.", "repair claim adjudication rows"),
  ];
  return rows.map((row, index) => ({
    ...row,
    row_id: `zendd-actual-closeout.row.${String(index + 1).padStart(2, "0")}`,
    source_policy_ref: policy.schema_version,
  }));
}

function buildAnchor({ packageJson, developmentPhaseLedger, developmentFreeze, checkoutProbe, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows }) {
  return {
    schema_version: "zendd-actual-checkout-preflight-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_development_freeze_command_name: DEVELOPMENT_FREEZE_COMMAND_NAME,
    source_development_freeze_ref: developmentFreeze.zendd_development_freeze_cockpit_id,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    zendd_project_root_hash: hashValue(checkoutProbe.identity.zendd_project_root),
    zendd_git_head_short: checkoutProbe.identity.git_head_short,
    policy_hash: hashValue(policy),
    locator_rows_hash: hashRows(locatorRows, ["locator_id", "current_verdict", "evidence_ref"]),
    stack_rows_hash: hashRows(stackRows, ["stack_marker_id", "current_verdict", "marker_type"]),
    command_rows_hash: hashRows(commandRows, ["command_candidate_id", "current_verdict", "command_class"]),
    protected_rows_hash: hashRows(protectedRows, ["action_id", "current_verdict", "block_reason"]),
    boundary_rows_hash: hashRows(boundaryRows, ["boundary_id", "current_verdict", "block_reason"]),
    claim_rows_hash: hashRows(claimRows, ["claim_id", "verdict", "block_reason"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_id", "closeout_status"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, developmentFreeze, checkoutProbe, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p1001_source_p1000_ready", "P1001", developmentFreeze.validation.valid && developmentFreeze.summary.zendd_development_freeze_cockpit_status === "ready_for_zendd_development_freeze_cockpit", "P1000 development freeze cockpit is ready.", "repair P981-P1000 development freeze cockpit"),
    gateRow("p1002_actual_root_exists", "P1002", checkoutProbe.identity.project_root_exists && checkoutProbe.identity.source_of_truth === "external_zendd_checkout", "Actual Zendd root exists and remains external.", "confirm Zendd root path"),
    gateRow("p1003_git_identity_observed", "P1003", checkoutProbe.identity.git_present && checkoutProbe.identity.git_head_short, "Zendd git identity was observed with read-only probes.", "confirm Zendd git worktree"),
    gateRow("p1011_stack_inventory_required_markers", "P1011", stackRows.filter((row) => row.required_marker).every((row) => row.current_verdict === "pass"), "Root/frontend/backend/Alembic required markers are inventoried.", "complete Zendd stack marker inventory"),
    gateRow("p1021_no_secret_or_raw_content_read", "P1021", [...checkoutProbe.risk_markers, ...boundaryRows].every((row) => row.content_read_performed === false && row.raw_payload_stored === false), "Secret, raw VDR/client, and log surfaces were not opened or stored.", "remove raw content reads from preflight"),
    gateRow("p1028_no_mutation_or_command_execution", "P1028", !policy.actual_checkout_mutation_allowed_now && !policy.command_execution_allowed_now && checkoutProbe.read_only_probe.checkout_mutation_performed === false && checkoutProbe.read_only_probe.protected_command_executed === false, "Preflight performs no Zendd mutation or command execution.", "disable mutating probes and commands"),
    gateRow("p1031_command_candidates_documented", "P1031", commandRows.length >= 6 && commandRows.every(isDocumentedBlocked), "Command candidates are present as blocked evidence candidates.", "document command evidence candidates"),
    gateRow("p1035_protected_actions_receipt_gated", "P1035", protectedRows.length >= 4 && protectedRows.every((row) => row.human_receipt_ref && isDocumentedBlocked(row)), "Protected actions are human-receipt gated and blocked.", "attach receipt refs to protected action blocks"),
    gateRow("p1040_claims_pass_or_documented_block", "P1040", claimRows.every((row) => row.verdict === "pass" ? isPassClaim(row) : isBlockedClaim(row)), "Every actual checkout preflight claim is PASS or documented BLOCK.", "repair preflight claim adjudication"),
    gateRow("package_script_registered", "P1040", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validation_chain_registered", "P1040", typeof scripts.validate === "string" && scripts.validate.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is registered in npm run validate.`, "add actual checkout preflight to validate chain"),
    gateRow("phase_ledger_acceptance_declared", "P1040", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P1001-P1040") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development phase ledger declares P1001-P1040 acceptance.", "record P1001-P1040 in development phase ledger"),
    gateRow("p1040_closeout_ready", "P1040", closeoutRows.every((row) => row.closeout_status === "pass"), "P1001-P1040 closes as a ready actual checkout preflight.", "repair closeout rows"),
  ];
}

function buildValidationItems({ gateRows, policy, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "actual_checkout_preflight_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_mutation", "safety_boundary", policy.actual_checkout_mutation_allowed_now === false, "preflight keeps actual checkout mutation disabled"));
  items.push(validationItem("policy.no_command_execution", "safety_boundary", policy.command_execution_allowed_now === false, "preflight keeps command execution disabled"));
  items.push(validationItem("policy.no_raw_or_secret_read", "safety_boundary", policy.secret_read_allowed_now === false && policy.raw_vdr_or_client_material_copy_allowed_now === false && policy.raw_log_read_allowed_now === false, "preflight does not read secrets, raw VDR/client material, or raw logs"));
  items.push(validationItem("locator.all_pass", "locator", locatorRows.every((row) => row.current_verdict === "pass"), "checkout locator rows pass"));
  items.push(validationItem("stack.required_pass", "stack_inventory", stackRows.filter((row) => row.required_marker).every((row) => row.current_verdict === "pass"), "required stack inventory rows pass"));
  items.push(validationItem("commands.blocked", "command_candidates", commandRows.length > 0 && commandRows.every(isDocumentedBlocked), "command candidates are documented BLOCK"));
  items.push(validationItem("protected.blocked", "protected_actions", protectedRows.length > 0 && protectedRows.every(isDocumentedBlocked), "protected actions are documented BLOCK"));
  items.push(validationItem("boundary.no_payload", "boundary", boundaryRows.every((row) => row.content_read_performed === false && row.raw_payload_stored === false), "boundary rows store no raw payload"));
  items.push(validationItem("claims.adjudicated", "claim_freeze", claimRows.every((row) => row.verdict === "pass" ? isPassClaim(row) : isBlockedClaim(row)), "claims are PASS or documented BLOCK"));
  items.push(validationItem("closeout.pass", "closeout", closeoutRows.every((row) => row.closeout_status === "pass"), "closeout rows pass"));
  return items;
}

async function probeActualCheckout(zenddRootInput) {
  const zenddRoot = path.resolve(zenddRootInput);
  const rootExists = await exists(zenddRoot, "dir");
  const gitProbe = await probeGit(zenddRoot);
  const markers = {
    root_package: await readPackageManifest(path.join(zenddRoot, "package.json")),
    root_package_lock: await marker(path.join(zenddRoot, "package-lock.json"), "file"),
    frontend_package: await readPackageManifest(path.join(zenddRoot, "frontend/package.json")),
    frontend_package_lock: await marker(path.join(zenddRoot, "frontend/package-lock.json"), "file"),
    frontend_vite: await marker(path.join(zenddRoot, "frontend/vite.config.ts"), "file"),
    frontend_src: await marker(path.join(zenddRoot, "frontend/src"), "dir"),
    backend_pyproject: await readPyprojectMetadata(path.join(zenddRoot, "backend/pyproject.toml")),
    backend_tests: await marker(path.join(zenddRoot, "backend/tests"), "dir"),
    backend_alembic_ini: await marker(path.join(zenddRoot, "backend/alembic.ini"), "file"),
    backend_migrations: await marker(path.join(zenddRoot, "backend/migrations"), "dir"),
  };
  const riskMarkers = await buildRiskMarkers(zenddRoot);
  const dirtyRows = gitProbe.status_entries.map((entry, index) => {
    const classification = classifyPath(entry.path);
    return {
      schema_version: "zendd-actual-dirty-path-row.v1",
      phase_slot: "P1006",
      row_id: `zendd-actual-dirty-path.row.${String(index + 1).padStart(3, "0")}`,
      status_code: entry.status_code,
      path_hash: hashValue(entry.path),
      raw_path_stored: false,
      path_classification: classification.path_classification,
      risk_level: classification.risk_level,
      handling_policy: classification.handling_policy,
      human_review_required: classification.human_review_required,
      mutation_allowed_now: false,
      next_allowed_action: classification.next_allowed_action,
    };
  });
  return {
    identity: {
      schema_version: "zendd-actual-checkout-identity.v1",
      phase_slot: "P1001",
      project_id: "project.zendd",
      zendd_project_root: zenddRoot,
      zendd_project_root_ref: `external.zendd.checkout.${hashValue(zenddRoot).slice(0, 12)}`,
      project_root_exists: rootExists,
      source_of_truth: "external_zendd_checkout",
      hermes_role: "read_only_operator_governance_and_preflight_surface",
      git_present: gitProbe.git_present,
      git_head_short: gitProbe.head_short,
      git_status_available: gitProbe.status_available,
      dirty_tree_count: dirtyRows.length,
      actual_checkout_mutation_allowed_now: false,
      command_execution_allowed_now: false,
      raw_material_copy_allowed_now: false,
      secret_read_allowed_now: false,
    },
    read_only_probe: {
      schema_version: "zendd-actual-read-only-probe.v1",
      phase_slot: "P1002",
      allowed_manifest_reads: ["package.json script keys", "frontend/package.json script keys", "backend/pyproject.toml selected metadata"],
      read_only_git_commands_executed: gitProbe.read_only_git_commands_executed,
      checkout_mutation_performed: false,
      protected_command_executed: false,
      package_install_performed: false,
      database_migration_performed: false,
      server_started: false,
      raw_vdr_or_client_material_read: false,
      raw_log_read_performed: false,
      secret_file_opened: false,
      dirty_path_values_stored: false,
      dirty_path_hashes_stored: dirtyRows.length > 0,
      git_errors: gitProbe.errors,
    },
    markers,
    risk_markers: riskMarkers,
    dirty_path_rows: dirtyRows,
  };
}

async function buildRiskMarkers(zenddRoot) {
  const markerSpecs = [
    ["root_env", ".env", "secret_or_env_surface", "env_or_secret_file_reference_only", "receipt.zendd.actual.secret_boundary", "rollback-target.zendd.actual.no_secret_read"],
    ["backend_env", "backend/.env", "secret_or_env_surface", "env_or_secret_file_reference_only", "receipt.zendd.actual.secret_boundary", "rollback-target.zendd.actual.no_secret_read"],
    ["frontend_env", "frontend/.env", "secret_or_env_surface", "env_or_secret_file_reference_only", "receipt.zendd.actual.secret_boundary", "rollback-target.zendd.actual.no_secret_read"],
    ["tmp_run_logs", "tmp-run", "run_log_surface", "raw_log_reference_only", "receipt.zendd.actual.raw_log_boundary", "rollback-target.zendd.actual.no_raw_log_storage"],
    ["dot_run_logs", ".run-logs", "run_log_surface", "raw_log_reference_only", "receipt.zendd.actual.raw_log_boundary", "rollback-target.zendd.actual.no_raw_log_storage"],
    ["root_vdr_dir", "vdr", "raw_vdr_or_client_material_surface", "raw_material_reference_only", "receipt.zendd.actual.raw_material_boundary", "rollback-target.zendd.actual.no_raw_material_copy"],
    ["root_uploads_dir", "uploads", "raw_vdr_or_client_material_surface", "raw_material_reference_only", "receipt.zendd.actual.raw_material_boundary", "rollback-target.zendd.actual.no_raw_material_copy"],
    ["backend_uploads_dir", "backend/uploads", "raw_vdr_or_client_material_surface", "raw_material_reference_only", "receipt.zendd.actual.raw_material_boundary", "rollback-target.zendd.actual.no_raw_material_copy"],
    ["client_outputs_dir", "client_outputs", "client_output_surface", "client_output_reference_only", "receipt.zendd.actual.client_output_boundary", "rollback-target.zendd.actual.no_client_output_delivery"],
  ];
  const rows = [];
  for (const [riskMarkerId, relativePath, riskMarkerType, blockReason, receiptRef, rollbackTargetRef] of markerSpecs) {
    const observed = await exists(path.join(zenddRoot, relativePath));
    rows.push({
      schema_version: "zendd-actual-risk-marker-row.v1",
      phase_slot: riskMarkerType === "secret_or_env_surface" ? "P1021" : "P1022",
      risk_marker_id: riskMarkerId,
      risk_marker_type: riskMarkerType,
      path_ref: `external.zendd.path.${hashValue(relativePath).slice(0, 12)}`,
      observed,
      content_read_allowed_now: false,
      content_read_performed: false,
      raw_payload_stored: false,
      current_verdict: "blocked",
      block_reason: blockReason,
      responsible_owner: "zendd_integration_operator",
      evidence_ref: `evidence.zendd.actual.risk_marker.${riskMarkerId}`,
      human_receipt_required: observed,
      human_receipt_ref: observed ? receiptRef : null,
      rollback_target_ref: rollbackTargetRef,
      next_allowed_action: observed
        ? "keep this surface reference-only and request redacted evidence through a future receipt-gated work order"
        : "keep monitoring this reference-only surface without opening content",
    });
  }
  return rows;
}

function locatorRow(locatorId, phaseSlot, passed, locatorType, message, nextAllowedAction) {
  return {
    schema_version: "zendd-actual-locator-row.v1",
    phase_slot: phaseSlot,
    locator_id: locatorId,
    locator_type: locatorType,
    current_verdict: passed ? "pass" : "blocked",
    block_reason: passed ? null : "actual_checkout_locator_missing_or_unsafe",
    responsible_owner: "zendd_integration_operator",
    evidence_ref: `evidence.zendd.actual.locator.${locatorId}`,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.locator.${locatorId}`,
    rollback_target_ref: "rollback-target.zendd.actual.external_checkout_unmodified",
    next_allowed_action: passed ? "continue actual checkout preflight" : nextAllowedAction,
    message,
  };
}

function stackRow(stackMarkerId, phaseSlot, markerType, observed, contentReadAllowed, contentReadPerformed, message, nextAllowedAction) {
  const requiredMarker = !["root_package_lock", "frontend_package_lock"].includes(stackMarkerId);
  return {
    schema_version: "zendd-actual-stack-inventory-row.v1",
    phase_slot: phaseSlot,
    stack_marker_id: stackMarkerId,
    marker_type: markerType,
    required_marker: requiredMarker,
    observed,
    current_verdict: observed || !requiredMarker ? "pass" : "blocked",
    block_reason: observed || !requiredMarker ? null : "required_actual_checkout_stack_marker_missing",
    responsible_owner: "zendd_integration_operator",
    evidence_ref: `evidence.zendd.actual.stack.${stackMarkerId}`,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.stack.${stackMarkerId}`,
    rollback_target_ref: "rollback-target.zendd.actual.external_checkout_unmodified",
    content_read_allowed: contentReadAllowed,
    content_read_performed: contentReadPerformed,
    raw_payload_stored: false,
    next_allowed_action: observed || !requiredMarker ? "continue stack preflight" : nextAllowedAction,
    message,
  };
}

function commandRow(commandCandidateId, phaseSlot, sourceType, scriptKey, commandClass, protectedByDefault) {
  return {
    schema_version: "zendd-actual-command-candidate-row.v1",
    phase_slot: phaseSlot,
    command_candidate_id: commandCandidateId,
    command_source_type: sourceType,
    command_key: scriptKey,
    command_class: commandClass,
    protected_command: protectedByDefault,
    current_verdict: "blocked",
    block_reason: "command_execution_not_allowed_in_actual_checkout_preflight",
    responsible_owner: "zendd_integration_operator",
    evidence_ref: `evidence.zendd.actual.command_candidate.${commandCandidateId}`,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.command_candidate.${commandCandidateId}`,
    human_receipt_ref: protectedByDefault ? `receipt.zendd.actual.command_candidate.${commandCandidateId}` : null,
    rollback_target_ref: rollbackTargetForCommand(commandClass),
    command_execution_allowed_now: false,
    command_output_captured_now: false,
    next_allowed_action: protectedByDefault
      ? "create protected command work order, human receipt, and rollback target before execution"
      : "promote to a future evidence execution packet after scoped work order approval",
  };
}

function boundaryRow(boundaryType, phaseSlot, observed, blockReason, evidenceRef, rollbackTargetRef, nextAllowedAction) {
  return {
    schema_version: "zendd-actual-boundary-row.v1",
    phase_slot: phaseSlot,
    boundary_id: `boundary.zendd.actual.${boundaryType}`,
    boundary_type: boundaryType,
    marker_observed: observed,
    current_verdict: "blocked",
    block_reason: blockReason,
    responsible_owner: "zendd_integration_operator",
    evidence_ref: evidenceRef,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.${boundaryType}`,
    human_receipt_ref: `receipt.zendd.actual.${boundaryType}`,
    rollback_target_ref: rollbackTargetRef,
    content_read_allowed_now: false,
    content_read_performed: false,
    raw_payload_stored: false,
    next_allowed_action: nextAllowedAction,
  };
}

function preflightClaim({ sourceType, sourceRef, claimType, verdict, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef, rollbackTargetRef, blockReason, nextAllowedAction }) {
  return {
    schema_version: "zendd-actual-claim-row.v1",
    phase_slot: "P1038-P1040",
    source_type: sourceType,
    source_ref: sourceRef,
    claim_type: claimType,
    claim_status: "claimed",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    documented_human_gate_ref: humanReceiptRef ? `${hardGateRef}.human_gate` : null,
    rollback_target_ref: rollbackTargetRef,
    verdict,
    block_reason: verdict === "blocked" ? blockReason : null,
    responsible_owner: "zendd_integration_operator",
    next_allowed_action: verdict === "blocked" ? nextAllowedAction : "continue actual checkout preflight",
    unsafe_flag: false,
  };
}

function closeoutRow(closeoutId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-actual-closeout-row.v1",
    phase_slot: phaseSlot,
    closeout_id: closeoutId,
    closeout_status: passed ? "pass" : "blocked",
    block_reason: passed ? null : "actual_checkout_preflight_closeout_gate_failed",
    responsible_owner: "zendd_integration_operator",
    evidence_ref: `evidence.zendd.actual.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.zendd.actual_checkout_preflight",
    hard_gate_ref: `hard-gate.zendd.actual.closeout.${closeoutId}`,
    rollback_target_ref: "rollback-target.zendd.actual.external_checkout_unmodified",
    next_allowed_action: passed ? "continue actual checkout preflight closeout" : nextAllowedAction,
    message,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-actual-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_actual_checkout_preflight_gate" : nextAllowedAction,
  };
}

function isDocumentedBlocked(row) {
  return row.current_verdict === "blocked" && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function isPassClaim(row) {
  return row.verdict === "pass" && Boolean(row.evidence_ref) && Boolean(row.reviewer_ref) && Boolean(row.hard_gate_ref) && Boolean(row.rollback_target_ref) && row.unsafe_flag === false;
}

function isBlockedClaim(row) {
  return row.verdict === "blocked" && Boolean(row.evidence_ref) && Boolean(row.reviewer_ref) && Boolean(row.hard_gate_ref) && Boolean(row.rollback_target_ref) && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function protectedBlockReason(commandClass) {
  if (commandClass.includes("database")) return "database_command_requires_human_receipt_and_snapshot";
  if (commandClass.includes("release") || commandClass.includes("build")) return "build_or_release_command_requires_release_work_order";
  if (commandClass.includes("runtime")) return "server_or_desktop_runtime_start_requires_operator_receipt";
  if (commandClass.includes("environment")) return "environment_setup_requires_secret_and_dependency_boundary_receipt";
  return "protected_command_requires_human_receipt";
}

function rollbackTargetForCommand(commandClass) {
  if (commandClass.includes("database")) return "rollback-target.zendd.actual.database_snapshot_required";
  if (commandClass.includes("release") || commandClass.includes("build")) return "rollback-target.zendd.actual.previous_build_candidate";
  if (commandClass.includes("runtime")) return "rollback-target.zendd.actual.stop_runtime_and_restore_clean_checkout";
  if (commandClass.includes("environment")) return "rollback-target.zendd.actual.environment_setup_not_applied";
  return "rollback-target.zendd.actual.external_checkout_unmodified";
}

async function readPackageManifest(filePath) {
  const source = await readJsonSource(filePath);
  return {
    available: source.available,
    path_ref: `external.zendd.manifest.${hashValue(path.basename(filePath)).slice(0, 12)}`,
    content_hash: source.content_hash,
    content_read_performed: source.available,
    package_name: source.data?.name ?? null,
    script_keys: Object.keys(source.data?.scripts ?? {}).sort(),
    script_values_stored: false,
    error: source.error ?? null,
  };
}

async function readPyprojectMetadata(filePath) {
  const source = await readTextSource(filePath);
  return {
    available: source.available,
    path_ref: `external.zendd.manifest.${hashValue(path.basename(filePath)).slice(0, 12)}`,
    content_hash: source.content_hash,
    content_read_performed: source.available,
    project_name: source.available ? matchTomlField(source.text, "name") : null,
    requires_python: source.available ? matchTomlField(source.text, "requires-python") : null,
    raw_text_stored: false,
    error: source.error ?? null,
  };
}

async function marker(filePath, expectedType = null) {
  const available = await exists(filePath, expectedType);
  return {
    available,
    path_ref: `external.zendd.marker.${hashValue(path.relative(process.cwd(), filePath)).slice(0, 12)}`,
    content_read_performed: false,
  };
}

async function exists(filePath, expectedType = null) {
  try {
    const info = await stat(filePath);
    if (expectedType === "file") return info.isFile();
    if (expectedType === "dir") return info.isDirectory();
    return true;
  } catch {
    return false;
  }
}

async function probeGit(zenddRoot) {
  const probe = {
    git_present: false,
    head_short: null,
    status_available: false,
    status_entries: [],
    read_only_git_commands_executed: [],
    errors: [],
  };
  const inside = await runGit(zenddRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.stdout.trim() !== "true") {
    probe.errors.push(inside.error ?? "not a git worktree");
    return probe;
  }
  probe.git_present = true;
  probe.read_only_git_commands_executed.push("git rev-parse --is-inside-work-tree");
  const head = await runGit(zenddRoot, ["rev-parse", "--short", "HEAD"]);
  probe.read_only_git_commands_executed.push("git rev-parse --short HEAD");
  if (head.ok) probe.head_short = head.stdout.trim();
  else probe.errors.push(head.error ?? "git head unavailable");
  const status = await runGit(zenddRoot, ["status", "--short"]);
  probe.read_only_git_commands_executed.push("git status --short");
  if (status.ok) {
    probe.status_available = true;
    probe.status_entries = status.stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(parseGitStatusLine);
  } else {
    probe.errors.push(status.error ?? "git status unavailable");
  }
  return probe;
}

async function runGit(cwd, args) {
  try {
    await access(cwd);
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    });
    return { ok: true, stdout, stderr };
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? "", stderr: error.stderr ?? "", error: error.message };
  }
}

function parseGitStatusLine(line) {
  const statusCode = line.slice(0, 2).trim() || line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const pathValue = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) : rawPath;
  return { status_code: statusCode, path: pathValue };
}

function classifyPath(pathValue) {
  const lower = String(pathValue ?? "").toLowerCase();
  if (/(^|\/)(\.env|.*\.pem|.*\.key|.*secret.*|.*credential.*)/.test(lower)) {
    return {
      path_classification: "secret_or_environment_candidate",
      risk_level: "critical",
      handling_policy: "do_not_read_contents_require_user_triage",
      human_review_required: true,
      next_allowed_action: "classify secret/env candidate before any Zendd work loop",
    };
  }
  if (/(^|\/)(tmp-run|\.run-logs|node_modules|__pycache__|\.pytest_cache|dist|dist-electron|coverage|build|\.cache)(\/|$)/.test(lower) || /\.(log|tmp|cache)$/.test(lower)) {
    return {
      path_classification: "generated_or_runtime_artifact",
      risk_level: "low",
      handling_policy: "reference_only_do_not_store_raw_logs",
      human_review_required: false,
      next_allowed_action: "keep runtime artifacts out of Hermes and request redacted evidence if needed",
    };
  }
  if (/\.(csv|xlsx|xls|xlsm|docx|pptx|pdf|hwp|hwpx)$/i.test(pathValue)) {
    return {
      path_classification: "domain_data_or_document_artifact",
      risk_level: "high",
      handling_policy: "do_not_copy_raw_material_into_hermes",
      human_review_required: true,
      next_allowed_action: "bind by redacted evidence_ref only after review",
    };
  }
  if (/^(backend\/app|frontend\/src|electron|scripts|backend\/tests|frontend\/.*__tests__|docs)\//.test(pathValue)) {
    return {
      path_classification: "source_or_test_change",
      risk_level: "medium",
      handling_policy: "preserve_user_change_and_require_diff_review_before_mutation",
      human_review_required: true,
      next_allowed_action: "route through future Zendd development work order",
    };
  }
  return {
    path_classification: "unclassified_external_change",
    risk_level: "high",
    handling_policy: "documented_block_until_classified",
    human_review_required: true,
    next_allowed_action: "classify path before any integration mutation",
  };
}

function buildSummary({ checkoutProbe, locatorRows, stackRows, commandRows, protectedRows, boundaryRows, claimRows, closeoutRows, gateRows, validation }) {
  const passGateCount = gateRows.filter((row) => row.gate_status === "pass").length;
  const passClaimCount = claimRows.filter((row) => row.verdict === "pass").length;
  const blockedClaimCount = claimRows.filter((row) => row.verdict === "blocked").length;
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_actual_checkout_preflight_status: validation.valid && passGateCount === gateRows.length
      ? READY_STATUS
      : "documented_block_pending_actual_checkout_preflight",
    zendd_project_root: checkoutProbe.identity.zendd_project_root,
    zendd_project_root_exists: checkoutProbe.identity.project_root_exists,
    zendd_git_head_short: checkoutProbe.identity.git_head_short,
    locator_row_count: locatorRows.length,
    stack_marker_count: stackRows.length,
    required_stack_marker_count: stackRows.filter((row) => row.required_marker).length,
    command_candidate_count: commandRows.length,
    protected_action_candidate_count: protectedRows.length,
    boundary_row_count: boundaryRows.length,
    claim_count: claimRows.length,
    pass_claim_count: passClaimCount,
    blocked_claim_count: blockedClaimCount,
    closeout_row_count: closeoutRows.length,
    dirty_path_hash_count: checkoutProbe.dirty_path_rows.length,
    risk_marker_count: checkoutProbe.risk_markers.length,
    observed_risk_marker_count: checkoutProbe.risk_markers.filter((row) => row.observed).length,
    zendd_mutation_allowed_now: checkoutProbe.identity.actual_checkout_mutation_allowed_now,
    command_execution_allowed_now: checkoutProbe.identity.command_execution_allowed_now,
    raw_material_copy_allowed_now: checkoutProbe.identity.raw_material_copy_allowed_now,
    secret_read_allowed_now: checkoutProbe.identity.secret_read_allowed_now,
    gate_count: gateRows.length,
    pass_gate_count: passGateCount,
    validation_error_count: validation.errors.length,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.developmentPhaseLedgerPath,
    design_tokens_path: options.designTokensPath ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.designTokensPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_ACTUAL_CHECKOUT_PREFLIGHT_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--development-phase-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P1001-P1040 actual Zendd checkout preflight. --check validates
without writing artifacts or executing Zendd commands.
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

function matchTomlField(text, fieldName) {
  const match = new RegExp(`^${fieldName.replace("-", "\\-")}\\s*=\\s*["']([^"']+)["']`, "m").exec(text);
  return match?.[1] ?? null;
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

function sanitizeId(value) {
  return String(value ?? "none").replace(/[^a-z0-9_.-]+/gi, "_").slice(0, 80);
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Actual Checkout Preflight Summary",
    "",
    `- Status: ${summary.zendd_actual_checkout_preflight_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Stack markers: ${summary.stack_marker_count}`,
    `- Command candidates: ${summary.command_candidate_count}`,
    `- Protected candidates: ${summary.protected_action_candidate_count}`,
    `- Claims: ${summary.pass_claim_count} PASS / ${summary.blocked_claim_count} documented BLOCK`,
    `- Mutation allowed: ${summary.zendd_mutation_allowed_now}`,
    `- Command execution allowed: ${summary.command_execution_allowed_now}`,
    `- Raw material copy allowed: ${summary.raw_material_copy_allowed_now}`,
    `- Secret read allowed: ${summary.secret_read_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.actual_checkout_preflight_policy.next_allowed_action,
    "",
  ].join("\n");
}
