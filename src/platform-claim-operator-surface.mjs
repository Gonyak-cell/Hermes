import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformOperationsFreeze } from "./platform-operations-freeze.mjs";
import {
  DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS,
  buildPlatformClaimActionFeasibility,
} from "./platform-claim-action-feasibility.mjs";

export const DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_OUT_DIR = "artifacts/platform-claim-operator-surface/latest";
export const DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS = {
  ...DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS,
  claimActionFeasibilitySchemaPath: DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.schemaPath,
  reviewApiSourcePath: "src/review-api.mjs",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiDocPath: "docs/review-api.md",
  schemaPath: "schemas/platform-claim-operator-surface.schema.json",
};

const COMMAND_NAME = "platform:claim-operator-surface";
const SCHEMA_VERSION = "platform-claim-operator-surface.v1";
const CAPABILITY_ID = "platform.claim_operator_surface";
const PHASE_RANGE = "P511-P515";
const PHASE_SLOT = "P511";
const PREVIOUS_PHASE_SLOT = "P510";
const NEXT_PHASE_SLOT = "P516";
const SOURCE_READY_STATUS = "ready_for_claim_action_feasibility";
const OPERATIONS_FREEZE_READY_STATUS = "ready_for_claim_freeze";
const READY_STATUS = "ready_for_claim_operator_surface";
const FILTER_READY_STATUS = "ready_for_claim_registry_filtering";
const DASHBOARD_READY_STATUS = "ready_for_claim_dashboard_surface";
const API_READY_STATUS = "ready_for_claim_api_filter_route";
const AUDIT_READY_STATUS = "ready_for_claim_adjudication_audit_projection";
const CLOSEOUT_READY_STATUS = "ready_for_claim_operator_surface_closeout";
const EXPECTED_CLAIM_COUNT = 140;
const EXPECTED_BLOCKED_CLAIMS = 40;
const EXPECTED_PASS_CLAIMS = 100;
const CLAIM_ROUTE = "/api/platform-claim-registry";
const GATE_ROUTE = "/api/platform-claim-gates";
const BOUNDARY_ROUTE = "/api/platform-claim-boundary";
const VALIDATION_ROUTE = "/api/platform-claim-validations";

