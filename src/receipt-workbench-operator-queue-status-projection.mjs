import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchFixtureAcceptanceHandoff } from "./receipt-workbench-fixture-acceptance-handoff.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATUS_PROJECTION_OUT_DIR = "artifacts/receipt-workbench-operator-queue-status-projection/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATUS_PROJECTION_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-status-projection.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p25601-p26000.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchFixtureAcceptanceHandoffPath: "artifacts/receipt-workbench-fixture-acceptance-handoff/latest/receipt-workbench-fixture-acceptance-handoff.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-status-projection";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-status-projection.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_status_projection";
const PROGRAM_RANGE = "P25601-P26000";
const SOURCE_PROGRAM_RANGE = "P25201-P25600";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_status_projection";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_status_projection_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_status_projection";

const PHASE_SPECS = [
  ["P25601-P25640", "P25600 Source Binding", "p25600_source_binding_rows"],
  ["P25641-P25720", "Operator Queue Item Contract", "operator_queue_item_rows"],
  ["P25721-P25800", "Queue Status Summary Matrix", "queue_status_summary_rows"],
  ["P25801-P25880", "Read-Only Queue Filter Map", "read_only_queue_filter_rows"],
  ["P25881-P25940", "Operator Attention Guard", "operator_attention_guard_rows"],
  ["P25941-P25980", "No-Queue-Action Boundary", "no_queue_action_boundary_rows"],
  ["P25981-P26000", "P26000 Clean Checkpoint", "p26000_clean_checkpoint_rows"],
];

const ATTENTION_GUARDS = [
  ["queue_visible", "Operator queue status is visible"],
  ["readiness_visible", "Readiness checklist reference is visible"],
  ["evidence_visible", "Smoke evidence reference is visible"],
  ["blocker_visible", "Blocked queue item path is visible"],
  ["stale_visible", "Stale queue state is visible"],
  ["no_acceptance_visible", "No-acceptance notice is visible"],
  ["no_action_visible", "No-action notice is visible"],
  ["filter_state_visible", "Read-only filter state is visible"],
];

export const QUEUE_FALSE_FLAGS = [
  "operator_queue_action_allowed_now",
  "operator_queue_write_allowed_now",
  "operator_queue_route_mount_allowed_now",
  "operator_queue_live_fetch_allowed_now",
  "operator_queue_mutation_allowed_now",
  "operator_queue_approval_allowed_now",
  "operator_queue_closeout_allowed_now",
  "operator_queue_acceptance_allowed_now",
  "operator_queue_export_allowed_now",
  "operator_queue_publish_allowed_now",
  "operator_queue_final_approval_allowed_now",
  "operator_queue_production_pass_allowed_now",
];

const ACCEPTANCE_FALSE_FLAGS = [
  "fixture_acceptance_approval_allowed_now",
  "fixture_acceptance_closeout_allowed_now",
  "fixture_acceptance_apply_allowed_now",
  "fixture_acceptance_write_allowed_now",
  "fixture_acceptance_route_mount_allowed_now",
  "fixture_acceptance_live_fetch_allowed_now",
  "fixture_acceptance_mutation_allowed_now",
  "fixture_acceptance_export_allowed_now",
  "fixture_acceptance_publish_allowed_now",
  "fixture_acceptance_final_approval_allowed_now",
  "fixture_acceptance_production_pass_allowed_now",
  "fixture_acceptance_human_gate_bypass_allowed_now",
];

const CONSUMER_FALSE_FLAGS = [
  "dashboard_consumer_server_allowed_now",
  "dashboard_consumer_route_mount_allowed_now",
  "dashboard_consumer_live_fetch_allowed_now",
  "dashboard_consumer_render_allowed_now",
  "dashboard_consumer_browser_run_allowed_now",
  "dashboard_consumer_click_action_allowed_now",
  "dashboard_consumer_write_allowed_now",
  "dashboard_consumer_state_mutation_allowed_now",
  "dashboard_consumer_export_allowed_now",
  "dashboard_consumer_publish_allowed_now",
  "dashboard_consumer_final_approval_allowed_now",
];

