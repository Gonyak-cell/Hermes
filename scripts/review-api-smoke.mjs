#!/usr/bin/env node
import assert from "node:assert/strict";
import { startReviewApiServer } from "../src/review-api.mjs";

const args = parseArgs(process.argv.slice(2));
const { server, url } = await startReviewApiServer({
  ...args,
  port: 0,
});

try {
  const health = await fetchJson(`${url}/health`);
  assert.equal(health.status, "ok");
  assert.equal(health.dashboard_available, true);

  const index = await fetchJson(`${url}/api`);
  assert.equal(index.schema_version, "review-api-index.v1");
  assert.ok(index.routes.some((route) => route.path === "/api/dashboard"));
  assert.ok(index.routes.some((route) => route.path === "/api/packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capabilities"));
  assert.ok(index.routes.some((route) => route.path === "/api/artifacts"));
  assert.ok(index.routes.some((route) => route.path === "/api/runs"));
  assert.ok(index.routes.some((route) => route.path === "/api/events"));
  assert.ok(index.routes.some((route) => route.path === "/api/costs"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-trails"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-events"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-matrices"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-classifications"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshots"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-instances"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-usages"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packet-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-retrieval-filters"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-routing-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-routing-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-budget-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-budget-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/token-usage-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/token-usage-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-attribution-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-attribution-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/budget-alert-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/budget-alert-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-review-drafts"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-review-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-actions"));
  assert.ok(index.routes.some((route) => route.path === "/api/matters"));
  assert.ok(index.routes.some((route) => route.path === "/api/approvals"));
  assert.ok(index.routes.some((route) => route.path === "/api/approval-inbox-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-execution-candidates"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-execution-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-receipt-events"));
  assert.ok(index.routes.some((route) => route.path === "/api/post-delivery-matters"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivered-artifacts"));
  assert.ok(index.routes.some((route) => route.path === "/api/outstanding-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-closeout-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/receipt-input-drafts"));
  assert.ok(index.routes.some((route) => route.path === "/api/closeout-receipt-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/closeout-receipt-errors"));
  assert.ok(index.routes.some((route) => route.path === "/api/validated-receipts-to-apply"));
  assert.ok(index.routes.some((route) => route.path === "/api/closeout-receipt-applications"));
  assert.ok(index.routes.some((route) => route.path === "/api/closeout-applied-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/pipeline-runs"));
  assert.ok(index.routes.some((route) => route.path === "/api/pipeline-steps"));
  assert.ok(index.routes.some((route) => route.path === "/api/control-plane-loops"));
  assert.ok(index.routes.some((route) => route.path === "/api/control-plane-loop-steps"));
  assert.ok(index.routes.some((route) => route.path === "/api/goal-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/goal-checkpoint-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/control-plane-health"));
  assert.ok(index.routes.some((route) => route.path === "/api/health-checks"));
  assert.ok(index.routes.some((route) => route.path === "/api/action-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/action-plan-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-requirements"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-drafts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-packet-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agendas"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agenda-sections"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agenda-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-template"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agenda-receipt-intakes"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agenda-receipt-intake-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-agenda-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-receipt-workspaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-workspaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-workspace-entries"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-receipt-workspace-merges"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-receipt-merge-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-merged-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-context-bundles"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-context-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-context-bundles"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-registers"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-rows"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-register-merges"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-decision-merge-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-merged-decision-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-errors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-validation-feedbacks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-feedback-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-feedback"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-workspaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-workspace-merges"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-merge-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-merge-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-merged-correction-receipt-input"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-validation-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-validation-errors"));
  assert.ok(index.routes.some((route) => route.path === "/api/validated-correction-human-gate-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-feedbacks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-feedback-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-correction-actor-feedback"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-cycles"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-work-orders"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-work-order-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-work-orders"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-target-audits"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-target-audit-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-target-audits"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-triage-inboxes"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-triage-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-triage-inboxes"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-reviewer-consoles"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-console-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-consoles"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-field-audits"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-field-audit-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-field-audits"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-verifications"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-verification-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-verifications"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-workbenches"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-workbench-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-workbenches"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-runbooks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-runbook-steps"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-runbooks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-readiness"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-readiness"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queues"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-commands"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-actor-completion-command-queues"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-requirements"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-drafts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-references"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-validation-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-errors"));
  assert.ok(index.routes.some((route) => route.path === "/api/validated-human-review-cycle-completion-command-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-feedbacks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-feedback-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-actor-feedback"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-actor-workspaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-baselines"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-baseline-blockers"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-baseline-count-checks"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-pack-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-pack-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolutions"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolution-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolution-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-request-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-requests"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidation-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidation-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-ready-manual-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/validated-human-gate-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-applications"));
  assert.ok(index.routes.some((route) => route.path === "/api/applied-human-gate-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/patched-human-gate-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/action-work-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/action-work-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/work-packet-receipt-requirements"));
  assert.ok(index.routes.some((route) => route.path === "/api/work-packet-receipt-drafts"));
  assert.ok(index.routes.some((route) => route.path === "/api/work-packet-receipt-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/work-packet-receipt-errors"));
  assert.ok(index.routes.some((route) => route.path === "/api/validated-work-packet-receipts"));
  assert.ok(index.routes.some((route) => route.path === "/api/work-packet-receipt-applications"));
  assert.ok(index.routes.some((route) => route.path === "/api/applied-work-packet-receipts"));

  const dashboard = await fetchJson(`${url}/api/dashboard`);
  assert.equal(dashboard.schema_version, "review-dashboard.v1");

  const stages = await fetchJson(`${url}/api/stages`);
  assert.equal(stages.collection, "stage_statuses");
  assert.ok(stages.count > 0);

  const actions = await fetchJson(`${url}/api/actions?limit=5`);
  assert.equal(actions.collection, "action_items");
  assert.ok(actions.count <= 5);

  const auditTrails = await fetchJson(`${url}/api/audit-trails?limit=1`);
  assert.equal(auditTrails.collection, "audit_trails");
  assert.ok(auditTrails.count <= 1);

  const auditEvents = await fetchJson(`${url}/api/audit-events?limit=5`);
  assert.equal(auditEvents.collection, "audit_events");
  assert.ok(auditEvents.count <= 5);

  const auditSources = await fetchJson(`${url}/api/audit-sources?available=true&limit=5`);
  assert.equal(auditSources.collection, "audit_sources");
  assert.ok(auditSources.count <= 5);

  const policyMatrices = await fetchJson(`${url}/api/policy-matrices?policy_status=valid&limit=1`);
  assert.equal(policyMatrices.collection, "policy_matrices");
  assert.ok(policyMatrices.count <= 1);

  const p3ModelPolicies = await fetchJson(`${url}/api/model-policies?classification=P3_PRIVILEGED`);
  assert.equal(p3ModelPolicies.collection, "model_policies");
  assert.ok(p3ModelPolicies.items.every((item) => item.external_model_policy === "forbidden"));

  const approvalToolPolicies = await fetchJson(`${url}/api/tool-policies?default_policy=approval_required&limit=5`);
  assert.equal(approvalToolPolicies.collection, "tool_policies");
  assert.ok(approvalToolPolicies.count <= 5);

  const blockingGatePolicies = await fetchJson(`${url}/api/gate-policies?blocking_by_default=true&limit=5`);
  assert.equal(blockingGatePolicies.collection, "gate_policies");
  assert.ok(blockingGatePolicies.count <= 5);

  const policySnapshotLedgers = await fetchJson(`${url}/api/policy-snapshot-ledgers?ledger_status=valid&limit=1`);
  assert.equal(policySnapshotLedgers.collection, "policy_snapshot_ledgers");
  assert.ok(policySnapshotLedgers.count <= 1);

  const lawFirmPolicySnapshots = await fetchJson(`${url}/api/policy-snapshots?policy_snapshot_id=policy.default.law_firm.v1&limit=5`);
  assert.equal(lawFirmPolicySnapshots.collection, "policy_snapshots");
  assert.ok(lawFirmPolicySnapshots.count <= 5);

  const p2PolicyDecisions = await fetchJson(`${url}/api/policy-decisions?classification=P2_CLIENT_CONFIDENTIAL&limit=5`);
  assert.equal(p2PolicyDecisions.collection, "policy_decisions");
  assert.ok(p2PolicyDecisions.count <= 5);

  const workflowPolicyUsages = await fetchJson(`${url}/api/policy-usages?usage_type=workflow_run&limit=5`);
  assert.equal(workflowPolicyUsages.collection, "policy_usages");
  assert.ok(workflowPolicyUsages.count <= 5);

  const contextPacketLedgers = await fetchJson(`${url}/api/context-packet-ledgers?ledger_status=valid&limit=1`);
  assert.equal(contextPacketLedgers.collection, "context_packet_ledgers");
  assert.ok(contextPacketLedgers.count <= 1);

  const contextPackets = await fetchJson(`${url}/api/context-packets?packet_status=ready&limit=5`);
  assert.equal(contextPackets.collection, "context_packets");
  assert.ok(contextPackets.count <= 5);

  const resourceContextItems = await fetchJson(`${url}/api/context-items?item_type=resource_metadata&limit=5`);
  assert.equal(resourceContextItems.collection, "context_items");
  assert.ok(resourceContextItems.count <= 5);

  const contextRetrievalFilters = await fetchJson(`${url}/api/context-retrieval-filters?filter_status=complete&limit=5`);
  assert.equal(contextRetrievalFilters.collection, "context_retrieval_filters");
  assert.ok(contextRetrievalFilters.count <= 5);

  const modelRoutingLedgers = await fetchJson(`${url}/api/model-routing-ledgers?ledger_status=valid&limit=1`);
  assert.equal(modelRoutingLedgers.collection, "model_routing_ledgers");
  assert.ok(modelRoutingLedgers.count <= 1);

  const modelRoutingDecisions = await fetchJson(`${url}/api/model-routing-decisions?route_status=ready&limit=5`);
  assert.equal(modelRoutingDecisions.collection, "model_routing_decisions");
  assert.ok(modelRoutingDecisions.count <= 5);

  const externalModelRoutes = await fetchJson(`${url}/api/model-routing-decisions?external_transfer=true&limit=5`);
  assert.equal(externalModelRoutes.collection, "model_routing_decisions");
  assert.ok(externalModelRoutes.count <= 5);

  const costBudgetLedgers = await fetchJson(`${url}/api/cost-budget-ledgers?ledger_status=valid&limit=1`);
  assert.equal(costBudgetLedgers.collection, "cost_budget_ledgers");
  assert.ok(costBudgetLedgers.count <= 1);

  const costBudgetDecisions = await fetchJson(`${url}/api/cost-budget-decisions?budget_status=passed&limit=5`);
  assert.equal(costBudgetDecisions.collection, "cost_budget_decisions");
  assert.ok(costBudgetDecisions.count <= 5);

  const tokenPendingBudgets = await fetchJson(`${url}/api/cost-budget-decisions?token_tracking_status=pending_records&limit=5`);
  assert.equal(tokenPendingBudgets.collection, "cost_budget_decisions");
  assert.ok(tokenPendingBudgets.count <= 5);

  const tokenUsageLedgers = await fetchJson(`${url}/api/token-usage-ledgers?ledger_status=valid&limit=1`);
  assert.equal(tokenUsageLedgers.collection, "token_usage_ledgers");
  assert.ok(tokenUsageLedgers.count <= 1);

  const estimatedTokenUsage = await fetchJson(`${url}/api/token-usage-records?tracking_status=estimated&limit=5`);
  assert.equal(estimatedTokenUsage.collection, "token_usage_records");
  assert.ok(estimatedTokenUsage.count <= 5);

  const codexTokenUsage = await fetchJson(`${url}/api/token-usage-records?runtime_id=codex&limit=5`);
  assert.equal(codexTokenUsage.collection, "token_usage_records");
  assert.ok(codexTokenUsage.count <= 5);

  const costAttributionLedgers = await fetchJson(`${url}/api/cost-attribution-ledgers?ledger_status=valid&limit=1`);
  assert.equal(costAttributionLedgers.collection, "cost_attribution_ledgers");
  assert.ok(costAttributionLedgers.count <= 1);

  const costAttributionRecords = await fetchJson(`${url}/api/cost-attribution-records?attribution_status=attributed&limit=5`);
  assert.equal(costAttributionRecords.collection, "cost_attribution_records");
  assert.ok(costAttributionRecords.count <= 5);

  const codexCostAttribution = await fetchJson(`${url}/api/cost-attribution-records?runtime_id=codex&limit=5`);
  assert.equal(codexCostAttribution.collection, "cost_attribution_records");
  assert.ok(codexCostAttribution.count <= 5);

  const budgetAlertLedgers = await fetchJson(`${url}/api/budget-alert-ledgers?ledger_status=valid&limit=1`);
  assert.equal(budgetAlertLedgers.collection, "budget_alert_ledgers");
  assert.ok(budgetAlertLedgers.count <= 1);

  const clearBudgetAlerts = await fetchJson(`${url}/api/budget-alert-records?alert_status=clear&limit=5`);
  assert.equal(clearBudgetAlerts.collection, "budget_alert_records");
  assert.ok(clearBudgetAlerts.count <= 5);

  const codexBudgetAlerts = await fetchJson(`${url}/api/budget-alert-records?runtime_id=codex&limit=5`);
  assert.equal(codexBudgetAlerts.collection, "budget_alert_records");
  assert.ok(codexBudgetAlerts.count <= 5);

  const evidenceReviewDrafts = await fetchJson(`${url}/api/evidence-review-drafts`);
  assert.equal(evidenceReviewDrafts.collection, "evidence_review_drafts");
  assert.equal(evidenceReviewDrafts.count, 1);

  const evidenceReviewItems = await fetchJson(`${url}/api/evidence-review-items?review_status=ready_for_review&limit=5`);
  assert.equal(evidenceReviewItems.collection, "evidence_review_items");
  assert.ok(evidenceReviewItems.count <= 5);

  const approvals = await fetchJson(`${url}/api/approvals?item_type=approval_request`);
  assert.equal(approvals.collection, "approval_items");
  assert.ok(approvals.count >= 1);

  const actionPlanItems = await fetchJson(`${url}/api/action-plan-items?requires_human=true&limit=5`);
  assert.equal(actionPlanItems.collection, "action_plan_items");
  assert.ok(actionPlanItems.count <= 5);

  const humanGates = await fetchJson(`${url}/api/human-gates`);
  assert.equal(humanGates.collection, "human_gates");
  assert.equal(humanGates.count, 1);

  const humanGateItems = await fetchJson(`${url}/api/human-gate-items?gate_type=evidence_decision&limit=5`);
  assert.equal(humanGateItems.collection, "human_gate_items");
  assert.ok(humanGateItems.count <= 5);

  const humanGateReceipts = await fetchJson(`${url}/api/human-gate-receipts`);
  assert.equal(humanGateReceipts.collection, "human_gate_receipts");
  assert.equal(humanGateReceipts.count, 1);

  const evidenceHumanGateReceiptRequirements = await fetchJson(`${url}/api/human-gate-receipt-requirements?gate_type=evidence_decision&limit=5`);
  assert.equal(evidenceHumanGateReceiptRequirements.collection, "human_gate_receipt_requirements");
  assert.ok(evidenceHumanGateReceiptRequirements.count <= 5);

  const pendingHumanGateReceiptDrafts = await fetchJson(`${url}/api/human-gate-receipt-drafts?receipt_status=pending&limit=5`);
  assert.equal(pendingHumanGateReceiptDrafts.collection, "human_gate_receipt_drafts");
  assert.ok(pendingHumanGateReceiptDrafts.count <= 5);

  const humanReviewPacketLedgers = await fetchJson(`${url}/api/human-review-packet-ledgers?review_status=pending_review&limit=1`);
  assert.equal(humanReviewPacketLedgers.collection, "human_review_packet_ledgers");
  assert.ok(humanReviewPacketLedgers.count <= 1);

  const attorneyReviewPackets = await fetchJson(`${url}/api/human-review-packets?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(attorneyReviewPackets.collection, "human_review_packets");
  assert.ok(attorneyReviewPackets.count <= 5);

  const evidenceHumanReviewItems = await fetchJson(`${url}/api/human-review-items?gate_type=evidence_decision&limit=5`);
  assert.equal(evidenceHumanReviewItems.collection, "human_review_items");
  assert.ok(evidenceHumanReviewItems.count <= 5);

  const humanReviewAgendas = await fetchJson(`${url}/api/human-review-agendas?agenda_status=pending_review&limit=1`);
  assert.equal(humanReviewAgendas.collection, "human_review_agendas");
  assert.ok(humanReviewAgendas.count <= 1);

  const humanReviewAgendaSections = await fetchJson(`${url}/api/human-review-agenda-sections?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewAgendaSections.collection, "human_review_agenda_sections");
  assert.ok(humanReviewAgendaSections.count <= 5);

  const humanReviewAgendaItems = await fetchJson(`${url}/api/human-review-agenda-items?agenda_status=pending_human_review&limit=5`);
  assert.equal(humanReviewAgendaItems.collection, "human_review_agenda_items");
  assert.ok(humanReviewAgendaItems.count <= 5);

  const humanReviewDecisionTemplate = await fetchJson(`${url}/api/human-review-decision-template?receipt_status=pending&limit=5`);
  assert.equal(humanReviewDecisionTemplate.collection, "human_review_decision_template");
  assert.ok(humanReviewDecisionTemplate.count <= 5);

  const humanReviewAgendaReceiptIntakes = await fetchJson(`${url}/api/human-review-agenda-receipt-intakes?intake_status=pending_receipts&limit=1`);
  assert.equal(humanReviewAgendaReceiptIntakes.collection, "human_review_agenda_receipt_intakes");
  assert.ok(humanReviewAgendaReceiptIntakes.count <= 1);

  const humanReviewAgendaReceiptIntakeItems = await fetchJson(`${url}/api/human-review-agenda-receipt-intake-items?intake_status=pending_receipt&limit=5`);
  assert.equal(humanReviewAgendaReceiptIntakeItems.collection, "human_review_agenda_receipt_intake_items");
  assert.ok(humanReviewAgendaReceiptIntakeItems.count <= 5);

  const humanReviewAgendaReceiptInput = await fetchJson(`${url}/api/human-review-agenda-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewAgendaReceiptInput.collection, "human_review_agenda_receipt_input");
  assert.ok(humanReviewAgendaReceiptInput.count <= 5);

  const humanReviewReceiptWorkspaces = await fetchJson(`${url}/api/human-review-receipt-workspaces?workspace_status=pending_human_review&limit=1`);
  assert.equal(humanReviewReceiptWorkspaces.collection, "human_review_receipt_workspaces");
  assert.ok(humanReviewReceiptWorkspaces.count <= 1);

  const humanReviewActorWorkspaces = await fetchJson(`${url}/api/human-review-actor-workspaces?workspace_status=pending_human_review&limit=5`);
  assert.equal(humanReviewActorWorkspaces.collection, "human_review_actor_workspaces");
  assert.ok(humanReviewActorWorkspaces.count <= 5);

  const humanReviewWorkspaceEntries = await fetchJson(`${url}/api/human-review-workspace-entries?receipt_status=pending&limit=5`);
  assert.equal(humanReviewWorkspaceEntries.collection, "human_review_workspace_entries");
  assert.ok(humanReviewWorkspaceEntries.count <= 5);

  const humanReviewReceiptWorkspaceMerges = await fetchJson(`${url}/api/human-review-receipt-workspace-merges?merge_status=pending_receipts&limit=1`);
  assert.equal(humanReviewReceiptWorkspaceMerges.collection, "human_review_receipt_workspace_merges");
  assert.ok(humanReviewReceiptWorkspaceMerges.count <= 1);

  const humanReviewReceiptMergeItems = await fetchJson(`${url}/api/human-review-receipt-merge-items?merge_status=pending_receipt&limit=5`);
  assert.equal(humanReviewReceiptMergeItems.collection, "human_review_receipt_merge_items");
  assert.ok(humanReviewReceiptMergeItems.count <= 5);

  const humanReviewMergedReceiptInput = await fetchJson(`${url}/api/human-review-merged-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewMergedReceiptInput.collection, "human_review_merged_receipt_input");
  assert.ok(humanReviewMergedReceiptInput.count <= 5);

  const humanReviewContextBundles = await fetchJson(`${url}/api/human-review-context-bundles?bundle_status=pending_human_review&limit=1`);
  assert.equal(humanReviewContextBundles.collection, "human_review_context_bundles");
  assert.ok(humanReviewContextBundles.count <= 1);

  const humanReviewContextCards = await fetchJson(`${url}/api/human-review-context-cards?context_status=ready&limit=5`);
  assert.equal(humanReviewContextCards.collection, "human_review_context_cards");
  assert.ok(humanReviewContextCards.count <= 5);

  const humanReviewActorContextBundles = await fetchJson(`${url}/api/human-review-actor-context-bundles?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorContextBundles.collection, "human_review_actor_context_bundles");
  assert.ok(humanReviewActorContextBundles.count <= 5);

  const humanReviewDecisionRegisters = await fetchJson(`${url}/api/human-review-decision-registers?register_status=pending_human_review&limit=1`);
  assert.equal(humanReviewDecisionRegisters.collection, "human_review_decision_registers");
  assert.ok(humanReviewDecisionRegisters.count <= 1);

  const humanReviewDecisionRows = await fetchJson(`${url}/api/human-review-decision-rows?decision_status=pending_decision&limit=5`);
  assert.equal(humanReviewDecisionRows.collection, "human_review_decision_rows");
  assert.ok(humanReviewDecisionRows.count <= 5);

  const humanReviewDecisionReceiptInput = await fetchJson(`${url}/api/human-review-decision-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewDecisionReceiptInput.collection, "human_review_decision_receipt_input");
  assert.ok(humanReviewDecisionReceiptInput.count <= 5);

  const humanReviewDecisionRegisterMerges = await fetchJson(`${url}/api/human-review-decision-register-merges?merge_status=pending_receipts&limit=1`);
  assert.equal(humanReviewDecisionRegisterMerges.collection, "human_review_decision_register_merges");
  assert.ok(humanReviewDecisionRegisterMerges.count <= 1);

  const humanReviewDecisionMergeItems = await fetchJson(`${url}/api/human-review-decision-merge-items?merge_status=pending_receipt&limit=5`);
  assert.equal(humanReviewDecisionMergeItems.collection, "human_review_decision_merge_items");
  assert.ok(humanReviewDecisionMergeItems.count <= 5);

  const humanReviewMergedDecisionReceiptInput = await fetchJson(`${url}/api/human-review-merged-decision-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewMergedDecisionReceiptInput.collection, "human_review_merged_decision_receipt_input");
  assert.ok(humanReviewMergedDecisionReceiptInput.count <= 5);

  const pendingHumanGateReceiptValidations = await fetchJson(`${url}/api/human-gate-receipt-validations?validation_status=pending_receipt&limit=5`);
  assert.equal(pendingHumanGateReceiptValidations.collection, "human_gate_receipt_validations");
  assert.ok(pendingHumanGateReceiptValidations.count <= 5);

  const humanGateReceiptErrors = await fetchJson(`${url}/api/human-gate-receipt-errors`);
  assert.equal(humanGateReceiptErrors.collection, "human_gate_receipt_errors");

  const humanReviewValidationFeedbacks = await fetchJson(`${url}/api/human-review-validation-feedbacks?feedback_status=pending_human_review&limit=1`);
  assert.equal(humanReviewValidationFeedbacks.collection, "human_review_validation_feedbacks");
  assert.ok(humanReviewValidationFeedbacks.count <= 1);

  const humanReviewFeedbackItems = await fetchJson(`${url}/api/human-review-feedback-items?feedback_status=needs_human_decision&limit=5`);
  assert.equal(humanReviewFeedbackItems.collection, "human_review_feedback_items");
  assert.ok(humanReviewFeedbackItems.count <= 5);

  const humanReviewActorFeedback = await fetchJson(`${url}/api/human-review-actor-feedback?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorFeedback.collection, "human_review_actor_feedback");
  assert.ok(humanReviewActorFeedback.count <= 5);

  const humanReviewCorrectionWorkspaces = await fetchJson(`${url}/api/human-review-correction-workspaces?workspace_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCorrectionWorkspaces.collection, "human_review_correction_workspaces");
  assert.ok(humanReviewCorrectionWorkspaces.count <= 1);

  const humanReviewCorrectionActors = await fetchJson(`${url}/api/human-review-correction-actors?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewCorrectionActors.collection, "human_review_correction_actors");
  assert.ok(humanReviewCorrectionActors.count <= 5);

  const humanReviewCorrectionItems = await fetchJson(`${url}/api/human-review-correction-items?correction_status=pending_decision&limit=5`);
  assert.equal(humanReviewCorrectionItems.collection, "human_review_correction_items");
  assert.ok(humanReviewCorrectionItems.count <= 5);

  const humanReviewCorrectionReceiptInput = await fetchJson(`${url}/api/human-review-correction-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewCorrectionReceiptInput.collection, "human_review_correction_receipt_input");
  assert.ok(humanReviewCorrectionReceiptInput.count <= 5);

  const humanReviewCorrectionWorkspaceMerges = await fetchJson(`${url}/api/human-review-correction-workspace-merges?merge_status=pending_receipts&limit=1`);
  assert.equal(humanReviewCorrectionWorkspaceMerges.collection, "human_review_correction_workspace_merges");
  assert.ok(humanReviewCorrectionWorkspaceMerges.count <= 1);

  const humanReviewCorrectionMergeActors = await fetchJson(`${url}/api/human-review-correction-merge-actors?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewCorrectionMergeActors.collection, "human_review_correction_merge_actors");
  assert.ok(humanReviewCorrectionMergeActors.count <= 5);

  const humanReviewCorrectionMergeItems = await fetchJson(`${url}/api/human-review-correction-merge-items?merge_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCorrectionMergeItems.collection, "human_review_correction_merge_items");
  assert.ok(humanReviewCorrectionMergeItems.count <= 5);

  const humanReviewMergedCorrectionReceiptInput = await fetchJson(`${url}/api/human-review-merged-correction-receipt-input?receipt_status=pending&limit=5`);
  assert.equal(humanReviewMergedCorrectionReceiptInput.collection, "human_review_merged_correction_receipt_input");
  assert.ok(humanReviewMergedCorrectionReceiptInput.count <= 5);

  const humanReviewCorrectionValidations = await fetchJson(`${url}/api/human-review-correction-validations?validation_status=pending_receipts&limit=1`);
  assert.equal(humanReviewCorrectionValidations.collection, "human_review_correction_validations");
  assert.ok(humanReviewCorrectionValidations.count <= 1);

  const humanReviewCorrectionValidationItems = await fetchJson(`${url}/api/human-review-correction-validation-items?validation_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCorrectionValidationItems.collection, "human_review_correction_validation_items");
  assert.ok(humanReviewCorrectionValidationItems.count <= 5);

  const humanReviewCorrectionValidationErrors = await fetchJson(`${url}/api/human-review-correction-validation-errors?limit=5`);
  assert.equal(humanReviewCorrectionValidationErrors.collection, "human_review_correction_validation_errors");
  assert.ok(humanReviewCorrectionValidationErrors.count <= 5);

  const validatedCorrectionHumanGateReceipts = await fetchJson(`${url}/api/validated-correction-human-gate-receipts`);
  assert.equal(validatedCorrectionHumanGateReceipts.collection, "validated_correction_human_gate_receipts");

  const humanReviewCorrectionFeedbacks = await fetchJson(`${url}/api/human-review-correction-feedbacks?feedback_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCorrectionFeedbacks.collection, "human_review_correction_feedbacks");
  assert.ok(humanReviewCorrectionFeedbacks.count <= 1);

  const humanReviewCorrectionFeedbackItems = await fetchJson(`${url}/api/human-review-correction-feedback-items?feedback_status=needs_human_decision&limit=5`);
  assert.equal(humanReviewCorrectionFeedbackItems.collection, "human_review_correction_feedback_items");
  assert.ok(humanReviewCorrectionFeedbackItems.count <= 5);

  const humanReviewCorrectionActorFeedback = await fetchJson(`${url}/api/human-review-correction-actor-feedback?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewCorrectionActorFeedback.collection, "human_review_correction_actor_feedback");
  assert.ok(humanReviewCorrectionActorFeedback.count <= 5);

  const humanReviewCycleLedgers = await fetchJson(`${url}/api/human-review-cycle-ledgers?cycle_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleLedgers.collection, "human_review_cycle_ledgers");
  assert.ok(humanReviewCycleLedgers.count <= 1);

  const humanReviewCycleItems = await fetchJson(`${url}/api/human-review-cycle-items?cycle_status=pending_human_review&limit=5`);
  assert.equal(humanReviewCycleItems.collection, "human_review_cycle_items");
  assert.ok(humanReviewCycleItems.count <= 5);

  const humanReviewActorCycles = await fetchJson(`${url}/api/human-review-actor-cycles?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCycles.collection, "human_review_actor_cycles");
  assert.ok(humanReviewActorCycles.count <= 5);

  const humanReviewCycleWorkOrders = await fetchJson(`${url}/api/human-review-cycle-work-orders?work_order_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleWorkOrders.collection, "human_review_cycle_work_orders");
  assert.ok(humanReviewCycleWorkOrders.count <= 1);

  const humanReviewCycleWorkOrderItems = await fetchJson(`${url}/api/human-review-cycle-work-order-items?work_order_status=pending_human_review&limit=5`);
  assert.equal(humanReviewCycleWorkOrderItems.collection, "human_review_cycle_work_order_items");
  assert.ok(humanReviewCycleWorkOrderItems.count <= 5);

  const humanReviewActorWorkOrders = await fetchJson(`${url}/api/human-review-actor-work-orders?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorWorkOrders.collection, "human_review_actor_work_orders");
  assert.ok(humanReviewActorWorkOrders.count <= 5);

  const humanReviewCycleTargetAudits = await fetchJson(`${url}/api/human-review-cycle-target-audits?target_audit_status=ready_for_human_review&limit=1`);
  assert.equal(humanReviewCycleTargetAudits.collection, "human_review_cycle_target_audits");
  assert.ok(humanReviewCycleTargetAudits.count <= 1);

  const humanReviewCycleTargetAuditItems = await fetchJson(`${url}/api/human-review-cycle-target-audit-items?target_audit_status=ready_for_human_review&limit=5`);
  assert.equal(humanReviewCycleTargetAuditItems.collection, "human_review_cycle_target_audit_items");
  assert.ok(humanReviewCycleTargetAuditItems.count <= 5);

  const humanReviewActorTargetAudits = await fetchJson(`${url}/api/human-review-actor-target-audits?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorTargetAudits.collection, "human_review_actor_target_audits");
  assert.ok(humanReviewActorTargetAudits.count <= 5);

  const humanReviewCycleTriageInboxes = await fetchJson(`${url}/api/human-review-cycle-triage-inboxes?triage_status=ready_for_human_review&limit=1`);
  assert.equal(humanReviewCycleTriageInboxes.collection, "human_review_cycle_triage_inboxes");
  assert.ok(humanReviewCycleTriageInboxes.count <= 1);

  const humanReviewCycleTriageItems = await fetchJson(`${url}/api/human-review-cycle-triage-items?triage_status=ready_for_human_review&limit=5`);
  assert.equal(humanReviewCycleTriageItems.collection, "human_review_cycle_triage_items");
  assert.ok(humanReviewCycleTriageItems.count <= 5);

  const humanReviewActorTriageInboxes = await fetchJson(`${url}/api/human-review-actor-triage-inboxes?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorTriageInboxes.collection, "human_review_actor_triage_inboxes");
  assert.ok(humanReviewActorTriageInboxes.count <= 5);

  const humanReviewCycleReviewerConsoles = await fetchJson(`${url}/api/human-review-cycle-reviewer-consoles?console_status=ready_for_human_review&limit=1`);
  assert.equal(humanReviewCycleReviewerConsoles.collection, "human_review_cycle_reviewer_consoles");
  assert.ok(humanReviewCycleReviewerConsoles.count <= 1);

  const humanReviewCycleConsoleItems = await fetchJson(`${url}/api/human-review-cycle-console-items?console_status=ready_for_human_review&limit=5`);
  assert.equal(humanReviewCycleConsoleItems.collection, "human_review_cycle_console_items");
  assert.ok(humanReviewCycleConsoleItems.count <= 5);

  const humanReviewActorConsoles = await fetchJson(`${url}/api/human-review-actor-consoles?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorConsoles.collection, "human_review_actor_consoles");
  assert.ok(humanReviewActorConsoles.count <= 5);

  const humanReviewCycleFieldAudits = await fetchJson(`${url}/api/human-review-cycle-field-audits?field_audit_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleFieldAudits.collection, "human_review_cycle_field_audits");
  assert.ok(humanReviewCycleFieldAudits.count <= 1);

  const humanReviewCycleFieldAuditItems = await fetchJson(`${url}/api/human-review-cycle-field-audit-items?field_audit_status=pending_human_review&limit=5`);
  assert.equal(humanReviewCycleFieldAuditItems.collection, "human_review_cycle_field_audit_items");
  assert.ok(humanReviewCycleFieldAuditItems.count <= 5);

  const humanReviewActorFieldAudits = await fetchJson(`${url}/api/human-review-actor-field-audits?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorFieldAudits.collection, "human_review_actor_field_audits");
  assert.ok(humanReviewActorFieldAudits.count <= 5);

  const humanReviewCycleCompletionPacks = await fetchJson(`${url}/api/human-review-cycle-completion-packs?completion_status=ready_for_human_input&limit=1`);
  assert.equal(humanReviewCycleCompletionPacks.collection, "human_review_cycle_completion_packs");
  assert.ok(humanReviewCycleCompletionPacks.count <= 1);

  const humanReviewCycleCompletionItems = await fetchJson(`${url}/api/human-review-cycle-completion-items?completion_status=ready_for_human_input&limit=5`);
  assert.equal(humanReviewCycleCompletionItems.collection, "human_review_cycle_completion_items");
  assert.ok(humanReviewCycleCompletionItems.count <= 5);

  const humanReviewActorCompletionPacks = await fetchJson(`${url}/api/human-review-actor-completion-packs?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionPacks.collection, "human_review_actor_completion_packs");
  assert.ok(humanReviewActorCompletionPacks.count <= 5);

  const humanReviewCycleCompletionVerifications = await fetchJson(`${url}/api/human-review-cycle-completion-verifications?verification_status=pending_human_input&limit=1`);
  assert.equal(humanReviewCycleCompletionVerifications.collection, "human_review_cycle_completion_verifications");
  assert.ok(humanReviewCycleCompletionVerifications.count <= 1);

  const humanReviewCycleCompletionVerificationItems = await fetchJson(`${url}/api/human-review-cycle-completion-verification-items?verification_status=pending_human_input&limit=5`);
  assert.equal(humanReviewCycleCompletionVerificationItems.collection, "human_review_cycle_completion_verification_items");
  assert.ok(humanReviewCycleCompletionVerificationItems.count <= 5);

  const humanReviewActorCompletionVerifications = await fetchJson(`${url}/api/human-review-actor-completion-verifications?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionVerifications.collection, "human_review_actor_completion_verifications");
  assert.ok(humanReviewActorCompletionVerifications.count <= 5);

  const humanReviewCycleCompletionWorkbenches = await fetchJson(`${url}/api/human-review-cycle-completion-workbenches?workbench_status=pending_human_input&limit=1`);
  assert.equal(humanReviewCycleCompletionWorkbenches.collection, "human_review_cycle_completion_workbenches");
  assert.ok(humanReviewCycleCompletionWorkbenches.count <= 1);

  const humanReviewCycleCompletionWorkbenchItems = await fetchJson(`${url}/api/human-review-cycle-completion-workbench-items?workbench_status=pending_human_input&limit=5`);
  assert.equal(humanReviewCycleCompletionWorkbenchItems.collection, "human_review_cycle_completion_workbench_items");
  assert.ok(humanReviewCycleCompletionWorkbenchItems.count <= 5);

  const humanReviewActorCompletionWorkbenches = await fetchJson(`${url}/api/human-review-actor-completion-workbenches?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionWorkbenches.collection, "human_review_actor_completion_workbenches");
  assert.ok(humanReviewActorCompletionWorkbenches.count <= 5);

  const humanReviewCycleCompletionRunbooks = await fetchJson(`${url}/api/human-review-cycle-completion-runbooks?runbook_status=pending_human_input&limit=1`);
  assert.equal(humanReviewCycleCompletionRunbooks.collection, "human_review_cycle_completion_runbooks");
  assert.ok(humanReviewCycleCompletionRunbooks.count <= 1);

  const humanReviewCycleCompletionRunbookSteps = await fetchJson(`${url}/api/human-review-cycle-completion-runbook-steps?step_status=pending_human_input&limit=5`);
  assert.equal(humanReviewCycleCompletionRunbookSteps.collection, "human_review_cycle_completion_runbook_steps");
  assert.ok(humanReviewCycleCompletionRunbookSteps.count <= 5);

  const humanReviewActorCompletionRunbooks = await fetchJson(`${url}/api/human-review-actor-completion-runbooks?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionRunbooks.collection, "human_review_actor_completion_runbooks");
  assert.ok(humanReviewActorCompletionRunbooks.count <= 5);

  const humanReviewCycleCompletionReadiness = await fetchJson(`${url}/api/human-review-cycle-completion-readiness?readiness_status=waiting_for_human_input&limit=1`);
  assert.equal(humanReviewCycleCompletionReadiness.collection, "human_review_cycle_completion_readiness");
  assert.ok(humanReviewCycleCompletionReadiness.count <= 1);

  const humanReviewCycleCompletionCommandGates = await fetchJson(`${url}/api/human-review-cycle-completion-command-gates?command_status=available_now&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandGates.collection, "human_review_cycle_completion_command_gates");
  assert.ok(humanReviewCycleCompletionCommandGates.count <= 5);

  const humanReviewActorCompletionReadiness = await fetchJson(`${url}/api/human-review-actor-completion-readiness?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionReadiness.collection, "human_review_actor_completion_readiness");
  assert.ok(humanReviewActorCompletionReadiness.count <= 5);

  const humanReviewCycleCompletionCommandQueues = await fetchJson(`${url}/api/human-review-cycle-completion-command-queues?queue_status=ready_with_holds&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandQueues.collection, "human_review_cycle_completion_command_queues");
  assert.ok(humanReviewCycleCompletionCommandQueues.count <= 1);

  const humanReviewCycleCompletionCommandQueueItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-queue-items?queue_status=ready_to_run_manually&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandQueueItems.collection, "human_review_cycle_completion_command_queue_items");
  assert.ok(humanReviewCycleCompletionCommandQueueItems.count <= 5);

  const humanReviewCycleCompletionHeldCommands = await fetchJson(`${url}/api/human-review-cycle-completion-held-commands?hold_status=held_until_manual_input&limit=5`);
  assert.equal(humanReviewCycleCompletionHeldCommands.collection, "human_review_cycle_completion_held_commands");
  assert.ok(humanReviewCycleCompletionHeldCommands.count <= 5);

  const humanReviewActorCompletionCommandQueues = await fetchJson(`${url}/api/human-review-actor-completion-command-queues?required_actor=attorney_or_designated_reviewer&limit=5`);
  assert.equal(humanReviewActorCompletionCommandQueues.collection, "human_review_actor_completion_command_queues");
  assert.ok(humanReviewActorCompletionCommandQueues.count <= 5);

  const humanReviewCycleCompletionCommandReceipts = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipts?receipt_status=pending_command_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceipts.collection, "human_review_cycle_completion_command_receipts");
  assert.ok(humanReviewCycleCompletionCommandReceipts.count <= 1);

  const humanReviewCycleCompletionCommandReceiptRequirements = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-requirements?command_kind=verification_refresh&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptRequirements.collection, "human_review_cycle_completion_command_receipt_requirements");
  assert.ok(humanReviewCycleCompletionCommandReceiptRequirements.count <= 5);

  const humanReviewCycleCompletionCommandReceiptDrafts = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-drafts?command_result=not_run&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptDrafts.collection, "human_review_cycle_completion_command_receipt_drafts");
  assert.ok(humanReviewCycleCompletionCommandReceiptDrafts.count <= 5);

  const humanReviewCycleCompletionHeldCommandReferences = await fetchJson(`${url}/api/human-review-cycle-completion-held-command-references?requires_explicit_human_approval=true&limit=5`);
  assert.equal(humanReviewCycleCompletionHeldCommandReferences.collection, "human_review_cycle_completion_held_command_references");
  assert.ok(humanReviewCycleCompletionHeldCommandReferences.count <= 5);

  const humanReviewCycleCompletionCommandReceiptValidations = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-validations?validation_status=pending_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptValidations.collection, "human_review_cycle_completion_command_receipt_validations");
  assert.ok(humanReviewCycleCompletionCommandReceiptValidations.count <= 1);

  const humanReviewCycleCompletionCommandReceiptValidationItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-validation-items?validation_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptValidationItems.collection, "human_review_cycle_completion_command_receipt_validation_items");
  assert.ok(humanReviewCycleCompletionCommandReceiptValidationItems.count <= 5);

  const humanReviewCycleCompletionCommandReceiptErrors = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-errors?limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptErrors.collection, "human_review_cycle_completion_command_receipt_errors");
  assert.ok(humanReviewCycleCompletionCommandReceiptErrors.count <= 5);

  const validatedHumanReviewCycleCompletionCommandReceipts = await fetchJson(`${url}/api/validated-human-review-cycle-completion-command-receipts?limit=5`);
  assert.equal(validatedHumanReviewCycleCompletionCommandReceipts.collection, "validated_human_review_cycle_completion_command_receipts");
  assert.ok(validatedHumanReviewCycleCompletionCommandReceipts.count <= 5);

  const humanReviewCycleCompletionCommandReceiptFeedbacks = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-feedbacks?feedback_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptFeedbacks.collection, "human_review_cycle_completion_command_receipt_feedbacks");
  assert.ok(humanReviewCycleCompletionCommandReceiptFeedbacks.count <= 1);

  const humanReviewCycleCompletionCommandReceiptFeedbackItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-feedback-items?feedback_status=needs_command_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptFeedbackItems.collection, "human_review_cycle_completion_command_receipt_feedback_items");
  assert.ok(humanReviewCycleCompletionCommandReceiptFeedbackItems.count <= 5);

  const humanReviewCycleCompletionCommandReceiptActorFeedback = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-actor-feedback?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptActorFeedback.collection, "human_review_cycle_completion_command_receipt_actor_feedback");
  assert.ok(humanReviewCycleCompletionCommandReceiptActorFeedback.count <= 5);

  const humanReviewCycleCompletionCommandReceiptWorkspaces = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspaces?workspace_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaces.collection, "human_review_cycle_completion_command_receipt_workspaces");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaces.count <= 1);

  const humanReviewCycleCompletionCommandReceiptWorkspaceItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspace-items?workspace_status=needs_command_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceItems.collection, "human_review_cycle_completion_command_receipt_workspace_items");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceItems.count <= 5);

  const humanReviewCycleCompletionCommandReceiptActorWorkspaces = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-actor-workspaces?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptActorWorkspaces.collection, "human_review_cycle_completion_command_receipt_actor_workspaces");
  assert.ok(humanReviewCycleCompletionCommandReceiptActorWorkspaces.count <= 5);

  const humanReviewCycleCompletionCommandReceiptWorkspaceMerges = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspace-merges?merge_status=pending_human_review&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceMerges.collection, "human_review_cycle_completion_command_receipt_workspace_merges");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceMerges.count <= 1);

  const humanReviewCycleCompletionCommandReceiptMergeItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-merge-items?merge_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptMergeItems.collection, "human_review_cycle_completion_command_receipt_merge_items");
  assert.ok(humanReviewCycleCompletionCommandReceiptMergeItems.count <= 5);

  const humanReviewCycleCompletionCommandReceiptActorInputs = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-actor-inputs?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptActorInputs.collection, "human_review_cycle_completion_command_receipt_actor_inputs");
  assert.ok(humanReviewCycleCompletionCommandReceiptActorInputs.count <= 5);

  const mergedHumanReviewCycleCompletionCommandReceiptInput = await fetchJson(`${url}/api/merged-human-review-cycle-completion-command-receipt-input?limit=1`);
  assert.equal(mergedHumanReviewCycleCompletionCommandReceiptInput.collection, "merged_human_review_cycle_completion_command_receipt_input");
  assert.ok(mergedHumanReviewCycleCompletionCommandReceiptInput.count <= 1);

  const humanReviewCycleCompletionCommandReceiptWorkspaceValidations = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspace-validations?validation_status=pending_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidations.collection, "human_review_cycle_completion_command_receipt_workspace_validations");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceValidations.count <= 1);

  const humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspace-validation-items?validation_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems.collection, "human_review_cycle_completion_command_receipt_workspace_validation_items");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems.count <= 5);

  const humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-workspace-validation-errors?limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors.collection, "human_review_cycle_completion_command_receipt_workspace_validation_errors");
  assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors.count <= 5);

  const validatedHumanReviewCycleCompletionCommandWorkspaceReceipts = await fetchJson(`${url}/api/validated-human-review-cycle-completion-command-workspace-receipts?limit=5`);
  assert.equal(validatedHumanReviewCycleCompletionCommandWorkspaceReceipts.collection, "validated_human_review_cycle_completion_command_workspace_receipts");
  assert.ok(validatedHumanReviewCycleCompletionCommandWorkspaceReceipts.count <= 5);

  const humanReviewCycleCompletionCommandReceiptApplications = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-applications?application_status=nothing_to_apply&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandReceiptApplications.collection, "human_review_cycle_completion_command_receipt_applications");
  assert.ok(humanReviewCycleCompletionCommandReceiptApplications.count <= 1);

  const appliedHumanReviewCycleCompletionCommandReceipts = await fetchJson(`${url}/api/applied-human-review-cycle-completion-command-receipts?limit=5`);
  assert.equal(appliedHumanReviewCycleCompletionCommandReceipts.collection, "applied_human_review_cycle_completion_command_receipts");
  assert.ok(appliedHumanReviewCycleCompletionCommandReceipts.count <= 5);

  const humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-application-pending-receipts?validation_status=pending_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts.collection, "human_review_cycle_completion_command_receipt_application_pending_receipts");
  assert.ok(humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts.count <= 5);

  const humanReviewCycleCompletionCommandReceiptApplicationAuditEvents = await fetchJson(`${url}/api/human-review-cycle-completion-command-receipt-application-audit-events?limit=5`);
  assert.equal(humanReviewCycleCompletionCommandReceiptApplicationAuditEvents.collection, "human_review_cycle_completion_command_receipt_application_audit_events");
  assert.ok(humanReviewCycleCompletionCommandReceiptApplicationAuditEvents.count <= 5);

  const humanReviewCycleCompletionReconciliations = await fetchJson(`${url}/api/human-review-cycle-completion-reconciliations?reconciliation_status=waiting_for_manual_command_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionReconciliations.collection, "human_review_cycle_completion_reconciliations");
  assert.ok(humanReviewCycleCompletionReconciliations.count <= 1);

  const humanReviewCycleCompletionReconciliationItems = await fetchJson(`${url}/api/human-review-cycle-completion-reconciliation-items?reconciliation_status=waiting_for_manual_command_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionReconciliationItems.collection, "human_review_cycle_completion_reconciliation_items");
  assert.ok(humanReviewCycleCompletionReconciliationItems.count <= 5);

  const humanReviewCycleCompletionReconciliationActors = await fetchJson(`${url}/api/human-review-cycle-completion-reconciliation-actors?limit=5`);
  assert.equal(humanReviewCycleCompletionReconciliationActors.collection, "human_review_cycle_completion_reconciliation_actors");
  assert.ok(humanReviewCycleCompletionReconciliationActors.count <= 5);

  const humanReviewCycleCompletionBaselines = await fetchJson(`${url}/api/human-review-cycle-completion-baselines?baseline_status=frozen_with_blockers&limit=1`);
  assert.equal(humanReviewCycleCompletionBaselines.collection, "human_review_cycle_completion_baselines");
  assert.ok(humanReviewCycleCompletionBaselines.count <= 1);

  const humanReviewCycleCompletionBaselineBlockers = await fetchJson(`${url}/api/human-review-cycle-completion-baseline-blockers?blocker_status=waiting_for_manual_command_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionBaselineBlockers.collection, "human_review_cycle_completion_baseline_blockers");
  assert.ok(humanReviewCycleCompletionBaselineBlockers.count <= 5);

  const humanReviewCycleCompletionBaselineCountChecks = await fetchJson(`${url}/api/human-review-cycle-completion-baseline-count-checks?status=matched&limit=5`);
  assert.equal(humanReviewCycleCompletionBaselineCountChecks.collection, "human_review_cycle_completion_baseline_count_checks");
  assert.ok(humanReviewCycleCompletionBaselineCountChecks.count <= 5);

  const humanReviewCycleCompletionManualCommandReceiptPacks = await fetchJson(`${url}/api/human-review-cycle-completion-manual-command-receipt-packs?pack_status=ready_for_manual_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionManualCommandReceiptPacks.collection, "human_review_cycle_completion_manual_command_receipt_packs");
  assert.ok(humanReviewCycleCompletionManualCommandReceiptPacks.count <= 1);

  const humanReviewCycleCompletionManualCommandReceiptPackActors = await fetchJson(`${url}/api/human-review-cycle-completion-manual-command-receipt-pack-actors?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionManualCommandReceiptPackActors.collection, "human_review_cycle_completion_manual_command_receipt_pack_actors");
  assert.ok(humanReviewCycleCompletionManualCommandReceiptPackActors.count <= 5);

  const humanReviewCycleCompletionManualCommandReceiptPackItems = await fetchJson(`${url}/api/human-review-cycle-completion-manual-command-receipt-pack-items?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionManualCommandReceiptPackItems.collection, "human_review_cycle_completion_manual_command_receipt_pack_items");
  assert.ok(humanReviewCycleCompletionManualCommandReceiptPackItems.count <= 5);

  const validatedHumanGateReceipts = await fetchJson(`${url}/api/validated-human-gate-receipts`);
  assert.equal(validatedHumanGateReceipts.collection, "validated_human_gate_receipts");

  const humanGateReceiptApplications = await fetchJson(`${url}/api/human-gate-receipt-applications?application_status=nothing_to_apply`);
  assert.equal(humanGateReceiptApplications.collection, "human_gate_receipt_applications");

  const appliedHumanGateReceipts = await fetchJson(`${url}/api/applied-human-gate-receipts`);
  assert.equal(appliedHumanGateReceipts.collection, "applied_human_gate_receipts");

  const patchedHumanGateItems = await fetchJson(`${url}/api/patched-human-gate-items`);
  assert.equal(patchedHumanGateItems.collection, "patched_human_gate_items");

  const protectedWorkPackets = await fetchJson(`${url}/api/action-work-packets?protected_action=true&limit=5`);
  assert.equal(protectedWorkPackets.collection, "action_work_packets");
  assert.ok(protectedWorkPackets.count <= 5);

  const packetReceiptDrafts = await fetchJson(`${url}/api/work-packet-receipt-drafts?receipt_status=pending&limit=5`);
  assert.equal(packetReceiptDrafts.collection, "work_packet_receipt_drafts");
  assert.ok(packetReceiptDrafts.count <= 5);

  const packetReceiptValidations = await fetchJson(`${url}/api/work-packet-receipt-validations?validation_status=pending_receipt&limit=5`);
  assert.equal(packetReceiptValidations.collection, "work_packet_receipt_validations");
  assert.ok(packetReceiptValidations.count <= 5);

  const packetReceiptApplications = await fetchJson(`${url}/api/work-packet-receipt-applications?application_status=nothing_to_apply`);
  assert.equal(packetReceiptApplications.collection, "work_packet_receipt_applications");

  const appliedPacketReceipts = await fetchJson(`${url}/api/applied-work-packet-receipts`);
  assert.equal(appliedPacketReceipts.collection, "applied_work_packet_receipts");

  const controlPlaneLoopSteps = await fetchJson(`${url}/api/control-plane-loop-steps?status=passed&limit=5`);
  assert.equal(controlPlaneLoopSteps.collection, "control_plane_loop_steps");
  assert.ok(controlPlaneLoopSteps.count <= 5);

  const goalCheckpoints = await fetchJson(`${url}/api/goal-checkpoints`);
  assert.equal(goalCheckpoints.collection, "goal_checkpoints");
  assert.equal(goalCheckpoints.count, 1);

  const goalCheckpointItems = await fetchJson(`${url}/api/goal-checkpoint-items?status=passed&limit=5`);
  assert.equal(goalCheckpointItems.collection, "goal_checkpoint_items");
  assert.ok(goalCheckpointItems.count >= 1);
  assert.ok(goalCheckpointItems.count <= 5);

  const html = await fetch(`${url}/`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Hermes Review Dashboard/);

  console.log(`Review API smoke test passed at ${url}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--index") parsed.indexPath = argv[++index];
    else if (arg === "--summary") parsed.summaryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}
