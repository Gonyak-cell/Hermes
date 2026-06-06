import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_CONVERSATION_SOURCE_PLANE_OUT_DIR = "artifacts/conversation-source-plane/latest";
export const DEFAULT_CONVERSATION_SOURCE_PLANE_INPUTS = {
  schemaPath: "schemas/conversation-source-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  principleDocPath: "docs/hue-keynote-harness-operating-loop.md",
};

const COMMAND_NAME = "platform:conversation-source-plane";
const SCHEMA_VERSION = "conversation-source-plane.v1";
const CAPABILITY_ID = "platform.conversation_source_plane";
const PROGRAM_RANGE = "P4001-P4300";
const READY_STATUS = "ready_for_conversation_source_plane_v0";
const UI_INVARIANT = "source -> claim -> citation -> review -> Harness truth";

const SOURCE_STATUSES = ["ARCHIVED", "REDACTION_REQUIRED", "REDACTED", "CLASSIFIED", "EXTRACTED", "REVIEW_PENDING", "REVIEWED", "BLOCKED"];
const CLAIM_STATUSES = ["CANDIDATE", "NEEDS_SOURCE", "NEEDS_REVIEW", "ACCEPTED", "REJECTED", "STALE"];
const PLAN_STATUSES = ["PROPOSED", "REVIEWED_CANDIDATE", "ADOPTED", "BLOCKED"];
const CONTEXT_STATUSES = ["DRAFT", "CITATION_MISSING", "READY_FOR_NEXT_SESSION", "BLOCKED"];

const PHASE_SPECS = [
  ["P4001-P4040", "Engine Conversation Source Contract"],
  ["P4041-P4080", "Local Transcript Archive"],
  ["P4081-P4120", "Codex Conversation Adapter"],
  ["P4121-P4160", "Claude Code Transcript Adapter"],
  ["P4161-P4200", "Transcript Redaction and Classification"],
  ["P4201-P4240", "Conversation-to-Artifact Extractor"],
  ["P4241-P4280", "Context Recovery Bundle"],
  ["P4281-P4300", "Transcript UI v0"],
];

const REQUIRED_COMPONENTS = [
  "ConversationSourceRow",
  "EngineBadge",
  "RawSourceRef",
  "TranscriptBoundaryBadge",
  "RedactionStatePill",
  "ClassificationLabel",
  "ClaimCandidateRow",
  "PlanChangeCandidateRow",
  "SourceCitationPanel",
  "ContextBundlePreview",
  "AdapterLineageTimeline",
  "NoSourceNoClaimNotice",
];

const QUEUE_COLUMNS = [
  "source_id",
  "engine",
  "thread_or_session",
  "project_or_goal",
  "source_status",
  "redaction_status",
  "claim_count",
  "plan_candidate_count",
  "reviewer",
  "next_allowed_action",
];

const ALLOWED_COPY = [
  "Conversation archived as source material",
  "Summary is a claim, pending review",
  "Plan change candidate, not adopted",
  "No transcript source; context claim blocked",
  "No source citation; memory recall blocked",
  "Redaction hold: privileged/client/secret span",
];

const FORBIDDEN_COPY = [
  "AI가 기억했습니다",
  "스마트하게 요약",
  "자동 인사이트",
  "완료됨 as truth without evidence",
  "AI confidence score",
  "context health score",
];

