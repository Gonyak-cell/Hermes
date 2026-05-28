import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_CONTRACT_VALIDATION_SUITE_OUT_DIR = "artifacts/contract-validation-suite/latest";
export const DEFAULT_CONTRACT_VALIDATION_SUITE_INPUTS = {
  contractGoldenFixturesPath: "artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const REQUIRED_PACKAGE_SCRIPTS = [
  "contracts:inventory",
  "contracts:dependencies",
  "contracts:versioning",
  "contracts:migrations",
  "contracts:golden-fixtures",
  "contracts:validate",
  "contracts:identity",
  "contracts:party-registry",
  "contracts:matter-teams",
  "contracts:walls",
  "contracts:matter-access",
  "contracts:classification-rules",
  "contracts:matter-tagging",
  "contracts:access-audit",
  "contracts:store-policy",
  "contracts:conflict-check",
  "contracts:personal-boundary",
  "contracts:policy-golden",
  "policy:surface",
  "matter-boundary:slice",
  "identity-policy:freeze",
  "resource:store-interface",
  "object-store:layout",
  "resource:version-ledger",
  "resource:dedup-hash",
  "resource:quarantine",
  "resource:normalized-text",
  "resource:extractor-adapters",
  "resource:source-spans",
  "resource:evidence-items",
  "evidence:golden-fixtures",
  "resource:fact-claims",
  "resource:issue-graph",
  "resource:citations",
  "resource:lineage-graph",
  "evidence:viewer-data",
  "evidence:export-bundle",
  "evidence:regression-tests",
  "resource:evidence-dashboard",
  "resource:evidence-plane-freeze",
  "resource:evidence-coverage",
  "resource:evidence-flags",
  "resource:exhibit-map",
  "resource:custody-events",
  "resource:search-index",
  "resource:vector-policy",
  "resource:retrieval-filters",
  "contracts:model-policy",
  "contracts:tool-runtime",
  "contracts:output-destination",
  "contracts:approval-authority",
  "contracts:policy-bindings",
  "contracts:resources",
  "contracts:matters",
  "contracts:policies",
  "contracts:evidence",
  "contracts:capabilities",
  "contracts:runtimes",
  "contracts:runtime-interface",
  "runtime:hermes-adapter",
  "contracts:gates",
  "contracts:outputs",
  "contracts:events",
  "events:envelopes",
  "events:types",
  "events:store",
  "events:correlation",
  "events:workflow-runs",
  "events:agent-runs",
  "events:audit-ledger",
  "events:policy-snapshots",
  "events:tool-invocations",
  "cost:records",
  "token:projection",
  "observability:traces",
  "observability:errors",
  "events:replay",
  "events:retention",
  "ledgers:api-dashboard",
  "ledgers:golden-fixtures",
  "observability:freeze",
  "capabilities:manifest-v2",
  "capabilities:registry-api",
  "packs:compatibility",
  "workflows:state-model",
  "workflows:runner",
  "workflows:queue-retry",
  "workflows:idempotency",
  "workflows:resume-cancel",
  "workflows:context-builder",
  "workflows:retrieval-compiler",
  "workflows:prompt-injection-boundary",
  "workflows:pre-run-gates",
  "workflows:in-run-gates",
  "workflows:post-run-gates",
  "workflows:gate-results",
  "workflows:run-dashboard",
  "workflows:golden-cases",
  "workflows:gate-freeze",
  "contracts:observability",
];

