import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_AUDIT_EVENT_LEDGER_OUT_DIR = "artifacts/audit-event-ledger/latest";
export const DEFAULT_AUDIT_EVENT_LEDGER_INPUTS = {
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  errorCostObservabilityContractFreezePath: "artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json",
  controlPlaneAuditTrailPath: "artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const AUDIT_EVENT_LEDGER_SCHEMA_VERSION = "audit-event-ledger.v1";
const AUDIT_EVENT_LEDGER_CONTRACT_SCHEMA_VERSION = "audit-event-ledger-contract.v1";
const AUDIT_TRAIL_RECORD_SCHEMA_VERSION = "audit-trail-record.v1";
const AUDIT_SEPARATION_BINDING_SCHEMA_VERSION = "audit-separation-binding.v1";
const AUDIT_SOURCE_ROLLUP_SCHEMA_VERSION = "audit-source-rollup.v1";
const AUDIT_EVENT_LEDGER_CONTRACT_ID = "audit-event-ledger.v1";

export async function runAuditEventLedger(options = {}) {
  const result = await buildAuditEventLedger(options);
  if (options.write !== false) await writeAuditEventLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Audit event ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAuditEventLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AUDIT_EVENT_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const eventAuditRunContractFreeze = await readJson(inputs.event_audit_run_contract_freeze_path);
  const accessAuditProjection = await readJson(inputs.access_audit_projection_path);
  const appendOnlyEventStore = await readJson(inputs.append_only_event_store_path);
  const errorCostObservabilityContractFreeze = await readJson(inputs.error_cost_observability_contract_freeze_path);
  const controlPlaneAuditTrail = await readJson(inputs.control_plane_audit_trail_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const projection = buildAuditEventProjection({
    eventAuditRunContractFreeze,
    accessAuditProjection,
    appendOnlyEventStore,
    errorCostObservabilityContractFreeze,
    generatedAt,
  });
  const validationItems = validateAuditEventLedger({
    eventAuditRunContractFreeze,
    accessAuditProjection,
    appendOnlyEventStore,
    errorCostObservabilityContractFreeze,
    controlPlaneAuditTrail,
    packageJson,
    roadmapText,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: AUDIT_EVENT_LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    audit_event_ledger_id: `audit-event-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      event_audit_run_contract_freeze: {
        schema_version: eventAuditRunContractFreeze.schema_version ?? null,
        freeze_id: eventAuditRunContractFreeze.freeze_id ?? null,
        freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
        audit_event_count: eventAuditRunContractFreeze.summary?.audit_event_count ?? 0,
        event_record_count: eventAuditRunContractFreeze.summary?.event_record_count ?? 0,
        validation_error_count: eventAuditRunContractFreeze.summary?.validation_error_count ?? eventAuditRunContractFreeze.validation?.errors?.length ?? 0,
      },
      access_audit_projection: {
        schema_version: accessAuditProjection.schema_version ?? null,
        access_audit_projection_id: accessAuditProjection.access_audit_projection_id ?? null,
        access_audit_projection_status: accessAuditProjection.summary?.access_audit_projection_status ?? "unknown",
        access_audit_record_count: accessAuditProjection.summary?.access_audit_record_count ?? 0,
        validation_error_count: accessAuditProjection.summary?.validation_error_count ?? accessAuditProjection.validation?.errors?.length ?? 0,
      },
      append_only_event_store: {
        schema_version: appendOnlyEventStore.schema_version ?? null,
        append_only_event_store_id: appendOnlyEventStore.append_only_event_store_id ?? null,
        event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
        stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
        validation_error_count: appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
      },
      error_cost_observability_contract_freeze: {
        schema_version: errorCostObservabilityContractFreeze.schema_version ?? null,
        freeze_id: errorCostObservabilityContractFreeze.freeze_id ?? null,
        freeze_status: errorCostObservabilityContractFreeze.summary?.freeze_status ?? "unknown",
        trace_projection_count: errorCostObservabilityContractFreeze.summary?.trace_projection_count ?? 0,
        error_record_count: errorCostObservabilityContractFreeze.summary?.error_record_count ?? 0,
        validation_error_count: errorCostObservabilityContractFreeze.summary?.validation_error_count ?? errorCostObservabilityContractFreeze.validation?.errors?.length ?? 0,
      },
      control_plane_audit_trail: {
        schema_version: controlPlaneAuditTrail.schema_version ?? null,
        audit_trail_id: controlPlaneAuditTrail.audit_trail_id ?? null,
        audit_status: controlPlaneAuditTrail.audit_status ?? "unknown",
        audit_event_count: controlPlaneAuditTrail.summary?.audit_event_count ?? 0,
      },
    },
    audit_event_ledger_contract: buildAuditEventLedgerContract(generatedAt),
    audit_event_catalog: {
      schema_version: "audit-event-catalog.v1",
      generated_at: generatedAt,
      audit_trail_records: projection.auditTrailRecords,
      audit_separation_bindings: projection.auditSeparationBindings,
      audit_source_rollups: projection.auditSourceRollups,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeAuditEventLedger({
      eventAuditRunContractFreeze,
      accessAuditProjection,
      appendOnlyEventStore,
      errorCostObservabilityContractFreeze,
      controlPlaneAuditTrail,
      validationItems,
      validation,
      ...projection,
    }),
  };
  return {
    ...result,
    markdown: renderAuditEventLedgerMarkdown(result),
  };
}

export async function writeAuditEventLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "audit-event-ledger.json"), serializableAuditEventLedger(result));
  await writeJson(path.join(outDir, "audit-trail-records.json"), {
    schema_version: "audit-trail-records.v1",
    generated_at: result.generated_at,
    audit_trail_record_count: result.audit_event_catalog.audit_trail_records.length,
    audit_trail_records: result.audit_event_catalog.audit_trail_records,
  });
  await writeJson(path.join(outDir, "audit-separation-bindings.json"), {
    schema_version: "audit-separation-bindings.v1",
    generated_at: result.generated_at,
    audit_separation_binding_count: result.audit_event_catalog.audit_separation_bindings.length,
    audit_separation_bindings: result.audit_event_catalog.audit_separation_bindings,
  });
  await writeJson(path.join(outDir, "audit-source-rollups.json"), {
    schema_version: "audit-source-rollups.v1",
    generated_at: result.generated_at,
    audit_source_rollup_count: result.audit_event_catalog.audit_source_rollups.length,
    audit_source_rollups: result.audit_event_catalog.audit_source_rollups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "audit-event-ledger-validation-report.v1",
    generated_at: result.generated_at,
    audit_event_ledger_id: result.audit_event_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAuditEventLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runAuditEventLedger(args);
    console.log(`Audit event ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.audit_event_ledger_status}`);
    console.log(`Audit records: ${result.summary.audit_trail_record_count}`);
    console.log(`Separated records: ${result.summary.separated_audit_record_count}/${result.summary.audit_trail_record_count}`);
    console.log(`Access audit records: ${result.summary.access_audit_record_count}`);
    console.log(`Approval audit records: ${result.summary.approval_audit_record_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildAuditEventLedgerContract(generatedAt) {
  return {
    schema_version: AUDIT_EVENT_LEDGER_CONTRACT_SCHEMA_VERSION,
    generated_at: generatedAt,
    audit_event_ledger_contract_id: AUDIT_EVENT_LEDGER_CONTRACT_ID,
    separation_model: "audit_plane_projection.v1",
    required_audit_record_fields: [
      "audit_trail_record_id",
      "source_kind",
      "source_record_id",
      "audit_domain",
      "audit_type",
      "actor_id",
      "subject_id",
      "policy_snapshot_id",
      "separation_status",
    ],
    required_separation_binding_fields: [
      "audit_trail_record_id",
      "source_kind",
      "audit_plane_status",
      "observability_log_status",
      "separation_status",
    ],
    separated_from_observability_fields: [
      "observability_event_record_id",
      "observability_trace_projection_id",
    ],
    notes: [
      "Audit records are first-class audit-plane rows, not observability log rows.",
      "Access decisions and human approval decisions are projected into the audit plane even when they have no direct EventRecord.",
      "Append-only event store binding is preserved for AuditEvent v2 rows while access audit rows remain source projection rows until direct access.audit.* events exist.",
    ],
  };
}

function buildAuditEventProjection({
  eventAuditRunContractFreeze,
  accessAuditProjection,
  appendOnlyEventStore,
  errorCostObservabilityContractFreeze,
  generatedAt,
}) {
  const auditEvents = eventAuditRunContractFreeze.event_audit_run_contract?.audit_events ?? [];
  const accessAuditRecords = accessAuditProjection.access_audit_catalog?.access_audit_records ?? [];
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const traceProjections = errorCostObservabilityContractFreeze.error_cost_observability_contract?.trace_projections ?? [];
  const observabilityEventIds = new Set(
    (eventAuditRunContractFreeze.event_audit_run_contract?.event_records ?? []).map((event) => event.event_record_id),
  );
  const storedEventBySourceId = new Map(storedEvents.map((event) => [event.source_event_id ?? event.event_envelope_id, event]));
  const tracesByAuditEventId = groupTraceIdsByAuditEvent(traceProjections);

  const auditTrailRecords = [
    ...auditEvents.map((event) => auditEventTrailRecord({
      event,
      storedEvent: storedEventBySourceId.get(event.audit_event_id) ?? null,
      traceProjectionIds: tracesByAuditEventId.get(event.audit_event_id) ?? [],
      observabilityEventIds,
      generatedAt,
    })),
    ...accessAuditRecords.map((record) => accessAuditTrailRecord({
      record,
      observabilityEventIds,
      generatedAt,
    })),
  ].sort(by("audit_trail_record_id"));
  const auditSeparationBindings = auditTrailRecords.map((record) => auditSeparationBinding(record, generatedAt));
  const auditSourceRollups = buildAuditSourceRollups(auditTrailRecords, generatedAt);
  return {
    auditTrailRecords,
    auditSeparationBindings,
    auditSourceRollups,
  };
}

function auditEventTrailRecord({ event, storedEvent, traceProjectionIds, observabilityEventIds, generatedAt }) {
  const observabilityEventRecordId = observabilityEventIds.has(event.audit_event_id) ? event.audit_event_id : null;
  return {
    schema_version: AUDIT_TRAIL_RECORD_SCHEMA_VERSION,
    audit_trail_record_id: `audit-trail-record.audit-event-v2.${slugify(event.audit_event_id)}`,
    source_kind: "audit_event_v2",
    source_record_id: event.audit_event_id,
    source_system: "event_audit_run_contract_freeze.audit_events",
    audit_domain: auditDomainForAuditEvent(event),
    audit_type: event.event_type ?? "audit.unknown",
    audit_severity: auditSeverityForAuditEvent(event),
    audit_plane_status: "audit_plane_record",
    tenant_id: event.tenant_id ?? "tenant.unknown",
    matter_id: event.matter_id ?? null,
    workflow_run_id: event.workflow_run_id ?? null,
    run_ledger_id: event.run_ledger_id ?? null,
    correlation_id: event.correlation_id ?? null,
    actor_type: event.actor_type ?? event.actor?.actor_type ?? "unknown",
    actor_id: event.actor_id ?? event.actor?.actor_id ?? "unknown",
    subject_type: event.subject_type ?? event.subject?.subject_type ?? "unknown",
    subject_id: event.subject_id ?? event.subject?.subject_id ?? "unknown",
    policy_snapshot_id: event.policy_snapshot_id ?? "policy.unresolved.audit.v1",
    policy_snapshot_status: event.policy_snapshot_status ?? "unknown",
    protected_action_event: Boolean(event.protected_action_event),
    protected_action_executed: Boolean(event.protected_action_executed),
    external_execution: false,
    access_decision: null,
    view_status: null,
    can_retrieve: null,
    requires_human_review: false,
    event_envelope_id: event.audit_event_id,
    stored_event_id: storedEvent?.stored_event_id ?? null,
    event_store_binding_status: storedEvent ? "bound_to_append_only_event_store" : "missing_event_store_binding",
    observability_event_record_id: observabilityEventRecordId,
    observability_trace_projection_ids: traceProjectionIds,
    observability_trace_projection_id: traceProjectionIds[0] ?? null,
    separation_status: observabilityEventRecordId ? "mixed_with_observability" : "separate_from_observability",
    recorded_at: event.recorded_at ?? generatedAt,
    data: event.data ?? {},
    metadata: {
      source_schema_version: event.schema_version ?? null,
      source_event_record_link_status: event.event_record_link_status ?? null,
      source_run_link_status: event.run_link_status ?? null,
    },
  };
}

function accessAuditTrailRecord({ record, observabilityEventIds, generatedAt }) {
  const auditType = accessAuditType(record);
  const sourceRecordId = record.access_audit_record_id;
  const observabilityEventRecordId = observabilityEventIds.has(sourceRecordId) ? sourceRecordId : null;
  return {
    schema_version: AUDIT_TRAIL_RECORD_SCHEMA_VERSION,
    audit_trail_record_id: `audit-trail-record.access-audit.${slugify(sourceRecordId)}`,
    source_kind: "access_audit_record",
    source_record_id: sourceRecordId,
    source_system: "access_audit_projection.access_audit_records",
    audit_domain: auditDomainForAccessRecord(record),
    audit_type: auditType,
    audit_severity: auditSeverityForAccessRecord(record),
    audit_plane_status: "audit_plane_record",
    tenant_id: record.tenant_id ?? "tenant.unknown",
    matter_id: record.target_matter_id ?? record.resource_matter_id ?? null,
    workflow_run_id: null,
    run_ledger_id: null,
    correlation_id: record.source_decision_id ?? sourceRecordId,
    actor_type: "human",
    actor_id: record.user_id ?? record.access_subject_id ?? "unknown",
    subject_type: record.target_type ?? "access_target",
    subject_id: record.target_resource_id ?? record.target_matter_id ?? "unknown",
    policy_snapshot_id: record.policy_snapshot_id ?? "policy.unresolved.access.v1",
    policy_snapshot_status: record.policy_snapshot_id ? "source_declared" : "fallback_applied",
    protected_action_event: Boolean(record.external_execution || record.can_retrieve || record.access_decision !== "allow"),
    protected_action_executed: false,
    external_execution: Boolean(record.external_execution),
    access_decision: record.access_decision ?? null,
    view_status: record.view_status ?? null,
    can_retrieve: Boolean(record.can_retrieve),
    requires_human_review: Boolean(record.requires_human_review),
    event_envelope_id: null,
    stored_event_id: null,
    event_store_binding_status: "source_projection_only",
    observability_event_record_id: observabilityEventRecordId,
    observability_trace_projection_ids: [],
    observability_trace_projection_id: null,
    separation_status: observabilityEventRecordId ? "mixed_with_observability" : "separate_from_observability",
    recorded_at: record.projected_at ?? generatedAt,
    data: {
      source_decision_type: record.source_decision_type ?? null,
      source_decision_id: record.source_decision_id ?? null,
      runtime_id: record.runtime_id ?? null,
      adapter_id: record.adapter_id ?? null,
      target_type: record.target_type ?? null,
      target_resource_id: record.target_resource_id ?? null,
      target_matter_id: record.target_matter_id ?? null,
      wall_id: record.wall_id ?? null,
      reason_codes: record.reason_codes ?? [],
      required_gates: record.required_gates ?? [],
    },
    metadata: {
      resource_classification: record.resource_classification ?? null,
      required_classification_floor: record.required_classification_floor ?? null,
      matter_tagging_status: record.matter_tagging_status ?? null,
      risk_level: record.metadata?.risk_level ?? null,
    },
  };
}

function auditSeparationBinding(record, generatedAt) {
  const observabilityLogStatus = record.observability_event_record_id
    ? "mixed_with_observability_log"
    : "excluded_from_observability_log";
  const traceProjectionStatus = (record.observability_trace_projection_ids ?? []).length > 0
    ? "referenced_by_trace_without_log_mix"
    : "excluded_from_trace_projection";
  return {
    schema_version: AUDIT_SEPARATION_BINDING_SCHEMA_VERSION,
    audit_separation_binding_id: `audit-separation-binding.${slugify(record.audit_trail_record_id)}`,
    audit_trail_record_id: record.audit_trail_record_id,
    source_kind: record.source_kind,
    source_record_id: record.source_record_id,
    audit_plane_status: record.audit_plane_status,
    event_store_binding_status: record.event_store_binding_status,
    observability_log_status: observabilityLogStatus,
    trace_projection_status: traceProjectionStatus,
    separation_status: observabilityLogStatus === "excluded_from_observability_log"
      ? "separated"
      : "mixed",
    generated_at: generatedAt,
  };
}

function buildAuditSourceRollups(records, generatedAt) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.source_kind}:${record.audit_domain}`;
    const group = groups.get(key) ?? {
      schema_version: AUDIT_SOURCE_ROLLUP_SCHEMA_VERSION,
      audit_source_rollup_id: `audit-source-rollup.${slugify(key)}`,
      source_kind: record.source_kind,
      audit_domain: record.audit_domain,
      audit_record_count: 0,
      separated_record_count: 0,
      protected_action_event_count: 0,
      protected_action_executed_count: 0,
      human_review_required_count: 0,
      deny_or_block_record_count: 0,
      generated_at: generatedAt,
    };
    group.audit_record_count += 1;
    if (record.separation_status === "separate_from_observability") group.separated_record_count += 1;
    if (record.protected_action_event) group.protected_action_event_count += 1;
    if (record.protected_action_executed) group.protected_action_executed_count += 1;
    if (record.requires_human_review) group.human_review_required_count += 1;
    if (record.access_decision === "deny" || record.audit_severity === "high") group.deny_or_block_record_count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort(by("audit_source_rollup_id"));
}

function validateAuditEventLedger({
  eventAuditRunContractFreeze,
  accessAuditProjection,
  appendOnlyEventStore,
  errorCostObservabilityContractFreeze,
  controlPlaneAuditTrail,
  packageJson,
  roadmapText,
  auditTrailRecords,
  auditSeparationBindings,
  auditSourceRollups,
}) {
  const validationItems = [];
  const sourceAuditEvents = eventAuditRunContractFreeze.event_audit_run_contract?.audit_events ?? [];
  const sourceAccessRecords = accessAuditProjection.access_audit_catalog?.access_audit_records ?? [];
  const sourceAuditEventRecords = auditTrailRecords.filter((record) => record.source_kind === "audit_event_v2");
  const sourceAccessAuditRecords = auditTrailRecords.filter((record) => record.source_kind === "access_audit_record");
  const ids = auditTrailRecords.map((record) => record.audit_trail_record_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const separatedRecords = auditTrailRecords.filter((record) => record.separation_status === "separate_from_observability");
  const mixedRecords = auditTrailRecords.filter((record) => record.observability_event_record_id);
  const eventStoreBoundAuditEvents = sourceAuditEventRecords.filter((record) => record.event_store_binding_status === "bound_to_append_only_event_store");
  const sourceProjectionOnlyAccessRecords = sourceAccessAuditRecords.filter((record) => record.event_store_binding_status === "source_projection_only");
  const separatedBindings = auditSeparationBindings.filter((binding) => binding.separation_status === "separated");
  const validationErrorCount = [
    eventAuditRunContractFreeze.summary?.validation_error_count ?? eventAuditRunContractFreeze.validation?.errors?.length ?? 0,
    accessAuditProjection.summary?.validation_error_count ?? accessAuditProjection.validation?.errors?.length ?? 0,
    appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
    errorCostObservabilityContractFreeze.summary?.validation_error_count ?? errorCostObservabilityContractFreeze.validation?.errors?.length ?? 0,
  ].reduce((sum, count) => sum + count, 0);

  pushCheck(validationItems, "source.event_audit_run_contract_freeze", "source_event_audit_run_freeze_complete", eventAuditRunContractFreeze.summary?.freeze_status === "complete", "Event/Audit/Run contract freeze must be complete.");
  pushCheck(validationItems, "source.access_audit_projection", "source_access_audit_projection_complete", accessAuditProjection.summary?.access_audit_projection_status === "complete", "Access audit projection must be complete.");
  pushCheck(validationItems, "source.append_only_event_store", "source_append_only_event_store_complete", appendOnlyEventStore.summary?.event_store_status === "complete", "Append-only event store must be complete.");
  pushCheck(validationItems, "source.error_cost_observability_contract_freeze", "source_observability_freeze_complete", errorCostObservabilityContractFreeze.summary?.freeze_status === "complete", "Error/Cost/Observability freeze must be complete.");
  pushCheck(validationItems, "source.control_plane_audit_trail", "source_control_plane_audit_trail_complete", controlPlaneAuditTrail.audit_status === "complete", "Control-plane audit trail must be complete.");
  pushCheck(validationItems, "source.validation", "source_validation_clean", validationErrorCount === 0, "Source validation errors must be zero.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "audit_records_present", auditTrailRecords.length > 0, "Audit ledger must contain records.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "audit_record_count_matches_sources", auditTrailRecords.length === sourceAuditEvents.length + sourceAccessRecords.length, "Audit ledger records must match AuditEvent v2 plus access audit records.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "audit_event_v2_count_matches_source", sourceAuditEventRecords.length === sourceAuditEvents.length, "AuditEvent v2 rows must be preserved.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "access_audit_count_matches_source", sourceAccessAuditRecords.length === sourceAccessRecords.length, "Access audit rows must be preserved.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "audit_record_ids_unique", duplicateIds.length === 0, "Audit trail record ids must be unique.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "all_records_separated_from_observability", separatedRecords.length === auditTrailRecords.length && mixedRecords.length === 0, "Audit records must not be observability log records.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "audit_event_rows_event_store_bound", eventStoreBoundAuditEvents.length === sourceAuditEventRecords.length, "AuditEvent v2 rows must bind to append-only event store.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "access_rows_projection_only", sourceProjectionOnlyAccessRecords.length === sourceAccessAuditRecords.length, "Access audit rows must stay source-projection only until direct access audit events exist.");
  pushCheck(validationItems, "audit_event_catalog.audit_separation_bindings", "separation_binding_count_matches_records", auditSeparationBindings.length === auditTrailRecords.length, "Every audit record needs a separation binding.");
  pushCheck(validationItems, "audit_event_catalog.audit_separation_bindings", "all_separation_bindings_separated", separatedBindings.length === auditSeparationBindings.length, "Every separation binding must exclude observability log mixing.");
  pushCheck(validationItems, "audit_event_catalog.audit_source_rollups", "source_rollups_present", auditSourceRollups.length > 0, "Audit source rollups must be present.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "approval_audit_present", auditTrailRecords.some((record) => record.audit_domain === "approval"), "Approval audit records must be present.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "access_audit_present", auditTrailRecords.some((record) => record.audit_domain === "access"), "Access audit records must be present.");
  pushCheck(validationItems, "audit_event_catalog.audit_trail_records", "security_audit_present", auditTrailRecords.some((record) => record.audit_domain === "security"), "Security audit records must be present.");
  pushCheck(validationItems, "package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["events:audit-ledger"]), "package.json must expose events:audit-ledger.");
  pushCheck(validationItems, "docs.implementation-roadmap", "roadmap_phase_166_recorded", roadmapText.includes("Phase 166") && roadmapText.includes("Audit Event Ledger"), "Roadmap must document Phase 166 Audit Event Ledger.");
  return validationItems;
}

function summarizeAuditEventLedger({
  eventAuditRunContractFreeze,
  accessAuditProjection,
  appendOnlyEventStore,
  errorCostObservabilityContractFreeze,
  controlPlaneAuditTrail,
  auditTrailRecords,
  auditSeparationBindings,
  auditSourceRollups,
  validationItems,
  validation,
}) {
  const separatedRecordCount = auditTrailRecords.filter((record) => record.separation_status === "separate_from_observability").length;
  const eventStoreBoundRecordCount = auditTrailRecords.filter((record) => record.event_store_binding_status === "bound_to_append_only_event_store").length;
  const sourceProjectionOnlyCount = auditTrailRecords.filter((record) => record.event_store_binding_status === "source_projection_only").length;
  const sourceAuditEventRecordCount = auditTrailRecords.filter((record) => record.source_kind === "audit_event_v2").length;
  const sourceAccessAuditRecordCount = auditTrailRecords.filter((record) => record.source_kind === "access_audit_record").length;
  const mixedObservabilityRecordCount = auditTrailRecords.filter((record) => record.observability_event_record_id).length;
  const separatedBindingCount = auditSeparationBindings.filter((binding) => binding.separation_status === "separated").length;
  const byAuditDomain = countBy(auditTrailRecords, (record) => record.audit_domain);
  const byAuditType = countBy(auditTrailRecords, (record) => record.audit_type);
  const bySourceKind = countBy(auditTrailRecords, (record) => record.source_kind);
  const summary = {
    audit_event_ledger_status: validation.valid ? "complete" : "blocked",
    audit_event_ledger_contract_id: AUDIT_EVENT_LEDGER_CONTRACT_ID,
    source_event_audit_run_freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
    source_event_audit_run_audit_event_count: eventAuditRunContractFreeze.summary?.audit_event_count ?? 0,
    source_access_audit_projection_status: accessAuditProjection.summary?.access_audit_projection_status ?? "unknown",
    source_access_audit_record_count: accessAuditProjection.summary?.access_audit_record_count ?? 0,
    source_append_only_event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
    source_stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
    source_observability_freeze_status: errorCostObservabilityContractFreeze.summary?.freeze_status ?? "unknown",
    source_trace_projection_count: errorCostObservabilityContractFreeze.summary?.trace_projection_count ?? 0,
    source_control_plane_audit_status: controlPlaneAuditTrail.audit_status ?? "unknown",
    audit_trail_record_count: auditTrailRecords.length,
    audit_event_v2_record_count: sourceAuditEventRecordCount,
    access_audit_record_count: sourceAccessAuditRecordCount,
    audit_separation_binding_count: auditSeparationBindings.length,
    separated_binding_count: separatedBindingCount,
    audit_source_rollup_count: auditSourceRollups.length,
    separated_audit_record_count: separatedRecordCount,
    mixed_observability_record_count: mixedObservabilityRecordCount,
    observability_log_excluded_record_count: separatedRecordCount,
    event_store_bound_record_count: eventStoreBoundRecordCount,
    source_projection_only_record_count: sourceProjectionOnlyCount,
    approval_audit_record_count: byAuditDomain.approval ?? 0,
    access_audit_domain_record_count: byAuditDomain.access ?? 0,
    security_audit_record_count: byAuditDomain.security ?? 0,
    protected_action_audit_record_count: auditTrailRecords.filter((record) => record.protected_action_event).length,
    protected_action_executed_audit_record_count: auditTrailRecords.filter((record) => record.protected_action_executed).length,
    human_review_required_audit_record_count: auditTrailRecords.filter((record) => record.requires_human_review).length,
    denied_access_audit_record_count: auditTrailRecords.filter((record) => record.access_decision === "deny").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_audit_domain: byAuditDomain,
    by_audit_type: byAuditType,
    by_source_kind: bySourceKind,
    by_separation_status: countBy(auditTrailRecords, (record) => record.separation_status),
    by_event_store_binding_status: countBy(auditTrailRecords, (record) => record.event_store_binding_status),
  };
  return summary;
}

function serializableAuditEventLedger(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

function renderAuditEventLedgerMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Audit Event Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push("");
  lines.push(`- Status: ${summary.audit_event_ledger_status}`);
  lines.push(`- Audit records: ${summary.audit_trail_record_count}`);
  lines.push(`- Separated from observability: ${summary.separated_audit_record_count}/${summary.audit_trail_record_count}`);
  lines.push(`- AuditEvent v2 records: ${summary.audit_event_v2_record_count}`);
  lines.push(`- Access audit records: ${summary.access_audit_record_count}`);
  lines.push(`- Security audit records: ${summary.security_audit_record_count}`);
  lines.push(`- Approval audit records: ${summary.approval_audit_record_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Source Rollups");
  for (const rollup of result.audit_event_catalog.audit_source_rollups) {
    lines.push(`- ${rollup.source_kind}/${rollup.audit_domain}: ${rollup.audit_record_count} record(s), ${rollup.separated_record_count} separated`);
  }
  if (result.audit_event_catalog.audit_source_rollups.length === 0) lines.push("- No audit source rollups.");
  return `${lines.join("\n")}\n`;
}

function groupTraceIdsByAuditEvent(traceProjections) {
  const map = new Map();
  for (const trace of traceProjections) {
    for (const auditEventId of trace.audit_event_ids ?? []) {
      const ids = map.get(auditEventId) ?? [];
      ids.push(trace.trace_projection_id);
      map.set(auditEventId, ids);
    }
  }
  return map;
}

function auditDomainForAccessRecord(record) {
  if (record.access_decision === "deny" || record.external_execution) return "security";
  return "access";
}

function auditDomainForAuditEvent(event) {
  const category = event.event_category ?? event.event_type?.split(".")[0] ?? "audit";
  if (["access", "approval", "security", "audit"].includes(category)) return category;
  if (event.protected_action_event || event.protected_action_executed) return "security";
  return "audit";
}

function accessAuditType(record) {
  if (record.access_decision === "deny") return "access.denied";
  if (record.access_decision === "review") return "access.review_required";
  if (record.external_execution) return "access.external_runtime_review";
  return "access.allowed";
}

function auditSeverityForAccessRecord(record) {
  if (record.access_decision === "deny") return "high";
  if (record.external_execution || record.requires_human_review || record.access_decision === "review") return "medium";
  return "low";
}

function auditSeverityForAuditEvent(event) {
  if (event.protected_action_executed) return "high";
  if (event.protected_action_event) return "medium";
  if ((event.event_type ?? "").includes("decided")) return "medium";
  return "low";
}

function normalizeInputs(options) {
  return {
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.eventAuditRunContractFreezePath),
    access_audit_projection_path: path.resolve(options.accessAuditProjectionPath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.accessAuditProjectionPath),
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.appendOnlyEventStorePath),
    error_cost_observability_contract_freeze_path: path.resolve(options.errorCostObservabilityContractFreezePath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.errorCostObservabilityContractFreezePath),
    control_plane_audit_trail_path: path.resolve(options.controlPlaneAuditTrailPath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.controlPlaneAuditTrailPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_AUDIT_EVENT_LEDGER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--access-audit-projection") parsed.accessAuditProjectionPath = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--error-cost-observability-contract-freeze") parsed.errorCostObservabilityContractFreezePath = argv[++index];
    else if (arg === "--control-plane-audit-trail") parsed.controlPlaneAuditTrailPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/audit-event-ledger.mjs [options]

Options:
  --check                                      Validate and exit non-zero on failure.
  --out-dir <path>                            Output directory.
  --event-audit-run-contract-freeze <path>    event-audit-run-contract-freeze.json path.
  --access-audit-projection <path>            access-audit-projection.json path.
  --append-only-event-store <path>            append-only-event-store.json path.
  --error-cost-observability-contract-freeze <path>
                                               error-cost-observability-contract-freeze.json path.
  --control-plane-audit-trail <path>          control-plane-audit-trail.json path.
  --package <path>                            package.json path.
  --roadmap <path>                            implementation roadmap path.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.path, check_id: item.check_id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(validationItems, pathValue, checkId, passed, message) {
  validationItems.push({
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    passed: Boolean(passed),
    message,
  });
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function by(fieldName) {
  return (left, right) => String(left[fieldName] ?? "").localeCompare(String(right[fieldName] ?? ""));
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "")
    .slice(0, 160) || "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runAuditEventLedgerCli();
}
