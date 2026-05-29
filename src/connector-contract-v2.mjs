import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONNECTOR_CONTRACT_V2_OUT_DIR = "artifacts/connector-contract-v2/latest";
export const DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  finalLedgerPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  creativeDocumentFreezePath: "artifacts/creative-document-freeze/latest/creative-document-freeze.json",
};

const CONTRACT_ID = "connector-contract-v2.v1";
const INTERFACE_SCHEMA_VERSION = "connector-interface-schema.v2";
const CONNECTOR_SOURCE_SCHEMA_VERSION = "connector-source.v2";
const CONNECTOR_CURSOR_SCHEMA_VERSION = "connector-cursor.v2";
const CONNECTOR_EXTERNAL_ID_SCHEMA_VERSION = "connector-external-id.v2";
const CONNECTOR_AUTH_BOUNDARY_SCHEMA_VERSION = "connector-auth-boundary.v2";
const HUMAN_REVIEW_NOTE = "Connector Contract v2 is a read-only interface contract. It does not execute connectors, access external systems, deliver outputs, or provide legal advice.";

const CONNECTOR_BLUEPRINTS = [
  connectorBlueprint({
    connectorId: "connector.local_folder.v2",
    label: "Local folder connector",
    phaseSlot: "P268",
    family: "local_folder",
    sourceSystem: "local_filesystem",
    sourceKind: "file_tree",
    authMode: "local_path_allowlist",
    credentialRefRequired: false,
    networkAccessRequired: false,
    leastPrivilegeScopes: ["filesystem.metadata.read", "filesystem.content.read"],
    cursorKind: "filesystem_walk_cursor",
    externalIdFields: ["absolute_path", "file_id", "content_hash"],
    expectedResourceTypes: ["file", "folder"],
  }),
  connectorBlueprint({
    connectorId: "connector.onedrive.v2",
    label: "OneDrive connector boundary",
    phaseSlot: "P269",
    family: "onedrive",
    sourceSystem: "onedrive",
    sourceKind: "cloud_drive",
    authMode: "oauth_delegated_readonly",
    credentialRefRequired: true,
    networkAccessRequired: true,
    leastPrivilegeScopes: ["Files.Read", "Sites.Read.All"],
    cursorKind: "delta_token_cursor",
    externalIdFields: ["drive_id", "item_id", "etag"],
    expectedResourceTypes: ["file", "folder", "placeholder"],
  }),
  connectorBlueprint({
    connectorId: "connector.outlook_email.v2",
    label: "Outlook email connector",
    phaseSlot: "P270",
    family: "outlook_email",
    sourceSystem: "outlook",
    sourceKind: "mailbox",
    authMode: "oauth_delegated_readonly",
    credentialRefRequired: true,
    networkAccessRequired: true,
    leastPrivilegeScopes: ["Mail.Read", "MailboxSettings.Read"],
    cursorKind: "mail_folder_delta_cursor",
    externalIdFields: ["message_id", "internet_message_id", "conversation_id"],
    expectedResourceTypes: ["email", "attachment"],
  }),
  connectorBlueprint({
    connectorId: "connector.kakaotalk_export.v2",
    label: "KakaoTalk export connector",
    phaseSlot: "P271",
    family: "kakaotalk_export",
    sourceSystem: "kakaotalk",
    sourceKind: "export_file",
    authMode: "operator_provided_export",
    credentialRefRequired: false,
    networkAccessRequired: false,
    leastPrivilegeScopes: ["export.file.read"],
    cursorKind: "export_line_offset_cursor",
    externalIdFields: ["chat_export_id", "line_number", "message_timestamp"],
    expectedResourceTypes: ["chat_message", "attachment"],
  }),
  connectorBlueprint({
    connectorId: "connector.github.v2",
    label: "GitHub connector",
    phaseSlot: "P272",
    family: "github",
    sourceSystem: "github",
    sourceKind: "repo_api",
    authMode: "app_installation_or_pat_readonly",
    credentialRefRequired: true,
    networkAccessRequired: true,
    leastPrivilegeScopes: ["contents:read", "issues:read", "pull_requests:read"],
    cursorKind: "repo_event_since_cursor",
    externalIdFields: ["owner", "repo", "node_id"],
    expectedResourceTypes: ["issue", "pull_request", "repository_file"],
  }),
  connectorBlueprint({
    connectorId: "connector.vdr.v2",
    label: "VDR connector",
    phaseSlot: "P273",
    family: "vdr",
    sourceSystem: "vdr",
    sourceKind: "data_room",
    authMode: "service_account_readonly",
    credentialRefRequired: true,
    networkAccessRequired: true,
    leastPrivilegeScopes: ["vdr.index.read", "vdr.document.read"],
    cursorKind: "vdr_index_revision_cursor",
    externalIdFields: ["vdr_room_id", "document_id", "document_version"],
    expectedResourceTypes: ["vdr_document", "vdr_index"],
  }),
  connectorBlueprint({
    connectorId: "connector.plaud_transcript.v2",
    label: "Plaud transcript connector",
    phaseSlot: "P274",
    family: "plaud_transcript",
    sourceSystem: "plaud",
    sourceKind: "transcript_export",
    authMode: "oauth_or_operator_export_readonly",
    credentialRefRequired: false,
    networkAccessRequired: false,
    leastPrivilegeScopes: ["transcript.export.read"],
    cursorKind: "transcript_timestamp_cursor",
    externalIdFields: ["recording_id", "speaker_segment_id", "timestamp_range"],
    expectedResourceTypes: ["meeting_transcript", "audio_metadata"],
  }),
  connectorBlueprint({
    connectorId: "connector.erp_draft.v2",
    label: "ERP draft connector",
    phaseSlot: "P275",
    family: "erp_draft",
    sourceSystem: "erp",
    sourceKind: "billing_draft",
    authMode: "service_account_draft_hold",
    credentialRefRequired: true,
    networkAccessRequired: true,
    leastPrivilegeScopes: ["billing.draft.read", "billing.draft.prepare"],
    cursorKind: "draft_sequence_cursor",
    externalIdFields: ["erp_account_id", "draft_id", "draft_revision"],
    expectedResourceTypes: ["invoice_draft", "estimate_draft"],
    draftOutputConnector: true,
  }),
];

