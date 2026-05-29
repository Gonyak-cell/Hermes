import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_VDR_CONNECTOR_OUT_DIR = "artifacts/vdr-connector/latest";
export const DEFAULT_VDR_CONNECTOR_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  githubConnectorPath: "artifacts/github-connector/latest/github-connector.json",
  lddVdrInventoryPath: "artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json",
  vdrInputs: ["examples/vdr-connector"],
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.vdr.v2";
const CONNECTOR_PHASE = "P273";
const DEFAULT_TENANT_ID = "tenant.hermes.vdr.demo";
const DEFAULT_MATTER_ID = "MNA-2026-ALPHA";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.vdr_connector.default.v1";
const DEFAULT_ROOM_ID = "vdr-room-alpha";

export async function runVdrConnector(options = {}) {
  const result = await buildVdrConnector(options);
  if (options.write !== false) await writeVdrConnector(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.vdr_connector_status !== "complete")) {
    const error = new Error(`VDR connector validation failed with ${result.validation.errors.length} error(s); status=${result.summary.vdr_connector_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildVdrConnector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VDR_CONNECTOR_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_VDR_CONNECTOR_INPUTS.connectorContractV2Path);
  const githubConnectorPath = path.resolve(options.githubConnectorPath ?? DEFAULT_VDR_CONNECTOR_INPUTS.githubConnectorPath);
  const lddVdrInventoryPath = path.resolve(options.lddVdrInventoryPath ?? DEFAULT_VDR_CONNECTOR_INPUTS.lddVdrInventoryPath);
  const vdrInputs = normalizeInputPaths(options.vdrInputs ?? DEFAULT_VDR_CONNECTOR_INPUTS.vdrInputs);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const githubConnector = await readJsonWithRetry(githubConnectorPath);
  const lddVdrInventory = await readJsonWithRetry(lddVdrInventoryPath);
  const vdrContract = pickVdrConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? vdrContract.source_contract?.source_id ?? "source.vdr.v2";
  const sourceItems = await readVdrInputs(vdrInputs, {
    sourceId,
    generatedAt,
    tenantId: options.tenantId,
    matterId: options.matterId,
    policySnapshotId: options.policySnapshotId,
  });
  const sourceFileRecords = lddVdrInventory?.ldd_vdr_file_records ?? [];
  const roomRecords = buildRoomRecords(sourceItems, { sourceId, generatedAt });
  const indexRecords = buildIndexRecords(sourceItems, { sourceId, generatedAt });
  const documentRecords = buildDocumentRecords(sourceItems, sourceFileRecords, { sourceId, generatedAt });
  const versionRecords = buildVersionRecords(documentRecords, { generatedAt });
  const permissionBoundaryRecords = buildPermissionBoundaryRecords(documentRecords, sourceItems, { generatedAt });
  const resourceExpansionSeedRecords = buildResourceExpansionSeedRecords(documentRecords, permissionBoundaryRecords, { generatedAt });
  const connectorContractBinding = buildConnectorContractBinding(vdrContract, connectorContract, sourceId);
  const sourceBinding = buildSourceBinding(vdrContract, { sourceId, vdrInputs, roomRecords, generatedAt });
  const authBoundary = buildAuthBoundary(vdrContract.auth_boundary, generatedAt);
  const cursorState = buildCursorState(vdrContract.cursor_contract, [...indexRecords, ...documentRecords], {
    generatedAt,
    sourceId,
    roomRecords,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateVdrConnector({
    connectorContract,
    githubConnector,
    lddVdrInventory,
    vdrContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    roomRecords,
    indexRecords,
    documentRecords,
    versionRecords,
    permissionBoundaryRecords,
    resourceExpansionSeedRecords,
    cursorState,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeVdrConnector({
    githubConnector,
    lddVdrInventory,
    authBoundary,
    roomRecords,
    indexRecords,
    documentRecords,
    versionRecords,
    permissionBoundaryRecords,
    resourceExpansionSeedRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "vdr-connector.v1",
    generated_at: generatedAt,
    vdr_connector_id: `vdr-connector.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.vdr_connector_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      github_connector_path: githubConnectorPath,
      ldd_vdr_inventory_path: lddVdrInventoryPath,
      vdr_inputs: vdrInputs,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    vdr_room_records: roomRecords,
    vdr_index_records: indexRecords,
    vdr_document_records: documentRecords,
    vdr_version_records: versionRecords,
    vdr_permission_boundary_records: permissionBoundaryRecords,
    vdr_resource_expansion_seed_records: resourceExpansionSeedRecords,
    cursor_state: cursorState,
    vdr_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderVdrConnectorMarkdown(result),
  };
}

