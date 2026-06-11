import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FACTORY_STARTER_ARTIFACT_REFS_BY_PACK,
  buildFactoryStarterArtifactRefs,
  normalizeFactoryPackId,
  normalizeKey,
} from "./factory-starter-artifact-catalog.mjs";

export const DEFAULT_FACTORY_STARTER_ARTIFACT_CORPUS_OUT_DIR = "artifacts/factory-starter-artifact-corpus/latest";
export const DEFAULT_FACTORY_STARTER_TEMPLATE_ROOT = "templates";
export const DEFAULT_FACTORY_PACK_ROOT = "packs";

const COMMAND_NAME = "factory:starter-artifacts";
const SCHEMA_VERSION = "factory-starter-artifact-corpus.v1";
const CAPABILITY_ID = "factory.starter_artifact_corpus";
const PROGRAM_RANGE = "FCORE-FB.4";
const READY_STATUS = "ready_factory_starter_artifact_corpus";
const BLOCKED_STATUS = "blocked_factory_starter_artifact_corpus";
const HASH_RE = /^[a-f0-9]{64}$/;
const SENSITIVE_MARKERS = [
  /BEGIN PRIVATE KEY/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bapi[_-]?key\s*[:=]/i,
  /\bsecret\s*[:=]/i,
  /\btoken\s*[:=]/i,
];

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryStarterArtifactCorpus(options = {}) {
  const result = await buildFactoryStarterArtifactCorpus(options);
  if (options.write !== false) await writeFactoryStarterArtifactCorpus(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Starter Artifact Corpus failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_starter_artifact_corpus_status !== READY_STATUS) {
    const error = new Error("Factory Starter Artifact Corpus is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryStarterArtifactCorpus(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_STARTER_ARTIFACT_CORPUS_OUT_DIR);
  const templateRoot = path.resolve(options.templateRoot ?? DEFAULT_FACTORY_STARTER_TEMPLATE_ROOT);
  const packRoot = path.resolve(options.packRoot ?? DEFAULT_FACTORY_PACK_ROOT);
  const packRefs = await readPackManifestTemplateRefs(packRoot);
  const factoryRefs = buildFactoryStarterTemplateRefs();
  const requiredRefs = mergeRequiredRefs([...packRefs.refs, ...factoryRefs]);
  const starterRows = await Promise.all(requiredRefs.map((ref) => buildStarterArtifactRow(ref, templateRoot, generatedAt)));
  const boundary = buildBoundary({ templateRoot, packRoot, packRefs, starterRows });
  const validationItems = buildValidationItems({ packRefs, factoryRefs, requiredRefs, starterRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ packRefs, factoryRefs, requiredRefs, starterRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs: {
      template_root: templateRoot,
      pack_root: packRoot,
    },
    required_ref_sources: {
      schema_version: "factory-starter-artifact-ref-sources.v1",
      pack_manifest_template_ref_count: packRefs.refs.length,
      factory_candidate_template_ref_count: factoryRefs.length,
      pack_manifest_read_error_count: packRefs.errors.length,
    },
    starter_artifact_rows: starterRows,
    factory_starter_artifact_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryStarterArtifactCorpus(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-starter-artifact-corpus.json"), serializableResult(result));
  await writeJson(path.join(outDir, "starter-artifact-rows.json"), collectionEnvelope("factory-starter-artifact-rows.v1", "starter_artifact_rows", result.starter_artifact_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-starter-artifact-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_starter_artifact_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryStarterArtifactCorpusCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryStarterArtifactCorpus(args);
    console.log(`Factory Starter Artifact Corpus validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_starter_artifact_corpus_status}`);
    console.log(`Required refs: ${result.summary.required_ref_count}`);
    console.log(`Materialized: ${result.summary.materialized_artifact_count}`);
    console.log(`Missing: ${result.summary.missing_artifact_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildFactoryStarterTemplateRefs() {
  return Object.keys(FACTORY_STARTER_ARTIFACT_REFS_BY_PACK).flatMap((packId) => buildFactoryStarterArtifactRefs([packId]).map((ref) => ({
    ...ref,
    source_ref_kind: "factory_candidate_manifest_planned_ref",
    source_ref_id: `${packId}:${ref.artifact_role}`,
  })));
}

async function readPackManifestTemplateRefs(packRoot) {
  const refs = [];
  const errors = [];
  let entries = [];
  try {
    entries = await readdir(packRoot, { withFileTypes: true });
  } catch (error) {
    return { refs, errors: [{ path: packRoot, message: error.code === "ENOENT" ? "Pack root not found" : error.message }] };
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packRoot, entry.name, "pack.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      for (const templatePath of manifest.templates ?? []) {
        refs.push({
          schema_version: "factory-candidate-artifact-ref.v1",
          artifact_ref_id: `artifact-ref.${normalizeKey(normalizeFactoryPackId(manifest.pack_id))}.${normalizeKey(path.basename(templatePath, path.extname(templatePath)))}`,
          product_id: null,
          domain_pack_id: normalizeFactoryPackId(manifest.pack_id),
          artifact_path: templatePath,
          artifact_role: inferArtifactRole(templatePath),
          artifact_kind: "starter_template",
          source_ref_kind: "pack_manifest_template_ref",
          source_ref_id: `${manifest.pack_id}:${templatePath}`,
          pack_manifest_path: manifestPath,
        });
      }
    } catch (error) {
      errors.push({ path: manifestPath, message: error.code === "ENOENT" ? "Pack manifest not found" : error.message });
    }
  }
  return { refs, errors };
}

function mergeRequiredRefs(refs) {
  const merged = new Map();
  for (const ref of refs) {
    const key = `${ref.domain_pack_id}:${ref.artifact_path}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...ref,
        source_ref_kinds: [ref.source_ref_kind].filter(Boolean),
        source_ref_ids: [ref.source_ref_id].filter(Boolean),
      });
      continue;
    }
    existing.source_ref_kinds = unique([...existing.source_ref_kinds, ref.source_ref_kind].filter(Boolean));
    existing.source_ref_ids = unique([...existing.source_ref_ids, ref.source_ref_id].filter(Boolean));
  }
  return [...merged.values()].sort((left, right) => left.artifact_path.localeCompare(right.artifact_path) || left.domain_pack_id.localeCompare(right.domain_pack_id));
}

async function buildStarterArtifactRow(ref, templateRoot, generatedAt) {
  const pathStatus = resolveStarterArtifactPath(ref.artifact_path, templateRoot);
  const row = {
    schema_version: "factory-starter-artifact-row.v1",
    starter_artifact_id: `starter-artifact.${normalizeKey(ref.domain_pack_id)}.${normalizeKey(ref.artifact_path)}`,
    domain_pack_id: ref.domain_pack_id,
    artifact_path: ref.artifact_path,
    artifact_role: ref.artifact_role,
    artifact_kind: ref.artifact_kind,
    source_ref_kinds: ref.source_ref_kinds,
    source_ref_ids: ref.source_ref_ids,
    resolved_path: pathStatus.safe ? pathStatus.path : null,
    path_within_template_root: pathStatus.safe,
    content_type: inferContentType(ref.artifact_path),
    exists_now: false,
    materialized_status: "missing",
    byte_count: 0,
    content_sha256: null,
    json_parse_valid: null,
    sensitive_marker_detected: false,
    generated_at: generatedAt,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    authority_flags: AUTHORITY_CLOSED,
  };
  if (!pathStatus.safe) {
    return { ...row, materialized_status: "blocked_unsafe_path", path_error: pathStatus.error };
  }
  try {
    const content = await readFile(pathStatus.path);
    const text = content.toString("utf8");
    const jsonParseValid = row.content_type === "application/json" ? parseJson(text) : null;
    const sensitiveMarkerDetected = SENSITIVE_MARKERS.some((pattern) => pattern.test(text));
    return {
      ...row,
      exists_now: true,
      materialized_status: jsonParseValid === false ? "blocked_invalid_json" : sensitiveMarkerDetected ? "blocked_sensitive_marker" : "materialized_read_only",
      byte_count: content.length,
      content_sha256: sha256(content),
      json_parse_valid: jsonParseValid,
      sensitive_marker_detected: sensitiveMarkerDetected,
    };
  } catch (error) {
    return {
      ...row,
      path_error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function resolveStarterArtifactPath(artifactPath, templateRoot) {
  if (path.isAbsolute(artifactPath) || artifactPath.includes("..")) {
    return { safe: false, path: null, error: "artifact_path_must_be_relative_and_not_escape_template_root" };
  }
  if (!artifactPath.startsWith("templates/")) {
    return { safe: false, path: null, error: "artifact_path_must_start_with_templates" };
  }
  const relativeToTemplateRoot = artifactPath.slice("templates/".length);
  const resolved = path.resolve(templateRoot, relativeToTemplateRoot);
  const root = path.resolve(templateRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return { safe: false, path: null, error: "resolved_path_escapes_template_root" };
  }
  return { safe: true, path: resolved, error: null };
}

function buildBoundary({ templateRoot, packRoot, packRefs, starterRows }) {
  return {
    schema_version: "factory-starter-artifact-boundary.v1",
    read_only: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    template_root: templateRoot,
    pack_root: packRoot,
    required_ref_count: starterRows.length,
    materialized_artifact_count: starterRows.filter((row) => row.materialized_status === "materialized_read_only").length,
    missing_artifact_count: starterRows.filter((row) => row.exists_now === false).length,
    pack_manifest_read_error_count: packRefs.errors.length,
    starter_artifact_corpus_materialized_now: starterRows.length > 0 && starterRows.every((row) => row.materialized_status === "materialized_read_only"),
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

function buildValidationItems({ packRefs, factoryRefs, requiredRefs, starterRows, boundary }) {
  return [
    validationItem("refs.pack_manifests_readable", "source", packRefs.errors.length === 0, packRefs.errors.length === 0 ? "Pack manifest template refs were read" : `${packRefs.errors.length} pack manifest read error(s)`),
    validationItem("refs.factory_refs_present", "source", factoryRefs.length > 0, "Factory candidate starter refs are declared"),
    validationItem("refs.required_refs_present", "source", requiredRefs.length > 0, "Starter artifact required refs are present"),
    validationItem("paths.safe", "artifact", starterRows.every((row) => row.path_within_template_root === true), "Starter artifact paths must stay inside the template root"),
    validationItem("artifacts.materialized", "artifact", starterRows.length > 0 && starterRows.every((row) => row.exists_now === true), "Every starter artifact ref must exist on disk"),
    validationItem("artifacts.non_empty", "artifact", starterRows.every((row) => row.byte_count > 0), "Starter artifact files must not be empty"),
    validationItem("artifacts.hash_bound", "artifact", starterRows.every((row) => HASH_RE.test(row.content_sha256 ?? "")), "Starter artifact files must carry SHA-256 hashes"),
    validationItem("artifacts.json_valid", "artifact", starterRows.every((row) => row.json_parse_valid !== false), "JSON starter artifacts must parse"),
    validationItem("artifacts.no_sensitive_markers", "artifact", starterRows.every((row) => row.sensitive_marker_detected === false), "Starter artifacts must not include obvious secret markers"),
    validationItem("boundary.materialized", "authority", boundary.starter_artifact_corpus_materialized_now === true, "Starter artifact corpus must be fully materialized before candidate instantiation"),
    validationItem("boundary.no_write", "authority", boundary.source_file_write_allowed_now === false && boundary.ledger_append_allowed_now === false && boundary.candidate_manifest_write_allowed_now === false && boundary.apply_allowed_now === false, "Starter artifact corpus validator must remain read-only"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Factory starter artifact authority flags must remain closed"),
  ];
}

function buildSummary({ packRefs, factoryRefs, requiredRefs, starterRows, boundary, validation }) {
  const ready = validation.valid && boundary.starter_artifact_corpus_materialized_now && allAuthorityClosed(boundary);
  return {
    factory_starter_artifact_corpus_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    pack_manifest_template_ref_count: packRefs.refs.length,
    factory_candidate_template_ref_count: factoryRefs.length,
    required_ref_count: requiredRefs.length,
    starter_artifact_count: starterRows.length,
    materialized_artifact_count: starterRows.filter((row) => row.materialized_status === "materialized_read_only").length,
    missing_artifact_count: starterRows.filter((row) => row.exists_now === false).length,
    invalid_artifact_count: starterRows.filter((row) => row.exists_now && row.materialized_status !== "materialized_read_only").length,
    starter_artifact_corpus_materialized_now: boundary.starter_artifact_corpus_materialized_now,
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
    "# Factory Starter Artifact Corpus",
    "",
    `Status: ${result.summary.factory_starter_artifact_corpus_status}`,
    `Program: ${result.summary.program_range}`,
    `Required refs: ${result.summary.required_ref_count}`,
    `Materialized artifacts: ${result.summary.materialized_artifact_count}`,
    `Missing artifacts: ${result.summary.missing_artifact_count}`,
    `Starter corpus materialized: ${result.summary.starter_artifact_corpus_materialized_now}`,
    `Candidate manifest write allowed: ${result.summary.candidate_manifest_write_allowed_now}`,
    `Apply allowed: ${result.summary.apply_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function inferArtifactRole(artifactPath) {
  return normalizeKey(path.basename(artifactPath, path.extname(artifactPath)));
}

function inferContentType(artifactPath) {
  if (artifactPath.endsWith(".json")) return "application/json";
  if (artifactPath.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function parseJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-starter-artifact-validation-item.v1",
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
  return Object.entries(AUTHORITY_CLOSED).every(([key, expected]) => value[key] === expected);
}

function unique(values) {
  return [...new Set(values)];
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_FACTORY_STARTER_ARTIFACT_CORPUS_OUT_DIR,
    templateRoot: DEFAULT_FACTORY_STARTER_TEMPLATE_ROOT,
    packRoot: DEFAULT_FACTORY_PACK_ROOT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--template-root") args.templateRoot = argv[++index];
    else if (arg === "--pack-root") args.packRoot = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-starter-artifact-corpus.mjs [options]

Options:
  --template-root <folder>  Template root. Default: ${DEFAULT_FACTORY_STARTER_TEMPLATE_ROOT}
  --pack-root <folder>      Domain pack root. Default: ${DEFAULT_FACTORY_PACK_ROOT}
  --out-dir <folder>        Output directory.
  --run-at <iso>            Deterministic generated_at timestamp.
  --check                   Validate only, do not write artifacts.
  --require-pass            Fail unless the corpus is ready.
  -h, --help                Show this help.
`);
}
