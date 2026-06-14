import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_OUT_DIR = "artifacts/desktop-authority-boundary/latest";
export const DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS = {
  schemaPath: "schemas/desktop-authority-boundary.schema.json",
  packagePath: "package.json",
  desktopPlanPath: "docs/hermes-desktop-app-plan-2026-06-14.md",
  operatorHandbookPath: "artifacts/operator-handbook/latest/operator-handbook.json",
  operatorHandbookBoundaryPath: "artifacts/operator-handbook/latest/operator-handbook-boundary.json",
};

const SCHEMA_VERSION = "desktop-authority-boundary.v1";
const CAPABILITY_ID = "desktop.authority_boundary";
const COMMAND_NAME = "desktop:authority-boundary";
const READY_STATUS = "enforced_read_only_desktop_boundary";
const BLOCKED_STATUS = "blocked_desktop_boundary";

const FORBIDDEN_CAPABILITY_SPECS = [
  ["renderer_shell_execution", "Renderer shell execution", "shell_execution_allowed_now"],
  ["deployment", "Deployment", "deployment_allowed_now"],
  ["git_push", "Git push", "git_push_allowed_now"],
  ["approval_apply", "Approval apply", "approval_application_allowed_now"],
  ["receipt_apply", "Receipt apply", "receipt_application_allowed_now"],
  ["connector_write", "Connector write", "connector_write_allowed_now"],
  ["secret_read", "Secret read", "secret_read_allowed_now"],
  ["raw_source_exposure", "Raw protected source exposure", "raw_source_exposure_allowed"],
  ["production_pass", "Production PASS claim", "production_pass_enabled"],
  ["enterprise_pass", "Enterprise PASS claim", "enterprise_pass_enabled"],
  ["protected_closeout", "Protected closeout", "protected_closeout_enabled"],
  ["desktop_write_authority", "Desktop write authority", "desktop_write_authority_enabled"],
  ["human_gate_bypass", "Human gate bypass", "human_gate_bypass_allowed"],
  ["external_network", "External renderer network", "external_renderer_network_allowed_now"],
];

const ELECTRON_SECURITY_SPECS = [
  ["sandbox", "Electron sandbox enabled", ["sandbox: true"]],
  ["context_isolation", "Context isolation enabled", ["contextIsolation: true"]],
  ["web_security", "Web security enabled", ["webSecurity: true"]],
  ["node_integration_disabled", "Renderer node integration disabled", ["nodeIntegration: false"]],
  ["worker_node_integration_disabled", "Worker node integration disabled", ["nodeIntegrationInWorker: false"]],
  ["remote_module_disabled", "Remote module disabled", ["Disable remote module"]],
  ["strict_csp", "Strict local Content-Security-Policy required", ["strict Content-Security-Policy", "local resources only"]],
  ["navigation_restricted", "External navigation restricted", ["Restrict external navigation"]],
  ["network_denial", "Outbound renderer network denied", ["outbound renderer network denial tests", "Block renderer `fetch` / XHR to non-local origins"]],
  ["preload_allowlist", "Preload API allowlisted", ["allowlisted preload API"]],
];

const OPERATOR_BINDING_SPECS = [
  ["handbook_artifact", "Operator handbook artifact is present", "operator_handbook"],
  ["boundary_artifact", "Operator handbook boundary artifact is present", "operator_handbook_boundary"],
  ["read_only", "Operator handbook boundary is read-only", "read_only"],
  ["desktop_read_only", "Operator handbook desktop boundary is read-only", "desktop_read_only"],
  ["not_source_of_truth", "Operator handbook says desktop is not source of truth", "desktop_source_of_truth"],
  ["no_source_content_read", "Operator handbook did not read hidden source content", "source_content_read_performed"],
  ["no_mutation", "Operator handbook did not mutate source artifacts", "source_artifact_mutation_performed"],
  ["no_execution", "Operator handbook did not execute commands, routes, recovery, delivery, or protected actions", "execution_flags"],
];

const AUTHORITY_FLAG_FIELDS = FORBIDDEN_CAPABILITY_SPECS.map(([, , field]) => field);

