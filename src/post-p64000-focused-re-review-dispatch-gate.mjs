import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_DISPATCH_GATE_OUT_DIR =
  "artifacts/post-p64000-focused-re-review-dispatch-gate/latest";
export const DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_DISPATCH_GATE_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-re-review-dispatch-gate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p71201-p71600.md",
  architectureDocPath: "docs/architecture.md",
  strictPlanPath:
    "artifacts/post-p64000-focused-strict-remediation-plan/latest/post-p64000-focused-strict-remediation-plan.json",
  strictPlanRowsPath:
    "artifacts/post-p64000-focused-strict-remediation-plan/latest/strict-remediation-plan-rows.json",
  dispatchReadinessRowsPath:
    "artifacts/post-p64000-focused-strict-remediation-plan/latest/re-review-dispatch-readiness-rows.json",
  evidenceRequirementRowsPath:
    "artifacts/post-p64000-focused-strict-remediation-plan/latest/evidence-requirement-rows.json",
  strictPlanPacketPath:
    "artifacts/post-p64000-focused-strict-remediation-plan/latest/strict-remediation-plan-packet.md",
};

const COMMAND_NAME = "platform:post-p64000-focused-re-review-dispatch-gate";
const SCHEMA_VERSION = "post-p64000-focused-re-review-dispatch-gate.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_re_review_dispatch_gate";
const PROGRAM_RANGE = "P71201-P71600";
const SOURCE_PROGRAM_RANGE = "P70801-P71200";
const REVIEW_SOURCE_PROGRAM_RANGE = "P70401-P70800";
const NEXT_PROGRAM_RANGE = "P71601-P72000";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p71200_strict_plan_source",
  "p71200_strict_plan_invalid",
  "missing_strict_plan_rows",
  "missing_re_review_dispatch_readiness_rows",
  "missing_evidence_requirement_rows",
  "missing_strict_remediation_packet",
  "missing_required_hrm_dispatch_row",
  "dispatch_packet_counted_as_review_evidence",
  "raw_capture_claimed_before_capture",
  "auth_failure_counted_as_evidence",
  "timeout_or_hang_counted_as_evidence",
  "malformed_output_counted_as_evidence",
  "tool_call_shaped_output_counted_as_review",
  "reviewer_completion_claim",
  "finding_fixed_claim",
  "finding_verified_claim",
  "finding_resolved_claim",
  "source_mutation_claim",
  "patch_apply_claim",
  "write_action_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "final_approval_claim",
  "missing_durable_raw_capture_gate",
  "missing_p71601_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "dispatch_packet_counted_as_review_now",
  "raw_capture_claimed_before_capture_now",
  "durable_raw_json_captured_now",
  "review_evidence_counted_now",
  "auth_failure_counted_as_evidence_now",
  "timeout_or_hang_counted_as_evidence_now",
  "malformed_output_counted_as_evidence_now",
  "tool_call_output_counted_as_review_now",
  "focused_re_review_completed_now",
  "reviewer_completion_claim_allowed_now",
  "finding_status_fixed_allowed_now",
  "finding_status_verified_allowed_now",
  "finding_status_resolved_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_dispatch_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_dispatch_allowed_now",
  "post_p71600_production_pass_claim_allowed_now",
  "post_p71600_enterprise_pass_claim_allowed_now",
  "post_p71600_final_approval_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-re-review-dispatch-gate.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-re-review-dispatch-gate.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-re-review-dispatch-gate.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-re-review-dispatch-gate -- --check"],
  [
    "adjacent.p71200",
    "node --test test/post-p64000-focused-strict-remediation-plan.test.mjs test/post-p64000-focused-re-review-dispatch-gate.test.mjs",
  ],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  [
    "package.schema.json",
    "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-re-review-dispatch-gate.schema.json\", \"utf8\"));'",
  ],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedReReviewDispatchGate(options = {}) {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused re-review dispatch gate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedReReviewDispatchGate(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedReReviewDispatchGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_DISPATCH_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const strictPlan = Object.prototype.hasOwnProperty.call(options, "strictPlan")
    ? normalizeInlineJsonSource("inline.p71200_strict_plan", options.strictPlan)
    : await readJsonSource(inputs.strict_plan_path);
  const strictPlanRows = Object.prototype.hasOwnProperty.call(options, "strictPlanRows")
    ? normalizeInlineJsonSource("inline.strict_plan_rows", options.strictPlanRows)
    : await readJsonSource(inputs.strict_plan_rows_path);
  const dispatchReadinessRows = Object.prototype.hasOwnProperty.call(options, "dispatchReadinessRows")
    ? normalizeInlineJsonSource("inline.dispatch_readiness_rows", options.dispatchReadinessRows)
    : await readJsonSource(inputs.dispatch_readiness_rows_path);
  const evidenceRequirementRows = Object.prototype.hasOwnProperty.call(options, "evidenceRequirementRows")
    ? normalizeInlineJsonSource("inline.evidence_requirement_rows", options.evidenceRequirementRows)
    : await readJsonSource(inputs.evidence_requirement_rows_path);
  const strictPlanPacket = Object.prototype.hasOwnProperty.call(options, "strictPlanPacket")
    ? normalizeInlineTextSource("inline.strict_plan_packet", options.strictPlanPacket)
    : await readTextSource(inputs.strict_plan_packet_path);

  const sourceRows = buildSourceRows({ strictPlan, strictPlanRows, dispatchReadinessRows, evidenceRequirementRows, strictPlanPacket, generatedAt });
  const dispatchPacketRows = buildDispatchPacketRows({ dispatchReadinessRows, strictPlanPacket, generatedAt });
  const rawCaptureGateRows = buildRawCaptureGateRows({ dispatchPacketRows, generatedAt });
  const evidenceGuardRows = buildEvidenceCountingGuardRows({ generatedAt });
  const failureModeRows = buildFailureModeGuardRows({ generatedAt });
  const authorityRows = buildAuthorityRows({ overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, dispatchPacketRows, rawCaptureGateRows, evidenceGuardRows, failureModeRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, rawCaptureGateRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, dispatchPacketRows, rawCaptureGateRows, evidenceGuardRows, failureModeRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, dispatchPacketRows, rawCaptureGateRows, evidenceGuardRows, failureModeRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      strict_plan_path: strictPlan.path,
      strict_plan_rows_path: strictPlanRows.path,
      dispatch_readiness_rows_path: dispatchReadinessRows.path,
      evidence_requirement_rows_path: evidenceRequirementRows.path,
      strict_plan_packet_path: strictPlanPacket.path,
    },
    post_p64000_focused_re_review_dispatch_gate_contract: {
      contract_id: "post_p64000_focused_re_review_dispatch_gate",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      prepares_dispatch_packet: true,
      prepares_raw_capture_gate: true,
      reviewer: "claude-code-opus-max",
      reviewer_lane: "independent_read_only",
      required_receipt_type: "durable_raw_json",
      dispatch_packet_is_review_evidence: false,
      durable_raw_json_captured: false,
      review_evidence_counted: false,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      patch_apply_allowed: false,
      write_action_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      final_approval_allowed: false,
      generated_at: generatedAt,
    },
    p71200_strict_plan_source_rows: sourceRows,
    focused_re_review_dispatch_packet_rows: dispatchPacketRows,
    durable_raw_capture_gate_rows: rawCaptureGateRows,
    evidence_counting_guard_rows: evidenceGuardRows,
    failure_mode_guard_rows: failureModeRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p71600_wiring_rows: wiringRows,
    p71600_closeout_rows: closeoutRows,
    p71601_handoff_rows: handoffRows,
    post_p64000_focused_re_review_dispatch_gate_boundary: boundary,
    post_p64000_focused_re_review_dispatch_gate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.focused_re_review_dispatch_packet_markdown = renderDispatchPacket(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_re_review_dispatch_gate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_re_review_dispatch_gate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_re_review_dispatch_gate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.focused_re_review_dispatch_packet_markdown = renderDispatchPacket(result);
  return result;
}

export async function writePostP64000FocusedReReviewDispatchGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-re-review-dispatch-gate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-re-review-dispatch-packet-rows.json"), collectionEnvelope("focused-re-review-dispatch-packet-rows.v1", "focused_re_review_dispatch_packet_rows", result.focused_re_review_dispatch_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "durable-raw-capture-gate-rows.json"), collectionEnvelope("durable-raw-capture-gate-rows.v1", "durable_raw_capture_gate_rows", result.durable_raw_capture_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-counting-guard-rows.json"), collectionEnvelope("evidence-counting-guard-rows.v1", "evidence_counting_guard_rows", result.evidence_counting_guard_rows, result.generated_at));
  await writeFile(path.join(outDir, "focused-re-review-dispatch-packet.md"), result.focused_re_review_dispatch_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedReReviewDispatchGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedReReviewDispatchGate(args);
  console.log(`Post-P64000 focused re-review dispatch gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_re_review_dispatch_gate_status}`);
  console.log(`P71200 source ready: ${result.summary.p71200_strict_plan_ready_now}`);
  console.log(`Dispatch packet ready: ${result.summary.focused_re_review_dispatch_packet_ready_now}`);
  console.log(`Raw capture gate ready: ${result.summary.durable_raw_capture_gate_ready_now}`);
  console.log(`Ready for P71601 handoff: ${result.summary.ready_for_p71601_handoff}`);
  console.log(`Durable raw JSON captured: ${result.summary.durable_raw_json_captured_now}`);
  console.log(`Review evidence counted: ${result.summary.review_evidence_counted_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function normalizeInputs(options) {
  const raw = { ...DEFAULT_POST_P64000_FOCUSED_RE_REVIEW_DISPATCH_GATE_INPUTS, ...(options.inputs ?? {}) };
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: resolveInputPath(repoRoot, raw.schemaPath),
    package_path: resolveInputPath(repoRoot, raw.packagePath),
    roadmap_doc_path: resolveInputPath(repoRoot, raw.roadmapDocPath),
    architecture_doc_path: resolveInputPath(repoRoot, raw.architectureDocPath),
    strict_plan_path: resolveInputPath(repoRoot, raw.strictPlanPath),
    strict_plan_rows_path: resolveInputPath(repoRoot, raw.strictPlanRowsPath),
    dispatch_readiness_rows_path: resolveInputPath(repoRoot, raw.dispatchReadinessRowsPath),
    evidence_requirement_rows_path: resolveInputPath(repoRoot, raw.evidenceRequirementRowsPath),
    strict_plan_packet_path: resolveInputPath(repoRoot, raw.strictPlanPacketPath),
  };
}

function buildSourceRows({ strictPlan, strictPlanRows, dispatchReadinessRows, evidenceRequirementRows, strictPlanPacket, generatedAt }) {
  const summary = strictPlan.data?.summary ?? {};
  return [
    row("source.p71200_available", "p71200_strict_plan_source", "P71200 strict plan artifact is available", strictPlan.available, strictPlan.path, generatedAt),
    row("source.p71200_valid", "p71200_strict_plan_source", "P71200 strict plan validation passed", strictPlan.data?.validation?.valid === true, strictPlan.path, generatedAt),
    row("source.p71200_handoff", "p71200_strict_plan_source", "P71200 is ready for P71201 handoff", summary.ready_for_p71201_handoff === true, strictPlan.path, generatedAt),
    row("source.strict_plan_rows", "p71200_strict_plan_source", "Strict plan rows are available", collectionPass(strictPlanRows, "strict_remediation_plan_rows"), strictPlanRows.path, generatedAt),
    row("source.dispatch_readiness_rows", "p71200_strict_plan_source", "Re-review dispatch readiness rows are available", collectionPass(dispatchReadinessRows, "re_review_dispatch_readiness_rows"), dispatchReadinessRows.path, generatedAt),
    row("source.evidence_requirement_rows", "p71200_strict_plan_source", "Evidence requirement rows are available", collectionPass(evidenceRequirementRows, "evidence_requirement_rows"), evidenceRequirementRows.path, generatedAt),
    row("source.strict_plan_packet", "p71200_strict_plan_source", "Strict remediation plan packet is available", strictPlanPacket.available && strictPlanPacket.text.includes("Focused Strict Remediation Plan Packet"), strictPlanPacket.path, generatedAt),
    row("source.source_has_no_review_evidence", "p71200_strict_plan_source", "P71200 source did not observe re-review evidence", summary.re_review_evidence_observed_now === false, strictPlan.path, generatedAt),
  ];
}

function buildDispatchPacketRows({ dispatchReadinessRows, strictPlanPacket, generatedAt }) {
  const rows = Array.isArray(dispatchReadinessRows.data?.rows) ? dispatchReadinessRows.data.rows : [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const source = rows.find((item) => item?.finding_id === findingId);
    const ready = source?.current_verdict === "pass" && source?.dispatch_status === "ready_to_dispatch_not_reviewed" && strictPlanPacket.available;
    return row(`dispatch_packet.${normalizeId(findingId)}`, "focused_re_review_dispatch_packet", `${findingId} focused re-review dispatch packet is ready`, ready, strictPlanPacket.path, generatedAt, {
      finding_id: findingId,
      dispatch_status: "ready_to_dispatch_not_reviewed",
      reviewer: "claude-code-opus-max",
      reviewer_lane: "independent_read_only",
      required_receipt_type: "durable_raw_json",
      dispatch_packet_is_review_evidence: false,
      reviewer_completion_observed_now: false,
      next_allowed_action: "run_read_only_claude_re_review_and_capture_durable_raw_json",
    });
  });
}

function buildRawCaptureGateRows({ dispatchPacketRows, generatedAt }) {
  return dispatchPacketRows.map((dispatchRow) =>
    row(`raw_capture_gate.${normalizeId(dispatchRow.finding_id)}`, "durable_raw_capture_gate", `${dispatchRow.finding_id} durable raw JSON capture gate is ready`, dispatchRow.current_verdict === "pass", "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet.md", generatedAt, {
      finding_id: dispatchRow.finding_id,
      capture_required_now: true,
      durable_raw_json_captured_now: false,
      review_evidence_counted_now: false,
      acceptable_wrapper_type: "claude_code_result_json",
      required_payload_shape: "focused_hrm_re_review_findings",
      next_allowed_action: "capture_actual_claude_code_result_json_before_normalization",
    }),
  );
}

function buildEvidenceCountingGuardRows({ generatedAt }) {
  return [
    ["dispatch_packet_counted_as_review_now", "Dispatch packet cannot count as review evidence"],
    ["raw_capture_claimed_before_capture_now", "Raw capture cannot be claimed before durable raw JSON exists"],
    ["durable_raw_json_captured_now", "Durable raw JSON is not captured in P71600"],
    ["review_evidence_counted_now", "Review evidence is not counted in P71600"],
    ["focused_re_review_completed_now", "Focused re-review is not completed in P71600"],
  ].map(([flag, label]) =>
    row(`evidence_guard.${flag}`, "evidence_counting_guard", label, true, "docs/hermes-roadmap-p71201-p71600.md", generatedAt, {
      flag,
      observed: false,
      next_allowed_action: "require_valid_p71601_raw_capture_before_evidence_counting",
    }),
  );
}

function buildFailureModeGuardRows({ generatedAt }) {
  return [
    "auth_failure_counted_as_evidence_now",
    "timeout_or_hang_counted_as_evidence_now",
    "malformed_output_counted_as_evidence_now",
    "tool_call_output_counted_as_review_now",
  ].map((flag) =>
    row(`failure_mode.${flag}`, "failure_mode_guard", `${flag} remains false`, true, "test/post-p64000-focused-re-review-dispatch-gate.test.mjs", generatedAt, {
      flag,
      observed: false,
      next_allowed_action: "reject_invalid_claude_output_as_review_evidence",
    }),
  );
}

function buildAuthorityRows({ overrides = {}, generatedAt }) {
  return [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => {
    const observed = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, observed === false, "docs/hermes-roadmap-p71201-p71600.md", generatedAt, { flag, observed });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) =>
    row(`negative.${fixtureId}`, "negative_fixture_contract", `${fixtureId} is covered`, true, "test/post-p64000-focused-re-review-dispatch-gate.test.mjs", generatedAt, { fixture_id: fixtureId }),
  );
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([id, command]) =>
    row(`validation.${id}`, "validation_command", `${id} command is defined`, true, "docs/hermes-roadmap-p71201-p71600.md", generatedAt, { command }),
  );
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-re-review-dispatch-gate.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P71201-P71600 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P71201-P71600") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p71201-p71600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P71201-P71600 focused re-review dispatch gate", architectureDoc.available && architectureDoc.text.includes("P71201-P71600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const {
    sourceRows,
    dispatchPacketRows,
    rawCaptureGateRows,
    evidenceGuardRows,
    failureModeRows,
    authorityRows,
    negativeRows,
    validationRows,
    wiringRows,
    generatedAt,
  } = parts;
  return [
    closeoutRow("p71600.source_ready", "P71200 source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p71600.dispatch_packet_ready", "Focused re-review dispatch packet rows are ready", dispatchPacketRows.every(pass), generatedAt),
    closeoutRow("p71600.raw_capture_gate_ready", "Durable raw capture gate rows are ready", rawCaptureGateRows.every(pass), generatedAt),
    closeoutRow("p71600.evidence_guard_ready", "Evidence counting guard rows are ready", evidenceGuardRows.every(pass), generatedAt),
    closeoutRow("p71600.failure_mode_guard_ready", "Failure mode guard rows are ready", failureModeRows.every(pass), generatedAt),
    closeoutRow("p71600.authority_closed", "Authority false flags remain closed", authorityRows.every(pass), generatedAt),
    closeoutRow("p71600.negative_fixtures_present", "Negative fixture contract rows are present", negativeRows.length === NEGATIVE_FIXTURES.length && negativeRows.every(pass), generatedAt),
    closeoutRow("p71600.validation_commands_present", "Validation command rows are present", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every(pass), generatedAt),
    closeoutRow("p71600.wiring_ready", "Package/docs wiring is ready", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, rawCaptureGateRows, generatedAt }) {
  const ready = closeoutRows.every(pass) && rawCaptureGateRows.every(pass);
  return [
    row("handoff.p71601_actual_raw_capture", "p71601_handoff", "P71601 may capture actual focused re-review raw JSON, but must block without valid raw evidence", ready, "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/focused-re-review-dispatch-packet.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
      next_allowed_action: "capture_actual_focused_re_review_raw_json_or_block_if_missing",
      durable_raw_json_captured_now: false,
      review_evidence_counted_now: false,
      clean_checkpoint_allowed_now: false,
    }),
  ];
}

function buildBoundary(parts) {
  const allRows = [
    ...parts.sourceRows,
    ...parts.dispatchPacketRows,
    ...parts.rawCaptureGateRows,
    ...parts.evidenceGuardRows,
    ...parts.failureModeRows,
    ...parts.authorityRows,
    ...parts.negativeRows,
    ...parts.validationRows,
    ...parts.wiringRows,
    ...parts.closeoutRows,
    ...parts.handoffRows,
  ];
  const falseFlags = Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, false]));
  return {
    ...falseFlags,
    p71200_strict_plan_ready_now: parts.sourceRows.every(pass),
    focused_re_review_dispatch_packet_ready_now: parts.dispatchPacketRows.every(pass),
    durable_raw_capture_gate_ready_now: parts.rawCaptureGateRows.every(pass),
    evidence_counting_guard_ready_now: parts.evidenceGuardRows.every(pass),
    failure_mode_guard_ready_now: parts.failureModeRows.every(pass),
    ready_for_p71601_handoff: parts.handoffRows.every(pass),
    finding_count: parts.dispatchPacketRows.length,
    all_rows_pass_now: allRows.every(pass),
    durable_raw_json_captured_now: false,
    review_evidence_counted_now: false,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  };
}

function buildValidationItems(parts) {
  const items = [];
  for (const [name, rows] of [
    ["source", parts.sourceRows],
    ["dispatch_packet", parts.dispatchPacketRows],
    ["raw_capture_gate", parts.rawCaptureGateRows],
    ["evidence_guard", parts.evidenceGuardRows],
    ["failure_mode", parts.failureModeRows],
    ["authority", parts.authorityRows],
    ["negative", parts.negativeRows],
    ["validation", parts.validationRows],
    ["wiring", parts.wiringRows],
    ["closeout", parts.closeoutRows],
    ["handoff", parts.handoffRows],
  ]) {
    rows.forEach((item) => {
      if (!pass(item)) items.push(validationItem(`${name}.${item.row_id}`, name, false, item.block_reason ?? item.label));
    });
  }
  if (parts.negativeRows.length !== NEGATIVE_FIXTURES.length) {
    items.push(validationItem("negative.coverage", "negative", false, "All negative fixture rows must be present"));
  }
  if (parts.boundary.durable_raw_json_captured_now !== false || parts.boundary.review_evidence_counted_now !== false) {
    items.push(validationItem("boundary.evidence_counting", "authority", false, "Raw capture and review evidence counting must remain false in P71600"));
  }
  if (parts.boundary.clean_checkpoint_allowed_now !== false || parts.boundary.final_approval_enabled !== false) {
    items.push(validationItem("boundary.finality", "authority", false, "Clean checkpoint and final approval must remain false"));
  }
  if (items.length === 0) items.push(validationItem("all.pass", "aggregate", true, "All P71201-P71600 validation rows passed"));
  return items;
}

function buildSummary({ boundary, validation }) {
  return {
    post_p64000_focused_re_review_dispatch_gate_status:
      validation.valid && boundary.ready_for_p71601_handoff
        ? "focused_re_review_dispatch_gate_ready_for_p71601"
        : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    review_source_program_range: REVIEW_SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p71200_strict_plan_ready_now: boundary.p71200_strict_plan_ready_now,
    focused_re_review_dispatch_packet_ready_now: boundary.focused_re_review_dispatch_packet_ready_now,
    durable_raw_capture_gate_ready_now: boundary.durable_raw_capture_gate_ready_now,
    evidence_counting_guard_ready_now: boundary.evidence_counting_guard_ready_now,
    failure_mode_guard_ready_now: boundary.failure_mode_guard_ready_now,
    ready_for_p71601_handoff: boundary.ready_for_p71601_handoff,
    finding_count: boundary.finding_count,
    durable_raw_json_captured_now: boundary.durable_raw_json_captured_now,
    review_evidence_counted_now: boundary.review_evidence_counted_now,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    validation_error_count: validation.error_count,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# P71201-P71600 Focused Re-Review Dispatch Gate",
    "",
    `Status: ${summary.post_p64000_focused_re_review_dispatch_gate_status}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    `Dispatch packet ready: ${summary.focused_re_review_dispatch_packet_ready_now}`,
    `Raw capture gate ready: ${summary.durable_raw_capture_gate_ready_now}`,
    `Ready for P71601 handoff: ${summary.ready_for_p71601_handoff}`,
    "",
    "## Evidence Boundary",
    "",
    `Durable raw JSON captured: ${summary.durable_raw_json_captured_now}`,
    `Review evidence counted: ${summary.review_evidence_counted_now}`,
    `Clean checkpoint allowed: ${summary.clean_checkpoint_allowed_now}`,
    `Production PASS enabled: ${summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${summary.enterprise_pass_enabled}`,
    `Final approval enabled: ${summary.final_approval_enabled}`,
    "",
    "## Next Action",
    "",
    "Run a read-only Claude focused re-review and capture actual durable raw JSON in the next tranche. Missing, malformed, auth-failure, timeout, hang, or tool-call-shaped output must remain BLOCK.",
    "",
  ].join("\n");
}

function renderDispatchPacket(result) {
  const lines = [
    "# Focused Re-Review Dispatch Packet",
    "",
    `Program: ${result.program_range}`,
    `Source: ${result.source_program_range}`,
    `Next: ${result.next_program_range}`,
    "",
    "## Required Reviewer",
    "",
    "- reviewer: claude-code-opus-max",
    "- lane: independent_read_only",
    "- receipt: durable_raw_json",
    "",
    "## Finding Scope",
    "",
  ];
  for (const item of result.focused_re_review_dispatch_packet_rows) {
    lines.push(`- ${item.finding_id}: ${item.dispatch_status}; next=${item.next_allowed_action}`);
  }
  lines.push("", "## Boundary", "", "This packet is not review evidence. It authorizes no mutation and no final approval. P71601 must capture actual durable raw JSON or remain blocked.", "");
  return lines.join("\n");
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const current = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: current,
    current_verdict: current ? "pass" : "block",
    evidence_ref: evidenceRef ?? null,
    output_ref: null,
    block_reason: current ? null : label,
    next_allowed_action: extra.next_allowed_action ?? null,
    generated_at: generatedAt,
    ...extra,
  };
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p71600_closeout", label, observed, "artifacts/post-p64000-focused-re-review-dispatch-gate/latest/post-p64000-focused-re-review-dispatch-gate.json", generatedAt);
}

function validationItem(id, category, valid, message) {
  return { id, category, valid, message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.valid === false).map((item) => ({ path: item.id, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function pass(item) {
  return item?.current_verdict === "pass";
}

function collectionPass(source, collectionName) {
  return source.available && source.data?.collection === collectionName && Array.isArray(source.data?.rows) && source.data.rows.length >= REQUIRED_HRM_IDS.length;
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, collection, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, focused_re_review_dispatch_packet_markdown: packet, ...serializable } = result;
  return serializable;
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: filePath, available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, error: error.message, text: "" };
  }
}

function normalizeInlineJsonSource(name, data) {
  return { path: name, available: true, text: JSON.stringify(data), data };
}

function normalizeInlineTextSource(name, text) {
  return { path: name, available: true, text: String(text ?? "") };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function resolveInputPath(repoRoot, inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(repoRoot, inputPath);
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const args = { check: false, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--repo-root") {
      args.repoRoot = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`${COMMAND_NAME}

Usage:
  npm run ${COMMAND_NAME}
  npm run ${COMMAND_NAME} -- --check

Options:
  --check       Validate without writing artifacts.
  --out-dir    Override output directory.
  --repo-root  Override repository root for source refs.
`);
}
