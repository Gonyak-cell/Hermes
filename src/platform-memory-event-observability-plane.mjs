import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformControlledWriteOperatorConsoleV2 } from "./platform-controlled-write-operator-console-v2.mjs";

export const DEFAULT_PLATFORM_MEMORY_EVENT_OBSERVABILITY_PLANE_OUT_DIR = "artifacts/platform-memory-event-observability-plane/latest";
export const DEFAULT_PLATFORM_MEMORY_EVENT_OBSERVABILITY_PLANE_INPUTS = {
  schemaPath: "schemas/platform-memory-event-observability-plane.schema.json",
  packagePath: "package.json",
  controlledWriteLedgerPath: "docs/hermes-controlled-write-operator-console-v2.md",
  memoryEventLedgerPath: "docs/hermes-memory-event-observability-plane.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:memory-event-observability-plane";
const SOURCE_COMMAND_NAME = "platform:controlled-write-operator-console-v2";
const SCHEMA_VERSION = "platform-memory-event-observability-plane.v1";
const CAPABILITY_ID = "platform.memory_event_observability_plane";
const READY_STATUS = "ready_for_platform_memory_event_observability_plane";
const SOURCE_READY_STATUS = "ready_for_platform_controlled_write_operator_console_v2";
const PROGRAM_RANGE = "P2561-P2720";
const PHASE_RANGE = "P2561-P2720";
const PHASE_SLOT = "P2561";
const PREVIOUS_PHASE_SLOT = "P2560";
const NEXT_PHASE_SLOT = "P2721";

const COMPONENT_SPECS = [
  ["append_only_event_store_contract", "Append-only event store contract"],
  ["object_store_artifact_contract", "Object store and artifact reference contract"],
  ["trace_audit_cost_contract", "Trace, audit, cost, and latency observability contract"],
  ["memory_bank_recall_contract", "Grounded Memory Bank recall contract"],
  ["evidence_index_contract", "Evidence index and source status contract"],
  ["grounded_search_contract", "Grounded search and citation contract"],
  ["retention_backup_restore_contract", "Retention, backup, restore, and domain partition contract"],
  ["connector_handoff_contract", "P2721 connector governance handoff contract"],
];

const EVENT_STORE_SPECS = [
  ["phase_event_append", "Phase status and transition event"],
  ["claim_event", "Claim and completion assertion event"],
  ["evidence_event", "Evidence reference and artifact event"],
  ["receipt_event", "Human receipt lifecycle event"],
  ["review_event", "Reviewer verdict and PASS/BLOCK event"],
  ["gate_event", "Hard gate evaluation event"],
  ["closeout_event", "Closeout and next-condition event"],
];

const OBJECT_STORE_SPECS = [
  ["artifact_blob", "Artifact object and hash reference"],
  ["redacted_evidence_blob", "Redacted evidence object reference"],
  ["diff_packet_blob", "Diff review packet object reference"],
  ["receipt_blob", "Receipt packet object reference"],
  ["log_summary_blob", "Redacted log summary object reference"],
  ["snapshot_blob", "Pre/post snapshot object reference"],
];

const OBSERVABILITY_SPECS = [
  ["trace_id", "Trace identifier for phase, command, or workflow run"],
  ["audit_actor", "Actor, owner, and reviewer audit fields"],
  ["cost_meter", "Cost and token usage ledger field"],
  ["latency_metric", "Latency and duration metric field"],
  ["failure_reason", "Failure reason and blocked reason metric field"],
  ["unsafe_flag_count", "Unsafe flag and hard gate summary metric field"],
];

const MEMORY_OPERATION_SPECS = [
  ["archive", "Archive source and phase evidence into memory-ready records"],
  ["sync", "Sync event and object references into a memory index"],
  ["index", "Index evidence, receipts, reviews, and gates"],
  ["search", "Search grounded memory records by source status and domain"],
  ["extract", "Extract structured facts and next conditions from evidence"],
  ["consolidate", "Consolidate repeated facts with citations and conflict notes"],
  ["relate", "Relate claims, evidence, receipts, owners, and gates"],
  ["recall", "Recall grounded context into a future run with citations"],
];

const RETENTION_SPECS = [
  ["retention_policy", "Retention class, domain, and expiry policy"],
  ["deletion_request", "Deletion or redaction request ledger"],
  ["backup_snapshot", "Backup snapshot and hash ledger"],
  ["restore_drill", "Restore drill and verification ledger"],
  ["domain_partition", "Domain and tenant partition boundary ledger"],
];

const RECALL_GUARD_SPECS = [
  ["citation_required", "Recall must include source citations"],
  ["source_status_required", "Recall must include source status and freshness"],
  ["domain_boundary_required", "Recall must preserve domain and privilege boundary"],
  ["freshness_window", "Recall must state freshness window and stale-risk note"],
  ["confidence_note", "Recall must state confidence or conflict condition"],
  ["next_condition_required", "Recall must update the next execution condition"],
];

const HANDOFF_SPECS = [
  ["p2721_connector_governance", "P2721-P2880", "Connectors can consume event, object, quarantine, and memory recall contracts."],
  ["p2881_domain_pack_ecosystem", "P2881-P3040", "Domain packs can consume memory-backed compatibility and contribution contracts."],
  ["p3041_production_freeze", "P3041-P3200", "Production freeze can verify evented evidence, recall, retention, backup, and audit records."],
];

export async function runPlatformMemoryEventObservabilityPlane(options = {}) {
  const result = await buildPlatformMemoryEventObservabilityPlane(options);
  if (options.write !== false) await writePlatformMemoryEventObservabilityPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform memory event observability plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformMemoryEventObservabilityPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_MEMORY_EVENT_OBSERVABILITY_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const controlledWriteLedger = await readTextSource(inputs.controlled_write_ledger_path);
  const memoryEventLedger = await readTextSource(inputs.memory_event_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceControlledWrite = options.sourceControlledWrite ?? await buildPlatformControlledWriteOperatorConsoleV2({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    controlledWriteLedgerPath: inputs.controlled_write_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const eventStoreRows = buildEventStoreRows();
  const objectStoreRows = buildObjectStoreRows();
  const observabilityRows = buildObservabilityRows();
  const memoryOperationRows = buildMemoryOperationRows();
  const retentionRows = buildRetentionRows();
  const recallGuardRows = buildRecallGuardRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, controlledWriteLedger, memoryEventLedger, roadmapDoc, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows });
  const guardRows = buildGuardRows({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows });
  const boundary = buildBoundary({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, controlledWriteLedger, memoryEventLedger, roadmapDoc, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_memory_event_observability_plane_id: `platform-memory-event-observability-plane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    memory_event_observability_anchor: anchor,
    source_controlled_write_operator_console_v2_summary: sourceControlledWrite.summary,
    memory_event_observability_manifest: manifest,
    memory_event_component_rows: componentRows,
    append_only_event_store_rows: eventStoreRows,
    object_store_artifact_rows: objectStoreRows,
    observability_signal_rows: observabilityRows,
    memory_operation_rows: memoryOperationRows,
    retention_backup_restore_rows: retentionRows,
    grounded_recall_guard_rows: recallGuardRows,
    memory_event_handoff_rows: handoffRows,
    memory_event_guard_rows: guardRows,
    memory_event_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_memory_event_observability_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_memory_event_observability_plane_id = result.platform_memory_event_observability_plane_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformMemoryEventObservabilityPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-memory-event-observability-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "memory-event-observability-manifest.json"), result.memory_event_observability_manifest);
  await writeJson(path.join(outDir, "memory-event-component-rows.json"), collectionEnvelope("memory-event-component-rows.v1", "memory_event_component_rows", result.memory_event_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "append-only-event-store-rows.json"), collectionEnvelope("append-only-event-store-rows.v1", "append_only_event_store_rows", result.append_only_event_store_rows, result.generated_at));
  await writeJson(path.join(outDir, "object-store-artifact-rows.json"), collectionEnvelope("object-store-artifact-rows.v1", "object_store_artifact_rows", result.object_store_artifact_rows, result.generated_at));
  await writeJson(path.join(outDir, "observability-signal-rows.json"), collectionEnvelope("observability-signal-rows.v1", "observability_signal_rows", result.observability_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-operation-rows.json"), collectionEnvelope("memory-operation-rows.v1", "memory_operation_rows", result.memory_operation_rows, result.generated_at));
  await writeJson(path.join(outDir, "retention-backup-restore-rows.json"), collectionEnvelope("retention-backup-restore-rows.v1", "retention_backup_restore_rows", result.retention_backup_restore_rows, result.generated_at));
  await writeJson(path.join(outDir, "grounded-recall-guard-rows.json"), collectionEnvelope("grounded-recall-guard-rows.v1", "grounded_recall_guard_rows", result.grounded_recall_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-event-handoff-rows.json"), collectionEnvelope("memory-event-handoff-rows.v1", "memory_event_handoff_rows", result.memory_event_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-event-guard-rows.json"), collectionEnvelope("memory-event-guard-rows.v1", "memory_event_guard_rows", result.memory_event_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-event-boundary.json"), result.memory_event_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-memory-event-observability-plane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformMemoryEventObservabilityPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformMemoryEventObservabilityPlane(args);
    console.log(`Platform memory event observability plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_memory_event_observability_plane_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Event rows: ${result.summary.event_store_count}`);
    console.log(`Object rows: ${result.summary.object_store_count}`);
    console.log(`Observability rows: ${result.summary.observability_signal_count}`);
    console.log(`Memory operations: ${result.summary.memory_operation_count}`);
    console.log(`P2721 handoff ready: ${result.summary.p2721_ready_as_next_goal}`);
    console.log(`Event written now: ${result.summary.event_written_now}`);
    console.log(`Storage service started: ${result.summary.storage_service_started}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "memory-event-component-row.v1",
    row_id: `memory.event.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.memory_event.component.${componentId}`,
    reviewer_ref: "reviewer.platform_memory_event",
    hard_gate_ref: `gate.platform.memory_event.component.${componentId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "preserve as P2721 connector governance precondition",
  }));
}

function buildEventStoreRows() {
  return EVENT_STORE_SPECS.map(([eventType, description], index) => passRow({
    schema_version: "append-only-event-store-row.v1",
    row_id: `append.only.event.row.${String(index + 1).padStart(2, "0")}`,
    event_type: eventType,
    event_status: "append_contract",
    description,
    append_only_required: true,
    event_written_now: false,
    in_place_update_allowed: false,
    delete_allowed_without_retention_gate: false,
    source_status_required: true,
    evidence_ref_required: true,
    evidence_ref: `evidence.platform.memory_event.event.${eventType}`,
    reviewer_ref: "reviewer.platform_memory_event_store",
    hard_gate_ref: `gate.platform.memory_event.event.${eventType}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "append only after P2721 or later storage implementation gate",
  }));
}

function buildObjectStoreRows() {
  return OBJECT_STORE_SPECS.map(([objectClass, description], index) => passRow({
    schema_version: "object-store-artifact-row.v1",
    row_id: `object.store.artifact.row.${String(index + 1).padStart(2, "0")}`,
    object_class: objectClass,
    object_status: "reference_contract",
    description,
    object_written_now: false,
    hash_required: true,
    redaction_required: true,
    raw_material_allowed: false,
    cross_domain_access_allowed: false,
    evidence_ref: `evidence.platform.memory_event.object.${objectClass}`,
    reviewer_ref: "reviewer.platform_object_store",
    hard_gate_ref: `gate.platform.memory_event.object.${objectClass}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "write object only after storage implementation and retention gate",
  }));
}

function buildObservabilityRows() {
  return OBSERVABILITY_SPECS.map(([signalId, description], index) => passRow({
    schema_version: "observability-signal-row.v1",
    row_id: `observability.signal.row.${String(index + 1).padStart(2, "0")}`,
    signal_id: signalId,
    signal_status: "metric_contract",
    description,
    trace_required: true,
    audit_required: true,
    redaction_required: true,
    collection_started_now: false,
    raw_value_allowed: false,
    evidence_ref: `evidence.platform.memory_event.observability.${signalId}`,
    reviewer_ref: "reviewer.platform_observability",
    hard_gate_ref: `gate.platform.memory_event.observability.${signalId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "collect only after observability plane implementation gate",
  }));
}

function buildMemoryOperationRows() {
  return MEMORY_OPERATION_SPECS.map(([operationId, description], index) => passRow({
    schema_version: "memory-operation-row.v1",
    row_id: `memory.operation.row.${String(index + 1).padStart(2, "0")}`,
    operation_id: operationId,
    operation_status: "grounded_contract",
    description,
    grounded_evidence_required: true,
    citation_required: true,
    source_status_required: true,
    domain_boundary_required: true,
    memory_mutation_performed_now: false,
    ungrounded_recall_allowed: false,
    evidence_ref: `evidence.platform.memory_event.operation.${operationId}`,
    reviewer_ref: "reviewer.platform_memory_bank",
    hard_gate_ref: `gate.platform.memory_event.operation.${operationId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "perform only after event-backed memory implementation gate",
  }));
}

function buildRetentionRows() {
  return RETENTION_SPECS.map(([retentionId, description], index) => passRow({
    schema_version: "retention-backup-restore-row.v1",
    row_id: `retention.backup.restore.row.${String(index + 1).padStart(2, "0")}`,
    retention_id: retentionId,
    retention_status: "policy_contract",
    description,
    retention_policy_required: true,
    backup_required: true,
    restore_verification_required: true,
    cross_domain_leakage_allowed: false,
    destructive_action_allowed_now: false,
    evidence_ref: `evidence.platform.memory_event.retention.${retentionId}`,
    reviewer_ref: "reviewer.platform_retention",
    hard_gate_ref: `gate.platform.memory_event.retention.${retentionId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "enforce before connector or production storage rollout",
  }));
}

function buildRecallGuardRows() {
  return RECALL_GUARD_SPECS.map(([recallGuardId, description], index) => passRow({
    schema_version: "grounded-recall-guard-row.v1",
    row_id: `grounded.recall.guard.row.${String(index + 1).padStart(2, "0")}`,
    recall_guard_id: recallGuardId,
    recall_guard_status: "required_before_recall",
    description,
    citation_required: true,
    source_status_required: true,
    domain_boundary_required: true,
    next_condition_required: true,
    recall_performed_now: false,
    ungrounded_recall_allowed: false,
    evidence_ref: `evidence.platform.memory_event.recall.${recallGuardId}`,
    reviewer_ref: "reviewer.platform_grounded_recall",
    hard_gate_ref: `gate.platform.memory_event.recall.${recallGuardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "recall only with citations, source status, and domain boundary",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "memory-event-handoff-row.v1",
    row_id: `memory.event.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    connector_ingestion_enabled_by_handoff: false,
    connector_write_enabled_by_handoff: false,
    production_ready_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.memory_event.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_memory_event_handoff",
    hard_gate_ref: `gate.platform.memory_event.handoff.${handoffId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in later phase without treating handoff as connector or production permission",
  }));
}

function buildAnchor({ packageJson, controlledWriteLedger, memoryEventLedger, roadmapDoc, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows }) {
  return {
    schema_version: "memory-event-observability-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    controlled_write_ledger_present: controlledWriteLedger.available,
    memory_event_ledger_present: memoryEventLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_controlled_write_status: sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status,
    source_patch_applied_now: sourceControlledWrite.summary.patch_applied_now,
    source_write_action_allowed_now: sourceControlledWrite.summary.write_action_allowed_now,
    component_count: componentRows.length,
    event_store_count: eventStoreRows.length,
    object_store_count: objectStoreRows.length,
    observability_signal_count: observabilityRows.length,
    memory_operation_count: memoryOperationRows.length,
    retention_count: retentionRows.length,
    recall_guard_count: recallGuardRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows }) {
  return {
    schema_version: "memory-event-observability-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_controlled_write_status: sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status,
    component_count: componentRows.length,
    event_store_count: eventStoreRows.length,
    object_store_count: objectStoreRows.length,
    observability_signal_count: observabilityRows.length,
    memory_operation_count: memoryOperationRows.length,
    retention_count: retentionRows.length,
    recall_guard_count: recallGuardRows.length,
    handoff_count: handoffRows.length,
    memory_event_plane_contract_ready: true,
    append_only_event_contract_ready: true,
    grounded_recall_contract_ready: true,
    next_allowed_action: "start P2721-P2880 connectors and data governance planning",
  };
}

function buildGuardRows({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows }) {
  const guards = [
    ["source_controlled_write_ready", sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status === SOURCE_READY_STATUS, "Source controlled write console must be ready"],
    ["source_still_no_patch_apply", sourceControlledWrite.summary.patch_applied_now === false && sourceControlledWrite.summary.write_action_allowed_now === false, "Source must not apply patches or open write"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All memory event components must pass"],
    ["events_append_only_not_written", eventStoreRows.length === 7 && eventStoreRows.every((row) => row.append_only_required === true && row.event_written_now === false), "Event store rows must be append-only contracts only"],
    ["objects_referenced_not_written", objectStoreRows.length === 6 && objectStoreRows.every((row) => row.object_written_now === false && row.raw_material_allowed === false), "Object rows must be references only"],
    ["observability_not_collecting", observabilityRows.length === 6 && observabilityRows.every((row) => row.collection_started_now === false && row.raw_value_allowed === false), "Observability rows must not collect raw values now"],
    ["memory_grounded_not_mutating", memoryOperationRows.length === 8 && memoryOperationRows.every((row) => row.grounded_evidence_required === true && row.memory_mutation_performed_now === false), "Memory operations must require grounding and remain non-mutating"],
    ["retention_ready_no_destructive_action", retentionRows.length === 5 && retentionRows.every((row) => row.retention_policy_required === true && row.destructive_action_allowed_now === false), "Retention rows must block destructive action now"],
    ["recall_guards_required", recallGuardRows.length === 6 && recallGuardRows.every((row) => row.citation_required === true && row.recall_performed_now === false), "Grounded recall guards must be required"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.connector_ingestion_enabled_by_handoff === false && row.production_ready_enabled_by_handoff === false), "Handoffs must not enable connectors or production"],
    ["no_storage_services_started", true, "This contract does not start storage, event, memory, or observability services"],
    ["no_raw_material_or_cross_domain", true, "This contract does not expose raw material or cross-domain data"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "memory-event-guard-row.v1",
    row_id: `memory.event.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.memory_event.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_memory_event_guard",
    hard_gate_ref: `gate.platform.memory_event.guard.${guardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2720 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status !== SOURCE_READY_STATUS,
    sourceControlledWrite.summary.patch_applied_now,
    sourceControlledWrite.summary.write_action_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    eventStoreRows.some((row) => row.event_written_now || row.in_place_update_allowed || row.delete_allowed_without_retention_gate),
    objectStoreRows.some((row) => row.object_written_now || row.raw_material_allowed || row.cross_domain_access_allowed),
    observabilityRows.some((row) => row.collection_started_now || row.raw_value_allowed),
    memoryOperationRows.some((row) => row.memory_mutation_performed_now || row.ungrounded_recall_allowed || !row.citation_required),
    retentionRows.some((row) => row.cross_domain_leakage_allowed || row.destructive_action_allowed_now),
    recallGuardRows.some((row) => row.recall_performed_now || row.ungrounded_recall_allowed || !row.source_status_required),
    handoffRows.some((row) => row.connector_ingestion_enabled_by_handoff || row.connector_write_enabled_by_handoff || row.production_ready_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "memory-event-boundary.v1",
    source_controlled_write_status: sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status,
    memory_event_plane_contract_ready: true,
    append_only_event_contract_ready: true,
    grounded_recall_contract_ready: true,
    event_written_now: false,
    object_written_now: false,
    memory_mutation_performed_now: false,
    recall_performed_now: false,
    event_store_started: false,
    storage_service_started: false,
    observability_collection_started_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_ingestion_allowed_now: false,
    connector_write_allowed_now: false,
    raw_material_access_allowed_now: false,
    cross_domain_access_allowed_now: false,
    production_ready_allowed_now: false,
    p2721_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, controlledWriteLedger, memoryEventLedger, roadmapDoc, sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:memory-event-observability-plane"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:memory-event-observability-plane -- --check"),
    validationItem("source.controlled_write", "source_ready", sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status === SOURCE_READY_STATUS, "source controlled write console must be ready"),
    validationItem("source.no_patch_apply", "source_ready", sourceControlledWrite.summary.patch_applied_now === false && sourceControlledWrite.summary.write_action_allowed_now === false, "source must not apply patches or open write"),
    validationItem("ledger.controlled_write", "ledger", controlledWriteLedger.available && controlledWriteLedger.text.includes(SOURCE_COMMAND_NAME), "controlled write ledger must be present"),
    validationItem("ledger.memory_event", "ledger", memoryEventLedger.available && memoryEventLedger.text.includes("P2561-P2720") && memoryEventLedger.text.includes(COMMAND_NAME), "memory event ledger must be present"),
    validationItem("roadmap.memory_event", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2561-P2720") && roadmapDoc.text.includes("Memory Bank"), "roadmap must reflect memory event observability plane"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all memory event component rows must exist"),
    validationItem("events.count", "event_rows", eventStoreRows.length === 7, "all event store rows must exist"),
    validationItem("objects.count", "object_rows", objectStoreRows.length === 6, "all object store rows must exist"),
    validationItem("observability.count", "observability_rows", observabilityRows.length === 6, "all observability rows must exist"),
    validationItem("memory.count", "memory_rows", memoryOperationRows.length === 8, "all memory operation rows must exist"),
    validationItem("retention.count", "retention_rows", retentionRows.length === 5, "all retention rows must exist"),
    validationItem("recall.count", "recall_guard_rows", recallGuardRows.length === 6, "all grounded recall guard rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all memory event handoff rows must exist"),
    validationItem("events.not_written", "unsafe_invariants", eventStoreRows.every((row) => row.event_written_now === false && row.in_place_update_allowed === false), "event rows must not write or update now"),
    validationItem("objects.not_written", "unsafe_invariants", objectStoreRows.every((row) => row.object_written_now === false && row.raw_material_allowed === false), "object rows must not write raw material now"),
    validationItem("memory.grounded", "unsafe_invariants", memoryOperationRows.every((row) => row.citation_required === true && row.ungrounded_recall_allowed === false), "memory operations must require grounded citations"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all memory event guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_services", "unsafe_invariants", boundary.event_store_started === false && boundary.storage_service_started === false && boundary.event_written_now === false, "memory event contract must not start services or write events now"),
  ];
}

function buildSummary({ sourceControlledWrite, componentRows, eventStoreRows, objectStoreRows, observabilityRows, memoryOperationRows, retentionRows, recallGuardRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-memory-event-observability-plane-summary.v1",
    platform_memory_event_observability_plane_status: validation.valid && boundary.p2721_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_controlled_write_status: sourceControlledWrite.summary.platform_controlled_write_operator_console_v2_status,
    component_count: componentRows.length,
    event_store_count: eventStoreRows.length,
    object_store_count: objectStoreRows.length,
    observability_signal_count: observabilityRows.length,
    memory_operation_count: memoryOperationRows.length,
    retention_count: retentionRows.length,
    recall_guard_count: recallGuardRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    memory_event_plane_contract_ready: boundary.memory_event_plane_contract_ready,
    append_only_event_contract_ready: boundary.append_only_event_contract_ready,
    grounded_recall_contract_ready: boundary.grounded_recall_contract_ready,
    p2721_ready_as_next_goal: boundary.p2721_ready_as_next_goal,
    event_written_now: boundary.event_written_now,
    object_written_now: boundary.object_written_now,
    memory_mutation_performed_now: boundary.memory_mutation_performed_now,
    recall_performed_now: boundary.recall_performed_now,
    event_store_started: boundary.event_store_started,
    storage_service_started: boundary.storage_service_started,
    observability_collection_started_now: boundary.observability_collection_started_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    connector_ingestion_allowed_now: boundary.connector_ingestion_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    raw_material_access_allowed_now: boundary.raw_material_access_allowed_now,
    cross_domain_access_allowed_now: boundary.cross_domain_access_allowed_now,
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
    "# Platform Memory Event Observability Plane",
    "",
    `Status: ${result.summary.platform_memory_event_observability_plane_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source controlled write status: ${result.summary.source_controlled_write_status}`,
    `Components: ${result.summary.component_count}`,
    `Event store rows: ${result.summary.event_store_count}`,
    `Object store rows: ${result.summary.object_store_count}`,
    `Observability rows: ${result.summary.observability_signal_count}`,
    `Memory operations: ${result.summary.memory_operation_count}`,
    `Retention rows: ${result.summary.retention_count}`,
    `Recall guards: ${result.summary.recall_guard_count}`,
    `P2721 ready as next goal: ${result.summary.p2721_ready_as_next_goal}`,
    `Event written now: ${result.summary.event_written_now}`,
    `Object written now: ${result.summary.object_written_now}`,
    `Storage service started: ${result.summary.storage_service_started}`,
    `Grounded recall contract ready: ${result.summary.grounded_recall_contract_ready}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2721-P2880 Connectors and Data Governance. This program defines event, object, observability, and grounded recall contracts, but it does not start services, write events, persist objects, ingest connectors, or expose raw material.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_MEMORY_EVENT_OBSERVABILITY_PLANE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    controlled_write_ledger_path: options.controlledWriteLedgerPath ?? defaults.controlledWriteLedgerPath,
    memory_event_ledger_path: options.memoryEventLedgerPath ?? defaults.memoryEventLedgerPath,
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
    controlledWriteLedgerPath: undefined,
    memoryEventLedgerPath: undefined,
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
    } else if (arg === "--controlled-write-ledger") {
      args.controlledWriteLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--memory-event-ledger") {
      args.memoryEventLedgerPath = argv[index + 1];
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
  console.log(`Usage: node scripts/platform-memory-event-observability-plane.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --controlled-write-ledger <path>
  --memory-event-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
