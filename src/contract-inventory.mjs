import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_CONTRACT_INVENTORY_OUT_DIR = "artifacts/contract-inventory/latest";
export const DEFAULT_CONTRACT_INVENTORY_INPUTS = {
  schemaDir: "schemas",
  scriptsDir: "scripts",
  srcDir: "src",
  docsDir: "docs",
  packagePath: "package.json",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

export async function runContractInventory(options = {}) {
  const result = await buildContractInventory(options);
  if (options.write !== false) await writeContractInventory(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract inventory validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractInventory(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_INVENTORY_OUT_DIR);
  const paths = resolveInputPaths(options);
  const packageJson = await readJsonOrNull(paths.packagePath);
  const dashboardDefaults = await loadDashboardDefaults(paths.reviewDashboardSourcePath);
  const dashboardSourceText = await readFile(paths.reviewDashboardSourcePath, "utf8");
  const reviewApiSourceText = await readFile(paths.reviewApiSourcePath, "utf8");
  const controlPlaneLoopSourceText = await readFile(paths.controlPlaneLoopSourcePath, "utf8");
  const schemas = await inventorySchemas(paths.schemaDir);
  const packageScripts = inventoryPackageScripts(packageJson, paths);
  const loopOutputContracts = inventoryLoopOutputContracts(controlPlaneLoopSourceText);
  const dashboardSources = inventoryDashboardSources(dashboardSourceText, dashboardDefaults, schemas);
  const apiRoutes = inventoryApiRoutes(reviewApiSourceText);
  const artifactContracts = inventoryArtifactContracts(dashboardSources, loopOutputContracts, schemas);
  const docs = await inventoryDocs(paths.docsDir);
  const inventoryItems = buildInventoryItems({
    schemas,
    packageScripts,
    loopOutputContracts,
    dashboardSources,
    apiRoutes,
    artifactContracts,
  });
  const ownerMap = buildOwnerMap(inventoryItems);
  const validation = validateContractInventory({
    schemas,
    packageScripts,
    loopOutputContracts,
    dashboardSources,
    apiRoutes,
    artifactContracts,
    inventoryItems,
    ownerMap,
  });
  const result = {
    schema_version: "contract-inventory.v1",
    generated_at: generatedAt,
    inventory_id: `contract-inventory.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      schema_dir: paths.schemaDir,
      scripts_dir: paths.scriptsDir,
      src_dir: paths.srcDir,
      docs_dir: paths.docsDir,
      package_path: paths.packagePath,
      review_dashboard_source_path: paths.reviewDashboardSourcePath,
      review_api_source_path: paths.reviewApiSourcePath,
      control_plane_loop_source_path: paths.controlPlaneLoopSourcePath,
    },
    summary: summarizeInventory({
      schemas,
      packageScripts,
      loopOutputContracts,
      dashboardSources,
      apiRoutes,
      artifactContracts,
      docs,
      inventoryItems,
      ownerMap,
      validation,
    }),
    schemas,
    package_scripts: packageScripts,
    loop_output_contracts: loopOutputContracts,
    dashboard_sources: dashboardSources,
    api_routes: apiRoutes,
    artifact_contracts: artifactContracts,
    docs,
    inventory_items: inventoryItems,
    owner_map: ownerMap,
    validation,
  };

  return {
    ...result,
    markdown: renderContractInventoryMarkdown(result),
  };
}

export async function writeContractInventory(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableInventory(result);
  await writeJson(path.join(outDir, "contract-inventory.json"), serializable);
  await writeJson(path.join(outDir, "schema-inventory.json"), {
    generated_at: result.generated_at,
    count: result.schemas.length,
    schemas: result.schemas,
  });
  await writeJson(path.join(outDir, "script-output-contracts.json"), {
    generated_at: result.generated_at,
    package_script_count: result.package_scripts.length,
    loop_output_contract_count: result.loop_output_contracts.length,
    package_scripts: result.package_scripts,
    loop_output_contracts: result.loop_output_contracts,
  });
  await writeJson(path.join(outDir, "dashboard-api-artifacts.json"), {
    generated_at: result.generated_at,
    dashboard_source_count: result.dashboard_sources.length,
    api_route_count: result.api_routes.length,
    artifact_contract_count: result.artifact_contracts.length,
    dashboard_sources: result.dashboard_sources,
    api_routes: result.api_routes,
    artifact_contracts: result.artifact_contracts,
  });
  await writeJson(path.join(outDir, "owner-map.json"), {
    generated_at: result.generated_at,
    count: result.owner_map.length,
    owner_map: result.owner_map,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractInventoryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractInventory(args);
    console.log(`Contract inventory written to ${result.output_dir}`);
    console.log(`Schemas: ${result.summary.schema_count}`);
    console.log(`Package scripts: ${result.summary.package_script_count}`);
    console.log(`Dashboard sources: ${result.summary.dashboard_source_count}`);
    console.log(`API routes: ${result.summary.api_route_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function resolveInputPaths(options) {
  return {
    schemaDir: path.resolve(options.schemaDir ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.schemaDir),
    scriptsDir: path.resolve(options.scriptsDir ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.scriptsDir),
    srcDir: path.resolve(options.srcDir ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.srcDir),
    docsDir: path.resolve(options.docsDir ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.docsDir),
    packagePath: path.resolve(options.packagePath ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.packagePath),
    reviewDashboardSourcePath: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.reviewDashboardSourcePath),
    reviewApiSourcePath: path.resolve(options.reviewApiSourcePath ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.reviewApiSourcePath),
    controlPlaneLoopSourcePath: path.resolve(options.controlPlaneLoopSourcePath ?? DEFAULT_CONTRACT_INVENTORY_INPUTS.controlPlaneLoopSourcePath),
  };
}

async function loadDashboardDefaults(reviewDashboardSourcePath) {
  const moduleUrl = pathToFileURL(reviewDashboardSourcePath).href;
  const dashboardModule = await import(`${moduleUrl}?contractInventory=${Date.now()}`);
  return dashboardModule.DEFAULT_REVIEW_DASHBOARD_INPUTS ?? {};
}

async function inventorySchemas(schemaDir) {
  const entries = await readdir(schemaDir, { withFileTypes: true });
  const schemas = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const schemaPath = path.join(schemaDir, entry.name);
    const raw = await readFile(schemaPath, "utf8");
    const schemaId = entry.name.replace(/\.schema\.json$/, "").replace(/\.json$/, "");
    try {
      const schema = JSON.parse(raw);
      schemas.push({
        schema_id: schemaId,
        inventory_item_id: `schema.${schemaId}`,
        path: schemaPath,
        file_name: entry.name,
        title: schema.title ?? null,
        json_schema_uri: schema.$schema ?? null,
        id_uri: schema.$id ?? null,
        schema_version_const: schema.properties?.schema_version?.const ?? null,
        required_count: schema.required?.length ?? 0,
        top_level_property_count: Object.keys(schema.properties ?? {}).length,
        parse_status: "parsed",
        content_hash: sha256(raw),
        owner_area: classifyOwner(schemaId, schemaPath).owner_area,
        validation: { valid: true, errors: [] },
      });
    } catch (error) {
      schemas.push({
        schema_id: schemaId,
        inventory_item_id: `schema.${schemaId}`,
        path: schemaPath,
        file_name: entry.name,
        title: null,
        json_schema_uri: null,
        id_uri: null,
        schema_version_const: null,
        required_count: 0,
        top_level_property_count: 0,
        parse_status: "parse_error",
        content_hash: sha256(raw),
        owner_area: classifyOwner(schemaId, schemaPath).owner_area,
        validation: {
          valid: false,
          errors: [{ path: schemaPath, message: error.message }],
        },
      });
    }
  }
  return schemas.sort((left, right) => left.schema_id.localeCompare(right.schema_id));
}

function inventoryPackageScripts(packageJson, paths) {
  return Object.entries(packageJson?.scripts ?? {})
    .map(([scriptName, command]) => {
      const scriptRefs = [...String(command).matchAll(/(?:^|\s)(scripts\/[^\s]+?\.mjs)(?=\s|$)/g)].map((match) => match[1]);
      return {
        script_name: scriptName,
        inventory_item_id: `package_script.${slugify(scriptName)}`,
        command,
        script_refs: scriptRefs,
        script_ref_count: scriptRefs.length,
        script_paths: scriptRefs.map((scriptRef) => path.resolve(path.dirname(paths.packagePath), scriptRef)),
        owner_area: classifyOwner(scriptName, command).owner_area,
      };
    })
    .sort((left, right) => left.script_name.localeCompare(right.script_name));
}

function inventoryLoopOutputContracts(sourceText) {
  const contracts = [];
  const stepPattern = /step\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*\[([\s\S]*?)\],\s*\[([\s\S]*?)\]\)/g;
  for (const match of sourceText.matchAll(stepPattern)) {
    const [, stepId, label, category, commandBlock, artifactBlock] = match;
    const command = [...commandBlock.matchAll(/"([^"]+)"/g)].map((part) => part[1]);
    const expectedArtifacts = [...artifactBlock.matchAll(/"([^"]+)"/g)].map((part) => part[1]);
    contracts.push({
      step_id: stepId,
      inventory_item_id: `loop_output.${stepId}`,
      label,
      category,
      command,
      command_display: command.join(" "),
      expected_artifacts: expectedArtifacts,
      expected_artifact_count: expectedArtifacts.length,
      owner_area: classifyOwner(stepId, expectedArtifacts.join(" ")).owner_area,
    });
  }
  return contracts.sort((left, right) => left.step_id.localeCompare(right.step_id));
}

function inventoryDashboardSources(sourceText, dashboardDefaults, schemas) {
  const sourceDefinitions = [];
  const blockMatch = sourceText.match(/const SOURCE_DEFINITIONS = \[([\s\S]*?)\];/);
  const block = blockMatch?.[1] ?? "";
  const objectPattern = /\{\s*option:\s*"([^"]+)",\s*source_id:\s*"([^"]+)",\s*label:\s*"([^"]+)",?\s*\}/g;
  const schemaById = new Map(schemas.map((schema) => [schema.schema_id, schema]));
  for (const match of block.matchAll(objectPattern)) {
    const [, option, sourceId, label] = match;
    const defaultPath = dashboardDefaults[option] ?? null;
    const artifactFile = defaultPath ? path.basename(defaultPath) : null;
    const schemaCandidateIds = schemaCandidatesFor(defaultPath, sourceId);
    const mappedSchema = schemaCandidateIds.map((candidate) => schemaById.get(candidate)).find(Boolean) ?? null;
    sourceDefinitions.push({
      source_id: sourceId,
      inventory_item_id: `dashboard_source.${sourceId}`,
      option,
      label,
      default_path: defaultPath,
      artifact_file: artifactFile,
      schema_candidate_ids: schemaCandidateIds,
      mapped_schema_id: mappedSchema?.schema_id ?? null,
      owner_area: classifyOwner(sourceId, defaultPath).owner_area,
    });
  }
  return sourceDefinitions.sort((left, right) => left.source_id.localeCompare(right.source_id));
}

function inventoryApiRoutes(sourceText) {
  const routes = [];
  const routePattern = /route\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g;
  for (const match of sourceText.matchAll(routePattern)) {
    const [, method, routePath, description] = match;
    routes.push({
      route_id: `${method.toLowerCase()}.${routePath}`,
      inventory_item_id: `api_route.${method.toLowerCase()}.${slugify(routePath)}`,
      method,
      path: routePath,
      description,
      owner_area: classifyOwner(routePath, description).owner_area,
    });
  }
  return routes.sort((left, right) => left.path.localeCompare(right.path));
}

function inventoryArtifactContracts(dashboardSources, loopOutputContracts, schemas) {
  const schemaById = new Map(schemas.map((schema) => [schema.schema_id, schema]));
  const artifactMap = new Map();
  for (const source of dashboardSources) {
    if (!source.default_path) continue;
    const record = ensureArtifactRecord(artifactMap, source.default_path, schemaById, source.source_id);
    record.dashboard_source_ids.push(source.source_id);
  }
  for (const contract of loopOutputContracts) {
    for (const artifactPath of contract.expected_artifacts) {
      const record = ensureArtifactRecord(artifactMap, artifactPath, schemaById, contract.step_id);
      record.loop_step_ids.push(contract.step_id);
    }
  }
  return [...artifactMap.values()]
    .map((record) => ({
      ...record,
      dashboard_source_ids: [...new Set(record.dashboard_source_ids)].sort(),
      loop_step_ids: [...new Set(record.loop_step_ids)].sort(),
      owner_area: classifyOwner(record.artifact_id, record.path).owner_area,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function inventoryDocs(docsDir) {
  const entries = await readdir(docsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const docId = entry.name.replace(/\.md$/, "");
      return {
        doc_id: docId,
        inventory_item_id: `doc.${docId}`,
        path: path.join(docsDir, entry.name),
        file_name: entry.name,
        owner_area: classifyOwner(docId, entry.name).owner_area,
      };
    })
    .sort((left, right) => left.doc_id.localeCompare(right.doc_id));
}

function ensureArtifactRecord(artifactMap, artifactPath, schemaById, sourceRef) {
  const normalizedPath = artifactPath;
  if (!artifactMap.has(normalizedPath)) {
    const schemaCandidateIds = schemaCandidatesFor(normalizedPath, sourceRef);
    const mappedSchema = schemaCandidateIds.map((candidate) => schemaById.get(candidate)).find(Boolean) ?? null;
    artifactMap.set(normalizedPath, {
      artifact_id: slugify(normalizedPath),
      inventory_item_id: `artifact.${slugify(normalizedPath)}`,
      path: normalizedPath,
      artifact_file: path.basename(normalizedPath),
      schema_candidate_ids: schemaCandidateIds,
      mapped_schema_id: mappedSchema?.schema_id ?? null,
      dashboard_source_ids: [],
      loop_step_ids: [],
    });
  }
  return artifactMap.get(normalizedPath);
}

function buildInventoryItems({ schemas, packageScripts, loopOutputContracts, dashboardSources, apiRoutes, artifactContracts }) {
  return [
    ...schemas.map((item) => inventoryItem(item.inventory_item_id, "schema", item.schema_id, item.path, item.owner_area)),
    ...packageScripts.map((item) => inventoryItem(item.inventory_item_id, "package_script", item.script_name, item.command, item.owner_area)),
    ...loopOutputContracts.map((item) => inventoryItem(item.inventory_item_id, "loop_output_contract", item.step_id, item.expected_artifacts.join(", "), item.owner_area)),
    ...dashboardSources.map((item) => inventoryItem(item.inventory_item_id, "dashboard_source", item.source_id, item.default_path, item.owner_area)),
    ...apiRoutes.map((item) => inventoryItem(item.inventory_item_id, "api_route", item.path, item.description, item.owner_area)),
    ...artifactContracts.map((item) => inventoryItem(item.inventory_item_id, "artifact_contract", item.artifact_id, item.path, item.owner_area)),
  ].sort((left, right) => left.inventory_item_id.localeCompare(right.inventory_item_id));
}

function inventoryItem(inventoryItemId, itemType, name, sourceRef, ownerArea) {
  return {
    inventory_item_id: inventoryItemId,
    item_type: itemType,
    name,
    source_ref: sourceRef ?? null,
    owner_area: ownerArea,
  };
}

function buildOwnerMap(inventoryItems) {
  return inventoryItems.map((item) => {
    const owner = classifyOwner(item.name, item.source_ref);
    return {
      owner_map_id: `owner.${item.inventory_item_id}`,
      inventory_item_id: item.inventory_item_id,
      item_type: item.item_type,
      name: item.name,
      owner_area: owner.owner_area,
      plane: owner.plane,
      domain_pack: owner.domain_pack,
      stability_tier: owner.stability_tier,
      owner_team: "hermes-harness-core",
      rationale: owner.rationale,
    };
  });
}

function validateContractInventory({ schemas, packageScripts, loopOutputContracts, dashboardSources, apiRoutes, artifactContracts, inventoryItems, ownerMap }) {
  const errors = [];
  if (schemas.length === 0) errors.push({ path: "schemas", message: "No JSON schemas were inventoried." });
  if (packageScripts.length === 0) errors.push({ path: "package_scripts", message: "No package scripts were inventoried." });
  if (loopOutputContracts.length === 0) errors.push({ path: "loop_output_contracts", message: "No control-plane loop output contracts were inventoried." });
  if (dashboardSources.length === 0) errors.push({ path: "dashboard_sources", message: "No dashboard sources were inventoried." });
  if (apiRoutes.length === 0) errors.push({ path: "api_routes", message: "No Review API routes were inventoried." });
  if (artifactContracts.length === 0) errors.push({ path: "artifact_contracts", message: "No artifact contracts were inventoried." });
  for (const schema of schemas.filter((schema) => schema.parse_status !== "parsed")) {
    errors.push({ path: `schemas.${schema.schema_id}`, message: `Schema did not parse: ${schema.validation.errors[0]?.message ?? "parse_error"}` });
  }
  for (const duplicate of duplicates(dashboardSources.map((source) => source.source_id))) {
    errors.push({ path: `dashboard_sources.${duplicate}`, message: "Duplicate dashboard source id." });
  }
  for (const duplicate of duplicates(apiRoutes.map((route) => route.route_id))) {
    errors.push({ path: `api_routes.${duplicate}`, message: "Duplicate API route id." });
  }
  if (ownerMap.length !== inventoryItems.length) {
    errors.push({ path: "owner_map", message: "Owner map must cover every inventory item exactly once." });
  }
  for (const duplicate of duplicates(ownerMap.map((entry) => entry.inventory_item_id))) {
    errors.push({ path: `owner_map.${duplicate}`, message: "Duplicate owner map entry for inventory item." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeInventory({ schemas, packageScripts, loopOutputContracts, dashboardSources, apiRoutes, artifactContracts, docs, inventoryItems, ownerMap, validation }) {
  const parsedSchemas = schemas.filter((schema) => schema.parse_status === "parsed");
  return {
    inventory_status: validation.valid ? "complete" : "blocked",
    schema_count: schemas.length,
    parsed_schema_count: parsedSchemas.length,
    schema_parse_error_count: schemas.length - parsedSchemas.length,
    package_script_count: packageScripts.length,
    package_script_with_file_ref_count: packageScripts.filter((script) => script.script_ref_count > 0).length,
    loop_output_contract_count: loopOutputContracts.length,
    loop_expected_artifact_count: loopOutputContracts.reduce((total, contract) => total + contract.expected_artifact_count, 0),
    dashboard_source_count: dashboardSources.length,
    dashboard_source_with_schema_count: dashboardSources.filter((source) => source.mapped_schema_id).length,
    api_route_count: apiRoutes.length,
    artifact_contract_count: artifactContracts.length,
    artifact_contract_with_schema_count: artifactContracts.filter((artifact) => artifact.mapped_schema_id).length,
    doc_count: docs.length,
    inventory_item_count: inventoryItems.length,
    owner_mapped_item_count: ownerMap.length,
    owner_area_count: Object.keys(countBy(ownerMap, "owner_area")).length,
    validation_error_count: validation.errors.length,
    by_item_type: countBy(inventoryItems, "item_type"),
    by_owner_area: countBy(ownerMap, "owner_area"),
  };
}

function classifyOwner(name, sourceRef = "") {
  const value = `${name ?? ""} ${sourceRef ?? ""}`.toLowerCase();
  if (value.includes("law-firm") || value.includes("ldd") || value.includes("litigation")) return owner("law_firm", "law_firm", "law-firm", "domain");
  if (value.includes("personal-dev") || value.includes("worktree") || value.includes("dev-project")) return owner("personal_dev", "personal_dev", "personal-dev", "domain");
  if (value.includes("creative-document")) return owner("creative_document", "creative_document", "creative-document", "domain");
  if (value.includes("trading")) return owner("trading", "trading", "trading", "domain");
  if (value.includes("human-review") || value.includes("approval") || value.includes("human-gate") || value.includes("gate")) return owner("gate_approval", "gate_approval", null, "operational");
  if (value.includes("control-plane")) return owner("control_plane", "control_plane", null, "core");
  if (value.includes("policy") || value.includes("classification")) return owner("identity_policy", "identity_policy", null, "core");
  if (value.includes("resource") || value.includes("evidence") || value.includes("matter")) return owner("resource_evidence", "resource_evidence", null, "core");
  if (value.includes("context") || value.includes("model-routing") || value.includes("runtime")) return owner("runtime_context", "runtime", null, "core");
  if (value.includes("cost") || value.includes("token") || value.includes("budget") || value.includes("observability")) return owner("observability", "observability", null, "core");
  if (value.includes("delivery") || value.includes("closeout")) return owner("delivery", "delivery", null, "operational");
  if (value.includes("dashboard") || value.includes("review-api") || value.includes("/api/")) return owner("dashboard_api", "dashboard_api", null, "operational");
  if (value.includes("domain-pack") || value.includes("capability")) return owner("domain_packs", "domain_packs", null, "core");
  return owner("core_contracts", "contracts", null, "core");
}

function owner(ownerArea, plane, domainPack, stabilityTier) {
  return {
    owner_area: ownerArea,
    plane,
    domain_pack: domainPack,
    stability_tier: stabilityTier,
    rationale: `${ownerArea} inferred from contract name/path.`,
  };
}

function schemaCandidatesFor(artifactPath, sourceId = "") {
  const candidates = new Set();
  const basename = path.basename(String(artifactPath ?? ""), ".json");
  const normalizedSource = kebab(sourceId);
  for (const value of [basename, normalizedSource]) {
    if (!value) continue;
    candidates.add(value);
    candidates.add(value.replace(/-drafts$/, ""));
    candidates.add(value.replace(/-ledger$/, ""));
    candidates.add(value.replace(/-catalog$/, ""));
  }
  return [...candidates].filter(Boolean);
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

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function renderContractInventoryMarkdown(result) {
  const lines = [];
  lines.push("# Contract Inventory");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.inventory_status}`);
  lines.push("");
  lines.push(`- Schemas: ${result.summary.parsed_schema_count}/${result.summary.schema_count}`);
  lines.push(`- Package scripts: ${result.summary.package_script_count}`);
  lines.push(`- Loop output contracts: ${result.summary.loop_output_contract_count}`);
  lines.push(`- Dashboard sources: ${result.summary.dashboard_source_count}`);
  lines.push(`- API routes: ${result.summary.api_route_count}`);
  lines.push(`- Artifact contracts: ${result.summary.artifact_contract_count}`);
  lines.push(`- Owner mapped items: ${result.summary.owner_mapped_item_count}/${result.summary.inventory_item_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Owner Areas");
  for (const [ownerArea, count] of Object.entries(result.summary.by_owner_area)) {
    lines.push(`- ${ownerArea}: ${count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableInventory(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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

function kebab(value) {
  return String(value ?? "")
    .replace(/_/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
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
    else if (arg === "--schema-dir") parsed.schemaDir = argv[++index];
    else if (arg === "--scripts-dir") parsed.scriptsDir = argv[++index];
    else if (arg === "--src-dir") parsed.srcDir = argv[++index];
    else if (arg === "--docs-dir") parsed.docsDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--review-dashboard-source") parsed.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--review-api-source") parsed.reviewApiSourcePath = argv[++index];
    else if (arg === "--control-plane-loop-source") parsed.controlPlaneLoopSourcePath = argv[++index];
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
  console.log(`Usage: node scripts/contract-inventory.mjs [options]

Options:
  --out-dir <path>                    Output directory.
  --schema-dir <path>                 JSON schema directory.
  --scripts-dir <path>                scripts directory.
  --src-dir <path>                    source directory.
  --docs-dir <path>                   docs directory.
  --package <path>                    package.json path.
  --review-dashboard-source <path>    review-dashboard source path.
  --review-api-source <path>          review-api source path.
  --control-plane-loop-source <path>  control-plane-loop source path.
  --run-at <iso>                      Override generated_at.
  --check                             Exit non-zero on validation errors.
  --help                              Show this help.
`);
}
