import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPostP20400LaunchEnvelope } from "./post-p20400-launch-envelope.mjs";

export const DEFAULT_VALIDATION_RUNBOOK_READINESS_OUT_DIR = "artifacts/validation-runbook-readiness/latest";
export const DEFAULT_VALIDATION_RUNBOOK_READINESS_INPUTS = {
  schemaPath: "schemas/validation-runbook-readiness.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p20801-p21200.md",
  architectureDocPath: "docs/architecture.md",
  sourcePostP20400LaunchEnvelopePath: "artifacts/post-p20400-launch-envelope/latest/post-p20400-launch-envelope.json",
};

const COMMAND_NAME = "platform:validation-runbook-readiness";
const SCHEMA_VERSION = "validation-runbook-readiness.v1";
const CAPABILITY_ID = "platform.validation_runbook_readiness";
const PROGRAM_RANGE = "P20801-P21200";
const SOURCE_PROGRAM_RANGE = "P20401-P20800";
const READY_STATUS = "ready_for_validation_runbook_readiness";
const BLOCK_PENDING_STATUS = "valid_block_runbook_readiness_pending";
const BLOCKED_STATUS = "blocked_validation_runbook_readiness";

const PHASE_SPECS = [
  ["P20801-P20840", "P20800 Source Binding", "p20800_source_binding_rows"],
  ["P20841-P20920", "Launch Evidence Queue", "launch_evidence_queue_rows"],
  ["P20921-P21000", "Command Evidence Plan", "command_evidence_plan_rows"],
  ["P21001-P21080", "Review Escalation Rules", "review_escalation_rule_rows"],
  ["P21081-P21140", "No-Action Boundary Runbook", "no_action_boundary_runbook_rows"],
  ["P21141-P21180", "Runbook Operator Projection", "runbook_operator_projection_rows"],
  ["P21181-P21200", "P21200 Clean Checkpoint", "p21200_clean_checkpoint_rows"],
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

const NO_ACTION_BOUNDARIES = [
  ["production_pass", "Production PASS is not a runbook action"],
  ["enterprise_trust", "Enterprise trust is not a runbook action"],
  ["release_deploy", "Release approval and deployment are not runbook actions"],
  ["runtime_write", "Runtime execution and write action are not runbook actions"],
  ["protected_action", "Protected action is not a runbook action"],
  ["connector_raw_secret", "Connector write, raw exposure, and secret read are not runbook actions"],
  ["reviewer_finality", "Reviewer mutation and final automated approval are not runbook actions"],
];

export async function runValidationRunbookReadiness(options = {}) {
  const result = await buildValidationRunbookReadiness(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Validation Runbook Readiness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeValidationRunbookReadiness(result, result.output_dir);
  return result;
}

export async function buildValidationRunbookReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VALIDATION_RUNBOOK_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "postP20400LaunchEnvelope")
    ? normalizeInlineJsonSource("inline.post_p20400_launch_envelope", options.postP20400LaunchEnvelope)
    : await readJsonOrBuildP20800(inputs.source_post_p20400_launch_envelope_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const queueRows = buildLaunchEvidenceQueueRows({ source, sourceState, generatedAt });
  const commandRows = buildCommandEvidencePlanRows({ source, generatedAt });
  const reviewRows = buildReviewEscalationRows({ source, generatedAt });
  const noActionRows = buildNoActionBoundaryRows(generatedAt);
  const operatorRows = buildRunbookOperatorRows({ sourceState, queueRows, commandRows, reviewRows, noActionRows, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, queueRows, commandRows, reviewRows, noActionRows, operatorRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, queueRows, commandRows, reviewRows, noActionRows, operatorRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, queueRows, commandRows, reviewRows, noActionRows, operatorRows, checkpointRows, boundary });
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
      post_p20400_launch_envelope_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_post_p20400_launch_envelope_summary: source.data?.summary ?? null,
    validation_runbook_readiness_contract: buildContract(generatedAt),
    validation_runbook_readiness_phase_rows: phaseRows,
    p20800_source_binding_rows: sourceRows,
    launch_evidence_queue_rows: queueRows,
    command_evidence_plan_rows: commandRows,
    review_escalation_rule_rows: reviewRows,
    no_action_boundary_runbook_rows: noActionRows,
    runbook_operator_projection_rows: operatorRows,
    p21200_clean_checkpoint_rows: checkpointRows,
    validation_runbook_readiness_boundary: boundary,
    validation_runbook_readiness_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "validation_runbook_readiness")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_runbook_readiness_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_runbook_readiness_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeValidationRunbookReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "validation-runbook-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p20800-source-binding-rows.json"), collectionEnvelope("p20800-source-binding-rows.v1", "p20800_source_binding_rows", result.p20800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "launch-evidence-queue-rows.json"), collectionEnvelope("launch-evidence-queue-rows.v1", "launch_evidence_queue_rows", result.launch_evidence_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-evidence-plan-rows.json"), collectionEnvelope("command-evidence-plan-rows.v1", "command_evidence_plan_rows", result.command_evidence_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-escalation-rule-rows.json"), collectionEnvelope("review-escalation-rule-rows.v1", "review_escalation_rule_rows", result.review_escalation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-action-boundary-runbook-rows.json"), collectionEnvelope("no-action-boundary-runbook-rows.v1", "no_action_boundary_runbook_rows", result.no_action_boundary_runbook_rows, result.generated_at));
  await writeJson(path.join(outDir, "runbook-operator-projection-rows.json"), collectionEnvelope("runbook-operator-projection-rows.v1", "runbook_operator_projection_rows", result.runbook_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "p21200-clean-checkpoint-rows.json"), collectionEnvelope("p21200-clean-checkpoint-rows.v1", "p21200_clean_checkpoint_rows", result.p21200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-runbook-readiness-boundary.json"), result.validation_runbook_readiness_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runValidationRunbookReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runValidationRunbookReadiness(args);
  console.log(`Validation Runbook Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.validation_runbook_readiness_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P20800 ready for P20801 handoff: ${result.summary.source_p20800_ready_for_p20801_handoff}`);
  console.log(`Launch evidence queue rows: ${result.summary.launch_evidence_queue_count}`);
  console.log(`Command evidence plan rows: ${result.summary.command_evidence_plan_count}`);
  console.log(`No-action boundary rows: ${result.summary.no_action_boundary_count}`);
  console.log(`Ready for P21201 handoff: ${result.summary.ready_for_p21201_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.post_p20400_launch_envelope_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p20801_handoff === true,
    status: summary.post_p20400_launch_envelope_status ?? "missing",
    p20800ContractReady: boundary.p20800_contract_ready === true,
    queueVisible: boundary.handoff_consumption_queue_visible_now === true,
    eligibilityVisible: boundary.action_eligibility_matrix_visible_now === true,
    reviewVisible: boundary.review_cadence_router_visible_now === true,
    validationPacketVisible: boundary.validation_launch_packet_visible_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p20801-p21200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P20800 post-P20400 launch envelope source is available", sourceState.available],
    ["program_range", "P20800 source program range is P20401-P20800", sourceState.programRangeOk],
    ["validation_valid", "P20800 source validation is valid", sourceState.validationValid],
    ["p20801_handoff_open", "P20800 source opened P20801 handoff", sourceState.sourceReady],
    ["p20800_contract_ready", "P20800 source contract is ready", sourceState.p20800ContractReady],
    ["queue_visible", "P20800 handoff consumption queue is visible", sourceState.queueVisible],
    ["boundary_closed", "P20800 protected authority boundary is closed", sourceState.boundaryClosed],
    ["commit_ref_present", "Current commit ref is present for validation runbook", Boolean(commitRef)],
    ["source_blocker_visible", "P20800 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p20800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildLaunchEvidenceQueueRows({ source, sourceState, generatedAt }) {
  const queueRows = Array.isArray(source.data?.handoff_consumption_queue_rows)
    ? source.data.handoff_consumption_queue_rows
    : [];
  const actionRows = Array.isArray(source.data?.action_eligibility_matrix_rows)
    ? source.data.action_eligibility_matrix_rows
    : [];
  const reviewRows = Array.isArray(source.data?.review_cadence_router_rows)
    ? source.data.review_cadence_router_rows
    : [];
  const rows = [
    ...queueRows.slice(0, 4).map((item, index) => queueRow(`queue.${index + 1}`, item.label ?? item.row_id, sourceState.sourceReady && item.current_verdict === "pass", item.row_id ?? "handoff_consumption_queue_rows", index + 1, generatedAt)),
    ...actionRows.filter((item) => item.allowed_now === true).map((item, index) => queueRow(`action.${index + 1}`, item.label ?? item.row_id, true, item.row_id ?? "action_eligibility_matrix_rows", index + 5, generatedAt)),
    ...reviewRows.filter((item) => item.review_required_when_triggered === true).slice(0, 2).map((item, index) => queueRow(`review.${index + 1}`, item.label ?? item.row_id, true, item.row_id ?? "review_cadence_router_rows", index + 9, generatedAt)),
  ];
  rows.push(row({
    row_id: "launch_evidence_queue.blocker_visibility",
    category: "launch_evidence_queue",
    label: "Launch evidence queue blocker remains visible when source handoff is closed",
    observed: true,
    evidence_ref: "launch_evidence_queue_rows",
    queue_state: "blocker_visible",
    generated_at: generatedAt,
  }));
  return rows;
}

function queueRow(id, label, observed, evidenceRef, order, generatedAt) {
  return row({
    row_id: `launch_evidence_queue.${id}`,
    category: "launch_evidence_queue",
    label,
    observed,
    evidence_ref: evidenceRef,
    queue_order: order,
    queue_state: observed ? "evidence_required" : "blocked_source",
    generated_at: generatedAt,
  });
}

function buildCommandEvidencePlanRows({ source, generatedAt }) {
  const validationRows = Array.isArray(source.data?.validation_launch_packet_rows)
    ? source.data.validation_launch_packet_rows
    : [];
  return validationRows.map((item, index) => row({
    row_id: `command_evidence.${String(item.row_id ?? `row_${index + 1}`).replace(/^validation_launch\./, "")}`,
    category: "command_evidence_plan",
    label: item.label ?? item.row_id,
    observed: item.current_verdict === "pass",
    evidence_ref: item.row_id ?? "validation_launch_packet_rows",
    command_kind: item.command_kind ?? "unknown",
    command_execution_allowed_now: false,
    evidence_plan_state: item.current_verdict === "pass" ? "planned_evidence_only" : "blocked_source",
    generated_at: generatedAt,
  }));
}

function buildReviewEscalationRows({ source, generatedAt }) {
  const reviewRows = Array.isArray(source.data?.review_cadence_router_rows)
    ? source.data.review_cadence_router_rows
    : [];
  return reviewRows.map((item, index) => row({
    row_id: `review_escalation.${String(item.row_id ?? `row_${index + 1}`).replace(/^review_cadence\./, "")}`,
    category: "review_escalation_rule",
    label: item.label ?? item.row_id,
    observed: item.current_verdict === "pass",
    evidence_ref: item.row_id ?? "review_cadence_router_rows",
    review_required_now: item.review_required_now === true,
    review_required_when_triggered: item.review_required_when_triggered === true,
    requirement_mode: item.requirement_mode ?? "unknown",
    generated_at: generatedAt,
  }));
}

function buildNoActionBoundaryRows(generatedAt) {
  return NO_ACTION_BOUNDARIES.map(([id, label]) => row({
    row_id: `no_action_boundary.${id}`,
    category: "no_action_boundary_runbook",
    label,
    observed: true,
    evidence_ref: "no_action_boundary_runbook_rows",
    allowed_now: false,
    boundary_state: "blocked_not_runbook_action",
    generated_at: generatedAt,
  }));
}

function buildRunbookOperatorRows({ sourceState, queueRows, commandRows, reviewRows, noActionRows, generatedAt }) {
  return [
    ["source_status", "Operator can see P20800 source status", sourceState.available, 1, "inspect_source"],
    ["queue_status", "Operator can see launch evidence queue", visibleOrPassed(queueRows, "launch_evidence_queue.blocker_visibility"), 2, "inspect_queue"],
    ["command_plan", "Operator can see command evidence plan without execution authority", allPass(commandRows), 3, "collect_command_evidence"],
    ["review_escalation", "Operator can see review escalation rules", allPass(reviewRows), 4, "route_review_if_high_risk"],
    ["no_action_boundary", "Operator can see protected actions are not runbook actions", allPass(noActionRows), 5, "keep_boundary_closed"],
    ["next_handoff", "Operator can see P21201 handoff blocker state", true, 6, "continue_next_tranche"],
  ].map(([id, label, observed, runOrder, nextAction]) => row({
    row_id: `runbook_operator.${id}`,
    category: "runbook_operator_projection",
    label,
    observed,
    evidence_ref: "runbook_operator_projection_rows",
    run_order: runOrder,
    next_action: nextAction,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.commandRows)
    && allPass(context.reviewRows)
    && allPass(context.noActionRows)
    && allPass(context.operatorRows);
  return [
    ["source_ready", "P20800 source is ready for P20801", context.sourceState.sourceReady],
    ["launch_evidence_queue_visible", "Launch evidence queue is visible", visibleOrPassed(context.queueRows, "launch_evidence_queue.blocker_visibility")],
    ["command_evidence_plan_visible", "Command evidence plan is visible", allPass(context.commandRows)],
    ["review_escalation_visible", "Review escalation rules are visible", allPass(context.reviewRows)],
    ["no_action_boundary_closed", "No-action boundary runbook is closed", allPass(context.noActionRows)],
    ["operator_projection_visible", "Runbook operator projection is visible", allPass(context.operatorRows)],
    ["p21201_handoff_gate", "P21201 handoff opens only when validation runbook readiness conditions pass", handoffReady],
    ["p21201_handoff_blocker_visible", "P21201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p21200_checkpoint.${id}`,
    category: "p21200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p21200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p21200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && visibleOrPassed(context.queueRows, "launch_evidence_queue.blocker_visibility")
    && allPass(context.commandRows)
    && allPass(context.reviewRows)
    && allPass(context.noActionRows)
    && allPass(context.operatorRows)
    && visibleOrPassed(context.checkpointRows, "p21200_checkpoint.p21201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.commandRows)
    && allPass(context.reviewRows)
    && allPass(context.noActionRows)
    && allPass(context.operatorRows);
  return {
    p21200_contract_ready: p21200ContractReady,
    ready_for_p21201_handoff: handoffReady,
    source_p20800_ready_for_p20801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    launch_evidence_queue_visible_now: visibleOrPassed(context.queueRows, "launch_evidence_queue.blocker_visibility"),
    command_evidence_plan_visible_now: allPass(context.commandRows),
    review_escalation_rules_visible_now: allPass(context.reviewRows),
    no_action_boundary_closed_now: allPass(context.noActionRows),
    runbook_operator_projection_visible_now: allPass(context.operatorRows),
    launch_evidence_queue_count: context.queueRows.length,
    command_evidence_plan_count: context.commandRows.length,
    review_escalation_rule_count: context.reviewRows.length,
    no_action_boundary_count: context.noActionRows.length,
    runbook_operator_projection_count: context.operatorRows.length,
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P20801-P21200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P20801-P21200 Validation Runbook Readiness"), "Architecture doc missing P20801-P21200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P20800 source state is not visible"),
    validationItem("queue.visible", "queue", visibleOrPassed(context.queueRows, "launch_evidence_queue.blocker_visibility"), "Launch evidence queue is not visible"),
    validationItem("commands.planned", "validation", allPass(context.commandRows), "Command evidence plan rows are missing"),
    validationItem("commands.no_execution", "validation", context.commandRows.every((item) => item.command_execution_allowed_now === false), "Command execution opened"),
    validationItem("review.visible", "review", allPass(context.reviewRows), "Review escalation rows are missing"),
    validationItem("no_action.closed", "authority", context.noActionRows.every((item) => item.allowed_now === false), "No-action boundary opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p21200_checkpoint.p21201_handoff_blocker_visible"), "P21200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "validation_runbook_readiness.contract.v1",
    generated_at: generatedAt,
    source_p20800_required_or_rebuilt: true,
    launch_evidence_queue_required: true,
    command_evidence_plan_required: true,
    review_escalation_rules_required: true,
    p21201_handoff_is_not_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p21201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p21200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    validation_runbook_readiness_status: status,
    source_p20800_ready_for_p20801_handoff: boundary.source_p20800_ready_for_p20801_handoff,
    launch_evidence_queue_count: boundary.launch_evidence_queue_count,
    command_evidence_plan_count: boundary.command_evidence_plan_count,
    review_escalation_rule_count: boundary.review_escalation_rule_count,
    no_action_boundary_count: boundary.no_action_boundary_count,
    ready_for_p21201_handoff: validation.valid && boundary.ready_for_p21201_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Validation Runbook Readiness",
    "",
    `Status: ${result.summary.validation_runbook_readiness_status}`,
    `Program: ${result.program_range}`,
    `P20800 ready for P20801 handoff: ${result.summary.source_p20800_ready_for_p20801_handoff}`,
    `Launch evidence queue rows: ${result.summary.launch_evidence_queue_count}`,
    `Command evidence plan rows: ${result.summary.command_evidence_plan_count}`,
    `No-action boundary rows: ${result.summary.no_action_boundary_count}`,
    `Ready for P21201 handoff: ${result.summary.ready_for_p21201_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.command_evidence_plan_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.command_kind)}</td><td>${escapeHtml(item.command_execution_allowed_now)}</td><td>${escapeHtml(item.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Validation Runbook Readiness</title>
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
    <h1>Hermes Validation Runbook Readiness</h1>
    <p class="notice">This artifact defines required command evidence, not command execution. It does not create production PASS, enterprise trust, deployment, execution, write authority, connector mutation, raw exposure, reviewer mutation, or final approval.</p>
    <table><thead><tr><th>Command Evidence</th><th>Kind</th><th>Execution Allowed Now</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP20800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildPostP20400LaunchEnvelope({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.post_p20400_launch_envelope", built);
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
  const defaults = DEFAULT_VALIDATION_RUNBOOK_READINESS_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_post_p20400_launch_envelope_path: path.resolve(repoRoot, options.sourcePostP20400LaunchEnvelopePath ?? defaults.sourcePostP20400LaunchEnvelopePath),
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
      args.sourcePostP20400LaunchEnvelopePath = argv[++index];
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
