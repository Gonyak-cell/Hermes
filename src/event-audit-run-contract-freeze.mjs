import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVENT_AUDIT_RUN_CONTRACT_FREEZE_OUT_DIR = "artifacts/event-audit-run-contract-freeze/latest";
export const DEFAULT_EVENT_AUDIT_RUN_CONTRACT_FREEZE_INPUTS = {
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  controlPlaneAuditTrailPath: "artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
};

const EVENT_RECORD_SCHEMA_VERSION = "event-record.v2";
const AUDIT_EVENT_SCHEMA_VERSION = "audit-event.v2";
const RUN_LEDGER_SCHEMA_VERSION = "run-ledger.v2";
const EVENT_RUN_BINDING_SCHEMA_VERSION = "event-run-binding.v2";
const FALLBACK_EVENT_POLICY_SNAPSHOT_ID = "policy.unresolved.event.v1";
const FALLBACK_AUDIT_POLICY_SNAPSHOT_ID = "policy.unresolved.audit.v1";
const FALLBACK_RUN_POLICY_SNAPSHOT_ID = "policy.unresolved.run.v1";
const FALLBACK_BINDING_POLICY_SNAPSHOT_ID = "policy.unresolved.binding.v1";

export async function runEventAuditRunContractFreeze(options = {}) {
  const result = await buildEventAuditRunContractFreeze(options);
  if (options.write !== false) await writeEventAuditRunContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Event/Audit/Run Ledger contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEventAuditRunContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVENT_AUDIT_RUN_CONTRACT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);

  const observabilityCatalog = await readJson(inputs.observability_catalog_path);
  const controlPlaneAuditTrail = await readJson(inputs.control_plane_audit_trail_path);
  const capabilityWorkflowContractFreeze = await readJson(inputs.capability_workflow_contract_freeze_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const gateApprovalContractFreeze = await readJson(inputs.gate_approval_contract_freeze_path);
  const outputDeliveryContractFreeze = await readJson(inputs.output_delivery_contract_freeze_path);

  const projection = projectEventAuditRunContracts({
    observabilityCatalog,
    controlPlaneAuditTrail,
    capabilityWorkflowContractFreeze,
    runtimeAgentRunContractFreeze,
    gateApprovalContractFreeze,
    outputDeliveryContractFreeze,
    generatedAt,
  });
  const validationItems = validateEventAuditRunContracts({
    outputDeliveryContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "event-audit-run-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `event-audit-run-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      observability_catalog: {
        schema_version: observabilityCatalog.schema_version,
        event_count: observabilityCatalog.summary?.event_count ?? observabilityCatalog.event_records?.length ?? 0,
        run_record_count: observabilityCatalog.summary?.run_ledger_count ?? observabilityCatalog.run_records?.length ?? 0,
        cost_record_count: observabilityCatalog.summary?.cost_record_count ?? observabilityCatalog.cost_records?.length ?? 0,
      },
      control_plane_audit_trail: {
        schema_version: controlPlaneAuditTrail.schema_version,
        audit_status: controlPlaneAuditTrail.audit_status,
        audit_event_count: controlPlaneAuditTrail.summary?.audit_event_count ?? controlPlaneAuditTrail.audit_events?.length ?? 0,
      },
      capability_workflow_contract_freeze: {
        schema_version: capabilityWorkflowContractFreeze.schema_version,
        freeze_id: capabilityWorkflowContractFreeze.freeze_id,
        freeze_status: capabilityWorkflowContractFreeze.summary?.freeze_status ?? null,
        workflow_run_count: capabilityWorkflowContractFreeze.summary?.workflow_run_count ?? 0,
      },
      runtime_agentrun_contract_freeze: {
        schema_version: runtimeAgentRunContractFreeze.schema_version,
        freeze_id: runtimeAgentRunContractFreeze.freeze_id,
        freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? null,
        agent_run_count: runtimeAgentRunContractFreeze.summary?.agent_run_count ?? 0,
      },
      gate_approval_contract_freeze: {
        schema_version: gateApprovalContractFreeze.schema_version,
        freeze_id: gateApprovalContractFreeze.freeze_id,
        freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? null,
        gate_result_count: gateApprovalContractFreeze.summary?.gate_result_count ?? 0,
      },
      output_delivery_contract_freeze: {
        schema_version: outputDeliveryContractFreeze.schema_version,
        freeze_id: outputDeliveryContractFreeze.freeze_id,
        freeze_status: outputDeliveryContractFreeze.summary?.freeze_status ?? null,
        output_artifact_count: outputDeliveryContractFreeze.summary?.output_artifact_count ?? 0,
      },
    },
    contract_versions: {
      event_record_schema_version: EVENT_RECORD_SCHEMA_VERSION,
      audit_event_schema_version: AUDIT_EVENT_SCHEMA_VERSION,
      run_ledger_schema_version: RUN_LEDGER_SCHEMA_VERSION,
      event_run_binding_schema_version: EVENT_RUN_BINDING_SCHEMA_VERSION,
      compatibility_floor: "observability-catalog.v1+control-plane-audit-trail.v1",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    event_audit_run_contract: {
      schema_version: "event-audit-run-contract.v2",
      generated_at: generatedAt,
      event_records: projection.eventRecordsV2,
      audit_events: projection.auditEventsV2,
      run_ledgers: projection.runLedgersV2,
      event_run_bindings: projection.eventRunBindingsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderEventAuditRunContractFreezeMarkdown(result),
  };
}

export async function writeEventAuditRunContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "event-audit-run-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "event-record-v2-fixture.json"), {
    generated_at: result.generated_at,
    event_record_schema_version: result.contract_versions.event_record_schema_version,
    event_record_count: result.event_audit_run_contract.event_records.length,
    event_records: result.event_audit_run_contract.event_records,
  });
  await writeJson(path.join(outDir, "audit-event-v2-fixture.json"), {
    generated_at: result.generated_at,
    audit_event_schema_version: result.contract_versions.audit_event_schema_version,
    audit_event_count: result.event_audit_run_contract.audit_events.length,
    audit_events: result.event_audit_run_contract.audit_events,
  });
  await writeJson(path.join(outDir, "run-ledger-v2-fixture.json"), {
    generated_at: result.generated_at,
    run_ledger_schema_version: result.contract_versions.run_ledger_schema_version,
    run_ledger_count: result.event_audit_run_contract.run_ledgers.length,
    run_ledgers: result.event_audit_run_contract.run_ledgers,
  });
  await writeJson(path.join(outDir, "event-run-binding-v2-fixture.json"), {
    generated_at: result.generated_at,
    event_run_binding_schema_version: result.contract_versions.event_run_binding_schema_version,
    event_run_binding_count: result.event_audit_run_contract.event_run_bindings.length,
    event_run_bindings: result.event_audit_run_contract.event_run_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEventAuditRunContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEventAuditRunContractFreeze(args);
    console.log(`Event/Audit/Run Ledger contract freeze written to ${result.output_dir}`);
    console.log(`EventRecord v2: ${result.summary.event_record_count}`);
    console.log(`AuditEvent v2: ${result.summary.audit_event_count}`);
    console.log(`RunLedger v2: ${result.summary.run_ledger_count}`);
    console.log(`Correlation coverage: ${result.summary.correlation_id_declared_count}/${result.summary.correlation_required_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectEventAuditRunContracts({
  observabilityCatalog,
  controlPlaneAuditTrail,
  capabilityWorkflowContractFreeze,
  runtimeAgentRunContractFreeze,
  gateApprovalContractFreeze,
  outputDeliveryContractFreeze,
  generatedAt,
}) {
  const workflowRunsById = new Map((capabilityWorkflowContractFreeze.capability_workflow_contract?.workflow_runs ?? []).map((run) => [run.workflow_run_id, run]));
  const runtimeAgentRunsByWorkflow = groupBy(runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? [], (run) => run.workflow_run_id);
  const gatesByWorkflow = groupBy(gateApprovalContractFreeze.gate_approval_contract?.gate_results ?? [], (gate) => gate.workflow_run_id);
  const approvalsByWorkflow = groupBy(gateApprovalContractFreeze.gate_approval_contract?.approval_requests ?? [], (approval) => approval.workflow_run_id);
  const outputsByWorkflow = groupBy(outputDeliveryContractFreeze.output_delivery_contract?.output_artifacts ?? [], (artifact) => artifact.workflow_run_id);
  const eventsByCorrelation = groupBy(observabilityCatalog.event_records ?? [], (event) => event.workflow_run_id ?? event.correlation_id);
  const auditEventsByCorrelation = groupBy(controlPlaneAuditTrail.audit_events ?? [], (event) => event.correlation_id);

  const runLedgersV2 = (observabilityCatalog.run_records ?? []).map((run) => runLedgerV2({
    run,
    workflowRun: workflowRunsById.get(run.workflow_run_id),
    agentRuns: runtimeAgentRunsByWorkflow.get(run.workflow_run_id) ?? [],
    gateResults: gatesByWorkflow.get(run.workflow_run_id) ?? [],
    approvalRequests: approvalsByWorkflow.get(run.workflow_run_id) ?? [],
    outputArtifacts: outputsByWorkflow.get(run.workflow_run_id) ?? [],
    events: eventsByCorrelation.get(run.workflow_run_id) ?? [],
    auditEvents: auditEventsByCorrelation.get(run.workflow_run_id) ?? [],
    generatedAt,
  }));
  const runByWorkflowId = new Map(runLedgersV2.map((run) => [run.workflow_run_id, run]));
  const runByCorrelationId = new Map(runLedgersV2.map((run) => [run.correlation_id, run]));

  const eventRecordsV2 = (observabilityCatalog.event_records ?? []).map((event) => eventRecordV2({
    event,
    runLedger: runByWorkflowId.get(event.workflow_run_id),
    generatedAt,
  }));
  const eventRecordIds = new Set(eventRecordsV2.map((event) => event.event_record_id));
  const auditEventsV2 = (controlPlaneAuditTrail.audit_events ?? []).map((event) => auditEventV2({
    event,
    runLedger: runByCorrelationId.get(event.correlation_id),
    eventRecordIds,
    generatedAt,
  }));

  const eventRunBindingsV2 = [
    ...eventRecordsV2.map((event) => eventRunBindingV2({
      sourceKind: "event_record",
      sourceId: event.event_record_id,
      eventType: event.event_type,
      correlationId: event.correlation_id,
      workflowRunId: event.workflow_run_id,
      runLedger: runByCorrelationId.get(event.correlation_id),
      actorId: event.actor_id,
      generatedAt,
    })),
    ...auditEventsV2.map((event) => eventRunBindingV2({
      sourceKind: "audit_event",
      sourceId: event.audit_event_id,
      eventType: event.event_type,
      correlationId: event.correlation_id,
      workflowRunId: event.workflow_run_id,
      runLedger: runByCorrelationId.get(event.correlation_id),
      actorId: event.actor_id,
      generatedAt,
    })),
  ];

  return {
    eventRecordsV2,
    auditEventsV2,
    runLedgersV2,
    eventRunBindingsV2,
  };
}

function eventRecordV2({ event, runLedger, generatedAt }) {
  const actor = normalizeActor({
    actor_type: event.actor_type,
    actor_id: event.actor_id,
    display_name: event.actor_id,
  });
  const subject = normalizeSubject({
    subject_type: event.subject_type,
    subject_id: event.subject_id,
  });
  const policy = resolvePolicySnapshot(event.policy_snapshot_id, runLedger?.policy_snapshot_id, FALLBACK_EVENT_POLICY_SNAPSHOT_ID);
  const correlationId = event.workflow_run_id ?? event.correlation_id ?? `correlation.${slugify(event.event_id)}`;
  return {
    schema_version: EVENT_RECORD_SCHEMA_VERSION,
    event_record_id: event.event_id,
    source_event_id: event.event_id,
    source_id: event.source_id ?? null,
    source_label: event.source_label ?? null,
    event_type: event.event_type ?? "unknown",
    event_category: String(event.event_type ?? "unknown").split(".")[0] ?? "unknown",
    event_time: event.time ?? generatedAt,
    tenant_id: event.tenant_id ?? runLedger?.tenant_id ?? "tenant.unknown",
    matter_id: runLedger?.matter_id ?? event.data?.matter_id ?? null,
    workflow_run_id: event.workflow_run_id ?? correlationId,
    correlation_id: correlationId,
    causation_id: event.causation_id ?? null,
    actor,
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    subject,
    subject_type: subject.subject_type,
    subject_id: subject.subject_id,
    policy_snapshot_id: policy.policy_snapshot_id,
    policy_snapshot_status: policy.policy_snapshot_status,
    schema_version_status: "declared",
    run_ledger_id: runLedger?.run_ledger_id ?? null,
    run_link_status: runLedger ? "linked" : "missing_run_ledger",
    source_schema_version: event.schema_version ?? "observability-event-record.v1",
    recorded_at: generatedAt,
    data: event.data ?? {},
    metadata: {
      source_workflow_run_id: event.workflow_run_id ?? null,
    },
  };
}

function auditEventV2({ event, runLedger, eventRecordIds, generatedAt }) {
  const actor = normalizeActor({
    actor_type: event.actor_type,
    actor_id: event.actor_id,
    display_name: event.actor_display_name ?? event.actor_id,
  });
  const subject = normalizeSubject({
    subject_type: event.subject_type,
    subject_id: event.subject_id,
  });
  const policy = resolvePolicySnapshot(event.policy_snapshot_id, runLedger?.policy_snapshot_id, FALLBACK_AUDIT_POLICY_SNAPSHOT_ID);
  const correlationId = event.correlation_id ?? runLedger?.correlation_id ?? `audit.${event.source_id}.${slugify(event.audit_event_id)}`;
  const linkedEventId = eventRecordIds.has(event.raw_event_id) ? event.raw_event_id : null;
  return {
    schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    audit_event_id: event.audit_event_id,
    raw_event_id: event.raw_event_id ?? null,
    source_id: event.source_id ?? null,
    source_label: event.source_label ?? null,
    source_schema_version: event.source_schema_version ?? null,
    event_type: event.event_type ?? "unknown",
    event_category: event.event_category ?? String(event.event_type ?? "unknown").split(".")[0] ?? "unknown",
    event_time: event.time ?? generatedAt,
    tenant_id: event.tenant_id ?? runLedger?.tenant_id ?? "tenant.unknown",
    matter_id: runLedger?.matter_id ?? event.data?.matter_id ?? null,
    workflow_run_id: runLedger?.workflow_run_id ?? null,
    correlation_id: correlationId,
    actor,
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    subject,
    subject_type: subject.subject_type,
    subject_id: subject.subject_id,
    policy_snapshot_id: policy.policy_snapshot_id,
    policy_snapshot_status: policy.policy_snapshot_status,
    schema_version_status: "declared",
    protected_action_event: Boolean(event.protected_action_event),
    protected_action_executed: Boolean(event.protected_action_executed),
    event_record_id: linkedEventId,
    event_record_link_status: linkedEventId ? "linked" : "audit_only",
    run_ledger_id: runLedger?.run_ledger_id ?? null,
    run_link_status: runLedger ? "linked" : "external_control_event",
    recorded_at: generatedAt,
    data: event.data ?? {},
    metadata: event.metadata ?? {},
  };
}

function runLedgerV2({ run, workflowRun, agentRuns, gateResults, approvalRequests, outputArtifacts, events, auditEvents, generatedAt }) {
  const eventAgentRunIds = events
    .map((event) => event.actor_id)
    .filter((actorId) => String(actorId ?? "").startsWith("agent-run."));
  const agentRunIds = unique([...agentRuns.map((agentRun) => agentRun.agent_run_id), ...eventAgentRunIds].filter(Boolean));
  const actorRefs = unique([
    ...events.map((event) => event.actor_id),
    ...agentRuns.map((agentRun) => `runtime.${agentRun.runtime_id}`),
  ].filter(Boolean));
  const policy = resolvePolicySnapshot(run.policy_snapshot_id, workflowRun?.policy_snapshot_id, FALLBACK_RUN_POLICY_SNAPSHOT_ID);
  return {
    schema_version: RUN_LEDGER_SCHEMA_VERSION,
    run_ledger_id: run.run_id,
    source_run_id: run.run_id,
    source_id: run.source_id ?? null,
    source_label: run.source_label ?? null,
    tenant_id: run.tenant_id ?? workflowRun?.tenant_id ?? "tenant.unknown",
    matter_id: run.matter_id ?? workflowRun?.matter_id ?? null,
    workflow_run_id: run.workflow_run_id,
    correlation_id: run.workflow_run_id,
    capability_id: run.capability_id ?? workflowRun?.capability_id ?? null,
    domain_pack: run.domain_pack ?? workflowRun?.domain_pack ?? null,
    run_status: run.status ?? workflowRun?.status ?? "unknown",
    blocked_reason: run.blocked_reason ?? null,
    policy_snapshot_id: policy.policy_snapshot_id,
    policy_snapshot_status: policy.policy_snapshot_status,
    actor_refs: actorRefs,
    actor_count: actorRefs.length,
    actor_ref_count: actorRefs.length,
    agent_run_ids: agentRunIds,
    runtime_ids: unique([...(run.runtime_ids ?? []), ...agentRuns.map((agentRun) => agentRun.runtime_id)].filter(Boolean)),
    event_ids: events.map((event) => event.event_id),
    audit_event_ids: auditEvents.map((event) => event.audit_event_id),
    gate_result_ids: gateResults.map((gate) => gate.gate_result_id),
    approval_request_ids: approvalRequests.map((approval) => approval.approval_request_id),
    output_artifact_ids: outputArtifacts.map((artifact) => artifact.output_artifact_id),
    event_count: events.length,
    audit_event_count: auditEvents.length,
    agent_run_count: agentRunIds.length,
    gate_result_count: gateResults.length,
    approval_request_count: approvalRequests.length,
    output_artifact_count: outputArtifacts.length,
    cost_record_count: run.cost_record_count ?? 0,
    error_count: run.error_count ?? 0,
    runtime_seconds: run.runtime_seconds ?? 0,
    started_at: run.started_at ?? workflowRun?.created_at ?? generatedAt,
    updated_at: run.updated_at ?? generatedAt,
    recorded_at: generatedAt,
    metadata: {
      source_status: run.status ?? null,
      source_metadata: run.metadata ?? {},
    },
  };
}

function eventRunBindingV2({ sourceKind, sourceId, eventType, correlationId, workflowRunId, runLedger, actorId, generatedAt }) {
  const bindingStatus = runLedger
    ? "linked"
    : sourceKind === "audit_event" ? "external_control_event" : "missing_run_ledger";
  return {
    schema_version: EVENT_RUN_BINDING_SCHEMA_VERSION,
    event_run_binding_id: `event-run-binding.${slugify(sourceKind)}.${slugify(sourceId)}`,
    source_kind: sourceKind,
    source_event_kind: sourceKind,
    source_id: sourceId,
    event_record_id: sourceKind === "event_record" ? sourceId : null,
    audit_event_id: sourceKind === "audit_event" ? sourceId : null,
    event_type: eventType,
    correlation_id: correlationId,
    workflow_run_id: workflowRunId ?? runLedger?.workflow_run_id ?? null,
    run_ledger_id: runLedger?.run_ledger_id ?? null,
    binding_status: bindingStatus,
    policy_snapshot_id: runLedger?.policy_snapshot_id ?? FALLBACK_BINDING_POLICY_SNAPSHOT_ID,
    actor_id: actorId ?? null,
    recorded_at: generatedAt,
  };
}

function validateEventAuditRunContracts({
  outputDeliveryContractFreeze,
  eventRecordsV2,
  auditEventsV2,
  runLedgersV2,
  eventRunBindingsV2,
}) {
  const items = [];
  addValidation(items, {
    path: "source.output_delivery_contract_freeze",
    check_id: "output_delivery_freeze_complete",
    passed: outputDeliveryContractFreeze.summary?.freeze_status === "complete" && outputDeliveryContractFreeze.validation?.valid !== false,
    message: outputDeliveryContractFreeze.summary?.freeze_status === "complete"
      ? "Output/Delivery contract freeze is complete."
      : "Output/Delivery contract freeze must be complete before freezing Event/Audit/Run contracts.",
  });
  addValidation(items, {
    path: "contract.event_records",
    check_id: "event_record_v2_present",
    passed: eventRecordsV2.length > 0,
    message: `${eventRecordsV2.length} EventRecord v2 contract(s) projected.`,
  });
  addValidation(items, {
    path: "contract.run_ledgers",
    check_id: "run_ledger_v2_present",
    passed: runLedgersV2.length > 0,
    message: `${runLedgersV2.length} RunLedger v2 contract(s) projected.`,
  });

  for (const event of eventRecordsV2) {
    validateCommonEventFields(items, "event_record", event.event_record_id, event);
    addValidation(items, {
      path: `event_record.${event.event_record_id}.run_link_status`,
      check_id: "event_record_links_run_ledger",
      passed: event.run_link_status === "linked",
      message: event.run_link_status === "linked"
        ? `${event.event_record_id} is linked to a RunLedger v2.`
        : `${event.event_record_id} is missing a RunLedger v2 link.`,
    });
  }
  for (const event of auditEventsV2) {
    validateCommonEventFields(items, "audit_event", event.audit_event_id, event);
    addValidation(items, {
      path: `audit_event.${event.audit_event_id}.source_schema_version`,
      check_id: "audit_event_source_schema_version_present",
      passed: Boolean(event.source_schema_version),
      message: event.source_schema_version
        ? `${event.audit_event_id} preserves source schema version.`
        : `${event.audit_event_id} is missing source schema version.`,
    });
  }
  for (const run of runLedgersV2) {
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.schema_version`,
      check_id: "run_ledger_schema_version",
      passed: run.schema_version === RUN_LEDGER_SCHEMA_VERSION,
      message: `${run.run_ledger_id} uses RunLedger v2.`,
    });
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.correlation_id`,
      check_id: "run_ledger_correlation_id_present",
      passed: Boolean(run.correlation_id),
      message: `${run.run_ledger_id} has correlation_id ${run.correlation_id ?? "missing"}.`,
    });
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.policy_snapshot_id`,
      check_id: "run_ledger_policy_snapshot_present",
      passed: Boolean(run.policy_snapshot_id),
      message: `${run.run_ledger_id} has policy snapshot ${run.policy_snapshot_id ?? "missing"}.`,
    });
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.actor_refs`,
      check_id: "run_ledger_actor_refs_present",
      passed: run.actor_ref_count > 0,
      message: run.actor_ref_count > 0
        ? `${run.run_ledger_id} has ${run.actor_ref_count} actor reference(s).`
        : `${run.run_ledger_id} has no actor references.`,
    });
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.event_ids`,
      check_id: "run_ledger_event_ids_present",
      passed: run.event_count > 0,
      message: run.event_count > 0
        ? `${run.run_ledger_id} links ${run.event_count} event(s).`
        : `${run.run_ledger_id} has no event ids.`,
    });
    addValidation(items, {
      path: `run_ledger.${run.run_ledger_id}.agent_run_ids`,
      check_id: "run_ledger_agent_run_ids_present",
      passed: run.agent_run_count > 0,
      message: run.agent_run_count > 0
        ? `${run.run_ledger_id} links ${run.agent_run_count} agent run id(s).`
        : `${run.run_ledger_id} has no agent run ids.`,
    });
  }
  for (const binding of eventRunBindingsV2) {
    addValidation(items, {
      path: `event_run_binding.${binding.event_run_binding_id}.schema_version`,
      check_id: "event_run_binding_schema_version",
      passed: binding.schema_version === EVENT_RUN_BINDING_SCHEMA_VERSION,
      message: `${binding.event_run_binding_id} uses EventRunBinding v2.`,
    });
    addValidation(items, {
      path: `event_run_binding.${binding.event_run_binding_id}.binding_status`,
      check_id: "event_run_binding_status_allowed",
      passed: ["linked", "external_control_event"].includes(binding.binding_status),
      message: ["linked", "external_control_event"].includes(binding.binding_status)
        ? `${binding.event_run_binding_id} has acceptable binding status ${binding.binding_status}.`
        : `${binding.event_run_binding_id} is missing a run binding.`,
    });
  }
  return items;
}

