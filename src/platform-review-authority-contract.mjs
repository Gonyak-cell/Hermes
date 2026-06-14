import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_OUT_DIR = "artifacts/platform-review-authority-contract/latest";
export const DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS = {
  schemaPath: "schemas/platform-review-authority-contract.schema.json",
  packagePath: "package.json",
  externalVerificationEnforcementLedgerPath: "docs/hermes-external-verification-enforcement.md",
  singleOwnerExceptionReceiptPath: "artifacts/platform-external-verification-enforcement/review/single-owner-exception-receipt.json",
  externalVerificationBoundaryPath: "artifacts/platform-external-verification-enforcement/latest/external-verification-boundary.json",
};

const COMMAND_NAME = "platform:review-authority-contract";
const SOURCE_COMMAND_NAME = "platform:external-verification-enforcement";
const SCHEMA_VERSION = "platform-review-authority-contract.v1";
const CAPABILITY_ID = "platform.review_process.authority_contract";
const PROGRAM_RANGE = "P3841-P4000";
const PHASE_RANGE = "P3841-P3860";
const PHASE_SLOT = "P3841";
const PREVIOUS_PHASE_SLOT = "P3840";
const NEXT_PHASE_SLOT = "P3861";
const READY_STATUS = "ready_for_review_authority_contract";

const AUTHORITY_ACTOR_SPECS = [
  {
    actor_id: "actor.codex.primary_developer",
    actor_type: "ai_developer",
    tool_family: "codex",
    primary_responsibility: "plan and implement scoped changes",
    can_create_plan: true,
    can_modify_source: true,
    can_review_findings: true,
    can_finally_approve: false,
    can_complete_enterprise_trust_gate: false,
    can_self_approve: false,
    requires_human_adjudication_for_protected_closeout: true,
  },
  {
    actor_id: "actor.claude_code.opus_max_reviewer",
    actor_type: "ai_independent_reviewer",
    tool_family: "claude_code",
    primary_responsibility: "independent plan and implementation review",
    can_create_plan: false,
    can_modify_source: false,
    can_review_findings: true,
    can_finally_approve: false,
    can_complete_enterprise_trust_gate: false,
    can_self_approve: false,
    requires_human_adjudication_for_protected_closeout: true,
  },
  {
    actor_id: "actor.human.owner_adjudicator",
    actor_type: "human_owner",
    tool_family: "human_receipt",
    primary_responsibility: "final adjudication and lower-trust single-owner merge decision",
    can_create_plan: false,
    can_modify_source: false,
    can_review_findings: true,
    can_finally_approve: true,
    can_complete_enterprise_trust_gate: false,
    can_self_approve: false,
    requires_human_adjudication_for_protected_closeout: false,
  },
  {
    actor_id: "actor.github.independent_reviewer",
    actor_type: "external_human_reviewer",
    tool_family: "github_pull_request_review",
    primary_responsibility: "independent GitHub approval for enterprise trust",
    can_create_plan: false,
    can_modify_source: false,
    can_review_findings: true,
    can_finally_approve: false,
    can_complete_enterprise_trust_gate: true,
    can_self_approve: false,
    requires_human_adjudication_for_protected_closeout: false,
  },
  {
    actor_id: "actor.github.single_owner_exception",
    actor_type: "single_owner_exception",
    tool_family: "github_pull_request_review",
    primary_responsibility: "lower-trust merge readiness when independent GitHub approval is structurally unavailable",
    can_create_plan: false,
    can_modify_source: false,
    can_review_findings: false,
    can_finally_approve: false,
    can_complete_enterprise_trust_gate: false,
    can_self_approve: false,
    requires_human_adjudication_for_protected_closeout: true,
  },
];

const AUTHORITY_RULE_SPECS = [
  ["codex_final_approval_forbidden", "actor.codex.primary_developer", "final_approval", "blocked", "Codex-created implementation cannot be finally approved by Codex."],
  ["codex_self_review_not_independent", "actor.codex.primary_developer", "independent_review", "blocked", "Codex self-review removes obvious noise but cannot complete an independent review gate."],
  ["claude_review_not_human_adjudication", "actor.claude_code.opus_max_reviewer", "human_adjudication", "blocked", "Claude review cannot replace human owner adjudication."],
  ["claude_review_no_write_authority", "actor.claude_code.opus_max_reviewer", "source_write", "blocked", "Claude reviewer evidence cannot mutate source files or apply patches."],
  ["human_adjudication_not_github_independent_review", "actor.human.owner_adjudicator", "independent_github_review", "blocked", "Human owner adjudication is required but does not equal independent GitHub PR approval."],
  ["single_owner_exception_not_enterprise_trust", "actor.github.single_owner_exception", "enterprise_trust", "blocked", "Single-owner readiness cannot replace independent GitHub approval for enterprise trust."],
  ["admin_bypass_not_review", "actor.github.single_owner_exception", "github_approval", "blocked", "Admin bypass or relaxed branch protection is not an independent GitHub review."],
  ["external_github_review_enterprise_gate", "actor.github.independent_reviewer", "enterprise_trust", "allowed_when_observed", "A separate GitHub reviewer approval may satisfy the independent GitHub approval control."],
];

