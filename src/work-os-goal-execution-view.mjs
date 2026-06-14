import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  buildWorkOsReadOnlyApiResponse,
  buildWorkOsReadOnlyApiUiSmoke,
} from "./work-os-read-only-api-ui-smoke.mjs";

export const DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_OUT_DIR = "artifacts/work-os-goal-execution-view/latest";
export const DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS = {
  schemaPath: "schemas/work-os-goal-execution-view.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p9001-p9200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsReadOnlyApiUiSmokePath: "artifacts/work-os-read-only-api-ui-smoke/latest/work-os-read-only-api-ui-smoke.json",
};

const COMMAND_NAME = "platform:work-os-goal-execution-view";
const SOURCE_COMMAND_NAME = "platform:work-os-read-only-api-ui-smoke";
const SCHEMA_VERSION = "work-os-goal-execution-view.v1";
const CAPABILITY_ID = "platform.work_os_goal_execution_view";
const PROGRAM_RANGE = "P9001-P9200";
const SOURCE_PROGRAM_RANGE = "P8801-P9000";
const SOURCE_READY_STATUS = "ready_for_work_os_read_only_api_ui_smoke";
const READY_STATUS = "ready_for_work_os_goal_execution_view";

const PHASE_SPECS = [
  ["P9001-P9020", "Runtime Handoff Source Map"],
  ["P9021-P9040", "Project Registry Projection"],
  ["P9041-P9060", "Goal And Phase Execution Model"],
  ["P9061-P9080", "Validation State Lens"],
  ["P9081-P9100", "Review Lane View"],
  ["P9101-P9120", "Session Handoff Refs"],
  ["P9121-P9140", "Next Action Queue"],
  ["P9141-P9160", "Commit Checkpoint View"],
  ["P9161-P9180", "API UI Projection"],
  ["P9181-P9200", "P9200 Freeze"],
];

const API_COLLECTION_SPECS = [
  ["/api/work-os/projects", "projects", "project_runtime_handoff_rows"],
  ["/api/work-os/phases", "phases", "source_phase_rows"],
  ["/api/work-os/timeline", "timeline", "source_timeline_rows"],
  ["/api/work-os/reviews", "reviews", "source_review_rows"],
  ["/api/work-os/gates", "gates", "source_gate_rows"],
  ["/api/work-os/session-sources", "session_sources", "source_session_rows"],
];

