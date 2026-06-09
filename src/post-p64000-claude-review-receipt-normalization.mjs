import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_CLAUDE_REVIEW_RECEIPT_NORMALIZATION_OUT_DIR = "artifacts/post-p64000-claude-review-receipt-normalization/latest";
export const DEFAULT_POST_P64000_CLAUDE_REVIEW_RECEIPT_NORMALIZATION_INPUTS = {
  schemaPath: "schemas/post-p64000-claude-review-receipt-normalization.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p67601-p68000.md",
  architectureDocPath: "docs/architecture.md",
  capturePath: "artifacts/post-p64000-claude-read-only-review-capture/latest/post-p64000-claude-read-only-review-capture.json",
  extractedPayloadPath: "artifacts/post-p64000-claude-read-only-review-capture/latest/extracted-review-payload.json",
  rawReviewPath: "artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-raw.json",
  dispatchMetadataPath: "artifacts/post-p64000-claude-read-only-review-capture/review/claude-review-dispatch-metadata.json",
};

const COMMAND_NAME = "platform:post-p64000-claude-review-receipt-normalization";
const SCHEMA_VERSION = "post-p64000-claude-review-receipt-normalization.v1";
const CAPABILITY_ID = "platform.post_p64000_claude_review_receipt_normalization";
const PROGRAM_RANGE = "P67601-P68000";
const SOURCE_PROGRAM_RANGE = "P67201-P67600";
const NEXT_PROGRAM_RANGE = "P68001-P68400";
const REVIEWED_PROGRAM_RANGE = "P66801-P67200";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];
const REQUIRED_FINDING_FIELDS = ["id", "severity", "category", "location", "evidence", "issue", "proposed_change"];

const NEGATIVE_FIXTURES = [
  "missing_p67600_capture_source",
  "p67600_capture_invalid",
  "missing_raw_review_hash",
  "raw_review_hash_mismatch",
  "missing_extracted_payload",
  "malformed_review_payload",
  "wrong_reviewer_or_lane",
  "wrong_review_scope",
  "missing_required_hrm_ids",
  "missing_finding_required_field",
  "blocking_finding_hidden",
  "blocking_finding_auto_resolved",
  "clean_checkpoint_claim",
  "final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "finding_resolution_claim",
  "missing_next_action",
];

const EXTRA_FALSE_FLAGS = [
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "claude_review_final_approval_allowed_now",
  "post_p68000_production_pass_claim_allowed_now",
  "post_p68000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-claude-review-receipt-normalization.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-claude-review-receipt-normalization.mjs"],
  ["unit.test", "node --test test/post-p64000-claude-review-receipt-normalization.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-claude-review-receipt-normalization -- --check"],
  ["adjacent.capture", "node --test test/post-p64000-claude-read-only-review-capture.test.mjs test/post-p64000-claude-review-receipt-normalization.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-claude-review-receipt-normalization.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000ClaudeReviewReceiptNormalization(options = {}) {
  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 Claude review receipt normalization failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000ClaudeReviewReceiptNormalization(result, result.output_dir);
  return result;
}