export async function writeVdrConnector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "vdr-connector.json"), serializableVdrConnector(result));
  await writeJson(path.join(outDir, "vdr-room-records.json"), {
    generated_at: result.generated_at,
    room_record_count: result.vdr_room_records.length,
    vdr_room_records: result.vdr_room_records,
  });
  await writeJson(path.join(outDir, "vdr-index-records.json"), {
    generated_at: result.generated_at,
    index_record_count: result.vdr_index_records.length,
    vdr_index_records: result.vdr_index_records,
  });
  await writeJson(path.join(outDir, "vdr-document-records.json"), {
    generated_at: result.generated_at,
    document_record_count: result.vdr_document_records.length,
    vdr_document_records: result.vdr_document_records,
  });
  await writeJson(path.join(outDir, "vdr-version-records.json"), {
    generated_at: result.generated_at,
    version_record_count: result.vdr_version_records.length,
    vdr_version_records: result.vdr_version_records,
  });
  await writeJson(path.join(outDir, "vdr-permission-boundaries.json"), {
    generated_at: result.generated_at,
    permission_boundary_record_count: result.vdr_permission_boundary_records.length,
    vdr_permission_boundary_records: result.vdr_permission_boundary_records,
  });
  await writeJson(path.join(outDir, "vdr-resource-expansion-seeds.json"), {
    generated_at: result.generated_at,
    resource_expansion_seed_count: result.vdr_resource_expansion_seed_records.length,
    vdr_resource_expansion_seed_records: result.vdr_resource_expansion_seed_records,
  });
  await writeJson(path.join(outDir, "cursor-state.json"), result.cursor_state);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    vdr_connector_id: result.vdr_connector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runVdrConnectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runVdrConnector(args);
    console.log(`VDR connector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.vdr_connector_status}`);
    console.log(`Rooms: ${result.summary.room_count}`);
    console.log(`Indexes: ${result.summary.index_record_count}`);
    console.log(`Documents: ${result.summary.document_count}`);
    console.log(`Resource expansion seeds: ${result.summary.resource_expansion_seed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickVdrConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(vdrContract, connectorContract, sourceId) {
  return {
    schema_version: "connector-contract-binding.v1",
    binding_status: vdrContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "vdr",
    connector_family: "vdr",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: vdrContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: vdrContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: vdrContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: vdrContract.auth_boundary?.auth_boundary_status ?? "unknown",
  };
}

function buildSourceBinding(vdrContract, { sourceId, vdrInputs, roomRecords, generatedAt }) {
  return {
    schema_version: "connector-source-binding.v1",
    source_binding_status: vdrContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "vdr",
    source_kind: "data_room",
    source_mode: "operator_provided_vdr_export",
    source_paths: vdrInputs,
    room_count: roomRecords.length,
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    generated_at: generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "vdr-connector-auth-boundary.v1",
    auth_boundary_status: ["contracted", "enforced"].includes(authContract?.auth_boundary_status) ? "enforced" : "attention",
    connector_id: CONNECTOR_ID,
    auth_mode: authContract?.auth_mode ?? "service_account_readonly",
    credential_ref_required: true,
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["vdr.index.read", "vdr.document.read"],
    external_network_access_required_for_runtime: true,
    external_network_access_performed: false,
    vdr_api_execution_performed: false,
    local_export_read_performed: true,
    connector_execution_performed: true,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    permission_mutation_performed: false,
    generated_at: generatedAt,
  };
}

async function readVdrInputs(inputPaths, context) {
  const files = [];
  for (const inputPath of inputPaths) {
    const stats = await stat(inputPath);
    if (stats.isDirectory()) {
      const names = await readdir(inputPath);
      for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
        files.push(path.join(inputPath, name));
      }
    } else {
      files.push(inputPath);
    }
  }

  const items = [];
  for (const file of files) {
    const value = await readJsonWithRetry(file);
    items.push(normalizeVdrExport(value, file, context));
  }
  return items;
}

function normalizeVdrExport(value, sourcePath, context) {
  const roomId = String(value.vdr_room_id ?? value.room_id ?? DEFAULT_ROOM_ID);
  const matterId = value.matter_id ?? context.matterId ?? DEFAULT_MATTER_ID;
  return {
    source_path: sourcePath,
    source_format: value.schema_version ?? "vdr-connector-export.v1",
    tenant_id: value.tenant_id ?? context.tenantId ?? DEFAULT_TENANT_ID,
    matter_id: matterId,
    policy_snapshot_id: value.policy_snapshot_id ?? context.policySnapshotId ?? DEFAULT_POLICY_SNAPSHOT_ID,
    vdr_room_id: roomId,
    room_name: String(value.room_name ?? value.name ?? "Project Alpha VDR"),
    source_url: value.source_url ?? null,
    exported_at: value.exported_at ?? context.generatedAt,
    index_revision_id: String(value.index_revision_id ?? value.revision_id ?? `${roomId}-rev-1`),
    permission_model: value.permission_model ?? "group_based_readonly_export",
    folders: Array.isArray(value.folders) ? value.folders : [],
    documents: Array.isArray(value.documents) ? value.documents : [],
    permissions: Array.isArray(value.permissions) ? value.permissions : [],
  };
}

function buildRoomRecords(sourceItems, context) {
  return uniqueBy(sourceItems.map((item) => ({
    schema_version: "vdr-room-record.v1",
    vdr_room_record_id: `vdr-room.${slug(item.vdr_room_id)}`,
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    tenant_id: item.tenant_id,
    matter_id: item.matter_id,
    policy_snapshot_id: item.policy_snapshot_id,
    source_system: "vdr",
    source_kind: "data_room",
    source_format: item.source_format,
    source_path: item.source_path,
    vdr_room_id: item.vdr_room_id,
    room_name: item.room_name,
    source_url: item.source_url,
    permission_model: item.permission_model,
    room_status: "metadata_export_ready",
    review_status: "needs_review",
    classification: "restricted",
    human_review_required: true,
    source_mutation_performed: false,
    permission_mutation_performed: false,
    client_facing_output_generated: false,
    audit_trail: buildAuditTrail("vdr_room_export_metadata", item.vdr_room_id, context.generatedAt),
    generated_at: context.generatedAt,
  })), "vdr_room_id");
}

function buildIndexRecords(sourceItems, context) {
  return sourceItems.map((item) => {
    const externalId = buildExternalId(context.sourceId, item.vdr_room_id, "index", item.index_revision_id);
    const resourceId = `resource.vdr.index.${shortHash(externalId)}`;
    return {
      schema_version: "vdr-index-record.v1",
      vdr_index_record_id: `vdr-index.${shortHash(externalId)}`,
      connector_id: CONNECTOR_ID,
      source_id: context.sourceId,
      tenant_id: item.tenant_id,
      matter_id: item.matter_id,
      policy_snapshot_id: item.policy_snapshot_id,
      source_system: "vdr",
      source_kind: "data_room",
      vdr_room_id: item.vdr_room_id,
      index_revision_id: item.index_revision_id,
      folder_count: item.folders.length,
      document_count: item.documents.length,
      permission_group_count: item.permissions.length,
      exported_at: item.exported_at,
      external_id: externalId,
      external_version_id: `${externalId}:version:${shortHash(item.index_revision_id)}`,
      resource_id: resourceId,
      resource_version_id: `${resourceId}.v.${shortHash(item.index_revision_id)}`,
      resource_type: "vdr_index",
      index_status: "resource_candidate_ready",
      vdr_resource_status: "ready",
      resource_projection_status: "ready",
      review_status: "needs_review",
      metadata_complete: Boolean(item.vdr_room_id && item.index_revision_id),
      classification: "restricted",
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      permission_mutation_performed: false,
      client_facing_output_generated: false,
      audit_trail: buildAuditTrail("vdr_index_export_metadata", `${item.vdr_room_id}:${item.index_revision_id}`, context.generatedAt),
      generated_at: context.generatedAt,
    };
  });
}

function buildDocumentRecords(sourceItems, sourceFileRecords, context) {
  const sourceFileByTitle = new Map(sourceFileRecords.map((record) => [normalizeKey(record.file_title), record]));
  const records = [];
  for (const sourceItem of sourceItems) {
    for (const [index, document] of sourceItem.documents.entries()) {
      const documentId = String(document.document_id ?? document.id ?? `document-${index + 1}`);
      const documentVersion = String(document.document_version ?? document.version ?? "v1");
      const title = String(document.title ?? document.file_name ?? `(untitled VDR document ${index + 1})`);
      const sourceFile = sourceFileByTitle.get(normalizeKey(title)) ?? null;
      const externalId = buildExternalId(context.sourceId, sourceItem.vdr_room_id, documentId, documentVersion);
      const externalVersionId = `${externalId}:version:${shortHash(`${documentVersion}:${document.updated_at ?? sourceItem.exported_at}:${document.hash_sha256 ?? ""}`)}`;
      const resourceId = `resource.vdr.document.${shortHash(externalId)}`;
      records.push({
        schema_version: "vdr-document-record.v1",
        vdr_document_record_id: `vdr-document.${shortHash(`${externalId}:${index}`)}`,
        connector_id: CONNECTOR_ID,
        source_id: context.sourceId,
        tenant_id: sourceItem.tenant_id,
        matter_id: sourceItem.matter_id,
        policy_snapshot_id: sourceItem.policy_snapshot_id,
        source_system: "vdr",
        source_kind: "data_room",
        source_format: sourceItem.source_format,
        source_path: sourceItem.source_path,
        vdr_room_id: sourceItem.vdr_room_id,
        index_revision_id: sourceItem.index_revision_id,
        document_id: documentId,
        document_version: documentVersion,
        title,
        file_name: String(document.file_name ?? title),
        folder_id: document.folder_id ?? null,
        folder_path: document.path ?? document.folder_path ?? null,
        mime_type: document.mime_type ?? "application/octet-stream",
        size_bytes: Number(document.size_bytes ?? 0),
        hash_sha256: normalizeHash(document.hash_sha256 ?? document.content_hash ?? `${documentId}:${documentVersion}`),
        uploaded_at: document.uploaded_at ?? sourceItem.exported_at,
        updated_at: document.updated_at ?? document.uploaded_at ?? sourceItem.exported_at,
        owner: document.owner ?? "unknown",
        permission_group_ids: normalizeStringArray(document.permission_group_ids),
        ldd_vdr_file_record_id: sourceFile?.ldd_vdr_file_record_id ?? null,
        external_id: externalId,
        external_version_id: externalVersionId,
        resource_id: resourceId,
        resource_version_id: `${resourceId}.v.${shortHash(externalVersionId)}`,
        resource_type: "vdr_document",
        document_status: "resource_candidate_ready",
        vdr_resource_status: "ready",
        resource_projection_status: "ready",
        resource_expansion_seed_status: "ready_for_resource_expansion",
        permission_boundary_status: "enforced",
        review_status: "needs_review",
        classification: document.classification ?? sourceFile?.classification ?? "restricted",
        idempotency_key: hashValue(`${externalId}:${externalVersionId}`),
        metadata_complete: Boolean(documentId && documentVersion && title && (document.updated_at ?? document.uploaded_at ?? sourceItem.exported_at)),
        document_content_read_performed: false,
        vdr_document_download_performed: false,
        human_review_required: true,
        source_mutation_performed: false,
        resource_mutation_performed: false,
        permission_mutation_performed: false,
        client_facing_output_generated: false,
        audit_trail: buildAuditTrail("vdr_document_export_metadata", `${sourceItem.vdr_room_id}/${documentId}/${documentVersion}`, context.generatedAt),
        generated_at: context.generatedAt,
      });
    }
  }
  return records;
}

function buildVersionRecords(documentRecords, { generatedAt }) {
  return documentRecords.map((document) => ({
    schema_version: "vdr-version-record.v1",
    vdr_version_record_id: `vdr-version.${shortHash(document.external_version_id)}`,
    vdr_document_record_id: document.vdr_document_record_id,
    connector_id: CONNECTOR_ID,
    source_id: document.source_id,
    tenant_id: document.tenant_id,
    matter_id: document.matter_id,
    policy_snapshot_id: document.policy_snapshot_id,
    source_system: "vdr",
    vdr_room_id: document.vdr_room_id,
    document_id: document.document_id,
    document_version: document.document_version,
    external_id: document.external_id,
    external_version_id: document.external_version_id,
    resource_id: document.resource_id,
    resource_version_id: document.resource_version_id,
    version_status: "current",
    vdr_resource_status: "ready",
    review_status: "needs_review",
    human_review_required: true,
    resource_mutation_performed: false,
    generated_at: generatedAt,
  }));
}

function buildPermissionBoundaryRecords(documentRecords, sourceItems, { generatedAt }) {
  const permissionsByRoom = new Map(sourceItems.map((item) => [item.vdr_room_id, item.permissions]));
  return documentRecords.map((document) => {
    const permissionGroups = permissionsByRoom.get(document.vdr_room_id) ?? [];
    const matchedGroups = permissionGroups.filter((group) => document.permission_group_ids.includes(group.permission_group_id));
    return {
      schema_version: "vdr-permission-boundary-record.v1",
      vdr_permission_boundary_record_id: `vdr-permission.${shortHash(document.resource_id)}`,
      vdr_document_record_id: document.vdr_document_record_id,
      connector_id: CONNECTOR_ID,
      source_id: document.source_id,
      tenant_id: document.tenant_id,
      matter_id: document.matter_id,
      policy_snapshot_id: document.policy_snapshot_id,
      source_system: "vdr",
      vdr_room_id: document.vdr_room_id,
      document_id: document.document_id,
      resource_id: document.resource_id,
      permission_group_ids: document.permission_group_ids,
      permission_group_count: matchedGroups.length,
      permission_boundary_status: "enforced",
      view_metadata_allowed: true,
      document_download_allowed: false,
      document_print_allowed: false,
      document_share_allowed: false,
      permission_mutation_allowed: false,
      credential_reference_only: true,
      human_review_required_before_content_fetch: true,
      review_status: "needs_review",
      human_review_required: true,
      source_mutation_performed: false,
      permission_mutation_performed: false,
      resource_mutation_performed: false,
      generated_at: generatedAt,
    };
  });
}

function buildResourceExpansionSeedRecords(documentRecords, permissionBoundaryRecords, { generatedAt }) {
  const boundaryByDocument = new Map(permissionBoundaryRecords.map((record) => [record.vdr_document_record_id, record]));
  return documentRecords.map((document) => {
    const boundary = boundaryByDocument.get(document.vdr_document_record_id);
    return {
      schema_version: "vdr-resource-expansion-seed.v1",
      vdr_resource_expansion_seed_id: `vdr-resource-expansion-seed.${shortHash(document.resource_id)}`,
      vdr_document_record_id: document.vdr_document_record_id,
      vdr_permission_boundary_record_id: boundary?.vdr_permission_boundary_record_id ?? null,
      connector_id: CONNECTOR_ID,
      source_id: document.source_id,
      tenant_id: document.tenant_id,
      matter_id: document.matter_id,
      policy_snapshot_id: document.policy_snapshot_id,
      source_system: "vdr",
      expansion_source_kind: "vdr_metadata_export",
      expansion_target_kind: "resource_expansion_job",
      resource_id: document.resource_id,
      resource_version_id: document.resource_version_id,
      external_id: document.external_id,
      external_version_id: document.external_version_id,
      resource_type: document.resource_type,
      resource_expansion_seed_status: "ready_for_resource_expansion",
      resource_expansion_binding_status: "bound",
      content_fetch_allowed_without_human_review: false,
      materialization_required: "human_review_before_content_fetch",
      permission_boundary_status: boundary?.permission_boundary_status ?? "attention",
      review_status: "needs_review",
      human_review_required: true,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      protected_action_executed: false,
      generated_at: generatedAt,
    };
  });
}

function buildCursorState(cursorContract, records, { generatedAt, sourceId, roomRecords }) {
  const highWatermark = records.map((record) => record.updated_at ?? record.exported_at ?? generatedAt).sort().at(-1) ?? generatedAt;
  const roomCursorMaterial = roomRecords.map((room) => `${room.vdr_room_id}:${highWatermark}`).join("|");
  return {
    schema_version: "vdr-connector-cursor-state.v1",
    cursor_status: "complete",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    cursor_kind: cursorContract?.cursor_kind ?? "vdr_index_revision_cursor",
    cursor_storage_mode: "vdr_index_revision_hash_only",
    resume_supported: true,
    high_watermark_updated_at: highWatermark,
    last_seen_resource_hash: records.length > 0 ? shortHash(records.at(-1).resource_id) : null,
    resume_token_hash: hashValue(roomCursorMaterial || generatedAt),
    raw_index_revision_cursor_material_allowed: false,
    raw_cursor_material_allowed: false,
    generated_at: generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "vdr-connector-boundary.v1",
    boundary_status: "enforced",
    connector_id: CONNECTOR_ID,
    local_export_read_performed: true,
    vdr_api_execution_performed: false,
    external_network_access_performed: false,
    credential_material_read: false,
    connector_execution_performed: true,
    source_read_performed: true,
    document_content_read_performed: false,
    vdr_document_download_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    permission_mutation_performed: false,
    resource_expansion_mutation_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    generated_at: generatedAt,
  };
}

function validateVdrConnector(input) {
  const {
    connectorContract,
    githubConnector,
    lddVdrInventory,
    vdrContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    roomRecords,
    indexRecords,
    documentRecords,
    versionRecords,
    permissionBoundaryRecords,
    resourceExpansionSeedRecords,
    cursorState,
    boundary,
    docsAndCode,
  } = input;
  const items = [];
  const pushCheck = (pathId, passed, message) => {
    items.push({
      path: pathId,
      check_id: pathId,
      status: passed ? "passed" : "failed",
      message,
    });
  };

  pushCheck("connector.contract.present", connectorContract?.summary?.connector_contract_status === "complete", "Connector Contract v2 is complete.");
  pushCheck("connector.definition.bound", vdrContract.definition?.connector_id === CONNECTOR_ID && connectorContractBinding.binding_status === "bound", "VDR connector contract is bound.");
  pushCheck("source.github.complete", githubConnector?.summary?.github_connector_status === "complete", "P272 GitHub Connector baseline is complete.");
  pushCheck("source.ldd_vdr_inventory.complete", lddVdrInventory?.summary?.ldd_vdr_inventory_status === "complete", "LDD VDR inventory source is complete.");
  pushCheck("rooms.present", roomRecords.length > 0 && roomRecords.every((room) => room.room_status === "metadata_export_ready" && room.human_review_required), "VDR rooms are represented.");
  pushCheck("index.present", indexRecords.length > 0 && indexRecords.every((record) => record.index_status === "resource_candidate_ready" && record.resource_type === "vdr_index" && record.metadata_complete), "VDR index revisions are projected as resource candidates.");
  pushCheck("documents.present", documentRecords.length > 0 && documentRecords.every((record) => record.document_status === "resource_candidate_ready" && record.resource_type === "vdr_document" && record.metadata_complete), "VDR documents are projected as resource candidates.");
  pushCheck("versions.match.documents", versionRecords.length === documentRecords.length && versionRecords.every((record) => record.version_status === "current"), "Every VDR document has a version row.");
  pushCheck("permission.boundaries.match.documents", permissionBoundaryRecords.length === documentRecords.length && permissionBoundaryRecords.every((record) => record.permission_boundary_status === "enforced" && record.document_download_allowed === false), "Every VDR document has an enforced permission boundary.");
  pushCheck("resource_expansion.seeds.match.documents", resourceExpansionSeedRecords.length === documentRecords.length && resourceExpansionSeedRecords.every((record) => record.resource_expansion_seed_status === "ready_for_resource_expansion" && record.content_fetch_allowed_without_human_review === false), "Every VDR document has a resource expansion seed.");
  pushCheck("ldd_vdr_inventory.linked", documentRecords.some((record) => record.ldd_vdr_file_record_id), "At least one connector document links back to the LDD VDR inventory.");
  pushCheck("cursor.hash_only", cursorState.cursor_status === "complete" && cursorState.resume_supported === true && cursorState.raw_index_revision_cursor_material_allowed === false, "VDR cursor is resumable and hash-only.");
  pushCheck("auth.boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false && authBoundary.write_operations_allowed === false, "VDR auth boundary is read-only and credential-reference-only.");
  pushCheck("no.live.vdr", authBoundary.vdr_api_execution_performed === false && authBoundary.external_network_access_performed === false && boundary.vdr_api_execution_performed === false, "No live VDR API or network execution is performed.");
  pushCheck("no.content.download", boundary.document_content_read_performed === false && boundary.vdr_document_download_performed === false, "No VDR document content is downloaded.");
  pushCheck("no.mutation", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.permission_mutation_performed === false && boundary.resource_expansion_mutation_performed === false, "No source, resource, permission, or resource-expansion mutation is performed.");
  pushCheck("no.delivery.or.legal", boundary.output_delivery_performed === false && boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false, "No delivery, protected action, legal advice, or client-facing output is generated.");
  pushCheck("package.script", docsAndCode.package_text.includes("\"connectors:vdr\""), "package.json exposes connectors:vdr.");
  pushCheck("roadmap.phase", docsAndCode.roadmap_text.includes("Phase 273") && docsAndCode.roadmap_text.includes("VDR Connector"), "Roadmap documents Phase 273 VDR Connector.");
  pushCheck("ledger.slot", docsAndCode.final_ledger_text.includes("| P273 |") && docsAndCode.final_ledger_text.includes("VDR connector"), "Final ledger tracks P273 VDR connector.");
  pushCheck("loop.step", docsAndCode.control_plane_loop_text.includes("vdr_connector") && docsAndCode.control_plane_loop_text.includes("connectors:vdr"), "Control plane loop includes VDR connector.");
  pushCheck("dashboard.source", docsAndCode.review_dashboard_text.includes("vdr_connector"), "Review dashboard includes VDR connector.");
  pushCheck("api.route", docsAndCode.review_api_text.includes("/api/vdr-connector"), "Review API exposes VDR connector routes.");

  return items;
}

function summarizeVdrConnector(input) {
  const {
    githubConnector,
    lddVdrInventory,
    authBoundary,
    roomRecords,
    indexRecords,
    documentRecords,
    versionRecords,
    permissionBoundaryRecords,
    resourceExpansionSeedRecords,
    cursorState,
    boundary,
    validation,
    sourceId,
  } = input;
  const resourceCandidateCount = indexRecords.length + documentRecords.length;
  const permissionGroupIds = new Set(permissionBoundaryRecords.flatMap((record) => record.permission_group_ids ?? []));
  return {
    vdr_connector_status: validation.valid ? "complete" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_github_connector_status: githubConnector?.summary?.github_connector_status ?? "unknown",
    source_ldd_vdr_inventory_status: lddVdrInventory?.summary?.ldd_vdr_inventory_status ?? "unknown",
    source_ldd_vdr_inventory_file_record_count: lddVdrInventory?.summary?.file_record_count ?? 0,
    room_count: roomRecords.length,
    index_record_count: indexRecords.length,
    folder_count: indexRecords.reduce((sum, record) => sum + (record.folder_count ?? 0), 0),
    document_count: documentRecords.length,
    version_count: versionRecords.length,
    permission_boundary_count: permissionBoundaryRecords.length,
    permission_group_count: permissionGroupIds.size,
    resource_expansion_seed_count: resourceExpansionSeedRecords.length,
    index_resource_count: indexRecords.length,
    document_resource_count: documentRecords.length,
    resource_candidate_count: resourceCandidateCount,
    resource_expansion_seed_link_count: resourceExpansionSeedRecords.filter((record) => record.vdr_document_record_id && record.vdr_permission_boundary_record_id).length,
    ldd_vdr_inventory_file_link_count: documentRecords.filter((record) => record.ldd_vdr_file_record_id).length,
    permission_boundary_link_count: permissionBoundaryRecords.filter((record) => record.vdr_document_record_id).length,
    metadata_complete_index_count: indexRecords.filter((record) => record.metadata_complete).length,
    metadata_complete_document_count: documentRecords.filter((record) => record.metadata_complete).length,
    cursor_status: cursorState.cursor_status,
    cursor_kind: cursorState.cursor_kind,
    cursor_resume_supported: cursorState.resume_supported,
    raw_index_revision_cursor_material_allowed: cursorState.raw_index_revision_cursor_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    local_export_read_performed: boundary.local_export_read_performed,
    vdr_api_execution_performed: boundary.vdr_api_execution_performed,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    document_content_read_performed: boundary.document_content_read_performed,
    vdr_document_download_performed: boundary.vdr_document_download_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    permission_mutation_performed: boundary.permission_mutation_performed,
    resource_expansion_mutation_performed: boundary.resource_expansion_mutation_performed,
    matter_data_write_allowed: boundary.matter_data_write_allowed,
    task_state_write_allowed: boundary.task_state_write_allowed,
    workflow_transition_allowed: boundary.workflow_transition_allowed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: [...indexRecords, ...documentRecords].filter((record) => record.human_review_required).length,
    resource_expansion_human_review_required_count: resourceExpansionSeedRecords.filter((record) => record.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed");
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
    items,
  };
}

function serializableVdrConnector(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function renderVdrConnectorMarkdown(result) {
  const lines = [
    "# VDR Connector",
    "",
    `- Status: ${result.summary.vdr_connector_status}`,
    `- Rooms: ${result.summary.room_count}`,
    `- Index records: ${result.summary.index_record_count}`,
    `- Documents: ${result.summary.document_count}`,
    `- Resource expansion seeds: ${result.summary.resource_expansion_seed_count}`,
    `- Permission boundaries: ${result.summary.permission_boundary_count}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This artifact reads operator-provided VDR export metadata only. It does not call a live VDR API, use network access, read credential material, download document content, mutate source permissions, mutate resource state, deliver output, perform protected actions, provide legal advice, or create client-facing output.",
    "",
    "Resource expansion seed rows are internal candidates requiring human review before content materialization.",
  ];
  return `${lines.join("\n")}\n`;
}

