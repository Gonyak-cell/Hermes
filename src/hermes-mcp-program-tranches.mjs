import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  buildHermesMcpReadonlyServer,
  handleHermesMcpJsonRpcMessage,
} from "./hermes-mcp-readonly-server.mjs";

const RUN_AT_DEFAULT = () => new Date().toISOString();

const TRANCHE_CONFIGS = {
  "H-MCP-04": {
    schemaVersion: "hermes-mcp-authority-guard.v1",
    commandName: "platform:hermes-mcp-authority-guard",
    schemaPath: "schemas/hermes-mcp-authority-guard.schema.json",
    outDir: "artifacts/hermes-mcp-authority-guard/latest",
    readyStatus: "ready_for_hermes_mcp_authority_guard",
  },
  "H-MCP-05": {
    schemaVersion: "hermes-mcp-desktop-consumption-boundary.v1",
    commandName: "platform:hermes-mcp-desktop-consumption-boundary",
    schemaPath: "schemas/hermes-mcp-desktop-consumption-boundary.schema.json",
    outDir: "artifacts/hermes-mcp-desktop-consumption-boundary/latest",
    readyStatus: "ready_for_hermes_mcp_desktop_consumption_boundary",
  },
  "H-MCP-06": {
    schemaVersion: "hermes-mcp-client-setup.v1",
    commandName: "platform:hermes-mcp-client-setup",
    schemaPath: "schemas/hermes-mcp-client-setup.schema.json",
    outDir: "artifacts/hermes-mcp-client-setup/latest",
    readyStatus: "ready_for_hermes_mcp_client_setup",
  },
  "H-MCP-07": {
    schemaVersion: "hermes-mcp-gated-write-tool-definitions.v1",
    commandName: "platform:hermes-mcp-gated-write-tool-definitions",
    schemaPath: "schemas/hermes-mcp-gated-write-tool-definitions.schema.json",
    outDir: "artifacts/hermes-mcp-gated-write-tool-definitions/latest",
    readyStatus: "ready_for_hermes_mcp_gated_write_tool_definitions",
  },
  "H-MCP-08": {
    schemaVersion: "hermes-mcp-closeout-readiness.v1",
    commandName: "platform:hermes-mcp-closeout-readiness",
    schemaPath: "schemas/hermes-mcp-closeout-readiness.schema.json",
    outDir: "artifacts/hermes-mcp-closeout-readiness/latest",
    readyStatus: "ready_for_hermes_mcp_closeout_readiness",
  },
};

const AUTHORITY_FALSE_FLAGS = {
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
};

const H_MCP_04_FIXTURES = [
  ["method.resources_write", { method: "resources/write", params: { uri: "hermes://status" } }, -32601, "resource writes are unsupported"],
  ["method.receipts_apply", { method: "receipts/apply", params: {} }, -32601, "receipt application is unsupported"],
  ["method.deploy_run", { method: "deployment/run", params: {} }, -32601, "deployment is unsupported"],
  ["method.final_approval", { method: "approval/finalize", params: {} }, -32601, "final approval is unsupported"],
  ["method.enterprise_trust", { method: "enterprise/trust/pass", params: {} }, -32601, "enterprise trust PASS is unsupported"],
  ["tool.dry_run_false", { method: "tools/call", params: { name: "hermes.validate.core", arguments: { dry_run: false } } }, -32602, "dry_run=false is rejected"],
  ["tool.check_only_false", { method: "tools/call", params: { name: "hermes.validate.core", arguments: { check_only: false } } }, -32602, "check_only=false is rejected"],
  ["tool.gated_repo_write", { method: "tools/call", params: { name: "hermes.gated.repo.write_request", arguments: { check_only: true } } }, -32602, "gated write tools are not registered for execution"],
  ["resource.raw_secret", { method: "resources/read", params: { uri: "hermes://raw/secrets" } }, -32602, "raw secret resource is unavailable"],
  ["resource.raw_restricted", { method: "resources/read", params: { uri: "hermes://raw/restricted-payload" } }, -32602, "raw restricted resource is unavailable"],
  ["params.missing_uri", { method: "resources/read", params: {} }, -32602, "resource reads require a known uri"],
  ["method.prompts_list", { method: "prompts/list", params: {} }, -32601, "prompt surfaces are not part of this MCP tranche"],
];

