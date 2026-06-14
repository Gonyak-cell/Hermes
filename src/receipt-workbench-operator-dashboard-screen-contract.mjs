import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchDashboardHandoffSmoke } from "./receipt-workbench-dashboard-handoff-smoke.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_DASHBOARD_SCREEN_CONTRACT_OUT_DIR = "artifacts/receipt-workbench-operator-dashboard-screen-contract/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_DASHBOARD_SCREEN_CONTRACT_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-dashboard-screen-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p23601-p24000.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchDashboardHandoffSmokePath: "artifacts/receipt-workbench-dashboard-handoff-smoke/latest/receipt-workbench-dashboard-handoff-smoke.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-dashboard-screen-contract";
const SCHEMA_VERSION = "receipt-workbench-operator-dashboard-screen-contract.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_dashboard_screen_contract";
const PROGRAM_RANGE = "P23601-P24000";
const SOURCE_PROGRAM_RANGE = "P23201-P23600";
const READY_STATUS = "ready_for_receipt_workbench_operator_dashboard_screen_contract";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_dashboard_screen_contract_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_dashboard_screen_contract";

const PHASE_SPECS = [
  ["P23601-P23640", "P23600 Source Binding", "p23600_source_binding_rows"],
  ["P23641-P23720", "Operator Dashboard Screen Contract", "operator_dashboard_screen_contract_rows"],
  ["P23721-P23800", "Interaction State Checklist", "interaction_state_checklist_rows"],
  ["P23801-P23880", "Read-Only Data Binding Matrix", "read_only_data_binding_rows"],
  ["P23881-P23940", "Screen Resilience Guard", "screen_resilience_guard_rows"],
  ["P23941-P23980", "No-Action Boundary", "no_action_boundary_rows"],
  ["P23981-P24000", "P24000 Clean Checkpoint", "p24000_clean_checkpoint_rows"],
];

const SCREEN_SLOT_SPECS = [
  ["header_status", "Header status strip", "source_receipt_workbench_dashboard_handoff_smoke_summary"],
  ["summary_bar", "Receipt workbench summary bar", "handoff_adapter_smoke_rows"],
  ["task_list", "Receipt task list", "dashboard_consumer_contract_rows"],
  ["evidence_panel", "Evidence request panel", "dashboard_consumer_contract_rows"],
  ["review_panel", "Conditional review panel", "operator_visibility_rule_rows"],
  ["blocker_banner", "Visible blocker banner", "operator_visibility_rule_rows"],
  ["detail_panel", "Read-only detail panel", "read_only_data_binding_rows"],
  ["next_action_panel", "Next action panel", "dashboard_consumer_contract_rows"],
];