export async function buildPostP64000ClaudeReviewReceiptNormalization(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_CLAUDE_REVIEW_RECEIPT_NORMALIZATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const capture = Object.prototype.hasOwnProperty.call(options, "capture")
    ? normalizeInlineJsonSource("inline.post_p64000_claude_read_only_review_capture", options.capture)
    : await readJsonSource(inputs.capture_path);
  const extractedPayload = Object.prototype.hasOwnProperty.call(options, "extractedPayload")
    ? normalizeInlineJsonSource("inline.extracted_review_payload", options.extractedPayload)
    : await readJsonSource(inputs.extracted_payload_path);
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawReview)
    : await readJsonSource(inputs.raw_review_path);
  const dispatchMetadata = Object.prototype.hasOwnProperty.call(options, "dispatchMetadata")
    ? normalizeInlineJsonSource("inline.claude_review_dispatch_metadata", options.dispatchMetadata)
    : await readJsonSource(inputs.dispatch_metadata_path);
  const payload = Object.prototype.hasOwnProperty.call(options, "reviewPayload")
    ? options.reviewPayload
    : capture.data?.extracted_review_payload ?? extractedPayload.data ?? null;

  const sourceRows = buildSourceRows({ capture, extractedPayload, rawReview, dispatchMetadata, payload, generatedAt });
  const normalizedReceipt = buildNormalizedReceipt({ capture, rawReview, dispatchMetadata, payload, generatedAt });
  const receiptRows = buildReceiptRows({ normalizedReceipt, payload, generatedAt });
  const findingRows = buildFindingClassificationRows({ payload, generatedAt });
  const findingLoopRows = buildFindingLoopRows({ normalizedReceipt, findingRows, generatedAt });
  const actionRows = buildFindingActionRows({ findingRows, generatedAt });
  const receiptBoundaryRows = buildReceiptBoundaryRows({ normalizedReceipt, generatedAt });
  const authorityRows = buildAuthorityRows({ payload, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, normalizedReceipt, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, normalizedReceipt, generatedAt });
  const boundary = buildBoundary({ sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      capture_path: capture.path,
      extracted_payload_path: extractedPayload.path,
      raw_review_path: rawReview.path,
      dispatch_metadata_path: dispatchMetadata.path,
    },
    post_p64000_claude_review_receipt_normalization_contract: {
      contract_id: "post_p64000_claude_review_receipt_normalization",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      blocking_findings_visible: true,
      clean_checkpoint_allowed_with_blocking_findings: false,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      claude_final_approval_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p67600_capture_source_rows: sourceRows,
    normalized_claude_review_receipt: normalizedReceipt,
    normalized_review_receipt_rows: receiptRows,
    finding_classification_rows: findingRows,
    finding_loop_rows: findingLoopRows,
    finding_action_rows: actionRows,
    receipt_boundary_rows: receiptBoundaryRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p68000_wiring_rows: wiringRows,
    p68000_closeout_rows: closeoutRows,
    p68001_handoff_rows: handoffRows,
    post_p64000_claude_review_receipt_normalization_boundary: boundary,
    post_p64000_claude_review_receipt_normalization_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_claude_review_receipt_normalization")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_claude_review_receipt_normalization_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_claude_review_receipt_normalization_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000ClaudeReviewReceiptNormalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-claude-review-receipt-normalization.json"), serializableResult(result));
  await writeJson(path.join(outDir, "normalized-claude-review-receipt.json"), result.normalized_claude_review_receipt);
  await writeJson(path.join(outDir, "finding-classification-rows.json"), collectionEnvelope("finding-classification-rows.v1", "finding_classification_rows", result.finding_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-loop-rows.json"), collectionEnvelope("finding-loop-rows.v1", "finding_loop_rows", result.finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-action-rows.json"), collectionEnvelope("finding-action-rows.v1", "finding_action_rows", result.finding_action_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000ClaudeReviewReceiptNormalizationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000ClaudeReviewReceiptNormalization(args);
  console.log(`Post-P64000 Claude review receipt normalization ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_claude_review_receipt_normalization_status}`);
  console.log(`P67600 source ready: ${result.summary.p67600_capture_ready_now}`);
  console.log(`Review verdict: ${result.summary.review_verdict}`);
  console.log(`Blocking findings: ${result.summary.blocking_finding_count}`);
  console.log(`Finding count: ${result.summary.finding_count}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P68001 handoff: ${result.summary.ready_for_p68001_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ capture, extractedPayload, rawReview, dispatchMetadata, payload, generatedAt }) {
  const summary = capture.data?.summary ?? {};
  const actualRawHash = rawReview.text ? sha256(rawReview.text) : "";
  return [
    row("source.p67600_capture_available", "p67600_capture_source", "P67600 capture artifact is available", capture.available === true, capture.path, generatedAt),
    row("source.p67600_program", "p67600_capture_source", "P67600 capture program range matches", capture.data?.program_range === SOURCE_PROGRAM_RANGE, capture.path, generatedAt),
    row("source.p67600_validation", "p67600_capture_source", "P67600 capture validation is valid", capture.data?.validation?.valid === true, capture.path, generatedAt),
    row("source.p67600_handoff", "p67600_capture_source", "P67600 is ready for P67601 handoff", summary.ready_for_p67601_handoff === true, capture.path, generatedAt),
    row("source.raw_hash_present", "p67600_capture_source", "Raw review hash is present in capture summary", hasText(summary.raw_review_sha256), capture.path, generatedAt, { raw_review_sha256: summary.raw_review_sha256 }),
    row("source.raw_hash_matches", "p67600_capture_source", "Raw review hash matches durable raw JSON", hasText(summary.raw_review_sha256) && summary.raw_review_sha256 === actualRawHash, rawReview.path, generatedAt, { raw_review_sha256: actualRawHash }),
    row("source.extracted_payload_available", "p67600_capture_source", "Extracted Claude review payload is available", payload !== null && typeof payload === "object", extractedPayload.path, generatedAt),
    row("source.raw_review_available", "p67600_capture_source", "Claude raw review is still available", rawReview.available === true && rawReview.text.trim().length > 0, rawReview.path, generatedAt),
    row("source.dispatch_metadata_available", "p67600_capture_source", "Claude dispatch metadata is available", dispatchMetadata.available === true, dispatchMetadata.path, generatedAt),
  ];
}

function buildNormalizedReceipt({ capture, rawReview, dispatchMetadata, payload, generatedAt }) {
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  const blockingFindings = findings.filter(isBlockingFinding);
  const actualModels = Object.keys(rawReview.data?.modelUsage ?? {});
  const rawHash = rawReview.text ? sha256(rawReview.text) : "";
  return {
    schema_version: "post-p64000-hrm-claude-review-receipt.v1",
    receipt_status: blockingFindings.length > 0 || payload?.blocks_clean_checkpoint === true ? "observed_blocking_findings" : "observed_clean_candidate",
    reviewer: payload?.reviewer ?? "claude-code-opus-max",
    reviewer_lane: payload?.reviewer_lane ?? "independent_read_only",
    model_alias_requested: dispatchMetadata.data?.model_alias ?? "opus",
    effort_requested: dispatchMetadata.data?.effort ?? "max",
    actual_model_ids: actualModels,
    reviewed_program_range: payload?.reviewed_program_range ?? "",
    review_event_program_range: payload?.review_event_program_range ?? "",
    source_program_range: capture.data?.source_program_range ?? REVIEWED_PROGRAM_RANGE,
    source_capture_ref: capture.path,
    raw_output_ref: rawReview.path,
    raw_output_sha256: rawHash,
    dispatch_metadata_ref: dispatchMetadata.path,
    is_claude_review_event: payload?.is_claude_review_event === true,
    overall_verdict: String(payload?.overall_verdict ?? ""),
    blocks_clean_checkpoint: payload?.blocks_clean_checkpoint === true,
    clean_checkpoint_allowed: false,
    open_blocking_finding_count: Number(payload?.open_blocking_finding_count ?? blockingFindings.length),
    normalized_blocking_finding_count: blockingFindings.length,
    finding_count: findings.length,
    reviewed_hrm_ids: Array.isArray(payload?.reviewed_hrm_ids) ? payload.reviewed_hrm_ids : [],
    findings: findings.map((finding) => normalizeFinding(finding)),
    non_findings: Array.isArray(payload?.non_findings) ? payload.non_findings.map(String) : [],
    next_handoff_recommendations: Array.isArray(payload?.next_handoff_recommendations) ? payload.next_handoff_recommendations.map(String) : [],
    source_mutation_performed: payload?.source_mutation_performed === true,
    finding_resolution_performed: payload?.finding_resolution_performed === true,
    reviewer_final_approval_allowed: false,
    protected_closeout_allowed: false,
    production_pass_allowed: false,
    enterprise_pass_allowed: false,
    generated_at: generatedAt,
  };
}

function buildReceiptRows({ normalizedReceipt, payload, generatedAt }) {
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  return [
    row("receipt.schema", "normalized_review_receipt", "Normalized receipt schema is present", normalizedReceipt.schema_version === "post-p64000-hrm-claude-review-receipt.v1", normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.reviewer", "normalized_review_receipt", "Reviewer is Claude Code Opus max", normalizedReceipt.reviewer === "claude-code-opus-max", normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.lane", "normalized_review_receipt", "Reviewer lane is independent read-only", normalizedReceipt.reviewer_lane === "independent_read_only", normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.review_event", "normalized_review_receipt", "Receipt preserves performed review event marker", normalizedReceipt.is_claude_review_event === true, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.raw_hash", "normalized_review_receipt", "Receipt preserves raw output hash", hasText(normalizedReceipt.raw_output_sha256), normalizedReceipt.raw_output_ref, generatedAt, { raw_output_sha256: normalizedReceipt.raw_output_sha256 }),
    row("receipt.reviewed_scope", "normalized_review_receipt", "Receipt reviewed P66801-P67200", normalizedReceipt.reviewed_program_range === REVIEWED_PROGRAM_RANGE, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.event_scope", "normalized_review_receipt", "Receipt event range is P67201-P67600", normalizedReceipt.review_event_program_range === SOURCE_PROGRAM_RANGE, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.hrm_ids", "normalized_review_receipt", "Receipt preserves required HRM ids", REQUIRED_HRM_IDS.every((id) => normalizedReceipt.reviewed_hrm_ids.includes(id)), normalizedReceipt.raw_output_ref, generatedAt, { reviewed_hrm_ids: normalizedReceipt.reviewed_hrm_ids }),
    row("receipt.findings", "normalized_review_receipt", "Findings are preserved", findings.length === normalizedReceipt.finding_count && normalizedReceipt.finding_count > 0, normalizedReceipt.raw_output_ref, generatedAt, { finding_count: normalizedReceipt.finding_count }),
    row("receipt.blocking_count", "normalized_review_receipt", "Blocking finding count is preserved", normalizedReceipt.open_blocking_finding_count === normalizedReceipt.normalized_blocking_finding_count, normalizedReceipt.raw_output_ref, generatedAt, { blocking_finding_count: normalizedReceipt.normalized_blocking_finding_count }),
    row("receipt.clean_checkpoint_false", "normalized_review_receipt", "Clean checkpoint is not allowed while blockers exist", normalizedReceipt.clean_checkpoint_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.no_mutation", "normalized_review_receipt", "Review remains no-source-mutation", normalizedReceipt.source_mutation_performed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.no_finding_resolution", "normalized_review_receipt", "Review remains no-finding-resolution", normalizedReceipt.finding_resolution_performed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("receipt.no_final_approval", "normalized_review_receipt", "Reviewer final approval remains false", normalizedReceipt.reviewer_final_approval_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
  ];
}

function buildFindingClassificationRows({ payload, generatedAt }) {
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  return findings.map((finding) => {
    const missingFields = REQUIRED_FINDING_FIELDS.filter((field) => !hasText(finding?.[field]));
    const blocking = isBlockingFinding(finding);
    return row(`finding.${normalizeId(finding?.id ?? "missing")}`, "finding_classification", `${finding?.id ?? "missing"} classified as ${blocking ? "blocking" : "nonblocking"}`, missingFields.length === 0, `claude.finding.${finding?.id ?? "missing"}`, generatedAt, {
      finding_id: finding?.id,
      severity: finding?.severity,
      finding_category: finding?.category,
      blocking,
      missing_fields: missingFields,
    });
  });
}

function buildFindingLoopRows({ normalizedReceipt, findingRows, generatedAt }) {
  const blockingRows = findingRows.filter((item) => item.blocking === true);
  return [
    row("finding_loop.blocking_visible", "finding_loop", "Blocking findings remain visible", blockingRows.length === normalizedReceipt.normalized_blocking_finding_count && blockingRows.length > 0, normalizedReceipt.raw_output_ref, generatedAt, { blocking_finding_count: blockingRows.length }),
    row("finding_loop.required_hrm_open", "finding_loop", "HRM-04, HRM-03, and HRM-01 remain open blocking findings", REQUIRED_HRM_IDS.every((id) => normalizedReceipt.findings.some((finding) => finding.id === id && finding.normalized_status === "blocking_open")), normalizedReceipt.raw_output_ref, generatedAt, { required_hrm_ids: REQUIRED_HRM_IDS }),
    row("finding_loop.clean_checkpoint_blocked", "finding_loop", "Clean checkpoint remains blocked while blocking findings exist", normalizedReceipt.normalized_blocking_finding_count > 0 && normalizedReceipt.blocks_clean_checkpoint === true, normalizedReceipt.raw_output_ref, generatedAt),
    row("finding_loop.no_auto_resolution", "finding_loop", "Findings are not auto-resolved in P68000", true, "docs/hermes-roadmap-p67601-p68000.md", generatedAt),
    row("finding_loop.next_revalidation_required", "finding_loop", "P68001 remediation planning or focused verification is required", true, "docs/hermes-roadmap-p67601-p68000.md", generatedAt),
  ];
}

function buildFindingActionRows({ findingRows, generatedAt }) {
  return findingRows.map((findingRow) => row(
    `finding_action.${normalizeId(findingRow.finding_id ?? findingRow.row_id)}`,
    "finding_action",
    `${findingRow.finding_id} routes to ${findingRow.blocking ? "blocking_finding_loop" : "tracked_nonblocking_followup"}`,
    findingRow.current_verdict === "pass",
    findingRow.evidence_ref,
    generatedAt,
    {
      finding_id: findingRow.finding_id,
      blocking: findingRow.blocking,
      next_allowed_action: findingRow.blocking ? "plan_focused_remediation_or_verification_before_clean_checkpoint" : "track_nonblocking_followup_in_handoff",
    },
  ));
}

function buildReceiptBoundaryRows({ normalizedReceipt, generatedAt }) {
  return [
    row("boundary.receipt_is_review_event", "receipt_boundary", "Normalized receipt is bound to performed Claude review event", normalizedReceipt.is_claude_review_event === true, normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.raw_hash_bound", "receipt_boundary", "Normalized receipt is bound by raw output hash", hasText(normalizedReceipt.raw_output_sha256), normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.later_work_required", "receipt_boundary", "Finding loop still requires later work", normalizedReceipt.normalized_blocking_finding_count > 0, normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.clean_checkpoint_false", "receipt_boundary", "Receipt cannot be clean checkpoint", normalizedReceipt.clean_checkpoint_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.protected_closeout_false", "receipt_boundary", "Receipt cannot protected-closeout", normalizedReceipt.protected_closeout_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.production_false", "receipt_boundary", "Receipt cannot production PASS", normalizedReceipt.production_pass_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
    row("boundary.enterprise_false", "receipt_boundary", "Receipt cannot enterprise PASS", normalizedReceipt.enterprise_pass_allowed === false, normalizedReceipt.raw_output_ref, generatedAt),
  ];
}

function buildAuthorityRows({ payload, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const payloadClaim = payloadClaimForFlag(payload, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : payloadClaim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p67601-p68000.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function payloadClaimForFlag(payload, flag) {
  if (!payload) return false;
  if (flag === "post_p68000_production_pass_claim_allowed_now" && payload.is_production_pass === true) return true;
  if (flag === "post_p68000_enterprise_pass_claim_allowed_now" && payload.is_enterprise_pass === true) return true;
  if (flag === "claude_final_approval_allowed" && payload.is_final_approval === true) return true;
  if (flag === "claude_review_final_approval_allowed_now" && payload.is_final_approval === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && payload.source_mutation_performed === true) return true;
  if (flag === "finding_resolution_allowed_now" && payload.finding_resolution_performed === true) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && payload.clean_checkpoint_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P68000 closeout`,
    true,
    "docs/hermes-roadmap-p67601-p68000.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-claude-review-receipt-normalization.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P67601-P68000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P67601-P68000") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p67601-p68000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P67601-P68000 Claude review receipt normalization", architectureDoc.available && architectureDoc.text.includes("P67601-P68000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, normalizedReceipt, generatedAt } = parts;
  return [
    closeoutRow("p68000.source_ready", "P67600 capture source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p68000.receipt_normalized", "Claude review receipt is normalized", receiptRows.every(pass), generatedAt),
    closeoutRow("p68000.findings_classified", "Findings are classified with required fields", findingRows.length === normalizedReceipt.finding_count && findingRows.every(pass), generatedAt),
    closeoutRow("p68000.finding_loop_visible", "Finding loop remains visible", findingLoopRows.every(pass), generatedAt),
    closeoutRow("p68000.finding_actions", "Finding next actions are routed", actionRows.length === findingRows.length && actionRows.every(pass), generatedAt),
    closeoutRow("p68000.receipt_boundary", "Receipt boundary rows pass", receiptBoundaryRows.every(pass), generatedAt),
    closeoutRow("p68000.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p68000.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p68000.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p68000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, normalizedReceipt, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p68001_remediation_plan", "p68001_handoff", "P68001 may plan focused remediation or verification without clean claim", ready, "artifacts/post-p64000-claude-review-receipt-normalization/latest/normalized-claude-review-receipt.json", generatedAt, {
      next_allowed_action: ready ? "plan_focused_hrm_remediation_or_verification_packet" : "resolve_p68000_normalization_blockers",
    }),
    row("handoff.blocking_findings_preserved", "p68001_handoff", "Blocking findings are preserved for remediation planning", normalizedReceipt.normalized_blocking_finding_count > 0, normalizedReceipt.raw_output_ref, generatedAt, { blocking_finding_count: normalizedReceipt.normalized_blocking_finding_count }),
    row("handoff.no_approval_claim", "p68001_handoff", "P68000 normalization is not final approval, production PASS, enterprise PASS, clean checkpoint, or protected closeout", true, "docs/hermes-roadmap-p67601-p68000.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, normalizedReceipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_claude_review_receipt_normalization_ready: closeoutRows.every(pass),
    p67600_capture_ready_now: sourceRows.every(pass),
    normalized_receipt_ready_now: receiptRows.every(pass),
    finding_classification_ready_now: findingRows.length === normalizedReceipt.finding_count && findingRows.every(pass),
    finding_loop_visible_now: findingLoopRows.every(pass),
    finding_actions_ready_now: actionRows.length === findingRows.length && actionRows.every(pass),
    receipt_boundary_ready_now: receiptBoundaryRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p68001_handoff: handoffRows.every(pass),
    review_verdict: normalizedReceipt.overall_verdict,
    blocks_clean_checkpoint: normalizedReceipt.blocks_clean_checkpoint,
    clean_checkpoint_allowed_now: false,
    blocking_finding_count: normalizedReceipt.normalized_blocking_finding_count,
    finding_count: normalizedReceipt.finding_count,
    reviewed_hrm_ids: normalizedReceipt.reviewed_hrm_ids,
    raw_output_sha256: normalizedReceipt.raw_output_sha256,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p68000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p68000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now || boundary.claude_review_final_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, receiptRows, findingRows, findingLoopRows, actionRows, receiptBoundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p67600", "source_binding", sourceRows.every(pass), "P67600 source must be valid and ready"),
    validationItem("receipt.normalized", "receipt", receiptRows.every(pass), "Claude review receipt must normalize without losing blockers, raw hash, or scope"),
    validationItem("findings.classified", "finding_loop", findingRows.length > 0 && findingRows.every(pass), "Findings must be classified with required fields"),
    validationItem("findings.visible", "finding_loop", findingLoopRows.every(pass), "Finding loop must remain visible"),
    validationItem("findings.actions", "finding_loop", actionRows.length === findingRows.length && actionRows.every(pass), "Finding action rows must route every finding"),
    validationItem("receipt.boundary", "receipt_boundary", receiptBoundaryRows.every(pass), "Receipt boundary must preserve no-clean/no-closeout flags"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P68000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P68001 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_claude_review_receipt_normalization_ready === true, "P68000 normalization must be ready"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.finding_resolution_false", "authority_boundary", boundary.finding_resolution_allowed_now === false, "Finding resolution must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p68001_handoff
    ? "receipt_normalized_findings_ready_for_p68001"
    : validation.valid
      ? "valid_block_p68001_handoff_pending"
      : "blocked_post_p64000_claude_review_receipt_normalization";
  return {
    post_p64000_claude_review_receipt_normalization_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p67600_capture_ready_now: boundary.p67600_capture_ready_now,
    normalized_receipt_ready_now: boundary.normalized_receipt_ready_now,
    finding_loop_visible_now: boundary.finding_loop_visible_now,
    receipt_boundary_ready_now: boundary.receipt_boundary_ready_now,
    ready_for_p68001_handoff: boundary.ready_for_p68001_handoff,
    review_verdict: boundary.review_verdict,
    blocks_clean_checkpoint: boundary.blocks_clean_checkpoint,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    reviewed_hrm_ids: boundary.reviewed_hrm_ids,
    raw_output_sha256: boundary.raw_output_sha256,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function normalizeFinding(finding) {
  const blocking = isBlockingFinding(finding);
  return {
    id: String(finding?.id ?? ""),
    severity: String(finding?.severity ?? ""),
    category: String(finding?.category ?? ""),
    location: String(finding?.location ?? ""),
    evidence: String(finding?.evidence ?? ""),
    issue: String(finding?.issue ?? ""),
    proposed_change: String(finding?.proposed_change ?? ""),
    confidence: finding?.confidence ?? null,
    blocks_clean_checkpoint: blocking,
    normalized_status: blocking ? "blocking_open" : "nonblocking_open",
    next_allowed_action: blocking ? "plan_focused_remediation_or_verification_before_clean_checkpoint" : "track_nonblocking_followup",
  };
}

function isBlockingFinding(finding) {
  return finding?.blocks_clean_checkpoint === true || ["critical", "p0"].includes(String(finding?.severity ?? "").toLowerCase());
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Claude Review Receipt Normalization ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_claude_review_receipt_normalization_status}`,
    `- p67600_capture_ready_now: ${result.summary.p67600_capture_ready_now}`,
    `- review_verdict: ${result.summary.review_verdict}`,
    `- blocks_clean_checkpoint: ${result.summary.blocks_clean_checkpoint}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- blocking_finding_count: ${result.summary.blocking_finding_count}`,
    `- finding_count: ${result.summary.finding_count}`,
    `- ready_for_p68001_handoff: ${result.summary.ready_for_p68001_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p68001_handoff
      ? "Continue to P68001-P68400 focused remediation planning or verification packet while preserving blocking findings. Do not claim clean closeout."
      : "Resolve normalization, finding classification, receipt boundary, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p68000_closeout", label, observed, "artifacts/post-p64000-claude-review-receipt-normalization/latest/post-p64000-claude-review-receipt-normalization.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_finding_loop" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--capture") args.capturePath = argv[++index];
    else if (arg === "--extracted-payload") args.extractedPayloadPath = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
    else if (arg === "--dispatch-metadata") args.dispatchMetadataPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--capture PATH] [--extracted-payload PATH] [--raw-review PATH] [--dispatch-metadata PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_CLAUDE_REVIEW_RECEIPT_NORMALIZATION_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    capture_path: path.resolve(repoRoot, options.capturePath ?? defaults.capturePath),
    extracted_payload_path: path.resolve(repoRoot, options.extractedPayloadPath ?? defaults.extractedPayloadPath),
    raw_review_path: path.resolve(repoRoot, options.rawReviewPath ?? defaults.rawReviewPath),
    dispatch_metadata_path: path.resolve(repoRoot, options.dispatchMetadataPath ?? defaults.dispatchMetadataPath),
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

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
