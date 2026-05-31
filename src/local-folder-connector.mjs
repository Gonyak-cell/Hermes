import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildResourceExpansionJob, writeResourceExpansionJob } from "./resource-expansion.mjs";

export const DEFAULT_LOCAL_FOLDER_CONNECTOR_OUT_DIR = "artifacts/local-folder-connector/latest";
export const DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  roots: ["examples/local-folder-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.local_folder.v2";
const CONNECTOR_PHASE = "P268";
const DEFAULT_TENANT_ID = "tenant.hermes.local";
const DEFAULT_MATTER_ID = "matter.local_folder.demo";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.local_folder_connector.default.v1";
const DEFAULT_BATCH_SIZE = 50;

export async function runLocalFolderConnector(options = {}) {
  const result = await buildLocalFolderConnector(options);
  if (options.write !== false) await writeLocalFolderConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.local_folder_connector_status !== "complete")) {
    const error = new Error(`Local folder connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.local_folder_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLocalFolderConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_OUT_DIR);
  const roots = normalizeRoots(options.roots ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.roots);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.connectorContractV2Path);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const localContract = pickLocalConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? localContract.source_contract?.source_id ?? "source.local_folder.v2";
  const tenantId = options.tenantId ?? DEFAULT_TENANT_ID;
  const matterId = options.matterId ?? DEFAULT_MATTER_ID;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const expansionOutDir = path.join(outputDir, "resource-expansion");
  const rootStats = await readRootStats(roots);
  const expansionJob = await buildResourceExpansionJob({
    roots,
    outDir: expansionOutDir,
    sourceId,
    jobId: options.jobId ?? `local-folder-connector.${slug(sourceId)}`,
    batchSize,
    maxFileBytes: options.maxFileBytes,
    maxTextBytes: options.maxTextBytes,
    defaultMatterId: matterId,
    policySnapshotId: options.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
    reset: options.reset,
    retryFailed: options.retryFailed,
    runAt: generatedAt,
  });
  const discoveryRows = buildDiscoveryRows(expansionJob, {
    generatedAt,
    connectorId: CONNECTOR_ID,
    sourceId,
    tenantId,
    matterId,
    policySnapshotId: options.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
  });
  const ingestRecords = buildIngestRecords(discoveryRows, expansionJob, {
    generatedAt,
    connectorId: CONNECTOR_ID,
    sourceId,
    tenantId,
    matterId,
    policySnapshotId: options.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
  });
  const cursorState = buildCursorState(expansionJob, discoveryRows, {
    generatedAt,
    cursorContract: localContract.cursor_contract,
    connectorId: CONNECTOR_ID,
    sourceId,
    tenantId,
    matterId,
  });
  const authBoundary = buildRuntimeAuthBoundary(localContract.auth_boundary, roots, generatedAt);
  const sourceBinding = buildSourceBinding(localContract, roots, generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateLocalFolderConnector({
    connectorContract,
    localContract,
    rootStats,
    expansionJob,
    discoveryRows,
    ingestRecords,
    cursorState,
    authBoundary,
    sourceBinding,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLocalFolderConnector({
    expansionJob,
    discoveryRows,
    ingestRecords,
    cursorState,
    authBoundary,
    validation,
  });

  const result = {
    schema_version: "local-folder-connector.v1",
    generated_at: generatedAt,
    local_folder_connector_id: `local-folder-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.local_folder_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      source_roots: roots,
      resource_expansion_state_dir: expansionOutDir,
    },
    connector_contract_binding: {
      schema_version: "connector-contract-binding.v1",
      binding_status: localContract.definition?.connector_status === "contracted" ? "bound" : "attention",
      connector_id: CONNECTOR_ID,
      source_id: sourceId,
      source_system: "local_filesystem",
      connector_family: "local_folder",
      phase_slot: CONNECTOR_PHASE,
      connector_contract_version: connectorContract.schema_version,
      interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
      source_contract_status: localContract.source_contract?.source_contract_status ?? "unknown",
      cursor_contract_status: localContract.cursor_contract?.cursor_contract_status ?? "unknown",
      external_id_contract_status: localContract.external_id_contract?.external_id_contract_status ?? "unknown",
      auth_boundary_status: localContract.auth_boundary?.auth_boundary_status ?? "unknown",
    },
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    cursor_state: cursorState,
    local_folder_discovery_rows: discoveryRows,
    local_folder_ingest_records: ingestRecords,
    resource_expansion_summary: {
      schema_version: expansionJob.schema_version,
      job_id: expansionJob.job_id,
      source_id: expansionJob.source_id,
      batch: expansionJob.batch,
      cursor: expansionJob.cursor,
      resumability: expansionJob.resumability,
      audit_summary: expansionJob.audit_summary,
      summary: expansionJob.summary,
    },
    local_folder_connector_boundary: {
      schema_version: "local-folder-connector-boundary.v1",
      boundary_status: "enforced",
      read_only_source_access: true,
      local_path_allowlist_enforced: authBoundary.allowlist_status === "enforced",
      connector_execution_performed: true,
      source_read_performed: true,
      source_mutation_performed: false,
      external_network_access_performed: false,
      credential_material_read: false,
      raw_secret_material_allowed: false,
      resource_mutation_performed: false,
      artifact_write_performed: true,
      output_delivery_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      human_review_required: true,
      generated_at: generatedAt,
    },
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    resource_expansion_job: expansionJob,
    markdown: renderLocalFolderConnectorMarkdown(result),
  };
}

