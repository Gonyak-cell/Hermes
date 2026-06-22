import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildHermesMcpCapabilityRegistry } from "./hermes-mcp-capability-registry.mjs";

export const HERMES_MCP_PROTOCOL_VERSION = "2025-06-18";
export const DEFAULT_HERMES_MCP_READONLY_SERVER_OUT_DIR = "artifacts/hermes-mcp-readonly-server/latest";

const SCHEMA_VERSION = "hermes-mcp-readonly-server.v1";
const SERVER_ID = "platform.hermes_mcp.readonly_server";
const COMMAND_NAME = "platform:hermes-mcp-readonly-server";
const SERVE_SCRIPT_NAME = "mcp:serve";
const READY_STATUS = "ready_for_hermes_mcp_check_tool_adapter";
const BLOCKED_STATUS = "blocked_hermes_mcp_check_tool_adapter";
const CHECK_TOOL_TIMEOUT_MS = 120000;
const OUTPUT_CHAR_LIMIT = 12000;

const DEFAULT_INPUTS = {
  schemaPath: "schemas/hermes-mcp-readonly-server.schema.json",
  packagePath: "package.json",
};

export async function runHermesMcpReadonlyServer(options = {}) {
  const result = await buildHermesMcpReadonlyServer(options);
  if (options.write !== false) await writeHermesMcpReadonlyServer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes MCP read-only server failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHermesMcpReadonlyServer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_MCP_READONLY_SERVER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const registry = await buildHermesMcpCapabilityRegistry({ ...options, write: false });

  const serverCapabilities = buildServerCapabilities();
  const mcpResources = await buildMcpResources(registry.mcp_resource_rows);
  const mcpTools = buildMcpTools(registry.mcp_tool_rows);
  const authorityBoundary = buildAuthorityBoundary({
    packageJson,
    registry,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    registry,
    serverCapabilities,
    mcpResources,
    mcpTools,
    authorityBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    hermes_mcp_readonly_server_id: `hermes-mcp-readonly-server.${dateStamp(generatedAt)}`,
    server_id: SERVER_ID,
    command_name: COMMAND_NAME,
    serve_script_name: SERVE_SCRIPT_NAME,
    protocol_version: HERMES_MCP_PROTOCOL_VERSION,
    mcp_tranche: "H-MCP-03",
    mcp_mode: "stdio_check_only_tool_adapter",
    output_dir: outputDir,
    inputs,
    source_registry: registrySummary(registry),
    server_capabilities: serverCapabilities,
    mcp_resources: mcpResources,
    mcp_tools: mcpTools,
    authority_boundary: authorityBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      mcpResources,
      mcpTools,
      authorityBoundary,
      validation: preliminaryValidation,
    }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_mcp_readonly_server")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    mcpResources,
    mcpTools,
    authorityBoundary,
    validation: result.validation,
  });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesMcpReadonlyServer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-mcp-readonly-server.json"), serializableResult(result));
  await writeJson(path.join(outDir, "mcp-server-capabilities.json"), result.server_capabilities);
  await writeJson(path.join(outDir, "mcp-resource-list.json"), collectionEnvelope("hermes-mcp-server-resources.v1", "resources", result.mcp_resources, result.generated_at));
  await writeJson(path.join(outDir, "mcp-tool-list.json"), collectionEnvelope("hermes-mcp-server-tools.v1", "tools", result.mcp_tools, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "hermes-mcp-readonly-server-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function createHermesMcpReadonlyServerContext(options = {}) {
  const model = await buildHermesMcpReadonlyServer({ ...options, write: false });
  if (!model.validation.valid) {
    const error = new Error(`Hermes MCP read-only server model is invalid with ${model.validation.errors.length} error(s).`);
    error.validation = model.validation;
    throw error;
  }
  return { model };
}

export async function handleHermesMcpJsonRpcMessage(message, context) {
  if (!isPlainObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return jsonRpcError(message?.id ?? null, -32600, "Invalid Request");
  }
  if (!Object.prototype.hasOwnProperty.call(message, "id")) {
    return handleNotification(message);
  }

  try {
    switch (message.method) {
      case "initialize":
        return jsonRpcResult(message.id, buildInitializeResult(context.model));
      case "ping":
        return jsonRpcResult(message.id, {});
      case "resources/list":
        return jsonRpcResult(message.id, { resources: listResources(context.model) });
      case "resources/read":
        return jsonRpcResult(message.id, await readResource(message.params, context.model));
      case "tools/list":
        return jsonRpcResult(message.id, { tools: listTools(context.model) });
      case "tools/call":
        return jsonRpcResult(message.id, await callTool(message.params, context.model));
      default:
        return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    return jsonRpcError(message.id, error.code ?? -32000, error.message);
  }
}

export async function startHermesMcpStdioServer(options = {}) {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const context = await createHermesMcpReadonlyServerContext(options);
  let buffer = "";

  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      void handleStdioLine(line, context, stdout, stderr);
    }
  });
  stdin.on("end", () => {
    const line = buffer.trim();
    if (line) void handleStdioLine(line, context, stdout, stderr);
  });
}

export async function runHermesMcpReadonlyServerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.stdio) {
    try {
      await startHermesMcpStdioServer(args);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }

  try {
    const result = await runHermesMcpReadonlyServer(args);
    console.log(`Hermes MCP read-only server ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.hermes_mcp_readonly_server_status}`);
    console.log(`Protocol: ${result.summary.protocol_version}`);
    console.log(`Resources: ${result.summary.mcp_resource_count}`);
    console.log(`Tools: ${result.summary.mcp_tool_count}`);
    console.log(`Server started during check: ${result.summary.server_started_during_check}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildServerCapabilities() {
  return {
    resources: {},
    tools: {},
  };
}

async function buildMcpResources(resourceRows) {
  const resources = [];
  for (const row of resourceRows) {
    const source = await inspectSourceRef(row.source_ref);
    resources.push({
      uri: row.uri,
      name: row.resource_id.replace("hermes.mcp.resource.", ""),
      title: titleCase(row.resource_id.replace("hermes.mcp.resource.", "").replaceAll("_", " ")),
      description: row.description,
      mimeType: "application/json",
      source_ref: row.source_ref,
      read_model_kind: row.kind,
      read_model_available: source.available,
      mutation_allowed_now: false,
      protected_action_allowed_now: false,
      raw_secret_context_allowed: false,
      raw_restricted_payload_allowed: false,
      source_status: source,
    });
  }
  return resources;
}

function buildMcpTools(toolRows) {
  return toolRows.map((row) => ({
    name: row.tool_name,
    title: titleCase(row.tool_name.replace(/^hermes\./, "").replaceAll(".", " ")),
    description: `${row.description} This MCP tranche executes only the allowlisted package script in --check mode and returns structured output.`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        check_only: {
          type: "boolean",
          description: "Must remain true or omitted in H-MCP-03.",
        },
        dry_run: {
          type: "boolean",
          description: "Deprecated compatibility flag. false is rejected.",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["tool_name", "package_script", "check_command", "check_mode", "executed", "exit_code", "mutation_allowed_now"],
      properties: {
        tool_name: { type: "string" },
        package_script: { type: "string" },
        check_command: { type: "object" },
        check_mode: { type: "boolean" },
        executed: { type: "boolean" },
        exit_code: { type: ["number", "null"] },
        mutation_allowed_now: { type: "boolean" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    package_script: row.package_script,
    check_invocation: row.check_invocation,
    check_command: {
      executable: "npm",
      args: ["--silent", "run", row.package_script, "--", "--check"],
    },
    adapter_allowlisted: true,
    check_mode_required: true,
    check_timeout_ms: CHECK_TOOL_TIMEOUT_MS,
    invocation_mode: row.invocation_mode,
    mutation_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    final_approval_allowed_now: false,
  }));
}

function buildAuthorityBoundary({ packageJson, registry, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return {
    schema_version: "hermes-mcp-readonly-server-authority-boundary.v1",
    generated_at: generatedAt,
    source_of_truth: "repo_artifacts_schemas",
    registry_status: registry.summary.hermes_mcp_capability_registry_status,
    stdio_transport_enabled: true,
    server_entrypoint_registered: typeof scripts[COMMAND_NAME] === "string",
    serve_script_registered: typeof scripts[SERVE_SCRIPT_NAME] === "string",
    server_started_during_check: false,
    live_mcp_connection_opened_during_check: false,
    stdout_jsonrpc_only: true,
    resource_read_allowed_now: true,
    tool_listing_allowed_now: true,
    tool_call_returns_contract_only_now: false,
    check_tool_adapter_enabled_now: true,
    check_tool_subprocess_execution_allowed_now: true,
    non_check_tool_subprocess_execution_allowed_now: false,
    tool_subprocess_execution_allowed_now: false,
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
    desktop_source_of_truth: false,
  };
}

function buildValidationItems({ packageJson, registry, serverCapabilities, mcpResources, mcpTools, authorityBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const checks = [
    ["package.platform_script", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} must be registered in package.json.`],
    ["package.serve_script", typeof scripts[SERVE_SCRIPT_NAME] === "string", `${SERVE_SCRIPT_NAME} must be registered in package.json.`],
    ["registry.ready", registry.validation.valid && registry.summary.hermes_mcp_capability_registry_status === "ready_for_hermes_mcp_capability_registry", "H-MCP-03 requires a valid H-MCP-01 registry."],
    ["protocol.version", HERMES_MCP_PROTOCOL_VERSION === "2025-06-18", "MCP protocol version must remain 2025-06-18."],
    ["capabilities.resources_tools", isPlainObject(serverCapabilities.resources) && isPlainObject(serverCapabilities.tools), "Server must declare resources and tools capabilities."],
    ["resources.bound", mcpResources.length >= 8 && mcpResources.every((resource) => resource.mutation_allowed_now === false && resource.mimeType === "application/json"), "MCP resources must be JSON read models with mutation closed."],
    ["tools.bound", mcpTools.length >= 8 && mcpTools.every((tool) => tool.mutation_allowed_now === false && tool.invocation_mode === "read_only_or_check_only"), "MCP tools must remain read-only/check-only."],
    ["tools.check_commands", mcpTools.every((tool) => tool.adapter_allowlisted && tool.check_mode_required && tool.check_command.executable === "npm" && tool.check_command.args.at(-1) === "--check"), "Every MCP tool must bind to an npm package script in --check mode."],
    ["authority.no_write", authorityBoundary.repo_write_allowed_now === false && authorityBoundary.filesystem_write_allowed_now === false && authorityBoundary.connector_write_allowed_now === false, "MCP read-only server must not open write authority."],
    ["authority.check_only_subprocess", authorityBoundary.check_tool_adapter_enabled_now === true && authorityBoundary.check_tool_subprocess_execution_allowed_now === true && authorityBoundary.non_check_tool_subprocess_execution_allowed_now === false, "H-MCP-03 may execute check-only subprocesses and must block non-check subprocesses."],
    ["authority.no_protected", authorityBoundary.protected_action_allowed_now === false && authorityBoundary.final_approval_allowed_now === false && authorityBoundary.enterprise_trust_claim_allowed_now === false, "MCP server must not open protected approval or trust authority."],
    ["authority.desktop", authorityBoundary.desktop_source_of_truth === false, "Desktop must remain non-authoritative."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, passed, message));
}