const DESKTOP_CONSUMPTION_ROWS = [
  ["desktop.status", "hermes://status", "status panel"],
  ["desktop.projects", "hermes://projects", "project portfolio panel"],
  ["desktop.reviews", "hermes://reviews", "review queue panel"],
  ["desktop.gates", "hermes://gates", "gate status panel"],
  ["desktop.receipts", "hermes://receipts", "receipt status panel"],
  ["desktop.artifacts", "hermes://artifacts/latest", "artifact browser panel"],
  ["desktop.factory", "hermes://factory/products", "factory product panel"],
  ["desktop.self", "hermes://desktop/read-model", "desktop read-model panel"],
];

const CLIENT_ROWS = [
  ["codex", "npm", ["--silent", "run", "mcp:serve"], "Codex MCP client configuration"],
  ["claude_desktop", "npm", ["--silent", "run", "mcp:serve"], "Claude Desktop MCP client configuration"],
  ["hermes_desktop", "node", ["scripts/hermes-mcp-readonly-server.mjs", "--stdio"], "Hermes Desktop internal operator console binding"],
  ["manual_smoke", "npm", ["--silent", "run", "mcp:serve"], "Manual JSON-RPC smoke command"],
];

const GATED_WRITE_TOOL_ROWS = [
  ["hermes.gated.repo.write_request", "repo_write", "Request repository write authority"],
  ["hermes.gated.file.patch_request", "file_write", "Request filesystem patch authority"],
  ["hermes.gated.connector.write_request", "connector_write", "Request external connector write authority"],
  ["hermes.gated.receipt.apply_request", "receipt_apply", "Request receipt application authority"],
  ["hermes.gated.deploy.request", "deploy", "Request deployment authority"],
  ["hermes.gated.protected_action.request", "protected_action", "Request protected action authority"],
  ["hermes.gated.final_approval.request", "final_approval", "Request final approval authority"],
  ["hermes.gated.enterprise_trust.request", "enterprise_trust", "Request enterprise trust authority"],
  ["hermes.gated.raw_restricted_payload.request", "raw_restricted_payload", "Request raw restricted payload access"],
];

