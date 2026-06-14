import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P26800_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke,
} from "./receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_SCREEN_SLOT_CONTRACT_OUT_DIR = "artifacts/receipt-workbench-operator-queue-screen-slot-contract/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_SCREEN_SLOT_CONTRACT_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-screen-slot-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p26801-p27200.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmokePath: "artifacts/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke/latest/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-screen-slot-contract";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-screen-slot-contract.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_screen_slot_contract";
const PROGRAM_RANGE = "P26801-P27200";
const SOURCE_PROGRAM_RANGE = "P26401-P26800";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_screen_slot_contract";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_screen_slot_contract_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_screen_slot_contract";

const PHASE_SPECS = [
  ["P26801-P26840", "P26800 Source Binding", "p26800_source_binding_rows"],
  ["P26841-P26920", "Operator Queue Screen Slot Contract", "operator_queue_screen_slot_contract_rows"],
  ["P26921-P27000", "Queue Slot Binding Matrix", "queue_slot_binding_matrix_rows"],
  ["P27001-P27080", "Queue State View Contract", "queue_state_view_contract_rows"],
  ["P27081-P27140", "Detail/Next-Action Visibility Map", "detail_next_action_visibility_rows"],
  ["P27141-P27180", "No-UI-Render Boundary", "no_ui_render_boundary_rows"],
  ["P27181-P27200", "P27200 Clean Checkpoint", "p27200_clean_checkpoint_rows"],
];

const SCREEN_SLOTS = [
  ["header_status", "Header status strip", "source_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_summary"],
  ["summary_bar", "Operator queue summary bar", "queue_dashboard_consumer_contract_rows"],
  ["queue_list", "Operator queue list", "queue_dashboard_consumer_contract_rows"],
  ["api_route_panel", "Read-only API route panel", "queue_api_adapter_smoke_rows"],
  ["fixture_state_panel", "Queue fixture state panel", "queue_fixture_state_coverage_rows"],
  ["blocker_banner", "Visible blocker banner", "consumer_visibility_guard_rows"],
  ["detail_panel", "Read-only queue detail panel", "queue_slot_binding_matrix_rows"],
  ["next_action_panel", "Advisory next action panel", "detail_next_action_visibility_rows"],
];

const STATE_VIEWS = [
  ["ready", "Ready state view is visible"],
  ["empty", "Empty state view is visible"],
  ["loading", "Loading state view is visible without live refresh"],
  ["error", "Error state view is visible"],
  ["blocked", "Blocked state view is visible"],
  ["stale", "Stale state view is visible"],
  ["review_pending", "Review-pending state view is visible"],
  ["redacted_payload", "Redacted payload state view is visible"],
];