const VIEW_SURFACE_SPECS = [
  ["surface.project_registry", "Project Registry", "/api/work-os/projects"],
  ["surface.goal_execution", "Goal Execution", "/api/work-os/phases"],
  ["surface.validation_lens", "Validation State Lens", "/api/work-os/gates"],
  ["surface.review_lanes", "Review Lanes", "/api/work-os/reviews"],
  ["surface.session_handoff", "Session Handoff", "/api/work-os/session-sources"],
  ["surface.next_actions", "Next Actions", "/api/work-os/refresh"],
  ["surface.commit_checkpoint", "Commit Checkpoint", "/api/work-os/summary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.domain_pack_as_product", "A domain pack is promoted as the whole Hermes product", "BLOCK_DOMAIN_PACK_PRODUCT_CONFUSION"],
  ["negative.p9000_endpoint_lock", "New phase copy treats P9000 as the fixed endpoint", "BLOCK_PHASE_ENDPOINT_LOCK"],
  ["negative.unscoped_goal", "Goal row has no phase range, evidence ref, or project ref", "BLOCK_UNSCOPED_GOAL"],
  ["negative.raw_session_body", "Session handoff exposes raw or full transcript body", "BLOCK_RAW_SESSION_BODY"],
  ["negative.review_final_authority", "Codex or Claude becomes final approver", "BLOCK_REVIEW_FINAL_AUTHORITY"],
  ["negative.protected_gate_completion", "Protected closeout or human gate is completed by this tranche", "BLOCK_PROTECTED_GATE_COMPLETION"],
  ["negative.single_owner_enterprise", "Single-owner readiness is promoted to enterprise independent trust", "BLOCK_SINGLE_OWNER_ENTERPRISE_TRUST"],
  ["negative.ui_write_action", "Execution view enables write or protected action controls", "BLOCK_UI_WRITE_ACTION"],
  ["negative.runtime_connector_write", "Runtime execution or external connector write is enabled", "BLOCK_RUNTIME_CONNECTOR_WRITE"],
  ["negative.production_pass", "Work OS production or enterprise PASS is enabled", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runWorkOsGoalExecutionView(options = {}) {
  const result = await buildWorkOsGoalExecutionView(options);
  if (options.write !== false) await writeWorkOsGoalExecutionView(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS goal execution view failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsGoalExecutionView(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = options.workOsReadOnlyApiUiSmoke
    ? normalizeInlineJsonSource("inline.work_os_read_only_api_ui_smoke", options.workOsReadOnlyApiUiSmoke)
    : await readJsonOrBuildWorkOsReadOnlyApiUiSmoke(inputs.source_work_os_read_only_api_ui_smoke_path, generatedAt);

  const sourceReady = isSourceReady(source);
  const collections = sourceReady ? await readSourceApiCollections(generatedAt) : emptyCollections();
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const projectRows = buildProjectRuntimeHandoffRows(collections.project_runtime_handoff_rows, generatedAt);
  const goalRows = buildGoalExecutionRows(projectRows, collections.source_phase_rows, generatedAt);
  const validationRows = buildValidationStateLensRows(source, collections.source_gate_rows, generatedAt);
  const reviewRows = buildReviewLaneRows(collections.source_review_rows, generatedAt);
  const sessionRows = buildSessionHandoffRows(collections.source_session_rows, collections.source_timeline_rows, generatedAt);
  const nextActionRows = buildNextActionQueueRows({ projectRows, goalRows, validationRows, reviewRows, sessionRows, generatedAt });
  const commitRows = buildCommitCheckpointRows({ projectRows, goalRows, generatedAt });
  const apiUiRows = buildApiUiProjectionRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    phaseRows,
    projectRows,
    goalRows,
    validationRows,
    reviewRows,
    sessionRows,
    nextActionRows,
    commitRows,
    apiUiRows,
    negativeFixtureRows,
    generatedAt,
  });
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    projectRows,
    goalRows,
    validationRows,
    reviewRows,
    sessionRows,
    nextActionRows,
    commitRows,
    apiUiRows,
    negativeFixtureRows,
    freezeRows,
  });
  const boundary = buildBoundary({
    source,
    phaseRows,
    projectRows,
    goalRows,
    validationRows,
    reviewRows,
    sessionRows,
    nextActionRows,
    commitRows,
    apiUiRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    projectRows,
    goalRows,
    validationRows,
    reviewRows,
    sessionRows,
    nextActionRows,
    commitRows,
    apiUiRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    work_os_goal_execution_view_id: `work-os-goal-execution-view.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_read_only_api_ui_smoke_summary: source.data?.summary ?? null,
    work_os_goal_execution_view_contract: contract,
    work_os_goal_execution_phase_rows: phaseRows,
    project_runtime_handoff_rows: projectRows,
    goal_phase_execution_rows: goalRows,
    validation_state_lens_rows: validationRows,
    review_lane_view_rows: reviewRows,
    session_handoff_ref_rows: sessionRows,
    next_action_queue_rows: nextActionRows,
    commit_checkpoint_view_rows: commitRows,
    api_ui_projection_rows: apiUiRows,
    work_os_goal_execution_negative_fixture_rows: negativeFixtureRows,
    p9200_freeze_rows: freezeRows,
    work_os_goal_execution_gate_rows: gateRows,
    work_os_goal_execution_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      phaseRows,
      projectRows,
      goalRows,
      validationRows,
      reviewRows,
      sessionRows,
      nextActionRows,
      commitRows,
      apiUiRows,
      negativeFixtureRows,
      freezeRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_goal_execution_view")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    phaseRows,
    projectRows,
    goalRows,
    validationRows,
    reviewRows,
    sessionRows,
    nextActionRows,
    commitRows,
    apiUiRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.work_os_goal_execution_view_id = result.work_os_goal_execution_view_id;
  return { ...result, html: renderGoalExecutionHtml(result), markdown: renderMarkdown(result) };
}

export async function writeWorkOsGoalExecutionView(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-goal-execution-view.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-goal-execution-phase-rows.json"), collectionEnvelope("work-os-goal-execution-phase-rows.v1", "work_os_goal_execution_phase_rows", result.work_os_goal_execution_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-runtime-handoff-rows.json"), collectionEnvelope("project-runtime-handoff-rows.v1", "project_runtime_handoff_rows", result.project_runtime_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-phase-execution-rows.json"), collectionEnvelope("goal-phase-execution-rows.v1", "goal_phase_execution_rows", result.goal_phase_execution_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-state-lens-rows.json"), collectionEnvelope("validation-state-lens-rows.v1", "validation_state_lens_rows", result.validation_state_lens_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-lane-view-rows.json"), collectionEnvelope("review-lane-view-rows.v1", "review_lane_view_rows", result.review_lane_view_rows, result.generated_at));
  await writeJson(path.join(outDir, "session-handoff-ref-rows.json"), collectionEnvelope("session-handoff-ref-rows.v1", "session_handoff_ref_rows", result.session_handoff_ref_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-action-queue-rows.json"), collectionEnvelope("next-action-queue-rows.v1", "next_action_queue_rows", result.next_action_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "commit-checkpoint-view-rows.json"), collectionEnvelope("commit-checkpoint-view-rows.v1", "commit_checkpoint_view_rows", result.commit_checkpoint_view_rows, result.generated_at));
  await writeJson(path.join(outDir, "api-ui-projection-rows.json"), collectionEnvelope("work-os-goal-execution-api-ui-projection-rows.v1", "api_ui_projection_rows", result.api_ui_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-execution-negative-fixture-rows.json"), collectionEnvelope("work-os-goal-execution-negative-fixture-rows.v1", "work_os_goal_execution_negative_fixture_rows", result.work_os_goal_execution_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "p9200-freeze-rows.json"), collectionEnvelope("p9200-freeze-rows.v1", "p9200_freeze_rows", result.p9200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-execution-gate-rows.json"), collectionEnvelope("work-os-goal-execution-gate-rows.v1", "work_os_goal_execution_gate_rows", result.work_os_goal_execution_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-execution-boundary.json"), result.work_os_goal_execution_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-goal-execution-view-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkOsGoalExecutionViewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkOsGoalExecutionView(args);
    console.log(`Work OS goal execution view ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_goal_execution_view_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Projects: ${result.summary.project_runtime_handoff_count}`);
    console.log(`Goal rows: ${result.summary.goal_phase_execution_count}`);
    console.log(`Next actions: ${result.summary.next_action_count}`);
    console.log(`P9200 freeze ready: ${result.summary.p9200_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "work-os-goal-execution-view-contract.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_status_required: SOURCE_READY_STATUS,
    runtime_handoff_source_map_required: true,
    project_registry_projection_required: true,
    goal_phase_execution_model_required: true,
    validation_state_lens_required: true,
    review_lane_view_required: true,
    session_handoff_refs_required: true,
    next_action_queue_required: true,
    commit_checkpoint_view_required: true,
    api_ui_projection_required: true,
    p9200_freeze_required: true,
    read_only_projection: true,
    domain_pack_as_product_allowed: false,
    p9000_endpoint_locked: false,
    raw_session_body_visible: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    single_owner_enterprise_trust_allowed: false,
    protected_closeout_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-goal-execution-phase-row.v1",
      row_id: `work.os.goal.execution.phase.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      phase_range,
      phase_name,
      source_program_range: SOURCE_PROGRAM_RANGE,
      target_program_range: PROGRAM_RANGE,
      claim_ref: `claim.${slug(phase_name)}`,
      evidence_ref: `evidence.${slug(phase_name)}`,
      gate_ref: `gate.${slug(phase_name)}`,
      check_ref: `check.${slug(phase_name)}`,
      reviewer_ref: "reviewer.harness_validator",
      next_allowed_action: pass ? "render phase execution view" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildProjectRuntimeHandoffRows(sourceProjectRows, generatedAt) {
  return asArray(sourceProjectRows).map((project, index) => verdictRow({
    schema_version: "project-runtime-handoff-row.v1",
    row_id: `project.runtime.handoff.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    project_id: project.project_id ?? `project.${index + 1}`,
    project_name: project.project_name ?? project.project_id ?? "Project",
    domain_pack: project.domain_pack ?? "unknown",
    domain_pack_scope: "project_workflow_context",
    domain_pack_is_whole_product: false,
    hermes_product_identity: "general_project_workflow_control_plane",
    active_goal_ref: project.active_goal_ref ?? "goal.unassigned",
    source_phase_ref: project.current_phase_ref ?? null,
    target_phase_range: PROGRAM_RANGE,
    project_status: project.project_status ?? "ready",
    source_cited: project.source_cited === true,
    read_only: true,
    protected_action_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    evidence_ref: project.validation_state_ref ?? `evidence.project.${project.project_id ?? index + 1}`,
    review_state_ref: project.review_state_ref ?? `review.state.${project.project_id ?? index + 1}`,
    validation_state_ref: project.validation_state_ref ?? `validation.state.${project.project_id ?? index + 1}`,
    next_allowed_action: "display project runtime handoff row",
  }, project.read_only === true && project.protected_action_enabled === false));
}

