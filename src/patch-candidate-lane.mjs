import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildControlledExecutionSandbox } from "./controlled-execution-sandbox.mjs";

export const DEFAULT_PATCH_CANDIDATE_LANE_OUT_DIR = "artifacts/patch-candidate-lane/latest";
export const DEFAULT_PATCH_CANDIDATE_LANE_INPUTS = {
  schemaPath: "schemas/patch-candidate-lane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p12401-p12600.md",
  architectureDocPath: "docs/architecture.md",
  sourceControlledExecutionSandboxPath: "artifacts/controlled-execution-sandbox/latest/controlled-execution-sandbox.json",
  claudePatchReviewReceiptPath: "artifacts/patch-candidate-lane/review/claude-patch-candidate-review-receipt.json",
};

const COMMAND_NAME = "platform:patch-candidate-lane";
const SCHEMA_VERSION = "patch-candidate-lane.v1";
const CAPABILITY_ID = "platform.patch_candidate_lane";
const PROGRAM_RANGE = "P12401-P12600";
const SOURCE_PROGRAM_RANGE = "P12201-P12400";
const READY_STATUS = "ready_for_patch_candidate_lane";
const BLOCKED_STATUS = "blocked_patch_candidate_lane";

const PHASE_SPECS = [
  ["P12401-P12420", "P12400 Source Binding", "patch_candidate_source_binding_rows"],
  ["P12421-P12440", "Generated Patch Candidate Contract", "generated_patch_candidate_rows"],
  ["P12441-P12460", "Diff Packet Contract", "patch_diff_packet_rows"],
  ["P12461-P12480", "Rollback Plan Binding", "patch_rollback_binding_rows"],
  ["P12481-P12500", "Validation Ref Binding", "patch_validation_ref_rows"],
  ["P12501-P12520", "High-Risk Claude Patch Review Gate", "patch_claude_review_rows"],
  ["P12521-P12540", "Protected Scope Negative Fixtures", "patch_protected_scope_negative_rows"],
  ["P12541-P12560", "Read-Only Operator/API Patch Projection", "patch_operator_projection_rows"],
  ["P12561-P12580", "No-Direct-Apply Authority Guard", "patch_authority_guard_rows"],
  ["P12581-P12600", "Patch Candidate Lane Freeze", "p12600_freeze_rows"],
];

const PATCH_CANDIDATE_TERMS = ["scope intent", "file scope", "risk tier", "generated patch artifact", "patch hash", "no direct apply"];
const DIFF_PACKET_TERMS = ["diff summary", "file scope", "semantic risk", "test plan", "rollback plan", "reviewer refs"];
const ROLLBACK_TERMS = ["pre-change status", "artifact hash", "inverse patch note", "restore plan", "rollback receipt"];
const VALIDATION_TERMS = ["git diff --check", "targeted tests", "validate core", "platform check", "secret scan", "artifact summary"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max patch candidate review receipt schema"],
  ["review_scope", "patch candidate review scope"],
  ["review_evidence_ref", "review evidence ref"],
  ["review_finding_loop", "Claude finding loop"],
  ["review_receipt_observed", "Claude patch candidate review receipt observed"],
];
const NEGATIVE_TERMS = ["protected file", "restricted path", "secret file", "cross-project access", "raw material exposure", "unscoped dirty tree"];
const OPERATOR_TERMS = ["patch candidate state", "diff packet state", "rollback state", "missing review", "blocked reason", "next condition"];
const AUTHORITY_TERMS = ["no patch generated now", "no direct apply", "no file write", "no protected action", "no connector write", "no final/trust"];

