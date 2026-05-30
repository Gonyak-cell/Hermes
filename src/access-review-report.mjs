import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ACCESS_REVIEW_REPORT_OUT_DIR = "artifacts/access-review-report/latest";
export const DEFAULT_ACCESS_REVIEW_REPORT_INPUTS = {
  retentionDeletionPolicyPath: "artifacts/retention-deletion-policy/latest/retention-deletion-policy.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  identityPolicyMatterFreezePath: "artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "access-review-report.v1";
const CAPABILITY_ID = "compliance.access_review_report";
const PHASE_SLOT = "P302";
const PREVIOUS_PHASE_SLOT = "P301";
const NEXT_PHASE_SLOT = "P303";

const SOURCE_DEFINITIONS = [
  sourceDefinition("retention_deletion_policy", "Retention Deletion Policy", "retention_deletion_policy_status", "complete", "P301", "P302"),
  sourceDefinition("matter_access_policy_evaluator", "Matter Access Policy Evaluator", "access_policy_status", "complete", null, null),
  sourceDefinition("access_audit_projection", "Access Audit Projection", "access_audit_projection_status", "complete", null, null),
  sourceDefinition("matter_profile_team_ledger", "Matter Profile Team Ledger", "ledger_status", "complete", null, null),
  sourceDefinition("wall_policy_contract", "Wall Policy Contract", "wall_policy_status", "complete", null, null),
  sourceDefinition("identity_policy_matter_freeze", "Identity Policy Matter Freeze", "freeze_status", "frozen_with_pending_human_actions", null, null),
];

export async function runAccessReviewReport(options = {}) {
  const result = await buildAccessReviewReport(options);
  if (options.write !== false) await writeAccessReviewReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Access review report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAccessReviewReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ACCESS_REVIEW_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    retention_deletion_policy: await readJsonSource(inputs.retention_deletion_policy_path),
    matter_access_policy_evaluator: await readJsonSource(inputs.matter_access_policy_evaluator_path),
    access_audit_projection: await readJsonSource(inputs.access_audit_projection_path),
    matter_profile_team_ledger: await readJsonSource(inputs.matter_profile_team_ledger_path),
    wall_policy_contract: await readJsonSource(inputs.wall_policy_contract_path),
    identity_policy_matter_freeze: await readJsonSource(inputs.identity_policy_matter_freeze_path),
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
  const subjectReviews = buildSubjectReviews({ sources, generatedAt });
  const matterAccessRows = buildMatterAccessRows({ sources, generatedAt });
  const resourceAccessRows = buildResourceAccessRows({ sources, generatedAt });
  const findings = buildFindings({ sources, subjectReviews, matterAccessRows, resourceAccessRows, generatedAt });
  const gateResults = buildGateResults({ sourceStatuses, subjectReviews, matterAccessRows, resourceAccessRows, findings, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    subjectReviews,
    matterAccessRows,
    resourceAccessRows,
    findings,
    gateResults,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    generatedAt,
    sourceStatuses,
    subjectReviews,
    matterAccessRows,
    resourceAccessRows,
    findings,
    gateResults,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    access_review_report_id: `access-review-report.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    access_review_contract: buildAccessReviewContract(generatedAt),
    access_review_subjects: subjectReviews,
    access_review_matter_rows: matterAccessRows,
    access_review_resource_rows: resourceAccessRows,
    access_review_findings: findings,
    access_review_gate_results: gateResults,
    access_review_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeAccessReviewReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "access-review-report.json"), serializable);
  await writeJson(path.join(outDir, "access-review-source-statuses.json"), collectionEnvelope("access-review-source-statuses.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "access-review-subjects.json"), collectionEnvelope("access-review-subjects.v1", "access_review_subjects", result.access_review_subjects, result.generated_at));
  await writeJson(path.join(outDir, "access-review-matter-rows.json"), collectionEnvelope("access-review-matter-rows.v1", "access_review_matter_rows", result.access_review_matter_rows, result.generated_at));
  await writeJson(path.join(outDir, "access-review-resource-rows.json"), collectionEnvelope("access-review-resource-rows.v1", "access_review_resource_rows", result.access_review_resource_rows, result.generated_at));
  await writeJson(path.join(outDir, "access-review-findings.json"), collectionEnvelope("access-review-findings.v1", "access_review_findings", result.access_review_findings, result.generated_at));
  await writeJson(path.join(outDir, "access-review-gate-results.json"), collectionEnvelope("access-review-gate-results.v1", "access_review_gate_results", result.access_review_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "access-review-boundary.json"), result.access_review_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "access-review-report-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildSubjectReviews({ sources, generatedAt }) {
  const actorRollups = auditCatalog(sources).actor_access_rollups ?? [];
  const subjectMetadataById = new Map((teamContract(sources).matter_access_subjects ?? []).map((subject) => [subject.access_subject_id, subject]));
  return actorRollups.map((rollup, index) => {
    const subject = subjectMetadataById.get(rollup.access_subject_id) ?? {};
    const row = {
      schema_version: "access-review-subject.v1",
      access_review_subject_id: `access-review.subject.${slugify(rollup.user_id)}.${slugify(rollup.runtime_id)}.${slugify(rollup.target_matter_id)}`,
      generated_at: generatedAt,
      ordinal: index + 1,
      tenant_id: rollup.tenant_id,
      client_id: rollup.client_id,
      matter_id: rollup.target_matter_id,
      user_id: rollup.user_id,
      access_subject_id: rollup.access_subject_id,
      runtime_id: rollup.runtime_id,
      subject_type: subject.subject_type ?? "unknown",
      matter_role: subject.matter_role ?? subject.metadata?.matter_role ?? "unknown",
      access_audit_record_count: rollup.access_audit_record_count ?? 0,
      matter_record_count: rollup.matter_record_count ?? 0,
      resource_record_count: rollup.resource_record_count ?? 0,
      view_allowed_count: rollup.view_allowed_count ?? 0,
      view_requires_human_confirmation_count: rollup.view_requires_human_confirmation_count ?? 0,
      view_denied_count: rollup.view_denied_count ?? 0,
      can_retrieve_count: rollup.can_retrieve_count ?? 0,
      human_review_required_count: rollup.human_review_required_count ?? 0,
      external_runtime_record_count: rollup.external_runtime_record_count ?? 0,
      resource_ids: rollup.resource_ids ?? [],
      policy_snapshot_ids: rollup.policy_snapshot_ids ?? [],
      access_review_status: "review_ready",
      least_privilege_review_required: (rollup.view_requires_human_confirmation_count ?? 0) > 0 || (rollup.view_denied_count ?? 0) > 0,
      human_review_required: (rollup.human_review_required_count ?? 0) > 0,
      client_facing_ready: false,
    };
    return { ...row, access_review_subject_hash: sha256(row) };
  });
}

function buildMatterAccessRows({ sources, generatedAt }) {
  const records = (auditCatalog(sources).access_audit_records ?? []).filter((record) => record.target_type === "matter");
  return records.map((record, index) => {
    const row = {
      schema_version: "access-review-matter-row.v1",
      access_review_matter_row_id: `access-review.matter.${slugify(record.access_audit_record_id)}`,
      generated_at: generatedAt,
      ordinal: index + 1,
      tenant_id: record.tenant_id,
      client_id: record.client_id,
      matter_id: record.target_matter_id,
      user_id: record.user_id,
      access_subject_id: record.access_subject_id,
      runtime_id: record.runtime_id,
      adapter_id: record.adapter_id,
      external_execution: Boolean(record.external_execution),
      wall_id: record.wall_id,
      wall_policy_rule_id: record.wall_policy_rule_id,
      retrieval_wall_filter_id: record.retrieval_wall_filter_id,
      required_classification_floor: record.required_classification_floor,
      access_decision: record.access_decision,
      view_status: record.view_status,
      context_mode: record.context_mode,
      can_retrieve: Boolean(record.can_retrieve),
      requires_human_review: Boolean(record.requires_human_review),
      required_gates: record.required_gates ?? [],
      reason_codes: record.reason_codes ?? [],
      policy_snapshot_id: record.policy_snapshot_id,
      review_status: reviewStatus(record),
      client_facing_ready: false,
    };
    return { ...row, access_review_matter_row_hash: sha256(row) };
  });
}

function buildResourceAccessRows({ sources, generatedAt }) {
  const resourceRollups = auditCatalog(sources).resource_access_rollups ?? [];
  return resourceRollups.map((rollup, index) => {
    const crossTenant = rollup.resource_tenant_id && rollup.tenant_id && rollup.resource_tenant_id !== rollup.tenant_id;
    const crossMatter = rollup.resource_matter_id && rollup.target_matter_id && rollup.resource_matter_id !== rollup.target_matter_id;
    const row = {
      schema_version: "access-review-resource-row.v1",
      access_review_resource_row_id: `access-review.resource.${slugify(rollup.target_resource_id)}.${slugify(rollup.target_matter_id)}`,
      generated_at: generatedAt,
      ordinal: index + 1,
      tenant_id: rollup.tenant_id,
      client_id: rollup.client_id,
      matter_id: rollup.target_matter_id,
      resource_id: rollup.target_resource_id,
      resource_matter_id: rollup.resource_matter_id,
      resource_tenant_id: rollup.resource_tenant_id,
      resource_classification: rollup.resource_classification,
      access_audit_record_count: rollup.access_audit_record_count ?? 0,
      view_allowed_count: rollup.view_allowed_count ?? 0,
      view_requires_human_confirmation_count: rollup.view_requires_human_confirmation_count ?? 0,
      view_denied_count: rollup.view_denied_count ?? 0,
      can_retrieve_count: rollup.can_retrieve_count ?? 0,
      human_review_required_count: rollup.human_review_required_count ?? 0,
      user_ids: rollup.user_ids ?? [],
      runtime_ids: rollup.runtime_ids ?? [],
      matter_tagging_decision_ids: rollup.matter_tagging_decision_ids ?? [],
      cross_tenant_resource: Boolean(crossTenant),
      cross_matter_resource: Boolean(crossMatter),
      access_review_status: "review_ready",
      matter_tagging_review_required: (rollup.matter_tagging_decision_ids ?? []).length > 0 || Boolean(crossTenant) || Boolean(crossMatter),
      human_review_required: (rollup.human_review_required_count ?? 0) > 0,
      client_facing_ready: false,
    };
    return { ...row, access_review_resource_row_hash: sha256(row) };
  });
}

function buildFindings({ sources, subjectReviews, matterAccessRows, resourceAccessRows, generatedAt }) {
  const summary = summaryOf(sources.access_audit_projection.data);
  const records = auditCatalog(sources).access_audit_records ?? [];
  const reviewWithoutHumanGate = records.filter((record) => record.access_decision === "review" && !record.requires_human_review).length;
  const deniedRetrievable = records.filter((record) => record.access_decision === "deny" && record.can_retrieve).length;
  const externalRetrievable = records.filter((record) => record.external_execution && record.can_retrieve).length;
  const missingRetrievalFilter = records.filter((record) => !record.retrieval_wall_filter_id).length;
  const crossBoundaryRetrievable = resourceAccessRows.filter((row) => (row.cross_tenant_resource || row.cross_matter_resource) && row.can_retrieve_count > 0).length;
  const findings = [
    finding("tenant_matter_user_matrix", "Tenant/matter/user access review matrix is available", subjectReviews.length, subjectReviews.length > 0 ? 0 : 1, "access_review_subjects", generatedAt),
    finding("matter_access_decisions", "Matter-level access decisions are reviewable", matterAccessRows.length, matterAccessRows.length > 0 ? 0 : 1, "access_review_matter_rows", generatedAt),
    finding("resource_access_rollups", "Resource-level access rollups are reviewable", resourceAccessRows.length, resourceAccessRows.length > 0 ? 0 : 1, "access_review_resource_rows", generatedAt),
    finding("review_decisions_human_gated", "Review decisions require human confirmation before retrieval", summary.view_requires_human_confirmation_count ?? 0, reviewWithoutHumanGate, "access_audit_projection", generatedAt),
    finding("denied_decisions_not_retrievable", "Denied decisions cannot retrieve matter data", summary.view_denied_count ?? 0, deniedRetrievable, "access_audit_projection", generatedAt),
    finding("external_runtime_not_directly_retrievable", "External runtime rows remain blocked or review-gated", summary.external_runtime_record_count ?? 0, externalRetrievable, "access_audit_projection", generatedAt),
    finding("cross_boundary_resources_review_gated", "Cross-tenant or cross-matter resources are held for review", resourceAccessRows.filter((row) => row.cross_tenant_resource || row.cross_matter_resource).length, crossBoundaryRetrievable, "access_review_resource_rows", generatedAt),
    finding("retrieval_filters_recorded", "Retrieval wall filters are recorded for access rows", records.length, missingRetrievalFilter, "access_audit_projection", generatedAt),
    finding("matter_tagging_resolved", "Matter tagging links are resolved for resource access review", summary.matter_tagging_linked_count ?? 0, summary.matter_tagging_unresolved_count ?? 0, "access_audit_projection", generatedAt),
  ];
  return findings.map((row, index) => ({ ...row, ordinal: index + 1, access_review_finding_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildGateResults({ sourceStatuses, subjectReviews, matterAccessRows, resourceAccessRows, findings, generatedAt }) {
  const findingViolations = new Map(findings.map((row) => [row.finding_id, row.violation_count]));
  const gateRows = [
    gateResult("sources_ready", "Required source artifacts are complete", sourceStatuses.filter((source) => source.source_status !== "passed").length, "source_statuses", generatedAt),
    gateResult("tenant_matter_user_coverage", "Tenant, matter, and user dimensions have review rows", subjectReviews.length > 0 ? 0 : 1, "access_review_subjects", generatedAt),
    gateResult("matter_rows_present", "Matter-level access decisions are included", matterAccessRows.length > 0 ? 0 : 1, "access_review_matter_rows", generatedAt),
    gateResult("resource_rows_present", "Resource-level access rollups are included", resourceAccessRows.length > 0 ? 0 : 1, "access_review_resource_rows", generatedAt),
    gateResult("review_decisions_human_gated", "Review decisions are human-gated", findingViolations.get("review_decisions_human_gated") ?? 1, "access_review_findings", generatedAt),
    gateResult("denied_not_retrievable", "Denied decisions are not retrievable", findingViolations.get("denied_decisions_not_retrievable") ?? 1, "access_review_findings", generatedAt),
    gateResult("external_runtime_not_directly_retrievable", "External runtime rows are not directly retrievable", findingViolations.get("external_runtime_not_directly_retrievable") ?? 1, "access_review_findings", generatedAt),
    gateResult("cross_boundary_resources_review_gated", "Cross-boundary resource rows are not directly retrievable", findingViolations.get("cross_boundary_resources_review_gated") ?? 1, "access_review_findings", generatedAt),
    gateResult("retrieval_filters_recorded", "Retrieval wall filters are recorded", findingViolations.get("retrieval_filters_recorded") ?? 1, "access_review_findings", generatedAt),
    gateResult("matter_tagging_resolved", "Matter tagging links are resolved for resource rows", findingViolations.get("matter_tagging_resolved") ?? 1, "access_review_findings", generatedAt),
  ];
  return gateRows.map((row, index) => ({ ...row, ordinal: index + 1, access_review_gate_result_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildBoundary(generatedAt) {
  const boundary = {
    schema_version: "access-review-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    access_review_report_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    permission_mutation_performed: false,
    access_grant_performed: false,
    access_revoke_performed: false,
    source_mutation_performed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
  return { ...boundary, access_review_boundary_hash: sha256(boundary) };
}

function buildAccessReviewContract(generatedAt) {
  const contract = {
    schema_version: "access-review-contract.v1",
    generated_at: generatedAt,
    contract_status: "active",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    review_dimensions: ["tenant_id", "matter_id", "user_id", "runtime_id", "resource_id"],
    decision_statuses: ["allow", "review", "deny"],
    view_statuses: ["view_allowed", "view_requires_human_confirmation", "view_denied"],
    report_scope: "read_only_access_review",
    mutation_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
  };
  return { ...contract, access_review_contract_hash: sha256(contract) };
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const summary = summaryOf(source?.data);
    const actualStatus = source?.available ? summary[definition.status_key] ?? "unknown" : "missing";
    const phaseSlot = summary.phase_slot ?? null;
    const nextPhaseSlot = summary.next_phase_slot ?? null;
    const passed = source?.available
      && actualStatus === definition.expected_status
      && (definition.expected_phase_slot === null || phaseSlot === definition.expected_phase_slot)
      && (definition.expected_next_phase_slot === null || nextPhaseSlot === definition.expected_next_phase_slot);
    const row = {
      schema_version: "access-review-source-status.v1",
      source_status_id: `access-review-source.${definition.source_id}`,
      ordinal: index + 1,
      source_id: definition.source_id,
      label: definition.label,
      source_path: source?.path ?? null,
      source_available: Boolean(source?.available),
      source_content_hash: source?.content_hash ?? null,
      expected_status: definition.expected_status,
      actual_status: actualStatus,
      expected_phase_slot: definition.expected_phase_slot,
      actual_phase_slot: phaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      actual_next_phase_slot: nextPhaseSlot,
      source_status: passed ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildValidationItems({ sourceStatuses, subjectReviews, matterAccessRows, resourceAccessRows, findings, gateResults, boundary, sources, support }) {
  const items = [];
  for (const sourceStatus of sourceStatuses) {
    pushCheck(items, "source_statuses", `source_${sourceStatus.source_id}_passed`, sourceStatus.source_status === "passed", `${sourceStatus.label} is present and complete.`);
  }
  pushCheck(items, "source_statuses", "retention_deletion_policy_phase_chain", summaryOf(sources.retention_deletion_policy.data).phase_slot === "P301" && summaryOf(sources.retention_deletion_policy.data).next_phase_slot === "P302", "P302 builds after P301 Retention Deletion Policy.");
  pushCheck(items, "access_review_subjects", "tenant_matter_user_subjects_present", subjectReviews.length > 0 && distinctCount(subjectReviews, "tenant_id") > 0 && distinctCount(subjectReviews, "matter_id") > 0 && distinctCount(subjectReviews, "user_id") > 0, "Tenant/matter/user subject review rows are present.");
  pushCheck(items, "access_review_matter_rows", "matter_access_rows_present", matterAccessRows.length > 0, "Matter-level access rows are present.");
  pushCheck(items, "access_review_resource_rows", "resource_access_rows_present", resourceAccessRows.length > 0, "Resource-level access rows are present.");
  pushCheck(items, "access_review_findings", "findings_clear", findings.length >= 8 && findings.every((row) => row.finding_status === "passed"), "Access review findings have no blocking violations.");
  pushCheck(items, "access_review_gate_results", "gate_results_passed", gateResults.length >= 10 && gateResults.every((row) => row.gate_status === "passed" && row.access_mutation_allowed === false), "Access review hardening gates pass.");
  pushCheck(items, "access_review_boundary", "boundary_read_only", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.access_review_report_only === true, "Access review report remains read-only.");
  pushCheck(items, "access_review_boundary", "no_permission_mutation", !boundary.permission_mutation_performed && !boundary.access_grant_performed && !boundary.access_revoke_performed && !boundary.source_mutation_performed, "Access review does not grant, revoke, or mutate permissions.");
  pushCheck(items, "access_review_boundary", "no_execution_or_transfer", !boundary.external_transfer_performed && !boundary.network_access_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed, "Access review does not execute routes, start servers, transfer externally, or execute protected actions.");
  pushCheck(items, "access_review_boundary", "human_review_gate_preserved", boundary.human_review_required === true && boundary.client_facing_ready === false && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Human-review and no-legal-advice gates remain preserved.");
  pushCheck(items, "access_review_boundary", "windows_baseline_guard", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true, "Windows baseline stability guard is preserved.");
  pushCheck(items, "support.package_json", "package_script_registered", Boolean(support.package_json.data?.scripts?.["compliance:access-review-report"]), "package.json registers compliance:access-review-report.");
  pushCheck(items, "support.final_completion_ledger", "ledger_phase_promoted", textIncludes(support.final_completion_ledger, "P302") && textIncludes(support.final_completion_ledger, "Access Review Report"), "Final completion ledger promotes P302 Access Review Report.");
  pushCheck(items, "support.implementation_roadmap", "implementation_roadmap_phase_documented", textIncludes(support.implementation_roadmap, "Phase 302") && textIncludes(support.implementation_roadmap, "access_review_report"), "Implementation roadmap documents Phase 302.");
  pushCheck(items, "support.review_dashboard_source", "dashboard_source_registered", textIncludes(support.review_dashboard_source, "access_review_report") && textIncludes(support.review_dashboard_source, "Access Review Report"), "Review dashboard registers access_review_report.");
  pushCheck(items, "support.review_api_source", "review_api_routes_registered", textIncludes(support.review_api_source, "/api/access-review-reports") && textIncludes(support.review_api_source, "access_review_report"), "Review API registers access review routes.");
  pushCheck(items, "support.review_api_doc", "review_api_docs_registered", textIncludes(support.review_api_doc, "/api/access-review-reports"), "Review API docs mention access review routes.");
  return items.map((item, index) => ({ ...item, ordinal: index + 1, validation_item_hash: sha256({ ...item, ordinal: index + 1 }) }));
}

function buildSummary({ generatedAt, sourceStatuses, subjectReviews, matterAccessRows, resourceAccessRows, findings, gateResults, boundary, validationItems, validation }) {
  const decisionRows = [...matterAccessRows];
  const summary = {
    access_review_report_status: validation.valid ? "complete" : "blocked",
    access_review_report_id: null,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((row) => row.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((row) => row.source_status !== "passed").length,
    source_retention_deletion_policy_status: sourceStatuses.find((row) => row.source_id === "retention_deletion_policy")?.actual_status ?? "unknown",
    source_retention_deletion_policy_phase_slot: sourceStatuses.find((row) => row.source_id === "retention_deletion_policy")?.actual_phase_slot ?? null,
    source_retention_deletion_policy_next_phase_slot: sourceStatuses.find((row) => row.source_id === "retention_deletion_policy")?.actual_next_phase_slot ?? null,
    subject_review_count: subjectReviews.length,
    matter_access_row_count: matterAccessRows.length,
    resource_access_row_count: resourceAccessRows.length,
    finding_count: findings.length,
    passed_finding_count: findings.filter((row) => row.finding_status === "passed").length,
    failed_finding_count: findings.filter((row) => row.finding_status !== "passed").length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    gate_violation_count: sum(gateResults, "violation_count"),
    tenant_count: distinctCount(subjectReviews, "tenant_id"),
    matter_count: distinctCount(subjectReviews, "matter_id"),
    user_count: distinctCount(subjectReviews, "user_id"),
    runtime_count: distinctCount(subjectReviews, "runtime_id"),
    resource_count: resourceAccessRows.length,
    view_allowed_count: sum(subjectReviews, "view_allowed_count"),
    view_requires_human_confirmation_count: sum(subjectReviews, "view_requires_human_confirmation_count"),
    view_denied_count: sum(subjectReviews, "view_denied_count"),
    can_retrieve_count: sum(subjectReviews, "can_retrieve_count"),
    human_review_required_count: sum(subjectReviews, "human_review_required_count"),
    external_runtime_record_count: sum(subjectReviews, "external_runtime_record_count"),
    matter_allow_decision_count: decisionRows.filter((row) => row.access_decision === "allow").length,
    matter_review_decision_count: decisionRows.filter((row) => row.access_decision === "review").length,
    matter_deny_decision_count: decisionRows.filter((row) => row.access_decision === "deny").length,
    cross_tenant_resource_count: resourceAccessRows.filter((row) => row.cross_tenant_resource).length,
    cross_matter_resource_count: resourceAccessRows.filter((row) => row.cross_matter_resource).length,
    resource_can_retrieve_count: sum(resourceAccessRows, "can_retrieve_count"),
    review_without_human_gate_count: findings.find((row) => row.finding_id === "review_decisions_human_gated")?.violation_count ?? 0,
    denied_retrievable_count: findings.find((row) => row.finding_id === "denied_decisions_not_retrievable")?.violation_count ?? 0,
    external_runtime_retrievable_count: findings.find((row) => row.finding_id === "external_runtime_not_directly_retrievable")?.violation_count ?? 0,
    missing_retrieval_filter_count: findings.find((row) => row.finding_id === "retrieval_filters_recorded")?.violation_count ?? 0,
    read_only: boundary.read_only,
    access_review_report_only: boundary.access_review_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    permission_mutation_performed: boundary.permission_mutation_performed,
    access_grant_performed: boundary.access_grant_performed,
    access_revoke_performed: boundary.access_revoke_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    external_transfer_performed: boundary.external_transfer_performed,
    network_access_performed: boundary.network_access_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validationItems.length,
    failed_checkpoint_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(subjectReviews, "runtime_id"),
    by_matter_decision: countBy(matterAccessRows, "access_decision"),
    by_resource_classification: countBy(resourceAccessRows, "resource_classification"),
  };
  return { ...summary, access_review_report_id: `access-review-report.${dateStamp(generatedAt)}` };
}

function gateResult(gateId, label, violationCount, sourceId, generatedAt) {
  return {
    schema_version: "access-review-gate-result.v1",
    access_review_gate_result_id: `access-review-gate.${slugify(gateId)}`,
    generated_at: generatedAt,
    gate_id: gateId,
    label,
    source_id: sourceId,
    violation_count: violationCount,
    gate_decision: "hold_for_access_review",
    gate_fail_on_violation: true,
    access_mutation_allowed: false,
    permission_change_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    gate_status: violationCount === 0 ? "passed" : "failed",
  };
}

function finding(findingId, label, observedCount, violationCount, sourceId, generatedAt) {
  return {
    schema_version: "access-review-finding.v1",
    access_review_finding_id: `access-review-finding.${slugify(findingId)}`,
    generated_at: generatedAt,
    finding_id: findingId,
    label,
    source_id: sourceId,
    observed_count: observedCount,
    violation_count: violationCount,
    finding_status: violationCount === 0 ? "passed" : "failed",
    human_review_required: true,
    client_facing_ready: false,
  };
}

function reviewStatus(record) {
  if (record.access_decision === "deny") return "denied_reviewable";
  if (record.access_decision === "review") return "human_review_required";
  return "allowed_by_policy_snapshot";
}

function auditCatalog(sources) {
  return sources.access_audit_projection.data?.access_audit_catalog ?? {};
}

function teamContract(sources) {
  return sources.matter_profile_team_ledger.data?.matter_team_contract ?? {};
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    schema_version: "access-review-validation-item.v1",
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderMarkdown(result) {
  const lines = [
    "# Access Review Report",
    "",
    `Generated at: ${result.generated_at}`,
    `Status: ${result.summary.access_review_report_status}`,
    `Phase: ${PHASE_SLOT} (previous ${PREVIOUS_PHASE_SLOT}, next ${NEXT_PHASE_SLOT})`,
    "",
    "## Summary",
    `- Tenant/matter/user subjects: ${result.summary.subject_review_count}`,
    `- Matter/resource rows: ${result.summary.matter_access_row_count}/${result.summary.resource_access_row_count}`,
    `- View allowed/review/denied: ${result.summary.view_allowed_count}/${result.summary.view_requires_human_confirmation_count}/${result.summary.view_denied_count}`,
    `- External runtime retrievable violations: ${result.summary.external_runtime_retrievable_count}`,
    `- Permission mutations performed: ${result.summary.permission_mutation_performed}`,
    `- Human review required: ${result.summary.human_review_required}`,
    "",
    "## Gates",
  ];
  for (const gate of result.access_review_gate_results) {
    lines.push(`- ${gate.gate_id}: ${gate.gate_status} (${gate.violation_count})`);
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

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function summaryOf(artifact) {
  return artifact?.summary ?? {};
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
    return { path: resolvedPath, available: false, data: null, raw: null, content_hash: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    retention_deletion_policy_path: path.resolve(options.retentionDeletionPolicyPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.retentionDeletionPolicyPath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.matterAccessPolicyEvaluatorPath),
    access_audit_projection_path: path.resolve(options.accessAuditProjectionPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.accessAuditProjectionPath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.matterProfileTeamLedgerPath),
    wall_policy_contract_path: path.resolve(options.wallPolicyContractPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.wallPolicyContractPath),
    identity_policy_matter_freeze_path: path.resolve(options.identityPolicyMatterFreezePath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.identityPolicyMatterFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.implementationRoadmapPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.reviewDashboardSourcePath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_ACCESS_REVIEW_REPORT_INPUTS.reviewApiDocPath),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--no-write") options.write = false;
    else if (arg === "--out-dir") options.outDir = argv[++index];
    else if (arg === "--run-at") options.runAt = argv[++index];
    else if (arg === "--retention-deletion-policy") options.retentionDeletionPolicyPath = argv[++index];
    else if (arg === "--matter-access-policy") options.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--access-audit") options.accessAuditProjectionPath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") options.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--wall-policy-contract") options.wallPolicyContractPath = argv[++index];
    else if (arg === "--identity-policy-matter-freeze") options.identityPolicyMatterFreezePath = argv[++index];
    else if (arg === "--package") options.packagePath = argv[++index];
    else if (arg === "--roadmap") options.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") options.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-dashboard-source") options.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--review-api-source") options.reviewApiSourcePath = argv[++index];
    else if (arg === "--review-api-doc") options.reviewApiDocPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function runAccessReviewReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runAccessReviewReport(args);
    console.log(`Access review report written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.access_review_report_status}`);
    console.log(`Subjects: ${result.summary.subject_review_count}`);
    console.log(`Matter/resource rows: ${result.summary.matter_access_row_count}/${result.summary.resource_access_row_count}`);
    console.log(`View allowed/review/denied: ${result.summary.view_allowed_count}/${result.summary.view_requires_human_confirmation_count}/${result.summary.view_denied_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`Usage: node scripts/access-review-report.mjs [options]

Options:
  --check
  --no-write
  --out-dir <path>
  --run-at <iso>
  --retention-deletion-policy <path>
  --matter-access-policy <path>
  --access-audit <path>
  --matter-profile-team-ledger <path>
  --wall-policy-contract <path>
  --identity-policy-matter-freeze <path>`);
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function distinctCount(rows, key) {
  return new Set(rows.map((row) => row[key]).filter((value) => value !== undefined && value !== null)).size;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function textIncludes(source, needle) {
  return Boolean(source?.available && typeof source.raw === "string" && source.raw.includes(needle));
}

function dateStamp(iso) {
  return String(iso).slice(0, 10).replaceAll("-", "");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function sha256(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
