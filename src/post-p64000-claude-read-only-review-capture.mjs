import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_CLAUDE_READ_ONLY_REVIEW_CAPTURE_OUT_DIR = "artifacts/post-p64000-claude-read-only-review-capture/latest";
export const DEFAULT_POST_P64000_CLAUDE_READ_ONLY_REVIEW_CAPTURE_INPUTS = {
  schemaPath: "schemas/post-p64000-claude-read-only-review-capture.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p67201-p67600.md",
  architectureDocPath: "docs/architecture.md",
  sourceResultPath: "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/post-p64000-hrm-revalidation-clean-candidate-review.json",
  packetPath: "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md",
  packetBoundaryPath: "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json",
  dispatchMetadataPath: "artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-dispatch-metadata.json",
  rawReviewPath: "artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-raw.json",
};

const COMMAND_NAME = "platform:post-p64000-claude-read-only-review-capture";
const SCHEMA_VERSION = "post-p64000-claude-read-only-review-capture.v1";
const CAPABILITY_ID = "platform.post_p64000_claude_read_only_review_capture";
const PROGRAM_RANGE = "P67201-P67600";
const SOURCE_PROGRAM_RANGE = "P66801-P67200";
const NEXT_PROGRAM_RANGE = "P67601-P68000";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p67200_source_result",
  "p67200_not_ready_for_handoff",
  "missing_clean_candidate_packet",
  "packet_boundary_claims_review_event",
  "missing_dispatch_metadata",
  "wrong_reviewer_model_or_effort",
  "missing_raw_capture",
  "empty_raw_capture",
  "malformed_raw_json",
  "auth_failure_or_login_prompt",
  "timeout_or_hang_counted_as_evidence",
  "pty_stdout_loss_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "missing_review_json_payload",
  "review_payload_not_performed_event",
  "review_payload_wrong_scope",
  "review_payload_missing_hrm_ids",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "finding_resolution_claim",
  "clean_checkpoint_claim",
  "claude_final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
];

const EXTRA_FALSE_FLAGS = [
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "claude_review_final_approval_allowed_now",
  "post_p67600_production_pass_claim_allowed_now",
  "post_p67600_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-claude-read-only-review-capture.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-claude-read-only-review-capture.mjs"],
  ["unit.test", "node --test test/post-p64000-claude-read-only-review-capture.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-claude-read-only-review-capture -- --check"],
  ["adjacent.p67200", "node --test test/post-p64000-hrm-revalidation-clean-candidate-review.test.mjs test/post-p64000-claude-read-only-review-capture.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-claude-read-only-review-capture.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000ClaudeReadOnlyReviewCapture(options = {}) {
  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 Claude read-only review capture failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000ClaudeReadOnlyReviewCapture(result, result.output_dir);
  return result;
}

