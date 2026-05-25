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
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-contract-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-item-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-claim-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/issue-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/citation-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-lineage-edges"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-contract-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-delivery-contract-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-artifact-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-action-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-receipt-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-delivery-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-state-transitions"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-delivery-contract-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-audit-run-contract-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-record-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-event-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/run-ledger-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-run-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-audit-run-contract-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-cost-observability-contract-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-record-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-observation-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/trace-projection-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-cost-observability-contract-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packet-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-retrieval-filters"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-routing-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-routing-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-policy-enforcements"));
  assert.ok(index.routes.some((route) => route.path === "/api/classification-model-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-model-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/route-model-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/model-policy-enforcement-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-runtime-policy-enforcements"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-policy-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-permission-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-tool-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-runtime-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-destination-policy-enforcements"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-destination-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/artifact-destination-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-action-destination-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/final-action-separation-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-destination-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/approval-authority-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/authority-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/artifact-authority-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/approval-request-authority-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/delivery-action-authority-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/approval-authority-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/contract-inventories"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-inventory-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-schemas"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-artifacts"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-owner-map"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-versioning-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-version-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-version-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-legacy-exceptions"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-versioning-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-migration-manifests"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-migration-manifest-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-migration-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/schema-migration-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-golden-fixtures"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-golden-fixture-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-golden-regression-hashes"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-golden-fixture-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-validation-suites"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-validation-fixture-results"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-validation-commands"));
  assert.ok(index.routes.some((route) => route.path === "/api/contract-validation-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-models"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-users"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-roles"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-role-assignments"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/client-counterparty-registries"));
  assert.ok(index.routes.some((route) => route.path === "/api/party-registry"));
  assert.ok(index.routes.some((route) => route.path === "/api/client-registry"));
  assert.ok(index.routes.some((route) => route.path === "/api/counterparty-registry"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-party-links"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-reference-index"));
  assert.ok(index.routes.some((route) => route.path === "/api/client-counterparty-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-profile-team-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-profiles"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-team-rosters"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-team-memberships"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-access-subjects"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-profile-team-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/wall-policy-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/wall-policy-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-wall-filters"));
  assert.ok(index.routes.some((route) => route.path === "/api/wall-subject-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-wall-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/wall-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-access-policy-evaluators"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-access-policy-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-access-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-access-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-access-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-access-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/data-classification-rule-engines"));
  assert.ok(index.routes.some((route) => route.path === "/api/data-classification-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-classification-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/classification-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/data-classification-rule-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-projection-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-operations"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-audit-candidates"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-actors"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-cycle-completion-normalized-blocker-statuses"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-v1-regression-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-v1-regression-fixture-artifacts"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-v1-regression-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/human-review-v1-freeze-notes"));
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

  const policyContractFreezes = await fetchJson(`${url}/api/policy-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(policyContractFreezes.collection, "policy_contract_freezes");
  assert.ok(policyContractFreezes.count <= 1);

  const dataClassificationContracts = await fetchJson(`${url}/api/data-classification-contracts?classification=P5_SECRET&limit=5`);
  assert.equal(dataClassificationContracts.collection, "data_classification_contracts");
  assert.ok(dataClassificationContracts.count <= 5);

  const resolvedPolicyReferences = await fetchJson(`${url}/api/policy-reference-contracts?reference_status=resolved&limit=5`);
  assert.equal(resolvedPolicyReferences.collection, "policy_reference_contracts");
  assert.ok(resolvedPolicyReferences.count <= 5);

  const p2PolicyDecisionContracts = await fetchJson(`${url}/api/policy-decision-contracts?classification=P2_CLIENT_CONFIDENTIAL&limit=5`);
  assert.equal(p2PolicyDecisionContracts.collection, "policy_decision_contracts");
  assert.ok(p2PolicyDecisionContracts.count <= 5);

  const policyContractValidations = await fetchJson(`${url}/api/policy-contract-validations?status=passed&limit=5`);
  assert.equal(policyContractValidations.collection, "policy_contract_validations");
  assert.ok(policyContractValidations.count <= 5);

  const evidenceContractFreezes = await fetchJson(`${url}/api/evidence-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(evidenceContractFreezes.collection, "evidence_contract_freezes");
  assert.ok(evidenceContractFreezes.count <= 1);

  const sourceSpanContracts = await fetchJson(`${url}/api/source-span-contracts?classification=P1_INTERNAL&limit=5`);
  assert.equal(sourceSpanContracts.collection, "source_span_contracts");
  assert.ok(sourceSpanContracts.count <= 5);

  const evidenceItemContracts = await fetchJson(`${url}/api/evidence-item-contracts?review_status=needs_review&limit=5`);
  assert.equal(evidenceItemContracts.collection, "evidence_item_contracts");
  assert.ok(evidenceItemContracts.count <= 5);

  const factClaimContracts = await fetchJson(`${url}/api/fact-claim-contracts?fact_type=missing_document&limit=5`);
  assert.equal(factClaimContracts.collection, "fact_claim_contracts");
  assert.ok(factClaimContracts.count <= 5);

  const issueContracts = await fetchJson(`${url}/api/issue-contracts?issue_type=rfi&limit=5`);
  assert.equal(issueContracts.collection, "issue_contracts");
  assert.ok(issueContracts.count <= 5);

  const citationContracts = await fetchJson(`${url}/api/citation-contracts?citation_binding_status=bound&limit=5`);
  assert.equal(citationContracts.collection, "citation_contracts");
  assert.ok(citationContracts.count <= 5);

  const lineageEdges = await fetchJson(`${url}/api/evidence-lineage-edges?relation=evidence_cited_by_citation&limit=5`);
  assert.equal(lineageEdges.collection, "evidence_lineage_edges");
  assert.ok(lineageEdges.count <= 5);

  const evidenceContractValidations = await fetchJson(`${url}/api/evidence-contract-validations?status=passed&limit=5`);
  assert.equal(evidenceContractValidations.collection, "evidence_contract_validations");
  assert.ok(evidenceContractValidations.count <= 5);

  const capabilityWorkflowContractFreezes = await fetchJson(`${url}/api/capability-workflow-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(capabilityWorkflowContractFreezes.collection, "capability_workflow_contract_freezes");
  assert.ok(capabilityWorkflowContractFreezes.count <= 1);

  const capabilityManifestContracts = await fetchJson(`${url}/api/capability-manifest-v2-contracts?domain_pack=law-firm&limit=5`);
  assert.equal(capabilityManifestContracts.collection, "capability_manifest_v2_contracts");
  assert.ok(capabilityManifestContracts.count <= 5);

  const workflowContracts = await fetchJson(`${url}/api/workflow-v2-contracts?capability_id=law_firm.ldd.issue_report&limit=5`);
  assert.equal(workflowContracts.collection, "workflow_v2_contracts");
  assert.ok(workflowContracts.count <= 5);

  const workflowRunContracts = await fetchJson(`${url}/api/workflow-run-v2-contracts?status=blocked&limit=5`);
  assert.equal(workflowRunContracts.collection, "workflow_run_v2_contracts");
  assert.ok(workflowRunContracts.count <= 5);

  const agentRunContracts = await fetchJson(`${url}/api/agent-run-v2-contracts?runtime_id=codex&limit=5`);
  assert.equal(agentRunContracts.collection, "agent_run_v2_contracts");
  assert.ok(agentRunContracts.count <= 5);

  const capabilityIoContracts = await fetchJson(`${url}/api/capability-io-contracts?input_output_status=complete&limit=5`);
  assert.equal(capabilityIoContracts.collection, "capability_io_contracts");
  assert.ok(capabilityIoContracts.count <= 5);

  const capabilityGateRuntimeContracts = await fetchJson(`${url}/api/capability-gate-runtime-contracts?capability_id=personal_dev.codex.worktree_patch&limit=5`);
  assert.equal(capabilityGateRuntimeContracts.collection, "capability_gate_runtime_contracts");
  assert.ok(capabilityGateRuntimeContracts.count <= 5);

  const workflowExecutionBindings = await fetchJson(`${url}/api/workflow-execution-bindings?status=blocked&limit=5`);
  assert.equal(workflowExecutionBindings.collection, "workflow_execution_bindings");
  assert.ok(workflowExecutionBindings.count <= 5);

  const capabilityWorkflowContractValidations = await fetchJson(`${url}/api/capability-workflow-contract-validations?status=passed&limit=5`);
  assert.equal(capabilityWorkflowContractValidations.collection, "capability_workflow_contract_validations");
  assert.ok(capabilityWorkflowContractValidations.count <= 5);

  const runtimeAgentRunContractFreezes = await fetchJson(`${url}/api/runtime-agentrun-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(runtimeAgentRunContractFreezes.collection, "runtime_agentrun_contract_freezes");
  assert.ok(runtimeAgentRunContractFreezes.count <= 1);

  const runtimeAdapterContracts = await fetchJson(`${url}/api/runtime-adapter-v2-contracts?risk_level=high&limit=5`);
  assert.equal(runtimeAdapterContracts.collection, "runtime_adapter_v2_contracts");
  assert.ok(runtimeAdapterContracts.count <= 5);

  const runtimeExecutionContracts = await fetchJson(`${url}/api/runtime-execution-contracts?runtime_id=codex&limit=5`);
  assert.equal(runtimeExecutionContracts.collection, "runtime_execution_contracts");
  assert.ok(runtimeExecutionContracts.count <= 5);

  const agentRunRuntimeContracts = await fetchJson(`${url}/api/agent-run-runtime-contracts?runtime_id=codex&limit=5`);
  assert.equal(agentRunRuntimeContracts.collection, "agent_run_runtime_contracts");
  assert.ok(agentRunRuntimeContracts.count <= 5);

  const runtimeOutputContracts = await fetchJson(`${url}/api/runtime-output-contracts?output_trust=untrusted_until_verified&limit=5`);
  assert.equal(runtimeOutputContracts.collection, "runtime_output_contracts");
  assert.ok(runtimeOutputContracts.count <= 5);

  const runtimeLogContracts = await fetchJson(`${url}/api/runtime-log-contracts?log_capture_status=captured&limit=5`);
  assert.equal(runtimeLogContracts.collection, "runtime_log_contracts");
  assert.ok(runtimeLogContracts.count <= 5);

  const runtimeArtifactContracts = await fetchJson(`${url}/api/runtime-artifact-contracts?artifact_type=pr_draft&limit=5`);
  assert.equal(runtimeArtifactContracts.collection, "runtime_artifact_contracts");
  assert.ok(runtimeArtifactContracts.count <= 5);

  const runtimeVerificationContracts = await fetchJson(`${url}/api/runtime-verification-contracts?verification_status=pending_gate_review&limit=5`);
  assert.equal(runtimeVerificationContracts.collection, "runtime_verification_contracts");
  assert.ok(runtimeVerificationContracts.count <= 5);

  const runtimeAgentRunValidations = await fetchJson(`${url}/api/runtime-agentrun-contract-validations?status=passed&limit=5`);
  assert.equal(runtimeAgentRunValidations.collection, "runtime_agentrun_contract_validations");
  assert.ok(runtimeAgentRunValidations.count <= 5);

  const gateApprovalContractFreezes = await fetchJson(`${url}/api/gate-approval-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(gateApprovalContractFreezes.collection, "gate_approval_contract_freezes");
  assert.ok(gateApprovalContractFreezes.count <= 1);

  const gateResultContracts = await fetchJson(`${url}/api/gate-result-contracts?gate_id=human_approval_gate&limit=5`);
  assert.equal(gateResultContracts.collection, "gate_result_contracts");
  assert.ok(gateResultContracts.count <= 5);

  const approvalRequestContracts = await fetchJson(`${url}/api/approval-request-contracts?approval_kind=approval_request&limit=5`);
  assert.equal(approvalRequestContracts.collection, "approval_request_contracts");
  assert.ok(approvalRequestContracts.count <= 5);

  const approvalDecisionContracts = await fetchJson(`${url}/api/approval-decision-contracts?limit=5`);
  assert.equal(approvalDecisionContracts.collection, "approval_decision_contracts");
  assert.ok(approvalDecisionContracts.count <= 5);

  const humanGateV2Contracts = await fetchJson(`${url}/api/human-gate-v2-contracts?requires_human=true&limit=5`);
  assert.equal(humanGateV2Contracts.collection, "human_gate_v2_contracts");
  assert.ok(humanGateV2Contracts.count <= 5);

  const approvalAuthorityContracts = await fetchJson(`${url}/api/approval-authority-contracts?approval_authority_status=declared&limit=5`);
  assert.equal(approvalAuthorityContracts.collection, "approval_authority_contracts");
  assert.ok(approvalAuthorityContracts.count <= 5);

  const gateApprovalBindings = await fetchJson(`${url}/api/gate-approval-bindings?binding_status=linked&limit=5`);
  assert.equal(gateApprovalBindings.collection, "gate_approval_bindings");
  assert.ok(gateApprovalBindings.count <= 5);

  const gateApprovalContractValidations = await fetchJson(`${url}/api/gate-approval-contract-validations?status=passed&limit=5`);
  assert.equal(gateApprovalContractValidations.collection, "gate_approval_contract_validations");
  assert.ok(gateApprovalContractValidations.count <= 5);

  const outputDeliveryContractFreezes = await fetchJson(`${url}/api/output-delivery-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(outputDeliveryContractFreezes.collection, "output_delivery_contract_freezes");
  assert.ok(outputDeliveryContractFreezes.count <= 1);

  const outputArtifactV2Contracts = await fetchJson(`${url}/api/output-artifact-v2-contracts?hash_status=present&limit=5`);
  assert.equal(outputArtifactV2Contracts.collection, "output_artifact_v2_contracts");
  assert.ok(outputArtifactV2Contracts.count <= 5);

  const deliveryActionV2Contracts = await fetchJson(`${url}/api/delivery-action-v2-contracts?protected_action=true&limit=5`);
  assert.equal(deliveryActionV2Contracts.collection, "delivery_action_v2_contracts");
  assert.ok(deliveryActionV2Contracts.count <= 5);

  const deliveryReceiptV2Contracts = await fetchJson(`${url}/api/delivery-receipt-v2-contracts?limit=5`);
  assert.equal(deliveryReceiptV2Contracts.collection, "delivery_receipt_v2_contracts");
  assert.ok(deliveryReceiptV2Contracts.count <= 5);

  const outputDeliveryBindings = await fetchJson(`${url}/api/output-delivery-bindings?binding_status=linked&limit=5`);
  assert.equal(outputDeliveryBindings.collection, "output_delivery_bindings");
  assert.ok(outputDeliveryBindings.count <= 5);

  const deliveryStateTransitions = await fetchJson(`${url}/api/delivery-state-transitions?transition_type=catalog_to_delivery_queue&limit=5`);
  assert.equal(deliveryStateTransitions.collection, "delivery_state_transitions");
  assert.ok(deliveryStateTransitions.count <= 5);

  const eventAuditRunContractFreezes = await fetchJson(`${url}/api/event-audit-run-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(eventAuditRunContractFreezes.collection, "event_audit_run_contract_freezes");
  assert.ok(eventAuditRunContractFreezes.count <= 1);

  const eventRecordV2Contracts = await fetchJson(`${url}/api/event-record-v2-contracts?policy_snapshot_status=source_declared&limit=5`);
  assert.equal(eventRecordV2Contracts.collection, "event_record_v2_contracts");
  assert.ok(eventRecordV2Contracts.count <= 5);

  const auditEventV2Contracts = await fetchJson(`${url}/api/audit-event-v2-contracts?actor_type=human&limit=5`);
  assert.equal(auditEventV2Contracts.collection, "audit_event_v2_contracts");
  assert.ok(auditEventV2Contracts.count <= 5);

  const runLedgerV2Contracts = await fetchJson(`${url}/api/run-ledger-v2-contracts?run_status=blocked&limit=5`);
  assert.equal(runLedgerV2Contracts.collection, "run_ledger_v2_contracts");
  assert.ok(runLedgerV2Contracts.count <= 5);

  const eventRunBindings = await fetchJson(`${url}/api/event-run-bindings?binding_status=linked&limit=5`);
  assert.equal(eventRunBindings.collection, "event_run_bindings");
  assert.ok(eventRunBindings.count <= 5);

  const eventAuditRunContractValidations = await fetchJson(`${url}/api/event-audit-run-contract-validations?status=passed&limit=5`);
  assert.equal(eventAuditRunContractValidations.collection, "event_audit_run_contract_validations");
  assert.ok(eventAuditRunContractValidations.count <= 5);

  const errorCostObservabilityContractFreezes = await fetchJson(`${url}/api/error-cost-observability-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(errorCostObservabilityContractFreezes.collection, "error_cost_observability_contract_freezes");
  assert.ok(errorCostObservabilityContractFreezes.count <= 1);

  const errorRecordV2Contracts = await fetchJson(`${url}/api/error-record-v2-contracts?error_kind=run_blocked&limit=5`);
  assert.equal(errorRecordV2Contracts.collection, "error_record_v2_contracts");
  assert.ok(errorRecordV2Contracts.count <= 5);

  const costObservationV2Contracts = await fetchJson(`${url}/api/cost-observation-v2-contracts?cost_status=attributed&limit=5`);
  assert.equal(costObservationV2Contracts.collection, "cost_observation_v2_contracts");
  assert.ok(costObservationV2Contracts.count <= 5);

  const traceProjectionV2Contracts = await fetchJson(`${url}/api/trace-projection-v2-contracts?latency_status=observed&limit=5`);
  assert.equal(traceProjectionV2Contracts.collection, "trace_projection_v2_contracts");
  assert.ok(traceProjectionV2Contracts.count <= 5);

  const errorCostObservabilityContractValidations = await fetchJson(`${url}/api/error-cost-observability-contract-validations?status=passed&limit=5`);
  assert.equal(errorCostObservabilityContractValidations.collection, "error_cost_observability_contract_validations");
  assert.ok(errorCostObservabilityContractValidations.count <= 5);

  const outputDeliveryContractValidations = await fetchJson(`${url}/api/output-delivery-contract-validations?status=passed&limit=5`);
  assert.equal(outputDeliveryContractValidations.collection, "output_delivery_contract_validations");
  assert.ok(outputDeliveryContractValidations.count <= 5);

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

  const modelPolicyEnforcements = await fetchJson(`${url}/api/model-policy-enforcements?limit=1`);
  assert.equal(modelPolicyEnforcements.collection, "model_policy_enforcements");
  assert.ok(modelPolicyEnforcements.count <= 1);

  const classificationModelGates = await fetchJson(`${url}/api/classification-model-gates?sensitive_data=true&limit=5`);
  assert.equal(classificationModelGates.collection, "classification_model_gates");
  assert.ok(classificationModelGates.count <= 5);

  const resourceModelGates = await fetchJson(`${url}/api/resource-model-gates?gate_status=requires_approval&limit=5`);
  assert.equal(resourceModelGates.collection, "resource_model_gates");
  assert.ok(resourceModelGates.count <= 5);

  const routeModelGates = await fetchJson(`${url}/api/route-model-gates?external_transfer=true&limit=5`);
  assert.equal(routeModelGates.collection, "route_model_gates");
  assert.ok(routeModelGates.count <= 5);

  const modelPolicyEnforcementValidations = await fetchJson(`${url}/api/model-policy-enforcement-validations?status=passed&limit=5`);
  assert.equal(modelPolicyEnforcementValidations.collection, "model_policy_enforcement_validations");
  assert.ok(modelPolicyEnforcementValidations.count <= 5);

  const toolRuntimePolicyEnforcements = await fetchJson(`${url}/api/tool-runtime-policy-enforcements?limit=1`);
  assert.equal(toolRuntimePolicyEnforcements.collection, "tool_runtime_policy_enforcements");
  assert.ok(toolRuntimePolicyEnforcements.count <= 1);

  const runtimePolicyGates = await fetchJson(`${url}/api/runtime-policy-gates?gate_status=blocked&limit=5`);
  assert.equal(runtimePolicyGates.collection, "runtime_policy_gates");
  assert.ok(runtimePolicyGates.count <= 5);

  const toolPermissionGates = await fetchJson(`${url}/api/tool-permission-gates?requested_state=forbidden&gate_decision=deny&limit=5`);
  assert.equal(toolPermissionGates.collection, "tool_permission_gates");
  assert.ok(toolPermissionGates.count <= 5);

  const agentRunToolGates = await fetchJson(`${url}/api/agent-run-tool-gates?gate_status=requires_approval&limit=5`);
  assert.equal(agentRunToolGates.collection, "agent_run_tool_gates");
  assert.ok(agentRunToolGates.count <= 5);

  const toolRuntimePolicyValidations = await fetchJson(`${url}/api/tool-runtime-policy-validations?status=passed&limit=5`);
  assert.equal(toolRuntimePolicyValidations.collection, "tool_runtime_policy_validations");
  assert.ok(toolRuntimePolicyValidations.count <= 5);

  const outputDestinationPolicyEnforcements = await fetchJson(`${url}/api/output-destination-policy-enforcements?limit=1`);
  assert.equal(outputDestinationPolicyEnforcements.collection, "output_destination_policy_enforcements");
  assert.ok(outputDestinationPolicyEnforcements.count <= 1);

  const policyDestinationRules = await fetchJson(`${url}/api/policy-destination-rules?destination_kind=github&limit=5`);
  assert.equal(policyDestinationRules.collection, "policy_destination_rules");
  assert.ok(policyDestinationRules.count <= 5);

  const artifactDestinationGates = await fetchJson(`${url}/api/artifact-destination-gates?gate_status=requires_approval&limit=5`);
  assert.equal(artifactDestinationGates.collection, "artifact_destination_gates");
  assert.ok(artifactDestinationGates.count <= 5);

  const deliveryActionDestinationGates = await fetchJson(`${url}/api/delivery-action-destination-gates?final_action_status=blocked_pending_approval&limit=5`);
  assert.equal(deliveryActionDestinationGates.collection, "delivery_action_destination_gates");
  assert.ok(deliveryActionDestinationGates.count <= 5);

  const finalActionSeparationGates = await fetchJson(`${url}/api/final-action-separation-gates?separation_status=draft_and_final_action_separated_pending_approval&limit=5`);
  assert.equal(finalActionSeparationGates.collection, "final_action_separation_gates");
  assert.ok(finalActionSeparationGates.count <= 5);

  const outputDestinationPolicyValidations = await fetchJson(`${url}/api/output-destination-policy-validations?status=passed&limit=5`);
  assert.equal(outputDestinationPolicyValidations.collection, "output_destination_policy_validations");
  assert.ok(outputDestinationPolicyValidations.count <= 5);

  const approvalAuthorityLedgers = await fetchJson(`${url}/api/approval-authority-ledgers?limit=1`);
  assert.equal(approvalAuthorityLedgers.collection, "approval_authority_ledgers");
  assert.ok(approvalAuthorityLedgers.count <= 1);

  const authorityPolicies = await fetchJson(`${url}/api/authority-policies?human_authority_required=true&limit=5`);
  assert.equal(authorityPolicies.collection, "authority_policies");
  assert.ok(authorityPolicies.count <= 5);

  const artifactAuthorityDecisions = await fetchJson(`${url}/api/artifact-authority-decisions?authority_status=assignment_required&limit=5`);
  assert.equal(artifactAuthorityDecisions.collection, "artifact_authority_decisions");
  assert.ok(artifactAuthorityDecisions.count <= 5);

  const approvalRequestAuthorityDecisions = await fetchJson(`${url}/api/approval-request-authority-decisions?required_authority_role=responsible_partner_or_reviewer&limit=5`);
  assert.equal(approvalRequestAuthorityDecisions.collection, "approval_request_authority_decisions");
  assert.ok(approvalRequestAuthorityDecisions.count <= 5);

  const deliveryActionAuthorityDecisions = await fetchJson(`${url}/api/delivery-action-authority-decisions?gate_status=requires_assignment&limit=5`);
  assert.equal(deliveryActionAuthorityDecisions.collection, "delivery_action_authority_decisions");
  assert.ok(deliveryActionAuthorityDecisions.count <= 5);

  const approvalAuthorityValidations = await fetchJson(`${url}/api/approval-authority-validations?status=passed&limit=5`);
  assert.equal(approvalAuthorityValidations.collection, "approval_authority_validations");
  assert.ok(approvalAuthorityValidations.count <= 5);

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

  const humanReviewCycleCompletionCommandQueuePatchProjections = await fetchJson(`${url}/api/human-review-cycle-completion-command-queue-patch-projections?projection_status=waiting_for_human_receipts&limit=1`);
  assert.equal(humanReviewCycleCompletionCommandQueuePatchProjections.collection, "human_review_cycle_completion_command_queue_patch_projections");
  assert.ok(humanReviewCycleCompletionCommandQueuePatchProjections.count <= 1);

  const humanReviewCycleCompletionCommandQueuePatchProjectionItems = await fetchJson(`${url}/api/human-review-cycle-completion-command-queue-patch-projection-items?projection_status=waiting_for_human_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandQueuePatchProjectionItems.collection, "human_review_cycle_completion_command_queue_patch_projection_items");
  assert.ok(humanReviewCycleCompletionCommandQueuePatchProjectionItems.count <= 5);

  const humanReviewCycleCompletionCommandQueuePatchOperations = await fetchJson(`${url}/api/human-review-cycle-completion-command-queue-patch-operations?limit=5`);
  assert.equal(humanReviewCycleCompletionCommandQueuePatchOperations.collection, "human_review_cycle_completion_command_queue_patch_operations");
  assert.ok(humanReviewCycleCompletionCommandQueuePatchOperations.count <= 5);

  const humanReviewCycleCompletionCommandQueuePatchAuditCandidates = await fetchJson(`${url}/api/human-review-cycle-completion-command-queue-patch-audit-candidates?event_status=held_pending_manual_receipt&limit=5`);
  assert.equal(humanReviewCycleCompletionCommandQueuePatchAuditCandidates.collection, "human_review_cycle_completion_command_queue_patch_audit_candidates");
  assert.ok(humanReviewCycleCompletionCommandQueuePatchAuditCandidates.count <= 5);

  const humanReviewCycleCompletionCloseoutLedgers = await fetchJson(`${url}/api/human-review-cycle-completion-closeout-ledgers?closeout_status=open_pending&limit=1`);
  assert.equal(humanReviewCycleCompletionCloseoutLedgers.collection, "human_review_cycle_completion_closeout_ledgers");
  assert.ok(humanReviewCycleCompletionCloseoutLedgers.count <= 1);

  const humanReviewCycleCompletionCloseoutItems = await fetchJson(`${url}/api/human-review-cycle-completion-closeout-items?normalized_status=pending&limit=5`);
  assert.equal(humanReviewCycleCompletionCloseoutItems.collection, "human_review_cycle_completion_closeout_items");
  assert.ok(humanReviewCycleCompletionCloseoutItems.count <= 5);

  const humanReviewCycleCompletionCloseoutActors = await fetchJson(`${url}/api/human-review-cycle-completion-closeout-actors?required_actor=human_reviewer&limit=5`);
  assert.equal(humanReviewCycleCompletionCloseoutActors.collection, "human_review_cycle_completion_closeout_actors");
  assert.ok(humanReviewCycleCompletionCloseoutActors.count <= 5);

  const humanReviewCycleCompletionNormalizedBlockerStatuses = await fetchJson(`${url}/api/human-review-cycle-completion-normalized-blocker-statuses?normalized_status=pending&limit=5`);
  assert.equal(humanReviewCycleCompletionNormalizedBlockerStatuses.collection, "human_review_cycle_completion_normalized_blocker_statuses");
  assert.ok(humanReviewCycleCompletionNormalizedBlockerStatuses.count <= 5);

  const humanReviewV1RegressionFreezes = await fetchJson(`${url}/api/human-review-v1-regression-freezes?freeze_status=frozen_with_pending_human_actions&limit=1`);
  assert.equal(humanReviewV1RegressionFreezes.collection, "human_review_v1_regression_freezes");
  assert.ok(humanReviewV1RegressionFreezes.count <= 1);

  const humanReviewV1RegressionFixtureArtifacts = await fetchJson(`${url}/api/human-review-v1-regression-fixture-artifacts?available=true&limit=5`);
  assert.equal(humanReviewV1RegressionFixtureArtifacts.collection, "human_review_v1_regression_fixture_artifacts");
  assert.ok(humanReviewV1RegressionFixtureArtifacts.count <= 5);

  const humanReviewV1RegressionCheckpoints = await fetchJson(`${url}/api/human-review-v1-regression-checkpoints?checkpoint_status=passed&limit=5`);
  assert.equal(humanReviewV1RegressionCheckpoints.collection, "human_review_v1_regression_checkpoints");
  assert.ok(humanReviewV1RegressionCheckpoints.count <= 5);

  const humanReviewV1FreezeNotes = await fetchJson(`${url}/api/human-review-v1-freeze-notes?freeze_status=frozen_with_pending_human_actions&limit=1`);
  assert.equal(humanReviewV1FreezeNotes.collection, "human_review_v1_freeze_notes");
  assert.ok(humanReviewV1FreezeNotes.count <= 1);

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

  const contractInventories = await fetchJson(`${url}/api/contract-inventories?inventory_status=complete&limit=1`);
  assert.equal(contractInventories.collection, "contract_inventories");
  assert.ok(contractInventories.count <= 1);

  const contractInventoryItems = await fetchJson(`${url}/api/contract-inventory-items?item_type=schema&limit=5`);
  assert.equal(contractInventoryItems.collection, "contract_inventory_items");
  assert.ok(contractInventoryItems.count <= 5);

  const contractSchemas = await fetchJson(`${url}/api/contract-schemas?parse_status=parsed&limit=5`);
  assert.equal(contractSchemas.collection, "contract_schemas");
  assert.ok(contractSchemas.count <= 5);

  const contractArtifacts = await fetchJson(`${url}/api/contract-artifacts?owner_area=gate_approval&limit=5`);
  assert.equal(contractArtifacts.collection, "contract_artifacts");
  assert.ok(contractArtifacts.count <= 5);

  const contractOwnerMap = await fetchJson(`${url}/api/contract-owner-map?owner_area=core_contracts&limit=5`);
  assert.equal(contractOwnerMap.collection, "contract_owner_map");
  assert.ok(contractOwnerMap.count <= 5);

  const contractDependencyMaps = await fetchJson(`${url}/api/contract-dependency-maps?map_status=complete&limit=1`);
  assert.equal(contractDependencyMaps.collection, "contract_dependency_maps");
  assert.ok(contractDependencyMaps.count <= 1);

  const contractDependencyNodes = await fetchJson(`${url}/api/contract-dependency-nodes?item_type=schema&limit=5`);
  assert.equal(contractDependencyNodes.collection, "contract_dependency_nodes");
  assert.ok(contractDependencyNodes.count <= 5);

  const contractDependencyEdges = await fetchJson(`${url}/api/contract-dependency-edges?edge_type=artifact_contract_to_dashboard_source&limit=5`);
  assert.equal(contractDependencyEdges.collection, "contract_dependency_edges");
  assert.ok(contractDependencyEdges.count <= 5);

  const contractBreakingChangeRisks = await fetchJson(`${url}/api/contract-breaking-change-risks?risk_level=low&limit=5`);
  assert.equal(contractBreakingChangeRisks.collection, "contract_breaking_change_risks");
  assert.ok(contractBreakingChangeRisks.count <= 5);

  const contractOwnerDependencies = await fetchJson(`${url}/api/contract-owner-dependencies?direction_status=allowed&limit=5`);
  assert.equal(contractOwnerDependencies.collection, "contract_owner_dependencies");
  assert.ok(contractOwnerDependencies.count <= 5);

  const schemaVersioningRules = await fetchJson(`${url}/api/schema-versioning-rules?guideline_status=complete&limit=1`);
  assert.equal(schemaVersioningRules.collection, "schema_versioning_rules");
  assert.ok(schemaVersioningRules.count <= 1);

  const schemaVersionPolicies = await fetchJson(`${url}/api/schema-version-policies?rule_id=optional_addition_default&limit=5`);
  assert.equal(schemaVersionPolicies.collection, "schema_version_policies");
  assert.ok(schemaVersionPolicies.count <= 5);

  const schemaVersionRecords = await fetchJson(`${url}/api/schema-version-records?version_status=versioned&limit=5`);
  assert.equal(schemaVersionRecords.collection, "schema_version_records");
  assert.ok(schemaVersionRecords.count <= 5);

  const schemaLegacyExceptions = await fetchJson(`${url}/api/schema-legacy-exceptions?exception_status=allowed&limit=5`);
  assert.equal(schemaLegacyExceptions.collection, "schema_legacy_exceptions");
  assert.ok(schemaLegacyExceptions.count <= 5);

  const schemaVersioningValidations = await fetchJson(`${url}/api/schema-versioning-validations?status=passed&limit=5`);
  assert.equal(schemaVersioningValidations.collection, "schema_versioning_validations");
  assert.ok(schemaVersioningValidations.count <= 5);

  const schemaMigrationManifests = await fetchJson(`${url}/api/schema-migration-manifests?migration_manifest_status=complete&limit=1`);
  assert.equal(schemaMigrationManifests.collection, "schema_migration_manifests");
  assert.ok(schemaMigrationManifests.count <= 1);

  const schemaMigrationManifestRecords = await fetchJson(`${url}/api/schema-migration-manifest-records?migration_scope=core&limit=5`);
  assert.equal(schemaMigrationManifestRecords.collection, "schema_migration_manifest_records");
  assert.ok(schemaMigrationManifestRecords.count <= 5);

  const schemaMigrationRecords = await fetchJson(`${url}/api/schema-migration-records?dry_run_status=not_run&limit=5`);
  assert.equal(schemaMigrationRecords.collection, "schema_migration_records");
  assert.ok(schemaMigrationRecords.count <= 5);

  const schemaMigrationValidations = await fetchJson(`${url}/api/schema-migration-validations?status=passed&limit=5`);
  assert.equal(schemaMigrationValidations.collection, "schema_migration_validations");
  assert.ok(schemaMigrationValidations.count <= 5);

  const contractGoldenFixtures = await fetchJson(`${url}/api/contract-golden-fixtures?golden_fixture_status=complete&limit=1`);
  assert.equal(contractGoldenFixtures.collection, "contract_golden_fixtures");
  assert.ok(contractGoldenFixtures.count <= 1);

  const contractGoldenFixtureRecords = await fetchJson(`${url}/api/contract-golden-fixture-records?schema_validation_status=passed&limit=5`);
  assert.equal(contractGoldenFixtureRecords.collection, "contract_golden_fixture_records");
  assert.ok(contractGoldenFixtureRecords.count <= 5);

  const contractGoldenRegressionHashes = await fetchJson(`${url}/api/contract-golden-regression-hashes?regression_status=locked&limit=5`);
  assert.equal(contractGoldenRegressionHashes.collection, "contract_golden_regression_hashes");
  assert.ok(contractGoldenRegressionHashes.count <= 5);

  const contractGoldenFixtureValidations = await fetchJson(`${url}/api/contract-golden-fixture-validations?status=passed&limit=5`);
  assert.equal(contractGoldenFixtureValidations.collection, "contract_golden_fixture_validations");
  assert.ok(contractGoldenFixtureValidations.count <= 5);

  const contractValidationSuites = await fetchJson(`${url}/api/contract-validation-suites?validation_suite_status=complete&limit=1`);
  assert.equal(contractValidationSuites.collection, "contract_validation_suites");
  assert.ok(contractValidationSuites.count <= 1);

  const contractValidationFixtureResults = await fetchJson(`${url}/api/contract-validation-fixture-results?regression_status=passed&limit=5`);
  assert.equal(contractValidationFixtureResults.collection, "contract_validation_fixture_results");
  assert.ok(contractValidationFixtureResults.count <= 5);

  const contractValidationCommands = await fetchJson(`${url}/api/contract-validation-commands?script_status=present&limit=5`);
  assert.equal(contractValidationCommands.collection, "contract_validation_commands");
  assert.ok(contractValidationCommands.count <= 5);

  const contractValidationItems = await fetchJson(`${url}/api/contract-validation-items?status=passed&limit=5`);
  assert.equal(contractValidationItems.collection, "contract_validation_items");
  assert.ok(contractValidationItems.count <= 5);

  const identityModels = await fetchJson(`${url}/api/identity-models?identity_model_status=complete&limit=1`);
  assert.equal(identityModels.collection, "identity_models");
  assert.ok(identityModels.count <= 1);

  const identityUsers = await fetchJson(`${url}/api/identity-users?tenant_id=tenant.amic&limit=5`);
  assert.equal(identityUsers.collection, "identity_users");
  assert.ok(identityUsers.count <= 5);

  const identityRoles = await fetchJson(`${url}/api/identity-roles?role_scope=tenant&limit=5`);
  assert.equal(identityRoles.collection, "identity_roles");
  assert.ok(identityRoles.count <= 5);

  const identityRoleAssignments = await fetchJson(`${url}/api/identity-role-assignments?assignment_scope=tenant&limit=5`);
  assert.equal(identityRoleAssignments.collection, "identity_role_assignments");
  assert.ok(identityRoleAssignments.count <= 5);

  const identityActors = await fetchJson(`${url}/api/identity-actors?principal_class=human_actor&limit=5`);
  assert.equal(identityActors.collection, "identity_actors");
  assert.ok(identityActors.count <= 5);

  const identityBindings = await fetchJson(`${url}/api/identity-bindings?binding_type=human_user_actor&limit=5`);
  assert.equal(identityBindings.collection, "identity_bindings");
  assert.ok(identityBindings.count <= 5);

  const identityValidations = await fetchJson(`${url}/api/identity-validations?status=passed&limit=5`);
  assert.equal(identityValidations.collection, "identity_validations");
  assert.ok(identityValidations.count <= 5);

  const resourceContractFreezes = await fetchJson(`${url}/api/resource-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(resourceContractFreezes.collection, "resource_contract_freezes");
  assert.ok(resourceContractFreezes.count <= 1);

  const resourceV2Contracts = await fetchJson(`${url}/api/resource-v2-contracts?source_system=local_filesystem&limit=5`);
  assert.equal(resourceV2Contracts.collection, "resource_v2_contracts");
  assert.ok(resourceV2Contracts.count <= 5);

  const resourceVersionV2Contracts = await fetchJson(`${url}/api/resource-version-v2-contracts?version_status=current&limit=5`);
  assert.equal(resourceVersionV2Contracts.collection, "resource_version_v2_contracts");
  assert.ok(resourceVersionV2Contracts.count <= 5);

  const resourceContractValidations = await fetchJson(`${url}/api/resource-contract-validations?status=passed&limit=5`);
  assert.equal(resourceContractValidations.collection, "resource_contract_validations");
  assert.ok(resourceContractValidations.count <= 5);

  const matterContractFreezes = await fetchJson(`${url}/api/matter-contract-freezes?freeze_status=complete&limit=1`);
  assert.equal(matterContractFreezes.collection, "matter_contract_freezes");
  assert.ok(matterContractFreezes.count <= 1);

  const clientV2Contracts = await fetchJson(`${url}/api/client-v2-contracts?client_id=client.alpha&limit=5`);
  assert.equal(clientV2Contracts.collection, "client_v2_contracts");
  assert.ok(clientV2Contracts.count <= 5);

  const partyV2Contracts = await fetchJson(`${url}/api/party-v2-contracts?party_type=counterparty&limit=5`);
  assert.equal(partyV2Contracts.collection, "party_v2_contracts");
  assert.ok(partyV2Contracts.count <= 5);

  const matterV2Contracts = await fetchJson(`${url}/api/matter-v2-contracts?matter_status=active&limit=5`);
  assert.equal(matterV2Contracts.collection, "matter_v2_contracts");
  assert.ok(matterV2Contracts.count <= 5);

  const matterTeamV2Contracts = await fetchJson(`${url}/api/matter-team-v2-contracts?team_status=active&limit=5`);
  assert.equal(matterTeamV2Contracts.collection, "matter_team_v2_contracts");
  assert.ok(matterTeamV2Contracts.count <= 5);

  const matterBoundaryV2Contracts = await fetchJson(`${url}/api/matter-boundary-v2-contracts?boundary_status=active&limit=5`);
  assert.equal(matterBoundaryV2Contracts.collection, "matter_boundary_v2_contracts");
  assert.ok(matterBoundaryV2Contracts.count <= 5);

  const matterContractValidations = await fetchJson(`${url}/api/matter-contract-validations?status=passed&limit=5`);
  assert.equal(matterContractValidations.collection, "matter_contract_validations");
  assert.ok(matterContractValidations.count <= 5);

  const clientCounterpartyRegistries = await fetchJson(`${url}/api/client-counterparty-registries?registry_status=complete&limit=1`);
  assert.equal(clientCounterpartyRegistries.collection, "client_counterparty_registries");
  assert.ok(clientCounterpartyRegistries.count <= 1);

  const partyRegistry = await fetchJson(`${url}/api/party-registry?party_type=client&limit=5`);
  assert.equal(partyRegistry.collection, "party_registry");
  assert.ok(partyRegistry.count <= 5);

  const clientRegistry = await fetchJson(`${url}/api/client-registry?client_id=client.alpha&limit=5`);
  assert.equal(clientRegistry.collection, "client_registry");
  assert.ok(clientRegistry.count <= 5);

  const counterpartyRegistry = await fetchJson(`${url}/api/counterparty-registry?counterparty_role=seller&limit=5`);
  assert.equal(counterpartyRegistry.collection, "counterparty_registry");
  assert.ok(counterpartyRegistry.count <= 5);

  const matterPartyLinks = await fetchJson(`${url}/api/matter-party-links?link_status=active&limit=5`);
  assert.equal(matterPartyLinks.collection, "matter_party_links");
  assert.ok(matterPartyLinks.count <= 5);

  const conflictReferenceIndex = await fetchJson(`${url}/api/conflict-reference-index?conflict_check_status=ready&limit=5`);
  assert.equal(conflictReferenceIndex.collection, "conflict_reference_index");
  assert.ok(conflictReferenceIndex.count <= 5);

  const clientCounterpartyValidations = await fetchJson(`${url}/api/client-counterparty-validations?status=passed&limit=5`);
  assert.equal(clientCounterpartyValidations.collection, "client_counterparty_validations");
  assert.ok(clientCounterpartyValidations.count <= 5);

  const matterProfileTeamLedgers = await fetchJson(`${url}/api/matter-profile-team-ledgers?ledger_status=complete&limit=1`);
  assert.equal(matterProfileTeamLedgers.collection, "matter_profile_team_ledgers");
  assert.ok(matterProfileTeamLedgers.count <= 1);

  const matterProfiles = await fetchJson(`${url}/api/matter-profiles?matter_id=matter.alpha.ldd&limit=5`);
  assert.equal(matterProfiles.collection, "matter_profiles");
  assert.ok(matterProfiles.count <= 5);

  const matterTeamRosters = await fetchJson(`${url}/api/matter-team-rosters?team_status=active&limit=5`);
  assert.equal(matterTeamRosters.collection, "matter_team_rosters");
  assert.ok(matterTeamRosters.count <= 5);

  const matterTeamMemberships = await fetchJson(`${url}/api/matter-team-memberships?membership_status=active&limit=5`);
  assert.equal(matterTeamMemberships.collection, "matter_team_memberships");
  assert.ok(matterTeamMemberships.count <= 5);

  const matterAccessSubjects = await fetchJson(`${url}/api/matter-access-subjects?access_decision=allow&limit=5`);
  assert.equal(matterAccessSubjects.collection, "matter_access_subjects");
  assert.ok(matterAccessSubjects.count <= 5);

  const matterProfileTeamValidations = await fetchJson(`${url}/api/matter-profile-team-validations?status=passed&limit=5`);
  assert.equal(matterProfileTeamValidations.collection, "matter_profile_team_validations");
  assert.ok(matterProfileTeamValidations.count <= 5);

  const wallPolicyContracts = await fetchJson(`${url}/api/wall-policy-contracts?wall_policy_status=complete&limit=1`);
  assert.equal(wallPolicyContracts.collection, "wall_policy_contracts");
  assert.ok(wallPolicyContracts.count <= 1);

  const wallPolicyRules = await fetchJson(`${url}/api/wall-policy-rules?enforcement_stage=pre_retrieval&limit=5`);
  assert.equal(wallPolicyRules.collection, "wall_policy_rules");
  assert.ok(wallPolicyRules.count <= 5);

  const retrievalWallFilters = await fetchJson(`${url}/api/retrieval-wall-filters?filter_status=complete&limit=5`);
  assert.equal(retrievalWallFilters.collection, "retrieval_wall_filters");
  assert.ok(retrievalWallFilters.count <= 5);

  const wallSubjectBindings = await fetchJson(`${url}/api/wall-subject-bindings?pre_retrieval_effect=allow&limit=5`);
  assert.equal(wallSubjectBindings.collection, "wall_subject_bindings");
  assert.ok(wallSubjectBindings.count <= 5);

  const conflictWallBindings = await fetchJson(`${url}/api/conflict-wall-bindings?conflict_check_status=ready&limit=5`);
  assert.equal(conflictWallBindings.collection, "conflict_wall_bindings");
  assert.ok(conflictWallBindings.count <= 5);

  const wallPolicyValidations = await fetchJson(`${url}/api/wall-policy-validations?status=passed&limit=5`);
  assert.equal(wallPolicyValidations.collection, "wall_policy_validations");
  assert.ok(wallPolicyValidations.count <= 5);

  const matterAccessPolicyEvaluators = await fetchJson(`${url}/api/matter-access-policy-evaluators?access_policy_status=complete&limit=1`);
  assert.equal(matterAccessPolicyEvaluators.collection, "matter_access_policy_evaluators");
  assert.ok(matterAccessPolicyEvaluators.count <= 1);

  const matterAccessPolicyRules = await fetchJson(`${url}/api/matter-access-policy-rules?enforcement_stage=pre_retrieval&limit=5`);
  assert.equal(matterAccessPolicyRules.collection, "matter_access_policy_rules");
  assert.ok(matterAccessPolicyRules.count <= 5);

  const matterAccessDecisions = await fetchJson(`${url}/api/matter-access-decisions?access_decision=allow&limit=5`);
  assert.equal(matterAccessDecisions.collection, "matter_access_decisions");
  assert.ok(matterAccessDecisions.count <= 5);

  const resourceAccessDecisions = await fetchJson(`${url}/api/resource-access-decisions?access_decision=review&limit=5`);
  assert.equal(resourceAccessDecisions.collection, "resource_access_decisions");
  assert.ok(resourceAccessDecisions.count <= 5);

  const runtimeAccessMatrix = await fetchJson(`${url}/api/runtime-access-matrix?runtime_id=harness&limit=5`);
  assert.equal(runtimeAccessMatrix.collection, "runtime_access_matrix");
  assert.ok(runtimeAccessMatrix.count <= 5);

  const matterAccessPolicyValidations = await fetchJson(`${url}/api/matter-access-policy-validations?status=passed&limit=5`);
  assert.equal(matterAccessPolicyValidations.collection, "matter_access_policy_validations");
  assert.ok(matterAccessPolicyValidations.count <= 5);

  const dataClassificationRuleEngines = await fetchJson(`${url}/api/data-classification-rule-engines?limit=1`);
  assert.equal(dataClassificationRuleEngines.collection, "data_classification_rule_engines");
  assert.ok(dataClassificationRuleEngines.count <= 1);

  const dataClassificationRules = await fetchJson(`${url}/api/data-classification-rules?classification=P2_CLIENT_CONFIDENTIAL&limit=5`);
  assert.equal(dataClassificationRules.collection, "data_classification_rules");
  assert.ok(dataClassificationRules.count <= 5);

  const resourceClassificationDecisions = await fetchJson(`${url}/api/resource-classification-decisions?resource_policy_decision=review&limit=5`);
  assert.equal(resourceClassificationDecisions.collection, "resource_classification_decisions");
  assert.ok(resourceClassificationDecisions.count <= 5);

  const classificationPolicyBindings = await fetchJson(`${url}/api/classification-policy-bindings?binding_status=complete&limit=5`);
  assert.equal(classificationPolicyBindings.collection, "classification_policy_bindings");
  assert.ok(classificationPolicyBindings.count <= 5);

  const dataClassificationRuleValidations = await fetchJson(`${url}/api/data-classification-rule-validations?status=passed&limit=5`);
  assert.equal(dataClassificationRuleValidations.collection, "data_classification_rule_validations");
  assert.ok(dataClassificationRuleValidations.count <= 5);

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
