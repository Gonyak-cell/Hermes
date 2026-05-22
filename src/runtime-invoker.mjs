import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_ADAPTER_REGISTRY = "examples/core/runtime-adapters.json";
export const DEFAULT_RUNTIME_COMMAND_BINDINGS = "examples/core/runtime-command-bindings.json";
export const DEFAULT_RUNTIME_INVOCATION_OUT_DIR = "artifacts/runtime-invocation/latest";

export async function invokeRuntimeAdapters(options = {}) {
  const invocations = options.invocations ?? [];
  const records = [];
  for (const invocation of invocations) {
    records.push(await invokeRuntimeAdapter({
      ...options,
      ...invocation,
    }));
  }

  return {
    schema_version: "runtime-invocation-ledger.v1",
    generated_at: new Date(options.runAt ?? new Date()).toISOString(),
    mode: options.mode ?? "dry-run",
    workspace_path: options.workspaceManifest?.workspace_path ?? null,
    invocations: records,
    metadata: options.metadata ?? {},
  };
}

export async function invokeRuntimeAdapter(options = {}) {
  const registry = await readRuntimeAdapterRegistry(options.adapterRegistryPath ?? DEFAULT_RUNTIME_ADAPTER_REGISTRY);
  const runtimeId = options.runtimeId;
  const adapter = registry.adapters.find((item) => item.runtime_id === runtimeId);
  if (!adapter) throw new Error(`Runtime adapter ${runtimeId} was not found`);

  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const mode = options.mode ?? "dry-run";
  const prompt = options.prompt ?? "";
  const promptHash = sha256(prompt);
  const bindingResolution = await resolveRuntimeCommandBinding({
    runtimeId,
    bindingRegistryPath: options.commandBindingPath ?? DEFAULT_RUNTIME_COMMAND_BINDINGS,
    explicitCommand: options.command,
    autoCommand: options.autoCommand ?? true,
  });
  const command = bindingResolution.command;
  const workspaceManifest = options.workspaceManifest ?? {};
  const blockedReason = executionBlockReason({ adapter, mode, command, workspaceManifest, bindingResolution });
  const startedAt = isoAt(runAt, 0);

  if (mode === "dry-run" || blockedReason || bindingResolution.status === "unavailable") {
    const status = bindingResolution.status === "unavailable" && mode === "execute"
      ? "unavailable"
      : blockedReason
        ? "blocked"
        : "planned";
    const outputText = blockedReason
      ? `Execution blocked for ${runtimeId}: ${blockedReason}`
      : bindingResolution.status === "unavailable"
        ? `Runtime command unavailable for ${runtimeId}: ${bindingResolution.install_hint ?? "no command binding found"}`
        : `Dry run planned for ${runtimeId}; no external runtime was called.`;
    return buildInvocationRecord({
      adapter,
      bindingResolution,
      mode,
      status,
      workspaceManifest,
      prompt,
      promptHash,
      command,
      startedAt,
      completedAt: isoAt(runAt, 1),
      exitCode: null,
      stdout: outputText,
      stderr: "",
      blockedReason,
      metadata: options.metadata,
    });
  }

  const execution = await runCommand(command, {
    cwd: workspaceManifest.workspace_path ?? process.cwd(),
    timeoutMs: options.timeoutMs ?? Math.min((adapter.lifecycle?.timeout_seconds ?? 900) * 1000, 60_000),
  });

  return buildInvocationRecord({
    adapter,
    bindingResolution,
    mode,
    status: execution.exit_code === 0 ? "completed" : "failed",
    workspaceManifest,
    prompt,
    promptHash,
    command,
    startedAt: execution.started_at,
    completedAt: execution.completed_at,
    exitCode: execution.exit_code,
    stdout: execution.stdout,
    stderr: execution.stderr,
    blockedReason: null,
    metadata: options.metadata,
  });
}

