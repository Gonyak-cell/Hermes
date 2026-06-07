import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildP16800PlatformFreeze } from "./p16800-platform-freeze.mjs";

export const DEFAULT_FREEZE_EVIDENCE_ACTIVATION_OUT_DIR = "artifacts/freeze-evidence-activation/latest";
export const DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS = {
  schemaPath: "schemas/freeze-evidence-activation.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p16801-p17200.md",
  architectureDocPath: "docs/architecture.md",
  sourceP16800PlatformFreezePath: "artifacts/p16800-platform-freeze/latest/p16800-platform-freeze.json",
  claudePlatformFreezeReviewReceiptPath: "artifacts/p16800-platform-freeze/review/claude-platform-freeze-review-receipt.json",
};

const COMMAND_NAME = "platform:freeze-evidence-activation";
const SCHEMA_VERSION = "freeze-evidence-activation.v1";
const CAPABILITY_ID = "platform.freeze_evidence_activation";
const PROGRAM_RANGE = "P16801-P17200";
const SOURCE_PROGRAM_RANGE = "P16601-P16800";
const READY_STATUS = "ready_for_freeze_evidence_activation";
const BLOCKED_STATUS = "blocked_freeze_evidence_activation";

const PHASE_SPECS = [
  ["P16801-P16840", "P16800 Source Recheck", "freeze_activation_source_recheck_rows"],
  ["P16841-P16880", "Freeze Evidence Packet Activation", "freeze_evidence_packet_rows"],
  ["P16881-P16920", "Claude Review Receipt Intake", "claude_review_receipt_intake_rows"],
  ["P16921-P16960", "Finding Loop", "finding_loop_rows"],
  ["P16961-P17000", "Evidence Gap Projection", "evidence_gap_projection_rows"],
  ["P17001-P17040", "Post-P16800 Handoff Recheck", "post_p16800_handoff_recheck_rows"],
  ["P17041-P17080", "Activation Operator Projection", "activation_operator_projection_rows"],
  ["P17081-P17120", "Authority Guard Revalidation", "activation_authority_guard_rows"],
  ["P17121-P17160", "Activation Closeout Packet", "activation_closeout_packet_rows"],
  ["P17161-P17200", "P17200 Freeze Activation Closeout", "p17200_freeze_rows"],
];

const EVIDENCE_PACKET_TERMS = ["freeze packet id", "source chain ref", "closeout packet ref", "validation evidence ref", "blocked evidence ref", "activation blocker"];
const CLAUDE_RECEIPT_TERMS = ["Claude Code Opus max review receipt schema", "model effort", "reviewed program range", "receipt status", "receipt evidence ref", "no Claude final approval"];
const FINDING_TERMS = ["finding ledger id", "unresolved finding count", "severity triage", "fix verification ref", "re-review trigger", "no auto close"];
const EVIDENCE_GAP_TERMS = ["missing source evidence", "missing receipt evidence", "unresolved finding evidence", "stale validation evidence", "blocker reason", "next evidence action"];
const HANDOFF_RECHECK_TERMS = ["source structural readiness", "receipt readiness", "finding readiness", "authority boundary readiness", "validation readiness", "handoff blocker"];
const OPERATOR_TERMS = ["read-only activation dashboard row", "evidence status rollup", "finding status rollup", "handoff status rollup", "next action rollup", "no mutation"];
const AUTHORITY_TERMS = ["no deployment", "no release approval", "no production PASS", "no enterprise PASS", "no review bypass", "no final automated approval"];
const CLOSEOUT_TERMS = ["activation closeout id", "committed source ref", "validation command list", "review receipt state", "finding loop state", "blocked handoff note"];

