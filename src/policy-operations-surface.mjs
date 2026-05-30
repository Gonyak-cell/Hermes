import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POLICY_OPERATIONS_SURFACE_OUT_DIR = "artifacts/policy-operations-surface/latest";
export const DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS = {
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  approvalAuthorityLedgerPath: "artifacts/approval-authority/latest/approval-authority-ledger.json",
  matterTaggingDecisionLedgerPath: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
  conflictCheckInterfacePath: "artifacts/conflict-check/latest/conflict-check-interface.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  personalWorkspaceBoundaryPath: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
  policyGoldenFixturesPath: "artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json",
};

export async function runPolicyOperationsSurface(options = {}) {
  const result = await buildPolicyOperationsSurface(options);
  if (options.write !== false) await writePolicyOperationsSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Policy operations surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPolicyOperationsSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POLICY_OPERATIONS_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    matterAccessPolicyEvaluator: await readJson(inputs.matter_access_policy_evaluator_path),
    dataClassificationRuleEngine: await readJson(inputs.data_classification_rule_engine_path),
    modelPolicyEnforcement: await readJson(inputs.model_policy_enforcement_path),
    toolRuntimePolicyEnforcement: await readJson(inputs.tool_runtime_policy_enforcement_path),
    outputDestinationPolicyEnforcement: await readJson(inputs.output_destination_policy_enforcement_path),
    approvalAuthorityLedger: await readJson(inputs.approval_authority_ledger_path),
    matterTaggingDecisionLedger: await readJson(inputs.matter_tagging_decision_ledger_path),
    conflictCheckInterface: await readJson(inputs.conflict_check_interface_path),
    storePolicyAdapter: await readJson(inputs.store_policy_adapter_path),
    personalWorkspaceBoundary: await readJson(inputs.personal_workspace_boundary_path),
    policyGoldenFixtures: await readJson(inputs.policy_golden_fixtures_path),
  };
  const decisionRows = buildDecisionRows(sources, generatedAt);
  const violationRows = buildViolationRows(decisionRows, generatedAt);
  const pendingApprovalRows = buildPendingApprovalRows(decisionRows, sources.approvalAuthorityLedger, generatedAt);
  const validationItems = validatePolicyOperationsSurface({
    sources,
    decisionRows,
    violationRows,
    pendingApprovalRows,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "policy-operations-surface.v1",
    generated_at: generatedAt,
    policy_operations_surface_id: `policy-operations-surface.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_statuses: {
      matter_access_policy_evaluator: sourceStatus(sources.matterAccessPolicyEvaluator, "access_policy_status"),
      data_classification_rule_engine: sourceStatus(sources.dataClassificationRuleEngine, "classification_rule_engine_status"),
      model_policy_enforcement: sourceStatus(sources.modelPolicyEnforcement, "model_policy_enforcement_status"),
      tool_runtime_policy_enforcement: sourceStatus(sources.toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status"),
      output_destination_policy_enforcement: sourceStatus(sources.outputDestinationPolicyEnforcement, "output_destination_policy_status"),
      approval_authority_ledger: sourceStatus(sources.approvalAuthorityLedger, "approval_authority_status"),
      matter_tagging_decision_ledger: sourceStatus(sources.matterTaggingDecisionLedger, "matter_tagging_ledger_status"),
      conflict_check_interface: sourceStatus(sources.conflictCheckInterface, "conflict_check_interface_status"),
      store_policy_adapter: sourceStatus(sources.storePolicyAdapter, "store_policy_adapter_status"),
      personal_workspace_boundary: sourceStatus(sources.personalWorkspaceBoundary, "personal_workspace_boundary_status"),
      policy_golden_fixtures: sourceStatus(sources.policyGoldenFixtures, "policy_golden_fixture_status"),
    },
    policy_operations_catalog: {
      schema_version: "policy-operations-catalog.v1",
      generated_at: generatedAt,
      policy_decision_rows: decisionRows,
      policy_violation_rows: violationRows,
      policy_pending_approval_rows: pendingApprovalRows,
    },
    validation_items: validationItems,
    validation,
    summary: summarizePolicyOperationsSurface(decisionRows, violationRows, pendingApprovalRows, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderPolicyOperationsSurfaceMarkdown(result),
  };
}

export async function writePolicyOperationsSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePolicyOperationsSurface(result);
  await writeJson(path.join(outDir, "policy-operations-surface.json"), serializable);
  await writeJson(path.join(outDir, "policy-decision-rows.json"), {
    generated_at: result.generated_at,
    policy_decision_row_count: result.policy_operations_catalog.policy_decision_rows.length,
    policy_decision_rows: result.policy_operations_catalog.policy_decision_rows,
  });
  await writeJson(path.join(outDir, "policy-violation-rows.json"), {
    generated_at: result.generated_at,
    policy_violation_row_count: result.policy_operations_catalog.policy_violation_rows.length,
    policy_violation_rows: result.policy_operations_catalog.policy_violation_rows,
  });
  await writeJson(path.join(outDir, "policy-pending-approval-rows.json"), {
    generated_at: result.generated_at,
    policy_pending_approval_row_count: result.policy_operations_catalog.policy_pending_approval_rows.length,
    policy_pending_approval_rows: result.policy_operations_catalog.policy_pending_approval_rows,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    policy_operations_surface_id: result.policy_operations_surface_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPolicyOperationsSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPolicyOperationsSurface(args);
    console.log(`Policy operations surface written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.policy_operations_surface_status}`);
    console.log(`Decisions: ${result.summary.policy_decision_row_count}`);
    console.log(`Violations: ${result.summary.policy_violation_row_count}`);
    console.log(`Pending approvals: ${result.summary.policy_pending_approval_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildDecisionRows(sources, generatedAt) {
  const rows = [];
  addMatterAccessRows(rows, sources.matterAccessPolicyEvaluator, generatedAt);
  addDataClassificationRows(rows, sources.dataClassificationRuleEngine, generatedAt);
  addModelPolicyRows(rows, sources.modelPolicyEnforcement, generatedAt);
  addToolRuntimeRows(rows, sources.toolRuntimePolicyEnforcement, generatedAt);
  addOutputDestinationRows(rows, sources.outputDestinationPolicyEnforcement, generatedAt);
  addMatterTaggingRows(rows, sources.matterTaggingDecisionLedger, generatedAt);
  addConflictCheckRows(rows, sources.conflictCheckInterface, generatedAt);
  addStorePolicyRows(rows, sources.storePolicyAdapter, generatedAt);
  addWorkspaceBoundaryRows(rows, sources.personalWorkspaceBoundary, generatedAt);
  addPolicyGoldenRows(rows, sources.policyGoldenFixtures, generatedAt);
  return rows.sort(by("policy_decision_row_id"));
}

function addMatterAccessRows(rows, artifact, generatedAt) {
  for (const row of artifact.matter_access_policy?.matter_access_decisions ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "matter_access_policy_evaluator",
      sourceRecordType: "matter_access_decision",
      sourceRecordId: row.matter_access_decision_id,
      policyLayer: "matter_access",
      decision: row.access_decision,
      gateStatus: row.context_mode,
      tenantId: row.tenant_id,
      matterId: row.matter_id,
      resourceId: null,
      runtimeId: row.runtime_id,
      classification: row.classification,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.requires_human_review,
      approvalRequired: row.requires_human_review,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { can_retrieve: row.can_retrieve, subject_type: row.subject_type },
      generatedAt,
    }));
  }
  for (const row of artifact.matter_access_policy?.resource_access_decisions ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "matter_access_policy_evaluator",
      sourceRecordType: "resource_access_decision",
      sourceRecordId: row.resource_access_decision_id,
      policyLayer: "matter_access",
      decision: row.access_decision,
      gateStatus: row.context_mode,
      tenantId: row.tenant_id,
      matterId: row.target_matter_id,
      resourceId: row.resource_id,
      runtimeId: row.runtime_id,
      classification: row.resource_classification,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates?.length ? row.required_gates : ["matter_tagging_gate"],
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.requires_human_review,
      approvalRequired: row.requires_human_review,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { can_retrieve: row.can_retrieve, resource_matter_id: row.resource_matter_id },
      generatedAt,
    }));
  }
  for (const row of artifact.matter_access_policy?.runtime_access_matrix ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "matter_access_policy_evaluator",
      sourceRecordType: "runtime_access_matrix",
      sourceRecordId: row.runtime_access_matrix_id,
      policyLayer: "matter_access",
      decision: row.runtime_policy_decision,
      gateStatus: row.runtime_context_mode,
      tenantId: null,
      matterId: row.matter_id,
      resourceId: null,
      runtimeId: row.runtime_id,
      classification: row.classification,
      policySnapshotId: null,
      requiredGates: row.required_gates,
      reasonCodes: [],
      humanReviewRequired: row.runtime_policy_decision === "review",
      approvalRequired: row.runtime_policy_decision === "review",
      protectedAction: false,
      decidedAt: row.created_at,
      metadata: { raw_context_allowed: row.raw_context_allowed, redacted_context_allowed: row.redacted_context_allowed },
      generatedAt,
    }));
  }
}