export async function runHermesMcpTranche(trancheId, options = {}) {
  const result = await buildHermesMcpTranche(trancheId, options);
  if (options.write !== false) await writeTrancheResult(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`${trancheId} failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHermesMcpTranche(trancheId, options = {}) {
  if (!TRANCHE_CONFIGS[trancheId]) throw new Error(`Unknown Hermes MCP tranche: ${trancheId}`);
  if (trancheId === "H-MCP-04") return buildAuthorityGuard(options);
  if (trancheId === "H-MCP-05") return buildDesktopConsumptionBoundary(options);
  if (trancheId === "H-MCP-06") return buildClientSetup(options);
  if (trancheId === "H-MCP-07") return buildGatedWriteToolDefinitions(options);
  return buildCloseoutReadiness(options);
}

export async function runHermesMcpTrancheCli(trancheId, argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp(trancheId);
    return;
  }
  try {
    const result = await runHermesMcpTranche(trancheId, args);
    console.log(`${trancheId} ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.status}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildAuthorityGuard(options = {}) {
  const config = TRANCHE_CONFIGS["H-MCP-04"];
  const generatedAt = new Date(options.runAt ?? RUN_AT_DEFAULT()).toISOString();
  const model = await buildHermesMcpReadonlyServer({ ...options, write: false });
  const context = { model };
  const fixtureRows = [];
  for (const [fixtureId, message, expectedCode, description] of H_MCP_04_FIXTURES) {
    const response = await handleHermesMcpJsonRpcMessage({ jsonrpc: "2.0", id: fixtureRows.length + 1, ...message }, context);
    fixtureRows.push({
      schema_version: "hermes-mcp-negative-fixture.v1",
      fixture_id: fixtureId,
      description,
      expected_error_code: expectedCode,
      observed_error_code: response.error?.code ?? null,
      passed: response.error?.code === expectedCode,
      mutation_allowed_now: false,
      generated_at: generatedAt,
    });
  }
  return finalizeResult(config, generatedAt, {
    source_server_status: model.summary.hermes_mcp_readonly_server_status,
    negative_fixture_rows: fixtureRows,
    authority_boundary: authorityBoundary("H-MCP-04", generatedAt),
  }, [
    validationItem("server.ready", model.validation.valid && model.summary.mcp_tranche === "H-MCP-03", "H-MCP-04 requires H-MCP-03 server baseline."),
    validationItem("fixtures.closed", fixtureRows.length === H_MCP_04_FIXTURES.length && fixtureRows.every((row) => row.passed), "All negative fixtures must fail closed."),
  ]);
}

async function buildDesktopConsumptionBoundary(options = {}) {
  const config = TRANCHE_CONFIGS["H-MCP-05"];
  const generatedAt = new Date(options.runAt ?? RUN_AT_DEFAULT()).toISOString();
  const guard = await readArtifact("artifacts/hermes-mcp-authority-guard/latest/hermes-mcp-authority-guard.json");
  const model = await buildHermesMcpReadonlyServer({ ...options, write: false });
  const resourceUris = new Set(model.mcp_resources.map((resource) => resource.uri));
  const consumptionRows = DESKTOP_CONSUMPTION_ROWS.map(([rowId, uri, panel]) => ({
    schema_version: "hermes-mcp-desktop-consumption-row.v1",
    row_id: rowId,
    desktop_panel: panel,
    mcp_resource_uri: uri,
    resource_registered: resourceUris.has(uri),
    consumption_mode: "mcp_or_equivalent_read_model",
    desktop_source_of_truth: false,
    desktop_mutation_allowed_now: false,
    desktop_receipt_application_allowed_now: false,
    desktop_final_approval_allowed_now: false,
    generated_at: generatedAt,
  }));
  return finalizeResult(config, generatedAt, {
    source_guard_status: guard.data?.summary?.status ?? null,
    desktop_consumption_rows: consumptionRows,
    authority_boundary: authorityBoundary("H-MCP-05", generatedAt),
  }, [
    validationItem("guard.ready", guard.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-04"].readyStatus, "H-MCP-05 requires H-MCP-04 guard readiness."),
    validationItem("desktop.rows", consumptionRows.length === DESKTOP_CONSUMPTION_ROWS.length && consumptionRows.every((row) => row.resource_registered), "Desktop consumption rows must bind registered MCP resources."),
    validationItem("desktop.non_authoritative", consumptionRows.every((row) => row.desktop_source_of_truth === false && row.desktop_mutation_allowed_now === false), "Desktop must remain non-authoritative."),
  ]);
}

async function buildClientSetup(options = {}) {
  const config = TRANCHE_CONFIGS["H-MCP-06"];
  const generatedAt = new Date(options.runAt ?? RUN_AT_DEFAULT()).toISOString();
  const desktop = await readArtifact("artifacts/hermes-mcp-desktop-consumption-boundary/latest/hermes-mcp-desktop-consumption-boundary.json");
  const runbookPath = "docs/hermes-mcp-client-setup-runbook.md";
  const runbook = renderClientSetupRunbook();
  const clientRows = CLIENT_ROWS.map(([clientId, command, args, description]) => ({
    schema_version: "hermes-mcp-client-setup-row.v1",
    client_id: clientId,
    command,
    args,
    description,
    uses_silent_stdio: command !== "npm" || args.includes("--silent"),
    writes_enabled_now: false,
    raw_restricted_payload_allowed: false,
    generated_at: generatedAt,
  }));
  const result = await finalizeResult(config, generatedAt, {
    source_desktop_boundary_status: desktop.data?.summary?.status ?? null,
    runbook_path: runbookPath,
    client_setup_rows: clientRows,
    smoke_runbook_rows: buildSmokeRunbookRows(generatedAt),
    authority_boundary: authorityBoundary("H-MCP-06", generatedAt),
  }, [
    validationItem("desktop.ready", desktop.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-05"].readyStatus, "H-MCP-06 requires H-MCP-05 desktop boundary readiness."),
    validationItem("clients.silent", clientRows.every((row) => row.uses_silent_stdio), "npm MCP clients must use --silent stdio."),
    validationItem("runbook.tokens", runbook.includes("npm --silent run mcp:serve") && runbook.includes("tools/call") && runbook.includes("check_only"), "Client setup runbook must document MCP smoke flow."),
  ]);
  result.runbook = runbook;
  return result;
}

async function buildGatedWriteToolDefinitions(options = {}) {
  const config = TRANCHE_CONFIGS["H-MCP-07"];
  const generatedAt = new Date(options.runAt ?? RUN_AT_DEFAULT()).toISOString();
  const clientSetup = await readArtifact("artifacts/hermes-mcp-client-setup/latest/hermes-mcp-client-setup.json");
  const writeRows = GATED_WRITE_TOOL_ROWS.map(([toolName, authorityId, description]) => ({
    schema_version: "hermes-mcp-gated-write-tool-definition.v1",
    tool_name: toolName,
    authority_id: authorityId,
    description,
    defined_for_future_tranche: true,
    available_in_mcp_tools_list_now: false,
    execution_registered_now: false,
    execution_allowed_now: false,
    human_receipt_required: true,
    independent_review_required: true,
    protected_gate_required: true,
    generated_at: generatedAt,
  }));
  return finalizeResult(config, generatedAt, {
    source_client_setup_status: clientSetup.data?.summary?.status ?? null,
    gated_write_tool_rows: writeRows,
    authority_boundary: authorityBoundary("H-MCP-07", generatedAt),
  }, [
    validationItem("client_setup.ready", clientSetup.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-06"].readyStatus, "H-MCP-07 requires H-MCP-06 client setup readiness."),
    validationItem("writes.defined", writeRows.length >= 8 && writeRows.every((row) => row.defined_for_future_tranche), "Gated write tools must be defined."),
    validationItem("writes.closed", writeRows.every((row) => row.available_in_mcp_tools_list_now === false && row.execution_allowed_now === false), "Gated write tools must remain closed."),
  ]);
}

async function buildCloseoutReadiness(options = {}) {
  const config = TRANCHE_CONFIGS["H-MCP-08"];
  const generatedAt = new Date(options.runAt ?? RUN_AT_DEFAULT()).toISOString();
  const sources = {
    plan: await readTextArtifact("docs/hermes-mcp-native-control-plane-plan.md"),
    registry: await readArtifact("artifacts/hermes-mcp-capability-registry/latest/hermes-mcp-capability-registry.json"),
    server: await readArtifact("artifacts/hermes-mcp-readonly-server/latest/hermes-mcp-readonly-server.json"),
    guard: await readArtifact("artifacts/hermes-mcp-authority-guard/latest/hermes-mcp-authority-guard.json"),
    desktop: await readArtifact("artifacts/hermes-mcp-desktop-consumption-boundary/latest/hermes-mcp-desktop-consumption-boundary.json"),
    client: await readArtifact("artifacts/hermes-mcp-client-setup/latest/hermes-mcp-client-setup.json"),
    gatedWrites: await readArtifact("artifacts/hermes-mcp-gated-write-tool-definitions/latest/hermes-mcp-gated-write-tool-definitions.json"),
  };
  const readinessRows = [
    readinessRow("H-MCP-00", "boundary plan", sources.plan.available && sources.plan.text.includes("H-MCP-00")),
    readinessRow("H-MCP-01", "capability registry", sources.registry.data?.summary?.hermes_mcp_capability_registry_status === "ready_for_hermes_mcp_capability_registry"),
    readinessRow("H-MCP-02", "read-only stdio server surface", sources.plan.text.includes("H-MCP-02") && sources.server.data?.summary?.mcp_resource_count === 8),
    readinessRow("H-MCP-03", "check-only tool adapter", sources.server.data?.summary?.mcp_tranche === "H-MCP-03"),
    readinessRow("H-MCP-04", "authority guard and negative fixtures", sources.guard.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-04"].readyStatus),
    readinessRow("H-MCP-05", "Desktop consumption boundary", sources.desktop.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-05"].readyStatus),
    readinessRow("H-MCP-06", "client setup and smoke runbooks", sources.client.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-06"].readyStatus),
    readinessRow("H-MCP-07", "gated write definitions closed", sources.gatedWrites.data?.summary?.status === TRANCHE_CONFIGS["H-MCP-07"].readyStatus),
    readinessRow("H-MCP-08", "closeout readiness pack", true),
  ].map((row) => ({ ...row, generated_at: generatedAt }));
  return finalizeResult(config, generatedAt, {
    readiness_rows: readinessRows,
    source_statuses: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, value.available])),
    authority_boundary: authorityBoundary("H-MCP-08", generatedAt),
  }, [
    validationItem("readiness.all", readinessRows.every((row) => row.ready), "Every H-MCP-00 through H-MCP-08 row must be ready."),
    validationItem("authority.closed", Object.values(AUTHORITY_FALSE_FLAGS).every((value) => value === false), "Protected authority must remain closed."),
  ]);
}

async function finalizeResult(config, generatedAt, body, validationItems) {
  const validation = summarizeValidation(validationItems);
  const base = {
    schema_version: config.schemaVersion,
    generated_at: generatedAt,
    tranche_id: Object.entries(TRANCHE_CONFIGS).find(([, value]) => value === config)?.[0],
    command_name: config.commandName,
    output_dir: path.resolve(config.outDir),
    ...body,
    validation_items: validationItems,
    validation,
    summary: {
      schema_version: `${config.schemaVersion}.summary`,
      status: validation.valid ? config.readyStatus : `blocked_${config.readyStatus.replace(/^ready_for_/, "")}`,
      validation_error_count: validation.errors.length,
      ...summaryCounts(body),
      ...AUTHORITY_FALSE_FLAGS,
    },
  };
  const schema = await readArtifact(config.schemaPath);
  const schemaErrors = schema.available
    ? validateAgainstSchema(base, schema.data, {}, config.schemaVersion)
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  base.validation_items = [...validationItems, ...schemaItems];
  base.validation = summarizeValidation(base.validation_items);
  base.summary = {
    ...base.summary,
    status: base.validation.valid ? config.readyStatus : `blocked_${config.readyStatus.replace(/^ready_for_/, "")}`,
    validation_error_count: base.validation.errors.length,
  };
  base.markdown = renderSummaryMarkdown(base);
  return base;
}

async function writeTrancheResult(result, outDir) {
  await mkdir(outDir, { recursive: true });
  const fileName = `${slugify(result.schema_version.replace(/^hermes-mcp-/, "hermes-mcp-").replace(/\.v1$/, ""))}.json`;
  await writeJson(path.join(outDir, fileName), serializable(result));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: `${result.schema_version}.validation-report`,
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  if (result.runbook) await writeFile("docs/hermes-mcp-client-setup-runbook.md", result.runbook, "utf8");
}

function authorityBoundary(trancheId, generatedAt) {
  return {
    schema_version: "hermes-mcp-authority-boundary.v1",
    tranche_id: trancheId,
    generated_at: generatedAt,
    source_of_truth: "repo_artifacts_schemas",
    desktop_source_of_truth: false,
    ...AUTHORITY_FALSE_FLAGS,
  };
}

function summaryCounts(body) {
  return {
    negative_fixture_count: body.negative_fixture_rows?.length ?? 0,
    negative_fixture_pass_count: body.negative_fixture_rows?.filter((row) => row.passed).length ?? 0,
    desktop_consumption_count: body.desktop_consumption_rows?.length ?? 0,
    client_setup_count: body.client_setup_rows?.length ?? 0,
    smoke_runbook_count: body.smoke_runbook_rows?.length ?? 0,
    gated_write_tool_count: body.gated_write_tool_rows?.length ?? 0,
    readiness_count: body.readiness_rows?.length ?? 0,
    readiness_ready_count: body.readiness_rows?.filter((row) => row.ready).length ?? 0,
  };
}

function readinessRow(trancheId, description, ready) {
  return {
    schema_version: "hermes-mcp-readiness-row.v1",
    tranche_id: trancheId,
    description,
    ready: Boolean(ready),
    blocker: ready ? null : `${trancheId.toLowerCase()}_not_ready`,
  };
}

function buildSmokeRunbookRows(generatedAt) {
  return [
    ["initialize", "Send initialize and expect protocolVersion 2025-06-18."],
    ["resources_list", "Send resources/list and expect 8 resources."],
    ["status_read", "Send resources/read hermes://status and expect closed authority flags."],
    ["check_tool", "Send tools/call hermes.validate.core with check_only true and expect exit_code 0."],
    ["blocked_tool", "Send tools/call with check_only false and expect -32602."],
  ].map(([rowId, description]) => ({
    schema_version: "hermes-mcp-smoke-runbook-row.v1",
    row_id: rowId,
    description,
    generated_at: generatedAt,
  }));
}

function renderClientSetupRunbook() {
  return `# Hermes MCP Client Setup Runbook

Status: H-MCP-06 client setup

## Stdio Command

Use this command for npm-backed MCP clients:

\`\`\`sh
npm --silent run mcp:serve
\`\`\`

Direct launch is also valid:

\`\`\`sh
node scripts/hermes-mcp-readonly-server.mjs --stdio
\`\`\`

## Smoke Flow

1. Send \`initialize\` and expect protocol \`2025-06-18\`.
2. Send \`resources/list\` and expect the Hermes read-model resources.
3. Send \`resources/read\` for \`hermes://status\` and verify authority flags remain false.
4. Send \`tools/call\` for \`hermes.validate.core\` with \`{"check_only": true}\` and expect a check-only result.
5. Send \`tools/call\` with \`{"check_only": false}\` and expect JSON-RPC error \`-32602\`.

No client setup may enable write, deploy, receipt application, protected approval, production PASS, enterprise trust, raw secret, or raw restricted payload authority.
`;
}

function renderSummaryMarkdown(result) {
  return `# ${result.tranche_id} ${result.summary.status}

- Command: ${result.command_name}
- Validation errors: ${result.summary.validation_error_count}
- Repository write allowed now: false
- Connector write allowed now: false
- Deployment allowed now: false
- Receipt application allowed now: false
- Protected action allowed now: false
- Production PASS allowed now: false
- Enterprise trust claim allowed now: false
- Raw restricted payload allowed now: false
`;
}

function validationItem(id, passed, message, pathValue = id) {
  return {
    id,
    path: pathValue,
    passed: Boolean(passed),
    status: passed ? "passed" : "failed",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.path ?? item.id, message: item.message }));
  return { valid: errors.length === 0, errors };
}

async function readArtifact(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function readTextArtifact(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializable(result) {
  const { markdown, runbook, ...rest } = result;
  return rest;
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
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp(trancheId) {
  console.log(`Usage: node scripts/${scriptNameForTranche(trancheId)}.mjs [--check] [--run-at ISO]`);
}

function scriptNameForTranche(trancheId) {
  return TRANCHE_CONFIGS[trancheId].commandName.replace("platform:", "");
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
