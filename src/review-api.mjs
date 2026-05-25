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
  if (pathname === "/api/identity-models") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_models", [identityResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/identity-users") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_users", identityResult.artifact.identity_contract?.users ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-roles") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_roles", identityResult.artifact.identity_contract?.roles ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-role-assignments") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_role_assignments", identityResult.artifact.identity_contract?.role_assignments ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-actors") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_actors", identityResult.artifact.identity_contract?.actor_principals ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-bindings") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_bindings", identityResult.artifact.identity_contract?.actor_user_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-validations") {
    const identityResult = await readDashboardSourceArtifact(dashboard, "identity_model");
    if (!identityResult.available) {
      return jsonResponse(503, buildError("identity_model_unavailable", identityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_validations", identityResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "resource_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("resource_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_contract_freezes", [freezeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/resource-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "resource_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("resource_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_v2_contracts", freezeResult.artifact.resource_contract?.resources ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/resource-version-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "resource_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("resource_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_version_v2_contracts", freezeResult.artifact.resource_contract?.resource_versions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/resource-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "resource_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("resource_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_contract_freezes", [freezeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/client-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("client_v2_contracts", freezeResult.artifact.matter_contract?.clients ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/party-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("party_v2_contracts", freezeResult.artifact.matter_contract?.parties ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_v2_contracts", freezeResult.artifact.matter_contract?.matters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-team-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_team_v2_contracts", freezeResult.artifact.matter_contract?.matter_teams ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-boundary-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_boundary_v2_contracts", freezeResult.artifact.matter_contract?.matter_boundaries ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "matter_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("matter_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/client-counterparty-registries") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("client_counterparty_registries", [registryResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/party-registry") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("party_registry", registryResult.artifact.registry_contract?.party_registry ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/client-registry") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("client_registry", registryResult.artifact.registry_contract?.client_registry ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/counterparty-registry") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("counterparty_registry", registryResult.artifact.registry_contract?.counterparty_registry ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-party-links") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_party_links", registryResult.artifact.registry_contract?.matter_party_links ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/conflict-reference-index") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("conflict_reference_index", registryResult.artifact.registry_contract?.conflict_reference_index ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/client-counterparty-validations") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "client_counterparty_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("client_counterparty_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("client_counterparty_validations", registryResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-profile-team-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_profile_team_ledgers", [ledgerResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-profiles") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_profiles", ledgerResult.artifact.matter_team_contract?.matter_profiles ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-team-rosters") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_team_rosters", ledgerResult.artifact.matter_team_contract?.matter_team_rosters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-team-memberships") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_team_memberships", ledgerResult.artifact.matter_team_contract?.matter_team_memberships ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-access-subjects") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_access_subjects", ledgerResult.artifact.matter_team_contract?.matter_access_subjects ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-profile-team-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_profile_team_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_profile_team_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_profile_team_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/wall-policy-contracts") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("wall_policy_contracts", [contractResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/wall-policy-rules") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("wall_policy_rules", contractResult.artifact.wall_policy_contract?.wall_policy_rules ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/retrieval-wall-filters") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("retrieval_wall_filters", contractResult.artifact.wall_policy_contract?.retrieval_wall_filters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/wall-subject-bindings") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("wall_subject_bindings", contractResult.artifact.wall_policy_contract?.wall_subject_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/conflict-wall-bindings") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("conflict_wall_bindings", contractResult.artifact.wall_policy_contract?.conflict_wall_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/wall-policy-validations") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "wall_policy_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("wall_policy_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("wall_policy_validations", contractResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-access-policy-evaluators") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_access_policy_evaluators", [evaluatorResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/matter-access-policy-rules") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_access_policy_rules", evaluatorResult.artifact.matter_access_policy?.access_policy_rules ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-access-decisions") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("matter_access_decisions", evaluatorResult.artifact.matter_access_policy?.matter_access_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/resource-access-decisions") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_access_decisions", evaluatorResult.artifact.matter_access_policy?.resource_access_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-access-matrix") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_access_matrix", evaluatorResult.artifact.matter_access_policy?.runtime_access_matrix ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/matter-access-policy-validations") {
    const evaluatorResult = await readDashboardSourceArtifact(dashboard, "matter_access_policy_evaluator");
    if (!evaluatorResult.available) {
      return jsonResponse(503, buildError("matter_access_policy_evaluator_unavailable", evaluatorResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_access_policy_validations", evaluatorResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/data-classification-rule-engines") {
    const engineResult = await readDashboardSourceArtifact(dashboard, "data_classification_rule_engine");
    if (!engineResult.available) {
      return jsonResponse(503, buildError("data_classification_rule_engine_unavailable", engineResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("data_classification_rule_engines", [engineResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/data-classification-rules") {
    const engineResult = await readDashboardSourceArtifact(dashboard, "data_classification_rule_engine");
    if (!engineResult.available) {
      return jsonResponse(503, buildError("data_classification_rule_engine_unavailable", engineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("data_classification_rules", engineResult.artifact.classification_rule_catalog?.classification_rules ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/resource-classification-decisions") {
    const engineResult = await readDashboardSourceArtifact(dashboard, "data_classification_rule_engine");
    if (!engineResult.available) {
      return jsonResponse(503, buildError("data_classification_rule_engine_unavailable", engineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("resource_classification_decisions", engineResult.artifact.classification_rule_catalog?.resource_classification_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/classification-policy-bindings") {
    const engineResult = await readDashboardSourceArtifact(dashboard, "data_classification_rule_engine");
    if (!engineResult.available) {
      return jsonResponse(503, buildError("data_classification_rule_engine_unavailable", engineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("classification_policy_bindings", engineResult.artifact.classification_rule_catalog?.classification_policy_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/data-classification-rule-validations") {
    const engineResult = await readDashboardSourceArtifact(dashboard, "data_classification_rule_engine");
    if (!engineResult.available) {
      return jsonResponse(503, buildError("data_classification_rule_engine_unavailable", engineResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("data_classification_rule_validations", engineResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_decisions", ledgerResult.artifact.matter_tagging_catalog?.matter_tagging_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-candidates") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_candidates", ledgerResult.artifact.matter_tagging_catalog?.automatic_tagging_candidates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-confirmations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_confirmations", ledgerResult.artifact.matter_tagging_catalog?.human_confirmation_queue ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-corrections") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_corrections", ledgerResult.artifact.matter_tagging_catalog?.correction_history ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-tagging-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "matter_tagging_decision_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("matter_tagging_decision_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_tagging_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/access-audit-projections") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "access_audit_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("access_audit_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("access_audit_projections", [projectionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/access-audit-records") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "access_audit_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("access_audit_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("access_audit_records", projectionResult.artifact.access_audit_catalog?.access_audit_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/access-audit-actor-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "access_audit_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("access_audit_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("access_audit_actor_rollups", projectionResult.artifact.access_audit_catalog?.actor_access_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/access-audit-resource-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "access_audit_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("access_audit_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("access_audit_resource_rollups", projectionResult.artifact.access_audit_catalog?.resource_access_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/access-audit-validations") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "access_audit_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("access_audit_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("access_audit_validations", projectionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/store-policy-adapters") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("store_policy_adapters", [adapterResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/store-policy-rules") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("store_policy_rules", adapterResult.artifact.store_policy_catalog?.store_policy_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/rls-filter-templates") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("rls_filter_templates", adapterResult.artifact.store_policy_catalog?.rls_filter_templates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/store-query-plans") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("store_query_plans", adapterResult.artifact.store_policy_catalog?.store_query_plans ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/store-enforcement-probes") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("store_enforcement_probes", adapterResult.artifact.store_policy_catalog?.enforcement_probes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/store-policy-validations") {
    const adapterResult = await readDashboardSourceArtifact(dashboard, "store_policy_adapter");
    if (!adapterResult.available) {
      return jsonResponse(503, buildError("store_policy_adapter_unavailable", adapterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("store_policy_validations", adapterResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/conflict-check-interfaces") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "conflict_check_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("conflict_check_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("conflict_check_interfaces", [interfaceResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/conflict-check-requests") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "conflict_check_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("conflict_check_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("conflict_check_requests", interfaceResult.artifact.conflict_check_catalog?.conflict_check_requests ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/conflict-check-results") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "conflict_check_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("conflict_check_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("conflict_check_results", interfaceResult.artifact.conflict_check_catalog?.conflict_check_results ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/conflict-check-signals") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "conflict_check_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("conflict_check_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("conflict_check_signals", interfaceResult.artifact.conflict_check_catalog?.conflict_signals ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/conflict-check-validations") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "conflict_check_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("conflict_check_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("conflict_check_validations", interfaceResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/personal-workspace-boundaries") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("personal_workspace_boundaries", [boundaryResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workspace-boundaries") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workspace_boundaries", boundaryResult.artifact.workspace_boundary_catalog?.workspace_boundaries ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/tenant-policy-boundaries") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tenant_policy_boundaries", boundaryResult.artifact.workspace_boundary_catalog?.tenant_policy_boundaries ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/search-namespace-policies") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_namespace_policies", boundaryResult.artifact.workspace_boundary_catalog?.search_namespace_policies ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/cross-workspace-probes") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cross_workspace_probes", boundaryResult.artifact.workspace_boundary_catalog?.cross_workspace_probes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/personal-workspace-boundary-validations") {
    const boundaryResult = await readDashboardSourceArtifact(dashboard, "personal_workspace_boundary");
    if (!boundaryResult.available) {
      return jsonResponse(503, buildError("personal_workspace_boundary_unavailable", boundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("personal_workspace_boundary_validations", boundaryResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-golden-fixtures") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "policy_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("policy_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_golden_fixtures", [fixturesResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/policy-fixture-cases") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "policy_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("policy_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_fixture_cases", fixturesResult.artifact.policy_golden_fixture_catalog?.policy_fixture_cases ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-outcome-matrix") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "policy_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("policy_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_outcome_matrix", [fixturesResult.artifact.policy_golden_fixture_catalog?.policy_outcome_matrix ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/policy-regression-hashes") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "policy_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("policy_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_regression_hashes", fixturesResult.artifact.policy_golden_fixture_catalog?.policy_regression_manifest?.policy_regression_hashes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-golden-fixture-validations") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "policy_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("policy_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_golden_fixture_validations", fixturesResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-operation-surfaces") {
    const surfaceResult = await readDashboardSourceArtifact(dashboard, "policy_operations_surface");
    if (!surfaceResult.available) {
      return jsonResponse(503, buildError("policy_operations_surface_unavailable", surfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_operation_surfaces", [surfaceResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/policy-decision-rows") {
    const surfaceResult = await readDashboardSourceArtifact(dashboard, "policy_operations_surface");
    if (!surfaceResult.available) {
      return jsonResponse(503, buildError("policy_operations_surface_unavailable", surfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_decision_rows", surfaceResult.artifact.policy_operations_catalog?.policy_decision_rows ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-violation-rows") {
    const surfaceResult = await readDashboardSourceArtifact(dashboard, "policy_operations_surface");
    if (!surfaceResult.available) {
      return jsonResponse(503, buildError("policy_operations_surface_unavailable", surfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_violation_rows", surfaceResult.artifact.policy_operations_catalog?.policy_violation_rows ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-pending-approvals") {
    const surfaceResult = await readDashboardSourceArtifact(dashboard, "policy_operations_surface");
    if (!surfaceResult.available) {
      return jsonResponse(503, buildError("policy_operations_surface_unavailable", surfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_pending_approvals", surfaceResult.artifact.policy_operations_catalog?.policy_pending_approval_rows ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-surface-validations") {
    const surfaceResult = await readDashboardSourceArtifact(dashboard, "policy_operations_surface");
    if (!surfaceResult.available) {
      return jsonResponse(503, buildError("policy_operations_surface_unavailable", surfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_surface_validations", surfaceResult.artifact.validation_items ?? [], url, generatedAt), method);
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
  if (pathname === "/api/policy-snapshot-binding-ledgers") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_binding_ledgers", [bindingResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.workflow_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/agent-run-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("agent_run_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.agent_run_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/event-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.event_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/gate-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.gate_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/approval-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("approval_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.approval_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/output-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_policy_bindings", bindingResult.artifact.policy_snapshot_binding_catalog?.output_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-snapshot-binding-validations") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_binding_ledger");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_binding_ledger_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_binding_validations", bindingResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "policy_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("policy_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/data-classification-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "policy_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("policy_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("data_classification_contracts", freezeResult.artifact.policy_contract?.data_classifications ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/policy-reference-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "policy_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("policy_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("policy_reference_contracts", freezeResult.artifact.policy_contract?.policy_references ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/policy-decision-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "policy_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("policy_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("policy_decision_contracts", freezeResult.artifact.policy_contract?.policy_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/policy-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "policy_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("policy_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("policy_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/evidence-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("source_span_contracts", freezeResult.artifact.evidence_contract?.source_spans ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/evidence-item-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("evidence_item_contracts", freezeResult.artifact.evidence_contract?.evidence_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/fact-claim-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("fact_claim_contracts", freezeResult.artifact.evidence_contract?.fact_claims ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/issue-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("issue_contracts", freezeResult.artifact.evidence_contract?.issues ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/citation-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("citation_contracts", freezeResult.artifact.evidence_contract?.citations ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/evidence-lineage-edges") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("evidence_lineage_edges", freezeResult.artifact.evidence_contract?.lineage_edges ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/evidence-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("evidence_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-workflow-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("capability_workflow_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/capability-manifest-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_v2_contracts", freezeResult.artifact.capability_workflow_contract?.capability_manifests ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_v2_contracts", freezeResult.artifact.capability_workflow_contract?.workflows ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_v2_contracts", freezeResult.artifact.capability_workflow_contract?.workflow_runs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_v2_contracts", freezeResult.artifact.capability_workflow_contract?.agent_runs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-io-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_io_contracts", freezeResult.artifact.capability_workflow_contract?.capability_io_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-gate-runtime-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_gate_runtime_contracts", freezeResult.artifact.capability_workflow_contract?.gate_runtime_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-execution-bindings") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_execution_bindings", freezeResult.artifact.capability_workflow_contract?.workflow_execution_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-workflow-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "capability_workflow_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("capability_workflow_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_workflow_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-agentrun-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("runtime_agentrun_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/runtime-adapter-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_adapter_v2_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_adapters ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-execution-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_execution_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_execution_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-runtime-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_runtime_contracts", freezeResult.artifact.runtime_agentrun_contract?.agent_runs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-output-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_output_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_outputs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-log-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_log_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_logs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-artifact-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_artifact_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_artifacts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-verification-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_verification_contracts", freezeResult.artifact.runtime_agentrun_contract?.runtime_verifications ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/runtime-agentrun-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "runtime_agentrun_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("runtime_agentrun_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("runtime_agentrun_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/gate-approval-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_approval_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/gate-result-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_result_contracts", freezeResult.artifact.gate_approval_contract?.gate_results ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/approval-request-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("approval_request_contracts", freezeResult.artifact.gate_approval_contract?.approval_requests ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/approval-decision-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("approval_decision_contracts", freezeResult.artifact.gate_approval_contract?.approval_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-gate-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_gate_v2_contracts", freezeResult.artifact.gate_approval_contract?.human_gate_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/approval-authority-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("approval_authority_contracts", freezeResult.artifact.gate_approval_contract?.approval_authority_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/gate-approval-bindings") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_approval_bindings", freezeResult.artifact.gate_approval_contract?.gate_approval_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/gate-approval-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "gate_approval_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("gate_approval_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_approval_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/output-delivery-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_delivery_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/output-artifact-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("output_artifact_v2_contracts", freezeResult.artifact.output_delivery_contract?.output_artifacts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-action-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_action_v2_contracts", freezeResult.artifact.output_delivery_contract?.delivery_actions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-receipt-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_receipt_v2_contracts", freezeResult.artifact.output_delivery_contract?.delivery_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/output-delivery-bindings") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("output_delivery_bindings", freezeResult.artifact.output_delivery_contract?.output_delivery_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/delivery-state-transitions") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("delivery_state_transitions", freezeResult.artifact.output_delivery_contract?.delivery_state_transitions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/output-delivery-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "output_delivery_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("output_delivery_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("output_delivery_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-audit-run-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_audit_run_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/event-record-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_record_v2_contracts", freezeResult.artifact.event_audit_run_contract?.event_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-event-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_event_v2_contracts", freezeResult.artifact.event_audit_run_contract?.audit_events ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/run-ledger-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("run_ledger_v2_contracts", freezeResult.artifact.event_audit_run_contract?.run_ledgers ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-run-bindings") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_run_bindings", freezeResult.artifact.event_audit_run_contract?.event_run_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-audit-run-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "event_audit_run_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("event_audit_run_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_audit_run_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/error-cost-observability-contract-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "error_cost_observability_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("error_cost_observability_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("error_cost_observability_contract_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/error-record-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "error_cost_observability_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("error_cost_observability_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("error_record_v2_contracts", freezeResult.artifact.error_cost_observability_contract?.error_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/cost-observation-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "error_cost_observability_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("error_cost_observability_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("cost_observation_v2_contracts", freezeResult.artifact.error_cost_observability_contract?.cost_observations ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/trace-projection-v2-contracts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "error_cost_observability_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("error_cost_observability_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("trace_projection_v2_contracts", freezeResult.artifact.error_cost_observability_contract?.trace_projections ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/error-cost-observability-contract-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "error_cost_observability_contract_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("error_cost_observability_contract_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("error_cost_observability_contract_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
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
  if (pathname === "/api/model-policy-enforcements") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "model_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("model_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("model_policy_enforcements", [enforcementResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/classification-model-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "model_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("model_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("classification_model_gates", enforcementResult.artifact.model_policy_gate_catalog?.classification_model_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-model-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "model_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("model_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_model_gates", enforcementResult.artifact.model_policy_gate_catalog?.resource_model_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/route-model-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "model_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("model_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("route_model_gates", enforcementResult.artifact.model_policy_gate_catalog?.route_model_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/model-policy-enforcement-validations") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "model_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("model_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("model_policy_enforcement_validations", enforcementResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/tool-runtime-policy-enforcements") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "tool_runtime_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("tool_runtime_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tool_runtime_policy_enforcements", [enforcementResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/runtime-policy-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "tool_runtime_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("tool_runtime_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("runtime_policy_gates", enforcementResult.artifact.tool_runtime_policy_catalog?.runtime_policy_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/tool-permission-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "tool_runtime_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("tool_runtime_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tool_permission_gates", enforcementResult.artifact.tool_runtime_policy_catalog?.tool_permission_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/agent-run-tool-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "tool_runtime_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("tool_runtime_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("agent_run_tool_gates", enforcementResult.artifact.tool_runtime_policy_catalog?.agent_run_tool_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/tool-runtime-policy-validations") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "tool_runtime_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("tool_runtime_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tool_runtime_policy_validations", enforcementResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/output-destination-policy-enforcements") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_destination_policy_enforcements", [enforcementResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/policy-destination-rules") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_destination_rules", enforcementResult.artifact.output_destination_policy_catalog?.policy_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/artifact-destination-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("artifact_destination_gates", enforcementResult.artifact.output_destination_policy_catalog?.artifact_destination_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/delivery-action-destination-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("delivery_action_destination_gates", enforcementResult.artifact.output_destination_policy_catalog?.delivery_action_destination_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/final-action-separation-gates") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("final_action_separation_gates", enforcementResult.artifact.output_destination_policy_catalog?.final_action_separation_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/output-destination-policy-validations") {
    const enforcementResult = await readDashboardSourceArtifact(dashboard, "output_destination_policy_enforcement");
    if (!enforcementResult.available) {
      return jsonResponse(503, buildError("output_destination_policy_enforcement_unavailable", enforcementResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_destination_policy_validations", enforcementResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/approval-authority-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("approval_authority_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/authority-policies") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("authority_policies", ledgerResult.artifact.approval_authority_catalog?.authority_policies ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/artifact-authority-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("artifact_authority_decisions", ledgerResult.artifact.approval_authority_catalog?.artifact_authority_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/approval-request-authority-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("approval_request_authority_decisions", ledgerResult.artifact.approval_authority_catalog?.approval_request_authority_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/delivery-action-authority-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("delivery_action_authority_decisions", ledgerResult.artifact.approval_authority_catalog?.delivery_action_authority_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/approval-authority-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "approval_authority_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("approval_authority_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("approval_authority_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt), method);
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
  if (pathname === "/api/contract-inventories") {
    const inventoryResult = await readDashboardSourceArtifact(dashboard, "contract_inventory");
    if (!inventoryResult.available) {
      return jsonResponse(503, buildError("contract_inventory_unavailable", inventoryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_inventories", [inventoryResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-inventory-items") {
    const inventoryResult = await readDashboardSourceArtifact(dashboard, "contract_inventory");
    if (!inventoryResult.available) {
      return jsonResponse(503, buildError("contract_inventory_unavailable", inventoryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_inventory_items", inventoryResult.artifact.inventory_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-schemas") {
    const inventoryResult = await readDashboardSourceArtifact(dashboard, "contract_inventory");
    if (!inventoryResult.available) {
      return jsonResponse(503, buildError("contract_inventory_unavailable", inventoryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_schemas", inventoryResult.artifact.schemas ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-artifacts") {
    const inventoryResult = await readDashboardSourceArtifact(dashboard, "contract_inventory");
    if (!inventoryResult.available) {
      return jsonResponse(503, buildError("contract_inventory_unavailable", inventoryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_artifacts", inventoryResult.artifact.artifact_contracts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-owner-map") {
    const inventoryResult = await readDashboardSourceArtifact(dashboard, "contract_inventory");
    if (!inventoryResult.available) {
      return jsonResponse(503, buildError("contract_inventory_unavailable", inventoryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_owner_map", inventoryResult.artifact.owner_map ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-dependency-maps") {
    const dependencyResult = await readDashboardSourceArtifact(dashboard, "contract_dependency_map");
    if (!dependencyResult.available) {
      return jsonResponse(503, buildError("contract_dependency_map_unavailable", dependencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_dependency_maps", [dependencyResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-dependency-nodes") {
    const dependencyResult = await readDashboardSourceArtifact(dashboard, "contract_dependency_map");
    if (!dependencyResult.available) {
      return jsonResponse(503, buildError("contract_dependency_map_unavailable", dependencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_dependency_nodes", dependencyResult.artifact.nodes ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-dependency-edges") {
    const dependencyResult = await readDashboardSourceArtifact(dashboard, "contract_dependency_map");
    if (!dependencyResult.available) {
      return jsonResponse(503, buildError("contract_dependency_map_unavailable", dependencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_dependency_edges", dependencyResult.artifact.edges ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-breaking-change-risks") {
    const dependencyResult = await readDashboardSourceArtifact(dashboard, "contract_dependency_map");
    if (!dependencyResult.available) {
      return jsonResponse(503, buildError("contract_dependency_map_unavailable", dependencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_breaking_change_risks", dependencyResult.artifact.breaking_change_risks ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-owner-dependencies") {
    const dependencyResult = await readDashboardSourceArtifact(dashboard, "contract_dependency_map");
    if (!dependencyResult.available) {
      return jsonResponse(503, buildError("contract_dependency_map_unavailable", dependencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_owner_dependencies", dependencyResult.artifact.owner_dependencies ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-versioning-rules") {
    const rulesResult = await readDashboardSourceArtifact(dashboard, "schema_versioning_rules");
    if (!rulesResult.available) {
      return jsonResponse(503, buildError("schema_versioning_rules_unavailable", rulesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_versioning_rules", [rulesResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-version-policies") {
    const rulesResult = await readDashboardSourceArtifact(dashboard, "schema_versioning_rules");
    if (!rulesResult.available) {
      return jsonResponse(503, buildError("schema_versioning_rules_unavailable", rulesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_version_policies", rulesResult.artifact.rulebook?.required_rules ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-version-records") {
    const rulesResult = await readDashboardSourceArtifact(dashboard, "schema_versioning_rules");
    if (!rulesResult.available) {
      return jsonResponse(503, buildError("schema_versioning_rules_unavailable", rulesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_version_records", rulesResult.artifact.schema_versions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-legacy-exceptions") {
    const rulesResult = await readDashboardSourceArtifact(dashboard, "schema_versioning_rules");
    if (!rulesResult.available) {
      return jsonResponse(503, buildError("schema_versioning_rules_unavailable", rulesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_legacy_exceptions", rulesResult.artifact.legacy_exceptions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-versioning-validations") {
    const rulesResult = await readDashboardSourceArtifact(dashboard, "schema_versioning_rules");
    if (!rulesResult.available) {
      return jsonResponse(503, buildError("schema_versioning_rules_unavailable", rulesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_versioning_validations", rulesResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-migration-manifests") {
    const manifestResult = await readDashboardSourceArtifact(dashboard, "schema_migration_manifest");
    if (!manifestResult.available) {
      return jsonResponse(503, buildError("schema_migration_manifest_unavailable", manifestResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_migration_manifests", [manifestResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-migration-manifest-records") {
    const manifestResult = await readDashboardSourceArtifact(dashboard, "schema_migration_manifest");
    if (!manifestResult.available) {
      return jsonResponse(503, buildError("schema_migration_manifest_unavailable", manifestResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_migration_manifest_records", manifestResult.artifact.migration_manifests ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-migration-records") {
    const manifestResult = await readDashboardSourceArtifact(dashboard, "schema_migration_manifest");
    if (!manifestResult.available) {
      return jsonResponse(503, buildError("schema_migration_manifest_unavailable", manifestResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_migration_records", manifestResult.artifact.migration_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/schema-migration-validations") {
    const manifestResult = await readDashboardSourceArtifact(dashboard, "schema_migration_manifest");
    if (!manifestResult.available) {
      return jsonResponse(503, buildError("schema_migration_manifest_unavailable", manifestResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("schema_migration_validations", manifestResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-golden-fixtures") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "contract_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("contract_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_golden_fixtures", [fixturesResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-golden-fixture-records") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "contract_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("contract_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_golden_fixture_records", fixturesResult.artifact.golden_fixtures ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-golden-regression-hashes") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "contract_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("contract_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_golden_regression_hashes", fixturesResult.artifact.regression_hash_manifest?.regression_hashes ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-golden-fixture-validations") {
    const fixturesResult = await readDashboardSourceArtifact(dashboard, "contract_golden_fixtures");
    if (!fixturesResult.available) {
      return jsonResponse(503, buildError("contract_golden_fixtures_unavailable", fixturesResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_golden_fixture_validations", fixturesResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-validation-suites") {
    const suiteResult = await readDashboardSourceArtifact(dashboard, "contract_validation_suite");
    if (!suiteResult.available) {
      return jsonResponse(503, buildError("contract_validation_suite_unavailable", suiteResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_validation_suites", [suiteResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-validation-fixture-results") {
    const suiteResult = await readDashboardSourceArtifact(dashboard, "contract_validation_suite");
    if (!suiteResult.available) {
      return jsonResponse(503, buildError("contract_validation_suite_unavailable", suiteResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_validation_fixture_results", suiteResult.artifact.fixture_validation_results ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-validation-commands") {
    const suiteResult = await readDashboardSourceArtifact(dashboard, "contract_validation_suite");
    if (!suiteResult.available) {
      return jsonResponse(503, buildError("contract_validation_suite_unavailable", suiteResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_validation_commands", suiteResult.artifact.validation_command_manifest?.required_package_scripts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/contract-validation-items") {
    const suiteResult = await readDashboardSourceArtifact(dashboard, "contract_validation_suite");
    if (!suiteResult.available) {
      return jsonResponse(503, buildError("contract_validation_suite_unavailable", suiteResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("contract_validation_items", suiteResult.artifact.validation_items ?? [], url, generatedAt),
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
  if (pathname === "/api/human-review-cycle-reviewer-consoles") {
    const consoleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_reviewer_console");
    if (!consoleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_reviewer_console_unavailable", consoleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_reviewer_consoles", [consoleResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-console-items") {
    const consoleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_reviewer_console");
    if (!consoleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_reviewer_console_unavailable", consoleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_console_items", consoleResult.artifact.console_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-consoles") {
    const consoleResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_reviewer_console");
    if (!consoleResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_reviewer_console_unavailable", consoleResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_consoles", consoleResult.artifact.actor_consoles ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-field-audits") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_field_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_field_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_field_audits", [auditResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-field-audit-items") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_field_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_field_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_field_audit_items", auditResult.artifact.field_audit_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-field-audits") {
    const auditResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_field_audit");
    if (!auditResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_field_audit_unavailable", auditResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_field_audits", auditResult.artifact.actor_field_audits ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-packs") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_packs", [packResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-items") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_items", packResult.artifact.completion_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-packs") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_packs", packResult.artifact.actor_completion_packs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-verifications") {
    const verificationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_verification");
    if (!verificationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_verification_unavailable", verificationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_verifications", [verificationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-verification-items") {
    const verificationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_verification");
    if (!verificationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_verification_unavailable", verificationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_verification_items", verificationResult.artifact.verification_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-verifications") {
    const verificationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_verification");
    if (!verificationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_verification_unavailable", verificationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_verifications", verificationResult.artifact.actor_verifications ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-workbenches") {
    const workbenchResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_workbench");
    if (!workbenchResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_workbench_unavailable", workbenchResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_workbenches", [workbenchResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-workbench-items") {
    const workbenchResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_workbench");
    if (!workbenchResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_workbench_unavailable", workbenchResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_workbench_items", workbenchResult.artifact.workbench_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-workbenches") {
    const workbenchResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_workbench");
    if (!workbenchResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_workbench_unavailable", workbenchResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_workbenches", workbenchResult.artifact.actor_workbenches ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-runbooks") {
    const runbookResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_runbook");
    if (!runbookResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_runbook_unavailable", runbookResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_runbooks", [runbookResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-runbook-steps") {
    const runbookResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_runbook");
    if (!runbookResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_runbook_unavailable", runbookResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_runbook_steps", runbookResult.artifact.runbook_steps ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-runbooks") {
    const runbookResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_runbook");
    if (!runbookResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_runbook_unavailable", runbookResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_runbooks", runbookResult.artifact.actor_runbooks ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-readiness") {
    const readinessResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_readiness");
    if (!readinessResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_readiness_unavailable", readinessResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_readiness", [readinessResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-gates") {
    const readinessResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_readiness");
    if (!readinessResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_readiness_unavailable", readinessResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_gates", readinessResult.artifact.command_gates ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-readiness") {
    const readinessResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_readiness");
    if (!readinessResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_readiness_unavailable", readinessResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_readiness", readinessResult.artifact.actor_readiness ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queues") {
    const commandQueueResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue");
    if (!commandQueueResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_unavailable", commandQueueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queues", [commandQueueResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queue-items") {
    const commandQueueResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue");
    if (!commandQueueResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_unavailable", commandQueueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queue_items", commandQueueResult.artifact.command_queue_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-held-commands") {
    const commandQueueResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue");
    if (!commandQueueResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_unavailable", commandQueueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_held_commands", commandQueueResult.artifact.held_command_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-actor-completion-command-queues") {
    const commandQueueResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue");
    if (!commandQueueResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_unavailable", commandQueueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_actor_completion_command_queues", commandQueueResult.artifact.actor_command_queues ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipts") {
    const commandReceiptsResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipts");
    if (!commandReceiptsResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipts_unavailable", commandReceiptsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipts", [commandReceiptsResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-requirements") {
    const commandReceiptsResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipts");
    if (!commandReceiptsResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipts_unavailable", commandReceiptsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_requirements", commandReceiptsResult.artifact.receipt_requirements ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-drafts") {
    const commandReceiptsResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipts");
    if (!commandReceiptsResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipts_unavailable", commandReceiptsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_drafts", commandReceiptsResult.artifact.receipt_input_draft?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-held-command-references") {
    const commandReceiptsResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipts");
    if (!commandReceiptsResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipts_unavailable", commandReceiptsResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_held_command_references", commandReceiptsResult.artifact.held_command_references ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_validations", [validationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-validation-items") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_validation_items", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-human-review-cycle-completion-command-receipts") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_human_review_cycle_completion_command_receipts", validationResult.artifact.validated_command_receipts?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-feedbacks") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_feedbacks", [feedbackResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-feedback-items") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_feedback_items", feedbackResult.artifact.feedback_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-actor-feedback") {
    const feedbackResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_feedback");
    if (!feedbackResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_feedback_unavailable", feedbackResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_actor_feedback", feedbackResult.artifact.actor_feedback ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspaces") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspaces", [workspaceResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspace-items") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspace_items", workspaceResult.artifact.workspace_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-actor-workspaces") {
    const workspaceResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace");
    if (!workspaceResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_unavailable", workspaceResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_actor_workspaces", workspaceResult.artifact.actor_workspaces ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspace-merges") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspace_merges", [mergeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-merge-items") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_merge_items", mergeResult.artifact.merge_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-actor-inputs") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_actor_inputs", mergeResult.artifact.actor_inputs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/merged-human-review-cycle-completion-command-receipt-input") {
    const mergeResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_merge");
    if (!mergeResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_merge_unavailable", mergeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("merged_human_review_cycle_completion_command_receipt_input", [mergeResult.artifact.receipt_input], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspace-validations") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspace_validations", [validationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspace-validation-items") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspace_validation_items", validationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-workspace-validation-errors") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_workspace_validation_errors", validationResult.artifact.receipt_errors ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/validated-human-review-cycle-completion-command-workspace-receipts") {
    const validationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_workspace_validation");
    if (!validationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_workspace_validation_unavailable", validationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("validated_human_review_cycle_completion_command_workspace_receipts", validationResult.artifact.validated_command_receipts?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-applications") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_applications", [applicationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/applied-human-review-cycle-completion-command-receipts") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("applied_human_review_cycle_completion_command_receipts", applicationResult.artifact.applied_command_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-application-pending-receipts") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_application_pending_receipts", applicationResult.artifact.pending_command_receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-receipt-application-audit-events") {
    const applicationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_receipt_application");
    if (!applicationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_receipt_application_unavailable", applicationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_receipt_application_audit_events", applicationResult.artifact.audit_events ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-reconciliations") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_reconciliations", [reconciliationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-reconciliation-items") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_reconciliation_items", reconciliationResult.artifact.reconciliation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-reconciliation-actors") {
    const reconciliationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_reconciliation");
    if (!reconciliationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_reconciliation_unavailable", reconciliationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_reconciliation_actors", reconciliationResult.artifact.actor_statuses ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-baselines") {
    const baselineResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_baseline");
    if (!baselineResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_baseline_unavailable", baselineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_baselines", [baselineResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-baseline-blockers") {
    const baselineResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_baseline");
    if (!baselineResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_baseline_unavailable", baselineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_baseline_blockers", baselineResult.artifact.blocker_inventory ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-baseline-count-checks") {
    const baselineResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_baseline");
    if (!baselineResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_baseline_unavailable", baselineResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_baseline_count_checks", baselineResult.artifact.count_checks ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-command-receipt-packs") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_command_receipt_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_command_receipt_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_command_receipt_packs", [packResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-command-receipt-pack-actors") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_command_receipt_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_command_receipt_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_command_receipt_pack_actors", packResult.artifact.actor_receipt_packs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-command-receipt-pack-items") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_command_receipt_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_command_receipt_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_command_receipt_pack_items", packResult.artifact.pack_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-held-command-resolutions") {
    const resolutionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_held_command_resolution");
    if (!resolutionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_held_command_resolution_unavailable", resolutionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_held_command_resolutions", [resolutionResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-held-command-resolution-plans") {
    const resolutionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_held_command_resolution");
    if (!resolutionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_held_command_resolution_unavailable", resolutionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_held_command_resolution_plans", resolutionResult.artifact.resolution_plans ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-held-command-resolution-actors") {
    const resolutionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_held_command_resolution");
    if (!resolutionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_held_command_resolution_unavailable", resolutionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_held_command_resolution_actors", resolutionResult.artifact.actor_resolution_plans ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-protected-approval-request-packs") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_protected_approval_request_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_protected_approval_request_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_protected_approval_request_packs", [packResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-protected-approval-requests") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_protected_approval_request_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_protected_approval_request_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_protected_approval_requests", packResult.artifact.approval_requests ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-protected-approval-actors") {
    const packResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_protected_approval_request_pack");
    if (!packResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_protected_approval_request_pack_unavailable", packResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_protected_approval_actors", packResult.artifact.actor_approval_packs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-revalidations") {
    const revalidationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_revalidation");
    if (!revalidationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_revalidation_unavailable", revalidationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_revalidations", [revalidationResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-revalidation-items") {
    const revalidationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_revalidation");
    if (!revalidationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_revalidation_unavailable", revalidationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_revalidation_items", revalidationResult.artifact.revalidation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-manual-revalidation-actors") {
    const revalidationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_revalidation");
    if (!revalidationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_revalidation_unavailable", revalidationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_manual_revalidation_actors", revalidationResult.artifact.actor_revalidations ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-ready-manual-receipts") {
    const revalidationResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_manual_revalidation");
    if (!revalidationResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_manual_revalidation_unavailable", revalidationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_ready_manual_receipts", revalidationResult.artifact.ready_manual_receipts?.receipts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queue-patch-projections") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue_patch_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_patch_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queue_patch_projections", [projectionResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queue-patch-projection-items") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue_patch_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_patch_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queue_patch_projection_items", projectionResult.artifact.projection_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queue-patch-operations") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue_patch_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_patch_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queue_patch_operations", projectionResult.artifact.patch_operations ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-command-queue-patch-audit-candidates") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_command_queue_patch_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_command_queue_patch_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_command_queue_patch_audit_candidates", projectionResult.artifact.audit_event_candidates ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-closeout-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_closeout_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_closeout_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_closeout_ledgers", [ledgerResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-closeout-items") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_closeout_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_closeout_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_closeout_items", ledgerResult.artifact.closeout_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-closeout-actors") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_closeout_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_closeout_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_closeout_actors", ledgerResult.artifact.actor_closeouts ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-cycle-completion-normalized-blocker-statuses") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "human_review_cycle_receipt_completion_closeout_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("human_review_cycle_receipt_completion_closeout_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_cycle_completion_normalized_blocker_statuses", ledgerResult.artifact.normalized_blocker_statuses ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-v1-regression-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "human_review_v1_regression_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("human_review_v1_regression_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_v1_regression_freezes", [freezeResult.artifact], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-v1-regression-fixture-artifacts") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "human_review_v1_regression_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("human_review_v1_regression_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_v1_regression_fixture_artifacts", freezeResult.artifact.regression_fixture?.artifact_refs ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-v1-regression-checkpoints") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "human_review_v1_regression_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("human_review_v1_regression_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_v1_regression_checkpoints", freezeResult.artifact.verification_checkpoints ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/human-review-v1-freeze-notes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "human_review_v1_regression_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("human_review_v1_regression_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("human_review_v1_freeze_notes", freezeResult.artifact.freeze_note ? [freezeResult.artifact.freeze_note] : [], url, generatedAt),
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
  console.log("Routes: /, /health, /api, /api/dashboard, /api/stages, /api/actions, /api/sources, /api/resource-contract-freezes, /api/resource-v2-contracts, /api/resource-version-v2-contracts, /api/resource-contract-validations, /api/evidence-review-drafts, /api/evidence-review-items, /api/policy-matrices, /api/policy-classifications, /api/runtime-policies, /api/model-policies, /api/tool-policies, /api/output-policies, /api/gate-policies, /api/policy-snapshot-ledgers, /api/policy-snapshots, /api/policy-snapshot-instances, /api/policy-decisions, /api/policy-usages, /api/context-packet-ledgers, /api/context-packets, /api/context-items, /api/context-retrieval-filters, /api/model-routing-ledgers, /api/model-routing-decisions, /api/cost-budget-ledgers, /api/cost-budget-decisions, /api/token-usage-ledgers, /api/token-usage-records, /api/cost-attribution-ledgers, /api/cost-attribution-records, /api/budget-alert-ledgers, /api/budget-alert-records, /api/packs, /api/capabilities, /api/artifacts, /api/runs, /api/events, /api/costs, /api/audit-trails, /api/audit-events, /api/audit-sources, /api/delivery-actions, /api/matters, /api/approvals, /api/approval-inbox-decisions, /api/delivery-execution-candidates, /api/delivery-execution-packets, /api/delivery-receipts, /api/delivery-receipt-events, /api/post-delivery-matters, /api/delivered-artifacts, /api/outstanding-receipts, /api/delivery-closeout-items, /api/receipt-input-drafts, /api/closeout-receipt-validations, /api/closeout-receipt-errors, /api/validated-receipts-to-apply, /api/closeout-receipt-applications, /api/closeout-applied-receipts, /api/pipeline-runs, /api/pipeline-steps, /api/control-plane-loops, /api/control-plane-loop-steps, /api/goal-checkpoints, /api/goal-checkpoint-items, /api/contract-inventories, /api/contract-inventory-items, /api/contract-schemas, /api/contract-artifacts, /api/contract-owner-map, /api/contract-dependency-maps, /api/contract-dependency-nodes, /api/contract-dependency-edges, /api/contract-breaking-change-risks, /api/contract-owner-dependencies, /api/control-plane-health, /api/health-checks, /api/action-plans, /api/action-plan-items, /api/human-gates, /api/human-gate-items, /api/human-gate-receipts, /api/human-gate-receipt-requirements, /api/human-gate-receipt-drafts, /api/human-review-packet-ledgers, /api/human-review-packets, /api/human-review-items, /api/human-gate-receipt-validations, /api/human-gate-receipt-errors, /api/validated-human-gate-receipts, /api/human-gate-receipt-applications, /api/applied-human-gate-receipts, /api/patched-human-gate-items, /api/action-work-packets, /api/action-work-items, /api/work-packet-receipt-requirements, /api/work-packet-receipt-drafts, /api/work-packet-receipt-validations, /api/work-packet-receipt-errors, /api/validated-work-packet-receipts, /api/work-packet-receipt-applications, /api/applied-work-packet-receipts");
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
      route("GET", "/api/identity-models", "Identity model artifacts"),
      route("GET", "/api/identity-users", "Identity human users"),
      route("GET", "/api/identity-roles", "Identity role catalog"),
      route("GET", "/api/identity-role-assignments", "Identity role assignment rows"),
      route("GET", "/api/identity-actors", "Identity actor principal rows"),
      route("GET", "/api/identity-bindings", "Identity actor-user binding rows"),
      route("GET", "/api/identity-validations", "Identity model validation rows"),
      route("GET", "/api/resource-contract-freezes", "Resource contract freeze artifacts"),
      route("GET", "/api/resource-v2-contracts", "Resource v2 contract fixtures"),
      route("GET", "/api/resource-version-v2-contracts", "ResourceVersion v2 contract fixtures"),
      route("GET", "/api/resource-contract-validations", "Resource contract validation rows"),
      route("GET", "/api/matter-contract-freezes", "Matter contract freeze artifacts"),
      route("GET", "/api/client-v2-contracts", "Client v2 contract fixtures"),
      route("GET", "/api/party-v2-contracts", "Party v2 contract fixtures"),
      route("GET", "/api/matter-v2-contracts", "Matter v2 contract fixtures"),
      route("GET", "/api/matter-team-v2-contracts", "MatterTeam v2 contract fixtures"),
      route("GET", "/api/matter-boundary-v2-contracts", "MatterBoundary v2 contract fixtures"),
      route("GET", "/api/matter-contract-validations", "Matter contract validation rows"),
      route("GET", "/api/client-counterparty-registries", "Client/counterparty registry artifacts"),
      route("GET", "/api/party-registry", "Stable party registry rows"),
      route("GET", "/api/client-registry", "Client registry rows"),
      route("GET", "/api/counterparty-registry", "Counterparty registry rows"),
      route("GET", "/api/matter-party-links", "Matter-party link rows"),
      route("GET", "/api/conflict-reference-index", "Conflict reference index rows"),
      route("GET", "/api/client-counterparty-validations", "Client/counterparty registry validation rows"),
      route("GET", "/api/matter-profile-team-ledgers", "Matter profile/team ledger artifacts"),
      route("GET", "/api/matter-profiles", "Matter profile rows"),
      route("GET", "/api/matter-team-rosters", "Matter team roster rows"),
      route("GET", "/api/matter-team-memberships", "Matter team membership rows"),
      route("GET", "/api/matter-access-subjects", "Matter access subject rows"),
      route("GET", "/api/matter-profile-team-validations", "Matter profile/team ledger validation rows"),
      route("GET", "/api/wall-policy-contracts", "Wall policy contract artifacts"),
      route("GET", "/api/wall-policy-rules", "Ethical wall policy rule rows"),
      route("GET", "/api/retrieval-wall-filters", "Pre-retrieval wall filter rows"),
      route("GET", "/api/wall-subject-bindings", "Wall subject binding rows"),
      route("GET", "/api/conflict-wall-bindings", "Conflict wall binding rows"),
      route("GET", "/api/wall-policy-validations", "Wall policy contract validation rows"),
      route("GET", "/api/matter-access-policy-evaluators", "Matter access policy evaluator artifacts"),
      route("GET", "/api/matter-access-policy-rules", "Matter access policy rule rows"),
      route("GET", "/api/matter-access-decisions", "Matter-level access decision rows"),
      route("GET", "/api/resource-access-decisions", "Resource-level access decision rows"),
      route("GET", "/api/runtime-access-matrix", "Runtime access matrix rows"),
      route("GET", "/api/matter-access-policy-validations", "Matter access policy validation rows"),
      route("GET", "/api/data-classification-rule-engines", "Data classification rule engine artifacts"),
      route("GET", "/api/data-classification-rules", "Data classification policy rule rows"),
      route("GET", "/api/resource-classification-decisions", "Resource classification policy decision rows"),
      route("GET", "/api/classification-policy-bindings", "Classification to policy binding rows"),
      route("GET", "/api/data-classification-rule-validations", "Data classification rule validation rows"),
      route("GET", "/api/matter-tagging-ledgers", "Matter tagging decision ledger artifacts"),
      route("GET", "/api/matter-tagging-decisions", "Resource matter tagging decision rows"),
      route("GET", "/api/matter-tagging-candidates", "Automatic matter tagging candidate rows"),
      route("GET", "/api/matter-tagging-confirmations", "Human confirmation queue rows for matter tagging"),
      route("GET", "/api/matter-tagging-corrections", "Matter tagging correction history rows"),
      route("GET", "/api/matter-tagging-validations", "Matter tagging validation rows"),
      route("GET", "/api/access-audit-projections", "Access audit projection artifacts"),
      route("GET", "/api/access-audit-records", "Query-ready matter/resource access audit rows"),
      route("GET", "/api/access-audit-actor-rollups", "Access audit rollups by user, runtime, and matter"),
      route("GET", "/api/access-audit-resource-rollups", "Access audit rollups by resource and matter"),
      route("GET", "/api/access-audit-validations", "Access audit validation rows"),
      route("GET", "/api/store-policy-adapters", "Store policy adapter artifacts"),
      route("GET", "/api/store-policy-rules", "Store-level policy rule rows"),
      route("GET", "/api/rls-filter-templates", "RLS-style filter templates by protected collection"),
      route("GET", "/api/store-query-plans", "Compiled store query plans with required matter and classification filters"),
      route("GET", "/api/store-enforcement-probes", "Store query enforcement probe rows"),
      route("GET", "/api/store-policy-validations", "Store policy adapter validation rows"),
      route("GET", "/api/conflict-check-interfaces", "Conflict check interface artifacts"),
      route("GET", "/api/conflict-check-requests", "Conflict check requests before intake or resource access"),
      route("GET", "/api/conflict-check-results", "Conflict check result rows with final access effects"),
      route("GET", "/api/conflict-check-signals", "Conflict signals bound to known parties and wall bindings"),
      route("GET", "/api/conflict-check-validations", "Conflict check interface validation rows"),
      route("GET", "/api/personal-workspace-boundaries", "Personal workspace boundary artifacts"),
      route("GET", "/api/workspace-boundaries", "Workspace boundary rows separating law-firm and personal tenants"),
      route("GET", "/api/tenant-policy-boundaries", "Tenant-level policy boundary rows"),
      route("GET", "/api/search-namespace-policies", "Search namespace policies for isolated workspace retrieval"),
      route("GET", "/api/cross-workspace-probes", "Cross-workspace probe rows expected to be blocked"),
      route("GET", "/api/personal-workspace-boundary-validations", "Personal workspace boundary validation rows"),
      route("GET", "/api/policy-golden-fixtures", "Policy golden fixture set artifacts"),
      route("GET", "/api/policy-fixture-cases", "Representative allow/review/deny policy fixture cases"),
      route("GET", "/api/policy-outcome-matrix", "Policy fixture outcome matrix"),
      route("GET", "/api/policy-regression-hashes", "Policy fixture regression hash rows"),
      route("GET", "/api/policy-golden-fixture-validations", "Policy golden fixture validation rows"),
      route("GET", "/api/policy-operation-surfaces", "Policy operations dashboard/API surface artifacts"),
      route("GET", "/api/policy-decision-rows", "Unified policy decision rows"),
      route("GET", "/api/policy-violation-rows", "Unified policy violation rows"),
      route("GET", "/api/policy-pending-approvals", "Unified policy pending approval rows"),
      route("GET", "/api/policy-surface-validations", "Policy operations surface validation rows"),
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
      route("GET", "/api/policy-snapshot-binding-ledgers", "Policy snapshot binding ledger artifacts"),
      route("GET", "/api/workflow-policy-bindings", "WorkflowRun policy snapshot bindings"),
      route("GET", "/api/agent-run-policy-bindings", "AgentRun policy snapshot bindings"),
      route("GET", "/api/event-policy-bindings", "Event, audit, and RunLedger policy snapshot bindings"),
      route("GET", "/api/gate-policy-bindings", "GateResult policy snapshot bindings"),
      route("GET", "/api/approval-policy-bindings", "ApprovalRequest policy snapshot bindings"),
      route("GET", "/api/output-policy-bindings", "Output and delivery policy snapshot bindings"),
      route("GET", "/api/policy-snapshot-binding-validations", "Policy snapshot binding validation rows"),
      route("GET", "/api/policy-contract-freezes", "Policy contract freeze artifacts"),
      route("GET", "/api/data-classification-contracts", "DataClassification v2 contract fixtures"),
      route("GET", "/api/policy-reference-contracts", "PolicyReference v2 contract fixtures"),
      route("GET", "/api/policy-decision-contracts", "PolicyDecision v2 contract fixtures"),
      route("GET", "/api/policy-contract-validations", "Policy contract validation rows"),
      route("GET", "/api/evidence-contract-freezes", "Evidence contract freeze artifacts"),
      route("GET", "/api/source-span-contracts", "SourceSpan v2 contract fixtures"),
      route("GET", "/api/evidence-item-contracts", "EvidenceItem v2 contract fixtures"),
      route("GET", "/api/fact-claim-contracts", "FactClaim v2 contract fixtures"),
      route("GET", "/api/issue-contracts", "Issue v2 contract fixtures"),
      route("GET", "/api/citation-contracts", "Citation v2 contract fixtures"),
      route("GET", "/api/evidence-lineage-edges", "Evidence lineage edge fixtures"),
      route("GET", "/api/evidence-contract-validations", "Evidence contract validation rows"),
      route("GET", "/api/capability-workflow-contract-freezes", "Capability/workflow contract freeze artifacts"),
      route("GET", "/api/capability-manifest-v2-contracts", "CapabilityManifest v2 contract fixtures"),
      route("GET", "/api/workflow-v2-contracts", "Workflow v2 contract fixtures"),
      route("GET", "/api/workflow-run-v2-contracts", "WorkflowRun v2 contract fixtures"),
      route("GET", "/api/agent-run-v2-contracts", "AgentRun v2 contract fixtures"),
      route("GET", "/api/capability-io-contracts", "Capability input/output contract fixtures"),
      route("GET", "/api/capability-gate-runtime-contracts", "Capability gate/runtime contract fixtures"),
      route("GET", "/api/workflow-execution-bindings", "Workflow execution bindings"),
      route("GET", "/api/capability-workflow-contract-validations", "Capability/workflow contract validation rows"),
      route("GET", "/api/runtime-agentrun-contract-freezes", "Runtime/AgentRun contract freeze artifacts"),
      route("GET", "/api/runtime-adapter-v2-contracts", "RuntimeAdapter v2 contract fixtures"),
      route("GET", "/api/runtime-execution-contracts", "Runtime execution contract fixtures"),
      route("GET", "/api/agent-run-runtime-contracts", "AgentRun runtime contract fixtures"),
      route("GET", "/api/runtime-output-contracts", "Runtime output contract fixtures"),
      route("GET", "/api/runtime-log-contracts", "Runtime log contract fixtures"),
      route("GET", "/api/runtime-artifact-contracts", "Runtime artifact contract fixtures"),
      route("GET", "/api/runtime-verification-contracts", "Runtime verification contract fixtures"),
      route("GET", "/api/runtime-agentrun-contract-validations", "Runtime/AgentRun contract validation rows"),
      route("GET", "/api/gate-approval-contract-freezes", "Gate/Approval contract freeze artifacts"),
      route("GET", "/api/gate-result-contracts", "GateResult v2 contract fixtures"),
      route("GET", "/api/approval-request-contracts", "ApprovalRequest v2 contract fixtures"),
      route("GET", "/api/approval-decision-contracts", "ApprovalDecision v2 contract fixtures"),
      route("GET", "/api/human-gate-v2-contracts", "HumanGate v2 contract fixtures"),
      route("GET", "/api/approval-authority-contracts", "Approval authority contract fixtures"),
      route("GET", "/api/gate-approval-bindings", "Gate to approval binding fixtures"),
      route("GET", "/api/gate-approval-contract-validations", "Gate/Approval contract validation rows"),
      route("GET", "/api/output-delivery-contract-freezes", "Output/Delivery contract freeze artifacts"),
      route("GET", "/api/output-artifact-v2-contracts", "OutputArtifact v2 contract fixtures"),
      route("GET", "/api/delivery-action-v2-contracts", "DeliveryAction v2 contract fixtures"),
      route("GET", "/api/delivery-receipt-v2-contracts", "DeliveryReceipt v2 contract fixtures"),
      route("GET", "/api/output-delivery-bindings", "Output to delivery binding fixtures"),
      route("GET", "/api/delivery-state-transitions", "Delivery state transition fixtures"),
      route("GET", "/api/output-delivery-contract-validations", "Output/Delivery contract validation rows"),
      route("GET", "/api/event-audit-run-contract-freezes", "Event/Audit/Run Ledger contract freeze artifacts"),
      route("GET", "/api/event-record-v2-contracts", "EventRecord v2 contract fixtures"),
      route("GET", "/api/audit-event-v2-contracts", "AuditEvent v2 contract fixtures"),
      route("GET", "/api/run-ledger-v2-contracts", "RunLedger v2 contract fixtures"),
      route("GET", "/api/event-run-bindings", "Event to RunLedger binding fixtures"),
      route("GET", "/api/event-audit-run-contract-validations", "Event/Audit/Run Ledger contract validation rows"),
      route("GET", "/api/error-cost-observability-contract-freezes", "Error/Cost/Observability contract freeze artifacts"),
      route("GET", "/api/error-record-v2-contracts", "ErrorRecord v2 contract fixtures"),
      route("GET", "/api/cost-observation-v2-contracts", "CostObservation v2 contract fixtures"),
      route("GET", "/api/trace-projection-v2-contracts", "TraceProjection v2 contract fixtures"),
      route("GET", "/api/error-cost-observability-contract-validations", "Error/Cost/Observability contract validation rows"),
      route("GET", "/api/context-packet-ledgers", "Context packet ledger artifacts"),
      route("GET", "/api/context-packets", "Runtime-scoped context packets"),
      route("GET", "/api/context-items", "Context items compiled for runtime packets"),
      route("GET", "/api/context-retrieval-filters", "Matter and policy retrieval filters for context packets"),
      route("GET", "/api/model-routing-ledgers", "Model routing ledger artifacts"),
      route("GET", "/api/model-routing-decisions", "Runtime model routing and external-transfer decisions"),
      route("GET", "/api/model-policy-enforcements", "Model policy enforcement artifacts"),
      route("GET", "/api/classification-model-gates", "Classification-level model policy gates"),
      route("GET", "/api/resource-model-gates", "Resource-level model policy gates"),
      route("GET", "/api/route-model-gates", "Route-level model policy gates"),
      route("GET", "/api/model-policy-enforcement-validations", "Model policy enforcement validation rows"),
      route("GET", "/api/tool-runtime-policy-enforcements", "Tool/runtime policy enforcement artifacts"),
      route("GET", "/api/runtime-policy-gates", "Runtime/classification policy gates"),
      route("GET", "/api/tool-permission-gates", "Runtime tool permission gates"),
      route("GET", "/api/agent-run-tool-gates", "AgentRun tool permission gates"),
      route("GET", "/api/tool-runtime-policy-validations", "Tool/runtime policy validation rows"),
      route("GET", "/api/output-destination-policy-enforcements", "Output destination policy enforcement artifacts"),
      route("GET", "/api/policy-destination-rules", "Output policy destination rules"),
      route("GET", "/api/artifact-destination-gates", "Output artifact destination gates"),
      route("GET", "/api/delivery-action-destination-gates", "Delivery action destination gates"),
      route("GET", "/api/final-action-separation-gates", "Final action separation gates"),
      route("GET", "/api/output-destination-policy-validations", "Output destination policy validation rows"),
      route("GET", "/api/approval-authority-ledgers", "Approval authority ledger artifacts"),
      route("GET", "/api/authority-policies", "Approval authority policies"),
      route("GET", "/api/artifact-authority-decisions", "Output artifact approval authority decisions"),
      route("GET", "/api/approval-request-authority-decisions", "Approval request authority decisions"),
      route("GET", "/api/delivery-action-authority-decisions", "Delivery action authority decisions"),
      route("GET", "/api/approval-authority-validations", "Approval authority validation rows"),
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
      route("GET", "/api/contract-inventories", "Contract inventory artifacts"),
      route("GET", "/api/contract-inventory-items", "Unified contract inventory items"),
      route("GET", "/api/contract-schemas", "Contract schema inventory records"),
      route("GET", "/api/contract-artifacts", "Dashboard and loop artifact contract records"),
      route("GET", "/api/contract-owner-map", "Contract owner map entries"),
      route("GET", "/api/contract-dependency-maps", "Contract dependency map artifacts"),
      route("GET", "/api/contract-dependency-nodes", "Contract dependency graph nodes"),
      route("GET", "/api/contract-dependency-edges", "Contract dependency graph edges"),
      route("GET", "/api/contract-breaking-change-risks", "Contract dependency breaking-change risks"),
      route("GET", "/api/contract-owner-dependencies", "Contract dependency owner boundary aggregates"),
      route("GET", "/api/schema-versioning-rules", "Schema versioning rule artifacts"),
      route("GET", "/api/schema-version-policies", "Schema versioning policy rows"),
      route("GET", "/api/schema-version-records", "Schema version records"),
      route("GET", "/api/schema-legacy-exceptions", "Legacy schema exception rows"),
      route("GET", "/api/schema-versioning-validations", "Schema versioning validation rows"),
      route("GET", "/api/schema-migration-manifests", "Schema migration manifest ledger artifacts"),
      route("GET", "/api/schema-migration-manifest-records", "Declared schema migration manifest records"),
      route("GET", "/api/schema-migration-records", "Schema migration execution records"),
      route("GET", "/api/schema-migration-validations", "Schema migration validation rows"),
      route("GET", "/api/contract-golden-fixtures", "Contract golden fixture set artifacts"),
      route("GET", "/api/contract-golden-fixture-records", "Contract golden fixture records"),
      route("GET", "/api/contract-golden-regression-hashes", "Contract golden fixture regression hash rows"),
      route("GET", "/api/contract-golden-fixture-validations", "Contract golden fixture validation rows"),
      route("GET", "/api/contract-validation-suites", "Contract validation suite artifacts"),
      route("GET", "/api/contract-validation-fixture-results", "Contract validation fixture result rows"),
      route("GET", "/api/contract-validation-commands", "Required contract validation package scripts"),
      route("GET", "/api/contract-validation-items", "Contract validation suite validation rows"),
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
      route("GET", "/api/human-review-cycle-reviewer-consoles", "Human review cycle reviewer console artifacts"),
      route("GET", "/api/human-review-cycle-console-items", "Human review cycle reviewer console items"),
      route("GET", "/api/human-review-actor-consoles", "Actor-specific human review cycle reviewer consoles"),
      route("GET", "/api/human-review-cycle-field-audits", "Human review cycle receipt field audit artifacts"),
      route("GET", "/api/human-review-cycle-field-audit-items", "Human review cycle receipt field audit items"),
      route("GET", "/api/human-review-actor-field-audits", "Actor-specific human review receipt field audits"),
      route("GET", "/api/human-review-cycle-completion-packs", "Human review cycle receipt completion pack artifacts"),
      route("GET", "/api/human-review-cycle-completion-items", "Human review cycle receipt completion items"),
      route("GET", "/api/human-review-actor-completion-packs", "Actor-specific human review receipt completion packs"),
      route("GET", "/api/human-review-cycle-completion-verifications", "Human review cycle receipt completion verification artifacts"),
      route("GET", "/api/human-review-cycle-completion-verification-items", "Human review cycle receipt completion verification items"),
      route("GET", "/api/human-review-actor-completion-verifications", "Actor-specific human review receipt completion verifications"),
      route("GET", "/api/human-review-cycle-completion-workbenches", "Human review cycle receipt completion workbench artifacts"),
      route("GET", "/api/human-review-cycle-completion-workbench-items", "Human review cycle receipt completion workbench items"),
      route("GET", "/api/human-review-actor-completion-workbenches", "Actor-specific human review receipt completion workbenches"),
      route("GET", "/api/human-review-cycle-completion-runbooks", "Human review cycle receipt completion runbook artifacts"),
      route("GET", "/api/human-review-cycle-completion-runbook-steps", "Human review cycle receipt completion runbook steps"),
      route("GET", "/api/human-review-actor-completion-runbooks", "Actor-specific human review receipt completion runbooks"),
      route("GET", "/api/human-review-cycle-completion-readiness", "Human review cycle receipt completion readiness artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-gates", "Human review cycle receipt completion command readiness gates"),
      route("GET", "/api/human-review-actor-completion-readiness", "Actor-specific human review receipt completion readiness"),
      route("GET", "/api/human-review-cycle-completion-command-queues", "Human review cycle receipt completion command queue artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-queue-items", "Ready manual receipt completion commands"),
      route("GET", "/api/human-review-cycle-completion-held-commands", "Held receipt completion commands"),
      route("GET", "/api/human-review-actor-completion-command-queues", "Actor-specific human review receipt completion command queues"),
      route("GET", "/api/human-review-cycle-completion-command-receipts", "Human review cycle receipt completion command receipt draft artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-requirements", "Human review cycle receipt completion command receipt requirements"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-drafts", "Human review cycle receipt completion command receipt draft rows"),
      route("GET", "/api/human-review-cycle-completion-held-command-references", "Held command references for manual receipt completion"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-validations", "Human review cycle receipt completion command receipt validation artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-validation-items", "Human review cycle receipt completion command receipt validation items"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-errors", "Human review cycle receipt completion command receipt validation errors"),
      route("GET", "/api/validated-human-review-cycle-completion-command-receipts", "Validated human review cycle completion command receipts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-feedbacks", "Human review cycle receipt completion command receipt feedback artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-feedback-items", "Human review cycle receipt completion command receipt feedback items"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-actor-feedback", "Actor-specific human review command receipt feedback"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspaces", "Human review cycle receipt completion command receipt workspace artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspace-items", "Human review cycle receipt completion command receipt workspace items"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-actor-workspaces", "Actor-specific human review command receipt workspaces"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspace-merges", "Human review cycle command receipt workspace merge artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-merge-items", "Merged human review cycle command receipt items"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-actor-inputs", "Actor command receipt inputs included in the workspace merge"),
      route("GET", "/api/merged-human-review-cycle-completion-command-receipt-input", "Merged command receipt input generated from actor command receipt workspaces"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspace-validations", "Merged command receipt workspace validation artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspace-validation-items", "Merged command receipt workspace validation items"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-workspace-validation-errors", "Merged command receipt workspace validation errors"),
      route("GET", "/api/validated-human-review-cycle-completion-command-workspace-receipts", "Validated command receipts from merged actor workspace inputs"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-applications", "Command receipt application artifacts"),
      route("GET", "/api/applied-human-review-cycle-completion-command-receipts", "Applied human review cycle completion command receipts"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-application-pending-receipts", "Pending command receipts held by command receipt application"),
      route("GET", "/api/human-review-cycle-completion-command-receipt-application-audit-events", "Command receipt application audit events"),
      route("GET", "/api/human-review-cycle-completion-reconciliations", "Human review cycle receipt completion reconciliation artifacts"),
      route("GET", "/api/human-review-cycle-completion-reconciliation-items", "Receipt completion reconciliation items"),
      route("GET", "/api/human-review-cycle-completion-reconciliation-actors", "Receipt completion reconciliation actor statuses"),
      route("GET", "/api/human-review-cycle-completion-baselines", "Human review cycle receipt completion baseline artifacts"),
      route("GET", "/api/human-review-cycle-completion-baseline-blockers", "Frozen receipt completion baseline blockers"),
      route("GET", "/api/human-review-cycle-completion-baseline-count-checks", "Receipt completion baseline source count checks"),
      route("GET", "/api/human-review-cycle-completion-manual-command-receipt-packs", "Manual command receipt pack artifacts"),
      route("GET", "/api/human-review-cycle-completion-manual-command-receipt-pack-actors", "Actor-specific manual command receipt packs"),
      route("GET", "/api/human-review-cycle-completion-manual-command-receipt-pack-items", "Manual command receipt pack items"),
      route("GET", "/api/human-review-cycle-completion-held-command-resolutions", "Held command resolution artifacts"),
      route("GET", "/api/human-review-cycle-completion-held-command-resolution-plans", "Held command resolution plans"),
      route("GET", "/api/human-review-cycle-completion-held-command-resolution-actors", "Actor-specific held command resolution plans"),
      route("GET", "/api/human-review-cycle-completion-protected-approval-request-packs", "Protected approval request pack artifacts"),
      route("GET", "/api/human-review-cycle-completion-protected-approval-requests", "Protected approval requests split from held command resolutions"),
      route("GET", "/api/human-review-cycle-completion-protected-approval-actors", "Actor-specific protected approval request packs"),
      route("GET", "/api/human-review-cycle-completion-manual-revalidations", "Manual receipt revalidation artifacts"),
      route("GET", "/api/human-review-cycle-completion-manual-revalidation-items", "Manual receipt revalidation items"),
      route("GET", "/api/human-review-cycle-completion-manual-revalidation-actors", "Actor-specific manual receipt revalidation summaries"),
      route("GET", "/api/human-review-cycle-completion-ready-manual-receipts", "Human-entered manual receipts ready for application"),
      route("GET", "/api/human-review-cycle-completion-command-queue-patch-projections", "Command queue patch projection artifacts"),
      route("GET", "/api/human-review-cycle-completion-command-queue-patch-projection-items", "Projected command queue patch items"),
      route("GET", "/api/human-review-cycle-completion-command-queue-patch-operations", "Projected command queue patch operations"),
      route("GET", "/api/human-review-cycle-completion-command-queue-patch-audit-candidates", "Projected command queue patch audit event candidates"),
      route("GET", "/api/human-review-cycle-completion-closeout-ledgers", "Receipt completion closeout ledger artifacts"),
      route("GET", "/api/human-review-cycle-completion-closeout-items", "Receipt completion closeout items normalized to closeout statuses"),
      route("GET", "/api/human-review-cycle-completion-closeout-actors", "Actor-specific receipt completion closeout summaries"),
      route("GET", "/api/human-review-cycle-completion-normalized-blocker-statuses", "Receipt completion normalized blocker status summaries"),
      route("GET", "/api/human-review-v1-regression-freezes", "Human Review v1 regression freeze artifacts"),
      route("GET", "/api/human-review-v1-regression-fixture-artifacts", "Frozen Human Review v1 regression fixture artifact refs"),
      route("GET", "/api/human-review-v1-regression-checkpoints", "Human Review v1 regression verification checkpoints"),
      route("GET", "/api/human-review-v1-freeze-notes", "Human Review v1 freeze notes"),
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
    "inventory_id",
    "inventory_status",
    "inventory_item_id",
    "dependency_map_id",
    "map_status",
    "registry_id",
    "registry_status",
    "stable_party_id",
    "canonical_name",
    "alias_key",
    "counterparty_role",
    "conflict_ref_id",
    "conflict_check_status",
    "matter_party_link_id",
    "link_status",
    "ledger_id",
    "ledger_status",
    "matter_profile_id",
    "profile_status",
    "team_roster_id",
    "membership_id",
    "membership_status",
    "access_subject_id",
    "access_decision",
    "access_basis",
    "subject_type",
    "wall_policy_ledger_id",
    "wall_policy_status",
    "wall_policy_rule_id",
    "wall_id",
    "wall_type",
    "rule_status",
    "enforcement_stage",
    "decision_mode",
    "retrieval_wall_filter_id",
    "filter_status",
    "resource_query_policy",
    "wall_subject_binding_id",
    "pre_retrieval_effect",
    "can_retrieve",
    "conflict_wall_binding_id",
    "binding_status",
    "applies_to_stage",
    "access_policy_ledger_id",
    "access_policy_status",
    "access_policy_rule_id",
    "matter_access_decision_id",
    "resource_access_decision_id",
    "runtime_access_matrix_id",
    "context_mode",
    "requires_human_review",
    "resource_id",
    "resource_matter_id",
    "target_matter_id",
    "resource_classification",
    "required_classification_floor",
    "runtime_policy_decision",
    "runtime_context_mode",
    "classification_rule_engine_id",
    "classification_rule_engine_status",
    "matter_tagging_ledger_id",
    "matter_tagging_ledger_status",
    "matter_tagging_decision_id",
    "matter_tagging_candidate_id",
    "matter_tagging_confirmation_id",
    "matter_tagging_correction_id",
    "tagging_status",
    "auto_tagging_status",
    "candidate_status",
    "confirmation_status",
    "correction_status",
    "current_matter_id",
    "proposed_matter_id",
    "human_confirmation_required",
    "auto_apply_allowed",
    "access_audit_projection_id",
    "access_audit_projection_status",
    "access_audit_record_id",
    "actor_access_rollup_id",
    "resource_access_rollup_id",
    "store_policy_adapter_id",
    "store_policy_adapter_status",
    "store_policy_rule_id",
    "rule_type",
    "rls_filter_template_id",
    "query_policy_binding_id",
    "store_query_plan_id",
    "enforcement_probe_id",
    "source_decision_type",
    "source_decision_id",
    "conflict_check_interface_id",
    "conflict_check_interface_status",
    "conflict_check_request_id",
    "conflict_check_result_id",
    "conflict_signal_id",
    "request_type",
    "request_status",
    "requested_stage",
    "requested_action",
    "result_status",
    "final_access_effect",
    "signal_type",
    "signal_decision",
    "signal_severity",
    "personal_workspace_boundary_id",
    "personal_workspace_boundary_status",
    "workspace_boundary_id",
    "workspace_type",
    "tenant_policy_boundary_id",
    "policy_mode",
    "search_namespace_policy_id",
    "search_namespace_id",
    "query_scope_status",
    "cross_workspace_probe_id",
    "probe_status",
    "block_reason",
    "policy_golden_fixture_set_id",
    "policy_golden_fixture_status",
    "policy_fixture_case_id",
    "fixture_group",
    "expected_decision",
    "observed_decision",
    "case_status",
    "policy_regression_hash_id",
    "policy_operations_surface_status",
    "policy_decision_row_id",
    "policy_violation_row_id",
    "policy_pending_approval_id",
    "source_artifact_id",
    "source_record_type",
    "source_record_id",
    "policy_layer",
    "decision",
    "gate_status",
    "control_effect",
    "violation_type",
    "severity",
    "approval_type",
    "required_actor",
    "tenant_id",
    "matter_id",
    "runtime_id",
    "classification",
    "policy_snapshot_id",
    "target_type",
    "target_resource_id",
    "view_status",
    "collection_id",
    "query_status",
    "probe_type",
    "enforcement_status",
    "observed_outcome",
    "blocked_by_policy",
    "classification_rule_id",
    "classification_policy_binding_id",
    "resource_classification_decision_id",
    "classification",
    "source_classification",
    "effective_classification",
    "classification_source",
    "classification_policy_decision",
    "resource_policy_decision",
    "external_model_policy",
    "external_model_decision",
    "local_model_policy",
    "redaction_policy",
    "requires_redaction",
    "policy_reference_id",
    "policy_reference_status",
    "policy_decision_id",
    "binding_status",
    "external_execution",
    "freeze_id",
    "freeze_status",
    "identity_model_id",
    "identity_model_status",
    "user_id",
    "tenant_id",
    "role_id",
    "role_scope",
    "assignment_source",
    "assignment_scope",
    "role_assignment_id",
    "actor_principal_id",
    "actor_type",
    "principal_class",
    "binding_type",
    "binding_id",
    "resource_id",
    "resource_version_id",
    "source_system",
    "external_id",
    "version_status",
    "client_id",
    "party_id",
    "party_type",
    "matter_team_id",
    "matter_boundary_id",
    "boundary_status",
    "practice_area",
    "matter_status",
    "team_status",
    "access_scope",
    "check_id",
    "node_id",
    "edge_id",
    "edge_type",
    "risk_id",
    "risk_type",
    "risk_level",
    "direction_status",
    "from_owner_area",
    "to_owner_area",
    "item_type",
    "owner_area",
    "schema_id",
    "schema_version_record_id",
    "guideline_status",
    "version_status",
    "version_family",
    "schema_version_required",
    "additional_properties_policy",
    "legacy_exception_id",
    "exception_status",
    "rule_id",
    "migration_ledger_id",
    "migration_record_id",
    "migration_id",
    "migration_scope",
    "migration_status",
    "migration_manifest_status",
    "manifest_status",
    "change_type",
    "dry_run_status",
    "rollback_available",
    "golden_fixture_set_id",
    "golden_fixture_id",
    "golden_fixture_status",
    "fixture_id",
    "fixture_scope",
    "fixture_status",
    "schema_validation_status",
    "regression_hash_id",
    "regression_status",
    "validation_suite_id",
    "validation_suite_status",
    "validation_result_id",
    "content_hash_status",
    "schema_hash_status",
    "package_script_name",
    "script_status",
    "roadmap_phase",
    "roadmap_status",
    "parse_status",
    "route_id",
    "artifact_id",
    "available",
    "catalog_id",
    "policy_status",
    "pack_status",
    "matrix_id",
    "classification",
    "external_model_policy",
    "local_model_policy",
    "redaction_policy",
    "revalidation_status",
    "approval_required",
    "tool_id",
    "default_policy",
    "delivery_policy",
    "gate_id",
    "stage",
    "blocking_by_default",
    "review_status",
    "policy_snapshot_id",
    "policy_reference_id",
    "reference_type",
    "reference_status",
    "decision_id",
    "decision_status",
    "source_span_id",
    "fact_id",
    "fact_type",
    "issue_id",
    "issue_type",
    "citation_id",
    "citation_binding_status",
    "lineage_edge_id",
    "relation",
    "workflow_id",
    "workflow_status",
    "adapter_id",
    "execution_contract_id",
    "runtime_output_id",
    "runtime_log_id",
    "runtime_artifact_id",
    "runtime_verification_id",
    "gate_result_id",
    "gate_outcome",
    "gate_stage",
    "human_approval_gate",
    "separated_approval_object_required",
    "approval_request_id",
    "approval_kind",
    "approval_source",
    "request_status",
    "required_actor",
    "approval_decision_id",
    "request_link_status",
    "human_gate_contract_id",
    "requires_human",
    "approval_authority_id",
    "approval_authority_status",
    "gate_approval_binding_id",
    "binding_status",
    "output_artifact_id",
    "hash_status",
    "delivery_separation_status",
    "approval_separation_status",
    "receipt_separation_status",
    "delivery_receipt_id",
    "output_delivery_binding_id",
    "approval_binding_status",
    "delivery_binding_status",
    "receipt_binding_status",
    "separation_status",
    "delivery_state_transition_id",
    "transition_type",
    "source_state",
    "target_state",
    "draft_only",
    "ready_for_delivery",
    "executed",
    "receipt_application_status",
    "output_trust",
    "log_capture_status",
    "artifact_capture_status",
    "verification_required",
    "artifact_capture_required",
    "logs_required",
    "input_output_status",
    "registry_validation_status",
    "runtime_binding_count",
    "usage_id",
    "usage_type",
    "snapshot_declared_in_source",
    "policy_snapshot_binding_status",
    "policy_snapshot_binding_ledger_id",
    "workflow_policy_binding_id",
    "agent_run_policy_binding_id",
    "event_policy_binding_id",
    "gate_policy_binding_id",
    "approval_policy_binding_id",
    "output_policy_binding_id",
    "policy_snapshot_known",
    "binding_source",
    "declared_policy_snapshot_id",
    "inherited_workflow_policy_snapshot_id",
    "linked_output_policy_snapshot_id",
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
    "model_policy_enforcement_id",
    "model_policy_enforcement_status",
    "classification_model_gate_id",
    "resource_model_gate_id",
    "route_model_gate_id",
    "classification_ordinal",
    "sensitive_data",
    "gate_decision",
    "gate_status",
    "external_transfer_gate_status",
    "source_route_status",
    "source_route_mode",
    "human_approval_required",
    "tool_runtime_policy_enforcement_id",
    "tool_runtime_policy_enforcement_status",
    "runtime_policy_gate_id",
    "runtime_rule_id",
    "command_availability_status",
    "workspace_isolation_type",
    "tool_permission_gate_id",
    "requested_state",
    "tool_policy_known",
    "protected_action",
    "forbidden_by_runtime",
    "allowed_by_runtime",
    "agent_run_tool_gate_id",
    "requested_tool_count",
    "allowed_tool_count",
    "forbidden_tool_count",
    "approval_required_tool_count",
    "runtime_blocked_classification_count",
    "runtime_review_classification_count",
    "model_route_blocked_count",
    "capability_requires_tool_permission_gate",
    "runtime_requires_tool_permission_gate",
    "output_destination_policy_enforcement_id",
    "output_destination_policy_status",
    "policy_destination_rule_id",
    "artifact_destination_gate_id",
    "delivery_action_destination_gate_id",
    "final_action_separation_gate_id",
    "destination_kind",
    "destination_tool_id",
    "destination_tool_policy_known",
    "delivery_policy",
    "delivery_target",
    "delivery_channel",
    "delivery_status",
    "draft_generation_allowed",
    "draft_final_action_separated",
    "draft_only",
    "final_action_required",
    "ready_for_delivery",
    "executed",
    "approval_required",
    "receipt_required",
    "receipt_present",
    "delivered_receipt_present",
    "output_destination_gate_required",
    "final_action_status",
    "blocked_final_action",
    "unsafe_final_action",
    "separation_status",
    "tool_policy_known",
    "protected_tool_gate_present",
    "approval_authority_ledger_id",
    "approval_authority_status",
    "authority_policy_id",
    "authority_policy_count",
    "authority_decision_count",
    "authority_policy_status",
    "artifact_authority_decision_id",
    "approval_request_authority_decision_id",
    "delivery_action_authority_decision_id",
    "required_authority_role",
    "required_approval_level",
    "law_firm_human_required",
    "authority_status",
    "assignment_status",
    "assigned_user_id",
    "assigned_actor_principal_id",
    "candidate_count",
    "matter_role_match_count",
    "tenant_role_match_count",
    "matter_profile_known",
    "tenant_identity_known",
    "nonhuman_authority_blocked",
    "authority_basis",
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
    "event_record_id",
    "audit_event_id",
    "run_ledger_id",
    "event_run_binding_id",
    "error_record_id",
    "error_kind",
    "error_type",
    "error_status",
    "retryable",
    "blocking",
    "cost_observation_id",
    "cost_status",
    "trace_projection_id",
    "trace_status",
    "latency_status",
    "retry_status",
    "source_event_kind",
    "source_kind",
    "workflow_run_id",
    "run_status",
    "runtime_id",
    "actor_type",
    "actor_id",
    "type",
    "event_type",
    "event_category",
    "correlation_id",
    "policy_snapshot_status",
    "schema_version_status",
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
    "workspace_item_id",
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
    "console_id",
    "actor_console_id",
    "console_item_id",
    "console_status",
    "console_rank",
    "field_audit_id",
    "actor_field_audit_id",
    "field_audit_item_id",
    "field_audit_status",
    "completion_pack_id",
    "actor_completion_pack_id",
    "completion_item_id",
    "completion_status",
    "completion_rank",
    "verification_id",
    "actor_verification_id",
    "verification_item_id",
    "verification_status",
    "verification_rank",
    "workbench_id",
    "actor_workbench_id",
    "workbench_item_id",
    "workbench_status",
    "workbench_rank",
    "runbook_id",
    "actor_runbook_id",
    "runbook_step_id",
    "runbook_status",
    "step_status",
    "step_type",
    "step_key",
    "readiness_id",
    "actor_readiness_id",
    "command_gate_id",
    "manual_requirement_id",
    "readiness_status",
    "command_status",
    "command_allowed_now",
    "requirement_status",
    "command_queue_id",
    "queue_item_id",
    "held_command_id",
    "command_receipt_draft_id",
    "receipt_requirement_id",
    "receipt_id",
    "held_command_ref_id",
    "validation_id",
    "validation_item_id",
    "validation_status",
    "ready_to_confirm",
    "field",
    "actor_command_queue_id",
    "queue_status",
    "hold_status",
    "command_kind",
    "command",
    "command_result",
    "executed_by",
    "output_reference",
    "requires_explicit_human_approval",
    "approval_request_id",
    "approval_request_pack_id",
    "actor_approval_pack_id",
    "approval_type",
    "source_resolution_plan_id",
    "revalidation_item_id",
    "actor_revalidation_id",
    "human_entered_receipt",
    "ready_manual_receipt_candidate",
    "applied_manual_receipt_candidate",
    "ready_or_applied_candidate",
    "protected_approval_overlap",
    "auto_executed_receipt",
    "projection_id",
    "projection_item_id",
    "projection_status",
    "patch_target_available",
    "patch_ready",
    "patch_applied",
    "audit_event_emitted",
    "closeout_id",
    "closeout_item_id",
    "actor_closeout_id",
    "closeout_status",
    "freeze_id",
    "freeze_status",
    "fixture_id",
    "fixture_scope",
    "checkpoint_id",
    "checkpoint_key",
    "checkpoint_status",
    "source_id",
    "normalized_status",
    "blocker_type",
    "raw_status",
    "pending_reason",
    "event_status",
    "would_emit_on_apply",
    "emitted",
    "field_status",
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
  if (key === "inventory_status") return item.summary?.inventory_status ?? item.inventory_status;
  if (key === "map_status") return item.summary?.map_status ?? item.map_status;
  if (key === "guideline_status") return item.summary?.guideline_status ?? item.guideline_status;
  if (key === "migration_manifest_status") return item.summary?.migration_manifest_status ?? item.migration_manifest_status;
  if (key === "golden_fixture_status") return item.summary?.golden_fixture_status ?? item.golden_fixture_status;
  if (key === "validation_suite_status") return item.summary?.validation_suite_status ?? item.validation_suite_status;
  if (key === "matter_tagging_ledger_status") return item.summary?.matter_tagging_ledger_status ?? item.matter_tagging_ledger_status;
  if (key === "access_audit_projection_status") return item.summary?.access_audit_projection_status ?? item.access_audit_projection_status;
  if (key === "store_policy_adapter_status") return item.summary?.store_policy_adapter_status ?? item.store_policy_adapter_status;
  if (key === "conflict_check_interface_status") return item.summary?.conflict_check_interface_status ?? item.conflict_check_interface_status;
  if (key === "personal_workspace_boundary_status") return item.summary?.personal_workspace_boundary_status ?? item.personal_workspace_boundary_status;
  if (key === "policy_golden_fixture_status") return item.summary?.policy_golden_fixture_status ?? item.policy_golden_fixture_status;
  if (key === "policy_operations_surface_status") return item.summary?.policy_operations_surface_status ?? item.policy_operations_surface_status;
  if (key === "registry_status") return item.summary?.registry_status ?? item.registry_status;
  if (key === "ledger_status") return item.summary?.ledger_status ?? item.ledger_status;
  if (key === "policy_snapshot_binding_status") return item.summary?.policy_snapshot_binding_status ?? item.policy_snapshot_binding_status;
  if (key === "wall_policy_status") return item.summary?.wall_policy_status ?? item.wall_policy_status;
  if (key === "access_policy_status") return item.summary?.access_policy_status ?? item.access_policy_status;
  if (key === "alias_key") return item.alias_keys ?? item.alias_key;
  if (key === "freeze_status") return item.summary?.freeze_status ?? item.freeze_status;
  if (key === "identity_model_status") return item.summary?.identity_model_status ?? item.identity_model_status;
  if (key === "checkpoint_key") return item.key;
  if (key === "checkpoint_status") return item.status;
  if (key === "runtime_id") return item.runtime_ids ?? item.runtime_id ?? item.metadata?.runtime_id;
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