function addDataClassificationRows(rows, artifact, generatedAt) {
  for (const row of artifact.classification_rule_catalog?.resource_classification_decisions ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "data_classification_rule_engine",
      sourceRecordType: "resource_classification_decision",
      sourceRecordId: row.resource_classification_decision_id,
      policyLayer: "data_classification",
      decision: row.resource_policy_decision,
      gateStatus: row.context_mode,
      tenantId: row.tenant_id,
      matterId: row.matter_id,
      resourceId: row.resource_id,
      runtimeId: null,
      classification: row.effective_classification,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates,
      reasonCodes: [],
      humanReviewRequired: row.requires_human_review,
      approvalRequired: row.requires_human_review,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { external_model_decision: row.external_model_decision, requires_redaction: row.requires_redaction },
      generatedAt,
    }));
  }
  for (const row of artifact.classification_rule_catalog?.classification_policy_bindings ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "data_classification_rule_engine",
      sourceRecordType: "classification_policy_binding",
      sourceRecordId: row.classification_policy_binding_id,
      policyLayer: "data_classification",
      decision: row.default_policy_decision,
      gateStatus: row.binding_status,
      tenantId: null,
      matterId: null,
      resourceId: null,
      runtimeId: null,
      classification: row.classification,
      policySnapshotId: null,
      requiredGates: row.required_gates,
      reasonCodes: [],
      humanReviewRequired: row.review_resource_count > 0,
      approvalRequired: row.review_resource_count > 0,
      protectedAction: false,
      decidedAt: row.created_at,
      metadata: { resource_count: row.resource_count, external_model_decision: row.external_model_decision },
      generatedAt,
    }));
  }
}

