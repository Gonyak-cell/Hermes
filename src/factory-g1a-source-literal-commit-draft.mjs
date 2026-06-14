import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryG1aSourceLiteralPreflight } from "./factory-g1a-source-literal-preflight.mjs";

export const DEFAULT_FACTORY_G1A_SOURCE_LITERAL_COMMIT_DRAFT_OUT_DIR = "artifacts/factory-g1a-source-literal-commit-draft/latest";
export const DEFAULT_FACTORY_G1A_SOURCE_LITERAL_COMMIT_DRAFT_INPUTS = {
  packagePath: "package.json",
  gateOpeningSourcePath: "src/factory-gate-opening-readiness.mjs",
};

const COMMAND_NAME = "factory:g1a-source-literal-commit-draft";
const SCHEMA_VERSION = "factory-g1a-source-literal-commit-draft.v1";
const CAPABILITY_ID = "factory.g1a_source_literal_commit_draft";
const PROGRAM_RANGE = "G-SERIES.1a.source-literal-commit-draft";
const READY_STATUS = "ready_g1a_source_literal_commit_draft";
const APPLIED_STATUS = "source_literal_commit_already_applied";
const WAITING_STATUS = "waiting_for_signed_g1a_owner_receipt";
const BLOCKED_STATUS = "blocked_g1a_source_literal_commit_draft";
const PREFLIGHT_READY_STATUS = "ready_g1a_source_literal_commit_preflight";
const PREFLIGHT_APPLIED_STATUS = "source_literal_opening_commit_already_applied";
const REVIEW_MODEL = "claude-opus-4-8";
const REVIEW_EFFORT = "max";

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

export async function runFactoryG1aSourceLiteralCommitDraft(options = {}) {
  const result = await buildFactoryG1aSourceLiteralCommitDraft(options);
  if (!options.check && options.write !== false) await writeFactoryG1aSourceLiteralCommitDraft(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Source Literal Commit Draft failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && ![READY_STATUS, APPLIED_STATUS].includes(result.summary.factory_g1a_source_literal_commit_draft_status)) {
    const error = new Error("Factory G1a Source Literal Commit Draft is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aSourceLiteralCommitDraft(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_SOURCE_LITERAL_COMMIT_DRAFT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const gateOpeningSource = await readTextSource(inputs.gate_opening_source_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const sourceLiteralPreflight = Object.prototype.hasOwnProperty.call(options, "sourceLiteralPreflight")
    ? options.sourceLiteralPreflight
    : await buildFactoryG1aSourceLiteralPreflight({
      ...options,
      repoRoot: inputs.repo_root,
      gateOpeningSourcePath: inputs.gate_opening_source_path,
      runAt: generatedAt,
      commitRef,
      write: false,
    });
  const draftPatch = buildDraftPatch({
    gateOpeningSource,
    sourceLiteralPreflight,
    outputDir,
    generatedAt,
  });
  const verificationCommandRows = buildVerificationCommandRows({ draftPatch, outputDir, generatedAt });
  const draftRows = buildDraftRows({ sourceLiteralPreflight, gateOpeningSource, draftPatch, verificationCommandRows, generatedAt });
  const reviewSchema = buildReviewSchema();
  const reviewRequest = buildReviewRequest({ generatedAt, outputDir, reviewSchema });
  const independentReviewPacket = buildIndependentReviewPacket({ generatedAt, outputDir });
  const boundary = buildBoundary({ sourceLiteralPreflight, draftPatch, draftRows, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    gateOpeningSource,
    sourceLiteralPreflight,
    draftPatch,
    draftRows,
    verificationCommandRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceLiteralPreflight, draftPatch, draftRows, verificationCommandRows, boundary, validation });
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
      gate_opening_source_path: gateOpeningSource.path,
      source_literal_preflight_ref: sourceLiteralPreflight.output_dir ?? "built.factory_g1a_source_literal_preflight",
      patch_path: relativeArtifactPath(outputDir, "source-literal-opening.patch"),
      review_prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    },
    source_summaries: {
      source_literal_preflight_status: sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status ?? null,
      owner_receipt_signed_now: sourceLiteralPreflight.summary?.owner_gate_opening_receipt_signed_now ?? false,
      ready_for_isolated_source_literal_commit: sourceLiteralPreflight.summary?.ready_for_isolated_source_literal_commit ?? false,
      owner_receipt_sha256: sourceLiteralPreflight.owner_receipt_sha256 ?? null,
    },
    source_literal_commit_patch: draftPatch,
    source_literal_commit_draft_rows: draftRows,
    verification_command_rows: verificationCommandRows,
    independent_review_packet: independentReviewPacket,
    review_request: reviewRequest,
    review_schema: reviewSchema,
    factory_g1a_source_literal_commit_draft_boundary: boundary,
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

export async function writeFactoryG1aSourceLiteralCommitDraft(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-source-literal-commit-draft.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-literal-commit-draft-rows.json"), collectionEnvelope("factory-g1a-source-literal-commit-draft-rows.v1", "source_literal_commit_draft_rows", result.source_literal_commit_draft_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-command-rows.json"), collectionEnvelope("factory-g1a-source-literal-commit-draft-verification-command-rows.v1", "verification_command_rows", result.verification_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-literal-commit-patch.json"), result.source_literal_commit_patch);
  await writeFile(path.join(outDir, "source-literal-opening.patch"), `${result.source_literal_commit_patch.unified_diff ?? ""}`, "utf8");
  await writeJson(path.join(outDir, "independent-review-packet.json"), result.independent_review_packet);
  await writeJson(path.join(outDir, "review-request.json"), result.review_request);
  await writeJson(path.join(outDir, "review-schema.json"), result.review_schema);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_source_literal_commit_draft_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-source-literal-commit-draft-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "review-prompt.md"), result.review_prompt, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aSourceLiteralCommitDraftCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aSourceLiteralCommitDraft(args);
    console.log(`Factory G1a Source Literal Commit Draft ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_source_literal_commit_draft_status}`);
    console.log(`Patch available: ${result.summary.patch_available_now}`);
    console.log(`Patch applied now: ${result.summary.patch_applied_now}`);
    console.log(`Source mutation allowed: ${result.summary.source_mutation_allowed_now}`);
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
  const defaults = DEFAULT_FACTORY_G1A_SOURCE_LITERAL_COMMIT_DRAFT_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    gate_opening_source_path: path.resolve(repoRoot, options.gateOpeningSourcePath ?? defaults.gateOpeningSourcePath),
  };
}

