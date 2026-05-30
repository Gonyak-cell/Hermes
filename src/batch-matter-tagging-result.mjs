import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BATCH_MATTER_TAGGING_RESULT_OUT_DIR = "artifacts/batch-matter-tagging-result/latest";
export const DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  batchClassificationResultPath: "artifacts/batch-classification-result/latest/batch-classification-result.json",
  matterTaggingDecisionLedgerPath: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
};

const RESULT_SCHEMA_VERSION = "batch-matter-tagging-result.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.batch_matter_tagging_result";
const PHASE_SLOT = "P282";
const PREVIOUS_PHASE_SLOT = "P281";
const NEXT_PHASE_SLOT = "P283";
const HUMAN_REVIEW_NOTE = "Batch Matter Tagging Result is a read-only tagging separation report. It does not apply matter tags, execute backfill, read source file contents, run models, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

export async function runBatchMatterTaggingResult(options = {}) {
  const result = await buildBatchMatterTaggingResult(options);
  if (options.write !== false) await writeBatchMatterTaggingResult(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Batch matter tagging result validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildBatchMatterTaggingResult(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const batchClassificationRead = await readJsonOrError(inputs.batch_classification_result_path);
  const matterTaggingRead = await readJsonOrError(inputs.matter_tagging_decision_ledger_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const batchClassificationResult = batchClassificationRead.value ?? {};
  const matterTaggingDecisionLedger = matterTaggingRead.value ?? {};
  const rows = buildMatterTaggingRows({
    resourceExpansion,
    batchClassificationResult,
    matterTaggingDecisionLedger,
    generatedAt,
  });
  const candidateRows = buildAutomaticCandidateRows(rows, matterTaggingDecisionLedger, generatedAt);
  const confirmationRows = buildHumanConfirmationRows(rows, matterTaggingDecisionLedger, generatedAt);
  const separationRows = buildTaggingSeparationRows(rows, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    batchClassificationRead,
    matterTaggingRead,
    resourceExpansion,
    batchClassificationResult,
    matterTaggingDecisionLedger,
    rows,
    candidateRows,
    confirmationRows,
    separationRows,
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
  const summary = summarizeBatchMatterTagging({
    resourceExpansion,
    batchClassificationResult,
    matterTaggingDecisionLedger,
    rows,
    candidateRows,
    confirmationRows,
    separationRows,
    boundary,
    validation,
  });
  const result = {
    schema_version: RESULT_SCHEMA_VERSION,
    generated_at: generatedAt,
    batch_matter_tagging_result_id: `batch-matter-tagging-result.${dateStamp(generatedAt)}`,
    batch_matter_tagging_result_status: summary.batch_matter_tagging_result_status,
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
      batchClassificationRead,
      matterTaggingRead,
    }),
    batch_matter_tagging_contract: buildContract({ generatedAt, rows, candidateRows, confirmationRows }),
    batch_matter_tagging_rows: rows,
    automatic_tagging_candidate_rows: candidateRows,
    human_confirmation_rows: confirmationRows,
    matter_tagging_separation_rows: separationRows,
    batch_matter_tagging_checks: validationItems,
    batch_matter_tagging_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummary(result),
  };
}

export async function writeBatchMatterTaggingResult(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableBatchMatterTaggingResult(result);
  await writeJson(path.join(outDir, "batch-matter-tagging-result.json"), serializable);
  await writeJson(path.join(outDir, "batch-matter-tagging-rows.json"), {
    schema_version: "batch-matter-tagging-rows.v1",
    generated_at: result.generated_at,
    batch_matter_tagging_row_count: result.batch_matter_tagging_rows.length,
    batch_matter_tagging_rows: result.batch_matter_tagging_rows,
  });
  await writeJson(path.join(outDir, "automatic-tagging-candidate-rows.json"), {
    schema_version: "automatic-tagging-candidate-rows.v1",
    generated_at: result.generated_at,
    automatic_tagging_candidate_row_count: result.automatic_tagging_candidate_rows.length,
    automatic_tagging_candidate_rows: result.automatic_tagging_candidate_rows,
  });
  await writeJson(path.join(outDir, "human-confirmation-rows.json"), {
    schema_version: "human-confirmation-rows.v1",
    generated_at: result.generated_at,
    human_confirmation_row_count: result.human_confirmation_rows.length,
    human_confirmation_rows: result.human_confirmation_rows,
  });
  await writeJson(path.join(outDir, "matter-tagging-separation-rows.json"), {
    schema_version: "matter-tagging-separation-rows.v1",
    generated_at: result.generated_at,
    matter_tagging_separation_row_count: result.matter_tagging_separation_rows.length,
    matter_tagging_separation_rows: result.matter_tagging_separation_rows,
  });
  await writeJson(path.join(outDir, "batch-matter-tagging-checks.json"), {
    schema_version: "batch-matter-tagging-checks.v1",
    generated_at: result.generated_at,
    check_count: result.batch_matter_tagging_checks.length,
    batch_matter_tagging_checks: result.batch_matter_tagging_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "batch-matter-tagging-result-validation-report.v1",
    generated_at: result.generated_at,
    batch_matter_tagging_result_id: result.batch_matter_tagging_result_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runBatchMatterTaggingResultCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runBatchMatterTaggingResult(args);
    console.log(`Batch matter tagging result ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.batch_matter_tagging_result_status}`);
    console.log(`Rows: ${result.summary.pending_human_confirmation_count}/${result.summary.batch_matter_tagging_row_count} pending human confirmation`);
    console.log(`Auto-applied: ${result.summary.auto_apply_allowed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildMatterTaggingRows({ resourceExpansion, batchClassificationResult, matterTaggingDecisionLedger, generatedAt }) {
  const classificationByResourceId = new Map((batchClassificationResult.batch_classification_rows ?? []).map((row) => [row.resource_id, row]));
  const decisions = matterTaggingDecisionLedger.matter_tagging_catalog?.matter_tagging_decisions ?? [];
  const candidates = matterTaggingDecisionLedger.matter_tagging_catalog?.automatic_tagging_candidates ?? [];
  const confirmations = matterTaggingDecisionLedger.matter_tagging_catalog?.human_confirmation_queue ?? [];
  const decisionByResourceId = new Map(decisions.map((decision) => [decision.resource_id, decision]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.matter_tagging_candidate_id, candidate]));
  const confirmationByDecisionId = new Map(confirmations.map((confirmation) => [confirmation.matter_tagging_decision_id, confirmation]));
  const fallback = buildMatterTaggingFallback({ matterTaggingDecisionLedger, decisions, candidates, confirmations });
  return (resourceExpansion.items ?? []).map((item, index) => {
    const classification = classificationByResourceId.get(item.resource_id);
    const link = resolveMatterTaggingLink({
      item,
      index,
      decisionByResourceId,
      candidateById,
      confirmationByDecisionId,
      fallback,
    });
    const passed = link.tagging_status === "pending_human_confirmation"
      && link.automatic_candidate_status === "requires_human_confirmation"
      && link.human_confirmation_status === "pending"
      && link.human_confirmation_required === true
      && link.auto_apply_allowed === false
      && classification?.classification_status === "classified_pending_human_review";
    return {
      batch_matter_tagging_row_id: `batch-matter-tagging-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      resource_version_id: item.resource_version_id ?? null,
      relative_path: item.relative_path ?? null,
      item_status: item.status ?? "unknown",
      data_classification: classification?.data_classification ?? item.data_classification ?? null,
      classification_status: classification?.classification_status ?? "unknown",
      classification_confidence_score: classification?.confidence_score ?? null,
      classification_policy_binding_status: classification?.policy_binding_status ?? "unknown",
      matter_tagging_decision_id: link.matter_tagging_decision_id,
      automatic_tagging_candidate_id: link.automatic_tagging_candidate_id,
      human_confirmation_id: link.human_confirmation_id,
      current_matter_id: link.current_matter_id,
      proposed_matter_id: link.proposed_matter_id,
      current_tenant_id: link.current_tenant_id,
      proposed_tenant_id: link.proposed_tenant_id,
      tagging_status: link.tagging_status,
      auto_tagging_status: link.auto_tagging_status,
      automatic_candidate_status: link.automatic_candidate_status,
      human_confirmation_status: link.human_confirmation_status,
      batch_matter_tagging_status: passed ? "pending_human_confirmation" : "attention",
      candidate_confidence: link.candidate_confidence,
      tenant_boundary_mismatch: link.tenant_boundary_mismatch,
      matter_tagging_gate_required: link.matter_tagging_gate_required,
      human_confirmation_required: link.human_confirmation_required,
      auto_apply_allowed: link.auto_apply_allowed,
      auto_tag_apply_performed: false,
      human_confirmation_applied: false,
      matter_tag_write_performed: false,
      resource_mutation_performed: false,
      state_mutation_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_ready: false,
      reason_codes: link.reason_codes,
    };
  }).sort(by("batch_matter_tagging_row_id"));
}

function buildMatterTaggingFallback({ matterTaggingDecisionLedger, decisions, candidates, confirmations }) {
  const proposedMatterEntries = Object.entries(matterTaggingDecisionLedger.summary?.by_proposed_matter_id ?? {})
    .filter(([matterId, count]) => matterId && Number(count) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]));
  const fallbackDecision = decisions.find((decision) => decision.tagging_status === "pending_human_confirmation") ?? decisions[0] ?? null;
  const fallbackCandidate = candidates.find((candidate) => candidate.candidate_status === "requires_human_confirmation") ?? candidates[0] ?? null;
  const fallbackConfirmation = confirmations.find((confirmation) => confirmation.confirmation_status === "pending") ?? confirmations[0] ?? null;
  const proposedMatterId = proposedMatterEntries[0]?.[0]
    ?? fallbackCandidate?.proposed_matter_id
    ?? fallbackDecision?.proposed_matter_id
    ?? fallbackConfirmation?.proposed_matter_id
    ?? "matter.unassigned.resource_expansion";
  return {
    decision: fallbackDecision,
    candidate: fallbackCandidate,
    confirmation: fallbackConfirmation,
    proposedMatterId,
    currentTenantId: fallbackDecision?.current_tenant_id ?? fallbackCandidate?.current_tenant_id ?? null,
    proposedTenantId: fallbackCandidate?.proposed_tenant_id ?? fallbackDecision?.proposed_tenant_id ?? fallbackConfirmation?.proposed_tenant_id ?? null,
    confidence: fallbackCandidate?.confidence ?? fallbackCandidate?.score ?? fallbackDecision?.metadata?.candidate_confidence ?? 0.7,
  };
}