const CLOSEOUT_CONTROL_SPECS = [
  ["intake_required_before_plan", "work_intake_present", "P3861-P3880"],
  ["codex_plan_review_required_before_implementation", "claude_plan_review_present", "P3901-P3920"],
  ["implementation_packet_required_before_review", "codex_implementation_packet_present", "P3921-P3940"],
  ["self_review_non_authority", "codex_self_review_cannot_approve", "P3941-P3960"],
  ["multi_pass_review_required_for_high_risk", "claude_multi_pass_receipts_present", "P3961-P3970"],
  ["finding_fix_loop_required", "unresolved_critical_or_high_findings_block_closeout", "P3971-P3980"],
  ["pr_type_policy_required", "pr_type_evidence_bar_selected", "P3981-P3990"],
  ["instruction_freeze_required", "review_instruction_contract_frozen", "P3991-P4000"],
];

export async function runPlatformReviewAuthorityContract(options = {}) {
  const result = await buildPlatformReviewAuthorityContract(options);
  if (options.write !== false) await writePlatformReviewAuthorityContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform review authority contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReviewAuthorityContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const externalLedger = await readTextSource(inputs.external_verification_enforcement_ledger_path);
  const singleOwnerReceipt = await readOptionalJsonSource(inputs.single_owner_exception_receipt_path);
  const externalBoundary = await readOptionalJsonSource(inputs.external_verification_boundary_path);
  const authorityActorRows = buildAuthorityActorRows();
  const authorityRuleRows = buildAuthorityRuleRows();
  const singleOwnerBoundaryRows = buildSingleOwnerBoundaryRows({ singleOwnerReceipt, externalBoundary });
  const closeoutControlRows = buildCloseoutControlRows();
  const evidenceRows = buildEvidenceRows({ generatedAt, packageJson, externalLedger, singleOwnerReceipt, externalBoundary });
  const gateRows = buildGateRows({ authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows });
  const boundary = buildBoundary({ authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, gateRows });
  const anchor = buildAnchor({ packageJson, externalLedger, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows });
  const manifest = buildManifest({ generatedAt, boundary, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows });
  const validationItems = buildValidationItems({ packageJson, externalLedger, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_review_authority_contract_id: `platform-review-authority-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    review_authority_anchor: anchor,
    review_authority_manifest: manifest,
    authority_actor_rows: authorityActorRows,
    authority_rule_rows: authorityRuleRows,
    single_owner_boundary_rows: singleOwnerBoundaryRows,
    closeout_control_rows: closeoutControlRows,
    evidence_provenance_rows: evidenceRows,
    review_authority_gate_rows: gateRows,
    review_authority_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_review_authority_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ boundary, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows, gateRows, validation: result.validation });
  result.summary.platform_review_authority_contract_id = result.platform_review_authority_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReviewAuthorityContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-review-authority-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-authority-manifest.json"), result.review_authority_manifest);
  await writeJson(path.join(outDir, "authority-actor-rows.json"), collectionEnvelope("authority-actor-rows.v1", "authority_actor_rows", result.authority_actor_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-rule-rows.json"), collectionEnvelope("authority-rule-rows.v1", "authority_rule_rows", result.authority_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "single-owner-boundary-rows.json"), collectionEnvelope("single-owner-boundary-rows.v1", "single_owner_boundary_rows", result.single_owner_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "closeout-control-rows.json"), collectionEnvelope("closeout-control-rows.v1", "closeout_control_rows", result.closeout_control_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-provenance-rows.json"), collectionEnvelope("review-authority-evidence-provenance-rows.v1", "evidence_provenance_rows", result.evidence_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-authority-gate-rows.json"), collectionEnvelope("review-authority-gate-rows.v1", "review_authority_gate_rows", result.review_authority_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-authority-boundary.json"), result.review_authority_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-review-authority-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReviewAuthorityContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReviewAuthorityContract(args);
    console.log(`Platform review authority contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.review_authority_contract_status}`);
    console.log(`Authority actors: ${result.summary.authority_actor_count}`);
    console.log(`Authority rules: ${result.summary.authority_rule_count}`);
    console.log(`Single-owner exception observed: ${result.summary.single_owner_exception_observed_now}`);
    console.log(`Single-owner enterprise trust allowed: ${result.summary.single_owner_enterprise_trust_allowed_now}`);
    console.log(`Codex final approval allowed: ${result.summary.codex_final_approval_allowed_now}`);
    console.log(`Claude final approval allowed: ${result.summary.claude_final_approval_allowed_now}`);
    console.log(`P4000 role authority contract ready: ${result.summary.p4000_role_authority_contract_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAuthorityActorRows() {
  return AUTHORITY_ACTOR_SPECS.map((spec, index) => passRow({
    schema_version: "authority-actor-row.v1",
    row_id: `authority.actor.row.${String(index + 1).padStart(2, "0")}`,
    ...spec,
    final_authority_scope: spec.can_finally_approve ? "human_adjudication_only" : "none",
    enterprise_trust_scope: spec.can_complete_enterprise_trust_gate ? "independent_github_review_only" : "none",
    current_verdict: "pass",
    evidence_ref: `evidence.platform.review_authority.actor.${spec.actor_id}`,
    reviewer_ref: "reviewer.platform_review_authority_contract",
    hard_gate_ref: `gate.platform.review_authority.actor.${spec.actor_id}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: "preserve actor authority boundary",
  }));
}

function buildAuthorityRuleRows() {
  return AUTHORITY_RULE_SPECS.map(([ruleId, actorId, actionId, authorityStatus, description], index) => {
    const isBlocked = authorityStatus === "blocked";
    return {
      schema_version: "authority-rule-row.v1",
      row_id: `authority.rule.row.${String(index + 1).padStart(2, "0")}`,
      rule_id: ruleId,
      actor_id: actorId,
      action_id: actionId,
      authority_status: authorityStatus,
      description,
      overclaim_blocks_closeout: isBlocked,
      required_for_p4000_freeze: true,
      current_verdict: "pass",
      evidence_ref: `evidence.platform.review_authority.rule.${ruleId}`,
      reviewer_ref: "reviewer.platform_review_authority_contract",
      hard_gate_ref: `gate.platform.review_authority.rule.${ruleId}`,
      responsible_owner: "platform_review_owner",
      next_allowed_action: isBlocked ? "block any receipt that grants this authority" : "allow only with observed independent GitHub approval evidence",
    };
  });
}

function buildSingleOwnerBoundaryRows({ singleOwnerReceipt, externalBoundary }) {
  const receipt = singleOwnerReceipt.data ?? {};
  const boundary = externalBoundary.data ?? {};
  const observed = isObservedReceipt(receipt) && receipt.single_owner_exception_observed_now === true;
  const mergeReady = boundary.single_owner_merge_readiness_now === true || receipt.single_owner_merge_readiness_now === true;
  const independentReview = boundary.independent_github_review_completed_now === true || receipt.independent_github_review_completed_now === true;
  const enterpriseTrust = boundary.enterprise_trust_claim_allowed_now === true || receipt.enterprise_trust_claim_allowed_now === true;
  const rows = [
    ["single_owner_exception_receipt_observed", observed, observed, "Single-owner exception receipt is observed"],
    ["single_owner_merge_readiness_allowed", mergeReady, mergeReady, "Single-owner mode may allow lower-trust merge readiness"],
    ["single_owner_independent_review_forbidden", !independentReview, independentReview === false || !independentReview, "Single-owner mode must not complete independent GitHub review"],
    ["single_owner_enterprise_trust_forbidden", !enterpriseTrust, enterpriseTrust === false || !enterpriseTrust, "Single-owner mode must not allow enterprise trust claims"],
  ];
  return rows.map(([controlId, observedNow, expectedSafeState, description], index) => ({
    schema_version: "single-owner-boundary-row.v1",
    row_id: `single.owner.boundary.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    description,
    observed_now: Boolean(observedNow),
    expected_safe_state_now: Boolean(expectedSafeState),
    required_for_p4000_freeze: true,
    current_verdict: expectedSafeState ? "pass" : "blocked",
    evidence_ref: `evidence.platform.review_authority.single_owner.${controlId}`,
    reviewer_ref: "reviewer.platform_review_authority_contract",
    hard_gate_ref: `gate.platform.review_authority.single_owner.${controlId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: expectedSafeState ? "preserve single-owner lower-trust boundary" : "restore single-owner exception boundary before closeout",
  }));
}

function buildCloseoutControlRows() {
  return CLOSEOUT_CONTROL_SPECS.map(([controlId, requiredSignal, phaseRange], index) => passRow({
    schema_version: "closeout-control-row.v1",
    row_id: `closeout.control.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    required_signal: requiredSignal,
    phase_range: phaseRange,
    required_for_p4000_freeze: true,
    closeout_blocks_without_signal: true,
    current_verdict: "pass",
    evidence_ref: `evidence.platform.review_authority.closeout.${controlId}`,
    reviewer_ref: "reviewer.platform_review_authority_contract",
    hard_gate_ref: `gate.platform.review_authority.closeout.${controlId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: `implement ${phaseRange} receipt lane`,
  }));
}

function buildEvidenceRows({ generatedAt, packageJson, externalLedger, singleOwnerReceipt, externalBoundary }) {
  const rows = [
    ["package_script", "package.json", packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-authority-contract.mjs"],
    ["external_verification_ledger", "docs/hermes-external-verification-enforcement.md", externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade")],
    ["single_owner_exception_receipt", DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.singleOwnerExceptionReceiptPath, singleOwnerReceipt.available],
    ["external_verification_boundary", DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.externalVerificationBoundaryPath, externalBoundary.available],
    ["review_authority_schema", DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.schemaPath, true],
  ];
  return rows.map(([sourceId, sourceUri, available], index) => ({
    schema_version: "review-authority-evidence-row.v1",
    row_id: `review.authority.evidence.row.${String(index + 1).padStart(2, "0")}`,
    source_id: sourceId,
    source_uri: sourceUri,
    observed_at: generatedAt,
    available_now: Boolean(available),
    required_for_p4000_freeze: true,
    current_verdict: available ? "pass" : "blocked",
    evidence_ref: `evidence.platform.review_authority.source.${sourceId}`,
    reviewer_ref: "reviewer.platform_review_authority_contract",
    hard_gate_ref: `gate.platform.review_authority.source.${sourceId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: available ? "preserve source evidence" : `restore ${sourceUri}`,
  }));
}

function buildGateRows({ authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows }) {
  const gates = [
    ["authority_actors_registered", authorityActorRows.length === 5],
    ["codex_final_approval_blocked", authorityRuleRows.some((row) => row.rule_id === "codex_final_approval_forbidden" && row.authority_status === "blocked")],
    ["claude_human_adjudication_blocked", authorityRuleRows.some((row) => row.rule_id === "claude_review_not_human_adjudication" && row.authority_status === "blocked")],
    ["single_owner_enterprise_trust_blocked", singleOwnerBoundaryRows.some((row) => row.control_id === "single_owner_enterprise_trust_forbidden" && row.current_verdict === "pass")],
    ["closeout_controls_seeded", closeoutControlRows.length === 8],
    ["evidence_sources_available", evidenceRows.every((row) => row.available_now === true)],
  ];
  return gates.map(([gateId, ready], index) => ({
    schema_version: "review-authority-gate-row.v1",
    row_id: `review.authority.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: ready ? "ready" : "blocked",
    required_for_p4000_freeze: true,
    current_verdict: ready ? "pass" : "blocked",
    evidence_ref: `evidence.platform.review_authority.gate.${gateId}`,
    reviewer_ref: "reviewer.platform_review_authority_contract",
    hard_gate_ref: `gate.platform.review_authority.gate.${gateId}`,
    responsible_owner: "platform_review_owner",
    next_allowed_action: ready ? "preserve gate evidence" : `resolve ${gateId}`,
  }));
}

function buildBoundary({ authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, gateRows }) {
  const codex = authorityActorRows.find((row) => row.actor_id === "actor.codex.primary_developer");
  const claude = authorityActorRows.find((row) => row.actor_id === "actor.claude_code.opus_max_reviewer");
  const human = authorityActorRows.find((row) => row.actor_id === "actor.human.owner_adjudicator");
  const singleOwnerObserved = singleOwnerBoundaryRows.find((row) => row.control_id === "single_owner_exception_receipt_observed")?.observed_now === true;
  const singleOwnerMergeReady = singleOwnerBoundaryRows.find((row) => row.control_id === "single_owner_merge_readiness_allowed")?.observed_now === true;
  const singleOwnerEnterpriseForbidden = singleOwnerBoundaryRows.find((row) => row.control_id === "single_owner_enterprise_trust_forbidden")?.current_verdict === "pass";
  const allGatesReady = gateRows.every((row) => row.gate_status === "ready");
  return {
    schema_version: "review-authority-boundary.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    codex_final_approval_allowed_now: codex?.can_finally_approve === true,
    codex_self_approval_allowed_now: codex?.can_self_approve === true,
    claude_final_approval_allowed_now: claude?.can_finally_approve === true,
    claude_write_permission_allowed_now: claude?.can_modify_source === true,
    human_final_adjudication_authority_now: human?.can_finally_approve === true,
    single_owner_exception_observed_now: singleOwnerObserved,
    single_owner_merge_readiness_now: singleOwnerMergeReady,
    single_owner_enterprise_trust_allowed_now: !singleOwnerEnterpriseForbidden,
    enterprise_trust_requires_independent_github_review_now: true,
    blocked_authority_rule_count: authorityRuleRows.filter((row) => row.authority_status === "blocked").length,
    p4000_role_authority_contract_ready: allGatesReady
      && codex?.can_finally_approve === false
      && claude?.can_finally_approve === false
      && human?.can_finally_approve === true
      && singleOwnerEnterpriseForbidden,
    next_allowed_action: "advance to P3861-P3880 Work Intake Spec after role authority contract stays ready",
  };
}

function buildAnchor({ packageJson, externalLedger, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows }) {
  return {
    schema_version: "review-authority-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-authority-contract.mjs",
    external_verification_ledger_registered: externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade"),
    authority_actor_count: authorityActorRows.length,
    authority_rule_count: authorityRuleRows.length,
    single_owner_boundary_count: singleOwnerBoundaryRows.length,
    closeout_control_count: closeoutControlRows.length,
    evidence_provenance_count: evidenceRows.length,
  };
}

function buildManifest({ generatedAt, boundary, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows }) {
  return {
    schema_version: "review-authority-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    review_authority_contract_status: boundary.p4000_role_authority_contract_ready ? READY_STATUS : "blocked_pending_review_authority_contract",
    authority_actor_count: authorityActorRows.length,
    authority_rule_count: authorityRuleRows.length,
    single_owner_boundary_count: singleOwnerBoundaryRows.length,
    closeout_control_count: closeoutControlRows.length,
    evidence_provenance_count: evidenceRows.length,
    p4000_role_authority_contract_ready: boundary.p4000_role_authority_contract_ready,
    enterprise_trust_requires_independent_github_review_now: boundary.enterprise_trust_requires_independent_github_review_now,
    single_owner_enterprise_trust_allowed_now: boundary.single_owner_enterprise_trust_allowed_now,
  };
}

function buildValidationItems({ packageJson, externalLedger, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package_script_registered", packageJson.available && packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/platform-review-authority-contract.mjs", `${COMMAND_NAME} package script must be registered.`),
    validationItem("docs.external_verification", "p4000_ledger_registered", externalLedger.available && externalLedger.text.includes("P3841-P4000 Review Process Upgrade"), "External verification ledger must describe P3841-P4000."),
    validationItem("authority.actors", "authority_actor_count", authorityActorRows.length === 5, "Five authority actors must be registered."),
    validationItem("authority.codex", "codex_cannot_finally_approve", boundary.codex_final_approval_allowed_now === false && boundary.codex_self_approval_allowed_now === false, "Codex must not finally approve or self-approve."),
    validationItem("authority.claude", "claude_cannot_finally_approve_or_write", boundary.claude_final_approval_allowed_now === false && boundary.claude_write_permission_allowed_now === false, "Claude reviewer must not finally approve or write."),
    validationItem("authority.human", "human_final_adjudication_authority", boundary.human_final_adjudication_authority_now === true, "Human owner must retain final adjudication authority."),
    validationItem("authority.rules", "authority_rules_count", authorityRuleRows.length === 8, "Eight authority rules must be present."),
    validationItem("single_owner.enterprise", "single_owner_not_enterprise_trust", boundary.single_owner_enterprise_trust_allowed_now === false, "Single-owner mode must not allow enterprise trust."),
    validationItem("closeout.controls", "closeout_control_count", closeoutControlRows.length === 8, "Eight downstream closeout controls must be seeded."),
    validationItem("evidence.sources", "evidence_sources_available", evidenceRows.every((row) => row.available_now === true), "All authority evidence sources must be available."),
    validationItem("gates.ready", "review_authority_gates_ready", gateRows.every((row) => row.gate_status === "ready"), "All review authority gates must be ready."),
    validationItem("boundary.ready", "p4000_role_authority_contract_ready", boundary.p4000_role_authority_contract_ready === true, "P3841-P3860 authority contract must be ready."),
  ];
}

function buildSummary({ boundary, authorityActorRows, authorityRuleRows, singleOwnerBoundaryRows, closeoutControlRows, evidenceRows, gateRows, validation }) {
  return {
    schema_version: "review-authority-summary.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    review_authority_contract_status: boundary.p4000_role_authority_contract_ready ? READY_STATUS : "blocked_pending_review_authority_contract",
    authority_actor_count: authorityActorRows.length,
    authority_rule_count: authorityRuleRows.length,
    blocked_authority_rule_count: boundary.blocked_authority_rule_count,
    single_owner_boundary_count: singleOwnerBoundaryRows.length,
    closeout_control_count: closeoutControlRows.length,
    evidence_provenance_count: evidenceRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    codex_final_approval_allowed_now: boundary.codex_final_approval_allowed_now,
    claude_final_approval_allowed_now: boundary.claude_final_approval_allowed_now,
    human_final_adjudication_authority_now: boundary.human_final_adjudication_authority_now,
    single_owner_exception_observed_now: boundary.single_owner_exception_observed_now,
    single_owner_merge_readiness_now: boundary.single_owner_merge_readiness_now,
    single_owner_enterprise_trust_allowed_now: boundary.single_owner_enterprise_trust_allowed_now,
    enterprise_trust_requires_independent_github_review_now: boundary.enterprise_trust_requires_independent_github_review_now,
    p4000_role_authority_contract_ready: boundary.p4000_role_authority_contract_ready,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Review Authority Contract",
    "",
    `- Status: ${result.summary.review_authority_contract_status}`,
    `- Program range: ${PROGRAM_RANGE}`,
    `- Phase range: ${PHASE_RANGE}`,
    `- Authority actors: ${result.summary.authority_actor_count}`,
    `- Authority rules: ${result.summary.authority_rule_count}`,
    `- Codex final approval allowed: ${result.summary.codex_final_approval_allowed_now}`,
    `- Claude final approval allowed: ${result.summary.claude_final_approval_allowed_now}`,
    `- Human final adjudication authority: ${result.summary.human_final_adjudication_authority_now}`,
    `- Single-owner exception observed: ${result.summary.single_owner_exception_observed_now}`,
    `- Single-owner enterprise trust allowed: ${result.summary.single_owner_enterprise_trust_allowed_now}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Invariants",
    "",
    "- Codex-created implementation cannot be finally approved by Codex.",
    "- Claude review cannot replace human adjudication.",
    "- Single-owner exception cannot replace independent GitHub approval for enterprise trust.",
  ];
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.packagePath),
    external_verification_enforcement_ledger_path: path.resolve(options.externalVerificationEnforcementLedgerPath ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.externalVerificationEnforcementLedgerPath),
    single_owner_exception_receipt_path: path.resolve(options.singleOwnerExceptionReceiptPath ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.singleOwnerExceptionReceiptPath),
    external_verification_boundary_path: path.resolve(options.externalVerificationBoundaryPath ?? DEFAULT_PLATFORM_REVIEW_AUTHORITY_CONTRACT_INPUTS.externalVerificationBoundaryPath),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--schema") args.schemaPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--external-ledger") args.externalVerificationEnforcementLedgerPath = argv[++index];
    else if (arg === "--single-owner-exception") args.singleOwnerExceptionReceiptPath = argv[++index];
    else if (arg === "--external-boundary") args.externalVerificationBoundaryPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-review-authority-contract.mjs [--check] [--no-write] [--out-dir <path>]

Options:
  --check                         Fail when validation has errors.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --schema <path>                 JSON schema path.
  --package <path>                package.json path.
  --external-ledger <path>        External verification enforcement ledger path.
  --single-owner-exception <path> Single-owner exception receipt path.
  --external-boundary <path>      External verification boundary path.`);
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

function passRow(row) {
  return row;
}

function validationItem(scope, checkId, passed, message) {
  return {
    schema_version: "review-authority-validation-item.v1",
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

function isObservedReceipt(receipt) {
  return receipt?.receipt_status === "observed";
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
