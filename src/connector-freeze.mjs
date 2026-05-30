import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONNECTOR_FREEZE_OUT_DIR = "artifacts/connector-freeze/latest";
export const DEFAULT_CONNECTOR_FREEZE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  localFolderConnectorPath: "artifacts/local-folder-connector/latest/local-folder-connector.json",
  onedriveConnectorBoundaryPath: "artifacts/onedrive-connector-boundary/latest/onedrive-connector-boundary.json",
  outlookEmailConnectorPath: "artifacts/outlook-email-connector/latest/outlook-email-connector.json",
  kakaotalkImportBoundaryPath: "artifacts/kakaotalk-import-boundary/latest/kakaotalk-import-boundary.json",
  githubConnectorPath: "artifacts/github-connector/latest/github-connector.json",
  vdrConnectorPath: "artifacts/vdr-connector/latest/vdr-connector.json",
  plaudTranscriptConnectorPath: "artifacts/plaud-transcript-connector/latest/plaud-transcript-connector.json",
  erpDraftConnectorPath: "artifacts/erp-draft-connector/latest/erp-draft-connector.json",
};

const CONTRACT_ID = "connector-freeze.v1";
const PACK_ID = "connector-ingestion";
const CAPABILITY_ID = "connectors.freeze";
const FREEZE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "connector_phase_artifacts_freeze_report";
const HUMAN_REVIEW_NOTE = "Connector freeze is a read-only operational freeze report. It is not legal advice, not client-facing, and not approved for delivery.";

const SOURCE_DEFINITIONS = [
  sourceDefinition("connector_contract_v2", "Connector Contract v2", "P267", "connectorContractV2Path", "connectors:contract-v2", "connector_contract_status"),
  sourceDefinition("local_folder_connector", "Local Folder Connector", "P268", "localFolderConnectorPath", "connectors:local-folder", "local_folder_connector_status"),
  sourceDefinition("onedrive_connector_boundary", "OneDrive Connector Boundary", "P269", "onedriveConnectorBoundaryPath", "connectors:onedrive-boundary", "onedrive_connector_boundary_status"),
  sourceDefinition("outlook_email_connector", "Outlook Email Connector", "P270", "outlookEmailConnectorPath", "connectors:outlook-email", "outlook_email_connector_status"),
  sourceDefinition("kakaotalk_import_boundary", "KakaoTalk Import Boundary", "P271", "kakaotalkImportBoundaryPath", "connectors:kakaotalk-import-boundary", "kakaotalk_import_boundary_status"),
  sourceDefinition("github_connector", "GitHub Connector", "P272", "githubConnectorPath", "connectors:github", "github_connector_status"),
  sourceDefinition("vdr_connector", "VDR Connector", "P273", "vdrConnectorPath", "connectors:vdr", "vdr_connector_status"),
  sourceDefinition("plaud_transcript_connector", "Plaud Transcript Connector", "P274", "plaudTranscriptConnectorPath", "connectors:plaud-transcript", "plaud_transcript_connector_status"),
  sourceDefinition("erp_draft_connector", "ERP Draft Connector", "P275", "erpDraftConnectorPath", "connectors:erp-draft", "erp_draft_connector_status"),
];

const CONNECTOR_SOURCE_IDS = SOURCE_DEFINITIONS.filter((definition) => definition.source_id !== "connector_contract_v2").map((definition) => definition.source_id);