export async function writeLocalFolderConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeResourceExpansionJob(result.resource_expansion_job, result.resource_expansion_job.output_dir);
  const serializable = serializableLocalFolderConnector(result);
  await writeJson(path.join(outDir, "local-folder-connector.json"), serializable);
  await writeJson(path.join(outDir, "discovery-rows.json"), {
    generated_at: result.generated_at,
    discovery_row_count: result.local_folder_discovery_rows.length,
    discovery_rows: result.local_folder_discovery_rows,
  });
  await writeJson(path.join(outDir, "ingest-records.json"), {
    generated_at: result.generated_at,
    ingest_record_count: result.local_folder_ingest_records.length,
    ingest_records: result.local_folder_ingest_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    local_folder_connector_id: result.local_folder_connector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLocalFolderConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLocalFolderConnector(args);
    console.log(`Local folder connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.local_folder_connector_status}`);
    console.log(`Discovered: ${result.summary.discovered_file_count}`);
    console.log(`Processed this run: ${result.summary.processed_this_run}`);
    console.log(`Ingest-ready resources: ${result.summary.ingest_ready_count}`);
    console.log(`Remaining queued: ${result.summary.remaining_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickLocalConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildDiscoveryRows(expansionJob, context) {
  return expansionJob.items.map((item, index) => {
    const externalId = buildExternalId(context.sourceId, item.relative_path);
    const externalVersionId = buildExternalVersionId(item, externalId);
    return {
      schema_version: "local-folder-discovery-row.v1",
      discovery_row_id: `local-folder-discovery.${shortHash(`${context.sourceId}:${item.relative_path}:${index}`)}`,
      connector_id: context.connectorId,
      source_id: context.sourceId,
      tenant_id: context.tenantId,
      matter_id: item.matter_id ?? context.matterId,
      policy_snapshot_id: context.policySnapshotId,
      source_system: "local_filesystem",
      source_path: item.source_path,
      relative_path: item.relative_path,
      root: item.root,
      external_id: externalId,
      external_version_id: externalVersionId,
      discovery_status: discoveryStatusFor(item.status),
      resource_expansion_status: item.status,
      idempotency_key: item.idempotency_key,
      size_bytes: item.size_bytes,
      modified_at: item.modified_at,
      extension: item.extension,
      resource_type: item.resource_type,
      extractor_family: item.extractor_family,
      data_classification: item.data_classification,
      content_hash: item.raw_hash_sha256 ? `sha256:${item.raw_hash_sha256}` : null,
      text_hash: item.text_hash_sha256 ? `sha256:${item.text_hash_sha256}` : null,
      duplicate_of: item.duplicate_of,
      quarantine_reason: item.quarantine_reason,
      human_review_required: true,
      generated_at: context.generatedAt,
    };
  });
}

function buildIngestRecords(discoveryRows, expansionJob, context) {
  const itemByRowId = new Map(expansionJob.items.map((item, index) => [
    `local-folder-discovery.${shortHash(`${context.sourceId}:${item.relative_path}:${index}`)}`,
    item,
  ]));
  return discoveryRows.map((row) => {
    const item = itemByRowId.get(row.discovery_row_id);
    const ingestStatus = ingestStatusFor(row.resource_expansion_status);
    return {
      schema_version: "local-folder-ingest-record.v1",
      ingest_record_id: `local-folder-ingest.${shortHash(row.discovery_row_id)}`,
      discovery_row_id: row.discovery_row_id,
      connector_id: context.connectorId,
      source_id: context.sourceId,
      tenant_id: context.tenantId,
      matter_id: row.matter_id,
      policy_snapshot_id: context.policySnapshotId,
      source_system: "local_filesystem",
      external_id: row.external_id,
      external_version_id: row.external_version_id,
      source_uri: `local_filesystem://${context.tenantId}/${row.matter_id}/${encodeURIComponent(row.relative_path)}`,
      resource_id: item?.resource_id ?? `resource.local_folder.${shortHash(row.external_id)}`,
      resource_version_id: item?.resource_version_id ?? `resource.local_folder.${shortHash(row.external_version_id)}.v1`,
      ingest_status: ingestStatus,
      resource_projection_status: ingestStatus === "resource_candidate_ready" ? "ready" : "not_ready",
      normalized_text_status: row.text_hash ? "ready" : "not_ready",
      evidence_candidate_status: ingestStatus === "resource_candidate_ready" ? "needs_human_review" : "not_applicable",
      content_hash: row.content_hash,
      text_hash: row.text_hash,
      data_classification: row.data_classification,
      review_status: ingestStatus === "resource_candidate_ready" ? "needs_review" : "not_applicable",
      human_review_required: ingestStatus === "resource_candidate_ready",
      duplicate_of: row.duplicate_of,
      quarantine_reason: row.quarantine_reason,
      generated_at: context.generatedAt,
    };
  });
}

