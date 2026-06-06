import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildWorkOsUiProductionFreeze } from "./work-os-ui-production-freeze.mjs";

export const DEFAULT_P8000_CLOSEOUT_REVIEW_CLEAN_CHECKPOINT_OUT_DIR = "artifacts/p8000-closeout-review-clean-checkpoint/latest";
export const DEFAULT_P8000_CLOSEOUT_REVIEW_CLEAN_CHECKPOINT_INPUTS = {
  schemaPath: "schemas/p8000-closeout-review-clean-checkpoint.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  closeoutDocPath: "docs/p8000-closeout-review-clean-checkpoint.md",
  workOsFreezeArtifactPath: "artifacts/work-os-ui-production-freeze/latest/work-os-ui-production-freeze.json",
  claudeReviewReceiptPath: "artifacts/p8000-closeout-review-clean-checkpoint/claude-review/claude-review-receipt.json",
  validationSummaryPath: "artifacts/p8000-closeout-review-clean-checkpoint/validation/validation-summary.json",
  gitStatusPath: "artifacts/p8000-closeout-review-clean-checkpoint/git/status.txt",
};

const COMMAND_NAME = "platform:p8000-closeout-review-clean-checkpoint";
const SOURCE_COMMAND_NAME = "platform:work-os-ui-production-freeze";
const SCHEMA_VERSION = "p8000-closeout-review-clean-checkpoint.v1";
const CAPABILITY_ID = "platform.p8000_closeout_review_clean_checkpoint";
const PROGRAM_RANGE = "P8001-P8080";
const SOURCE_PROGRAM_RANGE = "P7801-P8000";
const READY_STATUS = "ready_for_p8000_closeout_review_clean_checkpoint";

const PHASE_SPECS = [
  ["P8001-P8020", "P8000 Closeout Packet"],
  ["P8021-P8040", "Claude Review Receipt"],
  ["P8041-P8060", "Finding Loop And Revalidation"],
  ["P8061-P8080", "Clean Checkpoint"],
];

const CLOSEOUT_PACKET_SPECS = [
  ["packet.source_p8000_freeze", "P7801-P8000 Work OS freeze source artifact is present and ready"],
  ["packet.codex_implementation_manifest", "Codex implementation packet lists changed surfaces and boundaries"],
  ["packet.validation_command_matrix", "required validator and test commands are enumerated"],
  ["packet.review_receipt_lane", "Claude Code Opus max review receipt lane is bound to the checkpoint"],
  ["packet.finding_loop_lane", "findings feed a repair and revalidation loop"],
  ["packet.trust_boundary", "single-owner lower-trust boundary is explicit"],
  ["packet.rollback_notes", "rollback and next checkpoint notes are represented"],
];

const REQUIRED_COMMAND_SPECS = [
  ["command.node_test_targeted", "node --test test/p8000-closeout-review-clean-checkpoint.test.mjs", "targeted P8001-P8080 regression"],
  ["command.platform_work_os_check", "npm run platform:work-os-ui-production-freeze -- --check", "P7801-P8000 source freeze gate"],
  ["command.review_authority_check", "npm run platform:review-authority-contract -- --check", "review authority boundary gate"],
  ["command.review_process_check", "npm run platform:review-process-upgrade -- --check", "Codex-Harness-Claude process gate"],
  ["command.git_diff_check", "git diff --check", "whitespace and patch sanity gate"],
];

