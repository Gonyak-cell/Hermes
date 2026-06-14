import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryPrdIntake } from "./factory-prd-intake.mjs";
import { buildFactoryWorkPacketDecomposition } from "./factory-work-packet-decomposition.mjs";
import { buildFactoryValidationLoopInstantiation } from "./factory-validation-loop-instantiation.mjs";

export const DEFAULT_FACTORY_FE_FREEZE_HANDOFF_OUT_DIR = "artifacts/factory-fe-freeze-handoff/latest";
export const DEFAULT_FACTORY_FE_FREEZE_HANDOFF_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  prdPath: "docs/hermes-enterprise-saas-specification.md",
  factoryPromotionDocsDir: "docs/factory-promotion",
};

const COMMAND_NAME = "factory:fe-freeze-handoff";
const SCHEMA_VERSION = "factory-fe-freeze-handoff.v1";
const CAPABILITY_ID = "factory.fe_freeze_handoff";
const PROGRAM_RANGE = "FCORE-FE.4";
const SOURCE_PROGRAM_RANGE = "FCORE-FE.1-FE.3";
const READY_STATUS = "ready_factory_fe_freeze_handoff";
const BLOCKED_STATUS = "blocked_factory_fe_freeze_handoff";
const HASH_RE = /^[a-f0-9]{64}$/;

const REVIEW_RECEIPTS = [
  ["FE.1", "fe1", "FCORE-FE.1", "factory-prd-intake", "fe1-claude-opus-4-8-review-receipt.md"],
  ["FE.2", "fe2", "FCORE-FE.2", "factory-work-packet-decomposition", "fe2-claude-opus-4-8-review-receipt.md"],
  ["FE.3", "fe3", "FCORE-FE.3", "factory-validation-loop-instantiation", "fe3-claude-opus-4-8-review-receipt.md"],
];

const AUTHORITY_FALSE_FLAGS = [
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
  "fe_runtime_loop_execution_enabled_now",
  "fe_tranche_final_approval_allowed_now",
  "factory_promotion_goal_complete_allowed_now",
];

