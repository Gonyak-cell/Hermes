import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P28800_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellHandoff,
} from "./receipt-workbench-operator-queue-static-shell-handoff.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_CANDIDATE_OUT_DIR = "artifacts/receipt-workbench-operator-queue-static-shell-candidate/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_CANDIDATE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-static-shell-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p28801-p29200.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueStaticShellHandoffPath: "artifacts/receipt-workbench-operator-queue-static-shell-handoff/latest/receipt-workbench-operator-queue-static-shell-handoff.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-static-shell-candidate";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-static-shell-candidate.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_static_shell_candidate";
const PROGRAM_RANGE = "P28801-P29200";
const SOURCE_PROGRAM_RANGE = "P28401-P28800";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_static_shell_candidate";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_static_shell_candidate_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_static_shell_candidate";

const PHASE_SPECS = [
  ["P28801-P28840", "P28800 Source Binding", "p28800_source_binding_rows"],
  ["P28841-P28920", "Static Shell Implementation Candidate Contract", "static_shell_candidate_contract_rows"],
  ["P28921-P29000", "Section Template Manifest", "section_template_manifest_rows"],
  ["P29001-P29080", "Fixture Hydration Stub Map", "fixture_hydration_stub_map_rows"],
  ["P29081-P29140", "Blocked Control Copy Binding", "blocked_control_copy_binding_rows"],
  ["P29141-P29180", "No-Serve/No-DOM Boundary", "no_serve_no_dom_boundary_rows"],
  ["P29181-P29200", "P29200 Clean Checkpoint", "p29200_clean_checkpoint_rows"],
];

const CANDIDATE_SECTIONS = [
  ["queue_summary_header", "Queue summary header implementation candidate"],
  ["receipt_candidate_index", "Receipt candidate index implementation candidate"],
  ["receipt_candidate_detail_drawer", "Receipt candidate detail drawer implementation candidate"],
  ["validation_evidence_stack", "Validation evidence stack implementation candidate"],
  ["review_status_strip", "Review status strip implementation candidate"],
  ["blocker_notice_band", "Blocker notice band implementation candidate"],
  ["next_action_sidebar", "Next action sidebar implementation candidate"],
  ["redaction_notice_footer", "Redaction notice footer implementation candidate"],
];

