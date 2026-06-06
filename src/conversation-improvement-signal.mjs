import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildConversationSourcePlane } from "./conversation-source-plane.mjs";

export const DEFAULT_CONVERSATION_IMPROVEMENT_SIGNAL_OUT_DIR = "artifacts/conversation-improvement-signal/latest";
export const DEFAULT_CONVERSATION_IMPROVEMENT_SIGNAL_INPUTS = {
  schemaPath: "schemas/conversation-improvement-signal.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  principleDocPath: "docs/hue-keynote-harness-operating-loop.md",
};

const COMMAND_NAME = "platform:conversation-improvement-signal";
const SOURCE_COMMAND_NAME = "platform:conversation-source-plane";
const SCHEMA_VERSION = "conversation-improvement-signal.v1";
const CAPABILITY_ID = "platform.conversation_improvement_signal";
const PROGRAM_RANGE = "P4301-P4600";
const SOURCE_READY_STATUS = "ready_for_conversation_source_plane_v0";
const READY_STATUS = "ready_for_conversation_improvement_signal_freeze";

const PHASE_SPECS = [
  ["P4301-P4340", "Improvement Signal Schema"],
  ["P4341-P4380", "User Correction Classifier"],
  ["P4381-P4420", "Assistant Miss Classifier"],
  ["P4421-P4460", "Plan Amendment Candidate Lane"],
  ["P4461-P4500", "Soft Rule Promotion Queue"],
  ["P4501-P4540", "Self-Improvement Review Packet"],
  ["P4541-P4580", "Next-Session Context Injection"],
  ["P4581-P4600", "Improvement Signal Freeze"],
];

const SIGNAL_TYPES = [
  "USER_CORRECTION",
  "ASSISTANT_MISS",
  "REVIEW_CONFLICT",
  "BLOCKED_COMMAND",
  "FAILED_VALIDATION",
  "REPEATED_CONTEXT_LOSS",
];

const ROOT_CAUSES = [
  "PLAN_SURFACE_UNDER_SPECIFIED",
  "COMPLETION_OVERCLAIM",
  "AUTHORITY_BOUNDARY_CONFUSION",
  "SOURCE_CITATION_MISSING",
  "VALIDATION_CONTRACT_DRIFT",
  "SESSION_CONTEXT_EPHEMERAL",
];