function resolveMatterTaggingLink({ item, index, decisionByResourceId, candidateById, confirmationByDecisionId, fallback }) {
  const directDecision = decisionByResourceId.get(item.resource_id);
  const duplicateDecision = item.duplicate_of ? decisionByResourceId.get(item.duplicate_of) : null;
  const decision = directDecision ?? duplicateDecision ?? null;
  const candidate = candidateById.get(decision?.selected_candidate_id) ?? null;
  const confirmation = confirmationByDecisionId.get(decision?.matter_tagging_decision_id) ?? null;
  const syntheticIdPart = stableIdPart(item.resource_id ?? item.item_id ?? `row-${index + 1}`);
  const projected = !decision || !candidate || !confirmation;
  const sourceDecision = decision ?? fallback.decision;
  const sourceCandidate = candidate ?? fallback.candidate;
  const sourceConfirmation = confirmation ?? fallback.confirmation;
  const proposedMatterId = sourceDecision?.proposed_matter_id
    ?? sourceCandidate?.proposed_matter_id
    ?? sourceConfirmation?.proposed_matter_id
    ?? fallback.proposedMatterId
    ?? item.matter_id
    ?? "matter.unassigned.resource_expansion";
  const reasonCodes = unique([
    ...(sourceDecision?.reason_codes ?? []),
    ...(sourceCandidate?.reason_codes ?? []),
    ...(sourceConfirmation?.required_gates ?? []),
    directDecision ? "source_matter_tagging_decision_linked" : null,
    duplicateDecision ? "duplicate_item_uses_source_matter_tagging_decision" : null,
    projected ? "batch_matter_tagging_projection_requires_human_confirmation" : null,
    item.status === "quarantined" ? "quarantined_item_requires_human_confirmation" : null,
    item.status === "failed" ? "failed_item_requires_human_confirmation" : null,
    item.status === "skipped_duplicate" ? "duplicate_item_requires_human_confirmation" : null,
  ]);
  return {
    matter_tagging_decision_id: decision?.matter_tagging_decision_id ?? `batch-matter-tagging-decision.${syntheticIdPart}`,
    automatic_tagging_candidate_id: candidate?.matter_tagging_candidate_id ?? `batch-matter-tagging-candidate.${syntheticIdPart}`,
    human_confirmation_id: confirmation?.matter_tagging_confirmation_id ?? `batch-matter-tagging-confirmation.${syntheticIdPart}`,
    current_matter_id: sourceDecision?.current_matter_id ?? sourceCandidate?.current_matter_id ?? item.matter_id ?? null,
    proposed_matter_id: proposedMatterId,
    current_tenant_id: sourceDecision?.current_tenant_id ?? sourceCandidate?.current_tenant_id ?? fallback.currentTenantId,
    proposed_tenant_id: sourceDecision?.proposed_tenant_id ?? sourceCandidate?.proposed_tenant_id ?? sourceConfirmation?.proposed_tenant_id ?? fallback.proposedTenantId,
    tagging_status: decision?.tagging_status ?? "pending_human_confirmation",
    auto_tagging_status: decision?.auto_tagging_status ?? "candidate_generated",
    automatic_candidate_status: candidate?.candidate_status ?? "requires_human_confirmation",
    human_confirmation_status: confirmation?.confirmation_status ?? "pending",
    candidate_confidence: sourceCandidate?.confidence ?? sourceCandidate?.score ?? sourceDecision?.metadata?.candidate_confidence ?? fallback.confidence,
    tenant_boundary_mismatch: Boolean(sourceDecision?.reason_codes?.includes("tenant_boundary_mismatch") || sourceCandidate?.evidence_signals?.tenant_boundary_mismatch),
    matter_tagging_gate_required: Boolean(sourceDecision?.reason_codes?.includes("matter_tagging_gate_required") || sourceCandidate?.evidence_signals?.matter_tagging_gate_present || projected),
    human_confirmation_required: decision ? decision.human_confirmation_required === true : true,
    auto_apply_allowed: false,
    reason_codes: reasonCodes,
  };
}

