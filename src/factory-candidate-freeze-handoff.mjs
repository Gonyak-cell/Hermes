import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateLaneProof } from "./factory-candidate-lane-proof.mjs";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import { buildReviewApiResponse } from "./review-api.mjs";

export const DEFAULT_FACTORY_CANDIDATE_FREEZE_HANDOFF_OUT_DIR = "artifacts/factory-candidate-freeze-handoff/latest";
export const DEFAULT_FACTORY_CANDIDATE_FREEZE_HANDOFF_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  stateStoreDocPath: "docs/factory-state-store.md",
  reviewApiDocPath: "docs/review-api.md",
};

const COMMAND_NAME = "factory:candidate-freeze-handoff";
const SCHEMA_VERSION = "factory-candidate-freeze-handoff.v1";
const CAPABILITY_ID = "factory.candidate_freeze_handoff";
const PROGRAM_RANGE = "FCORE-FC.5";
const SOURCE_PROGRAM_RANGE = "FCORE-FC.1-FC.4";
const NEXT_PROGRAM_RANGE = "FCORE-FD.1";
const READY_STATUS = "ready_factory_candidate_freeze_handoff";
const BLOCK_PENDING_STATUS = "valid_block_factory_candidate_freeze_handoff_pending";

const AUTHORITY_FALSE_FLAGS = [
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
];

const REVIEW_PHASES = ["fc1", "fc2", "fc3", "fc4"];

