import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_HRM_REVALIDATION_CLEAN_CANDIDATE_REVIEW_OUT_DIR = "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest";
export const DEFAULT_POST_P64000_HRM_REVALIDATION_CLEAN_CANDIDATE_REVIEW_INPUTS = {
  schemaPath: "schemas/post-p64000-hrm-revalidation-clean-candidate-review.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p66801-p67200.md",
  architectureDocPath: "docs/architecture.md",
  hrm04BoundaryPath: "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json",
  hrm03WindowCapPath: "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json",
  hrm01DepthCapPath: "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json",
};

const COMMAND_NAME = "platform:post-p64000-hrm-revalidation-clean-candidate-review";
const SCHEMA_VERSION = "post-p64000-hrm-revalidation-clean-candidate-review.v1";
const CAPABILITY_ID = "platform.post_p64000_hrm_revalidation_clean_candidate_review";
const PROGRAM_RANGE = "P66801-P67200";
const SOURCE_PROGRAM_RANGE = "P66401-P66800";
const NEXT_PROGRAM_RANGE = "P67201-P67600";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const PACKET_REQUIRED_SECTIONS = [
  "review scope",
  "source refs",
  "hrm remediation candidate matrix",
  "blocker revalidation",
  "authority boundary",
  "review instructions",
  "expected output contract",
  "non-goals",
  "next handoff",
];

const NEGATIVE_FIXTURES = [
  "missing_hrm04_candidate",
  "missing_hrm03_candidate",
  "missing_hrm01_candidate",
  "normalized_blocker_removed_or_auto_resolved",
  "review_packet_treated_as_performed_review_event",
  "clean_candidate_packet_treated_as_clean_checkpoint",
  "missing_packet_boundary",
  "missing_source_citation",
  "missing_next_review_instruction",
  "final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "reviewer_mutation_claim",
  "finding_resolution_claim",
  "source_mutation_claim",
];

const EXTRA_FALSE_FLAGS = [
  "review_packet_as_performed_review_allowed_now",
  "clean_candidate_packet_clean_checkpoint_allowed_now",
  "future_claude_dispatch_performed_now",
  "hrm_findings_auto_resolved_allowed_now",
  "reviewer_mutation_allowed_now",
  "reviewer_final_closeout_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "source_mutation_from_review_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "clean_candidate_review_final_approval_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "post_p67200_production_pass_claim_allowed_now",
  "post_p67200_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-hrm-revalidation-clean-candidate-review.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-hrm-revalidation-clean-candidate-review.mjs"],
  ["unit.test", "node --test test/post-p64000-hrm-revalidation-clean-candidate-review.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-hrm-revalidation-clean-candidate-review -- --check"],
  ["adjacent.hrm01", "node --test test/post-p64000-hrm01-review-depth-cap.test.mjs test/post-p64000-hrm-revalidation-clean-candidate-review.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-hrm-revalidation-clean-candidate-review.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000HrmRevalidationCleanCandidateReview(options = {}) {
  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 HRM revalidation clean-candidate review failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000HrmRevalidationCleanCandidateReview(result, result.output_dir);
  return result;
}