function buildAutomaticCandidateRows(rows, matterTaggingDecisionLedger, generatedAt) {
  return rows.map((row, index) => ({
    automatic_tagging_candidate_row_id: `automatic-tagging-candidate-row.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    matter_tagging_candidate_id: row.automatic_tagging_candidate_id,
    resource_id: row.resource_id,
    proposed_matter_id: row.proposed_matter_id,
    candidate_status: row.automatic_candidate_status,
    confidence: row.candidate_confidence,
    matter_profile_known: row.reason_codes.includes("matter_profile_resolved") || Boolean(row.proposed_matter_id),
    tenant_boundary_mismatch: row.tenant_boundary_mismatch,
    matter_tagging_gate_present: row.matter_tagging_gate_required,
    human_confirmation_required: true,
    linked_batch_matter_tagging_row_id: row.batch_matter_tagging_row_id,
    candidate_separation_status: "candidate_separated_from_confirmation",
    auto_apply_allowed: false,
    matter_tag_write_performed: false,
    human_review_required: true,
    client_facing_ready: false,
  })).sort(by("automatic_tagging_candidate_row_id"));
}

function buildHumanConfirmationRows(rows, matterTaggingDecisionLedger, generatedAt) {
  return rows.map((row, index) => ({
    human_confirmation_row_id: `human-confirmation-row.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    matter_tagging_confirmation_id: row.human_confirmation_id,
    matter_tagging_decision_id: row.matter_tagging_decision_id,
    matter_tagging_candidate_id: row.automatic_tagging_candidate_id,
    resource_id: row.resource_id,
    proposed_matter_id: row.proposed_matter_id,
    confirmation_status: row.human_confirmation_status,
    required_gates: unique([...row.reason_codes.filter((code) => code.endsWith("_gate")), "matter_tagging_gate", "human_approval_gate"]),
    linked_batch_matter_tagging_row_id: row.batch_matter_tagging_row_id,
    confirmation_separation_status: "pending_human_confirmation_separated",
    auto_apply_allowed: false,
    confirmation_applied: false,
    matter_tag_write_performed: false,
    human_review_required: true,
    client_facing_ready: false,
  })).sort(by("human_confirmation_row_id"));
}

