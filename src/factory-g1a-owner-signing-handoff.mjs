import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aFirstUseAuditReadiness } from "./factory-g1a-first-use-audit-readiness.mjs";
import { buildFactoryG1aOpeningCloseoutReadiness } from "./factory-g1a-opening-closeout-readiness.mjs";
import { buildFactoryG1aOpeningPacket } from "./factory-g1a-opening-packet.mjs";
import { buildFactoryG1aOwnerReceiptIntake } from "./factory-g1a-owner-receipt-intake.mjs";
import { buildFactoryG1aSourceLiteralPreflight } from "./factory-g1a-source-literal-preflight.mjs";

export const DEFAULT_FACTORY_G1A_OWNER_SIGNING_HANDOFF_OUT_DIR = "artifacts/factory-g1a-owner-signing-handoff/latest";
export const DEFAULT_FACTORY_G1A_OWNER_SIGNING_HANDOFF_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:g1a-owner-signing-handoff";
const SCHEMA_VERSION = "factory-g1a-owner-signing-handoff.v1";
const CAPABILITY_ID = "factory.g1a_owner_signing_handoff";
const PROGRAM_RANGE = "G-SERIES.1a.owner-signing-handoff";
const READY_STATUS = "ready_g1a_owner_signature_handoff";
const BLOCKED_STATUS = "blocked_g1a_owner_signature_handoff";
const REVIEW_MODEL = "claude-opus-4-8";
const REVIEW_EFFORT = "max";
const WAITING_RECEIPT_STATUS = "waiting_for_signed_g1a_owner_receipt";
const WAITING_FIRST_USE_STATUS = "waiting_for_g1a_first_use_audit";
const WAITING_OPENING_STATUS = "waiting_for_g1a_opening_source_literal_commit";
const WAITING_FIRST_USE_CANDIDATE_STATUS = "waiting_for_g1a_first_use_audit_candidate";
const SOURCE_LITERAL_APPLIED_STATUS = "source_literal_opening_commit_already_applied";
const CLOSEOUT_READY_STATUS = "ready_g1a_opening_closeout_for_owner_adjudication";
const FIRST_USE_ALREADY_BOUND_STATUS = "g1a_first_use_audit_already_bound";

const CLOSED_AUTHORITY_FLAGS = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  command_execution_enabled: false,
  command_execution_allowed_now: false,
  work_packet_execution_allowed_now: false,
  work_item_execution_allowed_now: false,
  validation_loop_execution_allowed_now: false,
  worker_execution_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

const OWNER_COMPLETION_ITEMS = [
  ["select_one_candidate_manifest_or_packet_hash", "Owner must bind exactly one candidate manifest SHA-256 or candidate packet SHA-256 before signing."],
  ["confirm_independent_review_receipt", "Owner must confirm the referenced Claude Opus review evidence is valid independent review evidence, not final approval."],
  ["sign_gate_opening_receipt", "Owner must set receipt_status=signed, human_owner_signed=true, owner_name, owner_signed_at, and owner_decision=approve_g1a_opening."],
  ["run_owner_receipt_intake", "Operator must rerun factory:g1a-owner-receipt-intake with the signed receipt path."],
  ["run_source_literal_preflight", "Operator must rerun factory:g1a-source-literal-preflight with the signed receipt path."],
  ["apply_isolated_source_literal_commit", "Operator may apply only the reviewed isolated G1a source-literal opening commit after signed receipt intake passes."],
  ["capture_first_use_audit", "Operator must capture the first-use audit after the first project workspace creation."],
];

