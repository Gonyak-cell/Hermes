import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_API_DASHBOARD_OUT_DIR = "artifacts/runtime-api-dashboard/latest";
export const DEFAULT_RUNTIME_API_DASHBOARD_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  hermesRuntimeAdapterPath: "artifacts/hermes-runtime-adapter/latest/hermes-runtime-adapter.json",
  claudeCodeAdapterContractPath: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
  codexAdapterContractPath: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
  localScriptAdapterPath: "artifacts/local-script-adapter/latest/local-script-adapter.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  worktreeManagerV2Path: "artifacts/worktree-manager-v2/latest/worktree-manager-v2.json",
  sandboxPolicyModelPath: "artifacts/sandbox-policy-model/latest/sandbox-policy-model.json",
  dockerLocalBackendSelectorPath: "artifacts/docker-local-backend-selector/latest/docker-local-backend-selector.json",
  secretsBrokerContractPath: "artifacts/secrets-broker/latest/secrets-broker-contract.json",
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
  runtimeLogNormalizationPath: "artifacts/runtime-log-normalization/latest/runtime-log-normalization.json",
  runtimeTimeoutHeartbeatPath: "artifacts/runtime-timeout-heartbeat/latest/runtime-timeout-heartbeat.json",
  runtimeControlCommandsPath: "artifacts/runtime-control-commands/latest/runtime-control-commands.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
  canonicalTestRunnerPath: "artifacts/canonical-test-runner/latest/canonical-test-runner.json",
  packagePath: "package.json",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const RUNTIME_API_DASHBOARD_CONTRACT_ID = "runtime-api-dashboard.default";
const SOURCE_OF_TRUTH = "runtime_contract_artifacts_and_review_api_dashboard";
const DESKTOP_SURFACE_POLICY = "read_only_runtime_operations_dashboard";

const SOURCE_DEFINITIONS = [
  source("runtime_adapter_interface_v2", "Runtime Adapter Interface v2", "adapter", "runtimeAdapterInterfaceV2Path", "runtime_adapter_interface_status"),
  source("hermes_runtime_adapter", "Hermes Runtime Adapter", "adapter", "hermesRuntimeAdapterPath", "hermes_runtime_adapter_status"),
  source("claude_code_adapter_contract", "Claude Code Adapter Contract", "adapter", "claudeCodeAdapterContractPath", "claude_code_adapter_contract_status"),
  source("codex_adapter_contract", "Codex Adapter Contract", "adapter", "codexAdapterContractPath", "codex_adapter_contract_status"),
  source("local_script_adapter", "Local Script Adapter", "adapter", "localScriptAdapterPath", "local_script_adapter_status"),
  source("document_renderer_adapter", "Document Renderer Adapter", "adapter", "documentRendererAdapterPath", "document_renderer_adapter_status"),
  source("worktree_manager_v2", "Worktree Manager v2", "worktree", "worktreeManagerV2Path", "worktree_manager_v2_status"),
  source("sandbox_policy_model", "Sandbox Policy Model", "sandbox", "sandboxPolicyModelPath", "sandbox_policy_model_status"),
  source("docker_local_backend_selector", "Docker/local Backend Selector", "sandbox", "dockerLocalBackendSelectorPath", "docker_local_backend_selector_status"),
  source("secrets_broker_contract", "Secrets Broker Contract", "secrets", "secretsBrokerContractPath", "secrets_broker_contract_status"),
  source("runtime_artifact_capture", "Runtime Artifact Capture", "artifact", "runtimeArtifactCapturePath", "runtime_artifact_capture_status"),
  source("runtime_log_normalization", "Runtime Log Normalization", "log", "runtimeLogNormalizationPath", "runtime_log_normalization_status"),
  source("runtime_timeout_heartbeat", "Runtime Timeout/Heartbeat", "lifecycle", "runtimeTimeoutHeartbeatPath", "runtime_timeout_heartbeat_status"),
  source("runtime_control_commands", "Runtime Control Commands", "control", "runtimeControlCommandsPath", "runtime_control_command_status"),
  source("protected_file_gate", "Protected File Gate", "gate", "protectedFileGatePath", "protected_file_gate_status"),
  source("canonical_test_runner", "Canonical Test Runner", "test", "canonicalTestRunnerPath", "canonical_test_runner_status"),
];

