import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformReviewAuthorityContract } from "./platform-review-authority-contract.mjs";

export const DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_OUT_DIR = "artifacts/platform-review-process-upgrade/latest";
export const DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS = {
  schemaPath: "schemas/platform-review-process-upgrade.schema.json",
  packagePath: "package.json",
  reviewAuthorityContractPath: "artifacts/platform-review-authority-contract/latest/platform-review-authority-contract.json",
  externalVerificationLedgerPath: "docs/hermes-external-verification-enforcement.md",
  agentsInstructionsPath: "AGENTS.md",
  claudeInstructionsPath: "CLAUDE.md",
  reviewInstructionsPath: "REVIEW.md",
  promptTemplatesPath: "docs/review-process-prompt-templates.md",
  pullRequestTemplatePath: ".github/pull_request_template.md",
};

const COMMAND_NAME = "platform:review-process-upgrade";
const SOURCE_COMMAND_NAME = "platform:review-authority-contract";
const SCHEMA_VERSION = "platform-review-process-upgrade.v1";
const CAPABILITY_ID = "platform.review_process.upgrade";
const PROGRAM_RANGE = "P3841-P4000";
const PHASE_RANGE = "P3861-P4000";
const PHASE_SLOT = "P3861";
const PREVIOUS_PHASE_SLOT = "P3860";
const NEXT_PHASE_SLOT = "P4001";
const READY_STATUS = "ready_for_review_process_upgrade";

const WORK_INTAKE_FIELDS = [
  ["purpose", "Why this work exists"],
  ["success_criteria", "Observable completion criteria"],
  ["non_goals", "Explicit exclusions"],
  ["forbidden_areas", "Files, data, or actions outside scope"],
  ["risk_tier", "low, medium, high, security_auth, legal, or release"],
  ["test_bar", "Minimum required checks"],
  ["rollback_needs", "Rollback notes and restore target"],
  ["stop_conditions", "When Codex must stop and ask"],
];

const CODEX_PLAN_FIELDS = [
  ["related_files", "Files and modules to inspect"],
  ["change_candidates", "Likely changes before editing"],
  ["non_change_targets", "Files and behavior that should remain untouched"],
  ["test_plan", "Targeted tests and broader validation"],
  ["risk_points", "Primary failure or overclaim risks"],
  ["split_recommendation", "Whether the work should be split"],
];

const CLAUDE_PLAN_REVIEW_FIELDS = [
  ["resolved_model_id", "Resolved Claude model id is captured"],
  ["prompt_hash", "Plan review prompt hash is captured"],
  ["output_hash", "Plan review output hash is captured"],
  ["plan_verdict", "Plan verdict is proceed, revise, or block"],
  ["blocking_reasons", "Blocking or revision reasons are normalized"],
];

const IMPLEMENTATION_PACKET_FIELDS = [
  ["changed_files", "Files changed by Codex"],
  ["change_reasons", "Reason for each material change"],
  ["tests_run", "Commands run and pass/fail results"],
  ["known_failures", "Failures and why they remain"],
  ["residual_risks", "Risks that remain after implementation"],
  ["pr_description", "Human-readable PR summary and evidence"],
  ["rollback_notes", "Rollback or revert instructions"],
];

const SELF_REVIEW_CONTROLS = [
  ["self_review_allowed", "Codex may remove obvious local noise before external review"],
  ["self_review_not_independent", "Codex self-review cannot satisfy independent review"],
  ["self_review_not_approval", "Codex self-review cannot approve its own implementation"],
  ["self_review_finding_carry_forward", "Codex must carry unresolved findings into Claude/human review"],
];

const MULTI_PASS_REVIEW_MODES = [
  ["full_context", "Full context correctness and architectural fit"],
  ["security", "Secrets, auth, permissions, and unsafe action paths"],
  ["test", "Test adequacy and validation gaps"],
  ["migration", "Schema, data, and compatibility changes"],
  ["fix_verification", "Whether claimed fixes actually address findings"],
  ["regression", "Behavioral regressions and protected invariants"],
];

const FINDING_FIX_RESOLUTIONS = [
  ["fixed", "Finding is fully fixed and evidence is captured"],
  ["partially_fixed", "Finding is partially fixed and residual risk remains"],
  ["not_fixed", "Finding remains unresolved"],
  ["false_positive", "Finding is rejected with evidence"],
  ["human_override", "Human owner explicitly adjudicates the finding"],
];

