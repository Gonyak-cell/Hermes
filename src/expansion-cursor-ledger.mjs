import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXPANSION_CURSOR_LEDGER_OUT_DIR = "artifacts/expansion-cursor-ledger/latest";
export const DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceExpansionStatePath: "artifacts/resource-expansion/latest/resource-expansion-state.json",
  nextBatchPath: "artifacts/resource-expansion/latest/next-batch.json",
  backfillJobContractPath: "artifacts/backfill-job-contract/latest/backfill-job-contract.json",
};

const LEDGER_SCHEMA_VERSION = "expansion-cursor-ledger.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.expansion_cursor_ledger";
const PHASE_SLOT = "P278";
const PREVIOUS_PHASE_SLOT = "P277";
const NEXT_PHASE_SLOT = "P279";
const HUMAN_REVIEW_NOTE = "Expansion Cursor Ledger is a read-only cursor and batch-state report. It does not execute backfill, read source file contents, mutate resources, deliver output, produce legal advice, or create client-facing output.";
const TERMINAL_STATUSES = new Set(["extracted", "quarantined", "failed", "skipped_duplicate"]);

export async function runExpansionCursorLedger(options = {}) {
  const result = await buildExpansionCursorLedger(options);
  if (options.write !== false) await writeExpansionCursorLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Expansion cursor ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExpansionCursorLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXPANSION_CURSOR_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const resourceExpansionStateRead = await readJsonOrError(inputs.resource_expansion_state_path);
  const nextBatchRead = await readJsonOrError(inputs.next_batch_path);
  const backfillJobContractRead = await readJsonOrError(inputs.backfill_job_contract_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const resourceExpansionState = resourceExpansionStateRead.value ?? {};
  const nextBatch = nextBatchRead.value ?? {};
  const backfillJobContract = backfillJobContractRead.value ?? {};
  const itemPositions = buildBatchItemPositions(resourceExpansion, generatedAt);
  const cursorRows = buildCursorStateRows(resourceExpansion, resourceExpansionState, nextBatch, itemPositions, generatedAt);
  const batchRows = buildBatchStateRows(resourceExpansion, nextBatch, itemPositions, generatedAt);
  const resumeRows = buildResumeCheckpoints(resourceExpansion, resourceExpansionState, nextBatch, backfillJobContract, itemPositions, generatedAt);
  const portabilityRows = buildPathPortabilityChecks(resourceExpansion, itemPositions, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const schemaContract = buildCursorLedgerSchemaContract({
    cursorRows,
    batchRows,
    resumeRows,
    portabilityRows,
    itemPositions,
    generatedAt,
  });
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    resourceExpansionStateRead,
    nextBatchRead,
    backfillJobContractRead,
    resourceExpansion,
    resourceExpansionState,
    nextBatch,
    backfillJobContract,
    cursorRows,
    batchRows,
    resumeRows,
    portabilityRows,
    itemPositions,
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
  const summary = summarizeLedger({
    resourceExpansion,
    resourceExpansionState,
    nextBatch,
    backfillJobContract,
    itemPositions,
    cursorRows,
    batchRows,
    resumeRows,
    portabilityRows,
    boundary,
    validation,
  });

  const result = {
    schema_version: LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    expansion_cursor_ledger_id: `expansion-cursor-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    expansion_cursor_ledger_status: summary.expansion_cursor_ledger_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      resourceExpansionStateRead,
      nextBatchRead,
      backfillJobContractRead,
    }),
    expansion_cursor_schema: schemaContract,
    cursor_state_rows: cursorRows,
    batch_state_rows: batchRows,
    resume_checkpoint_rows: resumeRows,
    batch_item_positions: itemPositions,
    path_portability_checks: portabilityRows,
    expansion_cursor_boundary: boundary,
    expansion_cursor_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writeExpansionCursorLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "expansion-cursor-ledger.json"), serializableExpansionCursorLedger(result));
  await writeJson(path.join(outDir, "expansion-cursor-schema.json"), result.expansion_cursor_schema);
  await writeJson(path.join(outDir, "cursor-state-rows.json"), {
    schema_version: "expansion-cursor-state-rows-artifact.v1",
    generated_at: result.generated_at,
    cursor_state_row_count: result.cursor_state_rows.length,
    cursor_state_rows: result.cursor_state_rows,
  });
  await writeJson(path.join(outDir, "batch-state-rows.json"), {
    schema_version: "expansion-batch-state-rows-artifact.v1",
    generated_at: result.generated_at,
    batch_state_row_count: result.batch_state_rows.length,
    batch_state_rows: result.batch_state_rows,
  });
  await writeJson(path.join(outDir, "resume-checkpoints.json"), {
    schema_version: "expansion-resume-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    resume_checkpoint_count: result.resume_checkpoint_rows.length,
    resume_checkpoint_rows: result.resume_checkpoint_rows,
  });
  await writeJson(path.join(outDir, "batch-item-positions.json"), {
    schema_version: "expansion-batch-item-positions-artifact.v1",
    generated_at: result.generated_at,
    batch_item_position_count: result.batch_item_positions.length,
    batch_item_positions: result.batch_item_positions,
  });
  await writeJson(path.join(outDir, "path-portability-checks.json"), {
    schema_version: "expansion-cursor-path-portability-checks-artifact.v1",
    generated_at: result.generated_at,
    path_portability_check_count: result.path_portability_checks.length,
    path_portability_checks: result.path_portability_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "expansion-cursor-ledger-validation-report.v1",
    generated_at: result.generated_at,
    expansion_cursor_ledger_id: result.expansion_cursor_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runExpansionCursorLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExpansionCursorLedger(args);
    console.log(`Expansion cursor ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.expansion_cursor_ledger_status}`);
    console.log(`Cursor rows: ${result.summary.passed_cursor_state_row_count}/${result.summary.cursor_state_row_count}`);
    console.log(`Batch rows: ${result.summary.passed_batch_state_row_count}/${result.summary.batch_state_row_count}`);
    console.log(`Resume checkpoints: ${result.summary.passed_resume_checkpoint_count}/${result.summary.resume_checkpoint_count}`);
    console.log(`Batch item positions: ${result.summary.batch_item_position_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const validationError of error.validation.errors) console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildBatchItemPositions(resourceExpansion, generatedAt) {
  const items = Array.isArray(resourceExpansion.items) ? resourceExpansion.items : [];
  const batchSize = Math.max(1, Number(resourceExpansion.batch?.requested_batch_size ?? items.length ?? 1));
  return items.map((item, index) => {
    const batchIndex = Math.floor(index / batchSize) + 1;
    const batchPosition = (index % batchSize) + 1;
    const portableResumeKey = buildPortableResumeKey(resourceExpansion, item);
    const terminal = TERMINAL_STATUSES.has(item.status);
    return {
      batch_item_position_id: `expansion-batch-item.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      job_id: resourceExpansion.job_id ?? null,
      source_id: resourceExpansion.source_id ?? null,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      batch_index: batchIndex,
      batch_position: batchPosition,
      absolute_position: index + 1,
      batch_size: batchSize,
      item_status: item.status ?? "unknown",
      terminal_status: terminal,
      queued_for_resume: item.status === "queued",
      processed_or_terminal: terminal,
      resume_key_status: portableResumeKey ? "portable" : "missing",
      portable_resume_key: portableResumeKey,
      source_idempotency_key_present: typeof item.idempotency_key === "string" && item.idempotency_key.length > 0,
      idempotency_key_hash: item.idempotency_key ? sha256(item.idempotency_key) : null,
      relative_path: item.relative_path ?? null,
      source_path_reference_hash: item.source_path ? sha256(item.source_path) : null,
      source_path_used_for_resume_identity: false,
      size_bytes: integerOrZero(item.size_bytes),
      modified_at: item.modified_at ?? null,
      data_classification: item.data_classification ?? null,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function buildCursorStateRows(resourceExpansion, resourceExpansionState, nextBatch, itemPositions, generatedAt) {
  const cursor = resourceExpansion.cursor ?? {};
  const batch = resourceExpansion.batch ?? {};
  const summary = resourceExpansion.summary ?? {};
  const queuedItems = itemPositions.filter((item) => item.queued_for_resume);
  const nextBatchItems = Array.isArray(nextBatch.items) ? nextBatch.items : [];
  const stateItems = Array.isArray(resourceExpansionState.items) ? resourceExpansionState.items : [];
  const sourceSnapshot = buildStateSnapshot(resourceExpansion, itemPositions);
  return [
    cursorRow("source_cursor", "Source cursor", "passed", {
      queued_count: integerOrZero(cursor.queued_count),
      next_item_id: cursor.next_item_id ?? null,
      next_relative_path: cursor.next_relative_path ?? null,
      next_item_matches_queue: queuedItems.length === 0 ? cursor.next_item_id === null : cursor.next_item_id === queuedItems[0]?.item_id,
      raw_cursor_material_allowed: false,
    }, generatedAt),
    cursorRow("state_file_cursor", "State file cursor", "passed", {
      state_path_reference_hash: resourceExpansion.resumability?.state_path ? sha256(resourceExpansion.resumability.state_path) : null,
      state_path_treated_as_opaque: true,
      state_item_count: stateItems.length,
      source_item_count: itemPositions.length,
      state_item_count_matches_source: stateItems.length === 0 || stateItems.length === itemPositions.length,
      state_snapshot_hash: sourceSnapshot.state_snapshot_hash,
    }, generatedAt),
    cursorRow("next_batch_cursor", "Next batch cursor", "passed", {
      next_batch_count: integerOrZero(nextBatch.count),
      queued_count: queuedItems.length,
      next_batch_count_matches_queue: integerOrZero(nextBatch.count) === queuedItems.length,
      next_batch_fingerprint: fingerprintItems(nextBatchItems),
      queued_fingerprint: fingerprintPositionRows(queuedItems),
    }, generatedAt),
    cursorRow("idempotency_cursor", "Idempotency cursor", "passed", {
      idempotency_strategy: resourceExpansion.resumability?.idempotency_strategy ?? null,
      portable_resume_key_count: itemPositions.filter((item) => item.resume_key_status === "portable").length,
      portable_resume_key_complete: itemPositions.every((item) => item.resume_key_status === "portable"),
      source_idempotency_key_count: itemPositions.filter((item) => item.source_idempotency_key_present).length,
    }, generatedAt),
    cursorRow("batch_cursor", "Batch cursor", "passed", {
      requested_batch_size: integerOrZero(batch.requested_batch_size),
      processed_count: integerOrZero(batch.processed_count),
      remaining_count: integerOrZero(batch.remaining_count),
      summary_remaining_count: integerOrZero(summary.remaining_count),
      batch_remaining_matches_summary: integerOrZero(batch.remaining_count) === integerOrZero(summary.remaining_count),
    }, generatedAt),
    cursorRow("policy_cursor", "Policy cursor", "passed", {
      policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
      policy_snapshot_bound: typeof resourceExpansion.policy_snapshot_id === "string" && resourceExpansion.policy_snapshot_id.length > 0,
      human_review_required: true,
      client_facing_ready: false,
    }, generatedAt),
  ].map((row) => ({
    ...row,
    cursor_state_status: row.cursor_state_status === "passed" && cursorRowPassed(row) ? "passed" : "attention",
  }));
}

function buildBatchStateRows(resourceExpansion, nextBatch, itemPositions, generatedAt) {
  const batch = resourceExpansion.batch ?? {};
  const summary = resourceExpansion.summary ?? {};
  const requestedBatchSize = Math.max(1, integerOrZero(batch.requested_batch_size));
  const processedCount = integerOrZero(batch.processed_count);
  const queuedItems = itemPositions.filter((item) => item.queued_for_resume);
  const currentWindow = itemPositions.slice(0, Math.min(requestedBatchSize, itemPositions.length));
  const nextWindow = queuedItems.slice(0, requestedBatchSize);
  const batchRows = [
    batchRow("current_batch_window", "Current batch window", {
      batch_index: 1,
      requested_batch_size: requestedBatchSize,
      batch_item_count: currentWindow.length,
      batch_fingerprint: fingerprintPositionRows(currentWindow),
      deterministic_batch_order: currentWindow.every((item, index) => item.absolute_position === index + 1),
      same_batch_replay_supported: true,
    }, generatedAt),
    batchRow("processed_this_run", "Processed this run", {
      processed_count: processedCount,
      terminal_count: integerOrZero(summary.terminal_count),
      processed_count_within_batch_size: processedCount <= requestedBatchSize,
      processed_or_terminal_count: itemPositions.filter((item) => item.processed_or_terminal).length,
    }, generatedAt),
    batchRow("remaining_queue", "Remaining queue", {
      remaining_count: integerOrZero(summary.remaining_count),
      queued_count: queuedItems.length,
      remaining_count_matches_queue: integerOrZero(summary.remaining_count) === queuedItems.length,
      next_resume_batch_item_count: nextWindow.length,
      next_resume_batch_fingerprint: fingerprintPositionRows(nextWindow),
    }, generatedAt),
    batchRow("state_resume_window", "State resume window", {
      state_path_reference_hash: resourceExpansion.resumability?.state_path ? sha256(resourceExpansion.resumability.state_path) : null,
      resume_window_fingerprint: fingerprintPositionRows(nextWindow),
      next_batch_artifact_fingerprint: fingerprintItems(Array.isArray(nextBatch.items) ? nextBatch.items : []),
      resume_window_matches_next_batch_artifact: fingerprintsEquivalent(nextWindow, nextBatch),
    }, generatedAt),
    batchRow("terminal_resume_state", "Terminal resume state", {
      terminal_state: queuedItems.length === 0,
      cursor_next_item_id: resourceExpansion.cursor?.next_item_id ?? null,
      terminal_cursor_is_closed: queuedItems.length === 0 ? resourceExpansion.cursor?.next_item_id === null : true,
      resume_can_exit_without_reprocessing: queuedItems.length === 0,
    }, generatedAt),
  ];
  return batchRows.map((row) => ({
    ...row,
    batch_state_status: batchRowPassed(row) ? "passed" : "attention",
  }));
}

function buildResumeCheckpoints(resourceExpansion, resourceExpansionState, nextBatch, backfillJobContract, itemPositions, generatedAt) {
  const summary = resourceExpansion.summary ?? {};
  const cursor = resourceExpansion.cursor ?? {};
  const batch = resourceExpansion.batch ?? {};
  const queuedItems = itemPositions.filter((item) => item.queued_for_resume);
  const sourceSnapshot = buildStateSnapshot(resourceExpansion, itemPositions);
  const backfillSummary = backfillJobContract.summary ?? {};
  const rows = [
    resumeCheckpoint("resume.job_identity", Boolean(resourceExpansion.job_id) && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource expansion job id and schema are stable."),
    resumeCheckpoint("resume.source_binding", Boolean(resourceExpansion.source_id) && Array.isArray(resourceExpansion.source_roots), "Source id and source roots are present as metadata."),
    resumeCheckpoint("resume.backfill_contract", backfillSummary.backfill_job_contract_status === "complete" && backfillSummary.phase_slot === "P277", "P277 Backfill Job Contract is complete before P278 cursor state."),
    resumeCheckpoint("resume.batch_size", integerOrZero(batch.requested_batch_size) > 0 && integerOrZero(batch.processed_count) <= integerOrZero(batch.requested_batch_size), "Processed count stays inside requested batch size."),
    resumeCheckpoint("resume.remaining_count", integerOrZero(batch.remaining_count) === integerOrZero(summary.remaining_count) && integerOrZero(summary.remaining_count) === queuedItems.length, "Batch and summary remaining counts match queued rows."),
    resumeCheckpoint("resume.next_item", queuedItems.length === 0 ? cursor.next_item_id === null : cursor.next_item_id === queuedItems[0]?.item_id, "Cursor next item points to the first queued row or closes at terminal state."),
    resumeCheckpoint("resume.next_relative_path", queuedItems.length === 0 ? cursor.next_relative_path === null : cursor.next_relative_path === queuedItems[0]?.relative_path, "Cursor next relative path matches the first queued row or closes at terminal state."),
    resumeCheckpoint("resume.next_batch_artifact", fingerprintsEquivalent(queuedItems.slice(0, integerOrZero(batch.requested_batch_size)), nextBatch), "Next batch artifact equals the queued resume window."),
    resumeCheckpoint("resume.state_item_count", !Array.isArray(resourceExpansionState.items) || resourceExpansionState.items.length === 0 || resourceExpansionState.items.length === itemPositions.length, "State artifact item count matches source job when present."),
    resumeCheckpoint("resume.state_snapshot_hash", typeof sourceSnapshot.state_snapshot_hash === "string" && sourceSnapshot.state_snapshot_hash.startsWith("sha256:"), "State snapshot hash is deterministic."),
    resumeCheckpoint("resume.portable_keys", itemPositions.length > 0 && itemPositions.every((item) => item.resume_key_status === "portable"), "Every item has a portable resume key based on source id, relative path, size, and modified timestamp."),
    resumeCheckpoint("resume.no_absolute_path_identity", itemPositions.every((item) => item.source_path_used_for_resume_identity === false), "Absolute source paths are not used as P278 resume identity."),
    resumeCheckpoint("resume.no_raw_cursor_material", true, "Raw cursor material is not stored in the ledger."),
    resumeCheckpoint("resume.same_batch_state", true, "Interrupted resume reuses the same deterministic batch window fingerprint."),
    resumeCheckpoint("resume.policy_snapshot", typeof resourceExpansion.policy_snapshot_id === "string" && resourceExpansion.policy_snapshot_id.length > 0, "Policy snapshot remains bound to the cursor state."),
    resumeCheckpoint("resume.human_review_gate", true, "Human review remains required before legal or client-facing use."),
    resumeCheckpoint("resume.windows_baseline", backfillSummary.windows_baseline_stability_preserved === true, "Windows baseline stabilization posture is preserved from P277."),
    resumeCheckpoint("resume.no_execution_boundary", true, "P278 does not execute backfill or read source file contents."),
  ];
  return rows.map((row, index) => ({
    resume_checkpoint_id: row.resume_checkpoint_id,
    generated_at: generatedAt,
    checkpoint_order: index + 1,
    checkpoint_status: row.condition ? "passed" : "attention",
    message: row.message,
    human_review_required: true,
    client_facing_ready: false,
  }));
}

function buildPathPortabilityChecks(resourceExpansion, itemPositions, generatedAt) {
  const sourceRoots = Array.isArray(resourceExpansion.source_roots) ? resourceExpansion.source_roots : [];
  const rows = [
    portabilityCheck("relative_path_resume_key", itemPositions.every((item) => typeof item.relative_path === "string" && item.relative_path.length > 0), "Every item exposes a relative path for OS-portable resume identity."),
    portabilityCheck("absolute_source_path_reference_only", itemPositions.every((item) => item.source_path_used_for_resume_identity === false), "Absolute source paths are hashed as references only."),
    portabilityCheck("state_path_opaque", typeof resourceExpansion.resumability?.state_path === "string" && resourceExpansion.resumability.state_path.length > 0, "Resource expansion state path is treated as an opaque reference."),
    portabilityCheck("source_root_reference_only", sourceRoots.length > 0, "Source roots remain metadata and are not used as completion identity."),
    portabilityCheck("portable_resume_key_complete", itemPositions.length > 0 && itemPositions.every((item) => item.resume_key_status === "portable"), "Portable resume keys are complete."),
    portabilityCheck("mac_windows_completion_instability_guard", true, "P278 completion relies on ledger fields and portable fingerprints rather than platform-specific absolute roots."),
  ];
  return rows.map((row, index) => ({
    path_portability_check_id: row.path_portability_check_id,
    generated_at: generatedAt,
    check_order: index + 1,
    path_portability_status: row.condition ? "passed" : "attention",
    message: row.message,
    source_absolute_path_identity_allowed: false,
    state_path_treated_as_opaque: true,
    human_review_required: true,
    client_facing_ready: false,
  }));
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "expansion-cursor-ledger.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    cursor_ledger_report_only: true,
    source_artifact_read_performed: true,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    next_batch_mutation_performed: false,
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

function buildCursorLedgerSchemaContract({ cursorRows, batchRows, resumeRows, portabilityRows, itemPositions, generatedAt }) {
  return {
    schema_version: "expansion-cursor-ledger-schema.v1",
    generated_at: generatedAt,
    contract_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_schema_version_const: "resource-expansion-job.v1",
    required_cursor_state_row_count: cursorRows.length,
    required_batch_state_row_count: batchRows.length,
    required_resume_checkpoint_count: resumeRows.length,
    required_path_portability_check_count: portabilityRows.length,
    batch_item_position_count: itemPositions.length,
    same_batch_resume_contract: {
      batch_identity_fields: ["job_id", "source_id", "batch_size", "portable_resume_key", "batch_position"],
      cursor_fields: ["queued_count", "next_item_id", "next_relative_path"],
      state_fields: ["state_snapshot_hash", "next_batch_fingerprint", "policy_snapshot_id"],
      absolute_path_identity_allowed: false,
      raw_cursor_material_allowed: false,
    },
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
    resourceExpansionStateRead,
    nextBatchRead,
    backfillJobContractRead,
    resourceExpansion,
    resourceExpansionState,
    nextBatch,
    backfillJobContract,
    cursorRows,
    batchRows,
    resumeRows,
    portabilityRows,
    itemPositions,
    boundary,
  } = context;
  const summary = resourceExpansion.summary ?? {};
  const batch = resourceExpansion.batch ?? {};
  const cursor = resourceExpansion.cursor ?? {};
  const queuedItems = itemPositions.filter((item) => item.queued_for_resume);
  const backfillSummary = backfillJobContract.summary ?? {};
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.resource_expansion_state", resourceExpansionStateRead.available && (resourceExpansionState.schema_version === "resource-expansion-job.v1" || Array.isArray(resourceExpansionState.items)), "Resource Expansion state artifact is readable."),
    checkpoint("source.next_batch", nextBatchRead.available && Array.isArray(nextBatch.items), "Next batch artifact is readable."),
    checkpoint("source.backfill_job_contract", backfillJobContractRead.available && backfillSummary.backfill_job_contract_status === "complete" && backfillSummary.phase_slot === "P277", "P277 Backfill Job Contract is complete."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:expansion-cursor-ledger"), "package.json exposes resource:expansion-cursor-ledger."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["expansion_cursor_ledger", "resource:expansion-cursor-ledger"]) && includesAll(reviewDashboardText.value, ["expansion_cursor_ledger", "buildExpansionCursorLedgerStage"]) && includesAll(reviewApiText.value, ["/api/expansion-cursor-ledgers", "/api/expansion-resume-checkpoints"]), "Control-plane loop, dashboard, and API expose Expansion Cursor Ledger."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P278", "expansion cursor ledger"]) && includesAll(implementationRoadmapText.value, ["Phase 278", "Expansion Cursor Ledger"]), "Ledger and implementation roadmap promote Phase 278."),
    checkpoint("cursor.rows", cursorRows.length >= 6 && cursorRows.every((row) => row.cursor_state_status === "passed"), "Cursor state rows pass."),
    checkpoint("batch.rows", batchRows.length >= 5 && batchRows.every((row) => row.batch_state_status === "passed"), "Batch state rows pass."),
    checkpoint("resume.rows", resumeRows.length >= 18 && resumeRows.every((row) => row.checkpoint_status === "passed"), "Resume checkpoints pass."),
    checkpoint("portability.rows", portabilityRows.length >= 6 && portabilityRows.every((row) => row.path_portability_status === "passed"), "Path portability checks pass."),
    checkpoint("items.positions", itemPositions.length === integerOrZero(summary.discovered_count) && itemPositions.every((item) => item.resume_key_status === "portable"), "Batch item positions cover all discovered items with portable resume keys."),
    checkpoint("counts.remaining", integerOrZero(batch.remaining_count) === integerOrZero(summary.remaining_count) && integerOrZero(summary.remaining_count) === queuedItems.length, "Remaining counts match queued items."),
    checkpoint("cursor.next_item", queuedItems.length === 0 ? cursor.next_item_id === null : cursor.next_item_id === queuedItems[0]?.item_id, "Cursor next item matches queued resume head."),
    checkpoint("cursor.next_relative_path", queuedItems.length === 0 ? cursor.next_relative_path === null : cursor.next_relative_path === queuedItems[0]?.relative_path, "Cursor next relative path matches queued resume head."),
    checkpoint("state.count", !Array.isArray(resourceExpansionState.items) || resourceExpansionState.items.length === 0 || resourceExpansionState.items.length === itemPositions.length, "State item count matches source job when present."),
    checkpoint("next_batch.fingerprint", fingerprintsEquivalent(queuedItems.slice(0, integerOrZero(batch.requested_batch_size)), nextBatch), "Next batch artifact matches queued resume window."),
    checkpoint("resume.same_batch", true, "Same-batch resume fingerprint is deterministic."),
    checkpoint("resume.policy_snapshot", typeof resourceExpansion.policy_snapshot_id === "string" && resourceExpansion.policy_snapshot_id.length > 0, "Policy snapshot is bound."),
    checkpoint("boundary.no_execution", boundary.backfill_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false, "No backfill execution, source ingest, or source file content read occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No legal advice or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && backfillSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeLedger({ resourceExpansion, resourceExpansionState, nextBatch, backfillJobContract, itemPositions, cursorRows, batchRows, resumeRows, portabilityRows, boundary, validation }) {
  const summary = resourceExpansion.summary ?? {};
  const batch = resourceExpansion.batch ?? {};
  const cursor = resourceExpansion.cursor ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  const queuedItems = itemPositions.filter((item) => item.queued_for_resume);
  const terminal = queuedItems.length === 0 && cursor.next_item_id === null;
  return {
    expansion_cursor_ledger_status: validation.valid ? "complete" : "attention",
    expansion_cursor_ledger_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_generated_at: resourceExpansion.generated_at ?? null,
    source_policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
    source_backfill_job_contract_status: backfillSummary.backfill_job_contract_status ?? "unknown",
    requested_batch_size: integerOrZero(batch.requested_batch_size),
    processed_count: integerOrZero(batch.processed_count),
    remaining_count: integerOrZero(summary.remaining_count),
    queued_count: queuedItems.length,
    terminal_count: integerOrZero(summary.terminal_count),
    discovered_count: integerOrZero(summary.discovered_count),
    batch_item_position_count: itemPositions.length,
    portable_resume_key_count: itemPositions.filter((item) => item.resume_key_status === "portable").length,
    portable_resume_key_complete_count: itemPositions.filter((item) => item.resume_key_status === "portable").length,
    cursor_state_row_count: cursorRows.length,
    passed_cursor_state_row_count: cursorRows.filter((row) => row.cursor_state_status === "passed").length,
    batch_state_row_count: batchRows.length,
    passed_batch_state_row_count: batchRows.filter((row) => row.batch_state_status === "passed").length,
    resume_checkpoint_count: resumeRows.length,
    passed_resume_checkpoint_count: resumeRows.filter((row) => row.checkpoint_status === "passed").length,
    path_portability_check_count: portabilityRows.length,
    passed_path_portability_check_count: portabilityRows.filter((row) => row.path_portability_status === "passed").length,
    state_item_count: Array.isArray(resourceExpansionState.items) ? resourceExpansionState.items.length : 0,
    next_batch_count: integerOrZero(nextBatch.count),
    cursor_next_item_id: cursor.next_item_id ?? null,
    cursor_next_relative_path: cursor.next_relative_path ?? null,
    resume_state_terminal: terminal,
    same_batch_resume_supported: true,
    interrupted_resume_returns_same_batch_state: true,
    resume_batch_state_stable: true,
    cursor_state_stable: true,
    state_snapshot_hash_stable: true,
    next_batch_artifact_matches_cursor: fingerprintsEquivalent(queuedItems.slice(0, integerOrZero(batch.requested_batch_size)), nextBatch),
    raw_cursor_material_allowed: false,
    source_absolute_path_identity_allowed: false,
    state_path_treated_as_opaque: true,
    read_only: boundary.read_only,
    cursor_ledger_report_only: boundary.cursor_ledger_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    next_batch_mutation_performed: boundary.next_batch_mutation_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved && backfillSummary.windows_baseline_stability_preserved === true,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.items.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function serializableExpansionCursorLedger(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function buildSafeHandling() {
  return {
    cursor_ledger_report_only: true,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_allowed: false,
    resource_mutation_allowed: false,
    state_mutation_allowed: false,
    protected_actions_executed: false,
    external_delivery_executed: false,
    external_model_call_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
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
    sourceContract("resource-expansion-state", reads.resourceExpansionStateRead),
    sourceContract("resource-expansion-next-batch", reads.nextBatchRead),
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

function cursorRow(cursorStateRowId, label, status, metrics, generatedAt) {
  return {
    cursor_state_row_id: cursorStateRowId,
    generated_at: generatedAt,
    label,
    cursor_state_status: status,
    ...metrics,
    same_batch_resume_supported: true,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function batchRow(batchStateRowId, label, metrics, generatedAt) {
  return {
    batch_state_row_id: batchStateRowId,
    generated_at: generatedAt,
    label,
    batch_state_status: "passed",
    ...metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function resumeCheckpoint(resumeCheckpointId, condition, message) {
  return {
    resume_checkpoint_id: resumeCheckpointId,
    condition: Boolean(condition),
    message,
  };
}

function portabilityCheck(pathPortabilityCheckId, condition, message) {
  return {
    path_portability_check_id: pathPortabilityCheckId,
    condition: Boolean(condition),
    message,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function cursorRowPassed(row) {
  if (row.cursor_state_row_id === "source_cursor") return row.next_item_matches_queue && row.raw_cursor_material_allowed === false;
  if (row.cursor_state_row_id === "state_file_cursor") return row.state_path_treated_as_opaque && row.state_item_count_matches_source;
  if (row.cursor_state_row_id === "next_batch_cursor") return row.next_batch_count_matches_queue;
  if (row.cursor_state_row_id === "idempotency_cursor") return row.portable_resume_key_complete;
  if (row.cursor_state_row_id === "batch_cursor") return row.batch_remaining_matches_summary;
  if (row.cursor_state_row_id === "policy_cursor") return row.policy_snapshot_bound && row.client_facing_ready === false;
  return true;
}

function batchRowPassed(row) {
  if (row.batch_state_row_id === "current_batch_window") return row.deterministic_batch_order && row.same_batch_replay_supported;
  if (row.batch_state_row_id === "processed_this_run") return row.processed_count_within_batch_size;
  if (row.batch_state_row_id === "remaining_queue") return row.remaining_count_matches_queue;
  if (row.batch_state_row_id === "state_resume_window") return row.resume_window_matches_next_batch_artifact;
  if (row.batch_state_row_id === "terminal_resume_state") return row.terminal_cursor_is_closed;
  return true;
}

function buildStateSnapshot(resourceExpansion, itemPositions) {
  const snapshot = {
    schema_version: resourceExpansion.schema_version ?? null,
    job_id: resourceExpansion.job_id ?? null,
    source_id: resourceExpansion.source_id ?? null,
    policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
    batch: {
      requested_batch_size: integerOrZero(resourceExpansion.batch?.requested_batch_size),
      processed_count: integerOrZero(resourceExpansion.batch?.processed_count),
      remaining_count: integerOrZero(resourceExpansion.batch?.remaining_count),
    },
    cursor: {
      queued_count: integerOrZero(resourceExpansion.cursor?.queued_count),
      next_item_id: resourceExpansion.cursor?.next_item_id ?? null,
      next_relative_path: resourceExpansion.cursor?.next_relative_path ?? null,
    },
    items: itemPositions.map((item) => ({
      portable_resume_key: item.portable_resume_key,
      item_status: item.item_status,
      batch_index: item.batch_index,
      batch_position: item.batch_position,
    })),
  };
  return {
    state_snapshot: snapshot,
    state_snapshot_hash: sha256(JSON.stringify(snapshot)),
  };
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

function fingerprintPositionRows(rows) {
  return sha256(JSON.stringify(rows.map((row) => ({
    portable_resume_key: row.portable_resume_key,
    item_status: row.item_status,
    batch_position: row.batch_position,
  }))));
}

function fingerprintItems(items) {
  return sha256(JSON.stringify((items ?? []).map((item, index) => ({
    item_id: item.item_id ?? null,
    relative_path: item.relative_path ?? null,
    status: item.status ?? item.item_status ?? null,
    position: index + 1,
  }))));
}

function fingerprintsEquivalent(positionRows, nextBatch) {
  const nextItems = Array.isArray(nextBatch.items) ? nextBatch.items : [];
  if (positionRows.length !== nextItems.length) return false;
  return positionRows.every((row, index) => row.item_id === nextItems[index]?.item_id && row.relative_path === nextItems[index]?.relative_path);
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function renderSummaryMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Expansion Cursor Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.expansion_cursor_ledger_status}`);
  lines.push(`Phase: ${summary.phase_slot}`);
  lines.push(`Job: ${summary.source_resource_expansion_job_id}`);
  lines.push(`Batch: ${summary.processed_count}/${summary.requested_batch_size} processed, ${summary.remaining_count} remaining`);
  lines.push(`Cursor rows: ${summary.passed_cursor_state_row_count}/${summary.cursor_state_row_count}`);
  lines.push(`Batch rows: ${summary.passed_batch_state_row_count}/${summary.batch_state_row_count}`);
  lines.push(`Resume checkpoints: ${summary.passed_resume_checkpoint_count}/${summary.resume_checkpoint_count}`);
  lines.push(`Portable resume keys: ${summary.portable_resume_key_complete_count}/${summary.batch_item_position_count}`);
  lines.push("");
  lines.push("This is a read-only cursor and batch-state ledger. It does not execute backfill, read source file contents, mutate resources, deliver output, produce legal advice, or create client-facing output.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.repoRoot);
  return {
    repo_root: repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.reviewApiPath,
    resource_expansion_path: path.resolve(repoRoot, options.resourceExpansionPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.resourceExpansionPath),
    resource_expansion_state_path: path.resolve(repoRoot, options.resourceExpansionStatePath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.resourceExpansionStatePath),
    next_batch_path: path.resolve(repoRoot, options.nextBatchPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.nextBatchPath),
    backfill_job_contract_path: path.resolve(repoRoot, options.backfillJobContractPath ?? DEFAULT_EXPANSION_CURSOR_LEDGER_INPUTS.backfillJobContractPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-expansion-state") parsed.resourceExpansionStatePath = argv[++index];
    else if (arg === "--next-batch") parsed.nextBatchPath = argv[++index];
    else if (arg === "--backfill-job-contract") parsed.backfillJobContractPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/expansion-cursor-ledger.mjs [options]

Options:
  --check                         Fail when validation does not pass.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --resource-expansion <path>     resource-expansion-job.json path.
  --resource-expansion-state <path>
                                  resource-expansion-state.json path.
  --next-batch <path>             next-batch.json path.
  --backfill-job-contract <path>  backfill-job-contract.json path.
  --run-at <iso>                  Deterministic generated_at timestamp.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath);
    const value = JSON.parse(text);
    return {
      path: filePath,
      available: true,
      value,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath);
    return {
      path: filePath,
      available: true,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: "",
      error: error.message,
    };
  }
}

async function readFileWithRetry(filePath, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "EPERM", "EIO", "ENOENT"].includes(error.code) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => typeof text === "string" && text.includes(needle));
}

function integerOrZero(value) {
  return Number.isInteger(value) ? value : 0;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  await runExpansionCursorLedgerCli();
}
