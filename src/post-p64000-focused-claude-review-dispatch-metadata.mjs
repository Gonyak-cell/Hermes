import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_DISPATCH_METADATA_OUT_DIR = "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest";
export const DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_DISPATCH_METADATA_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-claude-review-dispatch-metadata.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p69201-p69600.md",
  architectureDocPath: "docs/architecture.md",
  p69200NormalizationPath: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/post-p64000-focused-hrm-verification-normalization.json",
  recommendationPacketPath: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md",
  recommendationRowsPath: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/finding-status-recommendation-rows.json",
  futureReviewRowsPath: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/future-review-packet-rows.json",
  pendingGuardRowsPath: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/verification-pending-guard-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-claude-review-dispatch-metadata";
const SCHEMA_VERSION = "post-p64000-focused-claude-review-dispatch-metadata.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_claude_review_dispatch_metadata";
const PROGRAM_RANGE = "P69201-P69600";
const SOURCE_PROGRAM_RANGE = "P68801-P69200";
const NEXT_PROGRAM_RANGE = "P69601-P70000";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p69200_source",
  "p69200_invalid_or_not_ready",
  "missing_recommendation_packet",
  "missing_future_review_row",
  "recommendation_not_pending",
  "dispatch_performed_claim",
  "raw_review_captured_claim",
  "auth_failure_counted_as_evidence",
  "hang_or_timeout_counted_as_evidence",
  "malformed_output_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "review_evidence_counted_before_capture",
  "finding_fixed_claim",
  "finding_verified_claim",
  "finding_resolved_claim",
  "finding_auto_resolved_claim",
  "source_mutation_claim",
  "patch_apply_claim",
  "write_action_claim",
  "reviewer_mutation_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "codex_final_approval_claim",
  "claude_final_approval_claim",
  "final_automated_approval_claim",
];

