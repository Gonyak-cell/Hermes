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
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-gate-receipt-errors"));
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

  const pendingHumanGateReceiptValidations = await fetchJson(`${url}/api/human-gate-receipt-validations?validation_status=pending_receipt&limit=5`);
  assert.equal(pendingHumanGateReceiptValidations.collection, "human_gate_receipt_validations");
  assert.ok(pendingHumanGateReceiptValidations.count <= 5);

  const humanGateReceiptErrors = await fetchJson(`${url}/api/human-gate-receipt-errors`);
  assert.equal(humanGateReceiptErrors.collection, "human_gate_receipt_errors");

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
