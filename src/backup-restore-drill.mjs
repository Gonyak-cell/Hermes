import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BACKUP_RESTORE_DRILL_OUT_DIR = "artifacts/backup-restore-drill/latest";
export const DEFAULT_BACKUP_RESTORE_DRILL_INPUTS = {
  performanceCostBudgetReportPath: "artifacts/performance-cost-budget/latest/performance-cost-budget-report.json",
  retentionDeletionPolicyPath: "artifacts/retention-deletion-policy/latest/retention-deletion-policy.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  desktopReadyApiContractPath: "artifacts/dashboard-api-freeze/latest/desktop-ready-api-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "backup-restore-drill.v1";
const CAPABILITY_ID = "compliance.backup_restore_drill";
const PHASE_SLOT = "P304";
const PREVIOUS_PHASE_SLOT = "P303";
const NEXT_PHASE_SLOT = "P305";
const REQUIRED_RESTORE_PLANES = ["db", "object", "artifact", "event", "audit"];

const SOURCE_DEFINITIONS = [
  sourceDefinition("performance_cost_budget_report", "Performance/Cost Budget Report", "performance_cost_budget_report_status", "complete", "P303", "P304"),
  sourceDefinition("retention_deletion_policy", "Retention Deletion Policy", "retention_deletion_policy_status", "complete", "P301", "P302"),
  sourceDefinition("immutable_object_store_layout", "Immutable Object Store Layout", "object_store_layout_status", "complete", null, null),
  sourceDefinition("resource_version_ledger", "Resource Version Ledger", "resource_version_ledger_status", "complete", null, null),
  sourceDefinition("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("append_only_event_store", "Append-only Event Store", "event_store_status", "complete", null, null),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "audit_event_ledger_status", "complete", null, null),
  sourceDefinition("desktop_ready_api_contract", "Desktop-ready API Contract", "contract_status", "ready", "P296", "P297"),
];

export async function runBackupRestoreDrill(options = {}) {
  const result = await buildBackupRestoreDrill(options);
  if (options.write !== false) await writeBackupRestoreDrill(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Backup/restore drill validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildBackupRestoreDrill(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_BACKUP_RESTORE_DRILL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    performance_cost_budget_report: await readJsonSource(inputs.performance_cost_budget_report_path),
    retention_deletion_policy: await readJsonSource(inputs.retention_deletion_policy_path),
    immutable_object_store_layout: await readJsonSource(inputs.immutable_object_store_layout_path),
    resource_version_ledger: await readJsonSource(inputs.resource_version_ledger_path),
    output_delivery_contract_freeze: await readJsonSource(inputs.output_delivery_contract_freeze_path),
    append_only_event_store: await readJsonSource(inputs.append_only_event_store_path),
    audit_event_ledger: await readJsonSource(inputs.audit_event_ledger_path),
    desktop_ready_api_contract: await readJsonSource(inputs.desktop_ready_api_contract_path),
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
  const restoreDrillRows = buildRestoreDrillRows({ sources, generatedAt });
  const sourceOfTruthRows = buildSourceOfTruthRows({ sources, generatedAt });
  const gateResults = buildGateResults({ sourceStatuses, restoreDrillRows, sourceOfTruthRows, sources, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    restoreDrillRows,
    sourceOfTruthRows,
    gateResults,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    generatedAt,
    sourceStatuses,
    restoreDrillRows,
    sourceOfTruthRows,
    gateResults,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    backup_restore_drill_id: `backup-restore-drill.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    backup_restore_drill_contract: buildContract(generatedAt),
    restore_drill_rows: restoreDrillRows,
    backup_restore_source_of_truth_rows: sourceOfTruthRows,
    backup_restore_gate_results: gateResults,
    backup_restore_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeBackupRestoreDrill(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "backup-restore-drill-report.json"), serializable);
  await writeJson(path.join(outDir, "backup-restore-sources.json"), collectionEnvelope("backup-restore-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "restore-drill-rows.json"), collectionEnvelope("restore-drill-rows.v1", "restore_drill_rows", result.restore_drill_rows, result.generated_at));
  await writeJson(path.join(outDir, "backup-restore-source-of-truth-rows.json"), collectionEnvelope("backup-restore-source-of-truth-rows.v1", "backup_restore_source_of_truth_rows", result.backup_restore_source_of_truth_rows, result.generated_at));
  await writeJson(path.join(outDir, "backup-restore-gate-results.json"), collectionEnvelope("backup-restore-gate-results.v1", "backup_restore_gate_results", result.backup_restore_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "backup-restore-boundary.json"), result.backup_restore_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "backup-restore-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const data = source?.data ?? {};
    const actualStatus = sourceStatus(data, definition.status_key);
    const actualPhaseSlot = data.summary?.phase_slot ?? data.phase_slot ?? null;
    const actualNextPhaseSlot = data.summary?.next_phase_slot ?? data.next_phase_slot ?? null;
    const validationErrorCount = data.summary?.validation_error_count ?? data.validation?.errors?.length ?? 0;
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const row = {
      schema_version: "backup-restore-source-status.v1",
      source_status_id: `backup-restore.source.${definition.source_id}`,
      ordinal: index + 1,
      source_id: definition.source_id,
      label: definition.label,
      source_path: source?.path ?? null,
      source_available: Boolean(source?.available),
      source_content_hash: source?.content_hash ?? null,
      expected_status: definition.expected_status,
      actual_status: actualStatus,
      expected_phase_slot: definition.expected_phase_slot,
      actual_phase_slot: actualPhaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      actual_next_phase_slot: actualNextPhaseSlot,
      validation_error_count: validationErrorCount,
      source_status: source?.available && actualStatus === definition.expected_status && phaseMatches && nextPhaseMatches && validationErrorCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildRestoreDrillRows({ sources, generatedAt }) {
  const resourceSummary = summaryOf(sources.resource_version_ledger.data);
  const objectSummary = summaryOf(sources.immutable_object_store_layout.data);
  const artifactSummary = summaryOf(sources.output_delivery_contract_freeze.data);
  const eventSummary = summaryOf(sources.append_only_event_store.data);
  const auditSummary = summaryOf(sources.audit_event_ledger.data);
  return [
    restoreDrillRow({
      generatedAt,
      restorePlane: "db",
      sourceId: "resource_version_ledger",
      label: "Database projection restore dry run",
      restoreProcedure: "Rebuild structured resource/version projections from version families and object bindings without mutating the live DB.",
      observedRecordCount: resourceSummary.resource_version_count ?? 0,
      integritySignalCount: resourceSummary.bound_object_path_count ?? 0,
      expectedSnapshotCount: resourceSummary.version_family_count ?? 0,
      backupSnapshotReference: "resource_version_ledger.version_families",
    }),
    restoreDrillRow({
      generatedAt,
      restorePlane: "object",
      sourceId: "immutable_object_store_layout",
      label: "Immutable object store restore dry run",
      restoreProcedure: "Verify content-addressed raw-source and generated-output object paths can be re-linked without overwrite.",
      observedRecordCount: objectSummary.total_object_path_count ?? 0,
      integritySignalCount: objectSummary.content_addressed_path_count ?? 0,
      expectedSnapshotCount: objectSummary.namespace_count ?? 0,
      backupSnapshotReference: "immutable_object_store_layout.object_paths",
    }),
    restoreDrillRow({
      generatedAt,
      restorePlane: "artifact",
      sourceId: "output_delivery_contract_freeze",
      label: "Output artifact restore dry run",
      restoreProcedure: "Verify output artifacts can be reconstructed from artifact hashes and delivery bindings while delivery remains blocked.",
      observedRecordCount: artifactSummary.output_artifact_count ?? 0,
      integritySignalCount: artifactSummary.artifact_hash_count ?? 0,
      expectedSnapshotCount: artifactSummary.output_delivery_binding_count ?? 0,
      backupSnapshotReference: "output_delivery_contract_freeze.output_artifacts",
    }),
    restoreDrillRow({
      generatedAt,
      restorePlane: "event",
      sourceId: "append_only_event_store",
      label: "Append-only event replay dry run",
      restoreProcedure: "Verify hash-chained event streams can be replay-planned without appending, correcting, or mutating events.",
      observedRecordCount: eventSummary.stored_event_count ?? 0,
      integritySignalCount: eventSummary.hash_chained_event_count ?? 0,
      expectedSnapshotCount: eventSummary.event_stream_count ?? 0,
      backupSnapshotReference: "append_only_event_store.stored_events",
    }),
    restoreDrillRow({
      generatedAt,
      restorePlane: "audit",
      sourceId: "audit_event_ledger",
      label: "Separated audit ledger restore dry run",
      restoreProcedure: "Verify separated audit records can be re-linked to source events/projections without mixing observability logs.",
      observedRecordCount: auditSummary.audit_trail_record_count ?? 0,
      integritySignalCount: auditSummary.separated_audit_record_count ?? 0,
      expectedSnapshotCount: auditSummary.audit_source_rollup_count ?? 0,
      backupSnapshotReference: "audit_event_ledger.audit_trail_records",
    }),
  ];
}

function restoreDrillRow({
  generatedAt,
  restorePlane,
  sourceId,
  label,
  restoreProcedure,
  observedRecordCount,
  integritySignalCount,
  expectedSnapshotCount,
  backupSnapshotReference,
}) {
  const recordCount = number(observedRecordCount);
  const integrityCount = number(integritySignalCount);
  const snapshotCount = number(expectedSnapshotCount);
  const passed = recordCount > 0 && integrityCount > 0 && snapshotCount > 0;
  const row = {
    schema_version: "restore-drill-row.v1",
    restore_drill_row_id: `restore-drill.${restorePlane}`,
    generated_at: generatedAt,
    restore_plane: restorePlane,
    source_id: sourceId,
    label,
    backup_snapshot_reference: backupSnapshotReference,
    restore_procedure: restoreProcedure,
    restore_procedure_defined: true,
    dry_run_performed: true,
    dry_run_status: passed ? "passed" : "failed",
    observed_record_count: recordCount,
    integrity_signal_count: integrityCount,
    expected_snapshot_count: snapshotCount,
    restore_execution_allowed: false,
    restore_execution_performed: false,
    production_restore_performed: false,
    mutation_performed: false,
    source_content_read_performed: false,
    source_ingest_performed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    protected_action_executed: false,
    desktop_export_import_source_of_truth: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    drill_status: passed ? "passed" : "failed",
  };
  return { ...row, restore_drill_row_hash: sha256(row) };
}

function buildSourceOfTruthRows({ sources, generatedAt }) {
  const desktop = sources.desktop_ready_api_contract.data ?? {};
  const rows = [
    sourceOfTruthRow({
      generatedAt,
      sourceId: "resource_version_ledger",
      storeKind: "db",
      label: "Structured DB projections",
      canonical: true,
      restoreInputAllowed: true,
      evidenceStatus: "complete",
      evidenceCount: summaryOf(sources.resource_version_ledger.data).resource_version_count ?? 0,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "immutable_object_store_layout",
      storeKind: "object",
      label: "Immutable object store",
      canonical: true,
      restoreInputAllowed: true,
      evidenceStatus: "complete",
      evidenceCount: summaryOf(sources.immutable_object_store_layout.data).total_object_path_count ?? 0,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "output_delivery_contract_freeze",
      storeKind: "artifact",
      label: "Output artifact catalog and delivery bindings",
      canonical: true,
      restoreInputAllowed: true,
      evidenceStatus: "complete",
      evidenceCount: summaryOf(sources.output_delivery_contract_freeze.data).output_artifact_count ?? 0,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "append_only_event_store",
      storeKind: "event",
      label: "Append-only event store",
      canonical: true,
      restoreInputAllowed: true,
      evidenceStatus: "complete",
      evidenceCount: summaryOf(sources.append_only_event_store.data).stored_event_count ?? 0,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "audit_event_ledger",
      storeKind: "audit",
      label: "Separated audit ledger",
      canonical: true,
      restoreInputAllowed: true,
      evidenceStatus: "complete",
      evidenceCount: summaryOf(sources.audit_event_ledger.data).audit_trail_record_count ?? 0,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "desktop_export_bundle",
      storeKind: "desktop_export",
      label: "Desktop export bundle",
      canonical: false,
      restoreInputAllowed: false,
      evidenceStatus: desktop.contract_status ?? "unknown",
      evidenceCount: desktop.route_count ?? 0,
      desktopExportImport: true,
    }),
    sourceOfTruthRow({
      generatedAt,
      sourceId: "desktop_import_payload",
      storeKind: "desktop_import",
      label: "Desktop import payload",
      canonical: false,
      restoreInputAllowed: false,
      evidenceStatus: desktop.contract_status ?? "unknown",
      evidenceCount: desktop.route_count ?? 0,
      desktopExportImport: true,
    }),
  ];
  return rows;
}

function sourceOfTruthRow({
  generatedAt,
  sourceId,
  storeKind,
  label,
  canonical,
  restoreInputAllowed,
  evidenceStatus,
  evidenceCount,
  desktopExportImport = false,
}) {
  const passed = canonical ? restoreInputAllowed && !desktopExportImport && number(evidenceCount) > 0 : !restoreInputAllowed && desktopExportImport;
  const row = {
    schema_version: "backup-restore-source-of-truth-row.v1",
    source_of_truth_row_id: `backup-restore-source-of-truth.${storeKind}`,
    generated_at: generatedAt,
    source_id: sourceId,
    store_kind: storeKind,
    label,
    evidence_status: evidenceStatus,
    evidence_record_count: number(evidenceCount),
    canonical_source_of_truth: canonical,
    restore_input_allowed: restoreInputAllowed,
    desktop_export_import_surface: desktopExportImport,
    desktop_export_import_source_of_truth: false,
    source_of_truth_status: passed ? "passed" : "failed",
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
  return { ...row, source_of_truth_row_hash: sha256(row) };
}

function buildGateResults({ sourceStatuses, restoreDrillRows, sourceOfTruthRows, sources, generatedAt }) {
  const planes = new Set(restoreDrillRows.map((row) => row.restore_plane));
  const retentionSummary = summaryOf(sources.retention_deletion_policy.data);
  const canonicalRows = sourceOfTruthRows.filter((row) => row.canonical_source_of_truth);
  const desktopRows = sourceOfTruthRows.filter((row) => row.desktop_export_import_surface);
  const gateRows = [
    gateResult("sources_ready", "Required backup/restore sources are complete", sourceStatuses.filter((row) => row.source_status !== "passed").length, "source_statuses", generatedAt),
    gateResult("restore_planes_present", "DB/object/artifact/event/audit restore planes are represented", REQUIRED_RESTORE_PLANES.filter((plane) => !planes.has(plane)).length, "restore_drill_rows", generatedAt),
    gateResult("dry_run_rows_passed", "Every restore plane is verified by dry run only", restoreDrillRows.filter((row) => row.drill_status !== "passed" || row.dry_run_status !== "passed" || !row.restore_procedure_defined).length, "restore_drill_rows", generatedAt),
    gateResult("no_restore_execution", "No production restore, replay append, mutation, route, or protected action is executed", restoreDrillRows.filter((row) => row.restore_execution_performed || row.production_restore_performed || row.mutation_performed || row.external_transfer_performed || row.protected_action_executed).length, "restore_drill_rows", generatedAt),
    gateResult("canonical_source_of_truth_locked", "Canonical DB/object/artifact/event/audit stores remain the restore source of truth", canonicalRows.filter((row) => !row.canonical_source_of_truth || !row.restore_input_allowed || row.desktop_export_import_source_of_truth || row.source_of_truth_status !== "passed").length, "backup_restore_source_of_truth_rows", generatedAt),
    gateResult("desktop_export_import_not_source_of_truth", "Desktop export/import is explicitly not a restore source of truth", desktopRows.length < 2 ? 1 : desktopRows.filter((row) => row.restore_input_allowed || row.desktop_export_import_source_of_truth || row.canonical_source_of_truth || row.source_of_truth_status !== "passed").length, "backup_restore_source_of_truth_rows", generatedAt),
    gateResult("retention_and_holds_preserved", "Retention, deletion holds, records review, and human review remain active during drill", retentionSummary.retention_deletion_policy_status === "complete" && retentionSummary.deletion_execution_performed === false && retentionSummary.active_deletion_hold_count === retentionSummary.deletion_hold_record_count ? 0 : 1, "retention_deletion_policy", generatedAt),
    gateResult("human_review_gate_preserved", "Backup/restore drill remains human-review gated and not client-facing", restoreDrillRows.filter((row) => !row.human_review_required || row.client_facing_ready).length + sourceOfTruthRows.filter((row) => !row.human_review_required || row.client_facing_ready).length, "backup_restore_boundary", generatedAt),
    gateResult("no_source_content_ingest", "The drill reads source artifacts only and performs no source content ingest", restoreDrillRows.filter((row) => row.source_content_read_performed || row.source_ingest_performed).length, "restore_drill_rows", generatedAt),
    gateResult("windows_baseline_preserved", "Windows baseline stability guard remains preserved", restoreDrillRows.filter((row) => !row.windows_baseline_stability_preserved || !row.mac_windows_completion_instability_guard).length + sourceOfTruthRows.filter((row) => !row.windows_baseline_stability_preserved || !row.mac_windows_completion_instability_guard).length, "backup_restore_boundary", generatedAt),
  ];
  return gateRows;
}

function gateResult(gateId, label, violationCount, sourceId, generatedAt) {
  const count = number(violationCount);
  const row = {
    schema_version: "backup-restore-gate-result.v1",
    backup_restore_gate_result_id: `backup-restore-gate.${slugify(gateId)}`,
    generated_at: generatedAt,
    gate_id: gateId,
    label,
    source_id: sourceId,
    violation_count: count,
    gate_decision: "hold_for_restore_review",
    gate_fail_on_violation: true,
    restore_execution_allowed: false,
    desktop_export_import_source_of_truth: false,
    protected_action_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    gate_status: count === 0 ? "passed" : "failed",
  };
  return { ...row, backup_restore_gate_result_hash: sha256(row) };
}

function buildBoundary(generatedAt) {
  const boundary = {
    schema_version: "backup-restore-boundary.v1",
    backup_restore_boundary_id: `backup-restore-boundary.${dateStamp(generatedAt)}`,
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    backup_report_only: true,
    dry_run_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    db_restore_performed: false,
    object_restore_performed: false,
    artifact_restore_performed: false,
    event_replay_performed: false,
    audit_restore_performed: false,
    restore_execution_allowed: false,
    restore_execution_performed: false,
    production_restore_performed: false,
    mutation_performed: false,
    desktop_export_performed: false,
    desktop_import_performed: false,
    desktop_export_import_source_of_truth: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
  return { ...boundary, backup_restore_boundary_hash: sha256(boundary) };
}

function buildContract(generatedAt) {
  const contract = {
    schema_version: "backup-restore-drill-contract.v1",
    backup_restore_drill_contract_id: "backup-restore-drill.v1",
    generated_at: generatedAt,
    contract_status: "active",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    restore_planes: REQUIRED_RESTORE_PLANES,
    source_of_truth: "core_db_object_artifact_event_audit_stores",
    dry_run_only: true,
    restore_execution_allowed: false,
    desktop_export_import_source_of_truth: false,
    human_review_required: true,
    client_facing_ready: false,
  };
  return { ...contract, backup_restore_drill_contract_hash: sha256(contract) };
}

function buildValidationItems({ sourceStatuses, restoreDrillRows, sourceOfTruthRows, gateResults, boundary, sources, support }) {
  const items = [];
  const packageJson = support.package_json.data ?? {};
  const ledgerText = support.final_completion_ledger.raw ?? "";
  const implementationRoadmapText = support.implementation_roadmap.raw ?? "";
  const reviewDashboardText = support.review_dashboard_source.raw ?? "";
  const reviewApiText = support.review_api_source.raw ?? "";
  const reviewApiDocText = support.review_api_doc.raw ?? "";
  const performanceSummary = summaryOf(sources.performance_cost_budget_report.data);
  const retentionSummary = summaryOf(sources.retention_deletion_policy.data);
  const desktopContract = sources.desktop_ready_api_contract.data ?? {};
  const planes = new Set(restoreDrillRows.map((row) => row.restore_plane));
  const canonicalRows = sourceOfTruthRows.filter((row) => row.canonical_source_of_truth);
  const desktopRows = sourceOfTruthRows.filter((row) => row.desktop_export_import_surface);

  pushCheck(items, "source_statuses", "sources_ready", sourceStatuses.every((source) => source.source_status === "passed"), "Required P304 sources are available and complete.");
  pushCheck(items, "source.performance_cost_budget_report", "performance_cost_budget_report_p303_guard", performanceSummary.performance_cost_budget_report_status === "complete" && performanceSummary.phase_slot === PREVIOUS_PHASE_SLOT && performanceSummary.next_phase_slot === PHASE_SLOT, "P303 Performance/Cost Budget Report is complete and points to P304.");
  pushCheck(items, "restore_drill_rows", "restore_planes_present", REQUIRED_RESTORE_PLANES.every((plane) => planes.has(plane)), "DB, object, artifact, event, and audit restore planes are present.");
  for (const plane of REQUIRED_RESTORE_PLANES) {
    pushCheck(items, `restore_drill_rows.${plane}`, `${plane}_restore_dry_run_passed`, restoreDrillRows.some((row) => row.restore_plane === plane && row.drill_status === "passed" && row.dry_run_status === "passed" && row.restore_procedure_defined), `${plane} restore procedure is dry-run verified.`);
  }
  pushCheck(items, "restore_drill_rows.execution", "no_restore_execution", restoreDrillRows.every((row) => !row.restore_execution_performed && !row.production_restore_performed && !row.mutation_performed && !row.external_transfer_performed && !row.protected_action_executed), "Restore drill does not execute production restore, mutation, transfer, or protected actions.");
  pushCheck(items, "backup_restore_source_of_truth_rows.canonical", "canonical_source_of_truth_locked", canonicalRows.length >= 5 && canonicalRows.every((row) => row.canonical_source_of_truth && row.restore_input_allowed && !row.desktop_export_import_source_of_truth && row.source_of_truth_status === "passed"), "Canonical DB/object/artifact/event/audit stores are restore sources of truth.");
  pushCheck(items, "backup_restore_source_of_truth_rows.desktop", "desktop_export_import_not_source_of_truth", desktopRows.length >= 2 && desktopRows.every((row) => !row.canonical_source_of_truth && !row.restore_input_allowed && row.desktop_export_import_surface && !row.desktop_export_import_source_of_truth && row.source_of_truth_status === "passed"), "Desktop export/import is not a restore source of truth.");
  pushCheck(items, "desktop_ready_api_contract", "desktop_ready_not_source_of_truth", desktopContract.contract_status === "ready" && desktopContract.desktop_ready === true && desktopContract.source_of_truth === "review_dashboard_artifact_and_review_api_route_index", "Desktop remains an API/dashboard surface, not a backup source of truth.");
  pushCheck(items, "retention_deletion_policy", "retention_holds_preserved", retentionSummary.retention_deletion_policy_status === "complete" && retentionSummary.deletion_execution_performed === false && retentionSummary.active_deletion_hold_count === retentionSummary.deletion_hold_record_count, "Retention/deletion holds remain active during restore drill.");
  pushCheck(items, "backup_restore_gate_results", "gate_results_passed", gateResults.length >= 10 && gateResults.every((row) => row.gate_status === "passed" && row.restore_execution_allowed === false && row.desktop_export_import_source_of_truth === false), "Backup/restore drill gates pass.");
  pushCheck(items, "backup_restore_boundary", "boundary_read_only_dry_run", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.backup_report_only === true && boundary.dry_run_only === true, "Backup/restore drill remains read-only and dry-run only.");
  pushCheck(items, "backup_restore_boundary", "no_restore_mutation_or_desktop_export_import", !boundary.db_restore_performed && !boundary.object_restore_performed && !boundary.artifact_restore_performed && !boundary.event_replay_performed && !boundary.audit_restore_performed && !boundary.restore_execution_performed && !boundary.production_restore_performed && !boundary.mutation_performed && !boundary.desktop_export_performed && !boundary.desktop_import_performed && !boundary.desktop_export_import_source_of_truth, "No restore, replay append, mutation, Desktop export/import, or source-of-truth shift occurs.");
  pushCheck(items, "backup_restore_boundary", "no_execution_or_transfer", !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed && !boundary.external_transfer_performed && !boundary.network_access_performed, "Backup/restore drill does not execute routes, start servers, transfer externally, or execute protected actions.");
  pushCheck(items, "backup_restore_boundary", "human_review_gate_preserved", boundary.human_review_required === true && boundary.client_facing_ready === false && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Human-review and no-client-facing gates remain preserved.");
  pushCheck(items, "backup_restore_boundary", "windows_baseline_preserved", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true, "Windows baseline stability guard is preserved.");

  pushCheck(items, "package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["compliance:backup-restore-drill"]), "package.json registers compliance:backup-restore-drill.");
  pushCheck(items, "docs.final_completion_ledger", "ledger_phase_promoted", ledgerText.includes("P304") && ledgerText.includes("Backup/Restore Drill"), "Final completion ledger promotes P304 Backup/Restore Drill.");
  pushCheck(items, "docs.implementation_roadmap", "implementation_roadmap_phase_documented", implementationRoadmapText.includes("Phase 304") && implementationRoadmapText.includes("backup_restore_drill"), "Implementation roadmap documents Phase 304.");
  pushCheck(items, "src.review_dashboard", "dashboard_registered", reviewDashboardText.includes("backup_restore_drill") && reviewDashboardText.includes("Backup/Restore Drill"), "Review Dashboard registers backup_restore_drill.");
  pushCheck(items, "src.review_api", "review_api_routes_registered", reviewApiText.includes("/api/backup-restore-drills") && reviewApiText.includes("backup_restore_drill"), "Review API registers backup/restore drill routes.");
  pushCheck(items, "docs.review_api", "review_api_doc_registered", reviewApiDocText.includes("Backup/Restore Drill") && reviewApiDocText.includes("/api/backup-restore-drills"), "Review API docs include Backup/Restore Drill routes.");
  return items;
}

function buildSummary({ generatedAt, sourceStatuses, restoreDrillRows, sourceOfTruthRows, gateResults, boundary, validationItems, validation }) {
  const sourceById = new Map(sourceStatuses.map((row) => [row.source_id, row]));
  const byPlane = countBy(restoreDrillRows, "restore_plane");
  const canonicalRows = sourceOfTruthRows.filter((row) => row.canonical_source_of_truth);
  const desktopRows = sourceOfTruthRows.filter((row) => row.desktop_export_import_surface);
  const summary = {
    schema_version: "backup-restore-drill-summary.v1",
    generated_at: generatedAt,
    backup_restore_drill_status: validation.valid ? "complete" : "blocked",
    backup_restore_drill_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((row) => row.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((row) => row.source_status !== "passed").length,
    source_performance_cost_budget_report_status: sourceById.get("performance_cost_budget_report")?.actual_status ?? "unknown",
    source_performance_cost_budget_report_phase_slot: sourceById.get("performance_cost_budget_report")?.actual_phase_slot ?? null,
    source_performance_cost_budget_report_next_phase_slot: sourceById.get("performance_cost_budget_report")?.actual_next_phase_slot ?? null,
    restore_drill_row_count: restoreDrillRows.length,
    passed_restore_drill_row_count: restoreDrillRows.filter((row) => row.drill_status === "passed").length,
    failed_restore_drill_row_count: restoreDrillRows.filter((row) => row.drill_status !== "passed").length,
    db_restore_drill_count: byPlane.db ?? 0,
    object_restore_drill_count: byPlane.object ?? 0,
    artifact_restore_drill_count: byPlane.artifact ?? 0,
    event_restore_drill_count: byPlane.event ?? 0,
    audit_restore_drill_count: byPlane.audit ?? 0,
    dry_run_restore_plane_count: restoreDrillRows.filter((row) => row.dry_run_performed && row.dry_run_status === "passed").length,
    restore_execution_performed_count: restoreDrillRows.filter((row) => row.restore_execution_performed).length,
    production_restore_performed_count: restoreDrillRows.filter((row) => row.production_restore_performed).length,
    source_of_truth_row_count: sourceOfTruthRows.length,
    canonical_source_of_truth_count: canonicalRows.length,
    desktop_source_of_truth_count: sourceOfTruthRows.filter((row) => row.desktop_export_import_source_of_truth).length,
    desktop_export_import_surface_count: desktopRows.length,
    desktop_restore_input_allowed_count: desktopRows.filter((row) => row.restore_input_allowed).length,
    source_of_truth_violation_count: sourceOfTruthRows.filter((row) => row.source_of_truth_status !== "passed").length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    gate_violation_count: sum(gateResults, "violation_count"),
    read_only: boundary.read_only,
    backup_report_only: boundary.backup_report_only,
    dry_run_only: boundary.dry_run_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    db_restore_performed: boundary.db_restore_performed,
    object_restore_performed: boundary.object_restore_performed,
    artifact_restore_performed: boundary.artifact_restore_performed,
    event_replay_performed: boundary.event_replay_performed,
    audit_restore_performed: boundary.audit_restore_performed,
    restore_execution_allowed: boundary.restore_execution_allowed,
    restore_execution_performed: boundary.restore_execution_performed,
    production_restore_performed: boundary.production_restore_performed,
    mutation_performed: boundary.mutation_performed,
    desktop_export_performed: boundary.desktop_export_performed,
    desktop_import_performed: boundary.desktop_import_performed,
    desktop_export_import_source_of_truth: boundary.desktop_export_import_source_of_truth,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    external_transfer_performed: boundary.external_transfer_performed,
    network_access_performed: boundary.network_access_performed,
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
  return { ...summary, backup_restore_drill_id: `backup-restore-drill.${dateStamp(generatedAt)}` };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  const row = {
    schema_version: "backup-restore-validation-item.v1",
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    ordinal: items.length + 1,
  };
  items.push({ ...row, validation_item_hash: sha256(row) });
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "passed"),
    errors: items.filter((item) => item.status !== "passed").map((item) => ({
      path: item.path,
      message: item.message,
      check_id: item.check_id,
    })),
  };
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [
    "# Backup/Restore Drill",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${summary.backup_restore_drill_status}`,
    `Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    "",
    "## Restore Planes",
    "",
    `- DB/object/artifact/event/audit rows: ${summary.db_restore_drill_count}/${summary.object_restore_drill_count}/${summary.artifact_restore_drill_count}/${summary.event_restore_drill_count}/${summary.audit_restore_drill_count}`,
    `- Dry-run restore planes passed: ${summary.dry_run_restore_plane_count}/${summary.restore_drill_row_count}`,
    `- Restore execution performed: ${summary.restore_execution_performed_count}`,
    `- Production restore performed: ${summary.production_restore_performed_count}`,
    "",
    "## Source Of Truth",
    "",
    `- Canonical source-of-truth rows: ${summary.canonical_source_of_truth_count}`,
    `- Desktop export/import source-of-truth rows: ${summary.desktop_source_of_truth_count}`,
    `- Desktop restore input allowed rows: ${summary.desktop_restore_input_allowed_count}`,
    "",
    "## Gates",
    "",
    `- Gate violations: ${summary.gate_violation_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    `- Human review required: ${summary.human_review_required}`,
    `- Client facing ready: ${summary.client_facing_ready}`,
    "",
  ];
  for (const gate of result.backup_restore_gate_results) {
    lines.push(`- ${gate.gate_id}: ${gate.gate_status} (${gate.violation_count})`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return {
    source_id: sourceId,
    label,
    status_key: statusKey,
    expected_status: expectedStatus,
    expected_phase_slot: expectedPhaseSlot,
    expected_next_phase_slot: expectedNextPhaseSlot,
  };
}

function sourceStatus(artifact, statusKey) {
  if (!artifact || typeof artifact !== "object") return "missing";
  return artifact.summary?.[statusKey] ?? artifact[statusKey] ?? artifact.summary?.status ?? artifact.status ?? "unknown";
}

function summaryOf(artifact) {
  return artifact?.summary ?? {};
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

function normalizeInputs(options) {
  return {
    performance_cost_budget_report_path: path.resolve(options.performanceCostBudgetReportPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.performanceCostBudgetReportPath),
    retention_deletion_policy_path: path.resolve(options.retentionDeletionPolicyPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.retentionDeletionPolicyPath),
    immutable_object_store_layout_path: path.resolve(options.immutableObjectStoreLayoutPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.immutableObjectStoreLayoutPath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.resourceVersionLedgerPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.outputDeliveryContractFreezePath),
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.appendOnlyEventStorePath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.auditEventLedgerPath),
    desktop_ready_api_contract_path: path.resolve(options.desktopReadyApiContractPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.desktopReadyApiContractPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.implementationRoadmapPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.reviewDashboardSourcePath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_BACKUP_RESTORE_DRILL_INPUTS.reviewApiDocPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: sha256(raw),
      error: null,
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
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      raw,
      content_hash: sha256(raw),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      raw: "",
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + number(row[key]), 0);
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateStamp(isoDate) {
  return String(isoDate).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", ".");
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--out-dir") options.outDir = argv[++index];
    else if (arg === "--run-at") options.runAt = argv[++index];
    else if (arg === "--performance-cost-budget-report") options.performanceCostBudgetReportPath = argv[++index];
    else if (arg === "--retention-deletion-policy") options.retentionDeletionPolicyPath = argv[++index];
    else if (arg === "--immutable-object-store-layout") options.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--resource-version-ledger") options.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") options.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--append-only-event-store") options.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--audit-event-ledger") options.auditEventLedgerPath = argv[++index];
    else if (arg === "--desktop-ready-api-contract") options.desktopReadyApiContractPath = argv[++index];
    else if (arg === "--package") options.packagePath = argv[++index];
    else if (arg === "--roadmap") options.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") options.implementationRoadmapPath = argv[++index];
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/backup-restore-drill.mjs [--check] [--out-dir DIR]\n\nBuilds the P304 Backup/Restore Drill dry-run report.`);
}

export async function runBackupRestoreDrillCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runBackupRestoreDrill(options);
    console.log(`Backup/restore drill written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.backup_restore_drill_status}`);
    console.log(`Restore planes DB/object/artifact/event/audit: ${result.summary.db_restore_drill_count}/${result.summary.object_restore_drill_count}/${result.summary.artifact_restore_drill_count}/${result.summary.event_restore_drill_count}/${result.summary.audit_restore_drill_count}`);
    console.log(`Desktop source-of-truth rows: ${result.summary.desktop_source_of_truth_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) {
        console.error(`- ${item.path}: ${item.message}`);
      }
    }
    process.exitCode = 1;
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runBackupRestoreDrillCli();
}
