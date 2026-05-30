import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReviewApiResponse } from "./review-api.mjs";

export const DEFAULT_API_ROUTE_INVENTORY_OUT_DIR = "artifacts/api-route-inventory/latest";
export const DEFAULT_API_ROUTE_INVENTORY_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiDocPath: "docs/review-api.md",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
  contractInventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
  resourceExpansionFreezePath: "artifacts/resource-expansion-freeze/latest/resource-expansion-freeze.json",
};

const SCHEMA_VERSION = "api-route-inventory.v1";
const CAPABILITY_ID = "api.api_route_inventory";
const PHASE_SLOT = "P287";
const PREVIOUS_PHASE_SLOT = "P286";
const NEXT_PHASE_SLOT = "P288";
const REQUIRED_GROUP_KEYS = ["core", "review", "evidence", "policy", "runtime", "desktop_companion"];
const REQUIRED_ROUTE_PATHS = [
  "/api",
  "/api/dashboard",
  "/api/sources",
  "/api/evidence-items",
  "/api/policy-matrices",
  "/api/runtime-api-dashboard",
  "/api/desktop-companion-route-groups",
  "/api/api-route-inventories",
  "/api/api-route-groups",
  "/api/api-route-records",
];
const INVENTORY_ROUTE_PATHS = [
  "/api/api-route-inventories",
  "/api/api-route-groups",
  "/api/api-route-records",
  "/api/api-route-inventory-checks",
  "/api/api-route-inventory-boundary",
  "/api/api-route-inventory-validations",
];

export async function runApiRouteInventory(options = {}) {
  const result = await buildApiRouteInventory(options);
  if (options.write !== false) await writeApiRouteInventory(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`API route inventory validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildApiRouteInventory(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_API_ROUTE_INVENTORY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const implementationRoadmapText = await readText(inputs.implementation_roadmap_path);
  const reviewApiText = await readText(inputs.review_api_path);
  const reviewDashboardText = await readText(inputs.review_dashboard_path);
  const reviewApiDocText = await readText(inputs.review_api_doc_path);
  const desktopCompanionText = await readText(inputs.desktop_companion_integration_path);
  const contractInventory = await readJson(inputs.contract_inventory_path);
  const resourceExpansionFreeze = await readJson(inputs.resource_expansion_freeze_path);
  const routeIndex = await readReviewApiRouteIndex(generatedAt);
  const apiRouteRows = buildApiRouteRows(routeIndex.routes ?? [], generatedAt);
  const apiRouteGroupRows = buildApiRouteGroupRows(apiRouteRows, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewApiText,
    reviewDashboardText,
    reviewApiDocText,
    desktopCompanionText,
    contractInventory,
    resourceExpansionFreeze,
    routeIndex,
    apiRouteRows,
    apiRouteGroupRows,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeApiRouteInventory({
    routeIndex,
    apiRouteRows,
    apiRouteGroupRows,
    checks,
    validation,
    contractInventory,
    resourceExpansionFreeze,
    boundary,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    api_route_inventory_id: `api-route-inventory.${dateStamp(generatedAt)}`,
    api_route_inventory_status: validation.valid ? "complete" : "attention",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      routeIndex,
      contractInventory,
      resourceExpansionFreeze,
      reviewApiText,
      reviewDashboardText,
      reviewApiDocText,
      desktopCompanionText,
    }),
    api_route_inventory_contract: {
      schema_version: "api-route-inventory-contract.v1",
      contract_id: SCHEMA_VERSION,
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      required_route_groups: REQUIRED_GROUP_KEYS,
      required_route_paths: REQUIRED_ROUTE_PATHS,
      inventory_route_paths: INVENTORY_ROUTE_PATHS,
      read_only: true,
      mutation_allowed: false,
      protected_action_execution_allowed: false,
      client_facing_output_allowed: false,
    },
    api_route_group_rows: apiRouteGroupRows,
    api_route_rows: apiRouteRows,
    api_route_inventory_boundary: boundary,
    api_route_inventory_checks: checks,
    validation_items: checks,
    validation,
    summary,
    summary_markdown: renderSummary({ summary, apiRouteGroupRows }),
  };
  return result;
}

export async function writeApiRouteInventory(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "api-route-inventory.json"), result);
  await writeJson(path.join(outDir, "api-route-groups.json"), {
    schema_version: "api-route-groups.v1",
    generated_at: result.generated_at,
    api_route_group_count: result.api_route_group_rows.length,
    api_route_group_rows: result.api_route_group_rows,
  });
  await writeJson(path.join(outDir, "api-route-records.json"), {
    schema_version: "api-route-records.v1",
    generated_at: result.generated_at,
    api_route_count: result.api_route_rows.length,
    api_route_rows: result.api_route_rows,
  });
  await writeJson(path.join(outDir, "api-route-inventory-boundary.json"), result.api_route_inventory_boundary);
  await writeJson(path.join(outDir, "api-route-inventory-checks.json"), {
    schema_version: "api-route-inventory-checks.v1",
    generated_at: result.generated_at,
    api_route_inventory_check_count: result.api_route_inventory_checks.length,
    api_route_inventory_checks: result.api_route_inventory_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "api-route-inventory-validation-report.v1",
    generated_at: result.generated_at,
    api_route_inventory_id: result.api_route_inventory_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runApiRouteInventoryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runApiRouteInventory(args);
    console.log(`API route inventory ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.api_route_inventory_status}`);
    console.log(`Routes: ${result.summary.api_route_count}`);
    console.log(`Groups: ${result.summary.api_route_group_count}`);
    console.log(`Required groups: ${result.summary.required_group_count}/${result.summary.listed_required_group_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readReviewApiRouteIndex(generatedAt) {
  const response = await buildReviewApiResponse("/api", { runAt: generatedAt });
  if (response.status !== 200) throw new Error(`Review API route index returned HTTP ${response.status}.`);
  return JSON.parse(response.body);
}

function buildApiRouteRows(routes, generatedAt) {
  return [...routes]
    .sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method))
    .map((routeRecord, index) => {
      const routeGroup = classifyRouteGroup(routeRecord);
      return {
        api_route_row_id: `api-route.${String(index + 1).padStart(4, "0")}`,
        generated_at: generatedAt,
        method: routeRecord.method,
        path: routeRecord.path,
        description: routeRecord.description,
        route_group_key: routeGroup.route_group_key,
        route_group_label: routeGroup.label,
        route_status: "listed",
        read_only: routeRecord.method === "GET",
        mutation_allowed: false,
        protected_action_execution_allowed: false,
        legal_advice_generated: false,
        client_facing_output_generated: false,
        human_review_required: true,
        client_facing_ready: false,
        route_hash: sha256(`${routeRecord.method}:${routeRecord.path}:${routeRecord.description}`),
      };
    });
}

