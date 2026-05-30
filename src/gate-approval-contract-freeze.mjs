import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_OUT_DIR = "artifacts/gate-approval-contract-freeze/latest";
export const DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS = {
  lawFirmSlicePath: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  personalDevSlicePath: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  creativeDocumentSlicePath: "artifacts/creative-document-slice/latest/creative-document-slice.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  approvalQueuePath: "artifacts/approval-queue/latest/approval-queue.json",
  approvalDecisionPath: "artifacts/approval-decisions/latest/approval-decision-result.json",
  approvalInboxPath: "artifacts/approval-inbox/latest/approval-inbox.json",
  approvalInboxDecisionPath: "artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json",
  controlPlaneHumanGatesPath: "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json",
  protectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
};

const KNOWN_GATE_OUTCOMES = new Set(["passed", "failed", "warning", "skipped", "pending"]);
const HUMAN_GATE_ID = "human_approval_gate";

export async function runGateApprovalContractFreeze(options = {}) {
  const result = await buildGateApprovalContractFreeze(options);
  if (options.write !== false) await writeGateApprovalContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Gate/Approval contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGateApprovalContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);

  const lawFirmSlice = await readJson(inputs.law_firm_slice_path);
  const personalDevSlice = await readJson(inputs.personal_dev_slice_path);
  const creativeDocumentSlice = await readJson(inputs.creative_document_slice_path);
  const capabilityWorkflowContractFreeze = await readJson(inputs.capability_workflow_contract_freeze_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const observabilityCatalog = await readJson(inputs.observability_catalog_path);
  const outputArtifactCatalog = await readJson(inputs.output_artifact_catalog_path);
  const approvalQueue = await readJson(inputs.approval_queue_path);
  const approvalDecisionResult = await readJson(inputs.approval_decision_path);
  const approvalInbox = await readJson(inputs.approval_inbox_path);
  const approvalInboxDecisionResult = await readJson(inputs.approval_inbox_decision_path);
  const controlPlaneHumanGates = await readJson(inputs.control_plane_human_gates_path);
  const protectedApprovalRequestPack = inputs.protected_approval_request_pack_path
    ? await readJson(inputs.protected_approval_request_pack_path)
    : unavailableProtectedApprovalRequestPack();

  const projection = projectGateApprovalContracts({
    slices: [
      { source_id: "law_firm_ldd_slice", label: "Law Firm LDD Slice", data: lawFirmSlice },
      { source_id: "personal_dev_slice", label: "Personal Dev Slice", data: personalDevSlice },
      { source_id: "creative_document_slice", label: "Creative Document Slice", data: creativeDocumentSlice },
    ],
    capabilityWorkflowContractFreeze,
    runtimeAgentRunContractFreeze,
    observabilityCatalog,
    outputArtifactCatalog,
    approvalQueue,
    approvalDecisionResult,
    approvalInbox,
    approvalInboxDecisionResult,
    controlPlaneHumanGates,
    protectedApprovalRequestPack,
    generatedAt,
  });

  const validationItems = validateGateApprovalContracts({
    capabilityWorkflowContractFreeze,
    runtimeAgentRunContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "gate-approval-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `gate-approval-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      law_firm_slice: sourceSummary(lawFirmSlice),
      personal_dev_slice: sourceSummary(personalDevSlice),
      creative_document_slice: sourceSummary(creativeDocumentSlice),
      capability_workflow_contract_freeze: {
        schema_version: capabilityWorkflowContractFreeze.schema_version,
        freeze_id: capabilityWorkflowContractFreeze.freeze_id,
        freeze_status: capabilityWorkflowContractFreeze.summary?.freeze_status ?? null,
      },
      runtime_agentrun_contract_freeze: {
        schema_version: runtimeAgentRunContractFreeze.schema_version,
        freeze_id: runtimeAgentRunContractFreeze.freeze_id,
        freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? null,
      },
      observability_catalog: {
        schema_version: observabilityCatalog.schema_version,
        event_count: observabilityCatalog.summary?.event_count ?? 0,
      },
      output_artifact_catalog: {
        schema_version: outputArtifactCatalog.schema_version,
        artifact_count: outputArtifactCatalog.summary?.artifact_count ?? 0,
      },
      approval_queue: {
        schema_version: approvalQueue.schema_version,
        total_items: approvalQueue.summary?.total_items ?? approvalQueue.items?.length ?? 0,
      },
      approval_decisions: {
        schema_version: approvalDecisionResult.schema_version,
        applied_count: approvalDecisionResult.summary?.applied_count ?? approvalDecisionResult.applied_items?.length ?? 0,
      },
      approval_inbox: {
        schema_version: approvalInbox.schema_version,
        inbox_item_count: approvalInbox.summary?.inbox_item_count ?? approvalInbox.items?.length ?? 0,
      },
      approval_inbox_decisions: {
        schema_version: approvalInboxDecisionResult.schema_version,
        applied_count: approvalInboxDecisionResult.summary?.applied_count ?? approvalInboxDecisionResult.applied_items?.length ?? 0,
      },
      control_plane_human_gates: {
        schema_version: controlPlaneHumanGates.schema_version,
        gate_item_count: controlPlaneHumanGates.summary?.gate_item_count ?? controlPlaneHumanGates.gate_items?.length ?? 0,
      },
      protected_approval_request_pack: {
        schema_version: protectedApprovalRequestPack.schema_version ?? null,
        available: protectedApprovalRequestPack.available !== false,
        approval_request_count: protectedApprovalRequestPack.summary?.approval_request_count ?? protectedApprovalRequestPack.approval_requests?.length ?? 0,
      },
    },
    contract_versions: {
      gate_result_schema_version: "gate-result.v2",
      approval_request_schema_version: "approval-request.v2",
      approval_decision_schema_version: "approval-decision.v2",
      human_gate_schema_version: "human-gate-contract.v2",
      approval_authority_schema_version: "approval-authority-contract.v2",
      gate_approval_binding_schema_version: "gate-approval-binding.v2",
      compatibility_floor: "governance-output.v1+runtime-agentrun-contract.v2",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    gate_approval_contract: {
      schema_version: "gate-approval-contract.v2",
      generated_at: generatedAt,
      gate_results: projection.gateResultsV2,
      approval_requests: projection.approvalRequestsV2,
      approval_decisions: projection.approvalDecisionsV2,
      human_gate_contracts: projection.humanGateContractsV2,
      approval_authority_contracts: projection.approvalAuthorityContractsV2,
      gate_approval_bindings: projection.gateApprovalBindingsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderGateApprovalContractFreezeMarkdown(result),
  };
}

export async function writeGateApprovalContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "gate-approval-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "gate-result-v2-fixture.json"), {
    generated_at: result.generated_at,
    gate_result_schema_version: result.contract_versions.gate_result_schema_version,
    gate_result_count: result.gate_approval_contract.gate_results.length,
    gate_results: result.gate_approval_contract.gate_results,
  });
  await writeJson(path.join(outDir, "approval-request-v2-fixture.json"), {
    generated_at: result.generated_at,
    approval_request_schema_version: result.contract_versions.approval_request_schema_version,
    approval_request_count: result.gate_approval_contract.approval_requests.length,
    approval_requests: result.gate_approval_contract.approval_requests,
  });
  await writeJson(path.join(outDir, "approval-decision-v2-fixture.json"), {
    generated_at: result.generated_at,
    approval_decision_schema_version: result.contract_versions.approval_decision_schema_version,
    approval_decision_count: result.gate_approval_contract.approval_decisions.length,
    approval_decisions: result.gate_approval_contract.approval_decisions,
  });
  await writeJson(path.join(outDir, "human-gate-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    human_gate_schema_version: result.contract_versions.human_gate_schema_version,
    human_gate_contract_count: result.gate_approval_contract.human_gate_contracts.length,
    human_gate_contracts: result.gate_approval_contract.human_gate_contracts,
  });
  await writeJson(path.join(outDir, "approval-authority-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    approval_authority_schema_version: result.contract_versions.approval_authority_schema_version,
    approval_authority_contract_count: result.gate_approval_contract.approval_authority_contracts.length,
    approval_authority_contracts: result.gate_approval_contract.approval_authority_contracts,
  });
  await writeJson(path.join(outDir, "gate-approval-binding-v2-fixture.json"), {
    generated_at: result.generated_at,
    gate_approval_binding_schema_version: result.contract_versions.gate_approval_binding_schema_version,
    gate_approval_binding_count: result.gate_approval_contract.gate_approval_bindings.length,
    gate_approval_bindings: result.gate_approval_contract.gate_approval_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runGateApprovalContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runGateApprovalContractFreeze(args);
    console.log(`Gate/Approval contract freeze written to ${result.output_dir}`);
    console.log(`GateResult v2: ${result.summary.gate_result_count}`);
    console.log(`ApprovalRequest v2: ${result.summary.approval_request_count}`);
    console.log(`ApprovalDecision v2: ${result.summary.approval_decision_count}`);
    console.log(`Human approval gates linked: ${result.summary.human_approval_gate_linked_count}/${result.summary.human_approval_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectGateApprovalContracts({
  slices,
  capabilityWorkflowContractFreeze,
  observabilityCatalog,
  approvalQueue,
  approvalDecisionResult,
  approvalInbox,
  approvalInboxDecisionResult,
  controlPlaneHumanGates,
  protectedApprovalRequestPack,
  generatedAt,
}) {
  const capabilityContract = capabilityWorkflowContractFreeze.capability_workflow_contract ?? {};
  const workflowRunById = new Map((capabilityContract.workflow_runs ?? []).map((run) => [run.workflow_run_id, run]));
  const eventBySubjectId = new Map((observabilityCatalog.event_records ?? []).map((event) => [event.subject_id, event]));
  const gateResultsV2 = slices.flatMap((slice) => {
    const governanceOutput = extractGovernanceOutput(slice.data);
    return (governanceOutput.gate_results ?? []).map((gateResult) => gateResultV2({
      gateResult,
      slice,
      workflowRun: workflowRunById.get(gateResult.workflow_run_id),
      eventRecord: eventBySubjectId.get(gateResult.id),
      generatedAt,
    }));
  });

  const approvalRequestsV2 = [
    ...slices.flatMap((slice) => {
      const governanceOutput = extractGovernanceOutput(slice.data);
      return (governanceOutput.approvals ?? []).map((approval) => approvalRequestFromGovernanceApproval({
        approval,
        slice,
        workflowRun: workflowRunById.get(approval.workflow_run_id),
        eventRecord: eventBySubjectId.get(approval.id),
        generatedAt,
      }));
    }),
    ...(approvalQueue.items ?? []).map((item) => approvalRequestFromQueueItem({ item, generatedAt })),
    ...(approvalInbox.items ?? []).map((item) => approvalRequestFromInboxItem({ item, eventRecord: eventBySubjectId.get(item.approval_id), generatedAt })),
    ...(protectedApprovalRequestPack.approval_requests ?? []).map((request) => approvalRequestFromProtectedRequest({ request, generatedAt })),
  ];

  const requestIds = new Set(approvalRequestsV2.map((request) => request.approval_request_id));
  const approvalDecisionsV2 = [
    ...(approvalDecisionResult.applied_items ?? []).map((item) => approvalDecisionFromQueueDecision({ item, requestIds, generatedAt })),
    ...(approvalInboxDecisionResult.applied_items ?? []).map((item) => approvalDecisionFromInboxDecision({ item, requestIds, generatedAt })),
  ];

  const gateResultsWithLinks = gateResultsV2.map((gateResult) => {
    const linkedRequests = gateResult.human_approval_gate
      ? approvalRequestsV2.filter((request) => approvalRequestMatchesGate(request, gateResult))
      : [];
    return {
      ...gateResult,
      linked_approval_request_ids: linkedRequests.map((request) => request.approval_request_id),
      linked_approval_request_count: linkedRequests.length,
      approval_separation_status: gateResult.human_approval_gate
        ? linkedRequests.length > 0 ? "separate_approval_linked" : "missing_separate_approval_object"
        : "not_required",
    };
  });

  const humanGateContractsV2 = (controlPlaneHumanGates.gate_items ?? []).map((item) => humanGateContractV2(item, generatedAt));
  const approvalAuthorityContractsV2 = approvalRequestsV2.map((request) => approvalAuthorityContractV2(request, generatedAt));
  const gateApprovalBindingsV2 = gateResultsWithLinks.map((gateResult) => gateApprovalBindingV2(gateResult, generatedAt));

  return {
    gateResultsV2: gateResultsWithLinks,
    approvalRequestsV2,
    approvalDecisionsV2,
    humanGateContractsV2,
    approvalAuthorityContractsV2,
    gateApprovalBindingsV2,
  };
}

function gateResultV2({ gateResult, slice, workflowRun, eventRecord, generatedAt }) {
  const findings = gateResult.findings ?? [];
  return {
    schema_version: "gate-result.v2",
    gate_result_id: gateResult.id,
    source_gate_result_id: gateResult.id,
    source_id: slice.source_id,
    source_label: slice.label,
    workflow_run_id: gateResult.workflow_run_id,
    workflow_id: workflowRun?.workflow_id ?? null,
    capability_id: workflowRun?.capability_id ?? inferCapabilityId(gateResult.workflow_run_id),
    domain_pack: workflowRun?.domain_pack ?? inferDomainPack(gateResult.workflow_run_id),
    tenant_id: workflowRun?.tenant_id ?? eventRecord?.tenant_id ?? null,
    matter_id: workflowRun?.matter_id ?? null,
    gate_id: gateResult.gate_id,
    gate_stage: gateResult.gate_stage,
    gate_outcome: normalizeGateOutcome(gateResult.status),
    source_status: gateResult.status,
    blocking: Boolean(gateResult.blocking),
    human_approval_gate: gateResult.gate_id === HUMAN_GATE_ID,
    separated_approval_object_required: gateResult.gate_id === HUMAN_GATE_ID,
    finding_count: findings.length,
    findings,
    finding_refs: findings.map((finding) => finding.ref ?? finding.subject_id ?? finding.id).filter(Boolean),
    event_id: eventRecord?.event_id ?? null,
    event_type: eventRecord?.event_type ?? null,
    policy_snapshot_id: eventRecord?.policy_snapshot_id ?? workflowRun?.policy_snapshot_id ?? null,
    created_at: gateResult.created_at ?? eventRecord?.time ?? generatedAt,
    recorded_at: generatedAt,
    linked_approval_request_ids: [],
    linked_approval_request_count: 0,
    approval_separation_status: "not_evaluated",
    metadata: {
      source_schema_version: gateResult.schema_version,
      source_metadata: gateResult.metadata ?? {},
    },
  };
}

function approvalRequestFromGovernanceApproval({ approval, slice, workflowRun, eventRecord, generatedAt }) {
  const requiredActor = inferRequiredActor({
    domainPack: workflowRun?.domain_pack ?? inferDomainPack(approval.workflow_run_id),
    approvalType: approval.approval_type,
    deliveryTarget: null,
    itemType: "governance_output_approval",
    protectedAction: false,
  });
  return {
    schema_version: "approval-request.v2",
    approval_request_id: approval.id,
    source_approval_id: approval.id,
    source_id: slice.source_id,
    approval_source: "governance_output",
    approval_kind: approval.approval_type ?? "human_review",
    request_status: approval.approval_status ?? "pending",
    workflow_run_id: approval.workflow_run_id,
    workflow_id: workflowRun?.workflow_id ?? null,
    capability_id: workflowRun?.capability_id ?? inferCapabilityId(approval.workflow_run_id),
    domain_pack: workflowRun?.domain_pack ?? inferDomainPack(approval.workflow_run_id),
    tenant_id: workflowRun?.tenant_id ?? eventRecord?.tenant_id ?? null,
    matter_id: workflowRun?.matter_id ?? null,
    output_artifact_id: approval.output_artifact_id,
    artifact_id: approval.output_artifact_id,
    subject_ref: {
      subject_type: "output_artifact",
      subject_id: approval.output_artifact_id,
    },
    gate_result_id: null,
    required_decision: "approve_or_request_changes",
    allowed_decisions: ["approve", "request_changes", "reject", "defer"],
    required_actor: requiredActor,
    protected_action: false,
    requires_explicit_human_approval: true,
    blocked_reasons: ["gate:human_approval_gate"],
    requested_from: approval.requested_from ?? [],
    event_id: eventRecord?.event_id ?? null,
    policy_snapshot_id: eventRecord?.policy_snapshot_id ?? workflowRun?.policy_snapshot_id ?? null,
    created_at: approval.created_at ?? eventRecord?.time ?? generatedAt,
    recorded_at: generatedAt,
    metadata: {
      source_schema_version: approval.schema_version,
      source_metadata: approval.metadata ?? {},
    },
  };
}

function approvalRequestFromQueueItem({ item, generatedAt }) {
  const requiredActor = inferRequiredActor({
    domainPack: item.domain_pack,
    approvalType: item.item_type,
    deliveryTarget: null,
    itemType: item.item_type,
    protectedAction: false,
  });
  return {
    schema_version: "approval-request.v2",
    approval_request_id: item.queue_item_id,
    source_approval_id: item.queue_item_id,
    source_id: "approval_queue",
    approval_source: "approval_queue",
    approval_kind: item.item_type,
    request_status: item.status ?? "pending",
    workflow_run_id: item.workflow_run_id ?? null,
    workflow_id: null,
    capability_id: first(item.metadata?.capability_ids) ?? null,
    domain_pack: item.domain_pack ?? inferDomainPack(first(item.metadata?.capability_ids)),
    tenant_id: item.tenant_id ?? null,
    matter_id: item.matter_id ?? null,
    output_artifact_id: null,
    artifact_id: null,
    subject_ref: item.subject_ref ?? { subject_type: "unknown", subject_id: item.queue_item_id },
    gate_result_id: item.subject_ref?.subject_type === "gate" ? item.subject_ref.subject_id : null,
    required_decision: item.required_decision ?? "approve_reject_or_request_changes",
    allowed_decisions: allowedDecisionsFor(item.item_type),
    required_actor: requiredActor,
    protected_action: false,
    requires_explicit_human_approval: false,
    blocked_reasons: item.blocked_reasons ?? [],
    requested_from: [],
    event_id: null,
    policy_snapshot_id: null,
    created_at: item.created_at ?? generatedAt,
    recorded_at: generatedAt,
    metadata: {
      priority: item.priority ?? null,
      source_uri: item.source_uri ?? null,
      classification: item.classification ?? null,
      source_metadata: item.metadata ?? {},
    },
  };
}

function approvalRequestFromInboxItem({ item, eventRecord, generatedAt }) {
  const protectedAction = Boolean(item.protected_action || item.delivery_status?.includes("protected"));
  const requiredActor = inferRequiredActor({
    domainPack: item.domain_pack,
    approvalType: item.approval_status,
    deliveryTarget: item.delivery_target,
    itemType: item.item_type,
    protectedAction,
  });
  return {
    schema_version: "approval-request.v2",
    approval_request_id: item.approval_item_id,
    source_approval_id: item.approval_id ?? item.delivery_action_id ?? item.approval_item_id,
    source_id: "approval_inbox",
    approval_source: "approval_inbox",
    approval_kind: item.item_type,
    request_status: item.status ?? item.approval_status ?? "pending",
    workflow_run_id: item.workflow_run_id ?? item.source_refs?.workflow_run_id ?? null,
    workflow_id: null,
    capability_id: inferCapabilityId(item.workflow_run_id),
    domain_pack: item.domain_pack ?? inferDomainPack(item.workflow_run_id),
    tenant_id: item.tenant_id ?? null,
    matter_id: item.matter_id ?? null,
    output_artifact_id: item.artifact_id ?? item.source_refs?.artifact_id ?? null,
    artifact_id: item.artifact_id ?? null,
    subject_ref: {
      subject_type: item.item_type === "approval_request" ? "approval" : "delivery_action",
      subject_id: item.approval_id ?? item.delivery_action_id ?? item.approval_item_id,
    },
    gate_result_id: blockedByHumanGate(item) ? `${item.workflow_run_id}:${HUMAN_GATE_ID}` : item.delivery_action_id ?? null,
    required_decision: item.required_decision ?? "approve_or_request_changes",
    allowed_decisions: item.allowed_decisions ?? allowedDecisionsFor(item.item_type),
    required_actor: requiredActor,
    protected_action: protectedAction,
    requires_explicit_human_approval: item.item_type === "approval_request" || protectedAction,
    blocked_reasons: item.blocked_reasons ?? [],
    requested_from: [],
    event_id: eventRecord?.event_id ?? null,
    policy_snapshot_id: eventRecord?.policy_snapshot_id ?? null,
    created_at: item.created_at ?? eventRecord?.time ?? generatedAt,
    recorded_at: generatedAt,
    metadata: {
      priority: item.priority ?? null,
      delivery_action_id: item.delivery_action_id ?? null,
      delivery_target: item.delivery_target ?? null,
      delivery_channel: item.delivery_channel ?? null,
      source_refs: item.source_refs ?? {},
      context: item.context ?? {},
    },
  };
}

function approvalRequestFromProtectedRequest({ request, generatedAt }) {
  return {
    schema_version: "approval-request.v2",
    approval_request_id: request.approval_request_id,
    source_approval_id: request.approval_request_id,
    source_id: "protected_approval_request_pack",
    approval_source: "protected_approval_request_pack",
    approval_kind: request.approval_type ?? "explicit_human_approval",
    request_status: request.approval_status ?? "pending_explicit_approval",
    workflow_run_id: request.workflow_run_id ?? null,
    workflow_id: null,
    capability_id: null,
    domain_pack: "control-plane",
    tenant_id: null,
    matter_id: null,
    output_artifact_id: null,
    artifact_id: null,
    subject_ref: {
      subject_type: "protected_command",
      subject_id: request.source_held_command_id ?? request.command_gate_id ?? request.approval_request_id,
    },
    gate_result_id: request.command_gate_id ?? null,
    required_decision: "explicit_approve_or_reject",
    allowed_decisions: ["approve", "reject", "defer"],
    required_actor: request.required_actor ?? "authorized_operator",
    protected_action: Boolean(request.protected_action),
    requires_explicit_human_approval: Boolean(request.requires_explicit_human_approval),
    blocked_reasons: ["protected_action_requires_explicit_human_approval"],
    requested_from: [request.target_approval_input_path].filter(Boolean),
    event_id: null,
    policy_snapshot_id: null,
    created_at: generatedAt,
    recorded_at: generatedAt,
    metadata: {
      command: request.command ?? null,
      command_kind: request.command_kind ?? null,
      safe_handling: request.safe_handling ?? {},
      source_refs: request.source_refs ?? {},
    },
  };
}

function approvalDecisionFromQueueDecision({ item, requestIds, generatedAt }) {
  const requestId = item.queue_item_id;
  return {
    schema_version: "approval-decision.v2",
    approval_decision_id: `approval-decision.${slugify(requestId)}.${slugify(item.decision)}`,
    approval_request_id: requestId,
    source_id: "approval_decisions",
    decision_source: "approval_queue_decision",
    request_link_status: requestIds.has(requestId) ? "linked" : "orphan_source_decision",
    item_type: item.item_type,
    subject_ref: item.subject_ref ?? { subject_type: "unknown", subject_id: requestId },
    decision: item.decision,
    decided_by: item.decided_by ?? null,
    decided_at: item.decided_at ?? generatedAt,
    comment: item.comment ?? "",
    follow_up_action: item.follow_up_action ?? "",
    status_after: item.status_after ?? "decided",
    protected_action: false,
    recorded_at: generatedAt,
    metadata: {
      priority: item.priority ?? null,
      resource_patch: item.resource_patch ?? null,
    },
  };
}

function approvalDecisionFromInboxDecision({ item, requestIds, generatedAt }) {
  const requestId = item.approval_item_id;
  return {
    schema_version: "approval-decision.v2",
    approval_decision_id: `approval-decision.${slugify(requestId)}.${slugify(item.decision)}`,
    approval_request_id: requestId,
    source_id: "approval_inbox_decisions",
    decision_source: "approval_inbox_decision",
    request_link_status: requestIds.has(requestId) ? "linked" : "orphan_source_decision",
    item_type: item.item_type,
    subject_ref: item.subject_ref ?? { subject_type: "unknown", subject_id: requestId },
    decision: item.decision,
    decided_by: item.decided_by ?? null,
    decided_at: item.decided_at ?? generatedAt,
    comment: item.comment ?? "",
    follow_up_action: item.follow_up_action ?? "",
    status_after: item.status_after ?? "decided",
    protected_action: Boolean(item.protected_action),
    recorded_at: generatedAt,
    metadata: {
      ready_for_delivery: item.ready_for_delivery ?? null,
      delivery_patch: item.delivery_patch ?? null,
      output_patch: item.output_patch ?? null,
    },
  };
}

function humanGateContractV2(item, generatedAt) {
  return {
    schema_version: "human-gate-contract.v2",
    human_gate_contract_id: item.gate_item_id,
    source_gate_item_id: item.gate_item_id,
    source_stage: item.source_stage ?? null,
    gate_type: item.gate_type ?? null,
    priority: item.priority ?? "medium",
    status: item.status ?? "pending",
    subject_ref: item.subject_ref ?? { subject_type: "unknown", subject_id: item.gate_item_id },
    requires_human: Boolean(item.requires_human),
    protected_action: Boolean(item.protected_action),
    required_actor: item.required_actor ?? inferRequiredActor({
      domainPack: item.domain_pack,
      approvalType: item.gate_type,
      itemType: item.item_type,
      protectedAction: Boolean(item.protected_action),
    }),
    safe_handling: item.safe_handling ?? { auto_execute_allowed: false },
    source_refs: item.source_refs ?? {},
    created_at: item.created_at ?? generatedAt,
    recorded_at: generatedAt,
    metadata: {
      title: item.title ?? null,
      reason: item.reason ?? null,
      recommended_actions: item.recommended_actions ?? [],
    },
  };
}

function approvalAuthorityContractV2(request, generatedAt) {
  return {
    schema_version: "approval-authority-contract.v2",
    approval_authority_id: `approval-authority.${slugify(request.approval_request_id)}`,
    approval_request_id: request.approval_request_id,
    approval_kind: request.approval_kind,
    required_actor: request.required_actor,
    approval_authority_status: request.required_actor ? "declared" : "missing",
    approval_scope: request.protected_action ? "protected_action" : request.output_artifact_id ? "output_artifact" : request.subject_ref?.subject_type ?? "approval_item",
    domain_pack: request.domain_pack,
    tenant_id: request.tenant_id,
    matter_id: request.matter_id,
    protected_action: request.protected_action,
    requires_explicit_human_approval: request.requires_explicit_human_approval,
    allowed_decisions: request.allowed_decisions,
    created_at: generatedAt,
    metadata: {},
  };
}

function gateApprovalBindingV2(gateResult, generatedAt) {
  return {
    schema_version: "gate-approval-binding.v2",
    gate_approval_binding_id: `gate-approval-binding.${slugify(gateResult.gate_result_id)}`,
    gate_result_id: gateResult.gate_result_id,
    gate_id: gateResult.gate_id,
    workflow_run_id: gateResult.workflow_run_id,
    domain_pack: gateResult.domain_pack,
    approval_request_ids: gateResult.linked_approval_request_ids,
    approval_request_count: gateResult.linked_approval_request_count,
    binding_status: gateResult.human_approval_gate
      ? gateResult.linked_approval_request_count > 0 ? "linked" : "missing_approval_request"
      : "not_applicable",
    human_approval_gate: gateResult.human_approval_gate,
    blocking: gateResult.blocking,
    created_at: generatedAt,
    metadata: {},
  };
}

function validateGateApprovalContracts({
  capabilityWorkflowContractFreeze,
  runtimeAgentRunContractFreeze,
  gateResultsV2,
  approvalRequestsV2,
  approvalDecisionsV2,
  humanGateContractsV2,
  approvalAuthorityContractsV2,
  gateApprovalBindingsV2,
}) {
  const items = [];
  const approvalRequestIds = approvalRequestsV2.map((request) => request.approval_request_id);
  const requestIds = new Set(approvalRequestIds);
  const humanGateResults = gateResultsV2.filter((gateResult) => gateResult.human_approval_gate);
  const humanGateBindings = gateApprovalBindingsV2.filter((binding) => binding.human_approval_gate);

  items.push(validationItem("source.capability_workflow_contract_freeze", "capability_workflow_freeze_complete", capabilityWorkflowContractFreeze.summary?.freeze_status === "complete", "Capability/workflow contract freeze is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("gate_results", "gate_result_contracts_present", gateResultsV2.length > 0, "GateResult v2 contracts are projected."));
  items.push(validationItem("approval_requests", "approval_request_contracts_present", approvalRequestsV2.length > 0, "ApprovalRequest v2 contracts are projected."));
  items.push(validationItem("human_gate_contracts", "human_gate_contracts_present", humanGateContractsV2.length > 0, "Human gate contracts are projected."));

  for (const gateResult of gateResultsV2) {
    const pathLabel = `gate_results.${gateResult.gate_result_id}`;
    items.push(validationItem(pathLabel, "gate_outcome_known", KNOWN_GATE_OUTCOMES.has(gateResult.gate_outcome), "Gate outcome is normalized."));
    items.push(validationItem(pathLabel, "approval_fields_separated", !("approval_status" in gateResult) && !("decision" in gateResult), "GateResult does not contain approval decision fields."));
    items.push(validationItem(pathLabel, "event_or_workflow_link_present", Boolean(gateResult.workflow_run_id), "GateResult is linked to a workflow run."));
    if (gateResult.human_approval_gate) {
      items.push(validationItem(pathLabel, "human_gate_requires_separate_approval", gateResult.separated_approval_object_required === true, "Human approval gate requires a separate approval object."));
      items.push(validationItem(pathLabel, "human_gate_approval_request_linked", gateResult.linked_approval_request_count > 0, "Human approval gate links to at least one ApprovalRequest v2."));
    }
  }

  for (const request of approvalRequestsV2) {
    const pathLabel = `approval_requests.${request.approval_request_id}`;
    items.push(validationItem(pathLabel, "subject_ref_present", Boolean(request.subject_ref?.subject_id), "ApprovalRequest has a subject_ref."));
    items.push(validationItem(pathLabel, "required_decision_present", Boolean(request.required_decision), "ApprovalRequest declares required_decision."));
    items.push(validationItem(pathLabel, "allowed_decisions_present", Array.isArray(request.allowed_decisions) && request.allowed_decisions.length > 0, "ApprovalRequest declares allowed_decisions."));
    items.push(validationItem(pathLabel, "request_status_present", Boolean(request.request_status), "ApprovalRequest declares request_status."));
    items.push(validationItem(pathLabel, "required_actor_present", Boolean(request.required_actor), "ApprovalRequest declares required_actor."));
    if (request.protected_action) {
      items.push(validationItem(pathLabel, "protected_action_requires_authorized_operator", request.required_actor === "authorized_operator" && request.requires_explicit_human_approval, "Protected actions require explicit authorized operator approval."));
    }
  }

  for (const decision of approvalDecisionsV2) {
    const pathLabel = `approval_decisions.${decision.approval_decision_id}`;
    items.push(validationItem(pathLabel, "decision_present", Boolean(decision.decision), "ApprovalDecision declares a decision."));
    items.push(validationItem(pathLabel, "decision_actor_present", Boolean(decision.decided_by), "ApprovalDecision declares who decided."));
    items.push(validationItem(pathLabel, "request_link_tracked", ["linked", "orphan_source_decision"].includes(decision.request_link_status), "ApprovalDecision records whether the source request is still present.", { request_link_status: decision.request_link_status }));
  }

  for (const authority of approvalAuthorityContractsV2) {
    items.push(validationItem(`approval_authorities.${authority.approval_authority_id}`, "approval_authority_declared", authority.approval_authority_status === "declared", "Approval authority is declared."));
  }

  for (const binding of humanGateBindings) {
    items.push(validationItem(`gate_approval_bindings.${binding.gate_approval_binding_id}`, "human_gate_binding_linked", binding.binding_status === "linked", "Human approval gate binding links to approval request(s)."));
  }

  items.push(validationItem("gate_approval_bindings", "all_human_gates_have_bindings", humanGateBindings.length === humanGateResults.length, "Every human approval gate has a binding row."));
  items.push(validationItem("approval_requests", "unique_approval_request_ids", duplicates(approvalRequestIds).length === 0, "ApprovalRequest ids are unique.", { duplicates: duplicates(approvalRequestIds) }));

  return items;
}

function summarizeFreeze(projection, validationItems, validation) {
  const gateResults = projection.gateResultsV2;
  const approvalRequests = projection.approvalRequestsV2;
  const approvalDecisions = projection.approvalDecisionsV2;
  const humanGateResults = gateResults.filter((gateResult) => gateResult.human_approval_gate);
  const humanGateBindings = projection.gateApprovalBindingsV2.filter((binding) => binding.human_approval_gate);
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    gate_result_schema_version: "gate-result.v2",
    approval_request_schema_version: "approval-request.v2",
    approval_decision_schema_version: "approval-decision.v2",
    human_gate_schema_version: "human-gate-contract.v2",
    approval_authority_schema_version: "approval-authority-contract.v2",
    gate_approval_binding_schema_version: "gate-approval-binding.v2",
    gate_result_count: gateResults.length,
    approval_request_count: approvalRequests.length,
    approval_decision_count: approvalDecisions.length,
    human_gate_contract_count: projection.humanGateContractsV2.length,
    human_approval_gate_count: humanGateResults.length,
    human_approval_gate_linked_count: humanGateResults.filter((gateResult) => gateResult.linked_approval_request_count > 0).length,
    gate_approval_binding_count: projection.gateApprovalBindingsV2.length,
    linked_gate_approval_binding_count: humanGateBindings.filter((binding) => binding.binding_status === "linked").length,
    separated_approval_request_count: approvalRequests.length,
    governance_output_approval_request_count: approvalRequests.filter((request) => request.approval_source === "governance_output").length,
    output_approval_request_count: approvalRequests.filter((request) => request.approval_source === "approval_inbox" && request.approval_kind === "approval_request").length,
    gate_blocker_review_count: approvalRequests.filter((request) => request.approval_source === "approval_inbox" && request.approval_kind === "gate_blocker_review").length,
    evidence_review_request_count: approvalRequests.filter((request) => request.approval_source === "approval_queue" && request.approval_kind === "evidence_review").length,
    protected_explicit_approval_request_count: approvalRequests.filter((request) => request.approval_source === "protected_approval_request_pack").length,
    approval_authority_declared_count: projection.approvalAuthorityContractsV2.filter((authority) => authority.approval_authority_status === "declared").length,
    pending_approval_request_count: approvalRequests.filter((request) => /pending/i.test(request.request_status)).length,
    linked_approval_decision_count: approvalDecisions.filter((decision) => decision.request_link_status === "linked").length,
    orphan_approval_decision_count: approvalDecisions.filter((decision) => decision.request_link_status === "orphan_source_decision").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_gate_outcome: countBy(gateResults, "gate_outcome"),
    by_gate_stage: countBy(gateResults, "gate_stage"),
    by_approval_source: countBy(approvalRequests, "approval_source"),
    by_approval_kind: countBy(approvalRequests, "approval_kind"),
    by_request_status: countBy(approvalRequests, "request_status"),
    by_required_actor: countBy(approvalRequests, "required_actor"),
    by_binding_status: countBy(projection.gateApprovalBindingsV2, "binding_status"),
  };
}

function renderGateApprovalContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Gate/Approval Contract Freeze");
  lines.push("");
  lines.push(`- Freeze ID: ${result.freeze_id}`);
  lines.push(`- Status: ${result.summary.freeze_status}`);
  lines.push(`- GateResult v2: ${result.summary.gate_result_count}`);
  lines.push(`- ApprovalRequest v2: ${result.summary.approval_request_count}`);
  lines.push(`- ApprovalDecision v2: ${result.summary.approval_decision_count}`);
  lines.push(`- Human gate contracts: ${result.summary.human_gate_contract_count}`);
  lines.push(`- Human approval gates linked: ${result.summary.human_approval_gate_linked_count}/${result.summary.human_approval_gate_count}`);
  lines.push(`- Approval authorities declared: ${result.summary.approval_authority_declared_count}/${result.summary.approval_request_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Human Approval Gate Bindings");
  for (const binding of result.gate_approval_contract.gate_approval_bindings.filter((candidate) => candidate.human_approval_gate)) {
    lines.push(`- ${binding.gate_result_id}: ${binding.binding_status}, approvals ${binding.approval_request_count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function buildFieldRequirements() {
  return {
    gate_result_v2: fieldRequirement(
      ["schema_version", "gate_result_id", "workflow_run_id", "gate_id", "gate_stage", "gate_outcome", "blocking", "human_approval_gate", "separated_approval_object_required"],
      ["event_id", "policy_snapshot_id", "findings", "linked_approval_request_ids", "metadata"],
    ),
    approval_request_v2: fieldRequirement(
      ["schema_version", "approval_request_id", "approval_source", "approval_kind", "request_status", "subject_ref", "required_decision", "allowed_decisions", "required_actor"],
      ["workflow_run_id", "output_artifact_id", "gate_result_id", "policy_snapshot_id", "metadata"],
    ),
    approval_decision_v2: fieldRequirement(
      ["schema_version", "approval_decision_id", "approval_request_id", "decision", "decided_by", "decided_at", "request_link_status"],
      ["comment", "follow_up_action", "metadata"],
    ),
    human_gate_contract_v2: fieldRequirement(
      ["schema_version", "human_gate_contract_id", "source_stage", "gate_type", "status", "subject_ref", "requires_human", "safe_handling"],
      ["source_refs", "metadata"],
    ),
    approval_authority_contract_v2: fieldRequirement(
      ["schema_version", "approval_authority_id", "approval_request_id", "required_actor", "approval_authority_status", "approval_scope"],
      ["domain_pack", "tenant_id", "matter_id", "metadata"],
    ),
    gate_approval_binding_v2: fieldRequirement(
      ["schema_version", "gate_approval_binding_id", "gate_result_id", "gate_id", "workflow_run_id", "binding_status", "approval_request_ids"],
      ["metadata"],
    ),
  };
}

function approvalRequestMatchesGate(request, gateResult) {
  if (request.workflow_run_id !== gateResult.workflow_run_id) return false;
  if (request.approval_source === "governance_output") return true;
  if ((request.blocked_reasons ?? []).includes("gate:human_approval_gate")) return true;
  if (request.output_artifact_id && gateResult.finding_refs.includes(request.output_artifact_id)) return true;
  return request.gate_result_id === gateResult.gate_result_id || request.gate_result_id === `${gateResult.workflow_run_id}:${HUMAN_GATE_ID}`;
}

function extractGovernanceOutput(data) {
  return data.law_firm_slice?.governance_output
    ?? data.personal_dev_slice?.governance_output
    ?? data.creative_document_slice?.governance_output
    ?? data.governance_output
    ?? {};
}

function blockedByHumanGate(item) {
  return (item.blocked_reasons ?? []).includes("gate:human_approval_gate");
}

function inferRequiredActor({ domainPack, approvalType, deliveryTarget, itemType, protectedAction }) {
  if (protectedAction) return "authorized_operator";
  if (itemType === "evidence_review") return "evidence_reviewer";
  if (itemType === "gate_blocker_review") return "human_reviewer";
  if (deliveryTarget === "github_pr_or_merge" || approvalType === "merge_approval" || domainPack === "personal-dev") return "repo_owner";
  if (domainPack === "law-firm" || deliveryTarget === "attorney_review_packet" || approvalType === "attorney_review") return "attorney_reviewer";
  if (domainPack === "creative-document" || deliveryTarget === "deck_review_packet") return "content_reviewer";
  return "human_reviewer";
}

function allowedDecisionsFor(itemType) {
  if (itemType === "evidence_review") return ["approve", "reject", "request_changes", "defer"];
  if (itemType === "gate_blocker_review" || itemType === "blocking_gate_review") return ["mark_resolved", "waive", "defer"];
  return ["approve", "request_changes", "reject", "defer"];
}

function normalizeGateOutcome(status) {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  if (status === "skipped") return "skipped";
  if (status === "warning") return "warning";
  return "failed";
}

function inferCapabilityId(value) {
  if (value?.includes("law_firm_ldd")) return "law_firm.ldd.issue_report";
  if (value?.includes("personal_dev")) return "personal_dev.codex.worktree_patch";
  if (value?.includes("creative_document")) return "creative_document.pptx.design_system";
  return null;
}

function inferDomainPack(value) {
  if (value?.startsWith("law_firm.") || value?.includes("law_firm")) return "law-firm";
  if (value?.startsWith("personal_dev.") || value?.includes("personal_dev")) return "personal-dev";
  if (value?.startsWith("creative_document.") || value?.includes("creative_document")) return "creative-document";
  return null;
}

function sourceSummary(data) {
  const governanceOutput = extractGovernanceOutput(data);
  return {
    schema_version: data.schema_version ?? governanceOutput.schema_version ?? null,
    workflow_run_id: data.workflow_run_id ?? null,
    gate_result_count: governanceOutput.gate_results?.length ?? 0,
    approval_count: governanceOutput.approvals?.length ?? 0,
  };
}

function normalizeInputs(options) {
  return {
    law_firm_slice_path: path.resolve(options.lawFirmSlicePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.lawFirmSlicePath),
    personal_dev_slice_path: path.resolve(options.personalDevSlicePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.personalDevSlicePath),
    creative_document_slice_path: path.resolve(options.creativeDocumentSlicePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.creativeDocumentSlicePath),
    capability_workflow_contract_freeze_path: path.resolve(options.capabilityWorkflowContractFreezePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.capabilityWorkflowContractFreezePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.runtimeAgentRunContractFreezePath),
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.observabilityCatalogPath),
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.outputArtifactCatalogPath),
    approval_queue_path: path.resolve(options.approvalQueuePath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.approvalQueuePath),
    approval_decision_path: path.resolve(options.approvalDecisionPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.approvalDecisionPath),
    approval_inbox_path: path.resolve(options.approvalInboxPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.approvalInboxPath),
    approval_inbox_decision_path: path.resolve(options.approvalInboxDecisionPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.approvalInboxDecisionPath),
    control_plane_human_gates_path: path.resolve(options.controlPlaneHumanGatesPath ?? DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.controlPlaneHumanGatesPath),
    protected_approval_request_pack_path: normalizeOptionalPath(options.protectedApprovalRequestPackPath, DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_INPUTS.protectedApprovalRequestPackPath),
  };
}

function normalizeOptionalPath(value, defaultValue) {
  if (value === false || value === null) return null;
  return path.resolve(value ?? defaultValue);
}

function unavailableProtectedApprovalRequestPack() {
  return {
    available: false,
    schema_version: null,
    summary: {
      approval_request_count: 0,
    },
    approval_requests: [],
  };
}

function fieldRequirement(requiredFields, optionalFields) {
  return {
    required_fields: requiredFields,
    optional_fields: optionalFields,
    required_groups: {},
  };
}

function validationItem(pathLabel, check_id, passed, message, metadata = {}) {
  return {
    path: pathLabel,
    check_id,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_GATE_APPROVAL_CONTRACT_FREEZE_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--creative-document-slice") parsed.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--output-artifact-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--approval-queue") parsed.approvalQueuePath = argv[++index];
    else if (arg === "--approval-decisions") parsed.approvalDecisionPath = argv[++index];
    else if (arg === "--approval-inbox") parsed.approvalInboxPath = argv[++index];
    else if (arg === "--approval-inbox-decisions") parsed.approvalInboxDecisionPath = argv[++index];
    else if (arg === "--control-plane-human-gates") parsed.controlPlaneHumanGatesPath = argv[++index];
    else if (arg === "--protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--no-protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = false;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/gate-approval-contract-freeze.mjs [options]

Options:
  --law-firm-slice <path>
  --personal-dev-slice <path>
  --creative-document-slice <path>
  --capability-workflow-contract-freeze <path>
  --runtime-agentrun-contract-freeze <path>
  --observability-catalog <path>
  --output-artifact-catalog <path>
  --approval-queue <path>
  --approval-decisions <path>
  --approval-inbox <path>
  --approval-inbox-decisions <path>
  --control-plane-human-gates <path>
  --protected-approval-request-pack <path>
  --no-protected-approval-request-pack
  --out-dir <path>
  --run-at <iso>
  --check
  --no-write
  --help
`);
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function slugify(value) {
  const raw = String(value ?? "unknown");
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || stableHash(raw).slice(0, 16);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) {
    const key = record[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}