function validateCommonEventFields(items, kind, id, event) {
  addValidation(items, {
    path: `${kind}.${id}.schema_version`,
    check_id: `${kind}_schema_version`,
    passed: event.schema_version === (kind === "audit_event" ? AUDIT_EVENT_SCHEMA_VERSION : EVENT_RECORD_SCHEMA_VERSION),
    message: `${id} uses ${kind === "audit_event" ? AUDIT_EVENT_SCHEMA_VERSION : EVENT_RECORD_SCHEMA_VERSION}.`,
  });
  addValidation(items, {
    path: `${kind}.${id}.correlation_id`,
    check_id: `${kind}_correlation_id_present`,
    passed: Boolean(event.correlation_id),
    message: `${id} has correlation_id ${event.correlation_id ?? "missing"}.`,
  });
  addValidation(items, {
    path: `${kind}.${id}.actor`,
    check_id: `${kind}_actor_present`,
    passed: Boolean(event.actor?.actor_type && event.actor?.actor_id),
    message: `${id} has actor ${event.actor?.actor_type ?? "missing"}:${event.actor?.actor_id ?? "missing"}.`,
  });
  addValidation(items, {
    path: `${kind}.${id}.policy_snapshot_id`,
    check_id: `${kind}_policy_snapshot_present`,
    passed: Boolean(event.policy_snapshot_id),
    message: `${id} has policy snapshot ${event.policy_snapshot_id ?? "missing"}.`,
  });
}

