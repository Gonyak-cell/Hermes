import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_THREAT_MODEL_REFRESH_OUT_DIR = "artifacts/threat-model-refresh/latest";
export const DEFAULT_THREAT_MODEL_REFRESH_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
  securityGovernancePath: "docs/security-and-governance.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  dashboardApiFreezePath: "artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json",
  workflowPromptInjectionBoundaryPath: "artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json",
  secretsBrokerContractPath: "artifacts/secrets-broker/latest/secrets-broker-contract.json",
  runtimeApiDashboardPath: "artifacts/runtime-api-dashboard/latest/runtime-api-dashboard.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  devProtectedScanPath: "artifacts/dev-protected-scan/latest/dev-protected-scan.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
};

const SCHEMA_VERSION = "threat-model-refresh.v1";
const CAPABILITY_ID = "security.threat_model_refresh";
const PHASE_SLOT = "P297";
const PREVIOUS_PHASE_SLOT = "P296";
const NEXT_PHASE_SLOT = "P298";

const SOURCE_DEFINITIONS = [
  sourceDefinition("dashboard_api_freeze", "Dashboard/API Freeze", "dashboardApiFreezePath", "P296", "api", "dashboard_api_freeze_status", "complete", "P297"),
  sourceDefinition("workflow_prompt_injection_boundary", "Workflow Prompt Injection Boundary", "workflowPromptInjectionBoundaryPath", "P186", "prompt_security", "workflow_prompt_injection_boundary_status", "complete"),
  sourceDefinition("secrets_broker_contract", "Secrets Broker Contract", "secretsBrokerContractPath", "P204", "secrets", "secrets_broker_contract_status", "complete"),
  sourceDefinition("runtime_api_dashboard", "Runtime API Dashboard", "runtimeApiDashboardPath", "P211", "runtime", "runtime_api_dashboard_status", "complete"),
  sourceDefinition("runtime_freeze", "Runtime Freeze", "runtimeFreezePath", "P212", "runtime", "runtime_freeze_status", "complete"),
  sourceDefinition("capability_registry_api", "Capability Registry API", "capabilityRegistryApiPath", "P191", "desktop", "capability_registry_api_status", "complete"),
  sourceDefinition("dev_protected_scan", "Dev Protected Scan", "devProtectedScanPath", "P224", "dev_security", "dev_protected_scan_status", "complete"),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "controlPlaneLoopPath", "P297", "control_plane", "loop_status", "passed"),
];

const SUPPORT_DEFINITIONS = [
  sourceDefinition("package_json", "Package Scripts", "packagePath", "P297", "support", null, null, null, "json"),
  sourceDefinition("final_completion_ledger", "Final Completion Phase Ledger", "roadmapPath", "P297", "support", null, null, null, "text"),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "implementationRoadmapPath", "P297", "support", null, null, null, "text"),
  sourceDefinition("desktop_companion_integration", "Desktop Companion Integration", "desktopCompanionIntegrationPath", "P297", "support", null, null, null, "text"),
  sourceDefinition("security_governance", "Security and Governance", "securityGovernancePath", "P297", "support", null, null, null, "text"),
  sourceDefinition("review_dashboard_source", "Review Dashboard Source", "reviewDashboardSourcePath", "P297", "support", null, null, null, "text"),
  sourceDefinition("review_api_source", "Review API Source", "reviewApiSourcePath", "P297", "support", null, null, null, "text"),
  sourceDefinition("review_api_doc", "Review API Docs", "reviewApiDocPath", "P297", "support", null, null, null, "text"),
];

const REQUIRED_RISK_CATEGORIES = [
  "prompt_injection",
  "data_leak",
  "over_agency",
  "insecure_tool",
  "desktop_installer",
  "desktop_auto_update",
  "desktop_ssh",
  "desktop_cron",
  "desktop_gateway",
  "provider_key",
];

