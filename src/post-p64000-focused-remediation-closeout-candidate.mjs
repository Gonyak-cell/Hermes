import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_REMEDIATION_CLOSEOUT_CANDIDATE_OUT_DIR =
  "artifacts/post-p64000-focused-remediation-closeout-candidate/latest";
export const DEFAULT_POST_P64000_FOCUSED_REMEDIATION_CLOSEOUT_CANDIDATE_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-remediation-closeout-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p70401-p70800.md",
  architectureDocPath: "docs/architecture.md",
  normalizationPath:
    "artifacts/post-p64000-focused-claude-review-receipt-normalization/latest/post-p64000-focused-claude-review-receipt-normalization.json",
  normalizedReceiptPath:
    "artifacts/post-p64000-focused-claude-review-receipt-normalization/latest/normalized-focused-claude-review-receipt.json",
  findingActionRowsPath:
    "artifacts/post-p64000-focused-claude-review-receipt-normalization/latest/focused-finding-action-rows.json",
  findingLoopRowsPath:
    "artifacts/post-p64000-focused-claude-review-receipt-normalization/latest/focused-finding-loop-rows.json",
  findingClassificationRowsPath:
    "artifacts/post-p64000-focused-claude-review-receipt-normalization/latest/focused-finding-classification-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-remediation-closeout-candidate";
const SCHEMA_VERSION = "post-p64000-focused-remediation-closeout-candidate.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_remediation_closeout_candidate";
const PROGRAM_RANGE = "P70401-P70800";
const SOURCE_PROGRAM_RANGE = "P70001-P70400";
const REVIEW_EVENT_PROGRAM_RANGE = "P69601-P70000";
const REVIEWED_PROGRAM_RANGE = "P68801-P69200";
const NEXT_PROGRAM_RANGE = "P70801-P71200";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p70400_normalization_source",
  "p70400_normalization_invalid",
  "missing_normalized_focused_receipt",
  "missing_focused_finding_action_rows",
  "missing_focused_finding_loop_rows",
  "missing_focused_finding_classification_rows",
  "missing_required_hrm_blocking_finding",
  "blocking_finding_hidden",
  "candidate_claims_fixed",
  "candidate_claims_verified",
  "candidate_claims_resolved",
  "candidate_claims_reviewer_completion",
  "candidate_claims_source_mutation",
  "candidate_claims_patch_apply",
  "candidate_claims_write_action",
  "candidate_claims_clean_checkpoint",
  "candidate_claims_protected_closeout",
  "candidate_claims_production_pass",
  "candidate_claims_enterprise_pass",
  "candidate_claims_final_approval",
  "codex_final_approval_claim",
  "claude_final_approval_claim",
  "reviewer_mutation_claim",
  "finding_resolution_claim",
  "missing_per_finding_next_action",
  "missing_p70801_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "remediation_candidate_fixed_claim_allowed_now",
  "remediation_candidate_verified_claim_allowed_now",
  "remediation_candidate_resolved_claim_allowed_now",
  "re_review_completion_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_candidate_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_candidate_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_candidate_allowed_now",
  "post_p70800_production_pass_claim_allowed_now",
  "post_p70800_enterprise_pass_claim_allowed_now",
  "post_p70800_final_approval_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-remediation-closeout-candidate.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-remediation-closeout-candidate.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-remediation-closeout-candidate.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-remediation-closeout-candidate -- --check"],
  [
    "adjacent.p70400",
    "node --test test/post-p64000-focused-claude-review-receipt-normalization.test.mjs test/post-p64000-focused-remediation-closeout-candidate.test.mjs",
  ],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  [
    "package.schema.json",
    "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-remediation-closeout-candidate.schema.json\", \"utf8\"));'",
  ],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedRemediationCloseoutCandidate(options = {}) {
  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused remediation closeout candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) {
    await writePostP64000FocusedRemediationCloseoutCandidate(result, result.output_dir);
  }
  return result;
}

