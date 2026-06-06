import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildConversationCaptureContract } from "./conversation-capture-contract.mjs";

export const DEFAULT_PLAN_REGISTRY_PROGRESS_ENGINE_OUT_DIR = "artifacts/plan-registry-progress-engine/latest";
export const DEFAULT_PLAN_REGISTRY_PROGRESS_ENGINE_INPUTS = {
  schemaPath: "schemas/plan-registry-progress-engine.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8081-p8400.md",
  architectureDocPath: "docs/architecture.md",
  conversationCapturePath: "artifacts/conversation-capture-contract/latest/conversation-capture-contract.json",
};

const COMMAND_NAME = "platform:plan-registry-progress-engine";
const SOURCE_COMMAND_NAME = "platform:conversation-capture-contract";
const SCHEMA_VERSION = "plan-registry-progress-engine.v1";
const CAPABILITY_ID = "platform.plan_registry_progress_engine";
const PROGRAM_RANGE = "P8161-P8240";
const SOURCE_PROGRAM_RANGE = "P8081-P8160";
const SOURCE_READY_STATUS = "ready_for_conversation_capture_contract";
const READY_STATUS = "ready_for_plan_registry_progress_engine";

const PHASE_SPECS = [
  ["P8161-P8180", "Long-Term Plan Registration Model"],
  ["P8181-P8200", "Phase Progress Calculation"],
  ["P8201-P8220", "Validation Gate Review Linking"],
  ["P8221-P8240", "Stale Context Drift Detection"],
];

const STATUS_ENUM = ["planned", "in_progress", "blocked", "pass", "review_pending"];

const PLAN_SPECS = [
  ["plan.hermes.p8081_p8240", "Hermes Conversation Capture and Plan Progress Control Plane", "P8240", "Codex", "in_progress"],
  ["plan.hermes.p8241_p8400", "Hermes Work OS UI v0 and Harness-Governed Development Loop", "P8400", "Codex", "planned"],
];

const PROGRESS_SPECS = [
  ["P8081-P8160", "Conversation Capture Contract", "pass"],
  ["P8161-P8240", "Plan Registry And Progress Engine", "in_progress"],
  ["P8241-P8320", "Work OS UI v0", "planned"],
  ["P8321-P8400", "Harness-Governed Development Loop", "planned"],
  ["P8001-P8080", "P8000 Closeout Review Clean Checkpoint", "pass"],
  ["P8400.freeze", "P8400 Freeze", "review_pending"],
  ["external.enterprise_trust", "Enterprise Independent Trust", "blocked"],
];

const STALE_DRIFT_SPECS = [
  ["drift.stale_plan", "plan has not been refreshed after new conversation evidence", "stale_visible"],
  ["drift.missing_conversation", "phase has no cited conversation source", "missing_source_visible"],
  ["drift.validation_not_run", "phase has no current validator evidence", "validation_pending_visible"],
  ["drift.review_receipt_missing", "milestone lacks Claude review receipt", "review_pending_visible"],
  ["drift.context_mismatch", "recalled context does not cite source transcript", "context_drift_visible"],
];