export async function runConnectorContractV2(options = {}) {
  const result = await buildConnectorContractV2(options);
  if (options.write !== false) await writeConnectorContractV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Connector Contract v2 validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConnectorContractV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONNECTOR_CONTRACT_V2_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSources(inputs);
  const interfaceSchema = buildConnectorInterfaceSchema(generatedAt);
  const connectorDefinitions = buildConnectorDefinitions(generatedAt);
  const sourceContracts = buildConnectorSourceContracts(connectorDefinitions, generatedAt);
  const cursorContracts = buildConnectorCursorContracts(connectorDefinitions, generatedAt);
  const externalIdContracts = buildConnectorExternalIdContracts(connectorDefinitions, generatedAt);
  const authBoundaries = buildConnectorAuthBoundaries(connectorDefinitions, generatedAt);
  const contractBoundary = buildContractBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: sourceReads.package_json.value,
    roadmapText: sourceReads.roadmap_text.value,
    finalLedgerText: sourceReads.final_ledger_text.value,
    controlPlaneLoopText: sourceReads.control_plane_loop_text.value,
    reviewDashboardText: sourceReads.review_dashboard_text.value,
    reviewApiText: sourceReads.review_api_text.value,
    connectorDefinitions,
    sourceContracts,
    cursorContracts,
    externalIdContracts,
    authBoundaries,
    contractBoundary,
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
  const summary = summarizeConnectorContract({
    sourceReads,
    connectorDefinitions,
    sourceContracts,
    cursorContracts,
    externalIdContracts,
    authBoundaries,
    contractBoundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    connector_contract_id: `connector-contract-v2.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    connector_contract_status: summary.connector_contract_status,
    inputs,
    source_artifacts: buildSourceArtifacts(sourceReads),
    connector_interface_schema: interfaceSchema,
    connector_definitions: connectorDefinitions,
    connector_source_contracts: sourceContracts,
    connector_cursor_contracts: cursorContracts,
    connector_external_id_contracts: externalIdContracts,
    connector_auth_boundaries: authBoundaries,
    connector_contract_boundary: contractBoundary,
    connector_contract_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };

  return {
    ...result,
    markdown: renderConnectorContractMarkdown(result),
  };
}

export async function writeConnectorContractV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "connector-contract-v2.json"), serializableConnectorContract(result));
  await writeJson(path.join(outDir, "connector-interface-schema.json"), result.connector_interface_schema);
  await writeJson(path.join(outDir, "connector-definitions.json"), {
    schema_version: "connector-definitions-artifact.v1",
    generated_at: result.generated_at,
    connector_count: result.connector_definitions.length,
    connector_definitions: result.connector_definitions,
  });
  await writeJson(path.join(outDir, "connector-source-contracts.json"), {
    schema_version: "connector-source-contracts-artifact.v1",
    generated_at: result.generated_at,
    source_contract_count: result.connector_source_contracts.length,
    connector_source_contracts: result.connector_source_contracts,
  });
  await writeJson(path.join(outDir, "connector-cursor-contracts.json"), {
    schema_version: "connector-cursor-contracts-artifact.v1",
    generated_at: result.generated_at,
    cursor_contract_count: result.connector_cursor_contracts.length,
    connector_cursor_contracts: result.connector_cursor_contracts,
  });
  await writeJson(path.join(outDir, "connector-external-id-contracts.json"), {
    schema_version: "connector-external-id-contracts-artifact.v1",
    generated_at: result.generated_at,
    external_id_contract_count: result.connector_external_id_contracts.length,
    connector_external_id_contracts: result.connector_external_id_contracts,
  });
  await writeJson(path.join(outDir, "connector-auth-boundaries.json"), {
    schema_version: "connector-auth-boundaries-artifact.v1",
    generated_at: result.generated_at,
    auth_boundary_count: result.connector_auth_boundaries.length,
    connector_auth_boundaries: result.connector_auth_boundaries,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "connector-contract-v2-validation-report.v1",
    generated_at: result.generated_at,
    connector_contract_id: result.connector_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runConnectorContractV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConnectorContractV2(args);
    console.log(`Connector Contract v2 ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.connector_contract_status}`);
    console.log(`Connectors: ${result.summary.connector_count}`);
    console.log(`Source/cursor/external/auth contracts: ${result.summary.source_contract_count}/${result.summary.cursor_contract_count}/${result.summary.external_id_contract_count}/${result.summary.auth_boundary_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function connectorBlueprint({
  connectorId,
  label,
  phaseSlot,
  family,
  sourceSystem,
  sourceKind,
  authMode,
  credentialRefRequired,
  networkAccessRequired,
  leastPrivilegeScopes,
  cursorKind,
  externalIdFields,
  expectedResourceTypes,
  draftOutputConnector = false,
}) {
  return {
    connectorId,
    label,
    phaseSlot,
    family,
    sourceSystem,
    sourceKind,
    authMode,
    credentialRefRequired,
    networkAccessRequired,
    leastPrivilegeScopes,
    cursorKind,
    externalIdFields,
    expectedResourceTypes,
    draftOutputConnector,
  };
}

function buildConnectorInterfaceSchema(generatedAt) {
  return {
    schema_version: INTERFACE_SCHEMA_VERSION,
    generated_at: generatedAt,
    interface_contract_status: "complete",
    required_connector_fields: [
      "connector_id",
      "connector_family",
      "source_system",
      "source_id",
      "cursor",
      "external_id",
      "auth_boundary",
      "tenant_id",
      "matter_id",
      "classification",
      "policy_snapshot_id",
      "review_status",
    ],
    source_id_contract: {
      schema_version: CONNECTOR_SOURCE_SCHEMA_VERSION,
      required_fields: ["source_id", "connector_id", "source_system", "tenant_id", "matter_scope_mode", "source_uri_template"],
      uniqueness_scope: ["tenant_id", "source_system", "source_id"],
      stable_id_rule: "source_id must be deterministic for the connector, tenant, source system, and matter scope.",
    },
    cursor_contract: {
      schema_version: CONNECTOR_CURSOR_SCHEMA_VERSION,
      required_fields: ["cursor_id", "connector_id", "source_id", "cursor_scope", "cursor_state_fields", "resume_supported", "cursor_hash"],
      resumability_rule: "cursor state must be enough to resume without reusing raw credentials or cross-matter state.",
    },
    external_id_contract: {
      schema_version: CONNECTOR_EXTERNAL_ID_SCHEMA_VERSION,
      required_fields: ["external_id_namespace", "external_id_fields", "external_version_id_strategy", "dedupe_key_template"],
      resource_projection_rule: "external_id maps to Resource v2 and external_version_id maps to ResourceVersion v2.",
    },
    auth_boundary_contract: {
      schema_version: CONNECTOR_AUTH_BOUNDARY_SCHEMA_VERSION,
      required_fields: ["auth_boundary_id", "auth_mode", "credential_ref_required", "credential_reference_only", "least_privilege_scopes", "raw_secret_material_allowed"],
      safety_rule: "credentials are references only; connector execution, mutation, final delivery, and legal/client-facing output remain outside this contract.",
    },
  };
}

function buildConnectorDefinitions(generatedAt) {
  return CONNECTOR_BLUEPRINTS.map((blueprint) => ({
    schema_version: "connector-definition.v2",
    connector_id: blueprint.connectorId,
    connector_label: blueprint.label,
    connector_status: "contracted",
    phase_slot: blueprint.phaseSlot,
    connector_family: blueprint.family,
    source_system: blueprint.sourceSystem,
    source_kind: blueprint.sourceKind,
    default_source_id: `source.${blueprint.family}.v2`,
    source_id_required: true,
    cursor_required: true,
    external_id_required: true,
    auth_boundary_required: true,
    tenant_id_required: true,
    matter_id_required: true,
    classification_required: true,
    policy_snapshot_required: true,
    resource_projection_required: true,
    resource_version_projection_required: true,
    expected_resource_types: blueprint.expectedResourceTypes,
    read_only_by_default: true,
    draft_output_connector: blueprint.draftOutputConnector,
    draft_output_allowed: blueprint.draftOutputConnector,
    final_output_allowed: false,
    connector_execution_performed: false,
    mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    raw_secret_material_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    generated_at: generatedAt,
  }));
}

function buildConnectorSourceContracts(connectors, generatedAt) {
  return connectors.map((connector) => ({
    schema_version: CONNECTOR_SOURCE_SCHEMA_VERSION,
    connector_id: connector.connector_id,
    source_id: connector.default_source_id,
    source_contract_status: "contracted",
    source_system: connector.source_system,
    source_kind: connector.source_kind,
    source_id_strategy: "deterministic_connector_source_id",
    source_id_pattern: `source.${connector.connector_family}.v2`,
    tenant_id_required: true,
    matter_id_required: true,
    matter_scope_mode: "per_matter",
    classification_required: true,
    policy_snapshot_required: true,
    source_uri_template: `${connector.source_system}://{tenant_id}/{matter_id}/{external_id}`,
    resource_id_template: `resource.${connector.connector_family}.{external_id_hash}`,
    source_id_stability_hash: hashValue({
      connector_id: connector.connector_id,
      source_system: connector.source_system,
      source_id: connector.default_source_id,
    }),
    generated_at: generatedAt,
  }));
}

function buildConnectorCursorContracts(connectors, generatedAt) {
  return connectors.map((connector) => ({
    schema_version: CONNECTOR_CURSOR_SCHEMA_VERSION,
    connector_id: connector.connector_id,
    source_id: connector.default_source_id,
    cursor_id: `cursor.${connector.connector_family}.v2`,
    cursor_contract_status: "contracted",
    cursor_kind: CONNECTOR_BLUEPRINTS.find((item) => item.connectorId === connector.connector_id)?.cursorKind ?? "connector_cursor",
    cursor_scope: "tenant_matter_source",
    cursor_state_fields: [
      "cursor_id",
      "connector_id",
      "source_id",
      "tenant_id",
      "matter_id",
      "cursor_position",
      "last_seen_external_id",
      "last_seen_at",
      "resume_token_hash",
      "high_watermark",
      "updated_at",
    ],
    resume_supported: true,
    reset_requires_human_review: true,
    cross_matter_cursor_reuse_allowed: false,
    raw_token_material_allowed: false,
    cursor_hash: hashValue({ connector_id: connector.connector_id, source_id: connector.default_source_id, cursor_schema_version: CONNECTOR_CURSOR_SCHEMA_VERSION }),
    generated_at: generatedAt,
  }));
}

function buildConnectorExternalIdContracts(connectors, generatedAt) {
  return connectors.map((connector) => {
    const blueprint = CONNECTOR_BLUEPRINTS.find((item) => item.connectorId === connector.connector_id);
    return {
      schema_version: CONNECTOR_EXTERNAL_ID_SCHEMA_VERSION,
      connector_id: connector.connector_id,
      source_id: connector.default_source_id,
      external_id_contract_status: "contracted",
      external_id_namespace: `${connector.source_system}.${connector.connector_family}`,
      external_id_fields: blueprint?.externalIdFields ?? ["external_id"],
      external_version_id_strategy: "source_version_or_content_hash",
      dedupe_key_template: `${connector.source_system}:{external_id}:{external_version_id}`,
      resource_v2_field: "external_id",
      resource_version_v2_field: "external_version_id",
      source_system_field: "source_system",
      content_hash_required: true,
      stable_hash_required: true,
      missing_external_id_policy: "quarantine_pending_human_review",
      generated_at: generatedAt,
    };
  });
}

function buildConnectorAuthBoundaries(connectors, generatedAt) {
  return connectors.map((connector) => {
    const blueprint = CONNECTOR_BLUEPRINTS.find((item) => item.connectorId === connector.connector_id);
    return {
      schema_version: CONNECTOR_AUTH_BOUNDARY_SCHEMA_VERSION,
      connector_id: connector.connector_id,
      source_id: connector.default_source_id,
      auth_boundary_id: `auth.${connector.connector_family}.v2`,
      auth_boundary_status: "enforced",
      auth_mode: blueprint?.authMode ?? "credential_reference_only",
      credential_ref_required: Boolean(blueprint?.credentialRefRequired),
      credential_reference_only: true,
      raw_secret_material_allowed: false,
      least_privilege_scopes: blueprint?.leastPrivilegeScopes ?? [],
      tenant_binding_required: true,
      matter_binding_required: true,
      policy_snapshot_required: true,
      classification_gate_required: true,
      external_network_access_required_for_runtime: Boolean(blueprint?.networkAccessRequired),
      external_network_access_performed: false,
      connector_execution_performed: false,
      write_operations_allowed: false,
      draft_output_allowed: connector.draft_output_allowed,
      final_output_allowed: false,
      protected_action_allowed: false,
      human_review_required_for_write: true,
      delivery_execution_allowed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      generated_at: generatedAt,
    };
  });
}

function buildContractBoundary(generatedAt) {
  return {
    schema_version: "connector-contract-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    contract_report_only: true,
    connector_execution_performed: false,
    external_network_access_performed: false,
    credential_material_read: false,
    raw_secret_material_allowed: false,
    source_data_ingested: false,
    resource_mutation_performed: false,
    output_delivery_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  finalLedgerText,
  controlPlaneLoopText,
  reviewDashboardText,
  reviewApiText,
  connectorDefinitions,
  sourceContracts,
  cursorContracts,
  externalIdContracts,
  authBoundaries,
  contractBoundary,
}) {
  const connectorCount = connectorDefinitions.length;
  const sourceIds = new Set(sourceContracts.map((item) => item.source_id));
  const externalNamespaces = new Set(externalIdContracts.map((item) => item.external_id_namespace));
  const authIds = new Set(authBoundaries.map((item) => item.auth_boundary_id));
  return [
    checkpoint("sources.complete", sourceReads.resource_contract_freeze.value?.summary?.freeze_status === "complete"
      && sourceReads.resource_store_interface.value?.summary?.resource_store_interface_status === "complete"
      && sourceReads.policy_matrix_catalog.value?.summary?.policy_status === "valid"
      && sourceReads.tool_runtime_policy_enforcement.value?.summary?.tool_runtime_policy_enforcement_status === "complete"
      && sourceReads.creative_document_freeze.value?.summary?.creative_document_freeze_status === "complete", "Connector Contract v2 source artifacts are complete."),
    checkpoint("connectors.coverage", connectorCount === 8, `${connectorCount}/8 planned connector family contract(s) are declared for P268-P275.`),
    checkpoint("source_ids.common", sourceContracts.length === connectorCount && sourceIds.size === connectorCount && sourceContracts.every((item) => item.source_id && item.tenant_id_required && item.matter_id_required), "Every connector has a unique stable source_id contract with tenant/matter scope."),
    checkpoint("cursors.common", cursorContracts.length === connectorCount && cursorContracts.every((item) => item.resume_supported && item.cursor_state_fields.includes("last_seen_external_id") && item.raw_token_material_allowed === false && item.cross_matter_cursor_reuse_allowed === false), "Every connector has a resumable cursor contract without raw token material or cross-matter reuse."),
    checkpoint("external_ids.common", externalIdContracts.length === connectorCount && externalNamespaces.size === connectorCount && externalIdContracts.every((item) => item.external_id_fields.length > 0 && item.resource_v2_field === "external_id" && item.resource_version_v2_field === "external_version_id"), "Every connector has an external_id namespace mapped to Resource v2 and ResourceVersion v2."),
    checkpoint("auth_boundaries.common", authBoundaries.length === connectorCount && authIds.size === connectorCount && authBoundaries.every((item) => item.auth_boundary_status === "enforced" && item.credential_reference_only && item.raw_secret_material_allowed === false && item.least_privilege_scopes.length > 0), "Every connector has an enforced auth boundary with credential references only and least-privilege scopes."),
    checkpoint("policy_boundary.enforced", connectorDefinitions.every((item) => item.matter_id_required && item.classification_required && item.policy_snapshot_required && item.human_review_required), "Every connector contract requires matter, classification, policy snapshot, and human review boundaries."),
    checkpoint("safe_boundary.enforced", contractBoundary.read_only && contractBoundary.connector_execution_performed === false && contractBoundary.credential_material_read === false && contractBoundary.output_delivery_performed === false && contractBoundary.protected_action_executed === false && contractBoundary.legal_advice_generated === false && contractBoundary.client_facing_output_generated === false, "Connector Contract v2 remains read-only and non-executing."),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["connectors:contract-v2"]), "package.json registers connectors:contract-v2."),
    checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("Phase 267") && typeof finalLedgerText === "string" && finalLedgerText.includes("P267") && finalLedgerText.includes("connector contract v2"), "Roadmap and final ledger promote P267 Connector Contract v2."),
    checkpoint("loop.bound", typeof controlPlaneLoopText === "string" && controlPlaneLoopText.includes("connector_contract_v2") && controlPlaneLoopText.includes("connectors:contract-v2"), "Control-plane loop includes Connector Contract v2."),
    checkpoint("dashboard.bound", typeof reviewDashboardText === "string" && reviewDashboardText.includes("connector_contract_v2"), "Review Dashboard includes Connector Contract v2."),
    checkpoint("api.bound", typeof reviewApiText === "string" && reviewApiText.includes("/api/connector-contracts-v2"), "Review API exposes Connector Contract v2 routes."),
  ];
}

