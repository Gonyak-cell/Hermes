import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildExecutionSchemaRegistry } from "./execution-schema-registry.mjs";
import { buildPersonalDevDashboardApi } from "./personal-dev-dashboard-api.mjs";

export const DEFAULT_PERSONAL_DEV_EXECUTION_CANDIDATE_LANE_OUT_DIR = "artifacts/personal-dev-execution-candidate-lane/latest";
export const DEFAULT_PERSONAL_DEV_EXECUTION_CANDIDATE_LANE_INPUTS = {
  schemaPath: "schemas/personal-dev-execution-candidate-lane.schema.json",
};

const SCHEMA_VERSION = "personal-dev-execution-candidate-lane.v1";
const READY_STATUS = "ready_for_personal_dev_execution_candidate_lane";
const BLOCKED_STATUS = "blocked_personal_dev_execution_candidate_lane";
const CAPABILITY_ID = "personal_dev.execution_candidate_lane";
const PROJECT_ID = "project.personal_dev_fixture";
const PRODUCT_ID = "product.hermes_harness";
const DOMAIN_PACK_ID = "personal-dev";
const ROUTE_PATH = "/api/execution/personal-dev-candidates";

const CANDIDATE_SECTION_BINDINGS = [
  {
    panel_section: "repo",
    candidate_kind: "repo_context_candidate",
    required_schema_ids: ["execution_request", "execution_policy", "desktop_execution_projection"],
    label: "Repository context candidate",
    next_action: "bind_repo_profile_to_execution_request_candidate",
  },
  {
    panel_section: "worktree",
    candidate_kind: "worktree_sandbox_candidate",
    required_schema_ids: ["runtime_adapter", "sandbox_session", "command_invocation", "execution_policy"],
    label: "Worktree sandbox candidate",
    next_action: "select_isolated_worktree_sandbox_after_l2_design",
  },
  {
    panel_section: "plan",
    candidate_kind: "plan_scope_candidate",
    required_schema_ids: ["execution_request", "human_review_gate"],
    label: "Plan scope candidate",
    next_action: "bind_selected_plan_scope_to_human_review_gate",
  },
  {
    panel_section: "diff",
    candidate_kind: "diff_artifact_candidate",
    required_schema_ids: ["diff_artifact", "rollback_plan"],
    label: "Diff artifact candidate",
    next_action: "define_non_applied_diff_artifact_and_rollback_binding",
  },
  {
    panel_section: "test",
    candidate_kind: "test_artifact_candidate",
    required_schema_ids: ["test_artifact", "execution_receipt"],
    label: "Test artifact candidate",
    next_action: "bind_canonical_test_matrix_to_test_artifact_candidate",
  },
  {
    panel_section: "pr",
    candidate_kind: "handoff_candidate",
    required_schema_ids: ["rollback_plan", "human_review_gate", "promotion_decision"],
    label: "PR handoff candidate",
    next_action: "prepare_review_only_pr_release_rollback_handoff",
  },
];

