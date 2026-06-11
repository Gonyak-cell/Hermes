import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateManifestResolver } from "./factory-candidate-manifest-resolver.mjs";

export const DEFAULT_FACTORY_WORKBENCH_READ_MODEL_OUT_DIR = "artifacts/factory-workbench-read-model/latest";

const COMMAND_NAME = "factory:workbench";
const SCHEMA_VERSION = "factory-workbench-read-model.v1";
const CAPABILITY_ID = "factory.workbench_read_model";
const PROGRAM_RANGE = "FCORE-FB.5";
const READY_STATUS = "ready_factory_workbench_read_model";
const BLOCKED_STATUS = "blocked_factory_workbench_read_model";

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryWorkbenchReadModel(options = {}) {
  const result = await buildFactoryWorkbenchReadModel(options);
  if (options.write !== false) await writeFactoryWorkbenchReadModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Workbench Read Model failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_workbench_read_model_status !== READY_STATUS) {
    const error = new Error("Factory Workbench Read Model is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryWorkbenchReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_WORKBENCH_READ_MODEL_OUT_DIR);
  const candidateResolver = await buildFactoryCandidateManifestResolver({
    ...options,
    outDir: options.candidateManifestOutDir,
    write: false,
  });
  const candidateManifests = candidateResolver.validation.valid ? candidateResolver.candidate_manifests : [];
  const workbenchRows = buildWorkbenchRows(candidateResolver, generatedAt, {
    candidateManifests,
    resolverValid: candidateResolver.validation.valid,
  });
  const boundary = buildBoundary(candidateResolver, workbenchRows, candidateManifests);
  const validationItems = buildValidationItems(candidateResolver, workbenchRows, boundary);
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary(candidateResolver, workbenchRows, candidateManifests, boundary, validation);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    source_candidate_manifest_resolver: {
      schema_version: "factory-workbench-candidate-resolver-source.v1",
      command_name: candidateResolver.command_name,
      program_range: candidateResolver.program_range,
      validation_valid: candidateResolver.validation.valid,
      validation_error_count: candidateResolver.validation.errors.length,
      product_count: candidateResolver.summary.product_count,
      resolver_row_count: candidateResolver.summary.resolver_row_count,
      candidate_manifest_count: candidateResolver.summary.candidate_manifest_count,
      starter_artifact_corpus_materialized_now: candidateResolver.summary.starter_artifact_corpus_materialized_now,
    },
    factory_workbench_rows: workbenchRows,
    candidate_manifests: candidateManifests,
    factory_workbench_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryWorkbenchReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-workbench-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "workbench-rows.json"), collectionEnvelope("factory-workbench-rows.v1", "factory_workbench_rows", result.factory_workbench_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-manifests.json"), collectionEnvelope("factory-workbench-candidate-manifests.v1", "candidate_manifests", result.candidate_manifests, result.generated_at));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-workbench-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_workbench_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryWorkbenchReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryWorkbenchReadModel(args);
    console.log(`Factory Workbench Read Model validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_workbench_read_model_status}`);
    console.log(`Products: ${result.summary.product_count}`);
    console.log(`Workbench rows: ${result.summary.workbench_row_count}`);
    console.log(`Candidate previews: ${result.summary.candidate_preview_available_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildWorkbenchRows(candidateResolver, generatedAt, { candidateManifests = [], resolverValid = false } = {}) {
  const manifestsById = new Map(candidateManifests.map((manifest) => [manifest.candidate_manifest_id, manifest]));
  return candidateResolver.candidate_manifest_resolver_rows.map((row) => {
    const candidateManifest = manifestsById.get(row.candidate_manifest_id) ?? null;
    const candidatePreviewAvailable = resolverValid && row.candidate_manifest_json_available === true && candidateManifest !== null;
    const starterMaterializedCount = row.planned_artifact_refs.filter((ref) => isStarterRefMaterialized(ref)).length;
    const workbenchViewStatus = buildWorkbenchViewStatus(row, candidatePreviewAvailable);
    const blockedReasonIds = unique([
      ...(row.blocked_reason_ids ?? []),
      ...(resolverValid ? [] : ["candidate_resolver_invalid"]),
    ]);
    return {
      schema_version: "factory-workbench-row.v1",
      workbench_row_id: `factory-workbench-row.${normalizeKey(row.product_id)}`,
      product_id: row.product_id,
      tenant_id: row.tenant_id,
      workspace_id: row.workspace_id,
      display_name: row.display_name,
      domain_pack_ids: row.domain_pack_ids ?? [],
      current_product_state: row.current_product_state,
      current_stage_rank: row.current_stage_rank,
      stage_gate_status: row.stage_gate_status,
      freshness_status: row.freshness_status,
      latest_source_timestamp: row.latest_source_timestamp,
      latest_transition_id: row.latest_transition_id,
      latest_transition_receipt_id: row.latest_transition_receipt_id,
      resolver_status: row.resolver_status,
      workbench_view_status: workbenchViewStatus,
      workbench_queue_status: candidatePreviewAvailable ? "ready_for_human_review" : "blocked_or_waiting",
      candidate_manifest_id: row.candidate_manifest_id,
      candidate_manifest_json_available: candidatePreviewAvailable,
      candidate_manifest_status: row.candidate_manifest_status,
      candidate_manifest_kind: row.candidate_manifest_kind,
      candidate_manifest_sha256: candidateManifest?.candidate_manifest_sha256 ?? null,
      candidate_manifest_preview: candidateManifest,
      candidate_manifest_visible_in_workbench: candidatePreviewAvailable,
      planned_artifact_ref_count: row.planned_artifact_refs.length,
      starter_artifact_materialized_ref_count: starterMaterializedCount,
      starter_artifact_missing_ref_count: row.planned_artifact_refs.length - starterMaterializedCount,
      starter_artifact_corpus_status: row.starter_artifact_corpus_status,
      blocked_reason_ids: blockedReasonIds,
      blocker_count: blockedReasonIds.length,
      next_operator_actions: row.next_operator_actions ?? [],
      next_operator_actions_are_instructions_only: true,
      allowed_affordances: buildAllowedAffordances(row, candidatePreviewAvailable),
      forbidden_affordances: buildForbiddenAffordances(),
      raw_confidential_material_visible: false,
      source_file_write_allowed_now: false,
      ledger_append_allowed_now: false,
      ps3_transition_append_allowed_now: false,
      candidate_manifest_write_allowed_now: false,
      apply_allowed_now: false,
      generated_at: generatedAt,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildWorkbenchViewStatus(row, candidatePreviewAvailable) {
  if (candidatePreviewAvailable) return "candidate_preview_ready";
  if (row.current_product_state === "PS2_receipt_bound") return "blocked_candidate_preview";
  return "stage_status_visible";
}

function buildAllowedAffordances(_row, candidatePreviewAvailable) {
  const base = ["view_stage_status", "view_blockers", "view_next_operator_actions"];
  if (candidatePreviewAvailable) return [...base, "view_candidate_manifest_json", "view_candidate_hash", "view_starter_artifact_refs"];
  return base;
}

function buildForbiddenAffordances() {
  return [
    "create_project",
    "append_ledger",
    "advance_ps3",
    "write_candidate_manifest",
    "apply_candidate",
    "merge_branch",
    "call_connector",
    "deploy",
    "grant_production_pass",
    "grant_enterprise_pass",
  ];
}

function buildBoundary(candidateResolver, workbenchRows, candidateManifests) {
  return {
    schema_version: "factory-workbench-boundary.v1",
    read_only: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    candidate_resolver_valid: candidateResolver.validation.valid,
    product_count: workbenchRows.length,
    workbench_row_count: workbenchRows.length,
    candidate_manifest_count: candidateManifests.length,
    candidate_preview_available_count: workbenchRows.filter((row) => row.candidate_manifest_json_available).length,
    raw_confidential_material_visible: false,
    method_allowlist: ["GET", "HEAD"],
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    ps3_transition_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems(candidateResolver, workbenchRows, boundary) {
  return [
    validationItem("candidate_resolver.valid", "source", candidateResolver.validation.valid, candidateResolver.validation.valid ? "Candidate manifest resolver is valid" : `Candidate manifest resolver has ${candidateResolver.validation.errors.length} error(s)`),
    validationItem("workbench.rows.present", "workbench", workbenchRows.length > 0, "Workbench rows are present"),
    validationItem("workbench.one_row_per_product", "workbench", new Set(workbenchRows.map((row) => row.product_id)).size === workbenchRows.length, "Workbench must expose one row per product"),
    validationItem("workbench.candidate_preview_bound", "workbench", workbenchRows.every((row) => row.candidate_manifest_json_available === false || (row.candidate_manifest_id && row.candidate_manifest_sha256)), "Visible candidate previews must be id and hash bound"),
    validationItem("workbench.affordances_read_only", "authority", workbenchRows.every((row) => row.allowed_affordances.every((item) => item.startsWith("view_"))), "Allowed workbench affordances must be read-only"),
    validationItem("workbench.no_raw_confidential", "authority", workbenchRows.every((row) => row.raw_confidential_material_visible === false), "Workbench rows must not expose raw confidential material"),
    validationItem("workbench.no_write_or_apply", "authority", workbenchRows.every((row) => row.source_file_write_allowed_now === false && row.ledger_append_allowed_now === false && row.candidate_manifest_write_allowed_now === false && row.apply_allowed_now === false), "Workbench rows must not open write/apply authority"),
    validationItem("boundary.no_write", "authority", boundary.source_file_write_allowed_now === false && boundary.ledger_append_allowed_now === false && boundary.candidate_manifest_write_allowed_now === false && boundary.apply_allowed_now === false, "Workbench boundary must keep write/apply authority closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Workbench authority flags must remain closed"),
  ];
}

function buildSummary(candidateResolver, workbenchRows, candidateManifests, boundary, validation) {
  const ready = validation.valid && candidateResolver.validation.valid && allAuthorityClosed(boundary);
  return {
    factory_workbench_read_model_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    product_count: workbenchRows.length,
    workbench_row_count: workbenchRows.length,
    workbench_view_status_counts: countBy(workbenchRows, (row) => row.workbench_view_status),
    candidate_preview_available_count: workbenchRows.filter((row) => row.candidate_manifest_json_available).length,
    candidate_manifest_count: candidateManifests.length,
    source_candidate_resolver_status: candidateResolver.summary.factory_candidate_manifest_resolver_status,
    starter_artifact_corpus_materialized_now: candidateResolver.summary.starter_artifact_corpus_materialized_now,
    raw_confidential_material_visible: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    ps3_transition_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    validation_errors: validation.errors.length,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Workbench Read Model",
    "",
    `Status: ${result.summary.factory_workbench_read_model_status}`,
    `Program: ${result.summary.program_range}`,
    `Products: ${result.summary.product_count}`,
    `Workbench rows: ${result.summary.workbench_row_count}`,
    `Candidate previews: ${result.summary.candidate_preview_available_count}`,
    `Read only: ${result.factory_workbench_boundary.read_only}`,
    `Apply allowed: ${result.summary.apply_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-workbench-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allAuthorityClosed(value) {
  return [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ].every((key) => value[key] === false);
}

function isStarterRefMaterialized(ref) {
  return ref.materialized_status === "materialized_read_only" && ref.exists_now === true && /^[a-f0-9]{64}$/.test(ref.content_sha256 ?? "");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function countBy(items, fn) {
  const counts = {};
  for (const item of items) {
    const key = fn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--factory-ledger-dir" || arg === "--ledger-dir") parsed.factoryLedgerDir = argv[++index];
    else if (arg === "--factory-seed-dir" || arg === "--seed-dir") parsed.factorySeedDir = argv[++index];
    else if (arg === "--template-root") parsed.templateRoot = argv[++index];
    else if (arg === "--pack-root") parsed.packRoot = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:workbench -- [--check] [--require-pass] [--out-dir DIR]

Builds the FB.5 read-only factory workbench projection.

Options:
  --check             Fail when validation has errors.
  --require-pass      Require ready_factory_workbench_read_model status.
  --no-write          Build in memory only.
  --out-dir DIR       Output directory.
  --factory-ledger-dir DIR
  --factory-seed-dir DIR
  --template-root DIR
  --pack-root DIR
  --run-at ISO_DATE   Deterministic timestamp for tests.
`);
}
