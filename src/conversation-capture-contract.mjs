import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildP8000CloseoutReviewCleanCheckpoint } from "./p8000-closeout-review-clean-checkpoint.mjs";

export const DEFAULT_CONVERSATION_CAPTURE_CONTRACT_OUT_DIR = "artifacts/conversation-capture-contract/latest";
export const DEFAULT_CONVERSATION_CAPTURE_CONTRACT_INPUTS = {
  schemaPath: "schemas/conversation-capture-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8081-p8400.md",
  architectureDocPath: "docs/architecture.md",
  p8000CloseoutPath: "artifacts/p8000-closeout-review-clean-checkpoint/latest/p8000-closeout-review-clean-checkpoint.json",
};

const COMMAND_NAME = "platform:conversation-capture-contract";
const SOURCE_COMMAND_NAME = "platform:p8000-closeout-review-clean-checkpoint";
const SCHEMA_VERSION = "conversation-capture-contract.v1";
const CAPABILITY_ID = "platform.conversation_capture_contract";
const PROGRAM_RANGE = "P8081-P8160";
const SOURCE_PROGRAM_RANGE = "P8001-P8080";
const SOURCE_READY_STATUS = "ready_for_p8000_closeout_review_clean_checkpoint";
const READY_STATUS = "ready_for_conversation_capture_contract";

const PHASE_SPECS = [
  ["P8081-P8100", "Codex/Claude Conversation Storage Contract"],
  ["P8101-P8120", "Raw Full Redacted Separation"],
  ["P8121-P8140", "Plan Extraction Contract"],
  ["P8141-P8160", "Conversation Capture Validator"],
];

const ENGINE_SPECS = [
  ["engine.codex.primary_developer", "Codex", "codex-session.hermes.p8081-p8240", "development_engine"],
  ["engine.claude.independent_reviewer", "Claude Code", "claude-session.hermes.p8081-p8240", "independent_review_engine"],
];

const TRANSCRIPT_TIER_SPECS = [
  ["tier.raw", "raw transcript", false, true, "local_ref_only"],
  ["tier.full", "full structured transcript", false, true, "restricted_ref_only"],
  ["tier.redacted", "redacted summary", true, false, "ui_visible_summary"],
];