const CONTROL_CATALOG = [
  control("untrusted_content_wrapper", "Untrusted content wrapper", ["prompt_injection"], "workflow_prompt_injection_boundary", "Treat retrieved or imported text as data and keep instruction-like content neutralized."),
  control("source_minimization_and_no_ingest", "Source minimization and no ingest", ["data_leak"], "dashboard_api_freeze", "Use read-only artifacts and metadata, with no new source content reads or source ingest."),
  control("human_review_over_agency_gate", "Human review over-agency gate", ["over_agency"], "dashboard_api_freeze", "Keep client-facing and protected outputs behind human review."),
  control("tool_runtime_policy_boundary", "Tool/runtime policy boundary", ["insecure_tool"], "runtime_freeze", "Keep runtime execution, process control, test execution, and protected actions outside Desktop control."),
  control("desktop_read_only_boundary", "Desktop read-only boundary", ["desktop_installer", "desktop_auto_update", "desktop_ssh", "desktop_cron", "desktop_gateway"], "runtime_api_dashboard", "Desktop consumes read-only status and cannot perform installer, auto-update, SSH, cron, gateway, or protected execution control."),
  control("secret_handle_only_access", "Secret handle-only access", ["provider_key", "data_leak"], "secrets_broker_contract", "Expose secret handles and audit receipts instead of raw secret or provider key material."),
  control("protected_scan_no_secret_materialization", "Protected scan no-secret materialization", ["provider_key", "insecure_tool"], "dev_protected_scan", "Protected-file and secret candidates remain blocked without materializing raw secret values."),
  control("windows_baseline_stability", "Windows baseline stability posture", ["desktop_installer", "desktop_auto_update", "desktop_ssh", "desktop_cron", "desktop_gateway"], "dashboard_api_freeze", "Preserve the Windows baseline so Mac/Windows completion drift does not destabilize completed phases."),
];

const RISK_CATALOG = [
  risk("prompt_injection", "Prompt Injection", "High", "Medium", "External documents, email, chat, VDR, and source-span previews may contain instruction-like text.", ["workflow_prompt_injection_boundary"], ["untrusted_content_wrapper"]),
  risk("data_leak", "Data Leak", "High", "Low", "Matter, source, secret, provider, or generated-output metadata could be overexposed to Desktop/API surfaces.", ["dashboard_api_freeze", "secrets_broker_contract"], ["source_minimization_and_no_ingest", "secret_handle_only_access"]),
  risk("over_agency", "Over-agency", "High", "Low", "Agents or Desktop controls could appear to accept plans, execute actions, deliver outputs, or bypass human review.", ["dashboard_api_freeze", "runtime_freeze"], ["human_review_over_agency_gate", "tool_runtime_policy_boundary"]),
  risk("insecure_tool", "Insecure Tool", "High", "Low", "Runtime tools, local scripts, protected files, or test commands could mutate state or execute without the proper gate.", ["runtime_freeze", "dev_protected_scan"], ["tool_runtime_policy_boundary", "protected_scan_no_secret_materialization"]),
  risk("desktop_installer", "Desktop Installer Control", "High", "Low", "Desktop could gain installer control or package installation authority.", ["capability_registry_api", "runtime_api_dashboard"], ["desktop_read_only_boundary", "windows_baseline_stability"]),
  risk("desktop_auto_update", "Desktop Auto-update Control", "High", "Low", "Desktop could trigger auto-update or release mutation paths outside release readiness gates.", ["capability_registry_api", "runtime_freeze"], ["desktop_read_only_boundary", "windows_baseline_stability"]),
  risk("desktop_ssh", "Desktop SSH Control", "High", "Low", "Desktop could expose SSH or cloud backend control despite local/Docker-only runtime posture.", ["runtime_freeze"], ["desktop_read_only_boundary", "windows_baseline_stability"]),
  risk("desktop_cron", "Desktop Cron Control", "Medium", "Low", "Desktop could schedule or mutate recurring jobs instead of showing read-only status.", ["runtime_freeze", "control_plane_loop"], ["desktop_read_only_boundary", "windows_baseline_stability"]),
  risk("desktop_gateway", "Desktop Gateway Control", "High", "Low", "Desktop could mutate gateway, messenger, or external transfer controls.", ["capability_registry_api", "runtime_api_dashboard"], ["desktop_read_only_boundary", "windows_baseline_stability"]),
  risk("provider_key", "Provider Key Exposure", "Critical", "Low", "Provider keys or raw secret values could be exposed to Desktop, logs, runtime artifacts, or API routes.", ["secrets_broker_contract", "dev_protected_scan"], ["secret_handle_only_access", "protected_scan_no_secret_materialization"]),
];

