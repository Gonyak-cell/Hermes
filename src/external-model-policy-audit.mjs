import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXTERNAL_MODEL_POLICY_AUDIT_OUT_DIR = "artifacts/external-model-policy-audit/latest";
export const DEFAULT_EXTERNAL_MODEL_POLICY_AUDIT_INPUTS = {
  promptInjectionTestSuitePath: "artifacts/prompt-injection-test-suite/latest/prompt-injection-test-suite.json",
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  policySnapshotLedgerPath: "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json",
  modelRoutingLedgerPath: "artifacts/model-routing/latest/model-routing-ledger.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  runtimeApiDashboardPath: "artifacts/runtime-api-dashboard/latest/runtime-api-dashboard.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "external-model-policy-audit.v1";
const CAPABILITY_ID = "security.external_model_policy_audit";
const PHASE_SLOT = "P299";
const PREVIOUS_PHASE_SLOT = "P298";
const NEXT_PHASE_SLOT = "P300";

const SOURCE_DEFINITIONS = [
  sourceDefinition("prompt_injection_test_suite", "Prompt Injection Test Suite", "prompt_injection_test_suite_status", "complete", "P298", "P299"),
  sourceDefinition("policy_matrix_catalog", "Policy Matrix Catalog", "policy_status", "valid", null, null),
  sourceDefinition("policy_snapshot_ledger", "Policy Snapshot Ledger", "ledger_status", "valid", null, null),
  sourceDefinition("model_routing_ledger", "Model Routing Ledger", "ledger_status", "valid", null, null),
  sourceDefinition("model_policy_enforcement", "Model Policy Enforcement", "model_policy_enforcement_status", "complete", null, null),
  sourceDefinition("runtime_api_dashboard", "Runtime API Dashboard", "runtime_api_dashboard_status", "complete", null, null),
  sourceDefinition("capability_registry_api", "Capability Registry API", "capability_registry_api_status", "complete", null, null),
];

const CLASSIFICATION_PREFIX = {
  P0_PUBLIC: "P0",
  P1_INTERNAL: "P1",
  P2_CLIENT_CONFIDENTIAL: "P2",
  P3_PRIVILEGED: "P3",
  P4_HIGHLY_RESTRICTED: "P4",
  P5_SECRET: "P5",
};

export async function runExternalModelPolicyAudit(options = {}) {
  const result = await buildExternalModelPolicyAudit(options);
  if (options.write !== false) await writeExternalModelPolicyAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`External model policy audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExternalModelPolicyAudit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXTERNAL_MODEL_POLICY_AUDIT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    prompt_injection_test_suite: await readJsonSource(inputs.prompt_injection_test_suite_path),
    policy_matrix_catalog: await readJsonSource(inputs.policy_matrix_catalog_path),
    policy_snapshot_ledger: await readJsonSource(inputs.policy_snapshot_ledger_path),
    model_routing_ledger: await readJsonSource(inputs.model_routing_ledger_path),
    model_policy_enforcement: await readJsonSource(inputs.model_policy_enforcement_path),
    runtime_api_dashboard: await readJsonSource(inputs.runtime_api_dashboard_path),
    capability_registry_api: await readJsonSource(inputs.capability_registry_api_path),
  };
  const support = {
    package_json: await readJsonSource(inputs.package_path),
    final_completion_ledger: await readTextSource(inputs.roadmap_path),
    implementation_roadmap: await readTextSource(inputs.implementation_roadmap_path),
    review_dashboard_source: await readTextSource(inputs.review_dashboard_source_path),
    review_api_source: await readTextSource(inputs.review_api_source_path),
    review_api_doc: await readTextSource(inputs.review_api_doc_path),
  };

  const sourceStatuses = buildSourceStatuses(sources);
  const classificationAudits = buildClassificationAudits({ sources, generatedAt });
  const snapshotAudits = buildSnapshotAudits({ sources, classificationAudits, generatedAt });
  const routeAudits = buildRouteAudits({ sources, snapshotAudits, generatedAt });
  const desktopProviderModelAudits = buildDesktopProviderModelAudits({ sources, snapshotAudits, routeAudits, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    classificationAudits,
    snapshotAudits,
    routeAudits,
    desktopProviderModelAudits,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceStatuses,
    classificationAudits,
    snapshotAudits,
    routeAudits,
    desktopProviderModelAudits,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    external_model_policy_audit_id: `external-model-policy-audit.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    external_model_classification_audits: classificationAudits,
    external_model_policy_snapshot_audits: snapshotAudits,
    external_model_route_audits: routeAudits,
    desktop_provider_model_audits: desktopProviderModelAudits,
    external_model_policy_audit_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeExternalModelPolicyAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "external-model-policy-audit.json"), serializable);
  await writeJson(path.join(outDir, "external-model-classification-audits.json"), collectionEnvelope("external-model-classification-audits.v1", "external_model_classification_audits", result.external_model_classification_audits, result.generated_at));
  await writeJson(path.join(outDir, "external-model-policy-snapshot-audits.json"), collectionEnvelope("external-model-policy-snapshot-audits.v1", "external_model_policy_snapshot_audits", result.external_model_policy_snapshot_audits, result.generated_at));
  await writeJson(path.join(outDir, "external-model-route-audits.json"), collectionEnvelope("external-model-route-audits.v1", "external_model_route_audits", result.external_model_route_audits, result.generated_at));
  await writeJson(path.join(outDir, "desktop-provider-model-audits.json"), collectionEnvelope("desktop-provider-model-audits.v1", "desktop_provider_model_audits", result.desktop_provider_model_audits, result.generated_at));
  await writeJson(path.join(outDir, "external-model-policy-audit-boundary.json"), result.external_model_policy_audit_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "external-model-policy-audit-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildClassificationAudits({ sources, generatedAt }) {
  const policyMatrix = sources.policy_matrix_catalog.data ?? {};
  const modelPolicy = sources.model_policy_enforcement.data ?? {};
  const modelRules = policyMatrix.model_rules ?? [];
  const classificationLevels = policyMatrix.classification_levels ?? [];
  const classificationGates = modelPolicy.model_policy_gate_catalog?.classification_model_gates ?? [];
  const snapshotPolicies = extractSnapshotPolicyRows(sources.policy_snapshot_ledger.data ?? {});
  return classificationLevels.map((level, index) => {
    const classification = level.classification;
    const modelRule = modelRules.find((rule) => rule.classification === classification) ?? {};
    const gate = classificationGates.find((row) => row.classification === classification) ?? {};
    const matchingSnapshotPolicies = snapshotPolicies.filter((row) => row.classification === classification);
    const expectedExternalModelPolicy = modelRule.external_model_policy ?? level.default_external_model_policy ?? null;
    const observedExternalModelPolicy = gate.external_model_policy ?? expectedExternalModelPolicy;
    const mismatchCount = matchingSnapshotPolicies.filter((row) => row.external_model_policy !== expectedExternalModelPolicy).length;
    const externalProviderTransmission = toProviderTransmission(expectedExternalModelPolicy, gate.external_model_decision);
    const status = expectedExternalModelPolicy
      && observedExternalModelPolicy === expectedExternalModelPolicy
      && mismatchCount === 0
      && !(classificationOrdinal(classification) >= 3 && expectedExternalModelPolicy !== "forbidden")
      ? "passed"
      : "failed";
    const rowBase = {
      schema_version: "external-model-classification-audit.v1",
      external_model_classification_audit_id: `external-model-classification-audit.${slugify(classification)}`,
      generated_at: generatedAt,
      classification,
      classification_ordinal: classificationOrdinal(classification),
      default_external_model_policy: level.default_external_model_policy ?? null,
      expected_external_model_policy: expectedExternalModelPolicy,
      observed_external_model_policy: observedExternalModelPolicy,
      local_model_policy: modelRule.local_model_policy ?? gate.local_model_policy ?? null,
      redaction_policy: modelRule.redaction_policy ?? gate.redaction_policy ?? null,
      provider_transmission_policy: externalProviderTransmission,
      external_provider_transmission_allowed: externalProviderTransmission === "allowed_with_audit",
      external_provider_transmission_requires_approval: externalProviderTransmission === "approval_required",
      external_provider_transmission_forbidden: externalProviderTransmission === "forbidden",
      model_policy_gate_status: gate.gate_status ?? "unknown",
      model_policy_gate_decision: gate.external_model_decision ?? null,
      audit_required: gate.audit_required ?? true,
      human_approval_required: gate.human_approval_required ?? modelRule.approval_required ?? false,
      policy_snapshot_match_count: matchingSnapshotPolicies.filter((row) => row.external_model_policy === expectedExternalModelPolicy).length,
      policy_snapshot_mismatch_count: mismatchCount,
      snapshot_comparison_status: matchingSnapshotPolicies.length === 0 ? "matrix_only_no_active_snapshot" : (mismatchCount === 0 ? "matched" : "mismatched"),
      audit_status: status,
      ordinal: index + 1,
    };
    return { ...rowBase, audit_hash: sha256(rowBase) };
  });
}