export async function runConversationImprovementSignal(options = {}) {
  const result = await buildConversationImprovementSignal(options);
  if (options.write !== false) await writeConversationImprovementSignal(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Conversation improvement signal failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConversationImprovementSignal(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONVERSATION_IMPROVEMENT_SIGNAL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const principleDoc = await readTextSource(inputs.principle_doc_path);
  const sourcePlane = options.sourcePlane ?? await buildConversationSourcePlane({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    principleDocPath: inputs.principle_doc_path,
    write: false,
  });

  const contract = buildImprovementSignalContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const signalRows = buildImprovementSignalRows(sourcePlane, generatedAt);
  const userCorrectionRows = buildUserCorrectionRows(signalRows, generatedAt);
  const assistantMissRows = buildAssistantMissRows(signalRows, generatedAt);
  const planAmendmentRows = buildPlanAmendmentRows(signalRows, generatedAt);
  const softRulePromotionRows = buildSoftRulePromotionRows(signalRows, generatedAt);
  const reviewPacketRows = buildReviewPacketRows(signalRows, planAmendmentRows, softRulePromotionRows, generatedAt);
  const nextConditionRows = buildNextConditionRows(signalRows, reviewPacketRows, generatedAt);
  const freezeRows = buildFreezeRows({ signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, principleDoc, sourcePlane, contract, phaseRows, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows });
  const boundary = buildBoundary({ sourcePlane, signalRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, principleDoc, sourcePlane, contract, phaseRows, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    conversation_improvement_signal_id: `conversation-improvement-signal.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_conversation_source_plane_summary: sourcePlane.summary,
    improvement_signal_contract: contract,
    improvement_signal_phase_rows: phaseRows,
    improvement_signal_rows: signalRows,
    user_correction_classifier_rows: userCorrectionRows,
    assistant_miss_classifier_rows: assistantMissRows,
    plan_amendment_candidate_rows: planAmendmentRows,
    soft_rule_promotion_rows: softRulePromotionRows,
    self_improvement_review_packet_rows: reviewPacketRows,
    next_session_context_injection_rows: nextConditionRows,
    improvement_signal_freeze_rows: freezeRows,
    improvement_signal_gate_rows: gateRows,
    improvement_signal_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourcePlane, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "conversation_improvement_signal")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourcePlane, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.conversation_improvement_signal_id = result.conversation_improvement_signal_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeConversationImprovementSignal(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "conversation-improvement-signal.json"), serializableResult(result));
  await writeJson(path.join(outDir, "improvement-signal-rows.json"), collectionEnvelope("improvement-signal-rows.v1", "improvement_signal_rows", result.improvement_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "user-correction-classifier-rows.json"), collectionEnvelope("user-correction-classifier-rows.v1", "user_correction_classifier_rows", result.user_correction_classifier_rows, result.generated_at));
  await writeJson(path.join(outDir, "assistant-miss-classifier-rows.json"), collectionEnvelope("assistant-miss-classifier-rows.v1", "assistant_miss_classifier_rows", result.assistant_miss_classifier_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-amendment-candidate-rows.json"), collectionEnvelope("plan-amendment-candidate-rows.v1", "plan_amendment_candidate_rows", result.plan_amendment_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "soft-rule-promotion-rows.json"), collectionEnvelope("soft-rule-promotion-rows.v1", "soft_rule_promotion_rows", result.soft_rule_promotion_rows, result.generated_at));
  await writeJson(path.join(outDir, "self-improvement-review-packet-rows.json"), collectionEnvelope("self-improvement-review-packet-rows.v1", "self_improvement_review_packet_rows", result.self_improvement_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-session-context-injection-rows.json"), collectionEnvelope("next-session-context-injection-rows.v1", "next_session_context_injection_rows", result.next_session_context_injection_rows, result.generated_at));
  await writeJson(path.join(outDir, "improvement-signal-freeze-rows.json"), collectionEnvelope("improvement-signal-freeze-rows.v1", "improvement_signal_freeze_rows", result.improvement_signal_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "improvement-signal-gate-rows.json"), collectionEnvelope("improvement-signal-gate-rows.v1", "improvement_signal_gate_rows", result.improvement_signal_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "improvement-signal-boundary.json"), result.improvement_signal_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "conversation-improvement-signal-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runConversationImprovementSignalCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConversationImprovementSignal(args);
    console.log(`Conversation improvement signal ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.conversation_improvement_signal_status}`);
    console.log(`Signals: ${result.summary.signal_count}`);
    console.log(`Plan candidates: ${result.summary.plan_amendment_candidate_count}`);
    console.log(`Hook candidates: ${result.summary.soft_rule_promotion_count}`);
    console.log(`Review packets: ${result.summary.review_packet_count}`);
    console.log(`Next condition updates applied: ${result.summary.next_condition_update_applied_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildImprovementSignalContract(generatedAt) {
  return {
    schema_version: "improvement-signal-contract.v1",
    generated_at: generatedAt,
    contract_id: "improvement-signal-contract.p4301-p4600",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4001-P4300",
    required_signal_fields: ["improvement_signal_id", "source_id", "source_turn_ref", "signal_type", "symptom", "root_cause", "affected_gate", "owner", "reviewer_ref", "proposed_change_ref", "next_execution_condition_ref"],
    signal_type_enum: SIGNAL_TYPES,
    root_cause_enum: ROOT_CAUSES,
    user_correction_changes_next_condition: true,
    assistant_miss_has_root_cause: true,
    plan_amendment_requires_reviewer: true,
    soft_rule_promotion_requires_hook_candidate: true,
    review_packet_required_before_self_modification: true,
    next_execution_condition_changes_only_after_review: true,
    unreviewed_self_modification_allowed: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "improvement-signal-phase-row.v1",
      row_id: `improvement-signal.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.platform_improvement_signal_owner",
      hard_gate_ref: `gate.platform.improvement_signal.${phase_range}`,
      responsible_owner: "platform_improvement_signal_owner",
      next_allowed_action: pass ? "preserve phase in P4600 closeout" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildImprovementSignalRows(sourcePlane, generatedAt) {
  const codexSource = sourcePlane.conversation_source_rows.find((row) => row.engine === "Codex") ?? sourcePlane.conversation_source_rows[0];
  const claudeSource = sourcePlane.conversation_source_rows.find((row) => row.engine === "Claude Code") ?? sourcePlane.conversation_source_rows[1] ?? codexSource;
  const specs = [
    {
      signal_type: "USER_CORRECTION",
      source: codexSource,
      source_turn_ref: "turn.user.p8000.conversation_source_queue",
      symptom: "User clarified P4001-P4300 needs Conversation Source Queue, not KPI dashboard or raw chat viewer.",
      root_cause: "PLAN_SURFACE_UNDER_SPECIFIED",
      affected_gate: "gate.platform.hue_keynote.conversation_source_queue_ui_registered",
      proposed_change_ref: "plan-amendment.conversation_source_queue_contract",
      next_execution_condition_ref: "next-condition.queue_first_source_review",
    },
    {
      signal_type: "ASSISTANT_MISS",
      source: codexSource,
      source_turn_ref: "turn.assistant.p8000.initial_alignment",
      symptom: "Initial alignment treated conversation storage as sufficient before explicit improvement signal mining.",
      root_cause: "COMPLETION_OVERCLAIM",
      affected_gate: "gate.platform.hue_keynote.improvement_signals_governed",
      proposed_change_ref: "plan-amendment.improvement_signal_program",
      next_execution_condition_ref: "next-condition.no_learning_without_reviewed_signal",
    },
    {
      signal_type: "REVIEW_CONFLICT",
      source: claudeSource,
      source_turn_ref: "turn.review.single_owner_exception",
      symptom: "Single-owner GitHub approval cannot be represented as independent enterprise review.",
      root_cause: "AUTHORITY_BOUNDARY_CONFUSION",
      affected_gate: "gate.platform.review.single_owner_enterprise_trust",
      proposed_change_ref: "plan-amendment.single_owner_trust_boundary",
      next_execution_condition_ref: "next-condition.enterprise_trust_requires_independent_review",
    },
    {
      signal_type: "FAILED_VALIDATION",
      source: codexSource,
      source_turn_ref: "turn.validation.hue_alignment.principle_term_missing",
      symptom: "Hue alignment failed until the PASS ownership requirement was explicit.",
      root_cause: "VALIDATION_CONTRACT_DRIFT",
      affected_gate: "gate.platform.hue_keynote.pass_ownership",
      proposed_change_ref: "plan-amendment.explicit_pass_owner_terms",
      next_execution_condition_ref: "next-condition.schema_checks_explicit_terms",
    },
    {
      signal_type: "REPEATED_CONTEXT_LOSS",
      source: codexSource,
      source_turn_ref: "turn.user.sessions_forget_plan",
      symptom: "Long-running Codex/Claude work can lose the original plan as chat sessions move on.",
      root_cause: "SESSION_CONTEXT_EPHEMERAL",
      affected_gate: "gate.platform.conversation_source.context_recovery",
      proposed_change_ref: "plan-amendment.context_recovery_required",
      next_execution_condition_ref: "next-condition.recall_bundle_before_planning",
    },
    {
      signal_type: "BLOCKED_COMMAND",
      source: claudeSource,
      source_turn_ref: "turn.policy.raw_transcript_access_blocked",
      symptom: "Raw transcript body must remain hidden until redaction/classification review completes.",
      root_cause: "SOURCE_CITATION_MISSING",
      affected_gate: "gate.platform.conversation_source.raw_transcript_body_default_visible",
      proposed_change_ref: "plan-amendment.redaction_hold_first",
      next_execution_condition_ref: "next-condition.no_raw_body_without_redaction",
    },
  ];
  return specs.map((spec, index) => ({
    schema_version: "improvement-signal-row.v1",
    row_id: `improvement-signal.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    improvement_signal_id: `improvement-signal.${String(index + 1).padStart(3, "0")}`,
    source_id: spec.source.source_id,
    source_turn_ref: spec.source_turn_ref,
    signal_type: spec.signal_type,
    symptom: spec.symptom,
    root_cause: spec.root_cause,
    affected_gate: spec.affected_gate,
    owner: "platform_improvement_signal_owner",
    reviewer_ref: signalReviewer(spec.signal_type),
    proposed_change_ref: spec.proposed_change_ref,
    next_execution_condition_ref: spec.next_execution_condition_ref,
    signal_status: "REVIEW_PACKET_READY",
    source_citation_ref: `citation.${spec.source.source_id}.${spec.source_turn_ref}`,
    source_citation_required: true,
    review_required_before_adoption: true,
    claude_code_opus_max_review_required: true,
    human_adjudication_required: false,
    self_modification_allowed_now: false,
    next_execution_condition_changed_now: false,
    evidence_ref: `evidence.improvement_signal.${String(index + 1).padStart(3, "0")}`,
    hard_gate_ref: `gate.improvement_signal.${spec.signal_type.toLowerCase()}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildUserCorrectionRows(signalRows, generatedAt) {
  return signalRows
    .filter((row) => row.signal_type === "USER_CORRECTION")
    .map((signal, index) => ({
      schema_version: "user-correction-classifier-row.v1",
      row_id: `user-correction.classifier.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      improvement_signal_id: signal.improvement_signal_id,
      source_turn_ref: signal.source_turn_ref,
      correction_kind: "planning_mismatch",
      correction_status: "classified",
      changes_next_execution_condition: true,
      proposed_change_ref: signal.proposed_change_ref,
      next_execution_condition_ref: signal.next_execution_condition_ref,
      reviewer_ref: signal.reviewer_ref,
      adoption_allowed_without_review: false,
      evidence_ref: `evidence.user_correction.${signal.improvement_signal_id}`,
    }));
}

function buildAssistantMissRows(signalRows, generatedAt) {
  return signalRows
    .filter((row) => row.signal_type === "ASSISTANT_MISS" || row.signal_type === "FAILED_VALIDATION" || row.signal_type === "REPEATED_CONTEXT_LOSS")
    .map((signal, index) => ({
      schema_version: "assistant-miss-classifier-row.v1",
      row_id: `assistant-miss.classifier.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      improvement_signal_id: signal.improvement_signal_id,
      source_turn_ref: signal.source_turn_ref,
      miss_kind: signal.signal_type.toLowerCase(),
      symptom: signal.symptom,
      root_cause: signal.root_cause,
      affected_gate: signal.affected_gate,
      correction_required: true,
      review_required_before_adoption: true,
      evidence_ref: `evidence.assistant_miss.${signal.improvement_signal_id}`,
      reviewer_ref: signal.reviewer_ref,
    }));
}

function buildPlanAmendmentRows(signalRows, generatedAt) {
  return signalRows.map((signal, index) => ({
    schema_version: "plan-amendment-candidate-row.v1",
    row_id: `plan-amendment.candidate.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    plan_amendment_candidate_id: signal.proposed_change_ref,
    improvement_signal_id: signal.improvement_signal_id,
    source_turn_ref: signal.source_turn_ref,
    candidate_title: planTitle(signal),
    amendment_status: signal.signal_type === "USER_CORRECTION" ? "REVIEWED_CANDIDATE" : "PROPOSED",
    affected_gate: signal.affected_gate,
    reviewer_ref: signal.reviewer_ref,
    claude_code_opus_max_review_required: true,
    human_adjudication_required: false,
    adopted: false,
    adopted_without_review: false,
    evidence_ref: `evidence.plan_amendment.${signal.proposed_change_ref}`,
    next_allowed_action: "route plan amendment candidate to self-improvement review packet",
  }));
}

function buildSoftRulePromotionRows(signalRows, generatedAt) {
  return signalRows.map((signal, index) => ({
    schema_version: "soft-rule-promotion-row.v1",
    row_id: `soft-rule.promotion.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    hook_candidate_ref: `hook-candidate.${signal.improvement_signal_id}`,
    improvement_signal_id: signal.improvement_signal_id,
    soft_rule_source_ref: signal.source_turn_ref,
    deterministic_check_description: hookDescription(signal),
    affected_gate: signal.affected_gate,
    promotion_status: "HOOK_CANDIDATE",
    hard_hook_enforced_now: false,
    exit_2_block_required_when_enforced: true,
    reviewer_ref: signal.reviewer_ref,
    evidence_ref: `evidence.soft_rule_promotion.${signal.improvement_signal_id}`,
    next_allowed_action: "review hook candidate before enforcement",
  }));
}

function buildReviewPacketRows(signalRows, planRows, hookRows, generatedAt) {
  return signalRows.map((signal, index) => {
    const plan = planRows.find((row) => row.improvement_signal_id === signal.improvement_signal_id);
    const hook = hookRows.find((row) => row.improvement_signal_id === signal.improvement_signal_id);
    return {
      schema_version: "self-improvement-review-packet-row.v1",
      row_id: `self-improvement.review-packet.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      review_packet_id: `self-improvement-review-packet.${signal.improvement_signal_id}`,
      improvement_signal_id: signal.improvement_signal_id,
      source_turn_ref: signal.source_turn_ref,
      proposed_change_ref: plan?.plan_amendment_candidate_id ?? signal.proposed_change_ref,
      hook_candidate_ref: hook?.hook_candidate_ref ?? null,
      expected_effect: expectedEffect(signal),
      rollback_ref: `rollback.${signal.improvement_signal_id}`,
      reviewer_ref: signal.reviewer_ref,
      claude_code_opus_max_review_required: true,
      human_adjudication_required: false,
      review_packet_status: "READY_FOR_CLAUDE_REVIEW",
      self_modification_allowed_now: false,
      policy_rewrite_applied_now: false,
      plan_adoption_applied_now: false,
      evidence_ref: `evidence.self_improvement_review_packet.${signal.improvement_signal_id}`,
      next_allowed_action: "capture Claude Code Opus max review receipt before next-condition injection",
    };
  });
}

function buildNextConditionRows(signalRows, reviewPacketRows, generatedAt) {
  return signalRows.map((signal, index) => {
    const reviewPacket = reviewPacketRows.find((row) => row.improvement_signal_id === signal.improvement_signal_id);
    return {
      schema_version: "next-session-context-injection-row.v1",
      row_id: `next-session.context-injection.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      next_execution_condition_ref: signal.next_execution_condition_ref,
      improvement_signal_id: signal.improvement_signal_id,
      review_packet_id: reviewPacket?.review_packet_id ?? null,
      injection_status: "REVIEW_PENDING",
      review_required_before_injection: true,
      claude_code_opus_max_review_required: true,
      human_adjudication_required: false,
      next_execution_condition_changed_now: false,
      injected_now: false,
      can_inject_after_review: true,
      evidence_ref: `evidence.next_condition.${signal.next_execution_condition_ref}`,
      next_allowed_action: "wait for Claude Code Opus max review receipt before injecting into future context",
    };
  });
}

function buildFreezeRows({ signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, generatedAt }) {
  const specs = [
    ["signals_present", signalRows.length >= SIGNAL_TYPES.length, "conversation improvement signals exist"],
    ["user_correction_classified", userCorrectionRows.every((row) => row.source_turn_ref && row.changes_next_execution_condition), "user correction has source turn ref and next-condition candidate"],
    ["assistant_miss_root_cause", assistantMissRows.every((row) => row.root_cause), "assistant miss has root cause"],
    ["plan_amendment_reviewer", planAmendmentRows.every((row) => row.reviewer_ref && row.adopted_without_review === false), "plan amendment candidate has reviewer and is not adopted"],
    ["soft_rule_hook_candidate", softRulePromotionRows.every((row) => row.hook_candidate_ref && row.hard_hook_enforced_now === false), "soft rule promotion creates hook candidates but does not enforce them"],
    ["review_packet_ready", reviewPacketRows.every((row) => row.review_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.claude_code_opus_max_review_required && row.human_adjudication_required === false), "self-improvement review packets are ready for Claude review"],
    ["next_condition_review_pending", nextConditionRows.every((row) => row.review_required_before_injection && row.next_execution_condition_changed_now === false), "next execution condition changes only after review"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "improvement-signal-freeze-row.v1",
    row_id: `improvement-signal.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.improvement_signal.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.platform_improvement_signal_owner",
    hard_gate_ref: `gate.improvement_signal.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, principleDoc, sourcePlane, contract, phaseRows, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:conversation-improvement-signal"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes conversation improvement signal"],
    ["source_script_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source conversation plane script exists"],
    ["source_plane_ready", sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS, "P4001-P4300 source plane is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Conversation Improvement Signal Mining"), "P4301-P4600 roadmap is reflected"],
    ["principle_reflected", principleDoc.available && includesToken(principleDoc.text, "Conversation Improvement Signal Requirement"), "Hue principle doc reflects improvement signals"],
    ["contract_ready", contract.user_correction_changes_next_condition && contract.unreviewed_self_modification_allowed === false, "improvement signal contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P4301-P4600 phase rows pass"],
    ["signal_types_covered", SIGNAL_TYPES.every((type) => signalRows.some((row) => row.signal_type === type)), "all required signal types are covered"],
    ["user_corrections_classified", userCorrectionRows.length >= 1 && userCorrectionRows.every((row) => row.changes_next_execution_condition), "user corrections are classified"],
    ["assistant_misses_classified", assistantMissRows.length >= 1 && assistantMissRows.every((row) => row.root_cause), "assistant misses have root causes"],
    ["plan_candidates_ready", planAmendmentRows.every((row) => row.reviewer_ref && row.adopted_without_review === false), "plan amendment candidates have reviewers"],
    ["hook_candidates_ready", softRulePromotionRows.every((row) => row.hook_candidate_ref && row.hard_hook_enforced_now === false), "soft rule promotion creates hook candidates only"],
    ["review_packets_ready", reviewPacketRows.every((row) => row.review_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.self_modification_allowed_now === false && row.claude_code_opus_max_review_required), "review packets are ready for Claude review without self-modification"],
    ["next_conditions_review_pending", nextConditionRows.every((row) => row.review_required_before_injection && row.next_execution_condition_changed_now === false), "next condition changes wait for review"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "improvement-signal-gate-row.v1",
    row_id: `improvement-signal.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.improvement_signal.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_improvement_signal_owner",
    hard_gate_ref: `gate.platform.improvement_signal.${gate_id}`,
    responsible_owner: "platform_improvement_signal_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourcePlane, signalRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, gateRows }) {
  const unsafeFlags = [
    sourcePlane.summary?.conversation_source_plane_status !== SOURCE_READY_STATUS,
    gateRows.some((row) => row.gate_status !== "ready"),
    signalRows.some((row) => !row.source_turn_ref || !row.root_cause || !row.reviewer_ref),
    planAmendmentRows.some((row) => row.adopted || row.adopted_without_review),
    softRulePromotionRows.some((row) => row.hard_hook_enforced_now),
    reviewPacketRows.some((row) => row.self_modification_allowed_now || row.policy_rewrite_applied_now || row.plan_adoption_applied_now),
    nextConditionRows.some((row) => row.next_execution_condition_changed_now || row.injected_now),
  ];
  return {
    schema_version: "improvement-signal-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4001-P4300",
    conversation_improvement_signal_ready: unsafeFlags.filter(Boolean).length === 0,
    source_plane_ready: sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS,
    conversation_improvement_signal_exists: signalRows.length > 0,
    user_correction_has_source_turn_ref: signalRows.some((row) => row.signal_type === "USER_CORRECTION" && row.source_turn_ref),
    assistant_miss_has_root_cause: signalRows.some((row) => row.signal_type === "ASSISTANT_MISS" && row.root_cause),
    plan_amendment_candidate_has_reviewer: planAmendmentRows.every((row) => row.reviewer_ref),
    soft_rule_promotion_has_hook_candidate: softRulePromotionRows.every((row) => row.hook_candidate_ref),
    next_execution_condition_changes_only_after_review: nextConditionRows.every((row) => row.review_required_before_injection && row.next_execution_condition_changed_now === false),
    unreviewed_self_modification_allowed: false,
    self_modification_applied_now: false,
    policy_rewrite_applied_now: false,
    plan_adoption_applied_now: false,
    hard_hook_enforced_now: false,
    next_condition_injected_now: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    receipt_application_enabled: false,
    raw_transcript_body_default_visible: false,
    agent_final_pass_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, principleDoc, sourcePlane, contract, phaseRows, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include improvement signal command"),
    validationItem("source.ready", "source", sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS, "source conversation plane must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P4301-P4600 roadmap must be available"),
    validationItem("principle.reflected", "docs", principleDoc.available && includesToken(principleDoc.text, "Conversation Improvement Signal Requirement"), "principle doc must include improvement signal requirement"),
    validationItem("contract.fields", "contract", contract.required_signal_fields.length >= 11, "signal contract must define required fields"),
    validationItem("contract.no_self_modification", "contract", contract.unreviewed_self_modification_allowed === false, "unreviewed self-modification must be false"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P4301-P4600 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P4301-P4600 phase rows must pass"),
    validationItem("signals.types", "signals", SIGNAL_TYPES.every((type) => signalRows.some((row) => row.signal_type === type)), "all signal types must be represented"),
    validationItem("signals.source_turn", "signals", signalRows.every((row) => row.source_turn_ref && row.source_citation_ref), "signals must include source turn and citation refs"),
    validationItem("user_correction.next_condition", "user_correction", userCorrectionRows.every((row) => row.changes_next_execution_condition && row.source_turn_ref), "user corrections must create next-condition candidates"),
    validationItem("assistant_miss.root_cause", "assistant_miss", assistantMissRows.every((row) => row.root_cause && row.correction_required), "assistant misses must have root cause"),
    validationItem("plan_amendment.reviewer", "plan_amendment", planAmendmentRows.every((row) => row.reviewer_ref && row.adopted_without_review === false), "plan amendment candidates need reviewers"),
    validationItem("soft_rule.hook_candidate", "soft_rule", softRulePromotionRows.every((row) => row.hook_candidate_ref && row.hard_hook_enforced_now === false), "soft rules must become hook candidates but not enforced now"),
    validationItem("review_packet.ready", "review_packet", reviewPacketRows.every((row) => row.review_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.claude_code_opus_max_review_required && row.human_adjudication_required === false), "review packets must be ready for Claude review"),
    validationItem("review_packet.no_self_mod", "review_packet", reviewPacketRows.every((row) => !row.self_modification_allowed_now && !row.policy_rewrite_applied_now && !row.plan_adoption_applied_now), "review packets cannot self-modify"),
    validationItem("next_condition.review_pending", "next_condition", nextConditionRows.every((row) => row.review_required_before_injection && row.next_execution_condition_changed_now === false), "next condition changes wait for review"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false, "P4600 must not enable runtime or write"),
    validationItem("boundary.no_work_os_claim", "boundary", boundary.work_os_claim_enabled === false, "P4600 must not claim production Work OS"),
  ];
}

function buildSummary({ sourcePlane, signalRows, userCorrectionRows, assistantMissRows, planAmendmentRows, softRulePromotionRows, reviewPacketRows, nextConditionRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "conversation-improvement-signal-summary.v1",
    conversation_improvement_signal_status: validation.valid && boundary.conversation_improvement_signal_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P4001-P4300",
    source_plane_status: sourcePlane.summary?.conversation_source_plane_status ?? "unknown",
    signal_count: signalRows.length,
    signal_type_count: new Set(signalRows.map((row) => row.signal_type)).size,
    user_correction_count: userCorrectionRows.length,
    assistant_miss_count: assistantMissRows.length,
    plan_amendment_candidate_count: planAmendmentRows.length,
    soft_rule_promotion_count: softRulePromotionRows.length,
    review_packet_count: reviewPacketRows.length,
    next_condition_update_candidate_count: nextConditionRows.length,
    next_condition_update_applied_count: nextConditionRows.filter((row) => row.next_execution_condition_changed_now).length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unreviewed_self_modification_allowed: boundary.unreviewed_self_modification_allowed,
    self_modification_applied_now: boundary.self_modification_applied_now,
    hard_hook_enforced_now: boundary.hard_hook_enforced_now,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function signalReviewer(signalType) {
  if (signalType === "ASSISTANT_MISS" || signalType === "FAILED_VALIDATION") return "reviewer.claude_code_opus_max";
  if (signalType === "REVIEW_CONFLICT") return "reviewer.claude_code_opus_max";
  return "reviewer.platform_improvement_signal_owner";
}

function planTitle(signal) {
  const titles = {
    USER_CORRECTION: "Add explicit Conversation Source Queue and queue-first UI contract",
    ASSISTANT_MISS: "Require reviewed improvement signals before learning claims",
    REVIEW_CONFLICT: "Preserve single-owner lower-trust boundary",
    FAILED_VALIDATION: "Keep PASS ownership terms schema-checkable",
    REPEATED_CONTEXT_LOSS: "Require cited context recovery before future planning",
    BLOCKED_COMMAND: "Keep raw transcript body hidden until redaction review",
  };
  return titles[signal.signal_type] ?? "Review improvement signal";
}

function hookDescription(signal) {
  const descriptions = {
    USER_CORRECTION: "Block P4300 UI closeout when Conversation Source Queue is not the first surface.",
    ASSISTANT_MISS: "Block learning claims without reviewed improvement_signal_id and source_turn_ref.",
    REVIEW_CONFLICT: "Block enterprise trust claims when independent review evidence is absent.",
    FAILED_VALIDATION: "Block roadmap alignment when PASS owner terms are missing.",
    REPEATED_CONTEXT_LOSS: "Block planning start when context recovery bundle lacks citations.",
    BLOCKED_COMMAND: "Block raw transcript body display until redaction classification passes.",
  };
  return descriptions[signal.signal_type] ?? "Block unreviewed improvement signal adoption.";
}

function expectedEffect(signal) {
  const effects = {
    USER_CORRECTION: "Operator sees source and review queue before any dashboard summary.",
    ASSISTANT_MISS: "Future sessions cannot claim learning from apology or revised prose alone.",
    REVIEW_CONFLICT: "Single-owner work remains lower-trust until independent approval exists.",
    FAILED_VALIDATION: "Roadmap requirements stay machine-checkable instead of implied.",
    REPEATED_CONTEXT_LOSS: "Next planning turn starts from cited recovery bundles.",
    BLOCKED_COMMAND: "Transcript source material remains protected until redaction review.",
  };
  return effects[signal.signal_type] ?? "Improve future execution condition after review.";
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_improvement_signal.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Conversation Improvement Signal",
    "",
    `Status: ${result.summary.conversation_improvement_signal_status}`,
    `Program: ${result.summary.program_range}`,
    `Source plane: ${result.summary.source_plane_status}`,
    `Signals: ${result.summary.signal_count}`,
    `Signal types: ${result.summary.signal_type_count}`,
    `Plan candidates: ${result.summary.plan_amendment_candidate_count}`,
    `Hook candidates: ${result.summary.soft_rule_promotion_count}`,
    `Review packets: ${result.summary.review_packet_count}`,
    `Next-condition candidates: ${result.summary.next_condition_update_candidate_count}`,
    `Next-condition updates applied: ${result.summary.next_condition_update_applied_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Unreviewed self-modification allowed: ${result.summary.unreviewed_self_modification_allowed}`,
    `Runtime execution enabled: ${result.summary.runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Use these Claude-review-ready signal packets to prepare P4601-P5000 Development Control Console. This program does not rewrite policy, adopt plan changes, enforce hooks, inject next conditions, execute runtime, write files through an agent lane, complete protected closeout, or claim Work OS production readiness.",
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
  const defaults = DEFAULT_CONVERSATION_IMPROVEMENT_SIGNAL_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    principle_doc_path: options.principleDocPath ?? defaults.principleDocPath,
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
    principleDocPath: undefined,
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
    } else if (arg === "--principle-doc") {
      args.principleDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/conversation-improvement-signal.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --principle-doc <path>          Hue keynote operating loop document path.
  --help                          Show this help.
`);
}