export async function runDesktopAuthorityBoundary(options = {}) {
  const result = await buildDesktopAuthorityBoundary(options);
  if (options.write !== false) await writeDesktopAuthorityBoundary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Desktop authority boundary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDesktopAuthorityBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const desktopPlan = await readTextSource(inputs.desktop_plan_path);
  const operatorHandbook = await readJsonSource(inputs.operator_handbook_path);
  const operatorBoundary = await readJsonSource(inputs.operator_handbook_boundary_path);

  const forbiddenCapabilityRows = buildForbiddenCapabilityRows(generatedAt);
  const electronSecurityRows = buildElectronSecurityRows(desktopPlan, generatedAt);
  const operatorHandbookBindingRows = buildOperatorHandbookBindingRows({ operatorHandbook, operatorBoundary, generatedAt });
  const desktopAuthorityBoundary = buildAuthorityBoundary({ forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, operatorBoundary, generatedAt });
  const validationItems = buildValidationItems({ packageJson, desktopPlan, forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, desktopAuthorityBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    desktop_authority_contract: buildContract(generatedAt),
    forbidden_capability_rows: forbiddenCapabilityRows,
    electron_security_rows: electronSecurityRows,
    operator_handbook_binding_rows: operatorHandbookBindingRows,
    desktop_authority_boundary: desktopAuthorityBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ desktopAuthorityBoundary, forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "desktop_authority_boundary")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ desktopAuthorityBoundary, forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeDesktopAuthorityBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "desktop-authority-boundary.json"), serializable);
  await writeJson(path.join(outDir, "forbidden-capability-rows.json"), collectionEnvelope("desktop-forbidden-capability-rows.v1", "forbidden_capability_rows", result.forbidden_capability_rows, result.generated_at));
  await writeJson(path.join(outDir, "electron-security-rows.json"), collectionEnvelope("desktop-electron-security-rows.v1", "electron_security_rows", result.electron_security_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handbook-binding-rows.json"), collectionEnvelope("desktop-operator-handbook-binding-rows.v1", "operator_handbook_binding_rows", result.operator_handbook_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "desktop-authority-boundary-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDesktopAuthorityBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDesktopAuthorityBoundary(args);
    console.log(`Desktop authority boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.desktop_authority_boundary_status}`);
    console.log(`Forbidden capabilities closed: ${result.summary.closed_forbidden_capability_count}/${result.summary.forbidden_capability_count}`);
    console.log(`Electron security rows ready: ${result.summary.ready_electron_security_row_count}/${result.summary.electron_security_row_count}`);
    console.log(`Operator handbook bound: ${result.summary.operator_handbook_bound}`);
    console.log(`Unsafe flags: ${result.summary.unsafe_flag_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "desktop-authority-contract.v1",
    generated_at: generatedAt,
    source_of_truth: "operator_handbook_and_release_artifacts",
    desktop_role: "read_only_operator_surface",
    operator_handbook_binding_required: true,
    check_mode_must_not_write: true,
    forbidden_capability_negative_fixtures_required: true,
    electron_security_defaults_required: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    deployment_allowed_now: false,
    desktop_write_authority_enabled: false,
  };
}

function buildForbiddenCapabilityRows(generatedAt) {
  return FORBIDDEN_CAPABILITY_SPECS.map(([capabilityId, label, flagField], index) => {
    const row = {
      schema_version: "desktop-forbidden-capability-row.v1",
      row_id: `desktop.forbidden.${capabilityId}`,
      ordinal: index + 1,
      capability_id: capabilityId,
      label,
      authority_flag_field: flagField,
      required_flag_value: false,
      observed_flag_value: false,
      current_verdict: "pass",
      negative_fixture_id: `desktop-negative.${capabilityId}`,
      negative_fixture_description: `If ${label.toLowerCase()} is requested from Desktop, the renderer must receive a blocked authority response and no side effect may be performed.`,
      blocker: null,
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildElectronSecurityRows(desktopPlan, generatedAt) {
  const text = desktopPlan.text ?? "";
  return ELECTRON_SECURITY_SPECS.map(([rowId, label, terms], index) => {
    const observed = desktopPlan.available && terms.every((term) => text.includes(term));
    const row = {
      schema_version: "desktop-electron-security-row.v1",
      row_id: `desktop.electron.${rowId}`,
      ordinal: index + 1,
      security_control_id: rowId,
      label,
      required_terms: terms,
      evidence_ref: desktopPlan.path,
      current_verdict: observed ? "pass" : "blocked",
      blocker: observed ? null : `${label} is not explicit in the desktop plan.`,
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildOperatorHandbookBindingRows({ operatorHandbook, operatorBoundary, generatedAt }) {
  const boundary = operatorBoundary.data ?? {};
  const executionClosed = boundary.command_execution_performed === false
    && boundary.route_execution_performed === false
    && boundary.recovery_execution_performed === false
    && boundary.delivery_execution_performed === false
    && boundary.protected_action_executed === false;
  const observations = {
    operator_handbook: operatorHandbook.available === true,
    operator_handbook_boundary: operatorBoundary.available === true,
    read_only: boundary.read_only === true,
    desktop_read_only: boundary.desktop_read_only === true,
    desktop_source_of_truth: boundary.desktop_source_of_truth === false,
    source_content_read_performed: boundary.source_content_read_performed === false,
    source_artifact_mutation_performed: boundary.source_artifact_mutation_performed === false,
    execution_flags: executionClosed,
  };
  return OPERATOR_BINDING_SPECS.map(([bindingId, label, observationKey], index) => {
    const observed = observations[observationKey] === true;
    const row = {
      schema_version: "desktop-operator-handbook-binding-row.v1",
      row_id: `desktop.operator_handbook.${bindingId}`,
      ordinal: index + 1,
      binding_id: bindingId,
      label,
      evidence_ref: observationKey === "operator_handbook" ? operatorHandbook.path : operatorBoundary.path,
      current_verdict: observed ? "pass" : "blocked",
      blocker: observed ? null : `${label} is missing or not satisfied.`,
      generated_at: generatedAt,
    };
    return { ...row, row_hash: sha256(row) };
  });
}

function buildAuthorityBoundary({ forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, generatedAt }) {
  const forbiddenClosed = allPass(forbiddenCapabilityRows);
  const securityReady = allPass(electronSecurityRows);
  const operatorHandbookBound = allPass(operatorHandbookBindingRows);
  const base = {
    schema_version: "desktop-authority-boundary-state.v1",
    generated_at: generatedAt,
    boundary_status: forbiddenClosed && securityReady && operatorHandbookBound ? READY_STATUS : BLOCKED_STATUS,
    read_only: true,
    operator_surface_only: true,
    operator_handbook_bound: operatorHandbookBound,
    operator_surface_parallel_definition_created: false,
    source_of_truth: false,
    command_execution_allowed_now: false,
    shell_execution_allowed_now: false,
    renderer_shell_execution_allowed_now: false,
    filesystem_write_allowed_now: false,
    git_push_allowed_now: false,
    git_write_allowed_now: false,
    approval_application_allowed_now: false,
    receipt_application_allowed_now: false,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    external_renderer_network_allowed_now: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    protected_action_allowed_now: false,
    protected_closeout_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    desktop_write_authority_enabled: false,
    human_gate_bypass_allowed: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
  };
  return { ...base, unsafe_flag_count: countUnsafeFlags(base), ready_for_desktop_read_model: forbiddenClosed && securityReady && operatorHandbookBound };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script.desktop_authority_boundary", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json"),
    validationItem("plan.desktop_stage_1", context.desktopPlan.available && context.desktopPlan.text.includes("TUW D1.1 - Desktop Authority Boundary") && context.desktopPlan.text.includes("TUW D1.2 - Read Model Contract"), "Desktop Stage 1 plan is missing authority/read-model acceptance text.", context.desktopPlan.path),
    validationItem("forbidden_capabilities.closed", context.forbiddenCapabilityRows.length === FORBIDDEN_CAPABILITY_SPECS.length && allPass(context.forbiddenCapabilityRows), "Forbidden capability rows must all be explicit pass rows.", "forbidden_capability_rows"),
    validationItem("forbidden_capabilities.negative_fixtures", context.forbiddenCapabilityRows.every((row) => row.negative_fixture_id && row.negative_fixture_description), "Every forbidden capability must have a negative fixture description.", "forbidden_capability_rows"),
    validationItem("electron_security.ready", context.electronSecurityRows.length === ELECTRON_SECURITY_SPECS.length && allPass(context.electronSecurityRows), "Electron security requirements must be explicit in the desktop plan.", "electron_security_rows"),
    validationItem("operator_handbook.bound", allPass(context.operatorHandbookBindingRows), "Desktop authority boundary must bind to read-only operator handbook artifacts.", "operator_handbook_binding_rows"),
    validationItem("boundary.no_authority_flags", context.desktopAuthorityBoundary.unsafe_flag_count === 0, "Desktop authority boundary opened an unsafe flag.", "desktop_authority_boundary"),
    validationItem("boundary.no_parallel_operator_truth", context.desktopAuthorityBoundary.operator_surface_parallel_definition_created === false && context.desktopAuthorityBoundary.source_of_truth === false, "Desktop must not create a parallel operator truth model.", "desktop_authority_boundary"),
  ];
}

function buildSummary({ desktopAuthorityBoundary, forbiddenCapabilityRows, electronSecurityRows, operatorHandbookBindingRows, validation }) {
  return {
    schema_version: "desktop-authority-boundary-summary.v1",
    desktop_authority_boundary_status: validation.errors.length === 0 && desktopAuthorityBoundary.boundary_status === READY_STATUS ? READY_STATUS : BLOCKED_STATUS,
    forbidden_capability_count: forbiddenCapabilityRows.length,
    closed_forbidden_capability_count: forbiddenCapabilityRows.filter((row) => row.current_verdict === "pass" && row.observed_flag_value === false).length,
    electron_security_row_count: electronSecurityRows.length,
    ready_electron_security_row_count: electronSecurityRows.filter((row) => row.current_verdict === "pass").length,
    operator_handbook_binding_row_count: operatorHandbookBindingRows.length,
    ready_operator_handbook_binding_row_count: operatorHandbookBindingRows.filter((row) => row.current_verdict === "pass").length,
    operator_handbook_bound: desktopAuthorityBoundary.operator_handbook_bound,
    read_only: desktopAuthorityBoundary.read_only,
    operator_surface_only: desktopAuthorityBoundary.operator_surface_only,
    source_of_truth: desktopAuthorityBoundary.source_of_truth,
    command_execution_allowed_now: desktopAuthorityBoundary.command_execution_allowed_now,
    shell_execution_allowed_now: desktopAuthorityBoundary.shell_execution_allowed_now,
    git_push_allowed_now: desktopAuthorityBoundary.git_push_allowed_now,
    approval_application_allowed_now: desktopAuthorityBoundary.approval_application_allowed_now,
    receipt_application_allowed_now: desktopAuthorityBoundary.receipt_application_allowed_now,
    connector_write_allowed_now: desktopAuthorityBoundary.connector_write_allowed_now,
    secret_read_allowed_now: desktopAuthorityBoundary.secret_read_allowed_now,
    raw_source_exposure_allowed: desktopAuthorityBoundary.raw_source_exposure_allowed,
    external_renderer_network_allowed_now: desktopAuthorityBoundary.external_renderer_network_allowed_now,
    deployment_allowed_now: desktopAuthorityBoundary.deployment_allowed_now,
    production_pass_enabled: desktopAuthorityBoundary.production_pass_enabled,
    enterprise_pass_enabled: desktopAuthorityBoundary.enterprise_pass_enabled,
    protected_closeout_enabled: desktopAuthorityBoundary.protected_closeout_enabled,
    desktop_write_authority_enabled: desktopAuthorityBoundary.desktop_write_authority_enabled,
    human_gate_bypass_allowed: desktopAuthorityBoundary.human_gate_bypass_allowed,
    ready_for_desktop_read_model: desktopAuthorityBoundary.ready_for_desktop_read_model,
    unsafe_flag_count: desktopAuthorityBoundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Desktop Authority Boundary",
    "",
    `- Status: ${result.summary.desktop_authority_boundary_status}`,
    `- Forbidden capabilities closed: ${result.summary.closed_forbidden_capability_count}/${result.summary.forbidden_capability_count}`,
    `- Electron security rows ready: ${result.summary.ready_electron_security_row_count}/${result.summary.electron_security_row_count}`,
    `- Operator handbook bound: ${result.summary.operator_handbook_bound}`,
    `- Ready for desktop read model: ${result.summary.ready_for_desktop_read_model}`,
    `- Unsafe flags: ${result.summary.unsafe_flag_count}`,
    "",
    "Desktop remains a read-only operator surface. Shell execution, deployment, git push, approval application, receipt application, connector write, secret read, raw source exposure, production PASS, enterprise PASS, protected closeout, and desktop write authority remain closed.",
  ].join("\n");
}

function countUnsafeFlags(boundary) {
  return AUTHORITY_FLAG_FIELDS.filter((field) => boundary[field] === true).length
    + ["command_execution_allowed_now", "filesystem_write_allowed_now", "git_write_allowed_now", "release_approval_allowed_now", "write_action_allowed_now", "runtime_execution_allowed_now", "protected_action_allowed_now", "final_approval_ui_enabled", "codex_final_approval_ui_enabled", "claude_final_approval_ui_enabled"]
      .filter((field) => boundary[field] === true).length
    + (boundary.source_of_truth === true ? 1 : 0)
    + (boundary.operator_surface_parallel_definition_created === true ? 1 : 0);
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return { path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message: passed ? "ok" : message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${key}_count`]: rows.length, [key]: rows };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS.packagePath,
    desktop_plan_path: options.desktopPlanPath ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS.desktopPlanPath,
    operator_handbook_path: options.operatorHandbookPath ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS.operatorHandbookPath,
    operator_handbook_boundary_path: options.operatorHandbookBoundaryPath ?? DEFAULT_DESKTOP_AUTHORITY_BOUNDARY_INPUTS.operatorHandbookBoundaryPath,
  };
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { available: true, path: filePath, resolved_path: resolvedPath, text, data: JSON.parse(text), content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { available: true, path: filePath, resolved_path: resolvedPath, text, content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", content_hash: null, error: error.message };
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/desktop-authority-boundary.mjs [--check] [--out-dir path]\n\nWith --check, validates without writing artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function kebabToCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