const BUNDLE_FALSE_FLAGS = [
  "bundle_server_allowed_now",
  "bundle_write_allowed_now",
  "bundle_route_mount_allowed_now",
  "bundle_live_render_allowed_now",
  "bundle_browser_preview_allowed_now",
  "bundle_screenshot_allowed_now",
  "bundle_live_fetch_allowed_now",
  "bundle_click_action_allowed_now",
  "bundle_state_mutation_allowed_now",
  "bundle_export_allowed_now",
  "bundle_publish_allowed_now",
  "bundle_final_approval_allowed_now",
];

const PREVIEW_FALSE_FLAGS = [
  "preview_render_server_allowed_now",
  "preview_browser_run_allowed_now",
  "preview_screenshot_capture_allowed_now",
  "preview_live_data_fetch_allowed_now",
  "preview_click_action_allowed_now",
  "preview_state_mutation_allowed_now",
  "preview_export_allowed_now",
  "preview_publish_allowed_now",
  "preview_route_mount_allowed_now",
  "preview_final_approval_allowed_now",
];

const SCREEN_FALSE_FLAGS = [
  "screen_action_allowed_now",
  "screen_mutation_allowed_now",
  "interactive_control_enabled_now",
  "command_button_enabled_now",
  "approve_button_enabled_now",
  "merge_button_enabled_now",
  "deploy_button_enabled_now",
  "live_refresh_allowed_now",
  "detail_panel_write_allowed_now",
  "state_persistence_write_allowed_now",
  "final_screen_approval_allowed_now",
];

const HANDOFF_FALSE_FLAGS = [
  "dashboard_handoff_write_allowed_now",
  "dashboard_data_mutation_allowed_now",
  "ui_event_submission_allowed_now",
  "live_fetch_allowed_now",
  "server_bind_allowed_now",
  "route_mount_allowed_now",
  "smoke_test_live_network_allowed_now",
  "completion_apply_allowed_now",
  "operator_override_allowed_now",
  "final_dashboard_approval_allowed_now",
];

const API_FALSE_FLAGS = [
  "api_write_allowed_now",
  "mutating_method_allowed_now",
  "server_start_required_now",
  "server_started_now",
  "route_handler_registered_now",
  "route_execution_allowed_now",
  "dashboard_mutation_allowed_now",
  "receipt_completion_claim_allowed_now",
  "remediation_apply_allowed_now",
  "final_api_approval_allowed_now",
  "raw_stdout_exposure_allowed_now",
  "raw_stderr_exposure_allowed_now",
  "raw_secret_material_allowed_now",
  "full_transcript_exposure_allowed_now",
];

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

export const SOURCE_FALSE_FLAGS = [
  ...ACCEPTANCE_FALSE_FLAGS,
  ...CONSUMER_FALSE_FLAGS,
  ...BUNDLE_FALSE_FLAGS,
  ...PREVIEW_FALSE_FLAGS,
  ...SCREEN_FALSE_FLAGS,
  ...HANDOFF_FALSE_FLAGS,
  ...API_FALSE_FLAGS,
  ...PROTECTED_BOUNDARY_FALSE_FLAGS,
];

export const ALL_FALSE_FLAGS = [
  ...QUEUE_FALSE_FLAGS,
  ...SOURCE_FALSE_FLAGS,
];

