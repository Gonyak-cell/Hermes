import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_CONTRACT_GOLDEN_FIXTURES_OUT_DIR = "artifacts/contract-golden-fixtures/latest";
export const DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS = {
  schemaDir: "schemas",
  artifactPaths: {
    contract_inventory: "artifacts/contract-inventory/latest/contract-inventory.json",
    contract_dependency_map: "artifacts/contract-dependency-map/latest/contract-dependency-map.json",
    schema_versioning_rules: "artifacts/schema-versioning-rules/latest/schema-versioning-rules.json",
    schema_migration_manifest: "artifacts/schema-migration-manifest/latest/schema-migration-manifest-ledger.json",
    identity_model: "artifacts/identity-model/latest/identity-model.json",
    client_counterparty_registry: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
    matter_profile_team_ledger: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
    wall_policy_contract: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
    matter_access_policy_evaluator: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
    data_classification_rule_engine: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
    matter_tagging_decision_ledger: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
    access_audit_projection: "artifacts/access-audit/latest/access-audit-projection.json",
    store_policy_adapter: "artifacts/store-policy/latest/store-policy-adapter.json",
    conflict_check_interface: "artifacts/conflict-check/latest/conflict-check-interface.json",
    personal_workspace_boundary: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
    policy_golden_fixtures: "artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json",
    policy_operations_surface: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
    matter_boundary_slice: "artifacts/matter-boundary-slice/latest/matter-boundary-slice.json",
    identity_policy_matter_freeze: "artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json",
    resource_store_interface: "artifacts/resource-store-interface/latest/resource-store-interface.json",
    immutable_object_store_layout: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
    resource_version_ledger: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
    normalized_text_contract: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
    extractor_adapter_contract: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
    source_span_store: "artifacts/source-span-store/latest/source-span-store.json",
    evidence_item_store: "artifacts/evidence-item-store/latest/evidence-item-store.json",
    fact_claim_store: "artifacts/fact-claim-store/latest/fact-claim-store.json",
    issue_graph_store: "artifacts/issue-graph-store/latest/issue-graph-store.json",
    citation_object_store: "artifacts/citation-object-store/latest/citation-object-store.json",
    lineage_graph_builder: "artifacts/lineage-graph/latest/lineage-graph.json",
    evidence_coverage_score: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
    evidence_flags: "artifacts/evidence-flags/latest/evidence-flags.json",
    exhibit_map: "artifacts/exhibit-map/latest/exhibit-map.json",
    chain_of_custody_events: "artifacts/chain-of-custody/latest/chain-of-custody-events.json",
    search_index_contract: "artifacts/search-index/latest/search-index-contract.json",
    model_policy_enforcement: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
    tool_runtime_policy_enforcement: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
    output_destination_policy_enforcement: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
    approval_authority_ledger: "artifacts/approval-authority/latest/approval-authority-ledger.json",
    policy_snapshot_binding_ledger: "artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json",
    resource_contract_freeze: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
    matter_contract_freeze: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
    policy_contract_freeze: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
    evidence_contract_freeze: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
    capability_workflow_contract_freeze: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
    runtime_agentrun_contract_freeze: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
    gate_approval_contract_freeze: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
    output_delivery_contract_freeze: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
    event_audit_run_contract_freeze: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
    error_cost_observability_contract_freeze: "artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json",
  },
};

