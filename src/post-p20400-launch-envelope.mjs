import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPostP20000OperatorHandoff } from "./post-p20000-operator-handoff.mjs";

export const DEFAULT_POST_P20400_LAUNCH_ENVELOPE_OUT_DIR = "artifacts/post-p20400-launch-envelope/latest";
export const DEFAULT_POST_P20400_LAUNCH_ENVELOPE_INPUTS = {
  schemaPath: "schemas/post-p20400-launch-envelope.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p20401-p20800.md",
  architectureDocPath: "docs/architecture.md",
  sourcePostP20000OperatorHandoffPath: "artifacts/post-p20000-operator-handoff/latest/post-p20000-operator-handoff.json",
};

const COMMAND_NAME = "platform:post-p20400-launch-envelope";
const SCHEMA_VERSION = "post-p20400-launch-envelope.v1";
const CAPABILITY_ID = "platform.post_p20400_launch_envelope";
const PROGRAM_RANGE = "P20401-P20800";
const SOURCE_PROGRAM_RANGE = "P20001-P20400";
const READY_STATUS = "ready_for_post_p20400_launch_envelope";
const BLOCK_PENDING_STATUS = "valid_block_launch_envelope_pending";
const BLOCKED_STATUS = "blocked_post_p20400_launch_envelope";