export async function buildPostP64000FocusedRemediationCloseoutCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_REMEDIATION_CLOSEOUT_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const normalization = Object.prototype.hasOwnProperty.call(options, "normalization")
    ? normalizeInlineJsonSource("inline.p70400_normalization", options.normalization)
    : await readJsonSource(inputs.normalization_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_focused_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);
  const findingActionRows = Object.prototype.hasOwnProperty.call(options, "findingActionRows")
    ? normalizeInlineJsonSource("inline.focused_finding_action_rows", options.findingActionRows)
    : await readJsonSource(inputs.finding_action_rows_path);
  const findingLoopRows = Object.prototype.hasOwnProperty.call(options, "findingLoopRows")
    ? normalizeInlineJsonSource("inline.focused_finding_loop_rows", options.findingLoopRows)
    : await readJsonSource(inputs.finding_loop_rows_path);
  const findingClassificationRows = Object.prototype.hasOwnProperty.call(options, "findingClassificationRows")
    ? normalizeInlineJsonSource("inline.focused_finding_classification_rows", options.findingClassificationRows)
    : await readJsonSource(inputs.finding_classification_rows_path);
  const findings = Array.isArray(options.findings)
    ? options.findings
    : Array.isArray(normalizedReceipt.data?.findings)
      ? normalizedReceipt.data.findings
      : [];

  const sourceRows = buildSourceRows({ normalization, normalizedReceipt, findingActionRows, findingLoopRows, findingClassificationRows, findings, generatedAt });
  const candidateRows = buildRemediationCandidateRows({ findings, generatedAt });
  const reReviewRows = buildReReviewPlanRows({ findings, generatedAt });
  const continuityRows = buildFindingStateContinuityRows({ findings, candidateRows, reReviewRows, generatedAt });
  const closeoutBoundaryRows = buildCloseoutCandidateBoundaryRows({ normalization, normalizedReceipt, candidateRows, reReviewRows, generatedAt });
  const authorityRows = buildAuthorityRows({ overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({
    sourceRows,
    candidateRows,
    reReviewRows,
    continuityRows,
    closeoutBoundaryRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    generatedAt,
  });
  const handoffRows = buildHandoffRows({ closeoutRows, candidateRows, reReviewRows, generatedAt });
  const boundary = buildBoundary({
    sourceRows,
    candidateRows,
    reReviewRows,
    continuityRows,
    closeoutBoundaryRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    closeoutRows,
    handoffRows,
    findings,
  });
  const validationItems = buildValidationItems({
    sourceRows,
    candidateRows,
    reReviewRows,
    continuityRows,
    closeoutBoundaryRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    closeoutRows,
    handoffRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_event_program_range: REVIEW_EVENT_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      normalization_path: normalization.path,
      normalized_receipt_path: normalizedReceipt.path,
      finding_action_rows_path: findingActionRows.path,
      finding_loop_rows_path: findingLoopRows.path,
      finding_classification_rows_path: findingClassificationRows.path,
    },
    post_p64000_focused_remediation_closeout_candidate_contract: {
      contract_id: "post_p64000_focused_remediation_closeout_candidate",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      closeout_candidate_only: true,
      re_review_plan_only: true,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      patch_apply_allowed: false,
      write_action_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      final_approval_allowed: false,
      generated_at: generatedAt,
    },
    p70400_normalization_source_rows: sourceRows,
    focused_remediation_candidate_rows: candidateRows,
    focused_re_review_plan_rows: reReviewRows,
    finding_state_continuity_rows: continuityRows,
    closeout_candidate_boundary_rows: closeoutBoundaryRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p70800_wiring_rows: wiringRows,
    p70800_closeout_rows: closeoutRows,
    p70801_handoff_rows: handoffRows,
    post_p64000_focused_remediation_closeout_candidate_boundary: boundary,
    post_p64000_focused_remediation_closeout_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.re_review_packet_markdown = renderReReviewPacket(result, findings);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_remediation_closeout_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_remediation_closeout_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_remediation_closeout_candidate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.re_review_packet_markdown = renderReReviewPacket(result, findings);
  return result;
}

export async function writePostP64000FocusedRemediationCloseoutCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-remediation-closeout-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-remediation-candidate-rows.json"), collectionEnvelope("focused-remediation-candidate-rows.v1", "focused_remediation_candidate_rows", result.focused_remediation_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "focused-re-review-plan-rows.json"), collectionEnvelope("focused-re-review-plan-rows.v1", "focused_re_review_plan_rows", result.focused_re_review_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-state-continuity-rows.json"), collectionEnvelope("finding-state-continuity-rows.v1", "finding_state_continuity_rows", result.finding_state_continuity_rows, result.generated_at));
  await writeFile(path.join(outDir, "focused-re-review-packet.md"), result.re_review_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedRemediationCloseoutCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedRemediationCloseoutCandidate(args);
  console.log(`Post-P64000 focused remediation closeout candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_remediation_closeout_candidate_status}`);
  console.log(`P70400 source ready: ${result.summary.p70400_normalization_ready_now}`);
  console.log(`Remediation candidates ready: ${result.summary.remediation_candidates_ready_now}`);
  console.log(`Re-review plan ready: ${result.summary.re_review_plan_ready_now}`);
  console.log(`Blocking findings preserved: ${result.summary.blocking_findings_preserved_now}`);
  console.log(`Ready for P70801 handoff: ${result.summary.ready_for_p70801_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function normalizeInputs(options) {
  const raw = {
    ...DEFAULT_POST_P64000_FOCUSED_REMEDIATION_CLOSEOUT_CANDIDATE_INPUTS,
    ...(options.inputs ?? {}),
  };
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: resolveInputPath(repoRoot, raw.schemaPath),
    package_path: resolveInputPath(repoRoot, raw.packagePath),
    roadmap_doc_path: resolveInputPath(repoRoot, raw.roadmapDocPath),
    architecture_doc_path: resolveInputPath(repoRoot, raw.architectureDocPath),
    normalization_path: resolveInputPath(repoRoot, raw.normalizationPath),
    normalized_receipt_path: resolveInputPath(repoRoot, raw.normalizedReceiptPath),
    finding_action_rows_path: resolveInputPath(repoRoot, raw.findingActionRowsPath),
    finding_loop_rows_path: resolveInputPath(repoRoot, raw.findingLoopRowsPath),
    finding_classification_rows_path: resolveInputPath(repoRoot, raw.findingClassificationRowsPath),
  };
}

function buildSourceRows({ normalization, normalizedReceipt, findingActionRows, findingLoopRows, findingClassificationRows, findings, generatedAt }) {
  const summary = normalization.data?.summary ?? {};
  return [
    row("source.p70400_available", "p70400_normalization_source", "P70400 normalization artifact is available", normalization.available, normalization.path, generatedAt),
    row("source.p70400_valid", "p70400_normalization_source", "P70400 normalization validation passed", normalization.data?.validation?.valid === true, normalization.path, generatedAt),
    row("source.p70400_handoff", "p70400_normalization_source", "P70400 is ready for P70401 handoff", summary.ready_for_p70401_handoff === true, normalization.path, generatedAt),
    row("source.normalized_receipt_available", "p70400_normalization_source", "Normalized focused review receipt is available", normalizedReceipt.available, normalizedReceipt.path, generatedAt),
    row("source.normalized_receipt_schema", "p70400_normalization_source", "Normalized focused review receipt has expected schema", normalizedReceipt.data?.schema_version === "post-p64000-focused-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.finding_action_rows", "p70400_normalization_source", "Focused finding action rows are available", collectionPass(findingActionRows, "focused_finding_action_rows"), findingActionRows.path, generatedAt),
    row("source.finding_loop_rows", "p70400_normalization_source", "Focused finding loop rows are available", collectionPass(findingLoopRows, "focused_finding_loop_rows"), findingLoopRows.path, generatedAt),
    row("source.finding_classification_rows", "p70400_normalization_source", "Focused finding classification rows are available", collectionPass(findingClassificationRows, "focused_finding_classification_rows"), findingClassificationRows.path, generatedAt),
    row("source.required_hrm_findings", "p70400_normalization_source", "HRM-04/03/01 focused findings are present", requiredHrmIdsPresent(findings), normalizedReceipt.path, generatedAt, {
      observed_hrm_ids: findings.map((finding) => finding.id).filter(Boolean),
    }),
    row("source.blocking_findings_visible", "p70400_normalization_source", "Focused blocking findings remain visible", requiredBlockingFindingsPresent(findings), normalizedReceipt.path, generatedAt),
  ];
}

function buildRemediationCandidateRows({ findings, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const finding = findings.find((item) => item?.id === findingId);
    const ready = isOpenBlockingFinding(finding) && hasText(finding.next_allowed_action);
    return row(`remediation_candidate.${normalizeId(findingId)}`, "focused_remediation_candidate", `${findingId} remediation closeout candidate is pending review`, ready, finding?.location ?? null, generatedAt, {
      finding_id: findingId,
      candidate_status: "candidate_pending_review",
      finding_state: finding?.normalized_status ?? "missing",
      blocking: finding?.blocks_clean_checkpoint === true,
      remediation_intent: "prepare_closeout_candidate_without_resolution_claim",
      candidate_claims_fixed_now: false,
      candidate_claims_verified_now: false,
      candidate_claims_resolved_now: false,
      candidate_claims_clean_checkpoint_now: false,
      candidate_claims_write_action_now: false,
      required_evidence_before_resolution: [
        "durable_re_review_receipt",
        "finding_specific_evidence_ref",
        "post_re_review_normalization",
      ],
      next_allowed_action: "capture_focused_re_review_or_prepare_remediation_plan_without_applying_changes",
    });
  });
}

function buildReReviewPlanRows({ findings, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const finding = findings.find((item) => item?.id === findingId);
    const ready = isOpenBlockingFinding(finding);
    return row(`re_review_plan.${normalizeId(findingId)}`, "focused_re_review_plan", `${findingId} focused re-review plan is ready`, ready, finding?.location ?? null, generatedAt, {
      finding_id: findingId,
      review_scope: "focused_hrm_finding_re_review",
      required_reviewer_lane: "independent_read_only",
      required_reviewer: "claude-code-opus-max",
      required_receipt_type: "durable_raw_json",
      reviewer_completion_observed_now: false,
      reviewer_completion_claim_allowed_now: false,
      re_review_required_now: true,
      next_allowed_action: "dispatch_re_review_request_with_p70400_receipt_and_candidate_rows",
    });
  });
}

function buildFindingStateContinuityRows({ findings, candidateRows, reReviewRows, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const finding = findings.find((item) => item?.id === findingId);
    const candidate = candidateRows.find((item) => item.finding_id === findingId);
    const reReview = reReviewRows.find((item) => item.finding_id === findingId);
    const ready = isOpenBlockingFinding(finding) && candidate?.current_verdict === "pass" && reReview?.current_verdict === "pass";
    return row(`continuity.${normalizeId(findingId)}`, "finding_state_continuity", `${findingId} remains blocking_open pending future evidence`, ready, finding?.location ?? null, generatedAt, {
      finding_id: findingId,
      source_state: finding?.normalized_status ?? "missing",
      output_state: "blocking_open",
      fixed_now: false,
      verified_now: false,
      resolved_now: false,
      clean_checkpoint_now: false,
      next_allowed_action: "preserve_blocking_state_until_valid_re_review_evidence_exists",
    });
  });
}

function buildCloseoutCandidateBoundaryRows({ normalization, normalizedReceipt, candidateRows, reReviewRows, generatedAt }) {
  const summary = normalization.data?.summary ?? {};
  const receipt = normalizedReceipt.data ?? {};
  return [
    row("boundary.source_blocks_clean", "closeout_candidate_boundary", "Source focused review still blocks clean checkpoint", summary.blocks_clean_checkpoint === true || receipt.blocks_clean_checkpoint === true, normalization.path, generatedAt),
    row("boundary.candidates_do_not_fix", "closeout_candidate_boundary", "Remediation candidates do not claim fixed/verified/resolved", candidateRows.every((item) => item.candidate_claims_fixed_now === false && item.candidate_claims_verified_now === false && item.candidate_claims_resolved_now === false), "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-remediation-candidate-rows.json", generatedAt),
    row("boundary.re_review_not_completed", "closeout_candidate_boundary", "Re-review plan does not claim reviewer completion", reReviewRows.every((item) => item.reviewer_completion_observed_now === false), "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-re-review-plan-rows.json", generatedAt),
    row("boundary.clean_checkpoint_closed", "closeout_candidate_boundary", "Clean checkpoint remains closed for P70800", true, "docs/hermes-roadmap-p70401-p70800.md", generatedAt, { clean_checkpoint_allowed_now: false }),
  ];
}

function buildAuthorityRows({ overrides = {}, generatedAt }) {
  return [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => {
    const observed = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, observed === false, "docs/hermes-roadmap-p70401-p70800.md", generatedAt, { flag, observed });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) =>
    row(`negative.${fixtureId}`, "negative_fixture_contract", `${fixtureId} is covered`, true, "test/post-p64000-focused-remediation-closeout-candidate.test.mjs", generatedAt, {
      fixture_id: fixtureId,
    }),
  );
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([id, command]) =>
    row(`validation.${id}`, "validation_command", `${id} command is defined`, true, "docs/hermes-roadmap-p70401-p70800.md", generatedAt, { command }),
  );
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-remediation-closeout-candidate.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P70401-P70800 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P70401-P70800") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p70401-p70800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P70401-P70800 focused remediation closeout candidate", architectureDoc.available && architectureDoc.text.includes("P70401-P70800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const {
    sourceRows,
    candidateRows,
    reReviewRows,
    continuityRows,
    closeoutBoundaryRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    generatedAt,
  } = parts;
  return [
    closeoutRow("p70800.source_ready", "P70400 normalization source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p70800.candidates_ready", "Focused remediation closeout candidate rows are ready", candidateRows.every(pass), generatedAt),
    closeoutRow("p70800.re_review_plan_ready", "Focused re-review plan rows are ready", reReviewRows.every(pass), generatedAt),
    closeoutRow("p70800.finding_state_preserved", "Blocking finding state is preserved", continuityRows.every(pass), generatedAt),
    closeoutRow("p70800.closeout_boundary_closed", "Clean/protected/final closeout boundaries remain closed", closeoutBoundaryRows.every(pass), generatedAt),
    closeoutRow("p70800.authority_closed", "Authority false flags remain closed", authorityRows.every(pass), generatedAt),
    closeoutRow("p70800.negative_fixtures_present", "Negative fixture contract rows are present", negativeRows.length === NEGATIVE_FIXTURES.length && negativeRows.every(pass), generatedAt),
    closeoutRow("p70800.validation_commands_present", "Validation command rows are present", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every(pass), generatedAt),
    closeoutRow("p70800.wiring_ready", "Package/docs wiring is ready", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, candidateRows, reReviewRows, generatedAt }) {
  const ready = closeoutRows.every(pass) && candidateRows.every(pass) && reReviewRows.every(pass);
  return [
    row("handoff.p70801_re_review_or_remediation_plan", "p70801_handoff", "P70801 may capture focused re-review or prepare stricter remediation plan without clean claim", ready, "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-re-review-packet.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
      next_allowed_action: "capture_focused_re_review_or_prepare_stricter_remediation_plan_without_clean_closeout",
      clean_checkpoint_allowed_now: false,
      protected_closeout_allowed_now: false,
    }),
  ];
}

function buildBoundary(parts) {
  const allRows = [
    ...parts.sourceRows,
    ...parts.candidateRows,
    ...parts.reReviewRows,
    ...parts.continuityRows,
    ...parts.closeoutBoundaryRows,
    ...parts.authorityRows,
    ...parts.negativeRows,
    ...parts.validationRows,
    ...parts.wiringRows,
    ...parts.closeoutRows,
    ...parts.handoffRows,
  ];
  const base = Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, false]));
  return {
    ...base,
    p70400_normalization_ready_now: parts.sourceRows.every(pass),
    remediation_candidates_ready_now: parts.candidateRows.every(pass),
    re_review_plan_ready_now: parts.reReviewRows.every(pass),
    blocking_findings_preserved_now: parts.continuityRows.every(pass),
    closeout_candidate_boundary_ready_now: parts.closeoutBoundaryRows.every(pass),
    ready_for_p70801_handoff: parts.handoffRows.every(pass),
    finding_count: parts.findings.length,
    blocking_finding_count: parts.findings.filter(isOpenBlockingFinding).length,
    all_rows_pass_now: allRows.every(pass),
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  };
}

function buildValidationItems(parts) {
  const items = [];
  for (const [name, rows] of [
    ["source", parts.sourceRows],
    ["candidate", parts.candidateRows],
    ["re_review", parts.reReviewRows],
    ["continuity", parts.continuityRows],
    ["boundary", parts.closeoutBoundaryRows],
    ["authority", parts.authorityRows],
    ["negative", parts.negativeRows],
    ["validation", parts.validationRows],
    ["wiring", parts.wiringRows],
    ["closeout", parts.closeoutRows],
    ["handoff", parts.handoffRows],
  ]) {
    rows.forEach((item) => {
      if (!pass(item)) items.push(validationItem(`${name}.${item.row_id}`, name, false, item.block_reason ?? item.label));
    });
  }
  if (parts.negativeRows.length !== NEGATIVE_FIXTURES.length) {
    items.push(validationItem("negative.coverage", "negative", false, "All negative fixture rows must be present"));
  }
  if (parts.boundary.clean_checkpoint_allowed_now !== false) {
    items.push(validationItem("boundary.clean", "authority", false, "Clean checkpoint must remain false"));
  }
  if (parts.boundary.production_pass_enabled !== false || parts.boundary.enterprise_pass_enabled !== false || parts.boundary.final_approval_enabled !== false) {
    items.push(validationItem("boundary.finality", "authority", false, "Production, enterprise, and final approval must remain false"));
  }
  if (items.length === 0) items.push(validationItem("all.pass", "aggregate", true, "All P70401-P70800 validation rows passed"));
  return items;
}

function buildSummary({ boundary, validation }) {
  return {
    post_p64000_focused_remediation_closeout_candidate_status:
      validation.valid && boundary.ready_for_p70801_handoff
        ? "focused_remediation_closeout_candidate_ready_for_p70801"
        : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_event_program_range: REVIEW_EVENT_PROGRAM_RANGE,
    reviewed_program_range: REVIEWED_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p70400_normalization_ready_now: boundary.p70400_normalization_ready_now,
    remediation_candidates_ready_now: boundary.remediation_candidates_ready_now,
    re_review_plan_ready_now: boundary.re_review_plan_ready_now,
    blocking_findings_preserved_now: boundary.blocking_findings_preserved_now,
    ready_for_p70801_handoff: boundary.ready_for_p70801_handoff,
    finding_count: boundary.finding_count,
    blocking_finding_count: boundary.blocking_finding_count,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    validation_error_count: validation.error_count,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# P70401-P70800 Focused Remediation Closeout Candidate",
    "",
    `Status: ${summary.post_p64000_focused_remediation_closeout_candidate_status}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    `Blocking findings: ${summary.blocking_finding_count}`,
    `Ready for P70801 handoff: ${summary.ready_for_p70801_handoff}`,
    "",
    "## Authority Boundary",
    "",
    `Clean checkpoint allowed: ${summary.clean_checkpoint_allowed_now}`,
    `Production PASS enabled: ${summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${summary.enterprise_pass_enabled}`,
    `Final approval enabled: ${summary.final_approval_enabled}`,
    "",
    "## Next Action",
    "",
    "Capture focused re-review evidence or prepare a stricter remediation implementation plan. Do not claim fixed, verified, resolved, clean closeout, protected closeout, production PASS, enterprise PASS, or final approval in this tranche.",
    "",
  ].join("\n");
}

