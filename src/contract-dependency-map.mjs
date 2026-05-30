import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTRACT_DEPENDENCY_MAP_OUT_DIR = "artifacts/contract-dependency-map/latest";
export const DEFAULT_CONTRACT_DEPENDENCY_MAP_INPUTS = {
  inventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
};

const DIRECTION_RULES = [
  {
    rule_id: "schema_to_artifact_contract",
    from_role: "schema_contract",
    to_role: "artifact_contract",
    direction: "schema defines artifact shape",
  },
  {
    rule_id: "package_script_to_loop_output_contract",
    from_role: "producer_command",
    to_role: "loop_output_contract",
    direction: "script command implements loop contract",
  },
  {
    rule_id: "loop_output_contract_to_artifact_contract",
    from_role: "loop_output_contract",
    to_role: "artifact_contract",
    direction: "loop step produces declared artifact",
  },
  {
    rule_id: "artifact_contract_to_dashboard_source",
    from_role: "artifact_contract",
    to_role: "dashboard_source",
    direction: "artifact feeds dashboard source",
  },
  {
    rule_id: "dashboard_source_to_api_route",
    from_role: "dashboard_source",
    to_role: "api_route",
    direction: "dashboard source feeds Review API route",
  },
];

export async function runContractDependencyMap(options = {}) {
  const result = await buildContractDependencyMap(options);
  if (options.write !== false) await writeContractDependencyMap(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract dependency map validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractDependencyMap(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_DEPENDENCY_MAP_OUT_DIR);
  const inventoryPath = path.resolve(options.inventoryPath ?? DEFAULT_CONTRACT_DEPENDENCY_MAP_INPUTS.inventoryPath);
  const inventory = await readJson(inventoryPath);
  const ownerByItemId = new Map((inventory.owner_map ?? []).map((entry) => [entry.inventory_item_id, entry]));
  const nodes = buildNodes(inventory, ownerByItemId);
  const nodeByInventoryItemId = new Map(nodes.map((node) => [node.inventory_item_id, node]));
  const edges = buildEdges(inventory, nodeByInventoryItemId);
  const ownerDependencies = buildOwnerDependencies(edges);
  const breakingChangeRisks = buildBreakingChangeRisks(inventory, nodes, edges);
  const validation = validateContractDependencyMap({ inventory, nodes, edges, ownerDependencies });
  const result = {
    schema_version: "contract-dependency-map.v1",
    generated_at: generatedAt,
    dependency_map_id: `contract-dependency-map.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      inventory_path: inventoryPath,
    },
    source_inventory: {
      inventory_id: inventory.inventory_id ?? null,
      schema_version: inventory.schema_version ?? null,
      generated_at: inventory.generated_at ?? null,
      inventory_status: inventory.summary?.inventory_status ?? "unknown",
      inventory_item_count: inventory.summary?.inventory_item_count ?? 0,
      owner_mapped_item_count: inventory.summary?.owner_mapped_item_count ?? 0,
    },
    direction_contract: {
      contract: "Edges point from the upstream contract/provider to the downstream consumer. Core/domain/runtime/dashboard direction is therefore visible without relying on prompt instructions.",
      rules: DIRECTION_RULES,
    },
    summary: summarizeDependencyMap({ inventory, nodes, edges, ownerDependencies, breakingChangeRisks, validation }),
    nodes,
    edges,
    dependency_graph: {
      nodes,
      edges,
    },
    owner_dependencies: ownerDependencies,
    breaking_change_risks: breakingChangeRisks,
    validation,
  };

  return {
    ...result,
    markdown: renderContractDependencyMapMarkdown(result),
  };
}

export async function writeContractDependencyMap(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDependencyMap(result);
  await writeJson(path.join(outDir, "contract-dependency-map.json"), serializable);
  await writeJson(path.join(outDir, "dependency-graph.json"), {
    generated_at: result.generated_at,
    dependency_map_id: result.dependency_map_id,
    node_count: result.nodes.length,
    edge_count: result.edges.length,
    nodes: result.nodes,
    edges: result.edges,
  });
  await writeJson(path.join(outDir, "breaking-change-risks.json"), {
    generated_at: result.generated_at,
    dependency_map_id: result.dependency_map_id,
    risk_count: result.breaking_change_risks.length,
    breaking_change_risks: result.breaking_change_risks,
  });
  await writeJson(path.join(outDir, "owner-dependency-map.json"), {
    generated_at: result.generated_at,
    dependency_map_id: result.dependency_map_id,
    owner_dependency_count: result.owner_dependencies.length,
    owner_dependencies: result.owner_dependencies,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractDependencyMapCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractDependencyMap(args);
    console.log(`Contract dependency map written to ${result.output_dir}`);
    console.log(`Nodes: ${result.summary.node_count}`);
    console.log(`Edges: ${result.summary.edge_count}`);
    console.log(`Breaking-change risks: ${result.summary.breaking_change_risk_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildNodes(inventory, ownerByItemId) {
  return (inventory.inventory_items ?? [])
    .map((item) => {
      const owner = ownerByItemId.get(item.inventory_item_id) ?? {};
      return {
        node_id: `node.${slugify(item.inventory_item_id)}`,
        inventory_item_id: item.inventory_item_id,
        item_type: item.item_type,
        name: item.name,
        source_ref: item.source_ref ?? null,
        owner_area: owner.owner_area ?? item.owner_area ?? "unknown",
        plane: owner.plane ?? "unknown",
        domain_pack: owner.domain_pack ?? null,
        stability_tier: owner.stability_tier ?? "unknown",
        dependency_role: dependencyRoleFor(item.item_type),
      };
    })
    .sort((left, right) => left.node_id.localeCompare(right.node_id));
}

function buildEdges(inventory, nodeByInventoryItemId) {
  const edges = [];
  const artifactByPath = new Map((inventory.artifact_contracts ?? []).map((artifact) => [artifact.path, artifact]));
  const schemaById = new Map((inventory.schemas ?? []).map((schema) => [schema.schema_id, schema]));
  const scriptByName = new Map((inventory.package_scripts ?? []).map((script) => [script.script_name, script]));

  for (const artifact of inventory.artifact_contracts ?? []) {
    if (artifact.mapped_schema_id && schemaById.has(artifact.mapped_schema_id)) {
      addEdge(edges, {
        edge_type: "schema_to_artifact_contract",
        from_inventory_item_id: `schema.${artifact.mapped_schema_id}`,
        to_inventory_item_id: artifact.inventory_item_id,
        dependency_reason: `Schema ${artifact.mapped_schema_id} defines artifact ${artifact.path}.`,
      }, nodeByInventoryItemId);
    }
  }

  for (const loopContract of inventory.loop_output_contracts ?? []) {
    const script = scriptByName.get(scriptNameFromCommand(loopContract.command));
    if (script) {
      addEdge(edges, {
        edge_type: "package_script_to_loop_output_contract",
        from_inventory_item_id: script.inventory_item_id,
        to_inventory_item_id: loopContract.inventory_item_id,
        dependency_reason: `npm script ${script.script_name} implements loop step ${loopContract.step_id}.`,
      }, nodeByInventoryItemId);
    }
    for (const artifactPath of loopContract.expected_artifacts ?? []) {
      const artifact = artifactByPath.get(artifactPath);
      if (!artifact) continue;
      addEdge(edges, {
        edge_type: "loop_output_contract_to_artifact_contract",
        from_inventory_item_id: loopContract.inventory_item_id,
        to_inventory_item_id: artifact.inventory_item_id,
        dependency_reason: `Loop step ${loopContract.step_id} declares ${artifact.path}.`,
      }, nodeByInventoryItemId);
    }
  }

  for (const source of inventory.dashboard_sources ?? []) {
    const artifact = source.default_path ? artifactByPath.get(source.default_path) : null;
    if (artifact) {
      addEdge(edges, {
        edge_type: "artifact_contract_to_dashboard_source",
        from_inventory_item_id: artifact.inventory_item_id,
        to_inventory_item_id: source.inventory_item_id,
        dependency_reason: `Dashboard source ${source.source_id} reads ${artifact.path}.`,
      }, nodeByInventoryItemId);
    } else if (source.mapped_schema_id && schemaById.has(source.mapped_schema_id)) {
      addEdge(edges, {
        edge_type: "schema_to_artifact_contract",
        from_inventory_item_id: `schema.${source.mapped_schema_id}`,
        to_inventory_item_id: source.inventory_item_id,
        dependency_reason: `Schema ${source.mapped_schema_id} constrains dashboard source ${source.source_id}.`,
      }, nodeByInventoryItemId);
    }
  }

  for (const route of inventory.api_routes ?? []) {
    const matchedSources = (inventory.dashboard_sources ?? []).filter((source) => sourceMatchesRoute(source, route));
    for (const source of matchedSources) {
      addEdge(edges, {
        edge_type: "dashboard_source_to_api_route",
        from_inventory_item_id: source.inventory_item_id,
        to_inventory_item_id: route.inventory_item_id,
        dependency_reason: `Review API route ${route.path} exposes dashboard source ${source.source_id}.`,
      }, nodeByInventoryItemId);
    }
  }

  return dedupeEdges(edges).sort((left, right) => left.edge_id.localeCompare(right.edge_id));
}

function addEdge(edges, draft, nodeByInventoryItemId) {
  const fromNode = nodeByInventoryItemId.get(draft.from_inventory_item_id);
  const toNode = nodeByInventoryItemId.get(draft.to_inventory_item_id);
  if (!fromNode || !toNode) return;
  const edgeType = draft.edge_type;
  const rule = DIRECTION_RULES.find((entry) => entry.rule_id === edgeType) ?? null;
  edges.push({
    edge_id: `edge.${edgeType}.${slugify(fromNode.inventory_item_id)}.${slugify(toNode.inventory_item_id)}`,
    edge_type: edgeType,
    from_node_id: fromNode.node_id,
    to_node_id: toNode.node_id,
    from_inventory_item_id: fromNode.inventory_item_id,
    to_inventory_item_id: toNode.inventory_item_id,
    from_owner_area: fromNode.owner_area,
    to_owner_area: toNode.owner_area,
    from_plane: fromNode.plane,
    to_plane: toNode.plane,
    direction_status: rule ? "allowed" : "unknown",
    dependency_reason: draft.dependency_reason,
  });
}

function buildOwnerDependencies(edges) {
  const byKey = new Map();
  for (const edge of edges) {
    const key = `${edge.from_owner_area}->${edge.to_owner_area}:${edge.edge_type}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        owner_dependency_id: `owner_dependency.${slugify(key)}`,
        from_owner_area: edge.from_owner_area,
        to_owner_area: edge.to_owner_area,
        edge_type: edge.edge_type,
        dependency_count: 0,
        cross_owner: edge.from_owner_area !== edge.to_owner_area,
        direction_status: edge.direction_status,
        sample_edge_ids: [],
      });
    }
    const record = byKey.get(key);
    record.dependency_count += 1;
    if (record.sample_edge_ids.length < 5) record.sample_edge_ids.push(edge.edge_id);
  }
  return [...byKey.values()].sort((left, right) => left.owner_dependency_id.localeCompare(right.owner_dependency_id));
}

function buildBreakingChangeRisks(inventory, nodes, edges) {
  const risks = [];
  const linkedApiRouteIds = new Set(edges.filter((edge) => edge.edge_type === "dashboard_source_to_api_route").map((edge) => edge.to_inventory_item_id));
  const linkedDashboardSourceIds = new Set(edges.filter((edge) => edge.edge_type === "artifact_contract_to_dashboard_source").map((edge) => edge.to_inventory_item_id));
  const linkedArtifactIds = new Set(edges.filter((edge) => edge.edge_type === "schema_to_artifact_contract").map((edge) => edge.to_inventory_item_id));

  for (const schema of inventory.schemas ?? []) {
    if (!schema.schema_version_const) {
      risks.push(risk("schema_without_version_const", "medium", schema.inventory_item_id, "Schema has no fixed schema_version const, so downstream artifacts cannot pin compatibility precisely."));
    }
  }
  for (const artifact of inventory.artifact_contracts ?? []) {
    if (!artifact.mapped_schema_id) {
      risks.push(risk("artifact_without_schema", "medium", artifact.inventory_item_id, "Artifact contract has no mapped schema and may break consumers silently."));
    } else if (!linkedArtifactIds.has(artifact.inventory_item_id)) {
      risks.push(risk("artifact_schema_edge_missing", "medium", artifact.inventory_item_id, "Artifact declares a mapped schema but no schema dependency edge was emitted."));
    }
  }
  for (const source of inventory.dashboard_sources ?? []) {
    if (source.default_path && !linkedDashboardSourceIds.has(source.inventory_item_id)) {
      risks.push(risk("dashboard_source_without_artifact_edge", "medium", source.inventory_item_id, "Dashboard source has a default path but no artifact dependency edge."));
    }
    if (!source.mapped_schema_id) {
      risks.push(risk("dashboard_source_without_schema", "low", source.inventory_item_id, "Dashboard source is readable but has no mapped schema for compatibility checks."));
    }
  }
  for (const route of inventory.api_routes ?? []) {
    if (!linkedApiRouteIds.has(route.inventory_item_id) && route.path.startsWith("/api/")) {
      risks.push(risk("api_route_without_source_edge", "low", route.inventory_item_id, "Review API route was not matched to a dashboard source by the dependency compiler."));
    }
  }
  for (const script of inventory.package_scripts ?? []) {
    if ((script.script_ref_count ?? 0) === 0) {
      risks.push(risk("package_script_without_file_ref", "low", script.inventory_item_id, "Package script has no direct scripts/*.mjs reference, so dependency ownership may be indirect."));
    }
  }
  for (const loopContract of inventory.loop_output_contracts ?? []) {
    if ((loopContract.expected_artifact_count ?? 0) === 0) {
      risks.push(risk("loop_step_without_expected_artifact", "low", loopContract.inventory_item_id, "Loop step has no expected artifact and cannot be tracked by artifact contract."));
    }
  }
  for (const edge of edges.filter((entry) => entry.direction_status !== "allowed")) {
    risks.push(risk("direction_rule_missing", "medium", edge.edge_id, "Dependency edge has no explicit direction rule."));
  }
  for (const node of nodes.filter((entry) => entry.owner_area === "unknown" || entry.plane === "unknown")) {
    risks.push(risk("owner_boundary_unknown", "medium", node.inventory_item_id, "Contract node lacks a resolved owner boundary."));
  }

  return risks.sort((left, right) => left.risk_id.localeCompare(right.risk_id));
}

function risk(riskType, riskLevel, subjectId, message) {
  return {
    risk_id: `risk.${riskType}.${slugify(subjectId)}`,
    risk_type: riskType,
    risk_level: riskLevel,
    subject_id: subjectId,
    message,
    mitigation: mitigationFor(riskType),
  };
}

function mitigationFor(riskType) {
  if (riskType === "schema_without_version_const") return "Add a schema_version const before consumers pin compatibility.";
  if (riskType === "artifact_without_schema") return "Map the artifact to a JSON schema or add a deliberate schema exemption.";
  if (riskType === "dashboard_source_without_schema") return "Add a schema candidate or document a dashboard-only projection boundary.";
  if (riskType === "api_route_without_source_edge") return "Add an explicit route-to-source mapping if the route exposes contract data.";
  if (riskType === "package_script_without_file_ref") return "Keep indirect commands documented until script dependency parsing is broadened.";
  if (riskType === "loop_step_without_expected_artifact") return "Declare expected artifacts or mark the step as side-effect-only.";
  return "Review before making breaking changes to the subject contract.";
}

function validateContractDependencyMap({ inventory, nodes, edges, ownerDependencies }) {
  const errors = [];
  if (inventory.summary?.inventory_status !== "complete") {
    errors.push({ path: "source_inventory.inventory_status", message: "Contract inventory must be complete before dependency mapping." });
  }
  if (nodes.length === 0) errors.push({ path: "nodes", message: "No dependency nodes were generated." });
  if (edges.length === 0) errors.push({ path: "edges", message: "No dependency edges were generated." });
  if (!edges.some((edge) => edge.edge_type === "schema_to_artifact_contract")) {
    errors.push({ path: "edges.schema_to_artifact_contract", message: "No schema-to-artifact dependency edges were generated." });
  }
  if (!edges.some((edge) => edge.edge_type === "artifact_contract_to_dashboard_source")) {
    errors.push({ path: "edges.artifact_contract_to_dashboard_source", message: "No artifact-to-dashboard dependency edges were generated." });
  }
  if (!edges.some((edge) => edge.edge_type === "dashboard_source_to_api_route")) {
    errors.push({ path: "edges.dashboard_source_to_api_route", message: "No dashboard-to-API dependency edges were generated." });
  }
  if (ownerDependencies.length === 0) {
    errors.push({ path: "owner_dependencies", message: "No owner dependency aggregates were generated." });
  }
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.from_node_id)) errors.push({ path: `edges.${edge.edge_id}.from_node_id`, message: "Edge references a missing from_node_id." });
    if (!nodeIds.has(edge.to_node_id)) errors.push({ path: `edges.${edge.edge_id}.to_node_id`, message: "Edge references a missing to_node_id." });
  }
  for (const duplicate of duplicates(nodes.map((node) => node.node_id))) {
    errors.push({ path: `nodes.${duplicate}`, message: "Duplicate dependency node id." });
  }
  for (const duplicate of duplicates(edges.map((edge) => edge.edge_id))) {
    errors.push({ path: `edges.${duplicate}`, message: "Duplicate dependency edge id." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeDependencyMap({ inventory, nodes, edges, ownerDependencies, breakingChangeRisks, validation }) {
  const byEdgeType = countBy(edges, "edge_type");
  const byRiskLevel = countBy(breakingChangeRisks, "risk_level");
  const directionViolationCount = edges.filter((edge) => edge.direction_status !== "allowed").length;
  return {
    map_status: validation.valid ? "complete" : "blocked",
    source_inventory_id: inventory.inventory_id ?? null,
    source_inventory_status: inventory.summary?.inventory_status ?? "unknown",
    inventory_item_count: inventory.summary?.inventory_item_count ?? 0,
    node_count: nodes.length,
    edge_count: edges.length,
    schema_dependency_edge_count: byEdgeType.schema_to_artifact_contract ?? 0,
    script_dependency_edge_count: byEdgeType.package_script_to_loop_output_contract ?? 0,
    loop_artifact_dependency_edge_count: byEdgeType.loop_output_contract_to_artifact_contract ?? 0,
    dashboard_dependency_edge_count: byEdgeType.artifact_contract_to_dashboard_source ?? 0,
    api_dependency_edge_count: byEdgeType.dashboard_source_to_api_route ?? 0,
    owner_dependency_count: ownerDependencies.length,
    cross_owner_edge_count: edges.filter((edge) => edge.from_owner_area !== edge.to_owner_area).length,
    direction_violation_count: directionViolationCount,
    breaking_change_risk_count: breakingChangeRisks.length,
    high_risk_count: byRiskLevel.high ?? 0,
    medium_risk_count: byRiskLevel.medium ?? 0,
    low_risk_count: byRiskLevel.low ?? 0,
    validation_error_count: validation.errors.length,
    by_edge_type: byEdgeType,
    by_risk_level: byRiskLevel,
  };
}

function renderContractDependencyMapMarkdown(result) {
  const lines = [];
  lines.push("# Contract Dependency Map");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.map_status}`);
  lines.push(`Source inventory: ${result.summary.source_inventory_id ?? "unknown"}`);
  lines.push("");
  lines.push(`- Nodes: ${result.summary.node_count}`);
  lines.push(`- Edges: ${result.summary.edge_count}`);
  lines.push(`- Schema edges: ${result.summary.schema_dependency_edge_count}`);
  lines.push(`- Dashboard edges: ${result.summary.dashboard_dependency_edge_count}`);
  lines.push(`- API edges: ${result.summary.api_dependency_edge_count}`);
  lines.push(`- Owner dependency aggregates: ${result.summary.owner_dependency_count}`);
  lines.push(`- Breaking-change risks: ${result.summary.breaking_change_risk_count}`);
  lines.push(`- Direction violations: ${result.summary.direction_violation_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Direction Contract");
  for (const rule of result.direction_contract.rules) {
    lines.push(`- ${rule.rule_id}: ${rule.direction}`);
  }
  lines.push("");
  lines.push("## Edge Types");
  for (const [edgeType, count] of Object.entries(result.summary.by_edge_type)) {
    lines.push(`- ${edgeType}: ${count}`);
  }
  lines.push("");
  lines.push("## Risk Levels");
  for (const [riskLevel, count] of Object.entries(result.summary.by_risk_level)) {
    lines.push(`- ${riskLevel}: ${count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function dependencyRoleFor(itemType) {
  if (itemType === "schema") return "schema_contract";
  if (itemType === "package_script") return "producer_command";
  if (itemType === "loop_output_contract") return "loop_output_contract";
  if (itemType === "artifact_contract") return "artifact_contract";
  if (itemType === "dashboard_source") return "dashboard_source";
  if (itemType === "api_route") return "api_route";
  return "contract_node";
}

function sourceMatchesRoute(source, route) {
  const routeText = `${route.path ?? ""} ${route.description ?? ""}`.toLowerCase().replace(/-/g, "_");
  const sourceTokens = source.source_id.split("_").filter((token) => !COMMON_ROUTE_TOKENS.has(token));
  if (sourceTokens.length === 0) return false;
  return sourceTokens.every((token) => routeText.includes(token));
}

const COMMON_ROUTE_TOKENS = new Set([
  "control",
  "plane",
  "human",
  "review",
  "cycle",
  "receipt",
  "completion",
  "source",
  "dashboard",
]);

function scriptNameFromCommand(command = []) {
  const commandParts = Array.isArray(command) ? command : [];
  if (commandParts[0] === "npm" && commandParts[1] === "run") return commandParts[2] ?? null;
  return null;
}

function dedupeEdges(edges) {
  return [...new Map(edges.map((edge) => [edge.edge_id, edge])).values()];
}

function serializableDependencyMap(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function duplicates(values) {
  const seen = new Set();
  const duplicateSet = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicateSet.add(value);
    seen.add(value);
  }
  return [...duplicateSet].sort();
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--inventory") parsed.inventoryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/contract-dependency-map.mjs [options]

Options:
  --out-dir <path>      Output directory.
  --inventory <path>    Contract inventory JSON path.
  --run-at <iso>        Override generated_at.
  --check               Exit non-zero on validation errors.
  --help                Show this help.
`);
}
