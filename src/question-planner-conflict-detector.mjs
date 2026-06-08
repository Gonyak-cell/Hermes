import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P31600_FALSE_FLAGS,
  buildAmbiguousRequestIntake,
} from "./ambiguous-request-intake.mjs";

export const DEFAULT_QUESTION_PLANNER_CONFLICT_DETECTOR_OUT_DIR = "artifacts/question-planner-conflict-detector/latest";
export const DEFAULT_QUESTION_PLANNER_CONFLICT_DETECTOR_INPUTS = {
  schemaPath: "schemas/question-planner-conflict-detector.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p31601-p32000.md",
  architectureDocPath: "docs/architecture.md",
  sourceAmbiguousRequestIntakePath: "artifacts/ambiguous-request-intake/latest/ambiguous-request-intake.json",
};

const COMMAND_NAME = "platform:question-planner-conflict-detector";
const SCHEMA_VERSION = "question-planner-conflict-detector.v1";
const CAPABILITY_ID = "platform.question_planner_conflict_detector";
const PROGRAM_RANGE = "P31601-P32000";
const SOURCE_PROGRAM_RANGE = "P31201-P31600";
const READY_STATUS = "ready_for_question_planner_conflict_detector";
const BLOCK_PENDING_STATUS = "valid_block_question_planner_conflict_detector_pending";
const BLOCKED_STATUS = "blocked_question_planner_conflict_detector";

const PHASE_SPECS = [
  ["P31601-P31640", "P31600 Source Binding", "p31600_source_binding_rows"],
  ["P31641-P31720", "Question Planner", "question_planner_rows"],
  ["P31721-P31800", "Conflict Detector", "question_conflict_detector_rows"],
  ["P31801-P31880", "Clarification Bundle", "clarification_bundle_rows"],
  ["P31881-P31940", "Question Priority Policy", "question_priority_policy_rows"],
  ["P31941-P31980", "No-Auto-Question Boundary", "no_auto_question_boundary_rows"],
  ["P31981-P32000", "P32000 Clean Checkpoint", "p32000_clean_checkpoint_rows"],
];

const SLOT_QUESTION_TEMPLATES = {
  objective: "What exact outcome should this request achieve?",
  scope: "What is included in this tranche, and what should stay outside it?",
  non_scope: "What must explicitly remain out of scope?",
  users: "Who is the primary operator or reviewer for this output?",
  inputs: "Which sources or artifacts may Hermes use for this request?",
  outputs: "What concrete artifact, state, or behavior should be produced?",
  constraints: "Which existing boundaries, contracts, or style rules must be preserved?",
  assumptions: "Which default assumption may Hermes use if the user does not answer?",
  dependencies: "Which prior phase, file, or external state does this depend on?",
  success_criteria: "What evidence proves this request is complete?",
  validation_method: "Which command, fixture, or review lane should validate the result?",
  risks: "What could make this request unsafe or misleading?",
  authority_boundary: "Are runtime, write, deploy, approval, or protected actions allowed?",
  priority: "What tradeoff should Hermes prefer if the request is underspecified?",
  timeline: "What sequence or deadline should shape the work?",
};

