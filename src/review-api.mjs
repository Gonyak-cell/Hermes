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
  if (pathname === "/api/resource-store-interfaces") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "resource_store_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("resource_store_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_store_interfaces", [interfaceResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/resource-store-records") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "resource_store_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("resource_store_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_store_records", interfaceResult.artifact.resource_store_catalog?.resource_store_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-store-records") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "resource_store_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("resource_store_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_store_records", interfaceResult.artifact.resource_store_catalog?.resource_version_store_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-store-adapter-bindings") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "resource_store_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("resource_store_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_store_adapter_bindings", interfaceResult.artifact.adapter_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-store-validations") {
    const interfaceResult = await readDashboardSourceArtifact(dashboard, "resource_store_interface");
    if (!interfaceResult.available) {
      return jsonResponse(503, buildError("resource_store_interface_unavailable", interfaceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_store_validations", interfaceResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/immutable-object-store-layouts") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("immutable_object_store_layouts", [layoutResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/object-path-resolvers") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("object_path_resolvers", layoutResult.artifact.object_store_catalog?.path_resolvers ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/raw-source-object-paths") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("raw_source_object_paths", layoutResult.artifact.object_store_catalog?.raw_source_object_paths ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/generated-output-object-paths") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("generated_output_object_paths", layoutResult.artifact.object_store_catalog?.generated_output_object_paths ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/object-store-collisions") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("object_store_collisions", layoutResult.artifact.object_store_catalog?.collision_report?.collisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/object-store-layout-validations") {
    const layoutResult = await readDashboardSourceArtifact(dashboard, "immutable_object_store_layout");
    if (!layoutResult.available) {
      return jsonResponse(503, buildError("immutable_object_store_layout_unavailable", layoutResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("object_store_layout_validations", layoutResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-families") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_families", ledgerResult.artifact.version_ledger_catalog?.version_families ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-events") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_events", ledgerResult.artifact.version_ledger_catalog?.version_events ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-transitions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_transitions", ledgerResult.artifact.version_ledger_catalog?.version_transitions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-duplicate-candidates") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_duplicate_candidates", ledgerResult.artifact.version_ledger_catalog?.duplicate_candidates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-object-bindings") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_object_bindings", ledgerResult.artifact.version_ledger_catalog?.object_path_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-version-ledger-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_version_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_version_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_version_ledger_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-dedup-hash-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_dedup_hash_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/resource-hash-groups") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_hash_groups", ledgerResult.artifact.dedup_hash_catalog?.hash_groups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-external-id-groups") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_external_id_groups", ledgerResult.artifact.dedup_hash_catalog?.external_id_groups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-dedup-decisions") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_dedup_decisions", ledgerResult.artifact.dedup_hash_catalog?.dedup_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-duplicate-candidate-links") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_duplicate_candidate_links", ledgerResult.artifact.dedup_hash_catalog?.duplicate_candidate_links ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-hash-integrity-checks") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_hash_integrity_checks", ledgerResult.artifact.dedup_hash_catalog?.hash_integrity_checks ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-dedup-hash-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "resource_dedup_hash_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("resource_dedup_hash_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_dedup_hash_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-quarantine-models") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "resource_quarantine_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("resource_quarantine_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_quarantine_models", [modelResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/resource-quarantine-rules") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "resource_quarantine_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("resource_quarantine_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_quarantine_rules", modelResult.artifact.quarantine_catalog?.quarantine_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-quarantine-items") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "resource_quarantine_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("resource_quarantine_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_quarantine_items", modelResult.artifact.quarantine_catalog?.quarantine_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-quarantine-review-queue") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "resource_quarantine_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("resource_quarantine_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_quarantine_review_queue", modelResult.artifact.quarantine_catalog?.quarantine_review_queue ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-quarantine-validations") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "resource_quarantine_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("resource_quarantine_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_quarantine_validations", modelResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/normalized-text-contracts") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "normalized_text_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("normalized_text_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("normalized_text_contracts", [contractResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/normalized-text-artifacts") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "normalized_text_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("normalized_text_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("normalized_text_artifacts", contractResult.artifact.normalized_text_catalog?.normalized_text_artifacts ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/normalized-text-location-maps") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "normalized_text_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("normalized_text_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("normalized_text_location_maps", contractResult.artifact.normalized_text_catalog?.location_maps ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/normalized-source-span-seeds") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "normalized_text_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("normalized_text_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("normalized_source_span_seeds", contractResult.artifact.normalized_text_catalog?.source_span_seeds ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/normalized-text-validations") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "normalized_text_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("normalized_text_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("normalized_text_validations", contractResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-adapter-contracts") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_adapter_contracts", [contractResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-adapters") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_adapters", contractResult.artifact.extractor_adapter_catalog?.extractor_adapters ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-io-contracts") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_io_contracts", contractResult.artifact.extractor_adapter_catalog?.extractor_io_contracts ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-document-type-bindings") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_document_type_bindings", contractResult.artifact.extractor_adapter_catalog?.document_type_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ocr-fallback-policies") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ocr_fallback_policies", contractResult.artifact.extractor_adapter_catalog?.ocr_fallback_policies ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-normalized-text-bindings") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_normalized_text_bindings", contractResult.artifact.extractor_adapter_catalog?.normalized_text_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/extractor-adapter-validations") {
    const contractResult = await readDashboardSourceArtifact(dashboard, "extractor_adapter_contract");
    if (!contractResult.available) {
      return jsonResponse(503, buildError("extractor_adapter_contract_unavailable", contractResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("extractor_adapter_validations", contractResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_span_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/source-spans") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_spans", storeResult.artifact.source_span_catalog?.source_spans ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-locators") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_span_locators", storeResult.artifact.source_span_catalog?.source_span_locators ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-location-units") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_span_location_units", storeResult.artifact.source_span_catalog?.source_span_location_units ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-indexes") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_span_indexes", [storeResult.artifact.source_span_catalog?.source_span_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/source-span-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "source_span_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("source_span_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("source_span_validations", storeResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-item-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_item_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-items") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_items", storeResult.artifact.evidence_item_catalog?.evidence_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-source-span-bindings") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_source_span_bindings", storeResult.artifact.evidence_item_catalog?.source_span_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-review-queue") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_review_queue", storeResult.artifact.evidence_item_catalog?.review_queue_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-item-indexes") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_item_indexes", [storeResult.artifact.evidence_item_catalog?.evidence_item_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-item-store-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "evidence_item_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("evidence_item_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_item_store_validations", storeResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-golden-fixtures") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "evidence_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("evidence_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_golden_fixtures", [fixtureResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-golden-cases") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "evidence_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("evidence_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_golden_cases", fixtureResult.artifact.evidence_golden_fixture_catalog?.evidence_golden_cases ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-golden-store-matches") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "evidence_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("evidence_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_golden_store_matches", fixtureResult.artifact.evidence_golden_fixture_catalog?.evidence_store_matches ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-regression-tests") {
    const regressionResult = await readDashboardSourceArtifact(dashboard, "evidence_regression_tests");
    if (!regressionResult.available) {
      return jsonResponse(503, buildError("evidence_regression_tests_unavailable", regressionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_regression_tests", [regressionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-regression-suites") {
    const regressionResult = await readDashboardSourceArtifact(dashboard, "evidence_regression_tests");
    if (!regressionResult.available) {
      return jsonResponse(503, buildError("evidence_regression_tests_unavailable", regressionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_regression_suites", regressionResult.artifact.evidence_regression_catalog?.regression_suites ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-regression-test-cases") {
    const regressionResult = await readDashboardSourceArtifact(dashboard, "evidence_regression_tests");
    if (!regressionResult.available) {
      return jsonResponse(503, buildError("evidence_regression_tests_unavailable", regressionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_regression_test_cases", regressionResult.artifact.evidence_regression_catalog?.regression_test_cases ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-regression-hashes") {
    const regressionResult = await readDashboardSourceArtifact(dashboard, "evidence_regression_tests");
    if (!regressionResult.available) {
      return jsonResponse(503, buildError("evidence_regression_tests_unavailable", regressionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_regression_hashes", regressionResult.artifact.evidence_regression_catalog?.regression_hashes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-regression-validations") {
    const regressionResult = await readDashboardSourceArtifact(dashboard, "evidence_regression_tests");
    if (!regressionResult.available) {
      return jsonResponse(503, buildError("evidence_regression_tests_unavailable", regressionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_regression_validations", regressionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-evidence-dashboard-summaries") {
    const summaryResult = await readDashboardSourceArtifact(dashboard, "resource_evidence_dashboard_summary");
    if (!summaryResult.available) {
      return jsonResponse(503, buildError("resource_evidence_dashboard_summary_unavailable", summaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_evidence_dashboard_summaries", [summaryResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/resource-evidence-panel-rows") {
    const summaryResult = await readDashboardSourceArtifact(dashboard, "resource_evidence_dashboard_summary");
    if (!summaryResult.available) {
      return jsonResponse(503, buildError("resource_evidence_dashboard_summary_unavailable", summaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_evidence_panel_rows", summaryResult.artifact.resource_evidence_dashboard_catalog?.panel_rows ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-evidence-matter-rollups") {
    const summaryResult = await readDashboardSourceArtifact(dashboard, "resource_evidence_dashboard_summary");
    if (!summaryResult.available) {
      return jsonResponse(503, buildError("resource_evidence_dashboard_summary_unavailable", summaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_evidence_matter_rollups", summaryResult.artifact.resource_evidence_dashboard_catalog?.matter_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-evidence-classification-rollups") {
    const summaryResult = await readDashboardSourceArtifact(dashboard, "resource_evidence_dashboard_summary");
    if (!summaryResult.available) {
      return jsonResponse(503, buildError("resource_evidence_dashboard_summary_unavailable", summaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_evidence_classification_rollups", summaryResult.artifact.resource_evidence_dashboard_catalog?.classification_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resource-evidence-dashboard-validations") {
    const summaryResult = await readDashboardSourceArtifact(dashboard, "resource_evidence_dashboard_summary");
    if (!summaryResult.available) {
      return jsonResponse(503, buildError("resource_evidence_dashboard_summary_unavailable", summaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resource_evidence_dashboard_validations", summaryResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-plane-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_plane_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_plane_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_plane_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-plane-freeze-sources") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_plane_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_plane_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_plane_freeze_sources", freezeResult.artifact.freeze_source_statuses ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-plane-freeze-checkpoints") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_plane_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_plane_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_plane_freeze_checkpoints", freezeResult.artifact.freeze_checkpoints ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-plane-representative-traces") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_plane_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_plane_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_plane_representative_traces", freezeResult.artifact.representative_traces ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-plane-freeze-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "evidence_plane_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("evidence_plane_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_plane_freeze_validations", freezeResult.artifact.freeze_checkpoints ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-golden-validations") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "evidence_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("evidence_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_golden_validations", fixtureResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/fact-claim-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_claim_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/fact-claims") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_claims", storeResult.artifact.fact_claim_catalog?.fact_claims ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/fact-evidence-bindings") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_evidence_bindings", storeResult.artifact.fact_claim_catalog?.evidence_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/fact-review-queue") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_review_queue", storeResult.artifact.fact_claim_catalog?.review_queue_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/fact-claim-indexes") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_claim_indexes", [storeResult.artifact.fact_claim_catalog?.fact_claim_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/fact-claim-store-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "fact_claim_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("fact_claim_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_claim_store_validations", storeResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/issue-graph-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issue_graph_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/issues") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issues", storeResult.artifact.issue_graph_catalog?.issues ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/fact-issue-bindings") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("fact_issue_bindings", storeResult.artifact.issue_graph_catalog?.fact_issue_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/legal-rules") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("legal_rules", storeResult.artifact.issue_graph_catalog?.legal_rules ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/issue-legal-rule-bindings") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issue_legal_rule_bindings", storeResult.artifact.issue_graph_catalog?.legal_rule_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/risk-severity-assessments") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("risk_severity_assessments", storeResult.artifact.issue_graph_catalog?.risk_severity_assessments ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/issue-review-queue") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issue_review_queue", storeResult.artifact.issue_graph_catalog?.review_queue_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/issue-graph-indexes") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issue_graph_indexes", [storeResult.artifact.issue_graph_catalog?.issue_graph_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/issue-graph-store-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "issue_graph_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("issue_graph_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("issue_graph_store_validations", storeResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/citation-object-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("citation_object_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/output-paragraphs") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_paragraphs", storeResult.artifact.citation_catalog?.output_paragraphs ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/citations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("citations", storeResult.artifact.citation_catalog?.citations ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/paragraph-source-bindings") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("paragraph_source_bindings", storeResult.artifact.citation_catalog?.paragraph_source_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/citation-review-queue") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("citation_review_queue", storeResult.artifact.citation_catalog?.review_queue_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/citation-indexes") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("citation_indexes", [storeResult.artifact.citation_catalog?.citation_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/citation-object-store-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "citation_object_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("citation_object_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("citation_object_store_validations", storeResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-graphs") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_graphs", [graphResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-nodes") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_nodes", graphResult.artifact.lineage_graph_catalog?.lineage_nodes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-edges") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_edges", graphResult.artifact.lineage_graph_catalog?.lineage_edges ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-paths") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_paths", graphResult.artifact.lineage_graph_catalog?.lineage_paths ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-indexes") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_indexes", [graphResult.artifact.lineage_graph_catalog?.lineage_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/lineage-graph-validations") {
    const graphResult = await readDashboardSourceArtifact(dashboard, "lineage_graph_builder");
    if (!graphResult.available) {
      return jsonResponse(503, buildError("lineage_graph_builder_unavailable", graphResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("lineage_graph_validations", graphResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-viewer-data") {
    const dataResult = await readDashboardSourceArtifact(dashboard, "evidence_viewer_data_api");
    if (!dataResult.available) {
      return jsonResponse(503, buildError("evidence_viewer_data_api_unavailable", dataResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_viewer_data", [dataResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-viewer-cards") {
    const dataResult = await readDashboardSourceArtifact(dashboard, "evidence_viewer_data_api");
    if (!dataResult.available) {
      return jsonResponse(503, buildError("evidence_viewer_data_api_unavailable", dataResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_viewer_cards", dataResult.artifact.evidence_viewer_data_catalog?.viewer_cards ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-viewer-source-spans") {
    const dataResult = await readDashboardSourceArtifact(dashboard, "evidence_viewer_data_api");
    if (!dataResult.available) {
      return jsonResponse(503, buildError("evidence_viewer_data_api_unavailable", dataResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_viewer_source_spans", dataResult.artifact.evidence_viewer_data_catalog?.source_span_panels ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-viewer-lineage-paths") {
    const dataResult = await readDashboardSourceArtifact(dashboard, "evidence_viewer_data_api");
    if (!dataResult.available) {
      return jsonResponse(503, buildError("evidence_viewer_data_api_unavailable", dataResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_viewer_lineage_paths", dataResult.artifact.evidence_viewer_data_catalog?.lineage_path_panels ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-viewer-data-validations") {
    const dataResult = await readDashboardSourceArtifact(dashboard, "evidence_viewer_data_api");
    if (!dataResult.available) {
      return jsonResponse(503, buildError("evidence_viewer_data_api_unavailable", dataResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_viewer_data_validations", dataResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-bundles") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_bundles", [bundleResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-bundle-records") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_bundle_records", bundleResult.artifact.evidence_export_catalog?.export_bundles ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-source-packages") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_source_packages", bundleResult.artifact.evidence_export_catalog?.export_source_packages ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-citation-packages") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_citation_packages", bundleResult.artifact.evidence_export_catalog?.export_citation_packages ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-coverage-packages") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_coverage_packages", bundleResult.artifact.evidence_export_catalog?.export_coverage_packages ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-export-bundle-validations") {
    const bundleResult = await readDashboardSourceArtifact(dashboard, "evidence_export_bundle");
    if (!bundleResult.available) {
      return jsonResponse(503, buildError("evidence_export_bundle_unavailable", bundleResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_export_bundle_validations", bundleResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-coverage-scores") {
    const coverageResult = await readDashboardSourceArtifact(dashboard, "evidence_coverage_score");
    if (!coverageResult.available) {
      return jsonResponse(503, buildError("evidence_coverage_score_unavailable", coverageResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_coverage_scores", [coverageResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-coverage-records") {
    const coverageResult = await readDashboardSourceArtifact(dashboard, "evidence_coverage_score");
    if (!coverageResult.available) {
      return jsonResponse(503, buildError("evidence_coverage_score_unavailable", coverageResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_coverage_records", coverageResult.artifact.evidence_coverage_catalog?.coverage_scores ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-coverage-dimensions") {
    const coverageResult = await readDashboardSourceArtifact(dashboard, "evidence_coverage_score");
    if (!coverageResult.available) {
      return jsonResponse(503, buildError("evidence_coverage_score_unavailable", coverageResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_coverage_dimensions", coverageResult.artifact.evidence_coverage_catalog?.coverage_dimensions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-coverage-indexes") {
    const coverageResult = await readDashboardSourceArtifact(dashboard, "evidence_coverage_score");
    if (!coverageResult.available) {
      return jsonResponse(503, buildError("evidence_coverage_score_unavailable", coverageResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_coverage_indexes", [coverageResult.artifact.evidence_coverage_catalog?.coverage_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-coverage-validations") {
    const coverageResult = await readDashboardSourceArtifact(dashboard, "evidence_coverage_score");
    if (!coverageResult.available) {
      return jsonResponse(503, buildError("evidence_coverage_score_unavailable", coverageResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_coverage_validations", coverageResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-flags") {
    const flagsResult = await readDashboardSourceArtifact(dashboard, "evidence_flags");
    if (!flagsResult.available) {
      return jsonResponse(503, buildError("evidence_flags_unavailable", flagsResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_flags", [flagsResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-flag-records") {
    const flagsResult = await readDashboardSourceArtifact(dashboard, "evidence_flags");
    if (!flagsResult.available) {
      return jsonResponse(503, buildError("evidence_flags_unavailable", flagsResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_flag_records", flagsResult.artifact.evidence_flag_catalog?.evidence_flag_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-flag-decisions") {
    const flagsResult = await readDashboardSourceArtifact(dashboard, "evidence_flags");
    if (!flagsResult.available) {
      return jsonResponse(503, buildError("evidence_flags_unavailable", flagsResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_flag_decisions", flagsResult.artifact.evidence_flag_catalog?.flag_decisions ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-flag-indexes") {
    const flagsResult = await readDashboardSourceArtifact(dashboard, "evidence_flags");
    if (!flagsResult.available) {
      return jsonResponse(503, buildError("evidence_flags_unavailable", flagsResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_flag_indexes", [flagsResult.artifact.evidence_flag_catalog?.flag_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/evidence-flag-validations") {
    const flagsResult = await readDashboardSourceArtifact(dashboard, "evidence_flags");
    if (!flagsResult.available) {
      return jsonResponse(503, buildError("evidence_flags_unavailable", flagsResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("evidence_flag_validations", flagsResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/exhibit-maps") {
    const exhibitMapResult = await readDashboardSourceArtifact(dashboard, "exhibit_map");
    if (!exhibitMapResult.available) {
      return jsonResponse(503, buildError("exhibit_map_unavailable", exhibitMapResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("exhibit_maps", [exhibitMapResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/exhibit-records") {
    const exhibitMapResult = await readDashboardSourceArtifact(dashboard, "exhibit_map");
    if (!exhibitMapResult.available) {
      return jsonResponse(503, buildError("exhibit_map_unavailable", exhibitMapResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("exhibit_records", exhibitMapResult.artifact.exhibit_catalog?.exhibit_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/exhibit-bindings") {
    const exhibitMapResult = await readDashboardSourceArtifact(dashboard, "exhibit_map");
    if (!exhibitMapResult.available) {
      return jsonResponse(503, buildError("exhibit_map_unavailable", exhibitMapResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("exhibit_bindings", exhibitMapResult.artifact.exhibit_catalog?.exhibit_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/exhibit-indexes") {
    const exhibitMapResult = await readDashboardSourceArtifact(dashboard, "exhibit_map");
    if (!exhibitMapResult.available) {
      return jsonResponse(503, buildError("exhibit_map_unavailable", exhibitMapResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("exhibit_indexes", [exhibitMapResult.artifact.exhibit_catalog?.exhibit_indexes ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/exhibit-map-validations") {
    const exhibitMapResult = await readDashboardSourceArtifact(dashboard, "exhibit_map");
    if (!exhibitMapResult.available) {
      return jsonResponse(503, buildError("exhibit_map_unavailable", exhibitMapResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("exhibit_map_validations", exhibitMapResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/custody-event-ledgers") {
    const custodyResult = await readDashboardSourceArtifact(dashboard, "chain_of_custody_events");
    if (!custodyResult.available) {
      return jsonResponse(503, buildError("chain_of_custody_events_unavailable", custodyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("custody_event_ledgers", [custodyResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/custody-events") {
    const custodyResult = await readDashboardSourceArtifact(dashboard, "chain_of_custody_events");
    if (!custodyResult.available) {
      return jsonResponse(503, buildError("chain_of_custody_events_unavailable", custodyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("custody_events", custodyResult.artifact.custody_event_catalog?.custody_events ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/custody-event-links") {
    const custodyResult = await readDashboardSourceArtifact(dashboard, "chain_of_custody_events");
    if (!custodyResult.available) {
      return jsonResponse(503, buildError("chain_of_custody_events_unavailable", custodyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("custody_event_links", custodyResult.artifact.custody_event_catalog?.custody_event_links ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/custody-stage-indexes") {
    const custodyResult = await readDashboardSourceArtifact(dashboard, "chain_of_custody_events");
    if (!custodyResult.available) {
      return jsonResponse(503, buildError("chain_of_custody_events_unavailable", custodyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("custody_stage_indexes", custodyResult.artifact.custody_event_catalog?.custody_stage_indexes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/custody-event-validations") {
    const custodyResult = await readDashboardSourceArtifact(dashboard, "chain_of_custody_events");
    if (!custodyResult.available) {
      return jsonResponse(503, buildError("chain_of_custody_events_unavailable", custodyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("custody_event_validations", custodyResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/search-index-contracts") {
    const searchIndexResult = await readDashboardSourceArtifact(dashboard, "search_index_contract");
    if (!searchIndexResult.available) {
      return jsonResponse(503, buildError("search_index_contract_unavailable", searchIndexResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_index_contracts", [searchIndexResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/search-index-manifests") {
    const searchIndexResult = await readDashboardSourceArtifact(dashboard, "search_index_contract");
    if (!searchIndexResult.available) {
      return jsonResponse(503, buildError("search_index_contract_unavailable", searchIndexResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_index_manifests", searchIndexResult.artifact.search_index_catalog?.search_index_manifests ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/search-index-fields") {
    const searchIndexResult = await readDashboardSourceArtifact(dashboard, "search_index_contract");
    if (!searchIndexResult.available) {
      return jsonResponse(503, buildError("search_index_contract_unavailable", searchIndexResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_index_fields", searchIndexResult.artifact.search_index_catalog?.search_index_fields ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/search-index-query-plans") {
    const searchIndexResult = await readDashboardSourceArtifact(dashboard, "search_index_contract");
    if (!searchIndexResult.available) {
      return jsonResponse(503, buildError("search_index_contract_unavailable", searchIndexResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_index_query_plans", searchIndexResult.artifact.search_index_catalog?.search_index_query_plans ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/search-index-validations") {
    const searchIndexResult = await readDashboardSourceArtifact(dashboard, "search_index_contract");
    if (!searchIndexResult.available) {
      return jsonResponse(503, buildError("search_index_contract_unavailable", searchIndexResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("search_index_validations", searchIndexResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/vector-index-policies") {
    const vectorPolicyResult = await readDashboardSourceArtifact(dashboard, "vector_index_policy_boundary");
    if (!vectorPolicyResult.available) {
      return jsonResponse(503, buildError("vector_index_policy_boundary_unavailable", vectorPolicyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("vector_index_policies", [vectorPolicyResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/vector-policy-gates") {
    const vectorPolicyResult = await readDashboardSourceArtifact(dashboard, "vector_index_policy_boundary");
    if (!vectorPolicyResult.available) {
      return jsonResponse(503, buildError("vector_index_policy_boundary_unavailable", vectorPolicyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("vector_policy_gates", vectorPolicyResult.artifact.vector_policy_catalog?.vector_policy_gates ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/embedding-route-policies") {
    const vectorPolicyResult = await readDashboardSourceArtifact(dashboard, "vector_index_policy_boundary");
    if (!vectorPolicyResult.available) {
      return jsonResponse(503, buildError("vector_index_policy_boundary_unavailable", vectorPolicyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("embedding_route_policies", vectorPolicyResult.artifact.vector_policy_catalog?.embedding_route_policies ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/vector-policy-validations") {
    const vectorPolicyResult = await readDashboardSourceArtifact(dashboard, "vector_index_policy_boundary");
    if (!vectorPolicyResult.available) {
      return jsonResponse(503, buildError("vector_index_policy_boundary_unavailable", vectorPolicyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("vector_policy_validations", vectorPolicyResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retrieval-filter-compilers") {
    const filterResult = await readDashboardSourceArtifact(dashboard, "retrieval_filter_compiler");
    if (!filterResult.available) {
      return jsonResponse(503, buildError("retrieval_filter_compiler_unavailable", filterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retrieval_filter_compilers", [filterResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/compiled-retrieval-filters") {
    const filterResult = await readDashboardSourceArtifact(dashboard, "retrieval_filter_compiler");
    if (!filterResult.available) {
      return jsonResponse(503, buildError("retrieval_filter_compiler_unavailable", filterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("compiled_retrieval_filters", filterResult.artifact.retrieval_filter_catalog?.compiled_retrieval_filters ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retrieval-query-bindings") {
    const filterResult = await readDashboardSourceArtifact(dashboard, "retrieval_filter_compiler");
    if (!filterResult.available) {
      return jsonResponse(503, buildError("retrieval_filter_compiler_unavailable", filterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retrieval_query_bindings", filterResult.artifact.retrieval_filter_catalog?.retrieval_query_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retrieval-filter-probes") {
    const filterResult = await readDashboardSourceArtifact(dashboard, "retrieval_filter_compiler");
    if (!filterResult.available) {
      return jsonResponse(503, buildError("retrieval_filter_compiler_unavailable", filterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retrieval_filter_probes", filterResult.artifact.retrieval_filter_catalog?.retrieval_filter_probes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retrieval-filter-validations") {
    const filterResult = await readDashboardSourceArtifact(dashboard, "retrieval_filter_compiler");
    if (!filterResult.available) {
      return jsonResponse(503, buildError("retrieval_filter_compiler_unavailable", filterResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retrieval_filter_validations", filterResult.artifact.validation_items ?? [], url, generatedAt), method);
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
  if (pathname === "/api/matter-boundary-slices") {
    const sliceResult = await readDashboardSourceArtifact(dashboard, "matter_boundary_slice");
    if (!sliceResult.available) {
      return jsonResponse(503, buildError("matter_boundary_slice_unavailable", sliceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_boundary_slices", [sliceResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/matter-boundary-resource-paths") {
    const sliceResult = await readDashboardSourceArtifact(dashboard, "matter_boundary_slice");
    if (!sliceResult.available) {
      return jsonResponse(503, buildError("matter_boundary_slice_unavailable", sliceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_boundary_resource_paths", sliceResult.artifact.boundary_catalog?.resource_boundary_paths ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-boundary-retrieval-gates") {
    const sliceResult = await readDashboardSourceArtifact(dashboard, "matter_boundary_slice");
    if (!sliceResult.available) {
      return jsonResponse(503, buildError("matter_boundary_slice_unavailable", sliceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_boundary_retrieval_gates", sliceResult.artifact.boundary_catalog?.retrieval_gate_checks ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/matter-boundary-validations") {
    const sliceResult = await readDashboardSourceArtifact(dashboard, "matter_boundary_slice");
    if (!sliceResult.available) {
      return jsonResponse(503, buildError("matter_boundary_slice_unavailable", sliceResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("matter_boundary_validations", sliceResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-policy-matter-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "identity_policy_matter_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("identity_policy_matter_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_policy_matter_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/identity-policy-freeze-sources") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "identity_policy_matter_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("identity_policy_matter_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_policy_freeze_sources", freezeResult.artifact.freeze_source_statuses ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-policy-freeze-checkpoints") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "identity_policy_matter_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("identity_policy_matter_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_policy_freeze_checkpoints", freezeResult.artifact.freeze_checkpoints ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/identity-policy-freeze-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "identity_policy_matter_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("identity_policy_matter_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("identity_policy_freeze_validations", freezeResult.artifact.validation?.errors?.length ? freezeResult.artifact.validation.errors : freezeResult.artifact.freeze_checkpoints ?? [], url, generatedAt), method);
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
  if (pathname === "/api/policy-snapshot-event-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_event_bindings", [bindingResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/event-run-gate-policy-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_run_gate_policy_bindings", bindingResult.artifact.policy_snapshot_event_binding_catalog?.event_run_gate_policy_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/event-policy-snapshot-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_policy_snapshot_bindings", bindingResult.artifact.policy_snapshot_event_binding_catalog?.event_policy_snapshot_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/run-policy-snapshot-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("run_policy_snapshot_bindings", bindingResult.artifact.policy_snapshot_event_binding_catalog?.run_policy_snapshot_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/gate-policy-snapshot-bindings") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_policy_snapshot_bindings", bindingResult.artifact.policy_snapshot_event_binding_catalog?.gate_policy_snapshot_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/policy-snapshot-event-binding-validations") {
    const bindingResult = await readDashboardSourceArtifact(dashboard, "policy_snapshot_event_binding");
    if (!bindingResult.available) {
      return jsonResponse(503, buildError("policy_snapshot_event_binding_unavailable", bindingResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("policy_snapshot_event_binding_validations", bindingResult.artifact.validation_items ?? [], url, generatedAt), method);
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
  if (pathname === "/api/capability-manifest-v2-catalogs") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("capability_manifest_v2_catalogs", [catalogResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/capability-manifest-v2-records") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_v2_records", catalogResult.artifact.capability_manifests ?? catalogResult.artifact.capability_manifest_v2_catalog?.capability_manifests ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-manifest-field-matrix") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_field_matrix", catalogResult.artifact.capability_field_matrix ?? catalogResult.artifact.capability_manifest_v2_catalog?.field_matrix ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-manifest-gate-runtime-matrix") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_gate_runtime_matrix", catalogResult.artifact.capability_gate_runtime_matrix ?? catalogResult.artifact.capability_manifest_v2_catalog?.gate_runtime_matrix ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-manifest-policy-index") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_policy_index", catalogResult.artifact.capability_policy_index ?? catalogResult.artifact.capability_manifest_v2_catalog?.policy_index ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-manifest-version-policy-index") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_version_policy_index", catalogResult.artifact.capability_version_policy_index ?? catalogResult.artifact.capability_manifest_v2_catalog?.version_policy_index ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-manifest-v2-validations") {
    const catalogResult = await readDashboardSourceArtifact(dashboard, "capability_manifest_v2");
    if (!catalogResult.available) {
      return jsonResponse(503, buildError("capability_manifest_v2_unavailable", catalogResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_manifest_v2_validations", catalogResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pack-manifest-compatibility") {
    const compatibilityResult = await readDashboardSourceArtifact(dashboard, "pack_manifest_compatibility");
    if (!compatibilityResult.available) {
      return jsonResponse(503, buildError("pack_manifest_compatibility_unavailable", compatibilityResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("pack_manifest_compatibility", [compatibilityResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/pack-compatibility-records") {
    const compatibilityResult = await readDashboardSourceArtifact(dashboard, "pack_manifest_compatibility");
    if (!compatibilityResult.available) {
      return jsonResponse(503, buildError("pack_manifest_compatibility_unavailable", compatibilityResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pack_compatibility_records", compatibilityResult.artifact.pack_compatibility_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pack-dependency-edges") {
    const compatibilityResult = await readDashboardSourceArtifact(dashboard, "pack_manifest_compatibility");
    if (!compatibilityResult.available) {
      return jsonResponse(503, buildError("pack_manifest_compatibility_unavailable", compatibilityResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pack_dependency_edges", compatibilityResult.artifact.dependency_edges ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pack-compatibility-matrix") {
    const compatibilityResult = await readDashboardSourceArtifact(dashboard, "pack_manifest_compatibility");
    if (!compatibilityResult.available) {
      return jsonResponse(503, buildError("pack_manifest_compatibility_unavailable", compatibilityResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pack_compatibility_matrix", compatibilityResult.artifact.compatibility_matrix ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pack-manifest-compatibility-validations") {
    const compatibilityResult = await readDashboardSourceArtifact(dashboard, "pack_manifest_compatibility");
    if (!compatibilityResult.available) {
      return jsonResponse(503, buildError("pack_manifest_compatibility_unavailable", compatibilityResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pack_manifest_compatibility_validations", compatibilityResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-dsl-state-models") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_dsl_state_models", [modelResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-dsl-states") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_dsl_states", modelResult.artifact.workflow_dsl_states ?? modelResult.artifact.workflow_dsl_state_model?.workflow_dsl_states ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-dsl-transition-rules") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_dsl_transition_rules", modelResult.artifact.workflow_dsl_transition_rules ?? modelResult.artifact.workflow_dsl_state_model?.transition_rules ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-state-blueprints") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_state_blueprints", modelResult.artifact.workflow_state_blueprints ?? modelResult.artifact.workflow_dsl_state_model?.workflow_state_blueprints ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-state-projections") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_state_projections", modelResult.artifact.workflow_run_state_projections ?? modelResult.artifact.workflow_dsl_state_model?.workflow_run_state_projections ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-dsl-state-validations") {
    const modelResult = await readDashboardSourceArtifact(dashboard, "workflow_dsl_state_model");
    if (!modelResult.available) {
      return jsonResponse(503, buildError("workflow_dsl_state_model_unavailable", modelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_dsl_state_validations", modelResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-state-machine-runners") {
    const runnerResult = await readDashboardSourceArtifact(dashboard, "workflow_state_machine_runner");
    if (!runnerResult.available) {
      return jsonResponse(503, buildError("workflow_state_machine_runner_unavailable", runnerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_state_machine_runners", [runnerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-transition-guards") {
    const runnerResult = await readDashboardSourceArtifact(dashboard, "workflow_state_machine_runner");
    if (!runnerResult.available) {
      return jsonResponse(503, buildError("workflow_state_machine_runner_unavailable", runnerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_transition_guards", runnerResult.artifact.transition_guard_records ?? runnerResult.artifact.workflow_state_machine_runner?.transition_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-runner-audit-events") {
    const runnerResult = await readDashboardSourceArtifact(dashboard, "workflow_state_machine_runner");
    if (!runnerResult.available) {
      return jsonResponse(503, buildError("workflow_state_machine_runner_unavailable", runnerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_runner_audit_events", runnerResult.artifact.runner_audit_event_candidates ?? runnerResult.artifact.workflow_state_machine_runner?.runner_audit_event_candidates ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-runner-plans") {
    const runnerResult = await readDashboardSourceArtifact(dashboard, "workflow_state_machine_runner");
    if (!runnerResult.available) {
      return jsonResponse(503, buildError("workflow_state_machine_runner_unavailable", runnerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_runner_plans", runnerResult.artifact.workflow_runner_plans ?? runnerResult.artifact.workflow_state_machine_runner?.workflow_runner_plans ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-runner-validations") {
    const runnerResult = await readDashboardSourceArtifact(dashboard, "workflow_state_machine_runner");
    if (!runnerResult.available) {
      return jsonResponse(503, buildError("workflow_state_machine_runner_unavailable", runnerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_runner_validations", runnerResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-queue-retry-backoff-contracts") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "workflow_queue_retry_backoff_contract");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("workflow_queue_retry_backoff_contract_unavailable", queueResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_queue_retry_backoff_contracts", [queueResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-queue-records") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "workflow_queue_retry_backoff_contract");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("workflow_queue_retry_backoff_contract_unavailable", queueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_queue_records", queueResult.artifact.workflow_queue_records ?? queueResult.artifact.workflow_queue_retry_backoff_contract?.workflow_queue_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-retry-classifications") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "workflow_queue_retry_backoff_contract");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("workflow_queue_retry_backoff_contract_unavailable", queueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_retry_classifications", queueResult.artifact.retry_classification_records ?? queueResult.artifact.workflow_queue_retry_backoff_contract?.retry_classification_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-backoff-policies") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "workflow_queue_retry_backoff_contract");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("workflow_queue_retry_backoff_contract_unavailable", queueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_backoff_policies", queueResult.artifact.backoff_policy_records ?? queueResult.artifact.workflow_queue_retry_backoff_contract?.backoff_policy_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-queue-validations") {
    const queueResult = await readDashboardSourceArtifact(dashboard, "workflow_queue_retry_backoff_contract");
    if (!queueResult.available) {
      return jsonResponse(503, buildError("workflow_queue_retry_backoff_contract_unavailable", queueResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_queue_validations", queueResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-idempotency-ledgers") {
    const idempotencyResult = await readDashboardSourceArtifact(dashboard, "workflow_idempotency_ledger");
    if (!idempotencyResult.available) {
      return jsonResponse(503, buildError("workflow_idempotency_ledger_unavailable", idempotencyResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_idempotency_ledgers", [idempotencyResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-idempotency-keys") {
    const idempotencyResult = await readDashboardSourceArtifact(dashboard, "workflow_idempotency_ledger");
    if (!idempotencyResult.available) {
      return jsonResponse(503, buildError("workflow_idempotency_ledger_unavailable", idempotencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_idempotency_keys", idempotencyResult.artifact.idempotency_key_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-idempotency-decisions") {
    const idempotencyResult = await readDashboardSourceArtifact(dashboard, "workflow_idempotency_ledger");
    if (!idempotencyResult.available) {
      return jsonResponse(503, buildError("workflow_idempotency_ledger_unavailable", idempotencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_idempotency_decisions", idempotencyResult.artifact.idempotency_decision_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-duplicate-probes") {
    const idempotencyResult = await readDashboardSourceArtifact(dashboard, "workflow_idempotency_ledger");
    if (!idempotencyResult.available) {
      return jsonResponse(503, buildError("workflow_idempotency_ledger_unavailable", idempotencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_duplicate_probes", idempotencyResult.artifact.duplicate_probe_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-idempotency-validations") {
    const idempotencyResult = await readDashboardSourceArtifact(dashboard, "workflow_idempotency_ledger");
    if (!idempotencyResult.available) {
      return jsonResponse(503, buildError("workflow_idempotency_ledger_unavailable", idempotencyResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_idempotency_validations", idempotencyResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-resume-cancel-contracts") {
    const resumeCancelResult = await readDashboardSourceArtifact(dashboard, "workflow_resume_cancel_contract");
    if (!resumeCancelResult.available) {
      return jsonResponse(503, buildError("workflow_resume_cancel_contract_unavailable", resumeCancelResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_resume_cancel_contracts", [resumeCancelResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-resume-cursors") {
    const resumeCancelResult = await readDashboardSourceArtifact(dashboard, "workflow_resume_cancel_contract");
    if (!resumeCancelResult.available) {
      return jsonResponse(503, buildError("workflow_resume_cancel_contract_unavailable", resumeCancelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_resume_cursors", resumeCancelResult.artifact.resume_cursor_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-cancel-requests") {
    const resumeCancelResult = await readDashboardSourceArtifact(dashboard, "workflow_resume_cancel_contract");
    if (!resumeCancelResult.available) {
      return jsonResponse(503, buildError("workflow_resume_cancel_contract_unavailable", resumeCancelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_cancel_requests", resumeCancelResult.artifact.cancel_request_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-resume-cancel-decisions") {
    const resumeCancelResult = await readDashboardSourceArtifact(dashboard, "workflow_resume_cancel_contract");
    if (!resumeCancelResult.available) {
      return jsonResponse(503, buildError("workflow_resume_cancel_contract_unavailable", resumeCancelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_resume_cancel_decisions", resumeCancelResult.artifact.resume_cancel_decision_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-resume-cancel-validations") {
    const resumeCancelResult = await readDashboardSourceArtifact(dashboard, "workflow_resume_cancel_contract");
    if (!resumeCancelResult.available) {
      return jsonResponse(503, buildError("workflow_resume_cancel_contract_unavailable", resumeCancelResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_resume_cancel_validations", resumeCancelResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-context-builder-contracts") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_context_builder_contracts", [contextBuilderResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/context-packet-v2-records") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("context_packet_v2_records", contextBuilderResult.artifact.context_packet_v2_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/context-resource-selections") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("context_resource_selections", contextBuilderResult.artifact.context_resource_selection_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/context-token-budgets") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("context_token_budgets", contextBuilderResult.artifact.context_token_budget_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/context-citation-hints") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("context_citation_hints", contextBuilderResult.artifact.context_citation_hint_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-context-builder-validations") {
    const contextBuilderResult = await readDashboardSourceArtifact(dashboard, "workflow_context_builder_contract");
    if (!contextBuilderResult.available) {
      return jsonResponse(503, buildError("workflow_context_builder_contract_unavailable", contextBuilderResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_context_builder_validations", contextBuilderResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-retrieval-compilers") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_retrieval_compilers", [retrievalCompilerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/retrieval-request-records") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("retrieval_request_records", retrievalCompilerResult.artifact.retrieval_request_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/retrieval-candidate-records") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("retrieval_candidate_records", retrievalCompilerResult.artifact.retrieval_candidate_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/source-span-priority-records") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("source_span_priority_records", retrievalCompilerResult.artifact.source_span_priority_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/retrieval-guard-records") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("retrieval_guard_records", retrievalCompilerResult.artifact.retrieval_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-retrieval-validations") {
    const retrievalCompilerResult = await readDashboardSourceArtifact(dashboard, "workflow_retrieval_compiler");
    if (!retrievalCompilerResult.available) {
      return jsonResponse(503, buildError("workflow_retrieval_compiler_unavailable", retrievalCompilerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_retrieval_validations", retrievalCompilerResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-prompt-injection-boundaries") {
    const promptBoundaryResult = await readDashboardSourceArtifact(dashboard, "workflow_prompt_injection_boundary");
    if (!promptBoundaryResult.available) {
      return jsonResponse(503, buildError("workflow_prompt_injection_boundary_unavailable", promptBoundaryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_prompt_injection_boundaries", [promptBoundaryResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/untrusted-content-wrappers") {
    const promptBoundaryResult = await readDashboardSourceArtifact(dashboard, "workflow_prompt_injection_boundary");
    if (!promptBoundaryResult.available) {
      return jsonResponse(503, buildError("workflow_prompt_injection_boundary_unavailable", promptBoundaryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("untrusted_content_wrappers", promptBoundaryResult.artifact.untrusted_content_wrapper_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/instruction-signal-records") {
    const promptBoundaryResult = await readDashboardSourceArtifact(dashboard, "workflow_prompt_injection_boundary");
    if (!promptBoundaryResult.available) {
      return jsonResponse(503, buildError("workflow_prompt_injection_boundary_unavailable", promptBoundaryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("instruction_signal_records", promptBoundaryResult.artifact.instruction_signal_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/prompt-boundary-guard-records") {
    const promptBoundaryResult = await readDashboardSourceArtifact(dashboard, "workflow_prompt_injection_boundary");
    if (!promptBoundaryResult.available) {
      return jsonResponse(503, buildError("workflow_prompt_injection_boundary_unavailable", promptBoundaryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("prompt_boundary_guard_records", promptBoundaryResult.artifact.prompt_boundary_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/prompt-injection-boundary-validations") {
    const promptBoundaryResult = await readDashboardSourceArtifact(dashboard, "workflow_prompt_injection_boundary");
    if (!promptBoundaryResult.available) {
      return jsonResponse(503, buildError("workflow_prompt_injection_boundary_unavailable", promptBoundaryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("prompt_injection_boundary_validations", promptBoundaryResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-pre-run-gate-frameworks") {
    const preRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_pre_run_gate_framework");
    if (!preRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_pre_run_gate_framework_unavailable", preRunGateResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_pre_run_gate_frameworks", [preRunGateResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/pre-run-gate-records") {
    const preRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_pre_run_gate_framework");
    if (!preRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_pre_run_gate_framework_unavailable", preRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pre_run_gate_records", preRunGateResult.artifact.pre_run_gate_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pre-run-gate-decisions") {
    const preRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_pre_run_gate_framework");
    if (!preRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_pre_run_gate_framework_unavailable", preRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pre_run_gate_decisions", preRunGateResult.artifact.pre_run_gate_decision_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pre-run-gate-guards") {
    const preRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_pre_run_gate_framework");
    if (!preRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_pre_run_gate_framework_unavailable", preRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pre_run_gate_guards", preRunGateResult.artifact.pre_run_gate_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/pre-run-gate-validations") {
    const preRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_pre_run_gate_framework");
    if (!preRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_pre_run_gate_framework_unavailable", preRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pre_run_gate_validations", preRunGateResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-in-run-gate-frameworks") {
    const inRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_in_run_gate_framework");
    if (!inRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_in_run_gate_framework_unavailable", inRunGateResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_in_run_gate_frameworks", [inRunGateResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/in-run-gate-records") {
    const inRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_in_run_gate_framework");
    if (!inRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_in_run_gate_framework_unavailable", inRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("in_run_gate_records", inRunGateResult.artifact.in_run_gate_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/in-run-block-records") {
    const inRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_in_run_gate_framework");
    if (!inRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_in_run_gate_framework_unavailable", inRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("in_run_block_records", inRunGateResult.artifact.in_run_block_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/in-run-guard-records") {
    const inRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_in_run_gate_framework");
    if (!inRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_in_run_gate_framework_unavailable", inRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("in_run_guard_records", inRunGateResult.artifact.in_run_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/in-run-gate-validations") {
    const inRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_in_run_gate_framework");
    if (!inRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_in_run_gate_framework_unavailable", inRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("in_run_gate_validations", inRunGateResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-post-run-gate-frameworks") {
    const postRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_post_run_gate_framework");
    if (!postRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_post_run_gate_framework_unavailable", postRunGateResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_post_run_gate_frameworks", [postRunGateResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/post-run-gate-records") {
    const postRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_post_run_gate_framework");
    if (!postRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_post_run_gate_framework_unavailable", postRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("post_run_gate_records", postRunGateResult.artifact.post_run_gate_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/post-run-gate-decisions") {
    const postRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_post_run_gate_framework");
    if (!postRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_post_run_gate_framework_unavailable", postRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("post_run_gate_decisions", postRunGateResult.artifact.post_run_gate_decision_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/post-run-gate-guards") {
    const postRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_post_run_gate_framework");
    if (!postRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_post_run_gate_framework_unavailable", postRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("post_run_gate_guards", postRunGateResult.artifact.post_run_guard_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/post-run-gate-validations") {
    const postRunGateResult = await readDashboardSourceArtifact(dashboard, "workflow_post_run_gate_framework");
    if (!postRunGateResult.available) {
      return jsonResponse(503, buildError("workflow_post_run_gate_framework_unavailable", postRunGateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("post_run_gate_validations", postRunGateResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/gate-result-aggregators") {
    const aggregateResult = await readDashboardSourceArtifact(dashboard, "gate_result_aggregator");
    if (!aggregateResult.available) {
      return jsonResponse(503, buildError("gate_result_aggregator_unavailable", aggregateResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_result_aggregators", [aggregateResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/gate-aggregate-records") {
    const aggregateResult = await readDashboardSourceArtifact(dashboard, "gate_result_aggregator");
    if (!aggregateResult.available) {
      return jsonResponse(503, buildError("gate_result_aggregator_unavailable", aggregateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_aggregate_records", aggregateResult.artifact.gate_aggregate_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-gate-statuses") {
    const aggregateResult = await readDashboardSourceArtifact(dashboard, "gate_result_aggregator");
    if (!aggregateResult.available) {
      return jsonResponse(503, buildError("gate_result_aggregator_unavailable", aggregateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_gate_statuses", aggregateResult.artifact.workflow_gate_status_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/gate-result-aggregate-validations") {
    const aggregateResult = await readDashboardSourceArtifact(dashboard, "gate_result_aggregator");
    if (!aggregateResult.available) {
      return jsonResponse(503, buildError("gate_result_aggregator_unavailable", aggregateResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_result_aggregate_validations", aggregateResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-registry-apis") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("capability_registry_apis", [registryApiResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/capability-registry-packs") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("pack_api_cards", registryApiResult.artifact.pack_api_cards ?? registryApiResult.artifact.capability_registry_api_catalog?.pack_api_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-registry-capabilities") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_api_cards", registryApiResult.artifact.capability_api_cards ?? registryApiResult.artifact.capability_registry_api_catalog?.capability_api_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-registry-versions") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_version_api_cards", registryApiResult.artifact.capability_version_api_cards ?? registryApiResult.artifact.capability_registry_api_catalog?.capability_version_api_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-registry-gates") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("gate_requirement_api_cards", registryApiResult.artifact.gate_requirement_api_cards ?? registryApiResult.artifact.capability_registry_api_catalog?.gate_requirement_api_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/desktop-companion-route-groups") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("desktop_companion_route_groups", registryApiResult.artifact.desktop_companion_route_groups ?? registryApiResult.artifact.capability_registry_api_catalog?.desktop_companion_route_groups ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/capability-registry-api-validations") {
    const registryApiResult = await readDashboardSourceArtifact(dashboard, "capability_registry_api");
    if (!registryApiResult.available) {
      return jsonResponse(503, buildError("capability_registry_api_unavailable", registryApiResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("capability_registry_api_validations", registryApiResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-dashboards") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_run_dashboards", [workflowRunDashboardResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-run-dashboard-panels") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_dashboard_panels", workflowRunDashboardResult.artifact.workflow_run_dashboard_panels ?? workflowRunDashboardResult.artifact.workflow_run_dashboard_catalog?.workflow_run_dashboard_panels ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-state-cards") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_state_cards", workflowRunDashboardResult.artifact.workflow_run_state_cards ?? workflowRunDashboardResult.artifact.workflow_run_dashboard_catalog?.workflow_run_state_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-queue-cards") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_queue_cards", workflowRunDashboardResult.artifact.workflow_run_queue_cards ?? workflowRunDashboardResult.artifact.workflow_run_dashboard_catalog?.workflow_run_queue_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-gate-cards") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_gate_cards", workflowRunDashboardResult.artifact.workflow_run_gate_cards ?? workflowRunDashboardResult.artifact.workflow_run_dashboard_catalog?.workflow_run_gate_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-output-cards") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_output_cards", workflowRunDashboardResult.artifact.workflow_run_output_cards ?? workflowRunDashboardResult.artifact.workflow_run_dashboard_catalog?.workflow_run_output_cards ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-dashboard-validations") {
    const workflowRunDashboardResult = await readDashboardSourceArtifact(dashboard, "workflow_run_dashboard");
    if (!workflowRunDashboardResult.available) {
      return jsonResponse(503, buildError("workflow_run_dashboard_unavailable", workflowRunDashboardResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_dashboard_validations", workflowRunDashboardResult.artifact.validation_items ?? [], url, generatedAt),
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
  if (pathname === "/api/event-envelope-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "event_envelope_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("event_envelope_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_envelope_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/event-envelopes") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "event_envelope_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("event_envelope_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_envelopes", ledgerResult.artifact.event_envelope_catalog?.event_envelopes ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-envelope-source-bindings") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "event_envelope_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("event_envelope_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_envelope_source_bindings", ledgerResult.artifact.event_envelope_catalog?.source_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-envelope-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "event_envelope_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("event_envelope_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_envelope_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-type-registries") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "event_type_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("event_type_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_type_registries", [registryResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/event-types") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "event_type_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("event_type_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_types", registryResult.artifact.event_type_catalog?.event_type_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-families") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "event_type_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("event_type_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_families", registryResult.artifact.event_type_catalog?.event_family_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-type-bindings") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "event_type_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("event_type_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_type_bindings", registryResult.artifact.event_type_catalog?.event_type_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-type-registry-validations") {
    const registryResult = await readDashboardSourceArtifact(dashboard, "event_type_registry");
    if (!registryResult.available) {
      return jsonResponse(503, buildError("event_type_registry_unavailable", registryResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_type_registry_validations", registryResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/append-only-event-stores") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "append_only_event_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("append_only_event_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("append_only_event_stores", [storeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/stored-events") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "append_only_event_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("append_only_event_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("stored_events", storeResult.artifact.event_store_catalog?.stored_events ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-streams") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "append_only_event_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("append_only_event_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_streams", storeResult.artifact.event_store_catalog?.event_streams ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-correction-policies") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "append_only_event_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("append_only_event_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_correction_policies", [storeResult.artifact.event_store_catalog?.correction_policy].filter(Boolean), url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-store-validations") {
    const storeResult = await readDashboardSourceArtifact(dashboard, "append_only_event_store");
    if (!storeResult.available) {
      return jsonResponse(503, buildError("append_only_event_store_unavailable", storeResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_store_validations", storeResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-correlation-ledgers") {
    const correlationResult = await readDashboardSourceArtifact(dashboard, "event_correlation_ledger");
    if (!correlationResult.available) {
      return jsonResponse(503, buildError("event_correlation_ledger_unavailable", correlationResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_correlation_ledgers", [correlationResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/correlation-traces") {
    const correlationResult = await readDashboardSourceArtifact(dashboard, "event_correlation_ledger");
    if (!correlationResult.available) {
      return jsonResponse(503, buildError("event_correlation_ledger_unavailable", correlationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("correlation_traces", correlationResult.artifact.event_correlation_catalog?.correlation_traces ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/causation-edges") {
    const correlationResult = await readDashboardSourceArtifact(dashboard, "event_correlation_ledger");
    if (!correlationResult.available) {
      return jsonResponse(503, buildError("event_correlation_ledger_unavailable", correlationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("causation_edges", correlationResult.artifact.event_correlation_catalog?.causation_edges ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/trace-run-bindings") {
    const correlationResult = await readDashboardSourceArtifact(dashboard, "event_correlation_ledger");
    if (!correlationResult.available) {
      return jsonResponse(503, buildError("event_correlation_ledger_unavailable", correlationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("trace_run_bindings", correlationResult.artifact.event_correlation_catalog?.trace_run_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/event-correlation-validations") {
    const correlationResult = await readDashboardSourceArtifact(dashboard, "event_correlation_ledger");
    if (!correlationResult.available) {
      return jsonResponse(503, buildError("event_correlation_ledger_unavailable", correlationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("event_correlation_validations", correlationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-ledgers") {
    const workflowRunResult = await readDashboardSourceArtifact(dashboard, "workflow_run_ledger");
    if (!workflowRunResult.available) {
      return jsonResponse(503, buildError("workflow_run_ledger_unavailable", workflowRunResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_run_ledgers", [workflowRunResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-run-records") {
    const workflowRunResult = await readDashboardSourceArtifact(dashboard, "workflow_run_ledger");
    if (!workflowRunResult.available) {
      return jsonResponse(503, buildError("workflow_run_ledger_unavailable", workflowRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_records", workflowRunResult.artifact.workflow_run_catalog?.workflow_run_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-state-transitions") {
    const workflowRunResult = await readDashboardSourceArtifact(dashboard, "workflow_run_ledger");
    if (!workflowRunResult.available) {
      return jsonResponse(503, buildError("workflow_run_ledger_unavailable", workflowRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_state_transitions", workflowRunResult.artifact.workflow_run_catalog?.workflow_state_transitions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-event-bindings") {
    const workflowRunResult = await readDashboardSourceArtifact(dashboard, "workflow_run_ledger");
    if (!workflowRunResult.available) {
      return jsonResponse(503, buildError("workflow_run_ledger_unavailable", workflowRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_event_bindings", workflowRunResult.artifact.workflow_run_catalog?.workflow_event_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/workflow-run-ledger-validations") {
    const workflowRunResult = await readDashboardSourceArtifact(dashboard, "workflow_run_ledger");
    if (!workflowRunResult.available) {
      return jsonResponse(503, buildError("workflow_run_ledger_unavailable", workflowRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("workflow_run_ledger_validations", workflowRunResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-ledgers") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("agent_run_ledgers", [agentRunResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/agent-run-records") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_records", agentRunResult.artifact.agent_run_catalog?.agent_run_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-io-references") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_io_references", agentRunResult.artifact.agent_run_catalog?.agent_run_io_references ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-artifact-references") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_artifact_references", agentRunResult.artifact.agent_run_catalog?.agent_run_artifact_references ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-log-references") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_log_references", agentRunResult.artifact.agent_run_catalog?.agent_run_log_references ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-event-bindings") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_event_bindings", agentRunResult.artifact.agent_run_catalog?.agent_run_event_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/agent-run-ledger-validations") {
    const agentRunResult = await readDashboardSourceArtifact(dashboard, "agent_run_ledger");
    if (!agentRunResult.available) {
      return jsonResponse(503, buildError("agent_run_ledger_unavailable", agentRunResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("agent_run_ledger_validations", agentRunResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/tool-invocation-ledgers") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("tool_invocation_ledgers", [toolInvocationResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/tool-invocation-records") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("tool_invocation_records", toolInvocationResult.artifact.tool_invocation_catalog?.tool_invocation_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/tool-invocation-permission-decisions") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("tool_invocation_permission_decisions", toolInvocationResult.artifact.tool_invocation_catalog?.tool_invocation_permission_decisions ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/tool-invocation-agent-bindings") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("tool_invocation_agent_bindings", toolInvocationResult.artifact.tool_invocation_catalog?.tool_invocation_agent_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/tool-invocation-event-bindings") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("tool_invocation_event_bindings", toolInvocationResult.artifact.tool_invocation_catalog?.tool_invocation_event_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/tool-invocation-ledger-validations") {
    const toolInvocationResult = await readDashboardSourceArtifact(dashboard, "tool_invocation_ledger");
    if (!toolInvocationResult.available) {
      return jsonResponse(503, buildError("tool_invocation_ledger_unavailable", toolInvocationResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("tool_invocation_ledger_validations", toolInvocationResult.artifact.validation_items ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-event-ledgers") {
    const auditEventResult = await readDashboardSourceArtifact(dashboard, "audit_event_ledger");
    if (!auditEventResult.available) {
      return jsonResponse(503, buildError("audit_event_ledger_unavailable", auditEventResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("audit_event_ledgers", [auditEventResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/audit-trail-records") {
    const auditEventResult = await readDashboardSourceArtifact(dashboard, "audit_event_ledger");
    if (!auditEventResult.available) {
      return jsonResponse(503, buildError("audit_event_ledger_unavailable", auditEventResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_trail_records", auditEventResult.artifact.audit_event_catalog?.audit_trail_records ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-separation-bindings") {
    const auditEventResult = await readDashboardSourceArtifact(dashboard, "audit_event_ledger");
    if (!auditEventResult.available) {
      return jsonResponse(503, buildError("audit_event_ledger_unavailable", auditEventResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_separation_bindings", auditEventResult.artifact.audit_event_catalog?.audit_separation_bindings ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-source-rollups") {
    const auditEventResult = await readDashboardSourceArtifact(dashboard, "audit_event_ledger");
    if (!auditEventResult.available) {
      return jsonResponse(503, buildError("audit_event_ledger_unavailable", auditEventResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_source_rollups", auditEventResult.artifact.audit_event_catalog?.audit_source_rollups ?? [], url, generatedAt),
      method,
    );
  }
  if (pathname === "/api/audit-event-ledger-validations") {
    const auditEventResult = await readDashboardSourceArtifact(dashboard, "audit_event_ledger");
    if (!auditEventResult.available) {
      return jsonResponse(503, buildError("audit_event_ledger_unavailable", auditEventResult.error), method);
    }
    return jsonResponse(
      200,
      buildCollectionResponse("audit_event_ledger_validations", auditEventResult.artifact.validation_items ?? [], url, generatedAt),
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
  if (pathname === "/api/cost-record-projections") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "cost_record_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("cost_record_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_record_projections", [projectionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/projected-cost-records") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "cost_record_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("cost_record_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("projected_cost_records", projectionResult.artifact.cost_record_projection_catalog?.projected_cost_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/run-cost-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "cost_record_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("cost_record_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("run_cost_rollups", projectionResult.artifact.cost_record_projection_catalog?.run_cost_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/cost-category-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "cost_record_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("cost_record_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_category_rollups", projectionResult.artifact.cost_record_projection_catalog?.cost_category_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/cost-record-projection-validations") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "cost_record_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("cost_record_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("cost_record_projection_validations", projectionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/token-usage-projections") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("token_usage_projections", [projectionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/projected-token-usage-records") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("projected_token_usage_records", projectionResult.artifact.token_usage_projection_catalog?.projected_token_usage_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/capability-token-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("capability_token_rollups", projectionResult.artifact.token_usage_projection_catalog?.capability_token_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/runtime-token-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("runtime_token_rollups", projectionResult.artifact.token_usage_projection_catalog?.runtime_token_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/capability-runtime-token-rollups") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("capability_runtime_token_rollups", projectionResult.artifact.token_usage_projection_catalog?.capability_runtime_token_rollups ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/token-usage-projection-validations") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "token_usage_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("token_usage_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("token_usage_projection_validations", projectionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-trace-projections") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_trace_projections", [projectionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/observability-trace-records") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_trace_records", projectionResult.artifact.observability_trace_projection_catalog?.observability_trace_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/workflow-trace-bindings") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("workflow_trace_bindings", projectionResult.artifact.observability_trace_projection_catalog?.workflow_trace_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/agent-trace-bindings") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("agent_trace_bindings", projectionResult.artifact.observability_trace_projection_catalog?.agent_trace_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/gate-trace-bindings") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("gate_trace_bindings", projectionResult.artifact.observability_trace_projection_catalog?.gate_trace_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/output-trace-bindings") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("output_trace_bindings", projectionResult.artifact.observability_trace_projection_catalog?.output_trace_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-trace-projection-validations") {
    const projectionResult = await readDashboardSourceArtifact(dashboard, "observability_trace_projection");
    if (!projectionResult.available) {
      return jsonResponse(503, buildError("observability_trace_projection_unavailable", projectionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_trace_projection_validations", projectionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/error-retry-ledgers") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("error_retry_ledgers", [ledgerResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/projected-error-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("projected_error_records", ledgerResult.artifact.error_retry_ledger_catalog?.projected_error_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retry-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retry_records", ledgerResult.artifact.error_retry_ledger_catalog?.retry_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/timeout-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("timeout_records", ledgerResult.artifact.error_retry_ledger_catalog?.timeout_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/resume-state-records") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("resume_state_records", ledgerResult.artifact.error_retry_ledger_catalog?.resume_state_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/error-retry-ledger-validations") {
    const ledgerResult = await readDashboardSourceArtifact(dashboard, "error_retry_ledger");
    if (!ledgerResult.available) {
      return jsonResponse(503, buildError("error_retry_ledger_unavailable", ledgerResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("error_retry_ledger_validations", ledgerResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/event-replay-harnesses") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_replay_harnesses", [replayResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/replayed-event-streams") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("replayed_event_streams", replayResult.artifact.event_replay_catalog?.replayed_event_streams ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/replayed-run-summaries") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("replayed_run_summaries", replayResult.artifact.event_replay_catalog?.replayed_run_summaries ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/dashboard-replay-projections") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("dashboard_replay_projections", [replayResult.artifact.event_replay_catalog?.dashboard_replay_projection].filter(Boolean), url, generatedAt), method);
  }
  if (pathname === "/api/dashboard-replay-metrics") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    const projection = replayResult.artifact.event_replay_catalog?.dashboard_replay_projection ?? {};
    return jsonResponse(200, buildCollectionResponse("dashboard_replay_metrics", projection.projection_metrics ?? projection.replayed_metrics ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/event-replay-validations") {
    const replayResult = await readDashboardSourceArtifact(dashboard, "event_replay_harness");
    if (!replayResult.available) {
      return jsonResponse(503, buildError("event_replay_harness_unavailable", replayResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("event_replay_validations", replayResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retention-archive-ledgers") {
    const retentionResult = await readDashboardSourceArtifact(dashboard, "retention_archive_ledger");
    if (!retentionResult.available) {
      return jsonResponse(503, buildError("retention_archive_ledger_unavailable", retentionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retention_archive_ledgers", [retentionResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/retention-policy-records") {
    const retentionResult = await readDashboardSourceArtifact(dashboard, "retention_archive_ledger");
    if (!retentionResult.available) {
      return jsonResponse(503, buildError("retention_archive_ledger_unavailable", retentionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retention_policy_records", retentionResult.artifact.retention_archive_catalog?.retention_policy_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/archive-candidate-records") {
    const retentionResult = await readDashboardSourceArtifact(dashboard, "retention_archive_ledger");
    if (!retentionResult.available) {
      return jsonResponse(503, buildError("retention_archive_ledger_unavailable", retentionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("archive_candidate_records", retentionResult.artifact.retention_archive_catalog?.archive_candidate_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/legal-hold-bindings") {
    const retentionResult = await readDashboardSourceArtifact(dashboard, "retention_archive_ledger");
    if (!retentionResult.available) {
      return jsonResponse(503, buildError("retention_archive_ledger_unavailable", retentionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("legal_hold_bindings", retentionResult.artifact.retention_archive_catalog?.legal_hold_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/retention-archive-validations") {
    const retentionResult = await readDashboardSourceArtifact(dashboard, "retention_archive_ledger");
    if (!retentionResult.available) {
      return jsonResponse(503, buildError("retention_archive_ledger_unavailable", retentionResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("retention_archive_validations", retentionResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-api-dashboards") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_api_dashboards", [ledgerApiDashboardResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-dashboard-panels") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_dashboard_panels", ledgerApiDashboardResult.artifact.ledger_api_dashboard_catalog?.ledger_dashboard_panels ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-api-route-records") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_api_route_records", ledgerApiDashboardResult.artifact.ledger_api_dashboard_catalog?.ledger_api_route_records ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-panel-metrics") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_panel_metrics", ledgerApiDashboardResult.artifact.ledger_api_dashboard_catalog?.ledger_panel_metrics ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-cross-links") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_cross_links", ledgerApiDashboardResult.artifact.ledger_api_dashboard_catalog?.ledger_cross_links ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-api-dashboard-validations") {
    const ledgerApiDashboardResult = await readDashboardSourceArtifact(dashboard, "ledger_api_dashboard");
    if (!ledgerApiDashboardResult.available) {
      return jsonResponse(503, buildError("ledger_api_dashboard_unavailable", ledgerApiDashboardResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_api_dashboard_validations", ledgerApiDashboardResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-golden-fixtures") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "ledger_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("ledger_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_golden_fixtures", [fixtureResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-golden-cases") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "ledger_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("ledger_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_golden_cases", fixtureResult.artifact.ledger_golden_fixture_catalog?.ledger_golden_cases ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-fixture-matrix") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "ledger_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("ledger_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_fixture_matrix", [fixtureResult.artifact.ledger_golden_fixture_catalog?.ledger_fixture_matrix ?? {}], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-regression-hashes") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "ledger_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("ledger_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_regression_hashes", fixtureResult.artifact.ledger_golden_fixture_catalog?.ledger_regression_manifest?.ledger_regression_hashes ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/ledger-golden-validations") {
    const fixtureResult = await readDashboardSourceArtifact(dashboard, "ledger_golden_fixtures");
    if (!fixtureResult.available) {
      return jsonResponse(503, buildError("ledger_golden_fixtures_unavailable", fixtureResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("ledger_golden_validations", fixtureResult.artifact.validation_items ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freezes") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freezes", [freezeResult.artifact], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freeze-sources") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freeze_sources", freezeResult.artifact.freeze_source_statuses ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freeze-checkpoints") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freeze_checkpoints", freezeResult.artifact.freeze_checkpoints ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freeze-traces") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freeze_traces", freezeResult.artifact.representative_traces ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freeze-loop-bindings") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freeze_loop_bindings", freezeResult.artifact.control_plane_loop_bindings ?? [], url, generatedAt), method);
  }
  if (pathname === "/api/observability-freeze-validations") {
    const freezeResult = await readDashboardSourceArtifact(dashboard, "observability_freeze");
    if (!freezeResult.available) {
      return jsonResponse(503, buildError("observability_freeze_unavailable", freezeResult.error), method);
    }
    return jsonResponse(200, buildCollectionResponse("observability_freeze_validations", freezeResult.artifact.validation_items ?? [], url, generatedAt), method);
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
  console.log("Routes: /, /health, /api, /api/dashboard, /api/stages, /api/actions, /api/sources, /api/resource-contract-freezes, /api/resource-v2-contracts, /api/resource-version-v2-contracts, /api/resource-contract-validations, /api/evidence-review-drafts, /api/evidence-review-items, /api/policy-matrices, /api/policy-classifications, /api/runtime-policies, /api/model-policies, /api/tool-policies, /api/output-policies, /api/gate-policies, /api/policy-snapshot-ledgers, /api/policy-snapshots, /api/policy-snapshot-instances, /api/policy-decisions, /api/policy-usages, /api/context-packet-ledgers, /api/context-packets, /api/context-items, /api/context-retrieval-filters, /api/model-routing-ledgers, /api/model-routing-decisions, /api/cost-budget-ledgers, /api/cost-budget-decisions, /api/token-usage-ledgers, /api/token-usage-records, /api/cost-attribution-ledgers, /api/cost-attribution-records, /api/cost-record-projections, /api/projected-cost-records, /api/run-cost-rollups, /api/cost-category-rollups, /api/cost-record-projection-validations, /api/token-usage-projections, /api/projected-token-usage-records, /api/capability-token-rollups, /api/runtime-token-rollups, /api/capability-runtime-token-rollups, /api/token-usage-projection-validations, /api/budget-alert-ledgers, /api/budget-alert-records, /api/packs, /api/capabilities, /api/artifacts, /api/runs, /api/events, /api/costs, /api/audit-trails, /api/audit-events, /api/audit-sources, /api/delivery-actions, /api/matters, /api/approvals, /api/approval-inbox-decisions, /api/delivery-execution-candidates, /api/delivery-execution-packets, /api/delivery-receipts, /api/delivery-receipt-events, /api/post-delivery-matters, /api/delivered-artifacts, /api/outstanding-receipts, /api/delivery-closeout-items, /api/receipt-input-drafts, /api/closeout-receipt-validations, /api/closeout-receipt-errors, /api/validated-receipts-to-apply, /api/closeout-receipt-applications, /api/closeout-applied-receipts, /api/pipeline-runs, /api/pipeline-steps, /api/control-plane-loops, /api/control-plane-loop-steps, /api/goal-checkpoints, /api/goal-checkpoint-items, /api/contract-inventories, /api/contract-inventory-items, /api/contract-schemas, /api/contract-artifacts, /api/contract-owner-map, /api/contract-dependency-maps, /api/contract-dependency-nodes, /api/contract-dependency-edges, /api/contract-breaking-change-risks, /api/contract-owner-dependencies, /api/control-plane-health, /api/health-checks, /api/action-plans, /api/action-plan-items, /api/human-gates, /api/human-gate-items, /api/human-gate-receipts, /api/human-gate-receipt-requirements, /api/human-gate-receipt-drafts, /api/human-review-packet-ledgers, /api/human-review-packets, /api/human-review-items, /api/human-gate-receipt-validations, /api/human-gate-receipt-errors, /api/validated-human-gate-receipts, /api/human-gate-receipt-applications, /api/applied-human-gate-receipts, /api/patched-human-gate-items, /api/action-work-packets, /api/action-work-items, /api/work-packet-receipt-requirements, /api/work-packet-receipt-drafts, /api/work-packet-receipt-validations, /api/work-packet-receipt-errors, /api/validated-work-packet-receipts, /api/work-packet-receipt-applications, /api/applied-work-packet-receipts");
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
      route("GET", "/api/resource-store-interfaces", "Resource store interface artifacts"),
      route("GET", "/api/resource-store-records", "Resource store records"),
      route("GET", "/api/resource-version-store-records", "ResourceVersion store records"),
      route("GET", "/api/resource-store-adapter-bindings", "Resource store adapter bindings"),
      route("GET", "/api/resource-store-validations", "Resource store interface validation rows"),
      route("GET", "/api/immutable-object-store-layouts", "Immutable object store layout artifacts"),
      route("GET", "/api/object-path-resolvers", "Immutable object path resolvers"),
      route("GET", "/api/raw-source-object-paths", "Raw source immutable object paths"),
      route("GET", "/api/generated-output-object-paths", "Generated output immutable object paths"),
      route("GET", "/api/object-store-collisions", "Immutable object store collision rows"),
      route("GET", "/api/object-store-layout-validations", "Immutable object store validation rows"),
      route("GET", "/api/resource-version-ledgers", "Resource version ledger artifacts"),
      route("GET", "/api/resource-version-families", "Resource version families"),
      route("GET", "/api/resource-version-events", "Resource version events"),
      route("GET", "/api/resource-version-transitions", "Resource version transitions"),
      route("GET", "/api/resource-duplicate-candidates", "Resource duplicate candidates"),
      route("GET", "/api/resource-version-object-bindings", "ResourceVersion object path bindings"),
      route("GET", "/api/resource-version-ledger-validations", "Resource version ledger validation rows"),
      route("GET", "/api/resource-dedup-hash-ledgers", "Resource dedup/hash ledger artifacts"),
      route("GET", "/api/resource-hash-groups", "Resource content hash groups"),
      route("GET", "/api/resource-external-id-groups", "Resource source external id groups"),
      route("GET", "/api/resource-dedup-decisions", "Resource dedup classification decisions"),
      route("GET", "/api/resource-duplicate-candidate-links", "Resource duplicate candidate dedup links"),
      route("GET", "/api/resource-hash-integrity-checks", "Resource hash integrity checks"),
      route("GET", "/api/resource-dedup-hash-validations", "Resource dedup/hash validation rows"),
      route("GET", "/api/resource-quarantine-models", "Resource quarantine model artifacts"),
      route("GET", "/api/resource-quarantine-rules", "Resource quarantine rule rows"),
      route("GET", "/api/resource-quarantine-items", "Resource quarantine held item rows"),
      route("GET", "/api/resource-quarantine-review-queue", "Resource quarantine pending review queue"),
      route("GET", "/api/resource-quarantine-validations", "Resource quarantine validation rows"),
      route("GET", "/api/normalized-text-contracts", "Normalized text contract artifacts"),
      route("GET", "/api/normalized-text-artifacts", "Normalized text artifacts"),
      route("GET", "/api/normalized-text-location-maps", "Normalized text location maps"),
      route("GET", "/api/normalized-source-span-seeds", "Normalized source span seeds"),
      route("GET", "/api/normalized-text-validations", "Normalized text validation rows"),
      route("GET", "/api/extractor-adapter-contracts", "Extractor adapter contract artifacts"),
      route("GET", "/api/extractor-adapters", "Extractor adapter rows"),
      route("GET", "/api/extractor-io-contracts", "Extractor input/output contract rows"),
      route("GET", "/api/extractor-document-type-bindings", "Extractor document type bindings"),
      route("GET", "/api/ocr-fallback-policies", "Extractor OCR fallback policies"),
      route("GET", "/api/extractor-normalized-text-bindings", "Extractor normalized text binding rows"),
      route("GET", "/api/extractor-adapter-validations", "Extractor adapter validation rows"),
      route("GET", "/api/source-span-stores", "Source span store artifacts"),
      route("GET", "/api/source-spans", "Source span records"),
      route("GET", "/api/source-span-locators", "Source span locator rows"),
      route("GET", "/api/source-span-location-units", "Source span location unit rows"),
      route("GET", "/api/source-span-indexes", "Source span index projections"),
      route("GET", "/api/source-span-validations", "Source span store validation rows"),
      route("GET", "/api/evidence-item-stores", "Evidence item store artifacts"),
      route("GET", "/api/evidence-items", "Evidence item rows"),
      route("GET", "/api/evidence-source-span-bindings", "Evidence to source span binding rows"),
      route("GET", "/api/evidence-review-queue", "Evidence review queue rows"),
      route("GET", "/api/evidence-item-indexes", "Evidence item index projections"),
      route("GET", "/api/evidence-item-store-validations", "Evidence item store validation rows"),
      route("GET", "/api/evidence-golden-fixtures", "Evidence golden fixture artifacts"),
      route("GET", "/api/evidence-golden-cases", "Evidence extraction golden cases"),
      route("GET", "/api/evidence-golden-store-matches", "Evidence golden case store matches"),
      route("GET", "/api/evidence-regression-tests", "Evidence regression test artifacts"),
      route("GET", "/api/evidence-regression-suites", "Evidence regression suite rows"),
      route("GET", "/api/evidence-regression-test-cases", "Evidence regression test case rows"),
      route("GET", "/api/evidence-regression-hashes", "Evidence regression hash rows"),
      route("GET", "/api/evidence-regression-validations", "Evidence regression validation rows"),
      route("GET", "/api/resource-evidence-dashboard-summaries", "Resource/evidence dashboard summary artifacts"),
      route("GET", "/api/resource-evidence-panel-rows", "Resource/evidence dashboard panel rows"),
      route("GET", "/api/resource-evidence-matter-rollups", "Resource/evidence dashboard matter rollups"),
      route("GET", "/api/resource-evidence-classification-rollups", "Resource/evidence dashboard classification rollups"),
      route("GET", "/api/resource-evidence-dashboard-validations", "Resource/evidence dashboard validation rows"),
      route("GET", "/api/evidence-plane-freezes", "Evidence Plane freeze artifacts"),
      route("GET", "/api/evidence-plane-freeze-sources", "Evidence Plane freeze source status rows"),
      route("GET", "/api/evidence-plane-freeze-checkpoints", "Evidence Plane freeze checkpoint rows"),
      route("GET", "/api/evidence-plane-representative-traces", "Evidence Plane representative trace rows"),
      route("GET", "/api/evidence-plane-freeze-validations", "Evidence Plane freeze validation rows"),
      route("GET", "/api/evidence-golden-validations", "Evidence golden fixture validation rows"),
      route("GET", "/api/fact-claim-stores", "Fact claim store artifacts"),
      route("GET", "/api/fact-claims", "Fact claim rows"),
      route("GET", "/api/fact-evidence-bindings", "Fact to evidence binding rows"),
      route("GET", "/api/fact-review-queue", "Fact review queue rows"),
      route("GET", "/api/fact-claim-indexes", "Fact claim index projections"),
      route("GET", "/api/fact-claim-store-validations", "Fact claim store validation rows"),
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
      route("GET", "/api/matter-boundary-slices", "Matter boundary vertical slice artifacts"),
      route("GET", "/api/matter-boundary-resource-paths", "Resource ingest to retrieval boundary path rows"),
      route("GET", "/api/matter-boundary-retrieval-gates", "Retrieval gate checks with store filter and probe status"),
      route("GET", "/api/matter-boundary-validations", "Matter boundary slice validation rows"),
      route("GET", "/api/identity-policy-matter-freezes", "Identity/Policy/Matter freeze artifacts"),
      route("GET", "/api/identity-policy-freeze-sources", "Identity/Policy/Matter freeze source statuses"),
      route("GET", "/api/identity-policy-freeze-checkpoints", "Identity/Policy/Matter freeze checkpoints"),
      route("GET", "/api/identity-policy-freeze-validations", "Identity/Policy/Matter freeze validation rows"),
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
      route("GET", "/api/policy-snapshot-event-bindings", "Policy snapshot event binding artifacts"),
      route("GET", "/api/event-run-gate-policy-bindings", "Execution-time event/run/gate policy snapshot bindings"),
      route("GET", "/api/event-policy-snapshot-bindings", "Event and audit event policy snapshot bindings"),
      route("GET", "/api/run-policy-snapshot-bindings", "RunLedger policy snapshot bindings"),
      route("GET", "/api/gate-policy-snapshot-bindings", "GateResult policy snapshot bindings with event continuity"),
      route("GET", "/api/policy-snapshot-event-binding-validations", "Policy snapshot event binding validation rows"),
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
      route("GET", "/api/capability-manifest-v2-catalogs", "Capability Manifest v2 catalog artifacts"),
      route("GET", "/api/capability-manifest-v2-records", "Capability Manifest v2 records"),
      route("GET", "/api/capability-manifest-field-matrix", "Capability Manifest v2 required field matrix"),
      route("GET", "/api/capability-manifest-gate-runtime-matrix", "Capability Manifest v2 gate/runtime matrix"),
      route("GET", "/api/capability-manifest-policy-index", "Capability Manifest v2 policy index"),
      route("GET", "/api/capability-manifest-version-policy-index", "Capability Manifest v2 version policy index"),
      route("GET", "/api/capability-manifest-v2-validations", "Capability Manifest v2 validation rows"),
      route("GET", "/api/pack-manifest-compatibility", "Pack manifest compatibility artifact"),
      route("GET", "/api/pack-compatibility-records", "Pack core compatibility records"),
      route("GET", "/api/pack-dependency-edges", "Pack dependency compatibility edges"),
      route("GET", "/api/pack-compatibility-matrix", "Pack compatibility matrix"),
      route("GET", "/api/pack-manifest-compatibility-validations", "Pack manifest compatibility validation rows"),
      route("GET", "/api/capability-registry-apis", "Capability registry API artifacts"),
      route("GET", "/api/capability-registry-packs", "Desktop-ready pack API cards"),
      route("GET", "/api/capability-registry-capabilities", "Desktop-ready capability API cards"),
      route("GET", "/api/capability-registry-versions", "Desktop-ready capability version cards"),
      route("GET", "/api/capability-registry-gates", "Desktop-ready gate requirement cards"),
      route("GET", "/api/desktop-companion-route-groups", "Read-only Desktop Companion route groups"),
      route("GET", "/api/capability-registry-api-validations", "Capability registry API validation rows"),
      route("GET", "/api/workflow-run-dashboards", "Workflow run dashboard artifacts"),
      route("GET", "/api/workflow-run-dashboard-panels", "Desktop-ready workflow run panels"),
      route("GET", "/api/workflow-run-state-cards", "Workflow run state summary cards"),
      route("GET", "/api/workflow-run-queue-cards", "Workflow queue, retry, idempotency, resume, and cancel cards"),
      route("GET", "/api/workflow-run-gate-cards", "Workflow gate status cards"),
      route("GET", "/api/workflow-run-output-cards", "Workflow output status cards"),
      route("GET", "/api/workflow-run-dashboard-validations", "Workflow run dashboard validation rows"),
      route("GET", "/api/workflow-dsl-state-models", "Workflow DSL state model artifacts"),
      route("GET", "/api/workflow-dsl-states", "Workflow DSL state definitions"),
      route("GET", "/api/workflow-dsl-transition-rules", "Workflow DSL transition rules"),
      route("GET", "/api/workflow-state-blueprints", "Workflow state blueprints"),
      route("GET", "/api/workflow-run-state-projections", "Workflow run state projections"),
      route("GET", "/api/workflow-dsl-state-validations", "Workflow DSL state validation rows"),
      route("GET", "/api/workflow-state-machine-runners", "Workflow state machine runner artifacts"),
      route("GET", "/api/workflow-transition-guards", "Workflow transition guard rows"),
      route("GET", "/api/workflow-runner-audit-events", "Workflow runner audit event candidates"),
      route("GET", "/api/workflow-runner-plans", "Workflow runner plan rows"),
      route("GET", "/api/workflow-runner-validations", "Workflow runner validation rows"),
      route("GET", "/api/workflow-queue-retry-backoff-contracts", "Workflow queue/retry/backoff contract artifacts"),
      route("GET", "/api/workflow-queue-records", "Workflow queue records"),
      route("GET", "/api/workflow-retry-classifications", "Workflow retry classification rows"),
      route("GET", "/api/workflow-backoff-policies", "Workflow retry backoff policy rows"),
      route("GET", "/api/workflow-queue-validations", "Workflow queue/retry/backoff validation rows"),
      route("GET", "/api/workflow-idempotency-ledgers", "Workflow idempotency ledger artifacts"),
      route("GET", "/api/workflow-idempotency-keys", "Workflow idempotency key rows"),
      route("GET", "/api/workflow-idempotency-decisions", "Workflow idempotency decision rows"),
      route("GET", "/api/workflow-duplicate-probes", "Workflow duplicate probe rows"),
      route("GET", "/api/workflow-idempotency-validations", "Workflow idempotency validation rows"),
      route("GET", "/api/workflow-resume-cancel-contracts", "Workflow resume/cancel contract artifacts"),
      route("GET", "/api/workflow-resume-cursors", "Workflow resume cursor rows"),
      route("GET", "/api/workflow-cancel-requests", "Workflow cancel request rows"),
      route("GET", "/api/workflow-resume-cancel-decisions", "Workflow resume/cancel decision rows"),
      route("GET", "/api/workflow-resume-cancel-validations", "Workflow resume/cancel validation rows"),
      route("GET", "/api/workflow-context-builder-contracts", "Workflow context builder contract artifacts"),
      route("GET", "/api/context-packet-v2-records", "Context packet v2 rows"),
      route("GET", "/api/context-resource-selections", "Context resource selection rows"),
      route("GET", "/api/context-token-budgets", "Context token budget rows"),
      route("GET", "/api/context-citation-hints", "Context citation hint rows"),
      route("GET", "/api/workflow-context-builder-validations", "Workflow context builder validation rows"),
      route("GET", "/api/workflow-retrieval-compilers", "Workflow retrieval compiler artifacts"),
      route("GET", "/api/retrieval-request-records", "Workflow retrieval request rows"),
      route("GET", "/api/retrieval-candidate-records", "Workflow retrieval candidate rows"),
      route("GET", "/api/source-span-priority-records", "Source span priority rows"),
      route("GET", "/api/retrieval-guard-records", "Workflow retrieval guard rows"),
      route("GET", "/api/workflow-retrieval-validations", "Workflow retrieval compiler validation rows"),
      route("GET", "/api/workflow-prompt-injection-boundaries", "Workflow prompt injection boundary artifacts"),
      route("GET", "/api/untrusted-content-wrappers", "Untrusted evidence content wrapper rows"),
      route("GET", "/api/instruction-signal-records", "Prompt injection instruction signal rows"),
      route("GET", "/api/prompt-boundary-guard-records", "Prompt boundary guard rows"),
      route("GET", "/api/prompt-injection-boundary-validations", "Prompt injection boundary validation rows"),
      route("GET", "/api/workflow-pre-run-gate-frameworks", "Workflow pre-run gate framework artifacts"),
      route("GET", "/api/pre-run-gate-records", "Pre-run gate rows"),
      route("GET", "/api/pre-run-gate-decisions", "Pre-run gate decision rows"),
      route("GET", "/api/pre-run-gate-guards", "Pre-run gate guard rows"),
      route("GET", "/api/pre-run-gate-validations", "Pre-run gate validation rows"),
      route("GET", "/api/workflow-in-run-gate-frameworks", "Workflow in-run gate framework artifacts"),
      route("GET", "/api/in-run-gate-records", "In-run gate rows"),
      route("GET", "/api/in-run-block-records", "In-run block rows"),
      route("GET", "/api/in-run-guard-records", "In-run gate guard rows"),
      route("GET", "/api/in-run-gate-validations", "In-run gate validation rows"),
      route("GET", "/api/workflow-post-run-gate-frameworks", "Workflow post-run gate framework artifacts"),
      route("GET", "/api/post-run-gate-records", "Post-run gate rows"),
      route("GET", "/api/post-run-gate-decisions", "Post-run gate decision rows"),
      route("GET", "/api/post-run-gate-guards", "Post-run gate guard rows"),
      route("GET", "/api/post-run-gate-validations", "Post-run gate validation rows"),
      route("GET", "/api/gate-result-aggregators", "Gate result aggregator artifacts"),
      route("GET", "/api/gate-aggregate-records", "Gate aggregate rows"),
      route("GET", "/api/workflow-gate-statuses", "Workflow gate status rows"),
      route("GET", "/api/gate-result-aggregate-validations", "Gate result aggregate validation rows"),
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
      route("GET", "/api/event-envelope-ledgers", "CloudEvents-style event envelope ledger artifacts"),
      route("GET", "/api/event-envelopes", "CloudEvents-style event envelopes"),
      route("GET", "/api/event-envelope-source-bindings", "Event envelope source binding rows"),
      route("GET", "/api/event-envelope-validations", "Event envelope ledger validation rows"),
      route("GET", "/api/event-type-registries", "Event type registry artifacts"),
      route("GET", "/api/event-types", "Event type registry rows"),
      route("GET", "/api/event-families", "Event family coverage rows"),
      route("GET", "/api/event-type-bindings", "Event envelope to event type binding rows"),
      route("GET", "/api/event-type-registry-validations", "Event type registry validation rows"),
      route("GET", "/api/append-only-event-stores", "Append-only event store artifacts"),
      route("GET", "/api/stored-events", "Hash-chained stored event rows"),
      route("GET", "/api/event-streams", "Append-only event stream rows"),
      route("GET", "/api/event-correction-policies", "Append-only correction policy rows"),
      route("GET", "/api/event-store-validations", "Append-only event store validation rows"),
      route("GET", "/api/event-correlation-ledgers", "Event correlation ledger artifacts"),
      route("GET", "/api/correlation-traces", "Correlation trace rows"),
      route("GET", "/api/causation-edges", "Causation edge rows"),
      route("GET", "/api/trace-run-bindings", "Trace to RunLedger binding rows"),
      route("GET", "/api/event-correlation-validations", "Event correlation validation rows"),
      route("GET", "/api/workflow-run-ledgers", "Workflow run ledger artifacts"),
      route("GET", "/api/workflow-run-records", "Event-backed workflow run records"),
      route("GET", "/api/workflow-state-transitions", "Event-backed workflow state transition rows"),
      route("GET", "/api/workflow-event-bindings", "Workflow run to stored event binding rows"),
      route("GET", "/api/workflow-run-ledger-validations", "Workflow run ledger validation rows"),
      route("GET", "/api/agent-run-ledgers", "Agent run ledger artifacts"),
      route("GET", "/api/agent-run-records", "Runtime AgentRun records"),
      route("GET", "/api/agent-run-io-references", "AgentRun input and output reference rows"),
      route("GET", "/api/agent-run-artifact-references", "AgentRun artifact reference rows"),
      route("GET", "/api/agent-run-log-references", "AgentRun log reference rows"),
      route("GET", "/api/agent-run-event-bindings", "AgentRun event binding rows"),
      route("GET", "/api/agent-run-ledger-validations", "Agent run ledger validation rows"),
      route("GET", "/api/tool-invocation-ledgers", "Tool invocation ledger artifacts"),
      route("GET", "/api/tool-invocation-records", "Runtime tool invocation records"),
      route("GET", "/api/tool-invocation-permission-decisions", "Tool invocation permission decision rows"),
      route("GET", "/api/tool-invocation-agent-bindings", "AgentRun to tool invocation binding rows"),
      route("GET", "/api/tool-invocation-event-bindings", "Tool invocation to AgentRun event context binding rows"),
      route("GET", "/api/tool-invocation-ledger-validations", "Tool invocation ledger validation rows"),
      route("GET", "/api/audit-event-ledgers", "Audit event ledger artifacts"),
      route("GET", "/api/audit-trail-records", "Separated audit trail records"),
      route("GET", "/api/audit-separation-bindings", "Audit to observability separation bindings"),
      route("GET", "/api/audit-source-rollups", "Audit source rollup rows"),
      route("GET", "/api/audit-event-ledger-validations", "Audit event ledger validation rows"),
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
      route("GET", "/api/cost-record-projections", "Cost record projection artifacts"),
      route("GET", "/api/projected-cost-records", "Provider, runtime, storage, and API projected cost records"),
      route("GET", "/api/run-cost-rollups", "Run-level cost rollups"),
      route("GET", "/api/cost-category-rollups", "Cost category rollups"),
      route("GET", "/api/cost-record-projection-validations", "Cost record projection validation rows"),
      route("GET", "/api/token-usage-projections", "Token usage projection artifacts"),
      route("GET", "/api/projected-token-usage-records", "Projected token usage records"),
      route("GET", "/api/capability-token-rollups", "Capability token rollups"),
      route("GET", "/api/runtime-token-rollups", "Runtime token rollups"),
      route("GET", "/api/capability-runtime-token-rollups", "Capability/runtime token rollups"),
      route("GET", "/api/token-usage-projection-validations", "Token usage projection validation rows"),
      route("GET", "/api/observability-trace-projections", "Observability trace projection artifacts"),
      route("GET", "/api/observability-trace-records", "Correlation trace records with workflow, agent, gate, and output component counts"),
      route("GET", "/api/workflow-trace-bindings", "Workflow run to observability trace bindings"),
      route("GET", "/api/agent-trace-bindings", "Agent run to observability trace bindings"),
      route("GET", "/api/gate-trace-bindings", "Gate result to observability trace bindings"),
      route("GET", "/api/output-trace-bindings", "Output artifact to observability trace bindings"),
      route("GET", "/api/observability-trace-projection-validations", "Observability trace projection validation rows"),
      route("GET", "/api/error-retry-ledgers", "Error/retry ledger artifacts"),
      route("GET", "/api/projected-error-records", "Projected failure/error records bound to traces"),
      route("GET", "/api/retry-records", "Retry state records for every projected error"),
      route("GET", "/api/timeout-records", "Timeout classification records for every projected error"),
      route("GET", "/api/resume-state-records", "Resume-state records for every projected error"),
      route("GET", "/api/error-retry-ledger-validations", "Error/retry ledger validation rows"),
      route("GET", "/api/event-replay-harnesses", "Event replay harness artifacts"),
      route("GET", "/api/replayed-event-streams", "Append-only event streams reconstructed by replay"),
      route("GET", "/api/replayed-run-summaries", "Workflow run summaries reconstructed by replay"),
      route("GET", "/api/dashboard-replay-projections", "Dashboard projection drift checks rebuilt by replay"),
      route("GET", "/api/dashboard-replay-metrics", "Dashboard replay projection metric rows"),
      route("GET", "/api/event-replay-validations", "Event replay harness validation rows"),
      route("GET", "/api/retention-archive-ledgers", "Retention and archive ledger artifacts"),
      route("GET", "/api/retention-policy-records", "Audit, event, and output retention policy rows"),
      route("GET", "/api/archive-candidate-records", "Archive candidate rows bound to retention policy"),
      route("GET", "/api/legal-hold-bindings", "Active legal hold bindings for retention candidates"),
      route("GET", "/api/retention-archive-validations", "Retention archive validation rows"),
      route("GET", "/api/ledger-api-dashboards", "Read-only run, audit, cost, error, and event ledger API/dashboard index"),
      route("GET", "/api/ledger-dashboard-panels", "Ledger dashboard domain panels"),
      route("GET", "/api/ledger-api-route-records", "Ledger Review API route records"),
      route("GET", "/api/ledger-panel-metrics", "Ledger dashboard panel metric rows"),
      route("GET", "/api/ledger-cross-links", "Cross-ledger health link rows"),
      route("GET", "/api/ledger-api-dashboard-validations", "Ledger API/dashboard validation rows"),
      route("GET", "/api/ledger-golden-fixtures", "Ledger golden fixture artifact"),
      route("GET", "/api/ledger-golden-cases", "Ledger golden fixture cases"),
      route("GET", "/api/ledger-fixture-matrix", "Ledger fixture matrix by replay, projection, cost, and audit"),
      route("GET", "/api/ledger-regression-hashes", "Ledger golden fixture regression hashes"),
      route("GET", "/api/ledger-golden-validations", "Ledger golden fixture validation rows"),
      route("GET", "/api/observability-freezes", "Observability freeze artifact"),
      route("GET", "/api/observability-freeze-sources", "Observability freeze source status rows"),
      route("GET", "/api/observability-freeze-checkpoints", "Observability freeze checkpoint rows"),
      route("GET", "/api/observability-freeze-traces", "Observability freeze representative traces"),
      route("GET", "/api/observability-freeze-loop-bindings", "Observability freeze control-plane loop bindings"),
      route("GET", "/api/observability-freeze-validations", "Observability freeze validation rows"),
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
      route("GET", "/api/issue-graph-stores", "Issue graph store artifacts"),
      route("GET", "/api/issues", "Issue candidate rows"),
      route("GET", "/api/fact-issue-bindings", "Fact-to-issue binding rows"),
      route("GET", "/api/legal-rules", "Legal rule placeholder rows"),
      route("GET", "/api/issue-legal-rule-bindings", "Issue-to-legal-rule binding rows"),
      route("GET", "/api/risk-severity-assessments", "Issue risk severity assessment rows"),
      route("GET", "/api/issue-review-queue", "Issue review queue rows"),
      route("GET", "/api/issue-graph-indexes", "Issue graph index projections"),
      route("GET", "/api/issue-graph-store-validations", "Issue graph store validation rows"),
      route("GET", "/api/citation-object-stores", "Citation object store artifacts"),
      route("GET", "/api/output-paragraphs", "Review-pending output paragraph rows"),
      route("GET", "/api/citations", "Citation objects binding output paragraphs to source spans"),
      route("GET", "/api/paragraph-source-bindings", "Output paragraph to source span binding rows"),
      route("GET", "/api/citation-review-queue", "Citation review queue rows"),
      route("GET", "/api/citation-indexes", "Citation object store index projections"),
      route("GET", "/api/citation-object-store-validations", "Citation object store validation rows"),
      route("GET", "/api/lineage-graphs", "Lineage graph builder artifacts"),
      route("GET", "/api/lineage-nodes", "Lineage graph node rows"),
      route("GET", "/api/lineage-edges", "Lineage graph edge rows"),
      route("GET", "/api/lineage-paths", "Source-to-output lineage path rows"),
      route("GET", "/api/lineage-indexes", "Lineage graph index projections"),
      route("GET", "/api/lineage-graph-validations", "Lineage graph validation rows"),
      route("GET", "/api/evidence-viewer-data", "Evidence viewer data API artifact"),
      route("GET", "/api/evidence-viewer-cards", "Evidence viewer card rows joined to source spans and lineage"),
      route("GET", "/api/evidence-viewer-source-spans", "Evidence viewer source span panel rows"),
      route("GET", "/api/evidence-viewer-lineage-paths", "Evidence viewer lineage path panel rows"),
      route("GET", "/api/evidence-viewer-data-validations", "Evidence viewer data API validation rows"),
      route("GET", "/api/evidence-export-bundles", "Evidence export bundle artifacts"),
      route("GET", "/api/evidence-export-bundle-records", "Evidence export bundle rows"),
      route("GET", "/api/evidence-export-source-packages", "Evidence export source package rows"),
      route("GET", "/api/evidence-export-citation-packages", "Evidence export citation package rows"),
      route("GET", "/api/evidence-export-coverage-packages", "Evidence export coverage package rows"),
      route("GET", "/api/evidence-export-bundle-validations", "Evidence export bundle validation rows"),
      route("GET", "/api/evidence-coverage-scores", "Evidence coverage score artifacts"),
      route("GET", "/api/evidence-coverage-records", "Per-output evidence coverage score rows"),
      route("GET", "/api/evidence-coverage-dimensions", "Evidence coverage dimension rows"),
      route("GET", "/api/evidence-coverage-indexes", "Evidence coverage index projections"),
      route("GET", "/api/evidence-coverage-validations", "Evidence coverage validation rows"),
      route("GET", "/api/evidence-flags", "Evidence flags artifacts"),
      route("GET", "/api/evidence-flag-records", "Per-coverage evidence flag rows"),
      route("GET", "/api/evidence-flag-decisions", "Evidence flag decision rows"),
      route("GET", "/api/evidence-flag-indexes", "Evidence flag index projections"),
      route("GET", "/api/evidence-flag-validations", "Evidence flag validation rows"),
      route("GET", "/api/exhibit-maps", "Exhibit map artifacts"),
      route("GET", "/api/exhibit-records", "Exhibit rows with Korean exhibit references"),
      route("GET", "/api/exhibit-bindings", "Exhibit-to-evidence binding rows"),
      route("GET", "/api/exhibit-indexes", "Exhibit map index projections"),
      route("GET", "/api/exhibit-map-validations", "Exhibit map validation rows"),
      route("GET", "/api/custody-event-ledgers", "Chain of custody event ledger artifacts"),
      route("GET", "/api/custody-events", "Append-only custody event rows"),
      route("GET", "/api/custody-event-links", "Custody event subject link rows"),
      route("GET", "/api/custody-stage-indexes", "Custody stage index projections"),
      route("GET", "/api/custody-event-validations", "Custody event validation rows"),
      route("GET", "/api/search-index-contracts", "Search index contract artifacts"),
      route("GET", "/api/search-index-manifests", "Search index manifest rows"),
      route("GET", "/api/search-index-fields", "Search index field catalog rows"),
      route("GET", "/api/search-index-query-plans", "Held search index query plans"),
      route("GET", "/api/search-index-validations", "Search index contract validation rows"),
      route("GET", "/api/vector-index-policies", "Vector index policy boundary artifacts"),
      route("GET", "/api/vector-policy-gates", "Vector policy gate rows"),
      route("GET", "/api/embedding-route-policies", "Embedding route policy rows"),
      route("GET", "/api/vector-policy-validations", "Vector policy validation rows"),
      route("GET", "/api/retrieval-filter-compilers", "Retrieval filter compiler artifacts"),
      route("GET", "/api/compiled-retrieval-filters", "Compiled retrieval filter rows"),
      route("GET", "/api/retrieval-query-bindings", "Retrieval query binding rows"),
      route("GET", "/api/retrieval-filter-probes", "Retrieval filter enforcement probe rows"),
      route("GET", "/api/retrieval-filter-validations", "Retrieval filter compiler validation rows"),
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
    "evidence_item_store_status",
    "resource_dedup_hash_status",
    "resource_quarantine_status",
    "hash_group_id",
    "group_status",
    "external_id_group_id",
    "dedup_status",
    "dedup_decision_id",
    "decision_scope",
    "hash_integrity_check_id",
    "integrity_status",
    "quarantine_rule_id",
    "quarantine_item_id",
    "quarantine_item_status",
    "category",
    "hold_status",
    "hold_severity",
    "review_status",
    "evidence_golden_fixture_status",
    "evidence_golden_case_id",
    "fixture_group",
    "document_kind",
    "case_status",
    "match_status",
    "evidence_regression_status",
    "resource_evidence_dashboard_status",
    "evidence_plane_freeze_status",
    "event_envelope_status",
    "event_type_registry_status",
    "event_store_status",
    "event_correlation_status",
    "workflow_run_ledger_status",
    "workflow_run_record_status",
    "workflow_run_record_id",
    "workflow_state_transition_id",
    "workflow_event_binding_id",
    "agent_run_ledger_status",
    "agent_run_record_id",
    "agent_run_id",
    "agent_run_status",
    "agent_run_io_reference_id",
    "agent_run_artifact_reference_id",
    "agent_run_log_reference_id",
    "agent_run_event_binding_id",
    "tool_invocation_ledger_status",
    "tool_invocation_id",
    "tool_invocation_permission_decision_id",
    "tool_invocation_agent_binding_id",
    "tool_invocation_event_binding_id",
    "audit_event_ledger_status",
    "audit_trail_record_id",
    "audit_separation_binding_id",
    "audit_source_rollup_id",
    "audit_domain",
    "audit_type",
    "audit_severity",
    "audit_plane_status",
    "observability_log_status",
    "trace_projection_status",
    "separation_status",
    "event_store_binding_status",
    "permission_decision",
    "permission_status",
    "invocation_state",
    "execution_allowed",
    "approval_required",
    "event_context",
    "direct_tool_event",
    "binding_status",
    "runtime_output_id",
    "runtime_log_id",
    "runtime_artifact_id",
    "input_reference_status",
    "output_reference_status",
    "output_hash_status",
    "io_reference_status",
    "log_reference_status",
    "artifact_reference_status",
    "event_binding_status",
    "event_effect",
    "workflow_run_binding_status",
    "runtime_contract_binding_status",
    "verification_status",
    "transition_status",
    "from_state",
    "to_state",
    "terminal_state",
    "terminal_state_alignment_status",
    "state_effect",
    "capability_contract_status",
    "run_ledger_binding_status",
    "correlation_id",
    "correlation_trace_id",
    "causation_id",
    "cause_event_envelope_id",
    "effect_event_envelope_id",
    "causation_status",
    "run_binding_status",
    "envelope_kind",
    "specversion",
    "event_type",
    "event_family",
    "event_category",
    "registry_status",
    "classification_status",
    "coverage_status",
    "required_family",
    "event_stream_id",
    "stream_scope",
    "stream_status",
    "append_status",
    "immutable_status",
    "mutation_status",
    "hash_chain_status",
    "correction_status",
    "sequence_status",
    "correction_policy_status",
    "source_kind",
    "binding_status",
    "round_trip_status",
    "required_field_status",
    "checkpoint_status",
    "trace_status",
    "source_status",
    "trace_id",
    "panel_id",
    "panel_type",
    "panel_status",
    "observability_freeze_status",
    "capability_manifest_v2_status",
    "compatibility_status",
    "core_compatibility_status",
    "dependency_status",
    "workflow_dsl_state_model_status",
    "workflow_state_machine_runner_status",
    "workflow_queue_retry_backoff_status",
    "workflow_idempotency_status",
    "workflow_resume_cancel_status",
    "workflow_context_builder_status",
    "workflow_retrieval_compiler_status",
    "workflow_prompt_injection_boundary_status",
    "workflow_pre_run_gate_framework_status",
    "retrieval_request_status",
    "retrieval_candidate_status",
    "source_span_priority_status",
    "retrieval_guard_status",
    "wrapper_status",
    "instruction_signal_status",
    "prompt_boundary_guard_status",
    "pre_run_gate_status",
    "pre_run_gate_decision",
    "pre_run_gate_set_status",
    "pre_run_guard_status",
    "workflow_in_run_gate_framework_status",
    "in_run_gate_status",
    "in_run_gate_decision",
    "in_run_block_status",
    "in_run_guard_status",
    "workflow_post_run_gate_framework_status",
    "post_run_gate_status",
    "post_run_gate_decision",
    "post_run_gate_set_status",
    "post_run_guard_status",
    "gate_result_aggregator_status",
    "capability_registry_api_status",
    "workflow_run_dashboard_status",
    "desktop_companion_readiness_status",
    "desktop_surface",
    "desktop_card_status",
    "desktop_route_group_id",
    "route_group_id",
    "route_path",
    "route_method",
    "route_status",
    "read_only",
    "mutation_allowed",
    "protected_mutation_request_allowed",
    "secret_material_exposed",
    "installer_or_gateway_control",
    "aggregate_gate_state",
    "aggregate_gate_stage",
    "workflow_gate_status",
    "retrieval_compiler_contract_id",
    "prompt_injection_boundary_contract_id",
    "pre_run_gate_framework_contract_id",
    "in_run_gate_framework_contract_id",
    "post_run_gate_framework_contract_id",
    "gate_result_aggregator_contract_id",
    "retrieval_request_record_id",
    "retrieval_candidate_record_id",
    "source_span_priority_record_id",
    "retrieval_guard_record_id",
    "untrusted_content_wrapper_id",
    "instruction_signal_record_id",
    "prompt_boundary_guard_id",
    "pre_run_gate_record_id",
    "pre_run_gate_decision_record_id",
    "pre_run_gate_guard_record_id",
    "in_run_gate_record_id",
    "in_run_block_record_id",
    "in_run_guard_record_id",
    "post_run_gate_record_id",
    "post_run_gate_decision_record_id",
    "post_run_guard_record_id",
    "gate_aggregate_record_id",
    "workflow_gate_status_id",
    "pack_api_card_id",
    "capability_api_card_id",
    "capability_version_api_card_id",
    "gate_requirement_api_card_id",
    "workflow_run_dashboard_panel_id",
    "workflow_run_state_card_id",
    "workflow_run_queue_card_id",
    "workflow_run_gate_card_id",
    "workflow_run_output_card_id",
    "gate_type",
    "tool_invocation_id",
    "tool_id",
    "output_ref",
    "selected_for_context",
    "source_span_bound",
    "content_role",
    "context_packet_v2_status",
    "selection_decision",
    "token_budget_status",
    "citation_hint_status",
    "transition_guard_status",
    "guard_decision",
    "runner_plan_status",
    "queue_status",
    "retry_class",
    "queue_retry_status",
    "backoff_policy_status",
    "schedule_status",
    "retryable",
    "key_status",
    "key_scope",
    "idempotency_decision",
    "request_kind",
    "request_status",
    "duplicate_probe_status",
    "duplicate_detected",
    "new_run_created",
    "resume_state",
    "resume_blocked",
    "cancel_request_status",
    "cancel_state",
    "request_kind",
    "control_decision",
    "decision_status",
    "context_builder_contract_id",
    "context_packet_v2_record_id",
    "context_resource_selection_record_id",
    "context_token_budget_record_id",
    "context_citation_hint_record_id",
    "dsl_state",
    "dsl_current_state",
    "state_projection_status",
    "terminal_classification",
    "gate_runtime_status",
    "source_group",
    "trace_kind",
    "loop_binding_status",
    "step_id",
    "source_artifact_id",
    "rollup_status",
    "suite_type",
    "suite_status",
    "regression_suite_id",
    "regression_test_case_id",
    "subject_id",
    "external_service_used",
    "locked",
    "fact_claim_store_status",
    "issue_graph_store_status",
    "citation_object_store_status",
    "lineage_graph_status",
    "evidence_viewer_data_status",
    "viewer_card_id",
    "source_span_panel_id",
    "lineage_path_panel_id",
    "evidence_export_bundle_status",
    "export_bundle_id",
    "export_status",
    "bundle_status",
    "source_package_id",
    "citation_package_id",
    "coverage_package_id",
    "package_status",
    "evidence_coverage_status",
    "evidence_flags_status",
    "exhibit_map_status",
    "custody_event_ledger_status",
    "search_index_contract_status",
    "search_index_id",
    "search_index_field_id",
    "search_index_query_plan_id",
    "collection_id",
    "source_artifact_id",
    "index_status",
    "field_role",
    "field_name",
    "query_profile",
    "query_status",
    "executable",
    "vector_index_policy_boundary_status",
    "vector_policy_gate_id",
    "embedding_route_policy_id",
    "gate_status",
    "route_status",
    "embedding_execution_status",
    "retrieval_execution_status",
    "route_executable",
    "classification",
    "policy_external_embedding_decision",
    "external_embedding_transfer_status",
    "external_embedding_allowed",
    "custody_event_id",
    "custody_event_link_id",
    "custody_chain_id",
    "event_stage",
    "event_type",
    "event_status",
    "subject_type",
    "subject_id",
    "link_status",
    "coverage_score_id",
    "coverage_dimension_id",
    "evidence_flag_record_id",
    "exhibit_id",
    "exhibit_number",
    "exhibit_label",
    "exhibit_reference",
    "exhibit_status",
    "binding_type",
    "flag_decision_id",
    "flag_type",
    "flag_value",
    "extraction_flag",
    "human_confirmation_flag",
    "privilege_flag",
    "redaction_flag",
    "external_transfer_flag",
    "coverage_status",
    "dimension",
    "coverage_subject_id",
    "covered",
    "required",
    "missing_required_dimension_count",
    "lineage_node_id",
    "lineage_edge_id",
    "lineage_path_id",
    "node_type",
    "path_status",
    "from_subject_id",
    "to_subject_id",
    "evidence_id",
    "evidence_type",
    "output_paragraph_id",
    "fact_id",
    "fact_type",
    "issue_id",
    "issue_type",
    "legal_rule_id",
    "risk_severity",
    "severity",
    "reliability",
    "verification_state",
    "verification_status",
    "review_required",
    "human_review_required",
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
    "matter_boundary_slice_status",
    "boundary_path_id",
    "retrieval_gate_check_id",
    "boundary_status",
    "retrieval_gate_status",
    "negative_probe_status",
    "gate_decision",
    "matter_tagging_status",
    "ingest_status",
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
    "schema_version",
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
    "citation_status",
    "source_binding_status",
    "client_facing_ready",
    "client_facing_status",
    "citation_binding_status",
    "lineage_edge_id",
    "relation",
    "workflow_id",
    "workflow_status",
    "adapter_id",
    "extractor_id",
    "extractor_io_contract_id",
    "document_type_binding_id",
    "document_type",
    "location_type",
    "timestamp_status",
    "span_status",
    "locator_status",
    "ocr_fallback_policy_id",
    "execution_boundary",
    "external_service_allowed",
    "network_access_allowed",
    "offset_unit",
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
    "policy_snapshot_event_binding_status",
    "policy_snapshot_binding_ledger_id",
    "policy_snapshot_event_binding_id",
    "event_run_gate_policy_binding_id",
    "subject_kind",
    "source_policy_snapshot_id",
    "source_snapshot_presence_status",
    "resolved_policy_snapshot_id",
    "resolved_policy_snapshot_status",
    "source_to_resolved_snapshot_status",
    "append_only_event_binding_status",
    "stored_event_snapshot_status",
    "gate_event_binding_status",
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
    "retrieval_filter_compiler_status",
    "retrieval_query_binding_id",
    "retrieval_probe_id",
    "query_binding_status",
    "adapter_execution_status",
    "query_execution_allowed",
    "query_adapter_bound",
    "probe_type",
    "probe_status",
    "blocked",
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
    "cost_record_projection_status",
    "projected_cost_record_id",
    "run_cost_rollup_id",
    "cost_category_rollup_id",
    "source_ledger",
    "cost_category",
    "cost_driver",
    "pricing_status",
    "token_usage_projection_status",
    "token_usage_projection_id",
    "projected_token_usage_record_id",
    "observability_trace_projection_status",
    "observability_trace_projection_id",
    "observability_trace_id",
    "correlation_trace_id",
    "trace_binding_id",
    "trace_component_status",
    "error_retry_ledger_status",
    "error_retry_ledger_id",
    "projected_error_record_id",
    "source_error_record_id",
    "retry_record_id",
    "timeout_record_id",
    "resume_state_record_id",
    "failure_state",
    "error_kind",
    "error_type",
    "error_status",
    "retry_state",
    "timeout_state",
    "resume_state",
    "auto_retry_scheduled",
    "timeout_observed",
    "resume_required",
    "resume_blocked",
    "trace_binding_status",
    "event_replay_status",
    "event_replay_harness_id",
    "replayed_event_stream_id",
    "event_stream_replay_status",
    "replayed_run_summary_id",
    "run_replay_status",
    "event_count_match_status",
    "terminal_state_match_status",
    "dashboard_projection_status",
    "projection_status",
    "metric_key",
    "metric_status",
    "source_match_status",
    "dashboard_match_status",
    "retention_archive_status",
    "retention_policy_id",
    "retention_plane",
    "archive_candidate_id",
    "archive_state",
    "archive_action",
    "deletion_status",
    "legal_hold_status",
    "legal_hold_binding_id",
    "hold_scope",
    "hold_status",
    "ledger_api_dashboard_status",
    "ledger_domain",
    "panel_id",
    "panel_status",
    "route_id",
    "route_path",
    "route_method",
    "route_status",
    "source_ledger_id",
    "metric_id",
    "metric_key",
    "metric_status",
    "link_id",
    "link_type",
    "link_status",
    "from_ledger_domain",
    "to_ledger_domain",
    "ledger_golden_fixture_status",
    "ledger_golden_case_id",
    "case_status",
    "fixture_group",
    "source_artifact_id",
    "lock_status",
    "assertion_status",
    "expected_outcome",
    "token_rollup_id",
    "rollup_type",
    "rollup_key",
    "provider_cost_binding_status",
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
  if (key === "matter_boundary_slice_status") return item.summary?.matter_boundary_slice_status ?? item.matter_boundary_slice_status;
  if (key === "resource_store_interface_status") return item.summary?.resource_store_interface_status ?? item.resource_store_interface_status;
  if (key === "object_store_layout_status") return item.summary?.object_store_layout_status ?? item.object_store_layout_status;
  if (key === "resource_version_ledger_status") return item.summary?.resource_version_ledger_status ?? item.resource_version_ledger_status;
  if (key === "resource_dedup_hash_status") return item.summary?.resource_dedup_hash_status ?? item.resource_dedup_hash_status;
  if (key === "resource_quarantine_status") return item.summary?.resource_quarantine_status ?? item.resource_quarantine_status;
  if (key === "quarantine_item_status") return item.hold_status ?? item.review_status;
  if (key === "category") return item.category ?? item.hold_categories;
  if (key === "normalized_text_contract_status") return item.summary?.normalized_text_contract_status ?? item.normalized_text_contract_status;
  if (key === "extractor_adapter_contract_status") return item.summary?.extractor_adapter_contract_status ?? item.extractor_adapter_contract_status;
  if (key === "source_span_store_status") return item.summary?.source_span_store_status ?? item.source_span_store_status;
  if (key === "evidence_item_store_status") return item.summary?.evidence_item_store_status ?? item.evidence_item_store_status;
  if (key === "evidence_golden_fixture_status") return item.summary?.evidence_golden_fixture_status ?? item.evidence_golden_fixture_status;
  if (key === "evidence_regression_status") return item.summary?.evidence_regression_status ?? item.evidence_regression_status;
  if (key === "resource_evidence_dashboard_status") return item.summary?.resource_evidence_dashboard_status ?? item.resource_evidence_dashboard_status;
  if (key === "evidence_plane_freeze_status") return item.summary?.evidence_plane_freeze_status ?? item.evidence_plane_freeze_status;
  if (key === "event_envelope_status") return item.summary?.event_envelope_status ?? item.event_envelope_status;
  if (key === "event_type_registry_status") return item.summary?.event_type_registry_status ?? item.event_type_registry_status;
  if (key === "event_store_status") return item.summary?.event_store_status ?? item.event_store_status;
  if (key === "event_correlation_status") return item.summary?.event_correlation_status ?? item.event_correlation_status;
  if (key === "workflow_run_ledger_status") return item.summary?.workflow_run_ledger_status ?? item.workflow_run_ledger_status;
  if (key === "agent_run_ledger_status") return item.summary?.agent_run_ledger_status ?? item.agent_run_ledger_status;
  if (key === "tool_invocation_ledger_status") return item.summary?.tool_invocation_ledger_status ?? item.tool_invocation_ledger_status;
  if (key === "audit_event_ledger_status") return item.summary?.audit_event_ledger_status ?? item.audit_event_ledger_status;
  if (key === "cost_record_projection_status") return item.summary?.cost_record_projection_status ?? item.cost_record_projection_status;
  if (key === "token_usage_projection_status") return item.summary?.token_usage_projection_status ?? item.token_usage_projection_status;
  if (key === "observability_trace_projection_status") return item.summary?.observability_trace_projection_status ?? item.observability_trace_projection_status;
  if (key === "error_retry_ledger_status") return item.summary?.error_retry_ledger_status ?? item.error_retry_ledger_status;
  if (key === "event_replay_status") return item.summary?.event_replay_status ?? item.event_replay_status;
  if (key === "retention_archive_status") return item.summary?.retention_archive_status ?? item.retention_archive_status;
  if (key === "retention_policy_id") return item.retention_policy_id;
  if (key === "retention_plane") return item.retention_plane;
  if (key === "archive_candidate_id") return item.archive_candidate_id;
  if (key === "archive_state") return item.archive_state;
  if (key === "archive_action") return item.archive_action;
  if (key === "deletion_status") return item.deletion_status;
  if (key === "legal_hold_status") return item.legal_hold_status;
  if (key === "legal_hold_binding_id") return item.legal_hold_binding_id;
  if (key === "hold_scope") return item.hold_scope;
  if (key === "hold_status") return item.hold_status;
  if (key === "ledger_api_dashboard_status") return item.summary?.ledger_api_dashboard_status ?? item.ledger_api_dashboard_status;
  if (key === "ledger_golden_fixture_status") return item.summary?.ledger_golden_fixture_status ?? item.ledger_golden_fixture_status;
  if (key === "source_ledger_id") return item.source_ledger_id ?? item.source_ledger_ids;
  if (key === "dashboard_projection_status") return item.dashboard_projection_status ?? item.projection_status;
  if (key === "projection_status") return item.projection_status ?? item.dashboard_projection_status;
  if (key === "agent_run_status") return item.status ?? item.agent_run_status;
  if (key === "envelope_kind") return item.envelope_kind;
  if (key === "specversion") return item.specversion;
  if (key === "event_type") return item.event_type ?? item.type ?? item.envelope_type;
  if (key === "event_family") return item.event_family;
  if (key === "event_category") return item.event_category;
  if (key === "classification_status") return item.classification_status;
  if (key === "coverage_status") return item.coverage_status;
  if (key === "required_family") return item.required_family;
  if (key === "event_stream_id") return item.event_stream_id;
  if (key === "stream_scope") return item.stream_scope;
  if (key === "stream_status") return item.stream_status;
  if (key === "append_status") return item.append_status;
  if (key === "immutable_status") return item.immutable_status;
  if (key === "mutation_status") return item.mutation_status ?? item.mutation_policy;
  if (key === "hash_chain_status") return item.hash_chain_status;
  if (key === "correction_status") return item.correction_status;
  if (key === "sequence_status") return item.sequence_status;
  if (key === "correction_policy_status") return item.summary?.correction_policy_status ?? item.correction_status;
  if (key === "source_kind") return item.source_kind ?? item.sourcekind;
  if (key === "binding_status") return item.binding_status;
  if (key === "round_trip_status") return item.round_trip_status;
  if (key === "required_field_status") return item.required_field_status;
  if (key === "checkpoint_status") return item.status ?? item.checkpoint_status;
  if (key === "trace_status") return item.trace_status;
  if (key === "source_status") return item.source_status;
  if (key === "capability_manifest_v2_status") return item.summary?.capability_manifest_v2_status ?? item.capability_manifest_v2_status;
  if (key === "compatibility_status") return item.summary?.compatibility_status ?? item.compatibility_status;
  if (key === "core_compatibility_status") return item.core_compatibility_status;
  if (key === "dependency_status") return item.dependency_status;
  if (key === "workflow_dsl_state_model_status") return item.summary?.workflow_dsl_state_model_status ?? item.workflow_dsl_state_model_status;
  if (key === "workflow_state_machine_runner_status") return item.summary?.workflow_state_machine_runner_status ?? item.workflow_state_machine_runner_status;
  if (key === "workflow_queue_retry_backoff_status") return item.summary?.workflow_queue_retry_backoff_status ?? item.workflow_queue_retry_backoff_status;
  if (key === "workflow_idempotency_status") return item.summary?.workflow_idempotency_status ?? item.workflow_idempotency_status;
  if (key === "workflow_resume_cancel_status") return item.summary?.workflow_resume_cancel_status ?? item.workflow_resume_cancel_status;
  if (key === "workflow_context_builder_status") return item.summary?.workflow_context_builder_status ?? item.workflow_context_builder_status;
  if (key === "context_builder_contract_id") return item.summary?.context_builder_contract_id ?? item.context_builder_contract_id;
  if (key === "workflow_retrieval_compiler_status") return item.summary?.workflow_retrieval_compiler_status ?? item.workflow_retrieval_compiler_status;
  if (key === "retrieval_compiler_contract_id") return item.summary?.retrieval_compiler_contract_id ?? item.retrieval_compiler_contract_id;
  if (key === "workflow_prompt_injection_boundary_status") return item.summary?.workflow_prompt_injection_boundary_status ?? item.workflow_prompt_injection_boundary_status;
  if (key === "prompt_injection_boundary_contract_id") return item.summary?.prompt_injection_boundary_contract_id ?? item.prompt_injection_boundary_contract_id;
  if (key === "workflow_pre_run_gate_framework_status") return item.summary?.workflow_pre_run_gate_framework_status ?? item.workflow_pre_run_gate_framework_status;
  if (key === "pre_run_gate_framework_contract_id") return item.summary?.pre_run_gate_framework_contract_id ?? item.pre_run_gate_framework_contract_id;
  if (key === "retrieval_request_status") return item.retrieval_request_status;
  if (key === "retrieval_candidate_status") return item.candidate_status ?? item.retrieval_candidate_status;
  if (key === "source_span_priority_status") return item.source_span_priority_status;
  if (key === "retrieval_guard_status") return item.retrieval_guard_status;
  if (key === "wrapper_status") return item.wrapper_status;
  if (key === "instruction_signal_status") return item.instruction_signal_status;
  if (key === "prompt_boundary_guard_status") return item.prompt_boundary_guard_status;
  if (key === "pre_run_gate_status") return item.pre_run_gate_status;
  if (key === "pre_run_gate_decision") return item.pre_run_gate_decision;
  if (key === "pre_run_gate_set_status") return item.pre_run_gate_set_status;
  if (key === "pre_run_guard_status") return item.pre_run_guard_status;
  if (key === "workflow_in_run_gate_framework_status") return item.summary?.workflow_in_run_gate_framework_status ?? item.workflow_in_run_gate_framework_status;
  if (key === "in_run_gate_framework_contract_id") return item.summary?.in_run_gate_framework_contract_id ?? item.in_run_gate_framework_contract_id;
  if (key === "in_run_gate_status") return item.in_run_gate_status;
  if (key === "in_run_gate_decision") return item.in_run_gate_decision;
  if (key === "in_run_block_status") return item.in_run_block_status;
  if (key === "in_run_guard_status") return item.in_run_guard_status;
  if (key === "workflow_post_run_gate_framework_status") return item.summary?.workflow_post_run_gate_framework_status ?? item.workflow_post_run_gate_framework_status;
  if (key === "post_run_gate_framework_contract_id") return item.summary?.post_run_gate_framework_contract_id ?? item.post_run_gate_framework_contract_id;
  if (key === "post_run_gate_status") return item.post_run_gate_status;
  if (key === "post_run_gate_decision") return item.post_run_gate_decision;
  if (key === "post_run_gate_set_status") return item.post_run_gate_set_status;
  if (key === "post_run_guard_status") return item.post_run_guard_status;
  if (key === "gate_result_aggregator_status") return item.summary?.gate_result_aggregator_status ?? item.gate_result_aggregator_status;
  if (key === "gate_result_aggregator_contract_id") return item.summary?.gate_result_aggregator_contract_id ?? item.gate_result_aggregator_contract_id;
  if (key === "capability_registry_api_status") return item.summary?.capability_registry_api_status ?? item.capability_registry_api_status;
  if (key === "workflow_run_dashboard_status") return item.summary?.workflow_run_dashboard_status ?? item.workflow_run_dashboard_status;
  if (key === "desktop_companion_readiness_status") return item.summary?.desktop_companion_readiness_status ?? item.desktop_companion_readiness_status;
  if (key === "desktop_surface") return item.desktop_surface;
  if (key === "desktop_card_status") return item.desktop_card_status;
  if (key === "desktop_route_group_id") return item.desktop_route_group_id;
  if (key === "route_group_id") return item.route_group_id;
  if (key === "route_path") return item.path ?? item.route_path;
  if (key === "route_method") return item.method ?? item.route_method;
  if (key === "route_status") return item.route_status;
  if (key === "read_only") return String(Boolean(item.read_only));
  if (key === "mutation_allowed") return String(Boolean(item.mutation_allowed));
  if (key === "protected_mutation_request_allowed") return String(Boolean(item.protected_mutation_request_allowed));
  if (key === "secret_material_exposed") return String(Boolean(item.secret_material_exposed));
  if (key === "installer_or_gateway_control") return String(Boolean(item.installer_or_gateway_control));
  if (key === "aggregate_gate_state") return item.aggregate_gate_state;
  if (key === "aggregate_gate_stage") return item.aggregate_gate_stage;
  if (key === "workflow_gate_status") return item.workflow_gate_status;
  if (key === "retrieval_request_record_id") return item.retrieval_request_record_id;
  if (key === "retrieval_candidate_record_id") return item.retrieval_candidate_record_id;
  if (key === "source_span_priority_record_id") return item.source_span_priority_record_id;
  if (key === "retrieval_guard_record_id") return item.retrieval_guard_record_id;
  if (key === "untrusted_content_wrapper_id") return item.untrusted_content_wrapper_id;
  if (key === "instruction_signal_record_id") return item.instruction_signal_record_id;
  if (key === "prompt_boundary_guard_id") return item.prompt_boundary_guard_id;
  if (key === "pre_run_gate_record_id") return item.pre_run_gate_record_id;
  if (key === "pre_run_gate_decision_record_id") return item.pre_run_gate_decision_record_id;
  if (key === "pre_run_gate_guard_record_id") return item.pre_run_gate_guard_record_id;
  if (key === "in_run_gate_record_id") return item.in_run_gate_record_id;
  if (key === "in_run_block_record_id") return item.in_run_block_record_id;
  if (key === "in_run_guard_record_id") return item.in_run_guard_record_id;
  if (key === "post_run_gate_record_id") return item.post_run_gate_record_id;
  if (key === "post_run_gate_decision_record_id") return item.post_run_gate_decision_record_id;
  if (key === "post_run_guard_record_id") return item.post_run_guard_record_id;
  if (key === "gate_aggregate_record_id") return item.gate_aggregate_record_id;
  if (key === "workflow_gate_status_id") return item.workflow_gate_status_id;
  if (key === "pack_api_card_id") return item.pack_api_card_id;
  if (key === "capability_api_card_id") return item.capability_api_card_id;
  if (key === "capability_version_api_card_id") return item.capability_version_api_card_id;
  if (key === "gate_requirement_api_card_id") return item.gate_requirement_api_card_id;
  if (key === "workflow_run_dashboard_panel_id") return item.workflow_run_dashboard_panel_id;
  if (key === "workflow_run_state_card_id") return item.workflow_run_state_card_id;
  if (key === "workflow_run_queue_card_id") return item.workflow_run_queue_card_id;
  if (key === "workflow_run_gate_card_id") return item.workflow_run_gate_card_id;
  if (key === "workflow_run_output_card_id") return item.workflow_run_output_card_id;
  if (key === "gate_type") return item.gate_type ?? item.aggregate_gate_type ?? item.gate_id;
  if (key === "tool_invocation_id") return item.tool_invocation_id;
  if (key === "tool_id") return item.tool_id;
  if (key === "output_ref") return item.output_ref;
  if (key === "selected_for_context") return String(Boolean(item.selected_for_context));
  if (key === "source_span_bound") return String(Boolean(item.source_span_bound));
  if (key === "content_role") return item.content_role;
  if (key === "transition_guard_status") return item.transition_guard_status;
  if (key === "guard_decision") return item.guard_decision;
  if (key === "runner_plan_status") return item.runner_plan_status;
  if (key === "queue_status") return item.queue_status;
  if (key === "retry_class") return item.retry_class;
  if (key === "queue_retry_status") return item.queue_retry_status;
  if (key === "backoff_policy_status") return item.backoff_policy_status;
  if (key === "schedule_status") return item.schedule_status;
  if (key === "retryable") return String(Boolean(item.retryable));
  if (key === "key_status") return item.key_status;
  if (key === "key_scope") return item.key_scope;
  if (key === "idempotency_decision") return item.idempotency_decision;
  if (key === "request_kind") return item.request_kind;
  if (key === "request_status") return item.request_status;
  if (key === "duplicate_probe_status") return item.duplicate_probe_status;
  if (key === "duplicate_detected") return String(Boolean(item.duplicate_detected));
  if (key === "resume_state") return item.resume_state;
  if (key === "resume_blocked") return String(Boolean(item.resume_blocked));
  if (key === "cancel_request_status") return item.cancel_request_status;
  if (key === "cancel_state") return item.cancel_state;
  if (key === "control_decision") return item.control_decision;
  if (key === "decision_status") return item.decision_status;
  if (key === "context_packet_v2_status") return item.context_packet_v2_status;
  if (key === "selection_decision") return item.selection_decision;
  if (key === "token_budget_status") return item.token_budget_status;
  if (key === "citation_hint_status") return item.citation_hint_status;
  if (key === "context_packet_v2_record_id") return item.context_packet_v2_record_id;
  if (key === "context_resource_selection_record_id") return item.context_resource_selection_record_id;
  if (key === "context_token_budget_record_id") return item.context_token_budget_record_id;
  if (key === "context_citation_hint_record_id") return item.context_citation_hint_record_id;
  if (key === "new_run_created") return String(Boolean(item.new_run_created));
  if (key === "audit_status") return item.audit_status;
  if (key === "dsl_state") return item.dsl_state;
  if (key === "dsl_current_state") return item.dsl_current_state;
  if (key === "state_projection_status") return item.state_projection_status;
  if (key === "terminal_classification") return item.terminal_classification;
  if (key === "trace_id") return item.trace_id;
  if (key === "fact_claim_store_status") return item.summary?.fact_claim_store_status ?? item.fact_claim_store_status;
  if (key === "issue_graph_store_status") return item.summary?.issue_graph_store_status ?? item.issue_graph_store_status;
  if (key === "citation_object_store_status") return item.summary?.citation_object_store_status ?? item.citation_object_store_status;
  if (key === "lineage_graph_status") return item.summary?.lineage_graph_status ?? item.lineage_graph_status;
  if (key === "evidence_viewer_data_status") return item.summary?.evidence_viewer_data_status ?? item.evidence_viewer_data_status;
  if (key === "evidence_export_bundle_status") return item.summary?.evidence_export_bundle_status ?? item.evidence_export_bundle_status;
  if (key === "evidence_coverage_status") return item.summary?.evidence_coverage_status ?? item.evidence_coverage_status;
  if (key === "evidence_flags_status") return item.summary?.evidence_flags_status ?? item.evidence_flags_status;
  if (key === "exhibit_map_status") return item.summary?.exhibit_map_status ?? item.exhibit_map_status;
  if (key === "custody_event_ledger_status") return item.summary?.custody_event_ledger_status ?? item.custody_event_ledger_status;
  if (key === "search_index_contract_status") return item.summary?.search_index_contract_status ?? item.search_index_contract_status;
  if (key === "vector_index_policy_boundary_status") return item.summary?.vector_index_policy_boundary_status ?? item.vector_index_policy_boundary_status;
  if (key === "retrieval_filter_compiler_status") return item.summary?.retrieval_filter_compiler_status ?? item.retrieval_filter_compiler_status;
  if (key === "registry_status") return item.summary?.registry_status ?? item.registry_status;
  if (key === "ledger_status") return item.summary?.ledger_status ?? item.ledger_status;
  if (key === "policy_snapshot_binding_status") return item.summary?.policy_snapshot_binding_status ?? item.policy_snapshot_binding_status;
  if (key === "policy_snapshot_event_binding_status") return item.summary?.policy_snapshot_event_binding_status ?? item.policy_snapshot_event_binding_status;
  if (key === "wall_policy_status") return item.summary?.wall_policy_status ?? item.wall_policy_status;
  if (key === "access_policy_status") return item.summary?.access_policy_status ?? item.access_policy_status;
  if (key === "alias_key") return item.alias_keys ?? item.alias_key;
  if (key === "freeze_status") return item.summary?.freeze_status ?? item.freeze_status;
  if (key === "identity_model_status") return item.summary?.identity_model_status ?? item.identity_model_status;
  if (key === "checkpoint_key") return item.key;
  if (key === "checkpoint_status") return item.status;
  if (key === "runtime_id") return item.runtime_ids ?? item.runtime_id ?? item.metadata?.runtime_id;
  if (key === "matrix_id") return item.policy_matrix?.matrix_id ?? item.matrix_id;
  if (key === "offset_unit") return item.output_schema?.offset_unit ?? item.offset_unit;
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