const INTERACTION_STATES = [
  ["ready", "Ready state is visible"],
  ["empty", "Empty state is visible"],
  ["loading", "Loading state is visible without live fetch"],
  ["error", "Error state is visible"],
  ["blocked", "Blocked state is visible"],
  ["stale", "Stale source state is visible"],
  ["review_pending", "Review-pending state is visible"],
  ["redacted_payload", "Redacted payload state is visible"],
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

export async function runReceiptWorkbenchOperatorDashboardScreenContract(options = {}) {
  const result = await buildReceiptWorkbenchOperatorDashboardScreenContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Dashboard Screen Contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorDashboardScreenContract(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorDashboardScreenContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_DASHBOARD_SCREEN_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchDashboardHandoffSmoke")
    ? normalizeInlineJsonSource("inline.receipt_workbench_dashboard_handoff_smoke", options.receiptWorkbenchDashboardHandoffSmoke)
    : await readJsonOrBuildP23600(inputs.source_receipt_workbench_dashboard_handoff_smoke_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const screenRows = buildScreenContractRows({ source, generatedAt });
  const interactionRows = buildInteractionStateRows(generatedAt);
  const bindingRows = buildReadOnlyDataBindingRows({ source, screenRows, generatedAt });
  const noActionRows = buildNoActionBoundaryRows(generatedAt);
  const resilienceRows = buildScreenResilienceGuardRows({ source, screenRows, interactionRows, bindingRows, noActionRows, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, screenRows, interactionRows, bindingRows, resilienceRows, noActionRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, screenRows, interactionRows, bindingRows, resilienceRows, noActionRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, screenRows, interactionRows, bindingRows, resilienceRows, noActionRows, checkpointRows, boundary });
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
      receipt_workbench_dashboard_handoff_smoke_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_dashboard_handoff_smoke_summary: source.data?.summary ?? null,
    receipt_workbench_operator_dashboard_screen_contract: buildContract(generatedAt),
    receipt_workbench_operator_dashboard_screen_contract_phase_rows: phaseRows,
    p23600_source_binding_rows: sourceRows,
    operator_dashboard_screen_contract_rows: screenRows,
    interaction_state_checklist_rows: interactionRows,
    read_only_data_binding_rows: bindingRows,
    screen_resilience_guard_rows: resilienceRows,
    no_action_boundary_rows: noActionRows,
    p24000_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_dashboard_screen_contract_boundary: boundary,
    receipt_workbench_operator_dashboard_screen_contract_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_dashboard_screen_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_dashboard_screen_contract_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_dashboard_screen_contract_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorDashboardScreenContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-dashboard-screen-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p23600-source-binding-rows.json"), collectionEnvelope("p23600-source-binding-rows.v1", "p23600_source_binding_rows", result.p23600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-dashboard-screen-contract-rows.json"), collectionEnvelope("operator-dashboard-screen-contract-rows.v1", "operator_dashboard_screen_contract_rows", result.operator_dashboard_screen_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "interaction-state-checklist-rows.json"), collectionEnvelope("interaction-state-checklist-rows.v1", "interaction_state_checklist_rows", result.interaction_state_checklist_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-data-binding-rows.json"), collectionEnvelope("read-only-data-binding-rows.v1", "read_only_data_binding_rows", result.read_only_data_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "screen-resilience-guard-rows.json"), collectionEnvelope("screen-resilience-guard-rows.v1", "screen_resilience_guard_rows", result.screen_resilience_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-action-boundary-rows.json"), collectionEnvelope("no-action-boundary-rows.v1", "no_action_boundary_rows", result.no_action_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p24000-clean-checkpoint-rows.json"), collectionEnvelope("p24000-clean-checkpoint-rows.v1", "p24000_clean_checkpoint_rows", result.p24000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-dashboard-screen-contract-boundary.json"), result.receipt_workbench_operator_dashboard_screen_contract_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorDashboardScreenContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorDashboardScreenContract(args);
  console.log(`Receipt Workbench Operator Dashboard Screen Contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_dashboard_screen_contract_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P23600 ready for P23601 handoff: ${result.summary.source_p23600_ready_for_p23601_handoff}`);
  console.log(`Screen slots: ${result.summary.operator_dashboard_screen_contract_count}`);
  console.log(`Interaction states: ${result.summary.interaction_state_checklist_count}`);
  console.log(`Ready for P24001 handoff: ${result.summary.ready_for_p24001_handoff}`);
  console.log(`Screen action allowed: ${result.summary.screen_action_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_dashboard_handoff_smoke_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p23601_handoff === true,
    status: summary.receipt_workbench_dashboard_handoff_smoke_status ?? "missing",
    p23600ContractReady: boundary.p23600_contract_ready === true,
    consumerVisible: boundary.dashboard_consumer_contract_visible_now === true,
    smokeVisible: boundary.handoff_adapter_smoke_visible_now === true,
    visibilityVisible: boundary.operator_visibility_rules_visible_now === true,
    noServeClosed: boundary.no_serve_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p23601-p24000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P23600 dashboard handoff smoke source is available", sourceState.available],
    ["program_range", "P23600 source program range is P23201-P23600", sourceState.programRangeOk],
    ["validation_valid", "P23600 source validation is valid", sourceState.validationValid],
    ["p23601_handoff_open", "P23600 source opened P23601 handoff", sourceState.sourceReady],
    ["p23600_contract_ready", "P23600 source contract is ready", sourceState.p23600ContractReady],
    ["consumer_contract_visible", "P23600 dashboard consumer contract is visible", sourceState.consumerVisible],
    ["handoff_smoke_visible", "P23600 handoff adapter smoke matrix is visible", sourceState.smokeVisible],
    ["visibility_rules_visible", "P23600 operator visibility rules are visible", sourceState.visibilityVisible],
    ["no_serve_closed", "P23600 no-serve boundary is closed", sourceState.noServeClosed],
    ["boundary_closed", "P23600 source authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for screen contract", Boolean(commitRef)],
    ["source_blocker_visible", "P23600 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p23600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildScreenContractRows({ source, generatedAt }) {
  const consumerRows = Array.isArray(source.data?.dashboard_consumer_contract_rows) ? source.data.dashboard_consumer_contract_rows : [];
  const smokeRows = Array.isArray(source.data?.handoff_adapter_smoke_rows) ? source.data.handoff_adapter_smoke_rows : [];
  return SCREEN_SLOT_SPECS.map(([slotId, label, sourceRef], index) => row({
    row_id: `screen_slot.${slotId}`,
    category: "operator_dashboard_screen_contract",
    label,
    observed: consumerRows.length > 0 && smokeRows.length > 0,
    evidence_ref: sourceRef,
    screen_slot: slotId,
    slot_order: index + 1,
    source_collection_ref: sourceRef,
    visible_now: true,
    visible_when_blocked: true,
    bounded_payload_only: true,
    read_only: true,
    raw_body_returns: false,
    full_body_returns: false,
    mutation_enabled: false,
    overflow_policy: "truncate_with_detail_ref",
    generated_at: generatedAt,
  }));
}

function buildInteractionStateRows(generatedAt) {
  return INTERACTION_STATES.map(([stateId, label]) => row({
    row_id: `interaction_state.${stateId}`,
    category: "interaction_state_checklist",
    label,
    observed: true,
    evidence_ref: "interaction_state_checklist_rows",
    interaction_state: stateId,
    visible_now: true,
    action_enabled_now: false,
    live_fetch_allowed_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildReadOnlyDataBindingRows({ source, screenRows, generatedAt }) {
  const consumerRows = Array.isArray(source.data?.dashboard_consumer_contract_rows) ? source.data.dashboard_consumer_contract_rows : [];
  const smokeRows = Array.isArray(source.data?.handoff_adapter_smoke_rows) ? source.data.handoff_adapter_smoke_rows : [];
  const routeBySlot = new Map(smokeRows.map((item) => [item.dashboard_surface_slot, item.route]));
  return consumerRows.map((item, index) => row({
    row_id: `data_binding.${slug(item.surface_slot ?? item.row_id ?? index + 1)}`,
    category: "read_only_data_binding",
    label: `Read-only data binding for ${item.surface_slot ?? item.row_id}`,
    observed: screenRows.some((screen) => screen.visible_now === true),
    evidence_ref: item.row_id ?? "dashboard_consumer_contract_rows",
    source_row_ref: item.row_id ?? null,
    screen_slot: normalizeScreenSlot(item.surface_slot),
    source_surface_slot: item.surface_slot ?? null,
    route_ref: routeBySlot.get(item.surface_slot) ?? null,
    visible_fields: ["row_id", "receipt_type", "display_state", "next_action", "owner_lane", "required_evidence", "detail_ref"],
    forbidden_fields: ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
    bounded_payload_only: true,
    read_only: true,
    raw_body_returns: false,
    full_body_returns: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildNoActionBoundaryRows(generatedAt) {
  return [
    ...SCREEN_FALSE_FLAGS,
    ...HANDOFF_FALSE_FLAGS,
    ...API_FALSE_FLAGS,
    ...PROTECTED_BOUNDARY_FALSE_FLAGS,
  ].map((flag) => row({
    row_id: `no_action.${flag}`,
    category: "no_action_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_dashboard_screen_contract_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildScreenResilienceGuardRows({ source, screenRows, interactionRows, bindingRows, noActionRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  const guards = [
    ["bounded_payload_guard", "All screen and binding rows are bounded payload only", screenRows.every((item) => item.bounded_payload_only === true) && bindingRows.every((item) => item.bounded_payload_only === true)],
    ["redaction_guard", "Raw, secret, full transcript, and protected payload fields remain forbidden", bindingRows.every((item) => item.forbidden_fields?.includes("secret_material") && item.raw_body_returns === false)],
    ["overflow_guard", "Overflow policy is explicit for every screen slot", screenRows.every((item) => Boolean(item.overflow_policy))],
    ["stale_state_guard", "Stale state is explicitly visible", interactionRows.some((item) => item.interaction_state === "stale" && item.visible_now === true)],
    ["hidden_blocker_guard", "Blocked state is explicitly visible", interactionRows.some((item) => item.interaction_state === "blocked" && item.visible_now === true)],
    ["review_pending_guard", "Review-pending state is explicitly visible", interactionRows.some((item) => item.interaction_state === "review_pending" && item.visible_now === true)],
    ["missing_source_guard", "Missing source fallback is represented as a visible blocker path", summary.ready_for_p23601_handoff !== undefined],
    ["no_action_guard", "No action boundary rows remain closed", noActionRows.every((item) => item.allowed_now === false)],
  ];
  return guards.map(([id, label, observed]) => row({
    row_id: `screen_resilience.${id}`,
    category: "screen_resilience_guard",
    label,
    observed,
    evidence_ref: "screen_resilience_guard_rows",
    guard_id: id,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.screenRows)
    && allPass(context.interactionRows)
    && allPass(context.bindingRows)
    && allPass(context.resilienceRows)
    && allPass(context.noActionRows);
  return [
    ["source_ready", "P23600 source is ready for P23601", context.sourceState.sourceReady],
    ["screen_contract_visible", "Operator dashboard screen contract is visible", allPass(context.screenRows)],
    ["interaction_states_visible", "Interaction state checklist is visible", allPass(context.interactionRows)],
    ["data_binding_visible", "Read-only data binding matrix is visible", allPass(context.bindingRows)],
    ["resilience_guard_visible", "Screen resilience guard is visible", allPass(context.resilienceRows)],
    ["no_action_boundary_closed", "No-action boundary remains closed", allPass(context.noActionRows)],
    ["p24001_handoff_gate", "P24001 handoff opens only when screen contract conditions pass", handoffReady],
    ["p24001_handoff_blocker_visible", "P24001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p24000_checkpoint.${id}`,
    category: "p24000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p24000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p24000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.screenRows)
    && allPass(context.interactionRows)
    && allPass(context.bindingRows)
    && allPass(context.resilienceRows)
    && allPass(context.noActionRows)
    && visibleOrPassed(context.checkpointRows, "p24000_checkpoint.p24001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.screenRows)
    && allPass(context.interactionRows)
    && allPass(context.bindingRows)
    && allPass(context.resilienceRows)
    && allPass(context.noActionRows);
  return {
    p24000_contract_ready: p24000ContractReady,
    ready_for_p24001_handoff: handoffReady,
    source_p23600_ready_for_p23601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    operator_dashboard_screen_contract_visible_now: allPass(context.screenRows),
    interaction_state_checklist_visible_now: allPass(context.interactionRows),
    read_only_data_binding_visible_now: allPass(context.bindingRows),
    screen_resilience_guard_visible_now: allPass(context.resilienceRows),
    no_action_boundary_closed_now: allPass(context.noActionRows),
    operator_dashboard_screen_contract_count: context.screenRows.length,
    interaction_state_checklist_count: context.interactionRows.length,
    read_only_data_binding_count: context.bindingRows.length,
    screen_resilience_guard_count: context.resilienceRows.length,
    ...Object.fromEntries(SCREEN_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P23601-P24000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P23601-P24000 Receipt Workbench Operator Dashboard Screen Contract"), "Architecture doc missing P23601-P24000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P23600 source state is not visible"),
    validationItem("screen.contract", "screen", allPass(context.screenRows), "Operator dashboard screen contract rows are incomplete"),
    validationItem("interaction.states", "interaction", context.interactionRows.length >= INTERACTION_STATES.length && allPass(context.interactionRows), "Interaction states are incomplete"),
    validationItem("binding.read_only", "binding", context.bindingRows.every((item) => item.read_only === true && item.mutation_enabled === false), "Data binding opened mutation"),
    validationItem("resilience.guards", "resilience", allPass(context.resilienceRows), "Screen resilience guards are incomplete"),
    validationItem("boundary.no_action", "authority", context.boundary.screen_action_allowed_now === false && context.boundary.live_refresh_allowed_now === false && context.boundary.approve_button_enabled_now === false, "Screen action boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p24000_checkpoint.p24001_handoff_blocker_visible"), "P24000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_dashboard_screen_contract.contract.v1",
    generated_at: generatedAt,
    source_p23600_required_or_rebuilt: true,
    operator_dashboard_screen_contract_required: true,
    interaction_state_checklist_required: true,
    read_only_data_binding_matrix_required: true,
    p24001_handoff_is_not_ui_service_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p24001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p24000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_dashboard_screen_contract_status: status,
    source_p23600_ready_for_p23601_handoff: boundary.source_p23600_ready_for_p23601_handoff,
    operator_dashboard_screen_contract_count: boundary.operator_dashboard_screen_contract_count,
    interaction_state_checklist_count: boundary.interaction_state_checklist_count,
    read_only_data_binding_count: boundary.read_only_data_binding_count,
    screen_resilience_guard_count: boundary.screen_resilience_guard_count,
    ready_for_p24001_handoff: validation.valid && boundary.ready_for_p24001_handoff,
    screen_action_allowed_now: false,
    live_refresh_allowed_now: false,
    approve_button_enabled_now: false,
    server_started_now: false,
    route_handler_registered_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Dashboard Screen Contract",
    "",
    `Status: ${result.summary.receipt_workbench_operator_dashboard_screen_contract_status}`,
    `Program: ${result.program_range}`,
    `P23600 ready for P23601 handoff: ${result.summary.source_p23600_ready_for_p23601_handoff}`,
    `Screen slots: ${result.summary.operator_dashboard_screen_contract_count}`,
    `Interaction states: ${result.summary.interaction_state_checklist_count}`,
    `Ready for P24001 handoff: ${result.summary.ready_for_p24001_handoff}`,
    `Screen action allowed: ${result.summary.screen_action_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_dashboard_screen_contract_rows.map((item) => `<tr><td>${escapeHtml(item.screen_slot)}</td><td>${escapeHtml(item.source_collection_ref)}</td><td>${escapeHtml(item.visible_when_blocked)}</td><td>${escapeHtml(item.mutation_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Dashboard Screen Contract</title>
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
    <h1>Hermes Receipt Workbench Operator Dashboard Screen Contract</h1>
    <p class="notice">This artifact declares read-only operator dashboard screen slots. It does not implement UI routes, perform live fetches, enable clicks, or allow mutations.</p>
    <table><thead><tr><th>Screen Slot</th><th>Source</th><th>Visible When Blocked</th><th>Mutation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP23600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchDashboardHandoffSmoke({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_dashboard_handoff_smoke", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_DASHBOARD_SCREEN_CONTRACT_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_dashboard_handoff_smoke_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchDashboardHandoffSmokePath ?? defaults.sourceReceiptWorkbenchDashboardHandoffSmokePath),
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
      args.sourceReceiptWorkbenchDashboardHandoffSmokePath = argv[++index];
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
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function row(rowData) {
  const observed = Boolean(rowData.observed);
  return {
    ...rowData,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${rowData.label} is missing or blocked.`,
  };
}

function validationItem(itemId, category, ok, message) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message: ok ? "ok" : message,
    evidence_ref: itemId,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  return allPass(rows) || rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function sourceBoundaryClosed(boundary) {
  return [...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_BOUNDARY_FALSE_FLAGS].every((flag) => boundary?.[flag] === false);
}

function allFalseFlagsClosed(boundary) {
  return [...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_BOUNDARY_FALSE_FLAGS].every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function normalizeScreenSlot(surfaceSlot) {
  const value = String(surfaceSlot ?? "");
  if (value.includes("blocker")) return "blocker_banner";
  if (value.includes("evidence")) return "evidence_panel";
  if (value.includes("review")) return "review_panel";
  if (value.includes("task") || value.includes("receipt_status")) return "task_list";
  if (value.includes("summary")) return "summary_bar";
  return "detail_panel";
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, rows };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