function summarizeFreeze(projection, validationItems, validation) {
  const { eventRecordsV2, auditEventsV2, runLedgersV2, eventRunBindingsV2 } = projection;
  const allEventLike = [...eventRecordsV2, ...auditEventsV2];
  const correlationRequiredCount = allEventLike.length + runLedgersV2.length;
  const correlationIdCount = allEventLike.filter((event) => event.correlation_id).length + runLedgersV2.filter((run) => run.correlation_id).length;
  const actorRequiredCount = allEventLike.length + runLedgersV2.length;
  const actorDeclaredCount = allEventLike.filter((event) => event.actor?.actor_type && event.actor?.actor_id).length + runLedgersV2.filter((run) => run.actor_ref_count > 0).length;
  const policySnapshotRequiredCount = allEventLike.length + runLedgersV2.length;
  const policySnapshotDeclaredCount = allEventLike.filter((event) => event.policy_snapshot_id).length + runLedgersV2.filter((run) => run.policy_snapshot_id).length;
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    event_record_schema_version: EVENT_RECORD_SCHEMA_VERSION,
    audit_event_schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    run_ledger_schema_version: RUN_LEDGER_SCHEMA_VERSION,
    event_run_binding_schema_version: EVENT_RUN_BINDING_SCHEMA_VERSION,
    event_record_count: eventRecordsV2.length,
    audit_event_count: auditEventsV2.length,
    run_ledger_count: runLedgersV2.length,
    event_run_binding_count: eventRunBindingsV2.length,
    linked_event_run_binding_count: eventRunBindingsV2.filter((binding) => binding.binding_status === "linked").length,
    external_audit_event_count: eventRunBindingsV2.filter((binding) => binding.binding_status === "external_control_event").length,
    missing_event_run_binding_count: eventRunBindingsV2.filter((binding) => !["linked", "external_control_event"].includes(binding.binding_status)).length,
    correlation_required_count: correlationRequiredCount,
    correlation_id_declared_count: correlationIdCount,
    correlation_id_count: correlationIdCount,
    missing_correlation_id_count: correlationRequiredCount - correlationIdCount,
    actor_required_count: actorRequiredCount,
    actor_declared_count: actorDeclaredCount,
    missing_actor_count: actorRequiredCount - actorDeclaredCount,
    policy_snapshot_required_count: policySnapshotRequiredCount,
    policy_snapshot_declared_count: policySnapshotDeclaredCount,
    missing_policy_snapshot_count: policySnapshotRequiredCount - policySnapshotDeclaredCount,
    fallback_policy_snapshot_count: allEventLike.filter((event) => event.policy_snapshot_status === "fallback_applied").length + runLedgersV2.filter((run) => run.policy_snapshot_status === "fallback_applied").length,
    source_schema_version_declared_count: auditEventsV2.filter((event) => event.source_schema_version).length,
    run_with_event_count: runLedgersV2.filter((run) => run.event_count > 0).length,
    run_with_agent_count: runLedgersV2.filter((run) => run.agent_run_count > 0).length,
    run_with_policy_snapshot_count: runLedgersV2.filter((run) => run.policy_snapshot_id).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_event_type: countBy(allEventLike, "event_type"),
    by_audit_event_type: countBy(auditEventsV2, "event_type"),
    by_actor_type: countBy(allEventLike, "actor_type"),
    by_run_status: countBy(runLedgersV2, "run_status"),
    by_binding_status: countBy(eventRunBindingsV2, "binding_status"),
    by_policy_snapshot_status: countBy([...allEventLike, ...runLedgersV2], "policy_snapshot_status"),
  };
}

