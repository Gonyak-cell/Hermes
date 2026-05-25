import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_OUT_DIR = "artifacts/policy-snapshot-bindings/latest";
export const DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS = {
  policySnapshotLedgerPath: "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  approvalAuthorityLedgerPath: "artifacts/approval-authority/latest/approval-authority-ledger.json",
};

const DEFAULT_POLICY_BY_DOMAIN = {
  "law-firm": "policy.default.law_firm.v1",
  "personal-dev": "policy.default.personal_dev.v1",
  "creative-document": "policy.default.creative_document.v1",
  "control-plane": "policy.default.law_firm.v1",
  unknown: "policy.default.law_firm.v1",
};

const DEFAULT_POLICY_BY_TENANT = {
  "tenant.amic": "policy.default.law_firm.v1",
  "tenant.personal.jws": "policy.default.personal_dev.v1",
};

export async function runPolicySnapshotBindingLedger(options = {}) {
  const result = await buildPolicySnapshotBindingLedger(options);
  if (options.write !== false) await writePolicySnapshotBindingLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy snapshot binding ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicySnapshotBindingLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);

  const policySnapshotResult = await readJsonOrError(inputs.policy_snapshot_ledger_path);
  const capabilityWorkflowResult = await readJsonOrError(inputs.capability_workflow_contract_freeze_path);
  const runtimeAgentRunResult = await readJsonOrError(inputs.runtime_agentrun_contract_freeze_path);
  const gateApprovalResult = await readJsonOrError(inputs.gate_approval_contract_freeze_path);
  const outputDeliveryResult = await readJsonOrError(inputs.output_delivery_contract_freeze_path);
  const eventAuditRunResult = await readJsonOrError(inputs.event_audit_run_contract_freeze_path);
  const approvalAuthorityResult = await readJsonOrError(inputs.approval_authority_ledger_path);

  const projected = projectPolicySnapshotBindings({
    policySnapshotLedger: policySnapshotResult.value ?? {},
    capabilityWorkflowContractFreeze: capabilityWorkflowResult.value ?? {},
    runtimeAgentRunContractFreeze: runtimeAgentRunResult.value ?? {},
    gateApprovalContractFreeze: gateApprovalResult.value ?? {},
    outputDeliveryContractFreeze: outputDeliveryResult.value ?? {},
    eventAuditRunContractFreeze: eventAuditRunResult.value ?? {},
    approvalAuthorityLedger: approvalAuthorityResult.value ?? {},
    generatedAt,
  });
  const validationItems = validatePolicySnapshotBindings({
    policySnapshotResult,
    capabilityWorkflowResult,
    runtimeAgentRunResult,
    gateApprovalResult,
    outputDeliveryResult,
    eventAuditRunResult,
    approvalAuthorityResult,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "policy-snapshot-binding-ledger.v1",
    generated_at: generatedAt,
    policy_snapshot_binding_ledger_id: `policy-snapshot-binding-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_policy_snapshot_ledger: summarizePolicySnapshotSource(policySnapshotResult),
    source_capability_workflow_contract: summarizeFreezeSource(capabilityWorkflowResult, "capability_workflow_contract"),
    source_runtime_agentrun_contract: summarizeFreezeSource(runtimeAgentRunResult, "runtime_agentrun_contract"),
    source_gate_approval_contract: summarizeFreezeSource(gateApprovalResult, "gate_approval_contract"),
    source_output_delivery_contract: summarizeFreezeSource(outputDeliveryResult, "output_delivery_contract"),
    source_event_audit_run_contract: summarizeFreezeSource(eventAuditRunResult, "event_audit_run_contract"),
    source_approval_authority_ledger: summarizeApprovalAuthoritySource(approvalAuthorityResult),
    policy_snapshot_binding_catalog: {
      schema_version: "policy-snapshot-binding-catalog.v1",
      generated_at: generatedAt,
      workflow_policy_bindings: projected.workflowPolicyBindings,
      agent_run_policy_bindings: projected.agentRunPolicyBindings,
      event_policy_bindings: projected.eventPolicyBindings,
      gate_policy_bindings: projected.gatePolicyBindings,
      approval_policy_bindings: projected.approvalPolicyBindings,
      output_policy_bindings: projected.outputPolicyBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizePolicySnapshotBindings(projected, validationItems, validation, {
      policySnapshotResult,
      capabilityWorkflowResult,
      runtimeAgentRunResult,
      gateApprovalResult,
      outputDeliveryResult,
      eventAuditRunResult,
      approvalAuthorityResult,
    }),
  };
  return {
    ...result,
    markdown: renderPolicySnapshotBindingMarkdown(result),
  };
}

export async function writePolicySnapshotBindingLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "policy-snapshot-binding-ledger.json"), serializable);
  await writeJson(path.join(outDir, "policy-snapshot-binding-catalog.json"), result.policy_snapshot_binding_catalog);
  await writeJson(path.join(outDir, "workflow-policy-bindings.json"), {
    generated_at: result.generated_at,
    workflow_policy_binding_count: result.policy_snapshot_binding_catalog.workflow_policy_bindings.length,
    workflow_policy_bindings: result.policy_snapshot_binding_catalog.workflow_policy_bindings,
  });
  await writeJson(path.join(outDir, "agent-run-policy-bindings.json"), {
    generated_at: result.generated_at,
    agent_run_policy_binding_count: result.policy_snapshot_binding_catalog.agent_run_policy_bindings.length,
    agent_run_policy_bindings: result.policy_snapshot_binding_catalog.agent_run_policy_bindings,
  });
  await writeJson(path.join(outDir, "event-policy-bindings.json"), {
    generated_at: result.generated_at,
    event_policy_binding_count: result.policy_snapshot_binding_catalog.event_policy_bindings.length,
    event_policy_bindings: result.policy_snapshot_binding_catalog.event_policy_bindings,
  });
  await writeJson(path.join(outDir, "gate-policy-bindings.json"), {
    generated_at: result.generated_at,
    gate_policy_binding_count: result.policy_snapshot_binding_catalog.gate_policy_bindings.length,
    gate_policy_bindings: result.policy_snapshot_binding_catalog.gate_policy_bindings,
  });
  await writeJson(path.join(outDir, "approval-policy-bindings.json"), {
    generated_at: result.generated_at,
    approval_policy_binding_count: result.policy_snapshot_binding_catalog.approval_policy_bindings.length,
    approval_policy_bindings: result.policy_snapshot_binding_catalog.approval_policy_bindings,
  });
  await writeJson(path.join(outDir, "output-policy-bindings.json"), {
    generated_at: result.generated_at,
    output_policy_binding_count: result.policy_snapshot_binding_catalog.output_policy_bindings.length,
    output_policy_bindings: result.policy_snapshot_binding_catalog.output_policy_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    policy_snapshot_binding_ledger_id: result.policy_snapshot_binding_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicySnapshotBindingLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicySnapshotBindingLedger(args);
    console.log(`Policy snapshot binding ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.policy_snapshot_binding_status}`);
    console.log(`Bindings: ${result.summary.policy_snapshot_binding_count}`);
    console.log(`Fallback-resolved bindings: ${result.summary.fallback_resolved_binding_count}`);
    console.log(`Missing snapshots: ${result.summary.missing_policy_snapshot_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectPolicySnapshotBindings({
  policySnapshotLedger,
  capabilityWorkflowContractFreeze,
  runtimeAgentRunContractFreeze,
  gateApprovalContractFreeze,
  outputDeliveryContractFreeze,
  eventAuditRunContractFreeze,
  approvalAuthorityLedger,
  generatedAt,
}) {
  const snapshotsById = new Map((policySnapshotLedger.policy_snapshots ?? []).map((snapshot) => [snapshot.policy_snapshot_id, snapshot]));
  const decisionsBySnapshotId = new Map((policySnapshotLedger.policy_decisions ?? []).map((decision) => [decision.policy_snapshot_id, decision]));
  const capabilityContract = capabilityWorkflowContractFreeze.capability_workflow_contract ?? {};
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const gateApprovalContract = gateApprovalContractFreeze.gate_approval_contract ?? {};
  const outputDeliveryContract = outputDeliveryContractFreeze.output_delivery_contract ?? {};
  const eventAuditRunContract = eventAuditRunContractFreeze.event_audit_run_contract ?? {};
  const approvalAuthorityCatalog = approvalAuthorityLedger.approval_authority_catalog ?? {};

  const workflowRuns = capabilityContract.workflow_runs ?? [];
  const workflowById = new Map(workflowRuns.map((workflowRun) => [workflowRun.workflow_run_id, workflowRun]));
  const outputArtifacts = outputDeliveryContract.output_artifacts ?? [];
  const outputById = new Map(outputArtifacts.map((artifact) => [artifact.output_artifact_id, artifact]));
  const authorityByApprovalRequestId = new Map((approvalAuthorityCatalog.approval_request_authority_decisions ?? []).map((decision) => [decision.approval_request_id, decision]));
  const authorityByOutputArtifactId = new Map((approvalAuthorityCatalog.artifact_authority_decisions ?? []).map((decision) => [decision.output_artifact_id, decision]));
  const authorityByDeliveryActionId = new Map((approvalAuthorityCatalog.delivery_action_authority_decisions ?? []).map((decision) => [decision.delivery_action_id, decision]));

  const resolverContext = {
    snapshotsById,
    decisionsBySnapshotId,
    workflowById,
    outputById,
    generatedAt,
  };

  const workflowPolicyBindings = workflowRuns.map((workflowRun) => policyBinding({
    ...resolverContext,
    bindingKind: "workflow",
    bindingIdField: "workflow_policy_binding_id",
    subjectType: "workflow_run",
    subjectId: workflowRun.workflow_run_id,
    workflowRunId: workflowRun.workflow_run_id,
    domainPack: workflowRun.domain_pack,
    tenantId: workflowRun.tenant_id,
    matterId: workflowRun.matter_id,
    declaredPolicySnapshotId: workflowRun.policy_snapshot_id,
    metadata: {
      workflow_id: workflowRun.workflow_id,
      capability_id: workflowRun.capability_id,
      run_status: workflowRun.status,
    },
  })).sort(by("workflow_policy_binding_id"));

  const agentRunPolicyBindings = (runtimeContract.agent_runs ?? []).map((agentRun) => {
    const workflowRun = workflowById.get(agentRun.workflow_run_id);
    return policyBinding({
      ...resolverContext,
      bindingKind: "agent_run",
      bindingIdField: "agent_run_policy_binding_id",
      subjectType: "agent_run",
      subjectId: agentRun.agent_run_id,
      workflowRunId: agentRun.workflow_run_id,
      agentRunId: agentRun.agent_run_id,
      domainPack: firstPresent(agentRun.domain_pack, workflowRun?.domain_pack),
      tenantId: firstPresent(agentRun.tenant_id, workflowRun?.tenant_id),
      matterId: firstPresent(agentRun.matter_id, workflowRun?.matter_id),
      declaredPolicySnapshotId: agentRun.policy_snapshot_id,
      metadata: {
        runtime_id: agentRun.runtime_id,
        risk_level: agentRun.risk_level ?? null,
        verification_status: agentRun.verification_status ?? null,
      },
    });
  }).sort(by("agent_run_policy_binding_id"));

  const eventPolicyBindings = [
    ...(eventAuditRunContract.event_records ?? []).map((eventRecord) => policyBinding({
      ...resolverContext,
      bindingKind: "event",
      bindingIdField: "event_policy_binding_id",
      subjectType: "event_record",
      subjectId: eventRecord.event_record_id,
      workflowRunId: eventRecord.workflow_run_id,
      domainPack: inferDomainFromWorkflow(workflowById.get(eventRecord.workflow_run_id)),
      tenantId: eventRecord.tenant_id,
      matterId: eventRecord.matter_id,
      declaredPolicySnapshotId: eventRecord.policy_snapshot_id,
      metadata: {
        event_type: eventRecord.event_type,
        event_id: eventRecord.event_id,
        policy_snapshot_status: eventRecord.policy_snapshot_status ?? null,
      },
    })),
    ...(eventAuditRunContract.audit_events ?? []).map((auditEvent) => policyBinding({
      ...resolverContext,
      bindingKind: "event",
      bindingIdField: "event_policy_binding_id",
      subjectType: "audit_event",
      subjectId: auditEvent.audit_event_id,
      workflowRunId: auditEvent.workflow_run_id,
      domainPack: firstPresent(inferDomainFromWorkflow(workflowById.get(auditEvent.workflow_run_id)), "control-plane"),
      tenantId: auditEvent.tenant_id,
      matterId: auditEvent.matter_id,
      declaredPolicySnapshotId: auditEvent.policy_snapshot_id,
      metadata: {
        event_type: auditEvent.event_type,
        policy_snapshot_status: auditEvent.policy_snapshot_status ?? null,
      },
    })),
    ...(eventAuditRunContract.run_ledgers ?? []).map((runLedger) => policyBinding({
      ...resolverContext,
      bindingKind: "event",
      bindingIdField: "event_policy_binding_id",
      subjectType: "run_ledger",
      subjectId: runLedger.run_ledger_id,
      workflowRunId: runLedger.workflow_run_id,
      domainPack: inferDomainFromWorkflow(workflowById.get(runLedger.workflow_run_id)),
      tenantId: runLedger.tenant_id,
      matterId: runLedger.matter_id,
      declaredPolicySnapshotId: runLedger.policy_snapshot_id,
      metadata: {
        run_status: runLedger.run_status ?? null,
        policy_snapshot_status: runLedger.policy_snapshot_status ?? null,
        agent_run_count: runLedger.agent_run_ids?.length ?? 0,
      },
    })),
  ].sort(by("event_policy_binding_id"));

  const gatePolicyBindings = (gateApprovalContract.gate_results ?? []).map((gateResult) => {
    const workflowRun = workflowById.get(gateResult.workflow_run_id);
    return policyBinding({
      ...resolverContext,
      bindingKind: "gate",
      bindingIdField: "gate_policy_binding_id",
      subjectType: "gate_result",
      subjectId: gateResult.gate_result_id,
      workflowRunId: gateResult.workflow_run_id,
      domainPack: firstPresent(gateResult.domain_pack, workflowRun?.domain_pack),
      tenantId: firstPresent(gateResult.tenant_id, workflowRun?.tenant_id),
      matterId: firstPresent(gateResult.matter_id, workflowRun?.matter_id),
      declaredPolicySnapshotId: gateResult.policy_snapshot_id,
      metadata: {
        gate_id: gateResult.gate_id,
        gate_stage: gateResult.gate_stage ?? null,
        outcome: gateResult.outcome ?? null,
      },
    });
  }).sort(by("gate_policy_binding_id"));

  const approvalPolicyBindings = (gateApprovalContract.approval_requests ?? []).map((request) => {
    const artifact = outputById.get(request.output_artifact_id);
    const authorityDecision = authorityByApprovalRequestId.get(request.approval_request_id);
    const workflowRun = workflowById.get(request.workflow_run_id ?? artifact?.workflow_run_id);
    return policyBinding({
      ...resolverContext,
      bindingKind: "approval",
      bindingIdField: "approval_policy_binding_id",
      subjectType: "approval_request",
      subjectId: request.approval_request_id,
      workflowRunId: firstPresent(request.workflow_run_id, artifact?.workflow_run_id),
      outputArtifactId: request.output_artifact_id ?? null,
      domainPack: firstPresent(request.domain_pack, artifact?.domain_pack, authorityDecision?.domain_pack, workflowRun?.domain_pack),
      tenantId: firstPresent(request.tenant_id, artifact?.tenant_id, authorityDecision?.tenant_id, workflowRun?.tenant_id),
      matterId: firstPresent(request.matter_id, artifact?.matter_id, authorityDecision?.matter_id, workflowRun?.matter_id),
      declaredPolicySnapshotId: request.policy_snapshot_id,
      linkedPolicySnapshotId: artifact?.policy_snapshot_id,
      metadata: {
        approval_kind: request.approval_kind ?? null,
        request_status: request.request_status ?? null,
        required_actor: request.required_actor ?? authorityDecision?.required_actor ?? null,
        authority_status: authorityDecision?.authority_status ?? null,
      },
    });
  }).sort(by("approval_policy_binding_id"));

  const outputPolicyBindings = [
    ...outputArtifacts.map((artifact) => {
      const workflowRun = workflowById.get(artifact.workflow_run_id);
      const authorityDecision = authorityByOutputArtifactId.get(artifact.output_artifact_id);
      return policyBinding({
        ...resolverContext,
        bindingKind: "output",
        bindingIdField: "output_policy_binding_id",
        subjectType: "output_artifact",
        subjectId: artifact.output_artifact_id,
        workflowRunId: artifact.workflow_run_id,
        outputArtifactId: artifact.output_artifact_id,
        domainPack: firstPresent(artifact.domain_pack, authorityDecision?.domain_pack, workflowRun?.domain_pack),
        tenantId: firstPresent(artifact.tenant_id, authorityDecision?.tenant_id, workflowRun?.tenant_id),
        matterId: firstPresent(artifact.matter_id, authorityDecision?.matter_id, workflowRun?.matter_id),
        declaredPolicySnapshotId: artifact.policy_snapshot_id,
        metadata: {
          artifact_type: artifact.artifact_type ?? null,
          delivery_status: artifact.delivery_status ?? null,
          authority_status: authorityDecision?.authority_status ?? null,
        },
      });
    }),
    ...(outputDeliveryContract.delivery_actions ?? []).map((action) => {
      const artifact = outputById.get(action.output_artifact_id);
      const workflowRun = workflowById.get(action.workflow_run_id ?? artifact?.workflow_run_id);
      const authorityDecision = authorityByDeliveryActionId.get(action.delivery_action_id);
      return policyBinding({
        ...resolverContext,
        bindingKind: "output",
        bindingIdField: "output_policy_binding_id",
        subjectType: "delivery_action",
        subjectId: action.delivery_action_id,
        workflowRunId: firstPresent(action.workflow_run_id, artifact?.workflow_run_id),
        outputArtifactId: action.output_artifact_id,
        domainPack: firstPresent(action.domain_pack, artifact?.domain_pack, authorityDecision?.domain_pack, workflowRun?.domain_pack),
        tenantId: firstPresent(action.tenant_id, artifact?.tenant_id, authorityDecision?.tenant_id, workflowRun?.tenant_id),
        matterId: firstPresent(action.matter_id, artifact?.matter_id, authorityDecision?.matter_id, workflowRun?.matter_id),
        declaredPolicySnapshotId: action.policy_snapshot_id,
        linkedPolicySnapshotId: artifact?.policy_snapshot_id,
        metadata: {
          delivery_channel: action.delivery_channel ?? null,
          delivery_status: action.delivery_status ?? null,
          authority_status: authorityDecision?.authority_status ?? null,
        },
      });
    }),
  ].sort(by("output_policy_binding_id"));

  return {
    workflowPolicyBindings,
    agentRunPolicyBindings,
    eventPolicyBindings,
    gatePolicyBindings,
    approvalPolicyBindings,
    outputPolicyBindings,
    allBindings: [
      ...workflowPolicyBindings,
      ...agentRunPolicyBindings,
      ...eventPolicyBindings,
      ...gatePolicyBindings,
      ...approvalPolicyBindings,
      ...outputPolicyBindings,
    ],
    policySnapshots: policySnapshotLedger.policy_snapshots ?? [],
  };
}

function policyBinding({
  snapshotsById,
  decisionsBySnapshotId,
  workflowById,
  outputById,
  generatedAt,
  bindingKind,
  bindingIdField,
  subjectType,
  subjectId,
  workflowRunId = null,
  agentRunId = null,
  outputArtifactId = null,
  domainPack = null,
  tenantId = null,
  matterId = null,
  declaredPolicySnapshotId = null,
  linkedPolicySnapshotId = null,
  metadata = {},
}) {
  const workflowRun = workflowById.get(workflowRunId);
  const artifact = outputById.get(outputArtifactId);
  const resolvedDomainPack = firstPresent(domainPack, workflowRun?.domain_pack, artifact?.domain_pack, "unknown");
  const resolvedTenantId = firstPresent(tenantId, workflowRun?.tenant_id, artifact?.tenant_id, null);
  const resolvedMatterId = firstPresent(matterId, workflowRun?.matter_id, artifact?.matter_id, null);
  const resolution = resolvePolicySnapshot({
    snapshotsById,
    declaredPolicySnapshotId,
    linkedPolicySnapshotId,
    workflowPolicySnapshotId: workflowRun?.policy_snapshot_id,
    domainPack: resolvedDomainPack,
    tenantId: resolvedTenantId,
  });
  const snapshot = resolution.policy_snapshot_id ? snapshotsById.get(resolution.policy_snapshot_id) : null;
  const decision = resolution.policy_snapshot_id ? decisionsBySnapshotId.get(resolution.policy_snapshot_id) : null;
  const bindingId = `policy-binding.${bindingKind}.${slugify(subjectType)}.${slugify(subjectId)}`;
  const reasonCodes = [...resolution.reason_codes];
  if (workflowRunId) reasonCodes.push("workflow_run_context_available");
  if (outputArtifactId) reasonCodes.push("output_artifact_context_available");
  if (resolvedMatterId) reasonCodes.push("matter_boundary_context_available");
  else reasonCodes.push("matter_boundary_context_missing_or_not_applicable");
  const binding = {
    schema_version: `${bindingKind}-policy-binding.v1`,
    [bindingIdField]: bindingId,
    binding_id: bindingId,
    subject_ref: {
      subject_type: subjectType,
      subject_id: subjectId,
    },
    subject_type: subjectType,
    subject_id: subjectId,
    workflow_run_id: workflowRunId ?? null,
    agent_run_id: agentRunId,
    output_artifact_id: outputArtifactId,
    domain_pack: resolvedDomainPack,
    tenant_id: resolvedTenantId,
    matter_id: resolvedMatterId,
    declared_policy_snapshot_id: declaredPolicySnapshotId ?? null,
    inherited_workflow_policy_snapshot_id: workflowRun?.policy_snapshot_id ?? null,
    linked_output_policy_snapshot_id: linkedPolicySnapshotId ?? artifact?.policy_snapshot_id ?? null,
    policy_snapshot_id: resolution.policy_snapshot_id,
    policy_snapshot_known: Boolean(snapshot),
    policy_snapshot_status: resolution.policy_snapshot_status,
    binding_source: resolution.binding_source,
    binding_status: snapshot ? "bound" : "needs_policy_snapshot",
    default_classification: snapshot?.default_classification ?? null,
    max_input_classification: snapshot?.max_input_classification ?? null,
    external_model_policy: decision?.external_model_policy ?? null,
    local_model_policy: decision?.local_model_policy ?? null,
    redaction_policy: decision?.redaction_policy ?? null,
    approval_required: decision?.approval_required ?? false,
    required_gates: decision?.required_gates ?? [],
    reason_codes: unique(reasonCodes),
    bound_at: generatedAt,
    metadata,
  };
  return binding;
}

function resolvePolicySnapshot({
  snapshotsById,
  declaredPolicySnapshotId,
  linkedPolicySnapshotId,
  workflowPolicySnapshotId,
  domainPack,
  tenantId,
}) {
  const declaredIsUnresolved = isUnresolvedPolicySnapshotId(declaredPolicySnapshotId);
  const candidates = [
    candidate(declaredPolicySnapshotId, "source_declared", declaredIsUnresolved ? ["declared_snapshot_is_unresolved_placeholder"] : ["declared_snapshot_reference_present"], !declaredIsUnresolved),
    candidate(linkedPolicySnapshotId, "linked_output_inherited", ["linked_output_snapshot_reference_present"]),
    candidate(workflowPolicySnapshotId, "workflow_inherited", ["workflow_snapshot_reference_present"]),
    candidate(DEFAULT_POLICY_BY_DOMAIN[domainPack], "domain_default_fallback", ["domain_default_snapshot_applied"]),
    candidate(DEFAULT_POLICY_BY_TENANT[tenantId], "tenant_default_fallback", ["tenant_default_snapshot_applied"]),
    candidate(DEFAULT_POLICY_BY_DOMAIN.unknown, "global_default_fallback", ["global_default_snapshot_applied"]),
  ].filter(Boolean);

  for (const item of candidates) {
    if (item.usable && snapshotsById.has(item.policy_snapshot_id)) {
      return {
        policy_snapshot_id: item.policy_snapshot_id,
        policy_snapshot_status: item.binding_source.includes("fallback") || declaredIsUnresolved || !declaredPolicySnapshotId ? "fallback_resolved" : "resolved",
        binding_source: item.binding_source,
        reason_codes: unique([
          ...item.reason_codes,
          declaredIsUnresolved ? "unresolved_declared_snapshot_resolved_by_fallback" : null,
          "policy_snapshot_found_in_ledger",
        ]),
      };
    }
  }

  const preferred = firstPresent(declaredPolicySnapshotId, linkedPolicySnapshotId, workflowPolicySnapshotId, DEFAULT_POLICY_BY_DOMAIN[domainPack], DEFAULT_POLICY_BY_TENANT[tenantId], null);
  return {
    policy_snapshot_id: preferred,
    policy_snapshot_status: preferred ? "unresolved" : "missing",
    binding_source: "unresolved",
    reason_codes: unique([
      declaredIsUnresolved ? "declared_snapshot_is_unresolved_placeholder" : null,
      "policy_snapshot_not_found_in_ledger",
    ]),
  };
}

function candidate(policySnapshotId, bindingSource, reasonCodes, usable = true) {
  if (!policySnapshotId) return null;
  return {
    policy_snapshot_id: policySnapshotId,
    binding_source: bindingSource,
    reason_codes: reasonCodes,
    usable,
  };
}

function validatePolicySnapshotBindings({
  policySnapshotResult,
  capabilityWorkflowResult,
  runtimeAgentRunResult,
  gateApprovalResult,
  outputDeliveryResult,
  eventAuditRunResult,
  approvalAuthorityResult,
  projected,
}) {
  const items = [];
  addSourceValidation(items, "policy_snapshot_ledger", policySnapshotResult, policySnapshotResult.value?.ledger_status === "valid");
  addSourceValidation(items, "capability_workflow_contract", capabilityWorkflowResult, capabilityWorkflowResult.value?.summary?.freeze_status === "complete");
  addSourceValidation(items, "runtime_agentrun_contract", runtimeAgentRunResult, runtimeAgentRunResult.value?.summary?.freeze_status === "complete");
  addSourceValidation(items, "gate_approval_contract", gateApprovalResult, gateApprovalResult.value?.summary?.freeze_status === "complete");
  addSourceValidation(items, "output_delivery_contract", outputDeliveryResult, outputDeliveryResult.value?.summary?.freeze_status === "complete");
  addSourceValidation(items, "event_audit_run_contract", eventAuditRunResult, eventAuditRunResult.value?.summary?.freeze_status === "complete");
  addSourceValidation(items, "approval_authority_ledger", approvalAuthorityResult, approvalAuthorityResult.value?.summary?.approval_authority_status === "complete");

  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "workflow_policy_bindings",
    check_id: "workflow_policy_bindings_present",
    passed: projected.workflowPolicyBindings.length > 0,
    message: `${projected.workflowPolicyBindings.length} workflow policy binding(s) projected.`,
  });
  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "agent_run_policy_bindings",
    check_id: "agent_run_policy_bindings_present",
    passed: projected.agentRunPolicyBindings.length > 0,
    message: `${projected.agentRunPolicyBindings.length} agent run policy binding(s) projected.`,
  });
  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "event_policy_bindings",
    check_id: "event_policy_bindings_present",
    passed: projected.eventPolicyBindings.length > 0,
    message: `${projected.eventPolicyBindings.length} event/run policy binding(s) projected.`,
  });
  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "gate_policy_bindings",
    check_id: "gate_policy_bindings_present",
    passed: projected.gatePolicyBindings.length > 0,
    message: `${projected.gatePolicyBindings.length} gate policy binding(s) projected.`,
  });
  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "approval_policy_bindings",
    check_id: "approval_policy_bindings_present",
    passed: projected.approvalPolicyBindings.length > 0,
    message: `${projected.approvalPolicyBindings.length} approval policy binding(s) projected.`,
  });
  addValidation(items, {
    subject_type: "policy_snapshot_binding_catalog",
    subject_id: "output_policy_bindings",
    check_id: "output_policy_bindings_present",
    passed: projected.outputPolicyBindings.length > 0,
    message: `${projected.outputPolicyBindings.length} output policy binding(s) projected.`,
  });

  for (const binding of projected.allBindings) {
    addValidation(items, {
      subject_type: binding.subject_type,
      subject_id: binding.subject_id,
      check_id: "policy_snapshot_known",
      passed: binding.policy_snapshot_known,
      message: `${binding.subject_id} resolves to ${binding.policy_snapshot_id ?? "missing"}.`,
      metadata: {
        binding_id: binding.binding_id,
        binding_source: binding.binding_source,
        policy_snapshot_status: binding.policy_snapshot_status,
      },
    });
    addValidation(items, {
      subject_type: binding.subject_type,
      subject_id: binding.subject_id,
      check_id: "binding_status_bound",
      passed: binding.binding_status === "bound",
      message: `${binding.subject_id} binding status is ${binding.binding_status}.`,
      metadata: {
        binding_id: binding.binding_id,
        policy_snapshot_id: binding.policy_snapshot_id,
      },
    });
  }

  return items;
}

