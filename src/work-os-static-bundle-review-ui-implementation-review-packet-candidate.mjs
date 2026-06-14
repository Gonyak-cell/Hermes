import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P39600_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationHandoffPackage,
} from "./work-os-static-bundle-review-ui-implementation-handoff-package.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_PACKET_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-packet-candidate/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_PACKET_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-packet-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p39601-p40000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationHandoffPackagePath: "artifacts/work-os-static-bundle-review-ui-implementation-handoff-package/latest/work-os-static-bundle-review-ui-implementation-handoff-package.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-packet-candidate";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-packet-candidate.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_packet_candidate";
const PROGRAM_RANGE = "P39601-P40000";
const SOURCE_PROGRAM_RANGE = "P39201-P39600";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_packet_candidate";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_packet_candidate_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_packet_candidate";

const PHASE_SPECS = [
  ["P39601-P39640", "P39600 Source Binding", "p39600_source_binding_rows"],
  ["P39641-P39700", "Implementation Review Packet Candidate", "implementation_review_packet_candidate_rows"],
  ["P39701-P39760", "Implementation Review Evidence Summary", "implementation_review_evidence_summary_rows"],
  ["P39761-P39820", "Implementation Finding Seed Rows", "implementation_finding_seed_rows"],
  ["P39821-P39880", "Implementation Reviewer Lane Request Candidate", "implementation_reviewer_lane_request_candidate_rows"],
  ["P39881-P39940", "No Review Completion Boundary", "no_review_completion_boundary_rows"],
  ["P39941-P40000", "P40000 Clean Checkpoint", "p40000_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS = [
  "work_os_static_bundle_review_ui_implementation_review_completion_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_receipt_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_receipt_accept_allowed_now",
  "work_os_static_bundle_review_ui_implementation_reviewer_lane_dispatch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_claude_review_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_human_adjudication_allowed_now",
  "work_os_static_bundle_review_ui_implementation_finding_resolution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_closeout_allowed_now",
  "work_os_static_bundle_review_ui_implementation_enterprise_review_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_generated_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_template_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_component_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_css_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_fixture_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_preview_server_allowed_now",
  "work_os_static_bundle_review_ui_implementation_build_allowed_now",
  "work_os_static_bundle_review_ui_implementation_browser_run_allowed_now",
  "work_os_static_bundle_review_ui_implementation_browser_smoke_allowed_now",
  "work_os_static_bundle_review_ui_implementation_visual_smoke_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_screenshot_capture_allowed_now",
  "work_os_static_bundle_review_ui_implementation_runtime_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_write_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_protected_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_connector_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_deployment_allowed_now",
  "work_os_static_bundle_review_ui_implementation_final_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_production_pass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_secret_read_allowed_now",
  "work_os_static_bundle_review_ui_implementation_raw_payload_exposure_allowed_now",
  "work_os_static_bundle_review_ui_implementation_human_gate_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_independent_review_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS, ...P39600_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Packet Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationHandoffPackage")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_handoff_package", options.workOsStaticBundleReviewUiImplementationHandoffPackage)
    : await readJsonOrBuildP39600(inputs.source_work_os_static_bundle_review_ui_implementation_handoff_package_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const packetRows = buildImplementationReviewPacketCandidateRows({ source, generatedAt });
  const evidenceRows = buildImplementationReviewEvidenceSummaryRows({ source, packetRows, generatedAt });
  const findingRows = buildImplementationFindingSeedRows({ packetRows, evidenceRows, generatedAt });
  const reviewerRows = buildImplementationReviewerLaneRequestCandidateRows({ packetRows, findingRows, generatedAt });
  const boundaryRows = buildNoReviewCompletionBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, packetRows, evidenceRows, findingRows, reviewerRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, packetRows, evidenceRows, findingRows, reviewerRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, packetRows, evidenceRows, findingRows, reviewerRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_handoff_package_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_handoff_package_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_packet_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_phase_rows: phaseRows,
    p39600_source_binding_rows: sourceRows,
    implementation_review_packet_candidate_rows: packetRows,
    implementation_review_evidence_summary_rows: evidenceRows,
    implementation_finding_seed_rows: findingRows,
    implementation_reviewer_lane_request_candidate_rows: reviewerRows,
    no_review_completion_boundary_rows: boundaryRows,
    work_os_static_bundle_review_ui_implementation_review_wiring_rows: wiringRows,
    p40000_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_packet_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-packet-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p39600-source-binding-rows.json"), collectionEnvelope("p39600-source-binding-rows.v1", "p39600_source_binding_rows", result.p39600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-packet-candidate-rows.json"), collectionEnvelope("implementation-review-packet-candidate-rows.v1", "implementation_review_packet_candidate_rows", result.implementation_review_packet_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-evidence-summary-rows.json"), collectionEnvelope("implementation-review-evidence-summary-rows.v1", "implementation_review_evidence_summary_rows", result.implementation_review_evidence_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-finding-seed-rows.json"), collectionEnvelope("implementation-finding-seed-rows.v1", "implementation_finding_seed_rows", result.implementation_finding_seed_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-reviewer-lane-request-candidate-rows.json"), collectionEnvelope("implementation-reviewer-lane-request-candidate-rows.v1", "implementation_reviewer_lane_request_candidate_rows", result.implementation_reviewer_lane_request_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-review-completion-boundary-rows.json"), collectionEnvelope("no-review-completion-boundary-rows.v1", "no_review_completion_boundary_rows", result.no_review_completion_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-ui-implementation-review-wiring-rows.v1", "work_os_static_bundle_review_ui_implementation_review_wiring_rows", result.work_os_static_bundle_review_ui_implementation_review_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p40000-clean-checkpoint-rows.json"), collectionEnvelope("p40000-clean-checkpoint-rows.v1", "p40000_clean_checkpoint_rows", result.p40000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Packet Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P39600 ready for implementation review packet: ${result.summary.source_p39600_ready_for_implementation_review_packet}`);
  console.log(`Review packets: ${result.summary.implementation_review_packet_candidate_count}`);
  console.log(`Evidence summaries: ${result.summary.implementation_review_evidence_summary_count}`);
  console.log(`Finding seeds: ${result.summary.implementation_finding_seed_count}`);
  console.log(`Ready for implementation review request handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff}`);
  console.log(`Review completion allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_completion_allowed_now}`);
  console.log(`Reviewer dispatch allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_reviewer_lane_dispatch_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_handoff_package_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_implementation_handoff_package === true,
    status: summary.work_os_static_bundle_review_ui_implementation_handoff_package_status ?? "missing",
    p39600ContractReady: boundary.p39600_contract_ready === true,
    handoffPackageVisible: boundary.implementation_handoff_package_candidate_visible_now === true,
    manifestVisible: boundary.implementation_file_manifest_candidate_visible_now === true,
    fixtureSmokeVisible: boundary.fixture_smoke_plan_candidate_visible_now === true,
    reviewerNoteVisible: boundary.reviewer_handoff_note_candidate_visible_now === true,
    noImplementationClosed: boundary.no_implementation_boundary_closed_now === true,
    boundaryClosed: P39600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p39601-p40000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P39600 implementation handoff package source is available", sourceState.available],
    ["program_range", "P39600 source program range is P39201-P39600", sourceState.programRangeOk],
    ["validation_valid", "P39600 source validation is valid", sourceState.validationValid],
    ["implementation_review_packet_open", "P39600 opened implementation review packet metadata", sourceState.sourceReady],
    ["p39600_contract_ready", "P39600 source contract is ready", sourceState.p39600ContractReady],
    ["handoff_package_visible", "P39600 implementation handoff package rows are visible", sourceState.handoffPackageVisible],
    ["manifest_visible", "P39600 implementation file manifest rows are visible", sourceState.manifestVisible],
    ["fixture_smoke_visible", "P39600 fixture/smoke plan rows are visible", sourceState.fixtureSmokeVisible],
    ["reviewer_note_visible", "P39600 reviewer handoff note rows are visible", sourceState.reviewerNoteVisible],
    ["no_implementation_closed", "P39600 no-implementation boundary is closed", sourceState.noImplementationClosed],
    ["commit_ref_present", "Current commit ref is present for implementation review packet candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P39600 source blocker is visible when implementation review packet is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p39600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildImplementationReviewPacketCandidateRows({ source, generatedAt }) {
  const handoffRows = source.data?.implementation_handoff_package_candidate_rows ?? [];
  return handoffRows.map((handoff) => row({
    row_id: `implementation_review_packet_candidate.${handoff.request_id}`,
    category: "implementation_review_packet_candidate",
    label: `Implementation review packet candidate for ${handoff.request_id}`,
    observed: handoff.current_verdict === "pass" && handoff.handoff_metadata_only === true,
    evidence_ref: handoff.row_id,
    request_id: handoff.request_id,
    implementation_review_packet_ref: `work_os.static_bundle_review.implementation.${handoff.request_id}.review_packet.candidate`,
    implementation_handoff_package_ref: handoff.implementation_handoff_package_ref,
    component_path_ref: handoff.proposed_component_path,
    test_path_ref: handoff.proposed_test_path,
    style_path_ref: handoff.proposed_style_path,
    component_name: handoff.component_name,
    route_path: handoff.route_path,
    packet_visible_now: true,
    review_completion_allowed_now: false,
    review_receipt_create_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
    approval_allowed_now: false,
    file_apply_allowed_now: false,
    file_write_allowed_now: false,
    build_allowed_now: false,
    browser_run_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildImplementationReviewEvidenceSummaryRows({ source, packetRows, generatedAt }) {
  const handoffRows = source.data?.implementation_handoff_package_candidate_rows ?? [];
  const manifestRows = source.data?.implementation_file_manifest_candidate_rows ?? [];
  const smokeRows = source.data?.fixture_smoke_plan_candidate_rows ?? [];
  const reviewerRows = source.data?.reviewer_handoff_note_candidate_rows ?? [];
  return packetRows.map((packet) => {
    const handoff = handoffRows.find((item) => item.request_id === packet.request_id);
    const manifest = manifestRows.find((item) => item.request_id === packet.request_id);
    const smoke = smokeRows.find((item) => item.request_id === packet.request_id);
    const reviewer = reviewerRows.find((item) => item.request_id === packet.request_id);
    return row({
      row_id: `implementation_review_evidence_summary.${packet.request_id}`,
      category: "implementation_review_evidence_summary",
      label: `Implementation review evidence summary for ${packet.request_id}`,
      observed: Boolean(handoff && manifest && smoke && reviewer),
      evidence_ref: packet.row_id,
      request_id: packet.request_id,
      implementation_review_packet_ref: packet.implementation_review_packet_ref,
      source_evidence_refs: [handoff?.row_id, manifest?.row_id, smoke?.row_id, reviewer?.row_id].filter(Boolean),
      evidence_summary_visible_now: true,
      evidence_complete_now: false,
      review_receipt_accept_allowed_now: false,
      claude_review_execution_allowed_now: false,
      enterprise_review_claim_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildImplementationFindingSeedRows({ packetRows, evidenceRows, generatedAt }) {
  return packetRows.flatMap((packet) => {
    const evidence = evidenceRows.find((item) => item.request_id === packet.request_id);
    return [
      ["file_write_boundary", "Verify implementation package does not create, write, or apply files"],
      ["fixture_execution_boundary", "Verify fixture/smoke metadata does not run browsers, screenshots, or builds"],
      ["review_authority_boundary", "Verify reviewer request does not complete review or adjudication"],
      ["production_trust_boundary", "Verify no production PASS or enterprise trust is claimed"],
    ].map(([findingType, label]) => row({
      row_id: `implementation_finding_seed.${packet.request_id}.${findingType}`,
      category: "implementation_finding_seed",
      label: `${label} for ${packet.request_id}`,
      observed: Boolean(evidence),
      evidence_ref: evidence?.row_id ?? packet.row_id,
      request_id: packet.request_id,
      finding_type: findingType,
      finding_seed_visible_now: true,
      finding_resolution_allowed_now: false,
      review_completion_allowed_now: false,
      closeout_allowed_now: false,
      file_apply_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildImplementationReviewerLaneRequestCandidateRows({ packetRows, findingRows, generatedAt }) {
  return packetRows.map((packet) => {
    const findings = findingRows.filter((item) => item.request_id === packet.request_id);
    return row({
      row_id: `implementation_reviewer_lane_request_candidate.${packet.request_id}`,
      category: "implementation_reviewer_lane_request_candidate",
      label: `Implementation reviewer lane request candidate for ${packet.request_id}`,
      observed: findings.length >= 4,
      evidence_ref: packet.row_id,
      request_id: packet.request_id,
      reviewer_lane: "claude_code_opus_max_candidate",
      implementation_review_packet_ref: packet.implementation_review_packet_ref,
      finding_seed_refs: findings.map((item) => item.row_id),
      request_visible_now: true,
      reviewer_lane_dispatch_allowed_now: false,
      claude_review_execution_allowed_now: false,
      human_adjudication_allowed_now: false,
      review_completion_allowed_now: false,
      final_approval_allowed_now: false,
      production_pass_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoReviewCompletionBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.packet_is_not_review_receipt", "Implementation review packet candidate must not create or accept review receipts", true],
    ["state.evidence_summary_is_not_evidence_completion", "Evidence summary candidate must not complete evidence or claim enterprise review", true],
    ["state.finding_seed_is_not_resolution", "Finding seed must not resolve findings or close out work", true],
    ["state.reviewer_request_is_not_dispatch", "Reviewer lane request candidate must not dispatch Claude, human, or GitHub review", true],
    ["state.review_packet_is_not_file_apply", "Review packet candidate must not write or apply implementation files", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_review_completion_boundary.${id}`,
    category: "no_review_completion_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_review_completion_boundary.${flag}`,
    category: "no_review_completion_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P40000 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-ui-implementation-review-packet-candidate.schema.json"],
    ["roadmap_doc", "Roadmap documents all P39601-P40000 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p39601-p40000.md"],
    ["architecture_doc", "Architecture doc references P39601-P40000", architectureDoc.text.includes("P39601-P40000 Work OS Static Bundle Review UI Implementation Review Packet Candidate"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_ui_implementation_review_wiring.${id}`,
    category: "work_os_static_bundle_review_ui_implementation_review_wiring",
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
    && allPass(context.packetRows)
    && allPass(context.evidenceRows)
    && allPass(context.findingRows)
    && allPass(context.reviewerRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P39600 source is ready for implementation review packet handoff", context.sourceState.sourceReady],
    ["packet_visible", "Implementation review packet candidates are visible", allPass(context.packetRows)],
    ["evidence_visible", "Implementation review evidence summary rows are visible", allPass(context.evidenceRows)],
    ["finding_seed_visible", "Implementation finding seed rows are visible", allPass(context.findingRows)],
    ["reviewer_request_visible", "Implementation reviewer lane request candidates are visible", allPass(context.reviewerRows)],
    ["no_review_completion_boundary_closed", "No-review-completion boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["review_completion_blocked", "Review completion remains blocked", true],
    ["review_receipt_create_blocked", "Review receipt creation and acceptance remain blocked", true],
    ["reviewer_dispatch_blocked", "Reviewer dispatch and Claude execution remain blocked", true],
    ["file_apply_blocked", "Implementation file write/apply remains blocked", true],
    ["p40000_review_packet_handoff", "P40000 review packet handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p40000_checkpoint.${id}`,
    category: "p40000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p40000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p40000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.packetRows)
    && allPass(context.evidenceRows)
    && allPass(context.findingRows)
    && allPass(context.reviewerRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p40000_checkpoint.review_completion_blocked")
    && visibleOrPassed(context.checkpointRows, "p40000_checkpoint.review_receipt_create_blocked")
    && visibleOrPassed(context.checkpointRows, "p40000_checkpoint.file_apply_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p40000ContractReady;
  return {
    p40000_contract_ready: p40000ContractReady,
    ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff: ready,
    source_p39600_ready_for_implementation_review_packet: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    implementation_review_packet_candidate_visible_now: allPass(context.packetRows),
    implementation_review_evidence_summary_visible_now: allPass(context.evidenceRows),
    implementation_finding_seed_visible_now: allPass(context.findingRows),
    implementation_reviewer_lane_request_candidate_visible_now: allPass(context.reviewerRows),
    no_review_completion_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_ui_implementation_review_wiring_complete_now: allPass(context.wiringRows),
    implementation_review_packet_candidate_count: context.packetRows.length,
    implementation_review_evidence_summary_count: context.evidenceRows.length,
    implementation_finding_seed_count: context.findingRows.length,
    implementation_reviewer_lane_request_candidate_count: context.reviewerRows.length,
    review_completion_allowed_count: context.packetRows.filter((item) => item.review_completion_allowed_now === true).length
      + context.findingRows.filter((item) => item.review_completion_allowed_now === true).length
      + context.reviewerRows.filter((item) => item.review_completion_allowed_now === true).length,
    review_receipt_create_allowed_count: context.packetRows.filter((item) => item.review_receipt_create_allowed_now === true || item.review_receipt_accept_allowed_now === true).length,
    reviewer_dispatch_allowed_count: context.reviewerRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true || item.claude_review_execution_allowed_now === true).length,
    finding_resolution_allowed_count: context.findingRows.filter((item) => item.finding_resolution_allowed_now === true).length,
    file_apply_allowed_count: context.packetRows.filter((item) => item.file_apply_allowed_now === true || item.file_write_allowed_now === true).length
      + context.findingRows.filter((item) => item.file_apply_allowed_now === true).length,
    build_allowed_count: context.packetRows.filter((item) => item.build_allowed_now === true || item.browser_run_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P39601-P40000 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P39600 source state is not visible"),
    validationItem("packet.visible", "review", allPass(context.packetRows), "Implementation review packet candidates are incomplete"),
    validationItem("evidence.visible", "review", allPass(context.evidenceRows), "Implementation review evidence summaries are incomplete"),
    validationItem("finding.visible", "review", allPass(context.findingRows), "Implementation finding seeds are incomplete"),
    validationItem("reviewer.visible", "review", allPass(context.reviewerRows), "Implementation reviewer lane request candidates are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-review-completion boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P39601-P40000 wiring is incomplete"),
    validationItem("no.review.receipt", "authority", context.packetRows.every((item) => item.review_receipt_create_allowed_now === false && item.review_receipt_accept_allowed_now === false && item.review_completion_allowed_now === false), "Review receipt or completion opened"),
    validationItem("no.evidence.completion", "authority", context.evidenceRows.every((item) => item.evidence_complete_now === false && item.review_receipt_accept_allowed_now === false && item.claude_review_execution_allowed_now === false), "Evidence completion or Claude review opened"),
    validationItem("no.finding.resolution", "authority", context.findingRows.every((item) => item.finding_resolution_allowed_now === false && item.closeout_allowed_now === false && item.file_apply_allowed_now === false), "Finding resolution, closeout, or file apply opened"),
    validationItem("no.reviewer.dispatch", "authority", context.reviewerRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false && item.claude_review_execution_allowed_now === false && item.human_adjudication_allowed_now === false), "Reviewer dispatch or adjudication opened"),
    validationItem("no.file.apply", "authority", context.boundary.file_apply_allowed_count === 0 && context.boundary.build_allowed_count === 0, "Implementation file apply/build authority opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.review_completion_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p40000_checkpoint.review_completion_blocked"), "P40000 review completion blocker checkpoint is not visible"),
    validationItem("checkpoint.review_receipt_create_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p40000_checkpoint.review_receipt_create_blocked"), "P40000 review receipt blocker checkpoint is not visible"),
    validationItem("checkpoint.file_apply_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p40000_checkpoint.file_apply_blocked"), "P40000 file apply blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_packet_candidate.contract.v1",
    generated_at: generatedAt,
    source_p39600_required_or_rebuilt: true,
    implementation_review_packet_candidate_required: true,
    implementation_evidence_summary_required: true,
    implementation_finding_seed_required: true,
    implementation_reviewer_lane_request_candidate_required: true,
    no_review_completion_boundary_required: true,
    p40000_is_not_review_receipt_review_completion_finding_resolution_reviewer_dispatch_claude_execution_human_adjudication_file_apply_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff
    ? READY_STATUS
    : validation.valid && boundary.p40000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_status: status,
    source_p39600_ready_for_implementation_review_packet: boundary.source_p39600_ready_for_implementation_review_packet,
    implementation_review_packet_candidate_count: boundary.implementation_review_packet_candidate_count,
    implementation_review_evidence_summary_count: boundary.implementation_review_evidence_summary_count,
    implementation_finding_seed_count: boundary.implementation_finding_seed_count,
    implementation_reviewer_lane_request_candidate_count: boundary.implementation_reviewer_lane_request_candidate_count,
    review_completion_allowed_count: boundary.review_completion_allowed_count,
    review_receipt_create_allowed_count: boundary.review_receipt_create_allowed_count,
    reviewer_dispatch_allowed_count: boundary.reviewer_dispatch_allowed_count,
    finding_resolution_allowed_count: boundary.finding_resolution_allowed_count,
    file_apply_allowed_count: boundary.file_apply_allowed_count,
    build_allowed_count: boundary.build_allowed_count,
    ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff,
    work_os_static_bundle_review_ui_implementation_review_completion_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_receipt_create_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_receipt_accept_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_reviewer_lane_dispatch_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_claude_review_execution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_human_adjudication_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_finding_resolution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_approval_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_closeout_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_file_apply_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_file_write_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_build_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_browser_run_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_runtime_execution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_write_action_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_protected_action_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_final_approval_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Packet Candidate",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_status}`,
    `Program: ${result.program_range}`,
    `P39600 ready for implementation review packet: ${result.summary.source_p39600_ready_for_implementation_review_packet}`,
    `Review packets: ${result.summary.implementation_review_packet_candidate_count}`,
    `Evidence summaries: ${result.summary.implementation_review_evidence_summary_count}`,
    `Finding seeds: ${result.summary.implementation_finding_seed_count}`,
    `Ready for implementation review request handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff}`,
    `Review completion allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_completion_allowed_now}`,
    `Reviewer dispatch allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_reviewer_lane_dispatch_allowed_now}`,
    `File apply allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_file_apply_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_reviewer_lane_request_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.reviewer_lane)}</td><td>${escapeHtml(item.reviewer_lane_dispatch_allowed_now)}</td><td>${escapeHtml(item.review_completion_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Packet Candidate</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Packet Candidate</h1>
    <p class="notice">This artifact prepares implementation review packet, finding seed, and reviewer lane request candidates only. It does not create review receipts, dispatch reviewers, resolve findings, apply files, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Reviewer Lane</th><th>Dispatch</th><th>Review Complete</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP39600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationHandoffPackage({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_handoff_package", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_PACKET_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_handoff_package_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationHandoffPackagePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationHandoffPackagePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationHandoffPackagePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-packet-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P39601-P40000 Work OS Static Bundle Review UI Implementation Review Packet Candidate.
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
