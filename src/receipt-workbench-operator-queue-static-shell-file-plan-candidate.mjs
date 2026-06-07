import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P30000_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff,
} from "./receipt-workbench-operator-queue-static-shell-assembly-handoff.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_FILE_PLAN_CANDIDATE_OUT_DIR = "artifacts/receipt-workbench-operator-queue-static-shell-file-plan-candidate/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_FILE_PLAN_CANDIDATE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-static-shell-file-plan-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p30001-p30400.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoffPath: "artifacts/receipt-workbench-operator-queue-static-shell-assembly-handoff/latest/receipt-workbench-operator-queue-static-shell-assembly-handoff.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-static-shell-file-plan-candidate";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-static-shell-file-plan-candidate.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_static_shell_file_plan_candidate";
const PROGRAM_RANGE = "P30001-P30400";
const SOURCE_PROGRAM_RANGE = "P29601-P30000";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_static_shell_file_plan_candidate";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_static_shell_file_plan_candidate_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_static_shell_file_plan_candidate";

const PHASE_SPECS = [
  ["P30001-P30040", "P30000 Source Binding", "p30000_source_binding_rows"],
  ["P30041-P30120", "Static Shell File Plan Candidate", "static_shell_file_plan_candidate_rows"],
  ["P30121-P30200", "Template File Target Candidate", "template_file_target_candidate_rows"],
  ["P30201-P30280", "State And Copy Integration Candidate", "state_copy_integration_candidate_rows"],
  ["P30281-P30340", "Asset And Token Candidate", "asset_token_candidate_rows"],
  ["P30341-P30380", "No-Write/No-Build Boundary", "no_write_no_build_boundary_rows"],
  ["P30381-P30400", "P30400 Clean Checkpoint", "p30400_clean_checkpoint_rows"],
];

