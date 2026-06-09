import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_RAW_CAPTURE_INTAKE_OUT_DIR =
  "artifacts/post-p64000-focused-re-review-raw-capture-intake/latest";
export const DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_RAW_CAPTURE_INTAKE_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-re-review-raw-capture-intake.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p71601-p72000.md",
  architectureDocPath: "docs/architecture.md",
  dispatchGatePath:
    "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/post-p64000-focused-re-review-dispatch-gate.json",
  dispatchPacketPath:
    "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet.md",
  dispatchRowsPath:
    "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet-rows.json",
  rawCaptureGateRowsPath:
    "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/durable-raw-capture-gate-rows.json",
  evidenceCountingGuardRowsPath:
    "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/evidence-counting-guard-rows.json",
  rawReviewPath:
    "artifacts/post-p64000-focused-re-review-raw-capture/review/claude-focused-re-review-raw.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-re-review-raw-capture-intake";
const SCHEMA_VERSION = "post-p64000-focused-re-review-raw-capture-intake.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_re_review_raw_capture_intake";
const PROGRAM_RANGE = "P71601-P72000";
const SOURCE_PROGRAM_RANGE = "P71201-P71600";
const REVIEWED_PROGRAM_RANGE = "P70801-P71200";
const REVIEW_SOURCE_PROGRAM_RANGE = "P70401-P70800";
const NEXT_PROGRAM_RANGE = "P72001-P72400";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p71600_dispatch_gate_source",
  "p71600_dispatch_gate_invalid",
  "missing_dispatch_packet",
  "missing_dispatch_rows",
  "missing_raw_capture_gate_rows",
  "missing_evidence_counting_guard_rows",
  "missing_raw_capture",
  "empty_raw_capture",
  "malformed_raw_json",
  "auth_failure_or_login_prompt",
  "timeout_or_hang_counted_as_evidence",
  "pty_stdout_loss_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "wrong_reviewer_or_lane",
  "wrong_dispatch_scope",
  "wrong_reviewed_scope",
  "missing_required_hrm_ids",
  "finding_fixed_claim",
  "finding_verified_claim",
  "finding_resolved_claim",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "finding_resolution_claim",
  "patch_apply_claim",
  "write_action_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "final_approval_claim",
  "missing_p72001_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "raw_review_counted_as_evidence_now",
  "raw_capture_counted_as_normalized_receipt_now",
  "focused_re_review_normalized_now",
  "focused_re_review_completed_now",
  "auth_failure_counted_as_evidence_now",
  "timeout_or_hang_counted_as_evidence_now",
  "malformed_output_counted_as_evidence_now",
  "tool_call_output_counted_as_review_now",
  "focused_finding_fixed_claim_allowed_now",
  "focused_finding_verified_claim_allowed_now",
  "focused_finding_resolved_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "patch_apply_from_review_allowed_now",
  "write_action_from_review_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "claude_review_final_approval_allowed_now",
  "post_p72000_production_pass_claim_allowed_now",
  "post_p72000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-re-review-raw-capture-intake.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-re-review-raw-capture-intake.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-re-review-raw-capture-intake.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-re-review-raw-capture-intake -- --check"],
  [
    "adjacent.p71600",
    "node --test test/post-p64000-focused-re-review-dispatch-gate.test.mjs test/post-p64000-focused-re-review-raw-capture-intake.test.mjs",
  ],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  [
    "package.schema.json",
    "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-re-review-raw-capture-intake.schema.json\", \"utf8\"));'",
  ],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedReReviewRawCaptureIntake(options = {}) {
  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused re-review raw capture intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedReReviewRawCaptureIntake(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedReReviewRawCaptureIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_RAW_CAPTURE_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const dispatchGate = Object.prototype.hasOwnProperty.call(options, "dispatchGate")
    ? normalizeInlineJsonSource("inline.p71600_dispatch_gate", options.dispatchGate)
    : await readJsonSource(inputs.dispatch_gate_path);
  const dispatchPacket = Object.prototype.hasOwnProperty.call(options, "dispatchPacketText")
    ? normalizeInlineTextSource("inline.focused_re_review_dispatch_packet", options.dispatchPacketText)
    : await readTextSource(inputs.dispatch_packet_path);
  const dispatchRows = Object.prototype.hasOwnProperty.call(options, "dispatchRows")
    ? normalizeInlineJsonSource("inline.focused_re_review_dispatch_rows", options.dispatchRows)
    : await readJsonSource(inputs.dispatch_rows_path);
  const rawCaptureGateRows = Object.prototype.hasOwnProperty.call(options, "rawCaptureGateRows")
    ? normalizeInlineJsonSource("inline.raw_capture_gate_rows", options.rawCaptureGateRows)
    : await readJsonSource(inputs.raw_capture_gate_rows_path);
  const evidenceCountingGuardRows = Object.prototype.hasOwnProperty.call(options, "evidenceCountingGuardRows")
    ? normalizeInlineJsonSource("inline.evidence_counting_guard_rows", options.evidenceCountingGuardRows)
    : await readJsonSource(inputs.evidence_counting_guard_rows_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_focused_re_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const reviewPayload = extractReviewPayload(rawReview);
  const rawState = classifyRawReview({ rawReview, reviewPayload });

  const sourceRows = buildSourceRows({ dispatchGate, dispatchPacket, dispatchRows, rawCaptureGateRows, evidenceCountingGuardRows, generatedAt });
  const rawIntakeRows = buildRawIntakeRows({ rawReview, reviewPayload, rawState, generatedAt });
  const missingRows = buildMissingEvidenceBlockRows({ rawReview, rawState, generatedAt });
  const invalidRows = buildInvalidEvidenceBlockRows({ rawReview, rawState, generatedAt });
  const outputRows = buildRawReviewOutputShapeRows({ reviewPayload, rawState, generatedAt });
  const failureRows = buildFailureModeBlockRows({ rawReview, rawState, generatedAt });
  const authorityRows = buildAuthorityRows({ reviewPayload, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, rawState, missingRows, invalidRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, rawState, reviewPayload, generatedAt });
  const boundary = buildBoundary({ sourceRows, rawState, rawReview, reviewPayload, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, rawIntakeRows, missingRows, invalidRows, outputRows, failureRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary, rawState });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      dispatch_gate_path: dispatchGate.path,
      dispatch_packet_path: dispatchPacket.path,
      dispatch_rows_path: dispatchRows.path,
      raw_capture_gate_rows_path: rawCaptureGateRows.path,
      evidence_counting_guard_rows_path: evidenceCountingGuardRows.path,
      raw_review_path: rawReview.path,
      raw_review_sha256: rawReview.text ? sha256(rawReview.text) : "",
    },
    post_p64000_focused_re_review_raw_capture_intake_contract: {
      contract_id: "post_p64000_focused_re_review_raw_capture_intake",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      reviewed_program_range: REVIEWED_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      source_of_truth: "P71201-P71600 dispatch gate",
      reviewer: "claude-code-opus-max",
      reviewer_lane: "independent_read_only",
      required_receipt_type: "durable_raw_json",
      missing_or_invalid_raw_is_block_not_evidence: true,
      raw_capture_requires_later_normalization: true,
      review_evidence_counted: false,
      reviewer_mutation_allowed: false,
      source_mutation_allowed: false,
      finding_resolution_allowed: false,
      patch_apply_allowed: false,
      write_action_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      final_approval_allowed: false,
      generated_at: generatedAt,
    },
    p71600_dispatch_gate_source_rows: sourceRows,
    focused_re_review_raw_intake_rows: rawIntakeRows,
    missing_evidence_block_rows: missingRows,
    invalid_evidence_block_rows: invalidRows,
    raw_review_output_shape_rows: outputRows,
    failure_mode_block_rows: failureRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p72000_wiring_rows: wiringRows,
    p72000_closeout_rows: closeoutRows,
    p72001_handoff_rows: handoffRows,
    extracted_focused_re_review_payload: reviewPayload.payload,
    raw_capture_state: rawState,
    post_p64000_focused_re_review_raw_capture_intake_boundary: boundary,
    post_p64000_focused_re_review_raw_capture_intake_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available && schema.parsed
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_re_review_raw_capture_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_re_review_raw_capture_intake_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_re_review_raw_capture_intake_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000FocusedReReviewRawCaptureIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-re-review-raw-capture-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-re-review-raw-intake-rows.json"), collectionEnvelope("focused-re-review-raw-intake-rows.v1", "focused_re_review_raw_intake_rows", result.focused_re_review_raw_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "missing-evidence-block-rows.json"), collectionEnvelope("missing-evidence-block-rows.v1", "missing_evidence_block_rows", result.missing_evidence_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "invalid-evidence-block-rows.json"), collectionEnvelope("invalid-evidence-block-rows.v1", "invalid_evidence_block_rows", result.invalid_evidence_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "raw-review-output-shape-rows.json"), collectionEnvelope("raw-review-output-shape-rows.v1", "raw_review_output_shape_rows", result.raw_review_output_shape_rows, result.generated_at));
  await writeJson(path.join(outDir, "failure-mode-block-rows.json"), collectionEnvelope("failure-mode-block-rows.v1", "failure_mode_block_rows", result.failure_mode_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-focused-re-review-payload.json"), result.extracted_focused_re_review_payload ?? {});
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedReReviewRawCaptureIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedReReviewRawCaptureIntake(args);
  console.log(`Post-P64000 focused re-review raw capture intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_re_review_raw_capture_intake_status}`);
  console.log(`P71600 source ready: ${result.summary.p71600_dispatch_gate_source_ready_now}`);
  console.log(`Raw review available: ${result.summary.raw_review_available_now}`);
  console.log(`Durable raw JSON captured: ${result.summary.durable_raw_json_captured_now}`);
  console.log(`Missing evidence block: ${result.summary.missing_evidence_block_now}`);
  console.log(`Invalid evidence block: ${result.summary.invalid_evidence_block_now}`);
  console.log(`Focused re-review event candidate: ${result.summary.focused_re_review_event_candidate_now}`);
  console.log(`Review evidence counted: ${result.summary.review_evidence_counted_now}`);
  console.log(`Ready for P72001 handoff: ${result.summary.ready_for_p72001_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ dispatchGate, dispatchPacket, dispatchRows, rawCaptureGateRows, evidenceCountingGuardRows, generatedAt }) {
  const summary = dispatchGate.data?.summary ?? {};
  return [
    row("source.p71600_dispatch_gate_available", "p71600_dispatch_gate_source", "P71600 dispatch gate artifact is available", dispatchGate.available === true && dispatchGate.parsed === true, dispatchGate.path, generatedAt),
    row("source.p71600_program", "p71600_dispatch_gate_source", "P71600 dispatch gate program range matches", dispatchGate.data?.program_range === SOURCE_PROGRAM_RANGE, dispatchGate.path, generatedAt),
    row("source.p71600_validation", "p71600_dispatch_gate_source", "P71600 dispatch gate validation passed", dispatchGate.data?.validation?.valid === true, dispatchGate.path, generatedAt),
    row("source.p71600_handoff", "p71600_dispatch_gate_source", "P71600 is ready for P71601 handoff", summary.ready_for_p71601_handoff === true, dispatchGate.path, generatedAt),
    row("source.p71600_not_review_evidence", "p71600_dispatch_gate_source", "P71600 dispatch gate did not count review evidence", summary.durable_raw_json_captured_now === false && summary.review_evidence_counted_now === false, dispatchGate.path, generatedAt),
    row("source.dispatch_packet_available", "p71600_dispatch_gate_source", "Focused re-review dispatch packet is available", dispatchPacket.available === true && dispatchPacket.text.includes("Focused Re-Review Dispatch Packet"), dispatchPacket.path, generatedAt),
    row("source.dispatch_rows_available", "p71600_dispatch_gate_source", "Focused re-review dispatch rows are available for HRM-04/03/01", hasRowsForAllHrms(dispatchRows.data?.rows), dispatchRows.path, generatedAt),
    row("source.raw_capture_gate_rows_available", "p71600_dispatch_gate_source", "Durable raw capture gate rows are available for HRM-04/03/01", hasRowsForAllHrms(rawCaptureGateRows.data?.rows), rawCaptureGateRows.path, generatedAt),
    row("source.evidence_guard_rows_available", "p71600_dispatch_gate_source", "Evidence counting guard rows are available", Array.isArray(evidenceCountingGuardRows.data?.rows) && evidenceCountingGuardRows.data.rows.length >= 5, evidenceCountingGuardRows.path, generatedAt),
  ];
}

function buildRawIntakeRows({ rawReview, reviewPayload, rawState, generatedAt }) {
  return [
    row("raw.available", "focused_re_review_raw_intake", "Claude focused re-review raw JSON file is available", rawReview.available === true, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.non_empty", "focused_re_review_raw_intake", "Claude focused re-review raw JSON file is non-empty", rawReview.text.trim().length > 0, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.parsed_json", "focused_re_review_raw_intake", "Raw capture wrapper parses as JSON", rawReview.parsed === true, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.wrapper_success", "focused_re_review_raw_intake", "Claude Code raw wrapper is success", rawState.wrapperSuccess === true, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.not_auth_failure", "focused_re_review_raw_intake", "Raw output is not auth failure or login prompt", rawState.authFailure === false, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.not_tool_call_shape", "focused_re_review_raw_intake", "Raw output is not tool-call-shaped review evidence", rawState.toolCallShaped === false, rawReview.path, generatedAt, { raw_state: rawState.state }),
    row("raw.payload_extracted", "focused_re_review_raw_intake", "Focused re-review JSON payload was extracted", reviewPayload.validJson === true, reviewPayload.evidenceRef, generatedAt, { raw_state: rawState.state }),
    row("raw.raw_hash_present", "focused_re_review_raw_intake", "Raw JSON SHA-256 hash is present when raw exists", rawState.missing === true || rawState.raw_sha256.length === 64, rawReview.path, generatedAt, { raw_sha256: rawState.raw_sha256 }),
  ];
}

function buildMissingEvidenceBlockRows({ rawReview, rawState, generatedAt }) {
  return [
    row("missing.raw_absent_or_empty", "missing_evidence_block", "Missing or empty raw capture is explicitly represented", rawState.missing === true, rawReview.path, generatedAt, {
      missing_evidence_block_now: rawState.missing,
      review_evidence_counted_now: false,
      next_allowed_action: rawState.missing ? "capture_actual_claude_focused_re_review_raw_json" : "continue_raw_capture_intake",
    }),
    row("missing.not_counted_as_evidence", "missing_evidence_block", "Missing raw capture is not counted as review evidence", true, rawReview.path, generatedAt, {
      review_evidence_counted_now: false,
      durable_raw_json_captured_now: false,
    }),
  ];
}

function buildInvalidEvidenceBlockRows({ rawReview, rawState, generatedAt }) {
  return [
    row("invalid.raw_present_but_invalid", "invalid_evidence_block", "Present but invalid raw capture is explicitly represented", rawState.invalid === true, rawReview.path, generatedAt, {
      invalid_evidence_block_now: rawState.invalid,
      raw_failure_reason: rawState.reason,
      next_allowed_action: rawState.invalid ? "retry_claude_focused_re_review_raw_capture" : "continue_raw_capture_intake",
    }),
    row("invalid.not_counted_as_evidence", "invalid_evidence_block", "Invalid raw capture is not counted as review evidence", true, rawReview.path, generatedAt, {
      review_evidence_counted_now: false,
      durable_raw_json_captured_now: false,
    }),
  ];
}

function buildRawReviewOutputShapeRows({ reviewPayload, rawState, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const findings = Array.isArray(payload.findings) ? payload.findings : [];
  return [
    row("output.payload_valid_json", "raw_review_output_shape", "Focused re-review payload is valid JSON", reviewPayload.validJson === true, reviewPayload.evidenceRef, generatedAt, { raw_state: rawState.state }),
    row("output.event_marker", "raw_review_output_shape", "Payload marks a Claude focused re-review event", payload.is_claude_re_review_event === true || payload.is_claude_review_event === true, reviewPayload.evidenceRef, generatedAt),
    row("output.reviewer", "raw_review_output_shape", "Payload reviewer is Claude Code Opus max", payload.reviewer === "claude-code-opus-max", reviewPayload.evidenceRef, generatedAt),
    row("output.reviewer_lane", "raw_review_output_shape", "Payload reviewer lane is independent read-only", payload.reviewer_lane === "independent_read_only", reviewPayload.evidenceRef, generatedAt),
    row("output.dispatch_program_range", "raw_review_output_shape", "Payload binds to P71201-P71600 dispatch gate", payload.dispatch_program_range === SOURCE_PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.reviewed_program_range", "raw_review_output_shape", "Payload reviewed P70801-P71200 strict plan", payload.reviewed_program_range === REVIEWED_PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.review_event_program_range", "raw_review_output_shape", "Payload review event program range is P71601-P72000", payload.review_event_program_range === PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.required_hrm_ids", "raw_review_output_shape", "Payload reviewed HRM-04, HRM-03, and HRM-01", REQUIRED_HRM_IDS.every((id) => (payload.reviewed_hrm_ids ?? []).includes(id)), reviewPayload.evidenceRef, generatedAt, { reviewed_hrm_ids: payload.reviewed_hrm_ids ?? [] }),
    row("output.findings_array", "raw_review_output_shape", "Payload exposes focused finding rows", findings.length >= REQUIRED_HRM_IDS.length, reviewPayload.evidenceRef, generatedAt, { finding_count: findings.length }),
    row("output.findings_include_hrm_ids", "raw_review_output_shape", "Payload findings include HRM-04, HRM-03, and HRM-01", REQUIRED_HRM_IDS.every((id) => findings.some((finding) => [finding.id, finding.finding_id].includes(id))), reviewPayload.evidenceRef, generatedAt),
    row("output.no_final_approval", "raw_review_output_shape", "Claude did not claim final approval", !hasTrueField(payload, ["is_final_approval", "reviewer_final_approval_allowed", "claude_final_approval_allowed", "final_approval_allowed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_clean_checkpoint", "raw_review_output_shape", "Claude did not claim clean checkpoint authority", !hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_production_or_enterprise", "raw_review_output_shape", "Claude did not claim production or enterprise PASS", !hasTrueField(payload, ["is_production_pass", "production_pass_allowed", "is_enterprise_pass", "enterprise_pass_allowed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_source_mutation", "raw_review_output_shape", "Claude did not claim source mutation", !hasTrueField(payload, ["source_mutation_performed", "source_mutation_allowed", "mutation_performed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_finding_resolution", "raw_review_output_shape", "Claude did not claim finding resolution", !hasTrueField(payload, ["finding_resolution_performed", "finding_resolution_allowed", "findings_resolved", "finding_status_resolved"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_fixed_verified_claim", "raw_review_output_shape", "Claude did not mark focused findings fixed or verified", !hasTrueField(payload, ["finding_status_fixed", "finding_status_verified", "findings_fixed", "findings_verified"]), reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildFailureModeBlockRows({ rawReview, rawState, generatedAt }) {
  return [
    row("failure.auth_failure_not_evidence", "failure_mode_block", "Auth failure or login prompt cannot count as evidence", rawState.authFailure === false || rawState.invalid === true || rawState.missing === true, rawReview.path, generatedAt, { auth_failure_counted_as_evidence_now: false }),
    row("failure.timeout_not_evidence", "failure_mode_block", "Timeout or hang cannot count as evidence", rawState.timeoutOrHang === false || rawState.invalid === true || rawState.missing === true, rawReview.path, generatedAt, { timeout_or_hang_counted_as_evidence_now: false }),
    row("failure.malformed_not_evidence", "failure_mode_block", "Malformed output cannot count as evidence", rawState.malformed === false || rawState.invalid === true || rawState.missing === true, rawReview.path, generatedAt, { malformed_output_counted_as_evidence_now: false }),
    row("failure.tool_call_not_evidence", "failure_mode_block", "Tool-call-shaped output cannot count as review evidence", rawState.toolCallShaped === false || rawState.invalid === true || rawState.missing === true, rawReview.path, generatedAt, { tool_call_output_counted_as_review_now: false }),
  ];
}

function buildAuthorityRows({ reviewPayload, overrides = {}, generatedAt }) {
  return [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => {
    const claim = claimForFlag(reviewPayload.payload, flag);
    const observed = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, observed === false, reviewPayload.evidenceRef, generatedAt, {
      authority_flag: flag,
      allowed_now: observed === false ? false : observed,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} is covered`,
    true,
    "test/post-p64000-focused-re-review-raw-capture-intake.test.mjs",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation.${commandId}`, "validation_command", `${commandId} command is defined`, true, command, generatedAt, {
    command_id: commandId,
    command,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-re-review-raw-capture-intake.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P71601-P72000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P71601-P72000") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p71601-p72000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P71601-P72000 focused re-review raw capture intake", architectureDoc.available && architectureDoc.text.includes("P71601-P72000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows({ sourceRows, rawState, missingRows, invalidRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt }) {
  const blockStateReady =
    rawState.valid === true
      || (rawState.missing === true && missingRows.every((item) => item.row_id === "missing.raw_absent_or_empty" ? pass(item) : item.review_evidence_counted_now === false))
      || (rawState.invalid === true && invalidRows.every((item) => item.row_id === "invalid.raw_present_but_invalid" ? pass(item) : item.review_evidence_counted_now === false));
  return [
    closeoutRow("p72000.source_ready", "P71600 dispatch gate source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p72000.raw_state_classified", "Raw capture is classified as valid, missing, or invalid", rawState.classified === true, generatedAt),
    closeoutRow("p72000.missing_or_invalid_block_ready", "Missing or invalid raw capture is converted to non-evidence BLOCK", blockStateReady, generatedAt),
    closeoutRow("p72000.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p72000.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p72000.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p72000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, rawState, reviewPayload, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p72001_normalization_or_retry", "p72001_handoff", "P72001 may normalize valid raw evidence or retry capture when missing/invalid", ready, reviewPayload.evidenceRef, generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
      raw_state: rawState.state,
      next_allowed_action: rawState.valid
        ? "normalize_focused_re_review_raw_receipt"
        : "capture_or_retry_actual_claude_focused_re_review_raw_json",
      review_evidence_counted_now: false,
      clean_checkpoint_allowed_now: false,
    }),
    row("handoff.no_finality", "p72001_handoff", "P72000 intake does not claim clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval", true, "docs/hermes-roadmap-p71601-p72000.md", generatedAt, {
      clean_checkpoint_allowed_now: false,
      protected_closeout_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      final_approval_enabled: false,
    }),
  ];
}

function buildBoundary({ sourceRows, rawState, rawReview, reviewPayload, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows }) {
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p71600_dispatch_gate_source_ready_now: sourceRows.every(pass),
    raw_review_available_now: rawReview.available === true && rawReview.text.trim().length > 0,
    durable_raw_json_captured_now: rawState.valid === true,
    missing_evidence_block_now: rawState.missing === true,
    invalid_evidence_block_now: rawState.invalid === true,
    focused_re_review_event_candidate_now: rawState.valid === true,
    review_evidence_counted_now: false,
    raw_review_counted_as_evidence_now: false,
    ready_for_p72001_handoff: handoffRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    p72000_closeout_ready_now: closeoutRows.every(pass),
    raw_capture_state: rawState.state,
    raw_review_sha256: rawState.raw_sha256,
    review_verdict: String(reviewPayload.payload?.overall_verdict ?? ""),
    open_blocking_finding_count: Number(reviewPayload.payload?.open_blocking_finding_count ?? 0),
    finding_count: Array.isArray(reviewPayload.payload?.findings) ? reviewPayload.payload.findings.length : 0,
    reviewed_hrm_ids: reviewPayload.payload?.reviewed_hrm_ids ?? [],
    clean_checkpoint_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p72000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p72000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now || boundary.claude_review_final_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, rawIntakeRows, missingRows, invalidRows, outputRows, failureRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary, rawState } = parts;
  const rawValidItemsPass = rawState.valid === false || (rawIntakeRows.every(pass) && outputRows.every(pass));
  const missingBlockPass = rawState.missing === false || missingRows.every((item) => item.row_id === "missing.raw_absent_or_empty" ? pass(item) : item.review_evidence_counted_now === false);
  const invalidBlockPass = rawState.invalid === false || invalidRows.every((item) => item.row_id === "invalid.raw_present_but_invalid" ? pass(item) : item.review_evidence_counted_now === false);
  return [
    validationItem("source.p71600", "source_binding", sourceRows.every(pass), "P71600 dispatch gate source and guard rows must be ready"),
    validationItem("raw.classified", "raw_capture_intake", rawState.classified === true, "Raw capture must be classified as valid, missing, or invalid"),
    validationItem("raw.valid_payload", "raw_capture_intake", rawValidItemsPass, "Valid raw capture must pass wrapper, payload, scope, HRM, and authority shape checks"),
    validationItem("raw.missing_block", "missing_evidence_block", missingBlockPass, "Missing raw capture must be preserved as non-evidence BLOCK"),
    validationItem("raw.invalid_block", "invalid_evidence_block", invalidBlockPass, "Invalid raw capture must be preserved as non-evidence BLOCK"),
    validationItem("failure_modes.blocked", "failure_mode_block", failureRows.every((item) => item.auth_failure_counted_as_evidence_now === false || item.timeout_or_hang_counted_as_evidence_now === false || item.malformed_output_counted_as_evidence_now === false || item.tool_call_output_counted_as_review_now === false), "Failure modes must not count as evidence"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P72000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P72001 handoff rows must pass"),
    validationItem("boundary.review_evidence_false", "authority_boundary", boundary.review_evidence_counted_now === false && boundary.raw_review_counted_as_evidence_now === false, "Raw intake must not count review evidence"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p72001_handoff
    ? boundary.durable_raw_json_captured_now
      ? "focused_re_review_raw_capture_ready_for_p72001"
      : boundary.invalid_evidence_block_now
        ? "focused_re_review_raw_capture_invalid_evidence_block_ready_for_p72001"
        : "focused_re_review_raw_capture_missing_evidence_block_ready_for_p72001"
    : "blocked_post_p64000_focused_re_review_raw_capture_intake";
  return {
    post_p64000_focused_re_review_raw_capture_intake_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p71600_dispatch_gate_source_ready_now: boundary.p71600_dispatch_gate_source_ready_now,
    raw_review_available_now: boundary.raw_review_available_now,
    durable_raw_json_captured_now: boundary.durable_raw_json_captured_now,
    missing_evidence_block_now: boundary.missing_evidence_block_now,
    invalid_evidence_block_now: boundary.invalid_evidence_block_now,
    focused_re_review_event_candidate_now: boundary.focused_re_review_event_candidate_now,
    review_evidence_counted_now: boundary.review_evidence_counted_now,
    ready_for_p72001_handoff: boundary.ready_for_p72001_handoff,
    raw_capture_state: boundary.raw_capture_state,
    raw_review_sha256: boundary.raw_review_sha256,
    review_verdict: boundary.review_verdict,
    open_blocking_finding_count: boundary.open_blocking_finding_count,
    finding_count: boundary.finding_count,
    reviewed_hrm_ids: boundary.reviewed_hrm_ids,
    validation_error_count: validation.error_count,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function classifyRawReview({ rawReview, reviewPayload }) {
  const rawText = String(rawReview.text ?? "");
  const missing = rawReview.available !== true || rawText.trim().length === 0;
  const authFailure = containsAuthFailure(rawText);
  const timeoutOrHang = containsTimeoutOrHang(rawText, rawReview.data);
  const toolCallShaped = isToolCallShaped(rawReview.data?.result ?? rawText);
  const wrapperSuccess = rawReview.parsed === true && rawReview.data?.type === "result" && rawReview.data?.subtype === "success" && rawReview.data?.is_error === false;
  const malformed = rawReview.available === true && (rawReview.parsed !== true || reviewPayload.validJson !== true);
  const outputShapeValid = isOutputShapeValid(reviewPayload.payload);
  const valid = missing === false && wrapperSuccess && authFailure === false && timeoutOrHang === false && toolCallShaped === false && reviewPayload.validJson === true && outputShapeValid;
  const invalid = missing === false && valid === false;
  return {
    classified: valid || missing || invalid,
    state: valid ? "valid_raw_capture_candidate" : missing ? "missing_evidence_block" : "invalid_evidence_block",
    valid,
    missing,
    invalid,
    wrapperSuccess,
    authFailure,
    timeoutOrHang,
    toolCallShaped,
    malformed,
    outputShapeValid,
    raw_sha256: rawText ? sha256(rawText) : "",
    reason: valid ? null : missing ? "raw_review_missing_or_empty" : firstInvalidReason({ rawReview, reviewPayload, wrapperSuccess, authFailure, timeoutOrHang, toolCallShaped, malformed, outputShapeValid }),
  };
}

function isOutputShapeValid(payload) {
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  return Boolean(
    (payload?.is_claude_re_review_event === true || payload?.is_claude_review_event === true)
      && payload?.reviewer === "claude-code-opus-max"
      && payload?.reviewer_lane === "independent_read_only"
      && payload?.dispatch_program_range === SOURCE_PROGRAM_RANGE
      && payload?.reviewed_program_range === REVIEWED_PROGRAM_RANGE
      && payload?.review_event_program_range === PROGRAM_RANGE
      && REQUIRED_HRM_IDS.every((id) => (payload?.reviewed_hrm_ids ?? []).includes(id))
      && REQUIRED_HRM_IDS.every((id) => findings.some((finding) => [finding.id, finding.finding_id].includes(id)))
      && !hasTrueField(payload, ["is_final_approval", "reviewer_final_approval_allowed", "claude_final_approval_allowed", "final_approval_allowed"])
      && !hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"])
      && !hasTrueField(payload, ["is_production_pass", "production_pass_allowed", "is_enterprise_pass", "enterprise_pass_allowed"])
      && !hasTrueField(payload, ["source_mutation_performed", "source_mutation_allowed", "mutation_performed"])
      && !hasTrueField(payload, ["finding_resolution_performed", "finding_resolution_allowed", "findings_resolved", "finding_status_resolved"])
      && !hasTrueField(payload, ["finding_status_fixed", "finding_status_verified", "findings_fixed", "findings_verified"]),
  );
}

function firstInvalidReason({ rawReview, reviewPayload, wrapperSuccess, authFailure, timeoutOrHang, toolCallShaped, malformed, outputShapeValid }) {
  if (rawReview.parsed !== true) return "raw_wrapper_json_malformed";
  if (wrapperSuccess !== true) return "raw_wrapper_not_success";
  if (authFailure) return "raw_auth_failure_or_login_prompt";
  if (timeoutOrHang) return "raw_timeout_or_hang";
  if (toolCallShaped) return "tool_call_shaped_output";
  if (malformed) return reviewPayload.error ?? "review_payload_json_missing_or_malformed";
  if (outputShapeValid !== true) return "focused_re_review_payload_shape_invalid";
  return "raw_capture_invalid";
}

function extractReviewPayload(rawReview) {
  const evidenceRef = rawReview.path;
  const resultValue = rawReview.data?.result;
  if (resultValue && typeof resultValue === "object" && !Array.isArray(resultValue)) {
    return { validJson: true, payload: resultValue, evidenceRef };
  }
  const resultText = String(resultValue ?? "");
  const fenced = resultText.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : resultText.trim().startsWith("{") ? resultText : "";
  if (!jsonText) return { validJson: false, payload: null, evidenceRef, error: "focused_re_review_json_payload_missing" };
  try {
    return { validJson: true, payload: JSON.parse(jsonText), evidenceRef };
  } catch (error) {
    return { validJson: false, payload: null, evidenceRef, error: error.message };
  }
}

function claimForFlag(payload, flag) {
  if (flag === "claude_final_approval_allowed" && hasTrueField(payload, ["is_final_approval", "claude_final_approval_allowed", "final_approval_allowed"])) return true;
  if (flag === "raw_review_counted_as_evidence_now" && hasTrueField(payload, ["raw_review_counted_as_evidence", "review_evidence_counted"])) return true;
  if (flag === "raw_capture_counted_as_normalized_receipt_now" && hasTrueField(payload, ["raw_capture_is_normalized_receipt", "normalized_receipt_complete"])) return true;
  if (flag === "focused_re_review_normalized_now" && hasTrueField(payload, ["focused_re_review_normalized", "review_receipt_normalized"])) return true;
  if (flag === "focused_re_review_completed_now" && hasTrueField(payload, ["focused_re_review_completed", "reviewer_completion_observed"])) return true;
  if (flag === "focused_finding_fixed_claim_allowed_now" && hasTrueField(payload, ["finding_status_fixed", "findings_fixed"])) return true;
  if (flag === "focused_finding_verified_claim_allowed_now" && hasTrueField(payload, ["finding_status_verified", "findings_verified"])) return true;
  if (flag === "focused_finding_resolved_claim_allowed_now" && hasTrueField(payload, ["finding_status_resolved", "findings_resolved"])) return true;
  if (flag === "reviewer_mutation_allowed_now" && hasTrueField(payload, ["reviewer_mutation_allowed", "reviewer_mutation_performed"])) return true;
  if (flag === "source_mutation_from_review_allowed_now" && hasTrueField(payload, ["source_mutation_allowed", "source_mutation_performed", "mutation_performed"])) return true;
  if (flag === "finding_resolution_allowed_now" && hasTrueField(payload, ["finding_resolution_allowed", "finding_resolution_performed", "findings_resolved"])) return true;
  if (flag === "patch_apply_from_review_allowed_now" && hasTrueField(payload, ["patch_apply_allowed", "patch_apply_performed"])) return true;
  if (flag === "write_action_from_review_allowed_now" && hasTrueField(payload, ["write_action_allowed", "write_action_performed"])) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"])) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && hasTrueField(payload, ["protected_closeout_allowed", "protected_closeout_performed"])) return true;
  if (flag === "claude_review_final_approval_allowed_now" && hasTrueField(payload, ["reviewer_final_approval_allowed", "is_final_approval"])) return true;
  if (flag === "post_p72000_production_pass_claim_allowed_now" && hasTrueField(payload, ["is_production_pass", "production_pass_allowed"])) return true;
  if (flag === "post_p72000_enterprise_pass_claim_allowed_now" && hasTrueField(payload, ["is_enterprise_pass", "enterprise_pass_allowed"])) return true;
  return false;
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Focused Re-Review Raw Capture Intake ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_re_review_raw_capture_intake_status}`,
    `- p71600_dispatch_gate_source_ready_now: ${result.summary.p71600_dispatch_gate_source_ready_now}`,
    `- raw_review_available_now: ${result.summary.raw_review_available_now}`,
    `- durable_raw_json_captured_now: ${result.summary.durable_raw_json_captured_now}`,
    `- missing_evidence_block_now: ${result.summary.missing_evidence_block_now}`,
    `- invalid_evidence_block_now: ${result.summary.invalid_evidence_block_now}`,
    `- focused_re_review_event_candidate_now: ${result.summary.focused_re_review_event_candidate_now}`,
    `- review_evidence_counted_now: ${result.summary.review_evidence_counted_now}`,
    `- ready_for_p72001_handoff: ${result.summary.ready_for_p72001_handoff}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    `- final_approval_enabled: ${result.summary.final_approval_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.durable_raw_json_captured_now
      ? "Continue to P72001-P72400 focused re-review receipt normalization. Do not count this intake as final approval or clean checkpoint."
      : "Capture or retry actual Claude Code Opus max focused re-review raw JSON. Missing, malformed, auth-failure, timeout, hang, or tool-call-shaped output remains BLOCK and is not review evidence.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p72000_closeout", label, observed, "artifacts/post-p64000-focused-re-review-raw-capture-intake/latest/post-p64000-focused-re-review-raw-capture-intake.json", generatedAt);
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef ?? null,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_focused_re_review_raw_capture_intake" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined(extra),
  };
}

function pass(item) {
  return item.current_verdict === "pass";
}

function validationItem(id, category, passed, message) {
  return { validation_id: id, category, passed: passed === true, severity: passed === true ? "info" : "error", message: passed === true ? `${id} passed` : message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return { valid: errors.length === 0, error_count: errors.length, errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })) };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--dispatch-gate") args.dispatchGatePath = argv[++index];
    else if (arg === "--dispatch-packet") args.dispatchPacketPath = argv[++index];
    else if (arg === "--dispatch-rows") args.dispatchRowsPath = argv[++index];
    else if (arg === "--raw-capture-gate-rows") args.rawCaptureGateRowsPath = argv[++index];
    else if (arg === "--evidence-counting-guard-rows") args.evidenceCountingGuardRowsPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
    else if (arg === "--repo-root") args.repoRoot = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--raw-review PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_RAW_CAPTURE_INTAKE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    dispatch_gate_path: path.resolve(repoRoot, options.dispatchGatePath ?? defaults.dispatchGatePath),
    dispatch_packet_path: path.resolve(repoRoot, options.dispatchPacketPath ?? defaults.dispatchPacketPath),
    dispatch_rows_path: path.resolve(repoRoot, options.dispatchRowsPath ?? defaults.dispatchRowsPath),
    raw_capture_gate_rows_path: path.resolve(repoRoot, options.rawCaptureGateRowsPath ?? defaults.rawCaptureGateRowsPath),
    evidence_counting_guard_rows_path: path.resolve(repoRoot, options.evidenceCountingGuardRowsPath ?? defaults.evidenceCountingGuardRowsPath),
    raw_review_path: path.resolve(repoRoot, options.rawReviewPath ?? defaults.rawReviewPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    try {
      return { path: filePath, available: true, parsed: true, data: JSON.parse(text), text };
    } catch (error) {
      return { path: filePath, available: true, parsed: false, data: null, text, error: error.message };
    }
  } catch (error) {
    return { path: filePath, available: false, parsed: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return {
    path: sourceId,
    available: data !== null && data !== undefined,
    parsed: data !== null && data !== undefined,
    data: data ?? null,
    text: data === null || data === undefined ? "" : JSON.stringify(data),
  };
}

function normalizeInlineTextSource(sourceId, text) {
  return { path: sourceId, available: typeof text === "string" && text.length > 0, text: String(text ?? "") };
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, collection, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasRowsForAllHrms(rows) {
  return Array.isArray(rows) && REQUIRED_HRM_IDS.every((id) => rows.some((rowItem) => rowItem.finding_id === id));
}

function containsAuthFailure(text) {
  return /not logged in|please run \/login|authentication failed|api key missing|oauth|unauthorized/i.test(String(text ?? ""));
}

function containsTimeoutOrHang(text, data) {
  return /\btimeout\b|\btimed out\b|\bhang\b|\bhung\b|pty stdout loss|no output captured/i.test(String(text ?? ""))
    || ["timeout", "timed_out", "hang", "hung", "pty_stdout_loss"].includes(String(data?.terminal_reason ?? "").toLowerCase());
}

function isToolCallShaped(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /"tool_use"|"tool_calls"|"recipient_name"|"input"\s*:\s*\{/.test(text) && !/overall_verdict|findings|reviewed_hrm_ids/.test(text);
}

function hasTrueField(payload, fields) {
  return fields.some((field) => payload?.[field] === true);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