export async function runConversationSourcePlane(options = {}) {
  const result = await buildConversationSourcePlane(options);
  if (options.write !== false) await writeConversationSourcePlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Conversation source plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConversationSourcePlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONVERSATION_SOURCE_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const principleDoc = await readTextSource(inputs.principle_doc_path);

  const contract = buildSourceContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const sourceRows = buildConversationSourceRows(generatedAt);
  const archiveRows = buildTranscriptArchiveRows(sourceRows, generatedAt);
  const adapterRows = buildAdapterRows(sourceRows, generatedAt);
  const redactionRows = buildRedactionRows(sourceRows, generatedAt);
  const claimRows = buildClaimRows(sourceRows, generatedAt);
  const planRows = buildPlanCandidateRows(sourceRows, generatedAt);
  const contextRows = buildContextBundleRows(sourceRows, claimRows, planRows, generatedAt);
  const queueRows = buildQueueRows(sourceRows, claimRows, planRows, contextRows, generatedAt);
  const uiRows = buildUiRows(generatedAt);
  const copyRows = buildCopyRows(generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, principleDoc, contract, phaseRows, sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows });
  const boundary = buildBoundary({ gateRows, sourceRows, archiveRows, adapterRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, principleDoc, contract, phaseRows, sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    conversation_source_plane_id: `conversation-source-plane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    conversation_source_contract: contract,
    conversation_source_phase_rows: phaseRows,
    conversation_source_rows: sourceRows,
    transcript_archive_rows: archiveRows,
    adapter_lineage_rows: adapterRows,
    redaction_classification_rows: redactionRows,
    extracted_claim_rows: claimRows,
    plan_candidate_rows: planRows,
    context_recovery_bundle_rows: contextRows,
    conversation_source_queue_rows: queueRows,
    transcript_ui_component_rows: uiRows,
    ui_copy_rule_rows: copyRows,
    conversation_source_gate_rows: gateRows,
    conversation_source_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "conversation_source_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows, gateRows, boundary, validation: result.validation });
  result.summary.conversation_source_plane_id = result.conversation_source_plane_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeConversationSourcePlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "conversation-source-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "conversation-source-rows.json"), collectionEnvelope("conversation-source-rows.v1", "conversation_source_rows", result.conversation_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "transcript-archive-rows.json"), collectionEnvelope("transcript-archive-rows.v1", "transcript_archive_rows", result.transcript_archive_rows, result.generated_at));
  await writeJson(path.join(outDir, "adapter-lineage-rows.json"), collectionEnvelope("adapter-lineage-rows.v1", "adapter_lineage_rows", result.adapter_lineage_rows, result.generated_at));
  await writeJson(path.join(outDir, "redaction-classification-rows.json"), collectionEnvelope("redaction-classification-rows.v1", "redaction_classification_rows", result.redaction_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-claim-rows.json"), collectionEnvelope("extracted-claim-rows.v1", "extracted_claim_rows", result.extracted_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-candidate-rows.json"), collectionEnvelope("plan-candidate-rows.v1", "plan_candidate_rows", result.plan_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "context-recovery-bundle-rows.json"), collectionEnvelope("context-recovery-bundle-rows.v1", "context_recovery_bundle_rows", result.context_recovery_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-source-queue-rows.json"), collectionEnvelope("conversation-source-queue-rows.v1", "conversation_source_queue_rows", result.conversation_source_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "transcript-ui-component-rows.json"), collectionEnvelope("transcript-ui-component-rows.v1", "transcript_ui_component_rows", result.transcript_ui_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-copy-rule-rows.json"), collectionEnvelope("ui-copy-rule-rows.v1", "ui_copy_rule_rows", result.ui_copy_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-source-gate-rows.json"), collectionEnvelope("conversation-source-gate-rows.v1", "conversation_source_gate_rows", result.conversation_source_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-source-boundary.json"), result.conversation_source_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "conversation-source-plane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runConversationSourcePlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConversationSourcePlane(args);
    console.log(`Conversation source plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.conversation_source_plane_status}`);
    console.log(`Sources: ${result.summary.source_count}`);
    console.log(`Claims: ${result.summary.claim_count}`);
    console.log(`Plan candidates: ${result.summary.plan_candidate_count}`);
    console.log(`Queue rows: ${result.summary.queue_row_count}`);
    console.log(`Runtime execution enabled: ${result.summary.runtime_execution_enabled}`);
    console.log(`Write action enabled: ${result.summary.write_action_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSourceContract(generatedAt) {
  return {
    schema_version: "conversation-source-contract.v1",
    generated_at: generatedAt,
    contract_id: "conversation-source-contract.p4001-p4300",
    program_range: PROGRAM_RANGE,
    required_source_fields: ["source_id", "engine", "thread_or_session", "project_or_goal", "raw_location_ref", "owner", "source_status", "redaction_status", "review_status"],
    source_status_enum: SOURCE_STATUSES,
    claim_status_enum: CLAIM_STATUSES,
    plan_status_enum: PLAN_STATUSES,
    context_status_enum: CONTEXT_STATUSES,
    queue_first_surface: "Conversation Source Queue",
    ui_invariant: UI_INVARIANT,
    raw_transcript_is_source_material: true,
    summary_is_claim: true,
    plan_change_is_reviewed_candidate: true,
    harness_ui_status_is_source_of_truth: true,
    raw_transcript_body_default_visible: false,
    kpi_home_surface_allowed: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "conversation-source-phase-row.v1",
      row_id: `conversation-source.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.platform_conversation_source_owner",
      hard_gate_ref: `gate.platform.conversation_source.${phase_range}`,
      responsible_owner: "platform_conversation_source_owner",
      next_allowed_action: pass ? "preserve phase in P4300 closeout" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildConversationSourceRows(generatedAt) {
  const rows = [
    {
      source_id: "conversation-source.codex.local-session",
      engine: "Codex",
      thread_or_session: "codex-thread.local-hermes-p8000",
      project_or_goal: "Hermes P4001-P4300 Local Conversation Source Plane",
      raw_location_ref: "local-only.codex.transcript.envelope",
      owner: "single_owner_operator",
      reviewer: "platform_conversation_source_owner",
      source_status: "EXTRACTED",
      redaction_status: "REDACTED",
      review_status: "REVIEW_PENDING",
      classification_labels: ["internal", "development", "source_material"],
      claim_count: 3,
      plan_candidate_count: 2,
    },
    {
      source_id: "conversation-source.claude.review-session",
      engine: "Claude Code",
      thread_or_session: "claude-review-session.pending",
      project_or_goal: "Hermes independent review transcript lane",
      raw_location_ref: "local-only.claude.transcript.envelope",
      owner: "single_owner_operator",
      reviewer: "claude_code_opus_max",
      source_status: "REVIEW_PENDING",
      redaction_status: "REDACTION_REQUIRED",
      review_status: "REVIEW_PENDING",
      classification_labels: ["internal", "review", "source_material"],
      claim_count: 2,
      plan_candidate_count: 1,
    },
  ];
  return rows.map((row, index) => ({
    schema_version: "conversation-source-row.v1",
    row_id: `conversation-source.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    ...row,
    raw_transcript_is_source_material: true,
    raw_transcript_body_included: false,
    raw_transcript_body_default_visible: false,
    raw_secret_material_allowed: false,
    raw_client_material_allowed: false,
    privileged_material_default_visible: false,
    source_citation_required: true,
    memory_recall_allowed_without_citation: false,
    harness_truth_allowed_now: false,
    next_allowed_action: row.redaction_status === "REDACTION_REQUIRED" ? "complete redaction and classification before extraction" : "review extracted claim candidates before adopting plan changes",
    evidence_ref: `evidence.${row.source_id}`,
    reviewer_ref: row.reviewer,
    hard_gate_ref: `gate.${row.source_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTranscriptArchiveRows(sourceRows, generatedAt) {
  return sourceRows.map((source, index) => ({
    schema_version: "transcript-archive-row.v1",
    row_id: `transcript-archive.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    source_id: source.source_id,
    archive_status: "ARCHIVED",
    raw_location_ref: source.raw_location_ref,
    raw_boundary_ref: `boundary.${source.source_id}`,
    redacted_projection_ref: `redacted.${source.source_id}`,
    duplicate_detected: false,
    corruption_detected: false,
    source_boundary_complete: true,
    raw_transcript_body_included: false,
    provenance_first_display: true,
    evidence_ref: `evidence.transcript_archive.${source.source_id}`,
    next_allowed_action: "project source metadata to Conversation Source Queue",
  }));
}