function renderReReviewPacket(result, findings) {
  const lines = [
    "# Focused Re-Review Packet",
    "",
    `Program: ${result.program_range}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    "",
    "## Findings",
    "",
  ];
  for (const finding of findings) {
    lines.push(`- ${finding.id}: ${finding.normalized_status ?? "unknown"}; next=${finding.next_allowed_action ?? "missing"}`);
  }
  lines.push("", "## Boundary", "", "This packet is a re-review plan only. It is not a clean checkpoint, protected closeout, production PASS, enterprise PASS, or final approval.", "");
  return lines.join("\n");
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const current = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: current,
    current_verdict: current ? "pass" : "block",
    evidence_ref: evidenceRef ?? null,
    output_ref: null,
    block_reason: current ? null : label,
    next_allowed_action: extra.next_allowed_action ?? null,
    generated_at: generatedAt,
    ...extra,
  };
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p70800_closeout", label, observed, "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/post-p64000-focused-remediation-closeout-candidate.json", generatedAt);
}

function validationItem(id, category, valid, message) {
  return {
    id,
    category,
    valid,
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.valid === false).map((item) => ({ path: item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function pass(item) {
  return item?.current_verdict === "pass";
}

function isOpenBlockingFinding(finding) {
  return finding?.id && finding.blocks_clean_checkpoint === true && finding.normalized_status === "blocking_open";
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredHrmIdsPresent(findings) {
  return REQUIRED_HRM_IDS.every((findingId) => findings.some((finding) => finding?.id === findingId));
}

function requiredBlockingFindingsPresent(findings) {
  return REQUIRED_HRM_IDS.every((findingId) => isOpenBlockingFinding(findings.find((finding) => finding?.id === findingId)));
}

function collectionPass(source, collectionName) {
  return source.available && source.data?.collection === collectionName && Array.isArray(source.data?.rows) && source.data.rows.length >= REQUIRED_HRM_IDS.length;
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    collection,
    generated_at: generatedAt,
    rows,
  };
}

function serializableResult(result) {
  const { markdown, re_review_packet_markdown: reReviewPacketMarkdown, ...serializable } = result;
  return serializable;
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      data: JSON.parse(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      error: error.message,
      data: null,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      error: error.message,
      text: "",
    };
  }
}

function normalizeInlineJsonSource(name, data) {
  return {
    path: name,
    available: true,
    text: JSON.stringify(data),
    data,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function resolveInputPath(repoRoot, inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(repoRoot, inputPath);
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--repo-root") {
      args.repoRoot = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`${COMMAND_NAME}

Usage:
  npm run ${COMMAND_NAME}
  npm run ${COMMAND_NAME} -- --check

Options:
  --check       Validate without writing artifacts.
  --out-dir    Override output directory.
  --repo-root  Override repository root for source refs.
`);
}