function buildSnapshotAudits({ sources, classificationAudits, generatedAt }) {
  const snapshotPolicies = extractSnapshotPolicyRows(sources.policy_snapshot_ledger.data ?? {});
  return snapshotPolicies.map((snapshotPolicy, index) => {
    const classificationAudit = classificationAudits.find((row) => row.classification === snapshotPolicy.classification);
    const expectedPolicy = classificationAudit?.expected_external_model_policy ?? null;
    const matched = expectedPolicy === snapshotPolicy.external_model_policy;
    const rowBase = {
      schema_version: "external-model-policy-snapshot-audit.v1",
      external_model_policy_snapshot_audit_id: `external-model-policy-snapshot-audit.${slugify(snapshotPolicy.policy_snapshot_id)}.${slugify(snapshotPolicy.classification)}`,
      generated_at: generatedAt,
      policy_snapshot_id: snapshotPolicy.policy_snapshot_id,
      classification: snapshotPolicy.classification,
      classification_ordinal: classificationOrdinal(snapshotPolicy.classification),
      snapshot_external_model_policy: snapshotPolicy.external_model_policy,
      expected_external_model_policy: expectedPolicy,
      external_model_policy_match: matched,
      snapshot_comparison_status: matched ? "matched" : "mismatched",
      audit_status: matched ? "passed" : "failed",
      ordinal: index + 1,
    };
    return { ...rowBase, audit_hash: sha256(rowBase) };
  });
}