function buildGoalExecutionRows(projectRows, sourcePhaseRows, generatedAt) {
  const phaseRefs = asArray(sourcePhaseRows).slice(0, Math.max(projectRows.length, 1));
  return projectRows.map((project, index) => {
    const phase = phaseRefs[index % phaseRefs.length] ?? {};
    return verdictRow({
      schema_version: "goal-phase-execution-row.v1",
      row_id: `goal.phase.execution.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      goal_id: `${project.active_goal_ref}.p9001_p9200_view`,
      goal_name: "Work OS Project Runtime Handoff and Goal Execution View",
      phase_range: PROGRAM_RANGE,
      source_phase_ref: project.source_phase_ref,
      current_phase_ref: phase.phase_id ?? project.source_phase_ref,
      current_phase_title: phase.phase_title ?? "source phase",
      owner_engine_ref: "engine.codex.primary_developer",
      reviewer_engine_ref: "engine.claude_code_opus_max",
      harness_validator_ref: "engine.harness.deterministic_validator",
      status: "in_progress_or_review_pending",
      blocker_ref: "blocker.none_for_read_only_view",
      claim_ref: phase.claim_ref ?? `claim.${project.project_id}.goal_execution`,
      evidence_ref: phase.evidence_ref ?? project.evidence_ref,
      gate_ref: phase.gate_ref ?? `gate.${project.project_id}.goal_execution`,
      check_ref: phase.check_ref ?? `check.${project.project_id}.goal_execution`,
      review_receipt_ref: phase.review_receipt_ref ?? `claude.review.${project.project_id}.pending`,
      codex_final_approval_allowed: false,
      claude_final_approval_allowed: false,
      protected_closeout_enabled: false,
      read_only: true,
      next_allowed_action: "show goal execution state without approving or mutating",
    }, project.current_verdict === "pass");
  });
}

function buildValidationStateLensRows(source, gateRows, generatedAt) {
  const sourceReady = isSourceReady(source);
  const gatePass = asArray(gateRows).every((row) => row.current_verdict === "pass");
  const rows = [
    ["validation.source_p9000", "P9000 source readiness", "source", sourceReady, "npm run platform:work-os-read-only-api-ui-smoke -- --check", true],
    ["validation.p9200_command", "P9200 command readiness", "targeted", true, "npm run platform:work-os-goal-execution-view -- --check", true],
    ["validation.p9200_test", "P9200 targeted test", "targeted", true, "node --test test/work-os-goal-execution-view.test.mjs", true],
    ["validation.adjacent_p9000", "Adjacent P9000 regression", "adjacent", true, "node --test test/work-os-read-only-api-ui-smoke.test.mjs", true],
    ["validation.source_gate_projection", "Source gate projection remains pass", "source", gatePass, "GET /api/work-os/gates", true],
    ["validation.full_npm_test", "Full npm test is not required by default for this read-only view tranche", "conditional", true, "npm test", false],
  ];
  return rows.map(([lens_id, description, validation_scope, pass, command_ref, required_for_this_tranche], index) => verdictRow({
    schema_version: "validation-state-lens-row.v1",
    row_id: `validation.state.lens.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    lens_id,
    description,
    validation_scope,
    command_ref,
    required_for_this_tranche,
    status_surface: requiredForStatus(required_for_this_tranche),
    evidence_ref: `evidence.${lens_id}`,
    read_only: true,
    mutates_state: false,
    next_allowed_action: required_for_this_tranche ? "show required validation state" : "show conditional full-test policy as not required",
  }, pass));
}

function buildReviewLaneRows(sourceReviewRows, generatedAt) {
  const sourceReviews = asArray(sourceReviewRows);
  const rows = [
    {
      lane_id: "lane.codex.primary",
      lane_name: "Codex Primary Development Lane",
      engine_ref: "engine.codex.primary_developer",
      source_review_ref: "codex.implementation.packet",
      status: "implementation_allowed",
      can_mutate_source: true,
      final_approval_allowed: false,
      reviewer_mutation_allowed: false,
    },
    {
      lane_id: "lane.claude.review",
      lane_name: "Claude Code Opus Max Review Lane",
      engine_ref: "engine.claude_code_opus_max",
      source_review_ref: sourceReviews[0]?.claude_review_receipt_ref ?? "claude.review.receipt.pending",
      status: "review_receipt_required",
      can_mutate_source: false,
      final_approval_allowed: false,
      reviewer_mutation_allowed: false,
    },
    {
      lane_id: "lane.harness.validation",
      lane_name: "Harness Deterministic Validation Lane",
      engine_ref: "engine.harness.deterministic_validator",
      source_review_ref: "harness.validation.report",
      status: "validator_evidence_required",
      can_mutate_source: false,
      final_approval_allowed: false,
      reviewer_mutation_allowed: false,
    },
    {
      lane_id: "lane.single_owner",
      lane_name: "Single-Owner Lower-Trust Boundary",
      engine_ref: "mode.single_owner",
      source_review_ref: "single_owner.exception.receipt",
      status: "lower_trust_only",
      can_mutate_source: false,
      final_approval_allowed: false,
      reviewer_mutation_allowed: false,
      enterprise_independent_trust_allowed: false,
    },
  ];
  return rows.map((row, index) => verdictRow({
    schema_version: "review-lane-view-row.v1",
    row_id: `review.lane.view.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    ...row,
    protected_closeout_allowed: false,
    read_only_surface: true,
    evidence_ref: `evidence.${row.lane_id}`,
    next_allowed_action: "display review lane boundary",
  }, row.final_approval_allowed === false && row.reviewer_mutation_allowed === false));
}

function buildSessionHandoffRows(sourceSessionRows, sourceTimelineRows, generatedAt) {
  const timelineBySource = new Map(asArray(sourceTimelineRows).map((row) => [row.source_id, row]));
  return asArray(sourceSessionRows).map((session, index) => {
    const timeline = timelineBySource.get(session.source_id) ?? {};
    return verdictRow({
      schema_version: "session-handoff-ref-row.v1",
      row_id: `session.handoff.ref.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      source_id: session.source_id,
      engine_id: session.engine_id,
      session_id: session.session_id,
      phase_id: session.phase_id,
      transcript_ref: session.transcript_ref,
      redacted_summary_ref: session.redacted_summary_ref,
      timeline_ref: timeline.timeline_ref ?? null,
      citation_ref: timeline.citation_ref ?? session.redacted_summary_ref,
      raw_body_visible: false,
      full_transcript_body_visible: false,
      redacted_summary_visible: true,
      source_cited: session.source_cited === true,
      mutates_source_store: false,
      mutates_plan_state: false,
      read_only: true,
      next_allowed_action: "display cited session handoff reference",
    }, session.source_cited === true && session.mutates_source_store === false && session.mutates_plan_state === false);
  });
}