export async function buildPostP64000ClaudeReadOnlyReviewCapture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_CLAUDE_READ_ONLY_REVIEW_CAPTURE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceResult = Object.prototype.hasOwnProperty.call(options, "sourceResult")
    ? normalizeInlineJsonSource("inline.p67200_source_result", options.sourceResult)
    : await readJsonSource(inputs.source_result_path);
  const packet = Object.prototype.hasOwnProperty.call(options, "packetText")
    ? normalizeInlineTextSource("inline.clean_candidate_packet", options.packetText)
    : await readTextSource(inputs.packet_path);
  const packetBoundary = Object.prototype.hasOwnProperty.call(options, "packetBoundary")
    ? normalizeInlineJsonSource("inline.clean_candidate_packet_boundary", options.packetBoundary)
    : await readJsonSource(inputs.packet_boundary_path);
  const dispatchMetadata = Object.prototype.hasOwnProperty.call(options, "dispatchMetadata")
    ? normalizeInlineJsonSource("inline.claude_review_dispatch_metadata", options.dispatchMetadata)
    : await readJsonSource(inputs.dispatch_metadata_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const reviewPayload = extractReviewPayload(rawReview);

  const sourceRows = buildSourceRows({ sourceResult, packet, packetBoundary, generatedAt });
  const modelRows = buildModelPolicyRows({ dispatchMetadata, rawReview, reviewPayload, generatedAt });
  const captureRows = buildDurableRawJsonCaptureRows({ rawReview, reviewPayload, generatedAt });
  const outputRows = buildReviewOutputRows({ reviewPayload, generatedAt });
  const boundaryRows = buildReviewEventBoundaryRows({ packetBoundary, reviewPayload, generatedAt });
  const authorityRows = buildAuthorityRows({ reviewPayload, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, reviewPayload, generatedAt });
  const boundary = buildBoundary({ sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload, rawReview });
  const validationItems = buildValidationItems({ sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      source_result_path: sourceResult.path,
      packet_path: packet.path,
      packet_boundary_path: packetBoundary.path,
      dispatch_metadata_path: dispatchMetadata.path,
      raw_review_path: rawReview.path,
    },
    post_p64000_claude_read_only_review_capture_contract: {
      contract_id: "post_p64000_claude_read_only_review_capture",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      requires_claude_code_opus_max: true,
      requires_effort_max: true,
      requires_durable_raw_json: true,
      capture_is_performed_review_event_candidate: true,
      raw_capture_requires_later_normalization: true,
      reviewer_mutation_allowed: false,
      source_mutation_allowed: false,
      finding_resolution_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p67200_source_binding_rows: sourceRows,
    model_policy_rows: modelRows,
    durable_raw_json_capture_rows: captureRows,
    review_output_shape_rows: outputRows,
    review_event_boundary_rows: boundaryRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p67600_wiring_rows: wiringRows,
    p67600_closeout_rows: closeoutRows,
    p67601_handoff_rows: handoffRows,
    extracted_review_payload: reviewPayload.payload,
    post_p64000_claude_read_only_review_capture_boundary: boundary,
    post_p64000_claude_read_only_review_capture_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_claude_read_only_review_capture")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_claude_read_only_review_capture_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_claude_read_only_review_capture_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000ClaudeReadOnlyReviewCapture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-claude-read-only-review-capture.json"), serializableResult(result));
  await writeJson(path.join(outDir, "durable-raw-json-capture-rows.json"), collectionEnvelope("durable-raw-json-capture-rows.v1", "durable_raw_json_capture_rows", result.durable_raw_json_capture_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-policy-rows.json"), collectionEnvelope("model-policy-rows.v1", "model_policy_rows", result.model_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-event-boundary-rows.json"), collectionEnvelope("review-event-boundary-rows.v1", "review_event_boundary_rows", result.review_event_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-review-payload.json"), result.extracted_review_payload ?? {});
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000ClaudeReadOnlyReviewCaptureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000ClaudeReadOnlyReviewCapture(args);
  console.log(`Post-P64000 Claude read-only review capture ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_claude_read_only_review_capture_status}`);
  console.log(`P67200 source ready: ${result.summary.p67200_source_ready_now}`);
  console.log(`Claude Opus max policy ready: ${result.summary.claude_opus_max_policy_ready_now}`);
  console.log(`Durable raw JSON captured: ${result.summary.durable_raw_json_capture_valid_now}`);
  console.log(`Review event candidate: ${result.summary.review_event_candidate_now}`);
  console.log(`Review verdict: ${result.summary.review_verdict}`);
  console.log(`Blocking findings: ${result.summary.open_blocking_finding_count}`);
  console.log(`Ready for P67601 handoff: ${result.summary.ready_for_p67601_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ sourceResult, packet, packetBoundary, generatedAt }) {
  const summary = sourceResult.data?.summary ?? {};
  return [
    row("source.p67200_result_available", "p67200_source_binding", "P67200 clean-candidate source result is available", sourceResult.available === true, sourceResult.path, generatedAt),
    row("source.p67200_program", "p67200_source_binding", "P67200 source result program range matches", sourceResult.data?.program_range === SOURCE_PROGRAM_RANGE, sourceResult.path, generatedAt),
    row("source.p67200_valid", "p67200_source_binding", "P67200 source validation is valid", sourceResult.data?.validation?.valid === true, sourceResult.path, generatedAt),
    row("source.p67200_handoff_ready", "p67200_source_binding", "P67200 is ready for P67201 handoff", summary.ready_for_p67201_handoff === true, sourceResult.path, generatedAt),
    row("source.packet_available", "p67200_source_binding", "Clean-candidate packet is available", packet.available === true && packet.text.includes("Post-P64000 HRM Clean-Candidate Review Packet"), packet.path, generatedAt),
    row("source.packet_boundary_available", "p67200_source_binding", "Clean-candidate packet boundary is available", packetBoundary.available === true, packetBoundary.path, generatedAt),
    row("source.packet_not_review_event", "p67200_source_binding", "Source packet is not the review event", packetBoundary.data?.is_claude_review_event === false && packetBoundary.data?.performed_review_evidence_allowed === false, packetBoundary.path, generatedAt),
  ];
}

function buildModelPolicyRows({ dispatchMetadata, rawReview, reviewPayload, generatedAt }) {
  const usageKeys = Object.keys(rawReview.data?.modelUsage ?? {});
  return [
    row("model.dispatch_metadata_available", "model_policy", "Dispatch metadata is available", dispatchMetadata.available === true, dispatchMetadata.path, generatedAt),
    row("model.reviewer_expected", "model_policy", "Dispatch metadata requested Claude Code Opus max", dispatchMetadata.data?.reviewer === "claude-code-opus-max", dispatchMetadata.path, generatedAt),
    row("model.alias_opus", "model_policy", "Dispatch metadata requested opus model alias", String(dispatchMetadata.data?.model_alias ?? "").toLowerCase() === "opus", dispatchMetadata.path, generatedAt),
    row("model.effort_max", "model_policy", "Dispatch metadata requested max effort", String(dispatchMetadata.data?.effort ?? "").toLowerCase() === "max", dispatchMetadata.path, generatedAt),
    row("model.read_only_lane", "model_policy", "Dispatch metadata uses independent read-only lane", dispatchMetadata.data?.reviewer_lane === "independent_read_only" && dispatchMetadata.data?.source_mutation_allowed === false, dispatchMetadata.path, generatedAt),
    row("model.raw_usage_observed", "model_policy", "Claude raw output includes model usage", usageKeys.length > 0, rawReview.path, generatedAt, { model_usage_keys: usageKeys }),
    row("model.raw_usage_opus", "model_policy", "Claude raw output includes Opus model usage", usageKeys.some((key) => /opus/i.test(key)), rawReview.path, generatedAt, { model_usage_keys: usageKeys }),
    row("model.payload_reviewer", "model_policy", "Review payload identifies Claude Code Opus max reviewer", reviewPayload.payload?.reviewer === "claude-code-opus-max", reviewPayload.evidenceRef, generatedAt),
    row("model.payload_lane", "model_policy", "Review payload identifies independent read-only lane", reviewPayload.payload?.reviewer_lane === "independent_read_only", reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildDurableRawJsonCaptureRows({ rawReview, reviewPayload, generatedAt }) {
  const rawHash = rawReview.text ? sha256(rawReview.text) : "";
  return [
    row("capture.raw_available", "durable_raw_json_capture", "Claude raw review JSON is available", rawReview.available === true, rawReview.path, generatedAt),
    row("capture.raw_non_empty", "durable_raw_json_capture", "Claude raw review JSON is non-empty", rawReview.text.trim().length > 0, rawReview.path, generatedAt),
    row("capture.raw_hash_present", "durable_raw_json_capture", "Raw JSON SHA-256 hash is present", rawHash.length === 64, rawReview.path, generatedAt, { raw_sha256: rawHash }),
    row("capture.wrapper_success", "durable_raw_json_capture", "Claude Code raw wrapper is success", rawReview.data?.type === "result" && rawReview.data?.subtype === "success" && rawReview.data?.is_error === false, rawReview.path, generatedAt),
    row("capture.terminal_completed", "durable_raw_json_capture", "Claude Code terminal reason is completed or absent", rawReview.data?.terminal_reason === undefined || rawReview.data?.terminal_reason === "completed", rawReview.path, generatedAt),
    row("capture.not_auth_failure", "durable_raw_json_capture", "Raw output is not auth failure or login prompt", !containsAuthFailure(rawReview.text), rawReview.path, generatedAt),
    row("capture.not_tool_call_shape", "durable_raw_json_capture", "Raw output is not tool-call-shaped review evidence", !isToolCallShaped(rawReview.data?.result), rawReview.path, generatedAt),
    row("capture.review_payload_extracted", "durable_raw_json_capture", "Review JSON payload was extracted from Claude result", reviewPayload.validJson === true, rawReview.path, generatedAt),
    row("capture.session_id_present", "durable_raw_json_capture", "Claude session id or uuid is present", Boolean(rawReview.data?.session_id || rawReview.data?.uuid), rawReview.path, generatedAt),
  ];
}

function buildReviewOutputRows({ reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  return [
    row("output.verdict_present", "review_output_shape", "Review verdict is present", typeof payload.overall_verdict === "string" && payload.overall_verdict.length > 0, reviewPayload.evidenceRef, generatedAt, { review_verdict: payload.overall_verdict }),
    row("output.blocks_clean_checkpoint_present", "review_output_shape", "blocks_clean_checkpoint boolean is present", typeof payload.blocks_clean_checkpoint === "boolean", reviewPayload.evidenceRef, generatedAt),
    row("output.blocking_count_present", "review_output_shape", "open_blocking_finding_count is finite", Number.isFinite(Number(payload.open_blocking_finding_count)), reviewPayload.evidenceRef, generatedAt, { open_blocking_finding_count: Number(payload.open_blocking_finding_count) }),
    row("output.findings_array", "review_output_shape", "findings array is present", Array.isArray(payload.findings), reviewPayload.evidenceRef, generatedAt, { finding_count: Array.isArray(payload.findings) ? payload.findings.length : null }),
    row("output.reviewed_program_range", "review_output_shape", "Payload reviewed P66801-P67200 source packet", payload.reviewed_program_range === SOURCE_PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.review_event_program_range", "review_output_shape", "Payload review event program range is P67201-P67600", payload.review_event_program_range === PROGRAM_RANGE, reviewPayload.evidenceRef, generatedAt),
    row("output.required_hrm_ids", "review_output_shape", "Payload reviewed HRM-04, HRM-03, and HRM-01", REQUIRED_HRM_IDS.every((id) => (payload.reviewed_hrm_ids ?? []).includes(id)), reviewPayload.evidenceRef, generatedAt, { reviewed_hrm_ids: payload.reviewed_hrm_ids }),
    row("output.no_final_approval", "review_output_shape", "Claude did not claim final approval", !hasTrueField(payload, ["is_final_approval", "reviewer_final_approval_allowed", "claude_final_approval_allowed", "final_approval_allowed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_clean_checkpoint", "review_output_shape", "Claude did not claim clean checkpoint authority", !hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_source_mutation", "review_output_shape", "Claude did not claim source mutation", !hasTrueField(payload, ["source_mutation_performed", "source_mutation_allowed", "mutation_performed"]), reviewPayload.evidenceRef, generatedAt),
    row("output.no_finding_resolution", "review_output_shape", "Claude did not claim finding resolution", !hasTrueField(payload, ["finding_resolution_performed", "finding_resolution_allowed", "findings_resolved"]), reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildReviewEventBoundaryRows({ packetBoundary, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  return [
    row("event.source_packet_not_event", "review_event_boundary", "P67200 packet remains not a review event", packetBoundary.data?.is_claude_review_event === false, packetBoundary.path, generatedAt),
    row("event.payload_is_review_event", "review_event_boundary", "Raw Claude payload is marked as performed review event", payload.is_claude_review_event === true, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_final_approval", "review_event_boundary", "Review event is not final approval", payload.is_final_approval === false, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_production", "review_event_boundary", "Review event is not production PASS", payload.is_production_pass === false, reviewPayload.evidenceRef, generatedAt),
    row("event.payload_not_enterprise", "review_event_boundary", "Review event is not enterprise PASS", payload.is_enterprise_pass === false, reviewPayload.evidenceRef, generatedAt),
    row("event.requires_later_normalization", "review_event_boundary", "Review event requires later normalization", payload.requires_later_normalization === true, reviewPayload.evidenceRef, generatedAt),
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
  if (flag === "reviewer_mutation_allowed_now" && hasTrueField(payload, ["reviewer_mutation_allowed", "reviewer_mutation_performed"])) return true;
  if (flag === "source_mutation_from_review_allowed_now" && hasTrueField(payload, ["source_mutation_allowed", "source_mutation_performed", "mutation_performed"])) return true;
  if (flag === "finding_resolution_allowed_now" && hasTrueField(payload, ["finding_resolution_allowed", "finding_resolution_performed", "findings_resolved"])) return true;
  if (flag === "finding_auto_resolved_allowed_now" && hasTrueField(payload, ["finding_auto_resolved_allowed", "finding_auto_resolved"])) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && hasTrueField(payload, ["clean_checkpoint_allowed", "clean_checkpoint_claim_allowed", "is_clean_checkpoint"])) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && hasTrueField(payload, ["protected_closeout_allowed", "protected_closeout_performed"])) return true;
  if (flag === "claude_review_final_approval_allowed_now" && hasTrueField(payload, ["reviewer_final_approval_allowed", "is_final_approval"])) return true;
  if (flag === "post_p67600_production_pass_claim_allowed_now" && hasTrueField(payload, ["is_production_pass", "production_pass_allowed"])) return true;
  if (flag === "post_p67600_enterprise_pass_claim_allowed_now" && hasTrueField(payload, ["is_enterprise_pass", "enterprise_pass_allowed"])) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P67600 closeout`,
    true,
    "docs/hermes-roadmap-p67201-p67600.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-claude-read-only-review-capture.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P67201-P67600 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P67201-P67600") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p67201-p67600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P67201-P67600 Claude read-only review capture", architectureDoc.available && architectureDoc.text.includes("P67201-P67600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p67600.source_ready", "P67200 source packet and boundary are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p67600.model_policy", "Claude Code Opus max model and max effort policy are observed", modelRows.every(pass), generatedAt),
    closeoutRow("p67600.raw_capture_valid", "Durable Claude raw JSON capture is valid", captureRows.every(pass), generatedAt),
    closeoutRow("p67600.output_shape_ready", "Review output shape is extractable for P67601 normalization", outputRows.every(pass), generatedAt),
    closeoutRow("p67600.review_event_boundary", "Review event boundary rows pass", boundaryRows.every(pass), generatedAt),
    closeoutRow("p67600.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p67600.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p67600.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p67600.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p67601_normalization", "p67601_handoff", "P67601 may normalize durable Claude raw JSON and route findings", ready, reviewPayload.evidenceRef, generatedAt, {
      next_allowed_action: ready ? "normalize_claude_review_receipt_and_route_findings" : "resolve_p67600_raw_capture_blockers",
    }),
    row("handoff.findings_visible", "p67601_handoff", "Findings remain visible for later finding loop", Number(payload.open_blocking_finding_count ?? 0) >= 0 && Array.isArray(payload.findings), reviewPayload.evidenceRef, generatedAt, {
      open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
      review_verdict: payload.overall_verdict,
    }),
    row("handoff.no_clean_claim", "p67601_handoff", "P67600 raw capture is not a clean checkpoint or final approval", true, "docs/hermes-roadmap-p67201-p67600.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, reviewPayload, rawReview } = parts;
  const payload = reviewPayload.payload ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_claude_read_only_review_capture_ready: closeoutRows.every(pass),
    p67200_source_ready_now: sourceRows.every(pass),
    claude_opus_max_policy_ready_now: modelRows.every(pass),
    durable_raw_json_capture_valid_now: captureRows.every(pass),
    review_output_shape_ready_now: outputRows.every(pass),
    review_event_boundary_ready_now: boundaryRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p67601_handoff: handoffRows.every(pass),
    review_event_candidate_now: payload.is_claude_review_event === true,
    raw_review_sha256: rawReview.text ? sha256(rawReview.text) : "",
    review_verdict: String(payload.overall_verdict ?? ""),
    blocks_clean_checkpoint: payload.blocks_clean_checkpoint === true,
    open_blocking_finding_count: Number(payload.open_blocking_finding_count ?? 0),
    finding_count: Array.isArray(payload.findings) ? payload.findings.length : 0,
    reviewed_hrm_ids: payload.reviewed_hrm_ids ?? [],
    clean_checkpoint_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p67600_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p67600_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now || boundary.claude_review_final_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, modelRows, captureRows, outputRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p67200", "source_binding", sourceRows.every(pass), "P67200 packet source and boundary must be ready"),
    validationItem("model.policy", "model_policy", modelRows.every(pass), "Claude Code Opus max model, max effort, and read-only dispatch metadata must be present"),
    validationItem("capture.raw_json", "raw_capture", captureRows.every(pass), "Claude raw review JSON must be durable, parseable, successful, and not auth/tool-call-shaped output"),
    validationItem("output.shape", "output_shape", outputRows.every(pass), "Review output must expose verdict, blocker count, checkpoint status, findings, scope, and HRM ids"),
    validationItem("event.boundary", "review_event_boundary", boundaryRows.every(pass), "Raw review is the event; source packet is not the event"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P67600 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P67601 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_claude_read_only_review_capture_ready === true, "P67600 capture must be ready"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p67601_handoff
    ? boundary.open_blocking_finding_count > 0 || boundary.blocks_clean_checkpoint
      ? "claude_read_only_review_captured_blocked_findings_ready_for_p67601"
      : "claude_read_only_review_captured_clean_candidate_ready_for_p67601"
    : validation.valid
      ? "valid_block_p67601_handoff_pending"
      : "blocked_post_p64000_claude_read_only_review_capture";
  return {
    post_p64000_claude_read_only_review_capture_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p67200_source_ready_now: boundary.p67200_source_ready_now,
    claude_opus_max_policy_ready_now: boundary.claude_opus_max_policy_ready_now,
    durable_raw_json_capture_valid_now: boundary.durable_raw_json_capture_valid_now,
    review_output_shape_ready_now: boundary.review_output_shape_ready_now,
    review_event_boundary_ready_now: boundary.review_event_boundary_ready_now,
    review_event_candidate_now: boundary.review_event_candidate_now,
    ready_for_p67601_handoff: boundary.ready_for_p67601_handoff,
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
  if (!jsonText) return { validJson: false, payload: null, evidenceRef, error: "review_json_payload_missing" };
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

function renderMarkdown(result) {
  return [
    `# Post-P64000 Claude Read-Only Review Capture ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_claude_read_only_review_capture_status}`,
    `- p67200_source_ready_now: ${result.summary.p67200_source_ready_now}`,
    `- claude_opus_max_policy_ready_now: ${result.summary.claude_opus_max_policy_ready_now}`,
    `- durable_raw_json_capture_valid_now: ${result.summary.durable_raw_json_capture_valid_now}`,
    `- review_event_candidate_now: ${result.summary.review_event_candidate_now}`,
    `- review_verdict: ${result.summary.review_verdict}`,
    `- blocks_clean_checkpoint: ${result.summary.blocks_clean_checkpoint}`,
    `- open_blocking_finding_count: ${result.summary.open_blocking_finding_count}`,
    `- ready_for_p67601_handoff: ${result.summary.ready_for_p67601_handoff}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p67601_handoff
      ? "Continue to P67601-P68000 receipt normalization and finding loop. Do not treat raw capture as final approval or clean checkpoint."
      : "Resolve P67200 source, model policy, raw capture, output shape, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p67600_closeout", label, observed, "artifacts/post-p64000-claude-read-only-review-capture/latest/post-p64000-claude-read-only-review-capture.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_review_evidence_flow" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--source-result") args.sourceResultPath = argv[++index];
    else if (arg === "--packet") args.packetPath = argv[++index];
    else if (arg === "--packet-boundary") args.packetBoundaryPath = argv[++index];
    else if (arg === "--dispatch-metadata") args.dispatchMetadataPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-result PATH] [--packet PATH] [--packet-boundary PATH] [--dispatch-metadata PATH] [--raw-review PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_CLAUDE_READ_ONLY_REVIEW_CAPTURE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_result_path: path.resolve(repoRoot, options.sourceResultPath ?? defaults.sourceResultPath),
    packet_path: path.resolve(repoRoot, options.packetPath ?? defaults.packetPath),
    packet_boundary_path: path.resolve(repoRoot, options.packetBoundaryPath ?? defaults.packetBoundaryPath),
    dispatch_metadata_path: path.resolve(repoRoot, options.dispatchMetadataPath ?? defaults.dispatchMetadataPath),
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
  return { path: sourceId, available: String(text ?? "").length > 0, text: String(text ?? "") };
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
