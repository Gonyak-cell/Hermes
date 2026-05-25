import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OUTPUT_DELIVERY_CONTRACT_FREEZE_OUT_DIR = "artifacts/output-delivery-contract-freeze/latest";
export const DEFAULT_OUTPUT_DELIVERY_CONTRACT_FREEZE_INPUTS = {
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  approvalInboxDecisionPath: "artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json",
  deliveryExecutionDraftPath: "artifacts/delivery-execution/latest/delivery-execution-draft.json",
  deliveryReceiptLedgerPath: "artifacts/delivery-receipts/latest/delivery-receipt-ledger.json",
  postDeliveryReconciliationPath: "artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
};

const OUTPUT_ARTIFACT_SCHEMA_VERSION = "output-artifact.v2";
const DELIVERY_ACTION_SCHEMA_VERSION = "delivery-action.v2";
const DELIVERY_RECEIPT_SCHEMA_VERSION = "delivery-receipt.v2";
const OUTPUT_DELIVERY_BINDING_SCHEMA_VERSION = "output-delivery-binding.v2";
const DELIVERY_STATE_TRANSITION_SCHEMA_VERSION = "delivery-state-transition.v2";

export async function runOutputDeliveryContractFreeze(options = {}) {
  const result = await buildOutputDeliveryContractFreeze(options);
  if (options.write !== false) await writeOutputDeliveryContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Output/Delivery contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildOutputDeliveryContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OUTPUT_DELIVERY_CONTRACT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);

  const outputArtifactCatalog = await readJson(inputs.output_artifact_catalog_path);
  const protectedDeliveryQueue = await readJson(inputs.protected_delivery_queue_path);
  const approvalInboxDecisionResult = await readJson(inputs.approval_inbox_decision_path);
  const deliveryExecutionDraft = await readJson(inputs.delivery_execution_draft_path);
  const deliveryReceiptLedger = await readJson(inputs.delivery_receipt_ledger_path);
  const postDeliveryReconciliation = await readJson(inputs.post_delivery_reconciliation_path);
  const gateApprovalContractFreeze = await readJson(inputs.gate_approval_contract_freeze_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const observabilityCatalog = await readJson(inputs.observability_catalog_path);

  const projection = projectOutputDeliveryContracts({
    outputArtifactCatalog,
    protectedDeliveryQueue,
    approvalInboxDecisionResult,
    deliveryExecutionDraft,
    deliveryReceiptLedger,
    postDeliveryReconciliation,
    gateApprovalContractFreeze,
    observabilityCatalog,
    generatedAt,
  });
  const validationItems = validateOutputDeliveryContracts({
    gateApprovalContractFreeze,
    runtimeAgentRunContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "output-delivery-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `output-delivery-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      output_artifact_catalog: {
        schema_version: outputArtifactCatalog.schema_version,
        artifact_count: outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0,
        blocked_delivery_count: outputArtifactCatalog.summary?.blocked_delivery_count ?? 0,
      },
      protected_delivery_queue: {
        schema_version: protectedDeliveryQueue.schema_version,
        delivery_action_count: protectedDeliveryQueue.summary?.delivery_action_count ?? protectedDeliveryQueue.delivery_actions?.length ?? 0,
        protected_action_count: protectedDeliveryQueue.summary?.protected_action_count ?? 0,
      },
      approval_inbox_decisions: {
        schema_version: approvalInboxDecisionResult.schema_version,
        applied_count: approvalInboxDecisionResult.summary?.applied_count ?? approvalInboxDecisionResult.applied_items?.length ?? 0,
        pending_count: approvalInboxDecisionResult.summary?.pending_count ?? approvalInboxDecisionResult.unapplied_items?.length ?? 0,
      },
      delivery_execution_draft: {
        schema_version: deliveryExecutionDraft.schema_version,
        execution_packet_count: deliveryExecutionDraft.summary?.execution_packet_count ?? deliveryExecutionDraft.execution_packets?.length ?? 0,
        blocked_candidate_count: deliveryExecutionDraft.summary?.blocked_candidate_count ?? deliveryExecutionDraft.blocked_candidates?.length ?? 0,
      },
      delivery_receipt_ledger: {
        schema_version: deliveryReceiptLedger.schema_version,
        applied_receipt_count: deliveryReceiptLedger.summary?.applied_receipt_count ?? deliveryReceiptLedger.applied_receipts?.length ?? 0,
        pending_receipt_count: deliveryReceiptLedger.summary?.pending_receipt_count ?? deliveryReceiptLedger.pending_receipts?.length ?? 0,
      },
      post_delivery_reconciliation: {
        schema_version: postDeliveryReconciliation.schema_version,
        delivered_artifact_count: postDeliveryReconciliation.summary?.delivered_artifact_count ?? postDeliveryReconciliation.delivered_artifacts?.length ?? 0,
        outstanding_receipt_count: postDeliveryReconciliation.summary?.outstanding_receipt_count ?? postDeliveryReconciliation.outstanding_receipts?.length ?? 0,
      },
      gate_approval_contract_freeze: {
        schema_version: gateApprovalContractFreeze.schema_version,
        freeze_id: gateApprovalContractFreeze.freeze_id,
        freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? null,
        approval_request_count: gateApprovalContractFreeze.summary?.approval_request_count ?? 0,
      },
      runtime_agentrun_contract_freeze: {
        schema_version: runtimeAgentRunContractFreeze.schema_version,
        freeze_id: runtimeAgentRunContractFreeze.freeze_id,
        freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? null,
      },
      observability_catalog: {
        schema_version: observabilityCatalog.schema_version,
        event_count: observabilityCatalog.summary?.event_count ?? 0,
        run_record_count: observabilityCatalog.run_records?.length ?? 0,
      },
    },
    contract_versions: {
      output_artifact_schema_version: OUTPUT_ARTIFACT_SCHEMA_VERSION,
      delivery_action_schema_version: DELIVERY_ACTION_SCHEMA_VERSION,
      delivery_receipt_schema_version: DELIVERY_RECEIPT_SCHEMA_VERSION,
      output_delivery_binding_schema_version: OUTPUT_DELIVERY_BINDING_SCHEMA_VERSION,
      delivery_state_transition_schema_version: DELIVERY_STATE_TRANSITION_SCHEMA_VERSION,
      compatibility_floor: "output-artifact-catalog.v1+gate-approval-contract.v2",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    output_delivery_contract: {
      schema_version: "output-delivery-contract.v2",
      generated_at: generatedAt,
      output_artifacts: projection.outputArtifactsV2,
      delivery_actions: projection.deliveryActionsV2,
      delivery_receipts: projection.deliveryReceiptsV2,
      output_delivery_bindings: projection.outputDeliveryBindingsV2,
      delivery_state_transitions: projection.deliveryStateTransitionsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderOutputDeliveryContractFreezeMarkdown(result),
  };
}

export async function writeOutputDeliveryContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "output-delivery-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "output-artifact-v2-fixture.json"), {
    generated_at: result.generated_at,
    output_artifact_schema_version: result.contract_versions.output_artifact_schema_version,
    output_artifact_count: result.output_delivery_contract.output_artifacts.length,
    output_artifacts: result.output_delivery_contract.output_artifacts,
  });
  await writeJson(path.join(outDir, "delivery-action-v2-fixture.json"), {
    generated_at: result.generated_at,
    delivery_action_schema_version: result.contract_versions.delivery_action_schema_version,
    delivery_action_count: result.output_delivery_contract.delivery_actions.length,
    delivery_actions: result.output_delivery_contract.delivery_actions,
  });
  await writeJson(path.join(outDir, "delivery-receipt-v2-fixture.json"), {
    generated_at: result.generated_at,
    delivery_receipt_schema_version: result.contract_versions.delivery_receipt_schema_version,
    delivery_receipt_count: result.output_delivery_contract.delivery_receipts.length,
    delivery_receipts: result.output_delivery_contract.delivery_receipts,
  });
  await writeJson(path.join(outDir, "output-delivery-binding-v2-fixture.json"), {
    generated_at: result.generated_at,
    output_delivery_binding_schema_version: result.contract_versions.output_delivery_binding_schema_version,
    output_delivery_binding_count: result.output_delivery_contract.output_delivery_bindings.length,
    output_delivery_bindings: result.output_delivery_contract.output_delivery_bindings,
  });
  await writeJson(path.join(outDir, "delivery-state-transition-v2-fixture.json"), {
    generated_at: result.generated_at,
    delivery_state_transition_schema_version: result.contract_versions.delivery_state_transition_schema_version,
    delivery_state_transition_count: result.output_delivery_contract.delivery_state_transitions.length,
    delivery_state_transitions: result.output_delivery_contract.delivery_state_transitions,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOutputDeliveryContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runOutputDeliveryContractFreeze(args);
    console.log(`Output/Delivery contract freeze written to ${result.output_dir}`);
    console.log(`OutputArtifact v2: ${result.summary.output_artifact_count}`);
    console.log(`DeliveryAction v2: ${result.summary.delivery_action_count}`);
    console.log(`DeliveryReceipt v2: ${result.summary.delivery_receipt_count}`);
    console.log(`Linked delivery actions: ${result.summary.linked_delivery_action_count}/${result.summary.output_artifact_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectOutputDeliveryContracts({
  outputArtifactCatalog,
  protectedDeliveryQueue,
  approvalInboxDecisionResult,
  deliveryExecutionDraft,
  deliveryReceiptLedger,
  postDeliveryReconciliation,
  gateApprovalContractFreeze,
  observabilityCatalog,
  generatedAt,
}) {
  const outputArtifacts = outputArtifactCatalog.artifacts ?? [];
  const deliveryActions = protectedDeliveryQueue.delivery_actions ?? [];
  const gateApprovalContract = gateApprovalContractFreeze.output_delivery_contract ?? gateApprovalContractFreeze.gate_approval_contract ?? {};
  const approvalRequestsByArtifactId = groupBy(
    gateApprovalContract.approval_requests ?? [],
    (request) => request.output_artifact_id ?? request.artifact_id ?? outputArtifactSubjectId(request.subject_ref),
  );
  const approvalDecisionsByRequestId = groupBy(gateApprovalContract.approval_decisions ?? [], (decision) => decision.approval_request_id);
  const receiptRecords = collectReceiptRecords(deliveryReceiptLedger);
  const receiptRecordsByArtifactId = groupBy(receiptRecords, (receipt) => receipt.artifact_ids ?? []);
  const deliveryActionsByArtifactId = new Map(deliveryActions.map((action) => [action.artifact_id, action]));
  const executionCandidateByActionId = new Map((deliveryExecutionDraft.execution_candidates ?? []).map((candidate) => [candidate.delivery_action_id, candidate]));
  const blockedCandidateByActionId = new Map((deliveryExecutionDraft.blocked_candidates ?? []).map((candidate) => [candidate.delivery_action_id, candidate]));
  const patchedDeliveryActionById = new Map([
    ...(approvalInboxDecisionResult.patched_delivery_queue?.delivery_actions ?? []),
    ...(deliveryReceiptLedger.patched_delivery_queue?.delivery_actions ?? []),
  ].map((action) => [action.delivery_action_id, action]));
  const patchedOutputArtifactById = new Map([
    ...(approvalInboxDecisionResult.patched_output_catalog?.artifacts ?? []),
    ...(deliveryReceiptLedger.patched_output_catalog?.artifacts ?? []),
  ].map((artifact) => [artifact.artifact_id, artifact]));
  const eventBySubjectId = new Map((observabilityCatalog.event_records ?? []).map((event) => [event.subject_id, event]));
  const reconciledMatterByKey = new Map((postDeliveryReconciliation.reconciled_matters ?? []).map((matter) => [`${matter.tenant_id ?? "unknown"}:${matter.matter_id ?? "unknown"}`, matter]));

  const deliveryReceiptsV2 = receiptRecords.map((receipt) => deliveryReceiptV2({
    receipt,
    deliveryActionsByArtifactId,
    generatedAt,
  }));
  const deliveryReceiptIdsByArtifactId = groupByIdValues(deliveryReceiptsV2, (receipt) => receipt.artifact_ids ?? [], (receipt) => receipt.delivery_receipt_id);

  const deliveryActionsV2 = deliveryActions.map((action) => deliveryActionV2({
    action,
    executionCandidate: executionCandidateByActionId.get(action.delivery_action_id),
    blockedCandidate: blockedCandidateByActionId.get(action.delivery_action_id),
    patchedAction: patchedDeliveryActionById.get(action.delivery_action_id),
    deliveryReceiptIds: deliveryReceiptIdsByArtifactId.get(action.artifact_id) ?? [],
    eventRecord: eventBySubjectId.get(action.delivery_action_id) ?? eventBySubjectId.get(action.artifact_id),
    generatedAt,
  }));

  const outputArtifactsV2 = outputArtifacts.map((artifact) => outputArtifactV2({
    artifact,
    patchedArtifact: patchedOutputArtifactById.get(artifact.artifact_id),
    deliveryAction: deliveryActionsByArtifactId.get(artifact.artifact_id),
    approvalRequests: approvalRequestsByArtifactId.get(artifact.artifact_id) ?? [],
    receiptRecords: receiptRecordsByArtifactId.get(artifact.artifact_id) ?? [],
    reconciledMatter: reconciledMatterByKey.get(`${artifact.tenant_id ?? "unknown"}:${artifact.matter_id ?? "unknown"}`),
    eventRecord: eventBySubjectId.get(artifact.artifact_id),
    generatedAt,
  }));

  const outputArtifactsV2ById = new Map(outputArtifactsV2.map((artifact) => [artifact.output_artifact_id, artifact]));
  const deliveryActionsV2ByArtifactId = groupBy(deliveryActionsV2, (action) => action.output_artifact_id);
  const outputDeliveryBindingsV2 = outputArtifactsV2.map((artifact) => {
    const requests = approvalRequestsByArtifactId.get(artifact.output_artifact_id) ?? [];
    const decisions = requests.flatMap((request) => approvalDecisionsByRequestId.get(request.approval_request_id) ?? []);
    return outputDeliveryBindingV2({
      artifact,
      deliveryActions: deliveryActionsV2ByArtifactId.get(artifact.output_artifact_id) ?? [],
      approvalRequests: requests,
      approvalDecisions: decisions,
      deliveryReceipts: deliveryReceiptsV2.filter((receipt) => receipt.artifact_ids.includes(artifact.output_artifact_id)),
      generatedAt,
    });
  });

  const deliveryStateTransitionsV2 = buildDeliveryStateTransitions({
    outputArtifactsV2ById,
    deliveryActionsV2,
    deliveryReceiptsV2,
    generatedAt,
  });

  return {
    outputArtifactsV2,
    deliveryActionsV2,
    deliveryReceiptsV2,
    outputDeliveryBindingsV2,
    deliveryStateTransitionsV2,
  };
}

function outputArtifactV2({ artifact, patchedArtifact, deliveryAction, approvalRequests, receiptRecords, reconciledMatter, eventRecord, generatedAt }) {
  const contentHash = artifact.content_hash ?? null;
  const deliveryReceiptIds = receiptRecords.map((receipt) => receipt.receipt_id ?? `receipt.${receipt.packet_id}`).filter(Boolean);
  return {
    schema_version: OUTPUT_ARTIFACT_SCHEMA_VERSION,
    output_artifact_id: artifact.artifact_id,
    source_output_artifact_id: artifact.artifact_id,
    source_id: artifact.source_id ?? null,
    source_label: artifact.source_label ?? null,
    domain_pack: artifact.domain_pack ?? null,
    capability_id: artifact.capability_id ?? null,
    workflow_run_id: artifact.workflow_run_id ?? null,
    tenant_id: artifact.tenant_id ?? null,
    matter_id: artifact.matter_id ?? null,
    artifact_type: artifact.artifact_type ?? null,
    artifact_uri: artifact.artifact_uri ?? null,
    content_hash: contentHash,
    hash_algorithm: contentHash && contentHash.length === 64 ? "sha256" : contentHash ? "stable-hash" : null,
    hash_status: contentHash ? "present" : "missing",
    output_status: artifact.status ?? null,
    delivery_state: artifact.delivery_state ?? null,
    delivery_state_after_receipt: patchedArtifact?.delivery_state ?? artifact.delivery_state ?? null,
    approval_id: artifact.approval_id ?? null,
    approval_status: artifact.approval_status ?? null,
    approval_request_ids: approvalRequests.map((request) => request.approval_request_id),
    approval_request_count: approvalRequests.length,
    delivery_action_ids: deliveryAction ? [deliveryAction.delivery_action_id] : [],
    delivery_action_count: deliveryAction ? 1 : 0,
    delivery_receipt_ids: deliveryReceiptIds,
    delivery_receipt_count: deliveryReceiptIds.length,
    blocking_gate_ids: artifact.blocking_gate_ids ?? [],
    blocking_gate_count: artifact.blocking_gate_count ?? artifact.blocking_gate_ids?.length ?? 0,
    citation_count: artifact.citation_count ?? 0,
    created_by_run_id: artifact.created_by_run_id ?? null,
    created_at: artifact.created_at ?? generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: deriveArtifactApprovalSeparationStatus(artifact, approvalRequests),
    delivery_separation_status: deliveryAction ? "separate_delivery_action_linked" : "missing_separate_delivery_action",
    receipt_separation_status: receiptRecords.length > 0 ? "separate_delivery_receipt_linked" : "awaiting_delivery_receipt",
    event_id: eventRecord?.event_id ?? null,
    policy_snapshot_id: eventRecord?.policy_snapshot_id ?? null,
    metadata: {
      source_metadata: artifact.metadata ?? {},
      reconciled_matter_status: reconciledMatter?.status ?? null,
      patched_output_status: patchedArtifact?.status ?? null,
    },
  };
}

function deliveryActionV2({ action, executionCandidate, blockedCandidate, patchedAction, deliveryReceiptIds, eventRecord, generatedAt }) {
  const deliveryStatus = action.delivery_status ?? "unknown";
  const receiptStatusAfter = patchedAction?.delivery_status ?? deliveryStatus;
  const protectedAction = Boolean(action.protected_action);
  return {
    schema_version: DELIVERY_ACTION_SCHEMA_VERSION,
    delivery_action_id: action.delivery_action_id,
    source_delivery_action_id: action.delivery_action_id,
    output_artifact_id: action.artifact_id,
    artifact_id: action.artifact_id,
    artifact_type: action.artifact_type ?? null,
    artifact_uri: action.artifact_uri ?? null,
    domain_pack: action.domain_pack ?? null,
    capability_id: action.capability_id ?? null,
    workflow_run_id: action.workflow_run_id ?? null,
    tenant_id: action.tenant_id ?? null,
    matter_id: action.matter_id ?? null,
    delivery_target: action.delivery_target ?? null,
    delivery_channel: action.delivery_channel ?? null,
    delivery_status: deliveryStatus,
    delivery_status_after_receipt: receiptStatusAfter,
    priority: action.priority ?? "medium",
    protected_action: protectedAction,
    draft_only: receiptStatusAfter !== "delivered",
    requires_human_approval: protectedAction || action.approval_status === "pending" || Boolean(action.required_approval_id),
    required_approval_id: action.required_approval_id ?? null,
    approval_status: action.approval_status ?? null,
    blocking_gate_ids: action.blocking_gate_ids ?? [],
    blocked_reasons: action.blocked_reasons ?? [],
    recommended_actions: action.recommended_actions ?? [],
    ready_for_delivery: deliveryStatus === "ready_for_delivery",
    executed: receiptStatusAfter === "delivered",
    execution_packet_id: executionCandidate?.execution_packet_id ?? executionCandidate?.packet_id ?? null,
    execution_candidate_status: executionCandidate ? "ready" : blockedCandidate ? "blocked" : "not_selected",
    delivery_receipt_ids: deliveryReceiptIds,
    delivery_receipt_count: deliveryReceiptIds.length,
    run_status: action.run_status ?? null,
    runtime_seconds: action.runtime_seconds ?? 0,
    source_id: action.source_id ?? null,
    source_label: action.source_label ?? null,
    created_at: action.created_at ?? generatedAt,
    recorded_at: generatedAt,
    event_id: eventRecord?.event_id ?? null,
    policy_snapshot_id: eventRecord?.policy_snapshot_id ?? null,
    metadata: {
      content_hash: action.metadata?.content_hash ?? null,
      citation_count: action.metadata?.citation_count ?? 0,
      output_status: action.metadata?.output_status ?? null,
      original_delivery_state: action.metadata?.original_delivery_state ?? null,
      patched_delivery_status: patchedAction?.delivery_status ?? null,
    },
  };
}

function deliveryReceiptV2({ receipt, deliveryActionsByArtifactId, generatedAt }) {
  const artifactIds = receipt.artifact_ids ?? receipt.delivered_artifact_ids ?? [];
  const deliveryActionIds = artifactIds
    .map((artifactId) => deliveryActionsByArtifactId.get(artifactId)?.delivery_action_id)
    .filter(Boolean);
  const receiptStatus = receipt.receipt_status ?? "pending";
  return {
    schema_version: DELIVERY_RECEIPT_SCHEMA_VERSION,
    delivery_receipt_id: receipt.receipt_id ?? `receipt.${receipt.packet_id}`,
    source_receipt_id: receipt.receipt_id ?? null,
    packet_id: receipt.packet_id ?? null,
    tenant_id: receipt.tenant_id ?? null,
    matter_id: receipt.matter_id ?? null,
    delivery_channel: receipt.delivery_channel ?? null,
    delivery_target: receipt.delivery_target ?? null,
    priority: receipt.priority ?? "medium",
    receipt_kind: receipt.receipt_kind ?? "pending",
    receipt_status: receiptStatus,
    status_after: receipt.status_after ?? (receiptStatus === "delivered" ? "delivered" : "awaiting_receipt"),
    receipt_application_status: receipt.receipt_kind === "applied" ? "applied" : "pending_input",
    executed_by: receipt.executed_by ?? null,
    executed_at: receipt.executed_at ?? null,
    delivery_reference: receipt.delivery_reference ?? "",
    notes: receipt.notes ?? "",
    artifact_ids: artifactIds,
    delivery_action_ids: deliveryActionIds,
    delivery_patch_count: receipt.delivery_patches?.length ?? 0,
    output_patch_count: receipt.output_patches?.length ?? 0,
    pending_reason: receipt.reason ?? null,
    recorded_at: generatedAt,
    metadata: {
      original_receipt_kind: receipt.receipt_kind ?? null,
    },
  };
}

function outputDeliveryBindingV2({ artifact, deliveryActions, approvalRequests, approvalDecisions, deliveryReceipts, generatedAt }) {
  const approvalBindingStatus = deriveApprovalBindingStatus(artifact, approvalRequests);
  const deliveryBindingStatus = deliveryActions.length > 0 ? "linked" : "missing_delivery_action";
  const receiptBindingStatus = deliveryReceipts.length > 0 ? "linked" : "awaiting_receipt";
  const separationStatus = artifact.delivery_action_count > 0
    && artifact.delivery_separation_status === "separate_delivery_action_linked"
    && !["missing_approval_request"].includes(approvalBindingStatus)
    ? "generation_approval_delivery_separated"
    : "needs_attention";
  return {
    schema_version: OUTPUT_DELIVERY_BINDING_SCHEMA_VERSION,
    output_delivery_binding_id: `output-delivery-binding.${slugify(artifact.output_artifact_id)}`,
    output_artifact_id: artifact.output_artifact_id,
    artifact_type: artifact.artifact_type,
    domain_pack: artifact.domain_pack,
    tenant_id: artifact.tenant_id,
    matter_id: artifact.matter_id,
    approval_request_ids: approvalRequests.map((request) => request.approval_request_id),
    approval_decision_ids: approvalDecisions.map((decision) => decision.approval_decision_id),
    delivery_action_ids: deliveryActions.map((action) => action.delivery_action_id),
    delivery_receipt_ids: deliveryReceipts.map((receipt) => receipt.delivery_receipt_id),
    approval_binding_status: approvalBindingStatus,
    delivery_binding_status: deliveryBindingStatus,
    receipt_binding_status: receiptBindingStatus,
    binding_status: deliveryBindingStatus === "linked" && approvalBindingStatus !== "missing_approval_request" ? "linked" : "attention",
    separation_status: separationStatus,
    protected_action_count: deliveryActions.filter((action) => action.protected_action).length,
    ready_for_delivery_count: deliveryActions.filter((action) => action.ready_for_delivery).length,
    delivered_receipt_count: deliveryReceipts.filter((receipt) => receipt.receipt_status === "delivered").length,
    recorded_at: generatedAt,
  };
}

function buildDeliveryStateTransitions({ outputArtifactsV2ById, deliveryActionsV2, deliveryReceiptsV2, generatedAt }) {
  const catalogTransitions = deliveryActionsV2.map((action) => {
    const artifact = outputArtifactsV2ById.get(action.output_artifact_id);
    return {
      schema_version: DELIVERY_STATE_TRANSITION_SCHEMA_VERSION,
      delivery_state_transition_id: `delivery-transition.${slugify(action.delivery_action_id)}.catalog-to-queue`,
      transition_type: "catalog_to_delivery_queue",
      output_artifact_id: action.output_artifact_id,
      delivery_action_id: action.delivery_action_id,
      delivery_receipt_id: null,
      source_state: artifact?.delivery_state ?? null,
      target_state: action.delivery_status,
      protected_action: action.protected_action,
      draft_only: action.draft_only,
      ready_for_delivery: action.ready_for_delivery,
      executed: false,
      recorded_at: generatedAt,
      metadata: {
        delivery_channel: action.delivery_channel,
        delivery_target: action.delivery_target,
      },
    };
  });

  const receiptTransitions = deliveryReceiptsV2.flatMap((receipt) => (
    receipt.delivery_action_ids.map((deliveryActionId) => ({
      schema_version: DELIVERY_STATE_TRANSITION_SCHEMA_VERSION,
      delivery_state_transition_id: `delivery-transition.${slugify(deliveryActionId)}.${slugify(receipt.delivery_receipt_id)}`,
      transition_type: "delivery_receipt",
      output_artifact_id: receipt.artifact_ids[0] ?? null,
      delivery_action_id: deliveryActionId,
      delivery_receipt_id: receipt.delivery_receipt_id,
      source_state: "ready_for_delivery",
      target_state: receipt.status_after,
      protected_action: false,
      draft_only: receipt.receipt_status !== "delivered",
      ready_for_delivery: receipt.receipt_status === "pending",
      executed: receipt.receipt_status === "delivered",
      recorded_at: generatedAt,
      metadata: {
        receipt_status: receipt.receipt_status,
        delivery_channel: receipt.delivery_channel,
        delivery_target: receipt.delivery_target,
      },
    }))
  ));

  return [...catalogTransitions, ...receiptTransitions];
}

function collectReceiptRecords(deliveryReceiptLedger) {
  return [
    ...(deliveryReceiptLedger.applied_receipts ?? []).map((receipt) => ({ ...receipt, receipt_kind: "applied" })),
    ...(deliveryReceiptLedger.pending_receipts ?? []).map((receipt) => ({
      ...receipt,
      receipt_id: receipt.receipt_id ?? `receipt.${receipt.packet_id}`,
      receipt_status: "pending",
      receipt_kind: "pending",
    })),
  ];
}

function validateOutputDeliveryContracts({
  gateApprovalContractFreeze,
  outputArtifactsV2,
  deliveryActionsV2,
  deliveryReceiptsV2,
  outputDeliveryBindingsV2,
  deliveryStateTransitionsV2,
}) {
  const items = [];
  addValidation(items, {
    path: "source.gate_approval_contract_freeze",
    check_id: "gate_approval_freeze_complete",
    passed: gateApprovalContractFreeze.summary?.freeze_status === "complete" && gateApprovalContractFreeze.validation?.valid !== false,
    message: gateApprovalContractFreeze.summary?.freeze_status === "complete"
      ? "Gate/Approval contract freeze is complete."
      : "Gate/Approval contract freeze must be complete before freezing output/delivery contracts.",
  });
  addValidation(items, {
    path: "contract.output_artifacts",
    check_id: "output_artifact_v2_present",
    passed: outputArtifactsV2.length > 0,
    message: `${outputArtifactsV2.length} OutputArtifact v2 contract(s) projected.`,
  });
  addValidation(items, {
    path: "contract.delivery_actions",
    check_id: "delivery_action_v2_present",
    passed: deliveryActionsV2.length > 0,
    message: `${deliveryActionsV2.length} DeliveryAction v2 contract(s) projected.`,
  });

  const artifactIds = new Set(outputArtifactsV2.map((artifact) => artifact.output_artifact_id));
  const deliveryActionIds = new Set(deliveryActionsV2.map((action) => action.delivery_action_id));
  for (const artifact of outputArtifactsV2) {
    addValidation(items, {
      path: `output_artifact.${artifact.output_artifact_id}.schema_version`,
      check_id: "output_artifact_schema_version",
      passed: artifact.schema_version === OUTPUT_ARTIFACT_SCHEMA_VERSION,
      message: `${artifact.output_artifact_id} uses OutputArtifact v2.`,
    });
    addValidation(items, {
      path: `output_artifact.${artifact.output_artifact_id}.content_hash`,
      check_id: "output_artifact_hash_present",
      passed: artifact.hash_status === "present",
      message: artifact.hash_status === "present"
        ? `${artifact.output_artifact_id} has a tracked artifact hash.`
        : `${artifact.output_artifact_id} is missing content_hash.`,
    });
    addValidation(items, {
      path: `output_artifact.${artifact.output_artifact_id}.delivery_action_ids`,
      check_id: "output_artifact_has_delivery_action",
      passed: artifact.delivery_action_count > 0,
      message: artifact.delivery_action_count > 0
        ? `${artifact.output_artifact_id} is linked to a separate delivery action.`
        : `${artifact.output_artifact_id} has no separate delivery action.`,
    });
    addValidation(items, {
      path: `output_artifact.${artifact.output_artifact_id}.approval_request_ids`,
      check_id: "pending_artifact_has_approval_request",
      passed: artifact.approval_status !== "pending" || artifact.approval_request_count > 0,
      message: artifact.approval_status !== "pending" || artifact.approval_request_count > 0
        ? `${artifact.output_artifact_id} approval separation is satisfied.`
        : `${artifact.output_artifact_id} is pending approval but has no ApprovalRequest v2.`,
    });
  }

  for (const action of deliveryActionsV2) {
    addValidation(items, {
      path: `delivery_action.${action.delivery_action_id}.schema_version`,
      check_id: "delivery_action_schema_version",
      passed: action.schema_version === DELIVERY_ACTION_SCHEMA_VERSION,
      message: `${action.delivery_action_id} uses DeliveryAction v2.`,
    });
    addValidation(items, {
      path: `delivery_action.${action.delivery_action_id}.output_artifact_id`,
      check_id: "delivery_action_links_known_artifact",
      passed: artifactIds.has(action.output_artifact_id),
      message: artifactIds.has(action.output_artifact_id)
        ? `${action.delivery_action_id} links to a known OutputArtifact v2.`
        : `${action.delivery_action_id} links to unknown artifact ${action.output_artifact_id}.`,
    });
    addValidation(items, {
      path: `delivery_action.${action.delivery_action_id}.id`,
      check_id: "delivery_action_separate_object",
      passed: action.delivery_action_id !== action.output_artifact_id,
      message: action.delivery_action_id !== action.output_artifact_id
        ? `${action.delivery_action_id} is separate from its output artifact id.`
        : `${action.delivery_action_id} reuses the output artifact id.`,
    });
    addValidation(items, {
      path: `delivery_action.${action.delivery_action_id}.protected_action`,
      check_id: "protected_delivery_action_requires_approval",
      passed: !action.protected_action || action.requires_human_approval,
      message: !action.protected_action || action.requires_human_approval
        ? `${action.delivery_action_id} protected action has human approval requirement.`
        : `${action.delivery_action_id} is protected without human approval requirement.`,
    });
    addValidation(items, {
      path: `delivery_action.${action.delivery_action_id}.draft_only`,
      check_id: "delivery_not_executed_without_receipt",
      passed: action.executed || action.draft_only,
      message: action.executed || action.draft_only
        ? `${action.delivery_action_id} separates draft state from executed delivery.`
        : `${action.delivery_action_id} is neither draft-only nor executed.`,
    });
  }

  for (const receipt of deliveryReceiptsV2) {
    addValidation(items, {
      path: `delivery_receipt.${receipt.delivery_receipt_id}.schema_version`,
      check_id: "delivery_receipt_schema_version",
      passed: receipt.schema_version === DELIVERY_RECEIPT_SCHEMA_VERSION,
      message: `${receipt.delivery_receipt_id} uses DeliveryReceipt v2.`,
    });
    addValidation(items, {
      path: `delivery_receipt.${receipt.delivery_receipt_id}.delivery_action_ids`,
      check_id: "delivery_receipt_links_known_action",
      passed: receipt.delivery_action_ids.every((actionId) => deliveryActionIds.has(actionId)),
      message: `${receipt.delivery_receipt_id} links to ${receipt.delivery_action_ids.length} known delivery action(s).`,
    });
    addValidation(items, {
      path: `delivery_receipt.${receipt.delivery_receipt_id}.execution_fields`,
      check_id: "delivered_receipt_has_execution_fields",
      passed: receipt.receipt_status !== "delivered" || Boolean(receipt.executed_by && receipt.executed_at && receipt.delivery_reference),
      message: receipt.receipt_status !== "delivered" || Boolean(receipt.executed_by && receipt.executed_at && receipt.delivery_reference)
        ? `${receipt.delivery_receipt_id} execution fields are acceptable.`
        : `${receipt.delivery_receipt_id} is delivered but missing execution fields.`,
    });
  }

  for (const binding of outputDeliveryBindingsV2) {
    addValidation(items, {
      path: `output_delivery_binding.${binding.output_delivery_binding_id}.binding_status`,
      check_id: "output_delivery_binding_linked",
      passed: binding.binding_status === "linked",
      message: binding.binding_status === "linked"
        ? `${binding.output_delivery_binding_id} links output, approval, and delivery contracts.`
        : `${binding.output_delivery_binding_id} needs attention.`,
    });
    addValidation(items, {
      path: `output_delivery_binding.${binding.output_delivery_binding_id}.separation_status`,
      check_id: "output_delivery_separation_enforced",
      passed: binding.separation_status === "generation_approval_delivery_separated",
      message: binding.separation_status === "generation_approval_delivery_separated"
        ? `${binding.output_delivery_binding_id} enforces generation/approval/delivery separation.`
        : `${binding.output_delivery_binding_id} does not fully enforce separation.`,
    });
  }

  for (const transition of deliveryStateTransitionsV2) {
    addValidation(items, {
      path: `delivery_state_transition.${transition.delivery_state_transition_id}.schema_version`,
      check_id: "delivery_state_transition_schema_version",
      passed: transition.schema_version === DELIVERY_STATE_TRANSITION_SCHEMA_VERSION,
      message: `${transition.delivery_state_transition_id} uses DeliveryStateTransition v2.`,
    });
  }
  return items;
}

function summarizeFreeze(projection, validationItems, validation) {
  const { outputArtifactsV2, deliveryActionsV2, deliveryReceiptsV2, outputDeliveryBindingsV2, deliveryStateTransitionsV2 } = projection;
  const linkedDeliveryActionCount = outputArtifactsV2.filter((artifact) => artifact.delivery_action_count > 0).length;
  const missingDeliveryActionCount = outputArtifactsV2.length - linkedDeliveryActionCount;
  const pendingApprovalArtifacts = outputArtifactsV2.filter((artifact) => artifact.approval_status === "pending");
  const approvalRequestLinkedArtifactCount = pendingApprovalArtifacts.filter((artifact) => artifact.approval_request_count > 0).length;
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    output_artifact_schema_version: OUTPUT_ARTIFACT_SCHEMA_VERSION,
    delivery_action_schema_version: DELIVERY_ACTION_SCHEMA_VERSION,
    delivery_receipt_schema_version: DELIVERY_RECEIPT_SCHEMA_VERSION,
    output_delivery_binding_schema_version: OUTPUT_DELIVERY_BINDING_SCHEMA_VERSION,
    delivery_state_transition_schema_version: DELIVERY_STATE_TRANSITION_SCHEMA_VERSION,
    output_artifact_count: outputArtifactsV2.length,
    delivery_action_count: deliveryActionsV2.length,
    delivery_receipt_count: deliveryReceiptsV2.length,
    output_delivery_binding_count: outputDeliveryBindingsV2.length,
    delivery_state_transition_count: deliveryStateTransitionsV2.length,
    artifact_hash_count: outputArtifactsV2.filter((artifact) => artifact.hash_status === "present").length,
    missing_artifact_hash_count: outputArtifactsV2.filter((artifact) => artifact.hash_status === "missing").length,
    linked_delivery_action_count: linkedDeliveryActionCount,
    missing_delivery_action_count: missingDeliveryActionCount,
    pending_approval_artifact_count: pendingApprovalArtifacts.length,
    approval_request_linked_artifact_count: approvalRequestLinkedArtifactCount,
    protected_delivery_action_count: deliveryActionsV2.filter((action) => action.protected_action).length,
    draft_only_delivery_action_count: deliveryActionsV2.filter((action) => action.draft_only).length,
    ready_delivery_action_count: deliveryActionsV2.filter((action) => action.ready_for_delivery).length,
    executed_delivery_action_count: deliveryActionsV2.filter((action) => action.executed).length,
    delivered_receipt_count: deliveryReceiptsV2.filter((receipt) => receipt.receipt_status === "delivered").length,
    pending_receipt_count: deliveryReceiptsV2.filter((receipt) => receipt.receipt_status === "pending").length,
    linked_binding_count: outputDeliveryBindingsV2.filter((binding) => binding.binding_status === "linked").length,
    attention_binding_count: outputDeliveryBindingsV2.filter((binding) => binding.binding_status !== "linked").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_artifact_type: countBy(outputArtifactsV2, "artifact_type"),
    by_domain_pack: countBy(outputArtifactsV2, "domain_pack"),
    by_delivery_status: countBy(deliveryActionsV2, "delivery_status"),
    by_delivery_channel: countBy(deliveryActionsV2, "delivery_channel"),
    by_receipt_status: countBy(deliveryReceiptsV2, "receipt_status"),
    by_binding_status: countBy(outputDeliveryBindingsV2, "binding_status"),
    by_transition_type: countBy(deliveryStateTransitionsV2, "transition_type"),
  };
}

function buildFieldRequirements() {
  return {
    output_artifact_v2: {
      required_fields: [
        "schema_version",
        "output_artifact_id",
        "artifact_type",
        "artifact_uri",
        "content_hash",
        "hash_status",
        "created_by_run_id",
        "workflow_run_id",
        "tenant_id",
        "matter_id",
        "approval_request_ids",
        "delivery_action_ids",
        "delivery_receipt_ids",
      ],
      optional_fields: ["event_id", "policy_snapshot_id", "metadata"],
      required_groups: {
        identity: ["tenant_id", "matter_id"],
        lineage: ["workflow_run_id", "created_by_run_id", "content_hash"],
      },
    },
    delivery_action_v2: {
      required_fields: [
        "schema_version",
        "delivery_action_id",
        "output_artifact_id",
        "delivery_target",
        "delivery_channel",
        "delivery_status",
        "protected_action",
        "draft_only",
        "requires_human_approval",
        "ready_for_delivery",
        "executed",
      ],
      optional_fields: ["execution_packet_id", "event_id", "policy_snapshot_id", "metadata"],
      required_groups: {
        separation: ["delivery_action_id", "output_artifact_id", "delivery_status"],
        protection: ["protected_action", "requires_human_approval", "draft_only"],
      },
    },
    delivery_receipt_v2: {
      required_fields: [
        "schema_version",
        "delivery_receipt_id",
        "packet_id",
        "receipt_status",
        "status_after",
        "receipt_application_status",
        "artifact_ids",
        "delivery_action_ids",
      ],
      optional_fields: ["executed_by", "executed_at", "delivery_reference", "notes", "metadata"],
      required_groups: {
        execution: ["receipt_status", "status_after", "artifact_ids"],
      },
    },
    output_delivery_binding_v2: {
      required_fields: [
        "schema_version",
        "output_delivery_binding_id",
        "output_artifact_id",
        "approval_request_ids",
        "delivery_action_ids",
        "delivery_receipt_ids",
        "binding_status",
        "separation_status",
      ],
      optional_fields: ["approval_decision_ids"],
      required_groups: {
        separation: ["approval_binding_status", "delivery_binding_status", "receipt_binding_status"],
      },
    },
    delivery_state_transition_v2: {
      required_fields: [
        "schema_version",
        "delivery_state_transition_id",
        "transition_type",
        "output_artifact_id",
        "delivery_action_id",
        "source_state",
        "target_state",
        "protected_action",
        "draft_only",
        "executed",
      ],
      optional_fields: ["delivery_receipt_id", "metadata"],
      required_groups: {
        state: ["source_state", "target_state", "transition_type"],
      },
    },
  };
}

function renderOutputDeliveryContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Output/Delivery Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze ID: ${result.freeze_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Freeze status: ${result.summary.freeze_status}`);
  lines.push(`- OutputArtifact v2: ${result.summary.output_artifact_count}`);
  lines.push(`- DeliveryAction v2: ${result.summary.delivery_action_count}`);
  lines.push(`- DeliveryReceipt v2: ${result.summary.delivery_receipt_count}`);
  lines.push(`- OutputDeliveryBinding v2: ${result.summary.output_delivery_binding_count}`);
  lines.push(`- DeliveryStateTransition v2: ${result.summary.delivery_state_transition_count}`);
  lines.push(`- Artifact hashes tracked: ${result.summary.artifact_hash_count}/${result.summary.output_artifact_count}`);
  lines.push(`- Delivery actions linked: ${result.summary.linked_delivery_action_count}/${result.summary.output_artifact_count}`);
  lines.push(`- Pending approval artifacts with ApprovalRequest v2: ${result.summary.approval_request_linked_artifact_count}/${result.summary.pending_approval_artifact_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract Objects");
  lines.push("");
  for (const artifact of result.output_delivery_contract.output_artifacts) {
    lines.push(`- ${artifact.output_artifact_id}: ${artifact.hash_status}, ${artifact.delivery_separation_status}, ${artifact.approval_separation_status}`);
  }
  if (result.output_delivery_contract.output_artifacts.length === 0) lines.push("- No output artifacts projected.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_OUTPUT_DELIVERY_CONTRACT_FREEZE_INPUTS;
  return {
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? defaults.outputArtifactCatalogPath),
    protected_delivery_queue_path: path.resolve(options.protectedDeliveryQueuePath ?? defaults.protectedDeliveryQueuePath),
    approval_inbox_decision_path: path.resolve(options.approvalInboxDecisionPath ?? defaults.approvalInboxDecisionPath),
    delivery_execution_draft_path: path.resolve(options.deliveryExecutionDraftPath ?? defaults.deliveryExecutionDraftPath),
    delivery_receipt_ledger_path: path.resolve(options.deliveryReceiptLedgerPath ?? defaults.deliveryReceiptLedgerPath),
    post_delivery_reconciliation_path: path.resolve(options.postDeliveryReconciliationPath ?? defaults.postDeliveryReconciliationPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? defaults.gateApprovalContractFreezePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? defaults.runtimeAgentRunContractFreezePath),
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? defaults.observabilityCatalogPath),
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

function deriveArtifactApprovalSeparationStatus(artifact, approvalRequests) {
  if (artifact.approval_status === "pending") {
    return approvalRequests.length > 0 ? "separate_approval_linked" : "missing_approval_request";
  }
  if (approvalRequests.length > 0) return "separate_approval_linked";
  return "not_required";
}

function deriveApprovalBindingStatus(artifact, approvalRequests) {
  if (artifact.approval_status === "pending") return approvalRequests.length > 0 ? "linked" : "missing_approval_request";
  if (approvalRequests.length > 0) return "linked";
  return "not_required";
}

function outputArtifactSubjectId(subjectRef) {
  return subjectRef?.subject_type === "output_artifact" ? subjectRef.subject_id : null;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const rawKeys = keyFn(item);
    const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
    for (const key of keys.filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
  }
  return groups;
}

function groupByIdValues(items, keyFn, valueFn) {
  const groups = new Map();
  for (const item of items) {
    const rawKeys = keyFn(item);
    const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
    for (const key of keys.filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(valueFn(item));
    }
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
    outDir: DEFAULT_OUTPUT_DELIVERY_CONTRACT_FREEZE_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--output-artifact-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--protected-delivery-queue") parsed.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--approval-inbox-decisions") parsed.approvalInboxDecisionPath = argv[++index];
    else if (arg === "--delivery-execution-draft") parsed.deliveryExecutionDraftPath = argv[++index];
    else if (arg === "--delivery-receipt-ledger") parsed.deliveryReceiptLedgerPath = argv[++index];
    else if (arg === "--post-delivery-reconciliation") parsed.postDeliveryReconciliationPath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/output-delivery-contract-freeze.mjs [options]

Freeze OutputArtifact/Delivery v2 contracts from the current output, delivery, receipt, approval, and observability artifacts.

Options:
  --check                                      Exit non-zero when validation fails.
  --out-dir, --out <path>                     Output directory.
  --run-at <iso>                              Override generated_at timestamp.
  --output-artifact-catalog <path>            Output artifact catalog JSON.
  --protected-delivery-queue <path>           Protected delivery queue JSON.
  --approval-inbox-decisions <path>           Approval inbox decision result JSON.
  --delivery-execution-draft <path>           Delivery execution draft JSON.
  --delivery-receipt-ledger <path>            Delivery receipt ledger JSON.
  --post-delivery-reconciliation <path>       Post-delivery reconciliation JSON.
  --gate-approval-contract-freeze <path>      Gate/Approval contract freeze JSON.
  --runtime-agentrun-contract-freeze <path>   Runtime/AgentRun contract freeze JSON.
  --observability-catalog <path>              Observability catalog JSON.
`);
}
