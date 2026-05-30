import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SECRETS_SCAN_GATE_OUT_DIR = "artifacts/secrets-scan-gate/latest";
export const DEFAULT_SECRETS_SCAN_GATE_INPUTS = {
  externalModelPolicyAuditPath: "artifacts/external-model-policy-audit/latest/external-model-policy-audit.json",
  secretsBrokerContractPath: "artifacts/secrets-broker/latest/secrets-broker-contract.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
  devProtectedScanPath: "artifacts/dev-protected-scan/latest/dev-protected-scan.json",
  connectorFreezePath: "artifacts/connector-freeze/latest/connector-freeze.json",
  connectorContractV2Path: "artifacts/connector-contract-v2/latest/connector-contract-v2.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  runtimeApiDashboardPath: "artifacts/runtime-api-dashboard/latest/runtime-api-dashboard.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "secrets-scan-gate.v1";
const CAPABILITY_ID = "security.secrets_scan_gate";
const PHASE_SLOT = "P300";
const PREVIOUS_PHASE_SLOT = "P299";
const NEXT_PHASE_SLOT = "P301";

const SOURCE_DEFINITIONS = [
  sourceDefinition("external_model_policy_audit", "External Model Policy Audit", "external_model_policy_audit_status", "complete", "P299", "P300"),
  sourceDefinition("secrets_broker_contract", "Secrets Broker Contract", "secrets_broker_contract_status", "complete", null, null),
  sourceDefinition("protected_file_gate", "Protected File Gate", "protected_file_gate_status", "complete", null, null),
  sourceDefinition("dev_protected_scan", "Dev Protected Scan", "dev_protected_scan_status", "complete", null, null),
  sourceDefinition("connector_freeze", "Connector Freeze", "connector_freeze_status", "complete", null, null),
  sourceDefinition("connector_contract_v2", "Connector Contract v2", "connector_contract_status", "complete", "P267", "P268"),
  sourceDefinition("expansion_quarantine_ledger", "Expansion Quarantine Ledger", "expansion_quarantine_ledger_status", "complete", "P280", "P281"),
  sourceDefinition("runtime_api_dashboard", "Runtime API Dashboard", "runtime_api_dashboard_status", "complete", null, null),
  sourceDefinition("capability_registry_api", "Capability Registry API", "capability_registry_api_status", "complete", null, null),
];

export async function runSecretsScanGate(options = {}) {
  const result = await buildSecretsScanGate(options);
  if (options.write !== false) await writeSecretsScanGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Secrets scan gate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSecretsScanGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SECRETS_SCAN_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    external_model_policy_audit: await readJsonSource(inputs.external_model_policy_audit_path),
    secrets_broker_contract: await readJsonSource(inputs.secrets_broker_contract_path),
    protected_file_gate: await readJsonSource(inputs.protected_file_gate_path),
    dev_protected_scan: await readJsonSource(inputs.dev_protected_scan_path),
    connector_freeze: await readJsonSource(inputs.connector_freeze_path),
    connector_contract_v2: await readJsonSource(inputs.connector_contract_v2_path),
    expansion_quarantine_ledger: await readJsonSource(inputs.expansion_quarantine_ledger_path),
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
  const ruleResults = buildRuleResults({ sources, generatedAt });
  const gateResults = buildGateResults({ sources, generatedAt });
  const desktopChecks = buildDesktopConfigLeakageChecks({ sources, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    ruleResults,
    gateResults,
    desktopChecks,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceStatuses,
    ruleResults,
    gateResults,
    desktopChecks,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    secrets_scan_gate_id: `secrets-scan-gate.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    secrets_scan_rule_results: ruleResults,
    secrets_scan_gate_results: gateResults,
    desktop_config_leakage_checks: desktopChecks,
    secrets_scan_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeSecretsScanGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "secrets-scan-gate.json"), serializable);
  await writeJson(path.join(outDir, "secrets-scan-source-statuses.json"), collectionEnvelope("secrets-scan-source-statuses.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "secrets-scan-rule-results.json"), collectionEnvelope("secrets-scan-rule-results.v1", "secrets_scan_rule_results", result.secrets_scan_rule_results, result.generated_at));
  await writeJson(path.join(outDir, "secrets-scan-gate-results.json"), collectionEnvelope("secrets-scan-gate-results.v1", "secrets_scan_gate_results", result.secrets_scan_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "desktop-config-leakage-checks.json"), collectionEnvelope("desktop-config-leakage-checks.v1", "desktop_config_leakage_checks", result.desktop_config_leakage_checks, result.generated_at));
  await writeJson(path.join(outDir, "secrets-scan-boundary.json"), result.secrets_scan_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "secrets-scan-gate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildRuleResults({ sources, generatedAt }) {
  const broker = summaryOf(sources.secrets_broker_contract.data);
  const protectedGate = summaryOf(sources.protected_file_gate.data);
  const devScan = summaryOf(sources.dev_protected_scan.data);
  const connectorFreeze = summaryOf(sources.connector_freeze.data);
  const connectorContract = summaryOf(sources.connector_contract_v2.data);
  const quarantine = summaryOf(sources.expansion_quarantine_ledger.data);
  const runtimeDashboard = summaryOf(sources.runtime_api_dashboard.data);
  const capabilityApi = summaryOf(sources.capability_registry_api.data);
  const externalModel = summaryOf(sources.external_model_policy_audit.data);
  const cursorContracts = sources.connector_contract_v2.data?.connector_cursor_contracts ?? [];
  const authBoundaries = sources.connector_contract_v2.data?.connector_auth_boundaries ?? [];
  const devSecretFindings = sources.dev_protected_scan.data?.dev_secret_findings ?? [];
  const devProdConfigFindings = sources.dev_protected_scan.data?.dev_prod_config_findings ?? [];

  return [
    ruleResult("secrets_broker.raw_secret_material_forbidden", "Secrets broker forbids raw secret material", "secrets_broker_contract", broker.raw_secret_material_allowed_count === 0 && broker.runtime_raw_secret_exposed_count === 0 && broker.raw_secret_material_logged_count === 0 && broker.raw_secret_material_persisted === false && broker.raw_secret_material_exposed_to_runtime === false && broker.raw_secret_material_exposed_to_desktop === false, {
      raw_secret_material_allowed_count: broker.raw_secret_material_allowed_count,
      runtime_raw_secret_exposed_count: broker.runtime_raw_secret_exposed_count,
      raw_secret_material_logged_count: broker.raw_secret_material_logged_count,
      raw_secret_material_persisted: broker.raw_secret_material_persisted,
      raw_secret_material_exposed_to_runtime: broker.raw_secret_material_exposed_to_runtime,
      raw_secret_material_exposed_to_desktop: broker.raw_secret_material_exposed_to_desktop,
    }, generatedAt),
    ruleResult("secrets_broker.provider_key_forbidden", "Secrets broker hides provider keys", "secrets_broker_contract", broker.provider_key_direct_access_allowed_count === 0 && broker.provider_key_visible_to_desktop_count === 0 && broker.provider_key_logged_count === 0 && broker.desktop_provider_key_visible === false, {
      provider_key_direct_access_allowed_count: broker.provider_key_direct_access_allowed_count,
      provider_key_visible_to_desktop_count: broker.provider_key_visible_to_desktop_count,
      provider_key_logged_count: broker.provider_key_logged_count,
      desktop_provider_key_visible: broker.desktop_provider_key_visible,
    }, generatedAt),
    ruleResult("protected_file_gate.secret_paths_blocked", "Protected file gate blocks secret and env paths before approval", "protected_file_gate", protectedGate.secret_rule_count >= 1 && protectedGate.secret_file_block_count >= 1 && protectedGate.direct_apply_allowed_count === 0 && protectedGate.direct_merge_allowed_count === 0 && protectedGate.protected_path_write_allowed_count === 0 && protectedGate.write_allowed_before_approval_count === 0, {
      secret_rule_count: protectedGate.secret_rule_count,
      secret_file_block_count: protectedGate.secret_file_block_count,
      direct_apply_allowed_count: protectedGate.direct_apply_allowed_count,
      direct_merge_allowed_count: protectedGate.direct_merge_allowed_count,
      protected_path_write_allowed_count: protectedGate.protected_path_write_allowed_count,
      write_allowed_before_approval_count: protectedGate.write_allowed_before_approval_count,
    }, generatedAt),
    ruleResult("dev_protected_scan.secret_candidates_blocked", "Dev protected scan blocks credential and secret candidates", "dev_protected_scan", devScan.credential_or_secret_candidate_count > 0 && devScan.credential_or_secret_change_blocked_count === devScan.credential_or_secret_candidate_count && devScan.secret_value_materialized_count === 0 && devScan.raw_secret_material_exposed === false && devScan.provider_key_exposed === false && devSecretFindings.every((item) => item.secret_finding_status === "blocked_pending_explicit_approval" && item.raw_secret_material_exposed === false && item.secret_value_materialized === false && item.provider_key_exposed === false), {
      credential_or_secret_candidate_count: devScan.credential_or_secret_candidate_count,
      credential_or_secret_change_blocked_count: devScan.credential_or_secret_change_blocked_count,
      dev_secret_finding_count: devSecretFindings.length,
      secret_value_materialized_count: devScan.secret_value_materialized_count,
      raw_secret_material_exposed: devScan.raw_secret_material_exposed,
      provider_key_exposed: devScan.provider_key_exposed,
    }, generatedAt),
    ruleResult("dev_protected_scan.production_config_candidates_blocked", "Dev protected scan blocks production and Desktop config candidates", "dev_protected_scan", devScan.production_config_candidate_count > 0 && devScan.production_config_change_blocked_count === devScan.production_config_candidate_count && devProdConfigFindings.every((item) => item.prod_config_finding_status === "blocked_pending_explicit_approval" && item.write_allowed_before_approval === false && item.mutation_allowed_before_approval === false), {
      production_config_candidate_count: devScan.production_config_candidate_count,
      production_config_change_blocked_count: devScan.production_config_change_blocked_count,
      dev_prod_config_finding_count: devProdConfigFindings.length,
      write_allowed_before_approval_count: devScan.write_allowed_before_approval_count,
      mutation_allowed_before_approval_count: devScan.mutation_allowed_before_approval_count,
    }, generatedAt),
    ruleResult("connectors.credential_reference_only", "Connectors use credential references only", "connector_freeze", connectorFreeze.credential_reference_only_connector_count === connectorFreeze.contracted_connector_count && connectorFreeze.credential_material_read_count === 0 && connectorFreeze.raw_secret_material_allowed_count === 0 && connectorContract.credential_reference_only_count === connectorContract.connector_count && connectorContract.raw_secret_material_allowed_count === 0 && authBoundaries.every((item) => item.credential_reference_only === true && item.raw_secret_material_allowed === false), {
      connector_freeze_credential_reference_only_connector_count: connectorFreeze.credential_reference_only_connector_count,
      connector_freeze_contracted_connector_count: connectorFreeze.contracted_connector_count,
      connector_freeze_credential_material_read_count: connectorFreeze.credential_material_read_count,
      connector_freeze_raw_secret_material_allowed_count: connectorFreeze.raw_secret_material_allowed_count,
      connector_contract_credential_reference_only_count: connectorContract.credential_reference_only_count,
      connector_contract_connector_count: connectorContract.connector_count,
      connector_contract_raw_secret_material_allowed_count: connectorContract.raw_secret_material_allowed_count,
    }, generatedAt),
    ruleResult("connectors.raw_token_material_forbidden", "Connector cursors forbid raw token material", "connector_contract_v2", cursorContracts.length > 0 && cursorContracts.every((item) => item.raw_token_material_allowed === false && item.resume_supported === true) && (connectorFreeze.raw_cursor_material_allowed_count ?? 0) === 0, {
      cursor_contract_count: cursorContracts.length,
      raw_token_material_allowed_count: cursorContracts.filter((item) => item.raw_token_material_allowed === true).length,
      raw_cursor_material_allowed_count: connectorFreeze.raw_cursor_material_allowed_count ?? 0,
    }, generatedAt),
    ruleResult("runtime_api.secret_surface_hidden", "Runtime API and Desktop surfaces expose no secret material", "runtime_api_dashboard", runtimeDashboard.secret_material_exposed_count === 0 && runtimeDashboard.desktop_secret_material_exposed === false && runtimeDashboard.desktop_provider_key_visible === false && runtimeDashboard.desktop_runtime_execution_allowed === false, {
      secret_material_exposed_count: runtimeDashboard.secret_material_exposed_count,
      desktop_secret_material_exposed: runtimeDashboard.desktop_secret_material_exposed,
      desktop_provider_key_visible: runtimeDashboard.desktop_provider_key_visible,
      desktop_runtime_execution_allowed: runtimeDashboard.desktop_runtime_execution_allowed,
    }, generatedAt),
    ruleResult("capability_registry.no_secret_material_routes", "Capability registry exposes no secret material routes", "capability_registry_api", capabilityApi.secret_material_route_count === 0 && capabilityApi.mutation_route_count === 0 && capabilityApi.installer_or_gateway_route_count === 0, {
      secret_material_route_count: capabilityApi.secret_material_route_count,
      mutation_route_count: capabilityApi.mutation_route_count,
      installer_or_gateway_route_count: capabilityApi.installer_or_gateway_route_count,
    }, generatedAt),
    ruleResult("resource_quarantine.no_secret_release", "Resource quarantine keeps sensitive/secret holds from auto release or transfer", "expansion_quarantine_ledger", quarantine.held_external_transfer_allowed_count === 0 && quarantine.held_output_delivery_allowed_count === 0 && quarantine.automatic_release_allowed_count === 0 && quarantine.file_content_read_performed === false, {
      sensitive_or_secret_hold_count: quarantine.sensitive_or_secret_hold_count,
      held_external_transfer_allowed_count: quarantine.held_external_transfer_allowed_count,
      held_output_delivery_allowed_count: quarantine.held_output_delivery_allowed_count,
      automatic_release_allowed_count: quarantine.automatic_release_allowed_count,
      file_content_read_performed: quarantine.file_content_read_performed,
    }, generatedAt),
    ruleResult("external_model.provider_key_materialization_blocked", "External model audit blocks provider key materialization", "external_model_policy_audit", externalModel.provider_key_materialized === false && externalModel.desktop_provider_key_visible_count === 0 && externalModel.desktop_setting_mutation_allowed_count === 0 && externalModel.provider_request_performed === false, {
      provider_key_materialized: externalModel.provider_key_materialized,
      desktop_provider_key_visible_count: externalModel.desktop_provider_key_visible_count,
      desktop_setting_mutation_allowed_count: externalModel.desktop_setting_mutation_allowed_count,
      provider_request_performed: externalModel.provider_request_performed,
    }, generatedAt),
  ].map((row, index) => ({ ...row, ordinal: index + 1, rule_result_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildGateResults({ sources, generatedAt }) {
  const broker = summaryOf(sources.secrets_broker_contract.data);
  const protectedGate = summaryOf(sources.protected_file_gate.data);
  const devScan = summaryOf(sources.dev_protected_scan.data);
  const connectorFreeze = summaryOf(sources.connector_freeze.data);
  const connectorContract = summaryOf(sources.connector_contract_v2.data);
  const quarantine = summaryOf(sources.expansion_quarantine_ledger.data);
  const runtimeDashboard = summaryOf(sources.runtime_api_dashboard.data);
  const capabilityApi = summaryOf(sources.capability_registry_api.data);
  const externalModel = summaryOf(sources.external_model_policy_audit.data);
  const cursorContracts = sources.connector_contract_v2.data?.connector_cursor_contracts ?? [];
  const secretFindings = sources.dev_protected_scan.data?.dev_secret_findings ?? [];
  const prodConfigFindings = sources.dev_protected_scan.data?.dev_prod_config_findings ?? [];

  const rawTokenAllowedCount = cursorContracts.filter((item) => item.raw_token_material_allowed === true).length + (connectorFreeze.raw_cursor_material_allowed_count ?? 0);
  const envFileLeakCount = secretFindings.filter((item) => item.secret_kind === "env_file" && (item.secret_finding_status !== "blocked_pending_explicit_approval" || item.raw_secret_material_exposed || item.secret_value_materialized || item.provider_key_exposed)).length;
  const prodConfigLeakCount = prodConfigFindings.filter((item) => item.prod_config_finding_status !== "blocked_pending_explicit_approval" || item.write_allowed_before_approval || item.mutation_allowed_before_approval).length;
  const providerKeyLeakCount = broker.provider_key_direct_access_allowed_count + broker.provider_key_visible_to_desktop_count + broker.provider_key_logged_count + externalModel.desktop_provider_key_visible_count + (externalModel.provider_key_materialized ? 1 : 0) + (runtimeDashboard.desktop_provider_key_visible ? 1 : 0) + (devScan.provider_key_exposed_count ?? 0);
  const credentialMaterialLeakCount = broker.raw_secret_material_allowed_count + broker.runtime_raw_secret_exposed_count + broker.raw_secret_material_logged_count + connectorFreeze.credential_material_read_count + connectorFreeze.raw_secret_material_allowed_count + connectorContract.raw_secret_material_allowed_count + devScan.secret_value_materialized_count + (devScan.raw_secret_material_exposed ? 1 : 0);
  const desktopConfigLeakCount = prodConfigLeakCount + (broker.desktop_secret_material_exposed_count ?? 0) + (runtimeDashboard.desktop_secret_material_exposed ? 1 : 0) + (devScan.desktop_secret_material_read_allowed ? 1 : 0);

  return [
    gateResult("credential_material", "Credential material leakage", credentialMaterialLeakCount, ["secrets_broker.raw_secret_material_forbidden", "connectors.credential_reference_only", "dev_protected_scan.secret_candidates_blocked"], generatedAt),
    gateResult("raw_token_material", "Raw token material leakage", rawTokenAllowedCount, ["connectors.raw_token_material_forbidden"], generatedAt),
    gateResult("env_file", "Environment file leakage", envFileLeakCount, ["protected_file_gate.secret_paths_blocked", "dev_protected_scan.secret_candidates_blocked"], generatedAt),
    gateResult("desktop_config", "Desktop and production config leakage", desktopConfigLeakCount, ["dev_protected_scan.production_config_candidates_blocked", "runtime_api.secret_surface_hidden"], generatedAt),
    gateResult("provider_api_key", "Provider API key leakage", providerKeyLeakCount, ["secrets_broker.provider_key_forbidden", "external_model.provider_key_materialization_blocked"], generatedAt),
    gateResult("desktop_provider_key", "Desktop provider key visibility", Number(runtimeDashboard.desktop_provider_key_visible === true) + Number(broker.desktop_provider_key_visible === true) + externalModel.desktop_provider_key_visible_count, ["secrets_broker.provider_key_forbidden", "runtime_api.secret_surface_hidden"], generatedAt),
    gateResult("protected_config_write", "Protected config write before approval", protectedGate.write_allowed_before_approval_count + protectedGate.mutation_allowed_before_approval_count + devScan.write_allowed_before_approval_count + devScan.mutation_allowed_before_approval_count, ["protected_file_gate.secret_paths_blocked", "dev_protected_scan.production_config_candidates_blocked"], generatedAt),
    gateResult("secret_external_transfer", "Secret-bearing external transfer or delivery", quarantine.held_external_transfer_allowed_count + quarantine.held_output_delivery_allowed_count + capabilityApi.secret_material_route_count + externalModel.unauthorized_external_transfer_count, ["resource_quarantine.no_secret_release", "capability_registry.no_secret_material_routes"], generatedAt),
  ].map((row, index) => ({ ...row, ordinal: index + 1, gate_result_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildDesktopConfigLeakageChecks({ sources, generatedAt }) {
  const broker = summaryOf(sources.secrets_broker_contract.data);
  const protectedGate = summaryOf(sources.protected_file_gate.data);
  const devScan = summaryOf(sources.dev_protected_scan.data);
  const runtimeDashboard = summaryOf(sources.runtime_api_dashboard.data);
  const capabilityApi = summaryOf(sources.capability_registry_api.data);
  const externalModel = summaryOf(sources.external_model_policy_audit.data);
  const checks = [
    desktopCheck("desktop.secret_material_visibility", "Desktop sees no secret material", broker.desktop_secret_material_exposed === false && runtimeDashboard.desktop_secret_material_exposed === false && devScan.desktop_secret_material_read_allowed === false, {
      secrets_broker_desktop_secret_material_exposed: broker.desktop_secret_material_exposed,
      runtime_api_desktop_secret_material_exposed: runtimeDashboard.desktop_secret_material_exposed,
      dev_scan_desktop_secret_material_read_allowed: devScan.desktop_secret_material_read_allowed,
    }, generatedAt),
    desktopCheck("desktop.provider_key_visibility", "Desktop sees no provider keys", broker.desktop_provider_key_visible === false && runtimeDashboard.desktop_provider_key_visible === false && externalModel.desktop_provider_key_visible_count === 0, {
      secrets_broker_desktop_provider_key_visible: broker.desktop_provider_key_visible,
      runtime_api_desktop_provider_key_visible: runtimeDashboard.desktop_provider_key_visible,
      external_model_desktop_provider_key_visible_count: externalModel.desktop_provider_key_visible_count,
    }, generatedAt),
    desktopCheck("desktop.config_mutation_boundary", "Desktop cannot mutate protected config or secret state", broker.desktop_mutation_allowed === false && protectedGate.desktop_mutation_allowed === false && runtimeDashboard.desktop_mutation_allowed === false && externalModel.desktop_setting_mutation_allowed === false, {
      secrets_broker_desktop_mutation_allowed: broker.desktop_mutation_allowed,
      protected_gate_desktop_mutation_allowed: protectedGate.desktop_mutation_allowed,
      runtime_api_desktop_mutation_allowed: runtimeDashboard.desktop_mutation_allowed,
      external_model_desktop_setting_mutation_allowed: externalModel.desktop_setting_mutation_allowed,
    }, generatedAt),
    desktopCheck("desktop.route_surface", "Desktop route surface remains read-only and has no secret material routes", capabilityApi.read_only_route_count === capabilityApi.desktop_companion_route_count && capabilityApi.mutation_route_count === 0 && capabilityApi.secret_material_route_count === 0, {
      read_only_route_count: capabilityApi.read_only_route_count,
      desktop_companion_route_count: capabilityApi.desktop_companion_route_count,
      mutation_route_count: capabilityApi.mutation_route_count,
      secret_material_route_count: capabilityApi.secret_material_route_count,
    }, generatedAt),
  ];
  return checks.map((row, index) => ({ ...row, ordinal: index + 1, check_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "secrets-scan-boundary.v1",
    secrets_scan_boundary_id: `secrets-scan-boundary.${dateStamp(generatedAt)}`,
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    scan_report_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    filesystem_secret_scan_performed: false,
    secret_material_read: false,
    secret_material_materialized: false,
    env_file_read: false,
    desktop_config_read: false,
    desktop_setting_mutation_allowed: false,
    provider_key_materialized: false,
    network_access_performed: false,
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
    const source = sources[definition.source_id] ?? {};
    const artifact = source.data ?? {};
    const summary = artifact.summary ?? {};
    const observedStatus = summary[definition.status_key] ?? artifact[definition.status_key] ?? "unknown";
    const phaseSlot = summary.phase_slot ?? artifact.phase_slot ?? null;
    const nextPhaseSlot = summary.next_phase_slot ?? artifact.next_phase_slot ?? null;
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const passed = source.available === true
      && observedStatus === definition.expected_status
      && validationErrorCount === 0
      && (definition.expected_phase_slot == null || phaseSlot === definition.expected_phase_slot)
      && (definition.expected_next_phase_slot == null || nextPhaseSlot === definition.expected_next_phase_slot);
    return {
      schema_version: "secrets-scan-source-status.v1",
      source_id: definition.source_id,
      label: definition.label,
      source_path: source.path ?? null,
      expected_status_key: definition.status_key,
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

function buildValidationItems({ sourceStatuses, ruleResults, gateResults, desktopChecks, boundary, sources, support }) {
  const packageJson = support.package_json.data ?? {};
  const ledgerText = support.final_completion_ledger.data ?? "";
  const implementationRoadmapText = support.implementation_roadmap.data ?? "";
  const reviewDashboardText = support.review_dashboard_source.data ?? "";
  const reviewApiText = support.review_api_source.data ?? "";
  const reviewApiDocText = support.review_api_doc.data ?? "";
  const externalModelSummary = summaryOf(sources.external_model_policy_audit.data);
  const brokerSummary = summaryOf(sources.secrets_broker_contract.data);
  const protectedGateSummary = summaryOf(sources.protected_file_gate.data);
  const devScanSummary = summaryOf(sources.dev_protected_scan.data);
  const items = [];
  pushCheck(items, "sources.ready", "source_statuses_passed", sourceStatuses.every((source) => source.source_status === "passed"), "All secrets scan gate source artifacts are ready.");
  pushCheck(items, "source.external_model_policy_audit", "p299_guard_ready", sourceStatuses.some((source) => source.source_id === "external_model_policy_audit" && source.source_status === "passed"), "P299 External Model Policy Audit must be complete and point to P300.");
  pushCheck(items, "package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["security:secrets-scan-gate"]), "package.json registers security:secrets-scan-gate.");
  pushCheck(items, "docs.final_completion_ledger", "ledger_tracks_p300", ledgerText.includes("P300") && ledgerText.toLowerCase().includes("secrets scan gate"), "Final completion ledger tracks P300.");
  pushCheck(items, "docs.implementation_roadmap", "roadmap_tracks_p300", implementationRoadmapText.includes("Phase 300 - Secrets Scan Gate") && implementationRoadmapText.includes("secrets_scan_gate"), "Implementation roadmap documents Phase 300.");
  pushCheck(items, "src.review_dashboard", "dashboard_registered", reviewDashboardText.includes("secrets_scan_gate") && reviewDashboardText.includes("buildSecretsScanGateStage"), "Review Dashboard registers Secrets Scan Gate.");
  pushCheck(items, "src.review_api", "review_api_registered", reviewApiText.includes("/api/secrets-scan-gates") && reviewApiText.includes("/api/desktop-config-leakage-checks"), "Review API exposes Secrets Scan Gate routes.");
  pushCheck(items, "docs.review_api", "review_api_doc_registered", reviewApiDocText.includes("Secrets Scan Gate") && reviewApiDocText.includes("/api/secrets-scan-gates"), "Review API docs include Secrets Scan Gate routes.");
  pushCheck(items, "rules", "rule_results_passed", ruleResults.length >= 10 && ruleResults.every((row) => row.rule_status === "passed"), "All secret/token/env/Desktop config leakage rules pass.");
  pushCheck(items, "gates", "gate_results_passed", gateResults.length >= 8 && gateResults.every((row) => row.gate_status === "passed" && row.gate_fail_on_leakage === true && row.leakage_allowed === false), "Every leakage category is configured to fail on leakage and has no observed leakage.");
  pushCheck(items, "desktop_config", "desktop_checks_passed", desktopChecks.length >= 4 && desktopChecks.every((row) => row.check_status === "passed"), "Desktop config leakage checks pass.");
  pushCheck(items, "secrets_broker_contract", "broker_forbids_secret_material", brokerSummary.raw_secret_material_allowed_count === 0 && brokerSummary.raw_secret_material_logged_count === 0 && brokerSummary.provider_key_direct_access_allowed_count === 0 && brokerSummary.desktop_secret_material_exposed === false && brokerSummary.desktop_provider_key_visible === false, "Secrets broker forbids raw secret material, provider keys, and Desktop exposure.");
  pushCheck(items, "protected_file_gate", "protected_secret_paths_blocked", protectedGateSummary.secret_rule_count >= 1 && protectedGateSummary.secret_file_block_count >= 1 && protectedGateSummary.write_allowed_before_approval_count === 0 && protectedGateSummary.mutation_allowed_before_approval_count === 0, "Protected file gate blocks secret/env paths before explicit approval.");
  pushCheck(items, "dev_protected_scan", "dev_scan_blocks_secret_and_config", devScanSummary.credential_or_secret_candidate_count > 0 && devScanSummary.credential_or_secret_change_blocked_count === devScanSummary.credential_or_secret_candidate_count && devScanSummary.production_config_change_blocked_count === devScanSummary.production_config_candidate_count && devScanSummary.secret_value_materialized_count === 0 && devScanSummary.raw_secret_material_exposed === false && devScanSummary.provider_key_exposed === false, "Dev protected scan blocks credential/env/provider config changes without materializing secret values.");
  pushCheck(items, "external_model_policy_audit", "provider_keys_not_materialized", externalModelSummary.provider_key_materialized === false && externalModelSummary.desktop_provider_key_visible_count === 0 && externalModelSummary.provider_request_performed === false, "P299 provider keys remain unmaterialized and hidden from Desktop.");
  pushCheck(items, "boundary", "boundary_enforced", boundary.read_only && boundary.scan_report_only && boundary.source_artifact_read_performed && !boundary.source_content_read_performed && !boundary.source_ingest_performed && !boundary.filesystem_secret_scan_performed && !boundary.secret_material_read && !boundary.secret_material_materialized && !boundary.env_file_read && !boundary.desktop_config_read && !boundary.desktop_setting_mutation_allowed && !boundary.provider_key_materialized && !boundary.network_access_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed && !boundary.delivery_execution_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Secrets scan gate is read-only, report-only, and does not read or materialize secret/config content.");
  pushCheck(items, "boundary.windows_baseline", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return items;
}

function buildSummary({ sourceStatuses, ruleResults, gateResults, desktopChecks, boundary, validationItems, validation }) {
  const countGate = (kind) => gateResults.filter((row) => row.leakage_kind === kind && row.leakage_detected).length;
  return {
    secrets_scan_gate_status: validation.valid ? "complete" : "attention",
    secrets_scan_gate_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    source_external_model_policy_audit_status: sourceStatuses.find((source) => source.source_id === "external_model_policy_audit")?.observed_status ?? "unknown",
    source_external_model_policy_audit_phase_slot: sourceStatuses.find((source) => source.source_id === "external_model_policy_audit")?.phase_slot ?? null,
    source_external_model_policy_audit_next_phase_slot: sourceStatuses.find((source) => source.source_id === "external_model_policy_audit")?.next_phase_slot ?? null,
    rule_result_count: ruleResults.length,
    passed_rule_result_count: ruleResults.filter((row) => row.rule_status === "passed").length,
    failed_rule_result_count: ruleResults.filter((row) => row.rule_status !== "passed").length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    desktop_config_leakage_check_count: desktopChecks.length,
    passed_desktop_config_leakage_check_count: desktopChecks.filter((row) => row.check_status === "passed").length,
    failed_desktop_config_leakage_check_count: desktopChecks.filter((row) => row.check_status !== "passed").length,
    gate_fail_on_leakage_count: gateResults.filter((row) => row.gate_fail_on_leakage === true).length,
    leakage_allowed_count: gateResults.filter((row) => row.leakage_allowed === true).length,
    credential_leakage_detected_count: countGate("credential_material"),
    token_leakage_detected_count: countGate("raw_token_material"),
    env_leakage_detected_count: countGate("env_file"),
    desktop_config_leakage_detected_count: countGate("desktop_config"),
    provider_key_leakage_detected_count: countGate("provider_api_key") + countGate("desktop_provider_key"),
    raw_secret_material_allowed_count: sumObserved(ruleResults, "raw_secret_material_allowed_count") + sumObserved(ruleResults, "connector_freeze_raw_secret_material_allowed_count") + sumObserved(ruleResults, "connector_contract_raw_secret_material_allowed_count"),
    raw_secret_material_exposed_count: sumObserved(ruleResults, "runtime_raw_secret_exposed_count") + Number(ruleResults.some((row) => row.observed.raw_secret_material_exposed === true)),
    raw_secret_material_logged_count: sumObserved(ruleResults, "raw_secret_material_logged_count"),
    provider_key_direct_access_allowed_count: sumObserved(ruleResults, "provider_key_direct_access_allowed_count"),
    provider_key_logged_count: sumObserved(ruleResults, "provider_key_logged_count"),
    desktop_secret_material_exposed_count: gateResults.filter((row) => row.leakage_kind === "desktop_config").reduce((total, row) => total + row.observed_leakage_count, 0),
    desktop_provider_key_visible_count: gateResults.filter((row) => row.leakage_kind === "desktop_provider_key").reduce((total, row) => total + row.observed_leakage_count, 0),
    secret_material_read_count: sumObserved(ruleResults, "connector_freeze_credential_material_read_count"),
    secret_material_materialized_count: sumObserved(ruleResults, "secret_value_materialized_count"),
    env_file_read_count: Number(boundary.env_file_read === true),
    desktop_config_read_count: Number(boundary.desktop_config_read === true),
    protected_write_allowed_count: sumObserved(ruleResults, "protected_path_write_allowed_count"),
    write_allowed_before_approval_count: sumObserved(ruleResults, "write_allowed_before_approval_count"),
    mutation_allowed_before_approval_count: sumObserved(ruleResults, "mutation_allowed_before_approval_count"),
    read_only: boundary.read_only,
    scan_report_only: boundary.scan_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    filesystem_secret_scan_performed: boundary.filesystem_secret_scan_performed,
    secret_material_read: boundary.secret_material_read,
    secret_material_materialized: boundary.secret_material_materialized,
    env_file_read: boundary.env_file_read,
    desktop_config_read: boundary.desktop_config_read,
    desktop_setting_mutation_allowed: boundary.desktop_setting_mutation_allowed,
    provider_key_materialized: boundary.provider_key_materialized,
    network_access_performed: boundary.network_access_performed,
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

function ruleResult(ruleId, label, sourceId, passed, observed, generatedAt) {
  return {
    schema_version: "secrets-scan-rule-result.v1",
    secrets_scan_rule_result_id: `secrets-scan-rule.${slugify(ruleId)}`,
    generated_at: generatedAt,
    rule_id: ruleId,
    label,
    source_id: sourceId,
    rule_status: passed ? "passed" : "failed",
    gate_fail_on_leakage: true,
    leakage_allowed: false,
    observed,
  };
}

function gateResult(kind, label, observedLeakageCount, sourceRuleIds, generatedAt) {
  return {
    schema_version: "secrets-scan-gate-result.v1",
    secrets_scan_gate_result_id: `secrets-scan-gate-result.${slugify(kind)}`,
    generated_at: generatedAt,
    leakage_kind: kind,
    label,
    source_rule_ids: sourceRuleIds,
    observed_leakage_count: observedLeakageCount,
    leakage_detected: observedLeakageCount > 0,
    gate_decision: "fail_on_leakage",
    gate_fail_on_leakage: true,
    leakage_allowed: false,
    protected_mutation_route: "protected_action_request_only",
    human_review_required: true,
    client_facing_ready: false,
    gate_status: observedLeakageCount === 0 ? "passed" : "failed",
  };
}

function desktopCheck(checkId, label, passed, observed, generatedAt) {
  return {
    schema_version: "desktop-config-leakage-check.v1",
    desktop_config_leakage_check_id: `desktop-config-leakage-check.${slugify(checkId)}`,
    generated_at: generatedAt,
    check_id: checkId,
    label,
    observed,
    leakage_detected: !passed,
    gate_fail_on_leakage: true,
    check_status: passed ? "passed" : "failed",
  };
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
    schema_version: "secrets-scan-gate-validation-item.v1",
    validation_item_id: `secrets-scan-gate-validation.${slugify(checkId)}`,
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Secrets Scan Gate");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.secrets_scan_gate_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Phase: ${summary.previous_phase_slot} -> ${summary.phase_slot} -> ${summary.next_phase_slot}`);
  lines.push(`- Sources: ${summary.passed_source_status_count}/${summary.source_status_count}`);
  lines.push(`- Rules: ${summary.passed_rule_result_count}/${summary.rule_result_count}`);
  lines.push(`- Leakage gates: ${summary.passed_gate_result_count}/${summary.gate_result_count}`);
  lines.push(`- Desktop config checks: ${summary.passed_desktop_config_leakage_check_count}/${summary.desktop_config_leakage_check_count}`);
  lines.push(`- Credential/token/env/Desktop/provider-key leakage detected: ${summary.credential_leakage_detected_count}/${summary.token_leakage_detected_count}/${summary.env_leakage_detected_count}/${summary.desktop_config_leakage_detected_count}/${summary.provider_key_leakage_detected_count}`);
  lines.push(`- Gate fail-on-leakage rows: ${summary.gate_fail_on_leakage_count}`);
  lines.push(`- Secret material read/materialized: ${summary.secret_material_read_count}/${summary.secret_material_materialized_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Gates");
  for (const row of result.secrets_scan_gate_results) {
    lines.push(`- ${row.leakage_kind}: ${row.gate_status}, observed=${row.observed_leakage_count}, decision=${row.gate_decision}`);
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

function summaryOf(artifact) {
  return artifact?.summary ?? {};
}

function sumObserved(rows, key) {
  return rows.reduce((total, row) => total + Number(row.observed?.[key] ?? 0), 0);
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
    Object.entries({ ...DEFAULT_SECRETS_SCAN_GATE_INPUTS, ...options })
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
  console.log(`Usage: node scripts/secrets-scan-gate.mjs [--check] [--out-dir DIR]\n\nBuilds the P300 Secrets Scan Gate report.`);
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

export async function runSecretsScanGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSecretsScanGate(args);
    console.log(`Secrets scan gate written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.secrets_scan_gate_status}`);
    console.log(`Rules: ${result.summary.passed_rule_result_count}/${result.summary.rule_result_count}`);
    console.log(`Gate results: ${result.summary.passed_gate_result_count}/${result.summary.gate_result_count}`);
    console.log(`Desktop config checks: ${result.summary.passed_desktop_config_leakage_check_count}/${result.summary.desktop_config_leakage_check_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}
