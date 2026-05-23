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
  console.log("Routes: /, /health, /api, /api/dashboard, /api/stages, /api/actions, /api/sources, /api/packs, /api/capabilities, /api/artifacts, /api/runs, /api/events, /api/costs, /api/delivery-actions, /api/matters, /api/approvals, /api/approval-inbox-decisions, /api/delivery-execution-candidates, /api/delivery-execution-packets, /api/delivery-receipts, /api/delivery-receipt-events, /api/post-delivery-matters, /api/delivered-artifacts, /api/outstanding-receipts, /api/delivery-closeout-items, /api/receipt-input-drafts, /api/closeout-receipt-validations, /api/closeout-receipt-errors, /api/validated-receipts-to-apply, /api/closeout-receipt-applications, /api/closeout-applied-receipts");
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
      route("GET", "/api/packs", "Domain pack registry packs"),
      route("GET", "/api/capabilities", "Domain pack capability contracts"),
      route("GET", "/api/artifacts", "Output artifact catalog"),
      route("GET", "/api/runs", "Observability workflow run records"),
      route("GET", "/api/events", "Observability event records"),
      route("GET", "/api/costs", "Observability cost records"),
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
    "pack_id",
    "capability_id",
    "artifact_id",
    "artifact_type",
    "domain_pack",
    "delivery_state",
    "approval_status",
    "run_id",
    "workflow_run_id",
    "runtime_id",
    "type",
    "event_type",
    "correlation_id",
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
