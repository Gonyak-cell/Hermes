import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

const execFileAsync = promisify(execFile);

export const DEFAULT_ZENDD_INTEGRATION_SETUP_OUT_DIR = "artifacts/zendd-integration-setup/latest";
export const DEFAULT_ZENDD_PROJECT_ROOT = process.env.HERMES_ZENDD_PROJECT_ROOT
  ?? "/Users/jws/Library/CloudStorage/GoogleDrive-sweatqoo@gmail.com/내 드라이브/05_CODING/01_CODING/03_Zendd";
export const DEFAULT_ZENDD_INTEGRATION_SETUP_INPUTS = {
  schemaPath: "schemas/zendd-integration-setup.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-integration-setup";
const SCHEMA_VERSION = "zendd-integration-setup.v1";
const CAPABILITY_ID = "project.zendd.integration_setup";
const PHASE_RANGE = "P521-P525";
const PHASE_SLOT = "P521";
const PREVIOUS_PHASE_SLOT = "P520";
const NEXT_PHASE_SLOT = "P526";

export async function runZenddIntegrationSetup(options = {}) {
  const result = await buildZenddIntegrationSetup(options);
  if (options.write !== false) await writeZenddIntegrationSetup(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd integration setup failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddIntegrationSetup(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_INTEGRATION_SETUP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const zenddRoot = path.resolve(inputs.zendd_project_root);
  const projectFiles = await readZenddProjectFiles(zenddRoot);
  const gitProbe = await probeGit(zenddRoot);
  const adr = buildIntegrationAdr(generatedAt);
  const baseline = buildZenddBaseline({ generatedAt, zenddRoot, projectFiles, gitProbe });
  const dirtyTreeRows = buildDirtyTreeRows(gitProbe.status_entries);
  const featureParityRows = buildFeatureParityRows();
  const boundary = buildProjectBoundary({ generatedAt, zenddRoot, baseline, dirtyTreeRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, baseline, dirtyTreeRows, featureParityRows, boundary });
  const gateRows = buildGateRows({ packageJson, phaseLedger, adr, baseline, dirtyTreeRows, featureParityRows, boundary });
  const validationItems = buildValidationItems({ gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ baseline, dirtyTreeRows, featureParityRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_integration_setup_id: `zendd-integration-setup.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    zendd_integration_anchor: anchor,
    integration_adr: adr,
    zendd_baseline: baseline,
    dirty_tree_safety_inventory_rows: dirtyTreeRows,
    feature_parity_matrix_rows: featureParityRows,
    project_zendd_boundary_contract: boundary,
    zendd_integration_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_integration_setup")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ baseline, dirtyTreeRows, featureParityRows, gateRows, boundary, validation: result.validation });
  result.summary.zendd_integration_setup_id = result.zendd_integration_setup_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddIntegrationSetup(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-integration-setup.json"), serializableResult(result));
  await writeJson(path.join(outDir, "integration-adr.json"), result.integration_adr);
  await writeJson(path.join(outDir, "zendd-baseline.json"), result.zendd_baseline);
  await writeJson(path.join(outDir, "dirty-tree-safety-inventory-rows.json"), collectionEnvelope("zendd-dirty-tree-safety-inventory-rows.v1", "dirty_tree_safety_inventory_rows", result.dirty_tree_safety_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "feature-parity-matrix-rows.json"), collectionEnvelope("zendd-feature-parity-matrix-rows.v1", "feature_parity_matrix_rows", result.feature_parity_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-zendd-boundary-contract.json"), result.project_zendd_boundary_contract);
  await writeJson(path.join(outDir, "zendd-integration-gate-rows.json"), collectionEnvelope("zendd-integration-gate-rows.v1", "zendd_integration_gate_rows", result.zendd_integration_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-integration-setup-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddIntegrationSetupCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddIntegrationSetup(args);
    console.log(`Zendd integration setup ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_integration_setup_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Dirty rows: ${result.summary.dirty_tree_row_count}`);
    console.log(`Feature rows: ${result.summary.feature_parity_row_count}`);
    console.log(`Mutation allowed: ${result.summary.zendd_mutation_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntegrationAdr(generatedAt) {
  return {
    schema_version: "zendd-integration-adr.v1",
    adr_id: "ADR-P521-zendd-hermes-federated-integration",
    phase_slot: "P521",
    status: "proposed",
    decision: "Use federated external-project integration before any physical code move.",
    selected_option: "external_project_adapter",
    rejected_options: [
      {
        option_id: "direct_subdirectory_import",
        rejection_reason: "Would mix a dirty Zendd checkout and client/domain data into Hermes before boundaries are proven.",
      },
      {
        option_id: "submodule_or_subtree_now",
        rejection_reason: "Premature while feature parity, command evidence, and receipt boundaries are not proven.",
      },
      {
        option_id: "monorepo_merge_now",
        rejection_reason: "High blast radius across Python, React, Electron, VDR storage, and Hermes validation.",
      },
    ],
    controlling_principles: [
      "Zendd remains the execution engine for M&A, VDR, LDD, report, and desktop app workflows.",
      "Hermes remains the operating harness for project management, evidence, claim, receipt, and freeze verdicts.",
      "Raw VDR material is not copied into Hermes during setup.",
      "Zendd PASS is not Hermes PASS until evidence, review, gate, and receipt requirements are satisfied.",
    ],
    created_at: generatedAt,
  };
}

function buildZenddBaseline({ generatedAt, zenddRoot, projectFiles, gitProbe }) {
  const rootPackage = projectFiles.root_package?.data ?? null;
  const frontendPackage = projectFiles.frontend_package?.data ?? null;
  const backendPyproject = projectFiles.backend_pyproject?.text ?? "";
  return {
    schema_version: "zendd-baseline.v1",
    phase_slot: "P522",
    project_id: "project.zendd",
    project_name: "Zendd",
    project_root: zenddRoot,
    project_root_exists: projectFiles.project_root_exists,
    source_of_truth: "external_zendd_checkout",
    source_control: {
      git_present: gitProbe.git_present,
      git_head_short: gitProbe.head_short,
      git_status_available: gitProbe.status_available,
      dirty_tree_count: gitProbe.status_entries.length,
      read_only_git_commands_executed: gitProbe.read_only_git_commands_executed,
      git_errors: gitProbe.errors,
    },
    runtime_profile: {
      root_package_name: rootPackage?.name ?? null,
      root_package_scripts: Object.keys(rootPackage?.scripts ?? {}).sort(),
      frontend_package_name: frontendPackage?.name ?? null,
      frontend_package_scripts: Object.keys(frontendPackage?.scripts ?? {}).sort(),
      backend_project_name: matchTomlField(backendPyproject, "name"),
      backend_project_version: matchTomlField(backendPyproject, "version"),
      backend_requires_python: matchTomlField(backendPyproject, "requires-python"),
      backend_pyproject_present: projectFiles.backend_pyproject?.available ?? false,
      electron_entry_present: projectFiles.electron_entry?.available ?? false,
    },
    detected_capabilities: detectZenddCapabilities(projectFiles),
    baseline_status: projectFiles.project_root_exists ? "documented_external_project_baseline" : "documented_block_missing_external_project",
    mutation_allowed: false,
    command_execution_allowed_by_setup: false,
    raw_vdr_copy_allowed: false,
    generated_at: generatedAt,
  };
}

function buildDirtyTreeRows(statusEntries) {
  if (!statusEntries.length) {
    return [{
      schema_version: "zendd-dirty-tree-safety-row.v1",
      phase_slot: "P523",
      row_id: "zendd-dirty-tree.clean",
      status_code: "clean",
      path: null,
      path_classification: "clean_worktree",
      risk_level: "low",
      handling_policy: "retain_external_baseline",
      human_review_required: false,
      next_allowed_action: "continue_to_feature_parity_matrix",
      mutation_allowed: false,
    }];
  }
  return statusEntries.map((entry, index) => {
    const classification = classifyDirtyPath(entry.path);
    return {
      schema_version: "zendd-dirty-tree-safety-row.v1",
      phase_slot: "P523",
      row_id: `zendd-dirty-tree.row.${String(index + 1).padStart(4, "0")}`,
      status_code: entry.status_code,
      path: entry.path,
      path_classification: classification.path_classification,
      risk_level: classification.risk_level,
      handling_policy: classification.handling_policy,
      human_review_required: classification.human_review_required,
      next_allowed_action: classification.next_allowed_action,
      mutation_allowed: false,
    };
  });
}

function buildFeatureParityRows() {
  const rows = [
    ["project_dev_operations", "Hermes personal-dev issue, lane, diff, test, release, rollback harness", "Zendd app repository with root/frontend/backend/electron commands", "standardize_in_hermes", "Apply Hermes dev harness to Zendd without moving Zendd code."],
    ["vdr_inventory_and_routing", "Hermes VDR inventory/resource/evidence boundary", "Zendd VDR upload, routing, categorization, and text classification", "bridge_zendd_to_hermes", "Keep Zendd as VDR execution engine and map outputs to Hermes evidence refs."],
    ["ldd_fact_issue_engine", "Hermes evidence item, fact claim, issue graph contracts", "Zendd LDD legal facts, evidence spans, cross-document issues", "bridge_zendd_to_hermes", "Convert Zendd fact/issue rows into Hermes review-gated claims."],
    ["client_output_quality", "Hermes output delivery and approval gates", "Zendd Korean LDD client-output leakage and prose-quality gate", "improve_hermes_from_zendd", "Promote Zendd client-output checks into Hermes law-firm output gates."],
    ["human_review_receipts", "Hermes human receipt and PASS/BLOCK adjudication", "Zendd internal reviewer workflow and accepted/pending statuses", "improve_zendd_from_hermes", "Bind Zendd reviewer actions to Hermes human_receipt_ref before protected PASS."],
    ["security_and_secret_boundary", "Hermes protected file, secret, domain, and claim hard gates", "Zendd LDD source storage, parser sandbox, malware scan, masking controls", "mutual_hardening", "Use a combined hard gate matrix before document handling or release claims."],
    ["operator_surface", "Hermes read-only dashboard/API verdicts", "Zendd actual VDR/LDD user interface", "bridge_status_only", "Expose Zendd blockers and next actions in Hermes without making Hermes source of truth."],
    ["release_recovery_packaging", "Hermes release freeze, recovery, provenance, and claim freeze", "Zendd React/FastAPI/Electron build and installer scripts", "bridge_zendd_to_hermes", "Treat Zendd build/release as evidence-backed claims, not self-reported completion."],
    ["physical_code_integration", "Hermes pack/project registry", "Zendd standalone desktop app checkout", "defer_until_evidence", "Decide subtree/submodule/workspace only after P741-P760 evidence."],
  ];
  return rows.map(([featureId, hermesCapability, zenddCapability, integrationDecision, nextAllowedAction], index) => ({
    schema_version: "zendd-feature-parity-row.v1",
    phase_slot: "P524",
    row_id: `zendd-feature-parity.row.${String(index + 1).padStart(2, "0")}`,
    feature_id: featureId,
    hermes_capability: hermesCapability,
    zendd_capability: zenddCapability,
    overlap_type: integrationDecision.includes("bridge") ? "complementary_overlap" : integrationDecision,
    integration_decision: integrationDecision,
    standard_owner: integrationDecision === "improve_hermes_from_zendd" ? "zendd" : "hermes",
    bridge_needed: integrationDecision !== "defer_until_evidence",
    pass_policy: "requires_evidence_review_gate_and_receipt_when_protected",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildProjectBoundary({ generatedAt, zenddRoot, baseline, dirtyTreeRows }) {
  const dirtyRows = dirtyTreeRows.filter((row) => row.status_code !== "clean");
  const highRiskRows = dirtyRows.filter((row) => row.risk_level === "high" || row.risk_level === "critical");
  return {
    schema_version: "project-zendd-boundary-contract.v1",
    phase_slot: "P525",
    project_id: "project.zendd",
    external_project_root: zenddRoot,
    source_of_truth: "zendd_checkout_remains_external",
    hermes_role: "read_only_operator_and_governance_harness",
    zendd_role: "execution_engine_for_mna_vdr_ldd_and_desktop_workflows",
    allowed_read_only_observations: [
      "package scripts",
      "pyproject metadata",
      "git head",
      "git status porcelain",
      "feature marker files",
    ],
    prohibited_actions: [
      "copy raw VDR material into Hermes",
      "read .env or secret values",
      "run Zendd mutating commands",
      "modify Zendd files from setup phases",
      "promote Zendd PASS to Hermes PASS without evidence and receipt",
      "move Zendd code directory before P741-P760 physical integration decision",
    ],
    dirty_tree_policy: dirtyRows.length
      ? "zendd_mutation_blocked_until_dirty_tree_review_receipt"
      : "zendd_mutation_still_blocked_until_explicit_work_order",
    raw_vdr_material_policy: "references_only_no_raw_copy",
    secret_policy: "secret_values_not_read_env_files_not_opened",
    protected_output_policy: "pending_human_receipt_before_client_or_release_facing_pass",
    hermes_source_of_truth: false,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    raw_vdr_copy_allowed: false,
    dirty_tree_row_count: dirtyRows.length,
    high_risk_dirty_tree_row_count: highRiskRows.length,
    boundary_status: baseline.project_root_exists ? "ready_for_read_only_project_zendd_registration" : "documented_block_missing_zendd_project_root",
    next_allowed_action: baseline.project_root_exists
      ? "implement project:zendd-boundary -- --check with read-only external project registration"
      : "confirm Zendd project root before boundary registration",
    created_at: generatedAt,
  };
}

function buildAnchor({ packageJson, phaseLedger, baseline, dirtyTreeRows, featureParityRows, boundary }) {
  return {
    schema_version: "zendd-integration-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    zendd_project_root: baseline.project_root,
    zendd_git_head_short: baseline.source_control.git_head_short,
    dirty_tree_rows_hash: hashRows(dirtyTreeRows, ["status_code", "path", "path_classification", "handling_policy"]),
    feature_parity_rows_hash: hashRows(featureParityRows, ["feature_id", "integration_decision", "next_allowed_action"]),
    boundary_hash: hashValue(boundary),
  };
}

function buildGateRows({ packageJson, phaseLedger, adr, baseline, dirtyTreeRows, featureParityRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p521_integration_adr_declared", "P521", adr.status === "proposed" && adr.selected_option === "external_project_adapter", "Integration ADR selects external adapter before physical code movement.", "write integration ADR before setup"),
    gateRow("p522_zendd_baseline_documented", "P522", baseline.project_root_exists && baseline.source_control.git_present, "Zendd external checkout exists and git baseline was observed.", "confirm Zendd project root and git checkout"),
    gateRow("p523_dirty_tree_inventory_documented", "P523", dirtyTreeRows.length > 0 && dirtyTreeRows.every((row) => row.mutation_allowed === false && row.next_allowed_action), "Dirty tree is classified with mutation blocked and next action recorded.", "classify every dirty tree row before mutation"),
    gateRow("p524_feature_parity_matrix_complete", "P524", featureParityRows.length >= 8 && featureParityRows.every((row) => row.integration_decision && row.next_allowed_action), "Feature parity matrix covers bridge, standardize, improve, and defer decisions.", "complete feature parity matrix"),
    gateRow("p525_project_boundary_contract_ready", "P525", boundary.read_only && !boundary.mutation_allowed && !boundary.raw_vdr_copy_allowed && boundary.boundary_status !== "documented_block_missing_zendd_project_root", "project.zendd boundary is read-only and blocks raw data copy.", "establish read-only project boundary"),
    gateRow("package_script_registered", "P525", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P525", phaseLedger.available && phaseLedger.text.includes("P521-P525") && phaseLedger.text.includes(COMMAND_NAME), "P521-P525 phase ledger declares setup acceptance.", "record P521-P525 in phase ledger"),
    gateRow("no_protected_action_enabled", "P525", boundary.prohibited_actions.length >= 6 && boundary.command_execution_allowed === false, "Setup keeps protected/mutating actions disabled.", "disable protected actions in setup"),
  ];
}

function buildValidationItems({ gateRows, boundary }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "integration_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("boundary.read_only", "safety_boundary", boundary.read_only === true, "project.zendd boundary remains read-only"));
  items.push(validationItem("boundary.mutation_allowed", "safety_boundary", boundary.mutation_allowed === false, "setup does not permit Zendd mutation"));
  items.push(validationItem("boundary.raw_vdr_copy_allowed", "safety_boundary", boundary.raw_vdr_copy_allowed === false, "setup does not permit raw VDR copies into Hermes"));
  return items;
}

function buildSummary({ baseline, dirtyTreeRows, featureParityRows, gateRows, boundary, validation }) {
  const passGateCount = gateRows.filter((row) => row.gate_status === "pass").length;
  const dirtyRows = dirtyTreeRows.filter((row) => row.status_code !== "clean");
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_integration_setup_status: validation.valid && passGateCount === gateRows.length
      ? "ready_for_project_zendd_boundary"
      : "documented_block_pending_setup_gate",
    zendd_project_root: baseline.project_root,
    zendd_project_root_exists: baseline.project_root_exists,
    zendd_git_head_short: baseline.source_control.git_head_short,
    dirty_tree_row_count: dirtyRows.length,
    high_risk_dirty_tree_row_count: boundary.high_risk_dirty_tree_row_count,
    feature_parity_row_count: featureParityRows.length,
    bridge_needed_feature_count: featureParityRows.filter((row) => row.bridge_needed).length,
    zendd_mutation_allowed: boundary.mutation_allowed,
    raw_vdr_copy_allowed: boundary.raw_vdr_copy_allowed,
    command_execution_allowed: boundary.command_execution_allowed,
    gate_count: gateRows.length,
    pass_gate_count: passGateCount,
    validation_error_count: validation.errors.length,
  };
}

async function readZenddProjectFiles(zenddRoot) {
  const projectRootSource = await readTextSource(path.join(zenddRoot, "package.json"));
  return {
    project_root_exists: projectRootSource.available,
    root_package: projectRootSource.available ? { ...projectRootSource, data: safeParseJson(projectRootSource.text) } : projectRootSource,
    frontend_package: await readJsonSource(path.join(zenddRoot, "frontend/package.json")),
    backend_pyproject: await readTextSource(path.join(zenddRoot, "backend/pyproject.toml")),
    electron_entry: await readTextSource(path.join(zenddRoot, "electron/main.cjs")),
    vdr_router: await readTextSource(path.join(zenddRoot, "backend/app/routers/vdr.py")),
    ldd_fact_engine_router: await readTextSource(path.join(zenddRoot, "backend/app/routers/ldd_fact_engine.py")),
    vdr_classification_service: await readTextSource(path.join(zenddRoot, "backend/app/services/vdr_classification_service.py")),
    ldd_source_controls: await readTextSource(path.join(zenddRoot, "backend/app/services/ldd_source_controls.py")),
    client_output_gate: await readTextSource(path.join(zenddRoot, "backend/app/services/ldd_fact_engine/client_output_gate.py")),
  };
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

function classifyDirtyPath(pathValue) {
  const lower = String(pathValue ?? "").toLowerCase();
  if (/(^|\/)(\.env|.*\.pem|.*\.key|.*secret.*|.*credential.*)/.test(lower)) {
    return {
      path_classification: "secret_or_environment_candidate",
      risk_level: "critical",
      handling_policy: "do_not_read_contents_require_user_triage",
      human_review_required: true,
      next_allowed_action: "classify secret/env candidate and remove from integration inputs",
    };
  }
  if (/(^|\/)(node_modules|__pycache__|\.pytest_cache|dist|dist-electron|coverage|build|\.cache)(\/|$)/.test(lower) || /\.(log|tmp|cache)$/.test(lower)) {
    return {
      path_classification: "generated_or_dependency_artifact",
      risk_level: "low",
      handling_policy: "exclude_from_integration_copy_and_keep_external",
      human_review_required: false,
      next_allowed_action: "confirm ignore policy before running Zendd commands",
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
      next_allowed_action: "run Hermes diff review adapter in a later Zendd dev harness phase",
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

function detectZenddCapabilities(projectFiles) {
  return [
    capability("zendd.vdr.routing", projectFiles.vdr_router.available || projectFiles.vdr_classification_service.available, "VDR router/classification markers detected"),
    capability("zendd.ldd.fact_engine", projectFiles.ldd_fact_engine_router.available, "LDD Fact Engine router marker detected"),
    capability("zendd.ldd.source_controls", projectFiles.ldd_source_controls.available, "LDD source controls marker detected"),
    capability("zendd.ldd.client_output_gate", projectFiles.client_output_gate.available, "Client output gate marker detected"),
    capability("zendd.desktop.electron", projectFiles.electron_entry.available, "Electron entry marker detected"),
  ];
}

function capability(capabilityId, detected, evidence) {
  return {
    capability_id: capabilityId,
    detected,
    evidence: detected ? evidence : "marker missing",
    import_policy: "bridge_by_contract_not_raw_copy",
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-integration-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_setup_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_INTEGRATION_SETUP_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_INTEGRATION_SETUP_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_INTEGRATION_SETUP_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_INTEGRATION_SETUP_INPUTS.zenddProjectRoot,
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

Creates the P521-P525 Zendd-Hermes read-only integration setup.
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

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Integration Setup Summary",
    "",
    `- Status: ${summary.zendd_integration_setup_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Dirty tree rows: ${summary.dirty_tree_row_count}`,
    `- High-risk dirty rows: ${summary.high_risk_dirty_tree_row_count}`,
    `- Feature parity rows: ${summary.feature_parity_row_count}`,
    `- Mutation allowed: ${summary.zendd_mutation_allowed}`,
    `- Raw VDR copy allowed: ${summary.raw_vdr_copy_allowed}`,
    `- Command execution allowed: ${summary.command_execution_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.project_zendd_boundary_contract.next_allowed_action,
    "",
  ].join("\n");
}
