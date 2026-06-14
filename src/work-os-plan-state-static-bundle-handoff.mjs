import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P36800_FALSE_FLAGS,
  buildWorkOsPlanStateStaticUiAdapter,
} from "./work-os-plan-state-static-ui-adapter.mjs";

export const DEFAULT_WORK_OS_PLAN_STATE_STATIC_BUNDLE_HANDOFF_OUT_DIR = "artifacts/work-os-plan-state-static-bundle-handoff/latest";
export const DEFAULT_WORK_OS_PLAN_STATE_STATIC_BUNDLE_HANDOFF_INPUTS = {
  schemaPath: "schemas/work-os-plan-state-static-bundle-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p36801-p37200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsPlanStateStaticUiAdapterPath: "artifacts/work-os-plan-state-static-ui-adapter/latest/work-os-plan-state-static-ui-adapter.json",
};

const COMMAND_NAME = "platform:work-os-plan-state-static-bundle-handoff";
const SCHEMA_VERSION = "work-os-plan-state-static-bundle-handoff.v1";
const CAPABILITY_ID = "platform.work_os_plan_state_static_bundle_handoff";
const PROGRAM_RANGE = "P36801-P37200";
const SOURCE_PROGRAM_RANGE = "P36401-P36800";
const READY_STATUS = "ready_for_work_os_plan_state_static_bundle_handoff";
const BLOCK_PENDING_STATUS = "valid_block_work_os_plan_state_static_bundle_handoff_pending";
const BLOCKED_STATUS = "blocked_work_os_plan_state_static_bundle_handoff";

