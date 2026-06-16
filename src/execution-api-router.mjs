import { buildExecutionReadinessModel } from "./execution-readiness-model.mjs";
import { buildPersonalDevDryRunSandboxLane } from "./personal-dev-dry-run-sandbox-lane.mjs";
import { buildPersonalDevExecutionCandidateLane } from "./personal-dev-execution-candidate-lane.mjs";
import { buildReadOnlyMethodNotAllowed, isReadOnlyRouteMethod } from "./read-only-route-guard.mjs";

export const EXECUTION_API_ROUTES = [
  {
    method: "GET",
    path: "/api/execution/readiness",
    description: "Read-only execution maturity readiness rows and blockers",
  },
  {
    method: "GET",
    path: "/api/execution/personal-dev-candidates",
    description: "Read-only personal-dev execution candidate rows",
  },
  {
    method: "GET",
    path: "/api/execution/personal-dev-dry-runs",
    description: "Read-only personal-dev dry-run sandbox rows",
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

const PERSONAL_DEV_CANDIDATE_FILTER_KEYS = [
  "candidate_id",
  "candidate_kind",
  "source_panel_section",
  "candidate_status",
  "domain_pack_id",
  "project_id",
];

const PERSONAL_DEV_DRY_RUN_FILTER_KEYS = [
  "dry_run_id",
  "candidate_id",
  "candidate_kind",
  "source_panel_section",
  "dry_run_status",
  "planned_runtime_id",
  "project_id",
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
  if (pathname === "/api/execution/personal-dev-candidates") {
    const candidateLane = await buildPersonalDevExecutionCandidateLane({ ...options, write: false });
    return {
      handled: true,
      status: 200,
      body: buildPersonalDevExecutionCandidateCollection(candidateLane, url, generatedAt),
    };
  }
  if (pathname === "/api/execution/personal-dev-dry-runs") {
    const dryRunLane = await buildPersonalDevDryRunSandboxLane({ ...options, write: false });
    return {
      handled: true,
      status: 200,
      body: buildPersonalDevDryRunCollection(dryRunLane, url, generatedAt),
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

export function buildPersonalDevExecutionCandidateCollection(candidateLane, url, generatedAt) {
  const rows = filterRows(candidateLane.personal_dev_execution_candidate_rows, url.searchParams, PERSONAL_DEV_CANDIDATE_FILTER_KEYS);
  const limitedRows = limitRows(rows, url.searchParams);
  return {
    schema_version: "execution-api-collection.v1",
    generated_at: generatedAt,
    collection: "personal_dev_execution_candidate_rows",
    count: limitedRows.length,
    total_count: candidateLane.personal_dev_execution_candidate_rows.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    items: limitedRows,
    artifact_binding_rows: candidateLane.personal_dev_execution_artifact_binding_rows,
    route_rows: candidateLane.personal_dev_execution_candidate_route_rows,
    boundary: candidateLane.personal_dev_execution_candidate_boundary,
    summary: candidateLane.summary,
  };
}

export function buildPersonalDevDryRunCollection(dryRunLane, url, generatedAt) {
  const rows = filterRows(dryRunLane.personal_dev_dry_run_sandbox_rows, url.searchParams, PERSONAL_DEV_DRY_RUN_FILTER_KEYS);
  const limitedRows = limitRows(rows, url.searchParams);
  return {
    schema_version: "execution-api-collection.v1",
    generated_at: generatedAt,
    collection: "personal_dev_dry_run_sandbox_rows",
    count: limitedRows.length,
    total_count: dryRunLane.personal_dev_dry_run_sandbox_rows.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    items: limitedRows,
    invocation_rows: dryRunLane.personal_dev_dry_run_invocation_rows,
    route_rows: dryRunLane.personal_dev_dry_run_route_rows,
    boundary: dryRunLane.personal_dev_dry_run_boundary,
    summary: dryRunLane.summary,
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
