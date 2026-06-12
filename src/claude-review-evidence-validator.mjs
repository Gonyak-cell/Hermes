import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CLAUDE_REVIEW_EVIDENCE_VALIDATOR_OUT_DIR = "artifacts/claude-review-evidence-validator/latest";

const COMMAND_NAME = "factory:claude-review-evidence";
const SCHEMA_VERSION = "claude-review-evidence-validation.v1";
const CAPABILITY_ID = "factory.claude_review_evidence_validation";
const DEFAULT_REVIEW_ID = "claude-review";
const DEFAULT_PROGRAM_RANGE = "factory-promotion";
const HASH_RE = /^[a-f0-9]{64}$/;

const FINAL_APPROVAL_FIELDS = [
  "is_final_approval",
  "reviewer_final_approval_allowed",
  "claude_final_approval_allowed",
  "final_approval_allowed",
  "protected_closeout_allowed",
];

const PRODUCTION_TRUST_FIELDS = [
  "is_production_pass",
  "production_pass_enabled",
  "production_pass_allowed",
  "is_enterprise_pass",
  "enterprise_pass_enabled",
  "enterprise_pass_allowed",
];

const MUTATION_FIELDS = [
  "source_mutation_performed",
  "source_mutation_allowed",
  "mutation_performed",
  "file_mutation_performed",
  "patch_applied",
  "tools_used_to_mutate_source",
];

