import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_RAW_CAPTURE_OUT_DIR = "artifacts/post-p64000-focused-claude-review-raw-capture/latest";
export const DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_RAW_CAPTURE_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-claude-review-raw-capture.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p69601-p70000.md",
  architectureDocPath: "docs/architecture.md",
  p69600DispatchPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/post-p64000-focused-claude-review-dispatch-metadata.json",
  dispatchPacketPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/focused-claude-review-dispatch-packet.md",
  dispatchRowsPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/dispatch-metadata-rows.json",
  reviewScopeRowsPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/review-scope-rows.json",
  promptGuardRowsPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/review-prompt-guard-rows.json",
  evidenceGuardRowsPath: "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/evidence-counting-guard-rows.json",
  rawReviewPath: "artifacts/post-p64000-focused-claude-review-raw-capture/review/claude-focused-review-raw.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-claude-review-raw-capture";
const SCHEMA_VERSION = "post-p64000-focused-claude-review-raw-capture.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_claude_review_raw_capture";
const PROGRAM_RANGE = "P69601-P70000";
const SOURCE_PROGRAM_RANGE = "P69201-P69600";
const REVIEWED_PROGRAM_RANGE = "P68801-P69200";
const NEXT_PROGRAM_RANGE = "P70001-P70400";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p69600_dispatch_source",
  "p69600_not_ready_for_handoff",
  "missing_dispatch_packet",
  "missing_dispatch_rows",
  "wrong_reviewer_model_or_effort",
  "missing_raw_capture",
  "empty_raw_capture",
  "malformed_raw_json",
  "auth_failure_or_login_prompt",
  "timeout_or_hang_counted_as_evidence",
  "pty_stdout_loss_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "dispatch_metadata_counted_as_review",
  "missing_focused_review_payload",
  "review_payload_wrong_dispatch_scope",
  "review_payload_wrong_reviewed_scope",
  "review_payload_wrong_event_scope",
  "review_payload_missing_hrm_ids",
  "finding_fixed_claim",
  "finding_verified_claim",
  "finding_resolved_claim",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "finding_resolution_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "claude_final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
];