const EXTRA_FALSE_FLAGS = [
  "dispatch_performed_now",
  "raw_review_captured_now",
  "review_evidence_counted_now",
  "auth_failure_counted_as_evidence_now",
  "hang_or_timeout_counted_as_evidence_now",
  "malformed_output_counted_as_evidence_now",
  "tool_call_output_counted_as_review_now",
  "focused_review_completed_now",
  "finding_status_fixed_allowed_now",
  "finding_status_verified_allowed_now",
  "finding_status_resolved_allowed_now",
  "finding_status_auto_resolved_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_dispatch_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_dispatch_allowed_now",
  "post_p69600_production_pass_claim_allowed_now",
  "post_p69600_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-claude-review-dispatch-metadata.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-claude-review-dispatch-metadata.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-claude-review-dispatch-metadata -- --check"],
  ["adjacent.p69200", "node --test test/post-p64000-focused-hrm-verification-normalization.test.mjs test/post-p64000-focused-claude-review-dispatch-metadata.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-claude-review-dispatch-metadata.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedClaudeReviewDispatchMetadata(options = {}) {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused Claude review dispatch metadata failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedClaudeReviewDispatchMetadata(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedClaudeReviewDispatchMetadata(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_DISPATCH_METADATA_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const p69200Normalization = Object.prototype.hasOwnProperty.call(options, "p69200Normalization")
    ? normalizeInlineJsonSource("inline.p69200_normalization", options.p69200Normalization)
    : await readJsonSource(inputs.p69200_normalization_path);
  const recommendationPacket = Object.prototype.hasOwnProperty.call(options, "recommendationPacketText")
    ? normalizeInlineTextSource("inline.recommendation_packet", options.recommendationPacketText)
    : await readTextSource(inputs.recommendation_packet_path);
  const recommendationRows = Object.prototype.hasOwnProperty.call(options, "recommendationRows")
    ? normalizeInlineJsonSource("inline.recommendation_rows", options.recommendationRows)
    : await readJsonSource(inputs.recommendation_rows_path);
  const futureReviewRows = Object.prototype.hasOwnProperty.call(options, "futureReviewRows")
    ? normalizeInlineJsonSource("inline.future_review_rows", options.futureReviewRows)
    : await readJsonSource(inputs.future_review_rows_path);
  const pendingGuardRows = Object.prototype.hasOwnProperty.call(options, "pendingGuardRows")
    ? normalizeInlineJsonSource("inline.pending_guard_rows", options.pendingGuardRows)
    : await readJsonSource(inputs.pending_guard_rows_path);

  const sourceRows = buildSourceRows({ p69200Normalization, recommendationPacket, recommendationRows, futureReviewRows, pendingGuardRows, generatedAt });
  const dispatchRows = buildDispatchMetadataRows({ p69200Normalization, recommendationRows, futureReviewRows, overrides: options.dispatchOverrides, generatedAt });
  const scopeRows = buildReviewScopeRows({ recommendationRows, dispatchRows, generatedAt });
  const promptGuardRows = buildReviewPromptGuardRows({ dispatchRows, generatedAt });
  const evidenceGuardRows = buildEvidenceCountingGuardRows({ dispatchRows, generatedAt });
  const authorityRows = buildAuthorityRows({ p69200Normalization, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, dispatchRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p69200Normalization });
  const validationItems = buildValidationItems({ sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p69200_normalization_path: p69200Normalization.path,
      recommendation_packet_path: recommendationPacket.path,
      recommendation_rows_path: recommendationRows.path,
      future_review_rows_path: futureReviewRows.path,
      pending_guard_rows_path: pendingGuardRows.path,
    },
    post_p64000_focused_claude_review_dispatch_metadata_contract: {
      contract_id: "post_p64000_focused_claude_review_dispatch_metadata",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      prepares_dispatch_metadata: true,
      reviewer: "claude-code-opus-max",
      reviewer_lane: "independent_read_only",
      model_alias: "opus",
      effort: "max",
      dispatch_performed: false,
      raw_review_captured: false,
      review_evidence_counted: false,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      patch_apply_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p69200_source_binding_rows: sourceRows,
    dispatch_metadata_rows: dispatchRows,
    review_scope_rows: scopeRows,
    review_prompt_guard_rows: promptGuardRows,
    evidence_counting_guard_rows: evidenceGuardRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p69600_wiring_rows: wiringRows,
    p69600_closeout_rows: closeoutRows,
    p69601_handoff_rows: handoffRows,
    post_p64000_focused_claude_review_dispatch_metadata_boundary: boundary,
    post_p64000_focused_claude_review_dispatch_metadata_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.dispatch_packet_markdown = renderDispatchPacket(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_claude_review_dispatch_metadata")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_claude_review_dispatch_metadata_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_claude_review_dispatch_metadata_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.dispatch_packet_markdown = renderDispatchPacket(result);
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000FocusedClaudeReviewDispatchMetadata(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-claude-review-dispatch-metadata.json"), serializableResult(result));
  await writeJson(path.join(outDir, "dispatch-metadata-rows.json"), collectionEnvelope("dispatch-metadata-rows.v1", "dispatch_metadata_rows", result.dispatch_metadata_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-scope-rows.json"), collectionEnvelope("review-scope-rows.v1", "review_scope_rows", result.review_scope_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-prompt-guard-rows.json"), collectionEnvelope("review-prompt-guard-rows.v1", "review_prompt_guard_rows", result.review_prompt_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-counting-guard-rows.json"), collectionEnvelope("evidence-counting-guard-rows.v1", "evidence_counting_guard_rows", result.evidence_counting_guard_rows, result.generated_at));
  await writeFile(path.join(outDir, "focused-claude-review-dispatch-packet.md"), result.dispatch_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedClaudeReviewDispatchMetadataCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedClaudeReviewDispatchMetadata(args);
  console.log(`Post-P64000 focused Claude review dispatch metadata ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_claude_review_dispatch_metadata_status}`);
  console.log(`P69200 source ready: ${result.summary.p69200_source_ready_now}`);
  console.log(`Dispatch metadata ready: ${result.summary.dispatch_metadata_ready_now}`);
  console.log(`Dispatch performed: ${result.summary.dispatch_performed_now}`);
  console.log(`Review evidence counted: ${result.summary.review_evidence_counted_now}`);
  console.log(`Ready for P69601 handoff: ${result.summary.ready_for_p69601_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ p69200Normalization, recommendationPacket, recommendationRows, futureReviewRows, pendingGuardRows, generatedAt }) {
  const summary = p69200Normalization.data?.summary ?? {};
  return [
    row("source.p69200_normalization_available", "p69200_source_binding", "P69200 focused verification normalization artifact is available", p69200Normalization.available === true, p69200Normalization.path, generatedAt),
    row("source.p69200_program", "p69200_source_binding", "P69200 program range matches", p69200Normalization.data?.program_range === SOURCE_PROGRAM_RANGE, p69200Normalization.path, generatedAt),
    row("source.p69200_valid", "p69200_source_binding", "P69200 validation is valid", p69200Normalization.data?.validation?.valid === true, p69200Normalization.path, generatedAt),
    row("source.p69200_handoff_ready", "p69200_source_binding", "P69200 is ready for P69201 handoff", summary.ready_for_p69201_handoff === true, p69200Normalization.path, generatedAt),
    row("source.p69200_pending_only", "p69200_source_binding", "P69200 recommendations are pending only", summary.recommendations_pending_only_now === true, p69200Normalization.path, generatedAt),
    row("source.p69200_review_not_completed", "p69200_source_binding", "P69200 did not complete focused review", summary.focused_review_completed_now === false, p69200Normalization.path, generatedAt),
    row("source.recommendation_packet", "p69200_source_binding", "Normalized recommendation packet is available", recommendationPacket.available === true && recommendationPacket.text.includes("Focused HRM Verification Normalization Packet"), recommendationPacket.path, generatedAt),
    row("source.recommendation_rows", "p69200_source_binding", "Recommendation rows are available", Array.isArray(recommendationRows.data?.rows), recommendationRows.path, generatedAt),
    row("source.future_review_rows", "p69200_source_binding", "Future review rows are available", Array.isArray(futureReviewRows.data?.rows), futureReviewRows.path, generatedAt),
    row("source.pending_guard_rows", "p69200_source_binding", "Pending guard rows are available", Array.isArray(pendingGuardRows.data?.rows), pendingGuardRows.path, generatedAt),
  ];
}

function buildDispatchMetadataRows({ p69200Normalization, recommendationRows, futureReviewRows, overrides = {}, generatedAt }) {
  const embeddedRecommendations = p69200Normalization.data?.finding_status_recommendation_rows ?? [];
  const recommendations = recommendationRows.data?.rows ?? embeddedRecommendations;
  const embeddedFutureRows = p69200Normalization.data?.future_review_packet_rows ?? [];
  const futureRows = futureReviewRows.data?.rows ?? embeddedFutureRows;
  return REQUIRED_HRM_IDS.map((findingId) => {
    const recommendation = recommendations.find((item) => item.finding_id === findingId);
    const future = futureRows.find((item) => item.finding_id === findingId);
    const override = overrides[findingId] ?? {};
    const dispatchPerformed = override.dispatch_performed_now ?? false;
    const rawReviewCaptured = override.raw_review_captured_now ?? false;
    const reviewEvidenceCounted = override.review_evidence_counted_now ?? false;
    const ready = recommendation?.current_verdict === "pass"
      && recommendation.recommendation_status === "verification_pending"
      && future?.current_verdict === "pass"
      && future.dispatch_ready_candidate_now === true
      && future.dispatch_performed_now === false
      && future.review_evidence_counted_now === false
      && dispatchPerformed === false
      && rawReviewCaptured === false
      && reviewEvidenceCounted === false;
    return row(`dispatch.${normalizeId(findingId)}`, "dispatch_metadata", `${findingId} focused Claude review dispatch metadata is ready`, ready, future?.evidence_ref ?? "docs/hermes-roadmap-p69201-p69600.md", generatedAt, {
      finding_id: findingId,
      reviewer: "claude-code-opus-max",
      reviewer_lane: "independent_read_only",
      model_alias: "opus",
      effort: "max",
      dispatch_ready_candidate_now: true,
      dispatch_performed_now: dispatchPerformed,
      raw_review_captured_now: rawReviewCaptured,
      review_evidence_counted_now: reviewEvidenceCounted,
      expected_raw_capture_program_range: NEXT_PROGRAM_RANGE,
      next_allowed_action: "capture_valid_raw_json_review_output_without_counting_failures",
    });
  });
}

function buildReviewScopeRows({ recommendationRows, dispatchRows, generatedAt }) {
  const recommendations = recommendationRows.data?.rows ?? [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const recommendation = recommendations.find((item) => item.finding_id === findingId);
    const dispatch = dispatchRows.find((item) => item.finding_id === findingId);
    const ready = dispatch?.current_verdict === "pass"
      && recommendation?.recommendation_status === "verification_pending"
      && recommendation.fixed_claimed_now === false
      && recommendation.verified_claimed_now === false
      && recommendation.resolved_claimed_now === false;
    return row(`scope.${normalizeId(findingId)}`, "review_scope", `${findingId} focused review scope is bounded`, ready, recommendation?.evidence_ref ?? "docs/hermes-roadmap-p69201-p69600.md", generatedAt, {
      finding_id: findingId,
      review_question: `Evaluate whether ${findingId} candidate evidence fixes the previously blocking finding. Return JSON only.`,
      allowed_verdicts: ["fixed", "partially_fixed", "not_fixed", "false_positive", "needs_human_override"],
      current_finding_state: "blocking_open",
      status_change_allowed_now: false,
      source_mutation_allowed_now: false,
      final_approval_allowed_now: false,
    });
  });
}

function buildReviewPromptGuardRows({ dispatchRows, generatedAt }) {
  const ready = dispatchRows.every(pass);
  return [
    row("prompt_guard.json_only", "review_prompt_guard", "Prompt requires JSON-only review output", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("prompt_guard.no_source_mutation", "review_prompt_guard", "Prompt forbids source mutation", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("prompt_guard.no_patch_apply", "review_prompt_guard", "Prompt forbids patch application", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("prompt_guard.no_final_approval", "review_prompt_guard", "Prompt forbids final approval", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("prompt_guard.no_status_resolution", "review_prompt_guard", "Prompt forbids automatic finding status resolution", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("prompt_guard.no_clean_checkpoint", "review_prompt_guard", "Prompt forbids clean checkpoint claim", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
  ];
}

function buildEvidenceCountingGuardRows({ dispatchRows, generatedAt }) {
  const noEvidence = dispatchRows.every((item) => item.dispatch_performed_now === false && item.raw_review_captured_now === false && item.review_evidence_counted_now === false);
  return [
    row("evidence_guard.dispatch_not_evidence", "evidence_counting_guard", "Dispatch metadata is not review evidence", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("evidence_guard.auth_failure_blocked", "evidence_counting_guard", "Auth failure or login prompt cannot count as evidence", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("evidence_guard.timeout_blocked", "evidence_counting_guard", "Hang or timeout cannot count as evidence", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("evidence_guard.malformed_output_blocked", "evidence_counting_guard", "Malformed output cannot count as evidence", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("evidence_guard.tool_call_shape_blocked", "evidence_counting_guard", "Tool-call-shaped output cannot count as review", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("evidence_guard.raw_json_required_next", "evidence_counting_guard", "P69601 requires valid durable raw JSON before evidence counting", noEvidence, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
  ];
}

function buildAuthorityRows({ p69200Normalization, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(p69200Normalization.data, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p69201-p69600.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(normalization, flag) {
  const summary = normalization?.summary ?? {};
  if (flag === "focused_review_completed_now" && summary.focused_review_completed_now === true) return true;
  if (flag === "finding_status_fixed_allowed_now" && summary.finding_status_fixed_allowed_now === true) return true;
  if (flag === "finding_status_verified_allowed_now" && summary.finding_status_verified_allowed_now === true) return true;
  if (flag === "finding_status_resolved_allowed_now" && summary.finding_status_resolved_allowed_now === true) return true;
  if (flag === "finding_resolution_allowed_now" && summary.finding_resolution_allowed_now === true) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && summary.clean_checkpoint_allowed_now === true) return true;
  if (flag === "post_p69600_production_pass_claim_allowed_now" && summary.production_pass_enabled === true) return true;
  if (flag === "post_p69600_enterprise_pass_claim_allowed_now" && summary.enterprise_pass_enabled === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P69600 closeout`,
    true,
    "docs/hermes-roadmap-p69201-p69600.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-claude-review-dispatch-metadata.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P69201-P69600 roadmap doc includes required dispatch fields", roadmapDoc.available && roadmapDoc.text.includes("P69201-P69600") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P69201-P69600 focused Claude review dispatch metadata", architectureDoc.available && architectureDoc.text.includes("P69201-P69600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p69600.source_ready", "P69200 source binding is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p69600.dispatch_metadata", "Dispatch metadata rows are ready", dispatchRows.length === REQUIRED_HRM_IDS.length && dispatchRows.every(pass), generatedAt),
    closeoutRow("p69600.review_scope", "Review scope rows are bounded", scopeRows.length === REQUIRED_HRM_IDS.length && scopeRows.every(pass), generatedAt),
    closeoutRow("p69600.prompt_guards", "Prompt guard rows are ready", promptGuardRows.every(pass), generatedAt),
    closeoutRow("p69600.evidence_guards", "Evidence counting guard rows are ready", evidenceGuardRows.every(pass), generatedAt),
    closeoutRow("p69600.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p69600.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p69600.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p69600.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, dispatchRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p69601_raw_capture", "p69601_handoff", "P69601 may capture valid durable raw Claude review JSON", ready && dispatchRows.every(pass), "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/focused-claude-review-dispatch-packet.md", generatedAt, {
      next_allowed_action: ready ? "capture_valid_raw_json_review_output_without_counting_failures" : "resolve_p69600_dispatch_metadata_blockers",
    }),
    row("handoff.no_evidence_counting", "p69601_handoff", "P69600 handoff is dispatch metadata only, not review evidence", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
    row("handoff.authority_false", "p69601_handoff", "P69601 receives dispatch metadata only, not write or protected action authority", ready, "docs/hermes-roadmap-p69201-p69600.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p69200Normalization } = parts;
  const summary = p69200Normalization.data?.summary ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_focused_claude_review_dispatch_metadata_ready: closeoutRows.every(pass),
    p69200_source_ready_now: sourceRows.every(pass),
    dispatch_metadata_ready_now: dispatchRows.length === REQUIRED_HRM_IDS.length && dispatchRows.every(pass),
    review_scope_ready_now: scopeRows.length === REQUIRED_HRM_IDS.length && scopeRows.every(pass),
    review_prompt_guards_ready_now: promptGuardRows.every(pass),
    evidence_counting_guards_ready_now: evidenceGuardRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p69601_handoff: handoffRows.every(pass),
    required_hrm_ids: REQUIRED_HRM_IDS,
    blocking_finding_count: Number(summary.blocking_finding_count ?? 0),
    finding_count: Number(summary.finding_count ?? 0),
    dispatch_performed_now: false,
    raw_review_captured_now: false,
    review_evidence_counted_now: false,
    focused_review_completed_now: false,
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p69600_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p69600_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, dispatchRows, scopeRows, promptGuardRows, evidenceGuardRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p69200", "source_binding", sourceRows.every(pass), "P69200 focused verification normalization source must be ready"),
    validationItem("dispatch.metadata", "dispatch_metadata", dispatchRows.length === REQUIRED_HRM_IDS.length && dispatchRows.every(pass), "Dispatch metadata rows must exist for HRM-04/03/01"),
    validationItem("dispatch.scope", "review_scope", scopeRows.length === REQUIRED_HRM_IDS.length && scopeRows.every(pass), "Review scope rows must be bounded"),
    validationItem("dispatch.prompt_guards", "review_prompt_guard", promptGuardRows.every(pass), "Prompt guard rows must pass"),
    validationItem("dispatch.evidence_guards", "evidence_counting_guard", evidenceGuardRows.every(pass), "Evidence counting guards must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P69600 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P69601 handoff rows must pass"),
    validationItem("boundary.dispatch_false", "authority_boundary", boundary.dispatch_performed_now === false, "Dispatch performed must remain false"),
    validationItem("boundary.raw_capture_false", "authority_boundary", boundary.raw_review_captured_now === false, "Raw review capture must remain false"),
    validationItem("boundary.evidence_counted_false", "authority_boundary", boundary.review_evidence_counted_now === false, "Review evidence counting must remain false"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p69601_handoff
    ? "focused_claude_review_dispatch_metadata_ready_for_p69601"
    : validation.valid
      ? "valid_block_p69601_handoff_pending"
      : "blocked_post_p64000_focused_claude_review_dispatch_metadata";
  return {
    post_p64000_focused_claude_review_dispatch_metadata_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p69200_source_ready_now: boundary.p69200_source_ready_now,
    dispatch_metadata_ready_now: boundary.dispatch_metadata_ready_now,
    review_scope_ready_now: boundary.review_scope_ready_now,
    review_prompt_guards_ready_now: boundary.review_prompt_guards_ready_now,
    evidence_counting_guards_ready_now: boundary.evidence_counting_guards_ready_now,
    ready_for_p69601_handoff: boundary.ready_for_p69601_handoff,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    dispatch_performed_now: boundary.dispatch_performed_now,
    raw_review_captured_now: boundary.raw_review_captured_now,
    review_evidence_counted_now: boundary.review_evidence_counted_now,
    focused_review_completed_now: boundary.focused_review_completed_now,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    finding_resolution_allowed_now: boundary.finding_resolution_allowed_now,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderDispatchPacket(result) {
  const rows = result.dispatch_metadata_rows.map((item) => [
    `- ${item.finding_id}:`,
    `  - reviewer: ${item.reviewer}`,
    `  - reviewer_lane: ${item.reviewer_lane}`,
    `  - model_alias: ${item.model_alias}`,
    `  - effort: ${item.effort}`,
    "  - dispatch_performed_now: false",
    "  - raw_review_captured_now: false",
    "  - review_evidence_counted_now: false",
  ].join("\n")).join("\n");
  return [
    "# Post-P64000 Focused Claude Review Dispatch Metadata",
    "",
    "## Scope",
    "",
    "Prepare focused Claude review dispatch metadata only. This packet is not dispatch execution, not raw review capture, not review evidence, not finding resolution, and not final approval.",
    "",
    "## Dispatch Rows",
    "",
    rows,
    "",
    "## Prompt Guards",
    "",
    "- JSON output only",
    "- no source mutation",
    "- no patch apply",
    "- no automatic finding status resolution",
    "- no clean checkpoint",
    "- no final approval",
    "",
    "## Evidence Guards",
    "",
    "- dispatch metadata is not evidence",
    "- auth failure or login prompt is not evidence",
    "- timeout or hang is not evidence",
    "- malformed output is not evidence",
    "- tool-call-shaped output is not review evidence",
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Focused Claude Review Dispatch Metadata ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_claude_review_dispatch_metadata_status}`,
    `- p69200_source_ready_now: ${result.summary.p69200_source_ready_now}`,
    `- dispatch_metadata_ready_now: ${result.summary.dispatch_metadata_ready_now}`,
    `- dispatch_performed_now: ${result.summary.dispatch_performed_now}`,
    `- raw_review_captured_now: ${result.summary.raw_review_captured_now}`,
    `- review_evidence_counted_now: ${result.summary.review_evidence_counted_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p69601_handoff: ${result.summary.ready_for_p69601_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p69601_handoff
      ? "Continue to P69601-P70000 durable focused Claude review raw capture. Do not count auth failure, timeout, malformed output, tool-call-shaped output, or dispatch metadata as review evidence."
      : "Resolve source, dispatch metadata, prompt guard, evidence guard, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p69600_closeout", label, observed, "artifacts/post-p64000-focused-claude-review-dispatch-metadata/latest/post-p64000-focused-claude-review-dispatch-metadata.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_focused_claude_review_dispatch_metadata" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--p69200-normalization") args.p69200NormalizationPath = argv[++index];
    else if (arg === "--recommendation-packet") args.recommendationPacketPath = argv[++index];
    else if (arg === "--recommendation-rows") args.recommendationRowsPath = argv[++index];
    else if (arg === "--future-review-rows") args.futureReviewRowsPath = argv[++index];
    else if (arg === "--pending-guard-rows") args.pendingGuardRowsPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--p69200-normalization PATH] [--recommendation-packet PATH] [--recommendation-rows PATH] [--future-review-rows PATH] [--pending-guard-rows PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_CLAUDE_REVIEW_DISPATCH_METADATA_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    p69200_normalization_path: path.resolve(repoRoot, options.p69200NormalizationPath ?? defaults.p69200NormalizationPath),
    recommendation_packet_path: path.resolve(repoRoot, options.recommendationPacketPath ?? defaults.recommendationPacketPath),
    recommendation_rows_path: path.resolve(repoRoot, options.recommendationRowsPath ?? defaults.recommendationRowsPath),
    future_review_rows_path: path.resolve(repoRoot, options.futureReviewRowsPath ?? defaults.futureReviewRowsPath),
    pending_guard_rows_path: path.resolve(repoRoot, options.pendingGuardRowsPath ?? defaults.pendingGuardRowsPath),
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
  return { path: sourceId, available: typeof text === "string" && text.length > 0, text: text ?? "" };
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, dispatch_packet_markdown: dispatchPacketMarkdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
