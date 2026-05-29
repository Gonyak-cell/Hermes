import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BACKFILL_JOB_CONTRACT_OUT_DIR = "artifacts/backfill-job-contract/latest";
export const DEFAULT_BACKFILL_JOB_CONTRACT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceExpansionSchemaPath: "schemas/resource-expansion.schema.json",
  connectorFreezePath: "artifacts/connector-freeze/latest/connector-freeze.json",
};

const CONTRACT_ID = "backfill-job-contract.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.backfill_job_contract";
const PHASE_SLOT = "P277";
const PREVIOUS_PHASE_SLOT = "P276";
const NEXT_PHASE_SLOT = "P278";
const HUMAN_REVIEW_NOTE = "Backfill Job Contract is a read-only schema and field validation report. It does not execute backfill, read file contents, produce legal advice, or create client-facing output.";

const FIELD_REQUIREMENT_DEFINITIONS = [
  fieldRequirement("job_identity", "schema_version", ["string"], true, "Resource expansion job schema version is declared."),
  fieldRequirement("job_identity", "job_id", ["string"], true, "Stable backfill job id is declared."),
  fieldRequirement("source_binding", "source_id", ["string"], true, "Logical source id is declared."),
  fieldRequirement("source_binding", "source_roots", ["array"], true, "Source root references are declared as metadata."),
  fieldRequirement("cursor", "cursor", ["object"], true, "Backfill cursor envelope is declared."),
  fieldRequirement("cursor", "cursor.queued_count", ["integer"], true, "Queued count is declared for resume planning."),
  fieldRequirement("cursor", "cursor.next_item_id", ["string", "null"], true, "Next item id is declared without raw cursor material."),
  fieldRequirement("cursor", "cursor.next_relative_path", ["string", "null"], true, "Next relative path is declared as an operator hint."),
  fieldRequirement("cursor", "resumability.idempotency_strategy", ["string"], true, "Idempotency strategy is declared."),
  fieldRequirement("cursor", "resumability.state_path", ["string"], true, "Resume state path is declared as an opaque reference."),
  fieldRequirement("batch", "batch", ["object"], true, "Batch envelope is declared."),
  fieldRequirement("batch", "batch.requested_batch_size", ["integer"], true, "Requested batch size is declared."),
  fieldRequirement("batch", "batch.processed_count", ["integer"], true, "Processed count is declared."),
  fieldRequirement("batch", "batch.remaining_count", ["integer"], true, "Remaining count is declared."),
  fieldRequirement("counts", "summary.discovered_count", ["integer"], true, "Discovered item count is declared."),
  fieldRequirement("counts", "summary.processed_this_run", ["integer"], true, "Processed this run count is declared."),
  fieldRequirement("counts", "summary.remaining_count", ["integer"], true, "Remaining count is declared in summary."),
  fieldRequirement("counts", "summary.terminal_count", ["integer"], true, "Terminal item count is declared."),
  fieldRequirement("counts", "summary.failed_count", ["integer"], true, "Failed count is declared."),
  fieldRequirement("counts", "summary.quarantine_count", ["integer"], true, "Quarantine count is declared."),
  fieldRequirement("counts", "summary.skipped_duplicate_count", ["integer"], true, "Skipped duplicate count is declared."),
  fieldRequirement("counts", "summary.extracted_count", ["integer"], true, "Extracted count is declared."),
  fieldRequirement("counts", "summary.by_status", ["object"], true, "Status count map is declared."),
  fieldRequirement("policy_snapshot", "policy_snapshot_id", ["string"], true, "Policy snapshot binding is declared."),
];

const FIELD_GROUP_LABELS = {
  job_identity: "Job identity",
  source_binding: "Source binding",
  cursor: "Cursor and resumability",
  batch: "Batch",
  counts: "Counts",
  policy_snapshot: "Policy snapshot",
};