export async function runFreezeEvidenceActivation(options = {}) {
  const result = await buildFreezeEvidenceActivation(options);
  if (options.write !== false) await writeFreezeEvidenceActivation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Freeze Evidence Activation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFreezeEvidenceActivation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "p16800PlatformFreeze")
    ? normalizeInlineJsonSource("inline.p16800_platform_freeze", options.p16800PlatformFreeze)
    : await readJsonOrBuildP16800(inputs.source_p16800_platform_freeze_path, generatedAt);
  const claudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudePlatformFreezeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_platform_freeze_review_receipt", options.claudePlatformFreezeReviewReceipt)
    : await readJsonSource(inputs.claude_platform_freeze_review_receipt_path);

  const receiptState = buildReceiptState(claudeReceipt);
  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRecheckRows(source, sourceState, generatedAt);
  const evidenceRows = buildTermRows("freeze_evidence_packet", "Freeze evidence packet", EVIDENCE_PACKET_TERMS, roadmapDoc.text, "freeze_evidence_packet_rows", generatedAt, evidencePacketExtras);
  const receiptRows = buildClaudeReceiptRows(roadmapDoc.text, claudeReceipt, receiptState, generatedAt);
  const findingRows = buildFindingLoopRows(roadmapDoc.text, receiptState, generatedAt);
  const gapRows = buildEvidenceGapRows(roadmapDoc.text, sourceState, receiptState, generatedAt);
  const handoffRows = buildHandoffRecheckRows(roadmapDoc.text, sourceState, receiptState, generatedAt);
  const operatorRows = buildTermRows("activation_operator_projection", "Activation operator projection", OPERATOR_TERMS, roadmapDoc.text, "activation_operator_projection_rows", generatedAt, operatorExtras);
  const authorityRows = buildTermRows("activation_authority_guard", "Activation authority guard", AUTHORITY_TERMS, roadmapDoc.text, "activation_authority_guard_rows", generatedAt, authorityExtras);
  const closeoutRows = buildTermRows("activation_closeout_packet", "Activation closeout packet", CLOSEOUT_TERMS, roadmapDoc.text, "activation_closeout_packet_rows", generatedAt, closeoutExtras);
  const freezeRows = buildFreezeRows({ sourceState, receiptState, sourceRows, evidenceRows, receiptRows, findingRows, gapRows, handoffRows, operatorRows, authorityRows, closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceState, receiptState, evidenceRows, receiptRows, findingRows, gapRows, handoffRows, operatorRows, authorityRows, closeoutRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, evidenceRows, receiptRows, findingRows, gapRows, handoffRows, operatorRows, authorityRows, closeoutRows, freezeRows, boundary });
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
      p16800_platform_freeze_path: source.path,
      claude_platform_freeze_review_receipt_path: claudeReceipt.path,
    },
    source_p16800_platform_freeze_summary: source.data?.summary ?? null,
    observed_claude_platform_freeze_review_summary: claudeReceipt.data?.summary ?? null,
    freeze_activation_contract: buildContract(generatedAt),
    freeze_activation_phase_rows: phaseRows,
    freeze_activation_source_recheck_rows: sourceRows,
    freeze_evidence_packet_rows: evidenceRows,
    claude_review_receipt_intake_rows: receiptRows,
    finding_loop_rows: findingRows,
    evidence_gap_projection_rows: gapRows,
    post_p16800_handoff_recheck_rows: handoffRows,
    activation_operator_projection_rows: operatorRows,
    activation_authority_guard_rows: authorityRows,
    activation_closeout_packet_rows: closeoutRows,
    p17200_freeze_rows: freezeRows,
    freeze_activation_boundary: boundary,
    freeze_activation_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, evidenceRows, receiptRows, findingRows, gapRows, handoffRows, operatorRows, authorityRows, closeoutRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "freeze_evidence_activation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.freeze_activation_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.freeze_activation_validation_items);
  result.summary = buildSummary({ boundary, evidenceRows, receiptRows, findingRows, gapRows, handoffRows, operatorRows, authorityRows, closeoutRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeFreezeEvidenceActivation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "freeze-evidence-activation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-activation-phase-rows.json"), collectionEnvelope("freeze-activation-phase-rows.v1", "freeze_activation_phase_rows", result.freeze_activation_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-activation-source-recheck-rows.json"), collectionEnvelope("freeze-activation-source-recheck-rows.v1", "freeze_activation_source_recheck_rows", result.freeze_activation_source_recheck_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-evidence-packet-rows.json"), collectionEnvelope("freeze-evidence-packet-rows.v1", "freeze_evidence_packet_rows", result.freeze_evidence_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-receipt-intake-rows.json"), collectionEnvelope("claude-review-receipt-intake-rows.v1", "claude_review_receipt_intake_rows", result.claude_review_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-loop-rows.json"), collectionEnvelope("finding-loop-rows.v1", "finding_loop_rows", result.finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-gap-projection-rows.json"), collectionEnvelope("evidence-gap-projection-rows.v1", "evidence_gap_projection_rows", result.evidence_gap_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-p16800-handoff-recheck-rows.json"), collectionEnvelope("post-p16800-handoff-recheck-rows.v1", "post_p16800_handoff_recheck_rows", result.post_p16800_handoff_recheck_rows, result.generated_at));
  await writeJson(path.join(outDir, "activation-operator-projection-rows.json"), collectionEnvelope("activation-operator-projection-rows.v1", "activation_operator_projection_rows", result.activation_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "activation-authority-guard-rows.json"), collectionEnvelope("activation-authority-guard-rows.v1", "activation_authority_guard_rows", result.activation_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "activation-closeout-packet-rows.json"), collectionEnvelope("activation-closeout-packet-rows.v1", "activation_closeout_packet_rows", result.activation_closeout_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "p17200-freeze-rows.json"), collectionEnvelope("p17200-freeze-rows.v1", "p17200_freeze_rows", result.p17200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-activation-boundary.json"), result.freeze_activation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "freeze-evidence-activation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.freeze_activation_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runFreezeEvidenceActivationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runFreezeEvidenceActivation(args);
    console.log(`Freeze Evidence Activation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.freeze_evidence_activation_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`P16800 structural freeze ready: ${result.summary.source_p16800_structural_freeze_ready}`);
    console.log(`Claude review receipt present: ${result.summary.claude_review_receipt_present_now}`);
    console.log(`Unresolved findings: ${result.summary.unresolved_finding_count}`);
    console.log(`Ready for P17201 handoff: ${result.summary.ready_for_p17201_handoff}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
    console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
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
    contract_id: "freeze-evidence-activation.contract.v1",
    generated_at: generatedAt,
    source_p16800_required: true,
    claude_review_receipt_intake_required: true,
    finding_loop_required: true,
    evidence_gap_projection_required: true,
    post_p16800_handoff_recheck_required: true,
    activation_operator_projection_required: true,
    activation_authority_guard_required: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p16801-p17200.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.platform_freeze_boundary ?? {};
  const sourceStatus = summary.platform_freeze_status ?? "missing";
  const sourceReady = summary.ready_for_post_p16800_handoff === true;
  const statusVisible = sourceStatus === "ready_for_p16800_platform_freeze" || sourceStatus === "blocked_p16800_platform_freeze";
  const rowCountsReady = Number(summary.roadmap_ledger_freeze_row_count ?? 0) >= 6
    && Number(summary.validation_matrix_freeze_row_count ?? 0) >= 6
    && Number(summary.review_cadence_freeze_row_count ?? 0) >= 6
    && Number(summary.authority_boundary_freeze_row_count ?? 0) >= 6
    && Number(summary.saas_factory_handoff_freeze_row_count ?? 0) >= 6
    && Number(summary.operator_evidence_projection_row_count ?? 0) >= 6
    && Number(summary.closeout_packet_projection_row_count ?? 0) >= 6;
  const boundaryClosed = boundary.deployment_allowed_now === false
    && boundary.release_approval_allowed_now === false
    && boundary.production_pass_enabled === false
    && boundary.enterprise_pass_enabled === false
    && boundary.enterprise_trust_claim_allowed_now === false
    && boundary.protected_closeout_enabled === false
    && boundary.human_gate_bypass_allowed_now === false
    && boundary.independent_review_bypass_allowed_now === false
    && boundary.single_owner_enterprise_trust_allowed_now === false
    && boundary.environment_config_write_allowed_now === false
    && boundary.migration_execution_allowed_now === false
    && boundary.rollback_execution_allowed_now === false
    && boundary.runtime_execution_allowed_now === false
    && boundary.write_action_allowed_now === false
    && boundary.protected_action_allowed_now === false
    && boundary.connector_write_enabled === false
    && boundary.external_service_mutation_allowed_now === false
    && boundary.secret_read_allowed_now === false
    && boundary.raw_source_exposure_allowed === false
    && boundary.reviewer_mutation_allowed_now === false
    && boundary.codex_final_approval_ui_enabled === false
    && boundary.claude_final_approval_ui_enabled === false;
  const structuralReady = source.available === true
    && source.data?.program_range === SOURCE_PROGRAM_RANGE
    && statusVisible
    && summary.source_ready_for_p16601_handoff === true
    && rowCountsReady
    && boundaryClosed;
  const blockVisible = source.available === true && (sourceReady === true || sourceReady === false || summary.source_block_visible_now === true || summary.claude_platform_freeze_review_block_visible_now === true);
  return { sourceAvailable: source.available === true, summary, boundary, sourceStatus, sourceReady, statusVisible, rowCountsReady, boundaryClosed, structuralReady, blockVisible };
}

function buildReceiptState(receipt) {
  const unresolvedFindingCount = Number(receipt.data?.unresolved_finding_count ?? 0);
  const present = receipt.available === true
    && receipt.data?.review_engine === "claude_code_opus_max"
    && receipt.data?.receipt_status === "complete"
    && receipt.data?.scope_p16800_platform_freeze === true
    && unresolvedFindingCount === 0;
  return {
    present,
    unresolvedFindingCount,
    reviewedProgramRange: receipt.data?.reviewed_program_range ?? null,
    receiptStatus: receipt.data?.receipt_status ?? "missing",
  };
}

function buildSourceRecheckRows(source, state, generatedAt) {
  return [
    ["source.available", "P16601-P16800 source artifact available", source.available],
    ["source.range", "P16601-P16800 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P16800 source status visible", state.statusVisible],
    ["source.structural_freeze_ready", "P16800 structural freeze ready excluding fresh receipt intake", state.structuralReady],
    ["source.current_post_p16800_handoff", "P16800 current ready_for_post_p16800_handoff", state.sourceReady],
    ["source.block_visible", "P16800 blocker visible when not ready", state.blockVisible],
    ["source.no_production_enterprise", "P16800 source kept deployment release production enterprise trust protected closeout and bypass closed", state.boundaryClosed],
    ["source.no_execution_raw_final", "P16800 source kept execution write connector mutation raw secret reviewer mutation and final approval closed", state.boundaryClosed],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_recheck",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: state.sourceStatus,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p16801-p17200.md#freeze-evidence-activation-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildClaudeReceiptRows(roadmapText, receipt, state, generatedAt) {
  return CLAUDE_RECEIPT_TERMS.map((term) => {
    const isReceiptStateTerm = term === "receipt status" || term === "receipt evidence ref" || term === "reviewed program range";
    const observed = isReceiptStateTerm ? state.present : includesText(roadmapText, term);
    return verdictRow({
      row_id: `claude_review_receipt_intake.${slug(term)}`,
      category: "claude_review_receipt_intake",
      label: `Claude review receipt intake: ${term}`,
      required: true,
      observed,
      evidence_ref: state.present ? receipt.path : "docs/hermes-roadmap-p16801-p17200.md#P16881-P16920",
      generated_at: generatedAt,
      output_ref: "claude_review_receipt_intake_rows",
      term_id: slug(term),
      claude_review_receipt_present_now: state.present,
      claude_final_approval_allowed: false,
    });
  });
}

function buildFindingLoopRows(roadmapText, state, generatedAt) {
  return FINDING_TERMS.map((term) => {
    const observed = term === "unresolved finding count" ? state.present && state.unresolvedFindingCount === 0 : includesText(roadmapText, term);
    return verdictRow({
      row_id: `finding_loop.${slug(term)}`,
      category: "finding_loop",
      label: `Finding loop: ${term}`,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p16801-p17200.md#P16921-P16960",
      generated_at: generatedAt,
      output_ref: "finding_loop_rows",
      term_id: slug(term),
      unresolved_finding_count: state.unresolvedFindingCount,
      finding_auto_close_allowed_now: false,
    });
  });
}

function buildEvidenceGapRows(roadmapText, sourceState, receiptState, generatedAt) {
  return EVIDENCE_GAP_TERMS.map((term) => verdictRow({
    row_id: `evidence_gap_projection.${slug(term)}`,
    category: "evidence_gap_projection",
    label: `Evidence gap projection: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p16801-p17200.md#P16961-P17000",
    generated_at: generatedAt,
    output_ref: "evidence_gap_projection_rows",
    term_id: slug(term),
    missing_source_evidence_now: sourceState.structuralReady === false,
    missing_receipt_evidence_now: receiptState.present === false,
    unresolved_finding_count: receiptState.unresolvedFindingCount,
  }));
}

function buildHandoffRecheckRows(roadmapText, sourceState, receiptState, generatedAt) {
  const authorityReady = sourceState.boundaryClosed;
  const validationReady = sourceState.summary?.validation_error_count === 0 || sourceState.summary?.validation_error_count === undefined;
  const handoffReady = sourceState.structuralReady && receiptState.present && receiptState.unresolvedFindingCount === 0 && authorityReady && validationReady;
  const handoffBlockedVisible = sourceState.structuralReady === false || receiptState.present === false || receiptState.unresolvedFindingCount > 0;
  const states = new Map([
    ["source structural readiness", sourceState.structuralReady],
    ["receipt readiness", receiptState.present],
    ["finding readiness", receiptState.present && receiptState.unresolvedFindingCount === 0],
    ["authority boundary readiness", authorityReady],
    ["validation readiness", validationReady],
    ["handoff blocker", handoffReady || handoffBlockedVisible],
  ]);
  return HANDOFF_RECHECK_TERMS.map((term) => verdictRow({
    row_id: `post_p16800_handoff_recheck.${slug(term)}`,
    category: "post_p16800_handoff_recheck",
    label: `Post-P16800 handoff recheck: ${term}`,
    required: true,
    observed: states.get(term) ?? includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p16801-p17200.md#P17001-P17040",
    generated_at: generatedAt,
    output_ref: "post_p16800_handoff_recheck_rows",
    term_id: slug(term),
  }));
}

function buildFreezeRows(context) {
  const sourceReady = context.sourceState.structuralReady;
  const receiptReady = context.receiptState.present;
  const findingReady = receiptReady && context.receiptState.unresolvedFindingCount === 0;
  return [
    ["freeze.source", "P16800 source structural freeze ready", sourceReady],
    ["freeze.source_block_visible", "P16800 source blocker visible when not structurally ready", sourceReady || context.sourceState.blockVisible],
    ["freeze.evidence_packet", "freeze evidence packet ready", allPass(context.evidenceRows)],
    ["freeze.claude_receipt", "Claude review receipt intake ready", receiptReady],
    ["freeze.finding_loop", "finding loop ready", findingReady],
    ["freeze.evidence_gap", "evidence gap projection ready", allPass(context.gapRows)],
    ["freeze.handoff_recheck", "post-P16800 handoff recheck ready", allPass(context.handoffRows)],
    ["freeze.operator_projection", "activation operator projection ready", allPass(context.operatorRows)],
    ["freeze.authority_guard", "activation authority guard ready", allPass(context.authorityRows)],
    ["freeze.closeout_packet", "activation closeout packet ready", allPass(context.closeoutRows)],
    ["freeze.no_production_side_effects", "no deployment release approval production PASS enterprise PASS trust protected closeout or single-owner enterprise trust opened", true],
    ["freeze.no_execution_raw_secret", "no config write migration rollback runtime write connector external mutation raw exposure or secret read opened", true],
    ["freeze.no_final_or_bypass", "no Codex or Claude final approval human gate bypass independent review bypass reviewer mutation or auto close opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p17200_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p17200-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const freezeEvidenceReady = allPass(context.evidenceRows);
  const findingReady = context.receiptState.present && context.receiptState.unresolvedFindingCount === 0;
  const gapReady = allPass(context.gapRows);
  const handoffReady = allPass(context.handoffRows);
  const operatorReady = allPass(context.operatorRows);
  const authorityReady = allPass(context.authorityRows);
  const closeoutReady = allPass(context.closeoutRows);
  const freezeReady = context.sourceState.structuralReady
    && context.receiptState.present
    && findingReady
    && freezeEvidenceReady
    && gapReady
    && handoffReady
    && operatorReady
    && authorityReady
    && closeoutReady
    && allPass(context.freezeRows);
  return {
    source_p16800_available: context.sourceState.sourceAvailable,
    source_p16800_structural_freeze_ready: context.sourceState.structuralReady,
    source_ready_for_post_p16800_handoff: context.sourceState.sourceReady,
    source_block_visible_now: context.sourceState.blockVisible && context.sourceState.sourceReady === false,
    freeze_evidence_packet_ready: freezeEvidenceReady,
    claude_review_receipt_present_now: context.receiptState.present,
    claude_review_receipt_block_visible_now: context.receiptState.present === false,
    finding_loop_ready: findingReady,
    unresolved_finding_count: context.receiptState.unresolvedFindingCount,
    evidence_gap_projection_ready: gapReady,
    post_p16800_handoff_recheck_ready: handoffReady,
    activation_operator_projection_ready: operatorReady,
    activation_authority_guard_ready: authorityReady,
    activation_closeout_packet_ready: closeoutReady,
    p17200_freeze_activation_ready: freezeReady,
    ready_for_p17201_handoff: freezeReady,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  const sourceAvailable = rowPass(context.sourceRows, "source.available");
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P16801-P17200 phase rows incomplete", "docs/hermes-roadmap-p16801-p17200.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P16801-P17200"), "Architecture doc missing P16801-P17200 reference", "docs/architecture.md");
  add("source.available", "source", sourceAvailable, "P16800 source artifact is required", "freeze_activation_source_recheck_rows");
  add("source.state_visible", "source", sourceAvailable && rowPass(context.sourceRows, "source.range") && rowPass(context.sourceRows, "source.status_visible") && rowPass(context.sourceRows, "source.block_visible"), "P16800 source state must be range/status/blocker visible", "freeze_activation_source_recheck_rows");
  add("source.boundary_closed", "source", sourceAvailable && rowPass(context.sourceRows, "source.no_production_enterprise") && rowPass(context.sourceRows, "source.no_execution_raw_final"), "P16800 source boundary must remain closed", "freeze_activation_source_recheck_rows");
  add("evidence.ready", "evidence", context.evidenceRows.length === EVIDENCE_PACKET_TERMS.length && allPass(context.evidenceRows), "Freeze evidence packet rows incomplete", "freeze_evidence_packet_rows");
  add("claude_receipt.block_visible", "review", context.receiptRows.length === CLAUDE_RECEIPT_TERMS.length && (context.boundary.claude_review_receipt_present_now === true || context.boundary.claude_review_receipt_block_visible_now === true), "Claude review receipt missing without visible blocker", "claude_review_receipt_intake_rows");
  add("finding_loop.visible", "finding", context.findingRows.length === FINDING_TERMS.length && (context.boundary.finding_loop_ready === true || context.boundary.claude_review_receipt_block_visible_now === true || context.boundary.unresolved_finding_count > 0), "Finding loop missing without visible blocker", "finding_loop_rows");
  add("gap.ready", "gap", context.gapRows.length === EVIDENCE_GAP_TERMS.length && allPass(context.gapRows), "Evidence gap projection rows incomplete", "evidence_gap_projection_rows");
  add("handoff.visible", "handoff", context.handoffRows.length === HANDOFF_RECHECK_TERMS.length && (context.boundary.post_p16800_handoff_recheck_ready === true || rowPass(context.handoffRows, "post_p16800_handoff_recheck.handoff_blocker")), "Post-P16800 handoff recheck missing blocker visibility", "post_p16800_handoff_recheck_rows");
  add("operator.ready", "projection", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Activation operator projection rows incomplete", "activation_operator_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Activation authority guard rows incomplete", "activation_authority_guard_rows");
  add("closeout.ready", "closeout", context.closeoutRows.length === CLOSEOUT_TERMS.length && allPass(context.closeoutRows), "Activation closeout packet rows incomplete", "activation_closeout_packet_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P17200 freeze rows missing", "p17200_freeze_rows");
  add("boundary.no.production.claim", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false, "Freeze activation opened production or enterprise authority", "freeze_activation_boundary");
  add("boundary.no.execution.raw.secret", "boundary", context.boundary.environment_config_write_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Freeze activation opened config migration rollback runtime write connector mutation secret or raw exposure", "freeze_activation_boundary");
  add("boundary.no.final.or.bypass", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false && context.boundary.human_gate_bypass_allowed_now === false && context.boundary.independent_review_bypass_allowed_now === false && context.boundary.reviewer_mutation_allowed_now === false, "Freeze activation opened final approval or review/human bypass", "freeze_activation_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p17201_handoff === context.boundary.p17200_freeze_activation_ready, "P17201 handoff state must match P17200 freeze activation state", "freeze_activation_boundary");
  return items;
}

function buildSummary(context) {
  return {
    freeze_evidence_activation_status: context.boundary.ready_for_p17201_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p16800_structural_freeze_ready: context.boundary.source_p16800_structural_freeze_ready,
    source_ready_for_post_p16800_handoff: context.boundary.source_ready_for_post_p16800_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    freeze_evidence_packet_row_count: context.evidenceRows.length,
    claude_review_receipt_intake_row_count: context.receiptRows.length,
    claude_review_receipt_present_now: context.boundary.claude_review_receipt_present_now,
    claude_review_receipt_block_visible_now: context.boundary.claude_review_receipt_block_visible_now,
    finding_loop_row_count: context.findingRows.length,
    unresolved_finding_count: context.boundary.unresolved_finding_count,
    evidence_gap_projection_row_count: context.gapRows.length,
    post_p16800_handoff_recheck_row_count: context.handoffRows.length,
    activation_operator_projection_row_count: context.operatorRows.length,
    activation_authority_guard_row_count: context.authorityRows.length,
    activation_closeout_packet_row_count: context.closeoutRows.length,
    p17200_freeze_activation_ready: context.boundary.p17200_freeze_activation_ready,
    ready_for_p17201_handoff: context.boundary.ready_for_p17201_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Freeze Evidence Activation",
    "",
    `Status: ${result.summary.freeze_evidence_activation_status}`,
    `Program: ${result.program_range}`,
    `P16800 structural freeze ready: ${result.summary.source_p16800_structural_freeze_ready}`,
    `Claude review receipt present: ${result.summary.claude_review_receipt_present_now}`,
    `Unresolved findings: ${result.summary.unresolved_finding_count}`,
    `Ready for P17201 handoff: ${result.summary.ready_for_p17201_handoff}`,
    `Deployment allowed: ${result.summary.deployment_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.post_p16800_handoff_recheck_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Freeze Evidence Activation</title>
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
    <h1>Hermes Freeze Evidence Activation</h1>
    <p class="notice">This plane records review receipt intake, finding state, evidence gaps, and handoff recheck status. Shipment, approvals, environment mutation, execution, writes, review bypass, raw access, and finalization stay closed.</p>
    <table><thead><tr><th>Handoff Recheck</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP16800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildP16800PlatformFreeze({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.p16800_platform_freeze", built);
}

function evidencePacketExtras() {
  return { activation_packet_required: true, production_pass_enabled: false };
}

function operatorExtras() {
  return { read_only_projection_required: true, api_write_allowed_now: false, dashboard_mutation_allowed_now: false };
}

function authorityExtras() {
  return {
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function closeoutExtras() {
  return { activation_closeout_required: true, protected_closeout_enabled: false, production_pass_enabled: false };
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
    schema_path: options.schemaPath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.architectureDocPath,
    source_p16800_platform_freeze_path: options.sourceP16800PlatformFreezePath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.sourceP16800PlatformFreezePath,
    claude_platform_freeze_review_receipt_path: options.claudePlatformFreezeReviewReceiptPath ?? DEFAULT_FREEZE_EVIDENCE_ACTIVATION_INPUTS.claudePlatformFreezeReviewReceiptPath,
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
    else if (value === "--source-p16800-platform-freeze-path") args.sourceP16800PlatformFreezePath = argv[++index];
    else if (value === "--claude-platform-freeze-review-receipt-path") args.claudePlatformFreezeReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P16801-P17200 Freeze Evidence Activation artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
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