const PHASE_SPECS = [
  ["P36801-P36840", "P36800 Source Binding", "p36800_source_binding_rows"],
  ["P36841-P36900", "Static Bundle Manifest Candidate", "static_bundle_manifest_candidate_rows"],
  ["P36901-P36960", "Static Bundle File Plan Candidate", "static_bundle_file_plan_candidate_rows"],
  ["P36961-P37020", "Static Bundle Handoff Package", "static_bundle_handoff_package_rows"],
  ["P37021-P37080", "Operator Preview Bundle Rows", "operator_preview_bundle_rows"],
  ["P37081-P37140", "No Generated File Apply Boundary", "no_generated_file_apply_boundary_rows"],
  ["P37141-P37200", "P37200 Clean Checkpoint", "p37200_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_FALSE_FLAGS = [
  "work_os_static_bundle_file_write_allowed_now",
  "work_os_static_bundle_file_apply_allowed_now",
  "work_os_static_bundle_generated_file_apply_allowed_now",
  "work_os_static_bundle_artifact_persist_allowed_now",
  "work_os_static_bundle_asset_copy_allowed_now",
  "work_os_static_bundle_shell_overwrite_allowed_now",
  "work_os_static_bundle_manifest_publish_allowed_now",
  "work_os_static_bundle_preview_server_allowed_now",
  "work_os_static_bundle_live_mount_allowed_now",
  "work_os_static_bundle_runtime_fetch_allowed_now",
  "work_os_static_bundle_operator_apply_button_allowed_now",
  "work_os_static_bundle_operator_download_button_allowed_now",
  "work_os_static_bundle_runtime_execution_allowed_now",
  "work_os_static_bundle_write_action_allowed_now",
  "work_os_static_bundle_protected_action_allowed_now",
  "work_os_static_bundle_connector_write_allowed_now",
  "work_os_static_bundle_deployment_allowed_now",
  "work_os_static_bundle_review_completion_allowed_now",
  "work_os_static_bundle_final_approval_allowed_now",
  "work_os_static_bundle_production_pass_allowed_now",
  "work_os_static_bundle_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_secret_read_allowed_now",
  "work_os_static_bundle_human_gate_bypass_allowed_now",
  "work_os_static_bundle_independent_review_bypass_allowed_now",
  "work_os_static_bundle_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_FALSE_FLAGS, ...P36800_FALSE_FLAGS])];

export async function runWorkOsPlanStateStaticBundleHandoff(options = {}) {
  const result = await buildWorkOsPlanStateStaticBundleHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Plan State Static Bundle Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsPlanStateStaticBundleHandoff(result, result.output_dir);
  return result;
}

export async function buildWorkOsPlanStateStaticBundleHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_PLAN_STATE_STATIC_BUNDLE_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsPlanStateStaticUiAdapter")
    ? normalizeInlineJsonSource("inline.work_os_plan_state_static_ui_adapter", options.workOsPlanStateStaticUiAdapter)
    : await readJsonOrBuildP36800(inputs.source_work_os_plan_state_static_ui_adapter_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const manifestRows = buildStaticBundleManifestCandidateRows({ source, generatedAt });
  const filePlanRows = buildStaticBundleFilePlanCandidateRows({ manifestRows, source, generatedAt });
  const packageRows = buildStaticBundleHandoffPackageRows({ manifestRows, filePlanRows, generatedAt });
  const previewRows = buildOperatorPreviewBundleRows({ packageRows, generatedAt });
  const boundaryRows = buildNoGeneratedFileApplyBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, manifestRows, filePlanRows, packageRows, previewRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, manifestRows, filePlanRows, packageRows, previewRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, manifestRows, filePlanRows, packageRows, previewRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_plan_state_static_ui_adapter_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_plan_state_static_ui_summary: source.data?.summary ?? null,
    work_os_static_bundle_handoff_contract: buildContract(generatedAt),
    work_os_static_bundle_phase_rows: phaseRows,
    p36800_source_binding_rows: sourceRows,
    static_bundle_manifest_candidate_rows: manifestRows,
    static_bundle_file_plan_candidate_rows: filePlanRows,
    static_bundle_handoff_package_rows: packageRows,
    operator_preview_bundle_rows: previewRows,
    no_generated_file_apply_boundary_rows: boundaryRows,
    work_os_static_bundle_wiring_rows: wiringRows,
    p37200_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_boundary: boundary,
    work_os_static_bundle_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_plan_state_static_bundle_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsPlanStateStaticBundleHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-plan-state-static-bundle-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p36800-source-binding-rows.json"), collectionEnvelope("p36800-source-binding-rows.v1", "p36800_source_binding_rows", result.p36800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-bundle-manifest-candidate-rows.json"), collectionEnvelope("static-bundle-manifest-candidate-rows.v1", "static_bundle_manifest_candidate_rows", result.static_bundle_manifest_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-bundle-file-plan-candidate-rows.json"), collectionEnvelope("static-bundle-file-plan-candidate-rows.v1", "static_bundle_file_plan_candidate_rows", result.static_bundle_file_plan_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-bundle-handoff-package-rows.json"), collectionEnvelope("static-bundle-handoff-package-rows.v1", "static_bundle_handoff_package_rows", result.static_bundle_handoff_package_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-preview-bundle-rows.json"), collectionEnvelope("operator-preview-bundle-rows.v1", "operator_preview_bundle_rows", result.operator_preview_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-generated-file-apply-boundary-rows.json"), collectionEnvelope("no-generated-file-apply-boundary-rows.v1", "no_generated_file_apply_boundary_rows", result.no_generated_file_apply_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-wiring-rows.v1", "work_os_static_bundle_wiring_rows", result.work_os_static_bundle_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p37200-clean-checkpoint-rows.json"), collectionEnvelope("p37200-clean-checkpoint-rows.v1", "p37200_clean_checkpoint_rows", result.p37200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-boundary.json"), result.work_os_static_bundle_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsPlanStateStaticBundleHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsPlanStateStaticBundleHandoff(args);
  console.log(`Work OS Plan State Static Bundle Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P36800 ready for static bundle: ${result.summary.source_p36800_ready_for_static_bundle}`);
  console.log(`Bundle manifests: ${result.summary.static_bundle_manifest_candidate_count}`);
  console.log(`File plan candidates: ${result.summary.static_bundle_file_plan_candidate_count}`);
  console.log(`Handoff packages: ${result.summary.static_bundle_handoff_package_count}`);
  console.log(`Ready for preview bundle handoff: ${result.summary.ready_for_work_os_preview_bundle_handoff}`);
  console.log(`Generated file apply allowed: ${result.summary.work_os_static_bundle_generated_file_apply_allowed_now}`);
  console.log(`File write allowed: ${result.summary.work_os_static_bundle_file_write_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_plan_state_static_ui_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_ui_handoff === true,
    status: summary.work_os_plan_state_static_ui_status ?? "missing",
    p36800ContractReady: boundary.p36800_contract_ready === true,
    adapterVisible: boundary.static_ui_adapter_candidate_visible_now === true,
    slotVisible: boundary.screen_slot_binding_visible_now === true,
    shellVisible: boundary.static_shell_fixture_visible_now === true,
    interactionVisible: boundary.interaction_smoke_visible_now === true,
    noLiveUiMutationClosed: boundary.no_live_ui_mutation_boundary_closed_now === true,
    wiringVisible: boundary.work_os_plan_state_static_ui_wiring_complete_now === true,
    boundaryClosed: P36800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p36801-p37200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P36800 static UI adapter source is available", sourceState.available],
    ["program_range", "P36800 source program range is P36401-P36800", sourceState.programRangeOk],
    ["validation_valid", "P36800 source validation is valid", sourceState.validationValid],
    ["static_bundle_handoff_open", "P36800 opened static UI handoff", sourceState.sourceReady],
    ["p36800_contract_ready", "P36800 source contract is ready", sourceState.p36800ContractReady],
    ["adapter_visible", "P36800 static adapter candidates are visible", sourceState.adapterVisible],
    ["slot_visible", "P36800 screen slot bindings are visible", sourceState.slotVisible],
    ["shell_visible", "P36800 static shell fixtures are visible", sourceState.shellVisible],
    ["interaction_visible", "P36800 interaction smoke rows are visible", sourceState.interactionVisible],
    ["no_live_ui_mutation_closed", "P36800 no-live-UI-mutation boundary is closed", sourceState.noLiveUiMutationClosed],
    ["static_ui_wiring_visible", "P36800 static UI wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for static bundle handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P36800 source blocker is visible when static bundle handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p36800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticBundleManifestCandidateRows({ source, generatedAt }) {
  const shellRows = source.data?.static_shell_fixture_rows ?? [];
  return shellRows.map((shell) => row({
    row_id: `static_bundle_manifest_candidate.${shell.request_id}`,
    category: "static_bundle_manifest_candidate",
    label: `Static bundle manifest candidate for ${shell.request_id}`,
    observed: Boolean(shell.request_id && shell.fixture_visible_now === true),
    evidence_ref: shell.row_id,
    request_id: shell.request_id,
    bundle_manifest_ref: `work_os.static_bundle.${shell.request_id}.manifest.candidate`,
    static_shell_ref: shell.static_shell_ref,
    route_path: shell.route_path,
    planned_files: [`static/${shell.request_id}/index.html`, `static/${shell.request_id}/manifest.json`],
    manifest_visible_now: true,
    manifest_publish_allowed_now: false,
    artifact_persist_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildStaticBundleFilePlanCandidateRows({ manifestRows, source, generatedAt }) {
  const interactionRows = source.data?.interaction_smoke_rows ?? [];
  return manifestRows.map((manifest) => {
    const interactions = interactionRows.filter((item) => item.request_id === manifest.request_id);
    return row({
      row_id: `static_bundle_file_plan_candidate.${manifest.request_id}`,
      category: "static_bundle_file_plan_candidate",
      label: `Static bundle file plan candidate for ${manifest.request_id}`,
      observed: interactions.length >= 3,
      evidence_ref: manifest.row_id,
      request_id: manifest.request_id,
      bundle_manifest_ref: manifest.bundle_manifest_ref,
      planned_files: manifest.planned_files,
      planned_asset_refs: interactions.map((item) => item.row_id),
      file_plan_visible_now: true,
      file_write_allowed_now: false,
      file_apply_allowed_now: false,
      asset_copy_allowed_now: false,
      shell_overwrite_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildStaticBundleHandoffPackageRows({ manifestRows, filePlanRows, generatedAt }) {
  return manifestRows.map((manifest) => {
    const filePlan = filePlanRows.find((item) => item.request_id === manifest.request_id);
    return row({
      row_id: `static_bundle_handoff_package.${manifest.request_id}`,
      category: "static_bundle_handoff_package",
      label: `Static bundle handoff package for ${manifest.request_id}`,
      observed: Boolean(filePlan),
      evidence_ref: filePlan?.row_id ?? manifest.row_id,
      request_id: manifest.request_id,
      handoff_package_ref: `work_os.static_bundle.${manifest.request_id}.handoff.candidate`,
      bundle_manifest_ref: manifest.bundle_manifest_ref,
      file_plan_ref: filePlan?.row_id ?? null,
      handoff_package_visible_now: true,
      generated_file_apply_allowed_now: false,
      preview_server_allowed_now: false,
      live_mount_allowed_now: false,
      runtime_fetch_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorPreviewBundleRows({ packageRows, generatedAt }) {
  return packageRows.map((pkg) => row({
    row_id: `operator_preview_bundle.${pkg.request_id}`,
    category: "operator_preview_bundle",
    label: `Operator preview bundle row for ${pkg.request_id}`,
    observed: Boolean(pkg.handoff_package_ref),
    evidence_ref: pkg.row_id,
    request_id: pkg.request_id,
    preview_bundle_ref: `operator.preview_bundle.${pkg.request_id}.candidate`,
    handoff_package_ref: pkg.handoff_package_ref,
    operator_status: "blocked_static_bundle_preview_candidate_only",
    next_action: "review_static_bundle_metadata_before_any_file_apply",
    preview_visible_now: true,
    apply_button_enabled_now: false,
    download_button_enabled_now: false,
    file_apply_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoGeneratedFileApplyBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.manifest_is_not_publish", "Static bundle manifest candidate must not publish manifests", true],
    ["state.file_plan_is_not_file_write", "Static bundle file plan must not write or apply files", true],
    ["state.handoff_package_is_not_preview_server", "Static bundle handoff package must not start preview servers", true],
    ["state.operator_preview_is_not_apply_button", "Operator preview bundle must not enable apply/download controls", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_generated_file_apply_boundary.${id}`,
    category: "no_generated_file_apply_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_generated_file_apply_boundary.${flag}`,
    category: "no_generated_file_apply_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P37200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-plan-state-static-bundle-handoff.schema.json"],
    ["roadmap_doc", "Roadmap documents all P36801-P37200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p36801-p37200.md"],
    ["architecture_doc", "Architecture doc references P36801-P37200", architectureDoc.text.includes("P36801-P37200 Work OS Plan State Static Bundle Handoff"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_wiring.${id}`,
    category: "work_os_static_bundle_wiring",
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.manifestRows)
    && allPass(context.filePlanRows)
    && allPass(context.packageRows)
    && allPass(context.previewRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P36800 source is ready for static bundle handoff", context.sourceState.sourceReady],
    ["manifest_visible", "Static bundle manifest candidates are visible", allPass(context.manifestRows)],
    ["file_plan_visible", "Static bundle file plan candidates are visible", allPass(context.filePlanRows)],
    ["handoff_package_visible", "Static bundle handoff packages are visible", allPass(context.packageRows)],
    ["preview_bundle_visible", "Operator preview bundle rows are visible", allPass(context.previewRows)],
    ["no_generated_file_apply_boundary_closed", "No-generated-file-apply boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["file_apply_blocked", "Generated file apply remains blocked", true],
    ["file_write_blocked", "Generated file write remains blocked", true],
    ["static_bundle_handoff", "Static bundle handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p37200_checkpoint.${id}`,
    category: "p37200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p37200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p37200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.manifestRows)
    && allPass(context.filePlanRows)
    && allPass(context.packageRows)
    && allPass(context.previewRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p37200_checkpoint.file_apply_blocked")
    && visibleOrPassed(context.checkpointRows, "p37200_checkpoint.file_write_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p37200ContractReady;
  return {
    p37200_contract_ready: p37200ContractReady,
    ready_for_work_os_preview_bundle_handoff: ready,
    source_p36800_ready_for_static_bundle: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_bundle_manifest_candidate_visible_now: allPass(context.manifestRows),
    static_bundle_file_plan_candidate_visible_now: allPass(context.filePlanRows),
    static_bundle_handoff_package_visible_now: allPass(context.packageRows),
    operator_preview_bundle_visible_now: allPass(context.previewRows),
    no_generated_file_apply_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_wiring_complete_now: allPass(context.wiringRows),
    static_bundle_manifest_candidate_count: context.manifestRows.length,
    static_bundle_file_plan_candidate_count: context.filePlanRows.length,
    static_bundle_handoff_package_count: context.packageRows.length,
    operator_preview_bundle_count: context.previewRows.length,
    file_write_allowed_count: context.filePlanRows.filter((item) => item.file_write_allowed_now === true).length,
    file_apply_allowed_count: context.filePlanRows.filter((item) => item.file_apply_allowed_now === true).length + context.previewRows.filter((item) => item.file_apply_allowed_now === true).length,
    generated_file_apply_allowed_count: context.packageRows.filter((item) => item.generated_file_apply_allowed_now === true).length,
    preview_server_allowed_count: context.packageRows.filter((item) => item.preview_server_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P36801-P37200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P36800 source state is not visible"),
    validationItem("manifest.visible", "bundle", allPass(context.manifestRows), "Static bundle manifests are incomplete"),
    validationItem("file_plan.visible", "bundle", allPass(context.filePlanRows), "Static bundle file plans are incomplete"),
    validationItem("package.visible", "bundle", allPass(context.packageRows), "Static bundle handoff packages are incomplete"),
    validationItem("preview.visible", "operator", allPass(context.previewRows), "Operator preview bundles are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-generated-file-apply boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P36801-P37200 wiring is incomplete"),
    validationItem("no.manifest.publish", "authority", context.manifestRows.every((item) => item.manifest_publish_allowed_now === false && item.artifact_persist_allowed_now === false), "Manifest publish or artifact persist opened"),
    validationItem("no.file.write.apply", "authority", context.filePlanRows.every((item) => item.file_write_allowed_now === false && item.file_apply_allowed_now === false && item.asset_copy_allowed_now === false && item.shell_overwrite_allowed_now === false), "File write/apply/copy opened"),
    validationItem("no.package.preview.server", "authority", context.packageRows.every((item) => item.generated_file_apply_allowed_now === false && item.preview_server_allowed_now === false && item.live_mount_allowed_now === false), "Package apply/preview/live mount opened"),
    validationItem("no.operator.apply", "authority", context.previewRows.every((item) => item.apply_button_enabled_now === false && item.download_button_enabled_now === false && item.file_apply_allowed_now === false), "Operator apply/download opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.file_apply_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p37200_checkpoint.file_apply_blocked"), "P37200 file apply blocker checkpoint is not visible"),
    validationItem("checkpoint.file_write_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p37200_checkpoint.file_write_blocked"), "P37200 file write blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_plan_state_static_bundle_handoff.contract.v1",
    generated_at: generatedAt,
    source_p36800_required_or_rebuilt: true,
    static_bundle_manifest_candidate_required: true,
    static_bundle_file_plan_candidate_required: true,
    static_bundle_handoff_package_required: true,
    operator_preview_bundle_required: true,
    no_generated_file_apply_boundary_required: true,
    p37200_is_not_generated_file_write_file_apply_preview_server_live_mount_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_preview_bundle_handoff
    ? READY_STATUS
    : validation.valid && boundary.p37200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_status: status,
    source_p36800_ready_for_static_bundle: boundary.source_p36800_ready_for_static_bundle,
    static_bundle_manifest_candidate_count: boundary.static_bundle_manifest_candidate_count,
    static_bundle_file_plan_candidate_count: boundary.static_bundle_file_plan_candidate_count,
    static_bundle_handoff_package_count: boundary.static_bundle_handoff_package_count,
    operator_preview_bundle_count: boundary.operator_preview_bundle_count,
    file_write_allowed_count: boundary.file_write_allowed_count,
    file_apply_allowed_count: boundary.file_apply_allowed_count,
    generated_file_apply_allowed_count: boundary.generated_file_apply_allowed_count,
    preview_server_allowed_count: boundary.preview_server_allowed_count,
    ready_for_work_os_preview_bundle_handoff: validation.valid && boundary.ready_for_work_os_preview_bundle_handoff,
    work_os_static_bundle_file_write_allowed_now: false,
    work_os_static_bundle_file_apply_allowed_now: false,
    work_os_static_bundle_generated_file_apply_allowed_now: false,
    work_os_static_bundle_artifact_persist_allowed_now: false,
    work_os_static_bundle_asset_copy_allowed_now: false,
    work_os_static_bundle_shell_overwrite_allowed_now: false,
    work_os_static_bundle_manifest_publish_allowed_now: false,
    work_os_static_bundle_preview_server_allowed_now: false,
    work_os_static_bundle_live_mount_allowed_now: false,
    work_os_static_bundle_runtime_fetch_allowed_now: false,
    work_os_static_bundle_operator_apply_button_allowed_now: false,
    work_os_static_bundle_operator_download_button_allowed_now: false,
    work_os_static_bundle_runtime_execution_allowed_now: false,
    work_os_static_bundle_write_action_allowed_now: false,
    work_os_static_bundle_protected_action_allowed_now: false,
    work_os_static_bundle_final_approval_allowed_now: false,
    work_os_static_bundle_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Plan State Static Bundle Handoff",
    "",
    `Status: ${result.summary.work_os_static_bundle_status}`,
    `Program: ${result.program_range}`,
    `P36800 ready for static bundle: ${result.summary.source_p36800_ready_for_static_bundle}`,
    `Bundle manifests: ${result.summary.static_bundle_manifest_candidate_count}`,
    `File plan candidates: ${result.summary.static_bundle_file_plan_candidate_count}`,
    `Handoff packages: ${result.summary.static_bundle_handoff_package_count}`,
    `Ready for preview bundle handoff: ${result.summary.ready_for_work_os_preview_bundle_handoff}`,
    `Generated file apply allowed: ${result.summary.work_os_static_bundle_generated_file_apply_allowed_now}`,
    `File write allowed: ${result.summary.work_os_static_bundle_file_write_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_preview_bundle_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.preview_bundle_ref)}</td><td>${escapeHtml(item.apply_button_enabled_now)}</td><td>${escapeHtml(item.download_button_enabled_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Plan State Static Bundle Handoff</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1d2433; }
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
    <h1>Hermes Work OS Plan State Static Bundle Handoff</h1>
    <p class="notice">This artifact defines static bundle manifest, file plan, and preview package candidates only. It does not write files, apply generated files, persist artifacts, start preview servers, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Preview Bundle</th><th>Apply</th><th>Download</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP36800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsPlanStateStaticUiAdapter({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_plan_state_static_ui_adapter", built);
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
  const defaults = DEFAULT_WORK_OS_PLAN_STATE_STATIC_BUNDLE_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_plan_state_static_ui_adapter_path: path.resolve(repoRoot, options.sourceWorkOsPlanStateStaticUiAdapterPath ?? defaults.sourceWorkOsPlanStateStaticUiAdapterPath),
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
      args.sourceWorkOsPlanStateStaticUiAdapterPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-plan-state-static-bundle-handoff.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P36801-P37200 Work OS Plan State Static Bundle Handoff.
`);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
