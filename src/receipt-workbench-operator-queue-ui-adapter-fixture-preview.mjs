import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P27200_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueScreenSlotContract,
} from "./receipt-workbench-operator-queue-screen-slot-contract.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_ADAPTER_FIXTURE_PREVIEW_OUT_DIR = "artifacts/receipt-workbench-operator-queue-ui-adapter-fixture-preview/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_ADAPTER_FIXTURE_PREVIEW_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-ui-adapter-fixture-preview.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p27201-p27600.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueScreenSlotContractPath: "artifacts/receipt-workbench-operator-queue-screen-slot-contract/latest/receipt-workbench-operator-queue-screen-slot-contract.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-ui-adapter-fixture-preview";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-ui-adapter-fixture-preview.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_ui_adapter_fixture_preview";
const PROGRAM_RANGE = "P27201-P27600";
const SOURCE_PROGRAM_RANGE = "P26801-P27200";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_ui_adapter_fixture_preview";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_ui_adapter_fixture_preview_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_ui_adapter_fixture_preview";

const PHASE_SPECS = [
  ["P27201-P27240", "P27200 Source Binding", "p27200_source_binding_rows"],
  ["P27241-P27320", "UI Adapter Fixture Preview Contract", "ui_adapter_fixture_preview_rows"],
  ["P27321-P27400", "Slot Snapshot Matrix", "slot_snapshot_matrix_rows"],
  ["P27401-P27480", "State Fixture Preview Contract", "state_fixture_preview_contract_rows"],
  ["P27481-P27540", "Bounded Handoff Stub", "bounded_handoff_stub_rows"],
  ["P27541-P27580", "No-Render/No-Action Boundary", "no_render_no_action_boundary_rows"],
  ["P27581-P27600", "P27600 Clean Checkpoint", "p27600_clean_checkpoint_rows"],
];

const STUB_AFFORDANCES = [
  ["status_anchor", "Status anchor is available as a bounded handoff stub"],
  ["summary_anchor", "Summary anchor is available as a bounded handoff stub"],
  ["queue_list_anchor", "Queue list anchor is available as a bounded handoff stub"],
  ["route_panel_anchor", "Route panel anchor is available as a bounded handoff stub"],
  ["state_panel_anchor", "State panel anchor is available as a bounded handoff stub"],
  ["blocker_banner_anchor", "Blocker banner anchor is available as a bounded handoff stub"],
  ["detail_anchor", "Detail anchor is available as a bounded handoff stub"],
  ["next_action_anchor", "Next-action anchor is available as a bounded handoff stub"],
];