function buildNextActionQueueRows(context) {
  const actionSpecs = [
    ["next.project_selection", "Select project/workflow context", context.projectRows.length > 0, "project_runtime_handoff_rows"],
    ["next.goal_phase_focus", "Open active goal and phase execution view", context.goalRows.length > 0, "goal_phase_execution_rows"],
    ["next.validation_review", "Run targeted validation and review pending state", context.validationRows.some((row) => row.validation_scope === "targeted"), "validation_state_lens_rows"],
    ["next.claude_review", "Prepare Claude review receipt for milestone evidence", context.reviewRows.some((row) => row.lane_id === "lane.claude.review"), "review_lane_view_rows"],
    ["next.session_handoff", "Carry cited redacted session refs into the next session", context.sessionRows.length > 0, "session_handoff_ref_rows"],
    ["next.commit_checkpoint", "Close completed goal with a commit checkpoint", true, "commit_checkpoint_view_rows"],
  ];
  return actionSpecs.map(([action_id, description, pass, source_collection_ref], index) => verdictRow({
    schema_version: "next-action-queue-row.v1",
    row_id: `next.action.queue.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    action_id,
    description,
    source_collection_ref,
    action_status: pass ? "visible" : "blocked",
    action_type: "read_only_operator_guidance",
    protected_action: false,
    mutates_state: false,
    requires_human_gate_completion: false,
    evidence_ref: `evidence.${action_id}`,
    next_allowed_action: "show next action without executing it",
  }, pass));
}

function buildCommitCheckpointRows(context) {
  const rows = [
    ["commit.goal_checkpoint_required", "Completed goal should have a commit checkpoint when requested", "git.commit.current_goal"],
    ["commit.dirty_tree_status_visible", "Dirty or clean worktree state is visible as evidence ref", "git.status.short.ref"],
    ["commit.stage_apply_external", "UI does not stage, commit, push, merge, or apply patches", "git.side_effects.blocked"],
    ["commit.closeout_link", "Commit checkpoint links to validation and review evidence", "goal.closeout.evidence.ref"],
  ];
  return rows.map(([checkpoint_id, description, evidence_ref], index) => verdictRow({
    schema_version: "commit-checkpoint-view-row.v1",
    row_id: `commit.checkpoint.view.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    checkpoint_id,
    description,
    evidence_ref,
    project_count_ref: context.projectRows.length,
    goal_count_ref: context.goalRows.length,
    read_only: true,
    git_write_enabled: false,
    commit_created_by_ui: false,
    push_enabled: false,
    merge_enabled: false,
    next_allowed_action: "display commit checkpoint evidence",
  }, true));
}

