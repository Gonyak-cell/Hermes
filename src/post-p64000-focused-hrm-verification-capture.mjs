import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_CAPTURE_OUT_DIR = "artifacts/post-p64000-focused-hrm-verification-capture/latest";
export const DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_CAPTURE_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-hrm-verification-capture.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p68401-p68800.md",
  architectureDocPath: "docs/architecture.md",
  p68400PlanPath: "artifacts/post-p64000-focused-hrm-remediation-plan/latest/post-p64000-focused-hrm-remediation-plan.json",
  packetPath: "artifacts/post-p64000-focused-hrm-remediation-plan/latest/focused-hrm-verification-packet.md",
  verificationRowsPath: "artifacts/post-p64000-focused-hrm-remediation-plan/latest/verification-packet-rows.json",
  focusedPlanRowsPath: "artifacts/post-p64000-focused-hrm-remediation-plan/latest/focused-hrm-plan-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-hrm-verification-capture";
const SCHEMA_VERSION = "post-p64000-focused-hrm-verification-capture.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_hrm_verification_capture";
const PROGRAM_RANGE = "P68401-P68800";
const SOURCE_PROGRAM_RANGE = "P68001-P68400";
const NEXT_PROGRAM_RANGE = "P68801-P69200";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p68400_source",
  "p68400_not_ready_for_handoff",
  "missing_focused_verification_packet",
  "missing_verification_packet_row",
  "candidate_digest_mismatch",
  "missing_candidate_artifact",
  "candidate_validation_invalid",
  "focused_evidence_claims_fixed",
  "focused_evidence_claims_verified",
  "finding_auto_resolved",
  "missing_per_hrm_evidence_row",
  "missing_future_normalization_handoff",
  "raw_claude_failure_counted_as_evidence",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "patch_apply_claim",
  "write_action_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "codex_final_approval_claim",
  "claude_final_approval_claim",
  "final_automated_approval_claim",
];