function buildDraftPatch({ gateOpeningSource, sourceLiteralPreflight, outputDir, generatedAt }) {
  const preflightReady = sourceLiteralPreflight.validation?.valid === true
    && sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_READY_STATUS;
  const preflightApplied = sourceLiteralPreflight.validation?.valid === true
    && sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_APPLIED_STATUS;
  const proposed = sourceLiteralPreflight.proposed_source_literal_change ?? {};
  const replacements = proposed.required_replacements ?? [];
  const replacementResults = replacements.map((replacement) => buildReplacementResult(replacement, gateOpeningSource.text ?? "", preflightReady));
  const allReplacementsExact = preflightReady
    && replacementResults.length > 0
    && replacementResults.every((row) => row.replacement_ready === true && row.match_count === 1);
  const patchAvailable = preflightReady && gateOpeningSource.available === true && allReplacementsExact;
  const patchedText = patchAvailable
    ? applyReplacementResults(gateOpeningSource.text, replacementResults)
    : null;
  const forbiddenSymbolRows = preflightApplied
    ? buildForbiddenSymbolRows(gateOpeningSource.text ?? "", gateOpeningSource.text ?? "", generatedAt, {
      comparisonState: "already_applied_source_snapshot",
      requireClosedGateValues: false,
    })
    : buildForbiddenSymbolRows(gateOpeningSource.text ?? "", patchedText, generatedAt);
  const forbiddenUnchanged = patchAvailable && forbiddenSymbolRows.every((row) => row.current_verdict === "pass");
  const unifiedDiff = patchAvailable && forbiddenUnchanged
    ? buildUnifiedDiff({
      fromPath: "src/factory-gate-opening-readiness.mjs",
      toPath: "src/factory-gate-opening-readiness.mjs",
      beforeText: gateOpeningSource.text,
      afterText: patchedText,
    })
    : "";
  const patch = {
    schema_version: "factory-g1a-source-literal-opening-patch.v1",
    generated_at: generatedAt,
    patch_status: preflightApplied ? APPLIED_STATUS : patchAvailable && forbiddenUnchanged ? "patch_ready_review_required" : preflightReady ? "patch_blocked" : "waiting_for_signed_owner_receipt",
    draft_only: true,
    patch_available_now: patchAvailable && forbiddenUnchanged,
    patch_applied_now: preflightApplied,
    patch_applied_by_this_command: false,
    source_mutation_allowed_now: false,
    target_file: "src/factory-gate-opening-readiness.mjs",
    artifact_patch_path: relativeArtifactPath(outputDir, "source-literal-opening.patch"),
    source_file_sha256_before: gateOpeningSource.available ? sha256(gateOpeningSource.text) : null,
    source_file_sha256_after_preview: patchAvailable && forbiddenUnchanged ? sha256(patchedText) : preflightApplied && gateOpeningSource.available ? sha256(gateOpeningSource.text) : null,
    owner_receipt_sha256: sourceLiteralPreflight.owner_receipt_sha256 ?? null,
    owner_receipt_id: sourceLiteralPreflight.owner_gate_opening_receipt_candidate?.receipt_id ?? null,
    independent_review_receipt_ref: sourceLiteralPreflight.owner_gate_opening_receipt_candidate?.independent_review_receipt_ref ?? null,
    allowed_replacement_ids: replacements.map((item) => item.replacement_id),
    replacement_results: replacementResults,
    forbidden_symbol_rows: forbiddenSymbolRows,
    all_required_replacements_exactly_once: allReplacementsExact,
    forbidden_symbols_unchanged: preflightApplied ? forbiddenSymbolRows.every((row) => row.current_verdict === "pass") : forbiddenUnchanged,
    unified_diff: unifiedDiff,
    unified_diff_sha256: unifiedDiff ? sha256(unifiedDiff) : null,
    first_use_audit_required_after_commit: true,
    first_use_audit_added_by_this_draft: false,
    g1a_project_creation_gate_open_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...patch, patch_sha256: sha256(canonicalize({ ...patch, unified_diff: unifiedDiff ? "<omitted-from-patch-hash>" : "" })) };
}

