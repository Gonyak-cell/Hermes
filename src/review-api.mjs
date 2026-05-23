import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REVIEW_API_HOST = "127.0.0.1";
export const DEFAULT_REVIEW_API_PORT = 4177;
export const DEFAULT_REVIEW_API_DASHBOARD_PATH = "artifacts/dashboard/latest/review-dashboard.json";
export const DEFAULT_REVIEW_API_INDEX_PATH = "artifacts/dashboard/latest/index.html";
export const DEFAULT_REVIEW_API_SUMMARY_PATH = "artifacts/dashboard/latest/summary.md";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

const TEXT_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  "cache-control": "no-store",
};

export function createReviewApiServer(options = {}) {
  return createServer(async (request, response) => {
    const apiResponse = await buildReviewApiResponse(request.url ?? "/", {
      ...options,
      method: request.method,
    });
    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
  });
}

export async function startReviewApiServer(options = {}) {
  const host = options.host ?? DEFAULT_REVIEW_API_HOST;
  const port = Number(options.port ?? DEFAULT_REVIEW_API_PORT);
  const server = createReviewApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
  };
}

export async function buildReviewApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Review API is read-only."));
  }

  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);

  if (pathname === "/health") {
    return jsonResponse(200, await buildHealthResponse(options, generatedAt), method);
  }

  if (pathname === "/api") {
    return jsonResponse(200, buildRouteIndex(options, generatedAt), method);
  }

  if (pathname === "/" || pathname === "/index.html") {
    return fileResponse(resolveIndexPath(options), HTML_HEADERS, method);
  }

  if (pathname === "/summary.md") {
    return fileResponse(resolveSummaryPath(options), TEXT_HEADERS, method);
  }

  const dashboardResult = await readDashboard(options);
  if (!dashboardResult.available) {
    return jsonResponse(
      503,
      buildError("dashboard_unavailable", `Dashboard artifact is not available: ${dashboardResult.error}`),
      method,
    );
  }

  const dashboard = dashboardResult.dashboard;
  if (pathname === "/api/dashboard") return jsonResponse(200, dashboard, method);
  if (pathname === "/api/summary") {
    return jsonResponse(200, {
      schema_version: "review-api-summary.v1",
      generated_at: generatedAt,
      dashboard_generated_at: dashboard.generated_at,
      summary: dashboard.summary,
    }, method);
  }
  if (pathname === "/api/stages") {
    return jsonResponse(200, buildCollectionResponse("stage_statuses", dashboard.stage_statuses ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/actions") {
    return jsonResponse(200, buildCollectionResponse("action_items", dashboard.action_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/sources") {
    return jsonResponse(200, buildCollectionResponse("sources", dashboard.sources ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-review-drafts") {
    const draftResult = await readDashboardSourceArtifact(dashboard, "evidence_review_draft");
    if (!draftResult.available) {
      return jsonResponse(503, buildError("evidence_review_draft_unavailable", draftResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("evidence_review_drafts", [draftResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/evidence-review-items") {
    const draftResult = await readDashboardSourceArtifact(dashboard, "evidence_review_draft");
    if (!draftResult.available) {
      return jsonResponse(503, buildError("evidence_review_draft_unavailable", draftResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("evidence_review_items", draftResult.artifact.review_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/policy-matrices") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_matrices", [policyResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/policy-classifications") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("policy_classifications", policyResult.artifact.classification_levels ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-policies") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("runtime_policies", policyResult.artifact.runtime_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/model-policies") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("model_policies", policyResult.artifact.model_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/tool-policies") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tool_policies", policyResult.artifact.tool_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/output-policies") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_policies", policyResult.artifact.output_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/gate-policies") {
    const policyResult = await readDashboardSourceArtifact(dashboard, "policy_matrix_catalog");
    if (!policyResult.available) {
      return jsonResponse(503, buildError("policy_matrix_catalog_unavailable", policyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_policies", policyResult.artifact.gate_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-snapshot-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/policy-snapshots") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshots", ledgerResult.artifact.policy_snapshots ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-snapshot-instances") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_instances", ledgerResult.artifact.snapshot_instances ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_decisions", ledgerResult.artifact.policy_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-usages") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_usages", ledgerResult.artifact.usage_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/context-packet-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "context_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("context_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("context_packet_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/context-packets") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "context_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("context_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("context_packets", ledgerResult.artifact.context_packets ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/context-items") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "context_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("context_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("context_items", ledgerResult.artifact.context_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/context-retrieval-filters") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "context_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("context_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("context_retrieval_filters", ledgerResult.artifact.retrieval_filters ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/model-routing-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "model_routing_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("model_routing_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("model_routing_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/model-routing-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "model_routing_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("model_routing_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("model_routing_decisions", ledgerResult.artifact.routing_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/cost-budget-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "cost_budget_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("cost_budget_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_budget_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/cost-budget-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "cost_budget_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("cost_budget_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_budget_decisions", ledgerResult.artifact.budget_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/token-usage-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "token_usage_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("token_usage_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("token_usage_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/token-usage-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "token_usage_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("token_usage_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("token_usage_records", ledgerResult.artifact.token_usage_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/cost-attribution-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "cost_attribution_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("cost_attribution_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_attribution_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/cost-attribution-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "cost_attribution_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("cost_attribution_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_attribution_records", ledgerResult.artifact.attribution_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/budget-alert-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "budget_alert_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("budget_alert_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("budget_alert_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/budget-alert-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "budget_alert_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("budget_alert_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("budget_alert_records", ledgerResult.artifact.alert_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/packs") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "domain_pack_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("domain_pack_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("domain_packs", registryResult.artifact.packs ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/capabilities") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "domain_pack_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("domain_pack_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capabilities", registryResult.artifact.capabilities ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/artifacts") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "output_artifact_catalog");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("output_artifact_catalog_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("output_artifacts", catalogResult.artifact.artifacts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runs") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "observability_catalog");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("observability_catalog_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("run_records", catalogResult.artifact.run_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/events") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "observability_catalog");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("observability_catalog_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_records", catalogResult.artifact.event_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/costs") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "observability_catalog");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("observability_catalog_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("cost_records", catalogResult.artifact.cost_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-trails") {
    const auditTrailResult = await readDashboardSourceArtifact(dashboard, "control_plane_audit_trail");
    if (!auditTrailResult.available) {
      return jsonResponse(503, buildError("control_plane_audit_trail_unavailable", auditTrailResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_trails", [auditTrailResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-events") {
    const auditTrailResult = await readDashboardSourceArtifact(dashboard, "control_plane_audit_trail");
    if (!auditTrailResult.available) {
      return jsonResponse(503, buildError("control_plane_audit_trail_unavailable", auditTrailResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_events", auditTrailResult.artifact.audit_events ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-sources") {
    const auditTrailResult = await readDashboardSourceArtifact(dashboard, "control_plane_audit_trail");
    if (!auditTrailResult.available) {
      return jsonResponse(503, buildError("control_plane_audit_trail_unavailable", auditTrailResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_sources", auditTrailResult.artifact.sources ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-actions") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "protected_delivery_queue");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("protected_delivery_queue_unavailable", queueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_actions", queueResult.artifact.delivery_actions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matters") {
    const cockpitResult = await readDashboardSourceArtifact(dashboard, "matter_cockpit");
    if (!cockpitResult.available) {
      return jsonResponse(503, buildError("matter_cockpit_unavailable", cockpitResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matters", cockpitResult.artifact.matters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/approvals") {
    const inboxResult = await readDashboardSourceArtifact(dashboard, "approval_inbox");
    if (!inboxResult.available) {
      return jsonResponse(503, buildError("approval_inbox_unavailable", inboxResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("approval_items", inboxResult.artifact.items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/approval-inbox-decisions") {
    const decisionResult = await readDashboardSourceArtifact(dashboard, "approval_inbox_decisions");
    if (!decisionResult.available) {
      return jsonResponse(503, buildError("approval_inbox_decisions_unavailable", decisionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("approval_inbox_decisions", decisionResult.artifact.applied_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-execution-candidates") {
    const executionResult = await readDashboardSourceArtifact(dashboard, "delivery_execution_draft");
    if (!executionResult.available) {
      return jsonResponse(503, buildError("delivery_execution_draft_unavailable", executionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_execution_candidates", executionResult.artifact.execution_candidates ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-execution-packets") {
    const executionResult = await readDashboardSourceArtifact(dashboard, "delivery_execution_draft");
    if (!executionResult.available) {
      return jsonResponse(503, buildError("delivery_execution_draft_unavailable", executionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_execution_packets", executionResult.artifact.execution_packets ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-receipts") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "delivery_receipt_ledger");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("delivery_receipt_ledger_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_receipts", receiptResult.artifact.applied_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-receipt-events") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "delivery_receipt_ledger");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("delivery_receipt_ledger_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_receipt_events", receiptResult.artifact.audit_events ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/post-delivery-matters") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "post_delivery_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("post_delivery_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("post_delivery_matters", reconciliationResult.artifact.reconciled_matters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivered-artifacts") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "post_delivery_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("post_delivery_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivered_artifacts", reconciliationResult.artifact.delivered_artifacts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/outstanding-receipts") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "post_delivery_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("post_delivery_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("outstanding_receipts", reconciliationResult.artifact.outstanding_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-closeout-items") {
    const closeoutResult = await readDashboardSourceArtifact(dashboard, "delivery_closeout_queue");
    if (!closeoutResult.available) {
      return jsonResponse(503, buildError("delivery_closeout_queue_unavailable", closeoutResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_closeout_items", closeoutResult.artifact.closeout_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/receipt-input-drafts") {
    const closeoutResult = await readDashboardSourceArtifact(dashboard, "delivery_closeout_queue");
    if (!closeoutResult.available) {
      return jsonResponse(503, buildError("delivery_closeout_queue_unavailable", closeoutResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("receipt_input_drafts", closeoutResult.artifact.receipt_input_draft?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/closeout-receipt-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "closeout_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("closeout_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("closeout_receipt_validations", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/closeout-receipt-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "closeout_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("closeout_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("closeout_receipt_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-receipts-to-apply") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "closeout_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("closeout_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_receipts_to_apply", validationResult.artifact.validated_receipts_to_apply?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/closeout-receipt-applications") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "closeout_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("closeout_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("closeout_receipt_applications", [applicationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/closeout-applied-receipts") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "closeout_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("closeout_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("closeout_applied_receipts", applicationResult.artifact.applied_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pipeline-runs") {
    const pipelineResult = await readDashboardSourceArtifact(dashboard, "control_plane_pipeline");
    if (!pipelineResult.available) {
      return jsonResponse(503, buildError("control_plane_pipeline_unavailable", pipelineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pipeline_runs", [pipelineResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pipeline-steps") {
    const pipelineResult = await readDashboardSourceArtifact(dashboard, "control_plane_pipeline");
    if (!pipelineResult.available) {
      return jsonResponse(503, buildError("control_plane_pipeline_unavailable", pipelineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pipeline_steps", pipelineResult.artifact.step_results ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/control-plane-loops") {
    const loopResult = await readDashboardSourceArtifact(dashboard, "control_plane_loop");
    if (!loopResult.available) {
      return jsonResponse(503, buildError("control_plane_loop_unavailable", loopResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("control_plane_loops", [loopResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/control-plane-loop-steps") {
    const loopResult = await readDashboardSourceArtifact(dashboard, "control_plane_loop");
    if (!loopResult.available) {
      return jsonResponse(503, buildError("control_plane_loop_unavailable", loopResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("control_plane_loop_steps", loopResult.artifact.step_results ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/goal-checkpoints") {
    const checkpointResult = await readDashboardSourceArtifact(dashboard, "control_plane_goal_checkpoint");
    if (!checkpointResult.available) {
      return jsonResponse(503, buildError("control_plane_goal_checkpoint_unavailable", checkpointResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("goal_checkpoints", [checkpointResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/goal-checkpoint-items") {
    const checkpointResult = await readDashboardSourceArtifact(dashboard, "control_plane_goal_checkpoint");
    if (!checkpointResult.available) {
      return jsonResponse(503, buildError("control_plane_goal_checkpoint_unavailable", checkpointResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("goal_checkpoint_items", checkpointResult.artifact.checkpoint_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/control-plane-health") {
    const healthResult = await readDashboardSourceArtifact(dashboard, "control_plane_health");
    if (!healthResult.available) {
      return jsonResponse(503, buildError("control_plane_health_unavailable", healthResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("control_plane_health", [healthResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/health-checks") {
    const healthResult = await readDashboardSourceArtifact(dashboard, "control_plane_health");
    if (!healthResult.available) {
      return jsonResponse(503, buildError("control_plane_health_unavailable", healthResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("health_checks", healthResult.artifact.health_checks ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/action-plans") {
    const actionPlanResult = await readDashboardSourceArtifact(dashboard, "control_plane_action_plan");
    if (!actionPlanResult.available) {
      return jsonResponse(503, buildError("control_plane_action_plan_unavailable", actionPlanResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("action_plans", [actionPlanResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/action-plan-items") {
    const actionPlanResult = await readDashboardSourceArtifact(dashboard, "control_plane_action_plan");
    if (!actionPlanResult.available) {
      return jsonResponse(503, buildError("control_plane_action_plan_unavailable", actionPlanResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("action_plan_items", actionPlanResult.artifact.plan_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gates") {
    const humanGateResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gates");
    if (!humanGateResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gates_unavailable", humanGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gates", [humanGateResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-items") {
    const humanGateResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gates");
    if (!humanGateResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gates_unavailable", humanGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_items", humanGateResult.artifact.gate_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipts") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipts");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipts_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipts", [receiptResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipt-requirements") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipts");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipts_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipt_requirements", receiptResult.artifact.receipt_requirements ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipt-drafts") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipts");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipts_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipt_drafts", receiptResult.artifact.receipt_input_draft?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-packet-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_packet_ledgers", [ledgerResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-packets") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_packets", ledgerResult.artifact.review_packets ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-items") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_packet_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_packet_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_items", ledgerResult.artifact.review_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agendas") {
    const agendaResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda");
    if (!agendaResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_unavailable", agendaResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agendas", [agendaResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agenda-sections") {
    const agendaResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda");
    if (!agendaResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_unavailable", agendaResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agenda_sections", agendaResult.artifact.agenda_sections ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agenda-items") {
    const agendaResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda");
    if (!agendaResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_unavailable", agendaResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agenda_items", agendaResult.artifact.agenda_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-template") {
    const agendaResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda");
    if (!agendaResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_unavailable", agendaResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_template", agendaResult.artifact.decision_template?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agenda-receipt-intakes") {
    const intakeResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda_receipt_intake");
    if (!intakeResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_receipt_intake_unavailable", intakeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agenda_receipt_intakes", [intakeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agenda-receipt-intake-items") {
    const intakeResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda_receipt_intake");
    if (!intakeResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_receipt_intake_unavailable", intakeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agenda_receipt_intake_items", intakeResult.artifact.intake_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-agenda-receipt-input") {
    const intakeResult = await readDashboardSourceArtifact(dashboard, "human_review_agenda_receipt_intake");
    if (!intakeResult.available) {
      return jsonResponse(503, buildError("human_review_agenda_receipt_intake_unavailable", intakeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_agenda_receipt_input", intakeResult.artifact.receipt_input?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-receipt-workspaces") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_receipt_workspaces", [workspaceResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-workspaces") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_workspaces", workspaceResult.artifact.actor_workspaces ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-workspace-entries") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_workspace_entries", workspaceResult.artifact.workspace_entries ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-receipt-workspace-merges") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_receipt_workspace_merges", [mergeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-receipt-merge-items") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_receipt_merge_items", mergeResult.artifact.merge_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-merged-receipt-input") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_merged_receipt_input", mergeResult.artifact.receipt_input?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-context-bundles") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "human_review_context_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("human_review_context_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_context_bundles", [bundleResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-context-cards") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "human_review_context_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("human_review_context_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_context_cards", bundleResult.artifact.context_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-context-bundles") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "human_review_context_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("human_review_context_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_context_bundles", bundleResult.artifact.actor_context_bundles ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-registers") {
    const registerResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register");
    if (!registerResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_unavailable", registerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_registers", [registerResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-rows") {
    const registerResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register");
    if (!registerResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_unavailable", registerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_rows", registerResult.artifact.decision_rows ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-receipt-input") {
    const registerResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register");
    if (!registerResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_unavailable", registerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_receipt_input", registerResult.artifact.receipt_input?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-register-merges") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_register_merges", [mergeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-decision-merge-items") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_decision_merge_items", mergeResult.artifact.merge_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-merged-decision-receipt-input") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_decision_register_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_decision_register_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_merged_decision_receipt_input", mergeResult.artifact.receipt_input?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipt-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipt_validations", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipt-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipt_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-validation-feedbacks") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_validation_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_validation_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_validation_feedbacks", [feedbackResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-feedback-items") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_validation_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_validation_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_feedback_items", feedbackResult.artifact.feedback_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-feedback") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_validation_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_validation_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_feedback", feedbackResult.artifact.actor_feedback ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-workspaces") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_workspaces", [workspaceResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-actors") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_actors", workspaceResult.artifact.actor_workspaces ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-items") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_items", workspaceResult.artifact.correction_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-receipt-input") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_unavailable", workspaceResult.error), method);
    }
    const receipts = (workspaceResult.artifact.correction_items ?? []).map((item) => item.editable_receipt);
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_receipt_input", receipts, url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-workspace-merges") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_workspace_merges", [mergeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-merge-actors") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_merge_actors", mergeResult.artifact.actor_inputs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-merge-items") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_merge_items", mergeResult.artifact.merge_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-merged-correction-receipt-input") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_correction_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_merged_correction_receipt_input", mergeResult.artifact.receipt_input?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_correction_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_validations", [validationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-validation-items") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_correction_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_validation_items", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-validation-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_correction_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_validation_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-correction-human-gate-receipts") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_correction_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_correction_human_gate_receipts", validationResult.artifact.validated_receipts_to_apply?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-feedbacks") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_correction_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_feedbacks", [feedbackResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-feedback-items") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_correction_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_feedback_items", feedbackResult.artifact.feedback_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-correction-actor-feedback") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_correction_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_correction_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_correction_actor_feedback", feedbackResult.artifact.actor_feedback ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-ledgers") {
    const cycleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_ledger");
    if (!cycleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_ledger_unavailable", cycleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_ledgers", [cycleResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-items") {
    const cycleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_ledger");
    if (!cycleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_ledger_unavailable", cycleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_items", cycleResult.artifact.cycle_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-cycles") {
    const cycleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_ledger");
    if (!cycleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_ledger_unavailable", cycleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_cycles", cycleResult.artifact.actor_cycles ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-work-orders") {
    const workOrdersResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_work_orders");
    if (!workOrdersResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_work_orders_unavailable", workOrdersResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_work_orders", [workOrdersResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-work-order-items") {
    const workOrdersResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_work_orders");
    if (!workOrdersResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_work_orders_unavailable", workOrdersResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_work_order_items", workOrdersResult.artifact.work_order_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-work-orders") {
    const workOrdersResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_work_orders");
    if (!workOrdersResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_work_orders_unavailable", workOrdersResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_work_orders", workOrdersResult.artifact.actor_work_orders ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-target-audits") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_target_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_target_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_target_audits", [auditResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-target-audit-items") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_target_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_target_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_target_audit_items", auditResult.artifact.target_audit_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-target-audits") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_target_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_target_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_target_audits", auditResult.artifact.actor_target_audits ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-triage-inboxes") {
    const inboxResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_triage_inbox");
    if (!inboxResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_triage_inbox_unavailable", inboxResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_triage_inboxes", [inboxResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-triage-items") {
    const inboxResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_triage_inbox");
    if (!inboxResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_triage_inbox_unavailable", inboxResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_triage_items", inboxResult.artifact.triage_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-triage-inboxes") {
    const inboxResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_triage_inbox");
    if (!inboxResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_triage_inbox_unavailable", inboxResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_triage_inboxes", inboxResult.artifact.actor_triage_inboxes ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-human-gate-receipts") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_human_gate_receipts", validationResult.artifact.validated_receipts_to_apply?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-receipt-applications") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_receipt_applications", [applicationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/applied-human-gate-receipts") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("applied_human_gate_receipts", applicationResult.artifact.applied_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/patched-human-gate-items") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "control_plane_human_gate_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("control_plane_human_gate_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("patched_human_gate_items", applicationResult.artifact.patched_gate_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/action-work-packets") {
    const workPacketsResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packets");
    if (!workPacketsResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packets_unavailable", workPacketsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("action_work_packets", workPacketsResult.artifact.work_packets ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/action-work-items") {
    const workPacketsResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packets");
    if (!workPacketsResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packets_unavailable", workPacketsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("action_work_items", workPacketsResult.artifact.work_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/work-packet-receipt-requirements") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipts");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipts_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("work_packet_receipt_requirements", receiptResult.artifact.receipt_requirements ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/work-packet-receipt-drafts") {
    const receiptResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipts");
    if (!receiptResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipts_unavailable", receiptResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("work_packet_receipt_drafts", receiptResult.artifact.receipt_input_draft?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/work-packet-receipt-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("work_packet_receipt_validations", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/work-packet-receipt-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("work_packet_receipt_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-work-packet-receipts") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_work_packet_receipts", validationResult.artifact.validated_receipts_to_apply?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/work-packet-receipt-applications") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("work_packet_receipt_applications", [applicationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/applied-work-packet-receipts") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "control_plane_work_packet_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("control_plane_work_packet_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("applied_work_packet_receipts", applicationResult.artifact.applied_receipts ?? [], url, generatedAt),
      method,
    );
  }

  return jsonResponse(404, buildError("not_found", `Unknown Review API route: ${pathname}`), method);
}

export async function runReviewApiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  if (args.once) {
    const response = await buildReviewApiResponse(args.once, args);
    console.log(response.body);
    if (response.status >= 400) process.exitCode = 1;
    return;
  }

  const serverInfo = await startReviewApiServer(args);
  console.log(`Hermes Review API listening at ${serverInfo.url}`);
  console.log(`Dashboard: ${resolveDashboardPath(args)}`);
  console.log("Routes: /, /health, /api, /api/dashboard, /api/stages, /api/actions, /api/sources, /api/evidence-review-drafts, /api/evidence-review-items, /api/policy-matrices, /api/policy-classifications, /api/runtime-policies, /api/model-policies, /api/tool-policies, /api/output-policies, /api/gate-policies, /api/policy-snapshot-ledgers, /api/policy-snapshots, /api/policy-snapshot-instances, /api/policy-decisions, /api/policy-usages, /api/context-packet-ledgers, /api/context-packets, /api/context-items, /api/context-retrieval-filters, /api/model-routing-ledgers, /api/model-routing-decisions, /api/cost-budget-ledgers, /api/cost-budget-decisions, /api/token-usage-ledgers, /api/token-usage-records, /api/cost-attribution-ledgers, /api/cost-attribution-records, /api/budget-alert-ledgers, /api/budget-alert-records, /api/packs, /api/capabilities, /api/artifacts, /api/runs, /api/events, /api/costs, /api/audit-trails, /api/audit-events, /api/audit-sources, /api/delivery-actions, /api/matters, /api/approvals, /api/approval-inbox-decisions, /api/delivery-execution-candidates, /api/delivery-execution-packets, /api/delivery-receipts, /api/delivery-receipt-events, /api/post-delivery-matters, /api/delivered-artifacts, /api/outstanding-receipts, /api/delivery-closeout-items, /api/receipt-input-drafts, /api/closeout-receipt-validations, /api/closeout-receipt-errors, /api/validated-receipts-to-apply, /api/closeout-receipt-applications, /api/closeout-applied-receipts, /api/pipeline-runs, /api/pipeline-steps, /api/control-plane-loops, /api/control-plane-loop-steps, /api/goal-checkpoints, /api/goal-checkpoint-items, /api/control-plane-health, /api/health-checks, /api/action-plans, /api/action-plan-items, /api/human-gates, /api/human-gate-items, /api/human-gate-receipts, /api/human-gate-receipt-requirements, /api/human-gate-receipt-drafts, /api/human-review-packet-ledgers, /api/human-review-packets, /api/human-review-items, /api/human-gate-receipt-validations, /api/human-gate-receipt-errors, /api/validated-human-gate-receipts, /api/human-gate-receipt-applications, /api/applied-human-gate-receipts, /api/patched-human-gate-items, /api/action-work-packets, /api/action-work-items, /api/work-packet-receipt-requirements, /api/work-packet-receipt-drafts, /api/work-packet-receipt-validations, /api/work-packet-receipt-errors, /api/validated-work-packet-receipts, /api/work-packet-receipt-applications, /api/applied-work-packet-receipts");
}

function buildRouteIndex(options, generatedAt) {
  return {
    schema_version: "review-api-index.v1",
    generated_at: generatedAt,
    dashboard_path: resolveDashboardPath(options),
    static_index_path: resolveIndexPath(options),
    routes: [
      route("GET", "/", "Static dashboard HTML"),
      route("GET", "/health", "Readiness and artifact availability"),
      route("GET", "/api", "Route index"),
      route("GET", "/api/dashboard", "Full review-dashboard.v1 artifact"),
      route("GET", "/api/summary", "Dashboard summary only"),
      route("GET", "/api/stages", "Control Plane stage statuses"),
      route("GET", "/api/actions", "Pending action queue"),
      route("GET", "/api/sources", "Dashboard source artifacts"),
      route("GET", "/api/evidence-review-drafts", "Evidence review decision draft artifacts"),
      route("GET", "/api/evidence-review-items", "Evidence review draft items"),
      route("GET", "/api/policy-matrices", "Policy matrix catalog artifacts"),
      route("GET", "/api/policy-classifications", "Policy data classification levels"),
      route("GET", "/api/runtime-policies", "Policy runtime rules"),
      route("GET", "/api/model-policies", "Policy model transfer rules"),
      route("GET", "/api/tool-policies", "Policy tool permission rules"),
      route("GET", "/api/output-policies", "Policy output delivery rules"),
      route("GET", "/api/gate-policies", "Policy gate rules"),
      route("GET", "/api/policy-snapshot-ledgers", "Policy snapshot ledger artifacts"),
      route("GET", "/api/policy-snapshots", "Canonical policy snapshots used by workflow runs"),
      route("GET", "/api/policy-snapshot-instances", "Source-level policy snapshot instances"),
      route("GET", "/api/policy-decisions", "Policy decision summaries derived from snapshots"),
      route("GET", "/api/policy-usages", "Workflow, event, and run ledger policy snapshot references"),
      route("GET", "/api/context-packet-ledgers", "Context packet ledger artifacts"),
      route("GET", "/api/context-packets", "Runtime-scoped context packets"),
      route("GET", "/api/context-items", "Context items compiled for runtime packets"),
      route("GET", "/api/context-retrieval-filters", "Matter and policy retrieval filters for context packets"),
      route("GET", "/api/model-routing-ledgers", "Model routing ledger artifacts"),
      route("GET", "/api/model-routing-decisions", "Runtime model routing and external-transfer decisions"),
      route("GET", "/api/cost-budget-ledgers", "Cost budget ledger artifacts"),
      route("GET", "/api/cost-budget-decisions", "Cost budget gate decisions"),
      route("GET", "/api/token-usage-ledgers", "Token usage ledger artifacts"),
      route("GET", "/api/token-usage-records", "Recorded or estimated token usage by route"),
      route("GET", "/api/cost-attribution-ledgers", "Cost attribution ledger artifacts"),
      route("GET", "/api/cost-attribution-records", "Matter, runtime, and capability cost attribution records"),
      route("GET", "/api/budget-alert-ledgers", "Budget alert ledger artifacts"),
      route("GET", "/api/budget-alert-records", "Budget usage alert records"),
      route("GET", "/api/packs", "Domain pack registry packs"),
      route("GET", "/api/capabilities", "Domain pack capability contracts"),
      route("GET", "/api/artifacts", "Output artifact catalog"),
      route("GET", "/api/runs", "Observability workflow run records"),
      route("GET", "/api/events", "Observability event records"),
      route("GET", "/api/costs", "Observability cost records"),
      route("GET", "/api/audit-trails", "Control Plane audit trail artifacts"),
      route("GET", "/api/audit-events", "Normalized Control Plane audit events"),
      route("GET", "/api/audit-sources", "Control Plane audit event sources"),
      route("GET", "/api/delivery-actions", "Protected delivery action queue"),
      route("GET", "/api/matters", "Matter cockpit records"),
      route("GET", "/api/approvals", "Approval inbox items"),
      route("GET", "/api/approval-inbox-decisions", "Applied approval inbox decisions"),
      route("GET", "/api/delivery-execution-candidates", "Draft-only delivery execution candidates"),
      route("GET", "/api/delivery-execution-packets", "Draft-only delivery execution packets"),
      route("GET", "/api/delivery-receipts", "Applied delivery receipts"),
      route("GET", "/api/delivery-receipt-events", "Delivery receipt audit events"),
      route("GET", "/api/post-delivery-matters", "Post-delivery matter reconciliation records"),
      route("GET", "/api/delivered-artifacts", "Delivered output artifacts after receipt reconciliation"),
      route("GET", "/api/outstanding-receipts", "Outstanding delivery receipts after reconciliation"),
      route("GET", "/api/delivery-closeout-items", "Manual delivery closeout queue"),
      route("GET", "/api/receipt-input-drafts", "Receipt input draft rows for closeout items"),
      route("GET", "/api/closeout-receipt-validations", "Closeout receipt validation items"),
      route("GET", "/api/closeout-receipt-errors", "Closeout receipt validation errors"),
      route("GET", "/api/validated-receipts-to-apply", "Validated receipt rows ready for delivery:receipts"),
      route("GET", "/api/closeout-receipt-applications", "Closeout receipt application artifact"),
      route("GET", "/api/closeout-applied-receipts", "Applied closeout receipts"),
      route("GET", "/api/pipeline-runs", "Control Plane pipeline run artifacts"),
      route("GET", "/api/pipeline-steps", "Control Plane pipeline step results"),
      route("GET", "/api/control-plane-loops", "Control Plane loop run artifacts"),
      route("GET", "/api/control-plane-loop-steps", "Control Plane loop step results"),
      route("GET", "/api/goal-checkpoints", "Control Plane goal checkpoint artifacts"),
      route("GET", "/api/goal-checkpoint-items", "Control Plane goal checkpoint items"),
      route("GET", "/api/control-plane-health", "Control Plane health artifact"),
      route("GET", "/api/health-checks", "Control Plane health checks"),
      route("GET", "/api/action-plans", "Control Plane action plan artifact"),
      route("GET", "/api/action-plan-items", "Control Plane action plan items"),
      route("GET", "/api/human-gates", "Control Plane human gate briefing artifact"),
      route("GET", "/api/human-gate-items", "Control Plane human gate briefing items"),
      route("GET", "/api/human-gate-receipts", "Control Plane human gate receipt draft artifact"),
      route("GET", "/api/human-gate-receipt-requirements", "Control Plane human gate receipt requirements"),
      route("GET", "/api/human-gate-receipt-drafts", "Control Plane human gate receipt input drafts"),
      route("GET", "/api/human-review-packet-ledgers", "Human review packet ledger artifacts"),
      route("GET", "/api/human-review-packets", "Human review packets grouped by actor and gate type"),
      route("GET", "/api/human-review-items", "Human review packet item details"),
      route("GET", "/api/human-review-agendas", "Human review agenda artifacts"),
      route("GET", "/api/human-review-agenda-sections", "Human review agenda sections by required actor"),
      route("GET", "/api/human-review-agenda-items", "Human review agenda packet items"),
      route("GET", "/api/human-review-decision-template", "Human review receipt decision template rows"),
      route("GET", "/api/human-review-agenda-receipt-intakes", "Human review agenda receipt intake artifacts"),
      route("GET", "/api/human-review-agenda-receipt-intake-items", "Human review agenda receipt intake items"),
      route("GET", "/api/human-review-agenda-receipt-input", "Receipt input rows generated from human review agenda"),
      route("GET", "/api/human-review-receipt-workspaces", "Human review receipt workspace artifacts"),
      route("GET", "/api/human-review-actor-workspaces", "Actor-specific editable receipt workspaces"),
      route("GET", "/api/human-review-workspace-entries", "Human review receipt workspace entries"),
      route("GET", "/api/human-review-receipt-workspace-merges", "Human review receipt workspace merge artifacts"),
      route("GET", "/api/human-review-receipt-merge-items", "Merged human review receipt items"),
      route("GET", "/api/human-review-merged-receipt-input", "Merged receipt input rows generated from actor workspaces"),
      route("GET", "/api/human-review-context-bundles", "Human review context bundle artifacts"),
      route("GET", "/api/human-review-context-cards", "Human review decision context cards"),
      route("GET", "/api/human-review-actor-context-bundles", "Actor-specific human review context bundles"),
      route("GET", "/api/human-review-decision-registers", "Human review decision register artifacts"),
      route("GET", "/api/human-review-decision-rows", "Human review decision rows"),
      route("GET", "/api/human-review-decision-receipt-input", "Receipt input rows generated from the decision register"),
      route("GET", "/api/human-review-decision-register-merges", "Human review decision register merge artifacts"),
      route("GET", "/api/human-review-decision-merge-items", "Merged human review decision receipt items"),
      route("GET", "/api/human-review-merged-decision-receipt-input", "Merged receipt input rows generated from actor decision registers"),
      route("GET", "/api/human-gate-receipt-validations", "Control Plane human gate receipt validation items"),
      route("GET", "/api/human-gate-receipt-errors", "Control Plane human gate receipt validation errors"),
      route("GET", "/api/human-review-validation-feedbacks", "Human review validation feedback artifacts"),
      route("GET", "/api/human-review-feedback-items", "Human review validation feedback items"),
      route("GET", "/api/human-review-actor-feedback", "Actor-specific human review validation feedback bundles"),
      route("GET", "/api/human-review-correction-workspaces", "Human review correction workspace artifacts"),
      route("GET", "/api/human-review-correction-actors", "Actor-specific human review correction workspaces"),
      route("GET", "/api/human-review-correction-items", "Human review correction workspace items"),
      route("GET", "/api/human-review-correction-receipt-input", "Editable correction receipt input rows"),
      route("GET", "/api/human-review-correction-workspace-merges", "Human review correction workspace merge artifacts"),
      route("GET", "/api/human-review-correction-merge-actors", "Actor correction receipt inputs included in the correction merge"),
      route("GET", "/api/human-review-correction-merge-items", "Merged human review correction receipt items"),
      route("GET", "/api/human-review-merged-correction-receipt-input", "Merged correction receipt input rows"),
      route("GET", "/api/human-review-correction-validations", "Human review correction receipt validation artifacts"),
      route("GET", "/api/human-review-correction-validation-items", "Human review correction receipt validation items"),
      route("GET", "/api/human-review-correction-validation-errors", "Human review correction receipt validation errors"),
      route("GET", "/api/validated-correction-human-gate-receipts", "Validated correction receipts ready for future application"),
      route("GET", "/api/human-review-correction-feedbacks", "Human review correction feedback artifacts"),
      route("GET", "/api/human-review-correction-feedback-items", "Human review correction feedback items"),
      route("GET", "/api/human-review-correction-actor-feedback", "Actor-specific human review correction feedback bundles"),
      route("GET", "/api/human-review-cycle-ledgers", "Human review feedback/correction cycle ledger artifacts"),
      route("GET", "/api/human-review-cycle-items", "Human review feedback/correction cycle items"),
      route("GET", "/api/human-review-actor-cycles", "Actor-specific human review cycle rollups"),
      route("GET", "/api/human-review-cycle-work-orders", "Human review cycle work order artifacts"),
      route("GET", "/api/human-review-cycle-work-order-items", "Actor-routed human review cycle work order items"),
      route("GET", "/api/human-review-actor-work-orders", "Actor-specific human review cycle work orders"),
      route("GET", "/api/human-review-cycle-target-audits", "Human review cycle work order target audit artifacts"),
      route("GET", "/api/human-review-cycle-target-audit-items", "Human review cycle work order target audit items"),
      route("GET", "/api/human-review-actor-target-audits", "Actor-specific human review target audits"),
      route("GET", "/api/human-review-cycle-triage-inboxes", "Human review cycle triage inbox artifacts"),
      route("GET", "/api/human-review-cycle-triage-items", "Human review cycle triage items"),
      route("GET", "/api/human-review-actor-triage-inboxes", "Actor-specific human review cycle triage inboxes"),
      route("GET", "/api/validated-human-gate-receipts", "Validated human gate receipts ready for future application"),
      route("GET", "/api/human-gate-receipt-applications", "Human gate receipt application artifacts"),
      route("GET", "/api/applied-human-gate-receipts", "Applied human gate receipts"),
      route("GET", "/api/patched-human-gate-items", "Human gate items patched by applied receipts"),
      route("GET", "/api/action-work-packets", "Control Plane action work packets"),
      route("GET", "/api/action-work-items", "Control Plane action work items"),
      route("GET", "/api/work-packet-receipt-requirements", "Control Plane work packet receipt requirements"),
      route("GET", "/api/work-packet-receipt-drafts", "Control Plane work packet receipt input drafts"),
      route("GET", "/api/work-packet-receipt-validations", "Control Plane work packet receipt validation items"),
      route("GET", "/api/work-packet-receipt-errors", "Control Plane work packet receipt validation errors"),
      route("GET", "/api/validated-work-packet-receipts", "Validated work packet receipts ready for future application"),
      route("GET", "/api/work-packet-receipt-applications", "Work packet receipt application artifacts"),
      route("GET", "/api/applied-work-packet-receipts", "Applied work packet receipts"),
      route("GET", "/summary.md", "Markdown summary"),
    ],
  };
}

async function buildHealthResponse(options, generatedAt) {
  const dashboardResult = await readDashboard(options);
  return {
    schema_version: "review-api-health.v1",
    generated_at: generatedAt,
    status: "ok",
    dashboard_path: resolveDashboardPath(options),
    dashboard_available: dashboardResult.available,
    dashboard_generated_at: dashboardResult.dashboard?.generated_at ?? null,
    overall_status: dashboardResult.dashboard?.summary?.overall_status ?? null,
    error: dashboardResult.error,
  };
}

function buildCollectionResponse(collection, rawItems, url, generatedAt) {
  const filteredItems = filterItems(rawItems, url.searchParams);
  const limitedItems = limitItems(filteredItems, url.searchParams);
  return {
    schema_version: "review-api-collection.v1",
    generated_at: generatedAt,
    collection,
    count: limitedItems.length,
    total_count: rawItems.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    items: limitedItems,
  };
}

function filterItems(items, searchParams) {
  const filterKeys = [
    "status",
    "priority",
    "source_stage",
    "stage_id",
    "source_id",
    "available",
    "catalog_id",
    "policy_status",
    "matrix_id",
    "classification",
    "external_model_policy",
    "local_model_policy",
    "redaction_policy",
    "approval_required",
    "tool_id",
    "default_policy",
    "delivery_policy",
    "gate_id",
    "stage",
    "blocking_by_default",
    "ledger_id",
    "ledger_status",
    "review_status",
    "policy_snapshot_id",
    "decision_id",
    "decision_status",
    "usage_id",
    "usage_type",
    "snapshot_declared_in_source",
    "context_packet_id",
    "context_item_id",
    "retrieval_filter_id",
    "packet_status",
    "context_mode",
    "redaction_required",
    "redaction_applied",
    "classification_allowed",
    "runtime_allowed_by_capability",
    "content_mode",
    "filter_status",
    "routing_decision_id",
    "route_status",
    "route_mode",
    "external_transfer",
    "provider_boundary",
    "runtime_policy_status",
    "redaction_status",
    "audit_required",
    "budget_decision_id",
    "budget_status",
    "token_tracking_required",
    "token_tracking_status",
    "cost_budget_gate_present",
    "cost_policy_present",
    "token_usage_id",
    "tracking_status",
    "estimated",
    "attribution_id",
    "attribution_status",
    "over_budget",
    "untracked_cost",
    "alert_record_id",
    "alert_status",
    "pack_id",
    "capability_id",
    "artifact_id",
    "artifact_type",
    "domain_pack",
    "delivery_state",
    "approval_status",
    "run_id",
    "audit_trail_id",
    "audit_status",
    "audit_event_id",
    "workflow_run_id",
    "runtime_id",
    "actor_type",
    "actor_id",
    "type",
    "event_type",
    "event_category",
    "correlation_id",
    "protected_action_event",
    "protected_action_executed",
    "cost_type",
    "delivery_action_id",
    "delivery_status",
    "delivery_channel",
    "delivery_target",
    "matter_key",
    "matter_id",
    "tenant_id",
    "approval_item_id",
    "item_type",
    "required_decision",
    "decision",
    "draft_id",
    "review_item_id",
    "evidence_id",
    "classification",
    "review_status",
    "suggested_decision",
    "draft_decision",
    "auto_approvable",
    "status_after",
    "execution_candidate_id",
    "packet_id",
    "execution_status",
    "receipt_id",
    "receipt_status",
    "executed_by",
    "closeout_item_id",
    "validation_item_id",
    "validation_status",
    "field",
    "primary_domain_pack",
    "application_id",
    "application_status",
    "pipeline_id",
    "loop_id",
    "loop_status",
    "checkpoint_id",
    "checkpoint_item_id",
    "checkpoint_status",
    "step_id",
    "category",
    "health_id",
    "check_id",
    "severity",
    "plan_id",
    "plan_status",
    "plan_item_id",
    "source_type",
    "work_packet_id",
    "work_item_id",
    "human_gate_id",
    "gate_item_id",
    "gate_type",
    "packet_type",
    "receipt_id",
    "receipt_requirement_id",
    "review_packet_id",
    "review_item_id",
    "packet_type",
    "packet_status",
    "required_actor",
    "agenda_id",
    "agenda_item_id",
    "agenda_section_id",
    "agenda_status",
    "section_status",
    "intake_id",
    "intake_item_id",
    "intake_status",
    "workspace_id",
    "actor_workspace_id",
    "workspace_entry_id",
    "workspace_status",
    "merge_id",
    "merge_item_id",
    "merge_status",
    "actor_input_id",
    "bundle_id",
    "bundle_status",
    "actor_context_bundle_id",
    "context_card_id",
    "context_status",
    "subject_type",
    "subject_id",
    "register_id",
    "register_status",
    "actor_decision_register_id",
    "decision_row_id",
    "decision_status",
    "feedback_id",
    "actor_feedback_id",
    "feedback_item_id",
    "feedback_status",
    "cycle_id",
    "actor_cycle_id",
    "cycle_item_id",
    "cycle_status",
    "work_order_run_id",
    "work_order_id",
    "work_order_item_id",
    "work_order_status",
    "target_audit_id",
    "actor_target_audit_id",
    "target_audit_item_id",
    "target_audit_status",
    "target_file_available",
    "receipt_row_present",
    "triage_inbox_id",
    "actor_triage_inbox_id",
    "triage_item_id",
    "triage_status",
    "triage_rank",
    "correction_workspace_id",
    "actor_correction_workspace_id",
    "correction_item_id",
    "correction_status",
    "template_row_present",
    "ready_for_validation",
    "receipt_status",
    "requires_human",
    "protected_action",
    "enabled",
    "valid",
  ];
  return items.filter((item) => {
    for (const key of filterKeys) {
      if (!searchParams.has(key)) continue;
      const expected = searchParams.get(key);
      const actual = readFilterValue(item, key);
      if (Array.isArray(actual)) {
        if (!actual.map(String).includes(expected)) return false;
        continue;
      }
      if (String(actual) !== expected) return false;
    }
    return true;
  });
}

function readFilterValue(item, key) {
  if (key === "valid") return item.validation?.valid;
  if (key === "runtime_id") return item.runtime_ids ?? item.runtime_id;
  if (key === "matrix_id") return item.policy_matrix?.matrix_id ?? item.matrix_id;
  if (key === "subject_type") return item.subject_ref?.subject_type ?? item[key];
  if (key === "subject_id") return item.subject_ref?.subject_id ?? item[key];
  return item[key];
}

function limitItems(items, searchParams) {
  const limit = Number(searchParams.get("limit") ?? items.length);
  if (!Number.isFinite(limit) || limit < 0) return items;
  return items.slice(0, limit);
}

async function readDashboard(options) {
  const dashboardPath = resolveDashboardPath(options);
  try {
    const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"));
    return {
      available: true,
      dashboard,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      dashboard: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readDashboardSourceArtifact(dashboard, sourceId) {
  const source = (dashboard.sources ?? []).find((candidate) => candidate.source_id === sourceId);
  if (!source) {
    return {
      available: false,
      artifact: null,
      error: `Dashboard source ${sourceId} is not registered.`,
    };
  }
  if (!source.available || !source.path) {
    return {
      available: false,
      artifact: null,
      error: `Dashboard source ${sourceId} is not available: ${source.error ?? "unavailable"}`,
    };
  }
  try {
    return {
      available: true,
      artifact: JSON.parse(await readFile(source.path, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      artifact: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function fileResponse(filePath, headers, method) {
  try {
    const body = await readFile(filePath, "utf8");
    return {
      status: 200,
      headers,
      body: method === "HEAD" ? "" : body,
    };
  } catch (error) {
    return jsonResponse(
      error.code === "ENOENT" ? 404 : 500,
      buildError(error.code === "ENOENT" ? "file_not_found" : "file_read_failed", error.message),
      method,
    );
  }
}

function jsonResponse(status, value, method = "GET") {
  return {
    status,
    headers: JSON_HEADERS,
    body: method === "HEAD" ? "" : `${JSON.stringify(value, null, 2)}\n`,
  };
}

function buildError(code, message) {
  return {
    schema_version: "review-api-error.v1",
    error: code,
    message,
  };
}

function route(method, pathValue, description) {
  return {
    method,
    path: pathValue,
    description,
  };
}

function normalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
}

function resolveDashboardPath(options) {
  return path.resolve(options.dashboardPath ?? DEFAULT_REVIEW_API_DASHBOARD_PATH);
}

function resolveIndexPath(options) {
  return path.resolve(options.indexPath ?? DEFAULT_REVIEW_API_INDEX_PATH);
}

function resolveSummaryPath(options) {
  return path.resolve(options.summaryPath ?? DEFAULT_REVIEW_API_SUMMARY_PATH);
}

function parseArgs(argv) {
  const parsed = {
    host: DEFAULT_REVIEW_API_HOST,
    port: DEFAULT_REVIEW_API_PORT,
    dashboardPath: DEFAULT_REVIEW_API_DASHBOARD_PATH,
    indexPath: DEFAULT_REVIEW_API_INDEX_PATH,
    summaryPath: DEFAULT_REVIEW_API_SUMMARY_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--host") parsed.host = argv[++index];
    else if (arg === "--port") parsed.port = Number(argv[++index]);
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--index") parsed.indexPath = argv[++index];
    else if (arg === "--summary") parsed.summaryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--once") parsed.once = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/review-api.mjs [options]

Options:
  --host <host>          Host to bind. Default: ${DEFAULT_REVIEW_API_HOST}
  --port <port>          Port to bind. Default: ${DEFAULT_REVIEW_API_PORT}
  --dashboard <path>     review-dashboard.json path.
  --index <path>         Static dashboard index.html path.
  --summary <path>       Static dashboard summary.md path.
  --once <route>         Render one route and exit instead of starting a server.
  --run-at <iso>         Deterministic generated_at timestamp for API wrappers.
  -h, --help             Show this help.
`);
}