const NEGATIVE_FIXTURE_SPECS = [
  ["negative.codex_self_approval", "Codex-created implementation tries to approve itself", "BLOCK_CODEX_SELF_APPROVAL"],
  ["negative.claude_final_approval", "Claude review receipt is treated as final protected approval", "BLOCK_CLAUDE_AS_FINAL_APPROVER"],
  ["negative.human_gate_reintroduced", "no-human milestone mode silently reintroduces human adjudication", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.missing_receipt_as_pass", "missing Claude receipt is treated as a clean checkpoint", "BLOCK_MISSING_REVIEW_RECEIPT"],
  ["negative.unresolved_finding_ignored", "unresolved P0/P1 finding is ignored", "BLOCK_UNRESOLVED_FINDING"],
  ["negative.validation_cycle_as_trust", "a validator cycle alone is represented as enterprise trust", "BLOCK_VALIDATION_ONLY_TRUST"],
  ["negative.production_claim", "P8000 UI/workflow freeze is treated as production launch", "BLOCK_PRODUCTION_CLAIM"],
  ["negative.single_owner_as_enterprise", "single-owner lower trust is renamed enterprise-independent trust", "BLOCK_SINGLE_OWNER_AS_ENTERPRISE"],
];

export async function runP8000CloseoutReviewCleanCheckpoint(options = {}) {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(options);
  if (options.write !== false) await writeP8000CloseoutReviewCleanCheckpoint(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`P8000 closeout review clean checkpoint failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildP8000CloseoutReviewCleanCheckpoint(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_P8000_CLOSEOUT_REVIEW_CLEAN_CHECKPOINT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const closeoutDoc = await readTextSource(inputs.closeout_doc_path);
  const sourceWorkOsFreeze = options.sourceWorkOsFreeze
    ? normalizeInlineJsonSource("inline.source_work_os_freeze", options.sourceWorkOsFreeze)
    : await readJsonOrBuildWorkOsFreeze(inputs.work_os_freeze_artifact_path, generatedAt);
  const claudeReviewReceipt = options.claudeReviewReceipt
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);
  const validationSummary = options.validationSummary
    ? normalizeInlineJsonSource("inline.validation_summary", options.validationSummary)
    : await readJsonSource(inputs.validation_summary_path);
  const gitStatus = options.gitStatus
    ? { available: true, path: "inline.git_status", text: options.gitStatus }
    : await readTextSource(inputs.git_status_path);

  const contract = buildCloseoutContract(generatedAt);
  const phaseRows = buildPhaseRows(closeoutDoc.text);
  const closeoutPacketRows = buildCloseoutPacketRows({ generatedAt, sourceWorkOsFreeze });
  const validationCommandRows = buildValidationCommandRows({ generatedAt, validationSummary });
  const claudeReviewRows = buildClaudeReviewRows({ generatedAt, claudeReviewReceipt });
  const findingLoopRows = buildFindingLoopRows({ generatedAt, claudeReviewReceipt });
  const cleanCheckpointRows = buildCleanCheckpointRows({
    generatedAt,
    closeoutPacketRows,
    validationCommandRows,
    claudeReviewRows,
    findingLoopRows,
    gitStatus,
  });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    closeoutDoc,
    sourceWorkOsFreeze,
    contract,
    phaseRows,
    closeoutPacketRows,
    validationCommandRows,
    claudeReviewRows,
    findingLoopRows,
    cleanCheckpointRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({
    sourceWorkOsFreeze,
    contract,
    phaseRows,
    closeoutPacketRows,
    validationCommandRows,
    claudeReviewRows,
    findingLoopRows,
    cleanCheckpointRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    closeoutDoc,
    sourceWorkOsFreeze,
    contract,
    phaseRows,
    closeoutPacketRows,
    validationCommandRows,
    claudeReviewRows,
    findingLoopRows,
    cleanCheckpointRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    p8000_closeout_review_clean_checkpoint_id: `p8000-closeout-review-clean-checkpoint.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_ui_production_freeze_summary: sourceWorkOsFreeze.data?.summary ?? null,
    p8000_closeout_review_clean_checkpoint_contract: contract,
    p8000_closeout_phase_rows: phaseRows,
    p8000_closeout_packet_rows: closeoutPacketRows,
    p8000_validation_command_rows: validationCommandRows,
    p8000_claude_review_receipt_rows: claudeReviewRows,
    p8000_finding_loop_rows: findingLoopRows,
    p8000_clean_checkpoint_rows: cleanCheckpointRows,
    p8000_closeout_negative_fixture_rows: negativeFixtureRows,
    p8000_closeout_gate_rows: gateRows,
    p8000_closeout_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      sourceWorkOsFreeze,
      phaseRows,
      closeoutPacketRows,
      validationCommandRows,
      claudeReviewRows,
      findingLoopRows,
      cleanCheckpointRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "p8000_closeout_review_clean_checkpoint")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    sourceWorkOsFreeze,
    phaseRows,
    closeoutPacketRows,
    validationCommandRows,
    claudeReviewRows,
    findingLoopRows,
    cleanCheckpointRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.p8000_closeout_review_clean_checkpoint_id = result.p8000_closeout_review_clean_checkpoint_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeP8000CloseoutReviewCleanCheckpoint(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "p8000-closeout-review-clean-checkpoint.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p8000-closeout-phase-rows.json"), collectionEnvelope("p8000-closeout-phase-rows.v1", "p8000_closeout_phase_rows", result.p8000_closeout_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-closeout-packet-rows.json"), collectionEnvelope("p8000-closeout-packet-rows.v1", "p8000_closeout_packet_rows", result.p8000_closeout_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-validation-command-rows.json"), collectionEnvelope("p8000-validation-command-rows.v1", "p8000_validation_command_rows", result.p8000_validation_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-claude-review-receipt-rows.json"), collectionEnvelope("p8000-claude-review-receipt-rows.v1", "p8000_claude_review_receipt_rows", result.p8000_claude_review_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-finding-loop-rows.json"), collectionEnvelope("p8000-finding-loop-rows.v1", "p8000_finding_loop_rows", result.p8000_finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-clean-checkpoint-rows.json"), collectionEnvelope("p8000-clean-checkpoint-rows.v1", "p8000_clean_checkpoint_rows", result.p8000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-closeout-negative-fixture-rows.json"), collectionEnvelope("p8000-closeout-negative-fixture-rows.v1", "p8000_closeout_negative_fixture_rows", result.p8000_closeout_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-closeout-gate-rows.json"), collectionEnvelope("p8000-closeout-gate-rows.v1", "p8000_closeout_gate_rows", result.p8000_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8000-closeout-boundary.json"), result.p8000_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "p8000-closeout-review-clean-checkpoint-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runP8000CloseoutReviewCleanCheckpointCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runP8000CloseoutReviewCleanCheckpoint(args);
    console.log(`P8000 closeout review clean checkpoint ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.p8000_closeout_review_clean_checkpoint_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source Work OS freeze ready: ${result.summary.source_work_os_ui_production_freeze_ready}`);
    console.log(`Claude receipt observed now: ${result.summary.claude_review_receipt_observed_now}`);
    console.log(`Finding loop clear now: ${result.summary.finding_loop_clear_now}`);
    console.log(`Clean checkpoint ready: ${result.summary.clean_checkpoint_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutContract(generatedAt) {
  return {
    schema_version: "p8000-closeout-review-clean-checkpoint-contract.v1",
    generated_at: generatedAt,
    contract_id: "p8000-closeout-review-clean-checkpoint-contract.p8001-p8080",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    durable_raw_json_required: true,
    normalized_findings_required: true,
    finding_loop_and_revalidation_required: true,
    clean_checkpoint_required: true,
    human_adjudication_included: false,
    human_final_gate_allowed: false,
    claude_final_approval_allowed: false,
    codex_self_approval_allowed: false,
    reviewer_mutation_allowed: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    work_os_production_claim_enabled: false,
    validation_cycle_alone_trust_allowed: false,
    single_owner_trust_classification_required: true,
    git_commit_performed_by_this_command: false,
  };
}

function buildPhaseRows(closeoutDocText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(closeoutDocText, phase_range) && includesToken(closeoutDocText, phase_name);
    return verdictRow({
      schema_version: "p8000-closeout-phase-row.v1",
      row_id: `p8000.closeout.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.p8000_closeout.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.p8000_closeout.${phase_range}`,
      responsible_owner: "platform_closeout_owner",
      next_allowed_action: pass ? "preserve P8001-P8080 closeout contract" : `add ${phase_range} closeout detail`,
    }, pass);
  });
}

function buildCloseoutPacketRows({ generatedAt, sourceWorkOsFreeze }) {
  const sourceReady = sourceWorkOsFreeze.data?.summary?.work_os_ui_production_freeze_status === "ready_for_work_os_ui_production_freeze_v0";
  return CLOSEOUT_PACKET_SPECS.map(([packet_id, description], index) => {
    const pass = packet_id === "packet.source_p8000_freeze" ? sourceReady : true;
    return verdictRow({
      schema_version: "p8000-closeout-packet-row.v1",
      row_id: `p8000.closeout.packet.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      packet_id,
      description,
      packet_status: pass ? "ready" : "blocked",
      source_artifact_ref: packet_id === "packet.source_p8000_freeze" ? sourceWorkOsFreeze.path : null,
      evidence_ref: `evidence.p8000_closeout_packet.${packet_id}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.p8000_closeout_packet.${packet_id}`,
      next_allowed_action: pass ? "include in P8000 closeout packet" : "repair source P8000 Work OS freeze artifact",
    }, pass);
  });
}

