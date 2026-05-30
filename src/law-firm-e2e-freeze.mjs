import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LAW_FIRM_E2E_FREEZE_OUT_DIR = "artifacts/law-firm-e2e-freeze/latest";
export const DEFAULT_LAW_FIRM_E2E_FREEZE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  lawFirmPackManifestPath: "artifacts/law-firm-pack-manifest/latest/law-firm-pack-manifest.json",
  matterOsProfilePath: "artifacts/matter-os-profile/latest/matter-os-profile.json",
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterTaskBoardPath: "artifacts/matter-task-board/latest/matter-task-board.json",
  matterKnowledgeGraphPath: "artifacts/matter-knowledge-graph/latest/matter-knowledge-graph.json",
  matterPrivilegeClassifierPath: "artifacts/matter-privilege-classifier/latest/matter-privilege-classifier.json",
  matterPersonalDataDetectorPath: "artifacts/matter-personal-data-detector/latest/matter-personal-data-detector.json",
  legalCitationVerifierPath: "artifacts/legal-citation-verifier/latest/legal-citation-verifier.json",
  lddVdrInventoryPath: "artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json",
  lddDocumentClassificationPath: "artifacts/ldd-document-classification/latest/ldd-document-classification.json",
  lddExtractorSelectionPath: "artifacts/ldd-extractor-selection/latest/ldd-extractor-selection.json",
  lddFactExtractionPath: "artifacts/ldd-fact-extraction/latest/ldd-fact-extraction.json",
  lddIssueDetectionPath: "artifacts/ldd-issue-detection/latest/ldd-issue-detection.json",
  lddRfiGeneratorPath: "artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json",
  lddReportDraftPath: "artifacts/ldd-report-draft/latest/ldd-report-draft.json",
  litigationBriefDraftPath: "artifacts/litigation-brief-draft/latest/litigation-brief-draft.json",
  meetingMinutesWorkflowPath: "artifacts/meeting-minutes-workflow/latest/meeting-minutes-workflow.json",
  contractDraftWorkflowPath: "artifacts/contract-draft-workflow/latest/contract-draft-workflow.json",
  providedMaterialReviewPath: "artifacts/provided-material-review/latest/provided-material-review-ledger.json",
  legalApprovalMatrixPath: "artifacts/legal-approval-matrix/latest/legal-approval-matrix.json",
};

const CONTRACT_ID = "law-firm-e2e-freeze.v1";
const PACK_ID = "law-firm";
const CAPABILITY_ID = "law_firm.e2e.freeze";
const FREEZE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "law_firm_phase_artifacts_e2e_freeze_report";
const DESKTOP_SURFACE_POLICY = "read_only_law_firm_e2e_freeze_surface";

