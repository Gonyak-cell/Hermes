import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REVIEW_DASHBOARD_OUT_DIR = "artifacts/dashboard/latest";
export const DEFAULT_REVIEW_DASHBOARD_INPUTS = {
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  identityModelPath: "artifacts/identity-model/latest/identity-model.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  matterTaggingDecisionLedgerPath: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  conflictCheckInterfacePath: "artifacts/conflict-check/latest/conflict-check-interface.json",
  personalWorkspaceBoundaryPath: "artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json",
  policyGoldenFixturesPath: "artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json",
  policyOperationsSurfacePath: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
  matterBoundarySlicePath: "artifacts/matter-boundary-slice/latest/matter-boundary-slice.json",
  identityPolicyMatterFreezePath: "artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  lineageGraphBuilderPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  evidenceCoverageScorePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  evidenceContractFreezePath: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  errorCostObservabilityContractFreezePath: "artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json",
  evidenceViewerPath: "artifacts/evidence-viewer/latest/evidence-viewer.json",
  approvalQueuePath: "artifacts/approval-queue/latest/approval-queue.json",
  evidenceReviewDraftPath: "artifacts/evidence-review-draft/latest/evidence-review-draft.json",
  approvalDecisionPath: "artifacts/approval-decisions/latest/approval-decision-result.json",
  approvalInboxPath: "artifacts/approval-inbox/latest/approval-inbox.json",
  approvalInboxDecisionPath: "artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json",
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  policySnapshotLedgerPath: "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json",
  policySnapshotBindingLedgerPath: "artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json",
  contextPacketLedgerPath: "artifacts/context-packets/latest/context-packet-ledger.json",
  modelRoutingLedgerPath: "artifacts/model-routing/latest/model-routing-ledger.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  approvalAuthorityLedgerPath: "artifacts/approval-authority/latest/approval-authority-ledger.json",
  costBudgetLedgerPath: "artifacts/cost-budget/latest/cost-budget-ledger.json",
  tokenUsageLedgerPath: "artifacts/token-usage/latest/token-usage-ledger.json",
  costAttributionLedgerPath: "artifacts/cost-attribution/latest/cost-attribution-ledger.json",
  budgetAlertLedgerPath: "artifacts/budget-alerts/latest/budget-alert-ledger.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  matterCockpitPath: "artifacts/matter-cockpit/latest/matter-cockpit.json",
  deliveryExecutionDraftPath: "artifacts/delivery-execution/latest/delivery-execution-draft.json",
  deliveryReceiptLedgerPath: "artifacts/delivery-receipts/latest/delivery-receipt-ledger.json",
  postDeliveryReconciliationPath: "artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json",
  deliveryCloseoutQueuePath: "artifacts/delivery-closeout/latest/delivery-closeout-queue.json",
  closeoutReceiptValidationPath: "artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json",
  closeoutReceiptApplicationPath: "artifacts/delivery-closeout-application/latest/closeout-receipt-application.json",
  controlPlanePipelinePath: "artifacts/control-plane-pipeline/latest/control-plane-pipeline.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  controlPlaneGoalCheckpointPath: "artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json",
  contractInventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
  contractDependencyMapPath: "artifacts/contract-dependency-map/latest/contract-dependency-map.json",
  schemaVersioningRulesPath: "artifacts/schema-versioning-rules/latest/schema-versioning-rules.json",
  schemaMigrationManifestPath: "artifacts/schema-migration-manifest/latest/schema-migration-manifest-ledger.json",
  contractGoldenFixturesPath: "artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json",
  contractValidationSuitePath: "artifacts/contract-validation-suite/latest/contract-validation-suite.json",
  controlPlaneAuditTrailPath: "artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json",
  controlPlaneHealthPath: "artifacts/control-plane-health/latest/control-plane-health.json",
  controlPlaneActionPlanPath: "artifacts/control-plane-action-plan/latest/control-plane-action-plan.json",
  controlPlaneHumanGatesPath: "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json",
  controlPlaneHumanGateReceiptsPath: "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json",
  humanReviewPacketLedgerPath: "artifacts/human-review-packets/latest/human-review-packet-ledger.json",
  humanReviewAgendaPath: "artifacts/human-review-agenda/latest/human-review-agenda.json",
  humanReviewAgendaReceiptIntakePath: "artifacts/human-review-agenda-receipt-intake/latest/human-review-agenda-receipt-intake.json",
  humanReviewReceiptWorkspacePath: "artifacts/human-review-receipt-workspace/latest/human-review-receipt-workspace.json",
  humanReviewReceiptWorkspaceMergePath: "artifacts/human-review-receipt-workspace-merge/latest/human-review-receipt-workspace-merge.json",
  humanReviewContextBundlePath: "artifacts/human-review-context-bundle/latest/human-review-context-bundle.json",
  humanReviewDecisionRegisterPath: "artifacts/human-review-decision-register/latest/human-review-decision-register.json",
  humanReviewDecisionRegisterMergePath: "artifacts/human-review-decision-register-merge/latest/human-review-decision-register-merge.json",
  humanReviewValidationFeedbackPath: "artifacts/human-review-validation-feedback/latest/human-review-validation-feedback.json",
  humanReviewCorrectionWorkspacePath: "artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json",
  humanReviewCorrectionWorkspaceMergePath: "artifacts/human-review-correction-workspace-merge/latest/human-review-correction-workspace-merge.json",
  humanReviewCorrectionValidationPath: "artifacts/human-review-correction-validation/latest/control-plane-human-gate-receipt-validation.json",
  humanReviewCorrectionFeedbackPath: "artifacts/human-review-correction-feedback/latest/human-review-correction-feedback.json",
  humanReviewCycleLedgerPath: "artifacts/human-review-cycle-ledger/latest/human-review-cycle-ledger.json",
  humanReviewCycleWorkOrdersPath: "artifacts/human-review-cycle-work-orders/latest/human-review-cycle-work-orders.json",
  humanReviewCycleTargetAuditPath: "artifacts/human-review-cycle-work-order-target-audit/latest/human-review-cycle-work-order-target-audit.json",
  humanReviewCycleTriageInboxPath: "artifacts/human-review-cycle-triage-inbox/latest/human-review-cycle-triage-inbox.json",
  humanReviewCycleReviewerConsolePath: "artifacts/human-review-cycle-reviewer-console/latest/human-review-cycle-reviewer-console.json",
  humanReviewCycleReceiptFieldAuditPath: "artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json",
  humanReviewCycleReceiptCompletionPackPath: "artifacts/human-review-cycle-receipt-completion-pack/latest/human-review-cycle-receipt-completion-pack.json",
  humanReviewCycleReceiptCompletionVerificationPath: "artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json",
  humanReviewCycleReceiptCompletionWorkbenchPath: "artifacts/human-review-cycle-receipt-completion-workbench/latest/human-review-cycle-receipt-completion-workbench.json",
  humanReviewCycleReceiptCompletionRunbookPath: "artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json",
  humanReviewCycleReceiptCompletionReadinessPath: "artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json",
  humanReviewCycleReceiptCompletionCommandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
  humanReviewCycleReceiptCompletionCommandReceiptsPath: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json",
  humanReviewCycleReceiptCompletionCommandReceiptValidationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
  humanReviewCycleReceiptCompletionCommandReceiptFeedbackPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest/human-review-cycle-receipt-completion-command-receipt-feedback.json",
  humanReviewCycleReceiptCompletionCommandReceiptWorkspacePath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json",
  humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergePath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/human-review-cycle-receipt-completion-command-receipt-workspace-merge.json",
  humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
  humanReviewCycleReceiptCompletionCommandReceiptApplicationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/human-review-cycle-receipt-completion-command-receipt-application.json",
  humanReviewCycleReceiptCompletionReconciliationPath: "artifacts/human-review-cycle-receipt-completion-reconciliation/latest/human-review-cycle-receipt-completion-reconciliation.json",
  humanReviewCycleReceiptCompletionBaselinePath: "artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json",
  humanReviewCycleReceiptCompletionManualCommandReceiptPackPath: "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json",
  humanReviewCycleReceiptCompletionHeldCommandResolutionPath: "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json",
  humanReviewCycleReceiptCompletionProtectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
  humanReviewCycleReceiptCompletionManualRevalidationPath: "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/human-review-cycle-receipt-completion-manual-revalidation.json",
  humanReviewCycleReceiptCompletionCommandQueuePatchProjectionPath: "artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/human-review-cycle-receipt-completion-command-queue-patch-projection.json",
  humanReviewCycleReceiptCompletionCloseoutLedgerPath: "artifacts/human-review-cycle-receipt-completion-closeout-ledger/latest/human-review-cycle-receipt-completion-closeout-ledger.json",
  humanReviewV1RegressionFreezePath: "artifacts/human-review-v1-regression-freeze/latest/human-review-v1-regression-freeze.json",
  controlPlaneHumanGateReceiptValidationPath: "artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json",
  controlPlaneHumanGateReceiptApplicationPath: "artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json",
  controlPlaneWorkPacketsPath: "artifacts/control-plane-work-packets/latest/control-plane-work-packets.json",
  controlPlaneWorkPacketReceiptsPath: "artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json",
  controlPlaneWorkPacketReceiptValidationPath: "artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json",
  controlPlaneWorkPacketReceiptApplicationPath: "artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json",
  lawFirmLddSummaryPath: "artifacts/law-firm-ldd-slice/latest/summary.json",
  personalDevSummaryPath: "artifacts/personal-dev-slice/latest/summary.json",
  creativeDocumentSummaryPath: "artifacts/creative-document-slice/latest/summary.json",
};

const SOURCE_DEFINITIONS = [
  {
    option: "resourceExpansionPath",
    source_id: "resource_expansion",
    label: "Resource Expansion",
  },
  {
    option: "resourceIngestPath",
    source_id: "resource_ingest",
    label: "Resource Ingest",
  },
  {
    option: "identityModelPath",
    source_id: "identity_model",
    label: "Identity Model",
  },
  {
    option: "resourceContractFreezePath",
    source_id: "resource_contract_freeze",
    label: "Resource Contract Freeze",
  },
  {
    option: "matterContractFreezePath",
    source_id: "matter_contract_freeze",
    label: "Matter Contract Freeze",
  },
  {
    option: "clientCounterpartyRegistryPath",
    source_id: "client_counterparty_registry",
    label: "Client/Counterparty Registry",
  },
  {
    option: "matterProfileTeamLedgerPath",
    source_id: "matter_profile_team_ledger",
    label: "Matter Profile/Team Ledger",
  },
  {
    option: "wallPolicyContractPath",
    source_id: "wall_policy_contract",
    label: "Wall Policy Contract",
  },
  {
    option: "matterAccessPolicyEvaluatorPath",
    source_id: "matter_access_policy_evaluator",
    label: "Matter Access Policy Evaluator",
  },
  {
    option: "policyContractFreezePath",
    source_id: "policy_contract_freeze",
    label: "Policy Contract Freeze",
  },
  {
    option: "dataClassificationRuleEnginePath",
    source_id: "data_classification_rule_engine",
    label: "Data Classification Rule Engine",
  },
  {
    option: "matterTaggingDecisionLedgerPath",
    source_id: "matter_tagging_decision_ledger",
    label: "Matter Tagging Decision Ledger",
  },
  {
    option: "accessAuditProjectionPath",
    source_id: "access_audit_projection",
    label: "Access Audit Projection",
  },
  {
    option: "storePolicyAdapterPath",
    source_id: "store_policy_adapter",
    label: "Store Policy Adapter",
  },
  {
    option: "conflictCheckInterfacePath",
    source_id: "conflict_check_interface",
    label: "Conflict Check Interface",
  },
  {
    option: "personalWorkspaceBoundaryPath",
    source_id: "personal_workspace_boundary",
    label: "Personal Workspace Boundary",
  },
  {
    option: "policyGoldenFixturesPath",
    source_id: "policy_golden_fixtures",
    label: "Policy Golden Fixtures",
  },
  {
    option: "policyOperationsSurfacePath",
    source_id: "policy_operations_surface",
    label: "Policy Operations Surface",
  },
  {
    option: "matterBoundarySlicePath",
    source_id: "matter_boundary_slice",
    label: "Matter Boundary Slice",
  },
  {
    option: "identityPolicyMatterFreezePath",
    source_id: "identity_policy_matter_freeze",
    label: "Identity/Policy/Matter Freeze",
  },
  {
    option: "resourceStoreInterfacePath",
    source_id: "resource_store_interface",
    label: "Resource Store Interface",
  },
  {
    option: "immutableObjectStoreLayoutPath",
    source_id: "immutable_object_store_layout",
    label: "Immutable Object Store Layout",
  },
  {
    option: "resourceVersionLedgerPath",
    source_id: "resource_version_ledger",
    label: "Resource Version Ledger",
  },
  {
    option: "normalizedTextContractPath",
    source_id: "normalized_text_contract",
    label: "Normalized Text Contract",
  },
  {
    option: "extractorAdapterContractPath",
    source_id: "extractor_adapter_contract",
    label: "Extractor Adapter Contract",
  },
  {
    option: "sourceSpanStorePath",
    source_id: "source_span_store",
    label: "Source Span Store",
  },
  {
    option: "evidenceItemStorePath",
    source_id: "evidence_item_store",
    label: "Evidence Item Store",
  },
  {
    option: "factClaimStorePath",
    source_id: "fact_claim_store",
    label: "Fact Claim Store",
  },
  {
    option: "issueGraphStorePath",
    source_id: "issue_graph_store",
    label: "Issue Graph Store",
  },
  {
    option: "citationObjectStorePath",
    source_id: "citation_object_store",
    label: "Citation Object Store",
  },
  {
    option: "lineageGraphBuilderPath",
    source_id: "lineage_graph_builder",
    label: "Lineage Graph Builder",
  },
  {
    option: "evidenceCoverageScorePath",
    source_id: "evidence_coverage_score",
    label: "Evidence Coverage Score",
  },
  {
    option: "evidenceContractFreezePath",
    source_id: "evidence_contract_freeze",
    label: "Evidence Contract Freeze",
  },
  {
    option: "capabilityWorkflowContractFreezePath",
    source_id: "capability_workflow_contract_freeze",
    label: "Capability Workflow Contract Freeze",
  },
  {
    option: "runtimeAgentRunContractFreezePath",
    source_id: "runtime_agentrun_contract_freeze",
    label: "Runtime AgentRun Contract Freeze",
  },
  {
    option: "gateApprovalContractFreezePath",
    source_id: "gate_approval_contract_freeze",
    label: "Gate Approval Contract Freeze",
  },
  {
    option: "outputDeliveryContractFreezePath",
    source_id: "output_delivery_contract_freeze",
    label: "Output Delivery Contract Freeze",
  },
  {
    option: "eventAuditRunContractFreezePath",
    source_id: "event_audit_run_contract_freeze",
    label: "Event Audit Run Contract Freeze",
  },
  {
    option: "errorCostObservabilityContractFreezePath",
    source_id: "error_cost_observability_contract_freeze",
    label: "Error Cost Observability Contract Freeze",
  },
  {
    option: "evidenceViewerPath",
    source_id: "evidence_viewer",
    label: "Evidence Viewer",
  },
  {
    option: "approvalQueuePath",
    source_id: "approval_queue",
    label: "Approval Queue",
  },
  {
    option: "evidenceReviewDraftPath",
    source_id: "evidence_review_draft",
    label: "Evidence Review Draft",
  },
  {
    option: "approvalDecisionPath",
    source_id: "approval_decisions",
    label: "Approval Decisions",
  },
  {
    option: "approvalInboxPath",
    source_id: "approval_inbox",
    label: "Approval Inbox",
  },
  {
    option: "approvalInboxDecisionPath",
    source_id: "approval_inbox_decisions",
    label: "Approval Inbox Decisions",
  },
  {
    option: "policyMatrixCatalogPath",
    source_id: "policy_matrix_catalog",
    label: "Policy Matrix Catalog",
  },
  {
    option: "policySnapshotLedgerPath",
    source_id: "policy_snapshot_ledger",
    label: "Policy Snapshot Ledger",
  },
  {
    option: "policySnapshotBindingLedgerPath",
    source_id: "policy_snapshot_binding_ledger",
    label: "Policy Snapshot Binding Ledger",
  },
  {
    option: "contextPacketLedgerPath",
    source_id: "context_packet_ledger",
    label: "Context Packet Ledger",
  },
  {
    option: "modelRoutingLedgerPath",
    source_id: "model_routing_ledger",
    label: "Model Routing Ledger",
  },
  {
    option: "modelPolicyEnforcementPath",
    source_id: "model_policy_enforcement",
    label: "Model Policy Enforcement",
  },
  {
    option: "toolRuntimePolicyEnforcementPath",
    source_id: "tool_runtime_policy_enforcement",
    label: "Tool/Runtime Policy Enforcement",
  },
  {
    option: "outputDestinationPolicyEnforcementPath",
    source_id: "output_destination_policy_enforcement",
    label: "Output Destination Policy Enforcement",
  },
  {
    option: "approvalAuthorityLedgerPath",
    source_id: "approval_authority_ledger",
    label: "Approval Authority Ledger",
  },
  {
    option: "costBudgetLedgerPath",
    source_id: "cost_budget_ledger",
    label: "Cost Budget Ledger",
  },
  {
    option: "tokenUsageLedgerPath",
    source_id: "token_usage_ledger",
    label: "Token Usage Ledger",
  },
  {
    option: "costAttributionLedgerPath",
    source_id: "cost_attribution_ledger",
    label: "Cost Attribution Ledger",
  },
  {
    option: "budgetAlertLedgerPath",
    source_id: "budget_alert_ledger",
    label: "Budget Alert Ledger",
  },
  {
    option: "domainPackRegistryPath",
    source_id: "domain_pack_registry",
    label: "Domain Pack Registry",
  },
  {
    option: "outputArtifactCatalogPath",
    source_id: "output_artifact_catalog",
    label: "Output Artifact Catalog",
  },
  {
    option: "observabilityCatalogPath",
    source_id: "observability_catalog",
    label: "Observability Catalog",
  },
  {
    option: "protectedDeliveryQueuePath",
    source_id: "protected_delivery_queue",
    label: "Protected Delivery Queue",
  },
  {
    option: "matterCockpitPath",
    source_id: "matter_cockpit",
    label: "Matter Cockpit",
  },
  {
    option: "deliveryExecutionDraftPath",
    source_id: "delivery_execution_draft",
    label: "Delivery Execution Draft",
  },
  {
    option: "deliveryReceiptLedgerPath",
    source_id: "delivery_receipt_ledger",
    label: "Delivery Receipt Ledger",
  },
  {
    option: "postDeliveryReconciliationPath",
    source_id: "post_delivery_reconciliation",
    label: "Post-Delivery Reconciliation",
  },
  {
    option: "deliveryCloseoutQueuePath",
    source_id: "delivery_closeout_queue",
    label: "Delivery Closeout Queue",
  },
  {
    option: "closeoutReceiptValidationPath",
    source_id: "closeout_receipt_validation",
    label: "Closeout Receipt Validation",
  },
  {
    option: "closeoutReceiptApplicationPath",
    source_id: "closeout_receipt_application",
    label: "Closeout Receipt Application",
  },
  {
    option: "controlPlanePipelinePath",
    source_id: "control_plane_pipeline",
    label: "Control Plane Pipeline",
  },
  {
    option: "controlPlaneLoopPath",
    source_id: "control_plane_loop",
    label: "Control Plane Loop",
  },
  {
    option: "controlPlaneGoalCheckpointPath",
    source_id: "control_plane_goal_checkpoint",
    label: "Control Plane Goal Checkpoint",
  },
  {
    option: "contractInventoryPath",
    source_id: "contract_inventory",
    label: "Contract Inventory",
  },
  {
    option: "contractDependencyMapPath",
    source_id: "contract_dependency_map",
    label: "Contract Dependency Map",
  },
  {
    option: "schemaVersioningRulesPath",
    source_id: "schema_versioning_rules",
    label: "Schema Versioning Rules",
  },
  {
    option: "schemaMigrationManifestPath",
    source_id: "schema_migration_manifest",
    label: "Schema Migration Manifest",
  },
  {
    option: "contractGoldenFixturesPath",
    source_id: "contract_golden_fixtures",
    label: "Contract Golden Fixtures",
  },
  {
    option: "contractValidationSuitePath",
    source_id: "contract_validation_suite",
    label: "Contract Validation Suite",
  },
  {
    option: "controlPlaneAuditTrailPath",
    source_id: "control_plane_audit_trail",
    label: "Control Plane Audit Trail",
  },
  {
    option: "controlPlaneHealthPath",
    source_id: "control_plane_health",
    label: "Control Plane Health",
  },
  {
    option: "controlPlaneActionPlanPath",
    source_id: "control_plane_action_plan",
    label: "Control Plane Action Plan",
  },
  {
    option: "controlPlaneHumanGatesPath",
    source_id: "control_plane_human_gates",
    label: "Control Plane Human Gates",
  },
  {
    option: "controlPlaneHumanGateReceiptsPath",
    source_id: "control_plane_human_gate_receipts",
    label: "Control Plane Human Gate Receipts",
  },
  {
    option: "humanReviewPacketLedgerPath",
    source_id: "human_review_packet_ledger",
    label: "Human Review Packet Ledger",
  },
  {
    option: "humanReviewAgendaPath",
    source_id: "human_review_agenda",
    label: "Human Review Agenda",
  },
  {
    option: "humanReviewAgendaReceiptIntakePath",
    source_id: "human_review_agenda_receipt_intake",
    label: "Human Review Agenda Receipt Intake",
  },
  {
    option: "humanReviewReceiptWorkspacePath",
    source_id: "human_review_receipt_workspace",
    label: "Human Review Receipt Workspace",
  },
  {
    option: "humanReviewReceiptWorkspaceMergePath",
    source_id: "human_review_receipt_workspace_merge",
    label: "Human Review Receipt Workspace Merge",
  },
  {
    option: "humanReviewContextBundlePath",
    source_id: "human_review_context_bundle",
    label: "Human Review Context Bundle",
  },
  {
    option: "humanReviewDecisionRegisterPath",
    source_id: "human_review_decision_register",
    label: "Human Review Decision Register",
  },
  {
    option: "humanReviewDecisionRegisterMergePath",
    source_id: "human_review_decision_register_merge",
    label: "Human Review Decision Register Merge",
  },
  {
    option: "humanReviewValidationFeedbackPath",
    source_id: "human_review_validation_feedback",
    label: "Human Review Validation Feedback",
  },
  {
    option: "humanReviewCorrectionWorkspacePath",
    source_id: "human_review_correction_workspace",
    label: "Human Review Correction Workspace",
  },
  {
    option: "humanReviewCorrectionWorkspaceMergePath",
    source_id: "human_review_correction_workspace_merge",
    label: "Human Review Correction Workspace Merge",
  },
  {
    option: "humanReviewCorrectionValidationPath",
    source_id: "human_review_correction_validation",
    label: "Human Review Correction Validation",
  },
  {
    option: "humanReviewCorrectionFeedbackPath",
    source_id: "human_review_correction_feedback",
    label: "Human Review Correction Feedback",
  },
  {
    option: "humanReviewCycleLedgerPath",
    source_id: "human_review_cycle_ledger",
    label: "Human Review Cycle Ledger",
  },
  {
    option: "humanReviewCycleWorkOrdersPath",
    source_id: "human_review_cycle_work_orders",
    label: "Human Review Cycle Work Orders",
  },
  {
    option: "humanReviewCycleTargetAuditPath",
    source_id: "human_review_cycle_target_audit",
    label: "Human Review Cycle Target Audit",
  },
  {
    option: "humanReviewCycleTriageInboxPath",
    source_id: "human_review_cycle_triage_inbox",
    label: "Human Review Cycle Triage Inbox",
  },
  {
    option: "humanReviewCycleReviewerConsolePath",
    source_id: "human_review_cycle_reviewer_console",
    label: "Human Review Cycle Reviewer Console",
  },
  {
    option: "humanReviewCycleReceiptFieldAuditPath",
    source_id: "human_review_cycle_receipt_field_audit",
    label: "Human Review Cycle Receipt Field Audit",
  },
  {
    option: "humanReviewCycleReceiptCompletionPackPath",
    source_id: "human_review_cycle_receipt_completion_pack",
    label: "Human Review Cycle Receipt Completion Pack",
  },
  {
    option: "humanReviewCycleReceiptCompletionVerificationPath",
    source_id: "human_review_cycle_receipt_completion_verification",
    label: "Human Review Cycle Receipt Completion Verification",
  },
  {
    option: "humanReviewCycleReceiptCompletionWorkbenchPath",
    source_id: "human_review_cycle_receipt_completion_workbench",
    label: "Human Review Cycle Receipt Completion Workbench",
  },
  {
    option: "humanReviewCycleReceiptCompletionRunbookPath",
    source_id: "human_review_cycle_receipt_completion_runbook",
    label: "Human Review Cycle Receipt Completion Runbook",
  },
  {
    option: "humanReviewCycleReceiptCompletionReadinessPath",
    source_id: "human_review_cycle_receipt_completion_readiness",
    label: "Human Review Cycle Receipt Completion Readiness",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandQueuePath",
    source_id: "human_review_cycle_receipt_completion_command_queue",
    label: "Human Review Cycle Receipt Completion Command Queue",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptsPath",
    source_id: "human_review_cycle_receipt_completion_command_receipts",
    label: "Human Review Cycle Receipt Completion Command Receipts",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptValidationPath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_validation",
    label: "Human Review Cycle Receipt Completion Command Receipt Validation",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptFeedbackPath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_feedback",
    label: "Human Review Cycle Receipt Completion Command Receipt Feedback",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptWorkspacePath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_workspace",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergePath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_workspace_merge",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace Merge",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationPath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_workspace_validation",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace Validation",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandReceiptApplicationPath",
    source_id: "human_review_cycle_receipt_completion_command_receipt_application",
    label: "Human Review Cycle Receipt Completion Command Receipt Application",
  },
  {
    option: "humanReviewCycleReceiptCompletionReconciliationPath",
    source_id: "human_review_cycle_receipt_completion_reconciliation",
    label: "Human Review Cycle Receipt Completion Reconciliation",
  },
  {
    option: "humanReviewCycleReceiptCompletionBaselinePath",
    source_id: "human_review_cycle_receipt_completion_baseline",
    label: "Human Review Cycle Receipt Completion Baseline",
  },
  {
    option: "humanReviewCycleReceiptCompletionManualCommandReceiptPackPath",
    source_id: "human_review_cycle_receipt_completion_manual_command_receipt_pack",
    label: "Human Review Cycle Receipt Completion Manual Command Receipt Pack",
  },
  {
    option: "humanReviewCycleReceiptCompletionHeldCommandResolutionPath",
    source_id: "human_review_cycle_receipt_completion_held_command_resolution",
    label: "Human Review Cycle Receipt Completion Held Command Resolution",
  },
  {
    option: "humanReviewCycleReceiptCompletionProtectedApprovalRequestPackPath",
    source_id: "human_review_cycle_receipt_completion_protected_approval_request_pack",
    label: "Human Review Cycle Receipt Completion Protected Approval Request Pack",
  },
  {
    option: "humanReviewCycleReceiptCompletionManualRevalidationPath",
    source_id: "human_review_cycle_receipt_completion_manual_revalidation",
    label: "Human Review Cycle Receipt Completion Manual Revalidation",
  },
  {
    option: "humanReviewCycleReceiptCompletionCommandQueuePatchProjectionPath",
    source_id: "human_review_cycle_receipt_completion_command_queue_patch_projection",
    label: "Human Review Cycle Receipt Completion Command Queue Patch Projection",
  },
  {
    option: "humanReviewCycleReceiptCompletionCloseoutLedgerPath",
    source_id: "human_review_cycle_receipt_completion_closeout_ledger",
    label: "Human Review Cycle Receipt Completion Closeout Ledger",
  },
  {
    option: "humanReviewV1RegressionFreezePath",
    source_id: "human_review_v1_regression_freeze",
    label: "Human Review v1 Regression Freeze",
  },
  {
    option: "controlPlaneHumanGateReceiptValidationPath",
    source_id: "control_plane_human_gate_receipt_validation",
    label: "Control Plane Human Gate Receipt Validation",
  },
  {
    option: "controlPlaneHumanGateReceiptApplicationPath",
    source_id: "control_plane_human_gate_receipt_application",
    label: "Control Plane Human Gate Receipt Application",
  },
  {
    option: "controlPlaneWorkPacketsPath",
    source_id: "control_plane_work_packets",
    label: "Control Plane Work Packets",
  },
  {
    option: "controlPlaneWorkPacketReceiptsPath",
    source_id: "control_plane_work_packet_receipts",
    label: "Control Plane Work Packet Receipts",
  },
  {
    option: "controlPlaneWorkPacketReceiptValidationPath",
    source_id: "control_plane_work_packet_receipt_validation",
    label: "Control Plane Work Packet Receipt Validation",
  },
  {
    option: "controlPlaneWorkPacketReceiptApplicationPath",
    source_id: "control_plane_work_packet_receipt_application",
    label: "Control Plane Work Packet Receipt Application",
  },
  {
    option: "lawFirmLddSummaryPath",
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
  },
  {
    option: "personalDevSummaryPath",
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
  },
  {
    option: "creativeDocumentSummaryPath",
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
  },
];

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runReviewDashboard(options = {}) {
  const result = await buildReviewDashboard(options);
  if (options.write !== false) await writeReviewDashboard(result, result.output_dir);
  return result;
}

export async function buildReviewDashboard(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REVIEW_DASHBOARD_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceReadResults = await readDashboardSources(options);
  const artifacts = Object.fromEntries(
    sourceReadResults
      .filter((source) => source.available)
      .map((source) => [source.source_id, source.data]),
  );
  const sources = sourceReadResults.map(({ data, ...source }) => source);
  const stageStatuses = buildStageStatuses(artifacts, sources);
  const actionItems = buildActionItems(artifacts).sort(compareActionItems);
  const summary = buildDashboardSummary(artifacts, stageStatuses, actionItems);
  const result = {
    schema_version: "review-dashboard.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary,
    sources,
    stage_statuses: stageStatuses,
    action_items: actionItems,
  };

  return {
    ...result,
    html: renderReviewDashboardHtml(result),
    markdown: renderReviewDashboardMarkdown(result),
  };
}

export async function writeReviewDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "review-dashboard.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    stage_statuses: result.stage_statuses,
    action_items: result.action_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runReviewDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runReviewDashboard(args);
  console.log(`Review dashboard written to ${result.output_dir}`);
  console.log(`Overall status: ${result.summary.overall_status}`);
  console.log(`Pending approvals: ${result.summary.pending_approval_count}`);
  console.log(`Blocking gates: ${result.summary.blocking_gate_count}`);
  console.log(`Action items: ${result.summary.action_item_count}`);
}

async function readDashboardSources(options) {
  const results = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const configuredPath = options[definition.option] ?? DEFAULT_REVIEW_DASHBOARD_INPUTS[definition.option];
    if (configuredPath === false) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: null,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: "disabled",
      });
      continue;
    }

    const resolvedPath = path.resolve(configuredPath);
    try {
      const data = JSON.parse(await readFile(resolvedPath, "utf8"));
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: true,
        schema_version: data.schema_version ?? null,
        generated_at: data.generated_at ?? null,
        summary: summarizeSource(definition.source_id, data),
        error: null,
        data,
      });
    } catch (error) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: error.code === "ENOENT" ? "not_found" : error.message,
      });
    }
  }
  return results;
}

function summarizeSource(sourceId, data) {
  if (sourceId === "resource_expansion") {
    return {
      discovered_count: data.summary?.discovered_count ?? 0,
      extracted_count: data.summary?.extracted_count ?? 0,
      quarantine_count: data.summary?.quarantine_count ?? 0,
      failed_count: data.summary?.failed_count ?? 0,
      remaining_count: data.summary?.remaining_count ?? data.batch?.remaining_count ?? 0,
    };
  }
  if (sourceId === "resource_ingest") return data.summary ?? {};
  if (sourceId === "identity_model") return data.summary ?? {};
  if (sourceId === "resource_contract_freeze") return data.summary ?? {};
  if (sourceId === "matter_contract_freeze") return data.summary ?? {};
  if (sourceId === "client_counterparty_registry") return data.summary ?? {};
  if (sourceId === "matter_profile_team_ledger") return data.summary ?? {};
  if (sourceId === "wall_policy_contract") return data.summary ?? {};
  if (sourceId === "matter_access_policy_evaluator") return data.summary ?? {};
  if (sourceId === "policy_contract_freeze") return data.summary ?? {};
  if (sourceId === "data_classification_rule_engine") return data.summary ?? {};
  if (sourceId === "matter_tagging_decision_ledger") return data.summary ?? {};
  if (sourceId === "access_audit_projection") return data.summary ?? {};
  if (sourceId === "store_policy_adapter") return data.summary ?? {};
  if (sourceId === "conflict_check_interface") return data.summary ?? {};
  if (sourceId === "personal_workspace_boundary") return data.summary ?? {};
  if (sourceId === "policy_golden_fixtures") return data.summary ?? {};
  if (sourceId === "policy_operations_surface") return data.summary ?? {};
  if (sourceId === "matter_boundary_slice") return data.summary ?? {};
  if (sourceId === "identity_policy_matter_freeze") return data.summary ?? {};
  if (sourceId === "resource_store_interface") return data.summary ?? {};
  if (sourceId === "immutable_object_store_layout") return data.summary ?? {};
  if (sourceId === "resource_version_ledger") return data.summary ?? {};
  if (sourceId === "normalized_text_contract") return data.summary ?? {};
  if (sourceId === "extractor_adapter_contract") return data.summary ?? {};
  if (sourceId === "source_span_store") return data.summary ?? {};
  if (sourceId === "evidence_item_store") return data.summary ?? {};
  if (sourceId === "fact_claim_store") return data.summary ?? {};
  if (sourceId === "issue_graph_store") return data.summary ?? {};
  if (sourceId === "citation_object_store") return data.summary ?? {};
  if (sourceId === "lineage_graph_builder") return data.summary ?? {};
  if (sourceId === "evidence_coverage_score") return data.summary ?? {};
  if (sourceId === "evidence_contract_freeze") return data.summary ?? {};
  if (sourceId === "capability_workflow_contract_freeze") return data.summary ?? {};
  if (sourceId === "runtime_agentrun_contract_freeze") return data.summary ?? {};
  if (sourceId === "gate_approval_contract_freeze") return data.summary ?? {};
  if (sourceId === "output_delivery_contract_freeze") return data.summary ?? {};
  if (sourceId === "event_audit_run_contract_freeze") return data.summary ?? {};
  if (sourceId === "error_cost_observability_contract_freeze") return data.summary ?? {};
  if (sourceId === "evidence_viewer") return data.summary ?? data.review_packet?.summary ?? {};
  if (sourceId === "approval_queue") return data.summary ?? {};
  if (sourceId === "evidence_review_draft") return data.summary ?? {};
  if (sourceId === "approval_decisions") return data.summary ?? {};
  if (sourceId === "approval_inbox") return data.summary ?? {};
  if (sourceId === "approval_inbox_decisions") return data.summary ?? {};
  if (sourceId === "policy_matrix_catalog") return data.summary ?? {};
  if (sourceId === "policy_snapshot_ledger") return data.summary ?? {};
  if (sourceId === "policy_snapshot_binding_ledger") return data.summary ?? {};
  if (sourceId === "context_packet_ledger") return data.summary ?? {};
  if (sourceId === "model_routing_ledger") return data.summary ?? {};
  if (sourceId === "model_policy_enforcement") return data.summary ?? {};
  if (sourceId === "tool_runtime_policy_enforcement") return data.summary ?? {};
  if (sourceId === "output_destination_policy_enforcement") return data.summary ?? {};
  if (sourceId === "approval_authority_ledger") return data.summary ?? {};
  if (sourceId === "cost_budget_ledger") return data.summary ?? {};
  if (sourceId === "token_usage_ledger") return data.summary ?? {};
  if (sourceId === "cost_attribution_ledger") return data.summary ?? {};
  if (sourceId === "budget_alert_ledger") return data.summary ?? {};
  if (sourceId === "domain_pack_registry") {
    return {
      valid: data.validation?.valid ?? false,
      pack_count: data.summary?.pack_count ?? 0,
      enabled_pack_count: data.summary?.enabled_pack_count ?? 0,
      capability_count: data.summary?.capability_count ?? 0,
      invalid_pack_count: data.summary?.invalid_pack_count ?? 0,
      invalid_capability_count: data.summary?.invalid_capability_count ?? 0,
      error_count: data.summary?.error_count ?? data.validation?.errors?.length ?? 0,
    };
  }
  if (sourceId === "output_artifact_catalog") {
    return {
      artifact_count: data.summary?.artifact_count ?? 0,
      approval_pending_count: data.summary?.approval_pending_count ?? 0,
      blocked_delivery_count: data.summary?.blocked_delivery_count ?? 0,
      blocking_gate_count: data.summary?.blocking_gate_count ?? 0,
      by_artifact_type: data.summary?.by_artifact_type ?? {},
      by_delivery_state: data.summary?.by_delivery_state ?? {},
    };
  }
  if (sourceId === "observability_catalog") {
    return {
      workflow_run_count: data.summary?.workflow_run_count ?? 0,
      event_count: data.summary?.event_count ?? 0,
      agent_run_count: data.summary?.agent_run_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocking_gate_count: data.summary?.blocking_gate_count ?? 0,
      total_runtime_seconds: data.summary?.total_runtime_seconds ?? 0,
      error_record_count: data.summary?.error_record_count ?? 0,
      blocked_run_count: data.summary?.blocked_run_count ?? 0,
      by_runtime_id: data.summary?.by_runtime_id ?? {},
      by_run_status: data.summary?.by_run_status ?? {},
    };
  }
  if (sourceId === "protected_delivery_queue") {
    return {
      delivery_action_count: data.summary?.delivery_action_count ?? 0,
      protected_action_count: data.summary?.protected_action_count ?? 0,
      blocked_action_count: data.summary?.blocked_action_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocked_by_gate_count: data.summary?.blocked_by_gate_count ?? 0,
      ready_action_count: data.summary?.ready_action_count ?? 0,
      delivered_action_count: data.summary?.delivered_action_count ?? 0,
      by_delivery_status: data.summary?.by_delivery_status ?? {},
      by_delivery_channel: data.summary?.by_delivery_channel ?? {},
    };
  }
  if (sourceId === "matter_cockpit") {
    return {
      matter_count: data.summary?.matter_count ?? 0,
      blocked_matter_count: data.summary?.blocked_matter_count ?? 0,
      pending_review_matter_count: data.summary?.pending_review_matter_count ?? 0,
      ready_matter_count: data.summary?.ready_matter_count ?? 0,
      resource_count: data.summary?.resource_count ?? 0,
      evidence_count: data.summary?.evidence_count ?? 0,
      output_artifact_count: data.summary?.output_artifact_count ?? 0,
      workflow_run_count: data.summary?.workflow_run_count ?? 0,
      delivery_action_count: data.summary?.delivery_action_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocked_delivery_count: data.summary?.blocked_delivery_count ?? 0,
    };
  }
  if (sourceId === "delivery_execution_draft") return data.summary ?? {};
  if (sourceId === "delivery_receipt_ledger") return data.summary ?? {};
  if (sourceId === "post_delivery_reconciliation") return data.summary ?? {};
  if (sourceId === "delivery_closeout_queue") return data.summary ?? {};
  if (sourceId === "closeout_receipt_validation") return data.summary ?? {};
  if (sourceId === "closeout_receipt_application") return data.summary ?? {};
  if (sourceId === "control_plane_pipeline") return data.summary ?? {};
  if (sourceId === "control_plane_loop") return data.summary ?? {};
  if (sourceId === "control_plane_goal_checkpoint") return data.summary ?? {};
  if (sourceId === "contract_inventory") return data.summary ?? {};
  if (sourceId === "contract_dependency_map") return data.summary ?? {};
  if (sourceId === "schema_versioning_rules") return data.summary ?? {};
  if (sourceId === "schema_migration_manifest") return data.summary ?? {};
  if (sourceId === "contract_golden_fixtures") return data.summary ?? {};
  if (sourceId === "contract_validation_suite") return data.summary ?? {};
  if (sourceId === "control_plane_audit_trail") return data.summary ?? {};
  if (sourceId === "control_plane_health") return data.summary ?? {};
  if (sourceId === "control_plane_action_plan") return data.summary ?? {};
  if (sourceId === "control_plane_human_gates") return data.summary ?? {};
  if (sourceId === "control_plane_human_gate_receipts") return data.summary ?? {};
  if (sourceId === "human_review_packet_ledger") return data.summary ?? {};
  if (sourceId === "human_review_agenda") return data.summary ?? {};
  if (sourceId === "human_review_agenda_receipt_intake") return data.summary ?? {};
  if (sourceId === "human_review_receipt_workspace") return data.summary ?? {};
  if (sourceId === "human_review_receipt_workspace_merge") return data.summary ?? {};
  if (sourceId === "human_review_context_bundle") return data.summary ?? {};
  if (sourceId === "human_review_decision_register") return data.summary ?? {};
  if (sourceId === "human_review_decision_register_merge") return data.summary ?? {};
  if (sourceId === "human_review_validation_feedback") return data.summary ?? {};
  if (sourceId === "human_review_correction_workspace") return data.summary ?? {};
  if (sourceId === "human_review_correction_workspace_merge") return data.summary ?? {};
  if (sourceId === "human_review_correction_validation") return data.summary ?? {};
  if (sourceId === "human_review_correction_feedback") return data.summary ?? {};
  if (sourceId === "human_review_cycle_ledger") return data.summary ?? {};
  if (sourceId === "human_review_cycle_work_orders") return data.summary ?? {};
  if (sourceId === "human_review_cycle_target_audit") return data.summary ?? {};
  if (sourceId === "human_review_cycle_triage_inbox") return data.summary ?? {};
  if (sourceId === "human_review_cycle_reviewer_console") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_field_audit") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_pack") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_verification") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_workbench") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_runbook") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_readiness") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_queue") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipts") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_validation") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_feedback") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_workspace") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_workspace_merge") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_workspace_validation") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_receipt_application") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_reconciliation") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_baseline") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_manual_command_receipt_pack") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_held_command_resolution") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_protected_approval_request_pack") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_manual_revalidation") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_command_queue_patch_projection") return data.summary ?? {};
  if (sourceId === "human_review_cycle_receipt_completion_closeout_ledger") return data.summary ?? {};
  if (sourceId === "human_review_v1_regression_freeze") return data.summary ?? {};
  if (sourceId === "control_plane_human_gate_receipt_validation") return data.summary ?? {};
  if (sourceId === "control_plane_human_gate_receipt_application") return data.summary ?? {};
  if (sourceId === "control_plane_work_packets") return data.summary ?? {};
  if (sourceId === "control_plane_work_packet_receipts") return data.summary ?? {};
  if (sourceId === "control_plane_work_packet_receipt_validation") return data.summary ?? {};
  if (sourceId === "control_plane_work_packet_receipt_application") return data.summary ?? {};
  if (sourceId === "law_firm_ldd_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      workflow_run_id: data.workflow_run_id ?? null,
      approval_id: data.approval_id ?? null,
      issue_count: data.issue_count ?? 0,
      rfi_count: data.rfi_count ?? 0,
      citation_count: data.citation_count ?? 0,
    };
  }
  if (sourceId === "personal_dev_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      actual_isolation: data.actual_isolation ?? null,
      approval_id: data.approval_id ?? null,
    };
  }
  if (sourceId === "creative_document_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      workflow_run_id: data.workflow_run_id ?? null,
      approval_id: data.approval_id ?? null,
      slide_count: data.slide_count ?? 0,
      artifact_count: data.artifact_count ?? 0,
      format_validation_status: data.format_validation_status ?? "unknown",
    };
  }
  return {};
}

function buildStageStatuses(artifacts, sources) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  return [
    buildResourceExpansionStage(artifacts.resource_expansion, sourceById.get("resource_expansion")),
    buildResourceIngestStage(artifacts.resource_ingest, sourceById.get("resource_ingest")),
    buildIdentityModelStage(artifacts.identity_model, sourceById.get("identity_model")),
    buildResourceContractFreezeStage(artifacts.resource_contract_freeze, sourceById.get("resource_contract_freeze")),
    buildMatterContractFreezeStage(artifacts.matter_contract_freeze, sourceById.get("matter_contract_freeze")),
    buildClientCounterpartyRegistryStage(artifacts.client_counterparty_registry, sourceById.get("client_counterparty_registry")),
    buildMatterProfileTeamLedgerStage(artifacts.matter_profile_team_ledger, sourceById.get("matter_profile_team_ledger")),
    buildWallPolicyContractStage(artifacts.wall_policy_contract, sourceById.get("wall_policy_contract")),
    buildMatterAccessPolicyEvaluatorStage(artifacts.matter_access_policy_evaluator, sourceById.get("matter_access_policy_evaluator")),
    buildPolicyContractFreezeStage(artifacts.policy_contract_freeze, sourceById.get("policy_contract_freeze")),
    buildDataClassificationRuleEngineStage(artifacts.data_classification_rule_engine, sourceById.get("data_classification_rule_engine")),
    buildMatterTaggingDecisionLedgerStage(artifacts.matter_tagging_decision_ledger, sourceById.get("matter_tagging_decision_ledger")),
    buildAccessAuditProjectionStage(artifacts.access_audit_projection, sourceById.get("access_audit_projection")),
    buildStorePolicyAdapterStage(artifacts.store_policy_adapter, sourceById.get("store_policy_adapter")),
    buildConflictCheckInterfaceStage(artifacts.conflict_check_interface, sourceById.get("conflict_check_interface")),
    buildPersonalWorkspaceBoundaryStage(artifacts.personal_workspace_boundary, sourceById.get("personal_workspace_boundary")),
    buildPolicyGoldenFixturesStage(artifacts.policy_golden_fixtures, sourceById.get("policy_golden_fixtures")),
    buildPolicyOperationsSurfaceStage(artifacts.policy_operations_surface, sourceById.get("policy_operations_surface")),
    buildMatterBoundarySliceStage(artifacts.matter_boundary_slice, sourceById.get("matter_boundary_slice")),
    buildIdentityPolicyMatterFreezeStage(artifacts.identity_policy_matter_freeze, sourceById.get("identity_policy_matter_freeze")),
    buildResourceStoreInterfaceStage(artifacts.resource_store_interface, sourceById.get("resource_store_interface")),
    buildImmutableObjectStoreLayoutStage(artifacts.immutable_object_store_layout, sourceById.get("immutable_object_store_layout")),
    buildResourceVersionLedgerStage(artifacts.resource_version_ledger, sourceById.get("resource_version_ledger")),
    buildNormalizedTextContractStage(artifacts.normalized_text_contract, sourceById.get("normalized_text_contract")),
    buildExtractorAdapterContractStage(artifacts.extractor_adapter_contract, sourceById.get("extractor_adapter_contract")),
    buildSourceSpanStoreStage(artifacts.source_span_store, sourceById.get("source_span_store")),
    buildEvidenceItemStoreStage(artifacts.evidence_item_store, sourceById.get("evidence_item_store")),
    buildFactClaimStoreStage(artifacts.fact_claim_store, sourceById.get("fact_claim_store")),
    buildIssueGraphStoreStage(artifacts.issue_graph_store, sourceById.get("issue_graph_store")),
    buildCitationObjectStoreStage(artifacts.citation_object_store, sourceById.get("citation_object_store")),
    buildLineageGraphBuilderStage(artifacts.lineage_graph_builder, sourceById.get("lineage_graph_builder")),
    buildEvidenceCoverageScoreStage(artifacts.evidence_coverage_score, sourceById.get("evidence_coverage_score")),
    buildEvidenceContractFreezeStage(artifacts.evidence_contract_freeze, sourceById.get("evidence_contract_freeze")),
    buildCapabilityWorkflowContractFreezeStage(artifacts.capability_workflow_contract_freeze, sourceById.get("capability_workflow_contract_freeze")),
    buildRuntimeAgentRunContractFreezeStage(artifacts.runtime_agentrun_contract_freeze, sourceById.get("runtime_agentrun_contract_freeze")),
    buildGateApprovalContractFreezeStage(artifacts.gate_approval_contract_freeze, sourceById.get("gate_approval_contract_freeze")),
    buildOutputDeliveryContractFreezeStage(artifacts.output_delivery_contract_freeze, sourceById.get("output_delivery_contract_freeze")),
    buildEventAuditRunContractFreezeStage(artifacts.event_audit_run_contract_freeze, sourceById.get("event_audit_run_contract_freeze")),
    buildErrorCostObservabilityContractFreezeStage(artifacts.error_cost_observability_contract_freeze, sourceById.get("error_cost_observability_contract_freeze")),
    buildEvidenceViewerStage(artifacts.evidence_viewer, sourceById.get("evidence_viewer")),
    buildApprovalQueueStage(artifacts.approval_queue, sourceById.get("approval_queue"), artifacts.approval_decisions),
    buildEvidenceReviewDraftStage(artifacts.evidence_review_draft, sourceById.get("evidence_review_draft")),
    buildApprovalDecisionStage(artifacts.approval_decisions, sourceById.get("approval_decisions")),
    buildApprovalInboxStage(artifacts.approval_inbox, sourceById.get("approval_inbox")),
    buildApprovalInboxDecisionStage(artifacts.approval_inbox_decisions, sourceById.get("approval_inbox_decisions")),
    buildPolicyMatrixCatalogStage(artifacts.policy_matrix_catalog, sourceById.get("policy_matrix_catalog")),
    buildPolicySnapshotLedgerStage(artifacts.policy_snapshot_ledger, sourceById.get("policy_snapshot_ledger")),
    buildPolicySnapshotBindingLedgerStage(artifacts.policy_snapshot_binding_ledger, sourceById.get("policy_snapshot_binding_ledger")),
    buildContextPacketLedgerStage(artifacts.context_packet_ledger, sourceById.get("context_packet_ledger")),
    buildModelRoutingLedgerStage(artifacts.model_routing_ledger, sourceById.get("model_routing_ledger")),
    buildModelPolicyEnforcementStage(artifacts.model_policy_enforcement, sourceById.get("model_policy_enforcement")),
    buildToolRuntimePolicyEnforcementStage(artifacts.tool_runtime_policy_enforcement, sourceById.get("tool_runtime_policy_enforcement")),
    buildOutputDestinationPolicyEnforcementStage(artifacts.output_destination_policy_enforcement, sourceById.get("output_destination_policy_enforcement")),
    buildApprovalAuthorityLedgerStage(artifacts.approval_authority_ledger, sourceById.get("approval_authority_ledger")),
    buildCostBudgetLedgerStage(artifacts.cost_budget_ledger, sourceById.get("cost_budget_ledger")),
    buildTokenUsageLedgerStage(artifacts.token_usage_ledger, sourceById.get("token_usage_ledger")),
    buildCostAttributionLedgerStage(artifacts.cost_attribution_ledger, sourceById.get("cost_attribution_ledger")),
    buildBudgetAlertLedgerStage(artifacts.budget_alert_ledger, sourceById.get("budget_alert_ledger")),
    buildDomainPackRegistryStage(artifacts.domain_pack_registry, sourceById.get("domain_pack_registry")),
    buildOutputArtifactCatalogStage(artifacts.output_artifact_catalog, sourceById.get("output_artifact_catalog")),
    buildObservabilityCatalogStage(artifacts.observability_catalog, sourceById.get("observability_catalog")),
    buildProtectedDeliveryQueueStage(artifacts.protected_delivery_queue, sourceById.get("protected_delivery_queue")),
    buildMatterCockpitStage(artifacts.matter_cockpit, sourceById.get("matter_cockpit")),
    buildDeliveryExecutionDraftStage(artifacts.delivery_execution_draft, sourceById.get("delivery_execution_draft")),
    buildDeliveryReceiptLedgerStage(artifacts.delivery_receipt_ledger, sourceById.get("delivery_receipt_ledger")),
    buildPostDeliveryReconciliationStage(artifacts.post_delivery_reconciliation, sourceById.get("post_delivery_reconciliation")),
    buildDeliveryCloseoutQueueStage(artifacts.delivery_closeout_queue, sourceById.get("delivery_closeout_queue")),
    buildCloseoutReceiptValidationStage(artifacts.closeout_receipt_validation, sourceById.get("closeout_receipt_validation")),
    buildCloseoutReceiptApplicationStage(artifacts.closeout_receipt_application, sourceById.get("closeout_receipt_application")),
    buildControlPlanePipelineStage(artifacts.control_plane_pipeline, sourceById.get("control_plane_pipeline")),
    buildControlPlaneLoopStage(artifacts.control_plane_loop, sourceById.get("control_plane_loop")),
    buildControlPlaneGoalCheckpointStage(artifacts.control_plane_goal_checkpoint, sourceById.get("control_plane_goal_checkpoint")),
    buildContractInventoryStage(artifacts.contract_inventory, sourceById.get("contract_inventory")),
    buildContractDependencyMapStage(artifacts.contract_dependency_map, sourceById.get("contract_dependency_map")),
    buildSchemaVersioningRulesStage(artifacts.schema_versioning_rules, sourceById.get("schema_versioning_rules")),
    buildSchemaMigrationManifestStage(artifacts.schema_migration_manifest, sourceById.get("schema_migration_manifest")),
    buildContractGoldenFixturesStage(artifacts.contract_golden_fixtures, sourceById.get("contract_golden_fixtures")),
    buildContractValidationSuiteStage(artifacts.contract_validation_suite, sourceById.get("contract_validation_suite")),
    buildControlPlaneAuditTrailStage(artifacts.control_plane_audit_trail, sourceById.get("control_plane_audit_trail")),
    buildControlPlaneHealthStage(artifacts.control_plane_health, sourceById.get("control_plane_health")),
    buildControlPlaneActionPlanStage(artifacts.control_plane_action_plan, sourceById.get("control_plane_action_plan")),
    buildControlPlaneHumanGatesStage(artifacts.control_plane_human_gates, sourceById.get("control_plane_human_gates")),
    buildControlPlaneHumanGateReceiptsStage(artifacts.control_plane_human_gate_receipts, sourceById.get("control_plane_human_gate_receipts")),
    buildHumanReviewPacketLedgerStage(artifacts.human_review_packet_ledger, sourceById.get("human_review_packet_ledger")),
    buildHumanReviewAgendaStage(artifacts.human_review_agenda, sourceById.get("human_review_agenda")),
    buildHumanReviewAgendaReceiptIntakeStage(artifacts.human_review_agenda_receipt_intake, sourceById.get("human_review_agenda_receipt_intake")),
    buildHumanReviewReceiptWorkspaceStage(artifacts.human_review_receipt_workspace, sourceById.get("human_review_receipt_workspace")),
    buildHumanReviewReceiptWorkspaceMergeStage(artifacts.human_review_receipt_workspace_merge, sourceById.get("human_review_receipt_workspace_merge")),
    buildHumanReviewContextBundleStage(artifacts.human_review_context_bundle, sourceById.get("human_review_context_bundle")),
    buildHumanReviewDecisionRegisterStage(artifacts.human_review_decision_register, sourceById.get("human_review_decision_register")),
    buildHumanReviewDecisionRegisterMergeStage(artifacts.human_review_decision_register_merge, sourceById.get("human_review_decision_register_merge")),
    buildControlPlaneHumanGateReceiptValidationStage(artifacts.control_plane_human_gate_receipt_validation, sourceById.get("control_plane_human_gate_receipt_validation")),
    buildHumanReviewValidationFeedbackStage(artifacts.human_review_validation_feedback, sourceById.get("human_review_validation_feedback")),
    buildHumanReviewCorrectionWorkspaceStage(artifacts.human_review_correction_workspace, sourceById.get("human_review_correction_workspace")),
    buildHumanReviewCorrectionWorkspaceMergeStage(artifacts.human_review_correction_workspace_merge, sourceById.get("human_review_correction_workspace_merge")),
    buildHumanReviewCorrectionValidationStage(artifacts.human_review_correction_validation, sourceById.get("human_review_correction_validation")),
    buildHumanReviewCorrectionFeedbackStage(artifacts.human_review_correction_feedback, sourceById.get("human_review_correction_feedback")),
    buildHumanReviewCycleLedgerStage(artifacts.human_review_cycle_ledger, sourceById.get("human_review_cycle_ledger")),
    buildHumanReviewCycleWorkOrdersStage(artifacts.human_review_cycle_work_orders, sourceById.get("human_review_cycle_work_orders")),
    buildHumanReviewCycleTargetAuditStage(artifacts.human_review_cycle_target_audit, sourceById.get("human_review_cycle_target_audit")),
    buildHumanReviewCycleTriageInboxStage(artifacts.human_review_cycle_triage_inbox, sourceById.get("human_review_cycle_triage_inbox")),
    buildHumanReviewCycleReviewerConsoleStage(artifacts.human_review_cycle_reviewer_console, sourceById.get("human_review_cycle_reviewer_console")),
    buildHumanReviewCycleReceiptFieldAuditStage(artifacts.human_review_cycle_receipt_field_audit, sourceById.get("human_review_cycle_receipt_field_audit")),
    buildHumanReviewCycleReceiptCompletionPackStage(artifacts.human_review_cycle_receipt_completion_pack, sourceById.get("human_review_cycle_receipt_completion_pack")),
    buildHumanReviewCycleReceiptCompletionVerificationStage(artifacts.human_review_cycle_receipt_completion_verification, sourceById.get("human_review_cycle_receipt_completion_verification")),
    buildHumanReviewCycleReceiptCompletionWorkbenchStage(artifacts.human_review_cycle_receipt_completion_workbench, sourceById.get("human_review_cycle_receipt_completion_workbench")),
    buildHumanReviewCycleReceiptCompletionRunbookStage(artifacts.human_review_cycle_receipt_completion_runbook, sourceById.get("human_review_cycle_receipt_completion_runbook")),
    buildHumanReviewCycleReceiptCompletionReadinessStage(artifacts.human_review_cycle_receipt_completion_readiness, sourceById.get("human_review_cycle_receipt_completion_readiness")),
    buildHumanReviewCycleReceiptCompletionCommandQueueStage(artifacts.human_review_cycle_receipt_completion_command_queue, sourceById.get("human_review_cycle_receipt_completion_command_queue")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptsStage(artifacts.human_review_cycle_receipt_completion_command_receipts, sourceById.get("human_review_cycle_receipt_completion_command_receipts")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptValidationStage(artifacts.human_review_cycle_receipt_completion_command_receipt_validation, sourceById.get("human_review_cycle_receipt_completion_command_receipt_validation")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptFeedbackStage(artifacts.human_review_cycle_receipt_completion_command_receipt_feedback, sourceById.get("human_review_cycle_receipt_completion_command_receipt_feedback")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceStage(artifacts.human_review_cycle_receipt_completion_command_receipt_workspace, sourceById.get("human_review_cycle_receipt_completion_command_receipt_workspace")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergeStage(artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge, sourceById.get("human_review_cycle_receipt_completion_command_receipt_workspace_merge")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationStage(artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation, sourceById.get("human_review_cycle_receipt_completion_command_receipt_workspace_validation")),
    buildHumanReviewCycleReceiptCompletionCommandReceiptApplicationStage(artifacts.human_review_cycle_receipt_completion_command_receipt_application, sourceById.get("human_review_cycle_receipt_completion_command_receipt_application")),
    buildHumanReviewCycleReceiptCompletionReconciliationStage(artifacts.human_review_cycle_receipt_completion_reconciliation, sourceById.get("human_review_cycle_receipt_completion_reconciliation")),
    buildHumanReviewCycleReceiptCompletionBaselineStage(artifacts.human_review_cycle_receipt_completion_baseline, sourceById.get("human_review_cycle_receipt_completion_baseline")),
    buildHumanReviewCycleReceiptCompletionManualCommandReceiptPackStage(artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack, sourceById.get("human_review_cycle_receipt_completion_manual_command_receipt_pack")),
    buildHumanReviewCycleReceiptCompletionHeldCommandResolutionStage(artifacts.human_review_cycle_receipt_completion_held_command_resolution, sourceById.get("human_review_cycle_receipt_completion_held_command_resolution")),
    buildHumanReviewCycleReceiptCompletionProtectedApprovalRequestPackStage(artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack, sourceById.get("human_review_cycle_receipt_completion_protected_approval_request_pack")),
    buildHumanReviewCycleReceiptCompletionManualRevalidationStage(artifacts.human_review_cycle_receipt_completion_manual_revalidation, sourceById.get("human_review_cycle_receipt_completion_manual_revalidation")),
    buildHumanReviewCycleReceiptCompletionCommandQueuePatchProjectionStage(artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection, sourceById.get("human_review_cycle_receipt_completion_command_queue_patch_projection")),
    buildHumanReviewCycleReceiptCompletionCloseoutLedgerStage(artifacts.human_review_cycle_receipt_completion_closeout_ledger, sourceById.get("human_review_cycle_receipt_completion_closeout_ledger")),
    buildHumanReviewV1RegressionFreezeStage(artifacts.human_review_v1_regression_freeze, sourceById.get("human_review_v1_regression_freeze")),
    buildControlPlaneHumanGateReceiptApplicationStage(artifacts.control_plane_human_gate_receipt_application, sourceById.get("control_plane_human_gate_receipt_application")),
    buildControlPlaneWorkPacketsStage(artifacts.control_plane_work_packets, sourceById.get("control_plane_work_packets")),
    buildControlPlaneWorkPacketReceiptsStage(artifacts.control_plane_work_packet_receipts, sourceById.get("control_plane_work_packet_receipts")),
    buildControlPlaneWorkPacketReceiptValidationStage(artifacts.control_plane_work_packet_receipt_validation, sourceById.get("control_plane_work_packet_receipt_validation")),
    buildControlPlaneWorkPacketReceiptApplicationStage(artifacts.control_plane_work_packet_receipt_application, sourceById.get("control_plane_work_packet_receipt_application")),
    buildLawFirmLddStage(artifacts.law_firm_ldd_slice, sourceById.get("law_firm_ldd_slice")),
    buildPersonalDevStage(artifacts.personal_dev_slice, sourceById.get("personal_dev_slice")),
    buildCreativeDocumentStage(artifacts.creative_document_slice, sourceById.get("creative_document_slice")),
  ];
}

function buildResourceExpansionStage(expansion, source) {
  if (!expansion) return missingStage("resource_expansion", "Resource Expansion", source);
  const remaining = expansion.summary?.remaining_count ?? expansion.batch?.remaining_count ?? 0;
  const quarantine = expansion.summary?.quarantine_count ?? 0;
  const failed = expansion.summary?.failed_count ?? 0;
  const status = failed > 0 || quarantine > 0 ? "attention" : remaining > 0 ? "pending" : "passed";
  return {
    stage_id: "resource_expansion",
    label: "Resource Expansion",
    status,
    message: status === "passed"
      ? "All discovered resources reached terminal states."
      : `${remaining} remaining, ${quarantine} quarantined, ${failed} failed.`,
    source_path: source?.path ?? null,
    metrics: {
      discovered_count: expansion.summary?.discovered_count ?? 0,
      extracted_count: expansion.summary?.extracted_count ?? 0,
      remaining_count: remaining,
      quarantine_count: quarantine,
      failed_count: failed,
    },
  };
}

function buildResourceIngestStage(ingest, source) {
  if (!ingest) return missingStage("resource_ingest", "Resource Ingest", source);
  const blocked = ingest.summary?.blocked_count ?? 0;
  const status = ingest.summary?.gate_status === "blocked" || blocked > 0 ? "blocked" : "passed";
  return {
    stage_id: "resource_ingest",
    label: "Resource Ingest",
    status,
    message: status === "passed"
      ? "Extracted resources were promoted into Resource/Evidence contracts."
      : `${blocked} blocked item(s) require review before full promotion.`,
    source_path: source?.path ?? null,
    metrics: {
      promoted_resource_count: ingest.summary?.promoted_resource_count ?? 0,
      promoted_evidence_count: ingest.summary?.promoted_evidence_count ?? 0,
      blocked_count: blocked,
      duplicate_count: ingest.summary?.duplicate_count ?? 0,
    },
  };
}

function buildIdentityModelStage(model, source) {
  if (!model) return missingStage("identity_model", "Identity Model", source);
  const summary = model.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || model.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "identity_model",
    label: "Identity Model",
    status,
    message: `${summary.user_count ?? 0} human user(s), ${summary.actor_principal_count ?? 0} actor principal(s), ${summary.role_assignment_count ?? 0} role assignment(s).`,
    source_path: source?.path ?? null,
    metrics: {
      identity_model_status: summary.identity_model_status ?? "unknown",
      tenant_count: summary.tenant_count ?? 0,
      user_count: summary.user_count ?? 0,
      role_count: summary.role_count ?? 0,
      tenant_role_count: summary.tenant_role_count ?? 0,
      matter_role_count: summary.matter_role_count ?? 0,
      system_role_count: summary.system_role_count ?? 0,
      role_assignment_count: summary.role_assignment_count ?? 0,
      human_user_role_assignment_count: summary.human_user_role_assignment_count ?? 0,
      actor_role_assignment_count: summary.actor_role_assignment_count ?? 0,
      actor_principal_count: summary.actor_principal_count ?? 0,
      human_actor_principal_count: summary.human_actor_principal_count ?? 0,
      service_actor_principal_count: summary.service_actor_principal_count ?? 0,
      actor_user_binding_count: summary.actor_user_binding_count ?? 0,
      human_actor_user_binding_count: summary.human_actor_user_binding_count ?? 0,
      system_actor_binding_count: summary.system_actor_binding_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? model.validation?.errors?.length ?? 0,
    },
  };
}

function buildResourceContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("resource_contract_freeze", "Resource Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "resource_contract_freeze",
    label: "Resource Contract Freeze",
    status,
    message: `${summary.resource_count ?? 0} Resource v2 contract(s), ${summary.resource_version_count ?? 0} ResourceVersion v2 fixture(s), ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      resource_schema_version: summary.resource_schema_version ?? null,
      resource_version_schema_version: summary.resource_version_schema_version ?? null,
      resource_count: summary.resource_count ?? 0,
      resource_version_count: summary.resource_version_count ?? 0,
      current_resource_version_count: summary.current_resource_version_count ?? 0,
      content_hash_count: summary.content_hash_count ?? 0,
      source_system_count: summary.source_system_count ?? 0,
      external_id_count: summary.external_id_count ?? 0,
      classification_count: summary.classification_count ?? 0,
      matter_link_count: summary.matter_link_count ?? 0,
      latest_version_link_count: summary.latest_version_link_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildMatterContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("matter_contract_freeze", "Matter Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "matter_contract_freeze",
    label: "Matter Contract Freeze",
    status,
    message: `${summary.matter_count ?? 0} Matter v2 contract(s), ${summary.party_count ?? 0} Party v2 fixture(s), ${summary.matter_boundary_count ?? 0} boundary fixture(s), ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      client_schema_version: summary.client_schema_version ?? null,
      party_schema_version: summary.party_schema_version ?? null,
      matter_schema_version: summary.matter_schema_version ?? null,
      matter_team_schema_version: summary.matter_team_schema_version ?? null,
      matter_boundary_schema_version: summary.matter_boundary_schema_version ?? null,
      client_count: summary.client_count ?? 0,
      party_count: summary.party_count ?? 0,
      client_party_count: summary.client_party_count ?? 0,
      counterparty_count: summary.counterparty_count ?? 0,
      matter_count: summary.matter_count ?? 0,
      matter_team_count: summary.matter_team_count ?? 0,
      matter_boundary_count: summary.matter_boundary_count ?? 0,
      matter_with_client_count: summary.matter_with_client_count ?? 0,
      matter_with_party_count: summary.matter_with_party_count ?? 0,
      matter_with_counterparty_count: summary.matter_with_counterparty_count ?? 0,
      matter_with_team_count: summary.matter_with_team_count ?? 0,
      matter_with_wall_count: summary.matter_with_wall_count ?? 0,
      matter_with_policy_snapshot_count: summary.matter_with_policy_snapshot_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildClientCounterpartyRegistryStage(registry, source) {
  if (!registry) return missingStage("client_counterparty_registry", "Client/Counterparty Registry", source);
  const summary = registry.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || registry.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "client_counterparty_registry",
    label: "Client/Counterparty Registry",
    status,
    message: `${summary.party_count ?? 0} stable part${summary.party_count === 1 ? "y" : "ies"}, ${summary.client_count ?? 0} client(s), ${summary.counterparty_count ?? 0} counterparty row(s), ${summary.conflict_reference_count ?? 0} conflict reference(s).`,
    source_path: source?.path ?? null,
    metrics: {
      registry_status: summary.registry_status ?? "unknown",
      source_matter_contract_status: summary.source_matter_contract_status ?? "unknown",
      party_count: summary.party_count ?? 0,
      client_count: summary.client_count ?? 0,
      counterparty_count: summary.counterparty_count ?? 0,
      stable_party_id_count: summary.stable_party_id_count ?? 0,
      alias_key_count: summary.alias_key_count ?? 0,
      conflict_reference_count: summary.conflict_reference_count ?? 0,
      matter_party_link_count: summary.matter_party_link_count ?? 0,
      matter_with_client_link_count: summary.matter_with_client_link_count ?? 0,
      matter_with_counterparty_link_count: summary.matter_with_counterparty_link_count ?? 0,
      duplicate_alias_count: summary.duplicate_alias_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? registry.validation?.errors?.length ?? 0,
    },
  };
}

function buildMatterProfileTeamLedgerStage(ledger, source) {
  if (!ledger) return missingStage("matter_profile_team_ledger", "Matter Profile/Team Ledger", source);
  const summary = ledger.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || ledger.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "matter_profile_team_ledger",
    label: "Matter Profile/Team Ledger",
    status,
    message: `${summary.matter_profile_count ?? 0} matter profile(s), ${summary.team_membership_count ?? 0} team membership(s), ${summary.allowed_access_subject_count ?? 0} allowed access subject(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: summary.ledger_status ?? "unknown",
      source_matter_contract_status: summary.source_matter_contract_status ?? "unknown",
      source_identity_model_status: summary.source_identity_model_status ?? "unknown",
      source_client_counterparty_registry_status: summary.source_client_counterparty_registry_status ?? "unknown",
      matter_profile_count: summary.matter_profile_count ?? 0,
      matter_team_roster_count: summary.matter_team_roster_count ?? 0,
      team_membership_count: summary.team_membership_count ?? 0,
      active_team_membership_count: summary.active_team_membership_count ?? 0,
      matter_access_subject_count: summary.matter_access_subject_count ?? 0,
      allowed_access_subject_count: summary.allowed_access_subject_count ?? 0,
      denied_access_subject_count: summary.denied_access_subject_count ?? 0,
      matter_with_team_count: summary.matter_with_team_count ?? 0,
      matter_with_responsible_partner_count: summary.matter_with_responsible_partner_count ?? 0,
      team_member_user_count: summary.team_member_user_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0,
    },
  };
}

function buildWallPolicyContractStage(contract, source) {
  if (!contract) return missingStage("wall_policy_contract", "Wall Policy Contract", source);
  const summary = contract.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || contract.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "wall_policy_contract",
    label: "Wall Policy Contract",
    status,
    message: `${summary.wall_policy_rule_count ?? 0} wall rule(s), ${summary.retrieval_wall_filter_count ?? 0} pre-retrieval filter(s), ${summary.conflict_wall_binding_count ?? 0} conflict binding(s).`,
    source_path: source?.path ?? null,
    metrics: {
      wall_policy_status: summary.wall_policy_status ?? "unknown",
      source_matter_contract_status: summary.source_matter_contract_status ?? "unknown",
      source_client_counterparty_registry_status: summary.source_client_counterparty_registry_status ?? "unknown",
      source_matter_profile_team_ledger_status: summary.source_matter_profile_team_ledger_status ?? "unknown",
      wall_policy_rule_count: summary.wall_policy_rule_count ?? 0,
      active_wall_policy_rule_count: summary.active_wall_policy_rule_count ?? 0,
      pre_retrieval_rule_count: summary.pre_retrieval_rule_count ?? 0,
      deny_unless_allowed_rule_count: summary.deny_unless_allowed_rule_count ?? 0,
      retrieval_wall_filter_count: summary.retrieval_wall_filter_count ?? 0,
      complete_retrieval_wall_filter_count: summary.complete_retrieval_wall_filter_count ?? 0,
      wall_subject_binding_count: summary.wall_subject_binding_count ?? 0,
      allowed_wall_subject_binding_count: summary.allowed_wall_subject_binding_count ?? 0,
      denied_wall_subject_binding_count: summary.denied_wall_subject_binding_count ?? 0,
      conflict_wall_binding_count: summary.conflict_wall_binding_count ?? 0,
      ready_conflict_wall_binding_count: summary.ready_conflict_wall_binding_count ?? 0,
      matter_with_wall_policy_count: summary.matter_with_wall_policy_count ?? 0,
      wall_id_count: summary.wall_id_count ?? 0,
      required_filter_key_count: summary.required_filter_key_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? contract.validation?.errors?.length ?? 0,
    },
  };
}

function buildMatterAccessPolicyEvaluatorStage(evaluator, source) {
  if (!evaluator) return missingStage("matter_access_policy_evaluator", "Matter Access Policy Evaluator", source);
  const summary = evaluator.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || evaluator.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "matter_access_policy_evaluator",
    label: "Matter Access Policy Evaluator",
    status,
    message: `${summary.matter_access_decision_count ?? 0} matter decision(s), ${summary.resource_access_decision_count ?? 0} resource decision(s), ${summary.review_decision_count ?? 0} review decision(s).`,
    source_path: source?.path ?? null,
    metrics: {
      access_policy_status: summary.access_policy_status ?? "unknown",
      source_resource_contract_status: summary.source_resource_contract_status ?? "unknown",
      source_runtime_contract_status: summary.source_runtime_contract_status ?? "unknown",
      source_matter_profile_team_ledger_status: summary.source_matter_profile_team_ledger_status ?? "unknown",
      source_wall_policy_contract_status: summary.source_wall_policy_contract_status ?? "unknown",
      access_policy_rule_count: summary.access_policy_rule_count ?? 0,
      matter_access_decision_count: summary.matter_access_decision_count ?? 0,
      resource_access_decision_count: summary.resource_access_decision_count ?? 0,
      runtime_access_matrix_count: summary.runtime_access_matrix_count ?? 0,
      allow_decision_count: summary.allow_decision_count ?? 0,
      review_decision_count: summary.review_decision_count ?? 0,
      deny_decision_count: summary.deny_decision_count ?? 0,
      unassigned_resource_review_count: summary.unassigned_resource_review_count ?? 0,
      external_runtime_decision_count: summary.external_runtime_decision_count ?? 0,
      runtime_count: summary.runtime_count ?? 0,
      resource_count: summary.resource_count ?? 0,
      access_subject_count: summary.access_subject_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? evaluator.validation?.errors?.length ?? 0,
    },
  };
}

function buildPolicyContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("policy_contract_freeze", "Policy Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "policy_contract_freeze",
    label: "Policy Contract Freeze",
    status,
    message: `${summary.classification_count ?? 0} DataClassification v2 contract(s), ${summary.policy_reference_count ?? 0} PolicyReference v2 fixture(s), ${summary.unresolved_policy_reference_count ?? 0} unresolved reference(s).`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      data_classification_schema_version: summary.data_classification_schema_version ?? null,
      policy_reference_schema_version: summary.policy_reference_schema_version ?? null,
      policy_decision_schema_version: summary.policy_decision_schema_version ?? null,
      required_classification_count: summary.required_classification_count ?? 0,
      classification_count: summary.classification_count ?? 0,
      missing_classification_count: summary.missing_classification_count ?? 0,
      extra_classification_count: summary.extra_classification_count ?? 0,
      runtime_rule_link_count: summary.runtime_rule_link_count ?? 0,
      model_rule_link_count: summary.model_rule_link_count ?? 0,
      policy_decision_count: summary.policy_decision_count ?? 0,
      policy_reference_count: summary.policy_reference_count ?? 0,
      resolved_policy_reference_count: summary.resolved_policy_reference_count ?? 0,
      unresolved_policy_reference_count: summary.unresolved_policy_reference_count ?? 0,
      resource_policy_reference_count: summary.resource_policy_reference_count ?? 0,
      matter_policy_reference_count: summary.matter_policy_reference_count ?? 0,
      matter_boundary_policy_reference_count: summary.matter_boundary_policy_reference_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildDataClassificationRuleEngineStage(engine, source) {
  if (!engine) return missingStage("data_classification_rule_engine", "Data Classification Rule Engine", source);
  const summary = engine.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || engine.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "data_classification_rule_engine",
    label: "Data Classification Rule Engine",
    status,
    message: `${summary.classification_rule_count ?? 0} classification rule(s), ${summary.resource_classification_decision_count ?? 0} resource decision(s), ${summary.policy_bound_resource_count ?? 0} policy-bound resource(s).`,
    source_path: source?.path ?? null,
    metrics: {
      classification_rule_engine_status: summary.classification_rule_engine_status ?? "unknown",
      source_resource_contract_status: summary.source_resource_contract_status ?? "unknown",
      source_policy_contract_status: summary.source_policy_contract_status ?? "unknown",
      source_matter_access_policy_status: summary.source_matter_access_policy_status ?? "unknown",
      classification_rule_count: summary.classification_rule_count ?? 0,
      resource_classification_decision_count: summary.resource_classification_decision_count ?? 0,
      classification_policy_binding_count: summary.classification_policy_binding_count ?? 0,
      resource_count: summary.resource_count ?? 0,
      policy_bound_resource_count: summary.policy_bound_resource_count ?? 0,
      unbound_resource_count: summary.unbound_resource_count ?? 0,
      allow_decision_count: summary.allow_decision_count ?? 0,
      review_decision_count: summary.review_decision_count ?? 0,
      deny_decision_count: summary.deny_decision_count ?? 0,
      external_model_allow_count: summary.external_model_allow_count ?? 0,
      external_model_review_count: summary.external_model_review_count ?? 0,
      external_model_deny_count: summary.external_model_deny_count ?? 0,
      redaction_required_resource_count: summary.redaction_required_resource_count ?? 0,
      human_review_required_resource_count: summary.human_review_required_resource_count ?? 0,
      matter_tagging_review_count: summary.matter_tagging_review_count ?? 0,
      matter_access_link_count: summary.matter_access_link_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? engine.validation?.errors?.length ?? 0,
    },
  };
}

function buildMatterTaggingDecisionLedgerStage(ledger, source) {
  if (!ledger) return missingStage("matter_tagging_decision_ledger", "Matter Tagging Decision Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const status = summary.matter_tagging_ledger_status === "complete"
    && errorCount === 0
    && (summary.no_candidate_count ?? 0) === 0
    && (summary.auto_applied_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "matter_tagging_decision_ledger",
    label: "Matter Tagging Decision Ledger",
    status,
    message: `${summary.matter_tagging_decision_count ?? 0} tagging decision(s), ${summary.automatic_candidate_count ?? 0} automatic candidate(s), ${summary.pending_human_confirmation_count ?? 0} pending human confirmation(s).`,
    source_path: source?.path ?? null,
    metrics: {
      matter_tagging_ledger_status: summary.matter_tagging_ledger_status ?? "unknown",
      source_resource_contract_status: summary.source_resource_contract_status ?? "unknown",
      source_matter_profile_team_ledger_status: summary.source_matter_profile_team_ledger_status ?? "unknown",
      source_matter_access_policy_status: summary.source_matter_access_policy_status ?? "unknown",
      source_data_classification_rule_engine_status: summary.source_data_classification_rule_engine_status ?? "unknown",
      resource_count: summary.resource_count ?? 0,
      matter_profile_count: summary.matter_profile_count ?? 0,
      resource_access_decision_count: summary.resource_access_decision_count ?? 0,
      resource_classification_decision_count: summary.resource_classification_decision_count ?? 0,
      matter_tagging_decision_count: summary.matter_tagging_decision_count ?? 0,
      automatic_candidate_count: summary.automatic_candidate_count ?? 0,
      pending_human_confirmation_count: summary.pending_human_confirmation_count ?? 0,
      human_confirmation_request_count: summary.human_confirmation_request_count ?? 0,
      correction_history_count: summary.correction_history_count ?? 0,
      applied_correction_count: summary.applied_correction_count ?? 0,
      pending_correction_count: summary.pending_correction_count ?? 0,
      auto_applied_count: summary.auto_applied_count ?? 0,
      no_candidate_count: summary.no_candidate_count ?? 0,
      tenant_boundary_mismatch_count: summary.tenant_boundary_mismatch_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildAccessAuditProjectionStage(projection, source) {
  if (!projection) return missingStage("access_audit_projection", "Access Audit Projection", source);
  const summary = projection.summary ?? {};
  const errorCount = summary.validation_error_count ?? projection.validation?.errors?.length ?? 0;
  const status = summary.access_audit_projection_status === "complete"
    && errorCount === 0
    && (summary.access_audit_record_count ?? 0) > 0
    && (summary.matter_tagging_unresolved_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "access_audit_projection",
    label: "Access Audit Projection",
    status,
    message: `${summary.access_audit_record_count ?? 0} audit record(s), ${summary.actor_access_rollup_count ?? 0} actor rollup(s), ${summary.resource_access_rollup_count ?? 0} resource rollup(s).`,
    source_path: source?.path ?? null,
    metrics: {
      access_audit_projection_status: summary.access_audit_projection_status ?? "unknown",
      source_matter_access_policy_status: summary.source_matter_access_policy_status ?? "unknown",
      source_matter_tagging_ledger_status: summary.source_matter_tagging_ledger_status ?? "unknown",
      matter_access_decision_count: summary.matter_access_decision_count ?? 0,
      resource_access_decision_count: summary.resource_access_decision_count ?? 0,
      access_audit_record_count: summary.access_audit_record_count ?? 0,
      matter_audit_record_count: summary.matter_audit_record_count ?? 0,
      resource_audit_record_count: summary.resource_audit_record_count ?? 0,
      actor_access_rollup_count: summary.actor_access_rollup_count ?? 0,
      resource_access_rollup_count: summary.resource_access_rollup_count ?? 0,
      view_allowed_count: summary.view_allowed_count ?? 0,
      view_requires_human_confirmation_count: summary.view_requires_human_confirmation_count ?? 0,
      view_denied_count: summary.view_denied_count ?? 0,
      can_retrieve_count: summary.can_retrieve_count ?? 0,
      human_review_required_count: summary.human_review_required_count ?? 0,
      external_runtime_record_count: summary.external_runtime_record_count ?? 0,
      matter_tagging_linked_count: summary.matter_tagging_linked_count ?? 0,
      matter_tagging_unresolved_count: summary.matter_tagging_unresolved_count ?? 0,
      distinct_user_count: summary.distinct_user_count ?? 0,
      distinct_runtime_count: summary.distinct_runtime_count ?? 0,
      distinct_matter_count: summary.distinct_matter_count ?? 0,
      distinct_resource_count: summary.distinct_resource_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildStorePolicyAdapterStage(adapter, source) {
  if (!adapter) return missingStage("store_policy_adapter", "Store Policy Adapter", source);
  const summary = adapter.summary ?? {};
  const errorCount = summary.validation_error_count ?? adapter.validation?.errors?.length ?? 0;
  const planCount = summary.store_query_plan_count ?? 0;
  const status = summary.store_policy_adapter_status === "complete"
    && errorCount === 0
    && planCount > 0
    && (summary.rls_enforced_query_plan_count ?? 0) === planCount
    && (summary.matter_filter_enforced_count ?? 0) === planCount
    && (summary.classification_filter_enforced_count ?? 0) === planCount
    && (summary.unfiltered_probe_blocked_count ?? 0) === planCount
    ? "passed"
    : "attention";
  return {
    stage_id: "store_policy_adapter",
    label: "Store Policy Adapter",
    status,
    message: `${planCount} store query plan(s), ${summary.enforcement_probe_count ?? 0} enforcement probe(s), ${summary.unfiltered_probe_blocked_count ?? 0} unfiltered probe(s) blocked.`,
    source_path: source?.path ?? null,
    metrics: {
      store_policy_adapter_status: summary.store_policy_adapter_status ?? "unknown",
      source_access_audit_projection_status: summary.source_access_audit_projection_status ?? "unknown",
      source_data_classification_rule_engine_status: summary.source_data_classification_rule_engine_status ?? "unknown",
      access_audit_record_count: summary.access_audit_record_count ?? 0,
      resource_classification_decision_count: summary.resource_classification_decision_count ?? 0,
      store_policy_rule_count: summary.store_policy_rule_count ?? 0,
      rls_filter_template_count: summary.rls_filter_template_count ?? 0,
      query_policy_binding_count: summary.query_policy_binding_count ?? 0,
      store_query_plan_count: planCount,
      enforcement_probe_count: summary.enforcement_probe_count ?? 0,
      rls_enforced_query_plan_count: summary.rls_enforced_query_plan_count ?? 0,
      matter_filter_enforced_count: summary.matter_filter_enforced_count ?? 0,
      classification_filter_enforced_count: summary.classification_filter_enforced_count ?? 0,
      policy_snapshot_filter_enforced_count: summary.policy_snapshot_filter_enforced_count ?? 0,
      access_audit_filter_enforced_count: summary.access_audit_filter_enforced_count ?? 0,
      resource_filter_enforced_count: summary.resource_filter_enforced_count ?? 0,
      executable_query_plan_count: summary.executable_query_plan_count ?? 0,
      held_query_plan_count: summary.held_query_plan_count ?? 0,
      blocked_query_plan_count: summary.blocked_query_plan_count ?? 0,
      unfiltered_probe_blocked_count: summary.unfiltered_probe_blocked_count ?? 0,
      cross_matter_probe_blocked_count: summary.cross_matter_probe_blocked_count ?? 0,
      missing_matter_filter_probe_blocked_count: summary.missing_matter_filter_probe_blocked_count ?? 0,
      missing_classification_filter_probe_blocked_count: summary.missing_classification_filter_probe_blocked_count ?? 0,
      missing_policy_snapshot_filter_probe_blocked_count: summary.missing_policy_snapshot_filter_probe_blocked_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildConflictCheckInterfaceStage(conflictCheckInterface, source) {
  if (!conflictCheckInterface) return missingStage("conflict_check_interface", "Conflict Check Interface", source);
  const summary = conflictCheckInterface.summary ?? {};
  const errorCount = summary.validation_error_count ?? conflictCheckInterface.validation?.errors?.length ?? 0;
  const requestCount = summary.conflict_check_request_count ?? 0;
  const resultCount = summary.conflict_check_result_count ?? 0;
  const signalCount = summary.conflict_signal_count ?? 0;
  const status = summary.conflict_check_interface_status === "complete"
    && errorCount === 0
    && requestCount > 0
    && resultCount === requestCount
    && signalCount >= requestCount
    && (summary.missing_conflict_reference_count ?? 0) === 0
    && (summary.review_required_result_count ?? 0) > 0
    ? "passed"
    : "attention";
  return {
    stage_id: "conflict_check_interface",
    label: "Conflict Check Interface",
    status,
    message: `${requestCount} conflict check request(s), ${resultCount} result(s), ${signalCount} signal(s), ${summary.review_required_result_count ?? 0} review-held result(s).`,
    source_path: source?.path ?? null,
    metrics: {
      conflict_check_interface_status: summary.conflict_check_interface_status ?? "unknown",
      source_client_counterparty_registry_status: summary.source_client_counterparty_registry_status ?? "unknown",
      source_matter_profile_team_ledger_status: summary.source_matter_profile_team_ledger_status ?? "unknown",
      source_wall_policy_contract_status: summary.source_wall_policy_contract_status ?? "unknown",
      source_store_policy_adapter_status: summary.source_store_policy_adapter_status ?? "unknown",
      matter_profile_count: summary.matter_profile_count ?? 0,
      protected_resource_count: summary.protected_resource_count ?? 0,
      conflict_reference_count: summary.conflict_reference_count ?? 0,
      conflict_wall_binding_count: summary.conflict_wall_binding_count ?? 0,
      store_query_plan_count: summary.store_query_plan_count ?? 0,
      conflict_check_request_count: requestCount,
      matter_intake_request_count: summary.matter_intake_request_count ?? 0,
      resource_access_request_count: summary.resource_access_request_count ?? 0,
      conflict_check_result_count: resultCount,
      clear_result_count: summary.clear_result_count ?? 0,
      review_required_result_count: summary.review_required_result_count ?? 0,
      blocked_result_count: summary.blocked_result_count ?? 0,
      conflict_signal_count: signalCount,
      clear_signal_count: summary.clear_signal_count ?? 0,
      review_signal_count: summary.review_signal_count ?? 0,
      block_signal_count: summary.block_signal_count ?? 0,
      client_signal_count: summary.client_signal_count ?? 0,
      counterparty_signal_count: summary.counterparty_signal_count ?? 0,
      store_plan_linked_request_count: summary.store_plan_linked_request_count ?? 0,
      missing_conflict_reference_count: summary.missing_conflict_reference_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildPersonalWorkspaceBoundaryStage(boundary, source) {
  if (!boundary) return missingStage("personal_workspace_boundary", "Personal Workspace Boundary", source);
  const summary = boundary.summary ?? {};
  const errorCount = summary.validation_error_count ?? boundary.validation?.errors?.length ?? 0;
  const workspaceCount = summary.workspace_boundary_count ?? 0;
  const namespaceCount = summary.search_namespace_policy_count ?? 0;
  const probeCount = summary.cross_workspace_probe_count ?? 0;
  const blockedProbeCount = summary.blocked_cross_workspace_probe_count ?? 0;
  const status = summary.personal_workspace_boundary_status === "complete"
    && errorCount === 0
    && workspaceCount >= 2
    && (summary.law_firm_boundary_count ?? 0) > 0
    && (summary.personal_workspace_boundary_count ?? 0) > 0
    && namespaceCount >= 2
    && probeCount > 0
    && blockedProbeCount === probeCount
    && (summary.allowed_cross_workspace_probe_count ?? 0) === 0
    && (summary.mixed_search_namespace_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "personal_workspace_boundary",
    label: "Personal Workspace Boundary",
    status,
    message: `${workspaceCount} workspace boundary(ies), ${namespaceCount} search namespace(s), ${blockedProbeCount}/${probeCount} cross-workspace probe(s) blocked.`,
    source_path: source?.path ?? null,
    metrics: {
      personal_workspace_boundary_status: summary.personal_workspace_boundary_status ?? "unknown",
      workspace_boundary_count: workspaceCount,
      law_firm_boundary_count: summary.law_firm_boundary_count ?? 0,
      personal_workspace_boundary_count: summary.personal_workspace_boundary_count ?? 0,
      tenant_policy_boundary_count: summary.tenant_policy_boundary_count ?? 0,
      search_namespace_policy_count: namespaceCount,
      cross_workspace_probe_count: probeCount,
      blocked_cross_workspace_probe_count: blockedProbeCount,
      allowed_cross_workspace_probe_count: summary.allowed_cross_workspace_probe_count ?? 0,
      mixed_search_namespace_count: summary.mixed_search_namespace_count ?? 0,
      law_firm_tenant_id: summary.law_firm_tenant_id ?? null,
      personal_tenant_id: summary.personal_tenant_id ?? null,
      law_firm_matter_count: summary.law_firm_matter_count ?? 0,
      personal_matter_count: summary.personal_matter_count ?? 0,
      law_firm_resource_count: summary.law_firm_resource_count ?? 0,
      personal_resource_count: summary.personal_resource_count ?? 0,
      law_firm_policy_snapshot_count: summary.law_firm_policy_snapshot_count ?? 0,
      personal_policy_snapshot_count: summary.personal_policy_snapshot_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildPolicyGoldenFixturesStage(fixtures, source) {
  if (!fixtures) return missingStage("policy_golden_fixtures", "Policy Golden Fixtures", source);
  const summary = fixtures.summary ?? {};
  const errorCount = summary.validation_error_count ?? fixtures.validation?.errors?.length ?? 0;
  const caseCount = summary.policy_fixture_case_count ?? 0;
  const lockedCaseCount = summary.locked_case_count ?? 0;
  const status = summary.policy_golden_fixture_status === "complete"
    && errorCount === 0
    && caseCount > 0
    && lockedCaseCount === caseCount
    && (summary.allow_case_count ?? 0) > 0
    && (summary.review_case_count ?? 0) > 0
    && (summary.deny_case_count ?? 0) > 0
    && (summary.review_case_with_human_gate_count ?? 0) === (summary.review_case_count ?? -1)
    && (summary.deny_case_blocked_count ?? 0) === (summary.deny_case_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "policy_golden_fixtures",
    label: "Policy Golden Fixtures",
    status,
    message: `${caseCount} policy fixture case(s), allow/review/deny ${summary.allow_case_count ?? 0}/${summary.review_case_count ?? 0}/${summary.deny_case_count ?? 0}, ${summary.locked_regression_hash_count ?? 0} regression hash(es).`,
    source_path: source?.path ?? null,
    metrics: {
      policy_golden_fixture_status: summary.policy_golden_fixture_status ?? "unknown",
      policy_fixture_case_count: caseCount,
      fixture_group_count: summary.fixture_group_count ?? 0,
      allow_case_count: summary.allow_case_count ?? 0,
      review_case_count: summary.review_case_count ?? 0,
      deny_case_count: summary.deny_case_count ?? 0,
      locked_case_count: lockedCaseCount,
      mismatch_case_count: summary.mismatch_case_count ?? 0,
      missing_case_count: summary.missing_case_count ?? 0,
      locked_regression_hash_count: summary.locked_regression_hash_count ?? 0,
      review_case_with_human_gate_count: summary.review_case_with_human_gate_count ?? 0,
      deny_case_blocked_count: summary.deny_case_blocked_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildPolicyOperationsSurfaceStage(surface, source) {
  if (!surface) return missingStage("policy_operations_surface", "Policy Operations Surface", source);
  const summary = surface.summary ?? {};
  const errorCount = summary.validation_error_count ?? surface.validation?.errors?.length ?? 0;
  const decisionCount = summary.policy_decision_row_count ?? 0;
  const violationCount = summary.policy_violation_row_count ?? 0;
  const pendingApprovalCount = summary.policy_pending_approval_row_count ?? 0;
  const status = summary.policy_operations_surface_status === "complete"
    && errorCount === 0
    && decisionCount > 0
    && violationCount > 0
    && pendingApprovalCount > 0
    && (summary.allow_decision_count ?? 0) > 0
    && (summary.review_decision_count ?? 0) > 0
    && (summary.deny_decision_count ?? 0) > 0
    ? "passed"
    : "attention";
  return {
    stage_id: "policy_operations_surface",
    label: "Policy Operations Surface",
    status,
    message: `${decisionCount} decision row(s), ${violationCount} violation row(s), ${pendingApprovalCount} pending approval row(s).`,
    source_path: source?.path ?? null,
    metrics: {
      policy_operations_surface_status: summary.policy_operations_surface_status ?? "unknown",
      policy_decision_row_count: decisionCount,
      allow_decision_count: summary.allow_decision_count ?? 0,
      review_decision_count: summary.review_decision_count ?? 0,
      deny_decision_count: summary.deny_decision_count ?? 0,
      policy_violation_row_count: violationCount,
      critical_violation_count: summary.critical_violation_count ?? 0,
      warning_violation_count: summary.warning_violation_count ?? 0,
      policy_pending_approval_row_count: pendingApprovalCount,
      assignment_required_approval_count: summary.assignment_required_approval_count ?? 0,
      human_gate_pending_approval_count: summary.human_gate_pending_approval_count ?? 0,
      distinct_policy_layer_count: summary.distinct_policy_layer_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildMatterBoundarySliceStage(slice, source) {
  if (!slice) return missingStage("matter_boundary_slice", "Matter Boundary Slice", source);
  const summary = slice.summary ?? {};
  const pathCount = summary.resource_boundary_path_count ?? 0;
  const gateCount = summary.retrieval_gate_check_count ?? 0;
  const errorCount = summary.validation_error_count ?? slice.validation?.errors?.length ?? 0;
  const status = summary.matter_boundary_slice_status === "complete"
    && errorCount === 0
    && pathCount > 0
    && gateCount > 0
    && (summary.promoted_resource_path_count ?? 0) === pathCount
    && (summary.access_decision_covered_resource_count ?? 0) === pathCount
    && (summary.access_audited_resource_count ?? 0) === pathCount
    && (summary.store_compiled_resource_count ?? 0) === pathCount
    && (summary.required_store_filter_resource_count ?? 0) === pathCount
    && (summary.negative_probe_blocked_resource_count ?? 0) === pathCount
    && (summary.policy_surface_visible_resource_count ?? 0) === pathCount
    && (summary.passed_retrieval_gate_check_count ?? 0) === gateCount
    && (summary.failed_retrieval_gate_check_count ?? 0) === 0
    && (summary.unassigned_executable_query_plan_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "matter_boundary_slice",
    label: "Matter Boundary Slice",
    status,
    message: `${pathCount} resource boundary path(s), ${gateCount} retrieval gate check(s), ${summary.held_for_matter_tagging_resource_count ?? 0} held for matter tagging.`,
    source_path: source?.path ?? null,
    metrics: {
      matter_boundary_slice_status: summary.matter_boundary_slice_status ?? "unknown",
      resource_boundary_path_count: pathCount,
      retrieval_gate_check_count: gateCount,
      promoted_resource_path_count: summary.promoted_resource_path_count ?? 0,
      access_decision_covered_resource_count: summary.access_decision_covered_resource_count ?? 0,
      access_audited_resource_count: summary.access_audited_resource_count ?? 0,
      store_compiled_resource_count: summary.store_compiled_resource_count ?? 0,
      required_store_filter_resource_count: summary.required_store_filter_resource_count ?? 0,
      negative_probe_blocked_resource_count: summary.negative_probe_blocked_resource_count ?? 0,
      policy_surface_visible_resource_count: summary.policy_surface_visible_resource_count ?? 0,
      unassigned_resource_count: summary.unassigned_resource_count ?? 0,
      unassigned_executable_query_plan_count: summary.unassigned_executable_query_plan_count ?? 0,
      held_for_matter_tagging_resource_count: summary.held_for_matter_tagging_resource_count ?? 0,
      retrieval_ready_resource_count: summary.retrieval_ready_resource_count ?? 0,
      blocked_resource_count: summary.blocked_resource_count ?? 0,
      executable_query_plan_count: summary.executable_query_plan_count ?? 0,
      held_query_plan_count: summary.held_query_plan_count ?? 0,
      blocked_query_plan_count: summary.blocked_query_plan_count ?? 0,
      passed_retrieval_gate_check_count: summary.passed_retrieval_gate_check_count ?? 0,
      failed_retrieval_gate_check_count: summary.failed_retrieval_gate_check_count ?? 0,
      negative_probe_expected_count: summary.negative_probe_expected_count ?? 0,
      negative_probe_blocked_count: summary.negative_probe_blocked_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildIdentityPolicyMatterFreezeStage(freeze, source) {
  if (!freeze) return missingStage("identity_policy_matter_freeze", "Identity/Policy/Matter Freeze", source);
  const summary = freeze.summary ?? {};
  const sourceCount = summary.required_source_count ?? 0;
  const checkpointCount = summary.freeze_checkpoint_count ?? 0;
  const errorCount = summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0;
  const status = summary.freeze_status !== "blocked"
    && errorCount === 0
    && sourceCount > 0
    && (summary.available_required_source_count ?? 0) === sourceCount
    && (summary.clean_source_count ?? 0) === sourceCount
    && checkpointCount > 0
    && (summary.passed_freeze_checkpoint_count ?? 0) === checkpointCount
    && (summary.failed_freeze_checkpoint_count ?? 0) === 0
    && (summary.policy_fixture_case_count ?? 0) > 0
    && (summary.locked_policy_fixture_count ?? 0) === (summary.policy_fixture_case_count ?? -1)
    && (summary.policy_decision_row_count ?? 0) > 0
    && (summary.resource_boundary_path_count ?? 0) > 0
    && (summary.retrieval_gate_check_count ?? 0) > 0
    && (summary.unassigned_executable_query_plan_count ?? 0) === 0
    && (summary.blocked_cross_workspace_probe_count ?? 0) === (summary.cross_workspace_probe_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "identity_policy_matter_freeze",
    label: "Identity/Policy/Matter Freeze",
    status,
    message: `${sourceCount} source artifact(s), ${checkpointCount} freeze checkpoint(s), status ${summary.freeze_status ?? "unknown"}.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      required_source_count: sourceCount,
      available_required_source_count: summary.available_required_source_count ?? 0,
      clean_source_count: summary.clean_source_count ?? 0,
      frozen_slot_count: summary.frozen_slot_count ?? 0,
      freeze_checkpoint_count: checkpointCount,
      passed_freeze_checkpoint_count: summary.passed_freeze_checkpoint_count ?? 0,
      failed_freeze_checkpoint_count: summary.failed_freeze_checkpoint_count ?? 0,
      policy_fixture_case_count: summary.policy_fixture_case_count ?? 0,
      locked_policy_fixture_count: summary.locked_policy_fixture_count ?? 0,
      policy_regression_hash_count: summary.policy_regression_hash_count ?? 0,
      policy_decision_row_count: summary.policy_decision_row_count ?? 0,
      policy_violation_row_count: summary.policy_violation_row_count ?? 0,
      policy_pending_approval_row_count: summary.policy_pending_approval_row_count ?? 0,
      resource_boundary_path_count: summary.resource_boundary_path_count ?? 0,
      retrieval_gate_check_count: summary.retrieval_gate_check_count ?? 0,
      unassigned_executable_query_plan_count: summary.unassigned_executable_query_plan_count ?? 0,
      held_for_matter_tagging_resource_count: summary.held_for_matter_tagging_resource_count ?? 0,
      cross_workspace_probe_count: summary.cross_workspace_probe_count ?? 0,
      blocked_cross_workspace_probe_count: summary.blocked_cross_workspace_probe_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
      external_delivery_executed_count: summary.external_delivery_executed_count ?? 0,
      auto_approval_count: summary.auto_approval_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildResourceStoreInterfaceStage(resourceStoreInterface, source) {
  if (!resourceStoreInterface) return missingStage("resource_store_interface", "Resource Store Interface", source);
  const summary = resourceStoreInterface.summary ?? {};
  const errorCount = summary.validation_error_count ?? resourceStoreInterface.validation?.errors?.length ?? 0;
  const status = summary.resource_store_interface_status === "complete"
    && errorCount === 0
    && (summary.resource_store_record_count ?? 0) > 0
    && (summary.resource_version_store_record_count ?? 0) > 0
    && (summary.bound_required_consumer_layer_count ?? 0) === (summary.required_consumer_layer_count ?? -1)
    && (summary.resource_store_rls_template_count ?? 0) > 0
    && (summary.compiled_resource_query_plan_count ?? 0) > 0
    && (summary.executable_resource_query_plan_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "resource_store_interface",
    label: "Resource Store Interface",
    status,
    message: `${summary.resource_store_record_count ?? 0} resource store record(s), ${summary.adapter_binding_count ?? 0} adapter binding(s), status ${summary.resource_store_interface_status ?? "unknown"}.`,
    source_path: source?.path ?? null,
    metrics: {
      resource_store_interface_status: summary.resource_store_interface_status ?? "unknown",
      interface_contract_id: summary.interface_contract_id ?? null,
      resource_store_collection_id: summary.resource_store_collection_id ?? null,
      resource_version_store_collection_id: summary.resource_version_store_collection_id ?? null,
      resource_store_record_count: summary.resource_store_record_count ?? 0,
      resource_version_store_record_count: summary.resource_version_store_record_count ?? 0,
      registry_projection_count: summary.registry_projection_count ?? 0,
      dashboard_projection_route_count: summary.dashboard_projection_route_count ?? 0,
      adapter_binding_count: summary.adapter_binding_count ?? 0,
      registry_adapter_binding_count: summary.registry_adapter_binding_count ?? 0,
      ingestion_adapter_binding_count: summary.ingestion_adapter_binding_count ?? 0,
      dashboard_adapter_binding_count: summary.dashboard_adapter_binding_count ?? 0,
      required_consumer_layer_count: summary.required_consumer_layer_count ?? 0,
      bound_required_consumer_layer_count: summary.bound_required_consumer_layer_count ?? 0,
      required_resource_filter_count: summary.required_resource_filter_count ?? 0,
      required_resource_version_filter_count: summary.required_resource_version_filter_count ?? 0,
      resource_store_rls_template_count: summary.resource_store_rls_template_count ?? 0,
      compiled_resource_query_plan_count: summary.compiled_resource_query_plan_count ?? 0,
      executable_resource_query_plan_count: summary.executable_resource_query_plan_count ?? 0,
      held_resource_query_plan_count: summary.held_resource_query_plan_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildImmutableObjectStoreLayoutStage(layout, source) {
  if (!layout) return missingStage("immutable_object_store_layout", "Immutable Object Store Layout", source);
  const summary = layout.summary ?? {};
  const errorCount = summary.validation_error_count ?? layout.validation?.errors?.length ?? 0;
  const status = summary.object_store_layout_status === "complete"
    && errorCount === 0
    && (summary.raw_source_object_path_count ?? 0) > 0
    && (summary.generated_output_object_path_count ?? 0) > 0
    && (summary.collision_count ?? -1) === 0
    && (summary.absolute_source_path_key_count ?? -1) === 0
    && (summary.content_addressed_path_count ?? 0) === (summary.total_object_path_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "immutable_object_store_layout",
    label: "Immutable Object Store Layout",
    status,
    message: `${summary.raw_source_object_path_count ?? 0} raw source path(s), ${summary.generated_output_object_path_count ?? 0} generated output path(s), ${summary.collision_count ?? 0} collision(s).`,
    source_path: source?.path ?? null,
    metrics: {
      object_store_layout_status: summary.object_store_layout_status ?? "unknown",
      layout_contract_id: summary.layout_contract_id ?? null,
      object_store_root: summary.object_store_root ?? null,
      namespace_count: summary.namespace_count ?? 0,
      path_resolver_count: summary.path_resolver_count ?? 0,
      raw_source_object_path_count: summary.raw_source_object_path_count ?? 0,
      generated_output_object_path_count: summary.generated_output_object_path_count ?? 0,
      total_object_path_count: summary.total_object_path_count ?? 0,
      collision_count: summary.collision_count ?? 0,
      overwrite_forbidden_resolver_count: summary.overwrite_forbidden_resolver_count ?? 0,
      content_addressed_path_count: summary.content_addressed_path_count ?? 0,
      absolute_source_path_key_count: summary.absolute_source_path_key_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildResourceVersionLedgerStage(ledger, source) {
  if (!ledger) return missingStage("resource_version_ledger", "Resource Version Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const status = summary.resource_version_ledger_status === "complete"
    && errorCount === 0
    && (summary.version_family_count ?? 0) > 0
    && (summary.resource_version_count ?? 0) > 0
    && (summary.object_path_binding_count ?? 0) === (summary.resource_version_count ?? -1)
    && (summary.unbound_object_path_count ?? -1) === 0
    && (summary.version_event_count ?? 0) >= (summary.resource_version_count ?? 0)
    ? "passed"
    : "attention";
  return {
    stage_id: "resource_version_ledger",
    label: "Resource Version Ledger",
    status,
    message: `${summary.version_family_count ?? 0} version family(ies), ${summary.resource_version_count ?? 0} version(s), ${summary.duplicate_candidate_count ?? 0} duplicate candidate(s).`,
    source_path: source?.path ?? null,
    metrics: {
      resource_version_ledger_status: summary.resource_version_ledger_status ?? "unknown",
      ledger_contract_id: summary.ledger_contract_id ?? null,
      version_family_count: summary.version_family_count ?? 0,
      resource_version_count: summary.resource_version_count ?? 0,
      current_version_count: summary.current_version_count ?? 0,
      content_hash_group_count: summary.content_hash_group_count ?? 0,
      singleton_family_count: summary.singleton_family_count ?? 0,
      multi_version_family_count: summary.multi_version_family_count ?? 0,
      changed_content_family_count: summary.changed_content_family_count ?? 0,
      duplicate_content_family_count: summary.duplicate_content_family_count ?? 0,
      duplicate_candidate_count: summary.duplicate_candidate_count ?? 0,
      duplicate_candidate_matched_count: summary.duplicate_candidate_matched_count ?? 0,
      duplicate_candidate_unmatched_count: summary.duplicate_candidate_unmatched_count ?? 0,
      version_event_count: summary.version_event_count ?? 0,
      changed_content_event_count: summary.changed_content_event_count ?? 0,
      duplicate_content_event_count: summary.duplicate_content_event_count ?? 0,
      duplicate_candidate_event_count: summary.duplicate_candidate_event_count ?? 0,
      version_transition_count: summary.version_transition_count ?? 0,
      changed_content_transition_count: summary.changed_content_transition_count ?? 0,
      duplicate_transition_count: summary.duplicate_transition_count ?? 0,
      object_path_binding_count: summary.object_path_binding_count ?? 0,
      bound_object_path_count: summary.bound_object_path_count ?? 0,
      unbound_object_path_count: summary.unbound_object_path_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildNormalizedTextContractStage(contract, source) {
  if (!contract) return missingStage("normalized_text_contract", "Normalized Text Contract", source);
  const summary = contract.summary ?? {};
  const errorCount = summary.validation_error_count ?? contract.validation?.errors?.length ?? 0;
  const status = summary.normalized_text_contract_status === "complete"
    && errorCount === 0
    && (summary.normalized_text_artifact_count ?? 0) > 0
    && (summary.location_map_count ?? 0) === (summary.normalized_text_artifact_count ?? -1)
    && (summary.source_span_seed_count ?? 0) === (summary.normalized_text_artifact_count ?? -1)
    && (summary.source_span_seed_ready_count ?? 0) === (summary.source_span_seed_count ?? -1)
    && (summary.page_unit_count ?? 0) > 0
    && (summary.raw_source_bound_count ?? 0) === (summary.normalized_text_artifact_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "normalized_text_contract",
    label: "Normalized Text Contract",
    status,
    message: `${summary.normalized_text_artifact_count ?? 0} artifact(s), ${summary.page_unit_count ?? 0} page unit(s), ${summary.source_span_seed_count ?? 0} source span seed(s).`,
    source_path: source?.path ?? null,
    metrics: {
      normalized_text_contract_status: summary.normalized_text_contract_status ?? "unknown",
      normalized_text_contract_id: summary.normalized_text_contract_id ?? null,
      source_normalized_text_count: summary.source_normalized_text_count ?? 0,
      normalized_text_artifact_count: summary.normalized_text_artifact_count ?? 0,
      resource_version_link_count: summary.resource_version_link_count ?? 0,
      version_family_link_count: summary.version_family_link_count ?? 0,
      raw_source_bound_count: summary.raw_source_bound_count ?? 0,
      text_hash_count: summary.text_hash_count ?? 0,
      location_map_count: summary.location_map_count ?? 0,
      source_span_seed_count: summary.source_span_seed_count ?? 0,
      source_span_seed_ready_count: summary.source_span_seed_ready_count ?? 0,
      page_unit_count: summary.page_unit_count ?? 0,
      synthetic_page_unit_count: summary.synthetic_page_unit_count ?? 0,
      detected_page_unit_count: summary.detected_page_unit_count ?? 0,
      paragraph_unit_count: summary.paragraph_unit_count ?? 0,
      line_unit_count: summary.line_unit_count ?? 0,
      complete_preview_count: summary.complete_preview_count ?? 0,
      preview_only_count: summary.preview_only_count ?? 0,
      truncated_text_count: summary.truncated_text_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildExtractorAdapterContractStage(contract, source) {
  if (!contract) return missingStage("extractor_adapter_contract", "Extractor Adapter Contract", source);
  const summary = contract.summary ?? {};
  const errorCount = summary.validation_error_count ?? contract.validation?.errors?.length ?? 0;
  const status = summary.extractor_adapter_contract_status === "complete"
    && errorCount === 0
    && (summary.extractor_adapter_count ?? 0) > 0
    && (summary.extractor_io_contract_count ?? 0) === (summary.extractor_adapter_count ?? -1)
    && (summary.normalized_text_binding_count ?? 0) === (summary.normalized_text_artifact_count ?? -1)
    && (summary.bound_normalized_text_count ?? 0) === (summary.normalized_text_artifact_count ?? -1)
    && (summary.unbound_normalized_text_count ?? 0) === 0
    && (summary.external_service_adapter_count ?? 0) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "extractor_adapter_contract",
    label: "Extractor Adapter Contract",
    status,
    message: `${summary.extractor_adapter_count ?? 0} adapter(s), ${summary.document_type_binding_count ?? 0} document binding(s), ${summary.bound_normalized_text_count ?? 0} normalized text binding(s).`,
    source_path: source?.path ?? null,
    metrics: {
      extractor_adapter_contract_status: summary.extractor_adapter_contract_status ?? "unknown",
      extractor_adapter_contract_id: summary.extractor_adapter_contract_id ?? null,
      extractor_adapter_count: summary.extractor_adapter_count ?? 0,
      extractor_io_contract_count: summary.extractor_io_contract_count ?? 0,
      document_type_binding_count: summary.document_type_binding_count ?? 0,
      ocr_fallback_policy_count: summary.ocr_fallback_policy_count ?? 0,
      normalized_text_artifact_count: summary.normalized_text_artifact_count ?? 0,
      normalized_text_binding_count: summary.normalized_text_binding_count ?? 0,
      bound_normalized_text_count: summary.bound_normalized_text_count ?? 0,
      unbound_normalized_text_count: summary.unbound_normalized_text_count ?? 0,
      local_only_adapter_count: summary.local_only_adapter_count ?? 0,
      external_service_adapter_count: summary.external_service_adapter_count ?? 0,
      ocr_policy_external_service_count: summary.ocr_policy_external_service_count ?? 0,
      pdf_ocr_local_manual_policy_count: summary.pdf_ocr_local_manual_policy_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildSourceSpanStoreStage(store, source) {
  if (!store) return missingStage("source_span_store", "Source Span Store", source);
  const summary = store.summary ?? {};
  const errorCount = summary.validation_error_count ?? store.validation?.errors?.length ?? 0;
  const artifactCount = summary.normalized_text_artifact_count ?? 0;
  const status = summary.source_span_store_status === "complete"
    && errorCount === 0
    && artifactCount > 0
    && (summary.whole_document_span_count ?? 0) === artifactCount
    && (summary.page_span_count ?? 0) >= artifactCount
    && (summary.paragraph_span_count ?? 0) >= artifactCount
    && (summary.line_span_count ?? 0) >= artifactCount
    && (summary.char_range_span_count ?? 0) === artifactCount
    && (summary.source_span_locator_count ?? 0) === (summary.source_span_count ?? -1)
    && (summary.source_span_location_unit_count ?? 0) === (summary.source_span_count ?? -1)
    && (summary.extractor_bound_span_count ?? 0) === (summary.source_span_count ?? -1)
    && (summary.canonical_offset_span_count ?? 0) === (summary.source_span_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "source_span_store",
    label: "Source Span Store",
    status,
    message: `${summary.source_span_count ?? 0} source span(s), ${summary.page_span_count ?? 0} page span(s), ${summary.line_span_count ?? 0} line span(s).`,
    source_path: source?.path ?? null,
    metrics: {
      source_span_store_status: summary.source_span_store_status ?? "unknown",
      source_span_store_contract_id: summary.source_span_store_contract_id ?? null,
      source_span_schema_version: summary.source_span_schema_version ?? null,
      normalized_text_artifact_count: summary.normalized_text_artifact_count ?? 0,
      source_span_seed_count: summary.source_span_seed_count ?? 0,
      source_span_count: summary.source_span_count ?? 0,
      source_span_locator_count: summary.source_span_locator_count ?? 0,
      source_span_location_unit_count: summary.source_span_location_unit_count ?? 0,
      whole_document_span_count: summary.whole_document_span_count ?? 0,
      page_span_count: summary.page_span_count ?? 0,
      paragraph_span_count: summary.paragraph_span_count ?? 0,
      line_span_count: summary.line_span_count ?? 0,
      char_range_span_count: summary.char_range_span_count ?? 0,
      timestamp_span_count: summary.timestamp_span_count ?? 0,
      timestamp_not_applicable_count: summary.timestamp_not_applicable_count ?? 0,
      extractor_bound_span_count: summary.extractor_bound_span_count ?? 0,
      seed_linked_span_count: summary.seed_linked_span_count ?? 0,
      canonical_offset_span_count: summary.canonical_offset_span_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildEvidenceItemStoreStage(store, source) {
  if (!store) return missingStage("evidence_item_store", "Evidence Item Store", source);
  const summary = store.summary ?? {};
  const errorCount = summary.validation_error_count ?? store.validation?.errors?.length ?? 0;
  const evidenceCount = summary.evidence_item_count ?? 0;
  const status = summary.evidence_item_store_status === "complete"
    && errorCount === 0
    && evidenceCount > 0
    && evidenceCount === (summary.source_span_count ?? -1)
    && evidenceCount === (summary.evidence_source_span_binding_count ?? -1)
    && evidenceCount === (summary.review_queue_item_count ?? -1)
    && evidenceCount === (summary.matter_preserved_evidence_count ?? -1)
    && evidenceCount === (summary.classification_preserved_evidence_count ?? -1)
    && evidenceCount === (summary.policy_snapshot_preserved_evidence_count ?? -1)
    && evidenceCount === (summary.needs_review_count ?? -1)
    && (summary.approved_count ?? 1) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "evidence_item_store",
    label: "Evidence Item Store",
    status,
    message: `${summary.evidence_item_count ?? 0} evidence item(s), ${summary.evidence_source_span_binding_count ?? 0} source-span binding(s), ${summary.review_queue_item_count ?? 0} review queue item(s).`,
    source_path: source?.path ?? null,
    metrics: {
      evidence_item_store_status: summary.evidence_item_store_status ?? "unknown",
      evidence_item_store_contract_id: summary.evidence_item_store_contract_id ?? null,
      evidence_item_schema_version: summary.evidence_item_schema_version ?? null,
      source_span_store_status: summary.source_span_store_status ?? "unknown",
      source_span_count: summary.source_span_count ?? 0,
      evidence_item_count: summary.evidence_item_count ?? 0,
      evidence_source_span_binding_count: summary.evidence_source_span_binding_count ?? 0,
      review_queue_item_count: summary.review_queue_item_count ?? 0,
      source_span_linked_evidence_count: summary.source_span_linked_evidence_count ?? 0,
      matter_preserved_evidence_count: summary.matter_preserved_evidence_count ?? 0,
      classification_preserved_evidence_count: summary.classification_preserved_evidence_count ?? 0,
      policy_snapshot_preserved_evidence_count: summary.policy_snapshot_preserved_evidence_count ?? 0,
      machine_extracted_evidence_count: summary.machine_extracted_evidence_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      approved_count: summary.approved_count ?? 0,
      privilege_flag_count: summary.privilege_flag_count ?? 0,
      redaction_raw_count: summary.redaction_raw_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildFactClaimStoreStage(store, source) {
  if (!store) return missingStage("fact_claim_store", "Fact Claim Store", source);
  const summary = store.summary ?? {};
  const errorCount = summary.validation_error_count ?? store.validation?.errors?.length ?? 0;
  const factCount = summary.fact_claim_count ?? 0;
  const status = summary.fact_claim_store_status === "complete"
    && errorCount === 0
    && factCount > 0
    && factCount === (summary.evidence_item_count ?? -1)
    && factCount === (summary.fact_evidence_binding_count ?? -1)
    && factCount === (summary.review_queue_item_count ?? -1)
    && factCount === (summary.evidence_linked_fact_count ?? -1)
    && factCount === (summary.reliability_preserved_fact_count ?? -1)
    && factCount === (summary.matter_preserved_fact_count ?? -1)
    && factCount === (summary.classification_preserved_fact_count ?? -1)
    && factCount === (summary.policy_snapshot_preserved_fact_count ?? -1)
    && factCount === (summary.needs_review_count ?? -1)
    && (summary.approved_count ?? 1) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "fact_claim_store",
    label: "Fact Claim Store",
    status,
    message: `${summary.fact_claim_count ?? 0} fact claim(s), ${summary.fact_evidence_binding_count ?? 0} evidence binding(s), ${summary.review_queue_item_count ?? 0} review queue item(s).`,
    source_path: source?.path ?? null,
    metrics: {
      fact_claim_store_status: summary.fact_claim_store_status ?? "unknown",
      fact_claim_store_contract_id: summary.fact_claim_store_contract_id ?? null,
      fact_claim_schema_version: summary.fact_claim_schema_version ?? null,
      evidence_item_store_status: summary.evidence_item_store_status ?? "unknown",
      evidence_item_count: summary.evidence_item_count ?? 0,
      fact_claim_count: summary.fact_claim_count ?? 0,
      fact_evidence_binding_count: summary.fact_evidence_binding_count ?? 0,
      review_queue_item_count: summary.review_queue_item_count ?? 0,
      evidence_linked_fact_count: summary.evidence_linked_fact_count ?? 0,
      reliability_preserved_fact_count: summary.reliability_preserved_fact_count ?? 0,
      matter_preserved_fact_count: summary.matter_preserved_fact_count ?? 0,
      classification_preserved_fact_count: summary.classification_preserved_fact_count ?? 0,
      policy_snapshot_preserved_fact_count: summary.policy_snapshot_preserved_fact_count ?? 0,
      machine_extracted_fact_count: summary.machine_extracted_fact_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      approved_count: summary.approved_count ?? 0,
      average_confidence: summary.average_confidence ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildIssueGraphStoreStage(store, source) {
  if (!store) return missingStage("issue_graph_store", "Issue Graph Store", source);
  const summary = store.summary ?? {};
  const errorCount = summary.validation_error_count ?? store.validation?.errors?.length ?? 0;
  const issueCount = summary.issue_count ?? 0;
  const status = summary.issue_graph_store_status === "complete"
    && errorCount === 0
    && issueCount > 0
    && issueCount === (summary.fact_claim_count ?? -1)
    && issueCount === (summary.fact_issue_binding_count ?? -1)
    && issueCount === (summary.legal_rule_binding_count ?? -1)
    && issueCount === (summary.risk_severity_assessment_count ?? -1)
    && issueCount === (summary.review_queue_item_count ?? -1)
    && issueCount === (summary.fact_linked_issue_count ?? -1)
    && issueCount === (summary.legal_rule_linked_issue_count ?? -1)
    && issueCount === (summary.risk_severity_linked_issue_count ?? -1)
    && issueCount === (summary.matter_preserved_issue_count ?? -1)
    && issueCount === (summary.classification_preserved_issue_count ?? -1)
    && issueCount === (summary.policy_snapshot_preserved_issue_count ?? -1)
    && issueCount === (summary.evidence_links_preserved_issue_count ?? -1)
    && issueCount === (summary.needs_review_count ?? -1)
    && (summary.legal_rule_count ?? 0) > 0
    && (summary.approved_count ?? 1) === 0
    ? "passed"
    : "attention";
  return {
    stage_id: "issue_graph_store",
    label: "Issue Graph Store",
    status,
    message: `${summary.issue_count ?? 0} issue candidate(s), ${summary.legal_rule_count ?? 0} legal rule placeholder(s), ${summary.risk_severity_assessment_count ?? 0} risk assessment(s).`,
    source_path: source?.path ?? null,
    metrics: {
      issue_graph_store_status: summary.issue_graph_store_status ?? "unknown",
      issue_graph_store_contract_id: summary.issue_graph_store_contract_id ?? null,
      issue_schema_version: summary.issue_schema_version ?? null,
      legal_rule_schema_version: summary.legal_rule_schema_version ?? null,
      fact_claim_store_status: summary.fact_claim_store_status ?? "unknown",
      fact_claim_count: summary.fact_claim_count ?? 0,
      issue_count: summary.issue_count ?? 0,
      fact_issue_binding_count: summary.fact_issue_binding_count ?? 0,
      legal_rule_count: summary.legal_rule_count ?? 0,
      legal_rule_binding_count: summary.legal_rule_binding_count ?? 0,
      risk_severity_assessment_count: summary.risk_severity_assessment_count ?? 0,
      review_queue_item_count: summary.review_queue_item_count ?? 0,
      fact_linked_issue_count: summary.fact_linked_issue_count ?? 0,
      legal_rule_linked_issue_count: summary.legal_rule_linked_issue_count ?? 0,
      risk_severity_linked_issue_count: summary.risk_severity_linked_issue_count ?? 0,
      matter_preserved_issue_count: summary.matter_preserved_issue_count ?? 0,
      classification_preserved_issue_count: summary.classification_preserved_issue_count ?? 0,
      policy_snapshot_preserved_issue_count: summary.policy_snapshot_preserved_issue_count ?? 0,
      evidence_links_preserved_issue_count: summary.evidence_links_preserved_issue_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      approved_count: summary.approved_count ?? 0,
      critical_severity_count: summary.critical_severity_count ?? 0,
      high_severity_count: summary.high_severity_count ?? 0,
      medium_severity_count: summary.medium_severity_count ?? 0,
      low_severity_count: summary.low_severity_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildCitationObjectStoreStage(store, source) {
  if (!store) return missingStage("citation_object_store", "Citation Object Store", source);
  const summary = store.summary ?? {};
  const errorCount = summary.validation_error_count ?? store.validation?.errors?.length ?? 0;
  const paragraphCount = summary.output_paragraph_count ?? 0;
  const citationCount = summary.citation_count ?? 0;
  const status = summary.citation_object_store_status === "complete"
    && errorCount === 0
    && paragraphCount > 0
    && citationCount >= paragraphCount
    && paragraphCount === (summary.issue_count ?? -1)
    && citationCount === (summary.paragraph_source_binding_count ?? -1)
    && citationCount === (summary.review_queue_item_count ?? -1)
    && citationCount === (summary.source_span_bound_citation_count ?? -1)
    && citationCount === (summary.issue_linked_citation_count ?? -1)
    && citationCount === (summary.paragraph_linked_citation_count ?? -1)
    && citationCount === (summary.fact_linked_citation_count ?? -1)
    && citationCount === (summary.evidence_linked_citation_count ?? -1)
    && citationCount === (summary.matter_preserved_citation_count ?? -1)
    && citationCount === (summary.classification_preserved_citation_count ?? -1)
    && citationCount === (summary.policy_snapshot_preserved_citation_count ?? -1)
    && citationCount === (summary.issue_link_preserved_citation_count ?? -1)
    && citationCount === (summary.needs_review_count ?? -1)
    && (summary.approved_count ?? 1) === 0
    && (summary.client_facing_ready_count ?? 1) === 0
    && paragraphCount === (summary.not_client_facing_paragraph_count ?? -1)
    ? "passed"
    : "attention";
  return {
    stage_id: "citation_object_store",
    label: "Citation Object Store",
    status,
    message: `${summary.output_paragraph_count ?? 0} output paragraph(s), ${summary.citation_count ?? 0} citation object(s), ${summary.paragraph_source_binding_count ?? 0} paragraph-source binding(s).`,
    source_path: source?.path ?? null,
    metrics: {
      citation_object_store_status: summary.citation_object_store_status ?? "unknown",
      citation_object_store_contract_id: summary.citation_object_store_contract_id ?? null,
      citation_schema_version: summary.citation_schema_version ?? null,
      output_paragraph_schema_version: summary.output_paragraph_schema_version ?? null,
      paragraph_source_binding_schema_version: summary.paragraph_source_binding_schema_version ?? null,
      issue_graph_store_status: summary.issue_graph_store_status ?? "unknown",
      issue_count: summary.issue_count ?? 0,
      output_paragraph_count: summary.output_paragraph_count ?? 0,
      citation_count: summary.citation_count ?? 0,
      paragraph_source_binding_count: summary.paragraph_source_binding_count ?? 0,
      review_queue_item_count: summary.review_queue_item_count ?? 0,
      source_span_bound_citation_count: summary.source_span_bound_citation_count ?? 0,
      issue_linked_citation_count: summary.issue_linked_citation_count ?? 0,
      paragraph_linked_citation_count: summary.paragraph_linked_citation_count ?? 0,
      fact_linked_citation_count: summary.fact_linked_citation_count ?? 0,
      evidence_linked_citation_count: summary.evidence_linked_citation_count ?? 0,
      matter_preserved_citation_count: summary.matter_preserved_citation_count ?? 0,
      classification_preserved_citation_count: summary.classification_preserved_citation_count ?? 0,
      policy_snapshot_preserved_citation_count: summary.policy_snapshot_preserved_citation_count ?? 0,
      issue_link_preserved_citation_count: summary.issue_link_preserved_citation_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      approved_count: summary.approved_count ?? 0,
      client_facing_ready_count: summary.client_facing_ready_count ?? 0,
      not_client_facing_paragraph_count: summary.not_client_facing_paragraph_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildLineageGraphBuilderStage(graph, source) {
  if (!graph) return missingStage("lineage_graph_builder", "Lineage Graph Builder", source);
  const summary = graph.summary ?? {};
  const errorCount = summary.validation_error_count ?? graph.validation?.errors?.length ?? 0;
  const pathCount = summary.lineage_path_count ?? 0;
  const edgeCount = summary.lineage_edge_count ?? 0;
  const status = summary.lineage_graph_status === "complete"
    && errorCount === 0
    && pathCount > 0
    && (summary.complete_lineage_path_count ?? 0) === pathCount
    && (summary.broken_lineage_path_count ?? 1) === 0
    && (summary.source_to_output_path_count ?? 0) === pathCount
    && (summary.citation_bound_lineage_count ?? 0) === pathCount
    && (summary.matter_preserved_path_count ?? 0) === pathCount
    && (summary.classification_preserved_path_count ?? 0) === pathCount
    && (summary.policy_snapshot_preserved_path_count ?? 0) === pathCount
    && (summary.not_client_facing_output_path_count ?? 0) === pathCount
    && (summary.client_facing_ready_path_count ?? 1) === 0
    && (summary.needs_review_path_count ?? 0) === pathCount
    && edgeCount === pathCount * 5
    ? "passed"
    : "attention";
  return {
    stage_id: "lineage_graph_builder",
    label: "Lineage Graph Builder",
    status,
    message: `${pathCount} lineage path(s), ${summary.lineage_node_count ?? 0} node(s), ${edgeCount} edge(s).`,
    source_path: source?.path ?? null,
    metrics: {
      lineage_graph_status: summary.lineage_graph_status ?? "unknown",
      lineage_graph_contract_id: summary.lineage_graph_contract_id ?? null,
      lineage_node_schema_version: summary.lineage_node_schema_version ?? null,
      lineage_edge_schema_version: summary.lineage_edge_schema_version ?? null,
      lineage_path_schema_version: summary.lineage_path_schema_version ?? null,
      citation_object_store_status: summary.citation_object_store_status ?? "unknown",
      citation_count: summary.citation_count ?? 0,
      lineage_node_count: summary.lineage_node_count ?? 0,
      source_span_node_count: summary.source_span_node_count ?? 0,
      evidence_item_node_count: summary.evidence_item_node_count ?? 0,
      fact_claim_node_count: summary.fact_claim_node_count ?? 0,
      issue_node_count: summary.issue_node_count ?? 0,
      output_paragraph_node_count: summary.output_paragraph_node_count ?? 0,
      lineage_edge_count: edgeCount,
      expected_lineage_edge_count: summary.expected_lineage_edge_count ?? 0,
      lineage_path_count: pathCount,
      complete_lineage_path_count: summary.complete_lineage_path_count ?? 0,
      broken_lineage_path_count: summary.broken_lineage_path_count ?? 0,
      source_to_output_path_count: summary.source_to_output_path_count ?? 0,
      citation_bound_lineage_count: summary.citation_bound_lineage_count ?? 0,
      matter_preserved_path_count: summary.matter_preserved_path_count ?? 0,
      classification_preserved_path_count: summary.classification_preserved_path_count ?? 0,
      policy_snapshot_preserved_path_count: summary.policy_snapshot_preserved_path_count ?? 0,
      needs_review_path_count: summary.needs_review_path_count ?? 0,
      not_client_facing_output_path_count: summary.not_client_facing_output_path_count ?? 0,
      client_facing_ready_path_count: summary.client_facing_ready_path_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildEvidenceCoverageScoreStage(coverage, source) {
  if (!coverage) return missingStage("evidence_coverage_score", "Evidence Coverage Score", source);
  const summary = coverage.summary ?? {};
  const errorCount = summary.validation_error_count ?? coverage.validation?.errors?.length ?? 0;
  const scoreCount = summary.coverage_score_count ?? 0;
  const dimensionCount = summary.coverage_dimension_count ?? 0;
  const status = summary.evidence_coverage_status === "complete"
    && errorCount === 0
    && scoreCount > 0
    && dimensionCount === scoreCount * 5
    && (summary.claim_covered_count ?? 0) === scoreCount
    && (summary.legal_basis_covered_count ?? 0) === scoreCount
    && (summary.matter_preserved_score_count ?? 0) === scoreCount
    && (summary.classification_preserved_score_count ?? 0) === scoreCount
    && (summary.policy_snapshot_preserved_score_count ?? 0) === scoreCount
    && (summary.not_client_facing_output_score_count ?? 0) === scoreCount
    && (summary.client_facing_ready_score_count ?? 1) === 0
    && (summary.needs_review_score_count ?? 0) === scoreCount
    ? "passed"
    : "attention";
  return {
    stage_id: "evidence_coverage_score",
    label: "Evidence Coverage Score",
    status,
    message: `${scoreCount} coverage score(s), ${dimensionCount} dimension(s), average ${summary.average_coverage_score ?? 0}.`,
    source_path: source?.path ?? null,
    metrics: {
      evidence_coverage_status: summary.evidence_coverage_status ?? "unknown",
      evidence_coverage_contract_id: summary.evidence_coverage_contract_id ?? null,
      coverage_score_schema_version: summary.coverage_score_schema_version ?? null,
      coverage_dimension_schema_version: summary.coverage_dimension_schema_version ?? null,
      lineage_graph_status: summary.lineage_graph_status ?? "unknown",
      source_span_store_status: summary.source_span_store_status ?? "unknown",
      evidence_item_store_status: summary.evidence_item_store_status ?? "unknown",
      fact_claim_store_status: summary.fact_claim_store_status ?? "unknown",
      issue_graph_store_status: summary.issue_graph_store_status ?? "unknown",
      citation_object_store_status: summary.citation_object_store_status ?? "unknown",
      lineage_path_count: summary.lineage_path_count ?? 0,
      output_paragraph_count: summary.output_paragraph_count ?? 0,
      coverage_score_count: scoreCount,
      coverage_dimension_count: dimensionCount,
      required_dimension_count: summary.required_dimension_count ?? 0,
      covered_required_dimension_count: summary.covered_required_dimension_count ?? 0,
      missing_required_dimension_count: summary.missing_required_dimension_count ?? 0,
      not_applicable_dimension_count: summary.not_applicable_dimension_count ?? 0,
      full_coverage_score_count: summary.full_coverage_score_count ?? 0,
      partial_coverage_score_count: summary.partial_coverage_score_count ?? 0,
      average_coverage_score: summary.average_coverage_score ?? 0,
      claim_dimension_count: summary.claim_dimension_count ?? 0,
      claim_covered_count: summary.claim_covered_count ?? 0,
      date_dimension_count: summary.date_dimension_count ?? 0,
      date_required_count: summary.date_required_count ?? 0,
      date_covered_count: summary.date_covered_count ?? 0,
      party_dimension_count: summary.party_dimension_count ?? 0,
      party_required_count: summary.party_required_count ?? 0,
      party_covered_count: summary.party_covered_count ?? 0,
      amount_dimension_count: summary.amount_dimension_count ?? 0,
      amount_required_count: summary.amount_required_count ?? 0,
      amount_covered_count: summary.amount_covered_count ?? 0,
      legal_basis_dimension_count: summary.legal_basis_dimension_count ?? 0,
      legal_basis_covered_count: summary.legal_basis_covered_count ?? 0,
      matter_preserved_score_count: summary.matter_preserved_score_count ?? 0,
      classification_preserved_score_count: summary.classification_preserved_score_count ?? 0,
      policy_snapshot_preserved_score_count: summary.policy_snapshot_preserved_score_count ?? 0,
      needs_review_score_count: summary.needs_review_score_count ?? 0,
      not_client_facing_output_score_count: summary.not_client_facing_output_score_count ?? 0,
      client_facing_ready_score_count: summary.client_facing_ready_score_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildEvidenceContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("evidence_contract_freeze", "Evidence Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "evidence_contract_freeze",
    label: "Evidence Contract Freeze",
    status,
    message: `${summary.source_span_count ?? 0} SourceSpan v2 contract(s), ${summary.evidence_item_count ?? 0} EvidenceItem v2 fixture(s), ${summary.complete_lineage_path_count ?? 0} complete citation path(s).`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      source_span_schema_version: summary.source_span_schema_version ?? null,
      evidence_item_schema_version: summary.evidence_item_schema_version ?? null,
      fact_claim_schema_version: summary.fact_claim_schema_version ?? null,
      issue_schema_version: summary.issue_schema_version ?? null,
      citation_schema_version: summary.citation_schema_version ?? null,
      lineage_edge_schema_version: summary.lineage_edge_schema_version ?? null,
      source_span_count: summary.source_span_count ?? 0,
      evidence_item_count: summary.evidence_item_count ?? 0,
      fact_claim_count: summary.fact_claim_count ?? 0,
      issue_count: summary.issue_count ?? 0,
      citation_count: summary.citation_count ?? 0,
      lineage_edge_count: summary.lineage_edge_count ?? 0,
      citation_bound_count: summary.citation_bound_count ?? 0,
      citation_broken_count: summary.citation_broken_count ?? 0,
      complete_lineage_path_count: summary.complete_lineage_path_count ?? 0,
      broken_lineage_path_count: summary.broken_lineage_path_count ?? 0,
      resource_linked_source_span_count: summary.resource_linked_source_span_count ?? 0,
      matter_linked_evidence_count: summary.matter_linked_evidence_count ?? 0,
      policy_snapshot_linked_evidence_count: summary.policy_snapshot_linked_evidence_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildCapabilityWorkflowContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("capability_workflow_contract_freeze", "Capability Workflow Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "capability_workflow_contract_freeze",
    label: "Capability Workflow Contract Freeze",
    status,
    message: `${summary.capability_manifest_count ?? 0} CapabilityManifest v2 contract(s), ${summary.workflow_count ?? 0} Workflow v2 contract(s), ${summary.runtime_binding_allowed_count ?? 0}/${summary.runtime_binding_count ?? 0} runtime binding(s) allowed.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      capability_manifest_schema_version: summary.capability_manifest_schema_version ?? null,
      workflow_schema_version: summary.workflow_schema_version ?? null,
      workflow_run_schema_version: summary.workflow_run_schema_version ?? null,
      agent_run_schema_version: summary.agent_run_schema_version ?? null,
      capability_io_schema_version: summary.capability_io_schema_version ?? null,
      gate_runtime_schema_version: summary.gate_runtime_schema_version ?? null,
      capability_manifest_count: summary.capability_manifest_count ?? 0,
      workflow_count: summary.workflow_count ?? 0,
      workflow_run_count: summary.workflow_run_count ?? 0,
      agent_run_count: summary.agent_run_count ?? 0,
      capability_io_contract_count: summary.capability_io_contract_count ?? 0,
      gate_runtime_contract_count: summary.gate_runtime_contract_count ?? 0,
      workflow_execution_binding_count: summary.workflow_execution_binding_count ?? 0,
      capability_with_input_output_count: summary.capability_with_input_output_count ?? 0,
      capability_with_gate_contract_count: summary.capability_with_gate_contract_count ?? 0,
      capability_with_runtime_contract_count: summary.capability_with_runtime_contract_count ?? 0,
      workflow_linked_capability_count: summary.workflow_linked_capability_count ?? 0,
      workflow_run_linked_workflow_count: summary.workflow_run_linked_workflow_count ?? 0,
      agent_run_linked_workflow_run_count: summary.agent_run_linked_workflow_run_count ?? 0,
      runtime_binding_count: summary.runtime_binding_count ?? 0,
      runtime_binding_allowed_count: summary.runtime_binding_allowed_count ?? 0,
      runtime_binding_blocked_count: summary.runtime_binding_blocked_count ?? 0,
      gate_binding_count: summary.gate_binding_count ?? 0,
      required_gate_count: summary.required_gate_count ?? 0,
      required_field_declared_count: summary.required_field_declared_count ?? 0,
      optional_field_declared_count: summary.optional_field_declared_count ?? 0,
      version_required_count: summary.version_required_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildRuntimeAgentRunContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("runtime_agentrun_contract_freeze", "Runtime AgentRun Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "runtime_agentrun_contract_freeze",
    label: "Runtime AgentRun Contract Freeze",
    status,
    message: `${summary.runtime_adapter_count ?? 0} RuntimeAdapter v2 contract(s), ${summary.agent_run_count ?? 0} AgentRun runtime contract(s), ${summary.agent_log_bound_count ?? 0}/${summary.log_required_agent_run_count ?? 0} required log(s) bound.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      runtime_adapter_schema_version: summary.runtime_adapter_schema_version ?? null,
      runtime_execution_contract_schema_version: summary.runtime_execution_contract_schema_version ?? null,
      agent_run_runtime_schema_version: summary.agent_run_runtime_schema_version ?? null,
      runtime_output_schema_version: summary.runtime_output_schema_version ?? null,
      runtime_log_schema_version: summary.runtime_log_schema_version ?? null,
      runtime_artifact_schema_version: summary.runtime_artifact_schema_version ?? null,
      runtime_verification_schema_version: summary.runtime_verification_schema_version ?? null,
      runtime_adapter_count: summary.runtime_adapter_count ?? 0,
      runtime_execution_contract_count: summary.runtime_execution_contract_count ?? 0,
      used_runtime_count: summary.used_runtime_count ?? 0,
      agent_run_count: summary.agent_run_count ?? 0,
      runtime_output_count: summary.runtime_output_count ?? 0,
      runtime_log_count: summary.runtime_log_count ?? 0,
      runtime_artifact_count: summary.runtime_artifact_count ?? 0,
      runtime_verification_count: summary.runtime_verification_count ?? 0,
      risk_declared_count: summary.risk_declared_count ?? 0,
      verification_flag_declared_count: summary.verification_flag_declared_count ?? 0,
      log_required_agent_run_count: summary.log_required_agent_run_count ?? 0,
      agent_log_bound_count: summary.agent_log_bound_count ?? 0,
      output_hash_count: summary.output_hash_count ?? 0,
      artifact_capture_required_agent_run_count: summary.artifact_capture_required_agent_run_count ?? 0,
      artifact_capture_bound_count: summary.artifact_capture_bound_count ?? 0,
      high_risk_agent_run_count: summary.high_risk_agent_run_count ?? 0,
      untrusted_output_agent_run_count: summary.untrusted_output_agent_run_count ?? 0,
      verification_required_agent_run_count: summary.verification_required_agent_run_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildGateApprovalContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("gate_approval_contract_freeze", "Gate Approval Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "gate_approval_contract_freeze",
    label: "Gate Approval Contract Freeze",
    status,
    message: `${summary.gate_result_count ?? 0} GateResult v2 contract(s), ${summary.approval_request_count ?? 0} ApprovalRequest v2 contract(s), ${summary.human_approval_gate_linked_count ?? 0}/${summary.human_approval_gate_count ?? 0} human approval gate(s) linked.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      gate_result_schema_version: summary.gate_result_schema_version ?? null,
      approval_request_schema_version: summary.approval_request_schema_version ?? null,
      approval_decision_schema_version: summary.approval_decision_schema_version ?? null,
      human_gate_schema_version: summary.human_gate_schema_version ?? null,
      approval_authority_schema_version: summary.approval_authority_schema_version ?? null,
      gate_approval_binding_schema_version: summary.gate_approval_binding_schema_version ?? null,
      gate_result_count: summary.gate_result_count ?? 0,
      approval_request_count: summary.approval_request_count ?? 0,
      approval_decision_count: summary.approval_decision_count ?? 0,
      human_gate_contract_count: summary.human_gate_contract_count ?? 0,
      human_approval_gate_count: summary.human_approval_gate_count ?? 0,
      human_approval_gate_linked_count: summary.human_approval_gate_linked_count ?? 0,
      gate_approval_binding_count: summary.gate_approval_binding_count ?? 0,
      linked_gate_approval_binding_count: summary.linked_gate_approval_binding_count ?? 0,
      separated_approval_request_count: summary.separated_approval_request_count ?? 0,
      governance_output_approval_request_count: summary.governance_output_approval_request_count ?? 0,
      output_approval_request_count: summary.output_approval_request_count ?? 0,
      gate_blocker_review_count: summary.gate_blocker_review_count ?? 0,
      evidence_review_request_count: summary.evidence_review_request_count ?? 0,
      protected_explicit_approval_request_count: summary.protected_explicit_approval_request_count ?? 0,
      approval_authority_declared_count: summary.approval_authority_declared_count ?? 0,
      pending_approval_request_count: summary.pending_approval_request_count ?? 0,
      linked_approval_decision_count: summary.linked_approval_decision_count ?? 0,
      orphan_approval_decision_count: summary.orphan_approval_decision_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildOutputDeliveryContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("output_delivery_contract_freeze", "Output Delivery Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "output_delivery_contract_freeze",
    label: "Output Delivery Contract Freeze",
    status,
    message: `${summary.output_artifact_count ?? 0} OutputArtifact v2 contract(s), ${summary.delivery_action_count ?? 0} DeliveryAction v2 contract(s), ${summary.artifact_hash_count ?? 0}/${summary.output_artifact_count ?? 0} artifact hash(es) tracked.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      output_artifact_schema_version: summary.output_artifact_schema_version ?? null,
      delivery_action_schema_version: summary.delivery_action_schema_version ?? null,
      delivery_receipt_schema_version: summary.delivery_receipt_schema_version ?? null,
      output_delivery_binding_schema_version: summary.output_delivery_binding_schema_version ?? null,
      delivery_state_transition_schema_version: summary.delivery_state_transition_schema_version ?? null,
      output_artifact_count: summary.output_artifact_count ?? 0,
      delivery_action_count: summary.delivery_action_count ?? 0,
      delivery_receipt_count: summary.delivery_receipt_count ?? 0,
      output_delivery_binding_count: summary.output_delivery_binding_count ?? 0,
      delivery_state_transition_count: summary.delivery_state_transition_count ?? 0,
      artifact_hash_count: summary.artifact_hash_count ?? 0,
      missing_artifact_hash_count: summary.missing_artifact_hash_count ?? 0,
      linked_delivery_action_count: summary.linked_delivery_action_count ?? 0,
      missing_delivery_action_count: summary.missing_delivery_action_count ?? 0,
      pending_approval_artifact_count: summary.pending_approval_artifact_count ?? 0,
      approval_request_linked_artifact_count: summary.approval_request_linked_artifact_count ?? 0,
      protected_delivery_action_count: summary.protected_delivery_action_count ?? 0,
      draft_only_delivery_action_count: summary.draft_only_delivery_action_count ?? 0,
      ready_delivery_action_count: summary.ready_delivery_action_count ?? 0,
      executed_delivery_action_count: summary.executed_delivery_action_count ?? 0,
      delivered_receipt_count: summary.delivered_receipt_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      linked_binding_count: summary.linked_binding_count ?? 0,
      attention_binding_count: summary.attention_binding_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildEventAuditRunContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("event_audit_run_contract_freeze", "Event Audit Run Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "event_audit_run_contract_freeze",
    label: "Event Audit Run Contract Freeze",
    status,
    message: `${summary.event_record_count ?? 0} EventRecord v2, ${summary.audit_event_count ?? 0} AuditEvent v2, ${summary.run_ledger_count ?? 0} RunLedger v2; ${summary.correlation_id_count ?? summary.correlation_id_declared_count ?? 0} correlation id(s).`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      event_record_schema_version: summary.event_record_schema_version ?? null,
      audit_event_schema_version: summary.audit_event_schema_version ?? null,
      run_ledger_schema_version: summary.run_ledger_schema_version ?? null,
      event_run_binding_schema_version: summary.event_run_binding_schema_version ?? null,
      event_record_count: summary.event_record_count ?? 0,
      audit_event_count: summary.audit_event_count ?? 0,
      run_ledger_count: summary.run_ledger_count ?? 0,
      event_run_binding_count: summary.event_run_binding_count ?? 0,
      linked_event_run_binding_count: summary.linked_event_run_binding_count ?? 0,
      external_audit_event_count: summary.external_audit_event_count ?? 0,
      missing_event_run_binding_count: summary.missing_event_run_binding_count ?? 0,
      correlation_id_count: summary.correlation_id_count ?? summary.correlation_id_declared_count ?? 0,
      missing_correlation_id_count: summary.missing_correlation_id_count ?? 0,
      actor_declared_count: summary.actor_declared_count ?? 0,
      missing_actor_count: summary.missing_actor_count ?? 0,
      policy_snapshot_declared_count: summary.policy_snapshot_declared_count ?? 0,
      fallback_policy_snapshot_count: summary.fallback_policy_snapshot_count ?? 0,
      missing_policy_snapshot_count: summary.missing_policy_snapshot_count ?? 0,
      source_schema_version_declared_count: summary.source_schema_version_declared_count ?? 0,
      run_with_event_count: summary.run_with_event_count ?? 0,
      run_with_agent_count: summary.run_with_agent_count ?? 0,
      run_with_policy_snapshot_count: summary.run_with_policy_snapshot_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildErrorCostObservabilityContractFreezeStage(freeze, source) {
  if (!freeze) return missingStage("error_cost_observability_contract_freeze", "Error Cost Observability Contract Freeze", source);
  const summary = freeze.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || freeze.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "error_cost_observability_contract_freeze",
    label: "Error Cost Observability Contract Freeze",
    status,
    message: `${summary.error_record_count ?? 0} ErrorRecord v2, ${summary.cost_observation_count ?? 0} CostObservation v2, ${summary.trace_projection_count ?? 0} TraceProjection v2; ${summary.latency_observed_count ?? 0}/${summary.trace_projection_count ?? 0} latency observed.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: summary.freeze_status ?? "unknown",
      error_record_schema_version: summary.error_record_schema_version ?? null,
      cost_observation_schema_version: summary.cost_observation_schema_version ?? null,
      trace_projection_schema_version: summary.trace_projection_schema_version ?? null,
      error_record_count: summary.error_record_count ?? 0,
      run_blocked_error_count: summary.run_blocked_error_count ?? 0,
      gate_failed_error_count: summary.gate_failed_error_count ?? 0,
      retryable_error_count: summary.retryable_error_count ?? 0,
      blocking_error_count: summary.blocking_error_count ?? 0,
      cost_observation_count: summary.cost_observation_count ?? 0,
      token_usage_linked_count: summary.token_usage_linked_count ?? 0,
      missing_token_usage_count: summary.missing_token_usage_count ?? 0,
      cost_attribution_linked_count: summary.cost_attribution_linked_count ?? 0,
      budget_alert_linked_count: summary.budget_alert_linked_count ?? 0,
      over_budget_count: summary.over_budget_count ?? 0,
      untracked_cost_count: summary.untracked_cost_count ?? 0,
      total_projected_usd: summary.total_projected_usd ?? 0,
      total_observed_usd: summary.total_observed_usd ?? 0,
      total_estimated_token_usd: summary.total_estimated_token_usd ?? 0,
      total_token_count: summary.total_token_count ?? 0,
      trace_projection_count: summary.trace_projection_count ?? 0,
      trace_with_error_count: summary.trace_with_error_count ?? 0,
      trace_with_cost_count: summary.trace_with_cost_count ?? 0,
      trace_with_policy_snapshot_count: summary.trace_with_policy_snapshot_count ?? 0,
      latency_observed_count: summary.latency_observed_count ?? 0,
      missing_latency_count: summary.missing_latency_count ?? 0,
      total_runtime_seconds: summary.total_runtime_seconds ?? 0,
      average_latency_seconds: summary.average_latency_seconds ?? 0,
      retry_projection_count: summary.retry_projection_count ?? 0,
      retry_count: summary.retry_count ?? 0,
      trace_with_retry_count: summary.trace_with_retry_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0,
    },
  };
}

function buildEvidenceViewerStage(viewer, source) {
  if (!viewer) return missingStage("evidence_viewer", "Evidence Viewer", source);
  const summary = viewer.summary ?? viewer.review_packet?.summary ?? {};
  const status = summary.blocking_gate_count > 0 ? "blocked" : summary.needs_review_count > 0 ? "pending" : "passed";
  return {
    stage_id: "evidence_viewer",
    label: "Evidence Viewer",
    status,
    message: `${summary.evidence_count ?? 0} evidence card(s), ${summary.needs_review_count ?? 0} waiting for review.`,
    source_path: source?.path ?? null,
    metrics: {
      evidence_count: summary.evidence_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
      blocked_item_count: summary.blocked_item_count ?? 0,
    },
  };
}

function buildApprovalQueueStage(queue, source, decisions) {
  if (!queue) return missingStage("approval_queue", "Approval Queue", source);
  const appliedIds = new Set((decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const remainingItems = (queue.items ?? []).filter((item) => !appliedIds.has(item.queue_item_id));
  const pending = remainingItems.filter((item) => item.status === "pending").length;
  const critical = remainingItems.filter((item) => item.priority === "critical").length;
  const criticalOrHigh = remainingItems.filter((item) => ["critical", "high"].includes(item.priority)).length;
  const status = critical > 0 ? "blocked" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_queue",
    label: "Approval Queue",
    status,
    message: `${pending} pending approval item(s), ${critical} critical.`,
    source_path: source?.path ?? null,
    metrics: {
      total_items: queue.summary?.total_items ?? 0,
      remaining_items: remainingItems.length,
      pending_count: pending,
      critical_count: critical,
      critical_or_high_count: criticalOrHigh,
    },
  };
}

function buildEvidenceReviewDraftStage(draft, source) {
  if (!draft) return missingStage("evidence_review_draft", "Evidence Review Draft", source);
  const summary = draft.summary ?? {};
  const attorney = summary.attorney_review_count ?? 0;
  const pending = summary.pending_decision_count ?? 0;
  const status = summary.review_item_count > 0
    ? attorney > 0 || pending > 0
      ? "ready"
      : "passed"
    : "passed";
  return {
    stage_id: "evidence_review_draft",
    label: "Evidence Review Draft",
    status,
    message: `${summary.review_item_count ?? 0} evidence review draft item(s), ${attorney} requiring attorney review.`,
    source_path: source?.path ?? null,
    metrics: {
      review_item_count: summary.review_item_count ?? 0,
      ready_for_review_count: summary.ready_for_review_count ?? 0,
      attorney_review_count: attorney,
      auto_approvable_count: summary.auto_approvable_count ?? 0,
      suggested_approve_count: summary.suggested_approve_count ?? 0,
      pending_decision_count: pending,
    },
  };
}

function buildApprovalDecisionStage(decisions, source) {
  if (!decisions) return missingStage("approval_decisions", "Approval Decisions", source);
  const errors = decisions.decision_errors?.length ?? 0;
  const pending = decisions.summary?.pending_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_decisions",
    label: "Approval Decisions",
    status,
    message: `${decisions.summary?.applied_count ?? 0} decision(s) applied, ${pending} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      applied_count: decisions.summary?.applied_count ?? 0,
      pending_count: pending,
      approved_count: decisions.summary?.approved_count ?? 0,
      rejected_count: decisions.summary?.rejected_count ?? 0,
      audit_event_count: decisions.audit_events?.length ?? 0,
      decision_error_count: errors,
    },
  };
}

function buildApprovalInboxStage(inbox, source) {
  if (!inbox) return missingStage("approval_inbox", "Approval Inbox", source);
  const summary = inbox.summary ?? {};
  const pending = summary.pending_item_count ?? 0;
  const highPriority = summary.high_priority_count ?? 0;
  const status = highPriority > 0 ? "pending" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_inbox",
    label: "Approval Inbox",
    status,
    message: `${summary.inbox_item_count ?? 0} inbox item(s), ${summary.approval_request_count ?? 0} approval request(s), ${summary.gate_review_count ?? 0} gate review(s).`,
    source_path: source?.path ?? null,
    metrics: {
      inbox_item_count: summary.inbox_item_count ?? 0,
      pending_item_count: pending,
      approval_request_count: summary.approval_request_count ?? 0,
      gate_review_count: summary.gate_review_count ?? 0,
      high_priority_count: highPriority,
    },
  };
}

function buildApprovalInboxDecisionStage(result, source) {
  if (!result) return missingStage("approval_inbox_decisions", "Approval Inbox Decisions", source);
  const summary = result.summary ?? {};
  const errors = summary.decision_error_count ?? 0;
  const pending = summary.pending_count ?? 0;
  const ready = summary.ready_for_delivery_count ?? 0;
  const blocked = summary.patched_delivery_blocked_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : blocked > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_inbox_decisions",
    label: "Approval Inbox Decisions",
    status,
    message: `${summary.applied_count ?? 0} applied, ${pending} pending, ${ready} ready for delivery after patch.`,
    source_path: source?.path ?? null,
    metrics: {
      inbox_item_count: summary.inbox_item_count ?? 0,
      applied_count: summary.applied_count ?? 0,
      pending_count: pending,
      ready_for_delivery_count: ready,
      patched_delivery_blocked_count: blocked,
      decision_error_count: errors,
    },
  };
}

function buildPolicyMatrixCatalogStage(catalog, source) {
  if (!catalog) return missingStage("policy_matrix_catalog", "Policy Matrix Catalog", source);
  const summary = catalog.summary ?? {};
  const errorCount = summary.validation_error_count ?? catalog.validation?.errors?.length ?? 0;
  const status = catalog.policy_status === "valid" && errorCount === 0 ? "passed" : "blocked";
  return {
    stage_id: "policy_matrix_catalog",
    label: "Policy Matrix Catalog",
    status,
    message: status === "passed"
      ? `${summary.classification_count ?? 0} classification(s), ${summary.gate_rule_count ?? 0} gate rule(s), ${summary.external_model_forbidden_count ?? 0} external-model forbidden class(es).`
      : `${errorCount} policy validation error(s) require contract repair.`,
    source_path: source?.path ?? null,
    metrics: {
      policy_status: catalog.policy_status ?? "unknown",
      classification_count: summary.classification_count ?? 0,
      runtime_rule_count: summary.runtime_rule_count ?? 0,
      model_rule_count: summary.model_rule_count ?? 0,
      tool_rule_count: summary.tool_rule_count ?? 0,
      output_rule_count: summary.output_rule_count ?? 0,
      gate_rule_count: summary.gate_rule_count ?? 0,
      external_model_forbidden_count: summary.external_model_forbidden_count ?? 0,
      external_model_approval_required_count: summary.external_model_approval_required_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildPolicySnapshotLedgerStage(ledger, source) {
  if (!ledger) return missingStage("policy_snapshot_ledger", "Policy Snapshot Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const status = ledger.ledger_status === "valid" && errorCount === 0 ? "passed" : "blocked";
  return {
    stage_id: "policy_snapshot_ledger",
    label: "Policy Snapshot Ledger",
    status,
    message: status === "passed"
      ? `${summary.policy_snapshot_count ?? 0} snapshot(s), ${summary.workflow_usage_count ?? 0} workflow usage(s), ${summary.event_reference_count ?? 0} event reference(s).`
      : `${errorCount} policy snapshot validation error(s) require contract repair.`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      policy_snapshot_count: summary.policy_snapshot_count ?? 0,
      snapshot_instance_count: summary.snapshot_instance_count ?? 0,
      workflow_usage_count: summary.workflow_usage_count ?? 0,
      event_reference_count: summary.event_reference_count ?? 0,
      run_ledger_reference_count: summary.run_ledger_reference_count ?? 0,
      missing_snapshot_reference_count: summary.missing_snapshot_reference_count ?? 0,
      external_model_forbidden_count: summary.external_model_forbidden_count ?? 0,
      runtime_violation_count: summary.runtime_violation_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildPolicySnapshotBindingLedgerStage(ledger, source) {
  if (!ledger) return missingStage("policy_snapshot_binding_ledger", "Policy Snapshot Binding Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const missingSnapshotCount = summary.missing_policy_snapshot_count ?? 0;
  const unresolvedSnapshotCount = summary.unresolved_policy_snapshot_count ?? 0;
  const status = summary.policy_snapshot_binding_status === "complete" && errorCount === 0 && missingSnapshotCount === 0 && unresolvedSnapshotCount === 0
    ? "passed"
    : "blocked";
  return {
    stage_id: "policy_snapshot_binding_ledger",
    label: "Policy Snapshot Binding Ledger",
    status,
    message: status === "passed"
      ? `${summary.policy_snapshot_binding_count ?? 0} binding(s), ${summary.fallback_resolved_binding_count ?? 0} fallback-resolved, no missing snapshots.`
      : `${missingSnapshotCount} missing snapshot(s), ${unresolvedSnapshotCount} unresolved snapshot(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      policy_snapshot_binding_status: summary.policy_snapshot_binding_status ?? "unknown",
      policy_snapshot_count: summary.policy_snapshot_count ?? 0,
      workflow_policy_binding_count: summary.workflow_policy_binding_count ?? 0,
      agent_run_policy_binding_count: summary.agent_run_policy_binding_count ?? 0,
      event_policy_binding_count: summary.event_policy_binding_count ?? 0,
      gate_policy_binding_count: summary.gate_policy_binding_count ?? 0,
      approval_policy_binding_count: summary.approval_policy_binding_count ?? 0,
      output_policy_binding_count: summary.output_policy_binding_count ?? 0,
      policy_snapshot_binding_count: summary.policy_snapshot_binding_count ?? 0,
      known_policy_snapshot_binding_count: summary.known_policy_snapshot_binding_count ?? 0,
      fallback_resolved_binding_count: summary.fallback_resolved_binding_count ?? 0,
      source_declared_binding_count: summary.source_declared_binding_count ?? 0,
      workflow_inherited_binding_count: summary.workflow_inherited_binding_count ?? 0,
      linked_output_inherited_binding_count: summary.linked_output_inherited_binding_count ?? 0,
      domain_fallback_binding_count: summary.domain_fallback_binding_count ?? 0,
      tenant_fallback_binding_count: summary.tenant_fallback_binding_count ?? 0,
      global_fallback_binding_count: summary.global_fallback_binding_count ?? 0,
      unresolved_declared_reference_count: summary.unresolved_declared_reference_count ?? 0,
      missing_policy_snapshot_count: missingSnapshotCount,
      unresolved_policy_snapshot_count: unresolvedSnapshotCount,
      validation_error_count: errorCount,
    },
  };
}

function buildContextPacketLedgerStage(ledger, source) {
  if (!ledger) return missingStage("context_packet_ledger", "Context Packet Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_packet_count ?? 0;
  const status = ledger.ledger_status === "valid" && errorCount === 0 && blocked === 0 ? "passed" : "blocked";
  return {
    stage_id: "context_packet_ledger",
    label: "Context Packet Ledger",
    status,
    message: status === "passed"
      ? `${summary.context_packet_count ?? 0} packet(s), ${summary.context_item_count ?? 0} context item(s), ${summary.redacted_packet_count ?? 0} redacted packet(s).`
      : `${blocked} blocked packet(s), ${errorCount} validation error(s), ${summary.missing_filter_count ?? 0} missing retrieval filter(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      context_packet_count: summary.context_packet_count ?? 0,
      ready_packet_count: summary.ready_packet_count ?? 0,
      blocked_packet_count: blocked,
      redacted_packet_count: summary.redacted_packet_count ?? 0,
      context_item_count: summary.context_item_count ?? 0,
      retrieval_filter_count: summary.retrieval_filter_count ?? 0,
      missing_filter_count: summary.missing_filter_count ?? 0,
      runtime_mismatch_count: summary.runtime_mismatch_count ?? 0,
      classification_blocked_count: summary.classification_blocked_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildModelRoutingLedgerStage(ledger, source) {
  if (!ledger) return missingStage("model_routing_ledger", "Model Routing Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_route_count ?? 0;
  const approvals = summary.approval_required_route_count ?? 0;
  const status = ledger.ledger_status !== "valid" || errorCount > 0 || blocked > 0
    ? "blocked"
    : approvals > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "model_routing_ledger",
    label: "Model Routing Ledger",
    status,
    message: status === "passed"
      ? `${summary.routing_decision_count ?? 0} route decision(s), ${summary.external_transfer_count ?? 0} external transfer(s), all ready.`
      : `${blocked} blocked route(s), ${approvals} approval-required route(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      routing_decision_count: summary.routing_decision_count ?? 0,
      ready_route_count: summary.ready_route_count ?? 0,
      approval_required_route_count: approvals,
      blocked_route_count: blocked,
      external_transfer_count: summary.external_transfer_count ?? 0,
      local_route_count: summary.local_route_count ?? 0,
      redaction_enforced_count: summary.redaction_enforced_count ?? 0,
      runtime_restricted_count: summary.runtime_restricted_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildModelPolicyEnforcementStage(enforcement, source) {
  if (!enforcement) return missingStage("model_policy_enforcement", "Model Policy Enforcement", source);
  const summary = enforcement.summary ?? {};
  const errorCount = summary.validation_error_count ?? enforcement.validation?.errors?.length ?? 0;
  const unauthorized = summary.unauthorized_external_allow_count ?? 0;
  const approvals = summary.external_transfer_review_count ?? 0;
  const denied = summary.external_transfer_denied_count ?? 0;
  const status = summary.model_policy_enforcement_status !== "complete" || errorCount > 0 || unauthorized > 0
    ? "blocked"
    : approvals > 0 || denied > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "model_policy_enforcement",
    label: "Model Policy Enforcement",
    status,
    message: status === "passed"
      ? `${summary.route_model_gate_count ?? 0} route gate(s), ${summary.external_transfer_route_count ?? 0} external transfer(s), no unauthorized P2-P5 allow.`
      : `${unauthorized} unauthorized external allow(s), ${approvals} approval route(s), ${denied} denied route(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      model_policy_enforcement_status: summary.model_policy_enforcement_status ?? "unknown",
      source_data_classification_rule_engine_status: summary.source_data_classification_rule_engine_status ?? "unknown",
      source_model_routing_ledger_status: summary.source_model_routing_ledger_status ?? "unknown",
      source_policy_contract_status: summary.source_policy_contract_status ?? "unknown",
      classification_model_gate_count: summary.classification_model_gate_count ?? 0,
      resource_model_gate_count: summary.resource_model_gate_count ?? 0,
      route_model_gate_count: summary.route_model_gate_count ?? 0,
      p2_p5_classification_gate_count: summary.p2_p5_classification_gate_count ?? 0,
      p2_p5_resource_gate_count: summary.p2_p5_resource_gate_count ?? 0,
      external_transfer_route_count: summary.external_transfer_route_count ?? 0,
      p2_p5_external_transfer_route_count: summary.p2_p5_external_transfer_route_count ?? 0,
      external_transfer_allowed_count: summary.external_transfer_allowed_count ?? 0,
      external_transfer_review_count: approvals,
      external_transfer_denied_count: denied,
      unauthorized_external_allow_count: unauthorized,
      redaction_required_resource_gate_count: summary.redaction_required_resource_gate_count ?? 0,
      redaction_blocked_route_count: summary.redaction_blocked_route_count ?? 0,
      human_approval_required_gate_count: summary.human_approval_required_gate_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildToolRuntimePolicyEnforcementStage(enforcement, source) {
  if (!enforcement) return missingStage("tool_runtime_policy_enforcement", "Tool/Runtime Policy Enforcement", source);
  const summary = enforcement.summary ?? {};
  const errorCount = summary.validation_error_count ?? enforcement.validation?.errors?.length ?? 0;
  const blockedAgentRuns = summary.agent_run_tool_gate_blocked_count ?? 0;
  const missingToolGates = summary.missing_tool_permission_gate_count ?? 0;
  const unknownTools = summary.unknown_tool_count ?? 0;
  const toolOverlaps = summary.tool_overlap_count ?? 0;
  const reviewToolGates = summary.review_tool_gate_count ?? 0;
  const deniedToolGates = summary.denied_tool_gate_count ?? 0;
  const status = summary.tool_runtime_policy_enforcement_status !== "complete"
    || errorCount > 0
    || blockedAgentRuns > 0
    || missingToolGates > 0
    || unknownTools > 0
    || toolOverlaps > 0
    ? "blocked"
    : reviewToolGates > 0 || deniedToolGates > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "tool_runtime_policy_enforcement",
    label: "Tool/Runtime Policy Enforcement",
    status,
    message: status === "passed"
      ? `${summary.tool_permission_gate_count ?? 0} tool gate(s), ${summary.agent_run_tool_gate_count ?? 0} AgentRun gate(s), no blocked runtime tool path.`
      : `${deniedToolGates} denied tool gate(s), ${reviewToolGates} review tool gate(s), ${blockedAgentRuns} blocked AgentRun gate(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      tool_runtime_policy_enforcement_status: summary.tool_runtime_policy_enforcement_status ?? "unknown",
      source_runtime_contract_status: summary.source_runtime_contract_status ?? "unknown",
      source_policy_matrix_status: summary.source_policy_matrix_status ?? "unknown",
      source_capability_workflow_status: summary.source_capability_workflow_status ?? "unknown",
      source_model_policy_status: summary.source_model_policy_status ?? "unknown",
      runtime_count: summary.runtime_count ?? 0,
      agent_run_count: summary.agent_run_count ?? 0,
      runtime_policy_gate_count: summary.runtime_policy_gate_count ?? 0,
      blocked_runtime_policy_gate_count: summary.blocked_runtime_policy_gate_count ?? 0,
      restricted_runtime_policy_gate_count: summary.restricted_runtime_policy_gate_count ?? 0,
      tool_permission_gate_count: summary.tool_permission_gate_count ?? 0,
      allowed_tool_gate_count: summary.allowed_tool_gate_count ?? 0,
      forbidden_tool_gate_count: summary.forbidden_tool_gate_count ?? 0,
      forbidden_tool_blocked_count: summary.forbidden_tool_blocked_count ?? 0,
      review_tool_gate_count: reviewToolGates,
      denied_tool_gate_count: deniedToolGates,
      protected_action_tool_gate_count: summary.protected_action_tool_gate_count ?? 0,
      agent_run_tool_gate_count: summary.agent_run_tool_gate_count ?? 0,
      agent_run_tool_gate_allow_count: summary.agent_run_tool_gate_allow_count ?? 0,
      agent_run_tool_gate_review_count: summary.agent_run_tool_gate_review_count ?? 0,
      agent_run_tool_gate_deny_count: summary.agent_run_tool_gate_deny_count ?? 0,
      tool_overlap_count: toolOverlaps,
      unknown_tool_count: unknownTools,
      missing_tool_permission_gate_count: missingToolGates,
      validation_error_count: errorCount,
    },
  };
}

function buildOutputDestinationPolicyEnforcementStage(enforcement, source) {
  if (!enforcement) return missingStage("output_destination_policy_enforcement", "Output Destination Policy Enforcement", source);
  const summary = enforcement.summary ?? {};
  const errorCount = summary.validation_error_count ?? enforcement.validation?.errors?.length ?? 0;
  const unsafeFinalActions = summary.unsafe_final_action_count ?? 0;
  const missingPolicies = summary.missing_policy_count ?? 0;
  const missingToolPolicies = summary.missing_tool_policy_count ?? 0;
  const missingDestinationGates = summary.missing_output_destination_gate_count ?? 0;
  const blockedFinalActions = summary.blocked_final_action_count ?? 0;
  const reviewGates = summary.review_gate_count ?? 0;
  const status = summary.output_destination_policy_status !== "complete"
    || errorCount > 0
    || unsafeFinalActions > 0
    || missingPolicies > 0
    || missingToolPolicies > 0
    || missingDestinationGates > 0
    ? "blocked"
    : blockedFinalActions > 0 || reviewGates > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "output_destination_policy_enforcement",
    label: "Output Destination Policy Enforcement",
    status,
    message: status === "passed"
      ? `${summary.delivery_action_destination_gate_count ?? 0} delivery action gate(s), no final action blockers.`
      : `${blockedFinalActions} final action(s) held for approval, ${unsafeFinalActions} unsafe final action(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      output_destination_policy_status: summary.output_destination_policy_status ?? "unknown",
      source_policy_matrix_status: summary.source_policy_matrix_status ?? "unknown",
      source_output_delivery_contract_status: summary.source_output_delivery_contract_status ?? "unknown",
      source_delivery_execution_mode: summary.source_delivery_execution_mode ?? "unknown",
      source_tool_runtime_policy_status: summary.source_tool_runtime_policy_status ?? "unknown",
      policy_rule_count: summary.policy_rule_count ?? 0,
      artifact_destination_gate_count: summary.artifact_destination_gate_count ?? 0,
      delivery_action_destination_gate_count: summary.delivery_action_destination_gate_count ?? 0,
      final_action_separation_gate_count: summary.final_action_separation_gate_count ?? 0,
      final_action_required_policy_count: summary.final_action_required_policy_count ?? 0,
      final_action_required_artifact_count: summary.final_action_required_artifact_count ?? 0,
      final_action_required_delivery_count: summary.final_action_required_delivery_count ?? 0,
      draft_final_action_separated_count: summary.draft_final_action_separated_count ?? 0,
      protected_destination_count: summary.protected_destination_count ?? 0,
      protected_destination_tool_count: summary.protected_destination_tool_count ?? 0,
      blocked_final_action_count: blockedFinalActions,
      pending_approval_final_action_count: summary.pending_approval_final_action_count ?? 0,
      approved_final_action_count: summary.approved_final_action_count ?? 0,
      executed_final_action_count: summary.executed_final_action_count ?? 0,
      unsafe_final_action_count: unsafeFinalActions,
      missing_policy_count: missingPolicies,
      missing_tool_policy_count: missingToolPolicies,
      missing_output_destination_gate_count: missingDestinationGates,
      review_gate_count: reviewGates,
      validation_error_count: errorCount,
    },
  };
}

function buildApprovalAuthorityLedgerStage(ledger, source) {
  if (!ledger) return missingStage("approval_authority_ledger", "Approval Authority Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const missingRoleCount = summary.missing_authority_role_count ?? 0;
  const assignmentRequired = summary.assignment_required_decision_count ?? 0;
  const lawFirmHumanRequired = summary.law_firm_human_required_decision_count ?? 0;
  const lawFirmDecisions = summary.law_firm_authority_decision_count ?? 0;
  const status = summary.approval_authority_status !== "complete" || errorCount > 0 || missingRoleCount > 0
    ? "blocked"
    : assignmentRequired > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "approval_authority_ledger",
    label: "Approval Authority Ledger",
    status,
    message: status === "passed"
      ? `${summary.authority_decision_count ?? 0} authority decision(s), all assigned.`
      : `${assignmentRequired} authority assignment(s) still require human setup; ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      approval_authority_status: summary.approval_authority_status ?? "unknown",
      source_identity_model_status: summary.source_identity_model_status ?? "unknown",
      source_matter_profile_team_ledger_status: summary.source_matter_profile_team_ledger_status ?? "unknown",
      source_gate_approval_contract_status: summary.source_gate_approval_contract_status ?? "unknown",
      source_output_delivery_contract_status: summary.source_output_delivery_contract_status ?? "unknown",
      source_output_destination_policy_status: summary.source_output_destination_policy_status ?? "unknown",
      authority_policy_count: summary.authority_policy_count ?? 0,
      artifact_authority_decision_count: summary.artifact_authority_decision_count ?? 0,
      approval_request_authority_decision_count: summary.approval_request_authority_decision_count ?? 0,
      delivery_action_authority_decision_count: summary.delivery_action_authority_decision_count ?? 0,
      authority_decision_count: summary.authority_decision_count ?? 0,
      human_authority_required_decision_count: summary.human_authority_required_decision_count ?? 0,
      law_firm_authority_decision_count: lawFirmDecisions,
      law_firm_human_required_decision_count: lawFirmHumanRequired,
      assigned_authority_decision_count: summary.assigned_authority_decision_count ?? 0,
      assignment_required_decision_count: assignmentRequired,
      tenant_identity_missing_decision_count: summary.tenant_identity_missing_decision_count ?? 0,
      matter_profile_missing_decision_count: summary.matter_profile_missing_decision_count ?? 0,
      nonhuman_authority_blocked_count: summary.nonhuman_authority_blocked_count ?? 0,
      missing_authority_role_count: missingRoleCount,
      validation_error_count: errorCount,
    },
  };
}

function buildCostBudgetLedgerStage(ledger, source) {
  if (!ledger) return missingStage("cost_budget_ledger", "Cost Budget Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_decision_count ?? 0;
  const status = ledger.ledger_status === "valid" && errorCount === 0 && blocked === 0 ? "passed" : "blocked";
  return {
    stage_id: "cost_budget_ledger",
    label: "Cost Budget Ledger",
    status,
    message: status === "passed"
      ? `${summary.budget_decision_count ?? 0} budget decision(s), max $${summary.total_max_usd ?? 0}, observed $${summary.total_observed_usd ?? 0}.`
      : `${blocked} blocked budget decision(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      budget_decision_count: summary.budget_decision_count ?? 0,
      passed_decision_count: summary.passed_decision_count ?? 0,
      blocked_decision_count: blocked,
      token_tracking_required_count: summary.token_tracking_required_count ?? 0,
      token_tracking_pending_count: summary.token_tracking_pending_count ?? 0,
      cost_record_count: summary.cost_record_count ?? 0,
      total_max_usd: summary.total_max_usd ?? 0,
      total_observed_usd: summary.total_observed_usd ?? 0,
      total_observed_runtime_seconds: summary.total_observed_runtime_seconds ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildTokenUsageLedgerStage(ledger, source) {
  if (!ledger) return missingStage("token_usage_ledger", "Token Usage Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_record_count ?? 0;
  const status = ledger.ledger_status === "valid" && errorCount === 0 && blocked === 0 ? "passed" : "blocked";
  return {
    stage_id: "token_usage_ledger",
    label: "Token Usage Ledger",
    status,
    message: status === "passed"
      ? `${summary.token_usage_record_count ?? 0} token usage record(s), ${summary.estimated_record_count ?? 0} estimated, ${summary.total_token_count ?? 0} total tokens.`
      : `${blocked} blocked token usage record(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      token_usage_record_count: summary.token_usage_record_count ?? 0,
      tracking_required_count: summary.tracking_required_count ?? 0,
      recorded_record_count: summary.recorded_record_count ?? 0,
      estimated_record_count: summary.estimated_record_count ?? 0,
      not_required_record_count: summary.not_required_record_count ?? 0,
      unknown_record_count: summary.unknown_record_count ?? 0,
      blocked_record_count: blocked,
      total_input_token_count: summary.total_input_token_count ?? 0,
      total_output_token_count: summary.total_output_token_count ?? 0,
      total_token_count: summary.total_token_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildCostAttributionLedgerStage(ledger, source) {
  if (!ledger) return missingStage("cost_attribution_ledger", "Cost Attribution Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_record_count ?? 0;
  const overBudget = summary.over_budget_count ?? 0;
  const status = ledger.ledger_status === "valid" && errorCount === 0 && blocked === 0 && overBudget === 0 ? "passed" : "blocked";
  return {
    stage_id: "cost_attribution_ledger",
    label: "Cost Attribution Ledger",
    status,
    message: status === "passed"
      ? `${summary.attribution_record_count ?? 0} attribution record(s), projected $${summary.total_projected_usd ?? 0}, remaining $${summary.total_budget_remaining_usd ?? 0}.`
      : `${blocked} blocked record(s), ${overBudget} over-budget record(s), ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      attribution_record_count: summary.attribution_record_count ?? 0,
      attributed_record_count: summary.attributed_record_count ?? 0,
      attention_record_count: summary.attention_record_count ?? 0,
      blocked_record_count: blocked,
      over_budget_count: overBudget,
      untracked_cost_count: summary.untracked_cost_count ?? 0,
      total_budget_usd: summary.total_budget_usd ?? 0,
      total_observed_usd: summary.total_observed_usd ?? 0,
      total_estimated_token_usd: summary.total_estimated_token_usd ?? 0,
      total_projected_usd: summary.total_projected_usd ?? 0,
      total_budget_remaining_usd: summary.total_budget_remaining_usd ?? 0,
      total_token_count: summary.total_token_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildBudgetAlertLedgerStage(ledger, source) {
  if (!ledger) return missingStage("budget_alert_ledger", "Budget Alert Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const critical = summary.critical_count ?? 0;
  const warnings = summary.warning_count ?? 0;
  const unbudgeted = summary.unbudgeted_count ?? 0;
  const activeAlerts = summary.active_alert_count ?? 0;
  const status = ledger.ledger_status !== "valid" || errorCount > 0 || critical > 0 || unbudgeted > 0
    ? "blocked"
    : warnings > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "budget_alert_ledger",
    label: "Budget Alert Ledger",
    status,
    message: status === "passed"
      ? `${summary.alert_record_count ?? 0} budget alert record(s), no active alerts.`
      : `${activeAlerts} active alert(s), ${critical} critical, ${warnings} warning, ${errorCount} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      ledger_status: ledger.ledger_status ?? "unknown",
      alert_record_count: summary.alert_record_count ?? 0,
      clear_count: summary.clear_count ?? 0,
      warning_count: warnings,
      critical_count: critical,
      unbudgeted_count: unbudgeted,
      active_alert_count: activeAlerts,
      human_required_count: summary.human_required_count ?? 0,
      total_projected_usd: summary.total_projected_usd ?? 0,
      total_budget_remaining_usd: summary.total_budget_remaining_usd ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildDomainPackRegistryStage(registry, source) {
  if (!registry) return missingStage("domain_pack_registry", "Domain Pack Registry", source);
  const summary = registry.summary ?? {};
  const errorCount = summary.error_count ?? registry.validation?.errors?.length ?? 0;
  const invalidPackCount = summary.invalid_pack_count ?? 0;
  const invalidCapabilityCount = summary.invalid_capability_count ?? 0;
  const status = errorCount > 0 || invalidPackCount > 0 || invalidCapabilityCount > 0 ? "blocked" : "passed";
  return {
    stage_id: "domain_pack_registry",
    label: "Domain Pack Registry",
    status,
    message: status === "passed"
      ? `${summary.pack_count ?? 0} pack(s), ${summary.capability_count ?? 0} capability contract(s) registered.`
      : `${invalidPackCount} invalid pack(s), ${invalidCapabilityCount} invalid capability contract(s), ${errorCount} error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      valid: registry.validation?.valid ?? false,
      pack_count: summary.pack_count ?? 0,
      enabled_pack_count: summary.enabled_pack_count ?? 0,
      capability_count: summary.capability_count ?? 0,
      invalid_pack_count: invalidPackCount,
      invalid_capability_count: invalidCapabilityCount,
      error_count: errorCount,
    },
  };
}

function buildOutputArtifactCatalogStage(catalog, source) {
  if (!catalog) return missingStage("output_artifact_catalog", "Output Artifact Catalog", source);
  const summary = catalog.summary ?? {};
  const pending = summary.approval_pending_count ?? 0;
  const blockedDelivery = summary.blocked_delivery_count ?? 0;
  const status = blockedDelivery > 0 || pending > 0 ? "pending" : "passed";
  return {
    stage_id: "output_artifact_catalog",
    label: "Output Artifact Catalog",
    status,
    message: `${summary.artifact_count ?? 0} output artifact(s), ${pending} pending approval, ${blockedDelivery} blocked for delivery.`,
    source_path: source?.path ?? null,
    metrics: {
      artifact_count: summary.artifact_count ?? 0,
      approval_pending_count: pending,
      blocked_delivery_count: blockedDelivery,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
    },
  };
}

function buildObservabilityCatalogStage(catalog, source) {
  if (!catalog) return missingStage("observability_catalog", "Observability Catalog", source);
  const summary = catalog.summary ?? {};
  const errors = summary.error_record_count ?? 0;
  const missingSources = summary.missing_source_count ?? 0;
  const blockedRuns = summary.blocked_run_count ?? 0;
  const pendingApprovals = summary.pending_approval_count ?? 0;
  const status = errors > 0 || missingSources > 0
    ? "attention"
    : blockedRuns > 0 || pendingApprovals > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "observability_catalog",
    label: "Observability Catalog",
    status,
    message: `${summary.workflow_run_count ?? 0} run(s), ${summary.event_count ?? 0} event(s), ${summary.total_runtime_seconds ?? 0}s runtime.`,
    source_path: source?.path ?? null,
    metrics: {
      workflow_run_count: summary.workflow_run_count ?? 0,
      event_count: summary.event_count ?? 0,
      agent_run_count: summary.agent_run_count ?? 0,
      pending_approval_count: pendingApprovals,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
      total_runtime_seconds: summary.total_runtime_seconds ?? 0,
      error_record_count: errors,
      blocked_run_count: blockedRuns,
    },
  };
}

function buildProtectedDeliveryQueueStage(queue, source) {
  if (!queue) return missingStage("protected_delivery_queue", "Protected Delivery Queue", source);
  const summary = queue.summary ?? {};
  const blocked = summary.blocked_action_count ?? 0;
  const ready = summary.ready_action_count ?? 0;
  const status = blocked > 0 ? "pending" : ready > 0 ? "ready" : "passed";
  return {
    stage_id: "protected_delivery_queue",
    label: "Protected Delivery Queue",
    status,
    message: `${summary.delivery_action_count ?? 0} protected delivery action(s), ${blocked} blocked, ${ready} ready.`,
    source_path: source?.path ?? null,
    metrics: {
      delivery_action_count: summary.delivery_action_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      blocked_action_count: blocked,
      pending_approval_count: summary.pending_approval_count ?? 0,
      blocked_by_gate_count: summary.blocked_by_gate_count ?? 0,
      ready_action_count: ready,
    },
  };
}

function buildMatterCockpitStage(cockpit, source) {
  if (!cockpit) return missingStage("matter_cockpit", "Matter Cockpit", source);
  const summary = cockpit.summary ?? {};
  const blocked = summary.blocked_matter_count ?? 0;
  const pending = summary.pending_review_matter_count ?? 0;
  const ready = summary.ready_matter_count ?? 0;
  const status = blocked > 0 ? "blocked" : pending > 0 ? "pending" : ready > 0 ? "ready" : "passed";
  return {
    stage_id: "matter_cockpit",
    label: "Matter Cockpit",
    status,
    message: `${summary.matter_count ?? 0} matter/project record(s), ${blocked} blocked, ${pending} pending review.`,
    source_path: source?.path ?? null,
    metrics: {
      matter_count: summary.matter_count ?? 0,
      blocked_matter_count: blocked,
      pending_review_matter_count: pending,
      ready_matter_count: ready,
      resource_count: summary.resource_count ?? 0,
      evidence_count: summary.evidence_count ?? 0,
      output_artifact_count: summary.output_artifact_count ?? 0,
      delivery_action_count: summary.delivery_action_count ?? 0,
      pending_approval_count: summary.pending_approval_count ?? 0,
    },
  };
}

function buildDeliveryExecutionDraftStage(draft, source) {
  if (!draft) return missingStage("delivery_execution_draft", "Delivery Execution Draft", source);
  const summary = draft.summary ?? {};
  const ready = summary.ready_candidate_count ?? 0;
  const packets = summary.execution_packet_count ?? 0;
  const status = ready > 0 ? "ready" : "passed";
  return {
    stage_id: "delivery_execution_draft",
    label: "Delivery Execution Draft",
    status,
    message: `${ready} ready candidate(s) grouped into ${packets} draft packet(s); execution remains manual.`,
    source_path: source?.path ?? null,
    metrics: {
      execution_mode: draft.execution_mode ?? "unknown",
      ready_candidate_count: ready,
      blocked_candidate_count: summary.blocked_candidate_count ?? 0,
      execution_packet_count: packets,
      manual_execution_required_count: summary.manual_execution_required_count ?? 0,
      final_check_required_count: summary.final_check_required_count ?? 0,
    },
  };
}

function buildDeliveryReceiptLedgerStage(ledger, source) {
  if (!ledger) return missingStage("delivery_receipt_ledger", "Delivery Receipt Ledger", source);
  const summary = ledger.summary ?? {};
  const errors = summary.receipt_error_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const delivered = summary.delivered_artifact_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : delivered > 0 ? "passed" : "pending";
  return {
    stage_id: "delivery_receipt_ledger",
    label: "Delivery Receipt Ledger",
    status,
    message: `${summary.applied_receipt_count ?? 0} receipt(s) applied, ${pending} pending, ${delivered} delivered artifact(s) recorded.`,
    source_path: source?.path ?? null,
    metrics: {
      execution_draft_packet_count: summary.execution_draft_packet_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      pending_receipt_count: pending,
      delivered_packet_count: summary.delivered_packet_count ?? 0,
      delivered_artifact_count: delivered,
      audit_event_count: summary.audit_event_count ?? 0,
      receipt_error_count: errors,
    },
  };
}

function buildPostDeliveryReconciliationStage(reconciliation, source) {
  if (!reconciliation) return missingStage("post_delivery_reconciliation", "Post-Delivery Reconciliation", source);
  const summary = reconciliation.summary ?? {};
  const errors = summary.receipt_error_count ?? 0;
  const blocked = summary.blocked_matter_count ?? 0;
  const outstanding = summary.outstanding_receipt_count ?? 0;
  const deliveredArtifacts = summary.delivered_artifact_count ?? 0;
  const deliveredMatters = summary.delivered_matter_count ?? 0;
  const status = errors > 0 || blocked > 0
    ? "attention"
    : outstanding > 0
      ? "pending"
      : deliveredArtifacts > 0
        ? "passed"
        : "pending";
  return {
    stage_id: "post_delivery_reconciliation",
    label: "Post-Delivery Reconciliation",
    status,
    message: `${deliveredMatters} delivered matter(s), ${deliveredArtifacts} delivered artifact(s), ${outstanding} outstanding receipt(s).`,
    source_path: source?.path ?? null,
    metrics: {
      reconciled_matter_count: summary.reconciled_matter_count ?? 0,
      delivered_matter_count: deliveredMatters,
      ready_matter_count: summary.ready_matter_count ?? 0,
      awaiting_receipt_matter_count: summary.awaiting_receipt_matter_count ?? 0,
      blocked_matter_count: blocked,
      delivered_artifact_count: deliveredArtifacts,
      outstanding_receipt_count: outstanding,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      receipt_error_count: errors,
    },
  };
}

function buildDeliveryCloseoutQueueStage(queue, source) {
  if (!queue) return missingStage("delivery_closeout_queue", "Delivery Closeout Queue", source);
  const summary = queue.summary ?? {};
  const blocked = summary.blocked_closeout_count ?? 0;
  const awaiting = summary.awaiting_execution_count ?? 0;
  const items = summary.closeout_item_count ?? 0;
  const status = blocked > 0 ? "attention" : awaiting > 0 ? "pending" : "passed";
  return {
    stage_id: "delivery_closeout_queue",
    label: "Delivery Closeout Queue",
    status,
    message: `${items} closeout item(s), ${awaiting} awaiting manual execution, ${blocked} blocked.`,
    source_path: source?.path ?? null,
    metrics: {
      closeout_item_count: items,
      awaiting_execution_count: awaiting,
      blocked_closeout_count: blocked,
      receipt_form_count: summary.receipt_form_count ?? 0,
      high_priority_count: summary.high_priority_count ?? 0,
      artifact_count: summary.artifact_count ?? 0,
    },
  };
}

function buildCloseoutReceiptValidationStage(validation, source) {
  if (!validation) return missingStage("closeout_receipt_validation", "Closeout Receipt Validation", source);
  const summary = validation.summary ?? {};
  const errors = summary.error_count ?? 0;
  const invalid = summary.invalid_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const ready = summary.ready_to_apply_count ?? 0;
  const status = errors > 0 || invalid > 0
    ? "attention"
    : pending > 0 || missing > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "closeout_receipt_validation",
    label: "Closeout Receipt Validation",
    status,
    message: `${ready} ready receipt(s), ${pending} pending, ${invalid} invalid, ${missing} missing.`,
    source_path: source?.path ?? null,
    metrics: {
      closeout_item_count: summary.closeout_item_count ?? 0,
      receipt_count: summary.receipt_count ?? 0,
      ready_to_apply_count: ready,
      pending_receipt_count: pending,
      missing_receipt_count: missing,
      invalid_receipt_count: invalid,
      unknown_packet_count: summary.unknown_packet_count ?? 0,
      error_count: errors,
      fully_ready_to_apply: summary.fully_ready_to_apply ?? false,
    },
  };
}

function buildCloseoutReceiptApplicationStage(application, source) {
  if (!application) return missingStage("closeout_receipt_application", "Closeout Receipt Application", source);
  const summary = application.summary ?? {};
  const status = application.application_status === "blocked_missing_validation" || application.application_status === "blocked_validation_errors"
    ? "attention"
    : application.application_status === "nothing_to_apply"
      ? (summary.pending_receipt_count > 0 ? "pending" : "passed")
      : "passed";
  return {
    stage_id: "closeout_receipt_application",
    label: "Closeout Receipt Application",
    status,
    message: `${summary.applied_receipt_count ?? 0} applied receipt(s), ${summary.delivered_artifact_count ?? 0} delivered artifact(s), status ${application.application_status}.`,
    source_path: source?.path ?? null,
    metrics: {
      application_status: application.application_status,
      safe_to_apply: application.safe_to_apply ?? false,
      ready_receipt_count: summary.ready_receipt_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      delivered_artifact_count: summary.delivered_artifact_count ?? 0,
      validation_error_count: summary.validation_error_count ?? 0,
      receipt_error_count: summary.receipt_error_count ?? 0,
    },
  };
}

function buildControlPlanePipelineStage(pipeline, source) {
  if (!pipeline) return missingStage("control_plane_pipeline", "Control Plane Pipeline", source);
  const summary = pipeline.summary ?? {};
  const failed = summary.failed_step_count ?? 0;
  const missing = summary.missing_artifact_count ?? 0;
  const skipped = summary.skipped_step_count ?? 0;
  const status = failed > 0 || missing > 0
    ? "attention"
    : skipped > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "control_plane_pipeline",
    label: "Control Plane Pipeline",
    status,
    message: `${summary.passed_step_count ?? 0}/${summary.step_count ?? 0} step(s) passed, ${failed} failed, ${missing} missing artifact(s).`,
    source_path: source?.path ?? null,
    metrics: {
      overall_status: summary.overall_status ?? "unknown",
      step_count: summary.step_count ?? 0,
      passed_step_count: summary.passed_step_count ?? 0,
      failed_step_count: failed,
      skipped_step_count: skipped,
      missing_artifact_count: missing,
      total_duration_ms: summary.total_duration_ms ?? 0,
    },
  };
}

function buildControlPlaneLoopStage(loop, source) {
  if (!loop) return missingStage("control_plane_loop", "Control Plane Loop", source);
  const summary = loop.summary ?? {};
  const failed = summary.failed_step_count ?? 0;
  const missing = summary.missing_artifact_count ?? 0;
  const skipped = summary.skipped_step_count ?? 0;
  const status = failed > 0 || missing > 0
    ? "attention"
    : skipped > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "control_plane_loop",
    label: "Control Plane Loop",
    status,
    message: `${summary.passed_step_count ?? 0}/${summary.step_count ?? 0} loop step(s) passed, ${failed} failed, ${missing} missing artifact(s).`,
    source_path: source?.path ?? null,
    metrics: {
      loop_status: loop.loop_status ?? summary.overall_status ?? "unknown",
      step_count: summary.step_count ?? 0,
      passed_step_count: summary.passed_step_count ?? 0,
      failed_step_count: failed,
      skipped_step_count: skipped,
      missing_artifact_count: missing,
      total_duration_ms: summary.total_duration_ms ?? 0,
    },
  };
}

function buildControlPlaneGoalCheckpointStage(checkpoint, source) {
  if (!checkpoint) return missingStage("control_plane_goal_checkpoint", "Control Plane Goal Checkpoint", source);
  const summary = checkpoint.summary ?? {};
  const status = checkpoint.checkpoint_status === "passed"
    ? "passed"
    : checkpoint.checkpoint_status === "blocked" || checkpoint.checkpoint_status === "incomplete"
      ? "attention"
      : "pending";
  return {
    stage_id: "control_plane_goal_checkpoint",
    label: "Control Plane Goal Checkpoint",
    status,
    message: `${summary.passed_item_count ?? 0}/${summary.checkpoint_item_count ?? 0} goal checkpoint item(s) passed; status ${checkpoint.checkpoint_status}.`,
    source_path: source?.path ?? null,
    metrics: {
      checkpoint_status: checkpoint.checkpoint_status,
      checkpoint_item_count: summary.checkpoint_item_count ?? 0,
      passed_item_count: summary.passed_item_count ?? 0,
      attention_item_count: summary.attention_item_count ?? 0,
      blocked_item_count: summary.blocked_item_count ?? 0,
      missing_item_count: summary.missing_item_count ?? 0,
      latest_roadmap_phase: summary.latest_roadmap_phase ?? null,
    },
  };
}

function buildContractInventoryStage(inventory, source) {
  if (!inventory) return missingStage("contract_inventory", "Contract Inventory", source);
  const summary = inventory.summary ?? {};
  const status = summary.validation_error_count > 0 || inventory.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "contract_inventory",
    label: "Contract Inventory",
    status,
    message: `${summary.schema_count ?? 0} schema(s), ${summary.package_script_count ?? 0} package script(s), ${summary.dashboard_source_count ?? 0} dashboard source(s), ${summary.api_route_count ?? 0} API route(s).`,
    source_path: source?.path ?? null,
    metrics: {
      inventory_status: summary.inventory_status ?? "unknown",
      schema_count: summary.schema_count ?? 0,
      parsed_schema_count: summary.parsed_schema_count ?? 0,
      schema_parse_error_count: summary.schema_parse_error_count ?? 0,
      package_script_count: summary.package_script_count ?? 0,
      package_script_with_file_ref_count: summary.package_script_with_file_ref_count ?? 0,
      loop_output_contract_count: summary.loop_output_contract_count ?? 0,
      loop_expected_artifact_count: summary.loop_expected_artifact_count ?? 0,
      dashboard_source_count: summary.dashboard_source_count ?? 0,
      dashboard_source_with_schema_count: summary.dashboard_source_with_schema_count ?? 0,
      api_route_count: summary.api_route_count ?? 0,
      artifact_contract_count: summary.artifact_contract_count ?? 0,
      artifact_contract_with_schema_count: summary.artifact_contract_with_schema_count ?? 0,
      doc_count: summary.doc_count ?? 0,
      inventory_item_count: summary.inventory_item_count ?? 0,
      owner_mapped_item_count: summary.owner_mapped_item_count ?? 0,
      owner_area_count: summary.owner_area_count ?? 0,
      validation_error_count: summary.validation_error_count ?? inventory.validation?.errors?.length ?? 0,
    },
  };
}

function buildContractDependencyMapStage(dependencyMap, source) {
  if (!dependencyMap) return missingStage("contract_dependency_map", "Contract Dependency Map", source);
  const summary = dependencyMap.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.direction_violation_count > 0 || dependencyMap.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "contract_dependency_map",
    label: "Contract Dependency Map",
    status,
    message: `${summary.node_count ?? 0} node(s), ${summary.edge_count ?? 0} edge(s), ${summary.breaking_change_risk_count ?? 0} breaking-change risk(s).`,
    source_path: source?.path ?? null,
    metrics: {
      map_status: summary.map_status ?? "unknown",
      source_inventory_status: summary.source_inventory_status ?? "unknown",
      node_count: summary.node_count ?? 0,
      edge_count: summary.edge_count ?? 0,
      schema_dependency_edge_count: summary.schema_dependency_edge_count ?? 0,
      script_dependency_edge_count: summary.script_dependency_edge_count ?? 0,
      loop_artifact_dependency_edge_count: summary.loop_artifact_dependency_edge_count ?? 0,
      dashboard_dependency_edge_count: summary.dashboard_dependency_edge_count ?? 0,
      api_dependency_edge_count: summary.api_dependency_edge_count ?? 0,
      owner_dependency_count: summary.owner_dependency_count ?? 0,
      cross_owner_edge_count: summary.cross_owner_edge_count ?? 0,
      direction_violation_count: summary.direction_violation_count ?? 0,
      breaking_change_risk_count: summary.breaking_change_risk_count ?? 0,
      high_risk_count: summary.high_risk_count ?? 0,
      medium_risk_count: summary.medium_risk_count ?? 0,
      low_risk_count: summary.low_risk_count ?? 0,
      validation_error_count: summary.validation_error_count ?? dependencyMap.validation?.errors?.length ?? 0,
    },
  };
}

function buildSchemaVersioningRulesStage(rules, source) {
  if (!rules) return missingStage("schema_versioning_rules", "Schema Versioning Rules", source);
  const summary = rules.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.non_compliant_schema_count > 0 || rules.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "schema_versioning_rules",
    label: "Schema Versioning Rules",
    status,
    message: `${summary.versioned_schema_count ?? 0}/${summary.schema_count ?? 0} schema(s) versioned, ${summary.legacy_exception_count ?? 0} legacy exception(s), ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      guideline_status: summary.guideline_status ?? "unknown",
      source_inventory_status: summary.source_inventory_status ?? "unknown",
      schema_count: summary.schema_count ?? 0,
      parsed_schema_count: summary.parsed_schema_count ?? 0,
      versioned_schema_count: summary.versioned_schema_count ?? 0,
      legacy_exception_count: summary.legacy_exception_count ?? 0,
      non_compliant_schema_count: summary.non_compliant_schema_count ?? 0,
      optional_addition_compatible_count: summary.optional_addition_compatible_count ?? 0,
      closed_world_schema_count: summary.closed_world_schema_count ?? 0,
      deprecated_field_count: summary.deprecated_field_count ?? 0,
      migration_manifest_rule_count: summary.migration_manifest_rule_count ?? 0,
      deprecation_rule_count: summary.deprecation_rule_count ?? 0,
      optional_addition_rule_count: summary.optional_addition_rule_count ?? 0,
      unknown_field_preservation_count: summary.unknown_field_preservation_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? rules.validation?.errors?.length ?? 0,
    },
  };
}

function buildSchemaMigrationManifestStage(manifest, source) {
  if (!manifest) return missingStage("schema_migration_manifest", "Schema Migration Manifest", source);
  const summary = manifest.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || summary.missing_legacy_exception_count > 0 || manifest.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "schema_migration_manifest",
    label: "Schema Migration Manifest",
    status,
    message: `${summary.manifest_count ?? 0} migration manifest(s), core/pack/index ${summary.core_migration_count ?? 0}/${summary.pack_migration_count ?? 0}/${summary.index_migration_count ?? 0}, ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      migration_manifest_status: summary.migration_manifest_status ?? "unknown",
      source_guideline_status: summary.source_guideline_status ?? "unknown",
      manifest_count: summary.manifest_count ?? 0,
      migration_record_count: summary.migration_record_count ?? 0,
      declared_manifest_count: summary.declared_manifest_count ?? 0,
      planned_record_count: summary.planned_record_count ?? 0,
      not_run_dry_run_record_count: summary.not_run_dry_run_record_count ?? 0,
      core_migration_count: summary.core_migration_count ?? 0,
      pack_migration_count: summary.pack_migration_count ?? 0,
      index_migration_count: summary.index_migration_count ?? 0,
      data_migration_step_count: summary.data_migration_step_count ?? 0,
      index_migration_step_count: summary.index_migration_step_count ?? 0,
      dry_run_command_count: summary.dry_run_command_count ?? 0,
      rollback_note_count: summary.rollback_note_count ?? 0,
      validation_command_count: summary.validation_command_count ?? 0,
      separated_data_index_count: summary.separated_data_index_count ?? 0,
      legacy_exception_count: summary.legacy_exception_count ?? 0,
      legacy_exception_covered_count: summary.legacy_exception_covered_count ?? 0,
      missing_legacy_exception_count: summary.missing_legacy_exception_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? manifest.validation?.errors?.length ?? 0,
    },
  };
}

function buildContractGoldenFixturesStage(fixtures, source) {
  if (!fixtures) return missingStage("contract_golden_fixtures", "Contract Golden Fixtures", source);
  const summary = fixtures.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || summary.schema_invalid_fixture_count > 0 || summary.missing_artifact_count > 0 || fixtures.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "contract_golden_fixtures",
    label: "Contract Golden Fixtures",
    status,
    message: `${summary.schema_valid_fixture_count ?? 0}/${summary.fixture_count ?? 0} fixture(s) schema-valid, ${summary.locked_regression_hash_count ?? 0} regression hash(es), ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      golden_fixture_status: summary.golden_fixture_status ?? "unknown",
      fixture_count: summary.fixture_count ?? 0,
      required_fixture_count: summary.required_fixture_count ?? 0,
      locked_fixture_count: summary.locked_fixture_count ?? 0,
      blocked_fixture_count: summary.blocked_fixture_count ?? 0,
      schema_valid_fixture_count: summary.schema_valid_fixture_count ?? 0,
      schema_invalid_fixture_count: summary.schema_invalid_fixture_count ?? 0,
      regression_hash_count: summary.regression_hash_count ?? 0,
      locked_regression_hash_count: summary.locked_regression_hash_count ?? 0,
      missing_artifact_count: summary.missing_artifact_count ?? 0,
      schema_version_present_count: summary.schema_version_present_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? fixtures.validation?.errors?.length ?? 0,
    },
  };
}

function buildContractValidationSuiteStage(suite, source) {
  if (!suite) return missingStage("contract_validation_suite", "Contract Validation Suite", source);
  const summary = suite.summary ?? {};
  const status = summary.validation_error_count > 0 || summary.failed_validation_item_count > 0 || summary.regression_failed_count > 0 || summary.missing_package_script_count > 0 || summary.roadmap_missing_count > 0 || suite.validation?.valid === false
    ? "attention"
    : "passed";
  return {
    stage_id: "contract_validation_suite",
    label: "Contract Validation Suite",
    status,
    message: `${summary.regression_passed_count ?? 0}/${summary.fixture_count ?? 0} fixture regression(s) passed, ${summary.missing_package_script_count ?? 0} missing script(s), ${summary.validation_error_count ?? 0} validation error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      validation_suite_status: summary.validation_suite_status ?? "unknown",
      fixture_count: summary.fixture_count ?? 0,
      validated_fixture_count: summary.validated_fixture_count ?? 0,
      schema_valid_fixture_count: summary.schema_valid_fixture_count ?? 0,
      schema_invalid_fixture_count: summary.schema_invalid_fixture_count ?? 0,
      regression_passed_count: summary.regression_passed_count ?? 0,
      regression_failed_count: summary.regression_failed_count ?? 0,
      content_hash_match_count: summary.content_hash_match_count ?? 0,
      content_hash_mismatch_count: summary.content_hash_mismatch_count ?? 0,
      schema_hash_match_count: summary.schema_hash_match_count ?? 0,
      schema_hash_mismatch_count: summary.schema_hash_mismatch_count ?? 0,
      required_package_script_count: summary.required_package_script_count ?? 0,
      present_package_script_count: summary.present_package_script_count ?? 0,
      missing_package_script_count: summary.missing_package_script_count ?? 0,
      roadmap_declared_count: summary.roadmap_declared_count ?? 0,
      roadmap_missing_count: summary.roadmap_missing_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      failed_validation_item_count: summary.failed_validation_item_count ?? 0,
      validation_error_count: summary.validation_error_count ?? suite.validation?.errors?.length ?? 0,
    },
  };
}

function buildControlPlaneAuditTrailStage(auditTrail, source) {
  if (!auditTrail) return missingStage("control_plane_audit_trail", "Control Plane Audit Trail", source);
  const summary = auditTrail.summary ?? {};
  const status = auditTrail.audit_status === "missing_sources" || auditTrail.audit_status === "partial"
    ? "attention"
    : "passed";
  return {
    stage_id: "control_plane_audit_trail",
    label: "Control Plane Audit Trail",
    status,
    message: `${summary.audit_event_count ?? 0} audit event(s), ${summary.missing_source_count ?? 0} missing source(s), status ${auditTrail.audit_status}.`,
    source_path: source?.path ?? null,
    metrics: {
      audit_status: auditTrail.audit_status,
      source_count: summary.source_count ?? 0,
      available_source_count: summary.available_source_count ?? 0,
      missing_source_count: summary.missing_source_count ?? 0,
      audit_event_count: summary.audit_event_count ?? 0,
      duplicate_event_count: summary.duplicate_event_count ?? 0,
      protected_action_event_count: summary.protected_action_event_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
      human_actor_event_count: summary.human_actor_event_count ?? 0,
    },
  };
}

function buildControlPlaneHealthStage(health, source) {
  if (!health) return missingStage("control_plane_health", "Control Plane Health", source);
  const summary = health.summary ?? {};
  const status = health.overall_health === "healthy"
    ? "passed"
    : health.overall_health === "attention"
      ? "attention"
      : "blocked";
  return {
    stage_id: "control_plane_health",
    label: "Control Plane Health",
    status,
    message: `${summary.passed_check_count ?? 0}/${summary.check_count ?? 0} health check(s) passed, overall ${health.overall_health}.`,
    source_path: source?.path ?? null,
    metrics: {
      overall_health: health.overall_health,
      check_count: summary.check_count ?? 0,
      passed_check_count: summary.passed_check_count ?? 0,
      attention_check_count: summary.attention_check_count ?? 0,
      blocked_check_count: summary.blocked_check_count ?? 0,
      missing_check_count: summary.missing_check_count ?? 0,
      action_item_count: summary.action_item_count ?? 0,
    },
  };
}

function buildControlPlaneActionPlanStage(actionPlan, source) {
  if (!actionPlan) return missingStage("control_plane_action_plan", "Control Plane Action Plan", source);
  const summary = actionPlan.summary ?? {};
  const status = actionPlan.plan_status === "clear"
    ? "passed"
    : actionPlan.plan_status === "blocked"
      ? "blocked"
      : "pending";
  return {
    stage_id: "control_plane_action_plan",
    label: "Control Plane Action Plan",
    status,
    message: `${summary.plan_item_count ?? 0} plan item(s), ${summary.waiting_for_human_count ?? 0} waiting for human, ${summary.ready_to_run_count ?? 0} ready to run.`,
    source_path: source?.path ?? null,
    metrics: {
      plan_status: actionPlan.plan_status,
      plan_item_count: summary.plan_item_count ?? 0,
      blocked_item_count: summary.blocked_item_count ?? 0,
      waiting_for_human_count: summary.waiting_for_human_count ?? 0,
      ready_to_run_count: summary.ready_to_run_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      human_required_count: summary.human_required_count ?? 0,
    },
  };
}

function buildControlPlaneHumanGatesStage(humanGates, source) {
  if (!humanGates) return missingStage("control_plane_human_gates", "Control Plane Human Gates", source);
  const summary = humanGates.summary ?? {};
  const gateItems = summary.gate_item_count ?? 0;
  const protectedActions = summary.protected_action_count ?? 0;
  const status = gateItems === 0
    ? "passed"
    : protectedActions > 0 || (summary.blocked_count ?? 0) > 0
      ? "blocked"
      : "pending";
  return {
    stage_id: "control_plane_human_gates",
    label: "Control Plane Human Gates",
    status,
    message: `${gateItems} human gate item(s), ${summary.evidence_decision_count ?? 0} evidence decision(s), ${protectedActions} protected action(s).`,
    source_path: source?.path ?? null,
    metrics: {
      gate_item_count: gateItems,
      waiting_for_human_count: summary.waiting_for_human_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      protected_action_count: protectedActions,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      auto_execute_allowed_count: summary.auto_execute_allowed_count ?? 0,
    },
  };
}

function buildControlPlaneHumanGateReceiptsStage(receipts, source) {
  if (!receipts) return missingStage("control_plane_human_gate_receipts", "Control Plane Human Gate Receipts", source);
  const summary = receipts.summary ?? {};
  const status = receipts.receipt_status === "clear"
    ? "passed"
    : receipts.receipt_status === "blocked_missing_human_gates"
      ? "blocked"
      : "pending";
  return {
    stage_id: "control_plane_human_gate_receipts",
    label: "Control Plane Human Gate Receipts",
    status,
    message: `${summary.receipt_draft_count ?? 0} human gate receipt draft(s), ${summary.evidence_decision_receipt_count ?? 0} evidence decision(s), ${summary.protected_receipt_count ?? 0} protected.`,
    source_path: source?.path ?? null,
    metrics: {
      receipt_status: receipts.receipt_status,
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_draft_count: summary.receipt_draft_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      human_receipt_count: summary.human_receipt_count ?? 0,
      protected_receipt_count: summary.protected_receipt_count ?? 0,
      evidence_decision_receipt_count: summary.evidence_decision_receipt_count ?? 0,
      command_receipt_count: summary.command_receipt_count ?? 0,
    },
  };
}

function buildHumanReviewPacketLedgerStage(ledger, source) {
  if (!ledger) return missingStage("human_review_packet_ledger", "Human Review Packet Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_packet_count ?? 0;
  const pending = summary.pending_packet_count ?? 0;
  const status = ledger.review_status === "blocked" || errorCount > 0 || blocked > 0
    ? "blocked"
    : pending > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_packet_ledger",
    label: "Human Review Packet Ledger",
    status,
    message: `${summary.review_packet_count ?? 0} review packet(s), ${summary.review_item_count ?? 0} item(s), ${pending} pending packet(s).`,
    source_path: source?.path ?? null,
    metrics: {
      review_status: ledger.review_status ?? "unknown",
      review_packet_count: summary.review_packet_count ?? 0,
      review_item_count: summary.review_item_count ?? 0,
      pending_packet_count: pending,
      blocked_packet_count: blocked,
      protected_packet_count: summary.protected_packet_count ?? 0,
      human_required_packet_count: summary.human_required_packet_count ?? 0,
      evidence_decision_packet_count: summary.evidence_decision_packet_count ?? 0,
      command_packet_count: summary.command_packet_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewAgendaStage(agenda, source) {
  if (!agenda) return missingStage("human_review_agenda", "Human Review Agenda", source);
  const summary = agenda.summary ?? {};
  const errorCount = summary.validation_error_count ?? agenda.validation?.errors?.length ?? 0;
  const blocked = summary.blocked_agenda_item_count ?? 0;
  const pending = summary.pending_agenda_item_count ?? 0;
  const status = agenda.agenda_status === "blocked" || errorCount > 0 || blocked > 0
    ? "blocked"
    : pending > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_agenda",
    label: "Human Review Agenda",
    status,
    message: `${summary.agenda_item_count ?? 0} agenda item(s), ${summary.actor_count ?? 0} actor section(s), ${summary.decision_template_row_count ?? 0} decision row(s).`,
    source_path: source?.path ?? null,
    metrics: {
      agenda_status: agenda.agenda_status ?? "unknown",
      agenda_item_count: summary.agenda_item_count ?? 0,
      agenda_section_count: summary.agenda_section_count ?? 0,
      actor_count: summary.actor_count ?? 0,
      review_item_count: summary.review_item_count ?? 0,
      pending_agenda_item_count: pending,
      blocked_agenda_item_count: blocked,
      protected_action_count: summary.protected_action_count ?? 0,
      command_count: summary.command_count ?? 0,
      decision_template_row_count: summary.decision_template_row_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewAgendaReceiptIntakeStage(intake, source) {
  if (!intake) return missingStage("human_review_agenda_receipt_intake", "Human Review Agenda Receipt Intake", source);
  const summary = intake.summary ?? {};
  const errorCount = summary.validation_error_count ?? intake.validation?.errors?.length ?? 0;
  const status = intake.intake_status === "blocked" || errorCount > 0
    ? "blocked"
    : (summary.pending_receipt_count ?? 0) > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_agenda_receipt_intake",
    label: "Human Review Agenda Receipt Intake",
    status,
    message: `${summary.receipt_row_count ?? 0} receipt row(s), ${summary.pending_receipt_count ?? 0} pending, ${summary.ready_for_validation_count ?? 0} ready for validation.`,
    source_path: source?.path ?? null,
    metrics: {
      intake_status: intake.intake_status ?? "unknown",
      intake_item_count: summary.intake_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      invalid_template_row_count: summary.invalid_template_row_count ?? 0,
      missing_template_row_count: summary.missing_template_row_count ?? 0,
      unknown_requirement_count: summary.unknown_requirement_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      human_required_count: summary.human_required_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewReceiptWorkspaceStage(workspace, source) {
  if (!workspace) return missingStage("human_review_receipt_workspace", "Human Review Receipt Workspace", source);
  const summary = workspace.summary ?? {};
  const errorCount = summary.validation_error_count ?? workspace.validation?.errors?.length ?? 0;
  const status = workspace.workspace_status === "blocked" || errorCount > 0 || (summary.blocked_workspace_count ?? 0) > 0
    ? "blocked"
    : (summary.pending_receipt_count ?? 0) > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_receipt_workspace",
    label: "Human Review Receipt Workspace",
    status,
    message: `${summary.actor_workspace_count ?? 0} actor workspace(s), ${summary.receipt_row_count ?? 0} receipt row(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      workspace_status: workspace.workspace_status ?? "unknown",
      actor_workspace_count: summary.actor_workspace_count ?? 0,
      workspace_entry_count: summary.workspace_entry_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      human_required_count: summary.human_required_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      editable_file_count: summary.editable_file_count ?? 0,
      blocked_workspace_count: summary.blocked_workspace_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewReceiptWorkspaceMergeStage(merge, source) {
  if (!merge) return missingStage("human_review_receipt_workspace_merge", "Human Review Receipt Workspace Merge", source);
  const summary = merge.summary ?? {};
  const errorCount = summary.validation_error_count ?? merge.validation?.errors?.length ?? 0;
  const blocked = errorCount > 0
    || (summary.missing_receipt_count ?? 0) > 0
    || (summary.duplicate_receipt_count ?? 0) > 0
    || (summary.unknown_receipt_count ?? 0) > 0
    || (summary.invalid_actor_receipt_count ?? 0) > 0;
  const status = merge.merge_status === "blocked" || blocked
    ? "blocked"
    : (summary.pending_receipt_count ?? 0) > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_receipt_workspace_merge",
    label: "Human Review Receipt Workspace Merge",
    status,
    message: `${summary.actor_input_count ?? 0} actor input(s), ${summary.receipt_row_count ?? 0} merged receipt row(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      merge_status: merge.merge_status ?? "unknown",
      actor_input_count: summary.actor_input_count ?? 0,
      available_actor_input_count: summary.available_actor_input_count ?? 0,
      expected_receipt_count: summary.expected_receipt_count ?? 0,
      merge_item_count: summary.merge_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      duplicate_receipt_count: summary.duplicate_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      invalid_actor_receipt_count: summary.invalid_actor_receipt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewContextBundleStage(bundle, source) {
  if (!bundle) return missingStage("human_review_context_bundle", "Human Review Context Bundle", source);
  const summary = bundle.summary ?? {};
  const errorCount = summary.validation_error_count ?? bundle.validation?.errors?.length ?? 0;
  const attention = summary.attention_context_count ?? 0;
  const status = bundle.bundle_status === "blocked" || errorCount > 0
    ? "blocked"
    : attention > 0 || bundle.bundle_status === "attention"
      ? "attention"
      : (summary.pending_receipt_count ?? 0) > 0
        ? "pending"
        : "passed";
  return {
    stage_id: "human_review_context_bundle",
    label: "Human Review Context Bundle",
    status,
    message: `${summary.actor_context_bundle_count ?? 0} actor bundle(s), ${summary.context_card_count ?? 0} context card(s), ${summary.pending_receipt_count ?? 0} pending receipt(s).`,
    source_path: source?.path ?? null,
    metrics: {
      bundle_status: bundle.bundle_status ?? "unknown",
      actor_context_bundle_count: summary.actor_context_bundle_count ?? 0,
      context_card_count: summary.context_card_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_context_count: summary.ready_context_count ?? 0,
      attention_context_count: attention,
      gate_context_count: summary.gate_context_count ?? 0,
      plan_context_count: summary.plan_context_count ?? 0,
      evidence_context_count: summary.evidence_context_count ?? 0,
      approval_context_count: summary.approval_context_count ?? 0,
      matter_context_count: summary.matter_context_count ?? 0,
      protected_action_context_count: summary.protected_action_context_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewDecisionRegisterStage(register, source) {
  if (!register) return missingStage("human_review_decision_register", "Human Review Decision Register", source);
  const summary = register.summary ?? {};
  const errorCount = summary.validation_error_count ?? register.validation?.errors?.length ?? 0;
  const invalid = (summary.invalid_context_count ?? 0) + (summary.invalid_decision_count ?? 0);
  const status = register.register_status === "blocked" || errorCount > 0
    ? "blocked"
    : invalid > 0 || register.register_status === "attention"
      ? "attention"
      : (summary.pending_decision_count ?? 0) > 0
        ? "pending"
        : "passed";
  return {
    stage_id: "human_review_decision_register",
    label: "Human Review Decision Register",
    status,
    message: `${summary.actor_decision_register_count ?? 0} actor register(s), ${summary.decision_row_count ?? 0} decision row(s), ${summary.pending_decision_count ?? 0} pending decision(s).`,
    source_path: source?.path ?? null,
    metrics: {
      register_status: register.register_status ?? "unknown",
      actor_decision_register_count: summary.actor_decision_register_count ?? 0,
      decision_row_count: summary.decision_row_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_decision_count: summary.pending_decision_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      invalid_context_count: summary.invalid_context_count ?? 0,
      invalid_decision_count: summary.invalid_decision_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewDecisionRegisterMergeStage(merge, source) {
  if (!merge) return missingStage("human_review_decision_register_merge", "Human Review Decision Register Merge", source);
  const summary = merge.summary ?? {};
  const errorCount = summary.validation_error_count ?? merge.validation?.errors?.length ?? 0;
  const blocked = errorCount > 0
    || (summary.missing_receipt_count ?? 0) > 0
    || (summary.duplicate_receipt_count ?? 0) > 0
    || (summary.unknown_receipt_count ?? 0) > 0
    || (summary.invalid_decision_receipt_count ?? 0) > 0;
  const status = merge.merge_status === "blocked" || blocked
    ? "blocked"
    : (summary.pending_receipt_count ?? 0) > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_decision_register_merge",
    label: "Human Review Decision Register Merge",
    status,
    message: `${summary.actor_input_count ?? 0} actor input(s), ${summary.receipt_row_count ?? 0} merged decision receipt row(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      merge_status: merge.merge_status ?? "unknown",
      actor_input_count: summary.actor_input_count ?? 0,
      available_actor_input_count: summary.available_actor_input_count ?? 0,
      expected_receipt_count: summary.expected_receipt_count ?? 0,
      merge_item_count: summary.merge_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      duplicate_receipt_count: summary.duplicate_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      invalid_decision_receipt_count: summary.invalid_decision_receipt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewValidationFeedbackStage(feedback, source) {
  if (!feedback) return missingStage("human_review_validation_feedback", "Human Review Validation Feedback", source);
  const summary = feedback.summary ?? {};
  const errorCount = summary.validation_error_count ?? feedback.validation?.errors?.length ?? 0;
  const status = feedback.feedback_status === "blocked" || errorCount > 0
    ? "blocked"
    : feedback.feedback_status === "attention" || (summary.needs_correction_count ?? 0) > 0
      ? "attention"
      : (summary.pending_receipt_count ?? 0) > 0
        ? "pending"
        : "passed";
  return {
    stage_id: "human_review_validation_feedback",
    label: "Human Review Validation Feedback",
    status,
    message: `${summary.actor_feedback_count ?? 0} actor feedback bundle(s), ${summary.feedback_item_count ?? 0} feedback item(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      feedback_status: feedback.feedback_status ?? "unknown",
      actor_feedback_count: summary.actor_feedback_count ?? 0,
      feedback_item_count: summary.feedback_item_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      needs_correction_count: summary.needs_correction_count ?? 0,
      missing_validation_count: summary.missing_validation_count ?? 0,
      invalid_receipt_count: summary.invalid_receipt_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCorrectionWorkspaceStage(workspace, source) {
  if (!workspace) return missingStage("human_review_correction_workspace", "Human Review Correction Workspace", source);
  const summary = workspace.summary ?? {};
  const errorCount = summary.validation_error_count ?? workspace.validation?.errors?.length ?? 0;
  const status = workspace.workspace_status === "blocked" || errorCount > 0
    ? "blocked"
    : workspace.workspace_status === "attention" || (summary.needs_correction_count ?? 0) > 0
      ? "attention"
      : (summary.pending_decision_count ?? 0) > 0
        ? "pending"
        : "passed";
  return {
    stage_id: "human_review_correction_workspace",
    label: "Human Review Correction Workspace",
    status,
    message: `${summary.actor_workspace_count ?? 0} actor correction workspace(s), ${summary.correction_item_count ?? 0} correction item(s), ${summary.pending_decision_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      workspace_status: workspace.workspace_status ?? "unknown",
      actor_workspace_count: summary.actor_workspace_count ?? 0,
      correction_item_count: summary.correction_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_decision_count: summary.pending_decision_count ?? 0,
      needs_correction_count: summary.needs_correction_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      editable_file_count: summary.editable_file_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCorrectionWorkspaceMergeStage(merge, source) {
  if (!merge) return missingStage("human_review_correction_workspace_merge", "Human Review Correction Workspace Merge", source);
  const summary = merge.summary ?? {};
  const errors = summary.validation_error_count ?? merge.validation?.errors?.length ?? 0;
  const invalid = summary.invalid_correction_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const duplicate = summary.duplicate_receipt_count ?? 0;
  const unknown = summary.unknown_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const ready = summary.ready_for_validation_count ?? 0;
  const status = merge.merge_status === "blocked" || errors > 0 || invalid > 0 || missing > 0 || duplicate > 0 || unknown > 0
    ? "blocked"
    : pending > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "human_review_correction_workspace_merge",
    label: "Human Review Correction Workspace Merge",
    status,
    message: `${summary.actor_input_count ?? 0} actor correction input(s), ${summary.receipt_row_count ?? 0} receipt row(s), ${pending} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      merge_status: merge.merge_status ?? "unknown",
      actor_input_count: summary.actor_input_count ?? 0,
      available_actor_input_count: summary.available_actor_input_count ?? 0,
      expected_receipt_count: summary.expected_receipt_count ?? 0,
      merge_item_count: summary.merge_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: pending,
      ready_for_validation_count: ready,
      missing_receipt_count: missing,
      duplicate_receipt_count: duplicate,
      unknown_receipt_count: unknown,
      invalid_correction_receipt_count: invalid,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errors,
    },
  };
}

function buildHumanReviewCorrectionValidationStage(validation, source) {
  if (!validation) return missingStage("human_review_correction_validation", "Human Review Correction Validation", source);
  const summary = validation.summary ?? {};
  const errors = summary.error_count ?? 0;
  const invalid = summary.invalid_receipt_count ?? 0;
  const unknown = summary.unknown_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const ready = summary.ready_to_apply_count ?? 0;
  const status = errors > 0 || invalid > 0 || unknown > 0 || missing > 0 || validation.validation_status === "blocked_missing_source"
    ? "blocked"
    : pending > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "human_review_correction_validation",
    label: "Human Review Correction Validation",
    status,
    message: `${summary.validation_item_count ?? 0} correction receipt validation item(s), ${ready} ready, ${pending} pending, ${errors} error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      validation_status: validation.validation_status ?? "unknown",
      receipt_count: summary.receipt_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      ready_to_apply_count: ready,
      pending_receipt_count: pending,
      missing_receipt_count: missing,
      invalid_receipt_count: invalid,
      unknown_receipt_count: unknown,
      error_count: errors,
      protected_ready_count: summary.protected_ready_count ?? 0,
      human_ready_count: summary.human_ready_count ?? 0,
      evidence_decision_ready_count: summary.evidence_decision_ready_count ?? 0,
      command_ready_count: summary.command_ready_count ?? 0,
    },
  };
}

function buildHumanReviewCorrectionFeedbackStage(feedback, source) {
  if (!feedback) return missingStage("human_review_correction_feedback", "Human Review Correction Feedback", source);
  const summary = feedback.summary ?? {};
  const errorCount = summary.validation_error_count ?? feedback.validation?.errors?.length ?? 0;
  const status = feedback.feedback_status === "blocked" || errorCount > 0
    ? "blocked"
    : feedback.feedback_status === "attention" || (summary.needs_correction_count ?? 0) > 0
      ? "attention"
      : (summary.pending_receipt_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_application_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_correction_feedback",
    label: "Human Review Correction Feedback",
    status,
    message: `${summary.actor_feedback_count ?? 0} correction feedback bundle(s), ${summary.feedback_item_count ?? 0} item(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      feedback_status: feedback.feedback_status ?? "unknown",
      actor_feedback_count: summary.actor_feedback_count ?? 0,
      feedback_item_count: summary.feedback_item_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      needs_correction_count: summary.needs_correction_count ?? 0,
      missing_validation_count: summary.missing_validation_count ?? 0,
      invalid_receipt_count: summary.invalid_receipt_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleLedgerStage(ledger, source) {
  if (!ledger) return missingStage("human_review_cycle_ledger", "Human Review Cycle Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const status = ledger.cycle_status === "blocked" || errorCount > 0
    ? "blocked"
    : ledger.cycle_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_review_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_application_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_ledger",
    label: "Human Review Cycle Ledger",
    status,
    message: `${summary.actor_cycle_count ?? 0} actor cycle(s), ${summary.cycle_item_count ?? 0} item(s), ${summary.pending_human_review_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      cycle_status: ledger.cycle_status ?? "unknown",
      actor_cycle_count: summary.actor_cycle_count ?? 0,
      cycle_item_count: summary.cycle_item_count ?? 0,
      pending_human_review_count: summary.pending_human_review_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      clear_count: summary.clear_count ?? 0,
      unavailable_source_count: summary.unavailable_source_count ?? 0,
      original_feedback_item_count: summary.original_feedback_item_count ?? 0,
      correction_feedback_item_count: summary.correction_feedback_item_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleWorkOrdersStage(workOrders, source) {
  if (!workOrders) return missingStage("human_review_cycle_work_orders", "Human Review Cycle Work Orders", source);
  const summary = workOrders.summary ?? {};
  const errorCount = summary.validation_error_count ?? workOrders.validation?.errors?.length ?? 0;
  const status = workOrders.work_order_status === "blocked" || errorCount > 0
    ? "blocked"
    : workOrders.work_order_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_review_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_application_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_work_orders",
    label: "Human Review Cycle Work Orders",
    status,
    message: `${summary.actor_work_order_count ?? 0} actor work order(s), ${summary.work_order_item_count ?? 0} item(s), ${summary.pending_human_review_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      work_order_status: workOrders.work_order_status ?? "unknown",
      actor_work_order_count: summary.actor_work_order_count ?? 0,
      work_order_item_count: summary.work_order_item_count ?? 0,
      pending_human_review_count: summary.pending_human_review_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      clear_count: summary.clear_count ?? 0,
      unavailable_source_count: summary.unavailable_source_count ?? 0,
      source_cycle_item_count: summary.source_cycle_item_count ?? 0,
      source_actor_cycle_count: summary.source_actor_cycle_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      missing_target_path_count: summary.missing_target_path_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleTargetAuditStage(audit, source) {
  if (!audit) return missingStage("human_review_cycle_target_audit", "Human Review Cycle Target Audit", source);
  const summary = audit.summary ?? {};
  const errorCount = summary.validation_error_count ?? audit.validation?.errors?.length ?? 0;
  const status = audit.target_audit_status === "blocked" || errorCount > 0
    ? "blocked"
    : audit.target_audit_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.ready_target_count ?? 0) > 0
        ? "pending"
        : "passed";
  return {
    stage_id: "human_review_cycle_target_audit",
    label: "Human Review Cycle Target Audit",
    status,
    message: `${summary.target_audit_item_count ?? 0} target audit item(s), ${summary.ready_target_count ?? 0} ready, ${summary.blocked_count ?? 0} blocked.`,
    source_path: source?.path ?? null,
    metrics: {
      target_audit_status: audit.target_audit_status ?? "unknown",
      actor_target_audit_count: summary.actor_target_audit_count ?? 0,
      target_audit_item_count: summary.target_audit_item_count ?? 0,
      ready_target_count: summary.ready_target_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      missing_target_file_count: summary.missing_target_file_count ?? 0,
      missing_decision_file_count: summary.missing_decision_file_count ?? 0,
      missing_receipt_row_count: summary.missing_receipt_row_count ?? 0,
      missing_required_field_count: summary.missing_required_field_count ?? 0,
      mismatch_count: summary.mismatch_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleTriageInboxStage(inbox, source) {
  if (!inbox) return missingStage("human_review_cycle_triage_inbox", "Human Review Cycle Triage Inbox", source);
  const summary = inbox.summary ?? {};
  const errorCount = summary.validation_error_count ?? inbox.validation?.errors?.length ?? 0;
  const status = inbox.triage_status === "blocked" || errorCount > 0
    ? "blocked"
    : inbox.triage_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.ready_for_human_review_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_application_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_triage_inbox",
    label: "Human Review Cycle Triage Inbox",
    status,
    message: `${summary.actor_triage_inbox_count ?? 0} actor inbox(es), ${summary.triage_item_count ?? 0} item(s), ${summary.ready_for_human_review_count ?? 0} ready for human review.`,
    source_path: source?.path ?? null,
    metrics: {
      triage_status: inbox.triage_status ?? "unknown",
      actor_triage_inbox_count: summary.actor_triage_inbox_count ?? 0,
      triage_item_count: summary.triage_item_count ?? 0,
      ready_for_human_review_count: summary.ready_for_human_review_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      missing_target_audit_count: summary.missing_target_audit_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReviewerConsoleStage(console, source) {
  if (!console) return missingStage("human_review_cycle_reviewer_console", "Human Review Cycle Reviewer Console", source);
  const summary = console.summary ?? {};
  const errorCount = summary.validation_error_count ?? console.validation?.errors?.length ?? 0;
  const status = console.console_status === "blocked" || errorCount > 0
    ? "blocked"
    : console.console_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.ready_for_human_review_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_application_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_reviewer_console",
    label: "Human Review Cycle Reviewer Console",
    status,
    message: `${summary.actor_console_count ?? 0} actor console(s), ${summary.console_item_count ?? 0} item(s), ${summary.ready_for_human_review_count ?? 0} ready for human review.`,
    source_path: source?.path ?? null,
    metrics: {
      console_status: console.console_status ?? "unknown",
      actor_console_count: summary.actor_console_count ?? 0,
      console_item_count: summary.console_item_count ?? 0,
      ready_for_human_review_count: summary.ready_for_human_review_count ?? 0,
      ready_for_application_count: summary.ready_for_application_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      missing_context_card_count: summary.missing_context_card_count ?? 0,
      missing_decision_row_count: summary.missing_decision_row_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptFieldAuditStage(audit, source) {
  if (!audit) return missingStage("human_review_cycle_receipt_field_audit", "Human Review Cycle Receipt Field Audit", source);
  const summary = audit.summary ?? {};
  const errorCount = summary.validation_error_count ?? audit.validation?.errors?.length ?? 0;
  const status = audit.field_audit_status === "blocked" || errorCount > 0
    ? "blocked"
    : audit.field_audit_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_review_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_validation_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_field_audit",
    label: "Human Review Cycle Receipt Field Audit",
    status,
    message: `${summary.actor_field_audit_count ?? 0} actor audit(s), ${summary.field_audit_item_count ?? 0} item(s), ${summary.pending_human_review_count ?? 0} pending human review.`,
    source_path: source?.path ?? null,
    metrics: {
      field_audit_status: audit.field_audit_status ?? "unknown",
      actor_field_audit_count: summary.actor_field_audit_count ?? 0,
      field_audit_item_count: summary.field_audit_item_count ?? 0,
      pending_human_review_count: summary.pending_human_review_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      missing_receipt_row_count: summary.missing_receipt_row_count ?? 0,
      missing_required_field_count: summary.missing_required_field_count ?? 0,
      missing_required_field_item_count: summary.missing_required_field_item_count ?? 0,
      missing_required_field_key_count: summary.missing_required_field_key_count ?? 0,
      terminal_receipt_count: summary.terminal_receipt_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionPackStage(pack, source) {
  if (!pack) return missingStage("human_review_cycle_receipt_completion_pack", "Human Review Cycle Receipt Completion Pack", source);
  const summary = pack.summary ?? {};
  const errorCount = summary.validation_error_count ?? pack.validation?.errors?.length ?? 0;
  const status = pack.completion_status === "blocked" || errorCount > 0
    ? "blocked"
    : pack.completion_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.ready_for_human_input_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_validation_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_pack",
    label: "Human Review Cycle Receipt Completion Pack",
    status,
    message: `${summary.actor_completion_pack_count ?? 0} actor pack(s), ${summary.completion_item_count ?? 0} item(s), ${summary.template_field_prompt_count ?? 0} field prompt(s).`,
    source_path: source?.path ?? null,
    metrics: {
      completion_status: pack.completion_status ?? "unknown",
      actor_completion_pack_count: summary.actor_completion_pack_count ?? 0,
      completion_item_count: summary.completion_item_count ?? 0,
      ready_for_human_input_count: summary.ready_for_human_input_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      template_field_prompt_count: summary.template_field_prompt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionVerificationStage(verification, source) {
  if (!verification) return missingStage("human_review_cycle_receipt_completion_verification", "Human Review Cycle Receipt Completion Verification", source);
  const summary = verification.summary ?? {};
  const errorCount = summary.validation_error_count ?? verification.validation?.errors?.length ?? 0;
  const status = verification.verification_status === "blocked" || errorCount > 0
    ? "blocked"
    : verification.verification_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_input_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_validation_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_verification",
    label: "Human Review Cycle Receipt Completion Verification",
    status,
    message: `${summary.actor_verification_count ?? 0} actor verification(s), ${summary.verification_item_count ?? 0} item(s), ${summary.pending_prompt_count ?? 0} pending prompt field(s).`,
    source_path: source?.path ?? null,
    metrics: {
      verification_status: verification.verification_status ?? "unknown",
      actor_verification_count: summary.actor_verification_count ?? 0,
      verification_item_count: summary.verification_item_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      missing_receipt_row_count: summary.missing_receipt_row_count ?? 0,
      field_prompt_count: summary.field_prompt_count ?? 0,
      completed_prompt_count: summary.completed_prompt_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      invalid_prompt_count: summary.invalid_prompt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionWorkbenchStage(workbench, source) {
  if (!workbench) return missingStage("human_review_cycle_receipt_completion_workbench", "Human Review Cycle Receipt Completion Workbench", source);
  const summary = workbench.summary ?? {};
  const errorCount = summary.validation_error_count ?? workbench.validation?.errors?.length ?? 0;
  const status = workbench.workbench_status === "blocked" || errorCount > 0
    ? "blocked"
    : workbench.workbench_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_input_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_validation_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_workbench",
    label: "Human Review Cycle Receipt Completion Workbench",
    status,
    message: `${summary.actor_workbench_count ?? 0} actor workbench(es), ${summary.workbench_item_count ?? 0} item(s), ${summary.pending_prompt_count ?? 0} pending prompt field(s).`,
    source_path: source?.path ?? null,
    metrics: {
      workbench_status: workbench.workbench_status ?? "unknown",
      actor_workbench_count: summary.actor_workbench_count ?? 0,
      workbench_item_count: summary.workbench_item_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      receipt_completion_template_count: summary.receipt_completion_template_count ?? 0,
      field_prompt_count: summary.field_prompt_count ?? 0,
      completed_prompt_count: summary.completed_prompt_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      invalid_prompt_count: summary.invalid_prompt_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      evidence_decision_count: summary.evidence_decision_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionRunbookStage(runbook, source) {
  if (!runbook) return missingStage("human_review_cycle_receipt_completion_runbook", "Human Review Cycle Receipt Completion Runbook", source);
  const summary = runbook.summary ?? {};
  const errorCount = summary.validation_error_count ?? runbook.validation?.errors?.length ?? 0;
  const status = runbook.runbook_status === "blocked" || errorCount > 0
    ? "blocked"
    : runbook.runbook_status === "attention" || (summary.attention_count ?? 0) > 0
      ? "attention"
      : (summary.pending_human_input_count ?? 0) > 0
        ? "pending"
        : (summary.ready_for_validation_count ?? 0) > 0
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_runbook",
    label: "Human Review Cycle Receipt Completion Runbook",
    status,
    message: `${summary.actor_runbook_count ?? 0} actor runbook(s), ${summary.runbook_step_count ?? 0} step(s), ${summary.command_step_count ?? 0} command step(s).`,
    source_path: source?.path ?? null,
    metrics: {
      runbook_status: runbook.runbook_status ?? "unknown",
      actor_runbook_count: summary.actor_runbook_count ?? 0,
      runbook_step_count: summary.runbook_step_count ?? 0,
      workbench_item_count: summary.workbench_item_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      attention_count: summary.attention_count ?? 0,
      blocked_count: summary.blocked_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      command_step_count: summary.command_step_count ?? 0,
      manual_step_count: summary.manual_step_count ?? 0,
      protected_step_count: summary.protected_step_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionReadinessStage(readiness, source) {
  if (!readiness) return missingStage("human_review_cycle_receipt_completion_readiness", "Human Review Cycle Receipt Completion Readiness", source);
  const summary = readiness.summary ?? {};
  const errorCount = summary.validation_error_count ?? readiness.validation?.errors?.length ?? 0;
  const status = readiness.readiness_status === "blocked" || errorCount > 0
    ? "blocked"
    : readiness.readiness_status === "attention"
      ? "attention"
      : readiness.readiness_status === "waiting_for_human_input"
        ? "pending"
        : readiness.readiness_status === "ready_for_validation"
          ? "ready"
          : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_readiness",
    label: "Human Review Cycle Receipt Completion Readiness",
    status,
    message: `${summary.command_gate_count ?? 0} command gate(s), ${summary.allowed_command_count ?? 0} allowed now, ${summary.blocked_until_manual_input_count ?? 0} blocked until manual input.`,
    source_path: source?.path ?? null,
    metrics: {
      readiness_status: readiness.readiness_status ?? "unknown",
      actor_readiness_count: summary.actor_readiness_count ?? 0,
      command_gate_count: summary.command_gate_count ?? 0,
      manual_requirement_count: summary.manual_requirement_count ?? 0,
      allowed_command_count: summary.allowed_command_count ?? 0,
      blocked_command_count: summary.blocked_command_count ?? 0,
      blocked_until_manual_input_count: summary.blocked_until_manual_input_count ?? 0,
      protected_command_count: summary.protected_command_count ?? 0,
      manual_input_required_count: summary.manual_input_required_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandQueueStage(commandQueue, source) {
  if (!commandQueue) return missingStage("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", source);
  const summary = commandQueue.summary ?? {};
  const errorCount = summary.validation_error_count ?? commandQueue.validation?.errors?.length ?? 0;
  const status = commandQueue.queue_status === "blocked" || errorCount > 0
    ? "blocked"
    : commandQueue.queue_status === "waiting_for_human_input"
      ? "pending"
      : commandQueue.queue_status === "ready_with_holds"
        ? "pending"
        : commandQueue.queue_status === "ready"
          ? "passed"
          : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_queue",
    label: "Human Review Cycle Receipt Completion Command Queue",
    status,
    message: `${summary.command_queue_item_count ?? 0} ready command(s), ${summary.held_command_item_count ?? 0} held command(s), ${summary.actor_command_queue_count ?? 0} actor queue(s).`,
    source_path: source?.path ?? null,
    metrics: {
      queue_status: commandQueue.queue_status ?? "unknown",
      command_queue_item_count: summary.command_queue_item_count ?? 0,
      held_command_item_count: summary.held_command_item_count ?? 0,
      actor_command_queue_count: summary.actor_command_queue_count ?? 0,
      protected_held_command_count: summary.protected_held_command_count ?? 0,
      manual_input_hold_count: summary.manual_input_hold_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      source_command_gate_count: summary.source_command_gate_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptsStage(commandReceipts, source) {
  if (!commandReceipts) return missingStage("human_review_cycle_receipt_completion_command_receipts", "Human Review Cycle Receipt Completion Command Receipts", source);
  const summary = commandReceipts.summary ?? {};
  const errorCount = summary.validation_error_count ?? commandReceipts.validation?.errors?.length ?? 0;
  const status = commandReceipts.receipt_status === "blocked_missing_command_queue" || errorCount > 0
    ? "blocked"
    : commandReceipts.receipt_status === "pending_command_receipts"
      ? "pending"
      : commandReceipts.receipt_status === "clear"
        ? "passed"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_receipts",
    label: "Human Review Cycle Receipt Completion Command Receipts",
    status,
    message: `${summary.receipt_draft_count ?? 0} command receipt draft(s), ${summary.held_command_reference_count ?? 0} held command reference(s).`,
    source_path: source?.path ?? null,
    metrics: {
      receipt_status: commandReceipts.receipt_status ?? "unknown",
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_draft_count: summary.receipt_draft_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      command_receipt_count: summary.command_receipt_count ?? 0,
      held_command_reference_count: summary.held_command_reference_count ?? 0,
      protected_held_command_count: summary.protected_held_command_count ?? 0,
      required_field_count: summary.required_field_count ?? 0,
      source_ready_command_count: summary.source_ready_command_count ?? 0,
      source_held_command_count: summary.source_held_command_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptValidationStage(validation, source) {
  return buildCommandReceiptValidationStage(validation, source, {
    stageId: "human_review_cycle_receipt_completion_command_receipt_validation",
    label: "Human Review Cycle Receipt Completion Command Receipt Validation",
  });
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationStage(validation, source) {
  return buildCommandReceiptValidationStage(validation, source, {
    stageId: "human_review_cycle_receipt_completion_command_receipt_workspace_validation",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace Validation",
  });
}

function buildCommandReceiptValidationStage(validation, source, { stageId, label }) {
  if (!validation) return missingStage(stageId, label, source);
  const summary = validation.summary ?? {};
  const errorCount = summary.error_count ?? validation.receipt_errors?.length ?? 0;
  const status = validation.validation_status === "blocked_missing_source" || validation.validation_status === "blocked_invalid_receipts" || errorCount > 0
    ? "blocked"
    : validation.validation_status === "pending_receipts"
      ? "pending"
      : validation.validation_status === "ready_to_confirm"
        ? "ready"
        : validation.validation_status === "clear"
          ? "passed"
          : "pending";
  return {
    stage_id: stageId,
    label,
    status,
    message: `${summary.validation_item_count ?? 0} command receipt validation item(s), ${summary.pending_receipt_count ?? 0} pending, ${summary.ready_to_confirm_count ?? 0} ready.`,
    source_path: source?.path ?? null,
    metrics: {
      validation_status: validation.validation_status ?? "unknown",
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_count: summary.receipt_count ?? 0,
      validation_item_count: summary.validation_item_count ?? 0,
      ready_to_confirm_count: summary.ready_to_confirm_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      invalid_receipt_count: summary.invalid_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      error_count: errorCount,
      command_success_count: summary.command_success_count ?? 0,
      command_failed_count: summary.command_failed_count ?? 0,
      skipped_count: summary.skipped_count ?? 0,
      deferred_count: summary.deferred_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptApplicationStage(application, source) {
  if (!application) return missingStage("human_review_cycle_receipt_completion_command_receipt_application", "Human Review Cycle Receipt Completion Command Receipt Application", source);
  const summary = application.summary ?? {};
  const errorCount = summary.validation_error_count ?? application.receipt_errors?.length ?? 0;
  const status = application.application_status?.startsWith("blocked") || errorCount > 0
    ? "blocked"
    : application.application_status === "applied"
      ? "passed"
      : application.application_status === "nothing_to_apply"
        ? "pending"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_receipt_application",
    label: "Human Review Cycle Receipt Completion Command Receipt Application",
    status,
    message: `${summary.ready_receipt_count ?? 0} ready command receipt(s), ${summary.applied_receipt_count ?? 0} applied, ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      application_status: application.application_status ?? "unknown",
      validation_status: summary.validation_status ?? null,
      ready_receipt_count: summary.ready_receipt_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      invalid_receipt_count: summary.invalid_receipt_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      patched_command_queue_item_count: summary.patched_command_queue_item_count ?? 0,
      audit_event_count: summary.audit_event_count ?? 0,
      receipt_error_count: summary.receipt_error_count ?? application.receipt_errors?.length ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionReconciliationStage(reconciliation, source) {
  if (!reconciliation) return missingStage("human_review_cycle_receipt_completion_reconciliation", "Human Review Cycle Receipt Completion Reconciliation", source);
  const summary = reconciliation.summary ?? {};
  const errorCount = summary.validation_error_count ?? reconciliation.validation?.errors?.length ?? 0;
  const status = reconciliation.reconciliation_status === "blocked" || errorCount > 0
    ? "blocked"
    : reconciliation.reconciliation_status === "waiting_for_manual_command_receipts"
      ? "pending"
      : reconciliation.reconciliation_status?.startsWith("waiting_for")
        ? "attention"
        : reconciliation.reconciliation_status === "ready_for_follow_on_application"
          ? "ready"
          : reconciliation.reconciliation_status === "clear"
            ? "passed"
            : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_reconciliation",
    label: "Human Review Cycle Receipt Completion Reconciliation",
    status,
    message: `${summary.reconciliation_item_count ?? 0} reconciliation item(s), ${summary.pending_command_receipt_count ?? 0} pending command receipt(s), ${summary.held_command_count ?? 0} held command(s).`,
    source_path: source?.path ?? null,
    metrics: {
      reconciliation_status: reconciliation.reconciliation_status ?? "unknown",
      reconciliation_item_count: summary.reconciliation_item_count ?? 0,
      actor_status_count: summary.actor_status_count ?? 0,
      pending_command_receipt_count: summary.pending_command_receipt_count ?? 0,
      applied_command_receipt_count: summary.applied_command_receipt_count ?? 0,
      held_command_count: summary.held_command_count ?? 0,
      protected_held_command_count: summary.protected_held_command_count ?? 0,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      ready_follow_on_count: summary.ready_follow_on_count ?? 0,
      blocked_follow_on_count: summary.blocked_follow_on_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionBaselineStage(baseline, source) {
  if (!baseline) return missingStage("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", source);
  const summary = baseline.summary ?? {};
  const errorCount = summary.validation_error_count ?? baseline.validation?.errors?.length ?? 0;
  const status = baseline.baseline_status === "blocked" || errorCount > 0
    ? "blocked"
    : baseline.baseline_status === "frozen_with_blockers"
      ? "pending"
      : baseline.baseline_status === "frozen_clear"
        ? "passed"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_baseline",
    label: "Human Review Cycle Receipt Completion Baseline",
    status,
    message: `${summary.blocker_count ?? 0} frozen blocker(s), ${summary.pending_command_receipt_count ?? 0} pending command receipt(s), ${summary.held_command_count ?? 0} held command(s), ${summary.protected_hold_count ?? 0} protected hold(s).`,
    source_path: source?.path ?? null,
    metrics: {
      baseline_status: baseline.baseline_status ?? "unknown",
      source_reconciliation_status: summary.source_reconciliation_status ?? null,
      blocker_count: summary.blocker_count ?? 0,
      pending_command_receipt_count: summary.pending_command_receipt_count ?? 0,
      held_command_count: summary.held_command_count ?? 0,
      protected_hold_count: summary.protected_hold_count ?? 0,
      source_pending_command_receipt_count: summary.source_pending_command_receipt_count ?? 0,
      source_held_command_count: summary.source_held_command_count ?? 0,
      source_protected_held_command_count: summary.source_protected_held_command_count ?? 0,
      source_reconciliation_item_count: summary.source_reconciliation_item_count ?? 0,
      source_actor_status_count: summary.source_actor_status_count ?? 0,
      matched_count_check_count: summary.matched_count_check_count ?? 0,
      mismatched_count_check_count: summary.mismatched_count_check_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionManualCommandReceiptPackStage(pack, source) {
  if (!pack) return missingStage("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human Review Cycle Receipt Completion Manual Command Receipt Pack", source);
  const summary = pack.summary ?? {};
  const errorCount = summary.validation_error_count ?? pack.validation?.errors?.length ?? 0;
  const status = pack.pack_status === "blocked" || errorCount > 0
    ? "blocked"
    : pack.pack_status === "ready_for_manual_receipts"
      ? "pending"
      : pack.pack_status === "no_manual_receipts_required"
        ? "passed"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_manual_command_receipt_pack",
    label: "Human Review Cycle Receipt Completion Manual Command Receipt Pack",
    status,
    message: `${summary.actor_receipt_pack_count ?? 0} actor pack(s), ${summary.receipt_pack_item_count ?? 0} receipt row(s), ${summary.target_receipt_path_count ?? 0} target receipt path(s), ${summary.missing_required_field_count ?? 0} missing field(s).`,
    source_path: source?.path ?? null,
    metrics: {
      pack_status: pack.pack_status ?? "unknown",
      actor_receipt_pack_count: summary.actor_receipt_pack_count ?? 0,
      receipt_pack_item_count: summary.receipt_pack_item_count ?? 0,
      pending_command_receipt_blocker_count: summary.pending_command_receipt_blocker_count ?? 0,
      non_receipt_blocker_count: summary.non_receipt_blocker_count ?? 0,
      target_receipt_path_count: summary.target_receipt_path_count ?? 0,
      missing_target_receipt_path_count: summary.missing_target_receipt_path_count ?? 0,
      required_field_count: summary.required_field_count ?? 0,
      missing_required_field_count: summary.missing_required_field_count ?? 0,
      command_count: summary.command_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionHeldCommandResolutionStage(resolution, source) {
  if (!resolution) return missingStage("human_review_cycle_receipt_completion_held_command_resolution", "Human Review Cycle Receipt Completion Held Command Resolution", source);
  const summary = resolution.summary ?? {};
  const errorCount = summary.validation_error_count ?? resolution.validation?.errors?.length ?? 0;
  const status = resolution.resolution_status === "blocked" || errorCount > 0
    ? "blocked"
    : resolution.resolution_status === "ready_for_actor_resolution"
      ? "pending"
      : resolution.resolution_status === "no_held_commands"
        ? "passed"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_held_command_resolution",
    label: "Human Review Cycle Receipt Completion Held Command Resolution",
    status,
    message: `${summary.resolution_plan_count ?? 0} resolution plan(s), ${summary.actor_resolution_plan_count ?? 0} actor plan(s), ${summary.protected_resolution_count ?? 0} protected.`,
    source_path: source?.path ?? null,
    metrics: {
      resolution_status: resolution.resolution_status ?? "unknown",
      resolution_plan_count: summary.resolution_plan_count ?? 0,
      held_command_blocker_count: summary.held_command_blocker_count ?? 0,
      source_held_command_count: summary.source_held_command_count ?? 0,
      manual_pack_non_receipt_blocker_count: summary.manual_pack_non_receipt_blocker_count ?? 0,
      command_queue_held_item_count: summary.command_queue_held_item_count ?? 0,
      protected_resolution_count: summary.protected_resolution_count ?? 0,
      manual_input_resolution_count: summary.manual_input_resolution_count ?? 0,
      actor_resolution_plan_count: summary.actor_resolution_plan_count ?? 0,
      unblock_condition_count: summary.unblock_condition_count ?? 0,
      follow_on_action_count: summary.follow_on_action_count ?? 0,
      missing_required_actor_count: summary.missing_required_actor_count ?? 0,
      missing_unblock_condition_count: summary.missing_unblock_condition_count ?? 0,
      missing_follow_on_action_count: summary.missing_follow_on_action_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionProtectedApprovalRequestPackStage(pack, source) {
  if (!pack) return missingStage("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human Review Cycle Receipt Completion Protected Approval Request Pack", source);
  const summary = pack.summary ?? {};
  const errorCount = summary.validation_error_count ?? pack.validation?.errors?.length ?? 0;
  const status = pack.pack_status === "blocked" || errorCount > 0
    ? "blocked"
    : pack.pack_status === "ready_for_explicit_approval"
      ? "pending"
      : pack.pack_status === "no_protected_approval_required"
        ? "passed"
        : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_protected_approval_request_pack",
    label: "Human Review Cycle Receipt Completion Protected Approval Request Pack",
    status,
    message: `${summary.approval_request_count ?? 0} approval request(s), ${summary.actor_approval_pack_count ?? 0} actor pack(s), ${summary.command_receipt_mixed_count ?? 0} mixed with command receipts.`,
    source_path: source?.path ?? null,
    metrics: {
      pack_status: pack.pack_status ?? "unknown",
      source_resolution_status: summary.source_resolution_status ?? "unknown",
      source_resolution_plan_count: summary.source_resolution_plan_count ?? 0,
      source_protected_resolution_count: summary.source_protected_resolution_count ?? 0,
      protected_resolution_count: summary.protected_resolution_count ?? 0,
      non_protected_resolution_count: summary.non_protected_resolution_count ?? 0,
      approval_request_count: summary.approval_request_count ?? 0,
      actor_approval_pack_count: summary.actor_approval_pack_count ?? 0,
      pending_explicit_approval_count: summary.pending_explicit_approval_count ?? 0,
      protected_action_request_count: summary.protected_action_request_count ?? 0,
      command_receipt_mixed_count: summary.command_receipt_mixed_count ?? 0,
      non_protected_request_count: summary.non_protected_request_count ?? 0,
      target_approval_input_path_count: summary.target_approval_input_path_count ?? 0,
      missing_target_approval_input_path_count: summary.missing_target_approval_input_path_count ?? 0,
      required_approval_field_count: summary.required_approval_field_count ?? 0,
      missing_required_approval_field_count: summary.missing_required_approval_field_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionManualRevalidationStage(revalidation, source) {
  if (!revalidation) return missingStage("human_review_cycle_receipt_completion_manual_revalidation", "Human Review Cycle Receipt Completion Manual Revalidation", source);
  const summary = revalidation.summary ?? {};
  const errorCount = summary.validation_error_count ?? revalidation.validation?.errors?.length ?? 0;
  const status = revalidation.revalidation_status === "blocked" || errorCount > 0
    ? "blocked"
    : revalidation.revalidation_status === "waiting_for_human_receipts"
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_manual_revalidation",
    label: "Human Review Cycle Receipt Completion Manual Revalidation",
    status,
    message: `${summary.revalidation_item_count ?? 0} item(s), ${summary.pending_human_receipt_count ?? 0} pending human receipt(s), ${summary.ready_or_applied_candidate_count ?? 0} ready/applied candidate(s), ${summary.auto_executed_receipt_count ?? 0} auto-executed.`,
    source_path: source?.path ?? null,
    metrics: {
      revalidation_status: revalidation.revalidation_status ?? "unknown",
      source_pack_status: summary.source_pack_status ?? "unknown",
      source_merge_status: summary.source_merge_status ?? "unknown",
      source_validation_status: summary.source_validation_status ?? "unknown",
      source_application_status: summary.source_application_status ?? "unknown",
      source_protected_approval_status: summary.source_protected_approval_status ?? "unknown",
      revalidation_item_count: summary.revalidation_item_count ?? 0,
      source_pack_item_count: summary.source_pack_item_count ?? 0,
      source_validation_item_count: summary.source_validation_item_count ?? 0,
      source_application_ready_receipt_count: summary.source_application_ready_receipt_count ?? 0,
      source_application_applied_receipt_count: summary.source_application_applied_receipt_count ?? 0,
      actor_revalidation_count: summary.actor_revalidation_count ?? 0,
      pending_human_receipt_count: summary.pending_human_receipt_count ?? 0,
      human_entered_ready_receipt_count: summary.human_entered_ready_receipt_count ?? 0,
      human_entered_applied_receipt_count: summary.human_entered_applied_receipt_count ?? 0,
      ready_or_applied_candidate_count: summary.ready_or_applied_candidate_count ?? 0,
      non_human_ready_or_applied_candidate_count: summary.non_human_ready_or_applied_candidate_count ?? 0,
      protected_approval_overlap_count: summary.protected_approval_overlap_count ?? 0,
      auto_executed_receipt_count: summary.auto_executed_receipt_count ?? 0,
      validation_error_count: errorCount,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptFeedbackStage(feedback, source) {
  if (!feedback) return missingStage("human_review_cycle_receipt_completion_command_receipt_feedback", "Human Review Cycle Receipt Completion Command Receipt Feedback", source);
  const summary = feedback.summary ?? {};
  const errorCount = summary.validation_error_count ?? feedback.validation?.errors?.length ?? 0;
  const status = feedback.feedback_status === "blocked" || errorCount > 0
    ? "blocked"
    : feedback.feedback_status === "attention" || (summary.needs_correction_count ?? 0) > 0
      ? "attention"
      : feedback.feedback_status === "pending_human_review"
        ? "pending"
        : feedback.feedback_status === "ready_for_confirmation"
          ? "ready"
          : feedback.feedback_status === "clear"
            ? "passed"
            : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_receipt_feedback",
    label: "Human Review Cycle Receipt Completion Command Receipt Feedback",
    status,
    message: `${summary.actor_feedback_count ?? 0} actor feedback bundle(s), ${summary.feedback_item_count ?? 0} command receipt feedback item(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      feedback_status: feedback.feedback_status ?? "unknown",
      actor_feedback_count: summary.actor_feedback_count ?? 0,
      feedback_item_count: summary.feedback_item_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_confirmation_count: summary.ready_for_confirmation_count ?? 0,
      needs_correction_count: summary.needs_correction_count ?? 0,
      invalid_receipt_count: summary.invalid_receipt_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceStage(workspace, source) {
  if (!workspace) return missingStage("human_review_cycle_receipt_completion_command_receipt_workspace", "Human Review Cycle Receipt Completion Command Receipt Workspace", source);
  const summary = workspace.summary ?? {};
  const errorCount = summary.validation_error_count ?? workspace.validation?.errors?.length ?? 0;
  const status = workspace.workspace_status === "blocked" || errorCount > 0
    ? "blocked"
    : workspace.workspace_status === "attention" || (summary.needs_correction_count ?? 0) > 0
      ? "attention"
      : workspace.workspace_status === "pending_human_review"
        ? "pending"
        : workspace.workspace_status === "ready_for_confirmation"
          ? "ready"
          : workspace.workspace_status === "clear"
            ? "passed"
            : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_receipt_workspace",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace",
    status,
    message: `${summary.actor_workspace_count ?? 0} actor workspace(s), ${summary.workspace_item_count ?? 0} command receipt workspace item(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      workspace_status: workspace.workspace_status ?? "unknown",
      actor_workspace_count: summary.actor_workspace_count ?? 0,
      workspace_item_count: summary.workspace_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      needs_correction_count: summary.needs_correction_count ?? 0,
      ready_for_confirmation_count: summary.ready_for_confirmation_count ?? 0,
      editable_file_count: summary.editable_file_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergeStage(merge, source) {
  if (!merge) return missingStage("human_review_cycle_receipt_completion_command_receipt_workspace_merge", "Human Review Cycle Receipt Completion Command Receipt Workspace Merge", source);
  const summary = merge.summary ?? {};
  const errorCount = summary.validation_error_count ?? merge.validation?.errors?.length ?? 0;
  const status = merge.merge_status === "blocked" || errorCount > 0
    ? "blocked"
    : (summary.duplicate_receipt_count ?? 0) > 0 || (summary.invalid_actor_receipt_count ?? 0) > 0 || (summary.unknown_receipt_count ?? 0) > 0
      ? "attention"
      : merge.merge_status === "pending_human_review"
        ? "pending"
        : merge.merge_status === "ready_for_validation"
          ? "ready"
          : merge.merge_status === "clear"
            ? "passed"
            : "pending";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_receipt_workspace_merge",
    label: "Human Review Cycle Receipt Completion Command Receipt Workspace Merge",
    status,
    message: `${summary.actor_input_count ?? 0} actor input(s), ${summary.merge_item_count ?? 0} merged command receipt item(s), ${summary.pending_receipt_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      merge_status: merge.merge_status ?? "unknown",
      actor_input_count: summary.actor_input_count ?? 0,
      available_actor_input_count: summary.available_actor_input_count ?? 0,
      expected_receipt_count: summary.expected_receipt_count ?? 0,
      merge_item_count: summary.merge_item_count ?? 0,
      receipt_row_count: summary.receipt_row_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      ready_for_validation_count: summary.ready_for_validation_count ?? 0,
      missing_receipt_count: summary.missing_receipt_count ?? 0,
      duplicate_receipt_count: summary.duplicate_receipt_count ?? 0,
      unknown_receipt_count: summary.unknown_receipt_count ?? 0,
      invalid_actor_receipt_count: summary.invalid_actor_receipt_count ?? 0,
      validation_error_count: errorCount,
    },
  };
}

function buildControlPlaneHumanGateReceiptValidationStage(validation, source) {
  if (!validation) return missingStage("control_plane_human_gate_receipt_validation", "Control Plane Human Gate Receipt Validation", source);
  const summary = validation.summary ?? {};
  const errors = summary.error_count ?? 0;
  const invalid = summary.invalid_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const ready = summary.ready_to_apply_count ?? 0;
  const status = errors > 0 || invalid > 0
    ? "attention"
    : pending > 0 || missing > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "control_plane_human_gate_receipt_validation",
    label: "Control Plane Human Gate Receipt Validation",
    status,
    message: `${ready} ready receipt(s), ${pending} pending, ${invalid} invalid, ${missing} missing.`,
    source_path: source?.path ?? null,
    metrics: {
      validation_status: validation.validation_status,
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_count: summary.receipt_count ?? 0,
      ready_to_apply_count: ready,
      pending_receipt_count: pending,
      missing_receipt_count: missing,
      invalid_receipt_count: invalid,
      error_count: errors,
      evidence_decision_ready_count: summary.evidence_decision_ready_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCommandQueuePatchProjectionStage(projection, source) {
  if (!projection) return missingStage("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human Review Cycle Receipt Completion Command Queue Patch Projection", source);
  const summary = projection.summary ?? {};
  const errorCount = summary.validation_error_count ?? projection.validation?.errors?.length ?? 0;
  const status = projection.projection_status === "blocked" || errorCount > 0
    ? "blocked"
    : projection.projection_status === "waiting_for_human_receipts"
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_command_queue_patch_projection",
    label: "Human Review Cycle Receipt Completion Command Queue Patch Projection",
    status,
    message: `${summary.projection_item_count ?? 0} projection item(s), ${summary.patch_target_count ?? 0} patch target(s), ${summary.patch_operation_count ?? 0} operation(s), ${summary.audit_event_candidate_count ?? 0} audit candidate(s).`,
    source_path: source?.path ?? null,
    metrics: {
      projection_status: projection.projection_status ?? "unknown",
      source_command_queue_status: summary.source_command_queue_status ?? "unknown",
      source_revalidation_status: summary.source_revalidation_status ?? "unknown",
      source_application_status: summary.source_application_status ?? "unknown",
      source_revalidation_item_count: summary.source_revalidation_item_count ?? 0,
      source_ready_or_applied_candidate_count: summary.source_ready_or_applied_candidate_count ?? 0,
      projection_item_count: summary.projection_item_count ?? 0,
      patch_target_count: summary.patch_target_count ?? 0,
      ready_patch_count: summary.ready_patch_count ?? 0,
      waiting_patch_count: summary.waiting_patch_count ?? 0,
      blocked_patch_count: summary.blocked_patch_count ?? 0,
      unchanged_projection_count: summary.unchanged_projection_count ?? 0,
      patch_operation_count: summary.patch_operation_count ?? 0,
      audit_event_candidate_count: summary.audit_event_candidate_count ?? 0,
      emittable_audit_event_candidate_count: summary.emittable_audit_event_candidate_count ?? 0,
      missing_queue_item_count: summary.missing_queue_item_count ?? 0,
      non_human_patch_candidate_count: summary.non_human_patch_candidate_count ?? 0,
      protected_overlap_count: summary.protected_overlap_count ?? 0,
      auto_executed_receipt_count: summary.auto_executed_receipt_count ?? 0,
      validation_error_count: errorCount,
      patch_applied_count: summary.patch_applied_count ?? 0,
      audit_event_emitted_count: summary.audit_event_emitted_count ?? 0,
      command_executed_count: summary.command_executed_count ?? 0,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewCycleReceiptCompletionCloseoutLedgerStage(ledger, source) {
  if (!ledger) return missingStage("human_review_cycle_receipt_completion_closeout_ledger", "Human Review Cycle Receipt Completion Closeout Ledger", source);
  const summary = ledger.summary ?? {};
  const errorCount = summary.validation_error_count ?? ledger.validation?.errors?.length ?? 0;
  const status = ledger.closeout_status === "blocked" || errorCount > 0
    ? "blocked"
    : ledger.closeout_status === "open_pending"
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_cycle_receipt_completion_closeout_ledger",
    label: "Human Review Cycle Receipt Completion Closeout Ledger",
    status,
    message: `${summary.closeout_item_count ?? 0} closeout item(s), ${summary.actor_closeout_count ?? 0} actor closeout(s), ${summary.pending_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      closeout_status: ledger.closeout_status ?? "unknown",
      source_baseline_status: summary.source_baseline_status ?? "unknown",
      source_manual_revalidation_status: summary.source_manual_revalidation_status ?? "unknown",
      source_protected_approval_status: summary.source_protected_approval_status ?? "unknown",
      source_projection_status: summary.source_projection_status ?? "unknown",
      source_resolution_status: summary.source_resolution_status ?? "unknown",
      source_baseline_blocker_count: summary.source_baseline_blocker_count ?? 0,
      closeout_item_count: summary.closeout_item_count ?? 0,
      actor_closeout_count: summary.actor_closeout_count ?? 0,
      pending_count: summary.pending_count ?? 0,
      approved_count: summary.approved_count ?? 0,
      rejected_count: summary.rejected_count ?? 0,
      superseded_count: summary.superseded_count ?? 0,
      normalized_status_total_count: summary.normalized_status_total_count ?? 0,
      unknown_status_count: summary.unknown_status_count ?? 0,
      pending_command_receipt_count: summary.pending_command_receipt_count ?? 0,
      pending_held_command_count: summary.pending_held_command_count ?? 0,
      pending_protected_approval_count: summary.pending_protected_approval_count ?? 0,
      approved_command_receipt_count: summary.approved_command_receipt_count ?? 0,
      approved_protected_approval_count: summary.approved_protected_approval_count ?? 0,
      validation_error_count: errorCount,
      patch_applied_count: summary.patch_applied_count ?? 0,
      audit_event_emitted_count: summary.audit_event_emitted_count ?? 0,
      command_executed_count: summary.command_executed_count ?? 0,
      refresh_command_executed_by_harness_count: summary.refresh_command_executed_by_harness_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildHumanReviewV1RegressionFreezeStage(freeze, source) {
  if (!freeze) return missingStage("human_review_v1_regression_freeze", "Human Review v1 Regression Freeze", source);
  const summary = freeze.summary ?? {};
  const errorCount = summary.validation_error_count ?? freeze.validation?.errors?.length ?? 0;
  const status = freeze.freeze_status === "blocked" || errorCount > 0
    ? "blocked"
    : summary.closeout_pending_count > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "human_review_v1_regression_freeze",
    label: "Human Review v1 Regression Freeze",
    status,
    message: `${summary.regression_fixture_artifact_count ?? 0} fixture artifact(s), ${summary.passed_verification_checkpoint_count ?? 0}/${summary.verification_checkpoint_count ?? 0} checkpoint(s), ${summary.closeout_pending_count ?? 0} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      freeze_status: freeze.freeze_status ?? "unknown",
      required_source_count: summary.required_source_count ?? 0,
      available_required_source_count: summary.available_required_source_count ?? 0,
      regression_fixture_artifact_count: summary.regression_fixture_artifact_count ?? 0,
      regression_fixture_hash_count: summary.regression_fixture_hash_count ?? 0,
      verification_checkpoint_count: summary.verification_checkpoint_count ?? 0,
      passed_verification_checkpoint_count: summary.passed_verification_checkpoint_count ?? 0,
      failed_verification_checkpoint_count: summary.failed_verification_checkpoint_count ?? 0,
      closeout_item_count: summary.closeout_item_count ?? 0,
      closeout_pending_count: summary.closeout_pending_count ?? 0,
      closeout_unknown_status_count: summary.closeout_unknown_status_count ?? 0,
      loop_status: summary.loop_status ?? "unknown",
      loop_step_count: summary.loop_step_count ?? 0,
      loop_passed_step_count: summary.loop_passed_step_count ?? 0,
      loop_failed_step_count: summary.loop_failed_step_count ?? 0,
      loop_missing_artifact_count: summary.loop_missing_artifact_count ?? 0,
      validation_error_count: errorCount,
      command_executed_count: summary.command_executed_count ?? 0,
      patch_applied_count: summary.patch_applied_count ?? 0,
      audit_event_emitted_count: summary.audit_event_emitted_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildControlPlaneHumanGateReceiptApplicationStage(application, source) {
  if (!application) return missingStage("control_plane_human_gate_receipt_application", "Control Plane Human Gate Receipt Application", source);
  const summary = application.summary ?? {};
  const status = application.application_status === "blocked_missing_validation"
    || application.application_status === "blocked_missing_human_gates"
    || application.application_status === "blocked_validation_errors"
    ? "attention"
    : application.application_status === "nothing_to_apply"
      ? (summary.pending_receipt_count > 0 ? "pending" : "passed")
      : "passed";
  return {
    stage_id: "control_plane_human_gate_receipt_application",
    label: "Control Plane Human Gate Receipt Application",
    status,
    message: `${summary.applied_receipt_count ?? 0} applied receipt(s), ${summary.patched_gate_item_count ?? 0} patched gate item(s), status ${application.application_status}.`,
    source_path: source?.path ?? null,
    metrics: {
      application_status: application.application_status,
      safe_to_apply: application.safe_to_apply ?? false,
      ready_receipt_count: summary.ready_receipt_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      patched_gate_item_count: summary.patched_gate_item_count ?? 0,
      audit_event_count: summary.audit_event_count ?? 0,
      protected_applied_count: summary.protected_applied_count ?? 0,
      evidence_decision_applied_count: summary.evidence_decision_applied_count ?? 0,
      protected_action_executed_count: summary.protected_action_executed_count ?? 0,
    },
  };
}

function buildControlPlaneWorkPacketsStage(workPackets, source) {
  if (!workPackets) return missingStage("control_plane_work_packets", "Control Plane Work Packets", source);
  const summary = workPackets.summary ?? {};
  const status = workPackets.packet_status === "clear"
    ? "passed"
    : workPackets.packet_status === "blocked"
      ? "blocked"
      : workPackets.packet_status === "ready_to_run"
        ? "ready"
        : "pending";
  return {
    stage_id: "control_plane_work_packets",
    label: "Control Plane Work Packets",
    status,
    message: `${summary.work_packet_count ?? 0} work packet(s), ${summary.human_packet_count ?? 0} human packet(s), ${summary.protected_packet_count ?? 0} protected packet(s).`,
    source_path: source?.path ?? null,
    metrics: {
      packet_status: workPackets.packet_status,
      work_packet_count: summary.work_packet_count ?? 0,
      work_item_count: summary.work_item_count ?? 0,
      blocked_packet_count: summary.blocked_packet_count ?? 0,
      human_packet_count: summary.human_packet_count ?? 0,
      protected_packet_count: summary.protected_packet_count ?? 0,
      command_packet_count: summary.command_packet_count ?? 0,
      next_command_count: summary.next_command_count ?? 0,
    },
  };
}

function buildControlPlaneWorkPacketReceiptsStage(receipts, source) {
  if (!receipts) return missingStage("control_plane_work_packet_receipts", "Control Plane Work Packet Receipts", source);
  const summary = receipts.summary ?? {};
  const status = receipts.receipt_status === "clear"
    ? "passed"
    : receipts.receipt_status === "blocked_missing_work_packets"
      ? "blocked"
      : "pending";
  return {
    stage_id: "control_plane_work_packet_receipts",
    label: "Control Plane Work Packet Receipts",
    status,
    message: `${summary.receipt_draft_count ?? 0} receipt draft(s), ${summary.human_receipt_count ?? 0} human, ${summary.protected_receipt_count ?? 0} protected.`,
    source_path: source?.path ?? null,
    metrics: {
      receipt_status: receipts.receipt_status,
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_draft_count: summary.receipt_draft_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      human_receipt_count: summary.human_receipt_count ?? 0,
      protected_receipt_count: summary.protected_receipt_count ?? 0,
      command_receipt_count: summary.command_receipt_count ?? 0,
    },
  };
}

function buildControlPlaneWorkPacketReceiptValidationStage(validation, source) {
  if (!validation) return missingStage("control_plane_work_packet_receipt_validation", "Control Plane Work Packet Receipt Validation", source);
  const summary = validation.summary ?? {};
  const errors = summary.error_count ?? 0;
  const invalid = summary.invalid_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const ready = summary.ready_to_apply_count ?? 0;
  const status = errors > 0 || invalid > 0
    ? "attention"
    : pending > 0 || missing > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "control_plane_work_packet_receipt_validation",
    label: "Control Plane Work Packet Receipt Validation",
    status,
    message: `${ready} ready receipt(s), ${pending} pending, ${invalid} invalid, ${missing} missing.`,
    source_path: source?.path ?? null,
    metrics: {
      validation_status: validation.validation_status,
      receipt_requirement_count: summary.receipt_requirement_count ?? 0,
      receipt_count: summary.receipt_count ?? 0,
      ready_to_apply_count: ready,
      pending_receipt_count: pending,
      missing_receipt_count: missing,
      invalid_receipt_count: invalid,
      error_count: errors,
    },
  };
}

function buildControlPlaneWorkPacketReceiptApplicationStage(application, source) {
  if (!application) return missingStage("control_plane_work_packet_receipt_application", "Control Plane Work Packet Receipt Application", source);
  const summary = application.summary ?? {};
  const status = application.application_status === "blocked_missing_validation"
    || application.application_status === "blocked_missing_work_packets"
    || application.application_status === "blocked_validation_errors"
    ? "attention"
    : application.application_status === "nothing_to_apply"
      ? (summary.pending_receipt_count > 0 ? "pending" : "passed")
      : "passed";
  return {
    stage_id: "control_plane_work_packet_receipt_application",
    label: "Control Plane Work Packet Receipt Application",
    status,
    message: `${summary.applied_receipt_count ?? 0} applied receipt(s), ${summary.patched_work_packet_count ?? 0} patched packet(s), status ${application.application_status}.`,
    source_path: source?.path ?? null,
    metrics: {
      application_status: application.application_status,
      safe_to_apply: application.safe_to_apply ?? false,
      ready_receipt_count: summary.ready_receipt_count ?? 0,
      pending_receipt_count: summary.pending_receipt_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      patched_work_packet_count: summary.patched_work_packet_count ?? 0,
      patched_work_item_count: summary.patched_work_item_count ?? 0,
      audit_event_count: summary.audit_event_count ?? 0,
    },
  };
}

function buildLawFirmLddStage(summary, source) {
  if (!summary) return missingStage("law_firm_ldd_slice", "Law Firm LDD Slice", source);
  const status = summary.status === "blocked" ? "blocked" : summary.status === "completed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.issue_count ?? 0} issue candidate(s), ${summary.citation_count ?? 0} citation(s), blocked: ${summary.blocked_reason}`
      : `${summary.issue_count ?? 0} issue candidate(s), ${summary.citation_count ?? 0} citation(s).`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      issue_count: summary.issue_count ?? 0,
      rfi_count: summary.rfi_count ?? 0,
      citation_count: summary.citation_count ?? 0,
      approval_id: summary.approval_id ?? null,
    },
  };
}

function buildPersonalDevStage(summary, source) {
  if (!summary) return missingStage("personal_dev_slice", "Personal Dev Slice", source);
  const status = summary.status === "blocked" ? "pending" : summary.status === "passed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.status}: ${summary.blocked_reason}`
      : `${summary.status ?? "unknown"} with ${summary.actual_isolation ?? "unknown"} isolation.`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      actual_isolation: summary.actual_isolation ?? null,
    },
  };
}

function buildCreativeDocumentStage(summary, source) {
  if (!summary) return missingStage("creative_document_slice", "Creative Document Slice", source);
  const status = summary.status === "blocked" ? "pending" : summary.status === "passed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "creative_document_slice",
    label: "Creative Document Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.slide_count ?? 0} slide(s), format ${summary.format_validation_status ?? "unknown"}, blocked: ${summary.blocked_reason}`
      : `${summary.slide_count ?? 0} slide(s), format ${summary.format_validation_status ?? "unknown"}.`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      slide_count: summary.slide_count ?? 0,
      artifact_count: summary.artifact_count ?? 0,
      format_validation_status: summary.format_validation_status ?? "unknown",
      approval_id: summary.approval_id ?? null,
    },
  };
}

function missingStage(stageId, label, source) {
  return {
    stage_id: stageId,
    label,
    status: "missing",
    message: source?.error === "disabled" ? "Stage disabled for this dashboard run." : "Source artifact is not available.",
    source_path: source?.path ?? null,
    metrics: {},
  };
}

function buildActionItems(artifacts) {
  const items = [];
  const queueItems = artifacts.approval_queue?.items ?? [];
  const appliedIds = new Set((artifacts.approval_decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const unappliedIds = new Set((artifacts.approval_decisions?.unapplied_items ?? []).map((item) => item.queue_item_id));
  const appliedApprovalInboxIds = new Set((artifacts.approval_inbox_decisions?.applied_items ?? []).map((item) => item.approval_item_id));

  for (const item of queueItems) {
    if (appliedIds.has(item.queue_item_id)) continue;
    items.push({
      action_item_id: `dashboard.action.${item.queue_item_id}`,
      source_stage: "approval_queue",
      priority: item.priority,
      status: unappliedIds.has(item.queue_item_id) ? "pending_decision" : item.status,
      title: item.title,
      subject_ref: item.subject_ref,
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.queue_item_id,
    });
  }

  for (const error of artifacts.approval_decisions?.decision_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.decision_error.${error.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: "high",
      status: "needs_fix",
      title: `Fix approval decision: ${error.queue_item_id}`,
      subject_ref: {
        subject_type: "approval_decision",
        subject_id: error.queue_item_id,
      },
      reason: error.message,
      recommended_actions: ["fix_decision_file", "rerun_approval_apply"],
      source_ref: error.queue_item_id,
    });
  }

  for (const item of artifacts.approval_decisions?.applied_items ?? []) {
    if (!item.follow_up_action) continue;
    items.push({
      action_item_id: `dashboard.action.follow_up.${item.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: item.priority ?? "medium",
      status: "follow_up_required",
      title: `Follow up: ${item.follow_up_action}`,
      subject_ref: item.subject_ref,
      reason: item.comment || item.follow_up_action,
      recommended_actions: [item.follow_up_action],
      source_ref: item.queue_item_id,
    });
  }

  for (const error of artifacts.domain_pack_registry?.validation?.errors ?? []) {
    const subjectId = error.path ?? "domain_pack_registry";
    items.push({
      action_item_id: `dashboard.action.domain_pack_registry.${slugify(subjectId)}`,
      source_stage: "domain_pack_registry",
      priority: "high",
      status: "needs_fix",
      title: "Fix domain pack registry validation",
      subject_ref: {
        subject_type: "domain_pack_registry_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_pack_manifest", "rerun_packs_validate", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.policy_matrix_catalog?.validation?.errors ?? []) {
    const subjectId = error.path ?? "policy_matrix";
    items.push({
      action_item_id: `dashboard.action.policy_matrix.${slugify(subjectId)}`,
      source_stage: "policy_matrix_catalog",
      priority: "critical",
      status: "needs_fix",
      title: "Fix policy matrix validation",
      subject_ref: {
        subject_type: "policy_matrix_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_policy_matrix", "rerun_policy_catalog", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.policy_snapshot_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "policy_snapshot_ledger";
    items.push({
      action_item_id: `dashboard.action.policy_snapshot_ledger.${slugify(subjectId)}`,
      source_stage: "policy_snapshot_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix policy snapshot ledger validation",
      subject_ref: {
        subject_type: "policy_snapshot_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_policy_snapshot", "rerun_policy_snapshots", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.policy_snapshot_binding_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "policy_snapshot_binding_ledger";
    items.push({
      action_item_id: `dashboard.action.policy_snapshot_binding_ledger.${slugify(subjectId)}`,
      source_stage: "policy_snapshot_binding_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix policy snapshot binding ledger validation",
      subject_ref: {
        subject_type: "policy_snapshot_binding_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_policy_snapshot_binding", "rerun_policy_bindings", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.matter_tagging_decision_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "matter_tagging_decision_ledger";
    items.push({
      action_item_id: `dashboard.action.matter_tagging_decision_ledger.${slugify(subjectId)}`,
      source_stage: "matter_tagging_decision_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix matter tagging decision ledger validation",
      subject_ref: {
        subject_type: "matter_tagging_decision_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_matter_tagging_decision", "rerun_matter_tagging_ledger", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.access_audit_projection?.validation?.errors ?? []) {
    const subjectId = error.path ?? "access_audit_projection";
    items.push({
      action_item_id: `dashboard.action.access_audit_projection.${slugify(subjectId)}`,
      source_stage: "access_audit_projection",
      priority: "critical",
      status: "needs_fix",
      title: "Fix access audit projection validation",
      subject_ref: {
        subject_type: "access_audit_projection_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_access_audit_projection", "rerun_access_audit_projection", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.store_policy_adapter?.validation?.errors ?? []) {
    const subjectId = error.path ?? "store_policy_adapter";
    items.push({
      action_item_id: `dashboard.action.store_policy_adapter.${slugify(subjectId)}`,
      source_stage: "store_policy_adapter",
      priority: "critical",
      status: "needs_fix",
      title: "Fix store policy adapter validation",
      subject_ref: {
        subject_type: "store_policy_adapter_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_store_policy_adapter", "rerun_store_policy_adapter", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.conflict_check_interface?.validation?.errors ?? []) {
    const subjectId = error.path ?? "conflict_check_interface";
    items.push({
      action_item_id: `dashboard.action.conflict_check_interface.${slugify(subjectId)}`,
      source_stage: "conflict_check_interface",
      priority: "critical",
      status: "needs_fix",
      title: "Fix conflict check interface validation",
      subject_ref: {
        subject_type: "conflict_check_interface_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_conflict_check_interface", "rerun_conflict_check_interface", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.personal_workspace_boundary?.validation?.errors ?? []) {
    const subjectId = error.path ?? "personal_workspace_boundary";
    items.push({
      action_item_id: `dashboard.action.personal_workspace_boundary.${slugify(subjectId)}`,
      source_stage: "personal_workspace_boundary",
      priority: "critical",
      status: "needs_fix",
      title: "Fix personal workspace boundary validation",
      subject_ref: {
        subject_type: "personal_workspace_boundary_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_personal_workspace_boundary", "rerun_personal_workspace_boundary", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.policy_golden_fixtures?.validation?.errors ?? []) {
    const subjectId = error.path ?? "policy_golden_fixtures";
    items.push({
      action_item_id: `dashboard.action.policy_golden_fixtures.${slugify(subjectId)}`,
      source_stage: "policy_golden_fixtures",
      priority: "critical",
      status: "needs_fix",
      title: "Fix policy golden fixtures",
      subject_ref: {
        subject_type: "policy_golden_fixture_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_policy_fixture_case", "rerun_policy_golden_fixtures", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.policy_operations_surface?.validation?.errors ?? []) {
    const subjectId = error.path ?? "policy_operations_surface";
    items.push({
      action_item_id: `dashboard.action.policy_operations_surface.${slugify(subjectId)}`,
      source_stage: "policy_operations_surface",
      priority: "critical",
      status: "needs_fix",
      title: "Fix policy operations surface",
      subject_ref: {
        subject_type: "policy_operations_surface_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_policy_surface_source", "rerun_policy_operations_surface", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.matter_boundary_slice?.validation?.errors ?? []) {
    const subjectId = error.path ?? "matter_boundary_slice";
    items.push({
      action_item_id: `dashboard.action.matter_boundary_slice.${slugify(subjectId)}`,
      source_stage: "matter_boundary_slice",
      priority: "critical",
      status: "needs_fix",
      title: "Fix matter boundary slice",
      subject_ref: {
        subject_type: "matter_boundary_slice_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_matter_boundary_path", "rerun_matter_boundary_slice", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.identity_policy_matter_freeze?.validation?.errors ?? []) {
    const subjectId = error.path ?? "identity_policy_matter_freeze";
    items.push({
      action_item_id: `dashboard.action.identity_policy_matter_freeze.${slugify(subjectId)}`,
      source_stage: "identity_policy_matter_freeze",
      priority: "critical",
      status: "needs_fix",
      title: "Fix identity/policy/matter freeze",
      subject_ref: {
        subject_type: "identity_policy_matter_freeze_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_identity_policy_matter_source", "rerun_identity_policy_matter_freeze", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.resource_store_interface?.validation?.errors ?? []) {
    const subjectId = error.path ?? "resource_store_interface";
    items.push({
      action_item_id: `dashboard.action.resource_store_interface.${slugify(subjectId)}`,
      source_stage: "resource_store_interface",
      priority: "critical",
      status: "needs_fix",
      title: "Fix resource store interface",
      subject_ref: {
        subject_type: "resource_store_interface_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_resource_store_interface", "rerun_resource_store_interface", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.immutable_object_store_layout?.validation?.errors ?? []) {
    const subjectId = error.path ?? "immutable_object_store_layout";
    items.push({
      action_item_id: `dashboard.action.immutable_object_store_layout.${slugify(subjectId)}`,
      source_stage: "immutable_object_store_layout",
      priority: "critical",
      status: "needs_fix",
      title: "Fix immutable object store layout",
      subject_ref: {
        subject_type: "immutable_object_store_layout_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_object_store_layout", "rerun_object_store_layout", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.resource_version_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "resource_version_ledger";
    items.push({
      action_item_id: `dashboard.action.resource_version_ledger.${slugify(subjectId)}`,
      source_stage: "resource_version_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix resource version ledger",
      subject_ref: {
        subject_type: "resource_version_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_resource_version_ledger", "rerun_resource_version_ledger", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.normalized_text_contract?.validation?.errors ?? []) {
    const subjectId = error.path ?? "normalized_text_contract";
    items.push({
      action_item_id: `dashboard.action.normalized_text_contract.${slugify(subjectId)}`,
      source_stage: "normalized_text_contract",
      priority: "critical",
      status: "needs_fix",
      title: "Fix normalized text contract",
      subject_ref: {
        subject_type: "normalized_text_contract_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_normalized_text_contract", "rerun_normalized_text_contract", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.extractor_adapter_contract?.validation?.errors ?? []) {
    const subjectId = error.path ?? "extractor_adapter_contract";
    items.push({
      action_item_id: `dashboard.action.extractor_adapter_contract.${slugify(subjectId)}`,
      source_stage: "extractor_adapter_contract",
      priority: "critical",
      status: "needs_fix",
      title: "Fix extractor adapter contract",
      subject_ref: {
        subject_type: "extractor_adapter_contract_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_extractor_adapter_contract", "rerun_extractor_adapter_contract", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.source_span_store?.validation?.errors ?? []) {
    const subjectId = error.path ?? "source_span_store";
    items.push({
      action_item_id: `dashboard.action.source_span_store.${slugify(subjectId)}`,
      source_stage: "source_span_store",
      priority: "critical",
      status: "needs_fix",
      title: "Fix source span store",
      subject_ref: {
        subject_type: "source_span_store_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_source_span_store", "rerun_source_span_store", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.evidence_item_store?.validation?.errors ?? []) {
    const subjectId = error.path ?? "evidence_item_store";
    items.push({
      action_item_id: `dashboard.action.evidence_item_store.${slugify(subjectId)}`,
      source_stage: "evidence_item_store",
      priority: "critical",
      status: "needs_fix",
      title: "Fix evidence item store",
      subject_ref: {
        subject_type: "evidence_item_store_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_evidence_item_store", "rerun_evidence_item_store", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.fact_claim_store?.validation?.errors ?? []) {
    const subjectId = error.path ?? "fact_claim_store";
    items.push({
      action_item_id: `dashboard.action.fact_claim_store.${slugify(subjectId)}`,
      source_stage: "fact_claim_store",
      priority: "critical",
      status: "needs_fix",
      title: "Fix fact claim store",
      subject_ref: {
        subject_type: "fact_claim_store_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_fact_claim_store", "rerun_fact_claim_store", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.issue_graph_store?.validation?.errors ?? []) {
    const subjectId = error.path ?? "issue_graph_store";
    items.push({
      action_item_id: `dashboard.action.issue_graph_store.${slugify(subjectId)}`,
      source_stage: "issue_graph_store",
      priority: "critical",
      status: "needs_fix",
      title: "Fix issue graph store",
      subject_ref: {
        subject_type: "issue_graph_store_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_issue_graph_store", "rerun_issue_graph_store", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.citation_object_store?.validation?.errors ?? []) {
    const subjectId = error.path ?? "citation_object_store";
    items.push({
      action_item_id: `dashboard.action.citation_object_store.${slugify(subjectId)}`,
      source_stage: "citation_object_store",
      priority: "critical",
      status: "needs_fix",
      title: "Fix citation object store",
      subject_ref: {
        subject_type: "citation_object_store_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_citation_object_store", "rerun_citation_object_store", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.lineage_graph_builder?.validation?.errors ?? []) {
    const subjectId = error.path ?? "lineage_graph_builder";
    items.push({
      action_item_id: `dashboard.action.lineage_graph_builder.${slugify(subjectId)}`,
      source_stage: "lineage_graph_builder",
      priority: "critical",
      status: "needs_fix",
      title: "Fix lineage graph builder",
      subject_ref: {
        subject_type: "lineage_graph_builder_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_lineage_graph_builder", "rerun_lineage_graph_builder", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.evidence_coverage_score?.validation?.errors ?? []) {
    const subjectId = error.path ?? "evidence_coverage_score";
    items.push({
      action_item_id: `dashboard.action.evidence_coverage_score.${slugify(subjectId)}`,
      source_stage: "evidence_coverage_score",
      priority: "critical",
      status: "needs_fix",
      title: "Fix evidence coverage score",
      subject_ref: {
        subject_type: "evidence_coverage_score_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_evidence_coverage_score", "rerun_evidence_coverage_score", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.context_packet_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "context_packet_ledger";
    items.push({
      action_item_id: `dashboard.action.context_packet_ledger.${slugify(subjectId)}`,
      source_stage: "context_packet_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix context packet validation",
      subject_ref: {
        subject_type: "context_packet_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_context_packet_contract", "rerun_context_packets", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.model_routing_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "model_routing_ledger";
    items.push({
      action_item_id: `dashboard.action.model_routing_ledger.${slugify(subjectId)}`,
      source_stage: "model_routing_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix model routing validation",
      subject_ref: {
        subject_type: "model_routing_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_model_routing_policy", "rerun_model_routing", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.model_policy_enforcement?.validation?.errors ?? []) {
    const subjectId = error.path ?? "model_policy_enforcement";
    items.push({
      action_item_id: `dashboard.action.model_policy_enforcement.${slugify(subjectId)}`,
      source_stage: "model_policy_enforcement",
      priority: "critical",
      status: "needs_fix",
      title: "Fix model policy enforcement",
      subject_ref: {
        subject_type: "model_policy_enforcement_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_model_policy_gate", "rerun_model_policy_enforcement", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.tool_runtime_policy_enforcement?.validation?.errors ?? []) {
    const subjectId = error.path ?? "tool_runtime_policy_enforcement";
    items.push({
      action_item_id: `dashboard.action.tool_runtime_policy_enforcement.${slugify(subjectId)}`,
      source_stage: "tool_runtime_policy_enforcement",
      priority: "critical",
      status: "needs_fix",
      title: "Fix tool/runtime policy enforcement",
      subject_ref: {
        subject_type: "tool_runtime_policy_enforcement_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_runtime_tool_policy", "rerun_tool_runtime_policy_enforcement", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.output_destination_policy_enforcement?.validation?.errors ?? []) {
    const subjectId = error.path ?? "output_destination_policy_enforcement";
    items.push({
      action_item_id: `dashboard.action.output_destination_policy_enforcement.${slugify(subjectId)}`,
      source_stage: "output_destination_policy_enforcement",
      priority: "critical",
      status: "needs_fix",
      title: "Fix output destination policy enforcement",
      subject_ref: {
        subject_type: "output_destination_policy_enforcement_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_output_destination_policy", "rerun_output_destination_policy_enforcement", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.approval_authority_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "approval_authority_ledger";
    items.push({
      action_item_id: `dashboard.action.approval_authority_ledger.${slugify(subjectId)}`,
      source_stage: "approval_authority_ledger",
      priority: "critical",
      status: "needs_fix",
      title: "Fix approval authority ledger",
      subject_ref: {
        subject_type: "approval_authority_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_approval_authority_model", "rerun_approval_authority_ledger", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.cost_budget_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "cost_budget_ledger";
    items.push({
      action_item_id: `dashboard.action.cost_budget_ledger.${slugify(subjectId)}`,
      source_stage: "cost_budget_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix cost budget validation",
      subject_ref: {
        subject_type: "cost_budget_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_cost_policy", "rerun_cost_budgets", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.token_usage_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "token_usage_ledger";
    items.push({
      action_item_id: `dashboard.action.token_usage_ledger.${slugify(subjectId)}`,
      source_stage: "token_usage_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix token usage validation",
      subject_ref: {
        subject_type: "token_usage_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_token_usage_records", "rerun_token_usage", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.cost_attribution_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "cost_attribution_ledger";
    items.push({
      action_item_id: `dashboard.action.cost_attribution_ledger.${slugify(subjectId)}`,
      source_stage: "cost_attribution_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix cost attribution validation",
      subject_ref: {
        subject_type: "cost_attribution_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_cost_attribution", "rerun_cost_attribution", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.budget_alert_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "budget_alert_ledger";
    items.push({
      action_item_id: `dashboard.action.budget_alert_ledger.${slugify(subjectId)}`,
      source_stage: "budget_alert_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix budget alert validation",
      subject_ref: {
        subject_type: "budget_alert_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["review_budget_alert", "adjust_budget_thresholds", "rerun_budget_alerts"],
      source_ref: subjectId,
    });
  }

  for (const record of artifacts.budget_alert_ledger?.alert_records ?? []) {
    if (!["warning", "critical", "unbudgeted"].includes(record.alert_status)) continue;
    items.push({
      action_item_id: `dashboard.action.budget_alert_record.${slugify(record.alert_record_id)}`,
      source_stage: "budget_alert_ledger",
      priority: record.alert_status === "warning" ? "high" : "critical",
      status: "needs_review",
      title: "Review budget alert",
      subject_ref: {
        subject_type: "budget_alert_record",
        subject_id: record.alert_record_id,
      },
      reason: `${record.alert_status} budget alert for ${record.capability_id}: projected $${record.projected_usd}, remaining $${record.budget_remaining_usd ?? "n/a"}.`,
      recommended_actions: record.recommended_actions?.length > 0
        ? record.recommended_actions
        : ["review_budget_alert", "adjust_budget_thresholds", "rerun_budget_alerts"],
      source_ref: record.alert_record_id,
    });
  }

  for (const error of artifacts.human_review_packet_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_packet_ledger";
    items.push({
      action_item_id: `dashboard.action.human_review_packet_ledger.${slugify(subjectId)}`,
      source_stage: "human_review_packet_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review packet validation",
      subject_ref: {
        subject_type: "human_review_packet_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_gates", "rerun_human_gate_receipts", "rerun_human_review_packets"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_agenda?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_agenda";
    items.push({
      action_item_id: `dashboard.action.human_review_agenda.${slugify(subjectId)}`,
      source_stage: "human_review_agenda",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review agenda validation",
      subject_ref: {
        subject_type: "human_review_agenda_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_packets", "rerun_human_review_agenda", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  for (const agendaItem of artifacts.human_review_agenda?.agenda_items ?? []) {
    if (agendaItem.agenda_status === "clear") continue;
    items.push({
      action_item_id: `dashboard.action.human_review_agenda_item.${slugify(agendaItem.agenda_item_id)}`,
      source_stage: "human_review_agenda",
      priority: agendaItem.priority,
      status: agendaItem.agenda_status,
      title: agendaItem.title,
      subject_ref: {
        subject_type: "human_review_agenda_item",
        subject_id: agendaItem.agenda_item_id,
      },
      reason: agendaItem.reason,
      recommended_actions: agendaItem.checklist ?? agendaItem.recommended_actions ?? [],
      source_ref: agendaItem.review_packet_id,
    });
  }

  for (const error of artifacts.human_review_agenda_receipt_intake?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_agenda_receipt_intake";
    items.push({
      action_item_id: `dashboard.action.human_review_agenda_receipt_intake.${slugify(subjectId)}`,
      source_stage: "human_review_agenda_receipt_intake",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review agenda receipt intake",
      subject_ref: {
        subject_type: "human_review_agenda_receipt_intake_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_human_review_decision_template", "rerun_human_review_agenda_intake", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_receipt_workspace?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_receipt_workspace";
    items.push({
      action_item_id: `dashboard.action.human_review_receipt_workspace.${slugify(subjectId)}`,
      source_stage: "human_review_receipt_workspace",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review receipt workspace",
      subject_ref: {
        subject_type: "human_review_receipt_workspace_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_agenda_intake", "rerun_human_review_receipt_workspace", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_receipt_workspace_merge?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_receipt_workspace_merge";
    items.push({
      action_item_id: `dashboard.action.human_review_receipt_workspace_merge.${slugify(subjectId)}`,
      source_stage: "human_review_receipt_workspace_merge",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review receipt workspace merge",
      subject_ref: {
        subject_type: "human_review_receipt_workspace_merge_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_actor_receipt_input", "rerun_human_review_receipt_workspace_merge", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_context_bundle?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_context_bundle";
    items.push({
      action_item_id: `dashboard.action.human_review_context_bundle.${slugify(subjectId)}`,
      source_stage: "human_review_context_bundle",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review context bundle",
      subject_ref: {
        subject_type: "human_review_context_bundle_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_context_bundle", "inspect_context_sources", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_decision_register?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_decision_register";
    items.push({
      action_item_id: `dashboard.action.human_review_decision_register.${slugify(subjectId)}`,
      source_stage: "human_review_decision_register",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review decision register",
      subject_ref: {
        subject_type: "human_review_decision_register_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_decision_register", "inspect_context_cards", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_decision_register_merge?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_decision_register_merge";
    items.push({
      action_item_id: `dashboard.action.human_review_decision_register_merge.${slugify(subjectId)}`,
      source_stage: "human_review_decision_register_merge",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review decision register merge",
      subject_ref: {
        subject_type: "human_review_decision_register_merge_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_actor_decision_receipt_input", "rerun_human_review_decision_register_merge", "rerun_human_gate_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_validation_feedback?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_validation_feedback";
    items.push({
      action_item_id: `dashboard.action.human_review_validation_feedback.${slugify(subjectId)}`,
      source_stage: "human_review_validation_feedback",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review validation feedback",
      subject_ref: {
        subject_type: "human_review_validation_feedback_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_gate_receipt_validation", "rerun_human_review_validation_feedback", "inspect_actor_feedback"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_correction_workspace?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_correction_workspace";
    items.push({
      action_item_id: `dashboard.action.human_review_correction_workspace.${slugify(subjectId)}`,
      source_stage: "human_review_correction_workspace",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review correction workspace",
      subject_ref: {
        subject_type: "human_review_correction_workspace_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_validation_feedback", "rerun_human_review_correction_workspace", "inspect_actor_corrections"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_correction_workspace_merge?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_correction_workspace_merge";
    items.push({
      action_item_id: `dashboard.action.human_review_correction_workspace_merge.${slugify(subjectId)}`,
      source_stage: "human_review_correction_workspace_merge",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review correction workspace merge",
      subject_ref: {
        subject_type: "human_review_correction_workspace_merge_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_correction_workspace", "rerun_human_review_correction_workspace_merge", "inspect_actor_correction_inputs"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_correction_validation?.receipt_errors ?? []) {
    const subjectId = error.gate_item_id ?? error.field ?? "human_review_correction_validation";
    items.push({
      action_item_id: `dashboard.action.human_review_correction_validation.${slugify(subjectId)}`,
      source_stage: "human_review_correction_validation",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review correction validation",
      subject_ref: {
        subject_type: "human_review_correction_validation_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_actor_correction_receipt_input", "rerun_human_review_correction_workspace_merge", "rerun_human_review_correction_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_correction_feedback?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_correction_feedback";
    items.push({
      action_item_id: `dashboard.action.human_review_correction_feedback.${slugify(subjectId)}`,
      source_stage: "human_review_correction_feedback",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review correction feedback",
      subject_ref: {
        subject_type: "human_review_correction_feedback_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_correction_validation", "rerun_human_review_correction_feedback", "inspect_actor_correction_feedback"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_ledger";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_ledger.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle ledger",
      subject_ref: {
        subject_type: "human_review_cycle_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_validation_feedback", "rerun_human_review_correction_feedback", "rerun_human_review_cycle_ledger"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_work_orders?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_work_orders";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_work_orders.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_work_orders",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle work orders",
      subject_ref: {
        subject_type: "human_review_cycle_work_orders_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_ledger", "rerun_human_review_cycle_work_orders"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_target_audit?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_target_audit";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_target_audit.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_target_audit",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle target audit",
      subject_ref: {
        subject_type: "human_review_cycle_target_audit_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_work_orders", "rerun_human_review_cycle_target_audit"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_triage_inbox?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_triage_inbox";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_triage_inbox.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_triage_inbox",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle triage inbox",
      subject_ref: {
        subject_type: "human_review_cycle_triage_inbox_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_target_audit", "rerun_human_review_cycle_triage_inbox"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_reviewer_console?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_reviewer_console";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_reviewer_console.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_reviewer_console",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle reviewer console",
      subject_ref: {
        subject_type: "human_review_cycle_reviewer_console_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_triage_inbox", "rerun_human_review_cycle_reviewer_console"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_field_audit?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_field_audit";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_field_audit.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_field_audit",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt field audit",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_field_audit_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_reviewer_console", "rerun_human_review_cycle_receipt_field_audit"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_pack?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_pack";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_pack.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_pack",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion pack",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_pack_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_field_audit", "rerun_human_review_cycle_receipt_completion_pack"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_verification?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_verification";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_verification.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_verification",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion verification",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_verification_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_pack", "rerun_human_review_cycle_receipt_completion_verification"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_workbench?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_workbench";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_workbench.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_workbench",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion workbench",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_workbench_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_verification", "rerun_human_review_cycle_receipt_completion_workbench"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_runbook?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_runbook";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_runbook.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_runbook",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion runbook",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_runbook_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_workbench", "rerun_human_review_cycle_receipt_completion_runbook"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_readiness?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_readiness";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_readiness.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_readiness",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion readiness",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_readiness_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_runbook", "rerun_human_review_cycle_receipt_completion_readiness"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_queue?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_queue";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_queue.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_queue",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command queue",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_queue_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_readiness", "rerun_human_review_cycle_receipt_completion_command_queue"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipts?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_receipts";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipts.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipts",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command receipts",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipts_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_command_queue", "rerun_human_review_cycle_receipt_completion_command_receipts"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.receipt_errors ?? []) {
    const subjectId = error.queue_item_id ?? "human_review_cycle_receipt_completion_command_receipt_validation";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_validation.${slugify(subjectId)}.${slugify(error.field)}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_validation",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command receipt",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_validation_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fill_command_receipt_input", "rerun_human_review_cycle_receipt_completion_command_receipt_validation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_receipt_feedback";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_feedback.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_feedback",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command receipt feedback",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_feedback_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_command_receipt_validation", "rerun_human_review_cycle_receipt_completion_command_receipt_feedback", "inspect_command_receipt_actor_feedback"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_receipt_workspace";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_workspace.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_workspace",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command receipt workspace",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_workspace_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_command_receipt_feedback", "rerun_human_review_cycle_receipt_completion_command_receipt_workspace", "inspect_command_receipt_actor_workspace"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_receipt_workspace_merge";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_workspace_merge.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_workspace_merge",
      priority: "high",
      status: "needs_fix",
      title: "Fix human review cycle receipt completion command receipt workspace merge",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_workspace_merge_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_command_receipt_workspace", "rerun_human_review_cycle_receipt_completion_command_receipt_workspace_merge", "inspect_merged_command_receipt_input"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.receipt_errors ?? []) {
    const subjectId = error.queue_item_id ?? error.field ?? "human_review_cycle_receipt_completion_command_receipt_workspace_validation";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_workspace_validation.${slugify(subjectId)}.${slugify(error.field ?? "receipt")}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_workspace_validation",
      priority: "high",
      status: "needs_fix",
      title: "Fix merged command receipt validation",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_workspace_validation_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_merged_command_receipt_input", "rerun_human_review_cycle_receipt_completion_command_receipt_workspace_validation", "inspect_command_receipt_workspace_merge"],
      source_ref: `${subjectId}:${error.field ?? "receipt"}`,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_receipt_application?.receipt_errors ?? []) {
    const subjectId = error.queue_item_id ?? error.field ?? "human_review_cycle_receipt_completion_command_receipt_application";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_receipt_application.${slugify(subjectId)}.${slugify(error.field ?? "receipt")}`,
      source_stage: "human_review_cycle_receipt_completion_command_receipt_application",
      priority: "high",
      status: "needs_fix",
      title: "Fix command receipt application input",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_receipt_application_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_validated_command_receipt", "rerun_human_review_cycle_receipt_completion_command_receipt_workspace_validation", "rerun_human_review_cycle_receipt_completion_command_receipt_application"],
      source_ref: `${subjectId}:${error.field ?? "receipt"}`,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_reconciliation?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_reconciliation";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_reconciliation.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_reconciliation",
      priority: "high",
      status: "needs_fix",
      title: "Fix receipt completion reconciliation",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_reconciliation_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_cycle_receipt_completion_readiness", "rerun_command_receipt_application", "rerun_completion_reconciliation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_baseline?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_baseline";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_baseline.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_baseline",
      priority: "high",
      status: "needs_fix",
      title: "Fix receipt completion baseline",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_baseline_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_completion_reconciliation", "rerun_completion_baseline"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_manual_command_receipt_pack";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_manual_command_receipt_pack.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_manual_command_receipt_pack",
      priority: "high",
      status: "needs_fix",
      title: "Fix manual command receipt pack",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_manual_command_receipt_pack_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_completion_baseline", "rerun_manual_command_receipt_pack"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_held_command_resolution?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_held_command_resolution";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_held_command_resolution.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_held_command_resolution",
      priority: "high",
      status: "needs_fix",
      title: "Fix held command resolution plan",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_held_command_resolution_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_manual_command_receipt_pack", "rerun_held_command_resolution"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_protected_approval_request_pack";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_protected_approval_request_pack.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_protected_approval_request_pack",
      priority: "critical",
      status: "needs_fix",
      title: "Fix protected approval request pack",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_protected_approval_request_pack_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_held_command_resolution", "rerun_protected_approval_request_pack"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_manual_revalidation?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_manual_revalidation";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_manual_revalidation.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_manual_revalidation",
      priority: "high",
      status: "needs_fix",
      title: "Fix manual receipt revalidation",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_manual_revalidation_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_command_receipt_workspace_validation", "rerun_command_receipt_application", "rerun_manual_revalidation"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_command_queue_patch_projection";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_command_queue_patch_projection.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_command_queue_patch_projection",
      priority: "high",
      status: "needs_fix",
      title: "Fix command queue patch projection",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_command_queue_patch_projection_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_manual_revalidation", "rerun_command_queue_patch_projection"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_cycle_receipt_completion_closeout_ledger?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_cycle_receipt_completion_closeout_ledger";
    items.push({
      action_item_id: `dashboard.action.human_review_cycle_receipt_completion_closeout_ledger.${slugify(subjectId)}`,
      source_stage: "human_review_cycle_receipt_completion_closeout_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix receipt completion closeout ledger",
      subject_ref: {
        subject_type: "human_review_cycle_receipt_completion_closeout_ledger_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_completion_baseline", "rerun_manual_revalidation", "rerun_closeout_ledger"],
      source_ref: subjectId,
    });
  }

  for (const error of artifacts.human_review_v1_regression_freeze?.validation?.errors ?? []) {
    const subjectId = error.path ?? "human_review_v1_regression_freeze";
    items.push({
      action_item_id: `dashboard.action.human_review_v1_regression_freeze.${slugify(subjectId)}`,
      source_stage: "human_review_v1_regression_freeze",
      priority: "high",
      status: "needs_fix",
      title: "Fix Human Review v1 regression freeze",
      subject_ref: {
        subject_type: "human_review_v1_regression_freeze_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["rerun_human_review_v1_regression_freeze", "rerun_dashboard_build", "rerun_control_plane_loop"],
      source_ref: subjectId,
    });
  }

  if (artifacts.personal_dev_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.personal_dev.${artifacts.personal_dev_slice.approval_id ?? "merge"}`,
      source_stage: "personal_dev_slice",
      priority: "high",
      status: "pending_approval",
      title: "Review personal-dev merge approval",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.personal_dev_slice.approval_id ?? "personal_dev.merge",
      },
      reason: artifacts.personal_dev_slice.blocked_reason ?? "merge approval pending",
      recommended_actions: ["review_pr_draft", "run_canonical_tests", "approve_or_request_changes"],
      source_ref: artifacts.personal_dev_slice.workflow_run_id ?? null,
    });
  }

  if (artifacts.law_firm_ldd_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.law_firm_ldd.${artifacts.law_firm_ldd_slice.approval_id ?? "attorney_review"}`,
      source_stage: "law_firm_ldd_slice",
      priority: "high",
      status: "pending_approval",
      title: "Review law-firm LDD issue report",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.law_firm_ldd_slice.approval_id ?? "law_firm_ldd.attorney_review",
      },
      reason: artifacts.law_firm_ldd_slice.blocked_reason ?? "attorney approval pending",
      recommended_actions: ["review_citations", "review_issue_candidates", "approve_or_request_changes"],
      source_ref: artifacts.law_firm_ldd_slice.workflow_run_id ?? null,
    });
  }

  if (artifacts.creative_document_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.creative_document.${artifacts.creative_document_slice.approval_id ?? "human_review"}`,
      source_stage: "creative_document_slice",
      priority: "medium",
      status: "pending_approval",
      title: "Review creative-document draft deck",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.creative_document_slice.approval_id ?? "creative_document.human_review",
      },
      reason: artifacts.creative_document_slice.blocked_reason ?? "human approval pending",
      recommended_actions: ["review_deck_outline", "inspect_pptx_draft", "approve_or_request_changes"],
      source_ref: artifacts.creative_document_slice.workflow_run_id ?? null,
    });
  }

  for (const action of artifacts.protected_delivery_queue?.delivery_actions ?? []) {
    if (["delivered", "ready_for_delivery"].includes(action.delivery_status)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery.${slugify(action.delivery_action_id)}`,
      source_stage: "protected_delivery_queue",
      priority: action.priority,
      status: action.delivery_status,
      title: `Resolve delivery blocker for ${action.artifact_type}`,
      subject_ref: {
        subject_type: "delivery_action",
        subject_id: action.delivery_action_id,
      },
      reason: action.blocked_reasons.length > 0 ? action.blocked_reasons.join(", ") : action.delivery_status,
      recommended_actions: action.recommended_actions ?? [],
      source_ref: action.artifact_id,
    });
  }

  for (const matter of artifacts.matter_cockpit?.matters ?? []) {
    if (matter.status !== "blocked") continue;
    items.push({
      action_item_id: `dashboard.action.matter.${slugify(matter.matter_key)}`,
      source_stage: "matter_cockpit",
      priority: matter.high_priority_action_count > 0 ? "high" : "medium",
      status: "blocked",
      title: `Resolve blocked matter/project: ${matter.matter_id}`,
      subject_ref: {
        subject_type: "matter",
        subject_id: matter.matter_key,
      },
      reason: `${matter.blocked_delivery_count} blocked delivery action(s), ${matter.blocking_gate_count} blocking gate(s).`,
      recommended_actions: ["open_matter_cockpit", "resolve_gate_or_approval_blockers", "rerun_matter_cockpit"],
      source_ref: matter.matter_key,
    });
  }

  for (const item of artifacts.approval_inbox?.items ?? []) {
    if (appliedApprovalInboxIds.has(item.approval_item_id)) continue;
    items.push({
      action_item_id: `dashboard.action.approval_inbox.${slugify(item.approval_item_id)}`,
      source_stage: "approval_inbox",
      priority: item.priority,
      status: item.status,
      title: item.title,
      subject_ref: {
        subject_type: item.item_type,
        subject_id: item.approval_item_id,
      },
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.approval_id ?? item.delivery_action_id,
    });
  }

  for (const error of artifacts.approval_inbox_decisions?.decision_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.approval_inbox_decision_error.${slugify(error.approval_item_id)}`,
      source_stage: "approval_inbox_decisions",
      priority: "high",
      status: "needs_fix",
      title: "Fix approval inbox decision",
      subject_ref: {
        subject_type: "approval_inbox_decision",
        subject_id: error.approval_item_id ?? "unknown",
      },
      reason: error.message,
      recommended_actions: ["fix_decision_file", "rerun_approval_inbox_apply", "rebuild_dashboard"],
      source_ref: error.approval_item_id ?? null,
    });
  }

  for (const item of artifacts.approval_inbox_decisions?.applied_items ?? []) {
    if (!item.follow_up_action) continue;
    items.push({
      action_item_id: `dashboard.action.approval_inbox_follow_up.${slugify(item.approval_item_id)}`,
      source_stage: "approval_inbox_decisions",
      priority: item.priority ?? "medium",
      status: "follow_up_required",
      title: `Follow up approval inbox decision: ${item.follow_up_action}`,
      subject_ref: item.subject_ref,
      reason: item.comment || item.follow_up_action,
      recommended_actions: [item.follow_up_action],
      source_ref: item.approval_item_id,
    });
  }

  const receiptLedgerPacketIds = new Set([
    ...(artifacts.delivery_receipt_ledger?.applied_receipts ?? []).map((receipt) => receipt.packet_id),
    ...(artifacts.delivery_receipt_ledger?.pending_receipts ?? []).map((receipt) => receipt.packet_id),
  ]);
  for (const packet of artifacts.delivery_execution_draft?.execution_packets ?? []) {
    if (receiptLedgerPacketIds.has(packet.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_execution.${slugify(packet.packet_id)}`,
      source_stage: "delivery_execution_draft",
      priority: packet.priority,
      status: packet.execution_status,
      title: `Manually execute delivery packet: ${packet.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_execution_packet",
        subject_id: packet.packet_id,
      },
      reason: `${packet.candidate_count} ready artifact(s) require final manual execution via ${packet.delivery_channel}.`,
      recommended_actions: packet.checklist ?? [],
      source_ref: packet.packet_id,
    });
  }

  const closeoutPacketIds = new Set((artifacts.delivery_closeout_queue?.closeout_items ?? []).map((item) => item.packet_id));
  for (const pending of artifacts.delivery_receipt_ledger?.pending_receipts ?? []) {
    if (closeoutPacketIds.has(pending.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_receipt.${slugify(pending.packet_id)}`,
      source_stage: "delivery_receipt_ledger",
      priority: "high",
      status: "receipt_pending",
      title: `Record delivery receipt: ${pending.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_receipt",
        subject_id: pending.packet_id,
      },
      reason: `${pending.reason}; ${pending.artifact_ids?.length ?? 0} artifact(s) still need receipt recording.`,
      recommended_actions: ["execute_manually_if_not_done", "fill_receipt_template", "rerun_delivery_receipts"],
      source_ref: pending.packet_id,
    });
  }

  for (const error of artifacts.delivery_receipt_ledger?.receipt_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.delivery_receipt_error.${slugify(error.packet_id)}`,
      source_stage: "delivery_receipt_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix delivery receipt",
      subject_ref: {
        subject_type: "delivery_receipt_error",
        subject_id: error.packet_id ?? "unknown",
      },
      reason: error.message,
      recommended_actions: ["fix_receipt_file", "rerun_delivery_receipts", "rebuild_dashboard"],
      source_ref: error.packet_id ?? null,
    });
  }

  const validationItems = artifacts.closeout_receipt_validation?.validation_items ?? [];
  const validationPacketIdsWithAction = new Set(
    validationItems
      .filter((item) => ["ready_to_apply", "invalid_receipt", "missing_receipt"].includes(item.validation_status))
      .map((item) => item.packet_id),
  );
  for (const item of artifacts.delivery_closeout_queue?.closeout_items ?? []) {
    if (validationPacketIdsWithAction.has(item.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_closeout.${slugify(item.closeout_item_id)}`,
      source_stage: "delivery_closeout_queue",
      priority: item.priority,
      status: item.status,
      title: `Execute delivery closeout: ${item.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_closeout_item",
        subject_id: item.closeout_item_id,
      },
      reason: `${item.reason}; ${item.artifact_count} artifact(s) need manual closeout and receipt recording.`,
      recommended_actions: item.closeout_checklist ?? [],
      source_ref: item.packet_id,
    });
  }

  const validationPacketIds = new Set(validationItems.map((item) => item.packet_id));
  const appliedCloseoutPacketIds = new Set((artifacts.closeout_receipt_application?.applied_receipts ?? []).map((receipt) => receipt.packet_id));
  for (const item of validationItems) {
    if (appliedCloseoutPacketIds.has(item.packet_id)) continue;
    if (item.validation_status === "ready_to_apply") {
      items.push({
        action_item_id: `dashboard.action.closeout_receipt_ready.${slugify(item.validation_item_id)}`,
        source_stage: "closeout_receipt_validation",
        priority: item.priority ?? "high",
        status: "ready_to_apply",
        title: `Apply validated delivery receipt: ${item.delivery_target}`,
        subject_ref: {
          subject_type: "closeout_receipt_validation",
          subject_id: item.validation_item_id,
        },
        reason: `${item.packet_id} is validated and ready for delivery:receipts.`,
        recommended_actions: ["run_delivery_receipts_with_validated_input", "rerun_delivery_reconcile", "rebuild_dashboard"],
        source_ref: item.packet_id,
      });
      continue;
    }
    if (!["invalid_receipt", "missing_receipt"].includes(item.validation_status)) continue;
    items.push({
      action_item_id: `dashboard.action.closeout_receipt_validation.${slugify(item.validation_item_id)}`,
      source_stage: "closeout_receipt_validation",
      priority: item.priority ?? "high",
      status: item.validation_status,
      title: `Fix closeout receipt: ${item.delivery_target}`,
      subject_ref: {
        subject_type: "closeout_receipt_validation",
        subject_id: item.validation_item_id,
      },
      reason: item.errors?.map((candidate) => candidate.message).join("; ") || item.validation_status,
      recommended_actions: ["fix_receipt_input", "rerun_delivery_closeout_validate"],
      source_ref: item.packet_id,
    });
  }

  if (artifacts.closeout_receipt_application?.application_status === "blocked_validation_errors") {
    items.push({
      action_item_id: "dashboard.action.closeout_receipt_application.validation_errors",
      source_stage: "closeout_receipt_application",
      priority: "high",
      status: "blocked_validation_errors",
      title: "Fix closeout receipt application blockers",
      subject_ref: {
        subject_type: "closeout_receipt_application",
        subject_id: artifacts.closeout_receipt_application.application_id ?? "closeout_receipt_application",
      },
      reason: `${artifacts.closeout_receipt_application.summary?.validation_error_count ?? 0} validation error(s) block receipt application.`,
      recommended_actions: ["fix_closeout_receipts", "rerun_delivery_closeout_validate", "rerun_delivery_closeout_apply"],
      source_ref: artifacts.closeout_receipt_application.application_id ?? null,
    });
  }

  for (const stepResult of artifacts.control_plane_pipeline?.step_results ?? []) {
    if (stepResult.status === "passed" || stepResult.status === "skipped") continue;
    items.push({
      action_item_id: `dashboard.action.control_plane_pipeline.${slugify(stepResult.step_id)}`,
      source_stage: "control_plane_pipeline",
      priority: stepResult.status === "failed" ? "high" : "medium",
      status: stepResult.status,
      title: `Fix pipeline step: ${stepResult.label}`,
      subject_ref: {
        subject_type: "control_plane_pipeline_step",
        subject_id: stepResult.step_id,
      },
      reason: stepResult.error ?? stepResult.status,
      recommended_actions: ["inspect_pipeline_step_logs", "fix_source_artifact_or_command", "rerun_control_plane_pipeline"],
      source_ref: stepResult.step_id,
    });
  }

  for (const stepResult of artifacts.control_plane_loop?.step_results ?? []) {
    if (stepResult.status === "passed" || stepResult.status === "skipped") continue;
    items.push({
      action_item_id: `dashboard.action.control_plane_loop.${slugify(stepResult.step_id)}`,
      source_stage: "control_plane_loop",
      priority: stepResult.status === "failed" ? "high" : "medium",
      status: stepResult.status,
      title: `Fix control plane loop step: ${stepResult.label}`,
      subject_ref: {
        subject_type: "control_plane_loop_step",
        subject_id: stepResult.step_id,
      },
      reason: stepResult.error ?? stepResult.status,
      recommended_actions: ["inspect_loop_step_logs", "fix_source_artifact_or_command", "rerun_control_plane_loop"],
      source_ref: stepResult.step_id,
    });
  }

  for (const item of artifacts.control_plane_goal_checkpoint?.checkpoint_items ?? []) {
    if (item.status === "passed") continue;
    items.push({
      action_item_id: `dashboard.action.goal_checkpoint.${slugify(item.checkpoint_item_id)}`,
      source_stage: "control_plane_goal_checkpoint",
      priority: item.priority,
      status: item.status,
      title: `Resolve goal checkpoint: ${item.label}`,
      subject_ref: {
        subject_type: "goal_checkpoint_item",
        subject_id: item.checkpoint_item_id,
      },
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.checkpoint_item_id,
    });
  }

  for (const healthCheck of artifacts.control_plane_health?.health_checks ?? []) {
    if (healthCheck.status === "passed") continue;
    items.push({
      action_item_id: `dashboard.action.control_plane_health.${slugify(healthCheck.check_id)}`,
      source_stage: "control_plane_health",
      priority: healthSeverityToPriority(healthCheck.severity),
      status: healthCheck.status,
      title: `Resolve health check: ${healthCheck.label}`,
      subject_ref: {
        subject_type: "control_plane_health_check",
        subject_id: healthCheck.check_id,
      },
      reason: healthCheck.reason,
      recommended_actions: healthCheck.recommended_actions ?? [],
      source_ref: healthCheck.check_id,
    });
  }

  const ledgerPendingPacketIds = new Set((artifacts.delivery_receipt_ledger?.pending_receipts ?? []).map((pending) => pending.packet_id));
  for (const pending of artifacts.post_delivery_reconciliation?.outstanding_receipts ?? []) {
    if (ledgerPendingPacketIds.has(pending.packet_id)) continue;
    if (closeoutPacketIds.has(pending.packet_id)) continue;
    if (validationPacketIds.has(pending.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.post_delivery_receipt.${slugify(pending.packet_id)}`,
      source_stage: "post_delivery_reconciliation",
      priority: "high",
      status: "receipt_outstanding",
      title: `Close post-delivery receipt: ${pending.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_receipt",
        subject_id: pending.packet_id ?? "unknown",
      },
      reason: `${pending.reason ?? "receipt_outstanding"}; reconciliation still sees ${pending.artifact_ids?.length ?? 0} artifact(s) without receipt.`,
      recommended_actions: ["fill_receipt_template", "rerun_delivery_receipts", "rerun_delivery_reconcile"],
      source_ref: pending.packet_id ?? null,
    });
  }

  return items;
}

function buildDashboardSummary(artifacts, stageStatuses, actionItems) {
  const patchedEvidence = artifacts.approval_decisions?.patched_resource_evidence;
  const reviewCounts = countReviewStatuses(patchedEvidence?.evidence_items ?? []);
  const viewerSummary = artifacts.evidence_viewer?.summary ?? artifacts.evidence_viewer?.review_packet?.summary ?? {};
  const decisionSummary = artifacts.approval_decisions?.summary ?? {};
  const queueSummary = artifacts.approval_queue?.summary ?? {};
  const blockingGateCount = viewerSummary.blocking_gate_count ?? countBlockingGates(artifacts.resource_ingest?.gate_results ?? []);
  const pendingApprovalCount = (
    decisionSummary.pending_count ?? queueSummary.by_status?.pending ?? queueSummary.total_items ?? 0
  ) + pendingSliceApprovalCount(artifacts.law_firm_ldd_slice)
    + pendingSliceApprovalCount(artifacts.personal_dev_slice)
    + pendingSliceApprovalCount(artifacts.creative_document_slice);
  const blockedResourceCount = artifacts.resource_ingest?.summary?.blocked_count ?? viewerSummary.blocked_item_count ?? 0;
  const decisionErrorCount = artifacts.approval_decisions?.decision_errors?.length ?? 0;

  return {
    overall_status: deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount),
    stage_count: stageStatuses.length,
    missing_stage_count: stageStatuses.filter((stage) => stage.status === "missing").length,
    blocked_stage_count: stageStatuses.filter((stage) => stage.status === "blocked").length,
    pending_stage_count: stageStatuses.filter((stage) => stage.status === "pending").length,
    resource_count: artifacts.resource_ingest?.summary?.promoted_resource_count ?? viewerSummary.resource_count ?? 0,
    evidence_count: artifacts.resource_ingest?.summary?.promoted_evidence_count ?? viewerSummary.evidence_count ?? 0,
    resource_contract_freeze_resource_count: artifacts.resource_contract_freeze?.summary?.resource_count ?? 0,
    resource_contract_freeze_resource_version_count: artifacts.resource_contract_freeze?.summary?.resource_version_count ?? 0,
    resource_contract_freeze_content_hash_count: artifacts.resource_contract_freeze?.summary?.content_hash_count ?? 0,
    resource_contract_freeze_source_system_count: artifacts.resource_contract_freeze?.summary?.source_system_count ?? 0,
    resource_contract_freeze_external_id_count: artifacts.resource_contract_freeze?.summary?.external_id_count ?? 0,
    resource_contract_freeze_classification_count: artifacts.resource_contract_freeze?.summary?.classification_count ?? 0,
    resource_contract_freeze_matter_link_count: artifacts.resource_contract_freeze?.summary?.matter_link_count ?? 0,
    resource_contract_freeze_latest_version_link_count: artifacts.resource_contract_freeze?.summary?.latest_version_link_count ?? 0,
    resource_contract_freeze_failed_validation_item_count: artifacts.resource_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    resource_contract_freeze_validation_error_count: artifacts.resource_contract_freeze?.summary?.validation_error_count ?? artifacts.resource_contract_freeze?.validation?.errors?.length ?? 0,
    identity_model_status: artifacts.identity_model?.summary?.identity_model_status ?? "unknown",
    identity_model_tenant_count: artifacts.identity_model?.summary?.tenant_count ?? 0,
    identity_model_user_count: artifacts.identity_model?.summary?.user_count ?? 0,
    identity_model_role_count: artifacts.identity_model?.summary?.role_count ?? 0,
    identity_model_tenant_role_count: artifacts.identity_model?.summary?.tenant_role_count ?? 0,
    identity_model_matter_role_count: artifacts.identity_model?.summary?.matter_role_count ?? 0,
    identity_model_system_role_count: artifacts.identity_model?.summary?.system_role_count ?? 0,
    identity_model_role_assignment_count: artifacts.identity_model?.summary?.role_assignment_count ?? 0,
    identity_model_human_user_role_assignment_count: artifacts.identity_model?.summary?.human_user_role_assignment_count ?? 0,
    identity_model_actor_role_assignment_count: artifacts.identity_model?.summary?.actor_role_assignment_count ?? 0,
    identity_model_actor_principal_count: artifacts.identity_model?.summary?.actor_principal_count ?? 0,
    identity_model_human_actor_principal_count: artifacts.identity_model?.summary?.human_actor_principal_count ?? 0,
    identity_model_service_actor_principal_count: artifacts.identity_model?.summary?.service_actor_principal_count ?? 0,
    identity_model_actor_user_binding_count: artifacts.identity_model?.summary?.actor_user_binding_count ?? 0,
    identity_model_human_actor_user_binding_count: artifacts.identity_model?.summary?.human_actor_user_binding_count ?? 0,
    identity_model_system_actor_binding_count: artifacts.identity_model?.summary?.system_actor_binding_count ?? 0,
    identity_model_failed_validation_item_count: artifacts.identity_model?.summary?.failed_validation_item_count ?? 0,
    identity_model_validation_error_count: artifacts.identity_model?.summary?.validation_error_count ?? artifacts.identity_model?.validation?.errors?.length ?? 0,
    matter_contract_freeze_client_count: artifacts.matter_contract_freeze?.summary?.client_count ?? 0,
    matter_contract_freeze_party_count: artifacts.matter_contract_freeze?.summary?.party_count ?? 0,
    matter_contract_freeze_client_party_count: artifacts.matter_contract_freeze?.summary?.client_party_count ?? 0,
    matter_contract_freeze_counterparty_count: artifacts.matter_contract_freeze?.summary?.counterparty_count ?? 0,
    matter_contract_freeze_matter_count: artifacts.matter_contract_freeze?.summary?.matter_count ?? 0,
    matter_contract_freeze_matter_team_count: artifacts.matter_contract_freeze?.summary?.matter_team_count ?? 0,
    matter_contract_freeze_matter_boundary_count: artifacts.matter_contract_freeze?.summary?.matter_boundary_count ?? 0,
    matter_contract_freeze_matter_with_client_count: artifacts.matter_contract_freeze?.summary?.matter_with_client_count ?? 0,
    matter_contract_freeze_matter_with_party_count: artifacts.matter_contract_freeze?.summary?.matter_with_party_count ?? 0,
    matter_contract_freeze_matter_with_counterparty_count: artifacts.matter_contract_freeze?.summary?.matter_with_counterparty_count ?? 0,
    matter_contract_freeze_matter_with_team_count: artifacts.matter_contract_freeze?.summary?.matter_with_team_count ?? 0,
    matter_contract_freeze_matter_with_wall_count: artifacts.matter_contract_freeze?.summary?.matter_with_wall_count ?? 0,
    matter_contract_freeze_matter_with_policy_snapshot_count: artifacts.matter_contract_freeze?.summary?.matter_with_policy_snapshot_count ?? 0,
    matter_contract_freeze_failed_validation_item_count: artifacts.matter_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    matter_contract_freeze_validation_error_count: artifacts.matter_contract_freeze?.summary?.validation_error_count ?? artifacts.matter_contract_freeze?.validation?.errors?.length ?? 0,
    client_counterparty_registry_status: artifacts.client_counterparty_registry?.summary?.registry_status ?? "unknown",
    client_counterparty_source_matter_contract_status: artifacts.client_counterparty_registry?.summary?.source_matter_contract_status ?? "unknown",
    client_counterparty_party_count: artifacts.client_counterparty_registry?.summary?.party_count ?? 0,
    client_counterparty_client_count: artifacts.client_counterparty_registry?.summary?.client_count ?? 0,
    client_counterparty_counterparty_count: artifacts.client_counterparty_registry?.summary?.counterparty_count ?? 0,
    client_counterparty_stable_party_id_count: artifacts.client_counterparty_registry?.summary?.stable_party_id_count ?? 0,
    client_counterparty_alias_key_count: artifacts.client_counterparty_registry?.summary?.alias_key_count ?? 0,
    client_counterparty_conflict_reference_count: artifacts.client_counterparty_registry?.summary?.conflict_reference_count ?? 0,
    client_counterparty_matter_party_link_count: artifacts.client_counterparty_registry?.summary?.matter_party_link_count ?? 0,
    client_counterparty_matter_with_client_link_count: artifacts.client_counterparty_registry?.summary?.matter_with_client_link_count ?? 0,
    client_counterparty_matter_with_counterparty_link_count: artifacts.client_counterparty_registry?.summary?.matter_with_counterparty_link_count ?? 0,
    client_counterparty_duplicate_alias_count: artifacts.client_counterparty_registry?.summary?.duplicate_alias_count ?? 0,
    client_counterparty_failed_validation_item_count: artifacts.client_counterparty_registry?.summary?.failed_validation_item_count ?? 0,
    client_counterparty_validation_error_count: artifacts.client_counterparty_registry?.summary?.validation_error_count ?? artifacts.client_counterparty_registry?.validation?.errors?.length ?? 0,
    matter_profile_team_ledger_status: artifacts.matter_profile_team_ledger?.summary?.ledger_status ?? "unknown",
    matter_profile_team_source_matter_contract_status: artifacts.matter_profile_team_ledger?.summary?.source_matter_contract_status ?? "unknown",
    matter_profile_team_source_identity_model_status: artifacts.matter_profile_team_ledger?.summary?.source_identity_model_status ?? "unknown",
    matter_profile_team_source_client_counterparty_registry_status: artifacts.matter_profile_team_ledger?.summary?.source_client_counterparty_registry_status ?? "unknown",
    matter_profile_team_matter_profile_count: artifacts.matter_profile_team_ledger?.summary?.matter_profile_count ?? 0,
    matter_profile_team_roster_count: artifacts.matter_profile_team_ledger?.summary?.matter_team_roster_count ?? 0,
    matter_profile_team_membership_count: artifacts.matter_profile_team_ledger?.summary?.team_membership_count ?? 0,
    matter_profile_team_active_membership_count: artifacts.matter_profile_team_ledger?.summary?.active_team_membership_count ?? 0,
    matter_profile_team_access_subject_count: artifacts.matter_profile_team_ledger?.summary?.matter_access_subject_count ?? 0,
    matter_profile_team_allowed_access_subject_count: artifacts.matter_profile_team_ledger?.summary?.allowed_access_subject_count ?? 0,
    matter_profile_team_denied_access_subject_count: artifacts.matter_profile_team_ledger?.summary?.denied_access_subject_count ?? 0,
    matter_profile_team_matter_with_team_count: artifacts.matter_profile_team_ledger?.summary?.matter_with_team_count ?? 0,
    matter_profile_team_matter_with_responsible_partner_count: artifacts.matter_profile_team_ledger?.summary?.matter_with_responsible_partner_count ?? 0,
    matter_profile_team_team_member_user_count: artifacts.matter_profile_team_ledger?.summary?.team_member_user_count ?? 0,
    matter_profile_team_failed_validation_item_count: artifacts.matter_profile_team_ledger?.summary?.failed_validation_item_count ?? 0,
    matter_profile_team_validation_error_count: artifacts.matter_profile_team_ledger?.summary?.validation_error_count ?? artifacts.matter_profile_team_ledger?.validation?.errors?.length ?? 0,
    wall_policy_contract_status: artifacts.wall_policy_contract?.summary?.wall_policy_status ?? "unknown",
    wall_policy_source_matter_contract_status: artifacts.wall_policy_contract?.summary?.source_matter_contract_status ?? "unknown",
    wall_policy_source_client_counterparty_registry_status: artifacts.wall_policy_contract?.summary?.source_client_counterparty_registry_status ?? "unknown",
    wall_policy_source_matter_profile_team_ledger_status: artifacts.wall_policy_contract?.summary?.source_matter_profile_team_ledger_status ?? "unknown",
    wall_policy_rule_count: artifacts.wall_policy_contract?.summary?.wall_policy_rule_count ?? 0,
    wall_policy_active_rule_count: artifacts.wall_policy_contract?.summary?.active_wall_policy_rule_count ?? 0,
    wall_policy_pre_retrieval_rule_count: artifacts.wall_policy_contract?.summary?.pre_retrieval_rule_count ?? 0,
    wall_policy_deny_unless_allowed_rule_count: artifacts.wall_policy_contract?.summary?.deny_unless_allowed_rule_count ?? 0,
    wall_policy_retrieval_filter_count: artifacts.wall_policy_contract?.summary?.retrieval_wall_filter_count ?? 0,
    wall_policy_complete_retrieval_filter_count: artifacts.wall_policy_contract?.summary?.complete_retrieval_wall_filter_count ?? 0,
    wall_policy_subject_binding_count: artifacts.wall_policy_contract?.summary?.wall_subject_binding_count ?? 0,
    wall_policy_allowed_subject_binding_count: artifacts.wall_policy_contract?.summary?.allowed_wall_subject_binding_count ?? 0,
    wall_policy_denied_subject_binding_count: artifacts.wall_policy_contract?.summary?.denied_wall_subject_binding_count ?? 0,
    wall_policy_conflict_binding_count: artifacts.wall_policy_contract?.summary?.conflict_wall_binding_count ?? 0,
    wall_policy_ready_conflict_binding_count: artifacts.wall_policy_contract?.summary?.ready_conflict_wall_binding_count ?? 0,
    wall_policy_matter_with_wall_policy_count: artifacts.wall_policy_contract?.summary?.matter_with_wall_policy_count ?? 0,
    wall_policy_wall_id_count: artifacts.wall_policy_contract?.summary?.wall_id_count ?? 0,
    wall_policy_required_filter_key_count: artifacts.wall_policy_contract?.summary?.required_filter_key_count ?? 0,
    wall_policy_failed_validation_item_count: artifacts.wall_policy_contract?.summary?.failed_validation_item_count ?? 0,
    wall_policy_validation_error_count: artifacts.wall_policy_contract?.summary?.validation_error_count ?? artifacts.wall_policy_contract?.validation?.errors?.length ?? 0,
    matter_access_policy_status: artifacts.matter_access_policy_evaluator?.summary?.access_policy_status ?? "unknown",
    matter_access_source_resource_contract_status: artifacts.matter_access_policy_evaluator?.summary?.source_resource_contract_status ?? "unknown",
    matter_access_source_runtime_contract_status: artifacts.matter_access_policy_evaluator?.summary?.source_runtime_contract_status ?? "unknown",
    matter_access_source_matter_profile_team_ledger_status: artifacts.matter_access_policy_evaluator?.summary?.source_matter_profile_team_ledger_status ?? "unknown",
    matter_access_source_wall_policy_contract_status: artifacts.matter_access_policy_evaluator?.summary?.source_wall_policy_contract_status ?? "unknown",
    matter_access_policy_rule_count: artifacts.matter_access_policy_evaluator?.summary?.access_policy_rule_count ?? 0,
    matter_access_decision_count: artifacts.matter_access_policy_evaluator?.summary?.matter_access_decision_count ?? 0,
    matter_access_resource_decision_count: artifacts.matter_access_policy_evaluator?.summary?.resource_access_decision_count ?? 0,
    matter_access_runtime_matrix_count: artifacts.matter_access_policy_evaluator?.summary?.runtime_access_matrix_count ?? 0,
    matter_access_allow_decision_count: artifacts.matter_access_policy_evaluator?.summary?.allow_decision_count ?? 0,
    matter_access_review_decision_count: artifacts.matter_access_policy_evaluator?.summary?.review_decision_count ?? 0,
    matter_access_deny_decision_count: artifacts.matter_access_policy_evaluator?.summary?.deny_decision_count ?? 0,
    matter_access_matter_allow_decision_count: artifacts.matter_access_policy_evaluator?.summary?.matter_allow_decision_count ?? 0,
    matter_access_matter_review_decision_count: artifacts.matter_access_policy_evaluator?.summary?.matter_review_decision_count ?? 0,
    matter_access_matter_deny_decision_count: artifacts.matter_access_policy_evaluator?.summary?.matter_deny_decision_count ?? 0,
    matter_access_resource_allow_decision_count: artifacts.matter_access_policy_evaluator?.summary?.resource_allow_decision_count ?? 0,
    matter_access_resource_review_decision_count: artifacts.matter_access_policy_evaluator?.summary?.resource_review_decision_count ?? 0,
    matter_access_resource_deny_decision_count: artifacts.matter_access_policy_evaluator?.summary?.resource_deny_decision_count ?? 0,
    matter_access_unassigned_resource_review_count: artifacts.matter_access_policy_evaluator?.summary?.unassigned_resource_review_count ?? 0,
    matter_access_external_runtime_decision_count: artifacts.matter_access_policy_evaluator?.summary?.external_runtime_decision_count ?? 0,
    matter_access_runtime_count: artifacts.matter_access_policy_evaluator?.summary?.runtime_count ?? 0,
    matter_access_resource_count: artifacts.matter_access_policy_evaluator?.summary?.resource_count ?? 0,
    matter_access_subject_count: artifacts.matter_access_policy_evaluator?.summary?.access_subject_count ?? 0,
    matter_access_failed_validation_item_count: artifacts.matter_access_policy_evaluator?.summary?.failed_validation_item_count ?? 0,
    matter_access_validation_error_count: artifacts.matter_access_policy_evaluator?.summary?.validation_error_count ?? artifacts.matter_access_policy_evaluator?.validation?.errors?.length ?? 0,
    policy_contract_freeze_classification_count: artifacts.policy_contract_freeze?.summary?.classification_count ?? 0,
    policy_contract_freeze_required_classification_count: artifacts.policy_contract_freeze?.summary?.required_classification_count ?? 0,
    policy_contract_freeze_missing_classification_count: artifacts.policy_contract_freeze?.summary?.missing_classification_count ?? 0,
    policy_contract_freeze_extra_classification_count: artifacts.policy_contract_freeze?.summary?.extra_classification_count ?? 0,
    policy_contract_freeze_runtime_rule_link_count: artifacts.policy_contract_freeze?.summary?.runtime_rule_link_count ?? 0,
    policy_contract_freeze_model_rule_link_count: artifacts.policy_contract_freeze?.summary?.model_rule_link_count ?? 0,
    policy_contract_freeze_policy_decision_count: artifacts.policy_contract_freeze?.summary?.policy_decision_count ?? 0,
    policy_contract_freeze_policy_reference_count: artifacts.policy_contract_freeze?.summary?.policy_reference_count ?? 0,
    policy_contract_freeze_resolved_policy_reference_count: artifacts.policy_contract_freeze?.summary?.resolved_policy_reference_count ?? 0,
    policy_contract_freeze_unresolved_policy_reference_count: artifacts.policy_contract_freeze?.summary?.unresolved_policy_reference_count ?? 0,
    policy_contract_freeze_resource_policy_reference_count: artifacts.policy_contract_freeze?.summary?.resource_policy_reference_count ?? 0,
    policy_contract_freeze_matter_policy_reference_count: artifacts.policy_contract_freeze?.summary?.matter_policy_reference_count ?? 0,
    policy_contract_freeze_matter_boundary_policy_reference_count: artifacts.policy_contract_freeze?.summary?.matter_boundary_policy_reference_count ?? 0,
    policy_contract_freeze_failed_validation_item_count: artifacts.policy_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    policy_contract_freeze_validation_error_count: artifacts.policy_contract_freeze?.summary?.validation_error_count ?? artifacts.policy_contract_freeze?.validation?.errors?.length ?? 0,
    data_classification_rule_engine_status: artifacts.data_classification_rule_engine?.summary?.classification_rule_engine_status ?? "unknown",
    data_classification_rule_source_resource_contract_status: artifacts.data_classification_rule_engine?.summary?.source_resource_contract_status ?? "unknown",
    data_classification_rule_source_policy_contract_status: artifacts.data_classification_rule_engine?.summary?.source_policy_contract_status ?? "unknown",
    data_classification_rule_source_matter_access_policy_status: artifacts.data_classification_rule_engine?.summary?.source_matter_access_policy_status ?? "unknown",
    data_classification_rule_count: artifacts.data_classification_rule_engine?.summary?.classification_rule_count ?? 0,
    data_classification_rule_resource_decision_count: artifacts.data_classification_rule_engine?.summary?.resource_classification_decision_count ?? 0,
    data_classification_rule_policy_binding_count: artifacts.data_classification_rule_engine?.summary?.classification_policy_binding_count ?? 0,
    data_classification_rule_policy_bound_resource_count: artifacts.data_classification_rule_engine?.summary?.policy_bound_resource_count ?? 0,
    data_classification_rule_unbound_resource_count: artifacts.data_classification_rule_engine?.summary?.unbound_resource_count ?? 0,
    data_classification_rule_allow_decision_count: artifacts.data_classification_rule_engine?.summary?.allow_decision_count ?? 0,
    data_classification_rule_review_decision_count: artifacts.data_classification_rule_engine?.summary?.review_decision_count ?? 0,
    data_classification_rule_deny_decision_count: artifacts.data_classification_rule_engine?.summary?.deny_decision_count ?? 0,
    data_classification_rule_external_model_allow_count: artifacts.data_classification_rule_engine?.summary?.external_model_allow_count ?? 0,
    data_classification_rule_external_model_review_count: artifacts.data_classification_rule_engine?.summary?.external_model_review_count ?? 0,
    data_classification_rule_external_model_deny_count: artifacts.data_classification_rule_engine?.summary?.external_model_deny_count ?? 0,
    data_classification_rule_redaction_required_resource_count: artifacts.data_classification_rule_engine?.summary?.redaction_required_resource_count ?? 0,
    data_classification_rule_human_review_required_resource_count: artifacts.data_classification_rule_engine?.summary?.human_review_required_resource_count ?? 0,
    data_classification_rule_matter_tagging_review_count: artifacts.data_classification_rule_engine?.summary?.matter_tagging_review_count ?? 0,
    data_classification_rule_matter_access_link_count: artifacts.data_classification_rule_engine?.summary?.matter_access_link_count ?? 0,
    data_classification_rule_failed_validation_item_count: artifacts.data_classification_rule_engine?.summary?.failed_validation_item_count ?? 0,
    data_classification_rule_validation_error_count: artifacts.data_classification_rule_engine?.summary?.validation_error_count ?? artifacts.data_classification_rule_engine?.validation?.errors?.length ?? 0,
    matter_tagging_ledger_status: artifacts.matter_tagging_decision_ledger?.summary?.matter_tagging_ledger_status ?? "unknown",
    matter_tagging_source_resource_contract_status: artifacts.matter_tagging_decision_ledger?.summary?.source_resource_contract_status ?? "unknown",
    matter_tagging_source_matter_profile_team_ledger_status: artifacts.matter_tagging_decision_ledger?.summary?.source_matter_profile_team_ledger_status ?? "unknown",
    matter_tagging_source_matter_access_policy_status: artifacts.matter_tagging_decision_ledger?.summary?.source_matter_access_policy_status ?? "unknown",
    matter_tagging_source_data_classification_rule_engine_status: artifacts.matter_tagging_decision_ledger?.summary?.source_data_classification_rule_engine_status ?? "unknown",
    matter_tagging_resource_count: artifacts.matter_tagging_decision_ledger?.summary?.resource_count ?? 0,
    matter_tagging_decision_count: artifacts.matter_tagging_decision_ledger?.summary?.matter_tagging_decision_count ?? 0,
    matter_tagging_automatic_candidate_count: artifacts.matter_tagging_decision_ledger?.summary?.automatic_candidate_count ?? 0,
    matter_tagging_pending_confirmation_count: artifacts.matter_tagging_decision_ledger?.summary?.pending_human_confirmation_count ?? 0,
    matter_tagging_confirmation_request_count: artifacts.matter_tagging_decision_ledger?.summary?.human_confirmation_request_count ?? 0,
    matter_tagging_correction_history_count: artifacts.matter_tagging_decision_ledger?.summary?.correction_history_count ?? 0,
    matter_tagging_auto_applied_count: artifacts.matter_tagging_decision_ledger?.summary?.auto_applied_count ?? 0,
    matter_tagging_no_candidate_count: artifacts.matter_tagging_decision_ledger?.summary?.no_candidate_count ?? 0,
    matter_tagging_tenant_boundary_mismatch_count: artifacts.matter_tagging_decision_ledger?.summary?.tenant_boundary_mismatch_count ?? 0,
    matter_tagging_failed_validation_item_count: artifacts.matter_tagging_decision_ledger?.summary?.failed_validation_item_count ?? 0,
    matter_tagging_validation_error_count: artifacts.matter_tagging_decision_ledger?.summary?.validation_error_count ?? artifacts.matter_tagging_decision_ledger?.validation?.errors?.length ?? 0,
    access_audit_projection_status: artifacts.access_audit_projection?.summary?.access_audit_projection_status ?? "unknown",
    access_audit_source_matter_access_policy_status: artifacts.access_audit_projection?.summary?.source_matter_access_policy_status ?? "unknown",
    access_audit_source_matter_tagging_ledger_status: artifacts.access_audit_projection?.summary?.source_matter_tagging_ledger_status ?? "unknown",
    access_audit_record_count: artifacts.access_audit_projection?.summary?.access_audit_record_count ?? 0,
    access_audit_matter_record_count: artifacts.access_audit_projection?.summary?.matter_audit_record_count ?? 0,
    access_audit_resource_record_count: artifacts.access_audit_projection?.summary?.resource_audit_record_count ?? 0,
    access_audit_actor_rollup_count: artifacts.access_audit_projection?.summary?.actor_access_rollup_count ?? 0,
    access_audit_resource_rollup_count: artifacts.access_audit_projection?.summary?.resource_access_rollup_count ?? 0,
    access_audit_view_allowed_count: artifacts.access_audit_projection?.summary?.view_allowed_count ?? 0,
    access_audit_view_requires_human_confirmation_count: artifacts.access_audit_projection?.summary?.view_requires_human_confirmation_count ?? 0,
    access_audit_view_denied_count: artifacts.access_audit_projection?.summary?.view_denied_count ?? 0,
    access_audit_can_retrieve_count: artifacts.access_audit_projection?.summary?.can_retrieve_count ?? 0,
    access_audit_human_review_required_count: artifacts.access_audit_projection?.summary?.human_review_required_count ?? 0,
    access_audit_external_runtime_record_count: artifacts.access_audit_projection?.summary?.external_runtime_record_count ?? 0,
    access_audit_matter_tagging_linked_count: artifacts.access_audit_projection?.summary?.matter_tagging_linked_count ?? 0,
    access_audit_matter_tagging_unresolved_count: artifacts.access_audit_projection?.summary?.matter_tagging_unresolved_count ?? 0,
    access_audit_distinct_user_count: artifacts.access_audit_projection?.summary?.distinct_user_count ?? 0,
    access_audit_distinct_runtime_count: artifacts.access_audit_projection?.summary?.distinct_runtime_count ?? 0,
    access_audit_distinct_matter_count: artifacts.access_audit_projection?.summary?.distinct_matter_count ?? 0,
    access_audit_distinct_resource_count: artifacts.access_audit_projection?.summary?.distinct_resource_count ?? 0,
    access_audit_failed_validation_item_count: artifacts.access_audit_projection?.summary?.failed_validation_item_count ?? 0,
    access_audit_validation_error_count: artifacts.access_audit_projection?.summary?.validation_error_count ?? artifacts.access_audit_projection?.validation?.errors?.length ?? 0,
    store_policy_adapter_status: artifacts.store_policy_adapter?.summary?.store_policy_adapter_status ?? "unknown",
    store_policy_source_access_audit_projection_status: artifacts.store_policy_adapter?.summary?.source_access_audit_projection_status ?? "unknown",
    store_policy_source_data_classification_rule_engine_status: artifacts.store_policy_adapter?.summary?.source_data_classification_rule_engine_status ?? "unknown",
    store_policy_access_audit_record_count: artifacts.store_policy_adapter?.summary?.access_audit_record_count ?? 0,
    store_policy_resource_classification_decision_count: artifacts.store_policy_adapter?.summary?.resource_classification_decision_count ?? 0,
    store_policy_rule_count: artifacts.store_policy_adapter?.summary?.store_policy_rule_count ?? 0,
    store_policy_rls_filter_template_count: artifacts.store_policy_adapter?.summary?.rls_filter_template_count ?? 0,
    store_policy_query_policy_binding_count: artifacts.store_policy_adapter?.summary?.query_policy_binding_count ?? 0,
    store_policy_store_query_plan_count: artifacts.store_policy_adapter?.summary?.store_query_plan_count ?? 0,
    store_policy_enforcement_probe_count: artifacts.store_policy_adapter?.summary?.enforcement_probe_count ?? 0,
    store_policy_rls_enforced_query_plan_count: artifacts.store_policy_adapter?.summary?.rls_enforced_query_plan_count ?? 0,
    store_policy_matter_filter_enforced_count: artifacts.store_policy_adapter?.summary?.matter_filter_enforced_count ?? 0,
    store_policy_classification_filter_enforced_count: artifacts.store_policy_adapter?.summary?.classification_filter_enforced_count ?? 0,
    store_policy_policy_snapshot_filter_enforced_count: artifacts.store_policy_adapter?.summary?.policy_snapshot_filter_enforced_count ?? 0,
    store_policy_access_audit_filter_enforced_count: artifacts.store_policy_adapter?.summary?.access_audit_filter_enforced_count ?? 0,
    store_policy_resource_filter_enforced_count: artifacts.store_policy_adapter?.summary?.resource_filter_enforced_count ?? 0,
    store_policy_executable_query_plan_count: artifacts.store_policy_adapter?.summary?.executable_query_plan_count ?? 0,
    store_policy_held_query_plan_count: artifacts.store_policy_adapter?.summary?.held_query_plan_count ?? 0,
    store_policy_blocked_query_plan_count: artifacts.store_policy_adapter?.summary?.blocked_query_plan_count ?? 0,
    store_policy_unfiltered_probe_blocked_count: artifacts.store_policy_adapter?.summary?.unfiltered_probe_blocked_count ?? 0,
    store_policy_cross_matter_probe_blocked_count: artifacts.store_policy_adapter?.summary?.cross_matter_probe_blocked_count ?? 0,
    store_policy_missing_matter_filter_probe_blocked_count: artifacts.store_policy_adapter?.summary?.missing_matter_filter_probe_blocked_count ?? 0,
    store_policy_missing_classification_filter_probe_blocked_count: artifacts.store_policy_adapter?.summary?.missing_classification_filter_probe_blocked_count ?? 0,
    store_policy_missing_policy_snapshot_filter_probe_blocked_count: artifacts.store_policy_adapter?.summary?.missing_policy_snapshot_filter_probe_blocked_count ?? 0,
    store_policy_failed_validation_item_count: artifacts.store_policy_adapter?.summary?.failed_validation_item_count ?? 0,
    store_policy_validation_error_count: artifacts.store_policy_adapter?.summary?.validation_error_count ?? artifacts.store_policy_adapter?.validation?.errors?.length ?? 0,
    conflict_check_interface_status: artifacts.conflict_check_interface?.summary?.conflict_check_interface_status ?? "unknown",
    conflict_check_source_client_counterparty_registry_status: artifacts.conflict_check_interface?.summary?.source_client_counterparty_registry_status ?? "unknown",
    conflict_check_source_matter_profile_team_ledger_status: artifacts.conflict_check_interface?.summary?.source_matter_profile_team_ledger_status ?? "unknown",
    conflict_check_source_wall_policy_contract_status: artifacts.conflict_check_interface?.summary?.source_wall_policy_contract_status ?? "unknown",
    conflict_check_source_store_policy_adapter_status: artifacts.conflict_check_interface?.summary?.source_store_policy_adapter_status ?? "unknown",
    conflict_check_matter_profile_count: artifacts.conflict_check_interface?.summary?.matter_profile_count ?? 0,
    conflict_check_protected_resource_count: artifacts.conflict_check_interface?.summary?.protected_resource_count ?? 0,
    conflict_check_reference_count: artifacts.conflict_check_interface?.summary?.conflict_reference_count ?? 0,
    conflict_check_wall_binding_count: artifacts.conflict_check_interface?.summary?.conflict_wall_binding_count ?? 0,
    conflict_check_store_query_plan_count: artifacts.conflict_check_interface?.summary?.store_query_plan_count ?? 0,
    conflict_check_request_count: artifacts.conflict_check_interface?.summary?.conflict_check_request_count ?? 0,
    conflict_check_matter_intake_request_count: artifacts.conflict_check_interface?.summary?.matter_intake_request_count ?? 0,
    conflict_check_resource_access_request_count: artifacts.conflict_check_interface?.summary?.resource_access_request_count ?? 0,
    conflict_check_result_count: artifacts.conflict_check_interface?.summary?.conflict_check_result_count ?? 0,
    conflict_check_clear_result_count: artifacts.conflict_check_interface?.summary?.clear_result_count ?? 0,
    conflict_check_review_required_result_count: artifacts.conflict_check_interface?.summary?.review_required_result_count ?? 0,
    conflict_check_blocked_result_count: artifacts.conflict_check_interface?.summary?.blocked_result_count ?? 0,
    conflict_check_signal_count: artifacts.conflict_check_interface?.summary?.conflict_signal_count ?? 0,
    conflict_check_clear_signal_count: artifacts.conflict_check_interface?.summary?.clear_signal_count ?? 0,
    conflict_check_review_signal_count: artifacts.conflict_check_interface?.summary?.review_signal_count ?? 0,
    conflict_check_block_signal_count: artifacts.conflict_check_interface?.summary?.block_signal_count ?? 0,
    conflict_check_client_signal_count: artifacts.conflict_check_interface?.summary?.client_signal_count ?? 0,
    conflict_check_counterparty_signal_count: artifacts.conflict_check_interface?.summary?.counterparty_signal_count ?? 0,
    conflict_check_store_plan_linked_request_count: artifacts.conflict_check_interface?.summary?.store_plan_linked_request_count ?? 0,
    conflict_check_missing_conflict_reference_count: artifacts.conflict_check_interface?.summary?.missing_conflict_reference_count ?? 0,
    conflict_check_failed_validation_item_count: artifacts.conflict_check_interface?.summary?.failed_validation_item_count ?? 0,
    conflict_check_validation_error_count: artifacts.conflict_check_interface?.summary?.validation_error_count ?? artifacts.conflict_check_interface?.validation?.errors?.length ?? 0,
    personal_workspace_boundary_status: artifacts.personal_workspace_boundary?.summary?.personal_workspace_boundary_status ?? "unknown",
    personal_workspace_workspace_boundary_count: artifacts.personal_workspace_boundary?.summary?.workspace_boundary_count ?? 0,
    personal_workspace_law_firm_boundary_count: artifacts.personal_workspace_boundary?.summary?.law_firm_boundary_count ?? 0,
    personal_workspace_personal_boundary_count: artifacts.personal_workspace_boundary?.summary?.personal_workspace_boundary_count ?? 0,
    personal_workspace_tenant_policy_boundary_count: artifacts.personal_workspace_boundary?.summary?.tenant_policy_boundary_count ?? 0,
    personal_workspace_search_namespace_policy_count: artifacts.personal_workspace_boundary?.summary?.search_namespace_policy_count ?? 0,
    personal_workspace_cross_workspace_probe_count: artifacts.personal_workspace_boundary?.summary?.cross_workspace_probe_count ?? 0,
    personal_workspace_blocked_cross_workspace_probe_count: artifacts.personal_workspace_boundary?.summary?.blocked_cross_workspace_probe_count ?? 0,
    personal_workspace_allowed_cross_workspace_probe_count: artifacts.personal_workspace_boundary?.summary?.allowed_cross_workspace_probe_count ?? 0,
    personal_workspace_mixed_search_namespace_count: artifacts.personal_workspace_boundary?.summary?.mixed_search_namespace_count ?? 0,
    personal_workspace_law_firm_matter_count: artifacts.personal_workspace_boundary?.summary?.law_firm_matter_count ?? 0,
    personal_workspace_personal_matter_count: artifacts.personal_workspace_boundary?.summary?.personal_matter_count ?? 0,
    personal_workspace_law_firm_resource_count: artifacts.personal_workspace_boundary?.summary?.law_firm_resource_count ?? 0,
    personal_workspace_personal_resource_count: artifacts.personal_workspace_boundary?.summary?.personal_resource_count ?? 0,
    personal_workspace_failed_validation_item_count: artifacts.personal_workspace_boundary?.summary?.failed_validation_item_count ?? 0,
    personal_workspace_validation_error_count: artifacts.personal_workspace_boundary?.summary?.validation_error_count ?? artifacts.personal_workspace_boundary?.validation?.errors?.length ?? 0,
    policy_golden_fixture_status: artifacts.policy_golden_fixtures?.summary?.policy_golden_fixture_status ?? "unknown",
    policy_golden_fixture_case_count: artifacts.policy_golden_fixtures?.summary?.policy_fixture_case_count ?? 0,
    policy_golden_fixture_group_count: artifacts.policy_golden_fixtures?.summary?.fixture_group_count ?? 0,
    policy_golden_allow_case_count: artifacts.policy_golden_fixtures?.summary?.allow_case_count ?? 0,
    policy_golden_review_case_count: artifacts.policy_golden_fixtures?.summary?.review_case_count ?? 0,
    policy_golden_deny_case_count: artifacts.policy_golden_fixtures?.summary?.deny_case_count ?? 0,
    policy_golden_locked_case_count: artifacts.policy_golden_fixtures?.summary?.locked_case_count ?? 0,
    policy_golden_mismatch_case_count: artifacts.policy_golden_fixtures?.summary?.mismatch_case_count ?? 0,
    policy_golden_missing_case_count: artifacts.policy_golden_fixtures?.summary?.missing_case_count ?? 0,
    policy_golden_locked_regression_hash_count: artifacts.policy_golden_fixtures?.summary?.locked_regression_hash_count ?? 0,
    policy_golden_review_case_with_human_gate_count: artifacts.policy_golden_fixtures?.summary?.review_case_with_human_gate_count ?? 0,
    policy_golden_deny_case_blocked_count: artifacts.policy_golden_fixtures?.summary?.deny_case_blocked_count ?? 0,
    policy_golden_failed_validation_item_count: artifacts.policy_golden_fixtures?.summary?.failed_validation_item_count ?? 0,
    policy_golden_validation_error_count: artifacts.policy_golden_fixtures?.summary?.validation_error_count ?? artifacts.policy_golden_fixtures?.validation?.errors?.length ?? 0,
    policy_operations_surface_status: artifacts.policy_operations_surface?.summary?.policy_operations_surface_status ?? "unknown",
    policy_operations_decision_count: artifacts.policy_operations_surface?.summary?.policy_decision_row_count ?? 0,
    policy_operations_allow_decision_count: artifacts.policy_operations_surface?.summary?.allow_decision_count ?? 0,
    policy_operations_review_decision_count: artifacts.policy_operations_surface?.summary?.review_decision_count ?? 0,
    policy_operations_deny_decision_count: artifacts.policy_operations_surface?.summary?.deny_decision_count ?? 0,
    policy_operations_violation_count: artifacts.policy_operations_surface?.summary?.policy_violation_row_count ?? 0,
    policy_operations_critical_violation_count: artifacts.policy_operations_surface?.summary?.critical_violation_count ?? 0,
    policy_operations_warning_violation_count: artifacts.policy_operations_surface?.summary?.warning_violation_count ?? 0,
    policy_operations_pending_approval_count: artifacts.policy_operations_surface?.summary?.policy_pending_approval_row_count ?? 0,
    policy_operations_assignment_required_count: artifacts.policy_operations_surface?.summary?.assignment_required_approval_count ?? 0,
    policy_operations_human_gate_pending_count: artifacts.policy_operations_surface?.summary?.human_gate_pending_approval_count ?? 0,
    policy_operations_distinct_layer_count: artifacts.policy_operations_surface?.summary?.distinct_policy_layer_count ?? 0,
    policy_operations_failed_validation_item_count: artifacts.policy_operations_surface?.summary?.failed_validation_item_count ?? 0,
    policy_operations_validation_error_count: artifacts.policy_operations_surface?.summary?.validation_error_count ?? artifacts.policy_operations_surface?.validation?.errors?.length ?? 0,
    matter_boundary_slice_status: artifacts.matter_boundary_slice?.summary?.matter_boundary_slice_status ?? "unknown",
    matter_boundary_resource_path_count: artifacts.matter_boundary_slice?.summary?.resource_boundary_path_count ?? 0,
    matter_boundary_retrieval_gate_check_count: artifacts.matter_boundary_slice?.summary?.retrieval_gate_check_count ?? 0,
    matter_boundary_promoted_resource_path_count: artifacts.matter_boundary_slice?.summary?.promoted_resource_path_count ?? 0,
    matter_boundary_access_decision_covered_resource_count: artifacts.matter_boundary_slice?.summary?.access_decision_covered_resource_count ?? 0,
    matter_boundary_access_audited_resource_count: artifacts.matter_boundary_slice?.summary?.access_audited_resource_count ?? 0,
    matter_boundary_store_compiled_resource_count: artifacts.matter_boundary_slice?.summary?.store_compiled_resource_count ?? 0,
    matter_boundary_required_store_filter_resource_count: artifacts.matter_boundary_slice?.summary?.required_store_filter_resource_count ?? 0,
    matter_boundary_negative_probe_blocked_resource_count: artifacts.matter_boundary_slice?.summary?.negative_probe_blocked_resource_count ?? 0,
    matter_boundary_policy_surface_visible_resource_count: artifacts.matter_boundary_slice?.summary?.policy_surface_visible_resource_count ?? 0,
    matter_boundary_unassigned_resource_count: artifacts.matter_boundary_slice?.summary?.unassigned_resource_count ?? 0,
    matter_boundary_unassigned_executable_query_plan_count: artifacts.matter_boundary_slice?.summary?.unassigned_executable_query_plan_count ?? 0,
    matter_boundary_held_for_matter_tagging_resource_count: artifacts.matter_boundary_slice?.summary?.held_for_matter_tagging_resource_count ?? 0,
    matter_boundary_retrieval_ready_resource_count: artifacts.matter_boundary_slice?.summary?.retrieval_ready_resource_count ?? 0,
    matter_boundary_blocked_resource_count: artifacts.matter_boundary_slice?.summary?.blocked_resource_count ?? 0,
    matter_boundary_executable_query_plan_count: artifacts.matter_boundary_slice?.summary?.executable_query_plan_count ?? 0,
    matter_boundary_held_query_plan_count: artifacts.matter_boundary_slice?.summary?.held_query_plan_count ?? 0,
    matter_boundary_blocked_query_plan_count: artifacts.matter_boundary_slice?.summary?.blocked_query_plan_count ?? 0,
    matter_boundary_passed_retrieval_gate_check_count: artifacts.matter_boundary_slice?.summary?.passed_retrieval_gate_check_count ?? 0,
    matter_boundary_failed_retrieval_gate_check_count: artifacts.matter_boundary_slice?.summary?.failed_retrieval_gate_check_count ?? 0,
    matter_boundary_negative_probe_expected_count: artifacts.matter_boundary_slice?.summary?.negative_probe_expected_count ?? 0,
    matter_boundary_negative_probe_blocked_count: artifacts.matter_boundary_slice?.summary?.negative_probe_blocked_count ?? 0,
    matter_boundary_failed_validation_item_count: artifacts.matter_boundary_slice?.summary?.failed_validation_item_count ?? 0,
    matter_boundary_validation_error_count: artifacts.matter_boundary_slice?.summary?.validation_error_count ?? artifacts.matter_boundary_slice?.validation?.errors?.length ?? 0,
    identity_policy_matter_freeze_status: artifacts.identity_policy_matter_freeze?.summary?.freeze_status ?? "unknown",
    identity_policy_matter_freeze_source_count: artifacts.identity_policy_matter_freeze?.summary?.required_source_count ?? 0,
    identity_policy_matter_freeze_available_source_count: artifacts.identity_policy_matter_freeze?.summary?.available_required_source_count ?? 0,
    identity_policy_matter_freeze_clean_source_count: artifacts.identity_policy_matter_freeze?.summary?.clean_source_count ?? 0,
    identity_policy_matter_freeze_frozen_slot_count: artifacts.identity_policy_matter_freeze?.summary?.frozen_slot_count ?? 0,
    identity_policy_matter_freeze_checkpoint_count: artifacts.identity_policy_matter_freeze?.summary?.freeze_checkpoint_count ?? 0,
    identity_policy_matter_freeze_passed_checkpoint_count: artifacts.identity_policy_matter_freeze?.summary?.passed_freeze_checkpoint_count ?? 0,
    identity_policy_matter_freeze_failed_checkpoint_count: artifacts.identity_policy_matter_freeze?.summary?.failed_freeze_checkpoint_count ?? 0,
    identity_policy_matter_freeze_policy_fixture_case_count: artifacts.identity_policy_matter_freeze?.summary?.policy_fixture_case_count ?? 0,
    identity_policy_matter_freeze_locked_policy_fixture_count: artifacts.identity_policy_matter_freeze?.summary?.locked_policy_fixture_count ?? 0,
    identity_policy_matter_freeze_policy_decision_row_count: artifacts.identity_policy_matter_freeze?.summary?.policy_decision_row_count ?? 0,
    identity_policy_matter_freeze_policy_pending_approval_row_count: artifacts.identity_policy_matter_freeze?.summary?.policy_pending_approval_row_count ?? 0,
    identity_policy_matter_freeze_resource_boundary_path_count: artifacts.identity_policy_matter_freeze?.summary?.resource_boundary_path_count ?? 0,
    identity_policy_matter_freeze_retrieval_gate_check_count: artifacts.identity_policy_matter_freeze?.summary?.retrieval_gate_check_count ?? 0,
    identity_policy_matter_freeze_unassigned_executable_query_plan_count: artifacts.identity_policy_matter_freeze?.summary?.unassigned_executable_query_plan_count ?? 0,
    identity_policy_matter_freeze_protected_action_executed_count: artifacts.identity_policy_matter_freeze?.summary?.protected_action_executed_count ?? 0,
    identity_policy_matter_freeze_validation_error_count: artifacts.identity_policy_matter_freeze?.summary?.validation_error_count ?? artifacts.identity_policy_matter_freeze?.validation?.errors?.length ?? 0,
    resource_store_interface_status: artifacts.resource_store_interface?.summary?.resource_store_interface_status ?? "unknown",
    resource_store_interface_contract_id: artifacts.resource_store_interface?.summary?.interface_contract_id ?? null,
    resource_store_interface_resource_record_count: artifacts.resource_store_interface?.summary?.resource_store_record_count ?? 0,
    resource_store_interface_resource_version_record_count: artifacts.resource_store_interface?.summary?.resource_version_store_record_count ?? 0,
    resource_store_interface_registry_projection_count: artifacts.resource_store_interface?.summary?.registry_projection_count ?? 0,
    resource_store_interface_dashboard_projection_route_count: artifacts.resource_store_interface?.summary?.dashboard_projection_route_count ?? 0,
    resource_store_interface_adapter_binding_count: artifacts.resource_store_interface?.summary?.adapter_binding_count ?? 0,
    resource_store_interface_registry_adapter_binding_count: artifacts.resource_store_interface?.summary?.registry_adapter_binding_count ?? 0,
    resource_store_interface_ingestion_adapter_binding_count: artifacts.resource_store_interface?.summary?.ingestion_adapter_binding_count ?? 0,
    resource_store_interface_dashboard_adapter_binding_count: artifacts.resource_store_interface?.summary?.dashboard_adapter_binding_count ?? 0,
    resource_store_interface_required_consumer_layer_count: artifacts.resource_store_interface?.summary?.required_consumer_layer_count ?? 0,
    resource_store_interface_bound_required_consumer_layer_count: artifacts.resource_store_interface?.summary?.bound_required_consumer_layer_count ?? 0,
    resource_store_interface_required_resource_filter_count: artifacts.resource_store_interface?.summary?.required_resource_filter_count ?? 0,
    resource_store_interface_resource_store_rls_template_count: artifacts.resource_store_interface?.summary?.resource_store_rls_template_count ?? 0,
    resource_store_interface_compiled_query_plan_count: artifacts.resource_store_interface?.summary?.compiled_resource_query_plan_count ?? 0,
    resource_store_interface_executable_query_plan_count: artifacts.resource_store_interface?.summary?.executable_resource_query_plan_count ?? 0,
    resource_store_interface_validation_error_count: artifacts.resource_store_interface?.summary?.validation_error_count ?? artifacts.resource_store_interface?.validation?.errors?.length ?? 0,
    immutable_object_store_layout_status: artifacts.immutable_object_store_layout?.summary?.object_store_layout_status ?? "unknown",
    immutable_object_store_layout_contract_id: artifacts.immutable_object_store_layout?.summary?.layout_contract_id ?? null,
    immutable_object_store_layout_root: artifacts.immutable_object_store_layout?.summary?.object_store_root ?? null,
    immutable_object_store_namespace_count: artifacts.immutable_object_store_layout?.summary?.namespace_count ?? 0,
    immutable_object_store_path_resolver_count: artifacts.immutable_object_store_layout?.summary?.path_resolver_count ?? 0,
    immutable_object_store_raw_source_object_path_count: artifacts.immutable_object_store_layout?.summary?.raw_source_object_path_count ?? 0,
    immutable_object_store_generated_output_object_path_count: artifacts.immutable_object_store_layout?.summary?.generated_output_object_path_count ?? 0,
    immutable_object_store_total_object_path_count: artifacts.immutable_object_store_layout?.summary?.total_object_path_count ?? 0,
    immutable_object_store_collision_count: artifacts.immutable_object_store_layout?.summary?.collision_count ?? 0,
    immutable_object_store_content_addressed_path_count: artifacts.immutable_object_store_layout?.summary?.content_addressed_path_count ?? 0,
    immutable_object_store_absolute_source_path_key_count: artifacts.immutable_object_store_layout?.summary?.absolute_source_path_key_count ?? 0,
    immutable_object_store_validation_error_count: artifacts.immutable_object_store_layout?.summary?.validation_error_count ?? artifacts.immutable_object_store_layout?.validation?.errors?.length ?? 0,
    resource_version_ledger_status: artifacts.resource_version_ledger?.summary?.resource_version_ledger_status ?? "unknown",
    resource_version_ledger_contract_id: artifacts.resource_version_ledger?.summary?.ledger_contract_id ?? null,
    resource_version_ledger_family_count: artifacts.resource_version_ledger?.summary?.version_family_count ?? 0,
    resource_version_ledger_resource_version_count: artifacts.resource_version_ledger?.summary?.resource_version_count ?? 0,
    resource_version_ledger_current_version_count: artifacts.resource_version_ledger?.summary?.current_version_count ?? 0,
    resource_version_ledger_content_hash_group_count: artifacts.resource_version_ledger?.summary?.content_hash_group_count ?? 0,
    resource_version_ledger_singleton_family_count: artifacts.resource_version_ledger?.summary?.singleton_family_count ?? 0,
    resource_version_ledger_multi_version_family_count: artifacts.resource_version_ledger?.summary?.multi_version_family_count ?? 0,
    resource_version_ledger_changed_content_family_count: artifacts.resource_version_ledger?.summary?.changed_content_family_count ?? 0,
    resource_version_ledger_duplicate_content_family_count: artifacts.resource_version_ledger?.summary?.duplicate_content_family_count ?? 0,
    resource_version_ledger_duplicate_candidate_count: artifacts.resource_version_ledger?.summary?.duplicate_candidate_count ?? 0,
    resource_version_ledger_duplicate_candidate_matched_count: artifacts.resource_version_ledger?.summary?.duplicate_candidate_matched_count ?? 0,
    resource_version_ledger_duplicate_candidate_unmatched_count: artifacts.resource_version_ledger?.summary?.duplicate_candidate_unmatched_count ?? 0,
    resource_version_ledger_event_count: artifacts.resource_version_ledger?.summary?.version_event_count ?? 0,
    resource_version_ledger_transition_count: artifacts.resource_version_ledger?.summary?.version_transition_count ?? 0,
    resource_version_ledger_object_path_binding_count: artifacts.resource_version_ledger?.summary?.object_path_binding_count ?? 0,
    resource_version_ledger_unbound_object_path_count: artifacts.resource_version_ledger?.summary?.unbound_object_path_count ?? 0,
    resource_version_ledger_validation_error_count: artifacts.resource_version_ledger?.summary?.validation_error_count ?? artifacts.resource_version_ledger?.validation?.errors?.length ?? 0,
    normalized_text_contract_status: artifacts.normalized_text_contract?.summary?.normalized_text_contract_status ?? "unknown",
    normalized_text_contract_id: artifacts.normalized_text_contract?.summary?.normalized_text_contract_id ?? null,
    normalized_text_source_count: artifacts.normalized_text_contract?.summary?.source_normalized_text_count ?? 0,
    normalized_text_artifact_count: artifacts.normalized_text_contract?.summary?.normalized_text_artifact_count ?? 0,
    normalized_text_resource_version_link_count: artifacts.normalized_text_contract?.summary?.resource_version_link_count ?? 0,
    normalized_text_version_family_link_count: artifacts.normalized_text_contract?.summary?.version_family_link_count ?? 0,
    normalized_text_raw_source_bound_count: artifacts.normalized_text_contract?.summary?.raw_source_bound_count ?? 0,
    normalized_text_hash_count: artifacts.normalized_text_contract?.summary?.text_hash_count ?? 0,
    normalized_text_location_map_count: artifacts.normalized_text_contract?.summary?.location_map_count ?? 0,
    normalized_text_source_span_seed_count: artifacts.normalized_text_contract?.summary?.source_span_seed_count ?? 0,
    normalized_text_source_span_seed_ready_count: artifacts.normalized_text_contract?.summary?.source_span_seed_ready_count ?? 0,
    normalized_text_page_unit_count: artifacts.normalized_text_contract?.summary?.page_unit_count ?? 0,
    normalized_text_paragraph_unit_count: artifacts.normalized_text_contract?.summary?.paragraph_unit_count ?? 0,
    normalized_text_line_unit_count: artifacts.normalized_text_contract?.summary?.line_unit_count ?? 0,
    normalized_text_validation_error_count: artifacts.normalized_text_contract?.summary?.validation_error_count ?? artifacts.normalized_text_contract?.validation?.errors?.length ?? 0,
    extractor_adapter_contract_status: artifacts.extractor_adapter_contract?.summary?.extractor_adapter_contract_status ?? "unknown",
    extractor_adapter_contract_id: artifacts.extractor_adapter_contract?.summary?.extractor_adapter_contract_id ?? null,
    extractor_adapter_count: artifacts.extractor_adapter_contract?.summary?.extractor_adapter_count ?? 0,
    extractor_io_contract_count: artifacts.extractor_adapter_contract?.summary?.extractor_io_contract_count ?? 0,
    extractor_document_type_binding_count: artifacts.extractor_adapter_contract?.summary?.document_type_binding_count ?? 0,
    extractor_ocr_fallback_policy_count: artifacts.extractor_adapter_contract?.summary?.ocr_fallback_policy_count ?? 0,
    extractor_normalized_text_artifact_count: artifacts.extractor_adapter_contract?.summary?.normalized_text_artifact_count ?? 0,
    extractor_normalized_text_binding_count: artifacts.extractor_adapter_contract?.summary?.normalized_text_binding_count ?? 0,
    extractor_bound_normalized_text_count: artifacts.extractor_adapter_contract?.summary?.bound_normalized_text_count ?? 0,
    extractor_unbound_normalized_text_count: artifacts.extractor_adapter_contract?.summary?.unbound_normalized_text_count ?? 0,
    extractor_local_only_adapter_count: artifacts.extractor_adapter_contract?.summary?.local_only_adapter_count ?? 0,
    extractor_external_service_adapter_count: artifacts.extractor_adapter_contract?.summary?.external_service_adapter_count ?? 0,
    extractor_pdf_ocr_local_manual_policy_count: artifacts.extractor_adapter_contract?.summary?.pdf_ocr_local_manual_policy_count ?? 0,
    extractor_validation_error_count: artifacts.extractor_adapter_contract?.summary?.validation_error_count ?? artifacts.extractor_adapter_contract?.validation?.errors?.length ?? 0,
    source_span_store_status: artifacts.source_span_store?.summary?.source_span_store_status ?? "unknown",
    source_span_store_contract_id: artifacts.source_span_store?.summary?.source_span_store_contract_id ?? null,
    source_span_schema_version: artifacts.source_span_store?.summary?.source_span_schema_version ?? null,
    source_span_normalized_text_artifact_count: artifacts.source_span_store?.summary?.normalized_text_artifact_count ?? 0,
    source_span_seed_count: artifacts.source_span_store?.summary?.source_span_seed_count ?? 0,
    source_span_count: artifacts.source_span_store?.summary?.source_span_count ?? 0,
    source_span_locator_count: artifacts.source_span_store?.summary?.source_span_locator_count ?? 0,
    source_span_location_unit_count: artifacts.source_span_store?.summary?.source_span_location_unit_count ?? 0,
    source_span_whole_document_count: artifacts.source_span_store?.summary?.whole_document_span_count ?? 0,
    source_span_page_count: artifacts.source_span_store?.summary?.page_span_count ?? 0,
    source_span_paragraph_count: artifacts.source_span_store?.summary?.paragraph_span_count ?? 0,
    source_span_line_count: artifacts.source_span_store?.summary?.line_span_count ?? 0,
    source_span_char_range_count: artifacts.source_span_store?.summary?.char_range_span_count ?? 0,
    source_span_timestamp_count: artifacts.source_span_store?.summary?.timestamp_span_count ?? 0,
    source_span_timestamp_not_applicable_count: artifacts.source_span_store?.summary?.timestamp_not_applicable_count ?? 0,
    source_span_extractor_bound_count: artifacts.source_span_store?.summary?.extractor_bound_span_count ?? 0,
    source_span_canonical_offset_count: artifacts.source_span_store?.summary?.canonical_offset_span_count ?? 0,
    source_span_validation_error_count: artifacts.source_span_store?.summary?.validation_error_count ?? artifacts.source_span_store?.validation?.errors?.length ?? 0,
    evidence_item_store_status: artifacts.evidence_item_store?.summary?.evidence_item_store_status ?? "unknown",
    evidence_item_store_contract_id: artifacts.evidence_item_store?.summary?.evidence_item_store_contract_id ?? null,
    evidence_item_store_schema_version: artifacts.evidence_item_store?.summary?.evidence_item_schema_version ?? null,
    evidence_item_store_source_span_count: artifacts.evidence_item_store?.summary?.source_span_count ?? 0,
    evidence_item_store_evidence_item_count: artifacts.evidence_item_store?.summary?.evidence_item_count ?? 0,
    evidence_item_store_binding_count: artifacts.evidence_item_store?.summary?.evidence_source_span_binding_count ?? 0,
    evidence_item_store_review_queue_count: artifacts.evidence_item_store?.summary?.review_queue_item_count ?? 0,
    evidence_item_store_linked_source_span_count: artifacts.evidence_item_store?.summary?.source_span_linked_evidence_count ?? 0,
    evidence_item_store_matter_preserved_count: artifacts.evidence_item_store?.summary?.matter_preserved_evidence_count ?? 0,
    evidence_item_store_classification_preserved_count: artifacts.evidence_item_store?.summary?.classification_preserved_evidence_count ?? 0,
    evidence_item_store_policy_snapshot_preserved_count: artifacts.evidence_item_store?.summary?.policy_snapshot_preserved_evidence_count ?? 0,
    evidence_item_store_machine_extracted_count: artifacts.evidence_item_store?.summary?.machine_extracted_evidence_count ?? 0,
    evidence_item_store_needs_review_count: artifacts.evidence_item_store?.summary?.needs_review_count ?? 0,
    evidence_item_store_approved_count: artifacts.evidence_item_store?.summary?.approved_count ?? 0,
    evidence_item_store_validation_error_count: artifacts.evidence_item_store?.summary?.validation_error_count ?? artifacts.evidence_item_store?.validation?.errors?.length ?? 0,
    fact_claim_store_status: artifacts.fact_claim_store?.summary?.fact_claim_store_status ?? "unknown",
    fact_claim_store_contract_id: artifacts.fact_claim_store?.summary?.fact_claim_store_contract_id ?? null,
    fact_claim_store_schema_version: artifacts.fact_claim_store?.summary?.fact_claim_schema_version ?? null,
    fact_claim_store_evidence_item_count: artifacts.fact_claim_store?.summary?.evidence_item_count ?? 0,
    fact_claim_store_fact_claim_count: artifacts.fact_claim_store?.summary?.fact_claim_count ?? 0,
    fact_claim_store_binding_count: artifacts.fact_claim_store?.summary?.fact_evidence_binding_count ?? 0,
    fact_claim_store_review_queue_count: artifacts.fact_claim_store?.summary?.review_queue_item_count ?? 0,
    fact_claim_store_linked_evidence_count: artifacts.fact_claim_store?.summary?.evidence_linked_fact_count ?? 0,
    fact_claim_store_reliability_preserved_count: artifacts.fact_claim_store?.summary?.reliability_preserved_fact_count ?? 0,
    fact_claim_store_matter_preserved_count: artifacts.fact_claim_store?.summary?.matter_preserved_fact_count ?? 0,
    fact_claim_store_classification_preserved_count: artifacts.fact_claim_store?.summary?.classification_preserved_fact_count ?? 0,
    fact_claim_store_policy_snapshot_preserved_count: artifacts.fact_claim_store?.summary?.policy_snapshot_preserved_fact_count ?? 0,
    fact_claim_store_machine_extracted_count: artifacts.fact_claim_store?.summary?.machine_extracted_fact_count ?? 0,
    fact_claim_store_needs_review_count: artifacts.fact_claim_store?.summary?.needs_review_count ?? 0,
    fact_claim_store_approved_count: artifacts.fact_claim_store?.summary?.approved_count ?? 0,
    fact_claim_store_validation_error_count: artifacts.fact_claim_store?.summary?.validation_error_count ?? artifacts.fact_claim_store?.validation?.errors?.length ?? 0,
    issue_graph_store_status: artifacts.issue_graph_store?.summary?.issue_graph_store_status ?? "unknown",
    issue_graph_store_contract_id: artifacts.issue_graph_store?.summary?.issue_graph_store_contract_id ?? null,
    issue_graph_store_schema_version: artifacts.issue_graph_store?.summary?.issue_schema_version ?? null,
    issue_graph_store_legal_rule_schema_version: artifacts.issue_graph_store?.summary?.legal_rule_schema_version ?? null,
    issue_graph_store_fact_claim_store_status: artifacts.issue_graph_store?.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_fact_claim_count: artifacts.issue_graph_store?.summary?.fact_claim_count ?? 0,
    issue_graph_store_issue_count: artifacts.issue_graph_store?.summary?.issue_count ?? 0,
    issue_graph_store_fact_issue_binding_count: artifacts.issue_graph_store?.summary?.fact_issue_binding_count ?? 0,
    issue_graph_store_legal_rule_count: artifacts.issue_graph_store?.summary?.legal_rule_count ?? 0,
    issue_graph_store_legal_rule_binding_count: artifacts.issue_graph_store?.summary?.legal_rule_binding_count ?? 0,
    issue_graph_store_risk_severity_assessment_count: artifacts.issue_graph_store?.summary?.risk_severity_assessment_count ?? 0,
    issue_graph_store_review_queue_count: artifacts.issue_graph_store?.summary?.review_queue_item_count ?? 0,
    issue_graph_store_fact_linked_issue_count: artifacts.issue_graph_store?.summary?.fact_linked_issue_count ?? 0,
    issue_graph_store_legal_rule_linked_issue_count: artifacts.issue_graph_store?.summary?.legal_rule_linked_issue_count ?? 0,
    issue_graph_store_risk_severity_linked_issue_count: artifacts.issue_graph_store?.summary?.risk_severity_linked_issue_count ?? 0,
    issue_graph_store_matter_preserved_count: artifacts.issue_graph_store?.summary?.matter_preserved_issue_count ?? 0,
    issue_graph_store_classification_preserved_count: artifacts.issue_graph_store?.summary?.classification_preserved_issue_count ?? 0,
    issue_graph_store_policy_snapshot_preserved_count: artifacts.issue_graph_store?.summary?.policy_snapshot_preserved_issue_count ?? 0,
    issue_graph_store_evidence_links_preserved_count: artifacts.issue_graph_store?.summary?.evidence_links_preserved_issue_count ?? 0,
    issue_graph_store_needs_review_count: artifacts.issue_graph_store?.summary?.needs_review_count ?? 0,
    issue_graph_store_approved_count: artifacts.issue_graph_store?.summary?.approved_count ?? 0,
    issue_graph_store_critical_severity_count: artifacts.issue_graph_store?.summary?.critical_severity_count ?? 0,
    issue_graph_store_high_severity_count: artifacts.issue_graph_store?.summary?.high_severity_count ?? 0,
    issue_graph_store_medium_severity_count: artifacts.issue_graph_store?.summary?.medium_severity_count ?? 0,
    issue_graph_store_low_severity_count: artifacts.issue_graph_store?.summary?.low_severity_count ?? 0,
    issue_graph_store_validation_error_count: artifacts.issue_graph_store?.summary?.validation_error_count ?? artifacts.issue_graph_store?.validation?.errors?.length ?? 0,
    citation_object_store_status: artifacts.citation_object_store?.summary?.citation_object_store_status ?? "unknown",
    citation_object_store_contract_id: artifacts.citation_object_store?.summary?.citation_object_store_contract_id ?? null,
    citation_object_store_citation_schema_version: artifacts.citation_object_store?.summary?.citation_schema_version ?? null,
    citation_object_store_output_paragraph_schema_version: artifacts.citation_object_store?.summary?.output_paragraph_schema_version ?? null,
    citation_object_store_paragraph_source_binding_schema_version: artifacts.citation_object_store?.summary?.paragraph_source_binding_schema_version ?? null,
    citation_object_store_issue_graph_store_status: artifacts.citation_object_store?.summary?.issue_graph_store_status ?? "unknown",
    citation_object_store_issue_count: artifacts.citation_object_store?.summary?.issue_count ?? 0,
    citation_object_store_output_paragraph_count: artifacts.citation_object_store?.summary?.output_paragraph_count ?? 0,
    citation_object_store_citation_count: artifacts.citation_object_store?.summary?.citation_count ?? 0,
    citation_object_store_paragraph_source_binding_count: artifacts.citation_object_store?.summary?.paragraph_source_binding_count ?? 0,
    citation_object_store_review_queue_count: artifacts.citation_object_store?.summary?.review_queue_item_count ?? 0,
    citation_object_store_source_span_bound_count: artifacts.citation_object_store?.summary?.source_span_bound_citation_count ?? 0,
    citation_object_store_issue_linked_count: artifacts.citation_object_store?.summary?.issue_linked_citation_count ?? 0,
    citation_object_store_paragraph_linked_count: artifacts.citation_object_store?.summary?.paragraph_linked_citation_count ?? 0,
    citation_object_store_fact_linked_count: artifacts.citation_object_store?.summary?.fact_linked_citation_count ?? 0,
    citation_object_store_evidence_linked_count: artifacts.citation_object_store?.summary?.evidence_linked_citation_count ?? 0,
    citation_object_store_matter_preserved_count: artifacts.citation_object_store?.summary?.matter_preserved_citation_count ?? 0,
    citation_object_store_classification_preserved_count: artifacts.citation_object_store?.summary?.classification_preserved_citation_count ?? 0,
    citation_object_store_policy_snapshot_preserved_count: artifacts.citation_object_store?.summary?.policy_snapshot_preserved_citation_count ?? 0,
    citation_object_store_issue_link_preserved_count: artifacts.citation_object_store?.summary?.issue_link_preserved_citation_count ?? 0,
    citation_object_store_needs_review_count: artifacts.citation_object_store?.summary?.needs_review_count ?? 0,
    citation_object_store_approved_count: artifacts.citation_object_store?.summary?.approved_count ?? 0,
    citation_object_store_client_facing_ready_count: artifacts.citation_object_store?.summary?.client_facing_ready_count ?? 0,
    citation_object_store_not_client_facing_paragraph_count: artifacts.citation_object_store?.summary?.not_client_facing_paragraph_count ?? 0,
    citation_object_store_validation_error_count: artifacts.citation_object_store?.summary?.validation_error_count ?? artifacts.citation_object_store?.validation?.errors?.length ?? 0,
    lineage_graph_builder_status: artifacts.lineage_graph_builder?.summary?.lineage_graph_status ?? "unknown",
    lineage_graph_builder_contract_id: artifacts.lineage_graph_builder?.summary?.lineage_graph_contract_id ?? null,
    lineage_graph_builder_node_schema_version: artifacts.lineage_graph_builder?.summary?.lineage_node_schema_version ?? null,
    lineage_graph_builder_edge_schema_version: artifacts.lineage_graph_builder?.summary?.lineage_edge_schema_version ?? null,
    lineage_graph_builder_path_schema_version: artifacts.lineage_graph_builder?.summary?.lineage_path_schema_version ?? null,
    lineage_graph_builder_citation_object_store_status: artifacts.lineage_graph_builder?.summary?.citation_object_store_status ?? "unknown",
    lineage_graph_builder_node_count: artifacts.lineage_graph_builder?.summary?.lineage_node_count ?? 0,
    lineage_graph_builder_source_span_node_count: artifacts.lineage_graph_builder?.summary?.source_span_node_count ?? 0,
    lineage_graph_builder_evidence_item_node_count: artifacts.lineage_graph_builder?.summary?.evidence_item_node_count ?? 0,
    lineage_graph_builder_fact_claim_node_count: artifacts.lineage_graph_builder?.summary?.fact_claim_node_count ?? 0,
    lineage_graph_builder_issue_node_count: artifacts.lineage_graph_builder?.summary?.issue_node_count ?? 0,
    lineage_graph_builder_output_paragraph_node_count: artifacts.lineage_graph_builder?.summary?.output_paragraph_node_count ?? 0,
    lineage_graph_builder_edge_count: artifacts.lineage_graph_builder?.summary?.lineage_edge_count ?? 0,
    lineage_graph_builder_expected_edge_count: artifacts.lineage_graph_builder?.summary?.expected_lineage_edge_count ?? 0,
    lineage_graph_builder_path_count: artifacts.lineage_graph_builder?.summary?.lineage_path_count ?? 0,
    lineage_graph_builder_complete_path_count: artifacts.lineage_graph_builder?.summary?.complete_lineage_path_count ?? 0,
    lineage_graph_builder_broken_path_count: artifacts.lineage_graph_builder?.summary?.broken_lineage_path_count ?? 0,
    lineage_graph_builder_source_to_output_path_count: artifacts.lineage_graph_builder?.summary?.source_to_output_path_count ?? 0,
    lineage_graph_builder_citation_bound_count: artifacts.lineage_graph_builder?.summary?.citation_bound_lineage_count ?? 0,
    lineage_graph_builder_matter_preserved_count: artifacts.lineage_graph_builder?.summary?.matter_preserved_path_count ?? 0,
    lineage_graph_builder_classification_preserved_count: artifacts.lineage_graph_builder?.summary?.classification_preserved_path_count ?? 0,
    lineage_graph_builder_policy_snapshot_preserved_count: artifacts.lineage_graph_builder?.summary?.policy_snapshot_preserved_path_count ?? 0,
    lineage_graph_builder_needs_review_count: artifacts.lineage_graph_builder?.summary?.needs_review_path_count ?? 0,
    lineage_graph_builder_not_client_facing_output_path_count: artifacts.lineage_graph_builder?.summary?.not_client_facing_output_path_count ?? 0,
    lineage_graph_builder_client_facing_ready_path_count: artifacts.lineage_graph_builder?.summary?.client_facing_ready_path_count ?? 0,
    lineage_graph_builder_validation_error_count: artifacts.lineage_graph_builder?.summary?.validation_error_count ?? artifacts.lineage_graph_builder?.validation?.errors?.length ?? 0,
    evidence_coverage_status: artifacts.evidence_coverage_score?.summary?.evidence_coverage_status ?? "unknown",
    evidence_coverage_contract_id: artifacts.evidence_coverage_score?.summary?.evidence_coverage_contract_id ?? null,
    evidence_coverage_score_schema_version: artifacts.evidence_coverage_score?.summary?.coverage_score_schema_version ?? null,
    evidence_coverage_dimension_schema_version: artifacts.evidence_coverage_score?.summary?.coverage_dimension_schema_version ?? null,
    evidence_coverage_lineage_graph_status: artifacts.evidence_coverage_score?.summary?.lineage_graph_status ?? "unknown",
    evidence_coverage_source_span_store_status: artifacts.evidence_coverage_score?.summary?.source_span_store_status ?? "unknown",
    evidence_coverage_evidence_item_store_status: artifacts.evidence_coverage_score?.summary?.evidence_item_store_status ?? "unknown",
    evidence_coverage_fact_claim_store_status: artifacts.evidence_coverage_score?.summary?.fact_claim_store_status ?? "unknown",
    evidence_coverage_issue_graph_store_status: artifacts.evidence_coverage_score?.summary?.issue_graph_store_status ?? "unknown",
    evidence_coverage_citation_object_store_status: artifacts.evidence_coverage_score?.summary?.citation_object_store_status ?? "unknown",
    evidence_coverage_lineage_path_count: artifacts.evidence_coverage_score?.summary?.lineage_path_count ?? 0,
    evidence_coverage_output_paragraph_count: artifacts.evidence_coverage_score?.summary?.output_paragraph_count ?? 0,
    evidence_coverage_score_count: artifacts.evidence_coverage_score?.summary?.coverage_score_count ?? 0,
    evidence_coverage_dimension_count: artifacts.evidence_coverage_score?.summary?.coverage_dimension_count ?? 0,
    evidence_coverage_required_dimension_count: artifacts.evidence_coverage_score?.summary?.required_dimension_count ?? 0,
    evidence_coverage_covered_required_dimension_count: artifacts.evidence_coverage_score?.summary?.covered_required_dimension_count ?? 0,
    evidence_coverage_missing_required_dimension_count: artifacts.evidence_coverage_score?.summary?.missing_required_dimension_count ?? 0,
    evidence_coverage_not_applicable_dimension_count: artifacts.evidence_coverage_score?.summary?.not_applicable_dimension_count ?? 0,
    evidence_coverage_full_score_count: artifacts.evidence_coverage_score?.summary?.full_coverage_score_count ?? 0,
    evidence_coverage_partial_score_count: artifacts.evidence_coverage_score?.summary?.partial_coverage_score_count ?? 0,
    evidence_coverage_average_score: artifacts.evidence_coverage_score?.summary?.average_coverage_score ?? 0,
    evidence_coverage_claim_dimension_count: artifacts.evidence_coverage_score?.summary?.claim_dimension_count ?? 0,
    evidence_coverage_claim_covered_count: artifacts.evidence_coverage_score?.summary?.claim_covered_count ?? 0,
    evidence_coverage_date_dimension_count: artifacts.evidence_coverage_score?.summary?.date_dimension_count ?? 0,
    evidence_coverage_date_required_count: artifacts.evidence_coverage_score?.summary?.date_required_count ?? 0,
    evidence_coverage_date_covered_count: artifacts.evidence_coverage_score?.summary?.date_covered_count ?? 0,
    evidence_coverage_party_dimension_count: artifacts.evidence_coverage_score?.summary?.party_dimension_count ?? 0,
    evidence_coverage_party_required_count: artifacts.evidence_coverage_score?.summary?.party_required_count ?? 0,
    evidence_coverage_party_covered_count: artifacts.evidence_coverage_score?.summary?.party_covered_count ?? 0,
    evidence_coverage_amount_dimension_count: artifacts.evidence_coverage_score?.summary?.amount_dimension_count ?? 0,
    evidence_coverage_amount_required_count: artifacts.evidence_coverage_score?.summary?.amount_required_count ?? 0,
    evidence_coverage_amount_covered_count: artifacts.evidence_coverage_score?.summary?.amount_covered_count ?? 0,
    evidence_coverage_legal_basis_dimension_count: artifacts.evidence_coverage_score?.summary?.legal_basis_dimension_count ?? 0,
    evidence_coverage_legal_basis_covered_count: artifacts.evidence_coverage_score?.summary?.legal_basis_covered_count ?? 0,
    evidence_coverage_matter_preserved_count: artifacts.evidence_coverage_score?.summary?.matter_preserved_score_count ?? 0,
    evidence_coverage_classification_preserved_count: artifacts.evidence_coverage_score?.summary?.classification_preserved_score_count ?? 0,
    evidence_coverage_policy_snapshot_preserved_count: artifacts.evidence_coverage_score?.summary?.policy_snapshot_preserved_score_count ?? 0,
    evidence_coverage_needs_review_count: artifacts.evidence_coverage_score?.summary?.needs_review_score_count ?? 0,
    evidence_coverage_not_client_facing_output_count: artifacts.evidence_coverage_score?.summary?.not_client_facing_output_score_count ?? 0,
    evidence_coverage_client_facing_ready_count: artifacts.evidence_coverage_score?.summary?.client_facing_ready_score_count ?? 0,
    evidence_coverage_validation_error_count: artifacts.evidence_coverage_score?.summary?.validation_error_count ?? artifacts.evidence_coverage_score?.validation?.errors?.length ?? 0,
    evidence_contract_freeze_source_span_count: artifacts.evidence_contract_freeze?.summary?.source_span_count ?? 0,
    evidence_contract_freeze_evidence_item_count: artifacts.evidence_contract_freeze?.summary?.evidence_item_count ?? 0,
    evidence_contract_freeze_fact_claim_count: artifacts.evidence_contract_freeze?.summary?.fact_claim_count ?? 0,
    evidence_contract_freeze_issue_count: artifacts.evidence_contract_freeze?.summary?.issue_count ?? 0,
    evidence_contract_freeze_citation_count: artifacts.evidence_contract_freeze?.summary?.citation_count ?? 0,
    evidence_contract_freeze_lineage_edge_count: artifacts.evidence_contract_freeze?.summary?.lineage_edge_count ?? 0,
    evidence_contract_freeze_citation_bound_count: artifacts.evidence_contract_freeze?.summary?.citation_bound_count ?? 0,
    evidence_contract_freeze_citation_broken_count: artifacts.evidence_contract_freeze?.summary?.citation_broken_count ?? 0,
    evidence_contract_freeze_complete_lineage_path_count: artifacts.evidence_contract_freeze?.summary?.complete_lineage_path_count ?? 0,
    evidence_contract_freeze_broken_lineage_path_count: artifacts.evidence_contract_freeze?.summary?.broken_lineage_path_count ?? 0,
    evidence_contract_freeze_resource_linked_source_span_count: artifacts.evidence_contract_freeze?.summary?.resource_linked_source_span_count ?? 0,
    evidence_contract_freeze_matter_linked_evidence_count: artifacts.evidence_contract_freeze?.summary?.matter_linked_evidence_count ?? 0,
    evidence_contract_freeze_policy_snapshot_linked_evidence_count: artifacts.evidence_contract_freeze?.summary?.policy_snapshot_linked_evidence_count ?? 0,
    evidence_contract_freeze_failed_validation_item_count: artifacts.evidence_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    evidence_contract_freeze_validation_error_count: artifacts.evidence_contract_freeze?.summary?.validation_error_count ?? artifacts.evidence_contract_freeze?.validation?.errors?.length ?? 0,
    capability_workflow_contract_freeze_capability_manifest_count: artifacts.capability_workflow_contract_freeze?.summary?.capability_manifest_count ?? 0,
    capability_workflow_contract_freeze_workflow_count: artifacts.capability_workflow_contract_freeze?.summary?.workflow_count ?? 0,
    capability_workflow_contract_freeze_workflow_run_count: artifacts.capability_workflow_contract_freeze?.summary?.workflow_run_count ?? 0,
    capability_workflow_contract_freeze_agent_run_count: artifacts.capability_workflow_contract_freeze?.summary?.agent_run_count ?? 0,
    capability_workflow_contract_freeze_capability_io_contract_count: artifacts.capability_workflow_contract_freeze?.summary?.capability_io_contract_count ?? 0,
    capability_workflow_contract_freeze_gate_runtime_contract_count: artifacts.capability_workflow_contract_freeze?.summary?.gate_runtime_contract_count ?? 0,
    capability_workflow_contract_freeze_workflow_execution_binding_count: artifacts.capability_workflow_contract_freeze?.summary?.workflow_execution_binding_count ?? 0,
    capability_workflow_contract_freeze_capability_with_input_output_count: artifacts.capability_workflow_contract_freeze?.summary?.capability_with_input_output_count ?? 0,
    capability_workflow_contract_freeze_capability_with_gate_contract_count: artifacts.capability_workflow_contract_freeze?.summary?.capability_with_gate_contract_count ?? 0,
    capability_workflow_contract_freeze_capability_with_runtime_contract_count: artifacts.capability_workflow_contract_freeze?.summary?.capability_with_runtime_contract_count ?? 0,
    capability_workflow_contract_freeze_workflow_linked_capability_count: artifacts.capability_workflow_contract_freeze?.summary?.workflow_linked_capability_count ?? 0,
    capability_workflow_contract_freeze_workflow_run_linked_workflow_count: artifacts.capability_workflow_contract_freeze?.summary?.workflow_run_linked_workflow_count ?? 0,
    capability_workflow_contract_freeze_agent_run_linked_workflow_run_count: artifacts.capability_workflow_contract_freeze?.summary?.agent_run_linked_workflow_run_count ?? 0,
    capability_workflow_contract_freeze_runtime_binding_count: artifacts.capability_workflow_contract_freeze?.summary?.runtime_binding_count ?? 0,
    capability_workflow_contract_freeze_runtime_binding_allowed_count: artifacts.capability_workflow_contract_freeze?.summary?.runtime_binding_allowed_count ?? 0,
    capability_workflow_contract_freeze_runtime_binding_blocked_count: artifacts.capability_workflow_contract_freeze?.summary?.runtime_binding_blocked_count ?? 0,
    capability_workflow_contract_freeze_gate_binding_count: artifacts.capability_workflow_contract_freeze?.summary?.gate_binding_count ?? 0,
    capability_workflow_contract_freeze_required_field_declared_count: artifacts.capability_workflow_contract_freeze?.summary?.required_field_declared_count ?? 0,
    capability_workflow_contract_freeze_optional_field_declared_count: artifacts.capability_workflow_contract_freeze?.summary?.optional_field_declared_count ?? 0,
    capability_workflow_contract_freeze_version_required_count: artifacts.capability_workflow_contract_freeze?.summary?.version_required_count ?? 0,
    capability_workflow_contract_freeze_failed_validation_item_count: artifacts.capability_workflow_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    capability_workflow_contract_freeze_validation_error_count: artifacts.capability_workflow_contract_freeze?.summary?.validation_error_count ?? artifacts.capability_workflow_contract_freeze?.validation?.errors?.length ?? 0,
    runtime_agentrun_contract_freeze_runtime_adapter_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_adapter_count ?? 0,
    runtime_agentrun_contract_freeze_runtime_execution_contract_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_execution_contract_count ?? 0,
    runtime_agentrun_contract_freeze_used_runtime_count: artifacts.runtime_agentrun_contract_freeze?.summary?.used_runtime_count ?? 0,
    runtime_agentrun_contract_freeze_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_runtime_output_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_output_count ?? 0,
    runtime_agentrun_contract_freeze_runtime_log_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_log_count ?? 0,
    runtime_agentrun_contract_freeze_runtime_artifact_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_artifact_count ?? 0,
    runtime_agentrun_contract_freeze_runtime_verification_count: artifacts.runtime_agentrun_contract_freeze?.summary?.runtime_verification_count ?? 0,
    runtime_agentrun_contract_freeze_risk_declared_count: artifacts.runtime_agentrun_contract_freeze?.summary?.risk_declared_count ?? 0,
    runtime_agentrun_contract_freeze_verification_flag_declared_count: artifacts.runtime_agentrun_contract_freeze?.summary?.verification_flag_declared_count ?? 0,
    runtime_agentrun_contract_freeze_log_required_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.log_required_agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_agent_log_bound_count: artifacts.runtime_agentrun_contract_freeze?.summary?.agent_log_bound_count ?? 0,
    runtime_agentrun_contract_freeze_output_hash_count: artifacts.runtime_agentrun_contract_freeze?.summary?.output_hash_count ?? 0,
    runtime_agentrun_contract_freeze_artifact_capture_required_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.artifact_capture_required_agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_artifact_capture_bound_count: artifacts.runtime_agentrun_contract_freeze?.summary?.artifact_capture_bound_count ?? 0,
    runtime_agentrun_contract_freeze_high_risk_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.high_risk_agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_untrusted_output_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.untrusted_output_agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_verification_required_agent_run_count: artifacts.runtime_agentrun_contract_freeze?.summary?.verification_required_agent_run_count ?? 0,
    runtime_agentrun_contract_freeze_failed_validation_item_count: artifacts.runtime_agentrun_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    runtime_agentrun_contract_freeze_validation_error_count: artifacts.runtime_agentrun_contract_freeze?.summary?.validation_error_count ?? artifacts.runtime_agentrun_contract_freeze?.validation?.errors?.length ?? 0,
    gate_approval_contract_freeze_gate_result_count: artifacts.gate_approval_contract_freeze?.summary?.gate_result_count ?? 0,
    gate_approval_contract_freeze_approval_request_count: artifacts.gate_approval_contract_freeze?.summary?.approval_request_count ?? 0,
    gate_approval_contract_freeze_approval_decision_count: artifacts.gate_approval_contract_freeze?.summary?.approval_decision_count ?? 0,
    gate_approval_contract_freeze_human_gate_contract_count: artifacts.gate_approval_contract_freeze?.summary?.human_gate_contract_count ?? 0,
    gate_approval_contract_freeze_human_approval_gate_count: artifacts.gate_approval_contract_freeze?.summary?.human_approval_gate_count ?? 0,
    gate_approval_contract_freeze_human_approval_gate_linked_count: artifacts.gate_approval_contract_freeze?.summary?.human_approval_gate_linked_count ?? 0,
    gate_approval_contract_freeze_gate_approval_binding_count: artifacts.gate_approval_contract_freeze?.summary?.gate_approval_binding_count ?? 0,
    gate_approval_contract_freeze_linked_gate_approval_binding_count: artifacts.gate_approval_contract_freeze?.summary?.linked_gate_approval_binding_count ?? 0,
    gate_approval_contract_freeze_output_approval_request_count: artifacts.gate_approval_contract_freeze?.summary?.output_approval_request_count ?? 0,
    gate_approval_contract_freeze_gate_blocker_review_count: artifacts.gate_approval_contract_freeze?.summary?.gate_blocker_review_count ?? 0,
    gate_approval_contract_freeze_evidence_review_request_count: artifacts.gate_approval_contract_freeze?.summary?.evidence_review_request_count ?? 0,
    gate_approval_contract_freeze_protected_explicit_approval_request_count: artifacts.gate_approval_contract_freeze?.summary?.protected_explicit_approval_request_count ?? 0,
    gate_approval_contract_freeze_approval_authority_declared_count: artifacts.gate_approval_contract_freeze?.summary?.approval_authority_declared_count ?? 0,
    gate_approval_contract_freeze_pending_approval_request_count: artifacts.gate_approval_contract_freeze?.summary?.pending_approval_request_count ?? 0,
    gate_approval_contract_freeze_orphan_approval_decision_count: artifacts.gate_approval_contract_freeze?.summary?.orphan_approval_decision_count ?? 0,
    gate_approval_contract_freeze_failed_validation_item_count: artifacts.gate_approval_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    gate_approval_contract_freeze_validation_error_count: artifacts.gate_approval_contract_freeze?.summary?.validation_error_count ?? artifacts.gate_approval_contract_freeze?.validation?.errors?.length ?? 0,
    output_delivery_contract_freeze_output_artifact_count: artifacts.output_delivery_contract_freeze?.summary?.output_artifact_count ?? 0,
    output_delivery_contract_freeze_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.delivery_action_count ?? 0,
    output_delivery_contract_freeze_delivery_receipt_count: artifacts.output_delivery_contract_freeze?.summary?.delivery_receipt_count ?? 0,
    output_delivery_contract_freeze_output_delivery_binding_count: artifacts.output_delivery_contract_freeze?.summary?.output_delivery_binding_count ?? 0,
    output_delivery_contract_freeze_delivery_state_transition_count: artifacts.output_delivery_contract_freeze?.summary?.delivery_state_transition_count ?? 0,
    output_delivery_contract_freeze_artifact_hash_count: artifacts.output_delivery_contract_freeze?.summary?.artifact_hash_count ?? 0,
    output_delivery_contract_freeze_missing_artifact_hash_count: artifacts.output_delivery_contract_freeze?.summary?.missing_artifact_hash_count ?? 0,
    output_delivery_contract_freeze_linked_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.linked_delivery_action_count ?? 0,
    output_delivery_contract_freeze_missing_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.missing_delivery_action_count ?? 0,
    output_delivery_contract_freeze_pending_approval_artifact_count: artifacts.output_delivery_contract_freeze?.summary?.pending_approval_artifact_count ?? 0,
    output_delivery_contract_freeze_approval_request_linked_artifact_count: artifacts.output_delivery_contract_freeze?.summary?.approval_request_linked_artifact_count ?? 0,
    output_delivery_contract_freeze_protected_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.protected_delivery_action_count ?? 0,
    output_delivery_contract_freeze_draft_only_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.draft_only_delivery_action_count ?? 0,
    output_delivery_contract_freeze_ready_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.ready_delivery_action_count ?? 0,
    output_delivery_contract_freeze_executed_delivery_action_count: artifacts.output_delivery_contract_freeze?.summary?.executed_delivery_action_count ?? 0,
    output_delivery_contract_freeze_delivered_receipt_count: artifacts.output_delivery_contract_freeze?.summary?.delivered_receipt_count ?? 0,
    output_delivery_contract_freeze_pending_receipt_count: artifacts.output_delivery_contract_freeze?.summary?.pending_receipt_count ?? 0,
    output_delivery_contract_freeze_linked_binding_count: artifacts.output_delivery_contract_freeze?.summary?.linked_binding_count ?? 0,
    output_delivery_contract_freeze_attention_binding_count: artifacts.output_delivery_contract_freeze?.summary?.attention_binding_count ?? 0,
    output_delivery_contract_freeze_failed_validation_item_count: artifacts.output_delivery_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    output_delivery_contract_freeze_validation_error_count: artifacts.output_delivery_contract_freeze?.summary?.validation_error_count ?? artifacts.output_delivery_contract_freeze?.validation?.errors?.length ?? 0,
    event_audit_run_contract_freeze_event_record_count: artifacts.event_audit_run_contract_freeze?.summary?.event_record_count ?? 0,
    event_audit_run_contract_freeze_audit_event_count: artifacts.event_audit_run_contract_freeze?.summary?.audit_event_count ?? 0,
    event_audit_run_contract_freeze_run_ledger_count: artifacts.event_audit_run_contract_freeze?.summary?.run_ledger_count ?? 0,
    event_audit_run_contract_freeze_event_run_binding_count: artifacts.event_audit_run_contract_freeze?.summary?.event_run_binding_count ?? 0,
    event_audit_run_contract_freeze_linked_event_run_binding_count: artifacts.event_audit_run_contract_freeze?.summary?.linked_event_run_binding_count ?? 0,
    event_audit_run_contract_freeze_external_audit_event_count: artifacts.event_audit_run_contract_freeze?.summary?.external_audit_event_count ?? 0,
    event_audit_run_contract_freeze_missing_event_run_binding_count: artifacts.event_audit_run_contract_freeze?.summary?.missing_event_run_binding_count ?? 0,
    event_audit_run_contract_freeze_correlation_id_count: artifacts.event_audit_run_contract_freeze?.summary?.correlation_id_count ?? artifacts.event_audit_run_contract_freeze?.summary?.correlation_id_declared_count ?? 0,
    event_audit_run_contract_freeze_missing_correlation_id_count: artifacts.event_audit_run_contract_freeze?.summary?.missing_correlation_id_count ?? 0,
    event_audit_run_contract_freeze_actor_declared_count: artifacts.event_audit_run_contract_freeze?.summary?.actor_declared_count ?? 0,
    event_audit_run_contract_freeze_missing_actor_count: artifacts.event_audit_run_contract_freeze?.summary?.missing_actor_count ?? 0,
    event_audit_run_contract_freeze_policy_snapshot_declared_count: artifacts.event_audit_run_contract_freeze?.summary?.policy_snapshot_declared_count ?? 0,
    event_audit_run_contract_freeze_fallback_policy_snapshot_count: artifacts.event_audit_run_contract_freeze?.summary?.fallback_policy_snapshot_count ?? 0,
    event_audit_run_contract_freeze_missing_policy_snapshot_count: artifacts.event_audit_run_contract_freeze?.summary?.missing_policy_snapshot_count ?? 0,
    event_audit_run_contract_freeze_source_schema_version_declared_count: artifacts.event_audit_run_contract_freeze?.summary?.source_schema_version_declared_count ?? 0,
    event_audit_run_contract_freeze_run_with_event_count: artifacts.event_audit_run_contract_freeze?.summary?.run_with_event_count ?? 0,
    event_audit_run_contract_freeze_run_with_agent_count: artifacts.event_audit_run_contract_freeze?.summary?.run_with_agent_count ?? 0,
    event_audit_run_contract_freeze_run_with_policy_snapshot_count: artifacts.event_audit_run_contract_freeze?.summary?.run_with_policy_snapshot_count ?? 0,
    event_audit_run_contract_freeze_failed_validation_item_count: artifacts.event_audit_run_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    event_audit_run_contract_freeze_validation_error_count: artifacts.event_audit_run_contract_freeze?.summary?.validation_error_count ?? artifacts.event_audit_run_contract_freeze?.validation?.errors?.length ?? 0,
    error_cost_observability_contract_freeze_error_record_count: artifacts.error_cost_observability_contract_freeze?.summary?.error_record_count ?? 0,
    error_cost_observability_contract_freeze_run_blocked_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.run_blocked_error_count ?? 0,
    error_cost_observability_contract_freeze_gate_failed_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.gate_failed_error_count ?? 0,
    error_cost_observability_contract_freeze_retryable_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.retryable_error_count ?? 0,
    error_cost_observability_contract_freeze_blocking_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.blocking_error_count ?? 0,
    error_cost_observability_contract_freeze_cost_observation_count: artifacts.error_cost_observability_contract_freeze?.summary?.cost_observation_count ?? 0,
    error_cost_observability_contract_freeze_token_usage_linked_count: artifacts.error_cost_observability_contract_freeze?.summary?.token_usage_linked_count ?? 0,
    error_cost_observability_contract_freeze_missing_token_usage_count: artifacts.error_cost_observability_contract_freeze?.summary?.missing_token_usage_count ?? 0,
    error_cost_observability_contract_freeze_cost_attribution_linked_count: artifacts.error_cost_observability_contract_freeze?.summary?.cost_attribution_linked_count ?? 0,
    error_cost_observability_contract_freeze_budget_alert_linked_count: artifacts.error_cost_observability_contract_freeze?.summary?.budget_alert_linked_count ?? 0,
    error_cost_observability_contract_freeze_over_budget_count: artifacts.error_cost_observability_contract_freeze?.summary?.over_budget_count ?? 0,
    error_cost_observability_contract_freeze_untracked_cost_count: artifacts.error_cost_observability_contract_freeze?.summary?.untracked_cost_count ?? 0,
    error_cost_observability_contract_freeze_total_projected_usd: artifacts.error_cost_observability_contract_freeze?.summary?.total_projected_usd ?? 0,
    error_cost_observability_contract_freeze_total_observed_usd: artifacts.error_cost_observability_contract_freeze?.summary?.total_observed_usd ?? 0,
    error_cost_observability_contract_freeze_total_estimated_token_usd: artifacts.error_cost_observability_contract_freeze?.summary?.total_estimated_token_usd ?? 0,
    error_cost_observability_contract_freeze_total_token_count: artifacts.error_cost_observability_contract_freeze?.summary?.total_token_count ?? 0,
    error_cost_observability_contract_freeze_trace_projection_count: artifacts.error_cost_observability_contract_freeze?.summary?.trace_projection_count ?? 0,
    error_cost_observability_contract_freeze_trace_with_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.trace_with_error_count ?? 0,
    error_cost_observability_contract_freeze_trace_with_cost_count: artifacts.error_cost_observability_contract_freeze?.summary?.trace_with_cost_count ?? 0,
    error_cost_observability_contract_freeze_trace_with_policy_snapshot_count: artifacts.error_cost_observability_contract_freeze?.summary?.trace_with_policy_snapshot_count ?? 0,
    error_cost_observability_contract_freeze_latency_observed_count: artifacts.error_cost_observability_contract_freeze?.summary?.latency_observed_count ?? 0,
    error_cost_observability_contract_freeze_missing_latency_count: artifacts.error_cost_observability_contract_freeze?.summary?.missing_latency_count ?? 0,
    error_cost_observability_contract_freeze_total_runtime_seconds: artifacts.error_cost_observability_contract_freeze?.summary?.total_runtime_seconds ?? 0,
    error_cost_observability_contract_freeze_average_latency_seconds: artifacts.error_cost_observability_contract_freeze?.summary?.average_latency_seconds ?? 0,
    error_cost_observability_contract_freeze_retry_projection_count: artifacts.error_cost_observability_contract_freeze?.summary?.retry_projection_count ?? 0,
    error_cost_observability_contract_freeze_retry_count: artifacts.error_cost_observability_contract_freeze?.summary?.retry_count ?? 0,
    error_cost_observability_contract_freeze_trace_with_retry_count: artifacts.error_cost_observability_contract_freeze?.summary?.trace_with_retry_count ?? 0,
    error_cost_observability_contract_freeze_failed_validation_item_count: artifacts.error_cost_observability_contract_freeze?.summary?.failed_validation_item_count ?? 0,
    error_cost_observability_contract_freeze_validation_error_count: artifacts.error_cost_observability_contract_freeze?.summary?.validation_error_count ?? artifacts.error_cost_observability_contract_freeze?.validation?.errors?.length ?? 0,
    evidence_needs_review_count: patchedEvidence ? reviewCounts.needs_review ?? 0 : viewerSummary.needs_review_count ?? 0,
    evidence_approved_count: patchedEvidence ? reviewCounts.approved ?? 0 : 0,
    evidence_rejected_count: patchedEvidence ? reviewCounts.rejected ?? 0 : 0,
    blocking_gate_count: blockingGateCount,
    blocked_resource_count: blockedResourceCount,
    approval_queue_item_count: queueSummary.total_items ?? 0,
    evidence_review_draft_item_count: artifacts.evidence_review_draft?.summary?.review_item_count ?? 0,
    evidence_review_draft_attorney_count: artifacts.evidence_review_draft?.summary?.attorney_review_count ?? 0,
    evidence_review_draft_suggested_approve_count: artifacts.evidence_review_draft?.summary?.suggested_approve_count ?? 0,
    evidence_review_draft_pending_decision_count: artifacts.evidence_review_draft?.summary?.pending_decision_count ?? 0,
    approval_applied_count: decisionSummary.applied_count ?? 0,
    pending_approval_count: pendingApprovalCount,
    approval_inbox_item_count: artifacts.approval_inbox?.summary?.inbox_item_count ?? 0,
    approval_inbox_request_count: artifacts.approval_inbox?.summary?.approval_request_count ?? 0,
    approval_inbox_gate_review_count: artifacts.approval_inbox?.summary?.gate_review_count ?? 0,
    approval_inbox_high_priority_count: artifacts.approval_inbox?.summary?.high_priority_count ?? 0,
    approval_inbox_applied_count: artifacts.approval_inbox_decisions?.summary?.applied_count ?? 0,
    approval_inbox_decision_pending_count: artifacts.approval_inbox_decisions?.summary?.pending_count ?? 0,
    approval_inbox_ready_for_delivery_count: artifacts.approval_inbox_decisions?.summary?.ready_for_delivery_count ?? 0,
    approval_inbox_decision_error_count: artifacts.approval_inbox_decisions?.summary?.decision_error_count ?? 0,
    policy_classification_count: artifacts.policy_matrix_catalog?.summary?.classification_count ?? 0,
    policy_runtime_rule_count: artifacts.policy_matrix_catalog?.summary?.runtime_rule_count ?? 0,
    policy_model_rule_count: artifacts.policy_matrix_catalog?.summary?.model_rule_count ?? 0,
    policy_tool_rule_count: artifacts.policy_matrix_catalog?.summary?.tool_rule_count ?? 0,
    policy_output_rule_count: artifacts.policy_matrix_catalog?.summary?.output_rule_count ?? 0,
    policy_gate_rule_count: artifacts.policy_matrix_catalog?.summary?.gate_rule_count ?? 0,
    policy_external_model_forbidden_count: artifacts.policy_matrix_catalog?.summary?.external_model_forbidden_count ?? 0,
    policy_external_model_approval_required_count: artifacts.policy_matrix_catalog?.summary?.external_model_approval_required_count ?? 0,
    policy_approval_required_tool_count: artifacts.policy_matrix_catalog?.summary?.approval_required_tool_count ?? 0,
    policy_approval_required_output_count: artifacts.policy_matrix_catalog?.summary?.approval_required_output_count ?? 0,
    policy_validation_error_count: artifacts.policy_matrix_catalog?.summary?.validation_error_count ?? artifacts.policy_matrix_catalog?.validation?.errors?.length ?? 0,
    policy_snapshot_count: artifacts.policy_snapshot_ledger?.summary?.policy_snapshot_count ?? 0,
    policy_snapshot_instance_count: artifacts.policy_snapshot_ledger?.summary?.snapshot_instance_count ?? 0,
    policy_snapshot_workflow_usage_count: artifacts.policy_snapshot_ledger?.summary?.workflow_usage_count ?? 0,
    policy_snapshot_event_reference_count: artifacts.policy_snapshot_ledger?.summary?.event_reference_count ?? 0,
    policy_snapshot_run_ledger_reference_count: artifacts.policy_snapshot_ledger?.summary?.run_ledger_reference_count ?? 0,
    policy_snapshot_missing_reference_count: artifacts.policy_snapshot_ledger?.summary?.missing_snapshot_reference_count ?? 0,
    policy_snapshot_runtime_violation_count: artifacts.policy_snapshot_ledger?.summary?.runtime_violation_count ?? 0,
    policy_snapshot_validation_error_count: artifacts.policy_snapshot_ledger?.summary?.validation_error_count ?? artifacts.policy_snapshot_ledger?.validation?.errors?.length ?? 0,
    policy_snapshot_binding_status: artifacts.policy_snapshot_binding_ledger?.summary?.policy_snapshot_binding_status ?? "unknown",
    policy_snapshot_binding_count: artifacts.policy_snapshot_binding_ledger?.summary?.policy_snapshot_binding_count ?? 0,
    policy_snapshot_binding_known_count: artifacts.policy_snapshot_binding_ledger?.summary?.known_policy_snapshot_binding_count ?? 0,
    policy_snapshot_binding_workflow_count: artifacts.policy_snapshot_binding_ledger?.summary?.workflow_policy_binding_count ?? 0,
    policy_snapshot_binding_agent_run_count: artifacts.policy_snapshot_binding_ledger?.summary?.agent_run_policy_binding_count ?? 0,
    policy_snapshot_binding_event_count: artifacts.policy_snapshot_binding_ledger?.summary?.event_policy_binding_count ?? 0,
    policy_snapshot_binding_gate_count: artifacts.policy_snapshot_binding_ledger?.summary?.gate_policy_binding_count ?? 0,
    policy_snapshot_binding_approval_count: artifacts.policy_snapshot_binding_ledger?.summary?.approval_policy_binding_count ?? 0,
    policy_snapshot_binding_output_count: artifacts.policy_snapshot_binding_ledger?.summary?.output_policy_binding_count ?? 0,
    policy_snapshot_binding_fallback_count: artifacts.policy_snapshot_binding_ledger?.summary?.fallback_resolved_binding_count ?? 0,
    policy_snapshot_binding_unresolved_declared_count: artifacts.policy_snapshot_binding_ledger?.summary?.unresolved_declared_reference_count ?? 0,
    policy_snapshot_binding_missing_count: artifacts.policy_snapshot_binding_ledger?.summary?.missing_policy_snapshot_count ?? 0,
    policy_snapshot_binding_unresolved_count: artifacts.policy_snapshot_binding_ledger?.summary?.unresolved_policy_snapshot_count ?? 0,
    policy_snapshot_binding_validation_error_count: artifacts.policy_snapshot_binding_ledger?.summary?.validation_error_count ?? artifacts.policy_snapshot_binding_ledger?.validation?.errors?.length ?? 0,
    context_packet_count: artifacts.context_packet_ledger?.summary?.context_packet_count ?? 0,
    context_packet_ready_count: artifacts.context_packet_ledger?.summary?.ready_packet_count ?? 0,
    context_packet_blocked_count: artifacts.context_packet_ledger?.summary?.blocked_packet_count ?? 0,
    context_packet_redacted_count: artifacts.context_packet_ledger?.summary?.redacted_packet_count ?? 0,
    context_item_count: artifacts.context_packet_ledger?.summary?.context_item_count ?? 0,
    context_retrieval_filter_count: artifacts.context_packet_ledger?.summary?.retrieval_filter_count ?? 0,
    context_missing_filter_count: artifacts.context_packet_ledger?.summary?.missing_filter_count ?? 0,
    context_runtime_mismatch_count: artifacts.context_packet_ledger?.summary?.runtime_mismatch_count ?? 0,
    context_classification_blocked_count: artifacts.context_packet_ledger?.summary?.classification_blocked_count ?? 0,
    context_validation_error_count: artifacts.context_packet_ledger?.summary?.validation_error_count ?? artifacts.context_packet_ledger?.validation?.errors?.length ?? 0,
    model_route_count: artifacts.model_routing_ledger?.summary?.routing_decision_count ?? 0,
    model_route_ready_count: artifacts.model_routing_ledger?.summary?.ready_route_count ?? 0,
    model_route_approval_required_count: artifacts.model_routing_ledger?.summary?.approval_required_route_count ?? 0,
    model_route_blocked_count: artifacts.model_routing_ledger?.summary?.blocked_route_count ?? 0,
    model_route_external_transfer_count: artifacts.model_routing_ledger?.summary?.external_transfer_count ?? 0,
    model_route_local_count: artifacts.model_routing_ledger?.summary?.local_route_count ?? 0,
    model_route_redaction_enforced_count: artifacts.model_routing_ledger?.summary?.redaction_enforced_count ?? 0,
    model_route_validation_error_count: artifacts.model_routing_ledger?.summary?.validation_error_count ?? artifacts.model_routing_ledger?.validation?.errors?.length ?? 0,
    model_policy_enforcement_status: artifacts.model_policy_enforcement?.summary?.model_policy_enforcement_status ?? "unknown",
    model_policy_classification_gate_count: artifacts.model_policy_enforcement?.summary?.classification_model_gate_count ?? 0,
    model_policy_resource_gate_count: artifacts.model_policy_enforcement?.summary?.resource_model_gate_count ?? 0,
    model_policy_route_gate_count: artifacts.model_policy_enforcement?.summary?.route_model_gate_count ?? 0,
    model_policy_p2_p5_classification_gate_count: artifacts.model_policy_enforcement?.summary?.p2_p5_classification_gate_count ?? 0,
    model_policy_p2_p5_resource_gate_count: artifacts.model_policy_enforcement?.summary?.p2_p5_resource_gate_count ?? 0,
    model_policy_external_transfer_route_count: artifacts.model_policy_enforcement?.summary?.external_transfer_route_count ?? 0,
    model_policy_p2_p5_external_transfer_route_count: artifacts.model_policy_enforcement?.summary?.p2_p5_external_transfer_route_count ?? 0,
    model_policy_external_transfer_allowed_count: artifacts.model_policy_enforcement?.summary?.external_transfer_allowed_count ?? 0,
    model_policy_external_transfer_review_count: artifacts.model_policy_enforcement?.summary?.external_transfer_review_count ?? 0,
    model_policy_external_transfer_denied_count: artifacts.model_policy_enforcement?.summary?.external_transfer_denied_count ?? 0,
    model_policy_unauthorized_external_allow_count: artifacts.model_policy_enforcement?.summary?.unauthorized_external_allow_count ?? 0,
    model_policy_redaction_required_resource_gate_count: artifacts.model_policy_enforcement?.summary?.redaction_required_resource_gate_count ?? 0,
    model_policy_redaction_blocked_route_count: artifacts.model_policy_enforcement?.summary?.redaction_blocked_route_count ?? 0,
    model_policy_human_approval_required_gate_count: artifacts.model_policy_enforcement?.summary?.human_approval_required_gate_count ?? 0,
    model_policy_validation_error_count: artifacts.model_policy_enforcement?.summary?.validation_error_count ?? artifacts.model_policy_enforcement?.validation?.errors?.length ?? 0,
    tool_runtime_policy_enforcement_status: artifacts.tool_runtime_policy_enforcement?.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
    tool_runtime_policy_runtime_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.runtime_policy_gate_count ?? 0,
    tool_runtime_policy_blocked_runtime_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.blocked_runtime_policy_gate_count ?? 0,
    tool_runtime_policy_restricted_runtime_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.restricted_runtime_policy_gate_count ?? 0,
    tool_runtime_policy_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.tool_permission_gate_count ?? 0,
    tool_runtime_policy_allowed_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.allowed_tool_gate_count ?? 0,
    tool_runtime_policy_forbidden_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.forbidden_tool_gate_count ?? 0,
    tool_runtime_policy_forbidden_tool_blocked_count: artifacts.tool_runtime_policy_enforcement?.summary?.forbidden_tool_blocked_count ?? 0,
    tool_runtime_policy_review_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.review_tool_gate_count ?? 0,
    tool_runtime_policy_denied_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.denied_tool_gate_count ?? 0,
    tool_runtime_policy_protected_action_tool_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.protected_action_tool_gate_count ?? 0,
    tool_runtime_policy_agent_run_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.agent_run_tool_gate_count ?? 0,
    tool_runtime_policy_agent_run_allow_count: artifacts.tool_runtime_policy_enforcement?.summary?.agent_run_tool_gate_allow_count ?? 0,
    tool_runtime_policy_agent_run_review_count: artifacts.tool_runtime_policy_enforcement?.summary?.agent_run_tool_gate_review_count ?? 0,
    tool_runtime_policy_agent_run_deny_count: artifacts.tool_runtime_policy_enforcement?.summary?.agent_run_tool_gate_deny_count ?? 0,
    tool_runtime_policy_unknown_tool_count: artifacts.tool_runtime_policy_enforcement?.summary?.unknown_tool_count ?? 0,
    tool_runtime_policy_tool_overlap_count: artifacts.tool_runtime_policy_enforcement?.summary?.tool_overlap_count ?? 0,
    tool_runtime_policy_missing_gate_count: artifacts.tool_runtime_policy_enforcement?.summary?.missing_tool_permission_gate_count ?? 0,
    tool_runtime_policy_validation_error_count: artifacts.tool_runtime_policy_enforcement?.summary?.validation_error_count ?? artifacts.tool_runtime_policy_enforcement?.validation?.errors?.length ?? 0,
    output_destination_policy_status: artifacts.output_destination_policy_enforcement?.summary?.output_destination_policy_status ?? "unknown",
    output_destination_policy_rule_count: artifacts.output_destination_policy_enforcement?.summary?.policy_rule_count ?? 0,
    output_destination_policy_artifact_gate_count: artifacts.output_destination_policy_enforcement?.summary?.artifact_destination_gate_count ?? 0,
    output_destination_policy_delivery_action_gate_count: artifacts.output_destination_policy_enforcement?.summary?.delivery_action_destination_gate_count ?? 0,
    output_destination_policy_final_action_gate_count: artifacts.output_destination_policy_enforcement?.summary?.final_action_separation_gate_count ?? 0,
    output_destination_policy_required_delivery_count: artifacts.output_destination_policy_enforcement?.summary?.final_action_required_delivery_count ?? 0,
    output_destination_policy_protected_destination_count: artifacts.output_destination_policy_enforcement?.summary?.protected_destination_count ?? 0,
    output_destination_policy_blocked_final_action_count: artifacts.output_destination_policy_enforcement?.summary?.blocked_final_action_count ?? 0,
    output_destination_policy_pending_approval_count: artifacts.output_destination_policy_enforcement?.summary?.pending_approval_final_action_count ?? 0,
    output_destination_policy_executed_final_action_count: artifacts.output_destination_policy_enforcement?.summary?.executed_final_action_count ?? 0,
    output_destination_policy_unsafe_final_action_count: artifacts.output_destination_policy_enforcement?.summary?.unsafe_final_action_count ?? 0,
    output_destination_policy_missing_policy_count: artifacts.output_destination_policy_enforcement?.summary?.missing_policy_count ?? 0,
    output_destination_policy_missing_tool_policy_count: artifacts.output_destination_policy_enforcement?.summary?.missing_tool_policy_count ?? 0,
    output_destination_policy_missing_gate_count: artifacts.output_destination_policy_enforcement?.summary?.missing_output_destination_gate_count ?? 0,
    output_destination_policy_validation_error_count: artifacts.output_destination_policy_enforcement?.summary?.validation_error_count ?? artifacts.output_destination_policy_enforcement?.validation?.errors?.length ?? 0,
    approval_authority_status: artifacts.approval_authority_ledger?.summary?.approval_authority_status ?? "unknown",
    approval_authority_policy_count: artifacts.approval_authority_ledger?.summary?.authority_policy_count ?? 0,
    approval_authority_decision_count: artifacts.approval_authority_ledger?.summary?.authority_decision_count ?? 0,
    approval_authority_artifact_decision_count: artifacts.approval_authority_ledger?.summary?.artifact_authority_decision_count ?? 0,
    approval_authority_request_decision_count: artifacts.approval_authority_ledger?.summary?.approval_request_authority_decision_count ?? 0,
    approval_authority_delivery_action_decision_count: artifacts.approval_authority_ledger?.summary?.delivery_action_authority_decision_count ?? 0,
    approval_authority_assigned_decision_count: artifacts.approval_authority_ledger?.summary?.assigned_authority_decision_count ?? 0,
    approval_authority_assignment_required_count: artifacts.approval_authority_ledger?.summary?.assignment_required_decision_count ?? 0,
    approval_authority_law_firm_human_required_count: artifacts.approval_authority_ledger?.summary?.law_firm_human_required_decision_count ?? 0,
    approval_authority_nonhuman_blocked_count: artifacts.approval_authority_ledger?.summary?.nonhuman_authority_blocked_count ?? 0,
    approval_authority_missing_role_count: artifacts.approval_authority_ledger?.summary?.missing_authority_role_count ?? 0,
    approval_authority_validation_error_count: artifacts.approval_authority_ledger?.summary?.validation_error_count ?? artifacts.approval_authority_ledger?.validation?.errors?.length ?? 0,
    cost_budget_decision_count: artifacts.cost_budget_ledger?.summary?.budget_decision_count ?? 0,
    cost_budget_passed_count: artifacts.cost_budget_ledger?.summary?.passed_decision_count ?? 0,
    cost_budget_blocked_count: artifacts.cost_budget_ledger?.summary?.blocked_decision_count ?? 0,
    cost_budget_token_tracking_required_count: artifacts.cost_budget_ledger?.summary?.token_tracking_required_count ?? 0,
    cost_budget_token_tracking_pending_count: artifacts.cost_budget_ledger?.summary?.token_tracking_pending_count ?? 0,
    cost_budget_total_max_usd: artifacts.cost_budget_ledger?.summary?.total_max_usd ?? 0,
    cost_budget_total_observed_usd: artifacts.cost_budget_ledger?.summary?.total_observed_usd ?? 0,
    cost_budget_total_runtime_seconds: artifacts.cost_budget_ledger?.summary?.total_observed_runtime_seconds ?? 0,
    cost_budget_validation_error_count: artifacts.cost_budget_ledger?.summary?.validation_error_count ?? artifacts.cost_budget_ledger?.validation?.errors?.length ?? 0,
    token_usage_record_count: artifacts.token_usage_ledger?.summary?.token_usage_record_count ?? 0,
    token_usage_tracking_required_count: artifacts.token_usage_ledger?.summary?.tracking_required_count ?? 0,
    token_usage_recorded_count: artifacts.token_usage_ledger?.summary?.recorded_record_count ?? 0,
    token_usage_estimated_count: artifacts.token_usage_ledger?.summary?.estimated_record_count ?? 0,
    token_usage_unknown_count: artifacts.token_usage_ledger?.summary?.unknown_record_count ?? 0,
    token_usage_blocked_count: artifacts.token_usage_ledger?.summary?.blocked_record_count ?? 0,
    token_usage_total_input_tokens: artifacts.token_usage_ledger?.summary?.total_input_token_count ?? 0,
    token_usage_total_output_tokens: artifacts.token_usage_ledger?.summary?.total_output_token_count ?? 0,
    token_usage_total_tokens: artifacts.token_usage_ledger?.summary?.total_token_count ?? 0,
    token_usage_validation_error_count: artifacts.token_usage_ledger?.summary?.validation_error_count ?? artifacts.token_usage_ledger?.validation?.errors?.length ?? 0,
    cost_attribution_record_count: artifacts.cost_attribution_ledger?.summary?.attribution_record_count ?? 0,
    cost_attribution_attributed_count: artifacts.cost_attribution_ledger?.summary?.attributed_record_count ?? 0,
    cost_attribution_attention_count: artifacts.cost_attribution_ledger?.summary?.attention_record_count ?? 0,
    cost_attribution_blocked_count: artifacts.cost_attribution_ledger?.summary?.blocked_record_count ?? 0,
    cost_attribution_over_budget_count: artifacts.cost_attribution_ledger?.summary?.over_budget_count ?? 0,
    cost_attribution_untracked_count: artifacts.cost_attribution_ledger?.summary?.untracked_cost_count ?? 0,
    cost_attribution_total_budget_usd: artifacts.cost_attribution_ledger?.summary?.total_budget_usd ?? 0,
    cost_attribution_total_projected_usd: artifacts.cost_attribution_ledger?.summary?.total_projected_usd ?? 0,
    cost_attribution_total_remaining_usd: artifacts.cost_attribution_ledger?.summary?.total_budget_remaining_usd ?? 0,
    cost_attribution_validation_error_count: artifacts.cost_attribution_ledger?.summary?.validation_error_count ?? artifacts.cost_attribution_ledger?.validation?.errors?.length ?? 0,
    budget_alert_record_count: artifacts.budget_alert_ledger?.summary?.alert_record_count ?? 0,
    budget_alert_clear_count: artifacts.budget_alert_ledger?.summary?.clear_count ?? 0,
    budget_alert_warning_count: artifacts.budget_alert_ledger?.summary?.warning_count ?? 0,
    budget_alert_critical_count: artifacts.budget_alert_ledger?.summary?.critical_count ?? 0,
    budget_alert_unbudgeted_count: artifacts.budget_alert_ledger?.summary?.unbudgeted_count ?? 0,
    budget_alert_active_count: artifacts.budget_alert_ledger?.summary?.active_alert_count ?? 0,
    budget_alert_human_required_count: artifacts.budget_alert_ledger?.summary?.human_required_count ?? 0,
    budget_alert_total_projected_usd: artifacts.budget_alert_ledger?.summary?.total_projected_usd ?? 0,
    budget_alert_total_remaining_usd: artifacts.budget_alert_ledger?.summary?.total_budget_remaining_usd ?? 0,
    budget_alert_validation_error_count: artifacts.budget_alert_ledger?.summary?.validation_error_count ?? artifacts.budget_alert_ledger?.validation?.errors?.length ?? 0,
    domain_pack_count: artifacts.domain_pack_registry?.summary?.pack_count ?? 0,
    domain_pack_capability_count: artifacts.domain_pack_registry?.summary?.capability_count ?? 0,
    invalid_domain_pack_count: artifacts.domain_pack_registry?.summary?.invalid_pack_count ?? 0,
    invalid_domain_pack_capability_count: artifacts.domain_pack_registry?.summary?.invalid_capability_count ?? 0,
    domain_pack_error_count: artifacts.domain_pack_registry?.summary?.error_count ?? artifacts.domain_pack_registry?.validation?.errors?.length ?? 0,
    output_artifact_count: artifacts.output_artifact_catalog?.summary?.artifact_count ?? 0,
    output_artifact_pending_approval_count: artifacts.output_artifact_catalog?.summary?.approval_pending_count ?? 0,
    output_artifact_blocked_delivery_count: artifacts.output_artifact_catalog?.summary?.blocked_delivery_count ?? 0,
    observability_run_count: artifacts.observability_catalog?.summary?.workflow_run_count ?? 0,
    observability_event_count: artifacts.observability_catalog?.summary?.event_count ?? 0,
    observability_runtime_seconds: artifacts.observability_catalog?.summary?.total_runtime_seconds ?? 0,
    observability_error_count: artifacts.observability_catalog?.summary?.error_record_count ?? 0,
    delivery_action_count: artifacts.protected_delivery_queue?.summary?.delivery_action_count ?? 0,
    delivery_blocked_action_count: artifacts.protected_delivery_queue?.summary?.blocked_action_count ?? 0,
    delivery_ready_action_count: artifacts.protected_delivery_queue?.summary?.ready_action_count ?? 0,
    delivery_pending_approval_count: artifacts.protected_delivery_queue?.summary?.pending_approval_count ?? 0,
    delivery_execution_ready_candidate_count: artifacts.delivery_execution_draft?.summary?.ready_candidate_count ?? 0,
    delivery_execution_packet_count: artifacts.delivery_execution_draft?.summary?.execution_packet_count ?? 0,
    delivery_execution_manual_required_count: artifacts.delivery_execution_draft?.summary?.manual_execution_required_count ?? 0,
    delivery_execution_blocked_candidate_count: artifacts.delivery_execution_draft?.summary?.blocked_candidate_count ?? 0,
    delivery_receipt_applied_count: artifacts.delivery_receipt_ledger?.summary?.applied_receipt_count ?? 0,
    delivery_receipt_pending_count: artifacts.delivery_receipt_ledger?.summary?.pending_receipt_count ?? 0,
    delivery_receipt_delivered_artifact_count: artifacts.delivery_receipt_ledger?.summary?.delivered_artifact_count ?? 0,
    delivery_receipt_error_count: artifacts.delivery_receipt_ledger?.summary?.receipt_error_count ?? 0,
    post_delivery_delivered_artifact_count: artifacts.post_delivery_reconciliation?.summary?.delivered_artifact_count ?? 0,
    post_delivery_delivered_matter_count: artifacts.post_delivery_reconciliation?.summary?.delivered_matter_count ?? 0,
    post_delivery_ready_matter_count: artifacts.post_delivery_reconciliation?.summary?.ready_matter_count ?? 0,
    post_delivery_outstanding_receipt_count: artifacts.post_delivery_reconciliation?.summary?.outstanding_receipt_count ?? 0,
    delivery_closeout_item_count: artifacts.delivery_closeout_queue?.summary?.closeout_item_count ?? 0,
    delivery_closeout_awaiting_count: artifacts.delivery_closeout_queue?.summary?.awaiting_execution_count ?? 0,
    delivery_closeout_blocked_count: artifacts.delivery_closeout_queue?.summary?.blocked_closeout_count ?? 0,
    closeout_receipt_ready_count: artifacts.closeout_receipt_validation?.summary?.ready_to_apply_count ?? 0,
    closeout_receipt_pending_count: artifacts.closeout_receipt_validation?.summary?.pending_receipt_count ?? 0,
    closeout_receipt_invalid_count: artifacts.closeout_receipt_validation?.summary?.invalid_receipt_count ?? 0,
    closeout_receipt_error_count: artifacts.closeout_receipt_validation?.summary?.error_count ?? 0,
    closeout_application_ready_count: artifacts.closeout_receipt_application?.summary?.ready_receipt_count ?? 0,
    closeout_application_applied_count: artifacts.closeout_receipt_application?.summary?.applied_receipt_count ?? 0,
    closeout_application_delivered_artifact_count: artifacts.closeout_receipt_application?.summary?.delivered_artifact_count ?? 0,
    closeout_application_error_count: artifacts.closeout_receipt_application?.summary?.receipt_error_count ?? 0,
    pipeline_step_count: artifacts.control_plane_pipeline?.summary?.step_count ?? 0,
    pipeline_passed_step_count: artifacts.control_plane_pipeline?.summary?.passed_step_count ?? 0,
    pipeline_failed_step_count: artifacts.control_plane_pipeline?.summary?.failed_step_count ?? 0,
    pipeline_missing_artifact_count: artifacts.control_plane_pipeline?.summary?.missing_artifact_count ?? 0,
    control_plane_loop_step_count: artifacts.control_plane_loop?.summary?.step_count ?? 0,
    control_plane_loop_passed_step_count: artifacts.control_plane_loop?.summary?.passed_step_count ?? 0,
    control_plane_loop_failed_step_count: artifacts.control_plane_loop?.summary?.failed_step_count ?? 0,
    control_plane_loop_missing_artifact_count: artifacts.control_plane_loop?.summary?.missing_artifact_count ?? 0,
    audit_trail_source_count: artifacts.control_plane_audit_trail?.summary?.source_count ?? 0,
    audit_trail_missing_source_count: artifacts.control_plane_audit_trail?.summary?.missing_source_count ?? 0,
    audit_trail_event_count: artifacts.control_plane_audit_trail?.summary?.audit_event_count ?? 0,
    audit_trail_duplicate_event_count: artifacts.control_plane_audit_trail?.summary?.duplicate_event_count ?? 0,
    audit_trail_protected_action_event_count: artifacts.control_plane_audit_trail?.summary?.protected_action_event_count ?? 0,
    audit_trail_protected_action_executed_count: artifacts.control_plane_audit_trail?.summary?.protected_action_executed_count ?? 0,
    audit_trail_human_actor_event_count: artifacts.control_plane_audit_trail?.summary?.human_actor_event_count ?? 0,
    goal_checkpoint_item_count: artifacts.control_plane_goal_checkpoint?.summary?.checkpoint_item_count ?? 0,
    goal_checkpoint_passed_item_count: artifacts.control_plane_goal_checkpoint?.summary?.passed_item_count ?? 0,
    goal_checkpoint_attention_item_count: artifacts.control_plane_goal_checkpoint?.summary?.attention_item_count ?? 0,
    goal_checkpoint_blocked_item_count: artifacts.control_plane_goal_checkpoint?.summary?.blocked_item_count ?? 0,
    goal_checkpoint_missing_item_count: artifacts.control_plane_goal_checkpoint?.summary?.missing_item_count ?? 0,
    contract_inventory_schema_count: artifacts.contract_inventory?.summary?.schema_count ?? 0,
    contract_inventory_parsed_schema_count: artifacts.contract_inventory?.summary?.parsed_schema_count ?? 0,
    contract_inventory_package_script_count: artifacts.contract_inventory?.summary?.package_script_count ?? 0,
    contract_inventory_loop_output_contract_count: artifacts.contract_inventory?.summary?.loop_output_contract_count ?? 0,
    contract_inventory_dashboard_source_count: artifacts.contract_inventory?.summary?.dashboard_source_count ?? 0,
    contract_inventory_api_route_count: artifacts.contract_inventory?.summary?.api_route_count ?? 0,
    contract_inventory_artifact_contract_count: artifacts.contract_inventory?.summary?.artifact_contract_count ?? 0,
    contract_inventory_inventory_item_count: artifacts.contract_inventory?.summary?.inventory_item_count ?? 0,
    contract_inventory_owner_mapped_item_count: artifacts.contract_inventory?.summary?.owner_mapped_item_count ?? 0,
    contract_inventory_owner_area_count: artifacts.contract_inventory?.summary?.owner_area_count ?? 0,
    contract_inventory_validation_error_count: artifacts.contract_inventory?.summary?.validation_error_count ?? artifacts.contract_inventory?.validation?.errors?.length ?? 0,
    contract_dependency_map_node_count: artifacts.contract_dependency_map?.summary?.node_count ?? 0,
    contract_dependency_map_edge_count: artifacts.contract_dependency_map?.summary?.edge_count ?? 0,
    contract_dependency_map_schema_edge_count: artifacts.contract_dependency_map?.summary?.schema_dependency_edge_count ?? 0,
    contract_dependency_map_dashboard_edge_count: artifacts.contract_dependency_map?.summary?.dashboard_dependency_edge_count ?? 0,
    contract_dependency_map_api_edge_count: artifacts.contract_dependency_map?.summary?.api_dependency_edge_count ?? 0,
    contract_dependency_map_owner_dependency_count: artifacts.contract_dependency_map?.summary?.owner_dependency_count ?? 0,
    contract_dependency_map_risk_count: artifacts.contract_dependency_map?.summary?.breaking_change_risk_count ?? 0,
    contract_dependency_map_high_risk_count: artifacts.contract_dependency_map?.summary?.high_risk_count ?? 0,
    contract_dependency_map_direction_violation_count: artifacts.contract_dependency_map?.summary?.direction_violation_count ?? 0,
    contract_dependency_map_validation_error_count: artifacts.contract_dependency_map?.summary?.validation_error_count ?? artifacts.contract_dependency_map?.validation?.errors?.length ?? 0,
    schema_versioning_guideline_status: artifacts.schema_versioning_rules?.summary?.guideline_status ?? "unknown",
    schema_versioning_schema_count: artifacts.schema_versioning_rules?.summary?.schema_count ?? 0,
    schema_versioning_versioned_schema_count: artifacts.schema_versioning_rules?.summary?.versioned_schema_count ?? 0,
    schema_versioning_legacy_exception_count: artifacts.schema_versioning_rules?.summary?.legacy_exception_count ?? 0,
    schema_versioning_non_compliant_schema_count: artifacts.schema_versioning_rules?.summary?.non_compliant_schema_count ?? 0,
    schema_versioning_optional_addition_compatible_count: artifacts.schema_versioning_rules?.summary?.optional_addition_compatible_count ?? 0,
    schema_versioning_closed_world_schema_count: artifacts.schema_versioning_rules?.summary?.closed_world_schema_count ?? 0,
    schema_versioning_deprecated_field_count: artifacts.schema_versioning_rules?.summary?.deprecated_field_count ?? 0,
    schema_versioning_migration_manifest_rule_count: artifacts.schema_versioning_rules?.summary?.migration_manifest_rule_count ?? 0,
    schema_versioning_deprecation_rule_count: artifacts.schema_versioning_rules?.summary?.deprecation_rule_count ?? 0,
    schema_versioning_optional_addition_rule_count: artifacts.schema_versioning_rules?.summary?.optional_addition_rule_count ?? 0,
    schema_versioning_failed_validation_item_count: artifacts.schema_versioning_rules?.summary?.failed_validation_item_count ?? 0,
    schema_versioning_validation_error_count: artifacts.schema_versioning_rules?.summary?.validation_error_count ?? artifacts.schema_versioning_rules?.validation?.errors?.length ?? 0,
    schema_migration_manifest_status: artifacts.schema_migration_manifest?.summary?.migration_manifest_status ?? "unknown",
    schema_migration_manifest_count: artifacts.schema_migration_manifest?.summary?.manifest_count ?? 0,
    schema_migration_core_count: artifacts.schema_migration_manifest?.summary?.core_migration_count ?? 0,
    schema_migration_pack_count: artifacts.schema_migration_manifest?.summary?.pack_migration_count ?? 0,
    schema_migration_index_count: artifacts.schema_migration_manifest?.summary?.index_migration_count ?? 0,
    schema_migration_record_count: artifacts.schema_migration_manifest?.summary?.migration_record_count ?? 0,
    schema_migration_declared_manifest_count: artifacts.schema_migration_manifest?.summary?.declared_manifest_count ?? 0,
    schema_migration_planned_record_count: artifacts.schema_migration_manifest?.summary?.planned_record_count ?? 0,
    schema_migration_not_run_dry_run_record_count: artifacts.schema_migration_manifest?.summary?.not_run_dry_run_record_count ?? 0,
    schema_migration_data_step_count: artifacts.schema_migration_manifest?.summary?.data_migration_step_count ?? 0,
    schema_migration_index_step_count: artifacts.schema_migration_manifest?.summary?.index_migration_step_count ?? 0,
    schema_migration_dry_run_command_count: artifacts.schema_migration_manifest?.summary?.dry_run_command_count ?? 0,
    schema_migration_rollback_note_count: artifacts.schema_migration_manifest?.summary?.rollback_note_count ?? 0,
    schema_migration_validation_command_count: artifacts.schema_migration_manifest?.summary?.validation_command_count ?? 0,
    schema_migration_legacy_exception_covered_count: artifacts.schema_migration_manifest?.summary?.legacy_exception_covered_count ?? 0,
    schema_migration_missing_legacy_exception_count: artifacts.schema_migration_manifest?.summary?.missing_legacy_exception_count ?? 0,
    schema_migration_failed_validation_item_count: artifacts.schema_migration_manifest?.summary?.failed_validation_item_count ?? 0,
    schema_migration_validation_error_count: artifacts.schema_migration_manifest?.summary?.validation_error_count ?? artifacts.schema_migration_manifest?.validation?.errors?.length ?? 0,
    contract_golden_fixture_status: artifacts.contract_golden_fixtures?.summary?.golden_fixture_status ?? "unknown",
    contract_golden_fixture_count: artifacts.contract_golden_fixtures?.summary?.fixture_count ?? 0,
    contract_golden_required_fixture_count: artifacts.contract_golden_fixtures?.summary?.required_fixture_count ?? 0,
    contract_golden_locked_fixture_count: artifacts.contract_golden_fixtures?.summary?.locked_fixture_count ?? 0,
    contract_golden_blocked_fixture_count: artifacts.contract_golden_fixtures?.summary?.blocked_fixture_count ?? 0,
    contract_golden_schema_valid_fixture_count: artifacts.contract_golden_fixtures?.summary?.schema_valid_fixture_count ?? 0,
    contract_golden_schema_invalid_fixture_count: artifacts.contract_golden_fixtures?.summary?.schema_invalid_fixture_count ?? 0,
    contract_golden_regression_hash_count: artifacts.contract_golden_fixtures?.summary?.regression_hash_count ?? 0,
    contract_golden_locked_regression_hash_count: artifacts.contract_golden_fixtures?.summary?.locked_regression_hash_count ?? 0,
    contract_golden_missing_artifact_count: artifacts.contract_golden_fixtures?.summary?.missing_artifact_count ?? 0,
    contract_golden_schema_version_present_count: artifacts.contract_golden_fixtures?.summary?.schema_version_present_count ?? 0,
    contract_golden_failed_validation_item_count: artifacts.contract_golden_fixtures?.summary?.failed_validation_item_count ?? 0,
    contract_golden_validation_error_count: artifacts.contract_golden_fixtures?.summary?.validation_error_count ?? artifacts.contract_golden_fixtures?.validation?.errors?.length ?? 0,
    contract_validation_suite_status: artifacts.contract_validation_suite?.summary?.validation_suite_status ?? "unknown",
    contract_validation_fixture_count: artifacts.contract_validation_suite?.summary?.fixture_count ?? 0,
    contract_validation_validated_fixture_count: artifacts.contract_validation_suite?.summary?.validated_fixture_count ?? 0,
    contract_validation_schema_valid_fixture_count: artifacts.contract_validation_suite?.summary?.schema_valid_fixture_count ?? 0,
    contract_validation_schema_invalid_fixture_count: artifacts.contract_validation_suite?.summary?.schema_invalid_fixture_count ?? 0,
    contract_validation_regression_passed_count: artifacts.contract_validation_suite?.summary?.regression_passed_count ?? 0,
    contract_validation_regression_failed_count: artifacts.contract_validation_suite?.summary?.regression_failed_count ?? 0,
    contract_validation_content_hash_match_count: artifacts.contract_validation_suite?.summary?.content_hash_match_count ?? 0,
    contract_validation_content_hash_mismatch_count: artifacts.contract_validation_suite?.summary?.content_hash_mismatch_count ?? 0,
    contract_validation_schema_hash_match_count: artifacts.contract_validation_suite?.summary?.schema_hash_match_count ?? 0,
    contract_validation_schema_hash_mismatch_count: artifacts.contract_validation_suite?.summary?.schema_hash_mismatch_count ?? 0,
    contract_validation_required_package_script_count: artifacts.contract_validation_suite?.summary?.required_package_script_count ?? 0,
    contract_validation_present_package_script_count: artifacts.contract_validation_suite?.summary?.present_package_script_count ?? 0,
    contract_validation_missing_package_script_count: artifacts.contract_validation_suite?.summary?.missing_package_script_count ?? 0,
    contract_validation_roadmap_declared_count: artifacts.contract_validation_suite?.summary?.roadmap_declared_count ?? 0,
    contract_validation_roadmap_missing_count: artifacts.contract_validation_suite?.summary?.roadmap_missing_count ?? 0,
    contract_validation_failed_validation_item_count: artifacts.contract_validation_suite?.summary?.failed_validation_item_count ?? 0,
    contract_validation_validation_error_count: artifacts.contract_validation_suite?.summary?.validation_error_count ?? artifacts.contract_validation_suite?.validation?.errors?.length ?? 0,
    health_check_count: artifacts.control_plane_health?.summary?.check_count ?? 0,
    health_passed_check_count: artifacts.control_plane_health?.summary?.passed_check_count ?? 0,
    health_attention_check_count: artifacts.control_plane_health?.summary?.attention_check_count ?? 0,
    health_blocked_check_count: artifacts.control_plane_health?.summary?.blocked_check_count ?? 0,
    health_missing_check_count: artifacts.control_plane_health?.summary?.missing_check_count ?? 0,
    action_plan_item_count: artifacts.control_plane_action_plan?.summary?.plan_item_count ?? 0,
    action_plan_blocked_item_count: artifacts.control_plane_action_plan?.summary?.blocked_item_count ?? 0,
    action_plan_waiting_for_human_count: artifacts.control_plane_action_plan?.summary?.waiting_for_human_count ?? 0,
    action_plan_ready_to_run_count: artifacts.control_plane_action_plan?.summary?.ready_to_run_count ?? 0,
    action_plan_protected_action_count: artifacts.control_plane_action_plan?.summary?.protected_action_count ?? 0,
    action_plan_human_required_count: artifacts.control_plane_action_plan?.summary?.human_required_count ?? 0,
    human_gate_item_count: artifacts.control_plane_human_gates?.summary?.gate_item_count ?? 0,
    human_gate_waiting_count: artifacts.control_plane_human_gates?.summary?.waiting_for_human_count ?? 0,
    human_gate_blocked_count: artifacts.control_plane_human_gates?.summary?.blocked_count ?? 0,
    human_gate_protected_action_count: artifacts.control_plane_human_gates?.summary?.protected_action_count ?? 0,
    human_gate_evidence_decision_count: artifacts.control_plane_human_gates?.summary?.evidence_decision_count ?? 0,
    human_gate_auto_execute_allowed_count: artifacts.control_plane_human_gates?.summary?.auto_execute_allowed_count ?? 0,
    human_gate_receipt_requirement_count: artifacts.control_plane_human_gate_receipts?.summary?.receipt_requirement_count ?? 0,
    human_gate_receipt_draft_count: artifacts.control_plane_human_gate_receipts?.summary?.receipt_draft_count ?? 0,
    human_gate_receipt_pending_count: artifacts.control_plane_human_gate_receipts?.summary?.pending_receipt_count ?? 0,
    human_gate_receipt_human_count: artifacts.control_plane_human_gate_receipts?.summary?.human_receipt_count ?? 0,
    human_gate_receipt_protected_count: artifacts.control_plane_human_gate_receipts?.summary?.protected_receipt_count ?? 0,
    human_gate_receipt_evidence_decision_count: artifacts.control_plane_human_gate_receipts?.summary?.evidence_decision_receipt_count ?? 0,
    human_gate_receipt_command_count: artifacts.control_plane_human_gate_receipts?.summary?.command_receipt_count ?? 0,
    human_review_packet_count: artifacts.human_review_packet_ledger?.summary?.review_packet_count ?? 0,
    human_review_item_count: artifacts.human_review_packet_ledger?.summary?.review_item_count ?? 0,
    human_review_pending_packet_count: artifacts.human_review_packet_ledger?.summary?.pending_packet_count ?? 0,
    human_review_blocked_packet_count: artifacts.human_review_packet_ledger?.summary?.blocked_packet_count ?? 0,
    human_review_protected_packet_count: artifacts.human_review_packet_ledger?.summary?.protected_packet_count ?? 0,
    human_review_command_packet_count: artifacts.human_review_packet_ledger?.summary?.command_packet_count ?? 0,
    human_review_validation_error_count: artifacts.human_review_packet_ledger?.summary?.validation_error_count ?? artifacts.human_review_packet_ledger?.validation?.errors?.length ?? 0,
    human_review_agenda_item_count: artifacts.human_review_agenda?.summary?.agenda_item_count ?? 0,
    human_review_agenda_actor_count: artifacts.human_review_agenda?.summary?.actor_count ?? 0,
    human_review_agenda_pending_count: artifacts.human_review_agenda?.summary?.pending_agenda_item_count ?? 0,
    human_review_agenda_blocked_count: artifacts.human_review_agenda?.summary?.blocked_agenda_item_count ?? 0,
    human_review_agenda_decision_row_count: artifacts.human_review_agenda?.summary?.decision_template_row_count ?? 0,
    human_review_agenda_protected_action_count: artifacts.human_review_agenda?.summary?.protected_action_count ?? 0,
    human_review_agenda_validation_error_count: artifacts.human_review_agenda?.summary?.validation_error_count ?? artifacts.human_review_agenda?.validation?.errors?.length ?? 0,
    human_review_agenda_intake_item_count: artifacts.human_review_agenda_receipt_intake?.summary?.intake_item_count ?? 0,
    human_review_agenda_intake_receipt_row_count: artifacts.human_review_agenda_receipt_intake?.summary?.receipt_row_count ?? 0,
    human_review_agenda_intake_pending_count: artifacts.human_review_agenda_receipt_intake?.summary?.pending_receipt_count ?? 0,
    human_review_agenda_intake_ready_count: artifacts.human_review_agenda_receipt_intake?.summary?.ready_for_validation_count ?? 0,
    human_review_agenda_intake_invalid_count: artifacts.human_review_agenda_receipt_intake?.summary?.invalid_template_row_count ?? 0,
    human_review_agenda_intake_validation_error_count: artifacts.human_review_agenda_receipt_intake?.summary?.validation_error_count ?? artifacts.human_review_agenda_receipt_intake?.validation?.errors?.length ?? 0,
    human_review_receipt_workspace_actor_count: artifacts.human_review_receipt_workspace?.summary?.actor_workspace_count ?? 0,
    human_review_receipt_workspace_entry_count: artifacts.human_review_receipt_workspace?.summary?.workspace_entry_count ?? 0,
    human_review_receipt_workspace_receipt_row_count: artifacts.human_review_receipt_workspace?.summary?.receipt_row_count ?? 0,
    human_review_receipt_workspace_pending_count: artifacts.human_review_receipt_workspace?.summary?.pending_receipt_count ?? 0,
    human_review_receipt_workspace_editable_file_count: artifacts.human_review_receipt_workspace?.summary?.editable_file_count ?? 0,
    human_review_receipt_workspace_validation_error_count: artifacts.human_review_receipt_workspace?.summary?.validation_error_count ?? artifacts.human_review_receipt_workspace?.validation?.errors?.length ?? 0,
    human_review_receipt_workspace_merge_actor_input_count: artifacts.human_review_receipt_workspace_merge?.summary?.actor_input_count ?? 0,
    human_review_receipt_workspace_merge_receipt_row_count: artifacts.human_review_receipt_workspace_merge?.summary?.receipt_row_count ?? 0,
    human_review_receipt_workspace_merge_pending_count: artifacts.human_review_receipt_workspace_merge?.summary?.pending_receipt_count ?? 0,
    human_review_receipt_workspace_merge_ready_count: artifacts.human_review_receipt_workspace_merge?.summary?.ready_for_validation_count ?? 0,
    human_review_receipt_workspace_merge_missing_count: artifacts.human_review_receipt_workspace_merge?.summary?.missing_receipt_count ?? 0,
    human_review_receipt_workspace_merge_validation_error_count: artifacts.human_review_receipt_workspace_merge?.summary?.validation_error_count ?? artifacts.human_review_receipt_workspace_merge?.validation?.errors?.length ?? 0,
    human_review_context_bundle_actor_count: artifacts.human_review_context_bundle?.summary?.actor_context_bundle_count ?? 0,
    human_review_context_bundle_card_count: artifacts.human_review_context_bundle?.summary?.context_card_count ?? 0,
    human_review_context_bundle_pending_count: artifacts.human_review_context_bundle?.summary?.pending_receipt_count ?? 0,
    human_review_context_bundle_ready_count: artifacts.human_review_context_bundle?.summary?.ready_context_count ?? 0,
    human_review_context_bundle_attention_count: artifacts.human_review_context_bundle?.summary?.attention_context_count ?? 0,
    human_review_context_bundle_evidence_count: artifacts.human_review_context_bundle?.summary?.evidence_context_count ?? 0,
    human_review_context_bundle_approval_count: artifacts.human_review_context_bundle?.summary?.approval_context_count ?? 0,
    human_review_context_bundle_matter_count: artifacts.human_review_context_bundle?.summary?.matter_context_count ?? 0,
    human_review_context_bundle_validation_error_count: artifacts.human_review_context_bundle?.summary?.validation_error_count ?? artifacts.human_review_context_bundle?.validation?.errors?.length ?? 0,
    human_review_decision_register_actor_count: artifacts.human_review_decision_register?.summary?.actor_decision_register_count ?? 0,
    human_review_decision_register_row_count: artifacts.human_review_decision_register?.summary?.decision_row_count ?? 0,
    human_review_decision_register_receipt_row_count: artifacts.human_review_decision_register?.summary?.receipt_row_count ?? 0,
    human_review_decision_register_pending_count: artifacts.human_review_decision_register?.summary?.pending_decision_count ?? 0,
    human_review_decision_register_ready_count: artifacts.human_review_decision_register?.summary?.ready_for_validation_count ?? 0,
    human_review_decision_register_invalid_count: (artifacts.human_review_decision_register?.summary?.invalid_context_count ?? 0) + (artifacts.human_review_decision_register?.summary?.invalid_decision_count ?? 0),
    human_review_decision_register_protected_count: artifacts.human_review_decision_register?.summary?.protected_action_count ?? 0,
    human_review_decision_register_evidence_count: artifacts.human_review_decision_register?.summary?.evidence_decision_count ?? 0,
    human_review_decision_register_validation_error_count: artifacts.human_review_decision_register?.summary?.validation_error_count ?? artifacts.human_review_decision_register?.validation?.errors?.length ?? 0,
    human_review_decision_register_merge_actor_input_count: artifacts.human_review_decision_register_merge?.summary?.actor_input_count ?? 0,
    human_review_decision_register_merge_receipt_row_count: artifacts.human_review_decision_register_merge?.summary?.receipt_row_count ?? 0,
    human_review_decision_register_merge_pending_count: artifacts.human_review_decision_register_merge?.summary?.pending_receipt_count ?? 0,
    human_review_decision_register_merge_ready_count: artifacts.human_review_decision_register_merge?.summary?.ready_for_validation_count ?? 0,
    human_review_decision_register_merge_missing_count: artifacts.human_review_decision_register_merge?.summary?.missing_receipt_count ?? 0,
    human_review_decision_register_merge_invalid_count: artifacts.human_review_decision_register_merge?.summary?.invalid_decision_receipt_count ?? 0,
    human_review_decision_register_merge_protected_count: artifacts.human_review_decision_register_merge?.summary?.protected_action_count ?? 0,
    human_review_decision_register_merge_evidence_count: artifacts.human_review_decision_register_merge?.summary?.evidence_decision_count ?? 0,
    human_review_decision_register_merge_validation_error_count: artifacts.human_review_decision_register_merge?.summary?.validation_error_count ?? artifacts.human_review_decision_register_merge?.validation?.errors?.length ?? 0,
    human_review_validation_feedback_actor_count: artifacts.human_review_validation_feedback?.summary?.actor_feedback_count ?? 0,
    human_review_validation_feedback_item_count: artifacts.human_review_validation_feedback?.summary?.feedback_item_count ?? 0,
    human_review_validation_feedback_pending_count: artifacts.human_review_validation_feedback?.summary?.pending_receipt_count ?? 0,
    human_review_validation_feedback_ready_count: artifacts.human_review_validation_feedback?.summary?.ready_for_application_count ?? 0,
    human_review_validation_feedback_correction_count: artifacts.human_review_validation_feedback?.summary?.needs_correction_count ?? 0,
    human_review_validation_feedback_missing_validation_count: artifacts.human_review_validation_feedback?.summary?.missing_validation_count ?? 0,
    human_review_validation_feedback_protected_count: artifacts.human_review_validation_feedback?.summary?.protected_action_count ?? 0,
    human_review_validation_feedback_evidence_count: artifacts.human_review_validation_feedback?.summary?.evidence_decision_count ?? 0,
    human_review_validation_feedback_validation_error_count: artifacts.human_review_validation_feedback?.summary?.validation_error_count ?? artifacts.human_review_validation_feedback?.validation?.errors?.length ?? 0,
    human_review_correction_workspace_actor_count: artifacts.human_review_correction_workspace?.summary?.actor_workspace_count ?? 0,
    human_review_correction_workspace_item_count: artifacts.human_review_correction_workspace?.summary?.correction_item_count ?? 0,
    human_review_correction_workspace_receipt_row_count: artifacts.human_review_correction_workspace?.summary?.receipt_row_count ?? 0,
    human_review_correction_workspace_pending_count: artifacts.human_review_correction_workspace?.summary?.pending_decision_count ?? 0,
    human_review_correction_workspace_correction_count: artifacts.human_review_correction_workspace?.summary?.needs_correction_count ?? 0,
    human_review_correction_workspace_editable_file_count: artifacts.human_review_correction_workspace?.summary?.editable_file_count ?? 0,
    human_review_correction_workspace_protected_count: artifacts.human_review_correction_workspace?.summary?.protected_action_count ?? 0,
    human_review_correction_workspace_evidence_count: artifacts.human_review_correction_workspace?.summary?.evidence_decision_count ?? 0,
    human_review_correction_workspace_validation_error_count: artifacts.human_review_correction_workspace?.summary?.validation_error_count ?? artifacts.human_review_correction_workspace?.validation?.errors?.length ?? 0,
    human_review_correction_workspace_merge_actor_input_count: artifacts.human_review_correction_workspace_merge?.summary?.actor_input_count ?? 0,
    human_review_correction_workspace_merge_receipt_row_count: artifacts.human_review_correction_workspace_merge?.summary?.receipt_row_count ?? 0,
    human_review_correction_workspace_merge_pending_count: artifacts.human_review_correction_workspace_merge?.summary?.pending_receipt_count ?? 0,
    human_review_correction_workspace_merge_ready_count: artifacts.human_review_correction_workspace_merge?.summary?.ready_for_validation_count ?? 0,
    human_review_correction_workspace_merge_missing_count: artifacts.human_review_correction_workspace_merge?.summary?.missing_receipt_count ?? 0,
    human_review_correction_workspace_merge_duplicate_count: artifacts.human_review_correction_workspace_merge?.summary?.duplicate_receipt_count ?? 0,
    human_review_correction_workspace_merge_unknown_count: artifacts.human_review_correction_workspace_merge?.summary?.unknown_receipt_count ?? 0,
    human_review_correction_workspace_merge_invalid_count: artifacts.human_review_correction_workspace_merge?.summary?.invalid_correction_receipt_count ?? 0,
    human_review_correction_workspace_merge_protected_count: artifacts.human_review_correction_workspace_merge?.summary?.protected_action_count ?? 0,
    human_review_correction_workspace_merge_evidence_count: artifacts.human_review_correction_workspace_merge?.summary?.evidence_decision_count ?? 0,
    human_review_correction_workspace_merge_validation_error_count: artifacts.human_review_correction_workspace_merge?.summary?.validation_error_count ?? artifacts.human_review_correction_workspace_merge?.validation?.errors?.length ?? 0,
    human_review_correction_validation_item_count: artifacts.human_review_correction_validation?.summary?.validation_item_count ?? 0,
    human_review_correction_validation_receipt_count: artifacts.human_review_correction_validation?.summary?.receipt_count ?? 0,
    human_review_correction_validation_ready_count: artifacts.human_review_correction_validation?.summary?.ready_to_apply_count ?? 0,
    human_review_correction_validation_pending_count: artifacts.human_review_correction_validation?.summary?.pending_receipt_count ?? 0,
    human_review_correction_validation_missing_count: artifacts.human_review_correction_validation?.summary?.missing_receipt_count ?? 0,
    human_review_correction_validation_invalid_count: artifacts.human_review_correction_validation?.summary?.invalid_receipt_count ?? 0,
    human_review_correction_validation_unknown_count: artifacts.human_review_correction_validation?.summary?.unknown_receipt_count ?? 0,
    human_review_correction_validation_error_count: artifacts.human_review_correction_validation?.summary?.error_count ?? 0,
    human_review_correction_validation_evidence_ready_count: artifacts.human_review_correction_validation?.summary?.evidence_decision_ready_count ?? 0,
    human_review_correction_feedback_actor_count: artifacts.human_review_correction_feedback?.summary?.actor_feedback_count ?? 0,
    human_review_correction_feedback_item_count: artifacts.human_review_correction_feedback?.summary?.feedback_item_count ?? 0,
    human_review_correction_feedback_pending_count: artifacts.human_review_correction_feedback?.summary?.pending_receipt_count ?? 0,
    human_review_correction_feedback_ready_count: artifacts.human_review_correction_feedback?.summary?.ready_for_application_count ?? 0,
    human_review_correction_feedback_correction_count: artifacts.human_review_correction_feedback?.summary?.needs_correction_count ?? 0,
    human_review_correction_feedback_missing_validation_count: artifacts.human_review_correction_feedback?.summary?.missing_validation_count ?? 0,
    human_review_correction_feedback_protected_count: artifacts.human_review_correction_feedback?.summary?.protected_action_count ?? 0,
    human_review_correction_feedback_evidence_count: artifacts.human_review_correction_feedback?.summary?.evidence_decision_count ?? 0,
    human_review_correction_feedback_validation_error_count: artifacts.human_review_correction_feedback?.summary?.validation_error_count ?? artifacts.human_review_correction_feedback?.validation?.errors?.length ?? 0,
    human_review_cycle_actor_count: artifacts.human_review_cycle_ledger?.summary?.actor_cycle_count ?? 0,
    human_review_cycle_item_count: artifacts.human_review_cycle_ledger?.summary?.cycle_item_count ?? 0,
    human_review_cycle_pending_count: artifacts.human_review_cycle_ledger?.summary?.pending_human_review_count ?? 0,
    human_review_cycle_ready_count: artifacts.human_review_cycle_ledger?.summary?.ready_for_application_count ?? 0,
    human_review_cycle_attention_count: artifacts.human_review_cycle_ledger?.summary?.attention_count ?? 0,
    human_review_cycle_clear_count: artifacts.human_review_cycle_ledger?.summary?.clear_count ?? 0,
    human_review_cycle_unavailable_source_count: artifacts.human_review_cycle_ledger?.summary?.unavailable_source_count ?? 0,
    human_review_cycle_protected_count: artifacts.human_review_cycle_ledger?.summary?.protected_action_count ?? 0,
    human_review_cycle_evidence_count: artifacts.human_review_cycle_ledger?.summary?.evidence_decision_count ?? 0,
    human_review_cycle_validation_error_count: artifacts.human_review_cycle_ledger?.summary?.validation_error_count ?? artifacts.human_review_cycle_ledger?.validation?.errors?.length ?? 0,
    human_review_cycle_work_order_actor_count: artifacts.human_review_cycle_work_orders?.summary?.actor_work_order_count ?? 0,
    human_review_cycle_work_order_item_count: artifacts.human_review_cycle_work_orders?.summary?.work_order_item_count ?? 0,
    human_review_cycle_work_order_pending_count: artifacts.human_review_cycle_work_orders?.summary?.pending_human_review_count ?? 0,
    human_review_cycle_work_order_ready_count: artifacts.human_review_cycle_work_orders?.summary?.ready_for_application_count ?? 0,
    human_review_cycle_work_order_attention_count: artifacts.human_review_cycle_work_orders?.summary?.attention_count ?? 0,
    human_review_cycle_work_order_clear_count: artifacts.human_review_cycle_work_orders?.summary?.clear_count ?? 0,
    human_review_cycle_work_order_unavailable_source_count: artifacts.human_review_cycle_work_orders?.summary?.unavailable_source_count ?? 0,
    human_review_cycle_work_order_protected_count: artifacts.human_review_cycle_work_orders?.summary?.protected_action_count ?? 0,
    human_review_cycle_work_order_evidence_count: artifacts.human_review_cycle_work_orders?.summary?.evidence_decision_count ?? 0,
    human_review_cycle_work_order_missing_target_path_count: artifacts.human_review_cycle_work_orders?.summary?.missing_target_path_count ?? 0,
    human_review_cycle_work_order_validation_error_count: artifacts.human_review_cycle_work_orders?.summary?.validation_error_count ?? artifacts.human_review_cycle_work_orders?.validation?.errors?.length ?? 0,
    human_review_cycle_target_audit_actor_count: artifacts.human_review_cycle_target_audit?.summary?.actor_target_audit_count ?? 0,
    human_review_cycle_target_audit_item_count: artifacts.human_review_cycle_target_audit?.summary?.target_audit_item_count ?? 0,
    human_review_cycle_target_audit_ready_count: artifacts.human_review_cycle_target_audit?.summary?.ready_target_count ?? 0,
    human_review_cycle_target_audit_attention_count: artifacts.human_review_cycle_target_audit?.summary?.attention_count ?? 0,
    human_review_cycle_target_audit_blocked_count: artifacts.human_review_cycle_target_audit?.summary?.blocked_count ?? 0,
    human_review_cycle_target_audit_file_count: artifacts.human_review_cycle_target_audit?.summary?.target_file_count ?? 0,
    human_review_cycle_target_audit_missing_file_count: artifacts.human_review_cycle_target_audit?.summary?.missing_target_file_count ?? 0,
    human_review_cycle_target_audit_missing_row_count: artifacts.human_review_cycle_target_audit?.summary?.missing_receipt_row_count ?? 0,
    human_review_cycle_target_audit_missing_required_field_count: artifacts.human_review_cycle_target_audit?.summary?.missing_required_field_count ?? 0,
    human_review_cycle_target_audit_mismatch_count: artifacts.human_review_cycle_target_audit?.summary?.mismatch_count ?? 0,
    human_review_cycle_target_audit_validation_error_count: artifacts.human_review_cycle_target_audit?.summary?.validation_error_count ?? artifacts.human_review_cycle_target_audit?.validation?.errors?.length ?? 0,
    human_review_cycle_triage_actor_count: artifacts.human_review_cycle_triage_inbox?.summary?.actor_triage_inbox_count ?? 0,
    human_review_cycle_triage_item_count: artifacts.human_review_cycle_triage_inbox?.summary?.triage_item_count ?? 0,
    human_review_cycle_triage_ready_count: artifacts.human_review_cycle_triage_inbox?.summary?.ready_for_human_review_count ?? 0,
    human_review_cycle_triage_ready_application_count: artifacts.human_review_cycle_triage_inbox?.summary?.ready_for_application_count ?? 0,
    human_review_cycle_triage_ready_for_application_count: artifacts.human_review_cycle_triage_inbox?.summary?.ready_for_application_count ?? 0,
    human_review_cycle_triage_attention_count: artifacts.human_review_cycle_triage_inbox?.summary?.attention_count ?? 0,
    human_review_cycle_triage_blocked_count: artifacts.human_review_cycle_triage_inbox?.summary?.blocked_count ?? 0,
    human_review_cycle_triage_protected_count: artifacts.human_review_cycle_triage_inbox?.summary?.protected_action_count ?? 0,
    human_review_cycle_triage_evidence_count: artifacts.human_review_cycle_triage_inbox?.summary?.evidence_decision_count ?? 0,
    human_review_cycle_triage_target_file_count: artifacts.human_review_cycle_triage_inbox?.summary?.target_file_count ?? 0,
    human_review_cycle_triage_missing_target_audit_count: artifacts.human_review_cycle_triage_inbox?.summary?.missing_target_audit_count ?? 0,
    human_review_cycle_triage_validation_error_count: artifacts.human_review_cycle_triage_inbox?.summary?.validation_error_count ?? artifacts.human_review_cycle_triage_inbox?.validation?.errors?.length ?? 0,
    human_review_cycle_console_actor_count: artifacts.human_review_cycle_reviewer_console?.summary?.actor_console_count ?? 0,
    human_review_cycle_console_item_count: artifacts.human_review_cycle_reviewer_console?.summary?.console_item_count ?? 0,
    human_review_cycle_console_ready_count: artifacts.human_review_cycle_reviewer_console?.summary?.ready_for_human_review_count ?? 0,
    human_review_cycle_console_ready_application_count: artifacts.human_review_cycle_reviewer_console?.summary?.ready_for_application_count ?? 0,
    human_review_cycle_console_attention_count: artifacts.human_review_cycle_reviewer_console?.summary?.attention_count ?? 0,
    human_review_cycle_console_blocked_count: artifacts.human_review_cycle_reviewer_console?.summary?.blocked_count ?? 0,
    human_review_cycle_console_protected_count: artifacts.human_review_cycle_reviewer_console?.summary?.protected_action_count ?? 0,
    human_review_cycle_console_evidence_count: artifacts.human_review_cycle_reviewer_console?.summary?.evidence_decision_count ?? 0,
    human_review_cycle_console_missing_context_count: artifacts.human_review_cycle_reviewer_console?.summary?.missing_context_card_count ?? 0,
    human_review_cycle_console_missing_decision_count: artifacts.human_review_cycle_reviewer_console?.summary?.missing_decision_row_count ?? 0,
    human_review_cycle_console_validation_error_count: artifacts.human_review_cycle_reviewer_console?.summary?.validation_error_count ?? artifacts.human_review_cycle_reviewer_console?.validation?.errors?.length ?? 0,
    human_review_cycle_field_audit_actor_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.actor_field_audit_count ?? 0,
    human_review_cycle_field_audit_item_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.field_audit_item_count ?? 0,
    human_review_cycle_field_audit_pending_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.pending_human_review_count ?? 0,
    human_review_cycle_field_audit_ready_validation_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_field_audit_attention_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.attention_count ?? 0,
    human_review_cycle_field_audit_blocked_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.blocked_count ?? 0,
    human_review_cycle_field_audit_missing_field_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.missing_required_field_count ?? 0,
    human_review_cycle_field_audit_missing_row_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.missing_receipt_row_count ?? 0,
    human_review_cycle_field_audit_validation_error_count: artifacts.human_review_cycle_receipt_field_audit?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_field_audit?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_pack_actor_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.actor_completion_pack_count ?? 0,
    human_review_cycle_completion_pack_item_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.completion_item_count ?? 0,
    human_review_cycle_completion_pack_ready_input_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.ready_for_human_input_count ?? 0,
    human_review_cycle_completion_pack_ready_validation_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_completion_pack_attention_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.attention_count ?? 0,
    human_review_cycle_completion_pack_blocked_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.blocked_count ?? 0,
    human_review_cycle_completion_pack_template_field_prompt_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.template_field_prompt_count ?? 0,
    human_review_cycle_completion_pack_validation_error_count: artifacts.human_review_cycle_receipt_completion_pack?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_pack?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_verification_actor_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.actor_verification_count ?? 0,
    human_review_cycle_completion_verification_item_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.verification_item_count ?? 0,
    human_review_cycle_completion_verification_pending_input_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.pending_human_input_count ?? 0,
    human_review_cycle_completion_verification_ready_validation_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_completion_verification_attention_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.attention_count ?? 0,
    human_review_cycle_completion_verification_blocked_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.blocked_count ?? 0,
    human_review_cycle_completion_verification_pending_prompt_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.pending_prompt_count ?? 0,
    human_review_cycle_completion_verification_completed_prompt_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.completed_prompt_count ?? 0,
    human_review_cycle_completion_verification_invalid_prompt_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.invalid_prompt_count ?? 0,
    human_review_cycle_completion_verification_validation_error_count: artifacts.human_review_cycle_receipt_completion_verification?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_verification?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_workbench_actor_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.actor_workbench_count ?? 0,
    human_review_cycle_completion_workbench_item_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.workbench_item_count ?? 0,
    human_review_cycle_completion_workbench_pending_input_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.pending_human_input_count ?? 0,
    human_review_cycle_completion_workbench_ready_validation_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_completion_workbench_attention_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.attention_count ?? 0,
    human_review_cycle_completion_workbench_blocked_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.blocked_count ?? 0,
    human_review_cycle_completion_workbench_pending_prompt_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.pending_prompt_count ?? 0,
    human_review_cycle_completion_workbench_template_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.receipt_completion_template_count ?? 0,
    human_review_cycle_completion_workbench_validation_error_count: artifacts.human_review_cycle_receipt_completion_workbench?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_workbench?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_runbook_actor_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.actor_runbook_count ?? 0,
    human_review_cycle_completion_runbook_step_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.runbook_step_count ?? 0,
    human_review_cycle_completion_runbook_workbench_item_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.workbench_item_count ?? 0,
    human_review_cycle_completion_runbook_pending_input_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.pending_human_input_count ?? 0,
    human_review_cycle_completion_runbook_ready_validation_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_completion_runbook_attention_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.attention_count ?? 0,
    human_review_cycle_completion_runbook_blocked_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.blocked_count ?? 0,
    human_review_cycle_completion_runbook_pending_prompt_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.pending_prompt_count ?? 0,
    human_review_cycle_completion_runbook_command_step_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.command_step_count ?? 0,
    human_review_cycle_completion_runbook_manual_step_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.manual_step_count ?? 0,
    human_review_cycle_completion_runbook_protected_step_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.protected_step_count ?? 0,
    human_review_cycle_completion_runbook_validation_error_count: artifacts.human_review_cycle_receipt_completion_runbook?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_runbook?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_readiness_actor_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.actor_readiness_count ?? 0,
    human_review_cycle_completion_readiness_command_gate_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.command_gate_count ?? 0,
    human_review_cycle_completion_readiness_manual_requirement_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.manual_requirement_count ?? 0,
    human_review_cycle_completion_readiness_allowed_command_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.allowed_command_count ?? 0,
    human_review_cycle_completion_readiness_blocked_command_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.blocked_command_count ?? 0,
    human_review_cycle_completion_readiness_blocked_until_manual_input_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.blocked_until_manual_input_count ?? 0,
    human_review_cycle_completion_readiness_protected_command_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.protected_command_count ?? 0,
    human_review_cycle_completion_readiness_manual_input_required_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.manual_input_required_count ?? 0,
    human_review_cycle_completion_readiness_pending_input_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.pending_human_input_count ?? 0,
    human_review_cycle_completion_readiness_pending_prompt_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.pending_prompt_count ?? 0,
    human_review_cycle_completion_readiness_validation_error_count: artifacts.human_review_cycle_receipt_completion_readiness?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_readiness?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_queue_ready_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.command_queue_item_count ?? 0,
    human_review_cycle_completion_command_queue_held_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.held_command_item_count ?? 0,
    human_review_cycle_completion_command_queue_actor_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.actor_command_queue_count ?? 0,
    human_review_cycle_completion_command_queue_protected_held_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.protected_held_command_count ?? 0,
    human_review_cycle_completion_command_queue_manual_hold_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.manual_input_hold_count ?? 0,
    human_review_cycle_completion_command_queue_pending_input_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.pending_human_input_count ?? 0,
    human_review_cycle_completion_command_queue_pending_prompt_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.pending_prompt_count ?? 0,
    human_review_cycle_completion_command_queue_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_queue?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_queue?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_receipts_requirement_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.receipt_requirement_count ?? 0,
    human_review_cycle_completion_command_receipts_draft_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.receipt_draft_count ?? 0,
    human_review_cycle_completion_command_receipts_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipts_command_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.command_receipt_count ?? 0,
    human_review_cycle_completion_command_receipts_held_reference_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.held_command_reference_count ?? 0,
    human_review_cycle_completion_command_receipts_protected_held_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.protected_held_command_count ?? 0,
    human_review_cycle_completion_command_receipts_required_field_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.required_field_count ?? 0,
    human_review_cycle_completion_command_receipts_source_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.source_ready_command_count ?? 0,
    human_review_cycle_completion_command_receipts_source_held_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.source_held_command_count ?? 0,
    human_review_cycle_completion_command_receipts_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipts?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipts?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_validation_item_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.validation_item_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_receipt_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.ready_to_confirm_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_missing_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.missing_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_invalid_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.invalid_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_unknown_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.unknown_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.summary?.error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_validation?.receipt_errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_feedback_actor_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.actor_feedback_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_item_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.feedback_item_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.ready_for_confirmation_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_correction_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.needs_correction_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_invalid_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.invalid_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_missing_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.missing_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_unknown_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.unknown_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_feedback_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_feedback?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_workspace_actor_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.actor_workspace_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_item_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.workspace_item_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_receipt_row_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.receipt_row_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_correction_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.needs_correction_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.ready_for_confirmation_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_editable_file_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.editable_file_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_workspace?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_actor_input_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.actor_input_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_available_actor_input_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.available_actor_input_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_item_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.merge_item_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_receipt_row_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.receipt_row_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_ready_validation_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.ready_for_validation_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_missing_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.missing_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_duplicate_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.duplicate_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_merge_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_merge?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_item_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.validation_item_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_receipt_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.ready_to_confirm_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_invalid_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.invalid_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_missing_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.missing_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_workspace_validation_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.summary?.error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_workspace_validation?.receipt_errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_application_ready_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.ready_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_application_pending_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.pending_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_application_invalid_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.invalid_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_application_applied_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.applied_receipt_count ?? 0,
    human_review_cycle_completion_command_receipt_application_patched_queue_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.patched_command_queue_item_count ?? 0,
    human_review_cycle_completion_command_receipt_application_audit_event_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.audit_event_count ?? 0,
    human_review_cycle_completion_command_receipt_application_error_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.receipt_error_count ?? artifacts.human_review_cycle_receipt_completion_command_receipt_application?.receipt_errors?.length ?? 0,
    human_review_cycle_completion_command_receipt_application_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_command_receipt_application_protected_executed_count: artifacts.human_review_cycle_receipt_completion_command_receipt_application?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_reconciliation_item_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.reconciliation_item_count ?? 0,
    human_review_cycle_completion_reconciliation_actor_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.actor_status_count ?? 0,
    human_review_cycle_completion_reconciliation_pending_command_receipt_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.pending_command_receipt_count ?? 0,
    human_review_cycle_completion_reconciliation_applied_command_receipt_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.applied_command_receipt_count ?? 0,
    human_review_cycle_completion_reconciliation_held_command_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.held_command_count ?? 0,
    human_review_cycle_completion_reconciliation_protected_held_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.protected_held_command_count ?? 0,
    human_review_cycle_completion_reconciliation_blocked_follow_on_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.blocked_follow_on_count ?? 0,
    human_review_cycle_completion_reconciliation_error_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_reconciliation?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_reconciliation_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_reconciliation_protected_executed_count: artifacts.human_review_cycle_receipt_completion_reconciliation?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_baseline_blocker_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.blocker_count ?? 0,
    human_review_cycle_completion_baseline_pending_command_receipt_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.pending_command_receipt_count ?? 0,
    human_review_cycle_completion_baseline_held_command_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.held_command_count ?? 0,
    human_review_cycle_completion_baseline_protected_hold_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.protected_hold_count ?? 0,
    human_review_cycle_completion_baseline_mismatched_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.mismatched_count_check_count ?? 0,
    human_review_cycle_completion_baseline_error_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_baseline?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_baseline_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_baseline_protected_executed_count: artifacts.human_review_cycle_receipt_completion_baseline?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_actor_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.actor_receipt_pack_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_item_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.receipt_pack_item_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_pending_blocker_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.pending_command_receipt_blocker_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_non_receipt_blocker_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.non_receipt_blocker_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_target_path_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.target_receipt_path_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_missing_target_path_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.missing_target_receipt_path_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_required_field_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.required_field_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_missing_required_field_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.missing_required_field_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_error_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_manual_command_receipt_pack_protected_executed_count: artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_held_command_resolution_plan_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.resolution_plan_count ?? 0,
    human_review_cycle_completion_held_command_resolution_actor_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.actor_resolution_plan_count ?? 0,
    human_review_cycle_completion_held_command_resolution_manual_input_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.manual_input_resolution_count ?? 0,
    human_review_cycle_completion_held_command_resolution_protected_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.protected_resolution_count ?? 0,
    human_review_cycle_completion_held_command_resolution_unblock_condition_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.unblock_condition_count ?? 0,
    human_review_cycle_completion_held_command_resolution_follow_on_action_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.follow_on_action_count ?? 0,
    human_review_cycle_completion_held_command_resolution_missing_actor_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.missing_required_actor_count ?? 0,
    human_review_cycle_completion_held_command_resolution_missing_unblock_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.missing_unblock_condition_count ?? 0,
    human_review_cycle_completion_held_command_resolution_missing_follow_on_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.missing_follow_on_action_count ?? 0,
    human_review_cycle_completion_held_command_resolution_error_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_held_command_resolution?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_held_command_resolution_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_held_command_resolution_protected_executed_count: artifacts.human_review_cycle_receipt_completion_held_command_resolution?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_protected_approval_request_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.approval_request_count ?? 0,
    human_review_cycle_completion_protected_approval_actor_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.actor_approval_pack_count ?? 0,
    human_review_cycle_completion_protected_approval_pending_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.pending_explicit_approval_count ?? 0,
    human_review_cycle_completion_protected_approval_source_protected_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.source_protected_resolution_count ?? 0,
    human_review_cycle_completion_protected_approval_request_protected_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.protected_action_request_count ?? 0,
    human_review_cycle_completion_protected_approval_mixed_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.command_receipt_mixed_count ?? 0,
    human_review_cycle_completion_protected_approval_non_protected_request_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.non_protected_request_count ?? 0,
    human_review_cycle_completion_protected_approval_target_path_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.target_approval_input_path_count ?? 0,
    human_review_cycle_completion_protected_approval_missing_target_path_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.missing_target_approval_input_path_count ?? 0,
    human_review_cycle_completion_protected_approval_required_field_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.required_approval_field_count ?? 0,
    human_review_cycle_completion_protected_approval_missing_required_field_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.missing_required_approval_field_count ?? 0,
    human_review_cycle_completion_protected_approval_error_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_protected_approval_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_protected_approval_protected_executed_count: artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_manual_revalidation_item_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.revalidation_item_count ?? 0,
    human_review_cycle_completion_manual_revalidation_source_pack_item_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.source_pack_item_count ?? 0,
    human_review_cycle_completion_manual_revalidation_actor_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.actor_revalidation_count ?? 0,
    human_review_cycle_completion_manual_revalidation_pending_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.pending_human_receipt_count ?? 0,
    human_review_cycle_completion_manual_revalidation_ready_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.human_entered_ready_receipt_count ?? 0,
    human_review_cycle_completion_manual_revalidation_applied_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.human_entered_applied_receipt_count ?? 0,
    human_review_cycle_completion_manual_revalidation_candidate_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.ready_or_applied_candidate_count ?? 0,
    human_review_cycle_completion_manual_revalidation_non_human_candidate_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.non_human_ready_or_applied_candidate_count ?? 0,
    human_review_cycle_completion_manual_revalidation_protected_overlap_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.protected_approval_overlap_count ?? 0,
    human_review_cycle_completion_manual_revalidation_auto_executed_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.auto_executed_receipt_count ?? 0,
    human_review_cycle_completion_manual_revalidation_error_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_manual_revalidation?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_manual_revalidation_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_manual_revalidation_protected_executed_count: artifacts.human_review_cycle_receipt_completion_manual_revalidation?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_item_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.projection_item_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_source_revalidation_item_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.source_revalidation_item_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_target_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.patch_target_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_ready_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.ready_patch_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_waiting_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.waiting_patch_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_blocked_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.blocked_patch_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_operation_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.patch_operation_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_audit_candidate_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.audit_event_candidate_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_emittable_audit_candidate_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.emittable_audit_event_candidate_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_missing_target_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.missing_queue_item_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_non_human_candidate_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.non_human_patch_candidate_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_protected_overlap_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.protected_overlap_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_auto_executed_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.auto_executed_receipt_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_error_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_applied_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.patch_applied_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_emitted_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.audit_event_emitted_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_command_executed_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.command_executed_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_command_queue_patch_projection_protected_executed_count: artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection?.summary?.protected_action_executed_count ?? 0,
    human_review_cycle_completion_closeout_item_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.closeout_item_count ?? 0,
    human_review_cycle_completion_closeout_source_baseline_blocker_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.source_baseline_blocker_count ?? 0,
    human_review_cycle_completion_closeout_actor_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.actor_closeout_count ?? 0,
    human_review_cycle_completion_closeout_pending_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.pending_count ?? 0,
    human_review_cycle_completion_closeout_approved_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.approved_count ?? 0,
    human_review_cycle_completion_closeout_rejected_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.rejected_count ?? 0,
    human_review_cycle_completion_closeout_superseded_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.superseded_count ?? 0,
    human_review_cycle_completion_closeout_normalized_total_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.normalized_status_total_count ?? 0,
    human_review_cycle_completion_closeout_unknown_status_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.unknown_status_count ?? 0,
    human_review_cycle_completion_closeout_pending_command_receipt_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.pending_command_receipt_count ?? 0,
    human_review_cycle_completion_closeout_pending_held_command_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.pending_held_command_count ?? 0,
    human_review_cycle_completion_closeout_pending_protected_approval_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.pending_protected_approval_count ?? 0,
    human_review_cycle_completion_closeout_error_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.validation_error_count ?? artifacts.human_review_cycle_receipt_completion_closeout_ledger?.validation?.errors?.length ?? 0,
    human_review_cycle_completion_closeout_patch_applied_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.patch_applied_count ?? 0,
    human_review_cycle_completion_closeout_emitted_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.audit_event_emitted_count ?? 0,
    human_review_cycle_completion_closeout_command_executed_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.command_executed_count ?? 0,
    human_review_cycle_completion_closeout_refresh_executed_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.refresh_command_executed_by_harness_count ?? 0,
    human_review_cycle_completion_closeout_protected_executed_count: artifacts.human_review_cycle_receipt_completion_closeout_ledger?.summary?.protected_action_executed_count ?? 0,
    human_review_v1_freeze_required_source_count: artifacts.human_review_v1_regression_freeze?.summary?.required_source_count ?? 0,
    human_review_v1_freeze_available_required_source_count: artifacts.human_review_v1_regression_freeze?.summary?.available_required_source_count ?? 0,
    human_review_v1_freeze_artifact_count: artifacts.human_review_v1_regression_freeze?.summary?.regression_fixture_artifact_count ?? 0,
    human_review_v1_freeze_content_hash_count: artifacts.human_review_v1_regression_freeze?.summary?.regression_fixture_hash_count ?? 0,
    human_review_v1_freeze_verification_checkpoint_count: artifacts.human_review_v1_regression_freeze?.summary?.verification_checkpoint_count ?? 0,
    human_review_v1_freeze_failed_checkpoint_count: artifacts.human_review_v1_regression_freeze?.summary?.failed_verification_checkpoint_count ?? 0,
    human_review_v1_freeze_loop_step_count: artifacts.human_review_v1_regression_freeze?.summary?.loop_step_count ?? 0,
    human_review_v1_freeze_loop_failed_count: artifacts.human_review_v1_regression_freeze?.summary?.loop_failed_step_count ?? 0,
    human_review_v1_freeze_loop_missing_artifact_count: artifacts.human_review_v1_regression_freeze?.summary?.loop_missing_artifact_count ?? 0,
    human_review_v1_freeze_closeout_item_count: artifacts.human_review_v1_regression_freeze?.summary?.closeout_item_count ?? 0,
    human_review_v1_freeze_pending_count: artifacts.human_review_v1_regression_freeze?.summary?.closeout_pending_count ?? 0,
    human_review_v1_freeze_unknown_status_count: artifacts.human_review_v1_regression_freeze?.summary?.closeout_unknown_status_count ?? 0,
    human_review_v1_freeze_error_count: artifacts.human_review_v1_regression_freeze?.summary?.validation_error_count ?? artifacts.human_review_v1_regression_freeze?.validation?.errors?.length ?? 0,
    human_review_v1_freeze_command_executed_count: artifacts.human_review_v1_regression_freeze?.summary?.command_executed_count ?? 0,
    human_review_v1_freeze_patch_applied_count: artifacts.human_review_v1_regression_freeze?.summary?.patch_applied_count ?? 0,
    human_review_v1_freeze_emitted_count: artifacts.human_review_v1_regression_freeze?.summary?.audit_event_emitted_count ?? 0,
    human_review_v1_freeze_protected_executed_count: artifacts.human_review_v1_regression_freeze?.summary?.protected_action_executed_count ?? 0,
    human_gate_receipt_validation_ready_count: artifacts.control_plane_human_gate_receipt_validation?.summary?.ready_to_apply_count ?? 0,
    human_gate_receipt_validation_pending_count: artifacts.control_plane_human_gate_receipt_validation?.summary?.pending_receipt_count ?? 0,
    human_gate_receipt_validation_invalid_count: artifacts.control_plane_human_gate_receipt_validation?.summary?.invalid_receipt_count ?? 0,
    human_gate_receipt_validation_error_count: artifacts.control_plane_human_gate_receipt_validation?.summary?.error_count ?? 0,
    human_gate_receipt_validation_evidence_decision_ready_count: artifacts.control_plane_human_gate_receipt_validation?.summary?.evidence_decision_ready_count ?? 0,
    human_gate_receipt_application_ready_count: artifacts.control_plane_human_gate_receipt_application?.summary?.ready_receipt_count ?? 0,
    human_gate_receipt_application_applied_count: artifacts.control_plane_human_gate_receipt_application?.summary?.applied_receipt_count ?? 0,
    human_gate_receipt_application_patched_gate_count: artifacts.control_plane_human_gate_receipt_application?.summary?.patched_gate_item_count ?? 0,
    human_gate_receipt_application_error_count: artifacts.control_plane_human_gate_receipt_application?.summary?.receipt_error_count ?? 0,
    human_gate_receipt_application_protected_count: artifacts.control_plane_human_gate_receipt_application?.summary?.protected_applied_count ?? 0,
    human_gate_receipt_application_evidence_decision_count: artifacts.control_plane_human_gate_receipt_application?.summary?.evidence_decision_applied_count ?? 0,
    work_packet_count: artifacts.control_plane_work_packets?.summary?.work_packet_count ?? 0,
    work_item_count: artifacts.control_plane_work_packets?.summary?.work_item_count ?? 0,
    work_packet_blocked_count: artifacts.control_plane_work_packets?.summary?.blocked_packet_count ?? 0,
    work_packet_human_count: artifacts.control_plane_work_packets?.summary?.human_packet_count ?? 0,
    work_packet_protected_count: artifacts.control_plane_work_packets?.summary?.protected_packet_count ?? 0,
    work_packet_command_count: artifacts.control_plane_work_packets?.summary?.command_packet_count ?? 0,
    work_packet_next_command_count: artifacts.control_plane_work_packets?.summary?.next_command_count ?? 0,
    work_packet_receipt_requirement_count: artifacts.control_plane_work_packet_receipts?.summary?.receipt_requirement_count ?? 0,
    work_packet_receipt_draft_count: artifacts.control_plane_work_packet_receipts?.summary?.receipt_draft_count ?? 0,
    work_packet_receipt_pending_count: artifacts.control_plane_work_packet_receipts?.summary?.pending_receipt_count ?? 0,
    work_packet_receipt_human_count: artifacts.control_plane_work_packet_receipts?.summary?.human_receipt_count ?? 0,
    work_packet_receipt_protected_count: artifacts.control_plane_work_packet_receipts?.summary?.protected_receipt_count ?? 0,
    work_packet_receipt_command_count: artifacts.control_plane_work_packet_receipts?.summary?.command_receipt_count ?? 0,
    work_packet_receipt_validation_ready_count: artifacts.control_plane_work_packet_receipt_validation?.summary?.ready_to_apply_count ?? 0,
    work_packet_receipt_validation_pending_count: artifacts.control_plane_work_packet_receipt_validation?.summary?.pending_receipt_count ?? 0,
    work_packet_receipt_validation_invalid_count: artifacts.control_plane_work_packet_receipt_validation?.summary?.invalid_receipt_count ?? 0,
    work_packet_receipt_validation_error_count: artifacts.control_plane_work_packet_receipt_validation?.summary?.error_count ?? 0,
    work_packet_receipt_application_ready_count: artifacts.control_plane_work_packet_receipt_application?.summary?.ready_receipt_count ?? 0,
    work_packet_receipt_application_applied_count: artifacts.control_plane_work_packet_receipt_application?.summary?.applied_receipt_count ?? 0,
    work_packet_receipt_application_patched_packet_count: artifacts.control_plane_work_packet_receipt_application?.summary?.patched_work_packet_count ?? 0,
    work_packet_receipt_application_error_count: artifacts.control_plane_work_packet_receipt_application?.summary?.receipt_error_count ?? 0,
    matter_count: artifacts.matter_cockpit?.summary?.matter_count ?? 0,
    blocked_matter_count: artifacts.matter_cockpit?.summary?.blocked_matter_count ?? 0,
    pending_review_matter_count: artifacts.matter_cockpit?.summary?.pending_review_matter_count ?? 0,
    ready_matter_count: artifacts.matter_cockpit?.summary?.ready_matter_count ?? 0,
    law_firm_issue_count: artifacts.law_firm_ldd_slice?.issue_count ?? 0,
    law_firm_rfi_count: artifacts.law_firm_ldd_slice?.rfi_count ?? 0,
    law_firm_citation_count: artifacts.law_firm_ldd_slice?.citation_count ?? 0,
    creative_slide_count: artifacts.creative_document_slice?.slide_count ?? 0,
    creative_artifact_count: artifacts.creative_document_slice?.artifact_count ?? 0,
    audit_event_count: artifacts.control_plane_audit_trail?.summary?.audit_event_count
      ?? (artifacts.approval_decisions?.audit_events?.length ?? 0)
        + (artifacts.delivery_receipt_ledger?.audit_events?.length ?? 0)
        + (artifacts.closeout_receipt_application?.audit_events?.length ?? 0)
        + (artifacts.control_plane_human_gate_receipt_application?.audit_events?.length ?? 0),
    follow_up_count: decisionSummary.follow_up_count ?? 0,
    decision_error_count: decisionErrorCount,
    action_item_count: actionItems.length,
  };
}

function pendingSliceApprovalCount(summary) {
  return summary?.status === "blocked" && /approval/i.test(summary.blocked_reason ?? "") ? 1 : 0;
}

function deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount) {
  if (stageStatuses.some((stage) => stage.status === "missing")) return "incomplete";
  if (decisionErrorCount > 0) return "attention";
  if (stageStatuses.some((stage) => stage.status === "blocked")) return "blocked";
  if (pendingApprovalCount > 0 || stageStatuses.some((stage) => stage.status === "pending")) return "pending_review";
  if (stageStatuses.some((stage) => stage.status === "attention")) return "attention";
  return "ready";
}

export function renderReviewDashboardHtml(dashboard) {
  const stages = dashboard.stage_statuses.map(renderStageHtml).join("\n");
  const actions = dashboard.action_items.map(renderActionHtml).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Review Dashboard</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#5d6673; --line:#d8dee8; --panel:#f7f9fb; --ok:#166534; --warn:#9a6700; --danger:#b42318; --accent:#0f766e; }
    * { box-sizing:border-box; }
    body { margin:0; background:#fff; color:var(--ink); font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding:28px 32px 20px; border-bottom:1px solid var(--line); }
    main { max-width:1200px; margin:0 auto; padding:22px 32px 42px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.2; }
    h2 { margin:28px 0 12px; font-size:18px; }
    h3 { margin:0 0 8px; font-size:16px; }
    .meta { color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:18px; }
    .stat, .stage, .action { border:1px solid var(--line); border-radius:8px; background:#fff; }
    .stat { padding:12px; background:var(--panel); }
    .stat strong { display:block; font-size:24px; }
    .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0; }
    .section { border-top:1px solid var(--line); margin-top:24px; padding-top:4px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
    .stage, .action { padding:14px; }
    .badge { display:inline-flex; align-items:center; min-height:24px; border-radius:999px; padding:3px 9px; font-size:12px; border:1px solid var(--line); color:var(--muted); }
    .status-passed, .status-ready { color:var(--ok); border-color:#b7dec2; background:#f0faf3; }
    .status-pending, .status-pending_review { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-blocked, .priority-critical { color:var(--danger); border-color:#efb4ad; background:#fff1f0; }
    .status-attention, .status-incomplete, .priority-high { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-missing { color:var(--muted); border-color:var(--line); background:#f2f4f7; }
    .muted { color:var(--muted); }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
    ul { padding-left:20px; }
    @media (max-width:640px) { header, main { padding-left:18px; padding-right:18px; } h1 { font-size:24px; } }
  </style>
</head>
<body>
  <header>
    <h1>Hermes Review Dashboard</h1>
    <div class="meta">Generated ${escapeHtml(dashboard.generated_at)}</div>
    <div class="meta">Overall <span class="badge status-${escapeHtml(dashboard.summary.overall_status)}">${escapeHtml(dashboard.summary.overall_status)}</span></div>
    <div class="stats">
      ${stat("Resources", dashboard.summary.resource_count)}
      ${stat("Evidence", dashboard.summary.evidence_count)}
      ${stat("Needs Review", dashboard.summary.evidence_needs_review_count)}
      ${stat("Review Draft", dashboard.summary.evidence_review_draft_item_count)}
      ${stat("Pending Approvals", dashboard.summary.pending_approval_count)}
      ${stat("Approval Inbox", dashboard.summary.approval_inbox_item_count)}
      ${stat("Inbox Applied", dashboard.summary.approval_inbox_applied_count)}
      ${stat("Matters", dashboard.summary.matter_count)}
      ${stat("Policy Classes", dashboard.summary.policy_classification_count)}
      ${stat("Policy Gates", dashboard.summary.policy_gate_rule_count)}
      ${stat("Policy Snapshots", dashboard.summary.policy_snapshot_count)}
      ${stat("Context Packets", dashboard.summary.context_packet_count)}
      ${stat("Model Routes", dashboard.summary.model_route_count)}
      ${stat("Cost Budgets", dashboard.summary.cost_budget_decision_count)}
      ${stat("Token Usage", dashboard.summary.token_usage_record_count)}
      ${stat("Cost Attribution", dashboard.summary.cost_attribution_record_count)}
      ${stat("Budget Alerts", dashboard.summary.budget_alert_active_count)}
      ${stat("Domain Packs", dashboard.summary.domain_pack_count)}
      ${stat("Outputs", dashboard.summary.output_artifact_count)}
      ${stat("Delivery", dashboard.summary.delivery_action_count)}
      ${stat("Execution Packets", dashboard.summary.delivery_execution_packet_count)}
      ${stat("Receipts", dashboard.summary.delivery_receipt_applied_count)}
      ${stat("Post Delivery", dashboard.summary.post_delivery_delivered_artifact_count)}
      ${stat("Closeout", dashboard.summary.delivery_closeout_item_count)}
      ${stat("Receipt Gate", dashboard.summary.closeout_receipt_ready_count)}
      ${stat("Closeout Applied", dashboard.summary.closeout_application_applied_count)}
      ${stat("Pipeline", dashboard.summary.pipeline_passed_step_count)}
      ${stat("Loop", dashboard.summary.control_plane_loop_passed_step_count)}
      ${stat("Goal Check", dashboard.summary.goal_checkpoint_passed_item_count)}
      ${stat("Audit Trail", dashboard.summary.audit_trail_event_count)}
      ${stat("Health", dashboard.summary.health_passed_check_count)}
      ${stat("Action Plan", dashboard.summary.action_plan_item_count)}
      ${stat("Human Gates", dashboard.summary.human_gate_item_count)}
      ${stat("Gate Receipts", dashboard.summary.human_gate_receipt_draft_count)}
      ${stat("Review Packets", dashboard.summary.human_review_packet_count)}
      ${stat("Review Agenda", dashboard.summary.human_review_agenda_item_count)}
      ${stat("Agenda Intake", dashboard.summary.human_review_agenda_intake_receipt_row_count)}
      ${stat("Review Workspace", dashboard.summary.human_review_receipt_workspace_actor_count)}
      ${stat("Workspace Merge", dashboard.summary.human_review_receipt_workspace_merge_receipt_row_count)}
      ${stat("Review Context", dashboard.summary.human_review_context_bundle_card_count)}
      ${stat("Decision Register", dashboard.summary.human_review_decision_register_row_count)}
      ${stat("Decision Merge", dashboard.summary.human_review_decision_register_merge_receipt_row_count)}
      ${stat("Gate Receipt Check", dashboard.summary.human_gate_receipt_validation_ready_count)}
      ${stat("Review Feedback", dashboard.summary.human_review_validation_feedback_item_count)}
      ${stat("Correction Workspace", dashboard.summary.human_review_correction_workspace_item_count)}
      ${stat("Correction Merge", dashboard.summary.human_review_correction_workspace_merge_receipt_row_count)}
      ${stat("Correction Validation", dashboard.summary.human_review_correction_validation_item_count)}
      ${stat("Correction Feedback", dashboard.summary.human_review_correction_feedback_item_count)}
      ${stat("Review Cycle", dashboard.summary.human_review_cycle_item_count)}
      ${stat("Gate Receipt Apply", dashboard.summary.human_gate_receipt_application_applied_count)}
      ${stat("Work Packets", dashboard.summary.work_packet_count)}
      ${stat("Packet Receipts", dashboard.summary.work_packet_receipt_draft_count)}
      ${stat("Receipt Gate", dashboard.summary.work_packet_receipt_validation_ready_count)}
      ${stat("Receipt Apply", dashboard.summary.work_packet_receipt_application_applied_count)}
      ${stat("Runs", dashboard.summary.observability_run_count)}
      ${stat("Blocking Gates", dashboard.summary.blocking_gate_count)}
      ${stat("Action Items", dashboard.summary.action_item_count)}
    </div>
  </header>
  <main>
    <section class="section">
      <h2>Control Plane Stages</h2>
      <div class="grid">${stages}</div>
    </section>
    <section class="section">
      <h2>Action Queue</h2>
      ${actions || "<p class=\"muted\">No action items.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

export function renderReviewDashboardMarkdown(dashboard) {
  const lines = [];
  lines.push("# Hermes Review Dashboard");
  lines.push("");
  lines.push(`Generated: ${dashboard.generated_at}`);
  lines.push(`Overall status: ${dashboard.summary.overall_status}`);
  lines.push("");
  lines.push(`- Resources: ${dashboard.summary.resource_count}`);
  lines.push(`- Evidence: ${dashboard.summary.evidence_count}`);
  lines.push(`- Evidence needs review: ${dashboard.summary.evidence_needs_review_count}`);
  lines.push(`- Evidence review draft items: ${dashboard.summary.evidence_review_draft_item_count ?? 0}`);
  lines.push(`- Evidence review attorney items: ${dashboard.summary.evidence_review_draft_attorney_count ?? 0}`);
  lines.push(`- Pending approvals: ${dashboard.summary.pending_approval_count}`);
  lines.push(`- Approval inbox items: ${dashboard.summary.approval_inbox_item_count ?? 0}`);
  lines.push(`- Approval inbox requests: ${dashboard.summary.approval_inbox_request_count ?? 0}`);
  lines.push(`- Approval inbox decisions applied: ${dashboard.summary.approval_inbox_applied_count ?? 0}`);
  lines.push(`- Approval inbox ready for delivery: ${dashboard.summary.approval_inbox_ready_for_delivery_count ?? 0}`);
  lines.push(`- Matters: ${dashboard.summary.matter_count ?? 0}`);
  lines.push(`- Blocked matters: ${dashboard.summary.blocked_matter_count ?? 0}`);
  lines.push(`- Policy classifications: ${dashboard.summary.policy_classification_count ?? 0}`);
  lines.push(`- Policy gate rules: ${dashboard.summary.policy_gate_rule_count ?? 0}`);
  lines.push(`- Policy external-model forbidden: ${dashboard.summary.policy_external_model_forbidden_count ?? 0}`);
  lines.push(`- Policy validation errors: ${dashboard.summary.policy_validation_error_count ?? 0}`);
  lines.push(`- Policy snapshots: ${dashboard.summary.policy_snapshot_count ?? 0}`);
  lines.push(`- Policy snapshot workflow usages: ${dashboard.summary.policy_snapshot_workflow_usage_count ?? 0}`);
  lines.push(`- Policy snapshot event references: ${dashboard.summary.policy_snapshot_event_reference_count ?? 0}`);
  lines.push(`- Policy snapshot validation errors: ${dashboard.summary.policy_snapshot_validation_error_count ?? 0}`);
  lines.push(`- Context packets: ${dashboard.summary.context_packet_count ?? 0}`);
  lines.push(`- Context packets ready: ${dashboard.summary.context_packet_ready_count ?? 0}`);
  lines.push(`- Context packets redacted: ${dashboard.summary.context_packet_redacted_count ?? 0}`);
  lines.push(`- Context packet validation errors: ${dashboard.summary.context_validation_error_count ?? 0}`);
  lines.push(`- Model routes: ${dashboard.summary.model_route_count ?? 0}`);
  lines.push(`- Model routes ready: ${dashboard.summary.model_route_ready_count ?? 0}`);
  lines.push(`- Model routes requiring approval: ${dashboard.summary.model_route_approval_required_count ?? 0}`);
  lines.push(`- Model external transfers: ${dashboard.summary.model_route_external_transfer_count ?? 0}`);
  lines.push(`- Model route validation errors: ${dashboard.summary.model_route_validation_error_count ?? 0}`);
  lines.push(`- Cost budget decisions: ${dashboard.summary.cost_budget_decision_count ?? 0}`);
  lines.push(`- Cost budget passed: ${dashboard.summary.cost_budget_passed_count ?? 0}`);
  lines.push(`- Cost budget token tracking pending: ${dashboard.summary.cost_budget_token_tracking_pending_count ?? 0}`);
  lines.push(`- Cost budget max USD: ${dashboard.summary.cost_budget_total_max_usd ?? 0}`);
  lines.push(`- Cost budget observed USD: ${dashboard.summary.cost_budget_total_observed_usd ?? 0}`);
  lines.push(`- Token usage records: ${dashboard.summary.token_usage_record_count ?? 0}`);
  lines.push(`- Token usage estimated: ${dashboard.summary.token_usage_estimated_count ?? 0}`);
  lines.push(`- Token usage total tokens: ${dashboard.summary.token_usage_total_tokens ?? 0}`);
  lines.push(`- Cost attribution records: ${dashboard.summary.cost_attribution_record_count ?? 0}`);
  lines.push(`- Cost attribution projected USD: ${dashboard.summary.cost_attribution_total_projected_usd ?? 0}`);
  lines.push(`- Cost attribution remaining USD: ${dashboard.summary.cost_attribution_total_remaining_usd ?? 0}`);
  lines.push(`- Budget alert records: ${dashboard.summary.budget_alert_record_count ?? 0}`);
  lines.push(`- Budget alert active: ${dashboard.summary.budget_alert_active_count ?? 0}`);
  lines.push(`- Budget alert critical: ${dashboard.summary.budget_alert_critical_count ?? 0}`);
  lines.push(`- Domain packs: ${dashboard.summary.domain_pack_count ?? 0}`);
  lines.push(`- Domain pack capabilities: ${dashboard.summary.domain_pack_capability_count ?? 0}`);
  lines.push(`- Output artifacts: ${dashboard.summary.output_artifact_count ?? 0}`);
  lines.push(`- Output delivery blocked: ${dashboard.summary.output_artifact_blocked_delivery_count ?? 0}`);
  lines.push(`- Delivery actions: ${dashboard.summary.delivery_action_count ?? 0}`);
  lines.push(`- Delivery blocked: ${dashboard.summary.delivery_blocked_action_count ?? 0}`);
  lines.push(`- Delivery ready: ${dashboard.summary.delivery_ready_action_count ?? 0}`);
  lines.push(`- Delivery execution ready candidates: ${dashboard.summary.delivery_execution_ready_candidate_count ?? 0}`);
  lines.push(`- Delivery execution packets: ${dashboard.summary.delivery_execution_packet_count ?? 0}`);
  lines.push(`- Delivery receipts applied: ${dashboard.summary.delivery_receipt_applied_count ?? 0}`);
  lines.push(`- Delivery receipts pending: ${dashboard.summary.delivery_receipt_pending_count ?? 0}`);
  lines.push(`- Delivery receipt delivered artifacts: ${dashboard.summary.delivery_receipt_delivered_artifact_count ?? 0}`);
  lines.push(`- Post-delivery delivered artifacts: ${dashboard.summary.post_delivery_delivered_artifact_count ?? 0}`);
  lines.push(`- Post-delivery delivered matters: ${dashboard.summary.post_delivery_delivered_matter_count ?? 0}`);
  lines.push(`- Post-delivery outstanding receipts: ${dashboard.summary.post_delivery_outstanding_receipt_count ?? 0}`);
  lines.push(`- Delivery closeout items: ${dashboard.summary.delivery_closeout_item_count ?? 0}`);
  lines.push(`- Delivery closeout awaiting execution: ${dashboard.summary.delivery_closeout_awaiting_count ?? 0}`);
  lines.push(`- Closeout receipts ready: ${dashboard.summary.closeout_receipt_ready_count ?? 0}`);
  lines.push(`- Closeout receipts pending: ${dashboard.summary.closeout_receipt_pending_count ?? 0}`);
  lines.push(`- Closeout receipt errors: ${dashboard.summary.closeout_receipt_error_count ?? 0}`);
  lines.push(`- Closeout application ready receipts: ${dashboard.summary.closeout_application_ready_count ?? 0}`);
  lines.push(`- Closeout application applied receipts: ${dashboard.summary.closeout_application_applied_count ?? 0}`);
  lines.push(`- Closeout application delivered artifacts: ${dashboard.summary.closeout_application_delivered_artifact_count ?? 0}`);
  lines.push(`- Pipeline steps: ${dashboard.summary.pipeline_step_count ?? 0}`);
  lines.push(`- Pipeline steps passed: ${dashboard.summary.pipeline_passed_step_count ?? 0}`);
  lines.push(`- Pipeline steps failed: ${dashboard.summary.pipeline_failed_step_count ?? 0}`);
  lines.push(`- Control loop steps: ${dashboard.summary.control_plane_loop_step_count ?? 0}`);
  lines.push(`- Control loop steps passed: ${dashboard.summary.control_plane_loop_passed_step_count ?? 0}`);
  lines.push(`- Control loop steps failed: ${dashboard.summary.control_plane_loop_failed_step_count ?? 0}`);
  lines.push(`- Audit trail events: ${dashboard.summary.audit_trail_event_count ?? 0}`);
  lines.push(`- Audit trail missing sources: ${dashboard.summary.audit_trail_missing_source_count ?? 0}`);
  lines.push(`- Audit trail protected action events: ${dashboard.summary.audit_trail_protected_action_event_count ?? 0}`);
  lines.push(`- Goal checkpoint items: ${dashboard.summary.goal_checkpoint_item_count ?? 0}`);
  lines.push(`- Goal checkpoint passed: ${dashboard.summary.goal_checkpoint_passed_item_count ?? 0}`);
  lines.push(`- Goal checkpoint attention: ${dashboard.summary.goal_checkpoint_attention_item_count ?? 0}`);
  lines.push(`- Health checks: ${dashboard.summary.health_check_count ?? 0}`);
  lines.push(`- Health checks passed: ${dashboard.summary.health_passed_check_count ?? 0}`);
  lines.push(`- Health checks blocked: ${dashboard.summary.health_blocked_check_count ?? 0}`);
  lines.push(`- Action plan items: ${dashboard.summary.action_plan_item_count ?? 0}`);
  lines.push(`- Action plan waiting for human: ${dashboard.summary.action_plan_waiting_for_human_count ?? 0}`);
  lines.push(`- Action plan ready to run: ${dashboard.summary.action_plan_ready_to_run_count ?? 0}`);
  lines.push(`- Human gate items: ${dashboard.summary.human_gate_item_count ?? 0}`);
  lines.push(`- Human gate evidence decisions: ${dashboard.summary.human_gate_evidence_decision_count ?? 0}`);
  lines.push(`- Human gate protected actions: ${dashboard.summary.human_gate_protected_action_count ?? 0}`);
  lines.push(`- Human gate receipt drafts: ${dashboard.summary.human_gate_receipt_draft_count ?? 0}`);
  lines.push(`- Human gate receipt protected: ${dashboard.summary.human_gate_receipt_protected_count ?? 0}`);
  lines.push(`- Human gate receipt evidence decisions: ${dashboard.summary.human_gate_receipt_evidence_decision_count ?? 0}`);
  lines.push(`- Human review packets: ${dashboard.summary.human_review_packet_count ?? 0}`);
  lines.push(`- Human review packet items: ${dashboard.summary.human_review_item_count ?? 0}`);
  lines.push(`- Human review pending packets: ${dashboard.summary.human_review_pending_packet_count ?? 0}`);
  lines.push(`- Human review agenda items: ${dashboard.summary.human_review_agenda_item_count ?? 0}`);
  lines.push(`- Human review agenda actors: ${dashboard.summary.human_review_agenda_actor_count ?? 0}`);
  lines.push(`- Human review agenda decision rows: ${dashboard.summary.human_review_agenda_decision_row_count ?? 0}`);
  lines.push(`- Human review agenda intake rows: ${dashboard.summary.human_review_agenda_intake_receipt_row_count ?? 0}`);
  lines.push(`- Human review agenda intake pending: ${dashboard.summary.human_review_agenda_intake_pending_count ?? 0}`);
  lines.push(`- Human review agenda intake ready: ${dashboard.summary.human_review_agenda_intake_ready_count ?? 0}`);
  lines.push(`- Human review receipt workspace actors: ${dashboard.summary.human_review_receipt_workspace_actor_count ?? 0}`);
  lines.push(`- Human review receipt workspace rows: ${dashboard.summary.human_review_receipt_workspace_receipt_row_count ?? 0}`);
  lines.push(`- Human review receipt workspace editable files: ${dashboard.summary.human_review_receipt_workspace_editable_file_count ?? 0}`);
  lines.push(`- Human review receipt workspace merge rows: ${dashboard.summary.human_review_receipt_workspace_merge_receipt_row_count ?? 0}`);
  lines.push(`- Human review receipt workspace merge pending: ${dashboard.summary.human_review_receipt_workspace_merge_pending_count ?? 0}`);
  lines.push(`- Human review receipt workspace merge ready: ${dashboard.summary.human_review_receipt_workspace_merge_ready_count ?? 0}`);
  lines.push(`- Human review context cards: ${dashboard.summary.human_review_context_bundle_card_count ?? 0}`);
  lines.push(`- Human review context pending: ${dashboard.summary.human_review_context_bundle_pending_count ?? 0}`);
  lines.push(`- Human review context evidence: ${dashboard.summary.human_review_context_bundle_evidence_count ?? 0}`);
  lines.push(`- Human review decision rows: ${dashboard.summary.human_review_decision_register_row_count ?? 0}`);
  lines.push(`- Human review decision pending: ${dashboard.summary.human_review_decision_register_pending_count ?? 0}`);
  lines.push(`- Human review decision ready: ${dashboard.summary.human_review_decision_register_ready_count ?? 0}`);
  lines.push(`- Human review decision merge rows: ${dashboard.summary.human_review_decision_register_merge_receipt_row_count ?? 0}`);
  lines.push(`- Human review decision merge pending: ${dashboard.summary.human_review_decision_register_merge_pending_count ?? 0}`);
  lines.push(`- Human review decision merge ready: ${dashboard.summary.human_review_decision_register_merge_ready_count ?? 0}`);
  lines.push(`- Human gate receipts ready: ${dashboard.summary.human_gate_receipt_validation_ready_count ?? 0}`);
  lines.push(`- Human gate receipts pending: ${dashboard.summary.human_gate_receipt_validation_pending_count ?? 0}`);
  lines.push(`- Human review validation feedback items: ${dashboard.summary.human_review_validation_feedback_item_count ?? 0}`);
  lines.push(`- Human review validation feedback pending: ${dashboard.summary.human_review_validation_feedback_pending_count ?? 0}`);
  lines.push(`- Human review validation feedback corrections: ${dashboard.summary.human_review_validation_feedback_correction_count ?? 0}`);
  lines.push(`- Human review correction workspace items: ${dashboard.summary.human_review_correction_workspace_item_count ?? 0}`);
  lines.push(`- Human review correction workspace pending: ${dashboard.summary.human_review_correction_workspace_pending_count ?? 0}`);
  lines.push(`- Human review correction workspace editable files: ${dashboard.summary.human_review_correction_workspace_editable_file_count ?? 0}`);
  lines.push(`- Human review correction workspace merge receipts: ${dashboard.summary.human_review_correction_workspace_merge_receipt_row_count ?? 0}`);
  lines.push(`- Human review correction workspace merge pending: ${dashboard.summary.human_review_correction_workspace_merge_pending_count ?? 0}`);
  lines.push(`- Human review correction validation pending: ${dashboard.summary.human_review_correction_validation_pending_count ?? 0}`);
  lines.push(`- Human review correction validation ready: ${dashboard.summary.human_review_correction_validation_ready_count ?? 0}`);
  lines.push(`- Human review correction feedback items: ${dashboard.summary.human_review_correction_feedback_item_count ?? 0}`);
  lines.push(`- Human review correction feedback pending: ${dashboard.summary.human_review_correction_feedback_pending_count ?? 0}`);
  lines.push(`- Human review correction feedback corrections: ${dashboard.summary.human_review_correction_feedback_correction_count ?? 0}`);
  lines.push(`- Human review cycle items: ${dashboard.summary.human_review_cycle_item_count ?? 0}`);
  lines.push(`- Human review cycle pending: ${dashboard.summary.human_review_cycle_pending_count ?? 0}`);
  lines.push(`- Human review cycle attention: ${dashboard.summary.human_review_cycle_attention_count ?? 0}`);
  lines.push(`- Human review cycle work order items: ${dashboard.summary.human_review_cycle_work_order_item_count ?? 0}`);
  lines.push(`- Human review cycle target audit ready: ${dashboard.summary.human_review_cycle_target_audit_ready_count ?? 0}`);
  lines.push(`- Human review cycle triage items: ${dashboard.summary.human_review_cycle_triage_item_count ?? 0}`);
  lines.push(`- Human review cycle triage ready: ${dashboard.summary.human_review_cycle_triage_ready_count ?? 0}`);
  lines.push(`- Human review cycle reviewer console items: ${dashboard.summary.human_review_cycle_console_item_count ?? 0}`);
  lines.push(`- Human review cycle reviewer console ready: ${dashboard.summary.human_review_cycle_console_ready_count ?? 0}`);
  lines.push(`- Human gate receipts applied: ${dashboard.summary.human_gate_receipt_application_applied_count ?? 0}`);
  lines.push(`- Human gate patched gates: ${dashboard.summary.human_gate_receipt_application_patched_gate_count ?? 0}`);
  lines.push(`- Work packets: ${dashboard.summary.work_packet_count ?? 0}`);
  lines.push(`- Work packet protected: ${dashboard.summary.work_packet_protected_count ?? 0}`);
  lines.push(`- Work packet next commands: ${dashboard.summary.work_packet_next_command_count ?? 0}`);
  lines.push(`- Work packet receipt drafts: ${dashboard.summary.work_packet_receipt_draft_count ?? 0}`);
  lines.push(`- Work packet receipt protected: ${dashboard.summary.work_packet_receipt_protected_count ?? 0}`);
  lines.push(`- Work packet receipts ready: ${dashboard.summary.work_packet_receipt_validation_ready_count ?? 0}`);
  lines.push(`- Work packet receipts pending: ${dashboard.summary.work_packet_receipt_validation_pending_count ?? 0}`);
  lines.push(`- Work packet receipts applied: ${dashboard.summary.work_packet_receipt_application_applied_count ?? 0}`);
  lines.push(`- Work packet patched packets: ${dashboard.summary.work_packet_receipt_application_patched_packet_count ?? 0}`);
  lines.push(`- Observability runs: ${dashboard.summary.observability_run_count ?? 0}`);
  lines.push(`- Observability events: ${dashboard.summary.observability_event_count ?? 0}`);
  lines.push(`- Runtime seconds: ${dashboard.summary.observability_runtime_seconds ?? 0}`);
  lines.push(`- Law firm issues: ${dashboard.summary.law_firm_issue_count ?? 0}`);
  lines.push(`- Law firm citations: ${dashboard.summary.law_firm_citation_count ?? 0}`);
  lines.push(`- Creative slides: ${dashboard.summary.creative_slide_count ?? 0}`);
  lines.push(`- Blocking gates: ${dashboard.summary.blocking_gate_count}`);
  lines.push(`- Blocked resources: ${dashboard.summary.blocked_resource_count}`);
  lines.push(`- Audit events: ${dashboard.summary.audit_event_count}`);
  lines.push(`- Action items: ${dashboard.summary.action_item_count}`);
  lines.push("");
  lines.push("## Stages");
  lines.push("");
  for (const stage of dashboard.stage_statuses) {
    lines.push(`- ${stage.label}: ${stage.status} - ${stage.message}`);
  }
  lines.push("");
  lines.push("## Action Items");
  lines.push("");
  for (const item of dashboard.action_items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.status})`);
  }
  if (dashboard.action_items.length === 0) lines.push("- No action items.");
  return `${lines.join("\n")}\n`;
}

function renderStageHtml(stage) {
  const metricItems = Object.entries(stage.metrics ?? {})
    .map(([key, value]) => `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>`)
    .join("");
  return `<article class="stage">
  <h3>${escapeHtml(stage.label)}</h3>
  <div class="badge status-${escapeHtml(stage.status)}">${escapeHtml(stage.status)}</div>
  <p>${escapeHtml(stage.message)}</p>
  <div class="meta">${escapeHtml(stage.source_path ?? "no source")}</div>
  ${metricItems ? `<ul>${metricItems}</ul>` : ""}
</article>`;
}

function renderActionHtml(item) {
  const actions = item.recommended_actions.map((action) => `<span class="badge">${escapeHtml(action)}</span>`).join(" ");
  return `<article class="action">
  <h3>${escapeHtml(item.title)}</h3>
  <div>
    <span class="badge priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
    <span class="badge">${escapeHtml(item.status)}</span>
  </div>
  <p>${escapeHtml(item.reason)}</p>
  <div class="meta">${escapeHtml(item.subject_ref.subject_type)}:<code>${escapeHtml(item.subject_ref.subject_id)}</code></div>
  <p>${actions}</p>
</article>`;
}

function stat(label, value) {
  return `<div class="stat"><strong>${Number(value ?? 0)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function compareActionItems(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

function healthSeverityToPriority(severity) {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function countReviewStatuses(evidenceItems) {
  return evidenceItems.reduce((counts, item) => {
    const status = item.review_status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function countBlockingGates(gates) {
  return gates.filter((gate) => gate.blocking || gate.status !== "passed").length;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_REVIEW_DASHBOARD_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--identity-model") parsed.identityModelPath = argv[++index];
    else if (arg === "--no-identity-model") parsed.identityModelPath = false;
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--no-resource-contract-freeze") parsed.resourceContractFreezePath = false;
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--no-matter-contract-freeze") parsed.matterContractFreezePath = false;
    else if (arg === "--client-counterparty-registry") parsed.clientCounterpartyRegistryPath = argv[++index];
    else if (arg === "--no-client-counterparty-registry") parsed.clientCounterpartyRegistryPath = false;
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--no-matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = false;
    else if (arg === "--wall-policy-contract") parsed.wallPolicyContractPath = argv[++index];
    else if (arg === "--no-wall-policy-contract") parsed.wallPolicyContractPath = false;
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--no-matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = false;
    else if (arg === "--policy-contract-freeze") parsed.policyContractFreezePath = argv[++index];
    else if (arg === "--no-policy-contract-freeze") parsed.policyContractFreezePath = false;
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--no-data-classification-rules") parsed.dataClassificationRuleEnginePath = false;
    else if (arg === "--matter-tagging-ledger") parsed.matterTaggingDecisionLedgerPath = argv[++index];
    else if (arg === "--no-matter-tagging-ledger") parsed.matterTaggingDecisionLedgerPath = false;
    else if (arg === "--access-audit-projection") parsed.accessAuditProjectionPath = argv[++index];
    else if (arg === "--no-access-audit-projection") parsed.accessAuditProjectionPath = false;
    else if (arg === "--store-policy-adapter") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--no-store-policy-adapter") parsed.storePolicyAdapterPath = false;
    else if (arg === "--conflict-check-interface") parsed.conflictCheckInterfacePath = argv[++index];
    else if (arg === "--no-conflict-check-interface") parsed.conflictCheckInterfacePath = false;
    else if (arg === "--personal-workspace-boundary") parsed.personalWorkspaceBoundaryPath = argv[++index];
    else if (arg === "--no-personal-workspace-boundary") parsed.personalWorkspaceBoundaryPath = false;
    else if (arg === "--policy-golden-fixtures") parsed.policyGoldenFixturesPath = argv[++index];
    else if (arg === "--no-policy-golden-fixtures") parsed.policyGoldenFixturesPath = false;
    else if (arg === "--policy-operations-surface") parsed.policyOperationsSurfacePath = argv[++index];
    else if (arg === "--no-policy-operations-surface") parsed.policyOperationsSurfacePath = false;
    else if (arg === "--matter-boundary-slice") parsed.matterBoundarySlicePath = argv[++index];
    else if (arg === "--no-matter-boundary-slice") parsed.matterBoundarySlicePath = false;
    else if (arg === "--identity-policy-matter-freeze") parsed.identityPolicyMatterFreezePath = argv[++index];
    else if (arg === "--no-identity-policy-matter-freeze") parsed.identityPolicyMatterFreezePath = false;
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--no-resource-store-interface") parsed.resourceStoreInterfacePath = false;
    else if (arg === "--immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--no-immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = false;
    else if (arg === "--resource-version-ledger") parsed.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--no-resource-version-ledger") parsed.resourceVersionLedgerPath = false;
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--no-normalized-text-contract") parsed.normalizedTextContractPath = false;
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--no-extractor-adapter-contract") parsed.extractorAdapterContractPath = false;
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--no-source-span-store") parsed.sourceSpanStorePath = false;
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--no-evidence-item-store") parsed.evidenceItemStorePath = false;
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--no-fact-claim-store") parsed.factClaimStorePath = false;
    else if (arg === "--evidence-contract-freeze") parsed.evidenceContractFreezePath = argv[++index];
    else if (arg === "--no-evidence-contract-freeze") parsed.evidenceContractFreezePath = false;
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--no-capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = false;
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--no-runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = false;
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--no-gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = false;
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--no-output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = false;
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--no-event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = false;
    else if (arg === "--error-cost-observability-contract-freeze") parsed.errorCostObservabilityContractFreezePath = argv[++index];
    else if (arg === "--no-error-cost-observability-contract-freeze") parsed.errorCostObservabilityContractFreezePath = false;
    else if (arg === "--evidence-viewer") parsed.evidenceViewerPath = argv[++index];
    else if (arg === "--approval-queue") parsed.approvalQueuePath = argv[++index];
    else if (arg === "--evidence-review-draft") parsed.evidenceReviewDraftPath = argv[++index];
    else if (arg === "--no-evidence-review-draft") parsed.evidenceReviewDraftPath = false;
    else if (arg === "--approval-decisions") parsed.approvalDecisionPath = argv[++index];
    else if (arg === "--approval-inbox") parsed.approvalInboxPath = argv[++index];
    else if (arg === "--no-approval-inbox") parsed.approvalInboxPath = false;
    else if (arg === "--approval-inbox-decisions") parsed.approvalInboxDecisionPath = argv[++index];
    else if (arg === "--no-approval-inbox-decisions") parsed.approvalInboxDecisionPath = false;
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--no-policy-matrix-catalog") parsed.policyMatrixCatalogPath = false;
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--no-policy-snapshot-ledger") parsed.policySnapshotLedgerPath = false;
    else if (arg === "--policy-snapshot-bindings") parsed.policySnapshotBindingLedgerPath = argv[++index];
    else if (arg === "--no-policy-snapshot-bindings") parsed.policySnapshotBindingLedgerPath = false;
    else if (arg === "--context-packet-ledger") parsed.contextPacketLedgerPath = argv[++index];
    else if (arg === "--no-context-packet-ledger") parsed.contextPacketLedgerPath = false;
    else if (arg === "--model-routing-ledger") parsed.modelRoutingLedgerPath = argv[++index];
    else if (arg === "--no-model-routing-ledger") parsed.modelRoutingLedgerPath = false;
    else if (arg === "--model-policy-enforcement") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--no-model-policy-enforcement") parsed.modelPolicyEnforcementPath = false;
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--no-tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = false;
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else if (arg === "--no-output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = false;
    else if (arg === "--approval-authority-ledger") parsed.approvalAuthorityLedgerPath = argv[++index];
    else if (arg === "--no-approval-authority-ledger") parsed.approvalAuthorityLedgerPath = false;
    else if (arg === "--cost-budget-ledger") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--no-cost-budget-ledger") parsed.costBudgetLedgerPath = false;
    else if (arg === "--token-usage-ledger") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--no-token-usage-ledger") parsed.tokenUsageLedgerPath = false;
    else if (arg === "--cost-attribution-ledger") parsed.costAttributionLedgerPath = argv[++index];
    else if (arg === "--no-cost-attribution-ledger") parsed.costAttributionLedgerPath = false;
    else if (arg === "--budget-alert-ledger") parsed.budgetAlertLedgerPath = argv[++index];
    else if (arg === "--no-budget-alert-ledger") parsed.budgetAlertLedgerPath = false;
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--no-domain-pack-registry") parsed.domainPackRegistryPath = false;
    else if (arg === "--output-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputArtifactCatalogPath = false;
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--no-observability-catalog") parsed.observabilityCatalogPath = false;
    else if (arg === "--delivery-queue") parsed.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--no-delivery-queue") parsed.protectedDeliveryQueuePath = false;
    else if (arg === "--matter-cockpit") parsed.matterCockpitPath = argv[++index];
    else if (arg === "--no-matter-cockpit") parsed.matterCockpitPath = false;
    else if (arg === "--delivery-execution") parsed.deliveryExecutionDraftPath = argv[++index];
    else if (arg === "--no-delivery-execution") parsed.deliveryExecutionDraftPath = false;
    else if (arg === "--delivery-receipts") parsed.deliveryReceiptLedgerPath = argv[++index];
    else if (arg === "--no-delivery-receipts") parsed.deliveryReceiptLedgerPath = false;
    else if (arg === "--post-delivery-reconciliation") parsed.postDeliveryReconciliationPath = argv[++index];
    else if (arg === "--no-post-delivery-reconciliation") parsed.postDeliveryReconciliationPath = false;
    else if (arg === "--delivery-closeout") parsed.deliveryCloseoutQueuePath = argv[++index];
    else if (arg === "--no-delivery-closeout") parsed.deliveryCloseoutQueuePath = false;
    else if (arg === "--closeout-receipt-validation") parsed.closeoutReceiptValidationPath = argv[++index];
    else if (arg === "--no-closeout-receipt-validation") parsed.closeoutReceiptValidationPath = false;
    else if (arg === "--closeout-receipt-application") parsed.closeoutReceiptApplicationPath = argv[++index];
    else if (arg === "--no-closeout-receipt-application") parsed.closeoutReceiptApplicationPath = false;
    else if (arg === "--control-plane-pipeline") parsed.controlPlanePipelinePath = argv[++index];
    else if (arg === "--no-control-plane-pipeline") parsed.controlPlanePipelinePath = false;
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--no-control-plane-loop") parsed.controlPlaneLoopPath = false;
    else if (arg === "--control-plane-goal-checkpoint") parsed.controlPlaneGoalCheckpointPath = argv[++index];
    else if (arg === "--no-control-plane-goal-checkpoint") parsed.controlPlaneGoalCheckpointPath = false;
    else if (arg === "--contract-inventory") parsed.contractInventoryPath = argv[++index];
    else if (arg === "--no-contract-inventory") parsed.contractInventoryPath = false;
    else if (arg === "--contract-dependency-map") parsed.contractDependencyMapPath = argv[++index];
    else if (arg === "--no-contract-dependency-map") parsed.contractDependencyMapPath = false;
    else if (arg === "--schema-versioning-rules") parsed.schemaVersioningRulesPath = argv[++index];
    else if (arg === "--no-schema-versioning-rules") parsed.schemaVersioningRulesPath = false;
    else if (arg === "--schema-migration-manifest") parsed.schemaMigrationManifestPath = argv[++index];
    else if (arg === "--no-schema-migration-manifest") parsed.schemaMigrationManifestPath = false;
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--no-issue-graph-store") parsed.issueGraphStorePath = false;
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--no-citation-object-store") parsed.citationObjectStorePath = false;
    else if (arg === "--lineage-graph") parsed.lineageGraphBuilderPath = argv[++index];
    else if (arg === "--no-lineage-graph") parsed.lineageGraphBuilderPath = false;
    else if (arg === "--evidence-coverage") parsed.evidenceCoverageScorePath = argv[++index];
    else if (arg === "--no-evidence-coverage") parsed.evidenceCoverageScorePath = false;
    else if (arg === "--contract-golden-fixtures") parsed.contractGoldenFixturesPath = argv[++index];
    else if (arg === "--no-contract-golden-fixtures") parsed.contractGoldenFixturesPath = false;
    else if (arg === "--contract-validation-suite") parsed.contractValidationSuitePath = argv[++index];
    else if (arg === "--no-contract-validation-suite") parsed.contractValidationSuitePath = false;
    else if (arg === "--control-plane-audit-trail") parsed.controlPlaneAuditTrailPath = argv[++index];
    else if (arg === "--no-control-plane-audit-trail") parsed.controlPlaneAuditTrailPath = false;
    else if (arg === "--control-plane-health") parsed.controlPlaneHealthPath = argv[++index];
    else if (arg === "--no-control-plane-health") parsed.controlPlaneHealthPath = false;
    else if (arg === "--control-plane-action-plan") parsed.controlPlaneActionPlanPath = argv[++index];
    else if (arg === "--no-control-plane-action-plan") parsed.controlPlaneActionPlanPath = false;
    else if (arg === "--control-plane-human-gates") parsed.controlPlaneHumanGatesPath = argv[++index];
    else if (arg === "--no-control-plane-human-gates") parsed.controlPlaneHumanGatesPath = false;
    else if (arg === "--control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
    else if (arg === "--no-control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = false;
    else if (arg === "--human-review-packets") parsed.humanReviewPacketLedgerPath = argv[++index];
    else if (arg === "--no-human-review-packets") parsed.humanReviewPacketLedgerPath = false;
    else if (arg === "--human-review-agenda") parsed.humanReviewAgendaPath = argv[++index];
    else if (arg === "--no-human-review-agenda") parsed.humanReviewAgendaPath = false;
    else if (arg === "--human-review-agenda-intake") parsed.humanReviewAgendaReceiptIntakePath = argv[++index];
    else if (arg === "--no-human-review-agenda-intake") parsed.humanReviewAgendaReceiptIntakePath = false;
    else if (arg === "--human-review-receipt-workspace") parsed.humanReviewReceiptWorkspacePath = argv[++index];
    else if (arg === "--no-human-review-receipt-workspace") parsed.humanReviewReceiptWorkspacePath = false;
    else if (arg === "--human-review-receipt-workspace-merge") parsed.humanReviewReceiptWorkspaceMergePath = argv[++index];
    else if (arg === "--no-human-review-receipt-workspace-merge") parsed.humanReviewReceiptWorkspaceMergePath = false;
    else if (arg === "--human-review-context-bundle") parsed.humanReviewContextBundlePath = argv[++index];
    else if (arg === "--no-human-review-context-bundle") parsed.humanReviewContextBundlePath = false;
    else if (arg === "--human-review-decision-register") parsed.humanReviewDecisionRegisterPath = argv[++index];
    else if (arg === "--no-human-review-decision-register") parsed.humanReviewDecisionRegisterPath = false;
    else if (arg === "--human-review-decision-register-merge") parsed.humanReviewDecisionRegisterMergePath = argv[++index];
    else if (arg === "--no-human-review-decision-register-merge") parsed.humanReviewDecisionRegisterMergePath = false;
    else if (arg === "--human-review-validation-feedback") parsed.humanReviewValidationFeedbackPath = argv[++index];
    else if (arg === "--no-human-review-validation-feedback") parsed.humanReviewValidationFeedbackPath = false;
    else if (arg === "--human-review-correction-workspace") parsed.humanReviewCorrectionWorkspacePath = argv[++index];
    else if (arg === "--no-human-review-correction-workspace") parsed.humanReviewCorrectionWorkspacePath = false;
    else if (arg === "--human-review-correction-workspace-merge") parsed.humanReviewCorrectionWorkspaceMergePath = argv[++index];
    else if (arg === "--no-human-review-correction-workspace-merge") parsed.humanReviewCorrectionWorkspaceMergePath = false;
    else if (arg === "--human-review-correction-validation") parsed.humanReviewCorrectionValidationPath = argv[++index];
    else if (arg === "--no-human-review-correction-validation") parsed.humanReviewCorrectionValidationPath = false;
    else if (arg === "--human-review-correction-feedback") parsed.humanReviewCorrectionFeedbackPath = argv[++index];
    else if (arg === "--no-human-review-correction-feedback") parsed.humanReviewCorrectionFeedbackPath = false;
    else if (arg === "--human-review-cycle-ledger") parsed.humanReviewCycleLedgerPath = argv[++index];
    else if (arg === "--no-human-review-cycle-ledger") parsed.humanReviewCycleLedgerPath = false;
    else if (arg === "--human-review-cycle-work-orders") parsed.humanReviewCycleWorkOrdersPath = argv[++index];
    else if (arg === "--no-human-review-cycle-work-orders") parsed.humanReviewCycleWorkOrdersPath = false;
    else if (arg === "--human-review-cycle-target-audit") parsed.humanReviewCycleTargetAuditPath = argv[++index];
    else if (arg === "--no-human-review-cycle-target-audit") parsed.humanReviewCycleTargetAuditPath = false;
    else if (arg === "--human-review-cycle-triage") parsed.humanReviewCycleTriageInboxPath = argv[++index];
    else if (arg === "--no-human-review-cycle-triage") parsed.humanReviewCycleTriageInboxPath = false;
    else if (arg === "--human-review-cycle-console") parsed.humanReviewCycleReviewerConsolePath = argv[++index];
    else if (arg === "--no-human-review-cycle-console") parsed.humanReviewCycleReviewerConsolePath = false;
    else if (arg === "--human-review-cycle-field-audit") parsed.humanReviewCycleReceiptFieldAuditPath = argv[++index];
    else if (arg === "--no-human-review-cycle-field-audit") parsed.humanReviewCycleReceiptFieldAuditPath = false;
    else if (arg === "--human-review-cycle-completion-pack") parsed.humanReviewCycleReceiptCompletionPackPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-pack") parsed.humanReviewCycleReceiptCompletionPackPath = false;
    else if (arg === "--human-review-cycle-completion-verification") parsed.humanReviewCycleReceiptCompletionVerificationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-verification") parsed.humanReviewCycleReceiptCompletionVerificationPath = false;
    else if (arg === "--human-review-cycle-completion-workbench") parsed.humanReviewCycleReceiptCompletionWorkbenchPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-workbench") parsed.humanReviewCycleReceiptCompletionWorkbenchPath = false;
    else if (arg === "--human-review-cycle-completion-runbook") parsed.humanReviewCycleReceiptCompletionRunbookPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-runbook") parsed.humanReviewCycleReceiptCompletionRunbookPath = false;
    else if (arg === "--human-review-cycle-completion-readiness") parsed.humanReviewCycleReceiptCompletionReadinessPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-readiness") parsed.humanReviewCycleReceiptCompletionReadinessPath = false;
    else if (arg === "--human-review-cycle-completion-command-queue") parsed.humanReviewCycleReceiptCompletionCommandQueuePath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-queue") parsed.humanReviewCycleReceiptCompletionCommandQueuePath = false;
    else if (arg === "--human-review-cycle-completion-command-receipts") parsed.humanReviewCycleReceiptCompletionCommandReceiptsPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipts") parsed.humanReviewCycleReceiptCompletionCommandReceiptsPath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-validation") parsed.humanReviewCycleReceiptCompletionCommandReceiptValidationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-validation") parsed.humanReviewCycleReceiptCompletionCommandReceiptValidationPath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-feedback") parsed.humanReviewCycleReceiptCompletionCommandReceiptFeedbackPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-feedback") parsed.humanReviewCycleReceiptCompletionCommandReceiptFeedbackPath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-workspace") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspacePath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-workspace") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspacePath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-workspace-merge") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergePath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-workspace-merge") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergePath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-workspace-validation") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-workspace-validation") parsed.humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationPath = false;
    else if (arg === "--human-review-cycle-completion-command-receipt-application") parsed.humanReviewCycleReceiptCompletionCommandReceiptApplicationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-receipt-application") parsed.humanReviewCycleReceiptCompletionCommandReceiptApplicationPath = false;
    else if (arg === "--human-review-cycle-completion-reconciliation") parsed.humanReviewCycleReceiptCompletionReconciliationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-reconciliation") parsed.humanReviewCycleReceiptCompletionReconciliationPath = false;
    else if (arg === "--human-review-cycle-completion-baseline") parsed.humanReviewCycleReceiptCompletionBaselinePath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-baseline") parsed.humanReviewCycleReceiptCompletionBaselinePath = false;
    else if (arg === "--human-review-cycle-completion-manual-command-receipt-pack") parsed.humanReviewCycleReceiptCompletionManualCommandReceiptPackPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-manual-command-receipt-pack") parsed.humanReviewCycleReceiptCompletionManualCommandReceiptPackPath = false;
    else if (arg === "--human-review-cycle-completion-held-command-resolution") parsed.humanReviewCycleReceiptCompletionHeldCommandResolutionPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-held-command-resolution") parsed.humanReviewCycleReceiptCompletionHeldCommandResolutionPath = false;
    else if (arg === "--human-review-cycle-completion-protected-approval-request-pack") parsed.humanReviewCycleReceiptCompletionProtectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-protected-approval-request-pack") parsed.humanReviewCycleReceiptCompletionProtectedApprovalRequestPackPath = false;
    else if (arg === "--human-review-cycle-completion-manual-revalidation") parsed.humanReviewCycleReceiptCompletionManualRevalidationPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-manual-revalidation") parsed.humanReviewCycleReceiptCompletionManualRevalidationPath = false;
    else if (arg === "--human-review-cycle-completion-command-queue-patch-projection") parsed.humanReviewCycleReceiptCompletionCommandQueuePatchProjectionPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-command-queue-patch-projection") parsed.humanReviewCycleReceiptCompletionCommandQueuePatchProjectionPath = false;
    else if (arg === "--human-review-cycle-completion-closeout-ledger") parsed.humanReviewCycleReceiptCompletionCloseoutLedgerPath = argv[++index];
    else if (arg === "--no-human-review-cycle-completion-closeout-ledger") parsed.humanReviewCycleReceiptCompletionCloseoutLedgerPath = false;
    else if (arg === "--human-review-v1-regression-freeze") parsed.humanReviewV1RegressionFreezePath = argv[++index];
    else if (arg === "--no-human-review-v1-regression-freeze") parsed.humanReviewV1RegressionFreezePath = false;
    else if (arg === "--control-plane-human-gate-receipt-validation") parsed.controlPlaneHumanGateReceiptValidationPath = argv[++index];
    else if (arg === "--no-control-plane-human-gate-receipt-validation") parsed.controlPlaneHumanGateReceiptValidationPath = false;
    else if (arg === "--control-plane-human-gate-receipt-application") parsed.controlPlaneHumanGateReceiptApplicationPath = argv[++index];
    else if (arg === "--no-control-plane-human-gate-receipt-application") parsed.controlPlaneHumanGateReceiptApplicationPath = false;
    else if (arg === "--control-plane-work-packets") parsed.controlPlaneWorkPacketsPath = argv[++index];
    else if (arg === "--no-control-plane-work-packets") parsed.controlPlaneWorkPacketsPath = false;
    else if (arg === "--control-plane-work-packet-receipts") parsed.controlPlaneWorkPacketReceiptsPath = argv[++index];
    else if (arg === "--no-control-plane-work-packet-receipts") parsed.controlPlaneWorkPacketReceiptsPath = false;
    else if (arg === "--control-plane-work-packet-receipt-validation") parsed.controlPlaneWorkPacketReceiptValidationPath = argv[++index];
    else if (arg === "--no-control-plane-work-packet-receipt-validation") parsed.controlPlaneWorkPacketReceiptValidationPath = false;
    else if (arg === "--control-plane-work-packet-receipt-application") parsed.controlPlaneWorkPacketReceiptApplicationPath = argv[++index];
    else if (arg === "--no-control-plane-work-packet-receipt-application") parsed.controlPlaneWorkPacketReceiptApplicationPath = false;
    else if (arg === "--law-firm-ldd-summary") parsed.lawFirmLddSummaryPath = argv[++index];
    else if (arg === "--no-law-firm-ldd-summary") parsed.lawFirmLddSummaryPath = false;
    else if (arg === "--personal-dev-summary") parsed.personalDevSummaryPath = argv[++index];
    else if (arg === "--no-personal-dev-summary") parsed.personalDevSummaryPath = false;
    else if (arg === "--creative-document-summary") parsed.creativeDocumentSummaryPath = argv[++index];
    else if (arg === "--no-creative-document-summary") parsed.creativeDocumentSummaryPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/review-dashboard.mjs [options]

Options:
  --resource-expansion <path>    resource-expansion-job.json path.
  --resource-ingest <path>       resource-ingest.json path.
  --identity-model <path>        identity-model.json path.
  --no-identity-model            Do not include Identity Model status.
  --resource-contract-freeze <path>
                                  resource-contract-freeze.json path.
  --no-resource-contract-freeze  Do not include Resource Contract Freeze status.
  --client-counterparty-registry <path>
                                  client-counterparty-registry.json path.
  --no-client-counterparty-registry
                                  Do not include Client/Counterparty Registry status.
  --matter-profile-team-ledger <path>
                                  matter-profile-team-ledger.json path.
  --no-matter-profile-team-ledger
                                  Do not include Matter Profile/Team Ledger status.
  --wall-policy-contract <path>  wall-policy-contract.json path.
  --no-wall-policy-contract      Do not include Wall Policy Contract status.
  --matter-access-policy <path>  matter-access-policy-evaluator.json path.
  --no-matter-access-policy      Do not include Matter Access Policy Evaluator status.
  --policy-contract-freeze <path>
                                  policy-contract-freeze.json path.
  --no-policy-contract-freeze    Do not include Policy Contract Freeze status.
  --data-classification-rules <path>
                                  data-classification-rule-engine.json path.
  --no-data-classification-rules Do not include Data Classification Rule Engine status.
  --matter-tagging-ledger <path> matter-tagging-ledger.json path.
  --no-matter-tagging-ledger     Do not include Matter Tagging Decision Ledger status.
  --access-audit-projection <path>
                                  access-audit-projection.json path.
  --no-access-audit-projection   Do not include Access Audit Projection status.
  --store-policy-adapter <path>  store-policy-adapter.json path.
  --no-store-policy-adapter      Do not include Store Policy Adapter status.
  --conflict-check-interface <path>
                                  conflict-check-interface.json path.
  --no-conflict-check-interface  Do not include Conflict Check Interface status.
  --personal-workspace-boundary <path>
                                  personal-workspace-boundary.json path.
  --no-personal-workspace-boundary
                                  Do not include Personal Workspace Boundary status.
  --policy-golden-fixtures <path> policy-golden-fixtures.json path.
  --no-policy-golden-fixtures     Do not include Policy Golden Fixtures status.
  --policy-operations-surface <path>
                                  policy-operations-surface.json path.
  --no-policy-operations-surface  Do not include Policy Operations Surface status.
  --matter-boundary-slice <path>  matter-boundary-slice.json path.
  --no-matter-boundary-slice      Do not include Matter Boundary Slice status.
  --identity-policy-matter-freeze <path>
                                  identity-policy-matter-freeze.json path.
  --no-identity-policy-matter-freeze
                                  Do not include Identity/Policy/Matter Freeze status.
  --resource-store-interface <path>
                                  resource-store-interface.json path.
  --no-resource-store-interface   Do not include Resource Store Interface status.
  --immutable-object-store-layout <path>
                                  immutable-object-store-layout.json path.
  --no-immutable-object-store-layout
                                  Do not include Immutable Object Store Layout status.
  --resource-version-ledger <path>
                                  resource-version-ledger.json path.
  --no-resource-version-ledger    Do not include Resource Version Ledger status.
  --normalized-text-contract <path>
                                  normalized-text-contract.json path.
  --no-normalized-text-contract   Do not include Normalized Text Contract status.
  --extractor-adapter-contract <path>
                                  extractor-adapter-contract.json path.
  --no-extractor-adapter-contract
                                  Do not include Extractor Adapter Contract status.
  --source-span-store <path>      source-span-store.json path.
  --no-source-span-store          Do not include Source Span Store status.
  --evidence-item-store <path>    evidence-item-store.json path.
  --no-evidence-item-store        Do not include Evidence Item Store status.
  --fact-claim-store <path>       fact-claim-store.json path.
  --no-fact-claim-store           Do not include Fact Claim Store status.
  --issue-graph-store <path>      issue-graph-store.json path.
  --no-issue-graph-store          Do not include Issue Graph Store status.
  --citation-object-store <path>  citation-object-store.json path.
  --no-citation-object-store      Do not include Citation Object Store status.
  --lineage-graph <path>          lineage-graph.json path.
  --no-lineage-graph              Do not include Lineage Graph Builder status.
  --evidence-coverage <path>      evidence-coverage-score.json path.
  --no-evidence-coverage          Do not include Evidence Coverage Score status.
  --capability-workflow-contract-freeze <path>
                                  capability-workflow-contract-freeze.json path.
  --no-capability-workflow-contract-freeze
                                  Do not include Capability Workflow Contract Freeze status.
  --evidence-viewer <path>       evidence-viewer.json path.
  --approval-queue <path>        approval-queue.json path.
  --evidence-review-draft <path> evidence-review-draft.json path.
  --no-evidence-review-draft     Do not include Evidence Review Draft status.
  --approval-decisions <path>    approval-decision-result.json path.
  --approval-inbox <path>        approval-inbox.json path.
  --no-approval-inbox            Do not include Approval Inbox status.
  --approval-inbox-decisions <path>
                                  approval-inbox-decision-result.json path.
  --no-approval-inbox-decisions  Do not include Approval Inbox Decisions status.
  --policy-matrix-catalog <path> policy-matrix-catalog.json path.
  --no-policy-matrix-catalog     Do not include Policy Matrix Catalog status.
  --policy-snapshot-ledger <path>
                                  policy-snapshot-ledger.json path.
  --no-policy-snapshot-ledger    Do not include Policy Snapshot Ledger status.
  --policy-snapshot-bindings <path>
                                  policy-snapshot-binding-ledger.json path.
  --no-policy-snapshot-bindings  Do not include Policy Snapshot Binding Ledger status.
  --context-packet-ledger <path> context-packet-ledger.json path.
  --no-context-packet-ledger     Do not include Context Packet Ledger status.
  --model-routing-ledger <path>  model-routing-ledger.json path.
  --no-model-routing-ledger      Do not include Model Routing Ledger status.
  --model-policy-enforcement <path>
                                  model-policy-enforcement.json path.
  --no-model-policy-enforcement  Do not include Model Policy Enforcement status.
  --tool-runtime-policy <path>    tool-runtime-policy-enforcement.json path.
  --no-tool-runtime-policy        Do not include Tool/Runtime Policy Enforcement status.
  --output-destination-policy <path>
                                  output-destination-policy-enforcement.json path.
  --no-output-destination-policy  Do not include Output Destination Policy Enforcement status.
  --approval-authority-ledger <path>
                                  approval-authority-ledger.json path.
  --no-approval-authority-ledger  Do not include Approval Authority Ledger status.
  --cost-budget-ledger <path>    cost-budget-ledger.json path.
  --no-cost-budget-ledger        Do not include Cost Budget Ledger status.
  --token-usage-ledger <path>    token-usage-ledger.json path.
  --no-token-usage-ledger        Do not include Token Usage Ledger status.
  --cost-attribution-ledger <path>
                                  cost-attribution-ledger.json path.
  --no-cost-attribution-ledger   Do not include Cost Attribution Ledger status.
  --budget-alert-ledger <path>   budget-alert-ledger.json path.
  --no-budget-alert-ledger       Do not include Budget Alert Ledger status.
  --domain-pack-registry <path>  domain-pack-registry.json path.
  --no-domain-pack-registry      Do not include Domain Pack Registry status.
  --output-catalog <path>        output-catalog.json path.
  --no-output-catalog            Do not include Output Artifact Catalog status.
  --observability-catalog <path> observability-catalog.json path.
  --no-observability-catalog     Do not include Observability Catalog status.
  --delivery-queue <path>        protected-delivery-queue.json path.
  --no-delivery-queue            Do not include Protected Delivery Queue status.
  --matter-cockpit <path>        matter-cockpit.json path.
  --no-matter-cockpit            Do not include Matter Cockpit status.
  --delivery-execution <path>    delivery-execution-draft.json path.
  --no-delivery-execution        Do not include Delivery Execution Draft status.
  --delivery-receipts <path>     delivery-receipt-ledger.json path.
  --no-delivery-receipts         Do not include Delivery Receipt Ledger status.
  --post-delivery-reconciliation <path>
                                  post-delivery-reconciliation.json path.
  --no-post-delivery-reconciliation
                                  Do not include Post-Delivery Reconciliation status.
  --delivery-closeout <path>      delivery-closeout-queue.json path.
  --no-delivery-closeout          Do not include Delivery Closeout Queue status.
  --closeout-receipt-validation <path>
                                  closeout-receipt-validation.json path.
  --no-closeout-receipt-validation
                                  Do not include Closeout Receipt Validation status.
  --closeout-receipt-application <path>
                                  closeout-receipt-application.json path.
  --no-closeout-receipt-application
                                  Do not include Closeout Receipt Application status.
  --control-plane-pipeline <path> control-plane-pipeline.json path.
  --no-control-plane-pipeline     Do not include Control Plane Pipeline status.
  --control-plane-loop <path>     control-plane-loop.json path.
  --no-control-plane-loop         Do not include Control Plane Loop status.
  --control-plane-goal-checkpoint <path>
                                  control-plane-goal-checkpoint.json path.
  --no-control-plane-goal-checkpoint
                                  Do not include Control Plane Goal Checkpoint status.
  --contract-inventory <path>    contract-inventory.json path.
  --no-contract-inventory        Do not include Contract Inventory status.
  --contract-dependency-map <path>
                                  contract-dependency-map.json path.
  --no-contract-dependency-map   Do not include Contract Dependency Map status.
  --schema-versioning-rules <path>
                                  schema-versioning-rules.json path.
  --no-schema-versioning-rules   Do not include Schema Versioning Rules status.
  --schema-migration-manifest <path>
                                  schema-migration-manifest-ledger.json path.
  --no-schema-migration-manifest Do not include Schema Migration Manifest status.
  --contract-golden-fixtures <path>
                                  contract-golden-fixtures.json path.
  --no-contract-golden-fixtures Do not include Contract Golden Fixtures status.
  --contract-validation-suite <path>
                                  contract-validation-suite.json path.
  --no-contract-validation-suite
                                  Do not include Contract Validation Suite status.
  --control-plane-audit-trail <path>
                                  control-plane-audit-trail.json path.
  --no-control-plane-audit-trail  Do not include Control Plane Audit Trail status.
  --control-plane-health <path>   control-plane-health.json path.
  --no-control-plane-health       Do not include Control Plane Health status.
  --control-plane-action-plan <path>
                                  control-plane-action-plan.json path.
  --no-control-plane-action-plan  Do not include Control Plane Action Plan status.
  --control-plane-human-gates <path>
                                  control-plane-human-gates.json path.
  --no-control-plane-human-gates  Do not include Control Plane Human Gates status.
  --control-plane-human-gate-receipts <path>
                                  control-plane-human-gate-receipt-drafts.json path.
  --no-control-plane-human-gate-receipts
                                  Do not include Control Plane Human Gate Receipts status.
  --human-review-packets <path>  human-review-packet-ledger.json path.
  --no-human-review-packets      Do not include Human Review Packet Ledger status.
  --human-review-agenda <path>   human-review-agenda.json path.
  --no-human-review-agenda       Do not include Human Review Agenda status.
  --human-review-agenda-intake <path>
                                  human-review-agenda-receipt-intake.json path.
  --no-human-review-agenda-intake
                                  Do not include Human Review Agenda Receipt Intake status.
  --human-review-receipt-workspace <path>
                                  human-review-receipt-workspace.json path.
  --no-human-review-receipt-workspace
                                  Do not include Human Review Receipt Workspace status.
  --human-review-receipt-workspace-merge <path>
                                  human-review-receipt-workspace-merge.json path.
  --no-human-review-receipt-workspace-merge
                                  Do not include Human Review Receipt Workspace Merge status.
  --human-review-correction-feedback <path>
                                  human-review-correction-feedback.json path.
  --no-human-review-correction-feedback
                                  Do not include Human Review Correction Feedback status.
  --human-review-cycle-ledger <path>
                                  human-review-cycle-ledger.json path.
  --no-human-review-cycle-ledger
                                  Do not include Human Review Cycle Ledger status.
  --human-review-cycle-work-orders <path>
                                  human-review-cycle-work-orders.json path.
  --no-human-review-cycle-work-orders
                                  Do not include Human Review Cycle Work Orders status.
  --human-review-cycle-target-audit <path>
                                  human-review-cycle-work-order-target-audit.json path.
  --no-human-review-cycle-target-audit
                                  Do not include Human Review Cycle Target Audit status.
  --human-review-cycle-triage <path>
                                  human-review-cycle-triage-inbox.json path.
  --no-human-review-cycle-triage
                                  Do not include Human Review Cycle Triage Inbox status.
  --human-review-cycle-console <path>
                                  human-review-cycle-reviewer-console.json path.
  --no-human-review-cycle-console
                                  Do not include Human Review Cycle Reviewer Console status.
  --human-review-cycle-field-audit <path>
                                  human-review-cycle-receipt-field-audit.json path.
  --no-human-review-cycle-field-audit
                                  Do not include Human Review Cycle Receipt Field Audit status.
  --human-review-cycle-completion-pack <path>
                                  human-review-cycle-receipt-completion-pack.json path.
  --no-human-review-cycle-completion-pack
                                  Do not include Human Review Cycle Receipt Completion Pack status.
  --human-review-cycle-completion-verification <path>
                                  human-review-cycle-receipt-completion-verification.json path.
  --no-human-review-cycle-completion-verification
                                  Do not include Human Review Cycle Receipt Completion Verification status.
  --human-review-cycle-completion-workbench <path>
                                  human-review-cycle-receipt-completion-workbench.json path.
  --no-human-review-cycle-completion-workbench
                                  Do not include Human Review Cycle Receipt Completion Workbench status.
  --human-review-cycle-completion-runbook <path>
                                  human-review-cycle-receipt-completion-runbook.json path.
  --no-human-review-cycle-completion-runbook
                                  Do not include Human Review Cycle Receipt Completion Runbook status.
  --human-review-cycle-completion-readiness <path>
                                  human-review-cycle-receipt-completion-readiness.json path.
  --no-human-review-cycle-completion-readiness
                                  Do not include Human Review Cycle Receipt Completion Readiness status.
  --human-review-cycle-completion-command-queue <path>
                                  human-review-cycle-receipt-completion-command-queue.json path.
  --no-human-review-cycle-completion-command-queue
                                  Do not include Human Review Cycle Receipt Completion Command Queue status.
  --human-review-cycle-completion-command-receipts <path>
                                  human-review-cycle-receipt-completion-command-receipts.json path.
  --no-human-review-cycle-completion-command-receipts
                                  Do not include Human Review Cycle Receipt Completion Command Receipts status.
  --human-review-cycle-completion-command-receipt-validation <path>
                                  human-review-cycle-receipt-completion-command-receipt-validation.json path.
  --no-human-review-cycle-completion-command-receipt-validation
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Validation status.
  --human-review-cycle-completion-command-receipt-feedback <path>
                                  human-review-cycle-receipt-completion-command-receipt-feedback.json path.
  --no-human-review-cycle-completion-command-receipt-feedback
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Feedback status.
  --human-review-cycle-completion-command-receipt-workspace <path>
                                  human-review-cycle-receipt-completion-command-receipt-workspace.json path.
  --no-human-review-cycle-completion-command-receipt-workspace
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Workspace status.
  --human-review-cycle-completion-command-receipt-workspace-merge <path>
                                  human-review-cycle-receipt-completion-command-receipt-workspace-merge.json path.
  --no-human-review-cycle-completion-command-receipt-workspace-merge
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Workspace Merge status.
  --human-review-cycle-completion-command-receipt-workspace-validation <path>
                                  merged command receipt validation artifact path.
  --no-human-review-cycle-completion-command-receipt-workspace-validation
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Workspace Validation status.
  --human-review-cycle-completion-command-receipt-application <path>
                                  command receipt application artifact path.
  --no-human-review-cycle-completion-command-receipt-application
                                  Do not include Human Review Cycle Receipt Completion Command Receipt Application status.
  --human-review-cycle-completion-reconciliation <path>
                                  receipt completion reconciliation artifact path.
  --no-human-review-cycle-completion-reconciliation
                                  Do not include Human Review Cycle Receipt Completion Reconciliation status.
  --human-review-cycle-completion-baseline <path>
                                  receipt completion baseline artifact path.
  --no-human-review-cycle-completion-baseline
                                  Do not include Human Review Cycle Receipt Completion Baseline status.
  --human-review-cycle-completion-manual-command-receipt-pack <path>
                                  manual command receipt pack artifact path.
  --no-human-review-cycle-completion-manual-command-receipt-pack
                                  Do not include Human Review Cycle Receipt Completion Manual Command Receipt Pack status.
  --human-review-cycle-completion-held-command-resolution <path>
                                  held command resolution artifact path.
  --no-human-review-cycle-completion-held-command-resolution
                                  Do not include Human Review Cycle Receipt Completion Held Command Resolution status.
  --human-review-cycle-completion-protected-approval-request-pack <path>
                                  protected approval request pack artifact path.
  --no-human-review-cycle-completion-protected-approval-request-pack
                                  Do not include Human Review Cycle Receipt Completion Protected Approval Request Pack status.
  --human-review-cycle-completion-manual-revalidation <path>
                                  manual receipt revalidation artifact path.
  --no-human-review-cycle-completion-manual-revalidation
                                  Do not include Human Review Cycle Receipt Completion Manual Revalidation status.
  --human-review-cycle-completion-command-queue-patch-projection <path>
                                  command queue patch projection artifact path.
  --no-human-review-cycle-completion-command-queue-patch-projection
                                  Do not include Human Review Cycle Receipt Completion Command Queue Patch Projection status.
  --human-review-cycle-completion-closeout-ledger <path>
                                  closeout ledger artifact path.
  --no-human-review-cycle-completion-closeout-ledger
                                  Do not include Human Review Cycle Receipt Completion Closeout Ledger status.
  --human-review-v1-regression-freeze <path>
                                  human-review-v1-regression-freeze.json path.
  --no-human-review-v1-regression-freeze
                                  Do not include Human Review v1 Regression Freeze status.
  --control-plane-human-gate-receipt-validation <path>
                                  control-plane-human-gate-receipt-validation.json path.
  --no-control-plane-human-gate-receipt-validation
                                  Do not include Control Plane Human Gate Receipt Validation status.
  --control-plane-human-gate-receipt-application <path>
                                  control-plane-human-gate-receipt-application.json path.
  --no-control-plane-human-gate-receipt-application
                                  Do not include Control Plane Human Gate Receipt Application status.
  --control-plane-work-packets <path>
                                  control-plane-work-packets.json path.
  --no-control-plane-work-packets Do not include Control Plane Work Packets status.
  --control-plane-work-packet-receipts <path>
                                  control-plane-work-packet-receipt-drafts.json path.
  --no-control-plane-work-packet-receipts
                                  Do not include Control Plane Work Packet Receipts status.
  --control-plane-work-packet-receipt-validation <path>
                                  control-plane-work-packet-receipt-validation.json path.
  --no-control-plane-work-packet-receipt-validation
                                  Do not include Control Plane Work Packet Receipt Validation status.
  --control-plane-work-packet-receipt-application <path>
                                  control-plane-work-packet-receipt-application.json path.
  --no-control-plane-work-packet-receipt-application
                                  Do not include Control Plane Work Packet Receipt Application status.
  --law-firm-ldd-summary <path>  Law Firm LDD summary.json path.
  --no-law-firm-ldd-summary      Do not include Law Firm LDD slice status.
  --personal-dev-summary <path>  personal-dev summary.json path.
  --no-personal-dev-summary      Do not include personal-dev slice status.
  --creative-document-summary <path>
                                  Creative Document summary.json path.
  --no-creative-document-summary Do not include Creative Document slice status.
  --out-dir <folder>             Output directory.
  --run-at <iso>                 Deterministic generated_at timestamp.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}
