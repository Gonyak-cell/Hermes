import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_OUT_DIR = "artifacts/policy-snapshot-event-bindings/latest";
export const DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS = {
  policySnapshotLedgerPath: "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json",
  policySnapshotBindingLedgerPath: "artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "policy-snapshot-event-binding.v1";
const CATALOG_SCHEMA_VERSION = "policy-snapshot-event-binding-catalog.v1";
const RECORD_SCHEMA_VERSION = "event-run-gate-policy-binding.v1";

export async function runPolicySnapshotEventBinding(options = {}) {
  const result = await buildPolicySnapshotEventBinding(options);
  if (options.write !== false) await writePolicySnapshotEventBinding(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy snapshot event binding validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicySnapshotEventBinding(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_OUT_DIR);
  const inputs = normalizeInputs(options);
  const policySnapshotLedger = await readJson(inputs.policy_snapshot_ledger_path);
  const policySnapshotBindingLedger = await readJson(inputs.policy_snapshot_binding_ledger_path);
  const eventAuditRunContractFreeze = await readJson(inputs.event_audit_run_contract_freeze_path);
  const gateApprovalContractFreeze = await readJson(inputs.gate_approval_contract_freeze_path);
  const appendOnlyEventStore = await readJson(inputs.append_only_event_store_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const projection = buildEventBindingProjection({
    policySnapshotBindingLedger,
    eventAuditRunContractFreeze,
    gateApprovalContractFreeze,
    appendOnlyEventStore,
    generatedAt,
  });
  const validationItems = validatePolicySnapshotEventBinding({
    policySnapshotLedger,
    policySnapshotBindingLedger,
    eventAuditRunContractFreeze,
    gateApprovalContractFreeze,
    appendOnlyEventStore,
    packageJson,
    roadmapText,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    policy_snapshot_event_binding_id: `policy-snapshot-event-binding.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      policy_snapshot_ledger: {
        schema_version: policySnapshotLedger.schema_version ?? null,
        ledger_status: policySnapshotLedger.ledger_status ?? "unknown",
        policy_snapshot_count: policySnapshotLedger.summary?.policy_snapshot_count ?? policySnapshotLedger.policy_snapshots?.length ?? 0,
        validation_error_count: policySnapshotLedger.summary?.validation_error_count ?? policySnapshotLedger.validation?.errors?.length ?? 0,
      },
      policy_snapshot_binding_ledger: {
        schema_version: policySnapshotBindingLedger.schema_version ?? null,
        policy_snapshot_binding_status: policySnapshotBindingLedger.summary?.policy_snapshot_binding_status ?? "unknown",
        policy_snapshot_binding_count: policySnapshotBindingLedger.summary?.policy_snapshot_binding_count ?? 0,
        validation_error_count: policySnapshotBindingLedger.summary?.validation_error_count ?? policySnapshotBindingLedger.validation?.errors?.length ?? 0,
      },
      event_audit_run_contract_freeze: {
        schema_version: eventAuditRunContractFreeze.schema_version ?? null,
        freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
        event_record_count: eventAuditRunContractFreeze.summary?.event_record_count ?? 0,
        audit_event_count: eventAuditRunContractFreeze.summary?.audit_event_count ?? 0,
        run_ledger_count: eventAuditRunContractFreeze.summary?.run_ledger_count ?? 0,
        event_run_binding_count: eventAuditRunContractFreeze.summary?.event_run_binding_count ?? 0,
        validation_error_count: eventAuditRunContractFreeze.summary?.validation_error_count ?? eventAuditRunContractFreeze.validation?.errors?.length ?? 0,
      },
      gate_approval_contract_freeze: {
        schema_version: gateApprovalContractFreeze.schema_version ?? null,
        freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? "unknown",
        gate_result_count: gateApprovalContractFreeze.summary?.gate_result_count ?? 0,
        validation_error_count: gateApprovalContractFreeze.summary?.validation_error_count ?? gateApprovalContractFreeze.validation?.errors?.length ?? 0,
      },
      append_only_event_store: {
        schema_version: appendOnlyEventStore.schema_version ?? null,
        event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
        stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
        validation_error_count: appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
      },
    },
    policy_snapshot_event_binding_contract: buildContract(generatedAt),
    policy_snapshot_event_binding_catalog: {
      schema_version: CATALOG_SCHEMA_VERSION,
      generated_at: generatedAt,
      event_run_gate_policy_bindings: projection.eventRunGatePolicyBindings,
      event_policy_snapshot_bindings: projection.eventPolicySnapshotBindings,
      run_policy_snapshot_bindings: projection.runPolicySnapshotBindings,
      gate_policy_snapshot_bindings: projection.gatePolicySnapshotBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizePolicySnapshotEventBinding({
      policySnapshotLedger,
      policySnapshotBindingLedger,
      eventAuditRunContractFreeze,
      gateApprovalContractFreeze,
      appendOnlyEventStore,
      validationItems,
      validation,
      ...projection,
    }),
  };
  return {
    ...result,
    markdown: renderPolicySnapshotEventBindingMarkdown(result),
  };
}

export async function writePolicySnapshotEventBinding(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "policy-snapshot-event-binding.json"), serializablePolicySnapshotEventBinding(result));
  await writeJson(path.join(outDir, "event-run-gate-policy-bindings.json"), {
    schema_version: "event-run-gate-policy-bindings.v1",
    generated_at: result.generated_at,
    event_run_gate_policy_binding_count: result.policy_snapshot_event_binding_catalog.event_run_gate_policy_bindings.length,
    event_run_gate_policy_bindings: result.policy_snapshot_event_binding_catalog.event_run_gate_policy_bindings,
  });
  await writeJson(path.join(outDir, "event-policy-snapshot-bindings.json"), {
    schema_version: "event-policy-snapshot-bindings.v1",
    generated_at: result.generated_at,
    event_policy_snapshot_binding_count: result.policy_snapshot_event_binding_catalog.event_policy_snapshot_bindings.length,
    event_policy_snapshot_bindings: result.policy_snapshot_event_binding_catalog.event_policy_snapshot_bindings,
  });
  await writeJson(path.join(outDir, "run-policy-snapshot-bindings.json"), {
    schema_version: "run-policy-snapshot-bindings.v1",
    generated_at: result.generated_at,
    run_policy_snapshot_binding_count: result.policy_snapshot_event_binding_catalog.run_policy_snapshot_bindings.length,
    run_policy_snapshot_bindings: result.policy_snapshot_event_binding_catalog.run_policy_snapshot_bindings,
  });
  await writeJson(path.join(outDir, "gate-policy-snapshot-bindings.json"), {
    schema_version: "gate-policy-snapshot-bindings.v1",
    generated_at: result.generated_at,
    gate_policy_snapshot_binding_count: result.policy_snapshot_event_binding_catalog.gate_policy_snapshot_bindings.length,
    gate_policy_snapshot_bindings: result.policy_snapshot_event_binding_catalog.gate_policy_snapshot_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "policy-snapshot-event-binding-validation-report.v1",
    generated_at: result.generated_at,
    policy_snapshot_event_binding_id: result.policy_snapshot_event_binding_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicySnapshotEventBindingCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicySnapshotEventBinding(args);
    console.log(`Policy snapshot event binding written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.policy_snapshot_event_binding_status}`);
    console.log(`Bindings: ${result.summary.event_run_gate_policy_binding_count}`);
    console.log(`Source snapshots present: ${result.summary.source_policy_snapshot_present_count}/${result.summary.event_run_gate_policy_binding_count}`);
    console.log(`Known resolved snapshots: ${result.summary.resolved_policy_snapshot_known_count}/${result.summary.event_run_gate_policy_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "policy-snapshot-event-binding-contract.v1",
    generated_at: generatedAt,
    policy_snapshot_event_binding_contract_id: CONTRACT_ID,
    required_subject_kinds: ["event", "run", "event_run_binding", "gate"],
    required_source_fields: ["subject_type", "subject_id", "source_policy_snapshot_id", "execution_time"],
    required_binding_fields: ["resolved_policy_snapshot_id", "binding_status", "policy_snapshot_known", "binding_source"],
    append_only_preservation_rule: "stored event policy_snapshot_id must match the source event/gate policy_snapshot_id whenever a stored event exists.",
    notes: [
      "P167 freezes execution-time policy snapshot coverage for event, run, event-run binding, and gate records.",
      "The broader P123 binding ledger remains the resolver of record; this artifact validates source presence, event-store preservation, and gate event continuity.",
    ],
  };
}

function buildEventBindingProjection({
  policySnapshotBindingLedger,
  eventAuditRunContractFreeze,
  gateApprovalContractFreeze,
  appendOnlyEventStore,
  generatedAt,
}) {
  const policyBindings = collectPolicyBindings(policySnapshotBindingLedger);
  const eventContract = eventAuditRunContractFreeze.event_audit_run_contract ?? {};
  const gateContract = gateApprovalContractFreeze.gate_approval_contract ?? {};
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const storedEventBySourceId = new Map(storedEvents.map((event) => [event.source_event_id ?? event.event_envelope_id, event]));
  const eventRecordById = new Map((eventContract.event_records ?? []).map((event) => [event.event_record_id, event]));
  const auditEventById = new Map((eventContract.audit_events ?? []).map((event) => [event.audit_event_id, event]));

  const eventPolicySnapshotBindings = [
    ...(eventContract.event_records ?? []).map((event) => eventRecordBinding({
      event,
      binding: policyBindings.get(subjectKey("event_record", event.event_record_id)),
      storedEvent: storedEventBySourceId.get(event.event_record_id),
      generatedAt,
    })),
    ...(eventContract.audit_events ?? []).map((event) => eventRecordBinding({
      event,
      binding: policyBindings.get(subjectKey("audit_event", event.audit_event_id)),
      storedEvent: storedEventBySourceId.get(event.audit_event_id),
      generatedAt,
      audit: true,
    })),
  ].sort(by("event_run_gate_policy_binding_id"));

  const runPolicySnapshotBindings = (eventContract.run_ledgers ?? []).map((run) => runLedgerBinding({
    run,
    binding: policyBindings.get(subjectKey("run_ledger", run.run_ledger_id)),
    generatedAt,
  })).sort(by("event_run_gate_policy_binding_id"));

  const eventRunBindingRecords = (eventContract.event_run_bindings ?? []).map((eventRunBinding) => {
    const sourceEvent = eventRunBinding.source_kind === "audit_event"
      ? auditEventById.get(eventRunBinding.source_id)
      : eventRecordById.get(eventRunBinding.source_id);
    const sourceSubjectType = eventRunBinding.source_kind === "audit_event" ? "audit_event" : "event_record";
    return eventRunPolicyBinding({
      eventRunBinding,
      sourceEvent,
      binding: policyBindings.get(subjectKey(sourceSubjectType, eventRunBinding.source_id)),
      storedEvent: storedEventBySourceId.get(eventRunBinding.source_id),
      generatedAt,
    });
  }).sort(by("event_run_gate_policy_binding_id"));

  const gatePolicySnapshotBindings = (gateContract.gate_results ?? []).map((gate) => {
    const eventRecord = gate.event_id ? eventRecordById.get(gate.event_id) : null;
    return gateResultBinding({
      gate,
      binding: policyBindings.get(subjectKey("gate_result", gate.gate_result_id)),
      eventRecord,
      storedEvent: gate.event_id ? storedEventBySourceId.get(gate.event_id) : null,
      generatedAt,
    });
  }).sort(by("event_run_gate_policy_binding_id"));

  return {
    eventPolicySnapshotBindings,
    runPolicySnapshotBindings,
    eventRunBindingRecords,
    gatePolicySnapshotBindings,
    eventRunGatePolicyBindings: [
      ...eventPolicySnapshotBindings,
      ...runPolicySnapshotBindings,
      ...eventRunBindingRecords,
      ...gatePolicySnapshotBindings,
    ].sort(by("event_run_gate_policy_binding_id")),
  };
}

function eventRecordBinding({ event, binding, storedEvent, generatedAt, audit = false }) {
  return buildRecord({
    subjectKind: "event",
    subjectType: audit ? "audit_event" : "event_record",
    subjectId: audit ? event.audit_event_id : event.event_record_id,
    eventType: event.event_type,
    eventTime: event.event_time,
    tenantId: event.tenant_id,
    matterId: event.matter_id ?? null,
    workflowRunId: event.workflow_run_id ?? null,
    runLedgerId: event.run_ledger_id ?? null,
    gateResultId: null,
    sourcePolicySnapshotId: event.policy_snapshot_id,
    sourcePolicySnapshotStatus: event.policy_snapshot_status ?? "unknown",
    binding,
    storedEvent,
    appendOnlyEventBindingStatus: storedEvent ? "stored_event_found" : "stored_event_missing",
    gateEventBindingStatus: "not_applicable",
    generatedAt,
  });
}

function runLedgerBinding({ run, binding, generatedAt }) {
  return buildRecord({
    subjectKind: "run",
    subjectType: "run_ledger",
    subjectId: run.run_ledger_id,
    eventType: "run.ledger",
    eventTime: run.started_at ?? run.updated_at ?? run.recorded_at,
    tenantId: run.tenant_id,
    matterId: run.matter_id ?? null,
    workflowRunId: run.workflow_run_id ?? null,
    runLedgerId: run.run_ledger_id,
    gateResultId: null,
    sourcePolicySnapshotId: run.policy_snapshot_id,
    sourcePolicySnapshotStatus: run.policy_snapshot_status ?? "unknown",
    binding,
    storedEvent: null,
    appendOnlyEventBindingStatus: "not_applicable_for_run_ledger",
    gateEventBindingStatus: "not_applicable",
    generatedAt,
  });
}

function eventRunPolicyBinding({ eventRunBinding, sourceEvent, binding, storedEvent, generatedAt }) {
  return buildRecord({
    subjectKind: "event_run_binding",
    subjectType: "event_run_binding",
    subjectId: eventRunBinding.event_run_binding_id,
    eventType: eventRunBinding.event_type,
    eventTime: sourceEvent?.event_time ?? eventRunBinding.recorded_at,
    tenantId: sourceEvent?.tenant_id ?? null,
    matterId: sourceEvent?.matter_id ?? null,
    workflowRunId: eventRunBinding.workflow_run_id ?? sourceEvent?.workflow_run_id ?? null,
    runLedgerId: eventRunBinding.run_ledger_id ?? sourceEvent?.run_ledger_id ?? null,
    gateResultId: null,
    sourcePolicySnapshotId: eventRunBinding.policy_snapshot_id,
    sourcePolicySnapshotStatus: sourceEvent?.policy_snapshot_status ?? "source_binding",
    storedSourcePolicySnapshotId: sourceEvent?.policy_snapshot_id ?? eventRunBinding.policy_snapshot_id,
    binding,
    storedEvent,
    appendOnlyEventBindingStatus: storedEvent ? "stored_event_found" : "stored_event_missing",
    gateEventBindingStatus: "not_applicable",
    generatedAt,
    metadata: {
      source_kind: eventRunBinding.source_kind,
      source_id: eventRunBinding.source_id,
      binding_status: eventRunBinding.binding_status ?? null,
    },
  });
}

function gateResultBinding({ gate, binding, eventRecord, storedEvent, generatedAt }) {
  const gateEventBindingStatus = gate.event_id && eventRecord
    ? "linked_to_event_record"
    : gate.event_id
      ? "event_record_missing"
      : "event_id_missing";
  return buildRecord({
    subjectKind: "gate",
    subjectType: "gate_result",
    subjectId: gate.gate_result_id,
    eventType: gate.event_type ?? "gate.result",
    eventTime: gate.created_at ?? gate.recorded_at,
    tenantId: gate.tenant_id,
    matterId: gate.matter_id ?? null,
    workflowRunId: gate.workflow_run_id ?? null,
    runLedgerId: null,
    gateResultId: gate.gate_result_id,
    sourcePolicySnapshotId: gate.policy_snapshot_id,
    sourcePolicySnapshotStatus: eventRecord?.policy_snapshot_status ?? "gate_declared",
    binding,
    storedEvent,
    appendOnlyEventBindingStatus: gate.event_id
      ? storedEvent
        ? "stored_event_found"
        : "stored_event_missing"
      : "not_applicable_without_event_id",
    gateEventBindingStatus,
    generatedAt,
    metadata: {
      gate_id: gate.gate_id,
      gate_stage: gate.gate_stage ?? null,
      gate_outcome: gate.gate_outcome ?? null,
      event_id: gate.event_id ?? null,
      event_policy_snapshot_id: eventRecord?.policy_snapshot_id ?? null,
    },
  });
}

function buildRecord({
  subjectKind,
  subjectType,
  subjectId,
  eventType,
  eventTime,
  tenantId,
  matterId,
  workflowRunId,
  runLedgerId,
  gateResultId,
  sourcePolicySnapshotId,
  sourcePolicySnapshotStatus,
  storedSourcePolicySnapshotId = sourcePolicySnapshotId,
  binding,
  storedEvent,
  appendOnlyEventBindingStatus,
  gateEventBindingStatus,
  generatedAt,
  metadata = {},
}) {
  const sourcePresent = Boolean(sourcePolicySnapshotId);
  const sourceUnresolved = isUnresolvedPolicySnapshotId(sourcePolicySnapshotId);
  const resolvedPolicySnapshotId = binding?.policy_snapshot_id ?? null;
  const sourceToResolvedStatus = sourcePolicySnapshotMatchStatus({
    sourcePolicySnapshotId,
    resolvedPolicySnapshotId,
    sourceUnresolved,
    binding,
  });
  const storedEventSnapshotStatus = storedEventPolicySnapshotStatus({
    sourcePolicySnapshotId: storedSourcePolicySnapshotId,
    storedEvent,
    appendOnlyEventBindingStatus,
  });
  const record = {
    schema_version: RECORD_SCHEMA_VERSION,
    event_run_gate_policy_binding_id: `event-run-gate-policy-binding.${slugify(subjectKind)}.${slugify(subjectType)}.${slugify(subjectId)}`,
    subject_kind: subjectKind,
    subject_type: subjectType,
    subject_id: subjectId,
    event_type: eventType ?? null,
    event_time: eventTime ?? null,
    execution_time_status: eventTime ? "recorded" : "missing",
    tenant_id: tenantId ?? null,
    matter_id: matterId ?? null,
    workflow_run_id: workflowRunId ?? null,
    run_ledger_id: runLedgerId ?? null,
    gate_result_id: gateResultId ?? null,
    source_policy_snapshot_id: sourcePolicySnapshotId ?? null,
    source_policy_snapshot_status: sourcePolicySnapshotStatus ?? "unknown",
    stored_policy_snapshot_compare_id: storedSourcePolicySnapshotId ?? null,
    source_snapshot_presence_status: sourcePresent ? "present" : "missing",
    source_snapshot_resolution_hint: sourceUnresolved ? "unresolved_placeholder" : "declared_or_inherited",
    policy_snapshot_binding_id: binding?.binding_id ?? null,
    resolved_policy_snapshot_id: resolvedPolicySnapshotId,
    policy_snapshot_known: Boolean(binding?.policy_snapshot_known),
    resolved_policy_snapshot_status: binding?.policy_snapshot_status ?? "missing",
    binding_source: binding?.binding_source ?? "missing_binding",
    binding_status: binding?.binding_status ?? "missing_binding",
    source_to_resolved_snapshot_status: sourceToResolvedStatus,
    append_only_event_binding_status: appendOnlyEventBindingStatus,
    stored_event_id: storedEvent?.stored_event_id ?? null,
    stored_event_policy_snapshot_id: storedEvent?.policy_snapshot_id ?? null,
    stored_event_snapshot_status: storedEventSnapshotStatus,
    gate_event_binding_status: gateEventBindingStatus,
    recorded_at: generatedAt,
    metadata,
  };
  return record;
}

function collectPolicyBindings(policySnapshotBindingLedger) {
  const catalog = policySnapshotBindingLedger.policy_snapshot_binding_catalog ?? {};
  const bindings = [
    ...(catalog.event_policy_bindings ?? []),
    ...(catalog.run_policy_bindings ?? []),
    ...(catalog.gate_policy_bindings ?? []),
    ...(catalog.workflow_policy_bindings ?? []),
    ...(catalog.agent_run_policy_bindings ?? []),
    ...(catalog.approval_policy_bindings ?? []),
    ...(catalog.output_policy_bindings ?? []),
  ];
  return new Map(bindings.map((binding) => [subjectKey(binding.subject_type, binding.subject_id), binding]));
}

function validatePolicySnapshotEventBinding({
  policySnapshotLedger,
  policySnapshotBindingLedger,
  eventAuditRunContractFreeze,
  gateApprovalContractFreeze,
  appendOnlyEventStore,
  packageJson,
  roadmapText,
  eventRunGatePolicyBindings,
  eventPolicySnapshotBindings,
  runPolicySnapshotBindings,
  eventRunBindingRecords,
  gatePolicySnapshotBindings,
}) {
  const validationItems = [];
  const sourceErrors = [
    policySnapshotLedger.summary?.validation_error_count ?? policySnapshotLedger.validation?.errors?.length ?? 0,
    policySnapshotBindingLedger.summary?.validation_error_count ?? policySnapshotBindingLedger.validation?.errors?.length ?? 0,
    eventAuditRunContractFreeze.summary?.validation_error_count ?? eventAuditRunContractFreeze.validation?.errors?.length ?? 0,
    gateApprovalContractFreeze.summary?.validation_error_count ?? gateApprovalContractFreeze.validation?.errors?.length ?? 0,
    appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
  ].reduce((sum, count) => sum + count, 0);
  const ids = eventRunGatePolicyBindings.map((record) => record.event_run_gate_policy_binding_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const eventSourceCount = (eventAuditRunContractFreeze.summary?.event_record_count ?? 0)
    + (eventAuditRunContractFreeze.summary?.audit_event_count ?? 0);
  const runSourceCount = eventAuditRunContractFreeze.summary?.run_ledger_count ?? 0;
  const eventRunSourceCount = eventAuditRunContractFreeze.summary?.event_run_binding_count ?? 0;
  const gateSourceCount = gateApprovalContractFreeze.summary?.gate_result_count ?? 0;
  const expectedTotal = eventSourceCount + runSourceCount + eventRunSourceCount + gateSourceCount;
  const storedApplicable = eventRunGatePolicyBindings.filter((record) => !record.append_only_event_binding_status.startsWith("not_applicable"));
  const eventLinkedGates = gatePolicySnapshotBindings.filter((record) => record.gate_event_binding_status === "linked_to_event_record");

  pushCheck(validationItems, "source.policy_snapshot_ledger", "source_policy_snapshot_ledger_valid", policySnapshotLedger.ledger_status === "valid", "Policy snapshot ledger must be valid.");
  pushCheck(validationItems, "source.policy_snapshot_binding_ledger", "source_policy_snapshot_binding_ledger_complete", policySnapshotBindingLedger.summary?.policy_snapshot_binding_status === "complete", "Policy snapshot binding ledger must be complete.");
  pushCheck(validationItems, "source.event_audit_run_contract_freeze", "source_event_audit_run_contract_complete", eventAuditRunContractFreeze.summary?.freeze_status === "complete", "Event/Audit/Run freeze must be complete.");
  pushCheck(validationItems, "source.gate_approval_contract_freeze", "source_gate_approval_contract_complete", gateApprovalContractFreeze.summary?.freeze_status === "complete", "Gate/Approval freeze must be complete.");
  pushCheck(validationItems, "source.append_only_event_store", "source_append_only_event_store_complete", appendOnlyEventStore.summary?.event_store_status === "complete", "Append-only event store must be complete.");
  pushCheck(validationItems, "source.validation", "source_validation_clean", sourceErrors === 0, "Source validation errors must be zero.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "bindings_present", eventRunGatePolicyBindings.length > 0, "Event/run/gate policy snapshot bindings must be present.");
  pushCheck(validationItems, "catalog.event_policy_snapshot_bindings", "event_binding_count_matches_source", eventPolicySnapshotBindings.length === eventSourceCount, "Event and audit event binding count must match source events.");
  pushCheck(validationItems, "catalog.run_policy_snapshot_bindings", "run_binding_count_matches_source", runPolicySnapshotBindings.length === runSourceCount, "Run binding count must match run ledger source count.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "event_run_binding_count_matches_source", eventRunBindingRecords.length === eventRunSourceCount, "Event-run binding count must match event-run source count.");
  pushCheck(validationItems, "catalog.gate_policy_snapshot_bindings", "gate_binding_count_matches_source", gatePolicySnapshotBindings.length === gateSourceCount, "Gate binding count must match gate result source count.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "total_binding_count_matches_sources", eventRunGatePolicyBindings.length === expectedTotal, "Total binding count must match event, run, event-run binding, and gate source rows.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "binding_ids_unique", duplicateIds.length === 0, "Event/run/gate policy binding ids must be unique.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "source_policy_snapshot_present", eventRunGatePolicyBindings.every((record) => record.source_snapshot_presence_status === "present"), "Every source event/run/gate row must carry a policy_snapshot_id.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "resolved_policy_snapshot_known", eventRunGatePolicyBindings.every((record) => record.policy_snapshot_known && record.binding_status === "bound"), "Every source event/run/gate row must resolve to a known policy snapshot.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "execution_time_recorded", eventRunGatePolicyBindings.every((record) => record.execution_time_status === "recorded"), "Every source event/run/gate row must carry an execution time.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "source_or_fallback_status_accepted", eventRunGatePolicyBindings.every((record) => ["matched", "source_unresolved_resolved_by_binding"].includes(record.source_to_resolved_snapshot_status)), "Source snapshots must either match the resolved snapshot or be explicitly fallback-resolved.");
  pushCheck(validationItems, "catalog.event_run_gate_policy_bindings", "stored_event_policy_snapshot_preserved", storedApplicable.every((record) => record.stored_event_snapshot_status === "stored_event_policy_snapshot_matched"), "Stored events must preserve source policy snapshot ids.");
  pushCheck(validationItems, "catalog.gate_policy_snapshot_bindings", "gate_events_linked_when_event_id_present", eventLinkedGates.length === gatePolicySnapshotBindings.filter((record) => record.metadata?.event_id).length, "Gate rows with event ids must link to event records.");
  pushCheck(validationItems, "package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["events:policy-snapshots"]), "package.json must expose events:policy-snapshots.");
  pushCheck(validationItems, "docs.implementation-roadmap", "roadmap_phase_167_recorded", roadmapText.includes("Phase 167") && roadmapText.includes("Policy Snapshot Event Binding"), "Roadmap must document Phase 167 Policy Snapshot Event Binding.");
  return validationItems;
}

function summarizePolicySnapshotEventBinding({
  policySnapshotLedger,
  policySnapshotBindingLedger,
  eventAuditRunContractFreeze,
  gateApprovalContractFreeze,
  appendOnlyEventStore,
  eventRunGatePolicyBindings,
  eventPolicySnapshotBindings,
  runPolicySnapshotBindings,
  eventRunBindingRecords,
  gatePolicySnapshotBindings,
  validationItems,
  validation,
}) {
  const storedApplicable = eventRunGatePolicyBindings.filter((record) => !record.append_only_event_binding_status.startsWith("not_applicable"));
  const summary = {
    policy_snapshot_event_binding_status: validation.valid ? "complete" : "blocked",
    policy_snapshot_event_binding_contract_id: CONTRACT_ID,
    source_policy_snapshot_ledger_status: policySnapshotLedger.ledger_status ?? "unknown",
    source_policy_snapshot_binding_status: policySnapshotBindingLedger.summary?.policy_snapshot_binding_status ?? "unknown",
    source_event_audit_run_freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
    source_gate_approval_freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? "unknown",
    source_append_only_event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
    event_run_gate_policy_binding_count: eventRunGatePolicyBindings.length,
    event_policy_snapshot_binding_count: eventPolicySnapshotBindings.length,
    event_record_policy_snapshot_binding_count: eventPolicySnapshotBindings.filter((record) => record.subject_type === "event_record").length,
    audit_event_policy_snapshot_binding_count: eventPolicySnapshotBindings.filter((record) => record.subject_type === "audit_event").length,
    run_policy_snapshot_binding_count: runPolicySnapshotBindings.length,
    event_run_policy_snapshot_binding_count: eventRunBindingRecords.length,
    gate_policy_snapshot_binding_count: gatePolicySnapshotBindings.length,
    source_policy_snapshot_present_count: eventRunGatePolicyBindings.filter((record) => record.source_snapshot_presence_status === "present").length,
    resolved_policy_snapshot_known_count: eventRunGatePolicyBindings.filter((record) => record.policy_snapshot_known).length,
    bound_policy_snapshot_binding_count: eventRunGatePolicyBindings.filter((record) => record.binding_status === "bound").length,
    source_snapshot_matched_count: eventRunGatePolicyBindings.filter((record) => record.source_to_resolved_snapshot_status === "matched").length,
    source_unresolved_resolved_count: eventRunGatePolicyBindings.filter((record) => record.source_to_resolved_snapshot_status === "source_unresolved_resolved_by_binding").length,
    source_snapshot_mismatch_count: eventRunGatePolicyBindings.filter((record) => record.source_to_resolved_snapshot_status === "mismatch").length,
    unresolved_source_snapshot_count: eventRunGatePolicyBindings.filter((record) => record.source_snapshot_resolution_hint === "unresolved_placeholder").length,
    execution_time_recorded_count: eventRunGatePolicyBindings.filter((record) => record.execution_time_status === "recorded").length,
    stored_event_policy_snapshot_checked_count: storedApplicable.length,
    stored_event_policy_snapshot_matched_count: storedApplicable.filter((record) => record.stored_event_snapshot_status === "stored_event_policy_snapshot_matched").length,
    stored_event_policy_snapshot_missing_count: storedApplicable.filter((record) => record.stored_event_snapshot_status === "stored_event_missing").length,
    stored_event_policy_snapshot_mismatch_count: storedApplicable.filter((record) => record.stored_event_snapshot_status === "stored_event_policy_snapshot_mismatch").length,
    gate_event_linked_count: gatePolicySnapshotBindings.filter((record) => record.gate_event_binding_status === "linked_to_event_record").length,
    gate_event_missing_count: gatePolicySnapshotBindings.filter((record) => record.gate_event_binding_status === "event_record_missing").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_subject_kind: countBy(eventRunGatePolicyBindings, (record) => record.subject_kind),
    by_subject_type: countBy(eventRunGatePolicyBindings, (record) => record.subject_type),
    by_binding_source: countBy(eventRunGatePolicyBindings, (record) => record.binding_source),
    by_source_to_resolved_snapshot_status: countBy(eventRunGatePolicyBindings, (record) => record.source_to_resolved_snapshot_status),
    by_stored_event_snapshot_status: countBy(eventRunGatePolicyBindings, (record) => record.stored_event_snapshot_status),
  };
  return summary;
}

function serializablePolicySnapshotEventBinding(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

function renderPolicySnapshotEventBindingMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Policy Snapshot Event Binding");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push("");
  lines.push(`- Status: ${summary.policy_snapshot_event_binding_status}`);
  lines.push(`- Bindings: ${summary.event_run_gate_policy_binding_count}`);
  lines.push(`- Event bindings: ${summary.event_policy_snapshot_binding_count}`);
  lines.push(`- Run bindings: ${summary.run_policy_snapshot_binding_count}`);
  lines.push(`- Event-run bindings: ${summary.event_run_policy_snapshot_binding_count}`);
  lines.push(`- Gate bindings: ${summary.gate_policy_snapshot_binding_count}`);
  lines.push(`- Source snapshots present: ${summary.source_policy_snapshot_present_count}/${summary.event_run_gate_policy_binding_count}`);
  lines.push(`- Known resolved snapshots: ${summary.resolved_policy_snapshot_known_count}/${summary.event_run_gate_policy_binding_count}`);
  lines.push(`- Stored event snapshot matches: ${summary.stored_event_policy_snapshot_matched_count}/${summary.stored_event_policy_snapshot_checked_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Binding Sources");
  for (const [source, count] of Object.entries(summary.by_binding_source ?? {}).sort()) {
    lines.push(`- ${source}: ${count}`);
  }
  return `${lines.join("\n")}\n`;
}

function sourcePolicySnapshotMatchStatus({ sourcePolicySnapshotId, resolvedPolicySnapshotId, sourceUnresolved, binding }) {
  if (!sourcePolicySnapshotId) return "source_snapshot_missing";
  if (!resolvedPolicySnapshotId) return "resolved_snapshot_missing";
  if (sourcePolicySnapshotId === resolvedPolicySnapshotId) return "matched";
  if (sourceUnresolved && binding?.policy_snapshot_known) return "source_unresolved_resolved_by_binding";
  return "mismatch";
}

function storedEventPolicySnapshotStatus({ sourcePolicySnapshotId, storedEvent, appendOnlyEventBindingStatus }) {
  if (appendOnlyEventBindingStatus.startsWith("not_applicable")) return appendOnlyEventBindingStatus;
  if (!storedEvent) return "stored_event_missing";
  if (storedEvent.policy_snapshot_id === sourcePolicySnapshotId) return "stored_event_policy_snapshot_matched";
  return "stored_event_policy_snapshot_mismatch";
}

function normalizeInputs(options) {
  return {
    policy_snapshot_ledger_path: path.resolve(options.policySnapshotLedgerPath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.policySnapshotLedgerPath),
    policy_snapshot_binding_ledger_path: path.resolve(options.policySnapshotBindingLedgerPath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.policySnapshotBindingLedgerPath),
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.eventAuditRunContractFreezePath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.gateApprovalContractFreezePath),
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.appendOnlyEventStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_POLICY_SNAPSHOT_EVENT_BINDING_INPUTS.roadmapPath),
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
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--policy-snapshot-binding-ledger") parsed.policySnapshotBindingLedgerPath = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-snapshot-event-binding.mjs [options]

Options:
  --check                                      Validate and exit non-zero on failure.
  --out-dir <path>                            Output directory.
  --policy-snapshot-ledger <path>             policy-snapshot-ledger.json path.
  --policy-snapshot-binding-ledger <path>     policy-snapshot-binding-ledger.json path.
  --event-audit-run-contract-freeze <path>    event-audit-run-contract-freeze.json path.
  --gate-approval-contract-freeze <path>      gate-approval-contract-freeze.json path.
  --append-only-event-store <path>            append-only-event-store.json path.
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

function subjectKey(subjectType, subjectId) {
  return `${subjectType}:${subjectId}`;
}

function by(fieldName) {
  return (left, right) => String(left[fieldName] ?? "").localeCompare(String(right[fieldName] ?? ""));
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function isUnresolvedPolicySnapshotId(policySnapshotId) {
  return typeof policySnapshotId === "string" && policySnapshotId.includes("unresolved");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "")
    .slice(0, 160) || "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runPolicySnapshotEventBindingCli();
}