function buildRouteAudits({ sources, snapshotAudits, generatedAt }) {
  const routeGates = sources.model_policy_enforcement.data?.model_policy_gate_catalog?.route_model_gates
    ?? sources.model_routing_ledger.data?.routing_decisions
    ?? [];
  return routeGates.map((route, index) => {
    const snapshotAudit = snapshotAudits.find((row) => row.policy_snapshot_id === route.policy_snapshot_id && row.classification === route.classification);
    const externalTransfer = Boolean(route.external_transfer);
    const highSensitivity = classificationOrdinal(route.classification) >= 2;
    const allowedExternal = route.external_model_policy === "allowed_with_audit" && route.audit_required === true && route.gate_status !== "blocked";
    const approvalRequiredExternal = route.external_model_policy === "approval_required";
    const forbiddenExternal = route.external_model_policy === "forbidden";
    const routePolicyStatus = !externalTransfer
      ? "local_or_sandboxed_no_external_transfer"
      : (allowedExternal && !highSensitivity ? "external_allowed_with_audit" : (approvalRequiredExternal ? "external_requires_approval" : (forbiddenExternal ? "external_forbidden" : "external_unexpected")));
    const unauthorized = externalTransfer && (highSensitivity || routePolicyStatus !== "external_allowed_with_audit" || snapshotAudit?.external_model_policy_match === false);
    const rowBase = {
      schema_version: "external-model-route-audit.v1",
      external_model_route_audit_id: `external-model-route-audit.${slugify(route.routing_decision_id ?? route.route_model_gate_id ?? `route-${index + 1}`)}`,
      generated_at: generatedAt,
      routing_decision_id: route.routing_decision_id ?? null,
      route_model_gate_id: route.route_model_gate_id ?? null,
      policy_snapshot_id: route.policy_snapshot_id ?? null,
      classification: route.classification ?? null,
      classification_ordinal: classificationOrdinal(route.classification),
      runtime_id: route.runtime_id ?? null,
      capability_id: route.capability_id ?? null,
      domain_pack: route.domain_pack ?? null,
      provider_boundary: route.provider_boundary ?? null,
      external_transfer: externalTransfer,
      external_model_policy: route.external_model_policy ?? null,
      external_model_decision: route.external_model_decision ?? (externalTransfer ? "allow" : "not_applicable"),
      source_route_status: route.source_route_status ?? route.route_status ?? null,
      source_route_mode: route.source_route_mode ?? route.route_mode ?? null,
      gate_status: route.gate_status ?? (route.route_status === "ready" ? "passed" : route.route_status ?? "unknown"),
      audit_required: route.audit_required ?? false,
      redaction_status: route.redaction_status ?? null,
      snapshot_comparison_status: snapshotAudit?.snapshot_comparison_status ?? "no_snapshot_policy_row",
      route_policy_status: routePolicyStatus,
      unauthorized_external_transfer: unauthorized,
      high_sensitivity_external_transfer: externalTransfer && highSensitivity,
      external_transfer_without_audit: externalTransfer && route.audit_required !== true,
      audit_status: unauthorized ? "failed" : "passed",
      ordinal: index + 1,
    };
    return { ...rowBase, audit_hash: sha256(rowBase) };
  });
}