const ROUTE_GROUP_DEFINITIONS = [
  routeGroup("runtime-route-group.adapters", "adapters", "Runtime Adapters", ["runtime_adapter_interface_v2", "hermes_runtime_adapter", "claude_code_adapter_contract", "codex_adapter_contract", "local_script_adapter", "document_renderer_adapter"], [
    "/api/runtime-adapter-interface-v2",
    "/api/runtime-adapter-interfaces",
    "/api/runtime-operator-surface-policies",
    "/api/hermes-runtime-adapter",
    "/api/claude-code-adapter-contract",
    "/api/codex-adapter-contract",
    "/api/local-script-adapter",
    "/api/document-renderer-adapter",
  ]),
  routeGroup("runtime-route-group.worktrees", "worktrees", "Worktrees", ["worktree_manager_v2"], [
    "/api/worktree-manager-v2",
    "/api/agent-worktree-plans",
    "/api/worktree-status-records",
    "/api/worktree-cleanup-records",
    "/api/worktree-desktop-boundary",
  ], { protectedMutationRequestRoute: true }),
  routeGroup("runtime-route-group.sandbox", "sandbox", "Sandbox/Backends", ["sandbox_policy_model", "docker_local_backend_selector"], [
    "/api/sandbox-policy-model",
    "/api/runtime-sandbox-bindings",
    "/api/docker-local-backend-selector",
    "/api/runtime-backend-selections",
    "/api/runtime-classification-backend-matrix",
    "/api/backend-selector-desktop-boundary",
  ]),
  routeGroup("runtime-route-group.secrets", "secrets", "Secrets", ["secrets_broker_contract"], [
    "/api/secrets-broker-contract",
    "/api/secret-handle-policies",
    "/api/runtime-secret-access-bindings",
    "/api/secrets-desktop-boundary",
  ]),
  routeGroup("runtime-route-group.artifacts", "artifacts", "Artifacts", ["runtime_artifact_capture"], [
    "/api/runtime-artifact-capture",
    "/api/artifact-capture-records",
    "/api/diff-capture-records",
    "/api/stream-capture-records",
    "/api/output-artifact-capture-bindings",
    "/api/runtime-artifact-desktop-boundary",
  ]),
  routeGroup("runtime-route-group.logs", "logs", "Logs", ["runtime_log_normalization"], [
    "/api/runtime-log-normalization",
    "/api/normalized-runtime-logs",
    "/api/normalized-log-streams",
    "/api/runtime-log-search-documents",
    "/api/runtime-log-trace-bindings",
    "/api/runtime-log-desktop-boundary",
  ]),
  routeGroup("runtime-route-group.lifecycle", "lifecycle", "Heartbeat/Timeout", ["runtime_timeout_heartbeat"], [
    "/api/runtime-timeout-heartbeat",
    "/api/runtime-heartbeat-records",
    "/api/runtime-timeout-records",
    "/api/runtime-lifecycle-ledger-bindings",
    "/api/runtime-heartbeat-desktop-boundary",
  ], { protectedMutationRequestRoute: true }),
  routeGroup("runtime-route-group.control", "control", "Cancel/Resume Requests", ["runtime_control_commands"], [
    "/api/runtime-control-commands",
    "/api/runtime-control-command-requests",
    "/api/runtime-control-command-results",
    "/api/runtime-control-audit-bindings",
    "/api/runtime-control-desktop-boundary",
  ], { protectedMutationRequestRoute: true }),
  routeGroup("runtime-route-group.gates", "gates", "Protected Gates", ["protected_file_gate"], [
    "/api/protected-file-gate",
    "/api/protected-file-change-evaluations",
    "/api/protected-file-approval-requirements",
    "/api/protected-file-gate-desktop-boundary",
  ], { protectedMutationRequestRoute: true }),
  routeGroup("runtime-route-group.tests", "tests", "Canonical Tests", ["canonical_test_runner"], [
    "/api/canonical-test-runner",
    "/api/canonical-test-plans",
    "/api/canonical-test-executions",
    "/api/canonical-test-gate-results",
    "/api/canonical-test-desktop-boundary",
  ], { protectedMutationRequestRoute: true }),
  routeGroup("runtime-route-group.desktop-index", "desktop_index", "Runtime API Dashboard", ["runtime_api_dashboard"], [
    "/api/runtime-api-dashboard",
    "/api/runtime-api-route-groups",
    "/api/runtime-dashboard-panels",
    "/api/runtime-status-cards",
    "/api/runtime-api-desktop-boundary",
    "/api/runtime-api-dashboard-validations",
  ]),
];

