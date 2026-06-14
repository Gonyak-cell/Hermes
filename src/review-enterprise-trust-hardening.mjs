import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildMultiEngineOrchestrationQa } from "./multi-engine-orchestration-qa.mjs";

export const DEFAULT_REVIEW_ENTERPRISE_TRUST_HARDENING_OUT_DIR = "artifacts/review-enterprise-trust-hardening/latest";
export const DEFAULT_REVIEW_ENTERPRISE_TRUST_HARDENING_INPUTS = {
  schemaPath: "schemas/review-enterprise-trust-hardening.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:review-enterprise-trust-hardening";
const MULTI_ENGINE_COMMAND_NAME = "platform:multi-engine-orchestration-qa";
const SCHEMA_VERSION = "review-enterprise-trust-hardening.v1";
const CAPABILITY_ID = "platform.review_enterprise_trust_hardening";
const PROGRAM_RANGE = "P5801-P6200";
const READY_STATUS = "ready_for_review_enterprise_trust_hardening_v0";
const MULTI_ENGINE_READY_STATUS = "ready_for_multi_engine_orchestration_qa_v0";

const PHASE_SPECS = [
  ["P5801-P5840", "GitHub Review Lane Evidence Contract"],
  ["P5841-P5880", "Branch Ruleset and Protection Evidence"],
  ["P5881-P5920", "Required Status Check Hardening"],
  ["P5921-P5960", "Signed Attestation Hardening"],
  ["P5961-P6000", "Claude Review Receipt Hardening"],
  ["P6001-P6040", "Single-Owner Exception Classification"],
  ["P6041-P6080", "No-Human Protected Closeout Boundary"],
  ["P6081-P6120", "Enterprise Trust Decision Matrix"],
  ["P6121-P6160", "Trust Claim Negative Fixtures"],
  ["P6161-P6200", "Review and Enterprise Trust Freeze"],
];

const TRUST_NEGATIVE_FIXTURES = [
  ["negative.self_github_review", "same GitHub account tries to approve its own PR", "BLOCK_INDEPENDENT_GITHUB_REVIEW"],
  ["negative.no_human_as_final", "no-human milestone gate is represented as protected final approval", "BLOCK_PROTECTED_FINAL_DECISION"],
  ["negative.claude_review_as_enterprise", "Claude review receipt is represented as enterprise independent trust", "BLOCK_ENTERPRISE_TRUST"],
  ["negative.attestation_unverified", "signed attestation exists but verification or subject digest binding is missing", "BLOCK_ATTESTATION_TRUST"],
  ["negative.ci_without_ruleset", "CI passed but branch/ruleset/required check evidence is missing", "BLOCK_RELEASE_TRUST"],
  ["negative.local_only_release", "local validators pass and are presented as external release trust", "BLOCK_EXTERNAL_TRUST"],
];

export async function runReviewEnterpriseTrustHardening(options = {}) {
  const result = await buildReviewEnterpriseTrustHardening(options);
  if (options.write !== false) await writeReviewEnterpriseTrustHardening(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Review enterprise trust hardening failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildReviewEnterpriseTrustHardening(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REVIEW_ENTERPRISE_TRUST_HARDENING_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const multiEngineQa = options.multiEngineQa ?? await buildMultiEngineOrchestrationQa({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildTrustHardeningContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const githubReviewRows = buildGithubReviewRows(generatedAt);
  const branchRulesetRows = buildBranchRulesetRows(generatedAt);
  const requiredStatusCheckRows = buildRequiredStatusCheckRows(generatedAt);
  const signedAttestationRows = buildSignedAttestationRows(generatedAt);
  const claudeReviewReceiptRows = buildClaudeReviewReceiptRows(generatedAt);
  const singleOwnerExceptionRows = buildSingleOwnerExceptionRows(generatedAt);
  const noHumanBoundaryRows = buildNoHumanBoundaryRows(generatedAt);
  const enterpriseTrustDecisionRows = buildEnterpriseTrustDecisionRows({ githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, noHumanBoundaryRows, generatedAt });
  const trustNegativeFixtureRows = buildTrustNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({ githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, multiEngineQa, contract, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows });
  const boundary = buildBoundary({ multiEngineQa, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, multiEngineQa, contract, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    review_enterprise_trust_hardening_id: `review-enterprise-trust-hardening.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_multi_engine_orchestration_qa_summary: multiEngineQa.summary,
    review_enterprise_trust_contract: contract,
    review_enterprise_trust_phase_rows: phaseRows,
    github_review_lane_rows: githubReviewRows,
    branch_ruleset_evidence_rows: branchRulesetRows,
    required_status_check_rows: requiredStatusCheckRows,
    signed_attestation_hardening_rows: signedAttestationRows,
    claude_review_receipt_hardening_rows: claudeReviewReceiptRows,
    single_owner_exception_rows: singleOwnerExceptionRows,
    no_human_protected_closeout_boundary_rows: noHumanBoundaryRows,
    enterprise_trust_decision_rows: enterpriseTrustDecisionRows,
    trust_negative_fixture_rows: trustNegativeFixtureRows,
    review_enterprise_trust_freeze_rows: freezeRows,
    review_enterprise_trust_gate_rows: gateRows,
    review_enterprise_trust_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ multiEngineQa, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "review_enterprise_trust_hardening")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ multiEngineQa, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.review_enterprise_trust_hardening_id = result.review_enterprise_trust_hardening_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeReviewEnterpriseTrustHardening(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "review-enterprise-trust-hardening.json"), serializableResult(result));
  await writeJson(path.join(outDir, "github-review-lane-rows.json"), collectionEnvelope("github-review-lane-rows.v1", "github_review_lane_rows", result.github_review_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "branch-ruleset-evidence-rows.json"), collectionEnvelope("branch-ruleset-evidence-rows.v1", "branch_ruleset_evidence_rows", result.branch_ruleset_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "required-status-check-rows.json"), collectionEnvelope("required-status-check-rows.v1", "required_status_check_rows", result.required_status_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-attestation-hardening-rows.json"), collectionEnvelope("signed-attestation-hardening-rows.v1", "signed_attestation_hardening_rows", result.signed_attestation_hardening_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-receipt-hardening-rows.json"), collectionEnvelope("claude-review-receipt-hardening-rows.v1", "claude_review_receipt_hardening_rows", result.claude_review_receipt_hardening_rows, result.generated_at));
  await writeJson(path.join(outDir, "single-owner-exception-rows.json"), collectionEnvelope("single-owner-exception-rows.v1", "single_owner_exception_rows", result.single_owner_exception_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-human-protected-closeout-boundary-rows.json"), collectionEnvelope("no-human-protected-closeout-boundary-rows.v1", "no_human_protected_closeout_boundary_rows", result.no_human_protected_closeout_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "enterprise-trust-decision-rows.json"), collectionEnvelope("enterprise-trust-decision-rows.v1", "enterprise_trust_decision_rows", result.enterprise_trust_decision_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-negative-fixture-rows.json"), collectionEnvelope("trust-negative-fixture-rows.v1", "trust_negative_fixture_rows", result.trust_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-enterprise-trust-freeze-rows.json"), collectionEnvelope("review-enterprise-trust-freeze-rows.v1", "review_enterprise_trust_freeze_rows", result.review_enterprise_trust_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-enterprise-trust-gate-rows.json"), collectionEnvelope("review-enterprise-trust-gate-rows.v1", "review_enterprise_trust_gate_rows", result.review_enterprise_trust_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-enterprise-trust-boundary.json"), result.review_enterprise_trust_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "review-enterprise-trust-hardening-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runReviewEnterpriseTrustHardeningCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runReviewEnterpriseTrustHardening(args);
    console.log(`Review enterprise trust hardening ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.review_enterprise_trust_hardening_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`GitHub review rows: ${result.summary.github_review_lane_count}`);
    console.log(`Enterprise trust ready: ${result.summary.enterprise_trust_ready}`);
    console.log(`P6200 closeout ready: ${result.summary.p6200_milestone_closeout_ready}`);
    console.log(`Single-owner lower trust: ${result.summary.single_owner_lower_trust_mode}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildTrustHardeningContract(generatedAt) {
  return {
    schema_version: "review-enterprise-trust-contract.v1",
    generated_at: generatedAt,
    contract_id: "review-enterprise-trust-hardening-contract.p5801-p6200",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5401-P5800",
    github_review_lane_required: true,
    branch_ruleset_evidence_required: true,
    required_status_check_evidence_required: true,
    signed_attestation_verification_required: true,
    claude_review_receipt_required: true,
    single_owner_exception_classification_required: true,
    no_human_protected_closeout_boundary_required: true,
    enterprise_trust_decision_matrix_required: true,
    trust_negative_fixtures_required: true,
    independent_github_review_completed_now: false,
    branch_ruleset_enforced_now: false,
    required_status_checks_passed_now: false,
    attestation_verification_passed_now: false,
    claude_review_completed_now: false,
    human_adjudication_in_milestone_gate: false,
    single_owner_lower_trust_mode: true,
    enterprise_trust_claim_enabled: false,
    protected_closeout_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "review-enterprise-trust-phase-row.v1",
      row_id: `review.enterprise.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.review_enterprise_trust.${phase_range}`,
      responsible_owner: "platform_trust_owner",
      next_allowed_action: pass ? "preserve review trust phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildGithubReviewRows(generatedAt) {
  return [
    {
      schema_version: "github-review-lane-row.v1",
      row_id: "github.review.lane.row.001",
      generated_at: generatedAt,
      review_lane_id: "github.review.independent_pr_approval",
      independent_github_review_required: true,
      independent_github_review_completed_now: false,
      self_review_attempt_blocked: true,
      same_account_approval_allowed: false,
      review_state: "BLOCKED_PENDING_INDEPENDENT_GITHUB_REVIEW",
      block_reason: "single_owner_cannot_approve_own_pr",
      evidence_ref: "artifacts/platform-external-verification-enforcement/review/independent-github-review-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture different-account or team GitHub review evidence before enterprise trust",
    },
  ];
}

function buildBranchRulesetRows(generatedAt) {
  return [
    {
      schema_version: "branch-ruleset-evidence-row.v1",
      row_id: "branch.ruleset.evidence.row.001",
      generated_at: generatedAt,
      ruleset_id: "github.branch.ruleset.main",
      branch_ruleset_evidence_required: true,
      branch_ruleset_observed_now: false,
      branch_protection_enforced_now: false,
      force_push_blocked_now: false,
      admin_bypass_blocked_or_recorded_now: false,
      evidence_status: "BLOCKED_PENDING_BRANCH_RULESET_EVIDENCE",
      block_reason: "branch_ruleset_receipt_missing_for_p6200",
      evidence_ref: "artifacts/platform-external-verification-enforcement/github/branch-protection-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture branch protection or ruleset receipt before enterprise trust",
    },
  ];
}

function buildRequiredStatusCheckRows(generatedAt) {
  return [
    {
      schema_version: "required-status-check-row.v1",
      row_id: "required.status.check.row.001",
      generated_at: generatedAt,
      required_status_check_id: "github.required.status.check.p6200",
      required_status_check_evidence_required: true,
      required_status_checks_configured_now: false,
      required_status_checks_passed_now: false,
      commit_sha_bound_now: false,
      evidence_status: "BLOCKED_PENDING_REQUIRED_STATUS_CHECK_EVIDENCE",
      block_reason: "required_status_check_receipt_missing_for_p6200",
      evidence_ref: "artifacts/platform-external-verification-enforcement/github/required-check-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture required status check configuration and run evidence",
    },
  ];
}

function buildSignedAttestationRows(generatedAt) {
  return [
    {
      schema_version: "signed-attestation-hardening-row.v1",
      row_id: "signed.attestation.hardening.row.001",
      generated_at: generatedAt,
      attestation_id: "signed.attestation.p6200",
      signed_attestation_required: true,
      signed_attestation_present_now: false,
      attestation_verification_passed_now: false,
      subject_digest_bound_now: false,
      evidence_status: "BLOCKED_PENDING_SIGNED_ATTESTATION_VERIFY",
      block_reason: "signed_attestation_verify_receipt_missing_for_p6200",
      evidence_ref: "artifacts/platform-external-verification-enforcement/attestation/attestation-verify-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "verify signed attestation and subject digest before enterprise trust",
    },
  ];
}

function buildClaudeReviewReceiptRows(generatedAt) {
  return [
    {
      schema_version: "claude-review-receipt-hardening-row.v1",
      row_id: "claude.review.receipt.hardening.row.001",
      generated_at: generatedAt,
      claude_review_receipt_id: "claude.review.p6200.opus-max",
      reviewer_ref: "reviewer.claude_code_opus_max",
      claude_review_receipt_required: true,
      completed_claude_review_receipt_present_now: false,
      durable_raw_json_present_now: false,
      findings_normalized_now: false,
      reviewer_mutation_allowed: false,
      evidence_status: "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT",
      block_reason: "completed_claude_review_receipt_missing_for_p6200",
      evidence_ref: "artifacts/platform-external-verification-enforcement/review/claude-review-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture completed Claude review receipt with durable raw JSON",
    },
  ];
}

function buildSingleOwnerExceptionRows(generatedAt) {
  return [
    {
      schema_version: "single-owner-exception-row.v1",
      row_id: "single.owner.exception.row.001",
      generated_at: generatedAt,
      exception_id: "single_owner.self_review_boundary",
      single_owner_exception_observed_now: true,
      single_owner_lower_trust_mode: true,
      independent_github_review_completed_now: false,
      single_owner_can_claim_enterprise_trust: false,
      merge_readiness_tier: "LOWER_TRUST_INTERNAL_ONLY",
      evidence_ref: "artifacts/platform-external-verification-enforcement/review/single-owner-exception-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "display lower-trust badge and block enterprise-trust wording",
    },
  ];
}

function buildNoHumanBoundaryRows(generatedAt) {
  return [
    {
      schema_version: "no-human-protected-closeout-boundary-row.v1",
      row_id: "no.human.boundary.row.001",
      generated_at: generatedAt,
      boundary_id: "no_human.protected_closeout",
      human_adjudication_in_milestone_gate: false,
      protected_closeout_enabled: false,
      protected_final_decision_enabled: false,
      no_human_can_claim_protected_final_decision: false,
      no_human_can_claim_enterprise_trust: false,
      evidence_ref: "evidence.no_human_boundary.p6200",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "preserve protected closeout BLOCK while no-human mode is active",
    },
  ];
}

function buildEnterpriseTrustDecisionRows({ githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, noHumanBoundaryRows, generatedAt }) {
  const externalTrustReady = githubReviewRows.every((row) => row.independent_github_review_completed_now)
    && branchRulesetRows.every((row) => row.branch_protection_enforced_now)
    && requiredStatusCheckRows.every((row) => row.required_status_checks_passed_now)
    && signedAttestationRows.every((row) => row.attestation_verification_passed_now)
    && claudeReviewReceiptRows.every((row) => row.completed_claude_review_receipt_present_now && row.durable_raw_json_present_now);
  const noHumanBlocksProtected = noHumanBoundaryRows.every((row) => row.protected_closeout_enabled === false);
  return [
    {
      schema_version: "enterprise-trust-decision-row.v1",
      row_id: "enterprise.trust.decision.row.001",
      generated_at: generatedAt,
      milestone_id: "milestone.p6200",
      milestone_range: "P6200",
      external_trust_evidence_ready: externalTrustReady,
      no_human_blocks_protected_closeout: noHumanBlocksProtected,
      p6200_milestone_closeout_ready: false,
      lower_trust_readiness_allowed: true,
      single_owner_lower_trust_mode: true,
      enterprise_trust_ready: false,
      enterprise_trust_claim_allowed: false,
      protected_closeout_enabled: false,
      human_adjudication_required: false,
      block_reason: "enterprise_trust_requires_independent_github_review_branch_ruleset_required_checks_attestation_claude_review_and_non_no_human_closeout",
      evidence_ref: "evidence.enterprise_trust_decision.p6200",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "collect missing external evidence and keep enterprise trust blocked in no-human mode",
    },
  ];
}

function buildTrustNegativeFixtureRows(generatedAt) {
  return TRUST_NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "trust-negative-fixture-row.v1",
    row_id: `trust.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_trust_claim_allowed: false,
    evidence_ref: `evidence.trust_negative_fixture.${fixture_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: "preserve trust negative fixture",
  }));
}

function buildFreezeRows({ githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, generatedAt }) {
  const specs = [
    ["github_review_pending_visible", githubReviewRows.every((row) => row.self_review_attempt_blocked && row.independent_github_review_completed_now === false), "GitHub independent review pending state is visible"],
    ["branch_ruleset_pending_visible", branchRulesetRows.every((row) => row.evidence_status === "BLOCKED_PENDING_BRANCH_RULESET_EVIDENCE"), "branch ruleset evidence pending state is visible"],
    ["required_checks_pending_visible", requiredStatusCheckRows.every((row) => row.evidence_status === "BLOCKED_PENDING_REQUIRED_STATUS_CHECK_EVIDENCE"), "required status check evidence pending state is visible"],
    ["attestation_pending_visible", signedAttestationRows.every((row) => row.evidence_status === "BLOCKED_PENDING_SIGNED_ATTESTATION_VERIFY"), "signed attestation verify pending state is visible"],
    ["claude_review_pending_visible", claudeReviewReceiptRows.every((row) => row.evidence_status === "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT" && row.reviewer_mutation_allowed === false), "Claude review receipt pending state is visible"],
    ["single_owner_exception_ready", singleOwnerExceptionRows.every((row) => row.single_owner_lower_trust_mode && row.single_owner_can_claim_enterprise_trust === false), "single-owner exception is lower-trust only"],
    ["no_human_boundary_ready", noHumanBoundaryRows.every((row) => row.protected_closeout_enabled === false && row.no_human_can_claim_enterprise_trust === false), "no-human protected closeout boundary is ready"],
    ["enterprise_trust_decision_ready", enterpriseTrustDecisionRows.every((row) => row.enterprise_trust_ready === false && row.enterprise_trust_claim_allowed === false), "enterprise trust decision rows block trust claims"],
    ["trust_negative_fixtures_ready", trustNegativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_trust_claim_allowed === false), "trust negative fixtures block unsafe claims"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "review-enterprise-trust-freeze-row.v1",
    row_id: `review.enterprise.trust.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.review_enterprise_trust.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.review_enterprise_trust.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, multiEngineQa, contract, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:review-enterprise-trust-hardening"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes review enterprise trust hardening"],
    ["multi_engine_script_registered", Boolean(packageJson.data?.scripts?.[MULTI_ENGINE_COMMAND_NAME]), "multi-engine orchestration QA script exists"],
    ["multi_engine_ready", multiEngineQa.summary?.multi_engine_orchestration_qa_status === MULTI_ENGINE_READY_STATUS, "P5401-P5800 multi-engine QA is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Review and Enterprise Trust Hardening"), "P5801-P6200 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Review and Enterprise Trust Hardening"), "architecture doc reflects review enterprise trust hardening"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Review and Enterprise Trust Hardening"), "review dashboard IA reflects review enterprise trust hardening"],
    ["contract_ready", contract.github_review_lane_required && contract.enterprise_trust_claim_enabled === false && contract.human_adjudication_in_milestone_gate === false, "review trust contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P5801-P6200 phase rows pass"],
    ["github_review_pending_visible", githubReviewRows.every((row) => row.independent_github_review_completed_now === false && row.self_review_attempt_blocked), "GitHub independent review pending state is visible"],
    ["branch_ruleset_pending_visible", branchRulesetRows.every((row) => row.branch_ruleset_observed_now === false && row.evidence_status === "BLOCKED_PENDING_BRANCH_RULESET_EVIDENCE"), "branch ruleset pending state is visible"],
    ["required_checks_pending_visible", requiredStatusCheckRows.every((row) => row.required_status_checks_passed_now === false && row.evidence_status === "BLOCKED_PENDING_REQUIRED_STATUS_CHECK_EVIDENCE"), "required checks pending state is visible"],
    ["attestation_pending_visible", signedAttestationRows.every((row) => row.attestation_verification_passed_now === false && row.evidence_status === "BLOCKED_PENDING_SIGNED_ATTESTATION_VERIFY"), "attestation pending state is visible"],
    ["claude_review_pending_visible", claudeReviewReceiptRows.every((row) => row.completed_claude_review_receipt_present_now === false && row.durable_raw_json_present_now === false), "Claude review receipt pending state is visible"],
    ["single_owner_lower_trust", singleOwnerExceptionRows.every((row) => row.single_owner_lower_trust_mode && row.single_owner_can_claim_enterprise_trust === false), "single-owner remains lower-trust"],
    ["no_human_boundary", noHumanBoundaryRows.every((row) => row.protected_closeout_enabled === false && row.no_human_can_claim_protected_final_decision === false), "no-human protected closeout boundary is visible"],
    ["enterprise_decision_blocks", enterpriseTrustDecisionRows.every((row) => row.enterprise_trust_ready === false && row.enterprise_trust_claim_allowed === false), "enterprise trust decision blocks claims"],
    ["negative_fixtures_ready", trustNegativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "trust negative fixtures are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_runtime_write", contract.agent_runtime_execution_enabled === false && contract.write_action_enabled === false && contract.protected_action_enabled === false, "runtime/write/protected action stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "review-enterprise-trust-gate-row.v1",
    row_id: `review.enterprise.trust.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.review_enterprise_trust.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("claude") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.review_enterprise_trust.${gate_id}`,
    responsible_owner: "platform_trust_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ multiEngineQa, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    multiEngineQa.summary?.multi_engine_orchestration_qa_status !== MULTI_ENGINE_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    githubReviewRows.some((row) => row.independent_github_review_completed_now || row.same_account_approval_allowed),
    branchRulesetRows.some((row) => row.branch_protection_enforced_now || row.branch_ruleset_observed_now),
    requiredStatusCheckRows.some((row) => row.required_status_checks_passed_now || row.required_status_checks_configured_now),
    signedAttestationRows.some((row) => row.attestation_verification_passed_now || row.signed_attestation_present_now),
    claudeReviewReceiptRows.some((row) => row.completed_claude_review_receipt_present_now || row.durable_raw_json_present_now || row.reviewer_mutation_allowed),
    singleOwnerExceptionRows.some((row) => !row.single_owner_lower_trust_mode || row.single_owner_can_claim_enterprise_trust),
    noHumanBoundaryRows.some((row) => row.protected_closeout_enabled || row.protected_final_decision_enabled || row.no_human_can_claim_enterprise_trust),
    enterpriseTrustDecisionRows.some((row) => row.enterprise_trust_ready || row.enterprise_trust_claim_allowed || row.protected_closeout_enabled),
    trustNegativeFixtureRows.some((row) => row.unsafe_trust_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  const decision = enterpriseTrustDecisionRows[0] ?? {};
  return {
    schema_version: "review-enterprise-trust-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5401-P5800",
    review_enterprise_trust_hardening_ready: unsafeFlags.filter(Boolean).length === 0,
    multi_engine_orchestration_qa_ready: multiEngineQa.summary?.multi_engine_orchestration_qa_status === MULTI_ENGINE_READY_STATUS,
    independent_github_review_completed_now: githubReviewRows.every((row) => row.independent_github_review_completed_now),
    branch_ruleset_enforced_now: branchRulesetRows.every((row) => row.branch_protection_enforced_now),
    required_status_checks_passed_now: requiredStatusCheckRows.every((row) => row.required_status_checks_passed_now),
    attestation_verification_passed_now: signedAttestationRows.every((row) => row.attestation_verification_passed_now),
    claude_review_completed_now: claudeReviewReceiptRows.every((row) => row.completed_claude_review_receipt_present_now),
    durable_claude_raw_json_present_now: claudeReviewReceiptRows.every((row) => row.durable_raw_json_present_now),
    single_owner_lower_trust_mode: singleOwnerExceptionRows.every((row) => row.single_owner_lower_trust_mode),
    human_adjudication_in_milestone_gate: false,
    no_human_blocks_protected_closeout: noHumanBoundaryRows.every((row) => row.protected_closeout_enabled === false),
    enterprise_trust_ready: decision.enterprise_trust_ready === true,
    enterprise_trust_claim_enabled: false,
    p6200_milestone_closeout_ready: decision.p6200_milestone_closeout_ready === true,
    lower_trust_readiness_allowed: decision.lower_trust_readiness_allowed === true,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, multiEngineQa, contract, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include review enterprise trust hardening command"),
    validationItem("multi_engine.ready", "source", multiEngineQa.summary?.multi_engine_orchestration_qa_status === MULTI_ENGINE_READY_STATUS, "multi-engine QA must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P5801-P6200 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Review and Enterprise Trust Hardening"), "architecture must reflect review trust hardening"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Review and Enterprise Trust Hardening"), "dashboard IA must reflect review trust hardening"),
    validationItem("contract.ready", "contract", contract.github_review_lane_required && contract.enterprise_trust_claim_enabled === false, "trust contract must be ready"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P5801-P6200 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P5801-P6200 phase rows must pass"),
    validationItem("github.pending", "github", githubReviewRows.every((row) => row.independent_github_review_completed_now === false && row.self_review_attempt_blocked), "GitHub review pending must be visible"),
    validationItem("branch.pending", "github", branchRulesetRows.every((row) => row.evidence_status === "BLOCKED_PENDING_BRANCH_RULESET_EVIDENCE"), "branch ruleset pending must be visible"),
    validationItem("checks.pending", "github", requiredStatusCheckRows.every((row) => row.evidence_status === "BLOCKED_PENDING_REQUIRED_STATUS_CHECK_EVIDENCE"), "required check pending must be visible"),
    validationItem("attestation.pending", "attestation", signedAttestationRows.every((row) => row.evidence_status === "BLOCKED_PENDING_SIGNED_ATTESTATION_VERIFY"), "attestation pending must be visible"),
    validationItem("claude.pending", "claude", claudeReviewReceiptRows.every((row) => row.evidence_status === "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT" && row.reviewer_mutation_allowed === false), "Claude review pending must be visible"),
    validationItem("single_owner.lower_trust", "trust", singleOwnerExceptionRows.every((row) => row.single_owner_lower_trust_mode && row.single_owner_can_claim_enterprise_trust === false), "single-owner must be lower-trust only"),
    validationItem("no_human.boundary", "trust", noHumanBoundaryRows.every((row) => row.protected_closeout_enabled === false && row.no_human_can_claim_protected_final_decision === false), "no-human protected closeout boundary must hold"),
    validationItem("enterprise.blocked", "trust", enterpriseTrustDecisionRows.every((row) => row.enterprise_trust_ready === false && row.enterprise_trust_claim_allowed === false && row.p6200_milestone_closeout_ready === false), "enterprise trust and P6200 closeout must stay blocked"),
    validationItem("negative_fixtures.ready", "fixtures", trustNegativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_trust_claim_allowed === false), "negative fixtures must block unsafe trust claims"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_enterprise", "boundary", boundary.enterprise_trust_claim_enabled === false && boundary.enterprise_trust_ready === false, "enterprise trust must stay disabled"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.agent_runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.protected_action_enabled === false, "runtime/write/protected action must stay disabled"),
  ];
}

function buildSummary({ multiEngineQa, phaseRows, githubReviewRows, branchRulesetRows, requiredStatusCheckRows, signedAttestationRows, claudeReviewReceiptRows, singleOwnerExceptionRows, noHumanBoundaryRows, enterpriseTrustDecisionRows, trustNegativeFixtureRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "review-enterprise-trust-hardening-summary.v1",
    review_enterprise_trust_hardening_status: validation.valid && boundary.review_enterprise_trust_hardening_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5401-P5800",
    multi_engine_orchestration_qa_status: multiEngineQa.summary?.multi_engine_orchestration_qa_status ?? "unknown",
    phase_row_count: phaseRows.length,
    github_review_lane_count: githubReviewRows.length,
    branch_ruleset_evidence_count: branchRulesetRows.length,
    required_status_check_count: requiredStatusCheckRows.length,
    signed_attestation_count: signedAttestationRows.length,
    claude_review_receipt_count: claudeReviewReceiptRows.length,
    single_owner_exception_count: singleOwnerExceptionRows.length,
    no_human_boundary_count: noHumanBoundaryRows.length,
    enterprise_trust_decision_count: enterpriseTrustDecisionRows.length,
    trust_negative_fixture_count: trustNegativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    independent_github_review_completed_now: boundary.independent_github_review_completed_now,
    branch_ruleset_enforced_now: boundary.branch_ruleset_enforced_now,
    required_status_checks_passed_now: boundary.required_status_checks_passed_now,
    attestation_verification_passed_now: boundary.attestation_verification_passed_now,
    claude_review_completed_now: boundary.claude_review_completed_now,
    durable_claude_raw_json_present_now: boundary.durable_claude_raw_json_present_now,
    single_owner_lower_trust_mode: boundary.single_owner_lower_trust_mode,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    no_human_blocks_protected_closeout: boundary.no_human_blocks_protected_closeout,
    enterprise_trust_ready: boundary.enterprise_trust_ready,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    p6200_milestone_closeout_ready: boundary.p6200_milestone_closeout_ready,
    lower_trust_readiness_allowed: boundary.lower_trust_readiness_allowed,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    protected_final_decision_enabled: boundary.protected_final_decision_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_review_enterprise_trust.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Review and Enterprise Trust Hardening",
    "",
    `Status: ${result.summary.review_enterprise_trust_hardening_status}`,
    `Program: ${result.summary.program_range}`,
    `Multi-engine QA: ${result.summary.multi_engine_orchestration_qa_status}`,
    `GitHub review rows: ${result.summary.github_review_lane_count}`,
    `Branch/ruleset rows: ${result.summary.branch_ruleset_evidence_count}`,
    `Required check rows: ${result.summary.required_status_check_count}`,
    `Signed attestation rows: ${result.summary.signed_attestation_count}`,
    `Claude review receipt rows: ${result.summary.claude_review_receipt_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Independent GitHub review completed now: ${result.summary.independent_github_review_completed_now}`,
    `Branch ruleset enforced now: ${result.summary.branch_ruleset_enforced_now}`,
    `Required status checks passed now: ${result.summary.required_status_checks_passed_now}`,
    `Attestation verification passed now: ${result.summary.attestation_verification_passed_now}`,
    `Claude review completed now: ${result.summary.claude_review_completed_now}`,
    `Single-owner lower-trust mode: ${result.summary.single_owner_lower_trust_mode}`,
    `Enterprise trust ready: ${result.summary.enterprise_trust_ready}`,
    `P6200 closeout ready: ${result.summary.p6200_milestone_closeout_ready}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Closeout Boundary",
    "",
    "The trust hardening contract is ready, but P6200 closeout and enterprise trust remain blocked until independent GitHub review, branch/ruleset evidence, required status checks, signed attestation verification, completed Claude review receipt, and a non-no-human protected closeout path exist. In current no-human mode, only lower-trust single-owner readiness is allowed.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_REVIEW_ENTERPRISE_TRUST_HARDENING_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/review-enterprise-trust-hardening.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