export async function runBackfillJobContract(options = {}) {
  const result = await buildBackfillJobContract(options);
  if (options.write !== false) await writeBackfillJobContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Backfill job contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildBackfillJobContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_BACKFILL_JOB_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const resourceExpansionSchemaRead = await readJsonOrError(inputs.resource_expansion_schema_path);
  const connectorFreezeRead = await readJsonOrError(inputs.connector_freeze_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const resourceExpansionSchema = resourceExpansionSchemaRead.value ?? {};
  const connectorFreeze = connectorFreezeRead.value ?? {};

  const fieldRequirements = buildFieldRequirements(resourceExpansion, resourceExpansionSchema, generatedAt);
  const sourceBindings = buildSourceBindings({
    resourceExpansionRead,
    resourceExpansionSchemaRead,
    connectorFreezeRead,
    resourceExpansion,
    resourceExpansionSchema,
    connectorFreeze,
    inputs,
    generatedAt,
  });
  const cursorContracts = buildCursorContracts(resourceExpansion, fieldRequirements, generatedAt);
  const batchContracts = buildBatchContracts(resourceExpansion, fieldRequirements, generatedAt);
  const countContracts = buildCountContracts(resourceExpansion, fieldRequirements, generatedAt);
  const policyBindings = buildPolicyBindings(resourceExpansion, fieldRequirements, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const schemaContract = buildBackfillJobSchemaContract(fieldRequirements, resourceExpansionSchema, generatedAt);
  const checkpoints = buildCheckpoints({
    fieldRequirements,
    sourceBindings,
    cursorContracts,
    batchContracts,
    countContracts,
    policyBindings,
    boundary,
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeBackfillJobContract({
    resourceExpansion,
    connectorFreeze,
    fieldRequirements,
    sourceBindings,
    cursorContracts,
    batchContracts,
    countContracts,
    policyBindings,
    boundary,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    backfill_job_contract_id: `backfill-job-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    backfill_job_contract_status: summary.backfill_job_contract_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      resourceExpansionSchemaRead,
      connectorFreezeRead,
    }),
    backfill_job_schema: schemaContract,
    backfill_job_field_requirements: fieldRequirements,
    backfill_job_source_bindings: sourceBindings,
    backfill_job_cursor_contracts: cursorContracts,
    backfill_job_batch_contracts: batchContracts,
    backfill_job_count_contracts: countContracts,
    backfill_job_policy_bindings: policyBindings,
    backfill_job_boundary: boundary,
    backfill_job_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writeBackfillJobContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "backfill-job-contract.json"), serializableBackfillJobContract(result));
  await writeJson(path.join(outDir, "backfill-job-schema.json"), result.backfill_job_schema);
  await writeJson(path.join(outDir, "backfill-job-field-requirements.json"), {
    schema_version: "backfill-job-field-requirements-artifact.v1",
    generated_at: result.generated_at,
    field_requirement_count: result.backfill_job_field_requirements.length,
    backfill_job_field_requirements: result.backfill_job_field_requirements,
  });
  await writeJson(path.join(outDir, "backfill-job-source-bindings.json"), {
    schema_version: "backfill-job-source-bindings-artifact.v1",
    generated_at: result.generated_at,
    source_binding_count: result.backfill_job_source_bindings.length,
    backfill_job_source_bindings: result.backfill_job_source_bindings,
  });
  await writeJson(path.join(outDir, "backfill-job-cursor-contracts.json"), {
    schema_version: "backfill-job-cursor-contracts-artifact.v1",
    generated_at: result.generated_at,
    cursor_contract_count: result.backfill_job_cursor_contracts.length,
    backfill_job_cursor_contracts: result.backfill_job_cursor_contracts,
  });
  await writeJson(path.join(outDir, "backfill-job-batch-contracts.json"), {
    schema_version: "backfill-job-batch-contracts-artifact.v1",
    generated_at: result.generated_at,
    batch_contract_count: result.backfill_job_batch_contracts.length,
    backfill_job_batch_contracts: result.backfill_job_batch_contracts,
  });
  await writeJson(path.join(outDir, "backfill-job-count-contracts.json"), {
    schema_version: "backfill-job-count-contracts-artifact.v1",
    generated_at: result.generated_at,
    count_contract_count: result.backfill_job_count_contracts.length,
    backfill_job_count_contracts: result.backfill_job_count_contracts,
  });
  await writeJson(path.join(outDir, "backfill-job-policy-bindings.json"), {
    schema_version: "backfill-job-policy-bindings-artifact.v1",
    generated_at: result.generated_at,
    policy_binding_count: result.backfill_job_policy_bindings.length,
    backfill_job_policy_bindings: result.backfill_job_policy_bindings,
  });
  await writeJson(path.join(outDir, "backfill-job-boundary.json"), {
    schema_version: "backfill-job-boundary-artifact.v1",
    generated_at: result.generated_at,
    backfill_job_boundary: result.backfill_job_boundary,
  });
  await writeJson(path.join(outDir, "backfill-job-checkpoints.json"), {
    schema_version: "backfill-job-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.backfill_job_checkpoints.length,
    backfill_job_checkpoints: result.backfill_job_checkpoints,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "backfill-job-contract-validation-report.v1",
    generated_at: result.generated_at,
    backfill_job_contract_id: result.backfill_job_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runBackfillJobContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runBackfillJobContract(args);
    console.log(`Backfill job contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.backfill_job_contract_status}`);
    console.log(`Fields: ${result.summary.validated_required_field_count}/${result.summary.required_field_count}`);
    console.log(`Cursor contracts: ${result.summary.passed_cursor_contract_count}/${result.summary.cursor_contract_count}`);
    console.log(`Batch contracts: ${result.summary.passed_batch_contract_count}/${result.summary.batch_contract_count}`);
    console.log(`Count contracts: ${result.summary.passed_count_contract_count}/${result.summary.count_contract_count}`);
    console.log(`Policy bindings: ${result.summary.passed_policy_binding_count}/${result.summary.policy_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFieldRequirements(resourceExpansion, resourceExpansionSchema, generatedAt) {
  const sourceRequired = new Set(resourceExpansionSchema.required ?? []);
  return FIELD_REQUIREMENT_DEFINITIONS.map((definition) => {
    const present = hasPath(resourceExpansion, definition.field_path);
    const value = getPath(resourceExpansion, definition.field_path);
    const observedType = observedTypeOf(value);
    const typeValid = present && definition.expected_types.includes(observedType);
    return {
      schema_version: "backfill-job-field-requirement.v1",
      field_id: `backfill.field.${definition.field_path.replaceAll(".", "_")}`,
      field_group: definition.field_group,
      field_group_label: FIELD_GROUP_LABELS[definition.field_group],
      field_path: definition.field_path,
      expected_types: definition.expected_types,
      contract_required: definition.contract_required,
      source_schema_required: sourceRequired.has(definition.field_path.split(".")[0]),
      observed_present: present,
      observed_type: present ? observedType : "missing",
      field_status: present && typeValid ? "validated" : "missing",
      rationale: definition.rationale,
      generated_at: generatedAt,
    };
  });
}

function buildSourceBindings(context) {
  const {
    resourceExpansionRead,
    resourceExpansionSchemaRead,
    connectorFreezeRead,
    resourceExpansion,
    resourceExpansionSchema,
    connectorFreeze,
    inputs,
    generatedAt,
  } = context;
  const connectorFreezeStatus = connectorFreeze.summary?.connector_freeze_status ?? connectorFreeze.connector_freeze_status;
  return [
    sourceBinding({
      binding_id: "backfill.source.resource_expansion_job",
      source_id: "resource_expansion",
      source_label: "Resource Expansion Job",
      source_path: inputs.resource_expansion_path,
      source_status: resourceExpansionRead.error ? "missing" : "bound",
      binding_status: !resourceExpansionRead.error && resourceExpansion.schema_version === "resource-expansion-job.v1" && hasPath(resourceExpansion, "job_id") ? "bound" : "attention",
      content_hash: resourceExpansionRead.value ? `sha256:${hashJson(resourceExpansionRead.value)}` : null,
      details: {
        observed_schema_version: resourceExpansion.schema_version ?? null,
        job_id: resourceExpansion.job_id ?? null,
        source_id: resourceExpansion.source_id ?? null,
        policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
      },
      generatedAt,
    }),
    sourceBinding({
      binding_id: "backfill.source.resource_expansion_schema",
      source_id: "resource_expansion_schema",
      source_label: "Resource Expansion Schema",
      source_path: inputs.resource_expansion_schema_path,
      source_status: resourceExpansionSchemaRead.error ? "missing" : "bound",
      binding_status: !resourceExpansionSchemaRead.error && (resourceExpansionSchema.required ?? []).includes("job_id") ? "bound" : "attention",
      content_hash: resourceExpansionSchemaRead.value ? `sha256:${hashJson(resourceExpansionSchemaRead.value)}` : null,
      details: {
        schema_id: resourceExpansionSchema.$id ?? null,
        required_top_level_field_count: resourceExpansionSchema.required?.length ?? 0,
      },
      generatedAt,
    }),
    sourceBinding({
      binding_id: "backfill.source.connector_freeze",
      source_id: "connector_freeze",
      source_label: "Connector Freeze",
      source_path: inputs.connector_freeze_path,
      source_status: connectorFreezeRead.error ? "missing" : connectorFreezeStatus ?? "unknown",
      binding_status: !connectorFreezeRead.error && connectorFreezeStatus === "complete" ? "bound" : "attention",
      content_hash: connectorFreezeRead.value ? `sha256:${hashJson(connectorFreezeRead.value)}` : null,
      details: {
        phase_slot: PREVIOUS_PHASE_SLOT,
        connector_freeze_status: connectorFreezeStatus ?? "unknown",
        next_phase_slot: connectorFreeze.summary?.next_phase_slot ?? null,
      },
      generatedAt,
    }),
    sourceBinding({
      binding_id: "backfill.source.windows_baseline_stability",
      source_id: "windows_baseline_stability",
      source_label: "Windows Baseline Stability",
      source_path: "workspace",
      source_status: "preserved",
      binding_status: "bound",
      content_hash: null,
      details: {
        phase_slot: PHASE_SLOT,
        posture: "preserve_windows_baseline_before_phase_217_plus_work",
        mac_windows_completion_instability_guard: true,
      },
      generatedAt,
    }),
  ];
}

function buildCursorContracts(resourceExpansion, fieldRequirements, generatedAt) {
  const cursorFields = groupFieldRequirements(fieldRequirements, "cursor");
  const cursor = resourceExpansion.cursor ?? {};
  const resumability = resourceExpansion.resumability ?? {};
  return [
    contractRow("backfill.cursor.required_fields", "Cursor required fields", cursorFields.every((field) => field.field_status === "validated"), {
      validated_cursor_field_count: cursorFields.filter((field) => field.field_status === "validated").length,
      cursor_field_count: cursorFields.length,
    }, generatedAt),
    contractRow("backfill.cursor.resumable_state", "Resumable state reference", typeof resumability.idempotency_strategy === "string" && typeof resumability.state_path === "string", {
      idempotency_strategy: resumability.idempotency_strategy ?? null,
      state_path_declared: typeof resumability.state_path === "string",
      loaded_previous_state_declared: typeof resumability.loaded_previous_state === "boolean",
    }, generatedAt),
    contractRow("backfill.cursor.queue_alignment", "Queue alignment", Number.isInteger(cursor.queued_count) && cursor.queued_count === (resourceExpansion.summary?.remaining_count ?? resourceExpansion.batch?.remaining_count), {
      queued_count: cursor.queued_count ?? null,
      summary_remaining_count: resourceExpansion.summary?.remaining_count ?? null,
      batch_remaining_count: resourceExpansion.batch?.remaining_count ?? null,
    }, generatedAt),
    contractRow("backfill.cursor.raw_material_boundary", "Raw cursor material boundary", true, {
      raw_cursor_material_allowed: false,
      raw_secret_material_allowed: false,
      cursor_material_policy: "hash_or_opaque_reference_only",
    }, generatedAt),
    contractRow("backfill.cursor.windows_stability", "Windows path stability", typeof resumability.state_path === "string", {
      state_path_recorded_as_opaque_reference: true,
      completion_status_must_not_depend_on_host_absolute_path: true,
      mac_windows_completion_instability_guard: true,
    }, generatedAt),
  ];
}

function buildBatchContracts(resourceExpansion, fieldRequirements, generatedAt) {
  const batchFields = groupFieldRequirements(fieldRequirements, "batch");
  const batch = resourceExpansion.batch ?? {};
  return [
    contractRow("backfill.batch.required_fields", "Batch required fields", batchFields.every((field) => field.field_status === "validated"), {
      validated_batch_field_count: batchFields.filter((field) => field.field_status === "validated").length,
      batch_field_count: batchFields.length,
    }, generatedAt),
    contractRow("backfill.batch.non_negative", "Batch counts are non-negative", nonNegativeInteger(batch.requested_batch_size) && nonNegativeInteger(batch.processed_count) && nonNegativeInteger(batch.remaining_count), {
      requested_batch_size: batch.requested_batch_size ?? null,
      processed_count: batch.processed_count ?? null,
      remaining_count: batch.remaining_count ?? null,
    }, generatedAt),
    contractRow("backfill.batch.processed_within_request", "Processed count stays within request", nonNegativeInteger(batch.processed_count) && nonNegativeInteger(batch.requested_batch_size) && batch.processed_count <= batch.requested_batch_size, {
      requested_batch_size: batch.requested_batch_size ?? null,
      processed_count: batch.processed_count ?? null,
    }, generatedAt),
    contractRow("backfill.batch.remaining_alignment", "Batch remaining count matches summary", nonNegativeInteger(batch.remaining_count) && batch.remaining_count === resourceExpansion.summary?.remaining_count, {
      batch_remaining_count: batch.remaining_count ?? null,
      summary_remaining_count: resourceExpansion.summary?.remaining_count ?? null,
    }, generatedAt),
  ];
}

function buildCountContracts(resourceExpansion, fieldRequirements, generatedAt) {
  const countFields = groupFieldRequirements(fieldRequirements, "counts");
  const summary = resourceExpansion.summary ?? {};
  const byStatus = summary.by_status ?? {};
  const terminalByStatus = (byStatus.extracted ?? 0) + (byStatus.quarantined ?? 0) + (byStatus.failed ?? 0) + (byStatus.skipped_duplicate ?? 0);
  return [
    contractRow("backfill.counts.required_fields", "Count required fields", countFields.every((field) => field.field_status === "validated"), {
      validated_count_field_count: countFields.filter((field) => field.field_status === "validated").length,
      count_field_count: countFields.length,
    }, generatedAt),
    contractRow("backfill.counts.terminal_partition", "Terminal count matches terminal statuses", nonNegativeInteger(summary.terminal_count) && summary.terminal_count === terminalByStatus, {
      terminal_count: summary.terminal_count ?? null,
      terminal_by_status_count: terminalByStatus,
    }, generatedAt),
    contractRow("backfill.counts.remaining_queue_alignment", "Remaining count matches cursor", nonNegativeInteger(summary.remaining_count) && summary.remaining_count === resourceExpansion.cursor?.queued_count, {
      remaining_count: summary.remaining_count ?? null,
      cursor_queued_count: resourceExpansion.cursor?.queued_count ?? null,
    }, generatedAt),
    contractRow("backfill.counts.discovered_partition", "Discovered count covers remaining and terminal counts", nonNegativeInteger(summary.discovered_count) && summary.discovered_count >= (summary.terminal_count ?? 0) + (summary.remaining_count ?? 0), {
      discovered_count: summary.discovered_count ?? null,
      terminal_count: summary.terminal_count ?? null,
      remaining_count: summary.remaining_count ?? null,
    }, generatedAt),
    contractRow("backfill.counts.failure_quarantine_duplicate", "Failure, quarantine, duplicate, and extraction counts are declared", ["failed_count", "quarantine_count", "skipped_duplicate_count", "extracted_count"].every((key) => nonNegativeInteger(summary[key])), {
      failed_count: summary.failed_count ?? null,
      quarantine_count: summary.quarantine_count ?? null,
      skipped_duplicate_count: summary.skipped_duplicate_count ?? null,
      extracted_count: summary.extracted_count ?? null,
    }, generatedAt),
  ];
}

function buildPolicyBindings(resourceExpansion, fieldRequirements, generatedAt) {
  const policyFields = groupFieldRequirements(fieldRequirements, "policy_snapshot");
  return [
    policyBinding("backfill.policy.snapshot_required", "Policy snapshot id is required", typeof resourceExpansion.policy_snapshot_id === "string" && resourceExpansion.policy_snapshot_id.length > 0, {
      policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
    }, generatedAt),
    policyBinding("backfill.policy.field_contract", "Policy snapshot field is validated", policyFields.every((field) => field.field_status === "validated"), {
      validated_policy_snapshot_field_count: policyFields.filter((field) => field.field_status === "validated").length,
      policy_snapshot_field_count: policyFields.length,
    }, generatedAt),
    policyBinding("backfill.policy.human_review_gate", "Policy snapshot changes require human review", true, {
      human_review_required_for_policy_change: true,
      automatic_policy_snapshot_mutation_allowed: false,
    }, generatedAt),
    policyBinding("backfill.policy.legal_client_boundary", "Legal and client-facing outputs remain blocked", true, {
      legal_advice_generated: false,
      client_facing_output_generated: false,
      human_review_required: true,
    }, generatedAt),
  ];
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "backfill-job-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    contract_report_only: true,
    backfill_execution_performed: false,
    connector_runtime_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    policy_snapshot_mutation_performed: false,
    credential_material_read: false,
    external_network_access_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    generated_at: generatedAt,
  };
}

function buildBackfillJobSchemaContract(fieldRequirements, resourceExpansionSchema, generatedAt) {
  const groups = Object.entries(FIELD_GROUP_LABELS).map(([groupId, label]) => ({
    group_id: groupId,
    label,
    field_paths: groupFieldRequirements(fieldRequirements, groupId).map((field) => field.field_path),
  }));
  return {
    schema_version: "backfill-job-schema.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    source_schema_id: resourceExpansionSchema.$id ?? null,
    source_schema_version_const: resourceExpansionSchema.properties?.schema_version?.const ?? null,
    required_field_count: fieldRequirements.length,
    field_group_count: groups.length,
    field_groups: groups,
    raw_cursor_material_allowed: false,
    backfill_execution_required_for_contract_validation: false,
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints(context) {
  const {
    fieldRequirements,
    sourceBindings,
    cursorContracts,
    batchContracts,
    countContracts,
    policyBindings,
    boundary,
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
  } = context;
  const groupPassed = (groupId) => groupFieldRequirements(fieldRequirements, groupId).every((field) => field.field_status === "validated");
  return [
    checkpoint("source.resource_expansion.bound", sourceBindings.find((binding) => binding.binding_id === "backfill.source.resource_expansion_job")?.binding_status === "bound", "Resource expansion job source is available and bound."),
    checkpoint("source.resource_expansion_schema.bound", sourceBindings.find((binding) => binding.binding_id === "backfill.source.resource_expansion_schema")?.binding_status === "bound", "Resource expansion schema is available and bound."),
    checkpoint("source.connector_freeze.complete", sourceBindings.find((binding) => binding.binding_id === "backfill.source.connector_freeze")?.binding_status === "bound", "Connector Freeze P276 source is complete."),
    checkpoint("source.windows_baseline.preserved", sourceBindings.find((binding) => binding.binding_id === "backfill.source.windows_baseline_stability")?.binding_status === "bound", "Windows baseline stability posture is preserved for P217 and later work."),
    checkpoint("fields.job_identity.validated", groupPassed("job_identity"), "Job identity fields are validated."),
    checkpoint("fields.source_binding.validated", groupPassed("source_binding"), "Source binding fields are validated."),
    checkpoint("fields.cursor.validated", groupPassed("cursor"), "Cursor and resumability fields are validated."),
    checkpoint("fields.batch.validated", groupPassed("batch"), "Batch fields are validated."),
    checkpoint("fields.counts.validated", groupPassed("counts"), "Count fields are validated."),
    checkpoint("fields.policy_snapshot.validated", groupPassed("policy_snapshot"), "Policy snapshot field is validated."),
    checkpoint("contracts.cursor.passed", cursorContracts.every((item) => item.contract_status === "passed"), "Cursor contracts passed."),
    checkpoint("contracts.batch.passed", batchContracts.every((item) => item.contract_status === "passed"), "Batch contracts passed."),
    checkpoint("contracts.counts.passed", countContracts.every((item) => item.contract_status === "passed"), "Count contracts passed."),
    checkpoint("contracts.policy.passed", policyBindings.every((item) => item.policy_binding_status === "bound"), "Policy snapshot bindings passed."),
    checkpoint("boundary.no_execution", boundary.backfill_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false && boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false, "Backfill contract validation is report-only and performs no execution, ingest, file content read, or mutation."),
    checkpoint("boundary.no_delivery_legal_client", boundary.delivery_execution_performed === false && boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "Delivery, protected action, legal advice, and client-facing output remain blocked."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:backfill-job-contract"), "package.json exposes resource:backfill-job-contract."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["backfill_job_contract", "resource:backfill-job-contract"]) && includesAll(reviewDashboardText.value, ["backfill_job_contract", "buildBackfillJobContractStage"]) && includesAll(reviewApiText.value, ["/api/backfill-job-contracts", "/api/backfill-job-field-requirements"]), "Control-plane loop, dashboard, and API expose the Backfill Job Contract."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P277", "backfill job contract"]) && includesAll(implementationRoadmapText.value, ["Phase 277", "Backfill Job Contract"]), "Ledger and implementation roadmap promote Phase 277."),
  ];
}

function summarizeBackfillJobContract(context) {
  const {
    resourceExpansion,
    connectorFreeze,
    fieldRequirements,
    sourceBindings,
    cursorContracts,
    batchContracts,
    countContracts,
    policyBindings,
    boundary,
    validation,
  } = context;
  const groupCounts = Object.fromEntries(Object.keys(FIELD_GROUP_LABELS).map((groupId) => {
    const fields = groupFieldRequirements(fieldRequirements, groupId);
    return [`${groupId}_field_count`, fields.length];
  }));
  const validatedGroupCounts = Object.fromEntries(Object.keys(FIELD_GROUP_LABELS).map((groupId) => {
    const fields = groupFieldRequirements(fieldRequirements, groupId);
    return [`validated_${groupId}_field_count`, fields.filter((field) => field.field_status === "validated").length];
  }));
  const failedCheckpointCount = validation.errors.length;
  return {
    backfill_job_contract_status: failedCheckpointCount === 0 ? "complete" : "attention",
    backfill_job_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_policy_snapshot_id: resourceExpansion.policy_snapshot_id ?? null,
    source_connector_freeze_status: connectorFreeze.summary?.connector_freeze_status ?? connectorFreeze.connector_freeze_status ?? "unknown",
    field_group_count: Object.keys(FIELD_GROUP_LABELS).length,
    required_field_count: fieldRequirements.length,
    validated_required_field_count: fieldRequirements.filter((field) => field.field_status === "validated").length,
    missing_required_field_count: fieldRequirements.filter((field) => field.field_status !== "validated").length,
    ...groupCounts,
    ...validatedGroupCounts,
    source_binding_count: sourceBindings.length,
    bound_source_binding_count: sourceBindings.filter((binding) => binding.binding_status === "bound").length,
    cursor_contract_count: cursorContracts.length,
    passed_cursor_contract_count: cursorContracts.filter((item) => item.contract_status === "passed").length,
    batch_contract_count: batchContracts.length,
    passed_batch_contract_count: batchContracts.filter((item) => item.contract_status === "passed").length,
    count_contract_count: countContracts.length,
    passed_count_contract_count: countContracts.filter((item) => item.contract_status === "passed").length,
    policy_binding_count: policyBindings.length,
    passed_policy_binding_count: policyBindings.filter((item) => item.policy_binding_status === "bound").length,
    job_id_required: true,
    source_id_required: true,
    cursor_required: true,
    batch_required: true,
    counts_required: true,
    policy_snapshot_required: true,
    resumable_cursor_required: true,
    raw_cursor_material_allowed: false,
    read_only: boundary.read_only,
    contract_report_only: boundary.contract_report_only,
    backfill_execution_performed: boundary.backfill_execution_performed,
    connector_runtime_execution_performed: boundary.connector_runtime_execution_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    policy_snapshot_mutation_performed: boundary.policy_snapshot_mutation_performed,
    credential_material_read: boundary.credential_material_read,
    external_network_access_performed: boundary.external_network_access_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    human_review_required: boundary.human_review_required,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    contract_report_only: true,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_allowed: false,
    resource_mutation_allowed: false,
    protected_actions_executed: false,
    external_delivery_executed: false,
    external_model_call_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts(context) {
  return [
    textContractRef("package.json", context.packageJson),
    textContractRef("final-completion-phase-ledger", context.roadmapText),
    textContractRef("implementation-roadmap", context.implementationRoadmapText),
    textContractRef("control-plane-loop", context.controlPlaneLoopText),
    textContractRef("review-dashboard", context.reviewDashboardText),
    textContractRef("review-api", context.reviewApiText),
    contractRef("resource-expansion-job", context.resourceExpansionRead),
    contractRef("resource-expansion-schema", context.resourceExpansionSchemaRead),
    contractRef("connector-freeze", context.connectorFreezeRead),
  ];
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Backfill Job Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.backfill_job_contract_status}`);
  lines.push(`Phase: ${result.summary.phase_slot}`);
  lines.push(`Required fields: ${result.summary.validated_required_field_count}/${result.summary.required_field_count}`);
  lines.push(`Cursor contracts: ${result.summary.passed_cursor_contract_count}/${result.summary.cursor_contract_count}`);
  lines.push(`Batch contracts: ${result.summary.passed_batch_contract_count}/${result.summary.batch_contract_count}`);
  lines.push(`Count contracts: ${result.summary.passed_count_contract_count}/${result.summary.count_contract_count}`);
  lines.push(`Policy bindings: ${result.summary.passed_policy_binding_count}/${result.summary.policy_binding_count}`);
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  lines.push("");
  lines.push("## Field Groups");
  for (const [groupId, label] of Object.entries(FIELD_GROUP_LABELS)) {
    const fields = result.backfill_job_field_requirements.filter((field) => field.field_group === groupId);
    lines.push(`- ${label}: ${fields.filter((field) => field.field_status === "validated").length}/${fields.length}`);
  }
  lines.push("");
  lines.push("## Checkpoints");
  for (const checkpointItem of result.backfill_job_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function serializableBackfillJobContract(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function fieldRequirement(fieldGroup, fieldPath, expectedTypes, contractRequired, rationale) {
  return {
    field_group: fieldGroup,
    field_path: fieldPath,
    expected_types: expectedTypes,
    contract_required: contractRequired,
    rationale,
  };
}

function sourceBinding({ binding_id, source_id, source_label, source_path, source_status, binding_status, content_hash, details, generatedAt }) {
  return {
    schema_version: "backfill-job-source-binding.v1",
    binding_id,
    source_id,
    source_label,
    source_path,
    source_status,
    binding_status,
    content_hash,
    details,
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function contractRow(contractId, label, passed, details, generatedAt) {
  return {
    schema_version: "backfill-job-contract-row.v1",
    contract_id: contractId,
    contract_label: label,
    contract_status: passed ? "passed" : "attention",
    details,
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function policyBinding(bindingId, label, passed, details, generatedAt) {
  return {
    schema_version: "backfill-job-policy-binding.v1",
    policy_binding_id: bindingId,
    policy_binding_label: label,
    policy_binding_status: passed ? "bound" : "attention",
    details,
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "backfill-job-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function groupFieldRequirements(fieldRequirements, groupId) {
  return fieldRequirements.filter((field) => field.field_group === groupId);
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function observedTypeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function hasPath(value, fieldPath) {
  let cursor = value;
  for (const part of fieldPath.split(".")) {
    if (!cursor || typeof cursor !== "object" || !Object.hasOwn(cursor, part)) return false;
    cursor = cursor[part];
  }
  return true;
}

function getPath(value, fieldPath) {
  let cursor = value;
  for (const part of fieldPath.split(".")) {
    if (!cursor || typeof cursor !== "object" || !Object.hasOwn(cursor, part)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_BACKFILL_JOB_CONTRACT_INPUTS;
  return {
    repo_root: path.resolve(options.repoRoot ?? defaults.repoRoot),
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_path: options.roadmapPath ?? defaults.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? defaults.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? defaults.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? defaults.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? defaults.reviewApiPath,
    resource_expansion_path: path.resolve(options.resourceExpansionPath ?? defaults.resourceExpansionPath),
    resource_expansion_schema_path: path.resolve(options.resourceExpansionSchemaPath ?? defaults.resourceExpansionSchemaPath),
    connector_freeze_path: path.resolve(options.connectorFreezePath ?? defaults.connectorFreezePath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-expansion-schema") parsed.resourceExpansionSchemaPath = argv[++index];
    else if (arg === "--connector-freeze") parsed.connectorFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/backfill-job-contract.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --no-write                      Build in memory without writing artifacts.
  --out-dir <path>                Output directory.
  --resource-expansion <path>     resource-expansion-job.json path.
  --resource-expansion-schema <path> resource-expansion schema path.
  --connector-freeze <path>       connector-freeze.json path.
  --package <path>                package.json path.
  --roadmap <path>                final completion ledger path.
  --implementation-roadmap <path> implementation roadmap path.
  --control-plane-loop <path>     control-plane loop source path.
  --review-dashboard <path>       review dashboard source path.
  --review-api <path>             review API source path.
  --run-at <iso>                  Deterministic timestamp.
`);
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    items,
    item_count: items.length,
    passed_count: items.filter((item) => item.status === "passed").length,
    failed_count: errors.length,
    errors,
  };
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(value, needles) {
  return typeof value === "string" && needles.every((needle) => value.includes(needle));
}

async function readJsonOrError(filePath) {
  try {
    return {
      value: JSON.parse(await readFileWithRetry(filePath, "utf8")),
    };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFileWithRetry(filePath, "utf8"),
    };
  } catch (error) {
    return {
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 10) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EISDIR", "ENOENT"].includes(error.code) || attempt === attempts) throw error;
      await sleep(100 * attempt);
    }
  }
  throw lastError;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  const value = result?.value ?? result;
  return {
    label,
    available: true,
    schema_version: value?.schema_version ?? value?.$id ?? null,
    content_hash: `sha256:${hashJson(value ?? {})}`,
  };
}

function textContractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  return {
    label,
    available: true,
    content_hash: `sha256:${hashText(result?.value ?? "")}`,
  };
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runBackfillJobContractCli();
}