const PR_TYPE_POLICIES = [
  ["feature", "Feature PRs require intake, plan, implementation packet, tests, Claude review, and human adjudication"],
  ["bugfix", "Bugfix PRs require reproduction, fix evidence, regression test, Claude review, and human adjudication"],
  ["refactor", "Refactor PRs require behavior-preservation evidence and regression review"],
  ["security_auth", "Security/auth PRs require multi-pass security review and no unresolved high findings"],
  ["dependency", "Dependency PRs require supply-chain, lockfile, CI, and rollback evidence"],
  ["large_ai_generated", "Large AI-generated PRs require split recommendation, stronger review pass count, and human adjudication"],
];

const INSTRUCTION_FREEZE_SOURCES = [
  ["agents_md", "AGENTS.md", "Codex operating instructions"],
  ["claude_md", "CLAUDE.md", "Claude independent reviewer instructions"],
  ["review_md", "REVIEW.md", "Shared review process contract"],
  ["prompt_templates", "docs/review-process-prompt-templates.md", "Plan/review/adjudication prompt templates"],
  ["pull_request_template", ".github/pull_request_template.md", "PR description evidence contract"],
];

export async function runPlatformReviewProcessUpgrade(options = {}) {
  const result = await buildPlatformReviewProcessUpgrade(options);
  if (options.write !== false) await writePlatformReviewProcessUpgrade(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform review process upgrade failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReviewProcessUpgrade(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const authorityContract = await loadAuthorityContract(options, inputs, generatedAt);
  const externalLedger = await readTextSource(inputs.external_verification_ledger_path);
  const instructionSources = await readInstructionSources(inputs);
  const workIntakeRows = buildWorkIntakeRows();
  const codexPlanRows = buildCodexPlanRows();
  const claudePlanReviewRows = buildClaudePlanReviewRows();
  const implementationPacketRows = buildImplementationPacketRows();
  const codexSelfReviewRows = buildCodexSelfReviewRows();
  const claudeMultiPassRows = buildClaudeMultiPassRows();
  const findingFixLoopRows = buildFindingFixLoopRows();
  const prTypePolicyRows = buildPrTypePolicyRows();
  const instructionFreezeRows = buildInstructionFreezeRows({ instructionSources });
  const evidenceRows = buildEvidenceRows({ generatedAt, packageJson, authorityContract, externalLedger, instructionSources });
  const gateRows = buildGateRows({ authorityContract, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows });
  const boundary = buildBoundary({ authorityContract, gateRows, instructionFreezeRows });
  const anchor = buildAnchor({ packageJson, authorityContract, externalLedger, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows });
  const manifest = buildManifest({ generatedAt, boundary, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows });
  const validationItems = buildValidationItems({ packageJson, authorityContract, externalLedger, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_review_process_upgrade_id: `platform-review-process-upgrade.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_review_authority_contract_summary: authorityContract.data?.summary ?? null,
    review_process_anchor: anchor,
    review_process_manifest: manifest,
    work_intake_field_rows: workIntakeRows,
    codex_plan_only_lane_rows: codexPlanRows,
    claude_plan_review_lane_rows: claudePlanReviewRows,
    codex_implementation_packet_rows: implementationPacketRows,
    codex_self_review_rows: codexSelfReviewRows,
    claude_multi_pass_review_rows: claudeMultiPassRows,
    finding_fix_loop_rows: findingFixLoopRows,
    pr_type_policy_rows: prTypePolicyRows,
    instruction_freeze_rows: instructionFreezeRows,
    evidence_provenance_rows: evidenceRows,
    review_process_gate_rows: gateRows,
    review_process_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_review_process_upgrade")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ boundary, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows, gateRows, validation: result.validation });
  result.summary.platform_review_process_upgrade_id = result.platform_review_process_upgrade_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReviewProcessUpgrade(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-review-process-upgrade.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-process-manifest.json"), result.review_process_manifest);
  await writeJson(path.join(outDir, "work-intake-field-rows.json"), collectionEnvelope("work-intake-field-rows.v1", "work_intake_field_rows", result.work_intake_field_rows, result.generated_at));
  await writeJson(path.join(outDir, "codex-plan-only-lane-rows.json"), collectionEnvelope("codex-plan-only-lane-rows.v1", "codex_plan_only_lane_rows", result.codex_plan_only_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-plan-review-lane-rows.json"), collectionEnvelope("claude-plan-review-lane-rows.v1", "claude_plan_review_lane_rows", result.claude_plan_review_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "codex-implementation-packet-rows.json"), collectionEnvelope("codex-implementation-packet-rows.v1", "codex_implementation_packet_rows", result.codex_implementation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "codex-self-review-rows.json"), collectionEnvelope("codex-self-review-rows.v1", "codex_self_review_rows", result.codex_self_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-multi-pass-review-rows.json"), collectionEnvelope("claude-multi-pass-review-rows.v1", "claude_multi_pass_review_rows", result.claude_multi_pass_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-fix-loop-rows.json"), collectionEnvelope("finding-fix-loop-rows.v1", "finding_fix_loop_rows", result.finding_fix_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "pr-type-policy-rows.json"), collectionEnvelope("pr-type-policy-rows.v1", "pr_type_policy_rows", result.pr_type_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "instruction-freeze-rows.json"), collectionEnvelope("instruction-freeze-rows.v1", "instruction_freeze_rows", result.instruction_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-provenance-rows.json"), collectionEnvelope("review-process-evidence-provenance-rows.v1", "evidence_provenance_rows", result.evidence_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-process-gate-rows.json"), collectionEnvelope("review-process-gate-rows.v1", "review_process_gate_rows", result.review_process_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-process-boundary.json"), result.review_process_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-review-process-upgrade-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReviewProcessUpgradeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReviewProcessUpgrade(args);
    console.log(`Platform review process upgrade ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.review_process_upgrade_status}`);
    console.log(`Authority contract ready: ${result.summary.source_authority_contract_ready_now}`);
    console.log(`Work intake fields: ${result.summary.work_intake_field_count}`);
    console.log(`Instruction freeze ready: ${result.summary.instruction_freeze_ready_now}`);
    console.log(`P4000 review process upgrade ready: ${result.summary.p4000_review_process_upgrade_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function loadAuthorityContract(options, inputs, generatedAt) {
  const existing = await readOptionalJsonSource(inputs.review_authority_contract_path);
  if (existing.available) return existing;
  const built = await buildPlatformReviewAuthorityContract({
    runAt: generatedAt,
    write: false,
    packagePath: inputs.package_path,
  });
  return { available: true, path: inputs.review_authority_contract_path, data: built };
}

function buildWorkIntakeRows() {
  return WORK_INTAKE_FIELDS.map(([fieldName, description], index) => contractRow({
    schema_version: "work-intake-field-row.v1",
    row_id: `work.intake.field.row.${String(index + 1).padStart(2, "0")}`,
    field_name: fieldName,
    description,
    phase_range: "P3861-P3880",
    required_before_plan: true,
    missing_field_blocks_plan: true,
  }));
}

function buildCodexPlanRows() {
  return CODEX_PLAN_FIELDS.map(([fieldName, description], index) => contractRow({
    schema_version: "codex-plan-only-lane-row.v1",
    row_id: `codex.plan.only.row.${String(index + 1).padStart(2, "0")}`,
    field_name: fieldName,
    description,
    phase_range: "P3881-P3900",
    file_edit_allowed_before_plan_review: false,
    missing_field_blocks_implementation: true,
  }));
}

function buildClaudePlanReviewRows() {
  return CLAUDE_PLAN_REVIEW_FIELDS.map(([fieldName, description], index) => contractRow({
    schema_version: "claude-plan-review-lane-row.v1",
    row_id: `claude.plan.review.row.${String(index + 1).padStart(2, "0")}`,
    field_name: fieldName,
    description,
    phase_range: "P3901-P3920",
    required_before_implementation: true,
    allowed_verdicts: ["proceed", "revise", "block"],
  }));
}

function buildImplementationPacketRows() {
  return IMPLEMENTATION_PACKET_FIELDS.map(([fieldName, description], index) => contractRow({
    schema_version: "codex-implementation-packet-row.v1",
    row_id: `codex.implementation.packet.row.${String(index + 1).padStart(2, "0")}`,
    field_name: fieldName,
    description,
    phase_range: "P3921-P3940",
    required_before_claude_review: true,
    missing_field_blocks_review_closeout: true,
  }));
}

function buildCodexSelfReviewRows() {
  return SELF_REVIEW_CONTROLS.map(([controlId, description], index) => contractRow({
    schema_version: "codex-self-review-row.v1",
    row_id: `codex.self.review.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    description,
    phase_range: "P3941-P3960",
    final_approval_allowed: false,
    independent_review_credit_allowed: controlId === "self_review_allowed" ? false : false,
  }));
}

function buildClaudeMultiPassRows() {
  return MULTI_PASS_REVIEW_MODES.map(([review_mode, description], index) => contractRow({
    schema_version: "claude-multi-pass-review-row.v1",
    row_id: `claude.multi.pass.review.row.${String(index + 1).padStart(2, "0")}`,
    review_mode,
    description,
    phase_range: "P3961-P3970",
    required_for_high_risk_pr: true,
    resolved_model_id_required: true,
  }));
}

function buildFindingFixLoopRows() {
  return FINDING_FIX_RESOLUTIONS.map(([resolution, description], index) => contractRow({
    schema_version: "finding-fix-loop-row.v1",
    row_id: `finding.fix.loop.row.${String(index + 1).padStart(2, "0")}`,
    resolution,
    description,
    phase_range: "P3971-P3980",
    finding_id_required: true,
    human_adjudication_required_for_unresolved_high: ["partially_fixed", "not_fixed", "human_override"].includes(resolution),
  }));
}

function buildPrTypePolicyRows() {
  return PR_TYPE_POLICIES.map(([prType, description], index) => contractRow({
    schema_version: "pr-type-policy-row.v1",
    row_id: `pr.type.policy.row.${String(index + 1).padStart(2, "0")}`,
    pr_type: prType,
    description,
    phase_range: "P3981-P3990",
    evidence_bar_required: true,
    high_risk_evidence_bar: ["security_auth", "dependency", "large_ai_generated"].includes(prType),
  }));
}

function buildInstructionFreezeRows({ instructionSources }) {
  return INSTRUCTION_FREEZE_SOURCES.map(([sourceId, sourceUri, description], index) => {
    const source = instructionSources[sourceId];
    return {
      schema_version: "instruction-freeze-row.v1",
      row_id: `instruction.freeze.row.${String(index + 1).padStart(2, "0")}`,
      source_id: sourceId,
      source_uri: sourceUri,
      description,
      phase_range: "P3991-P4000",
      available_now: source?.available === true,
      required_for_p4000_freeze: true,
      current_verdict: source?.available === true ? "pass" : "blocked",
      evidence_ref: `evidence.platform.review_process.instruction.${sourceId}`,
      reviewer_ref: "reviewer.platform_review_process_upgrade",
      hard_gate_ref: `gate.platform.review_process.instruction.${sourceId}`,
      responsible_owner: "platform_review_owner",
      next_allowed_action: source?.available === true ? "preserve instruction freeze source" : `create ${sourceUri}`,
    };
  });
}

function buildEvidenceRows({ generatedAt, packageJson, authorityContract, externalLedger, instructionSources }) {
  const rows = [
    ["package_script", "package.json", packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-process-upgrade.mjs"],
    ["authority_contract", DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.reviewAuthorityContractPath, authorityContract.available && authorityContract.data?.summary?.p4000_role_authority_contract_ready === true],
    ["external_verification_ledger", "docs/hermes-external-verification-enforcement.md", externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade")],
    ...INSTRUCTION_FREEZE_SOURCES.map(([sourceId, sourceUri]) => [sourceId, sourceUri, instructionSources[sourceId]?.available === true]),
  ];
  return rows.map(([sourceId, sourceUri, available], index) => ({
    schema_version: "review-process-evidence-row.v1",
    row_id: `review.process.evidence.row.${String(index + 1).padStart(2, "0")}`,
    source_id: sourceId,
    source_uri: sourceUri,
    observed_at: generatedAt,
    available_now: Boolean(available),
    required_for_p4000_freeze: true,
    current_verdict: available ? "pass" : "blocked",
    evidence_ref: `evidence.platform.review_process.source.${sourceId}`,
    reviewer_ref: "reviewer.platform_review_process_upgrade",
    hard_gate_ref: `gate.platform.review_process.source.${sourceId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: available ? "preserve source evidence" : `restore ${sourceUri}`,
  }));
}

function buildGateRows(parts) {
  const gates = [
    ["source_authority_contract_ready", parts.authorityContract.data?.summary?.p4000_role_authority_contract_ready === true],
    ["work_intake_contract_ready", parts.workIntakeRows.length === 8],
    ["plan_review_contract_ready", parts.codexPlanRows.length === 6 && parts.claudePlanReviewRows.length === 5],
    ["implementation_review_contract_ready", parts.implementationPacketRows.length === 7 && parts.codexSelfReviewRows.length === 4],
    ["multi_pass_and_fix_loop_ready", parts.claudeMultiPassRows.length === 6 && parts.findingFixLoopRows.length === 5],
    ["pr_type_policy_ready", parts.prTypePolicyRows.length === 6],
    ["instruction_freeze_ready", parts.instructionFreezeRows.every((row) => row.current_verdict === "pass")],
    ["evidence_sources_available", parts.evidenceRows.every((row) => row.available_now === true)],
  ];
  return gates.map(([gateId, ready], index) => ({
    schema_version: "review-process-gate-row.v1",
    row_id: `review.process.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: ready ? "ready" : "blocked",
    required_for_p4000_freeze: true,
    current_verdict: ready ? "pass" : "blocked",
    evidence_ref: `evidence.platform.review_process.gate.${gateId}`,
    reviewer_ref: "reviewer.platform_review_process_upgrade",
    hard_gate_ref: `gate.platform.review_process.gate.${gateId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: ready ? "preserve review process gate" : `resolve ${gateId}`,
  }));
}

function buildBoundary({ authorityContract, gateRows, instructionFreezeRows }) {
  const ready = gateRows.every((row) => row.gate_status === "ready");
  return {
    schema_version: "review-process-boundary.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_authority_contract_ready_now: authorityContract.data?.summary?.p4000_role_authority_contract_ready === true,
    instruction_freeze_ready_now: instructionFreezeRows.every((row) => row.current_verdict === "pass"),
    codex_plan_only_before_edit_required_now: true,
    claude_plan_review_required_before_implementation_now: true,
    codex_self_review_independent_credit_allowed_now: false,
    unresolved_high_findings_block_closeout_now: true,
    single_owner_exception_enterprise_trust_allowed_now: false,
    p4000_review_process_upgrade_ready: ready,
    next_allowed_action: "advance to P4001 only after real work orders use these receipt lanes",
  };
}

function buildAnchor({ packageJson, authorityContract, externalLedger, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows }) {
  return {
    schema_version: "review-process-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-process-upgrade.mjs",
    source_authority_contract_ready: authorityContract.data?.summary?.p4000_role_authority_contract_ready === true,
    external_verification_ledger_registered: externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade"),
    work_intake_field_count: workIntakeRows.length,
    codex_plan_only_lane_count: codexPlanRows.length,
    claude_plan_review_lane_count: claudePlanReviewRows.length,
    implementation_packet_count: implementationPacketRows.length,
    codex_self_review_count: codexSelfReviewRows.length,
    claude_multi_pass_review_count: claudeMultiPassRows.length,
    finding_fix_loop_count: findingFixLoopRows.length,
    pr_type_policy_count: prTypePolicyRows.length,
    instruction_freeze_count: instructionFreezeRows.length,
    evidence_provenance_count: evidenceRows.length,
  };
}

function buildManifest({ generatedAt, boundary, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows }) {
  return {
    schema_version: "review-process-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    review_process_upgrade_status: boundary.p4000_review_process_upgrade_ready ? READY_STATUS : "blocked_pending_review_process_upgrade",
    work_intake_field_count: workIntakeRows.length,
    codex_plan_only_lane_count: codexPlanRows.length,
    claude_plan_review_lane_count: claudePlanReviewRows.length,
    implementation_packet_count: implementationPacketRows.length,
    codex_self_review_count: codexSelfReviewRows.length,
    claude_multi_pass_review_count: claudeMultiPassRows.length,
    finding_fix_loop_count: findingFixLoopRows.length,
    pr_type_policy_count: prTypePolicyRows.length,
    instruction_freeze_count: instructionFreezeRows.length,
    evidence_provenance_count: evidenceRows.length,
    p4000_review_process_upgrade_ready: boundary.p4000_review_process_upgrade_ready,
  };
}

function buildValidationItems({ packageJson, authorityContract, externalLedger, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package_script_registered", packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-process-upgrade.mjs", `${COMMAND_NAME} package script must be registered.`),
    validationItem("source.authority", "authority_contract_ready", authorityContract.data?.summary?.p4000_role_authority_contract_ready === true, "P3841-P3860 authority contract must be ready."),
    validationItem("docs.external_verification", "p4000_ledger_registered", externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade"), "External verification ledger must describe P3841-P4000."),
    validationItem("work_intake", "field_count", workIntakeRows.length === 8, "Work intake must define eight fields."),
    validationItem("codex_plan", "plan_only_count", codexPlanRows.length === 6 && codexPlanRows.every((row) => row.file_edit_allowed_before_plan_review === false), "Codex plan-only lane must block file edits before plan review."),
    validationItem("claude_plan_review", "review_field_count", claudePlanReviewRows.length === 5, "Claude plan review lane must define five required fields."),
    validationItem("implementation_packet", "packet_field_count", implementationPacketRows.length === 7, "Codex implementation packet must define seven fields."),
    validationItem("self_review", "self_review_non_authority", codexSelfReviewRows.length === 4 && codexSelfReviewRows.every((row) => row.final_approval_allowed === false && row.independent_review_credit_allowed === false), "Codex self-review must remain non-authoritative."),
    validationItem("multi_pass", "multi_pass_review_count", claudeMultiPassRows.length === 6, "Claude multi-pass review must define six modes."),
    validationItem("finding_fix_loop", "resolution_count", findingFixLoopRows.length === 5, "Finding fix loop must define five resolution states."),
    validationItem("pr_type_policy", "policy_count", prTypePolicyRows.length === 6, "PR type policy must define six PR classes."),
    validationItem("instruction_freeze", "instruction_sources_available", instructionFreezeRows.every((row) => row.current_verdict === "pass"), "Instruction freeze sources must exist."),
    validationItem("evidence.sources", "evidence_sources_available", evidenceRows.every((row) => row.available_now === true), "All review process evidence sources must be available."),
    validationItem("gates.ready", "review_process_gates_ready", gateRows.every((row) => row.gate_status === "ready"), "All review process gates must be ready."),
    validationItem("boundary.ready", "p4000_review_process_upgrade_ready", boundary.p4000_review_process_upgrade_ready === true, "P4000 review process upgrade must be ready."),
  ];
}

function buildSummary({ boundary, workIntakeRows, codexPlanRows, claudePlanReviewRows, implementationPacketRows, codexSelfReviewRows, claudeMultiPassRows, findingFixLoopRows, prTypePolicyRows, instructionFreezeRows, evidenceRows, gateRows, validation }) {
  return {
    schema_version: "review-process-summary.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    review_process_upgrade_status: boundary.p4000_review_process_upgrade_ready ? READY_STATUS : "blocked_pending_review_process_upgrade",
    source_authority_contract_ready_now: boundary.source_authority_contract_ready_now,
    work_intake_field_count: workIntakeRows.length,
    codex_plan_only_lane_count: codexPlanRows.length,
    claude_plan_review_lane_count: claudePlanReviewRows.length,
    implementation_packet_count: implementationPacketRows.length,
    codex_self_review_count: codexSelfReviewRows.length,
    claude_multi_pass_review_count: claudeMultiPassRows.length,
    finding_fix_loop_count: findingFixLoopRows.length,
    pr_type_policy_count: prTypePolicyRows.length,
    instruction_freeze_count: instructionFreezeRows.length,
    instruction_freeze_ready_now: boundary.instruction_freeze_ready_now,
    evidence_provenance_count: evidenceRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    codex_plan_only_before_edit_required_now: boundary.codex_plan_only_before_edit_required_now,
    claude_plan_review_required_before_implementation_now: boundary.claude_plan_review_required_before_implementation_now,
    codex_self_review_independent_credit_allowed_now: boundary.codex_self_review_independent_credit_allowed_now,
    unresolved_high_findings_block_closeout_now: boundary.unresolved_high_findings_block_closeout_now,
    single_owner_exception_enterprise_trust_allowed_now: boundary.single_owner_exception_enterprise_trust_allowed_now,
    p4000_review_process_upgrade_ready: boundary.p4000_review_process_upgrade_ready,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Review Process Upgrade",
    "",
    `- Status: ${result.summary.review_process_upgrade_status}`,
    `- Program range: ${PROGRAM_RANGE}`,
    `- Phase range: ${PHASE_RANGE}`,
    `- Authority contract ready: ${result.summary.source_authority_contract_ready_now}`,
    `- Work intake fields: ${result.summary.work_intake_field_count}`,
    `- Claude multi-pass modes: ${result.summary.claude_multi_pass_review_count}`,
    `- PR type policies: ${result.summary.pr_type_policy_count}`,
    `- Instruction freeze ready: ${result.summary.instruction_freeze_ready_now}`,
    `- P4000 ready: ${result.summary.p4000_review_process_upgrade_ready}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Review Flow",
    "",
    "1. Work intake before plan.",
    "2. Codex plan-only lane before file edits.",
    "3. Claude plan review before implementation.",
    "4. Codex implementation packet before review closeout.",
    "5. Codex self-review remains non-authoritative.",
    "6. Claude multi-pass review and finding fix loop before human adjudication.",
    "7. PR type policy selects the evidence bar.",
    "8. Instruction freeze keeps AGENTS, CLAUDE, REVIEW, prompts, and PR template aligned.",
  ];
  return `${lines.join("\n")}\n`;
}

function contractRow(row) {
  return {
    ...row,
    required_for_p4000_freeze: true,
    current_verdict: "pass",
    evidence_ref: `evidence.platform.review_process.${row.row_id}`,
    reviewer_ref: "reviewer.platform_review_process_upgrade",
    hard_gate_ref: `gate.platform.review_process.${row.row_id}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: "materialize receipt lane and preserve contract",
  };
}

async function readInstructionSources(inputs) {
  return {
    agents_md: await readTextSource(inputs.agents_instructions_path),
    claude_md: await readTextSource(inputs.claude_instructions_path),
    review_md: await readTextSource(inputs.review_instructions_path),
    prompt_templates: await readTextSource(inputs.prompt_templates_path),
    pull_request_template: await readTextSource(inputs.pull_request_template_path),
  };
}

function normalizeInputs(options = {}) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.packagePath),
    review_authority_contract_path: path.resolve(options.reviewAuthorityContractPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.reviewAuthorityContractPath),
    external_verification_ledger_path: path.resolve(options.externalVerificationLedgerPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.externalVerificationLedgerPath),
    agents_instructions_path: path.resolve(options.agentsInstructionsPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.agentsInstructionsPath),
    claude_instructions_path: path.resolve(options.claudeInstructionsPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.claudeInstructionsPath),
    review_instructions_path: path.resolve(options.reviewInstructionsPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.reviewInstructionsPath),
    prompt_templates_path: path.resolve(options.promptTemplatesPath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.promptTemplatesPath),
    pull_request_template_path: path.resolve(options.pullRequestTemplatePath ?? DEFAULT_PLATFORM_REVIEW_PROCESS_UPGRADE_INPUTS.pullRequestTemplatePath),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--schema") args.schemaPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--authority-contract") args.reviewAuthorityContractPath = argv[++index];
    else if (arg === "--external-ledger") args.externalVerificationLedgerPath = argv[++index];
    else if (arg === "--agents") args.agentsInstructionsPath = argv[++index];
    else if (arg === "--claude") args.claudeInstructionsPath = argv[++index];
    else if (arg === "--review") args.reviewInstructionsPath = argv[++index];
    else if (arg === "--prompt-templates") args.promptTemplatesPath = argv[++index];
    else if (arg === "--pr-template") args.pullRequestTemplatePath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-review-process-upgrade.mjs [--check] [--no-write] [--out-dir <path>]

Options:
  --check                         Fail when validation has errors.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --schema <path>                 JSON schema path.
  --package <path>                package.json path.
  --authority-contract <path>     Review authority contract artifact path.
  --external-ledger <path>        External verification ledger path.
  --agents <path>                 AGENTS.md path.
  --claude <path>                 CLAUDE.md path.
  --review <path>                 REVIEW.md path.
  --prompt-templates <path>       Prompt templates path.
  --pr-template <path>            Pull request template path.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, data: JSON.parse(text), text };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null, text: "" };
  }
}

async function readOptionalJsonSource(filePath) {
  return readJsonSource(filePath);
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

function validationItem(scope, checkId, passed, message) {
  return {
    schema_version: "review-process-validation-item.v1",
    scope,
    check_id: checkId,
    passed: Boolean(passed),
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => !item.passed)
    .map((item) => ({ path: `${item.scope}.${item.check_id}`, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const clone = { ...result };
  delete clone.markdown;
  return clone;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