function summarizeConnectorContract({ sourceReads, connectorDefinitions, sourceContracts, cursorContracts, externalIdContracts, authBoundaries, contractBoundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  return {
    connector_contract_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    connector_contract_id: CONTRACT_ID,
    interface_schema_version: INTERFACE_SCHEMA_VERSION,
    connector_source_schema_version: CONNECTOR_SOURCE_SCHEMA_VERSION,
    connector_cursor_schema_version: CONNECTOR_CURSOR_SCHEMA_VERSION,
    connector_external_id_schema_version: CONNECTOR_EXTERNAL_ID_SCHEMA_VERSION,
    connector_auth_boundary_schema_version: CONNECTOR_AUTH_BOUNDARY_SCHEMA_VERSION,
    phase_slot: "P267",
    phase_range: "P267-P276",
    next_phase_slot: "P268",
    source_resource_contract_freeze_status: sourceReads.resource_contract_freeze.value?.summary?.freeze_status ?? "unknown",
    source_resource_store_interface_status: sourceReads.resource_store_interface.value?.summary?.resource_store_interface_status ?? "unknown",
    source_policy_matrix_status: sourceReads.policy_matrix_catalog.value?.summary?.policy_status ?? "unknown",
    source_tool_runtime_policy_status: sourceReads.tool_runtime_policy_enforcement.value?.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
    source_creative_document_freeze_status: sourceReads.creative_document_freeze.value?.summary?.creative_document_freeze_status ?? "unknown",
    connector_count: connectorDefinitions.length,
    contracted_connector_count: connectorDefinitions.filter((item) => item.connector_status === "contracted").length,
    source_contract_count: sourceContracts.length,
    cursor_contract_count: cursorContracts.length,
    external_id_contract_count: externalIdContracts.length,
    auth_boundary_count: authBoundaries.length,
    unique_source_id_count: new Set(sourceContracts.map((item) => item.source_id)).size,
    unique_external_id_namespace_count: new Set(externalIdContracts.map((item) => item.external_id_namespace)).size,
    unique_auth_boundary_count: new Set(authBoundaries.map((item) => item.auth_boundary_id)).size,
    resumable_cursor_count: cursorContracts.filter((item) => item.resume_supported).length,
    last_seen_external_id_cursor_count: cursorContracts.filter((item) => item.cursor_state_fields.includes("last_seen_external_id")).length,
    resource_projection_required_count: connectorDefinitions.filter((item) => item.resource_projection_required).length,
    resource_version_projection_required_count: connectorDefinitions.filter((item) => item.resource_version_projection_required).length,
    matter_boundary_required_count: connectorDefinitions.filter((item) => item.matter_id_required).length,
    classification_required_count: connectorDefinitions.filter((item) => item.classification_required).length,
    policy_snapshot_required_count: connectorDefinitions.filter((item) => item.policy_snapshot_required).length,
    credential_reference_only_count: authBoundaries.filter((item) => item.credential_reference_only).length,
    least_privilege_scope_count: authBoundaries.reduce((sum, item) => sum + item.least_privilege_scopes.length, 0),
    credential_ref_required_count: authBoundaries.filter((item) => item.credential_ref_required).length,
    local_or_export_connector_count: authBoundaries.filter((item) => item.credential_ref_required === false).length,
    cloud_runtime_boundary_count: authBoundaries.filter((item) => item.external_network_access_required_for_runtime).length,
    read_only_connector_count: connectorDefinitions.filter((item) => item.read_only_by_default).length,
    draft_output_connector_count: connectorDefinitions.filter((item) => item.draft_output_connector).length,
    mutation_allowed_count: connectorDefinitions.filter((item) => item.mutation_allowed).length,
    raw_secret_material_allowed_count: authBoundaries.filter((item) => item.raw_secret_material_allowed).length,
    connector_execution_performed: contractBoundary.connector_execution_performed,
    external_network_access_performed: contractBoundary.external_network_access_performed,
    credential_material_read: contractBoundary.credential_material_read,
    resource_mutation_performed: contractBoundary.resource_mutation_performed,
    output_delivery_performed: contractBoundary.output_delivery_performed,
    protected_action_executed: contractBoundary.protected_action_executed,
    legal_advice_generated: contractBoundary.legal_advice_generated,
    client_facing_output_generated: contractBoundary.client_facing_output_generated,
    read_only: contractBoundary.read_only,
    contract_report_only: contractBoundary.contract_report_only,
    human_review_required: contractBoundary.human_review_required,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

async function readSources(inputs) {
  return {
    package_json: await readJsonOrError(inputs.package_path),
    roadmap_text: await readTextOrError(inputs.roadmap_path),
    final_ledger_text: await readTextOrError(inputs.final_ledger_path),
    control_plane_loop_text: await readTextOrError(inputs.control_plane_loop_path),
    review_dashboard_text: await readTextOrError(inputs.review_dashboard_path),
    review_api_text: await readTextOrError(inputs.review_api_path),
    resource_contract_freeze: await readJsonOrError(inputs.resource_contract_freeze_path),
    resource_store_interface: await readJsonOrError(inputs.resource_store_interface_path),
    policy_matrix_catalog: await readJsonOrError(inputs.policy_matrix_catalog_path),
    tool_runtime_policy_enforcement: await readJsonOrError(inputs.tool_runtime_policy_enforcement_path),
    creative_document_freeze: await readJsonOrError(inputs.creative_document_freeze_path),
  };
}

function buildSourceArtifacts(sourceReads) {
  return Object.fromEntries(Object.entries(sourceReads)
    .filter(([key]) => !key.endsWith("_text") && key !== "package_json")
    .map(([key, read]) => [key, {
      source_status: read.error ? "missing" : "available",
      schema_version: read.value?.schema_version ?? null,
      summary_status: statusFromSummary(read.value?.summary ?? {}),
      error: read.error ?? null,
      content_hash: read.value ? hashValue(read.value) : null,
    }]));
}

function statusFromSummary(summary) {
  return summary.connector_contract_status
    ?? summary.creative_document_freeze_status
    ?? summary.tool_runtime_policy_enforcement_status
    ?? summary.resource_store_interface_status
    ?? summary.freeze_status
    ?? summary.policy_status
    ?? "unknown";
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path ?? item.checkpoint_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
    items,
    failed_count: errors.length,
  };
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.roadmapPath),
    final_ledger_path: path.resolve(options.finalLedgerPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.finalLedgerPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.controlPlaneLoopPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.reviewApiPath),
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.resourceContractFreezePath),
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.resourceStoreInterfacePath),
    policy_matrix_catalog_path: path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.policyMatrixCatalogPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.toolRuntimePolicyEnforcementPath),
    creative_document_freeze_path: path.resolve(options.creativeDocumentFreezePath ?? DEFAULT_CONNECTOR_CONTRACT_V2_INPUTS.creativeDocumentFreezePath),
  };
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      path: filePath,
      value: JSON.parse(text),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      value: null,
      error: `${error.code ?? "ERROR"}: ${error.message}`,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      path: filePath,
      value: await readFileWithRetry(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      value: "",
      error: `${error.code ?? "ERROR"}: ${error.message}`,
    };
  }
}

