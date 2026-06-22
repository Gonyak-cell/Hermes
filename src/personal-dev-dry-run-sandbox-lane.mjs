import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildAgentBridgeLimitedRuntimePlan } from "./agent-bridge-limited-runtime-plan.mjs";
import { buildPersonalDevExecutionCandidateLane } from "./personal-dev-execution-candidate-lane.mjs";
import { invokeRuntimeAdapters } from "./runtime-invoker.mjs";

export const DEFAULT_PERSONAL_DEV_DRY_RUN_SANDBOX_LANE_OUT_DIR = "artifacts/personal-dev-dry-run-sandbox-lane/latest";
export const DEFAULT_PERSONAL_DEV_DRY_RUN_SANDBOX_LANE_INPUTS = {
  schemaPath: "schemas/personal-dev-dry-run-sandbox-lane.schema.json",
};

const SCHEMA_VERSION = "personal-dev-dry-run-sandbox-lane.v1";
const READY_STATUS = "ready_for_personal_dev_dry_run_sandbox_lane";
const BLOCKED_STATUS = "blocked_personal_dev_dry_run_sandbox_lane";
const CAPABILITY_ID = "personal_dev.dry_run_sandbox_lane";
const PROJECT_ID = "project.personal_dev_fixture";
const PRODUCT_ID = "product.hermes_harness";
const DOMAIN_PACK_ID = "personal-dev";
const ROUTE_PATH = "/api/execution/personal-dev-dry-runs";

const DRY_RUN_COMMANDS = {
  repo: ["git", ["status", "--short"]],
  worktree: ["git", ["worktree", "add", "--detach", "<planned-worktree>", "<base-ref>"]],
  plan: ["npm", ["run", "dev:brief"]],
  diff: ["git", ["diff", "--stat"]],
  test: ["node", ["--test", "test/personal-dev-execution-candidate-lane.test.mjs"]],
  pr: ["gh", ["pr", "create", "--draft", "--fill"]],
};