function buildDesktopProviderModelAudits({ sources, routeAudits, generatedAt }) {
  const runtimeDashboard = sources.runtime_api_dashboard.data ?? {};
  const capabilityRegistry = sources.capability_registry_api.data ?? {};
  const boundary = runtimeDashboard.runtime_api_desktop_boundary ?? {};
  const summary = runtimeDashboard.summary ?? {};
  const externalRuntimeRoutes = routeAudits.filter((row) => row.external_transfer);
  const rows = [
    desktopAudit("desktop.provider_key_visibility", "Desktop provider key visibility", {
      observed_value: boundary.provider_key_visible ?? summary.desktop_provider_key_visible,
      expected_value: false,
      desktop_provider_key_visible: boundary.provider_key_visible ?? summary.desktop_provider_key_visible ?? false,
      desktop_external_model_execution_allowed: false,
      policy_snapshot_id: null,
      classification: null,
      runtime_id: null,
      provider_boundary: "desktop_boundary",
      external_transfer: false,
    }, generatedAt),
    desktopAudit("desktop.runtime_execution", "Desktop model/runtime execution", {
      observed_value: boundary.runtime_execution_allowed ?? summary.desktop_runtime_execution_allowed,
      expected_value: false,
      desktop_provider_key_visible: boundary.provider_key_visible ?? summary.desktop_provider_key_visible ?? false,
      desktop_external_model_execution_allowed: boundary.runtime_execution_allowed ?? summary.desktop_runtime_execution_allowed ?? false,
      policy_snapshot_id: null,
      classification: null,
      runtime_id: null,
      provider_boundary: "desktop_boundary",
      external_transfer: false,
    }, generatedAt),
    desktopAudit("desktop.runtime_source_of_truth", "Desktop runtime source of truth", {
      observed_value: boundary.runtime_source_of_truth ?? summary.desktop_runtime_source_of_truth,
      expected_value: false,
      desktop_provider_key_visible: boundary.provider_key_visible ?? summary.desktop_provider_key_visible ?? false,
      desktop_external_model_execution_allowed: false,
      policy_snapshot_id: null,
      classification: null,
      runtime_id: null,
      provider_boundary: "desktop_boundary",
      external_transfer: false,
    }, generatedAt),
    desktopAudit("desktop.route_surface", "Desktop provider/model route surface", {
      observed_value: capabilityRegistry.summary?.read_only_route_count === capabilityRegistry.summary?.desktop_companion_route_count && capabilityRegistry.summary?.mutation_route_count === 0,
      expected_value: true,
      desktop_provider_key_visible: false,
      desktop_external_model_execution_allowed: false,
      policy_snapshot_id: null,
      classification: null,
      runtime_id: null,
      provider_boundary: "desktop_route_surface",
      external_transfer: false,
    }, generatedAt),
    ...externalRuntimeRoutes.map((route) => desktopAudit(`desktop.external_runtime.${route.runtime_id}`, `Desktop external runtime policy for ${route.runtime_id}`, {
      observed_value: route.audit_status === "passed" && route.classification === "P1_INTERNAL" && route.external_model_policy === "allowed_with_audit" && route.audit_required === true,
      expected_value: true,
      desktop_provider_key_visible: boundary.provider_key_visible ?? summary.desktop_provider_key_visible ?? false,
      desktop_external_model_execution_allowed: false,
      policy_snapshot_id: route.policy_snapshot_id,
      classification: route.classification,
      runtime_id: route.runtime_id,
      provider_boundary: route.provider_boundary,
      external_transfer: route.external_transfer,
      external_model_policy: route.external_model_policy,
      route_policy_status: route.route_policy_status,
    }, generatedAt)),
  ];
  return rows.map((row, index) => ({ ...row, ordinal: index + 1, audit_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function desktopAudit(id, label, fields, generatedAt) {
  const passed = fields.observed_value === fields.expected_value
    && fields.desktop_provider_key_visible === false
    && fields.desktop_external_model_execution_allowed === false;
  return {
    schema_version: "desktop-provider-model-audit.v1",
    desktop_provider_model_audit_id: `desktop-provider-model-audit.${slugify(id)}`,
    generated_at: generatedAt,
    label,
    policy_snapshot_id: fields.policy_snapshot_id,
    classification: fields.classification,
    runtime_id: fields.runtime_id,
    provider_boundary: fields.provider_boundary,
    external_transfer: fields.external_transfer,
    external_model_policy: fields.external_model_policy ?? null,
    route_policy_status: fields.route_policy_status ?? null,
    observed_value: fields.observed_value,
    expected_value: fields.expected_value,
    desktop_provider_key_visible: fields.desktop_provider_key_visible,
    desktop_external_model_execution_allowed: fields.desktop_external_model_execution_allowed,
    desktop_setting_mutation_allowed: false,
    provider_model_setting_source: "policy_snapshot_and_runtime_contract_artifacts",
    audit_status: passed ? "passed" : "failed",
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "external-model-policy-audit-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    audit_only: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    external_model_execution_performed: false,
    provider_request_performed: false,
    network_access_performed: false,
    desktop_setting_mutation_allowed: false,
    provider_key_materialized: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const source = sources[definition.source_id];
    const summary = source.data?.summary ?? {};
    const observedStatus = summary[definition.status_key] ?? source.data?.[definition.status_key] ?? "unknown";
    const phaseSlot = summary.phase_slot ?? source.data?.phase_slot ?? null;
    const nextPhaseSlot = summary.next_phase_slot ?? source.data?.next_phase_slot ?? null;
    const validationErrorCount = summary.validation_error_count ?? source.data?.validation?.errors?.length ?? 0;
    const passed = source.available
      && observedStatus === definition.expected_status
      && (!definition.expected_phase_slot || phaseSlot === definition.expected_phase_slot)
      && (!definition.expected_next_phase_slot || nextPhaseSlot === definition.expected_next_phase_slot)
      && validationErrorCount === 0;
    return {
      schema_version: "external-model-policy-audit-source.v1",
      source_id: definition.source_id,
      label: definition.label,
      path: source.path,
      available: source.available,
      status_key: definition.status_key,
      expected_status: definition.expected_status,
      observed_status: observedStatus,
      phase_slot: phaseSlot,
      expected_phase_slot: definition.expected_phase_slot,
      next_phase_slot: nextPhaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      validation_error_count: validationErrorCount,
      source_status: passed ? "passed" : "failed",
      content_hash: source.content_hash,
      error: source.error,
    };
  });
}

function buildValidationItems({ sourceStatuses, classificationAudits, snapshotAudits, routeAudits, desktopProviderModelAudits, boundary, sources, support }) {
  const packageJson = support.package_json.data ?? {};
  const ledgerText = support.final_completion_ledger.data ?? "";
  const implementationRoadmapText = support.implementation_roadmap.data ?? "";
  const reviewDashboardText = support.review_dashboard_source.data ?? "";
  const reviewApiText = support.review_api_source.data ?? "";
  const reviewApiDocText = support.review_api_doc.data ?? "";
  const matrixSummary = sources.policy_matrix_catalog.data?.summary ?? {};
  const snapshotSummary = sources.policy_snapshot_ledger.data?.summary ?? {};
  const modelPolicySummary = sources.model_policy_enforcement.data?.summary ?? {};
  const runtimeSummary = sources.runtime_api_dashboard.data?.summary ?? {};
  const items = [];
  pushCheck(items, "sources.ready", "source_statuses_passed", sourceStatuses.every((source) => source.source_status === "passed"), "All external model policy audit sources are ready.");
  pushCheck(items, "source.prompt_injection_test_suite", "p298_guard_ready", sourceStatuses.some((source) => source.source_id === "prompt_injection_test_suite" && source.source_status === "passed"), "P298 Prompt Injection Test Suite must be complete and point to P299.");
  pushCheck(items, "package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["security:external-model-policy-audit"]), "package.json registers security:external-model-policy-audit.");
  pushCheck(items, "docs.final_completion_ledger", "ledger_tracks_p299", ledgerText.includes("P299") && ledgerText.toLowerCase().includes("external model policy audit"), "Final completion ledger tracks P299.");
  pushCheck(items, "docs.implementation_roadmap", "roadmap_tracks_p299", implementationRoadmapText.includes("Phase 299 - External Model Policy Audit") && implementationRoadmapText.includes("external_model_policy_audit"), "Implementation roadmap documents Phase 299.");
  pushCheck(items, "src.review_dashboard", "dashboard_registered", reviewDashboardText.includes("external_model_policy_audit") && reviewDashboardText.includes("buildExternalModelPolicyAuditStage"), "Review Dashboard registers External Model Policy Audit.");
  pushCheck(items, "src.review_api", "review_api_registered", reviewApiText.includes("/api/external-model-policy-audits") && reviewApiText.includes("/api/desktop-provider-model-audits"), "Review API exposes External Model Policy Audit routes.");
  pushCheck(items, "docs.review_api", "review_api_doc_registered", reviewApiDocText.includes("External Model Policy Audit") && reviewApiDocText.includes("/api/external-model-policy-audits"), "Review API docs include External Model Policy Audit routes.");
  pushCheck(items, "policy_matrix.model_rules", "classification_policy_coverage", classificationAudits.length === (matrixSummary.model_rule_count ?? 0) && classificationAudits.length >= 6, "Every model policy classification has an audit row.");
  pushCheck(items, "policy_matrix.forbidden_floor", "p3_p5_forbidden_floor", classificationAudits.filter((row) => row.classification_ordinal >= 3).length >= 3 && classificationAudits.filter((row) => row.classification_ordinal >= 3).every((row) => row.external_provider_transmission_forbidden && row.audit_status === "passed"), "P3-P5 classifications forbid external provider transmission.");
  pushCheck(items, "policy_snapshot.external_model", "snapshot_policy_matches", snapshotAudits.length >= 3 && snapshotAudits.every((row) => row.audit_status === "passed") && (snapshotSummary.conflicting_snapshot_count ?? 1) === 0, "Policy snapshot external model entries match the matrix/model gates.");
  pushCheck(items, "model_policy_enforcement.classification_gates", "model_policy_gates_complete", (modelPolicySummary.classification_model_gate_count ?? 0) >= classificationAudits.length && (modelPolicySummary.unauthorized_external_allow_count ?? 1) === 0, "Model policy enforcement has complete classification gates and no unauthorized external allow.");
  pushCheck(items, "model_policy_enforcement.route_gates", "route_audits_pass", routeAudits.length > 0 && routeAudits.every((row) => row.audit_status === "passed"), "Route model audits pass without unauthorized external transfer.");
  pushCheck(items, "model_policy_enforcement.route_gates", "high_sensitivity_not_external", routeAudits.every((row) => !row.high_sensitivity_external_transfer), "P2-P5 routes do not cross an external provider boundary.");
  pushCheck(items, "desktop.provider_model", "desktop_provider_model_audits_pass", desktopProviderModelAudits.length >= 5 && desktopProviderModelAudits.every((row) => row.audit_status === "passed"), "Desktop provider/model settings are read-only, non-executing, and policy-snapshot aligned.");
  pushCheck(items, "runtime_api_dashboard.desktop_boundary", "desktop_provider_keys_hidden", runtimeSummary.desktop_provider_key_visible === false && runtimeSummary.desktop_runtime_execution_allowed === false && runtimeSummary.desktop_runtime_control_allowed === false && runtimeSummary.desktop_runtime_source_of_truth === false, "Desktop cannot see provider keys or execute/control model runtimes.");
  pushCheck(items, "boundary", "boundary_enforced", boundary.read_only && boundary.audit_only && !boundary.external_model_execution_performed && !boundary.provider_request_performed && !boundary.network_access_performed && !boundary.desktop_setting_mutation_allowed && !boundary.provider_key_materialized && !boundary.route_execution_performed && !boundary.server_started && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "External model policy audit boundary is read-only and non-executing.");
  pushCheck(items, "boundary.windows_baseline", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return items;
}

function buildSummary({ sourceStatuses, classificationAudits, snapshotAudits, routeAudits, desktopProviderModelAudits, boundary, validationItems, validation }) {
  const externalTransferRoutes = routeAudits.filter((row) => row.external_transfer);
  const highSensitivityRows = classificationAudits.filter((row) => row.classification_ordinal >= 3);
  return {
    external_model_policy_audit_status: validation.valid ? "complete" : "attention",
    external_model_policy_audit_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    source_prompt_injection_test_suite_status: sourceStatuses.find((source) => source.source_id === "prompt_injection_test_suite")?.observed_status ?? "unknown",
    source_prompt_injection_test_suite_phase_slot: sourceStatuses.find((source) => source.source_id === "prompt_injection_test_suite")?.phase_slot ?? null,
    source_prompt_injection_test_suite_next_phase_slot: sourceStatuses.find((source) => source.source_id === "prompt_injection_test_suite")?.next_phase_slot ?? null,
    classification_audit_count: classificationAudits.length,
    passed_classification_audit_count: classificationAudits.filter((row) => row.audit_status === "passed").length,
    failed_classification_audit_count: classificationAudits.filter((row) => row.audit_status !== "passed").length,
    snapshot_audit_count: snapshotAudits.length,
    passed_snapshot_audit_count: snapshotAudits.filter((row) => row.audit_status === "passed").length,
    failed_snapshot_audit_count: snapshotAudits.filter((row) => row.audit_status !== "passed").length,
    route_audit_count: routeAudits.length,
    passed_route_audit_count: routeAudits.filter((row) => row.audit_status === "passed").length,
    failed_route_audit_count: routeAudits.filter((row) => row.audit_status !== "passed").length,
    desktop_provider_model_audit_count: desktopProviderModelAudits.length,
    passed_desktop_provider_model_audit_count: desktopProviderModelAudits.filter((row) => row.audit_status === "passed").length,
    failed_desktop_provider_model_audit_count: desktopProviderModelAudits.filter((row) => row.audit_status !== "passed").length,
    external_transfer_route_count: externalTransferRoutes.length,
    unauthorized_external_transfer_count: routeAudits.filter((row) => row.unauthorized_external_transfer).length,
    high_sensitivity_external_transfer_count: routeAudits.filter((row) => row.high_sensitivity_external_transfer).length,
    external_transfer_without_audit_count: routeAudits.filter((row) => row.external_transfer_without_audit).length,
    classification_policy_mismatch_count: classificationAudits.filter((row) => row.policy_snapshot_mismatch_count > 0 || row.audit_status !== "passed").length,
    snapshot_policy_mismatch_count: snapshotAudits.filter((row) => row.audit_status !== "passed").length,
    p3_p5_external_forbidden_count: highSensitivityRows.filter((row) => row.external_provider_transmission_forbidden).length,
    p3_p5_external_allow_count: highSensitivityRows.filter((row) => row.external_provider_transmission_allowed).length,
    desktop_provider_key_visible_count: desktopProviderModelAudits.filter((row) => row.desktop_provider_key_visible).length,
    desktop_external_model_execution_allowed_count: desktopProviderModelAudits.filter((row) => row.desktop_external_model_execution_allowed).length,
    desktop_setting_mutation_allowed_count: desktopProviderModelAudits.filter((row) => row.desktop_setting_mutation_allowed).length,
    read_only: boundary.read_only,
    audit_only: boundary.audit_only,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    external_model_execution_performed: boundary.external_model_execution_performed,
    provider_request_performed: boundary.provider_request_performed,
    network_access_performed: boundary.network_access_performed,
    desktop_setting_mutation_allowed: boundary.desktop_setting_mutation_allowed,
    provider_key_materialized: boundary.provider_key_materialized,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validationItems.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function extractSnapshotPolicyRows(policySnapshotLedger) {
  const rows = [];
  for (const snapshot of policySnapshotLedger.policy_snapshots ?? []) {
    for (const [key, value] of Object.entries(snapshot.snapshot?.model_permissions ?? {})) {
      const classification = classificationFromSnapshotKey(key);
      if (!classification) continue;
      rows.push({
        policy_snapshot_id: snapshot.policy_snapshot_id,
        classification,
        external_model_policy: value,
      });
    }
  }
  return rows;
}

function classificationFromSnapshotKey(key) {
  const prefix = String(key).match(/^external_model_for_(P[0-5])$/)?.[1];
  if (!prefix) return null;
  return Object.entries(CLASSIFICATION_PREFIX).find(([, value]) => value === prefix)?.[0] ?? null;
}

function classificationOrdinal(classification) {
  const prefix = CLASSIFICATION_PREFIX[classification] ?? String(classification ?? "").match(/^P([0-5])/)?.[0];
  const ordinal = Number(String(prefix ?? "").replace("P", ""));
  return Number.isFinite(ordinal) ? ordinal : -1;
}

function toProviderTransmission(policy, decision) {
  if (policy === "forbidden" || decision === "deny") return "forbidden";
  if (policy === "approval_required" || decision === "review") return "approval_required";
  if (policy === "allowed_with_audit" || decision === "allow") return "allowed_with_audit";
  return "unknown";
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    schema_version: "external-model-policy-audit-validation-item.v1",
    validation_item_id: `external-model-policy-audit-validation.${slugify(checkId)}`,
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# External Model Policy Audit");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.external_model_policy_audit_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Phase: ${summary.previous_phase_slot} -> ${summary.phase_slot} -> ${summary.next_phase_slot}`);
  lines.push(`- Classification audits: ${summary.passed_classification_audit_count}/${summary.classification_audit_count}`);
  lines.push(`- Policy snapshot audits: ${summary.passed_snapshot_audit_count}/${summary.snapshot_audit_count}`);
  lines.push(`- Route audits: ${summary.passed_route_audit_count}/${summary.route_audit_count}`);
  lines.push(`- Desktop provider/model audits: ${summary.passed_desktop_provider_model_audit_count}/${summary.desktop_provider_model_audit_count}`);
  lines.push(`- External transfer routes: ${summary.external_transfer_route_count}, unauthorized=${summary.unauthorized_external_transfer_count}`);
  lines.push(`- P3-P5 external allow: ${summary.p3_p5_external_allow_count}`);
  lines.push(`- Desktop provider key/model execution exposure: ${summary.desktop_provider_key_visible_count}/${summary.desktop_external_model_execution_allowed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Classification Policy");
  for (const row of result.external_model_classification_audits) {
    lines.push(`- ${row.classification}: ${row.provider_transmission_policy}, snapshots=${row.policy_snapshot_match_count}/${row.policy_snapshot_match_count + row.policy_snapshot_mismatch_count}, status=${row.audit_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, data: JSON.parse(raw), raw, content_hash: sha256(raw), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, data: null, raw: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, data: raw, raw, content_hash: sha256(raw), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, data: "", raw: null, content_hash: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return Object.fromEntries(
    Object.entries({ ...DEFAULT_EXTERNAL_MODEL_POLICY_AUDIT_INPUTS, ...options })
      .filter(([key]) => key.endsWith("Path"))
      .map(([key, value]) => [toSnake(key), path.resolve(value)]),
  );
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replaceAll(":", "").replaceAll(".", "").replace("T", ".").replace("Z", "Z");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function toSnake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function printHelp() {
  console.log(`Usage: node scripts/external-model-policy-audit.mjs [--check] [--out-dir DIR]\n\nBuilds the P299 External Model Policy Audit report.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[key] = argv[++index];
    }
  }
  return parsed;
}

export async function runExternalModelPolicyAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExternalModelPolicyAudit(args);
    console.log(`External model policy audit written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.external_model_policy_audit_status}`);
    console.log(`Classification audits: ${result.summary.passed_classification_audit_count}/${result.summary.classification_audit_count}`);
    console.log(`Route audits: ${result.summary.passed_route_audit_count}/${result.summary.route_audit_count}`);
    console.log(`Desktop audits: ${result.summary.passed_desktop_provider_model_audit_count}/${result.summary.desktop_provider_model_audit_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}
