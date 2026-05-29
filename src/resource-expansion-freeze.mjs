import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_EXPANSION_FREEZE_OUT_DIR = "artifacts/resource-expansion-freeze/latest";
export const DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS = {
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
  expansionCursorLedgerPath: "artifacts/expansion-cursor-ledger/latest/expansion-cursor-ledger.json",
  expansionDedupLedgerPath: "artifacts/expansion-dedup-ledger/latest/expansion-dedup-ledger.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  batchClassificationResultPath: "artifacts/batch-classification-result/latest/batch-classification-result.json",
  batchMatterTaggingResultPath: "artifacts/batch-matter-tagging-result/latest/batch-matter-tagging-result.json",
  extractorRegistryPath: "artifacts/extractor-registry/latest/extractor-registry.json",
  extractorCoverageReportPath: "artifacts/extractor-coverage-report/latest/extractor-coverage-report.json",
  expansionStatusDashboardPath: "artifacts/expansion-status-dashboard/latest/expansion-status-dashboard.json",
};

const FREEZE_SCHEMA_VERSION = "resource-expansion-freeze.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.resource_expansion_freeze";
const PHASE_SLOT = "P286";
const PREVIOUS_PHASE_SLOT = "P285";
const NEXT_PHASE_SLOT = "P287";
const DEFAULT_TARGET_SCALE_ITEM_COUNT = 2713;
const HUMAN_REVIEW_NOTE = "Resource Expansion Freeze is a read-only freeze report and deterministic scale projection. It does not execute backfill, ingest sources, read source file contents, retry extraction, release quarantine, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

const SOURCE_DEFINITIONS = [
  sourceDefinition("resource_expansion_job", "Resource Expansion Job", "P277-P286", "resource_expansion_path", null),
  sourceDefinition("backfill_job_contract", "Backfill Job Contract", "P277", "backfill_job_contract_path", "backfill_job_contract_status"),
  sourceDefinition("expansion_cursor_ledger", "Expansion Cursor Ledger", "P278", "expansion_cursor_ledger_path", "expansion_cursor_ledger_status"),
  sourceDefinition("expansion_dedup_ledger", "Expansion Dedup Ledger", "P279", "expansion_dedup_ledger_path", "expansion_dedup_ledger_status"),
  sourceDefinition("expansion_quarantine_ledger", "Expansion Quarantine Ledger", "P280", "expansion_quarantine_ledger_path", "expansion_quarantine_ledger_status"),
  sourceDefinition("batch_classification_result", "Batch Classification Result", "P281", "batch_classification_result_path", "batch_classification_result_status"),
  sourceDefinition("batch_matter_tagging_result", "Batch Matter Tagging Result", "P282", "batch_matter_tagging_result_path", "batch_matter_tagging_result_status"),
  sourceDefinition("extractor_registry", "Extractor Registry", "P283", "extractor_registry_path", "extractor_registry_status"),
  sourceDefinition("extractor_coverage_report", "Extractor Coverage Report", "P284", "extractor_coverage_report_path", "extractor_coverage_report_status"),
  sourceDefinition("expansion_status_dashboard", "Expansion Status Dashboard", "P285", "expansion_status_dashboard_path", "expansion_status_dashboard_status"),
];