export async function runFactoryG1aOwnerSigningHandoff(options = {}) {
  const result = await buildFactoryG1aOwnerSigningHandoff(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOwnerSigningHandoff(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Owner Signing Handoff failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_owner_signing_handoff_status !== READY_STATUS) {
    const error = new Error("Factory G1a Owner Signing Handoff is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOwnerSigningHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OWNER_SIGNING_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = Object.prototype.hasOwnProperty.call(options, "structuredSummary")
    ? normalizeInlineJsonSource("inline.structured_summary", options.structuredSummary)
    : await readJsonSource(inputs.structured_summary_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const sharedOptions = { ...options, repoRoot: inputs.repo_root, structuredSummary: structuredSummary.data, runAt: generatedAt, commitRef, write: false };
  const openingPacket = Object.prototype.hasOwnProperty.call(options, "openingPacket")
    ? normalizeInlineBuiltSource("inline.g1a_opening_packet", options.openingPacket)
    : normalizeInlineBuiltSource("built.g1a_opening_packet", await buildFactoryG1aOpeningPacket(sharedOptions));
  const signableReceiptDraft = buildSignableOwnerReceiptDraft({
    openingPacket: openingPacket.data,
    structuredSummary: structuredSummary.data,
    commitRef,
    generatedAt,
    options,
  });
  const ownerReceiptIntake = await buildFactoryG1aOwnerReceiptIntake({
    ...sharedOptions,
    openingPacket: openingPacket.data,
    ownerReceipt: signableReceiptDraft,
  });
  const sourceLiteralPreflight = await buildFactoryG1aSourceLiteralPreflight({
    ...sharedOptions,
    ownerReceipt: signableReceiptDraft,
  });
  const closeoutReadiness = await buildFactoryG1aOpeningCloseoutReadiness({
    ...sharedOptions,
    ownerReceipt: signableReceiptDraft,
  });
  const firstUseAuditReadiness = await buildFactoryG1aFirstUseAuditReadiness({
    ...sharedOptions,
    closeoutReadiness,
  });
  const ownerCompletionChecklist = buildOwnerCompletionChecklist({ generatedAt, signableReceiptDraft });
  const ownerSigningWorkOrder = buildOwnerSigningWorkOrder({
    generatedAt,
    outputDir,
    commitRef,
    signableReceiptDraft,
    ownerReceiptIntake,
    sourceLiteralPreflight,
    closeoutReadiness,
    firstUseAuditReadiness,
    ownerCompletionChecklist,
  });
  const reviewSchema = buildReviewSchema();
  const reviewRequest = buildReviewRequest({ generatedAt, outputDir, commitRef, reviewSchema });
  const independentReviewPacket = buildIndependentReviewPacket({ generatedAt, outputDir, commitRef, reviewRequest });
  const handoffRows = buildHandoffRows({
    packageJson,
    structuredSummary,
    openingPacket: openingPacket.data,
    ownerReceiptIntake,
    sourceLiteralPreflight,
    closeoutReadiness,
    firstUseAuditReadiness,
    signableReceiptDraft,
    ownerCompletionChecklist,
    independentReviewPacket,
    generatedAt,
  });
  const boundary = buildBoundary({ handoffRows, signableReceiptDraft, ownerCompletionChecklist, generatedAt });
  const validationItems = buildValidationItems({ packageJson, handoffRows, boundary, signableReceiptDraft, independentReviewPacket });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ handoffRows, boundary, validation, ownerCompletionChecklist, signableReceiptDraft });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      reviewed_commit_sha: commitRef || null,
      structured_summary_path: structuredSummary.path,
      opening_packet_ref: openingPacket.path,
      signable_owner_receipt_draft_path: relativeArtifactPath(outputDir, "signable-owner-receipt-draft.json"),
      owner_signing_work_order_path: relativeArtifactPath(outputDir, "owner-signing-work-order.json"),
      review_prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    },
    source_summaries: {
      g1a_opening_packet_status: openingPacket.data?.summary?.factory_g1a_opening_packet_status ?? null,
      owner_receipt_intake_status_with_draft: ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status,
      source_literal_preflight_status_with_draft: sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status,
      closeout_readiness_status_with_draft: closeoutReadiness.summary.factory_g1a_opening_closeout_readiness_status,
      first_use_audit_readiness_status: firstUseAuditReadiness.summary.factory_g1a_first_use_audit_readiness_status,
    },
    signable_owner_receipt_draft: signableReceiptDraft,
    owner_completion_checklist: ownerCompletionChecklist,
    owner_signing_work_order: ownerSigningWorkOrder,
    independent_review_packet: independentReviewPacket,
    review_request: reviewRequest,
    review_schema: reviewSchema,
    g1a_owner_signing_handoff_rows: handoffRows,
    factory_g1a_owner_signing_handoff_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    review_prompt: renderReviewPrompt(result),
    markdown: renderMarkdown(result),
  };
}

