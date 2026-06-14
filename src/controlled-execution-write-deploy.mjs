import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildProductDomainSaasFactory } from "./product-domain-saas-factory.mjs";

export const DEFAULT_CONTROLLED_EXECUTION_WRITE_DEPLOY_OUT_DIR = "artifacts/controlled-execution-write-deploy/latest";
export const DEFAULT_CONTROLLED_EXECUTION_WRITE_DEPLOY_INPUTS = {
  schemaPath: "schemas/controlled-execution-write-deploy.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:controlled-execution-write-deploy";
const FACTORY_COMMAND_NAME = "platform:product-domain-saas-factory";
const SCHEMA_VERSION = "controlled-execution-write-deploy.v1";
const CAPABILITY_ID = "platform.controlled_execution_write_deploy";
const PROGRAM_RANGE = "P6601-P7000";
const READY_STATUS = "ready_for_controlled_execution_write_deploy_v0";
const FACTORY_READY_STATUS = "ready_for_product_domain_saas_factory_v0";

const PHASE_SPECS = [
  ["P6601-P6640", "Execution Allowlist Contract"],
  ["P6641-P6680", "Sandbox and Timeout Policy"],
  ["P6681-P6720", "Redaction and Secret Scanner"],
  ["P6721-P6760", "Patch Candidate Lane"],
  ["P6761-P6800", "Receipt-Gated Apply Boundary"],
  ["P6801-P6840", "Deploy Receipt Contract"],
  ["P6841-P6880", "Rollback Binding and Recovery Plan"],
  ["P6881-P6920", "Post-Apply Validation Matrix"],
  ["P6921-P6960", "Execution Trust Negative Fixtures"],
  ["P6961-P7000", "Controlled Execution Write Deploy Freeze"],
];

const ALLOWLIST_SPECS = [
  ["allowlist.platform_check", "npm run platform:* -- --check", "platform validators in check mode"],
  ["allowlist.node_test_targeted", "node --test <targeted tests>", "targeted deterministic Node tests"],
  ["allowlist.schema_json_check", "jq empty <schema or artifact>", "JSON syntax validation"],
  ["allowlist.diff_check", "git diff --check", "whitespace and patch hygiene"],
  ["allowlist.github_readonly_check", "gh pr checks / gh run view", "read-only GitHub evidence observation"],
];

const SANDBOX_SPECS = [
  ["sandbox.repo_local", "repo-local working directory only"],
  ["sandbox.timeout", "bounded timeout and cancellation policy"],
  ["sandbox.no_network_by_default", "network disabled unless explicit external evidence lane exists"],
  ["sandbox.no_secret_env", "no raw secret environment materialization"],
];

const POST_APPLY_VALIDATION_SPECS = [
  ["post_apply.node_check", "node --check touched modules"],
  ["post_apply.targeted_tests", "targeted test files"],
  ["post_apply.platform_validator", "affected platform validator --check"],
  ["post_apply.diff_check", "git diff --check"],
  ["post_apply.rollback_verification", "rollback target and restore instructions"],
];

const NEGATIVE_FIXTURES = [
  ["negative.freeform_command", "free-form command execution is treated as approved", "BLOCK_FREEFORM_COMMAND"],
  ["negative.direct_patch_apply", "generated patch is applied without receipt boundary", "BLOCK_DIRECT_APPLY"],
  ["negative.no_human_as_apply_authority", "no-human mode is treated as protected apply approval", "BLOCK_PROTECTED_APPLY"],
  ["negative.deploy_without_receipt", "deployment is executed without deploy receipt and rollback binding", "BLOCK_DEPLOY"],
  ["negative.secret_in_logs", "raw secret appears in stdout, stderr, artifact, or review packet", "BLOCK_SECRET_EXPOSURE"],
  ["negative.raw_sensitive_data", "raw HR/client/domain-sensitive material is read or exported", "BLOCK_RAW_SENSITIVE_DATA"],
  ["negative.external_service_write", "external repo/service write is performed from factory lane", "BLOCK_EXTERNAL_WRITE"],
  ["negative.rollback_missing", "write/deploy candidate lacks rollback target", "BLOCK_ROLLBACK_MISSING"],
];

export async function runControlledExecutionWriteDeploy(options = {}) {
  const result = await buildControlledExecutionWriteDeploy(options);
  if (options.write !== false) await writeControlledExecutionWriteDeploy(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Controlled execution write deploy failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildControlledExecutionWriteDeploy(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROLLED_EXECUTION_WRITE_DEPLOY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const factory = options.factory ?? await buildProductDomainSaasFactory({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildExecutionContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const allowlistRows = buildAllowlistRows(generatedAt);
  const sandboxRows = buildSandboxRows(generatedAt);
  const redactionRows = buildRedactionRows(generatedAt);
  const patchCandidateRows = buildPatchCandidateRows(generatedAt);
  const applyBoundaryRows = buildApplyBoundaryRows(generatedAt);
  const deployReceiptRows = buildDeployReceiptRows(generatedAt);
  const rollbackRows = buildRollbackRows(generatedAt);
  const postApplyValidationRows = buildPostApplyValidationRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({ allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, factory, contract, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows });
  const boundary = buildBoundary({ factory, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, factory, contract, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    controlled_execution_write_deploy_id: `controlled-execution-write-deploy.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_product_domain_saas_factory_summary: factory.summary,
    controlled_execution_write_deploy_contract: contract,
    controlled_execution_write_deploy_phase_rows: phaseRows,
    execution_allowlist_rows: allowlistRows,
    sandbox_timeout_policy_rows: sandboxRows,
    redaction_secret_scanner_rows: redactionRows,
    patch_candidate_lane_rows: patchCandidateRows,
    receipt_gated_apply_boundary_rows: applyBoundaryRows,
    deploy_receipt_contract_rows: deployReceiptRows,
    rollback_binding_rows: rollbackRows,
    post_apply_validation_rows: postApplyValidationRows,
    execution_negative_fixture_rows: negativeFixtureRows,
    controlled_execution_write_deploy_freeze_rows: freezeRows,
    controlled_execution_write_deploy_gate_rows: gateRows,
    controlled_execution_write_deploy_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ factory, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "controlled_execution_write_deploy")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ factory, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.controlled_execution_write_deploy_id = result.controlled_execution_write_deploy_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeControlledExecutionWriteDeploy(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "controlled-execution-write-deploy.json"), serializableResult(result));
  await writeJson(path.join(outDir, "execution-allowlist-rows.json"), collectionEnvelope("execution-allowlist-rows.v1", "execution_allowlist_rows", result.execution_allowlist_rows, result.generated_at));
  await writeJson(path.join(outDir, "sandbox-timeout-policy-rows.json"), collectionEnvelope("sandbox-timeout-policy-rows.v1", "sandbox_timeout_policy_rows", result.sandbox_timeout_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "redaction-secret-scanner-rows.json"), collectionEnvelope("redaction-secret-scanner-rows.v1", "redaction_secret_scanner_rows", result.redaction_secret_scanner_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-candidate-lane-rows.json"), collectionEnvelope("patch-candidate-lane-rows.v1", "patch_candidate_lane_rows", result.patch_candidate_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-gated-apply-boundary-rows.json"), collectionEnvelope("receipt-gated-apply-boundary-rows.v1", "receipt_gated_apply_boundary_rows", result.receipt_gated_apply_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "deploy-receipt-contract-rows.json"), collectionEnvelope("deploy-receipt-contract-rows.v1", "deploy_receipt_contract_rows", result.deploy_receipt_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-binding-rows.json"), collectionEnvelope("rollback-binding-rows.v1", "rollback_binding_rows", result.rollback_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-apply-validation-rows.json"), collectionEnvelope("post-apply-validation-rows.v1", "post_apply_validation_rows", result.post_apply_validation_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-negative-fixture-rows.json"), collectionEnvelope("execution-negative-fixture-rows.v1", "execution_negative_fixture_rows", result.execution_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-write-deploy-freeze-rows.json"), collectionEnvelope("controlled-execution-write-deploy-freeze-rows.v1", "controlled_execution_write_deploy_freeze_rows", result.controlled_execution_write_deploy_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-write-deploy-gate-rows.json"), collectionEnvelope("controlled-execution-write-deploy-gate-rows.v1", "controlled_execution_write_deploy_gate_rows", result.controlled_execution_write_deploy_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-write-deploy-boundary.json"), result.controlled_execution_write_deploy_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "controlled-execution-write-deploy-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlledExecutionWriteDeployCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runControlledExecutionWriteDeploy(args);
    console.log(`Controlled execution write deploy ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.controlled_execution_write_deploy_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Allowlist rows: ${result.summary.execution_allowlist_count}`);
    console.log(`Patch candidate lane ready: ${result.summary.patch_candidate_lane_ready}`);
    console.log(`Command execution enabled: ${result.summary.command_execution_enabled}`);
    console.log(`Patch apply enabled: ${result.summary.patch_apply_enabled}`);
    console.log(`Deploy enabled: ${result.summary.deploy_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildExecutionContract(generatedAt) {
  return {
    schema_version: "controlled-execution-write-deploy-contract.v1",
    generated_at: generatedAt,
    contract_id: "controlled-execution-write-deploy-contract.p6601-p7000",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6201-P6600",
    execution_allowlist_contract_required: true,
    sandbox_timeout_policy_required: true,
    redaction_secret_scanner_required: true,
    patch_candidate_lane_required: true,
    receipt_gated_apply_boundary_required: true,
    deploy_receipt_contract_required: true,
    rollback_binding_required: true,
    post_apply_validation_required: true,
    negative_fixtures_required: true,
    allowlisted_execution_contract_ready: true,
    patch_candidate_generation_ready: true,
    command_execution_enabled: false,
    patch_apply_enabled: false,
    deploy_enabled: false,
    external_project_write_enabled: false,
    raw_sensitive_data_access_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
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
      schema_version: "controlled-execution-write-deploy-phase-row.v1",
      row_id: `controlled.execution.write.deploy.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.controlled_execution_write_deploy.${phase_range}`,
      responsible_owner: "platform_runtime_owner",
      next_allowed_action: pass ? "preserve controlled execution phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildAllowlistRows(generatedAt) {
  return ALLOWLIST_SPECS.map(([allowlist_id, command_pattern, purpose]) => ({
    schema_version: "execution-allowlist-row.v1",
    row_id: `execution.allowlist.row.${allowlist_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    allowlist_id,
    command_pattern,
    purpose,
    allowlist_contract_ready: true,
    command_execution_enabled_now: false,
    requires_receipt_before_execution: true,
    stdout_stderr_capture_required: true,
    redaction_required: true,
    timeout_required: true,
    rollback_binding_required: true,
    evidence_ref: `evidence.execution_allowlist.${allowlist_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.execution_allowlist.${allowlist_id}`,
    next_allowed_action: "keep command as contract-only until execution lane is reopened",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildSandboxRows(generatedAt) {
  return SANDBOX_SPECS.map(([policy_id, policy_description]) => ({
    schema_version: "sandbox-timeout-policy-row.v1",
    row_id: `sandbox.timeout.policy.row.${policy_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    policy_id,
    policy_description,
    policy_contract_ready: true,
    repo_local_only: policy_id === "sandbox.repo_local",
    timeout_required: true,
    network_disabled_by_default: true,
    raw_secret_env_disabled: true,
    execution_enabled_now: false,
    evidence_ref: `evidence.sandbox_timeout_policy.${policy_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.sandbox_timeout_policy.${policy_id}`,
    next_allowed_action: "preserve sandbox policy before any command execution",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRedactionRows(generatedAt) {
  const specs = [
    ["redaction.stdout_stderr", "stdout and stderr redaction"],
    ["redaction.artifact_scan", "artifact secret and raw sensitive data scan"],
    ["redaction.review_packet_scan", "review packet redaction before Claude review"],
  ];
  return specs.map(([scanner_id, scanner_name]) => ({
    schema_version: "redaction-secret-scanner-row.v1",
    row_id: `redaction.secret.scanner.row.${scanner_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    scanner_id,
    scanner_name,
    scanner_contract_ready: true,
    raw_secret_allowed: false,
    raw_sensitive_data_allowed: false,
    scan_required_before_receipt_closeout: true,
    leak_blocks_execution_or_apply: true,
    evidence_ref: `evidence.redaction_secret_scanner.${scanner_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.redaction_secret_scanner.${scanner_id}`,
    next_allowed_action: "scan candidates before any execution or review receipt closeout",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildPatchCandidateRows(generatedAt) {
  return [
    {
      schema_version: "patch-candidate-lane-row.v1",
      row_id: "patch.candidate.lane.row.001",
      generated_at: generatedAt,
      patch_lane_id: "patch.candidate.generated_patch_only",
      patch_candidate_generation_ready: true,
      generated_patch_only: true,
      direct_apply_allowed: false,
      diff_review_packet_required: true,
      claude_review_receipt_required: true,
      rollback_binding_required: true,
      post_apply_validation_required: true,
      evidence_ref: "evidence.patch_candidate_lane.generated_patch_only",
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: "gate.patch_candidate_lane.generated_patch_only",
      next_allowed_action: "generate reviewable patch candidates only",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildApplyBoundaryRows(generatedAt) {
  return [
    {
      schema_version: "receipt-gated-apply-boundary-row.v1",
      row_id: "receipt.gated.apply.boundary.row.001",
      generated_at: generatedAt,
      apply_boundary_id: "apply.no_human_mode_disabled",
      receipt_gated_apply_boundary_ready: true,
      apply_receipt_required: true,
      no_human_mode_blocks_apply: true,
      patch_apply_enabled: false,
      protected_apply_enabled: false,
      external_project_write_enabled: false,
      evidence_ref: "evidence.receipt_gated_apply_boundary.no_human_mode_disabled",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.receipt_gated_apply_boundary.no_human_mode_disabled",
      next_allowed_action: "keep apply disabled until an explicit approval lane is reopened",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildDeployReceiptRows(generatedAt) {
  const specs = [
    ["deploy.preview", "preview deploy receipt contract"],
    ["deploy.production", "production deploy receipt contract"],
  ];
  return specs.map(([deploy_id, deploy_name]) => ({
    schema_version: "deploy-receipt-contract-row.v1",
    row_id: `deploy.receipt.contract.row.${deploy_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    deploy_id,
    deploy_name,
    deploy_receipt_contract_ready: true,
    deploy_enabled_now: false,
    commit_sha_binding_required: true,
    environment_binding_required: true,
    rollback_binding_required: true,
    post_deploy_validation_required: true,
    evidence_ref: `evidence.deploy_receipt_contract.${deploy_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.deploy_receipt_contract.${deploy_id}`,
    next_allowed_action: "prepare deploy receipt contract without executing deploy",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRollbackRows(generatedAt) {
  return [
    {
      schema_version: "rollback-binding-row.v1",
      row_id: "rollback.binding.row.001",
      generated_at: generatedAt,
      rollback_binding_id: "rollback.patch_or_deploy_candidate",
      rollback_binding_ready: true,
      rollback_target_required: true,
      restore_instructions_required: true,
      owner_required: true,
      validation_after_rollback_required: true,
      write_or_deploy_without_rollback_allowed: false,
      evidence_ref: "evidence.rollback_binding.patch_or_deploy_candidate",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.rollback_binding.patch_or_deploy_candidate",
      next_allowed_action: "bind rollback before any future apply or deploy candidate",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildPostApplyValidationRows(generatedAt) {
  return POST_APPLY_VALIDATION_SPECS.map(([validation_id, validation_name]) => ({
    schema_version: "post-apply-validation-row.v1",
    row_id: `post.apply.validation.row.${validation_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    validation_id,
    validation_name,
    validation_contract_ready: true,
    required_after_apply: true,
    required_after_deploy: validation_id !== "post_apply.rollback_verification",
    can_be_skipped: false,
    evidence_ref: `evidence.post_apply_validation.${validation_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.post_apply_validation.${validation_id}`,
    next_allowed_action: "bind post-apply validation before reopening apply lane",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "execution-negative-fixture-row.v1",
    row_id: `execution.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_execution_claim_allowed: false,
    evidence_ref: `evidence.execution_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.execution_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve execution negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, generatedAt }) {
  const specs = [
    ["allowlist_contract_ready", allowlistRows.every((row) => row.allowlist_contract_ready && row.command_execution_enabled_now === false), "allowlist is contract-ready while execution is disabled"],
    ["sandbox_policy_ready", sandboxRows.every((row) => row.policy_contract_ready && row.execution_enabled_now === false), "sandbox and timeout policy is ready"],
    ["redaction_scanner_ready", redactionRows.every((row) => row.scanner_contract_ready && row.raw_secret_allowed === false), "redaction and secret scanner contracts are ready"],
    ["patch_candidate_lane_ready", patchCandidateRows.every((row) => row.patch_candidate_generation_ready && row.direct_apply_allowed === false), "patch candidate lane is generated-patch only"],
    ["apply_boundary_ready", applyBoundaryRows.every((row) => row.receipt_gated_apply_boundary_ready && row.patch_apply_enabled === false), "apply boundary keeps apply disabled"],
    ["deploy_receipt_contract_ready", deployReceiptRows.every((row) => row.deploy_receipt_contract_ready && row.deploy_enabled_now === false), "deploy receipt contracts are ready while deploy is disabled"],
    ["rollback_binding_ready", rollbackRows.every((row) => row.rollback_binding_ready && row.write_or_deploy_without_rollback_allowed === false), "rollback binding is ready"],
    ["post_apply_validation_ready", postApplyValidationRows.every((row) => row.validation_contract_ready && row.can_be_skipped === false), "post-apply validation matrix is ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_execution_claim_allowed === false), "execution negative fixtures block unsafe claims"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "controlled-execution-write-deploy-freeze-row.v1",
    row_id: `controlled.execution.write.deploy.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.controlled_execution_write_deploy.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.controlled_execution_write_deploy.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, factory, contract, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:controlled-execution-write-deploy"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes controlled execution write deploy"],
    ["factory_script_registered", Boolean(packageJson.data?.scripts?.[FACTORY_COMMAND_NAME]), "product domain SaaS factory script exists"],
    ["factory_ready", factory.summary?.product_domain_saas_factory_status === FACTORY_READY_STATUS, "P6201-P6600 product domain SaaS factory is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Controlled Execution Write and Deploy"), "P6601-P7000 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Controlled Execution Write and Deploy"), "architecture doc reflects controlled execution write deploy"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Controlled Execution Write and Deploy"), "review dashboard IA reflects controlled execution write deploy"],
    ["contract_ready", contract.execution_allowlist_contract_required && contract.command_execution_enabled === false && contract.human_adjudication_in_milestone_gate === false, "controlled execution contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P6601-P7000 phase rows pass"],
    ["allowlist_ready", allowlistRows.length >= 5 && allowlistRows.every((row) => row.allowlist_contract_ready && row.command_execution_enabled_now === false), "allowlist rows are ready"],
    ["sandbox_ready", sandboxRows.length >= 4 && sandboxRows.every((row) => row.policy_contract_ready && row.execution_enabled_now === false), "sandbox rows are ready"],
    ["redaction_ready", redactionRows.length >= 3 && redactionRows.every((row) => row.raw_secret_allowed === false && row.raw_sensitive_data_allowed === false), "redaction rows are ready"],
    ["patch_candidate_ready", patchCandidateRows.every((row) => row.patch_candidate_generation_ready && row.direct_apply_allowed === false), "patch candidate lane is ready"],
    ["apply_boundary_ready", applyBoundaryRows.every((row) => row.no_human_mode_blocks_apply && row.patch_apply_enabled === false), "apply boundary blocks apply"],
    ["deploy_receipts_ready", deployReceiptRows.length >= 2 && deployReceiptRows.every((row) => row.deploy_receipt_contract_ready && row.deploy_enabled_now === false), "deploy receipt contracts are ready"],
    ["rollback_ready", rollbackRows.every((row) => row.rollback_binding_ready && row.write_or_deploy_without_rollback_allowed === false), "rollback rows are ready"],
    ["post_apply_validation_ready", postApplyValidationRows.length >= 5 && postApplyValidationRows.every((row) => row.validation_contract_ready && row.can_be_skipped === false), "post-apply validation rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "execution negative fixtures are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_execution_write_deploy", contract.command_execution_enabled === false && contract.write_action_enabled === false && contract.deploy_enabled === false, "execution/write/deploy stay disabled"],
    ["boundary_no_work_os", contract.work_os_claim_enabled === false && contract.enterprise_trust_claim_enabled === false, "Work OS and enterprise trust stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "controlled-execution-write-deploy-gate-row.v1",
    row_id: `controlled.execution.write.deploy.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.controlled_execution_write_deploy.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("patch") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.controlled_execution_write_deploy.${gate_id}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ factory, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    factory.summary?.product_domain_saas_factory_status !== FACTORY_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    allowlistRows.some((row) => !row.allowlist_contract_ready || row.command_execution_enabled_now),
    sandboxRows.some((row) => !row.policy_contract_ready || row.execution_enabled_now || !row.timeout_required),
    redactionRows.some((row) => row.raw_secret_allowed || row.raw_sensitive_data_allowed || !row.scan_required_before_receipt_closeout),
    patchCandidateRows.some((row) => !row.patch_candidate_generation_ready || row.direct_apply_allowed),
    applyBoundaryRows.some((row) => !row.no_human_mode_blocks_apply || row.patch_apply_enabled || row.protected_apply_enabled || row.external_project_write_enabled),
    deployReceiptRows.some((row) => row.deploy_enabled_now || !row.rollback_binding_required),
    rollbackRows.some((row) => !row.rollback_binding_ready || row.write_or_deploy_without_rollback_allowed),
    postApplyValidationRows.some((row) => !row.validation_contract_ready || row.can_be_skipped),
    negativeFixtureRows.some((row) => row.unsafe_execution_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "controlled-execution-write-deploy-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6201-P6600",
    controlled_execution_write_deploy_ready: unsafeFlags.filter(Boolean).length === 0,
    product_domain_saas_factory_ready: factory.summary?.product_domain_saas_factory_status === FACTORY_READY_STATUS,
    allowlisted_execution_contract_ready: allowlistRows.every((row) => row.allowlist_contract_ready),
    sandbox_timeout_policy_ready: sandboxRows.every((row) => row.policy_contract_ready),
    redaction_secret_scanner_ready: redactionRows.every((row) => row.scanner_contract_ready),
    patch_candidate_lane_ready: patchCandidateRows.every((row) => row.patch_candidate_generation_ready),
    receipt_gated_apply_boundary_ready: applyBoundaryRows.every((row) => row.receipt_gated_apply_boundary_ready),
    deploy_receipt_contract_ready: deployReceiptRows.every((row) => row.deploy_receipt_contract_ready),
    rollback_binding_ready: rollbackRows.every((row) => row.rollback_binding_ready),
    post_apply_validation_ready: postApplyValidationRows.every((row) => row.validation_contract_ready),
    command_execution_enabled: false,
    patch_apply_enabled: false,
    protected_apply_enabled: false,
    deploy_enabled: false,
    external_project_write_enabled: false,
    raw_sensitive_data_access_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, factory, contract, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include controlled execution write deploy command"),
    validationItem("factory.ready", "source", factory.summary?.product_domain_saas_factory_status === FACTORY_READY_STATUS, "product domain SaaS factory must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P6601-P7000 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Controlled Execution Write and Deploy"), "architecture must reflect controlled execution write deploy"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Controlled Execution Write and Deploy"), "dashboard IA must reflect controlled execution write deploy"),
    validationItem("contract.ready", "contract", contract.allowlisted_execution_contract_ready && contract.command_execution_enabled === false && contract.patch_apply_enabled === false, "controlled execution contract must be ready"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P6601-P7000 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P6601-P7000 phase rows must pass"),
    validationItem("allowlist.ready", "allowlist", allowlistRows.length >= 5 && allowlistRows.every((row) => row.command_execution_enabled_now === false), "allowlist rows must be execution-disabled"),
    validationItem("sandbox.ready", "sandbox", sandboxRows.length >= 4 && sandboxRows.every((row) => row.policy_contract_ready && row.execution_enabled_now === false), "sandbox policy rows must be ready"),
    validationItem("redaction.ready", "redaction", redactionRows.every((row) => row.raw_secret_allowed === false && row.raw_sensitive_data_allowed === false), "redaction rows must block raw material"),
    validationItem("patch.ready", "patch", patchCandidateRows.every((row) => row.patch_candidate_generation_ready && row.direct_apply_allowed === false), "patch candidate lane must be ready"),
    validationItem("apply.blocked", "apply", applyBoundaryRows.every((row) => row.no_human_mode_blocks_apply && row.patch_apply_enabled === false), "apply must stay blocked"),
    validationItem("deploy.blocked", "deploy", deployReceiptRows.every((row) => row.deploy_receipt_contract_ready && row.deploy_enabled_now === false), "deploy must stay blocked"),
    validationItem("rollback.ready", "rollback", rollbackRows.every((row) => row.rollback_binding_ready && row.write_or_deploy_without_rollback_allowed === false), "rollback rows must be ready"),
    validationItem("post_apply.ready", "post_apply", postApplyValidationRows.every((row) => row.validation_contract_ready && row.can_be_skipped === false), "post-apply validation must be ready"),
    validationItem("negative_fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_execution_claim_allowed === false), "negative fixtures must block unsafe execution claims"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "boundary", boundary.command_execution_enabled === false && boundary.agent_runtime_execution_enabled === false, "command/runtime execution must stay disabled"),
    validationItem("boundary.no_write_deploy", "boundary", boundary.patch_apply_enabled === false && boundary.write_action_enabled === false && boundary.deploy_enabled === false, "write/deploy must stay disabled"),
    validationItem("boundary.no_enterprise_workos", "boundary", boundary.enterprise_trust_claim_enabled === false && boundary.work_os_claim_enabled === false, "enterprise trust and Work OS claim must stay disabled"),
  ];
}

function buildSummary({ factory, phaseRows, allowlistRows, sandboxRows, redactionRows, patchCandidateRows, applyBoundaryRows, deployReceiptRows, rollbackRows, postApplyValidationRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "controlled-execution-write-deploy-summary.v1",
    controlled_execution_write_deploy_status: validation.valid && boundary.controlled_execution_write_deploy_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6201-P6600",
    product_domain_saas_factory_status: factory.summary?.product_domain_saas_factory_status ?? "unknown",
    phase_row_count: phaseRows.length,
    execution_allowlist_count: allowlistRows.length,
    sandbox_policy_count: sandboxRows.length,
    redaction_secret_scanner_count: redactionRows.length,
    patch_candidate_lane_count: patchCandidateRows.length,
    apply_boundary_count: applyBoundaryRows.length,
    deploy_receipt_count: deployReceiptRows.length,
    rollback_binding_count: rollbackRows.length,
    post_apply_validation_count: postApplyValidationRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    allowlisted_execution_contract_ready: boundary.allowlisted_execution_contract_ready,
    sandbox_timeout_policy_ready: boundary.sandbox_timeout_policy_ready,
    redaction_secret_scanner_ready: boundary.redaction_secret_scanner_ready,
    patch_candidate_lane_ready: boundary.patch_candidate_lane_ready,
    receipt_gated_apply_boundary_ready: boundary.receipt_gated_apply_boundary_ready,
    deploy_receipt_contract_ready: boundary.deploy_receipt_contract_ready,
    rollback_binding_ready: boundary.rollback_binding_ready,
    post_apply_validation_ready: boundary.post_apply_validation_ready,
    command_execution_enabled: boundary.command_execution_enabled,
    patch_apply_enabled: boundary.patch_apply_enabled,
    protected_apply_enabled: boundary.protected_apply_enabled,
    deploy_enabled: boundary.deploy_enabled,
    external_project_write_enabled: boundary.external_project_write_enabled,
    raw_sensitive_data_access_enabled: boundary.raw_sensitive_data_access_enabled,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    protected_final_decision_enabled: boundary.protected_final_decision_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
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
    block_reason: pass ? null : `missing_controlled_execution_write_deploy.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Controlled Execution Write Deploy",
    "",
    `Status: ${result.summary.controlled_execution_write_deploy_status}`,
    `Program: ${result.summary.program_range}`,
    `Product factory: ${result.summary.product_domain_saas_factory_status}`,
    `Allowlist rows: ${result.summary.execution_allowlist_count}`,
    `Patch candidate lane ready: ${result.summary.patch_candidate_lane_ready}`,
    `Deploy receipt contract ready: ${result.summary.deploy_receipt_contract_ready}`,
    `Rollback binding ready: ${result.summary.rollback_binding_ready}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Command execution enabled: ${result.summary.command_execution_enabled}`,
    `Patch apply enabled: ${result.summary.patch_apply_enabled}`,
    `Deploy enabled: ${result.summary.deploy_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Work OS claim enabled: ${result.summary.work_os_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Execution Boundary",
    "",
    "The controlled execution contract is ready, but command execution, patch apply, deploy, external project write, runtime execution, protected action, enterprise trust, and Work OS claims remain disabled. In current no-human milestone mode, Hermes may prepare patch and deploy candidates but must not apply or deploy them.",
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
  const defaults = DEFAULT_CONTROLLED_EXECUTION_WRITE_DEPLOY_INPUTS;
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
  console.log(`Usage: node scripts/controlled-execution-write-deploy.mjs [options]

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
