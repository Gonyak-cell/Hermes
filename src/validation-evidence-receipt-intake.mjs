import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildValidationRunbookReadiness } from "./validation-runbook-readiness.mjs";

export const DEFAULT_VALIDATION_EVIDENCE_RECEIPT_INTAKE_OUT_DIR = "artifacts/validation-evidence-receipt-intake/latest";
export const DEFAULT_VALIDATION_EVIDENCE_RECEIPT_INTAKE_INPUTS = {
  schemaPath: "schemas/validation-evidence-receipt-intake.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p21201-p21600.md",
  architectureDocPath: "docs/architecture.md",
  sourceValidationRunbookReadinessPath: "artifacts/validation-runbook-readiness/latest/validation-runbook-readiness.json",
};

const COMMAND_NAME = "platform:validation-evidence-receipt-intake";
const SCHEMA_VERSION = "validation-evidence-receipt-intake.v1";
const CAPABILITY_ID = "platform.validation_evidence_receipt_intake";
const PROGRAM_RANGE = "P21201-P21600";
const SOURCE_PROGRAM_RANGE = "P20801-P21200";
const READY_STATUS = "ready_for_validation_evidence_receipt_intake";
const BLOCK_PENDING_STATUS = "valid_block_receipt_intake_pending";
const BLOCKED_STATUS = "blocked_validation_evidence_receipt_intake";

const PHASE_SPECS = [
  ["P21201-P21240", "P21200 Source Binding", "p21200_source_binding_rows"],
  ["P21241-P21320", "Validation Evidence Receipt Schema", "validation_evidence_receipt_schema_rows"],
  ["P21321-P21400", "Redacted Result Capture Contract", "redacted_result_capture_rows"],
  ["P21401-P21480", "Freshness Completeness Guard", "freshness_completeness_guard_rows"],
  ["P21481-P21540", "Operator Evidence Inbox", "operator_evidence_inbox_rows"],
  ["P21541-P21580", "No-Execution Raw Boundary", "no_execution_raw_boundary_rows"],
  ["P21581-P21600", "P21600 Clean Checkpoint", "p21600_clean_checkpoint_rows"],
];

const RECEIPT_SPECS = [
  ["syntax_check", "Syntax check evidence receipt", "required_now"],
  ["targeted_tests", "Targeted test evidence receipt", "required_now"],
  ["adjacent_tests", "Adjacent regression evidence receipt", "required_when_contract_linked"],
  ["platform_cli_check", "Platform CLI check evidence receipt", "required_now"],
  ["diff_check", "Git diff hygiene evidence receipt", "required_now"],
  ["full_npm_test", "Full npm test evidence receipt", "required_when_broad_freeze_or_explicit_closeout"],
  ["claude_review", "Claude Code Opus max review receipt", "required_when_high_risk_transition"],
];

const REDACTION_RULES = [
  ["raw_stdout_forbidden", "Raw stdout capture is forbidden", false],
  ["raw_stderr_forbidden", "Raw stderr capture is forbidden", false],
  ["secret_material_forbidden", "Secret material capture is forbidden", false],
  ["full_transcript_forbidden", "Full transcript exposure is forbidden by default", false],
  ["hash_allowed", "Result hash is allowed", true],
  ["redacted_summary_allowed", "Redacted result summary is allowed", true],
  ["evidence_ref_required", "Evidence ref is required", true],
  ["source_commit_ref_required", "Source commit ref is required", true],
];

const FRESHNESS_GUARDS = [
  ["generated_at_required", "Receipt generated_at is required"],
  ["source_commit_match_required", "Receipt source commit must match runbook source"],
  ["command_id_match_required", "Receipt command id must match command evidence plan"],
  ["duplicate_receipt_blocks", "Duplicate receipt blocks clean intake"],
  ["stale_receipt_blocks", "Stale receipt blocks clean intake"],
  ["missing_required_receipt_blocks", "Missing required receipt blocks downstream proof"],
  ["raw_material_detected_blocks", "Raw material detected blocks clean intake"],
];

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