function addSourceValidation(items, sourceId, result, sourceSpecificPassed) {
  addValidation(items, {
    subject_type: "source",
    subject_id: sourceId,
    check_id: "source_available",
    passed: result.ok,
    message: result.ok ? `${sourceId} source is available.` : `${sourceId} source unavailable: ${result.error}`,
  });
  addValidation(items, {
    subject_type: "source",
    subject_id: sourceId,
    check_id: "source_status_complete",
    passed: result.ok && sourceSpecificPassed,
    message: result.ok && sourceSpecificPassed ? `${sourceId} source status is complete.` : `${sourceId} source status is not complete.`,
  });
}

function summarizePolicySnapshotBindings(projected, validationItems, validation, sources) {
  const allBindings = projected.allBindings;
  const fallbackResolvedBindings = allBindings.filter((binding) => binding.policy_snapshot_status === "fallback_resolved");
  const missingBindings = allBindings.filter((binding) => !binding.policy_snapshot_known);
  const unresolvedDeclaredBindings = allBindings.filter((binding) => isUnresolvedPolicySnapshotId(binding.declared_policy_snapshot_id));
  return {
    policy_snapshot_binding_status: validation.valid ? "complete" : "blocked",
    source_policy_snapshot_ledger_status: sources.policySnapshotResult.value?.ledger_status ?? (sources.policySnapshotResult.ok ? "unknown" : "missing"),
    source_capability_workflow_contract_status: sourceFreezeStatus(sources.capabilityWorkflowResult),
    source_runtime_agentrun_contract_status: sourceFreezeStatus(sources.runtimeAgentRunResult),
    source_gate_approval_contract_status: sourceFreezeStatus(sources.gateApprovalResult),
    source_output_delivery_contract_status: sourceFreezeStatus(sources.outputDeliveryResult),
    source_event_audit_run_contract_status: sourceFreezeStatus(sources.eventAuditRunResult),
    source_approval_authority_status: sources.approvalAuthorityResult.value?.summary?.approval_authority_status ?? (sources.approvalAuthorityResult.ok ? "unknown" : "missing"),
    policy_snapshot_count: projected.policySnapshots.length,
    workflow_policy_binding_count: projected.workflowPolicyBindings.length,
    agent_run_policy_binding_count: projected.agentRunPolicyBindings.length,
    event_policy_binding_count: projected.eventPolicyBindings.length,
    gate_policy_binding_count: projected.gatePolicyBindings.length,
    approval_policy_binding_count: projected.approvalPolicyBindings.length,
    output_policy_binding_count: projected.outputPolicyBindings.length,
    policy_snapshot_binding_count: allBindings.length,
    known_policy_snapshot_binding_count: allBindings.filter((binding) => binding.policy_snapshot_known).length,
    resolved_binding_count: allBindings.filter((binding) => binding.policy_snapshot_status === "resolved").length,
    fallback_resolved_binding_count: fallbackResolvedBindings.length,
    source_declared_binding_count: allBindings.filter((binding) => binding.binding_source === "source_declared").length,
    workflow_inherited_binding_count: allBindings.filter((binding) => binding.binding_source === "workflow_inherited").length,
    linked_output_inherited_binding_count: allBindings.filter((binding) => binding.binding_source === "linked_output_inherited").length,
    domain_fallback_binding_count: allBindings.filter((binding) => binding.binding_source === "domain_default_fallback").length,
    tenant_fallback_binding_count: allBindings.filter((binding) => binding.binding_source === "tenant_default_fallback").length,
    global_fallback_binding_count: allBindings.filter((binding) => binding.binding_source === "global_default_fallback").length,
    fallback_binding_count: fallbackResolvedBindings.length,
    unresolved_declared_reference_count: unresolvedDeclaredBindings.length,
    missing_policy_snapshot_count: missingBindings.length,
    unresolved_policy_snapshot_count: allBindings.filter((binding) => binding.policy_snapshot_status === "unresolved").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_subject_type: countBy(allBindings, "subject_type"),
    by_binding_source: countBy(allBindings, "binding_source"),
    by_binding_status: countBy(allBindings, "binding_status"),
    by_policy_snapshot_id: countBy(allBindings, "policy_snapshot_id"),
    by_domain_pack: countBy(allBindings, "domain_pack"),
  };
}