function buildSummary({ mcpResources, mcpTools, authorityBoundary, validation }) {
  return {
    hermes_mcp_readonly_server_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    mcp_tranche: "H-MCP-03",
    mcp_mode: "stdio_check_only_tool_adapter",
    protocol_version: HERMES_MCP_PROTOCOL_VERSION,
    mcp_resource_count: mcpResources.length,
    mcp_tool_count: mcpTools.length,
    server_started_during_check: authorityBoundary.server_started_during_check,
    check_tool_adapter_enabled_now: authorityBoundary.check_tool_adapter_enabled_now,
    check_tool_subprocess_execution_allowed_now: authorityBoundary.check_tool_subprocess_execution_allowed_now,
    non_check_tool_subprocess_execution_allowed_now: authorityBoundary.non_check_tool_subprocess_execution_allowed_now,
    tool_subprocess_execution_allowed_now: authorityBoundary.tool_subprocess_execution_allowed_now,
    repo_write_allowed_now: authorityBoundary.repo_write_allowed_now,
    filesystem_write_allowed_now: authorityBoundary.filesystem_write_allowed_now,
    connector_write_allowed_now: authorityBoundary.connector_write_allowed_now,
    deployment_allowed_now: authorityBoundary.deployment_allowed_now,
    protected_action_allowed_now: authorityBoundary.protected_action_allowed_now,
    receipt_application_allowed_now: authorityBoundary.receipt_application_allowed_now,
    final_approval_allowed_now: authorityBoundary.final_approval_allowed_now,
    production_pass_allowed_now: authorityBoundary.production_pass_allowed_now,
    enterprise_trust_claim_allowed_now: authorityBoundary.enterprise_trust_claim_allowed_now,
    raw_restricted_payload_allowed: authorityBoundary.raw_restricted_payload_allowed,
    desktop_source_of_truth: authorityBoundary.desktop_source_of_truth,
    validation_error_count: validation.errors.length,
  };
}