function addModelPolicyRows(rows, artifact, generatedAt) {
  for (const row of artifact.model_policy_gate_catalog?.classification_model_gates ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "model_policy_enforcement",
      sourceRecordType: "classification_model_policy_gate",
      sourceRecordId: row.classification_model_gate_id,
      policyLayer: "model_policy",
      decision: row.external_model_decision,
      gateStatus: row.gate_status,
      tenantId: null,
      matterId: null,
      resourceId: null,
      runtimeId: null,
      classification: row.classification,
      policySnapshotId: null,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.human_approval_required,
      approvalRequired: row.human_approval_required,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { external_model_policy: row.external_model_policy, enforcement_mode: row.enforcement_mode },
      generatedAt,
    }));
  }
  for (const row of artifact.model_policy_gate_catalog?.resource_model_gates ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "model_policy_enforcement",
      sourceRecordType: "resource_model_policy_gate",
      sourceRecordId: row.resource_model_gate_id,
      policyLayer: "model_policy",
      decision: row.external_model_decision,
      gateStatus: row.gate_status,
      tenantId: row.tenant_id,
      matterId: row.matter_id,
      resourceId: row.resource_id,
      runtimeId: null,
      classification: row.classification,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.human_approval_required,
      approvalRequired: row.human_approval_required,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { external_model_policy: row.external_model_policy, redaction_status: row.redaction_status },
      generatedAt,
    }));
  }
  for (const row of artifact.model_policy_gate_catalog?.route_model_gates ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "model_policy_enforcement",
      sourceRecordType: "route_model_policy_gate",
      sourceRecordId: row.route_model_gate_id,
      policyLayer: "model_policy",
      decision: row.gate_decision,
      gateStatus: row.gate_status,
      tenantId: row.tenant_id,
      matterId: row.matter_id,
      resourceId: null,
      runtimeId: row.runtime_id,
      classification: row.classification,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates,
      reasonCodes: row.enforcement_reasons,
      humanReviewRequired: row.human_approval_required,
      approvalRequired: row.human_approval_required,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { capability_id: row.capability_id, external_transfer: row.external_transfer, provider_boundary: row.provider_boundary },
      generatedAt,
    }));
  }
}

function addToolRuntimeRows(rows, artifact, generatedAt) {
  for (const row of [
    ...(artifact.tool_runtime_policy_catalog?.runtime_policy_gates ?? []),
    ...(artifact.tool_runtime_policy_catalog?.tool_permission_gates ?? []),
    ...(artifact.tool_runtime_policy_catalog?.agent_run_tool_gates ?? []),
  ]) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "tool_runtime_policy_enforcement",
      sourceRecordType: row.tool_permission_gate_id ? "tool_permission_gate" : row.agent_run_tool_gate_id ? "agent_run_tool_gate" : "runtime_policy_gate",
      sourceRecordId: row.tool_permission_gate_id ?? row.agent_run_tool_gate_id ?? row.runtime_policy_gate_id,
      policyLayer: "tool_runtime",
      decision: row.gate_decision ?? row.runtime_policy_decision,
      gateStatus: row.gate_status,
      tenantId: row.tenant_id ?? null,
      matterId: row.matter_id ?? null,
      resourceId: null,
      runtimeId: row.runtime_id,
      classification: row.classification ?? null,
      policySnapshotId: row.policy_snapshot_id ?? null,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.approval_required ?? row.human_approval_required ?? false,
      approvalRequired: row.approval_required ?? row.human_approval_required ?? false,
      protectedAction: row.protected_action ?? false,
      decidedAt: row.decided_at,
      metadata: { tool_id: row.tool_id ?? null, requested_state: row.requested_state ?? null },
      generatedAt,
    }));
  }
}

