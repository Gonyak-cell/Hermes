import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildConversationSourcePlane } from "./conversation-source-plane.mjs";
import { buildConversationImprovementSignal } from "./conversation-improvement-signal.mjs";

export const DEFAULT_DEVELOPMENT_CONTROL_CONSOLE_OUT_DIR = "artifacts/development-control-console/latest";
export const DEFAULT_DEVELOPMENT_CONTROL_CONSOLE_INPUTS = {
  schemaPath: "schemas/development-control-console.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:development-control-console";
const SOURCE_COMMAND_NAME = "platform:conversation-source-plane";
const IMPROVEMENT_COMMAND_NAME = "platform:conversation-improvement-signal";
const SCHEMA_VERSION = "development-control-console.v1";
const CAPABILITY_ID = "platform.development_control_console";
const PROGRAM_RANGE = "P4601-P5000";
const READY_STATUS = "ready_for_development_control_console_v0";
const SOURCE_READY_STATUS = "ready_for_conversation_source_plane_v0";
const IMPROVEMENT_READY_STATUS = "ready_for_conversation_improvement_signal_freeze";

const PHASE_SPECS = [
  ["P4601-P4640", "Plan Registry"],
  ["P4641-P4680", "Goal Cards and Engine Role Setup"],
  ["P4681-P4720", "Phase Progress Board"],
  ["P4721-P4760", "Gate and Evidence Cards"],
  ["P4761-P4800", "Review Process Lane"],
  ["P4801-P4840", "Transcript and Source Links"],
  ["P4841-P4880", "Next Action Queue"],
  ["P4881-P4920", "Milestone Claude Review Packet"],
  ["P4921-P4960", "Single-Owner Trust Classification"],
  ["P4961-P5000", "Console Freeze"],
];

const ROADMAP_PROGRAMS = [
  ["P4001-P4300", "Local Conversation and Session Archive Foundation"],
  ["P4301-P4600", "Conversation Improvement Signal Mining"],
  ["P4601-P5000", "Development Control Console and Jira-Inspired Evidence UI"],
  ["P5001-P5400", "Verification Orchestration Runtime"],
  ["P5401-P5800", "Multi-Engine Orchestration and Cross-Model QA"],
  ["P5801-P6200", "Review and Enterprise Trust Hardening"],
  ["P6201-P6600", "Product and Domain SaaS Factory"],
  ["P6601-P7000", "Controlled Execution Write and Deploy"],
  ["P7001-P7300", "Memory Bank Storage Event and Observability Plane"],
  ["P7301-P7600", "Retrieval Ontology and Context Recall Layer"],
  ["P7601-P7800", "Security Governance Compliance and Rule Conflict Plane"],
  ["P7801-P8000", "Full Work OS UI and Production Freeze"],
];

const MILESTONE_RANGES = [
  "P5000",
  "P5400",
  "P5800",
  "P6200",
  "P6600",
  "P7000",
  "P7300",
  "P7600",
  "P7800",
  "P8000",
];

const REQUIRED_COMPONENTS = [
  "PlanRegistryRow",
  "GoalCard",
  "EngineRoleBadge",
  "PhaseStatusLane",
  "GateCard",
  "EvidenceCard",
  "ReviewProcessLane",
  "ClaudeReviewReceiptCard",
  "TranscriptSourceLink",
  "NextActionCard",
  "TrustTierBadge",
  "SingleOwnerBoundaryNotice",
  "MilestoneReviewPacketRow",
];

const REVIEW_PROCESS_STEPS = [
  ["codex_implementation_packet", "Codex prepares plan, implementation diff, tests, evidence refs, and rollback notes"],
  ["harness_deterministic_validation", "Harness runs deterministic validators and records command evidence"],
  ["claude_code_opus_max_independent_review", "Claude Code Opus max reviews the packet without mutating source"],
  ["finding_loop_and_revalidation", "Codex addresses findings and reruns validators until review blockers are closed"],
  ["review_receipt_registration", "Harness records Claude review receipt, model id or alias, scope, findings, and limitations"],
  ["single_owner_trust_classification", "Harness marks the milestone as single-owner plus Claude-reviewed, not enterprise trust"],
];

export async function runDevelopmentControlConsole(options = {}) {
  const result = await buildDevelopmentControlConsole(options);
  if (options.write !== false) await writeDevelopmentControlConsole(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Development control console failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDevelopmentControlConsole(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DEVELOPMENT_CONTROL_CONSOLE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const sourcePlane = options.sourcePlane ?? await buildConversationSourcePlane({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });
  const improvementSignal = options.improvementSignal ?? await buildConversationImprovementSignal({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    sourcePlane,
    write: false,
  });

  const contract = buildConsoleContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const planRegistryRows = buildPlanRegistryRows(roadmapDoc.text, generatedAt);
  const goalCardRows = buildGoalCardRows(generatedAt);
  const engineRoleRows = buildEngineRoleRows(generatedAt);
  const phaseStatusRows = buildPhaseStatusRows(planRegistryRows, phaseRows, generatedAt);
  const evidenceCardRows = buildEvidenceCardRows({ sourcePlane, improvementSignal, generatedAt });
  const reviewProcessRows = buildReviewProcessRows(generatedAt);
  const milestoneReviewGateRows = buildMilestoneReviewGateRows(generatedAt);
  const transcriptSourceLinkRows = buildTranscriptSourceLinkRows(sourcePlane, generatedAt);
  const nextActionRows = buildNextActionRows({ improvementSignal, milestoneReviewGateRows, generatedAt });
  const trustClassificationRows = buildTrustClassificationRows(generatedAt);
  const gateCardRows = buildGateCardRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, sourcePlane, improvementSignal, contract, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows });
  const boundary = buildBoundary({ sourcePlane, improvementSignal, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, sourcePlane, improvementSignal, contract, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    development_control_console_id: `development-control-console.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_conversation_source_plane_summary: sourcePlane.summary,
    source_conversation_improvement_signal_summary: improvementSignal.summary,
    development_control_console_contract: contract,
    console_phase_rows: phaseRows,
    plan_registry_rows: planRegistryRows,
    goal_card_rows: goalCardRows,
    engine_role_rows: engineRoleRows,
    phase_status_rows: phaseStatusRows,
    evidence_card_rows: evidenceCardRows,
    review_process_rows: reviewProcessRows,
    milestone_review_gate_rows: milestoneReviewGateRows,
    transcript_source_link_rows: transcriptSourceLinkRows,
    next_action_rows: nextActionRows,
    trust_classification_rows: trustClassificationRows,
    gate_card_rows: gateCardRows,
    development_control_console_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourcePlane, improvementSignal, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "development_control_console")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourcePlane, improvementSignal, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows, boundary, validation: result.validation });
  result.summary.development_control_console_id = result.development_control_console_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeDevelopmentControlConsole(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "development-control-console.json"), serializableResult(result));
  await writeJson(path.join(outDir, "plan-registry-rows.json"), collectionEnvelope("plan-registry-rows.v1", "plan_registry_rows", result.plan_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-card-rows.json"), collectionEnvelope("goal-card-rows.v1", "goal_card_rows", result.goal_card_rows, result.generated_at));
  await writeJson(path.join(outDir, "engine-role-rows.json"), collectionEnvelope("engine-role-rows.v1", "engine_role_rows", result.engine_role_rows, result.generated_at));
  await writeJson(path.join(outDir, "phase-status-rows.json"), collectionEnvelope("phase-status-rows.v1", "phase_status_rows", result.phase_status_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-card-rows.json"), collectionEnvelope("evidence-card-rows.v1", "evidence_card_rows", result.evidence_card_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-process-rows.json"), collectionEnvelope("review-process-rows.v1", "review_process_rows", result.review_process_rows, result.generated_at));
  await writeJson(path.join(outDir, "milestone-review-gate-rows.json"), collectionEnvelope("milestone-review-gate-rows.v1", "milestone_review_gate_rows", result.milestone_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "transcript-source-link-rows.json"), collectionEnvelope("transcript-source-link-rows.v1", "transcript_source_link_rows", result.transcript_source_link_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-action-rows.json"), collectionEnvelope("next-action-rows.v1", "next_action_rows", result.next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "trust-classification-rows.json"), collectionEnvelope("trust-classification-rows.v1", "trust_classification_rows", result.trust_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-card-rows.json"), collectionEnvelope("gate-card-rows.v1", "gate_card_rows", result.gate_card_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-control-console-boundary.json"), result.development_control_console_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "development-control-console-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDevelopmentControlConsoleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDevelopmentControlConsole(args);
    console.log(`Development control console ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.development_control_console_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Plan rows: ${result.summary.plan_registry_count}`);
    console.log(`Review process steps: ${result.summary.review_process_step_count}`);
    console.log(`Milestone review gates: ${result.summary.milestone_review_gate_count}`);
    console.log(`Human adjudication in milestone gate: ${result.summary.human_adjudication_in_milestone_gate}`);
    console.log(`Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildConsoleContract(generatedAt) {
  return {
    schema_version: "development-control-console-contract.v1",
    generated_at: generatedAt,
    contract_id: "development-control-console-contract.p4601-p5000",
    program_range: PROGRAM_RANGE,
    source_program_ranges: ["P4001-P4300", "P4301-P4600"],
    required_components: REQUIRED_COMPONENTS,
    primary_surface: "Development Control Console",
    first_screen: "Plan Registry",
    system_of_record: "Harness UI",
    codex_primary_developer: true,
    harness_deterministic_validator: true,
    claude_code_opus_max_independent_reviewer: true,
    claude_review_receipt_required_for_milestone: true,
    model_upgrade_requires_receipt: true,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    single_owner_claude_reviewed_mode: true,
    chat_system_of_record_allowed: false,
    kpi_home_surface_allowed: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "console-phase-row.v1",
      row_id: `console.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.development_control_console.${phase_range}`,
      responsible_owner: "platform_console_owner",
      next_allowed_action: pass ? "preserve console phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildPlanRegistryRows(roadmapText, generatedAt) {
  return ROADMAP_PROGRAMS.map(([phase_range, program_name], index) => {
    const isCurrent = phase_range === PROGRAM_RANGE;
    const isCompleteSource = phase_range === "P4001-P4300" || phase_range === "P4301-P4600";
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, program_name);
    return {
      schema_version: "plan-registry-row.v1",
      row_id: `plan.registry.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      plan_id: `hermes.${phase_range.toLowerCase()}`,
      phase_range,
      program_name,
      plan_status: isCompleteSource ? "SOURCE_READY" : isCurrent ? "IN_PROGRESS" : "PLANNED",
      source_citation_ref: `citation.docs.hermes_p8000.${phase_range}`,
      review_process_ref: "review-process.codex_harness_claude_single_owner",
      milestone_review_gate_ref: milestoneForProgram(phase_range),
      claude_code_opus_max_review_required: true,
      human_adjudication_required: false,
      enterprise_trust_claim_allowed: false,
      protected_closeout_enabled: false,
      harness_ui_source_of_truth: true,
      current_verdict: pass ? "pass" : "blocked",
      block_reason: pass ? null : `missing_plan_registry.${phase_range}`,
      unsafe_flags_false: pass,
      verdict_authority: "harness_only",
      evidence_ref: `evidence.console.plan_registry.${phase_range}`,
      next_allowed_action: isCurrent ? "implement P4601-P5000 console evidence rows" : "open milestone after previous gate review receipt",
    };
  });
}

function buildGoalCardRows(generatedAt) {
  const specs = [
    {
      goal_id: "goal.hermes.p4301-p8000.work_os",
      title: "Implement Hermes P4301-P8000 Long-Range Harness Work OS Roadmap",
      phase_range: "P4301-P8000",
      goal_status: "ACTIVE",
      next_milestone: "P5000",
    },
    {
      goal_id: "goal.hermes.p4601-p5000.console",
      title: "Development Control Console and Jira-Inspired Evidence UI",
      phase_range: PROGRAM_RANGE,
      goal_status: "IN_PROGRESS",
      next_milestone: "P5000",
    },
  ];
  return specs.map((spec, index) => ({
    schema_version: "goal-card-row.v1",
    row_id: `goal.card.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    ...spec,
    primary_engine_ref: "engine.codex.primary_developer",
    reviewer_engine_ref: "engine.claude_code_opus_max.independent_reviewer",
    harness_validator_ref: "engine.harness.deterministic_validator",
    review_process_ref: "review-process.codex_harness_claude_single_owner",
    claude_code_opus_max_review_required: true,
    human_adjudication_required: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_allowed: false,
    source_citation_ref: `citation.goal.${spec.goal_id}`,
    evidence_ref: `evidence.goal_card.${spec.goal_id}`,
    next_allowed_action: "show phase status, gate cards, evidence cards, and Claude review receipt requirements",
  }));
}

function buildEngineRoleRows(generatedAt) {
  const specs = [
    ["engine.codex.primary_developer", "Codex", "PRIMARY_DEVELOPER", "plan, implement, test, prepare packets", false],
    ["engine.harness.deterministic_validator", "Harness", "DETERMINISTIC_VALIDATOR", "validate contracts, evidence, gates, and trust boundaries", false],
    ["engine.claude_code_opus_max.independent_reviewer", "Claude Code Opus max", "INDEPENDENT_REVIEWER", "review implementation packets and produce findings without mutation", false],
    ["engine.github.ci_attestation_observer", "GitHub and attestation", "EXTERNAL_EVIDENCE_OBSERVER", "observe CI, required checks, attestation, and branch/ruleset evidence", false],
  ];
  return specs.map(([engine_id, engine_name, role, authority_scope, can_finally_approve], index) => ({
    schema_version: "engine-role-row.v1",
    row_id: `engine.role.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    engine_id,
    engine_name,
    role,
    authority_scope,
    can_mutate_source: role === "PRIMARY_DEVELOPER",
    can_review_independently: role === "INDEPENDENT_REVIEWER",
    can_finally_approve,
    can_claim_enterprise_trust: false,
    human_adjudication_required: false,
    reviewer_ref: role === "INDEPENDENT_REVIEWER" ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    evidence_ref: `evidence.engine_role.${engine_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildPhaseStatusRows(planRegistryRows, phaseRows, generatedAt) {
  return phaseRows.map((phase, index) => ({
    schema_version: "phase-status-row.v1",
    row_id: `phase.status.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    phase_range: phase.phase_range,
    phase_name: phase.phase_name,
    status_lane: "P4601-P5000 Development Control Console",
    visible_status: phase.current_verdict === "pass" ? "READY_TO_BUILD" : "BLOCKED",
    plan_registry_ref: planRegistryRows.find((row) => row.phase_range === PROGRAM_RANGE)?.plan_id,
    gate_card_ref: `gate-card.${phase.phase_range}`,
    evidence_card_ref: `evidence-card.${phase.phase_range}`,
    review_process_ref: "review-process.codex_harness_claude_single_owner",
    next_allowed_action: phase.current_verdict === "pass" ? "build or preserve console row evidence" : phase.next_allowed_action,
    unsafe_flags_false: phase.current_verdict === "pass",
    verdict_authority: "harness_only",
  }));
}

function buildEvidenceCardRows({ sourcePlane, improvementSignal, generatedAt }) {
  const specs = [
    ["evidence.console.source_plane", "P4001-P4300 source plane", sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS, "artifacts/conversation-source-plane/latest/conversation-source-plane.json"],
    ["evidence.console.improvement_signal", "P4301-P4600 improvement signal", improvementSignal.summary?.conversation_improvement_signal_status === IMPROVEMENT_READY_STATUS, "artifacts/conversation-improvement-signal/latest/conversation-improvement-signal.json"],
    ["evidence.console.roadmap", "P4001-P8000 roadmap", true, "docs/hermes-long-range-roadmap-p4001-p8000.md"],
    ["evidence.console.review_authority", "Codex and Claude review process contract", true, "docs/hermes-long-range-roadmap-p4001-p8000.md#development-surface-rule"],
    ["evidence.console.package_validate", "package validate chain hook", true, "package.json#scripts.validate"],
  ];
  return specs.map(([evidence_id, title, available, source_ref], index) => ({
    schema_version: "evidence-card-row.v1",
    row_id: `evidence.card.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    evidence_id,
    title,
    source_ref,
    evidence_status: available ? "AVAILABLE" : "MISSING",
    raw_body_default_visible: false,
    source_citation_required: true,
    reviewer_ref: "reviewer.harness_contract",
    claude_code_opus_max_review_required: evidence_id.includes("review_authority"),
    human_adjudication_required: false,
    unsafe_flags_false: Boolean(available),
    verdict_authority: "harness_only",
    next_allowed_action: available ? "link evidence card in console" : `restore ${source_ref}`,
  }));
}

function buildReviewProcessRows(generatedAt) {
  return REVIEW_PROCESS_STEPS.map(([step_id, description], index) => ({
    schema_version: "review-process-row.v1",
    row_id: `review.process.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    review_process_id: "review-process.codex_harness_claude_single_owner",
    step_order: index + 1,
    step_id,
    description,
    owner_ref: step_id.startsWith("codex") ? "engine.codex.primary_developer" : step_id.startsWith("claude") ? "engine.claude_code_opus_max.independent_reviewer" : "engine.harness.deterministic_validator",
    receipt_required: true,
    claude_code_opus_max_review_required: step_id === "claude_code_opus_max_independent_review",
    human_adjudication_required: false,
    source_mutation_allowed: step_id === "codex_implementation_packet",
    reviewer_mutation_allowed: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_allowed: false,
    evidence_ref: `evidence.review_process.${step_id}`,
    next_allowed_action: index + 1 < REVIEW_PROCESS_STEPS.length ? REVIEW_PROCESS_STEPS[index + 1][0] : "open next milestone only as single-owner Claude-reviewed",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildMilestoneReviewGateRows(generatedAt) {
  return MILESTONE_RANGES.map((milestone, index) => ({
    schema_version: "milestone-review-gate-row.v1",
    row_id: `milestone.review.gate.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    milestone_id: `milestone.${milestone.toLowerCase()}`,
    milestone_range: milestone,
    review_process_ref: "review-process.codex_harness_claude_single_owner",
    required_step_ids: REVIEW_PROCESS_STEPS.map(([step_id]) => step_id),
    codex_implementation_packet_required: true,
    harness_validation_required: true,
    claude_code_opus_max_review_required: true,
    claude_review_receipt_required: true,
    findings_loop_required: true,
    human_adjudication_required: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_allowed: false,
    trust_classification_ref: "trust.single_owner_claude_reviewed_lower_trust",
    gate_status: milestone === "P5000" ? "READY_TO_OPEN" : "PLANNED",
    evidence_ref: `evidence.milestone_review.${milestone.toLowerCase()}`,
    next_allowed_action: milestone === "P5000" ? "prepare P5000 Claude review packet after local validation" : "wait for previous milestone review receipt",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTranscriptSourceLinkRows(sourcePlane, generatedAt) {
  return sourcePlane.conversation_source_queue_rows.map((source, index) => ({
    schema_version: "transcript-source-link-row.v1",
    row_id: `transcript.source.link.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    source_id: source.source_id,
    engine: source.engine,
    thread_or_session: source.thread_or_session,
    project_or_goal: source.project_or_goal,
    source_status: source.source_status,
    redaction_status: source.redaction_status,
    raw_body_default_visible: false,
    source_citation_ref: `citation.${source.source_id}`,
    evidence_ref: `evidence.transcript_link.${source.source_id}`,
    next_allowed_action: source.next_allowed_action,
    unsafe_flags_false: source.raw_body_default_visible !== true,
    verdict_authority: "harness_only",
  }));
}

function buildNextActionRows({ improvementSignal, milestoneReviewGateRows, generatedAt }) {
  const specs = [
    ["next-action.console.p5000_local_validation", "Run P4601-P5000 console validators and node tests", "Codex"],
    ["next-action.console.p5000_review_packet", "Prepare Claude Code Opus max review packet for P5000 milestone", "Codex"],
    ["next-action.console.p5000_claude_review_receipt", "Capture Claude review receipt after independent review", "Claude Code Opus max"],
    ["next-action.console.p5000_findings_loop", "Route findings back to Codex implementation and revalidation", "Harness"],
    ["next-action.console.p5000_trust_badge", "Show single-owner plus Claude-reviewed lower-trust badge", "Harness"],
  ];
  return specs.map(([next_action_id, title, owner], index) => ({
    schema_version: "next-action-row.v1",
    row_id: `next.action.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    next_action_id,
    title,
    owner,
    action_status: "OPEN",
    source_improvement_signal_count: improvementSignal.summary?.signal_count ?? 0,
    milestone_review_gate_ref: milestoneReviewGateRows[0]?.milestone_id,
    claude_code_opus_max_review_required: next_action_id.includes("claude_review"),
    human_adjudication_required: false,
    protected_closeout_enabled: false,
    evidence_ref: `evidence.next_action.${next_action_id}`,
    next_allowed_action: "complete action evidence before P5000 closeout",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTrustClassificationRows(generatedAt) {
  const specs = [
    {
      trust_tier_id: "trust.single_owner_claude_reviewed_lower_trust",
      trust_label: "single-owner + Claude-reviewed",
      trust_status: "AVAILABLE",
      claim_allowed: true,
      enterprise_trust: false,
      protected_final_decision_allowed: false,
    },
    {
      trust_tier_id: "trust.enterprise_independent_review",
      trust_label: "enterprise independent review",
      trust_status: "BLOCKED",
      claim_allowed: false,
      enterprise_trust: true,
      protected_final_decision_allowed: false,
    },
  ];
  return specs.map((spec, index) => ({
    schema_version: "trust-classification-row.v1",
    row_id: `trust.classification.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    ...spec,
    claude_code_opus_max_review_required: true,
    human_adjudication_required: false,
    block_reason: spec.trust_status === "BLOCKED" ? "human adjudication and independent GitHub approval are not part of current milestone gate" : null,
    evidence_ref: `evidence.trust_classification.${spec.trust_tier_id}`,
    next_allowed_action: spec.trust_status === "AVAILABLE" ? "label milestones with lower-trust badge" : "do not claim enterprise trust",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildGateCardRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, sourcePlane, improvementSignal, contract, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:development-control-console"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes development control console"],
    ["source_script_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source conversation plane script exists"],
    ["improvement_script_registered", Boolean(packageJson.data?.scripts?.[IMPROVEMENT_COMMAND_NAME]), "conversation improvement signal script exists"],
    ["source_plane_ready", sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS, "P4001-P4300 source plane is ready"],
    ["improvement_signal_ready", improvementSignal.summary?.conversation_improvement_signal_status === IMPROVEMENT_READY_STATUS, "P4301-P4600 improvement signal is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Development Control Console"), "P4601-P5000 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Harness") && includesToken(architectureDoc.text, "review"), "architecture doc remains available for console alignment"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Review") && includesToken(reviewDashboardDoc.text, "Evidence"), "review dashboard IA remains available for console alignment"],
    ["contract_ready", contract.codex_primary_developer && contract.claude_review_receipt_required_for_milestone && contract.human_adjudication_in_milestone_gate === false, "Codex/Harness/Claude process contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P4601-P5000 phase rows pass"],
    ["plan_registry_ready", planRegistryRows.length === ROADMAP_PROGRAMS.length && planRegistryRows.every((row) => row.harness_ui_source_of_truth), "P8000 plan registry rows are ready"],
    ["goal_cards_ready", goalCardRows.every((row) => row.primary_engine_ref && row.reviewer_engine_ref), "goal cards bind Codex and Claude engine roles"],
    ["engine_roles_ready", engineRoleRows.some((row) => row.role === "PRIMARY_DEVELOPER") && engineRoleRows.some((row) => row.role === "INDEPENDENT_REVIEWER"), "engine roles are registered"],
    ["phase_status_ready", phaseStatusRows.every((row) => row.visible_status !== "BLOCKED"), "phase status rows are visible"],
    ["evidence_cards_ready", evidenceCardRows.every((row) => row.evidence_status === "AVAILABLE"), "evidence cards are available"],
    ["review_process_ready", reviewProcessRows.length === REVIEW_PROCESS_STEPS.length && reviewProcessRows.every((row) => row.human_adjudication_required === false), "Codex/Harness/Claude review process rows are ready"],
    ["milestone_gates_ready", milestoneReviewGateRows.length === MILESTONE_RANGES.length && milestoneReviewGateRows.every((row) => row.claude_review_receipt_required && row.human_adjudication_required === false), "P8000 milestones require Claude review receipts"],
    ["transcript_links_ready", transcriptSourceLinkRows.length >= 2 && transcriptSourceLinkRows.every((row) => row.raw_body_default_visible === false), "transcript links preserve raw body boundary"],
    ["next_actions_ready", nextActionRows.length >= 5 && nextActionRows.every((row) => row.human_adjudication_required === false), "next actions reflect no-human milestone gate"],
    ["trust_classification_ready", trustClassificationRows.some((row) => row.trust_tier_id === "trust.single_owner_claude_reviewed_lower_trust" && row.trust_status === "AVAILABLE") && trustClassificationRows.some((row) => row.trust_tier_id === "trust.enterprise_independent_review" && row.trust_status === "BLOCKED"), "single-owner lower-trust and enterprise BLOCK rows are visible"],
    ["boundary_no_runtime_write", contract.runtime_execution_enabled === false && contract.write_action_enabled === false && contract.protected_action_enabled === false, "console does not enable runtime/write/protected action"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "gate-card-row.v1",
    row_id: `gate.card.row.${String(index + 1).padStart(3, "0")}`,
    gate_card_id: `gate-card.${gate_id}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.console.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("milestone") || gate_id.includes("review_process") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.development_control_console.${gate_id}`,
    responsible_owner: "platform_console_owner",
    next_allowed_action: pass ? "show gate card in console" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourcePlane, improvementSignal, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows }) {
  const unsafeFlags = [
    sourcePlane.summary?.conversation_source_plane_status !== SOURCE_READY_STATUS,
    improvementSignal.summary?.conversation_improvement_signal_status !== IMPROVEMENT_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    planRegistryRows.some((row) => row.current_verdict !== "pass"),
    goalCardRows.some((row) => !row.primary_engine_ref || !row.reviewer_engine_ref || row.human_adjudication_required !== false),
    engineRoleRows.some((row) => row.can_finally_approve || row.can_claim_enterprise_trust),
    phaseStatusRows.some((row) => row.visible_status === "BLOCKED"),
    evidenceCardRows.some((row) => row.evidence_status !== "AVAILABLE"),
    reviewProcessRows.some((row) => row.human_adjudication_required !== false || row.protected_closeout_enabled),
    milestoneReviewGateRows.some((row) => !row.claude_review_receipt_required || row.human_adjudication_required !== false || row.enterprise_trust_claim_allowed),
    transcriptSourceLinkRows.some((row) => row.raw_body_default_visible),
    nextActionRows.some((row) => row.human_adjudication_required !== false || row.protected_closeout_enabled),
    !trustClassificationRows.some((row) => row.trust_tier_id === "trust.single_owner_claude_reviewed_lower_trust" && row.trust_status === "AVAILABLE"),
    !trustClassificationRows.some((row) => row.trust_tier_id === "trust.enterprise_independent_review" && row.trust_status === "BLOCKED"),
    gateCardRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "development-control-console-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_ranges: ["P4001-P4300", "P4301-P4600"],
    development_control_console_ready: unsafeFlags.filter(Boolean).length === 0,
    source_plane_ready: sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS,
    improvement_signal_ready: improvementSignal.summary?.conversation_improvement_signal_status === IMPROVEMENT_READY_STATUS,
    harness_ui_source_of_truth: true,
    chat_system_of_record_allowed: false,
    codex_primary_developer: true,
    harness_deterministic_validator: true,
    claude_code_opus_max_independent_reviewer: true,
    claude_review_receipt_required_for_milestone: true,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
    single_owner_claude_reviewed_mode: true,
    raw_transcript_body_default_visible: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, sourcePlane, improvementSignal, contract, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include development control console command"),
    validationItem("source.ready", "source", sourcePlane.summary?.conversation_source_plane_status === SOURCE_READY_STATUS, "source plane must be ready"),
    validationItem("improvement.ready", "source", improvementSignal.summary?.conversation_improvement_signal_status === IMPROVEMENT_READY_STATUS, "improvement signal must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P4601-P5000 roadmap must be available"),
    validationItem("architecture.available", "docs", architectureDoc.available, "architecture doc must be available"),
    validationItem("review_dashboard.available", "docs", reviewDashboardDoc.available, "review dashboard IA doc must be available"),
    validationItem("contract.components", "contract", contract.required_components.length === REQUIRED_COMPONENTS.length, "all console component contracts must be present"),
    validationItem("contract.no_human_gate", "contract", contract.human_adjudication_in_milestone_gate === false && contract.protected_closeout_enabled === false, "human milestone gate and protected closeout must be disabled"),
    validationItem("contract.claude_review", "contract", contract.claude_review_receipt_required_for_milestone === true && contract.claude_code_opus_max_independent_reviewer === true, "Claude review receipt must be required for milestones"),
    validationItem("contract.no_enterprise_claim", "contract", contract.enterprise_trust_claim_enabled === false, "enterprise trust claim must be disabled"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P4601-P5000 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P4601-P5000 phase rows must pass"),
    validationItem("plans.count", "plans", planRegistryRows.length === ROADMAP_PROGRAMS.length, "P4001-P8000 plan registry rows must exist"),
    validationItem("plans.no_human", "plans", planRegistryRows.every((row) => row.human_adjudication_required === false), "plan rows must reflect no-human milestone gate"),
    validationItem("goals.roles", "goals", goalCardRows.every((row) => row.primary_engine_ref && row.reviewer_engine_ref), "goal cards must bind Codex and Claude"),
    validationItem("engines.roles", "engines", engineRoleRows.some((row) => row.role === "PRIMARY_DEVELOPER") && engineRoleRows.some((row) => row.role === "INDEPENDENT_REVIEWER"), "engine roles must include developer and reviewer"),
    validationItem("phase_status.ready", "phase_status", phaseStatusRows.every((row) => row.visible_status !== "BLOCKED"), "phase statuses must be ready"),
    validationItem("evidence.available", "evidence", evidenceCardRows.every((row) => row.evidence_status === "AVAILABLE"), "evidence cards must be available"),
    validationItem("review_process.steps", "review_process", reviewProcessRows.length === REVIEW_PROCESS_STEPS.length, "review process steps must be complete"),
    validationItem("review_process.no_human", "review_process", reviewProcessRows.every((row) => row.human_adjudication_required === false && row.protected_closeout_enabled === false), "review process must exclude human gate and protected closeout"),
    validationItem("milestones.count", "milestones", milestoneReviewGateRows.length === MILESTONE_RANGES.length, "all major milestones must have Claude review gates"),
    validationItem("milestones.claude_receipt", "milestones", milestoneReviewGateRows.every((row) => row.claude_review_receipt_required && row.claude_code_opus_max_review_required), "milestones must require Claude review receipts"),
    validationItem("milestones.no_human", "milestones", milestoneReviewGateRows.every((row) => row.human_adjudication_required === false && row.enterprise_trust_claim_allowed === false), "milestones must not require human or claim enterprise trust"),
    validationItem("transcripts.linked", "transcripts", transcriptSourceLinkRows.length >= 2 && transcriptSourceLinkRows.every((row) => row.raw_body_default_visible === false), "transcript links must be present and raw body hidden"),
    validationItem("next_actions.ready", "next_actions", nextActionRows.length >= 5 && nextActionRows.every((row) => row.human_adjudication_required === false), "next actions must be ready"),
    validationItem("trust.lower_tier", "trust", trustClassificationRows.some((row) => row.trust_tier_id === "trust.single_owner_claude_reviewed_lower_trust" && row.trust_status === "AVAILABLE"), "lower-trust tier must be visible"),
    validationItem("trust.enterprise_blocked", "trust", trustClassificationRows.some((row) => row.trust_tier_id === "trust.enterprise_independent_review" && row.trust_status === "BLOCKED"), "enterprise trust must remain blocked"),
    validationItem("gates.ready", "gates", gateCardRows.every((row) => row.gate_status === "ready"), "gate cards must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.protected_action_enabled === false, "P5000 console must not enable runtime/write/protected action"),
    validationItem("boundary.no_work_os_claim", "boundary", boundary.work_os_claim_enabled === false, "P5000 console must not claim production Work OS"),
  ];
}

function buildSummary({ sourcePlane, improvementSignal, phaseRows, planRegistryRows, goalCardRows, engineRoleRows, phaseStatusRows, evidenceCardRows, reviewProcessRows, milestoneReviewGateRows, transcriptSourceLinkRows, nextActionRows, trustClassificationRows, gateCardRows, boundary, validation }) {
  return {
    schema_version: "development-control-console-summary.v1",
    development_control_console_status: validation.valid && boundary.development_control_console_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_plane_status: sourcePlane.summary?.conversation_source_plane_status ?? "unknown",
    improvement_signal_status: improvementSignal.summary?.conversation_improvement_signal_status ?? "unknown",
    phase_row_count: phaseRows.length,
    plan_registry_count: planRegistryRows.length,
    goal_card_count: goalCardRows.length,
    engine_role_count: engineRoleRows.length,
    phase_status_count: phaseStatusRows.length,
    evidence_card_count: evidenceCardRows.length,
    review_process_step_count: reviewProcessRows.length,
    milestone_review_gate_count: milestoneReviewGateRows.length,
    transcript_source_link_count: transcriptSourceLinkRows.length,
    next_action_count: nextActionRows.length,
    trust_classification_count: trustClassificationRows.length,
    gate_count: gateCardRows.length,
    pass_gate_count: gateCardRows.filter((row) => row.gate_status === "ready").length,
    codex_primary_developer: boundary.codex_primary_developer,
    harness_deterministic_validator: boundary.harness_deterministic_validator,
    claude_code_opus_max_independent_reviewer: boundary.claude_code_opus_max_independent_reviewer,
    claude_review_receipt_required_for_milestone: boundary.claude_review_receipt_required_for_milestone,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    single_owner_claude_reviewed_mode: boundary.single_owner_claude_reviewed_mode,
    chat_system_of_record_allowed: boundary.chat_system_of_record_allowed,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function milestoneForProgram(phaseRange) {
  if (phaseRange === "P4001-P4300" || phaseRange === "P4301-P4600") return "milestone.P5000";
  const [, end] = phaseRange.split("-");
  return end ? `milestone.${end.toLowerCase()}` : null;
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_development_control_console.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Development Control Console",
    "",
    `Status: ${result.summary.development_control_console_status}`,
    `Program: ${result.summary.program_range}`,
    `Source plane: ${result.summary.source_plane_status}`,
    `Improvement signal: ${result.summary.improvement_signal_status}`,
    `Plan registry rows: ${result.summary.plan_registry_count}`,
    `Review process steps: ${result.summary.review_process_step_count}`,
    `Milestone review gates: ${result.summary.milestone_review_gate_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Claude review receipt required: ${result.summary.claude_review_receipt_required_for_milestone}`,
    `Human adjudication in milestone gate: ${result.summary.human_adjudication_in_milestone_gate}`,
    `Protected closeout enabled: ${result.summary.protected_closeout_enabled}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Single-owner Claude-reviewed mode: ${result.summary.single_owner_claude_reviewed_mode}`,
    `Runtime execution enabled: ${result.summary.runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Review Process",
    "",
    "Every major milestone uses Codex implementation, Harness deterministic validation, Claude Code Opus max independent review, finding-loop revalidation, review receipt registration, and single-owner trust classification. Human adjudication is not part of the current milestone gate, so protected closeout and enterprise-trust claims stay disabled.",
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
  const defaults = DEFAULT_DEVELOPMENT_CONTROL_CONSOLE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architecturePath ?? defaults.architectureDocPath,
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
  console.log(`Usage: node scripts/development-control-console.mjs [options]

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