export async function runReceiptWorkbenchOperatorQueueStatusProjection(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueStatusProjection(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Status Projection failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueStatusProjection(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueStatusProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATUS_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchFixtureAcceptanceHandoff")
    ? normalizeInlineJsonSource("inline.receipt_workbench_fixture_acceptance_handoff", options.receiptWorkbenchFixtureAcceptanceHandoff)
    : await readJsonOrBuildP25600(inputs.source_receipt_workbench_fixture_acceptance_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const queueRows = buildOperatorQueueItemRows({ source, generatedAt });
  const statusRows = buildQueueStatusSummaryRows({ source, queueRows, generatedAt });
  const filterRows = buildReadOnlyQueueFilterRows({ source, queueRows, generatedAt });
  const attentionRows = buildOperatorAttentionGuardRows({ source, queueRows, statusRows, filterRows, generatedAt });
  const noQueueRows = buildNoQueueActionBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, queueRows, statusRows, filterRows, attentionRows, noQueueRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, queueRows, statusRows, filterRows, attentionRows, noQueueRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, queueRows, statusRows, filterRows, attentionRows, noQueueRows, checkpointRows, boundary });
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
      receipt_workbench_fixture_acceptance_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_fixture_acceptance_handoff_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_status_projection_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_status_projection_phase_rows: phaseRows,
    p25600_source_binding_rows: sourceRows,
    operator_queue_item_rows: queueRows,
    queue_status_summary_rows: statusRows,
    read_only_queue_filter_rows: filterRows,
    operator_attention_guard_rows: attentionRows,
    no_queue_action_boundary_rows: noQueueRows,
    p26000_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_status_projection_boundary: boundary,
    receipt_workbench_operator_queue_status_projection_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_status_projection")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_status_projection_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_status_projection_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueStatusProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-status-projection.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p25600-source-binding-rows.json"), collectionEnvelope("p25600-source-binding-rows.v1", "p25600_source_binding_rows", result.p25600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-queue-item-rows.json"), collectionEnvelope("operator-queue-item-rows.v1", "operator_queue_item_rows", result.operator_queue_item_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-status-summary-rows.json"), collectionEnvelope("queue-status-summary-rows.v1", "queue_status_summary_rows", result.queue_status_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-queue-filter-rows.json"), collectionEnvelope("read-only-queue-filter-rows.v1", "read_only_queue_filter_rows", result.read_only_queue_filter_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-attention-guard-rows.json"), collectionEnvelope("operator-attention-guard-rows.v1", "operator_attention_guard_rows", result.operator_attention_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-queue-action-boundary-rows.json"), collectionEnvelope("no-queue-action-boundary-rows.v1", "no_queue_action_boundary_rows", result.no_queue_action_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p26000-clean-checkpoint-rows.json"), collectionEnvelope("p26000-clean-checkpoint-rows.v1", "p26000_clean_checkpoint_rows", result.p26000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-status-projection-boundary.json"), result.receipt_workbench_operator_queue_status_projection_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueStatusProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueStatusProjection(args);
  console.log(`Receipt Workbench Operator Queue Status Projection ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_status_projection_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P25600 ready for P25601 handoff: ${result.summary.source_p25600_ready_for_p25601_handoff}`);
  console.log(`Queue items: ${result.summary.operator_queue_item_count}`);
  console.log(`Status summaries: ${result.summary.queue_status_summary_count}`);
  console.log(`Ready for P26001 handoff: ${result.summary.ready_for_p26001_handoff}`);
  console.log(`Operator queue action allowed: ${result.summary.operator_queue_action_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_fixture_acceptance_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p25601_handoff === true,
    status: summary.receipt_workbench_fixture_acceptance_handoff_status ?? "missing",
    p25600ContractReady: boundary.p25600_contract_ready === true,
    readinessVisible: boundary.acceptance_readiness_checklist_visible_now === true,
    evidenceVisible: boundary.smoke_evidence_index_visible_now === true,
    handoffVisible: boundary.operator_handoff_contract_visible_now === true,
    visibilityVisible: boundary.acceptance_visibility_guard_visible_now === true,
    noAcceptanceClosed: boundary.no_acceptance_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p25601-p26000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P25600 fixture acceptance handoff source is available", sourceState.available],
    ["program_range", "P25600 source program range is P25201-P25600", sourceState.programRangeOk],
    ["validation_valid", "P25600 source validation is valid", sourceState.validationValid],
    ["p25601_handoff_open", "P25600 source opened P25601 handoff", sourceState.sourceReady],
    ["p25600_contract_ready", "P25600 source contract is ready", sourceState.p25600ContractReady],
    ["readiness_visible", "P25600 acceptance readiness checklist is visible", sourceState.readinessVisible],
    ["smoke_evidence_visible", "P25600 smoke evidence index is visible", sourceState.evidenceVisible],
    ["operator_handoff_visible", "P25600 operator handoff contract is visible", sourceState.handoffVisible],
    ["visibility_guard_visible", "P25600 acceptance visibility guard is visible", sourceState.visibilityVisible],
    ["no_acceptance_closed", "P25600 no-acceptance boundary is closed", sourceState.noAcceptanceClosed],
    ["commit_ref_present", "Current commit ref is present for operator queue projection", Boolean(commitRef)],
    ["source_blocker_visible", "P25600 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p25600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildOperatorQueueItemRows({ source, generatedAt }) {
  const readinessRows = Array.isArray(source.data?.acceptance_readiness_checklist_rows) ? source.data.acceptance_readiness_checklist_rows : [];
  return readinessRows.map((item, index) => row({
    row_id: `operator_queue.${slug(item.preview_surface ?? item.consumer_surface_slot ?? index + 1)}`,
    category: "operator_queue_item",
    label: `Operator queue item for ${item.preview_surface ?? item.consumer_surface_slot}`,
    observed: item.current_verdict === "pass" && item.read_only === true,
    evidence_ref: item.row_id ?? "acceptance_readiness_checklist_rows",
    source_readiness_row_ref: item.row_id ?? null,
    queue_item_id: `receipt_workbench.operator_queue.${index + 1}`,
    consumer_surface_slot: item.consumer_surface_slot ?? null,
    preview_surface: item.preview_surface ?? null,
    queue_status: "readiness_visible",
    attention_level: "normal",
    required_evidence_ref: item.required_evidence_ref ?? "smoke_evidence_index_rows",
    next_action_ref: "review_read_only_status",
    visible_when_blocked: true,
    bounded_payload_only: true,
    read_only: true,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildQueueStatusSummaryRows({ source, queueRows, generatedAt }) {
  const evidenceRows = Array.isArray(source.data?.smoke_evidence_index_rows) ? source.data.smoke_evidence_index_rows : [];
  return evidenceRows.map((item, index) => row({
    row_id: `queue_status.${slug(item.fixture_state ?? item.row_id ?? index + 1)}`,
    category: "queue_status_summary",
    label: `Queue status summary ${item.fixture_state ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.visible_now === true,
    evidence_ref: item.row_id ?? "smoke_evidence_index_rows",
    fixture_state: item.fixture_state ?? null,
    queue_item_count: queueRows.length,
    status_bucket: statusBucket(item.fixture_state),
    visible_now: true,
    visible_when_blocked: true,
    raw_body_returns: false,
    full_body_returns: false,
    live_fetch_allowed_now: false,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildReadOnlyQueueFilterRows({ source, queueRows, generatedAt }) {
  const handoffRows = Array.isArray(source.data?.operator_handoff_contract_rows) ? source.data.operator_handoff_contract_rows : [];
  const queueBySurface = new Map(queueRows.map((item) => [item.preview_surface, item]));
  return handoffRows.map((item, index) => {
    const queueRow = queueBySurface.get(item.preview_surface) ?? queueRows[index % Math.max(queueRows.length, 1)];
    return row({
      row_id: `queue_filter.${slug(item.preview_surface ?? item.handoff_key ?? index + 1)}`,
      category: "read_only_queue_filter",
      label: `Read-only queue filter for ${item.preview_surface ?? item.handoff_key}`,
      observed: Boolean(queueRow) && item.read_only === true,
      evidence_ref: item.row_id ?? "operator_handoff_contract_rows",
      source_handoff_row_ref: item.row_id ?? null,
      queue_item_row_ref: queueRow?.row_id ?? null,
      filter_key: `receipt_workbench.operator_queue.filter.${index + 1}`,
      preview_surface: item.preview_surface ?? queueRow?.preview_surface ?? null,
      consumer_surface_slot: item.consumer_surface_slot ?? queueRow?.consumer_surface_slot ?? null,
      allowed_filters: ["all", "blocked", "stale", "evidence_missing", "ready"],
      default_filter: "all",
      read_only: true,
      route_mount_allowed_now: false,
      live_fetch_allowed_now: false,
      action_enabled_now: false,
      approval_allowed_now: false,
      closeout_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorAttentionGuardRows({ source, queueRows, statusRows, filterRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  return ATTENTION_GUARDS.map(([guardId, label]) => row({
    row_id: `operator_attention.${guardId}`,
    category: "operator_attention_guard",
    label,
    observed: queueRows.length > 0 && statusRows.length > 0 && filterRows.length > 0 && summary.ready_for_p25601_handoff !== undefined,
    evidence_ref: "operator_attention_guard_rows",
    guard_id: guardId,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoQueueActionBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_queue_action.${flag}`,
    category: "no_queue_action_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_status_projection_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.statusRows)
    && allPass(context.filterRows)
    && allPass(context.attentionRows)
    && allPass(context.noQueueRows);
  return [
    ["source_ready", "P25600 source is ready for P25601", context.sourceState.sourceReady],
    ["queue_items_visible", "Operator queue item contract is visible", allPass(context.queueRows)],
    ["status_summary_visible", "Queue status summary matrix is visible", allPass(context.statusRows)],
    ["filter_map_visible", "Read-only queue filter map is visible", allPass(context.filterRows)],
    ["attention_guard_visible", "Operator attention guard is visible", allPass(context.attentionRows)],
    ["no_queue_action_boundary_closed", "No-queue-action boundary remains closed", allPass(context.noQueueRows)],
    ["p26001_handoff_gate", "P26001 handoff opens only when queue projection conditions pass", handoffReady],
    ["p26001_handoff_blocker_visible", "P26001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p26000_checkpoint.${id}`,
    category: "p26000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p26000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p26000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.queueRows)
    && allPass(context.statusRows)
    && allPass(context.filterRows)
    && allPass(context.attentionRows)
    && allPass(context.noQueueRows)
    && visibleOrPassed(context.checkpointRows, "p26000_checkpoint.p26001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.statusRows)
    && allPass(context.filterRows)
    && allPass(context.attentionRows)
    && allPass(context.noQueueRows);
  return {
    p26000_contract_ready: p26000ContractReady,
    ready_for_p26001_handoff: handoffReady,
    source_p25600_ready_for_p25601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    operator_queue_item_visible_now: allPass(context.queueRows),
    queue_status_summary_visible_now: allPass(context.statusRows),
    read_only_queue_filter_visible_now: allPass(context.filterRows),
    operator_attention_guard_visible_now: allPass(context.attentionRows),
    no_queue_action_boundary_closed_now: allPass(context.noQueueRows),
    operator_queue_item_count: context.queueRows.length,
    queue_status_summary_count: context.statusRows.length,
    read_only_queue_filter_count: context.filterRows.length,
    operator_attention_guard_count: context.attentionRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P25601-P26000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P25601-P26000 Receipt Workbench Operator Queue Status Projection"), "Architecture doc missing P25601-P26000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P25600 source state is not visible"),
    validationItem("queue.items", "queue", allPass(context.queueRows), "Operator queue item rows are incomplete"),
    validationItem("status.summary", "status", allPass(context.statusRows), "Queue status summary rows are incomplete"),
    validationItem("filter.read_only", "filter", context.filterRows.every((item) => item.read_only === true && item.route_mount_allowed_now === false && item.action_enabled_now === false), "Queue filter opened route or action authority"),
    validationItem("attention.guard", "attention", allPass(context.attentionRows) && context.attentionRows.every((item) => item.action_enabled_now === false), "Operator attention guard opened action authority"),
    validationItem("boundary.no_queue_action", "authority", context.boundary.operator_queue_action_allowed_now === false && context.boundary.operator_queue_approval_allowed_now === false && context.boundary.operator_queue_closeout_allowed_now === false, "Operator queue action boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p26000_checkpoint.p26001_handoff_blocker_visible"), "P26000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_status_projection.contract.v1",
    generated_at: generatedAt,
    source_p25600_required_or_rebuilt: true,
    operator_queue_item_contract_required: true,
    queue_status_summary_matrix_required: true,
    read_only_queue_filter_map_required: true,
    p26001_handoff_is_not_queue_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p26001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p26000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_status_projection_status: status,
    source_p25600_ready_for_p25601_handoff: boundary.source_p25600_ready_for_p25601_handoff,
    operator_queue_item_count: boundary.operator_queue_item_count,
    queue_status_summary_count: boundary.queue_status_summary_count,
    read_only_queue_filter_count: boundary.read_only_queue_filter_count,
    operator_attention_guard_count: boundary.operator_attention_guard_count,
    ready_for_p26001_handoff: validation.valid && boundary.ready_for_p26001_handoff,
    operator_queue_action_allowed_now: false,
    operator_queue_write_allowed_now: false,
    operator_queue_approval_allowed_now: false,
    operator_queue_closeout_allowed_now: false,
    operator_queue_acceptance_allowed_now: false,
    operator_queue_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Status Projection",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_status_projection_status}`,
    `Program: ${result.program_range}`,
    `P25600 ready for P25601 handoff: ${result.summary.source_p25600_ready_for_p25601_handoff}`,
    `Queue items: ${result.summary.operator_queue_item_count}`,
    `Status summaries: ${result.summary.queue_status_summary_count}`,
    `Ready for P26001 handoff: ${result.summary.ready_for_p26001_handoff}`,
    `Operator queue action allowed: ${result.summary.operator_queue_action_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_queue_item_rows.map((item) => `<tr><td>${escapeHtml(item.queue_item_id)}</td><td>${escapeHtml(item.preview_surface)}</td><td>${escapeHtml(item.queue_status)}</td><td>${escapeHtml(item.action_enabled_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Status Projection</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Status Projection</h1>
    <p class="notice">This artifact exposes read-only operator queue status. It does not enable queue actions, approvals, closeout, acceptance, live fetch, mutation, export, publish, or production readiness.</p>
    <table><thead><tr><th>Queue Item</th><th>Preview Surface</th><th>Status</th><th>Action Enabled</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP25600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchFixtureAcceptanceHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_fixture_acceptance_handoff", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATUS_PROJECTION_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_fixture_acceptance_handoff_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchFixtureAcceptanceHandoffPath ?? defaults.sourceReceiptWorkbenchFixtureAcceptanceHandoffPath),
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
      args.sourceReceiptWorkbenchFixtureAcceptanceHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-status-projection.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P25601-P26000 Receipt Workbench Operator Queue Status Projection contract.
`);
}

function statusBucket(fixtureState) {
  if (fixtureState === "ready") return "ready";
  if (fixtureState === "empty") return "empty";
  if (fixtureState === "blocked" || fixtureState === "error") return "blocked";
  if (fixtureState === "stale") return "stale";
  if (fixtureState === "review_pending") return "review_pending";
  return "attention";
}

function sourceBoundaryClosed(boundary) {
  return SOURCE_FALSE_FLAGS.every((flag) => boundary[flag] === false);
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
