import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ACCESS_AUDIT_PROJECTION_OUT_DIR = "artifacts/access-audit/latest";
export const DEFAULT_ACCESS_AUDIT_PROJECTION_INPUTS = {
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  matterTaggingDecisionLedgerPath: "artifacts/matter-tagging/latest/matter-tagging-ledger.json",
};

export async function runAccessAuditProjection(options = {}) {
  const result = await buildAccessAuditProjection(options);
  if (options.write !== false) await writeAccessAuditProjection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Access audit projection failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAccessAuditProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ACCESS_AUDIT_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const matterAccessPolicyEvaluator = await readJson(inputs.matter_access_policy_evaluator_path);
  const matterTaggingDecisionLedger = await readJson(inputs.matter_tagging_decision_ledger_path);
  const projected = projectAccessAudit({
    matterAccessPolicyEvaluator,
    matterTaggingDecisionLedger,
    generatedAt,
  });
  const validationItems = validateAccessAuditProjection({
    matterAccessPolicyEvaluator,
    matterTaggingDecisionLedger,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "access-audit-projection.v1",
    generated_at: generatedAt,
    access_audit_projection_id: `access-audit-projection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_matter_access_policy: summarizeMatterAccessPolicySource(matterAccessPolicyEvaluator),
    source_matter_tagging_decision_ledger: summarizeMatterTaggingSource(matterTaggingDecisionLedger),
    access_audit_catalog: {
      schema_version: "access-audit-catalog.v1",
      generated_at: generatedAt,
      access_audit_records: projected.accessAuditRecords,
      actor_access_rollups: projected.actorAccessRollups,
      resource_access_rollups: projected.resourceAccessRollups,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeAccessAuditProjection(projected, validationItems, validation, {
      matterAccessPolicyEvaluator,
      matterTaggingDecisionLedger,
    }),
  };
  return {
    ...result,
    markdown: renderAccessAuditProjectionMarkdown(result),
  };
}

export async function writeAccessAuditProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableProjection(result);
  await writeJson(path.join(outDir, "access-audit-projection.json"), serializable);
  await writeJson(path.join(outDir, "access-audit-catalog.json"), serializable.access_audit_catalog);
  await writeJson(path.join(outDir, "access-audit-records.json"), {
    generated_at: result.generated_at,
    access_audit_record_count: result.access_audit_catalog.access_audit_records.length,
    access_audit_records: result.access_audit_catalog.access_audit_records,
  });
  await writeJson(path.join(outDir, "actor-access-rollups.json"), {
    generated_at: result.generated_at,
    actor_access_rollup_count: result.access_audit_catalog.actor_access_rollups.length,
    actor_access_rollups: result.access_audit_catalog.actor_access_rollups,
  });
  await writeJson(path.join(outDir, "resource-access-rollups.json"), {
    generated_at: result.generated_at,
    resource_access_rollup_count: result.access_audit_catalog.resource_access_rollups.length,
    resource_access_rollups: result.access_audit_catalog.resource_access_rollups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    access_audit_projection_id: result.access_audit_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAccessAuditProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runAccessAuditProjection(args);
    console.log(`Access audit projection written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.access_audit_projection_status}`);
    console.log(`Audit records: ${result.summary.access_audit_record_count}`);
    console.log(`Actor rollups: ${result.summary.actor_access_rollup_count}`);
    console.log(`Resource rollups: ${result.summary.resource_access_rollup_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectAccessAudit({ matterAccessPolicyEvaluator, matterTaggingDecisionLedger, generatedAt }) {
  const matterAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.matter_access_decisions ?? [];
  const resourceAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.resource_access_decisions ?? [];
  const taggingDecisions = matterTaggingDecisionLedger.matter_tagging_catalog?.matter_tagging_decisions ?? [];
  const taggingConfirmations = matterTaggingDecisionLedger.matter_tagging_catalog?.human_confirmation_queue ?? [];
  const taggingByResourceId = new Map(taggingDecisions.map((decision) => [decision.resource_id, decision]));
  const confirmationByDecisionId = new Map(taggingConfirmations.map((confirmation) => [confirmation.matter_tagging_decision_id, confirmation]));
  const accessAuditRecords = [
    ...matterAccessDecisions.map((decision) => buildMatterAccessAuditRecord(decision, generatedAt)),
    ...resourceAccessDecisions.map((decision) => buildResourceAccessAuditRecord({
      decision,
      taggingDecision: taggingByResourceId.get(decision.resource_id) ?? null,
      confirmationByDecisionId,
      generatedAt,
    })),
  ].sort(by("access_audit_record_id"));
  return {
    matterAccessDecisions,
    resourceAccessDecisions,
    taggingDecisions,
    taggingConfirmations,
    accessAuditRecords,
    actorAccessRollups: buildActorAccessRollups(accessAuditRecords, generatedAt),
    resourceAccessRollups: buildResourceAccessRollups(accessAuditRecords, generatedAt),
  };
}

function buildMatterAccessAuditRecord(decision, generatedAt) {
  return {
    schema_version: "access-audit-record.v1",
    access_audit_record_id: `access-audit-record.matter.${slugify(decision.matter_access_decision_id)}`,
    source_decision_type: "matter_access_decision",
    source_decision_id: decision.matter_access_decision_id,
    access_subject_id: decision.access_subject_id,
    user_id: decision.user_id,
    subject_type: decision.subject_type,
    runtime_id: decision.runtime_id,
    adapter_id: decision.adapter_id,
    external_execution: Boolean(decision.external_execution),
    tenant_id: decision.tenant_id,
    client_id: decision.client_id,
    target_type: "matter",
    target_matter_id: decision.matter_id,
    target_resource_id: null,
    target_resource_version_id: null,
    resource_matter_id: null,
    resource_tenant_id: null,
    resource_classification: null,
    required_classification_floor: decision.classification,
    wall_id: decision.wall_id,
    wall_policy_rule_id: decision.wall_policy_rule_id,
    retrieval_wall_filter_id: decision.retrieval_wall_filter_id,
    access_decision: decision.access_decision,
    view_status: viewStatus(decision),
    context_mode: decision.context_mode,
    can_retrieve: Boolean(decision.can_retrieve),
    requires_human_review: Boolean(decision.requires_human_review),
    required_gates: decision.required_gates ?? [],
    reason_codes: decision.reason_codes ?? [],
    policy_snapshot_id: decision.policy_snapshot_id,
    decided_at: decision.decided_at,
    projected_at: generatedAt,
    matter_tagging_decision_id: null,
    matter_tagging_status: null,
    matter_tagging_confirmation_id: null,
    audit_query_keys: auditQueryKeys({
      userId: decision.user_id,
      runtimeId: decision.runtime_id,
      matterId: decision.matter_id,
      resourceId: null,
    }),
    metadata: {
      risk_level: decision.risk_level,
      membership_id: decision.membership_id,
    },
  };
}

function buildResourceAccessAuditRecord({ decision, taggingDecision, confirmationByDecisionId, generatedAt }) {
  const confirmation = taggingDecision ? confirmationByDecisionId.get(taggingDecision.matter_tagging_decision_id) : null;
  return {
    schema_version: "access-audit-record.v1",
    access_audit_record_id: `access-audit-record.resource.${slugify(decision.resource_access_decision_id)}`,
    source_decision_type: "resource_access_decision",
    source_decision_id: decision.resource_access_decision_id,
    access_subject_id: decision.access_subject_id,
    user_id: decision.user_id,
    subject_type: null,
    runtime_id: decision.runtime_id,
    adapter_id: decision.adapter_id,
    external_execution: Boolean(decision.external_execution),
    tenant_id: decision.tenant_id,
    client_id: decision.client_id,
    target_type: "resource",
    target_matter_id: decision.target_matter_id,
    target_resource_id: decision.resource_id,
    target_resource_version_id: decision.resource_version_id,
    resource_matter_id: decision.resource_matter_id,
    resource_tenant_id: decision.resource_tenant_id,
    resource_classification: decision.resource_classification,
    required_classification_floor: decision.required_classification_floor,
    wall_id: decision.wall_id,
    wall_policy_rule_id: decision.wall_policy_rule_id,
    retrieval_wall_filter_id: decision.retrieval_wall_filter_id,
    access_decision: decision.access_decision,
    view_status: viewStatus(decision),
    context_mode: decision.context_mode,
    can_retrieve: Boolean(decision.can_retrieve),
    requires_human_review: Boolean(decision.requires_human_review),
    required_gates: decision.required_gates ?? [],
    reason_codes: decision.reason_codes ?? [],
    policy_snapshot_id: decision.policy_snapshot_id,
    decided_at: decision.decided_at,
    projected_at: generatedAt,
    matter_tagging_decision_id: taggingDecision?.matter_tagging_decision_id ?? null,
    matter_tagging_status: taggingDecision?.tagging_status ?? null,
    matter_tagging_confirmation_id: confirmation?.matter_tagging_confirmation_id ?? null,
    audit_query_keys: auditQueryKeys({
      userId: decision.user_id,
      runtimeId: decision.runtime_id,
      matterId: decision.target_matter_id,
      resourceId: decision.resource_id,
    }),
    metadata: {
      source_uri: decision.metadata?.source_uri ?? null,
      resource_type: decision.metadata?.resource_type ?? null,
    },
  };
}

function buildActorAccessRollups(records, generatedAt) {
  const grouped = groupBy(records, (record) => [
    record.user_id,
    record.access_subject_id,
    record.runtime_id,
    record.target_matter_id,
  ].join("::"));
  const rollups = [];
  for (const recordsForActor of grouped.values()) {
    const first = recordsForActor[0];
    rollups.push({
      schema_version: "actor-access-rollup.v1",
      actor_access_rollup_id: `actor-access-rollup.${slugify(first.user_id)}.${slugify(first.runtime_id)}.${slugify(first.target_matter_id)}`,
      user_id: first.user_id,
      access_subject_id: first.access_subject_id,
      runtime_id: first.runtime_id,
      target_matter_id: first.target_matter_id,
      tenant_id: first.tenant_id,
      client_id: first.client_id,
      access_audit_record_count: recordsForActor.length,
      matter_record_count: recordsForActor.filter((record) => record.target_type === "matter").length,
      resource_record_count: recordsForActor.filter((record) => record.target_type === "resource").length,
      view_allowed_count: recordsForActor.filter((record) => record.view_status === "view_allowed").length,
      view_requires_human_confirmation_count: recordsForActor.filter((record) => record.view_status === "view_requires_human_confirmation").length,
      view_denied_count: recordsForActor.filter((record) => record.view_status === "view_denied").length,
      can_retrieve_count: recordsForActor.filter((record) => record.can_retrieve).length,
      human_review_required_count: recordsForActor.filter((record) => record.requires_human_review).length,
      external_runtime_record_count: recordsForActor.filter((record) => record.external_execution).length,
      resource_ids: unique(recordsForActor.map((record) => record.target_resource_id).filter(Boolean)),
      policy_snapshot_ids: unique(recordsForActor.map((record) => record.policy_snapshot_id).filter(Boolean)),
      projected_at: generatedAt,
      metadata: {},
    });
  }
  return rollups.sort(by("actor_access_rollup_id"));
}

function buildResourceAccessRollups(records, generatedAt) {
  const resourceRecords = records.filter((record) => record.target_type === "resource");
  const grouped = groupBy(resourceRecords, (record) => [record.target_resource_id, record.target_matter_id].join("::"));
  const rollups = [];
  for (const recordsForResource of grouped.values()) {
    const first = recordsForResource[0];
    rollups.push({
      schema_version: "resource-access-rollup.v1",
      resource_access_rollup_id: `resource-access-rollup.${slugify(first.target_resource_id)}.${slugify(first.target_matter_id)}`,
      target_resource_id: first.target_resource_id,
      target_matter_id: first.target_matter_id,
      resource_matter_id: first.resource_matter_id,
      resource_tenant_id: first.resource_tenant_id,
      tenant_id: first.tenant_id,
      client_id: first.client_id,
      resource_classification: first.resource_classification,
      access_audit_record_count: recordsForResource.length,
      view_allowed_count: recordsForResource.filter((record) => record.view_status === "view_allowed").length,
      view_requires_human_confirmation_count: recordsForResource.filter((record) => record.view_status === "view_requires_human_confirmation").length,
      view_denied_count: recordsForResource.filter((record) => record.view_status === "view_denied").length,
      can_retrieve_count: recordsForResource.filter((record) => record.can_retrieve).length,
      human_review_required_count: recordsForResource.filter((record) => record.requires_human_review).length,
      user_ids: unique(recordsForResource.map((record) => record.user_id).filter(Boolean)),
      runtime_ids: unique(recordsForResource.map((record) => record.runtime_id).filter(Boolean)),
      matter_tagging_decision_ids: unique(recordsForResource.map((record) => record.matter_tagging_decision_id).filter(Boolean)),
      projected_at: generatedAt,
      metadata: {},
    });
  }
  return rollups.sort(by("resource_access_rollup_id"));
}

function validateAccessAuditProjection({ matterAccessPolicyEvaluator, matterTaggingDecisionLedger, projected }) {
  const validationItems = [];
  const recordsBySourceDecision = new Map(projected.accessAuditRecords.map((record) => [`${record.source_decision_type}::${record.source_decision_id}`, record]));
  const matterDecisionIds = new Set(projected.matterAccessDecisions.map((decision) => decision.matter_access_decision_id));
  const resourceDecisionIds = new Set(projected.resourceAccessDecisions.map((decision) => decision.resource_access_decision_id));
  const taggingDecisionIds = new Set(projected.taggingDecisions.map((decision) => decision.matter_tagging_decision_id));
  const resourceRecords = projected.accessAuditRecords.filter((record) => record.target_type === "resource");

  pushCheck(validationItems, "source", matterAccessPolicyEvaluator.access_policy_ledger_id ?? "matter-access-policy-evaluator", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Access audit projection requires a complete Matter Access Policy Evaluator.");
  pushCheck(validationItems, "source", matterTaggingDecisionLedger.matter_tagging_ledger_id ?? "matter-tagging-decision-ledger", "matter_tagging_ledger_complete", matterTaggingDecisionLedger.summary?.matter_tagging_ledger_status === "complete", "Access audit projection requires a complete Matter Tagging Decision Ledger.");

  pushUniqueIdChecks(validationItems, projected.accessAuditRecords, "access_audit_record", "access_audit_record_id");
  pushUniqueIdChecks(validationItems, projected.actorAccessRollups, "actor_access_rollup", "actor_access_rollup_id");
  pushUniqueIdChecks(validationItems, projected.resourceAccessRollups, "resource_access_rollup", "resource_access_rollup_id");

  for (const decision of projected.matterAccessDecisions) {
    pushCheck(validationItems, "matter_access_decision", decision.matter_access_decision_id, "audit_record_present", recordsBySourceDecision.has(`matter_access_decision::${decision.matter_access_decision_id}`), "Every matter access decision must have an access audit record.");
  }

  for (const decision of projected.resourceAccessDecisions) {
    const auditRecord = recordsBySourceDecision.get(`resource_access_decision::${decision.resource_access_decision_id}`);
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "audit_record_present", Boolean(auditRecord), "Every resource access decision must have an access audit record.");
    if (!auditRecord) continue;
    const taggingRequired = (decision.reason_codes ?? []).includes("resource_matter_tagging_required");
    pushCheck(validationItems, "resource_access_decision", decision.resource_access_decision_id, "matter_tagging_linked_when_required", !taggingRequired || taggingDecisionIds.has(auditRecord.matter_tagging_decision_id), "Resource access rows that require matter tagging must link to a matter tagging decision.");
  }

  for (const record of projected.accessAuditRecords) {
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "source_decision_known", record.source_decision_type === "matter_access_decision" ? matterDecisionIds.has(record.source_decision_id) : resourceDecisionIds.has(record.source_decision_id), "Access audit record must reference a known source decision.");
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "query_keys_present", record.audit_query_keys.includes(`user:${record.user_id}`) && record.audit_query_keys.includes(`runtime:${record.runtime_id}`) && record.audit_query_keys.includes(`matter:${record.target_matter_id}`), "Access audit record must be queryable by user, runtime, and matter.");
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "policy_snapshot_present", Boolean(record.policy_snapshot_id), "Access audit record must preserve the policy snapshot used at decision time.");
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "allow_can_retrieve", record.access_decision !== "allow" || record.can_retrieve === true, "Allow audit records must be retrievable.");
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "review_requires_human", record.access_decision !== "review" || record.requires_human_review === true, "Review audit records must require human review.");
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "deny_not_retrievable", record.access_decision !== "deny" || record.can_retrieve === false, "Denied audit records must not be retrievable.");
    if (record.target_type === "resource") {
      pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "resource_query_key_present", record.audit_query_keys.includes(`resource:${record.target_resource_id}`), "Resource audit records must be queryable by resource.");
    }
  }

  pushCheck(validationItems, "access_audit_projection", "access-audit-records", "matter_and_resource_coverage", projected.accessAuditRecords.length === projected.matterAccessDecisions.length + projected.resourceAccessDecisions.length, "Access audit projection must cover every matter and resource access decision.");
  pushCheck(validationItems, "access_audit_projection", "actor-access-rollups", "actor_rollups_present", projected.actorAccessRollups.length > 0, "Actor access rollups must be present.");
  pushCheck(validationItems, "access_audit_projection", "resource-access-rollups", "resource_rollups_present", resourceRecords.length === 0 || projected.resourceAccessRollups.length > 0, "Resource access rollups must be present when resource records exist.");
  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.accessAuditRecords.length === 0) errors.push({ path: "access_audit_catalog.access_audit_records", message: "At least one access audit record is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeAccessAuditProjection(projected, validationItems, validation, sources) {
  const records = projected.accessAuditRecords;
  const matterRecords = records.filter((record) => record.target_type === "matter");
  const resourceRecords = records.filter((record) => record.target_type === "resource");
  return {
    access_audit_projection_status: validation.valid ? "complete" : "blocked",
    source_matter_access_policy_status: sources.matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    source_matter_tagging_ledger_status: sources.matterTaggingDecisionLedger.summary?.matter_tagging_ledger_status ?? "unknown",
    matter_access_decision_count: projected.matterAccessDecisions.length,
    resource_access_decision_count: projected.resourceAccessDecisions.length,
    access_audit_record_count: records.length,
    matter_audit_record_count: matterRecords.length,
    resource_audit_record_count: resourceRecords.length,
    actor_access_rollup_count: projected.actorAccessRollups.length,
    resource_access_rollup_count: projected.resourceAccessRollups.length,
    view_allowed_count: records.filter((record) => record.view_status === "view_allowed").length,
    view_requires_human_confirmation_count: records.filter((record) => record.view_status === "view_requires_human_confirmation").length,
    view_denied_count: records.filter((record) => record.view_status === "view_denied").length,
    can_retrieve_count: records.filter((record) => record.can_retrieve).length,
    human_review_required_count: records.filter((record) => record.requires_human_review).length,
    external_runtime_record_count: records.filter((record) => record.external_execution).length,
    matter_tagging_linked_count: resourceRecords.filter((record) => record.matter_tagging_decision_id).length,
    matter_tagging_unresolved_count: resourceRecords.filter((record) => (record.reason_codes ?? []).includes("resource_matter_tagging_required") && !record.matter_tagging_decision_id).length,
    distinct_user_count: unique(records.map((record) => record.user_id).filter(Boolean)).length,
    distinct_runtime_count: unique(records.map((record) => record.runtime_id).filter(Boolean)).length,
    distinct_matter_count: unique(records.map((record) => record.target_matter_id).filter(Boolean)).length,
    distinct_resource_count: unique(resourceRecords.map((record) => record.target_resource_id).filter(Boolean)).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_user_id: countBy(records, "user_id"),
    by_runtime_id: countBy(records, "runtime_id"),
    by_access_decision: countBy(records, "access_decision"),
    by_target_type: countBy(records, "target_type"),
    by_view_status: countBy(records, "view_status"),
    by_matter_id: countBy(records, "target_matter_id"),
  };
}

function summarizeMatterAccessPolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    access_policy_ledger_id: source.access_policy_ledger_id ?? null,
    access_policy_status: source.summary?.access_policy_status ?? "unknown",
    matter_access_decision_count: source.summary?.matter_access_decision_count ?? 0,
    resource_access_decision_count: source.summary?.resource_access_decision_count ?? 0,
  };
}

function summarizeMatterTaggingSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    matter_tagging_ledger_id: source.matter_tagging_ledger_id ?? null,
    matter_tagging_ledger_status: source.summary?.matter_tagging_ledger_status ?? "unknown",
    matter_tagging_decision_count: source.summary?.matter_tagging_decision_count ?? 0,
    pending_human_confirmation_count: source.summary?.pending_human_confirmation_count ?? 0,
  };
}

function renderAccessAuditProjectionMarkdown(result) {
  const lines = [];
  lines.push("# Access Audit Projection");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.access_audit_projection_status}`);
  lines.push("");
  lines.push(`- Audit records: ${result.summary.access_audit_record_count}`);
  lines.push(`- Matter records: ${result.summary.matter_audit_record_count}`);
  lines.push(`- Resource records: ${result.summary.resource_audit_record_count}`);
  lines.push(`- Actor rollups: ${result.summary.actor_access_rollup_count}`);
  lines.push(`- Resource rollups: ${result.summary.resource_access_rollup_count}`);
  lines.push(`- View allowed: ${result.summary.view_allowed_count}`);
  lines.push(`- View requires human confirmation: ${result.summary.view_requires_human_confirmation_count}`);
  lines.push(`- View denied: ${result.summary.view_denied_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Query Dimensions");
  lines.push(`- Users: ${result.summary.distinct_user_count}`);
  lines.push(`- Matters: ${result.summary.distinct_matter_count}`);
  lines.push(`- Resources: ${result.summary.distinct_resource_count}`);
  lines.push(`- Runtimes: ${result.summary.distinct_runtime_count}`);
  return `${lines.join("\n")}\n`;
}

