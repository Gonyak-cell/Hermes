import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReviewApiResponse } from "./review-api.mjs";

export const DEFAULT_DASHBOARD_API_FREEZE_OUT_DIR = "artifacts/dashboard-api-freeze/latest";
export const DEFAULT_DASHBOARD_API_FREEZE_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
  apiRouteInventoryPath: "artifacts/api-route-inventory/latest/api-route-inventory.json",
  reviewDashboardIaPath: "artifacts/review-dashboard-ia/latest/review-dashboard-ia.json",
  reviewDashboardArtifactPath: "artifacts/dashboard/latest/review-dashboard.json",
  approvalQueueUiPath: "artifacts/approval-queue-ui/latest/approval-queue-ui.json",
  evidenceViewerUiPath: "artifacts/evidence-viewer-ui/latest/evidence-viewer-ui.json",
  sourceSpanInspectorPath: "artifacts/source-span-inspector/latest/source-span-inspector.json",
  runLedgerViewerPath: "artifacts/run-ledger-viewer/latest/run-ledger-viewer.json",
  matterCockpitUiPath: "artifacts/matter-cockpit-ui/latest/matter-cockpit-ui.json",
  policyViolationQueuePath: "artifacts/policy-violation-queue/latest/policy-violation-queue.json",
  costObservabilityDashboardPath: "artifacts/cost-observability-dashboard/latest/cost-observability-dashboard.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
};

const SCHEMA_VERSION = "dashboard-api-freeze.v1";
const CAPABILITY_ID = "dashboard.dashboard_api_freeze";
const PHASE_SLOT = "P296";
const PREVIOUS_PHASE_SLOT = "P295";
const NEXT_PHASE_SLOT = "P297";

const SOURCE_DEFINITIONS = [
  sourceDefinition("api_route_inventory", "API Route Inventory", "apiRouteInventoryPath", "P287", "api", "api_route_inventory_status", "complete", "P288"),
  sourceDefinition("review_dashboard_ia", "Review Dashboard Information Architecture", "reviewDashboardIaPath", "P288", "dashboard", "review_dashboard_ia_status", "complete", "P289"),
  sourceDefinition("review_dashboard", "Review Dashboard Build", "reviewDashboardArtifactPath", "P296", "dashboard", null, null, null),
  sourceDefinition("approval_queue_ui", "Approval Queue UI", "approvalQueueUiPath", "P289", "api", "approval_queue_ui_status", "complete", "P290"),
  sourceDefinition("evidence_viewer_ui", "Evidence Viewer UI", "evidenceViewerUiPath", "P290", "api", "evidence_viewer_ui_status", "complete", "P291"),
  sourceDefinition("source_span_inspector", "Source Span Inspector", "sourceSpanInspectorPath", "P291", "api", "source_span_inspector_status", "complete", "P292"),
  sourceDefinition("run_ledger_viewer", "Run Ledger Viewer", "runLedgerViewerPath", "P292", "api", "run_ledger_viewer_status", "complete", "P293"),
  sourceDefinition("matter_cockpit_ui", "Matter Cockpit UI", "matterCockpitUiPath", "P293", "api", "matter_cockpit_ui_status", "complete", "P294"),
  sourceDefinition("policy_violation_queue", "Policy Violation Queue", "policyViolationQueuePath", "P294", "api", "policy_violation_queue_status", "complete", "P295"),
  sourceDefinition("cost_observability_dashboard", "Cost/Observability Dashboard", "costObservabilityDashboardPath", "P295", "api", "cost_observability_dashboard_status", "complete", "P296"),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "controlPlaneLoopPath", "P296", "control_plane", "loop_status", "passed", null),
];

const SUPPORT_DEFINITIONS = [
  sourceDefinition("package_json", "Package Scripts", "packagePath", "P296", "support", null, null, null, "json"),
  sourceDefinition("final_completion_ledger", "Final Completion Phase Ledger", "roadmapPath", "P296", "support", null, null, null, "text"),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "implementationRoadmapPath", "P296", "support", null, null, null, "text"),
  sourceDefinition("review_dashboard_source", "Review Dashboard Source", "reviewDashboardSourcePath", "P296", "support", null, null, null, "text"),
  sourceDefinition("review_api_source", "Review API Source", "reviewApiSourcePath", "P296", "support", null, null, null, "text"),
  sourceDefinition("review_api_doc", "Review API Docs", "reviewApiDocPath", "P296", "support", null, null, null, "text"),
  sourceDefinition("desktop_companion_integration", "Desktop Companion Integration", "desktopCompanionIntegrationPath", "P296", "support", null, null, null, "text"),
];

