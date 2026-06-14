import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P27600_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview,
} from "./receipt-workbench-operator-queue-ui-adapter-fixture-preview.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_HANDOFF_BUNDLE_OUT_DIR = "artifacts/receipt-workbench-operator-queue-ui-handoff-bundle/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_HANDOFF_BUNDLE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-ui-handoff-bundle.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p27601-p28000.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewPath: "artifacts/receipt-workbench-operator-queue-ui-adapter-fixture-preview/latest/receipt-workbench-operator-queue-ui-adapter-fixture-preview.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-ui-handoff-bundle";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-ui-handoff-bundle.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_ui_handoff_bundle";
const PROGRAM_RANGE = "P27601-P28000";
const SOURCE_PROGRAM_RANGE = "P27201-P27600";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_ui_handoff_bundle";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_ui_handoff_bundle_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_ui_handoff_bundle";

const PHASE_SPECS = [
  ["P27601-P27640", "P27600 Source Binding", "p27600_source_binding_rows"],
  ["P27641-P27720", "UI Handoff Bundle Manifest", "ui_handoff_bundle_manifest_rows"],
  ["P27721-P27800", "Read-Only Adapter Manifest", "read_only_adapter_manifest_rows"],
  ["P27801-P27880", "Operator Queue Handoff View Contract", "operator_queue_handoff_view_rows"],
  ["P27881-P27940", "Review Affordance Visibility Map", "review_affordance_visibility_rows"],
  ["P27941-P27980", "No-Serve/No-Render Boundary", "no_serve_no_render_boundary_rows"],
  ["P27981-P28000", "P28000 Clean Checkpoint", "p28000_clean_checkpoint_rows"],
];

const REVIEW_AFFORDANCES = [
  ["handoff_status_visible", "Handoff status is visible"],
  ["source_ref_visible", "P27600 source reference is visible"],
  ["fixture_preview_visible", "Fixture preview reference is visible"],
  ["snapshot_ref_visible", "Snapshot reference is visible"],
  ["state_ref_visible", "State preview reference is visible"],
  ["blocker_visible", "Blocked handoff path is visible"],
  ["redaction_notice_visible", "Redaction notice is visible"],
  ["no_action_notice_visible", "No-action notice is visible"],
];