function buildInitializeResult(model) {
  return {
    protocolVersion: HERMES_MCP_PROTOCOL_VERSION,
    capabilities: model.server_capabilities,
    serverInfo: {
      name: "hermes-mcp-readonly-server",
      title: "Hermes MCP Read-Only Control Plane",
      version: "0.1.0",
    },
    instructions: "Expose Hermes deterministic project, review, gate, receipt, artifact, factory, and Desktop read models only. Do not request writes, approvals, deployments, raw restricted payloads, or enterprise trust claims through this server.",
  };
}

function listResources(model) {
  return model.mcp_resources.map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
  }));
}

async function readResource(params, model) {
  const uri = params?.uri;
  if (typeof uri !== "string") throw invalidParams("resources/read requires params.uri.");
  const resource = model.mcp_resources.find((candidate) => candidate.uri === uri);
  if (!resource) throw invalidParams(`Unknown resource: ${uri}`);
  const payload = await buildResourcePayload(resource, model);
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: `${JSON.stringify(payload, null, 2)}\n`,
      },
    ],
  };
}

function listTools(model) {
  return model.mcp_tools.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  }));
}

async function callTool(params, model) {
  const name = params?.name;
  if (typeof name !== "string") throw invalidParams("tools/call requires params.name.");
  const tool = model.mcp_tools.find((candidate) => candidate.name === name);
  if (!tool) throw invalidParams(`Unknown tool: ${name}`);
  if (params?.arguments && params.arguments.dry_run === false) {
    throw invalidParams("H-MCP-03 tools are check-only; dry_run=false is not allowed.");
  }
  if (params?.arguments && params.arguments.check_only === false) {
    throw invalidParams("H-MCP-03 tools require check_only=true or omitted.");
  }
  const run = await runCheckCommand(tool);
  const structuredContent = {
    schema_version: "hermes-mcp-tool-check-result.v1",
    tool_name: tool.name,
    package_script: tool.package_script,
    check_command: tool.check_command,
    check_invocation: tool.check_invocation,
    invocation_mode: tool.invocation_mode,
    check_mode: true,
    executed: true,
    subprocess_started: true,
    exit_code: run.exit_code,
    signal: run.signal,
    timed_out: run.timed_out,
    duration_ms: run.duration_ms,
    status: run.exit_code === 0 && !run.timed_out ? "passed" : "failed",
    stdout: run.stdout,
    stderr: run.stderr,
    output_truncated: run.output_truncated,
    output_redacted: true,
    mutation_allowed_now: false,
    repo_write_allowed_now: false,
    filesystem_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_action_allowed_now: false,
    final_approval_allowed_now: false,
    production_pass_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_restricted_payload_allowed: false,
    next_allowed_action: "Keep MCP tools check-only until a later gated-write tranche binds valid receipts and authority guards.",
  };
  return {
    content: [
      {
        type: "text",
        text: `${JSON.stringify(structuredContent, null, 2)}\n`,
      },
    ],
    structuredContent,
    isError: structuredContent.status !== "passed",
  };
}

async function buildResourcePayload(resource, model) {
  if (resource.uri === "hermes://status") {
    return {
      schema_version: "hermes-mcp-status-resource.v1",
      server: model.summary,
      registry: model.source_registry,
      authority_boundary: model.authority_boundary,
    };
  }
  return {
    schema_version: "hermes-mcp-read-model-resource.v1",
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    read_model_kind: resource.read_model_kind,
    source_ref: resource.source_ref,
    source_status: resource.source_status,
    mutation_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_restricted_payload_allowed: false,
    source_preview: await sourcePreview(resource.source_ref, resource.source_status),
  };
}

async function sourcePreview(sourceRef, sourceStatus) {
  if (!sourceStatus.available) return { available: false, reason: sourceStatus.error ?? "source_unavailable" };
  if (sourceStatus.kind === "directory") {
    const entries = await readdir(sourceRef, { withFileTypes: true });
    return {
      available: true,
      kind: "directory",
      entry_count: entries.length,
      entries: entries
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : "file",
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 50),
      truncated: entries.length > 50,
    };
  }
  if (sourceStatus.kind === "json_file") {
    return {
      available: true,
      kind: "json_file",
      data: JSON.parse(await readFile(sourceRef, "utf8")),
    };
  }
  return {
    available: true,
    kind: "file",
    text: await readFile(sourceRef, "utf8"),
  };
}

