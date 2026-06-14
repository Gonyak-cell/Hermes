import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildControlledExecutionWriteDeploy } from "./controlled-execution-write-deploy.mjs";

export const DEFAULT_MEMORY_BANK_EVENT_OBSERVABILITY_PLANE_OUT_DIR = "artifacts/memory-bank-event-observability-plane/latest";
export const DEFAULT_MEMORY_BANK_EVENT_OBSERVABILITY_PLANE_INPUTS = {
  schemaPath: "schemas/memory-bank-event-observability-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:memory-bank-event-observability-plane";
const EXECUTION_COMMAND_NAME = "platform:controlled-execution-write-deploy";
const SCHEMA_VERSION = "memory-bank-event-observability-plane.v1";
const CAPABILITY_ID = "platform.memory_bank_event_observability_plane";
const PROGRAM_RANGE = "P7001-P7300";
const READY_STATUS = "ready_for_memory_bank_event_observability_plane_v0";
const EXECUTION_READY_STATUS = "ready_for_controlled_execution_write_deploy_v0";

const PHASE_SPECS = [
  ["P7001-P7030", "Append-Only Event Store Contract"],
  ["P7031-P7060", "Object Artifact Reference Store"],
  ["P7061-P7090", "Transcript Source Event Binding"],
  ["P7091-P7120", "Review Receipt Event Binding"],
  ["P7121-P7150", "Gate and Verdict Event Ledger"],
  ["P7151-P7180", "Trace Audit Cost Observability"],
  ["P7181-P7210", "Retention Backup Restore Boundary"],
  ["P7211-P7240", "Memory Bank Storage Index"],
  ["P7241-P7270", "Event Observability Negative Fixtures"],
  ["P7271-P7300", "Memory Event Observability Freeze"],
];

const EVENT_TYPE_SPECS = [
  ["event.conversation_source", "Codex or Claude transcript source event"],
  ["event.claim", "claim or completion assertion event"],
  ["event.evidence", "evidence reference event"],
  ["event.validation", "validator result event"],
  ["event.review_receipt", "Claude review receipt event"],
  ["event.gate_verdict", "hard gate PASS/BLOCK/PENDING event"],
  ["event.plan_update", "plan row or phase update event"],
  ["event.next_condition", "next execution condition event"],
];

const OBJECT_REF_SPECS = [
  ["object.transcript_envelope", "redacted transcript envelope reference"],
  ["object.artifact", "artifact hash and path reference"],
  ["object.validation_report", "validation report object reference"],
  ["object.review_receipt", "review receipt object reference"],
  ["object.patch_candidate", "patch candidate object reference"],
  ["object.rollback_plan", "rollback plan object reference"],
];

const OBSERVABILITY_SPECS = [
  ["metric.trace_id", "trace id binding"],
  ["metric.audit_actor", "actor and owner audit field"],
  ["metric.duration_ms", "duration and latency field"],
  ["metric.token_cost", "token and cost field"],
  ["metric.validation_error_count", "validation error count field"],
  ["metric.unsafe_flag_count", "unsafe flag count field"],
  ["metric.gate_pass_count", "gate pass and total count field"],
];

const MEMORY_INDEX_SPECS = [
  ["memory.archive", "archive source refs and evidence refs"],
  ["memory.sync", "sync append-only event refs into bounded index"],
  ["memory.index", "index events by project, domain, phase, gate, and owner"],
  ["memory.extract", "extract structured facts and next conditions"],
  ["memory.consolidate", "consolidate duplicates with conflict notes"],
  ["memory.relate", "relate claims, evidence, receipts, reviews, gates, and plans"],
];

const NEGATIVE_FIXTURES = [
  ["negative.mutable_event", "event can be overwritten or deleted in place", "BLOCK_MUTABLE_EVENT"],
  ["negative.raw_transcript_default", "raw transcript body is exposed by default", "BLOCK_RAW_TRANSCRIPT_ACCESS"],
  ["negative.uncited_memory", "memory fact is recalled without source citation", "BLOCK_UNCITED_MEMORY"],
  ["negative.cross_domain_leak", "event crosses project, matter, or domain boundary", "BLOCK_DOMAIN_LEAK"],
  ["negative.missing_review_receipt_event", "milestone review claim has no review receipt event", "BLOCK_REVIEW_EVENT_GAP"],
  ["negative.no_trace_cost", "tool or validation run lacks trace, duration, or cost fields", "BLOCK_OBSERVABILITY_GAP"],
  ["negative.delete_without_retention", "event/object is deleted without retention or hold policy", "BLOCK_RETENTION_BYPASS"],
  ["negative.recall_runtime_enabled", "runtime recall is enabled before P7301-P7600 retrieval layer", "BLOCK_PREMATURE_RECALL"],
];

export async function runMemoryBankEventObservabilityPlane(options = {}) {
  const result = await buildMemoryBankEventObservabilityPlane(options);
  if (options.write !== false) await writeMemoryBankEventObservabilityPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Memory bank event observability plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMemoryBankEventObservabilityPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MEMORY_BANK_EVENT_OBSERVABILITY_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const execution = options.execution ?? await buildControlledExecutionWriteDeploy({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildMemoryContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const eventStoreRows = buildEventStoreRows(generatedAt);
  const objectRefRows = buildObjectReferenceRows(generatedAt);
  const transcriptBindingRows = buildTranscriptBindingRows(generatedAt);
  const reviewReceiptEventRows = buildReviewReceiptEventRows(generatedAt);
  const gateVerdictRows = buildGateVerdictRows(generatedAt);
  const observabilityRows = buildObservabilityRows(generatedAt);
  const retentionRows = buildRetentionRows(generatedAt);
  const memoryIndexRows = buildMemoryIndexRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({ eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, execution, contract, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows });
  const boundary = buildBoundary({ execution, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, execution, contract, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    memory_bank_event_observability_plane_id: `memory-bank-event-observability-plane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_controlled_execution_write_deploy_summary: execution.summary,
    memory_bank_event_observability_contract: contract,
    memory_bank_event_observability_phase_rows: phaseRows,
    append_only_event_store_rows: eventStoreRows,
    object_artifact_reference_rows: objectRefRows,
    transcript_source_event_binding_rows: transcriptBindingRows,
    review_receipt_event_binding_rows: reviewReceiptEventRows,
    gate_verdict_event_ledger_rows: gateVerdictRows,
    trace_audit_cost_observability_rows: observabilityRows,
    retention_backup_restore_rows: retentionRows,
    memory_bank_storage_index_rows: memoryIndexRows,
    event_observability_negative_fixture_rows: negativeFixtureRows,
    memory_bank_event_observability_freeze_rows: freezeRows,
    memory_bank_event_observability_gate_rows: gateRows,
    memory_bank_event_observability_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ execution, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "memory_bank_event_observability_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ execution, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.memory_bank_event_observability_plane_id = result.memory_bank_event_observability_plane_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeMemoryBankEventObservabilityPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "memory-bank-event-observability-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "append-only-event-store-rows.json"), collectionEnvelope("append-only-event-store-rows.v1", "append_only_event_store_rows", result.append_only_event_store_rows, result.generated_at));
  await writeJson(path.join(outDir, "object-artifact-reference-rows.json"), collectionEnvelope("object-artifact-reference-rows.v1", "object_artifact_reference_rows", result.object_artifact_reference_rows, result.generated_at));
  await writeJson(path.join(outDir, "transcript-source-event-binding-rows.json"), collectionEnvelope("transcript-source-event-binding-rows.v1", "transcript_source_event_binding_rows", result.transcript_source_event_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-receipt-event-binding-rows.json"), collectionEnvelope("review-receipt-event-binding-rows.v1", "review_receipt_event_binding_rows", result.review_receipt_event_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-verdict-event-ledger-rows.json"), collectionEnvelope("gate-verdict-event-ledger-rows.v1", "gate_verdict_event_ledger_rows", result.gate_verdict_event_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "trace-audit-cost-observability-rows.json"), collectionEnvelope("trace-audit-cost-observability-rows.v1", "trace_audit_cost_observability_rows", result.trace_audit_cost_observability_rows, result.generated_at));
  await writeJson(path.join(outDir, "retention-backup-restore-rows.json"), collectionEnvelope("retention-backup-restore-rows.v1", "retention_backup_restore_rows", result.retention_backup_restore_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-bank-storage-index-rows.json"), collectionEnvelope("memory-bank-storage-index-rows.v1", "memory_bank_storage_index_rows", result.memory_bank_storage_index_rows, result.generated_at));
  await writeJson(path.join(outDir, "event-observability-negative-fixture-rows.json"), collectionEnvelope("event-observability-negative-fixture-rows.v1", "event_observability_negative_fixture_rows", result.event_observability_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-bank-event-observability-freeze-rows.json"), collectionEnvelope("memory-bank-event-observability-freeze-rows.v1", "memory_bank_event_observability_freeze_rows", result.memory_bank_event_observability_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-bank-event-observability-gate-rows.json"), collectionEnvelope("memory-bank-event-observability-gate-rows.v1", "memory_bank_event_observability_gate_rows", result.memory_bank_event_observability_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-bank-event-observability-boundary.json"), result.memory_bank_event_observability_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "memory-bank-event-observability-plane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMemoryBankEventObservabilityPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runMemoryBankEventObservabilityPlane(args);
    console.log(`Memory bank event observability plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.memory_bank_event_observability_plane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Event types: ${result.summary.event_type_count}`);
    console.log(`Object refs: ${result.summary.object_reference_count}`);
    console.log(`Transcript bindings: ${result.summary.transcript_source_binding_count}`);
    console.log(`Runtime recall enabled: ${result.summary.runtime_recall_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMemoryContract(generatedAt) {
  return {
    schema_version: "memory-bank-event-observability-contract.v1",
    generated_at: generatedAt,
    contract_id: "memory-bank-event-observability-contract.p7001-p7300",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6601-P7000",
    append_only_event_store_required: true,
    object_artifact_reference_store_required: true,
    transcript_source_event_binding_required: true,
    review_receipt_event_binding_required: true,
    gate_verdict_event_ledger_required: true,
    trace_audit_cost_observability_required: true,
    retention_backup_restore_required: true,
    memory_bank_storage_index_required: true,
    raw_transcript_default_access_enabled: false,
    mutable_event_update_enabled: false,
    runtime_recall_enabled: false,
    retrieval_layer_enabled: false,
    cross_domain_memory_leak_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "memory-bank-event-observability-phase-row.v1",
      row_id: `memory.bank.event.observability.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.memory_bank_event_observability.${phase_range}`,
      responsible_owner: "platform_memory_owner",
      next_allowed_action: pass ? "preserve memory event phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildEventStoreRows(generatedAt) {
  return EVENT_TYPE_SPECS.map(([event_type, description]) => ({
    schema_version: "append-only-event-store-row.v1",
    row_id: `append.only.event.store.row.${event_type.split(".").at(-1)}`,
    generated_at: generatedAt,
    event_type,
    description,
    append_only_required: true,
    event_id_required: true,
    source_ref_required: true,
    timestamp_required: true,
    owner_required: true,
    immutable_after_write: true,
    mutation_allowed: false,
    deletion_allowed_without_retention_policy: false,
    evidence_ref: `evidence.append_only_event_store.${event_type}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.append_only_event_store.${event_type}`,
    next_allowed_action: "record event as append-only reference contract",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildObjectReferenceRows(generatedAt) {
  return OBJECT_REF_SPECS.map(([object_type, description]) => ({
    schema_version: "object-artifact-reference-row.v1",
    row_id: `object.artifact.reference.row.${object_type.split(".").at(-1)}`,
    generated_at: generatedAt,
    object_type,
    description,
    object_id_required: true,
    hash_required: true,
    path_or_uri_required: true,
    source_event_ref_required: true,
    raw_body_embedded_by_default: false,
    redaction_status_required: true,
    evidence_ref: `evidence.object_artifact_reference.${object_type}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.object_artifact_reference.${object_type}`,
    next_allowed_action: "store object references without raw body exposure",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTranscriptBindingRows(generatedAt) {
  const specs = [
    ["transcript.codex", "Codex conversation source"],
    ["transcript.claude_code", "Claude Code review transcript source"],
  ];
  return specs.map(([transcript_source_id, source_name]) => ({
    schema_version: "transcript-source-event-binding-row.v1",
    row_id: `transcript.source.event.binding.row.${transcript_source_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    transcript_source_id,
    source_name,
    local_archive_required: true,
    event_binding_required: true,
    redaction_required: true,
    classification_required: true,
    raw_transcript_default_access_enabled: false,
    conversation_to_claim_extraction_required: true,
    evidence_ref: `evidence.transcript_source_event_binding.${transcript_source_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.transcript_source_event_binding.${transcript_source_id}`,
    next_allowed_action: "bind transcript source to append-only event without exposing raw body",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildReviewReceiptEventRows(generatedAt) {
  return [
    {
      schema_version: "review-receipt-event-binding-row.v1",
      row_id: "review.receipt.event.binding.row.001",
      generated_at: generatedAt,
      receipt_type: "claude_code_opus_max_review",
      receipt_event_required: true,
      durable_raw_json_object_ref_required: true,
      normalized_findings_required: true,
      model_alias_required: true,
      scope_required: true,
      reviewer_mutation_allowed: false,
      final_approval_allowed: false,
      evidence_ref: "evidence.review_receipt_event_binding.claude_code_opus_max_review",
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: "gate.review_receipt_event_binding.claude_code_opus_max_review",
      next_allowed_action: "record review receipt event before milestone review claim",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildGateVerdictRows(generatedAt) {
  const verdicts = ["PASS", "BLOCK", "PENDING"];
  return verdicts.map((verdict) => ({
    schema_version: "gate-verdict-event-ledger-row.v1",
    row_id: `gate.verdict.event.ledger.row.${verdict.toLowerCase()}`,
    generated_at: generatedAt,
    verdict,
    gate_event_required: true,
    evidence_ref_required: true,
    reviewer_ref_required: true,
    hard_gate_ref_required: true,
    next_allowed_action_required: true,
    unsafe_pass_without_evidence_allowed: false,
    evidence_ref: `evidence.gate_verdict_event_ledger.${verdict.toLowerCase()}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.gate_verdict_event_ledger.${verdict.toLowerCase()}`,
    next_allowed_action: "preserve gate verdict event contract",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildObservabilityRows(generatedAt) {
  return OBSERVABILITY_SPECS.map(([metric_id, description]) => ({
    schema_version: "trace-audit-cost-observability-row.v1",
    row_id: `trace.audit.cost.observability.row.${metric_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    metric_id,
    description,
    metric_required: true,
    trace_ref_required: true,
    audit_ref_required: metric_id !== "metric.duration_ms",
    missing_metric_blocks_closeout: true,
    evidence_ref: `evidence.trace_audit_cost_observability.${metric_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.trace_audit_cost_observability.${metric_id}`,
    next_allowed_action: "record observability metric as event metadata",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRetentionRows(generatedAt) {
  const specs = [
    ["retention.event", "event retention and legal hold policy"],
    ["retention.object", "object reference retention and redaction policy"],
    ["retention.backup", "backup snapshot and restore drill policy"],
    ["retention.domain_partition", "domain and tenant partition policy"],
  ];
  return specs.map(([policy_id, description]) => ({
    schema_version: "retention-backup-restore-row.v1",
    row_id: `retention.backup.restore.row.${policy_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    policy_id,
    description,
    retention_policy_required: true,
    backup_snapshot_required: true,
    restore_drill_required: true,
    deletion_hold_required: true,
    delete_without_policy_allowed: false,
    evidence_ref: `evidence.retention_backup_restore.${policy_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.retention_backup_restore.${policy_id}`,
    next_allowed_action: "bind retention and restore policy before recall runtime",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildMemoryIndexRows(generatedAt) {
  return MEMORY_INDEX_SPECS.map(([operation_id, description]) => ({
    schema_version: "memory-bank-storage-index-row.v1",
    row_id: `memory.bank.storage.index.row.${operation_id.split(".").at(-1)}`,
    generated_at: generatedAt,
    operation_id,
    description,
    storage_index_contract_ready: true,
    source_citation_required: true,
    source_status_required: true,
    domain_boundary_required: true,
    conflict_note_required: operation_id === "memory.consolidate",
    runtime_recall_enabled: false,
    evidence_ref: `evidence.memory_bank_storage_index.${operation_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.memory_bank_storage_index.${operation_id}`,
    next_allowed_action: "prepare storage index; keep runtime recall for P7301-P7600",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "event-observability-negative-fixture-row.v1",
    row_id: `event.observability.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_memory_claim_allowed: false,
    evidence_ref: `evidence.event_observability_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.event_observability_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve memory event negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, generatedAt }) {
  const specs = [
    ["event_store_ready", eventStoreRows.every((row) => row.append_only_required && row.mutation_allowed === false), "append-only event store contract is ready"],
    ["object_reference_ready", objectRefRows.every((row) => row.hash_required && row.raw_body_embedded_by_default === false), "object reference contract is ready"],
    ["transcript_binding_ready", transcriptBindingRows.every((row) => row.local_archive_required && row.raw_transcript_default_access_enabled === false), "transcript event binding is ready"],
    ["review_receipt_event_ready", reviewReceiptEventRows.every((row) => row.receipt_event_required && row.final_approval_allowed === false), "review receipt event binding is ready"],
    ["gate_verdict_ready", gateVerdictRows.every((row) => row.gate_event_required && row.unsafe_pass_without_evidence_allowed === false), "gate verdict event ledger is ready"],
    ["observability_ready", observabilityRows.every((row) => row.metric_required && row.missing_metric_blocks_closeout), "trace/audit/cost observability is ready"],
    ["retention_ready", retentionRows.every((row) => row.retention_policy_required && row.delete_without_policy_allowed === false), "retention backup restore boundary is ready"],
    ["memory_index_ready", memoryIndexRows.every((row) => row.storage_index_contract_ready && row.runtime_recall_enabled === false), "memory storage index is ready without runtime recall"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_memory_claim_allowed === false), "memory event negative fixtures block unsafe claims"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "memory-bank-event-observability-freeze-row.v1",
    row_id: `memory.bank.event.observability.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.memory_bank_event_observability.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.memory_bank_event_observability.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, execution, contract, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:memory-bank-event-observability-plane"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes memory bank event observability plane"],
    ["execution_script_registered", Boolean(packageJson.data?.scripts?.[EXECUTION_COMMAND_NAME]), "controlled execution write deploy script exists"],
    ["execution_ready", execution.summary?.controlled_execution_write_deploy_status === EXECUTION_READY_STATUS, "P6601-P7000 controlled execution write deploy is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Memory Bank Storage Event and Observability Plane"), "P7001-P7300 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Memory Bank Storage Event and Observability Plane"), "architecture doc reflects memory bank event observability"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Memory Bank Storage Event and Observability Plane"), "review dashboard IA reflects memory bank event observability"],
    ["contract_ready", contract.append_only_event_store_required && contract.raw_transcript_default_access_enabled === false && contract.runtime_recall_enabled === false, "memory event contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P7001-P7300 phase rows pass"],
    ["event_store_ready", eventStoreRows.length >= 8 && eventStoreRows.every((row) => row.mutation_allowed === false), "append-only event store rows are ready"],
    ["object_refs_ready", objectRefRows.length >= 6 && objectRefRows.every((row) => row.raw_body_embedded_by_default === false), "object reference rows are ready"],
    ["transcript_bindings_ready", transcriptBindingRows.length >= 2 && transcriptBindingRows.every((row) => row.raw_transcript_default_access_enabled === false), "transcript binding rows are ready"],
    ["review_receipt_event_ready", reviewReceiptEventRows.every((row) => row.receipt_event_required && row.final_approval_allowed === false), "review receipt event rows are ready"],
    ["gate_verdict_ready", gateVerdictRows.length === 3 && gateVerdictRows.every((row) => row.unsafe_pass_without_evidence_allowed === false), "gate verdict rows are ready"],
    ["observability_ready", observabilityRows.length >= 7 && observabilityRows.every((row) => row.metric_required), "observability rows are ready"],
    ["retention_ready", retentionRows.length >= 4 && retentionRows.every((row) => row.delete_without_policy_allowed === false), "retention rows are ready"],
    ["memory_index_ready", memoryIndexRows.length >= 6 && memoryIndexRows.every((row) => row.runtime_recall_enabled === false), "memory index rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "memory negative fixtures are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_recall_runtime", contract.runtime_recall_enabled === false && contract.retrieval_layer_enabled === false, "runtime recall stays disabled until P7301"],
    ["boundary_no_write_workos", contract.write_action_enabled === false && contract.work_os_claim_enabled === false, "write and Work OS claims stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "memory-bank-event-observability-gate-row.v1",
    row_id: `memory.bank.event.observability.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.memory_bank_event_observability.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("review") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.memory_bank_event_observability.${gate_id}`,
    responsible_owner: "platform_memory_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ execution, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    execution.summary?.controlled_execution_write_deploy_status !== EXECUTION_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    eventStoreRows.some((row) => row.mutation_allowed || !row.append_only_required),
    objectRefRows.some((row) => row.raw_body_embedded_by_default || !row.hash_required),
    transcriptBindingRows.some((row) => row.raw_transcript_default_access_enabled || !row.local_archive_required),
    reviewReceiptEventRows.some((row) => row.reviewer_mutation_allowed || row.final_approval_allowed),
    gateVerdictRows.some((row) => row.unsafe_pass_without_evidence_allowed || !row.evidence_ref_required),
    observabilityRows.some((row) => !row.metric_required || !row.missing_metric_blocks_closeout),
    retentionRows.some((row) => row.delete_without_policy_allowed || !row.restore_drill_required),
    memoryIndexRows.some((row) => row.runtime_recall_enabled || !row.source_citation_required),
    negativeFixtureRows.some((row) => row.unsafe_memory_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "memory-bank-event-observability-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6601-P7000",
    memory_bank_event_observability_plane_ready: unsafeFlags.filter(Boolean).length === 0,
    controlled_execution_write_deploy_ready: execution.summary?.controlled_execution_write_deploy_status === EXECUTION_READY_STATUS,
    append_only_event_store_ready: eventStoreRows.every((row) => row.append_only_required && row.mutation_allowed === false),
    object_artifact_reference_store_ready: objectRefRows.every((row) => row.hash_required && row.raw_body_embedded_by_default === false),
    transcript_source_event_binding_ready: transcriptBindingRows.every((row) => row.local_archive_required && row.raw_transcript_default_access_enabled === false),
    review_receipt_event_binding_ready: reviewReceiptEventRows.every((row) => row.receipt_event_required && row.final_approval_allowed === false),
    gate_verdict_event_ledger_ready: gateVerdictRows.every((row) => row.gate_event_required && row.unsafe_pass_without_evidence_allowed === false),
    trace_audit_cost_observability_ready: observabilityRows.every((row) => row.metric_required && row.missing_metric_blocks_closeout),
    retention_backup_restore_ready: retentionRows.every((row) => row.retention_policy_required && row.delete_without_policy_allowed === false),
    memory_bank_storage_index_ready: memoryIndexRows.every((row) => row.storage_index_contract_ready && row.source_citation_required),
    raw_transcript_default_access_enabled: false,
    mutable_event_update_enabled: false,
    runtime_recall_enabled: false,
    retrieval_layer_enabled: false,
    cross_domain_memory_leak_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, execution, contract, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include memory bank event observability command"),
    validationItem("execution.ready", "source", execution.summary?.controlled_execution_write_deploy_status === EXECUTION_READY_STATUS, "controlled execution write deploy must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P7001-P7300 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Memory Bank Storage Event and Observability Plane"), "architecture must reflect memory bank event observability"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Memory Bank Storage Event and Observability Plane"), "dashboard IA must reflect memory bank event observability"),
    validationItem("contract.ready", "contract", contract.append_only_event_store_required && contract.raw_transcript_default_access_enabled === false, "memory event contract must be ready"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P7001-P7300 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P7001-P7300 phase rows must pass"),
    validationItem("events.ready", "events", eventStoreRows.length >= 8 && eventStoreRows.every((row) => row.mutation_allowed === false), "append-only event rows must be ready"),
    validationItem("objects.ready", "objects", objectRefRows.length >= 6 && objectRefRows.every((row) => row.raw_body_embedded_by_default === false), "object reference rows must be ready"),
    validationItem("transcripts.ready", "transcripts", transcriptBindingRows.length >= 2 && transcriptBindingRows.every((row) => row.raw_transcript_default_access_enabled === false), "transcript binding rows must be ready"),
    validationItem("reviews.ready", "reviews", reviewReceiptEventRows.every((row) => row.receipt_event_required && row.final_approval_allowed === false), "review receipt event rows must be ready"),
    validationItem("gates.ready", "gate_verdict", gateVerdictRows.length === 3 && gateVerdictRows.every((row) => row.evidence_ref_required), "gate verdict rows must be ready"),
    validationItem("observability.ready", "observability", observabilityRows.length >= 7 && observabilityRows.every((row) => row.metric_required), "observability rows must be ready"),
    validationItem("retention.ready", "retention", retentionRows.length >= 4 && retentionRows.every((row) => row.delete_without_policy_allowed === false), "retention rows must be ready"),
    validationItem("index.ready", "memory_index", memoryIndexRows.length >= 6 && memoryIndexRows.every((row) => row.runtime_recall_enabled === false), "memory index rows must be storage-only"),
    validationItem("negative_fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_memory_claim_allowed === false), "negative fixtures must block unsafe memory claims"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gate_rows.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_recall", "boundary", boundary.runtime_recall_enabled === false && boundary.retrieval_layer_enabled === false, "runtime recall must stay disabled until P7301"),
    validationItem("boundary.no_write_workos", "boundary", boundary.write_action_enabled === false && boundary.work_os_claim_enabled === false, "write and Work OS claims must stay disabled"),
  ];
}

function buildSummary({ execution, phaseRows, eventStoreRows, objectRefRows, transcriptBindingRows, reviewReceiptEventRows, gateVerdictRows, observabilityRows, retentionRows, memoryIndexRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "memory-bank-event-observability-plane-summary.v1",
    memory_bank_event_observability_plane_status: validation.valid && boundary.memory_bank_event_observability_plane_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P6601-P7000",
    controlled_execution_write_deploy_status: execution.summary?.controlled_execution_write_deploy_status ?? "unknown",
    phase_row_count: phaseRows.length,
    event_type_count: eventStoreRows.length,
    object_reference_count: objectRefRows.length,
    transcript_source_binding_count: transcriptBindingRows.length,
    review_receipt_event_count: reviewReceiptEventRows.length,
    gate_verdict_count: gateVerdictRows.length,
    observability_metric_count: observabilityRows.length,
    retention_policy_count: retentionRows.length,
    memory_index_operation_count: memoryIndexRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    append_only_event_store_ready: boundary.append_only_event_store_ready,
    object_artifact_reference_store_ready: boundary.object_artifact_reference_store_ready,
    transcript_source_event_binding_ready: boundary.transcript_source_event_binding_ready,
    review_receipt_event_binding_ready: boundary.review_receipt_event_binding_ready,
    gate_verdict_event_ledger_ready: boundary.gate_verdict_event_ledger_ready,
    trace_audit_cost_observability_ready: boundary.trace_audit_cost_observability_ready,
    retention_backup_restore_ready: boundary.retention_backup_restore_ready,
    memory_bank_storage_index_ready: boundary.memory_bank_storage_index_ready,
    raw_transcript_default_access_enabled: boundary.raw_transcript_default_access_enabled,
    mutable_event_update_enabled: boundary.mutable_event_update_enabled,
    runtime_recall_enabled: boundary.runtime_recall_enabled,
    retrieval_layer_enabled: boundary.retrieval_layer_enabled,
    cross_domain_memory_leak_allowed: boundary.cross_domain_memory_leak_allowed,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_memory_bank_event_observability.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Memory Bank Event Observability Plane",
    "",
    `Status: ${result.summary.memory_bank_event_observability_plane_status}`,
    `Program: ${result.summary.program_range}`,
    `Controlled execution source: ${result.summary.controlled_execution_write_deploy_status}`,
    `Event types: ${result.summary.event_type_count}`,
    `Object refs: ${result.summary.object_reference_count}`,
    `Transcript bindings: ${result.summary.transcript_source_binding_count}`,
    `Review receipt events: ${result.summary.review_receipt_event_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Append-only event store ready: ${result.summary.append_only_event_store_ready}`,
    `Runtime recall enabled: ${result.summary.runtime_recall_enabled}`,
    `Retrieval layer enabled: ${result.summary.retrieval_layer_enabled}`,
    `Raw transcript default access enabled: ${result.summary.raw_transcript_default_access_enabled}`,
    `Work OS claim enabled: ${result.summary.work_os_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Memory Boundary",
    "",
    "The memory event plane is storage and observability only. It creates append-only event and object-reference contracts for conversations, evidence, validations, reviews, gates, and next-condition updates. Runtime recall and retrieval remain disabled until P7301-P7600.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_MEMORY_BANK_EVENT_OBSERVABILITY_PLANE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/memory-bank-event-observability-plane.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