const SOURCE_DEFINITIONS = [
  sourceDefinition("law_firm_pack_manifest", "Law Firm Pack Manifest", "P231", "lawFirmPackManifestPath", "law-firm:pack-manifest", "law_firm_pack_manifest_status"),
  sourceDefinition("matter_os_profile", "Matter OS Profile", "P232", "matterOsProfilePath", "matter-os:profile", "matter_os_profile_status"),
  sourceDefinition("matter_timeline", "Matter Timeline", "P233", "matterTimelinePath", "matter:timeline", "matter_timeline_status"),
  sourceDefinition("matter_document_index", "Matter Document Index", "P234", "matterDocumentIndexPath", "matter:document-index", "matter_document_index_status"),
  sourceDefinition("matter_task_board", "Matter Task Board", "P235", "matterTaskBoardPath", "matter:task-board", "matter_task_board_status"),
  sourceDefinition("matter_knowledge_graph", "Matter Knowledge Graph", "P236", "matterKnowledgeGraphPath", "matter:knowledge-graph", "matter_knowledge_graph_status"),
  sourceDefinition("matter_privilege_classifier", "Matter Privilege Classifier", "P237", "matterPrivilegeClassifierPath", "matter:privilege-classifier", "matter_privilege_classifier_status"),
  sourceDefinition("matter_personal_data_detector", "Matter Personal Data Detector", "P238", "matterPersonalDataDetectorPath", "matter:personal-data-detector", "matter_personal_data_detector_status"),
  sourceDefinition("legal_citation_verifier", "Legal Citation Verifier", "P239", "legalCitationVerifierPath", "legal:citations", "legal_citation_verifier_status"),
  sourceDefinition("ldd_vdr_inventory", "LDD VDR Inventory", "P240", "lddVdrInventoryPath", "law-firm:vdr-inventory", "ldd_vdr_inventory_status"),
  sourceDefinition("ldd_document_classification", "LDD Document Classification", "P241", "lddDocumentClassificationPath", "law-firm:document-classification", "ldd_document_classification_status"),
  sourceDefinition("ldd_extractor_selection", "LDD Extractor Selection", "P242", "lddExtractorSelectionPath", "law-firm:extractor-selection", "ldd_extractor_selection_status"),
  sourceDefinition("ldd_fact_extraction", "LDD Fact Extraction", "P243", "lddFactExtractionPath", "law-firm:fact-extraction", "ldd_fact_extraction_status"),
  sourceDefinition("ldd_issue_detection", "LDD Issue Detection", "P244", "lddIssueDetectionPath", "law-firm:issue-detection", "ldd_issue_detection_status"),
  sourceDefinition("ldd_rfi_generator", "LDD RFI Generator", "P245", "lddRfiGeneratorPath", "law-firm:rfi-generator", "ldd_rfi_generator_status"),
  sourceDefinition("ldd_report_draft", "LDD Report Draft", "P246", "lddReportDraftPath", "law-firm:report-draft", "ldd_report_draft_status"),
  sourceDefinition("litigation_brief_draft", "Litigation Brief Draft", "P247", "litigationBriefDraftPath", "law-firm:litigation-brief-draft", "litigation_brief_draft_status"),
  sourceDefinition("meeting_minutes_workflow", "Meeting Minutes Workflow", "P248", "meetingMinutesWorkflowPath", "law-firm:meeting-minutes", "meeting_minutes_workflow_status"),
  sourceDefinition("contract_draft_workflow", "Contract Draft Workflow", "P249", "contractDraftWorkflowPath", "law-firm:contract-draft", "contract_draft_workflow_status"),
  sourceDefinition("provided_material_review", "Provided Material Review Ledger", "P250", "providedMaterialReviewPath", "law-firm:provided-materials-review", "provided_material_review_status"),
  sourceDefinition("legal_approval_matrix", "Legal Approval Matrix", "P251", "legalApprovalMatrixPath", "law-firm:approval-matrix", "legal_approval_matrix_status"),
];

const E2E_PATH_DEFINITIONS = [
  {
    path_id: "ldd_report_representative_workflow",
    path_label: "LDD report representative workflow",
    path_kind: "ldd_report",
    matter_id: "MNA-2026-ALPHA",
    source_ids: [
      "matter_os_profile",
      "matter_document_index",
      "matter_task_board",
      "matter_knowledge_graph",
      "legal_citation_verifier",
      "ldd_vdr_inventory",
      "ldd_document_classification",
      "ldd_extractor_selection",
      "ldd_fact_extraction",
      "ldd_issue_detection",
      "ldd_rfi_generator",
      "ldd_report_draft",
      "provided_material_review",
      "legal_approval_matrix",
    ],
    output_artifact_id: "ldd_report_draft",
  },
  {
    path_id: "litigation_brief_representative_workflow",
    path_label: "Litigation brief representative workflow",
    path_kind: "litigation_brief",
    matter_id: "LIT-2026-BETA",
    source_ids: [
      "matter_os_profile",
      "matter_knowledge_graph",
      "legal_citation_verifier",
      "litigation_brief_draft",
      "legal_approval_matrix",
    ],
    output_artifact_id: "litigation_brief_draft",
  },
  {
    path_id: "contract_review_representative_workflow",
    path_label: "Contract review representative workflow",
    path_kind: "contract_review",
    matter_id: "MNA-2026-ALPHA",
    source_ids: [
      "matter_os_profile",
      "matter_timeline",
      "matter_task_board",
      "meeting_minutes_workflow",
      "contract_draft_workflow",
      "provided_material_review",
      "legal_approval_matrix",
    ],
    output_artifact_id: "contract_draft_workflow",
  },
];