const EXTRA_FALSE_FLAGS = [
  "dispatch_metadata_counted_as_review_now",
  "raw_capture_counted_as_normalized_receipt_now",
  "focused_review_normalized_now",
  "focused_finding_fixed_claim_allowed_now",
  "focused_finding_verified_claim_allowed_now",
  "focused_finding_resolved_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "claude_review_final_approval_allowed_now",
  "post_p70000_production_pass_claim_allowed_now",
  "post_p70000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-claude-review-raw-capture.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-claude-review-raw-capture.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-claude-review-raw-capture.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-claude-review-raw-capture -- --check"],
  ["adjacent.p69600", "node --test test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs test/post-p64000-focused-claude-review-raw-capture.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-claude-review-raw-capture.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedClaudeReviewRawCapture(options = {}) {
  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused Claude review raw capture failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedClaudeReviewRawCapture(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedClaudeReviewRawCapture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_RAW_CAPTURE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const p69600Dispatch = Object.prototype.hasOwnProperty.call(options, "p69600Dispatch")
    ? normalizeInlineJsonSource("inline.p69600_dispatch", options.p69600Dispatch)
    : await readJsonSource(inputs.p69600_dispatch_path);
  const dispatchPacket = Object.prototype.hasOwnProperty.call(options, "dispatchPacketText")
    ? normalizeInlineTextSource("inline.focused_dispatch_packet", options.dispatchPacketText)
    : await readTextSource(inputs.dispatch_packet_path);
  const dispatchRows = Object.prototype.hasOwnProperty.call(options, "dispatchRows")
    ? normalizeInlineJsonSource("inline.dispatch_rows", options.dispatchRows)
    : await readJsonSource(inputs.dispatch_rows_path);
  const reviewScopeRows = Object.prototype.hasOwnProperty.call(options, "reviewScopeRows")
    ? normalizeInlineJsonSource("inline.review_scope_rows", options.reviewScopeRows)
    : await readJsonSource(inputs.review_scope_rows_path);
  const promptGuardRows = Object.prototype.hasOwnProperty.call(options, "promptGuardRows")
    ? normalizeInlineJsonSource("inline.prompt_guard_rows", options.promptGuardRows)
    : await readJsonSource(inputs.prompt_guard_rows_path);
  const evidenceGuardRows = Object.prototype.hasOwnProperty.call(options, "evidenceGuardRows")
    ? normalizeInlineJsonSource("inline.evidence_guard_rows", options.evidenceGuardRows)
    : await readJsonSource(inputs.evidence_guard_rows_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_focused_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const reviewPayload = extractReviewPayload(rawReview);

  const sourceRows = buildSourceRows({ p69600Dispatch, dispatchPacket, dispatchRows, reviewScopeRows, promptGuardRows, evidenceGuardRows, generatedAt });
  const modelRows = buildModelPolicyRows({ dispatchRows, rawReview, reviewPayload, generatedAt });
  const captureRows = buildDurableRawJsonCaptureRows({ rawReview, reviewPayload, generatedAt });
  const outputRows = buildFocusedReviewOutputRows({ reviewPayload, generatedAt });
  const eventRows = buildFocusedReviewEventBoundaryRows({ p69600Dispatch, reviewPayload, generatedAt });
  const authorityRows = buildAuthorityRows({ reviewPayload, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, reviewPayload, generatedAt });
  const boundary = buildBoundary({ sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload, rawReview });
  const validationItems = buildValidationItems({ sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      p69600_dispatch_path: p69600Dispatch.path,
      dispatch_packet_path: dispatchPacket.path,
      dispatch_rows_path: dispatchRows.path,
      review_scope_rows_path: reviewScopeRows.path,
      prompt_guard_rows_path: promptGuardRows.path,
      evidence_guard_rows_path: evidenceGuardRows.path,
      raw_review_path: rawReview.path,
    },
    post_p64000_focused_claude_review_raw_capture_contract: {
      contract_id: "post_p64000_focused_claude_review_raw_capture",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      reviewed_program_range: REVIEWED_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      requires_claude_code_opus_max: true,
      requires_effort_max: true,
      requires_durable_raw_json: true,
      capture_is_performed_focused_review_event_candidate: true,
      raw_capture_requires_later_normalization: true,
      dispatch_metadata_is_not_review_evidence: true,
      reviewer_mutation_allowed: false,
      source_mutation_allowed: false,
      finding_resolution_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p69600_source_binding_rows: sourceRows,
    focused_model_policy_rows: modelRows,
    durable_raw_json_capture_rows: captureRows,
    focused_review_output_shape_rows: outputRows,
    focused_review_event_boundary_rows: eventRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p70000_wiring_rows: wiringRows,
    p70000_closeout_rows: closeoutRows,
    p70001_handoff_rows: handoffRows,
    extracted_focused_review_payload: reviewPayload.payload,
    post_p64000_focused_claude_review_raw_capture_boundary: boundary,
    post_p64000_focused_claude_review_raw_capture_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_claude_review_raw_capture")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_claude_review_raw_capture_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_claude_review_raw_capture_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000FocusedClaudeReviewRawCapture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-claude-review-raw-capture.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-model-policy-rows.json"), collectionEnvelope("focused-model-policy-rows.v1", "focused_model_policy_rows", result.focused_model_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "durable-raw-json-capture-rows.json"), collectionEnvelope("durable-raw-json-capture-rows.v1", "durable_raw_json_capture_rows", result.durable_raw_json_capture_rows, result.generated_at));
  await writeJson(path.join(outDir, "focused-review-output-shape-rows.json"), collectionEnvelope("focused-review-output-shape-rows.v1", "focused_review_output_shape_rows", result.focused_review_output_shape_rows, result.generated_at));
  await writeJson(path.join(outDir, "focused-review-event-boundary-rows.json"), collectionEnvelope("focused-review-event-boundary-rows.v1", "focused_review_event_boundary_rows", result.focused_review_event_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-focused-review-payload.json"), result.extracted_focused_review_payload ?? {});
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedClaudeReviewRawCaptureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedClaudeReviewRawCapture(args);
  console.log(`Post-P64000 focused Claude review raw capture ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_claude_review_raw_capture_status}`);
  console.log(`P69600 source ready: ${result.summary.p69600_source_ready_now}`);
  console.log(`Claude Opus max policy ready: ${result.summary.claude_opus_max_policy_ready_now}`);
  console.log(`Durable raw JSON captured: ${result.summary.durable_raw_json_capture_valid_now}`);
  console.log(`Focused review event candidate: ${result.summary.focused_review_event_candidate_now}`);
  console.log(`Review verdict: ${result.summary.review_verdict}`);
  console.log(`Blocking findings: ${result.summary.open_blocking_finding_count}`);
  console.log(`Ready for P70001 handoff: ${result.summary.ready_for_p70001_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ p69600Dispatch, dispatchPacket, dispatchRows, reviewScopeRows, promptGuardRows, evidenceGuardRows, generatedAt }) {
  const summary = p69600Dispatch.data?.summary ?? {};
  return [
    row("source.p69600_dispatch_available", "p69600_source_binding", "P69600 dispatch metadata artifact is available", p69600Dispatch.available === true, p69600Dispatch.path, generatedAt),
    row("source.p69600_program", "p69600_source_binding", "P69600 dispatch metadata program range matches", p69600Dispatch.data?.program_range === SOURCE_PROGRAM_RANGE, p69600Dispatch.path, generatedAt),
    row("source.p69600_validation", "p69600_source_binding", "P69600 dispatch metadata validation is valid", p69600Dispatch.data?.validation?.valid === true, p69600Dispatch.path, generatedAt),
    row("source.p69600_handoff", "p69600_source_binding", "P69600 is ready for P69601 handoff", summary.ready_for_p69601_handoff === true, p69600Dispatch.path, generatedAt),
    row("source.p69600_not_review_event", "p69600_source_binding", "P69600 dispatch metadata is not a review event", summary.dispatch_performed_now === false && summary.raw_review_captured_now === false && summary.review_evidence_counted_now === false, p69600Dispatch.path, generatedAt),
    row("source.dispatch_packet_available", "p69600_source_binding", "Focused dispatch packet is available", dispatchPacket.available === true && dispatchPacket.text.includes("Focused Claude Review Dispatch Metadata"), dispatchPacket.path, generatedAt),
    row("source.dispatch_rows_available", "p69600_source_binding", "Focused dispatch rows are available for HRM-04/03/01", hasRowsForAllHrms(dispatchRows.data?.rows), dispatchRows.path, generatedAt),
    row("source.review_scope_rows_available", "p69600_source_binding", "Focused review scope rows are available", hasRowsForAllHrms(reviewScopeRows.data?.rows), reviewScopeRows.path, generatedAt),
    row("source.prompt_guard_rows_available", "p69600_source_binding", "Prompt guard rows are available", Array.isArray(promptGuardRows.data?.rows) && promptGuardRows.data.rows.length >= 5, promptGuardRows.path, generatedAt),
    row("source.evidence_guard_rows_available", "p69600_source_binding", "Evidence counting guard rows are available", Array.isArray(evidenceGuardRows.data?.rows) && evidenceGuardRows.data.rows.length >= 5, evidenceGuardRows.path, generatedAt),
  ];
}

function buildModelPolicyRows({ dispatchRows, rawReview, reviewPayload, generatedAt }) {
  const rows = Array.isArray(dispatchRows.data?.rows) ? dispatchRows.data.rows : [];
  const usageKeys = Object.keys(rawReview.data?.modelUsage ?? {});
  return [
    row("model.dispatch_rows_present", "focused_model_policy", "Focused dispatch rows are present", rows.length >= REQUIRED_HRM_IDS.length, dispatchRows.path, generatedAt),
    row("model.dispatch_reviewer", "focused_model_policy", "Dispatch rows request Claude Code Opus max", rows.length > 0 && rows.every((item) => item.reviewer === "claude-code-opus-max"), dispatchRows.path, generatedAt),
    row("model.dispatch_lane", "focused_model_policy", "Dispatch rows use independent read-only lane", rows.length > 0 && rows.every((item) => item.reviewer_lane === "independent_read_only"), dispatchRows.path, generatedAt),
    row("model.dispatch_alias_opus", "focused_model_policy", "Dispatch rows request opus alias", rows.length > 0 && rows.every((item) => String(item.model_alias ?? "").toLowerCase() === "opus"), dispatchRows.path, generatedAt),
    row("model.dispatch_effort_max", "focused_model_policy", "Dispatch rows request max effort", rows.length > 0 && rows.every((item) => String(item.effort ?? "").toLowerCase() === "max"), dispatchRows.path, generatedAt),
    row("model.raw_usage_observed", "focused_model_policy", "Claude raw output includes model usage", usageKeys.length > 0, rawReview.path, generatedAt, { model_usage_keys: usageKeys }),
    row("model.raw_usage_opus", "focused_model_policy", "Claude raw output includes Opus model usage", usageKeys.some((key) => /opus/i.test(key)), rawReview.path, generatedAt, { model_usage_keys: usageKeys }),
    row("model.payload_reviewer", "focused_model_policy", "Review payload identifies Claude Code Opus max reviewer", reviewPayload.payload?.reviewer === "claude-code-opus-max", reviewPayload.evidenceRef, generatedAt),
    row("model.payload_lane", "focused_model_policy", "Review payload identifies independent read-only lane", reviewPayload.payload?.reviewer_lane === "independent_read_only", reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildDurableRawJsonCaptureRows({ rawReview, reviewPayload, generatedAt }) {
  const rawHash = rawReview.text ? sha256(rawReview.text) : "";
  return [
    row("capture.raw_available", "durable_raw_json_capture", "Claude focused raw review JSON is available", rawReview.available === true, rawReview.path, generatedAt),
    row("capture.raw_non_empty", "durable_raw_json_capture", "Claude focused raw review JSON is non-empty", rawReview.text.trim().length > 0, rawReview.path, generatedAt),
    row("capture.raw_hash_present", "durable_raw_json_capture", "Raw JSON SHA-256 hash is present", rawHash.length === 64, rawReview.path, generatedAt, { raw_sha256: rawHash }),
    row("capture.wrapper_success", "durable_raw_json_capture", "Claude Code raw wrapper is success", rawReview.data?.type === "result" && rawReview.data?.subtype === "success" && rawReview.data?.is_error === false, rawReview.path, generatedAt),
    row("capture.terminal_completed", "durable_raw_json_capture", "Claude Code terminal reason is completed or absent", rawReview.data?.terminal_reason === undefined || rawReview.data?.terminal_reason === "completed", rawReview.path, generatedAt),
    row("capture.not_auth_failure", "durable_raw_json_capture", "Raw output is not auth failure or login prompt", !containsAuthFailure(rawReview.text), rawReview.path, generatedAt),
    row("capture.not_tool_call_shape", "durable_raw_json_capture", "Raw output is not tool-call-shaped review evidence", !isToolCallShaped(rawReview.data?.result), rawReview.path, generatedAt),
    row("capture.review_payload_extracted", "durable_raw_json_capture", "Focused review JSON payload was extracted from Claude result", reviewPayload.validJson === true, rawReview.path, generatedAt),
    row("capture.session_id_present", "durable_raw_json_capture", "Claude session id or uuid is present", Boolean(rawReview.data?.session_id || rawReview.data?.uuid), rawReview.path, generatedAt),
  ];
}

function buildFocusedReviewOutputRows({ reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  return [
    row("output.verdict_present", "focused_review_output_shape", "Review verdict is present", typeof payload.overall_verdict === "string" && payload.overall_verdict.length > 0, reviewPayload.evidenceRef, generatedAt, { review_verdict: payload.overall_verdict }),
    row("output.blocks_clean_checkpoint_present", "focused_review_output_shape", "blocks_clean_checkpoint boolean is present", typeof payload.blocks_clean_checkpoint === "boolean", reviewPayload.evidenceRef, generatedAt),
    row("output.blocking_count_present", "focused_review_output_shape", "open_blocking_finding_count is finite", Number.isFinite(Number(payload.open_blocking_finding_count)), reviewPayload.evidenceRef, generatedAt, { open_blocking_finding_count: Number(payload.open_blocking_finding_count) }),
    row("output.findings_array", "focused_review_output_shape", "findings array is present", Array.isArray(payload.findings), reviewPayload.evidenceRef, generatedAt, { finding_count: Array.isArray(payload.findings) ? payload.findings.length : null }),
    row("output.dispatch_program_range", "focused_review_output_shape", "Payload binds to P69201-P69600 dispatch metadata", payload.dispatch_program_range === SOURCE_PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.reviewed_program_range", "focused_review_output_shape", "Payload reviewed P68801-P69200 focused verification normalization", payload.reviewed_program_range === REVIEWED_PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.review_event_program_range", "focused_review_output_shape", "Payload review event program range is P69601-P70000", payload.review_event_program_range === PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.required_hrm_ids", "focused_review_output_shape", "Payload reviewed HRM-04, HRM-03, and HRM-01", REQUIRED_HRM_IDS.every((id) => (payload.reviewed_hrm_ids ?? []).includes(id)), reviewPayload.evidenceRef, generatedAt, { reviewed_hrm_ids: payload.reviewed_hrm_ids }),
    row("output.no_final_approval", "focused_review_output_shape", "Claude did not claim final approval", !hasTrueField(payload, ["is_final_approval", "reviewer_final_approval_allowed", "claude_final_approval_allowed", "final_approval_allowed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_clean_checkpoint", "focused_review_output_shape", "Claude did not claim clean checkpoint authority", !hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_source_mutation", "focused_review_output_shape", "Claude did not claim source mutation", !hasTrueField(payload, ["source_mutation_performed", "source_mutation_allowed", "mutation_performed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_finding_resolution", "focused_review_output_shape", "Claude did not claim finding resolution", !hasTrueField(payload, ["finding_resolution_performed", "finding_resolution_allowed", "findings_resolved", "finding_status_resolved"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_fixed_verified_claim", "focused_review_output_shape", "Claude did not mark focused findings fixed or verified", !hasTrueField(payload, ["finding_status_fixed", "finding_status_verified", "findings_fixed", "findings_verified"]), reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildFocusedReviewEventBoundaryRows({ p69600Dispatch, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const summary = p69600Dispatch.data?.summary ?? {};
  return [
    row("event.source_dispatch_not_event", "focused_review_event_boundary", "P69600 dispatch metadata remains not a review event", summary.dispatch_performed_now === false && summary.raw_review_captured_now === false && summary.review_evidence_counted_now === false, p69600Dispatch.path, generatedAt),
    row("event.payload_is_focused_review_event", "focused_review_event_boundary", "Raw Claude payload is marked as performed focused review event", payload.is_claude_review_event === true, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_final_approval", "focused_review_event_boundary", "Focused review event is not final approval", payload.is_final_approval === false, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_production", "focused_review_event_boundary", "Focused review event is not production PASS", payload.is_production_pass === false, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_enterprise", "focused_review_event_boundary", "Focused review event is not enterprise PASS", payload.is_enterprise_pass === false, reviewPayload.evidenceRef, generatedAt),
    row("event.requires_later_normalization", "focused_review_event_boundary", "Focused review event requires later normalization", payload.requires_later_normalization === true, reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildAuthorityRows({ reviewPayload, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(reviewPayload.payload, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, reviewPayload.evidenceRef, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(payload, flag) {
  if (flag === "claude_final_approval_allowed" && hasTrueField(payload, ["is_final_approval", "claude_final_approval_allowed", "final_approval_allowed"])) return true;
  if (flag === "dispatch_metadata_counted_as_review_now" && hasTrueField(payload, ["dispatch_metadata_counted_as_review", "dispatch_metadata_is_review_evidence"])) return true;
  if (flag === "raw_capture_counted_as_normalized_receipt_now" && hasTrueField(payload, ["raw_capture_is_normalized_receipt", "normalized_receipt_complete"])) return true;
  if (flag === "focused_review_normalized_now" && hasTrueField(payload, ["focused_review_normalized", "review_receipt_normalized"])) return true;
  if (flag === "focused_finding_fixed_claim_allowed_now" && hasTrueField(payload, ["finding_status_fixed", "findings_fixed"])) return true;
  if (flag === "focused_finding_verified_claim_allowed_now" && hasTrueField(payload, ["finding_status_verified", "findings_verified"])) return true;
  if (flag === "focused_finding_resolved_claim_allowed_now" && hasTrueField(payload, ["finding_status_resolved", "findings_resolved"])) return true;
  if (flag === "reviewer_mutation_allowed_now" && hasTrueField(payload, ["reviewer_mutation_allowed", "reviewer_mutation_performed"])) return true;
  if (flag === "source_mutation_from_review_allowed_now" && hasTrueField(payload, ["source_mutation_allowed", "source_mutation_performed", "mutation_performed"])) return true;
  if (flag === "finding_resolution_allowed_now" && hasTrueField(payload, ["finding_resolution_allowed", "finding_resolution_performed", "findings_resolved"])) return true;
  if (flag === "finding_auto_resolved_allowed_now" && hasTrueField(payload, ["finding_auto_resolved_allowed", "finding_auto_resolved"])) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"])) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && hasTrueField(payload, ["protected_closeout_allowed", "protected_closeout_performed"])) return true;
  if (flag === "claude_review_final_approval_allowed_now" && hasTrueField(payload, ["reviewer_final_approval_allowed", "is_final_approval"])) return true;
  if (flag === "post_p70000_production_pass_claim_allowed_now" && hasTrueField(payload, ["is_production_pass", "production_pass_allowed"])) return true;
  if (flag === "post_p70000_enterprise_pass_claim_allowed_now" && hasTrueField(payload, ["is_enterprise_pass", "enterprise_pass_allowed"])) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P70000 closeout`,
    true,
    "docs/hermes-roadmap-p69601-p70000.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-claude-review-raw-capture.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P69601-P70000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P69601-P70000") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p69601-p70000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P69601-P70000 focused Claude review raw capture", architectureDoc.available && architectureDoc.text.includes("P69601-P70000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p70000.source_ready", "P69600 dispatch metadata source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p70000.model_policy", "Claude Code Opus max model and max effort policy are observed", modelRows.every(pass), generatedAt),
    closeoutRow("p70000.raw_capture_valid", "Durable focused Claude raw JSON capture is valid", captureRows.every(pass), generatedAt),
    closeoutRow("p70000.output_shape_ready", "Focused review output shape is extractable for P70001 normalization", outputRows.every(pass), generatedAt),
    closeoutRow("p70000.review_event_boundary", "Focused review event boundary rows pass", eventRows.every(pass), generatedAt),
    closeoutRow("p70000.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p70000.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p70000.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p70000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p70001_normalization", "p70001_handoff", "P70001 may normalize durable focused Claude raw JSON and route findings", ready, reviewPayload.evidenceRef, generatedAt, {
      next_allowed_action: ready ? "normalize_focused_claude_review_receipt_and_route_findings" : "resolve_p70000_raw_capture_blockers",
    }),
    row("handoff.focused_findings_visible", "p70001_handoff", "Focused findings remain visible for later finding loop", Number(payload.open_blocking_finding_count ?? 0) >= 0 && Array.isArray(payload.findings), reviewPayload.evidenceRef, generatedAt, {
      open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
      review_verdict: payload.overall_verdict,
    }),
    row("handoff.no_clean_claim", "p70001_handoff", "P70000 raw capture is not a clean checkpoint or final approval", true, "docs/hermes-roadmap-p69601-p70000.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload, rawReview } = parts;
  const payload = reviewPayload.payload ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_focused_claude_review_raw_capture_ready: closeoutRows.every(pass),
    p69600_source_ready_now: sourceRows.every(pass),
    claude_opus_max_policy_ready_now: modelRows.every(pass),
    durable_raw_json_capture_valid_now: captureRows.every(pass),
    focused_review_output_shape_ready_now: outputRows.every(pass),
    focused_review_event_boundary_ready_now: eventRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p70001_handoff: handoffRows.every(pass),
    focused_review_event_candidate_now: payload.is_claude_review_event === true,
    raw_review_sha256: rawReview.text ? sha256(rawReview.text) : "",
    review_verdict: String(payload.overall_verdict ?? ""),
    blocks_clean_checkpoint: payload.blocks_clean_checkpoint === true,
    open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
    finding_count: Array.isArray(payload.findings) ? payload.findings.length : 0,
    reviewed_hrm_ids: payload.reviewed_hrm_ids ?? [],
    clean_checkpoint_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p70000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p70000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now || boundary.claude_review_final_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, eventRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p69600", "source_binding", sourceRows.every(pass), "P69600 dispatch metadata source and guard rows must be ready"),
    validationItem("model.policy", "model_policy", modelRows.every(pass), "Claude Code Opus max model, max effort, and read-only dispatch metadata must be present"),
    validationItem("capture.raw_json", "raw_capture", captureRows.every(pass), "Claude focused raw review JSON must be durable, parseable, successful, and not auth/tool-call-shaped output"),
    validationItem("output.shape", "output_shape", outputRows.every(pass), "Focused review output must expose verdict, blocker count, checkpoint status, findings, dispatch scope, reviewed scope, event scope, and HRM ids"),
    validationItem("event.boundary", "review_event_boundary", eventRows.every(pass), "Raw focused review is the event; P69600 dispatch metadata is not the event"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P70000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P70001 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_focused_claude_review_raw_capture_ready === true, "P70000 capture must be ready"),
    validationItem("boundary.dispatch_not_review", "authority_boundary", boundary.dispatch_metadata_counted_as_review_now === false, "Dispatch metadata must not be counted as review"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p70001_handoff
    ? boundary.open_blocking_finding_count > 0 || boundary.blocks_clean_checkpoint
      ? "focused_claude_review_raw_captured_blocked_findings_ready_for_p70001"
      : "focused_claude_review_raw_captured_clean_candidate_ready_for_p70001"
    : validation.valid
      ? "valid_block_p70001_handoff_pending"
      : "blocked_post_p64000_focused_claude_review_raw_capture";
  return {
    post_p64000_focused_claude_review_raw_capture_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p69600_source_ready_now: boundary.p69600_source_ready_now,
    claude_opus_max_policy_ready_now: boundary.claude_opus_max_policy_ready_now,
    durable_raw_json_capture_valid_now: boundary.durable_raw_json_capture_valid_now,
    focused_review_output_shape_ready_now: boundary.focused_review_output_shape_ready_now,
    focused_review_event_boundary_ready_now: boundary.focused_review_event_boundary_ready_now,
    focused_review_event_candidate_now: boundary.focused_review_event_candidate_now,
    ready_for_p70001_handoff: boundary.ready_for_p70001_handoff,
    raw_review_sha256: boundary.raw_review_sha256,
    review_verdict: boundary.review_verdict,
    blocks_clean_checkpoint: boundary.blocks_clean_checkpoint,
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

function extractReviewPayload(rawReview) {
  const evidenceRef = rawReview.path;
  const resultValue = rawReview.data?.result;
  if (resultValue && typeof resultValue === "object" && !Array.isArray(resultValue)) return { validJson: true, payload: resultValue, evidenceRef };
  const resultText = String(resultValue ?? "");
  const fenced = resultText.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : resultText.trim().startsWith("{") ? resultText : "";
  if (!jsonText) return { validJson: false, payload: null, evidenceRef, error: "focused_review_json_payload_missing" };
  try {
    return { validJson: true, payload: JSON.parse(jsonText), evidenceRef };
  } catch (error) {
    return { validJson: false, payload: null, evidenceRef, error: error.message };
  }
}

function containsAuthFailure(text) {
  return /not logged in|please run \/login|authentication failed|api key missing|oauth|unauthorized/i.test(String(text ?? ""));
}

function isToolCallShaped(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /"tool_use"|"tool_calls"|"recipient_name"|"input"\s*:\s*\{/.test(text) && !/overall_verdict/.test(text);
}

function hasTrueField(payload, fields) {
  return fields.some((field) => payload?.[field] === true);
}

function hasRowsForAllHrms(rows) {
  return Array.isArray(rows) && REQUIRED_HRM_IDS.every((id) => rows.some((rowItem) => rowItem.finding_id === id));
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Focused Claude Review Raw Capture ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_claude_review_raw_capture_status}`,
    `- p69600_source_ready_now: ${result.summary.p69600_source_ready_now}`,
    `- claude_opus_max_policy_ready_now: ${result.summary.claude_opus_max_policy_ready_now}`,
    `- durable_raw_json_capture_valid_now: ${result.summary.durable_raw_json_capture_valid_now}`,
    `- focused_review_event_candidate_now: ${result.summary.focused_review_event_candidate_now}`,
    `- review_verdict: ${result.summary.review_verdict}`,
    `- blocks_clean_checkpoint: ${result.summary.blocks_clean_checkpoint}`,
    `- open_blocking_finding_count: ${result.summary.open_blocking_finding_count}`,
    `- ready_for_p70001_handoff: ${result.summary.ready_for_p70001_handoff}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p70001_handoff
      ? "Continue to P70001-P70400 focused Claude review receipt normalization and finding loop. Do not treat raw capture as final approval or clean checkpoint."
      : "Resolve P69600 source, model policy, raw capture, output shape, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p70000_closeout", label, observed, "artifacts/post-p64000-focused-claude-review-raw-capture/latest/post-p64000-focused-claude-review-raw-capture.json", generatedAt);
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_focused_review_capture_flow" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--p69600-dispatch") args.p69600DispatchPath = argv[++index];
    else if (arg === "--dispatch-packet") args.dispatchPacketPath = argv[++index];
    else if (arg === "--dispatch-rows") args.dispatchRowsPath = argv[++index];
    else if (arg === "--review-scope-rows") args.reviewScopeRowsPath = argv[++index];
    else if (arg === "--prompt-guard-rows") args.promptGuardRowsPath = argv[++index];
    else if (arg === "--evidence-guard-rows") args.evidenceGuardRowsPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--raw-review PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_RAW_CAPTURE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    p69600_dispatch_path: path.resolve(repoRoot, options.p69600DispatchPath ?? defaults.p69600DispatchPath),
    dispatch_packet_path: path.resolve(repoRoot, options.dispatchPacketPath ?? defaults.dispatchPacketPath),
    dispatch_rows_path: path.resolve(repoRoot, options.dispatchRowsPath ?? defaults.dispatchRowsPath),
    review_scope_rows_path: path.resolve(repoRoot, options.reviewScopeRowsPath ?? defaults.reviewScopeRowsPath),
    prompt_guard_rows_path: path.resolve(repoRoot, options.promptGuardRowsPath ?? defaults.promptGuardRowsPath),
    evidence_guard_rows_path: path.resolve(repoRoot, options.evidenceGuardRowsPath ?? defaults.evidenceGuardRowsPath),
    raw_review_path: path.resolve(repoRoot, options.rawReviewPath ?? defaults.rawReviewPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
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
  return { path: sourceId, available: data !== null && data !== undefined, data, text: data === null || data === undefined ? "" : JSON.stringify(data) };
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

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
