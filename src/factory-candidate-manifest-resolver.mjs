import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryStageReadModel } from "./factory-stage-read-model.mjs";
import { buildFactoryStarterArtifactCorpus } from "./factory-starter-artifact-corpus.mjs";
import { buildFactoryStarterArtifactRefs, normalizeKey } from "./factory-starter-artifact-catalog.mjs";

export const DEFAULT_FACTORY_CANDIDATE_MANIFEST_RESOLVER_OUT_DIR = "artifacts/factory-candidate-manifest-resolver/latest";

const COMMAND_NAME = "factory:candidate-manifests";
const SCHEMA_VERSION = "factory-candidate-manifest-resolver.v1";
const CAPABILITY_ID = "factory.candidate_manifest_resolver";
const PROGRAM_RANGE = "FCORE-FB.3";
const READY_STATUS = "ready_factory_candidate_manifest_resolver";
const BLOCKED_STATUS = "blocked_factory_candidate_manifest_resolver";
const HASH_RE = /^[a-f0-9]{64}$/;

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryCandidateManifestResolver(options = {}) {
  const result = await buildFactoryCandidateManifestResolver(options);
  if (options.write !== false) await writeFactoryCandidateManifestResolver(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Candidate Manifest Resolver failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.factory_candidate_manifest_resolver_status !== READY_STATUS) {
    const error = new Error("Factory Candidate Manifest Resolver is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryCandidateManifestResolver(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CANDIDATE_MANIFEST_RESOLVER_OUT_DIR);
  const stageReadModel = await buildFactoryStageReadModel({
    ...options,
    outDir: options.stageOutDir,
    write: false,
  });
  const starterCorpus = await buildFactoryStarterArtifactCorpus({
    ...options,
    outDir: options.starterArtifactOutDir,
    write: false,
  });
  const resolverRows = buildResolverRows(stageReadModel.factory_stage_rows, generatedAt, starterCorpus);
  const candidateManifests = resolverRows
    .filter((row) => row.candidate_manifest_json_available)
    .map((row) => buildCandidateManifest(row, generatedAt));
  const boundary = buildBoundary(stageReadModel, starterCorpus, resolverRows, candidateManifests);
  const validationItems = buildValidationItems(stageReadModel, starterCorpus, resolverRows, candidateManifests, boundary);
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary(stageReadModel, starterCorpus, resolverRows, candidateManifests, boundary, validation);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    source_stage_read_model: {
      schema_version: "factory-candidate-stage-source.v1",
      command_name: stageReadModel.command_name,
      program_range: stageReadModel.program_range,
      validation_valid: stageReadModel.validation.valid,
      validation_error_count: stageReadModel.validation.errors.length,
      product_count: stageReadModel.summary.product_count,
      product_source_tier: stageReadModel.summary.product_source_tier,
      transition_source_tiers: stageReadModel.summary.transition_source_tiers,
    },
    source_starter_artifact_corpus: {
      schema_version: "factory-candidate-starter-corpus-source.v1",
      command_name: starterCorpus.command_name,
      program_range: starterCorpus.program_range,
      validation_valid: starterCorpus.validation.valid,
      validation_error_count: starterCorpus.validation.errors.length,
      required_ref_count: starterCorpus.summary.required_ref_count,
      materialized_artifact_count: starterCorpus.summary.materialized_artifact_count,
      missing_artifact_count: starterCorpus.summary.missing_artifact_count,
      starter_artifact_corpus_materialized_now: starterCorpus.summary.starter_artifact_corpus_materialized_now,
    },
    candidate_manifest_resolver_rows: resolverRows,
    candidate_manifests: candidateManifests,
    factory_candidate_manifest_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryCandidateManifestResolver(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const manifestDir = path.join(outDir, "candidate-manifests");
  await mkdir(manifestDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-candidate-manifest-resolver.json"), serializableResult(result));
  await writeJson(path.join(outDir, "resolver-rows.json"), collectionEnvelope("factory-candidate-manifest-resolver-rows.v1", "candidate_manifest_resolver_rows", result.candidate_manifest_resolver_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-manifests.json"), collectionEnvelope("factory-candidate-manifests.v1", "candidate_manifests", result.candidate_manifests, result.generated_at));
  for (const manifest of result.candidate_manifests) {
    await writeJson(path.join(manifestDir, `${normalizeKey(manifest.candidate_manifest_id)}.json`), manifest);
  }
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-candidate-manifest-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_candidate_manifest_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryCandidateManifestResolverCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryCandidateManifestResolver(args);
    console.log(`Factory Candidate Manifest Resolver validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_candidate_manifest_resolver_status}`);
    console.log(`Products: ${result.summary.product_count}`);
    console.log(`Resolver rows: ${result.summary.resolver_row_count}`);
    console.log(`Candidate manifests: ${result.summary.candidate_manifest_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildResolverRows(stageRows, generatedAt, starterCorpus) {
  const starterArtifactByPath = new Map(starterCorpus.starter_artifact_rows.map((row) => [row.artifact_path, row]));
  return stageRows.map((row) => {
    const stageEligible = isEligibleForCandidateManifest(row);
    const plannedArtifactRefs = buildPlannedArtifactRefs(row, starterArtifactByPath);
    const starterReady = plannedArtifactRefs.length > 0 && plannedArtifactRefs.every(isMaterializedStarterArtifactRef);
    const eligible = stageEligible && starterReady;
    const candidateManifestId = eligible ? buildCandidateManifestId(row.product_id) : null;
    return {
      schema_version: "factory-candidate-manifest-resolver-row.v1",
      product_id: row.product_id,
      tenant_id: row.tenant_id,
      workspace_id: row.workspace_id,
      display_name: row.display_name,
      domain_pack_ids: row.domain_pack_ids,
      current_product_state: row.current_product_state,
      current_stage_rank: row.current_stage_rank,
      stage_gate_status: row.gate_status,
      freshness_status: row.freshness_status,
      latest_source_timestamp: row.latest_source_timestamp,
      latest_transition_id: row.latest_transition_id,
      latest_transition_receipt_id: row.latest_transition_receipt_id,
      resolver_status: eligible ? "candidate_manifest_json_ready" : buildBlockedResolverStatus(row, { stageEligible, starterReady, plannedArtifactRefs }),
      candidate_manifest_id: candidateManifestId,
      candidate_manifest_json_available: eligible,
      candidate_manifest_status: eligible ? "json_preview_ready" : "blocked",
      candidate_manifest_kind: "json_only_preview",
      candidate_manifest_sha256: null,
      candidate_manifest_output_path: candidateManifestId ? `candidate-manifests/${normalizeKey(candidateManifestId)}.json` : null,
      blocked_reason_ids: eligible ? [] : buildBlockedReasonIds(row, { stageEligible, starterReady, plannedArtifactRefs }),
      apply_blocker_ids: eligible ? ["candidate_receipt_not_bound", "apply_engine_closed"] : buildBlockedReasonIds(row, { stageEligible, starterReady, plannedArtifactRefs }),
      next_operator_actions: eligible ? ["review_candidate_manifest_json", "bind_candidate_receipt_before_apply"] : buildNextOperatorActions(row, { stageEligible, starterReady }),
      next_operator_actions_are_instructions_only: true,
      planned_artifact_refs: plannedArtifactRefs,
      starter_artifact_corpus_status: buildStarterCorpusStatus({ plannedArtifactRefs, starterReady }),
      generated_at: generatedAt,
      json_only_manifest_generation: true,
      source_file_write_allowed_now: false,
      ledger_append_allowed_now: false,
      ps3_transition_append_allowed_now: false,
      candidate_manifest_write_allowed_now: false,
      apply_allowed_now: false,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildCandidateManifest(row, generatedAt) {
  const draft = {
    schema_version: "factory-candidate-manifest.v1",
    candidate_manifest_id: row.candidate_manifest_id,
    candidate_manifest_kind: row.candidate_manifest_kind,
    candidate_manifest_status: row.candidate_manifest_status,
    product_id: row.product_id,
    tenant_id: row.tenant_id,
    workspace_id: row.workspace_id,
    display_name: row.display_name,
    domain_pack_ids: row.domain_pack_ids,
    generated_at: generatedAt,
    resolver: {
      schema_version: "factory-candidate-manifest-resolver-ref.v1",
      command_name: COMMAND_NAME,
      program_range: PROGRAM_RANGE,
      json_only_manifest_generation: true,
      starter_artifact_corpus_status: row.starter_artifact_corpus_status,
      fb4_starter_artifact_corpus_required: true,
      starter_artifact_corpus_materialized_now: row.starter_artifact_corpus_status === "materialized_read_only",
    },
    source_stage_ref: {
      schema_version: "factory-candidate-stage-ref.v1",
      current_product_state: row.current_product_state,
      current_stage_rank: row.current_stage_rank,
      stage_gate_status: row.stage_gate_status,
      freshness_status: row.freshness_status,
      latest_source_timestamp: row.latest_source_timestamp,
      latest_transition_id: row.latest_transition_id,
      latest_transition_receipt_id: row.latest_transition_receipt_id,
    },
    planned_artifact_refs: row.planned_artifact_refs,
    apply_blocker_ids: row.apply_blocker_ids,
    human_review_note_required_before_apply: true,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    ps3_transition_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    authority_flags: AUTHORITY_CLOSED,
  };
  const candidateManifestSha256 = sha256(canonicalize(draft));
  return { ...draft, candidate_manifest_sha256: candidateManifestSha256 };
}

function buildBoundary(stageReadModel, starterCorpus, resolverRows, candidateManifests) {
  return {
    schema_version: "factory-candidate-manifest-boundary.v1",
    read_only: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    stage_read_model_valid: stageReadModel.validation.valid,
    product_count: resolverRows.length,
    resolver_row_count: resolverRows.length,
    candidate_manifest_count: candidateManifests.length,
    json_only_manifest_generation: true,
    starter_artifact_corpus_required_before_apply: true,
    starter_artifact_corpus_materialized_now: starterCorpus.summary.starter_artifact_corpus_materialized_now,
    starter_artifact_required_ref_count: starterCorpus.summary.required_ref_count,
    starter_artifact_materialized_count: starterCorpus.summary.materialized_artifact_count,
    starter_artifact_missing_count: starterCorpus.summary.missing_artifact_count,
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

function buildValidationItems(stageReadModel, starterCorpus, resolverRows, candidateManifests, boundary) {
  const eligibleRows = resolverRows.filter((row) => row.candidate_manifest_json_available);
  const plannedRefs = resolverRows.flatMap((row) => row.planned_artifact_refs);
  return [
    validationItem("stage.valid", "source", stageReadModel.validation.valid, stageReadModel.validation.valid ? "Factory stage read model is valid" : `Factory stage read model has ${stageReadModel.validation.errors.length} error(s)`),
    validationItem("starter_corpus.valid", "source", starterCorpus.validation.valid, starterCorpus.validation.valid ? "Factory starter artifact corpus is valid" : `Factory starter artifact corpus has ${starterCorpus.validation.errors.length} error(s)`),
    validationItem("resolver.rows.present", "resolver", resolverRows.length > 0, "Candidate manifest resolver rows are present"),
    validationItem("resolver.eligibility_bound", "resolver", eligibleRows.length === candidateManifests.length, "Every eligible resolver row has exactly one candidate manifest"),
    validationItem("resolver.no_ineligible_manifest", "resolver", resolverRows.every((row) => row.candidate_manifest_json_available || row.candidate_manifest_id === null), "Ineligible rows must not expose candidate manifest ids"),
    validationItem("resolver.starter_refs_materialized", "resolver", plannedRefs.every(isMaterializedStarterArtifactRef), "Resolver starter artifact refs must be materialized and hash-bound"),
    validationItem("manifests.hash_bound", "manifest", candidateManifests.every((manifest) => HASH_RE.test(manifest.candidate_manifest_sha256)), "Candidate manifests must carry SHA-256 hashes"),
    validationItem("manifests.json_only", "authority", candidateManifests.every((manifest) => manifest.resolver.json_only_manifest_generation === true && manifest.candidate_manifest_kind === "json_only_preview"), "Candidate manifests must be JSON-only previews"),
    validationItem("manifests.starter_refs_materialized", "manifest", candidateManifests.every((manifest) => manifest.planned_artifact_refs.every(isMaterializedStarterArtifactRef)), "Candidate manifests must reference materialized starter artifacts"),
    validationItem("manifests.no_write_or_apply", "authority", candidateManifests.every((manifest) => manifest.source_file_write_allowed_now === false && manifest.ledger_append_allowed_now === false && manifest.candidate_manifest_write_allowed_now === false && manifest.apply_allowed_now === false), "Candidate manifests must not open write/apply authority"),
    validationItem("rows.next_actions_instruction_only", "authority", resolverRows.every((row) => row.next_operator_actions_are_instructions_only === true && Array.isArray(row.next_operator_actions)), "Resolver next actions must remain read-only instructions"),
    validationItem("boundary.starter_corpus_materialized", "authority", boundary.starter_artifact_corpus_materialized_now === true, "FB.4 must materialize the starter artifact corpus before candidate instantiation"),
    validationItem("boundary.json_only", "authority", boundary.json_only_manifest_generation === true, "FB.4 candidate manifests must remain JSON-only previews"),
    validationItem("boundary.no_write", "authority", boundary.source_file_write_allowed_now === false && boundary.ledger_append_allowed_now === false && boundary.candidate_manifest_write_allowed_now === false && boundary.apply_allowed_now === false, "Candidate manifest resolver must keep write/apply authority closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Candidate manifest resolver authority flags must remain closed"),
  ];
}

function buildSummary(stageReadModel, starterCorpus, resolverRows, candidateManifests, boundary, validation) {
  const ready = validation.valid && stageReadModel.validation.valid && starterCorpus.validation.valid && allAuthorityClosed(boundary);
  return {
    factory_candidate_manifest_resolver_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    product_count: resolverRows.length,
    resolver_row_count: resolverRows.length,
    candidate_manifest_count: candidateManifests.length,
    candidate_manifest_json_available_count: resolverRows.filter((row) => row.candidate_manifest_json_available).length,
    resolver_status_counts: countBy(resolverRows, (row) => row.resolver_status),
    product_source_tier: stageReadModel.summary.product_source_tier,
    transition_source_tiers: stageReadModel.summary.transition_source_tiers,
    stage_validation_errors: stageReadModel.validation.errors.length,
    starter_artifact_corpus_validation_errors: starterCorpus.validation.errors.length,
    json_only_manifest_generation: true,
    starter_artifact_corpus_required_before_apply: true,
    starter_artifact_corpus_materialized_now: starterCorpus.summary.starter_artifact_corpus_materialized_now,
    starter_artifact_required_ref_count: starterCorpus.summary.required_ref_count,
    starter_artifact_materialized_count: starterCorpus.summary.materialized_artifact_count,
    starter_artifact_missing_count: starterCorpus.summary.missing_artifact_count,
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
    "# Factory Candidate Manifest Resolver",
    "",
    `Status: ${result.summary.factory_candidate_manifest_resolver_status}`,
    `Program: ${result.summary.program_range}`,
    `Products: ${result.summary.product_count}`,
    `Resolver rows: ${result.summary.resolver_row_count}`,
    `Candidate manifests: ${result.summary.candidate_manifest_count}`,
    `JSON only: ${result.summary.json_only_manifest_generation}`,
    `Starter corpus materialized: ${result.summary.starter_artifact_corpus_materialized_now}`,
    `Candidate manifest write allowed: ${result.summary.candidate_manifest_write_allowed_now}`,
    `Apply allowed: ${result.summary.apply_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function isEligibleForCandidateManifest(row) {
  return row.current_product_state === "PS2_receipt_bound"
    && row.freshness_status === "fresh"
    && row.ps3_or_later_transition_present === false;
}

function buildBlockedResolverStatus(row, { stageEligible = false, starterReady = false } = {}) {
  if (stageEligible && !starterReady) return "blocked_missing_starter_artifact_corpus";
  if (row.freshness_status !== "fresh") return "blocked_stale_source";
  if (row.ps3_or_later_transition_present) return "blocked_ps3_before_fb_promotion";
  if (row.current_product_state !== "PS2_receipt_bound") return "blocked_until_ps2_receipt_bound";
  return "blocked_unknown_candidate_manifest_condition";
}

function buildBlockedReasonIds(row, { stageEligible = false, starterReady = false, plannedArtifactRefs = [] } = {}) {
  if (stageEligible && !starterReady && plannedArtifactRefs.length === 0) return ["starter_artifact_refs_unmapped"];
  if (stageEligible && !starterReady) return ["starter_artifact_corpus_missing"];
  if (row.freshness_status !== "fresh") return ["source_freshness_window_exceeded"];
  if (row.ps3_or_later_transition_present) return ["ps3_transition_before_fb_promotion"];
  if (row.current_product_state !== "PS2_receipt_bound") return ["ps2_receipt_binding_missing"];
  return ["candidate_manifest_condition_unresolved"];
}

function buildCandidateManifestId(productId) {
  return `candidate-manifest.${normalizeKey(productId.replace(/^product\./, ""))}.fb3`;
}

function buildNextOperatorActions(row, { stageEligible = false, starterReady = false } = {}) {
  if (stageEligible && !starterReady) return ["materialize_missing_starter_artifact_corpus", "rerun_factory_starter_artifacts"];
  return row.next_operator_actions;
}

function buildStarterCorpusStatus({ plannedArtifactRefs, starterReady }) {
  if (plannedArtifactRefs.length === 0) return "missing_required_ref_mapping";
  return starterReady ? "materialized_read_only" : "missing_required_artifacts";
}

function buildPlannedArtifactRefs(row, starterArtifactByPath) {
  return buildFactoryStarterArtifactRefs(row.domain_pack_ids ?? [], row.product_id).map((ref) => {
    const starterArtifact = starterArtifactByPath.get(ref.artifact_path);
    return {
      ...ref,
      starter_artifact_corpus_status: starterArtifact?.materialized_status ?? "missing_required_artifacts",
      starter_artifact_id: starterArtifact?.starter_artifact_id ?? null,
      materialized_status: starterArtifact?.materialized_status ?? "missing",
      exists_now: starterArtifact?.exists_now === true,
      content_sha256: starterArtifact?.content_sha256 ?? null,
      byte_count: starterArtifact?.byte_count ?? 0,
      content_type: starterArtifact?.content_type ?? null,
      source_file_write_allowed_now: false,
    };
  });
}

function isMaterializedStarterArtifactRef(ref) {
  return ref.materialized_status === "materialized_read_only"
    && ref.exists_now === true
    && HASH_RE.test(ref.content_sha256 ?? "");
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-candidate-manifest-validation-item.v1",
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

function countBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(groups);
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_FACTORY_CANDIDATE_MANIFEST_RESOLVER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--factory-ledger-dir" || arg === "--ledger-dir") args.factoryLedgerDir = argv[++index];
    else if (arg === "--factory-seed-dir" || arg === "--seed-dir") args.factorySeedDir = argv[++index];
    else if (arg === "--stage-out-dir") args.stageOutDir = argv[++index];
    else if (arg === "--starter-artifact-out-dir") args.starterArtifactOutDir = argv[++index];
    else if (arg === "--template-root") args.templateRoot = argv[++index];
    else if (arg === "--pack-root") args.packRoot = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-candidate-manifest-resolver.mjs [options]

Options:
  --check                 Fail when the resolver is not ready.
  --require-pass          Require ready_factory_candidate_manifest_resolver.
  --out-dir <path>        Output artifact directory.
  --factory-ledger-dir    Factory operational ledger directory.
  --factory-seed-dir      Factory tracked seed directory.
  --stage-out-dir <path>  Optional stage read-model artifact directory.
  --starter-artifact-out-dir <path>
                          Optional starter artifact corpus artifact directory.
  --template-root <path>  Starter template root. Default: templates.
  --pack-root <path>      Domain pack manifest root. Default: packs.
  --run-at <iso>          Deterministic timestamp.
  -h, --help              Show this help.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runFactoryCandidateManifestResolverCli();
}
