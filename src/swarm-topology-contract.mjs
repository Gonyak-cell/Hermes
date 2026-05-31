import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SWARM_TOPOLOGY_OUT_DIR = "artifacts/swarm-topology/latest";
export const DEFAULT_SWARM_TOPOLOGY_INPUTS = {
  workflowRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workPacketsPath: "artifacts/control-plane-work-packets/latest/control-plane-work-packets.json",
  packagePath: "package.json",
};

export async function runSwarmTopologyContract(options = {}) {
  const result = await buildSwarmTopologyContract(options);
  if (options.write !== false) await writeSwarmTopologyContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Swarm topology validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSwarmTopologyContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SWARM_TOPOLOGY_OUT_DIR);
  const inputs = {
    workflow_runner_path: path.resolve(options.workflowRunnerPath ?? DEFAULT_SWARM_TOPOLOGY_INPUTS.workflowRunnerPath),
    work_packets_path: path.resolve(options.workPacketsPath ?? DEFAULT_SWARM_TOPOLOGY_INPUTS.workPacketsPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_SWARM_TOPOLOGY_INPUTS.packagePath),
  };
  const workflowRunner = await readJsonOrEmpty(inputs.workflow_runner_path);
  const workPackets = await readJsonOrEmpty(inputs.work_packets_path);
  const packageJson = await readJsonOrEmpty(inputs.package_path);
  const topologies = buildTopologies({ workflowRunner, workPackets, generatedAt });
  const projections = topologies.map((topology) => buildCommandProjection(topology, generatedAt));
  const validationItems = validateSwarmTopology({ topologies, projections, packageJson });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "swarm-topology-contract.v1",
    generated_at: generatedAt,
    swarm_topology_contract_id: `swarm-topology.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    topology_policy: {
      protected_action_execution_allowed: false,
      runtime_execution_default_mode: "dry-run",
      worker_execution_performed: false,
      verifier_required: true,
      synthesizer_required: true,
      human_review_gate_required: true,
      gate_engine_replaced: false,
      workflow_runner_replaced: false,
    },
    swarm_topologies: topologies,
    hermes_swarm_command_projections: projections,
    validation_items: validationItems,
    validation,
    summary: {
      swarm_topology_status: validation.valid ? "complete" : "blocked",
      topology_count: topologies.length,
      command_projection_count: projections.length,
      worker_execution_performed_count: topologies.filter((item) => item.worker_execution_performed).length,
      protected_action_execution_allowed_count: topologies.filter((item) => item.protected_action_execution_allowed).length,
      validation_error_count: validation.errors.length,
    },
  };
  return {
    ...result,
    markdown: renderSwarmTopologyMarkdown(result),
  };
}

export async function writeSwarmTopologyContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "swarm-topology-contract.json"), serializable(result));
  await writeJson(path.join(outDir, "swarm-topologies.json"), {
    schema_version: "swarm-topologies.v1",
    generated_at: result.generated_at,
    topology_count: result.swarm_topologies.length,
    swarm_topologies: result.swarm_topologies,
  });
  await writeJson(path.join(outDir, "hermes-swarm-command-projections.json"), {
    schema_version: "hermes-swarm-command-projections.v1",
    generated_at: result.generated_at,
    projection_count: result.hermes_swarm_command_projections.length,
    hermes_swarm_command_projections: result.hermes_swarm_command_projections,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "swarm-topology-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildTopologies({ workflowRunner, workPackets, generatedAt }) {
  const plans = workflowRunner.workflow_runner_plans ?? workflowRunner.workflow_state_machine_runner?.workflow_runner_plans ?? [];
  const packetItems = workPackets.work_items ?? [];
  const candidates = [
    ...plans.filter((plan) => isSwarmCandidate(plan)),
    ...packetItems.filter((item) => isSwarmCandidate(item)).map((item) => ({
      workflow_runner_plan_id: item.work_item_id,
      workflow_run_id: item.work_item_id,
      workflow_id: item.source_stage,
      capability_id: item.title,
      domain_pack: inferDomainPack(item.title),
      runner_plan_status: item.status === "ready_to_run" ? "ready" : item.status,
      next_action: "prepare_swarm_topology",
    })),
  ];
  return candidates.map((candidate, index) => {
    const topologyId = `swarm-topology.${sanitizeId(candidate.workflow_run_id ?? index)}`;
    return {
      schema_version: "swarm-topology.v1",
      swarm_topology_id: topologyId,
      generated_at: generatedAt,
      source_runner_plan_id: candidate.workflow_runner_plan_id ?? null,
      workflow_run_id: candidate.workflow_run_id ?? null,
      workflow_id: candidate.workflow_id ?? null,
      capability_id: candidate.capability_id ?? null,
      domain_pack: candidate.domain_pack ?? inferDomainPack(candidate.capability_id),
      root_task: candidate.capability_id ?? candidate.workflow_id ?? "document_batch_review",
      workers: [
        worker("inventory", ["resource_inventory", "document_index"]),
        worker("fact_extraction", ["facts", "source_spans"]),
        worker("issue_detection", ["issues", "risk_signals"]),
      ],
      verifier: {
        agent_id: `${topologyId}.verifier`,
        required: true,
        gate_id: "evidence_coverage_gate",
        waits_for_workers: true,
      },
      synthesizer: {
        agent_id: `${topologyId}.synthesizer`,
        required: true,
        output_status: "pending_review",
        waits_for_verifier: true,
      },
      shared_blackboard_path: `artifacts/swarm-topology/blackboard/${sanitizeId(candidate.workflow_run_id ?? topologyId)}.json`,
      matter_scope: "preserve_source_matter_scope",
      document_scope: "preserve_source_document_scope",
      max_concurrency: 3,
      claim_ttl_seconds: 900,
      retry_policy: {
        max_attempts: 1,
        retry_requires_human_review: true,
      },
      stale_detection_policy: {
        stale_after_seconds: 1800,
        stale_resolution: "human_review",
      },
      human_review_gate: {
        required: true,
        gate_id: "human_approval_gate",
      },
      protected_action_execution_allowed: false,
      worker_execution_performed: false,
      runtime_projection_only: true,
    };
  }).sort((left, right) => left.swarm_topology_id.localeCompare(right.swarm_topology_id));
}

function buildCommandProjection(topology, generatedAt) {
  return {
    schema_version: "hermes-swarm-command-projection.v1",
    projection_id: `hermes-swarm-command.${sanitizeId(topology.swarm_topology_id)}`,
    generated_at: generatedAt,
    runtime_id: "hermes",
    mode: "dry-run",
    command: {
      command: "hermes",
      args: [
        "kanban",
        "swarm",
        "--topology",
        topology.swarm_topology_id,
        "--blackboard",
        topology.shared_blackboard_path,
        "--dry-run",
      ],
    },
    source_topology_id: topology.swarm_topology_id,
    worker_execution_performed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    output_status: "pending_review",
  };
}

function validateSwarmTopology({ topologies, projections, packageJson }) {
  const items = [];
  pushCheck(items, "package", "script_registered", Boolean(packageJson.scripts?.["workflows:swarm-topology"]), "package.json must expose workflows:swarm-topology.");
  pushCheck(items, "topologies", "all_projection_only", topologies.every((item) => item.runtime_projection_only && item.worker_execution_performed === false), "Topologies must be projection-only by default.");
  pushCheck(items, "topologies", "protected_actions_blocked", topologies.every((item) => item.protected_action_execution_allowed === false), "Topologies must not allow protected action execution.");
  pushCheck(items, "topologies", "verifier_synthesizer_required", topologies.every((item) => item.verifier?.required && item.synthesizer?.required), "Verifier and synthesizer must be required.");
  pushCheck(items, "projections", "dry_run_only", projections.every((item) => item.mode === "dry-run" && item.worker_execution_performed === false), "Hermes command projections must be dry-run only.");
  return items;
}

export async function runSwarmTopologyContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSwarmTopologyContract(args);
    console.log(`Swarm topology ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.swarm_topology_status}`);
    console.log(`Topologies: ${result.summary.topology_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function isSwarmCandidate(item = {}) {
  const haystack = `${item.capability_id ?? ""} ${item.workflow_id ?? ""} ${item.domain_pack ?? ""} ${item.title ?? ""} ${item.source_stage ?? ""}`.toLowerCase();
  const ready = ["ready", "ready_to_run", "open"].includes(item.runner_plan_status ?? item.status);
  return ready && /(ldd|document|extract|fact|issue|resource|batch|law_firm|law-firm)/.test(haystack);
}

function worker(name, scope) {
  return {
    agent_id: `worker.${name}`,
    worker_role: name,
    document_scope: scope,
    output_contract: "worker_receipt.v1",
    protected_action_execution_allowed: false,
  };
}

function inferDomainPack(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("law")) return "law-firm";
  if (text.includes("creative")) return "creative-document";
  if (text.includes("personal")) return "personal-dev";
  return "resource-expansion";
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: `${item.path}.${item.check_id}`,
    message: item.message,
  }));
  return { valid: errors.length === 0, errors };
}

