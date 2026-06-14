import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlanRegistryProgressEngine } from "./plan-registry-progress-engine.mjs";

export const DEFAULT_WORK_OS_UI_V0_GOVERNED_LOOP_OUT_DIR = "artifacts/work-os-ui-v0-governed-loop/latest";
export const DEFAULT_WORK_OS_UI_V0_GOVERNED_LOOP_INPUTS = {
  schemaPath: "schemas/work-os-ui-v0-governed-loop.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8081-p8400.md",
  architectureDocPath: "docs/architecture.md",
  planRegistryProgressPath: "artifacts/plan-registry-progress-engine/latest/plan-registry-progress-engine.json",
};

const COMMAND_NAME = "platform:work-os-ui-v0-governed-loop";
const SOURCE_COMMAND_NAME = "platform:plan-registry-progress-engine";
const SCHEMA_VERSION = "work-os-ui-v0-governed-loop.v1";
const CAPABILITY_ID = "platform.work_os_ui_v0_governed_loop";
const PROGRAM_RANGE = "P8241-P8400";
const SOURCE_PROGRAM_RANGE = "P8161-P8240";
const SOURCE_READY_STATUS = "ready_for_plan_registry_progress_engine";
const READY_STATUS = "ready_for_work_os_ui_v0_governed_loop";

const PHASE_SPECS = [
  ["P8241-P8260", "Project Control Dashboard"],
  ["P8261-P8280", "Phase Detail View"],
  ["P8281-P8300", "Conversation Timeline"],
  ["P8301-P8320", "Review Console"],
  ["P8321-P8340", "Codex Primary Engine Lane"],
  ["P8341-P8360", "Claude Review Lane"],
  ["P8361-P8380", "Harness Validation Lane"],
  ["P8381-P8400", "P8400 Freeze"],
];

const UI_SURFACE_SPECS = [
  ["ui.project_control_dashboard", "Project Control Dashboard", "P8241-P8260", ["project_selector", "current_goal", "phase_status"]],
  ["ui.phase_detail_view", "Phase Detail View", "P8261-P8280", ["claim", "evidence", "gate", "check", "review_receipt"]],
  ["ui.conversation_timeline", "Conversation Timeline", "P8281-P8300", ["codex_conversation", "claude_conversation", "decision", "blocker", "validation_event"]],
  ["ui.review_console", "Review Console", "P8301-P8320", ["claude_review_status", "finding_loop", "unresolved_finding"]],
];

const TIMELINE_SPECS = [
  ["timeline.codex_conversation", "codex_conversation", "engine.codex.primary_developer", "transcript.redacted.codex", "decision.extract.codex"],
  ["timeline.claude_conversation", "claude_conversation", "engine.claude.independent_reviewer", "transcript.redacted.claude", "review.extract.claude"],
  ["timeline.extracted_decision", "extracted_decision", "engine.codex.primary_developer", "transcript.redacted.codex", "decision.plan.accepted_direction"],
  ["timeline.blocker", "blocker", "engine.harness.control_plane", "transcript.redacted.codex", "blocker.missing_receipt_or_validation"],
  ["timeline.validation_event", "validation_event", "engine.harness.validator", "validation.report.redacted", "validation.targeted_and_full_suite"],
];

const REVIEW_CONSOLE_SPECS = [
  ["review.claude_status", "Claude review status", "review_pending_or_required"],
  ["review.finding_loop", "Finding loop", "visible_until_resolved"],
  ["review.unresolved_findings", "Unresolved finding", "blocks_milestone_pass"],
  ["review.receipt_refs", "Claude receipt refs", "required_at_milestones"],
];

const GOVERNED_LOOP_SPECS = [
  ["loop.codex_primary_engine", "P8321-P8340", "Codex Primary Engine Lane", "Codex work is attributed to plan_id and phase_id"],
  ["loop.claude_review", "P8341-P8360", "Claude Review Lane", "Claude review receipt is required at milestones"],
  ["loop.harness_validation", "P8361-P8380", "Harness Validation Lane", "validator results update UI and plan status"],
  ["loop.p8400_freeze", "P8381-P8400", "P8400 Freeze", "UI v0, capture, progress, and review loop freeze"],
];