function addOutputDestinationRows(rows, artifact, generatedAt) {
  for (const row of [
    ...(artifact.output_destination_policy_catalog?.artifact_destination_gates ?? []),
    ...(artifact.output_destination_policy_catalog?.delivery_action_destination_gates ?? []),
    ...(artifact.output_destination_policy_catalog?.final_action_separation_gates ?? []),
  ]) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "output_destination_policy_enforcement",
      sourceRecordType: row.final_action_separation_gate_id ? "final_action_separation_gate" : row.delivery_action_destination_gate_id ? "delivery_action_destination_gate" : "artifact_destination_gate",
      sourceRecordId: row.final_action_separation_gate_id ?? row.delivery_action_destination_gate_id ?? row.artifact_destination_gate_id,
      policyLayer: "output_destination",
      decision: row.gate_decision,
      gateStatus: row.gate_status,
      tenantId: row.tenant_id ?? null,
      matterId: row.matter_id ?? null,
      resourceId: null,
      runtimeId: null,
      classification: row.classification ?? null,
      policySnapshotId: row.policy_snapshot_id ?? null,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.gate_decision === "review",
      approvalRequired: row.gate_decision === "review",
      protectedAction: row.final_action_required ?? row.protected_destination ?? false,
      decidedAt: row.decided_at,
      metadata: { artifact_type: row.artifact_type, destination_kind: row.destination_kind, delivery_policy: row.delivery_policy },
      generatedAt,
    }));
  }
}

function addMatterTaggingRows(rows, artifact, generatedAt) {
  for (const row of artifact.matter_tagging_catalog?.matter_tagging_decisions ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "matter_tagging_decision_ledger",
      sourceRecordType: "matter_tagging_decision",
      sourceRecordId: row.matter_tagging_decision_id,
      policyLayer: "matter_tagging",
      decision: row.tagging_status === "pending_human_confirmation" ? "review" : row.tagging_status === "blocked" ? "deny" : "allow",
      gateStatus: row.tagging_status,
      tenantId: row.tenant_id,
      matterId: row.proposed_matter_id ?? row.current_matter_id,
      resourceId: row.resource_id,
      runtimeId: null,
      classification: row.classification ?? null,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.required_gates?.length ? row.required_gates : ["matter_tagging_gate"],
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.human_review_required ?? row.tagging_status === "pending_human_confirmation",
      approvalRequired: row.human_review_required ?? row.tagging_status === "pending_human_confirmation",
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { current_matter_id: row.current_matter_id, proposed_matter_id: row.proposed_matter_id },
      generatedAt,
    }));
  }
}

function addConflictCheckRows(rows, artifact, generatedAt) {
  for (const row of artifact.conflict_check_catalog?.conflict_check_results ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "conflict_check_interface",
      sourceRecordType: "conflict_check_result",
      sourceRecordId: row.conflict_check_result_id,
      policyLayer: "conflict_check",
      decision: row.result_status,
      gateStatus: row.result_status,
      tenantId: row.tenant_id,
      matterId: row.matter_id,
      resourceId: row.target_resource_id,
      runtimeId: null,
      classification: null,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: ["conflict_check_gate"],
      reasonCodes: [row.final_access_effect].filter(Boolean),
      humanReviewRequired: row.human_review_required,
      approvalRequired: row.human_review_required,
      protectedAction: false,
      decidedAt: row.decided_at,
      metadata: { request_type: row.request_type, signal_count: row.signal_count },
      generatedAt,
    }));
  }
}

function addStorePolicyRows(rows, artifact, generatedAt) {
  for (const row of artifact.store_policy_catalog?.store_query_plans ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "store_policy_adapter",
      sourceRecordType: "store_query_plan",
      sourceRecordId: row.store_query_plan_id,
      policyLayer: "store_policy",
      decision: row.query_status,
      gateStatus: row.query_status,
      tenantId: row.tenant_id,
      matterId: row.target_matter_id,
      resourceId: row.target_resource_id,
      runtimeId: row.runtime_id,
      classification: row.resource_classification ?? row.classification_floor,
      policySnapshotId: row.policy_snapshot_id,
      requiredGates: row.metadata?.required_gates ?? ["store_policy_gate"],
      reasonCodes: row.metadata?.reason_codes ?? [],
      humanReviewRequired: row.requires_human_review,
      approvalRequired: row.requires_human_review,
      protectedAction: false,
      decidedAt: row.generated_at,
      metadata: { collection_id: row.collection_id, query_filters: row.query_filters, can_retrieve: row.can_retrieve },
      generatedAt,
    }));
  }
}