export async function writeRuntimeInvocationLedger(ledger, outDir = DEFAULT_RUNTIME_INVOCATION_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "runtime-invocations.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

export async function inspectRuntimeCommandBindings(options = {}) {
  const registry = JSON.parse(await readFile(options.commandBindingPath ?? DEFAULT_RUNTIME_COMMAND_BINDINGS, "utf8"));
  const bindings = [];
  for (const binding of registry.bindings ?? []) {
    bindings.push(await resolveRuntimeCommandBinding({
      runtimeId: binding.runtime_id,
      bindingRegistryPath: options.commandBindingPath ?? DEFAULT_RUNTIME_COMMAND_BINDINGS,
      autoCommand: true,
    }));
  }
  return {
    schema_version: "runtime-command-binding-inspection.v1",
    generated_at: new Date(options.runAt ?? new Date()).toISOString(),
    bindings,
  };
}

export async function writeRuntimeCommandBindingInspection(inspection, outDir = DEFAULT_RUNTIME_INVOCATION_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "runtime-command-bindings.json"), `${JSON.stringify(inspection, null, 2)}\n`, "utf8");
}

export async function runRuntimeInvokerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const workspaceManifest = args.workspaceManifestPath
    ? JSON.parse(await readFile(args.workspaceManifestPath, "utf8"))
    : {
        requested_isolation: "manual",
        actual_isolation: "manual",
        workspace_path: process.cwd(),
      };
  const prompt = args.promptFile ? await readFile(args.promptFile, "utf8") : args.prompt;
  const ledger = await invokeRuntimeAdapters({
    adapterRegistryPath: args.adapterRegistryPath,
    commandBindingPath: args.commandBindingPath,
    mode: args.mode,
    workspaceManifest,
    invocations: [
      {
        runtimeId: args.runtimeId,
        prompt,
        command: args.command,
        autoCommand: !args.noAutoCommand,
        metadata: {
          cli: true,
        },
      },
    ],
  });
  await writeRuntimeInvocationLedger(ledger, args.outDir);
  const invocation = ledger.invocations[0];
  console.log(`Runtime invocation written to ${path.resolve(args.outDir, "runtime-invocations.json")}`);
  console.log(`Runtime: ${invocation.runtime_id}`);
  console.log(`Mode: ${invocation.mode}`);
  console.log(`Status: ${invocation.status}`);
  if (invocation.blocked_reason) console.log(`Blocked: ${invocation.blocked_reason}`);
}