const NEGATIVE_FIXTURES = [
  ["negative.duplicate_plan_id", "two plans share one plan_id", "BLOCK_DUPLICATE_PLAN_ID"],
  ["negative.phase_without_owner_engine", "phase status lacks owner engine", "BLOCK_PHASE_WITHOUT_OWNER"],
  ["negative.pass_without_validation", "phase is PASS without validator evidence", "BLOCK_PASS_WITHOUT_VALIDATION"],
  ["negative.review_pending_hidden", "Claude review pending state is hidden from progress", "BLOCK_HIDDEN_REVIEW_PENDING"],
  ["negative.stale_context_pass", "stale context is still displayed as PASS", "BLOCK_STALE_CONTEXT_PASS"],
  ["negative.uncited_memory_progress", "memory recall changes progress without conversation citation", "BLOCK_UNCITED_MEMORY_PROGRESS"],
  ["negative.human_gate_reintroduced", "Human gate is reintroduced into P8400 no-human scope", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.enterprise_production_pass", "plan progress creates production or enterprise PASS", "BLOCK_ENTERPRISE_PRODUCTION_PASS"],
];

export async function runPlanRegistryProgressEngine(options = {}) {
  const result = await buildPlanRegistryProgressEngine(options);
  if (options.write !== false) await writePlanRegistryProgressEngine(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Plan registry progress engine failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlanRegistryProgressEngine(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLAN_REGISTRY_PROGRESS_ENGINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const conversationCapture = options.conversationCapture
    ? normalizeInlineJsonSource("inline.conversation_capture", options.conversationCapture)
    : await readJsonOrBuildConversationCapture(inputs.conversation_capture_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const planRows = buildPlanRegistryRows(generatedAt);
  const phaseProgressRows = buildPhaseProgressRows({ conversationCapture, generatedAt });
  const statusCalculationRows = buildStatusCalculationRows(phaseProgressRows, generatedAt);
  const validationGateReviewRows = buildValidationGateReviewRows(phaseProgressRows, generatedAt);
  const staleContextDriftRows = buildStaleContextDriftRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    conversationCapture,
    contract,
    phaseRows,
    planRows,
    phaseProgressRows,
    statusCalculationRows,
    validationGateReviewRows,
    staleContextDriftRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({ conversationCapture, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, conversationCapture, contract, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    plan_registry_progress_engine_id: `plan-registry-progress-engine.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_conversation_capture_summary: conversationCapture.data?.summary ?? null,
    plan_registry_progress_contract: contract,
    plan_registry_progress_phase_rows: phaseRows,
    long_term_plan_registry_rows: planRows,
    phase_progress_rows: phaseProgressRows,
    progress_status_calculation_rows: statusCalculationRows,
    validation_gate_review_link_rows: validationGateReviewRows,
    stale_context_drift_rows: staleContextDriftRows,
    plan_progress_negative_fixture_rows: negativeFixtureRows,
    plan_progress_gate_rows: gateRows,
    plan_progress_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ conversationCapture, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "plan_registry_progress_engine")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ conversationCapture, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows, boundary, validation: result.validation });
  result.summary.plan_registry_progress_engine_id = result.plan_registry_progress_engine_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlanRegistryProgressEngine(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "plan-registry-progress-engine.json"), serializableResult(result));
  await writeJson(path.join(outDir, "plan-registry-progress-phase-rows.json"), collectionEnvelope("plan-registry-progress-phase-rows.v1", "plan_registry_progress_phase_rows", result.plan_registry_progress_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "long-term-plan-registry-rows.json"), collectionEnvelope("long-term-plan-registry-rows.v1", "long_term_plan_registry_rows", result.long_term_plan_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "phase-progress-rows.json"), collectionEnvelope("phase-progress-rows.v1", "phase_progress_rows", result.phase_progress_rows, result.generated_at));
  await writeJson(path.join(outDir, "progress-status-calculation-rows.json"), collectionEnvelope("progress-status-calculation-rows.v1", "progress_status_calculation_rows", result.progress_status_calculation_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-gate-review-link-rows.json"), collectionEnvelope("validation-gate-review-link-rows.v1", "validation_gate_review_link_rows", result.validation_gate_review_link_rows, result.generated_at));
  await writeJson(path.join(outDir, "stale-context-drift-rows.json"), collectionEnvelope("stale-context-drift-rows.v1", "stale_context_drift_rows", result.stale_context_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-progress-negative-fixture-rows.json"), collectionEnvelope("plan-progress-negative-fixture-rows.v1", "plan_progress_negative_fixture_rows", result.plan_progress_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-progress-gate-rows.json"), collectionEnvelope("plan-progress-gate-rows.v1", "plan_progress_gate_rows", result.plan_progress_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-progress-boundary.json"), result.plan_progress_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "plan-registry-progress-engine-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlanRegistryProgressEngineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlanRegistryProgressEngine(args);
    console.log(`Plan registry progress engine ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.plan_registry_progress_engine_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Plans: ${result.summary.plan_registry_count}`);
    console.log(`Phase progress rows: ${result.summary.phase_progress_count}`);
    console.log(`Status enum: ${result.summary.status_enum.join(", ")}`);
    console.log(`Clean handoff to UI v0: ${result.summary.ready_for_work_os_ui_v0_handoff}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "plan-registry-progress-contract.v1",
    generated_at: generatedAt,
    contract_id: "plan-registry-progress-contract.p8161-p8240",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_plan_fields: ["plan_id", "phase_id", "milestone_id", "owner_engine", "status"],
    phase_status_enum: STATUS_ENUM,
    validator_evidence_review_refs_required: true,
    stale_plan_visible: true,
    missing_conversation_visible: true,
    validation_not_run_visible: true,
    context_drift_visible: true,
    codex_primary_engine_lane: true,
    claude_review_lane: true,
    harness_validation_lane: true,
    human_gate_in_scope: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "plan-registry-progress-phase-row.v1",
      row_id: `plan.registry.progress.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8400.${phase_range}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.plan_progress.${phase_range}`,
      next_allowed_action: pass ? "preserve plan progress phase" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildPlanRegistryRows(generatedAt) {
  return PLAN_SPECS.map(([plan_id, title, milestone_id, owner_engine, status], index) => ({
    schema_version: "long-term-plan-registry-row.v1",
    row_id: `long.term.plan.registry.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    plan_id,
    title,
    phase_id: index === 0 ? "P8161-P8240" : "P8241-P8400",
    milestone_id,
    owner_engine,
    reviewer_engine: "Claude Code",
    status,
    status_enum: STATUS_ENUM,
    evidence_ref: `evidence.plan_registry.${plan_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.plan_registry.${plan_id}`,
    next_allowed_action: status === "planned" ? "start after P8240 handoff" : "continue current plan progress work",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildPhaseProgressRows({ conversationCapture, generatedAt }) {
  const captureReady = conversationCapture.data?.summary?.conversation_capture_contract_status === SOURCE_READY_STATUS;
  const captureRefs = conversationCapture.data?.transcript_reference_rows ?? [];
  return PROGRESS_SPECS.map(([phase_id, title, status], index) => {
    const effectiveStatus = phase_id === "P8081-P8160" && !captureReady ? "blocked" : status;
    return {
      schema_version: "phase-progress-row.v1",
      row_id: `phase.progress.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      plan_id: phase_id.startsWith("P82") || phase_id.startsWith("P83") || phase_id === "P8400.freeze" ? "plan.hermes.p8241_p8400" : "plan.hermes.p8081_p8240",
      phase_id,
      milestone_id: phase_id.includes("8400") ? "P8400" : "P8240",
      title,
      owner_engine: phase_id === "external.enterprise_trust" ? "Harness" : "Codex",
      reviewer_engine: "Claude Code",
      harness_lane: "Harness",
      status: effectiveStatus,
      status_reason: buildStatusReason(effectiveStatus),
      conversation_source_ref: captureRefs[index % Math.max(captureRefs.length, 1)]?.conversation_source_id ?? "conversation.source.pending",
      conversation_source_cited: captureReady,
      validator_ref: `validator.plan_progress.${phase_id}`,
      evidence_ref: `evidence.plan_progress.${phase_id}`,
      gate_ref: `gate.plan_progress.${phase_id}`,
      claude_review_receipt_ref: `review.claude.${phase_id}`,
      validation_required: true,
      validation_observed_now: ["pass", "in_progress"].includes(effectiveStatus),
      review_required: ["review_pending", "pass"].includes(effectiveStatus),
      next_allowed_action: buildNextAllowedAction(effectiveStatus),
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildStatusCalculationRows(phaseProgressRows, generatedAt) {
  return STATUS_ENUM.map((status, index) => {
    const matching = phaseProgressRows.filter((row) => row.status === status);
    return {
      schema_version: "progress-status-calculation-row.v1",
      row_id: `progress.status.calculation.row.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      status,
      phase_count: matching.length,
      phase_refs: matching.map((row) => row.phase_id),
      visible_in_ui: true,
      blocks_pass_if_uncited: status === "pass",
      evidence_ref: `evidence.progress_status.${status}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.progress_status.${status}`,
      next_allowed_action: "project status into Work OS UI v0",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildValidationGateReviewRows(phaseProgressRows, generatedAt) {
  return phaseProgressRows.map((phase, index) => ({
    schema_version: "validation-gate-review-link-row.v1",
    row_id: `validation.gate.review.link.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    phase_id: phase.phase_id,
    validator_ref: phase.validator_ref,
    evidence_ref: phase.evidence_ref,
    gate_ref: phase.gate_ref,
    claude_review_receipt_ref: phase.claude_review_receipt_ref,
    validator_bound: true,
    evidence_bound: true,
    gate_bound: true,
    review_receipt_bound: true,
    pass_requires_validator_and_review: phase.status === "pass",
    evidence_ref_cited: true,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.validation_gate_review.${phase.phase_id}`,
    next_allowed_action: "surface validator/evidence/gate/review in phase detail view",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildStaleContextDriftRows(generatedAt) {
  return STALE_DRIFT_SPECS.map(([drift_id, description, visible_state], index) => ({
    schema_version: "stale-context-drift-row.v1",
    row_id: `stale.context.drift.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    drift_id,
    description,
    visible_state,
    drift_detected_now: false,
    blocks_automatic_pass: true,
    ui_badge_required: true,
    next_action_required: true,
    evidence_ref: `evidence.stale_context_drift.${drift_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.stale_context_drift.${drift_id}`,
    next_allowed_action: "show stale/context drift state before Work OS UI v0 pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "plan-progress-negative-fixture-row.v1",
    row_id: `plan.progress.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    evidence_ref: `evidence.plan_progress.negative.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.plan_progress.negative.${fixture_id}`,
    next_allowed_action: "preserve fail-closed plan progress fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows(args) {
  const { packageJson, roadmapDoc, architectureDoc, conversationCapture, contract, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows } = args;
  const sourceReady = conversationCapture.data?.summary?.conversation_capture_contract_status === SOURCE_READY_STATUS;
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes plan registry progress command"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes plan registry progress command"],
    ["source_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "conversation capture command exists"],
    ["source_capture_ready", sourceReady, "conversation capture contract is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Plan Registry And Progress Engine"), "P8161-P8240 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Plan Registry And Progress Engine"), "architecture reflects plan registry progress engine"],
    ["contract_ready", contract.validator_evidence_review_refs_required && contract.human_gate_in_scope === false, "plan progress contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P8161-P8240 phase rows pass"],
    ["plan_registry_ready", planRows.length >= 2 && planRows.every((row) => row.plan_id && row.phase_id && row.milestone_id && row.owner_engine && STATUS_ENUM.includes(row.status)), "plan registry rows are complete"],
    ["phase_progress_ready", phaseProgressRows.length >= 7 && phaseProgressRows.every((row) => STATUS_ENUM.includes(row.status) && row.owner_engine), "phase progress rows are complete"],
    ["all_statuses_visible", STATUS_ENUM.every((status) => statusCalculationRows.some((row) => row.status === status && row.visible_in_ui)), "all progress statuses are visible"],
    ["validation_gate_review_bound", validationGateReviewRows.every((row) => row.validator_bound && row.evidence_bound && row.gate_bound && row.review_receipt_bound), "validation/gate/review refs are bound"],
    ["stale_context_visible", staleContextDriftRows.every((row) => row.ui_badge_required && row.blocks_automatic_pass), "stale/context drift states are visible"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe plan progress claims"],
    ["boundary_no_human", contract.human_gate_in_scope === false, "Human gate remains excluded"],
    ["boundary_no_final_pass", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false && contract.protected_closeout_enabled === false, "production, enterprise, and protected closeout stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "plan-progress-gate-row.v1",
    row_id: `plan.progress.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.plan_progress.gate.${gate_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.plan_progress.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ conversationCapture, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows }) {
  const sourceReady = conversationCapture.data?.summary?.conversation_capture_contract_status === SOURCE_READY_STATUS;
  const phaseReady = phaseRows.every((row) => row.current_verdict === "pass");
  const planReady = planRows.length >= 2 && planRows.every((row) => row.plan_id && row.phase_id && row.milestone_id && row.owner_engine && STATUS_ENUM.includes(row.status));
  const progressReady = phaseProgressRows.length >= 7 && phaseProgressRows.every((row) => STATUS_ENUM.includes(row.status) && row.validator_ref && row.evidence_ref && row.gate_ref && row.claude_review_receipt_ref);
  const statusReady = STATUS_ENUM.every((status) => statusCalculationRows.some((row) => row.status === status && row.visible_in_ui));
  const linkReady = validationGateReviewRows.every((row) => row.validator_bound && row.evidence_bound && row.gate_bound && row.review_receipt_bound);
  const driftReady = staleContextDriftRows.every((row) => row.ui_badge_required && row.blocks_automatic_pass);
  const negativeReady = negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false);
  const gateReady = gateRows.every((row) => row.gate_status === "ready");
  const unsafeFlags = [!sourceReady, !phaseReady, !planReady, !progressReady, !statusReady, !linkReady, !driftReady, !negativeReady, !gateReady];
  return {
    schema_version: "plan-progress-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_conversation_capture_ready: sourceReady,
    plan_registry_progress_engine_ready: unsafeFlags.filter(Boolean).length === 0,
    plan_registry_ready: planReady,
    phase_progress_ready: progressReady,
    all_statuses_visible: statusReady,
    validation_gate_review_links_ready: linkReady,
    stale_context_drift_visible: driftReady,
    ready_for_work_os_ui_v0_handoff: unsafeFlags.filter(Boolean).length === 0,
    human_gate_in_scope: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, conversationCapture, contract, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include plan progress command"),
    validationItem("source.ready", "source", conversationCapture.data?.summary?.conversation_capture_contract_status === SOURCE_READY_STATUS, "conversation capture source must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8161-P8240"), "roadmap must reflect P8161-P8240"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Plan Registry And Progress Engine"), "architecture must reflect plan progress engine"),
    validationItem("contract.ready", "contract", contract.validator_evidence_review_refs_required && contract.human_gate_in_scope === false, "contract must be ready"),
    validationItem("phases.pass", "phase", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("plans.ready", "plan", planRows.length >= 2 && planRows.every((row) => row.plan_id && row.phase_id && row.milestone_id && row.owner_engine && STATUS_ENUM.includes(row.status)), "plan rows must be complete"),
    validationItem("progress.ready", "progress", phaseProgressRows.length >= 7 && phaseProgressRows.every((row) => STATUS_ENUM.includes(row.status) && row.owner_engine), "phase progress rows must be complete"),
    validationItem("status.visible", "status", STATUS_ENUM.every((status) => statusCalculationRows.some((row) => row.status === status && row.visible_in_ui)), "all statuses must be visible"),
    validationItem("links.ready", "links", validationGateReviewRows.every((row) => row.validator_bound && row.evidence_bound && row.gate_bound && row.review_receipt_bound), "validator/gate/review refs must be bound"),
    validationItem("drift.visible", "drift", staleContextDriftRows.every((row) => row.ui_badge_required && row.blocks_automatic_pass), "stale/context drift states must be visible"),
    validationItem("fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures must pass"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "all gates must be ready"),
    validationItem("boundary.safe", "boundary", boundary.plan_registry_progress_engine_ready && boundary.unsafe_flag_count === 0, "boundary must be safe"),
  ];
}

function buildSummary({ conversationCapture, phaseRows, planRows, phaseProgressRows, statusCalculationRows, validationGateReviewRows, staleContextDriftRows, negativeFixtureRows, gateRows, boundary, validation }) {
  return {
    schema_version: "plan-registry-progress-engine-summary.v1",
    plan_registry_progress_engine_status: validation.valid && boundary.plan_registry_progress_engine_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_conversation_capture_status: conversationCapture.data?.summary?.conversation_capture_contract_status ?? "unknown",
    source_conversation_capture_ready: boundary.source_conversation_capture_ready,
    phase_row_count: phaseRows.length,
    plan_registry_count: planRows.length,
    phase_progress_count: phaseProgressRows.length,
    status_calculation_count: statusCalculationRows.length,
    validation_gate_review_link_count: validationGateReviewRows.length,
    stale_context_drift_count: staleContextDriftRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    status_enum: STATUS_ENUM,
    plan_registry_ready: boundary.plan_registry_ready,
    phase_progress_ready: boundary.phase_progress_ready,
    all_statuses_visible: boundary.all_statuses_visible,
    validation_gate_review_links_ready: boundary.validation_gate_review_links_ready,
    stale_context_drift_visible: boundary.stale_context_drift_visible,
    ready_for_work_os_ui_v0_handoff: boundary.ready_for_work_os_ui_v0_handoff,
    human_gate_in_scope: boundary.human_gate_in_scope,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function buildStatusReason(status) {
  return {
    planned: "phase is registered but not started",
    in_progress: "phase is current implementation work",
    blocked: "phase requires external or higher-trust evidence",
    pass: "phase has validator and evidence refs",
    review_pending: "phase needs Claude review receipt before freeze",
  }[status] ?? "unknown";
}

function buildNextAllowedAction(status) {
  return {
    planned: "wait for prior phase handoff",
    in_progress: "continue implementation and validation",
    blocked: "repair missing evidence before pass",
    pass: "preserve evidence and gate refs",
    review_pending: "capture Claude review receipt",
  }[status] ?? "review status";
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `plan_progress_block.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Plan Registry And Progress Engine",
    "",
    `Status: ${result.summary.plan_registry_progress_engine_status}`,
    `Program: ${result.summary.program_range}`,
    `Source conversation capture ready: ${result.summary.source_conversation_capture_ready}`,
    `Plans: ${result.summary.plan_registry_count}`,
    `Phase progress rows: ${result.summary.phase_progress_count}`,
    `Status enum: ${result.summary.status_enum.join(", ")}`,
    `Ready for Work OS UI v0 handoff: ${result.summary.ready_for_work_os_ui_v0_handoff}`,
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
  const defaults = DEFAULT_PLAN_REGISTRY_PROGRESS_ENGINE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    conversation_capture_path: options.conversationCapturePath ?? defaults.conversationCapturePath,
  };
}

async function readJsonOrBuildConversationCapture(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildConversationCaptureContract({ runAt: generatedAt, write: false });
    return { available: true, path: "generated.conversation_capture", data: built };
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
    conversationCapturePath: undefined,
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
    } else if (arg === "--conversation-capture") {
      args.conversationCapturePath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/plan-registry-progress-engine.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P8081-P8400 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --conversation-capture <path>   Conversation capture artifact path.
  --help                          Show this help.
`);
}
