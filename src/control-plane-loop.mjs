import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR = "artifacts/control-plane-loop/latest";

export const DEFAULT_CONTROL_PLANE_LOOP_STEPS = [
  step("identity_model", "Identity Model", "identity", ["npm", "run", "contracts:identity"], ["artifacts/identity-model/latest/identity-model.json", "artifacts/identity-model/latest/actor-principals.json", "artifacts/identity-model/latest/role-assignments.json"]),
  step("policy_matrix_catalog", "Policy Matrix Catalog", "policy", ["npm", "run", "policy:catalog"], ["artifacts/policy-matrix/latest/policy-matrix-catalog.json"]),
  step("policy_snapshot_ledger", "Policy Snapshot Ledger", "policy", ["npm", "run", "policy:snapshots"], ["artifacts/policy-snapshots/latest/policy-snapshot-ledger.json"]),
  step("control_plane_pipeline", "Control Plane Pipeline", "pipeline", ["npm", "run", "control-plane:pipeline"], ["artifacts/control-plane-pipeline/latest/control-plane-pipeline.json"]),
  step("context_packet_ledger", "Context Packet Ledger", "context", ["npm", "run", "context:packets"], ["artifacts/context-packets/latest/context-packet-ledger.json"]),
  step("model_routing_ledger", "Model Routing Ledger", "runtime", ["npm", "run", "model:routing"], ["artifacts/model-routing/latest/model-routing-ledger.json"]),
  step("model_policy_enforcement", "Model Policy Enforcement", "gate", ["npm", "run", "contracts:model-policy"], ["artifacts/model-policy-enforcement/latest/model-policy-enforcement.json", "artifacts/model-policy-enforcement/latest/route-model-gates.json"]),
  step("tool_runtime_policy_enforcement", "Tool/Runtime Policy Enforcement", "gate", ["npm", "run", "contracts:tool-runtime"], ["artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json", "artifacts/tool-runtime-policy/latest/tool-permission-gates.json"]),
  step("output_destination_policy_enforcement", "Output Destination Policy Enforcement", "gate", ["npm", "run", "contracts:output-destination"], ["artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json", "artifacts/output-destination-policy/latest/final-action-separation-gates.json"]),
  step("approval_authority_ledger", "Approval Authority Ledger", "gate", ["npm", "run", "contracts:approval-authority"], ["artifacts/approval-authority/latest/approval-authority-ledger.json", "artifacts/approval-authority/latest/artifact-authority-decisions.json"]),
  step("cost_budget_ledger", "Cost Budget Ledger", "gate", ["npm", "run", "cost:budgets"], ["artifacts/cost-budget/latest/cost-budget-ledger.json"]),
  step("token_usage_ledger", "Token Usage Ledger", "observability", ["npm", "run", "token:usage"], ["artifacts/token-usage/latest/token-usage-ledger.json"]),
  step("cost_attribution_ledger", "Cost Attribution Ledger", "observability", ["npm", "run", "cost:attribution"], ["artifacts/cost-attribution/latest/cost-attribution-ledger.json"]),
  step("budget_alert_ledger", "Budget Alert Ledger", "observability", ["npm", "run", "budget:alerts"], ["artifacts/budget-alerts/latest/budget-alert-ledger.json"]),
  step("dashboard_pre_health", "Dashboard Pre-Health", "dashboard", ["node", "scripts/review-dashboard.mjs", "--no-contract-inventory", "--no-contract-dependency-map", "--no-schema-versioning-rules", "--no-schema-migration-manifest", "--no-contract-golden-fixtures", "--no-contract-validation-suite", "--no-resource-contract-freeze", "--no-matter-contract-freeze", "--no-client-counterparty-registry", "--no-matter-profile-team-ledger", "--no-wall-policy-contract", "--no-matter-access-policy", "--no-policy-contract-freeze", "--no-data-classification-rules", "--no-matter-tagging-ledger", "--no-access-audit-projection", "--no-store-policy-adapter", "--no-conflict-check-interface", "--no-personal-workspace-boundary", "--no-policy-golden-fixtures", "--no-policy-operations-surface", "--no-matter-boundary-slice", "--no-identity-policy-matter-freeze", "--no-model-policy-enforcement", "--no-tool-runtime-policy", "--no-output-destination-policy", "--no-approval-authority-ledger", "--no-policy-snapshot-bindings", "--no-evidence-contract-freeze", "--no-capability-workflow-contract-freeze", "--no-runtime-agentrun-contract-freeze", "--no-gate-approval-contract-freeze", "--no-output-delivery-contract-freeze", "--no-event-audit-run-contract-freeze", "--no-error-cost-observability-contract-freeze", "--no-human-review-agenda", "--no-human-review-agenda-intake", "--no-human-review-receipt-workspace", "--no-human-review-receipt-workspace-merge", "--no-human-review-context-bundle", "--no-human-review-decision-register", "--no-human-review-decision-register-merge", "--no-human-review-validation-feedback", "--no-human-review-correction-workspace", "--no-human-review-correction-workspace-merge", "--no-human-review-correction-validation", "--no-human-review-correction-feedback", "--no-human-review-cycle-ledger", "--no-human-review-cycle-work-orders", "--no-human-review-cycle-target-audit", "--no-human-review-cycle-triage", "--no-human-review-cycle-console", "--no-human-review-cycle-field-audit", "--no-human-review-cycle-completion-pack", "--no-human-review-cycle-completion-verification", "--no-human-review-cycle-completion-workbench", "--no-human-review-cycle-completion-runbook", "--no-human-review-cycle-completion-readiness", "--no-human-review-cycle-completion-command-queue", "--no-human-review-cycle-completion-command-receipts", "--no-human-review-cycle-completion-command-receipt-validation", "--no-human-review-cycle-completion-command-receipt-feedback", "--no-human-review-cycle-completion-command-receipt-workspace", "--no-human-review-cycle-completion-command-receipt-workspace-merge", "--no-human-review-cycle-completion-command-receipt-workspace-validation", "--no-human-review-cycle-completion-command-receipt-application", "--no-human-review-cycle-completion-reconciliation", "--no-human-review-cycle-completion-baseline", "--no-human-review-cycle-completion-manual-command-receipt-pack", "--no-human-review-cycle-completion-held-command-resolution", "--no-human-review-cycle-completion-protected-approval-request-pack", "--no-human-review-cycle-completion-manual-revalidation", "--no-human-review-cycle-completion-command-queue-patch-projection", "--no-human-review-cycle-completion-closeout-ledger", "--no-human-review-v1-regression-freeze"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("control_plane_health", "Control Plane Health", "health", ["npm", "run", "control-plane:health"], ["artifacts/control-plane-health/latest/control-plane-health.json"]),
  step("control_plane_action_plan", "Control Plane Action Plan", "planning", ["npm", "run", "control-plane:plan"], ["artifacts/control-plane-action-plan/latest/control-plane-action-plan.json"]),
  step("control_plane_human_gates", "Control Plane Human Gates", "planning", ["npm", "run", "control-plane:human-gates"], ["artifacts/control-plane-human-gates/latest/control-plane-human-gates.json"]),
  step("control_plane_human_gate_receipts", "Control Plane Human Gate Receipts", "receipt", ["npm", "run", "control-plane:human-gate-receipts"], ["artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json"]),
  step("human_review_packet_ledger", "Human Review Packet Ledger", "planning", ["npm", "run", "control-plane:review-packets"], ["artifacts/human-review-packets/latest/human-review-packet-ledger.json"]),
  step("human_review_agenda", "Human Review Agenda", "planning", ["npm", "run", "control-plane:review-agenda"], ["artifacts/human-review-agenda/latest/human-review-agenda.json"]),
  step("human_review_agenda_receipt_intake", "Human Review Agenda Receipt Intake", "receipt", ["npm", "run", "control-plane:review-agenda:intake"], ["artifacts/human-review-agenda-receipt-intake/latest/human-review-agenda-receipt-intake.json", "artifacts/human-review-agenda-receipt-intake/latest/receipt-input.json"]),
  step("human_review_receipt_workspace", "Human Review Receipt Workspace", "receipt", ["npm", "run", "control-plane:review-workspace"], ["artifacts/human-review-receipt-workspace/latest/human-review-receipt-workspace.json", "artifacts/human-review-receipt-workspace/latest/actor-workspaces.json"]),
  step("human_review_receipt_workspace_merge", "Human Review Receipt Workspace Merge", "receipt", ["npm", "run", "control-plane:review-workspace:merge"], ["artifacts/human-review-receipt-workspace-merge/latest/human-review-receipt-workspace-merge.json", "artifacts/human-review-receipt-workspace-merge/latest/receipt-input.json"]),
  step("human_review_context_bundle", "Human Review Context Bundle", "receipt", ["npm", "run", "control-plane:review-context"], ["artifacts/human-review-context-bundle/latest/human-review-context-bundle.json", "artifacts/human-review-context-bundle/latest/context-cards.json"]),
  step("human_review_decision_register", "Human Review Decision Register", "receipt", ["npm", "run", "control-plane:review-decisions"], ["artifacts/human-review-decision-register/latest/human-review-decision-register.json", "artifacts/human-review-decision-register/latest/receipt-input.json"]),
  step("human_review_decision_register_merge", "Human Review Decision Register Merge", "receipt", ["npm", "run", "control-plane:review-decisions:merge"], ["artifacts/human-review-decision-register-merge/latest/human-review-decision-register-merge.json", "artifacts/human-review-decision-register-merge/latest/receipt-input.json"]),
  step("control_plane_human_gate_receipt_validation", "Control Plane Human Gate Receipt Validation", "receipt", ["node", "scripts/control-plane-human-gate-receipt-validation.mjs", "--receipt-input", "artifacts/human-review-decision-register-merge/latest/receipt-input.json"], ["artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json"]),
  step("human_review_validation_feedback", "Human Review Validation Feedback", "receipt", ["npm", "run", "control-plane:review-feedback"], ["artifacts/human-review-validation-feedback/latest/human-review-validation-feedback.json", "artifacts/human-review-validation-feedback/latest/actor-feedback.json"]),
  step("human_review_correction_workspace", "Human Review Correction Workspace", "receipt", ["npm", "run", "control-plane:review-corrections"], ["artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json", "artifacts/human-review-correction-workspace/latest/actor-workspaces.json"]),
  step("human_review_correction_workspace_merge", "Human Review Correction Workspace Merge", "receipt", ["npm", "run", "control-plane:review-corrections:merge"], ["artifacts/human-review-correction-workspace-merge/latest/human-review-correction-workspace-merge.json", "artifacts/human-review-correction-workspace-merge/latest/receipt-input.json"]),
  step("human_review_correction_validation", "Human Review Correction Validation", "receipt", ["npm", "run", "control-plane:review-corrections:validate"], ["artifacts/human-review-correction-validation/latest/control-plane-human-gate-receipt-validation.json"]),
  step("human_review_correction_feedback", "Human Review Correction Feedback", "receipt", ["npm", "run", "control-plane:review-corrections:feedback"], ["artifacts/human-review-correction-feedback/latest/human-review-correction-feedback.json", "artifacts/human-review-correction-feedback/latest/actor-feedback.json"]),
  step("human_review_cycle_ledger", "Human Review Cycle Ledger", "receipt", ["npm", "run", "control-plane:review-cycle"], ["artifacts/human-review-cycle-ledger/latest/human-review-cycle-ledger.json", "artifacts/human-review-cycle-ledger/latest/actor-cycles.json"]),
  step("human_review_cycle_work_orders", "Human Review Cycle Work Orders", "receipt", ["npm", "run", "control-plane:review-cycle:work-orders"], ["artifacts/human-review-cycle-work-orders/latest/human-review-cycle-work-orders.json", "artifacts/human-review-cycle-work-orders/latest/actor-work-orders.json"]),
  step("human_review_cycle_target_audit", "Human Review Cycle Target Audit", "receipt", ["npm", "run", "control-plane:review-cycle:target-audit"], ["artifacts/human-review-cycle-work-order-target-audit/latest/human-review-cycle-work-order-target-audit.json", "artifacts/human-review-cycle-work-order-target-audit/latest/actor-target-audits.json"]),
  step("human_review_cycle_triage_inbox", "Human Review Cycle Triage Inbox", "receipt", ["npm", "run", "control-plane:review-cycle:triage"], ["artifacts/human-review-cycle-triage-inbox/latest/human-review-cycle-triage-inbox.json", "artifacts/human-review-cycle-triage-inbox/latest/actor-triage-inboxes.json"]),
  step("human_review_cycle_reviewer_console", "Human Review Cycle Reviewer Console", "receipt", ["npm", "run", "control-plane:review-cycle:console"], ["artifacts/human-review-cycle-reviewer-console/latest/human-review-cycle-reviewer-console.json", "artifacts/human-review-cycle-reviewer-console/latest/index.html"]),
  step("human_review_cycle_receipt_field_audit", "Human Review Cycle Receipt Field Audit", "receipt", ["npm", "run", "control-plane:review-cycle:field-audit"], ["artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json", "artifacts/human-review-cycle-receipt-field-audit/latest/actor-field-audits.json"]),
  step("human_review_cycle_receipt_completion_pack", "Human Review Cycle Receipt Completion Pack", "receipt", ["npm", "run", "control-plane:review-cycle:completion-pack"], ["artifacts/human-review-cycle-receipt-completion-pack/latest/human-review-cycle-receipt-completion-pack.json", "artifacts/human-review-cycle-receipt-completion-pack/latest/actor-completion-packs.json"]),
  step("human_review_cycle_receipt_completion_verification", "Human Review Cycle Receipt Completion Verification", "receipt", ["npm", "run", "control-plane:review-cycle:completion-verify"], ["artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json", "artifacts/human-review-cycle-receipt-completion-verification/latest/actor-verifications.json"]),
  step("human_review_cycle_receipt_completion_workbench", "Human Review Cycle Receipt Completion Workbench", "receipt", ["npm", "run", "control-plane:review-cycle:completion-workbench"], ["artifacts/human-review-cycle-receipt-completion-workbench/latest/human-review-cycle-receipt-completion-workbench.json", "artifacts/human-review-cycle-receipt-completion-workbench/latest/index.html"]),
  step("human_review_cycle_receipt_completion_runbook", "Human Review Cycle Receipt Completion Runbook", "receipt", ["npm", "run", "control-plane:review-cycle:completion-runbook"], ["artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json", "artifacts/human-review-cycle-receipt-completion-runbook/latest/index.html"]),
  step("human_review_cycle_receipt_completion_readiness", "Human Review Cycle Receipt Completion Readiness", "receipt", ["npm", "run", "control-plane:review-cycle:completion-readiness"], ["artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json", "artifacts/human-review-cycle-receipt-completion-readiness/latest/index.html"]),
  step("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-queue"], ["artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json", "artifacts/human-review-cycle-receipt-completion-command-queue/latest/index.html"]),
  step("human_review_cycle_receipt_completion_command_receipts", "Human Review Cycle Receipt Completion Command Receipts", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts"], ["artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json", "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-input-draft.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_validation", "Human Review Cycle Receipt Completion Command Receipt Validation", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:validate"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/validated-command-receipts.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_feedback", "Human Review Cycle Receipt Completion Command Receipt Feedback", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:feedback"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest/human-review-cycle-receipt-completion-command-receipt-feedback.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest/actor-feedback.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_workspace", "Human Review Cycle Receipt Completion Command Receipt Workspace", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:workspace"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/actor-workspaces.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_workspace_merge", "Human Review Cycle Receipt Completion Command Receipt Workspace Merge", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:workspace:merge"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/human-review-cycle-receipt-completion-command-receipt-workspace-merge.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/receipt-input.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_workspace_validation", "Human Review Cycle Receipt Completion Command Receipt Workspace Validation", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:workspace:validate"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/validated-command-receipts.json"]),
  step("human_review_cycle_receipt_completion_command_receipt_application", "Human Review Cycle Receipt Completion Command Receipt Application", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-receipts:apply"], ["artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/human-review-cycle-receipt-completion-command-receipt-application.json", "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/applied-command-receipts.json"]),
  step("human_review_cycle_receipt_completion_reconciliation", "Human Review Cycle Receipt Completion Reconciliation", "receipt", ["npm", "run", "control-plane:review-cycle:completion-reconcile"], ["artifacts/human-review-cycle-receipt-completion-reconciliation/latest/human-review-cycle-receipt-completion-reconciliation.json", "artifacts/human-review-cycle-receipt-completion-reconciliation/latest/reconciliation-items.json"]),
  step("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", "receipt", ["npm", "run", "control-plane:review-cycle:completion-baseline"], ["artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json", "artifacts/human-review-cycle-receipt-completion-baseline/latest/blocker-inventory.json"]),
  step("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human Review Cycle Receipt Completion Manual Command Receipt Pack", "receipt", ["npm", "run", "control-plane:review-cycle:completion-manual-command-receipt-pack"], ["artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json", "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/actor-receipt-packs.json"]),
  step("human_review_cycle_receipt_completion_held_command_resolution", "Human Review Cycle Receipt Completion Held Command Resolution", "receipt", ["npm", "run", "control-plane:review-cycle:completion-held-command-resolution"], ["artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json", "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/actor-resolution-plans.json"]),
  step("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human Review Cycle Receipt Completion Protected Approval Request Pack", "receipt", ["npm", "run", "control-plane:review-cycle:completion-protected-approval-request-pack"], ["artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json", "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/actor-approval-packs.json"]),
  step("human_review_cycle_receipt_completion_manual_revalidation", "Human Review Cycle Receipt Completion Manual Revalidation", "receipt", ["npm", "run", "control-plane:review-cycle:completion-manual-revalidation"], ["artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/human-review-cycle-receipt-completion-manual-revalidation.json", "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/ready-manual-receipts.json"]),
  step("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human Review Cycle Receipt Completion Command Queue Patch Projection", "receipt", ["npm", "run", "control-plane:review-cycle:completion-command-queue-patch-projection"], ["artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/human-review-cycle-receipt-completion-command-queue-patch-projection.json", "artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/audit-event-candidates.json"]),
  step("human_review_cycle_receipt_completion_closeout_ledger", "Human Review Cycle Receipt Completion Closeout Ledger", "receipt", ["npm", "run", "control-plane:review-cycle:completion-closeout-ledger"], ["artifacts/human-review-cycle-receipt-completion-closeout-ledger/latest/human-review-cycle-receipt-completion-closeout-ledger.json", "artifacts/human-review-cycle-receipt-completion-closeout-ledger/latest/actor-closeouts.json"]),
  step("human_review_v1_regression_freeze", "Human Review v1 Regression Freeze", "receipt", ["npm", "run", "control-plane:review-cycle:freeze"], ["artifacts/human-review-v1-regression-freeze/latest/human-review-v1-regression-freeze.json", "artifacts/human-review-v1-regression-freeze/latest/regression-fixture.json"]),
  step("contract_inventory", "Contract Inventory", "contracts", ["npm", "run", "contracts:inventory"], ["artifacts/contract-inventory/latest/contract-inventory.json", "artifacts/contract-inventory/latest/owner-map.json"]),
  step("contract_dependency_map", "Contract Dependency Map", "contracts", ["npm", "run", "contracts:dependencies"], ["artifacts/contract-dependency-map/latest/contract-dependency-map.json", "artifacts/contract-dependency-map/latest/dependency-graph.json"]),
  step("schema_versioning_rules", "Schema Versioning Rules", "contracts", ["npm", "run", "contracts:versioning"], ["artifacts/schema-versioning-rules/latest/schema-versioning-rules.json", "artifacts/schema-versioning-rules/latest/schema-versioning-guideline.json", "artifacts/schema-versioning-rules/latest/schema-version-records.json", "artifacts/schema-versioning-rules/latest/legacy-schema-exceptions.json"]),
  step("schema_migration_manifest", "Schema Migration Manifest", "contracts", ["npm", "run", "contracts:migrations"], ["artifacts/schema-migration-manifest/latest/schema-migration-manifest-ledger.json", "artifacts/schema-migration-manifest/latest/core-migration-manifest.json", "artifacts/schema-migration-manifest/latest/pack-migration-manifest.json", "artifacts/schema-migration-manifest/latest/index-migration-manifest.json", "artifacts/schema-migration-manifest/latest/migration-records.json"]),
  step("resource_contract_freeze", "Resource Contract Freeze", "contracts", ["npm", "run", "contracts:resources"], ["artifacts/resource-contract-freeze/latest/resource-contract-freeze.json", "artifacts/resource-contract-freeze/latest/resource-contract-v2-fixture.json", "artifacts/resource-contract-freeze/latest/resource-version-v2-fixture.json"]),
  step("matter_contract_freeze", "Matter Contract Freeze", "contracts", ["npm", "run", "contracts:matters"], ["artifacts/matter-contract-freeze/latest/matter-contract-freeze.json", "artifacts/matter-contract-freeze/latest/matter-contract-v2-fixture.json", "artifacts/matter-contract-freeze/latest/party-contract-v2-fixture.json"]),
  step("client_counterparty_registry", "Client/Counterparty Registry", "identity", ["npm", "run", "contracts:party-registry"], ["artifacts/client-counterparty-registry/latest/client-counterparty-registry.json", "artifacts/client-counterparty-registry/latest/client-registry.json", "artifacts/client-counterparty-registry/latest/counterparty-registry.json", "artifacts/client-counterparty-registry/latest/conflict-reference-index.json"]),
  step("matter_profile_team_ledger", "Matter Profile/Team Ledger", "identity", ["npm", "run", "contracts:matter-teams"], ["artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json", "artifacts/matter-profile-team-ledger/latest/matter-profiles.json", "artifacts/matter-profile-team-ledger/latest/matter-team-rosters.json", "artifacts/matter-profile-team-ledger/latest/matter-access-subjects.json"]),
  step("wall_policy_contract", "Wall Policy Contract", "identity", ["npm", "run", "contracts:walls"], ["artifacts/wall-policy-contract/latest/wall-policy-contract.json", "artifacts/wall-policy-contract/latest/wall-policy-rules.json", "artifacts/wall-policy-contract/latest/retrieval-wall-filters.json", "artifacts/wall-policy-contract/latest/conflict-wall-bindings.json"]),
  step("policy_contract_freeze", "Policy Contract Freeze", "contracts", ["npm", "run", "contracts:policies"], ["artifacts/policy-contract-freeze/latest/policy-contract-freeze.json", "artifacts/policy-contract-freeze/latest/data-classification-v2-fixture.json", "artifacts/policy-contract-freeze/latest/policy-reference-v2-fixture.json"]),
  step("evidence_contract_freeze", "Evidence Contract Freeze", "contracts", ["npm", "run", "contracts:evidence"], ["artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json", "artifacts/evidence-contract-freeze/latest/source-span-v2-fixture.json", "artifacts/evidence-contract-freeze/latest/citation-v2-fixture.json", "artifacts/evidence-contract-freeze/latest/lineage-edge-v2-fixture.json"]),
  step("capability_workflow_contract_freeze", "Capability Workflow Contract Freeze", "contracts", ["npm", "run", "contracts:capabilities"], ["artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json", "artifacts/capability-workflow-contract-freeze/latest/capability-manifest-v2-fixture.json", "artifacts/capability-workflow-contract-freeze/latest/workflow-v2-fixture.json", "artifacts/capability-workflow-contract-freeze/latest/capability-gate-runtime-contract-v2-fixture.json"]),
  step("runtime_agentrun_contract_freeze", "Runtime AgentRun Contract Freeze", "contracts", ["npm", "run", "contracts:runtimes"], ["artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json", "artifacts/runtime-agentrun-contract-freeze/latest/runtime-adapter-v2-fixture.json", "artifacts/runtime-agentrun-contract-freeze/latest/agent-run-runtime-v2-fixture.json", "artifacts/runtime-agentrun-contract-freeze/latest/runtime-verification-contract-v2-fixture.json"]),
  step("matter_access_policy_evaluator", "Matter Access Policy Evaluator", "identity", ["npm", "run", "contracts:matter-access"], ["artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json", "artifacts/matter-access-policy/latest/matter-access-decisions.json", "artifacts/matter-access-policy/latest/resource-access-decisions.json", "artifacts/matter-access-policy/latest/runtime-access-matrix.json"]),
  step("data_classification_rule_engine", "Data Classification Rule Engine", "identity", ["npm", "run", "contracts:classification-rules"], ["artifacts/data-classification-rules/latest/data-classification-rule-engine.json", "artifacts/data-classification-rules/latest/classification-rules.json", "artifacts/data-classification-rules/latest/resource-classification-decisions.json", "artifacts/data-classification-rules/latest/classification-policy-bindings.json"]),
  step("matter_tagging_decision_ledger", "Matter Tagging Decision Ledger", "identity", ["npm", "run", "contracts:matter-tagging"], ["artifacts/matter-tagging/latest/matter-tagging-ledger.json", "artifacts/matter-tagging/latest/matter-tagging-decisions.json", "artifacts/matter-tagging/latest/matter-tagging-confirmations.json"]),
  step("access_audit_projection", "Access Audit Projection", "identity", ["npm", "run", "contracts:access-audit"], ["artifacts/access-audit/latest/access-audit-projection.json", "artifacts/access-audit/latest/access-audit-records.json", "artifacts/access-audit/latest/actor-access-rollups.json", "artifacts/access-audit/latest/resource-access-rollups.json"]),
  step("store_policy_adapter", "Store Policy Adapter", "identity", ["npm", "run", "contracts:store-policy"], ["artifacts/store-policy/latest/store-policy-adapter.json", "artifacts/store-policy/latest/store-query-plans.json", "artifacts/store-policy/latest/enforcement-probes.json"]),
  step("conflict_check_interface", "Conflict Check Interface", "identity", ["npm", "run", "contracts:conflict-check"], ["artifacts/conflict-check/latest/conflict-check-interface.json", "artifacts/conflict-check/latest/conflict-check-requests.json", "artifacts/conflict-check/latest/conflict-check-results.json", "artifacts/conflict-check/latest/conflict-signals.json"]),
  step("personal_workspace_boundary", "Personal Workspace Boundary", "identity", ["npm", "run", "contracts:personal-boundary"], ["artifacts/personal-workspace-boundary/latest/personal-workspace-boundary.json", "artifacts/personal-workspace-boundary/latest/workspace-boundaries.json", "artifacts/personal-workspace-boundary/latest/search-namespace-policies.json", "artifacts/personal-workspace-boundary/latest/cross-workspace-probes.json"]),
  step("policy_golden_fixtures", "Policy Golden Fixtures", "identity", ["npm", "run", "contracts:policy-golden"], ["artifacts/policy-golden-fixtures/latest/policy-golden-fixtures.json", "artifacts/policy-golden-fixtures/latest/policy-fixture-cases.json", "artifacts/policy-golden-fixtures/latest/policy-regression-manifest.json"]),
  step("policy_operations_surface", "Policy Operations Surface", "identity", ["npm", "run", "policy:surface"], ["artifacts/policy-operations-surface/latest/policy-operations-surface.json", "artifacts/policy-operations-surface/latest/policy-decision-rows.json", "artifacts/policy-operations-surface/latest/policy-violation-rows.json", "artifacts/policy-operations-surface/latest/policy-pending-approval-rows.json"]),
  step("matter_boundary_slice", "Matter Boundary Slice", "identity", ["npm", "run", "matter-boundary:slice"], ["artifacts/matter-boundary-slice/latest/matter-boundary-slice.json", "artifacts/matter-boundary-slice/latest/resource-boundary-paths.json", "artifacts/matter-boundary-slice/latest/retrieval-gate-checks.json"]),
  step("identity_policy_matter_freeze", "Identity/Policy/Matter Freeze", "identity", ["npm", "run", "identity-policy:freeze"], ["artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json", "artifacts/identity-policy-matter-freeze/latest/freeze-source-statuses.json", "artifacts/identity-policy-matter-freeze/latest/freeze-checkpoints.json"]),
  step("gate_approval_contract_freeze", "Gate Approval Contract Freeze", "contracts", ["npm", "run", "contracts:gates"], ["artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json", "artifacts/gate-approval-contract-freeze/latest/gate-result-v2-fixture.json", "artifacts/gate-approval-contract-freeze/latest/approval-request-v2-fixture.json", "artifacts/gate-approval-contract-freeze/latest/gate-approval-binding-v2-fixture.json"]),
  step("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "contracts", ["npm", "run", "contracts:outputs"], ["artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json", "artifacts/output-delivery-contract-freeze/latest/output-artifact-v2-fixture.json", "artifacts/output-delivery-contract-freeze/latest/delivery-action-v2-fixture.json", "artifacts/output-delivery-contract-freeze/latest/output-delivery-binding-v2-fixture.json"]),
  step("control_plane_human_gate_receipt_application", "Control Plane Human Gate Receipt Application", "receipt", ["npm", "run", "control-plane:human-gate-receipts:apply"], ["artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json"]),
  step("control_plane_work_packets", "Control Plane Work Packets", "planning", ["npm", "run", "control-plane:work-packets"], ["artifacts/control-plane-work-packets/latest/control-plane-work-packets.json"]),
  step("control_plane_work_packet_receipts", "Control Plane Work Packet Receipts", "receipt", ["npm", "run", "control-plane:work-receipts"], ["artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json"]),
  step("control_plane_work_packet_receipt_validation", "Control Plane Work Packet Receipt Validation", "receipt", ["npm", "run", "control-plane:work-receipts:validate"], ["artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json"]),
  step("control_plane_work_packet_receipt_application", "Control Plane Work Packet Receipt Application", "receipt", ["npm", "run", "control-plane:work-receipts:apply"], ["artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json"]),
  step("control_plane_audit_trail", "Control Plane Audit Trail", "audit", ["npm", "run", "control-plane:audit-trail"], ["artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json"]),
  step("event_audit_run_contract_freeze", "Event Audit Run Contract Freeze", "contracts", ["npm", "run", "contracts:events"], ["artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json", "artifacts/event-audit-run-contract-freeze/latest/event-record-v2-fixture.json", "artifacts/event-audit-run-contract-freeze/latest/run-ledger-v2-fixture.json", "artifacts/event-audit-run-contract-freeze/latest/event-run-binding-v2-fixture.json"]),
  step("policy_snapshot_binding_ledger", "Policy Snapshot Binding Ledger", "policy", ["npm", "run", "contracts:policy-bindings"], ["artifacts/policy-snapshot-bindings/latest/policy-snapshot-binding-ledger.json", "artifacts/policy-snapshot-bindings/latest/workflow-policy-bindings.json", "artifacts/policy-snapshot-bindings/latest/event-policy-bindings.json"]),
  step("error_cost_observability_contract_freeze", "Error Cost Observability Contract Freeze", "contracts", ["npm", "run", "contracts:observability"], ["artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json", "artifacts/error-cost-observability-contract-freeze/latest/error-record-v2-fixture.json", "artifacts/error-cost-observability-contract-freeze/latest/cost-observation-v2-fixture.json", "artifacts/error-cost-observability-contract-freeze/latest/trace-projection-v2-fixture.json"]),
  step("contract_golden_fixtures", "Contract Golden Fixtures", "contracts", ["npm", "run", "contracts:golden-fixtures"], ["artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json", "artifacts/contract-golden-fixtures/latest/golden-fixture-manifest.json", "artifacts/contract-golden-fixtures/latest/regression-hash-manifest.json", "artifacts/contract-golden-fixtures/latest/validation-report.json"]),
  step("contract_validation_suite", "Contract Validation Suite", "contracts", ["npm", "run", "contracts:validate"], ["artifacts/contract-validation-suite/latest/contract-validation-suite.json", "artifacts/contract-validation-suite/latest/fixture-validation-results.json", "artifacts/contract-validation-suite/latest/validation-command-manifest.json", "artifacts/contract-validation-suite/latest/validation-report.json"]),
  step("evidence_review_draft", "Evidence Review Draft", "evidence_review", ["npm", "run", "evidence:review:draft"], ["artifacts/evidence-review-draft/latest/evidence-review-draft.json"]),
  step("dashboard_before_checkpoint", "Dashboard Before Goal Checkpoint", "dashboard", ["node", "scripts/review-dashboard.mjs", "--no-control-plane-goal-checkpoint"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("control_plane_goal_checkpoint", "Control Plane Goal Checkpoint", "checkpoint", ["npm", "run", "control-plane:goal-checkpoint"], ["artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json"]),
  step("dashboard_final", "Dashboard Final", "dashboard", ["npm", "run", "dashboard:build"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("api_smoke", "Review API Smoke", "api", ["npm", "run", "api:smoke"], []),
];

export const DEFAULT_CONTROL_PLANE_LOOP_FINALIZATION_STEPS = [
  step("goal_checkpoint_after_loop", "Goal Checkpoint After Loop", "finalization", ["npm", "run", "control-plane:goal-checkpoint"], ["artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json"]),
  step("dashboard_after_loop", "Dashboard After Loop", "finalization", ["npm", "run", "dashboard:build"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("api_smoke_after_loop", "API Smoke After Loop", "finalization", ["npm", "run", "api:smoke"], []),
];

export async function runControlPlaneLoop(options = {}) {
  const result = await buildControlPlaneLoop(options);
  if (options.write !== false) await writeControlPlaneLoop(result, result.output_dir);
  return result;
}

export async function runControlPlaneLoopFinalization(options = {}) {
  const result = await buildControlPlaneLoopFinalization(options);
  if (options.write !== false) await writeControlPlaneLoopFinalization(result, result.output_dir);
  return result;
}

export async function buildControlPlaneLoop(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const continueOnError = options.continueOnError ?? true;
  const writeProgress = options.writeProgress ?? options.write !== false;
  const steps = normalizeSteps(options.steps ?? DEFAULT_CONTROL_PLANE_LOOP_STEPS);
  const stepResults = [];
  let previousFailure = false;

  for (const loopStep of steps) {
    if (previousFailure && !continueOnError) {
      stepResults.push(buildSkippedStepResult(loopStep, cwd, "skipped_after_failure"));
    } else {
      const result = await runLoopStep(loopStep, { cwd });
      stepResults.push(result);
      if (result.status !== "passed") previousFailure = true;
    }

    if (writeProgress) {
      await writeControlPlaneLoop(buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults }));
    }
  }

  return buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults });
}

export async function writeControlPlaneLoop(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-loop.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    loop_id: result.loop_id,
    output_dir: result.output_dir,
    cwd: result.cwd,
    continue_on_error: result.continue_on_error,
    loop_status: result.loop_status,
    summary: result.summary,
    step_results: result.step_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function buildControlPlaneLoopFinalization(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const steps = normalizeSteps(options.steps ?? DEFAULT_CONTROL_PLANE_LOOP_FINALIZATION_STEPS);
  const stepResults = [];

  for (const finalizationStep of steps) {
    stepResults.push(await runLoopStep(finalizationStep, { cwd }));
  }

  return buildFinalizationArtifact({ generatedAt, outputDir, cwd, stepResults });
}

export async function writeControlPlaneLoopFinalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-loop-finalization.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    finalization_id: result.finalization_id,
    output_dir: result.output_dir,
    cwd: result.cwd,
    finalization_status: result.finalization_status,
    summary: result.summary,
    step_results: result.step_results,
  });
  await writeFile(path.join(outDir, "finalization-summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneLoopCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneLoop(args);
  const finalization = args.finalize
    ? await runControlPlaneLoopFinalization({
      outDir: args.outDir,
      cwd: args.cwd,
      runAt: args.runAt,
    })
    : null;
  console.log(`Control plane loop written to ${result.output_dir}`);
  console.log(`Loop status: ${result.loop_status}`);
  console.log(`Passed steps: ${result.summary.passed_step_count}/${result.summary.step_count}`);
  console.log(`Failed steps: ${result.summary.failed_step_count}`);
  if (finalization) {
    console.log(`Finalization status: ${finalization.finalization_status}`);
    console.log(`Finalization steps: ${finalization.summary.passed_step_count}/${finalization.summary.step_count}`);
  }
  if (
    result.summary.failed_step_count > 0
    || result.summary.missing_artifact_count > 0
    || (finalization && (finalization.summary.failed_step_count > 0 || finalization.summary.missing_artifact_count > 0))
  ) {
    process.exitCode = 1;
  }
}

function buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults }) {
  const summary = summarizeLoop(stepResults);
  const loop = {
    schema_version: "control-plane-loop.v1",
    generated_at: generatedAt,
    loop_id: `control-plane-loop.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cwd,
    continue_on_error: continueOnError,
    loop_status: summary.overall_status,
    summary,
    step_results: stepResults,
  };

  return {
    ...loop,
    markdown: renderLoopMarkdown(loop),
  };
}

function buildFinalizationArtifact({ generatedAt, outputDir, cwd, stepResults }) {
  const summary = summarizeLoop(stepResults);
  const finalization = {
    schema_version: "control-plane-loop-finalization.v1",
    generated_at: generatedAt,
    finalization_id: `control-plane-loop-finalization.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cwd,
    finalization_status: summary.overall_status,
    summary,
    step_results: stepResults,
  };

  return {
    ...finalization,
    markdown: renderFinalizationMarkdown(finalization),
  };
}

async function runLoopStep(loopStep, context) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const execution = await runCommand(loopStep.command, {
    cwd: context.cwd,
    timeoutMs: loopStep.timeout_ms,
  });
  const completedAtMs = Date.now();
  const artifactChecks = await checkArtifacts(loopStep.expected_artifacts, context.cwd);
  const missingArtifacts = artifactChecks.filter((artifact) => !artifact.exists);
  const commandPassed = execution.exit_code === 0 && !execution.signal;
  const status = commandPassed && missingArtifacts.length === 0 ? "passed" : commandPassed ? "artifact_missing" : "failed";

  return {
    step_id: loopStep.step_id,
    label: loopStep.label,
    category: loopStep.category,
    status,
    command: loopStep.command,
    cwd: context.cwd,
    protected_action: loopStep.protected_action,
    started_at: startedAt,
    completed_at: new Date(completedAtMs).toISOString(),
    duration_ms: completedAtMs - startedAtMs,
    exit_code: execution.exit_code,
    signal: execution.signal,
    stdout: execution.stdout,
    stderr: execution.stderr,
    expected_artifacts: artifactChecks,
    error: status === "passed"
      ? null
      : commandPassed
        ? `Missing expected artifact(s): ${missingArtifacts.map((artifact) => artifact.path).join(", ")}`
        : `Command exited with ${execution.exit_code ?? execution.signal}`,
  };
}

function buildSkippedStepResult(loopStep, cwd, reason) {
  const now = new Date().toISOString();
  return {
    step_id: loopStep.step_id,
    label: loopStep.label,
    category: loopStep.category,
    status: "skipped",
    command: loopStep.command,
    cwd,
    protected_action: loopStep.protected_action,
    started_at: now,
    completed_at: now,
    duration_ms: 0,
    exit_code: null,
    signal: null,
    stdout: "",
    stderr: "",
    expected_artifacts: loopStep.expected_artifacts.map((artifactPath) => ({
      path: path.resolve(cwd, artifactPath),
      exists: false,
    })),
    error: reason,
  };
}

function summarizeLoop(stepResults) {
  const failedStepCount = stepResults.filter((result) => result.status === "failed").length;
  const missingArtifactCount = stepResults.reduce(
    (count, result) => count + result.expected_artifacts.filter((artifact) => !artifact.exists).length,
    0,
  );
  const skippedStepCount = stepResults.filter((result) => result.status === "skipped").length;
  const artifactMissingStepCount = stepResults.filter((result) => result.status === "artifact_missing").length;
  const overallStatus = failedStepCount > 0
    ? "failed"
    : artifactMissingStepCount > 0 || missingArtifactCount > 0
      ? "artifact_missing"
      : skippedStepCount > 0
        ? "partial"
        : "passed";
  return {
    overall_status: overallStatus,
    step_count: stepResults.length,
    passed_step_count: stepResults.filter((result) => result.status === "passed").length,
    failed_step_count: failedStepCount,
    skipped_step_count: skippedStepCount,
    artifact_missing_step_count: artifactMissingStepCount,
    missing_artifact_count: missingArtifactCount,
    protected_action_count: stepResults.filter((result) => result.protected_action).length,
    total_duration_ms: stepResults.reduce((sum, result) => sum + result.duration_ms, 0),
    by_status: countBy(stepResults, "status"),
    by_category: countBy(stepResults, "category"),
  };
}

function renderLoopMarkdown(loop) {
  const lines = [];
  lines.push("# Control Plane Loop");
  lines.push("");
  lines.push(`Generated: ${loop.generated_at}`);
  lines.push(`Loop status: ${loop.loop_status}`);
  lines.push("");
  lines.push(`- Steps: ${loop.summary.step_count}`);
  lines.push(`- Passed: ${loop.summary.passed_step_count}`);
  lines.push(`- Failed: ${loop.summary.failed_step_count}`);
  lines.push(`- Missing artifacts: ${loop.summary.missing_artifact_count}`);
  lines.push(`- Duration ms: ${loop.summary.total_duration_ms}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const result of loop.step_results) {
    lines.push(`- ${result.step_id}: ${result.status} (${result.duration_ms}ms)`);
  }
  return `${lines.join("\n")}\n`;
}

function renderFinalizationMarkdown(finalization) {
  const lines = [];
  lines.push("# Control Plane Loop Finalization");
  lines.push("");
  lines.push(`Generated: ${finalization.generated_at}`);
  lines.push(`Finalization status: ${finalization.finalization_status}`);
  lines.push("");
  lines.push(`- Steps: ${finalization.summary.step_count}`);
  lines.push(`- Passed: ${finalization.summary.passed_step_count}`);
  lines.push(`- Failed: ${finalization.summary.failed_step_count}`);
  lines.push(`- Missing artifacts: ${finalization.summary.missing_artifact_count}`);
  lines.push(`- Duration ms: ${finalization.summary.total_duration_ms}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const result of finalization.step_results) {
    lines.push(`- ${result.step_id}: ${result.status} (${result.duration_ms}ms)`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeSteps(steps) {
  return steps.map((candidate) => ({
    step_id: candidate.step_id,
    label: candidate.label ?? candidate.step_id,
    category: candidate.category ?? "control_plane_loop",
    command: Array.isArray(candidate.command) ? candidate.command.map(String) : splitCommand(candidate.command),
    expected_artifacts: (candidate.expected_artifacts ?? []).map(String),
    timeout_ms: Number(candidate.timeout_ms ?? 120000),
    protected_action: Boolean(candidate.protected_action ?? false),
  }));
}

function step(stepId, label, category, command, expectedArtifacts = []) {
  return {
    step_id: stepId,
    label,
    category,
    command,
    expected_artifacts: expectedArtifacts,
    timeout_ms: 120000,
    protected_action: false,
  };
}

function runCommand(command, options) {
  const [bin, ...args] = command;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exit_code: 1,
        signal: null,
        stdout: trimOutput(stdout),
        stderr: trimOutput(`${stderr}${stderr ? "\n" : ""}${error.message}`),
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exit_code: code,
        signal,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
      });
    });
  });
}