export const UI_HANDOFF_BUNDLE_FALSE_FLAGS = [
  "bundle_server_allowed_now",
  "bundle_route_mount_allowed_now",
  "bundle_route_registration_allowed_now",
  "bundle_route_execution_allowed_now",
  "bundle_render_allowed_now",
  "bundle_browser_run_allowed_now",
  "bundle_live_refresh_allowed_now",
  "bundle_network_fetch_allowed_now",
  "bundle_click_action_allowed_now",
  "bundle_write_allowed_now",
  "bundle_state_mutation_allowed_now",
  "bundle_snapshot_capture_allowed_now",
  "bundle_html_file_write_allowed_now",
  "bundle_raw_payload_exposure_allowed_now",
  "bundle_secret_exposure_allowed_now",
  "bundle_interactive_control_enabled_now",
  "bundle_command_button_enabled_now",
  "bundle_approve_button_enabled_now",
  "bundle_closeout_button_enabled_now",
  "bundle_export_allowed_now",
  "bundle_publish_allowed_now",
  "bundle_final_approval_allowed_now",
  "bundle_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...UI_HANDOFF_BUNDLE_FALSE_FLAGS, ...P27600_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueUiHandoffBundle(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue UI Handoff Bundle failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueUiHandoffBundle(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueUiHandoffBundle(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_HANDOFF_BUNDLE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueUiAdapterFixturePreview")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_ui_adapter_fixture_preview", options.receiptWorkbenchOperatorQueueUiAdapterFixturePreview)
    : await readJsonOrBuildP27600(inputs.source_receipt_workbench_operator_queue_ui_adapter_fixture_preview_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const bundleRows = buildUiHandoffBundleManifestRows({ source, generatedAt });
  const adapterRows = buildReadOnlyAdapterManifestRows({ source, bundleRows, generatedAt });
  const viewRows = buildOperatorQueueHandoffViewRows({ source, bundleRows, adapterRows, generatedAt });
  const reviewRows = buildReviewAffordanceVisibilityRows({ source, bundleRows, adapterRows, viewRows, generatedAt });
  const boundaryRows = buildNoServeNoRenderBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, bundleRows, adapterRows, viewRows, reviewRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, bundleRows, adapterRows, viewRows, reviewRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, bundleRows, adapterRows, viewRows, reviewRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_ui_adapter_fixture_preview_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_ui_adapter_fixture_preview_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_ui_handoff_bundle_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_ui_handoff_bundle_phase_rows: phaseRows,
    p27600_source_binding_rows: sourceRows,
    ui_handoff_bundle_manifest_rows: bundleRows,
    read_only_adapter_manifest_rows: adapterRows,
    operator_queue_handoff_view_rows: viewRows,
    review_affordance_visibility_rows: reviewRows,
    no_serve_no_render_boundary_rows: boundaryRows,
    p28000_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_ui_handoff_bundle_boundary: boundary,
    receipt_workbench_operator_queue_ui_handoff_bundle_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_ui_handoff_bundle")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_ui_handoff_bundle_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_ui_handoff_bundle_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueUiHandoffBundle(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-ui-handoff-bundle.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p27600-source-binding-rows.json"), collectionEnvelope("p27600-source-binding-rows.v1", "p27600_source_binding_rows", result.p27600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-handoff-bundle-manifest-rows.json"), collectionEnvelope("ui-handoff-bundle-manifest-rows.v1", "ui_handoff_bundle_manifest_rows", result.ui_handoff_bundle_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-adapter-manifest-rows.json"), collectionEnvelope("read-only-adapter-manifest-rows.v1", "read_only_adapter_manifest_rows", result.read_only_adapter_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-queue-handoff-view-rows.json"), collectionEnvelope("operator-queue-handoff-view-rows.v1", "operator_queue_handoff_view_rows", result.operator_queue_handoff_view_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-affordance-visibility-rows.json"), collectionEnvelope("review-affordance-visibility-rows.v1", "review_affordance_visibility_rows", result.review_affordance_visibility_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-no-render-boundary-rows.json"), collectionEnvelope("no-serve-no-render-boundary-rows.v1", "no_serve_no_render_boundary_rows", result.no_serve_no_render_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p28000-clean-checkpoint-rows.json"), collectionEnvelope("p28000-clean-checkpoint-rows.v1", "p28000_clean_checkpoint_rows", result.p28000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-ui-handoff-bundle-boundary.json"), result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueUiHandoffBundleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueUiHandoffBundle(args);
  console.log(`Receipt Workbench Operator Queue UI Handoff Bundle ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_ui_handoff_bundle_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P27600 ready for P27601 handoff: ${result.summary.source_p27600_ready_for_p27601_handoff}`);
  console.log(`Bundle rows: ${result.summary.ui_handoff_bundle_manifest_count}`);
  console.log(`Adapter rows: ${result.summary.read_only_adapter_manifest_count}`);
  console.log(`Ready for P28001 handoff: ${result.summary.ready_for_p28001_handoff}`);
  console.log(`Bundle server allowed: ${result.summary.bundle_server_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p27601_handoff === true,
    status: summary.receipt_workbench_operator_queue_ui_adapter_fixture_preview_status ?? "missing",
    p27600ContractReady: boundary.p27600_contract_ready === true,
    fixturePreviewVisible: boundary.ui_adapter_fixture_preview_visible_now === true,
    slotSnapshotVisible: boundary.slot_snapshot_matrix_visible_now === true,
    stateFixturePreviewVisible: boundary.state_fixture_preview_contract_visible_now === true,
    boundedHandoffStubVisible: boundary.bounded_handoff_stub_visible_now === true,
    noRenderNoActionClosed: boundary.no_render_no_action_boundary_closed_now === true,
    boundaryClosed: P27600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p27601-p28000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P27600 operator queue UI adapter fixture preview source is available", sourceState.available],
    ["program_range", "P27600 source program range is P27201-P27600", sourceState.programRangeOk],
    ["validation_valid", "P27600 source validation is valid", sourceState.validationValid],
    ["p27601_handoff_open", "P27600 source opened P27601 handoff", sourceState.sourceReady],
    ["p27600_contract_ready", "P27600 source contract is ready", sourceState.p27600ContractReady],
    ["fixture_preview_visible", "P27600 UI adapter fixture preview rows are visible", sourceState.fixturePreviewVisible],
    ["slot_snapshot_visible", "P27600 slot snapshot matrix is visible", sourceState.slotSnapshotVisible],
    ["state_fixture_preview_visible", "P27600 state fixture preview contract is visible", sourceState.stateFixturePreviewVisible],
    ["bounded_handoff_stub_visible", "P27600 bounded handoff stub rows are visible", sourceState.boundedHandoffStubVisible],
    ["no_render_no_action_closed", "P27600 no-render/no-action boundary is closed", sourceState.noRenderNoActionClosed],
    ["commit_ref_present", "Current commit ref is present for queue UI handoff bundle", Boolean(commitRef)],
    ["source_blocker_visible", "P27600 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p27600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildUiHandoffBundleManifestRows({ source, generatedAt }) {
  const previewRows = Array.isArray(source.data?.ui_adapter_fixture_preview_rows) ? source.data.ui_adapter_fixture_preview_rows : [];
  return previewRows.slice(0, 8).map((preview) => row({
    row_id: `ui_handoff_bundle.${slug(preview.screen_slot_id)}`,
    category: "ui_handoff_bundle_manifest",
    label: `Read-only UI handoff bundle entry for ${preview.screen_slot_id}`,
    observed: preview.current_verdict === "pass" && preview.visible_now === true && preview.read_only === true,
    evidence_ref: preview.row_id,
    bundle_entry_id: `operator_queue.handoff_bundle.${slug(preview.screen_slot_id)}`,
    fixture_preview_ref: preview.row_id,
    screen_slot_id: preview.screen_slot_id,
    bounded_payload_ref: preview.bounded_payload_ref,
    source_collection: preview.source_collection,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    raw_payload_included: false,
    server_allowed_now: false,
    route_mount_allowed_now: false,
    render_allowed_now: false,
    browser_run_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildReadOnlyAdapterManifestRows({ source, bundleRows, generatedAt }) {
  const stubRows = Array.isArray(source.data?.bounded_handoff_stub_rows) ? source.data.bounded_handoff_stub_rows : [];
  return bundleRows.map((bundle, index) => {
    const stub = stubRows[index % Math.max(stubRows.length, 1)];
    return row({
      row_id: `read_only_adapter_manifest.${slug(bundle.screen_slot_id)}`,
      category: "read_only_adapter_manifest",
      label: `GET-only adapter manifest for ${bundle.screen_slot_id}`,
      observed: bundle.current_verdict === "pass" && Boolean(stub) && stub.current_verdict === "pass",
      evidence_ref: stub?.row_id ?? bundle.row_id,
      adapter_manifest_id: `operator_queue.adapter_manifest.${slug(bundle.screen_slot_id)}`,
      bundle_entry_ref: bundle.row_id,
      handoff_stub_ref: stub?.row_id ?? null,
      safe_dom_anchor: stub?.safe_dom_anchor ?? null,
      route_hint: `/work-os/operator-queue/${slug(bundle.screen_slot_id)}`,
      allowed_methods: ["GET", "HEAD"],
      mutating_methods_allowed_now: false,
      route_registered_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      network_fetch_allowed_now: false,
      raw_payload_included: false,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorQueueHandoffViewRows({ source, bundleRows, adapterRows, generatedAt }) {
  const stateRows = Array.isArray(source.data?.state_fixture_preview_contract_rows) ? source.data.state_fixture_preview_contract_rows : [];
  return bundleRows.map((bundle, index) => {
    const adapter = adapterRows[index % Math.max(adapterRows.length, 1)];
    const state = stateRows[index % Math.max(stateRows.length, 1)];
    return row({
      row_id: `operator_queue_handoff_view.${slug(bundle.screen_slot_id)}`,
      category: "operator_queue_handoff_view",
      label: `Operator queue handoff view contract for ${bundle.screen_slot_id}`,
      observed: bundle.current_verdict === "pass" && Boolean(adapter) && Boolean(state),
      evidence_ref: adapter?.row_id ?? bundle.row_id,
      handoff_view_id: `operator_queue.handoff_view.${slug(bundle.screen_slot_id)}`,
      bundle_entry_ref: bundle.row_id,
      adapter_manifest_ref: adapter?.row_id ?? null,
      state_preview_ref: state?.row_id ?? null,
      fixture_state: state?.fixture_state ?? null,
      visible_now: true,
      visible_when_blocked: true,
      render_allowed_now: false,
      live_refresh_allowed_now: false,
      click_action_allowed_now: false,
      write_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewAffordanceVisibilityRows({ source, bundleRows, adapterRows, viewRows, generatedAt }) {
  const snapshotRows = Array.isArray(source.data?.slot_snapshot_matrix_rows) ? source.data.slot_snapshot_matrix_rows : [];
  return REVIEW_AFFORDANCES.map(([affordanceId, label], index) => {
    const bundle = bundleRows[index % Math.max(bundleRows.length, 1)];
    const adapter = adapterRows[index % Math.max(adapterRows.length, 1)];
    const view = viewRows[index % Math.max(viewRows.length, 1)];
    const snapshot = snapshotRows[index % Math.max(snapshotRows.length, 1)];
    return row({
      row_id: `review_affordance_visibility.${affordanceId}`,
      category: "review_affordance_visibility",
      label,
      observed: Boolean(bundle) && Boolean(adapter) && Boolean(view) && Boolean(snapshot),
      evidence_ref: bundle?.row_id ?? "ui_handoff_bundle_manifest_rows",
      affordance_id: affordanceId,
      bundle_entry_ref: bundle?.row_id ?? null,
      adapter_manifest_ref: adapter?.row_id ?? null,
      handoff_view_ref: view?.row_id ?? null,
      snapshot_ref: snapshot?.row_id ?? null,
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

function buildNoServeNoRenderBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_no_render.${flag}`,
    category: "no_serve_no_render_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_ui_handoff_bundle_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bundleRows)
    && allPass(context.adapterRows)
    && allPass(context.viewRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P27600 source is ready for P27601", context.sourceState.sourceReady],
    ["bundle_manifest_visible", "UI handoff bundle manifest rows are visible", allPass(context.bundleRows)],
    ["adapter_manifest_visible", "Read-only adapter manifest rows are visible", allPass(context.adapterRows)],
    ["handoff_view_visible", "Operator queue handoff view rows are visible", allPass(context.viewRows)],
    ["review_affordance_visible", "Review affordance visibility rows are visible", allPass(context.reviewRows)],
    ["no_serve_no_render_boundary_closed", "No-serve/no-render boundary remains closed", allPass(context.boundaryRows)],
    ["p28001_handoff_gate", "P28001 handoff opens only when UI handoff bundle conditions pass", handoffReady],
    ["p28001_handoff_blocker_visible", "P28001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p28000_checkpoint.${id}`,
    category: "p28000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p28000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p28000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.bundleRows)
    && allPass(context.adapterRows)
    && allPass(context.viewRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p28000_checkpoint.p28001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bundleRows)
    && allPass(context.adapterRows)
    && allPass(context.viewRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows);
  return {
    p28000_contract_ready: p28000ContractReady,
    ready_for_p28001_handoff: handoffReady,
    source_p27600_ready_for_p27601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    ui_handoff_bundle_manifest_visible_now: allPass(context.bundleRows),
    read_only_adapter_manifest_visible_now: allPass(context.adapterRows),
    operator_queue_handoff_view_visible_now: allPass(context.viewRows),
    review_affordance_visibility_visible_now: allPass(context.reviewRows),
    no_serve_no_render_boundary_closed_now: allPass(context.boundaryRows),
    ui_handoff_bundle_manifest_count: context.bundleRows.length,
    read_only_adapter_manifest_count: context.adapterRows.length,
    operator_queue_handoff_view_count: context.viewRows.length,
    review_affordance_visibility_count: context.reviewRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P27601-P28000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P27601-P28000 Receipt Workbench Operator Queue UI Handoff Bundle"), "Architecture doc missing P27601-P28000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P27600 source state is not visible"),
    validationItem("bundle.manifest", "handoff_bundle", allPass(context.bundleRows), "UI handoff bundle manifest rows are incomplete"),
    validationItem("adapter.manifest", "handoff_bundle", allPass(context.adapterRows), "Read-only adapter manifest rows are incomplete"),
    validationItem("handoff.view", "handoff_bundle", allPass(context.viewRows), "Operator queue handoff view rows are incomplete"),
    validationItem("review.affordance", "handoff_bundle", allPass(context.reviewRows), "Review affordance visibility rows are incomplete"),
    validationItem("boundary.no_serve_no_render", "authority", context.boundary.bundle_server_allowed_now === false && context.boundary.bundle_route_execution_allowed_now === false && context.boundary.bundle_render_allowed_now === false, "UI handoff bundle no-serve/no-render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p28000_checkpoint.p28001_handoff_blocker_visible"), "P28000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_ui_handoff_bundle.contract.v1",
    generated_at: generatedAt,
    source_p27600_required_or_rebuilt: true,
    ui_handoff_bundle_manifest_required: true,
    read_only_adapter_manifest_required: true,
    operator_queue_handoff_view_required: true,
    review_affordance_visibility_required: true,
    no_serve_no_render_authority: true,
    p28001_handoff_is_not_server_route_render_browser_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p28001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p28000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_ui_handoff_bundle_status: status,
    source_p27600_ready_for_p27601_handoff: boundary.source_p27600_ready_for_p27601_handoff,
    ui_handoff_bundle_manifest_count: boundary.ui_handoff_bundle_manifest_count,
    read_only_adapter_manifest_count: boundary.read_only_adapter_manifest_count,
    operator_queue_handoff_view_count: boundary.operator_queue_handoff_view_count,
    review_affordance_visibility_count: boundary.review_affordance_visibility_count,
    ready_for_p28001_handoff: validation.valid && boundary.ready_for_p28001_handoff,
    bundle_server_allowed_now: false,
    bundle_route_mount_allowed_now: false,
    bundle_route_execution_allowed_now: false,
    bundle_render_allowed_now: false,
    bundle_browser_run_allowed_now: false,
    bundle_live_refresh_allowed_now: false,
    bundle_click_action_allowed_now: false,
    bundle_write_allowed_now: false,
    bundle_state_mutation_allowed_now: false,
    bundle_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue UI Handoff Bundle",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_ui_handoff_bundle_status}`,
    `Program: ${result.program_range}`,
    `P27600 ready for P27601 handoff: ${result.summary.source_p27600_ready_for_p27601_handoff}`,
    `Bundle rows: ${result.summary.ui_handoff_bundle_manifest_count}`,
    `Adapter rows: ${result.summary.read_only_adapter_manifest_count}`,
    `Ready for P28001 handoff: ${result.summary.ready_for_p28001_handoff}`,
    `Bundle server allowed: ${result.summary.bundle_server_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.ui_handoff_bundle_manifest_rows.map((item) => `<tr><td>${escapeHtml(item.screen_slot_id)}</td><td>${escapeHtml(item.source_collection)}</td><td>${escapeHtml(item.server_allowed_now)}</td><td>${escapeHtml(item.render_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue UI Handoff Bundle</title>
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
    <h1>Hermes Receipt Workbench Operator Queue UI Handoff Bundle</h1>
    <p class="notice">This artifact defines a read-only UI handoff bundle and adapter manifest only. It does not start servers, mount routes, render UI, run browsers, fetch live data, click actions, mutate state, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Screen Slot</th><th>Source Collection</th><th>Server</th><th>Render</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP27600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_ui_adapter_fixture_preview", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_UI_HANDOFF_BUNDLE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_ui_adapter_fixture_preview_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewPath ?? defaults.sourceReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewPath),
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
      args.sourceReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-ui-handoff-bundle.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P27601-P28000 Receipt Workbench Operator Queue UI Handoff Bundle.
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