export async function runPlatformClaimOperatorSurface(options = {}) {
  const result = await buildPlatformClaimOperatorSurface(options);
  if (options.write !== false) await writePlatformClaimOperatorSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform claim operator surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformClaimOperatorSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const operationsFreeze = await buildPlatformOperationsFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.operations_freeze_schema_path,
    write: false,
  });
  const claimActionFeasibility = await buildPlatformClaimActionFeasibility({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    claimAdjudicationLedgerPath: inputs.claim_adjudication_ledger_path,
    operationsFreezeSchemaPath: inputs.operations_freeze_schema_path,
    claimReceiptIntakeContractSchemaPath: inputs.claim_receipt_intake_contract_schema_path,
    claimReceiptWorkspaceSchemaPath: inputs.claim_receipt_workspace_schema_path,
    schemaPath: inputs.claim_action_feasibility_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const claimAdjudicationLedger = await readTextSource(inputs.claim_adjudication_ledger_path);
  const reviewApiSource = await readTextSource(inputs.review_api_source_path);
  const reviewDashboardSource = await readTextSource(inputs.review_dashboard_source_path);
  const reviewApiDoc = await readTextSource(inputs.review_api_doc_path);
  const claimRows = operationsFreeze.operations_freeze_claim_registry_rows ?? [];
  const filterRows = buildFilterRows({ claimRows });
  const dashboardRows = buildDashboardRows({ claimRows, reviewDashboardSource });
  const apiRows = buildApiRows({ filterRows, reviewApiSource, reviewApiDoc });
  const auditRows = buildAuditRows({ claimRows });
  const closeoutRows = buildCloseoutRows({ claimRows, filterRows, dashboardRows, apiRows, auditRows });
  const boundary = buildBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    operationsFreeze,
    claimActionFeasibility,
    claimRows,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
  });
  const anchor = buildAnchor({
    operationsFreeze,
    claimActionFeasibility,
    packageJson,
    claimAdjudicationLedger,
    reviewApiSource,
    reviewDashboardSource,
    reviewApiDoc,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
  });
  const gateRows = buildGateRows({
    operationsFreeze,
    claimActionFeasibility,
    packageJson,
    claimAdjudicationLedger,
    reviewApiSource,
    reviewDashboardSource,
    reviewApiDoc,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
    boundary,
  });
  const validationItems = buildValidationItems({
    operationsFreeze,
    claimActionFeasibility,
    packageJson,
    claimAdjudicationLedger,
    reviewApiSource,
    reviewDashboardSource,
    reviewApiDoc,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    operationsFreeze,
    claimActionFeasibility,
    claimRows,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_claim_operator_surface_id: `platform-claim-operator-surface.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    claim_operator_surface_anchor: anchor,
    claim_registry_filter_rows: filterRows,
    claim_operator_dashboard_rows: dashboardRows,
    claim_operator_api_route_rows: apiRows,
    claim_adjudication_audit_rows: auditRows,
    claim_operator_surface_closeout_rows: closeoutRows,
    claim_operator_surface_gate_rows: gateRows,
    claim_operator_surface_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_claim_operator_surface") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    operationsFreeze,
    claimActionFeasibility,
    claimRows,
    filterRows,
    dashboardRows,
    apiRows,
    auditRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.platform_claim_operator_surface_id = result.platform_claim_operator_surface_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformClaimOperatorSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-claim-operator-surface.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claim-registry-filter-rows.json"), collectionEnvelope("platform-claim-registry-filter-rows.v1", "claim_registry_filter_rows", result.claim_registry_filter_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-operator-dashboard-rows.json"), collectionEnvelope("platform-claim-operator-dashboard-rows.v1", "claim_operator_dashboard_rows", result.claim_operator_dashboard_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-operator-api-route-rows.json"), collectionEnvelope("platform-claim-operator-api-route-rows.v1", "claim_operator_api_route_rows", result.claim_operator_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-adjudication-audit-rows.json"), collectionEnvelope("platform-claim-adjudication-audit-rows.v1", "claim_adjudication_audit_rows", result.claim_adjudication_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-operator-surface-closeout-rows.json"), collectionEnvelope("platform-claim-operator-surface-closeout-rows.v1", "claim_operator_surface_closeout_rows", result.claim_operator_surface_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-operator-surface-gate-rows.json"), collectionEnvelope("platform-claim-operator-surface-gate-rows.v1", "claim_operator_surface_gate_rows", result.claim_operator_surface_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-operator-surface-boundary.json"), result.claim_operator_surface_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-claim-operator-surface-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformClaimOperatorSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformClaimOperatorSurface(args);
    console.log(`Platform claim operator surface ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_claim_operator_surface_status}`);
    console.log(`Claim registry filters: ${result.summary.ready_filter_row_count}/${result.summary.filter_row_count}`);
    console.log(`Dashboard rows: ${result.summary.ready_dashboard_row_count}/${result.summary.dashboard_row_count}`);
    console.log(`API route rows: ${result.summary.ready_api_route_row_count}/${result.summary.api_route_row_count}`);
    console.log(`Audit rows: ${result.summary.ready_audit_row_count}/${result.summary.audit_row_count}`);
    console.log(`Surface gates: ${result.summary.ready_surface_gate_count}/${result.summary.surface_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ operationsFreeze, claimActionFeasibility, packageJson, claimAdjudicationLedger, reviewApiSource, reviewDashboardSource, reviewApiDoc, filterRows, dashboardRows, apiRows, auditRows, closeoutRows }) {
  return {
    schema_version: "platform-claim-operator-surface-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_id: operationsFreeze.platform_operations_freeze_id,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_action_feasibility_id: claimActionFeasibility.platform_claim_action_feasibility_id,
    source_claim_action_feasibility_status: claimActionFeasibility.summary.platform_claim_action_feasibility_status,
    claim_count: operationsFreeze.summary.claim_count,
    blocked_claim_count: operationsFreeze.summary.blocked_claim_count,
    pass_claim_count: operationsFreeze.summary.pass_claim_count,
    filter_row_count: filterRows.length,
    dashboard_row_count: dashboardRows.length,
    api_route_row_count: apiRows.length,
    audit_row_count: auditRows.length,
    closeout_row_count: closeoutRows.length,
    package_json_hash: packageJson.content_hash,
    claim_adjudication_ledger_hash: claimAdjudicationLedger.content_hash,
    review_api_source_hash: reviewApiSource.content_hash,
    review_dashboard_source_hash: reviewDashboardSource.content_hash,
    review_api_doc_hash: reviewApiDoc.content_hash,
    filter_rows_hash: hashRows(filterRows, ["row_key", "route_path", "expected_count"]),
    dashboard_rows_hash: hashRows(dashboardRows, ["row_key", "dashboard_surface_status"]),
    api_rows_hash: hashRows(apiRows, ["row_key", "route_path", "api_route_status"]),
    audit_rows_hash: hashRows(auditRows, ["row_key", "audit_status"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_key", "closeout_status"]),
  };
}

function buildFilterRows({ claimRows }) {
  const definitions = [
    filterDefinition("all_claims", {}, EXPECTED_CLAIM_COUNT, "All frozen P341-P480 claims are queryable."),
    filterDefinition("blocked_claims", { verdict: "blocked" }, EXPECTED_BLOCKED_CLAIMS, "Documented BLOCK claims are queryable."),
    filterDefinition("pass_claims", { verdict: "pass" }, EXPECTED_PASS_CLAIMS, "PASS claims are queryable without touching BLOCK rows."),
    filterDefinition("human_receipt_required", { human_receipt_required: true }, EXPECTED_BLOCKED_CLAIMS, "Claims that still require human receipt are queryable."),
    filterDefinition("approval_owner_blocks", { verdict: "blocked", responsible_owner: "approval_owner" }, 20, "Approval-owner BLOCK queue is queryable."),
    filterDefinition("recovery_owner_blocks", { verdict: "blocked", responsible_owner: "recovery_owner" }, 20, "Recovery-owner BLOCK queue is queryable."),
    filterDefinition("protected_blocked_claims", { verdict: "blocked", protected_claim: true }, EXPECTED_BLOCKED_CLAIMS, "Protected documented BLOCK claims are queryable."),
    filterDefinition("operator_surface_claims", { operator_surface_claim: true }, 20, "Operator-surface source claims remain queryable."),
  ];
  return definitions.map((definition, index) => {
    const actualRows = applyFilters(claimRows, definition.filters);
    const row = {
      schema_version: "platform-claim-registry-filter-row.v1",
      claim_registry_filter_row_id: `platform-claim-registry-filter.${definition.row_key}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P511",
      row_key: definition.row_key,
      route_path: CLAIM_ROUTE,
      query_path: buildQueryPath(CLAIM_ROUTE, definition.filters),
      filters: definition.filters,
      filter_fields: Object.keys(definition.filters),
      expected_count: definition.expected_count,
      actual_count: actualRows.length,
      filter_status: actualRows.length === definition.expected_count ? FILTER_READY_STATUS : "blocked",
      description: definition.description,
      reads_claim_registry_directly: true,
      source_collection: "operations_freeze_claim_registry_rows",
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      receipt_validation_performed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_registry_filter_row_hash");
  });
}

function buildDashboardRows({ claimRows, reviewDashboardSource }) {
  const blockedRows = claimRows.filter((row) => row.verdict === "blocked");
  const passRows = claimRows.filter((row) => row.verdict === "pass");
  const sourceText = reviewDashboardSource.text ?? "";
  const rows = [
    {
      row_key: "dashboard_source_registered",
      description: "Review Dashboard registers platform_operations_freeze as a source artifact.",
      source_registered: sourceText.includes("platform_operations_freeze"),
      stage_registered: sourceText.includes("buildPlatformOperationsFreezeStage"),
      source_path_option_registered: sourceText.includes("platformOperationsFreezePath"),
      claim_registry_route: CLAIM_ROUTE,
    },
    {
      row_key: "dashboard_blocked_claim_metrics",
      description: "Dashboard stage exposes BLOCK/PASS/human receipt counts from the frozen claim registry.",
      source_registered: sourceText.includes("platform_operations_freeze"),
      stage_registered: sourceText.includes("blocked_claim_count") && sourceText.includes("pass_claim_count"),
      source_path_option_registered: sourceText.includes("platformOperationsFreezePath"),
      claim_registry_route: CLAIM_ROUTE,
    },
    {
      row_key: "dashboard_operator_claim_link",
      description: "Dashboard metrics point operators to the claim registry API filter route.",
      source_registered: sourceText.includes("platform_operations_freeze"),
      stage_registered: sourceText.includes(CLAIM_ROUTE),
      source_path_option_registered: sourceText.includes("platformOperationsFreezePath"),
      claim_registry_route: CLAIM_ROUTE,
    },
  ];
  return rows.map((definition, index) => {
    const ready = definition.source_registered && definition.stage_registered && definition.source_path_option_registered;
    const row = {
      schema_version: "platform-claim-operator-dashboard-row.v1",
      claim_operator_dashboard_row_id: `platform-claim-operator-dashboard.${definition.row_key}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P512",
      row_key: definition.row_key,
      description: definition.description,
      dashboard_surface_status: ready ? DASHBOARD_READY_STATUS : "blocked",
      source_id: "platform_operations_freeze",
      source_registered: definition.source_registered,
      stage_registered: definition.stage_registered,
      source_path_option_registered: definition.source_path_option_registered,
      claim_registry_route: definition.claim_registry_route,
      claim_count: claimRows.length,
      blocked_claim_count: blockedRows.length,
      pass_claim_count: passRows.length,
      human_receipt_required_count: claimRows.filter((claim) => claim.human_receipt_required).length,
      claim_registry_rows_mutated_by_dashboard: false,
      dashboard_route_execution_performed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_operator_dashboard_row_hash");
  });
}

function buildApiRows({ filterRows, reviewApiSource, reviewApiDoc }) {
  const sourceText = reviewApiSource.text ?? "";
  const docText = reviewApiDoc.text ?? "";
  const routes = [
    apiRouteDefinition("claim_registry", CLAIM_ROUTE, "platform_claim_registry", filterRows),
    apiRouteDefinition("claim_gates", GATE_ROUTE, "platform_claim_gates", []),
    apiRouteDefinition("claim_boundary", BOUNDARY_ROUTE, "platform_claim_boundary", []),
    apiRouteDefinition("claim_validations", VALIDATION_ROUTE, "platform_claim_validations", []),
  ];
  return routes.map((definition, index) => {
    const routeRegistered = sourceText.includes(definition.route_path);
    const docRegistered = docText.includes(definition.route_path);
    const filterKeysRegistered = definition.row_key === "claim_registry"
      ? ["verdict", "claim_type", "source_phase_slot", "responsible_owner", "human_receipt_required", "protected_claim", "operator_surface_claim"].every((key) => sourceText.includes(`"${key}"`))
      : true;
    const ready = routeRegistered && docRegistered && filterKeysRegistered;
    const row = {
      schema_version: "platform-claim-operator-api-route-row.v1",
      claim_operator_api_route_row_id: `platform-claim-operator-api.${definition.row_key}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P513",
      row_key: definition.row_key,
      route_path: definition.route_path,
      collection: definition.collection,
      api_route_status: ready ? API_READY_STATUS : "blocked",
      route_registered: routeRegistered,
      review_api_doc_registered: docRegistered,
      filter_keys_registered: filterKeysRegistered,
      supported_filter_count: definition.row_key === "claim_registry" ? 7 : 0,
      direct_claim_registry_filter: definition.row_key === "claim_registry",
      expected_probe_count: definition.probes.length,
      ready_probe_count: definition.probes.filter((probe) => probe.filter_status === FILTER_READY_STATUS).length,
      server_start_required: false,
      mutating_method_allowed: false,
      read_only: true,
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      protected_action_executed: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_operator_api_route_row_hash");
  });
}

function buildAuditRows({ claimRows }) {
  const rows = [
    auditDefinition("unsupported_complete_claims_absent", "Unsupported complete PASS claims remain absent.", claimRows.filter((row) => row.unsupported_complete_claim).length, 0),
    auditDefinition("pass_without_reviewer_or_gate_absent", "PASS rows still require reviewer and gate references.", claimRows.filter((row) => row.pass_without_reviewer_or_gate).length, 0),
    auditDefinition("protected_pass_without_receipt_absent", "Protected PASS rows without receipts remain absent.", claimRows.filter((row) => row.protected_pass_without_receipt).length, 0),
    auditDefinition("blocked_without_next_action_absent", "Documented BLOCK rows retain a next action.", claimRows.filter((row) => row.blocked_without_next_action).length, 0),
    auditDefinition("blocked_claim_count_retained", "Documented BLOCK count is retained for adjudication.", claimRows.filter((row) => row.verdict === "blocked").length, EXPECTED_BLOCKED_CLAIMS),
  ];
  return rows.map((definition, index) => {
    const ready = definition.actual_count === definition.expected_count;
    const row = {
      schema_version: "platform-claim-adjudication-audit-row.v1",
      claim_adjudication_audit_row_id: `platform-claim-adjudication-audit.${definition.row_key}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P514",
      row_key: definition.row_key,
      description: definition.description,
      audit_status: ready ? AUDIT_READY_STATUS : "blocked",
      actual_count: definition.actual_count,
      expected_count: definition.expected_count,
      claim_registry_source: "operations_freeze_claim_registry_rows",
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      receipt_validation_performed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_adjudication_audit_row_hash");
  });
}

function buildCloseoutRows({ claimRows, filterRows, dashboardRows, apiRows, auditRows }) {
  const ready = claimRows.length === EXPECTED_CLAIM_COUNT
    && filterRows.every((row) => row.filter_status === FILTER_READY_STATUS)
    && dashboardRows.every((row) => row.dashboard_surface_status === DASHBOARD_READY_STATUS)
    && apiRows.every((row) => row.api_route_status === API_READY_STATUS)
    && auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS);
  const row = {
    schema_version: "platform-claim-operator-surface-closeout-row.v1",
    claim_operator_surface_closeout_row_id: "platform-claim-operator-surface-closeout.p515",
    phase_range: PHASE_RANGE,
    phase_slot: "P515",
    row_key: "p515_operator_surface_closeout",
    closeout_status: ready ? CLOSEOUT_READY_STATUS : "blocked",
    claim_registry_filter_ready: filterRows.every((item) => item.filter_status === FILTER_READY_STATUS),
    dashboard_surface_ready: dashboardRows.every((item) => item.dashboard_surface_status === DASHBOARD_READY_STATUS),
    api_route_surface_ready: apiRows.every((item) => item.api_route_status === API_READY_STATUS),
    adjudication_audit_ready: auditRows.every((item) => item.audit_status === AUDIT_READY_STATUS),
    documented_block_retained_count: claimRows.filter((claim) => claim.verdict === "blocked").length,
    pass_promoted: false,
    receipt_validated: false,
    approval_applied: false,
    operator_surface_mutation_performed: false,
    protected_action_executed: false,
    next_adjudication_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    human_review_required: true,
  };
  return [withOrdinalAndHash(row, 0, "claim_operator_surface_closeout_row_hash")];
}

function buildBoundary({ generatedAt, writeRequested, operationsFreeze, claimActionFeasibility, claimRows, filterRows, dashboardRows, apiRows, auditRows, closeoutRows }) {
  return {
    schema_version: "platform-claim-operator-surface-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_adjudication_layer: true,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_action_feasibility_status: claimActionFeasibility.summary.platform_claim_action_feasibility_status,
    claim_operator_surface_write_requested: writeRequested,
    claim_count: claimRows.length,
    blocked_claim_count: claimRows.filter((row) => row.verdict === "blocked").length,
    pass_claim_count: claimRows.filter((row) => row.verdict === "pass").length,
    filter_row_count: filterRows.length,
    ready_filter_row_count: filterRows.filter((row) => row.filter_status === FILTER_READY_STATUS).length,
    dashboard_row_count: dashboardRows.length,
    ready_dashboard_row_count: dashboardRows.filter((row) => row.dashboard_surface_status === DASHBOARD_READY_STATUS).length,
    api_route_row_count: apiRows.length,
    ready_api_route_row_count: apiRows.filter((row) => row.api_route_status === API_READY_STATUS).length,
    audit_row_count: auditRows.length,
    ready_audit_row_count: auditRows.filter((row) => row.audit_status === AUDIT_READY_STATUS).length,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === CLOSEOUT_READY_STATUS).length,
    claim_registry_direct_filtering_enabled: apiRows.some((row) => row.route_path === CLAIM_ROUTE && row.direct_claim_registry_filter),
    dashboard_claim_source_registered: dashboardRows.every((row) => row.source_registered && row.stage_registered),
    api_claim_routes_registered: apiRows.every((row) => row.route_registered),
    review_api_docs_registered: apiRows.every((row) => row.review_api_doc_registered),
    receipt_payload_present: false,
    receipt_source_registered: false,
    receipt_received: false,
    receipt_validated: false,
    approval_applied: false,
    ready_for_pass_promotion: false,
    pass_promoted: false,
    blocked_state_preserved: closeoutRows.every((row) => row.documented_block_retained_count === EXPECTED_BLOCKED_CLAIMS && !row.pass_promoted),
    command_execution_performed: false,
    package_command_execution_performed: false,
    server_started: false,
    route_mutation_performed: false,
    generated_artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    protected_recovery_execution_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    secret_exposure_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildGateRows({ operationsFreeze, claimActionFeasibility, packageJson, claimAdjudicationLedger, reviewApiSource, reviewDashboardSource, reviewApiDoc, filterRows, dashboardRows, apiRows, auditRows, closeoutRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = claimAdjudicationLedger.text ?? "";
  const rows = [
    gateRow("p500_claim_freeze_ready", "P500 claim freeze source is ready.", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === OPERATIONS_FREEZE_READY_STATUS),
    gateRow("p506_p510_claim_action_feasibility_ready", "P506-P510 claim action feasibility source is ready.", claimActionFeasibility.validation.valid && claimActionFeasibility.summary.platform_claim_action_feasibility_status === SOURCE_READY_STATUS),
    gateRow("p511_filter_rows_ready", "P511 claim registry filter rows cover all operator query families.", filterRows.length >= 8 && filterRows.every((row) => row.filter_status === FILTER_READY_STATUS)),
    gateRow("p512_dashboard_rows_ready", "P512 dashboard source and stage are registered.", dashboardRows.length >= 3 && dashboardRows.every((row) => row.dashboard_surface_status === DASHBOARD_READY_STATUS)),
    gateRow("p513_api_routes_ready", "P513 Review API exposes read-only claim registry filtering.", apiRows.length >= 4 && apiRows.every((row) => row.api_route_status === API_READY_STATUS)),
    gateRow("p514_audit_rows_ready", "P514 audit projection proves no unsupported PASS or BLOCK erosion.", auditRows.length >= 5 && auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS)),
    gateRow("p515_closeout_ready", "P515 closes the operator surface without verdict mutation.", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && !row.pass_promoted)),
    gateRow("review_api_source_available", "Review API source is readable.", reviewApiSource.available),
    gateRow("review_dashboard_source_available", "Review Dashboard source is readable.", reviewDashboardSource.available),
    gateRow("review_api_docs_available", "Review API docs are readable.", reviewApiDoc.available),
    gateRow("platform_package_script_registered", "package.json registers the P511-P515 claim operator surface command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P511-P515 claim operator surface command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p511_ledger_acceptance_declared", "P511 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P511: \`${COMMAND_NAME}\``)),
    gateRow("p512_ledger_acceptance_declared", "P512 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P512: \`${COMMAND_NAME}\``)),
    gateRow("p513_ledger_acceptance_declared", "P513 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P513: \`${COMMAND_NAME}\``)),
    gateRow("p514_ledger_acceptance_declared", "P514 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P514: \`${COMMAND_NAME}\``)),
    gateRow("p515_ledger_acceptance_declared", "P515 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P515: \`${COMMAND_NAME}\``)),
    gateRow("blocked_state_preserved", "Operator surface does not validate receipts, apply approvals, or promote PASS.", boundary.blocked_state_preserved && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted),
    gateRow("no_execution_or_mutation", "Operator surface remains read-only/report-only without route/server mutation.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.server_started && !boundary.route_mutation_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.protected_action_executed),
    gateRow("trading_desktop_secret_boundaries", "Trading, Desktop, and secret boundaries remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "claim_operator_surface_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-claim-operator-surface-gate-row.v1",
    claim_operator_surface_gate_row_id: `platform-claim-operator-surface.gate.${rowKey}`,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    read_only: true,
    route_mutation_performed: false,
    receipt_validated_by_operator_surface: false,
    approval_applied_by_operator_surface: false,
    pass_promoted_by_operator_surface: false,
    protected_action_executed_by_operator_surface: false,
    secret_exposure_allowed_by_operator_surface: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ operationsFreeze, claimActionFeasibility, packageJson, claimAdjudicationLedger, reviewApiSource, reviewDashboardSource, reviewApiDoc, filterRows, dashboardRows, apiRows, auditRows, closeoutRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze", "p500_claim_freeze_ready", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === OPERATIONS_FREEZE_READY_STATUS, "P500 claim freeze source must be ready."),
    validationItem("source.claim_action_feasibility", "p506_p510_claim_action_feasibility_ready", claimActionFeasibility.validation.valid && claimActionFeasibility.summary.platform_claim_action_feasibility_status === SOURCE_READY_STATUS, "P506-P510 source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable."),
    validationItem("source.claim_adjudication_ledger", "claim_adjudication_ledger_available", claimAdjudicationLedger.available, "P501-P520 claim adjudication ledger is readable."),
    validationItem("source.review_api", "review_api_source_available", reviewApiSource.available, "Review API source is readable."),
    validationItem("source.review_dashboard", "review_dashboard_source_available", reviewDashboardSource.available, "Review Dashboard source is readable."),
    validationItem("source.review_api_doc", "review_api_doc_available", reviewApiDoc.available, "Review API docs are readable."),
    validationItem("claim_registry_filter_rows", "filter_rows_ready", filterRows.length >= 8 && filterRows.every((row) => row.filter_status === FILTER_READY_STATUS), "P511 filter rows must be ready."),
    validationItem("claim_operator_dashboard_rows", "dashboard_rows_ready", dashboardRows.length >= 3 && dashboardRows.every((row) => row.dashboard_surface_status === DASHBOARD_READY_STATUS), "P512 dashboard rows must be ready."),
    validationItem("claim_operator_api_route_rows", "api_route_rows_ready", apiRows.length >= 4 && apiRows.every((row) => row.api_route_status === API_READY_STATUS), "P513 API routes must be ready."),
    validationItem("claim_adjudication_audit_rows", "audit_rows_ready", auditRows.length >= 5 && auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS), "P514 audit rows must be ready."),
    validationItem("claim_operator_surface_closeout_rows", "closeout_rows_ready", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && !row.pass_promoted), "P515 closeout row must be ready."),
    validationItem("claim_operator_surface_gate_rows", "surface_gates_ready", gateRows.length >= 20 && gateRows.every((row) => row.gate_status === "ready" && !row.pass_promoted_by_operator_surface && !row.protected_action_executed_by_operator_surface), "P511-P515 gates must be ready."),
    validationItem("boundary.blocked_state_preserved", "blocked_state_preserved", boundary.blocked_state_preserved && boundary.blocked_claim_count === EXPECTED_BLOCKED_CLAIMS && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted, "Documented BLOCK state must be preserved."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.server_started && !boundary.route_mutation_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.protected_action_executed, "P511-P515 remain read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ operationsFreeze, claimActionFeasibility, claimRows, filterRows, dashboardRows, apiRows, auditRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_claim_operator_surface_status: validation.valid ? READY_STATUS : "blocked",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_action_feasibility_status: claimActionFeasibility.summary.platform_claim_action_feasibility_status,
    claim_count: claimRows.length,
    blocked_claim_count: claimRows.filter((row) => row.verdict === "blocked").length,
    pass_claim_count: claimRows.filter((row) => row.verdict === "pass").length,
    filter_row_count: filterRows.length,
    ready_filter_row_count: filterRows.filter((row) => row.filter_status === FILTER_READY_STATUS).length,
    dashboard_row_count: dashboardRows.length,
    ready_dashboard_row_count: dashboardRows.filter((row) => row.dashboard_surface_status === DASHBOARD_READY_STATUS).length,
    api_route_row_count: apiRows.length,
    ready_api_route_row_count: apiRows.filter((row) => row.api_route_status === API_READY_STATUS).length,
    audit_row_count: auditRows.length,
    ready_audit_row_count: auditRows.filter((row) => row.audit_status === AUDIT_READY_STATUS).length,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === CLOSEOUT_READY_STATUS).length,
    surface_gate_count: gateRows.length,
    ready_surface_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    claim_registry_direct_filtering_enabled: boundary.claim_registry_direct_filtering_enabled,
    dashboard_claim_source_registered: boundary.dashboard_claim_source_registered,
    api_claim_routes_registered: boundary.api_claim_routes_registered,
    review_api_docs_registered: boundary.review_api_docs_registered,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_source_registered: boundary.receipt_source_registered,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    approval_applied: boundary.approval_applied,
    ready_for_pass_promotion: boundary.ready_for_pass_promotion,
    pass_promoted: boundary.pass_promoted,
    blocked_state_preserved: boundary.blocked_state_preserved,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    server_started: boundary.server_started,
    route_mutation_performed: boundary.route_mutation_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Claim Operator Surface",
    "",
    `Status: ${result.summary.platform_claim_operator_surface_status}`,
    `Phase range: ${result.summary.phase_range}`,
    `Claims: ${result.summary.claim_count} total, ${result.summary.blocked_claim_count} BLOCK, ${result.summary.pass_claim_count} PASS`,
    `Filters: ${result.summary.ready_filter_row_count}/${result.summary.filter_row_count}`,
    `Dashboard rows: ${result.summary.ready_dashboard_row_count}/${result.summary.dashboard_row_count}`,
    `API routes: ${result.summary.ready_api_route_row_count}/${result.summary.api_route_row_count}`,
    `Audit rows: ${result.summary.ready_audit_row_count}/${result.summary.audit_row_count}`,
    "",
    "## Filter Rows",
    "",
    ...result.claim_registry_filter_rows.map((row) => `- ${row.row_key}: ${row.actual_count}/${row.expected_count} (${row.query_path})`),
    "",
    "## Gates",
    "",
    ...result.claim_operator_surface_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function filterDefinition(rowKey, filters, expectedCount, description) {
  return { row_key: rowKey, filters, expected_count: expectedCount, description };
}

function apiRouteDefinition(rowKey, routePath, collection, probes) {
  return { row_key: rowKey, route_path: routePath, collection, probes };
}

function auditDefinition(rowKey, description, actualCount, expectedCount) {
  return { row_key: rowKey, description, actual_count: actualCount, expected_count: expectedCount };
}

function applyFilters(rows, filters) {
  return rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
}

function buildQueryPath(routePath, filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) params.set(key, String(value));
  const query = params.toString();
  return query ? `${routePath}?${query}` : routePath;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--claim-adjudication-ledger") parsed.claimAdjudicationLedgerPath = argv[++index];
    else if (arg === "--operations-freeze-schema") parsed.operationsFreezeSchemaPath = argv[++index];
    else if (arg === "--claim-receipt-intake-contract-schema") parsed.claimReceiptIntakeContractSchemaPath = argv[++index];
    else if (arg === "--claim-receipt-workspace-schema") parsed.claimReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--claim-action-feasibility-schema") parsed.claimActionFeasibilitySchemaPath = argv[++index];
    else if (arg === "--review-api-source") parsed.reviewApiSourcePath = argv[++index];
    else if (arg === "--review-dashboard-source") parsed.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-claim-operator-surface.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --claim-adjudication-ledger <path>           P501-P520 claim adjudication ledger path.
  --operations-freeze-schema <path>            P500 operations freeze schema path.
  --claim-receipt-intake-contract-schema <path>
                                               P501 claim receipt intake contract schema path.
  --claim-receipt-workspace-schema <path>      P502-P505 claim receipt workspace schema path.
  --claim-action-feasibility-schema <path>     P506-P510 claim action feasibility schema path.
  --review-api-source <path>                   Review API source path.
  --review-dashboard-source <path>             Review Dashboard source path.
  --review-api-doc <path>                      Review API docs path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.platformOpsLedgerPath),
    claim_adjudication_ledger_path: path.resolve(options.claimAdjudicationLedgerPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.claimAdjudicationLedgerPath),
    operations_freeze_schema_path: path.resolve(options.operationsFreezeSchemaPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.operationsFreezeSchemaPath),
    claim_receipt_intake_contract_schema_path: path.resolve(options.claimReceiptIntakeContractSchemaPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.claimReceiptIntakeContractSchemaPath),
    claim_receipt_workspace_schema_path: path.resolve(options.claimReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.claimReceiptWorkspaceSchemaPath),
    claim_action_feasibility_schema_path: path.resolve(options.claimActionFeasibilitySchemaPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.claimActionFeasibilitySchemaPath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.reviewApiSourcePath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.reviewDashboardSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.reviewApiDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(text),
      content_hash: hashValue(JSON.parse(text)),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: hashText(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function validationItem(pathKey, check, passed, message) {
  return {
    path: pathKey,
    check,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
}

function withOrdinalAndHash(row, index, hashKey) {
  const withOrdinal = { ...row, ordinal: index + 1 };
  return {
    ...withOrdinal,
    [hashKey]: hashValue(withOrdinal),
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}