async function inspectSourceRef(sourceRef) {
  try {
    const stats = await stat(sourceRef);
    return {
      available: true,
      kind: stats.isDirectory() ? "directory" : sourceRef.endsWith(".json") ? "json_file" : "file",
      source_ref: sourceRef,
      size_bytes: stats.size,
    };
  } catch (error) {
    return {
      available: false,
      kind: "missing",
      source_ref: sourceRef,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function handleStdioLine(line, context, stdout, stderr) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const response = await handleHermesMcpJsonRpcMessage(JSON.parse(trimmed), context);
    if (response) stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    const response = jsonRpcError(null, -32700, `Parse error: ${error.message}`);
    stdout.write(`${JSON.stringify(response)}\n`);
    stderr.write(`Hermes MCP parse error: ${error.message}\n`);
  }
}

function handleNotification(message) {
  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return null;
  return null;
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

function invalidParams(message) {
  const error = new Error(message);
  error.code = -32602;
  return error;
}

function registrySummary(registry) {
  return {
    schema_version: registry.schema_version,
    registry_id: registry.hermes_mcp_capability_registry_id,
    status: registry.summary.hermes_mcp_capability_registry_status,
    resource_count: registry.summary.mcp_resource_count,
    tool_count: registry.summary.mcp_tool_count,
    blocked_authority_count: registry.summary.blocked_authority_count,
    source_of_truth: registry.mcp_policy.source_of_truth,
    validation_error_count: registry.summary.validation_error_count,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Hermes MCP Read-Only Server",
    "",
    `Status: ${result.summary.hermes_mcp_readonly_server_status}`,
    `Tranche: ${result.summary.mcp_tranche}`,
    `Protocol: ${result.summary.protocol_version}`,
    `Resources: ${result.summary.mcp_resource_count}`,
    `Tools: ${result.summary.mcp_tool_count}`,
    "",
    "## Authority",
    "",
    "- stdio transport enabled: true",
      "- Server started during check: false",
    "- Check tool adapter enabled now: true",
    "- Check tool subprocess execution allowed now: true",
    "- Non-check tool subprocess execution allowed now: false",
    "- Repository write allowed now: false",
    "- Filesystem write allowed now: false",
    "- Connector write allowed now: false",
    "- Deployment allowed now: false",
    "- Receipt application allowed now: false",
    "- Final approval allowed now: false",
    "- Production PASS allowed now: false",
    "- Enterprise trust claim allowed now: false",
    "- Raw restricted payload allowed now: false",
    "- Desktop source of truth: false",
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
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_INPUTS.packagePath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = { check: false, write: true, stdio: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--stdio") {
      args.stdio = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function printHelp() {
  console.log(`Usage: node scripts/hermes-mcp-readonly-server.mjs [--check] [--out-dir DIR]
       node scripts/hermes-mcp-readonly-server.mjs --stdio

Builds or serves the H-MCP-03 stdio MCP surface with check-only tool execution. The stdio mode writes only JSON-RPC messages to stdout.`);
}

async function runCheckCommand(tool) {
  const startedAt = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(tool.check_command.executable, tool.check_command.args, {
      cwd: process.cwd(),
      env: { ...process.env, HERMES_MCP_CHECK_ONLY: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, tool.check_timeout_ms ?? CHECK_TOOL_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const preparedStdout = prepareOutput(stdout);
      const preparedStderr = prepareOutput(stderr);
      resolve({
        exit_code: code,
        signal,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        stdout: preparedStdout.text,
        stderr: preparedStderr.text,
        output_truncated: preparedStdout.truncated || preparedStderr.truncated,
      });
    });
  });
}

function prepareOutput(value) {
  const redacted = redactOutput(value);
  if (redacted.length <= OUTPUT_CHAR_LIMIT) return { text: redacted, truncated: false };
  return {
    text: redacted.slice(-OUTPUT_CHAR_LIMIT),
    truncated: true,
  };
}

function redactOutput(value) {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-REDACTED")
    .replace(/gh[pousr]_[A-Za-z0-9_]{16,}/g, "gh_REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer REDACTED")
    .replace(/(api[_-]?key|token|secret)(['"=:\\s]+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1$2REDACTED");
}