function addWorkspaceBoundaryRows(rows, artifact, generatedAt) {
  for (const row of artifact.workspace_boundary_catalog?.cross_workspace_probes ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "personal_workspace_boundary",
      sourceRecordType: "cross_workspace_probe",
      sourceRecordId: row.cross_workspace_probe_id,
      policyLayer: "workspace_boundary",
      decision: row.observed_outcome,
      gateStatus: row.observed_outcome,
      tenantId: row.requester_tenant_id,
      matterId: null,
      resourceId: null,
      runtimeId: null,
      classification: null,
      policySnapshotId: null,
      requiredGates: ["tenant_boundary_gate", "search_namespace_gate"],
      reasonCodes: [row.block_reason].filter(Boolean),
      humanReviewRequired: false,
      approvalRequired: false,
      protectedAction: true,
      decidedAt: row.created_at,
      metadata: { probe_type: row.probe_type, target_tenant_id: row.target_tenant_id },
      generatedAt,
    }));
  }
}

function addPolicyGoldenRows(rows, artifact, generatedAt) {
  for (const row of artifact.policy_golden_fixture_catalog?.policy_fixture_cases ?? []) {
    rows.push(buildDecisionRow({
      sourceArtifactId: "policy_golden_fixtures",
      sourceRecordType: "policy_fixture_case",
      sourceRecordId: row.policy_fixture_case_id,
      policyLayer: `golden_${row.fixture_group}`,
      decision: row.observed_decision,
      gateStatus: row.observed_gate_status,
      tenantId: row.metadata?.tenant_id ?? row.metadata?.requester_tenant_id ?? null,
      matterId: row.metadata?.matter_id ?? row.metadata?.target_matter_id ?? null,
      resourceId: row.metadata?.target_resource_id ?? null,
      runtimeId: row.metadata?.runtime_id ?? null,
      classification: row.metadata?.classification ?? null,
      policySnapshotId: row.metadata?.policy_snapshot_id ?? null,
      requiredGates: row.required_gates,
      reasonCodes: row.reason_codes,
      humanReviewRequired: row.human_approval_required,
      approvalRequired: row.human_approval_required,
      protectedAction: row.expected_decision === "deny",
      decidedAt: row.captured_at,
      metadata: { fixture_group: row.fixture_group, regression_hash: row.regression_hash, case_status: row.case_status },
      generatedAt,
    }));
  }
}

function buildDecisionRow({
  sourceArtifactId,
  sourceRecordType,
  sourceRecordId,
  policyLayer,
  decision,
  gateStatus,
  tenantId,
  matterId,
  resourceId,
  runtimeId,
  classification,
  policySnapshotId,
  requiredGates = [],
  reasonCodes = [],
  humanReviewRequired = false,
  approvalRequired = false,
  protectedAction = false,
  decidedAt,
  metadata = {},
  generatedAt,
}) {
  const normalizedDecision = normalizeDecision(decision);
  const normalizedGateStatus = gateStatus ?? statusForDecision(normalizedDecision);
  const controlEffect = controlEffectFor(normalizedDecision);
  return {
    schema_version: "policy-decision-row.v1",
    policy_decision_row_id: `policy-decision-row.${slugify(sourceArtifactId)}.${slugify(sourceRecordType)}.${slugify(sourceRecordId)}`,
    source_artifact_id: sourceArtifactId,
    source_record_type: sourceRecordType,
    source_record_id: sourceRecordId,
    policy_layer: policyLayer,
    decision: normalizedDecision,
    gate_status: normalizedGateStatus,
    control_effect: controlEffect,
    tenant_id: tenantId ?? null,
    matter_id: matterId ?? null,
    resource_id: resourceId ?? null,
    runtime_id: runtimeId ?? null,
    classification: classification ?? null,
    policy_snapshot_id: policySnapshotId ?? null,
    required_gates: unique(requiredGates),
    reason_codes: unique(reasonCodes),
    human_review_required: Boolean(humanReviewRequired),
    approval_required: Boolean(approvalRequired) || normalizedDecision === "review" || normalizedGateStatus === "requires_approval",
    protected_action: Boolean(protectedAction),
    pending_approval: normalizedDecision === "review" || Boolean(humanReviewRequired) || Boolean(approvalRequired) || normalizedGateStatus === "requires_approval",
    violation_candidate: normalizedDecision === "deny" || normalizedGateStatus === "blocked" || controlEffect === "block",
    decided_at: decidedAt ?? generatedAt,
    captured_at: generatedAt,
    metadata,
  };
}

function buildViolationRows(decisionRows, generatedAt) {
  return decisionRows
    .filter((row) => row.violation_candidate)
    .map((row) => ({
      schema_version: "policy-violation-row.v1",
      policy_violation_row_id: `policy-violation-row.${slugify(row.policy_decision_row_id)}`,
      policy_decision_row_id: row.policy_decision_row_id,
      source_artifact_id: row.source_artifact_id,
      source_record_type: row.source_record_type,
      source_record_id: row.source_record_id,
      policy_layer: row.policy_layer,
      violation_type: violationTypeFor(row),
      severity: severityFor(row),
      decision: row.decision,
      gate_status: row.gate_status,
      tenant_id: row.tenant_id,
      matter_id: row.matter_id,
      resource_id: row.resource_id,
      runtime_id: row.runtime_id,
      classification: row.classification,
      policy_snapshot_id: row.policy_snapshot_id,
      reason_codes: row.reason_codes,
      remediation: remediationFor(row),
      detected_at: generatedAt,
    }));
}