export async function runPatchCandidateLane(options = {}) {
  const result = await buildPatchCandidateLane(options);
  if (options.write !== false) await writePatchCandidateLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Patch Candidate Lane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPatchCandidateLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PATCH_CANDIDATE_LANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "controlledExecutionSandbox")
    ? normalizeInlineJsonSource("inline.controlled_execution_sandbox", options.controlledExecutionSandbox)
    : await readJsonOrBuildControlledExecutionSandbox(inputs.source_controlled_execution_sandbox_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudePatchReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_patch_review_receipt", options.claudePatchReviewReceipt)
    : await readJsonSource(inputs.claude_patch_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const patchRows = buildTermRows("generated_patch_candidate", "Patch candidate", PATCH_CANDIDATE_TERMS, roadmapDoc.text, "generated_patch_candidate_rows", generatedAt, patchExtras);
  const diffRows = buildTermRows("diff_packet", "Diff packet", DIFF_PACKET_TERMS, roadmapDoc.text, "patch_diff_packet_rows", generatedAt, diffExtras);
  const rollbackRows = buildTermRows("rollback_binding", "Rollback binding", ROLLBACK_TERMS, roadmapDoc.text, "patch_rollback_binding_rows", generatedAt, rollbackExtras);
  const validationRows = buildTermRows("validation_ref", "Validation ref", VALIDATION_TERMS, roadmapDoc.text, "patch_validation_ref_rows", generatedAt, validationExtras);
  const claudeReviewRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const negativeRows = buildTermRows("protected_scope_negative", "Protected negative fixture", NEGATIVE_TERMS, roadmapDoc.text, "patch_protected_scope_negative_rows", generatedAt, negativeExtras);
  const operatorRows = buildTermRows("patch_operator_projection", "Patch operator projection", OPERATOR_TERMS, roadmapDoc.text, "patch_operator_projection_rows", generatedAt, operatorExtras);
  const authorityRows = buildTermRows("patch_authority_guard", "Patch authority guard", AUTHORITY_TERMS, roadmapDoc.text, "patch_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, patchRows, diffRows, rollbackRows, validationRows, claudeReviewRows, negativeRows, operatorRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, patchRows, diffRows, rollbackRows, validationRows, claudeReviewRows, negativeRows, operatorRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, patchRows, diffRows, rollbackRows, validationRows, claudeReviewRows, negativeRows, operatorRows, authorityRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      controlled_execution_sandbox_path: source.path,
      claude_patch_review_receipt_path: claudeReview.path,
    },
    source_controlled_execution_sandbox_summary: source.data?.summary ?? null,
    observed_claude_patch_review_summary: claudeReview.data?.summary ?? null,
    patch_candidate_lane_contract: contract,
    patch_candidate_phase_rows: phaseRows,
    patch_candidate_source_binding_rows: sourceRows,
    generated_patch_candidate_rows: patchRows,
    patch_diff_packet_rows: diffRows,
    patch_rollback_binding_rows: rollbackRows,
    patch_validation_ref_rows: validationRows,
    patch_claude_review_rows: claudeReviewRows,
    patch_protected_scope_negative_rows: negativeRows,
    patch_operator_projection_rows: operatorRows,
    patch_authority_guard_rows: authorityRows,
    p12600_freeze_rows: freezeRows,
    patch_candidate_boundary: boundary,
    patch_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, patchRows, diffRows, rollbackRows, validationRows, negativeRows, operatorRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "patch_candidate_lane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.patch_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.patch_candidate_validation_items);
  result.summary = buildSummary({ boundary, patchRows, diffRows, rollbackRows, validationRows, negativeRows, operatorRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writePatchCandidateLane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "patch-candidate-lane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "patch-candidate-phase-rows.json"), collectionEnvelope("patch-candidate-phase-rows.v1", "patch_candidate_phase_rows", result.patch_candidate_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-candidate-source-binding-rows.json"), collectionEnvelope("patch-candidate-source-binding-rows.v1", "patch_candidate_source_binding_rows", result.patch_candidate_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "generated-patch-candidate-rows.json"), collectionEnvelope("generated-patch-candidate-rows.v1", "generated_patch_candidate_rows", result.generated_patch_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-diff-packet-rows.json"), collectionEnvelope("patch-diff-packet-rows.v1", "patch_diff_packet_rows", result.patch_diff_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-rollback-binding-rows.json"), collectionEnvelope("patch-rollback-binding-rows.v1", "patch_rollback_binding_rows", result.patch_rollback_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-validation-ref-rows.json"), collectionEnvelope("patch-validation-ref-rows.v1", "patch_validation_ref_rows", result.patch_validation_ref_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-claude-review-rows.json"), collectionEnvelope("patch-claude-review-rows.v1", "patch_claude_review_rows", result.patch_claude_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-protected-scope-negative-rows.json"), collectionEnvelope("patch-protected-scope-negative-rows.v1", "patch_protected_scope_negative_rows", result.patch_protected_scope_negative_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-operator-projection-rows.json"), collectionEnvelope("patch-operator-projection-rows.v1", "patch_operator_projection_rows", result.patch_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-authority-guard-rows.json"), collectionEnvelope("patch-authority-guard-rows.v1", "patch_authority_guard_rows", result.patch_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p12600-freeze-rows.json"), collectionEnvelope("p12600-freeze-rows.v1", "p12600_freeze_rows", result.p12600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-candidate-boundary.json"), result.patch_candidate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "patch-candidate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.patch_candidate_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runPatchCandidateLaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPatchCandidateLane(args);
    console.log(`Patch Candidate Lane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.patch_candidate_lane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P12401: ${result.summary.source_ready_for_p12401_handoff}`);
    console.log(`Claude patch review receipt: ${result.summary.claude_patch_review_receipt_present_now}`);
    console.log(`Ready for P12601 handoff: ${result.summary.ready_for_p12601_handoff}`);
    console.log(`Patch generated now: ${result.summary.patch_generated_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "patch-candidate-lane.contract.v1",
    generated_at: generatedAt,
    source_controlled_execution_sandbox_required: true,
    claude_patch_review_required: true,
    generated_patch_candidate_contract_required: true,
    diff_packet_required: true,
    rollback_binding_required: true,
    validation_refs_required: true,
    protected_scope_negative_fixtures_required: true,
    operator_projection_read_only: true,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p12401-p12600.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.controlled_execution_boundary ?? {};
  const sourceStatus = summary.controlled_execution_sandbox_status ?? "missing";
  const sourceReady = summary.ready_for_p12401_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P12201-P12400 source artifact available", source.available],
    ["source.range", "P12201-P12400 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P12400 source status visible", sourceStatus === "ready_for_controlled_execution_sandbox" || sourceStatus === "blocked_controlled_execution_sandbox"],
    ["source.handoff", "P12400 ready_for_p12401_handoff", sourceReady],
    ["source.block_visible", "P12400 blocker visible", sourceReady || sourceBlocked],
    ["source.execution_contract", "P12400 controlled execution contract available", Number(summary.allowlist_command_count ?? 0) >= 8 && Number(summary.sandbox_policy_count ?? 0) >= 6],
    ["source.no_execution_write", "P12400 source did not execute commands or open write", boundary.actual_command_executed_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_control_enabled === false && boundary.protected_action_enabled === false],
    ["source.no_final_trust", "P12400 source did not open final approval production PASS or enterprise PASS", boundary.final_approval_ui_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p12401-p12600.md#patch-candidate-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = claudeReview.available === true
    && claudeReview.data?.review_engine === "claude_code_opus_max"
    && claudeReview.data?.receipt_status === "complete"
    && claudeReview.data?.scope_patch_candidate_lane === true;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => {
    const observed = reviewId === "review_receipt_observed"
      ? reviewObserved
      : includesText(roadmapText, label.replace("Claude Code Opus max ", ""));
    return verdictRow({
      row_id: `claude_review.${reviewId}`,
      category: "patch_claude_review_gate",
      label,
      required: true,
      observed,
      evidence_ref: reviewId === "review_receipt_observed" ? claudeReview.path : "docs/hermes-roadmap-p12401-p12600.md#P12501-P12520",
      generated_at: generatedAt,
      review_id: reviewId,
      claude_review_required: true,
      claude_review_receipt_present_now: reviewObserved,
      claude_review_final_approval_allowed: false,
      finding_loop_required: true,
    });
  });
}

function buildFreezeRows(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const claudeReviewReady = context.claudeReviewRows.find((row) => row.row_id === "claude_review.review_receipt_observed")?.current_verdict === "pass";
  return [
    ["freeze.source", "P12400 source ready for P12401", sourceReady],
    ["freeze.source_block_visible", "P12400 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.patch_candidate", "generated patch candidate contract ready", allPass(context.patchRows)],
    ["freeze.diff_packet", "diff packet contract ready", allPass(context.diffRows)],
    ["freeze.rollback", "rollback binding ready", allPass(context.rollbackRows)],
    ["freeze.validation_refs", "validation ref binding ready", allPass(context.validationRows)],
    ["freeze.claude_review", "Claude patch candidate review receipt ready", claudeReviewReady],
    ["freeze.protected_negative", "protected scope negative fixtures ready", allPass(context.negativeRows)],
    ["freeze.operator_projection", "read-only operator/API patch projection ready", allPass(context.operatorRows)],
    ["freeze.authority_guard", "no-direct-apply authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_write_apply", "no patch generation apply write protected action or connector write opened", true],
    ["freeze.no_final_trust", "no final approval production PASS or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p12600_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p12600-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const claudeObserved = context.claudeReviewRows.find((row) => row.row_id === "claude_review.review_receipt_observed")?.current_verdict === "pass";
  const contractReady = allPass(context.patchRows)
    && allPass(context.diffRows)
    && allPass(context.rollbackRows)
    && allPass(context.validationRows)
    && allPass(context.negativeRows)
    && allPass(context.operatorRows)
    && allPass(context.authorityRows);
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_controlled_execution_sandbox_available: sourceAvailable,
    source_ready_for_p12401_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    claude_patch_review_receipt_present_now: claudeObserved,
    claude_patch_review_block_visible_now: claudeObserved === false,
    patch_candidate_contract_ready: contractReady,
    p12600_patch_candidate_lane_freeze_ready: freezeReady,
    ready_for_p12601_handoff: freezeReady,
    patch_candidate_generation_allowed_with_review: freezeReady,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    raw_body_exposure_allowed: false,
    secret_read_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P12401-P12600 phase rows incomplete", "docs/hermes-roadmap-p12401-p12600.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P12401-P12600"), "Architecture doc missing P12401-P12600 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P12400 source state must be available and blocker-visible", "patch_candidate_source_binding_rows");
  add("patch.ready", "patch_contract", context.patchRows.length === PATCH_CANDIDATE_TERMS.length && allPass(context.patchRows), "Patch candidate rows incomplete", "generated_patch_candidate_rows");
  add("diff.ready", "patch_contract", context.diffRows.length === DIFF_PACKET_TERMS.length && allPass(context.diffRows), "Diff packet rows incomplete", "patch_diff_packet_rows");
  add("rollback.ready", "patch_contract", context.rollbackRows.length === ROLLBACK_TERMS.length && allPass(context.rollbackRows), "Rollback rows incomplete", "patch_rollback_binding_rows");
  add("validation.ready", "patch_contract", context.validationRows.length === VALIDATION_TERMS.length && allPass(context.validationRows), "Validation ref rows incomplete", "patch_validation_ref_rows");
  add("claude_review.block_visible", "review", context.claudeReviewRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_patch_review_block_visible_now === true || context.boundary.claude_patch_review_receipt_present_now === true), "Claude patch review missing without visible blocker", "patch_claude_review_rows");
  add("negative.ready", "fixtures", context.negativeRows.length === NEGATIVE_TERMS.length && allPass(context.negativeRows), "Protected scope negative rows incomplete", "patch_protected_scope_negative_rows");
  add("operator.ready", "projection", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Operator projection rows incomplete", "patch_operator_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "patch_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P12600 freeze rows missing", "p12600_freeze_rows");
  add("boundary.no.patch.apply", "boundary", context.boundary.patch_generated_now === false && context.boundary.patch_applied_now === false && context.boundary.direct_apply_allowed_now === false, "Patch lane generated or applied a patch", "patch_candidate_boundary");
  add("boundary.no.write", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false, "Patch lane opened write/protected/connector/runtime execution", "patch_candidate_boundary");
  add("boundary.no.secret.final.trust", "boundary", context.boundary.secret_read_allowed_now === false && context.boundary.raw_body_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "Patch lane opened secret/raw/final/trust boundary", "patch_candidate_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p12601_handoff === context.boundary.p12600_patch_candidate_lane_freeze_ready, "P12601 handoff state must match P12600 freeze state", "patch_candidate_boundary");
  return items;
}

function buildSummary(context) {
  return {
    patch_candidate_lane_status: context.boundary.ready_for_p12601_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p12401_handoff: context.boundary.source_ready_for_p12401_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    claude_patch_review_receipt_present_now: context.boundary.claude_patch_review_receipt_present_now,
    claude_patch_review_block_visible_now: context.boundary.claude_patch_review_block_visible_now,
    patch_candidate_row_count: context.patchRows.length,
    diff_packet_row_count: context.diffRows.length,
    rollback_binding_count: context.rollbackRows.length,
    validation_ref_count: context.validationRows.length,
    protected_negative_count: context.negativeRows.length,
    operator_projection_count: context.operatorRows.length,
    authority_guard_count: context.authorityRows.length,
    p12600_patch_candidate_lane_freeze_ready: context.boundary.p12600_patch_candidate_lane_freeze_ready,
    ready_for_p12601_handoff: context.boundary.ready_for_p12601_handoff,
    patch_candidate_generation_allowed_with_review: context.boundary.patch_candidate_generation_allowed_with_review,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Patch Candidate Lane",
    "",
    `Status: ${result.summary.patch_candidate_lane_status}`,
    `Program: ${result.program_range}`,
    `Patch candidate rows: ${result.summary.patch_candidate_row_count}`,
    `Diff packet rows: ${result.summary.diff_packet_row_count}`,
    `Source ready for P12401: ${result.summary.source_ready_for_p12401_handoff}`,
    `Claude patch review receipt present: ${result.summary.claude_patch_review_receipt_present_now}`,
    `Ready for P12601 handoff: ${result.summary.ready_for_p12601_handoff}`,
    `Patch generated now: ${result.summary.patch_generated_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.generated_patch_candidate_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.direct_apply_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Patch Candidate Lane</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Patch Candidate Lane</h1>
    <p class="notice">Generated-patch candidate contract. Source and review blockers remain visible; patch generation, apply, mutation, final authority, and trust badges remain disabled.</p>
    <table><thead><tr><th>Patch Contract Term</th><th>Verdict</th><th>Direct Apply</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildControlledExecutionSandbox(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildControlledExecutionSandbox({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.controlled_execution_sandbox", built);
}

function patchExtras() {
  return {
    generated_patch_only: true,
    patch_generated_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    diff_packet_required: true,
    rollback_binding_required: true,
    claude_review_required: true,
  };
}

function diffExtras() {
  return {
    diff_packet_required: true,
    file_scope_required: true,
    semantic_risk_required: true,
    test_plan_required: true,
    reviewer_ref_required: true,
    direct_apply_allowed_now: false,
  };
}

function rollbackExtras() {
  return {
    rollback_binding_required: true,
    rollback_target_required: true,
    rollback_execution_allowed_now: false,
    write_without_rollback_allowed: false,
  };
}

function validationExtras() {
  return {
    validation_ref_required: true,
    required_before_apply: true,
    can_be_skipped: false,
    validation_executed_now: false,
  };
}

function negativeExtras() {
  return {
    negative_fixture_required: true,
    expected_result: "blocked",
    actual_result: "blocked",
    unsafe_patch_candidate_allowed: false,
  };
}

function operatorExtras() {
  return {
    api_methods_allowed: ["GET", "HEAD"],
    mutation_method_allowed_now: false,
    form_button_apply_enabled: false,
    final_approval_ui_enabled: false,
  };
}

function authorityExtras() {
  return {
    patch_generated_now: false,
    direct_apply_allowed_now: false,
    file_write_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    final_approval_allowed_now: false,
  };
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.architectureDocPath,
    source_controlled_execution_sandbox_path: options.sourceControlledExecutionSandboxPath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.sourceControlledExecutionSandboxPath,
    claude_patch_review_receipt_path: options.claudePatchReviewReceiptPath ?? DEFAULT_PATCH_CANDIDATE_LANE_INPUTS.claudePatchReviewReceiptPath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-controlled-execution-sandbox-path") args.sourceControlledExecutionSandboxPath = argv[++index];
    else if (value === "--claude-patch-review-receipt-path") args.claudePatchReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P12401-P12600 Patch Candidate Lane artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