export async function runFactoryCandidateFreezeHandoff(options = {}) {
  const result = await buildFactoryCandidateFreezeHandoff(options);
  if (!options.check && options.write !== false) await writeFactoryCandidateFreezeHandoff(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Candidate Freeze Handoff failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_candidate_freeze_handoff_status !== READY_STATUS) {
    const error = new Error("Factory Candidate Freeze Handoff is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryCandidateFreezeHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CANDIDATE_FREEZE_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineJsonSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const stateStoreDoc = await readTextSource(inputs.state_store_doc_path);
  const reviewApiDoc = await readTextSource(inputs.review_api_doc_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const proof = Object.prototype.hasOwnProperty.call(options, "candidateLaneProof")
    ? options.candidateLaneProof
    : await buildFactoryCandidateLaneProof({
      ...options,
      outDir: path.join(outputDir, "source-proof"),
      runAt: generatedAt,
      write: false,
    });
  const reviewDocket = Object.prototype.hasOwnProperty.call(options, "candidateReviewDocket")
    ? options.candidateReviewDocket
    : await buildFactoryCandidateReviewDocket({
      ...options,
      outDir: path.join(outputDir, "source-docket"),
      runAt: generatedAt,
      write: false,
    });
  const apiResponse = Object.prototype.hasOwnProperty.call(options, "candidateReviewDocketApiResponse")
    ? options.candidateReviewDocketApiResponse
    : await buildReviewApiResponse("/api/factory/candidate-review-docket?limit=1", {
      ...options,
      runAt: generatedAt,
      write: false,
    });
  const apiSmoke = normalizeApiSmoke(apiResponse);
  const sourceState = buildSourceState({ packageJson, structuredSummary, stateStoreDoc, reviewApiDoc, proof, reviewDocket, apiSmoke, commitRef });
  const evidenceRows = buildFcExitEvidenceRows({ sourceState, generatedAt });
  const canonicalRunHashRows = buildCanonicalRunHashRows({ sourceState, proof, reviewDocket, apiSmoke, structuredSummary, generatedAt });
  const fdHandoffGateRows = buildFdHandoffGateRows({ sourceState, canonicalRunHashRows, generatedAt });
  const boundary = buildBoundary({ sourceState, fdHandoffGateRows, generatedAt });
  const validationItems = buildValidationItems({ sourceState, evidenceRows, canonicalRunHashRows, fdHandoffGateRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceState, evidenceRows, canonicalRunHashRows, fdHandoffGateRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      structured_summary_path: structuredSummary.path,
      state_store_doc_path: stateStoreDoc.path,
      review_api_doc_path: reviewApiDoc.path,
    },
    source_summaries: {
      candidate_lane_proof: proof.summary ?? null,
      candidate_review_docket: reviewDocket.summary ?? null,
      candidate_review_docket_api: apiSmoke.summary,
      structured_summary: structuredSummary.data ? {
        package_version: structuredSummary.data.package_version,
        fc1_status: structuredSummary.data.fc1_status,
        fc2_status: structuredSummary.data.fc2_status,
        fc3_status: structuredSummary.data.fc3_status,
        fc4_status: structuredSummary.data.fc4_status,
      } : null,
    },
    factory_candidate_freeze_exit_evidence_rows: evidenceRows,
    factory_candidate_canonical_run_hash_rows: canonicalRunHashRows,
    factory_candidate_fd_handoff_gate_rows: fdHandoffGateRows,
    factory_candidate_freeze_handoff_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryCandidateFreezeHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-candidate-freeze-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "fc-exit-evidence-rows.json"), collectionEnvelope("factory-candidate-freeze-exit-evidence-rows.v1", "factory_candidate_freeze_exit_evidence_rows", result.factory_candidate_freeze_exit_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "canonical-run-hash-rows.json"), collectionEnvelope("factory-candidate-canonical-run-hash-rows.v1", "factory_candidate_canonical_run_hash_rows", result.factory_candidate_canonical_run_hash_rows, result.generated_at));
  await writeJson(path.join(outDir, "fd-handoff-gate-rows.json"), collectionEnvelope("factory-candidate-fd-handoff-gate-rows.v1", "factory_candidate_fd_handoff_gate_rows", result.factory_candidate_fd_handoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_candidate_freeze_handoff_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-candidate-freeze-handoff-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryCandidateFreezeHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryCandidateFreezeHandoff(args);
    console.log(`Factory Candidate Freeze Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_candidate_freeze_handoff_status}`);
    console.log(`Candidate packets: ${result.summary.candidate_packet_count}`);
    console.log(`FC evidence rows: ${result.summary.fc_exit_evidence_ready_count}/${result.summary.fc_exit_evidence_count}`);
    console.log(`Canonical hash rows: ${result.summary.canonical_run_hash_row_count}`);
    console.log(`FD handoff allowed: ${result.summary.fd_implementation_handoff_allowed_now}`);
    console.log(`Apply enabled: ${result.summary.apply_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_CANDIDATE_FREEZE_HANDOFF_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
    state_store_doc_path: path.resolve(repoRoot, options.stateStoreDocPath ?? defaults.stateStoreDocPath),
    review_api_doc_path: path.resolve(repoRoot, options.reviewApiDocPath ?? defaults.reviewApiDocPath),
  };
}

function buildSourceState({ packageJson, structuredSummary, stateStoreDoc, reviewApiDoc, proof, reviewDocket, apiSmoke, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  const summary = structuredSummary.data ?? {};
  const reviewStates = Object.fromEntries(REVIEW_PHASES.map((phase) => [phase, phaseReviewState(summary, phase)]));
  const proofReady = proof.validation?.valid === true
    && proof.summary?.factory_candidate_lane_proof_status === "ready_factory_candidate_lane_proof"
    && proof.summary?.candidate_packet_count === 3
    && proof.summary?.diff_packet_count === 3
    && proof.summary?.rollback_plan_count === 3
    && proof.summary?.preflight_count === 3
    && proof.summary?.hash_ledger_row_count === 3
    && proof.summary?.temp_ledger_cleaned_up === true;
  const docketReady = reviewDocket.validation?.valid === true
    && reviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket"
    && reviewDocket.summary?.review_docket_row_count === 3
    && reviewDocket.summary?.review_packet_row_count === 3
    && reviewDocket.summary?.review_hash_register_row_count === 3
    && reviewDocket.summary?.approval_allowed_now === false
    && reviewDocket.summary?.apply_allowed_now === false;
  const apiReady = apiSmoke.status === 200
    && apiSmoke.body?.collection === "factory_candidate_review_docket_rows"
    && apiSmoke.body?.total_count === 3
    && apiSmoke.body?.mutation_allowed === false
    && apiSmoke.body?.approval_allowed_now === false
    && apiSmoke.body?.apply_allowed_now === false;
  const docsReady = stateStoreDoc.available
    && reviewApiDoc.available
    && stateStoreDoc.text.includes("/api/factory/candidate-review-docket")
    && reviewApiDoc.text.includes("FC.4 Factory Candidate Review Docket Routes")
    && reviewStates.fc4.reviewed;
  const packageScriptRegistered = typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-candidate-freeze-handoff.mjs");
  const fdCommandReserved = summary.new_validation_commands_by_tranche?.FD === "npm run factory:receipt-verify -- --check";
  const allReviewsClean = REVIEW_PHASES.every((phase) => reviewStates[phase].reviewed && reviewStates[phase].blockingFindings === 0);
  const authorityFlagVector = buildObservedAuthorityFlagVector([
    proof.summary,
    reviewDocket.summary,
    reviewDocket.factory_candidate_review_docket_boundary,
    apiSmoke.body,
  ]);
  const authorityClosed = AUTHORITY_FALSE_FLAGS.every((flag) => authorityFlagVector[flag].present_count > 0 && authorityFlagVector[flag].all_false === true);
  return {
    commitRefPresent: Boolean(commitRef),
    packageScriptRegistered,
    proofReady,
    docketReady,
    apiReady,
    docsReady,
    fdCommandReserved,
    allReviewsClean,
    reviewStates,
    authorityFlagVector,
    authorityClosed,
    candidatePacketCount: proof.summary?.candidate_packet_count ?? 0,
    reviewDocketRowCount: reviewDocket.summary?.review_docket_row_count ?? 0,
    apiVisibleCount: apiSmoke.body?.count ?? 0,
    apiTotalCount: apiSmoke.body?.total_count ?? 0,
    apiStatus: apiSmoke.status,
    apiError: apiSmoke.body?.error ?? null,
  };
}

function phaseReviewState(summary, phase) {
  const status = String(summary[`${phase}_status`] ?? "");
  const reviewStatus = String(summary[`${phase}_claude_code_review_status`] ?? "");
  const receipt = summary[`${phase}_review_receipt`] ?? null;
  const blockingFindings = Number(summary[`${phase}_claude_code_review_blocking_findings`] ?? 0);
  return {
    phase,
    status,
    reviewStatus,
    receipt,
    blockingFindings,
    reviewed: status.includes("reviewed") && reviewStatus.startsWith("valid_") && receipt !== null,
  };
}

function buildFcExitEvidenceRows({ sourceState, generatedAt }) {
  const rows = [
    evidenceRow("fc1_reviewed", "FC.1 candidate lane has valid Claude review evidence.", sourceState.reviewStates.fc1.reviewed && sourceState.reviewStates.fc1.blockingFindings === 0, "docs/factory-promotion/99-structured-summary.json", generatedAt),
    evidenceRow("fc2_proof_ready", "FC.2 proof demonstrates 3 candidate packets, diffs, rollbacks, preflights, and hash rows.", sourceState.proofReady, "npm run factory:candidate-lane-proof -- --check --require-pass", generatedAt),
    evidenceRow("fc2_reviewed", "FC.2 proof has valid Claude review evidence.", sourceState.reviewStates.fc2.reviewed && sourceState.reviewStates.fc2.blockingFindings === 0, "docs/factory-promotion/99-structured-summary.json", generatedAt),
    evidenceRow("fc3_docket_ready", "FC.3 review docket binds 3 candidate packets and keeps approval/apply closed.", sourceState.docketReady, "npm run factory:candidate-review-docket -- --check --require-pass", generatedAt),
    evidenceRow("fc3_reviewed", "FC.3 docket has valid Claude review evidence.", sourceState.reviewStates.fc3.reviewed && sourceState.reviewStates.fc3.blockingFindings === 0, "docs/factory-promotion/99-structured-summary.json", generatedAt),
    evidenceRow("fc4_api_visible", "FC.4 API exposes candidate review docket rows as read-only review data.", sourceState.apiReady, "/api/factory/candidate-review-docket", generatedAt),
    evidenceRow("fc4_reviewed", "FC.4 API has valid Claude review evidence.", sourceState.reviewStates.fc4.reviewed && sourceState.reviewStates.fc4.blockingFindings === 0, "docs/factory-promotion/99-structured-summary.json", generatedAt),
    evidenceRow("fc_docs_bound", "FC.3/FC.4 docs bind the route and review-only boundary.", sourceState.docsReady, "docs/factory-state-store.md + docs/review-api.md + structured FC.4 reviewed state", generatedAt),
    evidenceRow("fd_command_reserved", "FD validation command is reserved but not executed as an apply authority gate.", sourceState.fdCommandReserved, "docs/factory-promotion/99-structured-summary.json", generatedAt),
    evidenceRow("authority_closed", "FC exit keeps review decision, approval, apply, write, deploy, protected action, production, and enterprise authority closed.", sourceState.authorityClosed, "source summaries and API response", generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, ordinal: index + 1, evidence_row_hash: sha256(canonicalize(row)) }));
}

function evidenceRow(rowKey, description, ready, evidenceRef, generatedAt) {
  return {
    schema_version: "factory-candidate-freeze-exit-evidence-row.v1",
    row_id: `fc_exit.${rowKey}`,
    row_key: rowKey,
    evidence_status: ready ? "ready" : "blocked",
    description,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  };
}

function buildCanonicalRunHashRows({ sourceState, proof, reviewDocket, apiSmoke, structuredSummary, generatedAt }) {
  const payloads = [
    ["fc2_candidate_lane_proof", {
      status: proof.summary?.factory_candidate_lane_proof_status,
      candidate_packet_count: proof.summary?.candidate_packet_count,
      diff_packet_count: proof.summary?.diff_packet_count,
      rollback_plan_count: proof.summary?.rollback_plan_count,
      preflight_count: proof.summary?.preflight_count,
      hash_ledger_row_count: proof.summary?.hash_ledger_row_count,
      temp_ledger_cleaned_up: proof.summary?.temp_ledger_cleaned_up,
    }],
    ["fc3_candidate_review_docket", {
      status: reviewDocket.summary?.factory_candidate_review_docket_status,
      review_docket_row_count: reviewDocket.summary?.review_docket_row_count,
      review_packet_row_count: reviewDocket.summary?.review_packet_row_count,
      review_hash_register_row_count: reviewDocket.summary?.review_hash_register_row_count,
      approval_allowed_now: reviewDocket.summary?.approval_allowed_now,
      apply_allowed_now: reviewDocket.summary?.apply_allowed_now,
    }],
    ["fc4_candidate_review_docket_api", {
      status: apiSmoke.status,
      collection: apiSmoke.body?.collection,
      count: apiSmoke.body?.count,
      total_count: apiSmoke.body?.total_count,
      mutation_allowed: apiSmoke.body?.mutation_allowed,
      approval_allowed_now: apiSmoke.body?.approval_allowed_now,
      apply_allowed_now: apiSmoke.body?.apply_allowed_now,
    }],
    ["fc_review_evidence", Object.fromEntries(REVIEW_PHASES.map((phase) => [phase, sourceState.reviewStates[phase]]))],
    ["fc_authority_boundary", sourceState.authorityFlagVector],
    ["structured_summary_fc_vector", {
      package_version: structuredSummary.data?.package_version,
      fc1_status: structuredSummary.data?.fc1_status,
      fc2_status: structuredSummary.data?.fc2_status,
      fc3_status: structuredSummary.data?.fc3_status,
      fc4_status: structuredSummary.data?.fc4_status,
    }],
  ];
  let prevEntryHash = null;
  return payloads.map(([rowKey, payload], index) => {
    const payloadHash = sha256(canonicalize(payload));
    const draft = {
      schema_version: "factory-candidate-canonical-run-hash-row.v1",
      register_row_id: `factory-candidate-canonical-run-hash.${String(index + 1).padStart(4, "0")}`,
      row_key: rowKey,
      payload_sha256: payloadHash,
      prev_entry_hash: prevEntryHash,
      generated_at: generatedAt,
    };
    const entryHash = sha256(canonicalize(draft));
    prevEntryHash = entryHash;
    return { ...draft, entry_hash: entryHash };
  });
}

function buildFdHandoffGateRows({ sourceState, canonicalRunHashRows, generatedAt }) {
  const chainReady = canonicalRunHashRows.length >= 6 && canonicalRunHashRows.every((row, index) => index === 0
    ? row.prev_entry_hash === null
    : row.prev_entry_hash === canonicalRunHashRows[index - 1].entry_hash);
  const rows = [
    handoffGateRow("fc_candidate_packets_3_proven", "FC proves 3 candidate packets with diff, rollback, preflight, and hash evidence.", sourceState.proofReady && sourceState.candidatePacketCount === 3, generatedAt),
    handoffGateRow("fc_review_docket_ready", "FC review docket binds 3 candidates and is visible before FD.", sourceState.docketReady && sourceState.reviewDocketRowCount === 3, generatedAt),
    handoffGateRow("fc_review_api_ready", "FC review API exposes the docket as read-only operator/reviewer data.", sourceState.apiReady && sourceState.apiTotalCount === 3, generatedAt),
    handoffGateRow("fc_independent_review_clean", "FC.1-FC.4 have no blocking Claude review findings.", sourceState.allReviewsClean, generatedAt),
    handoffGateRow("fc_canonical_hash_chain_ready", "FC freeze includes a chained canonical run hash register.", chainReady, generatedAt),
    handoffGateRow("fc_authority_closed", "FC exit does not open apply/write/deploy/protected/production/enterprise authority.", sourceState.authorityClosed, generatedAt),
    handoffGateRow("fd_receipt_verify_reserved", "FD receipt verification command is reserved as next-tranche validation.", sourceState.fdCommandReserved, generatedAt),
  ];
  const allPreviousReady = rows.every((row) => row.gate_status === "ready");
  rows.push(handoffGateRow("fd_implementation_handoff", "FD implementation may start while runtime apply/write authority remains closed.", allPreviousReady, generatedAt));
  return rows.map((row, index) => ({ ...row, ordinal: index + 1, gate_row_hash: sha256(canonicalize(row)) }));
}

function handoffGateRow(rowKey, description, ready, generatedAt) {
  return {
    schema_version: "factory-candidate-fd-handoff-gate-row.v1",
    row_id: `fd_handoff.${rowKey}`,
    row_key: rowKey,
    gate_status: ready ? "ready" : "blocked",
    description,
    fd_runtime_apply_enabled_now: false,
    protected_action_allowed_now: false,
    generated_at: generatedAt,
  };
}

function buildBoundary({ sourceState, fdHandoffGateRows, generatedAt }) {
  const fdHandoffAllowed = fdHandoffGateRows.every((row) => row.gate_status === "ready");
  return {
    schema_version: "factory-candidate-freeze-handoff-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    fc_exit_ready_now: fdHandoffAllowed,
    fd_implementation_handoff_allowed_now: fdHandoffAllowed,
    candidate_packet_count: sourceState.candidatePacketCount,
    review_docket_row_count: sourceState.reviewDocketRowCount,
    api_visible_review_docket_row_count: sourceState.apiVisibleCount,
    api_total_review_docket_row_count: sourceState.apiTotalCount,
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    apply_allowed_now: false,
    fd_runtime_apply_enabled_now: false,
    apply_engine_runtime_enabled_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    persistent_ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    claude_final_approval_allowed_now: false,
  };
}

function buildValidationItems({ sourceState, evidenceRows, canonicalRunHashRows, fdHandoffGateRows, boundary }) {
  const chainReady = canonicalRunHashRows.length >= 6 && canonicalRunHashRows.every((row, index) => index === 0
    ? row.prev_entry_hash === null
    : row.prev_entry_hash === canonicalRunHashRows[index - 1].entry_hash);
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:candidate-freeze-handoff"),
    validationItem("fc_exit.rows_present", "fc_exit", evidenceRows.length >= 10, "FC exit evidence rows are incomplete"),
    validationItem("fc_exit.blockers_visible", "fc_exit", evidenceRows.every((row) => ["ready", "blocked"].includes(row.evidence_status)), "FC exit row status is not visible"),
    validationItem("canonical.hash_chain", "hash", chainReady, "Canonical run hash chain is incomplete or broken"),
    validationItem("fd_handoff.rows_present", "handoff", fdHandoffGateRows.length >= 8, "FD handoff gate rows are incomplete"),
    validationItem("api.response_classified", "api", [200, 503].includes(sourceState.apiStatus), "Candidate review docket API response is neither ready nor fail-closed"),
    validationItem("authority.boundary_closed", "authority", boundaryFlagsClosed(boundary), "Protected authority boundary opened"),
  ];
}

function buildSummary({ sourceState, evidenceRows, canonicalRunHashRows, fdHandoffGateRows, boundary, validation }) {
  const readyEvidenceRows = evidenceRows.filter((row) => row.evidence_status === "ready").length;
  const readyHandoffRows = fdHandoffGateRows.filter((row) => row.gate_status === "ready").length;
  const ready = validation.valid && readyEvidenceRows === evidenceRows.length && readyHandoffRows === fdHandoffGateRows.length && boundary.fd_implementation_handoff_allowed_now === true;
  return {
    factory_candidate_freeze_handoff_status: ready ? READY_STATUS : BLOCK_PENDING_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    candidate_packet_count: sourceState.candidatePacketCount,
    review_docket_row_count: sourceState.reviewDocketRowCount,
    api_visible_review_docket_row_count: sourceState.apiVisibleCount,
    api_total_review_docket_row_count: sourceState.apiTotalCount,
    fc_exit_evidence_count: evidenceRows.length,
    fc_exit_evidence_ready_count: readyEvidenceRows,
    canonical_run_hash_row_count: canonicalRunHashRows.length,
    fd_handoff_gate_count: fdHandoffGateRows.length,
    fd_handoff_gate_ready_count: readyHandoffRows,
    fd_implementation_handoff_allowed_now: boundary.fd_implementation_handoff_allowed_now,
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    apply_allowed_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    persistent_ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.errors.length,
  };
}

function normalizeApiSmoke(apiResponse) {
  let body = null;
  try {
    body = apiResponse?.body ? JSON.parse(apiResponse.body) : null;
  } catch {
    body = { error: "invalid_json_body" };
  }
  return {
    status: Number(apiResponse?.status ?? 0),
    headers: apiResponse?.headers ?? {},
    body,
    summary: {
      status: Number(apiResponse?.status ?? 0),
      collection: body?.collection ?? null,
      count: body?.count ?? null,
      total_count: body?.total_count ?? null,
      mutation_allowed: body?.mutation_allowed ?? null,
      approval_allowed_now: body?.approval_allowed_now ?? null,
      apply_allowed_now: body?.apply_allowed_now ?? null,
      error: body?.error ?? null,
    },
  };
}

function buildObservedAuthorityFlagVector(sources) {
  return Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => {
    const values = sources
      .filter((source) => source && Object.prototype.hasOwnProperty.call(source, flag))
      .map((source) => source[flag]);
    return [flag, {
      present_count: values.length,
      values,
      all_false: values.length > 0 && values.every((value) => value === false),
    }];
  }));
}

function boundaryFlagsClosed(boundary) {
  return [
    ...AUTHORITY_FALSE_FLAGS,
    "fd_runtime_apply_enabled_now",
    "apply_engine_runtime_enabled_now",
    "claude_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-candidate-freeze-handoff-validation-item.v1",
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
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Candidate Freeze Handoff",
    "",
    `Status: ${result.summary.factory_candidate_freeze_handoff_status}`,
    `Program: ${result.program_range}`,
    `Candidate packets: ${result.summary.candidate_packet_count}`,
    `Review docket rows: ${result.summary.review_docket_row_count}`,
    `API docket rows: ${result.summary.api_visible_review_docket_row_count}/${result.summary.api_total_review_docket_row_count}`,
    `FC evidence rows: ${result.summary.fc_exit_evidence_ready_count}/${result.summary.fc_exit_evidence_count}`,
    `FD handoff allowed: ${result.summary.fd_implementation_handoff_allowed_now}`,
    `Apply allowed now: ${result.summary.apply_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-candidate-freeze-handoff.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FC.5 candidate freeze and FD handoff readiness artifact.`);
}

async function readJsonSource(filePath) {
  try {
    return {
      available: true,
      path: filePath,
      data: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      data: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    return {
      available: true,
      path: filePath,
      text: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      text: "",
      error: error.message,
    };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return {
    available: data !== null && typeof data === "object",
    path: pathLabel,
    data,
    error: data !== null && typeof data === "object" ? null : "Inline source is not an object",
  };
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