function renderSwarmTopologyMarkdown(result) {
  const lines = [];
  lines.push("# Swarm Topology Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.swarm_topology_status}`);
  lines.push("");
  lines.push(`- Topologies: ${result.summary.topology_count}`);
  lines.push(`- Command projections: ${result.summary.command_projection_count}`);
  lines.push(`- Worker executions: ${result.summary.worker_execution_performed_count}`);
  lines.push(`- Protected action allowances: ${result.summary.protected_action_execution_allowed_count}`);
  lines.push("");
  lines.push("Human review note: this stage only projects dry-run Hermes Kanban Swarm topology and does not execute workers.");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_SWARM_TOPOLOGY_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow-runner") parsed.workflowRunnerPath = argv[++index];
    else if (arg === "--work-packets") parsed.workPacketsPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/swarm-topology-contract.mjs [options]

Options:
  --workflow-runner <path>  workflow-state-machine-runner.json path.
  --work-packets <path>     control-plane-work-packets.json path.
  --package <path>          package.json path.
  --out-dir <folder>        Output directory.
  --run-at <iso>            Deterministic generated_at timestamp.
  --check                   Validate only, do not write artifacts.
  --no-write                Build without writing artifacts.
  -h, --help                Show this help.
`);
}

async function readJsonOrEmpty(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializable(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function sanitizeId(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runSwarmTopologyContractCli();
}