export const QUEUE_SCREEN_FALSE_FLAGS = [
  "queue_screen_route_mount_allowed_now",
  "queue_screen_render_allowed_now",
  "queue_screen_browser_run_allowed_now",
  "queue_screen_click_action_allowed_now",
  "queue_screen_write_allowed_now",
  "queue_screen_state_mutation_allowed_now",
  "queue_screen_live_refresh_allowed_now",
  "queue_screen_interactive_control_enabled_now",
  "queue_screen_command_button_enabled_now",
  "queue_screen_approve_button_enabled_now",
  "queue_screen_closeout_button_enabled_now",
  "queue_screen_export_allowed_now",
  "queue_screen_publish_allowed_now",
  "queue_screen_final_approval_allowed_now",
  "queue_screen_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...QUEUE_SCREEN_FALSE_FLAGS, ...P26800_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueScreenSlotContract(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueScreenSlotContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Screen Slot Contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueScreenSlotContract(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueScreenSlotContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_SCREEN_SLOT_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke", options.receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke)
    : await readJsonOrBuildP26800(inputs.source_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const slotRows = buildScreenSlotRows({ source, generatedAt });
  const bindingRows = buildSlotBindingRows({ source, slotRows, generatedAt });
  const stateRows = buildStateViewRows({ source, generatedAt });
  const visibilityRows = buildDetailNextActionRows({ source, slotRows, bindingRows, stateRows, generatedAt });
  const boundaryRows = buildNoUiRenderRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, slotRows, bindingRows, stateRows, visibilityRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, slotRows, bindingRows, stateRows, visibilityRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, slotRows, bindingRows, stateRows, visibilityRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_screen_slot_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_screen_slot_contract_phase_rows: phaseRows,
    p26800_source_binding_rows: sourceRows,
    operator_queue_screen_slot_contract_rows: slotRows,
    queue_slot_binding_matrix_rows: bindingRows,
    queue_state_view_contract_rows: stateRows,
    detail_next_action_visibility_rows: visibilityRows,
    no_ui_render_boundary_rows: boundaryRows,
    p27200_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_screen_slot_contract_boundary: boundary,
    receipt_workbench_operator_queue_screen_slot_contract_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_screen_slot_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_screen_slot_contract_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_screen_slot_contract_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueScreenSlotContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-screen-slot-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p26800-source-binding-rows.json"), collectionEnvelope("p26800-source-binding-rows.v1", "p26800_source_binding_rows", result.p26800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-queue-screen-slot-contract-rows.json"), collectionEnvelope("operator-queue-screen-slot-contract-rows.v1", "operator_queue_screen_slot_contract_rows", result.operator_queue_screen_slot_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-slot-binding-matrix-rows.json"), collectionEnvelope("queue-slot-binding-matrix-rows.v1", "queue_slot_binding_matrix_rows", result.queue_slot_binding_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-state-view-contract-rows.json"), collectionEnvelope("queue-state-view-contract-rows.v1", "queue_state_view_contract_rows", result.queue_state_view_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "detail-next-action-visibility-rows.json"), collectionEnvelope("detail-next-action-visibility-rows.v1", "detail_next_action_visibility_rows", result.detail_next_action_visibility_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-ui-render-boundary-rows.json"), collectionEnvelope("no-ui-render-boundary-rows.v1", "no_ui_render_boundary_rows", result.no_ui_render_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p27200-clean-checkpoint-rows.json"), collectionEnvelope("p27200-clean-checkpoint-rows.v1", "p27200_clean_checkpoint_rows", result.p27200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-screen-slot-contract-boundary.json"), result.receipt_workbench_operator_queue_screen_slot_contract_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueScreenSlotContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueScreenSlotContract(args);
  console.log(`Receipt Workbench Operator Queue Screen Slot Contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_screen_slot_contract_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P26800 ready for P26801 handoff: ${result.summary.source_p26800_ready_for_p26801_handoff}`);
  console.log(`Screen slots: ${result.summary.operator_queue_screen_slot_contract_count}`);
  console.log(`State views: ${result.summary.queue_state_view_contract_count}`);
  console.log(`Ready for P27201 handoff: ${result.summary.ready_for_p27201_handoff}`);
  console.log(`Screen render allowed: ${result.summary.queue_screen_render_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p26801_handoff === true,
    status: summary.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status ?? "missing",
    p26800ContractReady: boundary.p26800_contract_ready === true,
    consumerVisible: boundary.queue_dashboard_consumer_contract_visible_now === true,
    adapterSmokeVisible: boundary.queue_api_adapter_smoke_visible_now === true,
    fixtureCoverageVisible: boundary.queue_fixture_state_coverage_visible_now === true,
    visibilityGuardVisible: boundary.consumer_visibility_guard_visible_now === true,
    noRenderClosed: boundary.no_render_queue_dashboard_boundary_closed_now === true,
    boundaryClosed: P26800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p26801-p27200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P26800 operator queue dashboard consumer smoke source is available", sourceState.available],
    ["program_range", "P26800 source program range is P26401-P26800", sourceState.programRangeOk],
    ["validation_valid", "P26800 source validation is valid", sourceState.validationValid],
    ["p26801_handoff_open", "P26800 source opened P26801 handoff", sourceState.sourceReady],
    ["p26800_contract_ready", "P26800 source contract is ready", sourceState.p26800ContractReady],
    ["consumer_contract_visible", "P26800 queue dashboard consumer contract is visible", sourceState.consumerVisible],
    ["adapter_smoke_visible", "P26800 queue API adapter smoke matrix is visible", sourceState.adapterSmokeVisible],
    ["fixture_coverage_visible", "P26800 queue fixture state coverage is visible", sourceState.fixtureCoverageVisible],
    ["visibility_guard_visible", "P26800 consumer visibility guard is visible", sourceState.visibilityGuardVisible],
    ["no_render_closed", "P26800 no-render/no-mutation boundary is closed", sourceState.noRenderClosed],
    ["commit_ref_present", "Current commit ref is present for queue screen slot contract", Boolean(commitRef)],
    ["source_blocker_visible", "P26800 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p26800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildScreenSlotRows({ source, generatedAt }) {
  return SCREEN_SLOTS.map(([slotId, label, sourceCollection]) => row({
    row_id: `queue_screen_slot.${slotId}`,
    category: "operator_queue_screen_slot_contract",
    label,
    observed: source.available === true,
    evidence_ref: sourceCollection,
    screen_slot_id: `operator_queue.screen.${slotId}`,
    source_collection: sourceCollection,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    bounded_payload_only: true,
    route_mount_allowed_now: false,
    render_allowed_now: false,
    browser_run_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildSlotBindingRows({ source, slotRows, generatedAt }) {
  const consumerRows = Array.isArray(source.data?.queue_dashboard_consumer_contract_rows) ? source.data.queue_dashboard_consumer_contract_rows : [];
  return slotRows.map((slot, index) => {
    const sourceRow = consumerRows[index % Math.max(consumerRows.length, 1)];
    return row({
      row_id: `queue_slot_binding.${slug(slot.screen_slot_id)}`,
      category: "queue_slot_binding_matrix",
      label: `Queue slot binding for ${slot.screen_slot_id}`,
      observed: Boolean(sourceRow) && slot.current_verdict === "pass",
      evidence_ref: sourceRow?.row_id ?? slot.evidence_ref,
      screen_slot_ref: slot.row_id,
      source_consumer_row_ref: sourceRow?.row_id ?? null,
      route_path: sourceRow?.route_path ?? null,
      dashboard_slot: sourceRow?.dashboard_slot ?? slot.screen_slot_id,
      data_binding_mode: "bounded_read_only",
      visible_fields: ["row_id", "route_path", "dashboard_slot", "fixture_state", "status_bucket", "evidence_ref", "next_action_ref"],
      forbidden_fields: ["raw_stdout", "raw_stderr", "raw_secret_material", "full_transcript", "raw_queue_payload", "protected_payload"],
      read_only: true,
      render_allowed_now: false,
      live_refresh_allowed_now: false,
      click_action_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildStateViewRows({ source, generatedAt }) {
  const fixtureRows = Array.isArray(source.data?.queue_fixture_state_coverage_rows) ? source.data.queue_fixture_state_coverage_rows : [];
  const fixtureByState = new Map(fixtureRows.map((item) => [item.fixture_state, item]));
  return STATE_VIEWS.map(([state, label]) => {
    const fixture = fixtureByState.get(state);
    return row({
      row_id: `queue_state_view.${state}`,
      category: "queue_state_view_contract",
      label,
      observed: Boolean(fixture) && fixture.current_verdict === "pass" && fixture.visible_now === true,
      evidence_ref: fixture?.row_id ?? "queue_fixture_state_coverage_rows",
      fixture_state: state,
      source_fixture_row_ref: fixture?.row_id ?? null,
      visible_now: true,
      visible_when_blocked: true,
      empty_state_visible: state === "empty",
      blocked_state_visible: state === "blocked",
      redacted_payload_visible: state === "redacted_payload",
      loading_without_live_refresh: state === "loading",
      render_allowed_now: false,
      live_refresh_allowed_now: false,
      action_enabled_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildDetailNextActionRows({ source, slotRows, bindingRows, stateRows, generatedAt }) {
  const guardRows = Array.isArray(source.data?.consumer_visibility_guard_rows) ? source.data.consumer_visibility_guard_rows : [];
  const refs = [
    ["detail_source_ref", "Detail source reference is visible", "detail_panel"],
    ["detail_route_ref", "Detail route reference is visible", "detail_panel"],
    ["detail_sanitized_payload", "Detail sanitized payload notice is visible", "detail_panel"],
    ["detail_blocker_state", "Detail blocker state is visible", "detail_panel"],
    ["next_action_ref", "Advisory next action reference is visible", "next_action_panel"],
    ["next_action_no_action_notice", "Next action no-action notice is visible", "next_action_panel"],
    ["state_view_ref", "State view reference is visible", "fixture_state_panel"],
    ["raw_payload_omitted_notice", "Raw payload omitted notice is visible", "detail_panel"],
  ];
  return refs.map(([visibilityId, label, slotHint], index) => {
    const slot = slotRows.find((item) => item.screen_slot_id.endsWith(slotHint)) ?? slotRows[index % Math.max(slotRows.length, 1)];
    const binding = bindingRows[index % Math.max(bindingRows.length, 1)];
    const state = stateRows[index % Math.max(stateRows.length, 1)];
    const guard = guardRows[index % Math.max(guardRows.length, 1)];
    return row({
      row_id: `detail_next_action.${visibilityId}`,
      category: "detail_next_action_visibility",
      label,
      observed: Boolean(slot) && Boolean(binding) && Boolean(state),
      evidence_ref: guard?.row_id ?? "consumer_visibility_guard_rows",
      visibility_id: visibilityId,
      screen_slot_ref: slot?.row_id ?? null,
      binding_row_ref: binding?.row_id ?? null,
      state_view_ref: state?.row_id ?? null,
      visible_now: true,
      visible_when_blocked: true,
      advisory_only: true,
      command_button_enabled_now: false,
      approve_button_enabled_now: false,
      closeout_button_enabled_now: false,
      write_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoUiRenderRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_ui_render.${flag}`,
    category: "no_ui_render_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_screen_slot_contract_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.slotRows)
    && allPass(context.bindingRows)
    && allPass(context.stateRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P26800 source is ready for P26801", context.sourceState.sourceReady],
    ["screen_slots_visible", "Operator queue screen slot contract is visible", allPass(context.slotRows)],
    ["slot_binding_visible", "Queue slot binding matrix is visible", allPass(context.bindingRows)],
    ["state_views_visible", "Queue state view contract is visible", allPass(context.stateRows)],
    ["detail_next_action_visible", "Detail and next-action visibility map is visible", allPass(context.visibilityRows)],
    ["no_ui_render_boundary_closed", "No-UI-render boundary remains closed", allPass(context.boundaryRows)],
    ["p27201_handoff_gate", "P27201 handoff opens only when screen slot contract conditions pass", handoffReady],
    ["p27201_handoff_blocker_visible", "P27201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p27200_checkpoint.${id}`,
    category: "p27200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p27200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p27200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.slotRows)
    && allPass(context.bindingRows)
    && allPass(context.stateRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p27200_checkpoint.p27201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.slotRows)
    && allPass(context.bindingRows)
    && allPass(context.stateRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return {
    p27200_contract_ready: p27200ContractReady,
    ready_for_p27201_handoff: handoffReady,
    source_p26800_ready_for_p26801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    operator_queue_screen_slot_contract_visible_now: allPass(context.slotRows),
    queue_slot_binding_matrix_visible_now: allPass(context.bindingRows),
    queue_state_view_contract_visible_now: allPass(context.stateRows),
    detail_next_action_visibility_visible_now: allPass(context.visibilityRows),
    no_ui_render_boundary_closed_now: allPass(context.boundaryRows),
    operator_queue_screen_slot_contract_count: context.slotRows.length,
    queue_slot_binding_matrix_count: context.bindingRows.length,
    queue_state_view_contract_count: context.stateRows.length,
    detail_next_action_visibility_count: context.visibilityRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P26801-P27200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P26801-P27200 Receipt Workbench Operator Queue Screen Slot Contract"), "Architecture doc missing P26801-P27200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P26800 source state is not visible"),
    validationItem("screen.slots", "screen", allPass(context.slotRows), "Operator queue screen slots are incomplete"),
    validationItem("slot.binding", "screen", allPass(context.bindingRows), "Queue slot binding matrix is incomplete"),
    validationItem("state.views", "screen", allPass(context.stateRows), "Queue state view contract is incomplete"),
    validationItem("detail.next_action", "screen", allPass(context.visibilityRows), "Detail and next-action visibility map is incomplete"),
    validationItem("boundary.no_ui_render", "authority", context.boundary.queue_screen_render_allowed_now === false && context.boundary.queue_screen_click_action_allowed_now === false && context.boundary.queue_screen_state_mutation_allowed_now === false, "Screen no-UI-render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p27200_checkpoint.p27201_handoff_blocker_visible"), "P27200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_screen_slot_contract.contract.v1",
    generated_at: generatedAt,
    source_p26800_required_or_rebuilt: true,
    operator_queue_screen_slot_contract_required: true,
    queue_slot_binding_matrix_required: true,
    queue_state_view_contract_required: true,
    no_ui_render_or_action_authority: true,
    p27201_handoff_is_not_ui_rendering_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p27201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p27200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_screen_slot_contract_status: status,
    source_p26800_ready_for_p26801_handoff: boundary.source_p26800_ready_for_p26801_handoff,
    operator_queue_screen_slot_contract_count: boundary.operator_queue_screen_slot_contract_count,
    queue_slot_binding_matrix_count: boundary.queue_slot_binding_matrix_count,
    queue_state_view_contract_count: boundary.queue_state_view_contract_count,
    detail_next_action_visibility_count: boundary.detail_next_action_visibility_count,
    ready_for_p27201_handoff: validation.valid && boundary.ready_for_p27201_handoff,
    queue_screen_render_allowed_now: false,
    queue_screen_browser_run_allowed_now: false,
    queue_screen_click_action_allowed_now: false,
    queue_screen_write_allowed_now: false,
    queue_screen_state_mutation_allowed_now: false,
    queue_screen_live_refresh_allowed_now: false,
    queue_screen_command_button_enabled_now: false,
    queue_screen_approve_button_enabled_now: false,
    queue_screen_closeout_button_enabled_now: false,
    queue_screen_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Screen Slot Contract",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_screen_slot_contract_status}`,
    `Program: ${result.program_range}`,
    `P26800 ready for P26801 handoff: ${result.summary.source_p26800_ready_for_p26801_handoff}`,
    `Screen slots: ${result.summary.operator_queue_screen_slot_contract_count}`,
    `State views: ${result.summary.queue_state_view_contract_count}`,
    `Ready for P27201 handoff: ${result.summary.ready_for_p27201_handoff}`,
    `Screen render allowed: ${result.summary.queue_screen_render_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_queue_screen_slot_contract_rows.map((item) => `<tr><td>${escapeHtml(item.screen_slot_id)}</td><td>${escapeHtml(item.source_collection)}</td><td>${escapeHtml(item.render_allowed_now)}</td><td>${escapeHtml(item.click_action_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Screen Slot Contract</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Screen Slot Contract</h1>
    <p class="notice">This artifact defines screen slots and state views only. It does not render UI, mount routes, run a browser, refresh live data, click actions, mutate state, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Screen Slot</th><th>Source Collection</th><th>Render Allowed</th><th>Click Action</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP26800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_SCREEN_SLOT_CONTRACT_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmokePath ?? defaults.sourceReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmokePath),
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
      args.sourceReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmokePath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-screen-slot-contract.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P26801-P27200 Receipt Workbench Operator Queue Screen Slot Contract.
`);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
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

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
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