function buildCursorState(expansionJob, discoveryRows, context) {
  const processedRows = discoveryRows.filter((row) => row.resource_expansion_status !== "queued");
  const lastSeen = processedRows.at(-1) ?? null;
  const highWatermark = maxString(discoveryRows.map((row) => row.modified_at).filter(Boolean));
  const resumePayload = {
    next_item_id: expansionJob.cursor.next_item_id,
    next_relative_path: expansionJob.cursor.next_relative_path,
    queued_count: expansionJob.cursor.queued_count,
    last_seen_external_id: lastSeen?.external_id ?? null,
    high_watermark: highWatermark,
  };
  return {
    schema_version: "local-folder-cursor-state.v1",
    cursor_id: context.cursorContract?.cursor_id ?? "cursor.local_folder.v2",
    cursor_status: expansionJob.summary.remaining_count > 0 ? "open" : "complete",
    cursor_kind: context.cursorContract?.cursor_kind ?? "filesystem_walk_cursor",
    connector_id: context.connectorId,
    source_id: context.sourceId,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    cursor_position: expansionJob.cursor.next_relative_path ?? "end",
    queued_count: expansionJob.cursor.queued_count,
    next_item_id: expansionJob.cursor.next_item_id,
    next_relative_path: expansionJob.cursor.next_relative_path,
    last_seen_external_id: lastSeen?.external_id ?? null,
    last_seen_at: lastSeen?.generated_at ?? null,
    high_watermark: highWatermark,
    resume_supported: true,
    loaded_previous_state: expansionJob.resumability.loaded_previous_state,
    previous_generated_at: expansionJob.resumability.previous_generated_at ?? null,
    idempotency_strategy: expansionJob.resumability.idempotency_strategy,
    state_path: expansionJob.resumability.state_path,
    resume_token_hash: hashValue(resumePayload),
    raw_token_material_allowed: false,
    cross_matter_cursor_reuse_allowed: false,
    reset_requires_human_review: true,
    updated_at: context.generatedAt,
  };
}

function buildRuntimeAuthBoundary(authContract, roots, generatedAt) {
  return {
    schema_version: "local-folder-auth-boundary.v1",
    auth_boundary_id: authContract?.auth_boundary_id ?? "auth.local_folder.v2",
    auth_boundary_status: authContract?.auth_boundary_status ?? "unknown",
    auth_mode: authContract?.auth_mode ?? "local_path_allowlist",
    allowlist_status: roots.length > 0 ? "enforced" : "missing",
    allowed_roots: roots,
    credential_ref_required: Boolean(authContract?.credential_ref_required),
    credential_reference_only: authContract?.credential_reference_only === true,
    raw_secret_material_allowed: authContract?.raw_secret_material_allowed === true,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? [],
    external_network_access_required_for_runtime: false,
    external_network_access_performed: false,
    connector_execution_performed: true,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    protected_action_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required_for_write: true,
    generated_at: generatedAt,
  };
}

