import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryWorkPacketDecomposition } from "./factory-work-packet-decomposition.mjs";

export const DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_OUT_DIR = "artifacts/factory-validation-loop-instantiation/latest";
export const DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  prdPath: "docs/hermes-enterprise-saas-specification.md",
};

const COMMAND_NAME = "factory:validation-loop-instantiation";
const SCHEMA_VERSION = "factory-validation-loop-instantiation.v1";
const CAPABILITY_ID = "factory.validation_loop_instantiation";
const PROGRAM_RANGE = "FCORE-FE.3";
const SOURCE_PROGRAM_RANGE = "FCORE-FE.2";
const READY_STATUS = "ready_factory_validation_loop_instantiation";
const BLOCKED_STATUS = "blocked_factory_validation_loop_instantiation";
const HASH_RE = /^[a-f0-9]{64}$/;
const RAW_TEXT_GUARD_MIN_LENGTH = 8;
const RAW_TEXT_GUARD_MIN_NORMALIZED_TOKENS = 3;

const LOOP_PHASE_BLUEPRINTS = [
  ["P9801-P9820", "source_binding", "P9800 Source Binding", "source binding rows"],
  ["P9821-P9840", "feature_packet_registry", "Feature Implementation Packet Registry", "feature implementation packet candidates"],
  ["P9841-P9860", "test_evidence_binding", "Test Evidence Binding", "test and evidence binding candidates"],
  ["P9861-P9880", "review_packet_generator", "Review Packet Generator", "review packet candidates"],
  ["P9881-P9900", "claude_review_receipt_intake", "Claude Review Receipt Intake", "read-only Claude review receipt slot"],
  ["P9901-P9920", "finding_normalization", "Finding Normalization", "normalized finding loop candidates"],
  ["P9921-P9940", "revalidation_evidence_binding", "Revalidation Evidence Binding", "revalidation evidence candidates"],
  ["P9941-P9960", "closeout_readiness_gate", "Closeout Readiness Gate", "closeout readiness candidates"],
  ["P9961-P9980", "api_projection", "Build Verification API Projection", "GET/HEAD projection candidates"],
  ["P9981-P10000", "freeze", "P10000 Freeze", "freeze and handoff candidates"],
];