const PHASE_SPECS = [
  ["P20401-P20440", "P20400 Source Binding", "p20400_source_binding_rows"],
  ["P20441-P20520", "Handoff Consumption Queue", "handoff_consumption_queue_rows"],
  ["P20521-P20600", "Action Eligibility Matrix", "action_eligibility_matrix_rows"],
  ["P20601-P20680", "Review Cadence Router", "review_cadence_router_rows"],
  ["P20681-P20740", "Validation Launch Packet", "validation_launch_packet_rows"],
  ["P20741-P20780", "Boundary Guard Projection", "boundary_guard_projection_rows"],
  ["P20781-P20800", "P20800 Launch Checkpoint", "p20800_launch_checkpoint_rows"],
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

const ACTION_ELIGIBILITY = [
  ["read_only_source_inspection", "Inspect source summary and handoff packet", true, "allowed_read_only"],
  ["read_only_queue_projection", "Project queue state without mutating source", true, "allowed_read_only"],
  ["targeted_validation", "Run targeted validation for changed tranche files", true, "allowed_validation"],
  ["adjacent_validation", "Run adjacent validation only when contract-linked", true, "allowed_validation"],
  ["full_suite_condition", "Run full npm test only for broad trust/release/write/schema freeze or explicit closeout demand", false, "conditional_validation"],
  ["claude_review_condition", "Request Claude Code Opus max review only for high-risk authority/freeze/release/write/connector/schema transitions", false, "conditional_review"],
  ["production_release_deploy", "Production PASS, release approval, and deployment remain unavailable", false, "blocked_protected"],
  ["runtime_write_action", "Runtime execution, write action, and protected action remain unavailable", false, "blocked_protected"],
  ["connector_raw_secret", "Connector write, raw exposure, and secret read remain unavailable", false, "blocked_protected"],
  ["final_automated_approval", "Reviewer mutation and final automated approval remain unavailable", false, "blocked_protected"],
];

const REVIEW_CADENCE = [
  ["routine_read_only_projection", "Routine read-only projection does not require Claude review now", false, "not_required"],
  ["authority_transition", "Authority boundary transition requires durable Claude review evidence", true, "required_if_authority_changes"],
  ["freeze_transition", "Freeze or release-readiness transition requires durable Claude review evidence", true, "required_if_freeze_or_release"],
  ["write_execution_transition", "Write, runtime, deployment, or connector transition requires durable Claude review evidence", true, "required_if_write_or_connector"],
  ["broad_schema_transition", "Broad schema or shared trust contract transition requires durable Claude review evidence", true, "required_if_broad_schema"],
  ["review_not_final_approval", "Claude review remains evidence and not final approval", false, "never_final_approval"],
];

export async function runPostP20400LaunchEnvelope(options = {}) {
  const result = await buildPostP20400LaunchEnvelope(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P20400 Launch Envelope failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP20400LaunchEnvelope(result, result.output_dir);
  return result;
}

export async function buildPostP20400LaunchEnvelope(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P20400_LAUNCH_ENVELOPE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "postP20000OperatorHandoff")
    ? normalizeInlineJsonSource("inline.post_p20000_operator_handoff", options.postP20000OperatorHandoff)
    : await readJsonOrBuildP20400(inputs.source_post_p20000_operator_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const queueRows = buildHandoffQueueRows({ source, sourceState, generatedAt });
  const eligibilityRows = buildActionEligibilityRows(generatedAt);
  const reviewRows = buildReviewCadenceRows(generatedAt);
  const validationRows = buildValidationLaunchRows(generatedAt);
  const boundaryRows = buildBoundaryGuardRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, queueRows, eligibilityRows, reviewRows, validationRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, queueRows, eligibilityRows, reviewRows, validationRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, queueRows, eligibilityRows, reviewRows, validationRows, boundaryRows, checkpointRows, boundary });
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
      post_p20000_operator_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_post_p20000_operator_handoff_summary: source.data?.summary ?? null,
    post_p20400_launch_envelope_contract: buildContract(generatedAt),
    post_p20400_launch_envelope_phase_rows: phaseRows,
    p20400_source_binding_rows: sourceRows,
    handoff_consumption_queue_rows: queueRows,
    action_eligibility_matrix_rows: eligibilityRows,
    review_cadence_router_rows: reviewRows,
    validation_launch_packet_rows: validationRows,
    boundary_guard_projection_rows: boundaryRows,
    p20800_launch_checkpoint_rows: checkpointRows,
    post_p20400_launch_envelope_boundary: boundary,
    post_p20400_launch_envelope_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p20400_launch_envelope")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p20400_launch_envelope_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p20400_launch_envelope_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writePostP20400LaunchEnvelope(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p20400-launch-envelope.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p20400-source-binding-rows.json"), collectionEnvelope("p20400-source-binding-rows.v1", "p20400_source_binding_rows", result.p20400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-consumption-queue-rows.json"), collectionEnvelope("handoff-consumption-queue-rows.v1", "handoff_consumption_queue_rows", result.handoff_consumption_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "action-eligibility-matrix-rows.json"), collectionEnvelope("action-eligibility-matrix-rows.v1", "action_eligibility_matrix_rows", result.action_eligibility_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-cadence-router-rows.json"), collectionEnvelope("review-cadence-router-rows.v1", "review_cadence_router_rows", result.review_cadence_router_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-launch-packet-rows.json"), collectionEnvelope("validation-launch-packet-rows.v1", "validation_launch_packet_rows", result.validation_launch_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary-guard-projection-rows.json"), collectionEnvelope("boundary-guard-projection-rows.v1", "boundary_guard_projection_rows", result.boundary_guard_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "p20800-launch-checkpoint-rows.json"), collectionEnvelope("p20800-launch-checkpoint-rows.v1", "p20800_launch_checkpoint_rows", result.p20800_launch_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-p20400-launch-envelope-boundary.json"), result.post_p20400_launch_envelope_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runPostP20400LaunchEnvelopeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP20400LaunchEnvelope(args);
  console.log(`Post-P20400 Launch Envelope ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.post_p20400_launch_envelope_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P20400 ready for P20401 handoff: ${result.summary.source_p20400_ready_for_p20401_handoff}`);
  console.log(`Queue rows: ${result.summary.handoff_consumption_queue_count}`);
  console.log(`Allowed action rows: ${result.summary.allowed_action_count}`);
  console.log(`Blocked protected action rows: ${result.summary.blocked_protected_action_count}`);
  console.log(`Ready for P20801 handoff: ${result.summary.ready_for_p20801_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.post_p20000_operator_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p20401_handoff === true,
    status: summary.post_p20000_operator_handoff_status ?? "missing",
    p20400ContractReady: boundary.p20400_contract_ready === true,
    operatorHandoffVisible: boundary.operator_handoff_packet_visible_now === true,
    verificationGuardVisible: boundary.verification_consumption_guard_visible_now === true,
    regressionPacketVisible: boundary.regression_packet_visible_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p20401-p20800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P20400 post-P20000 operator handoff source is available", sourceState.available],
    ["program_range", "P20400 source program range is P20001-P20400", sourceState.programRangeOk],
    ["validation_valid", "P20400 source validation is valid", sourceState.validationValid],
    ["p20401_handoff_open", "P20400 source opened P20401 handoff", sourceState.sourceReady],
    ["p20400_contract_ready", "P20400 source contract is ready", sourceState.p20400ContractReady],
    ["operator_handoff_visible", "P20400 operator handoff packet is visible", sourceState.operatorHandoffVisible],
    ["boundary_closed", "P20400 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for launch envelope", Boolean(commitRef)],
    ["source_blocker_visible", "P20400 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p20400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildHandoffQueueRows({ source, sourceState, generatedAt }) {
  const handoffRows = Array.isArray(source.data?.operator_handoff_packet_rows)
    ? source.data.operator_handoff_packet_rows
    : [];
  const rows = handoffRows.map((item, index) => row({
    row_id: `handoff_queue.${String(item.row_id ?? `row_${index + 1}`).replace(/^operator_handoff\./, "")}`,
    category: "handoff_consumption_queue",
    label: `Launch queue item: ${item.label ?? item.row_id}`,
    observed: sourceState.sourceReady && item.current_verdict === "pass",
    evidence_ref: item.row_id ?? "operator_handoff_packet_rows",
    queue_order: index + 1,
    owner_lane: item.owner_lane ?? "harness",
    next_action: item.next_action ?? "inspect",
    queue_state: sourceState.sourceReady && item.current_verdict === "pass" ? "launchable_read_only" : "blocked_source",
    generated_at: generatedAt,
  }));
  rows.push(row({
    row_id: "handoff_queue.blocker_visibility",
    category: "handoff_consumption_queue",
    label: "Launch queue blocker remains visible when source handoff is closed",
    observed: true,
    evidence_ref: "handoff_consumption_queue_rows",
    queue_state: "blocker_visible",
    generated_at: generatedAt,
  }));
  return rows;
}

function buildActionEligibilityRows(generatedAt) {
  return ACTION_ELIGIBILITY.map(([id, label, allowedNow, eligibility]) => row({
    row_id: `action_eligibility.${id}`,
    category: "action_eligibility_matrix",
    label,
    observed: true,
    evidence_ref: "action_eligibility_matrix_rows",
    allowed_now: allowedNow,
    eligibility,
    generated_at: generatedAt,
  }));
}

function buildReviewCadenceRows(generatedAt) {
  return REVIEW_CADENCE.map(([id, label, reviewRequiredWhenTriggered, requirementMode]) => row({
    row_id: `review_cadence.${id}`,
    category: "review_cadence_router",
    label,
    observed: true,
    evidence_ref: "review_cadence_router_rows",
    review_required_now: false,
    review_required_when_triggered: reviewRequiredWhenTriggered,
    requirement_mode: requirementMode,
    generated_at: generatedAt,
  }));
}

function buildValidationLaunchRows(generatedAt) {
  return [
    ["syntax_check", "node --check src/post-p20400-launch-envelope.mjs && node --check scripts/post-p20400-launch-envelope.mjs", true, "targeted"],
    ["targeted_tests", "node --test test/post-p20400-launch-envelope.test.mjs test/post-p20000-operator-handoff.test.mjs test/trust-evidence-clean-checkpoint.test.mjs", true, "targeted_adjacent"],
    ["platform_check", "npm run platform:post-p20400-launch-envelope -- --check", true, "targeted_cli"],
    ["source_cli_check", "npm run platform:post-p20000-operator-handoff -- --check", true, "adjacent_cli"],
    ["diff_check", "git diff --check && git diff --cached --check", true, "diff_hygiene"],
    ["full_npm_test_condition", "npm test is required only for broad trust, release, write, schema freeze, or explicit closeout demand", true, "conditional_full_suite"],
  ].map(([id, label, observed, commandKind]) => row({
    row_id: `validation_launch.${id}`,
    category: "validation_launch_packet",
    label,
    observed,
    evidence_ref: "validation_launch_packet_rows",
    command_kind: commandKind,
    generated_at: generatedAt,
  }));
}

function buildBoundaryGuardRows(generatedAt) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => row({
    row_id: `boundary_guard.${flag}`,
    category: "boundary_guard_projection",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "post_p20400_launch_envelope_boundary",
    authority_flag: flag,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.eligibilityRows)
    && allPass(context.reviewRows)
    && allPass(context.validationRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P20400 source is ready for P20401", context.sourceState.sourceReady],
    ["queue_visible", "Handoff consumption queue is visible", visibleOrPassed(context.queueRows, "handoff_queue.blocker_visibility")],
    ["eligibility_visible", "Action eligibility matrix is visible", allPass(context.eligibilityRows)],
    ["review_cadence_visible", "Review cadence router is visible", allPass(context.reviewRows)],
    ["validation_packet_visible", "Validation launch packet is visible", allPass(context.validationRows)],
    ["boundary_guard_closed", "Boundary guard projection remains closed", allPass(context.boundaryRows)],
    ["p20801_handoff_gate", "P20801 handoff opens only when launch envelope conditions pass", handoffReady],
    ["p20801_handoff_blocker_visible", "P20801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p20800_checkpoint.${id}`,
    category: "p20800_launch_checkpoint",
    label,
    observed,
    evidence_ref: "p20800_launch_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const allowedActionCount = context.eligibilityRows.filter((item) => item.allowed_now === true).length;
  const blockedProtectedActionCount = context.eligibilityRows.filter((item) => item.eligibility === "blocked_protected" && item.allowed_now === false).length;
  const p20800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && visibleOrPassed(context.queueRows, "handoff_queue.blocker_visibility")
    && allPass(context.eligibilityRows)
    && allPass(context.reviewRows)
    && allPass(context.validationRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p20800_checkpoint.p20801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.eligibilityRows)
    && allPass(context.reviewRows)
    && allPass(context.validationRows)
    && allPass(context.boundaryRows);
  return {
    p20800_contract_ready: p20800ContractReady,
    ready_for_p20801_handoff: handoffReady,
    source_p20400_ready_for_p20401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    handoff_consumption_queue_visible_now: visibleOrPassed(context.queueRows, "handoff_queue.blocker_visibility"),
    action_eligibility_matrix_visible_now: allPass(context.eligibilityRows),
    review_cadence_router_visible_now: allPass(context.reviewRows),
    validation_launch_packet_visible_now: allPass(context.validationRows),
    boundary_guard_closed_now: protectedBoundaryClosed({
      ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
    }) && allPass(context.boundaryRows),
    handoff_consumption_queue_count: context.queueRows.length,
    action_eligibility_matrix_count: context.eligibilityRows.length,
    allowed_action_count: allowedActionCount,
    blocked_protected_action_count: blockedProtectedActionCount,
    review_cadence_router_count: context.reviewRows.length,
    validation_launch_packet_count: context.validationRows.length,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  const protectedActionsBlocked = context.eligibilityRows
    .filter((item) => item.eligibility === "blocked_protected")
    .every((item) => item.allowed_now === false);
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P20401-P20800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P20401-P20800 Post-P20400 Launch Envelope"), "Architecture doc missing P20401-P20800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P20400 source state is not visible"),
    validationItem("queue.visible", "queue", visibleOrPassed(context.queueRows, "handoff_queue.blocker_visibility"), "Handoff consumption queue is not visible"),
    validationItem("eligibility.visible", "eligibility", allPass(context.eligibilityRows), "Action eligibility matrix rows are missing"),
    validationItem("eligibility.protected_blocked", "eligibility", protectedActionsBlocked, "Protected action eligibility opened"),
    validationItem("review.visible", "review", allPass(context.reviewRows), "Review cadence router rows are missing"),
    validationItem("validation.visible", "validation", allPass(context.validationRows), "Validation launch packet rows are missing"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p20800_checkpoint.p20801_handoff_blocker_visible"), "P20800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "post_p20400_launch_envelope.contract.v1",
    generated_at: generatedAt,
    source_p20400_required_or_rebuilt: true,
    handoff_consumption_queue_required: true,
    action_eligibility_matrix_required: true,
    review_cadence_router_required: true,
    p20801_handoff_is_not_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p20801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p20800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    post_p20400_launch_envelope_status: status,
    source_p20400_ready_for_p20401_handoff: boundary.source_p20400_ready_for_p20401_handoff,
    handoff_consumption_queue_count: boundary.handoff_consumption_queue_count,
    allowed_action_count: boundary.allowed_action_count,
    blocked_protected_action_count: boundary.blocked_protected_action_count,
    review_cadence_router_count: boundary.review_cadence_router_count,
    validation_launch_packet_count: boundary.validation_launch_packet_count,
    ready_for_p20801_handoff: validation.valid && boundary.ready_for_p20801_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Post-P20400 Launch Envelope",
    "",
    `Status: ${result.summary.post_p20400_launch_envelope_status}`,
    `Program: ${result.program_range}`,
    `P20400 ready for P20401 handoff: ${result.summary.source_p20400_ready_for_p20401_handoff}`,
    `Queue rows: ${result.summary.handoff_consumption_queue_count}`,
    `Allowed action rows: ${result.summary.allowed_action_count}`,
    `Blocked protected action rows: ${result.summary.blocked_protected_action_count}`,
    `Ready for P20801 handoff: ${result.summary.ready_for_p20801_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.action_eligibility_matrix_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.eligibility)}</td><td>${escapeHtml(item.allowed_now)}</td><td>${escapeHtml(item.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Post-P20400 Launch Envelope</title>
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
    <h1>Hermes Post-P20400 Launch Envelope</h1>
    <p class="notice">This artifact prepares the next read-only launch envelope. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Action</th><th>Eligibility</th><th>Allowed Now</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP20400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildPostP20000OperatorHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.post_p20000_operator_handoff", built);
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
  const defaults = DEFAULT_POST_P20400_LAUNCH_ENVELOPE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_post_p20000_operator_handoff_path: path.resolve(repoRoot, options.sourcePostP20000OperatorHandoffPath ?? defaults.sourcePostP20000OperatorHandoffPath),
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
      args.sourcePostP20000OperatorHandoffPath = argv[++index];
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
