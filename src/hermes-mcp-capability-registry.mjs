import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_HERMES_MCP_CAPABILITY_REGISTRY_OUT_DIR = "artifacts/hermes-mcp-capability-registry/latest";
export const DEFAULT_HERMES_MCP_CAPABILITY_REGISTRY_INPUTS = {
  schemaPath: "schemas/hermes-mcp-capability-registry.schema.json",
  packagePath: "package.json",
  boundaryPlanPath: "docs/hermes-mcp-native-control-plane-plan.md",
  factoryDecisionPath: "docs/factory-promotion/09-decision-records/S0-5-identity-and-id-scheme-decision-draft.md",
};

const SCHEMA_VERSION = "hermes-mcp-capability-registry.v1";
const CAPABILITY_ID = "platform.hermes_mcp.capability_registry";
const COMMAND_NAME = "platform:hermes-mcp-capability-registry";
const READY_STATUS = "ready_for_hermes_mcp_capability_registry";
const BLOCKED_STATUS = "blocked_hermes_mcp_capability_registry";

const RESOURCE_DEFINITIONS = [
  ["status", "hermes://status", "platform_status", "README.md", "Hermes project/workflow control-plane status."],
  ["projects", "hermes://projects", "project_read_model", "examples/dev-projects.json", "Project portfolio and personal-dev operating context."],
  ["reviews", "hermes://reviews", "review_read_model", "artifacts/human-review-cycle-ledger/latest", "Review cycles, packets, findings, and receipt status."],
  ["gates", "hermes://gates", "gate_read_model", "schemas/control-plane-human-gates.schema.json", "Human, review, protected action, and closeout gate contracts."],
  ["receipts", "hermes://receipts", "receipt_read_model", "schemas/control-plane-human-gate-receipts.schema.json", "Human and command receipt contracts."],
  ["artifacts", "hermes://artifacts/latest", "artifact_read_model", "artifacts/", "Generated deterministic Hermes artifacts."],
  ["factory_products", "hermes://factory/products", "factory_read_model", "artifacts/factory-product-registry-store/latest", "Factory product registry and lifecycle state projections."],
  ["desktop_read_model", "hermes://desktop/read-model", "desktop_read_model", "artifacts/desktop-read-model/latest", "Desktop operator-console read model."],
];

const TOOL_DEFINITIONS = [
  ["hermes.validate.core", "validate:core", "validation", "node scripts/validate-core-contracts.mjs", "Core contract validation surface."],
  ["hermes.operator.handbook", "operator:handbook", "operator_read_model", "node scripts/operator-handbook.mjs --check", "Read-only operator handbook validation."],
  ["hermes.desktop.read_model", "desktop:read-model", "desktop_read_model", "node scripts/desktop-read-model.mjs --check", "Desktop read-model validation."],
  ["hermes.desktop.authority_boundary", "desktop:authority-boundary", "authority_boundary", "node scripts/desktop-authority-boundary.mjs --check", "Desktop authority boundary validation."],
  ["hermes.review.packets", "control-plane:review-packets", "review_packet", "node scripts/human-review-packet-ledger.mjs --check", "Human review packet ledger validation."],
  ["hermes.factory.saas_mode", "platform:saas-factory-mode", "factory_read_model", "node scripts/saas-factory-mode.mjs --check", "SaaS Factory mode projection."],
  ["hermes.factory.product_registry", "platform:factory-product-registry-store", "factory_read_model", "node scripts/factory-product-registry-store.mjs --check", "Factory product registry store validation."],
  ["hermes.factory.receipt_preflight", "factory:receipt-preflight", "receipt_preflight", "node scripts/factory-receipt-preflight.mjs --check", "Factory receipt preflight validation."],
];

const BLOCKED_AUTHORITY_DEFINITIONS = [
  ["repo_write", "repository write through MCP"],
  ["file_write", "filesystem write through MCP"],
  ["connector_write", "external connector write through MCP"],
  ["deploy", "deployment or release execution through MCP"],
  ["protected_action", "protected action execution through MCP"],
  ["receipt_apply", "receipt application through MCP"],
  ["final_approval", "final approval through MCP"],
  ["production_pass", "production PASS claim through MCP"],
  ["enterprise_trust", "enterprise trust claim through MCP"],
  ["secret_read", "raw secret access through MCP"],
  ["raw_restricted_payload", "raw restricted payload exposure through MCP"],
  ["mcp_server_live_start", "live MCP server start in registry tranche"],
];