function buildPendingApprovalRows(decisionRows, approvalAuthorityLedger, generatedAt) {
  const rows = decisionRows
    .filter((row) => row.pending_approval)
    .map((row) => ({
      schema_version: "policy-pending-approval-row.v1",
      policy_pending_approval_id: `policy-pending-approval.${slugify(row.policy_decision_row_id)}`,
      policy_decision_row_id: row.policy_decision_row_id,
      source_artifact_id: row.source_artifact_id,
      source_record_type: row.source_record_type,
      source_record_id: row.source_record_id,
      policy_layer: row.policy_layer,
      approval_type: approvalTypeFor(row),
      required_actor: requiredActorFor(row),
      required_gates: row.required_gates,
      tenant_id: row.tenant_id,
      matter_id: row.matter_id,
      resource_id: row.resource_id,
      runtime_id: row.runtime_id,
      classification: row.classification,
      policy_snapshot_id: row.policy_snapshot_id,
      pending_reason: row.reason_codes[0] ?? row.gate_status,
      status: "pending",
      created_at: generatedAt,
    }));
  for (const row of [
    ...(approvalAuthorityLedger.approval_authority_catalog?.artifact_authority_decisions ?? []),
    ...(approvalAuthorityLedger.approval_authority_catalog?.approval_request_authority_decisions ?? []),
    ...(approvalAuthorityLedger.approval_authority_catalog?.delivery_action_authority_decisions ?? []),
  ]) {
    if (row.approval_status !== "pending" && row.authority_status !== "assignment_required") continue;
    rows.push({
      schema_version: "policy-pending-approval-row.v1",
      policy_pending_approval_id: `policy-pending-approval.${slugify(row.artifact_authority_decision_id ?? row.approval_request_authority_decision_id ?? row.delivery_action_authority_decision_id)}`,
      policy_decision_row_id: null,
      source_artifact_id: "approval_authority_ledger",
      source_record_type: row.artifact_authority_decision_id ? "artifact_authority_decision" : row.approval_request_authority_decision_id ? "approval_request_authority_decision" : "delivery_action_authority_decision",
      source_record_id: row.artifact_authority_decision_id ?? row.approval_request_authority_decision_id ?? row.delivery_action_authority_decision_id,
      policy_layer: "approval_authority",
      approval_type: row.required_approval_level ?? row.approval_kind ?? "human_approval",
      required_actor: row.required_actor ?? row.required_authority_role ?? "human_reviewer",
      required_gates: ["human_approval_gate"],
      tenant_id: row.tenant_id ?? null,
      matter_id: row.matter_id ?? null,
      resource_id: null,
      runtime_id: null,
      classification: null,
      policy_snapshot_id: null,
      pending_reason: row.assignment_status ?? row.authority_status ?? row.approval_status,
      status: row.authority_status === "assignment_required" ? "assignment_required" : "pending",
      created_at: generatedAt,
    });
  }
  return rows.sort(by("policy_pending_approval_id"));
}