const SOURCE_AUTHORITY_FALSE_FLAGS = AUTHORITY_FALSE_FLAGS.filter((flag) => ![
  "fe_runtime_loop_execution_enabled_now",
  "fe_tranche_final_approval_allowed_now",
  "factory_promotion_goal_complete_allowed_now",
].includes(flag));

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryFeFreezeHandoff(options = {}) {
  const result = await buildFactoryFeFreezeHandoff(options);
  if (!options.check && options.write !== false) await writeFactoryFeFreezeHandoff(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory FE Freeze Handoff failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_fe_freeze_handoff_status !== READY_STATUS) {
    const error = new Error("Factory FE Freeze Handoff is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryFeFreezeHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_FE_FREEZE_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const prdIntake = Object.prototype.hasOwnProperty.call(options, "prdIntake")
    ? options.prdIntake
    : await buildFactoryPrdIntake({
      ...options,
      outDir: path.join(outputDir, "source-prd-intake"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });
  const workPacketDecomposition = Object.prototype.hasOwnProperty.call(options, "workPacketDecomposition")
    ? options.workPacketDecomposition
    : await buildFactoryWorkPacketDecomposition({
      ...options,
      outDir: path.join(outputDir, "source-work-packet-decomposition"),
      runAt: generatedAt,
      write: false,
      commitRef,
      prdIntake,
    });
  const validationLoopInstantiation = Object.prototype.hasOwnProperty.call(options, "validationLoopInstantiation")
    ? options.validationLoopInstantiation
    : await buildFactoryValidationLoopInstantiation({
      ...options,
      outDir: path.join(outputDir, "source-validation-loop-instantiation"),
      runAt: generatedAt,
      write: false,
      commitRef,
      workPacketDecomposition,
    });
  const reviewReceiptSources = await readReviewReceiptSources(inputs);
  const sourceState = summarizeFeChain({
    prdIntake,
    workPacketDecomposition,
    validationLoopInstantiation,
    structuredSummary,
    reviewReceiptSources,
  });
  const evidenceRows = buildEvidenceRows({ sourceState, generatedAt });
  const canonicalHashRows = buildCanonicalHashRows({ evidenceRows, sourceState, generatedAt });
  const reviewPacketRows = buildReviewPacketRows({ sourceState, evidenceRows, canonicalHashRows, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({
    sourceState,
    prdIntake,
    workPacketDecomposition,
    validationLoopInstantiation,
    structuredSummary,
    reviewReceiptSources,
    generatedAt,
  });
  const boundary = buildBoundary({
    sourceState,
    evidenceRows,
    canonicalHashRows,
    reviewPacketRows,
    negativeFixtureRows,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    sourceState,
    evidenceRows,
    canonicalHashRows,
    reviewPacketRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceState,
    evidenceRows,
    canonicalHashRows,
    reviewPacketRows,
    negativeFixtureRows,
    boundary,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      package_path: packageJson.path,
      structured_summary_path: structuredSummary.path,
      prd_path: inputs.prd_path,
      factory_promotion_docs_dir: inputs.factory_promotion_docs_dir,
      fe1_prd_source_sha256: sourceState.fe1_prd_source_sha256,
      fe2_candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
      fe3_candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
      fe3_source_candidate_bundle_sha256: sourceState.fe3_source_candidate_bundle_sha256,
    },
    source_summaries: {
      fe1_summary: prdIntake?.summary ?? null,
      fe2_summary: workPacketDecomposition?.summary ?? null,
      fe3_summary: validationLoopInstantiation?.summary ?? null,
      structured_summary_package_version: structuredSummary.data?.package_version ?? null,
    },
    factory_fe_freeze_source_chain: sourceState.public_source_chain,
    factory_fe_chain_evidence_rows: evidenceRows,
    factory_fe_canonical_hash_rows: canonicalHashRows,
    factory_fe_review_packet_rows: reviewPacketRows,
    factory_fe_freeze_negative_fixture_rows: negativeFixtureRows,
    factory_fe_freeze_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryFeFreezeHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-fe-freeze-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "fe-chain-evidence-rows.json"), collectionEnvelope("factory-fe-chain-evidence-rows.v1", "factory_fe_chain_evidence_rows", result.factory_fe_chain_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "fe-canonical-hash-rows.json"), collectionEnvelope("factory-fe-canonical-hash-rows.v1", "factory_fe_canonical_hash_rows", result.factory_fe_canonical_hash_rows, result.generated_at));
  await writeJson(path.join(outDir, "fe-review-packet-rows.json"), collectionEnvelope("factory-fe-review-packet-rows.v1", "factory_fe_review_packet_rows", result.factory_fe_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-fe-freeze-negative-fixture-rows.v1", "factory_fe_freeze_negative_fixture_rows", result.factory_fe_freeze_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_fe_freeze_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-fe-freeze-handoff-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryFeFreezeHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryFeFreezeHandoff(args);
    console.log(`Factory FE Freeze Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_fe_freeze_handoff_status}`);
    console.log(`Evidence rows: ${result.summary.fe_chain_evidence_row_count}`);
    console.log(`Canonical hash rows: ${result.summary.canonical_hash_row_count}`);
    console.log(`Review packet rows: ${result.summary.review_packet_row_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`FE review packet ready: ${result.summary.fe_review_packet_ready_now}`);
    console.log(`Validation loop execution allowed: ${result.summary.validation_loop_execution_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function summarizeFeChain({ prdIntake, workPacketDecomposition, validationLoopInstantiation, structuredSummary, reviewReceiptSources }) {
  const fe1Summary = prdIntake?.summary ?? {};
  const fe2Summary = workPacketDecomposition?.summary ?? {};
  const fe3Summary = validationLoopInstantiation?.summary ?? {};
  const fe3RawTextGuard = validationLoopInstantiation?.factory_validation_loop_raw_text_guard ?? {};
  const structured = structuredSummary.data ?? {};
  const receiptRows = buildReviewReceiptRows({ structured, reviewReceiptSources });
  const fe1Ready = prdIntake?.validation?.valid === true
    && fe1Summary.factory_prd_intake_status === "ready_factory_prd_intake"
    && fe1Summary.fe2_work_packet_generation_allowed_next === true;
  const fe2Ready = workPacketDecomposition?.validation?.valid === true
    && fe2Summary.factory_work_packet_decomposition_status === "ready_factory_work_packet_decomposition"
    && fe2Summary.fe3_loop_instantiation_allowed_next === true;
  const fe3Ready = validationLoopInstantiation?.validation?.valid === true
    && fe3Summary.factory_validation_loop_instantiation_status === "ready_factory_validation_loop_instantiation"
    && fe3Summary.fe4_freeze_review_allowed_next === true;
  const sourceHashChainReady = HASH_RE.test(fe1Summary.prd_source_sha256 ?? "")
    && fe2Summary.source_prd_sha256 === fe1Summary.prd_source_sha256
    && HASH_RE.test(fe2Summary.candidate_bundle_sha256 ?? "")
    && fe3Summary.source_candidate_bundle_sha256 === fe2Summary.candidate_bundle_sha256
    && HASH_RE.test(fe3Summary.candidate_bundle_sha256 ?? "");
  const countVectorReady = fe1Summary.source_span_count >= 100
    && fe1Summary.requirement_row_count === 15
    && fe1Summary.tuw_seed_row_count === 15
    && fe2Summary.work_packet_candidate_count === 15
    && fe2Summary.work_item_candidate_count === 60
    && fe2Summary.dependency_row_count === 14
    && fe3Summary.validation_loop_candidate_count === 15
    && fe3Summary.validation_loop_step_candidate_count === 150
    && fe3Summary.validation_loop_gate_count === 90;
  const rawTextGuardReady = fe1Summary.raw_prd_text_persisted_in_artifact === false
    && fe2Summary.raw_prd_text_persisted_in_artifact === false
    && fe3Summary.raw_prd_text_persisted_in_artifact === false
    && fe3Summary.raw_text_guard_status === "ready_no_raw_prd_text_leak_detected"
    && fe3RawTextGuard.raw_text_leak_found === false
    && fe3RawTextGuard.leak_count === 0
    && fe3RawTextGuard.scanned_snippet_count > 0
    && fe3RawTextGuard.scanned_string_field_count > 0;
  const negativeFixturesReady = fe1Summary.negative_fixture_blocked_count === fe1Summary.negative_fixture_count
    && fe2Summary.negative_fixture_blocked_count === fe2Summary.negative_fixture_count
    && fe3Summary.negative_fixture_blocked_count === fe3Summary.negative_fixture_count
    && fe1Summary.negative_fixture_count >= 5
    && fe2Summary.negative_fixture_count >= 6
    && fe3Summary.negative_fixture_count >= 6;
  const sourceAuthorityClosed = sourceAuthorityClosedForSummary(fe1Summary)
    && sourceAuthorityClosedForSummary(fe2Summary)
    && sourceAuthorityClosedForSummary(fe3Summary);
  const reviewEvidenceReady = receiptRows.length === REVIEW_RECEIPTS.length
    && receiptRows.every((row) => row.review_receipt_status === "valid_approve_no_findings");
  const status = fe1Ready
    && fe2Ready
    && fe3Ready
    && sourceHashChainReady
    && countVectorReady
    && rawTextGuardReady
    && negativeFixturesReady
    && sourceAuthorityClosed
    && reviewEvidenceReady
    ? "ready_fe1_fe3_chain_for_fe4_freeze"
    : "blocked_fe1_fe3_chain_for_fe4_freeze";
  const productIds = [...new Set(fe3Summary.product_ids ?? [])].filter(Boolean);
  return {
    status,
    fe1_ready: fe1Ready,
    fe2_ready: fe2Ready,
    fe3_ready: fe3Ready,
    review_evidence_ready: reviewEvidenceReady,
    source_hash_chain_ready: sourceHashChainReady,
    count_vector_ready: countVectorReady,
    raw_text_guard_ready: rawTextGuardReady,
    negative_fixtures_ready: negativeFixturesReady,
    source_authority_closed: sourceAuthorityClosed,
    product_ids: productIds,
    product_scope_count: productIds.length,
    fe1_prd_source_sha256: fe1Summary.prd_source_sha256 ?? null,
    fe2_source_prd_sha256: fe2Summary.source_prd_sha256 ?? null,
    fe2_candidate_bundle_sha256: fe2Summary.candidate_bundle_sha256 ?? null,
    fe3_source_candidate_bundle_sha256: fe3Summary.source_candidate_bundle_sha256 ?? null,
    fe3_candidate_bundle_sha256: fe3Summary.candidate_bundle_sha256 ?? null,
    fe1_counts: {
      source_span_count: fe1Summary.source_span_count ?? 0,
      requirement_row_count: fe1Summary.requirement_row_count ?? 0,
      tuw_seed_row_count: fe1Summary.tuw_seed_row_count ?? 0,
      negative_fixture_count: fe1Summary.negative_fixture_count ?? 0,
      negative_fixture_blocked_count: fe1Summary.negative_fixture_blocked_count ?? 0,
    },
    fe2_counts: {
      work_packet_candidate_count: fe2Summary.work_packet_candidate_count ?? 0,
      work_item_candidate_count: fe2Summary.work_item_candidate_count ?? 0,
      dependency_row_count: fe2Summary.dependency_row_count ?? 0,
      negative_fixture_count: fe2Summary.negative_fixture_count ?? 0,
      negative_fixture_blocked_count: fe2Summary.negative_fixture_blocked_count ?? 0,
    },
    fe3_counts: {
      validation_loop_candidate_count: fe3Summary.validation_loop_candidate_count ?? 0,
      validation_loop_step_candidate_count: fe3Summary.validation_loop_step_candidate_count ?? 0,
      validation_loop_gate_count: fe3Summary.validation_loop_gate_count ?? 0,
      negative_fixture_count: fe3Summary.negative_fixture_count ?? 0,
      negative_fixture_blocked_count: fe3Summary.negative_fixture_blocked_count ?? 0,
      raw_text_guard_scanned_snippet_count: fe3RawTextGuard.scanned_snippet_count ?? fe3Summary.raw_text_guard_scanned_snippet_count ?? 0,
      raw_text_guard_scanned_string_field_count: fe3RawTextGuard.scanned_string_field_count ?? fe3Summary.raw_text_guard_scanned_string_field_count ?? 0,
    },
    review_receipt_rows: receiptRows,
    public_source_chain: {
      schema_version: "factory-fe-freeze-source-chain.v1",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_status: status,
      product_ids: productIds,
      product_scope_count: productIds.length,
      fe1_ready: fe1Ready,
      fe2_ready: fe2Ready,
      fe3_ready: fe3Ready,
      review_evidence_ready: reviewEvidenceReady,
      source_hash_chain_ready: sourceHashChainReady,
      count_vector_ready: countVectorReady,
      raw_text_guard_ready: rawTextGuardReady,
      negative_fixtures_ready: negativeFixturesReady,
      source_authority_closed: sourceAuthorityClosed,
      fe1_prd_source_sha256: fe1Summary.prd_source_sha256 ?? null,
      fe2_candidate_bundle_sha256: fe2Summary.candidate_bundle_sha256 ?? null,
      fe3_candidate_bundle_sha256: fe3Summary.candidate_bundle_sha256 ?? null,
    },
  };
}

function buildReviewReceiptRows({ structured, reviewReceiptSources }) {
  return REVIEW_RECEIPTS.map(([phaseLabel, phaseKey, programRange, subject, receiptFile]) => {
    const source = reviewReceiptSources.get(receiptFile) ?? { available: false, text: "", path: receiptFile };
    const status = structured[`${phaseKey}_status`] ?? "";
    const reviewStatus = structured[`${phaseKey}_claude_code_review_status`] ?? "";
    const model = structured[`${phaseKey}_claude_code_review_resolved_model`] ?? structured[`${phaseKey}_claude_code_review_model_alias`] ?? "";
    const aggregateBlockingFindings = structured[`${phaseKey}_claude_code_review_blocking_findings`];
    const blockingFindings = aggregateBlockingFindings === undefined
      ? Number(structured[`${phaseKey}_claude_code_review_p0_findings`] ?? 0)
        + Number(structured[`${phaseKey}_claude_code_review_p1_findings`] ?? 0)
        + Number(structured[`${phaseKey}_claude_code_review_p2_findings`] ?? 0)
      : Number(aggregateBlockingFindings);
    const nonBlockingFindings = Number(structured[`${phaseKey}_claude_code_review_non_blocking_findings`] ?? structured[`${phaseKey}_claude_code_review_p3_findings`] ?? 0);
    const text = source.text ?? "";
    const receiptReady = source.available === true
      && text.includes(programRange)
      && text.includes(subject)
      && text.includes("claude-opus-4-8")
      && text.includes("`APPROVE`")
      && text.includes("0/0/0/0")
      && String(status).includes("lawos_style_claude_reviewed")
      && String(reviewStatus).includes("valid_approve")
      && model === "claude-opus-4-8"
      && blockingFindings === 0
      && nonBlockingFindings === 0
      && structured[`${phaseKey}_claude_final_approval_allowed_now`] === false
      && structured[`${phaseKey}_source_mutation_performed_by_claude`] === false;
    return {
      schema_version: "factory-fe-review-receipt-row.v1",
      phase_label: phaseLabel,
      phase_key: phaseKey,
      program_range: programRange,
      subject,
      receipt_doc: path.normalize(source.path),
      receipt_doc_available: source.available === true,
      receipt_doc_sha256: source.available ? hashString(text) : null,
      structured_summary_status: status || null,
      structured_summary_review_status: reviewStatus || null,
      resolved_model: model || null,
      blocking_finding_count: blockingFindings,
      non_blocking_finding_count: nonBlockingFindings,
      review_receipt_status: receiptReady ? "valid_approve_no_findings" : "blocked_review_receipt_evidence",
      source_mutation_performed_by_claude: structured[`${phaseKey}_source_mutation_performed_by_claude`] === true,
      claude_final_approval_allowed_now: structured[`${phaseKey}_claude_final_approval_allowed_now`] === true,
    };
  });
}

function buildEvidenceRows({ sourceState, generatedAt }) {
  const rows = [
    evidenceRow("fe1_prd_intake_ready", "FE.1 PRD intake is ready and reviewed", sourceState.fe1_ready, {
      phase: "FE.1",
      source_sha256: sourceState.fe1_prd_source_sha256,
      source_spans: sourceState.fe1_counts.source_span_count,
      requirements: sourceState.fe1_counts.requirement_row_count,
      tuw_seed_rows: sourceState.fe1_counts.tuw_seed_row_count,
    }, generatedAt),
    evidenceRow("fe2_work_packet_decomposition_ready", "FE.2 work-packet decomposition is ready and reviewed", sourceState.fe2_ready, {
      phase: "FE.2",
      source_prd_sha256: sourceState.fe2_source_prd_sha256,
      candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
      work_packet_candidates: sourceState.fe2_counts.work_packet_candidate_count,
      work_item_candidates: sourceState.fe2_counts.work_item_candidate_count,
      dependency_rows: sourceState.fe2_counts.dependency_row_count,
    }, generatedAt),
    evidenceRow("fe3_validation_loop_instantiation_ready", "FE.3 validation loop candidates are ready and reviewed", sourceState.fe3_ready, {
      phase: "FE.3",
      source_candidate_bundle_sha256: sourceState.fe3_source_candidate_bundle_sha256,
      candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
      validation_loop_candidates: sourceState.fe3_counts.validation_loop_candidate_count,
      loop_step_candidates: sourceState.fe3_counts.validation_loop_step_candidate_count,
      loop_gate_rows: sourceState.fe3_counts.validation_loop_gate_count,
    }, generatedAt),
    evidenceRow("fe_review_receipts_valid", "FE.1-FE.3 review receipts are valid Opus 4.8 approve/no-finding evidence", sourceState.review_evidence_ready, {
      review_receipt_count: sourceState.review_receipt_rows.length,
      valid_review_receipt_count: sourceState.review_receipt_rows.filter((row) => row.review_receipt_status === "valid_approve_no_findings").length,
      receipt_docs: sourceState.review_receipt_rows.map((row) => row.receipt_doc),
    }, generatedAt),
    evidenceRow("fe_source_hash_chain_bound", "FE source hashes chain from PRD to work packets to validation loop bundle", sourceState.source_hash_chain_ready, {
      fe1_prd_source_sha256: sourceState.fe1_prd_source_sha256,
      fe2_source_prd_sha256: sourceState.fe2_source_prd_sha256,
      fe2_candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
      fe3_source_candidate_bundle_sha256: sourceState.fe3_source_candidate_bundle_sha256,
      fe3_candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
    }, generatedAt),
    evidenceRow("fe_count_vector_complete", "FE count vector matches intake/decomposition/loop expectations", sourceState.count_vector_ready, {
      fe1_counts: sourceState.fe1_counts,
      fe2_counts: sourceState.fe2_counts,
      fe3_counts: sourceState.fe3_counts,
    }, generatedAt),
    evidenceRow("fe_raw_text_guard_closed", "FE artifacts do not persist raw PRD text and FE.3 raw-text guard is non-vacuous", sourceState.raw_text_guard_ready, {
      fe3_raw_text_guard_scanned_snippet_count: sourceState.fe3_counts.raw_text_guard_scanned_snippet_count,
      fe3_raw_text_guard_scanned_string_field_count: sourceState.fe3_counts.raw_text_guard_scanned_string_field_count,
    }, generatedAt),
    evidenceRow("fe_negative_fixtures_blocked", "FE.1-FE.3 negative fixtures remain blocked", sourceState.negative_fixtures_ready, {
      fe1_negative_fixture_count: sourceState.fe1_counts.negative_fixture_count,
      fe1_negative_fixture_blocked_count: sourceState.fe1_counts.negative_fixture_blocked_count,
      fe2_negative_fixture_count: sourceState.fe2_counts.negative_fixture_count,
      fe2_negative_fixture_blocked_count: sourceState.fe2_counts.negative_fixture_blocked_count,
      fe3_negative_fixture_count: sourceState.fe3_counts.negative_fixture_count,
      fe3_negative_fixture_blocked_count: sourceState.fe3_counts.negative_fixture_blocked_count,
    }, generatedAt),
    evidenceRow("fe_authority_boundary_closed", "FE chain keeps execution/write/deploy/finality authority closed", sourceState.source_authority_closed, {
      authority_false_flags: AUTHORITY_FALSE_FLAGS,
      product_ids: sourceState.product_ids,
    }, generatedAt),
    evidenceRow("fe4_review_packet_ready", "FE.4 review packet can be handed to independent reviewer", sourceState.status === "ready_fe1_fe3_chain_for_fe4_freeze", {
      next_required_review: "Claude Code Opus 4.8 Max read-only review",
      owner_adjudication_required_after_review: true,
      g_series_gate_opening_allowed_now: false,
    }, generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, evidence_order: index + 1 }));
}

function evidenceRow(rowId, label, pass, details, generatedAt) {
  return {
    schema_version: "factory-fe-chain-evidence-row.v1",
    evidence_row_id: rowId,
    label,
    current_verdict: pass ? "pass" : "block",
    evidence_status: pass ? "ready" : "blocked",
    details,
    raw_prd_text_persisted_in_artifact: false,
    authority_opened_by_evidence: false,
    generated_at: generatedAt,
  };
}

function buildCanonicalHashRows({ evidenceRows, sourceState, generatedAt }) {
  let previousChainHash = "0".repeat(64);
  return evidenceRows.map((row, index) => {
    const rowHash = hashValue({
      evidence_row_id: row.evidence_row_id,
      evidence_status: row.evidence_status,
      current_verdict: row.current_verdict,
      details: row.details,
      fe1_prd_source_sha256: sourceState.fe1_prd_source_sha256,
      fe2_candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
      fe3_candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
    });
    const chainHash = hashValue({ previous_chain_hash: previousChainHash, row_hash: rowHash, row_order: index + 1 });
    const hashRow = {
      schema_version: "factory-fe-canonical-hash-row.v1",
      hash_row_id: `factory-fe-freeze-hash.${String(index + 1).padStart(2, "0")}.${row.evidence_row_id}`,
      evidence_row_id: row.evidence_row_id,
      hash_scope: "fe_freeze_handoff_run",
      row_order: index + 1,
      evidence_row_sha256: rowHash,
      previous_chain_sha256: previousChainHash,
      chain_sha256: chainHash,
      source_hash_chain_ready: sourceState.source_hash_chain_ready,
      ledger_append_allowed_now: false,
      generated_at: generatedAt,
    };
    previousChainHash = chainHash;
    return hashRow;
  });
}

function buildReviewPacketRows({ sourceState, evidenceRows, canonicalHashRows, generatedAt }) {
  const finalHash = canonicalHashRows.at(-1)?.chain_sha256 ?? null;
  const ready = sourceState.status === "ready_fe1_fe3_chain_for_fe4_freeze"
    && evidenceRows.every((row) => row.current_verdict === "pass")
    && canonicalHashRows.length === evidenceRows.length
    && HASH_RE.test(finalHash ?? "");
  return [{
    schema_version: "factory-fe-review-packet-row.v1",
    review_packet_id: `factory-fe-review-packet.${dateStamp(generatedAt)}.${productScopeSlug(sourceState.product_ids)}`,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    product_ids: sourceState.product_ids,
    product_scope_count: sourceState.product_scope_count,
    review_packet_status: ready ? "ready_for_independent_fe4_review" : "blocked_fe4_review_packet",
    evidence_row_count: evidenceRows.length,
    evidence_pass_count: evidenceRows.filter((row) => row.current_verdict === "pass").length,
    canonical_hash_row_count: canonicalHashRows.length,
    canonical_chain_sha256: finalHash,
    fe1_prd_source_sha256: sourceState.fe1_prd_source_sha256,
    fe2_candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
    fe3_candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
    independent_review_required_before_closeout: true,
    human_owner_adjudication_required_after_review: true,
    claude_review_receipt_slot_status: "empty_for_fe4_review",
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    validation_loop_execution_allowed_now: false,
    worker_execution_allowed_now: false,
    verifier_finality_allowed_now: false,
    gate_opening_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    generated_at: generatedAt,
  }];
}

function buildNegativeFixtureRows({
  sourceState,
  prdIntake,
  workPacketDecomposition,
  validationLoopInstantiation,
  structuredSummary,
  reviewReceiptSources,
  generatedAt,
}) {
  const fixtureStates = [
    ["fe3_validation_loop_not_ready", "FE.3 source loop instantiation blocked", ({ loop }) => {
      loop.summary.factory_validation_loop_instantiation_status = "blocked_factory_validation_loop_instantiation";
    }],
    ["missing_fe3_review_evidence", "FE.3 independent review evidence missing", ({ structured }) => {
      structured.data.fe3_claude_code_review_status = "pending_opus_4_8_review";
    }],
    ["source_chain_hash_mismatch", "FE.3 source candidate bundle does not match FE.2 bundle", ({ loop }) => {
      loop.summary.source_candidate_bundle_sha256 = "f".repeat(64);
    }],
    ["validation_loop_execution_flag_opened", "Validation loop execution flag opened during freeze", ({ loop }) => {
      loop.summary.validation_loop_execution_allowed_now = true;
    }],
    ["final_approval_flag_opened", "Codex or Claude final approval opened during freeze", ({ loop }) => {
      loop.summary.codex_final_approval_allowed_now = true;
    }],
    ["raw_prd_text_guard_blocked", "Raw PRD text guard blocked or leak observed", ({ loop }) => {
      loop.summary.raw_text_guard_status = "blocked_raw_prd_text_guard";
      loop.factory_validation_loop_raw_text_guard.raw_text_leak_found = true;
      loop.factory_validation_loop_raw_text_guard.leak_count = 1;
    }],
    ["dropped_negative_fixture_coverage", "FE negative fixture coverage dropped below required count", ({ loop }) => {
      loop.summary.negative_fixture_blocked_count = Math.max(0, Number(loop.summary.negative_fixture_blocked_count ?? 0) - 1);
    }],
  ];
  return fixtureStates.map(([fixtureKey, description, mutate]) => {
    const simulatedInputs = {
      prdIntake: cloneJson(prdIntake),
      workPacketDecomposition: cloneJson(workPacketDecomposition),
      validationLoopInstantiation: cloneJson(validationLoopInstantiation),
      structuredSummary: cloneJson(structuredSummary),
    };
    mutate({
      prd: simulatedInputs.prdIntake,
      work: simulatedInputs.workPacketDecomposition,
      loop: simulatedInputs.validationLoopInstantiation,
      structured: simulatedInputs.structuredSummary,
    });
    const simulated = summarizeFeChain({
      prdIntake: simulatedInputs.prdIntake,
      workPacketDecomposition: simulatedInputs.workPacketDecomposition,
      validationLoopInstantiation: simulatedInputs.validationLoopInstantiation,
      structuredSummary: simulatedInputs.structuredSummary,
      reviewReceiptSources,
    });
    const blocked = evaluateSourceStateReady(simulated) === false;
    return {
      schema_version: "factory-fe-freeze-negative-fixture-row.v1",
      fixture_key: fixtureKey,
      description,
      expected_result: "block",
      observed_result: blocked ? "block" : "pass",
      fixture_status: blocked ? "blocked_as_expected" : "unexpected_pass",
      observed_blocked_checks: blockedSourceStateChecks(simulated),
      source_authority_closed_after_mutation: simulated.source_authority_closed,
      command_execution_allowed_now: false,
      validation_loop_execution_allowed_now: false,
      source_file_write_allowed_now: false,
      repo_write_allowed_now: false,
      generated_at: generatedAt,
    };
  });
}

function buildBoundary({ sourceState, evidenceRows, canonicalHashRows, reviewPacketRows, negativeFixtureRows, generatedAt }) {
  const reviewPacketReady = reviewPacketRows.length === 1
    && reviewPacketRows[0].review_packet_status === "ready_for_independent_fe4_review";
  return {
    schema_version: "factory-fe-freeze-boundary.v1",
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    read_only_freeze_handoff: true,
    source_chain_status: sourceState.status,
    product_ids: sourceState.product_ids,
    product_scope_count: sourceState.product_scope_count,
    fe_chain_evidence_row_count: evidenceRows.length,
    fe_chain_evidence_pass_count: evidenceRows.filter((row) => row.current_verdict === "pass").length,
    canonical_hash_row_count: canonicalHashRows.length,
    canonical_chain_sha256: canonicalHashRows.at(-1)?.chain_sha256 ?? null,
    review_packet_row_count: reviewPacketRows.length,
    fe_review_packet_ready_now: reviewPacketReady,
    fe_tranche_freeze_candidate_ready_now: reviewPacketReady,
    independent_review_required_before_fe_closeout: true,
    human_owner_adjudication_required_after_independent_review: true,
    g_series_program_required_before_gate_opening: true,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    ...AUTHORITY_CLOSED,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ packageJson, structuredSummary, sourceState, evidenceRows, canonicalHashRows, reviewPacketRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "wiring", scripts[COMMAND_NAME] === "node scripts/factory-fe-freeze-handoff.mjs", `${COMMAND_NAME} package script must be registered`),
    validationItem("structured_summary.fe1_ready", "source_chain", structuredSummary.data?.fe1_status === "ready_factory_prd_intake_lawos_style_claude_reviewed", "FE.1 must be reviewed before FE.4 freeze"),
    validationItem("structured_summary.fe2_ready", "source_chain", structuredSummary.data?.fe2_status === "ready_factory_work_packet_decomposition_lawos_style_claude_reviewed", "FE.2 must be reviewed before FE.4 freeze"),
    validationItem("structured_summary.fe3_ready", "source_chain", structuredSummary.data?.fe3_status === "ready_factory_validation_loop_instantiation_lawos_style_claude_reviewed", "FE.3 must be reviewed before FE.4 freeze"),
    validationItem("source.fe1_ready", "source_chain", sourceState.fe1_ready === true, "FE.1 intake source must be ready"),
    validationItem("source.fe2_ready", "source_chain", sourceState.fe2_ready === true, "FE.2 work-packet decomposition source must be ready"),
    validationItem("source.fe3_ready", "source_chain", sourceState.fe3_ready === true, "FE.3 validation loop instantiation source must be ready"),
    validationItem("source.review_evidence", "review", sourceState.review_evidence_ready === true, "FE.1-FE.3 independent review receipts must be valid approve/no-finding evidence"),
    validationItem("source.hash_chain", "source_chain", sourceState.source_hash_chain_ready === true, "FE source hashes must chain from PRD to FE.3 bundle"),
    validationItem("source.count_vector", "source_chain", sourceState.count_vector_ready === true, "FE count vector must be complete"),
    validationItem("source.raw_text_guard", "authority", sourceState.raw_text_guard_ready === true, "FE raw PRD text guard must be ready and non-vacuous"),
    validationItem("source.negative_fixtures", "negative_fixture", sourceState.negative_fixtures_ready === true, "FE.1-FE.3 negative fixtures must remain blocked"),
    validationItem("source.authority_closed", "authority", sourceState.source_authority_closed === true, "FE.1-FE.3 source summaries must keep authority false"),
    validationItem("evidence.rows", "evidence", evidenceRows.length === 10 && evidenceRows.every((row) => row.current_verdict === "pass" && row.authority_opened_by_evidence === false), "All FE evidence rows must pass without opening authority"),
    validationItem("hash.rows", "evidence", canonicalHashRows.length === evidenceRows.length && canonicalHashRows.every((row) => HASH_RE.test(row.evidence_row_sha256) && HASH_RE.test(row.chain_sha256) && row.ledger_append_allowed_now === false), "Canonical hash rows must cover every evidence row without ledger append"),
    validationItem("hash.chain", "evidence", hashRowsChain(canonicalHashRows), "Canonical hash rows must form a strict chain"),
    validationItem("review_packet.ready", "review", reviewPacketRows.length === 1 && reviewPacketRows[0].review_packet_status === "ready_for_independent_fe4_review", "FE.4 review packet must be ready for independent review"),
    validationItem("review_packet.no_finality", "authority", reviewPacketRows.every((row) => row.review_decision_allowed_now === false && row.approval_allowed_now === false && row.verifier_finality_allowed_now === false), "FE.4 review packet must not grant review/finality authority"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 7 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "All FE.4 negative fixtures must remain blocked"),
    validationItem("boundary.review_packet", "boundary", boundary.fe_review_packet_ready_now === true && boundary.fe_tranche_freeze_candidate_ready_now === true, "Boundary must expose review packet readiness only"),
    validationItem("boundary.execution_closed", "authority", boundary.command_execution_enabled === false && boundary.validation_loop_execution_allowed_now === false && boundary.worker_execution_allowed_now === false && boundary.fe_runtime_loop_execution_enabled_now === false, "FE.4 must not open command, loop, or worker execution"),
    validationItem("boundary.finality_closed", "authority", boundary.codex_final_approval_allowed_now === false && boundary.claude_final_approval_allowed_now === false && boundary.verifier_finality_allowed_now === false && boundary.fe_tranche_final_approval_allowed_now === false, "FE.4 must not open finality"),
    validationItem("boundary.write_apply_closed", "authority", boundary.source_file_write_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.apply_allowed_now === false && boundary.ledger_append_allowed_now === false, "FE.4 must not open write, apply, or ledger authority"),
    validationItem("boundary.trust_closed", "authority", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false && boundary.factory_promotion_goal_complete_allowed_now === false, "FE.4 must not grant production, enterprise, or goal-complete trust"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All FE.4 authority flags must remain false"),
  ];
}

function buildSummary({ sourceState, evidenceRows, canonicalHashRows, reviewPacketRows, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid
    && evaluateSourceStateReady(sourceState)
    && evidenceRows.every((row) => row.current_verdict === "pass")
    && reviewPacketRows.length === 1
    && reviewPacketRows[0].review_packet_status === "ready_for_independent_fe4_review"
    && allAuthorityClosed(boundary);
  return {
    factory_fe_freeze_handoff_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_chain_status: sourceState.status,
    product_ids: sourceState.product_ids,
    product_scope_count: sourceState.product_scope_count,
    fe1_prd_source_sha256: sourceState.fe1_prd_source_sha256,
    fe2_candidate_bundle_sha256: sourceState.fe2_candidate_bundle_sha256,
    fe3_candidate_bundle_sha256: sourceState.fe3_candidate_bundle_sha256,
    fe1_ready: sourceState.fe1_ready,
    fe2_ready: sourceState.fe2_ready,
    fe3_ready: sourceState.fe3_ready,
    review_evidence_ready: sourceState.review_evidence_ready,
    source_hash_chain_ready: sourceState.source_hash_chain_ready,
    count_vector_ready: sourceState.count_vector_ready,
    raw_text_guard_ready: sourceState.raw_text_guard_ready,
    negative_fixtures_ready: sourceState.negative_fixtures_ready,
    source_authority_closed: sourceState.source_authority_closed,
    fe_chain_evidence_row_count: evidenceRows.length,
    fe_chain_evidence_pass_count: evidenceRows.filter((row) => row.current_verdict === "pass").length,
    canonical_hash_row_count: canonicalHashRows.length,
    canonical_chain_sha256: canonicalHashRows.at(-1)?.chain_sha256 ?? null,
    review_packet_row_count: reviewPacketRows.length,
    fe_review_packet_ready_now: boundary.fe_review_packet_ready_now,
    fe_tranche_freeze_candidate_ready_now: boundary.fe_tranche_freeze_candidate_ready_now,
    independent_review_required_before_fe_closeout: true,
    human_owner_adjudication_required_after_independent_review: true,
    g_series_program_required_before_gate_opening: true,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    validation_errors: validation.errors.length,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    ...AUTHORITY_CLOSED,
  };
}

function evaluateSourceStateReady(sourceState) {
  return sourceState.fe1_ready === true
    && sourceState.fe2_ready === true
    && sourceState.fe3_ready === true
    && sourceState.review_evidence_ready === true
    && sourceState.source_hash_chain_ready === true
    && sourceState.count_vector_ready === true
    && sourceState.raw_text_guard_ready === true
    && sourceState.negative_fixtures_ready === true
    && sourceState.source_authority_closed === true;
}

function blockedSourceStateChecks(sourceState) {
  return [
    ["fe1_ready", sourceState.fe1_ready],
    ["fe2_ready", sourceState.fe2_ready],
    ["fe3_ready", sourceState.fe3_ready],
    ["review_evidence_ready", sourceState.review_evidence_ready],
    ["source_hash_chain_ready", sourceState.source_hash_chain_ready],
    ["count_vector_ready", sourceState.count_vector_ready],
    ["raw_text_guard_ready", sourceState.raw_text_guard_ready],
    ["negative_fixtures_ready", sourceState.negative_fixtures_ready],
    ["source_authority_closed", sourceState.source_authority_closed],
  ].filter(([, value]) => value !== true).map(([key]) => key);
}

function hashRowsChain(rows) {
  let previous = "0".repeat(64);
  for (const row of rows) {
    if (row.previous_chain_sha256 !== previous) return false;
    if (!HASH_RE.test(row.chain_sha256 ?? "") || !HASH_RE.test(row.evidence_row_sha256 ?? "")) return false;
    previous = row.chain_sha256;
  }
  return rows.length > 0;
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-fe-freeze-handoff-validation-item.v1",
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

function renderMarkdown(result) {
  return [
    "# Factory FE Freeze Handoff",
    "",
    `Status: ${result.summary.factory_fe_freeze_handoff_status}`,
    `Program: ${result.summary.program_range}`,
    `Source chain: ${result.summary.source_chain_status}`,
    `Products: ${result.summary.product_ids.join(", ")}`,
    `FE.1 ready: ${result.summary.fe1_ready}`,
    `FE.2 ready: ${result.summary.fe2_ready}`,
    `FE.3 ready: ${result.summary.fe3_ready}`,
    `Review evidence ready: ${result.summary.review_evidence_ready}`,
    `Evidence rows: ${result.summary.fe_chain_evidence_pass_count}/${result.summary.fe_chain_evidence_row_count}`,
    `Canonical hash rows: ${result.summary.canonical_hash_row_count}`,
    `Canonical chain SHA-256: ${result.summary.canonical_chain_sha256}`,
    `Review packet ready: ${result.summary.fe_review_packet_ready_now}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Validation loop execution allowed: ${result.summary.validation_loop_execution_allowed_now}`,
    `Worker execution allowed: ${result.summary.worker_execution_allowed_now}`,
    `Verifier finality allowed: ${result.summary.verifier_finality_allowed_now}`,
    `Production pass enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise pass enabled: ${result.summary.enterprise_pass_enabled}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

async function readReviewReceiptSources(inputs) {
  const entries = await Promise.all(REVIEW_RECEIPTS.map(async ([, , , , receiptFile]) => {
    const source = await readTextSource(path.join(inputs.factory_promotion_docs_dir, receiptFile));
    return [receiptFile, source];
  }));
  return new Map(entries);
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((key) => value[key] === false);
}

function sourceAuthorityClosedForSummary(value) {
  return SOURCE_AUTHORITY_FALSE_FLAGS.every((key) => value[key] === undefined || value[key] === false);
}

function productScopeSlug(productIds) {
  const slug = (productIds ?? []).map((productId) => normalizeKey(productId)).filter(Boolean).join("__");
  return slug || "no_product_scope";
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, data: JSON.parse(await readFile(resolved, "utf8")) };
  } catch (error) {
    return { path: resolved, available: false, data: null, error: error.code ?? error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath ?? "");
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.code ?? error.message };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? DEFAULT_FACTORY_FE_FREEZE_HANDOFF_INPUTS.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? DEFAULT_FACTORY_FE_FREEZE_HANDOFF_INPUTS.structuredSummaryPath),
    prd_path: path.resolve(repoRoot, options.prdPath ?? DEFAULT_FACTORY_FE_FREEZE_HANDOFF_INPUTS.prdPath),
    factory_promotion_docs_dir: path.resolve(repoRoot, options.factoryPromotionDocsDir ?? DEFAULT_FACTORY_FE_FREEZE_HANDOFF_INPUTS.factoryPromotionDocsDir),
  };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashString(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return String(value).slice(0, 10).replaceAll("-", "");
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
    else if (arg === "--package-path") parsed.packagePath = argv[++index];
    else if (arg === "--structured-summary-path") parsed.structuredSummaryPath = argv[++index];
    else if (arg === "--prd-path") parsed.prdPath = argv[++index];
    else if (arg === "--factory-promotion-docs-dir") parsed.factoryPromotionDocsDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--commit-ref") parsed.commitRef = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:fe-freeze-handoff -- [--check] [--require-pass] [--out-dir DIR]

Builds the FE.4 freeze handoff over FE.1 PRD intake, FE.2 work-packet
decomposition, and FE.3 validation loop instantiation. This command prepares the
final FE review packet. It does not execute loops, run worker lanes, grant
verifier finality, write repositories, open G-series gates, or grant production
or enterprise trust.

Options:
  --check                         Validate without writing artifacts.
  --require-pass                  Require ready_factory_fe_freeze_handoff status.
  --no-write                      Build in memory only.
  --out-dir DIR                   Output directory.
  --prd-path FILE                 PRD source.
  --factory-promotion-docs-dir DIR  Directory containing FE review receipt docs.
  --run-at ISO_DATE               Deterministic timestamp for tests.
  --commit-ref REF                Deterministic commit ref for tests.
`);
}