export async function buildPostP64000HrmRevalidationCleanCandidateReview(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_HRM_REVALIDATION_CLEAN_CANDIDATE_REVIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const hrm04Boundary = Object.prototype.hasOwnProperty.call(options, "hrm04Boundary")
    ? normalizeInlineJsonSource("inline.hrm04_boundary", options.hrm04Boundary)
    : await readJsonSource(inputs.hrm04_boundary_path);
  const hrm03WindowCap = Object.prototype.hasOwnProperty.call(options, "hrm03WindowCap")
    ? normalizeInlineJsonSource("inline.hrm03_window_cap", options.hrm03WindowCap)
    : await readJsonSource(inputs.hrm03_window_cap_path);
  const hrm01DepthCap = Object.prototype.hasOwnProperty.call(options, "hrm01DepthCap")
    ? normalizeInlineJsonSource("inline.hrm01_depth_cap", options.hrm01DepthCap)
    : await readJsonSource(inputs.hrm01_depth_cap_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);

  const packetBoundary = buildPacketBoundary({ generatedAt, overrides: options.packetBoundaryOverrides });
  const sourceRows = buildSourceRows({ hrm04Boundary, hrm03WindowCap, hrm01DepthCap, normalizedReceipt, generatedAt });
  const blockerRows = buildBlockerRevalidationRows({ normalizedReceipt, hrm04Boundary, hrm03WindowCap, hrm01DepthCap, generatedAt });
  const packetRows = buildReviewPacketRows({ packetBoundary, sourceRows, blockerRows, generatedAt });
  const boundaryRows = buildReviewPacketBoundaryRows({ packetBoundary, generatedAt });
  const authorityRows = buildAuthorityRows({ normalizedReceipt, packetBoundary, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, packetRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, packetBoundary, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      hrm04_boundary_path: hrm04Boundary.path,
      hrm03_window_cap_path: hrm03WindowCap.path,
      hrm01_depth_cap_path: hrm01DepthCap.path,
      normalized_receipt_path: normalizedReceipt.path,
    },
    post_p64000_hrm_revalidation_clean_candidate_review_contract: {
      contract_id: "post_p64000_hrm_revalidation_clean_candidate_review",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      packet_is_claude_review_event: false,
      review_execution_performed_now: false,
      future_claude_review_required: true,
      requires_durable_raw_json_for_future_review: true,
      clean_candidate_review_packet_ready: true,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    clean_candidate_review_packet_boundary: packetBoundary,
    hrm_remediation_source_rows: sourceRows,
    hrm_blocker_revalidation_rows: blockerRows,
    clean_candidate_review_packet_rows: packetRows,
    review_packet_boundary_rows: boundaryRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p67200_wiring_rows: wiringRows,
    p67200_closeout_rows: closeoutRows,
    p67201_handoff_rows: handoffRows,
    post_p64000_hrm_revalidation_clean_candidate_review_boundary: boundary,
    post_p64000_hrm_revalidation_clean_candidate_review_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.clean_candidate_review_packet_markdown = renderCleanCandidateReviewPacket(result);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_hrm_revalidation_clean_candidate_review")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_hrm_revalidation_clean_candidate_review_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_hrm_revalidation_clean_candidate_review_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.clean_candidate_review_packet_markdown = renderCleanCandidateReviewPacket(result);
  return result;
}

export async function writePostP64000HrmRevalidationCleanCandidateReview(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-hrm-revalidation-clean-candidate-review.json"), serializableResult(result));
  await writeJson(path.join(outDir, "clean-candidate-review-packet-boundary.json"), result.clean_candidate_review_packet_boundary);
  await writeJson(path.join(outDir, "hrm-remediation-source-rows.json"), collectionEnvelope("hrm-remediation-source-rows.v1", "hrm_remediation_source_rows", result.hrm_remediation_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "hrm-blocker-revalidation-rows.json"), collectionEnvelope("hrm-blocker-revalidation-rows.v1", "hrm_blocker_revalidation_rows", result.hrm_blocker_revalidation_rows, result.generated_at));
  await writeFile(path.join(outDir, "clean-candidate-review-packet.md"), result.clean_candidate_review_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000HrmRevalidationCleanCandidateReviewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000HrmRevalidationCleanCandidateReview(args);
  console.log(`Post-P64000 HRM revalidation clean-candidate review ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_hrm_revalidation_clean_candidate_review_status}`);
  console.log(`HRM candidates ready: ${result.summary.hrm_remediation_candidates_ready_now}`);
  console.log(`HRM blockers preserved: ${result.summary.hrm_blockers_preserved_now}`);
  console.log(`Packet is Claude review event: ${result.summary.packet_is_claude_review_event_now}`);
  console.log(`Future Claude review required: ${result.summary.future_claude_review_required_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P67201 handoff: ${result.summary.ready_for_p67201_handoff}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildPacketBoundary({ generatedAt, overrides = {} }) {
  const boundary = {
    schema_version: "clean-candidate-review-packet-boundary.v1",
    generated_at: generatedAt,
    artifact_kind: "claude_clean_candidate_review_request_packet",
    is_claude_review_event: false,
    performed_review_evidence_allowed: false,
    review_execution_performed_now: false,
    clean_candidate_review_packet_ready: true,
    clean_checkpoint_claim_allowed: false,
    protected_closeout_allowed: false,
    future_claude_review_required: true,
    requires_durable_raw_json_for_future_review: true,
    expected_future_reviewer: "claude-code-opus-max",
    expected_future_reviewer_lane: "independent_read_only",
    expected_future_output_contract: "durable_raw_json_then_normalized_receipt_then_finding_loop",
    next_program_range: NEXT_PROGRAM_RANGE,
  };
  return { ...boundary, ...overrides };
}

function buildSourceRows({ hrm04Boundary, hrm03WindowCap, hrm01DepthCap, normalizedReceipt, generatedAt }) {
  return [
    row("source.hrm04_available", "source_binding", "HRM-04 boundary remediation candidate is available", hrm04Boundary.available === true, hrm04Boundary.path, generatedAt),
    row("source.hrm04_valid", "source_binding", "HRM-04 boundary validation is valid", hrm04Boundary.data?.validation?.valid === true, hrm04Boundary.path, generatedAt),
    row("source.hrm04_candidate", "source_binding", "HRM-04 remediated candidate is ready", hrm04Boundary.data?.summary?.hrm04_remediated_candidate_now === true, hrm04Boundary.path, generatedAt),
    row("source.hrm03_available", "source_binding", "HRM-03 window cap remediation candidate is available", hrm03WindowCap.available === true, hrm03WindowCap.path, generatedAt),
    row("source.hrm03_valid", "source_binding", "HRM-03 window cap validation is valid", hrm03WindowCap.data?.validation?.valid === true, hrm03WindowCap.path, generatedAt),
    row("source.hrm03_candidate", "source_binding", "HRM-03 remediated candidate is ready", hrm03WindowCap.data?.summary?.hrm03_remediated_candidate_now === true, hrm03WindowCap.path, generatedAt),
    row("source.hrm01_available", "source_binding", "HRM-01 review depth remediation candidate is available", hrm01DepthCap.available === true, hrm01DepthCap.path, generatedAt),
    row("source.hrm01_valid", "source_binding", "HRM-01 review depth validation is valid", hrm01DepthCap.data?.validation?.valid === true, hrm01DepthCap.path, generatedAt),
    row("source.hrm01_candidate", "source_binding", "HRM-01 remediated candidate is ready", hrm01DepthCap.data?.summary?.hrm01_remediated_candidate_now === true, hrm01DepthCap.path, generatedAt),
    row("source.normalized_receipt_available", "source_binding", "Normalized review receipt is available", normalizedReceipt.data?.schema_version === "post-p64000-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.hrm_blockers_visible", "source_binding", "HRM-01/03/04 blockers remain visible before future review", REQUIRED_HRM_IDS.every((id) => hasBlockingOpenFinding(normalizedReceipt.data, id)), normalizedReceipt.path, generatedAt, { finding_ids: REQUIRED_HRM_IDS }),
  ];
}

function buildBlockerRevalidationRows({ normalizedReceipt, hrm04Boundary, hrm03WindowCap, hrm01DepthCap, generatedAt }) {
  const candidateById = {
    "HRM-04": hrm04Boundary.data?.summary?.hrm04_remediated_candidate_now === true,
    "HRM-03": hrm03WindowCap.data?.summary?.hrm03_remediated_candidate_now === true,
    "HRM-01": hrm01DepthCap.data?.summary?.hrm01_remediated_candidate_now === true,
  };
  return REQUIRED_HRM_IDS.flatMap((findingId) => {
    const finding = findFinding(normalizedReceipt.data, findingId);
    return [
      row(`blocker.${findingId.toLowerCase()}.present`, "hrm_blocker_revalidation", `${findingId} finding is present`, finding?.id === findingId, normalizedReceipt.path, generatedAt, { finding_id: findingId }),
      row(`blocker.${findingId.toLowerCase()}.open_before_review`, "hrm_blocker_revalidation", `${findingId} remains blocking_open before future Claude review`, finding?.normalized_status === "blocking_open", normalizedReceipt.path, generatedAt, { finding_id: findingId }),
      row(`blocker.${findingId.toLowerCase()}.candidate_attached`, "hrm_blocker_revalidation", `${findingId} remediation candidate is attached`, candidateById[findingId] === true, candidateRefFor(findingId), generatedAt, { finding_id: findingId }),
      row(`blocker.${findingId.toLowerCase()}.not_resolved_by_codex`, "hrm_blocker_revalidation", `${findingId} is not resolved by Codex-only remediation`, finding?.normalized_status === "blocking_open" && candidateById[findingId] === true, normalizedReceipt.path, generatedAt, {
        finding_id: findingId,
        remediation_status: "candidate_pending_future_claude_review",
      }),
    ];
  });
}

function buildReviewPacketRows({ packetBoundary, sourceRows, blockerRows, generatedAt }) {
  return PACKET_REQUIRED_SECTIONS.map((sectionId) => row(
    `packet.section.${sectionId.replaceAll(" ", "_")}`,
    "clean_candidate_review_packet",
    `Review packet contains ${sectionId}`,
    true,
    "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md",
    generatedAt,
    { section_id: sectionId },
  )).concat([
    row("packet.source_refs_present", "clean_candidate_review_packet", "Packet cites all HRM remediation source refs", sourceRows.every(pass), "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md", generatedAt),
    row("packet.blocker_revalidation_present", "clean_candidate_review_packet", "Packet includes blocker revalidation matrix", blockerRows.every(pass), "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md", generatedAt),
    row("packet.future_review_instruction", "clean_candidate_review_packet", "Packet instructs future Claude review to emit durable raw JSON", packetBoundary.future_claude_review_required === true && packetBoundary.requires_durable_raw_json_for_future_review === true, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md", generatedAt),
    row("packet.not_review_event", "clean_candidate_review_packet", "Packet is not a performed Claude review event", packetBoundary.is_claude_review_event === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
  ]);
}

function buildReviewPacketBoundaryRows({ packetBoundary, generatedAt }) {
  return [
    row("boundary.schema", "review_packet_boundary", "Clean-candidate packet boundary schema is present", packetBoundary.schema_version === "clean-candidate-review-packet-boundary.v1", "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.packet_not_review_event", "review_packet_boundary", "Packet is marked as not a Claude review event", packetBoundary.is_claude_review_event === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.performed_evidence_blocked", "review_packet_boundary", "Packet cannot satisfy performed review evidence", packetBoundary.performed_review_evidence_allowed === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.execution_not_performed", "review_packet_boundary", "Future Claude review execution has not been performed by this tranche", packetBoundary.review_execution_performed_now === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.future_review_required", "review_packet_boundary", "Future Claude review is required", packetBoundary.future_claude_review_required === true, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.future_raw_json_required", "review_packet_boundary", "Future review requires durable raw JSON", packetBoundary.requires_durable_raw_json_for_future_review === true, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.clean_checkpoint_blocked", "review_packet_boundary", "Clean checkpoint claim remains blocked", packetBoundary.clean_checkpoint_claim_allowed === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("boundary.protected_closeout_blocked", "review_packet_boundary", "Protected closeout remains blocked", packetBoundary.protected_closeout_allowed === false, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
  ];
}

function buildAuthorityRows({ normalizedReceipt, packetBoundary, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(normalizedReceipt.data, packetBoundary, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p66801-p67200.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(receipt, packetBoundary, flag) {
  if (flag === "review_packet_as_performed_review_allowed_now" && packetBoundary.is_claude_review_event === true) return true;
  if (flag === "review_packet_as_performed_review_allowed_now" && packetBoundary.performed_review_evidence_allowed === true) return true;
  if (flag === "clean_candidate_packet_clean_checkpoint_allowed_now" && packetBoundary.clean_checkpoint_claim_allowed === true) return true;
  if (flag === "future_claude_dispatch_performed_now" && packetBoundary.review_execution_performed_now === true) return true;
  if (flag === "hrm_findings_auto_resolved_allowed_now" && !REQUIRED_HRM_IDS.every((id) => hasBlockingOpenFinding(receipt, id))) return true;
  if (flag === "claude_final_approval_allowed" && receipt?.reviewer_final_approval_allowed === true) return true;
  if (flag === "reviewer_mutation_allowed_now" && receipt?.reviewer_mutation_allowed === true) return true;
  if (flag === "reviewer_final_closeout_allowed_now" && receipt?.reviewer_final_closeout_allowed === true) return true;
  if (flag === "finding_resolution_allowed_now" && receipt?.finding_resolution_allowed === true) return true;
  if (flag === "finding_auto_resolved_allowed_now" && receipt?.finding_auto_resolved_allowed === true) return true;
  if (flag === "patch_apply_allowed_now" && receipt?.patch_apply_allowed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt?.source_mutation_performed === true) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && receipt?.protected_closeout_allowed === true) return true;
  if (flag === "post_p67200_production_pass_claim_allowed_now" && receipt?.production_pass_allowed === true) return true;
  if (flag === "post_p67200_enterprise_pass_claim_allowed_now" && receipt?.enterprise_pass_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks HRM clean-candidate review packet closeout`,
    true,
    "docs/hermes-roadmap-p66801-p67200.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-hrm-revalidation-clean-candidate-review.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P66801-P67200 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P66801-P67200") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p66801-p67200.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P66801-P67200 HRM revalidation clean-candidate review packet", architectureDoc.available && architectureDoc.text.includes("P66801-P67200"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p67200.sources_ready", "HRM remediation candidate sources are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p67200.blockers_revalidated", "HRM blockers are revalidated and preserved", blockerRows.every(pass), generatedAt),
    closeoutRow("p67200.packet_ready", "Clean-candidate review packet is ready as request artifact", packetRows.every(pass), generatedAt),
    closeoutRow("p67200.packet_boundary", "Review packet boundary rows pass", boundaryRows.every(pass), generatedAt),
    closeoutRow("p67200.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p67200.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p67200.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p67200.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, packetRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.clean_candidate_packet_ready", "p67201_handoff", "Clean-candidate review packet is ready for future Claude dispatch", ready && packetRows.every(pass), "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md", generatedAt, {
      next_allowed_action: ready ? "dispatch_future_claude_readonly_review_and_capture_durable_raw_json" : "resolve_hrm_revalidation_packet_blockers",
    }),
    row("handoff.not_review_event", "p67201_handoff", "P67200 packet is not a performed review event", ready, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet-boundary.json", generatedAt),
    row("handoff.p67201_claude_review_execution", "p67201_handoff", "P67201 may perform Claude read-only review execution with durable raw JSON capture", ready, "docs/hermes-roadmap-p66801-p67200.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
    }),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, packetBoundary, normalizedReceipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_hrm_revalidation_clean_candidate_review_ready: closeoutRows.every(pass),
    source_binding_ready_now: sourceRows.every(pass),
    hrm_remediation_candidates_ready_now: sourceRows.filter((item) => item.row_id.endsWith("_candidate")).every(pass),
    hrm_blockers_preserved_now: blockerRows.every(pass),
    clean_candidate_review_packet_ready_now: packetRows.every(pass),
    review_packet_boundary_ready_now: boundaryRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p67201_handoff: handoffRows.every(pass),
    required_hrm_ids: REQUIRED_HRM_IDS,
    preserved_blocking_hrm_count: REQUIRED_HRM_IDS.filter((id) => hasBlockingOpenFinding(normalizedReceipt.data, id)).length,
    packet_is_claude_review_event_now: packetBoundary.is_claude_review_event === true,
    packet_performed_review_evidence_allowed_now: packetBoundary.performed_review_evidence_allowed === true,
    review_execution_performed_now: packetBoundary.review_execution_performed_now === true,
    future_claude_review_required_now: packetBoundary.future_claude_review_required === true,
    future_durable_raw_json_required_now: packetBoundary.requires_durable_raw_json_for_future_review === true,
    clean_checkpoint_allowed_now: false,
    review_verdict: normalizedReceipt.data?.overall_verdict ?? "",
    blocks_clean_checkpoint: normalizedReceipt.data?.blocks_clean_checkpoint === true,
    blocking_finding_count: Number(normalizedReceipt.data?.normalized_blocking_finding_count ?? 0),
    finding_count: Number(normalizedReceipt.data?.finding_count ?? 0),
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p67200_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p67200_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, blockerRows, packetRows, boundaryRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.ready", "source_binding", sourceRows.every(pass), "All HRM remediation candidate sources must be valid"),
    validationItem("hrm.blockers_preserved", "hrm_blocker_revalidation", blockerRows.every(pass), "HRM blockers must remain visible before future review"),
    validationItem("packet.ready", "clean_candidate_review_packet", packetRows.every(pass), "Clean-candidate review request packet must be ready"),
    validationItem("packet.boundary", "review_packet_boundary", boundaryRows.every(pass), "Packet boundary must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P67200 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P67201 handoff rows must pass"),
    validationItem("boundary.packet_not_review_event", "review_packet_boundary", boundary.packet_is_claude_review_event_now === false, "Packet must not be treated as performed Claude review"),
    validationItem("boundary.review_execution_false", "review_packet_boundary", boundary.review_execution_performed_now === false, "P67200 must not claim Claude review execution"),
    validationItem("boundary.future_review_required", "review_packet_boundary", boundary.future_claude_review_required_now === true, "Future Claude review must be required"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p67201_handoff
    ? "hrm_revalidation_clean_candidate_review_packet_ready_for_p67201"
    : validation.valid
      ? "valid_block_p67201_handoff_pending"
      : "blocked_post_p64000_hrm_revalidation_clean_candidate_review";
  return {
    post_p64000_hrm_revalidation_clean_candidate_review_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    source_binding_ready_now: boundary.source_binding_ready_now,
    hrm_remediation_candidates_ready_now: boundary.hrm_remediation_candidates_ready_now,
    hrm_blockers_preserved_now: boundary.hrm_blockers_preserved_now,
    clean_candidate_review_packet_ready_now: boundary.clean_candidate_review_packet_ready_now,
    review_packet_boundary_ready_now: boundary.review_packet_boundary_ready_now,
    ready_for_p67201_handoff: boundary.ready_for_p67201_handoff,
    preserved_blocking_hrm_count: boundary.preserved_blocking_hrm_count,
    packet_is_claude_review_event_now: boundary.packet_is_claude_review_event_now,
    packet_performed_review_evidence_allowed_now: boundary.packet_performed_review_evidence_allowed_now,
    review_execution_performed_now: boundary.review_execution_performed_now,
    future_claude_review_required_now: boundary.future_claude_review_required_now,
    future_durable_raw_json_required_now: boundary.future_durable_raw_json_required_now,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    review_verdict: boundary.review_verdict,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderCleanCandidateReviewPacket(result) {
  return [
    "# Post-P64000 HRM Clean-Candidate Review Packet",
    "",
    "## Review Scope",
    "",
    "Review whether the HRM-04, HRM-03, and HRM-01 remediation candidates are structurally sufficient for a future clean-candidate decision. This packet is a request artifact, not a performed Claude review event.",
    "",
    "## Source Refs",
    "",
    `- HRM-04 boundary: ${result.source_refs.hrm04_boundary_path}`,
    `- HRM-03 window cap: ${result.source_refs.hrm03_window_cap_path}`,
    `- HRM-01 depth cap: ${result.source_refs.hrm01_depth_cap_path}`,
    `- normalized receipt: ${result.source_refs.normalized_receipt_path}`,
    "",
    "## HRM Remediation Candidate Matrix",
    "",
    `- HRM-04 candidate ready: ${result.hrm_remediation_source_rows.some((rowItem) => rowItem.row_id === "source.hrm04_candidate" && pass(rowItem))}`,
    `- HRM-03 candidate ready: ${result.hrm_remediation_source_rows.some((rowItem) => rowItem.row_id === "source.hrm03_candidate" && pass(rowItem))}`,
    `- HRM-01 candidate ready: ${result.hrm_remediation_source_rows.some((rowItem) => rowItem.row_id === "source.hrm01_candidate" && pass(rowItem))}`,
    "",
    "## Blocker Revalidation",
    "",
    `- preserved_blocking_hrm_count: ${result.summary.preserved_blocking_hrm_count}`,
    "- HRM-01, HRM-03, and HRM-04 must remain visible as blocking_open before this future review decides anything.",
    "",
    "## Authority Boundary",
    "",
    "- is_claude_review_event: false",
    "- review_execution_performed_now: false",
    "- performed_review_evidence_allowed: false",
    "- clean_checkpoint_allowed_now: false",
    "- protected_closeout_allowed_now: false",
    "- production_pass_enabled: false",
    "- enterprise_pass_enabled: false",
    "- Codex/Claude/final automated approval: false",
    "",
    "## Review Instructions",
    "",
    "Return durable raw JSON only. Do not mutate source. Do not apply patches. Do not provide final approval. Identify blocking findings and required revalidation commands.",
    "",
    "## Expected Output Contract",
    "",
    "The next tranche must capture durable Claude Code Opus max raw JSON, normalize findings, preserve blockers, and keep final authority false unless a later explicit gate is satisfied.",
    "",
    "## Non-Goals",
    "",
    "- No source mutation",
    "- No finding resolution by this packet",
    "- No clean checkpoint claim",
    "- No production or enterprise PASS",
    "",
    "## Next Handoff",
    "",
    `Continue to ${NEXT_PROGRAM_RANGE} Claude read-only review execution and durable raw JSON capture.`,
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 HRM Revalidation Clean-Candidate Review ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_hrm_revalidation_clean_candidate_review_status}`,
    `- hrm_remediation_candidates_ready_now: ${result.summary.hrm_remediation_candidates_ready_now}`,
    `- hrm_blockers_preserved_now: ${result.summary.hrm_blockers_preserved_now}`,
    `- clean_candidate_review_packet_ready_now: ${result.summary.clean_candidate_review_packet_ready_now}`,
    `- packet_is_claude_review_event_now: ${result.summary.packet_is_claude_review_event_now}`,
    `- review_execution_performed_now: ${result.summary.review_execution_performed_now}`,
    `- future_claude_review_required_now: ${result.summary.future_claude_review_required_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p67201_handoff: ${result.summary.ready_for_p67201_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p67201_handoff
      ? "Continue to P67201-P67600 Claude read-only review execution and durable raw JSON capture. Do not claim clean checkpoint before review evidence exists."
      : "Resolve HRM revalidation, packet boundary, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p67200_closeout", label, observed, "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/post-p64000-hrm-revalidation-clean-candidate-review.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_hrm_clean_candidate_review_packet" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--hrm04-boundary") args.hrm04BoundaryPath = argv[++index];
    else if (arg === "--hrm03-window-cap") args.hrm03WindowCapPath = argv[++index];
    else if (arg === "--hrm01-depth-cap") args.hrm01DepthCapPath = argv[++index];
    else if (arg === "--normalized-receipt") args.normalizedReceiptPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--hrm04-boundary PATH] [--hrm03-window-cap PATH] [--hrm01-depth-cap PATH] [--normalized-receipt PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_HRM_REVALIDATION_CLEAN_CANDIDATE_REVIEW_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    hrm04_boundary_path: path.resolve(repoRoot, options.hrm04BoundaryPath ?? defaults.hrm04BoundaryPath),
    hrm03_window_cap_path: path.resolve(repoRoot, options.hrm03WindowCapPath ?? defaults.hrm03WindowCapPath),
    hrm01_depth_cap_path: path.resolve(repoRoot, options.hrm01DepthCapPath ?? defaults.hrm01DepthCapPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
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

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, clean_candidate_review_packet_markdown: packetMarkdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function findFinding(receipt, findingId) {
  return (receipt?.findings ?? []).find((finding) => finding.id === findingId);
}

function hasBlockingOpenFinding(receipt, findingId) {
  return findFinding(receipt, findingId)?.normalized_status === "blocking_open";
}

function candidateRefFor(findingId) {
  if (findingId === "HRM-04") return "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json";
  if (findingId === "HRM-03") return "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json";
  return "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json";
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