function buildApiRouteGroupRows(apiRouteRows, generatedAt) {
  return REQUIRED_GROUP_KEYS.map((routeGroupKey) => {
    const definition = routeGroupDefinition(routeGroupKey);
    const rows = apiRouteRows.filter((row) => row.route_group_key === routeGroupKey);
    const representativeRoutes = rows.slice(0, 12).map((row) => row.path);
    return {
      api_route_group_row_id: `api-route-group.${routeGroupKey}`,
      generated_at: generatedAt,
      route_group_key: routeGroupKey,
      route_group_label: definition.label,
      route_group_status: rows.length > 0 && rows.every((row) => row.route_status === "listed" && row.read_only && !row.mutation_allowed) ? "listed" : "attention",
      route_count: rows.length,
      read_only_route_count: rows.filter((row) => row.read_only).length,
      mutation_route_count: rows.filter((row) => row.mutation_allowed).length,
      protected_action_execution_route_count: rows.filter((row) => row.protected_action_execution_allowed).length,
      legal_advice_route_count: rows.filter((row) => row.legal_advice_generated).length,
      client_facing_output_route_count: rows.filter((row) => row.client_facing_output_generated).length,
      representative_routes: representativeRoutes,
      inventory_scope: definition.scope,
      human_review_required: true,
      client_facing_ready: false,
      route_group_hash: sha256({ routeGroupKey, representativeRoutes, routeCount: rows.length }),
    };
  });
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "api-route-inventory.boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    inventory_only: true,
    route_execution_performed: false,
    server_started: false,
    mutation_allowed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    source_of_truth: "review_api_route_index",
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildChecks(context) {
  const {
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewApiText,
    reviewDashboardText,
    reviewApiDocText,
    desktopCompanionText,
    contractInventory,
    resourceExpansionFreeze,
    routeIndex,
    apiRouteRows,
    apiRouteGroupRows,
    boundary,
  } = context;
  const routePaths = new Set(apiRouteRows.map((row) => row.path));
  const duplicateRouteCount = apiRouteRows.length - new Set(apiRouteRows.map((row) => `${row.method}:${row.path}`)).size;
  const groupByKey = new Map(apiRouteGroupRows.map((row) => [row.route_group_key, row]));
  const contractInventoryRouteCount = contractInventory.summary?.api_route_count ?? contractInventory.api_routes?.length ?? 0;
  return [
    check("source.review_api_route_index", routeIndex.schema_version === "review-api-index.v1" && apiRouteRows.length > 0, "Review API route index is readable and non-empty."),
    check("source.contract_inventory", contractInventory.summary?.inventory_status === "complete" && contractInventoryRouteCount >= apiRouteRows.length, "Contract inventory has parsed Review API routes."),
    check("source.resource_expansion_freeze", resourceExpansionFreeze.summary?.resource_expansion_freeze_status === "complete" && resourceExpansionFreeze.summary?.phase_slot === "P286" && resourceExpansionFreeze.summary?.next_phase_slot === "P287", "P286 Resource Expansion Freeze is complete and points to P287."),
    check("routes.required_declared", REQUIRED_ROUTE_PATHS.every((routePath) => routePaths.has(routePath)), "Required P287 route examples are declared."),
    check("routes.inventory_declared", INVENTORY_ROUTE_PATHS.every((routePath) => routePaths.has(routePath) && reviewApiText.includes(routePath)), "API route inventory routes are declared in Review API."),
    check("routes.unique", duplicateRouteCount === 0, "Route method/path pairs are unique.", { duplicate_route_count: duplicateRouteCount }),
    check("routes.read_only", apiRouteRows.length > 0 && apiRouteRows.every((row) => row.method === "GET" && row.read_only && row.mutation_allowed === false), "All inventoried routes are GET/read-only."),
    check("groups.required_listed", REQUIRED_GROUP_KEYS.every((key) => (groupByKey.get(key)?.route_count ?? 0) > 0), "Required core/review/evidence/policy/runtime/desktop_companion route groups are listed."),
    check("groups.complete_partition", sum(apiRouteGroupRows.map((row) => row.route_count)) === apiRouteRows.length, "Route group counts partition the route index."),
    check("groups.safe_boundary", apiRouteGroupRows.every((row) => row.mutation_route_count === 0 && row.protected_action_execution_route_count === 0 && row.legal_advice_route_count === 0 && row.client_facing_output_route_count === 0), "Route groups preserve no-mutation/no-legal/no-client-facing boundary."),
    check("surface.package_script", hasScript(packageJson, "api:route-inventory"), "package.json exposes api:route-inventory."),
    check("surface.dashboard_api_loop", reviewDashboardText.includes("api_route_inventory") && reviewDashboardText.includes("buildApiRouteInventoryStage") && reviewApiText.includes("/api/api-route-inventories"), "Review Dashboard and Review API expose API Route Inventory."),
    check("surface.docs", reviewApiDocText.includes("API Route Inventory") && desktopCompanionText.includes("Desktop Companion"), "Review API and Desktop Companion docs are available for route grouping."),
    check("surface.ledger_roadmap", roadmapText.includes("P287") && roadmapText.includes("API Route Inventory") && implementationRoadmapText.includes("Phase 287") && implementationRoadmapText.includes("API Route Inventory"), "Ledger and implementation roadmap promote Phase 287."),
    check("boundary.read_only", boundary.read_only && boundary.inventory_only && !boundary.route_execution_performed && !boundary.server_started && !boundary.mutation_allowed && !boundary.protected_action_executed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "API route inventory boundary is read-only and non-executing."),
    check("boundary.windows_baseline", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
  ];
}

function summarizeApiRouteInventory({ routeIndex, apiRouteRows, apiRouteGroupRows, checks, validation, contractInventory, resourceExpansionFreeze, boundary }) {
  const groupCounts = Object.fromEntries(apiRouteGroupRows.map((row) => [row.route_group_key, row.route_count]));
  return {
    api_route_inventory_status: validation.valid ? "complete" : "attention",
    api_route_inventory_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_review_api_schema_version: routeIndex.schema_version ?? null,
    source_contract_inventory_status: contractInventory.summary?.inventory_status ?? "unknown",
    source_contract_inventory_api_route_count: contractInventory.summary?.api_route_count ?? contractInventory.api_routes?.length ?? 0,
    source_resource_expansion_freeze_status: resourceExpansionFreeze.summary?.resource_expansion_freeze_status ?? "unknown",
    source_resource_expansion_freeze_phase_slot: resourceExpansionFreeze.summary?.phase_slot ?? null,
    source_resource_expansion_freeze_next_phase_slot: resourceExpansionFreeze.summary?.next_phase_slot ?? null,
    required_group_count: REQUIRED_GROUP_KEYS.length,
    listed_required_group_count: apiRouteGroupRows.filter((row) => REQUIRED_GROUP_KEYS.includes(row.route_group_key) && row.route_count > 0).length,
    api_route_group_count: apiRouteGroupRows.length,
    api_route_count: apiRouteRows.length,
    read_only_route_count: apiRouteRows.filter((row) => row.read_only).length,
    mutation_route_count: apiRouteRows.filter((row) => row.mutation_allowed).length,
    protected_action_execution_route_count: apiRouteRows.filter((row) => row.protected_action_execution_allowed).length,
    legal_advice_route_count: apiRouteRows.filter((row) => row.legal_advice_generated).length,
    client_facing_output_route_count: apiRouteRows.filter((row) => row.client_facing_output_generated).length,
    core_route_count: groupCounts.core ?? 0,
    review_route_count: groupCounts.review ?? 0,
    evidence_route_count: groupCounts.evidence ?? 0,
    policy_route_count: groupCounts.policy ?? 0,
    runtime_route_count: groupCounts.runtime ?? 0,
    desktop_companion_route_count: groupCounts.desktop_companion ?? 0,
    route_partition_count: sum(apiRouteGroupRows.map((row) => row.route_count)),
    missing_required_route_count: REQUIRED_ROUTE_PATHS.filter((routePath) => !apiRouteRows.some((row) => row.path === routePath)).length,
    inventory_route_count: INVENTORY_ROUTE_PATHS.filter((routePath) => apiRouteRows.some((row) => row.path === routePath)).length,
    boundary_status: boundary.boundary_status,
    read_only: boundary.read_only,
    inventory_only: boundary.inventory_only,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    mutation_allowed: boundary.mutation_allowed,
    protected_action_executed: boundary.protected_action_executed,
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

function buildSourceContracts({ routeIndex, contractInventory, resourceExpansionFreeze, reviewApiText, reviewDashboardText, reviewApiDocText, desktopCompanionText }) {
  return {
    review_api_route_index: {
      schema_version: routeIndex.schema_version ?? null,
      route_count: routeIndex.routes?.length ?? 0,
      route_index_hash: sha256(routeIndex),
    },
    contract_inventory: {
      inventory_status: contractInventory.summary?.inventory_status ?? "unknown",
      api_route_count: contractInventory.summary?.api_route_count ?? contractInventory.api_routes?.length ?? 0,
      validation_error_count: contractInventory.summary?.validation_error_count ?? contractInventory.validation?.errors?.length ?? 0,
    },
    resource_expansion_freeze: {
      resource_expansion_freeze_status: resourceExpansionFreeze.summary?.resource_expansion_freeze_status ?? "unknown",
      phase_slot: resourceExpansionFreeze.summary?.phase_slot ?? null,
      next_phase_slot: resourceExpansionFreeze.summary?.next_phase_slot ?? null,
    },
    review_api_source: sourceTextRecord(reviewApiText),
    review_dashboard_source: sourceTextRecord(reviewDashboardText),
    review_api_doc: sourceTextRecord(reviewApiDocText),
    desktop_companion_integration: sourceTextRecord(desktopCompanionText),
  };
}

function sourceTextRecord(text) {
  return {
    readable: Boolean(text),
    content_hash: sha256(text ?? ""),
    byte_length: Buffer.byteLength(String(text ?? ""), "utf8"),
  };
}

function classifyRouteGroup(routeRecord) {
  const value = `${routeRecord.path ?? ""} ${routeRecord.description ?? ""}`.toLowerCase();
  if (value.includes("desktop")) return routeGroupDefinition("desktop_companion");
  if (routeRecord.path === "/" || routeRecord.path === "/health" || routeRecord.path === "/api" || value.includes("dashboard") || value.includes("route index") || value.includes("action queue") || value.includes("source artifacts")) return routeGroupDefinition("review");
  if (value.includes("evidence") || value.includes("source-span") || value.includes("source span") || value.includes("fact") || value.includes("issue") || value.includes("citation") || value.includes("lineage") || value.includes("exhibit") || value.includes("custody") || value.includes("search-index") || value.includes("vector") || value.includes("retrieval")) return routeGroupDefinition("evidence");
  if (value.includes("policy") || value.includes("classification") || value.includes("approval") || value.includes("gate") || value.includes("wall") || value.includes("access") || value.includes("conflict") || value.includes("human-review") || value.includes("human gate")) return routeGroupDefinition("policy");
  if (value.includes("runtime") || value.includes("workflow") || value.includes("agent") || value.includes("tool") || value.includes("event") || value.includes("audit") || value.includes("observability") || value.includes("cost") || value.includes("token") || value.includes("budget") || value.includes("error") || value.includes("retry") || value.includes("worktree") || value.includes("sandbox") || value.includes("secret") || value.includes("backend")) return routeGroupDefinition("runtime");
  return routeGroupDefinition("core");
}

function routeGroupDefinition(routeGroupKey) {
  const definitions = {
    core: { route_group_key: "core", label: "Core", scope: "Core contracts, domain packs, matters, connectors, resources, and generic harness catalogs." },
    review: { route_group_key: "review", label: "Review", scope: "Review Dashboard, route index, source/action/stage surfaces, and dashboard/API control plane visibility." },
    evidence: { route_group_key: "evidence", label: "Evidence", scope: "Evidence, source span, fact, issue, citation, lineage, retrieval, and chain-of-custody surfaces." },
    policy: { route_group_key: "policy", label: "Policy", scope: "Policy, access, classification, gate, approval, conflict, and human-review guard surfaces." },
    runtime: { route_group_key: "runtime", label: "Runtime", scope: "Runtime, workflow, event, audit, cost, token, observability, worktree, sandbox, and secret surfaces." },
    desktop_companion: { route_group_key: "desktop_companion", label: "Desktop Companion", scope: "Desktop Companion read-only operator route groups and Desktop boundary surfaces." },
  };
  return definitions[routeGroupKey] ?? definitions.core;
}

function check(pathValue, passed, message, metrics = {}) {
  return {
    path: pathValue,
    checkpoint_id: pathValue,
    check_id: pathValue.split(".").slice(-1)[0] ?? pathValue,
    status: passed ? "passed" : "failed",
    message,
    metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function renderSummary({ summary, apiRouteGroupRows }) {
  const lines = [
    "# API Route Inventory",
    "",
    `Status: ${summary.api_route_inventory_status}`,
    `Phase: ${summary.phase_slot}`,
    `Routes: ${summary.api_route_count}`,
    `Route groups: ${summary.api_route_group_count}`,
    `Required groups: ${summary.listed_required_group_count}/${summary.required_group_count}`,
    `Read-only routes: ${summary.read_only_route_count}`,
    `Validation errors: ${summary.validation_error_count}`,
    "",
    "## Groups",
    "",
  ];
  for (const group of apiRouteGroupRows) {
    lines.push(`- ${group.route_group_label}: ${group.route_count} route(s), ${group.route_group_status}`);
  }
  lines.push("");
  lines.push("The inventory is read-only and does not execute routes, start a server, mutate state, generate legal advice, or create client-facing output.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.implementationRoadmapPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.reviewApiPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.reviewDashboardPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.reviewApiDocPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.desktopCompanionIntegrationPath),
    contract_inventory_path: path.resolve(options.contractInventoryPath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.contractInventoryPath),
    resource_expansion_freeze_path: path.resolve(options.resourceExpansionFreezePath ?? DEFAULT_API_ROUTE_INVENTORY_INPUTS.resourceExpansionFreezePath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts?.[scriptName]);
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function sha256(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--desktop-companion") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--contract-inventory") parsed.contractInventoryPath = argv[++index];
    else if (arg === "--resource-expansion-freeze") parsed.resourceExpansionFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/api-route-inventory.mjs [options]

Options:
  --out <dir>                         Output directory.
  --package <path>                    package.json path.
  --roadmap <path>                    final-completion phase ledger path.
  --implementation-roadmap <path>     implementation roadmap path.
  --review-api <path>                 Review API source path.
  --review-dashboard <path>           Review Dashboard source path.
  --review-api-doc <path>             Review API docs path.
  --desktop-companion <path>          Desktop Companion integration docs path.
  --contract-inventory <path>         contract-inventory.json path.
  --resource-expansion-freeze <path>  resource-expansion-freeze.json path.
  --run-at <iso>                      Deterministic timestamp.
  --check                             Fail when validation has errors.
  --no-write                          Build without writing artifacts.
  -h, --help                          Show this help.
`);
}