export async function runContractValidationSuite(options = {}) {
  const result = await buildContractValidationSuite(options);
  if (options.write !== false) await writeContractValidationSuite(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract validation suite failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractValidationSuite(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_VALIDATION_SUITE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const goldenFixtures = await readJson(inputs.contract_golden_fixtures_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const fixtureValidationResults = [];
  for (const fixture of goldenFixtures.golden_fixtures ?? []) {
    fixtureValidationResults.push(await buildFixtureValidationResult(fixture));
  }
  const validationCommandManifest = buildValidationCommandManifest(packageJson, roadmapText, generatedAt);
  const validationItems = buildValidationItems(goldenFixtures, fixtureValidationResults, validationCommandManifest);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "contract-validation-suite.v1",
    generated_at: generatedAt,
    validation_suite_id: `contract-validation-suite.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_golden_fixtures: {
      golden_fixture_set_id: goldenFixtures.golden_fixture_set_id ?? null,
      golden_fixture_status: goldenFixtures.summary?.golden_fixture_status ?? "unknown",
      fixture_count: goldenFixtures.summary?.fixture_count ?? goldenFixtures.golden_fixtures?.length ?? 0,
      content_hash: hashValue({
        golden_fixture_set_id: goldenFixtures.golden_fixture_set_id ?? null,
        fixture_count: goldenFixtures.summary?.fixture_count ?? goldenFixtures.golden_fixtures?.length ?? 0,
        locked_regression_hash_count: goldenFixtures.summary?.locked_regression_hash_count ?? 0,
      }),
    },
    validation_command_manifest: validationCommandManifest,
    fixture_validation_results: fixtureValidationResults,
    validation_items: validationItems,
    validation,
    summary: summarizeContractValidationSuite(fixtureValidationResults, validationCommandManifest, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderContractValidationSuiteMarkdown(result),
  };
}

export async function writeContractValidationSuite(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableSuite(result);
  await writeJson(path.join(outDir, "contract-validation-suite.json"), serializable);
  await writeJson(path.join(outDir, "fixture-validation-results.json"), {
    generated_at: result.generated_at,
    fixture_validation_result_count: result.fixture_validation_results.length,
    fixture_validation_results: result.fixture_validation_results,
  });
  await writeJson(path.join(outDir, "validation-command-manifest.json"), result.validation_command_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    validation_suite_id: result.validation_suite_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractValidationSuiteCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractValidationSuite(args);
    console.log(`Contract validation suite written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.validation_suite_status}`);
    console.log(`Fixtures: ${result.summary.fixture_count}`);
    console.log(`Regression passed: ${result.summary.regression_passed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function buildFixtureValidationResult(fixture) {
  const artifactRead = await readJsonWithRaw(fixture.artifact_path);
  const schemaRead = await readJsonWithRaw(fixture.schema_path);
  const schemaValidationErrors = artifactRead.value && schemaRead.value
    ? validateAgainstSchema(artifactRead.value, schemaRead.value, {}, fixture.fixture_id)
    : [];
  const readErrors = [
    ...(artifactRead.error ? [{ path: fixture.artifact_path, message: artifactRead.error }] : []),
    ...(schemaRead.error ? [{ path: fixture.schema_path, message: schemaRead.error }] : []),
  ];
  const actualContentHash = artifactRead.raw ? sha256(artifactRead.raw) : null;
  const actualSchemaHash = schemaRead.raw ? sha256(schemaRead.raw) : null;
  const contentHashStatus = actualContentHash && actualContentHash === fixture.content_hash ? "matched" : "mismatched";
  const schemaHashStatus = actualSchemaHash && actualSchemaHash === fixture.schema_hash ? "matched" : "mismatched";
  const schemaValidationStatus = readErrors.length === 0 && schemaValidationErrors.length === 0 ? "passed" : "failed";
  const regressionStatus = contentHashStatus === "matched" && schemaHashStatus === "matched" && schemaValidationStatus === "passed"
    ? "passed"
    : "failed";
  const validationErrors = [
    ...readErrors,
    ...schemaValidationErrors,
    ...(contentHashStatus === "matched" ? [] : [{ path: `${fixture.fixture_id}.content_hash`, message: `Expected ${fixture.content_hash}, got ${actualContentHash ?? "missing"}` }]),
    ...(schemaHashStatus === "matched" ? [] : [{ path: `${fixture.fixture_id}.schema_hash`, message: `Expected ${fixture.schema_hash}, got ${actualSchemaHash ?? "missing"}` }]),
  ];
  return {
    schema_version: "contract-validation-fixture-result.v1",
    validation_result_id: `contract-validation-result.${fixture.fixture_id}`,
    golden_fixture_id: fixture.golden_fixture_id,
    fixture_id: fixture.fixture_id,
    artifact_id: fixture.artifact_id,
    fixture_scope: fixture.fixture_scope,
    owner_area: fixture.owner_area,
    artifact_path: fixture.artifact_path,
    schema_path: fixture.schema_path,
    artifact_schema_version: artifactRead.value?.schema_version ?? null,
    expected_content_hash: fixture.content_hash,
    actual_content_hash: actualContentHash,
    content_hash_status: contentHashStatus,
    expected_schema_hash: fixture.schema_hash,
    actual_schema_hash: actualSchemaHash,
    schema_hash_status: schemaHashStatus,
    schema_validation_status: schemaValidationStatus,
    regression_status: regressionStatus,
    validation_error_count: validationErrors.length,
    validation_errors: validationErrors,
  };
}

function buildValidationCommandManifest(packageJson, roadmapText, generatedAt) {
  const scripts = packageJson.scripts ?? {};
  const requiredPackageScripts = REQUIRED_PACKAGE_SCRIPTS.map((scriptName) => ({
    package_script_name: scriptName,
    command: scripts[scriptName] ?? null,
    script_status: scripts[scriptName] ? "present" : "missing",
  }));
  return {
    schema_version: "contract-validation-command-manifest.v1",
    generated_at: generatedAt,
    validation_command: "npm run contracts:validate -- --check",
    required_package_script_count: requiredPackageScripts.length,
    present_package_script_count: requiredPackageScripts.filter((script) => script.script_status === "present").length,
    missing_package_script_count: requiredPackageScripts.filter((script) => script.script_status === "missing").length,
    required_package_scripts: requiredPackageScripts,
    roadmap_checks: [
      {
        roadmap_check_id: "roadmap.phase_112_declared",
        roadmap_phase: "Phase 112",
        roadmap_status: roadmapText.includes("## Phase 112 - Contract Validation CLI") ? "declared" : "missing",
      },
      {
        roadmap_check_id: "roadmap.contracts_validate_referenced",
        roadmap_phase: "Phase 112",
        roadmap_status: roadmapText.includes("npm run contracts:validate") ? "declared" : "missing",
      },
    ],
  };
}

function buildValidationItems(goldenFixtures, fixtureValidationResults, validationCommandManifest) {
  const items = [];
  addValidation(items, {
    path: "source_golden_fixtures",
    check_id: "source_golden_fixtures_complete",
    passed: goldenFixtures.summary?.golden_fixture_status === "complete" && goldenFixtures.validation?.valid !== false,
    message: `Source golden fixture status is ${goldenFixtures.summary?.golden_fixture_status ?? "unknown"}.`,
  });
  addValidation(items, {
    path: "fixture_validation_results",
    check_id: "fixture_result_count_matches_source",
    passed: fixtureValidationResults.length === (goldenFixtures.golden_fixtures ?? []).length,
    message: `${fixtureValidationResults.length} validation result(s) for ${(goldenFixtures.golden_fixtures ?? []).length} source fixture(s).`,
  });
  for (const result of fixtureValidationResults) {
    addValidation(items, {
      path: `fixture_validation_results.${result.fixture_id}.schema_validation_status`,
      check_id: "fixture_schema_validation_passed",
      passed: result.schema_validation_status === "passed",
      message: `${result.fixture_id} schema validation status is ${result.schema_validation_status}.`,
    });
    addValidation(items, {
      path: `fixture_validation_results.${result.fixture_id}.content_hash_status`,
      check_id: "fixture_content_hash_matches_golden",
      passed: result.content_hash_status === "matched",
      message: `${result.fixture_id} content hash status is ${result.content_hash_status}.`,
    });
    addValidation(items, {
      path: `fixture_validation_results.${result.fixture_id}.schema_hash_status`,
      check_id: "fixture_schema_hash_matches_golden",
      passed: result.schema_hash_status === "matched",
      message: `${result.fixture_id} schema hash status is ${result.schema_hash_status}.`,
    });
    addValidation(items, {
      path: `fixture_validation_results.${result.fixture_id}.regression_status`,
      check_id: "fixture_regression_passed",
      passed: result.regression_status === "passed",
      message: `${result.fixture_id} regression status is ${result.regression_status}.`,
    });
  }
  for (const script of validationCommandManifest.required_package_scripts) {
    addValidation(items, {
      path: `validation_command_manifest.required_package_scripts.${script.package_script_name}`,
      check_id: "required_contract_package_script_present",
      passed: script.script_status === "present",
      message: `${script.package_script_name} package script is ${script.script_status}.`,
    });
  }
  for (const roadmapCheck of validationCommandManifest.roadmap_checks) {
    addValidation(items, {
      path: `validation_command_manifest.roadmap_checks.${roadmapCheck.roadmap_check_id}`,
      check_id: "roadmap_contract_validation_declared",
      passed: roadmapCheck.roadmap_status === "declared",
      message: `${roadmapCheck.roadmap_check_id} is ${roadmapCheck.roadmap_status}.`,
    });
  }
  return items;
}

function summarizeContractValidationSuite(fixtureValidationResults, validationCommandManifest, validationItems, validation) {
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    validation_suite_status: validation.valid ? "complete" : "blocked",
    fixture_count: fixtureValidationResults.length,
    validated_fixture_count: fixtureValidationResults.filter((result) => result.validation_error_count === 0).length,
    schema_valid_fixture_count: fixtureValidationResults.filter((result) => result.schema_validation_status === "passed").length,
    schema_invalid_fixture_count: fixtureValidationResults.filter((result) => result.schema_validation_status === "failed").length,
    regression_passed_count: fixtureValidationResults.filter((result) => result.regression_status === "passed").length,
    regression_failed_count: fixtureValidationResults.filter((result) => result.regression_status === "failed").length,
    content_hash_match_count: fixtureValidationResults.filter((result) => result.content_hash_status === "matched").length,
    content_hash_mismatch_count: fixtureValidationResults.filter((result) => result.content_hash_status === "mismatched").length,
    schema_hash_match_count: fixtureValidationResults.filter((result) => result.schema_hash_status === "matched").length,
    schema_hash_mismatch_count: fixtureValidationResults.filter((result) => result.schema_hash_status === "mismatched").length,
    required_package_script_count: validationCommandManifest.required_package_script_count,
    present_package_script_count: validationCommandManifest.present_package_script_count,
    missing_package_script_count: validationCommandManifest.missing_package_script_count,
    roadmap_declared_count: validationCommandManifest.roadmap_checks.filter((check) => check.roadmap_status === "declared").length,
    roadmap_missing_count: validationCommandManifest.roadmap_checks.filter((check) => check.roadmap_status === "missing").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_fixture_scope: countBy(fixtureValidationResults, "fixture_scope"),
    by_schema_validation_status: countBy(fixtureValidationResults, "schema_validation_status"),
    by_regression_status: countBy(fixtureValidationResults, "regression_status"),
    by_content_hash_status: countBy(fixtureValidationResults, "content_hash_status"),
    by_schema_hash_status: countBy(fixtureValidationResults, "schema_hash_status"),
  };
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `contract-validation-suite.${slugify(itemPath)}.${checkId}`,
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

function renderContractValidationSuiteMarkdown(result) {
  const lines = [];
  lines.push("# Contract Validation Suite");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.validation_suite_status}`);
  lines.push("");
  lines.push(`- Fixtures: ${result.summary.fixture_count}`);
  lines.push(`- Regression passed: ${result.summary.regression_passed_count}`);
  lines.push(`- Content hash matches: ${result.summary.content_hash_match_count}`);
  lines.push(`- Schema hash matches: ${result.summary.schema_hash_match_count}`);
  lines.push(`- Missing package scripts: ${result.summary.missing_package_script_count}`);
  lines.push(`- Roadmap missing checks: ${result.summary.roadmap_missing_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Fixture Results");
  for (const resultItem of result.fixture_validation_results) {
    lines.push(`- ${resultItem.fixture_id}: ${resultItem.schema_validation_status} / ${resultItem.content_hash_status} / ${resultItem.regression_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    contract_golden_fixtures_path: path.resolve(options.contractGoldenFixturesPath ?? DEFAULT_CONTRACT_VALIDATION_SUITE_INPUTS.contractGoldenFixturesPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CONTRACT_VALIDATION_SUITE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CONTRACT_VALIDATION_SUITE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--contract-golden-fixtures") parsed.contractGoldenFixturesPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/contract-validation-suite.mjs [options]

Options:
  --contract-golden-fixtures <path> contract-golden-fixtures.json path.
  --package <path>                  package.json path.
  --roadmap <path>                  implementation roadmap path.
  --out-dir <path>                  Output directory.
  --run-at <iso>                    Fixed generation timestamp.
  --check                           Exit non-zero when validation fails.
  -h, --help                        Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
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

function serializableSuite(result) {
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

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
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