async function checkArtifacts(expectedArtifacts, cwd) {
  const checks = [];
  for (const artifactPath of expectedArtifacts) {
    const resolvedPath = path.resolve(cwd, artifactPath);
    checks.push({
      path: resolvedPath,
      exists: await exists(resolvedPath),
    });
  }
  return checks;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function splitCommand(command) {
  if (!command) throw new Error("Loop step command is required.");
  return String(command).split(/\s+/).filter(Boolean);
}

function trimOutput(value, maxLength = 6000) {
  const text = String(value ?? "").trimEnd();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n... truncated ...`;
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

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR,
    continueOnError: true,
    finalize: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--cwd") parsed.cwd = argv[++index];
    else if (arg === "--fail-fast") parsed.continueOnError = false;
    else if (arg === "--continue-on-error") parsed.continueOnError = true;
    else if (arg === "--finalize") parsed.finalize = true;
    else if (arg === "--no-finalize") parsed.finalize = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-loop.mjs [options]

Options:
  --out-dir <folder>       Output directory.
  --cwd <folder>           Repository root to run commands in.
  --run-at <iso>           Deterministic generated_at timestamp.
  --continue-on-error      Continue running later steps after a failed step.
  --fail-fast              Skip later steps after the first failure.
  --finalize               Refresh checkpoint, dashboard, and API smoke after the loop.
  --no-finalize            Skip post-loop artifact refresh.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