export const STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS = [
  "static_shell_file_plan_candidate_file_create_allowed_now",
  "static_shell_file_plan_candidate_file_write_allowed_now",
  "static_shell_file_plan_candidate_template_apply_allowed_now",
  "static_shell_file_plan_candidate_template_write_allowed_now",
  "static_shell_file_plan_candidate_css_write_allowed_now",
  "static_shell_file_plan_candidate_asset_import_allowed_now",
  "static_shell_file_plan_candidate_asset_build_allowed_now",
  "static_shell_file_plan_candidate_build_allowed_now",
  "static_shell_file_plan_candidate_server_start_allowed_now",
  "static_shell_file_plan_candidate_route_registration_allowed_now",
  "static_shell_file_plan_candidate_route_mount_allowed_now",
  "static_shell_file_plan_candidate_route_execution_allowed_now",
  "static_shell_file_plan_candidate_dom_render_allowed_now",
  "static_shell_file_plan_candidate_browser_run_allowed_now",
  "static_shell_file_plan_candidate_browser_smoke_allowed_now",
  "static_shell_file_plan_candidate_client_hydration_allowed_now",
  "static_shell_file_plan_candidate_live_refresh_allowed_now",
  "static_shell_file_plan_candidate_network_fetch_allowed_now",
  "static_shell_file_plan_candidate_click_action_allowed_now",
  "static_shell_file_plan_candidate_keyboard_action_allowed_now",
  "static_shell_file_plan_candidate_command_button_enabled_now",
  "static_shell_file_plan_candidate_approve_button_enabled_now",
  "static_shell_file_plan_candidate_closeout_button_enabled_now",
  "static_shell_file_plan_candidate_state_mutation_allowed_now",
  "static_shell_file_plan_candidate_write_allowed_now",
  "static_shell_file_plan_candidate_snapshot_capture_allowed_now",
  "static_shell_file_plan_candidate_html_file_write_allowed_now",
  "static_shell_file_plan_candidate_raw_payload_exposure_allowed_now",
  "static_shell_file_plan_candidate_secret_exposure_allowed_now",
  "static_shell_file_plan_candidate_export_allowed_now",
  "static_shell_file_plan_candidate_publish_allowed_now",
  "static_shell_file_plan_candidate_final_approval_allowed_now",
  "static_shell_file_plan_candidate_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS, ...P30000_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Static Shell File Plan Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_FILE_PLAN_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_static_shell_assembly_handoff", options.receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff)
    : await readJsonOrBuildP30000(inputs.source_receipt_workbench_operator_queue_static_shell_assembly_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const filePlanRows = buildStaticShellFilePlanCandidateRows({ source, generatedAt });
  const templateRows = buildTemplateFileTargetCandidateRows({ source, filePlanRows, generatedAt });
  const integrationRows = buildStateCopyIntegrationCandidateRows({ source, filePlanRows, templateRows, generatedAt });
  const assetRows = buildAssetTokenCandidateRows({ source, filePlanRows, templateRows, integrationRows, generatedAt });
  const boundaryRows = buildNoWriteNoBuildBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, filePlanRows, templateRows, integrationRows, assetRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, filePlanRows, templateRows, integrationRows, assetRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, filePlanRows, templateRows, integrationRows, assetRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_static_shell_assembly_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_static_shell_assembly_handoff_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_static_shell_file_plan_candidate_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_static_shell_file_plan_candidate_phase_rows: phaseRows,
    p30000_source_binding_rows: sourceRows,
    static_shell_file_plan_candidate_rows: filePlanRows,
    template_file_target_candidate_rows: templateRows,
    state_copy_integration_candidate_rows: integrationRows,
    asset_token_candidate_rows: assetRows,
    no_write_no_build_boundary_rows: boundaryRows,
    p30400_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary: boundary,
    receipt_workbench_operator_queue_static_shell_file_plan_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_static_shell_file_plan_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-file-plan-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p30000-source-binding-rows.json"), collectionEnvelope("p30000-source-binding-rows.v1", "p30000_source_binding_rows", result.p30000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-file-plan-candidate-rows.json"), collectionEnvelope("static-shell-file-plan-candidate-rows.v1", "static_shell_file_plan_candidate_rows", result.static_shell_file_plan_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "template-file-target-candidate-rows.json"), collectionEnvelope("template-file-target-candidate-rows.v1", "template_file_target_candidate_rows", result.template_file_target_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "state-copy-integration-candidate-rows.json"), collectionEnvelope("state-copy-integration-candidate-rows.v1", "state_copy_integration_candidate_rows", result.state_copy_integration_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "asset-token-candidate-rows.json"), collectionEnvelope("asset-token-candidate-rows.v1", "asset_token_candidate_rows", result.asset_token_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-write-no-build-boundary-rows.json"), collectionEnvelope("no-write-no-build-boundary-rows.v1", "no_write_no_build_boundary_rows", result.no_write_no_build_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p30400-clean-checkpoint-rows.json"), collectionEnvelope("p30400-clean-checkpoint-rows.v1", "p30400_clean_checkpoint_rows", result.p30400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-file-plan-candidate-boundary.json"), result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate(args);
  console.log(`Receipt Workbench Operator Queue Static Shell File Plan Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_static_shell_file_plan_candidate_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P30000 ready for P30001 handoff: ${result.summary.source_p30000_ready_for_p30001_handoff}`);
  console.log(`File plan rows: ${result.summary.static_shell_file_plan_candidate_count}`);
  console.log(`Template target rows: ${result.summary.template_file_target_candidate_count}`);
  console.log(`State/copy integration rows: ${result.summary.state_copy_integration_candidate_count}`);
  console.log(`Asset/token rows: ${result.summary.asset_token_candidate_count}`);
  console.log(`Ready for P30401 handoff: ${result.summary.ready_for_p30401_handoff}`);
  console.log(`File write allowed: ${result.summary.static_shell_file_plan_candidate_file_write_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p30001_handoff === true,
    status: summary.receipt_workbench_operator_queue_static_shell_assembly_handoff_status ?? "missing",
    p30000ContractReady: boundary.p30000_contract_ready === true,
    handoffPacketVisible: boundary.assembly_handoff_packet_visible_now === true,
    templateTargetVisible: boundary.template_target_map_visible_now === true,
    stateCopyBindingVisible: boundary.state_copy_slot_binding_matrix_visible_now === true,
    assetHookVisible: boundary.static_asset_hook_guard_visible_now === true,
    noApplyNoBuildClosed: boundary.no_apply_no_build_boundary_closed_now === true,
    boundaryClosed: P30000_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p30001-p30400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P30000 operator queue static shell assembly handoff source is available", sourceState.available],
    ["program_range", "P30000 source program range is P29601-P30000", sourceState.programRangeOk],
    ["validation_valid", "P30000 source validation is valid", sourceState.validationValid],
    ["p30001_handoff_open", "P30000 source opened P30001 handoff", sourceState.sourceReady],
    ["p30000_contract_ready", "P30000 source contract is ready", sourceState.p30000ContractReady],
    ["handoff_packet_visible", "P30000 assembly handoff packet rows are visible", sourceState.handoffPacketVisible],
    ["template_target_visible", "P30000 template target map rows are visible", sourceState.templateTargetVisible],
    ["state_copy_binding_visible", "P30000 state/copy binding matrix rows are visible", sourceState.stateCopyBindingVisible],
    ["asset_hook_visible", "P30000 static asset hook guard rows are visible", sourceState.assetHookVisible],
    ["no_apply_no_build_closed", "P30000 no-apply/no-build boundary is closed", sourceState.noApplyNoBuildClosed],
    ["commit_ref_present", "Current commit ref is present for static shell file plan candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P30000 source blocker is visible when file plan candidate is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p30000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticShellFilePlanCandidateRows({ source, generatedAt }) {
  const handoffRows = Array.isArray(source.data?.assembly_handoff_packet_rows) ? source.data.assembly_handoff_packet_rows : [];
  return handoffRows.map((handoff, index) => row({
    row_id: `static_shell_file_plan_candidate.${handoff.shell_section_id ?? index + 1}`,
    category: "static_shell_file_plan_candidate",
    label: `Static shell file plan candidate for ${handoff.shell_section_id ?? `section_${index + 1}`}`,
    observed: handoff.current_verdict === "pass" && handoff.handoff_metadata_only === true,
    evidence_ref: handoff.row_id,
    file_plan_candidate_id: `file_plan.operator_queue.${handoff.shell_section_id ?? index + 1}`,
    handoff_packet_ref: handoff.row_id,
    shell_section_id: handoff.shell_section_id ?? `section_${index + 1}`,
    safe_dom_anchor: handoff.safe_dom_anchor,
    candidate_path_hint: `src/ui/operator-queue/static-shell/${handoff.shell_section_id ?? index + 1}.candidate.html`,
    file_plan_metadata_only: true,
    file_create_allowed_now: false,
    file_write_allowed_now: false,
    template_apply_allowed_now: false,
    build_allowed_now: false,
    dom_render_allowed_now: false,
    client_hydration_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    state_mutation_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildTemplateFileTargetCandidateRows({ source, filePlanRows, generatedAt }) {
  const targetRows = Array.isArray(source.data?.template_target_map_rows) ? source.data.template_target_map_rows : [];
  return filePlanRows.map((filePlan, index) => {
    const target = targetRows[index % Math.max(targetRows.length, 1)];
    return row({
      row_id: `template_file_target_candidate.${filePlan.shell_section_id}`,
      category: "template_file_target_candidate",
      label: `Template file target candidate for ${filePlan.shell_section_id}`,
      observed: filePlan.current_verdict === "pass" && Boolean(target) && target.current_verdict === "pass",
      evidence_ref: target?.row_id ?? filePlan.row_id,
      file_plan_candidate_ref: filePlan.row_id,
      source_template_target_ref: target?.row_id ?? null,
      shell_section_id: filePlan.shell_section_id,
      target_path_hint: target?.target_path_hint ?? filePlan.candidate_path_hint,
      data_attribute_contract: target?.data_attribute_contract ?? `data-hermes-section=${filePlan.shell_section_id}`,
      safe_dom_anchor: filePlan.safe_dom_anchor,
      candidate_metadata_only: true,
      file_create_allowed_now: false,
      file_write_allowed_now: false,
      template_apply_allowed_now: false,
      template_write_allowed_now: false,
      html_file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildStateCopyIntegrationCandidateRows({ source, filePlanRows, templateRows, generatedAt }) {
  const bindingRows = Array.isArray(source.data?.state_copy_slot_binding_matrix_rows) ? source.data.state_copy_slot_binding_matrix_rows : [];
  return filePlanRows.map((filePlan, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const binding = bindingRows[index % Math.max(bindingRows.length, 1)];
    return row({
      row_id: `state_copy_integration_candidate.${filePlan.shell_section_id}`,
      category: "state_copy_integration_candidate",
      label: `State and copy integration candidate for ${filePlan.shell_section_id}`,
      observed: filePlan.current_verdict === "pass" && Boolean(template) && binding?.read_only === true && binding?.advisory_only === true,
      evidence_ref: binding?.row_id ?? template?.row_id ?? filePlan.row_id,
      file_plan_candidate_ref: filePlan.row_id,
      template_file_target_candidate_ref: template?.row_id ?? null,
      source_state_copy_binding_ref: binding?.row_id ?? null,
      shell_section_id: filePlan.shell_section_id,
      aria_label_ref: binding?.aria_label_ref ?? null,
      blocker_copy_ref: binding?.blocker_copy_ref ?? null,
      no_action_copy_ref: binding?.no_action_copy_ref ?? null,
      allowed_methods: ["GET", "HEAD"],
      read_only: true,
      advisory_only: true,
      raw_payload_included: false,
      client_hydration_allowed_now: false,
      network_fetch_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      state_mutation_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildAssetTokenCandidateRows({ source, filePlanRows, templateRows, integrationRows, generatedAt }) {
  const assetRows = Array.isArray(source.data?.static_asset_hook_guard_rows) ? source.data.static_asset_hook_guard_rows : [];
  return filePlanRows.map((filePlan, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const integration = integrationRows[index % Math.max(integrationRows.length, 1)];
    const asset = assetRows[index % Math.max(assetRows.length, 1)];
    return row({
      row_id: `asset_token_candidate.${filePlan.shell_section_id}`,
      category: "asset_token_candidate",
      label: `Asset and token candidate for ${filePlan.shell_section_id}`,
      observed: filePlan.current_verdict === "pass" && template?.current_verdict === "pass" && integration?.current_verdict === "pass" && asset?.static_asset_metadata_only === true,
      evidence_ref: asset?.row_id ?? integration?.row_id ?? filePlan.row_id,
      file_plan_candidate_ref: filePlan.row_id,
      template_file_target_candidate_ref: template?.row_id ?? null,
      state_copy_integration_candidate_ref: integration?.row_id ?? null,
      source_asset_hook_ref: asset?.row_id ?? null,
      shell_section_id: filePlan.shell_section_id,
      css_scope_hook: asset?.css_scope_hook ?? `hermes-operator-queue-${filePlan.shell_section_id.replaceAll("_", "-")}`,
      design_token_hook: asset?.design_token_hook ?? `token.operator_queue.${filePlan.shell_section_id}`,
      asset_manifest_ref: asset?.asset_manifest_ref ?? `asset_manifest.operator_queue.${filePlan.shell_section_id}.metadata_only`,
      asset_token_metadata_only: true,
      asset_import_allowed_now: false,
      asset_build_allowed_now: false,
      css_write_allowed_now: false,
      file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoWriteNoBuildBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_write_no_build.${flag}`,
    category: "no_write_no_build_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.filePlanRows)
    && allPass(context.templateRows)
    && allPass(context.integrationRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P30000 source is ready for P30001", context.sourceState.sourceReady],
    ["file_plan_visible", "Static shell file plan candidate rows are visible", allPass(context.filePlanRows)],
    ["template_file_target_visible", "Template file target candidate rows are visible", allPass(context.templateRows)],
    ["state_copy_integration_visible", "State/copy integration candidate rows are visible", allPass(context.integrationRows)],
    ["asset_token_visible", "Asset/token candidate rows are visible", allPass(context.assetRows)],
    ["no_write_no_build_boundary_closed", "No-write/no-build boundary remains closed", allPass(context.boundaryRows)],
    ["p30401_handoff_gate", "P30401 handoff opens only when static shell file plan candidate conditions pass", handoffReady],
    ["p30401_handoff_blocker_visible", "P30401 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p30400_checkpoint.${id}`,
    category: "p30400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p30400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p30400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.filePlanRows)
    && allPass(context.templateRows)
    && allPass(context.integrationRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p30400_checkpoint.p30401_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.filePlanRows)
    && allPass(context.templateRows)
    && allPass(context.integrationRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows);
  return {
    p30400_contract_ready: p30400ContractReady,
    ready_for_p30401_handoff: handoffReady,
    source_p30000_ready_for_p30001_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_shell_file_plan_candidate_visible_now: allPass(context.filePlanRows),
    template_file_target_candidate_visible_now: allPass(context.templateRows),
    state_copy_integration_candidate_visible_now: allPass(context.integrationRows),
    asset_token_candidate_visible_now: allPass(context.assetRows),
    no_write_no_build_boundary_closed_now: allPass(context.boundaryRows),
    static_shell_file_plan_candidate_count: context.filePlanRows.length,
    template_file_target_candidate_count: context.templateRows.length,
    state_copy_integration_candidate_count: context.integrationRows.length,
    asset_token_candidate_count: context.assetRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P30001-P30400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P30001-P30400 Receipt Workbench Operator Queue Static Shell File Plan Candidate"), "Architecture doc missing P30001-P30400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P30000 source state is not visible"),
    validationItem("file.plan", "static_shell_file_plan_candidate", allPass(context.filePlanRows), "Static shell file plan candidate rows are incomplete"),
    validationItem("template.file.target", "static_shell_file_plan_candidate", allPass(context.templateRows), "Template file target candidate rows are incomplete"),
    validationItem("state.copy.integration", "static_shell_file_plan_candidate", allPass(context.integrationRows), "State/copy integration candidate rows are incomplete"),
    validationItem("asset.token", "static_shell_file_plan_candidate", allPass(context.assetRows), "Asset/token candidate rows are incomplete"),
    validationItem("boundary.no_write_no_build", "authority", context.boundary.static_shell_file_plan_candidate_file_write_allowed_now === false && context.boundary.static_shell_file_plan_candidate_build_allowed_now === false && context.boundary.static_shell_file_plan_candidate_file_create_allowed_now === false, "Static shell file plan candidate no-write/no-build boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p30400_checkpoint.p30401_handoff_blocker_visible"), "P30400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_static_shell_file_plan_candidate.contract.v1",
    generated_at: generatedAt,
    source_p30000_required_or_rebuilt: true,
    static_shell_file_plan_candidate_required: true,
    template_file_target_candidate_required: true,
    state_copy_integration_candidate_required: true,
    asset_token_candidate_required: true,
    no_write_no_build_boundary_required: true,
    p30401_handoff_is_not_file_create_write_apply_build_route_dom_browser_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p30401_handoff
    ? READY_STATUS
    : validation.valid && boundary.p30400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_static_shell_file_plan_candidate_status: status,
    source_p30000_ready_for_p30001_handoff: boundary.source_p30000_ready_for_p30001_handoff,
    static_shell_file_plan_candidate_count: boundary.static_shell_file_plan_candidate_count,
    template_file_target_candidate_count: boundary.template_file_target_candidate_count,
    state_copy_integration_candidate_count: boundary.state_copy_integration_candidate_count,
    asset_token_candidate_count: boundary.asset_token_candidate_count,
    ready_for_p30401_handoff: validation.valid && boundary.ready_for_p30401_handoff,
    static_shell_file_plan_candidate_file_create_allowed_now: false,
    static_shell_file_plan_candidate_file_write_allowed_now: false,
    static_shell_file_plan_candidate_template_apply_allowed_now: false,
    static_shell_file_plan_candidate_template_write_allowed_now: false,
    static_shell_file_plan_candidate_css_write_allowed_now: false,
    static_shell_file_plan_candidate_asset_import_allowed_now: false,
    static_shell_file_plan_candidate_asset_build_allowed_now: false,
    static_shell_file_plan_candidate_build_allowed_now: false,
    static_shell_file_plan_candidate_route_execution_allowed_now: false,
    static_shell_file_plan_candidate_dom_render_allowed_now: false,
    static_shell_file_plan_candidate_browser_run_allowed_now: false,
    static_shell_file_plan_candidate_client_hydration_allowed_now: false,
    static_shell_file_plan_candidate_network_fetch_allowed_now: false,
    static_shell_file_plan_candidate_click_action_allowed_now: false,
    static_shell_file_plan_candidate_write_allowed_now: false,
    static_shell_file_plan_candidate_state_mutation_allowed_now: false,
    static_shell_file_plan_candidate_html_file_write_allowed_now: false,
    static_shell_file_plan_candidate_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Static Shell File Plan Candidate",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_static_shell_file_plan_candidate_status}`,
    `Program: ${result.program_range}`,
    `P30000 ready for P30001 handoff: ${result.summary.source_p30000_ready_for_p30001_handoff}`,
    `File plan rows: ${result.summary.static_shell_file_plan_candidate_count}`,
    `Template target rows: ${result.summary.template_file_target_candidate_count}`,
    `State/copy integration rows: ${result.summary.state_copy_integration_candidate_count}`,
    `Asset/token rows: ${result.summary.asset_token_candidate_count}`,
    `Ready for P30401 handoff: ${result.summary.ready_for_p30401_handoff}`,
    `File write allowed: ${result.summary.static_shell_file_plan_candidate_file_write_allowed_now}`,
    `Build allowed: ${result.summary.static_shell_file_plan_candidate_build_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.static_shell_file_plan_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.candidate_path_hint)}</td><td>${escapeHtml(item.file_create_allowed_now)}</td><td>${escapeHtml(item.file_write_allowed_now)}</td><td>${escapeHtml(item.build_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Static Shell File Plan Candidate</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Static Shell File Plan Candidate</h1>
    <p class="notice">This artifact defines file plan candidate metadata only. It does not create files, write templates, import assets, build UI assets, start servers, register routes, render DOM, run browsers, hydrate client state, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Candidate Path</th><th>Create</th><th>Write</th><th>Build</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP30000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_static_shell_assembly_handoff", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_FILE_PLAN_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_static_shell_assembly_handoff_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoffPath ?? defaults.sourceReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoffPath),
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
      args.sourceReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-static-shell-file-plan-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P30001-P30400 Receipt Workbench Operator Queue Static Shell File Plan Candidate.
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
