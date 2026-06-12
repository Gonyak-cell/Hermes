import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryFeFreezeHandoff } from "./factory-fe-freeze-handoff.mjs";
import { buildFactoryG1aOpeningCloseoutReadiness } from "./factory-g1a-opening-closeout-readiness.mjs";
import { buildFactoryG1aOwnerCandidateSelectionDocket } from "./factory-g1a-owner-candidate-selection-docket.mjs";
import { buildFactoryG1aOwnerSigningHandoff } from "./factory-g1a-owner-signing-handoff.mjs";
import { buildFactoryG1aSourceLiteralCommitDraft } from "./factory-g1a-source-literal-commit-draft.mjs";

export const DEFAULT_FACTORY_PROMOTION_CLOSEOUT_READINESS_OUT_DIR = "artifacts/factory-promotion-closeout-readiness/latest";
export const DEFAULT_FACTORY_PROMOTION_CLOSEOUT_READINESS_INPUTS = {
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:promotion-closeout-readiness";
const SCHEMA_VERSION = "factory-promotion-closeout-readiness.v1";
const CAPABILITY_ID = "factory.promotion_closeout_readiness";
const PROGRAM_RANGE = "FCORE-F0-FE.plus-G-SERIES.1a";
const READY_STATUS = "ready_for_human_owner_protected_closeout";
const WAITING_G1A_STATUS = "waiting_for_g1a_owner_gate_opening_chain";
const BLOCKED_STATUS = "blocked_factory_promotion_closeout_readiness";

const FCORE_PHASE_KEYS = [
  "fa1", "fa2", "fa3", "fa4", "fa5", "fa6",
  "fb1", "fb2", "fb3", "fb4", "fb5",
  "fc1", "fc2", "fc3", "fc4", "fc5",
  "fd1", "fd2", "fd3", "fd4", "fd5",
  "fe1", "fe2", "fe3", "fe4",
];

const REVIEW_PHASE_KEYS = [
  "fa6",
  "fb1", "fb2", "fb3", "fb4", "fb5",
  "fc1", "fc2", "fc3", "fc4", "fc5",
  "fd1", "fd2", "fd3", "fd4", "fd5",
  "fe1", "fe2", "fe3", "fe4",
];

const CLOSED_AUTHORITY_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "command_execution_enabled",
  "command_execution_allowed_now",
  "work_packet_execution_allowed_now",
  "work_item_execution_allowed_now",
  "validation_loop_execution_allowed_now",
  "worker_execution_allowed_now",
  "verifier_finality_allowed_now",
  "codex_final_approval_allowed_now",
  "claude_final_approval_allowed_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "gate_opening_allowed_now",
  "g1a_project_creation_gate_open_now",
  "g1b_repo_write_gate_open_now",
  "g2_command_execution_gate_open_now",
  "g3_deployment_gate_open_now",
  "factory_promotion_goal_complete_allowed_now",
];

