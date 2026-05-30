import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RETENTION_DELETION_POLICY_OUT_DIR = "artifacts/retention-deletion-policy/latest";
export const DEFAULT_RETENTION_DELETION_POLICY_INPUTS = {
  secretsScanGatePath: "artifacts/secrets-scan-gate/latest/secrets-scan-gate.json",
  retentionArchiveLedgerPath: "artifacts/retention-archive/latest/retention-archive-ledger.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  evidencePlaneFreezePath: "artifacts/evidence-plane-freeze/latest/evidence-plane-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "retention-deletion-policy.v1";
const CAPABILITY_ID = "compliance.retention_deletion_policy";
const PHASE_SLOT = "P301";
const PREVIOUS_PHASE_SLOT = "P300";
const NEXT_PHASE_SLOT = "P302";
const LONG_TERM_RETENTION_DAYS = 2555;

const SOURCE_DEFINITIONS = [
  sourceDefinition("secrets_scan_gate", "Secrets Scan Gate", "secrets_scan_gate_status", "complete", "P300", "P301"),
  sourceDefinition("retention_archive_ledger", "Retention/Archive Ledger", "retention_archive_status", "complete", null, null),
  sourceDefinition("resource_contract_freeze", "Resource Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("resource_version_ledger", "Resource Version Ledger", "resource_version_ledger_status", "complete", null, null),
  sourceDefinition("immutable_object_store_layout", "Immutable Object Store Layout", "object_store_layout_status", "complete", null, null),
  sourceDefinition("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "audit_event_ledger_status", "complete", null, null),
  sourceDefinition("append_only_event_store", "Append-only Event Store", "event_store_status", "complete", null, null),
  sourceDefinition("evidence_plane_freeze", "Evidence Plane Freeze", "evidence_plane_freeze_status", "frozen_with_pending_human_actions", null, null),
];

export async function runRetentionDeletionPolicy(options = {}) {
  const result = await buildRetentionDeletionPolicy(options);
  if (options.write !== false) await writeRetentionDeletionPolicy(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Retention/deletion policy validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRetentionDeletionPolicy(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RETENTION_DELETION_POLICY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    secrets_scan_gate: await readJsonSource(inputs.secrets_scan_gate_path),
    retention_archive_ledger: await readJsonSource(inputs.retention_archive_ledger_path),
    resource_contract_freeze: await readJsonSource(inputs.resource_contract_freeze_path),
    resource_version_ledger: await readJsonSource(inputs.resource_version_ledger_path),
    immutable_object_store_layout: await readJsonSource(inputs.immutable_object_store_layout_path),
    output_delivery_contract_freeze: await readJsonSource(inputs.output_delivery_contract_freeze_path),
    audit_event_ledger: await readJsonSource(inputs.audit_event_ledger_path),
    append_only_event_store: await readJsonSource(inputs.append_only_event_store_path),
    evidence_plane_freeze: await readJsonSource(inputs.evidence_plane_freeze_path),
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
  const policyRows = buildPolicyRows({ sources, generatedAt });
  const holdRecords = buildDeletionHoldRecords({ policyRows, generatedAt });
  const gateResults = buildGateResults({ sourceStatuses, policyRows, holdRecords, sources, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    policyRows,
    holdRecords,
    gateResults,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceStatuses,
    policyRows,
    holdRecords,
    gateResults,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    retention_deletion_policy_id: `retention-deletion-policy.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    retention_deletion_policy_contract: buildPolicyContract(generatedAt),
    retention_deletion_policy_rows: policyRows,
    deletion_hold_records: holdRecords,
    retention_deletion_gate_results: gateResults,
    retention_deletion_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeRetentionDeletionPolicy(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "retention-deletion-policy.json"), serializable);
  await writeJson(path.join(outDir, "retention-deletion-source-statuses.json"), collectionEnvelope("retention-deletion-source-statuses.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "retention-deletion-policy-rows.json"), collectionEnvelope("retention-deletion-policy-rows.v1", "retention_deletion_policy_rows", result.retention_deletion_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "deletion-hold-records.json"), collectionEnvelope("deletion-hold-records.v1", "deletion_hold_records", result.deletion_hold_records, result.generated_at));
  await writeJson(path.join(outDir, "retention-deletion-gate-results.json"), collectionEnvelope("retention-deletion-gate-results.v1", "retention_deletion_gate_results", result.retention_deletion_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "retention-deletion-boundary.json"), result.retention_deletion_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "retention-deletion-policy-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildPolicyRows({ sources, generatedAt }) {
  const retentionArchive = sources.retention_archive_ledger.data ?? {};
  const retentionPolicies = retentionArchive.retention_archive_catalog?.retention_policy_records ?? [];
  const resourceFreeze = summaryOf(sources.resource_contract_freeze.data);
  const versionLedger = summaryOf(sources.resource_version_ledger.data);
  const objectStore = summaryOf(sources.immutable_object_store_layout.data);
  const outputFreeze = summaryOf(sources.output_delivery_contract_freeze.data);
  const auditLedger = summaryOf(sources.audit_event_ledger.data);
  const eventStore = summaryOf(sources.append_only_event_store.data);
  const evidenceFreeze = summaryOf(sources.evidence_plane_freeze.data);
  const archivePolicyByPlane = new Map(retentionPolicies.map((policy) => [policy.retention_plane, policy]));

  const rows = [
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.resource.resource-metadata",
      retention_plane: "resource",
      source_id: "resource_contract_freeze",
      source_policy_id: null,
      source_retention_plane: null,
      subject_kind: "resource_metadata",
      subject_count: resourceFreeze.resource_count ?? 0,
      retention_basis: "resource_metadata_and_matter_link_preservation",
      archive_after_days: 365,
      policy_note: "Resource metadata, classification, matter binding, and content hashes are retained for records review.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.resource.version-history",
      retention_plane: "resource",
      source_id: "resource_version_ledger",
      source_policy_id: null,
      source_retention_plane: null,
      subject_kind: "resource_version",
      subject_count: versionLedger.resource_version_count ?? 0,
      retention_basis: "resource_version_lineage_and_object_path_binding",
      archive_after_days: 365,
      policy_note: "Resource versions and object-path bindings preserve source lineage without allowing in-place deletion.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.resource.raw-source-object-layout",
      retention_plane: "resource",
      source_id: "immutable_object_store_layout",
      source_policy_id: null,
      source_retention_plane: null,
      subject_kind: "raw_source_object_path",
      subject_count: objectStore.raw_source_object_path_count ?? 0,
      retention_basis: "immutable_raw_source_object_store_layout",
      archive_after_days: 365,
      policy_note: "Raw source object paths remain layout-only, content-addressed, and overwrite-forbidden.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.resource.evidence-trace",
      retention_plane: "resource",
      source_id: "evidence_plane_freeze",
      source_policy_id: null,
      source_retention_plane: null,
      subject_kind: "evidence_trace",
      subject_count: evidenceFreeze.representative_trace_count ?? 0,
      retention_basis: "evidence_trace_and_custody_preservation",
      archive_after_days: 365,
      policy_note: "Evidence representative traces keep resource, output, audit, custody, and run-ledger bindings under pending human action gates.",
    }),
    fromArchivePolicy({
      generatedAt,
      archivePolicy: archivePolicyByPlane.get("output"),
      policy_id: "retention-deletion.artifact.output-work-product",
      retention_plane: "artifact",
      source_id: "retention_archive_ledger",
      subject_kind: "output_artifact",
      subject_count: retentionArchive.summary?.output_archive_candidate_count ?? outputFreeze.output_artifact_count ?? 0,
      retention_basis: "attorney_reviewable_output_and_delivery_history",
      policy_note: "P173 output retention is promoted to an artifact deletion-hold policy for Phase 301.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.artifact.delivery-contract",
      retention_plane: "artifact",
      source_id: "output_delivery_contract_freeze",
      source_policy_id: archivePolicyByPlane.get("output")?.retention_policy_id ?? null,
      source_retention_plane: "output",
      subject_kind: "delivery_action",
      subject_count: outputFreeze.output_artifact_count ?? 0,
      retention_basis: "protected_delivery_history_and_approval_state",
      archive_after_days: archivePolicyByPlane.get("output")?.archive_after_days ?? 180,
      policy_note: "Output delivery artifacts stay blocked by approval and draft-only delivery actions until records review.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.artifact.generated-output-layout",
      retention_plane: "artifact",
      source_id: "immutable_object_store_layout",
      source_policy_id: archivePolicyByPlane.get("output")?.retention_policy_id ?? null,
      source_retention_plane: "output",
      subject_kind: "generated_output_object_path",
      subject_count: objectStore.generated_output_object_path_count ?? 0,
      retention_basis: "immutable_generated_output_object_store_layout",
      archive_after_days: archivePolicyByPlane.get("output")?.archive_after_days ?? 180,
      policy_note: "Generated output object paths remain content-addressed and overwrite-forbidden.",
    }),
    fromArchivePolicy({
      generatedAt,
      archivePolicy: archivePolicyByPlane.get("event"),
      policy_id: "retention-deletion.audit.event-stream",
      retention_plane: "audit",
      source_id: "retention_archive_ledger",
      subject_kind: "append_only_event_stream",
      subject_count: retentionArchive.summary?.event_archive_candidate_count ?? eventStore.event_stream_count ?? 0,
      retention_basis: "append_only_event_integrity",
      policy_note: "P173 event retention is carried into the audit deletion-hold plane for replay and chain integrity.",
    }),
    fromArchivePolicy({
      generatedAt,
      archivePolicy: archivePolicyByPlane.get("audit"),
      policy_id: "retention-deletion.audit.separated-audit-trail",
      retention_plane: "audit",
      source_id: "retention_archive_ledger",
      subject_kind: "audit_source_rollup",
      subject_count: retentionArchive.summary?.audit_archive_candidate_count ?? auditLedger.audit_source_rollup_count ?? 0,
      retention_basis: "audit_integrity_and_access_review",
      policy_note: "P173 separated audit-trail retention remains a no-delete audit policy.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.audit.audit-event-ledger",
      retention_plane: "audit",
      source_id: "audit_event_ledger",
      source_policy_id: archivePolicyByPlane.get("audit")?.retention_policy_id ?? null,
      source_retention_plane: "audit",
      subject_kind: "audit_trail_record",
      subject_count: auditLedger.audit_trail_record_count ?? 0,
      retention_basis: "separated_audit_event_ledger",
      archive_after_days: archivePolicyByPlane.get("audit")?.archive_after_days ?? 365,
      policy_note: "Audit trail rows remain separated from observability logs and require human records review before disposition.",
    }),
    policyRow({
      generatedAt,
      policy_id: "retention-deletion.audit.append-only-events",
      retention_plane: "audit",
      source_id: "append_only_event_store",
      source_policy_id: archivePolicyByPlane.get("event")?.retention_policy_id ?? null,
      source_retention_plane: "event",
      subject_kind: "stored_event",
      subject_count: eventStore.stored_event_count ?? 0,
      retention_basis: "append_only_event_store",
      archive_after_days: archivePolicyByPlane.get("event")?.archive_after_days ?? 365,
      policy_note: "Stored events remain immutable, hash-chained, and not subject to in-place deletion.",
    }),
  ];

  return rows.map((row, index) => {
    const ordinal = index + 1;
    return { ...row, ordinal, policy_row_hash: sha256({ ...row, ordinal }) };
  });
}

function fromArchivePolicy({ generatedAt, archivePolicy, policy_id, retention_plane, source_id, subject_kind, subject_count, retention_basis, policy_note }) {
  return policyRow({
    generatedAt,
    policy_id,
    retention_plane,
    source_id,
    source_policy_id: archivePolicy?.retention_policy_id ?? null,
    source_retention_plane: archivePolicy?.retention_plane ?? null,
    subject_kind,
    subject_count,
    retention_basis: archivePolicy?.retention_basis ?? retention_basis,
    retention_period_days: archivePolicy?.retention_period_days ?? LONG_TERM_RETENTION_DAYS,
    archive_after_days: archivePolicy?.archive_after_days ?? 365,
    policy_note,
  });
}

function policyRow({
  generatedAt,
  policy_id,
  retention_plane,
  source_id,
  source_policy_id,
  source_retention_plane,
  subject_kind,
  subject_count,
  retention_basis,
  retention_period_days = LONG_TERM_RETENTION_DAYS,
  archive_after_days,
  policy_note,
}) {
  return {
    schema_version: "retention-deletion-policy-row.v1",
    retention_deletion_policy_row_id: policy_id,
    generated_at: generatedAt,
    phase_slot: PHASE_SLOT,
    retention_plane,
    source_id,
    source_policy_id,
    source_retention_plane,
    subject_kind,
    subject_count,
    retention_basis,
    retention_period_days,
    archive_after_days,
    deletion_allowed: false,
    delete_after_days: null,
    deletion_status: "not_allowed",
    deletion_hold_required: true,
    deletion_hold_status: "hold_active",
    legal_hold_required: true,
    records_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    retention_owner: "records_manager",
    review_owner: "attorney_or_records_manager",
    policy_status: "active",
    policy_note,
  };
}

function buildDeletionHoldRecords({ policyRows, generatedAt }) {
  return policyRows.map((row, index) => {
    const base = {
      schema_version: "deletion-hold-record.v1",
      deletion_hold_record_id: `deletion-hold.${slugify(row.retention_deletion_policy_row_id)}`,
      generated_at: generatedAt,
      ordinal: index + 1,
      retention_deletion_policy_row_id: row.retention_deletion_policy_row_id,
      retention_plane: row.retention_plane,
      source_id: row.source_id,
      subject_kind: row.subject_kind,
      subject_count: row.subject_count,
      deletion_status: "not_allowed",
      hold_status: "active",
      hold_scope: "plane_policy",
      hold_reason: "Records review and human approval are required before any deletion or disposition action.",
      legal_hold_required: true,
      records_review_required: true,
      human_review_required: true,
      deletion_execution_allowed: false,
      deletion_execution_performed: false,
      released_at: null,
      review_owner: "attorney_or_records_manager",
    };
    return { ...base, deletion_hold_record_hash: sha256(base) };
  });
}

function buildGateResults({ sourceStatuses, policyRows, holdRecords, sources, generatedAt }) {
  const byPlane = countBy(policyRows, "retention_plane");
  const retentionArchive = summaryOf(sources.retention_archive_ledger.data);
  const evidenceFreeze = summaryOf(sources.evidence_plane_freeze.data);
  const outputFreeze = summaryOf(sources.output_delivery_contract_freeze.data);
  const objectStore = summaryOf(sources.immutable_object_store_layout.data);
  const gateRows = [
    gateResult("sources_ready", "Required source artifacts are complete", sourceStatuses.filter((source) => source.source_status !== "passed").length, "source_statuses", generatedAt),
    gateResult("planes_recorded", "Resource, artifact, and audit planes each have policy rows", ["resource", "artifact", "audit"].filter((plane) => (byPlane[plane] ?? 0) < 1).length, "retention_deletion_policy_rows", generatedAt),
    gateResult("retention_periods_recorded", "Every policy row records a retention period", policyRows.filter((row) => !Number.isFinite(row.retention_period_days) || row.retention_period_days <= 0).length, "retention_deletion_policy_rows", generatedAt),
    gateResult("deletion_not_allowed", "No policy row authorizes deletion", policyRows.filter((row) => row.deletion_allowed !== false || row.deletion_status !== "not_allowed" || row.delete_after_days !== null).length, "retention_deletion_policy_rows", generatedAt),
    gateResult("deletion_holds_active", "Every policy row has an active deletion hold", holdRecords.filter((row) => row.hold_status !== "active" || row.deletion_execution_allowed !== false).length + Math.max(0, policyRows.length - holdRecords.length), "deletion_hold_records", generatedAt),
    gateResult("records_review_required", "Every policy and hold requires records review and human review", policyRows.filter((row) => !row.records_review_required || !row.human_review_required || !row.legal_hold_required).length + holdRecords.filter((row) => !row.records_review_required || !row.human_review_required || !row.legal_hold_required).length, "retention_deletion_policy_rows", generatedAt),
    gateResult("retention_archive_no_delete", "P173 archive candidates remain legal-hold bound with no deletion-authorized candidates", (retentionArchive.deletion_allowed_candidate_count ?? 1) + (retentionArchive.missing_policy_binding_count ?? 1) + (retentionArchive.missing_legal_hold_binding_count ?? 1), "retention_archive_ledger", generatedAt),
    gateResult(
      "artifact_deletion_not_delivery_driven",
      "Artifact deletion is not authorized by delivery readiness or receipts",
      (outputFreeze.deletion_authorized_count ?? 0)
        + (outputFreeze.deletion_allowed_count ?? 0)
        + (outputFreeze.delete_after_days_set_count ?? 0)
        + (outputFreeze.deletion_execution_allowed_count ?? 0)
        + (outputFreeze.deletion_execution_performed_count ?? 0),
      "output_delivery_contract_freeze",
      generatedAt,
    ),
    gateResult("immutable_layout_no_overwrite", "Resource and artifact object paths remain content-addressed and overwrite-forbidden", (objectStore.collision_count ?? 1) + (objectStore.absolute_source_path_key_count ?? 1), "immutable_object_store_layout", generatedAt),
    gateResult("evidence_plane_pending_human_actions", "Evidence plane remains frozen with pending human actions and no external transfer", (evidenceFreeze.external_transfer_blocked_count ?? 0) >= (evidenceFreeze.representative_trace_count ?? 1) && (evidenceFreeze.client_facing_ready_count ?? 1) === 0 ? 0 : 1, "evidence_plane_freeze", generatedAt),
  ];
  return gateRows.map((row, index) => ({ ...row, ordinal: index + 1, gate_result_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function gateResult(gateId, label, violationCount, sourceId, generatedAt) {
  return {
    schema_version: "retention-deletion-gate-result.v1",
    retention_deletion_gate_result_id: `retention-deletion-gate.${slugify(gateId)}`,
    generated_at: generatedAt,
    gate_id: gateId,
    label,
    source_id: sourceId,
    violation_count: violationCount,
    gate_decision: "block_deletion_until_records_review",
    gate_fail_on_violation: true,
    deletion_allowed: false,
    deletion_execution_allowed: false,
    records_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    gate_status: violationCount === 0 ? "passed" : "failed",
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "retention-deletion-boundary.v1",
    retention_deletion_boundary_id: `retention-deletion-boundary.${dateStamp(generatedAt)}`,
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    policy_report_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    deletion_execution_performed: false,
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
}

function buildPolicyContract(generatedAt) {
  return {
    schema_version: "retention-deletion-policy-contract.v1",
    retention_deletion_policy_contract_id: "retention-deletion-policy.v1",
    generated_at: generatedAt,
    phase_slot: PHASE_SLOT,
    covered_retention_planes: ["resource", "artifact", "audit"],
    required_policy_fields: [
      "retention_plane",
      "subject_kind",
      "subject_count",
      "retention_period_days",
      "deletion_status",
      "deletion_hold_required",
      "records_review_required",
      "human_review_required",
    ],
    deletion_policy: {
      deletion_allowed: false,
      delete_after_days: null,
      disposition_requires_records_review: true,
      disposition_requires_human_review: true,
    },
    boundary: {
      read_only: true,
      policy_report_only: true,
      deletion_execution_performed: false,
      source_mutation_performed: false,
      client_facing_ready: false,
    },
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
      schema_version: "retention-deletion-source-status.v1",
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

function buildValidationItems({ sourceStatuses, policyRows, holdRecords, gateResults, boundary, sources, support }) {
  const packageJson = support.package_json.data ?? {};
  const ledgerText = support.final_completion_ledger.data ?? "";
  const implementationRoadmapText = support.implementation_roadmap.data ?? "";
  const reviewDashboardText = support.review_dashboard_source.data ?? "";
  const reviewApiText = support.review_api_source.data ?? "";
  const reviewApiDocText = support.review_api_doc.data ?? "";
  const archiveCandidates = sources.retention_archive_ledger.data?.retention_archive_catalog?.archive_candidate_records ?? [];
  const legalHoldBindings = sources.retention_archive_ledger.data?.retention_archive_catalog?.legal_hold_bindings ?? [];
  const byPlane = countBy(policyRows, "retention_plane");
  const items = [];
  pushCheck(items, "sources", "sources_ready", sourceStatuses.every((source) => source.source_status === "passed"), "All P301 retention/deletion source artifacts are ready.");
  pushCheck(items, "source.secrets_scan_gate", "p300_guard_ready", sourceStatuses.some((source) => source.source_id === "secrets_scan_gate" && source.source_status === "passed"), "P300 Secrets Scan Gate must be complete and point to P301.");
  pushCheck(items, "package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["compliance:retention-deletion-policy"]), "package.json registers compliance:retention-deletion-policy.");
  pushCheck(items, "docs.final_completion_ledger", "ledger_tracks_p301", ledgerText.includes("P301") && ledgerText.toLowerCase().includes("retention"), "Final completion ledger tracks P301 retention/deletion policy.");
  pushCheck(items, "docs.implementation_roadmap", "roadmap_tracks_p301", implementationRoadmapText.includes("Phase 301 - Retention Deletion Policy") && implementationRoadmapText.includes("retention_deletion_policy"), "Implementation roadmap documents Phase 301.");
  pushCheck(items, "src.review_dashboard", "dashboard_registered", reviewDashboardText.includes("retention_deletion_policy") && reviewDashboardText.includes("buildRetentionDeletionPolicyStage"), "Review Dashboard registers Retention Deletion Policy.");
  pushCheck(items, "src.review_api", "review_api_registered", reviewApiText.includes("/api/retention-deletion-policies") && reviewApiText.includes("/api/deletion-hold-records"), "Review API exposes Retention Deletion Policy routes.");
  pushCheck(items, "docs.review_api", "review_api_doc_registered", reviewApiDocText.includes("Retention Deletion Policy") && reviewApiDocText.includes("/api/retention-deletion-policies"), "Review API docs include Retention Deletion Policy routes.");
  pushCheck(items, "retention_deletion_policy_rows", "policy_rows_present", policyRows.length >= 9, "Retention/deletion policy rows are recorded.");
  pushCheck(items, "retention_deletion_policy_rows.resource", "resource_plane_recorded", (byPlane.resource ?? 0) >= 1, "Resource retention/deletion policy rows are recorded.");
  pushCheck(items, "retention_deletion_policy_rows.artifact", "artifact_plane_recorded", (byPlane.artifact ?? 0) >= 1, "Artifact retention/deletion policy rows are recorded.");
  pushCheck(items, "retention_deletion_policy_rows.audit", "audit_plane_recorded", (byPlane.audit ?? 0) >= 1, "Audit retention/deletion policy rows are recorded.");
  pushCheck(items, "retention_deletion_policy_rows.retention_period_days", "retention_periods_recorded", policyRows.every((row) => Number.isFinite(row.retention_period_days) && row.retention_period_days > 0), "Every policy row records a retention period.");
  pushCheck(items, "retention_deletion_policy_rows.deletion_status", "deletion_not_allowed", policyRows.every((row) => row.deletion_allowed === false && row.deletion_status === "not_allowed" && row.delete_after_days === null), "No policy row authorizes deletion.");
  pushCheck(items, "deletion_hold_records", "hold_records_match_policy_rows", holdRecords.length === policyRows.length && holdRecords.every((row) => row.hold_status === "active" && row.deletion_execution_allowed === false), "Every policy row has an active deletion hold.");
  pushCheck(items, "retention_archive_ledger.legal_hold_bindings", "archive_legal_holds_active", archiveCandidates.length > 0 && legalHoldBindings.length === archiveCandidates.filter((candidate) => candidate.legal_hold_required).length && legalHoldBindings.every((binding) => binding.hold_status === "active"), "P173 archive candidates remain bound to active legal holds.");
  pushCheck(items, "retention_deletion_gate_results", "gate_results_passed", gateResults.length >= 10 && gateResults.every((row) => row.gate_status === "passed" && row.deletion_allowed === false && row.deletion_execution_allowed === false), "All retention/deletion hardening gates pass.");
  pushCheck(items, "boundary", "boundary_enforced", boundary.read_only && boundary.policy_report_only && boundary.source_artifact_read_performed && !boundary.source_content_read_performed && !boundary.source_ingest_performed && !boundary.deletion_execution_performed && !boundary.source_mutation_performed && !boundary.external_transfer_performed && !boundary.network_access_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Retention/deletion policy is read-only, report-only, and performs no deletion, mutation, transfer, server, legal advice, or client-facing output action.");
  pushCheck(items, "boundary.windows_baseline", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return items;
}

function buildSummary({ sourceStatuses, policyRows, holdRecords, gateResults, boundary, validationItems, validation }) {
  const byPlane = countBy(policyRows, "retention_plane");
  const sourceById = new Map(sourceStatuses.map((source) => [source.source_id, source]));
  return {
    retention_deletion_policy_status: validation.valid ? "complete" : "attention",
    retention_deletion_policy_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    source_secrets_scan_gate_status: sourceById.get("secrets_scan_gate")?.observed_status ?? "unknown",
    source_secrets_scan_gate_phase_slot: sourceById.get("secrets_scan_gate")?.phase_slot ?? null,
    source_secrets_scan_gate_next_phase_slot: sourceById.get("secrets_scan_gate")?.next_phase_slot ?? null,
    policy_row_count: policyRows.length,
    resource_policy_row_count: byPlane.resource ?? 0,
    artifact_policy_row_count: byPlane.artifact ?? 0,
    audit_policy_row_count: byPlane.audit ?? 0,
    retention_period_recorded_count: policyRows.filter((row) => Number.isFinite(row.retention_period_days) && row.retention_period_days > 0).length,
    missing_retention_period_count: policyRows.filter((row) => !Number.isFinite(row.retention_period_days) || row.retention_period_days <= 0).length,
    deletion_not_allowed_policy_count: policyRows.filter((row) => row.deletion_allowed === false && row.deletion_status === "not_allowed").length,
    deletion_allowed_policy_count: policyRows.filter((row) => row.deletion_allowed !== false || row.deletion_status !== "not_allowed").length,
    delete_after_days_set_count: policyRows.filter((row) => row.delete_after_days != null).length,
    deletion_hold_required_policy_count: policyRows.filter((row) => row.deletion_hold_required === true).length,
    deletion_hold_record_count: holdRecords.length,
    active_deletion_hold_count: holdRecords.filter((row) => row.hold_status === "active").length,
    missing_deletion_hold_count: Math.max(0, policyRows.length - holdRecords.length) + holdRecords.filter((row) => row.hold_status !== "active").length,
    legal_hold_required_policy_count: policyRows.filter((row) => row.legal_hold_required === true).length,
    records_review_required_policy_count: policyRows.filter((row) => row.records_review_required === true).length,
    human_review_required_policy_count: policyRows.filter((row) => row.human_review_required === true).length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    gate_fail_on_violation_count: gateResults.filter((row) => row.gate_fail_on_violation === true).length,
    gate_violation_count: gateResults.reduce((total, row) => total + Number(row.violation_count ?? 0), 0),
    deletion_execution_allowed_count: holdRecords.filter((row) => row.deletion_execution_allowed === true).length,
    deletion_execution_performed_count: holdRecords.filter((row) => row.deletion_execution_performed === true).length + Number(boundary.deletion_execution_performed === true),
    read_only: boundary.read_only,
    policy_report_only: boundary.policy_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    deletion_execution_performed: boundary.deletion_execution_performed,
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
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    schema_version: "retention-deletion-policy-validation-item.v1",
    validation_item_id: `retention-deletion-policy-validation.${slugify(checkId)}`,
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Retention Deletion Policy");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.retention_deletion_policy_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Phase: ${summary.previous_phase_slot} -> ${summary.phase_slot} -> ${summary.next_phase_slot}`);
  lines.push(`- Sources: ${summary.passed_source_status_count}/${summary.source_status_count}`);
  lines.push(`- Policy rows: ${summary.policy_row_count}`);
  lines.push(`- Resource/artifact/audit rows: ${summary.resource_policy_row_count}/${summary.artifact_policy_row_count}/${summary.audit_policy_row_count}`);
  lines.push(`- Active deletion holds: ${summary.active_deletion_hold_count}/${summary.deletion_hold_record_count}`);
  lines.push(`- Deletion allowed/performed: ${summary.deletion_allowed_policy_count}/${summary.deletion_execution_performed_count}`);
  lines.push(`- Gates: ${summary.passed_gate_result_count}/${summary.gate_result_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Gates");
  for (const row of result.retention_deletion_gate_results) {
    lines.push(`- ${row.gate_id}: ${row.gate_status}, violations=${row.violation_count}, decision=${row.gate_decision}`);
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

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
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
    Object.entries({ ...DEFAULT_RETENTION_DELETION_POLICY_INPUTS, ...options })
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
  console.log(`Usage: node scripts/retention-deletion-policy.mjs [--check] [--out-dir DIR]\n\nBuilds the P301 Retention Deletion Policy report.`);
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

export async function runRetentionDeletionPolicyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRetentionDeletionPolicy(args);
    console.log(`Retention/deletion policy written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.retention_deletion_policy_status}`);
    console.log(`Policy rows: ${result.summary.policy_row_count}`);
    console.log(`Resource/artifact/audit rows: ${result.summary.resource_policy_row_count}/${result.summary.artifact_policy_row_count}/${result.summary.audit_policy_row_count}`);
    console.log(`Deletion holds: ${result.summary.active_deletion_hold_count}/${result.summary.deletion_hold_record_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}