const COVERAGE_GATE_DEFINITIONS = [
  coverageGate("matter", "Matter boundary", ["matter_os_profile", "matter_document_index", "matter_task_board", "matter_knowledge_graph"], "Matter context is scoped by matter_id and read-only."),
  coverageGate("evidence", "Evidence linkage", ["matter_knowledge_graph", "ldd_fact_extraction", "litigation_brief_draft", "provided_material_review"], "Representative workflows keep evidence/source links available for review."),
  coverageGate("citation", "Citation gate", ["legal_citation_verifier", "ldd_report_draft", "litigation_brief_draft"], "Legal authority/citation placeholders remain attorney-currentness gated."),
  coverageGate("approval", "Approval matrix", ["legal_approval_matrix"], "Attorney review and partner approval requirements are enforced before legal or client-facing use."),
];

export async function runLawFirmE2eFreeze(options = {}) {
  const result = await buildLawFirmE2eFreeze(options);
  if (options.write !== false) await writeLawFirmE2eFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Law firm E2E freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLawFirmE2eFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAW_FIRM_E2E_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const sourceReads = {};
  for (const definition of SOURCE_DEFINITIONS) {
    sourceReads[definition.source_id] = await readJsonOrError(inputs[definition.input_key]);
  }
  const artifacts = Object.fromEntries(SOURCE_DEFINITIONS.map((definition) => [
    definition.source_id,
    sourceReads[definition.source_id].value ?? {},
  ]));
  const freezeSources = buildFreezeSources({ artifacts, sourceReads, generatedAt });
  const sourceById = new Map(freezeSources.map((source) => [source.source_id, source]));
  const e2ePaths = buildE2ePaths({ artifacts, sourceById, generatedAt });
  const coverageGates = buildCoverageGates({ sourceById, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    controlPlaneLoopText: controlPlaneLoopText.value,
    reviewDashboardText: reviewDashboardText.value,
    reviewApiText: reviewApiText.value,
    readErrors: {
      packageJson: packageJson.error,
      roadmapText: roadmapText.error,
      controlPlaneLoopText: controlPlaneLoopText.error,
      reviewDashboardText: reviewDashboardText.error,
      reviewApiText: reviewApiText.error,
      sourceErrors: Object.values(sourceReads).filter((source) => source.error).map((source) => source.error),
    },
    artifacts,
    freezeSources,
    e2ePaths,
    coverageGates,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLawFirmE2eFreeze({
    artifacts,
    freezeSources,
    e2ePaths,
    coverageGates,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    law_firm_e2e_freeze_id: `law-firm-e2e-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    law_firm_e2e_freeze_status: summary.law_firm_e2e_freeze_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads }),
    law_firm_e2e_freeze_contract: buildContract(generatedAt),
    law_firm_e2e_freeze_sources: freezeSources,
    law_firm_e2e_paths: e2ePaths,
    law_firm_e2e_coverage_gates: coverageGates,
    law_firm_e2e_freeze_desktop_boundary: desktopBoundary,
    law_firm_e2e_freeze_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderSummaryMarkdown(result),
  };
}

export async function writeLawFirmE2eFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLawFirmE2eFreeze(result);
  await writeJson(path.join(outDir, "law-firm-e2e-freeze.json"), serializable);
  await writeJson(path.join(outDir, "law-firm-e2e-freeze-sources.json"), {
    schema_version: "law-firm-e2e-freeze-sources-artifact.v1",
    generated_at: result.generated_at,
    source_count: result.law_firm_e2e_freeze_sources.length,
    law_firm_e2e_freeze_sources: result.law_firm_e2e_freeze_sources,
  });
  await writeJson(path.join(outDir, "law-firm-e2e-paths.json"), {
    schema_version: "law-firm-e2e-paths-artifact.v1",
    generated_at: result.generated_at,
    path_count: result.law_firm_e2e_paths.length,
    law_firm_e2e_paths: result.law_firm_e2e_paths,
  });
  await writeJson(path.join(outDir, "law-firm-e2e-coverage-gates.json"), {
    schema_version: "law-firm-e2e-coverage-gates-artifact.v1",
    generated_at: result.generated_at,
    coverage_gate_count: result.law_firm_e2e_coverage_gates.length,
    law_firm_e2e_coverage_gates: result.law_firm_e2e_coverage_gates,
  });
  await writeJson(path.join(outDir, "law-firm-e2e-freeze-checkpoints.json"), {
    schema_version: "law-firm-e2e-freeze-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.law_firm_e2e_freeze_checkpoints.length,
    law_firm_e2e_freeze_checkpoints: result.law_firm_e2e_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "law-firm-e2e-freeze-boundary.json"), {
    schema_version: "law-firm-e2e-freeze-boundary-artifact.v1",
    generated_at: result.generated_at,
    law_firm_e2e_freeze_desktop_boundary: result.law_firm_e2e_freeze_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "law-firm-e2e-freeze-validation-report.v1",
    generated_at: result.generated_at,
    law_firm_e2e_freeze_id: result.law_firm_e2e_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLawFirmE2eFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runLawFirmE2eFreeze(args);
    console.log(`Law firm E2E freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.law_firm_e2e_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
    console.log(`Paths: ${result.summary.passed_path_count}/${result.summary.path_count}`);
    console.log(`Coverage gates: ${result.summary.passed_coverage_gate_count}/${result.summary.coverage_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function sourceDefinition(sourceId, label, phaseSlot, optionKey, packageScript, statusKey) {
  return {
    source_id: sourceId,
    label,
    phase_slot: phaseSlot,
    option_key: optionKey,
    input_key: camelToSnake(optionKey),
    package_script_name: packageScript,
    status_key: statusKey,
  };
}

function coverageGate(gateType, label, sourceIds, rule) {
  return { gate_type: gateType, label, source_ids: sourceIds, rule };
}

function buildContract(generatedAt) {
  return {
    schema_version: "law-firm-e2e-freeze-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P231-P252",
    source_phase_range: "P231-P251",
    next_phase_slot: "P253",
    freeze_rule: "representative law-firm matter evidence citation and approval paths are complete as read-only phase artifacts",
    human_review_rule: "legal advice filing finalization approval decisions and client-facing outputs remain human-gated",
    desktop_companion_rule: "desktop reads freeze sources paths coverage gates and validation only",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    law_firm_e2e_freeze_generated: true,
    deterministic_freeze_performed: true,
    human_review_required: true,
    attorney_review_required: true,
    partner_approval_required_before_client_use: true,
    legal_advice_provided: false,
    legal_conclusion_asserted: false,
    client_facing_output_generated: false,
    approval_decision_recorded: false,
    attorney_approval_recorded: false,
    partner_approval_recorded: false,
    final_review_decision_recorded: false,
    filing_decision_recorded: false,
    matter_data_write_performed: false,
    task_state_write_performed: false,
    workflow_transition_performed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    source_artifact_mutation_performed: false,
    desktop_mutation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildFreezeSources({ artifacts, sourceReads, generatedAt }) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const artifact = artifacts[definition.source_id] ?? {};
    const summary = artifact.summary ?? {};
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const read = sourceReads[definition.source_id];
    const sourceStatus = !read?.error && summary[definition.status_key] === "complete" && validationErrorCount === 0 ? "complete" : "attention";
    return {
      schema_version: "law-firm-e2e-freeze-source.v1",
      source_id: definition.source_id,
      source_label: definition.label,
      phase_slot: definition.phase_slot,
      source_sequence: index + 1,
      package_script_name: definition.package_script_name,
      source_status: sourceStatus,
      source_phase_status: summary[definition.status_key] ?? "unknown",
      schema_version_seen: artifact.schema_version ?? null,
      validation_error_count: validationErrorCount,
      matter_id: deriveMatterId(artifact, summary),
      desktop_read_only: summary.desktop_read_only ?? true,
      desktop_source_of_truth: summary.desktop_source_of_truth ?? false,
      legal_advice_provided: summary.legal_advice_provided ?? false,
      legal_conclusion_asserted_count: summary.legal_conclusion_asserted_count ?? 0,
      client_facing_output_generated: summary.client_facing_output_generated ?? false,
      approval_decision_recorded_count: summary.approval_decision_recorded_count ?? summary.final_review_decision_count ?? 0,
      source_ref_count: 1,
      source_refs: [definition.source_id],
      generated_at: generatedAt,
    };
  });
}

function buildE2ePaths({ artifacts, sourceById, generatedAt }) {
  const approvalSummary = artifacts.legal_approval_matrix?.summary ?? {};
  return E2E_PATH_DEFINITIONS.map((definition, index) => {
    const sourceRows = definition.source_ids.map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
    const allSourcesComplete = sourceRows.length === definition.source_ids.length && sourceRows.every((source) => source.source_status === "complete");
    const outputApproval = findApprovalOutput(artifacts.legal_approval_matrix, definition.output_artifact_id);
    const citationGatePassed = definition.path_kind === "contract_review"
      ? artifacts.legal_approval_matrix?.summary?.legal_approval_matrix_status === "complete"
      : sourceById.get("legal_citation_verifier")?.source_status === "complete";
    const approvalGatePassed = approvalSummary.legal_approval_matrix_status === "complete"
      && outputApproval?.attorney_review_required === true
      && outputApproval?.partner_approval_required_before_client_use === true
      && outputApproval?.client_use_blocked_until_approval === true
      && outputApproval?.approval_decision_recorded === false;
    const matterGatePassed = sourceById.get("matter_os_profile")?.source_status === "complete" && Boolean(definition.matter_id);
    const evidenceGatePassed = sourceRows.some((source) => ["matter_knowledge_graph", "ldd_fact_extraction", "litigation_brief_draft", "provided_material_review"].includes(source.source_id)) && allSourcesComplete;
    const pathStatus = allSourcesComplete && matterGatePassed && evidenceGatePassed && citationGatePassed && approvalGatePassed ? "passed" : "attention";
    return {
      schema_version: "law-firm-e2e-path.v1",
      law_firm_e2e_path_id: `law-firm-e2e-path.${definition.path_id}`,
      path_sequence: index + 1,
      path_kind: definition.path_kind,
      path_label: definition.path_label,
      path_status: pathStatus,
      matter_id: definition.matter_id,
      source_ids: definition.source_ids,
      output_artifact_id: definition.output_artifact_id,
      source_ref_count: definition.source_ids.length,
      matter_gate_passed: matterGatePassed,
      evidence_gate_passed: evidenceGatePassed,
      citation_gate_passed: citationGatePassed,
      approval_gate_passed: approvalGatePassed,
      attorney_review_required: outputApproval?.attorney_review_required === true,
      human_review_required: outputApproval?.human_review_required === true,
      partner_approval_required_before_client_use: outputApproval?.partner_approval_required_before_client_use === true,
      client_use_blocked_until_approval: outputApproval?.client_use_blocked_until_approval === true,
      finalization_blocked_until_approval: outputApproval?.finalization_blocked_until_approval === true,
      delivery_blocked_until_approval: outputApproval?.delivery_blocked_until_approval === true,
      filing_blocked_until_approval: outputApproval?.filing_blocked_until_approval === true,
      approval_decision_recorded: false,
      legal_advice_provided: false,
      legal_conclusion_asserted: false,
      client_facing_output_generated: false,
      matter_data_write_performed: false,
      task_state_write_performed: false,
      workflow_transition_performed: false,
      runtime_execution_performed: false,
      delivery_execution_performed: false,
      protected_mutation_performed: false,
      metrics: buildPathMetrics(definition.path_kind, artifacts),
      generated_at: generatedAt,
    };
  });
}

function buildCoverageGates({ sourceById, generatedAt }) {
  return COVERAGE_GATE_DEFINITIONS.map((definition, index) => {
    const sourceRows = definition.source_ids.map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
    const gateStatus = sourceRows.length === definition.source_ids.length && sourceRows.every((source) => source.source_status === "complete") ? "passed" : "attention";
    return {
      schema_version: "law-firm-e2e-coverage-gate.v1",
      law_firm_e2e_coverage_gate_id: `law-firm-e2e-coverage.${definition.gate_type}`,
      gate_sequence: index + 1,
      gate_type: definition.gate_type,
      gate_label: definition.label,
      gate_status: gateStatus,
      source_ids: definition.source_ids,
      source_ref_count: definition.source_ids.length,
      rule: definition.rule,
      read_only: true,
      mutation_allowed: false,
      human_review_required: true,
      generated_at: generatedAt,
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "law-firm-e2e-freeze-desktop-boundary.v1",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    approval_decision_write_allowed: false,
    legal_advice_allowed: false,
    legal_conclusion_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    partner_approval_bypass_allowed: false,
    source_of_truth: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, readErrors, artifacts, freezeSources, e2ePaths, coverageGates, desktopBoundary }) {
  const approvalSummary = artifacts.legal_approval_matrix?.summary ?? {};
  const checkpoints = [];
  checkpoints.push(checkpoint("sources_complete", freezeSources.every((source) => source.source_status === "complete"), `${freezeSources.filter((source) => source.source_status === "complete").length}/${freezeSources.length} law-firm source artifacts are complete.`));
  checkpoints.push(checkpoint("representative_paths_passed", e2ePaths.every((pathRow) => pathRow.path_status === "passed"), `${e2ePaths.filter((pathRow) => pathRow.path_status === "passed").length}/${e2ePaths.length} representative law-firm E2E paths pass.`));
  checkpoints.push(checkpoint("coverage_gates_passed", coverageGates.every((gate) => gate.gate_status === "passed"), `${coverageGates.filter((gate) => gate.gate_status === "passed").length}/${coverageGates.length} matter/evidence/citation/approval coverage gates pass.`));
  checkpoints.push(checkpoint("approval_requirements_enforced", approvalSummary.legal_approval_matrix_status === "complete"
    && approvalSummary.legal_approval_output_count === 6
    && approvalSummary.legal_approval_requirement_count === 12
    && approvalSummary.legal_approval_gate_link_count === 6
    && approvalSummary.approval_decision_recorded_count === 0
    && approvalSummary.attorney_approval_recorded_count === 0
    && approvalSummary.partner_approval_recorded_count === 0, "Legal Approval Matrix keeps attorney and partner requirements pending without recording decisions."));
  checkpoints.push(checkpoint("no_legal_or_client_output", freezeSources.every((source) => source.legal_advice_provided === false && source.client_facing_output_generated === false && source.legal_conclusion_asserted_count === 0)
    && e2ePaths.every((pathRow) => pathRow.legal_advice_provided === false && pathRow.legal_conclusion_asserted === false && pathRow.client_facing_output_generated === false), "No freeze source or path provides legal advice, legal conclusions, or client-facing output."));
  checkpoints.push(checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.source_of_truth === false && desktopBoundary.mutation_allowed === false, "Desktop boundary is read-only and not source of truth."));
  checkpoints.push(checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["law-firm:e2e-freeze"]), "package.json registers law-firm:e2e-freeze."));
  checkpoints.push(checkpoint("roadmap_slot_present", typeof roadmapText === "string" && roadmapText.includes("P252") && roadmapText.includes("Law Firm E2E freeze"), "Roadmap ledger keeps the P252 Law Firm E2E freeze slot."));
  checkpoints.push(checkpoint("control_plane_loop_registered", typeof controlPlaneLoopText === "string" && controlPlaneLoopText.includes("law_firm_e2e_freeze") && controlPlaneLoopText.includes("law-firm:e2e-freeze"), "Control Plane Loop declares the law_firm_e2e_freeze step."));
  checkpoints.push(checkpoint("dashboard_registered", typeof reviewDashboardText === "string" && reviewDashboardText.includes("lawFirmE2eFreezePath") && reviewDashboardText.includes("law_firm_e2e_freeze"), "Review Dashboard declares the law_firm_e2e_freeze source and stage."));
  checkpoints.push(checkpoint("review_api_registered", typeof reviewApiText === "string" && reviewApiText.includes("/api/law-firm-e2e-freezes") && reviewApiText.includes("law_firm_e2e_freeze"), "Review API exposes Law Firm E2E freeze routes."));
  checkpoints.push(checkpoint("read_errors_absent", !readErrors.packageJson && !readErrors.roadmapText && !readErrors.controlPlaneLoopText && !readErrors.reviewDashboardText && !readErrors.reviewApiText && readErrors.sourceErrors.length === 0, "All source contracts were readable."));
  return checkpoints;
}

function summarizeLawFirmE2eFreeze({ artifacts, freezeSources, e2ePaths, coverageGates, desktopBoundary, checkpoints, validation }) {
  const approvalSummary = artifacts.legal_approval_matrix?.summary ?? {};
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const passedSourceCount = freezeSources.filter((source) => source.source_status === "complete").length;
  const passedPathCount = e2ePaths.filter((pathRow) => pathRow.path_status === "passed").length;
  const passedCoverageGateCount = coverageGates.filter((gate) => gate.gate_status === "passed").length;
  return {
    law_firm_e2e_freeze_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    law_firm_e2e_freeze_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P231-P252",
    source_phase_range: "P231-P251",
    next_phase_slot: "P253",
    source_count: freezeSources.length,
    passed_source_count: passedSourceCount,
    path_count: e2ePaths.length,
    passed_path_count: passedPathCount,
    coverage_gate_count: coverageGates.length,
    passed_coverage_gate_count: passedCoverageGateCount,
    representative_matter_gate_passed_count: e2ePaths.filter((pathRow) => pathRow.matter_gate_passed).length,
    representative_evidence_gate_passed_count: e2ePaths.filter((pathRow) => pathRow.evidence_gate_passed).length,
    representative_citation_gate_passed_count: e2ePaths.filter((pathRow) => pathRow.citation_gate_passed).length,
    representative_approval_gate_passed_count: e2ePaths.filter((pathRow) => pathRow.approval_gate_passed).length,
    matter_count: uniqueCount(e2ePaths.map((pathRow) => pathRow.matter_id)),
    approval_output_count: approvalSummary.legal_approval_output_count ?? 0,
    approval_requirement_count: approvalSummary.legal_approval_requirement_count ?? 0,
    approval_gate_link_count: approvalSummary.legal_approval_gate_link_count ?? 0,
    attorney_review_requirement_count: approvalSummary.attorney_review_requirement_count ?? 0,
    partner_approval_requirement_count: approvalSummary.partner_approval_requirement_count ?? 0,
    ldd_report_section_count: artifacts.ldd_report_draft?.summary?.section_count ?? 0,
    ldd_report_paragraph_count: artifacts.ldd_report_draft?.summary?.paragraph_count ?? 0,
    litigation_brief_claim_count: artifacts.litigation_brief_draft?.summary?.claim_count ?? 0,
    litigation_brief_evidence_link_count: artifacts.litigation_brief_draft?.summary?.evidence_link_count ?? 0,
    contract_clause_draft_count: artifacts.contract_draft_workflow?.summary?.clause_draft_count ?? 0,
    provided_material_review_item_count: artifacts.provided_material_review?.summary?.material_review_item_count ?? 0,
    approval_decision_recorded_count: approvalSummary.approval_decision_recorded_count ?? 0,
    attorney_approval_recorded_count: approvalSummary.attorney_approval_recorded_count ?? 0,
    partner_approval_recorded_count: approvalSummary.partner_approval_recorded_count ?? 0,
    final_review_decision_recorded_count: 0,
    legal_advice_provided: false,
    legal_conclusion_asserted_count: 0,
    client_facing_output_generated: false,
    matter_data_write_performed: false,
    task_state_write_performed: false,
    workflow_transition_performed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    source_artifact_mutation_performed: false,
    desktop_read_only: desktopBoundary.read_only,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildPathMetrics(pathKind, artifacts) {
  if (pathKind === "ldd_report") {
    return {
      ldd_vdr_file_record_count: artifacts.ldd_vdr_inventory?.summary?.file_record_count ?? 0,
      ldd_fact_record_count: artifacts.ldd_fact_extraction?.summary?.fact_record_count ?? 0,
      ldd_issue_count: artifacts.ldd_issue_detection?.summary?.issue_count ?? 0,
      rfi_question_count: artifacts.ldd_rfi_generator?.summary?.rfi_question_count ?? 0,
      report_paragraph_count: artifacts.ldd_report_draft?.summary?.paragraph_count ?? 0,
    };
  }
  if (pathKind === "litigation_brief") {
    return {
      brief_claim_count: artifacts.litigation_brief_draft?.summary?.claim_count ?? 0,
      brief_fact_count: artifacts.litigation_brief_draft?.summary?.fact_count ?? 0,
      brief_evidence_link_count: artifacts.litigation_brief_draft?.summary?.evidence_link_count ?? 0,
      citation_gate_count: artifacts.litigation_brief_draft?.summary?.citation_gate_count ?? 0,
    };
  }
  return {
    meeting_action_item_count: artifacts.meeting_minutes_workflow?.summary?.action_item_count ?? 0,
    contract_clause_draft_count: artifacts.contract_draft_workflow?.summary?.clause_draft_count ?? 0,
    provided_material_review_item_count: artifacts.provided_material_review?.summary?.material_review_item_count ?? 0,
  };
}

function findApprovalOutput(artifact, sourceArtifactId) {
  return (artifact?.legal_approval_output_rows ?? []).find((row) => row.source_artifact_id === sourceArtifactId);
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "law-firm-e2e-freeze-checkpoint.v1",
    checkpoint_id: `law-firm-e2e-freeze.${checkpointId}`,
    checkpoint_type: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.checkpoint_id,
    message: item.message,
    status: item.status,
  }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads }) {
  return {
    package_json: contractRef("package.json", packageJson),
    roadmap: textContractRef("docs/final-completion-phase-ledger.md", roadmapText),
    control_plane_loop: textContractRef("src/control-plane-loop.mjs", controlPlaneLoopText),
    review_dashboard: textContractRef("src/review-dashboard.mjs", reviewDashboardText),
    review_api: textContractRef("src/review-api.mjs", reviewApiText),
    source_artifacts: Object.fromEntries(Object.entries(sourceReads).map(([sourceId, read]) => [
      sourceId,
      contractRef(sourceId, read),
    ])),
  };
}

function contractRef(label, read) {
  const value = read?.value;
  return {
    label,
    read_status: read?.error ? "error" : "read",
    content_hash: read?.raw ? `sha256:${sha256(read.raw)}` : null,
    schema_version: value?.schema_version ?? null,
    error: read?.error ?? null,
  };
}

function textContractRef(label, read) {
  return {
    label,
    read_status: read?.error ? "error" : "read",
    content_hash: read?.value ? `sha256:${sha256(read.value)}` : null,
    error: read?.error ?? null,
  };
}

function serializableLawFirmE2eFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Law Firm E2E Freeze");
  lines.push("");
  lines.push(`Status: ${result.summary.law_firm_e2e_freeze_status}`);
  lines.push(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
  lines.push(`Representative paths: ${result.summary.passed_path_count}/${result.summary.path_count}`);
  lines.push(`Coverage gates: ${result.summary.passed_coverage_gate_count}/${result.summary.coverage_gate_count}`);
  lines.push(`Approval requirements: ${result.summary.approval_requirement_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("This freeze is read-only. It records no approval decision, legal advice, legal conclusion, filing decision, delivery action, or client-facing output.");
  return lines.join("\n");
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_LAW_FIRM_E2E_FREEZE_INPUTS, ...options };
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [camelToSnake(key), value]));
}

function camelToSnake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      value: JSON.parse(raw),
      raw,
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      raw: null,
      error: `${filePath}: ${error.message}`,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      error: `${filePath}: ${error.message}`,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function deriveMatterId(artifact, summary) {
  if (summary.source_matter_id) return summary.source_matter_id;
  if (summary.matter_id) return summary.matter_id;
  if (artifact?.matter_id) return artifact.matter_id;
  const firstMatterSummary = Object.entries(artifact ?? {}).find(([key, value]) => key.endsWith("matter_summaries") && Array.isArray(value))?.[1]?.[0];
  if (firstMatterSummary?.matter_id) return firstMatterSummary.matter_id;
  return "multi_matter";
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg.startsWith("--")) {
      const optionName = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[optionName] = argv[++index];
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/law-firm-e2e-freeze.mjs [--check] [--out-dir DIR]\n\nBuilds the Phase 252 Law Firm E2E freeze report.`);
}
