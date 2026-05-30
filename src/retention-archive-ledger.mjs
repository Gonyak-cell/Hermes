import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RETENTION_ARCHIVE_LEDGER_OUT_DIR = "artifacts/retention-archive/latest";
export const DEFAULT_RETENTION_ARCHIVE_LEDGER_INPUTS = {
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const RETENTION_ARCHIVE_LEDGER_SCHEMA_VERSION = "retention-archive-ledger.v1";
const RETENTION_ARCHIVE_CONTRACT_SCHEMA_VERSION = "retention-archive-contract.v1";
const RETENTION_POLICY_RECORD_SCHEMA_VERSION = "retention-policy-record.v1";
const ARCHIVE_CANDIDATE_RECORD_SCHEMA_VERSION = "archive-candidate-record.v1";
const LEGAL_HOLD_BINDING_SCHEMA_VERSION = "legal-hold-binding.v1";
const RETENTION_ARCHIVE_CONTRACT_ID = "retention-archive-ledger.v1";
const LONG_TERM_RETENTION_DAYS = 2555;

export async function runRetentionArchiveLedger(options = {}) {
  const result = await buildRetentionArchiveLedger(options);
  if (options.write !== false) await writeRetentionArchiveLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Retention/archive ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRetentionArchiveLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RETENTION_ARCHIVE_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    appendOnlyEventStore: await readJsonOrError(inputs.append_only_event_store_path),
    auditEventLedger: await readJsonOrError(inputs.audit_event_ledger_path),
    outputArtifactCatalog: await readJsonOrError(inputs.output_artifact_catalog_path),
    packageJson: await readJsonOrError(inputs.package_path),
  };
  const roadmap = await readTextOrError(inputs.roadmap_path);
  const projection = buildRetentionArchiveProjection({
    appendOnlyEventStore: sources.appendOnlyEventStore.value ?? {},
    auditEventLedger: sources.auditEventLedger.value ?? {},
    outputArtifactCatalog: sources.outputArtifactCatalog.value ?? {},
    generatedAt,
  });
  const validationItems = validateRetentionArchiveLedger({
    sources,
    roadmap,
    packageJson: sources.packageJson.value ?? {},
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: RETENTION_ARCHIVE_LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    retention_archive_ledger_id: `retention-archive-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    retention_archive_contract: buildRetentionArchiveContract(generatedAt),
    retention_archive_catalog: {
      schema_version: "retention-archive-catalog.v1",
      generated_at: generatedAt,
      retention_policy_records: projection.retentionPolicyRecords,
      archive_candidate_records: projection.archiveCandidateRecords,
      legal_hold_bindings: projection.legalHoldBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeRetentionArchiveLedger({
      sources,
      validation,
      validationItems,
      ...projection,
    }),
  };
  return {
    ...result,
    markdown: renderRetentionArchiveLedgerMarkdown(result),
  };
}

export async function writeRetentionArchiveLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "retention-archive-ledger.json"), serializableRetentionArchiveLedger(result));
  await writeJson(path.join(outDir, "retention-policy-records.json"), {
    schema_version: "retention-policy-records.v1",
    generated_at: result.generated_at,
    retention_policy_record_count: result.retention_archive_catalog.retention_policy_records.length,
    retention_policy_records: result.retention_archive_catalog.retention_policy_records,
  });
  await writeJson(path.join(outDir, "archive-candidate-records.json"), {
    schema_version: "archive-candidate-records.v1",
    generated_at: result.generated_at,
    archive_candidate_record_count: result.retention_archive_catalog.archive_candidate_records.length,
    archive_candidate_records: result.retention_archive_catalog.archive_candidate_records,
  });
  await writeJson(path.join(outDir, "legal-hold-bindings.json"), {
    schema_version: "legal-hold-bindings.v1",
    generated_at: result.generated_at,
    legal_hold_binding_count: result.retention_archive_catalog.legal_hold_bindings.length,
    legal_hold_bindings: result.retention_archive_catalog.legal_hold_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "retention-archive-ledger-validation-report.v1",
    generated_at: result.generated_at,
    retention_archive_ledger_id: result.retention_archive_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRetentionArchiveLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRetentionArchiveLedger(args);
    console.log(`Retention/archive ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.retention_archive_status}`);
    console.log(`Policies: ${result.summary.retention_policy_count}`);
    console.log(`Archive candidates: ${result.summary.archive_candidate_count}`);
    console.log(`Legal hold bindings: ${result.summary.legal_hold_binding_count}`);
    console.log(`Deletion allowed candidates: ${result.summary.deletion_allowed_candidate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRetentionArchiveProjection({
  appendOnlyEventStore,
  auditEventLedger,
  outputArtifactCatalog,
  generatedAt,
}) {
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const eventStreams = appendOnlyEventStore.event_store_catalog?.event_streams ?? [];
  const auditRecords = auditEventLedger.audit_event_catalog?.audit_trail_records ?? [];
  const auditSourceRollups = auditEventLedger.audit_event_catalog?.audit_source_rollups ?? [];
  const outputArtifacts = outputArtifactCatalog.artifacts ?? [];
  const retentionPolicyRecords = buildRetentionPolicyRecords({
    appendOnlyEventStore,
    auditEventLedger,
    outputArtifactCatalog,
    storedEvents,
    auditRecords,
    outputArtifacts,
    generatedAt,
  });
  const policyByPlane = new Map(retentionPolicyRecords.map((policy) => [policy.retention_plane, policy]));
  const archiveCandidateRecords = [
    ...buildEventArchiveCandidates({ eventStreams, storedEvents, policy: policyByPlane.get("event"), generatedAt }),
    ...buildAuditArchiveCandidates({ auditSourceRollups, auditRecords, policy: policyByPlane.get("audit"), generatedAt }),
    ...buildOutputArchiveCandidates({ outputArtifacts, policy: policyByPlane.get("output"), generatedAt }),
  ].sort(by("archive_candidate_id"));
  const legalHoldBindings = archiveCandidateRecords
    .filter((candidate) => candidate.legal_hold_required)
    .map((candidate) => buildLegalHoldBinding(candidate, generatedAt))
    .sort(by("legal_hold_binding_id"));
  return { retentionPolicyRecords, archiveCandidateRecords, legalHoldBindings };
}

function buildRetentionPolicyRecords({
  appendOnlyEventStore,
  auditEventLedger,
  outputArtifactCatalog,
  storedEvents,
  auditRecords,
  outputArtifacts,
  generatedAt,
}) {
  return [
    policyRecord({
      generatedAt,
      retention_policy_id: "retention-policy.event.append-only-store",
      retention_plane: "event",
      source_kind: "append_only_event_store",
      source_record_count: appendOnlyEventStore.summary?.stored_event_count ?? storedEvents.length,
      retention_basis: "append_only_event_integrity",
      archive_after_days: 365,
      policy_note: "Append-only events preserve replay, causation, and immutable chain evidence.",
    }),
    policyRecord({
      generatedAt,
      retention_policy_id: "retention-policy.audit.separated-audit-trail",
      retention_plane: "audit",
      source_kind: "audit_event_ledger",
      source_record_count: auditEventLedger.summary?.audit_trail_record_count ?? auditRecords.length,
      retention_basis: "audit_integrity_and_access_review",
      archive_after_days: 365,
      policy_note: "Separated audit records remain audit-plane records and are not compressed into observability logs.",
    }),
    policyRecord({
      generatedAt,
      retention_policy_id: "retention-policy.output.attorney-reviewable-work-product",
      retention_plane: "output",
      source_kind: "output_artifact_catalog",
      source_record_count: outputArtifactCatalog.summary?.artifact_count ?? outputArtifacts.length,
      retention_basis: "attorney_reviewable_output_and_delivery_history",
      archive_after_days: 180,
      policy_note: "Output artifacts are retained with human-review and delivery state until records management approves a later disposition.",
    }),
  ];
}

function policyRecord({
  generatedAt,
  retention_policy_id,
  retention_plane,
  source_kind,
  source_record_count,
  retention_basis,
  archive_after_days,
  policy_note,
}) {
  const base = {
    schema_version: RETENTION_POLICY_RECORD_SCHEMA_VERSION,
    retention_policy_id,
    retention_plane,
    source_kind,
    source_record_count,
    retention_basis,
    retention_period_days: LONG_TERM_RETENTION_DAYS,
    archive_after_days,
    deletion_allowed: false,
    delete_after_days: null,
    legal_hold_required: true,
    human_review_required: true,
    retention_owner: "records_manager",
    review_owner: "attorney_or_records_manager",
    policy_status: "active",
    policy_note,
    generated_at: generatedAt,
  };
  return {
    ...base,
    retention_policy_hash: hashValue(base),
  };
}

function buildEventArchiveCandidates({ eventStreams, storedEvents, policy, generatedAt }) {
  const eventsByStream = groupBy(storedEvents, "event_stream_id");
  return eventStreams.map((stream) => {
    const events = eventsByStream.get(stream.event_stream_id) ?? [];
    const tenantIds = sortedUnique(events.map((event) => event.tenant_id));
    const matterIds = sortedUnique(events.map((event) => event.matter_id));
    const workflowRunIds = sortedUnique(events.map((event) => event.workflow_run_id));
    const base = {
      schema_version: ARCHIVE_CANDIDATE_RECORD_SCHEMA_VERSION,
      archive_candidate_id: `archive-candidate.event.${slugify(stream.event_stream_id)}`,
      retention_plane: "event",
      retention_policy_id: policy?.retention_policy_id ?? null,
      source_kind: "event_stream",
      source_record_id: stream.event_stream_id,
      source_record_count: stream.event_count ?? events.length,
      tenant_id: tenantIds.length === 1 ? tenantIds[0] : null,
      matter_id: matterIds.length === 1 ? matterIds[0] : null,
      matter_ids: matterIds,
      workflow_run_ids: workflowRunIds,
      artifact_id: null,
      first_recorded_at: minDate(events.map((event) => event.event_time)) ?? stream.first_event_time ?? null,
      last_recorded_at: maxDate(events.map((event) => event.event_time)) ?? stream.last_event_time ?? null,
      archive_state: "retain_active",
      archive_action: "preserve_append_only_chain",
      retention_basis: policy?.retention_basis ?? "append_only_event_integrity",
      retention_period_days: policy?.retention_period_days ?? LONG_TERM_RETENTION_DAYS,
      archive_after_days: policy?.archive_after_days ?? 365,
      deletion_allowed: false,
      deletion_status: "not_allowed",
      legal_hold_required: true,
      legal_hold_status: "hold_required",
      human_review_required: true,
      human_review_status: "required",
      content_hash: stream.last_chain_hash ?? last(events)?.chain_hash ?? null,
      generated_at: generatedAt,
    };
    return withCandidateHash(base);
  });
}

function buildAuditArchiveCandidates({ auditSourceRollups, auditRecords, policy, generatedAt }) {
  return auditSourceRollups.map((rollup) => {
    const matchingRecords = auditRecords.filter((record) => record.source_kind === rollup.source_kind && record.audit_domain === rollup.audit_domain);
    const tenantIds = sortedUnique(matchingRecords.map((record) => record.tenant_id));
    const matterIds = sortedUnique(matchingRecords.map((record) => record.matter_id));
    const workflowRunIds = sortedUnique(matchingRecords.map((record) => record.workflow_run_id));
    const base = {
      schema_version: ARCHIVE_CANDIDATE_RECORD_SCHEMA_VERSION,
      archive_candidate_id: `archive-candidate.audit.${slugify(rollup.audit_source_rollup_id)}`,
      retention_plane: "audit",
      retention_policy_id: policy?.retention_policy_id ?? null,
      source_kind: "audit_source_rollup",
      source_record_id: rollup.audit_source_rollup_id,
      source_record_count: rollup.audit_record_count ?? matchingRecords.length,
      tenant_id: tenantIds.length === 1 ? tenantIds[0] : null,
      matter_id: matterIds.length === 1 ? matterIds[0] : null,
      matter_ids: matterIds,
      workflow_run_ids: workflowRunIds,
      artifact_id: null,
      first_recorded_at: minDate(matchingRecords.map((record) => record.recorded_at)) ?? null,
      last_recorded_at: maxDate(matchingRecords.map((record) => record.recorded_at)) ?? null,
      archive_state: "retain_active",
      archive_action: "preserve_separated_audit_trail",
      retention_basis: policy?.retention_basis ?? "audit_integrity_and_access_review",
      retention_period_days: policy?.retention_period_days ?? LONG_TERM_RETENTION_DAYS,
      archive_after_days: policy?.archive_after_days ?? 365,
      deletion_allowed: false,
      deletion_status: "not_allowed",
      legal_hold_required: true,
      legal_hold_status: "hold_required",
      human_review_required: true,
      human_review_status: "required",
      content_hash: hashValue({
        audit_source_rollup_id: rollup.audit_source_rollup_id,
        audit_record_ids: matchingRecords.map((record) => record.audit_trail_record_id).sort(),
      }),
      generated_at: generatedAt,
    };
    return withCandidateHash(base);
  });
}

function buildOutputArchiveCandidates({ outputArtifacts, policy, generatedAt }) {
  return outputArtifacts.map((artifact) => {
    const base = {
      schema_version: ARCHIVE_CANDIDATE_RECORD_SCHEMA_VERSION,
      archive_candidate_id: `archive-candidate.output.${slugify(artifact.artifact_id)}`,
      retention_plane: "output",
      retention_policy_id: policy?.retention_policy_id ?? null,
      source_kind: "output_artifact",
      source_record_id: artifact.artifact_id,
      source_record_count: 1,
      tenant_id: artifact.tenant_id ?? null,
      matter_id: artifact.matter_id ?? null,
      matter_ids: artifact.matter_id ? [artifact.matter_id] : [],
      workflow_run_ids: artifact.workflow_run_id ? [artifact.workflow_run_id] : [],
      artifact_id: artifact.artifact_id,
      first_recorded_at: artifact.created_at ?? null,
      last_recorded_at: artifact.created_at ?? null,
      archive_state: "retain_active",
      archive_action: outputArchiveAction(artifact),
      retention_basis: policy?.retention_basis ?? "attorney_reviewable_output_and_delivery_history",
      retention_period_days: policy?.retention_period_days ?? LONG_TERM_RETENTION_DAYS,
      archive_after_days: policy?.archive_after_days ?? 180,
      deletion_allowed: false,
      deletion_status: "not_allowed",
      legal_hold_required: true,
      legal_hold_status: "hold_required",
      human_review_required: true,
      human_review_status: artifact.approval_status === "approved" && artifact.delivery_state === "delivered" ? "completed" : "required",
      output_status: artifact.status ?? null,
      delivery_state: artifact.delivery_state ?? null,
      approval_status: artifact.approval_status ?? null,
      content_hash: normalizeHash(artifact.content_hash),
      generated_at: generatedAt,
    };
    return withCandidateHash(base);
  });
}

function outputArchiveAction(artifact) {
  if (artifact.delivery_state === "delivered") return "retain_delivery_record";
  if (artifact.approval_status === "pending" || artifact.delivery_state?.startsWith("blocked_")) return "retain_for_human_review";
  return "retain_output_record";
}

function buildLegalHoldBinding(candidate, generatedAt) {
  const holdScope = candidate.matter_id ? "matter" : candidate.tenant_id ? "tenant" : "system";
  const base = {
    schema_version: LEGAL_HOLD_BINDING_SCHEMA_VERSION,
    legal_hold_binding_id: `legal-hold-binding.${slugify(candidate.archive_candidate_id)}`,
    archive_candidate_id: candidate.archive_candidate_id,
    retention_policy_id: candidate.retention_policy_id,
    retention_plane: candidate.retention_plane,
    source_kind: candidate.source_kind,
    source_record_id: candidate.source_record_id,
    tenant_id: candidate.tenant_id,
    matter_id: candidate.matter_id,
    matter_ids: candidate.matter_ids ?? [],
    hold_scope: holdScope,
    hold_reason: holdReason(candidate),
    hold_status: "active",
    released_at: null,
    review_owner: "attorney_or_records_manager",
    generated_at: generatedAt,
  };
  return {
    ...base,
    legal_hold_binding_hash: hashValue(base),
  };
}

function holdReason(candidate) {
  if (candidate.retention_plane === "event") return "Preserve event replay and append-only chain integrity for matter operations.";
  if (candidate.retention_plane === "audit") return "Preserve security, access, and approval audit trail for protected actions.";
  return "Preserve attorney-reviewable output and delivery state until human records review.";
}

function buildSourceContracts(sources, inputs) {
  const appendOnlyEventStore = sources.appendOnlyEventStore.value ?? {};
  const auditEventLedger = sources.auditEventLedger.value ?? {};
  const outputArtifactCatalog = sources.outputArtifactCatalog.value ?? {};
  return {
    append_only_event_store: {
      path: inputs.append_only_event_store_path,
      available: sources.appendOnlyEventStore.ok,
      schema_version: appendOnlyEventStore.schema_version ?? null,
      append_only_event_store_id: appendOnlyEventStore.append_only_event_store_id ?? null,
      event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
      stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
      event_stream_count: appendOnlyEventStore.summary?.event_stream_count ?? 0,
      validation_error_count: appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
      error: sources.appendOnlyEventStore.error,
    },
    audit_event_ledger: {
      path: inputs.audit_event_ledger_path,
      available: sources.auditEventLedger.ok,
      schema_version: auditEventLedger.schema_version ?? null,
      audit_event_ledger_id: auditEventLedger.audit_event_ledger_id ?? null,
      audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
      audit_trail_record_count: auditEventLedger.summary?.audit_trail_record_count ?? 0,
      audit_source_rollup_count: auditEventLedger.summary?.audit_source_rollup_count ?? 0,
      validation_error_count: auditEventLedger.summary?.validation_error_count ?? auditEventLedger.validation?.errors?.length ?? 0,
      error: sources.auditEventLedger.error,
    },
    output_artifact_catalog: {
      path: inputs.output_artifact_catalog_path,
      available: sources.outputArtifactCatalog.ok,
      schema_version: outputArtifactCatalog.schema_version ?? null,
      output_artifact_catalog_status: sources.outputArtifactCatalog.ok ? "complete" : "missing",
      artifact_count: outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0,
      blocked_delivery_count: outputArtifactCatalog.summary?.blocked_delivery_count ?? 0,
      approval_pending_count: outputArtifactCatalog.summary?.approval_pending_count ?? 0,
      error: sources.outputArtifactCatalog.error,
    },
  };
}

function buildRetentionArchiveContract(generatedAt) {
  return {
    schema_version: RETENTION_ARCHIVE_CONTRACT_SCHEMA_VERSION,
    generated_at: generatedAt,
    retention_archive_contract_id: RETENTION_ARCHIVE_CONTRACT_ID,
    covered_planes: ["audit", "event", "output"],
    required_policy_fields: [
      "retention_policy_id",
      "retention_plane",
      "source_kind",
      "retention_period_days",
      "deletion_allowed",
      "legal_hold_required",
      "human_review_required",
    ],
    required_archive_candidate_fields: [
      "archive_candidate_id",
      "retention_policy_id",
      "retention_plane",
      "source_kind",
      "source_record_id",
      "archive_state",
      "archive_action",
      "deletion_status",
      "legal_hold_status",
    ],
    deletion_policy: "delete_never_without_explicit_records_review",
    legal_hold_policy: "matter_or_tenant_hold_required",
    notes: [
      "P173 records retention policy and archive candidates for audit, event, and output surfaces only.",
      "Deletion is not authorized by this ledger; later disposition work must be explicit, reviewed, and separately audited.",
      "Output artifacts remain human-reviewable records and must carry their review or delivery state into archive candidates.",
    ],
  };
}

function validateRetentionArchiveLedger({
  sources,
  roadmap,
  packageJson,
  retentionPolicyRecords,
  archiveCandidateRecords,
  legalHoldBindings,
}) {
  const items = [];
  const policyById = new Map(retentionPolicyRecords.map((policy) => [policy.retention_policy_id, policy]));
  const holdByCandidateId = new Map(legalHoldBindings.map((binding) => [binding.archive_candidate_id, binding]));
  const appendOnlyEventStore = sources.appendOnlyEventStore.value ?? {};
  const auditEventLedger = sources.auditEventLedger.value ?? {};
  const outputArtifactCatalog = sources.outputArtifactCatalog.value ?? {};
  const eventPolicy = retentionPolicyRecords.find((policy) => policy.retention_plane === "event");
  const auditPolicy = retentionPolicyRecords.find((policy) => policy.retention_plane === "audit");
  const outputPolicy = retentionPolicyRecords.find((policy) => policy.retention_plane === "output");

  items.push(validationItem("source.append_only_event_store", "source_append_only_event_store_complete", sources.appendOnlyEventStore.ok && appendOnlyEventStore.summary?.event_store_status === "complete", "Append-only event store must be readable and complete."));
  items.push(validationItem("source.audit_event_ledger", "source_audit_event_ledger_complete", sources.auditEventLedger.ok && auditEventLedger.summary?.audit_event_ledger_status === "complete", "Audit event ledger must be readable and complete."));
  items.push(validationItem("source.output_artifact_catalog", "source_output_artifact_catalog_available", sources.outputArtifactCatalog.ok && (outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0) > 0, "Output artifact catalog must be readable and contain output artifacts."));
  items.push(validationItem("package.scripts.events_retention", "package_script_present", Boolean(packageJson.scripts?.["events:retention"]), "package.json must expose npm run events:retention."));
  items.push(validationItem("roadmap.phase_173", "roadmap_phase_declared", roadmap.value.includes("Phase 173: Retention/Archive Ledger"), "Phase 173 roadmap entry must be declared."));
  items.push(validationItem("retention_policy_records.coverage", "retention_planes_covered", Boolean(eventPolicy && auditPolicy && outputPolicy), "Retention policies must cover event, audit, and output planes."));
  items.push(validationItem("retention_policy_records.event_count", "event_source_count_matches", (eventPolicy?.source_record_count ?? -1) === (appendOnlyEventStore.summary?.stored_event_count ?? 0), "Event retention policy source count must match append-only stored event count."));
  items.push(validationItem("retention_policy_records.audit_count", "audit_source_count_matches", (auditPolicy?.source_record_count ?? -1) === (auditEventLedger.summary?.audit_trail_record_count ?? 0), "Audit retention policy source count must match audit trail record count."));
  items.push(validationItem("retention_policy_records.output_count", "output_source_count_matches", (outputPolicy?.source_record_count ?? -1) === (outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0), "Output retention policy source count must match output artifact count."));
  items.push(validationItem("archive_candidate_records.present", "archive_candidates_present", archiveCandidateRecords.length > 0, "Archive candidates must be projected."));
  items.push(validationItem("archive_candidate_records.event", "event_archive_candidates_present", archiveCandidateRecords.some((candidate) => candidate.retention_plane === "event"), "Event archive candidates must be projected."));
  items.push(validationItem("archive_candidate_records.audit", "audit_archive_candidates_present", archiveCandidateRecords.some((candidate) => candidate.retention_plane === "audit"), "Audit archive candidates must be projected."));
  items.push(validationItem("archive_candidate_records.output", "output_archive_candidates_present", archiveCandidateRecords.some((candidate) => candidate.retention_plane === "output"), "Output archive candidates must be projected."));
  items.push(validationItem("archive_candidate_records.policy_binding", "all_candidates_policy_bound", archiveCandidateRecords.every((candidate) => policyById.has(candidate.retention_policy_id)), "Every archive candidate must bind a known retention policy."));
  items.push(validationItem("archive_candidate_records.deletion", "deletion_not_allowed", archiveCandidateRecords.every((candidate) => candidate.deletion_allowed === false && candidate.deletion_status === "not_allowed"), "No archive candidate may authorize deletion."));
  items.push(validationItem("archive_candidate_records.hash", "candidate_hashes_present", archiveCandidateRecords.every((candidate) => candidate.archive_candidate_hash?.startsWith("sha256:")), "Every archive candidate must carry a deterministic hash."));
  items.push(validationItem("legal_hold_bindings.coverage", "legal_hold_bindings_cover_required_candidates", archiveCandidateRecords.filter((candidate) => candidate.legal_hold_required).every((candidate) => holdByCandidateId.has(candidate.archive_candidate_id)), "Every legal-hold-required archive candidate must have a legal hold binding."));
  items.push(validationItem("legal_hold_bindings.active", "legal_hold_bindings_active", legalHoldBindings.every((binding) => binding.hold_status === "active" && binding.legal_hold_binding_hash?.startsWith("sha256:")), "Legal hold bindings must be active and hash-stamped."));
  return items;
}

function summarizeRetentionArchiveLedger({
  sources,
  retentionPolicyRecords,
  archiveCandidateRecords,
  legalHoldBindings,
  validation,
  validationItems,
}) {
  const appendOnlyEventStore = sources.appendOnlyEventStore.value ?? {};
  const auditEventLedger = sources.auditEventLedger.value ?? {};
  const outputArtifactCatalog = sources.outputArtifactCatalog.value ?? {};
  const legalHoldRequiredCount = archiveCandidateRecords.filter((candidate) => candidate.legal_hold_required).length;
  const missingPolicyBindingCount = archiveCandidateRecords.filter((candidate) => !retentionPolicyRecords.some((policy) => policy.retention_policy_id === candidate.retention_policy_id)).length;
  const legalHoldCandidateIds = new Set(legalHoldBindings.map((binding) => binding.archive_candidate_id));
  const missingLegalHoldBindingCount = archiveCandidateRecords.filter((candidate) => candidate.legal_hold_required && !legalHoldCandidateIds.has(candidate.archive_candidate_id)).length;
  const deletionAllowedCount = archiveCandidateRecords.filter((candidate) => candidate.deletion_allowed || candidate.deletion_status !== "not_allowed").length;
  return {
    retention_archive_status: validation.valid ? "complete" : "blocked",
    retention_archive_contract_id: RETENTION_ARCHIVE_CONTRACT_ID,
    source_append_only_event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
    source_audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
    source_output_artifact_catalog_status: sources.outputArtifactCatalog.ok ? "complete" : "missing",
    source_stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
    source_event_stream_count: appendOnlyEventStore.summary?.event_stream_count ?? 0,
    source_audit_trail_record_count: auditEventLedger.summary?.audit_trail_record_count ?? 0,
    source_audit_source_rollup_count: auditEventLedger.summary?.audit_source_rollup_count ?? 0,
    source_output_artifact_count: outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0,
    retention_policy_count: retentionPolicyRecords.length,
    archive_candidate_count: archiveCandidateRecords.length,
    event_archive_candidate_count: archiveCandidateRecords.filter((candidate) => candidate.retention_plane === "event").length,
    audit_archive_candidate_count: archiveCandidateRecords.filter((candidate) => candidate.retention_plane === "audit").length,
    output_archive_candidate_count: archiveCandidateRecords.filter((candidate) => candidate.retention_plane === "output").length,
    legal_hold_binding_count: legalHoldBindings.length,
    legal_hold_required_candidate_count: legalHoldRequiredCount,
    human_review_required_candidate_count: archiveCandidateRecords.filter((candidate) => candidate.human_review_required).length,
    deletion_allowed_candidate_count: deletionAllowedCount,
    missing_policy_binding_count: missingPolicyBindingCount,
    missing_legal_hold_binding_count: missingLegalHoldBindingCount,
    policy_record_source_match_count: retentionPolicyRecords.filter((policy) => sourceCountMatches(policy, appendOnlyEventStore, auditEventLedger, outputArtifactCatalog)).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_retention_plane: countBy(archiveCandidateRecords, "retention_plane"),
    by_archive_state: countBy(archiveCandidateRecords, "archive_state"),
    by_archive_action: countBy(archiveCandidateRecords, "archive_action"),
    by_deletion_status: countBy(archiveCandidateRecords, "deletion_status"),
    by_legal_hold_status: countBy(archiveCandidateRecords, "legal_hold_status"),
  };
}

function sourceCountMatches(policy, appendOnlyEventStore, auditEventLedger, outputArtifactCatalog) {
  if (policy.retention_plane === "event") return policy.source_record_count === (appendOnlyEventStore.summary?.stored_event_count ?? 0);
  if (policy.retention_plane === "audit") return policy.source_record_count === (auditEventLedger.summary?.audit_trail_record_count ?? 0);
  if (policy.retention_plane === "output") return policy.source_record_count === (outputArtifactCatalog.summary?.artifact_count ?? outputArtifactCatalog.artifacts?.length ?? 0);
  return false;
}

function renderRetentionArchiveLedgerMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Retention/Archive Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push("");
  lines.push(`- Status: ${summary.retention_archive_status}`);
  lines.push(`- Retention policies: ${summary.retention_policy_count}`);
  lines.push(`- Archive candidates: ${summary.archive_candidate_count}`);
  lines.push(`- Event/Audit/Output candidates: ${summary.event_archive_candidate_count}/${summary.audit_archive_candidate_count}/${summary.output_archive_candidate_count}`);
  lines.push(`- Legal hold bindings: ${summary.legal_hold_binding_count}/${summary.legal_hold_required_candidate_count}`);
  lines.push(`- Deletion allowed candidates: ${summary.deletion_allowed_candidate_count}`);
  lines.push(`- Policy source matches: ${summary.policy_record_source_match_count}/${summary.retention_policy_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Policies");
  for (const policy of result.retention_archive_catalog.retention_policy_records) {
    lines.push(`- ${policy.retention_policy_id}: ${policy.retention_plane}, ${policy.source_record_count} source row(s), delete_allowed=${policy.deletion_allowed}`);
  }
  lines.push("");
  lines.push("## Candidate Rollup");
  for (const [plane, count] of Object.entries(summary.by_retention_plane ?? {})) {
    lines.push(`- ${plane}: ${count}`);
  }
  return `${lines.join("\n")}\n`;
}

function withCandidateHash(candidate) {
  return {
    ...candidate,
    archive_candidate_hash: hashValue(candidate),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_RETENTION_ARCHIVE_LEDGER_INPUTS;
  return {
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? defaults.appendOnlyEventStorePath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? defaults.auditEventLedgerPath),
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? defaults.outputArtifactCatalogPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      ok: true,
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    passed,
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function serializableRetentionArchiveLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  const getter = typeof keyOrFn === "function" ? keyOrFn : (item) => item?.[keyOrFn];
  for (const item of items) {
    const key = getter(item) ?? "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  return Object.fromEntries([...groupBy(items, key).entries()].map(([groupKey, values]) => [groupKey, values.length]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))].sort();
}

function minDate(values) {
  const sorted = sortedUnique(values).filter(Boolean).sort();
  return sorted[0] ?? null;
}

function maxDate(values) {
  const sorted = sortedUnique(values).filter(Boolean).sort();
  return sorted[sorted.length - 1] ?? null;
}

function last(values) {
  return values[values.length - 1] ?? null;
}

function normalizeHash(value) {
  if (!value) return null;
  return String(value).startsWith("sha256:") ? String(value) : `sha256:${value}`;
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--audit-event-ledger") parsed.auditEventLedgerPath = argv[++index];
    else if (arg === "--output-artifact-catalog" || arg === "--output-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/retention-archive-ledger.mjs [options]

Options:
  --check                                Fail when validation does not pass.
  --out-dir <path>                       Output directory.
  --append-only-event-store <path>       append-only-event-store.json path.
  --audit-event-ledger <path>            audit-event-ledger.json path.
  --output-artifact-catalog <path>       output-catalog.json path.
  --output-catalog <path>                Alias for --output-artifact-catalog.
  --package <path>                       package.json path.
  --roadmap <path>                       implementation-roadmap.md path.
`);
}