export async function runHermesMcpCapabilityRegistry(options = {}) {
  const result = await buildHermesMcpCapabilityRegistry(options);
  if (options.write !== false) await writeHermesMcpCapabilityRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes MCP capability registry failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHermesMcpCapabilityRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_MCP_CAPABILITY_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const boundaryPlan = await readTextSource(inputs.boundary_plan_path);
  const factoryDecision = await readTextSource(inputs.factory_decision_path);

  const mcpPolicy = buildMcpPolicy(generatedAt);
  const mcpResourceRows = buildResourceRows(generatedAt);
  const mcpToolRows = buildToolRows(generatedAt, packageJson.data?.scripts ?? {});
  const blockedAuthorityRows = buildBlockedAuthorityRows(generatedAt);
  const desktopConsoleBoundary = buildDesktopConsoleBoundary(generatedAt);
  const sourceBindingRows = buildSourceBindingRows({ boundaryPlan, factoryDecision, packageJson, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    boundaryPlan,
    factoryDecision,
    mcpPolicy,
    mcpResourceRows,
    mcpToolRows,
    blockedAuthorityRows,
    desktopConsoleBoundary,
    sourceBindingRows,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    hermes_mcp_capability_registry_id: `hermes-mcp-capability-registry.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    output_dir: outputDir,
    inputs,
    mcp_policy: mcpPolicy,
    mcp_resource_rows: mcpResourceRows,
    mcp_tool_rows: mcpToolRows,
    blocked_authority_rows: blockedAuthorityRows,
    desktop_console_boundary: desktopConsoleBoundary,
    source_binding_rows: sourceBindingRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ mcpPolicy, mcpResourceRows, mcpToolRows, blockedAuthorityRows, sourceBindingRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_mcp_capability_registry")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ mcpPolicy, mcpResourceRows, mcpToolRows, blockedAuthorityRows, sourceBindingRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesMcpCapabilityRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-mcp-capability-registry.json"), serializableResult(result));
  await writeJson(path.join(outDir, "mcp-policy.json"), result.mcp_policy);
  await writeJson(path.join(outDir, "mcp-resource-rows.json"), collectionEnvelope("hermes-mcp-resource-rows.v1", "mcp_resource_rows", result.mcp_resource_rows, result.generated_at));
  await writeJson(path.join(outDir, "mcp-tool-rows.json"), collectionEnvelope("hermes-mcp-tool-rows.v1", "mcp_tool_rows", result.mcp_tool_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-authority-rows.json"), collectionEnvelope("hermes-mcp-blocked-authority-rows.v1", "blocked_authority_rows", result.blocked_authority_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-binding-rows.json"), collectionEnvelope("hermes-mcp-source-binding-rows.v1", "source_binding_rows", result.source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "hermes-mcp-capability-registry-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesMcpCapabilityRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runHermesMcpCapabilityRegistry(args);
    console.log(`Hermes MCP capability registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.hermes_mcp_capability_registry_status}`);
    console.log(`Resources: ${result.summary.mcp_resource_count}`);
    console.log(`Check-only tools: ${result.summary.mcp_tool_count}`);
    console.log(`Blocked authority classes: ${result.summary.blocked_authority_count}`);
    console.log(`MCP server started now: ${result.summary.mcp_server_started_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMcpPolicy(generatedAt) {
  return {
    schema_version: "hermes-mcp-policy.v1",
    policy_id: "hermes.mcp.policy.h-mcp-01",
    generated_at: generatedAt,
    source_of_truth: "repo_artifacts_schemas",
    desktop_role: "non_authoritative_operator_console",
    mcp_tranche: "H-MCP-01",
    mcp_mode: "capability_registry_only",
    mcp_resources_allowed_now: true,
    check_only_tools_allowed_now: true,
    mcp_server_started_now: false,
    live_mcp_connection_opened_now: false,
    repo_write_allowed_now: false,
    filesystem_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    receipt_application_allowed_now: false,
    final_approval_allowed_now: false,
    production_pass_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_restricted_payload_allowed: false,
    next_allowed_action: "implement a read-only stdio MCP server skeleton after this registry is validated",
  };
}

function buildResourceRows(generatedAt) {
  return RESOURCE_DEFINITIONS.map(([resourceId, uri, kind, sourceRef, description], index) => ({
    schema_version: "hermes-mcp-resource-row.v1",
    row_id: `hermes-mcp.resource.${String(index + 1).padStart(3, "0")}`,
    resource_id: `hermes.mcp.resource.${resourceId}`,
    uri,
    kind,
    description,
    source_ref: sourceRef,
    exposure_mode: "read_only_planned",
    source_of_truth: false,
    mutation_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_restricted_payload_allowed: false,
    protected_action_allowed_now: false,
    desktop_consumable: true,
    generated_at: generatedAt,
  }));
}

function buildToolRows(generatedAt, scripts) {
  return TOOL_DEFINITIONS.map(([toolName, packageScript, toolKind, checkInvocation, description], index) => ({
    schema_version: "hermes-mcp-tool-row.v1",
    row_id: `hermes-mcp.tool.${String(index + 1).padStart(3, "0")}`,
    tool_name: toolName,
    package_script: packageScript,
    package_script_registered: typeof scripts[packageScript] === "string",
    tool_kind: toolKind,
    check_invocation: checkInvocation,
    invocation_mode: "read_only_or_check_only",
    description,
    mutation_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    final_approval_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildBlockedAuthorityRows(generatedAt) {
  return BLOCKED_AUTHORITY_DEFINITIONS.map(([authorityId, reason], index) => ({
    schema_version: "hermes-mcp-blocked-authority-row.v1",
    row_id: `hermes-mcp.blocked-authority.${String(index + 1).padStart(3, "0")}`,
    authority_id: authorityId,
    current_verdict: "blocked",
    blocked_reason: reason,
    allowed_now: false,
    negative_fixture_required: true,
    human_gate_required_to_open: true,
    independent_review_required_to_open: true,
    generated_at: generatedAt,
    next_allowed_action: "keep blocked until a later MCP authority guard tranche binds a valid human receipt and independent review",
  }));
}

function buildDesktopConsoleBoundary(generatedAt) {
  return {
    schema_version: "hermes-mcp-desktop-console-boundary.v1",
    generated_at: generatedAt,
    desktop_role: "non_authoritative_operator_console",
    desktop_may_consume_mcp_resources: true,
    desktop_source_of_truth: false,
    desktop_mutation_allowed_now: false,
    desktop_receipt_application_allowed_now: false,
    desktop_protected_action_allowed_now: false,
    desktop_final_approval_allowed_now: false,
    desktop_enterprise_trust_claim_allowed_now: false,
  };
}

function buildSourceBindingRows({ boundaryPlan, factoryDecision, packageJson, generatedAt }) {
  const sources = [
    ["boundary_plan", boundaryPlan, ["read-only/check-only", "Hermes MCP", "Desktop remains a non-authoritative operator console"]],
    ["factory_identity_decision", factoryDecision, ["SaaS Factory", "Product Operating Platform", "전 플래그 false"]],
    ["package_scripts", packageJson, [COMMAND_NAME, "desktop:read-model", "platform:factory-product-registry-store"]],
  ];
  return sources.map(([sourceId, source, requiredTokens], index) => {
    const text = source.text ?? JSON.stringify(source.data ?? {});
    const present = source.available && requiredTokens.every((token) => text.includes(token));
    return {
      schema_version: "hermes-mcp-source-binding-row.v1",
      row_id: `hermes-mcp.source.${String(index + 1).padStart(3, "0")}`,
      source_id: sourceId,
      source_path: source.path,
      source_available: source.available,
      required_tokens: requiredTokens,
      source_binding_status: present ? "bound" : "blocked",
      mutation_allowed_now: false,
      generated_at: generatedAt,
      blocker: present ? null : `missing_source_binding_${sourceId}`,
    };
  });
}

function buildValidationItems({ packageJson, boundaryPlan, factoryDecision, mcpPolicy, mcpResourceRows, mcpToolRows, blockedAuthorityRows, desktopConsoleBoundary, sourceBindingRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const checks = [
    ["package.script", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} must be registered in package.json.`],
    ["boundary.plan", boundaryPlan.available && boundaryPlan.text.includes("read-only/check-only") && boundaryPlan.text.includes("source of truth"), "Boundary plan must exist and preserve read-only/check-only source-of-truth language."],
    ["factory.identity", factoryDecision.available && factoryDecision.text.includes("SaaS Factory") && factoryDecision.text.includes("전 플래그 false"), "Factory identity decision must remain bound."],
    ["policy.no_live_server", mcpPolicy.mcp_server_started_now === false && mcpPolicy.live_mcp_connection_opened_now === false, "H-MCP-01 must not start a live MCP server."],
    ["policy.no_mutation", mcpPolicy.repo_write_allowed_now === false && mcpPolicy.filesystem_write_allowed_now === false && mcpPolicy.connector_write_allowed_now === false, "H-MCP-01 must not open write authority."],
    ["policy.no_protected_authority", mcpPolicy.protected_action_allowed_now === false && mcpPolicy.final_approval_allowed_now === false && mcpPolicy.enterprise_trust_claim_allowed_now === false, "H-MCP-01 must not open protected approval or trust authority."],
    ["resources.complete", mcpResourceRows.length >= 8 && mcpResourceRows.every((row) => row.exposure_mode === "read_only_planned" && row.mutation_allowed_now === false), "Read-only MCP resource rows must be present."],
    ["tools.registered", mcpToolRows.length >= 8 && mcpToolRows.every((row) => row.package_script_registered), "Every MCP tool candidate must bind to an existing package script."],
    ["tools.check_only", mcpToolRows.every((row) => row.invocation_mode === "read_only_or_check_only" && row.mutation_allowed_now === false), "MCP tool candidates must remain read-only/check-only."],
    ["blocked_authority.closed", blockedAuthorityRows.length >= 12 && blockedAuthorityRows.every((row) => row.current_verdict === "blocked" && row.allowed_now === false), "Blocked authority classes must remain closed."],
    ["desktop.non_authoritative", desktopConsoleBoundary.desktop_source_of_truth === false && desktopConsoleBoundary.desktop_mutation_allowed_now === false, "Desktop must remain non-authoritative and non-mutating."],
    ["sources.bound", sourceBindingRows.every((row) => row.source_binding_status === "bound"), "Source binding rows must be bound."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, passed, message));
}

function buildSummary({ mcpPolicy, mcpResourceRows, mcpToolRows, blockedAuthorityRows, sourceBindingRows, validation }) {
  return {
    hermes_mcp_capability_registry_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    mcp_tranche: mcpPolicy.mcp_tranche,
    mcp_mode: mcpPolicy.mcp_mode,
    mcp_resource_count: mcpResourceRows.length,
    mcp_tool_count: mcpToolRows.length,
    blocked_authority_count: blockedAuthorityRows.length,
    bound_source_count: sourceBindingRows.filter((row) => row.source_binding_status === "bound").length,
    mcp_server_started_now: mcpPolicy.mcp_server_started_now,
    live_mcp_connection_opened_now: mcpPolicy.live_mcp_connection_opened_now,
    repo_write_allowed_now: mcpPolicy.repo_write_allowed_now,
    connector_write_allowed_now: mcpPolicy.connector_write_allowed_now,
    deployment_allowed_now: mcpPolicy.deployment_allowed_now,
    protected_action_allowed_now: mcpPolicy.protected_action_allowed_now,
    final_approval_allowed_now: mcpPolicy.final_approval_allowed_now,
    enterprise_trust_claim_allowed_now: mcpPolicy.enterprise_trust_claim_allowed_now,
    desktop_source_of_truth: false,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Hermes MCP Capability Registry",
    "",
    `Status: ${result.summary.hermes_mcp_capability_registry_status}`,
    `Tranche: ${result.summary.mcp_tranche}`,
    `Resources: ${result.summary.mcp_resource_count}`,
    `Check-only tools: ${result.summary.mcp_tool_count}`,
    `Blocked authority classes: ${result.summary.blocked_authority_count}`,
    "",
    "## Authority",
    "",
    "- MCP server started now: false",
    "- Repository write allowed now: false",
    "- Connector write allowed now: false",
    "- Deployment allowed now: false",
    "- Final approval allowed now: false",
    "- Desktop source of truth: false",
    "",
    "## Next Allowed Action",
    "",
    result.mcp_policy.next_allowed_action,
  ];
  return `${lines.join("\n")}\n`;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function validationItem(id, passed, message, pathValue = id) {
  return {
    id,
    path: pathValue,
    passed,
    status: passed ? "passed" : "failed",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.path ?? item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_HERMES_MCP_CAPABILITY_REGISTRY_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    boundary_plan_path: path.resolve(options.boundaryPlanPath ?? defaults.boundaryPlanPath),
    factory_decision_path: path.resolve(options.factoryDecisionPath ?? defaults.factoryDecisionPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = { check: false, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--boundary-plan") {
      args.boundaryPlanPath = argv[++index];
    } else if (arg === "--factory-decision") {
      args.factoryDecisionPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/hermes-mcp-capability-registry.mjs [--check] [--out-dir DIR]

Builds the H-MCP-01 read-only/check-only Hermes MCP capability registry without starting an MCP server or opening write/deploy/approval authority.`);
}