function renderPolicySnapshotBindingMarkdown(result) {
  const summary = result.summary ?? {};
  const lines = [];
  lines.push("# Policy Snapshot Binding Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.policy_snapshot_binding_status}`);
  lines.push("");
  lines.push(`- Bindings: ${summary.policy_snapshot_binding_count}`);
  lines.push(`- Known snapshots: ${summary.known_policy_snapshot_binding_count}`);
  lines.push(`- Workflow bindings: ${summary.workflow_policy_binding_count}`);
  lines.push(`- AgentRun bindings: ${summary.agent_run_policy_binding_count}`);
  lines.push(`- Event/run bindings: ${summary.event_policy_binding_count}`);
  lines.push(`- Gate bindings: ${summary.gate_policy_binding_count}`);
  lines.push(`- Approval bindings: ${summary.approval_policy_binding_count}`);
  lines.push(`- Output bindings: ${summary.output_policy_binding_count}`);
  lines.push(`- Fallback-resolved bindings: ${summary.fallback_resolved_binding_count}`);
  lines.push(`- Missing snapshots: ${summary.missing_policy_snapshot_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Binding Sources");
  lines.push("");
  for (const [source, count] of Object.entries(summary.by_binding_source ?? {}).sort()) {
    lines.push(`- ${source}: ${count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    policy_snapshot_ledger_path: path.resolve(options.policySnapshotLedgerPath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.policySnapshotLedgerPath),
    capability_workflow_contract_freeze_path: path.resolve(options.capabilityWorkflowContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.capabilityWorkflowContractFreezePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.runtimeAgentRunContractFreezePath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.gateApprovalContractFreezePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.outputDeliveryContractFreezePath),
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.eventAuditRunContractFreezePath),
    approval_authority_ledger_path: path.resolve(options.approvalAuthorityLedgerPath ?? DEFAULT_POLICY_SNAPSHOT_BINDING_LEDGER_INPUTS.approvalAuthorityLedgerPath),
  };
}

function summarizePolicySnapshotSource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.ok ? result.value?.ledger_status ?? "available" : "missing",
    error: result.error,
    policy_snapshot_count: result.value?.summary?.policy_snapshot_count ?? 0,
    policy_decision_count: result.value?.summary?.policy_decision_count ?? 0,
    validation_error_count: result.value?.summary?.validation_error_count ?? result.value?.validation?.errors?.length ?? 0,
  };
}