export async function writeFactoryG1aOwnerSigningHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-owner-signing-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "signable-owner-receipt-draft.json"), result.signable_owner_receipt_draft);
  await writeJson(path.join(outDir, "owner-completion-checklist.json"), result.owner_completion_checklist);
  await writeJson(path.join(outDir, "owner-signing-work-order.json"), result.owner_signing_work_order);
  await writeJson(path.join(outDir, "independent-review-packet.json"), result.independent_review_packet);
  await writeJson(path.join(outDir, "review-request.json"), result.review_request);
  await writeJson(path.join(outDir, "review-schema.json"), result.review_schema);
  await writeJson(path.join(outDir, "handoff-rows.json"), collectionEnvelope("factory-g1a-owner-signing-handoff-rows.v1", "g1a_owner_signing_handoff_rows", result.g1a_owner_signing_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_owner_signing_handoff_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-owner-signing-handoff-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "review-prompt.md"), result.review_prompt, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOwnerSigningHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOwnerSigningHandoff(args);
    console.log(`Factory G1a Owner Signing Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_owner_signing_handoff_status}`);
    console.log(`Owner signature present: ${result.summary.owner_gate_opening_receipt_signed_now}`);
    console.log(`Owner completion items: ${result.summary.owner_completion_required_count}`);
    console.log(`Ready for owner signing: ${result.summary.ready_for_owner_signature_now}`);
    console.log(`G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`);
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
  const defaults = DEFAULT_FACTORY_G1A_OWNER_SIGNING_HANDOFF_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
  };
}

function buildSignableOwnerReceiptDraft({ openingPacket, structuredSummary, commitRef, generatedAt, options }) {
  const template = openingPacket?.owner_gate_opening_receipt_template ?? {};
  const draft = {
    ...template,
    receipt_id: options.receiptId ?? "OWNER-G1A-GATE-OPENING-<owner-assigned-id>",
    receipt_status: "draft_unsigned",
    generated_at: generatedAt,
    reviewed_commit_sha: commitRef || template.reviewed_commit_sha || null,
    independent_review_receipt_ref: structuredSummary?.g1a_claude_code_review_receipt ?? "docs/factory-promotion/g1a-claude-opus-4-8-review-receipt.md",
    human_owner_signature_required: true,
    human_owner_signed: false,
    owner_name: null,
    owner_signed_at: null,
    owner_decision: null,
    candidate_binding_required: true,
    bound_candidate_manifest_sha256: options.boundCandidateManifestSha256 ?? null,
    bound_candidate_packet_sha256: options.boundCandidatePacketSha256 ?? null,
    source_literal_opening_commit_required: true,
    source_literal_opening_commit_sha: null,
    first_use_audit_required: true,
    first_use_audit_ref: null,
    notes: "Owner-completable draft only. The owner must bind a candidate hash and sign this receipt before any isolated G1a source-literal opening commit.",
    ...CLOSED_AUTHORITY_FLAGS,
  };
  delete draft.receipt_template_sha256;
  return { ...draft, draft_receipt_sha256: sha256(canonicalize(draft)) };
}

function buildOwnerCompletionChecklist({ generatedAt, signableReceiptDraft }) {
  const items = OWNER_COMPLETION_ITEMS.map(([itemId, description], index) => ({
    schema_version: "factory-g1a-owner-completion-item.v1",
    item_id: itemId,
    description,
    required: true,
    completed_now: false,
    ordinal: index + 1,
  }));
  const checklist = {
    schema_version: "factory-g1a-owner-completion-checklist.v1",
    checklist_id: "g1a.owner_signature_completion",
    generated_at: generatedAt,
    checklist_status: "owner_action_required",
    signable_receipt_draft_sha256: signableReceiptDraft.draft_receipt_sha256,
    required_item_count: items.length,
    completed_item_count: items.filter((item) => item.completed_now).length,
    items,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...checklist, checklist_sha256: sha256(canonicalize(checklist)) };
}

