import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P31200_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage,
} from "./receipt-workbench-operator-queue-static-shell-implementation-handoff-package.mjs";

export const DEFAULT_AMBIGUOUS_REQUEST_INTAKE_OUT_DIR = "artifacts/ambiguous-request-intake/latest";
export const DEFAULT_AMBIGUOUS_REQUEST_INTAKE_INPUTS = {
  schemaPath: "schemas/ambiguous-request-intake.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p31201-p31600.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackagePath: "artifacts/receipt-workbench-operator-queue-static-shell-implementation-handoff-package/latest/receipt-workbench-operator-queue-static-shell-implementation-handoff-package.json",
};

const COMMAND_NAME = "platform:ambiguous-request-intake";
const SCHEMA_VERSION = "ambiguous-request-intake.v1";
const CAPABILITY_ID = "platform.ambiguous_request_intake";
const PROGRAM_RANGE = "P31201-P31600";
const SOURCE_PROGRAM_RANGE = "P30801-P31200";
const READY_STATUS = "ready_for_ambiguous_request_intake";
const BLOCK_PENDING_STATUS = "valid_block_ambiguous_request_intake_pending";
const BLOCKED_STATUS = "blocked_ambiguous_request_intake";

const PHASE_SPECS = [
  ["P31201-P31240", "P31200 Source Binding", "p31200_source_binding_rows"],
  ["P31241-P31300", "Ambiguous Request Intake", "ambiguous_request_intake_rows"],
  ["P31301-P31360", "Intent Parser", "intent_parser_rows"],
  ["P31361-P31440", "Task Type Registry", "task_type_registry_rows"],
  ["P31441-P31520", "Spec Schema Selector And Slot Clarity Scoring", "spec_schema_selector_rows"],
  ["P31521-P31570", "Ambiguity Threshold Policy", "ambiguity_threshold_policy_rows"],
  ["P31571-P31600", "P31600 Clean Checkpoint", "p31600_clean_checkpoint_rows"],
];

const TASK_TYPE_REGISTRY = [
  taskType("harness_tranche", "Hermes tranche, phase, or control-plane development", 0.2, "medium", ["objective", "scope", "non_scope", "outputs", "constraints", "validation_method", "authority_boundary", "success_criteria"]),
  taskType("software_feature", "General software feature implementation", 0.25, "medium", ["objective", "scope", "users", "inputs", "outputs", "constraints", "validation_method", "success_criteria", "authority_boundary"]),
  taskType("bug_fix", "Bug diagnosis or corrective code change", 0.25, "medium", ["objective", "inputs", "constraints", "reproduction", "validation_method", "success_criteria", "authority_boundary"]),
  taskType("document_drafting", "Document, report, or brief drafting", 0.45, "low", ["objective", "audience", "outputs", "tone", "inputs", "constraints", "success_criteria"]),
  taskType("research", "Research, comparison, or source-backed analysis", 0.2, "medium", ["objective", "scope", "timeframe", "sources", "outputs", "validation_method", "success_criteria"]),
  taskType("technical_specification", "Specification, schema, contract, or implementation plan drafting", 0.25, "medium", ["objective", "scope", "non_scope", "inputs", "outputs", "constraints", "validation_method", "authority_boundary", "success_criteria"]),
  taskType("workflow_automation", "Automation trigger, process, and exception design", 0.2, "high", ["objective", "trigger", "inputs", "outputs", "constraints", "exceptions", "logs", "authority_boundary", "validation_method"]),
  taskType("release_or_protected_action", "Release, deploy, approval, connector write, or protected action", 0.1, "high", ["objective", "scope", "authority_boundary", "approval_gate", "rollback", "validation_method", "success_criteria"]),
];

const SPEC_SLOTS = [
  slot("objective", 0.95, "What the work must accomplish"),
  slot("scope", 0.9, "What is included in the current work"),
  slot("non_scope", 0.75, "What is explicitly excluded"),
  slot("users", 0.55, "Who receives or uses the output"),
  slot("inputs", 0.65, "What source material or context is allowed"),
  slot("outputs", 0.85, "What artifact or behavior must be produced"),
  slot("constraints", 0.8, "Rules that must be preserved"),
  slot("assumptions", 0.45, "Defaults used when the user does not answer"),
  slot("dependencies", 0.55, "Other systems, data, or decisions required"),
  slot("success_criteria", 0.9, "What proves the work is acceptable"),
  slot("validation_method", 0.9, "How the output will be checked"),
  slot("risks", 0.8, "What could make the work unsafe or wrong"),
  slot("authority_boundary", 0.95, "Whether write, runtime, deploy, approval, or protected actions are allowed"),
  slot("priority", 0.6, "What matters most when tradeoffs appear"),
  slot("timeline", 0.35, "When or in what sequence the work should happen"),
];