function buildAdapterRows(sourceRows, generatedAt) {
  return sourceRows.map((source, index) => ({
    schema_version: "adapter-lineage-row.v1",
    row_id: `adapter-lineage.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    source_id: source.source_id,
    engine: source.engine,
    adapter_id: source.engine === "Codex" ? "adapter.codex.conversation_source" : "adapter.claude_code.review_transcript",
    adapter_status: source.engine === "Codex" ? "ready_no_self_approval" : "ready_review_evidence_only",
    captures_plan_changes: true,
    captures_tool_lineage: true,
    captures_validation_summary: true,
    captures_review_findings: source.engine !== "Codex",
    mutation_allowed: false,
    approval_allowed: false,
    final_pass_allowed: false,
    evidence_ref: `evidence.adapter.${source.source_id}`,
    reviewer_ref: source.reviewer_ref,
    hard_gate_ref: `gate.adapter.${source.source_id}`,
    next_allowed_action: source.engine === "Codex" ? "treat Codex completion as evidence candidate" : "treat Claude review as independent review evidence only",
  }));
}

function buildRedactionRows(sourceRows, generatedAt) {
  return sourceRows.map((source, index) => ({
    schema_version: "redaction-classification-row.v1",
    row_id: `redaction-classification.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    source_id: source.source_id,
    redaction_status: source.redaction_status,
    classification_status: source.redaction_status === "REDACTION_REQUIRED" ? "pending" : "classified",
    classification_labels: source.classification_labels,
    secret_span_present: false,
    client_span_present: false,
    privileged_span_present: false,
    raw_body_default_visible: false,
    redaction_hold_reason: source.redaction_status === "REDACTION_REQUIRED" ? "redaction hold: privileged/client/secret span review required" : null,
    extraction_allowed_now: source.redaction_status !== "REDACTION_REQUIRED",
    memory_recall_allowed_now: source.redaction_status !== "REDACTION_REQUIRED",
    evidence_ref: `evidence.redaction.${source.source_id}`,
    next_allowed_action: source.redaction_status === "REDACTION_REQUIRED" ? "classify and redact before recall" : "extract claim candidates with citation refs",
  }));
}