function buildSourceBinding(localContract, roots, generatedAt) {
  return {
    schema_version: "local-folder-source-binding.v1",
    source_binding_status: localContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: localContract.source_contract?.source_id ?? "source.local_folder.v2",
    source_system: "local_filesystem",
    source_kind: "file_tree",
    source_id_strategy: localContract.source_contract?.source_id_strategy ?? "deterministic_connector_source_id",
    source_roots: roots,
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: localContract.source_contract?.source_uri_template ?? "local_filesystem://{tenant_id}/{matter_id}/{external_id}",
    resource_id_template: localContract.source_contract?.resource_id_template ?? "resource.local_folder.{external_id_hash}",
    generated_at: generatedAt,
  };
}

async function readDocsAndCode(options) {
  const inputs = {
    package_path: path.resolve(options.packagePath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_LOCAL_FOLDER_CONNECTOR_INPUTS.reviewApiPath),
  };
  return {
    package_json: JSON.parse(await readTextWithRetry(inputs.package_path)),
    roadmap_text: await readTextWithRetry(inputs.roadmap_path),
    final_ledger_text: await readTextWithRetry(inputs.final_ledger_path),
    control_plane_loop_text: await readTextWithRetry(inputs.control_plane_loop_path),
    review_dashboard_text: await readTextWithRetry(inputs.review_dashboard_path),
    review_api_text: await readTextWithRetry(inputs.review_api_path),
  };
}