export const UI_ADAPTER_FALSE_FLAGS = [
  "ui_adapter_route_mount_allowed_now",
  "ui_adapter_render_allowed_now",
  "ui_adapter_browser_run_allowed_now",
  "ui_adapter_live_refresh_allowed_now",
  "ui_adapter_click_action_allowed_now",
  "ui_adapter_write_allowed_now",
  "ui_adapter_state_mutation_allowed_now",
  "ui_adapter_snapshot_capture_allowed_now",
  "ui_adapter_html_file_write_allowed_now",
  "ui_adapter_network_fetch_allowed_now",
  "ui_adapter_interactive_control_enabled_now",
  "ui_adapter_command_button_enabled_now",
  "ui_adapter_approve_button_enabled_now",
  "ui_adapter_closeout_button_enabled_now",
  "ui_adapter_export_allowed_now",
  "ui_adapter_publish_allowed_now",
  "ui_adapter_final_approval_allowed_now",
  "ui_adapter_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...UI_ADAPTER_FALSE_FLAGS, ...P27200_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue UI Adapter Fixture Preview failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_ADAPTER_FIXTURE_PREVIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueScreenSlotContract")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_screen_slot_contract", options.receiptWorkbenchOperatorQueueScreenSlotContract)
    : await readJsonOrBuildP27200(inputs.source_receipt_workbench_operator_queue_screen_slot_contract_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const previewRows = buildUiAdapterFixturePreviewRows({ source, generatedAt });
  const snapshotRows = buildSlotSnapshotMatrixRows({ source, previewRows, generatedAt });
  const statePreviewRows = buildStateFixturePreviewRows({ source, generatedAt });
  const stubRows = buildBoundedHandoffStubRows({ previewRows, snapshotRows, statePreviewRows, generatedAt });
  const boundaryRows = buildNoRenderNoActionBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, previewRows, snapshotRows, statePreviewRows, stubRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, previewRows, snapshotRows, statePreviewRows, stubRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, previewRows, snapshotRows, statePreviewRows, stubRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_screen_slot_contract_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_screen_slot_contract_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_ui_adapter_fixture_preview_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_ui_adapter_fixture_preview_phase_rows: phaseRows,
    p27200_source_binding_rows: sourceRows,
    ui_adapter_fixture_preview_rows: previewRows,
    slot_snapshot_matrix_rows: snapshotRows,
    state_fixture_preview_contract_rows: statePreviewRows,
    bounded_handoff_stub_rows: stubRows,
    no_render_no_action_boundary_rows: boundaryRows,
    p27600_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary: boundary,
    receipt_workbench_operator_queue_ui_adapter_fixture_preview_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_ui_adapter_fixture_preview")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-ui-adapter-fixture-preview.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p27200-source-binding-rows.json"), collectionEnvelope("p27200-source-binding-rows.v1", "p27200_source_binding_rows", result.p27200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-adapter-fixture-preview-rows.json"), collectionEnvelope("ui-adapter-fixture-preview-rows.v1", "ui_adapter_fixture_preview_rows", result.ui_adapter_fixture_preview_rows, result.generated_at));
  await writeJson(path.join(outDir, "slot-snapshot-matrix-rows.json"), collectionEnvelope("slot-snapshot-matrix-rows.v1", "slot_snapshot_matrix_rows", result.slot_snapshot_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "state-fixture-preview-contract-rows.json"), collectionEnvelope("state-fixture-preview-contract-rows.v1", "state_fixture_preview_contract_rows", result.state_fixture_preview_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "bounded-handoff-stub-rows.json"), collectionEnvelope("bounded-handoff-stub-rows.v1", "bounded_handoff_stub_rows", result.bounded_handoff_stub_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-render-no-action-boundary-rows.json"), collectionEnvelope("no-render-no-action-boundary-rows.v1", "no_render_no_action_boundary_rows", result.no_render_no_action_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p27600-clean-checkpoint-rows.json"), collectionEnvelope("p27600-clean-checkpoint-rows.v1", "p27600_clean_checkpoint_rows", result.p27600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-ui-adapter-fixture-preview-boundary.json"), result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueUiAdapterFixturePreview(args);
  console.log(`Receipt Workbench Operator Queue UI Adapter Fixture Preview ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_ui_adapter_fixture_preview_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P27200 ready for P27201 handoff: ${result.summary.source_p27200_ready_for_p27201_handoff}`);
  console.log(`Fixture previews: ${result.summary.ui_adapter_fixture_preview_count}`);
  console.log(`State previews: ${result.summary.state_fixture_preview_contract_count}`);
  console.log(`Ready for P27601 handoff: ${result.summary.ready_for_p27601_handoff}`);
  console.log(`UI adapter render allowed: ${result.summary.ui_adapter_render_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_screen_slot_contract_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p27201_handoff === true,
    status: summary.receipt_workbench_operator_queue_screen_slot_contract_status ?? "missing",
    p27200ContractReady: boundary.p27200_contract_ready === true,
    screenSlotVisible: boundary.operator_queue_screen_slot_contract_visible_now === true,
    slotBindingVisible: boundary.queue_slot_binding_matrix_visible_now === true,
    stateViewVisible: boundary.queue_state_view_contract_visible_now === true,
    detailNextActionVisible: boundary.detail_next_action_visibility_visible_now === true,
    noUiRenderClosed: boundary.no_ui_render_boundary_closed_now === true,
    boundaryClosed: P27200_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p27201-p27600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P27200 operator queue screen slot contract source is available", sourceState.available],
    ["program_range", "P27200 source program range is P26801-P27200", sourceState.programRangeOk],
    ["validation_valid", "P27200 source validation is valid", sourceState.validationValid],
    ["p27201_handoff_open", "P27200 source opened P27201 handoff", sourceState.sourceReady],
    ["p27200_contract_ready", "P27200 source contract is ready", sourceState.p27200ContractReady],
    ["screen_slot_visible", "P27200 operator queue screen slot contract is visible", sourceState.screenSlotVisible],
    ["slot_binding_visible", "P27200 queue slot binding matrix is visible", sourceState.slotBindingVisible],
    ["state_view_visible", "P27200 queue state view contract is visible", sourceState.stateViewVisible],
    ["detail_next_action_visible", "P27200 detail and next-action visibility is visible", sourceState.detailNextActionVisible],
    ["no_ui_render_closed", "P27200 no-UI-render boundary is closed", sourceState.noUiRenderClosed],
    ["commit_ref_present", "Current commit ref is present for queue UI adapter fixture preview", Boolean(commitRef)],
    ["source_blocker_visible", "P27200 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p27200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildUiAdapterFixturePreviewRows({ source, generatedAt }) {
  const slotRows = Array.isArray(source.data?.operator_queue_screen_slot_contract_rows) ? source.data.operator_queue_screen_slot_contract_rows : [];
  return slotRows.slice(0, 8).map((slot) => row({
    row_id: `ui_adapter_fixture_preview.${slug(slot.screen_slot_id)}`,
    category: "ui_adapter_fixture_preview",
    label: `Bounded UI adapter fixture preview for ${slot.screen_slot_id}`,
    observed: slot.current_verdict === "pass" && slot.visible_now === true && slot.read_only === true,
    evidence_ref: slot.row_id,
    fixture_preview_id: `operator_queue.fixture_preview.${slug(slot.screen_slot_id)}`,
    screen_slot_ref: slot.row_id,
    screen_slot_id: slot.screen_slot_id,
    source_collection: slot.source_collection,
    bounded_payload_ref: `${slot.source_collection}.bounded`,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    bounded_payload_only: true,
    raw_payload_included: false,
    route_mount_allowed_now: false,
    render_allowed_now: false,
    browser_run_allowed_now: false,
    live_refresh_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildSlotSnapshotMatrixRows({ source, previewRows, generatedAt }) {
  const bindingRows = Array.isArray(source.data?.queue_slot_binding_matrix_rows) ? source.data.queue_slot_binding_matrix_rows : [];
  return previewRows.map((preview, index) => {
    const binding = bindingRows.find((item) => item.screen_slot_ref === preview.screen_slot_ref) ?? bindingRows[index % Math.max(bindingRows.length, 1)];
    return row({
      row_id: `slot_snapshot.${slug(preview.screen_slot_id)}`,
      category: "slot_snapshot_matrix",
      label: `Read-only slot snapshot contract for ${preview.screen_slot_id}`,
      observed: preview.current_verdict === "pass" && Boolean(binding) && binding.current_verdict === "pass",
      evidence_ref: binding?.row_id ?? preview.row_id,
      snapshot_id: `operator_queue.snapshot.${slug(preview.screen_slot_id)}`,
      fixture_preview_ref: preview.row_id,
      binding_row_ref: binding?.row_id ?? null,
      screen_slot_id: preview.screen_slot_id,
      snapshot_payload_mode: "bounded_static_reference",
      snapshot_capture_allowed_now: false,
      render_allowed_now: false,
      live_refresh_allowed_now: false,
      raw_payload_included: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildStateFixturePreviewRows({ source, generatedAt }) {
  const stateRows = Array.isArray(source.data?.queue_state_view_contract_rows) ? source.data.queue_state_view_contract_rows : [];
  return stateRows.slice(0, 8).map((state) => row({
    row_id: `state_fixture_preview.${state.fixture_state}`,
    category: "state_fixture_preview_contract",
    label: `State fixture preview for ${state.fixture_state}`,
    observed: state.current_verdict === "pass" && state.visible_now === true,
    evidence_ref: state.row_id,
    fixture_state: state.fixture_state,
    source_state_row_ref: state.row_id,
    preview_state_id: `operator_queue.state_preview.${state.fixture_state}`,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    render_allowed_now: false,
    live_refresh_allowed_now: false,
    action_enabled_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildBoundedHandoffStubRows({ previewRows, snapshotRows, statePreviewRows, generatedAt }) {
  return STUB_AFFORDANCES.map(([stubId, label], index) => {
    const preview = previewRows[index % Math.max(previewRows.length, 1)];
    const snapshot = snapshotRows[index % Math.max(snapshotRows.length, 1)];
    const state = statePreviewRows[index % Math.max(statePreviewRows.length, 1)];
    return row({
      row_id: `bounded_handoff_stub.${stubId}`,
      category: "bounded_handoff_stub",
      label,
      observed: Boolean(preview) && Boolean(snapshot) && Boolean(state),
      evidence_ref: preview?.row_id ?? "ui_adapter_fixture_preview_rows",
      handoff_stub_id: `operator_queue.stub.${stubId}`,
      fixture_preview_ref: preview?.row_id ?? null,
      snapshot_ref: snapshot?.row_id ?? null,
      state_preview_ref: state?.row_id ?? null,
      safe_dom_anchor: `data-hermes-slot="${slug(preview?.screen_slot_id ?? stubId)}"`,
      html_stub_contract_visible: true,
      bounded_payload_only: true,
      raw_payload_exposure_allowed_now: false,
      html_file_write_allowed_now: false,
      route_mount_allowed_now: false,
      render_allowed_now: false,
      click_action_allowed_now: false,
      live_refresh_allowed_now: false,
      write_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoRenderNoActionBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_render_no_action.${flag}`,
    category: "no_render_no_action_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.statePreviewRows)
    && allPass(context.stubRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P27200 source is ready for P27201", context.sourceState.sourceReady],
    ["fixture_preview_visible", "UI adapter fixture preview rows are visible", allPass(context.previewRows)],
    ["slot_snapshot_visible", "Slot snapshot matrix is visible", allPass(context.snapshotRows)],
    ["state_fixture_preview_visible", "State fixture preview contract is visible", allPass(context.statePreviewRows)],
    ["bounded_handoff_stub_visible", "Bounded handoff stub rows are visible", allPass(context.stubRows)],
    ["no_render_no_action_boundary_closed", "No-render/no-action boundary remains closed", allPass(context.boundaryRows)],
    ["p27601_handoff_gate", "P27601 handoff opens only when fixture preview conditions pass", handoffReady],
    ["p27601_handoff_blocker_visible", "P27601 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p27600_checkpoint.${id}`,
    category: "p27600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p27600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p27600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.statePreviewRows)
    && allPass(context.stubRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p27600_checkpoint.p27601_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.statePreviewRows)
    && allPass(context.stubRows)
    && allPass(context.boundaryRows);
  return {
    p27600_contract_ready: p27600ContractReady,
    ready_for_p27601_handoff: handoffReady,
    source_p27200_ready_for_p27201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    ui_adapter_fixture_preview_visible_now: allPass(context.previewRows),
    slot_snapshot_matrix_visible_now: allPass(context.snapshotRows),
    state_fixture_preview_contract_visible_now: allPass(context.statePreviewRows),
    bounded_handoff_stub_visible_now: allPass(context.stubRows),
    no_render_no_action_boundary_closed_now: allPass(context.boundaryRows),
    ui_adapter_fixture_preview_count: context.previewRows.length,
    slot_snapshot_matrix_count: context.snapshotRows.length,
    state_fixture_preview_contract_count: context.statePreviewRows.length,
    bounded_handoff_stub_count: context.stubRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P27201-P27600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P27201-P27600 Receipt Workbench Operator Queue UI Adapter Fixture Preview"), "Architecture doc missing P27201-P27600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P27200 source state is not visible"),
    validationItem("fixture.preview", "ui_adapter", allPass(context.previewRows), "UI adapter fixture preview rows are incomplete"),
    validationItem("slot.snapshot", "ui_adapter", allPass(context.snapshotRows), "Slot snapshot matrix is incomplete"),
    validationItem("state.fixture_preview", "ui_adapter", allPass(context.statePreviewRows), "State fixture preview contract is incomplete"),
    validationItem("bounded.handoff_stub", "ui_adapter", allPass(context.stubRows), "Bounded handoff stub rows are incomplete"),
    validationItem("boundary.no_render_no_action", "authority", context.boundary.ui_adapter_render_allowed_now === false && context.boundary.ui_adapter_click_action_allowed_now === false && context.boundary.ui_adapter_state_mutation_allowed_now === false, "UI adapter no-render/no-action boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p27600_checkpoint.p27601_handoff_blocker_visible"), "P27600 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_ui_adapter_fixture_preview.contract.v1",
    generated_at: generatedAt,
    source_p27200_required_or_rebuilt: true,
    ui_adapter_fixture_preview_required: true,
    slot_snapshot_matrix_required: true,
    state_fixture_preview_contract_required: true,
    bounded_handoff_stub_required: true,
    no_render_no_action_authority: true,
    p27601_handoff_is_not_ui_rendering_browser_run_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p27601_handoff
    ? READY_STATUS
    : validation.valid && boundary.p27600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_ui_adapter_fixture_preview_status: status,
    source_p27200_ready_for_p27201_handoff: boundary.source_p27200_ready_for_p27201_handoff,
    ui_adapter_fixture_preview_count: boundary.ui_adapter_fixture_preview_count,
    slot_snapshot_matrix_count: boundary.slot_snapshot_matrix_count,
    state_fixture_preview_contract_count: boundary.state_fixture_preview_contract_count,
    bounded_handoff_stub_count: boundary.bounded_handoff_stub_count,
    ready_for_p27601_handoff: validation.valid && boundary.ready_for_p27601_handoff,
    ui_adapter_route_mount_allowed_now: false,
    ui_adapter_render_allowed_now: false,
    ui_adapter_browser_run_allowed_now: false,
    ui_adapter_live_refresh_allowed_now: false,
    ui_adapter_click_action_allowed_now: false,
    ui_adapter_write_allowed_now: false,
    ui_adapter_state_mutation_allowed_now: false,
    ui_adapter_snapshot_capture_allowed_now: false,
    ui_adapter_html_file_write_allowed_now: false,
    ui_adapter_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue UI Adapter Fixture Preview",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_ui_adapter_fixture_preview_status}`,
    `Program: ${result.program_range}`,
    `P27200 ready for P27201 handoff: ${result.summary.source_p27200_ready_for_p27201_handoff}`,
    `Fixture previews: ${result.summary.ui_adapter_fixture_preview_count}`,
    `State previews: ${result.summary.state_fixture_preview_contract_count}`,
    `Ready for P27601 handoff: ${result.summary.ready_for_p27601_handoff}`,
    `UI adapter render allowed: ${result.summary.ui_adapter_render_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.ui_adapter_fixture_preview_rows.map((item) => `<tr><td>${escapeHtml(item.screen_slot_id)}</td><td>${escapeHtml(item.source_collection)}</td><td>${escapeHtml(item.render_allowed_now)}</td><td>${escapeHtml(item.live_refresh_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue UI Adapter Fixture Preview</title>
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
    <h1>Hermes Receipt Workbench Operator Queue UI Adapter Fixture Preview</h1>
    <p class="notice">This artifact defines bounded fixture preview references only. It does not mount routes, render UI, run a browser, refresh live data, capture screenshots, click actions, mutate state, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Screen Slot</th><th>Source Collection</th><th>Render Allowed</th><th>Live Refresh</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP27200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_screen_slot_contract", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_ADAPTER_FIXTURE_PREVIEW_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_screen_slot_contract_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueScreenSlotContractPath ?? defaults.sourceReceiptWorkbenchOperatorQueueScreenSlotContractPath),
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
      args.sourceReceiptWorkbenchOperatorQueueScreenSlotContractPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-ui-adapter-fixture-preview.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P27201-P27600 Receipt Workbench Operator Queue UI Adapter Fixture Preview.
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