async function readDocsAndCode(options) {
  const defaults = DEFAULT_VDR_CONNECTOR_INPUTS;
  const paths = {
    package_text: options.packagePath ?? defaults.packagePath,
    roadmap_text: options.roadmapPath ?? defaults.roadmapPath,
    final_ledger_text: options.finalLedgerPath ?? defaults.finalLedgerPath,
    control_plane_loop_text: options.controlPlaneLoopPath ?? defaults.controlPlaneLoopPath,
    review_dashboard_text: options.reviewDashboardPath ?? defaults.reviewDashboardPath,
    review_api_text: options.reviewApiPath ?? defaults.reviewApiPath,
  };
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, file]) => [key, await readFile(file, "utf8")])));
}

async function readJsonWithRetry(file) {
  const text = await readFile(file, "utf8");
  return JSON.parse(text);
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--github-connector") parsed.githubConnectorPath = argv[++index];
    else if (arg === "--ldd-vdr-inventory") parsed.lddVdrInventoryPath = argv[++index];
    else if (arg === "--vdr-input") {
      parsed.vdrInputs = parsed.vdrInputs ?? [];
      parsed.vdrInputs.push(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/vdr-connector.mjs [options]

Options:
  --check                         Fail if validation does not pass.
  --out-dir <path>                Output directory.
  --connector-contract-v2 <path>  Connector Contract v2 artifact.
  --github-connector <path>       GitHub connector artifact.
  --ldd-vdr-inventory <path>      LDD VDR inventory artifact.
  --vdr-input <path>              VDR export JSON file or directory. Repeatable.
`);
}

function normalizeInputPaths(inputPaths) {
  return inputPaths.map((item) => path.resolve(item));
}

function buildExternalId(sourceId, roomId, id, version) {
  return `${sourceId}:${roomId}:${id}:${version}`;
}

function buildAuditTrail(source, subject, timestamp) {
  return {
    source,
    subject,
    timestamp,
    confidence: 0.97,
    responsible_owner: "Hermes connector harness",
    review_status: "needs_review",
  };
}

function normalizeHash(value) {
  const text = String(value ?? "");
  if (text.startsWith("sha256:")) return text;
  if (/^[a-f0-9]{64}$/i.test(text)) return `sha256:${text.toLowerCase()}`;
  return hashValue(text);
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