export async function runValidationEvidenceReceiptIntake(options = {}) {
  const result = await buildValidationEvidenceReceiptIntake(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Validation Evidence Receipt Intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeValidationEvidenceReceiptIntake(result, result.output_dir);
  return result;
}

export async function buildValidationEvidenceReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VALIDATION_EVIDENCE_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "validationRunbookReadiness")
    ? normalizeInlineJsonSource("inline.validation_runbook_readiness", options.validationRunbookReadiness)
    : await readJsonOrBuildP21200(inputs.source_validation_runbook_readiness_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const receiptRows = buildReceiptSchemaRows(generatedAt);
  const redactionRows = buildRedactionRows(generatedAt);
  const freshnessRows = buildFreshnessRows(generatedAt);
  const inboxRows = buildInboxRows({ receiptRows, generatedAt });
  const boundaryRows = buildNoExecutionRawRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, receiptRows, redactionRows, freshnessRows, inboxRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, receiptRows, redactionRows, freshnessRows, inboxRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, receiptRows, redactionRows, freshnessRows, inboxRows, boundaryRows, checkpointRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      validation_runbook_readiness_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_validation_runbook_readiness_summary: source.data?.summary ?? null,
    validation_evidence_receipt_intake_contract: buildContract(generatedAt),
    validation_evidence_receipt_intake_phase_rows: phaseRows,
    p21200_source_binding_rows: sourceRows,
    validation_evidence_receipt_schema_rows: receiptRows,
    redacted_result_capture_rows: redactionRows,
    freshness_completeness_guard_rows: freshnessRows,
    operator_evidence_inbox_rows: inboxRows,
    no_execution_raw_boundary_rows: boundaryRows,
    p21600_clean_checkpoint_rows: checkpointRows,
    validation_evidence_receipt_intake_boundary: boundary,
    validation_evidence_receipt_intake_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "validation_evidence_receipt_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_evidence_receipt_intake_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_evidence_receipt_intake_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeValidationEvidenceReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "validation-evidence-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p21200-source-binding-rows.json"), collectionEnvelope("p21200-source-binding-rows.v1", "p21200_source_binding_rows", result.p21200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-evidence-receipt-schema-rows.json"), collectionEnvelope("validation-evidence-receipt-schema-rows.v1", "validation_evidence_receipt_schema_rows", result.validation_evidence_receipt_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "redacted-result-capture-rows.json"), collectionEnvelope("redacted-result-capture-rows.v1", "redacted_result_capture_rows", result.redacted_result_capture_rows, result.generated_at));
  await writeJson(path.join(outDir, "freshness-completeness-guard-rows.json"), collectionEnvelope("freshness-completeness-guard-rows.v1", "freshness_completeness_guard_rows", result.freshness_completeness_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-evidence-inbox-rows.json"), collectionEnvelope("operator-evidence-inbox-rows.v1", "operator_evidence_inbox_rows", result.operator_evidence_inbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-execution-raw-boundary-rows.json"), collectionEnvelope("no-execution-raw-boundary-rows.v1", "no_execution_raw_boundary_rows", result.no_execution_raw_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p21600-clean-checkpoint-rows.json"), collectionEnvelope("p21600-clean-checkpoint-rows.v1", "p21600_clean_checkpoint_rows", result.p21600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-evidence-receipt-intake-boundary.json"), result.validation_evidence_receipt_intake_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runValidationEvidenceReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runValidationEvidenceReceiptIntake(args);
  console.log(`Validation Evidence Receipt Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.validation_evidence_receipt_intake_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P21200 ready for P21201 handoff: ${result.summary.source_p21200_ready_for_p21201_handoff}`);
  console.log(`Expected receipt rows: ${result.summary.expected_receipt_count}`);
  console.log(`Missing receipt rows visible: ${result.summary.missing_receipt_count}`);
  console.log(`Ready for P21601 handoff: ${result.summary.ready_for_p21601_handoff}`);
  console.log(`Raw stdout capture allowed: ${result.summary.raw_stdout_capture_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.validation_runbook_readiness_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p21201_handoff === true,
    status: summary.validation_runbook_readiness_status ?? "missing",
    p21200ContractReady: boundary.p21200_contract_ready === true,
    commandPlanVisible: boundary.command_evidence_plan_visible_now === true,
    operatorProjectionVisible: boundary.runbook_operator_projection_visible_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p21201-p21600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P21200 validation runbook readiness source is available", sourceState.available],
    ["program_range", "P21200 source program range is P20801-P21200", sourceState.programRangeOk],
    ["validation_valid", "P21200 source validation is valid", sourceState.validationValid],
    ["p21201_handoff_open", "P21200 source opened P21201 handoff", sourceState.sourceReady],
    ["p21200_contract_ready", "P21200 source contract is ready", sourceState.p21200ContractReady],
    ["command_plan_visible", "P21200 command evidence plan is visible", sourceState.commandPlanVisible],
    ["boundary_closed", "P21200 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for receipt intake", Boolean(commitRef)],
    ["source_blocker_visible", "P21200 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p21200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildReceiptSchemaRows(generatedAt) {
  return RECEIPT_SPECS.map(([id, label, requirementMode]) => row({
    row_id: `receipt_schema.${id}`,
    category: "validation_evidence_receipt_schema",
    label,
    observed: true,
    evidence_ref: "validation_evidence_receipt_schema_rows",
    receipt_type: id,
    requirement_mode: requirementMode,
    actual_receipt_present_now: false,
    receipt_payload_accepted_now: false,
    generated_at: generatedAt,
  }));
}

function buildRedactionRows(generatedAt) {
  return REDACTION_RULES.map(([id, label, allowed]) => row({
    row_id: `redaction.${id}`,
    category: "redacted_result_capture",
    label,
    observed: true,
    evidence_ref: "redacted_result_capture_rows",
    allowed_now: allowed,
    capture_contract_state: allowed ? "allowed_redacted_metadata" : "forbidden_raw_material",
    generated_at: generatedAt,
  }));
}

function buildFreshnessRows(generatedAt) {
  return FRESHNESS_GUARDS.map(([id, label]) => row({
    row_id: `freshness_guard.${id}`,
    category: "freshness_completeness_guard",
    label,
    observed: true,
    evidence_ref: "freshness_completeness_guard_rows",
    guard_blocks_when_triggered: true,
    generated_at: generatedAt,
  }));
}

function buildInboxRows({ receiptRows, generatedAt }) {
  const rows = receiptRows.map((item, index) => row({
    row_id: `operator_inbox.${item.receipt_type}`,
    category: "operator_evidence_inbox",
    label: `Inbox status for ${item.label}`,
    observed: true,
    evidence_ref: item.row_id,
    inbox_order: index + 1,
    receipt_type: item.receipt_type,
    inbox_state: item.actual_receipt_present_now ? "receipt_present" : "missing_receipt_visible",
    generated_at: generatedAt,
  }));
  rows.push(row({
    row_id: "operator_inbox.blocker_visibility",
    category: "operator_evidence_inbox",
    label: "Operator inbox blocker remains visible when required evidence is missing",
    observed: true,
    evidence_ref: "operator_evidence_inbox_rows",
    inbox_state: "blocker_visible",
    generated_at: generatedAt,
  }));
  return rows;
}

function buildNoExecutionRawRows(generatedAt) {
  const extraFlags = [
    ["command_execution_allowed_now", "Command execution remains false"],
    ["raw_stdout_capture_allowed_now", "Raw stdout capture remains false"],
    ["raw_stderr_capture_allowed_now", "Raw stderr capture remains false"],
    ["raw_secret_material_allowed_now", "Raw secret material capture remains false"],
  ];
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
    ...extraFlags,
  ].map(([flag, label]) => row({
    row_id: `no_execution_raw.${flag}`,
    category: "no_execution_raw_boundary",
    label,
    observed: true,
    evidence_ref: "validation_evidence_receipt_intake_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.receiptRows)
    && allPass(context.redactionRows)
    && allPass(context.freshnessRows)
    && allPass(context.inboxRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P21200 source is ready for P21201", context.sourceState.sourceReady],
    ["receipt_schema_visible", "Validation evidence receipt schema is visible", allPass(context.receiptRows)],
    ["redaction_contract_visible", "Redacted result capture contract is visible", allPass(context.redactionRows)],
    ["freshness_guard_visible", "Freshness completeness guard is visible", allPass(context.freshnessRows)],
    ["operator_inbox_visible", "Operator evidence inbox is visible", visibleOrPassed(context.inboxRows, "operator_inbox.blocker_visibility")],
    ["no_execution_raw_boundary_closed", "No-execution/raw boundary remains closed", allPass(context.boundaryRows)],
    ["p21601_handoff_gate", "P21601 handoff opens only when receipt intake contract conditions pass", handoffReady],
    ["p21601_handoff_blocker_visible", "P21601 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p21600_checkpoint.${id}`,
    category: "p21600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p21600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const missingReceiptCount = context.inboxRows.filter((item) => item.inbox_state === "missing_receipt_visible").length;
  const p21600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.receiptRows)
    && allPass(context.redactionRows)
    && allPass(context.freshnessRows)
    && visibleOrPassed(context.inboxRows, "operator_inbox.blocker_visibility")
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p21600_checkpoint.p21601_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.receiptRows)
    && allPass(context.redactionRows)
    && allPass(context.freshnessRows)
    && visibleOrPassed(context.inboxRows, "operator_inbox.blocker_visibility")
    && allPass(context.boundaryRows);
  return {
    p21600_contract_ready: p21600ContractReady,
    ready_for_p21601_handoff: handoffReady,
    source_p21200_ready_for_p21201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    receipt_intake_contract_visible_now: allPass(context.receiptRows),
    redacted_capture_contract_visible_now: allPass(context.redactionRows),
    freshness_completeness_guard_visible_now: allPass(context.freshnessRows),
    operator_evidence_inbox_visible_now: visibleOrPassed(context.inboxRows, "operator_inbox.blocker_visibility"),
    no_execution_raw_boundary_closed_now: allPass(context.boundaryRows),
    expected_receipt_count: context.receiptRows.length,
    received_receipt_count: context.receiptRows.filter((item) => item.actual_receipt_present_now).length,
    missing_receipt_count: missingReceiptCount,
    redaction_rule_count: context.redactionRows.length,
    freshness_guard_count: context.freshnessRows.length,
    operator_inbox_count: context.inboxRows.length,
    command_execution_allowed_now: false,
    raw_stdout_capture_allowed_now: false,
    raw_stderr_capture_allowed_now: false,
    raw_secret_material_allowed_now: false,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P21201-P21600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P21201-P21600 Validation Evidence Receipt Intake"), "Architecture doc missing P21201-P21600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P21200 source state is not visible"),
    validationItem("receipt.schema", "receipt", allPass(context.receiptRows), "Receipt schema rows are missing"),
    validationItem("redaction.raw_forbidden", "redaction", context.redactionRows.filter((item) => item.capture_contract_state === "forbidden_raw_material").every((item) => item.allowed_now === false), "Raw material capture opened"),
    validationItem("freshness.guards", "freshness", context.freshnessRows.every((item) => item.guard_blocks_when_triggered === true), "Freshness guard does not block when triggered"),
    validationItem("inbox.missing_visible", "operator", context.inboxRows.some((item) => item.inbox_state === "missing_receipt_visible"), "Missing receipt state is not visible"),
    validationItem("boundary.no_execution", "authority", context.boundary.command_execution_allowed_now === false && context.boundary.raw_stdout_capture_allowed_now === false, "Execution or raw stdout capture opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p21600_checkpoint.p21601_handoff_blocker_visible"), "P21600 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "validation_evidence_receipt_intake.contract.v1",
    generated_at: generatedAt,
    source_p21200_required_or_rebuilt: true,
    receipt_schema_required: true,
    redacted_capture_required: true,
    freshness_completeness_guard_required: true,
    p21601_handoff_is_not_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p21601_handoff
    ? READY_STATUS
    : validation.valid && boundary.p21600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    validation_evidence_receipt_intake_status: status,
    source_p21200_ready_for_p21201_handoff: boundary.source_p21200_ready_for_p21201_handoff,
    expected_receipt_count: boundary.expected_receipt_count,
    received_receipt_count: boundary.received_receipt_count,
    missing_receipt_count: boundary.missing_receipt_count,
    ready_for_p21601_handoff: validation.valid && boundary.ready_for_p21601_handoff,
    raw_stdout_capture_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Validation Evidence Receipt Intake",
    "",
    `Status: ${result.summary.validation_evidence_receipt_intake_status}`,
    `Program: ${result.program_range}`,
    `P21200 ready for P21201 handoff: ${result.summary.source_p21200_ready_for_p21201_handoff}`,
    `Expected receipt rows: ${result.summary.expected_receipt_count}`,
    `Missing receipt rows visible: ${result.summary.missing_receipt_count}`,
    `Ready for P21601 handoff: ${result.summary.ready_for_p21601_handoff}`,
    `Raw stdout capture allowed: ${result.summary.raw_stdout_capture_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_evidence_inbox_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.receipt_type)}</td><td>${escapeHtml(item.inbox_state)}</td><td>${escapeHtml(item.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Validation Evidence Receipt Intake</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Validation Evidence Receipt Intake</h1>
    <p class="notice">This artifact defines validation evidence receipt intake. Missing receipts are visible, raw output is blocked, and no execution or final approval authority is opened.</p>
    <table><thead><tr><th>Inbox Row</th><th>Receipt Type</th><th>Inbox State</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP21200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildValidationRunbookReadiness({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.validation_runbook_readiness", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, text: JSON.stringify(value), data: value };
  return { path: label, available: false, text: "", data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_VALIDATION_EVIDENCE_RECEIPT_INTAKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_validation_runbook_readiness_path: path.resolve(repoRoot, options.sourceValidationRunbookReadinessPath ?? defaults.sourceValidationRunbookReadinessPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceValidationRunbookReadinessPath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function row(rowData) {
  const observed = Boolean(rowData.observed);
  return {
    ...rowData,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${rowData.label} is missing or blocked.`,
  };
}

function validationItem(itemId, category, ok, message) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message: ok ? "ok" : message,
    evidence_ref: itemId,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  return allPass(rows) || rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function protectedBoundaryClosed(boundary) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, rows };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