async function readFileWithRetry(filePath, encoding) {
  let lastError;
  const attempts = process.platform === "win32" ? 3 : 1;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EISDIR", "ENOENT", "EBUSY", "EPERM"].includes(error.code) || index === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 150 * (index + 1)));
    }
  }
  throw lastError;
}

function renderConnectorContractMarkdown(result) {
  const lines = [];
  lines.push("# Connector Contract v2");
  lines.push("");
  lines.push(`- Status: ${result.summary.connector_contract_status}`);
  lines.push(`- Connectors: ${result.summary.contracted_connector_count}/${result.summary.connector_count}`);
  lines.push(`- Source contracts: ${result.summary.source_contract_count}`);
  lines.push(`- Cursor contracts: ${result.summary.cursor_contract_count}`);
  lines.push(`- External ID contracts: ${result.summary.external_id_contract_count}`);
  lines.push(`- Auth boundaries: ${result.summary.auth_boundary_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Connector Families");
  for (const connector of result.connector_definitions) {
    lines.push(`- ${connector.connector_id}: ${connector.connector_status}, source=${connector.default_source_id}, phase=${connector.phase_slot}`);
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push("- Connector execution performed: false");
  lines.push("- Credential material read: false");
  lines.push("- Raw secret material allowed: false");
  lines.push("- Output delivery performed: false");
  lines.push("- Legal advice generated: false");
  lines.push("- Client-facing output generated: false");
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  lines.push("");
  return lines.join("\n");
}

function serializableConnectorContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--final-ledger") parsed.finalLedgerPath = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--creative-document-freeze") parsed.creativeDocumentFreezePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/connector-contract-v2.mjs [options]

Options:
  --check                         Fail if validation fails.
  --out-dir <folder>              Output directory.
  --run-at <iso>                  Deterministic generated_at timestamp.
  --resource-contract-freeze <p>  Resource contract freeze artifact.
  --resource-store-interface <p>  Resource store interface artifact.
  --policy-matrix <p>             Policy matrix artifact.
  --tool-runtime-policy <p>       Tool/runtime policy artifact.
  --creative-document-freeze <p>  Creative Document freeze artifact.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runConnectorContractV2Cli();
}