export const STATIC_SHELL_CANDIDATE_FALSE_FLAGS = [
  "static_shell_candidate_server_start_allowed_now",
  "static_shell_candidate_route_registration_allowed_now",
  "static_shell_candidate_route_mount_allowed_now",
  "static_shell_candidate_route_execution_allowed_now",
  "static_shell_candidate_dom_render_allowed_now",
  "static_shell_candidate_browser_run_allowed_now",
  "static_shell_candidate_browser_smoke_allowed_now",
  "static_shell_candidate_live_refresh_allowed_now",
  "static_shell_candidate_network_fetch_allowed_now",
  "static_shell_candidate_click_action_allowed_now",
  "static_shell_candidate_keyboard_action_allowed_now",
  "static_shell_candidate_write_allowed_now",
  "static_shell_candidate_state_mutation_allowed_now",
  "static_shell_candidate_snapshot_capture_allowed_now",
  "static_shell_candidate_html_file_write_allowed_now",
  "static_shell_candidate_raw_payload_exposure_allowed_now",
  "static_shell_candidate_secret_exposure_allowed_now",
  "static_shell_candidate_command_button_enabled_now",
  "static_shell_candidate_approve_button_enabled_now",
  "static_shell_candidate_closeout_button_enabled_now",
  "static_shell_candidate_export_allowed_now",
  "static_shell_candidate_publish_allowed_now",
  "static_shell_candidate_final_approval_allowed_now",
  "static_shell_candidate_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_CANDIDATE_FALSE_FLAGS, ...P28800_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueStaticShellCandidate(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Static Shell Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueStaticShellCandidate(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueStaticShellCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueStaticShellHandoff")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_static_shell_handoff", options.receiptWorkbenchOperatorQueueStaticShellHandoff)
    : await readJsonOrBuildP28800(inputs.source_receipt_workbench_operator_queue_static_shell_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const candidateRows = buildStaticShellCandidateContractRows({ source, generatedAt });
  const templateRows = buildSectionTemplateManifestRows({ source, candidateRows, generatedAt });
  const hydrationRows = buildFixtureHydrationStubMapRows({ source, candidateRows, templateRows, generatedAt });
  const copyRows = buildBlockedControlCopyBindingRows({ source, candidateRows, templateRows, hydrationRows, generatedAt });
  const boundaryRows = buildNoServeNoDomBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_static_shell_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_static_shell_handoff_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_static_shell_candidate_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_static_shell_candidate_phase_rows: phaseRows,
    p28800_source_binding_rows: sourceRows,
    static_shell_candidate_contract_rows: candidateRows,
    section_template_manifest_rows: templateRows,
    fixture_hydration_stub_map_rows: hydrationRows,
    blocked_control_copy_binding_rows: copyRows,
    no_serve_no_dom_boundary_rows: boundaryRows,
    p29200_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_static_shell_candidate_boundary: boundary,
    receipt_workbench_operator_queue_static_shell_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_static_shell_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_static_shell_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_static_shell_candidate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueStaticShellCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p28800-source-binding-rows.json"), collectionEnvelope("p28800-source-binding-rows.v1", "p28800_source_binding_rows", result.p28800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-candidate-contract-rows.json"), collectionEnvelope("static-shell-candidate-contract-rows.v1", "static_shell_candidate_contract_rows", result.static_shell_candidate_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "section-template-manifest-rows.json"), collectionEnvelope("section-template-manifest-rows.v1", "section_template_manifest_rows", result.section_template_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-hydration-stub-map-rows.json"), collectionEnvelope("fixture-hydration-stub-map-rows.v1", "fixture_hydration_stub_map_rows", result.fixture_hydration_stub_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-control-copy-binding-rows.json"), collectionEnvelope("blocked-control-copy-binding-rows.v1", "blocked_control_copy_binding_rows", result.blocked_control_copy_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-no-dom-boundary-rows.json"), collectionEnvelope("no-serve-no-dom-boundary-rows.v1", "no_serve_no_dom_boundary_rows", result.no_serve_no_dom_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p29200-clean-checkpoint-rows.json"), collectionEnvelope("p29200-clean-checkpoint-rows.v1", "p29200_clean_checkpoint_rows", result.p29200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-candidate-boundary.json"), result.receipt_workbench_operator_queue_static_shell_candidate_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueStaticShellCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueStaticShellCandidate(args);
  console.log(`Receipt Workbench Operator Queue Static Shell Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_static_shell_candidate_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P28800 ready for P28801 handoff: ${result.summary.source_p28800_ready_for_p28801_handoff}`);
  console.log(`Candidate rows: ${result.summary.static_shell_candidate_contract_count}`);
  console.log(`Template rows: ${result.summary.section_template_manifest_count}`);
  console.log(`Hydration stub rows: ${result.summary.fixture_hydration_stub_map_count}`);
  console.log(`Ready for P29201 handoff: ${result.summary.ready_for_p29201_handoff}`);
  console.log(`Static shell candidate DOM render allowed: ${result.summary.static_shell_candidate_dom_render_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_static_shell_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p28801_handoff === true,
    status: summary.receipt_workbench_operator_queue_static_shell_handoff_status ?? "missing",
    p28800ContractReady: boundary.p28800_contract_ready === true,
    staticShellHandoffVisible: boundary.static_shell_handoff_contract_visible_now === true,
    shellSectionBindingVisible: boundary.shell_section_binding_map_visible_now === true,
    fixtureSlotProjectionVisible: boundary.fixture_slot_projection_visible_now === true,
    blockedStateCopyVisible: boundary.blocked_state_copy_surface_visible_now === true,
    noServeNoRenderClosed: boundary.no_serve_no_render_authority_closed_now === true,
    boundaryClosed: P28800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p28801-p29200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P28800 operator queue static shell handoff source is available", sourceState.available],
    ["program_range", "P28800 source program range is P28401-P28800", sourceState.programRangeOk],
    ["validation_valid", "P28800 source validation is valid", sourceState.validationValid],
    ["p28801_handoff_open", "P28800 source opened P28801 handoff", sourceState.sourceReady],
    ["p28800_contract_ready", "P28800 source contract is ready", sourceState.p28800ContractReady],
    ["static_shell_handoff_visible", "P28800 static shell handoff rows are visible", sourceState.staticShellHandoffVisible],
    ["shell_section_binding_visible", "P28800 shell section binding rows are visible", sourceState.shellSectionBindingVisible],
    ["fixture_slot_projection_visible", "P28800 fixture slot projection rows are visible", sourceState.fixtureSlotProjectionVisible],
    ["blocked_state_copy_visible", "P28800 blocked state copy rows are visible", sourceState.blockedStateCopyVisible],
    ["no_serve_no_render_closed", "P28800 no-serve/no-render authority is closed", sourceState.noServeNoRenderClosed],
    ["commit_ref_present", "Current commit ref is present for static shell candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P28800 source blocker is visible when static shell candidate is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p28800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticShellCandidateContractRows({ source, generatedAt }) {
  const handoffRows = Array.isArray(source.data?.static_shell_handoff_contract_rows) ? source.data.static_shell_handoff_contract_rows : [];
  return CANDIDATE_SECTIONS.map(([sectionId, label], index) => {
    const handoff = handoffRows[index % Math.max(handoffRows.length, 1)];
    return row({
      row_id: `static_shell_candidate_contract.${sectionId}`,
      category: "static_shell_candidate_contract",
      label,
      observed: Boolean(handoff) && handoff.current_verdict === "pass" && handoff.read_only === true,
      evidence_ref: handoff?.row_id ?? "static_shell_handoff_contract_rows",
      candidate_id: `candidate.operator_queue.${sectionId}`,
      shell_section_id: sectionId,
      source_handoff_ref: handoff?.row_id ?? null,
      safe_dom_anchor: handoff?.safe_dom_anchor ?? `#hermes-${sectionId.replaceAll("_", "-")}`,
      template_candidate_ref: `template.operator_queue.${sectionId}`,
      static_metadata_only: true,
      visible_now: true,
      visible_when_blocked: true,
      server_start_allowed_now: false,
      route_registration_allowed_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      browser_smoke_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      html_file_write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildSectionTemplateManifestRows({ source, candidateRows, generatedAt }) {
  const sectionRows = Array.isArray(source.data?.shell_section_binding_map_rows) ? source.data.shell_section_binding_map_rows : [];
  return candidateRows.map((candidate, index) => {
    const section = sectionRows[index % Math.max(sectionRows.length, 1)];
    return row({
      row_id: `section_template_manifest.${candidate.shell_section_id}`,
      category: "section_template_manifest",
      label: `Section template manifest for ${candidate.shell_section_id}`,
      observed: candidate.current_verdict === "pass" && Boolean(section) && section.static_shell_only === true,
      evidence_ref: section?.row_id ?? candidate.row_id,
      template_id: `template.operator_queue.${candidate.shell_section_id}`,
      candidate_ref: candidate.row_id,
      source_section_ref: section?.row_id ?? null,
      shell_slot_id: section?.shell_slot_id ?? `shell.operator_queue.${candidate.shell_section_id}`,
      safe_dom_anchor: candidate.safe_dom_anchor,
      template_kind: "static_section_metadata",
      allowed_methods: ["GET", "HEAD"],
      html_file_write_allowed_now: false,
      dom_render_allowed_now: false,
      route_registered_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      browser_run_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildFixtureHydrationStubMapRows({ source, candidateRows, templateRows, generatedAt }) {
  const fixtureRows = Array.isArray(source.data?.fixture_slot_projection_rows) ? source.data.fixture_slot_projection_rows : [];
  return candidateRows.map((candidate, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const fixture = fixtureRows[index % Math.max(fixtureRows.length, 1)];
    return row({
      row_id: `fixture_hydration_stub_map.${candidate.shell_section_id}`,
      category: "fixture_hydration_stub_map",
      label: `Fixture hydration stub map for ${candidate.shell_section_id}`,
      observed: candidate.current_verdict === "pass" && Boolean(template) && Boolean(fixture) && fixture.allowed_methods?.includes("GET"),
      evidence_ref: fixture?.row_id ?? template?.row_id ?? candidate.row_id,
      hydration_stub_id: `hydration_stub.operator_queue.${candidate.shell_section_id}`,
      candidate_ref: candidate.row_id,
      template_ref: template?.row_id ?? null,
      fixture_slot_ref: fixture?.row_id ?? null,
      fixture_state: fixture?.fixture_state ?? null,
      allowed_methods: ["GET", "HEAD"],
      client_hydration_allowed_now: false,
      live_fetch_allowed_now: false,
      network_fetch_allowed_now: false,
      mutating_methods_allowed_now: false,
      route_execution_allowed_now: false,
      raw_payload_included: false,
      secret_exposure_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildBlockedControlCopyBindingRows({ source, candidateRows, templateRows, hydrationRows, generatedAt }) {
  const copyRows = Array.isArray(source.data?.blocked_state_copy_surface_rows) ? source.data.blocked_state_copy_surface_rows : [];
  return candidateRows.map((candidate, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const hydration = hydrationRows[index % Math.max(hydrationRows.length, 1)];
    const copy = copyRows[index % Math.max(copyRows.length, 1)];
    return row({
      row_id: `blocked_control_copy_binding.${candidate.shell_section_id}`,
      category: "blocked_control_copy_binding",
      label: `Blocked control copy binding for ${candidate.shell_section_id}`,
      observed: Boolean(candidate) && Boolean(template) && Boolean(hydration) && Boolean(copy),
      evidence_ref: copy?.row_id ?? hydration?.row_id ?? candidate.row_id,
      candidate_ref: candidate.row_id,
      template_ref: template?.row_id ?? null,
      hydration_stub_ref: hydration?.row_id ?? null,
      source_copy_ref: copy?.row_id ?? null,
      blocker_copy_ref: copy?.blocker_copy_ref ?? `copy.operator_queue.${candidate.shell_section_id}.blocker`,
      no_action_copy_ref: copy?.no_action_copy_ref ?? `copy.operator_queue.${candidate.shell_section_id}.no_action`,
      redaction_copy_ref: copy?.redaction_copy_ref ?? `copy.operator_queue.${candidate.shell_section_id}.redaction`,
      visible_now: true,
      visible_when_blocked: true,
      advisory_only: true,
      command_button_enabled_now: false,
      approve_button_enabled_now: false,
      closeout_button_enabled_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoServeNoDomBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_no_dom.${flag}`,
    category: "no_serve_no_dom_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_static_shell_candidate_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P28800 source is ready for P28801", context.sourceState.sourceReady],
    ["candidate_contract_visible", "Static shell candidate contract rows are visible", allPass(context.candidateRows)],
    ["section_template_manifest_visible", "Section template manifest rows are visible", allPass(context.templateRows)],
    ["fixture_hydration_stub_visible", "Fixture hydration stub rows are visible", allPass(context.hydrationRows)],
    ["blocked_control_copy_visible", "Blocked control copy rows are visible", allPass(context.copyRows)],
    ["no_serve_no_dom_boundary_closed", "No-serve/no-DOM boundary remains closed", allPass(context.boundaryRows)],
    ["p29201_handoff_gate", "P29201 handoff opens only when static shell candidate conditions pass", handoffReady],
    ["p29201_handoff_blocker_visible", "P29201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p29200_checkpoint.${id}`,
    category: "p29200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p29200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p29200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p29200_checkpoint.p29201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows);
  return {
    p29200_contract_ready: p29200ContractReady,
    ready_for_p29201_handoff: handoffReady,
    source_p28800_ready_for_p28801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_shell_candidate_contract_visible_now: allPass(context.candidateRows),
    section_template_manifest_visible_now: allPass(context.templateRows),
    fixture_hydration_stub_map_visible_now: allPass(context.hydrationRows),
    blocked_control_copy_binding_visible_now: allPass(context.copyRows),
    no_serve_no_dom_boundary_closed_now: allPass(context.boundaryRows),
    static_shell_candidate_contract_count: context.candidateRows.length,
    section_template_manifest_count: context.templateRows.length,
    fixture_hydration_stub_map_count: context.hydrationRows.length,
    blocked_control_copy_binding_count: context.copyRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P28801-P29200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P28801-P29200 Receipt Workbench Operator Queue Static Shell Candidate"), "Architecture doc missing P28801-P29200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P28800 source state is not visible"),
    validationItem("candidate.contract", "static_shell_candidate", allPass(context.candidateRows), "Static shell candidate rows are incomplete"),
    validationItem("template.manifest", "static_shell_candidate", allPass(context.templateRows), "Section template manifest rows are incomplete"),
    validationItem("fixture.hydration", "static_shell_candidate", allPass(context.hydrationRows), "Fixture hydration stub rows are incomplete"),
    validationItem("blocked.copy", "static_shell_candidate", allPass(context.copyRows), "Blocked control copy rows are incomplete"),
    validationItem("boundary.no_serve_no_dom", "authority", context.boundary.static_shell_candidate_server_start_allowed_now === false && context.boundary.static_shell_candidate_dom_render_allowed_now === false && context.boundary.static_shell_candidate_browser_run_allowed_now === false, "Static shell candidate no-serve/no-DOM boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p29200_checkpoint.p29201_handoff_blocker_visible"), "P29200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_static_shell_candidate.contract.v1",
    generated_at: generatedAt,
    source_p28800_required_or_rebuilt: true,
    static_shell_candidate_contract_required: true,
    section_template_manifest_required: true,
    fixture_hydration_stub_map_required: true,
    blocked_control_copy_binding_required: true,
    no_serve_no_dom_boundary_required: true,
    p29201_handoff_is_not_server_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p29201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p29200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_static_shell_candidate_status: status,
    source_p28800_ready_for_p28801_handoff: boundary.source_p28800_ready_for_p28801_handoff,
    static_shell_candidate_contract_count: boundary.static_shell_candidate_contract_count,
    section_template_manifest_count: boundary.section_template_manifest_count,
    fixture_hydration_stub_map_count: boundary.fixture_hydration_stub_map_count,
    blocked_control_copy_binding_count: boundary.blocked_control_copy_binding_count,
    ready_for_p29201_handoff: validation.valid && boundary.ready_for_p29201_handoff,
    static_shell_candidate_server_start_allowed_now: false,
    static_shell_candidate_route_execution_allowed_now: false,
    static_shell_candidate_dom_render_allowed_now: false,
    static_shell_candidate_browser_run_allowed_now: false,
    static_shell_candidate_browser_smoke_allowed_now: false,
    static_shell_candidate_live_refresh_allowed_now: false,
    static_shell_candidate_network_fetch_allowed_now: false,
    static_shell_candidate_click_action_allowed_now: false,
    static_shell_candidate_write_allowed_now: false,
    static_shell_candidate_state_mutation_allowed_now: false,
    static_shell_candidate_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Static Shell Candidate",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_static_shell_candidate_status}`,
    `Program: ${result.program_range}`,
    `P28800 ready for P28801 handoff: ${result.summary.source_p28800_ready_for_p28801_handoff}`,
    `Candidate rows: ${result.summary.static_shell_candidate_contract_count}`,
    `Template rows: ${result.summary.section_template_manifest_count}`,
    `Hydration stub rows: ${result.summary.fixture_hydration_stub_map_count}`,
    `Ready for P29201 handoff: ${result.summary.ready_for_p29201_handoff}`,
    `Static shell candidate DOM render allowed: ${result.summary.static_shell_candidate_dom_render_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.static_shell_candidate_contract_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td><td>${escapeHtml(item.html_file_write_allowed_now)}</td><td>${escapeHtml(item.browser_run_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Static Shell Candidate</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Static Shell Candidate</h1>
    <p class="notice">This artifact defines static shell implementation candidate metadata only. It does not write UI files, start servers, register routes, render DOM, run browsers, hydrate client state, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Safe DOM Anchor</th><th>DOM Render</th><th>HTML Write</th><th>Browser</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP28800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueStaticShellHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_static_shell_handoff", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_static_shell_handoff_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueStaticShellHandoffPath ?? defaults.sourceReceiptWorkbenchOperatorQueueStaticShellHandoffPath),
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
      args.sourceReceiptWorkbenchOperatorQueueStaticShellHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-static-shell-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P28801-P29200 Receipt Workbench Operator Queue Static Shell Candidate.
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