function buildReplacementResult(replacement, sourceText, preflightReady) {
  const before = String(replacement.before ?? "");
  const after = String(replacement.after ?? "");
  const matchCount = before ? countOccurrences(sourceText, before) : 0;
  const replacementReady = preflightReady && matchCount === 1 && before.length > 0 && after.length > 0;
  const row = {
    schema_version: "factory-g1a-source-literal-replacement-result.v1",
    replacement_id: replacement.replacement_id ?? null,
    preview_state: preflightReady ? "materialized_from_signed_owner_receipt" : "template_only_waiting_for_signed_owner_receipt",
    match_count: matchCount,
    replacement_ready: replacementReady,
    replacement_materialized_now: preflightReady,
    before,
    after: preflightReady ? after : null,
    before_sha256: before ? sha256(before) : null,
    after_sha256: preflightReady && after ? sha256(after) : null,
    template_after_sha256: after ? sha256(after) : null,
  };
  return { ...row, replacement_result_sha256: sha256(canonicalize(row)) };
}

function applyReplacementResults(sourceText, replacementResults) {
  let patched = sourceText;
  for (const row of replacementResults) {
    if (row.replacement_ready !== true || countOccurrences(patched, row.before) !== 1 || typeof row.after !== "string") {
      throw new Error(`Replacement ${row.replacement_id ?? "<unknown>"} is not exact-one ready.`);
    }
    patched = patched.replace(row.before, row.after);
  }
  return patched;
}

function buildForbiddenSymbolRows(beforeText, afterText, generatedAt, options = {}) {
  if (typeof afterText !== "string") return buildWaitingForbiddenSymbolRows(beforeText, generatedAt);
  const comparisonState = options.comparisonState ?? "materialized_from_patch_preview";
  const requireClosedGateValues = options.requireClosedGateValues !== false;
  const rows = [
    forbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G1b", "G1b", beforeText, afterText, generatedAt, { comparisonState, requireClosedGateValues }),
    forbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G2", "G2", beforeText, afterText, generatedAt, { comparisonState, requireClosedGateValues }),
    forbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G3", "G3", beforeText, afterText, generatedAt, { comparisonState, requireClosedGateValues }),
    forbiddenTextRow("production_pass_enabled", beforeText, afterText, generatedAt, { comparisonState }),
    forbiddenTextRow("enterprise_pass_enabled", beforeText, afterText, generatedAt, { comparisonState }),
    forbiddenTextRow("connector_write_allowed_now", beforeText, afterText, generatedAt, { comparisonState }),
    forbiddenTextRow("deployment_allowed_now", beforeText, afterText, generatedAt, { comparisonState }),
  ];
  return rows.map((row) => ({ ...row, forbidden_symbol_row_sha256: sha256(canonicalize(row)) }));
}

