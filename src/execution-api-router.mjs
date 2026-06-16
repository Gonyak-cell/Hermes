import { buildExecutionReadinessModel } from "./execution-readiness-model.mjs";
import { buildReadOnlyMethodNotAllowed, isReadOnlyRouteMethod } from "./read-only-route-guard.mjs";

export const EXECUTION_API_ROUTES = [
  {
    method: "GET",
    path: "/api/execution/readiness",
    description: "Read-only execution maturity readiness rows and blockers",
  },
];

const READINESS_FILTER_KEYS = [
  "level",
  "product_id",
  "project_id",
  "domain_pack_id",
  "readiness_status",
  "source_ready",
  "blocker_reason",
];

export async function buildExecutionApiRouteResponse({ pathname, url, method = "GET", options = {}, generatedAt = new Date().toISOString() }) {
  if (!String(pathname).startsWith("/api/execution")) return { handled: false };
  if (!isReadOnlyRouteMethod(method)) {
    return { handled: true, status: 405, body: buildReadOnlyMethodNotAllowed(method) };
  }
  if (pathname === "/api/execution/readiness") {
    const readiness = await buildExecutionReadinessModel({ ...options, write: false });
    return {
      handled: true,
      status: 200,
      body: buildExecutionReadinessCollection(readiness, url, generatedAt),
    };
  }
  return {
    handled: true,
    status: 404,
    body: {
      schema_version: "execution-api-error.v1",
      error: "not_found",
      message: `Unknown execution API route: ${pathname}`,
    },
  };
}

export function buildExecutionReadinessCollection(readiness, url, generatedAt) {
  const rows = filterRows(readiness.execution_readiness_rows, url.searchParams, READINESS_FILTER_KEYS);
  const limitedRows = limitRows(rows, url.searchParams);
  return {
    schema_version: "execution-api-collection.v1",
    generated_at: generatedAt,
    collection: "execution_readiness_rows",
    count: limitedRows.length,
    total_count: readiness.execution_readiness_rows.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    items: limitedRows,
    source_rows: readiness.execution_readiness_source_rows,
    route_rows: readiness.execution_readiness_route_rows,
    boundary: readiness.execution_readiness_boundary,
    summary: readiness.summary,
  };
}

function filterRows(rows, searchParams, filterKeys) {
  return rows.filter((row) => {
    for (const key of filterKeys) {
      if (!searchParams.has(key)) continue;
      const expected = searchParams.get(key);
      const actual = row[key];
      if (String(actual) !== String(expected)) return false;
    }
    return true;
  });
}

function limitRows(rows, searchParams) {
  const rawLimit = Number(searchParams.get("limit") ?? rows.length);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.min(rawLimit, 1000) : rows.length;
  return rows.slice(0, limit);
}
