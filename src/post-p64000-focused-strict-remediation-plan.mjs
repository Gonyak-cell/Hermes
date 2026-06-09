import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_STRICT_REMEDIATION_PLAN_OUT_DIR =
  "artifacts/post-p64000-focused-strict-remediation-plan/latest";
export const DEFAULT_POST_P64000_FOCUSED_STRICT_REMEDIATION_PLAN_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-strict-remediation-plan.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p70801-p71200.md",
  architectureDocPath: "docs/architecture.md",
  candidatePath:
    "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/post-p64000-focused-remediation-closeout-candidate.json",
  remediationCandidateRowsPath:
    "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-remediation-candidate-rows.json",
  reReviewPlanRowsPath:
    "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-re-review-plan-rows.json",
  continuityRowsPath:
    "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/finding-state-continuity-rows.json",
  reReviewPacketPath:
    "artifacts/post-p64000-focused-remediation-closeout-candidate/latest/focused-re-review-packet.md",
};

const COMMAND_NAME = "platform:post-p64000-focused-strict-remediation-plan";
const SCHEMA_VERSION = "post-p64000-focused-strict-remediation-plan.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_strict_remediation_plan";
const PROGRAM_RANGE = "P70801-P71200";
const SOURCE_PROGRAM_RANGE = "P70401-P70800";
const REVIEW_SOURCE_PROGRAM_RANGE = "P70001-P70400";
const NEXT_PROGRAM_RANGE = "P71201-P71600";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p70800_candidate_source",
  "p70800_candidate_invalid",
  "missing_remediation_candidate_rows",
  "missing_re_review_plan_rows",
  "missing_continuity_rows",
  "missing_re_review_packet",
  "missing_required_hrm_plan_row",
  "strict_plan_claims_patch_apply",
  "strict_plan_claims_write_action",
  "strict_plan_claims_source_mutation",
  "strict_plan_claims_fixed",
  "strict_plan_claims_verified",
  "strict_plan_claims_resolved",
  "strict_plan_claims_re_review_evidence_exists",
  "strict_plan_claims_clean_checkpoint",
  "strict_plan_claims_protected_closeout",
  "strict_plan_claims_production_pass",
  "strict_plan_claims_enterprise_pass",
  "strict_plan_claims_final_approval",
  "reviewer_mutation_claim",
  "finding_resolution_claim",
  "missing_evidence_requirement",
  "missing_dispatch_readiness",
  "missing_next_allowed_action",
  "missing_p71201_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "strict_plan_patch_apply_allowed_now",
  "strict_plan_write_action_allowed_now",
  "strict_plan_source_mutation_allowed_now",
  "strict_plan_fixed_claim_allowed_now",
  "strict_plan_verified_claim_allowed_now",
  "strict_plan_resolved_claim_allowed_now",
  "strict_plan_re_review_evidence_observed_now",
  "strict_plan_reviewer_completion_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "finding_resolution_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_strict_plan_allowed_now",
  "post_p71200_production_pass_claim_allowed_now",
  "post_p71200_enterprise_pass_claim_allowed_now",
  "post_p71200_final_approval_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-strict-remediation-plan.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-strict-remediation-plan.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-strict-remediation-plan.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-strict-remediation-plan -- --check"],
  [
    "adjacent.p70800",
    "node --test test/post-p64000-focused-remediation-closeout-candidate.test.mjs test/post-p64000-focused-strict-remediation-plan.test.mjs",
  ],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  [
    "package.schema.json",
    "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-strict-remediation-plan.schema.json\", \"utf8\"));'",
  ],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedStrictRemediationPlan(options = {}) {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused strict remediation plan failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedStrictRemediationPlan(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedStrictRemediationPlan(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_STRICT_REMEDIATION_PLAN_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const candidate = Object.prototype.hasOwnProperty.call(options, "candidate")
    ? normalizeInlineJsonSource("inline.p70800_candidate", options.candidate)
    : await readJsonSource(inputs.candidate_path);
  const remediationCandidateRows = Object.prototype.hasOwnProperty.call(options, "remediationCandidateRows")
    ? normalizeInlineJsonSource("inline.remediation_candidate_rows", options.remediationCandidateRows)
    : await readJsonSource(inputs.remediation_candidate_rows_path);
  const reReviewPlanRows = Object.prototype.hasOwnProperty.call(options, "reReviewPlanRows")
    ? normalizeInlineJsonSource("inline.re_review_plan_rows", options.reReviewPlanRows)
    : await readJsonSource(inputs.re_review_plan_rows_path);
  const continuityRows = Object.prototype.hasOwnProperty.call(options, "continuityRows")
    ? normalizeInlineJsonSource("inline.continuity_rows", options.continuityRows)
    : await readJsonSource(inputs.continuity_rows_path);
  const reReviewPacket = Object.prototype.hasOwnProperty.call(options, "reReviewPacket")
    ? normalizeInlineTextSource("inline.re_review_packet", options.reReviewPacket)
    : await readTextSource(inputs.re_review_packet_path);

  const sourceRows = buildSourceRows({ candidate, remediationCandidateRows, reReviewPlanRows, continuityRows, reReviewPacket, generatedAt });
  const strictPlanRows = buildStrictPlanRows({ remediationCandidateRows, generatedAt });
  const dispatchRows = buildDispatchReadinessRows({ reReviewPlanRows, reReviewPacket, generatedAt });
  const evidenceRows = buildEvidenceRequirementRows({ strictPlanRows, generatedAt });
  const continuityOutputRows = buildFindingStateContinuityRows({ continuityRows, strictPlanRows, generatedAt });
  const authorityRows = buildAuthorityRows({ overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, strictPlanRows, dispatchRows, evidenceRows, continuityOutputRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, dispatchRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, strictPlanRows, dispatchRows, evidenceRows, continuityOutputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, strictPlanRows, dispatchRows, evidenceRows, continuityOutputRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      candidate_path: candidate.path,
      remediation_candidate_rows_path: remediationCandidateRows.path,
      re_review_plan_rows_path: reReviewPlanRows.path,
      continuity_rows_path: continuityRows.path,
      re_review_packet_path: reReviewPacket.path,
    },
    post_p64000_focused_strict_remediation_plan_contract: {
      contract_id: "post_p64000_focused_strict_remediation_plan",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      strict_plan_only: true,
      dispatch_readiness_only: true,
      re_review_evidence_observed: false,
      patch_apply_allowed: false,
      write_action_allowed: false,
      source_mutation_allowed: false,
      finding_resolution_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      final_approval_allowed: false,
      generated_at: generatedAt,
    },
    p70800_candidate_source_rows: sourceRows,
    strict_remediation_plan_rows: strictPlanRows,
    re_review_dispatch_readiness_rows: dispatchRows,
    evidence_requirement_rows: evidenceRows,
    finding_state_continuity_rows: continuityOutputRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p71200_wiring_rows: wiringRows,
    p71200_closeout_rows: closeoutRows,
    p71201_handoff_rows: handoffRows,
    post_p64000_focused_strict_remediation_plan_boundary: boundary,
    post_p64000_focused_strict_remediation_plan_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.strict_remediation_plan_markdown = renderStrictPlanPacket(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_strict_remediation_plan")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_strict_remediation_plan_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_strict_remediation_plan_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.strict_remediation_plan_markdown = renderStrictPlanPacket(result);
  return result;
}

export async function writePostP64000FocusedStrictRemediationPlan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-strict-remediation-plan.json"), serializableResult(result));
  await writeJson(path.join(outDir, "strict-remediation-plan-rows.json"), collectionEnvelope("strict-remediation-plan-rows.v1", "strict_remediation_plan_rows", result.strict_remediation_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "re-review-dispatch-readiness-rows.json"), collectionEnvelope("re-review-dispatch-readiness-rows.v1", "re_review_dispatch_readiness_rows", result.re_review_dispatch_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-requirement-rows.json"), collectionEnvelope("evidence-requirement-rows.v1", "evidence_requirement_rows", result.evidence_requirement_rows, result.generated_at));
  await writeFile(path.join(outDir, "strict-remediation-plan-packet.md"), result.strict_remediation_plan_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedStrictRemediationPlanCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedStrictRemediationPlan(args);
  console.log(`Post-P64000 focused strict remediation plan ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_strict_remediation_plan_status}`);
  console.log(`P70800 source ready: ${result.summary.p70800_candidate_ready_now}`);
  console.log(`Strict plans ready: ${result.summary.strict_remediation_plans_ready_now}`);
  console.log(`Dispatch readiness ready: ${result.summary.re_review_dispatch_ready_now}`);
  console.log(`Evidence requirements ready: ${result.summary.evidence_requirements_ready_now}`);
  console.log(`Ready for P71201 handoff: ${result.summary.ready_for_p71201_handoff}`);
  console.log(`Re-review evidence observed: ${result.summary.re_review_evidence_observed_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function normalizeInputs(options) {
  const raw = {
    ...DEFAULT_POST_P64000_FOCUSED_STRICT_REMEDIATION_PLAN_INPUTS,
    ...(options.inputs ?? {}),
  };
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: resolveInputPath(repoRoot, raw.schemaPath),
    package_path: resolveInputPath(repoRoot, raw.packagePath),
    roadmap_doc_path: resolveInputPath(repoRoot, raw.roadmapDocPath),
    architecture_doc_path: resolveInputPath(repoRoot, raw.architectureDocPath),
    candidate_path: resolveInputPath(repoRoot, raw.candidatePath),
    remediation_candidate_rows_path: resolveInputPath(repoRoot, raw.remediationCandidateRowsPath),
    re_review_plan_rows_path: resolveInputPath(repoRoot, raw.reReviewPlanRowsPath),
    continuity_rows_path: resolveInputPath(repoRoot, raw.continuityRowsPath),
    re_review_packet_path: resolveInputPath(repoRoot, raw.reReviewPacketPath),
  };
}

function buildSourceRows({ candidate, remediationCandidateRows, reReviewPlanRows, continuityRows, reReviewPacket, generatedAt }) {
  const summary = candidate.data?.summary ?? {};
  return [
    row("source.p70800_available", "p70800_candidate_source", "P70800 candidate artifact is available", candidate.available, candidate.path, generatedAt),
    row("source.p70800_valid", "p70800_candidate_source", "P70800 candidate validation passed", candidate.data?.validation?.valid === true, candidate.path, generatedAt),
    row("source.p70800_handoff", "p70800_candidate_source", "P70800 is ready for P70801 handoff", summary.ready_for_p70801_handoff === true, candidate.path, generatedAt),
    row("source.remediation_candidate_rows", "p70800_candidate_source", "Remediation candidate rows are available", collectionPass(remediationCandidateRows, "focused_remediation_candidate_rows"), remediationCandidateRows.path, generatedAt),
    row("source.re_review_plan_rows", "p70800_candidate_source", "Re-review plan rows are available", collectionPass(reReviewPlanRows, "focused_re_review_plan_rows"), reReviewPlanRows.path, generatedAt),
    row("source.continuity_rows", "p70800_candidate_source", "Finding state continuity rows are available", collectionPass(continuityRows, "finding_state_continuity_rows"), continuityRows.path, generatedAt),
    row("source.re_review_packet", "p70800_candidate_source", "Focused re-review packet is available", reReviewPacket.available && reReviewPacket.text.includes("Focused Re-Review Packet"), reReviewPacket.path, generatedAt),
    row("source.source_does_not_clean", "p70800_candidate_source", "P70800 source does not allow clean checkpoint", summary.clean_checkpoint_allowed_now === false, candidate.path, generatedAt),
  ];
}

function buildStrictPlanRows({ remediationCandidateRows, generatedAt }) {
  const sourceRows = Array.isArray(remediationCandidateRows.data?.rows) ? remediationCandidateRows.data.rows : [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const candidate = sourceRows.find((item) => item?.finding_id === findingId);
    const ready = candidate?.current_verdict === "pass" && candidate?.candidate_status === "candidate_pending_review";
    return row(`strict_plan.${normalizeId(findingId)}`, "strict_remediation_plan", `${findingId} strict remediation plan is ready`, ready, candidate?.evidence_ref ?? null, generatedAt, {
      finding_id: findingId,
      plan_status: "planned_pending_execution_and_review",
      candidate_status: candidate?.candidate_status ?? "missing",
      patch_apply_now: false,
      write_action_now: false,
      source_mutation_now: false,
      fixed_claimed_now: false,
      verified_claimed_now: false,
      resolved_claimed_now: false,
      re_review_evidence_observed_now: false,
      required_steps: [
        "identify_minimal_contract_change_candidate",
        "prepare_diff_or_config_candidate_without_applying",
        "bind_candidate_to_finding_specific_evidence_ref",
        "route_to_independent_re_review_before_resolution",
      ],
      next_allowed_action: "prepare_candidate_patch_packet_or_re_review_dispatch_without_applying_changes",
    });
  });
}

function buildDispatchReadinessRows({ reReviewPlanRows, reReviewPacket, generatedAt }) {
  const sourceRows = Array.isArray(reReviewPlanRows.data?.rows) ? reReviewPlanRows.data.rows : [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const plan = sourceRows.find((item) => item?.finding_id === findingId);
    const ready = plan?.current_verdict === "pass" && plan?.re_review_required_now === true && reReviewPacket.available;
    return row(`dispatch_readiness.${normalizeId(findingId)}`, "re_review_dispatch_readiness", `${findingId} re-review dispatch readiness is prepared`, ready, reReviewPacket.path, generatedAt, {
      finding_id: findingId,
      dispatch_status: "ready_to_dispatch_not_reviewed",
      required_reviewer: "claude-code-opus-max",
      required_reviewer_lane: "independent_read_only",
      required_receipt_type: "durable_raw_json",
      re_review_required_now: true,
      re_review_evidence_observed_now: false,
      reviewer_completion_claim_allowed_now: false,
      next_allowed_action: "dispatch_focused_re_review_request_and_capture_durable_raw_json",
    });
  });
}

function buildEvidenceRequirementRows({ strictPlanRows, generatedAt }) {
  return strictPlanRows.map((plan) =>
    row(`evidence_requirement.${normalizeId(plan.finding_id)}`, "evidence_requirement", `${plan.finding_id} requires future evidence before any resolution`, plan.current_verdict === "pass", "docs/hermes-roadmap-p70801-p71200.md", generatedAt, {
      finding_id: plan.finding_id,
      required_before_fixed_claim: [
        "candidate_patch_or_config_ref",
        "durable_re_review_raw_json_ref",
        "normalized_re_review_receipt_ref",
        "finding_specific_verification_ref",
      ],
      evidence_present_now: false,
      fixed_verified_resolved_allowed_now: false,
      next_allowed_action: "collect_future_evidence_before_any_status_change",
    }),
  );
}

function buildFindingStateContinuityRows({ continuityRows, strictPlanRows, generatedAt }) {
  const sourceRows = Array.isArray(continuityRows.data?.rows) ? continuityRows.data.rows : [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const continuity = sourceRows.find((item) => item?.finding_id === findingId);
    const plan = strictPlanRows.find((item) => item.finding_id === findingId);
    const ready = continuity?.current_verdict === "pass" && continuity?.output_state === "blocking_open" && plan?.current_verdict === "pass";
    return row(`continuity.${normalizeId(findingId)}`, "finding_state_continuity", `${findingId} remains blocking_open while strict plan is pending`, ready, continuity?.evidence_ref ?? null, generatedAt, {
      finding_id: findingId,
      source_state: continuity?.output_state ?? "missing",
      output_state: "blocking_open",
      fixed_now: false,
      verified_now: false,
      resolved_now: false,
      next_allowed_action: "preserve_blocking_state_until_re_review_evidence_is_normalized",
    });
  });
}

function buildAuthorityRows({ overrides = {}, generatedAt }) {
  return [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => {
    const observed = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, observed === false, "docs/hermes-roadmap-p70801-p71200.md", generatedAt, { flag, observed });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) =>
    row(`negative.${fixtureId}`, "negative_fixture_contract", `${fixtureId} is covered`, true, "test/post-p64000-focused-strict-remediation-plan.test.mjs", generatedAt, { fixture_id: fixtureId }),
  );
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([id, command]) =>
    row(`validation.${id}`, "validation_command", `${id} command is defined`, true, "docs/hermes-roadmap-p70801-p71200.md", generatedAt, { command }),
  );
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-strict-remediation-plan.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P70801-P71200 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P70801-P71200") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p70801-p71200.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P70801-P71200 focused strict remediation plan", architectureDoc.available && architectureDoc.text.includes("P70801-P71200"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const {
    sourceRows,
    strictPlanRows,
    dispatchRows,
    evidenceRows,
    continuityOutputRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    generatedAt,
  } = parts;
  return [
    closeoutRow("p71200.source_ready", "P70800 source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p71200.strict_plans_ready", "Strict remediation plan rows are ready", strictPlanRows.every(pass), generatedAt),
    closeoutRow("p71200.dispatch_readiness_ready", "Re-review dispatch readiness rows are ready", dispatchRows.every(pass), generatedAt),
    closeoutRow("p71200.evidence_requirements_ready", "Evidence requirement rows are ready", evidenceRows.every(pass), generatedAt),
    closeoutRow("p71200.finding_state_preserved", "Blocking finding state is preserved", continuityOutputRows.every(pass), generatedAt),
    closeoutRow("p71200.authority_closed", "Authority false flags remain closed", authorityRows.every(pass), generatedAt),
    closeoutRow("p71200.negative_fixtures_present", "Negative fixture contract rows are present", negativeRows.length === NEGATIVE_FIXTURES.length && negativeRows.every(pass), generatedAt),
    closeoutRow("p71200.validation_commands_present", "Validation command rows are present", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every(pass), generatedAt),
    closeoutRow("p71200.wiring_ready", "Package/docs wiring is ready", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, dispatchRows, generatedAt }) {
  const ready = closeoutRows.every(pass) && dispatchRows.every(pass);
  return [
    row("handoff.p71201_focused_re_review_capture", "p71201_handoff", "P71201 may dispatch focused re-review and capture durable raw JSON without clean claim", ready, "artifacts/post-p64000-focused-strict-remediation-plan/latest/strict-remediation-plan-packet.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
      next_allowed_action: "dispatch_focused_re_review_and_capture_durable_raw_json_without_clean_closeout",
      re_review_evidence_observed_now: false,
      clean_checkpoint_allowed_now: false,
      protected_closeout_allowed_now: false,
    }),
  ];
}

function buildBoundary(parts) {
  const allRows = [
    ...parts.sourceRows,
    ...parts.strictPlanRows,
    ...parts.dispatchRows,
    ...parts.evidenceRows,
    ...parts.continuityOutputRows,
    ...parts.authorityRows,
    ...parts.negativeRows,
    ...parts.validationRows,
    ...parts.wiringRows,
    ...parts.closeoutRows,
    ...parts.handoffRows,
  ];
  const falseFlags = Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, false]));
  return {
    ...falseFlags,
    p70800_candidate_ready_now: parts.sourceRows.every(pass),
    strict_remediation_plans_ready_now: parts.strictPlanRows.every(pass),
    re_review_dispatch_ready_now: parts.dispatchRows.every(pass),
    evidence_requirements_ready_now: parts.evidenceRows.every(pass),
    blocking_findings_preserved_now: parts.continuityOutputRows.every(pass),
    ready_for_p71201_handoff: parts.handoffRows.every(pass),
    finding_count: parts.strictPlanRows.length,
    blocking_finding_count: parts.continuityOutputRows.filter(pass).length,
    all_rows_pass_now: allRows.every(pass),
    re_review_evidence_observed_now: false,
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
    ["strict_plan", parts.strictPlanRows],
    ["dispatch", parts.dispatchRows],
    ["evidence", parts.evidenceRows],
    ["continuity", parts.continuityOutputRows],
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
  if (parts.boundary.re_review_evidence_observed_now !== false) {
    items.push(validationItem("boundary.review_evidence", "authority", false, "Re-review evidence must remain unobserved in P71200"));
  }
  if (parts.boundary.clean_checkpoint_allowed_now !== false || parts.boundary.final_approval_enabled !== false) {
    items.push(validationItem("boundary.finality", "authority", false, "Clean checkpoint and final approval must remain false"));
  }
  if (items.length === 0) items.push(validationItem("all.pass", "aggregate", true, "All P70801-P71200 validation rows passed"));
  return items;
}

function buildSummary({ boundary, validation }) {
  return {
    post_p64000_focused_strict_remediation_plan_status:
      validation.valid && boundary.ready_for_p71201_handoff
        ? "focused_strict_remediation_plan_ready_for_p71201"
        : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p70800_candidate_ready_now: boundary.p70800_candidate_ready_now,
    strict_remediation_plans_ready_now: boundary.strict_remediation_plans_ready_now,
    re_review_dispatch_ready_now: boundary.re_review_dispatch_ready_now,
    evidence_requirements_ready_now: boundary.evidence_requirements_ready_now,
    blocking_findings_preserved_now: boundary.blocking_findings_preserved_now,
    ready_for_p71201_handoff: boundary.ready_for_p71201_handoff,
    finding_count: boundary.finding_count,
    blocking_finding_count: boundary.blocking_finding_count,
    re_review_evidence_observed_now: boundary.re_review_evidence_observed_now,
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
    "# P70801-P71200 Focused Strict Remediation Plan",
    "",
    `Status: ${summary.post_p64000_focused_strict_remediation_plan_status}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    `Strict plans ready: ${summary.strict_remediation_plans_ready_now}`,
    `Re-review dispatch ready: ${summary.re_review_dispatch_ready_now}`,
    `Ready for P71201 handoff: ${summary.ready_for_p71201_handoff}`,
    "",
    "## Authority Boundary",
    "",
    `Re-review evidence observed: ${summary.re_review_evidence_observed_now}`,
    `Clean checkpoint allowed: ${summary.clean_checkpoint_allowed_now}`,
    `Production PASS enabled: ${summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${summary.enterprise_pass_enabled}`,
    `Final approval enabled: ${summary.final_approval_enabled}`,
    "",
    "## Next Action",
    "",
    "Dispatch focused re-review and capture durable raw JSON. Do not apply patches, mutate source, claim fixed/verified/resolved, or open clean/protected/production/enterprise/final approval.",
    "",
  ].join("\n");
}

function renderStrictPlanPacket(result) {
  const lines = [
    "# Focused Strict Remediation Plan Packet",
    "",
    `Program: ${result.program_range}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    "",
    "## Plan Rows",
    "",
  ];
  for (const rowItem of result.strict_remediation_plan_rows) {
    lines.push(`- ${rowItem.finding_id}: ${rowItem.plan_status}; next=${rowItem.next_allowed_action}`);
  }
  lines.push("", "## Boundary", "", "This packet prepares a strict remediation plan and re-review dispatch readiness only. It is not evidence of remediation, review completion, clean checkpoint, production PASS, enterprise PASS, or final approval.", "");
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
  return row(rowId, "p71200_closeout", label, observed, "artifacts/post-p64000-focused-strict-remediation-plan/latest/post-p64000-focused-strict-remediation-plan.json", generatedAt);
}

function validationItem(id, category, valid, message) {
  return { id, category, valid, message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.valid === false).map((item) => ({ path: item.id, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function pass(item) {
  return item?.current_verdict === "pass";
}

function collectionPass(source, collectionName) {
  return source.available && source.data?.collection === collectionName && Array.isArray(source.data?.rows) && source.data.rows.length >= REQUIRED_HRM_IDS.length;
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, collection, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, strict_remediation_plan_markdown: strictRemediationPlanMarkdown, ...serializable } = result;
  return serializable;
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: filePath, available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, error: error.message, text: "" };
  }
}

function normalizeInlineJsonSource(name, data) {
  return { path: name, available: true, text: JSON.stringify(data), data };
}

function normalizeInlineTextSource(name, text) {
  return { path: name, available: true, text: String(text ?? "") };
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
  const args = { check: false, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--repo-root") {
      args.repoRoot = argv[++index];
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