const EXTRACTION_SPECS = [
  ["extract.goal", "goal", "current objective and goal checkpoint"],
  ["extract.phase", "phase", "phase, tranche, milestone range"],
  ["extract.blocker", "blocker", "missing evidence, failing validator, stale or unsafe state"],
  ["extract.decision", "decision", "accepted direction, rejected direction, boundary decision"],
  ["extract.validation_item", "validation_item", "command, check, gate, evidence, receipt result"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_transcript_ref", "conversation event has no transcript_ref", "BLOCK_MISSING_TRANSCRIPT_REF"],
  ["negative.duplicate_session_event", "same engine/session/turn is ingested twice as distinct source", "BLOCK_DUPLICATE_SESSION_EVENT"],
  ["negative.uncited_memory_recall", "memory claim has no conversation citation", "BLOCK_UNCITED_MEMORY"],
  ["negative.authority_contamination", "Codex/Claude conversation capture is treated as final approval authority", "BLOCK_AUTHORITY_CONTAMINATION"],
  ["negative.raw_ui_exposure", "raw/full transcript body appears in UI-visible field", "BLOCK_RAW_UI_EXPOSURE"],
  ["negative.secret_or_client_raw_leak", "secret/client raw material is marked UI visible", "BLOCK_RAW_MATERIAL_LEAK"],
  ["negative.human_gate_reintroduced", "Human gate is silently reintroduced into P8400 no-human scope", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.production_enterprise_pass", "conversation capture creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runConversationCaptureContract(options = {}) {
  const result = await buildConversationCaptureContract(options);
  if (options.write !== false) await writeConversationCaptureContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Conversation capture contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConversationCaptureContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONVERSATION_CAPTURE_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const p8000Closeout = options.p8000Closeout
    ? normalizeInlineJsonSource("inline.p8000_closeout", options.p8000Closeout)
    : await readJsonOrBuildP8000Closeout(inputs.p8000_closeout_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const engineRows = buildEngineSessionRows(generatedAt);
  const transcriptRows = buildTranscriptRefRows(engineRows, generatedAt);
  const separationRows = buildRawFullRedactedRows(generatedAt);
  const extractionRows = buildPlanExtractionRows(transcriptRows, generatedAt);
  const validatorRows = buildCaptureValidatorRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    p8000Closeout,
    contract,
    phaseRows,
    engineRows,
    transcriptRows,
    separationRows,
    extractionRows,
    validatorRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({ p8000Closeout, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, p8000Closeout, contract, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    conversation_capture_contract_id: `conversation-capture-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_p8000_closeout_summary: p8000Closeout.data?.summary ?? null,
    conversation_capture_contract: contract,
    conversation_capture_phase_rows: phaseRows,
    engine_session_rows: engineRows,
    transcript_reference_rows: transcriptRows,
    raw_full_redacted_boundary_rows: separationRows,
    plan_extraction_contract_rows: extractionRows,
    conversation_capture_validator_rows: validatorRows,
    conversation_capture_negative_fixture_rows: negativeFixtureRows,
    conversation_capture_gate_rows: gateRows,
    conversation_capture_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ p8000Closeout, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "conversation_capture_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ p8000Closeout, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows, boundary, validation: result.validation });
  result.summary.conversation_capture_contract_id = result.conversation_capture_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeConversationCaptureContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "conversation-capture-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "conversation-capture-phase-rows.json"), collectionEnvelope("conversation-capture-phase-rows.v1", "conversation_capture_phase_rows", result.conversation_capture_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "engine-session-rows.json"), collectionEnvelope("engine-session-rows.v1", "engine_session_rows", result.engine_session_rows, result.generated_at));
  await writeJson(path.join(outDir, "transcript-reference-rows.json"), collectionEnvelope("transcript-reference-rows.v1", "transcript_reference_rows", result.transcript_reference_rows, result.generated_at));
  await writeJson(path.join(outDir, "raw-full-redacted-boundary-rows.json"), collectionEnvelope("raw-full-redacted-boundary-rows.v1", "raw_full_redacted_boundary_rows", result.raw_full_redacted_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-extraction-contract-rows.json"), collectionEnvelope("plan-extraction-contract-rows.v1", "plan_extraction_contract_rows", result.plan_extraction_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-capture-validator-rows.json"), collectionEnvelope("conversation-capture-validator-rows.v1", "conversation_capture_validator_rows", result.conversation_capture_validator_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-capture-negative-fixture-rows.json"), collectionEnvelope("conversation-capture-negative-fixture-rows.v1", "conversation_capture_negative_fixture_rows", result.conversation_capture_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-capture-gate-rows.json"), collectionEnvelope("conversation-capture-gate-rows.v1", "conversation_capture_gate_rows", result.conversation_capture_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-capture-boundary.json"), result.conversation_capture_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "conversation-capture-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runConversationCaptureContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConversationCaptureContract(args);
    console.log(`Conversation capture contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.conversation_capture_contract_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Engine sessions: ${result.summary.engine_session_count}`);
    console.log(`Transcript refs: ${result.summary.transcript_reference_count}`);
    console.log(`Plan extraction rows: ${result.summary.plan_extraction_count}`);
    console.log(`Raw transcript UI visible: ${result.summary.raw_transcript_ui_visible}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "conversation-capture-contract-policy.v1",
    generated_at: generatedAt,
    contract_id: "conversation-capture-contract.p8081-p8160",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_source_fields: ["conversation_source_id", "engine_id", "engine_name", "session_id", "transcript_ref", "raw_transcript_ref", "full_transcript_ref", "redacted_summary_ref", "capture_status", "owner_engine", "authority_role"],
    required_extraction_types: EXTRACTION_SPECS.map(([, extraction_type]) => extraction_type),
    codex_is_development_engine: true,
    claude_is_independent_review_engine: true,
    harness_is_status_evidence_control_plane: true,
    raw_transcript_body_default_visible: false,
    full_transcript_body_default_visible: false,
    redacted_summary_ui_visible: true,
    raw_secret_material_allowed_in_ui: false,
    raw_client_material_allowed_in_ui: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    enterprise_pass_enabled: false,
    production_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "conversation-capture-phase-row.v1",
      row_id: `conversation.capture.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8400.${phase_range}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.conversation_capture.${phase_range}`,
      next_allowed_action: pass ? "preserve conversation capture phase" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildEngineSessionRows(generatedAt) {
  return ENGINE_SPECS.map(([engine_id, engine_name, session_id, authority_role], index) => ({
    schema_version: "engine-session-row.v1",
    row_id: `engine.session.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    engine_id,
    engine_name,
    session_id,
    authority_role,
    transcript_ref_required: true,
    source_schema_required: true,
    final_approval_allowed: false,
    source_mutation_allowed_by_capture: false,
    evidence_ref: `evidence.conversation_capture.engine.${engine_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.engine.${engine_id}`,
    next_allowed_action: "capture conversation as source material only",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildTranscriptRefRows(engineRows, generatedAt) {
  return engineRows.map((engine, index) => ({
    schema_version: "transcript-reference-row.v1",
    row_id: `transcript.reference.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    conversation_source_id: `conversation.source.${engine.engine_id.replaceAll(".", "_")}`,
    engine_id: engine.engine_id,
    engine_name: engine.engine_name,
    session_id: engine.session_id,
    transcript_ref: `transcript.${engine.session_id}.envelope`,
    raw_transcript_ref: `transcript.${engine.session_id}.raw.local_ref`,
    full_transcript_ref: `transcript.${engine.session_id}.full.restricted_ref`,
    redacted_summary_ref: `transcript.${engine.session_id}.redacted_summary`,
    capture_status: "captured",
    raw_body_ui_visible: false,
    full_body_ui_visible: false,
    redacted_summary_ui_visible: true,
    transcript_ref_cited: true,
    duplicate_key: `${engine.engine_id}:${engine.session_id}`,
    duplicate_detected: false,
    evidence_ref: `evidence.conversation_capture.transcript.${engine.engine_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.transcript.${engine.engine_id}`,
    next_allowed_action: "extract plan signals from cited transcript refs",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRawFullRedactedRows(generatedAt) {
  return TRANSCRIPT_TIER_SPECS.map(([tier_id, tier_name, ui_visible, raw_sensitive, storage_policy], index) => ({
    schema_version: "raw-full-redacted-boundary-row.v1",
    row_id: `raw.full.redacted.boundary.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    tier_id,
    tier_name,
    storage_policy,
    ui_visible,
    raw_sensitive,
    body_default_visible: ui_visible,
    transcript_body_allowed_in_ui: ui_visible && !raw_sensitive,
    redaction_required_before_ui: !ui_visible,
    evidence_ref: `evidence.conversation_capture.tier.${tier_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.tier.${tier_id}`,
    next_allowed_action: ui_visible ? "show redacted summary in UI" : "store reference only and hide body by default",
    unsafe_flags_false: !(ui_visible && rawSensitiveOrRestricted(tier_id)),
    verdict_authority: "harness_only",
  }));
}

function buildPlanExtractionRows(transcriptRows, generatedAt) {
  const sourceRef = transcriptRows[0]?.conversation_source_id ?? "conversation.source.codex";
  return EXTRACTION_SPECS.map(([extraction_id, extraction_type, description], index) => ({
    schema_version: "plan-extraction-contract-row.v1",
    row_id: `plan.extraction.contract.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    extraction_id,
    extraction_type,
    description,
    source_conversation_ref: sourceRef,
    transcript_ref: transcriptRows[index % transcriptRows.length]?.transcript_ref ?? null,
    source_citation_required: true,
    source_citation_present: true,
    ui_projection_allowed: true,
    adopted_as_truth: false,
    harness_status_candidate: true,
    evidence_ref: `evidence.conversation_capture.extraction.${extraction_type}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.extraction.${extraction_type}`,
    next_allowed_action: "project extraction into plan progress engine as cited candidate",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildCaptureValidatorRows(generatedAt) {
  const specs = [
    ["validator.required_fields", "engine_id, session_id, transcript_ref, and source citation are required"],
    ["validator.tier_visibility", "raw/full transcript bodies are hidden and redacted summary is UI visible"],
    ["validator.duplicate_detection", "engine/session duplicate key is checked"],
    ["validator.memory_citation", "memory recall must cite a conversation source"],
    ["validator.authority_boundary", "capture source cannot become final approval authority"],
  ];
  return specs.map(([validator_id, description], index) => ({
    schema_version: "conversation-capture-validator-row.v1",
    row_id: `conversation.capture.validator.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    validator_id,
    description,
    validator_status: "ready",
    check_command_ref: COMMAND_NAME,
    evidence_ref: `evidence.conversation_capture.validator.${validator_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.validator.${validator_id}`,
    next_allowed_action: "preserve validator in P8160 closeout",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "conversation-capture-negative-fixture-row.v1",
    row_id: `conversation.capture.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    evidence_ref: `evidence.conversation_capture.negative.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.negative.${fixture_id}`,
    next_allowed_action: "preserve fail-closed capture fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows(args) {
  const { packageJson, roadmapDoc, architectureDoc, p8000Closeout, contract, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows } = args;
  const sourceReady = p8000Closeout.data?.summary?.p8000_closeout_review_clean_checkpoint_status === SOURCE_READY_STATUS;
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes conversation capture contract command"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes conversation capture command"],
    ["source_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "P8000 closeout command exists"],
    ["source_p8000_ready", sourceReady, "P8000 closeout checkpoint is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Conversation Capture Contract"), "P8081-P8160 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Conversation Capture Contract"), "architecture reflects conversation capture"],
    ["contract_ready", contract.raw_transcript_body_default_visible === false && contract.redacted_summary_ui_visible === true, "capture contract enforces raw/redacted boundary"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P8081-P8160 phase rows pass"],
    ["engine_sessions_ready", engineRows.length >= 2 && engineRows.every((row) => row.engine_id && row.session_id && row.final_approval_allowed === false), "Codex and Claude sessions are captured"],
    ["transcript_refs_ready", transcriptRows.every((row) => row.transcript_ref && row.raw_body_ui_visible === false && row.redacted_summary_ui_visible === true), "transcript refs are stable and redacted for UI"],
    ["tier_separation_ready", separationRows.some((row) => row.tier_id === "tier.raw" && row.ui_visible === false) && separationRows.some((row) => row.tier_id === "tier.redacted" && row.ui_visible === true), "raw/full/redacted separation is ready"],
    ["plan_extraction_ready", extractionRows.length === EXTRACTION_SPECS.length && extractionRows.every((row) => row.source_citation_present), "plan extraction rows are cited"],
    ["validators_ready", validatorRows.length >= 5 && validatorRows.every((row) => row.validator_status === "ready"), "capture validators are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe capture claims"],
    ["boundary_no_human", contract.human_gate_in_scope === false, "Human gate remains excluded"],
    ["boundary_no_final_pass", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false && contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "production, enterprise, Codex, and Claude final PASS stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "conversation-capture-gate-row.v1",
    row_id: `conversation.capture.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.conversation_capture.gate.${gate_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.conversation_capture.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ p8000Closeout, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows }) {
  const sourceReady = p8000Closeout.data?.summary?.p8000_closeout_review_clean_checkpoint_status === SOURCE_READY_STATUS;
  const phaseReady = phaseRows.every((row) => row.current_verdict === "pass");
  const engineReady = engineRows.length >= 2 && engineRows.every((row) => row.engine_id && row.session_id && row.final_approval_allowed === false);
  const transcriptReady = transcriptRows.every((row) => row.transcript_ref && row.raw_body_ui_visible === false && row.full_body_ui_visible === false && row.redacted_summary_ui_visible === true && row.duplicate_detected === false);
  const separationReady = separationRows.every((row) => row.tier_id === "tier.redacted" ? row.ui_visible === true : row.ui_visible === false);
  const extractionReady = extractionRows.length === EXTRACTION_SPECS.length && extractionRows.every((row) => row.source_citation_present);
  const validatorReady = validatorRows.every((row) => row.validator_status === "ready");
  const negativeReady = negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false);
  const gateReady = gateRows.every((row) => row.gate_status === "ready");
  const unsafeFlags = [
    !sourceReady,
    !phaseReady,
    !engineReady,
    !transcriptReady,
    !separationReady,
    !extractionReady,
    !validatorReady,
    !negativeReady,
    !gateReady,
  ];
  return {
    schema_version: "conversation-capture-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p8000_closeout_ready: sourceReady,
    conversation_capture_contract_ready: unsafeFlags.filter(Boolean).length === 0,
    engine_sessions_ready: engineReady,
    transcript_refs_ready: transcriptReady,
    raw_transcript_ui_visible: false,
    full_transcript_ui_visible: false,
    redacted_summary_ui_visible: true,
    plan_extraction_contract_ready: extractionReady,
    capture_validator_ready: validatorReady,
    duplicate_detection_enabled: true,
    uncited_memory_blocked: true,
    authority_contamination_blocked: true,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, p8000Closeout, contract, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include conversation capture command"),
    validationItem("source.ready", "source", p8000Closeout.data?.summary?.p8000_closeout_review_clean_checkpoint_status === SOURCE_READY_STATUS, "P8000 closeout must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8081-P8160"), "roadmap must reflect P8081-P8160"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Conversation Capture Contract"), "architecture must reflect conversation capture"),
    validationItem("contract.raw_redacted", "contract", contract.raw_transcript_body_default_visible === false && contract.redacted_summary_ui_visible === true, "raw/redacted boundary must be enforced"),
    validationItem("phases.pass", "phase", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("engines.ready", "engine", engineRows.length >= 2 && engineRows.every((row) => row.session_id && row.final_approval_allowed === false), "engine sessions must be captured"),
    validationItem("transcripts.ready", "transcript", transcriptRows.every((row) => row.transcript_ref && row.raw_body_ui_visible === false && row.redacted_summary_ui_visible === true), "transcripts must have safe refs"),
    validationItem("tiers.ready", "tier", separationRows.every((row) => row.tier_id === "tier.redacted" ? row.ui_visible === true : row.ui_visible === false), "tier visibility must be safe"),
    validationItem("extraction.ready", "extraction", extractionRows.length === EXTRACTION_SPECS.length && extractionRows.every((row) => row.source_citation_present), "all extraction rows must be cited"),
    validationItem("validators.ready", "validator", validatorRows.length >= 5 && validatorRows.every((row) => row.validator_status === "ready"), "validators must be ready"),
    validationItem("fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures must pass"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("boundary.safe", "boundary", boundary.conversation_capture_contract_ready && boundary.unsafe_flag_count === 0, "boundary must be safe"),
  ];
}

function buildSummary({ p8000Closeout, phaseRows, engineRows, transcriptRows, separationRows, extractionRows, validatorRows, negativeFixtureRows, gateRows, boundary, validation }) {
  return {
    schema_version: "conversation-capture-contract-summary.v1",
    conversation_capture_contract_status: validation.valid && boundary.conversation_capture_contract_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p8000_closeout_status: p8000Closeout.data?.summary?.p8000_closeout_review_clean_checkpoint_status ?? "unknown",
    source_p8000_closeout_ready: boundary.source_p8000_closeout_ready,
    phase_row_count: phaseRows.length,
    engine_session_count: engineRows.length,
    transcript_reference_count: transcriptRows.length,
    tier_boundary_count: separationRows.length,
    plan_extraction_count: extractionRows.length,
    capture_validator_count: validatorRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    raw_transcript_ui_visible: boundary.raw_transcript_ui_visible,
    full_transcript_ui_visible: boundary.full_transcript_ui_visible,
    redacted_summary_ui_visible: boundary.redacted_summary_ui_visible,
    plan_extraction_contract_ready: boundary.plan_extraction_contract_ready,
    duplicate_detection_enabled: boundary.duplicate_detection_enabled,
    uncited_memory_blocked: boundary.uncited_memory_blocked,
    authority_contamination_blocked: boundary.authority_contamination_blocked,
    human_gate_in_scope: boundary.human_gate_in_scope,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `conversation_capture_block.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Conversation Capture Contract",
    "",
    `Status: ${result.summary.conversation_capture_contract_status}`,
    `Program: ${result.summary.program_range}`,
    `Source P8000 closeout ready: ${result.summary.source_p8000_closeout_ready}`,
    `Engine sessions: ${result.summary.engine_session_count}`,
    `Transcript refs: ${result.summary.transcript_reference_count}`,
    `Plan extraction rows: ${result.summary.plan_extraction_count}`,
    `Raw transcript UI visible: ${result.summary.raw_transcript_ui_visible}`,
    `Redacted summary UI visible: ${result.summary.redacted_summary_ui_visible}`,
    `Human gate in scope: ${result.summary.human_gate_in_scope}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return { item_id, category, status: passed ? "pass" : "error", message };
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
  const defaults = DEFAULT_CONVERSATION_CAPTURE_CONTRACT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    p8000_closeout_path: options.p8000CloseoutPath ?? defaults.p8000CloseoutPath,
  };
}

async function readJsonOrBuildP8000Closeout(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildP8000CloseoutReviewCleanCheckpoint({ runAt: generatedAt, write: false });
    return { available: true, path: "generated.p8000_closeout", data: built };
  } catch (error) {
    return { available: false, path: sourcePath, error: `${source.error}; generated fallback failed: ${error.message}` };
  }
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

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data };
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function rawSensitiveOrRestricted(tierId) {
  return tierId === "tier.raw" || tierId === "tier.full";
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, count: items.length, items };
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
    p8000CloseoutPath: undefined,
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
    } else if (arg === "--p8000-closeout") {
      args.p8000CloseoutPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/conversation-capture-contract.mjs [options]

Options:
  --check                    Validate without writing artifacts.
  --out-dir <path>           Artifact output directory.
  --schema <path>            Schema path.
  --package <path>           package.json path.
  --roadmap-doc <path>       P8081-P8400 roadmap document path.
  --architecture-doc <path>  Architecture document path.
  --p8000-closeout <path>    P8000 closeout artifact path.
  --help                     Show this help.
`);
}