function buildFieldRequirements() {
  return {
    event_record_v2: {
      required_fields: ["schema_version", "event_record_id", "event_type", "event_time", "tenant_id", "correlation_id", "actor", "subject", "policy_snapshot_id", "source_schema_version"],
      optional_fields: ["causation_id", "matter_id", "workflow_run_id", "run_ledger_id", "data", "metadata"],
      required_groups: {
        traceability: ["correlation_id", "actor", "subject", "policy_snapshot_id"],
      },
    },
    audit_event_v2: {
      required_fields: ["schema_version", "audit_event_id", "event_type", "event_time", "tenant_id", "correlation_id", "actor", "subject", "policy_snapshot_id", "source_schema_version"],
      optional_fields: ["event_record_id", "run_ledger_id", "protected_action_event", "protected_action_executed", "data", "metadata"],
      required_groups: {
        auditability: ["correlation_id", "actor", "subject", "policy_snapshot_id", "source_schema_version"],
      },
    },
    run_ledger_v2: {
      required_fields: ["schema_version", "run_ledger_id", "workflow_run_id", "correlation_id", "tenant_id", "capability_id", "policy_snapshot_id", "actor_refs", "event_ids", "started_at", "updated_at"],
      optional_fields: ["audit_event_ids", "agent_run_ids", "gate_result_ids", "approval_request_ids", "output_artifact_ids", "metadata"],
      required_groups: {
        reproduction: ["workflow_run_id", "policy_snapshot_id", "event_ids", "agent_run_ids", "output_artifact_ids"],
      },
    },
    event_run_binding_v2: {
      required_fields: ["schema_version", "event_run_binding_id", "source_kind", "source_id", "event_type", "correlation_id", "binding_status", "policy_snapshot_id"],
      optional_fields: ["workflow_run_id", "run_ledger_id"],
      required_groups: {
        correlation: ["source_id", "correlation_id", "binding_status"],
      },
    },
  };
}

function renderEventAuditRunContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Event/Audit/Run Ledger Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze ID: ${result.freeze_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Freeze status: ${result.summary.freeze_status}`);
  lines.push(`- EventRecord v2: ${result.summary.event_record_count}`);
  lines.push(`- AuditEvent v2: ${result.summary.audit_event_count}`);
  lines.push(`- RunLedger v2: ${result.summary.run_ledger_count}`);
  lines.push(`- EventRunBinding v2: ${result.summary.event_run_binding_count}`);
  lines.push(`- Correlation coverage: ${result.summary.correlation_id_declared_count}/${result.summary.correlation_required_count}`);
  lines.push(`- Actor coverage: ${result.summary.actor_declared_count}/${result.summary.actor_required_count}`);
  lines.push(`- Policy snapshot coverage: ${result.summary.policy_snapshot_declared_count}/${result.summary.policy_snapshot_required_count}`);
  lines.push(`- Fallback policy snapshots: ${result.summary.fallback_policy_snapshot_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Run Ledgers");
  lines.push("");
  for (const run of result.event_audit_run_contract.run_ledgers) {
    lines.push(`- ${run.run_ledger_id}: ${run.run_status}, events ${run.event_count}, actors ${run.actor_ref_count}`);
  }
  if (result.event_audit_run_contract.run_ledgers.length === 0) lines.push("- No run ledgers projected.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_EVENT_AUDIT_RUN_CONTRACT_FREEZE_INPUTS;
  return {
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? defaults.observabilityCatalogPath),
    control_plane_audit_trail_path: path.resolve(options.controlPlaneAuditTrailPath ?? defaults.controlPlaneAuditTrailPath),
    capability_workflow_contract_freeze_path: path.resolve(options.capabilityWorkflowContractFreezePath ?? defaults.capabilityWorkflowContractFreezePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? defaults.runtimeAgentRunContractFreezePath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? defaults.gateApprovalContractFreezePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? defaults.outputDeliveryContractFreezePath),
  };
}

function resolvePolicySnapshot(primary, fallback, unresolvedPolicySnapshotId = FALLBACK_RUN_POLICY_SNAPSHOT_ID) {
  if (primary) return { policy_snapshot_id: primary, policy_snapshot_status: "source_declared" };
  if (fallback) return { policy_snapshot_id: fallback, policy_snapshot_status: "run_inferred" };
  return { policy_snapshot_id: unresolvedPolicySnapshotId, policy_snapshot_status: "fallback_applied" };
}

function normalizeActor(actor) {
  return {
    actor_type: actor.actor_type ?? "unknown",
    actor_id: actor.actor_id ?? "unknown",
    display_name: actor.display_name ?? actor.actor_id ?? "unknown",
  };
}

function normalizeSubject(subject) {
  return {
    subject_type: subject.subject_type ?? "unknown",
    subject_id: subject.subject_id ?? "unknown",
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message, metadata = {} }) {
  items.push({
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({
      path: item.path,
      check_id: item.check_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function unique(values) {
  return [...new Set(values)];
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_EVENT_AUDIT_RUN_CONTRACT_FREEZE_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--control-plane-audit-trail") parsed.controlPlaneAuditTrailPath = argv[++index];
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/event-audit-run-contract-freeze.mjs [options]

Freeze Event/Audit/Run Ledger v2 contracts from observability and audit artifacts.

Options:
  --check                                      Exit non-zero when validation fails.
  --out-dir, --out <path>                     Output directory.
  --run-at <iso>                              Override generated_at timestamp.
  --observability-catalog <path>              Observability catalog JSON.
  --control-plane-audit-trail <path>          Control Plane audit trail JSON.
  --capability-workflow-contract-freeze <path> Capability/Workflow contract freeze JSON.
  --runtime-agentrun-contract-freeze <path>   Runtime/AgentRun contract freeze JSON.
  --gate-approval-contract-freeze <path>      Gate/Approval contract freeze JSON.
  --output-delivery-contract-freeze <path>    Output/Delivery contract freeze JSON.
`);
}