export async function runConnectorFreeze(options = {}) {
  const result = await buildConnectorFreeze(options);
  if (options.write !== false) await writeConnectorFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Connector freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConnectorFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONNECTOR_FREEZE_OUT_DIR);
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
  const freezeSources = buildFreezeSources({ sourceReads, artifacts, generatedAt });
  const sourceById = new Map(freezeSources.map((source) => [source.source_id, source]));
  const ingestPaths = buildIngestPaths({ artifacts, sourceById, generatedAt });
  const freezeBoundary = buildFreezeBoundary(generatedAt);
  const freezeGates = buildFreezeGates({ artifacts, freezeSources, ingestPaths, freezeBoundary, packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, generatedAt });
  const checkpoints = buildCheckpoints({ artifacts, freezeSources, ingestPaths, freezeGates, freezeBoundary, packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeConnectorFreeze({ artifacts, freezeSources, ingestPaths, freezeGates, freezeBoundary, validation });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    connector_freeze_id: `connector-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    connector_freeze_status: summary.connector_freeze_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads }),
    connector_freeze_contract: buildContract(generatedAt),
    connector_freeze_sources: freezeSources,
    connector_freeze_ingest_paths: ingestPaths,
    connector_freeze_gates: freezeGates,
    connector_freeze_boundary: freezeBoundary,
    connector_freeze_checkpoints: checkpoints,
    freeze_note: buildFreezeNote({ generatedAt, summary, ingestPaths, freezeGates }),
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
    freeze_note_markdown: renderFreezeNoteMarkdown(result),
  };
}

export async function writeConnectorFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "connector-freeze.json"), serializableConnectorFreeze(result));
  await writeJson(path.join(outDir, "connector-freeze-sources.json"), {
    schema_version: "connector-freeze-sources-artifact.v1",
    generated_at: result.generated_at,
    source_count: result.connector_freeze_sources.length,
    connector_freeze_sources: result.connector_freeze_sources,
  });
  await writeJson(path.join(outDir, "connector-freeze-ingest-paths.json"), {
    schema_version: "connector-freeze-ingest-paths-artifact.v1",
    generated_at: result.generated_at,
    ingest_path_count: result.connector_freeze_ingest_paths.length,
    connector_freeze_ingest_paths: result.connector_freeze_ingest_paths,
  });
  await writeJson(path.join(outDir, "connector-freeze-gates.json"), {
    schema_version: "connector-freeze-gates-artifact.v1",
    generated_at: result.generated_at,
    gate_count: result.connector_freeze_gates.length,
    connector_freeze_gates: result.connector_freeze_gates,
  });
  await writeJson(path.join(outDir, "connector-freeze-boundary.json"), {
    schema_version: "connector-freeze-boundary-artifact.v1",
    generated_at: result.generated_at,
    connector_freeze_boundary: result.connector_freeze_boundary,
  });
  await writeJson(path.join(outDir, "connector-freeze-checkpoints.json"), {
    schema_version: "connector-freeze-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.connector_freeze_checkpoints.length,
    connector_freeze_checkpoints: result.connector_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "freeze-note.json"), result.freeze_note);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "connector-freeze-validation-report.v1",
    generated_at: result.generated_at,
    connector_freeze_id: result.connector_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "freeze-note.md"), result.freeze_note_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runConnectorFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConnectorFreeze(args);
    console.log(`Connector freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.connector_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
    console.log(`Representative ingest paths: ${result.summary.passed_representative_source_ingest_path_count}/${result.summary.representative_source_ingest_path_count}`);
    console.log(`Gates: ${result.summary.passed_gate_count}/${result.summary.gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFreezeSources({ sourceReads, artifacts, generatedAt }) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const read = sourceReads[definition.source_id] ?? {};
    const artifact = artifacts[definition.source_id] ?? {};
    const summary = artifact.summary ?? {};
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const failedCheckpointCount = summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? summary.failed_validation_count ?? 0;
    const sourceStatus = !read.error
      && summary[definition.status_key] === "complete"
      && artifact.validation?.valid !== false
      && validationErrorCount === 0
      && failedCheckpointCount === 0
      ? "complete"
      : "attention";
    return {
      schema_version: "connector-freeze-source.v1",
      source_id: definition.source_id,
      source_label: definition.label,
      phase_slot: definition.phase_slot,
      source_command: definition.command,
      source_path: definition.path,
      source_status: sourceStatus,
      expected_status_key: definition.status_key,
      observed_status: summary[definition.status_key] ?? "unknown",
      connector_id: summary.connector_id ?? artifact.connector_id ?? null,
      source_connector_id: summary.connector_id ?? artifact.connector_id ?? null,
      source_system_id: summary.source_id ?? artifact.source_binding?.source_id ?? artifact.connector_contract_binding?.source_id ?? null,
      cursor_status: summary.cursor_status ?? artifact.cursor_state?.cursor_status ?? artifact.cursor_boundary?.cursor_boundary_status ?? null,
      cursor_resume_supported: summary.cursor_resume_supported ?? artifact.cursor_state?.resume_supported ?? artifact.cursor_boundary?.resume_supported ?? null,
      credential_reference_only: summary.credential_reference_only ?? null,
      credential_material_read: summary.credential_material_read ?? false,
      raw_secret_material_allowed: summary.raw_secret_material_allowed ?? false,
      external_network_access_performed: summary.external_network_access_performed ?? false,
      write_operations_allowed: summary.write_operations_allowed ?? false,
      source_mutation_performed: summary.source_mutation_performed ?? false,
      resource_mutation_performed: summary.resource_mutation_performed ?? false,
      output_delivery_performed: summary.output_delivery_performed ?? false,
      protected_action_executed: summary.protected_action_executed ?? false,
      legal_advice_generated: summary.legal_advice_generated ?? false,
      client_facing_output_generated: summary.client_facing_output_generated ?? false,
      resource_candidate_count: summary.resource_candidate_count ?? summary.ingest_ready_count ?? summary.sample_item_count ?? summary.draft_count ?? 0,
      validation_valid: artifact.validation?.valid !== false,
      validation_error_count: validationErrorCount,
      failed_checkpoint_count: failedCheckpointCount,
      human_review_required: Boolean(summary.human_review_required ?? summary.human_review_required_count ?? summary.approval_hold_human_review_required_count ?? false),
      client_facing_ready: Boolean(summary.client_facing_ready ?? false),
      source_contract_hash: read.value ? `sha256:${hashJson(read.value)}` : null,
      generated_at: generatedAt,
    };
  });
}

function buildIngestPaths({ artifacts, sourceById, generatedAt }) {
  const sourcePass = (sourceId) => sourceById.get(sourceId)?.source_status === "complete";
  const contract = artifacts.connector_contract_v2?.summary ?? {};
  const local = artifacts.local_folder_connector?.summary ?? {};
  const oneDrive = artifacts.onedrive_connector_boundary?.summary ?? {};
  const outlook = artifacts.outlook_email_connector?.summary ?? {};
  const kakao = artifacts.kakaotalk_import_boundary?.summary ?? {};
  const github = artifacts.github_connector?.summary ?? {};
  const vdr = artifacts.vdr_connector?.summary ?? {};
  const plaud = artifacts.plaud_transcript_connector?.summary ?? {};
  const erp = artifacts.erp_draft_connector?.summary ?? {};
  const pathRecords = [
    ingestPath("connector_contract_fixture", "Connector contract fixture coverage", "contract", ["connector_contract_v2"], contract.connector_contract_status === "complete" && contract.connector_count === 8 && contract.contracted_connector_count === 8 && contract.source_contract_count === 8 && contract.cursor_contract_count === 8 && contract.external_id_contract_count === 8 && contract.auth_boundary_count === 8, contract.connector_count ?? 0),
    ingestPath("local_file_ingest", "Local folder source ingest", "local_file", ["local_folder_connector"], local.local_folder_connector_status === "complete" && local.discovered_file_count > 0 && local.ingest_record_count > 0 && local.ingest_ready_count > 0 && local.external_network_access_performed === false, local.ingest_record_count ?? 0),
    ingestPath("cloud_file_boundary", "OneDrive cloud placeholder boundary", "cloud_file", ["onedrive_connector_boundary"], oneDrive.onedrive_connector_boundary_status === "complete" && oneDrive.sample_item_count > 0 && oneDrive.materialization_deferred_count === oneDrive.sample_item_count && oneDrive.external_network_access_performed === false, oneDrive.sample_item_count ?? 0),
    ingestPath("communication_export_ingest", "Outlook and KakaoTalk export ingest", "communication", ["outlook_email_connector", "kakaotalk_import_boundary"], outlook.outlook_email_connector_status === "complete" && kakao.kakaotalk_import_boundary_status === "complete" && outlook.resource_candidate_count > 0 && kakao.resource_candidate_count > 0 && outlook.external_network_access_performed === false && kakao.external_network_access_performed === false, (outlook.resource_candidate_count ?? 0) + (kakao.resource_candidate_count ?? 0)),
    ingestPath("repository_vdr_ingest", "GitHub and VDR resource ingest", "repository_vdr", ["github_connector", "vdr_connector"], github.github_connector_status === "complete" && vdr.vdr_connector_status === "complete" && github.resource_candidate_count > 0 && vdr.resource_candidate_count > 0 && vdr.permission_boundary_link_count === vdr.document_count && vdr.resource_expansion_seed_link_count === vdr.resource_expansion_seed_count, (github.resource_candidate_count ?? 0) + (vdr.resource_candidate_count ?? 0)),
    ingestPath("transcript_normalized_text_ingest", "Plaud transcript normalized text ingest", "transcript", ["plaud_transcript_connector"], plaud.plaud_transcript_connector_status === "complete" && plaud.segment_count > 0 && plaud.normalized_text_record_count === plaud.segment_count && plaud.timestamp_span_count === plaud.segment_count && plaud.audio_download_performed === false, plaud.resource_candidate_count ?? 0),
    ingestPath("erp_draft_output_hold", "ERP draft output and approval hold", "erp_draft", ["erp_draft_connector"], erp.erp_draft_connector_status === "complete" && erp.draft_count >= 3 && erp.draft_output_count === erp.draft_count && erp.approval_hold_count === erp.draft_count && erp.ready_to_issue_count === 0 && erp.final_output_allowed_count === 0, erp.draft_count ?? 0),
  ];
  return pathRecords.map((record) => {
    const sourcesComplete = record.source_ids.every(sourcePass);
    const pathStatus = sourcesComplete && record.path_gate_passed ? "passed" : "attention";
    return {
      schema_version: "connector-freeze-ingest-path.v1",
      ...record,
      sources_complete: sourcesComplete,
      path_status: pathStatus,
      human_review_required: true,
      client_facing_ready: false,
      human_review_note: HUMAN_REVIEW_NOTE,
      generated_at: generatedAt,
    };
  });
}

function buildFreezeGates({ artifacts, freezeSources, ingestPaths, freezeBoundary, packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, generatedAt }) {
  const contract = artifacts.connector_contract_v2?.summary ?? {};
  const connectorSummaries = CONNECTOR_SOURCE_IDS.map((sourceId) => artifacts[sourceId]?.summary ?? {});
  const gateRecords = [
    gateRecord("contract_coverage", "Connector contract coverage", contract.connector_contract_status === "complete" && contract.connector_count === 8 && contract.contracted_connector_count === 8 && contract.read_only_connector_count === 8 && contract.mutation_allowed_count === 0, "Connector Contract v2 covers all 8 P268-P275 connector families with read-only/no-mutation contracts."),
    gateRecord("source_integrity", "Connector source integrity", freezeSources.every((source) => source.source_status === "complete"), `${freezeSources.filter((source) => source.source_status === "complete").length}/${freezeSources.length} connector source artifact(s) are complete.`),
    gateRecord("representative_ingest", "Representative source ingest", ingestPaths.every((item) => item.path_status === "passed"), `${ingestPaths.filter((item) => item.path_status === "passed").length}/${ingestPaths.length} representative connector ingest path(s) passed.`),
    gateRecord("cursor_resumability", "Cursor resumability", connectorSummaries.every((summary) => summary.cursor_resume_supported === true) && rawCursorMaterialAllowedCount(connectorSummaries) === 0, "All connector runtime artifacts expose resumable cursor state without raw cursor material."),
    gateRecord("auth_credential_boundary", "Auth and credential boundary", connectorSummaries.every((summary) => summary.credential_reference_only === true && summary.raw_secret_material_allowed === false && summary.credential_material_read === false), "All connector artifacts remain credential-reference-only and read no raw secret material."),
    gateRecord("mutation_delivery_boundary", "Mutation and delivery boundary", connectorSummaries.every(noMutationDeliveryLegalClient) && freezeBoundary.delivery_execution_performed === false && freezeBoundary.protected_action_executed === false, "Connector artifacts and freeze report perform no source/resource/billing mutation, delivery, protected action, legal advice, or client-facing output."),
    gateRecord("surface_binding", "Dashboard/API/loop binding", hasScript(packageJson.value, "connectors:freeze") && includesAll(controlPlaneLoopText.value, ["connector_freeze", "connectors:freeze"]) && includesAll(reviewDashboardText.value, ["connector_freeze"]) && includesAll(reviewApiText.value, ["/api/connector-freezes"]) && includesAll(roadmapText.value, ["P276", "Connector freeze"]), "Connector freeze is bound into package scripts, control-plane loop, dashboard, API, and roadmap ledger."),
  ];
  return gateRecords.map((record) => ({
    schema_version: "connector-freeze-gate.v1",
    ...record,
    generated_at: generatedAt,
  }));
}

function buildFreezeBoundary(generatedAt) {
  return {
    schema_version: "connector-freeze-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    freeze_report_only: true,
    connector_runtime_execution_performed: false,
    source_ingest_performed: false,
    source_artifact_mutation_allowed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    billing_mutation_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    credential_material_read: false,
    external_network_access_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ artifacts, freezeSources, ingestPaths, freezeGates, freezeBoundary, packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText }) {
  const contract = artifacts.connector_contract_v2?.summary ?? {};
  const connectorSummaries = CONNECTOR_SOURCE_IDS.map((sourceId) => artifacts[sourceId]?.summary ?? {});
  return [
    checkpoint("sources.complete", freezeSources.every((source) => source.source_status === "complete"), `${freezeSources.filter((source) => source.source_status === "complete").length}/${freezeSources.length} connector source artifact(s) are complete.`),
    checkpoint("contract.fixture", contract.connector_contract_status === "complete" && contract.connector_count === 8 && contract.contracted_connector_count === 8, "Connector Contract v2 fixture covers all 8 connector family contracts."),
    checkpoint("paths.passed", ingestPaths.length === 7 && ingestPaths.every((item) => item.path_status === "passed"), `${ingestPaths.filter((item) => item.path_status === "passed").length}/${ingestPaths.length} representative connector path(s) passed.`),
    checkpoint("gates.passed", freezeGates.length >= 7 && freezeGates.every((gate) => gate.gate_status === "passed"), `${freezeGates.filter((gate) => gate.gate_status === "passed").length}/${freezeGates.length} connector freeze gate(s) passed.`),
    checkpoint("cursor.boundary", connectorSummaries.every((summary) => summary.cursor_resume_supported === true) && rawCursorMaterialAllowedCount(connectorSummaries) === 0, "All connectors support resumable hash-only cursor state."),
    checkpoint("auth.boundary", connectorSummaries.every((summary) => summary.credential_reference_only === true && summary.raw_secret_material_allowed === false && summary.credential_material_read === false), "All connectors enforce credential-reference-only auth boundaries."),
    checkpoint("mutation.delivery.boundary", connectorSummaries.every(noMutationDeliveryLegalClient), "Connector source artifacts report no mutation, delivery, protected action, legal advice, or client-facing output."),
    checkpoint("freeze.boundary", freezeBoundary.boundary_status === "enforced" && freezeBoundary.read_only && freezeBoundary.freeze_report_only && freezeBoundary.connector_runtime_execution_performed === false && freezeBoundary.source_ingest_performed === false && freezeBoundary.delivery_execution_performed === false && freezeBoundary.protected_action_executed === false && freezeBoundary.legal_advice_generated === false && freezeBoundary.client_facing_output_generated === false, "Connector freeze report remains read-only, non-executing, non-delivering, and non-client-facing."),
    checkpoint("package.script", hasScript(packageJson.value, "connectors:freeze"), "package.json registers connectors:freeze."),
    checkpoint("roadmap.slot", includesAll(roadmapText.value, ["P276", "Connector freeze"]), "Roadmap ledger keeps the P276 Connector freeze slot."),
    checkpoint("loop.bound", includesAll(controlPlaneLoopText.value, ["connector_freeze", "connectors:freeze"]), "Control-plane loop includes the Connector freeze step."),
    checkpoint("dashboard.bound", includesAll(reviewDashboardText.value, ["connector_freeze"]), "Review Dashboard includes the Connector freeze source and stage."),
    checkpoint("api.bound", includesAll(reviewApiText.value, ["/api/connector-freezes"]), "Review API exposes Connector freeze routes."),
  ];
}

function summarizeConnectorFreeze({ artifacts, freezeSources, ingestPaths, freezeGates, freezeBoundary, validation }) {
  const contract = artifacts.connector_contract_v2?.summary ?? {};
  const local = artifacts.local_folder_connector?.summary ?? {};
  const oneDrive = artifacts.onedrive_connector_boundary?.summary ?? {};
  const outlook = artifacts.outlook_email_connector?.summary ?? {};
  const kakao = artifacts.kakaotalk_import_boundary?.summary ?? {};
  const github = artifacts.github_connector?.summary ?? {};
  const vdr = artifacts.vdr_connector?.summary ?? {};
  const plaud = artifacts.plaud_transcript_connector?.summary ?? {};
  const erp = artifacts.erp_draft_connector?.summary ?? {};
  const connectorSummaries = CONNECTOR_SOURCE_IDS.map((sourceId) => artifacts[sourceId]?.summary ?? {});
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const representativeIngestPaths = ingestPaths.filter((item) => item.path_kind !== "contract");
  return {
    connector_freeze_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    connector_freeze_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P267-P276",
    source_phase_range: "P267-P275",
    next_phase_slot: "P277",
    source_count: freezeSources.length,
    passed_source_count: freezeSources.filter((source) => source.source_status === "complete").length,
    connector_artifact_count: connectorSummaries.length,
    connector_contract_count: contract.connector_count ?? 0,
    contracted_connector_count: contract.contracted_connector_count ?? 0,
    source_contract_count: contract.source_contract_count ?? 0,
    cursor_contract_count: contract.cursor_contract_count ?? 0,
    external_id_contract_count: contract.external_id_contract_count ?? 0,
    auth_boundary_count: contract.auth_boundary_count ?? 0,
    path_count: ingestPaths.length,
    passed_path_count: ingestPaths.filter((item) => item.path_status === "passed").length,
    representative_source_ingest_path_count: representativeIngestPaths.length,
    passed_representative_source_ingest_path_count: representativeIngestPaths.filter((item) => item.path_status === "passed").length,
    gate_count: freezeGates.length,
    passed_gate_count: freezeGates.filter((gate) => gate.gate_status === "passed").length,
    connector_resource_candidate_count: (local.ingest_ready_count ?? 0) + (oneDrive.sample_item_count ?? 0) + (outlook.resource_candidate_count ?? 0) + (kakao.resource_candidate_count ?? 0) + (github.resource_candidate_count ?? 0) + (vdr.resource_candidate_count ?? 0) + (plaud.resource_candidate_count ?? 0) + (erp.resource_candidate_count ?? 0),
    local_ingest_record_count: local.ingest_record_count ?? 0,
    onedrive_sample_item_count: oneDrive.sample_item_count ?? 0,
    communication_resource_candidate_count: (outlook.resource_candidate_count ?? 0) + (kakao.resource_candidate_count ?? 0),
    github_resource_candidate_count: github.resource_candidate_count ?? 0,
    vdr_resource_candidate_count: vdr.resource_candidate_count ?? 0,
    plaud_resource_candidate_count: plaud.resource_candidate_count ?? 0,
    erp_draft_count: erp.draft_count ?? 0,
    erp_draft_output_count: erp.draft_output_count ?? 0,
    erp_approval_hold_count: erp.approval_hold_count ?? 0,
    cursor_resume_supported_count: connectorSummaries.filter((summary) => summary.cursor_resume_supported === true).length,
    raw_cursor_material_allowed_count: rawCursorMaterialAllowedCount(connectorSummaries),
    credential_reference_only_connector_count: connectorSummaries.filter((summary) => summary.credential_reference_only === true).length,
    credential_material_read_count: connectorSummaries.filter((summary) => summary.credential_material_read === true).length,
    raw_secret_material_allowed_count: connectorSummaries.filter((summary) => summary.raw_secret_material_allowed === true).length,
    external_network_access_required_connector_count: connectorSummaries.filter((summary) => summary.external_network_access_required_for_runtime === true).length,
    external_network_access_performed_count: connectorSummaries.filter((summary) => summary.external_network_access_performed === true).length,
    write_operations_allowed_count: connectorSummaries.filter((summary) => summary.write_operations_allowed === true).length,
    source_mutation_performed_count: connectorSummaries.filter((summary) => summary.source_mutation_performed === true).length,
    resource_mutation_performed_count: connectorSummaries.filter((summary) => summary.resource_mutation_performed === true).length,
    billing_mutation_performed_count: connectorSummaries.filter((summary) => summary.billing_mutation_performed === true).length,
    matter_data_write_allowed_count: connectorSummaries.filter((summary) => summary.matter_data_write_allowed === true).length,
    task_state_write_allowed_count: connectorSummaries.filter((summary) => summary.task_state_write_allowed === true).length,
    workflow_transition_allowed_count: connectorSummaries.filter((summary) => summary.workflow_transition_allowed === true).length,
    output_delivery_performed_count: connectorSummaries.filter((summary) => summary.output_delivery_performed === true).length,
    protected_action_executed_count: connectorSummaries.filter((summary) => summary.protected_action_executed === true).length,
    legal_advice_generated_count: connectorSummaries.filter((summary) => summary.legal_advice_generated === true).length,
    client_facing_output_generated_count: connectorSummaries.filter((summary) => summary.client_facing_output_generated === true).length,
    read_only: freezeBoundary.read_only,
    freeze_report_only: freezeBoundary.freeze_report_only,
    connector_runtime_execution_performed: freezeBoundary.connector_runtime_execution_performed,
    source_ingest_performed: freezeBoundary.source_ingest_performed,
    source_artifact_mutation_performed: false,
    source_mutation_performed: freezeBoundary.source_mutation_performed,
    resource_mutation_performed: freezeBoundary.resource_mutation_performed,
    billing_mutation_performed: freezeBoundary.billing_mutation_performed,
    matter_data_write_allowed: freezeBoundary.matter_data_write_allowed,
    task_state_write_allowed: freezeBoundary.task_state_write_allowed,
    workflow_transition_allowed: freezeBoundary.workflow_transition_allowed,
    credential_material_read: freezeBoundary.credential_material_read,
    external_network_access_performed: freezeBoundary.external_network_access_performed,
    delivery_execution_performed: freezeBoundary.delivery_execution_performed,
    protected_action_executed: freezeBoundary.protected_action_executed,
    legal_advice_generated: freezeBoundary.legal_advice_generated,
    client_facing_output_generated: freezeBoundary.client_facing_output_generated,
    client_facing_ready_count: freezeBoundary.client_facing_ready_count,
    human_review_required: freezeBoundary.human_review_required,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    freeze_report_only: true,
    connector_runtime_execution_performed: false,
    source_ingest_performed: false,
    source_artifact_mutation_allowed: false,
    protected_actions_executed: false,
    external_delivery_executed: false,
    external_model_call_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads }) {
  return [
    textContractRef("package.json", packageJson),
    textContractRef("final-completion-phase-ledger", roadmapText),
    textContractRef("control-plane-loop", controlPlaneLoopText),
    textContractRef("review-dashboard", reviewDashboardText),
    textContractRef("review-api", reviewApiText),
    ...SOURCE_DEFINITIONS.map((definition) => contractRef(definition.label, sourceReads[definition.source_id])),
  ];
}

function buildContract(generatedAt) {
  return {
    schema_version: "connector-freeze-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_phase_range: "P267-P275",
    freeze_phase: "P276",
    connector_family_count: 8,
    required_gate_ids: ["contract_coverage", "source_integrity", "representative_ingest", "cursor_resumability", "auth_credential_boundary", "mutation_delivery_boundary", "surface_binding"],
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function buildFreezeNote({ generatedAt, summary, ingestPaths, freezeGates }) {
  return {
    schema_version: "connector-freeze-note.v1",
    generated_at: generatedAt,
    freeze_status: summary.connector_freeze_status,
    freeze_note: HUMAN_REVIEW_NOTE,
    representative_path_ids: ingestPaths.map((item) => item.path_id),
    passed_gate_ids: freezeGates.filter((gate) => gate.gate_status === "passed").map((gate) => gate.gate_id),
    remaining_slot: "P277",
    legal_advice_generated: false,
    client_facing_output_generated: false,
  };
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Connector Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.connector_freeze_status}`);
  lines.push(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
  lines.push(`Representative ingest paths: ${result.summary.passed_representative_source_ingest_path_count}/${result.summary.representative_source_ingest_path_count}`);
  lines.push(`Freeze gates: ${result.summary.passed_gate_count}/${result.summary.gate_count}`);
  lines.push(`Connector resource candidates: ${result.summary.connector_resource_candidate_count}`);
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  lines.push("");
  lines.push("## Representative Paths");
  for (const item of result.connector_freeze_ingest_paths) {
    lines.push(`- ${item.path_id}: ${item.path_status}`);
  }
  lines.push("");
  lines.push("## Gates");
  for (const gate of result.connector_freeze_gates) {
    lines.push(`- ${gate.gate_id}: ${gate.gate_status}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderFreezeNoteMarkdown(result) {
  return [
    "# Connector Freeze Note",
    "",
    `Status: ${result.summary.connector_freeze_status}`,
    "",
    HUMAN_REVIEW_NOTE,
    "",
    "This freeze report confirms the P267-P275 connector layer is contract-bound, representative-ingest verified, read-only, review-gated, and not approved for client delivery.",
    "",
  ].join("\n");
}

function serializableConnectorFreeze(result) {
  const { summary_markdown, freeze_note_markdown, ...serializable } = result;
  return serializable;
}

function noMutationDeliveryLegalClient(summary) {
  return (summary.write_operations_allowed ?? false) === false
    && (summary.source_mutation_performed ?? false) === false
    && (summary.resource_mutation_performed ?? false) === false
    && (summary.billing_mutation_performed ?? false) === false
    && (summary.permission_mutation_performed ?? false) === false
    && (summary.resource_expansion_mutation_performed ?? false) === false
    && (summary.normalized_text_mutation_performed ?? false) === false
    && (summary.repository_mutation_performed ?? false) === false
    && (summary.issue_mutation_performed ?? false) === false
    && (summary.pull_request_mutation_performed ?? false) === false
    && (summary.workflow_state_mutation_performed ?? false) === false
    && (summary.matter_data_write_allowed ?? false) === false
    && (summary.task_state_write_allowed ?? false) === false
    && (summary.workflow_transition_allowed ?? false) === false
    && (summary.output_delivery_performed ?? false) === false
    && (summary.protected_action_executed ?? false) === false
    && (summary.legal_advice_generated ?? false) === false
    && (summary.client_facing_output_generated ?? false) === false;
}

function rawCursorMaterialAllowedCount(summaries) {
  return summaries.filter((summary) =>
    summary.raw_delta_token_material_allowed === true
    || summary.raw_export_cursor_material_allowed === true
    || summary.raw_since_cursor_material_allowed === true
    || summary.raw_index_revision_cursor_material_allowed === true
    || summary.raw_transcript_timestamp_cursor_material_allowed === true
    || summary.raw_draft_sequence_cursor_material_allowed === true
  ).length;
}

function ingestPath(pathId, label, kind, sourceIds, passed, projectedRecordCount) {
  return {
    path_id: pathId,
    path_label: label,
    path_kind: kind,
    source_ids: sourceIds,
    path_gate_passed: passed,
    projected_record_count: projectedRecordCount,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "connector-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function gateRecord(gateId, label, passed, message) {
  return {
    gate_id: gateId,
    gate_label: label,
    gate_status: passed ? "passed" : "attention",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function sourceDefinition(sourceId, label, phaseSlot, optionKey, command, statusKey) {
  return {
    source_id: sourceId,
    label,
    phase_slot: phaseSlot,
    input_key: optionKey.replace(/Path$/, "_path").replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    option_key: optionKey,
    command,
    status_key: statusKey,
    path: DEFAULT_CONNECTOR_FREEZE_INPUTS[optionKey],
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_CONNECTOR_FREEZE_INPUTS;
  return {
    repo_root: path.resolve(options.repoRoot ?? defaults.repoRoot),
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_path: options.roadmapPath ?? defaults.roadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? defaults.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? defaults.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? defaults.reviewApiPath,
    connector_contract_v2_path: path.resolve(options.connectorContractV2Path ?? defaults.connectorContractV2Path),
    local_folder_connector_path: path.resolve(options.localFolderConnectorPath ?? defaults.localFolderConnectorPath),
    onedrive_connector_boundary_path: path.resolve(options.onedriveConnectorBoundaryPath ?? defaults.onedriveConnectorBoundaryPath),
    outlook_email_connector_path: path.resolve(options.outlookEmailConnectorPath ?? defaults.outlookEmailConnectorPath),
    kakaotalk_import_boundary_path: path.resolve(options.kakaotalkImportBoundaryPath ?? defaults.kakaotalkImportBoundaryPath),
    github_connector_path: path.resolve(options.githubConnectorPath ?? defaults.githubConnectorPath),
    vdr_connector_path: path.resolve(options.vdrConnectorPath ?? defaults.vdrConnectorPath),
    plaud_transcript_connector_path: path.resolve(options.plaudTranscriptConnectorPath ?? defaults.plaudTranscriptConnectorPath),
    erp_draft_connector_path: path.resolve(options.erpDraftConnectorPath ?? defaults.erpDraftConnectorPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/connector-freeze.mjs [options]

Options:
  --check                     Exit non-zero when validation fails.
  --no-write                  Build in memory without writing artifacts.
  --out-dir <path>            Output directory.
  --package <path>            package.json path.
  --roadmap <path>            Roadmap/ledger path.
  --control-plane-loop <path> Control-plane loop source path.
  --review-dashboard <path>   Review dashboard source path.
  --review-api <path>         Review API source path.
  --run-at <iso>              Deterministic timestamp.
`);
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    items,
    item_count: items.length,
    passed_count: items.filter((item) => item.status === "passed").length,
    failed_count: errors.length,
    errors,
  };
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(value, needles) {
  return typeof value === "string" && needles.every((needle) => value.includes(needle));
}

async function readJsonOrError(filePath) {
  try {
    return {
      value: JSON.parse(await readFileWithRetry(filePath, "utf8")),
    };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFileWithRetry(filePath, "utf8"),
    };
  } catch (error) {
    return {
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 10) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EISDIR", "ENOENT"].includes(error.code) || attempt === attempts) throw error;
      await sleep(100 * attempt);
    }
  }
  throw lastError;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  const value = result?.value ?? result;
  return {
    label,
    available: true,
    schema_version: value?.schema_version ?? null,
    content_hash: `sha256:${hashJson(value ?? {})}`,
  };
}

function textContractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  return {
    label,
    available: true,
    content_hash: `sha256:${hashText(result?.value ?? "")}`,
  };
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runConnectorFreezeCli();
}