const EXTRA_FALSE_FLAGS = [
  "focused_verification_review_event_completed_now",
  "focused_verification_fixed_claim_allowed_now",
  "focused_verification_verified_claim_allowed_now",
  "focused_verification_verdict_claim_allowed_now",
  "focused_verification_raw_claude_failure_counted_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_capture_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_capture_allowed_now",
  "post_p68800_production_pass_claim_allowed_now",
  "post_p68800_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-hrm-verification-capture.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-hrm-verification-capture.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-hrm-verification-capture.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-hrm-verification-capture -- --check"],
  ["adjacent.p68400", "node --test test/post-p64000-focused-hrm-remediation-plan.test.mjs test/post-p64000-focused-hrm-verification-capture.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-hrm-verification-capture.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedHrmVerificationCapture(options = {}) {
  const result = await buildPostP64000FocusedHrmVerificationCapture(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused HRM verification capture failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedHrmVerificationCapture(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedHrmVerificationCapture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_CAPTURE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const p68400Plan = Object.prototype.hasOwnProperty.call(options, "p68400Plan")
    ? normalizeInlineJsonSource("inline.p68400_plan", options.p68400Plan)
    : await readJsonSource(inputs.p68400_plan_path);
  const packet = Object.prototype.hasOwnProperty.call(options, "packetText")
    ? normalizeInlineTextSource("inline.focused_hrm_verification_packet", options.packetText)
    : await readTextSource(inputs.packet_path);
  const verificationRows = Object.prototype.hasOwnProperty.call(options, "verificationRows")
    ? normalizeInlineJsonSource("inline.verification_packet_rows", options.verificationRows)
    : await readJsonSource(inputs.verification_rows_path);
  const focusedPlanRows = Object.prototype.hasOwnProperty.call(options, "focusedPlanRows")
    ? normalizeInlineJsonSource("inline.focused_plan_rows", options.focusedPlanRows)
    : await readJsonSource(inputs.focused_plan_rows_path);
  const candidateSources = await readCandidateSources({
    repoRoot: inputs.repo_root,
    p68400Plan,
    overrides: options.candidateSources,
  });

  const sourceRows = buildSourceRows({ p68400Plan, packet, verificationRows, focusedPlanRows, generatedAt });
  const evidenceRows = buildFocusedVerificationEvidenceRows({ p68400Plan, candidateSources, generatedAt });
  const digestRows = buildCandidateDigestMatchRows({ p68400Plan, candidateSources, generatedAt });
  const eventBoundaryRows = buildVerificationEventBoundaryRows({ p68400Plan, evidenceRows, generatedAt });
  const stateRows = buildFindingStateContinuityRows({ p68400Plan, evidenceRows, generatedAt });
  const authorityRows = buildAuthorityRows({ p68400Plan, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, evidenceRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p68400Plan });
  const validationItems = buildValidationItems({ sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      p68400_plan_path: p68400Plan.path,
      packet_path: packet.path,
      verification_rows_path: verificationRows.path,
      focused_plan_rows_path: focusedPlanRows.path,
    },
    post_p64000_focused_hrm_verification_capture_contract: {
      contract_id: "post_p64000_focused_hrm_verification_capture",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      captures_candidate_source_evidence: true,
      captures_candidate_digests: true,
      captures_focused_questions: true,
      focused_review_event_completed: false,
      raw_claude_review_counted_as_evidence: false,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      patch_apply_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p68400_source_binding_rows: sourceRows,
    focused_verification_evidence_rows: evidenceRows,
    candidate_digest_match_rows: digestRows,
    verification_event_boundary_rows: eventBoundaryRows,
    finding_state_continuity_rows: stateRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p68800_wiring_rows: wiringRows,
    p68800_closeout_rows: closeoutRows,
    p68801_handoff_rows: handoffRows,
    post_p64000_focused_hrm_verification_capture_boundary: boundary,
    post_p64000_focused_hrm_verification_capture_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.capture_envelope_markdown = renderCaptureEnvelope(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_hrm_verification_capture")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_hrm_verification_capture_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_hrm_verification_capture_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.capture_envelope_markdown = renderCaptureEnvelope(result);
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000FocusedHrmVerificationCapture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-hrm-verification-capture.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-verification-evidence-rows.json"), collectionEnvelope("focused-verification-evidence-rows.v1", "focused_verification_evidence_rows", result.focused_verification_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "candidate-digest-match-rows.json"), collectionEnvelope("candidate-digest-match-rows.v1", "candidate_digest_match_rows", result.candidate_digest_match_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-event-boundary-rows.json"), collectionEnvelope("verification-event-boundary-rows.v1", "verification_event_boundary_rows", result.verification_event_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-state-continuity-rows.json"), collectionEnvelope("finding-state-continuity-rows.v1", "finding_state_continuity_rows", result.finding_state_continuity_rows, result.generated_at));
  await writeFile(path.join(outDir, "focused-verification-capture-envelope.md"), result.capture_envelope_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedHrmVerificationCaptureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedHrmVerificationCapture(args);
  console.log(`Post-P64000 focused HRM verification capture ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_hrm_verification_capture_status}`);
  console.log(`P68400 source ready: ${result.summary.p68400_source_ready_now}`);
  console.log(`Focused evidence captured: ${result.summary.focused_verification_evidence_ready_now}`);
  console.log(`Candidate digests match: ${result.summary.candidate_digests_match_now}`);
  console.log(`Review event completed: ${result.summary.focused_verification_review_event_completed_now}`);
  console.log(`Findings remain open: ${result.summary.findings_remain_open_now}`);
  console.log(`Ready for P68801 handoff: ${result.summary.ready_for_p68801_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ p68400Plan, packet, verificationRows, focusedPlanRows, generatedAt }) {
  const summary = p68400Plan.data?.summary ?? {};
  return [
    row("source.p68400_plan_available", "p68400_source_binding", "P68400 focused HRM plan artifact is available", p68400Plan.available === true, p68400Plan.path, generatedAt),
    row("source.p68400_program", "p68400_source_binding", "P68400 program range matches", p68400Plan.data?.program_range === SOURCE_PROGRAM_RANGE, p68400Plan.path, generatedAt),
    row("source.p68400_valid", "p68400_source_binding", "P68400 validation is valid", p68400Plan.data?.validation?.valid === true, p68400Plan.path, generatedAt),
    row("source.p68400_handoff_ready", "p68400_source_binding", "P68400 is ready for P68401 handoff", summary.ready_for_p68401_handoff === true, p68400Plan.path, generatedAt),
    row("source.p68400_plans_ready", "p68400_source_binding", "P68400 focused plan rows are ready", summary.focused_hrm_plans_ready_now === true, p68400Plan.path, generatedAt),
    row("source.p68400_packets_ready", "p68400_source_binding", "P68400 verification packet rows are ready", summary.verification_packets_ready_now === true, p68400Plan.path, generatedAt),
    row("source.p68400_findings_open", "p68400_source_binding", "P68400 preserved blocking findings", summary.blocking_findings_preserved_now === true && summary.finding_resolution_allowed_now === false, p68400Plan.path, generatedAt),
    row("source.packet_available", "p68400_source_binding", "Focused HRM verification packet markdown is available", packet.available === true && packet.text.includes("Post-P64000 Focused HRM Verification Packet"), packet.path, generatedAt),
    row("source.verification_rows_available", "p68400_source_binding", "Verification packet rows are available", Array.isArray(verificationRows.data?.rows), verificationRows.path, generatedAt),
    row("source.focused_plan_rows_available", "p68400_source_binding", "Focused plan rows are available", Array.isArray(focusedPlanRows.data?.rows), focusedPlanRows.path, generatedAt),
  ];
}

function buildFocusedVerificationEvidenceRows({ p68400Plan, candidateSources, generatedAt }) {
  const sourceRows = p68400Plan.data?.verification_packet_rows ?? [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const sourceRow = sourceRows.find((item) => item.finding_id === findingId);
    const candidate = candidateSources[findingId];
    const ready = sourceRow?.current_verdict === "pass"
      && candidate?.available === true
      && candidate.data?.validation?.valid !== false
      && hasText(sourceRow?.candidate_sha256)
      && Array.isArray(sourceRow?.expected_future_verdicts)
      && sourceRow.expected_future_verdicts.length >= 3;
    return row(`focused_evidence.${normalizeId(findingId)}`, "focused_verification_evidence", `${findingId} focused verification evidence capture row is ready`, ready, sourceRow?.candidate_source_ref ?? candidate?.path ?? "", generatedAt, {
      finding_id: findingId,
      candidate_source_ref: sourceRow?.candidate_source_ref ?? candidate?.path ?? null,
      p68400_candidate_sha256: sourceRow?.candidate_sha256 ?? null,
      current_candidate_sha256: candidate?.sha256 ?? null,
      capture_kind: "candidate_source_digest_and_question_capture",
      expected_future_verdicts: sourceRow?.expected_future_verdicts ?? [],
      review_performed_now: false,
      fixed_claimed_now: false,
      verified_claimed_now: false,
      finding_resolution_claimed_now: false,
      next_allowed_action: "normalize_focused_verification_capture_without_auto_resolution",
    });
  });
}

function buildCandidateDigestMatchRows({ p68400Plan, candidateSources, generatedAt }) {
  const sourceRows = p68400Plan.data?.verification_packet_rows ?? [];
  return REQUIRED_HRM_IDS.map((findingId) => {
    const sourceRow = sourceRows.find((item) => item.finding_id === findingId);
    const candidate = candidateSources[findingId];
    const observed = hasText(sourceRow?.candidate_sha256) && hasText(candidate?.sha256) && sourceRow.candidate_sha256 === candidate.sha256;
    return row(`digest.${normalizeId(findingId)}`, "candidate_digest_match", `${findingId} current candidate digest matches P68400`, observed, sourceRow?.candidate_source_ref ?? candidate?.path ?? "", generatedAt, {
      finding_id: findingId,
      p68400_candidate_sha256: sourceRow?.candidate_sha256 ?? null,
      current_candidate_sha256: candidate?.sha256 ?? null,
    });
  });
}

function buildVerificationEventBoundaryRows({ p68400Plan, evidenceRows, generatedAt }) {
  const summary = p68400Plan.data?.summary ?? {};
  return [
    row("event_boundary.capture_not_review_event", "verification_event_boundary", "P68800 capture is not a completed Claude review event", true, "docs/hermes-roadmap-p68401-p68800.md", generatedAt, { review_event_completed_now: false }),
    row("event_boundary.no_raw_failure_counted", "verification_event_boundary", "Raw Claude failure, auth failure, or hang cannot count as verification evidence", true, "docs/hermes-roadmap-p68401-p68800.md", generatedAt, { raw_claude_failure_counted_now: false }),
    row("event_boundary.no_fixed_claim", "verification_event_boundary", "Focused capture does not claim fixed status", evidenceRows.every((item) => item.fixed_claimed_now === false), "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
    row("event_boundary.no_verified_claim", "verification_event_boundary", "Focused capture does not claim verified status", evidenceRows.every((item) => item.verified_claimed_now === false), "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
    row("event_boundary.no_finding_resolution", "verification_event_boundary", "Focused capture does not resolve findings", summary.finding_resolution_allowed_now === false && evidenceRows.every((item) => item.finding_resolution_claimed_now === false), p68400Plan.path, generatedAt),
    row("event_boundary.clean_checkpoint_blocked", "verification_event_boundary", "Clean checkpoint remains blocked", summary.clean_checkpoint_allowed_now === false, p68400Plan.path, generatedAt),
  ];
}

function buildFindingStateContinuityRows({ p68400Plan, evidenceRows, generatedAt }) {
  const summary = p68400Plan.data?.summary ?? {};
  return [
    row("state.required_hrm_evidence_rows", "finding_state_continuity", "All required HRM ids have evidence capture rows", REQUIRED_HRM_IDS.every((id) => evidenceRows.some((item) => item.finding_id === id)), "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
    row("state.blocking_findings_preserved", "finding_state_continuity", "P68400 blocking findings remain preserved", summary.blocking_findings_preserved_now === true, p68400Plan.path, generatedAt),
    row("state.finding_count_preserved", "finding_state_continuity", "P68400 finding count remains at least three", Number(summary.blocking_finding_count ?? 0) >= REQUIRED_HRM_IDS.length, p68400Plan.path, generatedAt),
    row("state.no_auto_resolution", "finding_state_continuity", "Focused capture does not auto-resolve findings", summary.finding_resolution_allowed_now === false, p68400Plan.path, generatedAt),
    row("state.future_normalization_required", "finding_state_continuity", "P68801 normalization remains required before status recommendations", true, "docs/hermes-roadmap-p68401-p68800.md", generatedAt, {
      next_allowed_action: "normalize_focused_capture_into_recommendations_without_auto_resolution",
    }),
  ];
}

function buildAuthorityRows({ p68400Plan, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(p68400Plan.data, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p68401-p68800.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(p68400Plan, flag) {
  const summary = p68400Plan?.summary ?? {};
  if (flag === "finding_resolution_allowed_now" && summary.finding_resolution_allowed_now === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && summary.source_mutation_from_review_allowed_now === true) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && summary.clean_checkpoint_allowed_now === true) return true;
  if (flag === "post_p68800_production_pass_claim_allowed_now" && summary.production_pass_enabled === true) return true;
  if (flag === "post_p68800_enterprise_pass_claim_allowed_now" && summary.enterprise_pass_enabled === true) return true;
  if (flag === "focused_verification_fixed_claim_allowed_now" && summary.focused_plan_fixed_claim_allowed_now === true) return true;
  if (flag === "focused_verification_verified_claim_allowed_now" && summary.focused_plan_verified_claim_allowed_now === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P68800 closeout`,
    true,
    "docs/hermes-roadmap-p68401-p68800.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-hrm-verification-capture.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P68401-P68800 roadmap doc includes required capture fields", roadmapDoc.available && roadmapDoc.text.includes("P68401-P68800") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P68401-P68800 focused HRM verification capture", architectureDoc.available && architectureDoc.text.includes("P68401-P68800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p68800.source_ready", "P68400 source binding is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p68800.focused_evidence", "Focused verification evidence capture rows are ready", evidenceRows.length === REQUIRED_HRM_IDS.length && evidenceRows.every(pass), generatedAt),
    closeoutRow("p68800.digest_match", "Candidate digests match P68400", digestRows.length === REQUIRED_HRM_IDS.length && digestRows.every(pass), generatedAt),
    closeoutRow("p68800.event_boundary", "Verification event boundary remains safe", eventBoundaryRows.every(pass), generatedAt),
    closeoutRow("p68800.finding_state", "Finding state continuity is preserved", stateRows.every(pass), generatedAt),
    closeoutRow("p68800.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p68800.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p68800.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p68800.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, evidenceRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p68801_normalization", "p68801_handoff", "P68801 may normalize focused verification capture rows", ready && evidenceRows.every(pass), "artifacts/post-p64000-focused-hrm-verification-capture/latest/post-p64000-focused-hrm-verification-capture.json", generatedAt, {
      next_allowed_action: ready ? "normalize_focused_capture_into_recommendations_without_auto_resolution" : "resolve_p68800_capture_blockers",
    }),
    row("handoff.no_status_resolution", "p68801_handoff", "P68800 handoff is not fixed, verified, resolved, or clean checkpoint", ready, "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
    row("handoff.authority_false", "p68801_handoff", "P68801 receives capture evidence only, not write or protected action authority", ready, "docs/hermes-roadmap-p68401-p68800.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p68400Plan } = parts;
  const summary = p68400Plan.data?.summary ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_focused_hrm_verification_capture_ready: closeoutRows.every(pass),
    p68400_source_ready_now: sourceRows.every(pass),
    focused_verification_evidence_ready_now: evidenceRows.length === REQUIRED_HRM_IDS.length && evidenceRows.every(pass),
    candidate_digests_match_now: digestRows.length === REQUIRED_HRM_IDS.length && digestRows.every(pass),
    verification_event_boundary_ready_now: eventBoundaryRows.every(pass),
    findings_remain_open_now: stateRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p68801_handoff: handoffRows.every(pass),
    required_hrm_ids: REQUIRED_HRM_IDS,
    blocking_finding_count: Number(summary.blocking_finding_count ?? 0),
    finding_count: Number(summary.finding_count ?? 0),
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    focused_verification_review_event_completed_now: false,
    focused_verification_fixed_claim_allowed_now: false,
    focused_verification_verified_claim_allowed_now: false,
    focused_verification_verdict_claim_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p68800_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p68800_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, evidenceRows, digestRows, eventBoundaryRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p68400", "source_binding", sourceRows.every(pass), "P68400 focused plan source must be ready"),
    validationItem("capture.focused_evidence", "focused_verification_evidence", evidenceRows.length === REQUIRED_HRM_IDS.length && evidenceRows.every(pass), "Focused verification evidence rows must exist for HRM-04/03/01"),
    validationItem("capture.digest_match", "candidate_digest_match", digestRows.length === REQUIRED_HRM_IDS.length && digestRows.every(pass), "Candidate digests must match P68400 rows"),
    validationItem("capture.event_boundary", "verification_event_boundary", eventBoundaryRows.every(pass), "Capture cannot be treated as completed review event"),
    validationItem("state.findings_open", "finding_state", stateRows.every(pass), "Blocking findings must remain open and unresolved"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P68800 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P68801 handoff rows must pass"),
    validationItem("boundary.review_event_false", "authority_boundary", boundary.focused_verification_review_event_completed_now === false, "Focused verification review event must remain false"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.finding_resolution_false", "authority_boundary", boundary.finding_resolution_allowed_now === false, "Finding resolution must remain false"),
    validationItem("boundary.fixed_verified_false", "authority_boundary", boundary.focused_verification_fixed_claim_allowed_now === false && boundary.focused_verification_verified_claim_allowed_now === false, "Focused capture cannot claim fixed or verified"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p68801_handoff
    ? "focused_hrm_verification_capture_ready_for_p68801"
    : validation.valid
      ? "valid_block_p68801_handoff_pending"
      : "blocked_post_p64000_focused_hrm_verification_capture";
  return {
    post_p64000_focused_hrm_verification_capture_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p68400_source_ready_now: boundary.p68400_source_ready_now,
    focused_verification_evidence_ready_now: boundary.focused_verification_evidence_ready_now,
    candidate_digests_match_now: boundary.candidate_digests_match_now,
    verification_event_boundary_ready_now: boundary.verification_event_boundary_ready_now,
    findings_remain_open_now: boundary.findings_remain_open_now,
    ready_for_p68801_handoff: boundary.ready_for_p68801_handoff,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    finding_resolution_allowed_now: boundary.finding_resolution_allowed_now,
    focused_verification_review_event_completed_now: boundary.focused_verification_review_event_completed_now,
    focused_verification_fixed_claim_allowed_now: boundary.focused_verification_fixed_claim_allowed_now,
    focused_verification_verified_claim_allowed_now: boundary.focused_verification_verified_claim_allowed_now,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderCaptureEnvelope(result) {
  const rows = result.focused_verification_evidence_rows.map((item) => [
    `- ${item.finding_id}:`,
    `  - candidate_source_ref: ${item.candidate_source_ref}`,
    `  - p68400_candidate_sha256: ${item.p68400_candidate_sha256}`,
    `  - current_candidate_sha256: ${item.current_candidate_sha256}`,
    "  - review_performed_now: false",
    "  - fixed_claimed_now: false",
    "  - verified_claimed_now: false",
  ].join("\n")).join("\n");
  return [
    "# Post-P64000 Focused HRM Verification Capture Envelope",
    "",
    "## Scope",
    "",
    "Capture the source evidence needed for later focused HRM verification normalization. This envelope is not a completed Claude review event, not a fix, not finding resolution, and not final approval.",
    "",
    "## Captured Candidate Evidence",
    "",
    rows,
    "",
    "## Authority Boundary",
    "",
    "- focused review event completed: false",
    "- source mutation: false",
    "- patch apply: false",
    "- finding resolution: false",
    "- clean checkpoint: false",
    "- protected closeout: false",
    "- production PASS: false",
    "- enterprise PASS: false",
    "- final approval: false",
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Focused HRM Verification Capture ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_hrm_verification_capture_status}`,
    `- p68400_source_ready_now: ${result.summary.p68400_source_ready_now}`,
    `- focused_verification_evidence_ready_now: ${result.summary.focused_verification_evidence_ready_now}`,
    `- candidate_digests_match_now: ${result.summary.candidate_digests_match_now}`,
    `- focused_verification_review_event_completed_now: ${result.summary.focused_verification_review_event_completed_now}`,
    `- findings_remain_open_now: ${result.summary.findings_remain_open_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- finding_resolution_allowed_now: ${result.summary.finding_resolution_allowed_now}`,
    `- ready_for_p68801_handoff: ${result.summary.ready_for_p68801_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p68801_handoff
      ? "Continue to P68801-P69200 focused verification capture normalization. Do not claim fixed, verified, resolved, clean checkpoint, production PASS, or enterprise PASS from this capture tranche."
      : "Resolve source binding, candidate digest, capture, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

async function readCandidateSources({ repoRoot, p68400Plan, overrides }) {
  const sourceRows = p68400Plan.data?.verification_packet_rows ?? [];
  const entries = await Promise.all(REQUIRED_HRM_IDS.map(async (findingId) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, findingId)) {
      const data = overrides[findingId];
      return [findingId, {
        path: `inline.${findingId}`,
        available: data !== null && data !== undefined,
        data,
        text: data === null || data === undefined ? "" : JSON.stringify(data),
        sha256: data === null || data === undefined ? "" : sha256(JSON.stringify(data)),
      }];
    }
    const sourceRow = sourceRows.find((item) => item.finding_id === findingId);
    const sourceRef = sourceRow?.candidate_source_ref ?? sourceRow?.evidence_ref ?? "";
    const filePath = path.isAbsolute(sourceRef) ? sourceRef : path.resolve(repoRoot, sourceRef);
    const source = await readJsonSource(filePath);
    return [findingId, { ...source, sha256: source.text ? sha256(source.text) : "" }];
  }));
  return Object.fromEntries(entries);
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p68800_closeout", label, observed, "artifacts/post-p64000-focused-hrm-verification-capture/latest/post-p64000-focused-hrm-verification-capture.json", generatedAt);
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_focused_hrm_verification_capture" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined(extra),
  };
}

function pass(item) {
  return item.current_verdict === "pass";
}

function validationItem(id, category, passed, message) {
  return { validation_id: id, category, passed: passed === true, severity: passed === true ? "info" : "error", message: passed === true ? `${id} passed` : message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return { valid: errors.length === 0, error_count: errors.length, errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })) };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--p68400-plan") args.p68400PlanPath = argv[++index];
    else if (arg === "--packet") args.packetPath = argv[++index];
    else if (arg === "--verification-rows") args.verificationRowsPath = argv[++index];
    else if (arg === "--focused-plan-rows") args.focusedPlanRowsPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--p68400-plan PATH] [--packet PATH] [--verification-rows PATH] [--focused-plan-rows PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_CAPTURE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    p68400_plan_path: path.resolve(repoRoot, options.p68400PlanPath ?? defaults.p68400PlanPath),
    packet_path: path.resolve(repoRoot, options.packetPath ?? defaults.packetPath),
    verification_rows_path: path.resolve(repoRoot, options.verificationRowsPath ?? defaults.verificationRowsPath),
    focused_plan_rows_path: path.resolve(repoRoot, options.focusedPlanRowsPath ?? defaults.focusedPlanRowsPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { path: sourceId, available: data !== null && data !== undefined, data, text: data === null || data === undefined ? "" : JSON.stringify(data) };
}

function normalizeInlineTextSource(sourceId, text) {
  return { path: sourceId, available: typeof text === "string" && text.length > 0, text: text ?? "" };
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, capture_envelope_markdown: captureEnvelopeMarkdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