async function readRuntimeAdapterRegistry(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function runRuntimeBindingsCli(argv = process.argv.slice(2)) {
  const args = parseBindingArgs(argv);
  if (args.help) {
    printBindingHelp();
    return;
  }

  const inspection = await inspectRuntimeCommandBindings({
    commandBindingPath: args.commandBindingPath,
  });
  await writeRuntimeCommandBindingInspection(inspection, args.outDir);
  console.log(`Runtime command binding inspection written to ${path.resolve(args.outDir, "runtime-command-bindings.json")}`);
  for (const binding of inspection.bindings) {
    console.log(`${binding.runtime_id}: ${binding.status}${binding.command ? ` (${binding.command.command})` : ""}`);
  }
}

async function resolveRuntimeCommandBinding({ runtimeId, bindingRegistryPath, explicitCommand, autoCommand }) {
  if (explicitCommand) {
    return {
      schema_version: "runtime-command-resolution.v1",
      runtime_id: runtimeId,
      binding_id: "binding.explicit_command",
      status: "explicit",
      command: normalizeCommand(explicitCommand),
      prompt_delivery: "none",
      install_hint: null,
      candidate_commands: [],
    };
  }

  if (!autoCommand) {
    return {
      schema_version: "runtime-command-resolution.v1",
      runtime_id: runtimeId,
      binding_id: null,
      status: "not_requested",
      command: null,
      prompt_delivery: "none",
      install_hint: null,
      candidate_commands: [],
    };
  }

  let registry;
  try {
    registry = JSON.parse(await readFile(bindingRegistryPath, "utf8"));
  } catch (error) {
    return {
      schema_version: "runtime-command-resolution.v1",
      runtime_id: runtimeId,
      binding_id: null,
      status: "unavailable",
      command: null,
      prompt_delivery: "none",
      install_hint: `Unable to read command binding registry: ${error.message}`,
      candidate_commands: [],
    };
  }

  const binding = (registry.bindings ?? []).find((item) => item.runtime_id === runtimeId);
  if (!binding) {
    return {
      schema_version: "runtime-command-resolution.v1",
      runtime_id: runtimeId,
      binding_id: null,
      status: "unavailable",
      command: null,
      prompt_delivery: "none",
      install_hint: `No command binding registered for ${runtimeId}`,
      candidate_commands: [],
    };
  }

  for (const candidate of binding.candidate_commands ?? []) {
    const found = await commandExists(candidate.command);
    if (found) {
      return {
        schema_version: "runtime-command-resolution.v1",
        runtime_id: runtimeId,
        binding_id: binding.binding_id,
        status: "available",
        command: {
          command: found,
          args: candidate.args ?? [],
        },
        prompt_delivery: binding.prompt_delivery,
        install_hint: binding.install_hint,
        candidate_commands: binding.candidate_commands,
      };
    }
  }

  return {
    schema_version: "runtime-command-resolution.v1",
    runtime_id: runtimeId,
    binding_id: binding.binding_id,
    status: "unavailable",
    command: null,
    prompt_delivery: binding.prompt_delivery,
    install_hint: binding.install_hint,
    candidate_commands: binding.candidate_commands ?? [],
  };
}

function executionBlockReason({ adapter, mode, command, workspaceManifest, bindingResolution }) {
  if (!["dry-run", "execute"].includes(mode)) return `unsupported mode ${mode}`;
  if (mode !== "execute") return null;
  if (!command?.command) return bindingResolution?.status === "unavailable"
    ? null
    : "execute mode requires an explicit command or available command binding";

  const runtimeId = adapter.runtime_id;
  if (["claude_code", "codex"].includes(runtimeId) && workspaceManifest.actual_isolation !== "git_worktree") {
    return `${runtimeId} execute mode requires git_worktree isolation`;
  }
  if (adapter.workspace_policy?.isolation_type === "docker_container" && workspaceManifest.actual_isolation === "none") {
    return `${runtimeId} execute mode requires an isolated workspace`;
  }
  return null;
}

function buildInvocationRecord({
  adapter,
  bindingResolution,
  mode,
  status,
  workspaceManifest,
  prompt,
  promptHash,
  command,
  startedAt,
  completedAt,
  exitCode,
  stdout,
  stderr,
  blockedReason,
  metadata,
}) {
  const outputHash = sha256(`${stdout}\n${stderr}`);
  return {
    schema_version: "runtime-invocation.v1",
    id: `runtime-invocation.${adapter.runtime_id}.${promptHash.slice(0, 12)}`,
    runtime_id: adapter.runtime_id,
    adapter_id: adapter.adapter_id,
    adapter_version: adapter.version,
    mode,
    status,
    risk_level: adapter.risk_level,
    workspace: {
      requested_isolation: workspaceManifest.requested_isolation ?? null,
      actual_isolation: workspaceManifest.actual_isolation ?? null,
      workspace_path: workspaceManifest.workspace_path ?? null,
      branch_name: workspaceManifest.branch_name ?? null,
    },
    command: command
      ? {
          command: command.command,
          args: command.args,
          cwd: workspaceManifest.workspace_path ?? null,
        }
      : null,
    binding: bindingResolution
      ? {
          binding_id: bindingResolution.binding_id,
          status: bindingResolution.status,
          prompt_delivery: bindingResolution.prompt_delivery,
          install_hint: bindingResolution.install_hint,
          candidate_commands: bindingResolution.candidate_commands,
        }
      : null,
    input: {
      prompt_hash: promptHash,
      prompt_preview: prompt.replace(/\s+/g, " ").trim().slice(0, 240),
    },
    output: {
      stdout_hash: sha256(stdout ?? ""),
      stderr_hash: sha256(stderr ?? ""),
      output_hash: outputHash,
      stdout_preview: (stdout ?? "").slice(0, 1000),
      stderr_preview: (stderr ?? "").slice(0, 1000),
    },
    policy: {
      output_trust: adapter.output_contract?.output_trust,
      verification_required: adapter.verification?.verification_required ?? false,
      required_gates: adapter.verification?.required_gates ?? [],
    },
    started_at: startedAt,
    completed_at: completedAt,
    exit_code: exitCode,
    blocked_reason: blockedReason,
    metadata: metadata ?? {},
  };
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn(command.command, command.args ?? [], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({
        exit_code: 124,
        stdout: stdout.slice(0, 8000),
        stderr: stderr.slice(0, 8000),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({
        exit_code: code ?? 1,
        stdout: stdout.slice(0, 8000),
        stderr: stderr.slice(0, 8000),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exit_code: 127,
        stdout: stdout.slice(0, 8000),
        stderr: String(error.message ?? error).slice(0, 8000),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    });
  });
}

function normalizeCommand(command) {
  if (!command) return null;
  if (typeof command === "string") return { command, args: [] };
  return {
    command: command.command,
    args: command.args ?? [],
  };
}

function commandExists(command) {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-lc", `command -v ${shellQuote(command)}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      resolve(code === 0 ? stdout.trim().split("\n")[0] : null);
    });
    child.on("error", () => resolve(null));
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function parseArgs(argv) {
  const parsed = {
    runtimeId: "codex",
    mode: "dry-run",
    prompt: "",
    outDir: DEFAULT_RUNTIME_INVOCATION_OUT_DIR,
    adapterRegistryPath: DEFAULT_RUNTIME_ADAPTER_REGISTRY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--runtime") parsed.runtimeId = argv[++index];
    else if (arg === "--mode") parsed.mode = argv[++index];
    else if (arg === "--prompt") parsed.prompt = argv[++index];
    else if (arg === "--prompt-file") parsed.promptFile = argv[++index];
    else if (arg === "--workspace-manifest") parsed.workspaceManifestPath = argv[++index];
    else if (arg === "--adapter-registry") parsed.adapterRegistryPath = argv[++index];
    else if (arg === "--command-binding-registry") parsed.commandBindingPath = argv[++index];
    else if (arg === "--no-auto-command") parsed.noAutoCommand = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--command") {
      parsed.command = {
        command: argv[++index],
        args: [],
      };
    } else if (arg === "--") {
      const rest = argv.slice(index + 1);
      if (rest.length > 0) {
        parsed.command = {
          command: rest[0],
          args: rest.slice(1),
        };
      }
      break;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-invoker.mjs [options] [-- command args...]

Options:
  --runtime <id>              Runtime ID. Defaults to codex.
  --mode <dry-run|execute>    Invocation mode. Defaults to dry-run.
  --prompt <text>             Prompt text.
  --prompt-file <path>        Prompt file path.
  --workspace-manifest <path> Workspace manifest JSON.
  --adapter-registry <path>   Runtime adapter registry JSON.
  --command-binding-registry <path>
                              Runtime command binding registry JSON.
  --no-auto-command           Do not resolve a default command binding.
  --out-dir <path>            Output directory.
  --command <command>         Command for execute mode. Args can be passed after --.
  -h, --help                  Show this help.
`);
}

function parseBindingArgs(argv) {
  const parsed = {
    outDir: DEFAULT_RUNTIME_INVOCATION_OUT_DIR,
    commandBindingPath: DEFAULT_RUNTIME_COMMAND_BINDINGS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--command-binding-registry") parsed.commandBindingPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printBindingHelp() {
  console.log(`Usage: node scripts/runtime-bindings.mjs [options]

Options:
  --command-binding-registry <path>
                              Runtime command binding registry JSON.
  --out-dir <path>            Output directory.
  -h, --help                  Show this help.
`);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function isoAt(baseIso, seconds) {
  return new Date(new Date(baseIso).getTime() + seconds * 1000).toISOString();
}