function validateLocalFolderConnector({ connectorContract, localContract, rootStats, expansionJob, discoveryRows, ingestRecords, cursorState, authBoundary, sourceBinding, docsAndCode }) {
  const items = [];
  pushCheck(items, "connector_contract.local_folder", localContract.definition?.connector_status === "contracted", "P267 connector contract includes connector.local_folder.v2.");
  pushCheck(items, "connector_contract.source", localContract.source_contract?.source_id === sourceBinding.source_id && sourceBinding.source_binding_status === "bound", "Local folder source_id is bound to the P267 source contract.");
  pushCheck(items, "connector_contract.cursor", localContract.cursor_contract?.resume_supported === true && cursorState.resume_supported === true && cursorState.raw_token_material_allowed === false, "Local folder cursor supports resume without raw token material.");
  pushCheck(items, "connector_contract.external_id", localContract.external_id_contract?.external_id_contract_status === "contracted" && discoveryRows.every((row) => row.external_id && row.external_version_id), "Every discovered local file has an external_id and external_version_id.");
  pushCheck(items, "connector_contract.auth_boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.auth_mode === "local_path_allowlist" && authBoundary.credential_ref_required === false && authBoundary.raw_secret_material_allowed === false, "Local folder auth boundary is path-allowlisted and credential-free.");
  pushCheck(items, "source_roots.exist", rootStats.length > 0 && rootStats.every((root) => root.exists && root.is_directory), "Every configured local folder root exists and is a directory.");
  pushCheck(items, "discovery.present", discoveryRows.length > 0 && expansionJob.summary.discovered_count === discoveryRows.length, "Local folder discovery found file rows.");
  pushCheck(items, "resumability.cursor", cursorState.idempotency_strategy === "path:size:modified_at" && cursorState.state_path.endsWith("resource-expansion-state.json"), "Local folder discovery writes resumable cursor state.");
  const readyIngestRecords = ingestRecords.filter((record) => record.ingest_status === "resource_candidate_ready");
  const duplicateReplayRecords = ingestRecords.filter((record) => record.ingest_status === "skipped_duplicate");
  pushCheck(
    items,
    "ingest.records",
    ingestRecords.length === discoveryRows.length
      && (readyIngestRecords.length > 0 || duplicateReplayRecords.length === discoveryRows.length),
    "Local folder ingest records mirror discovery rows and include ready or idempotently skipped resource candidates.",
  );
  pushCheck(items, "ingest.review_gate", ingestRecords.filter((record) => record.ingest_status === "resource_candidate_ready").every((record) => record.review_status === "needs_review" && record.human_review_required), "Ingest-ready resources remain human-review gated.");
  pushCheck(items, "duplicates.nonblocking", expansionJob.summary.skipped_duplicate_count >= 0 && ingestRecords.filter((record) => record.ingest_status === "skipped_duplicate").every((record) => record.duplicate_of), "Duplicate local files are skipped with duplicate lineage when present.");
  pushCheck(items, "boundary.no_source_mutation", authBoundary.source_mutation_performed === false && authBoundary.write_operations_allowed === false, "Local folder connector does not mutate source folders.");
  pushCheck(items, "boundary.no_network_or_secret", authBoundary.external_network_access_performed === false && authBoundary.raw_secret_material_allowed === false, "Local folder connector performs no network access and handles no raw secrets.");
  pushCheck(items, "boundary.no_delivery_or_legal", authBoundary.delivery_execution_allowed === false && authBoundary.legal_advice_generated === false && authBoundary.client_facing_output_generated === false, "Local folder connector does not deliver outputs or generate legal/client-facing work product.");
  pushCheck(items, "package.script", Boolean(docsAndCode.package_json?.scripts?.["connectors:local-folder"]), "package.json registers connectors:local-folder.");
  pushCheck(items, "roadmap.slot", typeof docsAndCode.roadmap_text === "string" && docsAndCode.roadmap_text.includes("Phase 268") && docsAndCode.final_ledger_text.includes("P268") && docsAndCode.final_ledger_text.includes("local folder connector"), "Roadmap and final ledger promote P268 Local Folder Connector.");
  pushCheck(items, "loop.bound", docsAndCode.control_plane_loop_text.includes("local_folder_connector") && docsAndCode.control_plane_loop_text.includes("connectors:local-folder"), "Control-plane loop includes Local Folder Connector.");
  pushCheck(items, "dashboard.bound", docsAndCode.review_dashboard_text.includes("local_folder_connector"), "Review Dashboard includes Local Folder Connector.");
  pushCheck(items, "api.bound", docsAndCode.review_api_text.includes("/api/local-folder-connector"), "Review API exposes Local Folder Connector routes.");
  pushCheck(items, "contract_source.complete", connectorContract.summary?.connector_contract_status === "complete", "Connector Contract v2 source artifact is complete.");
  return items;
}

function summarizeLocalFolderConnector({ expansionJob, discoveryRows, ingestRecords, cursorState, authBoundary, validation }) {
  const ingestReadyCount = ingestRecords.filter((record) => record.ingest_status === "resource_candidate_ready").length;
  const blockedCount = ingestRecords.filter((record) => record.ingest_status === "blocked_pending_review").length;
  const status = validation.errors.length > 0
    ? "attention"
    : expansionJob.summary.remaining_count > 0
      ? "running"
      : blockedCount > 0
        ? "needs_review"
        : "complete";
  return {
    local_folder_connector_status: status,
    connector_id: CONNECTOR_ID,
    source_id: expansionJob.source_id,
    phase_slot: CONNECTOR_PHASE,
    discovered_file_count: discoveryRows.length,
    processed_this_run: expansionJob.batch.processed_count,
    remaining_count: expansionJob.summary.remaining_count,
    terminal_count: expansionJob.summary.terminal_count,
    extracted_count: expansionJob.summary.extracted_count,
    ingest_record_count: ingestRecords.length,
    ingest_ready_count: ingestReadyCount,
    skipped_duplicate_count: expansionJob.summary.skipped_duplicate_count,
    blocked_count: blockedCount,
    quarantine_count: expansionJob.summary.quarantine_count,
    failed_count: expansionJob.summary.failed_count,
    cursor_status: cursorState.cursor_status,
    cursor_resume_supported: cursorState.resume_supported,
    cursor_loaded_previous_state: cursorState.loaded_previous_state,
    cursor_queued_count: cursorState.queued_count,
    last_seen_external_id_present: Boolean(cursorState.last_seen_external_id),
    state_path: cursorState.state_path,
    source_root_count: expansionJob.source_roots.length,
    local_path_allowlist_enforced: authBoundary.allowlist_status === "enforced",
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    connector_execution_performed: true,
    source_read_performed: true,
    source_mutation_performed: false,
    external_network_access_performed: false,
    credential_material_read: false,
    resource_mutation_performed: false,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required_count: ingestRecords.filter((record) => record.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function discoveryStatusFor(status) {
  if (status === "queued") return "queued_for_resume";
  if (status === "extracted") return "discovered_ingest_ready";
  if (status === "skipped_duplicate") return "discovered_duplicate_skipped";
  if (status === "quarantined" || status === "failed") return "blocked_pending_review";
  return "unknown";
}

function ingestStatusFor(status) {
  if (status === "extracted") return "resource_candidate_ready";
  if (status === "skipped_duplicate") return "skipped_duplicate";
  if (status === "queued") return "queued_for_resume";
  if (status === "quarantined" || status === "failed") return "blocked_pending_review";
  return "unknown";
}

async function readRootStats(roots) {
  const stats = [];
  for (const root of roots) {
    try {
      const rootStat = await stat(root);
      stats.push({ root, exists: true, is_directory: rootStat.isDirectory(), readable: true });
    } catch (error) {
      stats.push({ root, exists: false, is_directory: false, readable: false, error: String(error?.message ?? error) });
    }
  }
  return stats;
}

function renderLocalFolderConnectorMarkdown(result) {
  const lines = [];
  lines.push("# Local Folder Connector");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.local_folder_connector_status}`);
  lines.push(`Connector: ${result.connector_id}`);
  lines.push(`Source: ${result.summary.source_id}`);
  lines.push(`Discovered files: ${result.summary.discovered_file_count}`);
  lines.push(`Processed this run: ${result.summary.processed_this_run}`);
  lines.push(`Ingest-ready resources: ${result.summary.ingest_ready_count}`);
  lines.push(`Remaining queued: ${result.summary.remaining_count}`);
  lines.push(`Skipped duplicates: ${result.summary.skipped_duplicate_count}`);
  lines.push(`Blocked: ${result.summary.blocked_count}`);
  lines.push("");
  lines.push("## Cursor");
  lines.push("");
  lines.push(`- Status: ${result.cursor_state.cursor_status}`);
  lines.push(`- Resume supported: ${result.cursor_state.resume_supported}`);
  lines.push(`- Loaded previous state: ${result.cursor_state.loaded_previous_state}`);
  lines.push(`- Next relative path: ${result.cursor_state.next_relative_path ?? "none"}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- Source access is read-only and limited to the configured local path allowlist.");
  lines.push("- No source mutation, external network access, credential material read, delivery, protected action, legal advice, or client-facing output is performed.");
  lines.push("- Ingest-ready resource candidates remain human-review gated.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { roots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--root") parsed.roots.push(argv[++index]);
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--tenant-id") parsed.tenantId = argv[++index];
    else if (arg === "--matter-id") parsed.matterId = argv[++index];
    else if (arg === "--policy-snapshot-id") parsed.policySnapshotId = argv[++index];
    else if (arg === "--batch-size") parsed.batchSize = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-file-bytes") parsed.maxFileBytes = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-text-bytes") parsed.maxTextBytes = Number.parseInt(argv[++index], 10);
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--reset") parsed.reset = true;
    else if (arg === "--retry-failed") parsed.retryFailed = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.roots.length === 0) delete parsed.roots;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/local-folder-connector.mjs [options]

Options:
  --check                         Fail unless the connector reaches complete status.
  --root <folder>                 Local folder root. Can be repeated.
  --out-dir <folder>              Output directory.
  --connector-contract-v2 <path>  Connector Contract v2 artifact.
  --source-id <id>                Connector source id.
  --tenant-id <id>                Tenant id for connector rows.
  --matter-id <id>                Matter id for connector rows.
  --policy-snapshot-id <id>       Policy snapshot id.
  --batch-size <n>                Files to process this run.
  --max-file-bytes <n>            Quarantine files larger than this.
  --max-text-bytes <n>            Max extracted text bytes.
  --run-at <iso>                  Deterministic generated_at timestamp.
  --reset                         Ignore previous cursor state.
  --retry-failed                  Retry failed rows.
`);
}

function normalizeRoots(roots) {
  return roots.map((root) => path.resolve(root));
}

function buildExternalId(sourceId, relativePath) {
  return `${sourceId}:${relativePath.split(path.sep).join("/")}`;
}

function buildExternalVersionId(item, externalId) {
  const versionInput = item.raw_hash_sha256 ?? `${item.size_bytes}:${item.modified_at}`;
  return `${externalId}:version:${shortHash(versionInput)}`;
}

function pushCheck(items, checkpointId, passed, message) {
  items.push({
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.checkpoint_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

async function readJsonWithRetry(filePath) {
  return JSON.parse(await readTextWithRetry(filePath));
}

async function readTextWithRetry(filePath, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableLocalFolderConnector(result) {
  const { markdown, resource_expansion_job, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function shortHash(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "source";
}

function maxString(values) {
  return values.length ? values.sort().at(-1) : null;
}
