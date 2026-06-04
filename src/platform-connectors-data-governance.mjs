import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformMemoryEventObservabilityPlane } from "./platform-memory-event-observability-plane.mjs";

export const DEFAULT_PLATFORM_CONNECTORS_DATA_GOVERNANCE_OUT_DIR = "artifacts/platform-connectors-data-governance/latest";
export const DEFAULT_PLATFORM_CONNECTORS_DATA_GOVERNANCE_INPUTS = {
  schemaPath: "schemas/platform-connectors-data-governance.schema.json",
  packagePath: "package.json",
  memoryEventLedgerPath: "docs/hermes-memory-event-observability-plane.md",
  connectorsGovernanceLedgerPath: "docs/hermes-connectors-data-governance.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:connectors-data-governance";
const SOURCE_COMMAND_NAME = "platform:memory-event-observability-plane";
const SCHEMA_VERSION = "platform-connectors-data-governance.v1";
const CAPABILITY_ID = "platform.connectors_data_governance";
const READY_STATUS = "ready_for_platform_connectors_data_governance";
const SOURCE_READY_STATUS = "ready_for_platform_memory_event_observability_plane";
const PROGRAM_RANGE = "P2721-P2880";
const PHASE_RANGE = "P2721-P2880";
const PHASE_SLOT = "P2721";
const PREVIOUS_PHASE_SLOT = "P2720";
const NEXT_PHASE_SLOT = "P2881";

const COMPONENT_SPECS = [
  ["connector_preflight_contract", "Connector preflight and source registry contract"],
  ["source_registry_contract", "Source registry, auth handle, and scope contract"],
  ["ingestion_quarantine_contract", "Ingestion quarantine and redacted summary contract"],
  ["classification_policy_contract", "Classification, sensitivity, retention, and privilege contract"],
  ["evidence_span_contract", "Evidence span, citation, confidence, and freshness contract"],
  ["retrieval_first_recall_contract", "Retrieval-first recall and no bulk export contract"],
  ["connector_write_block_contract", "Connector write, secret lookup, and destructive sync block contract"],
  ["domain_pack_handoff_contract", "P2881 domain pack ecosystem handoff contract"],
];

const CONNECTOR_REGISTRY_SPECS = [
  ["github", "GitHub repository, issue, pull request, and release metadata connector"],
  ["issue_tracker", "Issue tracker and project management connector"],
  ["mail_calendar", "Mail and calendar connector"],
  ["drive_files", "Drive, document, spreadsheet, and slide connector"],
  ["resource_upload", "User-provided resource and file upload connector"],
  ["external_project_checkout", "External project checkout and source snapshot connector"],
];

const PREFLIGHT_SPECS = [
  ["auth_handle", "Auth handle and secret boundary preflight"],
  ["scope_manifest", "Source scope and domain boundary preflight"],
  ["rate_limit_policy", "Rate limit and retry policy preflight"],
  ["raw_material_policy", "Raw material, privilege, and PII policy preflight"],
  ["domain_boundary", "Domain, tenant, and matter/project boundary preflight"],
  ["health_check", "Connector health and capability check preflight"],
];

const QUARANTINE_SPECS = [
  ["raw_capture_handle", "Raw capture handle without raw export"],
  ["redacted_summary", "Redacted summary and evidence reference"],
  ["quarantine_bucket", "Quarantine bucket and release gate"],
  ["dedupe_hash", "Dedupe hash and source identity"],
  ["source_status", "Source status and freshness marker"],
  ["release_gate", "Human review gate for quarantine release"],
];

const CLASSIFICATION_SPECS = [
  ["domain_classification", "Domain and workflow classification"],
  ["sensitivity_classification", "Confidential, privileged, restricted, or public classification"],
  ["retention_classification", "Retention and deletion policy classification"],
  ["privilege_classification", "Legal privilege and work-product classification"],
  ["pii_secret_classification", "PII, secret, credential, and token classification"],
  ["actionability_classification", "Read-only evidence, work order, or protected action classification"],
];

const EVIDENCE_SPAN_SPECS = [
  ["source_span", "Source span and location reference"],
  ["excerpt_hash", "Excerpt hash without uncontrolled raw reproduction"],
  ["citation", "Citation and source reference"],
  ["confidence", "Confidence, conflict, and reviewer note"],
  ["freshness", "Freshness timestamp and stale-risk note"],
  ["owner", "Responsible owner and PASS authority note"],
];

const RETRIEVAL_POLICY_SPECS = [
  ["retrieval_first", "Retrieve relevant spans before generative summary"],
  ["grounded_recall", "Recall only with citations and source status"],
  ["no_bulk_export", "Block bulk raw export by default"],
  ["result_redaction", "Redact query results before evidence persistence"],
  ["reviewer_gate", "Require reviewer gate before using sensitive connector evidence"],
];

const CONNECTOR_ACTION_BLOCK_SPECS = [
  ["connector_write", "Connector write and mutation"],
  ["raw_export", "Bulk raw export"],
  ["secret_lookup", "Secret, token, and credential lookup"],
  ["destructive_sync", "Delete, overwrite, archive, or destructive sync"],
  ["cross_domain_transfer", "Cross-domain, cross-matter, or cross-project transfer"],
];

const HANDOFF_SPECS = [
  ["p2881_domain_pack_ecosystem", "P2881-P3040", "Domain pack ecosystem can consume connector governance and evidence span contracts."],
  ["p3041_production_freeze", "P3041-P3200", "Production freeze can verify connector quarantine, classification, and raw export blocks."],
  ["p3200_work_os_freeze", "P3200", "Final Work OS freeze can verify connector governance stayed evidence-first."],
];

export async function runPlatformConnectorsDataGovernance(options = {}) {
  const result = await buildPlatformConnectorsDataGovernance(options);
  if (options.write !== false) await writePlatformConnectorsDataGovernance(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform connectors data governance failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformConnectorsDataGovernance(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CONNECTORS_DATA_GOVERNANCE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const memoryEventLedger = await readTextSource(inputs.memory_event_ledger_path);
  const connectorsGovernanceLedger = await readTextSource(inputs.connectors_governance_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceMemoryEvent = options.sourceMemoryEvent ?? await buildPlatformMemoryEventObservabilityPlane({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    memoryEventLedgerPath: inputs.memory_event_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const connectorRegistryRows = buildConnectorRegistryRows();
  const preflightRows = buildPreflightRows();
  const quarantineRows = buildQuarantineRows();
  const classificationRows = buildClassificationRows();
  const evidenceSpanRows = buildEvidenceSpanRows();
  const retrievalPolicyRows = buildRetrievalPolicyRows();
  const connectorActionBlockRows = buildConnectorActionBlockRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, memoryEventLedger, connectorsGovernanceLedger, roadmapDoc, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows });
  const guardRows = buildGuardRows({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows });
  const boundary = buildBoundary({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, memoryEventLedger, connectorsGovernanceLedger, roadmapDoc, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_connectors_data_governance_id: `platform-connectors-data-governance.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    connectors_data_governance_anchor: anchor,
    source_memory_event_observability_plane_summary: sourceMemoryEvent.summary,
    connectors_data_governance_manifest: manifest,
    connectors_governance_component_rows: componentRows,
    connector_registry_rows: connectorRegistryRows,
    connector_preflight_rows: preflightRows,
    ingestion_quarantine_rows: quarantineRows,
    classification_policy_rows: classificationRows,
    evidence_span_rows: evidenceSpanRows,
    retrieval_policy_rows: retrievalPolicyRows,
    connector_action_block_rows: connectorActionBlockRows,
    connectors_governance_handoff_rows: handoffRows,
    connectors_governance_guard_rows: guardRows,
    connectors_governance_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_connectors_data_governance")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_connectors_data_governance_id = result.platform_connectors_data_governance_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformConnectorsDataGovernance(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-connectors-data-governance.json"), serializableResult(result));
  await writeJson(path.join(outDir, "connectors-data-governance-manifest.json"), result.connectors_data_governance_manifest);
  await writeJson(path.join(outDir, "connectors-governance-component-rows.json"), collectionEnvelope("connectors-governance-component-rows.v1", "connectors_governance_component_rows", result.connectors_governance_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-registry-rows.json"), collectionEnvelope("connector-registry-rows.v1", "connector_registry_rows", result.connector_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-preflight-rows.json"), collectionEnvelope("connector-preflight-rows.v1", "connector_preflight_rows", result.connector_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-quarantine-rows.json"), collectionEnvelope("ingestion-quarantine-rows.v1", "ingestion_quarantine_rows", result.ingestion_quarantine_rows, result.generated_at));
  await writeJson(path.join(outDir, "classification-policy-rows.json"), collectionEnvelope("classification-policy-rows.v1", "classification_policy_rows", result.classification_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-span-rows.json"), collectionEnvelope("evidence-span-rows.v1", "evidence_span_rows", result.evidence_span_rows, result.generated_at));
  await writeJson(path.join(outDir, "retrieval-policy-rows.json"), collectionEnvelope("retrieval-policy-rows.v1", "retrieval_policy_rows", result.retrieval_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-action-block-rows.json"), collectionEnvelope("connector-action-block-rows.v1", "connector_action_block_rows", result.connector_action_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "connectors-governance-handoff-rows.json"), collectionEnvelope("connectors-governance-handoff-rows.v1", "connectors_governance_handoff_rows", result.connectors_governance_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "connectors-governance-guard-rows.json"), collectionEnvelope("connectors-governance-guard-rows.v1", "connectors_governance_guard_rows", result.connectors_governance_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "connectors-governance-boundary.json"), result.connectors_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-connectors-data-governance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformConnectorsDataGovernanceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformConnectorsDataGovernance(args);
    console.log(`Platform connectors data governance ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_connectors_data_governance_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Connectors: ${result.summary.connector_registry_count}`);
    console.log(`Preflight rows: ${result.summary.preflight_count}`);
    console.log(`Quarantine rows: ${result.summary.quarantine_count}`);
    console.log(`Evidence spans: ${result.summary.evidence_span_count}`);
    console.log(`P2881 handoff ready: ${result.summary.p2881_ready_as_next_goal}`);
    console.log(`Connector connected now: ${result.summary.connector_connection_opened_now}`);
    console.log(`Raw export performed now: ${result.summary.raw_export_performed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "connectors-governance-component-row.v1",
    row_id: `connectors.governance.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.connectors.component.${componentId}`,
    reviewer_ref: "reviewer.platform_connectors",
    hard_gate_ref: `gate.platform.connectors.component.${componentId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "preserve as P2881 domain pack ecosystem precondition",
  }));
}

function buildConnectorRegistryRows() {
  return CONNECTOR_REGISTRY_SPECS.map(([connectorId, description], index) => passRow({
    schema_version: "connector-registry-row.v1",
    row_id: `connector.registry.row.${String(index + 1).padStart(2, "0")}`,
    connector_id: connectorId,
    connector_status: "registry_contract",
    description,
    connection_opened_now: false,
    ingestion_started_now: false,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    evidence_ref: `evidence.platform.connectors.registry.${connectorId}`,
    reviewer_ref: "reviewer.platform_connector_registry",
    hard_gate_ref: `gate.platform.connectors.registry.${connectorId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "run preflight before any connector connection",
  }));
}

function buildPreflightRows() {
  return PREFLIGHT_SPECS.map(([preflightId, description], index) => passRow({
    schema_version: "connector-preflight-row.v1",
    row_id: `connector.preflight.row.${String(index + 1).padStart(2, "0")}`,
    preflight_id: preflightId,
    preflight_status: "required_before_connection",
    description,
    preflight_required: true,
    preflight_run_now: false,
    auth_handle_required: true,
    scope_required: true,
    raw_material_policy_required: true,
    evidence_ref: `evidence.platform.connectors.preflight.${preflightId}`,
    reviewer_ref: "reviewer.platform_connector_preflight",
    hard_gate_ref: `gate.platform.connectors.preflight.${preflightId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "complete preflight before connector health or ingestion",
  }));
}

function buildQuarantineRows() {
  return QUARANTINE_SPECS.map(([quarantineId, description], index) => passRow({
    schema_version: "ingestion-quarantine-row.v1",
    row_id: `ingestion.quarantine.row.${String(index + 1).padStart(2, "0")}`,
    quarantine_id: quarantineId,
    quarantine_status: "required_before_release",
    description,
    ingestion_started_now: false,
    quarantine_required: true,
    redacted_summary_required: true,
    release_requires_human_review: true,
    raw_material_released_now: false,
    evidence_ref: `evidence.platform.connectors.quarantine.${quarantineId}`,
    reviewer_ref: "reviewer.platform_connector_quarantine",
    hard_gate_ref: `gate.platform.connectors.quarantine.${quarantineId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "quarantine before evidence span release",
  }));
}

function buildClassificationRows() {
  return CLASSIFICATION_SPECS.map(([classificationId, description], index) => passRow({
    schema_version: "classification-policy-row.v1",
    row_id: `classification.policy.row.${String(index + 1).padStart(2, "0")}`,
    classification_id: classificationId,
    classification_status: "required_before_retrieval",
    description,
    classification_required: true,
    sensitivity_required: true,
    retention_required: true,
    domain_boundary_required: true,
    classified_now: false,
    evidence_ref: `evidence.platform.connectors.classification.${classificationId}`,
    reviewer_ref: "reviewer.platform_connector_classification",
    hard_gate_ref: `gate.platform.connectors.classification.${classificationId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "classify before retrieval or memory recall",
  }));
}

function buildEvidenceSpanRows() {
  return EVIDENCE_SPAN_SPECS.map(([spanId, description], index) => passRow({
    schema_version: "evidence-span-row.v1",
    row_id: `evidence.span.row.${String(index + 1).padStart(2, "0")}`,
    span_id: spanId,
    span_status: "required_for_connector_evidence",
    description,
    evidence_span_required: true,
    citation_required: true,
    freshness_required: true,
    confidence_required: true,
    raw_excerpt_allowed: false,
    evidence_ref: `evidence.platform.connectors.span.${spanId}`,
    reviewer_ref: "reviewer.platform_connector_span",
    hard_gate_ref: `gate.platform.connectors.span.${spanId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "use spans only through retrieval-first recall",
  }));
}

function buildRetrievalPolicyRows() {
  return RETRIEVAL_POLICY_SPECS.map(([policyId, description], index) => passRow({
    schema_version: "retrieval-policy-row.v1",
    row_id: `retrieval.policy.row.${String(index + 1).padStart(2, "0")}`,
    policy_id: policyId,
    policy_status: "required_before_recall",
    description,
    retrieval_first_required: true,
    grounded_recall_required: true,
    bulk_raw_export_allowed: false,
    result_redaction_required: true,
    reviewer_gate_required: true,
    retrieval_performed_now: false,
    evidence_ref: `evidence.platform.connectors.retrieval.${policyId}`,
    reviewer_ref: "reviewer.platform_connector_retrieval",
    hard_gate_ref: `gate.platform.connectors.retrieval.${policyId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "retrieve spans before any generative connector summary",
  }));
}

function buildConnectorActionBlockRows() {
  return CONNECTOR_ACTION_BLOCK_SPECS.map(([blockedActionId, description], index) => passRow({
    schema_version: "connector-action-block-row.v1",
    row_id: `connector.action.block.row.${String(index + 1).padStart(2, "0")}`,
    blocked_action_id: blockedActionId,
    block_status: "blocked_by_default",
    description,
    blocked_now: true,
    human_receipt_required_to_reconsider: true,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    cross_domain_transfer_allowed_now: false,
    evidence_ref: `evidence.platform.connectors.block.${blockedActionId}`,
    reviewer_ref: "reviewer.platform_connector_block",
    hard_gate_ref: `gate.platform.connectors.block.${blockedActionId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "keep blocked until a later explicit protected-action program",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "connectors-governance-handoff-row.v1",
    row_id: `connectors.governance.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    domain_pack_install_enabled_by_handoff: false,
    production_ready_enabled_by_handoff: false,
    connector_write_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.connectors.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_connectors_handoff",
    hard_gate_ref: `gate.platform.connectors.handoff.${handoffId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: "consume in later phase without treating handoff as install, write, or production permission",
  }));
}

function buildAnchor({ packageJson, memoryEventLedger, connectorsGovernanceLedger, roadmapDoc, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows }) {
  return {
    schema_version: "connectors-data-governance-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    memory_event_ledger_present: memoryEventLedger.available,
    connectors_governance_ledger_present: connectorsGovernanceLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_memory_event_status: sourceMemoryEvent.summary.platform_memory_event_observability_plane_status,
    source_connector_ingestion_allowed_now: sourceMemoryEvent.summary.connector_ingestion_allowed_now,
    source_raw_material_access_allowed_now: sourceMemoryEvent.summary.raw_material_access_allowed_now,
    component_count: componentRows.length,
    connector_registry_count: connectorRegistryRows.length,
    preflight_count: preflightRows.length,
    quarantine_count: quarantineRows.length,
    classification_count: classificationRows.length,
    evidence_span_count: evidenceSpanRows.length,
    retrieval_policy_count: retrievalPolicyRows.length,
    action_block_count: connectorActionBlockRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows }) {
  return {
    schema_version: "connectors-data-governance-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_memory_event_status: sourceMemoryEvent.summary.platform_memory_event_observability_plane_status,
    component_count: componentRows.length,
    connector_registry_count: connectorRegistryRows.length,
    preflight_count: preflightRows.length,
    quarantine_count: quarantineRows.length,
    classification_count: classificationRows.length,
    evidence_span_count: evidenceSpanRows.length,
    retrieval_policy_count: retrievalPolicyRows.length,
    action_block_count: connectorActionBlockRows.length,
    handoff_count: handoffRows.length,
    connectors_governance_contract_ready: true,
    retrieval_first_contract_ready: true,
    quarantine_contract_ready: true,
    next_allowed_action: "start P2881-P3040 domain pack ecosystem planning",
  };
}

function buildGuardRows({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows }) {
  const guards = [
    ["source_memory_event_ready", sourceMemoryEvent.summary.platform_memory_event_observability_plane_status === SOURCE_READY_STATUS, "Source memory event plane must be ready"],
    ["source_still_no_connector_or_raw", sourceMemoryEvent.summary.connector_ingestion_allowed_now === false && sourceMemoryEvent.summary.raw_material_access_allowed_now === false, "Source must not enable connector ingestion or raw material access"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All connector governance components must pass"],
    ["connectors_not_connected", connectorRegistryRows.length === 6 && connectorRegistryRows.every((row) => row.connection_opened_now === false && row.connector_write_allowed_now === false), "Connector registry rows must not connect or write"],
    ["preflight_required_not_run", preflightRows.length === 6 && preflightRows.every((row) => row.preflight_required === true && row.preflight_run_now === false), "Preflight rows must be required and not run now"],
    ["quarantine_required_no_release", quarantineRows.length === 6 && quarantineRows.every((row) => row.quarantine_required === true && row.raw_material_released_now === false), "Quarantine rows must block raw release"],
    ["classification_required", classificationRows.length === 6 && classificationRows.every((row) => row.classification_required === true && row.classified_now === false), "Classification rows must be required"],
    ["evidence_spans_cited_no_raw", evidenceSpanRows.length === 6 && evidenceSpanRows.every((row) => row.citation_required === true && row.raw_excerpt_allowed === false), "Evidence spans must cite without raw excerpts"],
    ["retrieval_first_no_bulk", retrievalPolicyRows.length === 5 && retrievalPolicyRows.every((row) => row.retrieval_first_required === true && row.bulk_raw_export_allowed === false), "Retrieval policies must block bulk export"],
    ["actions_blocked", connectorActionBlockRows.length === 5 && connectorActionBlockRows.every((row) => row.blocked_now === true && row.connector_write_allowed_now === false), "Connector protected actions must remain blocked"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.domain_pack_install_enabled_by_handoff === false && row.connector_write_enabled_by_handoff === false), "Handoffs must not enable install or connector write"],
    ["no_connector_execution_now", true, "This contract does not connect, ingest, export, write, sync, or read secrets"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "connectors-governance-guard-row.v1",
    row_id: `connectors.governance.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.connectors.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_connectors_guard",
    hard_gate_ref: `gate.platform.connectors.guard.${guardId}`,
    responsible_owner: "platform_connector_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2880 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceMemoryEvent.summary.platform_memory_event_observability_plane_status !== SOURCE_READY_STATUS,
    sourceMemoryEvent.summary.connector_ingestion_allowed_now,
    sourceMemoryEvent.summary.raw_material_access_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    connectorRegistryRows.some((row) => row.connection_opened_now || row.ingestion_started_now || row.connector_write_allowed_now || row.secret_read_allowed_now || row.raw_export_allowed_now),
    preflightRows.some((row) => !row.preflight_required || row.preflight_run_now),
    quarantineRows.some((row) => !row.quarantine_required || row.ingestion_started_now || row.raw_material_released_now),
    classificationRows.some((row) => !row.classification_required || row.classified_now === true),
    evidenceSpanRows.some((row) => !row.citation_required || row.raw_excerpt_allowed),
    retrievalPolicyRows.some((row) => !row.retrieval_first_required || row.bulk_raw_export_allowed || row.retrieval_performed_now),
    connectorActionBlockRows.some((row) => !row.blocked_now || row.connector_write_allowed_now || row.secret_read_allowed_now || row.raw_export_allowed_now || row.cross_domain_transfer_allowed_now),
    handoffRows.some((row) => row.domain_pack_install_enabled_by_handoff || row.production_ready_enabled_by_handoff || row.connector_write_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "connectors-governance-boundary.v1",
    source_memory_event_status: sourceMemoryEvent.summary.platform_memory_event_observability_plane_status,
    connectors_governance_contract_ready: true,
    retrieval_first_contract_ready: true,
    quarantine_contract_ready: true,
    connector_connection_opened_now: false,
    preflight_run_now: false,
    ingestion_started_now: false,
    classification_performed_now: false,
    retrieval_performed_now: false,
    raw_export_performed_now: false,
    connector_write_allowed_now: false,
    secret_read_allowed_now: false,
    cross_domain_transfer_allowed_now: false,
    raw_material_access_allowed_now: false,
    domain_pack_install_allowed_now: false,
    production_ready_allowed_now: false,
    p2881_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, memoryEventLedger, connectorsGovernanceLedger, roadmapDoc, sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:connectors-data-governance"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:connectors-data-governance -- --check"),
    validationItem("source.memory_event", "source_ready", sourceMemoryEvent.summary.platform_memory_event_observability_plane_status === SOURCE_READY_STATUS, "source memory event plane must be ready"),
    validationItem("source.no_connector_raw", "source_ready", sourceMemoryEvent.summary.connector_ingestion_allowed_now === false && sourceMemoryEvent.summary.raw_material_access_allowed_now === false, "source must not enable connector ingestion or raw material access"),
    validationItem("ledger.memory_event", "ledger", memoryEventLedger.available && memoryEventLedger.text.includes(SOURCE_COMMAND_NAME), "memory event ledger must be present"),
    validationItem("ledger.connectors", "ledger", connectorsGovernanceLedger.available && connectorsGovernanceLedger.text.includes("P2721-P2880") && connectorsGovernanceLedger.text.includes(COMMAND_NAME), "connectors governance ledger must be present"),
    validationItem("roadmap.connectors", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2721-P2880") && roadmapDoc.text.includes("Connectors and Data Governance"), "roadmap must reflect connectors and data governance"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all connector governance component rows must exist"),
    validationItem("connectors.count", "connector_rows", connectorRegistryRows.length === 6, "all connector registry rows must exist"),
    validationItem("preflight.count", "preflight_rows", preflightRows.length === 6, "all connector preflight rows must exist"),
    validationItem("quarantine.count", "quarantine_rows", quarantineRows.length === 6, "all quarantine rows must exist"),
    validationItem("classification.count", "classification_rows", classificationRows.length === 6, "all classification rows must exist"),
    validationItem("spans.count", "evidence_span_rows", evidenceSpanRows.length === 6, "all evidence span rows must exist"),
    validationItem("retrieval.count", "retrieval_rows", retrievalPolicyRows.length === 5, "all retrieval policy rows must exist"),
    validationItem("blocks.count", "block_rows", connectorActionBlockRows.length === 5, "all connector action block rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all connector governance handoff rows must exist"),
    validationItem("connectors.not_open", "unsafe_invariants", connectorRegistryRows.every((row) => row.connection_opened_now === false && row.connector_write_allowed_now === false), "connectors must not connect or write now"),
    validationItem("raw.blocked", "unsafe_invariants", connectorActionBlockRows.every((row) => row.raw_export_allowed_now === false && row.secret_read_allowed_now === false), "raw export and secret read must remain blocked"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all connector governance guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_connector_execution", "unsafe_invariants", boundary.connector_connection_opened_now === false && boundary.ingestion_started_now === false && boundary.raw_export_performed_now === false, "connector governance must not connect, ingest, or export now"),
  ];
}

function buildSummary({ sourceMemoryEvent, componentRows, connectorRegistryRows, preflightRows, quarantineRows, classificationRows, evidenceSpanRows, retrievalPolicyRows, connectorActionBlockRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-connectors-data-governance-summary.v1",
    platform_connectors_data_governance_status: validation.valid && boundary.p2881_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_memory_event_status: sourceMemoryEvent.summary.platform_memory_event_observability_plane_status,
    component_count: componentRows.length,
    connector_registry_count: connectorRegistryRows.length,
    preflight_count: preflightRows.length,
    quarantine_count: quarantineRows.length,
    classification_count: classificationRows.length,
    evidence_span_count: evidenceSpanRows.length,
    retrieval_policy_count: retrievalPolicyRows.length,
    action_block_count: connectorActionBlockRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    connectors_governance_contract_ready: boundary.connectors_governance_contract_ready,
    retrieval_first_contract_ready: boundary.retrieval_first_contract_ready,
    quarantine_contract_ready: boundary.quarantine_contract_ready,
    p2881_ready_as_next_goal: boundary.p2881_ready_as_next_goal,
    connector_connection_opened_now: boundary.connector_connection_opened_now,
    preflight_run_now: boundary.preflight_run_now,
    ingestion_started_now: boundary.ingestion_started_now,
    classification_performed_now: boundary.classification_performed_now,
    retrieval_performed_now: boundary.retrieval_performed_now,
    raw_export_performed_now: boundary.raw_export_performed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    secret_read_allowed_now: boundary.secret_read_allowed_now,
    cross_domain_transfer_allowed_now: boundary.cross_domain_transfer_allowed_now,
    raw_material_access_allowed_now: boundary.raw_material_access_allowed_now,
    domain_pack_install_allowed_now: boundary.domain_pack_install_allowed_now,
    production_ready_allowed_now: boundary.production_ready_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Connectors and Data Governance",
    "",
    `Status: ${result.summary.platform_connectors_data_governance_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source memory event status: ${result.summary.source_memory_event_status}`,
    `Components: ${result.summary.component_count}`,
    `Connectors: ${result.summary.connector_registry_count}`,
    `Preflight rows: ${result.summary.preflight_count}`,
    `Quarantine rows: ${result.summary.quarantine_count}`,
    `Classification rows: ${result.summary.classification_count}`,
    `Evidence spans: ${result.summary.evidence_span_count}`,
    `Retrieval policies: ${result.summary.retrieval_policy_count}`,
    `Action blocks: ${result.summary.action_block_count}`,
    `P2881 ready as next goal: ${result.summary.p2881_ready_as_next_goal}`,
    `Connector connected now: ${result.summary.connector_connection_opened_now}`,
    `Ingestion started now: ${result.summary.ingestion_started_now}`,
    `Raw export performed now: ${result.summary.raw_export_performed_now}`,
    `Connector write allowed now: ${result.summary.connector_write_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2881-P3040 Domain Pack Ecosystem. This program defines connector preflight, quarantine, classification, evidence span, and retrieval-first contracts, but it does not connect services, ingest resources, export raw material, read secrets, or write back to connectors.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_CONNECTORS_DATA_GOVERNANCE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    memory_event_ledger_path: options.memoryEventLedgerPath ?? defaults.memoryEventLedgerPath,
    connectors_governance_ledger_path: options.connectorsGovernanceLedgerPath ?? defaults.connectorsGovernanceLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    memoryEventLedgerPath: undefined,
    connectorsGovernanceLedgerPath: undefined,
    roadmapDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--memory-event-ledger") {
      args.memoryEventLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--connectors-governance-ledger") {
      args.connectorsGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-connectors-data-governance.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --memory-event-ledger <path>
  --connectors-governance-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