export async function runPersonalDevExecutionCandidateLane(options = {}) {
  const result = await buildPersonalDevExecutionCandidateLane(options);
  if (options.write !== false) await writePersonalDevExecutionCandidateLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal-dev execution candidate lane validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevExecutionCandidateLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_EXECUTION_CANDIDATE_LANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const executionSchemaRegistry = await resolveExecutionSchemaRegistrySource(options);
  const personalDevDashboardApi = await resolvePersonalDevDashboardApiSource(options);
  const schemaRows = executionSchemaRegistry.data?.execution_schema_rows ?? [];
  const panelRows = personalDevDashboardApi.data?.personal_dev_panel_rows ?? [];
  const candidateRows = buildCandidateRows({ panelRows, schemaRows, generatedAt });
  const artifactBindingRows = buildArtifactBindingRows({ candidateRows, schemaRows, generatedAt });
  const routeRows = buildRouteRows({ candidateRows, generatedAt });
  const boundary = buildBoundary({ executionSchemaRegistry, personalDevDashboardApi, candidateRows, artifactBindingRows, routeRows, generatedAt });
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
      execution_schema_registry: executionSchemaRegistry.path,
      personal_dev_dashboard_api: personalDevDashboardApi.path,
    },
    source_execution_schema_registry_summary: executionSchemaRegistry.data?.summary ?? null,
    source_personal_dev_dashboard_api_summary: personalDevDashboardApi.data?.summary ?? null,
    personal_dev_execution_candidate_contract: buildContract(generatedAt),
    personal_dev_execution_candidate_rows: candidateRows,
    personal_dev_execution_artifact_binding_rows: artifactBindingRows,
    personal_dev_execution_candidate_route_rows: routeRows,
    personal_dev_execution_candidate_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validationItems = validateCandidateLane(result, schema.available ? schema.data : null);
  result.validation_items = validationItems;
  result.validation = summarizeValidation(validationItems);
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePersonalDevExecutionCandidateLane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "personal-dev-execution-candidate-lane.json"), serializable);
  await writeJson(path.join(outDir, "candidate-rows.json"), collectionEnvelope("personal-dev-execution-candidate-rows.v1", "personal_dev_execution_candidate_rows", result.personal_dev_execution_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "artifact-binding-rows.json"), collectionEnvelope("personal-dev-execution-artifact-binding-rows.v1", "personal_dev_execution_artifact_binding_rows", result.personal_dev_execution_artifact_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-rows.json"), collectionEnvelope("personal-dev-execution-candidate-route-rows.v1", "personal_dev_execution_candidate_route_rows", result.personal_dev_execution_candidate_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.personal_dev_execution_candidate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-execution-candidate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPersonalDevExecutionCandidateLaneCli(argv = process.argv.slice(2)) {
  try {
    const args = parsePersonalDevExecutionCandidateLaneArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runPersonalDevExecutionCandidateLane(args);
    console.log(`Personal-dev execution candidate lane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_dev_execution_candidate_lane_status}`);
    console.log(`Candidates: ${result.summary.ready_candidate_row_count}/${result.summary.candidate_row_count}`);
    console.log(`Schema bindings: ${result.summary.ready_artifact_binding_row_count}/${result.summary.artifact_binding_row_count}`);
    console.log(`Ready for L1 handoff: ${result.summary.ready_for_l1_handoff}`);
    console.log(`Execution allowed now: ${result.summary.execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

export function parsePersonalDevExecutionCandidateLaneArgs(argv = process.argv.slice(2)) {
  const parsed = { outDir: DEFAULT_PERSONAL_DEV_EXECUTION_CANDIDATE_LANE_OUT_DIR };
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
    schema_version: "personal-dev-execution-candidate-contract.v1",
    contract_id: "personal-dev-execution-candidate-lane.contract.v1",
    generated_at: generatedAt,
    product_id: PRODUCT_ID,
    project_id: PROJECT_ID,
    domain_pack_id: DOMAIN_PACK_ID,
    capability_id: CAPABILITY_ID,
    source_execution_schema_registry_required: true,
    source_personal_dev_dashboard_api_required: true,
    candidate_projection_required: true,
    artifact_schema_binding_required: true,
    route_projection_required: true,
    human_review_required: true,
    candidate_projection_generated_now: true,
    execution_request_created_now: false,
    patch_generated_now: false,
    patch_applied_now: false,
    command_execution_allowed_now: false,
    file_write_allowed_now: false,
    pull_request_creation_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildCandidateRows({ panelRows, schemaRows, generatedAt }) {
  const panelBySection = new Map(panelRows.map((row) => [row.panel_section, row]));
  const validSchemaIds = new Set(schemaRows.filter((row) => row.validation?.valid === true).map((row) => row.schema_id));
  return CANDIDATE_SECTION_BINDINGS.map((spec) => {
    const panel = panelBySection.get(spec.panel_section);
    const schemaReady = spec.required_schema_ids.every((schemaId) => validSchemaIds.has(schemaId));
    const panelReady = panel?.panel_status === "ready" && panel.read_only === true && panel.mutation_allowed === false && panel.command_execution_allowed === false;
    const ready = panelReady && schemaReady;
    const row = {
      schema_version: "personal-dev-execution-candidate-row.v1",
      generated_at: generatedAt,
      candidate_id: `personal-dev.execution-candidate.${spec.panel_section}`,
      candidate_kind: spec.candidate_kind,
      label: spec.label,
      product_id: PRODUCT_ID,
      project_id: PROJECT_ID,
      domain_pack_id: DOMAIN_PACK_ID,
      source_panel_section: spec.panel_section,
      source_panel_row_id: panel?.panel_row_id ?? null,
      source_panel_status: panel?.panel_status ?? "missing",
      source_summary_line: panel?.summary_line ?? "missing personal-dev panel row",
      required_schema_ids: spec.required_schema_ids,
      required_schema_count: spec.required_schema_ids.length,
      ready_schema_count: spec.required_schema_ids.filter((schemaId) => validSchemaIds.has(schemaId)).length,
      candidate_status: ready ? "ready" : "blocked",
      blocker_reason: ready ? null : (panelReady ? "required_execution_schema_not_ready" : "source_personal_dev_panel_row_not_ready"),
      next_allowed_action: spec.next_action,
      human_review_required: true,
      read_only: true,
      candidate_projection_generated_now: true,
      execution_request_created_now: false,
      command_invocation_created_now: false,
      execution_receipt_created_now: false,
      patch_generated_now: false,
      patch_applied_now: false,
      command_execution_allowed_now: false,
      file_write_allowed_now: false,
      git_command_allowed_now: false,
      github_api_allowed_now: false,
      pull_request_creation_allowed_now: false,
      merge_allowed_now: false,
      release_allowed_now: false,
      deployment_allowed_now: false,
      protected_output_allowed_now: false,
      raw_secret_access_allowed_now: false,
    };
    return {
      ...row,
      candidate_hash: hashValue(row),
    };
  });
}

function buildArtifactBindingRows({ candidateRows, schemaRows, generatedAt }) {
  const candidateBySchemaId = new Map();
  for (const candidate of candidateRows) {
    for (const schemaId of candidate.required_schema_ids) {
      if (!candidateBySchemaId.has(schemaId)) candidateBySchemaId.set(schemaId, []);
      candidateBySchemaId.get(schemaId).push(candidate.candidate_id);
    }
  }
  return schemaRows.map((schemaRow) => {
    const boundCandidateIds = candidateBySchemaId.get(schemaRow.schema_id) ?? [];
    const ready = schemaRow.validation?.valid === true && boundCandidateIds.length > 0;
    const row = {
      schema_version: "personal-dev-execution-artifact-binding-row.v1",
      generated_at: generatedAt,
      binding_id: `personal-dev.execution-artifact-binding.${schemaRow.schema_id}`,
      schema_id: schemaRow.schema_id,
      schema_file_name: schemaRow.file_name,
      schema_sha256: schemaRow.schema_sha256 ?? null,
      binding_status: ready ? "ready" : "blocked",
      blocker_reason: ready ? null : (schemaRow.validation?.valid === true ? "schema_not_referenced_by_candidate" : "schema_validation_not_ready"),
      bound_candidate_ids: boundCandidateIds,
      bound_candidate_count: boundCandidateIds.length,
      read_only: true,
      artifact_materialized_now: false,
      execution_request_created_now: false,
      command_execution_allowed_now: false,
      file_write_allowed_now: false,
      human_review_required: true,
    };
    return {
      ...row,
      binding_hash: hashValue(row),
    };
  });
}

function buildRouteRows({ candidateRows, generatedAt }) {
  const ready = candidateRows.length === CANDIDATE_SECTION_BINDINGS.length && candidateRows.every((row) => row.candidate_status === "ready");
  const row = {
    schema_version: "personal-dev-execution-candidate-route-row.v1",
    generated_at: generatedAt,
    route_id: "route.execution.personal_dev_candidates",
    path: ROUTE_PATH,
    method_policy: "GET_HEAD_ONLY",
    collection: "personal_dev_execution_candidate_rows",
    ready,
    missing_source_creates_blocker: true,
    route_invokes_runtime: false,
    route_writes_ledger: false,
    route_executes_command: false,
    route_applies_patch: false,
    route_creates_pull_request: false,
    route_deploys: false,
    raw_secret_fields_serialized: false,
    raw_client_material_serialized: false,
    raw_command_output_serialized: false,
    source_binding_hash: hashValue(candidateRows.map((candidate) => [candidate.candidate_id, candidate.candidate_status, candidate.required_schema_ids])),
  };
  return [row];
}

function buildBoundary({ executionSchemaRegistry, personalDevDashboardApi, candidateRows, artifactBindingRows, routeRows, generatedAt }) {
  const candidateRowsReady = candidateRows.length === CANDIDATE_SECTION_BINDINGS.length && candidateRows.every((row) => row.candidate_status === "ready");
  const schemaBindingsReady = artifactBindingRows.length > 0 && artifactBindingRows.every((row) => row.binding_status === "ready" || row.bound_candidate_count === 0);
  const routesReady = routeRows.every((row) => row.method_policy === "GET_HEAD_ONLY" && row.route_invokes_runtime === false && row.route_writes_ledger === false);
  const sourceReady = executionSchemaRegistry.available === true &&
    executionSchemaRegistry.validation_valid === true &&
    executionSchemaRegistry.data?.summary?.execution_schema_registry_status === "ready_for_execution_schema_registry" &&
    personalDevDashboardApi.available === true &&
    personalDevDashboardApi.validation_valid === true &&
    personalDevDashboardApi.data?.summary?.personal_dev_dashboard_api_status === "complete";
  return {
    schema_version: "personal-dev-execution-candidate-boundary.v1",
    generated_at: generatedAt,
    source_execution_schema_registry_available: executionSchemaRegistry.available === true,
    source_execution_schema_registry_ready: executionSchemaRegistry.validation_valid === true && executionSchemaRegistry.data?.summary?.execution_schema_registry_status === "ready_for_execution_schema_registry",
    source_personal_dev_dashboard_api_available: personalDevDashboardApi.available === true,
    source_personal_dev_dashboard_api_ready: personalDevDashboardApi.validation_valid === true && personalDevDashboardApi.data?.summary?.personal_dev_dashboard_api_status === "complete",
    candidate_rows_ready: candidateRowsReady,
    artifact_schema_bindings_ready: schemaBindingsReady,
    route_rows_ready: routesReady,
    ready_for_l1_handoff: sourceReady && candidateRowsReady && schemaBindingsReady && routesReady,
    l1_blocker_resolved_now: sourceReady && candidateRowsReady && schemaBindingsReady && routesReady,
    read_only: true,
    get_head_only: true,
    candidate_projection_generated_now: true,
    execution_request_created_now: false,
    command_invocation_created_now: false,
    execution_receipt_created_now: false,
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
    raw_secret_access_allowed_now: false,
    final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    claude_final_approval_allowed_now: false,
    owner_approval_counts_as_independent_review: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    unsafe_flag_count: 0,
  };
}

function validateCandidateLane(result, schema) {
  const boundary = result.personal_dev_execution_candidate_boundary;
  const routeRows = result.personal_dev_execution_candidate_route_rows;
  const candidateRows = result.personal_dev_execution_candidate_rows;
  const artifactBindingRows = result.personal_dev_execution_artifact_binding_rows;
  const items = [
    validationItem("sources.execution_schema_registry", boundary.source_execution_schema_registry_ready, "Execution schema registry source must be ready.", "source_execution_schema_registry_summary"),
    validationItem("sources.personal_dev_dashboard_api", boundary.source_personal_dev_dashboard_api_ready, "Personal-dev dashboard API source must be complete.", "source_personal_dev_dashboard_api_summary"),
    validationItem("candidates.present", candidateRows.length === CANDIDATE_SECTION_BINDINGS.length, "All personal-dev candidate sections must be present.", "personal_dev_execution_candidate_rows"),
    validationItem("candidates.ready", candidateRows.every((row) => row.candidate_status === "ready"), "All candidate rows must be ready before L1 handoff.", "personal_dev_execution_candidate_rows"),
    validationItem("bindings.present", artifactBindingRows.length >= 12, "Execution artifact schema bindings must cover the execution schema registry.", "personal_dev_execution_artifact_binding_rows"),
    validationItem("routes.read_only", routeRows.every((row) => row.method_policy === "GET_HEAD_ONLY" && row.route_invokes_runtime === false && row.route_writes_ledger === false), "Candidate routes must be read-only.", "personal_dev_execution_candidate_route_rows"),
    validationItem("boundary.closed", boundaryClosed(boundary), "Candidate lane must not open runtime, command, file, PR, deploy, production, protected, connector, desktop, secret, or final approval authority.", "personal_dev_execution_candidate_boundary"),
  ];
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "personal_dev_execution_candidate_lane")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  return [...items, ...schemaItems];
}

function buildSummary(result) {
  const candidateRows = result.personal_dev_execution_candidate_rows;
  const artifactRows = result.personal_dev_execution_artifact_binding_rows;
  const boundary = result.personal_dev_execution_candidate_boundary;
  return {
    personal_dev_execution_candidate_lane_status: result.validation.valid && boundary.ready_for_l1_handoff ? READY_STATUS : BLOCKED_STATUS,
    product_id: PRODUCT_ID,
    project_id: PROJECT_ID,
    domain_pack_id: DOMAIN_PACK_ID,
    capability_id: CAPABILITY_ID,
    candidate_row_count: candidateRows.length,
    ready_candidate_row_count: candidateRows.filter((row) => row.candidate_status === "ready").length,
    blocked_candidate_row_count: candidateRows.filter((row) => row.candidate_status === "blocked").length,
    artifact_binding_row_count: artifactRows.length,
    ready_artifact_binding_row_count: artifactRows.filter((row) => row.binding_status === "ready").length,
    route_count: result.personal_dev_execution_candidate_route_rows.length,
    route_path: ROUTE_PATH,
    ready_for_l1_handoff: boundary.ready_for_l1_handoff,
    l1_blocker_resolved_now: boundary.l1_blocker_resolved_now,
    read_only: boundary.read_only,
    get_head_only: boundary.get_head_only,
    candidate_projection_generated_now: boundary.candidate_projection_generated_now,
    execution_request_created_now: boundary.execution_request_created_now,
    command_invocation_created_now: boundary.command_invocation_created_now,
    execution_receipt_created_now: boundary.execution_receipt_created_now,
    patch_generated_now: boundary.patch_generated_now,
    patch_applied_now: boundary.patch_applied_now,
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
    owner_approval_counts_as_independent_review: boundary.owner_approval_counts_as_independent_review,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    validation_error_count: result.validation.errors.length,
  };
}

function renderMarkdown(result) {
  const rows = result.personal_dev_execution_candidate_rows
    .map((row) => `| ${row.source_panel_section} | ${row.candidate_kind} | ${row.candidate_status} | ${row.required_schema_ids.join(", ")} | ${row.next_allowed_action} |`)
    .join("\n");
  return [
    "# Personal-Dev Execution Candidate Lane",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.summary.personal_dev_execution_candidate_lane_status}`,
    `Ready for L1 handoff: ${result.summary.ready_for_l1_handoff}`,
    "",
    "| Section | Candidate | Status | Schemas | Next Action |",
    "|---|---|---|---|---|",
    rows,
    "",
    "## Boundary",
    "",
    `GET/HEAD only: ${result.summary.get_head_only}`,
    `Candidate projection generated now: ${result.summary.candidate_projection_generated_now}`,
    `Execution request created now: ${result.summary.execution_request_created_now}`,
    `Command execution allowed now: ${result.summary.command_execution_allowed_now}`,
    `File write allowed now: ${result.summary.file_write_allowed_now}`,
    `PR creation allowed now: ${result.summary.pull_request_creation_allowed_now}`,
    `Deployment allowed now: ${result.summary.deployment_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "Human review note: this lane only projects candidates. Runtime execution, file writes, PR creation, merge, release, deployment, protected outputs, and final trust remain blocked.",
    "",
  ].join("\n");
}

async function resolveExecutionSchemaRegistrySource(options) {
  if (Object.prototype.hasOwnProperty.call(options, "executionSchemaRegistry")) {
    return normalizeInlineSource("inline.execution_schema_registry", options.executionSchemaRegistry);
  }
  return captureSource("builder.execution_schema_registry", () => buildExecutionSchemaRegistry({ ...options, write: false }));
}

async function resolvePersonalDevDashboardApiSource(options) {
  if (Object.prototype.hasOwnProperty.call(options, "personalDevDashboardApi")) {
    return normalizeInlineSource("inline.personal_dev_dashboard_api", options.personalDevDashboardApi);
  }
  return captureSource("builder.personal_dev_dashboard_api", () => buildPersonalDevDashboardApi({ ...options, write: false }));
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
    validation_valid: data?.validation?.valid !== false && Boolean(data),
    data: stripTransient(data),
  };
}

function stripTransient(value) {
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  delete copy.markdown;
  delete copy.summary_markdown;
  return copy;
}

function boundaryClosed(boundary) {
  return boundary.read_only === true &&
    boundary.get_head_only === true &&
    boundary.execution_request_created_now === false &&
    boundary.command_invocation_created_now === false &&
    boundary.execution_receipt_created_now === false &&
    boundary.patch_generated_now === false &&
    boundary.patch_applied_now === false &&
    boundary.execution_allowed_now === false &&
    boundary.runtime_execution_allowed_now === false &&
    boundary.command_execution_allowed_now === false &&
    boundary.file_write_allowed_now === false &&
    boundary.task_state_write_allowed_now === false &&
    boundary.issue_mutation_allowed_now === false &&
    boundary.git_command_allowed_now === false &&
    boundary.github_api_allowed_now === false &&
    boundary.branch_push_allowed_now === false &&
    boundary.pull_request_creation_allowed_now === false &&
    boundary.merge_allowed_now === false &&
    boundary.release_allowed_now === false &&
    boundary.deployment_allowed_now === false &&
    boundary.production_allowed_now === false &&
    boundary.protected_output_allowed_now === false &&
    boundary.connector_write_allowed_now === false &&
    boundary.desktop_shell_execution_allowed_now === false &&
    boundary.raw_secret_access_allowed_now === false &&
    boundary.final_approval_allowed_now === false &&
    boundary.owner_approval_counts_as_independent_review === false &&
    boundary.production_pass_enabled === false &&
    boundary.enterprise_pass_enabled === false &&
    boundary.unsafe_flag_count === 0;
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PERSONAL_DEV_EXECUTION_CANDIDATE_LANE_INPUTS.schemaPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, error: error.message, data: null };
  }
}

function validationItem(id, pass, message, path = id) {
  return { id, path, pass: Boolean(pass), status: pass ? "pass" : "fail", message };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.pass)
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: rows.length, rows };
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run execution:personal-dev-candidates -- [--check] [--out-dir <dir>] [--schema-path <file>] [--repo-root <dir>] [--run-at <iso>]

Builds the read-only personal-dev execution candidate lane. This creates candidate
projection rows only; it does not create execution requests, run commands, write
files, open PRs, merge, release, deploy, or grant production/enterprise trust.`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
