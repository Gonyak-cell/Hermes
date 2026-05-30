import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXPANSION_DEDUP_LEDGER_OUT_DIR = "artifacts/expansion-dedup-ledger/latest";
export const DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  expansionCursorLedgerPath: "artifacts/expansion-cursor-ledger/latest/expansion-cursor-ledger.json",
  backfillJobContractPath: "artifacts/backfill-job-contract/latest/backfill-job-contract.json",
};

const LEDGER_SCHEMA_VERSION = "expansion-dedup-ledger.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.expansion_dedup_ledger";
const PHASE_SLOT = "P279";
const PREVIOUS_PHASE_SLOT = "P278";
const NEXT_PHASE_SLOT = "P280";
const HUMAN_REVIEW_NOTE = "Expansion Dedup Ledger is a read-only idempotency and duplicate-decision report. It does not execute backfill, read source file contents, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";
const TERMINAL_STATUSES = new Set(["extracted", "quarantined", "failed", "skipped_duplicate"]);

export async function runExpansionDedupLedger(options = {}) {
  const result = await buildExpansionDedupLedger(options);
  if (options.write !== false) await writeExpansionDedupLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Expansion dedup ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExpansionDedupLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXPANSION_DEDUP_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const expansionCursorLedgerRead = await readJsonOrError(inputs.expansion_cursor_ledger_path);
  const backfillJobContractRead = await readJsonOrError(inputs.backfill_job_contract_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const expansionCursorLedger = expansionCursorLedgerRead.value ?? {};
  const backfillJobContract = backfillJobContractRead.value ?? {};
  const idempotencyRows = buildIdempotencyKeyRows(resourceExpansion, expansionCursorLedger, generatedAt);
  const contentHashGroups = buildContentHashGroups(resourceExpansion, generatedAt);
  const duplicateRows = buildDuplicateDecisionRows(resourceExpansion, idempotencyRows, contentHashGroups, generatedAt);
  const skippedRows = duplicateRows.filter((row) => row.dedup_decision === "skipped_duplicate");
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    backfillJobContract,
    idempotencyRows,
    contentHashGroups,
    duplicateRows,
    skippedRows,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeDedupLedger({
    resourceExpansion,
    expansionCursorLedger,
    backfillJobContract,
    idempotencyRows,
    contentHashGroups,
    duplicateRows,
    skippedRows,
    boundary,
    validation,
  });

  const result = {
    schema_version: LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    expansion_dedup_ledger_id: `expansion-dedup-ledger.${dateStamp(generatedAt)}`,
    expansion_dedup_ledger_status: summary.expansion_dedup_ledger_status,
    output_dir: outputDir,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      expansionCursorLedgerRead,
      backfillJobContractRead,
    }),
    expansion_dedup_contract: buildDedupContract({ generatedAt, idempotencyRows, duplicateRows, skippedRows }),
    idempotency_key_rows: idempotencyRows,
    content_hash_groups: contentHashGroups,
    duplicate_decision_rows: duplicateRows,
    skipped_duplicate_rows: skippedRows,
    dedup_resume_checks: validationItems,
    expansion_dedup_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummary(result),
  };
}