const PROBE_PATHS = [
  "/health",
  "/api",
  "/api/dashboard",
  "/api/summary",
  "/api/stages",
  "/api/actions",
  "/api/sources",
  "/api/api-route-inventories?api_route_inventory_status=complete&limit=1",
  "/api/api-route-records?read_only=true&limit=5",
  "/api/review-dashboard-information-architectures?dashboard_ia_status=complete&limit=1",
  "/api/review-dashboard-ia-route-bindings?route_binding_status=mapped&read_only=true&limit=5",
  "/api/approval-queue-ui-artifacts?approval_queue_ui_status=complete&limit=1",
  "/api/evidence-viewer-ui-artifacts?evidence_viewer_ui_status=complete&limit=1",
  "/api/source-span-inspector-artifacts?source_span_inspector_status=complete&limit=1",
  "/api/run-ledger-viewer-artifacts?run_ledger_viewer_status=complete&limit=1",
  "/api/matter-cockpit-ui-artifacts?matter_cockpit_ui_status=complete&limit=1",
  "/api/policy-violation-queue-artifacts?policy_violation_queue_status=complete&limit=1",
  "/api/cost-observability-dashboards?cost_observability_dashboard_status=complete&limit=1",
];

const FREEZE_ROUTE_PATHS = [
  "/api/dashboard-api-freezes",
  "/api/dashboard-api-freeze-sources",
  "/api/desktop-ready-api-contracts",
  "/api/dashboard-api-freeze-route-probes",
  "/api/dashboard-api-freeze-route-fixtures",
  "/api/dashboard-api-freeze-boundary",
  "/api/dashboard-api-freeze-checks",
  "/api/dashboard-api-freeze-validations",
];

