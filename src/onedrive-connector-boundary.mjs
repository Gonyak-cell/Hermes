import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_OUT_DIR = "artifacts/onedrive-connector-boundary/latest";
export const DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS = {
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  localFolderConnectorPath: "artifacts/local-folder-connector/latest/local-folder-connector.json",
  sampleItemsPath: "examples/onedrive-connector-boundary/drive-items.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
};

const CONNECTOR_ID = "connector.onedrive.v2";
const CONNECTOR_PHASE = "P269";
const DEFAULT_TENANT_ID = "tenant.hermes.onedrive.demo";
const DEFAULT_MATTER_ID = "matter.onedrive.demo";
const DEFAULT_POLICY_SNAPSHOT_ID = "policy.onedrive_connector_boundary.default.v1";

export async function runOneDriveConnectorBoundary(options = {}) {
  const result = await buildOneDriveConnectorBoundary(options);
  if (options.write !== false) await writeOneDriveConnectorBoundary(result, result.output_dir);
  if (options.check && (!result.validation.valid || result.summary.onedrive_connector_boundary_status !== "complete")) {
    const error = new Error(`OneDrive connector boundary validation failed with ${result.validation.errors.length} error(s); status=${result.summary.onedrive_connector_boundary_status}.`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildOneDriveConnectorBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_OUT_DIR);
  const connectorContractPath = path.resolve(options.connectorContractV2Path ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.connectorContractV2Path);
  const localFolderConnectorPath = path.resolve(options.localFolderConnectorPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.localFolderConnectorPath);
  const sampleItemsPath = path.resolve(options.sampleItemsPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.sampleItemsPath);
  const connectorContract = await readJsonWithRetry(connectorContractPath);
  const localFolderConnector = await readJsonWithRetry(localFolderConnectorPath);
  const sampleItemsArtifact = options.sampleItems
    ? { items: options.sampleItems }
    : await readJsonWithRetry(sampleItemsPath);
  const oneDriveContract = pickOneDriveConnectorContract(connectorContract);
  const sourceId = options.sourceId ?? oneDriveContract.source_contract?.source_id ?? "source.onedrive.v2";
  const tenantId = options.tenantId ?? sampleItemsArtifact.tenant_id ?? DEFAULT_TENANT_ID;
  const matterId = options.matterId ?? sampleItemsArtifact.matter_id ?? DEFAULT_MATTER_ID;
  const policySnapshotId = options.policySnapshotId ?? sampleItemsArtifact.policy_snapshot_id ?? DEFAULT_POLICY_SNAPSHOT_ID;
  const sampleItems = normalizeSampleItems(sampleItemsArtifact.items ?? [], { tenantId, matterId, policySnapshotId });
  const connectorContractBinding = buildConnectorContractBinding(oneDriveContract, connectorContract, sourceId, generatedAt);
  const sourceBinding = buildSourceBinding(oneDriveContract, { sourceId, tenantId, matterId, policySnapshotId, generatedAt });
  const authBoundary = buildAuthBoundary(oneDriveContract.auth_boundary, generatedAt);
  const timeoutPolicies = buildTimeoutPolicies(generatedAt);
  const placeholderPolicies = buildPlaceholderPolicies(generatedAt);
  const cloudOnlyHandlingRows = buildCloudOnlyHandlingRows(sampleItems, {
    generatedAt,
    sourceId,
    tenantId,
    matterId,
    policySnapshotId,
  });
  const cursorBoundary = buildCursorBoundary(oneDriveContract.cursor_contract, cloudOnlyHandlingRows, {
    generatedAt,
    sourceId,
    tenantId,
    matterId,
  });
  const boundary = buildBoundary(generatedAt);
  const docsAndCode = await readDocsAndCode(options);
  const validationItems = validateOneDriveConnectorBoundary({
    connectorContract,
    localFolderConnector,
    oneDriveContract,
    connectorContractBinding,
    sourceBinding,
    authBoundary,
    timeoutPolicies,
    placeholderPolicies,
    cloudOnlyHandlingRows,
    cursorBoundary,
    boundary,
    docsAndCode,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeOneDriveConnectorBoundary({
    localFolderConnector,
    authBoundary,
    timeoutPolicies,
    placeholderPolicies,
    cloudOnlyHandlingRows,
    cursorBoundary,
    boundary,
    validation,
    sourceId,
  });

  const result = {
    schema_version: "onedrive-connector-boundary.v1",
    generated_at: generatedAt,
    onedrive_connector_boundary_id: `onedrive-connector-boundary.${dateStamp(generatedAt)}`,
    connector_id: CONNECTOR_ID,
    connector_status: summary.onedrive_connector_boundary_status,
    output_dir: outputDir,
    inputs: {
      connector_contract_v2_path: connectorContractPath,
      local_folder_connector_path: localFolderConnectorPath,
      sample_items_path: sampleItemsPath,
    },
    connector_contract_binding: connectorContractBinding,
    source_binding: sourceBinding,
    auth_boundary: authBoundary,
    timeout_policies: timeoutPolicies,
    placeholder_policies: placeholderPolicies,
    cloud_only_handling_rows: cloudOnlyHandlingRows,
    cursor_boundary: cursorBoundary,
    onedrive_connector_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderOneDriveConnectorBoundaryMarkdown(result),
  };
}

export async function writeOneDriveConnectorBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableOneDriveConnectorBoundary(result);
  await writeJson(path.join(outDir, "onedrive-connector-boundary.json"), serializable);
  await writeJson(path.join(outDir, "timeout-policies.json"), {
    generated_at: result.generated_at,
    timeout_policy_count: result.timeout_policies.length,
    timeout_policies: result.timeout_policies,
  });
  await writeJson(path.join(outDir, "placeholder-policies.json"), {
    generated_at: result.generated_at,
    placeholder_policy_count: result.placeholder_policies.length,
    placeholder_policies: result.placeholder_policies,
  });
  await writeJson(path.join(outDir, "cloud-only-handling.json"), {
    generated_at: result.generated_at,
    cloud_only_handling_count: result.cloud_only_handling_rows.length,
    cloud_only_handling_rows: result.cloud_only_handling_rows,
  });
  await writeJson(path.join(outDir, "cursor-boundary.json"), result.cursor_boundary);
  await writeJson(path.join(outDir, "auth-boundary.json"), result.auth_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    onedrive_connector_boundary_id: result.onedrive_connector_boundary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOneDriveConnectorBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runOneDriveConnectorBoundary(args);
    console.log(`OneDrive connector boundary ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.onedrive_connector_boundary_status}`);
    console.log(`Timeout policies: ${result.summary.timeout_policy_count}`);
    console.log(`Placeholder policies: ${result.summary.placeholder_policy_count}`);
    console.log(`Cloud-only handling rows: ${result.summary.cloud_only_handling_count}`);
    console.log(`Cloud-only item count: ${result.summary.cloud_only_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function pickOneDriveConnectorContract(connectorContract) {
  const byConnectorId = (items = []) => items.find((item) => item.connector_id === CONNECTOR_ID) ?? null;
  return {
    definition: byConnectorId(connectorContract.connector_definitions),
    source_contract: byConnectorId(connectorContract.connector_source_contracts),
    cursor_contract: byConnectorId(connectorContract.connector_cursor_contracts),
    external_id_contract: byConnectorId(connectorContract.connector_external_id_contracts),
    auth_boundary: byConnectorId(connectorContract.connector_auth_boundaries),
  };
}

function buildConnectorContractBinding(oneDriveContract, connectorContract, sourceId, generatedAt) {
  return {
    schema_version: "onedrive-connector-contract-binding.v1",
    binding_status: oneDriveContract.definition?.connector_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    source_system: "onedrive",
    connector_family: "onedrive",
    phase_slot: CONNECTOR_PHASE,
    connector_contract_version: connectorContract.schema_version,
    interface_schema_version: connectorContract.connector_interface_schema?.schema_version ?? null,
    source_contract_status: oneDriveContract.source_contract?.source_contract_status ?? "unknown",
    cursor_contract_status: oneDriveContract.cursor_contract?.cursor_contract_status ?? "unknown",
    external_id_contract_status: oneDriveContract.external_id_contract?.external_id_contract_status ?? "unknown",
    auth_boundary_status: oneDriveContract.auth_boundary?.auth_boundary_status ?? "unknown",
    generated_at: generatedAt,
  };
}

function buildSourceBinding(oneDriveContract, context) {
  return {
    schema_version: "onedrive-source-binding.v1",
    source_binding_status: oneDriveContract.source_contract?.source_contract_status === "contracted" ? "bound" : "attention",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    source_system: "onedrive",
    source_kind: "cloud_drive",
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    policy_snapshot_id: context.policySnapshotId,
    source_id_strategy: oneDriveContract.source_contract?.source_id_strategy ?? "deterministic_connector_source_id",
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: oneDriveContract.source_contract?.source_uri_template ?? "onedrive://{tenant_id}/{drive_id}/{item_id}",
    resource_id_template: oneDriveContract.source_contract?.resource_id_template ?? "resource.onedrive.{external_id_hash}",
    generated_at: context.generatedAt,
  };
}

function buildAuthBoundary(authContract, generatedAt) {
  return {
    schema_version: "onedrive-auth-boundary.v1",
    auth_boundary_id: authContract?.auth_boundary_id ?? "auth.onedrive.v2",
    auth_boundary_status: authContract?.auth_boundary_status ?? "unknown",
    auth_mode: authContract?.auth_mode ?? "oauth_delegated_readonly",
    credential_ref_required: true,
    credential_ref_kind: "vault_or_os_keychain_reference",
    credential_reference_only: true,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    least_privilege_scopes: authContract?.least_privilege_scopes ?? ["Files.Read", "Sites.Read.All"],
    external_network_access_required_for_runtime: true,
    external_network_access_performed: false,
    connector_execution_performed: false,
    read_operations_allowed: true,
    write_operations_allowed: false,
    source_mutation_performed: false,
    protected_action_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required_for_materialization: true,
    generated_at: generatedAt,
  };
}

function buildTimeoutPolicies(generatedAt) {
  const policies = [
    ["metadata_delta_page", 10000, 2, "retry_with_jitter_then_resume_from_delta_cursor", "mark_page_retryable_without_source_mutation"],
    ["item_metadata_fetch", 10000, 2, "retry_with_jitter_then_skip_item_for_review", "write_metadata_timeout_review_row"],
    ["cloud_content_materialization", 60000, 1, "defer_and_request_human_materialization_review", "metadata_only_placeholder_row"],
    ["large_file_range_probe", 120000, 0, "do_not_fetch_content_in_boundary", "quarantine_large_cloud_file_for_review"],
  ];
  return policies.map(([operation, timeoutMs, retryAttempts, backoffStrategy, onTimeoutAction]) => ({
    schema_version: "onedrive-timeout-policy.v1",
    timeout_policy_id: `onedrive-timeout.${slug(operation)}`,
    connector_id: CONNECTOR_ID,
    phase_slot: CONNECTOR_PHASE,
    timeout_policy_status: "explicit",
    operation,
    timeout_ms: timeoutMs,
    retry_attempts: retryAttempts,
    backoff_strategy: backoffStrategy,
    on_timeout_action: onTimeoutAction,
    source_mutation_allowed: false,
    cursor_resume_required: true,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildPlaceholderPolicies(generatedAt) {
  const policies = [
    ["cloud_only_placeholder", "metadata_only_until_review", "deferred_pending_human_review", "capture_drive_item_metadata_and_placeholder_reason"],
    ["available_offline_file", "metadata_and_ingest_candidate", "deferred_pending_human_review", "treat_as_read_only_candidate_with_review_gate"],
    ["remote_item_shortcut", "shortcut_metadata_only", "blocked_pending_source_review", "capture_remote_item_reference_without_following_link"],
    ["package_or_bundle_placeholder", "container_metadata_only", "deferred_pending_human_review", "do_not_expand_package_without_review"],
  ];
  return policies.map(([state, metadataMode, contentMaterialization, action]) => ({
    schema_version: "onedrive-placeholder-policy.v1",
    placeholder_policy_id: `onedrive-placeholder.${slug(state)}`,
    connector_id: CONNECTOR_ID,
    phase_slot: CONNECTOR_PHASE,
    placeholder_policy_status: "explicit",
    cloud_item_state: state,
    metadata_mode: metadataMode,
    content_materialization_status: contentMaterialization,
    handling_action: action,
    materialization_allowed_without_human_review: false,
    source_mutation_allowed: false,
    resource_mutation_allowed: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildCloudOnlyHandlingRows(items, context) {
  return items.map((item, index) => {
    const cloudItemState = classifyCloudItemState(item);
    const handling = handlingForState(cloudItemState);
    const externalId = buildExternalId(context.sourceId, item.drive_id, item.item_id);
    const externalVersionId = buildExternalVersionId(item, externalId);
    return {
      schema_version: "onedrive-cloud-only-handling-row.v1",
      handling_row_id: `onedrive-cloud-only.${shortHash(`${externalId}:${index}`)}`,
      connector_id: CONNECTOR_ID,
      source_id: context.sourceId,
      tenant_id: item.tenant_id ?? context.tenantId,
      matter_id: item.matter_id ?? context.matterId,
      policy_snapshot_id: item.policy_snapshot_id ?? context.policySnapshotId,
      drive_id: item.drive_id,
      item_id: item.item_id,
      parent_id: item.parent_id ?? null,
      name: item.name,
      item_kind: item.item_kind,
      mime_type: item.mime_type ?? null,
      classification: item.classification ?? "restricted",
      size_bytes: item.size_bytes ?? 0,
      e_tag: item.e_tag ?? null,
      c_tag: item.c_tag ?? null,
      last_modified_at: item.last_modified_at ?? null,
      external_id: externalId,
      external_version_id: externalVersionId,
      cloud_item_state: cloudItemState,
      placeholder_policy_ref: handling.placeholder_policy_ref,
      timeout_policy_ref: handling.timeout_policy_ref,
      handling_status: handling.status,
      ingest_action: handling.ingest_action,
      resource_projection_status: handling.resource_projection_status,
      content_materialization_status: handling.content_materialization_status,
      materialization_requires_human_review: true,
      content_download_performed: false,
      metadata_read_performed: false,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      review_status: "needs_review",
      human_review_required: true,
      generated_at: context.generatedAt,
    };
  });
}

function buildCursorBoundary(cursorContract, rows, context) {
  const lastSeen = rows.at(-1) ?? null;
  const highWatermark = maxString(rows.map((row) => row.last_modified_at).filter(Boolean));
  const tokenBoundaryPayload = {
    source_id: context.sourceId,
    last_seen_external_id: lastSeen?.external_id ?? null,
    high_watermark: highWatermark,
    row_count: rows.length,
  };
  return {
    schema_version: "onedrive-cursor-boundary.v1",
    cursor_id: cursorContract?.cursor_id ?? "cursor.onedrive.v2",
    cursor_boundary_status: "complete",
    cursor_kind: cursorContract?.cursor_kind ?? "delta_token_cursor",
    connector_id: CONNECTOR_ID,
    source_id: context.sourceId,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    resume_supported: true,
    cursor_storage_mode: "delta_token_hash_only",
    delta_token_hash: hashValue(tokenBoundaryPayload),
    raw_delta_token_material_allowed: false,
    cross_matter_cursor_reuse_allowed: false,
    last_seen_external_id: lastSeen?.external_id ?? null,
    high_watermark: highWatermark,
    stale_delta_recovery_policy: "discard_raw_token_and_require_human_review_before_rescan",
    reset_requires_human_review: true,
    source_mutation_performed: false,
    external_network_access_performed: false,
    updated_at: context.generatedAt,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "onedrive-connector-boundary.v1",
    boundary_status: "enforced",
    phase_slot: CONNECTOR_PHASE,
    plan_only: true,
    timeout_handling_explicit: true,
    placeholder_handling_explicit: true,
    cloud_only_handling_explicit: true,
    connector_execution_performed: false,
    source_read_performed: false,
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
  };
}

async function readDocsAndCode(options) {
  const inputs = {
    package_path: path.resolve(options.packagePath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_ONEDRIVE_CONNECTOR_BOUNDARY_INPUTS.reviewApiPath),
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

function validateOneDriveConnectorBoundary({ connectorContract, localFolderConnector, oneDriveContract, connectorContractBinding, sourceBinding, authBoundary, timeoutPolicies, placeholderPolicies, cloudOnlyHandlingRows, cursorBoundary, boundary, docsAndCode }) {
  const items = [];
  pushCheck(items, "connector_contract.onedrive", oneDriveContract.definition?.connector_status === "contracted" && oneDriveContract.definition?.phase_slot === CONNECTOR_PHASE, "P267 connector contract includes connector.onedrive.v2 for P269.");
  pushCheck(items, "connector_contract.source", oneDriveContract.source_contract?.source_id === sourceBinding.source_id && sourceBinding.source_binding_status === "bound", "OneDrive source_id is bound to the P267 source contract.");
  pushCheck(items, "connector_contract.cursor", oneDriveContract.cursor_contract?.cursor_kind === "delta_token_cursor" && cursorBoundary.resume_supported === true && cursorBoundary.raw_delta_token_material_allowed === false, "OneDrive cursor boundary uses resumable delta-token semantics without raw token material.");
  pushCheck(items, "connector_contract.external_id", oneDriveContract.external_id_contract?.external_id_contract_status === "contracted" && cloudOnlyHandlingRows.every((row) => row.external_id && row.external_version_id), "Every sample OneDrive item has an external_id and external_version_id boundary.");
  pushCheck(items, "connector_contract.auth_boundary", authBoundary.auth_boundary_status === "enforced" && authBoundary.auth_mode === "oauth_delegated_readonly" && authBoundary.credential_ref_required === true && authBoundary.credential_reference_only === true && authBoundary.raw_secret_material_allowed === false, "OneDrive auth boundary is OAuth read-only, credential-reference-only, and raw-secret-free.");
  pushCheck(items, "windows_baseline.local_folder", localFolderConnector.summary?.local_folder_connector_status === "complete" && localFolderConnector.summary?.external_network_access_performed === false && localFolderConnector.summary?.source_mutation_performed === false, "P268 Local Folder Connector baseline remains complete and non-mutating before P269.");
  pushCheck(items, "binding.phase", connectorContractBinding.binding_status === "bound" && connectorContractBinding.phase_slot === CONNECTOR_PHASE, "OneDrive connector binding is attached to P269.");
  pushCheck(items, "timeouts.explicit", timeoutPolicies.length >= 4 && timeoutPolicies.every((policy) => policy.timeout_policy_status === "explicit" && policy.timeout_ms > 0 && policy.cursor_resume_required === true), "Timeout handling is explicit for delta pages, metadata fetches, content materialization, and large-file probes.");
  pushCheck(items, "placeholders.explicit", placeholderPolicies.length >= 4 && placeholderPolicies.every((policy) => policy.placeholder_policy_status === "explicit" && policy.materialization_allowed_without_human_review === false), "Placeholder handling is explicit and materialization requires human review.");
  pushCheck(items, "cloud_only.explicit", cloudOnlyHandlingRows.length > 0 && cloudOnlyHandlingRows.some((row) => row.cloud_item_state === "cloud_only_placeholder") && cloudOnlyHandlingRows.every((row) => row.handling_status && row.content_materialization_status && row.human_review_required), "Cloud-only file handling rows are explicit and review-gated.");
  pushCheck(items, "boundary.plan_only", boundary.plan_only === true && boundary.connector_execution_performed === false && boundary.source_read_performed === false && boundary.external_network_access_performed === false, "OneDrive boundary is plan-only and performs no connector execution, source read, or network access.");
  pushCheck(items, "boundary.no_mutation_or_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.output_delivery_performed === false && boundary.protected_action_executed === false, "OneDrive boundary performs no source/resource mutation, delivery, or protected action.");
  pushCheck(items, "boundary.no_legal_or_client_output", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.human_review_required === true, "OneDrive boundary produces no legal advice or client-facing output and remains human-review gated.");
  pushCheck(items, "package.script", Boolean(docsAndCode.package_json?.scripts?.["connectors:onedrive-boundary"]), "package.json registers connectors:onedrive-boundary.");
  pushCheck(items, "roadmap.slot", typeof docsAndCode.roadmap_text === "string" && docsAndCode.roadmap_text.includes("Phase 269") && docsAndCode.final_ledger_text.includes("P269") && docsAndCode.final_ledger_text.includes("OneDrive connector boundary"), "Roadmap and final ledger promote P269 OneDrive connector boundary.");
  pushCheck(items, "loop.bound", docsAndCode.control_plane_loop_text.includes("onedrive_connector_boundary") && docsAndCode.control_plane_loop_text.includes("connectors:onedrive-boundary"), "Control-plane loop includes OneDrive connector boundary.");
  pushCheck(items, "dashboard.bound", docsAndCode.review_dashboard_text.includes("onedrive_connector_boundary"), "Review Dashboard includes OneDrive connector boundary.");
  pushCheck(items, "api.bound", docsAndCode.review_api_text.includes("/api/onedrive-connector-boundary"), "Review API exposes OneDrive connector boundary routes.");
  pushCheck(items, "contract_source.complete", connectorContract.summary?.connector_contract_status === "complete", "Connector Contract v2 source artifact is complete.");
  return items;
}

function summarizeOneDriveConnectorBoundary({ localFolderConnector, authBoundary, timeoutPolicies, placeholderPolicies, cloudOnlyHandlingRows, cursorBoundary, boundary, validation, sourceId }) {
  const blockedCount = cloudOnlyHandlingRows.filter((row) => row.resource_projection_status === "blocked").length;
  const cloudOnlyCount = cloudOnlyHandlingRows.filter((row) => row.cloud_item_state === "cloud_only_placeholder").length;
  const placeholderItemCount = cloudOnlyHandlingRows.filter((row) => row.cloud_item_state.includes("placeholder") || row.cloud_item_state === "remote_item_shortcut").length;
  const deferredCount = cloudOnlyHandlingRows.filter((row) => row.content_materialization_status.includes("deferred") || row.content_materialization_status.includes("blocked")).length;
  const status = validation.errors.length > 0 ? "attention" : "complete";
  return {
    onedrive_connector_boundary_status: status,
    connector_id: CONNECTOR_ID,
    source_id: sourceId,
    phase_slot: CONNECTOR_PHASE,
    source_local_folder_connector_status: localFolderConnector.summary?.local_folder_connector_status ?? "unknown",
    sample_item_count: cloudOnlyHandlingRows.length,
    timeout_policy_count: timeoutPolicies.length,
    placeholder_policy_count: placeholderPolicies.length,
    cloud_only_handling_count: cloudOnlyHandlingRows.length,
    cloud_only_item_count: cloudOnlyCount,
    placeholder_item_count: placeholderItemCount,
    available_offline_count: cloudOnlyHandlingRows.filter((row) => row.cloud_item_state === "available_offline_file").length,
    blocked_item_count: blockedCount,
    materialization_deferred_count: deferredCount,
    timeout_handling_explicit: boundary.timeout_handling_explicit,
    placeholder_handling_explicit: boundary.placeholder_handling_explicit,
    cloud_only_handling_explicit: boundary.cloud_only_handling_explicit,
    cursor_boundary_status: cursorBoundary.cursor_boundary_status,
    cursor_kind: cursorBoundary.cursor_kind,
    cursor_resume_supported: cursorBoundary.resume_supported,
    raw_delta_token_material_allowed: cursorBoundary.raw_delta_token_material_allowed,
    auth_boundary_status: authBoundary.auth_boundary_status,
    credential_ref_required: authBoundary.credential_ref_required,
    credential_reference_only: authBoundary.credential_reference_only,
    raw_secret_material_allowed: authBoundary.raw_secret_material_allowed,
    least_privilege_scope_count: authBoundary.least_privilege_scopes.length,
    read_operations_allowed: authBoundary.read_operations_allowed,
    write_operations_allowed: authBoundary.write_operations_allowed,
    external_network_access_required_for_runtime: authBoundary.external_network_access_required_for_runtime,
    external_network_access_performed: boundary.external_network_access_performed,
    connector_execution_performed: boundary.connector_execution_performed,
    source_read_performed: boundary.source_read_performed,
    credential_material_read: boundary.credential_material_read,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    output_delivery_performed: boundary.output_delivery_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required_count: cloudOnlyHandlingRows.filter((row) => row.human_review_required).length,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function classifyCloudItemState(item) {
  if (item.permission_status === "denied") return "permission_denied";
  if (item.item_kind === "remote_item_shortcut") return "remote_item_shortcut";
  if (item.availability_state === "blocked_large_file") return "blocked_large_file";
  if (item.cloud_only === true || item.placeholder === true || item.availability_state === "cloud_only_placeholder") return "cloud_only_placeholder";
  if (item.availability_state === "available_offline") return "available_offline_file";
  return "cloud_only_placeholder";
}

function handlingForState(state) {
  if (state === "available_offline_file") {
    return {
      status: "metadata_ready",
      ingest_action: "register_metadata_only_candidate",
      resource_projection_status: "ready",
      content_materialization_status: "deferred_pending_human_review",
      placeholder_policy_ref: "onedrive-placeholder.available-offline-file",
      timeout_policy_ref: "onedrive-timeout.item-metadata-fetch",
    };
  }
  if (state === "blocked_large_file") {
    return {
      status: "quarantined_large_cloud_file",
      ingest_action: "quarantine_until_human_review",
      resource_projection_status: "blocked",
      content_materialization_status: "blocked_large_file_review_required",
      placeholder_policy_ref: "onedrive-placeholder.cloud-only-placeholder",
      timeout_policy_ref: "onedrive-timeout.large-file-range-probe",
    };
  }
  if (state === "permission_denied") {
    return {
      status: "blocked_permission_denied",
      ingest_action: "record_permission_gap",
      resource_projection_status: "blocked",
      content_materialization_status: "blocked_permission_review_required",
      placeholder_policy_ref: "onedrive-placeholder.cloud-only-placeholder",
      timeout_policy_ref: "onedrive-timeout.item-metadata-fetch",
    };
  }
  if (state === "remote_item_shortcut") {
    return {
      status: "blocked_unsupported_placeholder",
      ingest_action: "record_shortcut_metadata_without_following_link",
      resource_projection_status: "blocked",
      content_materialization_status: "blocked_pending_source_review",
      placeholder_policy_ref: "onedrive-placeholder.remote-item-shortcut",
      timeout_policy_ref: "onedrive-timeout.metadata-delta-page",
    };
  }
  return {
    status: "deferred_pending_materialization_review",
    ingest_action: "capture_metadata_and_queue_materialization_review",
    resource_projection_status: "pending_review",
    content_materialization_status: "deferred_pending_human_review",
    placeholder_policy_ref: "onedrive-placeholder.cloud-only-placeholder",
    timeout_policy_ref: "onedrive-timeout.cloud-content-materialization",
  };
}

function normalizeSampleItems(items, defaults) {
  return items.map((item) => ({
    ...item,
    tenant_id: item.tenant_id ?? defaults.tenantId,
    matter_id: item.matter_id ?? defaults.matterId,
    policy_snapshot_id: item.policy_snapshot_id ?? defaults.policySnapshotId,
  }));
}

function renderOneDriveConnectorBoundaryMarkdown(result) {
  const lines = [];
  lines.push("# OneDrive Connector Boundary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.onedrive_connector_boundary_status}`);
  lines.push(`Connector: ${result.connector_id}`);
  lines.push(`Source: ${result.summary.source_id}`);
  lines.push(`Timeout policies: ${result.summary.timeout_policy_count}`);
  lines.push(`Placeholder policies: ${result.summary.placeholder_policy_count}`);
  lines.push(`Cloud-only handling rows: ${result.summary.cloud_only_handling_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- This is a plan-only OneDrive boundary artifact.");
  lines.push("- It performs no connector execution, external network access, credential read, source read, source mutation, resource mutation, delivery, protected action, legal advice, or client-facing output.");
  lines.push("- OAuth credentials are represented only by credential references; raw secret material and raw delta tokens are not allowed.");
  lines.push("- Timeout, placeholder, and cloud-only file handling remain explicit and human-review gated.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--connector-contract-v2") parsed.connectorContractV2Path = argv[++index];
    else if (arg === "--local-folder-connector") parsed.localFolderConnectorPath = argv[++index];
    else if (arg === "--sample-items") parsed.sampleItemsPath = argv[++index];
    else if (arg === "--source-id") parsed.sourceId = argv[++index];
    else if (arg === "--tenant-id") parsed.tenantId = argv[++index];
    else if (arg === "--matter-id") parsed.matterId = argv[++index];
    else if (arg === "--policy-snapshot-id") parsed.policySnapshotId = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/onedrive-connector-boundary.mjs [options]

Options:
  --check                         Fail unless the boundary reaches complete status.
  --out-dir <folder>              Output directory.
  --connector-contract-v2 <path>  Connector Contract v2 artifact.
  --local-folder-connector <path> P268 Local Folder Connector artifact.
  --sample-items <path>           Safe sample OneDrive item fixture.
  --source-id <id>                Connector source id.
  --tenant-id <id>                Tenant id for connector rows.
  --matter-id <id>                Matter id for connector rows.
  --policy-snapshot-id <id>       Policy snapshot id.
  --run-at <iso>                  Deterministic generated_at timestamp.
`);
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

function serializableOneDriveConnectorBoundary(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function buildExternalId(sourceId, driveId, itemId) {
  return `${sourceId}:${driveId}:${itemId}`;
}

function buildExternalVersionId(item, externalId) {
  const versionInput = item.e_tag ?? item.c_tag ?? `${item.size_bytes ?? 0}:${item.last_modified_at ?? "unknown"}`;
  return `${externalId}:version:${shortHash(versionInput)}`;
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
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function maxString(values) {
  return values.length ? values.sort().at(-1) : null;
}