function summarizeFreezeSource(result, contractKey) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.ok ? result.value?.summary?.freeze_status ?? "available" : "missing",
    error: result.error,
    contract_schema_version: result.value?.[contractKey]?.schema_version ?? null,
    validation_error_count: result.value?.summary?.validation_error_count ?? result.value?.validation?.errors?.length ?? 0,
  };
}

function summarizeApprovalAuthoritySource(result) {
  return {
    schema_version: result.value?.schema_version ?? null,
    status: result.ok ? result.value?.summary?.approval_authority_status ?? "available" : "missing",
    error: result.error,
    authority_decision_count: result.value?.summary?.authority_decision_count ?? 0,
    validation_error_count: result.value?.summary?.validation_error_count ?? result.value?.validation?.errors?.length ?? 0,
  };
}

function sourceFreezeStatus(result) {
  return result.value?.summary?.freeze_status ?? (result.ok ? "unknown" : "missing");
}

function inferDomainFromWorkflow(workflowRun) {
  return workflowRun?.domain_pack ?? null;
}

function isUnresolvedPolicySnapshotId(policySnapshotId) {
  return typeof policySnapshotId === "string" && policySnapshotId.includes("unresolved");
}

function serializableLedger(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    policy_snapshot_binding_ledger_id: result.policy_snapshot_binding_ledger_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_policy_snapshot_ledger: result.source_policy_snapshot_ledger,
    source_capability_workflow_contract: result.source_capability_workflow_contract,
    source_runtime_agentrun_contract: result.source_runtime_agentrun_contract,
    source_gate_approval_contract: result.source_gate_approval_contract,
    source_output_delivery_contract: result.source_output_delivery_contract,
    source_event_audit_run_contract: result.source_event_audit_run_contract,
    source_approval_authority_ledger: result.source_approval_authority_ledger,
    policy_snapshot_binding_catalog: result.policy_snapshot_binding_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function addValidation(items, input) {
  const status = input.passed ? "passed" : "failed";
  items.push({
    schema_version: "policy-snapshot-binding-validation.v1",
    validation_id: `policy-snapshot-binding-validation.${slugify(input.subject_type)}.${slugify(input.subject_id)}.${slugify(input.check_id)}`,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    check_id: input.check_id,
    status,
    message: input.message,
    metadata: input.metadata ?? {},
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({
      path: `${item.subject_type}.${item.subject_id}.${item.check_id}`,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function by(field) {
  return (left, right) => String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
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
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--approval-authority-ledger") parsed.approvalAuthorityLedgerPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-snapshot-binding-ledger.mjs [options]

Options:
  --check                                      Fail if any binding validation item fails.
  --no-write                                   Build without writing artifacts.
  --out-dir <path>                             Output directory.
  --run-at <iso>                               Fixed generated_at timestamp.
  --policy-snapshot-ledger <path>              policy-snapshot-ledger.json path.
  --capability-workflow-contract-freeze <path> capability-workflow-contract-freeze.json path.
  --runtime-agentrun-contract-freeze <path>    runtime-agentrun-contract-freeze.json path.
  --gate-approval-contract-freeze <path>       gate-approval-contract-freeze.json path.
  --output-delivery-contract-freeze <path>     output-delivery-contract-freeze.json path.
  --event-audit-run-contract-freeze <path>     event-audit-run-contract-freeze.json path.
  --approval-authority-ledger <path>           approval-authority-ledger.json path.
`);
}