function buildWaitingForbiddenSymbolRows(beforeText, generatedAt) {
  const rows = [
    waitingForbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G1b", "G1b", beforeText, generatedAt),
    waitingForbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G2", "G2", beforeText, generatedAt),
    waitingForbiddenGateRow("SOURCE_LITERAL_GATE_OPEN_COMMITS.G3", "G3", beforeText, generatedAt),
    waitingForbiddenTextRow("production_pass_enabled", beforeText, generatedAt),
    waitingForbiddenTextRow("enterprise_pass_enabled", beforeText, generatedAt),
    waitingForbiddenTextRow("connector_write_allowed_now", beforeText, generatedAt),
    waitingForbiddenTextRow("deployment_allowed_now", beforeText, generatedAt),
  ];
  return rows.map((row) => ({ ...row, forbidden_symbol_row_sha256: sha256(canonicalize(row)) }));
}

function waitingForbiddenGateRow(symbol, gateId, beforeText, generatedAt) {
  return {
    schema_version: "factory-g1a-source-literal-forbidden-symbol-row.v1",
    symbol,
    current_verdict: "wait",
    comparison_state: "template_only_waiting_for_signed_owner_receipt",
    before_value: extractGateLiteralValue(beforeText, gateId),
    after_value: null,
    comparison_materialized_now: false,
    generated_at: generatedAt,
  };
}

function waitingForbiddenTextRow(symbol, beforeText, generatedAt) {
  return {
    schema_version: "factory-g1a-source-literal-forbidden-symbol-row.v1",
    symbol,
    current_verdict: "wait",
    comparison_state: "template_only_waiting_for_signed_owner_receipt",
    before_occurrence_count: countOccurrences(beforeText, symbol),
    after_occurrence_count: null,
    comparison_materialized_now: false,
    generated_at: generatedAt,
  };
}

function forbiddenGateRow(symbol, gateId, beforeText, afterText, generatedAt, options = {}) {
  const before = extractGateLiteralValue(beforeText, gateId);
  const after = extractGateLiteralValue(afterText, gateId);
  const passed = options.requireClosedGateValues === false
    ? before === after
    : before === false && after === false;
  return {
    schema_version: "factory-g1a-source-literal-forbidden-symbol-row.v1",
    symbol,
    current_verdict: passed ? "pass" : "fail",
    comparison_state: options.comparisonState ?? "materialized_from_patch_preview",
    before_value: before,
    after_value: after,
    comparison_materialized_now: true,
    generated_at: generatedAt,
  };
}

function forbiddenTextRow(symbol, beforeText, afterText, generatedAt, options = {}) {
  const beforeCount = countOccurrences(beforeText, symbol);
  const afterCount = countOccurrences(afterText, symbol);
  const passed = beforeCount === afterCount;
  return {
    schema_version: "factory-g1a-source-literal-forbidden-symbol-row.v1",
    symbol,
    current_verdict: passed ? "pass" : "fail",
    comparison_state: options.comparisonState ?? "materialized_from_patch_preview",
    before_occurrence_count: beforeCount,
    after_occurrence_count: afterCount,
    comparison_materialized_now: true,
    generated_at: generatedAt,
  };
}