export async function runClaudeReviewEvidenceValidator(options = {}) {
  const result = await buildClaudeReviewEvidenceValidator(options);
  if (options.write !== false) await writeClaudeReviewEvidenceValidator(result, result.output_dir);
  if ((options.check || options.requireValid) && !result.validation.valid) {
    const error = new Error(`Claude review evidence validation failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildClaudeReviewEvidenceValidator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLAUDE_REVIEW_EVIDENCE_VALIDATOR_OUT_DIR);
  const reviewId = options.reviewId ?? DEFAULT_REVIEW_ID;
  const programRange = options.programRange ?? DEFAULT_PROGRAM_RANGE;
  const rawReview = Object.prototype.hasOwnProperty.call(options, "rawReview")
    ? normalizeInlineJsonSource("inline.claude_review_raw", options.rawReview)
    : await readJsonSource(options.rawReviewPath ?? "artifacts/factory-promotion/fb3-review/claude-opus-max-review.raw.json");
  const prompt = options.promptPath ? await readTextSource(options.promptPath) : emptyTextSource();
  const reviewPayload = extractReviewPayload(rawReview);
  const rows = buildValidationRows({ rawReview, prompt, reviewPayload, generatedAt });
  const validation = summarizeValidation(rows);
  const summary = buildSummary({ reviewId, programRange, rawReview, prompt, reviewPayload, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    review_id: reviewId,
    program_range: programRange,
    output_dir: outputDir,
    source_refs: {
      raw_review_path: rawReview.path,
      prompt_path: prompt.available ? prompt.path : null,
    },
    raw_review_sha256: rawReview.sha256,
    prompt_sha256: prompt.sha256,
    extracted_review_payload: reviewPayload.payload,
    validation_items: rows,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeClaudeReviewEvidenceValidator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "claude-review-evidence-validation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("claude-review-evidence-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeJson(path.join(outDir, "extracted-review-payload.json"), result.extracted_review_payload ?? {});
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runClaudeReviewEvidenceValidatorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runClaudeReviewEvidenceValidator(args);
    console.log(`Claude review evidence validation written at ${result.output_dir}`);
    console.log(`Review id: ${result.summary.review_id}`);
    console.log(`Status: ${result.summary.evidence_status}`);
    console.log(`Evidence valid: ${result.summary.evidence_valid}`);
    console.log(`Verdict: ${result.summary.review_verdict}`);
    console.log(`Blocking findings: ${result.summary.blocking_finding_count}`);
    console.log(`Invalid reasons: ${result.summary.invalid_reason_ids.join(", ") || "none"}`);
    console.log(`Validation errors: ${result.validation.error_count}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildValidationRows({ rawReview, prompt, reviewPayload, generatedAt }) {
  const payload = reviewPayload.payload ?? {};
  const verdict = normalizeVerdict(payload);
  const blockingFindings = normalizeBlockingFindings(payload);
  return [
    item("raw.available", "raw_capture", rawReview.available, "Raw Claude review artifact is available", rawReview.path, generatedAt),
    item("raw.non_empty", "raw_capture", rawReview.text.trim().length > 0, "Raw Claude review artifact is non-empty", rawReview.path, generatedAt),
    item("raw.wrapper_json_valid", "raw_capture", rawReview.validJson, "Raw Claude review artifact is valid JSON", rawReview.path, generatedAt),
    item("raw.sha256_bound", "raw_capture", HASH_RE.test(rawReview.sha256 ?? ""), "Raw Claude review artifact has a SHA-256 digest", rawReview.path, generatedAt, { sha256: rawReview.sha256 }),
    item("raw.wrapper_success", "raw_capture", rawReview.data?.type === "result" && rawReview.data?.subtype === "success" && rawReview.data?.is_error === false, "Claude CLI wrapper must be a non-error result success", rawReview.path, generatedAt, { api_error_status: rawReview.data?.api_error_status ?? null }),
    item("raw.not_auth_failure", "raw_capture", !containsAuthFailure(rawReview.text), "Raw output must not be an auth or login failure", rawReview.path, generatedAt),
    item("raw.not_quota_limited", "raw_capture", !containsQuotaLimit(rawReview.text), "Raw output must not be a quota or usage-limit failure", rawReview.path, generatedAt),
    item("raw.not_interrupted", "raw_capture", !containsInterrupted(rawReview.text), "Raw output must not be interrupted, cancelled, or PTY-loss shaped", rawReview.path, generatedAt),
    item("raw.not_tool_call_shaped", "raw_capture", !isToolCallShaped(rawReview.data?.result), "Raw output must not be only a tool-call-shaped payload", rawReview.path, generatedAt),
    item("raw.model_usage_observed", "raw_capture", Object.keys(rawReview.data?.modelUsage ?? {}).length > 0, "Claude model usage must be observed in raw output", rawReview.path, generatedAt),
    item("prompt.sha256_bound", "prompt_capture", !prompt.available || HASH_RE.test(prompt.sha256 ?? ""), "Prompt SHA-256 is bound when a prompt path is provided", prompt.path, generatedAt, { sha256: prompt.sha256 }),
    item("payload.extracted", "review_payload", reviewPayload.validJson, "Review JSON payload must be extracted from raw result", reviewPayload.evidenceRef, generatedAt, { error: reviewPayload.error ?? null }),
    item("payload.verdict_present", "review_payload", typeof verdict === "string" && verdict.length > 0, "Review verdict must be present", reviewPayload.evidenceRef, generatedAt, { verdict }),
    item("payload.blocking_findings_array", "review_payload", Array.isArray(blockingFindings), "blocking_findings must be an array for factory review evidence", reviewPayload.evidenceRef, generatedAt, { blocking_finding_count: Array.isArray(blockingFindings) ? blockingFindings.length : null }),
    item("payload.non_blocking_findings_array", "review_payload", payload.non_blocking_findings === undefined || Array.isArray(payload.non_blocking_findings), "non_blocking_findings must be an array when present", reviewPayload.evidenceRef, generatedAt),
    item("payload.no_final_approval", "authority", !hasTrueField(payload, FINAL_APPROVAL_FIELDS), "Review payload must not claim final or protected closeout approval", reviewPayload.evidenceRef, generatedAt),
    item("payload.no_production_or_enterprise_pass", "authority", !hasTrueField(payload, PRODUCTION_TRUST_FIELDS), "Review payload must not claim production or enterprise PASS", reviewPayload.evidenceRef, generatedAt),
    item("payload.no_source_mutation", "authority", !hasTrueField(payload, MUTATION_FIELDS), "Review payload must not claim source mutation or patch application", reviewPayload.evidenceRef, generatedAt),
  ];
}

function buildSummary({ reviewId, programRange, rawReview, prompt, reviewPayload, validation }) {
  const payload = reviewPayload.payload ?? {};
  const verdict = normalizeVerdict(payload);
  const blockingFindings = normalizeBlockingFindings(payload);
  const invalidReasonIds = validation.errors.map((error) => error.item_id);
  return {
    review_id: reviewId,
    program_range: programRange,
    evidence_status: validation.valid ? "valid_review_evidence" : "invalid_not_review_evidence",
    evidence_valid: validation.valid,
    raw_review_path: rawReview.path,
    raw_review_sha256: rawReview.sha256,
    prompt_path: prompt.available ? prompt.path : null,
    prompt_sha256: prompt.sha256,
    wrapper_session_id: rawReview.data?.session_id ?? null,
    wrapper_result_uuid: rawReview.data?.uuid ?? null,
    wrapper_api_error_status: rawReview.data?.api_error_status ?? null,
    model_usage_keys: Object.keys(rawReview.data?.modelUsage ?? {}),
    review_verdict: verdict,
    blocking_finding_count: Array.isArray(blockingFindings) ? blockingFindings.length : null,
    non_blocking_finding_count: Array.isArray(payload.non_blocking_findings) ? payload.non_blocking_findings.length : null,
    changes_required_before_commit: typeof payload.changes_required_before_commit === "boolean" ? payload.changes_required_before_commit : null,
    invalid_reason_ids: invalidReasonIds,
    counts_as_independent_review_evidence: validation.valid,
    claude_final_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.error_count,
  };
}

function extractReviewPayload(rawReview) {
  const evidenceRef = rawReview.path;
  const structuredOutput = rawReview.data?.structured_output;
  if (structuredOutput && typeof structuredOutput === "object" && !Array.isArray(structuredOutput)) {
    return { validJson: true, payload: structuredOutput, evidenceRef };
  }
  const resultValue = rawReview.data?.result;
  if (resultValue && typeof resultValue === "object" && !Array.isArray(resultValue)) {
    return { validJson: true, payload: resultValue, evidenceRef };
  }
  const resultText = String(resultValue ?? "");
  const fenced = resultText.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : resultText.trim().startsWith("{") ? resultText.trim() : "";
  if (!jsonText) return { validJson: false, payload: null, evidenceRef, error: "review_json_payload_missing" };
  try {
    return { validJson: true, payload: JSON.parse(jsonText), evidenceRef };
  } catch (error) {
    return { validJson: false, payload: null, evidenceRef, error: error.message };
  }
}

function normalizeVerdict(payload) {
  return typeof payload?.verdict === "string" ? payload.verdict : payload?.overall_verdict;
}

function normalizeBlockingFindings(payload) {
  if (Array.isArray(payload?.blocking_findings)) return payload.blocking_findings;
  return null;
}

function containsAuthFailure(text) {
  return /not logged in|please run \/login|authentication failed|api key missing|oauth|unauthorized/i.test(String(text ?? ""));
}

function containsQuotaLimit(text) {
  return /out of extra usage|usage limit|rate limit|quota|api_error_status"\s*:\s*429/i.test(String(text ?? ""));
}

function containsInterrupted(text) {
  const value = String(text ?? "");
  return /\b(?:process|request|operation|run|review|command|session)\s+(?:was\s+)?(?:interrupted|cancelled|canceled)\b/i.test(value)
    || /\b(?:interrupted|cancelled|canceled)\s+(?:by|due to|because|while|during)\b/i.test(value)
    || /\bpty\s+(?:lost|closed|disconnected)\b|\bstdout\s+loss\b|\bconnection\s+lost\b/i.test(value);
}

function isToolCallShaped(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /"tool_use"|"tool_calls"|"recipient_name"|"input"\s*:\s*\{/.test(text) && !/"verdict"|"overall_verdict"/.test(text);
}

function hasTrueField(payload, fields) {
  return fields.some((field) => payload?.[field] === true);
}

function item(itemId, category, pass, message, evidenceRef, generatedAt, extra = {}) {
  return {
    schema_version: "claude-review-evidence-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    ...withoutUndefined(extra),
  };
}

function summarizeValidation(items) {
  const errors = items.filter((entry) => entry.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, validJson: true, data: JSON.parse(text), text, sha256: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, validJson: false, data: null, text: "", error: error.message, sha256: null };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, sha256: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message, sha256: null };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  const text = data === null || data === undefined ? "" : JSON.stringify(data);
  return { path: sourceId, available: data !== null && data !== undefined, validJson: data !== null && data !== undefined, data, text, sha256: text ? sha256(text) : null };
}

function emptyTextSource() {
  return { path: null, available: false, text: "", sha256: null };
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
    else if (arg === "--require-valid") args.requireValid = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--raw-review") args.rawReviewPath = argv[++index];
    else if (arg === "--prompt") args.promptPath = argv[++index];
    else if (arg === "--review-id") args.reviewId = argv[++index];
    else if (arg === "--program-range") args.programRange = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/claude-review-evidence-validator.mjs [options]

Options:
  --raw-review <path>     Raw Claude --output-format json artifact.
  --prompt <path>         Optional prompt artifact to hash-bind.
  --review-id <id>        Review identifier.
  --program-range <id>    Program or tranche range.
  --out-dir <path>        Output artifact directory.
  --check                 Fail when the raw artifact is not valid review evidence.
  --require-valid         Alias for requiring valid review evidence.
  --no-write              Validate without writing output artifacts.
  --run-at <iso>          Deterministic timestamp.
  -h, --help              Show this help.
`);
}

function renderMarkdown(result) {
  return [
    "# Claude Review Evidence Validation",
    "",
    `- review_id: ${result.summary.review_id}`,
    `- status: ${result.summary.evidence_status}`,
    `- evidence_valid: ${result.summary.evidence_valid}`,
    `- verdict: ${result.summary.review_verdict}`,
    `- blocking_finding_count: ${result.summary.blocking_finding_count}`,
    `- invalid_reason_ids: ${result.summary.invalid_reason_ids.join(", ") || "none"}`,
    `- raw_review_sha256: ${result.summary.raw_review_sha256}`,
    `- prompt_sha256: ${result.summary.prompt_sha256 ?? "none"}`,
    "",
  ].join("\n");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runClaudeReviewEvidenceValidatorCli();
}