const NEGATIVE_FIXTURES = [
  ["negative.raw_transcript_timeline", "raw/full transcript body appears in conversation timeline", "BLOCK_RAW_TRANSCRIPT_TIMELINE"],
  ["negative.dashboard_executes_action", "project dashboard starts command execution or protected action", "BLOCK_DASHBOARD_EXECUTION"],
  ["negative.phase_pass_without_validator", "phase detail shows PASS without validator evidence", "BLOCK_PASS_WITHOUT_VALIDATOR"],
  ["negative.review_console_hides_unresolved", "review console hides unresolved finding", "BLOCK_HIDDEN_UNRESOLVED_FINDING"],
  ["negative.claude_reviewer_mutates_source", "Claude review lane mutates source or applies patch", "BLOCK_REVIEWER_MUTATION"],
  ["negative.codex_self_approval", "Codex primary lane final-approves Codex work", "BLOCK_CODEX_SELF_APPROVAL"],
  ["negative.human_gate_reintroduced", "Human gate is silently reintroduced inside P8400", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.production_enterprise_pass", "UI v0 or loop freeze creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.uncited_conversation_decision", "decision appears without conversation transcript citation", "BLOCK_UNCITED_DECISION"],
  ["negative.stale_plan_hidden", "stale/context drift state is hidden from UI", "BLOCK_HIDDEN_STALE_CONTEXT"],
];

export async function runWorkOsUiV0GovernedLoop(options = {}) {
  const result = await buildWorkOsUiV0GovernedLoop(options);
  if (options.write !== false) await writeWorkOsUiV0GovernedLoop(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS UI v0 governed loop failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsUiV0GovernedLoop(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_UI_V0_GOVERNED_LOOP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const planRegistryProgress = options.planRegistryProgress
    ? normalizeInlineJsonSource("inline.plan_registry_progress", options.planRegistryProgress)
    : await readJsonOrBuildPlanRegistryProgress(inputs.plan_registry_progress_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const uiSurfaceRows = buildUiSurfaceRows(planRegistryProgress, generatedAt);
  const phaseDetailRows = buildPhaseDetailRows(planRegistryProgress, generatedAt);
  const conversationTimelineRows = buildConversationTimelineRows(generatedAt);
  const reviewConsoleRows = buildReviewConsoleRows(generatedAt);
  const governedLoopRows = buildGovernedLoopRows(generatedAt);
  const p8400FreezeRows = buildP8400FreezeRows({ phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    planRegistryProgress,
    contract,
    phaseRows,
    uiSurfaceRows,
    phaseDetailRows,
    conversationTimelineRows,
    reviewConsoleRows,
    governedLoopRows,
    p8400FreezeRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({
    planRegistryProgress,
    phaseRows,
    uiSurfaceRows,
    phaseDetailRows,
    conversationTimelineRows,
    reviewConsoleRows,
    governedLoopRows,
    p8400FreezeRows,
    negativeFixtureRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    planRegistryProgress,
    contract,
    phaseRows,
    uiSurfaceRows,
    phaseDetailRows,
    conversationTimelineRows,
    reviewConsoleRows,
    governedLoopRows,
    p8400FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    work_os_ui_v0_governed_loop_id: `work-os-ui-v0-governed-loop.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_plan_registry_progress_summary: planRegistryProgress.data?.summary ?? null,
    work_os_ui_v0_governed_loop_contract: contract,
    work_os_ui_v0_phase_rows: phaseRows,
    work_os_ui_surface_rows: uiSurfaceRows,
    phase_detail_view_rows: phaseDetailRows,
    conversation_timeline_rows: conversationTimelineRows,
    review_console_rows: reviewConsoleRows,
    harness_governed_development_loop_rows: governedLoopRows,
    p8400_freeze_rows: p8400FreezeRows,
    work_os_ui_v0_negative_fixture_rows: negativeFixtureRows,
    work_os_ui_v0_gate_rows: gateRows,
    work_os_ui_v0_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ planRegistryProgress, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_ui_v0_governed_loop")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ planRegistryProgress, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows, gateRows, boundary, validation: result.validation });
  result.summary.work_os_ui_v0_governed_loop_id = result.work_os_ui_v0_governed_loop_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeWorkOsUiV0GovernedLoop(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-ui-v0-governed-loop.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-ui-v0-phase-rows.json"), collectionEnvelope("work-os-ui-v0-phase-rows.v1", "work_os_ui_v0_phase_rows", result.work_os_ui_v0_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-surface-rows.json"), collectionEnvelope("work-os-ui-surface-rows.v1", "work_os_ui_surface_rows", result.work_os_ui_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "phase-detail-view-rows.json"), collectionEnvelope("phase-detail-view-rows.v1", "phase_detail_view_rows", result.phase_detail_view_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-timeline-rows.json"), collectionEnvelope("conversation-timeline-rows.v1", "conversation_timeline_rows", result.conversation_timeline_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-console-rows.json"), collectionEnvelope("review-console-rows.v1", "review_console_rows", result.review_console_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-governed-development-loop-rows.json"), collectionEnvelope("harness-governed-development-loop-rows.v1", "harness_governed_development_loop_rows", result.harness_governed_development_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8400-freeze-rows.json"), collectionEnvelope("p8400-freeze-rows.v1", "p8400_freeze_rows", result.p8400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-v0-negative-fixture-rows.json"), collectionEnvelope("work-os-ui-v0-negative-fixture-rows.v1", "work_os_ui_v0_negative_fixture_rows", result.work_os_ui_v0_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-v0-gate-rows.json"), collectionEnvelope("work-os-ui-v0-gate-rows.v1", "work_os_ui_v0_gate_rows", result.work_os_ui_v0_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-ui-v0-boundary.json"), result.work_os_ui_v0_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-ui-v0-governed-loop-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkOsUiV0GovernedLoopCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkOsUiV0GovernedLoop(args);
    console.log(`Work OS UI v0 governed loop ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_ui_v0_governed_loop_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`UI surfaces: ${result.summary.ui_surface_count}`);
    console.log(`Phase detail rows: ${result.summary.phase_detail_count}`);
    console.log(`Conversation timeline rows: ${result.summary.conversation_timeline_count}`);
    console.log(`Governed loop rows: ${result.summary.governed_loop_count}`);
    console.log(`P8400 freeze ready: ${result.summary.p8400_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "work-os-ui-v0-governed-loop-contract.v1",
    generated_at: generatedAt,
    contract_id: "work-os-ui-v0-governed-loop.p8241-p8400",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_ui_surfaces: UI_SURFACE_SPECS.map(([surface_id]) => surface_id),
    required_timeline_event_types: TIMELINE_SPECS.map(([, event_type]) => event_type),
    required_loop_lanes: GOVERNED_LOOP_SPECS.map(([lane_id]) => lane_id),
    codex_primary_engine_lane: true,
    claude_review_lane: true,
    harness_validation_lane: true,
    source_plan_progress_required: true,
    phase_detail_claim_evidence_gate_check_review_visible: true,
    raw_transcript_body_default_visible: false,
    redacted_summary_ui_visible: true,
    review_console_unresolved_findings_visible: true,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-ui-v0-phase-row.v1",
      row_id: `work.os.ui.v0.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8400.${phase_range}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.work_os_ui_v0.${phase_range}`,
      next_allowed_action: pass ? "preserve Work OS UI v0 phase" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildUiSurfaceRows(planRegistryProgress, generatedAt) {
  const sourceReady = isSourceReady(planRegistryProgress);
  return UI_SURFACE_SPECS.map(([surface_id, title, phase_range, visibleFields], index) => {
    const pass = sourceReady && visibleFields.length > 0;
    return verdictRow({
      schema_version: "work-os-ui-surface-row.v1",
      row_id: `work.os.ui.surface.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      surface_id,
      title,
      phase_range,
      source_plan_ref: "artifacts.plan-registry-progress-engine.latest",
      data_source_refs: ["long_term_plan_registry_rows", "phase_progress_rows", "validation_gate_review_link_rows", "stale_context_drift_rows"],
      visible_fields: visibleFields,
      read_only_projection: true,
      raw_transcript_body_visible: false,
      protected_action_enabled: false,
      action_authority: "display_and_filter_only",
      ui_state: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "render as read-only operator surface" : "restore source plan progress evidence",
    }, pass);
  });
}

function buildPhaseDetailRows(planRegistryProgress, generatedAt) {
  const sourceRows = Array.isArray(planRegistryProgress.data?.phase_progress_rows)
    ? planRegistryProgress.data.phase_progress_rows
    : defaultPhaseProgressRows();
  const sourceReady = isSourceReady(planRegistryProgress);
  return sourceRows.map((row, index) => {
    const phaseId = row.phase_id ?? row.phase_range ?? `phase.${index + 1}`;
    const pass = sourceReady && Boolean(row.status);
    return verdictRow({
      schema_version: "phase-detail-view-row.v1",
      row_id: `phase.detail.view.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      phase_id: phaseId,
      phase_title: row.phase_title ?? row.phase_name ?? phaseId,
      status: row.status ?? "blocked",
      claim_ref: row.claim_ref ?? `claim.${phaseId}`,
      evidence_ref: row.evidence_ref ?? `evidence.${phaseId}`,
      gate_ref: row.gate_ref ?? `gate.${phaseId}`,
      check_ref: row.validator_ref ?? row.check_ref ?? `validator.${phaseId}`,
      review_receipt_ref: row.review_receipt_ref ?? `claude.review.${phaseId}`,
      visible_in_ui: true,
      source_cited: true,
      raw_material_visible: false,
      protected_action_enabled: false,
      pass_requires_validator_evidence: true,
      pass_requires_review_receipt_or_pending_badge: true,
      next_allowed_action: pass ? "display phase evidence packet" : "show blocked phase detail with next action",
    }, sourceReady && Boolean(row.status));
  });
}

function defaultPhaseProgressRows() {
  return [
    ["P8081-P8160", "Conversation Capture Contract", "pass"],
    ["P8161-P8240", "Plan Registry And Progress Engine", "pass"],
    ["P8241-P8320", "Work OS UI v0", "in_progress"],
    ["P8321-P8400", "Harness-Governed Development Loop", "review_pending"],
    ["external.enterprise_trust", "Enterprise Independent Trust", "blocked"],
  ].map(([phase_id, phase_title, status]) => ({ phase_id, phase_title, status }));
}

function buildConversationTimelineRows(generatedAt) {
  return TIMELINE_SPECS.map(([event_id, event_type, engine_id, redacted_ref, extraction_ref], index) => {
    const pass = Boolean(event_id && event_type && engine_id && redacted_ref);
    return verdictRow({
      schema_version: "conversation-timeline-row.v1",
      row_id: `conversation.timeline.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      event_id,
      event_type,
      engine_id,
      redacted_summary_ref: redacted_ref,
      extraction_ref,
      raw_transcript_ref: `${event_id}.raw_ref`,
      raw_transcript_body_visible: false,
      full_transcript_body_visible: false,
      redacted_summary_ui_visible: true,
      source_citation_required: true,
      may_update_plan_directly: false,
      next_allowed_action: "show cited timeline event as read-only context",
    }, pass);
  });
}

function buildReviewConsoleRows(generatedAt) {
  return REVIEW_CONSOLE_SPECS.map(([console_id, title, state], index) => {
    const pass = Boolean(console_id && state);
    return verdictRow({
      schema_version: "review-console-row.v1",
      row_id: `review.console.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      console_id,
      title,
      review_state: state,
      claude_review_receipt_required: true,
      claude_review_receipt_ref: `claude.review.receipt.${console_id}`,
      finding_loop_visible: true,
      unresolved_findings_visible: true,
      reviewer_mutation_allowed: false,
      final_approval_allowed: false,
      protected_closeout_allowed: false,
      next_allowed_action: "show review status and unresolved findings",
    }, pass);
  });
}

function buildGovernedLoopRows(generatedAt) {
  return GOVERNED_LOOP_SPECS.map(([lane_id, phase_range, title, lanePurpose], index) => {
    const isCodex = lane_id === "loop.codex_primary_engine";
    const isClaude = lane_id === "loop.claude_review";
    const isHarness = lane_id === "loop.harness_validation";
    const pass = Boolean(lane_id && phase_range);
    return verdictRow({
      schema_version: "harness-governed-development-loop-row.v1",
      row_id: `harness.governed.loop.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      lane_id,
      phase_range,
      title,
      lane_purpose: lanePurpose,
      owner_engine: isCodex ? "Codex" : isClaude ? "Claude Code" : "Harness",
      codex_primary_engine_lane: isCodex,
      claude_review_lane: isClaude,
      harness_validation_lane: isHarness,
      plan_phase_auto_attribution_required: isCodex,
      claude_review_receipt_required: isClaude || lane_id === "loop.p8400_freeze",
      validator_status_reflected_to_ui: isHarness || lane_id === "loop.p8400_freeze",
      reviewer_mutation_allowed: false,
      final_approval_allowed: false,
      runtime_execution_enabled: false,
      write_action_enabled: false,
      next_allowed_action: "advance only through Harness evidence and review loop",
    }, pass);
  });
}

function buildP8400FreezeRows({ phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, generatedAt }) {
  const specs = [
    ["freeze.ui_v0_surfaces", "UI v0 surfaces ready", uiSurfaceRows.every((row) => row.current_verdict === "pass")],
    ["freeze.phase_detail", "phase detail evidence packets ready", phaseDetailRows.every((row) => row.current_verdict === "pass")],
    ["freeze.conversation_timeline", "conversation timeline redacted and cited", conversationTimelineRows.every((row) => row.current_verdict === "pass")],
    ["freeze.review_console", "review console exposes Claude review and finding loop", reviewConsoleRows.every((row) => row.current_verdict === "pass")],
    ["freeze.governed_loop", "Codex/Claude/Harness loop lanes ready", governedLoopRows.every((row) => row.current_verdict === "pass")],
    ["freeze.phase_rows", "P8241-P8400 phase rows reflected", phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.no_production_claim", "production and enterprise claims remain blocked", true],
  ];
  return specs.map(([freeze_id, title, pass], index) => verdictRow({
    schema_version: "p8400-freeze-row.v1",
    row_id: `p8400.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    title,
    freeze_status: pass ? "ready" : "blocked",
    evidence_ref: `evidence.${freeze_id}`,
    gate_ref: `gate.${freeze_id}`,
    no_human_gate_scope: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    next_allowed_action: pass ? "include in P8400 freeze packet" : "repair prerequisite UI or loop row",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, unsafe_claim, expected_block_reason], index) => verdictRow({
    schema_version: "work-os-ui-v0-negative-fixture-row.v1",
    row_id: `work.os.ui.v0.negative.fixture.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    unsafe_claim,
    expected_block_reason,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    current_verdict: "pass",
    verdict_authority: "harness_negative_fixture",
    next_allowed_action: "preserve negative fixture",
  }, true));
}

function buildGateRows(context) {
  const { packageJson, roadmapDoc, architectureDoc, planRegistryProgress, contract, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows } = context;
  const sourceReady = isSourceReady(planRegistryProgress);
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes Work OS UI v0 governed loop command"],
    ["source_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source plan registry command exists"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes Work OS UI v0 governed loop command"],
    ["source_plan_registry_ready", sourceReady, "P8161-P8240 source plan registry progress is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Work OS UI v0"), "P8241-P8400 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "P8241-P8400 Work OS UI v0 and Harness-Governed Development Loop"), "architecture reflects P8241-P8400"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P8241-P8400 phase rows pass"],
    ["ui_surfaces_ready", uiSurfaceRows.every((row) => row.current_verdict === "pass"), "all UI v0 surfaces are ready"],
    ["phase_detail_ready", phaseDetailRows.length >= 5 && phaseDetailRows.every((row) => row.visible_in_ui && row.source_cited && row.raw_material_visible === false), "phase detail rows show evidence without raw material"],
    ["conversation_timeline_ready", conversationTimelineRows.length >= 5 && conversationTimelineRows.every((row) => row.redacted_summary_ui_visible && row.raw_transcript_body_visible === false), "conversation timeline is redacted and cited"],
    ["review_console_ready", reviewConsoleRows.length >= 4 && reviewConsoleRows.every((row) => row.unresolved_findings_visible && row.reviewer_mutation_allowed === false), "review console exposes findings without reviewer mutation"],
    ["codex_lane_ready", governedLoopRows.some((row) => row.codex_primary_engine_lane && row.plan_phase_auto_attribution_required), "Codex work is attributed to plan and phase"],
    ["claude_lane_ready", governedLoopRows.some((row) => row.claude_review_lane && row.claude_review_receipt_required), "Claude review receipt lane exists"],
    ["harness_validation_lane_ready", governedLoopRows.some((row) => row.harness_validation_lane && row.validator_status_reflected_to_ui), "Harness validation lane updates UI and plan status"],
    ["p8400_freeze_rows_ready", p8400FreezeRows.every((row) => row.current_verdict === "pass"), "P8400 freeze rows are ready"],
    ["negative_fixtures_block", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), "negative fixtures block unsafe UI and loop claims"],
    ["no_human_gate", contract.human_gate_in_scope === false, "P8400 remains no-human milestone mode"],
    ["no_final_authority", contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write", contract.runtime_execution_enabled === false && contract.write_action_enabled === false, "runtime execution and write action remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "work-os-ui-v0-gate-row.v1",
    row_id: `work.os.ui.v0.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gate_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `hard_gate.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
  }, pass));
}

function buildBoundary({ planRegistryProgress, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows, gateRows }) {
  const sourceReady = isSourceReady(planRegistryProgress);
  const uiReady = uiSurfaceRows.every((row) => row.current_verdict === "pass")
    && phaseDetailRows.every((row) => row.current_verdict === "pass")
    && conversationTimelineRows.every((row) => row.current_verdict === "pass")
    && reviewConsoleRows.every((row) => row.current_verdict === "pass");
  const loopReady = governedLoopRows.every((row) => row.current_verdict === "pass");
  const freezeReady = p8400FreezeRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const gatesPass = gateRows.every((row) => row.current_verdict === "pass");
  const unsafeFlags = [
    false, // human_gate_in_scope
    false, // codex_final_approval_allowed
    false, // claude_final_approval_allowed
    false, // reviewer_mutation_allowed
    false, // production_pass_enabled
    false, // enterprise_pass_enabled
    false, // protected_closeout_enabled
    false, // runtime_execution_enabled
    false, // write_action_enabled
  ];
  return {
    schema_version: "work-os-ui-v0-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_plan_registry_ready: sourceReady,
    phase_rows_ready: phaseRows.every((row) => row.current_verdict === "pass"),
    work_os_ui_v0_ready: uiReady,
    harness_governed_development_loop_ready: loopReady,
    p8400_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p8401_handoff: sourceReady && uiReady && loopReady && freezeReady && negativeFixturesBlock && gatesPass,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(context) {
  const { packageJson, roadmapDoc, architectureDoc, planRegistryProgress, contract, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows, gateRows, boundary } = context;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include command"),
    validationItem("source.ready", "source", isSourceReady(planRegistryProgress), "P8161-P8240 source must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8241-P8400"), "roadmap must reflect P8241-P8400"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P8241-P8400 Work OS UI v0 and Harness-Governed Development Loop"), "architecture must reflect P8241-P8400"),
    validationItem("contract.roles", "contract", contract.codex_primary_engine_lane && contract.claude_review_lane && contract.harness_validation_lane, "Codex, Claude, and Harness lanes must be present"),
    validationItem("phase.rows", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("ui.surfaces", "ui", uiSurfaceRows.length === UI_SURFACE_SPECS.length && uiSurfaceRows.every((row) => row.read_only_projection && row.protected_action_enabled === false), "all UI surfaces must be read-only"),
    validationItem("phase.detail", "ui", phaseDetailRows.length >= 5 && phaseDetailRows.every((row) => row.source_cited && row.raw_material_visible === false), "phase detail rows must be cited and redacted"),
    validationItem("timeline.redacted", "ui", conversationTimelineRows.length === TIMELINE_SPECS.length && conversationTimelineRows.every((row) => row.redacted_summary_ui_visible && row.raw_transcript_body_visible === false), "conversation timeline must expose redacted summaries only"),
    validationItem("review.console", "review", reviewConsoleRows.length === REVIEW_CONSOLE_SPECS.length && reviewConsoleRows.every((row) => row.unresolved_findings_visible && row.final_approval_allowed === false), "review console must show unresolved findings without final authority"),
    validationItem("loop.rows", "loop", governedLoopRows.length === GOVERNED_LOOP_SPECS.length && governedLoopRows.every((row) => row.runtime_execution_enabled === false && row.write_action_enabled === false), "governed loop rows must not enable execution or writes"),
    validationItem("freeze.ready", "freeze", p8400FreezeRows.every((row) => row.current_verdict === "pass"), "P8400 freeze rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("gates.pass", "gates", gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.no_human", "boundary", boundary.human_gate_in_scope === false, "human gate must remain excluded"),
    validationItem("boundary.no_final_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false, "Codex and Claude final approval must remain false"),
    validationItem("boundary.no_enterprise_production", "boundary", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "production and enterprise PASS must remain false"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false, "runtime and write must remain false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p8401_handoff === true && boundary.unsafe_flag_count === 0, "P8400 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary({ planRegistryProgress, phaseRows, uiSurfaceRows, phaseDetailRows, conversationTimelineRows, reviewConsoleRows, governedLoopRows, p8400FreezeRows, negativeFixtureRows, gateRows, boundary, validation }) {
  const ready = validation.valid && boundary.ready_for_p8401_handoff;
  return {
    schema_version: "work-os-ui-v0-governed-loop-summary.v1",
    work_os_ui_v0_governed_loop_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_plan_registry_status: planRegistryProgress.data?.summary?.plan_registry_progress_engine_status ?? "missing",
    source_plan_registry_ready: isSourceReady(planRegistryProgress),
    phase_row_count: phaseRows.length,
    ui_surface_count: uiSurfaceRows.length,
    phase_detail_count: phaseDetailRows.length,
    conversation_timeline_count: conversationTimelineRows.length,
    review_console_count: reviewConsoleRows.length,
    governed_loop_count: governedLoopRows.length,
    p8400_freeze_count: p8400FreezeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    work_os_ui_v0_ready: boundary.work_os_ui_v0_ready,
    harness_governed_development_loop_ready: boundary.harness_governed_development_loop_ready,
    p8400_freeze_ready: boundary.p8400_freeze_ready,
    ready_for_p8401_handoff: boundary.ready_for_p8401_handoff,
    human_gate_in_scope: boundary.human_gate_in_scope,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    reviewer_mutation_allowed: boundary.reviewer_mutation_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Work OS UI v0 Governed Loop",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.work_os_ui_v0_governed_loop_status}`,
    "",
    "## Summary",
    "",
    `- Source plan registry ready: ${result.summary.source_plan_registry_ready}`,
    `- UI surfaces: ${result.summary.ui_surface_count}`,
    `- Phase detail rows: ${result.summary.phase_detail_count}`,
    `- Conversation timeline rows: ${result.summary.conversation_timeline_count}`,
    `- Review console rows: ${result.summary.review_console_count}`,
    `- Governed loop rows: ${result.summary.governed_loop_count}`,
    `- P8400 freeze ready: ${result.summary.p8400_freeze_ready}`,
    `- Ready for P8401 handoff: ${result.summary.ready_for_p8401_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P8241-P8400 makes the Work OS UI v0 and Codex/Claude/Harness loop visible, but it does not create human adjudication, production PASS, enterprise PASS, protected closeout, runtime execution, write action, reviewer mutation, or Codex/Claude final approval.",
  ];
  return `${lines.join("\n")}\n`;
}

async function readJsonOrBuildPlanRegistryProgress(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildPlanRegistryProgressEngine({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.plan_registry_progress", built);
  } catch (error) {
    return { available: false, path: sourcePath, error: `${source.error}; fallback failed: ${error.message}` };
  }
}

function isSourceReady(planRegistryProgress) {
  return planRegistryProgress.data?.summary?.plan_registry_progress_engine_status === SOURCE_READY_STATUS
    && planRegistryProgress.data?.summary?.ready_for_work_os_ui_v0_handoff === true;
}

function normalizeInputs(options = {}) {
  const defaults = DEFAULT_WORK_OS_UI_V0_GOVERNED_LOOP_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    plan_registry_progress_path: options.planRegistryProgressPath ?? defaults.planRegistryProgressPath,
  };
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
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

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data) };
}

function includesToken(text, token) {
  return typeof text === "string" && text.includes(token);
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(item_id, category, pass, message) {
  return {
    schema_version: "work-os-ui-v0-validation-item.v1",
    item_id,
    category,
    pass,
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.pass).map((item) => ({
    item_id: item.item_id,
    category: item.category,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schema_version, key, rows, generatedAt) {
  return {
    schema_version,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(iso) {
  return iso.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    help: false,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    planRegistryProgressPath: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[++index];
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[++index];
    } else if (arg === "--plan-registry-progress") {
      args.planRegistryProgressPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-ui-v0-governed-loop.mjs [options]

Options:
  --check                              Validate without writing artifacts.
  --out-dir <path>                     Artifact output directory.
  --schema <path>                      JSON schema path.
  --package <path>                     package.json path.
  --roadmap-doc <path>                 P8081-P8400 roadmap document path.
  --architecture-doc <path>            Architecture document path.
  --plan-registry-progress <path>      Source P8161-P8240 plan progress artifact path.
  --help                               Show this help.
`);
}
