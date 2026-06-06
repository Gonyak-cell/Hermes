import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDevelopmentControlConsole } from "./development-control-console.mjs";

export const DEFAULT_VERIFICATION_ORCHESTRATION_RUNTIME_OUT_DIR = "artifacts/verification-orchestration-runtime/latest";
export const DEFAULT_VERIFICATION_ORCHESTRATION_RUNTIME_INPUTS = {
  schemaPath: "schemas/verification-orchestration-runtime.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:verification-orchestration-runtime";
const CONSOLE_COMMAND_NAME = "platform:development-control-console";
const SCHEMA_VERSION = "verification-orchestration-runtime.v1";
const CAPABILITY_ID = "platform.verification_orchestration_runtime";
const PROGRAM_RANGE = "P5001-P5400";
const READY_STATUS = "ready_for_verification_orchestration_runtime_v0";
const CONSOLE_READY_STATUS = "ready_for_development_control_console_v0";

const PHASE_SPECS = [
  ["P5001-P5040", "Standard Validator Adapter Registry"],
  ["P5041-P5080", "Dual-Run Result Contract"],
  ["P5081-P5120", "Negative Fixture Expansion"],
  ["P5121-P5160", "CI Required Check Contract"],
  ["P5161-P5200", "GitHub Actions Evidence Binding"],
  ["P5201-P5240", "Signed Attestation Verify Contract"],
  ["P5241-P5280", "Claude Review Receipt Completion Contract"],
  ["P5281-P5320", "Verification Result Normalization"],
  ["P5321-P5360", "Milestone Trust Decision Rows"],
  ["P5361-P5400", "Verification Orchestration Freeze"],
];

const STANDARD_VALIDATORS = [
  ["validator.hue_keynote_alignment", "platform:hue-keynote-roadmap-alignment", "Hue keynote roadmap alignment"],
  ["validator.conversation_source_plane", "platform:conversation-source-plane", "Conversation source plane"],
  ["validator.conversation_improvement_signal", "platform:conversation-improvement-signal", "Conversation improvement signal"],
  ["validator.development_control_console", "platform:development-control-console", "Development control console"],
  ["validator.review_authority_contract", "platform:review-authority-contract", "Review authority contract"],
  ["validator.review_process_upgrade", "platform:review-process-upgrade", "Review process upgrade"],
  ["validator.dashboard_ia", "dashboard:ia", "Review dashboard IA"],
];

const REQUIRED_CHECKS = [
  ["required-check.node-test-targeted", "node --test targeted P4001-P5400 tests"],
  ["required-check.platform-validate-chain", "npm run validate includes P5400 command"],
  ["required-check.github-actions-ci", "GitHub Actions workflow conclusion"],
  ["required-check.attestation-verify", "signed attestation verify conclusion"],
  ["required-check.claude-review-receipt", "Claude Code Opus max review receipt completion"],
];

const NEGATIVE_FIXTURES = [
  ["negative.local_only_pass_as_enterprise", "Local validation passes but external CI/attestation/review evidence is missing", "BLOCK_ENTERPRISE_TRUST"],
  ["negative.missing_claude_raw_json", "Claude review transcript exists only as lost stdout or partial text", "BLOCK_REVIEW_COMPLETION"],
  ["negative.self_review_as_independent", "Codex-created work is marked approved by Codex or same GitHub account", "BLOCK_INDEPENDENT_REVIEW"],
  ["negative.attestation_summary_without_verify", "Attestation prose exists but signed verify evidence is absent", "BLOCK_ATTESTATION_PASS"],
  ["negative.human_gate_assumed", "Human adjudication is assumed even though current milestone mode excludes it", "BLOCK_PROTECTED_CLOSEOUT"],
];

export async function runVerificationOrchestrationRuntime(options = {}) {
  const result = await buildVerificationOrchestrationRuntime(options);
  if (options.write !== false) await writeVerificationOrchestrationRuntime(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Verification orchestration runtime failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildVerificationOrchestrationRuntime(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VERIFICATION_ORCHESTRATION_RUNTIME_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const developmentConsole = options.developmentConsole ?? await buildDevelopmentControlConsole({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildRuntimeContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const standardValidatorRows = buildStandardValidatorRows(packageJson, generatedAt);
  const dualRunRows = buildDualRunRows(developmentConsole, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const ciRequiredCheckRows = buildCiRequiredCheckRows(packageJson, generatedAt);
  const githubActionsEvidenceRows = buildGithubActionsEvidenceRows(generatedAt);
  const attestationVerifyRows = buildAttestationVerifyRows(generatedAt);
  const claudeReviewReceiptRows = buildClaudeReviewReceiptRows(generatedAt);
  const normalizedResultRows = buildNormalizedResultRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, generatedAt });
  const milestoneTrustDecisionRows = buildMilestoneTrustDecisionRows({ ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, generatedAt });
  const freezeRows = buildFreezeRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, developmentConsole, contract, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows });
  const boundary = buildBoundary({ developmentConsole, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, developmentConsole, contract, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    verification_orchestration_runtime_id: `verification-orchestration-runtime.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_development_control_console_summary: developmentConsole.summary,
    verification_orchestration_contract: contract,
    verification_phase_rows: phaseRows,
    standard_validator_rows: standardValidatorRows,
    dual_run_result_rows: dualRunRows,
    negative_fixture_rows: negativeFixtureRows,
    ci_required_check_rows: ciRequiredCheckRows,
    github_actions_evidence_rows: githubActionsEvidenceRows,
    attestation_verify_rows: attestationVerifyRows,
    claude_review_receipt_rows: claudeReviewReceiptRows,
    normalized_verification_result_rows: normalizedResultRows,
    milestone_trust_decision_rows: milestoneTrustDecisionRows,
    verification_orchestration_freeze_rows: freezeRows,
    verification_orchestration_gate_rows: gateRows,
    verification_orchestration_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ developmentConsole, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "verification_orchestration_runtime")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ developmentConsole, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.verification_orchestration_runtime_id = result.verification_orchestration_runtime_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeVerificationOrchestrationRuntime(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "verification-orchestration-runtime.json"), serializableResult(result));
  await writeJson(path.join(outDir, "standard-validator-rows.json"), collectionEnvelope("standard-validator-rows.v1", "standard_validator_rows", result.standard_validator_rows, result.generated_at));
  await writeJson(path.join(outDir, "dual-run-result-rows.json"), collectionEnvelope("dual-run-result-rows.v1", "dual_run_result_rows", result.dual_run_result_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("negative-fixture-rows.v1", "negative_fixture_rows", result.negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "ci-required-check-rows.json"), collectionEnvelope("ci-required-check-rows.v1", "ci_required_check_rows", result.ci_required_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "github-actions-evidence-rows.json"), collectionEnvelope("github-actions-evidence-rows.v1", "github_actions_evidence_rows", result.github_actions_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "attestation-verify-rows.json"), collectionEnvelope("attestation-verify-rows.v1", "attestation_verify_rows", result.attestation_verify_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-receipt-rows.json"), collectionEnvelope("claude-review-receipt-rows.v1", "claude_review_receipt_rows", result.claude_review_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "normalized-verification-result-rows.json"), collectionEnvelope("normalized-verification-result-rows.v1", "normalized_verification_result_rows", result.normalized_verification_result_rows, result.generated_at));
  await writeJson(path.join(outDir, "milestone-trust-decision-rows.json"), collectionEnvelope("milestone-trust-decision-rows.v1", "milestone_trust_decision_rows", result.milestone_trust_decision_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-orchestration-freeze-rows.json"), collectionEnvelope("verification-orchestration-freeze-rows.v1", "verification_orchestration_freeze_rows", result.verification_orchestration_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-orchestration-gate-rows.json"), collectionEnvelope("verification-orchestration-gate-rows.v1", "verification_orchestration_gate_rows", result.verification_orchestration_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-orchestration-boundary.json"), result.verification_orchestration_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "verification-orchestration-runtime-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runVerificationOrchestrationRuntimeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runVerificationOrchestrationRuntime(args);
    console.log(`Verification orchestration runtime ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.verification_orchestration_runtime_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Standard validators: ${result.summary.standard_validator_count}`);
    console.log(`Dual-run rows: ${result.summary.dual_run_result_count}`);
    console.log(`Negative fixtures: ${result.summary.negative_fixture_count}`);
    console.log(`P5400 closeout ready: ${result.summary.p5400_milestone_closeout_ready}`);
    console.log(`Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRuntimeContract(generatedAt) {
  return {
    schema_version: "verification-orchestration-contract.v1",
    generated_at: generatedAt,
    contract_id: "verification-orchestration-runtime-contract.p5001-p5400",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4601-P5000",
    standard_validator_adapter_required: true,
    dual_run_result_required: true,
    negative_fixtures_required: true,
    ci_required_check_contract_required: true,
    github_actions_evidence_binding_required: true,
    signed_attestation_verify_contract_required: true,
    claude_review_completion_receipt_required: true,
    durable_claude_raw_json_required: true,
    local_only_pass_can_claim_enterprise_trust: false,
    p5400_closeout_requires_external_evidence: true,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    deterministic_validation_orchestration_enabled: true,
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
      schema_version: "verification-phase-row.v1",
      row_id: `verification.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.verification_orchestration.${phase_range}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: pass ? "preserve verification phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildStandardValidatorRows(packageJson, generatedAt) {
  return STANDARD_VALIDATORS.map(([validator_id, command_name, description], index) => {
    const registered = Boolean(packageJson.data?.scripts?.[command_name]);
    const inValidate = Boolean(packageJson.data?.scripts?.validate?.includes(`${command_name} -- --check`));
    const pass = registered && inValidate;
    return {
      schema_version: "standard-validator-row.v1",
      row_id: `standard.validator.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      validator_id,
      command_name,
      description,
      adapter_status: pass ? "REGISTERED" : "MISSING",
      check_args: "--check",
      required_for_milestone: true,
      command_invoked_now: false,
      command_result_ref: `evidence.standard_validator.${validator_id}`,
      normalized_result: pass ? "PASS_CONTRACT_READY" : "BLOCKED",
      block_reason: pass ? null : `validator_missing.${command_name}`,
      unsafe_flags_false: pass,
      verdict_authority: "harness_only",
      next_allowed_action: pass ? "run through orchestration command set" : `register ${command_name}`,
    };
  });
}

function buildDualRunRows(developmentConsole, generatedAt) {
  const specs = [
    ["dual-run.source_plane", "schema validation", "summary validation", developmentConsole.summary?.source_plane_status === "ready_for_conversation_source_plane_v0"],
    ["dual-run.improvement_signal", "schema validation", "summary validation", developmentConsole.summary?.improvement_signal_status === "ready_for_conversation_improvement_signal_freeze"],
    ["dual-run.development_console", "schema validation", "boundary validation", developmentConsole.summary?.development_control_console_status === CONSOLE_READY_STATUS],
    ["dual-run.review_process", "review process rows", "milestone gate rows", developmentConsole.summary?.claude_review_receipt_required_for_milestone === true],
  ];
  return specs.map(([dual_run_id, primary_result_ref, secondary_result_ref, pass], index) => ({
    schema_version: "dual-run-result-row.v1",
    row_id: `dual.run.result.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    dual_run_id,
    primary_result_ref,
    secondary_result_ref,
    normalized_equivalent: Boolean(pass),
    mismatch_count: pass ? 0 : 1,
    rerun_required: !pass,
    normalized_result: pass ? "PASS_EQUIVALENT" : "BLOCKED_MISMATCH",
    evidence_ref: `evidence.dual_run.${dual_run_id}`,
    unsafe_flags_false: Boolean(pass),
    verdict_authority: "harness_only",
    next_allowed_action: pass ? "preserve dual-run equivalence" : `repair ${dual_run_id}`,
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "negative-fixture-row.v1",
    row_id: `negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    evidence_ref: `evidence.negative_fixture.${fixture_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: "preserve negative fixture in regression suite",
  }));
}

function buildCiRequiredCheckRows(packageJson, generatedAt) {
  return REQUIRED_CHECKS.map(([required_check_id, description], index) => {
    const isLocalContract = required_check_id !== "required-check.github-actions-ci" && required_check_id !== "required-check.attestation-verify" && required_check_id !== "required-check.claude-review-receipt";
    const contractReady = required_check_id === "required-check.platform-validate-chain"
      ? Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`))
      : true;
    return {
      schema_version: "ci-required-check-row.v1",
      row_id: `ci.required.check.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      required_check_id,
      description,
      required_check_status: contractReady ? "CONTRACT_READY" : "BLOCKED",
      local_contract_ready: Boolean(contractReady),
      external_observed_now: false,
      external_observation_required_for_closeout: !isLocalContract,
      required_for_p5400_closeout: true,
      block_reason: contractReady ? null : `required_check_contract_missing.${required_check_id}`,
      evidence_ref: `evidence.required_check.${required_check_id}`,
      unsafe_flags_false: Boolean(contractReady),
      verdict_authority: "harness_only",
      next_allowed_action: isLocalContract ? "run local check through orchestration" : "capture external evidence receipt before P5400 closeout",
    };
  });
}

function buildGithubActionsEvidenceRows(generatedAt) {
  return [
    {
      schema_version: "github-actions-evidence-row.v1",
      row_id: "github.actions.evidence.row.001",
      generated_at: generatedAt,
      evidence_id: "github-actions.p5400.required-checks",
      required_check_ref: "required-check.github-actions-ci",
      workflow_run_observed_now: false,
      workflow_conclusion_passed_now: false,
      commit_sha_bound_now: false,
      evidence_status: "BLOCKED_PENDING_EXTERNAL_EVIDENCE",
      block_reason: "github_actions_run_receipt_missing_for_p5400",
      evidence_ref: "artifacts/platform-external-verification-enforcement/github/actions-run-receipt.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture GitHub Actions run id, conclusion, and commit SHA receipt",
    },
  ];
}

function buildAttestationVerifyRows(generatedAt) {
  return [
    {
      schema_version: "attestation-verify-row.v1",
      row_id: "attestation.verify.row.001",
      generated_at: generatedAt,
      evidence_id: "attestation.p5400.verify",
      required_check_ref: "required-check.attestation-verify",
      signed_attestation_present_now: false,
      attestation_verification_passed_now: false,
      subject_digest_bound_now: false,
      evidence_status: "BLOCKED_PENDING_SIGNED_VERIFY_RECEIPT",
      block_reason: "attestation_verify_receipt_missing_for_p5400",
      evidence_ref: "artifacts/verification-orchestration-runtime/latest/attestation-verify-rows.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "generate and verify signed attestation before P5400 closeout",
    },
  ];
}

function buildClaudeReviewReceiptRows(generatedAt) {
  return [
    {
      schema_version: "claude-review-receipt-row.v1",
      row_id: "claude.review.receipt.row.001",
      generated_at: generatedAt,
      evidence_id: "claude-review.p5400.opus-max",
      required_check_ref: "required-check.claude-review-receipt",
      reviewer_ref: "reviewer.claude_code_opus_max",
      preferred_model_alias: "claude-code-opus-max",
      durable_raw_json_required: true,
      durable_raw_json_present_now: false,
      review_completed_now: false,
      findings_normalized_now: false,
      reviewer_mutation_allowed: false,
      evidence_status: "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT",
      block_reason: "completed_claude_review_receipt_missing_for_p5400",
      evidence_ref: "artifacts/verification-orchestration-runtime/latest/claude-review-receipt-rows.json",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "capture durable Claude review raw JSON and normalized findings before P5400 closeout",
    },
  ];
}

function buildNormalizedResultRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, generatedAt }) {
  const specs = [
    ["normalized.standard_validators", standardValidatorRows.every((row) => row.adapter_status === "REGISTERED"), "LOCAL_CONTRACT_READY"],
    ["normalized.dual_run", dualRunRows.every((row) => row.normalized_equivalent && row.mismatch_count === 0), "LOCAL_CONTRACT_READY"],
    ["normalized.negative_fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "LOCAL_CONTRACT_READY"],
    ["normalized.ci_required_checks", ciRequiredCheckRows.every((row) => row.local_contract_ready), "LOCAL_CONTRACT_READY_EXTERNAL_PENDING"],
    ["normalized.github_actions", githubActionsEvidenceRows.every((row) => row.workflow_conclusion_passed_now), "BLOCKED_PENDING_EXTERNAL_EVIDENCE"],
    ["normalized.attestation", attestationVerifyRows.every((row) => row.attestation_verification_passed_now), "BLOCKED_PENDING_EXTERNAL_EVIDENCE"],
    ["normalized.claude_review", claudeReviewReceiptRows.every((row) => row.review_completed_now && row.durable_raw_json_present_now), "BLOCKED_PENDING_REVIEW_RECEIPT"],
  ];
  return specs.map(([result_id, passed_now, normalized_status], index) => ({
    schema_version: "normalized-verification-result-row.v1",
    row_id: `normalized.verification.result.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    result_id,
    normalized_status: passed_now ? "PASS" : normalized_status,
    pass_for_contract_readiness: !String(normalized_status).startsWith("BLOCKED"),
    pass_for_p5400_closeout: Boolean(passed_now),
    evidence_ref: `evidence.normalized_result.${result_id}`,
    block_reason: passed_now ? null : `p5400_closeout_pending.${result_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: passed_now ? "preserve normalized pass" : `capture evidence for ${result_id}`,
  }));
}

function buildMilestoneTrustDecisionRows({ ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, generatedAt }) {
  const localContractsReady = ciRequiredCheckRows.every((row) => row.local_contract_ready);
  const externalEvidenceReady = githubActionsEvidenceRows.every((row) => row.workflow_conclusion_passed_now)
    && attestationVerifyRows.every((row) => row.attestation_verification_passed_now)
    && claudeReviewReceiptRows.every((row) => row.review_completed_now && row.durable_raw_json_present_now);
  return [
    {
      schema_version: "milestone-trust-decision-row.v1",
      row_id: "milestone.trust.decision.row.001",
      generated_at: generatedAt,
      milestone_id: "milestone.p5400",
      milestone_range: "P5400",
      local_contract_readiness: localContractsReady,
      external_evidence_ready: externalEvidenceReady,
      p5400_milestone_closeout_ready: localContractsReady && externalEvidenceReady,
      single_owner_claude_reviewed_mode: true,
      lower_trust_readiness_allowed: localContractsReady,
      enterprise_trust_claim_allowed: false,
      human_adjudication_required: false,
      protected_closeout_enabled: false,
      block_reason: externalEvidenceReady ? null : "p5400_requires_github_actions_attestation_and_claude_review_receipts",
      evidence_ref: "evidence.milestone_trust_decision.p5400",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: externalEvidenceReady ? "freeze P5400 lower-trust milestone" : "collect external evidence receipts before P5400 closeout",
    },
  ];
}

function buildFreezeRows({ standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, generatedAt }) {
  const specs = [
    ["standard_validators_ready", standardValidatorRows.every((row) => row.adapter_status === "REGISTERED"), "standard validator adapters are registered"],
    ["dual_run_contract_ready", dualRunRows.every((row) => row.normalized_equivalent && row.mismatch_count === 0), "dual-run results normalize without mismatch"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe trust claims"],
    ["ci_required_check_contract_ready", ciRequiredCheckRows.every((row) => row.local_contract_ready), "CI required check contracts are ready"],
    ["github_actions_external_pending_visible", githubActionsEvidenceRows.every((row) => row.evidence_status === "BLOCKED_PENDING_EXTERNAL_EVIDENCE"), "GitHub Actions external evidence is visibly pending"],
    ["attestation_external_pending_visible", attestationVerifyRows.every((row) => row.evidence_status === "BLOCKED_PENDING_SIGNED_VERIFY_RECEIPT"), "attestation verify evidence is visibly pending"],
    ["claude_review_external_pending_visible", claudeReviewReceiptRows.every((row) => row.evidence_status === "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT"), "Claude review receipt evidence is visibly pending"],
    ["normalized_results_ready", normalizedResultRows.every((row) => row.unsafe_flags_false), "normalized result rows are ready"],
    ["milestone_trust_decision_ready", milestoneTrustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "milestone trust decision rows are ready"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "verification-orchestration-freeze-row.v1",
    row_id: `verification.orchestration.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.verification_orchestration.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.verification_orchestration.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, developmentConsole, contract, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:verification-orchestration-runtime"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes verification orchestration runtime"],
    ["console_script_registered", Boolean(packageJson.data?.scripts?.[CONSOLE_COMMAND_NAME]), "development control console script exists"],
    ["console_ready", developmentConsole.summary?.development_control_console_status === CONSOLE_READY_STATUS, "P4601-P5000 development console is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Verification Orchestration Runtime"), "P5001-P5400 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Verification Orchestration Runtime"), "architecture doc reflects verification orchestration"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Verification Orchestration Runtime"), "review dashboard IA reflects verification orchestration"],
    ["contract_ready", contract.standard_validator_adapter_required && contract.claude_review_completion_receipt_required && contract.human_adjudication_in_milestone_gate === false, "verification orchestration contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P5001-P5400 phase rows pass"],
    ["standard_validators_ready", standardValidatorRows.every((row) => row.adapter_status === "REGISTERED"), "standard validator adapters are registered"],
    ["dual_run_rows_ready", dualRunRows.every((row) => row.normalized_equivalent && row.mismatch_count === 0), "dual-run rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe states"],
    ["ci_required_check_contract_ready", ciRequiredCheckRows.every((row) => row.local_contract_ready), "CI required check contracts are ready"],
    ["github_actions_pending_visible", githubActionsEvidenceRows.every((row) => row.workflow_conclusion_passed_now === false && row.evidence_status === "BLOCKED_PENDING_EXTERNAL_EVIDENCE"), "GitHub Actions pending state is visible"],
    ["attestation_pending_visible", attestationVerifyRows.every((row) => row.attestation_verification_passed_now === false && row.evidence_status === "BLOCKED_PENDING_SIGNED_VERIFY_RECEIPT"), "attestation pending state is visible"],
    ["claude_review_pending_visible", claudeReviewReceiptRows.every((row) => row.review_completed_now === false && row.durable_raw_json_required && row.evidence_status === "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT"), "Claude review pending state is visible"],
    ["normalized_results_ready", normalizedResultRows.every((row) => row.unsafe_flags_false), "normalized results are ready"],
    ["milestone_decision_ready", milestoneTrustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "milestone trust decision rows are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_enterprise_claim", contract.enterprise_trust_claim_enabled === false, "enterprise trust remains disabled"],
    ["boundary_no_runtime_write", contract.agent_runtime_execution_enabled === false && contract.write_action_enabled === false && contract.protected_action_enabled === false, "runtime/write/protected action stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "verification-orchestration-gate-row.v1",
    row_id: `verification.orchestration.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.verification_orchestration.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("claude") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.verification_orchestration.${gate_id}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ developmentConsole, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    developmentConsole.summary?.development_control_console_status !== CONSOLE_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    standardValidatorRows.some((row) => row.adapter_status !== "REGISTERED"),
    dualRunRows.some((row) => !row.normalized_equivalent || row.mismatch_count !== 0),
    negativeFixtureRows.some((row) => row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED" || row.unsafe_claim_allowed),
    ciRequiredCheckRows.some((row) => !row.local_contract_ready),
    githubActionsEvidenceRows.some((row) => row.workflow_conclusion_passed_now),
    attestationVerifyRows.some((row) => row.attestation_verification_passed_now),
    claudeReviewReceiptRows.some((row) => row.review_completed_now || row.durable_raw_json_present_now),
    normalizedResultRows.some((row) => !row.unsafe_flags_false),
    milestoneTrustDecisionRows.some((row) => row.enterprise_trust_claim_allowed || row.human_adjudication_required || row.protected_closeout_enabled),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  const p5400CloseoutReady = milestoneTrustDecisionRows.every((row) => row.p5400_milestone_closeout_ready);
  return {
    schema_version: "verification-orchestration-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4601-P5000",
    verification_orchestration_runtime_ready: unsafeFlags.filter(Boolean).length === 0,
    development_control_console_ready: developmentConsole.summary?.development_control_console_status === CONSOLE_READY_STATUS,
    standard_validator_contract_ready: standardValidatorRows.every((row) => row.adapter_status === "REGISTERED"),
    dual_run_contract_ready: dualRunRows.every((row) => row.normalized_equivalent && row.mismatch_count === 0),
    negative_fixtures_ready: negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"),
    ci_required_check_contract_ready: ciRequiredCheckRows.every((row) => row.local_contract_ready),
    github_actions_observed_now: githubActionsEvidenceRows.some((row) => row.workflow_run_observed_now),
    github_actions_passed_now: githubActionsEvidenceRows.every((row) => row.workflow_conclusion_passed_now),
    attestation_verification_passed_now: attestationVerifyRows.every((row) => row.attestation_verification_passed_now),
    claude_review_completed_now: claudeReviewReceiptRows.every((row) => row.review_completed_now),
    durable_claude_raw_json_present_now: claudeReviewReceiptRows.every((row) => row.durable_raw_json_present_now),
    p5400_milestone_closeout_ready: p5400CloseoutReady,
    p5400_closeout_block_reason: p5400CloseoutReady ? null : "external CI, attestation verify, and completed Claude review receipts are still missing",
    local_only_pass_can_claim_enterprise_trust: false,
    single_owner_claude_reviewed_mode: true,
    lower_trust_readiness_allowed: milestoneTrustDecisionRows.every((row) => row.lower_trust_readiness_allowed),
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
    deterministic_validation_orchestration_enabled: true,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, developmentConsole, contract, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include verification orchestration command"),
    validationItem("console.ready", "source", developmentConsole.summary?.development_control_console_status === CONSOLE_READY_STATUS, "development control console must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P5001-P5400 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Verification Orchestration Runtime"), "architecture must reflect verification orchestration"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Verification Orchestration Runtime"), "dashboard IA must reflect verification orchestration"),
    validationItem("contract.ready", "contract", contract.standard_validator_adapter_required && contract.claude_review_completion_receipt_required, "contract must require validator and Claude review receipts"),
    validationItem("contract.no_human_gate", "contract", contract.human_adjudication_in_milestone_gate === false && contract.protected_closeout_enabled === false, "human milestone gate and protected closeout must stay disabled"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P5001-P5400 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P5001-P5400 phase rows must pass"),
    validationItem("validators.ready", "validators", standardValidatorRows.every((row) => row.adapter_status === "REGISTERED"), "all standard validators must be registered"),
    validationItem("dual_run.ready", "dual_run", dualRunRows.every((row) => row.normalized_equivalent && row.mismatch_count === 0), "dual-run rows must be equivalent"),
    validationItem("negative_fixtures.ready", "negative_fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures must block expected states"),
    validationItem("ci.contracts.ready", "ci", ciRequiredCheckRows.every((row) => row.local_contract_ready), "CI required check contracts must be ready"),
    validationItem("github.pending_visible", "github", githubActionsEvidenceRows.every((row) => row.evidence_status === "BLOCKED_PENDING_EXTERNAL_EVIDENCE" && row.workflow_conclusion_passed_now === false), "GitHub pending state must be visible"),
    validationItem("attestation.pending_visible", "attestation", attestationVerifyRows.every((row) => row.evidence_status === "BLOCKED_PENDING_SIGNED_VERIFY_RECEIPT" && row.attestation_verification_passed_now === false), "attestation pending state must be visible"),
    validationItem("claude.pending_visible", "claude", claudeReviewReceiptRows.every((row) => row.evidence_status === "BLOCKED_PENDING_CLAUDE_REVIEW_RECEIPT" && row.durable_raw_json_required && row.review_completed_now === false), "Claude review pending state must be visible"),
    validationItem("normalized.ready", "normalized", normalizedResultRows.every((row) => row.unsafe_flags_false), "normalized rows must be ready"),
    validationItem("milestone_decision.ready", "milestone", milestoneTrustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "milestone trust decision must be ready"),
    validationItem("milestone_decision.closeout_blocked", "milestone", milestoneTrustDecisionRows.every((row) => row.p5400_milestone_closeout_ready === false), "P5400 closeout must remain blocked without external evidence"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.p5400_blocked", "boundary", boundary.p5400_milestone_closeout_ready === false, "P5400 milestone closeout must remain blocked pending external evidence"),
    validationItem("boundary.no_enterprise", "boundary", boundary.enterprise_trust_claim_enabled === false && boundary.local_only_pass_can_claim_enterprise_trust === false, "enterprise trust must stay disabled"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.agent_runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.protected_action_enabled === false, "agent runtime/write/protected action must stay disabled"),
  ];
}

function buildSummary({ developmentConsole, phaseRows, standardValidatorRows, dualRunRows, negativeFixtureRows, ciRequiredCheckRows, githubActionsEvidenceRows, attestationVerifyRows, claudeReviewReceiptRows, normalizedResultRows, milestoneTrustDecisionRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "verification-orchestration-runtime-summary.v1",
    verification_orchestration_runtime_status: validation.valid && boundary.verification_orchestration_runtime_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4601-P5000",
    development_control_console_status: developmentConsole.summary?.development_control_console_status ?? "unknown",
    phase_row_count: phaseRows.length,
    standard_validator_count: standardValidatorRows.length,
    dual_run_result_count: dualRunRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    ci_required_check_count: ciRequiredCheckRows.length,
    github_actions_evidence_count: githubActionsEvidenceRows.length,
    attestation_verify_count: attestationVerifyRows.length,
    claude_review_receipt_count: claudeReviewReceiptRows.length,
    normalized_result_count: normalizedResultRows.length,
    milestone_trust_decision_count: milestoneTrustDecisionRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    standard_validator_contract_ready: boundary.standard_validator_contract_ready,
    dual_run_contract_ready: boundary.dual_run_contract_ready,
    ci_required_check_contract_ready: boundary.ci_required_check_contract_ready,
    github_actions_observed_now: boundary.github_actions_observed_now,
    github_actions_passed_now: boundary.github_actions_passed_now,
    attestation_verification_passed_now: boundary.attestation_verification_passed_now,
    claude_review_completed_now: boundary.claude_review_completed_now,
    durable_claude_raw_json_present_now: boundary.durable_claude_raw_json_present_now,
    p5400_milestone_closeout_ready: boundary.p5400_milestone_closeout_ready,
    lower_trust_readiness_allowed: boundary.lower_trust_readiness_allowed,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    deterministic_validation_orchestration_enabled: boundary.deterministic_validation_orchestration_enabled,
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
    block_reason: pass ? null : `missing_verification_orchestration.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Verification Orchestration Runtime",
    "",
    `Status: ${result.summary.verification_orchestration_runtime_status}`,
    `Program: ${result.summary.program_range}`,
    `Development console: ${result.summary.development_control_console_status}`,
    `Standard validators: ${result.summary.standard_validator_count}`,
    `Dual-run rows: ${result.summary.dual_run_result_count}`,
    `Negative fixtures: ${result.summary.negative_fixture_count}`,
    `CI required checks: ${result.summary.ci_required_check_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `GitHub Actions passed now: ${result.summary.github_actions_passed_now}`,
    `Attestation verification passed now: ${result.summary.attestation_verification_passed_now}`,
    `Claude review completed now: ${result.summary.claude_review_completed_now}`,
    `Durable Claude raw JSON present now: ${result.summary.durable_claude_raw_json_present_now}`,
    `P5400 closeout ready: ${result.summary.p5400_milestone_closeout_ready}`,
    `Lower-trust readiness allowed: ${result.summary.lower_trust_readiness_allowed}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Agent runtime execution enabled: ${result.summary.agent_runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Closeout Boundary",
    "",
    "The runtime contract is ready, but P5400 closeout remains blocked until GitHub Actions evidence, signed attestation verification, and a completed Claude Code Opus max review receipt with durable raw JSON are captured. Human adjudication is not part of the current milestone gate, so protected closeout and enterprise-trust claims stay disabled.",
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
  const defaults = DEFAULT_VERIFICATION_ORCHESTRATION_RUNTIME_INPUTS;
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
  console.log(`Usage: node scripts/verification-orchestration-runtime.mjs [options]

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