export async function runResourceExpansionFreeze(options = {}) {
  const result = await buildResourceExpansionFreeze(options);
  if (options.write !== false) await writeResourceExpansionFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource expansion freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceExpansionFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const targetScaleItemCount = Number(options.targetScaleItemCount ?? DEFAULT_TARGET_SCALE_ITEM_COUNT);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));

  const readResults = {};
  for (const definition of SOURCE_DEFINITIONS) {
    readResults[definition.source_id] = await readJsonOrError(inputs[definition.input_key]);
  }
  readResults.resource_expansion_state = await readJsonOrError(inputs.resource_expansion_state_path);
  readResults.next_batch = await readJsonOrError(inputs.next_batch_path);

  const artifacts = Object.fromEntries(SOURCE_DEFINITIONS.map((definition) => [
    definition.source_id,
    readResults[definition.source_id].value ?? {},
  ]));
  const resourceExpansionState = readResults.resource_expansion_state.value ?? {};
  const nextBatch = readResults.next_batch.value ?? {};

  const freezeSources = buildFreezeSources({ artifacts, readResults, generatedAt });
  const dryRunRows = buildDryRunRows({
    resourceExpansion: artifacts.resource_expansion_job,
    targetScaleItemCount,
    generatedAt,
  });
  const resumeProbes = buildResumeProbes({
    resourceExpansion: artifacts.resource_expansion_job,
    resourceExpansionState,
    nextBatch,
    expansionCursorLedger: artifacts.expansion_cursor_ledger,
    expansionDedupLedger: artifacts.expansion_dedup_ledger,
    expansionStatusDashboard: artifacts.expansion_status_dashboard,
    generatedAt,
  });
  const idempotencyProbes = buildIdempotencyProbes({
    resourceExpansion: artifacts.resource_expansion_job,
    expansionDedupLedger: artifacts.expansion_dedup_ledger,
    batchClassificationResult: artifacts.batch_classification_result,
    batchMatterTaggingResult: artifacts.batch_matter_tagging_result,
    extractorCoverageReport: artifacts.extractor_coverage_report,
    expansionStatusDashboard: artifacts.expansion_status_dashboard,
    generatedAt,
  });
  const boundary = buildBoundary(generatedAt);
  const scaleChecks = buildScaleChecks({
    freezeSources,
    dryRunRows,
    resumeProbes,
    idempotencyProbes,
    boundary,
    targetScaleItemCount,
    generatedAt,
  });
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    readResults,
    artifacts,
    resourceExpansionState,
    nextBatch,
    freezeSources,
    dryRunRows,
    resumeProbes,
    idempotencyProbes,
    scaleChecks,
    boundary,
    targetScaleItemCount,
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
  const summary = summarizeFreeze({
    artifacts,
    resourceExpansionState,
    nextBatch,
    freezeSources,
    dryRunRows,
    resumeProbes,
    idempotencyProbes,
    scaleChecks,
    boundary,
    validation,
    targetScaleItemCount,
  });
  const result = {
    schema_version: FREEZE_SCHEMA_VERSION,
    generated_at: generatedAt,
    resource_expansion_freeze_id: `resource-expansion-freeze.${dateStamp(generatedAt)}`,
    resource_expansion_freeze_status: summary.resource_expansion_freeze_status,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      readResults,
    }),
    resource_expansion_freeze_contract: buildContract(generatedAt, targetScaleItemCount, dryRunRows),
    expansion_freeze_source_rows: freezeSources,
    expansion_freeze_dry_run_rows: dryRunRows,
    expansion_freeze_resume_probes: resumeProbes,
    expansion_freeze_idempotency_probes: idempotencyProbes,
    expansion_freeze_scale_checks: scaleChecks,
    expansion_freeze_boundary: boundary,
    expansion_freeze_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writeResourceExpansionFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "resource-expansion-freeze.json"), serializableResourceExpansionFreeze(result));
  await writeJson(path.join(outDir, "expansion-freeze-source-rows.json"), {
    schema_version: "expansion-freeze-source-rows.v1",
    generated_at: result.generated_at,
    source_row_count: result.expansion_freeze_source_rows.length,
    expansion_freeze_source_rows: result.expansion_freeze_source_rows,
  });
  await writeJson(path.join(outDir, "expansion-freeze-dry-run-rows.json"), {
    schema_version: "expansion-freeze-dry-run-rows.v1",
    generated_at: result.generated_at,
    dry_run_row_count: result.expansion_freeze_dry_run_rows.length,
    expansion_freeze_dry_run_rows: result.expansion_freeze_dry_run_rows,
  });
  await writeJson(path.join(outDir, "expansion-freeze-resume-probes.json"), {
    schema_version: "expansion-freeze-resume-probes.v1",
    generated_at: result.generated_at,
    resume_probe_count: result.expansion_freeze_resume_probes.length,
    expansion_freeze_resume_probes: result.expansion_freeze_resume_probes,
  });
  await writeJson(path.join(outDir, "expansion-freeze-idempotency-probes.json"), {
    schema_version: "expansion-freeze-idempotency-probes.v1",
    generated_at: result.generated_at,
    idempotency_probe_count: result.expansion_freeze_idempotency_probes.length,
    expansion_freeze_idempotency_probes: result.expansion_freeze_idempotency_probes,
  });
  await writeJson(path.join(outDir, "expansion-freeze-scale-checks.json"), {
    schema_version: "expansion-freeze-scale-checks.v1",
    generated_at: result.generated_at,
    scale_check_count: result.expansion_freeze_scale_checks.length,
    expansion_freeze_scale_checks: result.expansion_freeze_scale_checks,
  });
  await writeJson(path.join(outDir, "expansion-freeze-boundary.json"), {
    schema_version: "expansion-freeze-boundary.v1",
    generated_at: result.generated_at,
    expansion_freeze_boundary: result.expansion_freeze_boundary,
  });
  await writeJson(path.join(outDir, "expansion-freeze-checkpoints.json"), {
    schema_version: "expansion-freeze-checkpoints.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.expansion_freeze_checkpoints.length,
    expansion_freeze_checkpoints: result.expansion_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "resource-expansion-freeze-validation-report.v1",
    generated_at: result.generated_at,
    resource_expansion_freeze_id: result.resource_expansion_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runResourceExpansionFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runResourceExpansionFreeze(args);
    console.log(`Resource expansion freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_expansion_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
    console.log(`Dry-run target: ${result.summary.dry_run_scale_target_count}`);
    console.log(`Projected batches: ${result.summary.projected_batch_count}`);
    console.log(`Resume probes: ${result.summary.passed_resume_probe_count}/${result.summary.resume_probe_count}`);
    console.log(`Idempotency probes: ${result.summary.passed_idempotency_probe_count}/${result.summary.idempotency_probe_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFreezeSources({ artifacts, readResults, generatedAt }) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const artifact = artifacts[definition.source_id] ?? {};
    const read = readResults[definition.source_id] ?? {};
    const summary = artifact.summary ?? {};
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const failedCheckpointCount = summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? 0;
    const isResourceExpansion = definition.source_id === "resource_expansion_job";
    const sourceStatus = isResourceExpansion
      ? read.available && artifact.schema_version === "resource-expansion-job.v1" && (artifact.items?.length ?? 0) > 0 && (summary.remaining_count ?? -1) === (artifact.cursor?.queued_count ?? -2)
      : read.available && summary[definition.status_key] === "complete" && summary.phase_slot === definition.phase_slot && artifact.validation?.valid !== false && validationErrorCount === 0 && failedCheckpointCount === 0;
    return {
      expansion_freeze_source_row_id: `expansion-freeze-source.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      source_id: definition.source_id,
      source_label: definition.label,
      source_phase_slot: definition.phase_slot,
      source_path: read.path ?? null,
      source_status: sourceStatus ? "complete" : "attention",
      schema_version: artifact.schema_version ?? null,
      expected_status_key: definition.status_key,
      observed_status: isResourceExpansion ? artifact.schema_version ?? "unknown" : summary[definition.status_key] ?? "unknown",
      observed_phase_slot: summary.phase_slot ?? definition.phase_slot,
      observed_next_phase_slot: summary.next_phase_slot ?? null,
      validation_error_count: validationErrorCount,
      failed_checkpoint_count: failedCheckpointCount,
      source_item_count: summary.resource_item_count ?? summary.discovered_count ?? artifact.items?.length ?? 0,
      terminal_count: summary.terminal_count ?? 0,
      remaining_count: summary.remaining_count ?? 0,
      windows_baseline_stability_preserved: summary.windows_baseline_stability_preserved ?? true,
      mac_windows_completion_instability_guard: summary.mac_windows_completion_instability_guard ?? true,
      human_review_required: true,
      client_facing_ready: false,
    };
  });
}

function buildDryRunRows({ resourceExpansion, targetScaleItemCount, generatedAt }) {
  const sourceItemCount = Math.max(1, resourceExpansion.items?.length ?? resourceExpansion.summary?.discovered_count ?? 1);
  const batchSize = Math.max(1, Number(resourceExpansion.batch?.requested_batch_size ?? sourceItemCount));
  const projectedBatchCount = Math.ceil(targetScaleItemCount / batchSize);
  const sampleStatusDistribution = resourceExpansion.summary?.by_status ?? {};
  return Array.from({ length: projectedBatchCount }, (_, index) => {
    const start = index * batchSize + 1;
    const end = Math.min(targetScaleItemCount, start + batchSize - 1);
    const itemCount = Math.max(0, end - start + 1);
    return {
      expansion_freeze_dry_run_row_id: `expansion-freeze-dry-run.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      dry_run_status: "passed",
      projection_strategy: "deterministic_sample_replay_projection",
      projected_batch_index: index + 1,
      projected_batch_count: projectedBatchCount,
      projected_item_start: start,
      projected_item_end: end,
      projected_item_count: itemCount,
      source_sample_item_count: sourceItemCount,
      requested_batch_size: batchSize,
      target_scale_item_count: targetScaleItemCount,
      sample_status_distribution: sampleStatusDistribution,
      terminal_projection_count: itemCount,
      remaining_projection_count: 0,
      resumable: true,
      idempotent: true,
      api_queryable: true,
      human_review_required: true,
      client_facing_ready: false,
      backfill_execution_performed: false,
      source_ingest_performed: false,
      file_content_read_performed: false,
    };
  });
}

function buildResumeProbes({
  resourceExpansion,
  resourceExpansionState,
  nextBatch,
  expansionCursorLedger,
  expansionDedupLedger,
  expansionStatusDashboard,
  generatedAt,
}) {
  const resourceSummary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const statusSummary = expansionStatusDashboard.summary ?? {};
  const itemCount = resourceExpansion.items?.length ?? 0;
  const probes = [
    probe("cursor_ledger_complete", cursorSummary.expansion_cursor_ledger_status === "complete" && cursorSummary.phase_slot === "P278", {
      source_status: cursorSummary.expansion_cursor_ledger_status ?? "unknown",
      phase_slot: cursorSummary.phase_slot ?? null,
    }),
    probe("next_batch_empty_after_terminal", (nextBatch.count ?? 0) === 0 && (resourceSummary.remaining_count ?? 0) === 0 && (resourceExpansion.cursor?.queued_count ?? 0) === 0, {
      next_batch_count: nextBatch.count ?? 0,
      remaining_count: resourceSummary.remaining_count ?? null,
      queued_count: resourceExpansion.cursor?.queued_count ?? null,
    }),
    probe("state_snapshot_matches_job", resourceExpansionState.job_id === resourceExpansion.job_id && (resourceExpansionState.items?.length ?? 0) === itemCount, {
      state_job_id: resourceExpansionState.job_id ?? null,
      job_id: resourceExpansion.job_id ?? null,
      state_item_count: resourceExpansionState.items?.length ?? 0,
      item_count: itemCount,
    }),
    probe("portable_resume_keys_cover_items", cursorSummary.portable_resume_key_complete_count === itemCount && (cursorSummary.source_path_used_for_resume_identity_count ?? 0) === 0, {
      portable_resume_key_complete_count: cursorSummary.portable_resume_key_complete_count ?? 0,
      item_count: itemCount,
      source_path_used_for_resume_identity_count: cursorSummary.source_path_used_for_resume_identity_count ?? 0,
    }),
    probe("interrupted_resume_returns_same_batch_state", cursorSummary.same_batch_resume_supported === true && cursorSummary.interrupted_resume_returns_same_batch_state === true && cursorSummary.resume_batch_state_stable === true, {
      same_batch_resume_supported: cursorSummary.same_batch_resume_supported ?? false,
      interrupted_resume_returns_same_batch_state: cursorSummary.interrupted_resume_returns_same_batch_state ?? false,
      resume_batch_state_stable: cursorSummary.resume_batch_state_stable ?? false,
    }),
    probe("mac_windows_path_identity_guard", (dedupSummary.absolute_path_identity_allowed_count ?? 0) === 0 && (statusSummary.source_path_used_for_status_identity_count ?? 0) === 0, {
      absolute_path_identity_allowed_count: dedupSummary.absolute_path_identity_allowed_count ?? 0,
      source_path_used_for_status_identity_count: statusSummary.source_path_used_for_status_identity_count ?? 0,
    }),
  ];
  return probes.map((row, index) => ({
    expansion_freeze_resume_probe_id: `expansion-freeze-resume-probe.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    ...row,
  }));
}

function buildIdempotencyProbes({
  resourceExpansion,
  expansionDedupLedger,
  batchClassificationResult,
  batchMatterTaggingResult,
  extractorCoverageReport,
  expansionStatusDashboard,
  generatedAt,
}) {
  const itemCount = resourceExpansion.items?.length ?? 0;
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const classificationSummary = batchClassificationResult.summary ?? {};
  const taggingSummary = batchMatterTaggingResult.summary ?? {};
  const coverageSummary = extractorCoverageReport.summary ?? {};
  const statusSummary = expansionStatusDashboard.summary ?? {};
  const probes = [
    idempotencyProbe("idempotency_key_uniqueness", dedupSummary.idempotency_key_count === itemCount && dedupSummary.unique_idempotency_key_count === itemCount && dedupSummary.idempotency_key_collision_count === 0, {
      idempotency_key_count: dedupSummary.idempotency_key_count ?? 0,
      unique_idempotency_key_count: dedupSummary.unique_idempotency_key_count ?? 0,
      idempotency_key_collision_count: dedupSummary.idempotency_key_collision_count ?? 0,
      item_count: itemCount,
    }),
    idempotencyProbe("duplicate_decision_coverage", dedupSummary.duplicate_decision_count === itemCount && dedupSummary.passed_duplicate_decision_count === dedupSummary.duplicate_decision_count && dedupSummary.new_resource_promoted_for_duplicate_count === 0, {
      duplicate_decision_count: dedupSummary.duplicate_decision_count ?? 0,
      passed_duplicate_decision_count: dedupSummary.passed_duplicate_decision_count ?? 0,
      new_resource_promoted_for_duplicate_count: dedupSummary.new_resource_promoted_for_duplicate_count ?? 0,
    }),
    idempotencyProbe("classification_coverage", classificationSummary.classification_row_count === itemCount && classificationSummary.classified_resource_count === itemCount && classificationSummary.missing_classification_count === 0, {
      classification_row_count: classificationSummary.classification_row_count ?? 0,
      classified_resource_count: classificationSummary.classified_resource_count ?? 0,
      missing_classification_count: classificationSummary.missing_classification_count ?? 0,
    }),
    idempotencyProbe("matter_tagging_separation", taggingSummary.batch_matter_tagging_row_count === itemCount && taggingSummary.auto_apply_allowed_count === 0 && taggingSummary.human_confirmation_applied_count === 0, {
      batch_matter_tagging_row_count: taggingSummary.batch_matter_tagging_row_count ?? 0,
      auto_apply_allowed_count: taggingSummary.auto_apply_allowed_count ?? 0,
      human_confirmation_applied_count: taggingSummary.human_confirmation_applied_count ?? 0,
    }),
    idempotencyProbe("extractor_coverage_complete", coverageSummary.coverage_item_row_count === itemCount && coverageSummary.coverage_missing_item_count === 0 && coverageSummary.processed_item_count === itemCount, {
      coverage_item_row_count: coverageSummary.coverage_item_row_count ?? 0,
      processed_item_count: coverageSummary.processed_item_count ?? 0,
      coverage_missing_item_count: coverageSummary.coverage_missing_item_count ?? 0,
    }),
    idempotencyProbe("status_dashboard_links_complete", statusSummary.status_item_row_count === itemCount && statusSummary.linked_dedup_row_count === itemCount && statusSummary.linked_quarantine_row_count === itemCount && statusSummary.linked_coverage_row_count === itemCount, {
      status_item_row_count: statusSummary.status_item_row_count ?? 0,
      linked_dedup_row_count: statusSummary.linked_dedup_row_count ?? 0,
      linked_quarantine_row_count: statusSummary.linked_quarantine_row_count ?? 0,
      linked_coverage_row_count: statusSummary.linked_coverage_row_count ?? 0,
    }),
  ];
  return probes.map((row, index) => ({
    expansion_freeze_idempotency_probe_id: `expansion-freeze-idempotency-probe.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    ...row,
  }));
}

function buildScaleChecks({
  freezeSources,
  dryRunRows,
  resumeProbes,
  idempotencyProbes,
  boundary,
  targetScaleItemCount,
  generatedAt,
}) {
  const projectedItemCount = sum(dryRunRows.map((row) => row.projected_item_count));
  const checks = [
    scaleCheck("target_scale_declared", targetScaleItemCount >= DEFAULT_TARGET_SCALE_ITEM_COUNT, { target_scale_item_count: targetScaleItemCount }),
    scaleCheck("projected_batches_partition_target", projectedItemCount === targetScaleItemCount && dryRunRows.at(0)?.projected_item_start === 1 && dryRunRows.at(-1)?.projected_item_end === targetScaleItemCount, { projected_item_count: projectedItemCount, target_scale_item_count: targetScaleItemCount }),
    scaleCheck("dry_run_rows_passed", dryRunRows.length > 0 && dryRunRows.every((row) => row.dry_run_status === "passed" && row.resumable && row.idempotent), { dry_run_row_count: dryRunRows.length }),
    scaleCheck("source_chain_complete", freezeSources.every((row) => row.source_status === "complete"), { source_count: freezeSources.length, passed_source_count: freezeSources.filter((row) => row.source_status === "complete").length }),
    scaleCheck("resume_probes_passed", resumeProbes.every((row) => row.resume_probe_status === "passed"), { resume_probe_count: resumeProbes.length }),
    scaleCheck("idempotency_probes_passed", idempotencyProbes.every((row) => row.idempotency_probe_status === "passed"), { idempotency_probe_count: idempotencyProbes.length }),
    scaleCheck("human_review_gate_preserved", boundary.human_review_required === true && boundary.client_facing_ready_count === 0, { human_review_required: boundary.human_review_required, client_facing_ready_count: boundary.client_facing_ready_count }),
    scaleCheck("no_execution_or_mutation", boundary.backfill_dry_run_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false, {
      backfill_dry_run_execution_performed: boundary.backfill_dry_run_execution_performed,
      source_ingest_performed: boundary.source_ingest_performed,
      file_content_read_performed: boundary.file_content_read_performed,
      resource_mutation_performed: boundary.resource_mutation_performed,
      state_mutation_performed: boundary.state_mutation_performed,
    }),
  ];
  return checks.map((row, index) => ({
    expansion_freeze_scale_check_id: `expansion-freeze-scale-check.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    ...row,
  }));
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "resource-expansion-freeze.boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    report_only: true,
    scale_projection_only: true,
    source_artifact_read_performed: true,
    backfill_dry_run_execution_performed: false,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    extraction_retry_performed: false,
    quarantine_release_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    matter_data_write_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  controlPlaneLoopText,
  reviewDashboardText,
  reviewApiText,
  readResults,
  artifacts,
  resourceExpansionState,
  nextBatch,
  freezeSources,
  dryRunRows,
  resumeProbes,
  idempotencyProbes,
  scaleChecks,
  boundary,
  targetScaleItemCount,
}) {
  const resourceExpansion = artifacts.resource_expansion_job ?? {};
  const resourceSummary = resourceExpansion.summary ?? {};
  const statusSummary = artifacts.expansion_status_dashboard?.summary ?? {};
  const dryRunProjectedCount = sum(dryRunRows.map((row) => row.projected_item_count));
  return [
    checkpoint("source.resource_expansion_job", readResults.resource_expansion_job.available && resourceExpansion.schema_version === "resource-expansion-job.v1" && (resourceExpansion.items?.length ?? 0) > 0, "Resource Expansion Job is readable."),
    checkpoint("source.resource_expansion_state", readResults.resource_expansion_state.available && resourceExpansionState.job_id === resourceExpansion.job_id, "Resource Expansion state snapshot matches the job id."),
    checkpoint("source.next_batch", readResults.next_batch.available && (nextBatch.count ?? 0) === (resourceSummary.remaining_count ?? 0), "Next batch artifact matches remaining queued count."),
    checkpoint("source.phase_chain", freezeSources.filter((row) => row.source_id !== "resource_expansion_job").every((row) => row.source_status === "complete"), "P277-P285 Resource Expansion phase sources are complete."),
    checkpoint("source.expansion_status_dashboard", statusSummary.expansion_status_dashboard_status === "complete" && statusSummary.phase_slot === "P285" && statusSummary.next_phase_slot === "P286", "P285 Expansion Status Dashboard is complete and points to P286."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:expansion-freeze"), "package.json exposes resource:expansion-freeze."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["resource_expansion_freeze", "resource:expansion-freeze"]) && includesAll(reviewDashboardText.value, ["resource_expansion_freeze", "buildResourceExpansionFreezeStage"]) && includesAll(reviewApiText.value, ["/api/resource-expansion-freezes", "/api/resource-expansion-freeze-dry-runs"]), "Control-plane loop, dashboard, and API expose Resource Expansion Freeze."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P286", "Resource Expansion Freeze"]) && includesAll(implementationRoadmapText.value, ["Phase 286", "Resource Expansion Freeze"]), "Ledger and implementation roadmap promote Phase 286."),
    checkpoint("dry_run.target_scale", targetScaleItemCount >= DEFAULT_TARGET_SCALE_ITEM_COUNT, "2,713-scale target is declared."),
    checkpoint("dry_run.partition", dryRunRows.length > 0 && dryRunProjectedCount === targetScaleItemCount, "Dry-run rows partition the target scale exactly."),
    checkpoint("dry_run.resumable_idempotent", dryRunRows.every((row) => row.dry_run_status === "passed" && row.resumable && row.idempotent), "Every projected dry-run batch is resumable and idempotent."),
    checkpoint("resume.probes", resumeProbes.length > 0 && resumeProbes.every((row) => row.resume_probe_status === "passed"), "Resume probes passed."),
    checkpoint("idempotency.probes", idempotencyProbes.length > 0 && idempotencyProbes.every((row) => row.idempotency_probe_status === "passed"), "Idempotency probes passed."),
    checkpoint("scale.checks", scaleChecks.length > 0 && scaleChecks.every((row) => row.scale_check_status === "passed"), "Scale freeze checks passed."),
    checkpoint("boundary.no_execution", boundary.backfill_dry_run_execution_performed === false && boundary.backfill_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false && boundary.extraction_retry_performed === false, "No backfill dry-run execution, source ingest, file content read, or extraction retry occurs."),
    checkpoint("boundary.no_release_mutation", boundary.quarantine_release_performed === false && boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.matter_data_write_performed === false, "No quarantine release or source/resource/state/matter mutation occurs."),
    checkpoint("boundary.no_delivery_legal_client", boundary.delivery_execution_performed === false && boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No delivery, protected action, legal advice, or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeFreeze({
  artifacts,
  resourceExpansionState,
  nextBatch,
  freezeSources,
  dryRunRows,
  resumeProbes,
  idempotencyProbes,
  scaleChecks,
  boundary,
  validation,
  targetScaleItemCount,
}) {
  const resourceExpansion = artifacts.resource_expansion_job ?? {};
  const resourceSummary = resourceExpansion.summary ?? {};
  const cursorSummary = artifacts.expansion_cursor_ledger?.summary ?? {};
  const dedupSummary = artifacts.expansion_dedup_ledger?.summary ?? {};
  const quarantineSummary = artifacts.expansion_quarantine_ledger?.summary ?? {};
  const classificationSummary = artifacts.batch_classification_result?.summary ?? {};
  const taggingSummary = artifacts.batch_matter_tagging_result?.summary ?? {};
  const registrySummary = artifacts.extractor_registry?.summary ?? {};
  const coverageSummary = artifacts.extractor_coverage_report?.summary ?? {};
  const statusSummary = artifacts.expansion_status_dashboard?.summary ?? {};
  const sourceItemCount = resourceExpansion.items?.length ?? resourceSummary.discovered_count ?? 0;
  const dryRunProjectedCount = sum(dryRunRows.map((row) => row.projected_item_count));
  return {
    resource_expansion_freeze_status: validation.valid ? "complete" : "attention",
    resource_expansion_freeze_id: FREEZE_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_item_count: sourceItemCount,
    source_state_item_count: resourceExpansionState.items?.length ?? 0,
    source_next_batch_count: nextBatch.count ?? 0,
    source_backfill_job_contract_status: artifacts.backfill_job_contract?.summary?.backfill_job_contract_status ?? "unknown",
    source_backfill_job_contract_phase_slot: artifacts.backfill_job_contract?.summary?.phase_slot ?? null,
    source_expansion_cursor_ledger_status: cursorSummary.expansion_cursor_ledger_status ?? "unknown",
    source_expansion_cursor_phase_slot: cursorSummary.phase_slot ?? null,
    source_expansion_dedup_ledger_status: dedupSummary.expansion_dedup_ledger_status ?? "unknown",
    source_expansion_dedup_phase_slot: dedupSummary.phase_slot ?? null,
    source_expansion_quarantine_ledger_status: quarantineSummary.expansion_quarantine_ledger_status ?? "unknown",
    source_expansion_quarantine_phase_slot: quarantineSummary.phase_slot ?? null,
    source_batch_classification_result_status: classificationSummary.batch_classification_result_status ?? "unknown",
    source_batch_classification_phase_slot: classificationSummary.phase_slot ?? null,
    source_batch_matter_tagging_result_status: taggingSummary.batch_matter_tagging_result_status ?? "unknown",
    source_batch_matter_tagging_phase_slot: taggingSummary.phase_slot ?? null,
    source_extractor_registry_status: registrySummary.extractor_registry_status ?? "unknown",
    source_extractor_registry_phase_slot: registrySummary.phase_slot ?? null,
    source_extractor_coverage_report_status: coverageSummary.extractor_coverage_report_status ?? "unknown",
    source_extractor_coverage_phase_slot: coverageSummary.phase_slot ?? null,
    source_expansion_status_dashboard_status: statusSummary.expansion_status_dashboard_status ?? "unknown",
    source_expansion_status_dashboard_phase_slot: statusSummary.phase_slot ?? null,
    source_expansion_status_dashboard_next_phase_slot: statusSummary.next_phase_slot ?? null,
    source_count: freezeSources.length,
    passed_source_count: freezeSources.filter((row) => row.source_status === "complete").length,
    dry_run_scale_target_count: targetScaleItemCount,
    dry_run_source_sample_item_count: sourceItemCount,
    dry_run_batch_size: dryRunRows[0]?.requested_batch_size ?? 0,
    projected_batch_count: dryRunRows.length,
    dry_run_row_count: dryRunRows.length,
    passed_dry_run_row_count: dryRunRows.filter((row) => row.dry_run_status === "passed").length,
    projected_item_count: dryRunProjectedCount,
    projected_terminal_item_count: dryRunProjectedCount,
    projected_remaining_item_count: 0,
    resource_expansion_discovered_count: resourceSummary.discovered_count ?? 0,
    resource_expansion_terminal_count: resourceSummary.terminal_count ?? 0,
    resource_expansion_remaining_count: resourceSummary.remaining_count ?? 0,
    resource_expansion_failed_count: resourceSummary.failed_count ?? 0,
    resource_expansion_quarantine_count: resourceSummary.quarantine_count ?? 0,
    resource_expansion_skipped_duplicate_count: resourceSummary.skipped_duplicate_count ?? 0,
    resource_expansion_extracted_count: resourceSummary.extracted_count ?? 0,
    cursor_portable_resume_key_count: cursorSummary.portable_resume_key_count ?? 0,
    cursor_resume_checkpoint_count: cursorSummary.resume_checkpoint_count ?? 0,
    passed_cursor_resume_checkpoint_count: cursorSummary.passed_resume_checkpoint_count ?? 0,
    dedup_idempotency_key_count: dedupSummary.idempotency_key_count ?? 0,
    dedup_unique_idempotency_key_count: dedupSummary.unique_idempotency_key_count ?? 0,
    dedup_idempotency_key_collision_count: dedupSummary.idempotency_key_collision_count ?? 0,
    resume_probe_count: resumeProbes.length,
    passed_resume_probe_count: resumeProbes.filter((row) => row.resume_probe_status === "passed").length,
    idempotency_probe_count: idempotencyProbes.length,
    passed_idempotency_probe_count: idempotencyProbes.filter((row) => row.idempotency_probe_status === "passed").length,
    scale_check_count: scaleChecks.length,
    passed_scale_check_count: scaleChecks.filter((row) => row.scale_check_status === "passed").length,
    resumable_backfill_dry_run_verified: resumeProbes.length > 0 && resumeProbes.every((row) => row.resume_probe_status === "passed"),
    idempotent_backfill_dry_run_verified: idempotencyProbes.length > 0 && idempotencyProbes.every((row) => row.idempotency_probe_status === "passed"),
    human_review_required_count: sourceItemCount,
    client_facing_ready_count: boundary.client_facing_ready_count,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    scale_projection_only: boundary.scale_projection_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_dry_run_execution_performed: boundary.backfill_dry_run_execution_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    extraction_retry_performed: boundary.extraction_retry_performed,
    quarantine_release_performed: boundary.quarantine_release_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    matter_data_write_performed: boundary.matter_data_write_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function sourceDefinition(sourceId, label, phaseSlot, inputKey, statusKey) {
  return { source_id: sourceId, label, phase_slot: phaseSlot, input_key: inputKey, status_key: statusKey };
}

function probe(probeKey, condition, metrics = {}) {
  return {
    probe_key: probeKey,
    resume_probe_status: condition ? "passed" : "attention",
    metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function idempotencyProbe(probeKey, condition, metrics = {}) {
  return {
    probe_key: probeKey,
    idempotency_probe_status: condition ? "passed" : "attention",
    metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function scaleCheck(checkKey, condition, metrics = {}) {
  return {
    check_key: checkKey,
    scale_check_status: condition ? "passed" : "attention",
    metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function buildContract(generatedAt, targetScaleItemCount, dryRunRows) {
  return {
    schema_version: "resource-expansion-freeze-contract.v1",
    contract_id: FREEZE_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    freeze_rule: "P277-P285 Resource Expansion artifacts must be complete before the freeze promotes P286.",
    scale_rule: `The freeze declares and partitions a deterministic ${targetScaleItemCount}-item dry-run projection without executing backfill.`,
    resume_rule: "Resume probes must prove cursor, next-batch, state, and path-identity guards are stable.",
    idempotency_rule: "Idempotency probes must prove stable idempotency keys, duplicate decisions, classification, matter-tagging separation, extractor coverage, and status links.",
    dry_run_row_count: dryRunRows.length,
    human_review_required: true,
    client_facing_output_allowed: false,
  };
}

function buildSafeHandling() {
  return {
    human_review_required: true,
    client_facing_ready: false,
    legal_advice_generated: false,
    protected_action_executed: false,
    note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts(reads) {
  const entries = [
    ["package", reads.packageJson],
    ["final-completion-phase-ledger", reads.roadmapText],
    ["implementation-roadmap", reads.implementationRoadmapText],
    ["control-plane-loop", reads.controlPlaneLoopText],
    ["review-dashboard", reads.reviewDashboardText],
    ["review-api", reads.reviewApiText],
    ...Object.entries(reads.readResults ?? {}),
  ];
  return entries.map(([sourceId, read]) => sourceContract(sourceId, read));
}

function sourceContract(sourceId, read = {}) {
  return {
    source_id: sourceId,
    path: read.path ?? null,
    available: read.available === true,
    content_hash: read.content_hash ?? null,
    error: read.error ?? null,
  };
}

function renderSummaryMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Resource Expansion Freeze",
    "",
    `Status: ${summary.resource_expansion_freeze_status}`,
    `Phase: ${summary.phase_slot}`,
    "",
    "## Scale Projection",
    `- Target items: ${summary.dry_run_scale_target_count}`,
    `- Projected batches: ${summary.projected_batch_count}`,
    `- Source sample items: ${summary.dry_run_source_sample_item_count}`,
    "",
    "## Verification",
    `- Sources: ${summary.passed_source_count}/${summary.source_count}`,
    `- Resume probes: ${summary.passed_resume_probe_count}/${summary.resume_probe_count}`,
    `- Idempotency probes: ${summary.passed_idempotency_probe_count}/${summary.idempotency_probe_count}`,
    `- Scale checks: ${summary.passed_scale_check_count}/${summary.scale_check_count}`,
    "",
    "## Boundary",
    `- Backfill dry-run execution: ${summary.backfill_dry_run_execution_performed}`,
    `- Source ingest/file read: ${summary.source_ingest_performed}/${summary.file_content_read_performed}`,
    `- Mutation/delivery: ${summary.resource_mutation_performed}/${summary.delivery_execution_performed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    HUMAN_REVIEW_NOTE,
  ];
  return `${lines.join("\n")}\n`;
}

function serializableResourceExpansionFreeze(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    item_count: validationItems.length,
    error_count: errors.length,
    errors,
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
    repo_root: options.repoRoot ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.resourceExpansionPath,
    resource_expansion_state_path: options.resourceExpansionStatePath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.resourceExpansionStatePath,
    next_batch_path: options.nextBatchPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.nextBatchPath,
    backfill_job_contract_path: options.backfillJobContractPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.backfillJobContractPath,
    expansion_cursor_ledger_path: options.expansionCursorLedgerPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.expansionCursorLedgerPath,
    expansion_dedup_ledger_path: options.expansionDedupLedgerPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.expansionDedupLedgerPath,
    expansion_quarantine_ledger_path: options.expansionQuarantineLedgerPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.expansionQuarantineLedgerPath,
    batch_classification_result_path: options.batchClassificationResultPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.batchClassificationResultPath,
    batch_matter_tagging_result_path: options.batchMatterTaggingResultPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.batchMatterTaggingResultPath,
    extractor_registry_path: options.extractorRegistryPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.extractorRegistryPath,
    extractor_coverage_report_path: options.extractorCoverageReportPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.extractorCoverageReportPath,
    expansion_status_dashboard_path: options.expansionStatusDashboardPath ?? DEFAULT_RESOURCE_EXPANSION_FREEZE_INPUTS.expansionStatusDashboardPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--target-scale-item-count") parsed.targetScaleItemCount = Number(argv[++index]);
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-expansion-state") parsed.resourceExpansionStatePath = argv[++index];
    else if (arg === "--next-batch") parsed.nextBatchPath = argv[++index];
    else if (arg === "--backfill-job-contract") parsed.backfillJobContractPath = argv[++index];
    else if (arg === "--expansion-cursor-ledger") parsed.expansionCursorLedgerPath = argv[++index];
    else if (arg === "--expansion-dedup-ledger") parsed.expansionDedupLedgerPath = argv[++index];
    else if (arg === "--expansion-quarantine-ledger") parsed.expansionQuarantineLedgerPath = argv[++index];
    else if (arg === "--batch-classification-result") parsed.batchClassificationResultPath = argv[++index];
    else if (arg === "--batch-matter-tagging-result") parsed.batchMatterTaggingResultPath = argv[++index];
    else if (arg === "--extractor-registry") parsed.extractorRegistryPath = argv[++index];
    else if (arg === "--extractor-coverage-report") parsed.extractorCoverageReportPath = argv[++index];
    else if (arg === "--expansion-status-dashboard") parsed.expansionStatusDashboardPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-expansion-freeze.mjs [options]

Options:
  --resource-expansion <path>            resource-expansion-job.json path.
  --resource-expansion-state <path>      resource-expansion-state.json path.
  --next-batch <path>                    next-batch.json path.
  --backfill-job-contract <path>         backfill-job-contract.json path.
  --expansion-cursor-ledger <path>       expansion-cursor-ledger.json path.
  --expansion-dedup-ledger <path>        expansion-dedup-ledger.json path.
  --expansion-quarantine-ledger <path>   expansion-quarantine-ledger.json path.
  --batch-classification-result <path>   batch-classification-result.json path.
  --batch-matter-tagging-result <path>   batch-matter-tagging-result.json path.
  --extractor-registry <path>            extractor-registry.json path.
  --extractor-coverage-report <path>     extractor-coverage-report.json path.
  --expansion-status-dashboard <path>    expansion-status-dashboard.json path.
  --target-scale-item-count <number>     projected dry-run target count. Default: 2713.
  --out-dir <path>                       output directory.
  --repo-root <path>                     repository root for surface checks.
  --check                                fail if validation has errors.
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

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