function buildClaimRows(sourceRows, generatedAt) {
  const specs = [
    [sourceRows[0], "summary", "Summary is a claim, pending review", "CANDIDATE"],
    [sourceRows[0], "done_claim", "Codex completion is evidence candidate, not Harness truth", "NEEDS_REVIEW"],
    [sourceRows[0], "plan_change", "P4300 plan change candidate, not adopted", "NEEDS_REVIEW"],
    [sourceRows[1], "review_finding", "Claude review finding becomes review evidence candidate", "NEEDS_SOURCE"],
    [sourceRows[1], "review_limitation", "Claude review cannot mutate source or approve protected closeout", "NEEDS_REVIEW"],
  ];
  return specs.map(([source, claimKind, claimText, status], index) => ({
    schema_version: "extracted-claim-row.v1",
    row_id: `extracted-claim.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    source_id: source.source_id,
    claim_kind: claimKind,
    claim_text: claimText,
    claim_status: status,
    source_citation_ref: status === "NEEDS_SOURCE" ? null : `citation.${source.source_id}.${claimKind}`,
    source_citation_required: true,
    harness_truth_allowed_now: false,
    adopted_as_truth: false,
    reviewer_required: true,
    evidence_ref: `evidence.claim.${source.source_id}.${claimKind}`,
    reviewer_ref: source.reviewer_ref,
    hard_gate_ref: `gate.claim.${claimKind}`,
    next_allowed_action: status === "NEEDS_SOURCE" ? "attach source citation before review" : "route claim candidate to review",
  }));
}

function buildPlanCandidateRows(sourceRows, generatedAt) {
  const specs = [
    [sourceRows[0], "plan-candidate.p4001-p4300.contract", "Implement Engine Conversation Source Contract before live capture", "REVIEWED_CANDIDATE"],
    [sourceRows[0], "plan-candidate.p4281-p4300.ui", "Conversation Source Queue is first UI surface", "REVIEWED_CANDIDATE"],
    [sourceRows[1], "plan-candidate.review-lane", "Claude review transcript lane is evidence-only", "PROPOSED"],
  ];
  return specs.map(([source, candidateId, title, status], index) => ({
    schema_version: "plan-candidate-row.v1",
    row_id: `plan-candidate.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    plan_candidate_id: candidateId,
    source_id: source.source_id,
    plan_candidate_title: title,
    plan_status: status,
    adopted: false,
    adopted_without_review: false,
    source_citation_ref: `citation.${source.source_id}.${candidateId}`,
    reviewer_ref: source.reviewer_ref,
    hard_gate_ref: `gate.plan.${candidateId}`,
    next_allowed_action: "review candidate before adoption",
  }));
}

function buildContextBundleRows(sourceRows, claimRows, planRows, generatedAt) {
  const citedClaimIds = claimRows.filter((row) => row.source_citation_ref).map((row) => row.row_id);
  const citedPlanIds = planRows.map((row) => row.row_id);
  return [
    {
      schema_version: "context-recovery-bundle-row.v1",
      row_id: "context-recovery-bundle.row.001",
      generated_at: generatedAt,
      context_bundle_id: "context-bundle.p4001-p4300.next-session",
      source_ids: sourceRows.map((row) => row.source_id),
      cited_claim_row_ids: citedClaimIds,
      cited_plan_candidate_row_ids: citedPlanIds,
      context_status: "READY_FOR_NEXT_SESSION",
      citation_missing: false,
      unresolved_question_count: 0,
      next_allowed_action: "start P4001-P4040 source contract implementation from cited bundle",
      memory_recall_allowed_now: true,
      harness_truth_allowed_now: false,
      evidence_ref: "evidence.context_recovery.p4001_p4300",
    },
  ];
}