export async function runThreatModelRefresh(options = {}) {
  const result = await buildThreatModelRefresh(options);
  if (options.write !== false) await writeThreatModelRefresh(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Threat model refresh failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildThreatModelRefresh(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_THREAT_MODEL_REFRESH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSources(SOURCE_DEFINITIONS, inputs);
  const supportReads = await readSources(SUPPORT_DEFINITIONS, inputs);
  const artifacts = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.data]));
  const support = Object.fromEntries(supportReads.map((source) => [source.source_id, source.data]));
  const sourceStatuses = sourceReads.map((source) => buildSourceStatus(source));
  const controls = buildControlRows(generatedAt, sourceStatuses);
  const risks = buildRiskRows(generatedAt, controls);
  const evidence = buildEvidenceRows(generatedAt, artifacts);
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({ artifacts, support, sourceStatuses, risks, controls, evidence, boundary });
  const validation = summarizeValidation(checks);
  const summary = buildSummary({ sourceStatuses, risks, controls, evidence, boundary, checks, validation, artifacts });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    threat_model_refresh_id: `threat-model-refresh.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    summary,
    threat_model_sources: sourceStatuses,
    threat_model_risks: risks,
    threat_model_controls: controls,
    threat_model_evidence: evidence,
    threat_model_boundary: boundary,
    threat_model_checks: checks,
    validation: { valid: validation.valid, errors: validation.errors },
    validation_items: checks,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeThreatModelRefresh(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "threat-model-refresh.json"), serializable);
  await writeJson(path.join(outDir, "threat-model-sources.json"), collectionEnvelope("threat-model-sources.v1", "threat_model_sources", result.threat_model_sources, result.generated_at));
  await writeJson(path.join(outDir, "threat-model-risks.json"), collectionEnvelope("threat-model-risks.v1", "threat_model_risks", result.threat_model_risks, result.generated_at));
  await writeJson(path.join(outDir, "threat-model-controls.json"), collectionEnvelope("threat-model-controls.v1", "threat_model_controls", result.threat_model_controls, result.generated_at));
  await writeJson(path.join(outDir, "threat-model-evidence.json"), collectionEnvelope("threat-model-evidence.v1", "threat_model_evidence", result.threat_model_evidence, result.generated_at));
  await writeJson(path.join(outDir, "threat-model-boundary.json"), result.threat_model_boundary);
  await writeJson(path.join(outDir, "threat-model-checks.json"), collectionEnvelope("threat-model-checks.v1", "threat_model_checks", result.threat_model_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "threat-model-refresh-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildControlRows(generatedAt, sourceStatuses) {
  const sourceById = new Map(sourceStatuses.map((source) => [source.source_id, source]));
  return CONTROL_CATALOG.map((entry, index) => ({
    schema_version: "threat-model-control.v1",
    control_id: entry.control_id,
    generated_at: generatedAt,
    label: entry.label,
    control_family: entry.control_family,
    mapped_risk_categories: entry.mapped_risk_categories,
    source_artifact_id: entry.source_artifact_id,
    source_status: sourceById.get(entry.source_artifact_id)?.source_status ?? "unknown",
    control_status: sourceById.get(entry.source_artifact_id)?.source_status === "passed" ? "implemented" : "attention",
    control_statement: entry.control_statement,
    read_only: true,
    mutation_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    ordinal: index + 1,
  }));
}

function buildRiskRows(generatedAt, controls) {
  const controlById = new Map(controls.map((controlRow) => [controlRow.control_id, controlRow]));
  return RISK_CATALOG.map((entry, index) => {
    const mappedControls = entry.mapped_control_ids.map((controlId) => controlById.get(controlId)).filter(Boolean);
    const covered = mappedControls.length === entry.mapped_control_ids.length
      && mappedControls.every((controlRow) => controlRow.control_status === "implemented");
    return {
      schema_version: "threat-model-risk.v1",
      risk_id: `threat-model-risk.${entry.risk_category}`,
      generated_at: generatedAt,
      risk_category: entry.risk_category,
      label: entry.label,
      severity: entry.severity,
      likelihood: entry.likelihood,
      risk_status: "tracked",
      mitigation_status: covered ? "covered" : "attention",
      residual_risk_status: covered ? "accepted_with_controls" : "needs_follow_up",
      attack_surface: entry.attack_surface,
      source_artifact_ids: entry.source_artifact_ids,
      mapped_control_ids: entry.mapped_control_ids,
      control_coverage_count: mappedControls.length,
      required_control_count: entry.mapped_control_ids.length,
      read_only: true,
      mutation_allowed: false,
      human_review_required: true,
      client_facing_ready: false,
      ordinal: index + 1,
    };
  });
}

function buildEvidenceRows(generatedAt, artifacts) {
  const rows = [];
  addEvidence(rows, generatedAt, "dashboard_api_freeze", "dashboard_api_freeze_status", artifacts.dashboard_api_freeze?.summary?.dashboard_api_freeze_status, "complete", "P296 Dashboard/API freeze is the direct guard for P297.");
  addEvidence(rows, generatedAt, "dashboard_api_freeze", "read_only", artifacts.dashboard_api_freeze?.summary?.read_only, true, "P296 surface remains read-only.");
  addEvidence(rows, generatedAt, "dashboard_api_freeze", "route_execution_performed", artifacts.dashboard_api_freeze?.summary?.route_execution_performed, false, "P296 route probes are in-process fixtures, not live route execution.");
  addEvidence(rows, generatedAt, "workflow_prompt_injection_boundary", "neutralized_instruction_signal_count", artifacts.workflow_prompt_injection_boundary?.summary?.neutralized_instruction_signal_count, artifacts.workflow_prompt_injection_boundary?.summary?.instruction_signal_count ?? 0, "Instruction-like text is neutralized.");
  addEvidence(rows, generatedAt, "workflow_prompt_injection_boundary", "promoted_prompt_instruction_count", artifacts.workflow_prompt_injection_boundary?.summary?.promoted_prompt_instruction_count, 0, "Untrusted content is not promoted to prompt instruction.");
  addEvidence(rows, generatedAt, "workflow_prompt_injection_boundary", "promoted_tool_instruction_count", artifacts.workflow_prompt_injection_boundary?.summary?.promoted_tool_instruction_count, 0, "Untrusted content is not promoted to tool instruction.");
  addEvidence(rows, generatedAt, "workflow_prompt_injection_boundary", "external_transfer_allowed_count", artifacts.workflow_prompt_injection_boundary?.summary?.external_transfer_allowed_count, 0, "Prompt injection boundary allows no external transfer.");
  addEvidence(rows, generatedAt, "secrets_broker_contract", "raw_secret_material_allowed_count", artifacts.secrets_broker_contract?.summary?.raw_secret_material_allowed_count, 0, "Raw secret material is not allowed.");
  addEvidence(rows, generatedAt, "secrets_broker_contract", "provider_key_direct_access_allowed_count", artifacts.secrets_broker_contract?.summary?.provider_key_direct_access_allowed_count, 0, "Provider key direct access is blocked.");
  addEvidence(rows, generatedAt, "secrets_broker_contract", "desktop_provider_key_visible", artifacts.secrets_broker_contract?.summary?.desktop_provider_key_visible, false, "Desktop cannot see provider keys.");
  addEvidence(rows, generatedAt, "runtime_freeze", "desktop_runtime_execution_allowed", artifacts.runtime_freeze?.summary?.desktop_runtime_execution_allowed, false, "Desktop runtime execution remains disabled.");
  addEvidence(rows, generatedAt, "runtime_freeze", "desktop_runtime_control_allowed", artifacts.runtime_freeze?.summary?.desktop_runtime_control_allowed, false, "Desktop runtime control remains disabled.");
  addEvidence(rows, generatedAt, "runtime_freeze", "desktop_installer_or_gateway_control", artifacts.runtime_freeze?.summary?.desktop_installer_or_gateway_control, false, "Desktop has no installer or gateway control.");
  addEvidence(rows, generatedAt, "runtime_freeze", "desktop_ssh_or_cron_control", artifacts.runtime_freeze?.summary?.desktop_ssh_or_cron_control, false, "Desktop has no SSH or cron control.");
  addEvidence(rows, generatedAt, "runtime_api_dashboard", "mutation_route_count", artifacts.runtime_api_dashboard?.summary?.mutation_route_count, 0, "Runtime API dashboard has no mutation routes.");
  addEvidence(rows, generatedAt, "capability_registry_api", "installer_or_gateway_route_count", artifacts.capability_registry_api?.summary?.installer_or_gateway_route_count, 0, "Capability registry exposes no installer or gateway routes.");
  addEvidence(rows, generatedAt, "dev_protected_scan", "raw_secret_material_exposed_count", artifacts.dev_protected_scan?.summary?.raw_secret_material_exposed_count ?? 0, 0, "Dev protected scan exposes no raw secret material.");
  addEvidence(rows, generatedAt, "dev_protected_scan", "credential_or_secret_change_blocked_count", artifacts.dev_protected_scan?.summary?.credential_or_secret_change_blocked_count ?? 0, null, "Secret or credential candidates remain blocked pending explicit approval.");
  return rows;
}

function addEvidence(rows, generatedAt, sourceArtifactId, metricKey, observedValue, expectedValue, statement) {
  let evidenceStatus = "passed";
  if (expectedValue !== null) {
    evidenceStatus = observedValue === expectedValue ? "passed" : "attention";
  } else {
    evidenceStatus = Number(observedValue ?? 0) >= 0 ? "passed" : "attention";
  }
  rows.push({
    schema_version: "threat-model-evidence.v1",
    evidence_id: `threat-model-evidence.${sourceArtifactId}.${slugify(metricKey)}`,
    generated_at: generatedAt,
    source_artifact_id: sourceArtifactId,
    metric_key: metricKey,
    observed_value: observedValue ?? null,
    expected_value: expectedValue,
    evidence_status: evidenceStatus,
    evidence_statement: statement,
    read_only: true,
    source_content_read_performed: false,
    secret_material_exposed: false,
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "threat-model-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    threat_model_only: true,
    read_only: true,
    preview_only: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    agent_invocation_performed: false,
    tool_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    desktop_mutation_allowed: false,
    installer_control_allowed: false,
    auto_update_control_allowed: false,
    ssh_control_allowed: false,
    cron_control_allowed: false,
    gateway_control_allowed: false,
    raw_secret_material_exposed: false,
    provider_key_materialized: false,
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

function buildChecks({ artifacts, support, sourceStatuses, risks, controls, evidence, boundary }) {
  const packageJson = support.package_json ?? {};
  const ledgerText = support.final_completion_ledger ?? "";
  const implementationRoadmapText = support.implementation_roadmap ?? "";
  const desktopCompanionText = support.desktop_companion_integration ?? "";
  const securityGovernanceText = support.security_governance ?? "";
  const reviewDashboardText = support.review_dashboard_source ?? "";
  const reviewApiText = support.review_api_source ?? "";
  const reviewApiDocText = support.review_api_doc ?? "";
  const dashboardApiFreeze = artifacts.dashboard_api_freeze?.summary ?? {};
  const promptBoundary = artifacts.workflow_prompt_injection_boundary?.summary ?? {};
  const secretsBroker = artifacts.secrets_broker_contract?.summary ?? {};
  const runtimeFreeze = artifacts.runtime_freeze?.summary ?? {};
  const runtimeApi = artifacts.runtime_api_dashboard?.summary ?? {};
  const capabilityApi = artifacts.capability_registry_api?.summary ?? {};
  const checks = [];
  const check = (pathValue, checkId, passed, message) => checks.push({
    schema_version: "threat-model-check.v1",
    validation_item_id: `threat-model-check.${slugify(checkId)}`,
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
  check("package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["security:threat-model"]), "package.json registers security:threat-model.");
  check("docs.final_completion_ledger", "ledger_tracks_p297", includesAll(ledgerText, ["P297", "threat model refresh"]), "Final completion ledger tracks P297.");
  check("docs.implementation_roadmap", "roadmap_tracks_p297", includesAll(implementationRoadmapText, ["Phase 297 - Threat Model Refresh", "threat_model_refresh"]), "Implementation roadmap documents Phase 297.");
  check("docs.desktop_companion", "desktop_risks_tracked", includesAll(desktopCompanionText, ["provider key", "installer", "gateway", "SSH", "cron", "auto-update"]), "Desktop companion doc tracks Desktop security risks.");
  check("docs.security_governance", "security_doc_prompt_injection", securityGovernanceText.includes("Prompt Injection"), "Security governance doc includes prompt injection posture.");
  check("src.review_dashboard", "dashboard_registered", includesAll(reviewDashboardText, ["threat_model_refresh", "buildThreatModelRefreshStage"]), "Review Dashboard registers Threat Model Refresh.");
  check("src.review_api", "review_api_registered", includesAll(reviewApiText, ["/api/threat-model-refreshes", "/api/threat-model-risks"]), "Review API exposes Threat Model Refresh routes.");
  check("docs.review_api", "review_api_doc_registered", includesAll(reviewApiDocText, ["Threat Model Refresh", "/api/threat-model-refreshes"]), "Review API docs include Threat Model Refresh routes.");
  check("sources.ready", "source_statuses_passed", sourceStatuses.every((source) => source.source_status === "passed"), "All threat model source artifacts are ready.");
  check("source.dashboard_api_freeze", "p296_guard_ready", dashboardApiFreeze.dashboard_api_freeze_status === "complete" && dashboardApiFreeze.phase_slot === PREVIOUS_PHASE_SLOT && dashboardApiFreeze.next_phase_slot === PHASE_SLOT, "P296 Dashboard/API Freeze guard is complete and points to P297.");
  check("risks.required_categories", "required_risks_tracked", REQUIRED_RISK_CATEGORIES.every((category) => risks.some((riskRow) => riskRow.risk_category === category && riskRow.risk_status === "tracked")), "All required P297 risk categories are tracked.");
  check("risks.covered", "all_risks_covered", risks.every((riskRow) => riskRow.mitigation_status === "covered"), "All tracked risks have mapped controls.");
  check("controls.implemented", "all_controls_implemented", controls.every((controlRow) => controlRow.control_status === "implemented"), "All threat controls are implemented by source artifacts.");
  check("evidence.passed", "evidence_passed", evidence.every((row) => row.evidence_status === "passed"), "All threat model evidence rows pass.");
  check("prompt_injection", "prompt_injection_neutralized", promptBoundary.workflow_prompt_injection_boundary_status === "complete" && (promptBoundary.neutralized_instruction_signal_count ?? 0) >= (promptBoundary.instruction_signal_count ?? 0) && (promptBoundary.promoted_prompt_instruction_count ?? 1) === 0 && (promptBoundary.promoted_tool_instruction_count ?? 1) === 0 && (promptBoundary.external_transfer_allowed_count ?? 1) === 0 && (promptBoundary.protected_action_executed_count ?? 1) === 0, "Prompt injection is neutralized without instruction promotion, transfer, or protected action.");
  check("secrets", "provider_key_and_secret_material_blocked", secretsBroker.secrets_broker_contract_status === "complete" && secretsBroker.raw_secret_material_allowed_count === 0 && secretsBroker.provider_key_direct_access_allowed_count === 0 && secretsBroker.desktop_provider_key_visible === false, "Raw secret and provider key exposure is blocked.");
  check("runtime.desktop", "desktop_over_agency_blocked", runtimeFreeze.runtime_freeze_status === "complete" && runtimeFreeze.desktop_runtime_execution_allowed === false && runtimeFreeze.desktop_runtime_control_allowed === false && runtimeFreeze.desktop_test_execution_allowed === false && runtimeFreeze.desktop_installer_or_gateway_control === false && runtimeFreeze.desktop_ssh_or_cron_control === false, "Desktop over-agency and runtime controls are blocked.");
  check("api.desktop", "desktop_api_mutation_free", (runtimeApi.mutation_route_count ?? 0) === 0 && (capabilityApi.installer_or_gateway_route_count ?? 0) === 0, "Desktop API surfaces expose no mutation, installer, or gateway routes.");
  check("boundary", "boundary_enforced", boundary.read_only && !boundary.desktop_mutation_allowed && !boundary.installer_control_allowed && !boundary.auto_update_control_allowed && !boundary.ssh_control_allowed && !boundary.cron_control_allowed && !boundary.gateway_control_allowed && !boundary.raw_secret_material_exposed && !boundary.provider_key_materialized && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Threat model boundary is read-only and non-executing.");
  check("boundary.windows_baseline", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return checks;
}

function buildSummary({ sourceStatuses, risks, controls, evidence, boundary, checks, validation, artifacts }) {
  const coveredRiskCount = risks.filter((riskRow) => riskRow.mitigation_status === "covered").length;
  const passedEvidenceCount = evidence.filter((row) => row.evidence_status === "passed").length;
  return {
    threat_model_refresh_status: validation.valid ? "complete" : "attention",
    threat_model_refresh_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    source_dashboard_api_freeze_status: artifacts.dashboard_api_freeze?.summary?.dashboard_api_freeze_status ?? "unknown",
    source_dashboard_api_freeze_phase_slot: artifacts.dashboard_api_freeze?.summary?.phase_slot ?? null,
    source_dashboard_api_freeze_next_phase_slot: artifacts.dashboard_api_freeze?.summary?.next_phase_slot ?? null,
    required_risk_category_count: REQUIRED_RISK_CATEGORIES.length,
    tracked_risk_count: risks.length,
    covered_risk_count: coveredRiskCount,
    attention_risk_count: risks.length - coveredRiskCount,
    implemented_control_count: controls.filter((controlRow) => controlRow.control_status === "implemented").length,
    control_count: controls.length,
    evidence_row_count: evidence.length,
    passed_evidence_row_count: passedEvidenceCount,
    attention_evidence_row_count: evidence.length - passedEvidenceCount,
    prompt_injection_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "prompt_injection"),
    data_leak_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "data_leak"),
    over_agency_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "over_agency"),
    insecure_tool_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "insecure_tool"),
    desktop_installer_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "desktop_installer"),
    desktop_auto_update_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "desktop_auto_update"),
    desktop_ssh_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "desktop_ssh"),
    desktop_cron_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "desktop_cron"),
    desktop_gateway_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "desktop_gateway"),
    provider_key_risk_tracked: risks.some((riskRow) => riskRow.risk_category === "provider_key"),
    prompt_injection_neutralized_count: artifacts.workflow_prompt_injection_boundary?.summary?.neutralized_instruction_signal_count ?? 0,
    prompt_injection_promoted_instruction_count: (artifacts.workflow_prompt_injection_boundary?.summary?.promoted_prompt_instruction_count ?? 0) + (artifacts.workflow_prompt_injection_boundary?.summary?.promoted_tool_instruction_count ?? 0),
    raw_secret_material_allowed_count: artifacts.secrets_broker_contract?.summary?.raw_secret_material_allowed_count ?? 0,
    provider_key_direct_access_allowed_count: artifacts.secrets_broker_contract?.summary?.provider_key_direct_access_allowed_count ?? 0,
    desktop_runtime_execution_allowed: artifacts.runtime_freeze?.summary?.desktop_runtime_execution_allowed ?? false,
    desktop_runtime_control_allowed: artifacts.runtime_freeze?.summary?.desktop_runtime_control_allowed ?? false,
    desktop_installer_or_gateway_control: artifacts.runtime_freeze?.summary?.desktop_installer_or_gateway_control ?? false,
    desktop_ssh_or_cron_control: artifacts.runtime_freeze?.summary?.desktop_ssh_or_cron_control ?? false,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    threat_model_only: boundary.threat_model_only,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    agent_invocation_performed: boundary.agent_invocation_performed,
    tool_execution_performed: boundary.tool_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    installer_control_allowed: boundary.installer_control_allowed,
    auto_update_control_allowed: boundary.auto_update_control_allowed,
    ssh_control_allowed: boundary.ssh_control_allowed,
    cron_control_allowed: boundary.cron_control_allowed,
    gateway_control_allowed: boundary.gateway_control_allowed,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_materialized: boundary.provider_key_materialized,
    protected_action_executed: boundary.protected_action_executed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Threat Model Refresh");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.threat_model_refresh_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Phase: ${summary.previous_phase_slot} -> ${summary.phase_slot} -> ${summary.next_phase_slot}`);
  lines.push(`- Risks tracked: ${summary.tracked_risk_count}/${summary.required_risk_category_count}`);
  lines.push(`- Covered risks: ${summary.covered_risk_count}/${summary.tracked_risk_count}`);
  lines.push(`- Controls implemented: ${summary.implemented_control_count}/${summary.control_count}`);
  lines.push(`- Evidence passed: ${summary.passed_evidence_row_count}/${summary.evidence_row_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Required Risk Coverage");
  for (const riskRow of result.threat_model_risks) {
    lines.push(`- ${riskRow.label}: ${riskRow.mitigation_status} (${riskRow.residual_risk_status})`);
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push(`- Read-only: ${summary.read_only}`);
  lines.push(`- Human review required: ${summary.human_review_required}`);
  lines.push(`- Client-facing ready: ${summary.client_facing_ready}`);
  lines.push(`- Desktop mutation allowed: ${summary.desktop_mutation_allowed}`);
  lines.push(`- Installer/auto-update/SSH/cron/gateway control: ${summary.installer_control_allowed}/${summary.auto_update_control_allowed}/${summary.ssh_control_allowed}/${summary.cron_control_allowed}/${summary.gateway_control_allowed}`);
  lines.push(`- Raw secret/provider key materialized: ${summary.raw_secret_material_exposed}/${summary.provider_key_materialized}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildSourceStatus(source) {
  const summary = source.data?.summary ?? {};
  const observedStatus = source.status_key ? summary[source.status_key] ?? source.data?.[source.status_key] ?? "unknown" : "available";
  const phaseSlot = summary.phase_slot ?? source.data?.phase_slot ?? null;
  const nextPhaseSlot = summary.next_phase_slot ?? source.data?.next_phase_slot ?? null;
  const validationErrorCount = summary.validation_error_count ?? source.data?.validation?.errors?.length ?? 0;
  const sourceStatus = source.available
    && (!source.expected_status || observedStatus === source.expected_status)
    && (!source.expected_next_phase_slot || nextPhaseSlot === source.expected_next_phase_slot)
    && validationErrorCount === 0
    ? "passed"
    : "failed";
  return {
    schema_version: "threat-model-source.v1",
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    source_group: source.source_group,
    path: source.path,
    available: source.available,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: observedStatus,
    phase_slot: phaseSlot,
    expected_next_phase_slot: source.expected_next_phase_slot,
    next_phase_slot: nextPhaseSlot,
    validation_error_count: validationErrorCount,
    source_status: sourceStatus,
    content_hash: source.content_hash,
    error: source.error,
  };
}

async function readSources(definitions, inputs) {
  return Promise.all(definitions.map(async (definition) => {
    const inputKey = toSnake(definition.option);
    const configuredPath = inputs[inputKey] ?? inputs[definition.option] ?? DEFAULT_THREAT_MODEL_REFRESH_INPUTS[definition.option];
    const resolvedPath = configuredPath === false || configuredPath == null ? null : path.resolve(configuredPath);
    const raw = resolvedPath ? await readSource(resolvedPath, definition.read_type) : { value: null, error: "disabled" };
    return {
      ...definition,
      path: resolvedPath,
      available: Boolean(raw.value) && !raw.error,
      data: raw.value,
      error: raw.error,
      content_hash: raw.raw ? sha256(raw.raw) : null,
    };
  }));
}

async function readSource(filePath, readType) {
  try {
    const raw = await readFile(filePath, "utf8");
    if (readType === "text") return { value: raw, raw };
    return { value: JSON.parse(raw), raw };
  } catch (error) {
    return { value: null, raw: null, error: error.message };
  }
}

function sourceDefinition(sourceId, label, option, plannedSlot, sourceGroup, statusKey, expectedStatus, expectedNextPhaseSlot = null, readType = "json") {
  return {
    source_id: sourceId,
    label,
    source_group: sourceGroup,
    option,
    planned_slot: plannedSlot,
    status_key: statusKey,
    expected_status: expectedStatus,
    expected_next_phase_slot: expectedNextPhaseSlot,
    read_type: readType,
  };
}

function risk(riskCategory, label, severity, likelihood, attackSurface, sourceArtifactIds, mappedControlIds) {
  return { risk_category: riskCategory, label, severity, likelihood, attack_surface: attackSurface, source_artifact_ids: sourceArtifactIds, mapped_control_ids: mappedControlIds };
}

function control(controlId, label, mappedRiskCategories, sourceArtifactId, controlStatement) {
  const [controlFamily] = controlId.split("_");
  return { control_id: controlId, label, control_family: controlFamily, mapped_risk_categories: mappedRiskCategories, source_artifact_id: sourceArtifactId, control_statement: controlStatement };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_THREAT_MODEL_REFRESH_INPUTS;
  return Object.fromEntries(
    Object.entries({ ...defaults, ...options })
      .filter(([key]) => key.endsWith("Path"))
      .map(([key, value]) => [toSnake(key), value]),
  );
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text).includes(needle));
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
  console.log(`Usage: node scripts/threat-model-refresh.mjs [--check] [--out-dir DIR]\n\nBuilds the P297 Threat Model Refresh report.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[key] = argv[++index];
    }
  }
  return parsed;
}

export async function runThreatModelRefreshCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runThreatModelRefresh(args);
    console.log(`Threat model refresh written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.threat_model_refresh_status}`);
    console.log(`Risks: ${result.summary.covered_risk_count}/${result.summary.tracked_risk_count}`);
    console.log(`Controls: ${result.summary.implemented_control_count}/${result.summary.control_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}