const GOLDEN_FIXTURE_DEFINITIONS = [
  fixtureDefinition("contract_inventory", "Contract Inventory", "contracts", "contract-inventory.schema.json"),
  fixtureDefinition("contract_dependency_map", "Contract Dependency Map", "contracts", "contract-dependency-map.schema.json"),
  fixtureDefinition("schema_versioning_rules", "Schema Versioning Rules", "contracts", "schema-versioning-rules.schema.json"),
  fixtureDefinition("schema_migration_manifest", "Schema Migration Manifest", "contracts", "schema-migration-manifest.schema.json"),
  fixtureDefinition("identity_model", "Identity Model", "identity_policy", "identity-model.schema.json"),
  fixtureDefinition("client_counterparty_registry", "Client/Counterparty Registry", "identity_policy", "client-counterparty-registry.schema.json"),
  fixtureDefinition("matter_profile_team_ledger", "Matter Profile/Team Ledger", "identity_policy", "matter-profile-team-ledger.schema.json"),
  fixtureDefinition("wall_policy_contract", "Wall Policy Contract", "identity_policy", "wall-policy-contract.schema.json"),
  fixtureDefinition("matter_access_policy_evaluator", "Matter Access Policy Evaluator", "identity_policy", "matter-access-policy-evaluator.schema.json"),
  fixtureDefinition("data_classification_rule_engine", "Data Classification Rule Engine", "identity_policy", "data-classification-rule-engine.schema.json"),
  fixtureDefinition("matter_tagging_decision_ledger", "Matter Tagging Decision Ledger", "identity_policy", "matter-tagging-decision-ledger.schema.json"),
  fixtureDefinition("access_audit_projection", "Access Audit Projection", "identity_policy", "access-audit-projection.schema.json"),
  fixtureDefinition("store_policy_adapter", "Store Policy Adapter", "identity_policy", "store-policy-adapter.schema.json"),
  fixtureDefinition("conflict_check_interface", "Conflict Check Interface", "identity_policy", "conflict-check-interface.schema.json"),
  fixtureDefinition("personal_workspace_boundary", "Personal Workspace Boundary", "identity_policy", "personal-workspace-boundary.schema.json"),
  fixtureDefinition("policy_golden_fixtures", "Policy Golden Fixtures", "identity_policy", "policy-golden-fixtures.schema.json"),
  fixtureDefinition("policy_operations_surface", "Policy Operations Surface", "identity_policy", "policy-operations-surface.schema.json"),
  fixtureDefinition("matter_boundary_slice", "Matter Boundary Slice", "identity_policy", "matter-boundary-slice.schema.json"),
  fixtureDefinition("identity_policy_matter_freeze", "Identity/Policy/Matter Freeze", "identity_policy", "identity-policy-matter-freeze.schema.json"),
  fixtureDefinition("resource_store_interface", "Resource Store Interface", "resource_evidence", "resource-store-interface.schema.json"),
  fixtureDefinition("immutable_object_store_layout", "Immutable Object Store Layout", "resource_evidence", "immutable-object-store-layout.schema.json"),
  fixtureDefinition("resource_version_ledger", "Resource Version Ledger", "resource_evidence", "resource-version-ledger.schema.json"),
  fixtureDefinition("normalized_text_contract", "Normalized Text Contract", "resource_evidence", "normalized-text-contract.schema.json"),
  fixtureDefinition("extractor_adapter_contract", "Extractor Adapter Contract", "resource_evidence", "extractor-adapter-contract.schema.json"),
  fixtureDefinition("source_span_store", "Source Span Store", "resource_evidence", "source-span-store.schema.json"),
  fixtureDefinition("evidence_item_store", "Evidence Item Store", "resource_evidence", "evidence-item-store.schema.json"),
  fixtureDefinition("fact_claim_store", "Fact Claim Store", "resource_evidence", "fact-claim-store.schema.json"),
  fixtureDefinition("issue_graph_store", "Issue Graph Store", "resource_evidence", "issue-graph-store.schema.json"),
  fixtureDefinition("citation_object_store", "Citation Object Store", "resource_evidence", "citation-object-store.schema.json"),
  fixtureDefinition("lineage_graph_builder", "Lineage Graph Builder", "resource_evidence", "lineage-graph-builder.schema.json"),
  fixtureDefinition("evidence_coverage_score", "Evidence Coverage Score", "resource_evidence", "evidence-coverage-score.schema.json"),
  fixtureDefinition("evidence_flags", "Evidence Flags", "resource_evidence", "evidence-flags.schema.json"),
  fixtureDefinition("exhibit_map", "Exhibit Map", "resource_evidence", "exhibit-map.schema.json"),
  fixtureDefinition("chain_of_custody_events", "Chain of Custody Events", "resource_evidence", "chain-of-custody-events.schema.json"),
  fixtureDefinition("search_index_contract", "Search Index Contract", "resource_evidence", "search-index-contract.schema.json"),
  fixtureDefinition("model_policy_enforcement", "Model Policy Enforcement", "identity_policy", "model-policy-enforcement.schema.json"),
  fixtureDefinition("tool_runtime_policy_enforcement", "Tool/Runtime Policy Enforcement", "gate_approval", "tool-runtime-policy-enforcement.schema.json"),
  fixtureDefinition("output_destination_policy_enforcement", "Output Destination Policy Enforcement", "gate_approval", "output-destination-policy-enforcement.schema.json"),
  fixtureDefinition("approval_authority_ledger", "Approval Authority Ledger", "gate_approval", "approval-authority-ledger.schema.json"),
  fixtureDefinition("policy_snapshot_binding_ledger", "Policy Snapshot Binding Ledger", "policy", "policy-snapshot-binding-ledger.schema.json"),
  fixtureDefinition("resource_contract_freeze", "Resource Contract Freeze", "resource_evidence", "resource-contract-freeze.schema.json"),
  fixtureDefinition("matter_contract_freeze", "Matter Contract Freeze", "identity_policy", "matter-contract-freeze.schema.json"),
  fixtureDefinition("policy_contract_freeze", "Policy Contract Freeze", "policy", "policy-contract-freeze.schema.json"),
  fixtureDefinition("evidence_contract_freeze", "Evidence Contract Freeze", "resource_evidence", "evidence-contract-freeze.schema.json"),
  fixtureDefinition("capability_workflow_contract_freeze", "Capability Workflow Contract Freeze", "contracts", "capability-workflow-contract-freeze.schema.json"),
  fixtureDefinition("runtime_agentrun_contract_freeze", "Runtime AgentRun Contract Freeze", "runtime", "runtime-agentrun-contract-freeze.schema.json"),
  fixtureDefinition("gate_approval_contract_freeze", "Gate Approval Contract Freeze", "gate_approval", "gate-approval-contract-freeze.schema.json"),
  fixtureDefinition("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "delivery", "output-delivery-contract-freeze.schema.json"),
  fixtureDefinition("event_audit_run_contract_freeze", "Event Audit Run Contract Freeze", "audit", "event-audit-run-contract-freeze.schema.json"),
  fixtureDefinition("error_cost_observability_contract_freeze", "Error Cost Observability Contract Freeze", "observability", "error-cost-observability-contract-freeze.schema.json"),
];

export async function runContractGoldenFixtures(options = {}) {
  const result = await buildContractGoldenFixtures(options);
  if (options.write !== false) await writeContractGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract golden fixture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_GOLDEN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const goldenFixtures = [];
  for (const definition of GOLDEN_FIXTURE_DEFINITIONS) {
    goldenFixtures.push(await buildGoldenFixtureRecord(definition, inputs, generatedAt));
  }
  const regressionHashManifest = buildRegressionHashManifest(goldenFixtures, generatedAt);
  const validationItems = buildValidationItems(goldenFixtures, regressionHashManifest);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "contract-golden-fixtures.v1",
    generated_at: generatedAt,
    golden_fixture_set_id: `contract-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    golden_fixture_manifest: {
      schema_version: "contract-golden-fixture-manifest.v1",
      generated_at: generatedAt,
      required_fixture_count: GOLDEN_FIXTURE_DEFINITIONS.length,
      fixture_definitions: GOLDEN_FIXTURE_DEFINITIONS,
    },
    golden_fixtures: goldenFixtures,
    regression_hash_manifest: regressionHashManifest,
    validation_items: validationItems,
    validation,
    summary: summarizeGoldenFixtures(goldenFixtures, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderContractGoldenFixturesMarkdown(result),
  };
}

export async function writeContractGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableGoldenFixtures(result);
  await writeJson(path.join(outDir, "contract-golden-fixtures.json"), serializable);
  await writeJson(path.join(outDir, "golden-fixture-manifest.json"), result.golden_fixture_manifest);
  await writeJson(path.join(outDir, "golden-fixture-records.json"), {
    generated_at: result.generated_at,
    golden_fixture_count: result.golden_fixtures.length,
    golden_fixtures: result.golden_fixtures,
  });
  await writeJson(path.join(outDir, "regression-hash-manifest.json"), result.regression_hash_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    golden_fixture_set_id: result.golden_fixture_set_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractGoldenFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractGoldenFixtures(args);
    console.log(`Contract golden fixtures written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.golden_fixture_status}`);
    console.log(`Fixtures: ${result.summary.fixture_count}`);
    console.log(`Schema-valid fixtures: ${result.summary.schema_valid_fixture_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function fixtureDefinition(fixtureId, label, fixtureScope, schemaFile) {
  return {
    fixture_id: fixtureId,
    label,
    fixture_scope: fixtureScope,
    schema_file: schemaFile,
  };
}

async function buildGoldenFixtureRecord(definition, inputs, generatedAt) {
  const artifactPath = inputs.artifact_paths[definition.fixture_id] ?? null;
  const schemaPath = path.join(inputs.schema_dir, definition.schema_file);
  const artifactRead = await readJsonWithRaw(artifactPath);
  const schemaRead = await readJsonWithRaw(schemaPath);
  const schemaErrors = artifactRead.value && schemaRead.value
    ? validateAgainstSchema(artifactRead.value, schemaRead.value, {}, definition.fixture_id)
    : [];
  const readErrors = [
    ...(artifactRead.error ? [{ path: artifactPath, message: artifactRead.error }] : []),
    ...(schemaRead.error ? [{ path: schemaPath, message: schemaRead.error }] : []),
  ];
  const validationErrors = [...readErrors, ...schemaErrors];
  const contentHash = artifactRead.raw ? sha256(artifactRead.raw) : null;
  return {
    schema_version: "contract-golden-fixture-record.v1",
    golden_fixture_id: `golden-fixture.${definition.fixture_id}`,
    fixture_id: definition.fixture_id,
    artifact_id: definition.fixture_id,
    label: definition.label,
    fixture_scope: definition.fixture_scope,
    owner_area: definition.fixture_scope,
    artifact_path: artifactPath,
    schema_path: schemaPath,
    artifact_schema_version: artifactRead.value?.schema_version ?? null,
    fixture_status: validationErrors.length === 0 ? "locked" : "blocked",
    schema_validation_status: schemaErrors.length === 0 && readErrors.length === 0 ? "passed" : "failed",
    regression_status: contentHash ? "locked" : "missing_hash",
    content_hash: contentHash,
    schema_hash: schemaRead.raw ? sha256(schemaRead.raw) : null,
    captured_at: generatedAt,
    validation_error_count: validationErrors.length,
    validation_errors: validationErrors,
  };
}

function buildRegressionHashManifest(goldenFixtures, generatedAt) {
  const regressionHashes = goldenFixtures.map((fixture) => ({
    regression_hash_id: `regression-hash.${fixture.fixture_id}`,
    golden_fixture_id: fixture.golden_fixture_id,
    fixture_id: fixture.fixture_id,
    fixture_scope: fixture.fixture_scope,
    content_hash: fixture.content_hash,
    schema_hash: fixture.schema_hash,
    regression_status: fixture.regression_status,
  }));
  return {
    schema_version: "contract-golden-regression-hash-manifest.v1",
    generated_at: generatedAt,
    regression_hash_count: regressionHashes.length,
    locked_regression_hash_count: regressionHashes.filter((item) => item.regression_status === "locked").length,
    regression_hashes: regressionHashes,
  };
}

function buildValidationItems(goldenFixtures, regressionHashManifest) {
  const items = [];
  for (const fixture of goldenFixtures) {
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.artifact_path`,
      check_id: "golden_fixture_artifact_available",
      passed: fixture.validation_errors.every((error) => error.path !== fixture.artifact_path),
      message: `${fixture.fixture_id} artifact path is ${fixture.artifact_path ?? "missing"}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.schema_path`,
      check_id: "golden_fixture_schema_available",
      passed: fixture.validation_errors.every((error) => error.path !== fixture.schema_path),
      message: `${fixture.fixture_id} schema path is ${fixture.schema_path}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.schema_validation_status`,
      check_id: "golden_fixture_schema_validation_passed",
      passed: fixture.schema_validation_status === "passed",
      message: `${fixture.fixture_id} schema validation status is ${fixture.schema_validation_status}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.content_hash`,
      check_id: "golden_fixture_content_hash_locked",
      passed: Boolean(fixture.content_hash),
      message: `${fixture.fixture_id} content hash is ${fixture.content_hash ? "locked" : "missing"}.`,
    });
    addValidation(items, {
      path: `golden_fixtures.${fixture.fixture_id}.artifact_schema_version`,
      check_id: "golden_fixture_schema_version_present",
      passed: Boolean(fixture.artifact_schema_version),
      message: `${fixture.fixture_id} artifact schema version is ${fixture.artifact_schema_version ?? "missing"}.`,
    });
  }
  addValidation(items, {
    path: "regression_hash_manifest",
    check_id: "regression_hash_manifest_matches_fixture_count",
    passed: regressionHashManifest.regression_hash_count === goldenFixtures.length,
    message: `${regressionHashManifest.regression_hash_count} regression hash row(s) for ${goldenFixtures.length} fixture(s).`,
  });
  addValidation(items, {
    path: "regression_hash_manifest.locked_regression_hash_count",
    check_id: "all_regression_hashes_locked",
    passed: regressionHashManifest.locked_regression_hash_count === goldenFixtures.length,
    message: `${regressionHashManifest.locked_regression_hash_count}/${goldenFixtures.length} regression hash(es) are locked.`,
  });
  return items;
}

function summarizeGoldenFixtures(goldenFixtures, validationItems, validation) {
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    golden_fixture_status: validation.valid ? "complete" : "blocked",
    fixture_count: goldenFixtures.length,
    required_fixture_count: GOLDEN_FIXTURE_DEFINITIONS.length,
    locked_fixture_count: goldenFixtures.filter((fixture) => fixture.fixture_status === "locked").length,
    blocked_fixture_count: goldenFixtures.filter((fixture) => fixture.fixture_status === "blocked").length,
    schema_valid_fixture_count: goldenFixtures.filter((fixture) => fixture.schema_validation_status === "passed").length,
    schema_invalid_fixture_count: goldenFixtures.filter((fixture) => fixture.schema_validation_status === "failed").length,
    regression_hash_count: goldenFixtures.filter((fixture) => fixture.content_hash).length,
    locked_regression_hash_count: goldenFixtures.filter((fixture) => fixture.regression_status === "locked").length,
    missing_artifact_count: goldenFixtures.filter((fixture) => !fixture.content_hash).length,
    schema_version_present_count: goldenFixtures.filter((fixture) => fixture.artifact_schema_version).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_fixture_scope: countBy(goldenFixtures, "fixture_scope"),
    by_owner_area: countBy(goldenFixtures, "owner_area"),
    by_schema_validation_status: countBy(goldenFixtures, "schema_validation_status"),
    by_regression_status: countBy(goldenFixtures, "regression_status"),
  };
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `contract-golden-fixtures.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function renderContractGoldenFixturesMarkdown(result) {
  const lines = [];
  lines.push("# Contract Golden Fixtures");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.golden_fixture_status}`);
  lines.push("");
  lines.push(`- Fixtures: ${result.summary.fixture_count}`);
  lines.push(`- Schema-valid fixtures: ${result.summary.schema_valid_fixture_count}`);
  lines.push(`- Locked regression hashes: ${result.summary.locked_regression_hash_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Fixtures");
  for (const fixture of result.golden_fixtures) {
    lines.push(`- ${fixture.fixture_id}: ${fixture.fixture_scope} / ${fixture.schema_validation_status} / ${fixture.regression_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const artifactPaths = {
    ...DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS.artifactPaths,
    ...(options.artifactPaths ?? {}),
  };
  return {
    schema_dir: path.resolve(options.schemaDir ?? DEFAULT_CONTRACT_GOLDEN_FIXTURES_INPUTS.schemaDir),
    artifact_paths: Object.fromEntries(
      Object.entries(artifactPaths).map(([artifactId, artifactPath]) => [artifactId, path.resolve(artifactPath)]),
    ),
  };
}

function parseArgs(argv) {
  const parsed = { artifactPaths: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema-dir") parsed.schemaDir = argv[++index];
    else if (arg === "--artifact") {
      const value = argv[++index];
      const [artifactId, ...pathParts] = String(value).split("=");
      if (!artifactId || pathParts.length === 0) throw new Error("--artifact must use artifact_id=path");
      parsed.artifactPaths[artifactId] = pathParts.join("=");
    } else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/contract-golden-fixtures.mjs [options]

Options:
  --schema-dir <path>           Schema directory.
  --artifact <artifact_id=path> Override a golden fixture artifact path.
  --out-dir <path>              Output directory.
  --run-at <iso>                Fixed generation timestamp.
  --check                       Exit non-zero when validation fails.
  -h, --help                    Show this help.
`);
}

async function readJsonWithRaw(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      raw,
      value: JSON.parse(raw),
      error: null,
    };
  } catch (error) {
    return {
      raw: null,
      value: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableGoldenFixtures(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
