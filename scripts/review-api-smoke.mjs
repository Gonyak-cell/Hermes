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
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-binding-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/approval-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-binding-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-event-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-run-gate-policy-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-policy-snapshot-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/run-policy-snapshot-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-policy-snapshot-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-snapshot-event-binding-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/event-envelope-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-envelopes"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-envelope-source-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-envelope-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-type-registries"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-types"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-families"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-type-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-type-registry-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/append-only-event-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/stored-events"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-streams"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-correction-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-store-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-correlation-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/correlation-traces"));
  assert.ok(index.routes.some((route) => route.path === "/api/causation-edges"));
  assert.ok(index.routes.some((route) => route.path === "/api/trace-run-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-correlation-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-state-transitions"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-event-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-io-references"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-artifact-references"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-log-references"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-event-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-run-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-permission-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-agent-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-event-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/tool-invocation-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-event-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-trail-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-separation-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-source-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/audit-event-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-cost-observability-contract-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-record-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-observation-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/trace-projection-v2-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-cost-observability-contract-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packet-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packets"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-retrieval-filters"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-context-builder-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-packet-v2-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-resource-selections"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-token-budgets"));
  assert.ok(index.routes.some((route) => route.path === "/api/context-citation-hints"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-context-builder-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-retrieval-compilers"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-request-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-candidate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-priority-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-guard-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-retrieval-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-prompt-injection-boundaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/untrusted-content-wrappers"));
  assert.ok(index.routes.some((route) => route.path === "/api/instruction-signal-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/prompt-boundary-guard-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/prompt-injection-boundary-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-pre-run-gate-frameworks"));
  assert.ok(index.routes.some((route) => route.path === "/api/pre-run-gate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/pre-run-gate-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/pre-run-gate-guards"));
  assert.ok(index.routes.some((route) => route.path === "/api/pre-run-gate-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-in-run-gate-frameworks"));
  assert.ok(index.routes.some((route) => route.path === "/api/in-run-gate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/in-run-block-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/in-run-guard-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/in-run-gate-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-post-run-gate-frameworks"));
  assert.ok(index.routes.some((route) => route.path === "/api/post-run-gate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/post-run-gate-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/post-run-gate-guards"));
  assert.ok(index.routes.some((route) => route.path === "/api/post-run-gate-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-result-aggregators"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-aggregate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-statuses"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-result-aggregate-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-apis"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-capabilities"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-versions"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/desktop-companion-route-groups"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-api-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/cost-record-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/projected-cost-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/run-cost-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-category-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/cost-record-projection-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/token-usage-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/projected-token-usage-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-token-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-token-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-runtime-token-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/token-usage-projection-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-trace-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-trace-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-trace-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-trace-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/gate-trace-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-trace-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-trace-projection-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-retry-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/projected-error-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/retry-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/timeout-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/resume-state-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/error-retry-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-replay-harnesses"));
  assert.ok(index.routes.some((route) => route.path === "/api/replayed-event-streams"));
  assert.ok(index.routes.some((route) => route.path === "/api/replayed-run-summaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/dashboard-replay-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/dashboard-replay-metrics"));
  assert.ok(index.routes.some((route) => route.path === "/api/event-replay-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/retention-archive-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/retention-policy-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/archive-candidate-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/legal-hold-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/retention-archive-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-api-dashboards"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-dashboard-panels"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-api-route-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-panel-metrics"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-cross-links"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-api-dashboard-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-golden-fixtures"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-golden-cases"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-fixture-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-regression-hashes"));
  assert.ok(index.routes.some((route) => route.path === "/api/ledger-golden-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-traces"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-loop-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-catalogs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-field-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-gate-runtime-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-policy-index"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-version-policy-index"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-manifest-compatibility"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-compatibility-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-dependency-edges"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-compatibility-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-manifest-compatibility-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-apis"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-capabilities"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-versions"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/desktop-companion-route-groups"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-api-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-dashboards"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-dashboard-panels"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-state-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-queue-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-gate-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-output-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-run-dashboard-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-golden-case-suites"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-golden-cases"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-golden-case-steps"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-golden-case-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-freeze-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-freeze-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-vertical-slices"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-loop-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/workflow-gate-freeze-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-adapter-interface-v2"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-adapter-interfaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-adapter-interface-fields"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-operator-surface-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-adapter-interface-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/hermes-runtime-adapter"));
  assert.ok(index.routes.some((route) => route.path === "/api/hermes-invocation-result-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/hermes-agent-run-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/hermes-runtime-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/hermes-runtime-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/claude-code-adapter-contract"));
  assert.ok(index.routes.some((route) => route.path === "/api/claude-code-diff-gate-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/claude-code-agent-run-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/claude-code-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/claude-code-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/codex-adapter-contract"));
  assert.ok(index.routes.some((route) => route.path === "/api/codex-patch-gate-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/codex-agent-run-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/codex-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/codex-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/local-script-adapter"));
  assert.ok(index.routes.some((route) => route.path === "/api/local-script-execution-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/local-script-agent-run-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/local-script-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/local-script-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/document-renderer-adapter"));
  assert.ok(index.routes.some((route) => route.path === "/api/document-renderer-output-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/document-renderer-agent-run-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/document-renderer-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/document-renderer-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/worktree-manager-v2"));
  assert.ok(index.routes.some((route) => route.path === "/api/agent-worktree-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/worktree-status-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/worktree-cleanup-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/worktree-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/worktree-manager-v2-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/sandbox-policy-model"));
  assert.ok(index.routes.some((route) => route.path === "/api/sandbox-backend-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-sandbox-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/sandbox-policy-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/sandbox-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/sandbox-policy-model-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/docker-local-backend-selector"));
  assert.ok(index.routes.some((route) => route.path === "/api/backend-selection-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-backend-selections"));
  assert.ok(index.routes.some((route) => route.path === "/api/classification-backend-selections"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-classification-backend-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/backend-selector-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/backend-selector-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/secrets-broker-contract"));
  assert.ok(index.routes.some((route) => route.path === "/api/secret-handle-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-secret-access-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/secret-audit-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/secrets-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/secrets-broker-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-artifact-capture"));
  assert.ok(index.routes.some((route) => route.path === "/api/artifact-capture-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/diff-capture-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/stream-capture-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/metadata-capture-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-artifact-capture-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-artifact-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-artifact-capture-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-log-normalization"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-runtime-logs"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-log-streams"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-log-search-documents"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-log-trace-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-log-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-log-normalization-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-timeout-heartbeat"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-heartbeat-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-timeout-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-lifecycle-ledger-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-heartbeat-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-timeout-heartbeat-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-commands"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-command-requests"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-command-results"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-audit-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/runtime-control-command-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-gate"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-gate-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-change-evaluations"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-approval-requirements"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-gate-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/protected-file-gate-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-runner"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-executions"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-gate-results"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-desktop-boundary"));
  assert.ok(index.routes.some((route) => route.path === "/api/canonical-test-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/issue-graph-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/issues"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-issue-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/legal-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/issue-legal-rule-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/risk-severity-assessments"));
  assert.ok(index.routes.some((route) => route.path === "/api/issue-review-queue"));
  assert.ok(index.routes.some((route) => route.path === "/api/issue-graph-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/issue-graph-store-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/citation-object-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/output-paragraphs"));
  assert.ok(index.routes.some((route) => route.path === "/api/citations"));
  assert.ok(index.routes.some((route) => route.path === "/api/paragraph-source-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/citation-review-queue"));
  assert.ok(index.routes.some((route) => route.path === "/api/citation-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/citation-object-store-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-graphs"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-nodes"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-edges"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-paths"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/lineage-graph-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-viewer-data"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-viewer-cards"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-viewer-source-spans"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-viewer-lineage-paths"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-viewer-data-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-bundles"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-bundle-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-source-packages"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-citation-packages"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-coverage-packages"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-export-bundle-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-coverage-scores"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-coverage-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-coverage-dimensions"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-coverage-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-coverage-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-flags"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-flag-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-flag-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-flag-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-flag-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/exhibit-maps"));
  assert.ok(index.routes.some((route) => route.path === "/api/exhibit-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/exhibit-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/exhibit-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/exhibit-map-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/custody-event-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/custody-events"));
  assert.ok(index.routes.some((route) => route.path === "/api/custody-event-links"));
  assert.ok(index.routes.some((route) => route.path === "/api/custody-stage-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/custody-event-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-index-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-index-manifests"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-index-fields"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-index-query-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-index-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/vector-index-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/vector-policy-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/embedding-route-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/vector-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-filter-compilers"));
  assert.ok(index.routes.some((route) => route.path === "/api/compiled-retrieval-filters"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-query-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-filter-probes"));
  assert.ok(index.routes.some((route) => route.path === "/api/retrieval-filter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-golden-fixtures"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-golden-cases"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-golden-store-matches"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-regression-tests"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-regression-suites"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-regression-test-cases"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-regression-hashes"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-regression-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-evidence-dashboard-summaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-evidence-panel-rows"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-evidence-matter-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-evidence-classification-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-evidence-dashboard-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-plane-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-plane-freeze-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-plane-freeze-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-plane-representative-traces"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-plane-freeze-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-golden-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-traces"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-loop-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/observability-freeze-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-catalogs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-field-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-gate-runtime-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-policy-index"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-version-policy-index"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-manifest-v2-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-manifest-compatibility"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-compatibility-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-dependency-edges"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-compatibility-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/pack-manifest-compatibility-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-apis"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-packs"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-capabilities"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-versions"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/desktop-companion-route-groups"));
  assert.ok(index.routes.some((route) => route.path === "/api/capability-registry-api-validations"));
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
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-decisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-candidates"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-confirmations"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-corrections"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-tagging-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/access-audit-projections"));
  assert.ok(index.routes.some((route) => route.path === "/api/access-audit-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/access-audit-actor-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/access-audit-resource-rollups"));
  assert.ok(index.routes.some((route) => route.path === "/api/access-audit-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/store-policy-adapters"));
  assert.ok(index.routes.some((route) => route.path === "/api/store-policy-rules"));
  assert.ok(index.routes.some((route) => route.path === "/api/rls-filter-templates"));
  assert.ok(index.routes.some((route) => route.path === "/api/store-query-plans"));
  assert.ok(index.routes.some((route) => route.path === "/api/store-enforcement-probes"));
  assert.ok(index.routes.some((route) => route.path === "/api/store-policy-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-check-interfaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-check-requests"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-check-results"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-check-signals"));
  assert.ok(index.routes.some((route) => route.path === "/api/conflict-check-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/personal-workspace-boundaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/workspace-boundaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/tenant-policy-boundaries"));
  assert.ok(index.routes.some((route) => route.path === "/api/search-namespace-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/cross-workspace-probes"));
  assert.ok(index.routes.some((route) => route.path === "/api/personal-workspace-boundary-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-golden-fixtures"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-fixture-cases"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-outcome-matrix"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-regression-hashes"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-golden-fixture-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-operation-surfaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-decision-rows"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-violation-rows"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-pending-approvals"));
  assert.ok(index.routes.some((route) => route.path === "/api/policy-surface-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-boundary-slices"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-boundary-resource-paths"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-boundary-retrieval-gates"));
  assert.ok(index.routes.some((route) => route.path === "/api/matter-boundary-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-policy-matter-freezes"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-policy-freeze-sources"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-policy-freeze-checkpoints"));
  assert.ok(index.routes.some((route) => route.path === "/api/identity-policy-freeze-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-store-interfaces"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-store-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-store-records"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-store-adapter-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-store-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/immutable-object-store-layouts"));
  assert.ok(index.routes.some((route) => route.path === "/api/object-path-resolvers"));
  assert.ok(index.routes.some((route) => route.path === "/api/raw-source-object-paths"));
  assert.ok(index.routes.some((route) => route.path === "/api/generated-output-object-paths"));
  assert.ok(index.routes.some((route) => route.path === "/api/object-store-collisions"));
  assert.ok(index.routes.some((route) => route.path === "/api/object-store-layout-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-ledgers"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-families"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-events"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-transitions"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-duplicate-candidates"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-object-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/resource-version-ledger-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-text-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-text-artifacts"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-text-location-maps"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-source-span-seeds"));
  assert.ok(index.routes.some((route) => route.path === "/api/normalized-text-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-adapter-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-adapters"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-io-contracts"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-document-type-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/ocr-fallback-policies"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-normalized-text-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/extractor-adapter-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-spans"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-locators"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-location-units"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/source-span-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-item-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-items"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-source-span-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-review-queue"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-item-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/evidence-item-store-validations"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-claim-stores"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-claims"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-evidence-bindings"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-review-queue"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-claim-indexes"));
  assert.ok(index.routes.some((route) => route.path === "/api/fact-claim-store-validations"));
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

  const policySnapshotBindingLedgers = await fetchJson(`${url}/api/policy-snapshot-binding-ledgers?policy_snapshot_binding_status=complete&limit=1`);
  assert.equal(policySnapshotBindingLedgers.collection, "policy_snapshot_binding_ledgers");
  assert.ok(policySnapshotBindingLedgers.count <= 1);

  const workflowPolicyBindings = await fetchJson(`${url}/api/workflow-policy-bindings?binding_source=source_declared&limit=5`);
  assert.equal(workflowPolicyBindings.collection, "workflow_policy_bindings");
  assert.ok(workflowPolicyBindings.count <= 5);

  const agentRunPolicyBindings = await fetchJson(`${url}/api/agent-run-policy-bindings?runtime_id=codex&limit=5`);
  assert.equal(agentRunPolicyBindings.collection, "agent_run_policy_bindings");
  assert.ok(agentRunPolicyBindings.count <= 5);

  const eventPolicyBindings = await fetchJson(`${url}/api/event-policy-bindings?policy_snapshot_known=true&limit=5`);
  assert.equal(eventPolicyBindings.collection, "event_policy_bindings");
  assert.ok(eventPolicyBindings.count <= 5);

  const gatePolicyBindings = await fetchJson(`${url}/api/gate-policy-bindings?binding_status=bound&limit=5`);
  assert.equal(gatePolicyBindings.collection, "gate_policy_bindings");
  assert.ok(gatePolicyBindings.count <= 5);

  const fallbackApprovalPolicyBindings = await fetchJson(`${url}/api/approval-policy-bindings?policy_snapshot_status=fallback_resolved&limit=5`);
  assert.equal(fallbackApprovalPolicyBindings.collection, "approval_policy_bindings");
  assert.ok(fallbackApprovalPolicyBindings.count <= 5);

  const outputPolicyBindings = await fetchJson(`${url}/api/output-policy-bindings?policy_snapshot_known=true&limit=5`);
  assert.equal(outputPolicyBindings.collection, "output_policy_bindings");
  assert.ok(outputPolicyBindings.count <= 5);

  const policySnapshotBindingValidations = await fetchJson(`${url}/api/policy-snapshot-binding-validations?status=passed&limit=5`);
  assert.equal(policySnapshotBindingValidations.collection, "policy_snapshot_binding_validations");
  assert.ok(policySnapshotBindingValidations.count <= 5);

  const policySnapshotEventBindings = await fetchJson(`${url}/api/policy-snapshot-event-bindings?policy_snapshot_event_binding_status=complete&limit=1`);
  assert.equal(policySnapshotEventBindings.collection, "policy_snapshot_event_bindings");
  assert.ok(policySnapshotEventBindings.count <= 1);

  const eventRunGatePolicyBindings = await fetchJson(`${url}/api/event-run-gate-policy-bindings?source_snapshot_presence_status=present&limit=5`);
  assert.equal(eventRunGatePolicyBindings.collection, "event_run_gate_policy_bindings");
  assert.ok(eventRunGatePolicyBindings.count <= 5);

  const eventPolicySnapshotBindings = await fetchJson(`${url}/api/event-policy-snapshot-bindings?stored_event_snapshot_status=stored_event_policy_snapshot_matched&limit=5`);
  assert.equal(eventPolicySnapshotBindings.collection, "event_policy_snapshot_bindings");
  assert.ok(eventPolicySnapshotBindings.count <= 5);

  const runPolicySnapshotBindings = await fetchJson(`${url}/api/run-policy-snapshot-bindings?subject_type=run_ledger&limit=5`);
  assert.equal(runPolicySnapshotBindings.collection, "run_policy_snapshot_bindings");
  assert.ok(runPolicySnapshotBindings.count <= 5);

  const gatePolicySnapshotBindings = await fetchJson(`${url}/api/gate-policy-snapshot-bindings?gate_event_binding_status=linked_to_event_record&limit=5`);
  assert.equal(gatePolicySnapshotBindings.collection, "gate_policy_snapshot_bindings");
  assert.ok(gatePolicySnapshotBindings.count <= 5);

  const policySnapshotEventBindingValidations = await fetchJson(`${url}/api/policy-snapshot-event-binding-validations?status=passed&limit=5`);
  assert.equal(policySnapshotEventBindingValidations.collection, "policy_snapshot_event_binding_validations");
  assert.ok(policySnapshotEventBindingValidations.count <= 5);

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

  const capabilityManifestV2Catalogs = await fetchJson(`${url}/api/capability-manifest-v2-catalogs?capability_manifest_v2_status=complete&limit=1`);
  assert.equal(capabilityManifestV2Catalogs.collection, "capability_manifest_v2_catalogs");
  assert.ok(capabilityManifestV2Catalogs.count <= 1);

  const capabilityManifestV2Records = await fetchJson(`${url}/api/capability-manifest-v2-records?domain_pack=law-firm&limit=5`);
  assert.equal(capabilityManifestV2Records.collection, "capability_manifest_v2_records");
  assert.ok(capabilityManifestV2Records.count <= 5);

  const capabilityManifestFieldMatrix = await fetchJson(`${url}/api/capability-manifest-field-matrix?field_status=complete&limit=5`);
  assert.equal(capabilityManifestFieldMatrix.collection, "capability_manifest_field_matrix");
  assert.ok(capabilityManifestFieldMatrix.count <= 5);

  const capabilityManifestGateRuntimeMatrix = await fetchJson(`${url}/api/capability-manifest-gate-runtime-matrix?gate_runtime_status=complete&limit=5`);
  assert.equal(capabilityManifestGateRuntimeMatrix.collection, "capability_manifest_gate_runtime_matrix");
  assert.ok(capabilityManifestGateRuntimeMatrix.count <= 5);

  const capabilityManifestPolicyIndex = await fetchJson(`${url}/api/capability-manifest-policy-index?policy_status=complete&limit=5`);
  assert.equal(capabilityManifestPolicyIndex.collection, "capability_manifest_policy_index");
  assert.ok(capabilityManifestPolicyIndex.count <= 5);

  const capabilityManifestVersionPolicyIndex = await fetchJson(`${url}/api/capability-manifest-version-policy-index?version_status=complete&limit=5`);
  assert.equal(capabilityManifestVersionPolicyIndex.collection, "capability_manifest_version_policy_index");
  assert.ok(capabilityManifestVersionPolicyIndex.count <= 5);

  const capabilityManifestV2Validations = await fetchJson(`${url}/api/capability-manifest-v2-validations?status=passed&limit=5`);
  assert.equal(capabilityManifestV2Validations.collection, "capability_manifest_v2_validations");
  assert.ok(capabilityManifestV2Validations.count <= 5);

  const packManifestCompatibility = await fetchJson(`${url}/api/pack-manifest-compatibility?compatibility_status=complete&limit=1`);
  assert.equal(packManifestCompatibility.collection, "pack_manifest_compatibility");
  assert.ok(packManifestCompatibility.count <= 1);

  const packCompatibilityRecords = await fetchJson(`${url}/api/pack-compatibility-records?compatibility_status=compatible&limit=5`);
  assert.equal(packCompatibilityRecords.collection, "pack_compatibility_records");
  assert.ok(packCompatibilityRecords.count <= 5);

  const packDependencyEdges = await fetchJson(`${url}/api/pack-dependency-edges?dependency_status=satisfied&limit=5`);
  assert.equal(packDependencyEdges.collection, "pack_dependency_edges");
  assert.ok(packDependencyEdges.count <= 5);

  const packCompatibilityMatrix = await fetchJson(`${url}/api/pack-compatibility-matrix?compatibility_status=compatible&limit=5`);
  assert.equal(packCompatibilityMatrix.collection, "pack_compatibility_matrix");
  assert.ok(packCompatibilityMatrix.count <= 5);

  const packManifestCompatibilityValidations = await fetchJson(`${url}/api/pack-manifest-compatibility-validations?status=passed&limit=5`);
  assert.equal(packManifestCompatibilityValidations.collection, "pack_manifest_compatibility_validations");
  assert.ok(packManifestCompatibilityValidations.count <= 5);

  const capabilityRegistryApis = await fetchJson(`${url}/api/capability-registry-apis?capability_registry_api_status=complete&limit=1`);
  assert.equal(capabilityRegistryApis.collection, "capability_registry_apis");
  assert.ok(capabilityRegistryApis.count <= 1);

  const capabilityRegistryPacks = await fetchJson(`${url}/api/capability-registry-packs?pack_id=law-firm&limit=2`);
  assert.equal(capabilityRegistryPacks.collection, "pack_api_cards");
  assert.ok(capabilityRegistryPacks.count <= 2);

  const capabilityRegistryCapabilities = await fetchJson(`${url}/api/capability-registry-capabilities?domain_pack=law-firm&limit=5`);
  assert.equal(capabilityRegistryCapabilities.collection, "capability_api_cards");
  assert.ok(capabilityRegistryCapabilities.count <= 5);

  const capabilityRegistryVersions = await fetchJson(`${url}/api/capability-registry-versions?version_status=complete&limit=5`);
  assert.equal(capabilityRegistryVersions.collection, "capability_version_api_cards");
  assert.ok(capabilityRegistryVersions.count <= 5);

  const capabilityRegistryGates = await fetchJson(`${url}/api/capability-registry-gates?gate_id=human_approval_gate&limit=5`);
  assert.equal(capabilityRegistryGates.collection, "gate_requirement_api_cards");
  assert.ok(capabilityRegistryGates.count <= 5);

  const desktopCompanionRouteGroups = await fetchJson(`${url}/api/desktop-companion-route-groups?desktop_surface=approvals&limit=2`);
  assert.equal(desktopCompanionRouteGroups.collection, "desktop_companion_route_groups");
  assert.ok(desktopCompanionRouteGroups.count <= 2);

  const capabilityRegistryApiValidations = await fetchJson(`${url}/api/capability-registry-api-validations?status=passed&limit=5`);
  assert.equal(capabilityRegistryApiValidations.collection, "capability_registry_api_validations");
  assert.ok(capabilityRegistryApiValidations.count <= 5);

  const workflowRunDashboards = await fetchJson(`${url}/api/workflow-run-dashboards?workflow_run_dashboard_status=complete&limit=1`);
  assert.equal(workflowRunDashboards.collection, "workflow_run_dashboards");
  assert.ok(workflowRunDashboards.count <= 1);

  const workflowRunDashboardPanels = await fetchJson(`${url}/api/workflow-run-dashboard-panels?desktop_card_status=human_review_required&limit=5`);
  assert.equal(workflowRunDashboardPanels.collection, "workflow_run_dashboard_panels");
  assert.ok(workflowRunDashboardPanels.count <= 5);

  const workflowRunStateCards = await fetchJson(`${url}/api/workflow-run-state-cards?dsl_current_state=waiting&limit=5`);
  assert.equal(workflowRunStateCards.collection, "workflow_run_state_cards");
  assert.ok(workflowRunStateCards.count <= 5);

  const workflowRunQueueCards = await fetchJson(`${url}/api/workflow-run-queue-cards?queue_status=held_for_human_review&limit=5`);
  assert.equal(workflowRunQueueCards.collection, "workflow_run_queue_cards");
  assert.ok(workflowRunQueueCards.count <= 5);

  const workflowRunGateCards = await fetchJson(`${url}/api/workflow-run-gate-cards?workflow_gate_status=manual_review_required&limit=5`);
  assert.equal(workflowRunGateCards.collection, "workflow_run_gate_cards");
  assert.ok(workflowRunGateCards.count <= 5);

  const workflowRunOutputCards = await fetchJson(`${url}/api/workflow-run-output-cards?domain_pack=law-firm&limit=5`);
  assert.equal(workflowRunOutputCards.collection, "workflow_run_output_cards");
  assert.ok(workflowRunOutputCards.count <= 5);

  const workflowRunDashboardValidations = await fetchJson(`${url}/api/workflow-run-dashboard-validations?status=passed&limit=5`);
  assert.equal(workflowRunDashboardValidations.collection, "workflow_run_dashboard_validations");
  assert.ok(workflowRunDashboardValidations.count <= 5);

  const workflowGoldenCaseSuites = await fetchJson(`${url}/api/workflow-golden-case-suites?workflow_golden_case_status=complete&limit=1`);
  assert.equal(workflowGoldenCaseSuites.collection, "workflow_golden_case_suites");
  assert.ok(workflowGoldenCaseSuites.count <= 1);

  const workflowGoldenCases = await fetchJson(`${url}/api/workflow-golden-cases?state_machine_pass_status=passed&limit=5`);
  assert.equal(workflowGoldenCases.collection, "workflow_golden_cases");
  assert.ok(workflowGoldenCases.count <= 5);

  const workflowGoldenCaseSteps = await fetchJson(`${url}/api/workflow-golden-case-steps?state_machine_step_status=passed&limit=5`);
  assert.equal(workflowGoldenCaseSteps.collection, "workflow_golden_case_steps");
  assert.ok(workflowGoldenCaseSteps.count <= 5);

  const workflowGoldenCaseValidations = await fetchJson(`${url}/api/workflow-golden-case-validations?status=passed&limit=5`);
  assert.equal(workflowGoldenCaseValidations.collection, "workflow_golden_case_validations");
  assert.ok(workflowGoldenCaseValidations.count <= 5);

  const workflowGateFreezes = await fetchJson(`${url}/api/workflow-gate-freezes?workflow_gate_freeze_status=complete&limit=1`);
  assert.equal(workflowGateFreezes.collection, "workflow_gate_freezes");
  assert.ok(workflowGateFreezes.count <= 1);

  const workflowGateFreezeSources = await fetchJson(`${url}/api/workflow-gate-freeze-sources?source_status=passed&limit=5`);
  assert.equal(workflowGateFreezeSources.collection, "workflow_gate_freeze_sources");
  assert.ok(workflowGateFreezeSources.count <= 5);

  const workflowGateFreezeCheckpoints = await fetchJson(`${url}/api/workflow-gate-freeze-checkpoints?checkpoint_status=passed&limit=5`);
  assert.equal(workflowGateFreezeCheckpoints.collection, "workflow_gate_freeze_checkpoints");
  assert.ok(workflowGateFreezeCheckpoints.count <= 5);

  const workflowGateVerticalSlices = await fetchJson(`${url}/api/workflow-gate-vertical-slices?workflow_gate_vertical_slice_status=passed&limit=5`);
  assert.equal(workflowGateVerticalSlices.collection, "workflow_gate_vertical_slices");
  assert.ok(workflowGateVerticalSlices.count <= 5);

  const workflowGateLoopBindings = await fetchJson(`${url}/api/workflow-gate-loop-bindings?loop_binding_status=passed&limit=5`);
  assert.equal(workflowGateLoopBindings.collection, "workflow_gate_loop_bindings");
  assert.ok(workflowGateLoopBindings.count <= 5);

  const workflowGateFreezeValidations = await fetchJson(`${url}/api/workflow-gate-freeze-validations?status=passed&limit=5`);
  assert.equal(workflowGateFreezeValidations.collection, "workflow_gate_freeze_validations");
  assert.ok(workflowGateFreezeValidations.count <= 5);

  const workflowDslStateModels = await fetchJson(`${url}/api/workflow-dsl-state-models?workflow_dsl_state_model_status=complete&limit=1`);
  assert.equal(workflowDslStateModels.collection, "workflow_dsl_state_models");
  assert.ok(workflowDslStateModels.count <= 1);

  const workflowDslStates = await fetchJson(`${url}/api/workflow-dsl-states?dsl_state=waiting&limit=1`);
  assert.equal(workflowDslStates.collection, "workflow_dsl_states");
  assert.ok(workflowDslStates.count <= 1);

  const workflowDslTransitionRules = await fetchJson(`${url}/api/workflow-dsl-transition-rules?from_state=started&limit=5`);
  assert.equal(workflowDslTransitionRules.collection, "workflow_dsl_transition_rules");
  assert.ok(workflowDslTransitionRules.count <= 5);

  const workflowStateBlueprints = await fetchJson(`${url}/api/workflow-state-blueprints?domain_pack=law-firm&limit=5`);
  assert.equal(workflowStateBlueprints.collection, "workflow_state_blueprints");
  assert.ok(workflowStateBlueprints.count <= 5);

  const workflowRunStateProjections = await fetchJson(`${url}/api/workflow-run-state-projections?dsl_current_state=waiting&limit=5`);
  assert.equal(workflowRunStateProjections.collection, "workflow_run_state_projections");
  assert.ok(workflowRunStateProjections.count <= 5);

  const workflowDslStateValidations = await fetchJson(`${url}/api/workflow-dsl-state-validations?status=passed&limit=5`);
  assert.equal(workflowDslStateValidations.collection, "workflow_dsl_state_validations");
  assert.ok(workflowDslStateValidations.count <= 5);

  const workflowStateMachineRunners = await fetchJson(`${url}/api/workflow-state-machine-runners?workflow_state_machine_runner_status=complete&limit=1`);
  assert.equal(workflowStateMachineRunners.collection, "workflow_state_machine_runners");
  assert.ok(workflowStateMachineRunners.count <= 1);

  const workflowTransitionGuards = await fetchJson(`${url}/api/workflow-transition-guards?transition_guard_status=waiting&limit=5`);
  assert.equal(workflowTransitionGuards.collection, "workflow_transition_guards");
  assert.ok(workflowTransitionGuards.count <= 5);

  const workflowRunnerAuditEvents = await fetchJson(`${url}/api/workflow-runner-audit-events?audit_status=ready&limit=5`);
  assert.equal(workflowRunnerAuditEvents.collection, "workflow_runner_audit_events");
  assert.ok(workflowRunnerAuditEvents.count <= 5);

  const workflowRunnerPlans = await fetchJson(`${url}/api/workflow-runner-plans?runner_plan_status=waiting&limit=5`);
  assert.equal(workflowRunnerPlans.collection, "workflow_runner_plans");
  assert.ok(workflowRunnerPlans.count <= 5);

  const workflowRunnerValidations = await fetchJson(`${url}/api/workflow-runner-validations?status=passed&limit=5`);
  assert.equal(workflowRunnerValidations.collection, "workflow_runner_validations");
  assert.ok(workflowRunnerValidations.count <= 5);

  const workflowQueueRetryBackoffContracts = await fetchJson(`${url}/api/workflow-queue-retry-backoff-contracts?workflow_queue_retry_backoff_status=complete&limit=1`);
  assert.equal(workflowQueueRetryBackoffContracts.collection, "workflow_queue_retry_backoff_contracts");
  assert.ok(workflowQueueRetryBackoffContracts.count <= 1);

  const workflowQueueRecords = await fetchJson(`${url}/api/workflow-queue-records?queue_status=held_for_human_review&limit=5`);
  assert.equal(workflowQueueRecords.collection, "workflow_queue_records");
  assert.ok(workflowQueueRecords.count <= 5);

  const workflowRetryClassifications = await fetchJson(`${url}/api/workflow-retry-classifications?retry_class=retryable_requires_human_gate&limit=5`);
  assert.equal(workflowRetryClassifications.collection, "workflow_retry_classifications");
  assert.ok(workflowRetryClassifications.count <= 5);

  const workflowBackoffPolicies = await fetchJson(`${url}/api/workflow-backoff-policies?schedule_status=not_scheduled&limit=5`);
  assert.equal(workflowBackoffPolicies.collection, "workflow_backoff_policies");
  assert.ok(workflowBackoffPolicies.count <= 5);

  const workflowQueueValidations = await fetchJson(`${url}/api/workflow-queue-validations?status=passed&limit=5`);
  assert.equal(workflowQueueValidations.collection, "workflow_queue_validations");
  assert.ok(workflowQueueValidations.count <= 5);

  const workflowIdempotencyLedgers = await fetchJson(`${url}/api/workflow-idempotency-ledgers?workflow_idempotency_status=complete&limit=1`);
  assert.equal(workflowIdempotencyLedgers.collection, "workflow_idempotency_ledgers");
  assert.ok(workflowIdempotencyLedgers.count <= 1);

  const workflowIdempotencyKeys = await fetchJson(`${url}/api/workflow-idempotency-keys?key_status=registered_existing_run&limit=5`);
  assert.equal(workflowIdempotencyKeys.collection, "workflow_idempotency_keys");
  assert.ok(workflowIdempotencyKeys.count <= 5);

  const workflowIdempotencyDecisions = await fetchJson(`${url}/api/workflow-idempotency-decisions?idempotency_decision=skipped_duplicate&limit=5`);
  assert.equal(workflowIdempotencyDecisions.collection, "workflow_idempotency_decisions");
  assert.ok(workflowIdempotencyDecisions.count <= 5);

  const workflowDuplicateProbes = await fetchJson(`${url}/api/workflow-duplicate-probes?duplicate_probe_status=skipped_duplicate&limit=5`);
  assert.equal(workflowDuplicateProbes.collection, "workflow_duplicate_probes");
  assert.ok(workflowDuplicateProbes.count <= 5);

  const workflowIdempotencyValidations = await fetchJson(`${url}/api/workflow-idempotency-validations?status=passed&limit=5`);
  assert.equal(workflowIdempotencyValidations.collection, "workflow_idempotency_validations");
  assert.ok(workflowIdempotencyValidations.count <= 5);

  const workflowResumeCancelContracts = await fetchJson(`${url}/api/workflow-resume-cancel-contracts?workflow_resume_cancel_status=complete&limit=1`);
  assert.equal(workflowResumeCancelContracts.collection, "workflow_resume_cancel_contracts");
  assert.ok(workflowResumeCancelContracts.count <= 1);

  const workflowResumeCursors = await fetchJson(`${url}/api/workflow-resume-cursors?resume_state=held_waiting_for_human_gate&limit=5`);
  assert.equal(workflowResumeCursors.collection, "workflow_resume_cursors");
  assert.ok(workflowResumeCursors.count <= 5);

  const workflowCancelRequests = await fetchJson(`${url}/api/workflow-cancel-requests?cancel_state=cancel_requested_safe_hold&limit=5`);
  assert.equal(workflowCancelRequests.collection, "workflow_cancel_requests");
  assert.ok(workflowCancelRequests.count <= 5);

  const workflowResumeCancelDecisions = await fetchJson(`${url}/api/workflow-resume-cancel-decisions?control_decision=cancel_request_recorded_safe_hold&limit=5`);
  assert.equal(workflowResumeCancelDecisions.collection, "workflow_resume_cancel_decisions");
  assert.ok(workflowResumeCancelDecisions.count <= 5);

  const workflowResumeCancelValidations = await fetchJson(`${url}/api/workflow-resume-cancel-validations?status=passed&limit=5`);
  assert.equal(workflowResumeCancelValidations.collection, "workflow_resume_cancel_validations");
  assert.ok(workflowResumeCancelValidations.count <= 5);

  const workflowContextBuilderContracts = await fetchJson(`${url}/api/workflow-context-builder-contracts?workflow_context_builder_status=complete&limit=1`);
  assert.equal(workflowContextBuilderContracts.collection, "workflow_context_builder_contracts");
  assert.ok(workflowContextBuilderContracts.count <= 1);

  const contextPacketV2Records = await fetchJson(`${url}/api/context-packet-v2-records?context_packet_v2_status=held_for_human_gate&limit=5`);
  assert.equal(contextPacketV2Records.collection, "context_packet_v2_records");
  assert.ok(contextPacketV2Records.count <= 5);

  const contextResourceSelections = await fetchJson(`${url}/api/context-resource-selections?selection_decision=accessible_resource&limit=5`);
  assert.equal(contextResourceSelections.collection, "context_resource_selections");
  assert.ok(contextResourceSelections.count <= 5);

  const contextTokenBudgets = await fetchJson(`${url}/api/context-token-budgets?token_budget_status=within_budget&limit=5`);
  assert.equal(contextTokenBudgets.collection, "context_token_budgets");
  assert.ok(contextTokenBudgets.count <= 5);

  const contextCitationHints = await fetchJson(`${url}/api/context-citation-hints?citation_hint_status=citation_hints_ready&limit=5`);
  assert.equal(contextCitationHints.collection, "context_citation_hints");
  assert.ok(contextCitationHints.count <= 5);

  const workflowContextBuilderValidations = await fetchJson(`${url}/api/workflow-context-builder-validations?status=passed&limit=5`);
  assert.equal(workflowContextBuilderValidations.collection, "workflow_context_builder_validations");
  assert.ok(workflowContextBuilderValidations.count <= 5);

  const workflowRetrievalCompilers = await fetchJson(`${url}/api/workflow-retrieval-compilers?workflow_retrieval_compiler_status=complete&limit=1`);
  assert.equal(workflowRetrievalCompilers.collection, "workflow_retrieval_compilers");
  assert.ok(workflowRetrievalCompilers.count <= 1);

  const retrievalRequestRecords = await fetchJson(`${url}/api/retrieval-request-records?retrieval_request_status=compiled_held_for_query_adapter&limit=5`);
  assert.equal(retrievalRequestRecords.collection, "retrieval_request_records");
  assert.ok(retrievalRequestRecords.count <= 5);

  const retrievalCandidateRecords = await fetchJson(`${url}/api/retrieval-candidate-records?retrieval_candidate_status=ranked_source_span_candidate&limit=5`);
  assert.equal(retrievalCandidateRecords.collection, "retrieval_candidate_records");
  assert.ok(retrievalCandidateRecords.count <= 5);

  const sourceSpanPriorityRecords = await fetchJson(`${url}/api/source-span-priority-records?source_span_priority_status=applied&limit=5`);
  assert.equal(sourceSpanPriorityRecords.collection, "source_span_priority_records");
  assert.ok(sourceSpanPriorityRecords.count <= 5);

  const retrievalGuardRecords = await fetchJson(`${url}/api/retrieval-guard-records?retrieval_guard_status=passed&limit=5`);
  assert.equal(retrievalGuardRecords.collection, "retrieval_guard_records");
  assert.ok(retrievalGuardRecords.count <= 5);

  const workflowRetrievalValidations = await fetchJson(`${url}/api/workflow-retrieval-validations?status=passed&limit=5`);
  assert.equal(workflowRetrievalValidations.collection, "workflow_retrieval_validations");
  assert.ok(workflowRetrievalValidations.count <= 5);

  const workflowPromptInjectionBoundaries = await fetchJson(`${url}/api/workflow-prompt-injection-boundaries?workflow_prompt_injection_boundary_status=complete&limit=1`);
  assert.equal(workflowPromptInjectionBoundaries.collection, "workflow_prompt_injection_boundaries");
  assert.ok(workflowPromptInjectionBoundaries.count <= 1);

  const untrustedContentWrappers = await fetchJson(`${url}/api/untrusted-content-wrappers?wrapper_status=wrapped_as_untrusted_evidence_content&limit=5`);
  assert.equal(untrustedContentWrappers.collection, "untrusted_content_wrappers");
  assert.ok(untrustedContentWrappers.count <= 5);

  const instructionSignalRecords = await fetchJson(`${url}/api/instruction-signal-records?instruction_signal_status=no_instruction_signal_detected&limit=5`);
  assert.equal(instructionSignalRecords.collection, "instruction_signal_records");
  assert.ok(instructionSignalRecords.count <= 5);

  const promptBoundaryGuardRecords = await fetchJson(`${url}/api/prompt-boundary-guard-records?prompt_boundary_guard_status=passed&limit=5`);
  assert.equal(promptBoundaryGuardRecords.collection, "prompt_boundary_guard_records");
  assert.ok(promptBoundaryGuardRecords.count <= 5);

  const promptInjectionBoundaryValidations = await fetchJson(`${url}/api/prompt-injection-boundary-validations?status=passed&limit=5`);
  assert.equal(promptInjectionBoundaryValidations.collection, "prompt_injection_boundary_validations");
  assert.ok(promptInjectionBoundaryValidations.count <= 5);

  const workflowPreRunGateFrameworks = await fetchJson(`${url}/api/workflow-pre-run-gate-frameworks?workflow_pre_run_gate_framework_status=complete&limit=1`);
  assert.equal(workflowPreRunGateFrameworks.collection, "workflow_pre_run_gate_frameworks");
  assert.ok(workflowPreRunGateFrameworks.count <= 1);

  const preRunGateRecords = await fetchJson(`${url}/api/pre-run-gate-records?gate_type=access_gate&limit=5`);
  assert.equal(preRunGateRecords.collection, "pre_run_gate_records");
  assert.ok(preRunGateRecords.count <= 5);

  const preRunGateDecisions = await fetchJson(`${url}/api/pre-run-gate-decisions?pre_run_gate_decision=hold_for_human_review&limit=5`);
  assert.equal(preRunGateDecisions.collection, "pre_run_gate_decisions");
  assert.ok(preRunGateDecisions.count <= 5);

  const preRunGateGuards = await fetchJson(`${url}/api/pre-run-gate-guards?pre_run_guard_status=passed&limit=5`);
  assert.equal(preRunGateGuards.collection, "pre_run_gate_guards");
  assert.ok(preRunGateGuards.count <= 5);

  const preRunGateValidations = await fetchJson(`${url}/api/pre-run-gate-validations?status=passed&limit=5`);
  assert.equal(preRunGateValidations.collection, "pre_run_gate_validations");
  assert.ok(preRunGateValidations.count <= 5);

  const workflowInRunGateFrameworks = await fetchJson(`${url}/api/workflow-in-run-gate-frameworks?workflow_in_run_gate_framework_status=complete&limit=1`);
  assert.equal(workflowInRunGateFrameworks.collection, "workflow_in_run_gate_frameworks");
  assert.ok(workflowInRunGateFrameworks.count <= 1);

  const inRunGateRecords = await fetchJson(`${url}/api/in-run-gate-records?gate_type=dangerous_command_gate&limit=5`);
  assert.equal(inRunGateRecords.collection, "in_run_gate_records");
  assert.ok(inRunGateRecords.count <= 5);

  const inRunBlockRecords = await fetchJson(`${url}/api/in-run-block-records?in_run_block_status=blocked&limit=5`);
  assert.equal(inRunBlockRecords.collection, "in_run_block_records");
  assert.ok(inRunBlockRecords.count <= 5);

  const inRunGuardRecords = await fetchJson(`${url}/api/in-run-guard-records?in_run_guard_status=passed&limit=5`);
  assert.equal(inRunGuardRecords.collection, "in_run_guard_records");
  assert.ok(inRunGuardRecords.count <= 5);

  const inRunGateValidations = await fetchJson(`${url}/api/in-run-gate-validations?status=passed&limit=5`);
  assert.equal(inRunGateValidations.collection, "in_run_gate_validations");
  assert.ok(inRunGateValidations.count <= 5);

  const workflowPostRunGateFrameworks = await fetchJson(`${url}/api/workflow-post-run-gate-frameworks?workflow_post_run_gate_framework_status=complete&limit=1`);
  assert.equal(workflowPostRunGateFrameworks.collection, "workflow_post_run_gate_frameworks");
  assert.ok(workflowPostRunGateFrameworks.count <= 1);

  const postRunGateRecords = await fetchJson(`${url}/api/post-run-gate-records?gate_type=evidence_gate&limit=5`);
  assert.equal(postRunGateRecords.collection, "post_run_gate_records");
  assert.ok(postRunGateRecords.count <= 5);

  const postRunGateDecisions = await fetchJson(`${url}/api/post-run-gate-decisions?post_run_gate_decision=hold_for_human_review&limit=5`);
  assert.equal(postRunGateDecisions.collection, "post_run_gate_decisions");
  assert.ok(postRunGateDecisions.count <= 5);

  const postRunGateGuards = await fetchJson(`${url}/api/post-run-gate-guards?post_run_guard_status=passed&limit=5`);
  assert.equal(postRunGateGuards.collection, "post_run_gate_guards");
  assert.ok(postRunGateGuards.count <= 5);

  const postRunGateValidations = await fetchJson(`${url}/api/post-run-gate-validations?status=passed&limit=5`);
  assert.equal(postRunGateValidations.collection, "post_run_gate_validations");
  assert.ok(postRunGateValidations.count <= 5);

  const gateResultAggregators = await fetchJson(`${url}/api/gate-result-aggregators?gate_result_aggregator_status=complete&limit=1`);
  assert.equal(gateResultAggregators.collection, "gate_result_aggregators");
  assert.ok(gateResultAggregators.count <= 1);

  const manualGateAggregateRecords = await fetchJson(`${url}/api/gate-aggregate-records?aggregate_gate_state=manual&limit=5`);
  assert.equal(manualGateAggregateRecords.collection, "gate_aggregate_records");
  assert.ok(manualGateAggregateRecords.count <= 5);

  const workflowGateStatuses = await fetchJson(`${url}/api/workflow-gate-statuses?workflow_gate_status=manual_review_required&limit=5`);
  assert.equal(workflowGateStatuses.collection, "workflow_gate_statuses");
  assert.ok(workflowGateStatuses.count <= 5);

  const gateResultAggregateValidations = await fetchJson(`${url}/api/gate-result-aggregate-validations?status=passed&limit=5`);
  assert.equal(gateResultAggregateValidations.collection, "gate_result_aggregate_validations");
  assert.ok(gateResultAggregateValidations.count <= 5);

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

  const runtimeAdapterInterfaceV2 = await fetchJson(`${url}/api/runtime-adapter-interface-v2?runtime_adapter_interface_status=complete&limit=1`);
  assert.equal(runtimeAdapterInterfaceV2.collection, "runtime_adapter_interface_v2");
  assert.ok(runtimeAdapterInterfaceV2.count <= 1);

  const runtimeAdapterInterfaces = await fetchJson(`${url}/api/runtime-adapter-interfaces?interface_status=locked&limit=5`);
  assert.equal(runtimeAdapterInterfaces.collection, "runtime_adapter_interfaces");
  assert.ok(runtimeAdapterInterfaces.count <= 5);

  const runtimeAdapterInterfaceFields = await fetchJson(`${url}/api/runtime-adapter-interface-fields?lock_status=locked&limit=5`);
  assert.equal(runtimeAdapterInterfaceFields.collection, "runtime_adapter_interface_fields");
  assert.ok(runtimeAdapterInterfaceFields.count <= 5);

  const runtimeOperatorSurfacePolicies = await fetchJson(`${url}/api/runtime-operator-surface-policies?desktop_surface_policy=read_only_runtime_status&read_only=true&limit=5`);
  assert.equal(runtimeOperatorSurfacePolicies.collection, "runtime_operator_surface_policies");
  assert.ok(runtimeOperatorSurfacePolicies.count <= 5);

  const runtimeAdapterInterfaceValidations = await fetchJson(`${url}/api/runtime-adapter-interface-validations?status=passed&limit=5`);
  assert.equal(runtimeAdapterInterfaceValidations.collection, "runtime_adapter_interface_validations");
  assert.ok(runtimeAdapterInterfaceValidations.count <= 5);

  const hermesRuntimeAdapter = await fetchJson(`${url}/api/hermes-runtime-adapter?hermes_runtime_adapter_status=complete&limit=1`);
  assert.equal(hermesRuntimeAdapter.collection, "hermes_runtime_adapter");
  assert.ok(hermesRuntimeAdapter.count <= 1);

  const hermesInvocationResultContracts = await fetchJson(`${url}/api/hermes-invocation-result-contracts?collection_status=ready&limit=5`);
  assert.equal(hermesInvocationResultContracts.collection, "hermes_invocation_result_contracts");
  assert.ok(hermesInvocationResultContracts.count <= 5);

  const hermesAgentRunLedgerBindings = await fetchJson(`${url}/api/hermes-agent-run-ledger-bindings?binding_status=locked&limit=5`);
  assert.equal(hermesAgentRunLedgerBindings.collection, "hermes_agent_run_ledger_bindings");
  assert.ok(hermesAgentRunLedgerBindings.count <= 5);

  const hermesRuntimeDesktopBoundary = await fetchJson(`${url}/api/hermes-runtime-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(hermesRuntimeDesktopBoundary.collection, "hermes_runtime_desktop_boundary");
  assert.ok(hermesRuntimeDesktopBoundary.count <= 1);

  const hermesRuntimeAdapterValidations = await fetchJson(`${url}/api/hermes-runtime-adapter-validations?status=passed&limit=5`);
  assert.equal(hermesRuntimeAdapterValidations.collection, "hermes_runtime_adapter_validations");
  assert.ok(hermesRuntimeAdapterValidations.count <= 5);

  const claudeCodeAdapterContract = await fetchJson(`${url}/api/claude-code-adapter-contract?claude_code_adapter_contract_status=complete&limit=1`);
  assert.equal(claudeCodeAdapterContract.collection, "claude_code_adapter_contract");
  assert.ok(claudeCodeAdapterContract.count <= 1);

  const claudeCodeDiffGateContracts = await fetchJson(`${url}/api/claude-code-diff-gate-contracts?contract_status=locked&limit=5`);
  assert.equal(claudeCodeDiffGateContracts.collection, "claude_code_diff_gate_contracts");
  assert.ok(claudeCodeDiffGateContracts.count <= 5);

  const claudeCodeAgentRunLedgerBindings = await fetchJson(`${url}/api/claude-code-agent-run-ledger-bindings?binding_status=locked&limit=5`);
  assert.equal(claudeCodeAgentRunLedgerBindings.collection, "claude_code_agent_run_ledger_bindings");
  assert.ok(claudeCodeAgentRunLedgerBindings.count <= 5);

  const claudeCodeDesktopBoundary = await fetchJson(`${url}/api/claude-code-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(claudeCodeDesktopBoundary.collection, "claude_code_desktop_boundary");
  assert.ok(claudeCodeDesktopBoundary.count <= 1);

  const claudeCodeAdapterValidations = await fetchJson(`${url}/api/claude-code-adapter-validations?status=passed&limit=5`);
  assert.equal(claudeCodeAdapterValidations.collection, "claude_code_adapter_validations");
  assert.ok(claudeCodeAdapterValidations.count <= 5);

  const codexAdapterContract = await fetchJson(`${url}/api/codex-adapter-contract?codex_adapter_contract_status=complete&limit=1`);
  assert.equal(codexAdapterContract.collection, "codex_adapter_contract");
  assert.ok(codexAdapterContract.count <= 1);

  const codexPatchGateContracts = await fetchJson(`${url}/api/codex-patch-gate-contracts?contract_status=locked&limit=5`);
  assert.equal(codexPatchGateContracts.collection, "codex_patch_gate_contracts");
  assert.ok(codexPatchGateContracts.count <= 5);

  const codexAgentRunLedgerBindings = await fetchJson(`${url}/api/codex-agent-run-ledger-bindings?binding_status=locked&limit=5`);
  assert.equal(codexAgentRunLedgerBindings.collection, "codex_agent_run_ledger_bindings");
  assert.ok(codexAgentRunLedgerBindings.count <= 5);

  const codexDesktopBoundary = await fetchJson(`${url}/api/codex-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(codexDesktopBoundary.collection, "codex_desktop_boundary");
  assert.ok(codexDesktopBoundary.count <= 1);

  const codexAdapterValidations = await fetchJson(`${url}/api/codex-adapter-validations?status=passed&limit=5`);
  assert.equal(codexAdapterValidations.collection, "codex_adapter_validations");
  assert.ok(codexAdapterValidations.count <= 5);

  const localScriptAdapter = await fetchJson(`${url}/api/local-script-adapter?local_script_adapter_status=complete&limit=1`);
  assert.equal(localScriptAdapter.collection, "local_script_adapter");
  assert.ok(localScriptAdapter.count <= 1);

  const localScriptExecutionContracts = await fetchJson(`${url}/api/local-script-execution-contracts?contract_status=locked&limit=5`);
  assert.equal(localScriptExecutionContracts.collection, "local_script_execution_contracts");
  assert.ok(localScriptExecutionContracts.count <= 5);

  const localScriptAgentRunLedgerBindings = await fetchJson(`${url}/api/local-script-agent-run-ledger-bindings?binding_status=locked&limit=5`);
  assert.equal(localScriptAgentRunLedgerBindings.collection, "local_script_agent_run_ledger_bindings");
  assert.ok(localScriptAgentRunLedgerBindings.count <= 5);

  const localScriptDesktopBoundary = await fetchJson(`${url}/api/local-script-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(localScriptDesktopBoundary.collection, "local_script_desktop_boundary");
  assert.ok(localScriptDesktopBoundary.count <= 1);

  const localScriptAdapterValidations = await fetchJson(`${url}/api/local-script-adapter-validations?status=passed&limit=5`);
  assert.equal(localScriptAdapterValidations.collection, "local_script_adapter_validations");
  assert.ok(localScriptAdapterValidations.count <= 5);

  const documentRendererAdapter = await fetchJson(`${url}/api/document-renderer-adapter?document_renderer_adapter_status=complete&limit=1`);
  assert.equal(documentRendererAdapter.collection, "document_renderer_adapter");
  assert.ok(documentRendererAdapter.count <= 1);

  const documentRendererOutputContracts = await fetchJson(`${url}/api/document-renderer-output-contracts?contract_status=locked&limit=5`);
  assert.equal(documentRendererOutputContracts.collection, "document_renderer_output_contracts");
  assert.ok(documentRendererOutputContracts.count <= 5);

  const documentRendererAgentRunLedgerBindings = await fetchJson(`${url}/api/document-renderer-agent-run-ledger-bindings?binding_status=locked&limit=5`);
  assert.equal(documentRendererAgentRunLedgerBindings.collection, "document_renderer_agent_run_ledger_bindings");
  assert.ok(documentRendererAgentRunLedgerBindings.count <= 5);

  const documentRendererDesktopBoundary = await fetchJson(`${url}/api/document-renderer-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(documentRendererDesktopBoundary.collection, "document_renderer_desktop_boundary");
  assert.ok(documentRendererDesktopBoundary.count <= 1);

  const documentRendererAdapterValidations = await fetchJson(`${url}/api/document-renderer-adapter-validations?status=passed&limit=5`);
  assert.equal(documentRendererAdapterValidations.collection, "document_renderer_adapter_validations");
  assert.ok(documentRendererAdapterValidations.count <= 5);

  const worktreeManagerV2 = await fetchJson(`${url}/api/worktree-manager-v2?worktree_manager_v2_status=complete&limit=1`);
  assert.equal(worktreeManagerV2.collection, "worktree_manager_v2");
  assert.ok(worktreeManagerV2.count <= 1);

  const agentWorktreePlans = await fetchJson(`${url}/api/agent-worktree-plans?plan_status=ready&limit=5`);
  assert.equal(agentWorktreePlans.collection, "agent_worktree_plans");
  assert.ok(agentWorktreePlans.count <= 5);

  const worktreeStatusRecords = await fetchJson(`${url}/api/worktree-status-records?status_tracking_status=ready&limit=5`);
  assert.equal(worktreeStatusRecords.collection, "worktree_status_records");
  assert.ok(worktreeStatusRecords.count <= 5);

  const worktreeCleanupRecords = await fetchJson(`${url}/api/worktree-cleanup-records?cleanup_status=tracked&limit=5`);
  assert.equal(worktreeCleanupRecords.collection, "worktree_cleanup_records");
  assert.ok(worktreeCleanupRecords.count <= 5);

  const worktreeDesktopBoundary = await fetchJson(`${url}/api/worktree-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(worktreeDesktopBoundary.collection, "worktree_desktop_boundary");
  assert.ok(worktreeDesktopBoundary.count <= 1);

  const worktreeManagerV2Validations = await fetchJson(`${url}/api/worktree-manager-v2-validations?status=passed&limit=5`);
  assert.equal(worktreeManagerV2Validations.collection, "worktree_manager_v2_validations");
  assert.ok(worktreeManagerV2Validations.count <= 5);

  const sandboxPolicyModel = await fetchJson(`${url}/api/sandbox-policy-model?sandbox_policy_model_status=complete&limit=1`);
  assert.equal(sandboxPolicyModel.collection, "sandbox_policy_model");
  assert.ok(sandboxPolicyModel.count <= 1);

  const sandboxBackendPolicies = await fetchJson(`${url}/api/sandbox-backend-policies?backend_policy_status=allowed&limit=5`);
  assert.equal(sandboxBackendPolicies.collection, "sandbox_backend_policies");
  assert.ok(sandboxBackendPolicies.count <= 5);

  const runtimeSandboxBindings = await fetchJson(`${url}/api/runtime-sandbox-bindings?policy_decision_status=allowed&limit=5`);
  assert.equal(runtimeSandboxBindings.collection, "runtime_sandbox_bindings");
  assert.ok(runtimeSandboxBindings.count <= 5);

  const sandboxPolicyDecisions = await fetchJson(`${url}/api/sandbox-policy-decisions?backend_kind=ssh&limit=1`);
  assert.equal(sandboxPolicyDecisions.collection, "sandbox_policy_decisions");
  assert.ok(sandboxPolicyDecisions.count <= 1);

  const sandboxDesktopBoundary = await fetchJson(`${url}/api/sandbox-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(sandboxDesktopBoundary.collection, "sandbox_desktop_boundary");
  assert.ok(sandboxDesktopBoundary.count <= 1);

  const sandboxPolicyModelValidations = await fetchJson(`${url}/api/sandbox-policy-model-validations?status=passed&limit=5`);
  assert.equal(sandboxPolicyModelValidations.collection, "sandbox_policy_model_validations");
  assert.ok(sandboxPolicyModelValidations.count <= 5);

  const dockerLocalBackendSelector = await fetchJson(`${url}/api/docker-local-backend-selector?docker_local_backend_selector_status=complete&limit=1`);
  assert.equal(dockerLocalBackendSelector.collection, "docker_local_backend_selector");
  assert.ok(dockerLocalBackendSelector.count <= 1);

  const backendSelectionRules = await fetchJson(`${url}/api/backend-selection-rules?classification=P5_SECRET&limit=1`);
  assert.equal(backendSelectionRules.collection, "backend_selection_rules");
  assert.ok(backendSelectionRules.count <= 1);

  const runtimeBackendSelections = await fetchJson(`${url}/api/runtime-backend-selections?selection_status=selected&limit=5`);
  assert.equal(runtimeBackendSelections.collection, "runtime_backend_selections");
  assert.ok(runtimeBackendSelections.count <= 5);

  const classificationBackendSelections = await fetchJson(`${url}/api/classification-backend-selections?backend_selection_status=protected_review_only&limit=5`);
  assert.equal(classificationBackendSelections.collection, "classification_backend_selections");
  assert.ok(classificationBackendSelections.count <= 5);

  const runtimeClassificationBackendMatrix = await fetchJson(`${url}/api/runtime-classification-backend-matrix?classification=P2_CLIENT_CONFIDENTIAL&limit=5`);
  assert.equal(runtimeClassificationBackendMatrix.collection, "runtime_classification_backend_matrix");
  assert.ok(runtimeClassificationBackendMatrix.count <= 5);

  const backendSelectorDesktopBoundary = await fetchJson(`${url}/api/backend-selector-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(backendSelectorDesktopBoundary.collection, "backend_selector_desktop_boundary");
  assert.ok(backendSelectorDesktopBoundary.count <= 1);

  const backendSelectorValidations = await fetchJson(`${url}/api/backend-selector-validations?status=passed&limit=5`);
  assert.equal(backendSelectorValidations.collection, "backend_selector_validations");
  assert.ok(backendSelectorValidations.count <= 5);

  const secretsBrokerContract = await fetchJson(`${url}/api/secrets-broker-contract?secrets_broker_contract_status=complete&limit=1`);
  assert.equal(secretsBrokerContract.collection, "secrets_broker_contract");
  assert.ok(secretsBrokerContract.count <= 1);

  const secretHandlePolicies = await fetchJson(`${url}/api/secret-handle-policies?secret_kind=provider_api_key&limit=1`);
  assert.equal(secretHandlePolicies.collection, "secret_handle_policies");
  assert.ok(secretHandlePolicies.count <= 1);

  const runtimeSecretAccessBindings = await fetchJson(`${url}/api/runtime-secret-access-bindings?secret_access_status=brokered_handle_only&limit=3`);
  assert.equal(runtimeSecretAccessBindings.collection, "runtime_secret_access_bindings");
  assert.ok(runtimeSecretAccessBindings.count <= 3);

  const secretAuditBindings = await fetchJson(`${url}/api/secret-audit-bindings?audit_event_type=secret.handle.requested&limit=5`);
  assert.equal(secretAuditBindings.collection, "secret_audit_bindings");
  assert.ok(secretAuditBindings.count <= 5);

  const secretsDesktopBoundary = await fetchJson(`${url}/api/secrets-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(secretsDesktopBoundary.collection, "secrets_desktop_boundary");
  assert.ok(secretsDesktopBoundary.count <= 1);

  const secretsBrokerValidations = await fetchJson(`${url}/api/secrets-broker-validations?status=passed&limit=5`);
  assert.equal(secretsBrokerValidations.collection, "secrets_broker_validations");
  assert.ok(secretsBrokerValidations.count <= 5);

  const runtimeArtifactCapture = await fetchJson(`${url}/api/runtime-artifact-capture?runtime_artifact_capture_status=complete&limit=1`);
  assert.equal(runtimeArtifactCapture.collection, "runtime_artifact_capture");
  assert.ok(runtimeArtifactCapture.count <= 1);

  const artifactCaptureRecords = await fetchJson(`${url}/api/artifact-capture-records?output_artifact_binding_status=bound_to_output_artifact&limit=5`);
  assert.equal(artifactCaptureRecords.collection, "artifact_capture_records");
  assert.ok(artifactCaptureRecords.count <= 5);

  const diffCaptureRecords = await fetchJson(`${url}/api/diff-capture-records?human_review_required=true&limit=5`);
  assert.equal(diffCaptureRecords.collection, "diff_capture_records");
  assert.ok(diffCaptureRecords.count <= 5);

  const streamCaptureRecords = await fetchJson(`${url}/api/stream-capture-records?stream_name=stdout&limit=5`);
  assert.equal(streamCaptureRecords.collection, "stream_capture_records");
  assert.ok(streamCaptureRecords.count <= 5);

  const metadataCaptureRecords = await fetchJson(`${url}/api/metadata-capture-records?metadata_scope=runtime_artifact_metadata&limit=5`);
  assert.equal(metadataCaptureRecords.collection, "metadata_capture_records");
  assert.ok(metadataCaptureRecords.count <= 5);

  const outputArtifactCaptureBindings = await fetchJson(`${url}/api/output-artifact-capture-bindings?binding_status=bound&limit=5`);
  assert.equal(outputArtifactCaptureBindings.collection, "output_artifact_capture_bindings");
  assert.ok(outputArtifactCaptureBindings.count <= 5);

  const runtimeArtifactDesktopBoundary = await fetchJson(`${url}/api/runtime-artifact-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(runtimeArtifactDesktopBoundary.collection, "runtime_artifact_desktop_boundary");
  assert.ok(runtimeArtifactDesktopBoundary.count <= 1);

  const runtimeArtifactCaptureValidations = await fetchJson(`${url}/api/runtime-artifact-capture-validations?status=passed&limit=5`);
  assert.equal(runtimeArtifactCaptureValidations.collection, "runtime_artifact_capture_validations");
  assert.ok(runtimeArtifactCaptureValidations.count <= 5);

  const runtimeLogNormalization = await fetchJson(`${url}/api/runtime-log-normalization?runtime_log_normalization_status=complete&limit=1`);
  assert.equal(runtimeLogNormalization.collection, "runtime_log_normalization");
  assert.ok(runtimeLogNormalization.count <= 1);

  const normalizedRuntimeLogs = await fetchJson(`${url}/api/normalized-runtime-logs?normalization_status=normalized&limit=5`);
  assert.equal(normalizedRuntimeLogs.collection, "normalized_runtime_logs");
  assert.ok(normalizedRuntimeLogs.count <= 5);

  const normalizedLogStreams = await fetchJson(`${url}/api/normalized-log-streams?stream_name=stdout&limit=5`);
  assert.equal(normalizedLogStreams.collection, "normalized_log_streams");
  assert.ok(normalizedLogStreams.count <= 5);

  const runtimeLogSearchDocuments = await fetchJson(`${url}/api/runtime-log-search-documents?index_status=indexed&limit=5`);
  assert.equal(runtimeLogSearchDocuments.collection, "runtime_log_search_documents");
  assert.ok(runtimeLogSearchDocuments.count <= 5);

  const runtimeLogTraceBindings = await fetchJson(`${url}/api/runtime-log-trace-bindings?binding_status=known&limit=5`);
  assert.equal(runtimeLogTraceBindings.collection, "runtime_log_trace_bindings");
  assert.ok(runtimeLogTraceBindings.count <= 5);

  const runtimeLogDesktopBoundary = await fetchJson(`${url}/api/runtime-log-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(runtimeLogDesktopBoundary.collection, "runtime_log_desktop_boundary");
  assert.ok(runtimeLogDesktopBoundary.count <= 1);

  const runtimeLogNormalizationValidations = await fetchJson(`${url}/api/runtime-log-normalization-validations?status=passed&limit=5`);
  assert.equal(runtimeLogNormalizationValidations.collection, "runtime_log_normalization_validations");
  assert.ok(runtimeLogNormalizationValidations.count <= 5);

  const runtimeTimeoutHeartbeat = await fetchJson(`${url}/api/runtime-timeout-heartbeat?runtime_timeout_heartbeat_status=complete&limit=1`);
  assert.equal(runtimeTimeoutHeartbeat.collection, "runtime_timeout_heartbeat");
  assert.ok(runtimeTimeoutHeartbeat.count <= 1);

  const runtimeHeartbeatRecords = await fetchJson(`${url}/api/runtime-heartbeat-records?heartbeat_status=observed_terminal&limit=5`);
  assert.equal(runtimeHeartbeatRecords.collection, "runtime_heartbeat_records");
  assert.ok(runtimeHeartbeatRecords.count <= 5);

  const runtimeTimeoutRecords = await fetchJson(`${url}/api/runtime-timeout-records?timeout_status=within_timeout&limit=5`);
  assert.equal(runtimeTimeoutRecords.collection, "runtime_timeout_records");
  assert.ok(runtimeTimeoutRecords.count <= 5);

  const runtimeLifecycleLedgerBindings = await fetchJson(`${url}/api/runtime-lifecycle-ledger-bindings?binding_status=bound&limit=5`);
  assert.equal(runtimeLifecycleLedgerBindings.collection, "runtime_lifecycle_ledger_bindings");
  assert.ok(runtimeLifecycleLedgerBindings.count <= 5);

  const runtimeHeartbeatDesktopBoundary = await fetchJson(`${url}/api/runtime-heartbeat-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(runtimeHeartbeatDesktopBoundary.collection, "runtime_heartbeat_desktop_boundary");
  assert.ok(runtimeHeartbeatDesktopBoundary.count <= 1);

  const runtimeTimeoutHeartbeatValidations = await fetchJson(`${url}/api/runtime-timeout-heartbeat-validations?status=passed&limit=5`);
  assert.equal(runtimeTimeoutHeartbeatValidations.collection, "runtime_timeout_heartbeat_validations");
  assert.ok(runtimeTimeoutHeartbeatValidations.count <= 5);

  const runtimeControlCommands = await fetchJson(`${url}/api/runtime-control-commands?runtime_control_command_status=complete&limit=1`);
  assert.equal(runtimeControlCommands.collection, "runtime_control_commands");
  assert.ok(runtimeControlCommands.count <= 1);

  const runtimeControlCommandRequests = await fetchJson(`${url}/api/runtime-control-command-requests?control_command_kind=cancel&request_status=recorded_pending_human_gate&limit=5`);
  assert.equal(runtimeControlCommandRequests.collection, "runtime_control_command_requests");
  assert.ok(runtimeControlCommandRequests.count <= 5);

  const runtimeControlCommandResults = await fetchJson(`${url}/api/runtime-control-command-results?result_status=not_executed_terminal_state&limit=5`);
  assert.equal(runtimeControlCommandResults.collection, "runtime_control_command_results");
  assert.ok(runtimeControlCommandResults.count <= 5);

  const runtimeControlAuditBindings = await fetchJson(`${url}/api/runtime-control-audit-bindings?audit_binding_status=recorded&limit=5`);
  assert.equal(runtimeControlAuditBindings.collection, "runtime_control_audit_bindings");
  assert.ok(runtimeControlAuditBindings.count <= 5);

  const runtimeControlDesktopBoundary = await fetchJson(`${url}/api/runtime-control-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(runtimeControlDesktopBoundary.collection, "runtime_control_desktop_boundary");
  assert.ok(runtimeControlDesktopBoundary.count <= 1);

  const runtimeControlCommandValidations = await fetchJson(`${url}/api/runtime-control-command-validations?status=passed&limit=5`);
  assert.equal(runtimeControlCommandValidations.collection, "runtime_control_command_validations");
  assert.ok(runtimeControlCommandValidations.count <= 5);

  const protectedFileGate = await fetchJson(`${url}/api/protected-file-gate?protected_file_gate_status=complete&limit=1`);
  assert.equal(protectedFileGate.collection, "protected_file_gate");
  assert.ok(protectedFileGate.count <= 1);

  const protectedFileGateRules = await fetchJson(`${url}/api/protected-file-gate-rules?protected_class=secret&limit=5`);
  assert.equal(protectedFileGateRules.collection, "protected_file_gate_rules");
  assert.ok(protectedFileGateRules.count <= 5);

  const protectedFileChangeEvaluations = await fetchJson(`${url}/api/protected-file-change-evaluations?gate_status=blocked_pending_explicit_approval&blocked_before_approval=true&limit=5`);
  assert.equal(protectedFileChangeEvaluations.collection, "protected_file_change_evaluations");
  assert.ok(protectedFileChangeEvaluations.count <= 5);

  const protectedFileApprovalRequirements = await fetchJson(`${url}/api/protected-file-approval-requirements?approval_requirement_status=pending_explicit_approval&limit=5`);
  assert.equal(protectedFileApprovalRequirements.collection, "protected_file_approval_requirements");
  assert.ok(protectedFileApprovalRequirements.count <= 5);

  const protectedFileGateDesktopBoundary = await fetchJson(`${url}/api/protected-file-gate-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(protectedFileGateDesktopBoundary.collection, "protected_file_gate_desktop_boundary");
  assert.ok(protectedFileGateDesktopBoundary.count <= 1);

  const protectedFileGateValidations = await fetchJson(`${url}/api/protected-file-gate-validations?status=passed&limit=5`);
  assert.equal(protectedFileGateValidations.collection, "protected_file_gate_validations");
  assert.ok(protectedFileGateValidations.count <= 5);

  const canonicalTestRunner = await fetchJson(`${url}/api/canonical-test-runner?canonical_test_runner_status=complete&limit=1`);
  assert.equal(canonicalTestRunner.collection, "canonical_test_runner");
  assert.ok(canonicalTestRunner.count <= 1);

  const canonicalTestPlans = await fetchJson(`${url}/api/canonical-test-plans?canonical_test_plan_status=ready&agent_self_report_trusted=false&limit=5`);
  assert.equal(canonicalTestPlans.collection, "canonical_test_plans");
  assert.ok(canonicalTestPlans.count <= 5);

  const canonicalTestExecutions = await fetchJson(`${url}/api/canonical-test-executions?canonical_test_execution_status=passed&execution_source=harness_rerun&limit=5`);
  assert.equal(canonicalTestExecutions.collection, "canonical_test_executions");
  assert.ok(canonicalTestExecutions.count <= 5);

  const canonicalTestGateResults = await fetchJson(`${url}/api/canonical-test-gate-results?test_gate_status=passed&limit=5`);
  assert.equal(canonicalTestGateResults.collection, "canonical_test_gate_results");
  assert.ok(canonicalTestGateResults.count <= 5);

  const canonicalTestDesktopBoundary = await fetchJson(`${url}/api/canonical-test-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(canonicalTestDesktopBoundary.collection, "canonical_test_desktop_boundary");
  assert.ok(canonicalTestDesktopBoundary.count <= 1);

  const canonicalTestValidations = await fetchJson(`${url}/api/canonical-test-validations?status=passed&limit=5`);
  assert.equal(canonicalTestValidations.collection, "canonical_test_validations");
  assert.ok(canonicalTestValidations.count <= 5);

  const runtimeApiDashboard = await fetchJson(`${url}/api/runtime-api-dashboard?runtime_api_dashboard_status=complete&limit=1`);
  assert.equal(runtimeApiDashboard.collection, "runtime_api_dashboard");
  assert.ok(runtimeApiDashboard.count <= 1);

  const runtimeApiRouteGroups = await fetchJson(`${url}/api/runtime-api-route-groups?runtime_api_route_group_status=ready&read_only=true&limit=5`);
  assert.equal(runtimeApiRouteGroups.collection, "runtime_api_route_groups");
  assert.ok(runtimeApiRouteGroups.count <= 5);

  const runtimeDashboardPanels = await fetchJson(`${url}/api/runtime-dashboard-panels?runtime_dashboard_panel_status=ready&read_only=true&limit=5`);
  assert.equal(runtimeDashboardPanels.collection, "runtime_dashboard_panels");
  assert.ok(runtimeDashboardPanels.count <= 5);

  const runtimeStatusCards = await fetchJson(`${url}/api/runtime-status-cards?runtime_status_card_status=complete&read_only=true&limit=5`);
  assert.equal(runtimeStatusCards.collection, "runtime_status_cards");
  assert.ok(runtimeStatusCards.count <= 5);

  const runtimeApiDesktopBoundary = await fetchJson(`${url}/api/runtime-api-desktop-boundary?boundary_status=locked&read_only=true&limit=1`);
  assert.equal(runtimeApiDesktopBoundary.collection, "runtime_api_desktop_boundary");
  assert.ok(runtimeApiDesktopBoundary.count <= 1);

  const runtimeApiDashboardValidations = await fetchJson(`${url}/api/runtime-api-dashboard-validations?status=passed&limit=5`);
  assert.equal(runtimeApiDashboardValidations.collection, "runtime_api_dashboard_validations");
  assert.ok(runtimeApiDashboardValidations.count <= 5);

  const runtimeFreezes = await fetchJson(`${url}/api/runtime-freezes?runtime_freeze_status=complete&limit=1`);
  assert.equal(runtimeFreezes.collection, "runtime_freezes");
  assert.ok(runtimeFreezes.count <= 1);

  const runtimeFreezeSources = await fetchJson(`${url}/api/runtime-freeze-sources?runtime_freeze_source_status=passed&limit=5`);
  assert.equal(runtimeFreezeSources.collection, "runtime_freeze_sources");
  assert.ok(runtimeFreezeSources.count <= 5);

  const runtimeFreezeSlices = await fetchJson(`${url}/api/runtime-freeze-slices?runtime_freeze_slice_status=passed&runtime_id=codex&limit=5`);
  assert.equal(runtimeFreezeSlices.collection, "runtime_freeze_slices");
  assert.ok(runtimeFreezeSlices.count <= 5);

  const runtimeFreezeLoopBindings = await fetchJson(`${url}/api/runtime-freeze-loop-bindings?runtime_freeze_loop_binding_status=passed&limit=5`);
  assert.equal(runtimeFreezeLoopBindings.collection, "runtime_freeze_loop_bindings");
  assert.ok(runtimeFreezeLoopBindings.count <= 5);

  const runtimeFreezeValidations = await fetchJson(`${url}/api/runtime-freeze-validations?status=passed&limit=5`);
  assert.equal(runtimeFreezeValidations.collection, "runtime_freeze_validations");
  assert.ok(runtimeFreezeValidations.count <= 5);

  const personalDevPackManifests = await fetchJson(`${url}/api/personal-dev-pack-manifests?personal_dev_pack_manifest_status=complete&limit=1`);
  assert.equal(personalDevPackManifests.collection, "personal_dev_pack_manifests");
  assert.ok(personalDevPackManifests.count <= 1);

  const personalDevPackRegistration = await fetchJson(`${url}/api/personal-dev-pack-registration?registration_status=registered&limit=1`);
  assert.equal(personalDevPackRegistration.collection, "personal_dev_pack_registration");
  assert.ok(personalDevPackRegistration.count <= 1);

  const personalDevCapabilityRegistrations = await fetchJson(`${url}/api/personal-dev-capability-registrations?personal_dev_capability_registration_status=registered&limit=5`);
  assert.equal(personalDevCapabilityRegistrations.collection, "personal_dev_capability_registrations");
  assert.ok(personalDevCapabilityRegistrations.count <= 5);

  const personalDevPackBoundary = await fetchJson(`${url}/api/personal-dev-pack-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(personalDevPackBoundary.collection, "personal_dev_pack_boundary");
  assert.ok(personalDevPackBoundary.count <= 1);

  const personalDevPackValidations = await fetchJson(`${url}/api/personal-dev-pack-validations?status=passed&limit=5`);
  assert.equal(personalDevPackValidations.collection, "personal_dev_pack_validations");
  assert.ok(personalDevPackValidations.count <= 5);

  const lawFirmPackManifests = await fetchJson(`${url}/api/law-firm-pack-manifests?law_firm_pack_manifest_status=complete&limit=1`);
  assert.equal(lawFirmPackManifests.collection, "law_firm_pack_manifests");
  assert.ok(lawFirmPackManifests.count <= 1);

  const lawFirmPackRegistration = await fetchJson(`${url}/api/law-firm-pack-registration?registration_status=registered&limit=1`);
  assert.equal(lawFirmPackRegistration.collection, "law_firm_pack_registration");
  assert.ok(lawFirmPackRegistration.count <= 1);

  const lawFirmCapabilityRegistrations = await fetchJson(`${url}/api/law-firm-capability-registrations?law_firm_capability_registration_status=registered&limit=5`);
  assert.equal(lawFirmCapabilityRegistrations.collection, "law_firm_capability_registrations");
  assert.ok(lawFirmCapabilityRegistrations.count <= 5);

  const lawFirmPackBoundary = await fetchJson(`${url}/api/law-firm-pack-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lawFirmPackBoundary.collection, "law_firm_pack_boundary");
  assert.ok(lawFirmPackBoundary.count <= 1);

  const lawFirmPackValidations = await fetchJson(`${url}/api/law-firm-pack-validations?status=passed&limit=5`);
  assert.equal(lawFirmPackValidations.collection, "law_firm_pack_validations");
  assert.ok(lawFirmPackValidations.count <= 5);

  const creativeDocumentPackManifests = await fetchJson(`${url}/api/creative-document-pack-manifests?creative_document_pack_manifest_status=complete&limit=1`);
  assert.equal(creativeDocumentPackManifests.collection, "creative_document_pack_manifests");
  assert.ok(creativeDocumentPackManifests.count <= 1);

  const creativeDocumentPackRegistration = await fetchJson(`${url}/api/creative-document-pack-registration?registration_status=registered&limit=1`);
  assert.equal(creativeDocumentPackRegistration.collection, "creative_document_pack_registration");
  assert.ok(creativeDocumentPackRegistration.count <= 1);

  const creativeDocumentCapabilityRegistrations = await fetchJson(`${url}/api/creative-document-capability-registrations?creative_document_capability_registration_status=registered&limit=5`);
  assert.equal(creativeDocumentCapabilityRegistrations.collection, "creative_document_capability_registrations");
  assert.ok(creativeDocumentCapabilityRegistrations.count <= 5);

  const creativeDocumentPackBoundary = await fetchJson(`${url}/api/creative-document-pack-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(creativeDocumentPackBoundary.collection, "creative_document_pack_boundary");
  assert.ok(creativeDocumentPackBoundary.count <= 1);

  const creativeDocumentPackValidations = await fetchJson(`${url}/api/creative-document-pack-validations?status=passed&limit=5`);
  assert.equal(creativeDocumentPackValidations.collection, "creative_document_pack_validations");
  assert.ok(creativeDocumentPackValidations.count <= 5);

  const templateRegistries = await fetchJson(`${url}/api/template-registries?template_registry_status=complete&limit=1`);
  assert.equal(templateRegistries.collection, "template_registries");
  assert.ok(templateRegistries.count <= 1);

  const templateRecords = await fetchJson(`${url}/api/template-records?template_format=pptx&template_status=registered&limit=5`);
  assert.equal(templateRecords.collection, "template_records");
  assert.ok(templateRecords.count <= 5);

  const templateVersionRecords = await fetchJson(`${url}/api/template-version-records?version_status=current&limit=5`);
  assert.equal(templateVersionRecords.collection, "template_version_records");
  assert.ok(templateVersionRecords.count <= 5);

  const templateFormatCoverage = await fetchJson(`${url}/api/template-format-coverage?format_coverage_status=covered&limit=5`);
  assert.equal(templateFormatCoverage.collection, "template_format_coverage");
  assert.ok(templateFormatCoverage.count <= 5);

  const templatePackBindings = await fetchJson(`${url}/api/template-pack-bindings?binding_status=linked&limit=5`);
  assert.equal(templatePackBindings.collection, "template_pack_bindings");
  assert.ok(templatePackBindings.count <= 5);

  const templateRegistryValidations = await fetchJson(`${url}/api/template-registry-validations?status=passed&limit=5`);
  assert.equal(templateRegistryValidations.collection, "template_registry_validations");
  assert.ok(templateRegistryValidations.count <= 5);

  const styleRegistries = await fetchJson(`${url}/api/style-registries?style_registry_status=complete&limit=1`);
  assert.equal(styleRegistries.collection, "style_registries");
  assert.ok(styleRegistries.count <= 1);

  const styleProfileRecords = await fetchJson(`${url}/api/style-profile-records?style_profile_status=registered&style_format=pptx&limit=5`);
  assert.equal(styleProfileRecords.collection, "style_profile_records");
  assert.ok(styleProfileRecords.count <= 5);

  const styleRuleRecords = await fetchJson(`${url}/api/style-rule-records?style_rule_status=registered&style_rule_type=layout&limit=5`);
  assert.equal(styleRuleRecords.collection, "style_rule_records");
  assert.ok(styleRuleRecords.count <= 5);

  const templateStyleBindings = await fetchJson(`${url}/api/template-style-bindings?template_style_binding_status=linked&style_format=pptx&limit=5`);
  assert.equal(templateStyleBindings.collection, "template_style_bindings");
  assert.ok(templateStyleBindings.count <= 5);

  const styleFormatCoverage = await fetchJson(`${url}/api/style-format-coverage?style_format_coverage_status=covered&limit=5`);
  assert.equal(styleFormatCoverage.collection, "style_format_coverage");
  assert.ok(styleFormatCoverage.count <= 5);

  const styleRegistryValidations = await fetchJson(`${url}/api/style-registry-validations?status=passed&limit=5`);
  assert.equal(styleRegistryValidations.collection, "style_registry_validations");
  assert.ok(styleRegistryValidations.count <= 5);

  const assetRegistries = await fetchJson(`${url}/api/asset-registries?asset_registry_status=complete&limit=1`);
  assert.equal(assetRegistries.collection, "asset_registries");
  assert.ok(assetRegistries.count <= 1);

  const assetRecords = await fetchJson(`${url}/api/asset-records?asset_status=registered&asset_type=video&limit=5`);
  assert.equal(assetRecords.collection, "asset_records");
  assert.ok(assetRecords.count <= 5);

  const assetTypeRecords = await fetchJson(`${url}/api/asset-type-records?asset_type_status=covered&asset_type=image&limit=5`);
  assert.equal(assetTypeRecords.collection, "asset_type_records");
  assert.ok(assetTypeRecords.count <= 5);

  const assetArtifactPolicies = await fetchJson(`${url}/api/asset-artifact-policies?asset_artifact_policy_status=registered&asset_type=logo&limit=5`);
  assert.equal(assetArtifactPolicies.collection, "asset_artifact_policies");
  assert.ok(assetArtifactPolicies.count <= 5);

  const templateAssetBindings = await fetchJson(`${url}/api/template-asset-bindings?template_asset_binding_status=linked&asset_type=table&limit=5`);
  assert.equal(templateAssetBindings.collection, "template_asset_bindings");
  assert.ok(templateAssetBindings.count <= 5);

  const assetFormatCoverage = await fetchJson(`${url}/api/asset-format-coverage?asset_format_coverage_status=covered&asset_format=pptx&limit=5`);
  assert.equal(assetFormatCoverage.collection, "asset_format_coverage");
  assert.ok(assetFormatCoverage.count <= 5);

  const assetRegistryValidations = await fetchJson(`${url}/api/asset-registry-validations?status=passed&limit=5`);
  assert.equal(assetRegistryValidations.collection, "asset_registry_validations");
  assert.ok(assetRegistryValidations.count <= 5);

  const docxRenderers = await fetchJson(`${url}/api/docx-renderers?docx_renderer_status=complete&limit=1`);
  assert.equal(docxRenderers.collection, "docx_renderers");
  assert.ok(docxRenderers.count <= 1);

  const docxRenderJobs = await fetchJson(`${url}/api/docx-render-jobs?docx_render_job_status=complete&limit=5`);
  assert.equal(docxRenderJobs.collection, "docx_render_jobs");
  assert.ok(docxRenderJobs.count <= 5);

  const docxTemplateDataPackets = await fetchJson(`${url}/api/docx-template-data-packets?docx_template_data_packet_status=generated&limit=5`);
  assert.equal(docxTemplateDataPackets.collection, "docx_template_data_packets");
  assert.ok(docxTemplateDataPackets.count <= 5);

  const docxOpenXmlParts = await fetchJson(`${url}/api/docx-openxml-parts?openxml_part_status=generated&limit=5`);
  assert.equal(docxOpenXmlParts.collection, "docx_openxml_parts");
  assert.ok(docxOpenXmlParts.count <= 5);

  const docxOutputArtifacts = await fetchJson(`${url}/api/docx-output-artifacts?docx_output_artifact_status=draft_generated&limit=5`);
  assert.equal(docxOutputArtifacts.collection, "docx_output_artifacts");
  assert.ok(docxOutputArtifacts.count <= 5);

  const docxFormatValidations = await fetchJson(`${url}/api/docx-format-validations?docx_format_validation_status=passed&limit=5`);
  assert.equal(docxFormatValidations.collection, "docx_format_validations");
  assert.ok(docxFormatValidations.count <= 5);

  const docxRendererValidations = await fetchJson(`${url}/api/docx-renderer-validations?status=passed&limit=5`);
  assert.equal(docxRendererValidations.collection, "docx_renderer_validations");
  assert.ok(docxRendererValidations.count <= 5);

  const pptxRenderers = await fetchJson(`${url}/api/pptx-renderers?pptx_renderer_status=complete&limit=1`);
  assert.equal(pptxRenderers.collection, "pptx_renderers");
  assert.ok(pptxRenderers.count <= 1);

  const pptxRenderJobs = await fetchJson(`${url}/api/pptx-render-jobs?pptx_render_job_status=complete&limit=5`);
  assert.equal(pptxRenderJobs.collection, "pptx_render_jobs");
  assert.ok(pptxRenderJobs.count <= 5);

  const pptxSlideTemplates = await fetchJson(`${url}/api/pptx-slide-templates?pptx_slide_template_status=generated&limit=5`);
  assert.equal(pptxSlideTemplates.collection, "pptx_slide_templates");
  assert.ok(pptxSlideTemplates.count <= 5);

  const pptxSlideDecks = await fetchJson(`${url}/api/pptx-slide-decks?pptx_slide_deck_status=generated&limit=5`);
  assert.equal(pptxSlideDecks.collection, "pptx_slide_decks");
  assert.ok(pptxSlideDecks.count <= 5);

  const pptxOpenXmlParts = await fetchJson(`${url}/api/pptx-openxml-parts?openxml_part_status=generated&limit=5`);
  assert.equal(pptxOpenXmlParts.collection, "pptx_openxml_parts");
  assert.ok(pptxOpenXmlParts.count <= 5);

  const pptxOutputArtifacts = await fetchJson(`${url}/api/pptx-output-artifacts?pptx_output_artifact_status=draft_generated&limit=5`);
  assert.equal(pptxOutputArtifacts.collection, "pptx_output_artifacts");
  assert.ok(pptxOutputArtifacts.count <= 5);

  const pptxOverflowChecks = await fetchJson(`${url}/api/pptx-overflow-checks?pptx_overflow_check_status=passed&limit=5`);
  assert.equal(pptxOverflowChecks.collection, "pptx_overflow_checks");
  assert.ok(pptxOverflowChecks.count <= 5);

  const pptxFormatValidations = await fetchJson(`${url}/api/pptx-format-validations?pptx_format_validation_status=passed&limit=5`);
  assert.equal(pptxFormatValidations.collection, "pptx_format_validations");
  assert.ok(pptxFormatValidations.count <= 5);

  const pptxRendererValidations = await fetchJson(`${url}/api/pptx-renderer-validations?status=passed&limit=5`);
  assert.equal(pptxRendererValidations.collection, "pptx_renderer_validations");
  assert.ok(pptxRendererValidations.count <= 5);

  const pdfHtmlRenderers = await fetchJson(`${url}/api/pdf-html-renderers?pdf_html_renderer_status=complete&limit=1`);
  assert.equal(pdfHtmlRenderers.collection, "pdf_html_renderers");
  assert.ok(pdfHtmlRenderers.count <= 1);

  const pdfHtmlRenderJobs = await fetchJson(`${url}/api/pdf-html-render-jobs?pdf_html_render_job_status=complete&limit=5`);
  assert.equal(pdfHtmlRenderJobs.collection, "pdf_html_render_jobs");
  assert.ok(pdfHtmlRenderJobs.count <= 5);

  const htmlPreviewArtifacts = await fetchJson(`${url}/api/html-preview-artifacts?html_preview_status=draft_generated&limit=5`);
  assert.equal(htmlPreviewArtifacts.collection, "html_preview_artifacts");
  assert.ok(htmlPreviewArtifacts.count <= 5);

  const pdfExportArtifacts = await fetchJson(`${url}/api/pdf-export-artifacts?pdf_export_status=draft_generated&limit=5`);
  assert.equal(pdfExportArtifacts.collection, "pdf_export_artifacts");
  assert.ok(pdfExportArtifacts.count <= 5);

  const pdfHtmlOutputArtifacts = await fetchJson(`${url}/api/pdf-html-output-artifacts?pdf_html_output_artifact_status=draft_generated&limit=5`);
  assert.equal(pdfHtmlOutputArtifacts.collection, "pdf_html_output_artifacts");
  assert.ok(pdfHtmlOutputArtifacts.count <= 5);

  const pdfHtmlFormatValidations = await fetchJson(`${url}/api/pdf-html-format-validations?pdf_html_format_validation_status=passed&limit=5`);
  assert.equal(pdfHtmlFormatValidations.collection, "pdf_html_format_validations");
  assert.ok(pdfHtmlFormatValidations.count <= 5);

  const pdfHtmlRendererValidations = await fetchJson(`${url}/api/pdf-html-renderer-validations?status=passed&limit=5`);
  assert.equal(pdfHtmlRendererValidations.collection, "pdf_html_renderer_validations");
  assert.ok(pdfHtmlRendererValidations.count <= 5);

  const layoutValidators = await fetchJson(`${url}/api/layout-validators?layout_validator_status=complete&limit=1`);
  assert.equal(layoutValidators.collection, "layout_validators");
  assert.ok(layoutValidators.count <= 1);

  const layoutTargets = await fetchJson(`${url}/api/layout-targets?layout_target_format=pptx&limit=5`);
  assert.equal(layoutTargets.collection, "layout_targets");
  assert.ok(layoutTargets.count <= 5);

  const layoutValidationResults = await fetchJson(`${url}/api/layout-validation-results?layout_validation_status=passed&limit=5`);
  assert.equal(layoutValidationResults.collection, "layout_validation_results");
  assert.ok(layoutValidationResults.count <= 5);

  const layoutValidationChecks = await fetchJson(`${url}/api/layout-validation-checks?layout_check_type=broken_table&layout_check_status=passed&limit=5`);
  assert.equal(layoutValidationChecks.collection, "layout_validation_checks");
  assert.ok(layoutValidationChecks.count <= 5);

  const layoutValidatorValidations = await fetchJson(`${url}/api/layout-validator-validations?status=passed&limit=5`);
  assert.equal(layoutValidatorValidations.collection, "layout_validator_validations");
  assert.ok(layoutValidatorValidations.count <= 5);

  const citationRenderers = await fetchJson(`${url}/api/citation-renderers?citation_renderer_status=complete&limit=1`);
  assert.equal(citationRenderers.collection, "citation_renderers");
  assert.ok(citationRenderers.count <= 1);

  const citationRenderUnits = await fetchJson(`${url}/api/citation-render-units?citation_render_status=rendered_needs_review&limit=5`);
  assert.equal(citationRenderUnits.collection, "citation_render_units");
  assert.ok(citationRenderUnits.count <= 5);

  const footnoteRenderings = await fetchJson(`${url}/api/footnote-renderings?footnote_rendering_status=rendered_needs_review&limit=5`);
  assert.equal(footnoteRenderings.collection, "footnote_renderings");
  assert.ok(footnoteRenderings.count <= 5);

  const exhibitReferenceRenderings = await fetchJson(`${url}/api/exhibit-reference-renderings?exhibit_reference_status=rendered_bound&limit=5`);
  assert.equal(exhibitReferenceRenderings.collection, "exhibit_reference_renderings");
  assert.ok(exhibitReferenceRenderings.count <= 5);

  const sourceSpanLinkRenderings = await fetchJson(`${url}/api/source-span-link-renderings?source_span_link_status=rendered_bound&limit=5`);
  assert.equal(sourceSpanLinkRenderings.collection, "source_span_link_renderings");
  assert.ok(sourceSpanLinkRenderings.count <= 5);

  const citationRenderPackets = await fetchJson(`${url}/api/citation-render-packets?citation_render_packet_status=rendered_needs_review&citation_render_format=docx&limit=5`);
  assert.equal(citationRenderPackets.collection, "citation_render_packets");
  assert.ok(citationRenderPackets.count <= 5);

  const citationRendererValidations = await fetchJson(`${url}/api/citation-renderer-validations?status=passed&limit=5`);
  assert.equal(citationRendererValidations.collection, "citation_renderer_validations");
  assert.ok(citationRendererValidations.count <= 5);

  const versionComparators = await fetchJson(`${url}/api/version-comparators?version_comparator_status=complete&limit=1`);
  assert.equal(versionComparators.collection, "version_comparators");
  assert.ok(versionComparators.count <= 1);

  const documentVersionPairs = await fetchJson(`${url}/api/document-version-pairs?document_version_pair_status=comparison_ready_needs_review&document_comparison_format=docx&limit=5`);
  assert.equal(documentVersionPairs.collection, "document_version_pairs");
  assert.ok(documentVersionPairs.count <= 5);

  const documentChangeRecords = await fetchJson(`${url}/api/document-change-records?document_change_type=content_hash_delta&document_change_status=changed_needs_review&limit=5`);
  assert.equal(documentChangeRecords.collection, "document_change_records");
  assert.ok(documentChangeRecords.count <= 5);

  const documentComparisonPackets = await fetchJson(`${url}/api/document-comparison-packets?document_comparison_packet_status=ready_for_attorney_review&document_comparison_format=docx&limit=5`);
  assert.equal(documentComparisonPackets.collection, "document_comparison_packets");
  assert.ok(documentComparisonPackets.count <= 5);

  const versionComparatorValidations = await fetchJson(`${url}/api/version-comparator-validations?status=passed&limit=5`);
  assert.equal(versionComparatorValidations.collection, "version_comparator_validations");
  assert.ok(versionComparatorValidations.count <= 5);

  const designSystemProfiles = await fetchJson(`${url}/api/design-system-profiles?design_system_profile_status=complete&design_system_format=pptx&limit=1`);
  assert.equal(designSystemProfiles.collection, "design_system_profiles");
  assert.ok(designSystemProfiles.count <= 1);

  const designSystemRules = await fetchJson(`${url}/api/design-system-rules?design_rule_status=linked&design_rule_type=layout&limit=5`);
  assert.equal(designSystemRules.collection, "design_system_rules");
  assert.ok(designSystemRules.count <= 5);

  const templateDesignBindings = await fetchJson(`${url}/api/template-design-bindings?template_design_binding_status=bound_for_review&design_system_format=pptx&limit=5`);
  assert.equal(templateDesignBindings.collection, "template_design_bindings");
  assert.ok(templateDesignBindings.count <= 5);

  const assetDesignBindings = await fetchJson(`${url}/api/asset-design-bindings?asset_design_binding_status=linked_for_review&asset_type=image&limit=5`);
  assert.equal(assetDesignBindings.collection, "asset_design_bindings");
  assert.ok(assetDesignBindings.count <= 5);

  const designReviewPackets = await fetchJson(`${url}/api/design-review-packets?design_review_packet_status=ready_for_attorney_review&design_system_format=pptx&limit=5`);
  assert.equal(designReviewPackets.collection, "design_review_packets");
  assert.ok(designReviewPackets.count <= 5);

  const designSystemProfileValidations = await fetchJson(`${url}/api/design-system-profile-validations?status=passed&limit=5`);
  assert.equal(designSystemProfileValidations.collection, "design_system_profile_validations");
  assert.ok(designSystemProfileValidations.count <= 5);

  const webNovelWorkflows = await fetchJson(`${url}/api/web-novel-workflows?web_novel_workflow_status=complete&limit=1`);
  assert.equal(webNovelWorkflows.collection, "web_novel_workflows");
  assert.ok(webNovelWorkflows.count <= 1);

  const webNovelSynopses = await fetchJson(`${url}/api/web-novel-synopses?web_novel_synopsis_status=draft_needs_review&limit=5`);
  assert.equal(webNovelSynopses.collection, "web_novel_synopses");
  assert.ok(webNovelSynopses.count <= 5);

  const webNovelStyleGuides = await fetchJson(`${url}/api/web-novel-style-guides?web_novel_style_guide_status=draft_needs_review&limit=5`);
  assert.equal(webNovelStyleGuides.collection, "web_novel_style_guides");
  assert.ok(webNovelStyleGuides.count <= 5);

  const webNovelChapters = await fetchJson(`${url}/api/web-novel-chapters?web_novel_chapter_status=draft_needs_review&limit=5`);
  assert.equal(webNovelChapters.collection, "web_novel_chapters");
  assert.ok(webNovelChapters.count <= 5);

  const webNovelRevisionPackets = await fetchJson(`${url}/api/web-novel-revision-packets?web_novel_revision_packet_status=ready_for_human_review&limit=5`);
  assert.equal(webNovelRevisionPackets.collection, "web_novel_revision_packets");
  assert.ok(webNovelRevisionPackets.count <= 5);

  const webNovelOutputArtifacts = await fetchJson(`${url}/api/web-novel-output-artifacts?web_novel_output_artifact_status=draft_generated_needs_review&web_novel_output_format=markdown&limit=5`);
  assert.equal(webNovelOutputArtifacts.collection, "web_novel_output_artifacts");
  assert.ok(webNovelOutputArtifacts.count <= 5);

  const webNovelWorkflowValidations = await fetchJson(`${url}/api/web-novel-workflow-validations?status=passed&limit=5`);
  assert.equal(webNovelWorkflowValidations.collection, "web_novel_workflow_validations");
  assert.ok(webNovelWorkflowValidations.count <= 5);

  const videoPptWorkflows = await fetchJson(`${url}/api/video-ppt-workflows?video_ppt_workflow_status=complete&limit=1`);
  assert.equal(videoPptWorkflows.collection, "video_ppt_workflows");
  assert.ok(videoPptWorkflows.count <= 1);

  const videoPptScripts = await fetchJson(`${url}/api/video-ppt-scripts?video_ppt_script_status=draft_needs_review&limit=5`);
  assert.equal(videoPptScripts.collection, "video_ppt_scripts");
  assert.ok(videoPptScripts.count <= 5);

  const videoPptStoryboards = await fetchJson(`${url}/api/video-ppt-storyboards?video_ppt_storyboard_status=draft_needs_review&limit=5`);
  assert.equal(videoPptStoryboards.collection, "video_ppt_storyboards");
  assert.ok(videoPptStoryboards.count <= 5);

  const videoPptSlideDecks = await fetchJson(`${url}/api/video-ppt-slide-decks?video_ppt_slide_deck_status=draft_needs_review&limit=5`);
  assert.equal(videoPptSlideDecks.collection, "video_ppt_slide_decks");
  assert.ok(videoPptSlideDecks.count <= 5);

  const videoPptApprovalArtifacts = await fetchJson(`${url}/api/video-ppt-approval-artifacts?video_ppt_approval_artifact_status=ready_for_human_review&limit=5`);
  assert.equal(videoPptApprovalArtifacts.collection, "video_ppt_approval_artifacts");
  assert.ok(videoPptApprovalArtifacts.count <= 5);

  const videoPptOutputArtifacts = await fetchJson(`${url}/api/video-ppt-output-artifacts?video_ppt_output_artifact_status=draft_generated_needs_review&video_ppt_output_format=markdown&limit=5`);
  assert.equal(videoPptOutputArtifacts.collection, "video_ppt_output_artifacts");
  assert.ok(videoPptOutputArtifacts.count <= 5);

  const videoPptWorkflowValidations = await fetchJson(`${url}/api/video-ppt-workflow-validations?status=passed&limit=5`);
  assert.equal(videoPptWorkflowValidations.collection, "video_ppt_workflow_validations");
  assert.ok(videoPptWorkflowValidations.count <= 5);

  const creativeDocumentFreezes = await fetchJson(`${url}/api/creative-document-freezes?creative_document_freeze_status=complete&limit=1`);
  assert.equal(creativeDocumentFreezes.collection, "creative_document_freezes");
  assert.ok(creativeDocumentFreezes.count <= 1);

  const creativeDocumentFreezeSources = await fetchJson(`${url}/api/creative-document-freeze-sources?creative_document_freeze_source_status=complete&limit=5`);
  assert.equal(creativeDocumentFreezeSources.collection, "creative_document_freeze_sources");
  assert.ok(creativeDocumentFreezeSources.count <= 5);

  const creativeDocumentFreezePaths = await fetchJson(`${url}/api/creative-document-freeze-paths?creative_document_freeze_path_status=passed&limit=5`);
  assert.equal(creativeDocumentFreezePaths.collection, "creative_document_freeze_paths");
  assert.ok(creativeDocumentFreezePaths.count <= 5);

  const creativeDocumentFreezeGates = await fetchJson(`${url}/api/creative-document-freeze-gates?creative_document_freeze_gate_status=passed&limit=5`);
  assert.equal(creativeDocumentFreezeGates.collection, "creative_document_freeze_gates");
  assert.ok(creativeDocumentFreezeGates.count <= 5);

  const creativeDocumentFreezeBoundary = await fetchJson(`${url}/api/creative-document-freeze-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(creativeDocumentFreezeBoundary.collection, "creative_document_freeze_boundary");
  assert.ok(creativeDocumentFreezeBoundary.count <= 1);

  const creativeDocumentFreezeValidations = await fetchJson(`${url}/api/creative-document-freeze-validations?status=passed&limit=5`);
  assert.equal(creativeDocumentFreezeValidations.collection, "creative_document_freeze_validations");
  assert.ok(creativeDocumentFreezeValidations.count <= 5);

  const connectorContractsV2 = await fetchJson(`${url}/api/connector-contracts-v2?connector_contract_v2_status=complete&limit=1`);
  assert.equal(connectorContractsV2.collection, "connector_contracts_v2");
  assert.ok(connectorContractsV2.count <= 1);

  const connectorDefinitions = await fetchJson(`${url}/api/connector-definitions?connector_status=contracted&connector_family=local_folder&limit=5`);
  assert.equal(connectorDefinitions.collection, "connector_definitions");
  assert.ok(connectorDefinitions.count <= 5);

  const connectorSourceContracts = await fetchJson(`${url}/api/connector-source-contracts?source_contract_status=contracted&source_system=local_filesystem&limit=5`);
  assert.equal(connectorSourceContracts.collection, "connector_source_contracts");
  assert.ok(connectorSourceContracts.count <= 5);

  const connectorCursorContracts = await fetchJson(`${url}/api/connector-cursor-contracts?cursor_contract_status=contracted&limit=5`);
  assert.equal(connectorCursorContracts.collection, "connector_cursor_contracts");
  assert.ok(connectorCursorContracts.count <= 5);

  const connectorExternalIdContracts = await fetchJson(`${url}/api/connector-external-id-contracts?external_id_contract_status=contracted&limit=5`);
  assert.equal(connectorExternalIdContracts.collection, "connector_external_id_contracts");
  assert.ok(connectorExternalIdContracts.count <= 5);

  const connectorAuthBoundaries = await fetchJson(`${url}/api/connector-auth-boundaries?auth_boundary_status=enforced&credential_reference_only=true&limit=5`);
  assert.equal(connectorAuthBoundaries.collection, "connector_auth_boundaries");
  assert.ok(connectorAuthBoundaries.count <= 5);

  const connectorContractV2Validations = await fetchJson(`${url}/api/connector-contract-v2-validations?status=passed&limit=5`);
  assert.equal(connectorContractV2Validations.collection, "connector_contract_v2_validations");
  assert.ok(connectorContractV2Validations.count <= 5);

  const localFolderConnector = await fetchJson(`${url}/api/local-folder-connector?local_folder_connector_status=complete&limit=1`);
  assert.equal(localFolderConnector.collection, "local_folder_connector");
  assert.ok(localFolderConnector.count <= 1);

  const localFolderDiscovery = await fetchJson(`${url}/api/local-folder-discovery?discovery_status=discovered_ingest_ready&limit=5`);
  assert.equal(localFolderDiscovery.collection, "local_folder_discovery");
  assert.ok(localFolderDiscovery.count <= 5);

  const localFolderIngestRecords = await fetchJson(`${url}/api/local-folder-ingest-records?ingest_status=resource_candidate_ready&resource_projection_status=ready&limit=5`);
  assert.equal(localFolderIngestRecords.collection, "local_folder_ingest_records");
  assert.ok(localFolderIngestRecords.count <= 5);

  const localFolderCursor = await fetchJson(`${url}/api/local-folder-cursor?cursor_status=complete&limit=1`);
  assert.equal(localFolderCursor.collection, "local_folder_cursor");
  assert.ok(localFolderCursor.count <= 1);

  const localFolderConnectorValidations = await fetchJson(`${url}/api/local-folder-connector-validations?status=passed&limit=5`);
  assert.equal(localFolderConnectorValidations.collection, "local_folder_connector_validations");
  assert.ok(localFolderConnectorValidations.count <= 5);

  const oneDriveConnectorBoundary = await fetchJson(`${url}/api/onedrive-connector-boundary?onedrive_connector_boundary_status=complete&limit=1`);
  assert.equal(oneDriveConnectorBoundary.collection, "onedrive_connector_boundary");
  assert.ok(oneDriveConnectorBoundary.count <= 1);

  const oneDriveTimeoutPolicies = await fetchJson(`${url}/api/onedrive-timeout-policies?timeout_policy_status=explicit&limit=5`);
  assert.equal(oneDriveTimeoutPolicies.collection, "onedrive_timeout_policies");
  assert.ok(oneDriveTimeoutPolicies.count <= 5);

  const oneDrivePlaceholderPolicies = await fetchJson(`${url}/api/onedrive-placeholder-policies?placeholder_policy_status=explicit&limit=5`);
  assert.equal(oneDrivePlaceholderPolicies.collection, "onedrive_placeholder_policies");
  assert.ok(oneDrivePlaceholderPolicies.count <= 5);

  const oneDriveCloudOnlyHandling = await fetchJson(`${url}/api/onedrive-cloud-only-handling?cloud_only_handling_status=deferred_pending_materialization_review&cloud_item_state=cloud_only_placeholder&review_status=needs_review&limit=5`);
  assert.equal(oneDriveCloudOnlyHandling.collection, "onedrive_cloud_only_handling");
  assert.ok(oneDriveCloudOnlyHandling.count <= 5);

  const oneDriveCursorBoundary = await fetchJson(`${url}/api/onedrive-cursor-boundary?cursor_boundary_status=complete&limit=1`);
  assert.equal(oneDriveCursorBoundary.collection, "onedrive_cursor_boundary");
  assert.ok(oneDriveCursorBoundary.count <= 1);

  const oneDriveAuthBoundary = await fetchJson(`${url}/api/onedrive-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(oneDriveAuthBoundary.collection, "onedrive_auth_boundary");
  assert.ok(oneDriveAuthBoundary.count <= 1);

  const oneDriveConnectorBoundaryValidations = await fetchJson(`${url}/api/onedrive-connector-boundary-validations?status=passed&limit=5`);
  assert.equal(oneDriveConnectorBoundaryValidations.collection, "onedrive_connector_boundary_validations");
  assert.ok(oneDriveConnectorBoundaryValidations.count <= 5);

  const outlookEmailConnector = await fetchJson(`${url}/api/outlook-email-connector?outlook_email_connector_status=complete&limit=1`);
  assert.equal(outlookEmailConnector.collection, "outlook_email_connector");
  assert.ok(outlookEmailConnector.count <= 1);

  const outlookEmailMessages = await fetchJson(`${url}/api/outlook-email-messages?message_status=resource_candidate_ready&email_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(outlookEmailMessages.collection, "outlook_email_messages");
  assert.ok(outlookEmailMessages.count <= 5);

  const outlookEmailAttachments = await fetchJson(`${url}/api/outlook-email-attachments?attachment_status=resource_candidate_ready&email_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(outlookEmailAttachments.collection, "outlook_email_attachments");
  assert.ok(outlookEmailAttachments.count <= 5);

  const outlookEmailThreads = await fetchJson(`${url}/api/outlook-email-threads?thread_status=complete&review_status=needs_review&limit=5`);
  assert.equal(outlookEmailThreads.collection, "outlook_email_threads");
  assert.ok(outlookEmailThreads.count <= 5);

  const outlookEmailCursor = await fetchJson(`${url}/api/outlook-email-cursor?cursor_status=complete&limit=1`);
  assert.equal(outlookEmailCursor.collection, "outlook_email_cursor");
  assert.ok(outlookEmailCursor.count <= 1);

  const outlookEmailAuthBoundary = await fetchJson(`${url}/api/outlook-email-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(outlookEmailAuthBoundary.collection, "outlook_email_auth_boundary");
  assert.ok(outlookEmailAuthBoundary.count <= 1);

  const outlookEmailValidations = await fetchJson(`${url}/api/outlook-email-validations?status=passed&limit=5`);
  assert.equal(outlookEmailValidations.collection, "outlook_email_validations");
  assert.ok(outlookEmailValidations.count <= 5);

  const kakaoTalkImportBoundary = await fetchJson(`${url}/api/kakaotalk-import-boundary?kakaotalk_import_boundary_status=complete&limit=1`);
  assert.equal(kakaoTalkImportBoundary.collection, "kakaotalk_import_boundary");
  assert.ok(kakaoTalkImportBoundary.count <= 1);

  const kakaoTalkMessages = await fetchJson(`${url}/api/kakaotalk-messages?kakaotalk_message_status=resource_candidate_ready&chat_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(kakaoTalkMessages.collection, "kakaotalk_messages");
  assert.ok(kakaoTalkMessages.count <= 5);

  const kakaoTalkAttachments = await fetchJson(`${url}/api/kakaotalk-attachments?kakaotalk_attachment_status=resource_candidate_ready&chat_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(kakaoTalkAttachments.collection, "kakaotalk_attachments");
  assert.ok(kakaoTalkAttachments.count <= 5);

  const kakaoTalkConversations = await fetchJson(`${url}/api/kakaotalk-conversations?kakaotalk_conversation_status=complete&review_status=needs_review&limit=5`);
  assert.equal(kakaoTalkConversations.collection, "kakaotalk_conversations");
  assert.ok(kakaoTalkConversations.count <= 5);

  const kakaoTalkCursor = await fetchJson(`${url}/api/kakaotalk-cursor?cursor_status=complete&limit=1`);
  assert.equal(kakaoTalkCursor.collection, "kakaotalk_cursor");
  assert.ok(kakaoTalkCursor.count <= 1);

  const kakaoTalkAuthBoundary = await fetchJson(`${url}/api/kakaotalk-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(kakaoTalkAuthBoundary.collection, "kakaotalk_auth_boundary");
  assert.ok(kakaoTalkAuthBoundary.count <= 1);

  const kakaoTalkImportValidations = await fetchJson(`${url}/api/kakaotalk-import-validations?status=passed&limit=5`);
  assert.equal(kakaoTalkImportValidations.collection, "kakaotalk_import_validations");
  assert.ok(kakaoTalkImportValidations.count <= 5);

  const githubConnector = await fetchJson(`${url}/api/github-connector?github_connector_status=complete&limit=1`);
  assert.equal(githubConnector.collection, "github_connector");
  assert.ok(githubConnector.count <= 1);

  const githubRepositories = await fetchJson(`${url}/api/github-repositories?repository_status=resource_candidate_ready&github_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubRepositories.collection, "github_repositories");
  assert.ok(githubRepositories.count <= 5);

  const githubIssues = await fetchJson(`${url}/api/github-issues?github_issue_status=resource_candidate_ready&github_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubIssues.collection, "github_issues");
  assert.ok(githubIssues.count <= 5);

  const githubPullRequests = await fetchJson(`${url}/api/github-pull-requests?github_pull_request_status=resource_candidate_ready&github_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubPullRequests.collection, "github_pull_requests");
  assert.ok(githubPullRequests.count <= 5);

  const githubCommits = await fetchJson(`${url}/api/github-commits?github_commit_status=resource_candidate_ready&github_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubCommits.collection, "github_commits");
  assert.ok(githubCommits.count <= 5);

  const githubReviews = await fetchJson(`${url}/api/github-reviews?github_review_status=resource_candidate_ready&github_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubReviews.collection, "github_reviews");
  assert.ok(githubReviews.count <= 5);

  const githubWorkflowInputs = await fetchJson(`${url}/api/github-workflow-inputs?github_workflow_input_status=ready&review_status=needs_review&limit=5`);
  assert.equal(githubWorkflowInputs.collection, "github_workflow_inputs");
  assert.ok(githubWorkflowInputs.count <= 5);

  const githubCursor = await fetchJson(`${url}/api/github-cursor?cursor_status=complete&limit=1`);
  assert.equal(githubCursor.collection, "github_cursor");
  assert.ok(githubCursor.count <= 1);

  const githubAuthBoundary = await fetchJson(`${url}/api/github-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(githubAuthBoundary.collection, "github_auth_boundary");
  assert.ok(githubAuthBoundary.count <= 1);

  const githubConnectorValidations = await fetchJson(`${url}/api/github-connector-validations?status=passed&limit=5`);
  assert.equal(githubConnectorValidations.collection, "github_connector_validations");
  assert.ok(githubConnectorValidations.count <= 5);

  const vdrConnector = await fetchJson(`${url}/api/vdr-connector?vdr_connector_status=complete&limit=1`);
  assert.equal(vdrConnector.collection, "vdr_connector");
  assert.ok(vdrConnector.count <= 1);

  const vdrRooms = await fetchJson(`${url}/api/vdr-rooms?vdr_room_status=metadata_export_ready&review_status=needs_review&limit=5`);
  assert.equal(vdrRooms.collection, "vdr_rooms");
  assert.ok(vdrRooms.count <= 5);

  const vdrIndexes = await fetchJson(`${url}/api/vdr-indexes?vdr_index_status=resource_candidate_ready&vdr_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(vdrIndexes.collection, "vdr_indexes");
  assert.ok(vdrIndexes.count <= 5);

  const vdrDocuments = await fetchJson(`${url}/api/vdr-documents?vdr_document_status=resource_candidate_ready&vdr_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(vdrDocuments.collection, "vdr_documents");
  assert.ok(vdrDocuments.count <= 5);

  const vdrVersions = await fetchJson(`${url}/api/vdr-versions?vdr_version_status=current&vdr_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(vdrVersions.collection, "vdr_versions");
  assert.ok(vdrVersions.count <= 5);

  const vdrPermissionBoundaries = await fetchJson(`${url}/api/vdr-permission-boundaries?vdr_permission_boundary_status=enforced&review_status=needs_review&limit=5`);
  assert.equal(vdrPermissionBoundaries.collection, "vdr_permission_boundaries");
  assert.ok(vdrPermissionBoundaries.count <= 5);

  const vdrResourceExpansionSeeds = await fetchJson(`${url}/api/vdr-resource-expansion-seeds?vdr_resource_expansion_seed_status=ready_for_resource_expansion&review_status=needs_review&limit=5`);
  assert.equal(vdrResourceExpansionSeeds.collection, "vdr_resource_expansion_seeds");
  assert.ok(vdrResourceExpansionSeeds.count <= 5);

  const vdrCursor = await fetchJson(`${url}/api/vdr-cursor?cursor_status=complete&limit=1`);
  assert.equal(vdrCursor.collection, "vdr_cursor");
  assert.ok(vdrCursor.count <= 1);

  const vdrAuthBoundary = await fetchJson(`${url}/api/vdr-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(vdrAuthBoundary.collection, "vdr_auth_boundary");
  assert.ok(vdrAuthBoundary.count <= 1);

  const vdrConnectorValidations = await fetchJson(`${url}/api/vdr-connector-validations?status=passed&limit=5`);
  assert.equal(vdrConnectorValidations.collection, "vdr_connector_validations");
  assert.ok(vdrConnectorValidations.count <= 5);

  const plaudConnector = await fetchJson(`${url}/api/plaud-transcript-connector?plaud_transcript_connector_status=complete&limit=1`);
  assert.equal(plaudConnector.collection, "plaud_transcript_connector");
  assert.ok(plaudConnector.count <= 1);

  const plaudRecordings = await fetchJson(`${url}/api/plaud-recordings?plaud_recording_status=metadata_export_ready&review_status=needs_review&limit=5`);
  assert.equal(plaudRecordings.collection, "plaud_recordings");
  assert.ok(plaudRecordings.count <= 5);

  const plaudSpeakers = await fetchJson(`${url}/api/plaud-speakers?plaud_speaker_status=identified_from_export&review_status=needs_review&limit=5`);
  assert.equal(plaudSpeakers.collection, "plaud_speakers");
  assert.ok(plaudSpeakers.count <= 5);

  const plaudSegments = await fetchJson(`${url}/api/plaud-transcript-segments?plaud_segment_status=resource_candidate_ready&plaud_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(plaudSegments.collection, "plaud_transcript_segments");
  assert.ok(plaudSegments.count <= 5);

  const plaudNormalizedTexts = await fetchJson(`${url}/api/plaud-normalized-texts?plaud_normalized_text_status=stored&review_status=needs_review&limit=5`);
  assert.equal(plaudNormalizedTexts.collection, "plaud_normalized_texts");
  assert.ok(plaudNormalizedTexts.count <= 5);

  const plaudTimestampSpans = await fetchJson(`${url}/api/plaud-timestamp-spans?plaud_timestamp_span_status=bound&review_status=needs_review&limit=5`);
  assert.equal(plaudTimestampSpans.collection, "plaud_timestamp_spans");
  assert.ok(plaudTimestampSpans.count <= 5);

  const plaudAudioMetadata = await fetchJson(`${url}/api/plaud-audio-metadata?plaud_audio_metadata_status=resource_candidate_ready&plaud_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(plaudAudioMetadata.collection, "plaud_audio_metadata");
  assert.ok(plaudAudioMetadata.count <= 5);

  const plaudCursor = await fetchJson(`${url}/api/plaud-cursor?cursor_status=complete&limit=1`);
  assert.equal(plaudCursor.collection, "plaud_cursor");
  assert.ok(plaudCursor.count <= 1);

  const plaudAuthBoundary = await fetchJson(`${url}/api/plaud-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(plaudAuthBoundary.collection, "plaud_auth_boundary");
  assert.ok(plaudAuthBoundary.count <= 1);

  const plaudValidations = await fetchJson(`${url}/api/plaud-transcript-validations?status=passed&limit=5`);
  assert.equal(plaudValidations.collection, "plaud_transcript_validations");
  assert.ok(plaudValidations.count <= 5);

  const erpDraftConnector = await fetchJson(`${url}/api/erp-draft-connector?erp_draft_connector_status=complete&limit=1`);
  assert.equal(erpDraftConnector.collection, "erp_draft_connector");
  assert.ok(erpDraftConnector.count <= 1);

  const erpAccounts = await fetchJson(`${url}/api/erp-accounts?erp_account_status=metadata_export_ready&review_status=needs_review&limit=5`);
  assert.equal(erpAccounts.collection, "erp_accounts");
  assert.ok(erpAccounts.count <= 5);

  const erpDrafts = await fetchJson(`${url}/api/erp-drafts?erp_draft_status=draft_output_ready&erp_resource_status=ready&review_status=needs_review&limit=5`);
  assert.equal(erpDrafts.collection, "erp_drafts");
  assert.ok(erpDrafts.count <= 5);

  const erpTaxDrafts = await fetchJson(`${url}/api/erp-drafts?draft_kind=tax_invoice&erp_draft_status=draft_output_ready&limit=5`);
  assert.equal(erpTaxDrafts.collection, "erp_drafts");
  assert.ok(erpTaxDrafts.count <= 5);

  const erpLineItems = await fetchJson(`${url}/api/erp-line-items?erp_line_item_status=draft_line_ready&review_status=needs_review&limit=5`);
  assert.equal(erpLineItems.collection, "erp_line_items");
  assert.ok(erpLineItems.count <= 5);

  const erpDraftOutputs = await fetchJson(`${url}/api/erp-draft-outputs?erp_draft_output_status=blocked_pending_human_review&review_status=needs_review&limit=5`);
  assert.equal(erpDraftOutputs.collection, "erp_draft_outputs");
  assert.ok(erpDraftOutputs.count <= 5);

  const erpApprovalHolds = await fetchJson(`${url}/api/erp-approval-holds?erp_approval_hold_status=held_for_human_review&limit=5`);
  assert.equal(erpApprovalHolds.collection, "erp_approval_holds");
  assert.ok(erpApprovalHolds.count <= 5);

  const erpCursor = await fetchJson(`${url}/api/erp-cursor?cursor_status=complete&limit=1`);
  assert.equal(erpCursor.collection, "erp_cursor");
  assert.ok(erpCursor.count <= 1);

  const erpAuthBoundary = await fetchJson(`${url}/api/erp-auth-boundary?auth_boundary_status=enforced&credential_reference_only=true&limit=1`);
  assert.equal(erpAuthBoundary.collection, "erp_auth_boundary");
  assert.ok(erpAuthBoundary.count <= 1);

  const erpValidations = await fetchJson(`${url}/api/erp-draft-validations?status=passed&limit=5`);
  assert.equal(erpValidations.collection, "erp_draft_validations");
  assert.ok(erpValidations.count <= 5);

  const connectorFreezes = await fetchJson(`${url}/api/connector-freezes?connector_freeze_status=complete&limit=1`);
  assert.equal(connectorFreezes.collection, "connector_freezes");
  assert.ok(connectorFreezes.count <= 1);

  const connectorFreezeSources = await fetchJson(`${url}/api/connector-freeze-sources?connector_freeze_source_status=complete&limit=9`);
  assert.equal(connectorFreezeSources.collection, "connector_freeze_sources");
  assert.ok(connectorFreezeSources.count <= 9);

  const connectorFreezeIngestPaths = await fetchJson(`${url}/api/connector-freeze-ingest-paths?connector_freeze_path_status=passed&limit=7`);
  assert.equal(connectorFreezeIngestPaths.collection, "connector_freeze_ingest_paths");
  assert.ok(connectorFreezeIngestPaths.count <= 7);

  const connectorFreezeGates = await fetchJson(`${url}/api/connector-freeze-gates?connector_freeze_gate_status=passed&limit=7`);
  assert.equal(connectorFreezeGates.collection, "connector_freeze_gates");
  assert.ok(connectorFreezeGates.count <= 7);

  const connectorFreezeBoundary = await fetchJson(`${url}/api/connector-freeze-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(connectorFreezeBoundary.collection, "connector_freeze_boundary");
  assert.ok(connectorFreezeBoundary.count <= 1);

  const connectorFreezeCheckpoints = await fetchJson(`${url}/api/connector-freeze-checkpoints?status=passed&limit=13`);
  assert.equal(connectorFreezeCheckpoints.collection, "connector_freeze_checkpoints");
  assert.ok(connectorFreezeCheckpoints.count <= 13);

  const connectorFreezeValidations = await fetchJson(`${url}/api/connector-freeze-validations?status=passed&limit=13`);
  assert.equal(connectorFreezeValidations.collection, "connector_freeze_validations");
  assert.ok(connectorFreezeValidations.count <= 13);

  const backfillJobContracts = await fetchJson(`${url}/api/backfill-job-contracts?backfill_job_contract_status=complete&limit=1`);
  assert.equal(backfillJobContracts.collection, "backfill_job_contracts");
  assert.ok(backfillJobContracts.count <= 1);

  const backfillJobFieldRequirements = await fetchJson(`${url}/api/backfill-job-field-requirements?backfill_field_status=validated&limit=24`);
  assert.equal(backfillJobFieldRequirements.collection, "backfill_job_field_requirements");
  assert.ok(backfillJobFieldRequirements.count <= 24);

  const backfillJobSourceBindings = await fetchJson(`${url}/api/backfill-job-source-bindings?backfill_source_binding_status=bound&limit=4`);
  assert.equal(backfillJobSourceBindings.collection, "backfill_job_source_bindings");
  assert.ok(backfillJobSourceBindings.count <= 4);

  const backfillJobCursorContracts = await fetchJson(`${url}/api/backfill-job-cursor-contracts?backfill_cursor_contract_status=passed&limit=5`);
  assert.equal(backfillJobCursorContracts.collection, "backfill_job_cursor_contracts");
  assert.ok(backfillJobCursorContracts.count <= 5);

  const backfillJobBatchContracts = await fetchJson(`${url}/api/backfill-job-batch-contracts?backfill_batch_contract_status=passed&limit=4`);
  assert.equal(backfillJobBatchContracts.collection, "backfill_job_batch_contracts");
  assert.ok(backfillJobBatchContracts.count <= 4);

  const backfillJobCountContracts = await fetchJson(`${url}/api/backfill-job-count-contracts?backfill_count_contract_status=passed&limit=5`);
  assert.equal(backfillJobCountContracts.collection, "backfill_job_count_contracts");
  assert.ok(backfillJobCountContracts.count <= 5);

  const backfillJobPolicyBindings = await fetchJson(`${url}/api/backfill-job-policy-bindings?backfill_policy_binding_status=bound&limit=4`);
  assert.equal(backfillJobPolicyBindings.collection, "backfill_job_policy_bindings");
  assert.ok(backfillJobPolicyBindings.count <= 4);

  const backfillJobValidations = await fetchJson(`${url}/api/backfill-job-validations?status=passed&limit=19`);
  assert.equal(backfillJobValidations.collection, "backfill_job_validations");
  assert.ok(backfillJobValidations.count <= 19);

  const expansionCursorLedgers = await fetchJson(`${url}/api/expansion-cursor-ledgers?expansion_cursor_ledger_status=complete&limit=1`);
  assert.equal(expansionCursorLedgers.collection, "expansion_cursor_ledgers");
  assert.ok(expansionCursorLedgers.count <= 1);

  const expansionCursorRows = await fetchJson(`${url}/api/expansion-cursor-state-rows?expansion_cursor_state_status=passed&limit=6`);
  assert.equal(expansionCursorRows.collection, "expansion_cursor_state_rows");
  assert.ok(expansionCursorRows.count <= 6);

  const expansionBatchRows = await fetchJson(`${url}/api/expansion-batch-state-rows?expansion_batch_state_status=passed&limit=5`);
  assert.equal(expansionBatchRows.collection, "expansion_batch_state_rows");
  assert.ok(expansionBatchRows.count <= 5);

  const expansionResumeCheckpoints = await fetchJson(`${url}/api/expansion-resume-checkpoints?expansion_resume_checkpoint_status=passed&limit=18`);
  assert.equal(expansionResumeCheckpoints.collection, "expansion_resume_checkpoints");
  assert.ok(expansionResumeCheckpoints.count <= 18);

  const expansionBatchItemPositions = await fetchJson(`${url}/api/expansion-batch-item-positions?expansion_resume_key_status=portable&limit=16`);
  assert.equal(expansionBatchItemPositions.collection, "expansion_batch_item_positions");
  assert.ok(expansionBatchItemPositions.count <= 16);

  const expansionPathPortability = await fetchJson(`${url}/api/expansion-cursor-path-portability-checks?expansion_path_portability_status=passed&limit=6`);
  assert.equal(expansionPathPortability.collection, "expansion_cursor_path_portability_checks");
  assert.ok(expansionPathPortability.count <= 6);

  const expansionCursorValidations = await fetchJson(`${url}/api/expansion-cursor-validations?status=passed&limit=23`);
  assert.equal(expansionCursorValidations.collection, "expansion_cursor_validations");
  assert.ok(expansionCursorValidations.count <= 23);

  const expansionDedupLedgers = await fetchJson(`${url}/api/expansion-dedup-ledgers?expansion_dedup_ledger_status=complete&limit=1`);
  assert.equal(expansionDedupLedgers.collection, "expansion_dedup_ledgers");
  assert.ok(expansionDedupLedgers.count <= 1);

  const expansionDedupKeys = await fetchJson(`${url}/api/expansion-dedup-idempotency-keys?expansion_dedup_key_status=registered&limit=16`);
  assert.equal(expansionDedupKeys.collection, "expansion_dedup_idempotency_keys");
  assert.ok(expansionDedupKeys.count <= 16);

  const expansionContentHashGroups = await fetchJson(`${url}/api/expansion-content-hash-groups?expansion_content_hash_group_status=unique_content_hash&limit=16`);
  assert.equal(expansionContentHashGroups.collection, "expansion_content_hash_groups");
  assert.ok(expansionContentHashGroups.count <= 16);

  const expansionDuplicateDecisions = await fetchJson(`${url}/api/expansion-duplicate-decisions?expansion_duplicate_decision_status=passed&limit=16`);
  assert.equal(expansionDuplicateDecisions.collection, "expansion_duplicate_decisions");
  assert.ok(expansionDuplicateDecisions.count <= 16);

  const expansionSkippedDuplicates = await fetchJson(`${url}/api/expansion-skipped-duplicates?expansion_skipped_duplicate=true&limit=1`);
  assert.equal(expansionSkippedDuplicates.collection, "expansion_skipped_duplicates");
  assert.ok(expansionSkippedDuplicates.count <= 1);

  const expansionDedupResumeChecks = await fetchJson(`${url}/api/expansion-dedup-resume-checks?expansion_dedup_check_status=passed&limit=19`);
  assert.equal(expansionDedupResumeChecks.collection, "expansion_dedup_resume_checks");
  assert.ok(expansionDedupResumeChecks.count <= 19);

  const expansionDedupValidations = await fetchJson(`${url}/api/expansion-dedup-validations?status=passed&limit=19`);
  assert.equal(expansionDedupValidations.collection, "expansion_dedup_validations");
  assert.ok(expansionDedupValidations.count <= 19);

  const expansionQuarantineLedgers = await fetchJson(`${url}/api/expansion-quarantine-ledgers?expansion_quarantine_ledger_status=complete&limit=1`);
  assert.equal(expansionQuarantineLedgers.collection, "expansion_quarantine_ledgers");
  assert.ok(expansionQuarantineLedgers.count <= 1);

  const expansionQuarantineDecisions = await fetchJson(`${url}/api/expansion-quarantine-decisions?expansion_quarantine_decision=no_hold&limit=16`);
  assert.equal(expansionQuarantineDecisions.collection, "expansion_quarantine_decisions");
  assert.ok(expansionQuarantineDecisions.count <= 16);

  const expansionQuarantineHolds = await fetchJson(`${url}/api/expansion-quarantine-holds?expansion_quarantine_hold_status=held_for_human_review&limit=1`);
  assert.equal(expansionQuarantineHolds.collection, "expansion_quarantine_holds");
  assert.ok(expansionQuarantineHolds.count <= 1);

  const expansionQuarantineRules = await fetchJson(`${url}/api/expansion-quarantine-rules?expansion_quarantine_rule_status=registered&limit=5`);
  assert.equal(expansionQuarantineRules.collection, "expansion_quarantine_rules");
  assert.ok(expansionQuarantineRules.count <= 5);

  const expansionQuarantineAudits = await fetchJson(`${url}/api/expansion-quarantine-status-audits?expansion_quarantine_audit_status=passed&limit=1`);
  assert.equal(expansionQuarantineAudits.collection, "expansion_quarantine_status_audits");
  assert.ok(expansionQuarantineAudits.count <= 1);

  const expansionQuarantineChecks = await fetchJson(`${url}/api/expansion-quarantine-resume-checks?expansion_quarantine_check_status=passed&limit=20`);
  assert.equal(expansionQuarantineChecks.collection, "expansion_quarantine_resume_checks");
  assert.ok(expansionQuarantineChecks.count <= 20);

  const expansionQuarantineValidations = await fetchJson(`${url}/api/expansion-quarantine-validations?status=passed&limit=20`);
  assert.equal(expansionQuarantineValidations.collection, "expansion_quarantine_validations");
  assert.ok(expansionQuarantineValidations.count <= 20);

  const batchClassificationResults = await fetchJson(`${url}/api/batch-classification-results?batch_classification_result_status=complete&limit=1`);
  assert.equal(batchClassificationResults.collection, "batch_classification_results");
  assert.ok(batchClassificationResults.count <= 1);

  const batchClassificationRows = await fetchJson(`${url}/api/batch-classification-rows?batch_classification_status=classified_pending_human_review&limit=16`);
  assert.equal(batchClassificationRows.collection, "batch_classification_rows");
  assert.ok(batchClassificationRows.count <= 16);

  const batchClassificationRules = await fetchJson(`${url}/api/batch-classification-rules?batch_classification_rule_status=active&limit=6`);
  assert.equal(batchClassificationRules.collection, "batch_classification_rules");
  assert.ok(batchClassificationRules.count <= 6);

  const batchClassificationConfidence = await fetchJson(`${url}/api/batch-classification-confidence?batch_confidence_label=medium&limit=6`);
  assert.equal(batchClassificationConfidence.collection, "batch_classification_confidence");
  assert.ok(batchClassificationConfidence.count <= 6);

  const batchClassificationPolicyBindings = await fetchJson(`${url}/api/batch-classification-policy-bindings?batch_policy_binding_status=bound&limit=6`);
  assert.equal(batchClassificationPolicyBindings.collection, "batch_classification_policy_bindings");
  assert.ok(batchClassificationPolicyBindings.count <= 6);

  const batchClassificationChecks = await fetchJson(`${url}/api/batch-classification-checks?batch_classification_check_status=passed&limit=21`);
  assert.equal(batchClassificationChecks.collection, "batch_classification_checks");
  assert.ok(batchClassificationChecks.count <= 21);

  const batchClassificationValidations = await fetchJson(`${url}/api/batch-classification-validations?status=passed&limit=21`);
  assert.equal(batchClassificationValidations.collection, "batch_classification_validations");
  assert.ok(batchClassificationValidations.count <= 21);

  const batchMatterTaggingResults = await fetchJson(`${url}/api/batch-matter-tagging-results?batch_matter_tagging_result_status=complete&limit=1`);
  assert.equal(batchMatterTaggingResults.collection, "batch_matter_tagging_results");
  assert.ok(batchMatterTaggingResults.count <= 1);

  const batchMatterTaggingRows = await fetchJson(`${url}/api/batch-matter-tagging-rows?batch_matter_tagging_status=pending_human_confirmation&limit=16`);
  assert.equal(batchMatterTaggingRows.collection, "batch_matter_tagging_rows");
  assert.ok(batchMatterTaggingRows.count <= 16);

  const batchMatterTaggingCandidates = await fetchJson(`${url}/api/batch-matter-tagging-candidates?batch_matter_tagging_candidate_status=requires_human_confirmation&limit=16`);
  assert.equal(batchMatterTaggingCandidates.collection, "batch_matter_tagging_candidates");
  assert.ok(batchMatterTaggingCandidates.count <= 16);

  const batchMatterTaggingConfirmations = await fetchJson(`${url}/api/batch-matter-tagging-confirmations?batch_matter_tagging_confirmation_status=pending&limit=16`);
  assert.equal(batchMatterTaggingConfirmations.collection, "batch_matter_tagging_confirmations");
  assert.ok(batchMatterTaggingConfirmations.count <= 16);

  const batchMatterTaggingSeparations = await fetchJson(`${url}/api/batch-matter-tagging-separations?batch_matter_tagging_separation_status=automatic_candidate_separated_from_human_confirmation&limit=6`);
  assert.equal(batchMatterTaggingSeparations.collection, "batch_matter_tagging_separations");
  assert.ok(batchMatterTaggingSeparations.count <= 6);

  const batchMatterTaggingChecks = await fetchJson(`${url}/api/batch-matter-tagging-checks?batch_matter_tagging_check_status=passed&limit=24`);
  assert.equal(batchMatterTaggingChecks.collection, "batch_matter_tagging_checks");
  assert.ok(batchMatterTaggingChecks.count <= 24);

  const batchMatterTaggingValidations = await fetchJson(`${url}/api/batch-matter-tagging-validations?status=passed&limit=24`);
  assert.equal(batchMatterTaggingValidations.collection, "batch_matter_tagging_validations");
  assert.ok(batchMatterTaggingValidations.count <= 24);

  const extractorRegistries = await fetchJson(`${url}/api/extractor-registries?extractor_registry_status=complete&limit=1`);
  assert.equal(extractorRegistries.collection, "extractor_registries");
  assert.ok(extractorRegistries.count <= 1);

  const extractorRegistryEntries = await fetchJson(`${url}/api/extractor-registry-entries?extractor_registry_entry_status=compatible_pending_human_review&limit=16`);
  assert.equal(extractorRegistryEntries.collection, "extractor_registry_entries");
  assert.ok(extractorRegistryEntries.count <= 16);

  const extractorCompatibilityRows = await fetchJson(`${url}/api/extractor-compatibility-rows?extractor_compatibility_status=compatible_pending_human_review&limit=16`);
  assert.equal(extractorCompatibilityRows.collection, "extractor_compatibility_rows");
  assert.ok(extractorCompatibilityRows.count <= 16);

  const extractorDocumentTypes = await fetchJson(`${url}/api/extractor-document-type-compatibility?extractor_document_type_status=compatible_pending_human_review&limit=16`);
  assert.equal(extractorDocumentTypes.collection, "extractor_document_type_compatibility");
  assert.ok(extractorDocumentTypes.count <= 16);

  const extractorExtensions = await fetchJson(`${url}/api/extractor-extension-compatibility?extractor_extension_status=compatible_pending_human_review&limit=16`);
  assert.equal(extractorExtensions.collection, "extractor_extension_compatibility");
  assert.ok(extractorExtensions.count <= 16);

  const extractorRegistryChecks = await fetchJson(`${url}/api/extractor-registry-checks?extractor_registry_check_status=passed&limit=24`);
  assert.equal(extractorRegistryChecks.collection, "extractor_registry_checks");
  assert.ok(extractorRegistryChecks.count <= 24);

  const extractorRegistryValidations = await fetchJson(`${url}/api/extractor-registry-validations?status=passed&limit=24`);
  assert.equal(extractorRegistryValidations.collection, "extractor_registry_validations");
  assert.ok(extractorRegistryValidations.count <= 24);

  const extractorCoverageReports = await fetchJson(`${url}/api/extractor-coverage-reports?extractor_coverage_report_status=complete&limit=1`);
  assert.equal(extractorCoverageReports.collection, "extractor_coverage_reports");
  assert.ok(extractorCoverageReports.count <= 1);

  const extractorCoverageItems = await fetchJson(`${url}/api/extractor-coverage-items?extractor_coverage_item_status=covered_pending_human_review&limit=16`);
  assert.equal(extractorCoverageItems.collection, "extractor_coverage_items");
  assert.ok(extractorCoverageItems.count <= 16);

  const extractorCoverageDocumentTypes = await fetchJson(`${url}/api/extractor-coverage-document-types?extractor_document_type_coverage_status=covered_pending_human_review&limit=16`);
  assert.equal(extractorCoverageDocumentTypes.collection, "extractor_coverage_document_types");
  assert.ok(extractorCoverageDocumentTypes.count <= 16);

  const extractorCoverageExtensions = await fetchJson(`${url}/api/extractor-coverage-extensions?extractor_extension_coverage_status=covered_pending_human_review&limit=16`);
  assert.equal(extractorCoverageExtensions.collection, "extractor_coverage_extensions");
  assert.ok(extractorCoverageExtensions.count <= 16);

  const extractorCoverageStatuses = await fetchJson(`${url}/api/extractor-coverage-statuses?extractor_status_coverage_status=covered_pending_human_review&limit=8`);
  assert.equal(extractorCoverageStatuses.collection, "extractor_coverage_statuses");
  assert.ok(extractorCoverageStatuses.count <= 8);

  const extractorCoverageUnsupportedTypes = await fetchJson(`${url}/api/extractor-coverage-unsupported-types?limit=8`);
  assert.equal(extractorCoverageUnsupportedTypes.collection, "extractor_coverage_unsupported_types");
  assert.ok(extractorCoverageUnsupportedTypes.count <= 8);

  const extractorCoverageFailures = await fetchJson(`${url}/api/extractor-coverage-failures?limit=8`);
  assert.equal(extractorCoverageFailures.collection, "extractor_coverage_failures");
  assert.ok(extractorCoverageFailures.count <= 8);

  const extractorCoverageChecks = await fetchJson(`${url}/api/extractor-coverage-checks?extractor_coverage_check_status=passed&limit=30`);
  assert.equal(extractorCoverageChecks.collection, "extractor_coverage_checks");
  assert.ok(extractorCoverageChecks.count <= 30);

  const extractorCoverageValidations = await fetchJson(`${url}/api/extractor-coverage-validations?status=passed&limit=30`);
  assert.equal(extractorCoverageValidations.collection, "extractor_coverage_validations");
  assert.ok(extractorCoverageValidations.count <= 30);

  const expansionStatusDashboards = await fetchJson(`${url}/api/expansion-status-dashboards?expansion_status_dashboard_status=complete&limit=1`);
  assert.equal(expansionStatusDashboards.collection, "expansion_status_dashboards");
  assert.ok(expansionStatusDashboards.count <= 1);

  const expansionStatusItems = await fetchJson(`${url}/api/expansion-status-items?expansion_status_bucket=discovered&limit=16`);
  assert.equal(expansionStatusItems.collection, "expansion_status_items");
  assert.ok(expansionStatusItems.count <= 16);

  const expansionStatusRollups = await fetchJson(`${url}/api/expansion-status-rollups?expansion_status_bucket=discovered&limit=5`);
  assert.equal(expansionStatusRollups.collection, "expansion_status_rollups");
  assert.ok(expansionStatusRollups.count <= 5);

  const expansionDiscoveredItems = await fetchJson(`${url}/api/expansion-discovered-items?limit=16`);
  assert.equal(expansionDiscoveredItems.collection, "expansion_discovered_items");
  assert.ok(expansionDiscoveredItems.count <= 16);

  const expansionQueuedItems = await fetchJson(`${url}/api/expansion-queued-items?limit=16`);
  assert.equal(expansionQueuedItems.collection, "expansion_queued_items");
  assert.ok(expansionQueuedItems.count <= 16);

  const expansionIngestedItems = await fetchJson(`${url}/api/expansion-ingested-items?limit=16`);
  assert.equal(expansionIngestedItems.collection, "expansion_ingested_items");
  assert.ok(expansionIngestedItems.count <= 16);

  const expansionFailedItems = await fetchJson(`${url}/api/expansion-failed-items?limit=16`);
  assert.equal(expansionFailedItems.collection, "expansion_failed_items");
  assert.ok(expansionFailedItems.count <= 16);

  const expansionQuarantinedItems = await fetchJson(`${url}/api/expansion-quarantined-items?limit=16`);
  assert.equal(expansionQuarantinedItems.collection, "expansion_quarantined_items");
  assert.ok(expansionQuarantinedItems.count <= 16);

  const expansionStatusPanels = await fetchJson(`${url}/api/expansion-status-panels?expansion_status_panel_status=queryable&limit=5`);
  assert.equal(expansionStatusPanels.collection, "expansion_status_panels");
  assert.ok(expansionStatusPanels.count <= 5);

  const expansionStatusApiRoutes = await fetchJson(`${url}/api/expansion-status-api-routes?expansion_status_route_status=queryable&limit=12`);
  assert.equal(expansionStatusApiRoutes.collection, "expansion_status_api_routes");
  assert.ok(expansionStatusApiRoutes.count <= 12);

  const expansionStatusChecks = await fetchJson(`${url}/api/expansion-status-checks?expansion_status_check_status=passed&limit=24`);
  assert.equal(expansionStatusChecks.collection, "expansion_status_checks");
  assert.ok(expansionStatusChecks.count <= 24);

  const expansionStatusValidations = await fetchJson(`${url}/api/expansion-status-validations?status=passed&limit=24`);
  assert.equal(expansionStatusValidations.collection, "expansion_status_validations");
  assert.ok(expansionStatusValidations.count <= 24);

  const resourceExpansionFreezes = await fetchJson(`${url}/api/resource-expansion-freezes?resource_expansion_freeze_status=complete&limit=1`);
  assert.equal(resourceExpansionFreezes.collection, "resource_expansion_freezes");
  assert.ok(resourceExpansionFreezes.count <= 1);

  const resourceExpansionFreezeSources = await fetchJson(`${url}/api/resource-expansion-freeze-sources?expansion_freeze_source_status=complete&limit=10`);
  assert.equal(resourceExpansionFreezeSources.collection, "expansion_freeze_source_rows");
  assert.ok(resourceExpansionFreezeSources.count <= 10);

  const resourceExpansionFreezeDryRuns = await fetchJson(`${url}/api/resource-expansion-freeze-dry-runs?expansion_freeze_dry_run_status=passed&limit=20`);
  assert.equal(resourceExpansionFreezeDryRuns.collection, "expansion_freeze_dry_run_rows");
  assert.ok(resourceExpansionFreezeDryRuns.count <= 20);

  const resourceExpansionFreezeResumeProbes = await fetchJson(`${url}/api/resource-expansion-freeze-resume-probes?expansion_freeze_resume_status=passed&limit=12`);
  assert.equal(resourceExpansionFreezeResumeProbes.collection, "expansion_freeze_resume_probes");
  assert.ok(resourceExpansionFreezeResumeProbes.count <= 12);

  const resourceExpansionFreezeIdempotencyProbes = await fetchJson(`${url}/api/resource-expansion-freeze-idempotency-probes?expansion_freeze_idempotency_status=passed&limit=12`);
  assert.equal(resourceExpansionFreezeIdempotencyProbes.collection, "expansion_freeze_idempotency_probes");
  assert.ok(resourceExpansionFreezeIdempotencyProbes.count <= 12);

  const resourceExpansionFreezeScaleChecks = await fetchJson(`${url}/api/resource-expansion-freeze-scale-checks?expansion_freeze_scale_check_status=passed&limit=12`);
  assert.equal(resourceExpansionFreezeScaleChecks.collection, "expansion_freeze_scale_checks");
  assert.ok(resourceExpansionFreezeScaleChecks.count <= 12);

  const resourceExpansionFreezeBoundary = await fetchJson(`${url}/api/resource-expansion-freeze-boundary?expansion_freeze_boundary_status=enforced&limit=1`);
  assert.equal(resourceExpansionFreezeBoundary.collection, "expansion_freeze_boundary");
  assert.ok(resourceExpansionFreezeBoundary.count <= 1);

  const resourceExpansionFreezeChecks = await fetchJson(`${url}/api/resource-expansion-freeze-checks?status=passed&limit=24`);
  assert.equal(resourceExpansionFreezeChecks.collection, "expansion_freeze_checkpoints");
  assert.ok(resourceExpansionFreezeChecks.count <= 24);

  const resourceExpansionFreezeValidations = await fetchJson(`${url}/api/resource-expansion-freeze-validations?status=passed&limit=24`);
  assert.equal(resourceExpansionFreezeValidations.collection, "expansion_freeze_validations");
  assert.ok(resourceExpansionFreezeValidations.count <= 24);

  const apiRouteInventories = await fetchJson(`${url}/api/api-route-inventories?api_route_inventory_status=complete&limit=1`);
  assert.equal(apiRouteInventories.collection, "api_route_inventories");
  assert.ok(apiRouteInventories.count <= 1);

  const apiRouteGroups = await fetchJson(`${url}/api/api-route-groups?api_route_group_status=listed&limit=6`);
  assert.equal(apiRouteGroups.collection, "api_route_groups");
  assert.ok(apiRouteGroups.count <= 6);

  const apiRouteRecords = await fetchJson(`${url}/api/api-route-records?api_route_status=listed&read_only=true&limit=20`);
  assert.equal(apiRouteRecords.collection, "api_route_records");
  assert.ok(apiRouteRecords.count <= 20);

  const apiRouteCoreRecords = await fetchJson(`${url}/api/api-route-records?route_group_key=core&limit=10`);
  assert.equal(apiRouteCoreRecords.collection, "api_route_records");
  assert.ok(apiRouteCoreRecords.count <= 10);

  const apiRouteInventoryChecks = await fetchJson(`${url}/api/api-route-inventory-checks?status=passed&limit=20`);
  assert.equal(apiRouteInventoryChecks.collection, "api_route_inventory_checks");
  assert.ok(apiRouteInventoryChecks.count <= 20);

  const apiRouteInventoryBoundary = await fetchJson(`${url}/api/api-route-inventory-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(apiRouteInventoryBoundary.collection, "api_route_inventory_boundary");
  assert.ok(apiRouteInventoryBoundary.count <= 1);

  const apiRouteInventoryValidations = await fetchJson(`${url}/api/api-route-inventory-validations?status=passed&limit=20`);
  assert.equal(apiRouteInventoryValidations.collection, "api_route_inventory_validations");
  assert.ok(apiRouteInventoryValidations.count <= 20);

  const dashboardInformationArchitectures = await fetchJson(`${url}/api/review-dashboard-information-architectures?dashboard_ia_status=complete&limit=1`);
  assert.equal(dashboardInformationArchitectures.collection, "review_dashboard_information_architectures");
  assert.ok(dashboardInformationArchitectures.count <= 1);

  const dashboardIaSections = await fetchJson(`${url}/api/review-dashboard-ia-sections?ia_section_status=mapped&limit=9`);
  assert.equal(dashboardIaSections.collection, "review_dashboard_ia_sections");
  assert.ok(dashboardIaSections.count <= 9);

  const dashboardNavigationItems = await fetchJson(`${url}/api/review-dashboard-navigation-items?navigation_item_status=mapped&limit=9`);
  assert.equal(dashboardNavigationItems.collection, "review_dashboard_navigation_items");
  assert.ok(dashboardNavigationItems.count <= 9);

  const dashboardIaRouteBindings = await fetchJson(`${url}/api/review-dashboard-ia-route-bindings?route_binding_status=mapped&read_only=true&limit=20`);
  assert.equal(dashboardIaRouteBindings.collection, "review_dashboard_ia_route_bindings");
  assert.ok(dashboardIaRouteBindings.count <= 20);

  const dashboardIaEvidenceBindings = await fetchJson(`${url}/api/review-dashboard-ia-route-bindings?ia_section_key=evidence&limit=10`);
  assert.equal(dashboardIaEvidenceBindings.collection, "review_dashboard_ia_route_bindings");
  assert.ok(dashboardIaEvidenceBindings.count <= 10);

  const dashboardIaChecks = await fetchJson(`${url}/api/review-dashboard-ia-checks?status=passed&limit=20`);
  assert.equal(dashboardIaChecks.collection, "review_dashboard_ia_checks");
  assert.ok(dashboardIaChecks.count <= 20);

  const dashboardIaBoundary = await fetchJson(`${url}/api/review-dashboard-ia-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(dashboardIaBoundary.collection, "review_dashboard_ia_boundary");
  assert.ok(dashboardIaBoundary.count <= 1);

  const dashboardIaValidations = await fetchJson(`${url}/api/review-dashboard-ia-validations?status=passed&limit=20`);
  assert.equal(dashboardIaValidations.collection, "review_dashboard_ia_validations");
  assert.ok(dashboardIaValidations.count <= 20);

  const approvalQueueUiArtifacts = await fetchJson(`${url}/api/approval-queue-ui-artifacts?approval_queue_ui_status=complete&limit=1`);
  assert.equal(approvalQueueUiArtifacts.collection, "approval_queue_ui_artifacts");
  assert.ok(approvalQueueUiArtifacts.count <= 1);

  const approvalQueueUiPanels = await fetchJson(`${url}/api/approval-queue-ui-panels?approval_queue_ui_panel_status=ready&limit=5`);
  assert.equal(approvalQueueUiPanels.collection, "approval_queue_ui_panels");
  assert.ok(approvalQueueUiPanels.count <= 5);

  const approvalQueueUiItems = await fetchJson(`${url}/api/approval-queue-ui-items?approval_queue_ui_item_status=pending&pending_approval=true&read_only=true&limit=20`);
  assert.equal(approvalQueueUiItems.collection, "approval_queue_ui_items");
  assert.ok(approvalQueueUiItems.count <= 20);

  const approvalQueueUiActorItems = await fetchJson(`${url}/api/approval-queue-ui-items?required_actor=human_reviewer&limit=10`);
  assert.equal(approvalQueueUiActorItems.collection, "approval_queue_ui_items");
  assert.ok(approvalQueueUiActorItems.count <= 10);

  const approvalQueueTargetArtifacts = await fetchJson(`${url}/api/approval-queue-target-artifacts?target_artifact_lookup_status=linked&limit=20`);
  assert.equal(approvalQueueTargetArtifacts.collection, "approval_queue_target_artifacts");
  assert.ok(approvalQueueTargetArtifacts.count <= 20);

  const approvalQueueReceiptPreviews = await fetchJson(`${url}/api/approval-queue-receipt-previews?receipt_preview_status=draft_available&preview_only=true&limit=20`);
  assert.equal(approvalQueueReceiptPreviews.collection, "approval_queue_receipt_previews");
  assert.ok(approvalQueueReceiptPreviews.count <= 20);

  const approvalQueueProtectedRequestPreviews = await fetchJson(`${url}/api/approval-queue-protected-request-previews?protected_request_preview_status=pending_explicit_approval&protected_action=true&preview_only=true&limit=5`);
  assert.equal(approvalQueueProtectedRequestPreviews.collection, "approval_queue_protected_request_previews");
  assert.ok(approvalQueueProtectedRequestPreviews.count <= 5);

  const approvalQueueUiBoundary = await fetchJson(`${url}/api/approval-queue-ui-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(approvalQueueUiBoundary.collection, "approval_queue_ui_boundary");
  assert.ok(approvalQueueUiBoundary.count <= 1);

  const approvalQueueUiChecks = await fetchJson(`${url}/api/approval-queue-ui-checks?status=passed&limit=20`);
  assert.equal(approvalQueueUiChecks.collection, "approval_queue_ui_checks");
  assert.ok(approvalQueueUiChecks.count <= 20);

  const approvalQueueUiValidations = await fetchJson(`${url}/api/approval-queue-ui-validations?status=passed&limit=20`);
  assert.equal(approvalQueueUiValidations.collection, "approval_queue_ui_validations");
  assert.ok(approvalQueueUiValidations.count <= 20);

  const evidenceViewerUiArtifacts = await fetchJson(`${url}/api/evidence-viewer-ui-artifacts?evidence_viewer_ui_status=complete&limit=1`);
  assert.equal(evidenceViewerUiArtifacts.collection, "evidence_viewer_ui_artifacts");
  assert.ok(evidenceViewerUiArtifacts.count <= 1);

  const evidenceViewerUiPanels = await fetchJson(`${url}/api/evidence-viewer-ui-panels?evidence_viewer_ui_panel_status=ready&limit=5`);
  assert.equal(evidenceViewerUiPanels.collection, "evidence_viewer_ui_panels");
  assert.ok(evidenceViewerUiPanels.count <= 5);

  const evidenceViewerUiCards = await fetchJson(`${url}/api/evidence-viewer-ui-cards?evidence_viewer_ui_card_status=ready&source_span_binding_status=bound&citation_binding_status=bound&read_only=true&preview_only=true&limit=20`);
  assert.equal(evidenceViewerUiCards.collection, "evidence_viewer_ui_cards");
  assert.ok(evidenceViewerUiCards.count <= 20);

  const evidenceViewerUiSourceSpans = await fetchJson(`${url}/api/evidence-viewer-ui-source-spans?binding_status=bound&read_only=true&limit=20`);
  assert.equal(evidenceViewerUiSourceSpans.collection, "evidence_viewer_ui_source_spans");
  assert.ok(evidenceViewerUiSourceSpans.count <= 20);

  const evidenceViewerUiCitations = await fetchJson(`${url}/api/evidence-viewer-ui-citations?citation_binding_status=bound&human_review_required=true&client_facing_ready=false&limit=20`);
  assert.equal(evidenceViewerUiCitations.collection, "evidence_viewer_ui_citations");
  assert.ok(evidenceViewerUiCitations.count <= 20);

  const evidenceViewerUiCoverage = await fetchJson(`${url}/api/evidence-viewer-ui-coverage?coverage_status=partial&card_binding_status=bound&limit=20`);
  assert.equal(evidenceViewerUiCoverage.collection, "evidence_viewer_ui_coverage");
  assert.ok(evidenceViewerUiCoverage.count <= 20);

  const evidenceViewerUiFlags = await fetchJson(`${url}/api/evidence-viewer-ui-flags?human_review_required=true&card_binding_status=bound&limit=20`);
  assert.equal(evidenceViewerUiFlags.collection, "evidence_viewer_ui_flags");
  assert.ok(evidenceViewerUiFlags.count <= 20);

  const evidenceViewerUiBoundary = await fetchJson(`${url}/api/evidence-viewer-ui-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(evidenceViewerUiBoundary.collection, "evidence_viewer_ui_boundary");
  assert.ok(evidenceViewerUiBoundary.count <= 1);

  const evidenceViewerUiChecks = await fetchJson(`${url}/api/evidence-viewer-ui-checks?status=passed&limit=20`);
  assert.equal(evidenceViewerUiChecks.collection, "evidence_viewer_ui_checks");
  assert.ok(evidenceViewerUiChecks.count <= 20);

  const evidenceViewerUiValidations = await fetchJson(`${url}/api/evidence-viewer-ui-validations?status=passed&limit=20`);
  assert.equal(evidenceViewerUiValidations.collection, "evidence_viewer_ui_validations");
  assert.ok(evidenceViewerUiValidations.count <= 20);

  const sourceSpanInspectorArtifacts = await fetchJson(`${url}/api/source-span-inspector-artifacts?source_span_inspector_status=complete&limit=1`);
  assert.equal(sourceSpanInspectorArtifacts.collection, "source_span_inspector_artifacts");
  assert.ok(sourceSpanInspectorArtifacts.count <= 1);

  const sourceSpanInspectorPanels = await fetchJson(`${url}/api/source-span-inspector-panels?source_span_inspector_panel_status=ready&limit=4`);
  assert.equal(sourceSpanInspectorPanels.collection, "source_span_inspector_panels");
  assert.ok(sourceSpanInspectorPanels.count <= 4);

  const sourceSpanInspectorRows = await fetchJson(`${url}/api/source-span-inspector-rows?source_span_inspector_row_status=ready&comparison_status=matched&read_only=true&preview_only=true&limit=20`);
  assert.equal(sourceSpanInspectorRows.collection, "source_span_inspector_rows");
  assert.ok(sourceSpanInspectorRows.count <= 20);

  const sourceSpanLocationComparisons = await fetchJson(`${url}/api/source-span-location-comparisons?comparison_status=matched&read_only=true&limit=20`);
  assert.equal(sourceSpanLocationComparisons.collection, "source_span_location_comparisons");
  assert.ok(sourceSpanLocationComparisons.count <= 20);

  const normalizedTextComparisons = await fetchJson(`${url}/api/normalized-text-comparisons?comparison_status=matched&preview_match_status=matched&read_only=true&limit=20`);
  assert.equal(normalizedTextComparisons.collection, "normalized_text_comparisons");
  assert.ok(normalizedTextComparisons.count <= 20);

  const extractedFactComparisons = await fetchJson(`${url}/api/extracted-fact-comparisons?comparison_status=matched&human_review_required=true&client_facing_ready=false&limit=20`);
  assert.equal(extractedFactComparisons.collection, "extracted_fact_comparisons");
  assert.ok(extractedFactComparisons.count <= 20);

  const sourceSpanInspectorBoundary = await fetchJson(`${url}/api/source-span-inspector-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(sourceSpanInspectorBoundary.collection, "source_span_inspector_boundary");
  assert.ok(sourceSpanInspectorBoundary.count <= 1);

  const sourceSpanInspectorChecks = await fetchJson(`${url}/api/source-span-inspector-checks?status=passed&limit=20`);
  assert.equal(sourceSpanInspectorChecks.collection, "source_span_inspector_checks");
  assert.ok(sourceSpanInspectorChecks.count <= 20);

  const sourceSpanInspectorValidations = await fetchJson(`${url}/api/source-span-inspector-validations?status=passed&limit=20`);
  assert.equal(sourceSpanInspectorValidations.collection, "source_span_inspector_validations");
  assert.ok(sourceSpanInspectorValidations.count <= 20);

  const runLedgerViewerArtifacts = await fetchJson(`${url}/api/run-ledger-viewer-artifacts?run_ledger_viewer_status=complete&limit=1`);
  assert.equal(runLedgerViewerArtifacts.collection, "run_ledger_viewer_artifacts");
  assert.ok(runLedgerViewerArtifacts.count <= 1);

  const runLedgerViewerPanels = await fetchJson(`${url}/api/run-ledger-viewer-panels?run_ledger_viewer_panel_status=ready&limit=6`);
  assert.equal(runLedgerViewerPanels.collection, "run_ledger_viewer_panels");
  assert.ok(runLedgerViewerPanels.count <= 6);

  const desktopSessionViews = await fetchJson(`${url}/api/desktop-session-views?desktop_session_status=ready&read_only=true&preview_only=true&limit=10`);
  assert.equal(desktopSessionViews.collection, "desktop_session_views");
  assert.ok(desktopSessionViews.count <= 10);

  const runProgressViews = await fetchJson(`${url}/api/run-progress-views?run_progress_status=blocked_pending_human_review&read_only=true&limit=10`);
  assert.equal(runProgressViews.collection, "run_progress_views");
  assert.ok(runProgressViews.count <= 10);

  const runHistoryViews = await fetchJson(`${url}/api/run-history-views?run_history_status=linked&read_only=true&limit=20`);
  assert.equal(runHistoryViews.collection, "run_history_views");
  assert.ok(runHistoryViews.count <= 20);

  const runAgentActivityViews = await fetchJson(`${url}/api/run-agent-activity-views?agent_activity_status=ready&read_only=true&limit=10`);
  assert.equal(runAgentActivityViews.collection, "run_agent_activity_views");
  assert.ok(runAgentActivityViews.count <= 10);

  const runToolActivityViews = await fetchJson(`${url}/api/run-tool-activity-views?tool_activity_status=ready&read_only=true&limit=20`);
  assert.equal(runToolActivityViews.collection, "run_tool_activity_views");
  assert.ok(runToolActivityViews.count <= 20);

  const runLogArtifactViews = await fetchJson(`${url}/api/run-log-artifact-views?log_artifact_view_status=ready&read_only=true&preview_only=true&limit=20`);
  assert.equal(runLogArtifactViews.collection, "run_log_artifact_views");
  assert.ok(runLogArtifactViews.count <= 20);

  const runLedgerViewerBoundary = await fetchJson(`${url}/api/run-ledger-viewer-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(runLedgerViewerBoundary.collection, "run_ledger_viewer_boundary");
  assert.ok(runLedgerViewerBoundary.count <= 1);

  const runLedgerViewerChecks = await fetchJson(`${url}/api/run-ledger-viewer-checks?status=passed&limit=20`);
  assert.equal(runLedgerViewerChecks.collection, "run_ledger_viewer_checks");
  assert.ok(runLedgerViewerChecks.count <= 20);

  const runLedgerViewerValidations = await fetchJson(`${url}/api/run-ledger-viewer-validations?status=passed&limit=20`);
  assert.equal(runLedgerViewerValidations.collection, "run_ledger_viewer_validations");
  assert.ok(runLedgerViewerValidations.count <= 20);

  const matterCockpitUiArtifacts = await fetchJson(`${url}/api/matter-cockpit-ui-artifacts?matter_cockpit_ui_status=complete&limit=1`);
  assert.equal(matterCockpitUiArtifacts.collection, "matter_cockpit_ui_artifacts");
  assert.ok(matterCockpitUiArtifacts.count <= 1);

  const matterCockpitUiPanels = await fetchJson(`${url}/api/matter-cockpit-ui-panels?matter_cockpit_ui_panel_status=ready&limit=6`);
  assert.equal(matterCockpitUiPanels.collection, "matter_cockpit_ui_panels");
  assert.ok(matterCockpitUiPanels.count <= 6);

  const matterCockpitProfileCards = await fetchJson(`${url}/api/matter-cockpit-profile-cards?profile_card_status=complete&read_only=true&preview_only=true&limit=5`);
  assert.equal(matterCockpitProfileCards.collection, "matter_cockpit_profile_cards");
  assert.ok(matterCockpitProfileCards.count <= 5);

  const matterCockpitTimelineRows = await fetchJson(`${url}/api/matter-cockpit-timeline-rows?timeline_row_status=ready&read_only=true&limit=20`);
  assert.equal(matterCockpitTimelineRows.collection, "matter_cockpit_timeline_rows");
  assert.ok(matterCockpitTimelineRows.count <= 20);

  const matterCockpitTaskRows = await fetchJson(`${url}/api/matter-cockpit-task-rows?task_row_status=ready&task_column=in_review&read_only=true&limit=20`);
  assert.equal(matterCockpitTaskRows.collection, "matter_cockpit_task_rows");
  assert.ok(matterCockpitTaskRows.count <= 20);

  const matterCockpitDocumentRows = await fetchJson(`${url}/api/matter-cockpit-document-rows?document_row_status=ready&document_status=pending_review&read_only=true&limit=20`);
  assert.equal(matterCockpitDocumentRows.collection, "matter_cockpit_document_rows");
  assert.ok(matterCockpitDocumentRows.count <= 20);

  const matterCockpitEvidenceRows = await fetchJson(`${url}/api/matter-cockpit-evidence-rows?evidence_row_status=ready&read_only=true&preview_only=true&limit=20`);
  assert.equal(matterCockpitEvidenceRows.collection, "matter_cockpit_evidence_rows");
  assert.ok(matterCockpitEvidenceRows.count <= 20);

  const matterCockpitApprovalRows = await fetchJson(`${url}/api/matter-cockpit-approval-rows?approval_row_status=ready&item_status=pending&read_only=true&limit=20`);
  assert.equal(matterCockpitApprovalRows.collection, "matter_cockpit_approval_rows");
  assert.ok(matterCockpitApprovalRows.count <= 20);

  const matterCockpitUiBoundary = await fetchJson(`${url}/api/matter-cockpit-ui-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterCockpitUiBoundary.collection, "matter_cockpit_ui_boundary");
  assert.ok(matterCockpitUiBoundary.count <= 1);

  const matterCockpitUiChecks = await fetchJson(`${url}/api/matter-cockpit-ui-checks?status=passed&limit=20`);
  assert.equal(matterCockpitUiChecks.collection, "matter_cockpit_ui_checks");
  assert.ok(matterCockpitUiChecks.count <= 20);

  const matterCockpitUiValidations = await fetchJson(`${url}/api/matter-cockpit-ui-validations?status=passed&limit=20`);
  assert.equal(matterCockpitUiValidations.collection, "matter_cockpit_ui_validations");
  assert.ok(matterCockpitUiValidations.count <= 20);

  const policyViolationQueueArtifacts = await fetchJson(`${url}/api/policy-violation-queue-artifacts?policy_violation_queue_status=complete&limit=1`);
  assert.equal(policyViolationQueueArtifacts.collection, "policy_violation_queue_artifacts");
  assert.ok(policyViolationQueueArtifacts.count <= 1);

  const policyViolationQueuePanels = await fetchJson(`${url}/api/policy-violation-queue-panels?policy_violation_queue_panel_status=ready&limit=4`);
  assert.equal(policyViolationQueuePanels.collection, "policy_violation_queue_panels");
  assert.ok(policyViolationQueuePanels.count <= 4);

  const policyViolationQueueItems = await fetchJson(`${url}/api/policy-violation-queue-items?queue_item_status=open&policy_family=tool&severity=warning&read_only=true&limit=20`);
  assert.equal(policyViolationQueueItems.collection, "policy_violation_queue_items");
  assert.ok(policyViolationQueueItems.count <= 20);

  const policyViolationActorActions = await fetchJson(`${url}/api/policy-violation-actor-actions?actor_action_status=open&actor_action_type=review_output_destination_hold&read_only=true&limit=20`);
  assert.equal(policyViolationActorActions.collection, "policy_violation_actor_actions");
  assert.ok(policyViolationActorActions.count <= 20);

  const policyViolationQueueBoundary = await fetchJson(`${url}/api/policy-violation-queue-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(policyViolationQueueBoundary.collection, "policy_violation_queue_boundary");
  assert.ok(policyViolationQueueBoundary.count <= 1);

  const policyViolationQueueChecks = await fetchJson(`${url}/api/policy-violation-queue-checks?status=passed&limit=20`);
  assert.equal(policyViolationQueueChecks.collection, "policy_violation_queue_checks");
  assert.ok(policyViolationQueueChecks.count <= 20);

  const policyViolationQueueValidations = await fetchJson(`${url}/api/policy-violation-queue-validations?status=passed&limit=20`);
  assert.equal(policyViolationQueueValidations.collection, "policy_violation_queue_validations");
  assert.ok(policyViolationQueueValidations.count <= 20);

  const matterOsProfileArtifacts = await fetchJson(`${url}/api/matter-os-profile-artifacts?matter_os_profile_status=complete&limit=1`);
  assert.equal(matterOsProfileArtifacts.collection, "matter_os_profile_artifacts");
  assert.ok(matterOsProfileArtifacts.count <= 1);

  const matterOsProfiles = await fetchJson(`${url}/api/matter-os-profiles?profile_card_status=complete&limit=5`);
  assert.equal(matterOsProfiles.collection, "matter_os_profiles");
  assert.ok(matterOsProfiles.count <= 5);

  const matterOsDisplayFields = await fetchJson(`${url}/api/matter-os-display-fields?display_field_status=complete&limit=5`);
  assert.equal(matterOsDisplayFields.collection, "matter_os_display_fields");
  assert.ok(matterOsDisplayFields.count <= 5);

  const matterOsProfileBoundary = await fetchJson(`${url}/api/matter-os-profile-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterOsProfileBoundary.collection, "matter_os_profile_boundary");
  assert.ok(matterOsProfileBoundary.count <= 1);

  const matterOsProfileValidations = await fetchJson(`${url}/api/matter-os-profile-validations?status=passed&limit=5`);
  assert.equal(matterOsProfileValidations.collection, "matter_os_profile_validations");
  assert.ok(matterOsProfileValidations.count <= 5);

  const matterTimelineArtifacts = await fetchJson(`${url}/api/matter-timeline-artifacts?matter_timeline_status=complete&limit=1`);
  assert.equal(matterTimelineArtifacts.collection, "matter_timeline_artifacts");
  assert.ok(matterTimelineArtifacts.count <= 1);

  const matterTimelineEvents = await fetchJson(`${url}/api/matter-timeline-events?timeline_event_type=deadline&limit=5`);
  assert.equal(matterTimelineEvents.collection, "matter_timeline_events");
  assert.ok(matterTimelineEvents.count <= 5);

  const matterTimelineMatters = await fetchJson(`${url}/api/matter-timeline-matters?timeline_matter_status=complete&limit=5`);
  assert.equal(matterTimelineMatters.collection, "matter_timeline_matters");
  assert.ok(matterTimelineMatters.count <= 5);

  const matterTimelineBoundary = await fetchJson(`${url}/api/matter-timeline-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterTimelineBoundary.collection, "matter_timeline_boundary");
  assert.ok(matterTimelineBoundary.count <= 1);

  const matterTimelineValidations = await fetchJson(`${url}/api/matter-timeline-validations?status=passed&limit=5`);
  assert.equal(matterTimelineValidations.collection, "matter_timeline_validations");
  assert.ok(matterTimelineValidations.count <= 5);

  const matterDocumentIndexArtifacts = await fetchJson(`${url}/api/matter-document-index-artifacts?matter_document_index_status=complete&limit=1`);
  assert.equal(matterDocumentIndexArtifacts.collection, "matter_document_index_artifacts");
  assert.ok(matterDocumentIndexArtifacts.count <= 1);

  const matterDocumentRecords = await fetchJson(`${url}/api/matter-document-records?document_role=original&limit=5`);
  assert.equal(matterDocumentRecords.collection, "matter_document_records");
  assert.ok(matterDocumentRecords.count <= 5);

  const matterDocumentFamilies = await fetchJson(`${url}/api/matter-document-families?document_family_status=indexed&limit=5`);
  assert.equal(matterDocumentFamilies.collection, "matter_document_families");
  assert.ok(matterDocumentFamilies.count <= 5);

  const matterLatestDocuments = await fetchJson(`${url}/api/matter-latest-documents?latest_document=true&limit=5`);
  assert.equal(matterLatestDocuments.collection, "matter_latest_documents");
  assert.ok(matterLatestDocuments.count <= 5);

  const matterDocumentIndexBoundary = await fetchJson(`${url}/api/matter-document-index-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterDocumentIndexBoundary.collection, "matter_document_index_boundary");
  assert.ok(matterDocumentIndexBoundary.count <= 1);

  const matterDocumentIndexValidations = await fetchJson(`${url}/api/matter-document-index-validations?status=passed&limit=5`);
  assert.equal(matterDocumentIndexValidations.collection, "matter_document_index_validations");
  assert.ok(matterDocumentIndexValidations.count <= 5);

  const matterTaskBoardArtifacts = await fetchJson(`${url}/api/matter-task-board-artifacts?matter_task_board_status=complete&limit=1`);
  assert.equal(matterTaskBoardArtifacts.collection, "matter_task_board_artifacts");
  assert.ok(matterTaskBoardArtifacts.count <= 1);

  const matterTaskRecords = await fetchJson(`${url}/api/matter-task-records?task_category=matter_task&limit=5`);
  assert.equal(matterTaskRecords.collection, "matter_task_records");
  assert.ok(matterTaskRecords.count <= 5);

  const matterTaskColumns = await fetchJson(`${url}/api/matter-task-board-columns?task_column=open&limit=5`);
  assert.equal(matterTaskColumns.collection, "matter_task_board_columns");
  assert.ok(matterTaskColumns.count <= 5);

  const matterTaskWorkflowBindings = await fetchJson(`${url}/api/matter-task-workflow-bindings?task_workflow_binding_status=bound&workflow_run_bound=true&limit=5`);
  assert.equal(matterTaskWorkflowBindings.collection, "matter_task_workflow_bindings");
  assert.ok(matterTaskWorkflowBindings.count <= 5);

  const matterTaskBoardBoundary = await fetchJson(`${url}/api/matter-task-board-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterTaskBoardBoundary.collection, "matter_task_board_boundary");
  assert.ok(matterTaskBoardBoundary.count <= 1);

  const matterTaskBoardValidations = await fetchJson(`${url}/api/matter-task-board-validations?status=passed&limit=5`);
  assert.equal(matterTaskBoardValidations.collection, "matter_task_board_validations");
  assert.ok(matterTaskBoardValidations.count <= 5);

  const matterKnowledgeGraphArtifacts = await fetchJson(`${url}/api/matter-knowledge-graph-artifacts?matter_knowledge_graph_status=complete&limit=1`);
  assert.equal(matterKnowledgeGraphArtifacts.collection, "matter_knowledge_graph_artifacts");
  assert.ok(matterKnowledgeGraphArtifacts.count <= 1);

  const matterKnowledgeNodes = await fetchJson(`${url}/api/matter-knowledge-nodes?knowledge_node_type=fact&limit=5`);
  assert.equal(matterKnowledgeNodes.collection, "matter_knowledge_nodes");
  assert.ok(matterKnowledgeNodes.count <= 5);

  const matterKnowledgeEdges = await fetchJson(`${url}/api/matter-knowledge-edges?knowledge_edge_type=fact_supported_by_evidence&limit=5`);
  assert.equal(matterKnowledgeEdges.collection, "matter_knowledge_edges");
  assert.ok(matterKnowledgeEdges.count <= 5);

  const matterKnowledgeSummaries = await fetchJson(`${url}/api/matter-knowledge-summaries?matter_knowledge_status=complete&limit=5`);
  assert.equal(matterKnowledgeSummaries.collection, "matter_knowledge_summaries");
  assert.ok(matterKnowledgeSummaries.count <= 5);

  const matterKnowledgeGraphBoundary = await fetchJson(`${url}/api/matter-knowledge-graph-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterKnowledgeGraphBoundary.collection, "matter_knowledge_graph_boundary");
  assert.ok(matterKnowledgeGraphBoundary.count <= 1);

  const matterKnowledgeGraphValidations = await fetchJson(`${url}/api/matter-knowledge-graph-validations?status=passed&limit=5`);
  assert.equal(matterKnowledgeGraphValidations.collection, "matter_knowledge_graph_validations");
  assert.ok(matterKnowledgeGraphValidations.count <= 5);

  const matterPrivilegeClassifierArtifacts = await fetchJson(`${url}/api/matter-privilege-classifier-artifacts?matter_privilege_classifier_status=complete&limit=1`);
  assert.equal(matterPrivilegeClassifierArtifacts.collection, "matter_privilege_classifier_artifacts");
  assert.ok(matterPrivilegeClassifierArtifacts.count <= 1);

  const privilegeClassificationRecords = await fetchJson(`${url}/api/privilege-classification-records?privilege_flag=privileged_review_required&limit=5`);
  assert.equal(privilegeClassificationRecords.collection, "privilege_classification_records");
  assert.ok(privilegeClassificationRecords.count <= 5);

  const privilegeEvidenceFlags = await fetchJson(`${url}/api/privilege-evidence-flags?flag_type=work_product&limit=5`);
  assert.equal(privilegeEvidenceFlags.collection, "privilege_evidence_flags");
  assert.ok(privilegeEvidenceFlags.count <= 5);

  const matterPrivilegeSummaries = await fetchJson(`${url}/api/matter-privilege-summaries?matter_privilege_status=complete&limit=5`);
  assert.equal(matterPrivilegeSummaries.collection, "matter_privilege_summaries");
  assert.ok(matterPrivilegeSummaries.count <= 5);

  const matterPrivilegeClassifierBoundary = await fetchJson(`${url}/api/matter-privilege-classifier-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterPrivilegeClassifierBoundary.collection, "matter_privilege_classifier_boundary");
  assert.ok(matterPrivilegeClassifierBoundary.count <= 1);

  const matterPrivilegeClassifierValidations = await fetchJson(`${url}/api/matter-privilege-classifier-validations?status=passed&limit=5`);
  assert.equal(matterPrivilegeClassifierValidations.collection, "matter_privilege_classifier_validations");
  assert.ok(matterPrivilegeClassifierValidations.count <= 5);

  const matterPersonalDataDetectorArtifacts = await fetchJson(`${url}/api/matter-personal-data-detector-artifacts?matter_personal_data_detector_status=complete&limit=1`);
  assert.equal(matterPersonalDataDetectorArtifacts.collection, "matter_personal_data_detector_artifacts");
  assert.ok(matterPersonalDataDetectorArtifacts.count <= 1);

  const personalDataDetectionRecords = await fetchJson(`${url}/api/personal-data-detection-records?personal_data_flag=sensitive_personal_data_review_required&limit=5`);
  assert.equal(personalDataDetectionRecords.collection, "personal_data_detection_records");
  assert.ok(personalDataDetectionRecords.count <= 5);

  const personalDataPolicyLinks = await fetchJson(`${url}/api/personal-data-policy-links?policy_binding_status=bound&limit=5`);
  assert.equal(personalDataPolicyLinks.collection, "personal_data_policy_links");
  assert.ok(personalDataPolicyLinks.count <= 5);

  const personalDataQuarantineLinks = await fetchJson(`${url}/api/personal-data-quarantine-links?quarantine_binding_status=bound&quarantine_applied=false&limit=5`);
  assert.equal(personalDataQuarantineLinks.collection, "personal_data_quarantine_links");
  assert.ok(personalDataQuarantineLinks.count <= 5);

  const matterPersonalDataSummaries = await fetchJson(`${url}/api/matter-personal-data-summaries?matter_personal_data_status=complete&limit=5`);
  assert.equal(matterPersonalDataSummaries.collection, "matter_personal_data_summaries");
  assert.ok(matterPersonalDataSummaries.count <= 5);

  const matterPersonalDataDetectorBoundary = await fetchJson(`${url}/api/matter-personal-data-detector-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(matterPersonalDataDetectorBoundary.collection, "matter_personal_data_detector_boundary");
  assert.ok(matterPersonalDataDetectorBoundary.count <= 1);

  const matterPersonalDataDetectorValidations = await fetchJson(`${url}/api/matter-personal-data-detector-validations?status=passed&limit=5`);
  assert.equal(matterPersonalDataDetectorValidations.collection, "matter_personal_data_detector_validations");
  assert.ok(matterPersonalDataDetectorValidations.count <= 5);

  const legalCitationVerifierArtifacts = await fetchJson(`${url}/api/legal-citation-verifier-artifacts?legal_citation_verifier_status=complete&limit=1`);
  assert.equal(legalCitationVerifierArtifacts.collection, "legal_citation_verifier_artifacts");
  assert.ok(legalCitationVerifierArtifacts.count <= 1);

  const legalCitationVerificationRecords = await fetchJson(`${url}/api/legal-citation-verification-records?currentness_check_status=currentness_review_required&limit=5`);
  assert.equal(legalCitationVerificationRecords.collection, "legal_citation_verification_records");
  assert.ok(legalCitationVerificationRecords.count <= 5);

  const legalCitationSourceChecks = await fetchJson(`${url}/api/legal-citation-source-checks?source_check_status=source_bound_pending_attorney_review&source_bound=true&limit=5`);
  assert.equal(legalCitationSourceChecks.collection, "legal_citation_source_checks");
  assert.ok(legalCitationSourceChecks.count <= 5);

  const legalCitationCurrentnessChecks = await fetchJson(`${url}/api/legal-citation-currentness-checks?currentness_verified=false&attorney_currentness_review_required=true&limit=5`);
  assert.equal(legalCitationCurrentnessChecks.collection, "legal_citation_currentness_checks");
  assert.ok(legalCitationCurrentnessChecks.count <= 5);

  const legalCitationMatterSummaries = await fetchJson(`${url}/api/legal-citation-matter-summaries?legal_citation_matter_status=complete&limit=5`);
  assert.equal(legalCitationMatterSummaries.collection, "legal_citation_matter_summaries");
  assert.ok(legalCitationMatterSummaries.count <= 5);

  const legalCitationVerifierBoundary = await fetchJson(`${url}/api/legal-citation-verifier-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(legalCitationVerifierBoundary.collection, "legal_citation_verifier_boundary");
  assert.ok(legalCitationVerifierBoundary.count <= 1);

  const legalCitationVerifierValidations = await fetchJson(`${url}/api/legal-citation-verifier-validations?status=passed&limit=5`);
  assert.equal(legalCitationVerifierValidations.collection, "legal_citation_verifier_validations");
  assert.ok(legalCitationVerifierValidations.count <= 5);

  const lddVdrInventoryArtifacts = await fetchJson(`${url}/api/ldd-vdr-inventory-artifacts?ldd_vdr_inventory_status=complete&limit=1`);
  assert.equal(lddVdrInventoryArtifacts.collection, "ldd_vdr_inventory_artifacts");
  assert.ok(lddVdrInventoryArtifacts.count <= 1);

  const lddVdrBatches = await fetchJson(`${url}/api/ldd-vdr-batches?batch_status=inventory_attention_required&limit=5`);
  assert.equal(lddVdrBatches.collection, "ldd_vdr_batches");
  assert.ok(lddVdrBatches.count <= 5);

  const lddVdrFolders = await fetchJson(`${url}/api/ldd-vdr-folders?folder_status=attention_required&limit=5`);
  assert.equal(lddVdrFolders.collection, "ldd_vdr_folders");
  assert.ok(lddVdrFolders.count <= 5);

  const lddVdrFiles = await fetchJson(`${url}/api/ldd-vdr-files?inventory_file_status=ready_for_attorney_review&limit=5`);
  assert.equal(lddVdrFiles.collection, "ldd_vdr_files");
  assert.ok(lddVdrFiles.count <= 5);

  const lddVdrVersions = await fetchJson(`${url}/api/ldd-vdr-versions?version_status=current&resource_version_ledger_bound=true&limit=5`);
  assert.equal(lddVdrVersions.collection, "ldd_vdr_versions");
  assert.ok(lddVdrVersions.count <= 5);

  const lddVdrMissingData = await fetchJson(`${url}/api/ldd-vdr-missing-data?missing_data_status=follow_up_required&rfi_candidate=true&limit=5`);
  assert.equal(lddVdrMissingData.collection, "ldd_vdr_missing_data");
  assert.ok(lddVdrMissingData.count <= 5);

  const lddVdrMatterSummaries = await fetchJson(`${url}/api/ldd-vdr-matter-summaries?ldd_vdr_matter_status=attention_required&limit=5`);
  assert.equal(lddVdrMatterSummaries.collection, "ldd_vdr_matter_summaries");
  assert.ok(lddVdrMatterSummaries.count <= 5);

  const lddVdrInventoryBoundary = await fetchJson(`${url}/api/ldd-vdr-inventory-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddVdrInventoryBoundary.collection, "ldd_vdr_inventory_boundary");
  assert.ok(lddVdrInventoryBoundary.count <= 1);

  const lddVdrInventoryValidations = await fetchJson(`${url}/api/ldd-vdr-inventory-validations?status=passed&limit=5`);
  assert.equal(lddVdrInventoryValidations.collection, "ldd_vdr_inventory_validations");
  assert.ok(lddVdrInventoryValidations.count <= 5);

  const lddDocumentClassificationArtifacts = await fetchJson(`${url}/api/ldd-document-classification-artifacts?ldd_document_classification_status=complete&limit=1`);
  assert.equal(lddDocumentClassificationArtifacts.collection, "ldd_document_classification_artifacts");
  assert.ok(lddDocumentClassificationArtifacts.count <= 1);

  const lddDocumentClassificationRules = await fetchJson(`${url}/api/ldd-document-classification-rules?document_class=contract&limit=5`);
  assert.equal(lddDocumentClassificationRules.collection, "ldd_document_classification_rules");
  assert.ok(lddDocumentClassificationRules.count <= 5);

  const lddDocumentClassificationRecords = await fetchJson(`${url}/api/ldd-document-classification-records?classification_status=classified_pending_attorney_review&source_row_kind=missing_data&limit=5`);
  assert.equal(lddDocumentClassificationRecords.collection, "ldd_document_classification_records");
  assert.ok(lddDocumentClassificationRecords.count <= 5);

  const lddDocumentClassSummaries = await fetchJson(`${url}/api/ldd-document-class-summaries?document_class=tax&limit=5`);
  assert.equal(lddDocumentClassSummaries.collection, "ldd_document_class_summaries");
  assert.ok(lddDocumentClassSummaries.count <= 5);

  const lddDocumentMatterClassSummaries = await fetchJson(`${url}/api/ldd-document-matter-class-summaries?ldd_document_matter_classification_status=classified_pending_attorney_review&limit=5`);
  assert.equal(lddDocumentMatterClassSummaries.collection, "ldd_document_matter_class_summaries");
  assert.ok(lddDocumentMatterClassSummaries.count <= 5);

  const lddDocumentClassificationBoundary = await fetchJson(`${url}/api/ldd-document-classification-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddDocumentClassificationBoundary.collection, "ldd_document_classification_boundary");
  assert.ok(lddDocumentClassificationBoundary.count <= 1);

  const lddDocumentClassificationValidations = await fetchJson(`${url}/api/ldd-document-classification-validations?status=passed&limit=5`);
  assert.equal(lddDocumentClassificationValidations.collection, "ldd_document_classification_validations");
  assert.ok(lddDocumentClassificationValidations.count <= 5);

  const lddExtractorSelectionArtifacts = await fetchJson(`${url}/api/ldd-extractor-selection-artifacts?ldd_extractor_selection_status=complete&limit=1`);
  assert.equal(lddExtractorSelectionArtifacts.collection, "ldd_extractor_selection_artifacts");
  assert.ok(lddExtractorSelectionArtifacts.count <= 1);

  const lddExtractorRegistry = await fetchJson(`${url}/api/ldd-extractor-registry?document_class=contract&limit=5`);
  assert.equal(lddExtractorRegistry.collection, "ldd_extractor_registry");
  assert.ok(lddExtractorRegistry.count <= 5);

  const lddExtractorSelectionRecords = await fetchJson(`${url}/api/ldd-extractor-selection-records?selection_status=selected_pending_attorney_review&extractor_execution_performed=false&limit=5`);
  assert.equal(lddExtractorSelectionRecords.collection, "ldd_extractor_selection_records");
  assert.ok(lddExtractorSelectionRecords.count <= 5);

  const lddExtractorSelectionRationales = await fetchJson(`${url}/api/ldd-extractor-selection-rationales?rationale_status=document_class_rule_match&limit=5`);
  assert.equal(lddExtractorSelectionRationales.collection, "ldd_extractor_selection_rationales");
  assert.ok(lddExtractorSelectionRationales.count <= 5);

  const lddExtractorMatterSummaries = await fetchJson(`${url}/api/ldd-extractor-matter-summaries?ldd_extractor_matter_status=selected_pending_attorney_review&limit=5`);
  assert.equal(lddExtractorMatterSummaries.collection, "ldd_extractor_matter_summaries");
  assert.ok(lddExtractorMatterSummaries.count <= 5);

  const lddExtractorSelectionBoundary = await fetchJson(`${url}/api/ldd-extractor-selection-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddExtractorSelectionBoundary.collection, "ldd_extractor_selection_boundary");
  assert.ok(lddExtractorSelectionBoundary.count <= 1);

  const lddExtractorSelectionValidations = await fetchJson(`${url}/api/ldd-extractor-selection-validations?status=passed&limit=5`);
  assert.equal(lddExtractorSelectionValidations.collection, "ldd_extractor_selection_validations");
  assert.ok(lddExtractorSelectionValidations.count <= 5);

  const lddFactExtractionArtifacts = await fetchJson(`${url}/api/ldd-fact-extraction-artifacts?ldd_fact_extraction_status=complete&limit=1`);
  assert.equal(lddFactExtractionArtifacts.collection, "ldd_fact_extraction_artifacts");
  assert.ok(lddFactExtractionArtifacts.count <= 1);

  const lddFactExtractionRules = await fetchJson(`${url}/api/ldd-fact-extraction-rules?fact_type=party&limit=5`);
  assert.equal(lddFactExtractionRules.collection, "ldd_fact_extraction_rules");
  assert.ok(lddFactExtractionRules.count <= 5);

  const lddFactRecords = await fetchJson(`${url}/api/ldd-fact-records?fact_type=obligation&fact_status=candidate_extracted_pending_attorney_review&limit=5`);
  assert.equal(lddFactRecords.collection, "ldd_fact_records");
  assert.ok(lddFactRecords.count <= 5);

  const lddFactSourceGaps = await fetchJson(`${url}/api/ldd-fact-records?fact_type=termination&source_gap=true&limit=5`);
  assert.equal(lddFactSourceGaps.collection, "ldd_fact_records");
  assert.ok(lddFactSourceGaps.count <= 5);

  const lddFactSourceBindings = await fetchJson(`${url}/api/ldd-fact-source-bindings?binding_status=bound_to_source_metadata&limit=5`);
  assert.equal(lddFactSourceBindings.collection, "ldd_fact_source_bindings");
  assert.ok(lddFactSourceBindings.count <= 5);

  const lddFactTypeSummaries = await fetchJson(`${url}/api/ldd-fact-type-summaries?fact_type=party&limit=5`);
  assert.equal(lddFactTypeSummaries.collection, "ldd_fact_type_summaries");
  assert.ok(lddFactTypeSummaries.count <= 5);

  const lddFactMatterSummaries = await fetchJson(`${url}/api/ldd-fact-matter-summaries?ldd_fact_matter_status=complete_pending_attorney_review&limit=5`);
  assert.equal(lddFactMatterSummaries.collection, "ldd_fact_matter_summaries");
  assert.ok(lddFactMatterSummaries.count <= 5);

  const lddFactExtractionBoundary = await fetchJson(`${url}/api/ldd-fact-extraction-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddFactExtractionBoundary.collection, "ldd_fact_extraction_boundary");
  assert.ok(lddFactExtractionBoundary.count <= 1);

  const lddFactExtractionValidations = await fetchJson(`${url}/api/ldd-fact-extraction-validations?status=passed&limit=5`);
  assert.equal(lddFactExtractionValidations.collection, "ldd_fact_extraction_validations");
  assert.ok(lddFactExtractionValidations.count <= 5);

  const lddIssueDetectionArtifacts = await fetchJson(`${url}/api/ldd-issue-detection-artifacts?ldd_issue_detection_status=complete&limit=1`);
  assert.equal(lddIssueDetectionArtifacts.collection, "ldd_issue_detection_artifacts");
  assert.ok(lddIssueDetectionArtifacts.count <= 1);

  const lddIssueDetectionRules = await fetchJson(`${url}/api/ldd-issue-detection-rules?issue_type=tax_exposure&limit=5`);
  assert.equal(lddIssueDetectionRules.collection, "ldd_issue_detection_rules");
  assert.ok(lddIssueDetectionRules.count <= 5);

  const lddIssueRecords = await fetchJson(`${url}/api/ldd-issue-records?issue_flag=red&issue_severity=high&limit=5`);
  assert.equal(lddIssueRecords.collection, "ldd_issue_records");
  assert.ok(lddIssueRecords.count <= 5);

  const lddIssueSourceGaps = await fetchJson(`${url}/api/ldd-issue-records?issue_type=source_gap&source_gap=true&limit=5`);
  assert.equal(lddIssueSourceGaps.collection, "ldd_issue_records");
  assert.ok(lddIssueSourceGaps.count <= 5);

  const lddIssueFollowUps = await fetchJson(`${url}/api/ldd-issue-follow-ups?follow_up_status=open_pending_attorney_review&limit=5`);
  assert.equal(lddIssueFollowUps.collection, "ldd_issue_follow_ups");
  assert.ok(lddIssueFollowUps.count <= 5);

  const lddIssueSeveritySummaries = await fetchJson(`${url}/api/ldd-issue-severity-summaries?issue_severity=high&limit=5`);
  assert.equal(lddIssueSeveritySummaries.collection, "ldd_issue_severity_summaries");
  assert.ok(lddIssueSeveritySummaries.count <= 5);

  const lddIssueMatterSummaries = await fetchJson(`${url}/api/ldd-issue-matter-summaries?ldd_issue_matter_status=issues_detected_pending_attorney_review&limit=5`);
  assert.equal(lddIssueMatterSummaries.collection, "ldd_issue_matter_summaries");
  assert.ok(lddIssueMatterSummaries.count <= 5);

  const lddIssueDetectionBoundary = await fetchJson(`${url}/api/ldd-issue-detection-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddIssueDetectionBoundary.collection, "ldd_issue_detection_boundary");
  assert.ok(lddIssueDetectionBoundary.count <= 1);

  const lddIssueDetectionValidations = await fetchJson(`${url}/api/ldd-issue-detection-validations?status=passed&limit=5`);
  assert.equal(lddIssueDetectionValidations.collection, "ldd_issue_detection_validations");
  assert.ok(lddIssueDetectionValidations.count <= 5);

  const lddRfiGeneratorArtifacts = await fetchJson(`${url}/api/ldd-rfi-generator-artifacts?ldd_rfi_generator_status=complete&limit=1`);
  assert.equal(lddRfiGeneratorArtifacts.collection, "ldd_rfi_generator_artifacts");
  assert.ok(lddRfiGeneratorArtifacts.count <= 1);

  const lddRfiRules = await fetchJson(`${url}/api/ldd-rfi-rules?rfi_rule_type=missing_material_request&limit=5`);
  assert.equal(lddRfiRules.collection, "ldd_rfi_rules");
  assert.ok(lddRfiRules.count <= 5);

  const lddRfiDrafts = await fetchJson(`${url}/api/ldd-rfi-drafts?rfi_draft_status=internal_attorney_review_required&limit=5`);
  assert.equal(lddRfiDrafts.collection, "ldd_rfi_drafts");
  assert.ok(lddRfiDrafts.count <= 5);

  const lddRfiQuestions = await fetchJson(`${url}/api/ldd-rfi-questions?rfi_question_priority=high&rfi_question_status=draft_pending_attorney_review&limit=5`);
  assert.equal(lddRfiQuestions.collection, "ldd_rfi_questions");
  assert.ok(lddRfiQuestions.count <= 5);

  const lddRfiMissingMaterialLinks = await fetchJson(`${url}/api/ldd-rfi-missing-material-links?rfi_missing_material_status=linked_pending_attorney_review&limit=5`);
  assert.equal(lddRfiMissingMaterialLinks.collection, "ldd_rfi_missing_material_links");
  assert.ok(lddRfiMissingMaterialLinks.count <= 5);

  const lddRfiIssueLinks = await fetchJson(`${url}/api/ldd-rfi-issue-links?rfi_issue_link_status=linked_pending_attorney_review&limit=5`);
  assert.equal(lddRfiIssueLinks.collection, "ldd_rfi_issue_links");
  assert.ok(lddRfiIssueLinks.count <= 5);

  const lddRfiMatterSummaries = await fetchJson(`${url}/api/ldd-rfi-matter-summaries?ldd_rfi_matter_status=draft_questions_pending_attorney_review&limit=5`);
  assert.equal(lddRfiMatterSummaries.collection, "ldd_rfi_matter_summaries");
  assert.ok(lddRfiMatterSummaries.count <= 5);

  const lddRfiGeneratorBoundary = await fetchJson(`${url}/api/ldd-rfi-generator-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddRfiGeneratorBoundary.collection, "ldd_rfi_generator_boundary");
  assert.ok(lddRfiGeneratorBoundary.count <= 1);

  const lddRfiGeneratorValidations = await fetchJson(`${url}/api/ldd-rfi-generator-validations?status=passed&limit=5`);
  assert.equal(lddRfiGeneratorValidations.collection, "ldd_rfi_generator_validations");
  assert.ok(lddRfiGeneratorValidations.count <= 5);

  const lddReportDraftArtifacts = await fetchJson(`${url}/api/ldd-report-draft-artifacts?ldd_report_draft_status=complete&limit=1`);
  assert.equal(lddReportDraftArtifacts.collection, "ldd_report_draft_artifacts");
  assert.ok(lddReportDraftArtifacts.count <= 1);

  const lddReportSectionRules = await fetchJson(`${url}/api/ldd-report-section-rules?section_type=executive_summary&limit=5`);
  assert.equal(lddReportSectionRules.collection, "ldd_report_section_rules");
  assert.ok(lddReportSectionRules.count <= 5);

  const lddReportSections = await fetchJson(`${url}/api/ldd-report-sections?section_status=draft_pending_attorney_review&limit=5`);
  assert.equal(lddReportSections.collection, "ldd_report_sections");
  assert.ok(lddReportSections.count <= 5);

  const lddReportParagraphs = await fetchJson(`${url}/api/ldd-report-paragraphs?paragraph_status=draft_pending_attorney_review&limit=5`);
  assert.equal(lddReportParagraphs.collection, "ldd_report_paragraphs");
  assert.ok(lddReportParagraphs.count <= 5);

  const lddReportCitationPlaceholders = await fetchJson(`${url}/api/ldd-report-citation-placeholders?citation_placeholder_status=placeholder_pending_attorney_review&currentness_check_status=currentness_review_required&limit=5`);
  assert.equal(lddReportCitationPlaceholders.collection, "ldd_report_citation_placeholders");
  assert.ok(lddReportCitationPlaceholders.count <= 5);

  const lddReportIssueLinks = await fetchJson(`${url}/api/ldd-report-issue-links?report_issue_link_status=linked_pending_attorney_review&limit=5`);
  assert.equal(lddReportIssueLinks.collection, "ldd_report_issue_links");
  assert.ok(lddReportIssueLinks.count <= 5);

  const lddReportMatterSummaries = await fetchJson(`${url}/api/ldd-report-matter-summaries?ldd_report_matter_status=draft_report_pending_attorney_review&limit=5`);
  assert.equal(lddReportMatterSummaries.collection, "ldd_report_matter_summaries");
  assert.ok(lddReportMatterSummaries.count <= 5);

  const lddReportDraftBoundary = await fetchJson(`${url}/api/ldd-report-draft-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lddReportDraftBoundary.collection, "ldd_report_draft_boundary");
  assert.ok(lddReportDraftBoundary.count <= 1);

  const lddReportDraftValidations = await fetchJson(`${url}/api/ldd-report-draft-validations?status=passed&limit=5`);
  assert.equal(lddReportDraftValidations.collection, "ldd_report_draft_validations");
  assert.ok(lddReportDraftValidations.count <= 5);

  const litigationBriefDraftArtifacts = await fetchJson(`${url}/api/litigation-brief-draft-artifacts?litigation_brief_draft_status=complete&limit=1`);
  assert.equal(litigationBriefDraftArtifacts.collection, "litigation_brief_draft_artifacts");
  assert.ok(litigationBriefDraftArtifacts.count <= 1);

  const litigationBriefRules = await fetchJson(`${url}/api/litigation-brief-rules?brief_rule_type=claim_scaffold&limit=5`);
  assert.equal(litigationBriefRules.collection, "litigation_brief_rules");
  assert.ok(litigationBriefRules.count <= 5);

  const litigationBriefDrafts = await fetchJson(`${url}/api/litigation-brief-drafts?brief_draft_status=draft_pending_attorney_review&court_filing_ready=false&limit=5`);
  assert.equal(litigationBriefDrafts.collection, "litigation_brief_drafts");
  assert.ok(litigationBriefDrafts.count <= 5);

  const litigationBriefClaims = await fetchJson(`${url}/api/litigation-brief-claims?brief_claim_status=draft_pending_attorney_review&limit=5`);
  assert.equal(litigationBriefClaims.collection, "litigation_brief_claims");
  assert.ok(litigationBriefClaims.count <= 5);

  const litigationBriefFacts = await fetchJson(`${url}/api/litigation-brief-facts?brief_fact_status=draft_pending_attorney_review&limit=5`);
  assert.equal(litigationBriefFacts.collection, "litigation_brief_facts");
  assert.ok(litigationBriefFacts.count <= 5);

  const litigationBriefEvidenceLinks = await fetchJson(`${url}/api/litigation-brief-evidence-links?brief_evidence_link_status=linked_pending_attorney_review&limit=10`);
  assert.equal(litigationBriefEvidenceLinks.collection, "litigation_brief_evidence_links");
  assert.ok(litigationBriefEvidenceLinks.count <= 10);

  const litigationBriefLegalBasisPlaceholders = await fetchJson(`${url}/api/litigation-brief-legal-basis-placeholders?legal_basis_status=placeholder_pending_attorney_review&currentness_check_status=currentness_review_required&limit=5`);
  assert.equal(litigationBriefLegalBasisPlaceholders.collection, "litigation_brief_legal_basis_placeholders");
  assert.ok(litigationBriefLegalBasisPlaceholders.count <= 5);

  const litigationBriefCitationGates = await fetchJson(`${url}/api/litigation-brief-citation-gates?citation_gate_status=passed_pending_currentness_review&citation_gate_passed=true&limit=5`);
  assert.equal(litigationBriefCitationGates.collection, "litigation_brief_citation_gate_results");
  assert.ok(litigationBriefCitationGates.count <= 5);

  const litigationBriefMatterSummaries = await fetchJson(`${url}/api/litigation-brief-matter-summaries?litigation_brief_matter_status=draft_pending_attorney_review&limit=5`);
  assert.equal(litigationBriefMatterSummaries.collection, "litigation_brief_matter_summaries");
  assert.ok(litigationBriefMatterSummaries.count <= 5);

  const litigationBriefDraftBoundary = await fetchJson(`${url}/api/litigation-brief-draft-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(litigationBriefDraftBoundary.collection, "litigation_brief_draft_boundary");
  assert.ok(litigationBriefDraftBoundary.count <= 1);

  const litigationBriefDraftValidations = await fetchJson(`${url}/api/litigation-brief-draft-validations?status=passed&limit=5`);
  assert.equal(litigationBriefDraftValidations.collection, "litigation_brief_draft_validations");
  assert.ok(litigationBriefDraftValidations.count <= 5);

  const meetingMinutesWorkflowArtifacts = await fetchJson(`${url}/api/meeting-minutes-workflow-artifacts?meeting_minutes_workflow_status=complete&limit=1`);
  assert.equal(meetingMinutesWorkflowArtifacts.collection, "meeting_minutes_workflow_artifacts");
  assert.ok(meetingMinutesWorkflowArtifacts.count <= 1);

  const meetingMinutesRules = await fetchJson(`${url}/api/meeting-minutes-rules?meeting_minutes_rule_type=agenda_extraction&limit=5`);
  assert.equal(meetingMinutesRules.collection, "meeting_minutes_rules");
  assert.ok(meetingMinutesRules.count <= 5);

  const meetingMinutesSources = await fetchJson(`${url}/api/meeting-minutes-sources?meeting_minutes_source_status=source_loaded_pending_attorney_review&limit=5`);
  assert.equal(meetingMinutesSources.collection, "meeting_minutes_sources");
  assert.ok(meetingMinutesSources.count <= 5);

  const meetingMinutesAgendaItems = await fetchJson(`${url}/api/meeting-minutes-agenda-items?agenda_status=draft_pending_attorney_review&limit=5`);
  assert.equal(meetingMinutesAgendaItems.collection, "meeting_minutes_agenda_items");
  assert.ok(meetingMinutesAgendaItems.count <= 5);

  const meetingMinutesDecisions = await fetchJson(`${url}/api/meeting-minutes-decisions?decision_status=draft_pending_attorney_review&limit=5`);
  assert.equal(meetingMinutesDecisions.collection, "meeting_minutes_decisions");
  assert.ok(meetingMinutesDecisions.count <= 5);

  const meetingMinutesActionItems = await fetchJson(`${url}/api/meeting-minutes-action-items?action_status=draft_pending_attorney_review&evidence_required=true&limit=10`);
  assert.equal(meetingMinutesActionItems.collection, "meeting_minutes_action_items");
  assert.ok(meetingMinutesActionItems.count <= 10);

  const meetingMinutesEvidenceLinks = await fetchJson(`${url}/api/meeting-minutes-evidence-links?evidence_link_status=linked_pending_attorney_review&limit=10`);
  assert.equal(meetingMinutesEvidenceLinks.collection, "meeting_minutes_evidence_links");
  assert.ok(meetingMinutesEvidenceLinks.count <= 10);

  const meetingMinutesMatterSummaries = await fetchJson(`${url}/api/meeting-minutes-matter-summaries?meeting_minutes_matter_status=draft_pending_attorney_review&limit=5`);
  assert.equal(meetingMinutesMatterSummaries.collection, "meeting_minutes_matter_summaries");
  assert.ok(meetingMinutesMatterSummaries.count <= 5);

  const meetingMinutesWorkflowBoundary = await fetchJson(`${url}/api/meeting-minutes-workflow-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(meetingMinutesWorkflowBoundary.collection, "meeting_minutes_workflow_boundary");
  assert.ok(meetingMinutesWorkflowBoundary.count <= 1);

  const meetingMinutesWorkflowValidations = await fetchJson(`${url}/api/meeting-minutes-workflow-validations?status=passed&limit=5`);
  assert.equal(meetingMinutesWorkflowValidations.collection, "meeting_minutes_workflow_validations");
  assert.ok(meetingMinutesWorkflowValidations.count <= 5);

  const contractDraftWorkflowArtifacts = await fetchJson(`${url}/api/contract-draft-workflow-artifacts?contract_draft_workflow_status=complete&limit=1`);
  assert.equal(contractDraftWorkflowArtifacts.collection, "contract_draft_workflow_artifacts");
  assert.ok(contractDraftWorkflowArtifacts.count <= 1);

  const contractDraftRules = await fetchJson(`${url}/api/contract-draft-rules?contract_draft_rule_type=clause_draft_scaffold&limit=5`);
  assert.equal(contractDraftRules.collection, "contract_draft_rules");
  assert.ok(contractDraftRules.count <= 5);

  const contractDraftPackets = await fetchJson(`${url}/api/contract-draft-packets?draft_packet_status=draft_pending_attorney_review&limit=5`);
  assert.equal(contractDraftPackets.collection, "contract_draft_packets");
  assert.ok(contractDraftPackets.count <= 5);

  const contractClauseDrafts = await fetchJson(`${url}/api/contract-clause-drafts?clause_draft_status=draft_pending_attorney_review&deterministic_contract_draft_generation_performed=true&limit=5`);
  assert.equal(contractClauseDrafts.collection, "contract_clause_drafts");
  assert.ok(contractClauseDrafts.count <= 5);

  const contractClientPositions = await fetchJson(`${url}/api/contract-client-positions?client_position_status=captured_pending_attorney_review&limit=5`);
  assert.equal(contractClientPositions.collection, "contract_client_positions");
  assert.ok(contractClientPositions.count <= 5);

  const contractConsistencyChecks = await fetchJson(`${url}/api/contract-clause-consistency-checks?consistency_check_status=passed_pending_attorney_review&clause_consistency_passed=true&limit=5`);
  assert.equal(contractConsistencyChecks.collection, "contract_clause_consistency_checks");
  assert.ok(contractConsistencyChecks.count <= 5);

  const contractAttorneyReviewGates = await fetchJson(`${url}/api/contract-attorney-review-gates?review_gate_status=pending_attorney_review&contract_delivery_ready=false&limit=5`);
  assert.equal(contractAttorneyReviewGates.collection, "contract_attorney_review_gates");
  assert.ok(contractAttorneyReviewGates.count <= 5);

  const contractDraftIssueLinks = await fetchJson(`${url}/api/contract-draft-issue-links?contract_issue_link_status=linked_pending_attorney_review&limit=5`);
  assert.equal(contractDraftIssueLinks.collection, "contract_draft_issue_links");
  assert.ok(contractDraftIssueLinks.count <= 5);

  const contractDraftMatterSummaries = await fetchJson(`${url}/api/contract-draft-matter-summaries?contract_draft_matter_status=draft_pending_attorney_review&contract_delivery_ready=false&limit=5`);
  assert.equal(contractDraftMatterSummaries.collection, "contract_draft_matter_summaries");
  assert.ok(contractDraftMatterSummaries.count <= 5);

  const contractDraftWorkflowBoundary = await fetchJson(`${url}/api/contract-draft-workflow-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(contractDraftWorkflowBoundary.collection, "contract_draft_workflow_boundary");
  assert.ok(contractDraftWorkflowBoundary.count <= 1);

  const contractDraftWorkflowValidations = await fetchJson(`${url}/api/contract-draft-workflow-validations?status=passed&limit=5`);
  assert.equal(contractDraftWorkflowValidations.collection, "contract_draft_workflow_validations");
  assert.ok(contractDraftWorkflowValidations.count <= 5);

  const providedMaterialReviewArtifacts = await fetchJson(`${url}/api/provided-material-review-artifacts?provided_material_review_status=complete&limit=1`);
  assert.equal(providedMaterialReviewArtifacts.collection, "provided_material_review_artifacts");
  assert.ok(providedMaterialReviewArtifacts.count <= 1);

  const providedMaterialReviewRules = await fetchJson(`${url}/api/provided-material-review-rules?provided_material_review_rule_type=index_status_binding&limit=5`);
  assert.equal(providedMaterialReviewRules.collection, "provided_material_review_rules");
  assert.ok(providedMaterialReviewRules.count <= 5);

  const providedMaterialReviewItems = await fetchJson(`${url}/api/provided-material-review-items?material_review_status=gap_pending_follow_up_review&final_review_decision_recorded=false&limit=5`);
  assert.equal(providedMaterialReviewItems.collection, "provided_material_review_items");
  assert.ok(providedMaterialReviewItems.count <= 5);

  const providedMaterialIndexStatuses = await fetchJson(`${url}/api/provided-material-index-statuses?index_binding_status=indexed_in_matter_document_index&limit=5`);
  assert.equal(providedMaterialIndexStatuses.collection, "provided_material_index_statuses");
  assert.ok(providedMaterialIndexStatuses.count <= 5);

  const providedMaterialGapLinks = await fetchJson(`${url}/api/provided-material-gap-links?gap_link_status=follow_up_required_pending_attorney_review&absence_not_factual_nonexistence=true&limit=5`);
  assert.equal(providedMaterialGapLinks.collection, "provided_material_gap_links");
  assert.ok(providedMaterialGapLinks.count <= 5);

  const providedMaterialReviewGates = await fetchJson(`${url}/api/provided-material-review-gates?review_gate_status=pending_attorney_review&final_review_decision_recorded=false&limit=5`);
  assert.equal(providedMaterialReviewGates.collection, "provided_material_review_gates");
  assert.ok(providedMaterialReviewGates.count <= 5);

  const providedMaterialMatterSummaries = await fetchJson(`${url}/api/provided-material-matter-summaries?provided_material_matter_status=pending_attorney_review&final_review_decision_recorded=false&limit=5`);
  assert.equal(providedMaterialMatterSummaries.collection, "provided_material_matter_summaries");
  assert.ok(providedMaterialMatterSummaries.count <= 5);

  const providedMaterialReviewBoundary = await fetchJson(`${url}/api/provided-material-review-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(providedMaterialReviewBoundary.collection, "provided_material_review_boundary");
  assert.ok(providedMaterialReviewBoundary.count <= 1);

  const providedMaterialReviewValidations = await fetchJson(`${url}/api/provided-material-review-validations?status=passed&limit=5`);
  assert.equal(providedMaterialReviewValidations.collection, "provided_material_review_validations");
  assert.ok(providedMaterialReviewValidations.count <= 5);

  const legalApprovalMatrixArtifacts = await fetchJson(`${url}/api/legal-approval-matrix-artifacts?legal_approval_matrix_status=complete&limit=1`);
  assert.equal(legalApprovalMatrixArtifacts.collection, "legal_approval_matrix_artifacts");
  assert.ok(legalApprovalMatrixArtifacts.count <= 1);

  const legalApprovalMatrixRules = await fetchJson(`${url}/api/legal-approval-matrix-rules?legal_approval_rule_type=partner_approval_required&limit=5`);
  assert.equal(legalApprovalMatrixRules.collection, "legal_approval_matrix_rules");
  assert.ok(legalApprovalMatrixRules.count <= 5);

  const legalApprovalOutputRows = await fetchJson(`${url}/api/legal-approval-output-rows?client_use_blocked_until_approval=true&partner_approval_required_before_client_use=true&limit=6`);
  assert.equal(legalApprovalOutputRows.collection, "legal_approval_output_rows");
  assert.ok(legalApprovalOutputRows.count <= 6);

  const legalApprovalRequirements = await fetchJson(`${url}/api/legal-approval-requirements?approval_requirement_type=partner_approval&approval_requirement_status=pending_required&limit=6`);
  assert.equal(legalApprovalRequirements.collection, "legal_approval_requirements");
  assert.ok(legalApprovalRequirements.count <= 6);

  const legalApprovalGateLinks = await fetchJson(`${url}/api/legal-approval-gate-links?gate_link_status=linked_pending_approval&limit=6`);
  assert.equal(legalApprovalGateLinks.collection, "legal_approval_gate_links");
  assert.ok(legalApprovalGateLinks.count <= 6);

  const legalApprovalMatterSummaries = await fetchJson(`${url}/api/legal-approval-matter-summaries?legal_approval_matter_status=pending_attorney_and_partner_approval&limit=5`);
  assert.equal(legalApprovalMatterSummaries.collection, "legal_approval_matter_summaries");
  assert.ok(legalApprovalMatterSummaries.count <= 5);

  const legalApprovalMatrixBoundary = await fetchJson(`${url}/api/legal-approval-matrix-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(legalApprovalMatrixBoundary.collection, "legal_approval_matrix_boundary");
  assert.ok(legalApprovalMatrixBoundary.count <= 1);

  const legalApprovalMatrixValidations = await fetchJson(`${url}/api/legal-approval-matrix-validations?status=passed&limit=5`);
  assert.equal(legalApprovalMatrixValidations.collection, "legal_approval_matrix_validations");
  assert.ok(legalApprovalMatrixValidations.count <= 5);

  const lawFirmE2eFreezes = await fetchJson(`${url}/api/law-firm-e2e-freezes?law_firm_e2e_freeze_status=complete&limit=1`);
  assert.equal(lawFirmE2eFreezes.collection, "law_firm_e2e_freezes");
  assert.ok(lawFirmE2eFreezes.count <= 1);

  const lawFirmE2eSources = await fetchJson(`${url}/api/law-firm-e2e-freeze-sources?law_firm_e2e_source_status=complete&limit=5`);
  assert.equal(lawFirmE2eSources.collection, "law_firm_e2e_freeze_sources");
  assert.ok(lawFirmE2eSources.count <= 5);

  const lawFirmE2ePaths = await fetchJson(`${url}/api/law-firm-e2e-paths?law_firm_e2e_path_status=passed&matter_gate_passed=true&evidence_gate_passed=true&citation_gate_passed=true&approval_gate_passed=true&limit=5`);
  assert.equal(lawFirmE2ePaths.collection, "law_firm_e2e_paths");
  assert.ok(lawFirmE2ePaths.count <= 5);

  const lawFirmE2eCoverageGates = await fetchJson(`${url}/api/law-firm-e2e-coverage-gates?law_firm_e2e_coverage_gate_status=passed&limit=5`);
  assert.equal(lawFirmE2eCoverageGates.collection, "law_firm_e2e_coverage_gates");
  assert.ok(lawFirmE2eCoverageGates.count <= 5);

  const lawFirmE2eCheckpoints = await fetchJson(`${url}/api/law-firm-e2e-freeze-checkpoints?law_firm_e2e_checkpoint_status=passed&limit=5`);
  assert.equal(lawFirmE2eCheckpoints.collection, "law_firm_e2e_freeze_checkpoints");
  assert.ok(lawFirmE2eCheckpoints.count <= 5);

  const lawFirmE2eBoundary = await fetchJson(`${url}/api/law-firm-e2e-freeze-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(lawFirmE2eBoundary.collection, "law_firm_e2e_freeze_boundary");
  assert.ok(lawFirmE2eBoundary.count <= 1);

  const lawFirmE2eValidations = await fetchJson(`${url}/api/law-firm-e2e-freeze-validations?status=passed&limit=5`);
  assert.equal(lawFirmE2eValidations.collection, "law_firm_e2e_freeze_validations");
  assert.ok(lawFirmE2eValidations.count <= 5);

  const repoProfileDetectors = await fetchJson(`${url}/api/repo-profile-detectors?repo_profile_detector_status=complete&limit=1`);
  assert.equal(repoProfileDetectors.collection, "repo_profile_detectors");
  assert.ok(repoProfileDetectors.count <= 1);

  const repoProfiles = await fetchJson(`${url}/api/repo-profiles?repo_profile_status=complete&limit=1`);
  assert.equal(repoProfiles.collection, "repo_profiles");
  assert.ok(repoProfiles.count <= 1);

  const repoProfileLanguages = await fetchJson(`${url}/api/repo-profile-languages?language_id=javascript&limit=5`);
  assert.equal(repoProfileLanguages.collection, "repo_profile_languages");
  assert.ok(repoProfileLanguages.count <= 5);

  const repoProfileFrameworks = await fetchJson(`${url}/api/repo-profile-frameworks?framework_status=detected&limit=5`);
  assert.equal(repoProfileFrameworks.collection, "repo_profile_frameworks");
  assert.ok(repoProfileFrameworks.count <= 5);

  const repoProfileCommands = await fetchJson(`${url}/api/repo-profile-commands?command_kind=test&command_status=detected&limit=5`);
  assert.equal(repoProfileCommands.collection, "repo_profile_commands");
  assert.ok(repoProfileCommands.count <= 5);

  const repoProfileSignals = await fetchJson(`${url}/api/repo-profile-signals?signal_status=detected&limit=5`);
  assert.equal(repoProfileSignals.collection, "repo_profile_signals");
  assert.ok(repoProfileSignals.count <= 5);

  const repoProfileDesktopBoundary = await fetchJson(`${url}/api/repo-profile-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(repoProfileDesktopBoundary.collection, "repo_profile_desktop_boundary");
  assert.ok(repoProfileDesktopBoundary.count <= 1);

  const repoProfileValidations = await fetchJson(`${url}/api/repo-profile-validations?status=passed&limit=5`);
  assert.equal(repoProfileValidations.collection, "repo_profile_validations");
  assert.ok(repoProfileValidations.count <= 5);

  const agentInstructionRegistries = await fetchJson(`${url}/api/agent-instruction-registries?agent_instruction_registry_status=complete&limit=1`);
  assert.equal(agentInstructionRegistries.collection, "agent_instruction_registries");
  assert.ok(agentInstructionRegistries.count <= 1);

  const agentInstructionSources = await fetchJson(`${url}/api/agent-instruction-sources?instruction_source_status=present&instruction_kind=agents&limit=5`);
  assert.equal(agentInstructionSources.collection, "agent_instruction_sources");
  assert.ok(agentInstructionSources.count <= 5);

  const agentInstructionVersions = await fetchJson(`${url}/api/agent-instruction-versions?version_status=locked&limit=5`);
  assert.equal(agentInstructionVersions.collection, "agent_instruction_versions");
  assert.ok(agentInstructionVersions.count <= 5);

  const runtimeInstructionBindings = await fetchJson(`${url}/api/runtime-instruction-bindings?runtime_instruction_binding_status=bound&runtime_kind=agent_runtime&limit=5`);
  assert.equal(runtimeInstructionBindings.collection, "runtime_instruction_bindings");
  assert.ok(runtimeInstructionBindings.count <= 5);

  const agentInstructionSections = await fetchJson(`${url}/api/agent-instruction-sections?section_status=tracked&limit=5`);
  assert.equal(agentInstructionSections.collection, "agent_instruction_sections");
  assert.ok(agentInstructionSections.count <= 5);

  const agentInstructionDesktopBoundary = await fetchJson(`${url}/api/agent-instruction-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(agentInstructionDesktopBoundary.collection, "agent_instruction_desktop_boundary");
  assert.ok(agentInstructionDesktopBoundary.count <= 1);

  const agentInstructionValidations = await fetchJson(`${url}/api/agent-instruction-validations?status=passed&limit=5`);
  assert.equal(agentInstructionValidations.collection, "agent_instruction_validations");
  assert.ok(agentInstructionValidations.count <= 5);

  const issueIntakeAdapters = await fetchJson(`${url}/api/issue-intake-adapters?issue_intake_status=complete&limit=1`);
  assert.equal(issueIntakeAdapters.collection, "issue_intake_adapters");
  assert.ok(issueIntakeAdapters.count <= 1);

  const issueIntakeSources = await fetchJson(`${url}/api/issue-intake-sources?issue_source_status=ready&source_system=github&limit=5`);
  assert.equal(issueIntakeSources.collection, "issue_intake_sources");
  assert.ok(issueIntakeSources.count <= 5);

  const issueIntakeRecords = await fetchJson(`${url}/api/issue-intake-records?issue_record_status=normalized&source_system=plane&limit=5`);
  assert.equal(issueIntakeRecords.collection, "issue_intake_records");
  assert.ok(issueIntakeRecords.count <= 5);

  const normalizedTaskContracts = await fetchJson(`${url}/api/normalized-task-contracts?normalized_task_status=ready_for_workflow&source_system=local&limit=5`);
  assert.equal(normalizedTaskContracts.collection, "normalized_task_contracts");
  assert.ok(normalizedTaskContracts.count <= 5);

  const issueTaskBindings = await fetchJson(`${url}/api/issue-task-bindings?issue_task_binding_status=bound&source_system=github&limit=5`);
  assert.equal(issueTaskBindings.collection, "issue_task_bindings");
  assert.ok(issueTaskBindings.count <= 5);

  const issueIntakeDesktopBoundary = await fetchJson(`${url}/api/issue-intake-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(issueIntakeDesktopBoundary.collection, "issue_intake_desktop_boundary");
  assert.ok(issueIntakeDesktopBoundary.count <= 1);

  const issueIntakeValidations = await fetchJson(`${url}/api/issue-intake-validations?status=passed&limit=5`);
  assert.equal(issueIntakeValidations.collection, "issue_intake_validations");
  assert.ok(issueIntakeValidations.count <= 5);

  const planRequestContracts = await fetchJson(`${url}/api/plan-request-contracts?plan_request_status=complete&limit=1`);
  assert.equal(planRequestContracts.collection, "plan_request_contracts");
  assert.ok(planRequestContracts.count <= 1);

  const sharedPlanningContexts = await fetchJson(`${url}/api/shared-planning-contexts?limit=1`);
  assert.equal(sharedPlanningContexts.collection, "shared_planning_contexts");
  assert.ok(sharedPlanningContexts.count <= 1);

  const planRequests = await fetchJson(`${url}/api/plan-requests?request_status=ready&agent=codex&limit=5`);
  assert.equal(planRequests.collection, "plan_requests");
  assert.ok(planRequests.count <= 5);

  const planRequestBindings = await fetchJson(`${url}/api/plan-request-bindings?binding_status=bound&limit=5`);
  assert.equal(planRequestBindings.collection, "plan_request_bindings");
  assert.ok(planRequestBindings.count <= 5);

  const planRequestDesktopBoundary = await fetchJson(`${url}/api/plan-request-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(planRequestDesktopBoundary.collection, "plan_request_desktop_boundary");
  assert.ok(planRequestDesktopBoundary.count <= 1);

  const planRequestValidations = await fetchJson(`${url}/api/plan-request-validations?status=passed&limit=5`);
  assert.equal(planRequestValidations.collection, "plan_request_validations");
  assert.ok(planRequestValidations.count <= 5);

  const planReconciliations = await fetchJson(`${url}/api/plan-reconciliations?plan_reconciliation_status=complete&limit=1`);
  assert.equal(planReconciliations.collection, "plan_reconciliations");
  assert.ok(planReconciliations.count <= 1);

  const planCandidates = await fetchJson(`${url}/api/plan-candidates?candidate_status=ready_for_reconciliation&agent=codex&limit=5`);
  assert.equal(planCandidates.collection, "plan_candidates");
  assert.ok(planCandidates.count <= 5);

  const planCommonalities = await fetchJson(`${url}/api/plan-commonalities?commonality_status=accepted&limit=5`);
  assert.equal(planCommonalities.collection, "plan_commonalities");
  assert.ok(planCommonalities.count <= 5);

  const planConflicts = await fetchJson(`${url}/api/plan-conflicts?conflict_status=resolved&limit=5`);
  assert.equal(planConflicts.collection, "plan_conflicts");
  assert.ok(planConflicts.count <= 5);

  const selectedPlanScopes = await fetchJson(`${url}/api/selected-plan-scopes?selected_scope_status=selected_for_human_review&limit=1`);
  assert.equal(selectedPlanScopes.collection, "selected_plan_scopes");
  assert.ok(selectedPlanScopes.count <= 1);

  const unresolvedPlanQuestions = await fetchJson(`${url}/api/unresolved-plan-questions?blocker_status=non_blocking_for_reconciliation&limit=5`);
  assert.equal(unresolvedPlanQuestions.collection, "unresolved_plan_questions");
  assert.ok(unresolvedPlanQuestions.count <= 5);

  const planReconciliationDesktopBoundary = await fetchJson(`${url}/api/plan-reconciliation-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(planReconciliationDesktopBoundary.collection, "plan_reconciliation_desktop_boundary");
  assert.ok(planReconciliationDesktopBoundary.count <= 1);

  const planReconciliationValidations = await fetchJson(`${url}/api/plan-reconciliation-validations?status=passed&limit=5`);
  assert.equal(planReconciliationValidations.collection, "plan_reconciliation_validations");
  assert.ok(planReconciliationValidations.count <= 5);

  const scopeFreezeGates = await fetchJson(`${url}/api/scope-freeze-gates?scope_freeze_gate_status=complete&limit=1`);
  assert.equal(scopeFreezeGates.collection, "scope_freeze_gates");
  assert.ok(scopeFreezeGates.count <= 1);

  const frozenScopeItems = await fetchJson(`${url}/api/frozen-scope-items?frozen_scope_status=frozen&limit=5`);
  assert.equal(frozenScopeItems.collection, "frozen_scope_items");
  assert.ok(frozenScopeItems.count <= 5);

  const scopeFileBoundaries = await fetchJson(`${url}/api/scope-file-boundaries?file_boundary_status=in_scope_unprotected&limit=5`);
  assert.equal(scopeFileBoundaries.collection, "scope_file_boundaries");
  assert.ok(scopeFileBoundaries.count <= 5);

  const scopeProtectedFileRules = await fetchJson(`${url}/api/scope-protected-file-rules?rule_snapshot_status=frozen&limit=5`);
  assert.equal(scopeProtectedFileRules.collection, "scope_protected_file_rules");
  assert.ok(scopeProtectedFileRules.count <= 5);

  const scopeFreezeDecisions = await fetchJson(`${url}/api/scope-freeze-decisions?decision_status=frozen&limit=1`);
  assert.equal(scopeFreezeDecisions.collection, "scope_freeze_decisions");
  assert.ok(scopeFreezeDecisions.count <= 1);

  const scopeFreezeDesktopBoundary = await fetchJson(`${url}/api/scope-freeze-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(scopeFreezeDesktopBoundary.collection, "scope_freeze_desktop_boundary");
  assert.ok(scopeFreezeDesktopBoundary.count <= 1);

  const scopeFreezeValidations = await fetchJson(`${url}/api/scope-freeze-validations?status=passed&limit=5`);
  assert.equal(scopeFreezeValidations.collection, "scope_freeze_validations");
  assert.ok(scopeFreezeValidations.count <= 5);

  const devLaneLedgers = await fetchJson(`${url}/api/dev-lane-ledgers?dev_lane_ledger_status=complete&limit=1`);
  assert.equal(devLaneLedgers.collection, "dev_lane_ledgers");
  assert.ok(devLaneLedgers.count <= 1);

  const devLanes = await fetchJson(`${url}/api/dev-lanes?lane_status=provisioned&agent=codex&limit=5`);
  assert.equal(devLanes.collection, "dev_lanes");
  assert.ok(devLanes.count <= 5);

  const devLaneBranchRecords = await fetchJson(`${url}/api/dev-lane-branch-records?branch_record_status=created&limit=5`);
  assert.equal(devLaneBranchRecords.collection, "dev_lane_branch_records");
  assert.ok(devLaneBranchRecords.count <= 5);

  const devLaneWorktreeRecords = await fetchJson(`${url}/api/dev-lane-worktree-records?worktree_record_status=created&limit=5`);
  assert.equal(devLaneWorktreeRecords.collection, "dev_lane_worktree_records");
  assert.ok(devLaneWorktreeRecords.count <= 5);

  const devLaneDesktopBoundary = await fetchJson(`${url}/api/dev-lane-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(devLaneDesktopBoundary.collection, "dev_lane_desktop_boundary");
  assert.ok(devLaneDesktopBoundary.count <= 1);

  const devLaneValidations = await fetchJson(`${url}/api/dev-lane-validations?status=passed&limit=5`);
  assert.equal(devLaneValidations.collection, "dev_lane_validations");
  assert.ok(devLaneValidations.count <= 5);

  const implementationPatchCaptures = await fetchJson(`${url}/api/implementation-patch-captures?implementation_patch_capture_status=complete&limit=1`);
  assert.equal(implementationPatchCaptures.collection, "implementation_patch_captures");
  assert.ok(implementationPatchCaptures.count <= 1);

  const implementationPatchRecords = await fetchJson(`${url}/api/implementation-patch-records?patch_record_status=captured&agent=codex&limit=5`);
  assert.equal(implementationPatchRecords.collection, "implementation_patch_records");
  assert.ok(implementationPatchRecords.count <= 5);

  const implementationDiffCaptures = await fetchJson(`${url}/api/implementation-diff-captures?diff_capture_status=captured&limit=5`);
  assert.equal(implementationDiffCaptures.collection, "implementation_diff_captures");
  assert.ok(implementationDiffCaptures.count <= 5);

  const implementationTouchedFiles = await fetchJson(`${url}/api/implementation-touched-files?touched_file_status=captured_in_scope&limit=5`);
  assert.equal(implementationTouchedFiles.collection, "implementation_touched_files");
  assert.ok(implementationTouchedFiles.count <= 5);

  const implementationGeneratedArtifacts = await fetchJson(`${url}/api/implementation-generated-artifacts?generated_artifact_status=captured&limit=5`);
  assert.equal(implementationGeneratedArtifacts.collection, "implementation_generated_artifacts");
  assert.ok(implementationGeneratedArtifacts.count <= 5);

  const implementationRunLedgerBindings = await fetchJson(`${url}/api/implementation-run-ledger-bindings?run_ledger_binding_status=bound&limit=5`);
  assert.equal(implementationRunLedgerBindings.collection, "implementation_run_ledger_bindings");
  assert.ok(implementationRunLedgerBindings.count <= 5);

  const implementationPatchDesktopBoundary = await fetchJson(`${url}/api/implementation-patch-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(implementationPatchDesktopBoundary.collection, "implementation_patch_desktop_boundary");
  assert.ok(implementationPatchDesktopBoundary.count <= 1);

  const implementationPatchValidations = await fetchJson(`${url}/api/implementation-patch-validations?status=passed&limit=5`);
  assert.equal(implementationPatchValidations.collection, "implementation_patch_validations");
  assert.ok(implementationPatchValidations.count <= 5);

  const diffReviewGates = await fetchJson(`${url}/api/diff-review-gates?diff_review_gate_status=complete&limit=1`);
  assert.equal(diffReviewGates.collection, "diff_review_gates");
  assert.ok(diffReviewGates.count <= 1);

  const diffReviewResults = await fetchJson(`${url}/api/diff-review-results?diff_review_status=reviewed_with_human_gate&agent=codex&limit=5`);
  assert.equal(diffReviewResults.collection, "diff_review_results");
  assert.ok(diffReviewResults.count <= 5);

  const diffReviewFileFindings = await fetchJson(`${url}/api/diff-review-file-findings?file_finding_status=reviewed_in_scope&limit=5`);
  assert.equal(diffReviewFileFindings.collection, "diff_review_file_findings");
  assert.ok(diffReviewFileFindings.count <= 5);

  const diffReviewArtifactFindings = await fetchJson(`${url}/api/diff-review-artifact-findings?artifact_finding_status=reviewed_output_bound&limit=5`);
  assert.equal(diffReviewArtifactFindings.collection, "diff_review_artifact_findings");
  assert.ok(diffReviewArtifactFindings.count <= 5);

  const diffReviewGateResults = await fetchJson(`${url}/api/diff-review-gate-results?gate_result_status=passed_with_human_gate&limit=5`);
  assert.equal(diffReviewGateResults.collection, "diff_review_gate_results");
  assert.ok(diffReviewGateResults.count <= 5);

  const diffReviewDesktopBoundary = await fetchJson(`${url}/api/diff-review-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(diffReviewDesktopBoundary.collection, "diff_review_desktop_boundary");
  assert.ok(diffReviewDesktopBoundary.count <= 1);

  const diffReviewValidations = await fetchJson(`${url}/api/diff-review-validations?status=passed&limit=5`);
  assert.equal(diffReviewValidations.collection, "diff_review_validations");
  assert.ok(diffReviewValidations.count <= 5);

  const canonicalTestMatrices = await fetchJson(`${url}/api/canonical-test-matrices?canonical_test_matrix_status=complete&limit=1`);
  assert.equal(canonicalTestMatrices.collection, "canonical_test_matrices");
  assert.ok(canonicalTestMatrices.count <= 1);

  const canonicalTestMatrixRepos = await fetchJson(`${url}/api/canonical-test-matrix-repos?repo_matrix_status=ready&limit=5`);
  assert.equal(canonicalTestMatrixRepos.collection, "canonical_test_matrix_repos");
  assert.ok(canonicalTestMatrixRepos.count <= 5);

  const canonicalTestMatrixCommands = await fetchJson(`${url}/api/canonical-test-matrix-commands?matrix_command_status=configured&test_dimension=unit&limit=5`);
  assert.equal(canonicalTestMatrixCommands.collection, "canonical_test_matrix_commands");
  assert.ok(canonicalTestMatrixCommands.count <= 5);

  const canonicalTestMatrixExecutions = await fetchJson(`${url}/api/canonical-test-matrix-executions?execution_status=passed&test_dimension=unit&limit=5`);
  assert.equal(canonicalTestMatrixExecutions.collection, "canonical_test_matrix_executions");
  assert.ok(canonicalTestMatrixExecutions.count <= 5);

  const canonicalTestMatrixResults = await fetchJson(`${url}/api/canonical-test-matrix-results?matrix_result_status=passed&limit=5`);
  assert.equal(canonicalTestMatrixResults.collection, "canonical_test_matrix_results");
  assert.ok(canonicalTestMatrixResults.count <= 5);

  const canonicalTestMatrixBindings = await fetchJson(`${url}/api/canonical-test-matrix-bindings?binding_status=bound_to_passing_matrix&limit=5`);
  assert.equal(canonicalTestMatrixBindings.collection, "canonical_test_matrix_bindings");
  assert.ok(canonicalTestMatrixBindings.count <= 5);

  const canonicalTestMatrixDesktopBoundary = await fetchJson(`${url}/api/canonical-test-matrix-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(canonicalTestMatrixDesktopBoundary.collection, "canonical_test_matrix_desktop_boundary");
  assert.ok(canonicalTestMatrixDesktopBoundary.count <= 1);

  const canonicalTestMatrixValidations = await fetchJson(`${url}/api/canonical-test-matrix-validations?status=passed&limit=5`);
  assert.equal(canonicalTestMatrixValidations.collection, "canonical_test_matrix_validations");
  assert.ok(canonicalTestMatrixValidations.count <= 5);

  const devProtectedScans = await fetchJson(`${url}/api/dev-protected-scans?dev_protected_scan_status=complete&limit=1`);
  assert.equal(devProtectedScans.collection, "dev_protected_scans");
  assert.ok(devProtectedScans.count <= 1);

  const devProtectedFileFindings = await fetchJson(`${url}/api/dev-protected-file-findings?finding_status=blocked_pending_explicit_approval&candidate_origin=protected_file_gate_approval_requirement&limit=5`);
  assert.equal(devProtectedFileFindings.collection, "dev_protected_file_findings");
  assert.ok(devProtectedFileFindings.count <= 5);

  const devSecretFindings = await fetchJson(`${url}/api/dev-secret-findings?secret_finding_status=blocked_pending_explicit_approval&limit=5`);
  assert.equal(devSecretFindings.collection, "dev_secret_findings");
  assert.ok(devSecretFindings.count <= 5);

  const devProdConfigFindings = await fetchJson(`${url}/api/dev-prod-config-findings?prod_config_finding_status=blocked_pending_explicit_approval&limit=5`);
  assert.equal(devProdConfigFindings.collection, "dev_prod_config_findings");
  assert.ok(devProdConfigFindings.count <= 5);

  const devProtectedScanResults = await fetchJson(`${url}/api/dev-protected-scan-results?scan_result_status=passed_with_protected_blocks&limit=5`);
  assert.equal(devProtectedScanResults.collection, "dev_protected_scan_results");
  assert.ok(devProtectedScanResults.count <= 5);

  const devProtectedScanBindings = await fetchJson(`${url}/api/dev-protected-scan-bindings?binding_status=bound_after_canonical_test_matrix&limit=5`);
  assert.equal(devProtectedScanBindings.collection, "dev_protected_scan_bindings");
  assert.ok(devProtectedScanBindings.count <= 5);

  const devProtectedScanDesktopBoundary = await fetchJson(`${url}/api/dev-protected-scan-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(devProtectedScanDesktopBoundary.collection, "dev_protected_scan_desktop_boundary");
  assert.ok(devProtectedScanDesktopBoundary.count <= 1);

  const devProtectedScanValidations = await fetchJson(`${url}/api/dev-protected-scan-validations?status=passed&limit=5`);
  assert.equal(devProtectedScanValidations.collection, "dev_protected_scan_validations");
  assert.ok(devProtectedScanValidations.count <= 5);

  const prDraftArtifacts = await fetchJson(`${url}/api/pr-draft-artifacts?pr_draft_artifact_status=complete&limit=1`);
  assert.equal(prDraftArtifacts.collection, "pr_draft_artifacts");
  assert.ok(prDraftArtifacts.count <= 1);

  const prDraftOutputArtifacts = await fetchJson(`${url}/api/pr-draft-output-artifacts?artifact_type=pr_draft&output_status=draft&limit=5`);
  assert.equal(prDraftOutputArtifacts.collection, "pr_draft_output_artifacts");
  assert.ok(prDraftOutputArtifacts.count <= 5);

  const prDraftSections = await fetchJson(`${url}/api/pr-draft-sections?section_status=ready_for_human_review&limit=5`);
  assert.equal(prDraftSections.collection, "pr_draft_sections");
  assert.ok(prDraftSections.count <= 5);

  const prDraftTestEvidence = await fetchJson(`${url}/api/pr-draft-test-evidence?test_evidence_status=passed&limit=5`);
  assert.equal(prDraftTestEvidence.collection, "pr_draft_test_evidence");
  assert.ok(prDraftTestEvidence.count <= 5);

  const prDraftRisks = await fetchJson(`${url}/api/pr-draft-risks?risk_status=documented_for_human_review&limit=5`);
  assert.equal(prDraftRisks.collection, "pr_draft_risks");
  assert.ok(prDraftRisks.count <= 5);

  const prDraftRollbackPlan = await fetchJson(`${url}/api/pr-draft-rollback-plan?rollback_status=draft_not_executed&limit=5`);
  assert.equal(prDraftRollbackPlan.collection, "pr_draft_rollback_plan");
  assert.ok(prDraftRollbackPlan.count <= 5);

  const prDraftBindings = await fetchJson(`${url}/api/pr-draft-bindings?pr_draft_binding_status=bound_after_protected_scan&limit=5`);
  assert.equal(prDraftBindings.collection, "pr_draft_bindings");
  assert.ok(prDraftBindings.count <= 5);

  const prDraftDesktopBoundary = await fetchJson(`${url}/api/pr-draft-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(prDraftDesktopBoundary.collection, "pr_draft_desktop_boundary");
  assert.ok(prDraftDesktopBoundary.count <= 1);

  const prDraftValidations = await fetchJson(`${url}/api/pr-draft-validations?status=passed&limit=5`);
  assert.equal(prDraftValidations.collection, "pr_draft_validations");
  assert.ok(prDraftValidations.count <= 5);

  const releaseNoteArtifacts = await fetchJson(`${url}/api/release-note-artifacts?release_note_artifact_status=complete&limit=1`);
  assert.equal(releaseNoteArtifacts.collection, "release_note_artifacts");
  assert.ok(releaseNoteArtifacts.count <= 1);

  const releaseNoteOutputArtifacts = await fetchJson(`${url}/api/release-note-output-artifacts?artifact_type=release_note&output_status=draft&limit=5`);
  assert.equal(releaseNoteOutputArtifacts.collection, "release_note_output_artifacts");
  assert.ok(releaseNoteOutputArtifacts.count <= 5);

  const releaseNoteChangeRecords = await fetchJson(`${url}/api/release-note-change-records?change_record_status=draft_from_human_gated_merge_candidate&limit=5`);
  assert.equal(releaseNoteChangeRecords.collection, "release_note_change_records");
  assert.ok(releaseNoteChangeRecords.count <= 5);

  const releaseNoteSections = await fetchJson(`${url}/api/release-note-sections?section_status=draft_ready_for_human_review&limit=5`);
  assert.equal(releaseNoteSections.collection, "release_note_sections");
  assert.ok(releaseNoteSections.count <= 5);

  const releaseNoteGateBindings = await fetchJson(`${url}/api/release-note-gate-bindings?release_note_binding_status=bound_to_release_note_draft&limit=5`);
  assert.equal(releaseNoteGateBindings.collection, "release_note_gate_bindings");
  assert.ok(releaseNoteGateBindings.count <= 5);

  const releaseNoteDesktopBoundary = await fetchJson(`${url}/api/release-note-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(releaseNoteDesktopBoundary.collection, "release_note_desktop_boundary");
  assert.ok(releaseNoteDesktopBoundary.count <= 1);

  const releaseNoteValidations = await fetchJson(`${url}/api/release-note-validations?status=passed&limit=5`);
  assert.equal(releaseNoteValidations.collection, "release_note_validations");
  assert.ok(releaseNoteValidations.count <= 5);

  const rollbackPlanArtifacts = await fetchJson(`${url}/api/rollback-plan-artifacts?rollback_plan_artifact_status=complete&limit=1`);
  assert.equal(rollbackPlanArtifacts.collection, "rollback_plan_artifacts");
  assert.ok(rollbackPlanArtifacts.count <= 1);

  const rollbackPlanOutputArtifacts = await fetchJson(`${url}/api/rollback-plan-output-artifacts?artifact_type=rollback_plan&output_status=draft&limit=5`);
  assert.equal(rollbackPlanOutputArtifacts.collection, "rollback_plan_output_artifacts");
  assert.ok(rollbackPlanOutputArtifacts.count <= 5);

  const rollbackCommitTargets = await fetchJson(`${url}/api/rollback-commit-targets?rollback_commit_status=pending_not_merged&limit=5`);
  assert.equal(rollbackCommitTargets.collection, "rollback_commit_targets");
  assert.ok(rollbackCommitTargets.count <= 5);

  const rollbackFileTargets = await fetchJson(`${url}/api/rollback-file-targets?rollback_file_status=restore_candidate_declared&limit=5`);
  assert.equal(rollbackFileTargets.collection, "rollback_file_targets");
  assert.ok(rollbackFileTargets.count <= 5);

  const rollbackCommandTargets = await fetchJson(`${url}/api/rollback-command-targets?rollback_command_status=draft_not_executed&limit=5`);
  assert.equal(rollbackCommandTargets.collection, "rollback_command_targets");
  assert.ok(rollbackCommandTargets.count <= 5);

  const rollbackPlanBindings = await fetchJson(`${url}/api/rollback-plan-bindings?rollback_plan_binding_status=bound_to_rollback_plan_draft&limit=5`);
  assert.equal(rollbackPlanBindings.collection, "rollback_plan_bindings");
  assert.ok(rollbackPlanBindings.count <= 5);

  const rollbackPlanDesktopBoundary = await fetchJson(`${url}/api/rollback-plan-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(rollbackPlanDesktopBoundary.collection, "rollback_plan_desktop_boundary");
  assert.ok(rollbackPlanDesktopBoundary.count <= 1);

  const rollbackPlanValidations = await fetchJson(`${url}/api/rollback-plan-validations?status=passed&limit=5`);
  assert.equal(rollbackPlanValidations.collection, "rollback_plan_validations");
  assert.ok(rollbackPlanValidations.count <= 5);

  const technicalDebtLedgers = await fetchJson(`${url}/api/technical-debt-ledgers?technical_debt_ledger_status=complete&limit=1`);
  assert.equal(technicalDebtLedgers.collection, "technical_debt_ledgers");
  assert.ok(technicalDebtLedgers.count <= 1);

  const technicalDebtOutputArtifacts = await fetchJson(`${url}/api/technical-debt-output-artifacts?artifact_type=task_update&output_status=draft&limit=5`);
  assert.equal(technicalDebtOutputArtifacts.collection, "technical_debt_output_artifacts");
  assert.ok(technicalDebtOutputArtifacts.count <= 5);

  const debtSourceFindings = await fetchJson(`${url}/api/debt-source-findings?finding_status=open_for_triage&limit=5`);
  assert.equal(debtSourceFindings.collection, "debt_source_findings");
  assert.ok(debtSourceFindings.count <= 5);

  const technicalDebtTasks = await fetchJson(`${url}/api/technical-debt-tasks?debt_task_status=backlog&debt_preservation_status=preserved_as_task&limit=5`);
  assert.equal(technicalDebtTasks.collection, "technical_debt_tasks");
  assert.ok(technicalDebtTasks.count <= 5);

  const debtTaskBindings = await fetchJson(`${url}/api/debt-task-bindings?debt_task_binding_status=bound_to_technical_debt_ledger&limit=5`);
  assert.equal(debtTaskBindings.collection, "debt_task_bindings");
  assert.ok(debtTaskBindings.count <= 5);

  const technicalDebtDesktopBoundary = await fetchJson(`${url}/api/technical-debt-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(technicalDebtDesktopBoundary.collection, "technical_debt_desktop_boundary");
  assert.ok(technicalDebtDesktopBoundary.count <= 1);

  const technicalDebtValidations = await fetchJson(`${url}/api/technical-debt-validations?status=passed&limit=5`);
  assert.equal(technicalDebtValidations.collection, "technical_debt_validations");
  assert.ok(technicalDebtValidations.count <= 5);

  const personalDevDashboards = await fetchJson(`${url}/api/personal-dev-dashboard-apis?personal_dev_dashboard_status=complete&limit=1`);
  assert.equal(personalDevDashboards.collection, "personal_dev_dashboard_apis");
  assert.ok(personalDevDashboards.count <= 1);

  const personalDevOutputArtifacts = await fetchJson(`${url}/api/personal-dev-output-artifacts?artifact_type=json&output_status=draft&limit=5`);
  assert.equal(personalDevOutputArtifacts.collection, "personal_dev_output_artifacts");
  assert.ok(personalDevOutputArtifacts.count <= 5);

  const personalDevPanelRows = await fetchJson(`${url}/api/personal-dev-panel-rows?panel_section=repo&panel_status=ready&limit=5`);
  assert.equal(personalDevPanelRows.collection, "personal_dev_panel_rows");
  assert.ok(personalDevPanelRows.count <= 5);

  const personalDevStatusRollups = await fetchJson(`${url}/api/personal-dev-status-rollups?rollup_key=test&rollup_status=ready&limit=5`);
  assert.equal(personalDevStatusRollups.collection, "personal_dev_status_rollups");
  assert.ok(personalDevStatusRollups.count <= 5);

  const personalDevRouteBindings = await fetchJson(`${url}/api/personal-dev-api-route-bindings?route_group=pr&route_binding_status=active&limit=5`);
  assert.equal(personalDevRouteBindings.collection, "personal_dev_api_route_bindings");
  assert.ok(personalDevRouteBindings.count <= 5);

  const personalDevDashboardBoundary = await fetchJson(`${url}/api/personal-dev-dashboard-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(personalDevDashboardBoundary.collection, "personal_dev_dashboard_desktop_boundary");
  assert.ok(personalDevDashboardBoundary.count <= 1);

  const personalDevDashboardValidations = await fetchJson(`${url}/api/personal-dev-dashboard-validations?status=passed&limit=5`);
  assert.equal(personalDevDashboardValidations.collection, "personal_dev_dashboard_validations");
  assert.ok(personalDevDashboardValidations.count <= 5);

  const personalDevE2eFreezes = await fetchJson(`${url}/api/personal-dev-e2e-freezes?personal_dev_e2e_freeze_status=complete&limit=1`);
  assert.equal(personalDevE2eFreezes.collection, "personal_dev_e2e_freezes");
  assert.ok(personalDevE2eFreezes.count <= 1);

  const personalDevE2eSources = await fetchJson(`${url}/api/personal-dev-e2e-freeze-sources?personal_dev_e2e_source_status=complete&limit=5`);
  assert.equal(personalDevE2eSources.collection, "personal_dev_e2e_freeze_sources");
  assert.ok(personalDevE2eSources.count <= 5);

  const personalDevE2eCheckpoints = await fetchJson(`${url}/api/personal-dev-e2e-freeze-checkpoints?personal_dev_e2e_checkpoint_status=passed&limit=5`);
  assert.equal(personalDevE2eCheckpoints.collection, "personal_dev_e2e_freeze_checkpoints");
  assert.ok(personalDevE2eCheckpoints.count <= 5);

  const personalDevE2eTraces = await fetchJson(`${url}/api/personal-dev-e2e-traces?e2e_trace_stage=dashboard_api&e2e_trace_status=passed&limit=5`);
  assert.equal(personalDevE2eTraces.collection, "personal_dev_e2e_traces");
  assert.ok(personalDevE2eTraces.count <= 5);

  const personalDevE2eLoopBindings = await fetchJson(`${url}/api/personal-dev-e2e-loop-bindings?e2e_loop_binding_status=bound_self&limit=5`);
  assert.equal(personalDevE2eLoopBindings.collection, "personal_dev_e2e_loop_bindings");
  assert.ok(personalDevE2eLoopBindings.count <= 5);

  const personalDevE2eBoundary = await fetchJson(`${url}/api/personal-dev-e2e-freeze-desktop-boundary?boundary_status=enforced&read_only=true&limit=1`);
  assert.equal(personalDevE2eBoundary.collection, "personal_dev_e2e_freeze_desktop_boundary");
  assert.ok(personalDevE2eBoundary.count <= 1);

  const personalDevE2eValidations = await fetchJson(`${url}/api/personal-dev-e2e-freeze-validations?status=passed&limit=5`);
  assert.equal(personalDevE2eValidations.collection, "personal_dev_e2e_freeze_validations");
  assert.ok(personalDevE2eValidations.count <= 5);

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

  const eventEnvelopeLedgers = await fetchJson(`${url}/api/event-envelope-ledgers?event_envelope_status=complete&limit=1`);
  assert.equal(eventEnvelopeLedgers.collection, "event_envelope_ledgers");
  assert.ok(eventEnvelopeLedgers.count <= 1);

  const eventEnvelopes = await fetchJson(`${url}/api/event-envelopes?envelope_kind=event_record&specversion=1.0&limit=5`);
  assert.equal(eventEnvelopes.collection, "event_envelopes");
  assert.ok(eventEnvelopes.count <= 5);

  const eventEnvelopeSourceBindings = await fetchJson(`${url}/api/event-envelope-source-bindings?source_kind=event_record&binding_status=linked&round_trip_status=round_trip_preserved&limit=5`);
  assert.equal(eventEnvelopeSourceBindings.collection, "event_envelope_source_bindings");
  assert.ok(eventEnvelopeSourceBindings.count <= 5);

  const eventEnvelopeValidations = await fetchJson(`${url}/api/event-envelope-validations?status=passed&limit=5`);
  assert.equal(eventEnvelopeValidations.collection, "event_envelope_validations");
  assert.ok(eventEnvelopeValidations.count <= 5);

  const eventTypeRegistries = await fetchJson(`${url}/api/event-type-registries?event_type_registry_status=complete&limit=1`);
  assert.equal(eventTypeRegistries.collection, "event_type_registries");
  assert.ok(eventTypeRegistries.count <= 1);

  const eventTypes = await fetchJson(`${url}/api/event-types?event_family=resource&registry_status=registered&limit=5`);
  assert.equal(eventTypes.collection, "event_types");
  assert.ok(eventTypes.count <= 5);

  const eventFamilies = await fetchJson(`${url}/api/event-families?required_family=true&coverage_status=covered&limit=5`);
  assert.equal(eventFamilies.collection, "event_families");
  assert.ok(eventFamilies.count <= 5);

  const eventTypeBindings = await fetchJson(`${url}/api/event-type-bindings?event_family=workflow&binding_status=bound&limit=5`);
  assert.equal(eventTypeBindings.collection, "event_type_bindings");
  assert.ok(eventTypeBindings.count <= 5);

  const eventTypeRegistryValidations = await fetchJson(`${url}/api/event-type-registry-validations?status=passed&limit=5`);
  assert.equal(eventTypeRegistryValidations.collection, "event_type_registry_validations");
  assert.ok(eventTypeRegistryValidations.count <= 5);

  const appendOnlyEventStores = await fetchJson(`${url}/api/append-only-event-stores?event_store_status=complete&limit=1`);
  assert.equal(appendOnlyEventStores.collection, "append_only_event_stores");
  assert.ok(appendOnlyEventStores.count <= 1);

  const storedEvents = await fetchJson(`${url}/api/stored-events?append_status=appended&immutable_status=locked&limit=5`);
  assert.equal(storedEvents.collection, "stored_events");
  assert.ok(storedEvents.count <= 5);

  const eventStreams = await fetchJson(`${url}/api/event-streams?sequence_status=contiguous&stream_status=active&limit=5`);
  assert.equal(eventStreams.collection, "event_streams");
  assert.ok(eventStreams.count <= 5);

  const eventCorrectionPolicies = await fetchJson(`${url}/api/event-correction-policies?correction_policy_status=enforced&limit=1`);
  assert.equal(eventCorrectionPolicies.collection, "event_correction_policies");
  assert.ok(eventCorrectionPolicies.count <= 1);

  const eventStoreValidations = await fetchJson(`${url}/api/event-store-validations?status=passed&limit=5`);
  assert.equal(eventStoreValidations.collection, "event_store_validations");
  assert.ok(eventStoreValidations.count <= 5);

  const eventCorrelationLedgers = await fetchJson(`${url}/api/event-correlation-ledgers?event_correlation_status=complete&limit=1`);
  assert.equal(eventCorrelationLedgers.collection, "event_correlation_ledgers");
  assert.ok(eventCorrelationLedgers.count <= 1);

  const correlationTraces = await fetchJson(`${url}/api/correlation-traces?trace_status=linked&causation_status=linked&limit=5`);
  assert.equal(correlationTraces.collection, "correlation_traces");
  assert.ok(correlationTraces.count <= 5);

  const causationEdges = await fetchJson(`${url}/api/causation-edges?causation_status=linked&limit=5`);
  assert.equal(causationEdges.collection, "causation_edges");
  assert.ok(causationEdges.count <= 5);

  const traceRunBindings = await fetchJson(`${url}/api/trace-run-bindings?run_binding_status=known&limit=5`);
  assert.equal(traceRunBindings.collection, "trace_run_bindings");
  assert.ok(traceRunBindings.count <= 5);

  const eventCorrelationValidations = await fetchJson(`${url}/api/event-correlation-validations?status=passed&limit=5`);
  assert.equal(eventCorrelationValidations.collection, "event_correlation_validations");
  assert.ok(eventCorrelationValidations.count <= 5);

  const workflowRunLedgers = await fetchJson(`${url}/api/workflow-run-ledgers?workflow_run_ledger_status=complete&limit=1`);
  assert.equal(workflowRunLedgers.collection, "workflow_run_ledgers");
  assert.ok(workflowRunLedgers.count <= 1);

  const workflowRunRecords = await fetchJson(`${url}/api/workflow-run-records?workflow_run_record_status=event_backed&terminal_state=blocked&limit=5`);
  assert.equal(workflowRunRecords.collection, "workflow_run_records");
  assert.ok(workflowRunRecords.count <= 5);

  const workflowStateTransitions = await fetchJson(`${url}/api/workflow-state-transitions?transition_status=event_backed&to_state=blocked&limit=5`);
  assert.equal(workflowStateTransitions.collection, "workflow_state_transitions");
  assert.ok(workflowStateTransitions.count <= 5);

  const workflowEventBindings = await fetchJson(`${url}/api/workflow-event-bindings?binding_status=linked&state_effect=state_transition&limit=5`);
  assert.equal(workflowEventBindings.collection, "workflow_event_bindings");
  assert.ok(workflowEventBindings.count <= 5);

  const workflowRunLedgerValidations = await fetchJson(`${url}/api/workflow-run-ledger-validations?status=passed&limit=5`);
  assert.equal(workflowRunLedgerValidations.collection, "workflow_run_ledger_validations");
  assert.ok(workflowRunLedgerValidations.count <= 5);

  const agentRunLedgers = await fetchJson(`${url}/api/agent-run-ledgers?agent_run_ledger_status=complete&limit=1`);
  assert.equal(agentRunLedgers.collection, "agent_run_ledgers");
  assert.ok(agentRunLedgers.count <= 1);

  const agentRunRecords = await fetchJson(`${url}/api/agent-run-records?runtime_contract_binding_status=linked&workflow_run_binding_status=linked&limit=5`);
  assert.equal(agentRunRecords.collection, "agent_run_records");
  assert.ok(agentRunRecords.count <= 5);

  const agentRunIoReferences = await fetchJson(`${url}/api/agent-run-io-references?io_reference_status=complete&limit=5`);
  assert.equal(agentRunIoReferences.collection, "agent_run_io_references");
  assert.ok(agentRunIoReferences.count <= 5);

  const agentRunArtifactReferences = await fetchJson(`${url}/api/agent-run-artifact-references?artifact_reference_status=captured&limit=5`);
  assert.equal(agentRunArtifactReferences.collection, "agent_run_artifact_references");
  assert.ok(agentRunArtifactReferences.count <= 5);

  const agentRunLogReferences = await fetchJson(`${url}/api/agent-run-log-references?log_reference_status=captured&limit=5`);
  assert.equal(agentRunLogReferences.collection, "agent_run_log_references");
  assert.ok(agentRunLogReferences.count <= 5);

  const agentRunEventBindings = await fetchJson(`${url}/api/agent-run-event-bindings?event_binding_status=linked&limit=5`);
  assert.equal(agentRunEventBindings.collection, "agent_run_event_bindings");
  assert.ok(agentRunEventBindings.count <= 5);

  const agentRunLedgerValidations = await fetchJson(`${url}/api/agent-run-ledger-validations?status=passed&limit=5`);
  assert.equal(agentRunLedgerValidations.collection, "agent_run_ledger_validations");
  assert.ok(agentRunLedgerValidations.count <= 5);

  const toolInvocationLedgers = await fetchJson(`${url}/api/tool-invocation-ledgers?tool_invocation_ledger_status=complete&limit=1`);
  assert.equal(toolInvocationLedgers.collection, "tool_invocation_ledgers");
  assert.ok(toolInvocationLedgers.count <= 1);

  const toolInvocationRecords = await fetchJson(`${url}/api/tool-invocation-records?invocation_state=blocked&limit=5`);
  assert.equal(toolInvocationRecords.collection, "tool_invocation_records");
  assert.ok(toolInvocationRecords.count <= 5);

  const toolInvocationPermissionDecisions = await fetchJson(`${url}/api/tool-invocation-permission-decisions?permission_decision=deny&limit=5`);
  assert.equal(toolInvocationPermissionDecisions.collection, "tool_invocation_permission_decisions");
  assert.ok(toolInvocationPermissionDecisions.count <= 5);

  const toolInvocationAgentBindings = await fetchJson(`${url}/api/tool-invocation-agent-bindings?binding_status=complete&limit=5`);
  assert.equal(toolInvocationAgentBindings.collection, "tool_invocation_agent_bindings");
  assert.ok(toolInvocationAgentBindings.count <= 5);

  const toolInvocationEventBindings = await fetchJson(`${url}/api/tool-invocation-event-bindings?event_binding_status=context_bound&limit=5`);
  assert.equal(toolInvocationEventBindings.collection, "tool_invocation_event_bindings");
  assert.ok(toolInvocationEventBindings.count <= 5);

  const toolInvocationLedgerValidations = await fetchJson(`${url}/api/tool-invocation-ledger-validations?status=passed&limit=5`);
  assert.equal(toolInvocationLedgerValidations.collection, "tool_invocation_ledger_validations");
  assert.ok(toolInvocationLedgerValidations.count <= 5);

  const auditEventLedgers = await fetchJson(`${url}/api/audit-event-ledgers?audit_event_ledger_status=complete&limit=1`);
  assert.equal(auditEventLedgers.collection, "audit_event_ledgers");
  assert.ok(auditEventLedgers.count <= 1);

  const auditTrailRecords = await fetchJson(`${url}/api/audit-trail-records?separation_status=separate_from_observability&limit=5`);
  assert.equal(auditTrailRecords.collection, "audit_trail_records");
  assert.ok(auditTrailRecords.count <= 5);

  const auditSeparationBindings = await fetchJson(`${url}/api/audit-separation-bindings?observability_log_status=excluded_from_observability_log&limit=5`);
  assert.equal(auditSeparationBindings.collection, "audit_separation_bindings");
  assert.ok(auditSeparationBindings.count <= 5);

  const auditSourceRollups = await fetchJson(`${url}/api/audit-source-rollups?audit_domain=security&limit=5`);
  assert.equal(auditSourceRollups.collection, "audit_source_rollups");
  assert.ok(auditSourceRollups.count <= 5);

  const auditEventLedgerValidations = await fetchJson(`${url}/api/audit-event-ledger-validations?status=passed&limit=5`);
  assert.equal(auditEventLedgerValidations.collection, "audit_event_ledger_validations");
  assert.ok(auditEventLedgerValidations.count <= 5);

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

  const costRecordProjections = await fetchJson(`${url}/api/cost-record-projections?cost_record_projection_status=complete&limit=1`);
  assert.equal(costRecordProjections.collection, "cost_record_projections");
  assert.ok(costRecordProjections.count <= 1);

  const providerProjectedCostRecords = await fetchJson(`${url}/api/projected-cost-records?cost_category=provider&limit=5`);
  assert.equal(providerProjectedCostRecords.collection, "projected_cost_records");
  assert.ok(providerProjectedCostRecords.count <= 5);

  const attributedRunCostRollups = await fetchJson(`${url}/api/run-cost-rollups?attribution_status=run_attributed&limit=5`);
  assert.equal(attributedRunCostRollups.collection, "run_cost_rollups");
  assert.ok(attributedRunCostRollups.count <= 5);

  const apiCostCategoryRollups = await fetchJson(`${url}/api/cost-category-rollups?cost_category=api&limit=1`);
  assert.equal(apiCostCategoryRollups.collection, "cost_category_rollups");
  assert.ok(apiCostCategoryRollups.count <= 1);

  const costRecordProjectionValidations = await fetchJson(`${url}/api/cost-record-projection-validations?status=passed&limit=5`);
  assert.equal(costRecordProjectionValidations.collection, "cost_record_projection_validations");
  assert.ok(costRecordProjectionValidations.count <= 5);

  const tokenUsageProjections = await fetchJson(`${url}/api/token-usage-projections?token_usage_projection_status=complete&limit=1`);
  assert.equal(tokenUsageProjections.collection, "token_usage_projections");
  assert.ok(tokenUsageProjections.count <= 1);

  const providerBoundTokenUsageRecords = await fetchJson(`${url}/api/projected-token-usage-records?provider_cost_binding_status=bound&limit=5`);
  assert.equal(providerBoundTokenUsageRecords.collection, "projected_token_usage_records");
  assert.ok(providerBoundTokenUsageRecords.count <= 5);

  const personalDevCapabilityTokenRollups = await fetchJson(`${url}/api/capability-token-rollups?capability_id=personal_dev.codex.worktree_patch&limit=5`);
  assert.equal(personalDevCapabilityTokenRollups.collection, "capability_token_rollups");
  assert.ok(personalDevCapabilityTokenRollups.count <= 5);

  const codexRuntimeTokenRollups = await fetchJson(`${url}/api/runtime-token-rollups?runtime_id=codex&limit=5`);
  assert.equal(codexRuntimeTokenRollups.collection, "runtime_token_rollups");
  assert.ok(codexRuntimeTokenRollups.count <= 5);

  const capabilityRuntimeTokenRollups = await fetchJson(`${url}/api/capability-runtime-token-rollups?rollup_type=capability_runtime&limit=5`);
  assert.equal(capabilityRuntimeTokenRollups.collection, "capability_runtime_token_rollups");
  assert.ok(capabilityRuntimeTokenRollups.count <= 5);

  const tokenUsageProjectionValidations = await fetchJson(`${url}/api/token-usage-projection-validations?status=passed&limit=5`);
  assert.equal(tokenUsageProjectionValidations.collection, "token_usage_projection_validations");
  assert.ok(tokenUsageProjectionValidations.count <= 5);

  const observabilityTraceProjections = await fetchJson(`${url}/api/observability-trace-projections?observability_trace_projection_status=complete&limit=1`);
  assert.equal(observabilityTraceProjections.collection, "observability_trace_projections");
  assert.ok(observabilityTraceProjections.count <= 1);

  const completeTraceRecords = await fetchJson(`${url}/api/observability-trace-records?trace_component_status=complete&limit=5`);
  assert.equal(completeTraceRecords.collection, "observability_trace_records");
  assert.ok(completeTraceRecords.count <= 5);

  const knownWorkflowTraceBindings = await fetchJson(`${url}/api/workflow-trace-bindings?binding_status=known&limit=5`);
  assert.equal(knownWorkflowTraceBindings.collection, "workflow_trace_bindings");
  assert.ok(knownWorkflowTraceBindings.count <= 5);

  const knownAgentTraceBindings = await fetchJson(`${url}/api/agent-trace-bindings?binding_status=known&limit=5`);
  assert.equal(knownAgentTraceBindings.collection, "agent_trace_bindings");
  assert.ok(knownAgentTraceBindings.count <= 5);

  const knownGateTraceBindings = await fetchJson(`${url}/api/gate-trace-bindings?binding_status=known&limit=5`);
  assert.equal(knownGateTraceBindings.collection, "gate_trace_bindings");
  assert.ok(knownGateTraceBindings.count <= 5);

  const knownOutputTraceBindings = await fetchJson(`${url}/api/output-trace-bindings?binding_status=known&limit=5`);
  assert.equal(knownOutputTraceBindings.collection, "output_trace_bindings");
  assert.ok(knownOutputTraceBindings.count <= 5);

  const observabilityTraceProjectionValidations = await fetchJson(`${url}/api/observability-trace-projection-validations?status=passed&limit=5`);
  assert.equal(observabilityTraceProjectionValidations.collection, "observability_trace_projection_validations");
  assert.ok(observabilityTraceProjectionValidations.count <= 5);

  const errorRetryLedgers = await fetchJson(`${url}/api/error-retry-ledgers?error_retry_ledger_status=complete&limit=1`);
  assert.equal(errorRetryLedgers.collection, "error_retry_ledgers");
  assert.ok(errorRetryLedgers.count <= 1);

  const blockingErrors = await fetchJson(`${url}/api/projected-error-records?failure_state=blocking_failure&limit=5`);
  assert.equal(blockingErrors.collection, "projected_error_records");
  assert.ok(blockingErrors.count <= 5);

  const retryRecords = await fetchJson(`${url}/api/retry-records?auto_retry_scheduled=false&limit=5`);
  assert.equal(retryRecords.collection, "retry_records");
  assert.ok(retryRecords.count <= 5);

  const timeoutRecords = await fetchJson(`${url}/api/timeout-records?timeout_state=not_timeout&limit=5`);
  assert.equal(timeoutRecords.collection, "timeout_records");
  assert.ok(timeoutRecords.count <= 5);

  const resumeStateRecords = await fetchJson(`${url}/api/resume-state-records?resume_blocked=true&limit=5`);
  assert.equal(resumeStateRecords.collection, "resume_state_records");
  assert.ok(resumeStateRecords.count <= 5);

  const errorRetryLedgerValidations = await fetchJson(`${url}/api/error-retry-ledger-validations?status=passed&limit=5`);
  assert.equal(errorRetryLedgerValidations.collection, "error_retry_ledger_validations");
  assert.ok(errorRetryLedgerValidations.count <= 5);

  const eventReplayHarnesses = await fetchJson(`${url}/api/event-replay-harnesses?event_replay_status=complete&limit=1`);
  assert.equal(eventReplayHarnesses.collection, "event_replay_harnesses");
  assert.ok(eventReplayHarnesses.count <= 1);

  const replayedEventStreams = await fetchJson(`${url}/api/replayed-event-streams?event_stream_replay_status=replayed&limit=5`);
  assert.equal(replayedEventStreams.collection, "replayed_event_streams");
  assert.ok(replayedEventStreams.count <= 5);

  const replayedRunSummaries = await fetchJson(`${url}/api/replayed-run-summaries?run_replay_status=replayed&limit=5`);
  assert.equal(replayedRunSummaries.collection, "replayed_run_summaries");
  assert.ok(replayedRunSummaries.count <= 5);

  const dashboardReplayProjections = await fetchJson(`${url}/api/dashboard-replay-projections?dashboard_projection_status=replayed&limit=1`);
  assert.equal(dashboardReplayProjections.collection, "dashboard_replay_projections");
  assert.ok(dashboardReplayProjections.count <= 1);

  const dashboardReplayMetrics = await fetchJson(`${url}/api/dashboard-replay-metrics?metric_status=matched&limit=5`);
  assert.equal(dashboardReplayMetrics.collection, "dashboard_replay_metrics");
  assert.ok(dashboardReplayMetrics.count <= 5);

  const eventReplayValidations = await fetchJson(`${url}/api/event-replay-validations?status=passed&limit=5`);
  assert.equal(eventReplayValidations.collection, "event_replay_validations");
  assert.ok(eventReplayValidations.count <= 5);

  const retentionArchiveLedgers = await fetchJson(`${url}/api/retention-archive-ledgers?retention_archive_status=complete&limit=1`);
  assert.equal(retentionArchiveLedgers.collection, "retention_archive_ledgers");
  assert.ok(retentionArchiveLedgers.count <= 1);

  const retentionPolicyRecords = await fetchJson(`${url}/api/retention-policy-records?retention_plane=event&limit=5`);
  assert.equal(retentionPolicyRecords.collection, "retention_policy_records");
  assert.ok(retentionPolicyRecords.count <= 5);

  const archiveCandidateRecords = await fetchJson(`${url}/api/archive-candidate-records?deletion_status=not_allowed&limit=5`);
  assert.equal(archiveCandidateRecords.collection, "archive_candidate_records");
  assert.ok(archiveCandidateRecords.count <= 5);

  const legalHoldBindings = await fetchJson(`${url}/api/legal-hold-bindings?hold_status=active&limit=5`);
  assert.equal(legalHoldBindings.collection, "legal_hold_bindings");
  assert.ok(legalHoldBindings.count <= 5);

  const retentionArchiveValidations = await fetchJson(`${url}/api/retention-archive-validations?status=passed&limit=5`);
  assert.equal(retentionArchiveValidations.collection, "retention_archive_validations");
  assert.ok(retentionArchiveValidations.count <= 5);

  const ledgerApiDashboards = await fetchJson(`${url}/api/ledger-api-dashboards?ledger_api_dashboard_status=complete&limit=1`);
  assert.equal(ledgerApiDashboards.collection, "ledger_api_dashboards");
  assert.ok(ledgerApiDashboards.count <= 1);

  const runLedgerDashboardPanels = await fetchJson(`${url}/api/ledger-dashboard-panels?ledger_domain=run&panel_status=passed&limit=5`);
  assert.equal(runLedgerDashboardPanels.collection, "ledger_dashboard_panels");
  assert.ok(runLedgerDashboardPanels.count <= 5);

  const eventLedgerApiRouteRecords = await fetchJson(`${url}/api/ledger-api-route-records?ledger_domain=event&route_status=declared&limit=5`);
  assert.equal(eventLedgerApiRouteRecords.collection, "ledger_api_route_records");
  assert.ok(eventLedgerApiRouteRecords.count <= 5);

  const ledgerPanelMetrics = await fetchJson(`${url}/api/ledger-panel-metrics?metric_status=present&limit=5`);
  assert.equal(ledgerPanelMetrics.collection, "ledger_panel_metrics");
  assert.ok(ledgerPanelMetrics.count <= 5);

  const ledgerCrossLinks = await fetchJson(`${url}/api/ledger-cross-links?link_status=linked&limit=5`);
  assert.equal(ledgerCrossLinks.collection, "ledger_cross_links");
  assert.ok(ledgerCrossLinks.count <= 5);

  const ledgerApiDashboardValidations = await fetchJson(`${url}/api/ledger-api-dashboard-validations?status=passed&limit=5`);
  assert.equal(ledgerApiDashboardValidations.collection, "ledger_api_dashboard_validations");
  assert.ok(ledgerApiDashboardValidations.count <= 5);

  const ledgerGoldenFixtures = await fetchJson(`${url}/api/ledger-golden-fixtures?ledger_golden_fixture_status=complete&limit=1`);
  assert.equal(ledgerGoldenFixtures.collection, "ledger_golden_fixtures");
  assert.ok(ledgerGoldenFixtures.count <= 1);

  const ledgerGoldenCases = await fetchJson(`${url}/api/ledger-golden-cases?case_status=locked&limit=5`);
  assert.equal(ledgerGoldenCases.collection, "ledger_golden_cases");
  assert.ok(ledgerGoldenCases.count <= 5);

  const ledgerFixtureMatrix = await fetchJson(`${url}/api/ledger-fixture-matrix?limit=1`);
  assert.equal(ledgerFixtureMatrix.collection, "ledger_fixture_matrix");
  assert.ok(ledgerFixtureMatrix.count <= 1);

  const ledgerRegressionHashes = await fetchJson(`${url}/api/ledger-regression-hashes?lock_status=locked&limit=5`);
  assert.equal(ledgerRegressionHashes.collection, "ledger_regression_hashes");
  assert.ok(ledgerRegressionHashes.count <= 5);

  const ledgerGoldenValidations = await fetchJson(`${url}/api/ledger-golden-validations?status=passed&limit=5`);
  assert.equal(ledgerGoldenValidations.collection, "ledger_golden_validations");
  assert.ok(ledgerGoldenValidations.count <= 5);

  const observabilityFreezes = await fetchJson(`${url}/api/observability-freezes?observability_freeze_status=complete&limit=1`);
  assert.equal(observabilityFreezes.collection, "observability_freezes");
  assert.ok(observabilityFreezes.count <= 1);

  const observabilityFreezeSources = await fetchJson(`${url}/api/observability-freeze-sources?source_status=passed&limit=5`);
  assert.equal(observabilityFreezeSources.collection, "observability_freeze_sources");
  assert.ok(observabilityFreezeSources.count <= 5);

  const observabilityFreezeCheckpoints = await fetchJson(`${url}/api/observability-freeze-checkpoints?checkpoint_status=passed&limit=5`);
  assert.equal(observabilityFreezeCheckpoints.collection, "observability_freeze_checkpoints");
  assert.ok(observabilityFreezeCheckpoints.count <= 5);

  const observabilityFreezeTraces = await fetchJson(`${url}/api/observability-freeze-traces?trace_status=complete&limit=5`);
  assert.equal(observabilityFreezeTraces.collection, "observability_freeze_traces");
  assert.ok(observabilityFreezeTraces.count <= 5);

  const observabilityFreezeLoopBindings = await fetchJson(`${url}/api/observability-freeze-loop-bindings?loop_binding_status=passed&limit=5`);
  assert.equal(observabilityFreezeLoopBindings.collection, "observability_freeze_loop_bindings");
  assert.ok(observabilityFreezeLoopBindings.count <= 5);

  const observabilityFreezeValidations = await fetchJson(`${url}/api/observability-freeze-validations?status=passed&limit=5`);
  assert.equal(observabilityFreezeValidations.collection, "observability_freeze_validations");
  assert.ok(observabilityFreezeValidations.count <= 5);

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

  const resourceStoreInterfaces = await fetchJson(`${url}/api/resource-store-interfaces?resource_store_interface_status=complete&limit=1`);
  assert.equal(resourceStoreInterfaces.collection, "resource_store_interfaces");
  assert.ok(resourceStoreInterfaces.count <= 1);

  const resourceStoreRecords = await fetchJson(`${url}/api/resource-store-records?collection_id=resource_store&limit=5`);
  assert.equal(resourceStoreRecords.collection, "resource_store_records");
  assert.ok(resourceStoreRecords.count <= 5);

  const resourceVersionStoreRecords = await fetchJson(`${url}/api/resource-version-store-records?collection_id=resource_version_store&limit=5`);
  assert.equal(resourceVersionStoreRecords.collection, "resource_version_store_records");
  assert.ok(resourceVersionStoreRecords.count <= 5);

  const resourceStoreAdapterBindings = await fetchJson(`${url}/api/resource-store-adapter-bindings?interface_contract_id=resource-store-interface.v1&limit=5`);
  assert.equal(resourceStoreAdapterBindings.collection, "resource_store_adapter_bindings");
  assert.ok(resourceStoreAdapterBindings.count <= 5);

  const resourceStoreValidations = await fetchJson(`${url}/api/resource-store-validations?status=passed&limit=5`);
  assert.equal(resourceStoreValidations.collection, "resource_store_validations");
  assert.ok(resourceStoreValidations.count <= 5);

  const immutableObjectStoreLayouts = await fetchJson(`${url}/api/immutable-object-store-layouts?object_store_layout_status=complete&limit=1`);
  assert.equal(immutableObjectStoreLayouts.collection, "immutable_object_store_layouts");
  assert.ok(immutableObjectStoreLayouts.count <= 1);

  const objectPathResolvers = await fetchJson(`${url}/api/object-path-resolvers?overwrite_policy=forbidden&limit=5`);
  assert.equal(objectPathResolvers.collection, "object_path_resolvers");
  assert.ok(objectPathResolvers.count <= 5);

  const rawSourceObjectPaths = await fetchJson(`${url}/api/raw-source-object-paths?namespace=raw-source&limit=5`);
  assert.equal(rawSourceObjectPaths.collection, "raw_source_object_paths");
  assert.ok(rawSourceObjectPaths.count <= 5);

  const generatedOutputObjectPaths = await fetchJson(`${url}/api/generated-output-object-paths?namespace=generated-output&limit=5`);
  assert.equal(generatedOutputObjectPaths.collection, "generated_output_object_paths");
  assert.ok(generatedOutputObjectPaths.count <= 5);

  const objectStoreCollisions = await fetchJson(`${url}/api/object-store-collisions?limit=5`);
  assert.equal(objectStoreCollisions.collection, "object_store_collisions");
  assert.ok(objectStoreCollisions.count <= 5);

  const objectStoreLayoutValidations = await fetchJson(`${url}/api/object-store-layout-validations?status=passed&limit=5`);
  assert.equal(objectStoreLayoutValidations.collection, "object_store_layout_validations");
  assert.ok(objectStoreLayoutValidations.count <= 5);

  const resourceVersionLedgers = await fetchJson(`${url}/api/resource-version-ledgers?resource_version_ledger_status=complete&limit=1`);
  assert.equal(resourceVersionLedgers.collection, "resource_version_ledgers");
  assert.ok(resourceVersionLedgers.count <= 1);

  const resourceVersionFamilies = await fetchJson(`${url}/api/resource-version-families?limit=5`);
  assert.equal(resourceVersionFamilies.collection, "resource_version_families");
  assert.ok(resourceVersionFamilies.count <= 5);

  const resourceVersionEvents = await fetchJson(`${url}/api/resource-version-events?event_type=version_recorded&limit=5`);
  assert.equal(resourceVersionEvents.collection, "resource_version_events");
  assert.ok(resourceVersionEvents.count <= 5);

  const resourceVersionTransitions = await fetchJson(`${url}/api/resource-version-transitions?limit=5`);
  assert.equal(resourceVersionTransitions.collection, "resource_version_transitions");
  assert.ok(resourceVersionTransitions.count <= 5);

  const resourceDuplicateCandidates = await fetchJson(`${url}/api/resource-duplicate-candidates?limit=5`);
  assert.equal(resourceDuplicateCandidates.collection, "resource_duplicate_candidates");
  assert.ok(resourceDuplicateCandidates.count <= 5);

  const resourceVersionObjectBindings = await fetchJson(`${url}/api/resource-version-object-bindings?binding_status=bound&limit=5`);
  assert.equal(resourceVersionObjectBindings.collection, "resource_version_object_bindings");
  assert.ok(resourceVersionObjectBindings.count <= 5);

  const resourceVersionLedgerValidations = await fetchJson(`${url}/api/resource-version-ledger-validations?status=passed&limit=5`);
  assert.equal(resourceVersionLedgerValidations.collection, "resource_version_ledger_validations");
  assert.ok(resourceVersionLedgerValidations.count <= 5);

  const resourceDedupHashLedgers = await fetchJson(`${url}/api/resource-dedup-hash-ledgers?resource_dedup_hash_status=complete&limit=1`);
  assert.equal(resourceDedupHashLedgers.collection, "resource_dedup_hash_ledgers");
  assert.ok(resourceDedupHashLedgers.count <= 1);

  const resourceHashGroups = await fetchJson(`${url}/api/resource-hash-groups?group_status=unique_content_hash&limit=5`);
  assert.equal(resourceHashGroups.collection, "resource_hash_groups");
  assert.ok(resourceHashGroups.count <= 5);

  const resourceExternalIdGroups = await fetchJson(`${url}/api/resource-external-id-groups?group_status=singleton_external_id&limit=5`);
  assert.equal(resourceExternalIdGroups.collection, "resource_external_id_groups");
  assert.ok(resourceExternalIdGroups.count <= 5);

  const resourceDedupDecisions = await fetchJson(`${url}/api/resource-dedup-decisions?decision_scope=resource_version&limit=5`);
  assert.equal(resourceDedupDecisions.collection, "resource_dedup_decisions");
  assert.ok(resourceDedupDecisions.count <= 5);

  const resourceDuplicateCandidateLinks = await fetchJson(`${url}/api/resource-duplicate-candidate-links?limit=5`);
  assert.equal(resourceDuplicateCandidateLinks.collection, "resource_duplicate_candidate_links");
  assert.ok(resourceDuplicateCandidateLinks.count <= 5);

  const resourceHashIntegrityChecks = await fetchJson(`${url}/api/resource-hash-integrity-checks?integrity_status=passed&limit=5`);
  assert.equal(resourceHashIntegrityChecks.collection, "resource_hash_integrity_checks");
  assert.ok(resourceHashIntegrityChecks.count <= 5);

  const resourceDedupHashValidations = await fetchJson(`${url}/api/resource-dedup-hash-validations?status=passed&limit=5`);
  assert.equal(resourceDedupHashValidations.collection, "resource_dedup_hash_validations");
  assert.ok(resourceDedupHashValidations.count <= 5);

  const resourceQuarantineModels = await fetchJson(`${url}/api/resource-quarantine-models?resource_quarantine_status=complete&limit=1`);
  assert.equal(resourceQuarantineModels.collection, "resource_quarantine_models");
  assert.ok(resourceQuarantineModels.count <= 1);

  const resourceQuarantineRules = await fetchJson(`${url}/api/resource-quarantine-rules?category=sensitive_data&limit=5`);
  assert.equal(resourceQuarantineRules.collection, "resource_quarantine_rules");
  assert.ok(resourceQuarantineRules.count <= 5);

  const resourceQuarantineItems = await fetchJson(`${url}/api/resource-quarantine-items?quarantine_item_status=held_for_human_review&limit=5`);
  assert.equal(resourceQuarantineItems.collection, "resource_quarantine_items");
  assert.ok(resourceQuarantineItems.count <= 5);

  const resourceQuarantineReviewQueue = await fetchJson(`${url}/api/resource-quarantine-review-queue?review_status=pending_human_review&limit=5`);
  assert.equal(resourceQuarantineReviewQueue.collection, "resource_quarantine_review_queue");
  assert.ok(resourceQuarantineReviewQueue.count <= 5);

  const resourceQuarantineValidations = await fetchJson(`${url}/api/resource-quarantine-validations?status=passed&limit=5`);
  assert.equal(resourceQuarantineValidations.collection, "resource_quarantine_validations");
  assert.ok(resourceQuarantineValidations.count <= 5);

  const normalizedTextContracts = await fetchJson(`${url}/api/normalized-text-contracts?normalized_text_contract_status=complete&limit=1`);
  assert.equal(normalizedTextContracts.collection, "normalized_text_contracts");
  assert.ok(normalizedTextContracts.count <= 1);

  const normalizedTextArtifacts = await fetchJson(`${url}/api/normalized-text-artifacts?offset_unit=utf16_code_unit&limit=5`);
  assert.equal(normalizedTextArtifacts.collection, "normalized_text_artifacts");
  assert.ok(normalizedTextArtifacts.count <= 5);

  const normalizedTextLocationMaps = await fetchJson(`${url}/api/normalized-text-location-maps?offset_unit=utf16_code_unit&limit=5`);
  assert.equal(normalizedTextLocationMaps.collection, "normalized_text_location_maps");
  assert.ok(normalizedTextLocationMaps.count <= 5);

  const normalizedSourceSpanSeeds = await fetchJson(`${url}/api/normalized-source-span-seeds?seed_status=ready&limit=5`);
  assert.equal(normalizedSourceSpanSeeds.collection, "normalized_source_span_seeds");
  assert.ok(normalizedSourceSpanSeeds.count <= 5);

  const normalizedTextValidations = await fetchJson(`${url}/api/normalized-text-validations?status=passed&limit=5`);
  assert.equal(normalizedTextValidations.collection, "normalized_text_validations");
  assert.ok(normalizedTextValidations.count <= 5);

  const extractorAdapterContracts = await fetchJson(`${url}/api/extractor-adapter-contracts?extractor_adapter_contract_status=complete&limit=1`);
  assert.equal(extractorAdapterContracts.collection, "extractor_adapter_contracts");
  assert.ok(extractorAdapterContracts.count <= 1);

  const extractorAdapters = await fetchJson(`${url}/api/extractor-adapters?execution_boundary=local_deterministic&limit=5`);
  assert.equal(extractorAdapters.collection, "extractor_adapters");
  assert.ok(extractorAdapters.count <= 5);

  const extractorIoContracts = await fetchJson(`${url}/api/extractor-io-contracts?offset_unit=utf16_code_unit&limit=5`);
  assert.equal(extractorIoContracts.collection, "extractor_io_contracts");
  assert.ok(extractorIoContracts.count <= 5);

  const extractorDocumentTypeBindings = await fetchJson(`${url}/api/extractor-document-type-bindings?binding_status=active&limit=5`);
  assert.equal(extractorDocumentTypeBindings.collection, "extractor_document_type_bindings");
  assert.ok(extractorDocumentTypeBindings.count <= 5);

  const ocrFallbackPolicies = await fetchJson(`${url}/api/ocr-fallback-policies?external_service_allowed=false&limit=5`);
  assert.equal(ocrFallbackPolicies.collection, "ocr_fallback_policies");
  assert.ok(ocrFallbackPolicies.count <= 5);

  const extractorNormalizedTextBindings = await fetchJson(`${url}/api/extractor-normalized-text-bindings?binding_status=bound&limit=5`);
  assert.equal(extractorNormalizedTextBindings.collection, "extractor_normalized_text_bindings");
  assert.ok(extractorNormalizedTextBindings.count <= 5);

  const extractorAdapterValidations = await fetchJson(`${url}/api/extractor-adapter-validations?status=passed&limit=5`);
  assert.equal(extractorAdapterValidations.collection, "extractor_adapter_validations");
  assert.ok(extractorAdapterValidations.count <= 5);

  const sourceSpanStores = await fetchJson(`${url}/api/source-span-stores?source_span_store_status=complete&limit=1`);
  assert.equal(sourceSpanStores.collection, "source_span_stores");
  assert.ok(sourceSpanStores.count <= 1);

  const sourceSpans = await fetchJson(`${url}/api/source-spans?location_type=page&limit=5`);
  assert.equal(sourceSpans.collection, "source_spans");
  assert.ok(sourceSpans.count <= 5);

  const sourceSpanLocators = await fetchJson(`${url}/api/source-span-locators?offset_unit=utf16_code_unit&limit=5`);
  assert.equal(sourceSpanLocators.collection, "source_span_locators");
  assert.ok(sourceSpanLocators.count <= 5);

  const sourceSpanLocationUnits = await fetchJson(`${url}/api/source-span-location-units?timestamp_status=not_applicable&limit=5`);
  assert.equal(sourceSpanLocationUnits.collection, "source_span_location_units");
  assert.ok(sourceSpanLocationUnits.count <= 5);

  const sourceSpanIndexes = await fetchJson(`${url}/api/source-span-indexes?schema_version=source-span-indexes.v1&limit=1`);
  assert.equal(sourceSpanIndexes.collection, "source_span_indexes");
  assert.ok(sourceSpanIndexes.count <= 1);

  const sourceSpanValidations = await fetchJson(`${url}/api/source-span-validations?status=passed&limit=5`);
  assert.equal(sourceSpanValidations.collection, "source_span_validations");
  assert.ok(sourceSpanValidations.count <= 5);

  const evidenceItemStores = await fetchJson(`${url}/api/evidence-item-stores?evidence_item_store_status=complete&limit=1`);
  assert.equal(evidenceItemStores.collection, "evidence_item_stores");
  assert.ok(evidenceItemStores.count <= 1);

  const evidenceItems = await fetchJson(`${url}/api/evidence-items?review_status=needs_review&limit=5`);
  assert.equal(evidenceItems.collection, "evidence_items");
  assert.ok(evidenceItems.count <= 5);

  const evidenceSourceSpanBindings = await fetchJson(`${url}/api/evidence-source-span-bindings?binding_status=bound&limit=5`);
  assert.equal(evidenceSourceSpanBindings.collection, "evidence_source_span_bindings");
  assert.ok(evidenceSourceSpanBindings.count <= 5);

  const evidenceReviewQueue = await fetchJson(`${url}/api/evidence-review-queue?review_required=true&limit=5`);
  assert.equal(evidenceReviewQueue.collection, "evidence_review_queue");
  assert.ok(evidenceReviewQueue.count <= 5);

  const evidenceItemIndexes = await fetchJson(`${url}/api/evidence-item-indexes?schema_version=evidence-item-indexes.v1&limit=1`);
  assert.equal(evidenceItemIndexes.collection, "evidence_item_indexes");
  assert.ok(evidenceItemIndexes.count <= 1);

  const evidenceItemStoreValidations = await fetchJson(`${url}/api/evidence-item-store-validations?status=passed&limit=5`);
  assert.equal(evidenceItemStoreValidations.collection, "evidence_item_store_validations");
  assert.ok(evidenceItemStoreValidations.count <= 5);

  const evidenceGoldenFixtures = await fetchJson(`${url}/api/evidence-golden-fixtures?evidence_golden_fixture_status=complete&limit=1`);
  assert.equal(evidenceGoldenFixtures.collection, "evidence_golden_fixtures");
  assert.ok(evidenceGoldenFixtures.count <= 1);

  const evidenceGoldenCases = await fetchJson(`${url}/api/evidence-golden-cases?case_status=locked&limit=5`);
  assert.equal(evidenceGoldenCases.collection, "evidence_golden_cases");
  assert.ok(evidenceGoldenCases.count <= 5);

  const evidenceGoldenStoreMatches = await fetchJson(`${url}/api/evidence-golden-store-matches?match_status=matched&limit=5`);
  assert.equal(evidenceGoldenStoreMatches.collection, "evidence_golden_store_matches");
  assert.ok(evidenceGoldenStoreMatches.count <= 5);

  const evidenceRegressionTests = await fetchJson(`${url}/api/evidence-regression-tests?evidence_regression_status=complete&limit=1`);
  assert.equal(evidenceRegressionTests.collection, "evidence_regression_tests");
  assert.ok(evidenceRegressionTests.count <= 1);

  const evidenceRegressionSuites = await fetchJson(`${url}/api/evidence-regression-suites?suite_status=passed&limit=5`);
  assert.equal(evidenceRegressionSuites.collection, "evidence_regression_suites");
  assert.ok(evidenceRegressionSuites.count <= 5);

  const evidenceRegressionCases = await fetchJson(`${url}/api/evidence-regression-test-cases?status=passed&limit=5`);
  assert.equal(evidenceRegressionCases.collection, "evidence_regression_test_cases");
  assert.ok(evidenceRegressionCases.count <= 5);

  const evidenceRegressionHashes = await fetchJson(`${url}/api/evidence-regression-hashes?locked=true&limit=5`);
  assert.equal(evidenceRegressionHashes.collection, "evidence_regression_hashes");
  assert.ok(evidenceRegressionHashes.count <= 5);

  const evidenceRegressionValidations = await fetchJson(`${url}/api/evidence-regression-validations?status=passed&limit=5`);
  assert.equal(evidenceRegressionValidations.collection, "evidence_regression_validations");
  assert.ok(evidenceRegressionValidations.count <= 5);

  const resourceEvidenceDashboardSummaries = await fetchJson(`${url}/api/resource-evidence-dashboard-summaries?resource_evidence_dashboard_status=complete&limit=1`);
  assert.equal(resourceEvidenceDashboardSummaries.collection, "resource_evidence_dashboard_summaries");
  assert.ok(resourceEvidenceDashboardSummaries.count <= 1);

  const resourceEvidencePanelRows = await fetchJson(`${url}/api/resource-evidence-panel-rows?panel_status=ready&limit=5`);
  assert.equal(resourceEvidencePanelRows.collection, "resource_evidence_panel_rows");
  assert.ok(resourceEvidencePanelRows.count <= 5);

  const resourceEvidenceMatterRollups = await fetchJson(`${url}/api/resource-evidence-matter-rollups?rollup_status=review_required&limit=5`);
  assert.equal(resourceEvidenceMatterRollups.collection, "resource_evidence_matter_rollups");
  assert.ok(resourceEvidenceMatterRollups.count <= 5);

  const resourceEvidenceClassificationRollups = await fetchJson(`${url}/api/resource-evidence-classification-rollups?rollup_status=review_required&limit=5`);
  assert.equal(resourceEvidenceClassificationRollups.collection, "resource_evidence_classification_rollups");
  assert.ok(resourceEvidenceClassificationRollups.count <= 5);

  const resourceEvidenceDashboardValidations = await fetchJson(`${url}/api/resource-evidence-dashboard-validations?status=passed&limit=5`);
  assert.equal(resourceEvidenceDashboardValidations.collection, "resource_evidence_dashboard_validations");
  assert.ok(resourceEvidenceDashboardValidations.count <= 5);

  const evidencePlaneFreezes = await fetchJson(`${url}/api/evidence-plane-freezes?evidence_plane_freeze_status=frozen_with_pending_human_actions&limit=1`);
  assert.equal(evidencePlaneFreezes.collection, "evidence_plane_freezes");
  assert.ok(evidencePlaneFreezes.count <= 1);

  const evidencePlaneFreezeSources = await fetchJson(`${url}/api/evidence-plane-freeze-sources?source_status=passed&limit=5`);
  assert.equal(evidencePlaneFreezeSources.collection, "evidence_plane_freeze_sources");
  assert.ok(evidencePlaneFreezeSources.count <= 5);

  const evidencePlaneFreezeCheckpoints = await fetchJson(`${url}/api/evidence-plane-freeze-checkpoints?checkpoint_status=passed&limit=5`);
  assert.equal(evidencePlaneFreezeCheckpoints.collection, "evidence_plane_freeze_checkpoints");
  assert.ok(evidencePlaneFreezeCheckpoints.count <= 5);

  const evidencePlaneRepresentativeTraces = await fetchJson(`${url}/api/evidence-plane-representative-traces?trace_status=complete&limit=5`);
  assert.equal(evidencePlaneRepresentativeTraces.collection, "evidence_plane_representative_traces");
  assert.ok(evidencePlaneRepresentativeTraces.count <= 5);

  const evidencePlaneFreezeValidations = await fetchJson(`${url}/api/evidence-plane-freeze-validations?checkpoint_status=passed&limit=5`);
  assert.equal(evidencePlaneFreezeValidations.collection, "evidence_plane_freeze_validations");
  assert.ok(evidencePlaneFreezeValidations.count <= 5);

  const evidenceGoldenValidations = await fetchJson(`${url}/api/evidence-golden-validations?status=passed&limit=5`);
  assert.equal(evidenceGoldenValidations.collection, "evidence_golden_validations");
  assert.ok(evidenceGoldenValidations.count <= 5);

  const factClaimStores = await fetchJson(`${url}/api/fact-claim-stores?fact_claim_store_status=complete&limit=1`);
  assert.equal(factClaimStores.collection, "fact_claim_stores");
  assert.ok(factClaimStores.count <= 1);

  const factClaims = await fetchJson(`${url}/api/fact-claims?review_status=needs_review&limit=5`);
  assert.equal(factClaims.collection, "fact_claims");
  assert.ok(factClaims.count <= 5);

  const factEvidenceBindings = await fetchJson(`${url}/api/fact-evidence-bindings?binding_status=bound&limit=5`);
  assert.equal(factEvidenceBindings.collection, "fact_evidence_bindings");
  assert.ok(factEvidenceBindings.count <= 5);

  const factReviewQueue = await fetchJson(`${url}/api/fact-review-queue?review_required=true&limit=5`);
  assert.equal(factReviewQueue.collection, "fact_review_queue");
  assert.ok(factReviewQueue.count <= 5);

  const factClaimIndexes = await fetchJson(`${url}/api/fact-claim-indexes?schema_version=fact-claim-indexes.v1&limit=1`);
  assert.equal(factClaimIndexes.collection, "fact_claim_indexes");
  assert.ok(factClaimIndexes.count <= 1);

  const factClaimStoreValidations = await fetchJson(`${url}/api/fact-claim-store-validations?status=passed&limit=5`);
  assert.equal(factClaimStoreValidations.collection, "fact_claim_store_validations");
  assert.ok(factClaimStoreValidations.count <= 5);

  const issueGraphStores = await fetchJson(`${url}/api/issue-graph-stores?issue_graph_store_status=complete&limit=1`);
  assert.equal(issueGraphStores.collection, "issue_graph_stores");
  assert.ok(issueGraphStores.count <= 1);

  const issues = await fetchJson(`${url}/api/issues?review_status=needs_review&limit=5`);
  assert.equal(issues.collection, "issues");
  assert.ok(issues.count <= 5);

  const factIssueBindings = await fetchJson(`${url}/api/fact-issue-bindings?binding_status=bound&limit=5`);
  assert.equal(factIssueBindings.collection, "fact_issue_bindings");
  assert.ok(factIssueBindings.count <= 5);

  const legalRules = await fetchJson(`${url}/api/legal-rules?human_review_required=true&limit=5`);
  assert.equal(legalRules.collection, "legal_rules");
  assert.ok(legalRules.count <= 5);

  const issueLegalRuleBindings = await fetchJson(`${url}/api/issue-legal-rule-bindings?verification_status=requires_attorney_confirmation&limit=5`);
  assert.equal(issueLegalRuleBindings.collection, "issue_legal_rule_bindings");
  assert.ok(issueLegalRuleBindings.count <= 5);

  const riskSeverityAssessments = await fetchJson(`${url}/api/risk-severity-assessments?review_status=needs_review&limit=5`);
  assert.equal(riskSeverityAssessments.collection, "risk_severity_assessments");
  assert.ok(riskSeverityAssessments.count <= 5);

  const issueReviewQueue = await fetchJson(`${url}/api/issue-review-queue?review_required=true&limit=5`);
  assert.equal(issueReviewQueue.collection, "issue_review_queue");
  assert.ok(issueReviewQueue.count <= 5);

  const issueGraphIndexes = await fetchJson(`${url}/api/issue-graph-indexes?schema_version=issue-graph-indexes.v1&limit=1`);
  assert.equal(issueGraphIndexes.collection, "issue_graph_indexes");
  assert.ok(issueGraphIndexes.count <= 1);

  const issueGraphStoreValidations = await fetchJson(`${url}/api/issue-graph-store-validations?status=passed&limit=5`);
  assert.equal(issueGraphStoreValidations.collection, "issue_graph_store_validations");
  assert.ok(issueGraphStoreValidations.count <= 5);

  const citationObjectStores = await fetchJson(`${url}/api/citation-object-stores?citation_object_store_status=complete&limit=1`);
  assert.equal(citationObjectStores.collection, "citation_object_stores");
  assert.ok(citationObjectStores.count <= 1);

  const outputParagraphs = await fetchJson(`${url}/api/output-paragraphs?client_facing_status=not_client_facing&limit=5`);
  assert.equal(outputParagraphs.collection, "output_paragraphs");
  assert.ok(outputParagraphs.count <= 5);

  const citations = await fetchJson(`${url}/api/citations?citation_status=needs_review&limit=5`);
  assert.equal(citations.collection, "citations");
  assert.ok(citations.count <= 5);

  const paragraphSourceBindings = await fetchJson(`${url}/api/paragraph-source-bindings?binding_status=bound&limit=5`);
  assert.equal(paragraphSourceBindings.collection, "paragraph_source_bindings");
  assert.ok(paragraphSourceBindings.count <= 5);

  const citationReviewQueue = await fetchJson(`${url}/api/citation-review-queue?review_required=true&limit=5`);
  assert.equal(citationReviewQueue.collection, "citation_review_queue");
  assert.ok(citationReviewQueue.count <= 5);

  const citationIndexes = await fetchJson(`${url}/api/citation-indexes?schema_version=citation-indexes.v1&limit=1`);
  assert.equal(citationIndexes.collection, "citation_indexes");
  assert.ok(citationIndexes.count <= 1);

  const citationObjectStoreValidations = await fetchJson(`${url}/api/citation-object-store-validations?status=passed&limit=5`);
  assert.equal(citationObjectStoreValidations.collection, "citation_object_store_validations");
  assert.ok(citationObjectStoreValidations.count <= 5);

  const lineageGraphArtifacts = await fetchJson(`${url}/api/lineage-graphs?lineage_graph_status=complete&limit=1`);
  assert.equal(lineageGraphArtifacts.collection, "lineage_graphs");
  assert.ok(lineageGraphArtifacts.count <= 1);

  const lineageGraphNodes = await fetchJson(`${url}/api/lineage-nodes?node_type=source_span&limit=5`);
  assert.equal(lineageGraphNodes.collection, "lineage_nodes");
  assert.ok(lineageGraphNodes.count <= 5);

  const lineageGraphEdges = await fetchJson(`${url}/api/lineage-edges?edge_type=source_span_cited_by_output&limit=5`);
  assert.equal(lineageGraphEdges.collection, "lineage_edges");
  assert.ok(lineageGraphEdges.count <= 5);

  const lineageGraphPaths = await fetchJson(`${url}/api/lineage-paths?path_status=complete&limit=5`);
  assert.equal(lineageGraphPaths.collection, "lineage_paths");
  assert.ok(lineageGraphPaths.count <= 5);

  const lineageGraphIndexes = await fetchJson(`${url}/api/lineage-indexes?schema_version=lineage-indexes.v1&limit=1`);
  assert.equal(lineageGraphIndexes.collection, "lineage_indexes");
  assert.ok(lineageGraphIndexes.count <= 1);

  const lineageGraphValidations = await fetchJson(`${url}/api/lineage-graph-validations?status=passed&limit=5`);
  assert.equal(lineageGraphValidations.collection, "lineage_graph_validations");
  assert.ok(lineageGraphValidations.count <= 5);

  const evidenceViewerData = await fetchJson(`${url}/api/evidence-viewer-data?evidence_viewer_data_status=complete&limit=1`);
  assert.equal(evidenceViewerData.collection, "evidence_viewer_data");
  assert.ok(evidenceViewerData.count <= 1);

  const evidenceViewerCards = await fetchJson(`${url}/api/evidence-viewer-cards?review_status=needs_review&limit=5`);
  assert.equal(evidenceViewerCards.collection, "evidence_viewer_cards");
  assert.ok(evidenceViewerCards.count <= 5);

  const evidenceViewerSourceSpans = await fetchJson(`${url}/api/evidence-viewer-source-spans?binding_status=bound&limit=5`);
  assert.equal(evidenceViewerSourceSpans.collection, "evidence_viewer_source_spans");
  assert.ok(evidenceViewerSourceSpans.count <= 5);

  const evidenceViewerLineagePaths = await fetchJson(`${url}/api/evidence-viewer-lineage-paths?path_status=complete&limit=5`);
  assert.equal(evidenceViewerLineagePaths.collection, "evidence_viewer_lineage_paths");
  assert.ok(evidenceViewerLineagePaths.count <= 5);

  const evidenceViewerDataValidations = await fetchJson(`${url}/api/evidence-viewer-data-validations?status=passed&limit=5`);
  assert.equal(evidenceViewerDataValidations.collection, "evidence_viewer_data_validations");
  assert.ok(evidenceViewerDataValidations.count <= 5);

  const evidenceExportBundles = await fetchJson(`${url}/api/evidence-export-bundles?evidence_export_bundle_status=complete&limit=1`);
  assert.equal(evidenceExportBundles.collection, "evidence_export_bundles");
  assert.ok(evidenceExportBundles.count <= 1);

  const evidenceExportBundleRecords = await fetchJson(`${url}/api/evidence-export-bundle-records?export_status=internal_review_only&limit=5`);
  assert.equal(evidenceExportBundleRecords.collection, "evidence_export_bundle_records");
  assert.ok(evidenceExportBundleRecords.count <= 5);

  const evidenceExportSourcePackages = await fetchJson(`${url}/api/evidence-export-source-packages?package_status=bound&limit=5`);
  assert.equal(evidenceExportSourcePackages.collection, "evidence_export_source_packages");
  assert.ok(evidenceExportSourcePackages.count <= 5);

  const evidenceExportCitationPackages = await fetchJson(`${url}/api/evidence-export-citation-packages?package_status=bound&limit=5`);
  assert.equal(evidenceExportCitationPackages.collection, "evidence_export_citation_packages");
  assert.ok(evidenceExportCitationPackages.count <= 5);

  const evidenceExportCoveragePackages = await fetchJson(`${url}/api/evidence-export-coverage-packages?package_status=bound&limit=5`);
  assert.equal(evidenceExportCoveragePackages.collection, "evidence_export_coverage_packages");
  assert.ok(evidenceExportCoveragePackages.count <= 5);

  const evidenceExportBundleValidations = await fetchJson(`${url}/api/evidence-export-bundle-validations?status=passed&limit=5`);
  assert.equal(evidenceExportBundleValidations.collection, "evidence_export_bundle_validations");
  assert.ok(evidenceExportBundleValidations.count <= 5);

  const evidenceCoverageScores = await fetchJson(`${url}/api/evidence-coverage-scores?evidence_coverage_status=complete&limit=1`);
  assert.equal(evidenceCoverageScores.collection, "evidence_coverage_scores");
  assert.ok(evidenceCoverageScores.count <= 1);

  const evidenceCoverageRecords = await fetchJson(`${url}/api/evidence-coverage-records?review_status=needs_review&limit=5`);
  assert.equal(evidenceCoverageRecords.collection, "evidence_coverage_records");
  assert.ok(evidenceCoverageRecords.count <= 5);

  const evidenceCoverageDimensions = await fetchJson(`${url}/api/evidence-coverage-dimensions?dimension=legal_basis&limit=5`);
  assert.equal(evidenceCoverageDimensions.collection, "evidence_coverage_dimensions");
  assert.ok(evidenceCoverageDimensions.count <= 5);

  const evidenceCoverageIndexes = await fetchJson(`${url}/api/evidence-coverage-indexes?schema_version=coverage-indexes.v1&limit=1`);
  assert.equal(evidenceCoverageIndexes.collection, "evidence_coverage_indexes");
  assert.ok(evidenceCoverageIndexes.count <= 1);

  const evidenceCoverageValidations = await fetchJson(`${url}/api/evidence-coverage-validations?status=passed&limit=5`);
  assert.equal(evidenceCoverageValidations.collection, "evidence_coverage_validations");
  assert.ok(evidenceCoverageValidations.count <= 5);

  const evidenceFlags = await fetchJson(`${url}/api/evidence-flags?evidence_flags_status=complete&limit=1`);
  assert.equal(evidenceFlags.collection, "evidence_flags");
  assert.ok(evidenceFlags.count <= 1);

  const evidenceFlagRecords = await fetchJson(`${url}/api/evidence-flag-records?review_status=needs_review&limit=5`);
  assert.equal(evidenceFlagRecords.collection, "evidence_flag_records");
  assert.ok(evidenceFlagRecords.count <= 5);

  const evidenceFlagDecisions = await fetchJson(`${url}/api/evidence-flag-decisions?flag_type=redaction&limit=5`);
  assert.equal(evidenceFlagDecisions.collection, "evidence_flag_decisions");
  assert.ok(evidenceFlagDecisions.count <= 5);

  const evidenceFlagIndexes = await fetchJson(`${url}/api/evidence-flag-indexes?schema_version=evidence-flag-indexes.v1&limit=1`);
  assert.equal(evidenceFlagIndexes.collection, "evidence_flag_indexes");
  assert.ok(evidenceFlagIndexes.count <= 1);

  const evidenceFlagValidations = await fetchJson(`${url}/api/evidence-flag-validations?status=passed&limit=5`);
  assert.equal(evidenceFlagValidations.collection, "evidence_flag_validations");
  assert.ok(evidenceFlagValidations.count <= 5);

  const exhibitMaps = await fetchJson(`${url}/api/exhibit-maps?exhibit_map_status=complete&limit=1`);
  assert.equal(exhibitMaps.collection, "exhibit_maps");
  assert.ok(exhibitMaps.count <= 1);

  const exhibitRecords = await fetchJson(`${url}/api/exhibit-records?review_status=needs_review&limit=5`);
  assert.equal(exhibitRecords.collection, "exhibit_records");
  assert.ok(exhibitRecords.count <= 5);

  const exhibitBindings = await fetchJson(`${url}/api/exhibit-bindings?binding_type=exhibit_to_evidence&limit=5`);
  assert.equal(exhibitBindings.collection, "exhibit_bindings");
  assert.ok(exhibitBindings.count <= 5);

  const exhibitIndexes = await fetchJson(`${url}/api/exhibit-indexes?schema_version=exhibit-indexes.v1&limit=1`);
  assert.equal(exhibitIndexes.collection, "exhibit_indexes");
  assert.ok(exhibitIndexes.count <= 1);

  const exhibitMapValidations = await fetchJson(`${url}/api/exhibit-map-validations?status=passed&limit=5`);
  assert.equal(exhibitMapValidations.collection, "exhibit_map_validations");
  assert.ok(exhibitMapValidations.count <= 5);

  const custodyLedgers = await fetchJson(`${url}/api/custody-event-ledgers?custody_event_ledger_status=complete&limit=1`);
  assert.equal(custodyLedgers.collection, "custody_event_ledgers");
  assert.ok(custodyLedgers.count <= 1);

  const custodyEvents = await fetchJson(`${url}/api/custody-events?event_stage=approve&limit=5`);
  assert.equal(custodyEvents.collection, "custody_events");
  assert.ok(custodyEvents.count <= 5);

  const custodyEventLinks = await fetchJson(`${url}/api/custody-event-links?link_status=bound&limit=5`);
  assert.equal(custodyEventLinks.collection, "custody_event_links");
  assert.ok(custodyEventLinks.count <= 5);

  const custodyStageIndexes = await fetchJson(`${url}/api/custody-stage-indexes?schema_version=custody-stage-index.v1&limit=5`);
  assert.equal(custodyStageIndexes.collection, "custody_stage_indexes");
  assert.ok(custodyStageIndexes.count <= 5);

  const custodyEventValidations = await fetchJson(`${url}/api/custody-event-validations?status=passed&limit=5`);
  assert.equal(custodyEventValidations.collection, "custody_event_validations");
  assert.ok(custodyEventValidations.count <= 5);

  const searchIndexContracts = await fetchJson(`${url}/api/search-index-contracts?search_index_contract_status=complete&limit=1`);
  assert.equal(searchIndexContracts.collection, "search_index_contracts");
  assert.ok(searchIndexContracts.count <= 1);

  const searchIndexManifests = await fetchJson(`${url}/api/search-index-manifests?index_status=manifest_ready&limit=5`);
  assert.equal(searchIndexManifests.collection, "search_index_manifests");
  assert.ok(searchIndexManifests.count <= 5);

  const searchIndexFields = await fetchJson(`${url}/api/search-index-fields?field_role=required_filter&limit=5`);
  assert.equal(searchIndexFields.collection, "search_index_fields");
  assert.ok(searchIndexFields.count <= 5);

  const searchIndexQueryPlans = await fetchJson(`${url}/api/search-index-query-plans?query_status=held_for_retrieval_filter_compiler&limit=5`);
  assert.equal(searchIndexQueryPlans.collection, "search_index_query_plans");
  assert.ok(searchIndexQueryPlans.count <= 5);

  const searchIndexValidations = await fetchJson(`${url}/api/search-index-validations?status=passed&limit=5`);
  assert.equal(searchIndexValidations.collection, "search_index_validations");
  assert.ok(searchIndexValidations.count <= 5);

  const vectorIndexPolicies = await fetchJson(`${url}/api/vector-index-policies?vector_index_policy_boundary_status=complete&limit=1`);
  assert.equal(vectorIndexPolicies.collection, "vector_index_policies");
  assert.ok(vectorIndexPolicies.count <= 1);

  const vectorPolicyGates = await fetchJson(`${url}/api/vector-policy-gates?gate_status=held_for_vector_policy&limit=5`);
  assert.equal(vectorPolicyGates.collection, "vector_policy_gates");
  assert.ok(vectorPolicyGates.count <= 5);

  const embeddingRoutePolicies = await fetchJson(`${url}/api/embedding-route-policies?route_status=held_for_vector_policy&limit=5`);
  assert.equal(embeddingRoutePolicies.collection, "embedding_route_policies");
  assert.ok(embeddingRoutePolicies.count <= 5);

  const vectorPolicyValidations = await fetchJson(`${url}/api/vector-policy-validations?status=passed&limit=5`);
  assert.equal(vectorPolicyValidations.collection, "vector_policy_validations");
  assert.ok(vectorPolicyValidations.count <= 5);

  const retrievalFilterCompilers = await fetchJson(`${url}/api/retrieval-filter-compilers?retrieval_filter_compiler_status=complete&limit=1`);
  assert.equal(retrievalFilterCompilers.collection, "retrieval_filter_compilers");
  assert.ok(retrievalFilterCompilers.count <= 1);

  const compiledRetrievalFilters = await fetchJson(`${url}/api/compiled-retrieval-filters?filter_status=compiled&query_execution_allowed=false&limit=5`);
  assert.equal(compiledRetrievalFilters.collection, "compiled_retrieval_filters");
  assert.ok(compiledRetrievalFilters.count <= 5);

  const retrievalQueryBindings = await fetchJson(`${url}/api/retrieval-query-bindings?query_binding_status=compiled_held_for_query_adapter&query_execution_allowed=false&limit=5`);
  assert.equal(retrievalQueryBindings.collection, "retrieval_query_bindings");
  assert.ok(retrievalQueryBindings.count <= 5);

  const retrievalFilterProbes = await fetchJson(`${url}/api/retrieval-filter-probes?probe_status=blocked&limit=5`);
  assert.equal(retrievalFilterProbes.collection, "retrieval_filter_probes");
  assert.ok(retrievalFilterProbes.count <= 5);

  const retrievalFilterValidations = await fetchJson(`${url}/api/retrieval-filter-validations?status=passed&limit=5`);
  assert.equal(retrievalFilterValidations.collection, "retrieval_filter_validations");
  assert.ok(retrievalFilterValidations.count <= 5);

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

  const matterTaggingLedgers = await fetchJson(`${url}/api/matter-tagging-ledgers?matter_tagging_ledger_status=complete&limit=1`);
  assert.equal(matterTaggingLedgers.collection, "matter_tagging_ledgers");
  assert.ok(matterTaggingLedgers.count <= 1);

  const matterTaggingDecisions = await fetchJson(`${url}/api/matter-tagging-decisions?tagging_status=pending_human_confirmation&limit=5`);
  assert.equal(matterTaggingDecisions.collection, "matter_tagging_decisions");
  assert.ok(matterTaggingDecisions.count <= 5);

  const matterTaggingCandidates = await fetchJson(`${url}/api/matter-tagging-candidates?candidate_status=requires_human_confirmation&limit=5`);
  assert.equal(matterTaggingCandidates.collection, "matter_tagging_candidates");
  assert.ok(matterTaggingCandidates.count <= 5);

  const matterTaggingConfirmations = await fetchJson(`${url}/api/matter-tagging-confirmations?confirmation_status=pending&limit=5`);
  assert.equal(matterTaggingConfirmations.collection, "matter_tagging_confirmations");
  assert.ok(matterTaggingConfirmations.count <= 5);

  const matterTaggingCorrections = await fetchJson(`${url}/api/matter-tagging-corrections?limit=5`);
  assert.equal(matterTaggingCorrections.collection, "matter_tagging_corrections");
  assert.ok(matterTaggingCorrections.count <= 5);

  const matterTaggingValidations = await fetchJson(`${url}/api/matter-tagging-validations?status=passed&limit=5`);
  assert.equal(matterTaggingValidations.collection, "matter_tagging_validations");
  assert.ok(matterTaggingValidations.count <= 5);

  const accessAuditProjections = await fetchJson(`${url}/api/access-audit-projections?access_audit_projection_status=complete&limit=1`);
  assert.equal(accessAuditProjections.collection, "access_audit_projections");
  assert.ok(accessAuditProjections.count <= 1);

  const accessAuditRecords = await fetchJson(`${url}/api/access-audit-records?target_type=resource&view_status=view_requires_human_confirmation&limit=5`);
  assert.equal(accessAuditRecords.collection, "access_audit_records");
  assert.ok(accessAuditRecords.count <= 5);

  const accessAuditActorRollups = await fetchJson(`${url}/api/access-audit-actor-rollups?target_matter_id=matter.alpha.ldd&limit=5`);
  assert.equal(accessAuditActorRollups.collection, "access_audit_actor_rollups");
  assert.ok(accessAuditActorRollups.count <= 5);

  const accessAuditResourceRollups = await fetchJson(`${url}/api/access-audit-resource-rollups?target_matter_id=matter.alpha.ldd&limit=5`);
  assert.equal(accessAuditResourceRollups.collection, "access_audit_resource_rollups");
  assert.ok(accessAuditResourceRollups.count <= 5);

  const accessAuditValidations = await fetchJson(`${url}/api/access-audit-validations?status=passed&limit=5`);
  assert.equal(accessAuditValidations.collection, "access_audit_validations");
  assert.ok(accessAuditValidations.count <= 5);

  const storePolicyAdapters = await fetchJson(`${url}/api/store-policy-adapters?store_policy_adapter_status=complete&limit=1`);
  assert.equal(storePolicyAdapters.collection, "store_policy_adapters");
  assert.ok(storePolicyAdapters.count <= 1);

  const storePolicyRules = await fetchJson(`${url}/api/store-policy-rules?rule_type=matter_scope&limit=5`);
  assert.equal(storePolicyRules.collection, "store_policy_rules");
  assert.ok(storePolicyRules.count <= 5);

  const rlsFilterTemplates = await fetchJson(`${url}/api/rls-filter-templates?collection_id=resource_store&limit=5`);
  assert.equal(rlsFilterTemplates.collection, "rls_filter_templates");
  assert.ok(rlsFilterTemplates.count <= 5);

  const storeQueryPlans = await fetchJson(`${url}/api/store-query-plans?query_status=held_for_human_confirmation&target_type=resource&limit=5`);
  assert.equal(storeQueryPlans.collection, "store_query_plans");
  assert.ok(storeQueryPlans.count <= 5);

  const storeEnforcementProbes = await fetchJson(`${url}/api/store-enforcement-probes?probe_type=unfiltered_query&observed_outcome=blocked&limit=5`);
  assert.equal(storeEnforcementProbes.collection, "store_enforcement_probes");
  assert.ok(storeEnforcementProbes.count <= 5);

  const storePolicyValidations = await fetchJson(`${url}/api/store-policy-validations?status=passed&limit=5`);
  assert.equal(storePolicyValidations.collection, "store_policy_validations");
  assert.ok(storePolicyValidations.count <= 5);

  const conflictCheckInterfaces = await fetchJson(`${url}/api/conflict-check-interfaces?conflict_check_interface_status=complete&limit=1`);
  assert.equal(conflictCheckInterfaces.collection, "conflict_check_interfaces");
  assert.ok(conflictCheckInterfaces.count <= 1);

  const conflictCheckRequests = await fetchJson(`${url}/api/conflict-check-requests?request_type=resource_access&limit=5`);
  assert.equal(conflictCheckRequests.collection, "conflict_check_requests");
  assert.ok(conflictCheckRequests.count <= 5);

  const conflictCheckResults = await fetchJson(`${url}/api/conflict-check-results?result_status=review_required&limit=5`);
  assert.equal(conflictCheckResults.collection, "conflict_check_results");
  assert.ok(conflictCheckResults.count <= 5);

  const conflictCheckSignals = await fetchJson(`${url}/api/conflict-check-signals?signal_decision=review&limit=5`);
  assert.equal(conflictCheckSignals.collection, "conflict_check_signals");
  assert.ok(conflictCheckSignals.count <= 5);

  const conflictCheckValidations = await fetchJson(`${url}/api/conflict-check-validations?status=passed&limit=5`);
  assert.equal(conflictCheckValidations.collection, "conflict_check_validations");
  assert.ok(conflictCheckValidations.count <= 5);

  const personalWorkspaceBoundaries = await fetchJson(`${url}/api/personal-workspace-boundaries?personal_workspace_boundary_status=complete&limit=1`);
  assert.equal(personalWorkspaceBoundaries.collection, "personal_workspace_boundaries");
  assert.ok(personalWorkspaceBoundaries.count <= 1);

  const workspaceBoundaries = await fetchJson(`${url}/api/workspace-boundaries?workspace_type=personal_project&limit=5`);
  assert.equal(workspaceBoundaries.collection, "workspace_boundaries");
  assert.ok(workspaceBoundaries.count <= 5);

  const tenantPolicyBoundaries = await fetchJson(`${url}/api/tenant-policy-boundaries?policy_mode=deny_unless_workspace_scoped&limit=5`);
  assert.equal(tenantPolicyBoundaries.collection, "tenant_policy_boundaries");
  assert.ok(tenantPolicyBoundaries.count <= 5);

  const searchNamespacePolicies = await fetchJson(`${url}/api/search-namespace-policies?query_scope_status=isolated&limit=5`);
  assert.equal(searchNamespacePolicies.collection, "search_namespace_policies");
  assert.ok(searchNamespacePolicies.count <= 5);

  const crossWorkspaceProbes = await fetchJson(`${url}/api/cross-workspace-probes?observed_outcome=blocked&limit=5`);
  assert.equal(crossWorkspaceProbes.collection, "cross_workspace_probes");
  assert.ok(crossWorkspaceProbes.count <= 5);

  const personalWorkspaceBoundaryValidations = await fetchJson(`${url}/api/personal-workspace-boundary-validations?status=passed&limit=5`);
  assert.equal(personalWorkspaceBoundaryValidations.collection, "personal_workspace_boundary_validations");
  assert.ok(personalWorkspaceBoundaryValidations.count <= 5);

  const policyGoldenFixtures = await fetchJson(`${url}/api/policy-golden-fixtures?policy_golden_fixture_status=complete&limit=1`);
  assert.equal(policyGoldenFixtures.collection, "policy_golden_fixtures");
  assert.ok(policyGoldenFixtures.count <= 1);

  const policyFixtureCases = await fetchJson(`${url}/api/policy-fixture-cases?expected_decision=review&limit=5`);
  assert.equal(policyFixtureCases.collection, "policy_fixture_cases");
  assert.ok(policyFixtureCases.count <= 5);

  const policyOutcomeMatrix = await fetchJson(`${url}/api/policy-outcome-matrix?limit=1`);
  assert.equal(policyOutcomeMatrix.collection, "policy_outcome_matrix");
  assert.ok(policyOutcomeMatrix.count <= 1);

  const policyRegressionHashes = await fetchJson(`${url}/api/policy-regression-hashes?case_status=locked&limit=5`);
  assert.equal(policyRegressionHashes.collection, "policy_regression_hashes");
  assert.ok(policyRegressionHashes.count <= 5);

  const policyGoldenFixtureValidations = await fetchJson(`${url}/api/policy-golden-fixture-validations?status=passed&limit=5`);
  assert.equal(policyGoldenFixtureValidations.collection, "policy_golden_fixture_validations");
  assert.ok(policyGoldenFixtureValidations.count <= 5);

  const policyOperationSurfaces = await fetchJson(`${url}/api/policy-operation-surfaces?policy_operations_surface_status=complete&limit=1`);
  assert.equal(policyOperationSurfaces.collection, "policy_operation_surfaces");
  assert.ok(policyOperationSurfaces.count <= 1);

  const policyDecisionRows = await fetchJson(`${url}/api/policy-decision-rows?decision=deny&limit=5`);
  assert.equal(policyDecisionRows.collection, "policy_decision_rows");
  assert.ok(policyDecisionRows.count <= 5);

  const policyViolationRows = await fetchJson(`${url}/api/policy-violation-rows?severity=critical&limit=5`);
  assert.equal(policyViolationRows.collection, "policy_violation_rows");
  assert.ok(policyViolationRows.count <= 5);

  const policyPendingApprovals = await fetchJson(`${url}/api/policy-pending-approvals?status=pending&limit=5`);
  assert.equal(policyPendingApprovals.collection, "policy_pending_approvals");
  assert.ok(policyPendingApprovals.count <= 5);

  const policySurfaceValidations = await fetchJson(`${url}/api/policy-surface-validations?status=passed&limit=5`);
  assert.equal(policySurfaceValidations.collection, "policy_surface_validations");
  assert.ok(policySurfaceValidations.count <= 5);

  const matterBoundarySlices = await fetchJson(`${url}/api/matter-boundary-slices?matter_boundary_slice_status=complete&limit=1`);
  assert.equal(matterBoundarySlices.collection, "matter_boundary_slices");
  assert.ok(matterBoundarySlices.count <= 1);

  const matterBoundaryResourcePaths = await fetchJson(`${url}/api/matter-boundary-resource-paths?boundary_status=held_for_matter_tagging&limit=5`);
  assert.equal(matterBoundaryResourcePaths.collection, "matter_boundary_resource_paths");
  assert.ok(matterBoundaryResourcePaths.count <= 5);

  const matterBoundaryRetrievalGates = await fetchJson(`${url}/api/matter-boundary-retrieval-gates?retrieval_gate_status=passed&limit=5`);
  assert.equal(matterBoundaryRetrievalGates.collection, "matter_boundary_retrieval_gates");
  assert.ok(matterBoundaryRetrievalGates.count <= 5);

  const matterBoundaryValidations = await fetchJson(`${url}/api/matter-boundary-validations?status=passed&limit=5`);
  assert.equal(matterBoundaryValidations.collection, "matter_boundary_validations");
  assert.ok(matterBoundaryValidations.count <= 5);

  const identityPolicyMatterFreezes = await fetchJson(`${url}/api/identity-policy-matter-freezes?freeze_status=frozen_with_pending_human_actions&limit=1`);
  assert.equal(identityPolicyMatterFreezes.collection, "identity_policy_matter_freezes");
  assert.ok(identityPolicyMatterFreezes.count <= 1);

  const identityPolicyFreezeSources = await fetchJson(`${url}/api/identity-policy-freeze-sources?source_status=passed&limit=5`);
  assert.equal(identityPolicyFreezeSources.collection, "identity_policy_freeze_sources");
  assert.ok(identityPolicyFreezeSources.count <= 5);

  const identityPolicyFreezeCheckpoints = await fetchJson(`${url}/api/identity-policy-freeze-checkpoints?status=passed&limit=5`);
  assert.equal(identityPolicyFreezeCheckpoints.collection, "identity_policy_freeze_checkpoints");
  assert.ok(identityPolicyFreezeCheckpoints.count <= 5);

  const identityPolicyFreezeValidations = await fetchJson(`${url}/api/identity-policy-freeze-validations?status=passed&limit=5`);
  assert.equal(identityPolicyFreezeValidations.collection, "identity_policy_freeze_validations");
  assert.ok(identityPolicyFreezeValidations.count <= 5);

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
