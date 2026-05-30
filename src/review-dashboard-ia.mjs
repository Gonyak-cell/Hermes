import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REVIEW_DASHBOARD_IA_OUT_DIR = "artifacts/review-dashboard-ia/latest";
export const DEFAULT_REVIEW_DASHBOARD_IA_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  apiRouteInventoryPath: "artifacts/api-route-inventory/latest/api-route-inventory.json",
};

const SCHEMA_VERSION = "review-dashboard-ia.v1";
const CAPABILITY_ID = "dashboard.review_dashboard_ia";
const PHASE_SLOT = "P288";
const PREVIOUS_PHASE_SLOT = "P287";
const NEXT_PHASE_SLOT = "P289";
const REQUIRED_SECTION_KEYS = [
  "overview",
  "domain_packs",
  "capabilities",
  "runs",
  "approvals",
  "evidence",
  "policies",
  "cost",
  "diagnostics",
];

export async function runReviewDashboardInformationArchitecture(options = {}) {
  const result = await buildReviewDashboardInformationArchitecture(options);
  if (options.write !== false) await writeReviewDashboardInformationArchitecture(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Review Dashboard information architecture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildReviewDashboardInformationArchitecture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REVIEW_DASHBOARD_IA_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const implementationRoadmapText = await readText(inputs.implementation_roadmap_path);
  const reviewDashboardText = await readText(inputs.review_dashboard_path);
  const reviewApiText = await readText(inputs.review_api_path);
  const reviewApiDocText = await readText(inputs.review_api_doc_path);
  const apiRouteInventory = await readJson(inputs.api_route_inventory_path);
  const apiRouteRows = apiRouteInventory.api_route_rows ?? [];
  const routeBindings = buildRouteBindings(apiRouteRows, generatedAt);
  const sections = buildSections(routeBindings, generatedAt);
  const navigationItems = buildNavigationItems(sections, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    apiRouteInventory,
    apiRouteRows,
    routeBindings,
    sections,
    navigationItems,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeInformationArchitecture({
    apiRouteInventory,
    apiRouteRows,
    routeBindings,
    sections,
    navigationItems,
    boundary,
    checks,
    validation,
  });
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    review_dashboard_ia_id: `review-dashboard-ia.${dateStamp(generatedAt)}`,
    review_dashboard_ia_status: validation.valid ? "complete" : "attention",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({ apiRouteInventory, reviewDashboardText, reviewApiText, reviewApiDocText }),
    review_dashboard_ia_contract: {
      schema_version: "review-dashboard-ia-contract.v1",
      contract_id: SCHEMA_VERSION,
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      required_section_keys: REQUIRED_SECTION_KEYS,
      read_only: true,
      dashboard_mutation_allowed: false,
      route_execution_allowed: false,
      client_facing_output_allowed: false,
    },
    dashboard_ia_sections: sections,
    dashboard_navigation_items: navigationItems,
    dashboard_ia_route_bindings: routeBindings,
    dashboard_ia_boundary: boundary,
    dashboard_ia_checks: checks,
    validation_items: checks,
    validation,
    summary,
    summary_markdown: renderSummary({ summary, sections }),
  };
}

export async function writeReviewDashboardInformationArchitecture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "review-dashboard-ia.json"), result);
  await writeJson(path.join(outDir, "review-dashboard-ia-sections.json"), {
    schema_version: "review-dashboard-ia-sections.v1",
    generated_at: result.generated_at,
    dashboard_ia_section_count: result.dashboard_ia_sections.length,
    dashboard_ia_sections: result.dashboard_ia_sections,
  });
  await writeJson(path.join(outDir, "review-dashboard-navigation-items.json"), {
    schema_version: "review-dashboard-navigation-items.v1",
    generated_at: result.generated_at,
    dashboard_navigation_item_count: result.dashboard_navigation_items.length,
    dashboard_navigation_items: result.dashboard_navigation_items,
  });
  await writeJson(path.join(outDir, "review-dashboard-ia-route-bindings.json"), {
    schema_version: "review-dashboard-ia-route-bindings.v1",
    generated_at: result.generated_at,
    dashboard_ia_route_binding_count: result.dashboard_ia_route_bindings.length,
    dashboard_ia_route_bindings: result.dashboard_ia_route_bindings,
  });
  await writeJson(path.join(outDir, "review-dashboard-ia-boundary.json"), result.dashboard_ia_boundary);
  await writeJson(path.join(outDir, "review-dashboard-ia-checks.json"), {
    schema_version: "review-dashboard-ia-checks.v1",
    generated_at: result.generated_at,
    dashboard_ia_check_count: result.dashboard_ia_checks.length,
    dashboard_ia_checks: result.dashboard_ia_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "review-dashboard-ia-validation-report.v1",
    generated_at: result.generated_at,
    review_dashboard_ia_id: result.review_dashboard_ia_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runReviewDashboardInformationArchitectureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runReviewDashboardInformationArchitecture(args);
    console.log(`Review Dashboard information architecture ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.review_dashboard_ia_status}`);
    console.log(`Sections: ${result.summary.dashboard_ia_section_count}`);
    console.log(`Navigation items: ${result.summary.dashboard_navigation_item_count}`);
    console.log(`Route bindings: ${result.summary.dashboard_ia_route_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRouteBindings(apiRouteRows, generatedAt) {
  return [...apiRouteRows]
    .sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method))
    .map((route, index) => {
      const section = classifyDashboardSection(route);
      return {
        dashboard_ia_route_binding_id: `dashboard-ia-route.${String(index + 1).padStart(4, "0")}`,
        generated_at: generatedAt,
        route_method: route.method,
        route_path: route.path,
        route_description: route.description,
        source_route_group_key: route.route_group_key,
        ia_section_key: section.ia_section_key,
        ia_section_label: section.label,
        route_binding_status: "mapped",
        navigation_visible: true,
        read_only: true,
        dashboard_mutation_allowed: false,
        route_execution_allowed: false,
        protected_action_execution_allowed: false,
        legal_advice_generated: false,
        client_facing_output_generated: false,
        human_review_required: true,
        client_facing_ready: false,
        binding_hash: sha256(`${route.method}:${route.path}:${section.ia_section_key}`),
      };
    });
}

function buildSections(routeBindings, generatedAt) {
  return REQUIRED_SECTION_KEYS.map((sectionKey, index) => {
    const definition = sectionDefinition(sectionKey);
    const rows = routeBindings.filter((row) => row.ia_section_key === sectionKey);
    const representativeRoutes = rows.slice(0, 12).map((row) => row.route_path);
    return {
      dashboard_ia_section_id: `dashboard-ia-section.${sectionKey}`,
      generated_at: generatedAt,
      ia_section_key: sectionKey,
      ia_section_label: definition.label,
      ia_section_order: index + 1,
      ia_section_status: rows.length > 0 && rows.every((row) => row.route_binding_status === "mapped" && row.read_only) ? "mapped" : "attention",
      route_count: rows.length,
      navigation_item_count: 1,
      representative_routes: representativeRoutes,
      section_intent: definition.intent,
      read_only: true,
      dashboard_mutation_allowed: false,
      route_execution_allowed: false,
      protected_action_execution_allowed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      human_review_required: true,
      client_facing_ready: false,
      section_hash: sha256({ sectionKey, representativeRoutes, routeCount: rows.length }),
    };
  });
}

function buildNavigationItems(sections, generatedAt) {
  return sections.map((section) => ({
    dashboard_navigation_item_id: `dashboard-navigation.${section.ia_section_key}`,
    generated_at: generatedAt,
    ia_section_key: section.ia_section_key,
    ia_section_label: section.ia_section_label,
    navigation_label: section.ia_section_label,
    navigation_order: section.ia_section_order,
    navigation_item_status: section.ia_section_status === "mapped" ? "mapped" : "attention",
    route_count: section.route_count,
    primary_route_path: section.representative_routes[0] ?? null,
    read_only: true,
    dashboard_mutation_allowed: false,
    route_execution_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    navigation_item_hash: sha256({ section: section.ia_section_key, routeCount: section.route_count }),
  }));
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "review-dashboard-ia.boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    information_architecture_only: true,
    dashboard_build_performed: false,
    route_execution_performed: false,
    server_started: false,
    dashboard_mutation_allowed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    source_of_truth: "api_route_inventory",
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
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    apiRouteInventory,
    apiRouteRows,
    routeBindings,
    sections,
    navigationItems,
    boundary,
  } = context;
  const sectionByKey = new Map(sections.map((section) => [section.ia_section_key, section]));
  const routeBindingCount = routeBindings.length;
  return [
    check("source.api_route_inventory", apiRouteInventory.summary?.api_route_inventory_status === "complete" && apiRouteInventory.summary?.phase_slot === "P287" && apiRouteInventory.summary?.next_phase_slot === "P288", "P287 API Route Inventory is complete and points to P288."),
    check("routes.source_non_empty", apiRouteRows.length > 0 && routeBindingCount === apiRouteRows.length, "API route inventory rows are available and mapped."),
    check("sections.required_declared", sections.length === REQUIRED_SECTION_KEYS.length && REQUIRED_SECTION_KEYS.every((key) => sectionByKey.has(key)), "Required dashboard IA sections are declared."),
    check("sections.required_populated", REQUIRED_SECTION_KEYS.every((key) => (sectionByKey.get(key)?.route_count ?? 0) > 0), "Overview, Domain Packs, Capabilities, Runs, Approvals, Evidence, Policies, Cost, and Diagnostics sections all have routes."),
    check("sections.route_partition", sum(sections.map((section) => section.route_count)) === routeBindingCount, "Dashboard IA route bindings partition the API route inventory."),
    check("navigation.required_items", navigationItems.length === REQUIRED_SECTION_KEYS.length && navigationItems.every((item, index) => item.navigation_order === index + 1 && item.navigation_item_status === "mapped"), "Navigation item order covers the required dashboard IA sections."),
    check("navigation.safe_boundary", routeBindings.every((row) => row.read_only && !row.dashboard_mutation_allowed && !row.route_execution_allowed && !row.protected_action_execution_allowed && !row.legal_advice_generated && !row.client_facing_output_generated), "Navigation route bindings preserve read-only/no-execution/no-legal/no-client boundary."),
    check("surface.package_script", hasScript(packageJson, "dashboard:ia"), "package.json exposes dashboard:ia."),
    check("surface.dashboard_api_loop", reviewDashboardText.includes("dashboard_information_architecture") && reviewDashboardText.includes("buildDashboardInformationArchitectureStage") && reviewApiText.includes("/api/review-dashboard-information-architectures"), "Review Dashboard and Review API expose Review Dashboard Information Architecture."),
    check("surface.docs", reviewApiDocText.includes("Review Dashboard Information Architecture"), "Review API docs describe Review Dashboard Information Architecture routes."),
    check("surface.ledger_roadmap", roadmapText.includes("P288") && roadmapText.includes("Review Dashboard Information Architecture") && implementationRoadmapText.includes("Phase 288") && implementationRoadmapText.includes("Review Dashboard Information Architecture"), "Ledger and implementation roadmap promote Phase 288."),
    check("boundary.read_only", boundary.read_only && boundary.information_architecture_only && !boundary.dashboard_build_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.dashboard_mutation_allowed && !boundary.protected_action_executed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Dashboard IA boundary is read-only and non-executing."),
    check("boundary.windows_baseline", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
  ];
}

function summarizeInformationArchitecture({ apiRouteInventory, apiRouteRows, routeBindings, sections, navigationItems, boundary, checks, validation }) {
  const sectionCounts = Object.fromEntries(sections.map((section) => [section.ia_section_key, section.route_count]));
  return {
    review_dashboard_ia_status: validation.valid ? "complete" : "attention",
    review_dashboard_ia_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_api_route_inventory_status: apiRouteInventory.summary?.api_route_inventory_status ?? "unknown",
    source_api_route_inventory_phase_slot: apiRouteInventory.summary?.phase_slot ?? null,
    source_api_route_inventory_next_phase_slot: apiRouteInventory.summary?.next_phase_slot ?? null,
    source_api_route_count: apiRouteInventory.summary?.api_route_count ?? apiRouteRows.length,
    required_section_count: REQUIRED_SECTION_KEYS.length,
    listed_required_section_count: sections.filter((section) => REQUIRED_SECTION_KEYS.includes(section.ia_section_key) && section.route_count > 0).length,
    dashboard_ia_section_count: sections.length,
    dashboard_navigation_item_count: navigationItems.length,
    dashboard_ia_route_binding_count: routeBindings.length,
    api_route_count: apiRouteRows.length,
    route_partition_count: sum(sections.map((section) => section.route_count)),
    unassigned_route_count: routeBindings.filter((row) => !REQUIRED_SECTION_KEYS.includes(row.ia_section_key)).length,
    overview_route_count: sectionCounts.overview ?? 0,
    domain_packs_route_count: sectionCounts.domain_packs ?? 0,
    capabilities_route_count: sectionCounts.capabilities ?? 0,
    runs_route_count: sectionCounts.runs ?? 0,
    approvals_route_count: sectionCounts.approvals ?? 0,
    evidence_route_count: sectionCounts.evidence ?? 0,
    policies_route_count: sectionCounts.policies ?? 0,
    cost_route_count: sectionCounts.cost ?? 0,
    diagnostics_route_count: sectionCounts.diagnostics ?? 0,
    read_only: boundary.read_only,
    information_architecture_only: boundary.information_architecture_only,
    dashboard_build_performed: boundary.dashboard_build_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    dashboard_mutation_allowed: boundary.dashboard_mutation_allowed,
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

function buildSourceContracts({ apiRouteInventory, reviewDashboardText, reviewApiText, reviewApiDocText }) {
  return {
    api_route_inventory: {
      api_route_inventory_status: apiRouteInventory.summary?.api_route_inventory_status ?? "unknown",
      phase_slot: apiRouteInventory.summary?.phase_slot ?? null,
      next_phase_slot: apiRouteInventory.summary?.next_phase_slot ?? null,
      api_route_count: apiRouteInventory.summary?.api_route_count ?? apiRouteInventory.api_route_rows?.length ?? 0,
      route_group_count: apiRouteInventory.summary?.api_route_group_count ?? apiRouteInventory.api_route_group_rows?.length ?? 0,
    },
    review_dashboard_source: sourceTextRecord(reviewDashboardText),
    review_api_source: sourceTextRecord(reviewApiText),
    review_api_doc: sourceTextRecord(reviewApiDocText),
  };
}

function classifyDashboardSection(route) {
  const value = `${route.path ?? ""} ${route.description ?? ""} ${route.route_group_key ?? ""}`.toLowerCase();
  if (["/api", "/api/dashboard", "/api/sources", "/api/actions"].includes(route.path)) return sectionDefinition("overview");
  if (value.includes("approval") || value.includes("human-review") || value.includes("human gate") || value.includes("human-gate") || value.includes("protected") || value.includes("receipt")) return sectionDefinition("approvals");
  if (value.includes("cost") || value.includes("token") || value.includes("budget") || value.includes("observability") || value.includes("trace") || value.includes("error") || value.includes("retry")) return sectionDefinition("cost");
  if (value.includes("workflow") || value.includes("agent") || value.includes("tool") || value.includes("runtime") || value.includes("event") || value.includes("audit") || value.includes("run") || value.includes("worktree") || value.includes("sandbox") || value.includes("secret") || value.includes("backend")) return sectionDefinition("runs");
  if (value.includes("evidence") || value.includes("source-span") || value.includes("source span") || value.includes("fact") || value.includes("issue") || value.includes("citation") || value.includes("lineage") || value.includes("exhibit") || value.includes("custody") || value.includes("search") || value.includes("vector") || value.includes("retrieval") || value.includes("resource")) return sectionDefinition("evidence");
  if (value.includes("policy") || value.includes("classification") || value.includes("access") || value.includes("wall") || value.includes("conflict") || value.includes("model") || value.includes("output-destination")) return sectionDefinition("policies");
  if (value.includes("matter") || value.includes("law-firm") || value.includes("law firm") || value.includes("ldd") || value.includes("litigation") || value.includes("meeting") || value.includes("contract-draft") || value.includes("personal-dev") || value.includes("creative") || value.includes("connector") || value.includes("kakao") || value.includes("outlook") || value.includes("github") || value.includes("vdr") || value.includes("plaud") || value.includes("erp") || value.includes("pack")) return sectionDefinition("domain_packs");
  if (value.includes("validation") || value.includes("check") || value.includes("health") || value.includes("inventory") || value.includes("boundary") || value.includes("freeze") || value.includes("diagnostic")) return sectionDefinition("diagnostics");
  if (value.includes("capability") || value.includes("contract") || value.includes("schema") || value.includes("fixture") || value.includes("migration") || value.includes("registry")) return sectionDefinition("capabilities");
  if (value.includes("dashboard") || value.includes("source artifacts") || value.includes("route index") || value.includes("action queue")) return sectionDefinition("overview");
  return sectionDefinition("capabilities");
}

function sectionDefinition(sectionKey) {
  const definitions = {
    overview: { ia_section_key: "overview", label: "Overview", intent: "Top-level review summary, action queue, route index, source registry, and dashboard status." },
    domain_packs: { ia_section_key: "domain_packs", label: "Domain Packs", intent: "Law firm, personal dev, creative document, connector, and matter-oriented domain pack surfaces." },
    capabilities: { ia_section_key: "capabilities", label: "Capabilities", intent: "Core contracts, schemas, capability registries, fixtures, migrations, and compatibility surfaces." },
    runs: { ia_section_key: "runs", label: "Runs", intent: "Runtime, workflow, agent, tool, event, audit, worktree, sandbox, and execution ledger surfaces." },
    approvals: { ia_section_key: "approvals", label: "Approvals", intent: "Human review, approval queues, protected actions, gates, receipts, and command review surfaces." },
    evidence: { ia_section_key: "evidence", label: "Evidence", intent: "Resource, evidence, source span, fact, issue, citation, lineage, retrieval, and custody surfaces." },
    policies: { ia_section_key: "policies", label: "Policies", intent: "Policy, classification, access, wall, conflict, model, tool, runtime, and output policy surfaces." },
    cost: { ia_section_key: "cost", label: "Cost", intent: "Cost, token, budget, observability, trace, error, retry, and performance-related surfaces." },
    diagnostics: { ia_section_key: "diagnostics", label: "Diagnostics", intent: "Validation, check, health, inventory, freeze, boundary, and diagnostic surfaces." },
  };
  return definitions[sectionKey] ?? definitions.capabilities;
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

function renderSummary({ summary, sections }) {
  const lines = [
    "# Review Dashboard Information Architecture",
    "",
    `Status: ${summary.review_dashboard_ia_status}`,
    `Phase: ${summary.phase_slot}`,
    `Sections: ${summary.dashboard_ia_section_count}`,
    `Navigation items: ${summary.dashboard_navigation_item_count}`,
    `Route bindings: ${summary.dashboard_ia_route_binding_count}`,
    `Validation errors: ${summary.validation_error_count}`,
    "",
    "## Sections",
    "",
  ];
  for (const section of sections) {
    lines.push(`- ${section.ia_section_label}: ${section.route_count} route(s), ${section.ia_section_status}`);
  }
  lines.push("");
  lines.push("The IA artifact is read-only and does not build the dashboard, execute routes, start a server, mutate state, generate legal advice, or create client-facing output.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.reviewApiDocPath),
    api_route_inventory_path: path.resolve(options.apiRouteInventoryPath ?? DEFAULT_REVIEW_DASHBOARD_IA_INPUTS.apiRouteInventoryPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

function sourceTextRecord(text) {
  return {
    readable: Boolean(text),
    content_hash: sha256(text ?? ""),
    byte_length: Buffer.byteLength(String(text ?? ""), "utf8"),
  };
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
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--api-route-inventory") parsed.apiRouteInventoryPath = argv[++index];
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
  console.log(`Usage: node scripts/review-dashboard-ia.mjs [--check] [--out DIR]

Builds the Phase 288 Review Dashboard Information Architecture artifact from the Phase 287 API Route Inventory.`);
}