function buildValidationCommandRows({ generatedAt, validationSummary }) {
  const commandResults = Array.isArray(validationSummary.data?.command_results) ? validationSummary.data.command_results : [];
  return REQUIRED_COMMAND_SPECS.map(([command_id, command, description], index) => {
    const observed = commandResults.find((result) => result.command_id === command_id || result.command === command);
    const pass = Boolean(observed && (observed.status === "pass" || observed.exit_code === 0));
    return verdictRow({
      schema_version: "p8000-validation-command-row.v1",
      row_id: `p8000.validation.command.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      command_id,
      command,
      description,
      command_observed_now: Boolean(observed),
      exit_code: observed?.exit_code ?? null,
      status: pass ? "pass" : "missing_or_failed",
      output_summary: observed?.summary ?? null,
      evidence_ref: observed?.evidence_ref ?? `evidence.p8000_validation_command.${command_id}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.p8000_validation_command.${command_id}`,
      next_allowed_action: pass ? "preserve command evidence" : `run and capture ${command}`,
    }, pass);
  });
}

function buildClaudeReviewRows({ generatedAt, claudeReviewReceipt }) {
  const receipt = claudeReviewReceipt.data ?? {};
  const findings = Array.isArray(receipt.findings) ? receipt.findings : [];
  const reviewerOk = receipt.reviewer === "claude_code_opus_max";
  const modelOk = typeof receipt.model === "string" && receipt.model.toLowerCase().includes("opus");
  const observed = claudeReviewReceipt.available && receipt.receipt_status === "observed";
  const durableRaw = Boolean(receipt.raw_output_ref && receipt.output_hash);
  const normalized = Array.isArray(receipt.findings);
  const noMutation = receipt.source_mutation_performed === false;
  const noFinalApproval = receipt.reviewer_final_approval_allowed === false;
  const verdictOk = ["PASS", "PASS_WITH_FINDINGS"].includes(receipt.overall_verdict) && receipt.blocks_clean_checkpoint === false;
  const specs = [
    ["receipt.present", observed, "Claude review receipt is present and observed"],
    ["receipt.reviewer", reviewerOk, "reviewer is Claude Code Opus max"],
    ["receipt.model", modelOk, "model is an Opus review lane or explicitly latest Opus-compatible lane"],
    ["receipt.raw_json", durableRaw, "durable raw JSON output is bound by hash"],
    ["receipt.normalized_findings", normalized, "findings are normalized into receipt rows"],
    ["receipt.no_mutation", noMutation, "reviewer did not mutate source"],
    ["receipt.no_final_approval", noFinalApproval, "reviewer is not final approver"],
    ["receipt.verdict", verdictOk, "review verdict does not block clean checkpoint"],
  ];
  return specs.map(([receipt_id, pass, description], index) => verdictRow({
    schema_version: "p8000-claude-review-receipt-row.v1",
    row_id: `p8000.claude.review.receipt.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    receipt_id,
    description,
    receipt_status: pass ? "ready" : "blocked",
    receipt_path: claudeReviewReceipt.path,
    reviewer_ref: "reviewer.claude_code_opus_max",
    model: receipt.model ?? null,
    overall_verdict: receipt.overall_verdict ?? null,
    finding_count: findings.length,
    evidence_ref: receipt.evidence_ref ?? `evidence.p8000_claude_review.${receipt_id}`,
    hard_gate_ref: `gate.p8000_claude_review.${receipt_id}`,
    next_allowed_action: pass ? "preserve Claude receipt evidence" : `repair ${receipt_id}`,
  }, pass));
}

function buildFindingLoopRows({ generatedAt, claudeReviewReceipt }) {
  const receipt = claudeReviewReceipt.data ?? {};
  const findings = Array.isArray(receipt.findings) ? receipt.findings : [];
  const normalizedFindings = findings.length === 0
    ? [{ finding_id: "finding.none", severity: "INFO", status: "resolved", summary: "Claude review returned no blocking findings." }]
    : findings;
  return normalizedFindings.map((finding, index) => {
    const severity = String(finding.severity ?? "INFO").toUpperCase();
    const status = String(finding.status ?? "open").toLowerCase();
    const unresolvedBlocker = ["P0", "P1"].includes(severity) && !["resolved", "closed", "accepted_non_blocking"].includes(status);
    const pass = !unresolvedBlocker;
    return verdictRow({
      schema_version: "p8000-finding-loop-row.v1",
      row_id: `p8000.finding.loop.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      finding_id: finding.finding_id ?? `finding.${String(index + 1).padStart(3, "0")}`,
      severity,
      finding_status: status,
      summary: finding.summary ?? "No summary supplied.",
      affected_refs: Array.isArray(finding.affected_refs) ? finding.affected_refs : [],
      repair_action: finding.repair_action ?? (pass ? "none" : "repair before clean checkpoint"),
      revalidation_required: !pass,
      revalidation_evidence_ref: finding.revalidation_evidence_ref ?? null,
      evidence_ref: finding.evidence_ref ?? `evidence.p8000_finding_loop.${finding.finding_id ?? index + 1}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.p8000_finding_loop.${finding.finding_id ?? index + 1}`,
      next_allowed_action: pass ? "preserve finding disposition" : "fix finding and rerun validation",
    }, pass);
  });
}

function buildCleanCheckpointRows({ generatedAt, closeoutPacketRows, validationCommandRows, claudeReviewRows, findingLoopRows, gitStatus }) {
  const closeoutReady = closeoutPacketRows.every((row) => row.current_verdict === "pass");
  const validationReady = validationCommandRows.every((row) => row.current_verdict === "pass");
  const claudeReady = claudeReviewRows.every((row) => row.current_verdict === "pass");
  const findingReady = findingLoopRows.every((row) => row.current_verdict === "pass");
  const gitStatusCaptured = gitStatus.available && typeof gitStatus.text === "string" && typeof gitStatus.path === "string";
  const specs = [
    ["clean.closeout_packet", closeoutReady, "closeout packet rows pass"],
    ["clean.validation_summary", validationReady, "required validators and tests are captured as passing evidence"],
    ["clean.claude_receipt", claudeReady, "Claude receipt is observed, durable, no-write, and non-final"],
    ["clean.finding_loop", findingReady, "no unresolved P0/P1 findings remain"],
    ["clean.git_status_captured", gitStatusCaptured, "git status evidence is captured for checkpoint context"],
    ["clean.no_human_gate", true, "human adjudication is excluded from this no-human milestone gate"],
    ["clean.no_self_approval", true, "Codex self-approval remains disallowed"],
    ["clean.no_enterprise_claim", true, "enterprise trust and Work OS production claims remain blocked"],
    ["clean.no_commit_side_effect", true, "checkpoint command does not stage, commit, push, or merge"],
  ];
  return specs.map(([checkpoint_id, pass, description], index) => verdictRow({
    schema_version: "p8000-clean-checkpoint-row.v1",
    row_id: `p8000.clean.checkpoint.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    checkpoint_id,
    description,
    checkpoint_status: pass ? "ready" : "blocked",
    evidence_ref: `evidence.p8000_clean_checkpoint.${checkpoint_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.p8000_clean_checkpoint.${checkpoint_id}`,
    next_allowed_action: pass ? "preserve clean checkpoint evidence" : `repair ${checkpoint_id}`,
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURE_SPECS.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "p8000-closeout-negative-fixture-row.v1",
    row_id: `p8000.closeout.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    evidence_ref: `evidence.p8000_closeout_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.p8000_closeout_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve P8000 closeout negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows(args) {
  const { packageJson, roadmapDoc, architectureDoc, closeoutDoc, sourceWorkOsFreeze, contract, phaseRows, closeoutPacketRows, validationCommandRows, claudeReviewRows, findingLoopRows, cleanCheckpointRows, negativeFixtureRows } = args;
  const sourceReady = sourceWorkOsFreeze.data?.summary?.work_os_ui_production_freeze_status === "ready_for_work_os_ui_production_freeze_v0";
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P8000 closeout command"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes P8000 closeout command"],
    ["source_work_os_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source Work OS freeze command exists"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, "P8001-P8080"), "roadmap reflects P8001-P8080 addendum"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "P8000 Closeout Review Clean Checkpoint"), "architecture reflects P8000 closeout checkpoint"],
    ["closeout_doc_reflected", closeoutDoc.available && includesToken(closeoutDoc.text, "P8000 Closeout Review Clean Checkpoint"), "closeout documentation exists"],
    ["source_work_os_freeze_ready", sourceReady, "P7801-P8000 source Work OS freeze is ready"],
    ["contract_ready", contract.claude_code_opus_max_review_receipt_required && contract.human_adjudication_included === false && contract.codex_self_approval_allowed === false, "closeout contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P8001-P8080 phase rows pass"],
    ["closeout_packet_ready", closeoutPacketRows.every((row) => row.current_verdict === "pass"), "closeout packet rows pass"],
    ["validation_commands_pass", validationCommandRows.every((row) => row.current_verdict === "pass"), "required validation commands pass"],
    ["claude_review_receipt_pass", claudeReviewRows.every((row) => row.current_verdict === "pass"), "Claude review receipt rows pass"],
    ["finding_loop_clear", findingLoopRows.every((row) => row.current_verdict === "pass"), "finding loop has no unresolved P0/P1 blockers"],
    ["clean_checkpoint_ready", cleanCheckpointRows.every((row) => row.current_verdict === "pass"), "clean checkpoint rows pass"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe claims"],
    ["boundary_no_human", contract.human_adjudication_included === false && contract.human_final_gate_allowed === false, "human gate remains excluded for this milestone"],
    ["boundary_no_self_approval", contract.codex_self_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex and Claude cannot self/final approve"],
    ["boundary_no_enterprise", contract.enterprise_trust_claim_enabled === false && contract.validation_cycle_alone_trust_allowed === false, "enterprise trust claim remains blocked"],
    ["boundary_no_production", contract.work_os_production_claim_enabled === false && contract.protected_closeout_enabled === false, "production/protected closeout claims remain blocked"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "p8000-closeout-gate-row.v1",
    row_id: `p8000.closeout.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.p8000_closeout_gate.${gate_id}`,
    reviewer_ref: gate_id.includes("claude") || gate_id.includes("receipt") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.p8000_closeout.${gate_id}`,
    responsible_owner: "platform_closeout_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceWorkOsFreeze, contract, phaseRows, closeoutPacketRows, validationCommandRows, claudeReviewRows, findingLoopRows, cleanCheckpointRows, gateRows }) {
  const sourceReady = sourceWorkOsFreeze.data?.summary?.work_os_ui_production_freeze_status === "ready_for_work_os_ui_production_freeze_v0";
  const phaseReady = phaseRows.every((row) => row.current_verdict === "pass");
  const closeoutReady = closeoutPacketRows.every((row) => row.current_verdict === "pass");
  const validationReady = validationCommandRows.every((row) => row.current_verdict === "pass");
  const claudeReady = claudeReviewRows.every((row) => row.current_verdict === "pass");
  const findingReady = findingLoopRows.every((row) => row.current_verdict === "pass");
  const checkpointReady = cleanCheckpointRows.every((row) => row.current_verdict === "pass");
  const gateReady = gateRows.every((row) => row.gate_status === "ready");
  const unsafeFlags = [
    !sourceReady,
    !phaseReady,
    !closeoutReady,
    !validationReady,
    !claudeReady,
    !findingReady,
    !checkpointReady,
    !gateReady,
    contract.human_adjudication_included,
    contract.human_final_gate_allowed,
    contract.claude_final_approval_allowed,
    contract.codex_self_approval_allowed,
    contract.reviewer_mutation_allowed,
    contract.protected_closeout_enabled,
    contract.enterprise_trust_claim_enabled,
    contract.work_os_production_claim_enabled,
    contract.validation_cycle_alone_trust_allowed,
    contract.git_commit_performed_by_this_command,
  ];
  return {
    schema_version: "p8000-closeout-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_ui_production_freeze_ready: sourceReady,
    p8000_closeout_phase_rows_ready: phaseReady,
    p8000_closeout_packet_ready: closeoutReady,
    validation_summary_passed_now: validationReady,
    claude_review_receipt_observed_now: claudeReady,
    finding_loop_clear_now: findingReady,
    clean_checkpoint_ready: unsafeFlags.filter(Boolean).length === 0,
    p8000_closeout_gate_rows_ready: gateReady,
    human_adjudication_included: false,
    human_final_gate_allowed: false,
    claude_final_approval_allowed: false,
    codex_self_approval_allowed: false,
    reviewer_mutation_allowed: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    work_os_production_claim_enabled: false,
    validation_cycle_alone_trust_allowed: false,
    single_owner_trust_classification: "single_owner_lower_trust_claude_reviewed",
    git_commit_performed_by_this_command: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, closeoutDoc, sourceWorkOsFreeze, contract, phaseRows, closeoutPacketRows, validationCommandRows, claudeReviewRows, findingLoopRows, cleanCheckpointRows, negativeFixtureRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include P8000 closeout command"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8001-P8080"), "P8001-P8080 roadmap addendum must be reflected"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P8000 Closeout Review Clean Checkpoint"), "architecture must reflect P8000 closeout checkpoint"),
    validationItem("closeout_doc.reflected", "docs", closeoutDoc.available && includesToken(closeoutDoc.text, "P8000 Closeout Review Clean Checkpoint"), "closeout document must exist"),
    validationItem("source.ready", "source", sourceWorkOsFreeze.data?.summary?.work_os_ui_production_freeze_status === "ready_for_work_os_ui_production_freeze_v0", "source Work OS freeze must be ready"),
    validationItem("contract.no_human", "contract", contract.human_adjudication_included === false && contract.human_final_gate_allowed === false, "human gate must stay excluded"),
    validationItem("contract.no_self_approval", "contract", contract.codex_self_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex/Claude final approval must stay disallowed"),
    validationItem("contract.no_enterprise", "contract", contract.enterprise_trust_claim_enabled === false && contract.validation_cycle_alone_trust_allowed === false, "enterprise trust must stay blocked"),
    validationItem("phases.pass", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all P8001-P8080 phases must pass"),
    validationItem("packet.ready", "packet", closeoutPacketRows.every((row) => row.current_verdict === "pass"), "closeout packet rows must pass"),
    validationItem("commands.pass", "validation", validationCommandRows.length === REQUIRED_COMMAND_SPECS.length && validationCommandRows.every((row) => row.current_verdict === "pass"), "required validation commands must pass"),
    validationItem("claude.receipt", "review", claudeReviewRows.every((row) => row.current_verdict === "pass"), "Claude review receipt rows must pass"),
    validationItem("findings.clear", "review", findingLoopRows.every((row) => row.current_verdict === "pass"), "finding loop must have no unresolved P0/P1 blockers"),
    validationItem("checkpoint.ready", "checkpoint", cleanCheckpointRows.every((row) => row.current_verdict === "pass"), "clean checkpoint rows must pass"),
    validationItem("negative_fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all P8000 closeout gates must pass"),
    validationItem("boundary.clean", "boundary", boundary.clean_checkpoint_ready && boundary.unsafe_flag_count === 0, "boundary must be clean"),
  ];
}

function buildSummary({ sourceWorkOsFreeze, phaseRows, closeoutPacketRows, validationCommandRows, claudeReviewRows, findingLoopRows, cleanCheckpointRows, gateRows, boundary, validation }) {
  return {
    schema_version: "p8000-closeout-review-clean-checkpoint-summary.v1",
    p8000_closeout_review_clean_checkpoint_status: validation.valid && boundary.clean_checkpoint_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_ui_production_freeze_status: sourceWorkOsFreeze.data?.summary?.work_os_ui_production_freeze_status ?? "unknown",
    source_work_os_ui_production_freeze_ready: boundary.source_work_os_ui_production_freeze_ready,
    phase_row_count: phaseRows.length,
    closeout_packet_count: closeoutPacketRows.length,
    validation_command_count: validationCommandRows.length,
    claude_review_receipt_row_count: claudeReviewRows.length,
    finding_loop_count: findingLoopRows.length,
    clean_checkpoint_count: cleanCheckpointRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    p8000_closeout_packet_ready: boundary.p8000_closeout_packet_ready,
    validation_summary_passed_now: boundary.validation_summary_passed_now,
    claude_review_receipt_observed_now: boundary.claude_review_receipt_observed_now,
    finding_loop_clear_now: boundary.finding_loop_clear_now,
    clean_checkpoint_ready: boundary.clean_checkpoint_ready,
    human_adjudication_included: boundary.human_adjudication_included,
    human_final_gate_allowed: boundary.human_final_gate_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    codex_self_approval_allowed: boundary.codex_self_approval_allowed,
    reviewer_mutation_allowed: boundary.reviewer_mutation_allowed,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    work_os_production_claim_enabled: boundary.work_os_production_claim_enabled,
    validation_cycle_alone_trust_allowed: boundary.validation_cycle_alone_trust_allowed,
    single_owner_trust_classification: boundary.single_owner_trust_classification,
    git_commit_performed_by_this_command: boundary.git_commit_performed_by_this_command,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `p8000_closeout_block.${fields.phase_range ?? fields.packet_id ?? fields.command_id ?? fields.receipt_id ?? fields.finding_id ?? fields.checkpoint_id ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# P8000 Closeout Review Clean Checkpoint",
    "",
    `Status: ${result.summary.p8000_closeout_review_clean_checkpoint_status}`,
    `Program: ${result.summary.program_range}`,
    `Source Work OS freeze ready: ${result.summary.source_work_os_ui_production_freeze_ready}`,
    `Claude review receipt observed now: ${result.summary.claude_review_receipt_observed_now}`,
    `Finding loop clear now: ${result.summary.finding_loop_clear_now}`,
    `Validation summary passed now: ${result.summary.validation_summary_passed_now}`,
    `Clean checkpoint ready: ${result.summary.clean_checkpoint_ready}`,
    `Human adjudication included: ${result.summary.human_adjudication_included}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Work OS production claim enabled: ${result.summary.work_os_production_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P8001-P8080 closes P8000 as a local, single-owner, Claude-reviewed lower-trust checkpoint. It requires durable Claude review evidence, a finding loop, and validation receipts, but it does not create human adjudication, enterprise-independent trust, protected closeout, production launch, commit, push, or merge authority.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return { item_id, category, status: passed ? "pass" : "error", message };
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
  const defaults = DEFAULT_P8000_CLOSEOUT_REVIEW_CLEAN_CHECKPOINT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    closeout_doc_path: options.closeoutDocPath ?? defaults.closeoutDocPath,
    work_os_freeze_artifact_path: options.workOsFreezeArtifactPath ?? defaults.workOsFreezeArtifactPath,
    claude_review_receipt_path: options.claudeReviewReceiptPath ?? defaults.claudeReviewReceiptPath,
    validation_summary_path: options.validationSummaryPath ?? defaults.validationSummaryPath,
    git_status_path: options.gitStatusPath ?? defaults.gitStatusPath,
  };
}

async function readJsonOrBuildWorkOsFreeze(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildWorkOsUiProductionFreeze({ runAt: generatedAt, write: false });
    return { available: true, path: "generated.work_os_ui_production_freeze", data: built };
  } catch (error) {
    return { available: false, path: sourcePath, error: `${source.error}; generated fallback failed: ${error.message}` };
  }
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text), hash: sha256(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text, hash: sha256(text) };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  const text = JSON.stringify(data);
  return { available: true, path: pathLabel, data, hash: sha256(text) };
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, count: items.length, items };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
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
    closeoutDocPath: undefined,
    workOsFreezeArtifactPath: undefined,
    claudeReviewReceiptPath: undefined,
    validationSummaryPath: undefined,
    gitStatusPath: undefined,
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
    } else if (arg === "--closeout-doc") {
      args.closeoutDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--work-os-freeze-artifact") {
      args.workOsFreezeArtifactPath = argv[index + 1];
      index += 1;
    } else if (arg === "--claude-review-receipt") {
      args.claudeReviewReceiptPath = argv[index + 1];
      index += 1;
    } else if (arg === "--validation-summary") {
      args.validationSummaryPath = argv[index + 1];
      index += 1;
    } else if (arg === "--git-status") {
      args.gitStatusPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/p8000-closeout-review-clean-checkpoint.mjs [options]

Options:
  --check                              Validate without writing artifacts.
  --out-dir <path>                     Artifact output directory.
  --schema <path>                      Schema path.
  --package <path>                     package.json path.
  --roadmap-doc <path>                 P4001-P8000 roadmap document path.
  --architecture-doc <path>            Architecture document path.
  --closeout-doc <path>                P8000 closeout document path.
  --work-os-freeze-artifact <path>     Source P8000 Work OS freeze artifact path.
  --claude-review-receipt <path>       Claude review receipt path.
  --validation-summary <path>          Validation summary path.
  --git-status <path>                  Captured git status path.
  --help                               Show this help.
`);
}