export async function runRuntimeApiDashboard(options = {}) {
  const result = await buildRuntimeApiDashboard(options);
  if (options.write !== false) await writeRuntimeApiDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime API/dashboard validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeApiDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_API_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSources(inputs);
  const artifacts = Object.fromEntries(sourceReads.filter((entry) => entry.value).map((entry) => [entry.source_id, entry.value]));
  const reviewApi = await readTextOrError(inputs.review_api_path);
  const reviewDashboard = await readTextOrError(inputs.review_dashboard_path);
  const packageJson = await readJsonOrError(inputs.package_json_path);
  const desktopCompanionIntegration = await readTextOrError(inputs.desktop_companion_integration_path);
  const runtimeApiRouteGroups = buildRuntimeApiRouteGroups(artifacts, reviewApi.value ?? "", generatedAt);
  const runtimeDashboardPanels = buildRuntimeDashboardPanels(runtimeApiRouteGroups, artifacts, generatedAt);
  const runtimeStatusCards = buildRuntimeStatusCards(sourceReads, artifacts, generatedAt);
  const runtimeApiDesktopBoundary = buildRuntimeApiDesktopBoundary(generatedAt, runtimeApiRouteGroups);
  const validationItems = validateRuntimeApiDashboard({
    sourceReads,
    reviewApi,
    reviewDashboard,
    packageJson,
    desktopCompanionIntegration,
    runtimeApiRouteGroups,
    runtimeDashboardPanels,
    runtimeStatusCards,
    runtimeApiDesktopBoundary,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-api-dashboard.v1",
    generated_at: generatedAt,
    runtime_api_dashboard_id: `runtime-api-dashboard.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sourceReads, { reviewApi, reviewDashboard, packageJson, desktopCompanionIntegration }),
    runtime_api_dashboard_contract: buildRuntimeApiDashboardContract(generatedAt),
    runtime_api_route_groups: runtimeApiRouteGroups,
    runtime_dashboard_panels: runtimeDashboardPanels,
    runtime_status_cards: runtimeStatusCards,
    runtime_api_desktop_boundary: runtimeApiDesktopBoundary,
    summary: summarizeRuntimeApiDashboard({
      sourceReads,
      runtimeApiRouteGroups,
      runtimeDashboardPanels,
      runtimeStatusCards,
      runtimeApiDesktopBoundary,
      validationItems,
      validation,
    }),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeApiDashboardMarkdown(result),
  };
}

export async function writeRuntimeApiDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-api-dashboard.json"), serializableRuntimeApiDashboard(result));
  await writeJson(path.join(outDir, "runtime-api-route-groups.json"), {
    schema_version: "runtime-api-route-groups.v1",
    generated_at: result.generated_at,
    runtime_api_route_group_count: result.runtime_api_route_groups.length,
    runtime_api_route_groups: result.runtime_api_route_groups,
  });
  await writeJson(path.join(outDir, "runtime-dashboard-panels.json"), {
    schema_version: "runtime-dashboard-panels.v1",
    generated_at: result.generated_at,
    runtime_dashboard_panel_count: result.runtime_dashboard_panels.length,
    runtime_dashboard_panels: result.runtime_dashboard_panels,
  });
  await writeJson(path.join(outDir, "runtime-status-cards.json"), {
    schema_version: "runtime-status-cards.v1",
    generated_at: result.generated_at,
    runtime_status_card_count: result.runtime_status_cards.length,
    runtime_status_cards: result.runtime_status_cards,
  });
  await writeJson(path.join(outDir, "runtime-api-desktop-boundary.json"), result.runtime_api_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-api-dashboard-validation-report.v1",
    generated_at: result.generated_at,
    runtime_api_dashboard_id: result.runtime_api_dashboard_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeApiDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRuntimeApiDashboard(args);
    console.log(`Runtime API/dashboard written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_api_dashboard_status}`);
    console.log(`Route groups: ${result.summary.runtime_api_route_group_count}`);
    console.log(`Routes: ${result.summary.runtime_api_route_count}`);
    console.log(`Panels: ${result.summary.runtime_dashboard_panel_count}`);
    console.log(`Cards: ${result.summary.runtime_status_card_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeInputs(options) {
  return {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.runtimeAdapterInterfaceV2Path),
    hermes_runtime_adapter_path: path.resolve(options.hermesRuntimeAdapterPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.hermesRuntimeAdapterPath),
    claude_code_adapter_contract_path: path.resolve(options.claudeCodeAdapterContractPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.claudeCodeAdapterContractPath),
    codex_adapter_contract_path: path.resolve(options.codexAdapterContractPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.codexAdapterContractPath),
    local_script_adapter_path: path.resolve(options.localScriptAdapterPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.localScriptAdapterPath),
    document_renderer_adapter_path: path.resolve(options.documentRendererAdapterPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.documentRendererAdapterPath),
    worktree_manager_v2_path: path.resolve(options.worktreeManagerV2Path ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.worktreeManagerV2Path),
    sandbox_policy_model_path: path.resolve(options.sandboxPolicyModelPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.sandboxPolicyModelPath),
    docker_local_backend_selector_path: path.resolve(options.dockerLocalBackendSelectorPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.dockerLocalBackendSelectorPath),
    secrets_broker_contract_path: path.resolve(options.secretsBrokerContractPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.secretsBrokerContractPath),
    runtime_artifact_capture_path: path.resolve(options.runtimeArtifactCapturePath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.runtimeArtifactCapturePath),
    runtime_log_normalization_path: path.resolve(options.runtimeLogNormalizationPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.runtimeLogNormalizationPath),
    runtime_timeout_heartbeat_path: path.resolve(options.runtimeTimeoutHeartbeatPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.runtimeTimeoutHeartbeatPath),
    runtime_control_commands_path: path.resolve(options.runtimeControlCommandsPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.runtimeControlCommandsPath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.protectedFileGatePath),
    canonical_test_runner_path: path.resolve(options.canonicalTestRunnerPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.canonicalTestRunnerPath),
    package_json_path: path.resolve(options.packagePath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.packagePath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.reviewApiPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.reviewDashboardPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_API_DASHBOARD_INPUTS.desktopCompanionIntegrationPath),
  };
}

async function readSources(inputs) {
  const reads = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const inputKey = snakeCasePathKey(definition.option);
    const read = await readJsonOrError(inputs[inputKey]);
    reads.push({
      ...definition,
      path: inputs[inputKey],
      available: Boolean(read.value),
      read_error: read.error,
      value: read.value,
      raw: read.raw,
      summary: read.value?.summary ?? {},
      validation_error_count: read.value?.summary?.validation_error_count ?? read.value?.validation?.errors?.length ?? 0,
    });
  }
  return reads;
}

function buildRuntimeApiDashboardContract(generatedAt) {
  return {
    schema_version: "runtime-api-dashboard-contract.v1",
    runtime_api_dashboard_contract_id: RUNTIME_API_DASHBOARD_CONTRACT_ID,
    generated_at: generatedAt,
    contract_status: "locked",
    route_authority: "harness_review_api",
    dashboard_authority: "harness_review_dashboard",
    source_of_truth: SOURCE_OF_TRUTH,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_companion_role: "operator_surface",
    api_rule: "Runtime API/dashboard routes expose existing runtime contract artifacts through GET-only Review API collections.",
    dashboard_rule: "Runtime dashboard panels summarize adapters, worktrees, logs, artifacts, lifecycle, control request receipts, gates, and canonical tests.",
    mutation_rule: "Desktop Companion may display protected mutation request drafts, but it cannot execute runtime starts, control commands, tests, file writes, merges, or secret changes.",
    read_only: true,
    mutation_allowed: false,
    protected_mutation_execution_allowed: false,
    runtime_execution_allowed: false,
    runtime_control_allowed: false,
    test_execution_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    desktop_source_of_truth: false,
  };
}

function buildRuntimeApiRouteGroups(artifacts, reviewApiSource, generatedAt) {
  return ROUTE_GROUP_DEFINITIONS.map((definition) => {
    const sourceSummaries = definition.source_ids.map((sourceId) => artifacts[sourceId]?.summary ?? {});
    const declaredRoutes = definition.route_paths.filter((routePath) => routeDeclared(reviewApiSource, routePath));
    const missingRoutes = definition.route_paths.filter((routePath) => !routeDeclared(reviewApiSource, routePath));
    const validationErrorCount = sourceSummaries.reduce((sum, summary) => sum + (summary.validation_error_count ?? 0), 0);
    const allSourcesComplete = definition.source_ids
      .filter((sourceId) => sourceId !== "runtime_api_dashboard")
      .every((sourceId) => statusFromArtifact(artifacts[sourceId]) === "complete");
    const routeGroup = {
      schema_version: "runtime-api-route-group.v1",
      runtime_api_route_group_id: definition.route_group_id,
      route_group_kind: definition.route_group_kind,
      label: definition.label,
      source_artifact_ids: definition.source_ids,
      route_method: "GET",
      route_paths: definition.route_paths,
      query_examples: definition.route_paths.slice(0, 3).map((routePath) => `${routePath}?limit=1`),
      route_count: definition.route_paths.length,
      declared_route_count: declaredRoutes.length,
      missing_route_count: missingRoutes.length,
      missing_routes: missingRoutes,
      route_group_status: missingRoutes.length === 0 && validationErrorCount === 0 && allSourcesComplete ? "ready" : "attention",
      all_sources_complete: allSourcesComplete,
      source_validation_error_count: validationErrorCount,
      desktop_visibility: "read_only",
      read_only: true,
      mutation_route_count: 0,
      protected_mutation_request_route: Boolean(definition.protected_mutation_request_route),
      protected_mutation_request_route_count: definition.protected_mutation_request_route ? definition.route_paths.length : 0,
      protected_mutation_execution_allowed: false,
      runtime_execution_allowed: false,
      runtime_control_allowed: false,
      test_execution_allowed: false,
      secret_material_exposed: false,
      route_hash: hashValue({
        route_group_id: definition.route_group_id,
        route_paths: definition.route_paths,
        declaredRoutes,
        generatedAt,
      }),
    };
    return routeGroup;
  });
}

function buildRuntimeDashboardPanels(routeGroups, artifacts, generatedAt) {
  return routeGroups.map((group) => {
    const sourceSummaries = group.source_artifact_ids.map((sourceId) => artifacts[sourceId]?.summary ?? {});
    const primaryCount = group.route_count;
    const attentionCount = group.missing_route_count + group.source_validation_error_count;
    return {
      schema_version: "runtime-dashboard-panel.v1",
      runtime_dashboard_panel_id: `runtime-panel.${group.route_group_kind}`,
      route_group_id: group.runtime_api_route_group_id,
      panel_kind: group.route_group_kind,
      label: group.label,
      panel_status: group.route_group_status === "ready" ? "ready" : "attention",
      source_artifact_ids: group.source_artifact_ids,
      source_statuses: group.source_artifact_ids.map((sourceId) => ({
        source_artifact_id: sourceId,
        source_status: sourceId === "runtime_api_dashboard" ? "complete" : statusFromArtifact(artifacts[sourceId]),
      })),
      primary_count: primaryCount,
      attention_count: attentionCount,
      route_count: group.route_count,
      declared_route_count: group.declared_route_count,
      missing_route_count: group.missing_route_count,
      validation_error_count: group.source_validation_error_count,
      desktop_visibility: "read_only",
      read_only: true,
      mutation_allowed: false,
      runtime_execution_allowed: false,
      runtime_control_allowed: false,
      test_execution_allowed: false,
      secret_material_exposed: false,
      metrics: summarizePanelMetrics(group, sourceSummaries),
      api_routes: group.route_paths,
      query_examples: group.query_examples,
      human_review_note: "Desktop Companion can inspect this runtime panel, but execution, file writes, control commands, and final delivery remain human-gated.",
      panel_hash: hashValue({ route_group_id: group.runtime_api_route_group_id, generatedAt, sourceSummaries }),
    };
  });
}

function buildRuntimeStatusCards(sourceReads, artifacts, generatedAt) {
  return sourceReads.map((entry) => {
    const summary = artifacts[entry.source_id]?.summary ?? entry.summary ?? {};
    const sourceStatus = summary[entry.status_key] ?? statusFromArtifact(artifacts[entry.source_id]);
    return {
      schema_version: "runtime-status-card.v1",
      runtime_status_card_id: `runtime-status-card.${entry.source_id.replaceAll("_", "-")}`,
      source_artifact_id: entry.source_id,
      label: entry.label,
      card_kind: entry.kind,
      source_status: sourceStatus,
      contract_status: summary.contract_status ?? summary.adapter_status ?? summary.manager_status ?? summary.broker_status ?? "locked",
      validation_error_count: entry.validation_error_count,
      desktop_surface_policy: summary.desktop_surface_policy ?? DESKTOP_SURFACE_POLICY,
      desktop_read_only: summary.desktop_read_only ?? true,
      desktop_mutation_allowed: summary.desktop_mutation_allowed ?? false,
      desktop_protected_mutation_request_allowed: summary.desktop_protected_mutation_request_allowed ?? false,
      desktop_protected_mutation_execution_allowed: summary.desktop_protected_mutation_execution_allowed ?? false,
      desktop_runtime_source_of_truth: summary.desktop_runtime_source_of_truth ?? summary.desktop_source_of_truth ?? false,
      runtime_self_report_trusted: summary.runtime_self_report_trusted ?? summary.agent_self_report_trusted ?? false,
      source_of_truth: summary.source_of_truth ?? "harness_control_plane",
      primary_metric_key: primaryMetricKey(summary),
      primary_metric_value: Number(summary[primaryMetricKey(summary)] ?? 0),
      attention_metric_value: Number(summary.validation_error_count ?? summary.failed_validation_item_count ?? 0),
      read_only_route: routeForSource(entry.source_id),
      status_card_hash: hashValue({ source_id: entry.source_id, sourceStatus, generatedAt }),
    };
  });
}

function buildRuntimeApiDesktopBoundary(generatedAt, routeGroups) {
  return {
    schema_version: "runtime-api-desktop-boundary.v1",
    generated_at: generatedAt,
    runtime_api_desktop_boundary_id: `runtime-api-desktop-boundary.${dateStamp(generatedAt)}`,
    boundary_status: "locked",
    desktop_companion_role: "operator_surface",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    source_of_truth: SOURCE_OF_TRUTH,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: true,
    protected_mutation_execution_allowed: false,
    runtime_source_of_truth: false,
    runtime_execution_allowed: false,
    runtime_control_allowed: false,
    test_execution_allowed: false,
    local_file_write_allowed: false,
    direct_apply_allowed: false,
    direct_merge_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    route_group_count: routeGroups.length,
    read_only_route_count: routeGroups.reduce((sum, group) => sum + group.route_count, 0),
    protected_mutation_request_route_count: routeGroups.reduce((sum, group) => sum + group.protected_mutation_request_route_count, 0),
    operator_action_model: "status_inspection_and_receipt_draft_only",
    human_gate_required_for_mutation: true,
  };
}

function validateRuntimeApiDashboard({ sourceReads, reviewApi, reviewDashboard, packageJson, desktopCompanionIntegration, runtimeApiRouteGroups, runtimeDashboardPanels, runtimeStatusCards, runtimeApiDesktopBoundary }) {
  const items = [];
  for (const sourceRead of sourceReads) {
    items.push(validationItem(`source.${sourceRead.source_id}.available`, sourceRead.available, sourceRead.read_error ?? `${sourceRead.label} is available.`));
    items.push(validationItem(`source.${sourceRead.source_id}.complete`, (sourceRead.summary?.[sourceRead.status_key] ?? "complete") === "complete", `${sourceRead.label} status is complete.`));
    items.push(validationItem(`source.${sourceRead.source_id}.validation`, sourceRead.validation_error_count === 0, `${sourceRead.label} validation errors: ${sourceRead.validation_error_count}.`));
  }
  for (const group of runtimeApiRouteGroups) {
    items.push(validationItem(`route_group.${group.route_group_kind}.declared`, group.missing_route_count === 0, `${group.label} routes are declared in Review API.`));
    items.push(validationItem(`route_group.${group.route_group_kind}.read_only`, group.read_only === true && group.mutation_route_count === 0, `${group.label} route group is read-only.`));
    items.push(validationItem(`route_group.${group.route_group_kind}.no_runtime_control`, group.runtime_execution_allowed === false && group.runtime_control_allowed === false && group.test_execution_allowed === false, `${group.label} does not execute runtime control or tests.`));
    items.push(validationItem(`route_group.${group.route_group_kind}.no_secrets`, group.secret_material_exposed === false, `${group.label} exposes no secret material.`));
  }
  items.push(validationItem("dashboard.panels.present", runtimeDashboardPanels.length === runtimeApiRouteGroups.length, "Runtime dashboard panel count matches route groups."));
  items.push(validationItem("dashboard.cards.present", runtimeStatusCards.length === sourceReads.length, "Runtime status cards cover every runtime source artifact."));
  items.push(validationItem("desktop.boundary.read_only", runtimeApiDesktopBoundary.read_only === true && runtimeApiDesktopBoundary.mutation_allowed === false, "Desktop boundary is read-only."));
  items.push(validationItem("desktop.boundary.no_execution", runtimeApiDesktopBoundary.runtime_execution_allowed === false && runtimeApiDesktopBoundary.runtime_control_allowed === false && runtimeApiDesktopBoundary.test_execution_allowed === false, "Desktop boundary cannot execute runtime, control, or tests."));
  items.push(validationItem("desktop.boundary.no_secret_or_installer", runtimeApiDesktopBoundary.secret_material_exposed === false && runtimeApiDesktopBoundary.provider_key_visible === false && runtimeApiDesktopBoundary.installer_or_gateway_control === false, "Desktop boundary exposes no secrets, provider keys, installer, or gateway controls."));
  items.push(validationItem("source.review_api.readable", Boolean(reviewApi.value), reviewApi.error ?? "Review API source is readable."));
  items.push(validationItem("source.review_dashboard.readable", Boolean(reviewDashboard.value), reviewDashboard.error ?? "Review dashboard source is readable."));
  items.push(validationItem("source.package.script", Boolean(packageJson.value?.scripts?.["runtime:api-dashboard"]), "package.json declares runtime:api-dashboard."));
  items.push(validationItem("source.desktop_companion.mentioned", (desktopCompanionIntegration.value ?? "").includes("Desktop Companion"), "Desktop Companion integration document is present."));
  return items;
}

function summarizeRuntimeApiDashboard({ sourceReads, runtimeApiRouteGroups, runtimeDashboardPanels, runtimeStatusCards, runtimeApiDesktopBoundary, validationItems, validation }) {
  const routeCount = runtimeApiRouteGroups.reduce((sum, group) => sum + group.route_count, 0);
  const declaredRouteCount = runtimeApiRouteGroups.reduce((sum, group) => sum + group.declared_route_count, 0);
  const missingRouteCount = runtimeApiRouteGroups.reduce((sum, group) => sum + group.missing_route_count, 0);
  const mutationRouteCount = runtimeApiRouteGroups.reduce((sum, group) => sum + group.mutation_route_count, 0);
  const protectedMutationRequestRouteCount = runtimeApiRouteGroups.reduce((sum, group) => sum + group.protected_mutation_request_route_count, 0);
  const sourceValidationErrorCount = sourceReads.reduce((sum, entry) => sum + entry.validation_error_count, 0);
  const runtimeExecutionAllowedCount = runtimeApiRouteGroups.filter((group) => group.runtime_execution_allowed).length;
  const runtimeControlAllowedCount = runtimeApiRouteGroups.filter((group) => group.runtime_control_allowed).length;
  const secretMaterialExposedCount = runtimeApiRouteGroups.filter((group) => group.secret_material_exposed).length
    + runtimeStatusCards.filter((card) => card.desktop_secret_material_exposed === true).length;
  return {
    runtime_api_dashboard_status: validation.valid ? "complete" : "blocked",
    runtime_api_dashboard_contract_id: RUNTIME_API_DASHBOARD_CONTRACT_ID,
    contract_status: "locked",
    route_authority: "harness_review_api",
    dashboard_authority: "harness_review_dashboard",
    source_of_truth: SOURCE_OF_TRUTH,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    source_count: sourceReads.length,
    complete_source_count: sourceReads.filter((entry) => (entry.summary?.[entry.status_key] ?? "complete") === "complete").length,
    source_validation_error_count: sourceValidationErrorCount,
    runtime_api_route_group_count: runtimeApiRouteGroups.length,
    ready_route_group_count: runtimeApiRouteGroups.filter((group) => group.route_group_status === "ready").length,
    attention_route_group_count: runtimeApiRouteGroups.filter((group) => group.route_group_status !== "ready").length,
    read_only_route_group_count: runtimeApiRouteGroups.filter((group) => group.read_only).length,
    protected_mutation_request_route_group_count: runtimeApiRouteGroups.filter((group) => group.protected_mutation_request_route).length,
    runtime_api_route_count: routeCount,
    declared_route_count: declaredRouteCount,
    missing_route_count: missingRouteCount,
    mutation_route_count: mutationRouteCount,
    protected_mutation_request_route_count: protectedMutationRequestRouteCount,
    runtime_dashboard_panel_count: runtimeDashboardPanels.length,
    ready_panel_count: runtimeDashboardPanels.filter((panel) => panel.panel_status === "ready").length,
    attention_panel_count: runtimeDashboardPanels.filter((panel) => panel.panel_status !== "ready").length,
    runtime_status_card_count: runtimeStatusCards.length,
    complete_status_card_count: runtimeStatusCards.filter((card) => card.source_status === "complete").length,
    adapter_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "adapter").length,
    worktree_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "worktree").length,
    log_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "log").length,
    artifact_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "artifact").length,
    lifecycle_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "lifecycle").length,
    control_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "control").length,
    gate_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "gate").length,
    test_status_card_count: runtimeStatusCards.filter((card) => card.card_kind === "test").length,
    runtime_execution_allowed_count: runtimeExecutionAllowedCount,
    runtime_control_allowed_count: runtimeControlAllowedCount,
    test_execution_allowed_count: runtimeDashboardPanels.filter((panel) => panel.test_execution_allowed).length,
    secret_material_exposed_count: secretMaterialExposedCount,
    desktop_boundary_status: runtimeApiDesktopBoundary.boundary_status,
    desktop_read_only: runtimeApiDesktopBoundary.read_only,
    desktop_mutation_allowed: runtimeApiDesktopBoundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: runtimeApiDesktopBoundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: runtimeApiDesktopBoundary.protected_mutation_execution_allowed,
    desktop_runtime_source_of_truth: runtimeApiDesktopBoundary.runtime_source_of_truth,
    desktop_runtime_execution_allowed: runtimeApiDesktopBoundary.runtime_execution_allowed,
    desktop_runtime_control_allowed: runtimeApiDesktopBoundary.runtime_control_allowed,
    desktop_test_execution_allowed: runtimeApiDesktopBoundary.test_execution_allowed,
    desktop_secret_material_exposed: runtimeApiDesktopBoundary.secret_material_exposed,
    desktop_provider_key_visible: runtimeApiDesktopBoundary.provider_key_visible,
    desktop_installer_or_gateway_control: runtimeApiDesktopBoundary.installer_or_gateway_control,
    desktop_ssh_or_cron_control: runtimeApiDesktopBoundary.ssh_or_cron_control,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_route_group_kind: countBy(runtimeApiRouteGroups, (group) => group.route_group_kind),
  };
}