function buildVerificationCommandRows({ draftPatch, outputDir, generatedAt }) {
  const patchPath = relativeArtifactPath(outputDir, "source-literal-opening.patch");
  const commands = [
    ["patch.diff_available", `test -s ${patchPath}`],
    ["patch.git_apply_check", `git apply --check ${patchPath}`],
    ["source.preflight_recheck", "npm run factory:g1a-source-literal-preflight -- --owner-receipt-path <signed-owner-receipt.json> --check --require-pass"],
    ["closeout.recheck", "npm run factory:g1a-opening-closeout-readiness -- --owner-receipt-path <signed-owner-receipt.json> --check"],
  ];
  return commands.map(([rowId, command], index) => {
    const row = {
      schema_version: "factory-g1a-source-literal-commit-draft-verification-command-row.v1",
      command_row_id: rowId,
      command,
      command_kind: "manual_verification_preview",
      command_available_now: draftPatch.patch_available_now === true,
      command_executes_now: false,
      command_mutates_source_now: false,
      ordinal: index + 1,
      generated_at: generatedAt,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, command_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildDraftRows({ sourceLiteralPreflight, gateOpeningSource, draftPatch, verificationCommandRows, generatedAt }) {
  const preflightValid = sourceLiteralPreflight.validation?.valid === true;
  const preflightReady = sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_READY_STATUS;
  const preflightApplied = sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_APPLIED_STATUS;
  const patchAvailable = draftPatch.patch_available_now === true;
  return [
    draftRow("source.target_file_available", "source", gateOpeningSource.available ? "pass" : "fail", "Gate-opening source file is readable", generatedAt),
    draftRow("source.preflight_valid", "source", preflightValid ? "pass" : "fail", "Source-literal preflight has no hard validation failures", generatedAt),
    draftRow("owner_receipt.signed_ready", "owner_receipt", preflightReady || preflightApplied ? "pass" : "wait", "Signed owner receipt made source-literal preflight ready or is already applied", generatedAt),
    draftRow("patch.required_replacements_exact", "patch", preflightApplied ? "pass" : preflightReady ? (draftPatch.all_required_replacements_exactly_once ? "pass" : "fail") : "wait", "Every required replacement matches exactly once or is already applied", generatedAt),
    draftRow("patch.forbidden_symbols_unchanged", "patch", preflightReady || preflightApplied ? (draftPatch.forbidden_symbols_unchanged ? "pass" : "fail") : "wait", "G1b/G2/G3 and production/deploy/connector flags stay unchanged", generatedAt),
    draftRow("patch.unified_diff_generated", "patch", patchAvailable || preflightApplied ? "pass" : "wait", "Unified diff artifact is generated for review or no longer needed after apply", generatedAt),
    draftRow("commands.preview_only", "command", verificationCommandRows.every((row) => row.command_executes_now === false && row.command_mutates_source_now === false) ? "pass" : "fail", "Verification commands are preview-only metadata", generatedAt),
    draftRow("authority.not_applied_by_command", "authority", draftPatch.patch_applied_by_this_command === false && draftPatch.source_mutation_allowed_now === false ? "pass" : "fail", "Commit draft command does not apply the patch or open authority", generatedAt),
  ];
}

function draftRow(rowId, category, currentVerdict, message, generatedAt) {
  const row = {
    schema_version: "factory-g1a-source-literal-commit-draft-row.v1",
    row_id: rowId,
    category,
    current_verdict: currentVerdict,
    message,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function buildReviewSchema() {
  return {
    schema_version: "hermes.g1a-source-literal-commit-draft-review-schema.v1",
    type: "object",
    additionalProperties: false,
    required: [
      "verdict",
      "blocking_findings",
      "non_blocking_findings",
      "changes_required_before_commit",
      "validated_commands",
      "review_notes",
      "engine_resolved_model_id",
      "is_final_approval",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "source_mutation_performed",
      "owner_signature_performed",
      "gate_opened_now",
    ],
    properties: {
      verdict: { enum: ["APPROVE", "APPROVE_WITH_FINDINGS", "BLOCK"] },
      blocking_findings: { type: "array" },
      non_blocking_findings: { type: "array" },
      changes_required_before_commit: { type: "boolean" },
      validated_commands: { type: "array", items: { type: "string" } },
      review_notes: { type: "string" },
      engine_resolved_model_id: { type: "string" },
      is_final_approval: { const: false },
      production_pass_enabled: { const: false },
      enterprise_pass_enabled: { const: false },
      source_mutation_performed: { const: false },
      owner_signature_performed: { const: false },
      gate_opened_now: { const: false },
    },
  };
}

function buildReviewRequest({ generatedAt, outputDir, reviewSchema }) {
  const request = {
    schema_version: "hermes.g1a-source-literal-commit-draft-review-request.v1",
    created_at: generatedAt,
    scope_id: "factory_g1a_source_literal_commit_draft",
    program_range: PROGRAM_RANGE,
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    output_format: "json",
    raw_output_path: relativeArtifactPath(outputDir, "raw-output.json"),
    prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_schema_sha256: sha256(canonicalize(reviewSchema)),
    counts_as_final_approval: false,
    source_mutation_performed: false,
    opens_gate_now: false,
    signs_owner_receipt_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...request, review_request_sha256: sha256(canonicalize(request)) };
}

function buildIndependentReviewPacket({ generatedAt, outputDir }) {
  const rawOutputPath = relativeArtifactPath(outputDir, "raw-output.json");
  const promptPath = relativeArtifactPath(outputDir, "review-prompt.md");
  const packet = {
    schema_version: "factory-g1a-source-literal-commit-draft-review-packet.v1",
    review_id: "G-SERIES.G1a.source-literal-commit-draft",
    generated_at: generatedAt,
    review_status: "packet_ready_review_not_run",
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
    launch_command: `claude -p "$(cat ${promptPath})" --model ${REVIEW_MODEL} --effort ${REVIEW_EFFORT} --permission-mode dontAsk --tools Read,Grep,Glob --json-schema "$(cat ${relativeArtifactPath(outputDir, "review-schema.json")})" --output-format json --max-budget-usd 4 --no-session-persistence > ${rawOutputPath}`,
    evidence_validation_command: `npm run factory:claude-review-evidence -- --review-id g1a-source-literal-commit-draft-opus-4-8-lawos-style --program-range ${PROGRAM_RANGE} --raw-review ${rawOutputPath} --prompt ${promptPath} --out-dir ${relativeArtifactPath(outputDir, "evidence-validation")} --check --require-valid`,
    review_questions: [
      "Does the draft generate a single-file source-literal patch only after signed owner receipt preflight is ready?",
      "Does the patch change only SOURCE_LITERAL_GATE_OPEN_COMMITS.G1a from false to true and bind exactly one owner receipt?",
      "Do G1b, G2, G3, connector, deployment, production, and enterprise flags remain unchanged?",
      "Does the module avoid applying the patch, signing receipts, performing first use, or opening G1a?",
      "Does the Review API expose this draft read-only and deny mutating methods?",
    ],
    invalid_evidence_rules: [
      "empty output is invalid",
      "auth or login failure is invalid",
      "quota or usage-limit failure is invalid",
      "interrupted or cancelled output is invalid",
      "malformed JSON review payload is invalid",
      "tool-call-shaped output without verdict is invalid",
      "Claude final approval, production PASS, enterprise PASS, source mutation, owner signature, first-use audit, or G1a opening claims invalidate the evidence",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...packet, packet_sha256: sha256(canonicalize(packet)) };
}

function buildBoundary({ sourceLiteralPreflight, draftPatch, draftRows, generatedAt }) {
  const failCount = draftRows.filter((row) => row.current_verdict === "fail").length;
  const waitCount = draftRows.filter((row) => row.current_verdict === "wait").length;
  const passCount = draftRows.filter((row) => row.current_verdict === "pass").length;
  return {
    schema_version: "factory-g1a-source-literal-commit-draft-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    commit_draft_only: true,
    patch_available_now: draftPatch.patch_available_now === true,
    patch_applied_now: draftPatch.patch_applied_now === true,
    patch_applied_by_this_command: draftPatch.patch_applied_by_this_command === true,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: draftPatch.patch_applied_now === true,
    source_literal_preflight_ready_now: sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_READY_STATUS,
    source_literal_preflight_applied_now: sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status === PREFLIGHT_APPLIED_STATUS,
    owner_gate_opening_receipt_signed_now: sourceLiteralPreflight.summary?.owner_gate_opening_receipt_signed_now === true,
    ready_for_isolated_source_literal_commit_review: draftPatch.patch_available_now === true && failCount === 0,
    first_use_audit_present: false,
    g1a_source_literal_commit_draft_can_open_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    draft_pass_count: passCount,
    draft_wait_count: waitCount,
    draft_fail_count: failCount,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ packageJson, gateOpeningSource, sourceLiteralPreflight, draftPatch, draftRows, verificationCommandRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const preflightWaitingOrReady = sourceLiteralPreflight.validation?.valid === true
    && ["waiting_for_signed_g1a_owner_receipt", PREFLIGHT_READY_STATUS, PREFLIGHT_APPLIED_STATUS].includes(sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status);
  const patchReadyOrWaiting = draftPatch.patch_status === "waiting_for_signed_owner_receipt"
    || (draftPatch.patch_status === APPLIED_STATUS
      && draftPatch.patch_applied_now === true
      && draftPatch.patch_applied_by_this_command === false
      && draftPatch.forbidden_symbols_unchanged === true)
    || (draftPatch.patch_status === "patch_ready_review_required"
      && draftPatch.patch_available_now === true
      && draftPatch.unified_diff_sha256
      && draftPatch.all_required_replacements_exactly_once === true
      && draftPatch.forbidden_symbols_unchanged === true);
  return [
    validationItem("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-source-literal-commit-draft.mjs"), "package.json does not register factory:g1a-source-literal-commit-draft"),
    validationItem("source.file_available", "source", gateOpeningSource.available === true, "Gate-opening source file is missing"),
    validationItem("source.preflight_valid", "source", preflightWaitingOrReady, "Source-literal preflight is invalid or in an unexpected status"),
    validationItem("patch.ready_or_waiting", "patch", Boolean(patchReadyOrWaiting), "Patch draft is neither waiting safely nor ready with exact replacements"),
    validationItem("patch.single_file", "patch", draftPatch.target_file === "src/factory-gate-opening-readiness.mjs", "Patch target is not constrained to the gate-opening source file"),
    validationItem("commands.preview_only", "command", verificationCommandRows.length === 4 && verificationCommandRows.every((row) => row.command_executes_now === false && row.command_mutates_source_now === false), "Verification command rows must be preview-only"),
    validationItem("draft.no_fail_rows", "draft", draftRows.every((row) => row.current_verdict !== "fail"), "Commit draft rows contain hard failures"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Commit draft opened forbidden authority"),
  ];
}

function buildSummary({ sourceLiteralPreflight, draftPatch, draftRows, verificationCommandRows, boundary, validation }) {
  const hardFailed = validation.valid === false || boundary.draft_fail_count > 0 || draftPatch.patch_status === "patch_blocked";
  const ready = validation.valid === true && draftPatch.patch_available_now === true && boundary.ready_for_isolated_source_literal_commit_review === true;
  const applied = validation.valid === true && draftPatch.patch_status === APPLIED_STATUS && boundary.patch_applied_now === true;
  const status = hardFailed ? BLOCKED_STATUS : applied ? APPLIED_STATUS : ready ? READY_STATUS : WAITING_STATUS;
  return {
    factory_g1a_source_literal_commit_draft_status: status,
    program_range: PROGRAM_RANGE,
    source_literal_preflight_status: sourceLiteralPreflight.summary?.factory_g1a_source_literal_preflight_status ?? null,
    owner_gate_opening_receipt_signed_now: sourceLiteralPreflight.summary?.owner_gate_opening_receipt_signed_now === true,
    patch_available_now: draftPatch.patch_available_now === true,
    patch_applied_now: applied,
    patch_applied_by_this_command: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: applied,
    ready_for_isolated_source_literal_commit_review: ready,
    verification_command_count: verificationCommandRows.length,
    draft_row_count: draftRows.length,
    draft_pass_count: boundary.draft_pass_count,
    draft_wait_count: boundary.draft_wait_count,
    draft_fail_count: boundary.draft_fail_count,
    first_use_audit_present: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    validation_errors: validation.errors.length,
    patch_sha256: draftPatch.patch_sha256,
    unified_diff_sha256: draftPatch.unified_diff_sha256,
    owner_receipt_sha256: draftPatch.owner_receipt_sha256,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-source-literal-commit-draft-validation-item.v1",
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
    "g1a_source_literal_commit_draft_can_open_gate_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderReviewPrompt(result) {
  return [
    `You are the independent Claude Code Opus Max reviewer for Hermes ${PROGRAM_RANGE}.`,
    "",
    "Review only the compact packet and listed source/test/doc files. Do not edit files. Do not apply the patch. Do not sign owner receipts. Do not claim final approval, production PASS, enterprise PASS, source mutation, first-use audit, protected closeout, or that G1a is open.",
    "Return JSON only, with no markdown fences.",
    "",
    `Artifact root: ${relativeArtifactPath(result.output_dir)}`,
    "",
    "Read these files first:",
    "- artifacts/factory-g1a-source-literal-commit-draft/latest/factory-g1a-source-literal-commit-draft.json",
    "- artifacts/factory-g1a-source-literal-commit-draft/latest/source-literal-commit-patch.json",
    "- artifacts/factory-g1a-source-literal-commit-draft/latest/source-literal-opening.patch",
    "- src/factory-g1a-source-literal-commit-draft.mjs",
    "- src/factory-g1a-source-literal-preflight.mjs",
    "- src/factory-gate-opening-readiness.mjs",
    "- src/review-api.mjs",
    "- test/factory-g1a-source-literal-commit-draft.test.mjs",
    "- docs/factory-promotion/g1a-source-literal-commit-draft.md",
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
        "node --check src/factory-g1a-source-literal-commit-draft.mjs scripts/factory-g1a-source-literal-commit-draft.mjs src/review-api.mjs scripts/review-api-smoke.mjs : observed-or-not-run",
        "node --test test/factory-g1a-source-literal-commit-draft.test.mjs : observed-or-not-run",
        "npm run factory:g1a-source-literal-commit-draft -- --check : observed-or-not-run",
        "npm run api:smoke : observed-or-not-run",
        "npm run contracts:validate -- --check : observed-or-not-run",
        "git diff --check : observed-or-not-run",
      ],
      review_notes: "string",
      engine_resolved_model_id: REVIEW_MODEL,
      is_final_approval: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      source_mutation_performed: false,
      owner_signature_performed: false,
      gate_opened_now: false,
    }, null, 2),
    "",
    "Authority boundary that must remain true:",
    JSON.stringify({
      source_mutation_performed: false,
      patch_applied_now: false,
      owner_signature_performed: false,
      first_use_audit_present: false,
      g1a_project_creation_gate_open_now: false,
      project_creation_allowed_now: false,
      claude_is_final_approver: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    }, null, 2),
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Source Literal Commit Draft",
    "",
    `Status: ${result.summary.factory_g1a_source_literal_commit_draft_status}`,
    `Program: ${result.program_range}`,
    `Source-literal preflight: ${result.summary.source_literal_preflight_status}`,
    `Owner receipt signed: ${result.summary.owner_gate_opening_receipt_signed_now}`,
    `Patch available: ${result.summary.patch_available_now}`,
    `Patch applied now: ${result.summary.patch_applied_now}`,
    `Source mutation allowed: ${result.summary.source_mutation_allowed_now}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Draft rows pass/wait/fail: ${result.summary.draft_pass_count}/${result.summary.draft_wait_count}/${result.summary.draft_fail_count}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--owner-receipt-path") args.ownerReceiptPath = argv[++index];
    else if (arg === "--gate-opening-source-path") args.gateOpeningSourcePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g1a-source-literal-commit-draft.mjs [--check] [--require-pass] [--owner-receipt-path <path>] [--gate-opening-source-path <path>] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds a read-only draft patch for the future isolated G1a source-literal opening commit. It never mutates source, signs receipts, performs first use, or opens project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, error: null };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function extractGateLiteralValue(sourceText, gateId) {
  const match = String(sourceText ?? "").match(/const\s+SOURCE_LITERAL_GATE_OPEN_COMMITS\s*=\s*\{([\s\S]*?)\};/);
  if (!match) return null;
  const block = match[1];
  if (new RegExp(`\\b${gateId}:\\s*true\\b`).test(block)) return true;
  if (new RegExp(`\\b${gateId}:\\s*false\\b`).test(block)) return false;
  return null;
}

function buildUnifiedDiff({ fromPath, toPath, beforeText, afterText }) {
  const ops = diffLineOps(splitLines(beforeText), splitLines(afterText));
  const context = 3;
  const firstChange = ops.findIndex((op) => op.type !== "context");
  const lastChange = findLastIndex(ops, (op) => op.type !== "context");
  if (firstChange === -1 || lastChange === -1) return "";
  const hunkOps = ops.slice(Math.max(0, firstChange - context), Math.min(ops.length, lastChange + context + 1));
  const oldStart = hunkOps.find((op) => op.type !== "add")?.old_line ?? hunkOps[0].old_line;
  const newStart = hunkOps.find((op) => op.type !== "remove")?.new_line ?? hunkOps[0].new_line;
  const oldCount = hunkOps.filter((op) => op.type !== "add").length;
  const newCount = hunkOps.filter((op) => op.type !== "remove").length;
  const lines = [
    `diff --git a/${fromPath} b/${toPath}`,
    `--- a/${fromPath}`,
    `+++ b/${toPath}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
  ];
  for (const op of hunkOps) {
    if (op.type === "context") lines.push(` ${op.line}`);
    else if (op.type === "remove") lines.push(`-${op.line}`);
    else lines.push(`+${op.line}`);
  }
  return `${lines.join("\n")}\n`;
}

function diffLineOps(beforeLines, afterLines) {
  const lcs = Array.from({ length: beforeLines.length + 1 }, () => Array(afterLines.length + 1).fill(0));
  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = beforeLines[i] === afterLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;
  while (i < beforeLines.length || j < afterLines.length) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      ops.push({ type: "context", line: beforeLines[i], old_line: oldLine, new_line: newLine });
      i += 1;
      j += 1;
      oldLine += 1;
      newLine += 1;
    } else if (j < afterLines.length && (i === beforeLines.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops.push({ type: "add", line: afterLines[j], old_line: oldLine, new_line: newLine });
      j += 1;
      newLine += 1;
    } else {
      ops.push({ type: "remove", line: beforeLines[i], old_line: oldLine, new_line: newLine });
      i += 1;
      oldLine += 1;
    }
  }
  return ops;
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }
  return -1;
}

function splitLines(text) {
  return String(text ?? "").replace(/\n$/, "").split("\n");
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return String(text ?? "").split(String(needle)).length - 1;
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

function normalizePathForDisplay(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

function relativeArtifactPath(outputDir, leaf = "") {
  const display = normalizePathForDisplay(outputDir);
  return leaf ? `${display}/${leaf}` : display;
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