function viewStatus(decision) {
  if (decision.access_decision === "allow" && decision.can_retrieve === true) return "view_allowed";
  if (decision.access_decision === "review") return "view_requires_human_confirmation";
  if (decision.access_decision === "deny") return "view_denied";
  return "view_blocked";
}

function auditQueryKeys({ userId, runtimeId, matterId, resourceId }) {
  return unique([
    `user:${userId}`,
    `runtime:${runtimeId}`,
    `matter:${matterId}`,
    resourceId ? `resource:${resourceId}` : null,
  ]);
}

function normalizeInputs(options) {
  return {
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_ACCESS_AUDIT_PROJECTION_INPUTS.matterAccessPolicyEvaluatorPath),
    matter_tagging_decision_ledger_path: path.resolve(options.matterTaggingDecisionLedgerPath ?? DEFAULT_ACCESS_AUDIT_PROJECTION_INPUTS.matterTaggingDecisionLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--matter-tagging-ledger") parsed.matterTaggingDecisionLedgerPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/access-audit-projection.mjs [options]

Options:
  --matter-access-policy <path>     matter-access-policy-evaluator.json path.
  --matter-tagging-ledger <path>    matter-tagging-ledger.json path.
  --out-dir <path>                  Output directory.
  --run-at <iso>                    Deterministic timestamp.
  --check                           Exit non-zero when validation fails.
  --no-write                        Build without writing artifacts.
`);
}

function serializableProjection(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the projection.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `access-audit-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  for (const item of items) {
    const value = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn] ?? "unknown";
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== null && value !== undefined))].sort();
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