export const QUESTION_PLANNER_CONFLICT_DETECTOR_FALSE_FLAGS = [
  "question_planner_auto_question_send_allowed_now",
  "question_planner_answer_capture_allowed_now",
  "question_planner_seed_synthesis_allowed_now",
  "question_planner_seed_auto_apply_allowed_now",
  "question_planner_runtime_execution_allowed_now",
  "question_planner_write_action_allowed_now",
  "question_planner_protected_action_allowed_now",
  "question_planner_connector_write_allowed_now",
  "question_planner_deployment_allowed_now",
  "question_planner_review_completion_allowed_now",
  "question_planner_final_approval_allowed_now",
  "question_planner_production_pass_allowed_now",
  "question_planner_enterprise_trust_claim_allowed_now",
  "question_planner_raw_prompt_exposure_allowed_now",
  "question_planner_secret_read_allowed_now",
  "question_planner_human_gate_bypass_allowed_now",
  "question_planner_independent_review_bypass_allowed_now",
  "question_planner_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...QUESTION_PLANNER_CONFLICT_DETECTOR_FALSE_FLAGS, ...P31600_FALSE_FLAGS])];

export async function runQuestionPlannerConflictDetector(options = {}) {
  const result = await buildQuestionPlannerConflictDetector(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Question Planner Conflict Detector failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeQuestionPlannerConflictDetector(result, result.output_dir);
  return result;
}

export async function buildQuestionPlannerConflictDetector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_QUESTION_PLANNER_CONFLICT_DETECTOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "ambiguousRequestIntake")
    ? normalizeInlineJsonSource("inline.ambiguous_request_intake", options.ambiguousRequestIntake)
    : await readJsonOrBuildP31600(inputs.source_ambiguous_request_intake_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const questionRows = buildQuestionPlannerRows({ source, generatedAt });
  const conflictRows = buildQuestionConflictDetectorRows({ source, questionRows, generatedAt });
  const bundleRows = buildClarificationBundleRows({ questionRows, conflictRows, generatedAt });
  const priorityRows = buildQuestionPriorityPolicyRows({ questionRows, conflictRows, generatedAt });
  const boundaryRows = buildNoAutoQuestionBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, questionRows, conflictRows, bundleRows, priorityRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, questionRows, conflictRows, bundleRows, priorityRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, questionRows, conflictRows, bundleRows, priorityRows, boundaryRows, checkpointRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      ambiguous_request_intake_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_ambiguous_request_intake_summary: source.data?.summary ?? null,
    question_planner_conflict_detector_contract: buildContract(generatedAt),
    question_planner_conflict_detector_phase_rows: phaseRows,
    p31600_source_binding_rows: sourceRows,
    question_planner_rows: questionRows,
    question_conflict_detector_rows: conflictRows,
    clarification_bundle_rows: bundleRows,
    question_priority_policy_rows: priorityRows,
    no_auto_question_boundary_rows: boundaryRows,
    p32000_clean_checkpoint_rows: checkpointRows,
    question_planner_conflict_detector_boundary: boundary,
    question_planner_conflict_detector_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "question_planner_conflict_detector")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.question_planner_conflict_detector_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.question_planner_conflict_detector_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeQuestionPlannerConflictDetector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "question-planner-conflict-detector.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p31600-source-binding-rows.json"), collectionEnvelope("p31600-source-binding-rows.v1", "p31600_source_binding_rows", result.p31600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "question-planner-rows.json"), collectionEnvelope("question-planner-rows.v1", "question_planner_rows", result.question_planner_rows, result.generated_at));
  await writeJson(path.join(outDir, "question-conflict-detector-rows.json"), collectionEnvelope("question-conflict-detector-rows.v1", "question_conflict_detector_rows", result.question_conflict_detector_rows, result.generated_at));
  await writeJson(path.join(outDir, "clarification-bundle-rows.json"), collectionEnvelope("clarification-bundle-rows.v1", "clarification_bundle_rows", result.clarification_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "question-priority-policy-rows.json"), collectionEnvelope("question-priority-policy-rows.v1", "question_priority_policy_rows", result.question_priority_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-auto-question-boundary-rows.json"), collectionEnvelope("no-auto-question-boundary-rows.v1", "no_auto_question_boundary_rows", result.no_auto_question_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p32000-clean-checkpoint-rows.json"), collectionEnvelope("p32000-clean-checkpoint-rows.v1", "p32000_clean_checkpoint_rows", result.p32000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "question-planner-conflict-detector-boundary.json"), result.question_planner_conflict_detector_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runQuestionPlannerConflictDetectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runQuestionPlannerConflictDetector(args);
  console.log(`Question Planner Conflict Detector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.question_planner_conflict_detector_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P31600 ready for question planner: ${result.summary.source_p31600_ready_for_question_planner}`);
  console.log(`Question candidates: ${result.summary.question_candidate_count}`);
  console.log(`Conflict detector rows: ${result.summary.conflict_detector_count}`);
  console.log(`Clarification bundles: ${result.summary.clarification_bundle_count}`);
  console.log(`High priority question count: ${result.summary.high_priority_question_count}`);
  console.log(`Ready for answer capture state machine: ${result.summary.ready_for_answer_capture_state_machine}`);
  console.log(`Auto question send allowed: ${result.summary.question_planner_auto_question_send_allowed_now}`);
  console.log(`Answer capture allowed: ${result.summary.question_planner_answer_capture_allowed_now}`);
  console.log(`Runtime allowed: ${result.summary.question_planner_runtime_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.ambiguous_request_intake_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_clarifying_question_engine === true,
    status: summary.ambiguous_request_intake_status ?? "missing",
    p31600ContractReady: boundary.p31600_contract_ready === true,
    intakeVisible: boundary.ambiguous_request_intake_visible_now === true,
    intentParserVisible: boundary.intent_parser_visible_now === true,
    taskTypeRegistryVisible: boundary.task_type_registry_visible_now === true,
    selectorVisible: boundary.spec_schema_selector_visible_now === true,
    slotClarityVisible: boundary.slot_clarity_scoring_visible_now === true,
    thresholdPolicyVisible: boundary.ambiguity_threshold_policy_visible_now === true,
    noAuthorityClosed: boundary.no_authority_boundary_closed_now === true,
    boundaryClosed: P31600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p31601-p32000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P31600 ambiguous request intake source is available", sourceState.available],
    ["program_range", "P31600 source program range is P31201-P31600", sourceState.programRangeOk],
    ["validation_valid", "P31600 source validation is valid", sourceState.validationValid],
    ["question_planner_handoff_open", "P31600 opened clarifying question engine handoff", sourceState.sourceReady],
    ["p31600_contract_ready", "P31600 source contract is ready", sourceState.p31600ContractReady],
    ["intake_visible", "P31600 prompt intake rows are visible", sourceState.intakeVisible],
    ["intent_parser_visible", "P31600 intent parser rows are visible", sourceState.intentParserVisible],
    ["task_type_registry_visible", "P31600 task type registry rows are visible", sourceState.taskTypeRegistryVisible],
    ["spec_schema_selector_visible", "P31600 spec selector rows are visible", sourceState.selectorVisible],
    ["slot_clarity_visible", "P31600 slot clarity rows are visible", sourceState.slotClarityVisible],
    ["threshold_policy_visible", "P31600 ambiguity threshold rows are visible", sourceState.thresholdPolicyVisible],
    ["no_authority_boundary_closed", "P31600 no-authority boundary is closed", sourceState.noAuthorityClosed],
    ["commit_ref_present", "Current commit ref is present for question planner", Boolean(commitRef)],
    ["source_blocker_visible", "P31600 source blocker is visible when question planning is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p31600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildQuestionPlannerRows({ source, generatedAt }) {
  const thresholdRows = source.data?.ambiguity_threshold_policy_rows ?? [];
  const clarityRows = source.data?.slot_clarity_scoring_rows ?? [];
  const questions = [];
  for (const threshold of thresholdRows) {
    const missingSlots = Array.isArray(threshold.missing_required_slots) && threshold.missing_required_slots.length > 0
      ? threshold.missing_required_slots
      : threshold.clarification_required
        ? ["objective"]
        : [];
    const selectedSlots = prioritizeSlots(missingSlots, threshold.risk_tier).slice(0, 4);
    for (const slotId of selectedSlots) {
      const clarity = clarityRows.find((item) => item.request_id === threshold.request_id && item.slot_id === slotId);
      const riskWeight = threshold.risk_tier === "high" ? 3 : threshold.risk_tier === "medium" ? 2 : 1;
      const clarityGap = Math.max(0, 1 - Number(clarity?.clarity_score ?? 0.25));
      questions.push(row({
        row_id: `question_planner.${threshold.request_id}.${slotId}`,
        category: "question_planner",
        label: `Clarifying question candidate for ${threshold.request_id} ${slotId}`,
        observed: Boolean(threshold.request_id && slotId),
        evidence_ref: threshold.row_id,
        request_id: threshold.request_id,
        task_type: threshold.task_type,
        risk_tier: threshold.risk_tier,
        slot_id: slotId,
        question_text: SLOT_QUESTION_TEMPLATES[slotId] ?? `Clarify ${slotId}.`,
        question_text_ref: `question_template.${slotId}`,
        priority_basis: {
          risk_weight: riskWeight,
          clarity_gap: round(clarityGap),
          protected_action_mentioned: threshold.protected_action_mentioned === true,
        },
        source_ambiguity_score: threshold.ambiguity_score,
        source_clarity_score: clarity?.clarity_score ?? null,
        source_prompt_text_ref_only: true,
        question_metadata_only: true,
        question_auto_send_allowed_now: false,
        answer_capture_allowed_now: false,
        seed_synthesis_allowed_now: false,
        direct_execution_allowed_now: false,
        generated_at: generatedAt,
      }));
    }
  }
  return questions;
}

function buildQuestionConflictDetectorRows({ source, questionRows, generatedAt }) {
  const thresholdRows = source.data?.ambiguity_threshold_policy_rows ?? [];
  return thresholdRows.map((threshold) => {
    const questions = questionRows.filter((item) => item.request_id === threshold.request_id);
    const conflicts = [];
    if (threshold.protected_action_mentioned === true) conflicts.push("protected_action_requires_authority_boundary_question");
    if (threshold.risk_tier === "high") conflicts.push("high_risk_requires_review_boundary_question");
    if (Array.isArray(threshold.missing_required_slots) && threshold.missing_required_slots.includes("authority_boundary")) conflicts.push("authority_boundary_missing");
    if (Number(threshold.ambiguity_score ?? 0) > Number(threshold.allowed_ambiguity_threshold ?? 0)) conflicts.push("ambiguity_exceeds_threshold");
    if (questions.length === 0 && threshold.clarification_required === true) conflicts.push("clarification_required_but_no_question_candidate");
    return row({
      row_id: `question_conflict_detector.${threshold.request_id}`,
      category: "question_conflict_detector",
      label: `Conflict detector row for ${threshold.request_id}`,
      observed: Boolean(threshold.request_id),
      evidence_ref: threshold.row_id,
      request_id: threshold.request_id,
      task_type: threshold.task_type,
      risk_tier: threshold.risk_tier,
      conflict_present: conflicts.length > 0,
      conflict_refs: conflicts,
      conflict_count: conflicts.length,
      protected_action_mentioned: threshold.protected_action_mentioned === true,
      clarification_required: threshold.clarification_required === true,
      direct_execution_allowed_now: false,
      question_auto_send_allowed_now: false,
      detector_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildClarificationBundleRows({ questionRows, conflictRows, generatedAt }) {
  const requestIds = [...new Set(questionRows.map((item) => item.request_id))];
  return requestIds.map((requestId) => {
    const questions = questionRows.filter((item) => item.request_id === requestId);
    const conflict = conflictRows.find((item) => item.request_id === requestId);
    return row({
      row_id: `clarification_bundle.${requestId}`,
      category: "clarification_bundle",
      label: `Clarification bundle for ${requestId}`,
      observed: questions.length > 0,
      evidence_ref: conflict?.row_id ?? questions[0]?.row_id ?? "question_planner_rows",
      request_id: requestId,
      question_ids: questions.map((item) => item.row_id),
      question_count: questions.length,
      conflict_refs: conflict?.conflict_refs ?? [],
      bundle_requires_user_answer: true,
      bundle_auto_send_allowed_now: false,
      answer_capture_allowed_now: false,
      raw_prompt_exposed: false,
      bundle_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildQuestionPriorityPolicyRows({ questionRows, conflictRows, generatedAt }) {
  return questionRows.map((question) => {
    const conflict = conflictRows.find((item) => item.request_id === question.request_id);
    const riskScore = question.risk_tier === "high" ? 60 : question.risk_tier === "medium" ? 40 : 20;
    const gapScore = Math.round(Number(question.priority_basis?.clarity_gap ?? 0) * 30);
    const conflictScore = Math.min(10, Number(conflict?.conflict_count ?? 0) * 3);
    const priorityScore = Math.min(100, riskScore + gapScore + conflictScore);
    return row({
      row_id: `question_priority_policy.${question.request_id}.${question.slot_id}`,
      category: "question_priority_policy",
      label: `Priority policy for ${question.request_id} ${question.slot_id}`,
      observed: priorityScore >= 0 && priorityScore <= 100,
      evidence_ref: question.row_id,
      request_id: question.request_id,
      slot_id: question.slot_id,
      risk_tier: question.risk_tier,
      priority_score: priorityScore,
      priority_band: priorityScore >= 75 ? "high" : priorityScore >= 45 ? "medium" : "low",
      ask_order_hint: priorityScore >= 75 ? "ask_first" : "ask_after_high_priority",
      auto_send_allowed_now: false,
      answer_capture_allowed_now: false,
      policy_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoAutoQuestionBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_auto_question.${flag}`,
    category: "no_auto_question_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "question_planner_conflict_detector_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.questionRows)
    && allPass(context.conflictRows)
    && allPass(context.bundleRows)
    && allPass(context.priorityRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P31600 source is ready for question planning", context.sourceState.sourceReady],
    ["question_planner_visible", "Question planner rows are visible", allPass(context.questionRows)],
    ["conflict_detector_visible", "Question conflict detector rows are visible", allPass(context.conflictRows)],
    ["clarification_bundle_visible", "Clarification bundle rows are visible", allPass(context.bundleRows)],
    ["priority_policy_visible", "Question priority policy rows are visible", allPass(context.priorityRows)],
    ["no_auto_question_boundary_closed", "No-auto-question boundary remains closed", allPass(context.boundaryRows)],
    ["answer_capture_state_machine_gate", "Answer capture state machine handoff opens only when question plan metadata is valid", ready],
    ["answer_capture_state_machine_blocker_visible", "Answer capture state machine blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p32000_checkpoint.${id}`,
    category: "p32000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p32000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p32000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.questionRows)
    && allPass(context.conflictRows)
    && allPass(context.bundleRows)
    && allPass(context.priorityRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p32000_checkpoint.answer_capture_state_machine_blocker_visible");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p32000ContractReady;
  return {
    p32000_contract_ready: p32000ContractReady,
    ready_for_answer_capture_state_machine: ready,
    source_p31600_ready_for_question_planner: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    question_planner_visible_now: allPass(context.questionRows),
    question_conflict_detector_visible_now: allPass(context.conflictRows),
    clarification_bundle_visible_now: allPass(context.bundleRows),
    question_priority_policy_visible_now: allPass(context.priorityRows),
    no_auto_question_boundary_closed_now: allPass(context.boundaryRows),
    question_candidate_count: context.questionRows.length,
    conflict_detector_count: context.conflictRows.length,
    conflict_present_count: context.conflictRows.filter((item) => item.conflict_present === true).length,
    clarification_bundle_count: context.bundleRows.length,
    high_priority_question_count: context.priorityRows.filter((item) => item.priority_band === "high").length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P31601-P32000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P31601-P32000 Question Planner and Conflict Detector"), "Architecture doc missing P31601-P32000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P31600 source state is not visible"),
    validationItem("questions.visible", "question_planner", allPass(context.questionRows), "Question planner rows are incomplete"),
    validationItem("conflicts.visible", "question_planner", allPass(context.conflictRows), "Question conflict detector rows are incomplete"),
    validationItem("bundles.visible", "question_planner", allPass(context.bundleRows), "Clarification bundle rows are incomplete"),
    validationItem("priority.visible", "question_planner", allPass(context.priorityRows), "Question priority policy rows are incomplete"),
    validationItem("high_risk.has_conflict", "authority", context.conflictRows.filter((item) => item.risk_tier === "high").every((item) => item.conflict_present === true), "High-risk request has no conflict marker"),
    validationItem("question.no_auto_send", "authority", context.questionRows.every((item) => item.question_auto_send_allowed_now === false), "Question planner can auto-send questions"),
    validationItem("answer.capture.closed", "authority", context.bundleRows.every((item) => item.answer_capture_allowed_now === false), "Answer capture opened inside question planner"),
    validationItem("boundary.no_auto_question", "authority", context.boundary.question_planner_auto_question_send_allowed_now === false && context.boundary.question_planner_answer_capture_allowed_now === false && context.boundary.question_planner_seed_synthesis_allowed_now === false, "Question planner authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p32000_checkpoint.answer_capture_state_machine_blocker_visible"), "P32000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "question_planner_conflict_detector.contract.v1",
    generated_at: generatedAt,
    source_p31600_required_or_rebuilt: true,
    question_planner_required: true,
    conflict_detector_required: true,
    clarification_bundle_required: true,
    priority_policy_required: true,
    no_auto_question_boundary_required: true,
    answer_capture_deferred_to_p32001_p32400: true,
    seed_synthesis_deferred_to_p32401_p32800: true,
    p32000_is_not_question_send_answer_capture_seed_synthesis_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_answer_capture_state_machine
    ? READY_STATUS
    : validation.valid && boundary.p32000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    question_planner_conflict_detector_status: status,
    source_p31600_ready_for_question_planner: boundary.source_p31600_ready_for_question_planner,
    question_candidate_count: boundary.question_candidate_count,
    conflict_detector_count: boundary.conflict_detector_count,
    conflict_present_count: boundary.conflict_present_count,
    clarification_bundle_count: boundary.clarification_bundle_count,
    high_priority_question_count: boundary.high_priority_question_count,
    ready_for_answer_capture_state_machine: validation.valid && boundary.ready_for_answer_capture_state_machine,
    question_planner_auto_question_send_allowed_now: false,
    question_planner_answer_capture_allowed_now: false,
    question_planner_seed_synthesis_allowed_now: false,
    question_planner_runtime_execution_allowed_now: false,
    question_planner_write_action_allowed_now: false,
    question_planner_protected_action_allowed_now: false,
    question_planner_final_approval_allowed_now: false,
    question_planner_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Question Planner Conflict Detector",
    "",
    `Status: ${result.summary.question_planner_conflict_detector_status}`,
    `Program: ${result.program_range}`,
    `P31600 ready for question planner: ${result.summary.source_p31600_ready_for_question_planner}`,
    `Question candidates: ${result.summary.question_candidate_count}`,
    `Conflict detector rows: ${result.summary.conflict_detector_count}`,
    `Clarification bundles: ${result.summary.clarification_bundle_count}`,
    `High priority question count: ${result.summary.high_priority_question_count}`,
    `Ready for answer capture state machine: ${result.summary.ready_for_answer_capture_state_machine}`,
    `Auto question send allowed: ${result.summary.question_planner_auto_question_send_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.question_priority_policy_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.slot_id)}</td><td>${escapeHtml(item.risk_tier)}</td><td>${escapeHtml(item.priority_score)}</td><td>${escapeHtml(item.priority_band)}</td><td>${escapeHtml(item.auto_send_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Question Planner Conflict Detector</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Question Planner Conflict Detector</h1>
    <p class="notice">This artifact plans clarifying questions and conflict metadata only. It does not send questions, capture answers, synthesize seeds, execute runtime actions, write files, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Slot</th><th>Risk</th><th>Priority</th><th>Band</th><th>Auto Send</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP31600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildAmbiguousRequestIntake({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.ambiguous_request_intake", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, text: JSON.stringify(value), data: value };
  return { path: label, available: false, text: "", data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_QUESTION_PLANNER_CONFLICT_DETECTOR_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_ambiguous_request_intake_path: path.resolve(repoRoot, options.sourceAmbiguousRequestIntakePath ?? defaults.sourceAmbiguousRequestIntakePath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceAmbiguousRequestIntakePath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/question-planner-conflict-detector.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P31601-P32000 Question Planner and Conflict Detector contract.
`);
}

function prioritizeSlots(slotIds, riskTier) {
  const order = riskTier === "high"
    ? ["authority_boundary", "risks", "validation_method", "rollback", "success_criteria", "scope", "objective", "outputs"]
    : ["objective", "scope", "outputs", "constraints", "validation_method", "success_criteria", "authority_boundary", "inputs", "non_scope"];
  return [...new Set([...order.filter((slotId) => slotIds.includes(slotId)), ...slotIds])];
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  const item = rows.find((rowItem) => rowItem.row_id === rowId);
  return Boolean(item && (item.current_verdict === "pass" || item.visible_now === true || item.observed === true));
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.current_verdict !== "pass")
    .map((item) => ({ row_id: item.row_id, category: item.category, message: item.failure_message ?? item.block_reason ?? "Validation item failed" }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function hasScript(packageData, scriptName) {
  return Boolean(packageData?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, rows };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function row(fields) {
  const observed = fields.observed === true;
  return {
    ...fields,
    observed,
    current_verdict: observed ? "pass" : "block",
    block_reason: observed ? null : `${fields.row_id} not satisfied`,
  };
}

function validationItem(id, category, observed, failureMessage) {
  return row({
    row_id: `validation.${id}`,
    category,
    label: id,
    observed,
    evidence_ref: id,
    failure_message: observed ? null : failureMessage,
    generated_at: new Date(0).toISOString(),
  });
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