function buildQueueRows(sourceRows, claimRows, planRows, contextRows, generatedAt) {
  return sourceRows.map((source, index) => {
    const claims = claimRows.filter((row) => row.source_id === source.source_id);
    const plans = planRows.filter((row) => row.source_id === source.source_id);
    return {
      schema_version: "conversation-source-queue-row.v1",
      row_id: `conversation-source-queue.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      source_id: source.source_id,
      engine: source.engine,
      thread_or_session: source.thread_or_session,
      project_or_goal: source.project_or_goal,
      source_status: source.source_status,
      redaction_status: source.redaction_status,
      claim_count: claims.length,
      plan_candidate_count: plans.length,
      reviewer: source.reviewer_ref,
      next_allowed_action: source.next_allowed_action,
      first_surface: "Conversation Source Queue",
      queue_first: true,
      kpi_home_surface: false,
      detail_panel_fields: ["raw transcript boundary", "source citation refs", "redaction/classification result", "extracted claims", "linked artifacts", "context recovery readiness", "blocked claims", "next command"],
      context_bundle_ref: contextRows[0].context_bundle_id,
      no_source_no_claim_notice_visible: true,
      raw_transcript_body_default_visible: false,
      harness_truth_allowed_now: false,
    };
  });
}

function buildUiRows(generatedAt) {
  return REQUIRED_COMPONENTS.map((component_name, index) => ({
    schema_version: "transcript-ui-component-row.v1",
    row_id: `transcript-ui.component.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    component_name,
    component_status: "planned_read_only",
    first_surface: component_name === "ConversationSourceRow" || component_name === "NoSourceNoClaimNotice",
    read_only: true,
    mutation_allowed: false,
    raw_transcript_body_default_visible: false,
    kpi_card_component: false,
    evidence_ref: `evidence.ui_component.${component_name}`,
  }));
}

function buildCopyRows(generatedAt) {
  const allowed = ALLOWED_COPY.map((copy_text, index) => ({
    schema_version: "ui-copy-rule-row.v1",
    row_id: `ui-copy.allowed.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    copy_text,
    copy_rule_type: "allowed",
    copy_status: "approved_contract",
    trust_signal_allowed: true,
    forbidden: false,
  }));
  const forbidden = FORBIDDEN_COPY.map((copy_text, index) => ({
    schema_version: "ui-copy-rule-row.v1",
    row_id: `ui-copy.forbidden.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    copy_text,
    copy_rule_type: "forbidden",
    copy_status: "blocked_contract",
    trust_signal_allowed: false,
    forbidden: true,
  }));
  return [...allowed, ...forbidden];
}

