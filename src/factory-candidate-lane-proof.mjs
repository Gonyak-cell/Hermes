import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFactoryCandidateLane, writeFactoryCandidateLane } from "./factory-candidate-lane.mjs";
import {
  appendFactoryLedgerEntry,
  DEFAULT_FACTORY_LEDGER_DIR,
  DEFAULT_FACTORY_SEED_DIR,
} from "./factory-product-registry-store.mjs";

export const DEFAULT_FACTORY_CANDIDATE_LANE_PROOF_OUT_DIR = "artifacts/factory-candidate-lane-proof/latest";

const COMMAND_NAME = "factory:candidate-lane-proof";
const SCHEMA_VERSION = "factory-candidate-lane-proof.v1";
const CAPABILITY_ID = "factory.candidate_lane_proof";
const PROGRAM_RANGE = "FCORE-FC.2";
const READY_STATUS = "ready_factory_candidate_lane_proof";
const BLOCKED_STATUS = "blocked_factory_candidate_lane_proof";
const SCENARIO_ID = "fc2.three_ps2_candidate_packets";
const EXPECTED_CANDIDATE_COUNT = 3;
const HASH_RE = /^[a-f0-9]{64}$/;
const FIXTURE_PRODUCT_SPECS = [
  ["product.fc2_candidate_alpha", "FC2 Candidate Alpha"],
  ["product.fc2_candidate_beta", "FC2 Candidate Beta"],
  ["product.fc2_candidate_gamma", "FC2 Candidate Gamma"],
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

export async function runFactoryCandidateLaneProof(options = {}) {
  const result = await buildFactoryCandidateLaneProof(options);
  if (options.write !== false) await writeFactoryCandidateLaneProof(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Candidate Lane Proof failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_candidate_lane_proof_status !== READY_STATUS) {
    const error = new Error("Factory Candidate Lane Proof is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryCandidateLaneProof(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CANDIDATE_LANE_PROOF_OUT_DIR);
  const repoRoot = path.resolve(options.repoPath ?? process.cwd());
  const worktreeRoot = path.resolve(options.worktreeRoot ?? path.join(outputDir, "planned-worktrees"));
  const defaultLedgerDir = path.resolve(DEFAULT_FACTORY_LEDGER_DIR);
  const defaultSeedDir = path.resolve(options.factorySeedDir ?? options.seedDir ?? DEFAULT_FACTORY_SEED_DIR);
  const keepTempLedger = options.keepTempLedger === true;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-proof-"));
  const tempLedgerDir = path.join(tempRoot, "ledger");
  let cleanupPerformed = false;
  let cleanupError = null;
  let fixtureRows = [];
  let candidateLane = null;

  try {
    fixtureRows = await appendFixtureProducts(tempLedgerDir, generatedAt);
    candidateLane = await buildFactoryCandidateLane({
      ...options,
      outDir: path.join(outputDir, "candidate-lane"),
      repoPath: repoRoot,
      worktreeRoot,
      factoryLedgerDir: tempLedgerDir,
      ledgerDir: tempLedgerDir,
      factorySeedDir: defaultSeedDir,
      seedDir: defaultSeedDir,
      runAt: generatedAt,
      write: false,
    });
  } finally {
    if (!keepTempLedger) {
      try {
        await rm(tempRoot, { recursive: true, force: true });
        cleanupPerformed = true;
      } catch (error) {
        cleanupError = error.message;
      }
    }
  }

  const tempWorkspace = {
    schema_version: "factory-candidate-lane-proof-temp-workspace.v1",
    temp_root: tempRoot,
    temp_ledger_dir: tempLedgerDir,
    temp_root_in_os_tmp: isInsideOrEqual(tempRoot, os.tmpdir()),
    temp_ledger_dir_in_os_tmp: isInsideOrEqual(tempLedgerDir, os.tmpdir()),
    keep_temp_ledger: keepTempLedger,
    cleanup_performed_now: cleanupPerformed,
    cleanup_error: cleanupError,
  };
  const proofRows = buildCandidatePacketProofRows(candidateLane);
  const boundary = buildBoundary({
    candidateLane,
    defaultLedgerDir,
    defaultSeedDir,
    tempLedgerDir,
    tempWorkspace,
    worktreeRoot,
    repoRoot,
  });
  const validationItems = buildValidationItems({
    fixtureRows,
    proofRows,
    candidateLane,
    boundary,
    tempWorkspace,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    scenario: {
      schema_version: "factory-candidate-lane-proof-scenario.v1",
      scenario_id: SCENARIO_ID,
      expected_candidate_packet_count: EXPECTED_CANDIDATE_COUNT,
      fixture_product_count: FIXTURE_PRODUCT_SPECS.length,
      target_product_state: "PS2_receipt_bound",
      fixture_ledger_policy: "temporary_os_tmp_ledger_deleted_after_build",
    },
    inputs: {
      repo_root: repoRoot,
      worktree_root: worktreeRoot,
      default_ledger_dir: defaultLedgerDir,
      default_seed_dir: defaultSeedDir,
      temp_ledger_dir: tempLedgerDir,
    },
    temp_workspace: tempWorkspace,
    proof_product_rows: fixtureRows,
    source_candidate_lane: {
      schema_version: "factory-candidate-lane-proof-source.v1",
      command_name: candidateLane.command_name,
      program_range: candidateLane.program_range,
      output_dir: candidateLane.output_dir,
      validation_valid: candidateLane.validation.valid,
      validation_error_count: candidateLane.validation.errors.length,
      source_workbench_status: candidateLane.summary.source_workbench_status,
      candidate_packet_count: candidateLane.summary.candidate_packet_count,
      diff_packet_count: candidateLane.summary.diff_packet_count,
      rollback_plan_count: candidateLane.summary.rollback_plan_count,
      preflight_count: candidateLane.summary.preflight_count,
      hash_ledger_row_count: candidateLane.summary.hash_ledger_row_count,
      negative_fixture_count: candidateLane.summary.negative_fixture_count,
      patch_apply_enabled: candidateLane.summary.patch_apply_enabled,
      apply_allowed_now: candidateLane.summary.apply_allowed_now,
    },
    factory_candidate_packet_proof_rows: proofRows,
    factory_candidate_lane_proof_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: buildSummary({ candidateLane, fixtureRows, proofRows, boundary, validation }),
  };
  return { ...result, _candidate_lane_result: candidateLane, markdown: renderMarkdown(result) };
}

export async function writeFactoryCandidateLaneProof(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-candidate-lane-proof.json"), serializableResult(result));
  await writeJson(path.join(outDir, "proof-product-rows.json"), collectionEnvelope("factory-candidate-lane-proof-products.v1", "proof_product_rows", result.proof_product_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-packet-proof-rows.json"), collectionEnvelope("factory-candidate-packet-proof-rows.v1", "factory_candidate_packet_proof_rows", result.factory_candidate_packet_proof_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_candidate_lane_proof_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-candidate-lane-proof-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  if (result._candidate_lane_result) {
    await writeFactoryCandidateLane(result._candidate_lane_result, path.join(outDir, "candidate-lane"));
  }
}

export async function runFactoryCandidateLaneProofCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryCandidateLaneProof(args);
    console.log(`Factory Candidate Lane Proof validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_candidate_lane_proof_status}`);
    console.log(`Proof products: ${result.summary.proof_product_count}`);
    console.log(`Candidate packets: ${result.summary.candidate_packet_count}`);
    console.log(`Temp ledger cleaned: ${result.summary.temp_ledger_cleaned_up}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

async function appendFixtureProducts(ledgerDir, generatedAt) {
  const rows = [];
  for (const [productId, displayName] of FIXTURE_PRODUCT_SPECS) {
    const product = await appendFactoryLedgerEntry("products", productDraft(productId, displayName, generatedAt), ledgerOptions(ledgerDir));
    const ps1 = await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS0_seed", "PS1_schema_valid", generatedAt, "ps0_ps1"), ledgerOptions(ledgerDir));
    const ps2 = await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS1_schema_valid", "PS2_receipt_bound", generatedAt, "ps1_ps2"), ledgerOptions(ledgerDir));
    rows.push({
      schema_version: "factory-candidate-lane-proof-product-row.v1",
      scenario_id: SCENARIO_ID,
      product_id: productId,
      display_name: displayName,
      domain_pack_ids: product.domain_pack_ids,
      appended_product_entry_hash: product.entry_hash,
      appended_ps1_transition_entry_hash: ps1.entry_hash,
      appended_ps2_transition_entry_hash: ps2.entry_hash,
      current_product_state: "PS2_receipt_bound",
      ledger_write_scope: "temporary_os_tmp_fixture_ledger",
      default_ledger_written_now: false,
      seed_ledger_written_now: false,
      generated_at: generatedAt,
    });
  }
  return rows;
}

function ledgerOptions(ledgerDir) {
  return {
    ledgerDir,
    allowTestLedgerRoot: true,
  };
}

function productDraft(productId, displayName, generatedAt) {
  return {
    schema_version: "product-record.v1",
    product_id: productId,
    tenant_id: "tenant.local",
    workspace_id: "workspace.factory",
    display_name: displayName,
    domain_pack_ids: ["pack.personal_dev"],
    product_state: "PS0_seed",
    receipt_id: `rcpt-${normalizeKey(productId)}-seed`,
    created_at: generatedAt,
    updated_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  };
}

function transitionDraft(productId, fromState, toState, generatedAt, suffix) {
  return {
    schema_version: "product-state-transition.v1",
    transition_id: `transition.${normalizeKey(productId)}.${suffix}`,
    product_id: productId,
    from_state: fromState,
    to_state: toState,
    receipt_id: `rcpt-${normalizeKey(productId)}-${suffix}`,
    created_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  };
}

function buildCandidatePacketProofRows(candidateLane) {
  return candidateLane.factory_candidate_packet_rows.map((packet, index) => {
    const diff = candidateLane.factory_candidate_diff_packet_rows[index];
    const rollback = candidateLane.factory_candidate_rollback_plan_rows[index];
    const preflight = candidateLane.factory_candidate_preflight_rows[index];
    const ledgerRow = candidateLane.factory_candidate_hash_ledger_rows[index];
    const draft = {
      schema_version: "factory-candidate-packet-proof-row.v1",
      scenario_id: SCENARIO_ID,
      proof_row_id: `factory-candidate-packet-proof.${String(index + 1).padStart(4, "0")}`,
      product_id: packet.product_id,
      candidate_packet_id: packet.candidate_packet_id,
      candidate_packet_status: packet.candidate_packet_status,
      candidate_packet_sha256: packet.candidate_packet_sha256,
      candidate_manifest_id: packet.candidate_manifest_id,
      candidate_manifest_sha256: packet.candidate_manifest_sha256,
      candidate_manifest_sha256_recomputed: packet.candidate_manifest_sha256_recomputed,
      candidate_hash_bound_to_manifest: packet.candidate_hash_bound_to_manifest,
      isolated_workspace_actual_isolation: packet.isolated_workspace_plan.actual_isolation,
      worktree_created_now: packet.isolated_workspace_plan.worktree_created_now,
      diff_packet_id: diff?.diff_packet_id ?? null,
      diff_sha256: diff?.diff_sha256 ?? null,
      diff_kind: diff?.diff_kind ?? null,
      diff_applied_now: diff?.diff_applied_now ?? null,
      rollback_plan_id: rollback?.rollback_plan_id ?? null,
      rollback_plan_sha256: rollback?.rollback_plan_sha256 ?? null,
      rollback_executed_now: rollback?.rollback_executed_now ?? null,
      preflight_id: preflight?.preflight_id ?? null,
      preflight_sha256: preflight?.preflight_sha256 ?? null,
      preflight_status: preflight?.preflight_status ?? null,
      preflight_executed_now: preflight?.preflight_executed_now ?? null,
      hash_ledger_row_id: ledgerRow?.ledger_row_id ?? null,
      hash_ledger_entry_hash: ledgerRow?.entry_hash ?? null,
      hash_ledger_prev_entry_hash: ledgerRow?.prev_entry_hash ?? null,
      source_file_write_allowed_now: packet.source_file_write_allowed_now,
      ledger_append_allowed_now: packet.ledger_append_allowed_now,
      patch_apply_enabled: packet.patch_apply_enabled,
      apply_allowed_now: packet.apply_allowed_now,
      generated_at: packet.generated_at,
    };
    return { ...draft, proof_row_sha256: sha256(canonicalize(draft)) };
  });
}

function buildBoundary({ candidateLane, defaultLedgerDir, defaultSeedDir, tempLedgerDir, tempWorkspace, worktreeRoot, repoRoot }) {
  return {
    schema_version: "factory-candidate-lane-proof-boundary.v1",
    read_only_factory_boundary: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    scenario_id: SCENARIO_ID,
    repo_root: repoRoot,
    worktree_root: worktreeRoot,
    temp_ledger_dir: tempLedgerDir,
    temp_ledger_dir_in_os_tmp: tempWorkspace.temp_ledger_dir_in_os_tmp,
    temp_fixture_ledger_append_performed_now: true,
    temp_fixture_ledger_cleanup_performed_now: tempWorkspace.cleanup_performed_now,
    default_ledger_dir: defaultLedgerDir,
    default_seed_dir: defaultSeedDir,
    default_ledger_written_now: false,
    seed_ledger_written_now: false,
    default_or_seed_ledger_written_now: false,
    temp_ledger_is_default_ledger: pathsEqual(tempLedgerDir, defaultLedgerDir),
    temp_ledger_is_seed_ledger: pathsEqual(tempLedgerDir, defaultSeedDir),
    source_candidate_lane_valid: candidateLane.validation.valid,
    candidate_packet_count: candidateLane.summary.candidate_packet_count,
    actual_git_worktree_created_now: false,
    source_file_write_allowed_now: false,
    persistent_ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    project_creation_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems({ fixtureRows, proofRows, candidateLane, boundary, tempWorkspace }) {
  const diffRows = candidateLane.factory_candidate_diff_packet_rows;
  const rollbackRows = candidateLane.factory_candidate_rollback_plan_rows;
  const preflightRows = candidateLane.factory_candidate_preflight_rows;
  const hashLedgerRows = candidateLane.factory_candidate_hash_ledger_rows;
  const negativeRows = candidateLane.factory_candidate_negative_fixture_rows;
  return [
    validationItem("scenario.products", "scenario", fixtureRows.length === EXPECTED_CANDIDATE_COUNT, "Proof scenario must append exactly three fixture products"),
    validationItem("scenario.ps2_products", "scenario", fixtureRows.every((row) => row.current_product_state === "PS2_receipt_bound"), "Every proof product must advance to PS2 in the temporary ledger"),
    validationItem("source.candidate_lane_valid", "source", candidateLane.validation.valid, candidateLane.validation.valid ? "Source candidate lane is valid" : `Source candidate lane has ${candidateLane.validation.errors.length} error(s)`),
    validationItem("packets.three_ready", "candidate", proofRows.length === EXPECTED_CANDIDATE_COUNT && proofRows.every((row) => row.candidate_packet_status === "candidate_packet_ready"), "Proof must produce three ready candidate packets"),
    validationItem("packets.hash_bound", "candidate", proofRows.every((row) => HASH_RE.test(row.candidate_packet_sha256 ?? "") && HASH_RE.test(row.proof_row_sha256 ?? "")), "Every candidate proof row must be hash-bound"),
    validationItem("packets.manifest_hash_bound", "candidate", proofRows.every((row) => row.candidate_hash_bound_to_manifest === true && row.candidate_manifest_sha256_recomputed === row.candidate_manifest_sha256), "Every proof row must bind a recomputed manifest hash"),
    validationItem("diffs.unified_unapplied", "diff", diffRows.length === EXPECTED_CANDIDATE_COUNT && diffRows.every((row) => row.diff_kind === "unified_diff" && row.diff_content.startsWith("diff --git ") && row.diff_applied_now === false && HASH_RE.test(row.diff_sha256)), "Every proof diff must be an unapplied unified diff"),
    validationItem("rollback.draft_unexecuted", "rollback", rollbackRows.length === EXPECTED_CANDIDATE_COUNT && rollbackRows.every((row) => row.rollback_plan_status === "draft_not_executable" && row.rollback_executed_now === false && HASH_RE.test(row.rollback_plan_sha256)), "Every rollback plan must remain draft-only and unexecuted"),
    validationItem("preflight.executed_passed", "preflight", preflightRows.length === EXPECTED_CANDIDATE_COUNT && preflightRows.every((row) => row.preflight_executed_now === true && row.preflight_status === "passed" && HASH_RE.test(row.preflight_sha256)), "Every candidate packet must have an executed passing preflight"),
    validationItem("hash_ledger.three_row_chain", "ledger", hashLedgerRows.length === EXPECTED_CANDIDATE_COUNT && hashLedgerRows.every((row, index) => HASH_RE.test(row.entry_hash) && (index === 0 ? row.prev_entry_hash === null : row.prev_entry_hash === hashLedgerRows[index - 1].entry_hash)), "Candidate hash ledger must contain three chained rows"),
    validationItem("negative.fixtures", "negative", negativeRows.length >= 3 && negativeRows.every((row) => row.fixture_status === "passed") && negativeRows.filter((row) => row.path_guard_executed_now === true).length >= 2, "Negative fixtures must pass and path guards must execute"),
    validationItem("boundary.temp_ledger_only", "authority", boundary.temp_ledger_dir_in_os_tmp === true && boundary.temp_ledger_is_default_ledger === false && boundary.temp_ledger_is_seed_ledger === false && boundary.default_or_seed_ledger_written_now === false, "Proof must use only an OS temp ledger, never default or seed ledgers"),
    validationItem("boundary.cleanup", "authority", tempWorkspace.keep_temp_ledger === true || (tempWorkspace.cleanup_performed_now === true && tempWorkspace.cleanup_error === null), "Temporary ledger must be cleaned up unless explicitly retained"),
    validationItem("boundary.no_worktree_or_repo_write", "authority", boundary.actual_git_worktree_created_now === false && boundary.source_file_write_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.persistent_ledger_append_allowed_now === false, "Proof must not create worktrees, write source files, write repo files, or append persistent ledgers"),
    validationItem("boundary.no_apply_deploy_trust", "authority", boundary.patch_apply_enabled === false && boundary.apply_allowed_now === false && boundary.connector_write_allowed_now === false && boundary.deployment_allowed_now === false && boundary.protected_action_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "Proof must keep apply, connector, deploy, protected action, production, and enterprise trust closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All authority flags must remain closed"),
  ];
}

function buildSummary({ candidateLane, fixtureRows, proofRows, boundary, validation }) {
  const ready = validation.valid && candidateLane.validation.valid && allAuthorityClosed(boundary);
  return {
    factory_candidate_lane_proof_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    scenario_id: SCENARIO_ID,
    proof_product_count: fixtureRows.length,
    candidate_packet_count: proofRows.length,
    diff_packet_count: candidateLane.summary.diff_packet_count,
    rollback_plan_count: candidateLane.summary.rollback_plan_count,
    preflight_count: candidateLane.summary.preflight_count,
    hash_ledger_row_count: candidateLane.summary.hash_ledger_row_count,
    negative_fixture_count: candidateLane.summary.negative_fixture_count,
    temp_ledger_cleaned_up: boundary.temp_fixture_ledger_cleanup_performed_now,
    default_or_seed_ledger_written_now: boundary.default_or_seed_ledger_written_now,
    actual_git_worktree_created_now: boundary.actual_git_worktree_created_now,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Candidate Lane Proof",
    "",
    `Status: ${result.summary.factory_candidate_lane_proof_status}`,
    `Program: ${result.summary.program_range}`,
    `Scenario: ${result.summary.scenario_id}`,
    `Proof products: ${result.summary.proof_product_count}`,
    `Candidate packets: ${result.summary.candidate_packet_count}`,
    `Diff packets: ${result.summary.diff_packet_count}`,
    `Rollback plans: ${result.summary.rollback_plan_count}`,
    `Preflights: ${result.summary.preflight_count}`,
    `Hash ledger rows: ${result.summary.hash_ledger_row_count}`,
    `Temp ledger cleaned: ${result.summary.temp_ledger_cleaned_up}`,
    `Patch apply enabled: ${result.summary.patch_apply_enabled}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-candidate-lane-proof-validation-item.v1",
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

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, _candidate_lane_result: _candidateLaneResult, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObject(item)]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pathsEqual(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function isInsideOrEqual(child, parent) {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  return resolvedChild === resolvedParent || resolvedChild.startsWith(`${resolvedParent}${path.sep}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--keep-temp-ledger") parsed.keepTempLedger = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-path") parsed.repoPath = argv[++index];
    else if (arg === "--worktree-root") parsed.worktreeRoot = argv[++index];
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
  console.log(`Usage: npm run factory:candidate-lane-proof -- [--check] [--require-pass] [--out-dir DIR]

Builds the FC.2 proof harness: a temporary OS-ledger scenario with three PS2
products, three ready candidate packets, unapplied diffs, draft rollback plans,
passing preflights, and chained hash ledger rows. Persistent writes stay closed.

Options:
  --check             Fail when validation has errors.
  --require-pass      Require ready_factory_candidate_lane_proof status.
  --no-write          Build in memory only; still uses a temporary OS ledger.
  --keep-temp-ledger  Retain the temporary fixture ledger for debugging.
  --out-dir DIR       Output directory.
  --repo-path DIR     Repository root used for candidate metadata.
  --worktree-root DIR Isolated worktree root used for path-boundary checks.
  --factory-seed-dir DIR
  --template-root DIR
  --pack-root DIR
  --run-at ISO_DATE   Deterministic timestamp for tests.
`);
}
