import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_NORMALIZATION_OUT_DIR = "artifacts/post-p64000-focused-hrm-verification-normalization/latest";
export const DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_NORMALIZATION_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-hrm-verification-normalization.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p68801-p69200.md",
  architectureDocPath: "docs/architecture.md",
  p68800CapturePath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/post-p64000-focused-hrm-verification-capture.json",
  captureEnvelopePath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/focused-verification-capture-envelope.md",
  focusedEvidenceRowsPath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/focused-verification-evidence-rows.json",
  digestRowsPath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/candidate-digest-match-rows.json",
  eventBoundaryRowsPath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/verification-event-boundary-rows.json",
  findingStateRowsPath: "artifacts/post-p64000-focused-hrm-verification-capture/latest/finding-state-continuity-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-hrm-verification-normalization";
const SCHEMA_VERSION = "post-p64000-focused-hrm-verification-normalization.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_hrm_verification_normalization";
const PROGRAM_RANGE = "P68801-P69200";
const SOURCE_PROGRAM_RANGE = "P68401-P68800";
const NEXT_PROGRAM_RANGE = "P69201-P69600";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const NEGATIVE_FIXTURES = [
  "missing_p68800_source",
  "p68800_invalid_or_not_ready",
  "missing_focused_evidence_row",
  "missing_digest_row",
  "candidate_digest_mismatch",
  "missing_capture_envelope",
  "review_event_completed_claim",
  "recommendation_claims_fixed",
  "recommendation_claims_verified",
  "recommendation_claims_resolved",
  "finding_auto_resolved",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "source_mutation_claim",
  "patch_apply_claim",
  "write_action_claim",
  "reviewer_mutation_claim",
  "codex_final_approval_claim",
  "claude_final_approval_claim",
  "final_automated_approval_claim",
  "missing_future_focused_review_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "focused_review_completed_now",
  "finding_status_fixed_allowed_now",
  "finding_status_verified_allowed_now",
  "finding_status_resolved_allowed_now",
  "finding_status_auto_resolved_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_normalization_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_normalization_allowed_now",
  "post_p69200_production_pass_claim_allowed_now",
  "post_p69200_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-hrm-verification-normalization.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-hrm-verification-normalization.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-hrm-verification-normalization.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-hrm-verification-normalization -- --check"],
  ["adjacent.p68800", "node --test test/post-p64000-focused-hrm-verification-capture.test.mjs test/post-p64000-focused-hrm-verification-normalization.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-hrm-verification-normalization.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedHrmVerificationNormalization(options = {}) {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused HRM verification normalization failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedHrmVerificationNormalization(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedHrmVerificationNormalization(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_NORMALIZATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const p68800Capture = Object.prototype.hasOwnProperty.call(options, "p68800Capture")
    ? normalizeInlineJsonSource("inline.p68800_capture", options.p68800Capture)
    : await readJsonSource(inputs.p68800_capture_path);
  const captureEnvelope = Object.prototype.hasOwnProperty.call(options, "captureEnvelopeText")
    ? normalizeInlineTextSource("inline.capture_envelope", options.captureEnvelopeText)
    : await readTextSource(inputs.capture_envelope_path);
  const focusedEvidenceRows = Object.prototype.hasOwnProperty.call(options, "focusedEvidenceRows")
    ? normalizeInlineJsonSource("inline.focused_evidence_rows", options.focusedEvidenceRows)
    : await readJsonSource(inputs.focused_evidence_rows_path);
  const digestRows = Object.prototype.hasOwnProperty.call(options, "digestRows")
    ? normalizeInlineJsonSource("inline.digest_rows", options.digestRows)
    : await readJsonSource(inputs.digest_rows_path);
  const eventBoundaryRows = Object.prototype.hasOwnProperty.call(options, "eventBoundaryRows")
    ? normalizeInlineJsonSource("inline.event_boundary_rows", options.eventBoundaryRows)
    : await readJsonSource(inputs.event_boundary_rows_path);
  const findingStateRows = Object.prototype.hasOwnProperty.call(options, "findingStateRows")
    ? normalizeInlineJsonSource("inline.finding_state_rows", options.findingStateRows)
    : await readJsonSource(inputs.finding_state_rows_path);

  const sourceRows = buildSourceRows({ p68800Capture, captureEnvelope, focusedEvidenceRows, digestRows, eventBoundaryRows, findingStateRows, generatedAt });
  const normalizedRows = buildNormalizedCaptureRows({ p68800Capture, focusedEvidenceRows, digestRows, generatedAt });
  const recommendationRows = buildFindingStatusRecommendationRows({ normalizedRows, overrides: options.recommendationOverrides, generatedAt });
  const pendingGuardRows = buildVerificationPendingGuardRows({ p68800Capture, normalizedRows, recommendationRows, generatedAt });
  const futureReviewRows = buildFutureReviewPacketRows({ recommendationRows, generatedAt });
  const authorityRows = buildAuthorityRows({ p68800Capture, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, futureReviewRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p68800Capture });
  const validationItems = buildValidationItems({ sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p68800_capture_path: p68800Capture.path,
      capture_envelope_path: captureEnvelope.path,
      focused_evidence_rows_path: focusedEvidenceRows.path,
      digest_rows_path: digestRows.path,
      event_boundary_rows_path: eventBoundaryRows.path,
      finding_state_rows_path: findingStateRows.path,
    },
    post_p64000_focused_hrm_verification_normalization_contract: {
      contract_id: "post_p64000_focused_hrm_verification_normalization",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      normalizes_capture_into_recommendations: true,
      allowed_recommendation_status: "verification_pending",
      focused_review_completed: false,
      finding_resolution_allowed: false,
      fixed_status_allowed: false,
      verified_status_allowed: false,
      resolved_status_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p68800_source_binding_rows: sourceRows,
    normalized_capture_rows: normalizedRows,
    finding_status_recommendation_rows: recommendationRows,
    verification_pending_guard_rows: pendingGuardRows,
    future_review_packet_rows: futureReviewRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p69200_wiring_rows: wiringRows,
    p69200_closeout_rows: closeoutRows,
    p69201_handoff_rows: handoffRows,
    post_p64000_focused_hrm_verification_normalization_boundary: boundary,
    post_p64000_focused_hrm_verification_normalization_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.normalized_recommendation_markdown = renderRecommendationPacket(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_hrm_verification_normalization")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_hrm_verification_normalization_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_hrm_verification_normalization_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.normalized_recommendation_markdown = renderRecommendationPacket(result);
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000FocusedHrmVerificationNormalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-hrm-verification-normalization.json"), serializableResult(result));
  await writeJson(path.join(outDir, "normalized-capture-rows.json"), collectionEnvelope("normalized-capture-rows.v1", "normalized_capture_rows", result.normalized_capture_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-status-recommendation-rows.json"), collectionEnvelope("finding-status-recommendation-rows.v1", "finding_status_recommendation_rows", result.finding_status_recommendation_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-pending-guard-rows.json"), collectionEnvelope("verification-pending-guard-rows.v1", "verification_pending_guard_rows", result.verification_pending_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "future-review-packet-rows.json"), collectionEnvelope("future-review-packet-rows.v1", "future_review_packet_rows", result.future_review_packet_rows, result.generated_at));
  await writeFile(path.join(outDir, "normalized-recommendation-packet.md"), result.normalized_recommendation_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedHrmVerificationNormalizationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedHrmVerificationNormalization(args);
  console.log(`Post-P64000 focused HRM verification normalization ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_hrm_verification_normalization_status}`);
  console.log(`P68800 source ready: ${result.summary.p68800_source_ready_now}`);
  console.log(`Normalized capture ready: ${result.summary.normalized_capture_ready_now}`);
  console.log(`Recommendations pending only: ${result.summary.recommendations_pending_only_now}`);
  console.log(`Focused review completed: ${result.summary.focused_review_completed_now}`);
  console.log(`Ready for P69201 handoff: ${result.summary.ready_for_p69201_handoff}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ p68800Capture, captureEnvelope, focusedEvidenceRows, digestRows, eventBoundaryRows, findingStateRows, generatedAt }) {
  const summary = p68800Capture.data?.summary ?? {};
  return [
    row("source.p68800_capture_available", "p68800_source_binding", "P68800 focused verification capture artifact is available", p68800Capture.available === true, p68800Capture.path, generatedAt),
    row("source.p68800_program", "p68800_source_binding", "P68800 program range matches", p68800Capture.data?.program_range === SOURCE_PROGRAM_RANGE, p68800Capture.path, generatedAt),
    row("source.p68800_valid", "p68800_source_binding", "P68800 validation is valid", p68800Capture.data?.validation?.valid === true, p68800Capture.path, generatedAt),
    row("source.p68800_handoff_ready", "p68800_source_binding", "P68800 is ready for P68801 handoff", summary.ready_for_p68801_handoff === true, p68800Capture.path, generatedAt),
    row("source.p68800_capture_ready", "p68800_source_binding", "P68800 focused evidence is ready", summary.focused_verification_evidence_ready_now === true, p68800Capture.path, generatedAt),
    row("source.p68800_digest_match", "p68800_source_binding", "P68800 candidate digests match", summary.candidate_digests_match_now === true, p68800Capture.path, generatedAt),
    row("source.p68800_review_not_completed", "p68800_source_binding", "P68800 did not complete a review event", summary.focused_verification_review_event_completed_now === false, p68800Capture.path, generatedAt),
    row("source.capture_envelope", "p68800_source_binding", "Focused capture envelope is available", captureEnvelope.available === true && captureEnvelope.text.includes("Focused HRM Verification Capture Envelope"), captureEnvelope.path, generatedAt),
    row("source.focused_evidence_rows", "p68800_source_binding", "Focused evidence rows are available", Array.isArray(focusedEvidenceRows.data?.rows), focusedEvidenceRows.path, generatedAt),
    row("source.digest_rows", "p68800_source_binding", "Digest rows are available", Array.isArray(digestRows.data?.rows), digestRows.path, generatedAt),
    row("source.event_boundary_rows", "p68800_source_binding", "Event boundary rows are available", Array.isArray(eventBoundaryRows.data?.rows), eventBoundaryRows.path, generatedAt),
    row("source.finding_state_rows", "p68800_source_binding", "Finding state rows are available", Array.isArray(findingStateRows.data?.rows), findingStateRows.path, generatedAt),
  ];
}

function buildNormalizedCaptureRows({ p68800Capture, focusedEvidenceRows, digestRows, generatedAt }) {
  const embeddedEvidence = p68800Capture.data?.focused_verification_evidence_rows ?? [];
  const evidenceRows = focusedEvidenceRows.data?.rows ?? embeddedEvidence;
  const embeddedDigests = p68800Capture.data?.candidate_digest_match_rows ?? [];
  const digestSourceRows = digestRows.data?.rows ?? embeddedDigests;
  return REQUIRED_HRM_IDS.map((findingId) => {
    const evidence = evidenceRows.find((item) => item.finding_id === findingId);
    const digest = digestSourceRows.find((item) => item.finding_id === findingId);
    const ready = evidence?.current_verdict === "pass"
      && digest?.current_verdict === "pass"
      && evidence.review_performed_now === false
      && evidence.fixed_claimed_now === false
      && evidence.verified_claimed_now === false
      && evidence.finding_resolution_claimed_now === false;
    return row(`normalized_capture.${normalizeId(findingId)}`, "normalized_capture", `${findingId} focused capture is normalized as verification_pending`, ready, evidence?.candidate_source_ref ?? evidence?.evidence_ref ?? "", generatedAt, {
      finding_id: findingId,
      candidate_source_ref: evidence?.candidate_source_ref ?? null,
      candidate_sha256: evidence?.current_candidate_sha256 ?? digest?.current_candidate_sha256 ?? null,
      normalized_capture_status: "candidate_capture_ready",
      recommendation_status: "verification_pending",
      focused_review_completed_now: false,
      fixed_claimed_now: false,
      verified_claimed_now: false,
      resolved_claimed_now: false,
      next_allowed_action: "prepare_focused_claude_review_dispatch_without_counting_dispatch_as_evidence",
    });
  });
}

function buildFindingStatusRecommendationRows({ normalizedRows, overrides = {}, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const normalized = normalizedRows.find((item) => item.finding_id === findingId);
    const override = overrides[findingId] ?? {};
    const recommendationStatus = override.recommendation_status ?? normalized?.recommendation_status ?? "verification_pending";
    const fixedClaimed = override.fixed_claimed_now ?? false;
    const verifiedClaimed = override.verified_claimed_now ?? false;
    const resolvedClaimed = override.resolved_claimed_now ?? false;
    const ready = normalized?.current_verdict === "pass"
      && recommendationStatus === "verification_pending"
      && fixedClaimed === false
      && verifiedClaimed === false
      && resolvedClaimed === false;
    return row(`recommendation.${normalizeId(findingId)}`, "finding_status_recommendation", `${findingId} recommendation remains verification_pending`, ready, normalized?.candidate_source_ref ?? "docs/hermes-roadmap-p68801-p69200.md", generatedAt, {
      finding_id: findingId,
      current_finding_state: "blocking_open",
      recommendation_status: recommendationStatus,
      focused_review_required_now: true,
      fixed_claimed_now: fixedClaimed,
      verified_claimed_now: verifiedClaimed,
      resolved_claimed_now: resolvedClaimed,
      clean_checkpoint_contribution_now: false,
      next_allowed_action: "run_or_capture_focused_review_event_before_any_status_change",
    });
  });
}

function buildVerificationPendingGuardRows({ p68800Capture, normalizedRows, recommendationRows, generatedAt }) {
  const summary = p68800Capture.data?.summary ?? {};
  return [
    row("guard.all_recommendations_pending", "verification_pending_guard", "All HRM recommendations remain verification_pending", recommendationRows.every((item) => item.recommendation_status === "verification_pending"), "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("guard.no_fixed_claim", "verification_pending_guard", "No normalized row claims fixed status", normalizedRows.every((item) => item.fixed_claimed_now === false) && recommendationRows.every((item) => item.fixed_claimed_now === false), "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("guard.no_verified_claim", "verification_pending_guard", "No normalized row claims verified status", normalizedRows.every((item) => item.verified_claimed_now === false) && recommendationRows.every((item) => item.verified_claimed_now === false), "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("guard.no_resolved_claim", "verification_pending_guard", "No recommendation resolves a finding", normalizedRows.every((item) => item.resolved_claimed_now === false) && recommendationRows.every((item) => item.resolved_claimed_now === false), "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("guard.review_not_completed", "verification_pending_guard", "Focused review remains incomplete", summary.focused_verification_review_event_completed_now === false, p68800Capture.path, generatedAt),
    row("guard.clean_checkpoint_false", "verification_pending_guard", "Clean checkpoint remains false", summary.clean_checkpoint_allowed_now === false, p68800Capture.path, generatedAt),
  ];
}

function buildFutureReviewPacketRows({ recommendationRows, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const recommendation = recommendationRows.find((item) => item.finding_id === findingId);
    const ready = recommendation?.current_verdict === "pass" && recommendation.focused_review_required_now === true;
    return row(`future_review.${normalizeId(findingId)}`, "future_review_packet", `${findingId} future focused review packet row is ready`, ready, "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md", generatedAt, {
      finding_id: findingId,
      reviewer_lane: "claude-code-opus-max-readonly",
      dispatch_ready_candidate_now: true,
      dispatch_performed_now: false,
      review_evidence_counted_now: false,
      next_allowed_action: "prepare_dispatch_metadata_without_counting_it_as_review_evidence",
    });
  });
}

function buildAuthorityRows({ p68800Capture, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(p68800Capture.data, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p68801-p69200.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(capture, flag) {
  const summary = capture?.summary ?? {};
  if (flag === "focused_review_completed_now" && summary.focused_verification_review_event_completed_now === true) return true;
  if (flag === "finding_status_fixed_allowed_now" && summary.focused_verification_fixed_claim_allowed_now === true) return true;
  if (flag === "finding_status_verified_allowed_now" && summary.focused_verification_verified_claim_allowed_now === true) return true;
  if (flag === "finding_resolution_allowed_now" && summary.finding_resolution_allowed_now === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && summary.source_mutation_from_review_allowed_now === true) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && summary.clean_checkpoint_allowed_now === true) return true;
  if (flag === "post_p69200_production_pass_claim_allowed_now" && summary.production_pass_enabled === true) return true;
  if (flag === "post_p69200_enterprise_pass_claim_allowed_now" && summary.enterprise_pass_enabled === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P69200 closeout`,
    true,
    "docs/hermes-roadmap-p68801-p69200.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-hrm-verification-normalization.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P68801-P69200 roadmap doc includes required normalization fields", roadmapDoc.available && roadmapDoc.text.includes("P68801-P69200") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P68801-P69200 focused HRM verification normalization", architectureDoc.available && architectureDoc.text.includes("P68801-P69200"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p69200.source_ready", "P68800 source binding is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p69200.normalized_capture", "Normalized capture rows are ready", normalizedRows.length === REQUIRED_HRM_IDS.length && normalizedRows.every(pass), generatedAt),
    closeoutRow("p69200.recommendations_pending", "Finding recommendations are pending only", recommendationRows.length === REQUIRED_HRM_IDS.length && recommendationRows.every(pass), generatedAt),
    closeoutRow("p69200.pending_guards", "Pending guard rows are ready", pendingGuardRows.every(pass), generatedAt),
    closeoutRow("p69200.future_review_packet", "Future focused review packet rows are ready", futureReviewRows.length === REQUIRED_HRM_IDS.length && futureReviewRows.every(pass), generatedAt),
    closeoutRow("p69200.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p69200.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p69200.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p69200.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, futureReviewRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p69201_focused_review_dispatch", "p69201_handoff", "P69201 may prepare focused Claude review dispatch metadata", ready && futureReviewRows.every(pass), "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md", generatedAt, {
      next_allowed_action: ready ? "prepare_focused_review_dispatch_metadata_without_counting_dispatch_as_evidence" : "resolve_p69200_normalization_blockers",
    }),
    row("handoff.no_status_change", "p69201_handoff", "P69200 handoff is not fixed, verified, resolved, or clean checkpoint", ready, "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
    row("handoff.authority_false", "p69201_handoff", "P69201 receives recommendation metadata only, not write or protected action authority", ready, "docs/hermes-roadmap-p68801-p69200.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, p68800Capture } = parts;
  const summary = p68800Capture.data?.summary ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_focused_hrm_verification_normalization_ready: closeoutRows.every(pass),
    p68800_source_ready_now: sourceRows.every(pass),
    normalized_capture_ready_now: normalizedRows.length === REQUIRED_HRM_IDS.length && normalizedRows.every(pass),
    recommendations_pending_only_now: recommendationRows.length === REQUIRED_HRM_IDS.length && recommendationRows.every(pass),
    verification_pending_guards_ready_now: pendingGuardRows.every(pass),
    future_review_packet_ready_now: futureReviewRows.length === REQUIRED_HRM_IDS.length && futureReviewRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p69201_handoff: handoffRows.every(pass),
    required_hrm_ids: REQUIRED_HRM_IDS,
    blocking_finding_count: Number(summary.blocking_finding_count ?? 0),
    finding_count: Number(summary.finding_count ?? 0),
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    focused_review_completed_now: false,
    finding_status_fixed_allowed_now: false,
    finding_status_verified_allowed_now: false,
    finding_status_resolved_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p69200_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p69200_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, normalizedRows, recommendationRows, pendingGuardRows, futureReviewRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p68800", "source_binding", sourceRows.every(pass), "P68800 focused verification capture source must be ready"),
    validationItem("normalization.capture", "normalized_capture", normalizedRows.length === REQUIRED_HRM_IDS.length && normalizedRows.every(pass), "Normalized capture rows must exist for HRM-04/03/01"),
    validationItem("normalization.recommendations", "finding_status_recommendation", recommendationRows.length === REQUIRED_HRM_IDS.length && recommendationRows.every(pass), "Finding recommendations must remain verification_pending"),
    validationItem("normalization.pending_guards", "verification_pending_guard", pendingGuardRows.every(pass), "Pending guard rows must pass"),
    validationItem("normalization.future_review", "future_review_packet", futureReviewRows.length === REQUIRED_HRM_IDS.length && futureReviewRows.every(pass), "Future review packet rows must be ready"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P69200 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P69201 handoff rows must pass"),
    validationItem("boundary.review_completed_false", "authority_boundary", boundary.focused_review_completed_now === false, "Focused review completion must remain false"),
    validationItem("boundary.status_change_false", "authority_boundary", boundary.finding_status_fixed_allowed_now === false && boundary.finding_status_verified_allowed_now === false && boundary.finding_status_resolved_allowed_now === false, "Fixed/verified/resolved status must remain false"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p69201_handoff
    ? "focused_hrm_verification_normalization_ready_for_p69201"
    : validation.valid
      ? "valid_block_p69201_handoff_pending"
      : "blocked_post_p64000_focused_hrm_verification_normalization";
  return {
    post_p64000_focused_hrm_verification_normalization_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p68800_source_ready_now: boundary.p68800_source_ready_now,
    normalized_capture_ready_now: boundary.normalized_capture_ready_now,
    recommendations_pending_only_now: boundary.recommendations_pending_only_now,
    verification_pending_guards_ready_now: boundary.verification_pending_guards_ready_now,
    future_review_packet_ready_now: boundary.future_review_packet_ready_now,
    ready_for_p69201_handoff: boundary.ready_for_p69201_handoff,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    finding_resolution_allowed_now: boundary.finding_resolution_allowed_now,
    focused_review_completed_now: boundary.focused_review_completed_now,
    finding_status_fixed_allowed_now: boundary.finding_status_fixed_allowed_now,
    finding_status_verified_allowed_now: boundary.finding_status_verified_allowed_now,
    finding_status_resolved_allowed_now: boundary.finding_status_resolved_allowed_now,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderRecommendationPacket(result) {
  const rows = result.finding_status_recommendation_rows.map((item) => [
    `- ${item.finding_id}:`,
    `  - current_finding_state: ${item.current_finding_state}`,
    `  - recommendation_status: ${item.recommendation_status}`,
    `  - focused_review_required_now: ${item.focused_review_required_now}`,
    "  - fixed_claimed_now: false",
    "  - verified_claimed_now: false",
    "  - resolved_claimed_now: false",
  ].join("\n")).join("\n");
  return [
    "# Post-P64000 Focused HRM Verification Normalization Packet",
    "",
    "## Scope",
    "",
    "Normalize focused capture into pending recommendations only. This packet is not review completion, not fixed, not verified, not finding resolution, and not final approval.",
    "",
    "## Recommendations",
    "",
    rows,
    "",
    "## Authority Boundary",
    "",
    "- focused review completed: false",
    "- fixed status: false",
    "- verified status: false",
    "- resolved status: false",
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
    `# Post-P64000 Focused HRM Verification Normalization ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_hrm_verification_normalization_status}`,
    `- p68800_source_ready_now: ${result.summary.p68800_source_ready_now}`,
    `- normalized_capture_ready_now: ${result.summary.normalized_capture_ready_now}`,
    `- recommendations_pending_only_now: ${result.summary.recommendations_pending_only_now}`,
    `- focused_review_completed_now: ${result.summary.focused_review_completed_now}`,
    `- finding_status_fixed_allowed_now: ${result.summary.finding_status_fixed_allowed_now}`,
    `- finding_status_verified_allowed_now: ${result.summary.finding_status_verified_allowed_now}`,
    `- finding_status_resolved_allowed_now: ${result.summary.finding_status_resolved_allowed_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p69201_handoff: ${result.summary.ready_for_p69201_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p69201_handoff
      ? "Continue to P69201-P69600 focused Claude review dispatch metadata. Do not count dispatch, auth failure, hang, malformed output, or pending recommendation as review evidence."
      : "Resolve source, normalization, pending guard, future review packet, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p69200_closeout", label, observed, "artifacts/post-p64000-focused-hrm-verification-normalization/latest/post-p64000-focused-hrm-verification-normalization.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_focused_hrm_verification_normalization" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--p68800-capture") args.p68800CapturePath = argv[++index];
    else if (arg === "--capture-envelope") args.captureEnvelopePath = argv[++index];
    else if (arg === "--focused-evidence-rows") args.focusedEvidenceRowsPath = argv[++index];
    else if (arg === "--digest-rows") args.digestRowsPath = argv[++index];
    else if (arg === "--event-boundary-rows") args.eventBoundaryRowsPath = argv[++index];
    else if (arg === "--finding-state-rows") args.findingStateRowsPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--p68800-capture PATH] [--capture-envelope PATH] [--focused-evidence-rows PATH] [--digest-rows PATH] [--event-boundary-rows PATH] [--finding-state-rows PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_HRM_VERIFICATION_NORMALIZATION_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    p68800_capture_path: path.resolve(repoRoot, options.p68800CapturePath ?? defaults.p68800CapturePath),
    capture_envelope_path: path.resolve(repoRoot, options.captureEnvelopePath ?? defaults.captureEnvelopePath),
    focused_evidence_rows_path: path.resolve(repoRoot, options.focusedEvidenceRowsPath ?? defaults.focusedEvidenceRowsPath),
    digest_rows_path: path.resolve(repoRoot, options.digestRowsPath ?? defaults.digestRowsPath),
    event_boundary_rows_path: path.resolve(repoRoot, options.eventBoundaryRowsPath ?? defaults.eventBoundaryRowsPath),
    finding_state_rows_path: path.resolve(repoRoot, options.findingStateRowsPath ?? defaults.findingStateRowsPath),
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
  const { markdown, normalized_recommendation_markdown: normalizedRecommendationMarkdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