export async function runFactoryPromotionCloseoutReadiness(options = {}) {
  const result = await buildFactoryPromotionCloseoutReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryPromotionCloseoutReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Promotion Closeout Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_promotion_closeout_readiness_status !== READY_STATUS) {
    const error = new Error("Factory Promotion Closeout Readiness is not ready for protected owner closeout.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryPromotionCloseoutReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_PROMOTION_CLOSEOUT_READINESS_OUT_DIR);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const inputs = normalizeInputs(options, repoRoot);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(repoRoot);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const sharedOptions = { ...options, repoRoot, runAt: generatedAt, commitRef, write: false };
  const feFreezeHandoff = Object.prototype.hasOwnProperty.call(options, "feFreezeHandoff")
    ? options.feFreezeHandoff
    : await buildFactoryFeFreezeHandoff({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-fe-freeze-handoff"),
    });
  const g1aCandidateSelectionDocket = Object.prototype.hasOwnProperty.call(options, "g1aCandidateSelectionDocket")
    ? options.g1aCandidateSelectionDocket
    : await buildFactoryG1aOwnerCandidateSelectionDocket({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-g1a-owner-candidate-selection-docket"),
    });
  const g1aOwnerSigningHandoff = Object.prototype.hasOwnProperty.call(options, "g1aOwnerSigningHandoff")
    ? options.g1aOwnerSigningHandoff
    : await buildFactoryG1aOwnerSigningHandoff({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-g1a-owner-signing-handoff"),
    });
  const g1aSourceLiteralCommitDraft = Object.prototype.hasOwnProperty.call(options, "g1aSourceLiteralCommitDraft")
    ? options.g1aSourceLiteralCommitDraft
    : await buildFactoryG1aSourceLiteralCommitDraft({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-g1a-source-literal-commit-draft"),
    });
  const g1aOpeningCloseoutReadiness = Object.prototype.hasOwnProperty.call(options, "g1aOpeningCloseoutReadiness")
    ? options.g1aOpeningCloseoutReadiness
    : await buildFactoryG1aOpeningCloseoutReadiness({
      ...sharedOptions,
      outDir: path.join(outputDir, "source-g1a-opening-closeout-readiness"),
    });

  const sourceState = summarizeSourceState({
    structuredSummary: structuredSummary.data,
    feFreezeHandoff,
    g1aCandidateSelectionDocket,
    g1aOwnerSigningHandoff,
    g1aSourceLiteralCommitDraft,
    g1aOpeningCloseoutReadiness,
  });
  const readinessRows = buildReadinessRows({ sourceState, generatedAt });
  const blockerRows = buildBlockerRows({ readinessRows, generatedAt });
  const boundary = buildBoundary({ sourceState, readinessRows, blockerRows, generatedAt });
  const validationItems = buildValidationItems({
    structuredSummary,
    feFreezeHandoff,
    g1aCandidateSelectionDocket,
    g1aOwnerSigningHandoff,
    g1aSourceLiteralCommitDraft,
    g1aOpeningCloseoutReadiness,
    readinessRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceState, readinessRows, blockerRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      structured_summary_path: structuredSummary.path,
      fe_freeze_handoff_ref: "built.factory_fe_freeze_handoff",
      g1a_owner_candidate_selection_docket_ref: "built.factory_g1a_owner_candidate_selection_docket",
      g1a_owner_signing_handoff_ref: "built.factory_g1a_owner_signing_handoff",
      g1a_source_literal_commit_draft_ref: "built.factory_g1a_source_literal_commit_draft",
      g1a_opening_closeout_readiness_ref: "built.factory_g1a_opening_closeout_readiness",
    },
    source_summaries: {
      f0_status: structuredSummary.data?.f0_aggregate_gate_status ?? null,
      fe4_status: feFreezeHandoff.summary?.factory_fe_freeze_handoff_status ?? null,
      g1a_candidate_selection_status: g1aCandidateSelectionDocket.summary?.factory_g1a_owner_candidate_selection_docket_status ?? null,
      g1a_owner_signing_handoff_status: g1aOwnerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status ?? null,
      g1a_source_literal_commit_draft_status: g1aSourceLiteralCommitDraft.summary?.factory_g1a_source_literal_commit_draft_status ?? null,
      g1a_opening_closeout_status: g1aOpeningCloseoutReadiness.summary?.factory_g1a_opening_closeout_readiness_status ?? null,
    },
    factory_promotion_closeout_source_state: sourceState.public_source_state,
    factory_promotion_closeout_readiness_rows: readinessRows,
    factory_promotion_closeout_blocker_rows: blockerRows,
    factory_promotion_closeout_readiness_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryPromotionCloseoutReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-promotion-closeout-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "closeout-readiness-rows.json"), collectionEnvelope("factory-promotion-closeout-readiness-rows.v1", "factory_promotion_closeout_readiness_rows", result.factory_promotion_closeout_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "closeout-blocker-rows.json"), collectionEnvelope("factory-promotion-closeout-blocker-rows.v1", "factory_promotion_closeout_blocker_rows", result.factory_promotion_closeout_blocker_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_promotion_closeout_readiness_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-promotion-closeout-readiness-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryPromotionCloseoutReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryPromotionCloseoutReadiness(args);
    console.log(`Factory Promotion Closeout Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_promotion_closeout_readiness_status}`);
    console.log(`Rows pass/wait/fail: ${result.summary.readiness_pass_count}/${result.summary.readiness_wait_count}/${result.summary.readiness_fail_count}`);
    console.log(`FCORE ready: ${result.summary.fcore_closeout_chain_ready}`);
    console.log(`G1a owner chain ready: ${result.summary.g1a_owner_gate_opening_chain_ready}`);
    console.log(`Protected closeout allowed now: ${result.summary.factory_promotion_goal_complete_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function summarizeSourceState({
  structuredSummary,
  feFreezeHandoff,
  g1aCandidateSelectionDocket,
  g1aOwnerSigningHandoff,
  g1aSourceLiteralCommitDraft,
  g1aOpeningCloseoutReadiness,
}) {
  const f0Ready = structuredSummary?.owner_adjudication_completed === true
    && structuredSummary?.f0_completed === true
    && structuredSummary?.f0_phase_pass_count === structuredSummary?.f0_phase_count
    && structuredSummary?.f0_aggregate_gate_status === "ready_for_fa_implementation"
    && structuredSummary?.f0_1_receipt_preflight_passed === true
    && structuredSummary?.f0_1_independent_review_deferred_now === false
    && Number(structuredSummary?.f0_1_connector_review_blocking_findings ?? -1) === 0
    && Number(structuredSummary?.f0_1_execution_review_blocking_findings ?? -1) === 0;
  const fcorePhaseRows = FCORE_PHASE_KEYS.map((phaseKey) => {
    const status = structuredSummary?.[`${phaseKey}_status`] ?? "";
    return {
      phase_key: phaseKey,
      status,
      ready: String(status).startsWith("ready_"),
    };
  });
  const reviewRows = REVIEW_PHASE_KEYS.map((phaseKey) => {
    const reviewStatus = structuredSummary?.[`${phaseKey}_claude_code_review_status`] ?? "";
    const blocking = Number(structuredSummary?.[`${phaseKey}_claude_code_review_blocking_findings`] ?? 0);
    const p0 = Number(structuredSummary?.[`${phaseKey}_claude_code_review_p0_findings`] ?? 0);
    const p1 = Number(structuredSummary?.[`${phaseKey}_claude_code_review_p1_findings`] ?? 0);
    const p2 = Number(structuredSummary?.[`${phaseKey}_claude_code_review_p2_findings`] ?? 0);
    const model = structuredSummary?.[`${phaseKey}_claude_code_review_resolved_model`]
      ?? structuredSummary?.[`${phaseKey}_claude_code_review_model_alias`]
      ?? "";
    const ready = String(reviewStatus).startsWith("valid_")
      && (blocking + p0 + p1 + p2) === 0
      && String(model).startsWith("claude-opus-")
      && structuredSummary?.[`${phaseKey}_claude_final_approval_allowed_now`] !== true;
    return {
      phase_key: phaseKey,
      review_status: reviewStatus,
      resolved_model: model,
      blocking_finding_count: blocking + p0 + p1 + p2,
      ready,
    };
  });
  const fcoreStatusesReady = fcorePhaseRows.every((row) => row.ready);
  const fcoreReviewsReady = reviewRows.every((row) => row.ready);
  const fe4Ready = feFreezeHandoff?.validation?.valid === true
    && feFreezeHandoff?.summary?.factory_fe_freeze_handoff_status === "ready_factory_fe_freeze_handoff"
    && feFreezeHandoff?.summary?.fe_tranche_freeze_candidate_ready_now === true
    && feFreezeHandoff?.summary?.factory_promotion_goal_complete_allowed_now === false;
  const fcoreCloseoutChainReady = f0Ready && fcoreStatusesReady && fcoreReviewsReady && fe4Ready;
  const candidateSelected = g1aCandidateSelectionDocket?.summary?.selected_candidate_now === true
    && g1aCandidateSelectionDocket?.summary?.candidate_hash_bound_now === true;
  const ownerHandoffReady = g1aOwnerSigningHandoff?.validation?.valid === true
    && g1aOwnerSigningHandoff?.summary?.factory_g1a_owner_signing_handoff_status === "ready_g1a_owner_signature_handoff"
    && g1aOwnerSigningHandoff?.summary?.ready_for_owner_signature_now === true;
  const ownerReceiptSigned = g1aOwnerSigningHandoff?.summary?.owner_gate_opening_receipt_signed_now === true
    || closeoutChainRowPassed(g1aOpeningCloseoutReadiness, "owner_receipt.signed");
  const sourceCommitDraftReady = g1aSourceLiteralCommitDraft?.validation?.valid === true
    && g1aSourceLiteralCommitDraft?.summary?.factory_g1a_source_literal_commit_draft_status !== "blocked_factory_g1a_source_literal_commit_draft";
  const sourceCommitApplied = g1aSourceLiteralCommitDraft?.summary?.source_literal_opening_commit_applied_now === true
    || closeoutChainRowPassed(g1aOpeningCloseoutReadiness, "source_literal.commit_applied");
  const firstUseAuditPresent = closeoutChainRowPassed(g1aOpeningCloseoutReadiness, "first_use.audit_present")
    && g1aOpeningCloseoutReadiness?.summary?.ready_for_g1a_opening_closeout_owner_adjudication === true;
  const g1aCloseoutReady = g1aOpeningCloseoutReadiness?.validation?.valid === true
    && g1aOpeningCloseoutReadiness?.summary?.ready_for_g1a_opening_closeout_owner_adjudication === true;
  const g1aOwnerGateOpeningChainReady = candidateSelected
    && ownerHandoffReady
    && ownerReceiptSigned
    && sourceCommitDraftReady
    && sourceCommitApplied
    && firstUseAuditPresent
    && g1aCloseoutReady;
  const sourceAuthorityClosed = authorityClosedForSummary(feFreezeHandoff?.summary)
    && authorityClosedForSummary(g1aCandidateSelectionDocket?.summary)
    && authorityClosedForSummary(g1aOwnerSigningHandoff?.summary)
    && authorityClosedForSummary(g1aSourceLiteralCommitDraft?.summary)
    && authorityClosedForSummary(g1aOpeningCloseoutReadiness?.summary);
  return {
    f0_ready: f0Ready,
    fcore_statuses_ready: fcoreStatusesReady,
    fcore_reviews_ready: fcoreReviewsReady,
    fe4_ready: fe4Ready,
    fcore_closeout_chain_ready: fcoreCloseoutChainReady,
    g1a_candidate_selected: candidateSelected,
    g1a_owner_handoff_ready: ownerHandoffReady,
    g1a_owner_receipt_signed: ownerReceiptSigned,
    g1a_source_commit_draft_ready: sourceCommitDraftReady,
    g1a_source_commit_applied: sourceCommitApplied,
    g1a_first_use_audit_present: firstUseAuditPresent,
    g1a_opening_closeout_ready: g1aCloseoutReady,
    g1a_owner_gate_opening_chain_ready: g1aOwnerGateOpeningChainReady,
    source_authority_closed: sourceAuthorityClosed,
    fcore_phase_rows: fcorePhaseRows,
    review_rows: reviewRows,
    public_source_state: {
      schema_version: "factory-promotion-closeout-source-state.v1",
      program_range: PROGRAM_RANGE,
      f0_ready: f0Ready,
      fcore_phase_count: fcorePhaseRows.length,
      fcore_phase_ready_count: fcorePhaseRows.filter((row) => row.ready).length,
      review_phase_count: reviewRows.length,
      review_phase_ready_count: reviewRows.filter((row) => row.ready).length,
      fcore_closeout_chain_ready: fcoreCloseoutChainReady,
      g1a_owner_gate_opening_chain_ready: g1aOwnerGateOpeningChainReady,
      source_authority_closed: sourceAuthorityClosed,
    },
  };
}

function buildReadinessRows({ sourceState, generatedAt }) {
  return [
    readinessRow("f0.owner_adjudication_and_receipts", "F0 owner adjudication and receipt-integrity preflight are closed", sourceState.f0_ready ? "pass" : "fail", "f0", generatedAt),
    readinessRow("fcore.status_vector", "FA-FE phase status vector is ready", sourceState.fcore_statuses_ready ? "pass" : "fail", "fcore", generatedAt, {
      phase_count: sourceState.fcore_phase_rows.length,
      ready_count: sourceState.fcore_phase_rows.filter((row) => row.ready).length,
    }),
    readinessRow("fcore.review_evidence", "Required FCORE independent review evidence is valid with no blocking findings", sourceState.fcore_reviews_ready ? "pass" : "fail", "fcore_review", generatedAt, {
      review_phase_count: sourceState.review_rows.length,
      ready_count: sourceState.review_rows.filter((row) => row.ready).length,
    }),
    readinessRow("fcore.fe4_freeze_handoff", "FE4 freeze handoff is ready but does not grant final authority", sourceState.fe4_ready ? "pass" : "fail", "fcore", generatedAt),
    readinessRow("g1a.owner_candidate_selected", "Human owner has selected and hash-bound exactly one G1a candidate", sourceState.g1a_candidate_selected ? "pass" : "wait", "g1a_owner", generatedAt),
    readinessRow("g1a.owner_signature_handoff_ready", "Owner signing handoff is ready and unsigned", sourceState.g1a_owner_handoff_ready ? "pass" : "fail", "g1a_owner", generatedAt),
    readinessRow("g1a.signed_owner_receipt_present", "Signed owner gate_opening receipt is present", sourceState.g1a_owner_receipt_signed ? "pass" : "wait", "g1a_owner", generatedAt),
    readinessRow("g1a.source_literal_commit_draft_ready", "Source literal commit draft/preflight path is valid", sourceState.g1a_source_commit_draft_ready ? "pass" : "fail", "g1a_source", generatedAt),
    readinessRow("g1a.source_literal_commit_applied", "Isolated source literal opening commit is applied and receipt-bound", sourceState.g1a_source_commit_applied ? "pass" : "wait", "g1a_source", generatedAt),
    readinessRow("g1a.first_use_audit_present", "First-use audit is captured after G1a opening", sourceState.g1a_first_use_audit_present ? "pass" : "wait", "g1a_audit", generatedAt),
    readinessRow("g1a.opening_closeout_ready", "G1a opening closeout chain is ready for owner adjudication", sourceState.g1a_opening_closeout_ready ? "pass" : "wait", "g1a_closeout", generatedAt),
    readinessRow("authority.closed_until_owner_closeout", "All source/read-model authority flags remain closed", sourceState.source_authority_closed ? "pass" : "fail", "authority", generatedAt),
  ];
}

function buildBlockerRows({ readinessRows, generatedAt }) {
  return readinessRows
    .filter((row) => row.current_verdict !== "pass")
    .map((row, index) => {
      const blocker = {
        schema_version: "factory-promotion-closeout-blocker-row.v1",
        blocker_id: `factory-promotion.closeout.blocker.${row.row_id}`,
        source_row_id: row.row_id,
        blocker_status: row.current_verdict === "fail" ? "hard_blocked" : "waiting",
        next_operator_action: nextActionForReadinessRow(row),
        generated_at: generatedAt,
        ordinal: index + 1,
      };
      return { ...blocker, blocker_row_sha256: sha256(canonicalize(blocker)) };
    });
}

function buildBoundary({ sourceState, readinessRows, blockerRows, generatedAt }) {
  const passCount = readinessRows.filter((row) => row.current_verdict === "pass").length;
  const waitCount = readinessRows.filter((row) => row.current_verdict === "wait").length;
  const failCount = readinessRows.filter((row) => row.current_verdict === "fail").length;
  const ready = failCount === 0 && waitCount === 0
    && sourceState.fcore_closeout_chain_ready
    && sourceState.g1a_owner_gate_opening_chain_ready;
  return {
    schema_version: "factory-promotion-closeout-readiness-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    closeout_readiness_only: true,
    human_owner_protected_closeout_required: true,
    independent_reviewer_final_approval_allowed_now: false,
    ready_for_human_owner_protected_closeout: ready,
    blocker_count: blockerRows.length,
    readiness_pass_count: passCount,
    readiness_wait_count: waitCount,
    readiness_fail_count: failCount,
    fcore_closeout_chain_ready: sourceState.fcore_closeout_chain_ready,
    g1a_owner_gate_opening_chain_ready: sourceState.g1a_owner_gate_opening_chain_ready,
    source_authority_closed: sourceState.source_authority_closed,
    ...Object.fromEntries(CLOSED_AUTHORITY_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems({
  structuredSummary,
  feFreezeHandoff,
  g1aCandidateSelectionDocket,
  g1aOwnerSigningHandoff,
  g1aSourceLiteralCommitDraft,
  g1aOpeningCloseoutReadiness,
  readinessRows,
  boundary,
}) {
  const hardFailCount = readinessRows.filter((row) => row.current_verdict === "fail").length;
  return [
    validationItem("source.structured_summary_loaded", "source", structuredSummary.data && typeof structuredSummary.data === "object", "Structured summary could not be loaded"),
    validationItem("source.fe4_valid", "source", feFreezeHandoff?.validation?.valid === true, "FE4 freeze handoff has validation failures"),
    validationItem("source.g1a_candidate_selection_valid", "source", g1aCandidateSelectionDocket?.validation?.valid === true, "G1a owner candidate selection docket has validation failures"),
    validationItem("source.g1a_owner_signing_handoff_valid", "source", g1aOwnerSigningHandoff?.validation?.valid === true, "G1a owner signing handoff has validation failures"),
    validationItem("source.g1a_source_literal_commit_draft_valid", "source", g1aSourceLiteralCommitDraft?.validation?.valid === true, "G1a source literal commit draft has validation failures"),
    validationItem("source.g1a_opening_closeout_valid", "source", g1aOpeningCloseoutReadiness?.validation?.valid === true, "G1a opening closeout readiness has validation failures"),
    validationItem("rows.present", "readiness_rows", readinessRows.length === 12, "Factory promotion closeout readiness row count changed unexpectedly"),
    validationItem("rows.no_hard_failures", "readiness_rows", hardFailCount === 0, "Factory promotion closeout readiness has hard failed rows"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Factory promotion closeout readiness opened forbidden authority"),
  ];
}

function buildSummary({ sourceState, readinessRows, blockerRows, boundary, validation }) {
  const hardFailed = validation.valid === false || boundary.readiness_fail_count > 0;
  const ready = validation.valid === true && boundary.ready_for_human_owner_protected_closeout === true;
  const status = hardFailed ? BLOCKED_STATUS : ready ? READY_STATUS : WAITING_G1A_STATUS;
  return {
    factory_promotion_closeout_readiness_status: status,
    program_range: PROGRAM_RANGE,
    ready_for_human_owner_protected_closeout: ready,
    human_owner_protected_closeout_required: true,
    fcore_closeout_chain_ready: sourceState.fcore_closeout_chain_ready,
    g1a_owner_gate_opening_chain_ready: sourceState.g1a_owner_gate_opening_chain_ready,
    f0_ready: sourceState.f0_ready,
    fcore_phase_count: sourceState.fcore_phase_rows.length,
    fcore_phase_ready_count: sourceState.fcore_phase_rows.filter((row) => row.ready).length,
    review_phase_count: sourceState.review_rows.length,
    review_phase_ready_count: sourceState.review_rows.filter((row) => row.ready).length,
    readiness_row_count: readinessRows.length,
    readiness_pass_count: boundary.readiness_pass_count,
    readiness_wait_count: boundary.readiness_wait_count,
    readiness_fail_count: boundary.readiness_fail_count,
    blocker_count: blockerRows.length,
    waiting_blocker_ids: blockerRows.filter((row) => row.blocker_status === "waiting").map((row) => row.blocker_id),
    hard_blocker_ids: blockerRows.filter((row) => row.blocker_status === "hard_blocked").map((row) => row.blocker_id),
    validation_errors: validation.errors.length,
    ...Object.fromEntries(CLOSED_AUTHORITY_FLAGS.map((flag) => [flag, false])),
  };
}

function readinessRow(rowId, message, currentVerdict, category, generatedAt, details = {}) {
  const row = {
    schema_version: "factory-promotion-closeout-readiness-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    details,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-promotion-closeout-readiness-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
  }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function nextActionForReadinessRow(row) {
  if (row.row_id === "g1a.owner_candidate_selected") return "owner_select_exactly_one_g1a_candidate_and_bind_candidate_hash";
  if (row.row_id === "g1a.signed_owner_receipt_present") return "owner_sign_gate_opening_receipt_after_candidate_binding";
  if (row.row_id === "g1a.source_literal_commit_applied") return "apply_isolated_source_literal_opening_commit_after_signed_receipt";
  if (row.row_id === "g1a.first_use_audit_present") return "capture_first_use_audit_after_g1a_opening";
  if (row.row_id === "g1a.opening_closeout_ready") return "rerun_g1a_opening_closeout_readiness_after_owner_receipt_source_commit_and_first_use_audit";
  return "resolve_hard_validation_blocker_before_factory_promotion_closeout";
}

function closeoutChainRowPassed(closeoutReadiness, rowId) {
  return Array.isArray(closeoutReadiness?.g1a_opening_closeout_chain_rows)
    && closeoutReadiness.g1a_opening_closeout_chain_rows.some((row) => row?.row_id === rowId && row?.current_verdict === "pass");
}

function authorityClosedForSummary(summary = {}) {
  return CLOSED_AUTHORITY_FLAGS.every((flag) => summary?.[flag] === false || summary?.[flag] === undefined);
}

function boundaryFlagsClosed(boundary) {
  return CLOSED_AUTHORITY_FLAGS.every((flag) => boundary[flag] === false)
    && boundary.independent_reviewer_final_approval_allowed_now === false
    && boundary.ready_for_human_owner_protected_closeout === (boundary.readiness_fail_count === 0 && boundary.readiness_wait_count === 0);
}

function renderMarkdown(result) {
  return [
    "# Factory Promotion Closeout Readiness",
    "",
    `Status: ${result.summary.factory_promotion_closeout_readiness_status}`,
    `Program: ${result.program_range}`,
    `FCORE ready: ${result.summary.fcore_closeout_chain_ready}`,
    `G1a owner gate-opening chain ready: ${result.summary.g1a_owner_gate_opening_chain_ready}`,
    `Rows pass/wait/fail: ${result.summary.readiness_pass_count}/${result.summary.readiness_wait_count}/${result.summary.readiness_fail_count}`,
    `Blockers: ${result.summary.blocker_count}`,
    `Ready for human owner protected closeout: ${result.summary.ready_for_human_owner_protected_closeout}`,
    `Factory promotion goal complete allowed now: ${result.summary.factory_promotion_goal_complete_allowed_now}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function normalizeInputs(options, repoRoot) {
  return {
    repo_root: repoRoot,
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? DEFAULT_FACTORY_PROMOTION_CLOSEOUT_READINESS_INPUTS.structuredSummaryPath),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--structured-summary-path") args.structuredSummaryPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-promotion-closeout-readiness.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>] [--structured-summary-path <path>]\n\nBuilds a read-only Factory Promotion closeout readiness packet. It never signs owner receipts, mutates source, opens G1a, or claims protected closeout.`);
}

async function readJsonSource(filePath) {
  const text = await readFile(filePath, "utf8");
  return { path: filePath, data: JSON.parse(text), text, sha256: sha256(text) };
}

function normalizeInlineSource(sourcePath, data) {
  return { path: sourcePath, data, text: JSON.stringify(data), sha256: sha256(canonicalize(data)) };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