function buildOwnerSigningWorkOrder({
  generatedAt,
  outputDir,
  commitRef,
  signableReceiptDraft,
  ownerReceiptIntake,
  sourceLiteralPreflight,
  closeoutReadiness,
  firstUseAuditReadiness,
  ownerCompletionChecklist,
}) {
  const workOrder = {
    schema_version: "factory-g1a-owner-signing-work-order.v1",
    work_order_id: "g1a.owner_signature_work_order",
    generated_at: generatedAt,
    work_order_status: "ready_for_owner_to_complete",
    reviewed_commit_sha: commitRef || null,
    signable_receipt_draft_path: relativeArtifactPath(outputDir, "signable-owner-receipt-draft.json"),
    signable_receipt_draft_sha256: signableReceiptDraft.draft_receipt_sha256,
    owner_completion_checklist_path: relativeArtifactPath(outputDir, "owner-completion-checklist.json"),
    owner_completion_checklist_sha256: ownerCompletionChecklist.checklist_sha256,
    current_readiness_snapshot: {
      owner_receipt_intake_status_with_draft: ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status,
      source_literal_preflight_status_with_draft: sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status,
      closeout_readiness_status_with_draft: closeoutReadiness.summary.factory_g1a_opening_closeout_readiness_status,
      first_use_audit_readiness_status: firstUseAuditReadiness.summary.factory_g1a_first_use_audit_readiness_status,
      owner_gate_opening_receipt_signed_now: ownerReceiptIntake.summary.owner_gate_opening_receipt_signed_now,
      ready_for_source_literal_commit_now: sourceLiteralPreflight.summary.ready_for_isolated_source_literal_commit,
    },
    next_commands_after_owner_signature: [
      "npm run factory:g1a-owner-receipt-intake -- --owner-receipt-path <signed-owner-receipt.json> --check --require-pass",
      "npm run factory:g1a-source-literal-preflight -- --owner-receipt-path <signed-owner-receipt.json> --check --require-pass",
      "npm run factory:g1a-opening-closeout-readiness -- --owner-receipt-path <signed-owner-receipt.json> --check",
      "npm run factory:g1a-first-use-audit-readiness -- --check",
    ],
    forbidden_actions_in_this_handoff: [
      "do not sign on behalf of the owner",
      "do not mutate src/factory-gate-opening-readiness.mjs",
      "do not open G1a or project_creation_allowed_now",
      "do not claim Claude, Codex, or Fable final approval",
      "do not claim production or enterprise trust",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...workOrder, work_order_sha256: sha256(canonicalize(workOrder)) };
}

function buildIndependentReviewPacket({ generatedAt, outputDir, commitRef, reviewRequest }) {
  const rawOutputPath = relativeArtifactPath(outputDir, "raw-output.json");
  const promptPath = relativeArtifactPath(outputDir, "review-prompt.md");
  const packet = {
    schema_version: "factory-g1a-owner-signing-handoff-review-packet.v1",
    review_id: "G-SERIES.G1a.owner-signing-handoff",
    generated_at: generatedAt,
    review_status: "packet_ready_review_not_run",
    reviewed_commit_sha: commitRef || null,
    method: "law_firm_os_style_claude_opus_4_8_max_compact_packet",
    reviewer_lane: "Claude Code Opus max",
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    permission_mode: "dontAsk",
    read_only: true,
    prompt_path: promptPath,
    raw_output_path: rawOutputPath,
    review_request_path: relativeArtifactPath(outputDir, "review-request.json"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_request_sha256: sha256(canonicalize(reviewRequest)),
    launch_command: `claude -p "$(cat ${promptPath})" --model ${REVIEW_MODEL} --effort ${REVIEW_EFFORT} --permission-mode dontAsk --output-format json --max-budget-usd 4 --no-session-persistence > ${rawOutputPath}`,
    evidence_validation_command: `npm run factory:claude-review-evidence -- --review-id g1a-owner-signing-handoff-opus-4-8-lawos-style --program-range ${PROGRAM_RANGE} --raw-review ${rawOutputPath} --prompt ${promptPath} --out-dir ${relativeArtifactPath(outputDir, "evidence-validation")} --check --require-valid`,
    review_questions: [
      "Does the handoff produce a signable draft without signing on behalf of the owner?",
      "Does every authority flag remain closed, including project creation, repo write, command execution, deployment, production, and enterprise trust?",
      "Does the work order require candidate hash binding, owner signature, owner receipt intake, source-literal preflight, isolated source commit, and first-use audit in the right order?",
      "Does the Review API expose the handoff read-only and deny mutation methods?",
      "Do tests cover default handoff readiness, unsigned draft intake waiting state, check-mode no-write, and API method guards?",
    ],
    invalid_evidence_rules: [
      "empty output is invalid",
      "auth or login failure is invalid",
      "quota or usage-limit failure is invalid",
      "interrupted or cancelled output is invalid",
      "malformed JSON review payload is invalid",
      "tool-call-shaped output without verdict is invalid",
      "Claude final approval, production PASS, enterprise PASS, source mutation, or owner signature claims invalidate the evidence",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...packet, packet_sha256: sha256(canonicalize(packet)) };
}

function buildReviewRequest({ generatedAt, outputDir, commitRef, reviewSchema }) {
  const request = {
    schema_version: "hermes.g1a-owner-signing-handoff-review-request.v1",
    created_at: generatedAt,
    scope_id: "factory_g1a_owner_signing_handoff",
    program_range: PROGRAM_RANGE,
    reviewed_commit_sha: commitRef || null,
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    output_format: "json",
    raw_output_path: relativeArtifactPath(outputDir, "raw-output.json"),
    prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_schema_sha256: sha256(canonicalize(reviewSchema)),
    counts_as_final_approval: false,
    opens_gate_now: false,
    signs_owner_receipt_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...request, review_request_sha256: sha256(canonicalize(request)) };
}

function buildReviewSchema() {
  return {
    schema_version: "hermes.g1a-owner-signing-handoff-review-schema.v1",
    type: "object",
    additionalProperties: false,
    required: [
      "verdict",
      "blocking_findings",
      "non_blocking_findings",
      "changes_required_before_commit",
      "validated_commands",
      "review_notes",
      "reviewed_commit_sha",
      "engine_resolved_model_id",
      "is_final_approval",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "source_mutation_performed",
      "owner_signature_performed",
    ],
    properties: {
      verdict: { enum: ["APPROVE", "APPROVE_WITH_FINDINGS", "BLOCK"] },
      blocking_findings: { type: "array" },
      non_blocking_findings: { type: "array" },
      changes_required_before_commit: { type: "boolean" },
      validated_commands: { type: "array", items: { type: "string" } },
      review_notes: { type: "string" },
      reviewed_commit_sha: { type: "string" },
      engine_resolved_model_id: { type: "string" },
      is_final_approval: { const: false },
      production_pass_enabled: { const: false },
      enterprise_pass_enabled: { const: false },
      source_mutation_performed: { const: false },
      owner_signature_performed: { const: false },
    },
  };
}

function buildHandoffRows({
  packageJson,
  structuredSummary,
  openingPacket,
  ownerReceiptIntake,
  sourceLiteralPreflight,
  closeoutReadiness,
  firstUseAuditReadiness,
  signableReceiptDraft,
  ownerCompletionChecklist,
  independentReviewPacket,
  generatedAt,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  const candidateHashBound = isSha256(signableReceiptDraft.bound_candidate_manifest_sha256)
    || isSha256(signableReceiptDraft.bound_candidate_packet_sha256);
  const closeoutStatus = closeoutReadiness.summary.factory_g1a_opening_closeout_readiness_status;
  const firstUseStatus = firstUseAuditReadiness.summary.factory_g1a_first_use_audit_readiness_status;
  const g1aSourceEvidenceComplete = closeoutStatus === CLOSEOUT_READY_STATUS
    && firstUseStatus === FIRST_USE_ALREADY_BOUND_STATUS;
  const closeoutSafelyWaiting = [WAITING_RECEIPT_STATUS, WAITING_FIRST_USE_STATUS].includes(closeoutStatus);
  const firstUseSafelyWaiting = [WAITING_OPENING_STATUS, WAITING_FIRST_USE_CANDIDATE_STATUS].includes(firstUseStatus);
  const sourcePreflightSafe = sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status === WAITING_RECEIPT_STATUS
    || sourceLiteralPreflight.summary.factory_g1a_source_literal_preflight_status === SOURCE_LITERAL_APPLIED_STATUS
    || g1aSourceEvidenceComplete;
  return [
    handoffRow("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" ? "pass" : "fail", "package.json registers factory:g1a-owner-signing-handoff", generatedAt),
    handoffRow("source.opening_packet_ready", "source_chain", openingPacket.summary?.factory_g1a_opening_packet_status === "ready_factory_g1a_opening_packet" ? "pass" : "fail", "G1a opening packet is ready", generatedAt),
    handoffRow("source.independent_review_valid", "source_chain", structuredSummary.data?.g1a_claude_review_evidence_status === "valid_review_evidence" && Number(structuredSummary.data?.g1a_claude_code_review_blocking_findings ?? -1) === 0 ? "pass" : "fail", "G1a opening packet Claude review evidence is valid with no blocking findings", generatedAt),
    handoffRow("receipt.draft_unsigned", "owner_receipt", signableReceiptDraft.receipt_status === "draft_unsigned" && signableReceiptDraft.human_owner_signed === false ? "pass" : "fail", "Signable owner receipt draft is unsigned", generatedAt),
    handoffRow("receipt.candidate_hash_required", "owner_receipt", candidateHashBound ? "pass" : "wait", "Owner must bind one candidate manifest or packet SHA-256 before signing", generatedAt),
    handoffRow("receipt.owner_signature_required", "owner_signature", signableReceiptDraft.human_owner_signature_required === true && signableReceiptDraft.human_owner_signed === false ? "wait" : "fail", "Human owner signature remains required and absent", generatedAt),
    handoffRow("receipt.independent_review_bound", "review_binding", hasText(signableReceiptDraft.independent_review_receipt_ref) ? "pass" : "fail", "Receipt draft binds independent review evidence", generatedAt),
    handoffRow("intake.draft_waits_not_ready", "owner_receipt", ownerReceiptIntake.summary.factory_g1a_owner_receipt_intake_status === WAITING_RECEIPT_STATUS ? "pass" : "fail", "Owner receipt intake keeps unsigned draft waiting", generatedAt),
    handoffRow("source_preflight.waits_for_signature", "source_literal", sourcePreflightSafe ? "pass" : "fail", "Source-literal preflight waits for signature or the G1a source evidence is already complete", generatedAt),
    handoffRow("closeout.waits_for_signature", "closeout", closeoutSafelyWaiting || g1aSourceEvidenceComplete ? "pass" : "fail", "Closeout readiness is safely waiting or ready after source evidence completion", generatedAt),
    handoffRow("first_use.waits_for_opening", "first_use_audit", firstUseSafelyWaiting || g1aSourceEvidenceComplete ? "pass" : "fail", "First-use audit readiness is safely waiting or already source-bound", generatedAt),
    handoffRow("owner_checklist.ready", "owner_completion", ownerCompletionChecklist.checklist_status === "owner_action_required" && ownerCompletionChecklist.required_item_count >= 7 ? "pass" : "fail", "Owner completion checklist is ready", generatedAt),
    handoffRow("review.packet_ready", "independent_review", independentReviewPacket.review_status === "packet_ready_review_not_run" && independentReviewPacket.read_only === true ? "pass" : "fail", "LawOS-style Claude review packet is ready and read-only", generatedAt),
    handoffRow("authority.closed", "authority", receiptAuthorityClosed(signableReceiptDraft) ? "pass" : "fail", "Handoff and receipt draft do not open protected authority", generatedAt),
  ];
}

function buildBoundary({ handoffRows, signableReceiptDraft, ownerCompletionChecklist, generatedAt }) {
  const failCount = handoffRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = handoffRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = handoffRows.filter((row) => row.current_verdict === "pass").length;
  const ready = failCount === 0 && signableReceiptDraft.human_owner_signed === false && ownerCompletionChecklist.checklist_status === "owner_action_required";
  return {
    schema_version: "factory-g1a-owner-signing-handoff-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    handoff_only: true,
    ready_for_owner_signature_now: ready,
    owner_completion_required: true,
    owner_completion_required_count: ownerCompletionChecklist.required_item_count,
    owner_gate_opening_receipt_signed_now: false,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    opens_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    g1a_owner_signing_handoff_can_open_gate_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    handoff_pass_count: passCount,
    handoff_wait_count: waitCount,
    handoff_fail_count: failCount,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ packageJson, handoffRows, boundary, signableReceiptDraft, independentReviewPacket }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-owner-signing-handoff.mjs"), "package.json does not register factory:g1a-owner-signing-handoff"),
    validationItem("rows.present", "handoff_rows", handoffRows.length === 14, "G1a owner signing handoff row count changed unexpectedly"),
    validationItem("rows.no_failures", "handoff_rows", handoffRows.every((row) => row.current_verdict !== "fail"), "G1a owner signing handoff has hard failed rows"),
    validationItem("receipt.unsigned", "owner_receipt", signableReceiptDraft.receipt_status === "draft_unsigned" && signableReceiptDraft.human_owner_signed === false, "Signable receipt draft is already signed or not draft_unsigned"),
    validationItem("review.packet_read_only", "independent_review", independentReviewPacket.read_only === true && independentReviewPacket.review_status === "packet_ready_review_not_run", "Independent review packet is missing or not read-only"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Owner signing handoff opened forbidden authority"),
  ];
}

function buildSummary({ handoffRows, boundary, validation, ownerCompletionChecklist, signableReceiptDraft }) {
  const ready = validation.valid === true && boundary.ready_for_owner_signature_now === true;
  return {
    factory_g1a_owner_signing_handoff_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    ready_for_owner_signature_now: ready,
    owner_completion_required: true,
    owner_completion_required_count: ownerCompletionChecklist.required_item_count,
    owner_gate_opening_receipt_signed_now: false,
    signable_receipt_draft_sha256: signableReceiptDraft.draft_receipt_sha256,
    signable_receipt_status: signableReceiptDraft.receipt_status,
    candidate_hash_bound_now: isSha256(signableReceiptDraft.bound_candidate_manifest_sha256) || isSha256(signableReceiptDraft.bound_candidate_packet_sha256),
    handoff_row_count: handoffRows.length,
    handoff_pass_count: boundary.handoff_pass_count,
    handoff_wait_count: boundary.handoff_wait_count,
    handoff_fail_count: boundary.handoff_fail_count,
    waiting_row_ids: handoffRows.filter((row) => row.current_verdict === "wait").map((row) => row.row_id),
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    data_driven_gate_opening_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function handoffRow(rowId, category, currentVerdict, message, generatedAt) {
  const row = {
    schema_version: "factory-g1a-owner-signing-handoff-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-owner-signing-handoff-validation-item.v1",
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
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function boundaryFlagsClosed(boundary) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g1a_project_creation_gate_open_now",
    "g1a_owner_signing_handoff_can_open_gate_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function receiptAuthorityClosed(receipt) {
  return Object.keys(CLOSED_AUTHORITY_FLAGS).every((flag) => receipt?.[flag] === false)
    && receipt?.production_pass_enabled === false
    && receipt?.enterprise_pass_enabled === false
    && receipt?.human_owner_signed === false
    && receipt?.source_literal_opening_commit_sha === null
    && receipt?.first_use_audit_ref === null;
}

function renderReviewPrompt(result) {
  return [
    `You are the independent Claude Code Opus Max reviewer for Hermes ${PROGRAM_RANGE}.`,
    "",
    "Review only the compact packet and listed source/test/doc files. Do not edit files. Do not sign owner receipts. Do not claim final approval, production PASS, enterprise PASS, source mutation, protected closeout, or that G1a is open.",
    "Return JSON only, with no markdown fences.",
    "",
    `Reviewed commit SHA: ${result.review_request.reviewed_commit_sha ?? "missing"}`,
    `Artifact root: ${relativeArtifactPath(result.output_dir)}`,
    "",
    "Read these files first:",
    "- artifacts/factory-g1a-owner-signing-handoff/latest/factory-g1a-owner-signing-handoff.json",
    "- artifacts/factory-g1a-owner-signing-handoff/latest/signable-owner-receipt-draft.json",
    "- artifacts/factory-g1a-owner-signing-handoff/latest/owner-signing-work-order.json",
    "- src/factory-g1a-owner-signing-handoff.mjs",
    "- src/factory-g1a-owner-receipt-intake.mjs",
    "- src/factory-g1a-source-literal-preflight.mjs",
    "- src/review-api.mjs",
    "- test/factory-g1a-owner-signing-handoff.test.mjs",
    "- docs/factory-promotion/g1a-owner-signing-handoff.md",
    "",
    "Review questions:",
    ...result.independent_review_packet.review_questions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "Required JSON shape:",
    JSON.stringify({
      verdict: "APPROVE_WITH_FINDINGS or APPROVE or BLOCK",
      blocking_findings: [],
      non_blocking_findings: [],
      changes_required_before_commit: false,
      validated_commands: [
        "node --check src/factory-g1a-owner-signing-handoff.mjs scripts/factory-g1a-owner-signing-handoff.mjs src/review-api.mjs scripts/review-api-smoke.mjs : observed-or-not-run",
        "node --test test/factory-g1a-owner-signing-handoff.test.mjs : observed-or-not-run",
        "npm run factory:g1a-owner-signing-handoff -- --check --require-pass : observed-or-not-run",
        "npm run api:smoke : observed-or-not-run",
        "npm run contracts:validate -- --check : observed-or-not-run",
        "git diff --check : observed-or-not-run",
      ],
      review_notes: "string",
      reviewed_commit_sha: result.review_request.reviewed_commit_sha ?? "missing",
      engine_resolved_model_id: REVIEW_MODEL,
      is_final_approval: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      source_mutation_performed: false,
      owner_signature_performed: false,
    }, null, 2),
    "",
    "Authority boundary that must remain true:",
    JSON.stringify({
      g1a_project_creation_gate_open_now: false,
      project_creation_allowed_now: false,
      owner_gate_opening_receipt_signed_now: false,
      signs_owner_receipt_now: false,
      source_mutation_performed: false,
      source_literal_opening_commit_applied_now: false,
      claude_is_final_approver: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    }, null, 2),
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Owner Signing Handoff",
    "",
    `Status: ${result.summary.factory_g1a_owner_signing_handoff_status}`,
    `Program: ${result.program_range}`,
    `Ready for owner signature: ${result.summary.ready_for_owner_signature_now}`,
    `Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`,
    `Candidate hash bound now: ${result.summary.candidate_hash_bound_now}`,
    `Owner completion items: ${result.summary.owner_completion_required_count}`,
    `Handoff rows pass/wait/fail: ${result.summary.handoff_pass_count}/${result.summary.handoff_wait_count}/${result.summary.handoff_fail_count}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
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
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--receipt-id") args.receiptId = argv[++index];
    else if (arg === "--bound-candidate-manifest-sha256") args.boundCandidateManifestSha256 = argv[++index];
    else if (arg === "--bound-candidate-packet-sha256") args.boundCandidatePacketSha256 = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g1a-owner-signing-handoff.mjs [--check] [--require-pass] [--no-write] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>] [--receipt-id <id>] [--bound-candidate-manifest-sha256 <sha>] [--bound-candidate-packet-sha256 <sha>]

Builds a read-only owner signing handoff for G1a. It never signs receipts, mutates source, opens G1a, or grants project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, text: JSON.stringify(data), error: null };
}

function normalizeInlineBuiltSource(sourcePath, data) {
  return { path: sourcePath, available: true, data, error: null };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function serializableResult(result) {
  const { markdown, review_prompt: _reviewPrompt, ...json } = result;
  return json;
}

function relativeArtifactPath(baseDir, fileName) {
  const relative = path.relative(process.cwd(), fileName ? path.join(baseDir, fileName) : baseDir);
  return relative || ".";
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