export async function writeExpansionDedupLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableExpansionDedupLedger(result);
  await writeJson(path.join(outDir, "expansion-dedup-ledger.json"), serializable);
  await writeJson(path.join(outDir, "idempotency-key-rows.json"), {
    schema_version: "expansion-dedup-idempotency-key-rows.v1",
    generated_at: result.generated_at,
    row_count: result.idempotency_key_rows.length,
    idempotency_key_rows: result.idempotency_key_rows,
  });
  await writeJson(path.join(outDir, "content-hash-groups.json"), {
    schema_version: "expansion-dedup-content-hash-groups.v1",
    generated_at: result.generated_at,
    content_hash_group_count: result.content_hash_groups.length,
    content_hash_groups: result.content_hash_groups,
  });
  await writeJson(path.join(outDir, "duplicate-decision-rows.json"), {
    schema_version: "expansion-dedup-duplicate-decision-rows.v1",
    generated_at: result.generated_at,
    duplicate_decision_count: result.duplicate_decision_rows.length,
    duplicate_decision_rows: result.duplicate_decision_rows,
  });
  await writeJson(path.join(outDir, "skipped-duplicate-rows.json"), {
    schema_version: "expansion-dedup-skipped-duplicate-rows.v1",
    generated_at: result.generated_at,
    skipped_duplicate_count: result.skipped_duplicate_rows.length,
    skipped_duplicate_rows: result.skipped_duplicate_rows,
  });
  await writeJson(path.join(outDir, "dedup-resume-checks.json"), {
    schema_version: "expansion-dedup-resume-checks.v1",
    generated_at: result.generated_at,
    check_count: result.dedup_resume_checks.length,
    dedup_resume_checks: result.dedup_resume_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "expansion-dedup-ledger-validation-report.v1",
    generated_at: result.generated_at,
    expansion_dedup_ledger_id: result.expansion_dedup_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runExpansionDedupLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExpansionDedupLedger(args);
    console.log(`Expansion dedup ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.expansion_dedup_ledger_status}`);
    console.log(`Idempotency keys: ${result.summary.unique_idempotency_key_count}/${result.summary.idempotency_key_count}`);
    console.log(`Dedup decisions: ${result.summary.passed_duplicate_decision_count}/${result.summary.duplicate_decision_count}`);
    console.log(`Skipped duplicates: ${result.summary.validated_skipped_duplicate_count}/${result.summary.skipped_duplicate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const validationError of error.validation.errors) console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildIdempotencyKeyRows(resourceExpansion, expansionCursorLedger, generatedAt) {
  const positionsByItemId = new Map((expansionCursorLedger.batch_item_positions ?? []).map((row) => [row.item_id, row]));
  return (resourceExpansion.items ?? []).map((item, index) => {
    const cursorPosition = positionsByItemId.get(item.item_id);
    const idempotencyKeyPresent = typeof item.idempotency_key === "string" && item.idempotency_key.length > 0;
    const portableResumeKey = cursorPosition?.portable_resume_key ?? buildPortableResumeKey(resourceExpansion, item);
    return {
      idempotency_key_row_id: `expansion-dedup-key.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      job_id: resourceExpansion.job_id ?? null,
      source_id: resourceExpansion.source_id ?? null,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      item_status: item.status ?? "unknown",
      key_status: idempotencyKeyPresent ? "registered" : "missing",
      idempotency_key_hash: idempotencyKeyPresent ? sha256(item.idempotency_key) : null,
      idempotency_strategy: resourceExpansion.resumability?.idempotency_strategy ?? null,
      portable_resume_key: portableResumeKey,
      portable_resume_key_present: typeof portableResumeKey === "string" && portableResumeKey.length > 0,
      duplicate_candidate: item.status === "skipped_duplicate",
      duplicate_of: item.duplicate_of ?? null,
      raw_hash_sha256_present: typeof item.raw_hash_sha256 === "string" && item.raw_hash_sha256.length > 0,
      raw_hash_reference_hash: item.raw_hash_sha256 ? sha256(item.raw_hash_sha256) : null,
      relative_path: item.relative_path ?? null,
      source_path_reference_hash: item.source_path ? sha256(item.source_path) : null,
      source_path_used_for_dedup_identity: false,
      absolute_path_identity_allowed: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function buildContentHashGroups(resourceExpansion, generatedAt) {
  const hashGroups = new Map();
  for (const item of resourceExpansion.items ?? []) {
    if (!item.raw_hash_sha256) continue;
    const rows = hashGroups.get(item.raw_hash_sha256) ?? [];
    rows.push(item);
    hashGroups.set(item.raw_hash_sha256, rows);
  }
  return [...hashGroups.entries()]
    .map(([rawHashSha256, items], index) => {
      const canonical = items.find((item) => item.status === "extracted") ?? items[0];
      const skipped = items.filter((item) => item.status === "skipped_duplicate");
      const duplicateStable = skipped.every((item) => item.duplicate_of === canonical.resource_id);
      return {
        content_hash_group_id: `expansion-content-hash-group.${String(index + 1).padStart(4, "0")}`,
        generated_at: generatedAt,
        raw_hash_reference_hash: sha256(rawHashSha256),
        hash_algorithm: "sha256",
        group_status: items.length > 1 ? "duplicate_content_hash" : "unique_content_hash",
        canonical_resource_id: canonical?.resource_id ?? null,
        canonical_item_id: canonical?.item_id ?? null,
        item_ids: items.map((item) => item.item_id).filter(Boolean),
        resource_ids: unique(items.map((item) => item.resource_id).filter(Boolean)),
        skipped_duplicate_item_ids: skipped.map((item) => item.item_id).filter(Boolean),
        item_count: items.length,
        skipped_duplicate_count: skipped.length,
        duplicate_link_complete: duplicateStable,
        extracted_owner_present: Boolean(canonical?.resource_id),
        source_path_used_for_dedup_identity: false,
        human_review_required: true,
        client_facing_ready: false,
      };
    })
    .sort(by("content_hash_group_id"));
}

function buildDuplicateDecisionRows(resourceExpansion, idempotencyRows, contentHashGroups, generatedAt) {
  const keyByItemId = new Map(idempotencyRows.map((row) => [row.item_id, row]));
  const groupByItemId = new Map();
  for (const group of contentHashGroups) {
    for (const itemId of group.item_ids) groupByItemId.set(itemId, group);
  }
  const extractedResourceIds = new Set((resourceExpansion.items ?? [])
    .filter((item) => item.status === "extracted")
    .map((item) => item.resource_id));
  return (resourceExpansion.items ?? []).map((item, index) => {
    const keyRow = keyByItemId.get(item.item_id);
    const group = groupByItemId.get(item.item_id);
    const skippedDuplicate = item.status === "skipped_duplicate";
    const duplicateOfResolved = !skippedDuplicate || (Boolean(item.duplicate_of) && extractedResourceIds.has(item.duplicate_of));
    const statusHistory = Array.isArray(item.status_history) ? item.status_history : [];
    const hasStatusEvent = !skippedDuplicate || statusHistory.some((event) => event.status === "skipped_duplicate");
    const passed = keyRow?.key_status === "registered"
      && keyRow?.portable_resume_key_present === true
      && (item.status !== "extracted" || Boolean(item.raw_hash_sha256))
      && duplicateOfResolved
      && hasStatusEvent
      && keyRow?.source_path_used_for_dedup_identity === false;
    return {
      duplicate_decision_row_id: `expansion-dedup-decision.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      relative_path: item.relative_path ?? null,
      item_status: item.status ?? "unknown",
      dedup_decision: decisionForItem(item),
      decision_status: passed ? "passed" : "attention",
      duplicate_detected: skippedDuplicate,
      skipped_duplicate: skippedDuplicate,
      duplicate_of: item.duplicate_of ?? null,
      duplicate_of_resolved: duplicateOfResolved,
      content_hash_group_id: group?.content_hash_group_id ?? null,
      content_hash_group_status: group?.group_status ?? null,
      canonical_resource_id: skippedDuplicate ? item.duplicate_of ?? null : item.resource_id ?? null,
      idempotency_key_hash: keyRow?.idempotency_key_hash ?? null,
      portable_resume_key: keyRow?.portable_resume_key ?? null,
      status_history_contains_decision: hasStatusEvent,
      new_resource_promoted_for_duplicate: false,
      source_path_used_for_dedup_identity: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function decisionForItem(item) {
  if (item.status === "skipped_duplicate") return "skipped_duplicate";
  if (item.status === "extracted") return "primary_resource";
  if (item.status === "queued") return "pending_backfill";
  if (item.status === "quarantined") return "quarantine_hold";
  if (item.status === "failed") return "failure_hold";
  return "unknown";
}

function buildDedupContract({ generatedAt, idempotencyRows, duplicateRows, skippedRows }) {
  return {
    schema_version: "expansion-dedup-contract.v1",
    generated_at: generatedAt,
    contract_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    idempotency_key_fields: ["source_id", "relative_path", "size_bytes", "modified_at"],
    duplicate_identity_fields: ["raw_hash_sha256", "canonical_resource_id", "duplicate_of"],
    idempotency_key_row_count: idempotencyRows.length,
    duplicate_decision_count: duplicateRows.length,
    skipped_duplicate_count: skippedRows.length,
    duplicate_status_rule: "Every skipped_duplicate item must keep duplicate_of lineage to an extracted canonical resource and must not promote a new resource.",
    absolute_path_identity_allowed: false,
    raw_cursor_material_allowed: false,
    source_file_content_read_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "expansion-dedup-ledger.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    dedup_ledger_report_only: true,
    source_artifact_read_performed: true,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    dedup_state_mutation_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready_count: 0,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildCheckpoints(context) {
  const {
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    backfillJobContract,
    idempotencyRows,
    contentHashGroups,
    duplicateRows,
    skippedRows,
    boundary,
  } = context;
  const items = resourceExpansion.items ?? [];
  const summary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  const keyHashes = idempotencyRows.map((row) => row.idempotency_key_hash).filter(Boolean);
  const duplicatePromotions = duplicateRows.filter((row) => row.new_resource_promoted_for_duplicate);
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.expansion_cursor_ledger", expansionCursorLedgerRead.available && cursorSummary.expansion_cursor_ledger_status === "complete" && cursorSummary.phase_slot === "P278", "P278 Expansion Cursor Ledger is complete."),
    checkpoint("source.backfill_job_contract", backfillJobContractRead.available && backfillSummary.backfill_job_contract_status === "complete" && backfillSummary.phase_slot === "P277", "P277 Backfill Job Contract is complete."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:expansion-dedup-ledger"), "package.json exposes resource:expansion-dedup-ledger."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["expansion_dedup_ledger", "resource:expansion-dedup-ledger"]) && includesAll(reviewDashboardText.value, ["expansion_dedup_ledger", "buildExpansionDedupLedgerStage"]) && includesAll(reviewApiText.value, ["/api/expansion-dedup-ledgers", "/api/expansion-skipped-duplicates"]), "Control-plane loop, dashboard, and API expose Expansion Dedup Ledger."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P279", "expansion dedup ledger"]) && includesAll(implementationRoadmapText.value, ["Phase 279", "Expansion Dedup Ledger"]), "Ledger and implementation roadmap promote Phase 279."),
    checkpoint("idempotency.rows", idempotencyRows.length === items.length && idempotencyRows.length > 0 && idempotencyRows.every((row) => row.key_status === "registered"), "Every expansion item has an idempotency key row."),
    checkpoint("idempotency.unique", keyHashes.length === new Set(keyHashes).size && keyHashes.length === idempotencyRows.length, "Idempotency keys are unique for the resource expansion batch."),
    checkpoint("idempotency.portable_resume", idempotencyRows.every((row) => row.portable_resume_key_present && row.source_path_used_for_dedup_identity === false), "Every idempotency row is linked to a portable resume key without absolute path identity."),
    checkpoint("content_hash.groups", contentHashGroups.length > 0 && contentHashGroups.every((group) => group.extracted_owner_present), "Content hash groups have canonical owners."),
    checkpoint("duplicate.counts", integerOrZero(summary.skipped_duplicate_count) === skippedRows.length && skippedRows.length === duplicateRows.filter((row) => row.skipped_duplicate).length, "Skipped duplicate counts match Resource Expansion summary."),
    checkpoint("duplicate.lineage", skippedRows.every((row) => row.duplicate_of && row.duplicate_of_resolved && row.status_history_contains_decision), "Skipped duplicates retain duplicate_of lineage and status history."),
    checkpoint("duplicate.no_promotion", duplicatePromotions.length === 0 && skippedRows.every((row) => row.new_resource_promoted_for_duplicate === false), "Skipped duplicates do not promote replacement resources."),
    checkpoint("decision.rows", duplicateRows.length === items.length && duplicateRows.every((row) => row.decision_status === "passed"), "Dedup decision rows cover all items and pass."),
    checkpoint("terminal.statuses", items.every((item) => TERMINAL_STATUSES.has(item.status) || item.status === "queued"), "Expansion item statuses remain in the known backfill state set."),
    checkpoint("boundary.no_execution", boundary.backfill_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false, "No backfill execution, source ingest, or source file content read occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No legal advice or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && cursorSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeDedupLedger({ resourceExpansion, expansionCursorLedger, backfillJobContract, idempotencyRows, contentHashGroups, duplicateRows, skippedRows, boundary, validation }) {
  const summary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  const keyHashes = idempotencyRows.map((row) => row.idempotency_key_hash).filter(Boolean);
  const uniqueKeyCount = new Set(keyHashes).size;
  const duplicateContentHashGroups = contentHashGroups.filter((group) => group.group_status === "duplicate_content_hash");
  return {
    expansion_dedup_ledger_status: validation.valid ? "complete" : "attention",
    expansion_dedup_ledger_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_expansion_cursor_ledger_status: cursorSummary.expansion_cursor_ledger_status ?? "unknown",
    source_expansion_cursor_phase_slot: cursorSummary.phase_slot ?? null,
    source_backfill_job_contract_status: backfillSummary.backfill_job_contract_status ?? "unknown",
    source_backfill_job_contract_phase_slot: backfillSummary.phase_slot ?? null,
    discovered_count: integerOrZero(summary.discovered_count),
    terminal_count: integerOrZero(summary.terminal_count),
    extracted_count: integerOrZero(summary.extracted_count),
    skipped_duplicate_count: integerOrZero(summary.skipped_duplicate_count),
    idempotency_key_count: idempotencyRows.length,
    unique_idempotency_key_count: uniqueKeyCount,
    idempotency_key_collision_count: idempotencyRows.length - uniqueKeyCount,
    portable_resume_key_count: idempotencyRows.filter((row) => row.portable_resume_key_present).length,
    absolute_path_identity_allowed_count: idempotencyRows.filter((row) => row.absolute_path_identity_allowed).length,
    content_hash_group_count: contentHashGroups.length,
    duplicate_content_hash_group_count: duplicateContentHashGroups.length,
    duplicate_decision_count: duplicateRows.length,
    passed_duplicate_decision_count: duplicateRows.filter((row) => row.decision_status === "passed").length,
    skipped_duplicate_row_count: skippedRows.length,
    validated_skipped_duplicate_count: skippedRows.filter((row) => row.decision_status === "passed" && row.duplicate_of_resolved).length,
    skipped_duplicate_with_duplicate_of_count: skippedRows.filter((row) => row.duplicate_of).length,
    stable_skipped_duplicate_count: skippedRows.filter((row) => row.status_history_contains_decision && row.duplicate_of_resolved).length,
    new_resource_promoted_for_duplicate_count: duplicateRows.filter((row) => row.new_resource_promoted_for_duplicate).length,
    raw_cursor_material_allowed: false,
    source_absolute_path_identity_allowed: false,
    read_only: boundary.read_only,
    dedup_ledger_report_only: boundary.dedup_ledger_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    dedup_state_mutation_performed: boundary.dedup_state_mutation_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved && cursorSummary.windows_baseline_stability_preserved === true,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.items.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts(reads) {
  return [
    sourceContract("package.json", reads.packageJson),
    sourceContract("final-completion-phase-ledger", reads.roadmapText),
    sourceContract("implementation-roadmap", reads.implementationRoadmapText),
    sourceContract("control-plane-loop", reads.controlPlaneLoopText),
    sourceContract("review-dashboard", reads.reviewDashboardText),
    sourceContract("review-api", reads.reviewApiText),
    sourceContract("resource-expansion-job", reads.resourceExpansionRead),
    sourceContract("expansion-cursor-ledger", reads.expansionCursorLedgerRead),
    sourceContract("backfill-job-contract", reads.backfillJobContractRead),
  ];
}

function sourceContract(label, readResult) {
  return {
    label,
    available: readResult.available,
    schema_version: readResult.value?.schema_version ?? null,
    content_hash: readResult.content_hash ?? null,
    error: readResult.error ?? null,
  };
}

function renderSummary(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Expansion Dedup Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.expansion_dedup_ledger_status}`);
  lines.push(`Phase: ${summary.phase_slot}`);
  lines.push(`Source job: ${summary.source_resource_expansion_job_id}`);
  lines.push("");
  lines.push("## Dedup");
  lines.push("");
  lines.push(`- Idempotency keys: ${summary.unique_idempotency_key_count}/${summary.idempotency_key_count}`);
  lines.push(`- Content hash groups: ${summary.content_hash_group_count}`);
  lines.push(`- Duplicate content hash groups: ${summary.duplicate_content_hash_group_count}`);
  lines.push(`- Skipped duplicates: ${summary.validated_skipped_duplicate_count}/${summary.skipped_duplicate_count}`);
  lines.push(`- Dedup decisions: ${summary.passed_duplicate_decision_count}/${summary.duplicate_decision_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The ledger reads existing Resource Expansion artifacts only.");
  lines.push("- It performs no backfill execution, source ingest, source file content read, mutation, delivery, protected action, legal advice, or client-facing output.");
  lines.push("- Skipped duplicates remain human-review gated metadata with duplicate lineage.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function serializableExpansionDedupLedger(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
    items,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.resourceExpansionPath,
    expansion_cursor_ledger_path: options.expansionCursorLedgerPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.expansionCursorLedgerPath,
    backfill_job_contract_path: options.backfillJobContractPath ?? DEFAULT_EXPANSION_DEDUP_LEDGER_INPUTS.backfillJobContractPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--expansion-cursor-ledger") parsed.expansionCursorLedgerPath = argv[++index];
    else if (arg === "--backfill-job-contract") parsed.backfillJobContractPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/expansion-dedup-ledger.mjs [options]

Options:
  --resource-expansion <path>        resource-expansion-job.json path.
  --expansion-cursor-ledger <path>   expansion-cursor-ledger.json path.
  --backfill-job-contract <path>     backfill-job-contract.json path.
  --out-dir <folder>                 Output folder.
  --check                            Fail if validation does not pass.
  -h, --help                         Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: JSON.parse(text),
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: null,
      error: String(error?.message ?? error),
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: "",
      error: String(error?.message ?? error),
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EIO", "ENOENT", "EBUSY", "EPERM"].includes(error?.code) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildPortableResumeKey(resourceExpansion, item) {
  const sourceId = resourceExpansion.source_id ?? "unknown-source";
  if (!item?.relative_path || !item.modified_at) return null;
  const seed = [sourceId, normalizeRelativePath(item.relative_path), integerOrZero(item.size_bytes), item.modified_at].join("|");
  return `resume:${sha256(seed).slice("sha256:".length, "sha256:".length + 24)}`;
}

function normalizeRelativePath(relativePath) {
  return String(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function unique(values) {
  return [...new Set(values)];
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
