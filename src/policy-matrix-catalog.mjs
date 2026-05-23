import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validatePolicyMatrix,
} from "./core-contract-validator.mjs";

export const DEFAULT_POLICY_MATRIX_CATALOG_INPUT = "examples/core/policy-matrix.json";
export const DEFAULT_POLICY_MATRIX_CATALOG_OUT_DIR = "artifacts/policy-matrix/latest";

export async function runPolicyMatrixCatalog(options = {}) {
  const result = await buildPolicyMatrixCatalog(options);
  if (options.write !== false) await writePolicyMatrixCatalog(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy matrix catalog validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicyMatrixCatalog(options = {}) {
  const matrixPath = path.resolve(options.matrixPath ?? DEFAULT_POLICY_MATRIX_CATALOG_INPUT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_MATRIX_CATALOG_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const matrix = JSON.parse(await readFile(matrixPath, "utf8"));
  const schemas = await loadCoreSchemas(options.schemaDir);
  const validation = validatePolicyMatrix(matrix, schemas);
  const classificationLevels = (matrix.classification_levels ?? []).map((level) => ({
    classification: level.classification,
    name: level.name,
    description: level.description,
    default_external_model_policy: level.default_external_model_policy,
    metadata: level.metadata ?? {},
  }));
  const runtimeRules = (matrix.runtime_rules ?? []).map((rule) => ({
    runtime_rule_id: `runtime-policy.${rule.classification}`,
    classification: rule.classification,
    allowed_runtimes: rule.allowed_runtimes ?? [],
    restricted_runtimes: rule.restricted_runtimes ?? [],
    forbidden_runtimes: rule.forbidden_runtimes ?? [],
    required_gates: rule.required_gates ?? [],
    allowed_runtime_count: rule.allowed_runtimes?.length ?? 0,
    restricted_runtime_count: rule.restricted_runtimes?.length ?? 0,
    forbidden_runtime_count: rule.forbidden_runtimes?.length ?? 0,
    required_gate_count: rule.required_gates?.length ?? 0,
    notes: rule.notes ?? "",
  }));
  const modelRules = (matrix.model_rules ?? []).map((rule) => ({
    model_rule_id: `model-policy.${rule.classification}`,
    classification: rule.classification,
    external_model_policy: rule.external_model_policy,
    local_model_policy: rule.local_model_policy,
    redaction_policy: rule.redaction_policy,
    approval_required: Boolean(rule.approval_required),
    notes: rule.notes ?? "",
  }));
  const toolRules = (matrix.tool_rules ?? []).map((rule) => ({
    tool_id: rule.tool_id,
    description: rule.description,
    default_policy: rule.default_policy,
    required_gates: rule.required_gates ?? [],
    required_gate_count: rule.required_gates?.length ?? 0,
    approval_required: rule.default_policy === "approval_required",
    metadata: rule.metadata ?? {},
  }));
  const outputRules = (matrix.output_rules ?? []).map((rule) => ({
    artifact_type: rule.artifact_type,
    default_status: rule.default_status,
    required_gates: rule.required_gates ?? [],
    required_gate_count: rule.required_gates?.length ?? 0,
    delivery_policy: rule.delivery_policy,
    approval_required: ["approval_required", "partner_approval_required"].includes(rule.delivery_policy),
    metadata: rule.metadata ?? {},
  }));
  const gateRules = (matrix.gate_rules ?? []).map((rule) => ({
    gate_id: rule.gate_id,
    stage: rule.stage,
    description: rule.description,
    blocking_by_default: Boolean(rule.blocking_by_default),
    metadata: rule.metadata ?? {},
  }));
  const catalog = {
    schema_version: "policy-matrix-catalog.v1",
    generated_at: generatedAt,
    catalog_id: `policy-matrix-catalog.${dateStamp(generatedAt)}`,
    source_policy_matrix_path: matrixPath,
    output_dir: outputDir,
    policy_matrix: {
      schema_version: matrix.schema_version,
      matrix_id: matrix.matrix_id,
      version: matrix.version,
      generated_at: matrix.generated_at,
      metadata: matrix.metadata ?? {},
    },
    policy_status: validation.valid ? "valid" : "invalid",
    summary: summarizePolicyCatalog({
      classificationLevels,
      runtimeRules,
      modelRules,
      toolRules,
      outputRules,
      gateRules,
      validation,
    }),
    classification_levels: classificationLevels,
    runtime_rules: runtimeRules,
    model_rules: modelRules,
    tool_rules: toolRules,
    output_rules: outputRules,
    gate_rules: gateRules,
    validation,
  };

  return {
    ...catalog,
    markdown: renderPolicyMatrixCatalogMarkdown(catalog),
  };
}

export async function writePolicyMatrixCatalog(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "policy-matrix-catalog.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    catalog_id: result.catalog_id,
    source_policy_matrix_path: result.source_policy_matrix_path,
    output_dir: result.output_dir,
    policy_matrix: result.policy_matrix,
    policy_status: result.policy_status,
    summary: result.summary,
    classification_levels: result.classification_levels,
    runtime_rules: result.runtime_rules,
    model_rules: result.model_rules,
    tool_rules: result.tool_rules,
    output_rules: result.output_rules,
    gate_rules: result.gate_rules,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "policy-rules.json"), {
    generated_at: result.generated_at,
    classification_levels: result.classification_levels,
    runtime_rules: result.runtime_rules,
    model_rules: result.model_rules,
    tool_rules: result.tool_rules,
    output_rules: result.output_rules,
    gate_rules: result.gate_rules,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicyMatrixCatalogCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicyMatrixCatalog(args);
    console.log(`Policy matrix catalog ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Policy status: ${result.policy_status}`);
    console.log(`Classifications: ${result.summary.classification_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function summarizePolicyCatalog({
  classificationLevels,
  runtimeRules,
  modelRules,
  toolRules,
  outputRules,
  gateRules,
  validation,
}) {
  return {
    policy_status: validation.valid ? "valid" : "invalid",
    classification_count: classificationLevels.length,
    runtime_rule_count: runtimeRules.length,
    model_rule_count: modelRules.length,
    tool_rule_count: toolRules.length,
    output_rule_count: outputRules.length,
    gate_rule_count: gateRules.length,
    external_model_forbidden_count: modelRules.filter((rule) => rule.external_model_policy === "forbidden").length,
    external_model_approval_required_count: modelRules.filter((rule) => rule.external_model_policy === "approval_required").length,
    model_approval_required_count: modelRules.filter((rule) => rule.approval_required).length,
    restricted_runtime_binding_count: runtimeRules.reduce((sum, rule) => sum + rule.restricted_runtime_count, 0),
    forbidden_runtime_binding_count: runtimeRules.reduce((sum, rule) => sum + rule.forbidden_runtime_count, 0),
    approval_required_tool_count: toolRules.filter((rule) => rule.default_policy === "approval_required").length,
    restricted_tool_count: toolRules.filter((rule) => rule.default_policy === "restricted").length,
    approval_required_output_count: outputRules.filter((rule) => rule.approval_required).length,
    partner_approval_output_count: outputRules.filter((rule) => rule.delivery_policy === "partner_approval_required").length,
    blocking_gate_count: gateRules.filter((rule) => rule.blocking_by_default).length,
    validation_error_count: validation.errors.length,
    by_external_model_policy: countBy(modelRules, "external_model_policy"),
    by_tool_policy: countBy(toolRules, "default_policy"),
    by_delivery_policy: countBy(outputRules, "delivery_policy"),
    by_gate_stage: countBy(gateRules, "stage"),
  };
}

function renderPolicyMatrixCatalogMarkdown(catalog) {
  const lines = [];
  lines.push("# Policy Matrix Catalog");
  lines.push("");
  lines.push(`Generated: ${catalog.generated_at}`);
  lines.push(`Matrix: ${catalog.policy_matrix.matrix_id}`);
  lines.push(`Policy status: ${catalog.policy_status}`);
  lines.push("");
  lines.push(`- Classifications: ${catalog.summary.classification_count}`);
  lines.push(`- Runtime rules: ${catalog.summary.runtime_rule_count}`);
  lines.push(`- Model rules: ${catalog.summary.model_rule_count}`);
  lines.push(`- Tool rules: ${catalog.summary.tool_rule_count}`);
  lines.push(`- Output rules: ${catalog.summary.output_rule_count}`);
  lines.push(`- Gate rules: ${catalog.summary.gate_rule_count}`);
  lines.push(`- External model forbidden: ${catalog.summary.external_model_forbidden_count}`);
  lines.push(`- External model approval required: ${catalog.summary.external_model_approval_required_count}`);
  lines.push(`- Validation errors: ${catalog.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Classification Model Policy");
  lines.push("");
  for (const rule of catalog.model_rules) {
    lines.push(`- ${rule.classification}: external=${rule.external_model_policy}, local=${rule.local_model_policy}, redaction=${rule.redaction_policy}`);
  }
  if (catalog.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of catalog.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
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

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    matrixPath: DEFAULT_POLICY_MATRIX_CATALOG_INPUT,
    outDir: DEFAULT_POLICY_MATRIX_CATALOG_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--policy-matrix" || arg === "--matrix") parsed.matrixPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-matrix-catalog.mjs [options]

Options:
  --policy-matrix <path>  policy-matrix.v1 JSON path.
  --out-dir <folder>     Output directory.
  --run-at <iso>         Deterministic generated_at timestamp.
  --check                Exit non-zero when the policy matrix is invalid.
  -h, --help             Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