export async function runPersonalDevDryRunSandboxLane(options = {}) {
  const result = await buildPersonalDevDryRunSandboxLane(options);
  if (options.write !== false) await writePersonalDevDryRunSandboxLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal-dev dry-run sandbox lane validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevDryRunSandboxLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_DRY_RUN_SANDBOX_LANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const candidateLane = await resolvePersonalDevExecutionCandidateLaneSource(options);
  const limitedRuntimePlan = await resolveAgentBridgeLimitedRuntimePlanSource(options);
  const candidateRows = candidateLane.data?.personal_dev_execution_candidate_rows ?? [];
  const sandboxRows = buildDryRunSandboxRows({ candidateRows, generatedAt });
  const invocationLedger = await buildDryRunInvocationLedger({ sandboxRows, generatedAt });
  const invocationRows = buildDryRunInvocationRows({ sandboxRows, invocationLedger, generatedAt });
  const routeRows = buildRouteRows({ sandboxRows, generatedAt });
  const boundary = buildBoundary({
    candidateLane,
    limitedRuntimePlan,
    sandboxRows,
    invocationRows,
    routeRows,
    generatedAt,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    output_dir: outputDir,
    product_id: PRODUCT_ID,
    project_id: PROJECT_ID,
    domain_pack_id: DOMAIN_PACK_ID,
    capability_id: CAPABILITY_ID,
    inputs,
    source_refs: {
      personal_dev_execution_candidate_lane: candidateLane.path,
      agent_bridge_limited_runtime_plan: limitedRuntimePlan.path,
    },
    source_personal_dev_execution_candidate_lane_summary: candidateLane.data?.summary ?? null,
    source_agent_bridge_limited_runtime_plan_summary: limitedRuntimePlan.data?.summary ?? null,
    personal_dev_dry_run_sandbox_contract: buildContract(generatedAt),
    personal_dev_dry_run_sandbox_rows: sandboxRows,
    personal_dev_dry_run_invocation_rows: invocationRows,
    personal_dev_dry_run_route_rows: routeRows,
    personal_dev_dry_run_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validationItems = validateDryRunSandboxLane(result, schema.available ? schema.data : null);
  result.validation_items = validationItems;
  result.validation = summarizeValidation(validationItems);
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePersonalDevDryRunSandboxLane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "personal-dev-dry-run-sandbox-lane.json"), serializable);
  await writeJson(path.join(outDir, "dry-run-sandbox-rows.json"), collectionEnvelope("personal-dev-dry-run-sandbox-rows.v1", "personal_dev_dry_run_sandbox_rows", result.personal_dev_dry_run_sandbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "dry-run-invocation-rows.json"), collectionEnvelope("personal-dev-dry-run-invocation-rows.v1", "personal_dev_dry_run_invocation_rows", result.personal_dev_dry_run_invocation_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-rows.json"), collectionEnvelope("personal-dev-dry-run-route-rows.v1", "personal_dev_dry_run_route_rows", result.personal_dev_dry_run_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.personal_dev_dry_run_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-dry-run-sandbox-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPersonalDevDryRunSandboxLaneCli(argv = process.argv.slice(2)) {
  try {
    const args = parsePersonalDevDryRunSandboxLaneArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runPersonalDevDryRunSandboxLane(args);
    console.log(`Personal-dev dry-run sandbox lane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_dev_dry_run_sandbox_lane_status}`);
    console.log(`Dry-run rows: ${result.summary.ready_dry_run_row_count}/${result.summary.dry_run_row_count}`);
    console.log(`Invocation rows: ${result.summary.planned_invocation_row_count}/${result.summary.invocation_row_count}`);
    console.log(`Ready for L2 handoff: ${result.summary.ready_for_l2_handoff}`);
    console.log(`Actual command executed now: ${result.summary.actual_command_executed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

export function parsePersonalDevDryRunSandboxLaneArgs(argv = process.argv.slice(2)) {
  const parsed = { outDir: DEFAULT_PERSONAL_DEV_DRY_RUN_SANDBOX_LANE_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--require-pass") {
      parsed.requirePass = true;
    } else if (arg === "--out-dir") {
      parsed.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      parsed.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--run-at") {
      parsed.runAt = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--repo-root") {
      parsed.repoRoot = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function buildContract(generatedAt) {
  return {
    schema_version: "personal-dev-dry-run-sandbox-contract.v1",
    contract_id: "personal-dev-dry-run-sandbox-lane.contract.v1",
    generated_at: generatedAt,
    product_id: PRODUCT_ID,
    project_id: PROJECT_ID,
    domain_pack_id: DOMAIN_PACK_ID,
    capability_id: CAPABILITY_ID,
    source_personal_dev_execution_candidate_lane_required: true,
    source_agent_bridge_limited_runtime_plan_required: true,
    dry_run_projection_required: true,
    runtime_invocation_ledger_mode: "dry-run",
    runtime_invocation_ledger_projected_now: true,
    sandbox_manifest_projected_now: true,
    worktree_created_now: false,
    command_invocation_created_now: false,
    actual_command_executed_now: false,
    file_write_allowed_now: false,
    patch_applied_now: false,
    pull_request_creation_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildDryRunSandboxRows({ candidateRows, generatedAt }) {
  return candidateRows.map((candidate) => {
    const section = candidate.source_panel_section;
    const [command, args] = DRY_RUN_COMMANDS[section] ?? ["node", ["--version"]];
    const sourceReady = candidate.candidate_status === "ready" &&
      candidate.read_only === true &&
      candidate.command_execution_allowed_now === false &&
      candidate.file_write_allowed_now === false;
    const row = {
      schema_version: "personal-dev-dry-run-sandbox-row.v1",
      generated_at: generatedAt,
      dry_run_id: `personal-dev.dry-run.${section}`,
      candidate_id: candidate.candidate_id,
      candidate_kind: candidate.candidate_kind,
      source_panel_section: section,
      product_id: PRODUCT_ID,
      project_id: PROJECT_ID,
      domain_pack_id: DOMAIN_PACK_ID,
      execution_request_id: `er_personal_dev_${section}_dry_run`,
      sandbox_session_id: `ss_personal_dev_${section}_dry_run`,
      command_invocation_id: `ci_personal_dev_${section}_dry_run`,
      planned_runtime_id: "codex",
      dry_run_mode: "dry-run",
      dry_run_status: sourceReady ? "ready" : "blocked",
      blocker_reason: sourceReady ? null : "source_execution_candidate_not_ready",
      intended_command: command,
      intended_args: args,
      intended_command_display: [command, ...args].join(" "),
      printed_intended_command: `DRY RUN ONLY: ${[command, ...args].join(" ")}`,
      requested_isolation: "git_worktree",
      planned_worktree_id: `wt_personal_dev_${section}_dry_run`,
      planned_worktree_path_hint: `artifacts/worktrees/personal-dev/${section}`,
      actual_isolation: "not_created",
      base_repo_id: "repo.hermes",
      base_commit_hash: "not_resolved_in_dry_run",
      allowlist_status: "dry_run_projection_only",
      human_review_required: true,
      read_only: true,
      sandbox_manifest_projected_now: true,
      dry_run_invocation_projected_now: true,
      runtime_invocation_ledger_projected_now: true,
      execution_request_created_now: false,
      sandbox_session_created_now: false,
      command_invocation_created_now: false,
      execution_receipt_created_now: false,
      worktree_created_now: false,
      branch_created_now: false,
      actual_command_executed_now: false,
      command_output_captured_now: false,
      patch_generated_now: false,
      patch_applied_now: false,
      file_write_allowed_now: false,
      command_execution_allowed_now: false,
      git_command_allowed_now: false,
      github_api_allowed_now: false,
      pull_request_creation_allowed_now: false,
      merge_allowed_now: false,
      release_allowed_now: false,
      deployment_allowed_now: false,
      network_allowed_now: false,
      secret_allowed_now: false,
      raw_stdout_stored: false,
      raw_stderr_stored: false,
    };
    return {
      ...row,
      dry_run_hash: hashValue(row),
    };
  });
}

async function buildDryRunInvocationLedger({ sandboxRows, generatedAt }) {
  return invokeRuntimeAdapters({
    runAt: generatedAt,
    mode: "dry-run",
    workspaceManifest: {
      requested_isolation: "git_worktree",
      actual_isolation: "not_created",
      workspace_path: null,
      branch_name: null,
    },
    invocations: sandboxRows.map((row) => ({
      runtimeId: row.planned_runtime_id,
      autoCommand: false,
      prompt: [
        `Personal-dev dry-run candidate: ${row.candidate_id}`,
        `Intended command: ${row.intended_command_display}`,
        "Do not execute. Project the sandbox and command receipt shape only.",
      ].join("\n"),
      metadata: {
        dry_run_id: row.dry_run_id,
        candidate_id: row.candidate_id,
        source_panel_section: row.source_panel_section,
      },
    })),
    metadata: {
      capability_id: CAPABILITY_ID,
      dry_run_projection_only: true,
    },
  });
}

function buildDryRunInvocationRows({ sandboxRows, invocationLedger, generatedAt }) {
  const sandboxById = new Map(sandboxRows.map((row) => [row.dry_run_id, row]));
  return (invocationLedger.invocations ?? []).map((invocation) => {
    const dryRunId = invocation.metadata?.dry_run_id;
    const sandbox = sandboxById.get(dryRunId);
    const ready = sandbox?.dry_run_status === "ready" && invocation.mode === "dry-run" && invocation.status === "planned";
    const row = {
      schema_version: "personal-dev-dry-run-invocation-row.v1",
      generated_at: generatedAt,
      invocation_row_id: `personal-dev.dry-run-invocation.${sandbox?.source_panel_section ?? "unknown"}`,
      dry_run_id: dryRunId ?? null,
      candidate_id: sandbox?.candidate_id ?? null,
      runtime_invocation_id: invocation.id,
      runtime_id: invocation.runtime_id,
      adapter_id: invocation.adapter_id,
      mode: invocation.mode,
      invocation_status: ready ? "planned" : "blocked",
      blocker_reason: ready ? null : "dry_run_invocation_not_planned",
      prompt_hash: invocation.input?.prompt_hash ?? null,
      stdout_hash: invocation.output?.stdout_hash ?? null,
      stderr_hash: invocation.output?.stderr_hash ?? null,
      output_hash: invocation.output?.output_hash ?? null,
      output_preview: invocation.output?.stdout_preview ?? "",
      command_bound: invocation.command !== null,
      binding_status: invocation.binding?.status ?? "unknown",
      read_only: true,
      runtime_invocation_ledger_projected_now: true,
      actual_runtime_called_now: false,
      command_invocation_created_now: false,
      actual_command_executed_now: false,
      command_output_captured_now: false,
      raw_stdout_stored: false,
      raw_stderr_stored: false,
      file_write_allowed_now: false,
      network_allowed_now: false,
      secret_allowed_now: false,
    };
    return {
      ...row,
      invocation_hash: hashValue(row),
    };
  });
}

function buildRouteRows({ sandboxRows, generatedAt }) {
  const ready = sandboxRows.length > 0 && sandboxRows.every((row) => row.dry_run_status === "ready");
  const row = {
    schema_version: "personal-dev-dry-run-route-row.v1",
    generated_at: generatedAt,
    route_id: "route.execution.personal_dev_dry_runs",
    path: ROUTE_PATH,
    method_policy: "GET_HEAD_ONLY",
    collection: "personal_dev_dry_run_sandbox_rows",
    ready,
    missing_source_creates_blocker: true,
    route_invokes_runtime: false,
    route_writes_ledger: false,
    route_executes_command: false,
    route_creates_worktree: false,
    route_applies_patch: false,
    route_creates_pull_request: false,
    route_deploys: false,
    raw_secret_fields_serialized: false,
    raw_client_material_serialized: false,
    raw_command_output_serialized: false,
    source_binding_hash: hashValue(sandboxRows.map((row) => [row.dry_run_id, row.dry_run_status, row.intended_command_display])),
  };
  return [row];
}

function buildBoundary({ candidateLane, limitedRuntimePlan, sandboxRows, invocationRows, routeRows, generatedAt }) {
  const candidateLaneReady = candidateLane.available === true &&
    candidateLane.validation_valid === true &&
    candidateLane.data?.summary?.personal_dev_execution_candidate_lane_status === "ready_for_personal_dev_execution_candidate_lane";
  const limitedRuntimePlanReady = limitedRuntimePlan.available === true &&
    limitedRuntimePlan.validation_valid === true &&
    limitedRuntimePlan.data?.summary?.agent_bridge_limited_runtime_plan_status === "ready_for_agent_bridge_limited_runtime_plan" &&
    limitedRuntimePlan.data?.summary?.execution_allowed_now === false &&
    limitedRuntimePlan.data?.summary?.command_executed_now === false;
  const sandboxRowsReady = sandboxRows.length > 0 && sandboxRows.every((row) => row.dry_run_status === "ready");
  const invocationRowsReady = invocationRows.length === sandboxRows.length && invocationRows.every((row) => row.invocation_status === "planned" && row.actual_runtime_called_now === false && row.actual_command_executed_now === false);
  const routesReady = routeRows.every((row) => row.method_policy === "GET_HEAD_ONLY" && row.route_invokes_runtime === false && row.route_writes_ledger === false && row.route_executes_command === false);
  const readyForL2 = candidateLaneReady && limitedRuntimePlanReady && sandboxRowsReady && invocationRowsReady && routesReady;
  return {
    schema_version: "personal-dev-dry-run-boundary.v1",
    generated_at: generatedAt,
    source_personal_dev_execution_candidate_lane_available: candidateLane.available === true,
    source_personal_dev_execution_candidate_lane_ready: candidateLaneReady,
    source_agent_bridge_limited_runtime_plan_available: limitedRuntimePlan.available === true,
    source_agent_bridge_limited_runtime_plan_ready: limitedRuntimePlanReady,
    dry_run_sandbox_rows_ready: sandboxRowsReady,
    dry_run_invocation_rows_ready: invocationRowsReady,
    route_rows_ready: routesReady,
    ready_for_l2_handoff: readyForL2,
    l2_blocker_resolved_now: readyForL2,
    read_only: true,
    get_head_only: true,
    sandbox_manifest_projected_now: true,
    dry_run_invocation_projected_now: true,
    runtime_invocation_ledger_projected_now: true,
    execution_request_created_now: false,
    sandbox_session_created_now: false,
    command_invocation_created_now: false,
    execution_receipt_created_now: false,
    worktree_created_now: false,
    branch_created_now: false,
    actual_runtime_called_now: false,
    actual_command_executed_now: false,
    command_output_captured_now: false,
    patch_generated_now: false,
    patch_applied_now: false,
    execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    command_execution_allowed_now: false,
    file_write_allowed_now: false,
    task_state_write_allowed_now: false,
    issue_mutation_allowed_now: false,
    git_command_allowed_now: false,
    github_api_allowed_now: false,
    branch_push_allowed_now: false,
    pull_request_creation_allowed_now: false,
    merge_allowed_now: false,
    release_allowed_now: false,
    deployment_allowed_now: false,
    production_allowed_now: false,
    protected_output_allowed_now: false,
    connector_write_allowed_now: false,
    desktop_shell_execution_allowed_now: false,
    network_allowed_now: false,
    raw_secret_access_allowed_now: false,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    claude_final_approval_allowed_now: false,
    owner_approval_counts_as_independent_review: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    unsafe_flag_count: 0,
  };
}

function validateDryRunSandboxLane(result, schema) {
  const boundary = result.personal_dev_dry_run_boundary;
  const sandboxRows = result.personal_dev_dry_run_sandbox_rows;
  const invocationRows = result.personal_dev_dry_run_invocation_rows;
  const routeRows = result.personal_dev_dry_run_route_rows;
  const items = [
    validationItem("sources.personal_dev_execution_candidate_lane", boundary.source_personal_dev_execution_candidate_lane_ready, "Personal-dev execution candidate lane source must be ready.", "source_personal_dev_execution_candidate_lane_summary"),
    validationItem("sources.agent_bridge_limited_runtime_plan", boundary.source_agent_bridge_limited_runtime_plan_ready, "Agent Bridge limited runtime plan source must be ready and non-executing.", "source_agent_bridge_limited_runtime_plan_summary"),
    validationItem("dry_runs.present", sandboxRows.length >= 6, "All personal-dev candidate dry-run sandbox rows must be present.", "personal_dev_dry_run_sandbox_rows"),
    validationItem("dry_runs.ready", sandboxRows.every((row) => row.dry_run_status === "ready"), "All dry-run sandbox rows must be ready.", "personal_dev_dry_run_sandbox_rows"),
    validationItem("invocations.planned", invocationRows.length === sandboxRows.length && invocationRows.every((row) => row.mode === "dry-run" && row.invocation_status === "planned"), "Dry-run invocation ledger rows must be planned.", "personal_dev_dry_run_invocation_rows"),
    validationItem("invocations.no_command", invocationRows.every((row) => row.actual_runtime_called_now === false && row.actual_command_executed_now === false && row.command_output_captured_now === false), "Dry-run invocation rows must not call runtimes or execute commands.", "personal_dev_dry_run_invocation_rows"),
    validationItem("routes.read_only", routeRows.every((row) => row.method_policy === "GET_HEAD_ONLY" && row.route_invokes_runtime === false && row.route_writes_ledger === false && row.route_executes_command === false), "Dry-run routes must be read-only.", "personal_dev_dry_run_route_rows"),
    validationItem("boundary.closed", boundaryClosed(boundary), "Dry-run sandbox lane must not open runtime, command, file, PR, deploy, production, protected, connector, desktop, secret, raw output, or final approval authority.", "personal_dev_dry_run_boundary"),
  ];
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "personal_dev_dry_run_sandbox_lane")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  return [...items, ...schemaItems];
}

function buildSummary(result) {
  const sandboxRows = result.personal_dev_dry_run_sandbox_rows;
  const invocationRows = result.personal_dev_dry_run_invocation_rows;
  const boundary = result.personal_dev_dry_run_boundary;
  return {
    personal_dev_dry_run_sandbox_lane_status: result.validation.valid && boundary.ready_for_l2_handoff ? READY_STATUS : BLOCKED_STATUS,
    product_id: PRODUCT_ID,
    project_id: PROJECT_ID,
    domain_pack_id: DOMAIN_PACK_ID,
    capability_id: CAPABILITY_ID,
    dry_run_row_count: sandboxRows.length,
    ready_dry_run_row_count: sandboxRows.filter((row) => row.dry_run_status === "ready").length,
    blocked_dry_run_row_count: sandboxRows.filter((row) => row.dry_run_status === "blocked").length,
    invocation_row_count: invocationRows.length,
    planned_invocation_row_count: invocationRows.filter((row) => row.invocation_status === "planned").length,
    route_count: result.personal_dev_dry_run_route_rows.length,
    route_path: ROUTE_PATH,
    ready_for_l2_handoff: boundary.ready_for_l2_handoff,
    l2_blocker_resolved_now: boundary.l2_blocker_resolved_now,
    read_only: boundary.read_only,
    get_head_only: boundary.get_head_only,
    sandbox_manifest_projected_now: boundary.sandbox_manifest_projected_now,
    dry_run_invocation_projected_now: boundary.dry_run_invocation_projected_now,
    runtime_invocation_ledger_projected_now: boundary.runtime_invocation_ledger_projected_now,
    execution_request_created_now: boundary.execution_request_created_now,
    sandbox_session_created_now: boundary.sandbox_session_created_now,
    command_invocation_created_now: boundary.command_invocation_created_now,
    execution_receipt_created_now: boundary.execution_receipt_created_now,
    worktree_created_now: boundary.worktree_created_now,
    actual_runtime_called_now: boundary.actual_runtime_called_now,
    actual_command_executed_now: boundary.actual_command_executed_now,
    command_output_captured_now: boundary.command_output_captured_now,
    execution_allowed_now: boundary.execution_allowed_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    command_execution_allowed_now: boundary.command_execution_allowed_now,
    file_write_allowed_now: boundary.file_write_allowed_now,
    pull_request_creation_allowed_now: boundary.pull_request_creation_allowed_now,
    merge_allowed_now: boundary.merge_allowed_now,
    release_allowed_now: boundary.release_allowed_now,
    deployment_allowed_now: boundary.deployment_allowed_now,
    production_allowed_now: boundary.production_allowed_now,
    protected_output_allowed_now: boundary.protected_output_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    desktop_shell_execution_allowed_now: boundary.desktop_shell_execution_allowed_now,
    raw_secret_access_allowed_now: boundary.raw_secret_access_allowed_now,
    raw_stdout_stored: boundary.raw_stdout_stored,
    raw_stderr_stored: boundary.raw_stderr_stored,
    owner_approval_counts_as_independent_review: boundary.owner_approval_counts_as_independent_review,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    validation_error_count: result.validation.errors.length,
  };
}

function renderMarkdown(result) {
  const rows = result.personal_dev_dry_run_sandbox_rows
    .map((row) => `| ${row.source_panel_section} | ${row.dry_run_status} | ${row.requested_isolation} | ${row.actual_isolation} | ${row.printed_intended_command} |`)
    .join("\n");
  return [
    "# Personal-Dev Dry-Run Sandbox Lane",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.summary.personal_dev_dry_run_sandbox_lane_status}`,
    `Ready for L2 handoff: ${result.summary.ready_for_l2_handoff}`,
    "",
    "| Section | Status | Requested Isolation | Actual Isolation | Printed Command |",
    "|---|---|---|---|---|",
    rows,
    "",
    "## Boundary",
    "",
    `GET/HEAD only: ${result.summary.get_head_only}`,
    `Sandbox manifest projected now: ${result.summary.sandbox_manifest_projected_now}`,
    `Dry-run invocation projected now: ${result.summary.dry_run_invocation_projected_now}`,
    `Runtime invocation ledger projected now: ${result.summary.runtime_invocation_ledger_projected_now}`,
    `Worktree created now: ${result.summary.worktree_created_now}`,
    `Actual runtime called now: ${result.summary.actual_runtime_called_now}`,
    `Actual command executed now: ${result.summary.actual_command_executed_now}`,
    `Command output captured now: ${result.summary.command_output_captured_now}`,
    `File write allowed now: ${result.summary.file_write_allowed_now}`,
    `PR creation allowed now: ${result.summary.pull_request_creation_allowed_now}`,
    `Deployment allowed now: ${result.summary.deployment_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "Human review note: this lane projects dry-run sandbox and invocation shapes only. It does not create worktrees, execute commands, persist raw output, write files, create PRs, merge, release, deploy, or grant final trust.",
    "",
  ].join("\n");
}

async function resolvePersonalDevExecutionCandidateLaneSource(options) {
  if (Object.prototype.hasOwnProperty.call(options, "personalDevExecutionCandidateLane")) {
    return normalizeInlineSource("inline.personal_dev_execution_candidate_lane", options.personalDevExecutionCandidateLane);
  }
  return captureSource("builder.personal_dev_execution_candidate_lane", () => buildPersonalDevExecutionCandidateLane({ ...options, write: false }));
}

async function resolveAgentBridgeLimitedRuntimePlanSource(options) {
  if (Object.prototype.hasOwnProperty.call(options, "agentBridgeLimitedRuntimePlan")) {
    return normalizeInlineSource("inline.agent_bridge_limited_runtime_plan", options.agentBridgeLimitedRuntimePlan);
  }
  return captureSource("builder.agent_bridge_limited_runtime_plan", () => buildAgentBridgeLimitedRuntimePlan({ ...options, write: false }));
}

async function captureSource(sourcePath, builder) {
  try {
    const data = await builder();
    return {
      path: sourcePath,
      available: true,
      validation_valid: data.validation?.valid !== false,
      data: stripTransient(data),
    };
  } catch (error) {
    return {
      path: sourcePath,
      available: false,
      validation_valid: false,
      error: error.message,
      data: null,
    };
  }
}

function normalizeInlineSource(sourcePath, data) {
  return {
    path: sourcePath,
    available: Boolean(data),
    validation_valid: data?.validation?.valid !== false,
    data: data ? stripTransient(data) : null,
  };
}

function stripTransient(data) {
  if (!data || typeof data !== "object") return data;
  const clone = { ...data };
  delete clone.markdown;
  delete clone.html;
  return clone;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_PERSONAL_DEV_DRY_RUN_SANDBOX_LANE_INPUTS.schemaPath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, error: error.message };
  }
}

function validationItem(itemId, passed, message, pathRef) {
  return {
    item_id: itemId,
    passed,
    message: passed ? "pass" : message,
    path: pathRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function boundaryClosed(boundary) {
  const falseKeys = [
    "execution_request_created_now",
    "sandbox_session_created_now",
    "command_invocation_created_now",
    "execution_receipt_created_now",
    "worktree_created_now",
    "branch_created_now",
    "actual_runtime_called_now",
    "actual_command_executed_now",
    "command_output_captured_now",
    "patch_generated_now",
    "patch_applied_now",
    "execution_allowed_now",
    "runtime_execution_allowed_now",
    "command_execution_allowed_now",
    "file_write_allowed_now",
    "task_state_write_allowed_now",
    "issue_mutation_allowed_now",
    "git_command_allowed_now",
    "github_api_allowed_now",
    "branch_push_allowed_now",
    "pull_request_creation_allowed_now",
    "merge_allowed_now",
    "release_allowed_now",
    "deployment_allowed_now",
    "production_allowed_now",
    "protected_output_allowed_now",
    "connector_write_allowed_now",
    "desktop_shell_execution_allowed_now",
    "network_allowed_now",
    "raw_secret_access_allowed_now",
    "raw_stdout_stored",
    "raw_stderr_stored",
    "final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "claude_final_approval_allowed_now",
    "owner_approval_counts_as_independent_review",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ];
  return boundary.read_only === true &&
    boundary.get_head_only === true &&
    falseKeys.every((key) => boundary[key] === false) &&
    boundary.unsafe_flag_count === 0;
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/personal-dev-dry-run-sandbox-lane.mjs [--check] [--out-dir path] [--schema-path path] [--run-at iso]

Builds the personal-dev L2 dry-run sandbox projection. It does not create worktrees,
execute commands, write source files, persist raw command output, create PRs, or deploy.`);
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