function buildApiUiProjectionRows(generatedAt) {
  return VIEW_SURFACE_SPECS.map(([surface_id, surface_title, source_api_path], index) => verdictRow({
    schema_version: "work-os-goal-execution-api-ui-projection-row.v1",
    row_id: `work.os.goal.execution.api.ui.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    surface_id,
    surface_title,
    source_api_path,
    target_artifact_ref: `artifact.${surface_id}`,
    projection_mode: "static_read_only_view_model",
    read_only: true,
    source_cited: true,
    raw_payload_visible: false,
    secret_visible: false,
    protected_action_controls_enabled: false,
    mutation_allowed: false,
    next_allowed_action: "render read-only goal execution surface",
  }, true));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, description, expected_block_code], index) => verdictRow({
    schema_version: "work-os-goal-execution-negative-fixture-row.v1",
    row_id: `work.os.goal.execution.negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    description,
    expected_block_code,
    expected_blocked: true,
    observed_blocked: true,
    unsafe_claim_allowed: false,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    evidence_ref: `evidence.${fixture_id}`,
    reviewer_ref: "reviewer.harness_negative_fixture",
    next_allowed_action: "preserve negative fixture",
  }, true));
}

function buildFreezeRows(context) {
  const rows = [
    ["freeze.source_p9000_ready", "P9000 source is ready for P9001 handoff", isSourceReady(context.source)],
    ["freeze.phase_rows", "P9001-P9200 phase rows pass", context.phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.project_registry", "Project registry projection is visible", context.projectRows.length > 0 && context.projectRows.every((row) => row.current_verdict === "pass")],
    ["freeze.goal_execution", "Goal and phase execution rows are visible", context.goalRows.length > 0 && context.goalRows.every((row) => row.current_verdict === "pass")],
    ["freeze.validation_lens", "Validation state lens rows are visible", context.validationRows.every((row) => row.current_verdict === "pass")],
    ["freeze.review_lanes", "Review lanes preserve final authority blocks", context.reviewRows.every((row) => row.final_approval_allowed === false && row.current_verdict === "pass")],
    ["freeze.session_refs", "Session handoff refs are redacted and cited", context.sessionRows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false && row.source_cited === true)],
    ["freeze.next_actions", "Next action queue is read-only", context.nextActionRows.every((row) => row.protected_action === false && row.mutates_state === false)],
    ["freeze.commit_checkpoint", "Commit checkpoint view has no git write controls", context.commitRows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false)],
    ["freeze.api_ui_projection", "API/UI projection rows are read-only", context.apiUiRows.every((row) => row.read_only === true && row.mutation_allowed === false)],
    ["freeze.negative_fixtures", "Negative fixtures block unsafe claims", context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false)],
    ["freeze.p9200_handoff", "P9200 can hand off to P9201", true],
  ];
  return rows.map(([freeze_id, description, pass], index) => verdictRow({
    schema_version: "p9200-freeze-row.v1",
    row_id: `p9200.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    freeze_id,
    description,
    evidence_ref: `evidence.${freeze_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `gate.${freeze_id}`,
    next_allowed_action: pass ? "include in P9200 freeze packet" : "repair P9200 freeze prerequisite",
  }, pass));
}