function validatePolicyOperationsSurface({ sources, decisionRows, violationRows, pendingApprovalRows }) {
  const items = [];
  const sourceStatusChecks = [
    ["matter_access_policy_evaluator", sources.matterAccessPolicyEvaluator.summary?.access_policy_status],
    ["data_classification_rule_engine", sources.dataClassificationRuleEngine.summary?.classification_rule_engine_status],
    ["model_policy_enforcement", sources.modelPolicyEnforcement.summary?.model_policy_enforcement_status],
    ["tool_runtime_policy_enforcement", sources.toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status],
    ["output_destination_policy_enforcement", sources.outputDestinationPolicyEnforcement.summary?.output_destination_policy_status],
    ["approval_authority_ledger", sources.approvalAuthorityLedger.summary?.approval_authority_status],
    ["matter_tagging_decision_ledger", sources.matterTaggingDecisionLedger.summary?.matter_tagging_ledger_status],
    ["conflict_check_interface", sources.conflictCheckInterface.summary?.conflict_check_interface_status],
    ["store_policy_adapter", sources.storePolicyAdapter.summary?.store_policy_adapter_status],
    ["personal_workspace_boundary", sources.personalWorkspaceBoundary.summary?.personal_workspace_boundary_status],
    ["policy_golden_fixtures", sources.policyGoldenFixtures.summary?.policy_golden_fixture_status],
  ];
  for (const [sourceId, status] of sourceStatusChecks) {
    addValidation(items, `sources.${sourceId}`, "source_ready", ["complete", "valid"].includes(status), `${sourceId} status is ${status ?? "unknown"}.`);
  }
  addValidation(items, "policy_decision_rows", "decision_rows_present", decisionRows.length > 0, `${decisionRows.length} policy decision row(s) projected.`);
  addValidation(items, "policy_violation_rows", "violation_rows_present", violationRows.length > 0, `${violationRows.length} policy violation row(s) projected.`);
  addValidation(items, "policy_pending_approval_rows", "pending_approval_rows_present", pendingApprovalRows.length > 0, `${pendingApprovalRows.length} pending approval row(s) projected.`);
  addValidation(items, "policy_decision_rows.allow", "allow_decisions_present", decisionRows.some((row) => row.decision === "allow"), "At least one allow decision is visible.");
  addValidation(items, "policy_decision_rows.review", "review_decisions_present", decisionRows.some((row) => row.decision === "review"), "At least one review decision is visible.");
  addValidation(items, "policy_decision_rows.deny", "deny_decisions_present", decisionRows.some((row) => row.decision === "deny"), "At least one deny decision is visible.");
  addValidation(items, "policy_pending_approval_rows.control_gate", "pending_approvals_have_control_gates", pendingApprovalRows.every((row) => row.required_gates.length > 0 || row.source_artifact_id === "approval_authority_ledger"), "Pending approvals are tied to at least one human, approval, confirmation, conflict, or protected control gate.");
  addValidation(items, "policy_violation_rows.block", "violations_are_blocking", violationRows.every((row) => row.decision === "deny" || row.gate_status === "blocked"), "Policy violations represent deny or blocked outcomes.");
  return items;
}

function summarizePolicyOperationsSurface(decisionRows, violationRows, pendingApprovalRows, validationItems, validation) {
  return {
    policy_operations_surface_status: validation.valid ? "complete" : "blocked",
    policy_decision_row_count: decisionRows.length,
    allow_decision_count: decisionRows.filter((row) => row.decision === "allow").length,
    review_decision_count: decisionRows.filter((row) => row.decision === "review").length,
    deny_decision_count: decisionRows.filter((row) => row.decision === "deny").length,
    policy_violation_row_count: violationRows.length,
    critical_violation_count: violationRows.filter((row) => row.severity === "critical").length,
    warning_violation_count: violationRows.filter((row) => row.severity === "warning").length,
    policy_pending_approval_row_count: pendingApprovalRows.length,
    assignment_required_approval_count: pendingApprovalRows.filter((row) => row.status === "assignment_required").length,
    human_gate_pending_approval_count: pendingApprovalRows.filter((row) => row.required_gates.length > 0).length,
    distinct_policy_layer_count: new Set(decisionRows.map((row) => row.policy_layer)).size,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_policy_layer: countBy(decisionRows, "policy_layer"),
    by_decision: countBy(decisionRows, "decision"),
    by_violation_type: countBy(violationRows, "violation_type"),
    by_approval_type: countBy(pendingApprovalRows, "approval_type"),
  };
}