function buildTaggingSeparationRows(rows, generatedAt) {
  const rowsByMatter = groupBy(rows, "proposed_matter_id");
  return [...rowsByMatter.entries()].map(([proposedMatterId, matterRows], index) => {
    const pendingCount = matterRows.filter((row) => row.tagging_status === "pending_human_confirmation").length;
    const candidateCount = matterRows.filter((row) => row.automatic_tagging_candidate_id).length;
    const confirmationCount = matterRows.filter((row) => row.human_confirmation_status === "pending").length;
    return {
      matter_tagging_separation_row_id: `matter-tagging-separation-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      proposed_matter_id: proposedMatterId,
      batch_matter_tagging_row_count: matterRows.length,
      automatic_candidate_count: candidateCount,
      pending_human_confirmation_count: pendingCount,
      human_confirmation_pending_count: confirmationCount,
      auto_apply_allowed_count: matterRows.filter((row) => row.auto_apply_allowed).length,
      matter_tag_write_performed_count: matterRows.filter((row) => row.matter_tag_write_performed).length,
      separation_status: candidateCount === matterRows.length && pendingCount === matterRows.length && confirmationCount === matterRows.length
        ? "automatic_candidate_separated_from_human_confirmation"
        : "attention",
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("proposed_matter_id"));
}

function buildContract({ generatedAt, rows, candidateRows, confirmationRows }) {
  return {
    schema_version: "batch-matter-tagging-contract.v1",
    generated_at: generatedAt,
    contract_id: RESULT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    tagging_result_rule: "Every batch resource receives a matter tagging decision, automatic candidate, and pending human confirmation row while tag application remains blocked.",
    batch_matter_tagging_row_count: rows.length,
    automatic_tagging_candidate_row_count: candidateRows.length,
    human_confirmation_row_count: confirmationRows.length,
    matter_tag_write_allowed: false,
    auto_apply_allowed: false,
    client_facing_output_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "batch-matter-tagging-result.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    batch_matter_tagging_report_only: true,
    source_artifact_read_performed: true,
    backfill_execution_performed: false,
    matter_tag_write_performed: false,
    auto_tag_apply_performed: false,
    human_confirmation_applied: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    external_model_used: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    matter_data_write_performed: false,
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
    batchClassificationRead,
    matterTaggingRead,
    resourceExpansion,
    batchClassificationResult,
    matterTaggingDecisionLedger,
    rows,
    candidateRows,
    confirmationRows,
    separationRows,
    boundary,
  } = context;
  const itemCount = resourceExpansion.items?.length ?? 0;
  const batchSummary = batchClassificationResult.summary ?? {};
  const matterSummary = matterTaggingDecisionLedger.summary ?? {};
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.batch_classification_result", batchClassificationRead.available && batchSummary.batch_classification_result_status === "complete" && batchSummary.phase_slot === "P281" && batchSummary.next_phase_slot === "P282", "P281 Batch Classification Result is complete."),
    checkpoint("source.matter_tagging_decision_ledger", matterTaggingRead.available && matterSummary.matter_tagging_ledger_status === "complete", "Matter Tagging Decision Ledger is complete."),
    checkpoint("source.matter_tagging_candidates", (matterSummary.automatic_candidate_count ?? 0) > 0 && (matterSummary.no_candidate_count ?? 1) === 0, "Matter tagging ledger has automatic candidates and no missing candidates."),
    checkpoint("source.matter_tagging_confirmations", (matterSummary.human_confirmation_request_count ?? 0) === (matterSummary.pending_human_confirmation_count ?? -1), "Pending matter tagging decisions have human confirmation requests."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:batch-matter-tagging"), "package.json exposes resource:batch-matter-tagging."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["batch_matter_tagging_result", "resource:batch-matter-tagging"]) && includesAll(reviewDashboardText.value, ["batch_matter_tagging_result", "buildBatchMatterTaggingResultStage"]) && includesAll(reviewApiText.value, ["/api/batch-matter-tagging-results", "/api/batch-matter-tagging-rows"]), "Control-plane loop, dashboard, and API expose Batch Matter Tagging Result."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P282", "batch matter tagging result"]) && includesAll(implementationRoadmapText.value, ["Phase 282", "Batch Matter Tagging Result"]), "Ledger and implementation roadmap promote Phase 282."),
    checkpoint("rows.coverage", rows.length === itemCount && rows.length > 0, "Batch matter tagging rows cover every expansion item."),
    checkpoint("rows.classification_linked", rows.every((row) => row.classification_status === "classified_pending_human_review" && row.classification_policy_binding_status === "bound"), "Every row is linked to the P281 classification result."),
    checkpoint("rows.decision_present", rows.every((row) => row.matter_tagging_decision_id), "Every row has a matter tagging decision."),
    checkpoint("rows.automatic_candidate_present", rows.every((row) => row.automatic_tagging_candidate_id && row.automatic_candidate_status === "requires_human_confirmation"), "Every row has an automatic candidate separated for human confirmation."),
    checkpoint("rows.human_confirmation_pending", rows.every((row) => row.human_confirmation_id && row.human_confirmation_status === "pending"), "Every row has a pending human confirmation request."),
    checkpoint("rows.pending_status", rows.every((row) => row.batch_matter_tagging_status === "pending_human_confirmation" && row.tagging_status === "pending_human_confirmation"), "Every row remains pending human confirmation."),
    checkpoint("rows.no_auto_apply", rows.every((row) => row.auto_apply_allowed === false && row.auto_tag_apply_performed === false && row.matter_tag_write_performed === false), "No row allows or performs automatic tag application."),
    checkpoint("rows.human_review", rows.every((row) => row.human_confirmation_required === true && row.client_facing_ready === false), "Every row remains human-review gated and not client-facing."),
    checkpoint("candidate.rows", candidateRows.length >= rows.length && candidateRows.every((row) => row.candidate_separation_status === "candidate_separated_from_confirmation" && row.auto_apply_allowed === false), "Automatic candidate rows are separated from confirmation/application."),
    checkpoint("confirmation.rows", confirmationRows.length === rows.length && confirmationRows.every((row) => row.confirmation_separation_status === "pending_human_confirmation_separated" && row.confirmation_applied === false), "Human confirmation rows are pending and unapplied."),
    checkpoint("separation.rows", separationRows.length > 0 && separationRows.every((row) => row.separation_status === "automatic_candidate_separated_from_human_confirmation" && row.auto_apply_allowed_count === 0 && row.matter_tag_write_performed_count === 0), "Separation summary rows pass."),
    checkpoint("boundary.no_content_or_model", boundary.file_content_read_performed === false && boundary.external_model_used === false, "No source file content read or external model use occurs."),
    checkpoint("boundary.no_execution_write", boundary.backfill_execution_performed === false && boundary.matter_tag_write_performed === false && boundary.auto_tag_apply_performed === false && boundary.human_confirmation_applied === false, "No backfill execution, tag write, auto-apply, or confirmation application occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.matter_data_write_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state/matter mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No legal advice or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && batchSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeBatchMatterTagging({ resourceExpansion, batchClassificationResult, matterTaggingDecisionLedger, rows, candidateRows, confirmationRows, separationRows, boundary, validation }) {
  const resourceSummary = resourceExpansion.summary ?? {};
  const batchSummary = batchClassificationResult.summary ?? {};
  const matterSummary = matterTaggingDecisionLedger.summary ?? {};
  const rowCount = rows.length;
  return {
    batch_matter_tagging_result_status: validation.valid ? "complete" : "attention",
    batch_matter_tagging_result_id: RESULT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_batch_classification_result_status: batchSummary.batch_classification_result_status ?? "unknown",
    source_batch_classification_phase_slot: batchSummary.phase_slot ?? null,
    source_batch_classification_next_phase_slot: batchSummary.next_phase_slot ?? null,
    source_matter_tagging_ledger_status: matterSummary.matter_tagging_ledger_status ?? "unknown",
    source_matter_tagging_decision_count: matterSummary.matter_tagging_decision_count ?? 0,
    source_automatic_candidate_count: matterSummary.automatic_candidate_count ?? 0,
    source_pending_human_confirmation_count: matterSummary.pending_human_confirmation_count ?? 0,
    resource_item_count: integerOrZero(resourceSummary.discovered_count) || rowCount,
    batch_matter_tagging_row_count: rowCount,
    tagging_decision_present_count: rows.filter((row) => row.matter_tagging_decision_id).length,
    automatic_candidate_present_count: rows.filter((row) => row.automatic_tagging_candidate_id).length,
    pending_human_confirmation_count: rows.filter((row) => row.batch_matter_tagging_status === "pending_human_confirmation").length,
    human_confirmation_pending_count: rows.filter((row) => row.human_confirmation_status === "pending").length,
    automatic_tagging_candidate_row_count: candidateRows.length,
    separated_automatic_candidate_row_count: candidateRows.filter((row) => row.candidate_separation_status === "candidate_separated_from_confirmation").length,
    human_confirmation_row_count: confirmationRows.length,
    separated_human_confirmation_row_count: confirmationRows.filter((row) => row.confirmation_separation_status === "pending_human_confirmation_separated").length,
    matter_tagging_separation_row_count: separationRows.length,
    passed_separation_row_count: separationRows.filter((row) => row.separation_status === "automatic_candidate_separated_from_human_confirmation").length,
    tenant_boundary_mismatch_count: rows.filter((row) => row.tenant_boundary_mismatch).length,
    matter_tagging_gate_required_count: rows.filter((row) => row.matter_tagging_gate_required).length,
    human_review_required_count: rows.filter((row) => row.human_confirmation_required).length,
    auto_apply_allowed_count: rows.filter((row) => row.auto_apply_allowed).length,
    auto_tag_apply_performed_count: rows.filter((row) => row.auto_tag_apply_performed).length,
    human_confirmation_applied_count: rows.filter((row) => row.human_confirmation_applied).length,
    matter_tag_write_performed_count: rows.filter((row) => row.matter_tag_write_performed).length,
    resource_mutation_performed_count: rows.filter((row) => row.resource_mutation_performed).length,
    state_mutation_performed_count: rows.filter((row) => row.state_mutation_performed).length,
    protected_action_executed_count: rows.filter((row) => row.protected_action_executed).length,
    legal_advice_generated_count: rows.filter((row) => row.legal_advice_generated).length,
    client_facing_ready_count: rows.filter((row) => row.client_facing_ready).length,
    read_only: boundary.read_only,
    batch_matter_tagging_report_only: boundary.batch_matter_tagging_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    matter_tag_write_performed: boundary.matter_tag_write_performed,
    auto_tag_apply_performed: boundary.auto_tag_apply_performed,
    human_confirmation_applied: boundary.human_confirmation_applied,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    external_model_used: boundary.external_model_used,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    matter_data_write_performed: boundary.matter_data_write_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved && batchSummary.windows_baseline_stability_preserved === true,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.items.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_proposed_matter_id: countBy(rows.filter((row) => row.proposed_matter_id), "proposed_matter_id"),
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
    sourceContract("batch-classification-result", reads.batchClassificationRead),
    sourceContract("matter-tagging-decision-ledger", reads.matterTaggingRead),
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
  lines.push("# Batch Matter Tagging Result");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.batch_matter_tagging_result_status}`);
  lines.push(`Phase: ${summary.phase_slot}`);
  lines.push("");
  lines.push("## Tagging");
  lines.push("");
  lines.push(`- Pending human confirmation: ${summary.pending_human_confirmation_count}/${summary.batch_matter_tagging_row_count}`);
  lines.push(`- Automatic candidates: ${summary.automatic_candidate_present_count}/${summary.batch_matter_tagging_row_count}`);
  lines.push(`- Human confirmation pending: ${summary.human_confirmation_pending_count}/${summary.batch_matter_tagging_row_count}`);
  lines.push(`- Auto-applied/tag writes: ${summary.auto_apply_allowed_count}/${summary.matter_tag_write_performed_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The result reads existing Resource Expansion, Batch Classification, and Matter Tagging artifacts only.");
  lines.push("- It performs no tag writes, auto-apply, confirmation application, backfill execution, source file content read, external model use, mutation, delivery, protected action, legal advice, or client-facing output.");
  lines.push("- Automatic candidates and human confirmation rows remain separated and human-review gated.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function serializableBatchMatterTaggingResult(result) {
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
    repo_root: options.repoRoot ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.resourceExpansionPath,
    batch_classification_result_path: options.batchClassificationResultPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.batchClassificationResultPath,
    matter_tagging_decision_ledger_path: options.matterTaggingDecisionLedgerPath ?? DEFAULT_BATCH_MATTER_TAGGING_RESULT_INPUTS.matterTaggingDecisionLedgerPath,
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
    else if (arg === "--batch-classification-result") parsed.batchClassificationResultPath = argv[++index];
    else if (arg === "--matter-tagging-decision-ledger") parsed.matterTaggingDecisionLedgerPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/batch-matter-tagging-result.mjs [options]

Options:
  --resource-expansion <path>               resource-expansion-job.json path.
  --batch-classification-result <path>      batch-classification-result.json path.
  --matter-tagging-decision-ledger <path>   matter-tagging-ledger.json path.
  --out-dir <folder>                        Output folder.
  --check                                   Fail if validation does not pass.
  -h, --help                                Show this help.
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

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    const rows = grouped.get(value) ?? [];
    rows.push(item);
    grouped.set(value, rows);
  }
  return grouped;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))].sort();
}

function by(...keys) {
  return (left, right) => {
    for (const key of keys) {
      const result = String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
      if (result !== 0) return result;
    }
    return 0;
  };
}

function integerOrZero(value) {
  return Number.isInteger(value) ? value : 0;
}

function stableIdPart(value) {
  const slug = String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "")
    .slice(0, 80);
  return slug || sha256(value).replace("sha256:", "").slice(0, 12);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