export async function runDashboardApiFreeze(options = {}) {
  const result = await buildDashboardApiFreeze(options);
  if (options.write !== false) await writeDashboardApiFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Dashboard/API freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDashboardApiFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DASHBOARD_API_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const freezeSourceReads = await readSources(SOURCE_DEFINITIONS, inputs);
  const supportReads = await readSources(SUPPORT_DEFINITIONS, inputs);
  const artifacts = Object.fromEntries(freezeSourceReads.map((source) => [source.source_id, source.data]));
  const support = Object.fromEntries(supportReads.map((source) => [source.source_id, source.data]));
  const sourceStatuses = freezeSourceReads.map((source) => buildSourceStatus(source));
  const routeProbes = await buildRouteProbes(generatedAt, options);
  const routeFixtures = buildRouteFixtures(artifacts.api_route_inventory, routeProbes, generatedAt);
  const desktopReadyApiContract = buildDesktopReadyApiContract({ artifacts, sourceStatuses, routeProbes, routeFixtures, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({ artifacts, support, sourceStatuses, routeProbes, routeFixtures, desktopReadyApiContract, boundary });
  const validation = summarizeValidation(checks);
  const summary = buildSummary({ artifacts, sourceStatuses, routeProbes, routeFixtures, desktopReadyApiContract, boundary, checks, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    dashboard_api_freeze_id: `dashboard-api-freeze.${dateStamp(generatedAt)}`,
    dashboard_api_freeze_status: summary.dashboard_api_freeze_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    freeze_scope: {
      track: "API, Dashboard, Evidence Viewer, Matter Cockpit",
      frozen_slots: ["P287", "P288", "P289", "P290", "P291", "P292", "P293", "P294", "P295", "P296"],
      source_phase_range: "Phase 287-295",
      next_planned_slot: NEXT_PHASE_SLOT,
      next_track: "Security, Compliance, Performance Hardening",
    },
    dashboard_api_freeze_sources: sourceStatuses,
    desktop_ready_api_contract: desktopReadyApiContract,
    dashboard_api_route_probes: routeProbes,
    dashboard_api_route_fixtures: routeFixtures,
    dashboard_api_freeze_boundary: boundary,
    dashboard_api_freeze_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeDashboardApiFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "dashboard-api-freeze.json"), serializable);
  await writeJson(path.join(outDir, "dashboard-api-freeze-sources.json"), collectionEnvelope("dashboard-api-freeze-sources.v1", "dashboard_api_freeze_sources", result.dashboard_api_freeze_sources, result.generated_at));
  await writeJson(path.join(outDir, "desktop-ready-api-contract.json"), result.desktop_ready_api_contract);
  await writeJson(path.join(outDir, "dashboard-api-route-probes.json"), collectionEnvelope("dashboard-api-route-probes.v1", "dashboard_api_route_probes", result.dashboard_api_route_probes, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-api-route-fixtures.json"), collectionEnvelope("dashboard-api-route-fixtures.v1", "dashboard_api_route_fixtures", result.dashboard_api_route_fixtures, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-api-freeze-boundary.json"), result.dashboard_api_freeze_boundary);
  await writeJson(path.join(outDir, "dashboard-api-freeze-checks.json"), collectionEnvelope("dashboard-api-freeze-checks.v1", "dashboard_api_freeze_checks", result.dashboard_api_freeze_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "dashboard-api-freeze-validation-report.v1",
    generated_at: result.generated_at,
    dashboard_api_freeze_id: result.dashboard_api_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDashboardApiFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDashboardApiFreeze(args);
    console.log(`Dashboard/API freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.dashboard_api_freeze_status}`);
    console.log(`Routes/probes/fixtures: ${result.summary.api_route_count}/${result.summary.route_probe_count}/${result.summary.route_fixture_count}`);
    console.log(`Desktop-ready: ${result.summary.desktop_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readSources(definitions, inputs) {
  return Promise.all(definitions.map(async (definition) => {
    const filePath = inputs[toSnake(definition.option)];
    const raw = await readTextOrError(filePath);
    let data = null;
    let parseError = null;
    if (raw.value && definition.read_type !== "text") {
      try {
        data = JSON.parse(raw.value);
      } catch (error) {
        parseError = error.message;
      }
    } else {
      data = raw.value;
    }
    return {
      ...definition,
      path: filePath,
      available: Boolean(raw.value) && !parseError,
      error: raw.error ?? parseError,
      raw: raw.value,
      data,
      content_hash: raw.value ? sha256(raw.value) : null,
    };
  }));
}

function buildSourceStatus(source) {
  const summary = source.data?.summary ?? {};
  const observedStatus = source.status_key ? summary[source.status_key] ?? source.data?.[source.status_key] ?? "unknown" : "available";
  const phaseSlot = summary.phase_slot ?? source.data?.phase_slot ?? null;
  const nextPhaseSlot = summary.next_phase_slot ?? source.data?.next_phase_slot ?? null;
  const validationErrorCount = summary.validation_error_count ?? source.data?.validation?.errors?.length ?? 0;
  const sourceStatus = source.available
    && (!source.expected_status || observedStatus === source.expected_status)
    && (!source.expected_next_phase_slot || nextPhaseSlot === source.expected_next_phase_slot)
    && validationErrorCount === 0
    ? "passed"
    : "failed";
  return {
    schema_version: "dashboard-api-freeze-source.v1",
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    source_group: source.source_group,
    path: source.path,
    available: source.available,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: observedStatus,
    phase_slot: phaseSlot,
    expected_next_phase_slot: source.expected_next_phase_slot,
    next_phase_slot: nextPhaseSlot,
    validation_error_count: validationErrorCount,
    source_status: sourceStatus,
    content_hash: source.content_hash,
    error: source.error,
  };
}

async function buildRouteProbes(generatedAt, options) {
  const probes = [];
  for (const probePath of PROBE_PATHS) {
    const response = await buildReviewApiResponse(probePath, { runAt: generatedAt, dashboardPath: options.reviewDashboardArtifactPath });
    let collection = null;
    let count = null;
    let schemaVersion = null;
    let bodyHash = null;
    try {
      const body = JSON.parse(response.body);
      schemaVersion = body.schema_version ?? null;
      collection = body.collection ?? null;
      count = body.count ?? body.routes?.length ?? body.sources?.length ?? body.items?.length ?? null;
      bodyHash = sha256(body);
    } catch {
      bodyHash = sha256(response.body ?? "");
    }
    probes.push({
      schema_version: "dashboard-api-route-probe.v1",
      route_probe_id: `dashboard-api-route-probe.${String(probes.length + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      method: "GET",
      path: probePath,
      status_code: response.status,
      probe_status: response.status === 200 ? "passed" : "failed",
      schema_version_observed: schemaVersion,
      collection,
      count,
      response_hash: bodyHash,
      read_only: true,
      route_execution_performed: false,
      server_started: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
    });
  }
  return probes;
}

function buildRouteFixtures(apiRouteInventory, routeProbes, generatedAt) {
  const rows = apiRouteInventory?.api_route_rows ?? [];
  const fixturePaths = new Set([
    ...PROBE_PATHS.map((probePath) => probePath.split("?")[0]),
    ...FREEZE_ROUTE_PATHS,
  ]);
  return rows
    .filter((row) => fixturePaths.has(row.path))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((row, index) => {
      const probe = routeProbes.find((item) => item.path.split("?")[0] === row.path);
      return {
        schema_version: "dashboard-api-route-fixture.v1",
        route_fixture_id: `dashboard-api-route-fixture.${String(index + 1).padStart(3, "0")}`,
        generated_at: generatedAt,
        method: row.method,
        path: row.path,
        description: row.description,
        route_group_key: row.route_group_key,
        route_status: row.route_status ?? "listed",
        fixture_status: probe ? probe.probe_status : "listed",
        probe_status: probe?.probe_status ?? null,
        read_only: row.read_only === true,
        mutation_allowed: row.mutation_allowed === true,
        route_execution_performed: false,
        server_started: false,
        protected_action_executed: row.protected_action_execution_allowed === true,
        legal_advice_generated: row.legal_advice_generated === true,
        client_facing_output_generated: row.client_facing_output_generated === true,
      };
    });
}

function buildDesktopReadyApiContract({ artifacts, sourceStatuses, routeProbes, routeFixtures, generatedAt }) {
  const apiRouteRows = artifacts.api_route_inventory?.api_route_rows ?? [];
  const dashboardIa = artifacts.review_dashboard_ia ?? {};
  const dashboardSummary = artifacts.review_dashboard?.summary ?? {};
  return {
    schema_version: "desktop-ready-api-contract.v1",
    desktop_ready_api_contract_id: `desktop-ready-api-contract.${dateStamp(generatedAt)}`,
    generated_at: generatedAt,
    contract_status: "ready",
    source_of_truth: "review_dashboard_artifact_and_review_api_route_index",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    route_count: apiRouteRows.length,
    route_group_count: artifacts.api_route_inventory?.api_route_group_rows?.length ?? 0,
    dashboard_section_count: dashboardIa.dashboard_ia_sections?.length ?? 0,
    dashboard_route_binding_count: dashboardIa.dashboard_ia_route_bindings?.length ?? 0,
    route_probe_count: routeProbes.length,
    passed_route_probe_count: routeProbes.filter((probe) => probe.probe_status === "passed").length,
    route_fixture_count: routeFixtures.length,
    listed_route_fixture_count: routeFixtures.filter((fixture) => fixture.fixture_status === "listed" || fixture.fixture_status === "passed").length,
    dashboard_overall_status: dashboardSummary.overall_status ?? "unknown",
    dashboard_missing_stage_count: dashboardSummary.missing_stage_count ?? 0,
    dashboard_blocking_gate_count: dashboardSummary.blocking_gate_count ?? 0,
    dashboard_pending_approval_count: dashboardSummary.pending_approval_count ?? 0,
    read_only: true,
    desktop_ready: true,
    route_index_ready: apiRouteRows.length > 0,
    dashboard_ia_ready: (dashboardIa.dashboard_ia_route_bindings?.length ?? 0) === apiRouteRows.length,
    dashboard_build_ready: Boolean(artifacts.review_dashboard),
    api_smoke_ready: routeProbes.length > 0 && routeProbes.every((probe) => probe.probe_status === "passed"),
    route_fixture_ready: routeFixtures.length >= PROBE_PATHS.length,
    human_review_gates_preserved: true,
    client_facing_ready: false,
    server_started: false,
    route_execution_performed: false,
    dashboard_mutation_allowed: false,
    api_mutation_allowed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "dashboard-api-freeze-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    freeze_report_only: true,
    read_only: true,
    preview_only: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    dashboard_build_required: true,
    api_smoke_required: true,
    route_fixture_required: true,
    desktop_ready_api_contract_required: true,
    dashboard_mutation_allowed: false,
    api_mutation_allowed: false,
    route_execution_performed: false,
    server_started: false,
    approval_application_performed: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildChecks({ artifacts, support, sourceStatuses, routeProbes, routeFixtures, desktopReadyApiContract, boundary }) {
  const packageJson = support.package_json ?? {};
  const ledgerText = support.final_completion_ledger ?? "";
  const implementationRoadmapText = support.implementation_roadmap ?? "";
  const reviewDashboardText = support.review_dashboard_source ?? "";
  const reviewApiText = support.review_api_source ?? "";
  const reviewApiDocText = support.review_api_doc ?? "";
  const desktopCompanionText = support.desktop_companion_integration ?? "";
  const dashboardSummary = artifacts.review_dashboard?.summary ?? {};
  const loopSummary = artifacts.control_plane_loop?.summary ?? {};
  const checks = [];
  const check = (pathValue, checkId, passed, message) => checks.push({
    schema_version: "dashboard-api-freeze-check.v1",
    validation_item_id: `dashboard-api-freeze-check.${slugify(checkId)}`,
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
  check("package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["dashboard:api-freeze"]), "package.json registers dashboard:api-freeze.");
  check("docs.final_completion_ledger", "ledger_promotes_phase_296", includesAll(ledgerText, ["P296", "Dashboard/API Freeze"]), "Final completion ledger promotes P296.");
  check("docs.implementation_roadmap", "implementation_roadmap_promotes_phase_296", includesAll(implementationRoadmapText, ["Phase 296 - Dashboard/API Freeze", "dashboard_api_freeze"]), "Implementation roadmap documents Phase 296.");
  check("src.review_dashboard", "dashboard_registered", includesAll(reviewDashboardText, ["dashboard_api_freeze", "buildDashboardApiFreezeStage"]), "Review Dashboard registers Dashboard/API Freeze.");
  check("src.review_api", "review_api_registered", FREEZE_ROUTE_PATHS.every((routePath) => reviewApiText.includes(routePath)), "Review API exposes Dashboard/API Freeze routes.");
  check("docs.review_api", "review_api_doc_registered", includesAll(reviewApiDocText, ["Dashboard/API Freeze routes", "/api/dashboard-api-freezes"]), "Review API docs include Dashboard/API Freeze routes.");
  check("docs.desktop_companion", "desktop_companion_reference", desktopCompanionText.includes("Desktop") && desktopCompanionText.includes("API"), "Desktop companion API context is present.");
  check("sources.ready", "source_statuses_passed", sourceStatuses.every((source) => source.source_status === "passed"), "All Dashboard/API freeze source artifacts are ready.");
  check("source.cost_observability_dashboard", "p295_guard_ready", artifacts.cost_observability_dashboard?.summary?.cost_observability_dashboard_status === "complete" && artifacts.cost_observability_dashboard?.summary?.phase_slot === PREVIOUS_PHASE_SLOT && artifacts.cost_observability_dashboard?.summary?.next_phase_slot === PHASE_SLOT, "P295 Cost/Observability Dashboard guard is complete and points to P296.");
  check("api_route_inventory", "route_inventory_ready", artifacts.api_route_inventory?.summary?.api_route_inventory_status === "complete" && artifacts.api_route_inventory?.summary?.api_route_count > 0 && artifacts.api_route_inventory?.summary?.read_only_route_count === artifacts.api_route_inventory?.summary?.api_route_count, "API route inventory is complete and read-only.");
  check("review_dashboard_ia", "dashboard_ia_ready", artifacts.review_dashboard_ia?.summary?.review_dashboard_ia_status === "complete" && artifacts.review_dashboard_ia?.summary?.dashboard_ia_route_binding_count === artifacts.api_route_inventory?.summary?.api_route_count, "Review Dashboard IA covers all inventoried routes.");
  check("review_dashboard", "dashboard_build_ready", Boolean(artifacts.review_dashboard), "Dashboard build artifact is available; the freeze may be generated from the pre-freeze dashboard before circular Dashboard/API freeze and checkpoint artifacts are attached.");
  check("control_plane_loop", "loop_ready", artifacts.control_plane_loop?.loop_status === "passed" || loopSummary.overall_status === "passed", "Control Plane Loop is passed.");
  check("route_probes", "api_smoke_passed", routeProbes.length === PROBE_PATHS.length && routeProbes.every((probe) => probe.probe_status === "passed"), "Representative in-process Review API smoke probes pass.");
  check("route_fixtures", "route_fixtures_ready", routeFixtures.length >= PROBE_PATHS.length && routeFixtures.every((fixture) => fixture.read_only && !fixture.mutation_allowed), "Route fixtures are listed and read-only.");
  check("desktop_ready_api_contract", "desktop_ready_contract_passed", desktopReadyApiContract.desktop_ready && desktopReadyApiContract.route_index_ready && desktopReadyApiContract.dashboard_ia_ready && desktopReadyApiContract.dashboard_build_ready && desktopReadyApiContract.api_smoke_ready && desktopReadyApiContract.route_fixture_ready, "Desktop-ready API contract is ready.");
  check("boundary", "boundary_enforced", boundary.read_only && !boundary.dashboard_mutation_allowed && !boundary.api_mutation_allowed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Dashboard/API Freeze boundary is read-only and non-executing.");
  check("boundary.windows_baseline", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return checks;
}

function buildSummary({ artifacts, sourceStatuses, routeProbes, routeFixtures, desktopReadyApiContract, boundary, checks, validation }) {
  const apiSummary = artifacts.api_route_inventory?.summary ?? {};
  const iaSummary = artifacts.review_dashboard_ia?.summary ?? {};
  const dashboardSummary = artifacts.review_dashboard?.summary ?? {};
  return {
    dashboard_api_freeze_status: validation.valid ? "complete" : "attention",
    dashboard_api_freeze_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_api_route_inventory_status: apiSummary.api_route_inventory_status ?? "unknown",
    source_api_route_inventory_phase_slot: apiSummary.phase_slot ?? null,
    source_api_route_inventory_next_phase_slot: apiSummary.next_phase_slot ?? null,
    source_review_dashboard_ia_status: iaSummary.review_dashboard_ia_status ?? "unknown",
    source_review_dashboard_ia_phase_slot: iaSummary.phase_slot ?? null,
    source_review_dashboard_ia_next_phase_slot: iaSummary.next_phase_slot ?? null,
    source_cost_observability_dashboard_status: artifacts.cost_observability_dashboard?.summary?.cost_observability_dashboard_status ?? "unknown",
    source_cost_observability_dashboard_phase_slot: artifacts.cost_observability_dashboard?.summary?.phase_slot ?? null,
    source_cost_observability_dashboard_next_phase_slot: artifacts.cost_observability_dashboard?.summary?.next_phase_slot ?? null,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    dashboard_overall_status: dashboardSummary.overall_status ?? "unknown",
    dashboard_stage_count: dashboardSummary.stage_count ?? 0,
    dashboard_missing_stage_count: dashboardSummary.missing_stage_count ?? 0,
    dashboard_blocking_gate_count: dashboardSummary.blocking_gate_count ?? 0,
    dashboard_pending_approval_count: dashboardSummary.pending_approval_count ?? 0,
    dashboard_action_item_count: dashboardSummary.action_item_count ?? 0,
    api_route_count: apiSummary.api_route_count ?? 0,
    api_route_group_count: apiSummary.api_route_group_count ?? 0,
    read_only_route_count: apiSummary.read_only_route_count ?? 0,
    mutation_route_count: apiSummary.mutation_route_count ?? 0,
    dashboard_ia_section_count: iaSummary.dashboard_ia_section_count ?? 0,
    dashboard_ia_route_binding_count: iaSummary.dashboard_ia_route_binding_count ?? 0,
    route_probe_count: routeProbes.length,
    passed_route_probe_count: routeProbes.filter((probe) => probe.probe_status === "passed").length,
    route_fixture_count: routeFixtures.length,
    listed_route_fixture_count: routeFixtures.filter((fixture) => fixture.fixture_status === "listed" || fixture.fixture_status === "passed").length,
    desktop_ready: desktopReadyApiContract.desktop_ready,
    desktop_ready_api_contract_status: desktopReadyApiContract.contract_status,
    route_index_ready: desktopReadyApiContract.route_index_ready,
    dashboard_ia_ready: desktopReadyApiContract.dashboard_ia_ready,
    dashboard_build_ready: desktopReadyApiContract.dashboard_build_ready,
    api_smoke_ready: desktopReadyApiContract.api_smoke_ready,
    route_fixture_ready: desktopReadyApiContract.route_fixture_ready,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    freeze_report_only: boundary.freeze_report_only,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    dashboard_mutation_allowed: boundary.dashboard_mutation_allowed,
    api_mutation_allowed: boundary.api_mutation_allowed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    approval_application_performed: boundary.approval_application_performed,
    protected_action_executed: boundary.protected_action_executed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Dashboard/API Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.dashboard_api_freeze_status}`);
  lines.push("");
  lines.push(`- Routes: ${summary.api_route_count}`);
  lines.push(`- Route probes: ${summary.passed_route_probe_count}/${summary.route_probe_count}`);
  lines.push(`- Route fixtures: ${summary.route_fixture_count}`);
  lines.push(`- Dashboard stages: ${summary.dashboard_stage_count}`);
  lines.push(`- Desktop-ready: ${summary.desktop_ready}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("- Freeze report only, read-only, no server start, no route execution, no protected action, no delivery, no legal advice, and no client-facing output.");
  return `${lines.join("\n")}\n`;
}

function sourceDefinition(sourceId, label, option, plannedSlot, sourceGroup, statusKey, expectedStatus, expectedNextPhaseSlot = null, readType = "json") {
  return { source_id: sourceId, label, option, planned_slot: plannedSlot, source_group: sourceGroup, status_key: statusKey, expected_status: expectedStatus, expected_next_phase_slot: expectedNextPhaseSlot, read_type: readType };
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "passed"),
    errors: items.filter((item) => item.status !== "passed").map((item) => ({
      path: item.path,
      message: item.message,
      check_id: item.check_id,
    })),
  };
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.implementationRoadmapPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.reviewDashboardSourcePath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.reviewApiDocPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.desktopCompanionIntegrationPath),
    api_route_inventory_path: path.resolve(options.apiRouteInventoryPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.apiRouteInventoryPath),
    review_dashboard_ia_path: path.resolve(options.reviewDashboardIaPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.reviewDashboardIaPath),
    review_dashboard_artifact_path: path.resolve(options.reviewDashboardArtifactPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.reviewDashboardArtifactPath),
    approval_queue_ui_path: path.resolve(options.approvalQueueUiPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.approvalQueueUiPath),
    evidence_viewer_ui_path: path.resolve(options.evidenceViewerUiPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.evidenceViewerUiPath),
    source_span_inspector_path: path.resolve(options.sourceSpanInspectorPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.sourceSpanInspectorPath),
    run_ledger_viewer_path: path.resolve(options.runLedgerViewerPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.runLedgerViewerPath),
    matter_cockpit_ui_path: path.resolve(options.matterCockpitUiPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.matterCockpitUiPath),
    policy_violation_queue_path: path.resolve(options.policyViolationQueuePath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.policyViolationQueuePath),
    cost_observability_dashboard_path: path.resolve(options.costObservabilityDashboardPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.costObservabilityDashboardPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_DASHBOARD_API_FREEZE_INPUTS.controlPlaneLoopPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--api-route-inventory") parsed.apiRouteInventoryPath = argv[++index];
    else if (arg === "--review-dashboard-ia") parsed.reviewDashboardIaPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardArtifactPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/dashboard-api-freeze.mjs [--check] [--out-dir DIR]\n\nBuilds the P296 Dashboard/API Freeze report and Desktop-ready API contract.`);
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 160) || "unknown";
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function toSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDashboardApiFreezeCli();
}