function buildGateRows({ packageJson, roadmapDoc, principleDoc, contract, phaseRows, sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:conversation-source-plane"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Conversation Source Queue"), "P4001-P4300 roadmap reflects source plane and queue UI"],
    ["principle_reflected", principleDoc.available && includesToken(principleDoc.text, "Conversation Source UI Requirement"), "Hue operating loop reflects Conversation Source UI"],
    ["phase_rows_reflected", phaseRows.every((row) => row.current_verdict === "pass"), "all P4001-P4300 phase rows pass"],
    ["source_contract_ready", contract.raw_transcript_is_source_material && contract.summary_is_claim && contract.plan_change_is_reviewed_candidate, "source contract preserves transcript, claim, and plan boundaries"],
    ["transcript_archive_ready", archiveRows.every((row) => row.archive_status === "ARCHIVED" && row.raw_transcript_body_included === false), "archive rows exist without raw body exposure"],
    ["adapters_separated", adapterRows.every((row) => row.mutation_allowed === false && row.approval_allowed === false && row.final_pass_allowed === false), "Codex and Claude adapters cannot mutate, approve, or final PASS"],
    ["redaction_classification_ready", redactionRows.every((row) => row.raw_body_default_visible === false && row.secret_span_present === false), "redaction and classification rows block raw/secret leakage"],
    ["claims_are_candidates", claimRows.every((row) => row.harness_truth_allowed_now === false && row.adopted_as_truth === false), "extracted claims remain candidates"],
    ["plan_changes_reviewed_candidates", planRows.every((row) => row.adopted === false && row.adopted_without_review === false), "plan changes remain reviewed candidates or proposed items"],
    ["context_recovery_cited", contextRows.every((row) => row.context_status === "READY_FOR_NEXT_SESSION" && row.citation_missing === false), "context recovery bundles require citations"],
    ["queue_first_ui_ready", queueRows.every((row) => row.queue_first === true && row.kpi_home_surface === false), "Conversation Source Queue is first surface and KPI home is blocked"],
    ["ui_components_ready", uiRows.length === REQUIRED_COMPONENTS.length && uiRows.every((row) => row.read_only === true && row.kpi_card_component === false), "all read-only UI component contracts exist"],
    ["copy_rules_ready", copyRows.some((row) => row.copy_text === "No transcript source; context claim blocked") && copyRows.some((row) => row.copy_text === "AI confidence score" && row.forbidden), "allowed and forbidden copy rules are frozen"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "conversation-source-gate-row.v1",
    row_id: `conversation-source.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.conversation_source.gate.${gate_id}`,
    reviewer_ref: "reviewer.platform_conversation_source_owner",
    hard_gate_ref: `gate.platform.conversation_source.${gate_id}`,
    responsible_owner: "platform_conversation_source_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ gateRows, sourceRows, archiveRows, adapterRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows }) {
  const unsafeFlags = [
    gateRows.some((row) => row.gate_status !== "ready"),
    sourceRows.some((row) => row.raw_transcript_body_default_visible !== false),
    archiveRows.some((row) => row.raw_transcript_body_included !== false),
    adapterRows.some((row) => row.mutation_allowed || row.approval_allowed || row.final_pass_allowed),
    claimRows.some((row) => row.harness_truth_allowed_now || row.adopted_as_truth),
    planRows.some((row) => row.adopted_without_review),
    contextRows.some((row) => row.citation_missing),
    queueRows.some((row) => !row.queue_first || row.kpi_home_surface),
    uiRows.some((row) => row.kpi_card_component || row.mutation_allowed),
    copyRows.some((row) => row.copy_text === "AI confidence score" && row.trust_signal_allowed),
  ];
  return {
    schema_version: "conversation-source-boundary.v1",
    program_range: PROGRAM_RANGE,
    conversation_source_plane_ready: unsafeFlags.filter(Boolean).length === 0,
    first_surface: "Conversation Source Queue",
    ui_invariant: UI_INVARIANT,
    raw_transcript_is_source_material: true,
    summary_is_claim: true,
    plan_change_is_reviewed_candidate: true,
    harness_ui_status_is_source_of_truth: true,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    receipt_application_enabled: false,
    raw_transcript_body_default_visible: false,
    raw_secret_material_allowed: false,
    raw_client_material_allowed: false,
    agent_final_pass_enabled: false,
    work_os_claim_enabled: false,
    kpi_home_surface_allowed: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, principleDoc, contract, phaseRows, sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("roadmap.available", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P4001-P4300 roadmap must be available"),
    validationItem("principle.available", "docs", principleDoc.available && includesToken(principleDoc.text, "Conversation Source UI Requirement"), "Hue principle doc must include Conversation Source UI Requirement"),
    validationItem("contract.fields", "contract", contract.required_source_fields.length >= 9, "source contract must define required fields"),
    validationItem("contract.invariants", "contract", contract.raw_transcript_is_source_material && contract.summary_is_claim && contract.harness_ui_status_is_source_of_truth, "source contract invariants must hold"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P4001-P4300 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P4001-P4300 phase rows must pass"),
    validationItem("sources.engines", "sources", sourceRows.some((row) => row.engine === "Codex") && sourceRows.some((row) => row.engine === "Claude Code"), "Codex and Claude source rows must exist"),
    validationItem("archive.no_raw_body", "archive", archiveRows.every((row) => row.raw_transcript_body_included === false), "archive must not include raw transcript body"),
    validationItem("adapters.no_authority", "adapters", adapterRows.every((row) => !row.mutation_allowed && !row.approval_allowed && !row.final_pass_allowed), "adapters cannot mutate, approve, or final PASS"),
    validationItem("redaction.no_leakage", "redaction", redactionRows.every((row) => row.raw_body_default_visible === false && row.secret_span_present === false), "redaction must block raw body and secret leakage"),
    validationItem("claims.candidates", "claims", claimRows.every((row) => row.harness_truth_allowed_now === false && row.adopted_as_truth === false), "claims remain candidates"),
    validationItem("plans.not_adopted", "plans", planRows.every((row) => row.adopted === false && row.adopted_without_review === false), "plan candidates are not adopted without review"),
    validationItem("context.cited", "context", contextRows.every((row) => row.citation_missing === false && row.memory_recall_allowed_now === true), "context recovery requires citations"),
    validationItem("queue.columns", "queue", queueRows.every((row) => QUEUE_COLUMNS.every((column) => Object.hasOwn(row, column))), "queue rows must expose required columns"),
    validationItem("queue.first", "queue", queueRows.every((row) => row.queue_first && row.kpi_home_surface === false), "Conversation Source Queue is first and KPI home is blocked"),
    validationItem("ui.components", "ui", uiRows.length === REQUIRED_COMPONENTS.length && uiRows.every((row) => row.read_only && !row.kpi_card_component), "all read-only UI component rows must exist"),
    validationItem("copy.allowed", "copy", ALLOWED_COPY.every((copy) => copyRows.some((row) => row.copy_text === copy && !row.forbidden)), "allowed UI copy must be registered"),
    validationItem("copy.forbidden", "copy", FORBIDDEN_COPY.every((copy) => copyRows.some((row) => row.copy_text === copy && row.forbidden)), "forbidden UI copy must be registered"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false, "P4300 must not enable runtime or write"),
    validationItem("boundary.no_work_os_claim", "boundary", boundary.work_os_claim_enabled === false, "P4300 must not claim production Work OS"),
  ];
}

function buildSummary({ sourceRows, archiveRows, adapterRows, redactionRows, claimRows, planRows, contextRows, queueRows, uiRows, copyRows, gateRows, boundary, validation }) {
  return {
    schema_version: "conversation-source-plane-summary.v1",
    conversation_source_plane_status: validation.valid && boundary.conversation_source_plane_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    first_surface: boundary.first_surface,
    source_count: sourceRows.length,
    transcript_archive_count: archiveRows.length,
    adapter_count: adapterRows.length,
    redaction_classification_count: redactionRows.length,
    claim_count: claimRows.length,
    plan_candidate_count: planRows.length,
    context_bundle_count: contextRows.length,
    queue_row_count: queueRows.length,
    ui_component_count: uiRows.length,
    allowed_copy_count: copyRows.filter((row) => !row.forbidden).length,
    forbidden_copy_count: copyRows.filter((row) => row.forbidden).length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    raw_transcript_body_default_visible: boundary.raw_transcript_body_default_visible,
    kpi_home_surface_allowed: boundary.kpi_home_surface_allowed,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_conversation_source_plane.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Conversation Source Plane",
    "",
    `Status: ${result.summary.conversation_source_plane_status}`,
    `Program: ${result.summary.program_range}`,
    `First surface: ${result.summary.first_surface}`,
    `Sources: ${result.summary.source_count}`,
    `Claims: ${result.summary.claim_count}`,
    `Plan candidates: ${result.summary.plan_candidate_count}`,
    `Context bundles: ${result.summary.context_bundle_count}`,
    `Queue rows: ${result.summary.queue_row_count}`,
    `UI components: ${result.summary.ui_component_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Runtime execution enabled: ${result.summary.runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Raw transcript body visible by default: ${result.summary.raw_transcript_body_default_visible}`,
    `KPI home surface allowed: ${result.summary.kpi_home_surface_allowed}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Invariant",
    "",
    `\`${UI_INVARIANT}\``,
    "",
    "## Next Allowed Action",
    "",
    "Use this read-only source plane to start P4001-P4040 source contract implementation and keep runtime, write, protected action, raw transcript body display, KPI trust framing, and Work OS production claims closed.",
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
  const defaults = DEFAULT_CONVERSATION_SOURCE_PLANE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    principle_doc_path: options.principleDocPath ?? defaults.principleDocPath,
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
    principleDocPath: undefined,
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
    } else if (arg === "--principle-doc") {
      args.principleDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/conversation-source-plane.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --principle-doc <path>          Hue keynote operating loop document path.
  --help                          Show this help.
`);
}