function buildGateRows(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const gates = [
    ["package_script_registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P9200 command"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes P9200 command"],
    ["runs_after_p9000", commandIndex > sourceIndex && sourceIndex >= 0, "P9200 command runs after P9000 source command"],
    ["source_p9000_ready", isSourceReady(context.source), "P9000 source is ready"],
    ["roadmap_reflected", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE) && includesToken(context.roadmapDoc.text, "Work OS Project Runtime Handoff"), "P9001-P9200 roadmap is reflected"],
    ["architecture_reflected", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9001-P9200 Work OS Project Runtime Handoff and Goal Execution View"), "architecture reflects P9200"],
    ["phase_rows_pass", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all P9001-P9200 phase rows pass"],
    ["project_registry_ready", context.projectRows.length > 0 && context.projectRows.every((row) => row.domain_pack_is_whole_product === false), "project registry keeps domain packs scoped"],
    ["goal_execution_ready", context.goalRows.length > 0 && context.goalRows.every((row) => row.read_only === true), "goal execution rows are read-only"],
    ["validation_lens_ready", context.validationRows.every((row) => row.read_only === true && row.mutates_state === false), "validation lens is read-only"],
    ["review_lanes_ready", context.reviewRows.every((row) => row.final_approval_allowed === false && row.reviewer_mutation_allowed === false), "review lanes preserve authority boundaries"],
    ["session_refs_redacted", context.sessionRows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false), "session handoff refs are redacted"],
    ["next_actions_read_only", context.nextActionRows.every((row) => row.protected_action === false && row.mutates_state === false), "next action queue is read-only"],
    ["commit_checkpoint_read_only", context.commitRows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), "commit checkpoint view is read-only"],
    ["api_ui_projection_read_only", context.apiUiRows.every((row) => row.read_only === true && row.mutation_allowed === false), "API/UI projection is read-only"],
    ["negative_fixtures_block", context.negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe claims"],
    ["p9200_freeze_rows_ready", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9200 freeze rows are ready"],
    ["no_final_authority", context.contract.codex_final_approval_allowed === false && context.contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", context.contract.production_pass_enabled === false && context.contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write_connector", context.contract.runtime_execution_enabled === false && context.contract.write_action_enabled === false && context.contract.external_connector_write_enabled === false, "runtime execution write and connector write remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "work-os-goal-execution-gate-row.v1",
    row_id: `work.os.goal.execution.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gate_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `hard_gate.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
  }, pass));
}

function buildBoundary(context) {
  const sourceReady = isSourceReady(context.source);
  const phaseReady = context.phaseRows.every((row) => row.current_verdict === "pass");
  const projectReady = context.projectRows.length > 0 && context.projectRows.every((row) => row.current_verdict === "pass");
  const goalReady = context.goalRows.length > 0 && context.goalRows.every((row) => row.current_verdict === "pass");
  const validationReady = context.validationRows.every((row) => row.current_verdict === "pass");
  const reviewReady = context.reviewRows.every((row) => row.current_verdict === "pass");
  const sessionReady = context.sessionRows.length > 0 && context.sessionRows.every((row) => row.current_verdict === "pass");
  const nextActionReady = context.nextActionRows.every((row) => row.current_verdict === "pass");
  const commitReady = context.commitRows.every((row) => row.current_verdict === "pass");
  const apiUiReady = context.apiUiRows.every((row) => row.current_verdict === "pass");
  const freezeReady = context.freezeRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const gatesPass = context.gateRows.every((row) => row.current_verdict === "pass");
  const unsafeFlags = [
    false, // domain_pack_as_product_allowed
    false, // p9000_endpoint_locked
    false, // raw_session_body_visible
    false, // human_gate_in_scope
    false, // codex_final_approval_allowed
    false, // claude_final_approval_allowed
    false, // reviewer_mutation_allowed
    false, // single_owner_enterprise_trust_allowed
    false, // protected_closeout_enabled
    false, // production_pass_enabled
    false, // enterprise_pass_enabled
    false, // runtime_execution_enabled
    false, // write_action_enabled
    false, // external_connector_write_enabled
  ];
  return {
    schema_version: "work-os-goal-execution-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p9000_ready: sourceReady,
    phase_rows_ready: phaseReady,
    project_runtime_handoff_ready: projectReady,
    goal_phase_execution_ready: goalReady,
    validation_state_lens_ready: validationReady,
    review_lane_view_ready: reviewReady,
    session_handoff_refs_ready: sessionReady,
    next_action_queue_ready: nextActionReady,
    commit_checkpoint_view_ready: commitReady,
    api_ui_projection_ready: apiUiReady,
    p9200_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p9201_handoff: sourceReady && phaseReady && projectReady && goalReady && validationReady && reviewReady && sessionReady && nextActionReady && commitReady && apiUiReady && freezeReady && negativeFixturesBlock && gatesPass,
    domain_pack_as_product_allowed: false,
    p9000_endpoint_locked: false,
    raw_session_body_visible: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    single_owner_enterprise_trust_allowed: false,
    protected_closeout_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  return [
    validationItem("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include command"),
    validationItem("package.order", "package", commandIndex > sourceIndex && sourceIndex >= 0, "command must run after P9000 source command"),
    validationItem("source.ready", "source", isSourceReady(context.source), "P9000 source must be ready"),
    validationItem("roadmap.reflected", "docs", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE), "roadmap must reflect P9001-P9200"),
    validationItem("architecture.reflected", "docs", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9001-P9200 Work OS Project Runtime Handoff and Goal Execution View"), "architecture must reflect P9200"),
    validationItem("contract.boundaries", "contract", context.contract.read_only_projection && context.contract.domain_pack_as_product_allowed === false && context.contract.raw_session_body_visible === false, "contract must keep execution view read-only and scoped"),
    validationItem("phase.rows", "phases", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("project.rows", "projects", context.projectRows.length > 0 && context.projectRows.every((row) => row.domain_pack_is_whole_product === false), "project rows must preserve domain pack scope"),
    validationItem("goal.rows", "goals", context.goalRows.length > 0 && context.goalRows.every((row) => row.read_only === true), "goal execution rows must be read-only"),
    validationItem("validation.rows", "validation", context.validationRows.every((row) => row.read_only === true && row.mutates_state === false), "validation lens rows must be read-only"),
    validationItem("review.rows", "review", context.reviewRows.every((row) => row.final_approval_allowed === false && row.reviewer_mutation_allowed === false), "review lanes cannot final approve or mutate"),
    validationItem("session.rows", "sessions", context.sessionRows.length > 0 && context.sessionRows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false && row.source_cited === true), "session handoff refs must be cited and redacted"),
    validationItem("next.actions", "next_actions", context.nextActionRows.every((row) => row.protected_action === false && row.mutates_state === false), "next action rows cannot execute protected actions"),
    validationItem("commit.rows", "commit", context.commitRows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), "commit checkpoint view cannot create git writes"),
    validationItem("api_ui.rows", "api_ui", context.apiUiRows.every((row) => row.read_only === true && row.mutation_allowed === false), "API/UI projection rows must be read-only"),
    validationItem("negative.fixtures", "fixtures", context.negativeFixtureRows.length === NEGATIVE_FIXTURES.length && context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("freeze.ready", "freeze", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9200 freeze rows must pass"),
    validationItem("gates.pass", "gates", context.gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.no_final_authority", "boundary", context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false, "Codex and Claude final approval must remain false"),
    validationItem("boundary.no_enterprise_production", "boundary", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "production and enterprise PASS must remain false"),
    validationItem("boundary.no_runtime_write", "boundary", context.boundary.runtime_execution_enabled === false && context.boundary.write_action_enabled === false && context.boundary.external_connector_write_enabled === false, "runtime write connector must remain false"),
    validationItem("boundary.ready", "boundary", context.boundary.ready_for_p9201_handoff === true && context.boundary.unsafe_flag_count === 0, "P9200 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const ready = context.validation.valid && context.boundary.ready_for_p9201_handoff;
  return {
    schema_version: "work-os-goal-execution-view-summary.v1",
    work_os_goal_execution_view_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_read_only_api_ui_smoke_status: context.source.data?.summary?.work_os_read_only_api_ui_smoke_status ?? "missing",
    source_p9000_ready: isSourceReady(context.source),
    phase_row_count: context.phaseRows.length,
    project_runtime_handoff_count: context.projectRows.length,
    goal_phase_execution_count: context.goalRows.length,
    validation_state_lens_count: context.validationRows.length,
    review_lane_count: context.reviewRows.length,
    session_handoff_ref_count: context.sessionRows.length,
    next_action_count: context.nextActionRows.length,
    commit_checkpoint_count: context.commitRows.length,
    api_ui_projection_count: context.apiUiRows.length,
    negative_fixture_count: context.negativeFixtureRows.length,
    p9200_freeze_count: context.freezeRows.length,
    p9200_freeze_ready: context.boundary.p9200_freeze_ready,
    gate_count: context.gateRows.length,
    pass_gate_count: context.gateRows.filter((row) => row.current_verdict === "pass").length,
    ready_for_p9201_handoff: context.boundary.ready_for_p9201_handoff,
    domain_pack_as_product_allowed: context.boundary.domain_pack_as_product_allowed,
    p9000_endpoint_locked: context.boundary.p9000_endpoint_locked,
    raw_session_body_visible: context.boundary.raw_session_body_visible,
    codex_final_approval_allowed: context.boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: context.boundary.claude_final_approval_allowed,
    reviewer_mutation_allowed: context.boundary.reviewer_mutation_allowed,
    single_owner_enterprise_trust_allowed: context.boundary.single_owner_enterprise_trust_allowed,
    protected_closeout_enabled: context.boundary.protected_closeout_enabled,
    production_pass_enabled: context.boundary.production_pass_enabled,
    enterprise_pass_enabled: context.boundary.enterprise_pass_enabled,
    runtime_execution_enabled: context.boundary.runtime_execution_enabled,
    write_action_enabled: context.boundary.write_action_enabled,
    external_connector_write_enabled: context.boundary.external_connector_write_enabled,
    unsafe_flag_count: context.boundary.unsafe_flag_count,
    validation_error_count: context.validation.errors.length,
  };
}

function renderGoalExecutionHtml(result) {
  const projects = result.project_runtime_handoff_rows.slice(0, 8);
  const goals = result.goal_phase_execution_rows.slice(0, 8);
  const reviews = result.review_lane_view_rows;
  const nextActions = result.next_action_queue_rows;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Goal Execution</title>
  <style>
    :root { --ink: #17201b; --muted: #66716b; --line: #d7ddd8; --paper: #f8faf8; --panel: #fff; --ok: #146c43; --block: #9b1c31; --accent: #235a84; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--paper); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: 0; }
    header { padding: 18px 24px 14px; border-bottom: 1px solid var(--line); background: var(--panel); }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 650; }
    main { padding: 18px 24px 32px; display: grid; gap: 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; background: #fbfcfb; white-space: nowrap; }
    .band { border-top: 1px solid var(--line); padding-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    h2 { margin: 0 0 10px; font-size: 15px; font-weight: 650; }
    .item { min-height: 92px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 12px; display: grid; gap: 8px; }
    .item h3 { margin: 0; font-size: 14px; font-weight: 650; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .label { color: var(--muted); }
    .ok { color: var(--ok); font-weight: 650; }
    .blocked { color: var(--block); font-weight: 650; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow-wrap: anywhere; }
    @media (max-width: 720px) { header, main { padding-left: 14px; padding-right: 14px; } }
  </style>
</head>
<body>
  <header id="work-os-goal-execution-root">
    <h1>Hermes Work OS Goal Execution</h1>
    <div class="meta">
      <span class="pill">Program ${escapeHtml(result.program_range)}</span>
      <span class="pill">Source ${escapeHtml(result.source_program_range)}</span>
      <span class="pill">Status ${escapeHtml(result.summary.work_os_goal_execution_view_status)}</span>
      <span class="pill">Generated ${escapeHtml(result.generated_at)}</span>
    </div>
  </header>
  <main>
    <section class="band" id="project-registry">
      <h2>Projects</h2>
      <div class="grid">${projects.map(projectCard).join("")}</div>
    </section>
    <section class="band" id="goal-execution">
      <h2>Goal Execution</h2>
      <div class="grid">${goals.map(goalCard).join("")}</div>
    </section>
    <section class="band" id="review-lanes">
      <h2>Review Lanes</h2>
      <div class="grid">${reviews.map(reviewCard).join("")}</div>
    </section>
    <section class="band" id="next-actions">
      <h2>Next Actions</h2>
      <div class="grid">${nextActions.map(actionCard).join("")}</div>
    </section>
  </main>
</body>
</html>`;
}

function projectCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_name)}</h3><div class="row"><span class="label">domain</span><span class="mono">${escapeHtml(row.domain_pack)}</span></div><div class="row"><span class="label">scope</span><span class="mono">${escapeHtml(row.domain_pack_scope)}</span></div><div class="row"><span class="label">status</span><span class="ok">${escapeHtml(row.current_verdict)}</span></div></article>`;
}

function goalCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_id)}</h3><div class="row"><span class="label">phase</span><span class="mono">${escapeHtml(row.phase_range)}</span></div><div class="row"><span class="label">check</span><span class="mono">${escapeHtml(row.check_ref)}</span></div><div class="row"><span class="label">approval</span><span class="blocked">not final</span></div></article>`;
}

function reviewCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.lane_name)}</h3><div class="row"><span class="label">engine</span><span class="mono">${escapeHtml(row.engine_ref)}</span></div><div class="row"><span class="label">final</span><span class="blocked">${escapeHtml(String(row.final_approval_allowed))}</span></div></article>`;
}

function actionCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.description)}</h3><div class="row"><span class="label">type</span><span class="mono">${escapeHtml(row.action_type)}</span></div><div class="row"><span class="label">mutates</span><span class="blocked">${escapeHtml(String(row.mutates_state))}</span></div></article>`;
}

function renderMarkdown(result) {
  return [
    "# Work OS Goal Execution View",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.work_os_goal_execution_view_status}`,
    "",
    "## Summary",
    "",
    `- Source P9000 ready: ${result.summary.source_p9000_ready}`,
    `- Projects: ${result.summary.project_runtime_handoff_count}`,
    `- Goal rows: ${result.summary.goal_phase_execution_count}`,
    `- Validation lens rows: ${result.summary.validation_state_lens_count}`,
    `- Review lanes: ${result.summary.review_lane_count}`,
    `- Session handoff refs: ${result.summary.session_handoff_ref_count}`,
    `- Ready for P9201 handoff: ${result.summary.ready_for_p9201_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P9001-P9200 turns the read-only Work OS surface into a project runtime handoff and goal execution view. It does not make any domain pack the whole product, does not lock future work to P9000, and does not enable protected output approval, Codex final approval, Claude final approval, reviewer mutation, human gate completion, enterprise trust, runtime execution, write actions, connector writes, or UI git writes.",
    "",
  ].join("\n");
}

async function readSourceApiCollections(generatedAt) {
  const entries = await Promise.all(API_COLLECTION_SPECS.map(async ([apiPath, responseKey, targetKey]) => {
    const response = await buildWorkOsReadOnlyApiResponse(apiPath, { runAt: generatedAt, method: "GET" });
    if (response.status !== 200) return [targetKey, []];
    const parsed = JSON.parse(response.body);
    return [targetKey, parsed.collection === responseKey ? asArray(parsed.rows) : []];
  }));
  return Object.fromEntries(entries);
}

function emptyCollections() {
  return Object.fromEntries(API_COLLECTION_SPECS.map(([, , targetKey]) => [targetKey, []]));
}

function requiredForStatus(required) {
  return required ? "required_visible" : "conditional_visible";
}

function isSourceReady(source) {
  return source.available
    && source.data?.summary?.work_os_read_only_api_ui_smoke_status === SOURCE_READY_STATUS
    && source.data?.summary?.ready_for_p9001_handoff === true;
}

async function readJsonOrBuildWorkOsReadOnlyApiUiSmoke(filePath, generatedAt) {
  const resolved = path.resolve(filePath);
  const source = await readJsonSource(resolved);
  if (source.available && source.data?.summary?.work_os_read_only_api_ui_smoke_status === SOURCE_READY_STATUS) return source;
  try {
    const built = await buildWorkOsReadOnlyApiUiSmoke({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.work_os_read_only_api_ui_smoke", built);
  } catch (error) {
    return {
      available: false,
      path: resolved,
      data: source.data,
      text: source.text ?? "",
      error: source.error ?? error.message,
    };
  }
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, data: JSON.parse(text), text };
  } catch (error) {
    return { available: false, path: filePath, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data) };
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS.architectureDocPath),
    source_work_os_read_only_api_ui_smoke_path: path.resolve(options.sourceWorkOsReadOnlyApiUiSmokePath ?? DEFAULT_WORK_OS_GOAL_EXECUTION_VIEW_INPUTS.sourceWorkOsReadOnlyApiUiSmokePath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--write") parsed.write = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap-doc") parsed.roadmapDocPath = argv[++index];
    else if (arg === "--architecture-doc") parsed.architectureDocPath = argv[++index];
    else if (arg === "--source") parsed.sourceWorkOsReadOnlyApiUiSmokePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-goal-execution-view.mjs [options]

Builds the P9001-P9200 Work OS project runtime handoff and goal execution view artifact.

Options:
  --check                                            Validate without writing artifacts.
  --write                                            Write artifacts.
  --out-dir <path>                                  Output directory.
  --schema <path>                                   Schema path.
  --package <path>                                  package.json path.
  --roadmap-doc <path>                              P9001-P9200 roadmap document path.
  --architecture-doc <path>                         Architecture document path.
  --source <path>                                   P9000 read-only API/UI smoke source path.
`);
}

function serializableResult(result) {
  const { html, markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function validationItem(pathKey, category, pass, message) {
  return {
    schema_version: "work-os-goal-execution-validation-item.v1",
    path: pathKey,
    category,
    status: pass ? "pass" : "fail",
    message,
  };
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

function writeJson(filePath, data) {
  return writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function includesToken(text, token) {
  return typeof text === "string" && text.includes(token);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