const DEFAULT_PROMPT_SAMPLES = [
  {
    request_id: "prompt.current_goal",
    text: "Implement Hermes P31201-P31600 Ambiguous Request Intake, Intent Parser, Task Type Registry, Spec Schema Selector, Slot Clarity Scoring, Ambiguity Threshold Policy, and P31600 Clean Checkpoint",
    context_ref: "active_goal",
  },
  {
    request_id: "prompt.vague_feature",
    text: "Build a new feature",
    context_ref: "fixture.vague_feature",
  },
  {
    request_id: "prompt.protected_release",
    text: "Deploy this and approve the release now",
    context_ref: "fixture.protected_action",
  },
];

export const AMBIGUOUS_REQUEST_INTAKE_FALSE_FLAGS = [
  "ambiguous_request_intake_runtime_execution_allowed_now",
  "ambiguous_request_intake_write_action_allowed_now",
  "ambiguous_request_intake_protected_action_allowed_now",
  "ambiguous_request_intake_question_auto_send_allowed_now",
  "ambiguous_request_intake_answer_capture_allowed_now",
  "ambiguous_request_intake_seed_synthesis_allowed_now",
  "ambiguous_request_intake_seed_auto_apply_allowed_now",
  "ambiguous_request_intake_final_approval_allowed_now",
  "ambiguous_request_intake_production_pass_allowed_now",
  "ambiguous_request_intake_deployment_allowed_now",
  "ambiguous_request_intake_connector_write_allowed_now",
  "ambiguous_request_intake_raw_payload_exposure_allowed_now",
  "ambiguous_request_intake_secret_read_allowed_now",
  "ambiguous_request_intake_human_gate_bypass_allowed_now",
  "ambiguous_request_intake_independent_review_bypass_allowed_now",
  "ambiguous_request_intake_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...AMBIGUOUS_REQUEST_INTAKE_FALSE_FLAGS, ...P31200_FALSE_FLAGS])];

export async function runAmbiguousRequestIntake(options = {}) {
  const result = await buildAmbiguousRequestIntake(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Ambiguous Request Intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeAmbiguousRequestIntake(result, result.output_dir);
  return result;
}

export async function buildAmbiguousRequestIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AMBIGUOUS_REQUEST_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_static_shell_implementation_handoff_package", options.receiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage)
    : await readJsonOrBuildP31200(inputs.source_receipt_workbench_operator_queue_static_shell_implementation_handoff_package_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const promptSamples = normalizePromptSamples(options.promptSamples ?? DEFAULT_PROMPT_SAMPLES);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const intakeRows = buildAmbiguousRequestIntakeRows({ promptSamples, generatedAt });
  const intentRows = buildIntentParserRows({ intakeRows, generatedAt });
  const taskTypeRows = buildTaskTypeRegistryRows(generatedAt);
  const selectorRows = buildSpecSchemaSelectorRows({ intentRows, taskTypeRows, generatedAt });
  const clarityRows = buildSlotClarityScoringRows({ intakeRows, intentRows, selectorRows, generatedAt });
  const thresholdRows = buildAmbiguityThresholdPolicyRows({ intentRows, clarityRows, taskTypeRows, generatedAt });
  const boundaryRows = buildNoAuthorityBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, intakeRows, intentRows, taskTypeRows, selectorRows, clarityRows, thresholdRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, intakeRows, intentRows, taskTypeRows, selectorRows, clarityRows, thresholdRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, intakeRows, intentRows, taskTypeRows, selectorRows, clarityRows, thresholdRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_static_shell_implementation_handoff_package_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_static_shell_implementation_handoff_package_summary: source.data?.summary ?? null,
    ambiguous_request_intake_contract: buildContract(generatedAt),
    ambiguous_request_intake_phase_rows: phaseRows,
    p31200_source_binding_rows: sourceRows,
    ambiguous_request_intake_rows: intakeRows,
    intent_parser_rows: intentRows,
    task_type_registry_rows: taskTypeRows,
    spec_schema_selector_rows: selectorRows,
    slot_clarity_scoring_rows: clarityRows,
    ambiguity_threshold_policy_rows: thresholdRows,
    no_authority_boundary_rows: boundaryRows,
    p31600_clean_checkpoint_rows: checkpointRows,
    ambiguous_request_intake_boundary: boundary,
    ambiguous_request_intake_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "ambiguous_request_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.ambiguous_request_intake_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.ambiguous_request_intake_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeAmbiguousRequestIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "ambiguous-request-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p31200-source-binding-rows.json"), collectionEnvelope("p31200-source-binding-rows.v1", "p31200_source_binding_rows", result.p31200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "ambiguous-request-intake-rows.json"), collectionEnvelope("ambiguous-request-intake-rows.v1", "ambiguous_request_intake_rows", result.ambiguous_request_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "intent-parser-rows.json"), collectionEnvelope("intent-parser-rows.v1", "intent_parser_rows", result.intent_parser_rows, result.generated_at));
  await writeJson(path.join(outDir, "task-type-registry-rows.json"), collectionEnvelope("task-type-registry-rows.v1", "task_type_registry_rows", result.task_type_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "spec-schema-selector-rows.json"), collectionEnvelope("spec-schema-selector-rows.v1", "spec_schema_selector_rows", result.spec_schema_selector_rows, result.generated_at));
  await writeJson(path.join(outDir, "slot-clarity-scoring-rows.json"), collectionEnvelope("slot-clarity-scoring-rows.v1", "slot_clarity_scoring_rows", result.slot_clarity_scoring_rows, result.generated_at));
  await writeJson(path.join(outDir, "ambiguity-threshold-policy-rows.json"), collectionEnvelope("ambiguity-threshold-policy-rows.v1", "ambiguity_threshold_policy_rows", result.ambiguity_threshold_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-authority-boundary-rows.json"), collectionEnvelope("no-authority-boundary-rows.v1", "no_authority_boundary_rows", result.no_authority_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p31600-clean-checkpoint-rows.json"), collectionEnvelope("p31600-clean-checkpoint-rows.v1", "p31600_clean_checkpoint_rows", result.p31600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "ambiguous-request-intake-boundary.json"), result.ambiguous_request_intake_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runAmbiguousRequestIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runAmbiguousRequestIntake(args);
  console.log(`Ambiguous Request Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.ambiguous_request_intake_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P31200 ready for P31201 handoff: ${result.summary.source_p31200_ready_for_p31201_handoff}`);
  console.log(`Prompt samples: ${result.summary.prompt_sample_count}`);
  console.log(`Task types: ${result.summary.task_type_registry_count}`);
  console.log(`Slot scores: ${result.summary.slot_clarity_scoring_count}`);
  console.log(`Clarification required count: ${result.summary.clarification_required_count}`);
  console.log(`Ready for clarifying question engine: ${result.summary.ready_for_clarifying_question_engine}`);
  console.log(`Runtime allowed: ${result.summary.ambiguous_request_intake_runtime_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p31201_handoff === true,
    status: summary.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_status ?? "missing",
    p31200ContractReady: boundary.p31200_contract_ready === true,
    handoffPackageVisible: boundary.handoff_package_candidate_visible_now === true,
    manifestVisible: boundary.implementation_file_manifest_candidate_visible_now === true,
    smokePlanVisible: boundary.fixture_smoke_plan_candidate_visible_now === true,
    reviewerNoteVisible: boundary.reviewer_handoff_note_candidate_visible_now === true,
    noImplementationClosed: boundary.no_implementation_boundary_closed_now === true,
    boundaryClosed: P31200_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p31201-p31600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P31200 static shell implementation handoff package source is available", sourceState.available],
    ["program_range", "P31200 source program range is P30801-P31200", sourceState.programRangeOk],
    ["validation_valid", "P31200 source validation is valid", sourceState.validationValid],
    ["p31201_handoff_open", "P31200 source opened P31201 handoff", sourceState.sourceReady],
    ["p31200_contract_ready", "P31200 source contract is ready", sourceState.p31200ContractReady],
    ["handoff_package_visible", "P31200 handoff package rows are visible", sourceState.handoffPackageVisible],
    ["manifest_visible", "P31200 manifest rows are visible", sourceState.manifestVisible],
    ["smoke_plan_visible", "P31200 fixture/smoke plan rows are visible", sourceState.smokePlanVisible],
    ["reviewer_note_visible", "P31200 reviewer note rows are visible", sourceState.reviewerNoteVisible],
    ["no_implementation_closed", "P31200 no-implementation boundary is closed", sourceState.noImplementationClosed],
    ["commit_ref_present", "Current commit ref is present for ambiguous request intake", Boolean(commitRef)],
    ["source_blocker_visible", "P31200 source blocker is visible when ambiguity intake is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p31200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildAmbiguousRequestIntakeRows({ promptSamples, generatedAt }) {
  return promptSamples.map((sample, index) => {
    const text = String(sample.text ?? "");
    return row({
      row_id: `ambiguous_request_intake.${sample.request_id ?? index + 1}`,
      category: "ambiguous_request_intake",
      label: `Prompt source intake for ${sample.request_id ?? index + 1}`,
      observed: text.trim().length > 0,
      evidence_ref: sample.context_ref ?? "inline.prompt_sample",
      request_id: sample.request_id ?? `prompt.${index + 1}`,
      prompt_text_ref: `prompt_text_hash.${hashText(text)}`,
      prompt_text_preview: truncate(text, 160),
      raw_prompt_persisted: false,
      raw_prompt_exposed: false,
      source_context_ref: sample.context_ref ?? null,
      intake_metadata_only: true,
      execution_allowed_now: false,
      question_auto_send_allowed_now: false,
      seed_synthesis_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildIntentParserRows({ intakeRows, generatedAt }) {
  return intakeRows.map((intake) => {
    const text = intake.prompt_text_preview;
    const taskType = classifyTaskType(text);
    const targetObject = classifyTargetObject(text, taskType);
    const intentVerb = classifyIntentVerb(text);
    const constraintRefs = extractConstraints(text);
    const authorityRisk = classifyAuthorityRisk(text, taskType);
    return row({
      row_id: `intent_parser.${intake.request_id}`,
      category: "intent_parser",
      label: `Intent parser row for ${intake.request_id}`,
      observed: intake.current_verdict === "pass" && Boolean(taskType) && Boolean(intentVerb),
      evidence_ref: intake.row_id,
      request_id: intake.request_id,
      extracted_task_type: taskType,
      target_object: targetObject,
      intent_verb: intentVerb,
      constraint_refs: constraintRefs,
      authority_risk_tier: authorityRisk,
      protected_action_mentioned: authorityRisk === "high",
      parser_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildTaskTypeRegistryRows(generatedAt) {
  return TASK_TYPE_REGISTRY.map((item) => row({
    row_id: `task_type_registry.${item.task_type}`,
    category: "task_type_registry",
    label: item.description,
    observed: item.required_slots.length > 0 && item.allowed_ambiguity_threshold >= 0 && item.allowed_ambiguity_threshold <= 1,
    evidence_ref: "task_type_registry",
    ...item,
    generated_at: generatedAt,
  }));
}

function buildSpecSchemaSelectorRows({ intentRows, taskTypeRows, generatedAt }) {
  return intentRows.map((intent) => {
    const taskType = taskTypeRows.find((item) => item.task_type === intent.extracted_task_type) ?? taskTypeRows[0];
    return row({
      row_id: `spec_schema_selector.${intent.request_id}`,
      category: "spec_schema_selector",
      label: `Spec schema selector for ${intent.request_id}`,
      observed: intent.current_verdict === "pass" && Boolean(taskType),
      evidence_ref: intent.row_id,
      request_id: intent.request_id,
      selected_task_type: taskType?.task_type ?? "unknown",
      selected_schema_id: `spec_schema.${taskType?.task_type ?? "unknown"}.v1`,
      required_slots: taskType?.required_slots ?? [],
      slot_count: taskType?.required_slots?.length ?? 0,
      allowed_ambiguity_threshold: taskType?.allowed_ambiguity_threshold ?? 0.2,
      risk_tier: intent.authority_risk_tier === "high" ? "high" : taskType?.risk_tier ?? "medium",
      selector_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildSlotClarityScoringRows({ intakeRows, intentRows, selectorRows, generatedAt }) {
  const rows = [];
  for (const selector of selectorRows) {
    const intake = intakeRows.find((item) => item.request_id === selector.request_id);
    const intent = intentRows.find((item) => item.request_id === selector.request_id);
    for (const slotDef of SPEC_SLOTS) {
      const required = selector.required_slots.includes(slotDef.slot_id);
      const clarity = scoreSlotClarity({ slotId: slotDef.slot_id, text: intake?.prompt_text_preview ?? "", intent, required });
      rows.push(row({
        row_id: `slot_clarity.${selector.request_id}.${slotDef.slot_id}`,
        category: "slot_clarity_scoring",
        label: `Slot clarity for ${selector.request_id} ${slotDef.slot_id}`,
        observed: clarity >= 0 && clarity <= 1 && slotDef.weight > 0,
        evidence_ref: selector.row_id,
        request_id: selector.request_id,
        task_type: selector.selected_task_type,
        slot_id: slotDef.slot_id,
        slot_description: slotDef.description,
        required,
        clarity_score: clarity,
        slot_weight: slotDef.weight,
        weighted_contribution: round(clarity * slotDef.weight),
        missing_or_ambiguous: required && clarity < 0.75,
        default_available: defaultAvailableForSlot(slotDef.slot_id),
        score_metadata_only: true,
        generated_at: generatedAt,
      }));
    }
  }
  return rows;
}

function buildAmbiguityThresholdPolicyRows({ intentRows, clarityRows, taskTypeRows, generatedAt }) {
  return intentRows.map((intent) => {
    const taskType = taskTypeRows.find((item) => item.task_type === intent.extracted_task_type) ?? taskTypeRows[0];
    const rows = clarityRows.filter((item) => item.request_id === intent.request_id && item.required === true);
    const totalWeight = rows.reduce((sum, item) => sum + item.slot_weight, 0);
    const weightedScore = totalWeight === 0 ? 0 : rows.reduce((sum, item) => sum + item.weighted_contribution, 0) / totalWeight;
    const clarityScore = round(weightedScore);
    const ambiguityScore = round(1 - clarityScore);
    const highRisk = intent.authority_risk_tier === "high" || taskType?.risk_tier === "high";
    const threshold = highRisk ? Math.min(taskType?.allowed_ambiguity_threshold ?? 0.1, 0.1) : taskType?.allowed_ambiguity_threshold ?? 0.2;
    const missingRequiredSlots = rows.filter((item) => item.missing_or_ambiguous).map((item) => item.slot_id);
    const clarificationRequired = highRisk || ambiguityScore > threshold || missingRequiredSlots.length > 0;
    return row({
      row_id: `ambiguity_threshold_policy.${intent.request_id}`,
      category: "ambiguity_threshold_policy",
      label: `Ambiguity threshold policy for ${intent.request_id}`,
      observed: rows.length > 0 && clarityScore >= 0 && ambiguityScore >= 0,
      evidence_ref: intent.row_id,
      request_id: intent.request_id,
      task_type: intent.extracted_task_type,
      risk_tier: highRisk ? "high" : taskType?.risk_tier ?? "medium",
      clarity_score: clarityScore,
      ambiguity_score: ambiguityScore,
      allowed_ambiguity_threshold: threshold,
      missing_required_slots: missingRequiredSlots,
      clarification_required: clarificationRequired,
      direct_execution_candidate: !clarificationRequired,
      direct_execution_allowed_now: false,
      protected_action_mentioned: intent.protected_action_mentioned,
      policy_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoAuthorityBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_authority.${flag}`,
    category: "no_authority_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "ambiguous_request_intake_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.intakeRows)
    && allPass(context.intentRows)
    && allPass(context.taskTypeRows)
    && allPass(context.selectorRows)
    && allPass(context.clarityRows)
    && allPass(context.thresholdRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P31200 source is ready for P31201", context.sourceState.sourceReady],
    ["intake_visible", "Ambiguous request intake rows are visible", allPass(context.intakeRows)],
    ["intent_parser_visible", "Intent parser rows are visible", allPass(context.intentRows)],
    ["task_type_registry_visible", "Task type registry rows are visible", allPass(context.taskTypeRows)],
    ["spec_schema_selector_visible", "Spec schema selector rows are visible", allPass(context.selectorRows)],
    ["slot_clarity_visible", "Slot clarity scoring rows are visible", allPass(context.clarityRows)],
    ["ambiguity_threshold_visible", "Ambiguity threshold policy rows are visible", allPass(context.thresholdRows)],
    ["no_authority_boundary_closed", "No-authority boundary remains closed", allPass(context.boundaryRows)],
    ["clarifying_question_engine_gate", "Clarifying question engine handoff opens only when ambiguity intake metadata is valid", ready],
    ["clarifying_question_engine_blocker_visible", "Clarifying question engine blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p31600_checkpoint.${id}`,
    category: "p31600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p31600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p31600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.intakeRows)
    && allPass(context.intentRows)
    && allPass(context.taskTypeRows)
    && allPass(context.selectorRows)
    && allPass(context.clarityRows)
    && allPass(context.thresholdRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p31600_checkpoint.clarifying_question_engine_blocker_visible");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p31600ContractReady;
  const clarificationRequiredCount = context.thresholdRows.filter((item) => item.clarification_required).length;
  return {
    p31600_contract_ready: p31600ContractReady,
    ready_for_clarifying_question_engine: ready,
    source_p31200_ready_for_p31201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    ambiguous_request_intake_visible_now: allPass(context.intakeRows),
    intent_parser_visible_now: allPass(context.intentRows),
    task_type_registry_visible_now: allPass(context.taskTypeRows),
    spec_schema_selector_visible_now: allPass(context.selectorRows),
    slot_clarity_scoring_visible_now: allPass(context.clarityRows),
    ambiguity_threshold_policy_visible_now: allPass(context.thresholdRows),
    no_authority_boundary_closed_now: allPass(context.boundaryRows),
    prompt_sample_count: context.intakeRows.length,
    intent_parser_count: context.intentRows.length,
    task_type_registry_count: context.taskTypeRows.length,
    spec_schema_selector_count: context.selectorRows.length,
    slot_clarity_scoring_count: context.clarityRows.length,
    ambiguity_threshold_policy_count: context.thresholdRows.length,
    clarification_required_count: clarificationRequiredCount,
    direct_execution_candidate_count: context.thresholdRows.filter((item) => item.direct_execution_candidate).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P31201-P31600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P31201-P31600 Ambiguous Request Intake"), "Architecture doc missing P31201-P31600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P31200 source state is not visible"),
    validationItem("intake.visible", "ambiguous_request_intake", allPass(context.intakeRows), "Prompt intake rows are incomplete"),
    validationItem("intent.parser", "ambiguous_request_intake", allPass(context.intentRows), "Intent parser rows are incomplete"),
    validationItem("task.registry", "ambiguous_request_intake", allPass(context.taskTypeRows), "Task type registry rows are incomplete"),
    validationItem("schema.selector", "ambiguous_request_intake", allPass(context.selectorRows), "Spec schema selector rows are incomplete"),
    validationItem("slot.clarity", "ambiguous_request_intake", allPass(context.clarityRows), "Slot clarity scoring rows are incomplete"),
    validationItem("threshold.policy", "ambiguous_request_intake", allPass(context.thresholdRows), "Ambiguity threshold policy rows are incomplete"),
    validationItem("threshold.high_risk_requires_question", "authority", context.thresholdRows.filter((item) => item.risk_tier === "high").every((item) => item.clarification_required === true), "High-risk ambiguity can bypass clarification"),
    validationItem("boundary.no_authority", "authority", context.boundary.ambiguous_request_intake_runtime_execution_allowed_now === false && context.boundary.ambiguous_request_intake_seed_synthesis_allowed_now === false && context.boundary.ambiguous_request_intake_production_pass_allowed_now === false, "Ambiguity intake authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p31600_checkpoint.clarifying_question_engine_blocker_visible"), "P31600 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "ambiguous_request_intake.contract.v1",
    generated_at: generatedAt,
    source_p31200_required_or_rebuilt: true,
    ambiguous_request_intake_required: true,
    intent_parser_required: true,
    task_type_registry_required: true,
    spec_schema_selector_required: true,
    slot_clarity_scoring_required: true,
    ambiguity_threshold_policy_required: true,
    question_generation_deferred_to_p31601_p32000: true,
    answer_capture_deferred_to_p32001_p32400: true,
    seed_synthesis_deferred_to_p32401_p32800: true,
    p31600_is_not_runtime_write_question_send_answer_capture_seed_apply_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_clarifying_question_engine
    ? READY_STATUS
    : validation.valid && boundary.p31600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    ambiguous_request_intake_status: status,
    source_p31200_ready_for_p31201_handoff: boundary.source_p31200_ready_for_p31201_handoff,
    prompt_sample_count: boundary.prompt_sample_count,
    task_type_registry_count: boundary.task_type_registry_count,
    spec_schema_selector_count: boundary.spec_schema_selector_count,
    slot_clarity_scoring_count: boundary.slot_clarity_scoring_count,
    ambiguity_threshold_policy_count: boundary.ambiguity_threshold_policy_count,
    clarification_required_count: boundary.clarification_required_count,
    direct_execution_candidate_count: boundary.direct_execution_candidate_count,
    ready_for_clarifying_question_engine: validation.valid && boundary.ready_for_clarifying_question_engine,
    ambiguous_request_intake_runtime_execution_allowed_now: false,
    ambiguous_request_intake_write_action_allowed_now: false,
    ambiguous_request_intake_protected_action_allowed_now: false,
    ambiguous_request_intake_question_auto_send_allowed_now: false,
    ambiguous_request_intake_answer_capture_allowed_now: false,
    ambiguous_request_intake_seed_synthesis_allowed_now: false,
    ambiguous_request_intake_seed_auto_apply_allowed_now: false,
    ambiguous_request_intake_final_approval_allowed_now: false,
    ambiguous_request_intake_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Ambiguous Request Intake",
    "",
    `Status: ${result.summary.ambiguous_request_intake_status}`,
    `Program: ${result.program_range}`,
    `P31200 ready for P31201 handoff: ${result.summary.source_p31200_ready_for_p31201_handoff}`,
    `Prompt samples: ${result.summary.prompt_sample_count}`,
    `Task types: ${result.summary.task_type_registry_count}`,
    `Slot scores: ${result.summary.slot_clarity_scoring_count}`,
    `Clarification required count: ${result.summary.clarification_required_count}`,
    `Ready for clarifying question engine: ${result.summary.ready_for_clarifying_question_engine}`,
    `Runtime allowed: ${result.summary.ambiguous_request_intake_runtime_execution_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.ambiguity_threshold_policy_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.task_type)}</td><td>${escapeHtml(item.risk_tier)}</td><td>${escapeHtml(item.ambiguity_score)}</td><td>${escapeHtml(item.clarification_required)}</td><td>${escapeHtml(item.direct_execution_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Ambiguous Request Intake</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
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
    <h1>Hermes Ambiguous Request Intake</h1>
    <p class="notice">This artifact scores ambiguous request metadata only. It does not send questions, capture answers, synthesize seeds, execute runtime actions, write files, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Task Type</th><th>Risk</th><th>Ambiguity</th><th>Clarify</th><th>Execute</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP31200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_static_shell_implementation_handoff_package", built);
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
  const defaults = DEFAULT_AMBIGUOUS_REQUEST_INTAKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_static_shell_implementation_handoff_package_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackagePath ?? defaults.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackagePath),
  };
}

function normalizePromptSamples(samples) {
  return (Array.isArray(samples) && samples.length > 0 ? samples : DEFAULT_PROMPT_SAMPLES).map((sample, index) => ({
    request_id: sample.request_id ?? `prompt.${index + 1}`,
    text: String(sample.text ?? ""),
    context_ref: sample.context_ref ?? "inline.prompt_sample",
  }));
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
      args.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackagePath = argv[++index];
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
  console.log(`Usage: node scripts/ambiguous-request-intake.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P31201-P31600 Ambiguous Request Intake contract.
`);
}

function classifyTaskType(text) {
  const lowered = text.toLowerCase();
  if (/(deploy|release|approve|publish|production)/.test(lowered)) return "release_or_protected_action";
  if (/(hermes|phase|tranche|p\d{4,}|control-plane|harness)/.test(lowered)) return "harness_tranche";
  if (/(bug|fix|error|failure|regression)/.test(lowered)) return "bug_fix";
  if (/(research|compare|investigate|source|latest)/.test(lowered)) return "research";
  if (/(spec|schema|contract|plan|roadmap)/.test(lowered)) return "technical_specification";
  if (/(automation|automate|trigger|schedule|workflow)/.test(lowered)) return "workflow_automation";
  if (/(document|report|brief|draft|write)/.test(lowered)) return "document_drafting";
  return "software_feature";
}

function classifyTargetObject(text, taskType) {
  const lowered = text.toLowerCase();
  if (lowered.includes("hermes")) return "hermes_control_plane";
  if (lowered.includes("feature")) return "feature";
  if (lowered.includes("release")) return "release";
  if (lowered.includes("document") || lowered.includes("report")) return "document";
  return taskType;
}

function classifyIntentVerb(text) {
  const lowered = text.toLowerCase();
  if (/(implement|build|create|add)/.test(lowered)) return "implement";
  if (/(fix|repair|correct)/.test(lowered)) return "fix";
  if (/(review|check|audit)/.test(lowered)) return "review";
  if (/(deploy|release|approve|publish)/.test(lowered)) return "protected_action";
  if (/(research|compare|investigate)/.test(lowered)) return "research";
  return "clarify";
}

function extractConstraints(text) {
  const lowered = text.toLowerCase();
  const constraints = [];
  if (lowered.includes("no-write") || lowered.includes("read-only")) constraints.push("read_only_or_no_write");
  if (lowered.includes("existing")) constraints.push("preserve_existing_structure");
  if (lowered.includes("test") || lowered.includes("validate")) constraints.push("validation_expected");
  if (/(deploy|release|approve|publish)/.test(lowered)) constraints.push("protected_authority_present");
  if (/(phase|tranche|p\d{4,})/.test(lowered)) constraints.push("phase_range_present");
  return constraints;
}

function classifyAuthorityRisk(text, taskType) {
  const lowered = text.toLowerCase();
  if (/(deploy|release|approve|publish|secret|credential|connector write|production)/.test(lowered)) return "high";
  if (taskType === "workflow_automation") return "high";
  if (taskType === "harness_tranche" || taskType === "software_feature" || taskType === "bug_fix") return "medium";
  return "low";
}

function scoreSlotClarity({ slotId, text, intent, required }) {
  const lowered = text.toLowerCase();
  let score = required ? 0.25 : 0.5;
  if (slotId === "objective" && (intent?.intent_verb === "implement" || intent?.intent_verb === "fix" || intent?.intent_verb === "research")) score = 0.85;
  if (slotId === "scope" && /(p\d{4,}|phase|tranche|only|current|this)/.test(lowered)) score = 0.85;
  if (slotId === "non_scope" && /(not|no |without|read-only|no-write|closed|boundary)/.test(lowered)) score = 0.75;
  if (slotId === "users" && /(user|operator|reviewer|developer|owner)/.test(lowered)) score = 0.75;
  if (slotId === "inputs" && /(source|prompt|attached|context|evidence|schema)/.test(lowered)) score = 0.75;
  if (slotId === "outputs" && /(contract|schema|test|checkpoint|report|document|brief|rows|policy)/.test(lowered)) score = 0.85;
  if (slotId === "constraints" && /(preserve|keep|must|closed|no-|boundary|without)/.test(lowered)) score = 0.8;
  if (slotId === "assumptions" && /(default|assume|if not|unless)/.test(lowered)) score = 0.75;
  if (slotId === "dependencies" && /(depends|source|after|from|p\d{4,})/.test(lowered)) score = 0.75;
  if (slotId === "success_criteria" && /(complete|checkpoint|ready|pass|validation|clean)/.test(lowered)) score = 0.8;
  if (slotId === "validation_method" && /(test|validate|check|schema)/.test(lowered)) score = 0.85;
  if (slotId === "risks" && /(risk|unsafe|protected|deploy|approve|secret|production)/.test(lowered)) score = 0.8;
  if (slotId === "authority_boundary" && /(deploy|approve|release|write|runtime|protected|production|closed|no-write)/.test(lowered)) score = 1;
  if (slotId === "priority" && /(first|next|priority|start|begin)/.test(lowered)) score = 0.7;
  if (slotId === "timeline" && /(today|tomorrow|now|next|p\d{4,}|phase)/.test(lowered)) score = 0.65;
  return quantizeClarityScore(score);
}

function defaultAvailableForSlot(slotId) {
  return ["non_scope", "assumptions", "priority", "timeline"].includes(slotId);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function taskType(task_type, description, allowed_ambiguity_threshold, risk_tier, required_slots) {
  return { task_type, description, allowed_ambiguity_threshold, risk_tier, required_slots };
}

function slot(slot_id, weight, description) {
  return { slot_id, weight, description };
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

function hashText(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(16);
}

function truncate(value, maxLength) {
  const text = String(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function quantizeClarityScore(value) {
  const bounded = Math.min(1, Math.max(0, Number(value)));
  if (bounded >= 0.875) return 1;
  if (bounded >= 0.625) return 0.75;
  if (bounded >= 0.375) return 0.5;
  if (bounded >= 0.125) return 0.25;
  return 0;
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