function buildSourceContracts(sourceReads, extraSources) {
  const sourceContracts = Object.fromEntries(sourceReads.map((entry) => [entry.source_id, {
    path: entry.path,
    available: entry.available,
    schema_version: entry.value?.schema_version ?? null,
    generated_at: entry.value?.generated_at ?? null,
    content_hash: entry.raw ? hashText(entry.raw) : null,
    status: entry.summary?.[entry.status_key] ?? "unknown",
    validation_error_count: entry.validation_error_count,
  }]));
  sourceContracts.review_api = sourceRecord(extraSources.reviewApi);
  sourceContracts.review_dashboard = sourceRecord(extraSources.reviewDashboard);
  sourceContracts.package_json = sourceRecord(extraSources.packageJson);
  sourceContracts.desktop_companion_integration = sourceRecord(extraSources.desktopCompanionIntegration);
  return sourceContracts;
}

function renderRuntimeApiDashboardMarkdown(result) {
  const lines = [];
  lines.push("# Runtime API Dashboard");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_api_dashboard_status}`);
  lines.push(`- Contract: ${result.summary.runtime_api_dashboard_contract_id}`);
  lines.push(`- Route groups: ${result.summary.runtime_api_route_group_count}`);
  lines.push(`- Routes: ${result.summary.declared_route_count}/${result.summary.runtime_api_route_count} declared`);
  lines.push(`- Panels: ${result.summary.runtime_dashboard_panel_count}`);
  lines.push(`- Status cards: ${result.summary.runtime_status_card_count}`);
  lines.push(`- Desktop policy: ${result.summary.desktop_surface_policy}`);
  lines.push("");
  lines.push("## Route Groups");
  for (const group of result.runtime_api_route_groups) {
    lines.push(`- ${group.label}: ${group.route_group_status}, routes ${group.declared_route_count}/${group.route_count}, read-only ${group.read_only}`);
  }
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push("- Desktop Companion is an operator surface only.");
  lines.push("- Runtime execution, process control, test execution, file writes, direct apply/merge, provider keys, installer/gateway control, SSH, and cron control are not exposed.");
  return `${lines.join("\n")}\n`;
}

function summarizePanelMetrics(group, sourceSummaries) {
  return {
    route_count: group.route_count,
    declared_route_count: group.declared_route_count,
    missing_route_count: group.missing_route_count,
    source_count: group.source_artifact_ids.length,
    complete_source_count: sourceSummaries.filter((summary) => Object.values(summary).includes("complete")).length,
    source_validation_error_count: group.source_validation_error_count,
    protected_mutation_request_route_count: group.protected_mutation_request_route_count,
    mutation_route_count: group.mutation_route_count,
  };
}

function routeForSource(sourceId) {
  const routeMap = {
    runtime_adapter_interface_v2: "/api/runtime-adapter-interface-v2",
    hermes_runtime_adapter: "/api/hermes-runtime-adapter",
    claude_code_adapter_contract: "/api/claude-code-adapter-contract",
    codex_adapter_contract: "/api/codex-adapter-contract",
    local_script_adapter: "/api/local-script-adapter",
    document_renderer_adapter: "/api/document-renderer-adapter",
    worktree_manager_v2: "/api/worktree-manager-v2",
    sandbox_policy_model: "/api/sandbox-policy-model",
    docker_local_backend_selector: "/api/docker-local-backend-selector",
    secrets_broker_contract: "/api/secrets-broker-contract",
    runtime_artifact_capture: "/api/runtime-artifact-capture",
    runtime_log_normalization: "/api/runtime-log-normalization",
    runtime_timeout_heartbeat: "/api/runtime-timeout-heartbeat",
    runtime_control_commands: "/api/runtime-control-commands",
    protected_file_gate: "/api/protected-file-gate",
    canonical_test_runner: "/api/canonical-test-runner",
  };
  return routeMap[sourceId] ?? "/api/runtime-api-dashboard";
}

function primaryMetricKey(summary) {
  const preferred = [
    "runtime_adapter_interface_count",
    "current_agent_run_record_count",
    "agent_worktree_plan_count",
    "runtime_sandbox_binding_count",
    "runtime_backend_selection_count",
    "runtime_secret_access_binding_count",
    "artifact_capture_record_count",
    "normalized_log_count",
    "heartbeat_record_count",
    "control_command_request_count",
    "approval_requirement_count",
    "canonical_test_execution_count",
  ];
  return preferred.find((key) => Number.isFinite(Number(summary[key]))) ?? "validation_error_count";
}

function statusFromArtifact(artifact) {
  const summary = artifact?.summary ?? {};
  const statusEntry = Object.entries(summary).find(([key, value]) => key.endsWith("_status") && value === "complete");
  return statusEntry?.[1] ?? summary.status ?? "unknown";
}

function routeDeclared(reviewApiSource, routePath) {
  return reviewApiSource.includes(`pathname === "${routePath}"`);
}

function validationItem(id, condition, message) {
  return {
    validation_item_id: id,
    status: condition ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.validation_item_id,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function source(id, label, kind, option, statusKey) {
  return { source_id: id, label, kind, option, status_key: statusKey };
}

function routeGroup(routeGroupId, routeGroupKind, label, sourceIds, routePaths, options = {}) {
  return {
    route_group_id: routeGroupId,
    route_group_kind: routeGroupKind,
    label,
    source_ids: sourceIds,
    route_paths: routePaths,
    protected_mutation_request_route: Boolean(options.protectedMutationRequestRoute),
  };
}

function sourceRecord(read) {
  return {
    available: Boolean(read.value),
    path: read.path,
    content_hash: read.raw ? hashText(read.raw) : null,
    error: read.error ?? null,
  };
}

function serializableRuntimeApiDashboard(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function snakeCasePathKey(option) {
  return `${option.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).replace(/_path$/, "")}_path`;
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, raw, value: JSON.parse(raw), error: null };
  } catch (error) {
    return { path: filePath, raw: null, value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, raw, value: raw, error: null };
  } catch (error) {
    return { path: filePath, raw: null, value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(isoTimestamp) {
  return isoTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function hashText(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function hashValue(value) {
  return hashText(JSON.stringify(value));
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_RUNTIME_API_DASHBOARD_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-api-dashboard.mjs [--out-dir DIR] [--run-at ISO] [--check]\n\nBuilds the P211 Runtime API/Dashboard read-only Desktop Companion surface.`);
}