function renderPolicyOperationsSurfaceMarkdown(result) {
  const lines = [];
  lines.push("# Policy Operations Surface");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.policy_operations_surface_status}`);
  lines.push("");
  lines.push(`- Decisions: ${result.summary.policy_decision_row_count}`);
  lines.push(`- Allow/review/deny: ${result.summary.allow_decision_count}/${result.summary.review_decision_count}/${result.summary.deny_decision_count}`);
  lines.push(`- Violations: ${result.summary.policy_violation_row_count}`);
  lines.push(`- Pending approvals: ${result.summary.policy_pending_approval_row_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Policy Layers");
  for (const [layer, count] of Object.entries(result.summary.by_policy_layer)) lines.push(`- ${layer}: ${count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function addValidation(items, itemPath, checkId, passed, message) {
  items.push({
    validation_item_id: `policy-operations-surface.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function normalizeDecision(value) {
  if (["allow", "review", "deny"].includes(value)) return value;
  if (["passed", "complete", "valid", "clear", "executable", "external_allowed_with_audit"].includes(value)) return "allow";
  if (["requires_approval", "review_required", "held_for_human_confirmation", "pending_human_confirmation", "assignment_required", "blocked_pending_approval"].includes(value)) return "review";
  if (["blocked", "forbidden", "denied", "view_denied", "deny_cross_workspace"].includes(value)) return "deny";
  if (value === "not_applicable") return "allow";
  return value ?? "review";
}

function controlEffectFor(decision) {
  if (decision === "allow") return "permit";
  if (decision === "deny") return "block";
  return "hold_for_review";
}

function statusForDecision(decision) {
  if (decision === "allow") return "passed";
  if (decision === "deny") return "blocked";
  return "requires_approval";
}

function violationTypeFor(row) {
  if (row.policy_layer === "workspace_boundary") return "cross_workspace_block";
  if (row.policy_layer === "tool_runtime") return "blocked_tool_or_runtime";
  if (row.policy_layer === "store_policy") return "blocked_store_query";
  if (row.policy_layer === "model_policy") return "model_policy_block";
  if (row.policy_layer === "matter_access") return "access_denied";
  return "policy_block";
}

function severityFor(row) {
  if (row.policy_layer === "workspace_boundary" || row.policy_layer === "matter_access") return "critical";
  if (row.protected_action || row.policy_layer === "tool_runtime" || row.policy_layer === "store_policy") return "warning";
  return "info";
}

function remediationFor(row) {
  if (row.pending_approval) return "Route to the required human approval gate before execution.";
  if (row.policy_layer === "workspace_boundary") return "Keep tenant/domain/search namespace filters separated.";
  if (row.policy_layer === "store_policy") return "Rebuild the query with required tenant, matter, classification, policy snapshot, and access audit filters.";
  if (row.policy_layer === "tool_runtime") return "Use an allowed runtime/tool combination or request explicit human approval.";
  return "Review the policy decision and keep the blocked action unexecuted.";
}

function approvalTypeFor(row) {
  if (row.policy_layer === "conflict_check") return "conflict_review";
  if (row.policy_layer === "matter_tagging") return "matter_tagging_confirmation";
  if (row.policy_layer === "output_destination") return "output_destination_approval";
  if (row.policy_layer === "tool_runtime") return "tool_or_protected_action_approval";
  if (row.policy_layer === "model_policy") return "model_transfer_approval";
  return "human_review";
}

function requiredActorFor(row) {
  if (row.policy_layer === "conflict_check") return "conflict_reviewer";
  if (row.policy_layer === "matter_tagging") return "matter_owner";
  if (row.policy_layer === "output_destination") return "responsible_reviewer";
  if (row.policy_layer === "tool_runtime") return "authorized_operator";
  return "human_reviewer";
}

function sourceStatus(artifact, key) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: artifact.summary?.[key] ?? "unknown",
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    generated_at: artifact.generated_at ?? null,
  };
}

function normalizeInputs(options) {
  return {
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.matterAccessPolicyEvaluatorPath),
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.dataClassificationRuleEnginePath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.modelPolicyEnforcementPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.toolRuntimePolicyEnforcementPath),
    output_destination_policy_enforcement_path: path.resolve(options.outputDestinationPolicyEnforcementPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.outputDestinationPolicyEnforcementPath),
    approval_authority_ledger_path: path.resolve(options.approvalAuthorityLedgerPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.approvalAuthorityLedgerPath),
    matter_tagging_decision_ledger_path: path.resolve(options.matterTaggingDecisionLedgerPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.matterTaggingDecisionLedgerPath),
    conflict_check_interface_path: path.resolve(options.conflictCheckInterfacePath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.conflictCheckInterfacePath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.storePolicyAdapterPath),
    personal_workspace_boundary_path: path.resolve(options.personalWorkspaceBoundaryPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.personalWorkspaceBoundaryPath),
    policy_golden_fixtures_path: path.resolve(options.policyGoldenFixturesPath ?? DEFAULT_POLICY_OPERATIONS_SURFACE_INPUTS.policyGoldenFixturesPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--model-policy") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else if (arg === "--approval-authority") parsed.approvalAuthorityLedgerPath = argv[++index];
    else if (arg === "--matter-tagging") parsed.matterTaggingDecisionLedgerPath = argv[++index];
    else if (arg === "--conflict-check") parsed.conflictCheckInterfacePath = argv[++index];
    else if (arg === "--store-policy") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--personal-workspace-boundary") parsed.personalWorkspaceBoundaryPath = argv[++index];
    else if (arg === "--policy-golden-fixtures") parsed.policyGoldenFixturesPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/policy-operations-surface.mjs [options]

Options:
  --matter-access-policy <path>        Matter access policy evaluator artifact.
  --data-classification-rules <path>   Data classification rule engine artifact.
  --model-policy <path>                Model policy enforcement artifact.
  --tool-runtime-policy <path>         Tool/runtime policy enforcement artifact.
  --output-destination-policy <path>   Output destination policy enforcement artifact.
  --approval-authority <path>          Approval authority ledger artifact.
  --matter-tagging <path>              Matter tagging decision ledger artifact.
  --conflict-check <path>              Conflict check interface artifact.
  --store-policy <path>                Store policy adapter artifact.
  --personal-workspace-boundary <path> Personal workspace boundary artifact.
  --policy-golden-fixtures <path>      Policy golden fixtures artifact.
  --out-dir <path>                     Output directory.
  --run-at <iso>                       Fixed generation timestamp.
  --check                              Exit non-zero when validation fails.
  -h, --help                           Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializablePolicyOperationsSurface(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