const LOOP_GATE_BLUEPRINTS = [
  ["source_packet_bound", "source work packet remains bound"],
  ["feature_packet_candidate", "feature implementation packet candidate exists"],
  ["test_evidence_candidate", "test and evidence binding candidate exists"],
  ["review_packet_candidate", "review packet candidate exists"],
  ["finding_loop_candidate", "finding loop candidate exists"],
  ["closeout_candidate", "closeout readiness candidate exists"],
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
];

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryValidationLoopInstantiation(options = {}) {
  const result = await buildFactoryValidationLoopInstantiation(options);
  if (!options.check && options.write !== false) await writeFactoryValidationLoopInstantiation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Validation Loop Instantiation failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_validation_loop_instantiation_status !== READY_STATUS) {
    const error = new Error("Factory Validation Loop Instantiation is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryValidationLoopInstantiation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const workPacketDecomposition = Object.prototype.hasOwnProperty.call(options, "workPacketDecomposition")
    ? options.workPacketDecomposition
    : await buildFactoryWorkPacketDecomposition({
      ...options,
      outDir: path.join(outputDir, "source-work-packet-decomposition"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });
  const sourceState = summarizeSourceWorkPacketDecomposition(workPacketDecomposition);
  const loopCandidateRows = buildLoopCandidateRows({ sourceState, generatedAt });
  const loopStepRows = buildLoopStepRows({ loopCandidateRows, generatedAt });
  const loopGateRows = buildLoopGateRows({ loopCandidateRows, loopStepRows, generatedAt });
  const bundle = buildBundle({ sourceState, loopCandidateRows, loopStepRows, loopGateRows, generatedAt });
  const rawTextGuard = await buildRawTextGuard({ inputs, loopCandidateRows, loopStepRows, loopGateRows, bundle, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({
    sourceState,
    loopCandidateRows,
    loopStepRows,
    loopGateRows,
    generatedAt,
  });
  const boundary = buildBoundary({
    sourceState,
    loopCandidateRows,
    loopStepRows,
    loopGateRows,
    negativeFixtureRows,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    sourceState,
    loopCandidateRows,
    loopStepRows,
    loopGateRows,
    bundle,
    rawTextGuard,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceState,
    loopCandidateRows,
    loopStepRows,
    loopGateRows,
    negativeFixtureRows,
    bundle,
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
      source_work_packet_decomposition_status: sourceState.status,
      source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
    },
    source_summaries: {
      fe2_status: structuredSummary.data?.fe2_status ?? null,
      fe2_command_status: structuredSummary.data?.fe2_command_status ?? null,
      source_work_packet_decomposition_summary: workPacketDecomposition?.summary ?? null,
    },
    factory_validation_loop_instantiation_source: sourceState.public_source,
    factory_validation_loop_candidate_rows: loopCandidateRows,
    factory_validation_loop_step_candidate_rows: loopStepRows,
    factory_validation_loop_gate_rows: loopGateRows,
    factory_validation_loop_candidate_bundle: bundle,
    factory_validation_loop_raw_text_guard: rawTextGuard,
    factory_validation_loop_negative_fixture_rows: negativeFixtureRows,
    factory_validation_loop_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryValidationLoopInstantiation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-validation-loop-instantiation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "validation-loop-candidate-rows.json"), collectionEnvelope("factory-validation-loop-candidate-rows.v1", "factory_validation_loop_candidate_rows", result.factory_validation_loop_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-loop-step-candidate-rows.json"), collectionEnvelope("factory-validation-loop-step-candidate-rows.v1", "factory_validation_loop_step_candidate_rows", result.factory_validation_loop_step_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-loop-gate-rows.json"), collectionEnvelope("factory-validation-loop-gate-rows.v1", "factory_validation_loop_gate_rows", result.factory_validation_loop_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-bundle.json"), result.factory_validation_loop_candidate_bundle);
  await writeJson(path.join(outDir, "raw-text-guard.json"), result.factory_validation_loop_raw_text_guard);
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-validation-loop-negative-fixture-rows.v1", "factory_validation_loop_negative_fixture_rows", result.factory_validation_loop_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_validation_loop_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-validation-loop-instantiation-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryValidationLoopInstantiationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryValidationLoopInstantiation(args);
    console.log(`Factory Validation Loop Instantiation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_validation_loop_instantiation_status}`);
    console.log(`Loop candidates: ${result.summary.validation_loop_candidate_count}`);
    console.log(`Loop step candidates: ${result.summary.validation_loop_step_candidate_count}`);
    console.log(`Loop gate rows: ${result.summary.validation_loop_gate_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
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

function summarizeSourceWorkPacketDecomposition(workPacketDecomposition) {
  const summary = workPacketDecomposition?.summary ?? {};
  const packetRows = workPacketDecomposition?.factory_work_packet_candidate_rows ?? [];
  const itemRows = workPacketDecomposition?.factory_work_item_candidate_rows ?? [];
  const dependencyRows = workPacketDecomposition?.factory_work_packet_dependency_rows ?? [];
  const sourceReady = workPacketDecomposition?.validation?.valid === true
    && summary.factory_work_packet_decomposition_status === "ready_factory_work_packet_decomposition"
    && summary.fe3_loop_instantiation_allowed_next === true
    && summary.work_packet_execution_allowed_now === false;
  const packetRowsReady = packetRows.length >= 15
    && packetRows.every((row) => row.packet_status === "ready_for_human_planning_review"
      && row.scope_lock === "single_prd_source_span"
      && row.source_binding_status === "ready_single_source_span_bound"
      && HASH_RE.test(row.source_sha256 ?? "")
      && HASH_RE.test(row.source_span_sha256 ?? "")
      && Boolean(row.product_id)
      && Boolean(row.work_packet_candidate_id)
      && Boolean(row.source_requirement_row_id)
      && Boolean(row.source_span_id)
      && row.work_packet_execution_allowed_now === false
      && row.command_execution_allowed_now === false);
  const productIds = [...new Set(packetRows.map((row) => row.product_id).filter(Boolean))];
  const productScopeComplete = packetRows.length > 0 && packetRows.every((row) => Boolean(row.product_id)) && productIds.length === 1;
  return {
    status: sourceReady && packetRowsReady && productScopeComplete ? "ready_work_packet_decomposition_for_fe3" : "blocked_work_packet_decomposition_for_fe3",
    validation_valid: workPacketDecomposition?.validation?.valid === true,
    work_packet_decomposition_status: summary.factory_work_packet_decomposition_status ?? "missing",
    candidate_bundle_sha256: summary.candidate_bundle_sha256 ?? workPacketDecomposition?.factory_work_packet_candidate_bundle?.bundle_sha256 ?? null,
    source_prd_sha256: summary.source_prd_sha256 ?? null,
    product_ids: productIds,
    product_scope_count: productIds.length,
    product_scope_complete: productScopeComplete,
    work_packet_candidate_count: packetRows.length,
    work_packet_candidate_ready_count: packetRows.filter((row) => row.packet_status === "ready_for_human_planning_review").length,
    work_item_candidate_count: itemRows.length,
    dependency_row_count: dependencyRows.length,
    fe3_loop_instantiation_allowed_next: summary.fe3_loop_instantiation_allowed_next === true,
    work_packet_execution_allowed_now: summary.work_packet_execution_allowed_now === true,
    raw_prd_text_persisted_in_artifact: summary.raw_prd_text_persisted_in_artifact === true,
    packet_rows_ready: packetRowsReady,
    packet_rows: packetRows,
    item_rows: itemRows,
    dependency_rows: dependencyRows,
    public_source: {
      schema_version: "factory-validation-loop-instantiation-source.v1",
      source_program_range: SOURCE_PROGRAM_RANGE,
      work_packet_decomposition_status: summary.factory_work_packet_decomposition_status ?? "missing",
      candidate_bundle_sha256: summary.candidate_bundle_sha256 ?? null,
      source_prd_sha256: summary.source_prd_sha256 ?? null,
      product_ids: productIds,
      product_scope_count: productIds.length,
      product_scope_complete: productScopeComplete,
      work_packet_candidate_count: packetRows.length,
      work_item_candidate_count: itemRows.length,
      dependency_row_count: dependencyRows.length,
      fe3_loop_instantiation_allowed_next: summary.fe3_loop_instantiation_allowed_next === true,
      work_packet_execution_allowed_now: summary.work_packet_execution_allowed_now === true,
      raw_prd_text_persisted_in_artifact: summary.raw_prd_text_persisted_in_artifact === true,
      source_status: sourceReady && packetRowsReady && productScopeComplete ? "ready_work_packet_decomposition_for_fe3" : "blocked_work_packet_decomposition_for_fe3",
    },
  };
}

function buildLoopCandidateRows({ sourceState, generatedAt }) {
  return sourceState.packet_rows.map((packet, index) => {
    const packetReady = sourceState.status === "ready_work_packet_decomposition_for_fe3"
      && packet.packet_status === "ready_for_human_planning_review"
      && packet.scope_lock === "single_prd_source_span"
      && packet.source_binding_status === "ready_single_source_span_bound"
      && HASH_RE.test(packet.source_sha256 ?? "")
      && HASH_RE.test(packet.source_span_sha256 ?? "")
      && Boolean(packet.product_id)
      && packet.work_packet_execution_allowed_now === false;
    const loopId = `factory-validation-loop.${String(index + 1).padStart(3, "0")}.${normalizeKey(packet.title)}`;
    return {
      schema_version: "factory-validation-loop-candidate-row.v1",
      validation_loop_candidate_id: loopId,
      product_id: packet.product_id,
      source_product_id: packet.product_id,
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_work_packet_candidate_id: packet.work_packet_candidate_id,
      source_requirement_row_id: packet.source_requirement_row_id,
      source_tuw_seed_id: packet.source_tuw_seed_id,
      source_span_id: packet.source_span_id,
      source_sha256: packet.source_sha256,
      source_span_sha256: packet.source_span_sha256,
      source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
      heading_number: packet.heading_number,
      heading_title: packet.heading_title,
      title: `${packet.title} Validation Loop Candidate`,
      loop_template_program_range: "P9801-P10000",
      loop_candidate_status: packetReady ? "ready_for_fe4_freeze_review_candidate" : "blocked_source_work_packet_binding",
      scope_lock: "single_product_single_work_packet_source_span",
      source_binding_status: packetReady ? "ready_single_work_packet_bound" : "blocked_work_packet_binding",
      phase_order: packet.phase_order,
      phase_wave: packet.phase_wave,
      loop_step_candidate_count: LOOP_PHASE_BLUEPRINTS.length,
      loop_gate_count: LOOP_GATE_BLUEPRINTS.length,
      feature_packet_candidate_ref: `feature_packet.${normalizeKey(loopId)}`,
      test_evidence_candidate_ref: `test_evidence.${normalizeKey(loopId)}`,
      review_packet_candidate_ref: `review_packet.${normalizeKey(loopId)}`,
      claude_review_receipt_slot_ref: `claude_review_receipt_slot.${normalizeKey(loopId)}`,
      finding_loop_candidate_ref: `finding_loop.${normalizeKey(loopId)}`,
      revalidation_candidate_ref: `revalidation.${normalizeKey(loopId)}`,
      closeout_candidate_ref: `closeout.${normalizeKey(loopId)}`,
      allowed_affordances: ["view_validation_loop_candidate", "view_loop_step_candidates", "view_loop_gate_rows", "queue_for_fe4_freeze_review"],
      forbidden_affordances: buildForbiddenAffordances(),
      requires_independent_review_before_execution: true,
      requires_human_owner_gate_before_execution: true,
      g_series_gate_required_before_execution: "G2",
      raw_prd_text_visible: false,
      raw_prd_text_persisted_in_artifact: false,
      protected_action: false,
      generated_at: generatedAt,
      ...AUTHORITY_CLOSED,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildLoopStepRows({ loopCandidateRows, generatedAt }) {
  return loopCandidateRows.flatMap((loop) => LOOP_PHASE_BLUEPRINTS.map(([phaseRange, stepKind, label, outputContract], index) => ({
    schema_version: "factory-validation-loop-step-candidate-row.v1",
    loop_step_candidate_id: `${loop.validation_loop_candidate_id}.step.${String(index + 1).padStart(2, "0")}.${normalizeKey(stepKind)}`,
    validation_loop_candidate_id: loop.validation_loop_candidate_id,
    product_id: loop.product_id,
    source_work_packet_candidate_id: loop.source_work_packet_candidate_id,
    source_requirement_row_id: loop.source_requirement_row_id,
    source_span_id: loop.source_span_id,
    source_sha256: loop.source_sha256,
    source_span_sha256: loop.source_span_sha256,
    phase_range: phaseRange,
    step_kind: stepKind,
    label,
    output_contract: outputContract,
    step_order: index + 1,
    candidate_status: loop.loop_candidate_status === "ready_for_fe4_freeze_review_candidate" ? "ready_loop_step_candidate" : "blocked_parent_loop_candidate",
    requires_claude_receipt_before_closeout: stepKind === "claude_review_receipt_intake" || stepKind === "freeze",
    finding_loop_required: ["finding_normalization", "revalidation_evidence_binding", "closeout_readiness_gate", "freeze"].includes(stepKind),
    closeout_authority_granted_now: false,
    runtime_execution_allowed_now: false,
    validation_loop_execution_allowed_now: false,
    worker_execution_allowed_now: false,
    verifier_finality_allowed_now: false,
    generated_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  })));
}

function buildLoopGateRows({ loopCandidateRows, loopStepRows, generatedAt }) {
  const stepRowsByLoopId = groupBy(loopStepRows, (row) => row.validation_loop_candidate_id);
  return loopCandidateRows.flatMap((loop) => {
    const steps = stepRowsByLoopId.get(loop.validation_loop_candidate_id) ?? [];
    return LOOP_GATE_BLUEPRINTS.map(([gateKey, label]) => {
      const gateEvaluation = evaluateLoopGate({ gateKey, loop, steps });
      return {
        schema_version: "factory-validation-loop-gate-row.v1",
        gate_row_id: `${loop.validation_loop_candidate_id}.gate.${gateKey}`,
        validation_loop_candidate_id: loop.validation_loop_candidate_id,
        product_id: loop.product_id,
        source_work_packet_candidate_id: loop.source_work_packet_candidate_id,
        gate_key: gateKey,
        label,
        expected_result: "pass",
        current_verdict: gateEvaluation.pass ? "pass" : "block",
        block_reason: gateEvaluation.pass ? null : gateEvaluation.block_reason,
        evaluated_checks: gateEvaluation.evaluated_checks,
        authority_opened_by_gate: false,
        validation_loop_execution_allowed_now: false,
        worker_execution_allowed_now: false,
        verifier_finality_allowed_now: false,
        generated_at: generatedAt,
      };
    });
  });
}

function evaluateLoopGate({ gateKey, loop, steps }) {
  const hasStep = (stepKind) => steps.some((row) => row.step_kind === stepKind && row.candidate_status === "ready_loop_step_candidate");
  const commonChecks = {
    loop_ready: loop.loop_candidate_status === "ready_for_fe4_freeze_review_candidate",
    single_product_scope: loop.product_id === loop.source_product_id && Boolean(loop.product_id),
    source_hash_bound: HASH_RE.test(loop.source_sha256 ?? "") && HASH_RE.test(loop.source_span_sha256 ?? "") && HASH_RE.test(loop.source_candidate_bundle_sha256 ?? ""),
    loop_authority_closed: loopRowsAuthorityClosed([loop]),
    step_authority_closed: steps.every((row) => stepRowsAuthorityClosed([row])),
  };
  const gateSpecificChecks = {
    source_packet_bound: {
      source_packet_id_present: Boolean(loop.source_work_packet_candidate_id),
      source_requirement_present: Boolean(loop.source_requirement_row_id),
      source_span_present: Boolean(loop.source_span_id),
      source_binding_status_ready: loop.source_binding_status === "ready_single_work_packet_bound",
      source_binding_step_ready: hasStep("source_binding"),
    },
    feature_packet_candidate: {
      feature_packet_ref_present: Boolean(loop.feature_packet_candidate_ref),
      feature_packet_step_ready: hasStep("feature_packet_registry"),
    },
    test_evidence_candidate: {
      test_evidence_ref_present: Boolean(loop.test_evidence_candidate_ref),
      test_evidence_step_ready: hasStep("test_evidence_binding"),
    },
    review_packet_candidate: {
      review_packet_ref_present: Boolean(loop.review_packet_candidate_ref),
      claude_receipt_slot_present: Boolean(loop.claude_review_receipt_slot_ref),
      review_packet_step_ready: hasStep("review_packet_generator"),
      claude_receipt_step_ready: hasStep("claude_review_receipt_intake"),
    },
    finding_loop_candidate: {
      finding_loop_ref_present: Boolean(loop.finding_loop_candidate_ref),
      revalidation_ref_present: Boolean(loop.revalidation_candidate_ref),
      finding_normalization_step_ready: hasStep("finding_normalization"),
      revalidation_step_ready: hasStep("revalidation_evidence_binding"),
    },
    closeout_candidate: {
      closeout_ref_present: Boolean(loop.closeout_candidate_ref),
      closeout_step_ready: hasStep("closeout_readiness_gate"),
      api_projection_step_ready: hasStep("api_projection"),
      freeze_step_ready: hasStep("freeze"),
      verifier_finality_closed: loop.verifier_finality_allowed_now === false,
      codex_final_approval_closed: loop.codex_final_approval_allowed_now === false,
      claude_final_approval_closed: loop.claude_final_approval_allowed_now === false,
    },
  }[gateKey] ?? {};
  const evaluatedChecks = { ...commonChecks, ...gateSpecificChecks };
  const failed = Object.entries(evaluatedChecks).filter(([, value]) => value !== true).map(([key]) => key);
  return {
    pass: failed.length === 0,
    block_reason: failed.length === 0 ? null : `${gateKey}_blocked:${failed.join(",")}`,
    evaluated_checks: evaluatedChecks,
  };
}

function buildBundle({ sourceState, loopCandidateRows, loopStepRows, loopGateRows, generatedAt }) {
  const bundleInput = {
    source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
    validation_loop_candidate_ids: loopCandidateRows.map((row) => row.validation_loop_candidate_id),
    loop_step_candidate_ids: loopStepRows.map((row) => row.loop_step_candidate_id),
    gate_row_ids: loopGateRows.map((row) => row.gate_row_id),
  };
  return {
    schema_version: "factory-validation-loop-candidate-bundle.v1",
    bundle_id: `factory-validation-loop-candidate-bundle.${dateStamp(generatedAt)}`,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
    validation_loop_candidate_count: loopCandidateRows.length,
    loop_step_candidate_count: loopStepRows.length,
    loop_gate_count: loopGateRows.length,
    bundle_sha256: hashValue(bundleInput),
    bundle_status: loopCandidateRows.length > 0
      && loopStepRows.length === loopCandidateRows.length * LOOP_PHASE_BLUEPRINTS.length
      && loopGateRows.length === loopCandidateRows.length * LOOP_GATE_BLUEPRINTS.length
      ? "ready_validation_loop_candidate_bundle"
      : "blocked_validation_loop_candidate_bundle",
    raw_prd_text_persisted_in_artifact: false,
    validation_loop_execution_allowed_now: false,
    command_execution_allowed_now: false,
    generated_at: generatedAt,
  };
}

async function buildRawTextGuard({ inputs, loopCandidateRows, loopStepRows, loopGateRows, bundle, generatedAt }) {
  const source = await readTextSource(inputs.prd_path);
  const snippets = source.available ? buildRawTextGuardSnippets(source.text, loopCandidateRows) : [];
  const scannedPayload = {
    loop_candidate_rows: loopCandidateRows,
    loop_step_rows: loopStepRows,
    loop_gate_rows: loopGateRows,
    bundle,
  };
  const serializedPayload = JSON.stringify(scannedPayload);
  const payloadStrings = collectStringFields(scannedPayload);
  const leaks = detectRawTextLeaks({ snippets, serializedPayload, payloadStrings });
  const normalizedProbeCount = snippets.filter((snippet) => snippet.normalized_probe_eligible).length;
  const guardCovered = source.available && snippets.length > 0 && payloadStrings.length > 0 && normalizedProbeCount > 0;
  return {
    schema_version: "factory-validation-loop-raw-text-guard.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_path: source.path,
    source_available: source.available,
    source_error: source.error ?? null,
    scanned_payloads: [
      "factory_validation_loop_candidate_rows",
      "factory_validation_loop_step_candidate_rows",
      "factory_validation_loop_gate_rows",
      "factory_validation_loop_candidate_bundle",
    ],
    scanned_snippet_count: snippets.length,
    scanned_string_field_count: payloadStrings.length,
    exact_raw_probe_count: snippets.length,
    normalized_probe_count: normalizedProbeCount,
    low_entropy_probe_count: snippets.length - normalizedProbeCount,
    minimum_snippet_length: RAW_TEXT_GUARD_MIN_LENGTH,
    minimum_normalized_probe_tokens: RAW_TEXT_GUARD_MIN_NORMALIZED_TOKENS,
    scan_modes: [
      "raw_substring",
      "json_escaped_raw_substring",
      "normalized_high_entropy_field_substring",
    ],
    leak_count: leaks.length,
    leak_refs: leaks,
    raw_snippets_persisted: false,
    raw_text_leak_found: leaks.length > 0,
    guard_status: guardCovered && leaks.length === 0
      ? "ready_no_raw_prd_text_leak_detected"
      : "blocked_raw_prd_text_guard",
    generated_at: generatedAt,
  };
}

function buildRawTextGuardSnippets(sourceText, loopCandidateRows) {
  const allowedTitleTexts = new Set(loopCandidateRows.flatMap((row) => [
    normalizeSourceLine(row.title),
    normalizeSourceLine(row.heading_title),
    normalizeSourceLine(String(row.heading_title ?? "").replace(/^\d+(?:\.\d+)*\s+/, "")),
  ]).filter(Boolean));
  return sourceText.split(/\r?\n/).flatMap((line, index) => {
    const rawText = String(line ?? "").trim();
    const normalized = normalizeSourceLine(rawText);
    if (normalized.length < RAW_TEXT_GUARD_MIN_LENGTH) return [];
    const sourceLabelLine = rawText.startsWith("#") || allowedTitleTexts.has(normalized);
    const normalizedTokenCount = normalized.split(/\s+/).filter(Boolean).length;
    return [{
      source_line: index + 1,
      raw_text: rawText,
      json_escaped_raw_text: JSON.stringify(rawText).slice(1, -1),
      normalized_text: normalized,
      normalized_probe_eligible: !sourceLabelLine && normalizedTokenCount >= RAW_TEXT_GUARD_MIN_NORMALIZED_TOKENS,
      source_label_line: sourceLabelLine,
    }];
  });
}

function detectRawTextLeaks({ snippets, serializedPayload, payloadStrings }) {
  const leakByKey = new Map();
  for (const snippet of snippets) {
    if (snippet.raw_text && serializedPayload.includes(snippet.raw_text)) {
      addLeak(leakByKey, snippet, "serialized_payload.raw_substring", hashString(serializedPayload), "raw_substring");
    }
    if (snippet.json_escaped_raw_text && serializedPayload.includes(snippet.json_escaped_raw_text)) {
      addLeak(leakByKey, snippet, "serialized_payload.json_escaped_raw_substring", hashString(serializedPayload), "json_escaped_raw_substring");
    }
    if (!snippet.normalized_probe_eligible) continue;
    for (const field of payloadStrings) {
      if (field.normalized_value.includes(snippet.normalized_text)) {
        addLeak(leakByKey, snippet, field.path, hashString(field.normalized_value), "normalized_high_entropy_field_substring");
      }
    }
  }
  return [...leakByKey.values()];
}

function addLeak(leakByKey, snippet, fieldPath, fieldValueSha256, detectionMode) {
  const key = `${snippet.source_line}:${fieldPath}:${detectionMode}`;
  if (leakByKey.has(key)) return;
  leakByKey.set(key, {
    source_line: snippet.source_line,
    snippet_sha256: hashString(snippet.normalized_text),
    field_path: fieldPath,
    field_value_sha256: fieldValueSha256,
    detection_mode: detectionMode,
  });
}

function buildNegativeFixtureRows({ sourceState, loopCandidateRows, loopStepRows, loopGateRows, generatedAt }) {
  const notReadySourceState = {
    ...sourceState,
    status: "blocked_work_packet_decomposition_for_fe3",
    packet_rows_ready: false,
    packet_rows: sourceState.packet_rows.map((row, index) => index === 0
      ? { ...row, packet_status: "blocked_source_binding", source_binding_status: "blocked_source_span_binding" }
      : row),
  };
  const notReadyLoopRows = buildLoopCandidateRows({ sourceState: notReadySourceState, generatedAt });
  const unscopedLoopRows = loopCandidateRows.map((row, index) => index === 0
    ? { ...row, product_id: null, source_product_id: null }
    : row);
  const crossProductLoopRows = loopCandidateRows.map((row, index) => index === 0
    ? { ...row, product_id: "project.other_product", source_product_id: "project.hermes_harness" }
    : row);
  const missingStepRows = loopStepRows.slice(1);
  const openedExecutionRows = loopCandidateRows.map((row, index) => index === 0
    ? { ...row, validation_loop_execution_allowed_now: true, worker_execution_allowed_now: true, authority_flags: { ...row.authority_flags, validation_loop_execution_allowed_now: true, worker_execution_allowed_now: true } }
    : row);
  const openedVerifierRows = loopStepRows.map((row, index) => index === 0
    ? { ...row, verifier_finality_allowed_now: true, authority_flags: { ...row.authority_flags, verifier_finality_allowed_now: true } }
    : row);
  const fixtures = [
    {
      fixture_key: "fe2_work_packet_decomposition_not_ready",
      simulated_condition: "source FE.2 work packet decomposition is not ready for FE.3",
      observed_blocked_checks: ["source.fe2_work_packets_ready", "loops.source_bound"],
      blocked: notReadySourceState.status !== "ready_work_packet_decomposition_for_fe3"
        && !loopRowsReady(notReadyLoopRows)
        && notReadyLoopRows.some((row) => row.loop_candidate_status === "blocked_source_work_packet_binding"),
    },
    {
      fixture_key: "scope_missing_product_id",
      simulated_condition: "validation loop candidate has no product scope",
      observed_blocked_checks: ["source.product_scope", "loops.source_bound"],
      blocked: !loopRowsSourceScoped(unscopedLoopRows),
    },
    {
      fixture_key: "cross_product_requirement_reference",
      simulated_condition: "validation loop candidate references a requirement from another product scope",
      observed_blocked_checks: ["loops.single_product_scope"],
      blocked: !loopRowsSourceScoped(crossProductLoopRows),
    },
    {
      fixture_key: "missing_loop_step_coverage",
      simulated_condition: "a loop candidate is missing one P9801-P10000 step row",
      observed_blocked_checks: ["steps.complete"],
      blocked: !loopStepRowsComplete(loopCandidateRows, missingStepRows),
    },
    {
      fixture_key: "loop_execution_flag_opened",
      simulated_condition: "a validation loop candidate opens loop or worker execution",
      observed_blocked_checks: ["loops.no_execution", "boundary.authority_closed"],
      blocked: !loopRowsAuthorityClosed(openedExecutionRows),
    },
    {
      fixture_key: "verifier_finality_opened",
      simulated_condition: "a loop step allows verifier finality",
      observed_blocked_checks: ["steps.no_execution", "boundary.authority_closed"],
      blocked: !stepRowsAuthorityClosed(openedVerifierRows),
    },
  ];
  return fixtures.map((fixture) => ({
    schema_version: "factory-validation-loop-negative-fixture-row.v1",
    fixture_id: `factory-validation-loop-negative.${fixture.fixture_key}`,
    fixture_key: fixture.fixture_key,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    simulated_condition: fixture.simulated_condition,
    expected_result: "blocked",
    actual_result: fixture.blocked ? "blocked" : "not_blocked",
    fixture_status: fixture.blocked ? "blocked_as_expected" : "fixture_failed_open",
    observed_blocked_checks: fixture.observed_blocked_checks,
    authority_opened_by_fixture: false,
    command_execution_enabled: false,
    validation_loop_execution_allowed_now: false,
    worker_execution_allowed_now: false,
    verifier_finality_allowed_now: false,
    source_file_write_allowed_now: false,
    repo_write_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildBoundary({ sourceState, loopCandidateRows, loopStepRows, loopGateRows, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-validation-loop-boundary.v1",
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    read_only_instantiation: true,
    source_work_packet_decomposition_status: sourceState.status,
    validation_loop_candidate_count: loopCandidateRows.length,
    validation_loop_step_candidate_count: loopStepRows.length,
    validation_loop_gate_count: loopGateRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    method_allowlist: ["GET", "HEAD", "READ_FILE"],
    source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
    product_ids: sourceState.product_ids,
    product_scope_count: sourceState.product_scope_count,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    fe4_freeze_review_allowed_next: sourceState.status === "ready_work_packet_decomposition_for_fe3",
    ...AUTHORITY_CLOSED,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ packageJson, structuredSummary, sourceState, loopCandidateRows, loopStepRows, loopGateRows, bundle, rawTextGuard, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "wiring", scripts[COMMAND_NAME] === "node scripts/factory-validation-loop-instantiation.mjs", `${COMMAND_NAME} package script must be registered`),
    validationItem("structured_summary.fe2_ready", "source_chain", structuredSummary.data?.fe2_status === "ready_factory_work_packet_decomposition_lawos_style_claude_reviewed", "FE.2 must be reviewed before FE.3 validation loop instantiation"),
    validationItem("source.fe2_work_packets_ready", "source", sourceState.status === "ready_work_packet_decomposition_for_fe3", "Source FE.2 work-packet decomposition must be ready for FE.3"),
    validationItem("source.product_scope", "source", sourceState.product_scope_complete === true && sourceState.product_scope_count === 1 && sourceState.product_ids.every(Boolean), "FE.3 intake must have exactly one product scope"),
    validationItem("source.no_execution", "authority", sourceState.work_packet_execution_allowed_now === false, "Source FE.2 must not open work-packet execution"),
    validationItem("source.no_raw_prd_text", "authority", sourceState.raw_prd_text_persisted_in_artifact === false, "Source FE.2 must not persist raw PRD text"),
    validationItem("loops.present", "loop", loopCandidateRows.length === sourceState.work_packet_candidate_count && loopCandidateRows.length >= 15, "One validation loop candidate must exist per FE.2 work packet"),
    validationItem("loops.unique_ids", "loop", idsUnique(loopCandidateRows.map((row) => row.validation_loop_candidate_id)), "Validation loop candidate IDs must be unique"),
    validationItem("loops.one_loop_per_packet", "loop", idsUnique(loopCandidateRows.map((row) => row.source_work_packet_candidate_id)) && loopCandidateRows.every((row) => row.source_work_packet_candidate_id), "Each FE.2 packet maps to one validation loop candidate"),
    validationItem("loops.source_bound", "loop", loopRowsReady(loopCandidateRows), "Validation loop candidates must be source-bound and ready"),
    validationItem("loops.single_product_scope", "loop", loopRowsSourceScoped(loopCandidateRows), "Validation loop candidates must stay in one product scope"),
    validationItem("loops.no_raw_prd_text", "authority", loopCandidateRows.every((row) => row.raw_prd_text_visible === false && row.raw_prd_text_persisted_in_artifact === false), "Validation loop candidates must not expose raw PRD text"),
    validationItem("loops.raw_text_guard", "authority", rawTextGuard.source_available === true && rawTextGuard.scanned_snippet_count > 0 && rawTextGuard.scanned_string_field_count > 0 && rawTextGuard.normalized_probe_count > 0 && rawTextGuard.guard_status === "ready_no_raw_prd_text_leak_detected" && rawTextGuard.raw_text_leak_found === false && rawTextGuard.raw_snippets_persisted === false, "FE.3 must pass its own non-vacuous raw PRD text guard"),
    validationItem("loops.no_execution", "authority", loopRowsAuthorityClosed(loopCandidateRows), "Validation loop candidates must not open execution or final approval"),
    validationItem("steps.complete", "loop_step", loopStepRowsComplete(loopCandidateRows, loopStepRows), "Each loop candidate must have all P9801-P10000 step candidates"),
    validationItem("steps.ready", "loop_step", loopStepRows.length > 0 && loopStepRows.every((row) => row.candidate_status === "ready_loop_step_candidate"), "Loop step candidates must be ready"),
    validationItem("steps.no_execution", "authority", stepRowsAuthorityClosed(loopStepRows), "Loop step candidates must not open execution or verifier finality"),
    validationItem("gates.complete", "gate", loopGateRowsComplete(loopCandidateRows, loopGateRows), "Each loop candidate must have all required gate rows"),
    validationItem("gates.pass", "gate", loopGateRows.length > 0 && loopGateRows.every((row) => row.current_verdict === "pass" && row.authority_opened_by_gate === false), "Loop gate rows must pass without opening authority"),
    validationItem("bundle.hash_bound", "bundle", bundle.bundle_status === "ready_validation_loop_candidate_bundle" && HASH_RE.test(bundle.bundle_sha256), "Validation loop candidate bundle must have a stable hash"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 6 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "All FE.3 negative fixtures must remain blocked"),
    validationItem("boundary.no_raw_prd_text", "authority", boundary.raw_prd_text_persisted_in_artifact === false, "Boundary must not persist raw PRD text"),
    validationItem("boundary.execution_closed", "authority", boundary.command_execution_enabled === false && boundary.validation_loop_execution_allowed_now === false && boundary.worker_execution_allowed_now === false && boundary.g2_command_execution_gate_open_now === false, "FE.3 must not open command, loop, worker, or G2 execution"),
    validationItem("boundary.finality_closed", "authority", boundary.codex_final_approval_allowed_now === false && boundary.claude_final_approval_allowed_now === false && boundary.verifier_finality_allowed_now === false, "FE.3 must not open finality"),
    validationItem("boundary.write_apply_closed", "authority", boundary.source_file_write_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.apply_allowed_now === false, "FE.3 must not open write or apply authority"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All FE.3 factory authority flags must remain false"),
  ];
}

function buildSummary({ sourceState, loopCandidateRows, loopStepRows, loopGateRows, negativeFixtureRows, bundle, boundary, validation }) {
  const ready = validation.valid
    && sourceState.status === "ready_work_packet_decomposition_for_fe3"
    && loopRowsReady(loopCandidateRows)
    && loopStepRowsComplete(loopCandidateRows, loopStepRows)
    && loopGateRowsComplete(loopCandidateRows, loopGateRows)
    && allAuthorityClosed(boundary);
  return {
    factory_validation_loop_instantiation_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_packet_decomposition_status: sourceState.status,
    source_candidate_bundle_sha256: sourceState.candidate_bundle_sha256,
    product_ids: sourceState.product_ids,
    product_scope_count: sourceState.product_scope_count,
    source_work_packet_candidate_count: sourceState.work_packet_candidate_count,
    validation_loop_candidate_count: loopCandidateRows.length,
    validation_loop_candidate_ready_count: loopCandidateRows.filter((row) => row.loop_candidate_status === "ready_for_fe4_freeze_review_candidate").length,
    validation_loop_step_candidate_count: loopStepRows.length,
    validation_loop_step_candidate_ready_count: loopStepRows.filter((row) => row.candidate_status === "ready_loop_step_candidate").length,
    validation_loop_gate_count: loopGateRows.length,
    validation_loop_gate_pass_count: loopGateRows.filter((row) => row.current_verdict === "pass").length,
    candidate_bundle_sha256: bundle.bundle_sha256,
    raw_text_guard_status: validation.errors.some((item) => item.item_id === "loops.raw_text_guard")
      ? "blocked_raw_prd_text_guard"
      : "ready_no_raw_prd_text_leak_detected",
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    fe4_freeze_review_allowed_next: boundary.fe4_freeze_review_allowed_next,
    validation_errors: validation.errors.length,
    ...AUTHORITY_CLOSED,
  };
}

function loopRowsReady(rows) {
  return rows.length > 0 && rows.every((row) => row.loop_candidate_status === "ready_for_fe4_freeze_review_candidate"
    && row.scope_lock === "single_product_single_work_packet_source_span"
    && row.source_binding_status === "ready_single_work_packet_bound"
    && row.product_id
    && row.product_id === row.source_product_id
    && HASH_RE.test(row.source_sha256 ?? "")
    && HASH_RE.test(row.source_span_sha256 ?? "")
    && HASH_RE.test(row.source_candidate_bundle_sha256 ?? "")
    && Boolean(row.source_work_packet_candidate_id)
    && Boolean(row.source_requirement_row_id)
    && Boolean(row.source_span_id));
}

function loopRowsSourceScoped(rows) {
  return rows.length > 0 && rows.every((row) => Boolean(row.product_id) && row.product_id === row.source_product_id);
}

function loopRowsAuthorityClosed(rows) {
  return rows.every((row) => row.command_execution_enabled === false
    && row.command_execution_allowed_now === false
    && row.validation_loop_execution_allowed_now === false
    && row.worker_execution_allowed_now === false
    && row.verifier_finality_allowed_now === false
    && row.codex_final_approval_allowed_now === false
    && row.claude_final_approval_allowed_now === false
    && row.source_file_write_allowed_now === false
    && row.repo_write_allowed_now === false
    && row.connector_write_allowed_now === false
    && row.deployment_allowed_now === false
    && row.protected_action_allowed_now === false
    && row.production_pass_enabled === false
    && row.enterprise_pass_enabled === false
    && allAuthorityClosed(row.authority_flags ?? {}));
}

function stepRowsAuthorityClosed(rows) {
  return rows.every((row) => row.runtime_execution_allowed_now === false
    && row.validation_loop_execution_allowed_now === false
    && row.worker_execution_allowed_now === false
    && row.verifier_finality_allowed_now === false
    && allAuthorityClosed(row.authority_flags ?? {}));
}

function loopStepRowsComplete(loopRows, stepRows) {
  const grouped = groupBy(stepRows, (row) => row.validation_loop_candidate_id);
  const requiredPhaseRanges = new Set(LOOP_PHASE_BLUEPRINTS.map(([phaseRange]) => phaseRange));
  return loopRows.length > 0 && stepRows.length === loopRows.length * LOOP_PHASE_BLUEPRINTS.length && loopRows.every((loop) => {
    const rows = grouped.get(loop.validation_loop_candidate_id) ?? [];
    return rows.length === LOOP_PHASE_BLUEPRINTS.length && new Set(rows.map((row) => row.phase_range)).size === requiredPhaseRanges.size
      && rows.every((row) => requiredPhaseRanges.has(row.phase_range) && row.product_id === loop.product_id);
  });
}

function loopGateRowsComplete(loopRows, gateRows) {
  const grouped = groupBy(gateRows, (row) => row.validation_loop_candidate_id);
  const requiredGateKeys = new Set(LOOP_GATE_BLUEPRINTS.map(([gateKey]) => gateKey));
  return loopRows.length > 0 && gateRows.length === loopRows.length * LOOP_GATE_BLUEPRINTS.length && loopRows.every((loop) => {
    const rows = grouped.get(loop.validation_loop_candidate_id) ?? [];
    return rows.length === LOOP_GATE_BLUEPRINTS.length && new Set(rows.map((row) => row.gate_key)).size === requiredGateKeys.size
      && rows.every((row) => requiredGateKeys.has(row.gate_key) && row.product_id === loop.product_id);
  });
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-validation-loop-instantiation-validation-item.v1",
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
    "# Factory Validation Loop Instantiation",
    "",
    `Status: ${result.summary.factory_validation_loop_instantiation_status}`,
    `Program: ${result.summary.program_range}`,
    `Source work-packet decomposition: ${result.summary.source_work_packet_decomposition_status}`,
    `Loop candidates: ${result.summary.validation_loop_candidate_count}`,
    `Loop step candidates: ${result.summary.validation_loop_step_candidate_count}`,
    `Loop gate rows: ${result.summary.validation_loop_gate_count}`,
    `Candidate bundle SHA-256: ${result.summary.candidate_bundle_sha256}`,
    `Raw text guard: ${result.summary.raw_text_guard_status}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Validation loop execution allowed: ${result.summary.validation_loop_execution_allowed_now}`,
    `Worker execution allowed: ${result.summary.worker_execution_allowed_now}`,
    `Verifier finality allowed: ${result.summary.verifier_finality_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function buildForbiddenAffordances() {
  return [
    "execute_validation_loop",
    "execute_worker_lane",
    "grant_verifier_finality",
    "create_project",
    "append_ledger",
    "advance_ps3",
    "open_gate",
    "execute_work_packet",
    "execute_command",
    "write_source_file",
    "apply_candidate",
    "merge_branch",
    "call_connector",
    "deploy",
    "grant_production_pass",
    "grant_enterprise_pass",
  ];
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((key) => value[key] === false);
}

function idsUnique(ids) {
  return ids.filter(Boolean).length === ids.length && new Set(ids).size === ids.length;
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

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_INPUTS.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_INPUTS.structuredSummaryPath),
    prd_path: path.resolve(repoRoot, options.prdPath ?? DEFAULT_FACTORY_VALIDATION_LOOP_INSTANTIATION_INPUTS.prdPath),
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

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath ?? "");
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.code ?? error.message };
  }
}

function collectStringFields(value, pathParts = []) {
  if (typeof value === "string") {
    const normalizedValue = normalizeSourceLine(value);
    return normalizedValue
      ? [{ path: pathParts.join("."), normalized_value: normalizedValue }]
      : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => collectStringFields(item, [...pathParts, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStringFields(item, [...pathParts, key]));
  }
  return [];
}

function normalizeSourceLine(line) {
  return String(line)
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^\s*\|?\s*-{3,}\s*\|?\s*$/, "")
    .replace(/[|`*#>[\](){}:;,.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--commit-ref") parsed.commitRef = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:validation-loop-instantiation -- [--check] [--require-pass] [--out-dir DIR]

Builds FE.3 validation loop candidates from FE.2 work packet candidates. This
command instantiates P9801-P10000 loop candidate rows only. It does not execute
loops, run worker lanes, grant verifier finality, write repositories, open
G-series gates, or grant production/enterprise trust.

Options:
  --check             Validate without writing artifacts.
  --require-pass      Require ready_factory_validation_loop_instantiation status.
  --no-write          Build in memory only.
  --out-dir DIR       Output directory.
  --prd-path FILE     PRD source used for the FE.3 raw-text guard.
  --run-at ISO_DATE   Deterministic timestamp for tests.
  --commit-ref REF    Deterministic commit ref for tests.
`);
}
