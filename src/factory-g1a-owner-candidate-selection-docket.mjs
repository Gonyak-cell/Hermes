import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import { buildFactoryG1aOwnerSigningHandoff } from "./factory-g1a-owner-signing-handoff.mjs";

export const DEFAULT_FACTORY_G1A_OWNER_CANDIDATE_SELECTION_DOCKET_OUT_DIR = "artifacts/factory-g1a-owner-candidate-selection-docket/latest";
export const DEFAULT_FACTORY_G1A_OWNER_CANDIDATE_SELECTION_DOCKET_INPUTS = {
  packagePath: "package.json",
};

const COMMAND_NAME = "factory:g1a-owner-candidate-selection-docket";
const SCHEMA_VERSION = "factory-g1a-owner-candidate-selection-docket.v1";
const CAPABILITY_ID = "factory.g1a_owner_candidate_selection_docket";
const PROGRAM_RANGE = "G-SERIES.1a.owner-candidate-selection-docket";
const READY_STATUS = "ready_g1a_owner_candidate_selection_docket";
const BLOCKED_STATUS = "blocked_g1a_owner_candidate_selection_docket";
const REVIEW_MODEL = "claude-opus-4-8";
const REVIEW_EFFORT = "max";
const DEFAULT_MINIMUM_ELIGIBLE_CANDIDATE_COUNT = 3;
const HASH_RE = /^[a-f0-9]{64}$/;

const CLOSED_AUTHORITY_FLAGS = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  command_execution_enabled: false,
  command_execution_allowed_now: false,
  work_packet_execution_allowed_now: false,
  work_item_execution_allowed_now: false,
  validation_loop_execution_allowed_now: false,
  worker_execution_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryG1aOwnerCandidateSelectionDocket(options = {}) {
  const result = await buildFactoryG1aOwnerCandidateSelectionDocket(options);
  if (!options.check && options.write !== false) await writeFactoryG1aOwnerCandidateSelectionDocket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G1a Owner Candidate Selection Docket failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g1a_owner_candidate_selection_docket_status !== READY_STATUS) {
    const error = new Error("Factory G1a Owner Candidate Selection Docket is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryG1aOwnerCandidateSelectionDocket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G1A_OWNER_CANDIDATE_SELECTION_DOCKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const minimumEligibleCandidateCount = Number(options.minimumEligibleCandidateCount ?? DEFAULT_MINIMUM_ELIGIBLE_CANDIDATE_COUNT);
  const packageJson = await readJsonSource(inputs.package_path);
  const candidateReviewDocket = Object.prototype.hasOwnProperty.call(options, "candidateReviewDocket")
    ? options.candidateReviewDocket
    : await buildFactoryCandidateReviewDocket({
      ...options,
      outDir: path.join(outputDir, "source-candidate-review-docket"),
      runAt: generatedAt,
      write: false,
    });
  const selectionRequest = normalizeSelectionRequest(options);
  const ownerSigningHandoff = await buildFactoryG1aOwnerSigningHandoff({
    ...options,
    runAt: generatedAt,
    write: false,
    boundCandidatePacketSha256: selectionRequest.selected_candidate_packet_sha256 ?? undefined,
    boundCandidateManifestSha256: selectionRequest.selected_candidate_manifest_sha256 ?? undefined,
  });
  const selectionRows = buildSelectionRows({ candidateReviewDocket, selectionRequest, generatedAt });
  const prebindCommandRows = buildPrebindCommandRows({ selectionRows, generatedAt });
  const selectionPolicy = buildSelectionPolicy({ selectionRows, selectionRequest, generatedAt });
  const sourceChainRows = buildSourceChainRows({ candidateReviewDocket, ownerSigningHandoff, selectionRows, selectionPolicy, generatedAt });
  const independentReviewPacket = buildIndependentReviewPacket({ generatedAt, outputDir });
  const reviewSchema = buildReviewSchema();
  const reviewRequest = buildReviewRequest({ generatedAt, outputDir, reviewSchema });
  const boundary = buildBoundary({ selectionRows, selectionPolicy, sourceChainRows, ownerSigningHandoff, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    candidateReviewDocket,
    ownerSigningHandoff,
    selectionRows,
    prebindCommandRows,
    selectionPolicy,
    sourceChainRows,
    boundary,
    minimumEligibleCandidateCount,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ selectionRows, selectionPolicy, sourceChainRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      candidate_review_docket_ref: candidateReviewDocket.output_dir ?? "built.factory_candidate_review_docket",
      owner_signing_handoff_ref: ownerSigningHandoff.output_dir ?? "built.factory_g1a_owner_signing_handoff",
      review_prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    },
    source_summaries: {
      candidate_review_docket_status: candidateReviewDocket.summary?.factory_candidate_review_docket_status ?? null,
      candidate_review_docket_validation_valid: candidateReviewDocket.validation?.valid === true,
      candidate_packet_count: candidateReviewDocket.summary?.candidate_packet_count ?? 0,
      owner_signing_handoff_status: ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status ?? null,
      owner_signing_handoff_validation_valid: ownerSigningHandoff.validation?.valid === true,
      owner_signing_handoff_candidate_hash_bound_now: ownerSigningHandoff.summary?.candidate_hash_bound_now ?? false,
    },
    selection_policy: selectionPolicy,
    g1a_owner_candidate_selection_rows: selectionRows,
    owner_prebind_command_rows: prebindCommandRows,
    source_chain_rows: sourceChainRows,
    owner_signing_handoff_preview: summarizeOwnerSigningHandoffPreview(ownerSigningHandoff),
    independent_review_packet: independentReviewPacket,
    review_request: reviewRequest,
    review_schema: reviewSchema,
    factory_g1a_owner_candidate_selection_docket_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    _source_candidate_review_docket_result: candidateReviewDocket,
    _source_owner_signing_handoff_result: ownerSigningHandoff,
    review_prompt: renderReviewPrompt(result),
    markdown: renderMarkdown(result),
  };
}

export async function writeFactoryG1aOwnerCandidateSelectionDocket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g1a-owner-candidate-selection-docket.json"), serializableResult(result));
  await writeJson(path.join(outDir, "candidate-selection-rows.json"), collectionEnvelope("factory-g1a-owner-candidate-selection-rows.v1", "g1a_owner_candidate_selection_rows", result.g1a_owner_candidate_selection_rows, result.generated_at));
  await writeJson(path.join(outDir, "owner-prebind-command-rows.json"), collectionEnvelope("factory-g1a-owner-prebind-command-rows.v1", "owner_prebind_command_rows", result.owner_prebind_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "selection-policy.json"), result.selection_policy);
  await writeJson(path.join(outDir, "source-chain-rows.json"), collectionEnvelope("factory-g1a-owner-candidate-selection-source-chain-rows.v1", "source_chain_rows", result.source_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-packet.json"), result.independent_review_packet);
  await writeJson(path.join(outDir, "review-request.json"), result.review_request);
  await writeJson(path.join(outDir, "review-schema.json"), result.review_schema);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g1a_owner_candidate_selection_docket_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g1a-owner-candidate-selection-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "review-prompt.md"), result.review_prompt, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryG1aOwnerCandidateSelectionDocketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryG1aOwnerCandidateSelectionDocket(args);
    console.log(`Factory G1a Owner Candidate Selection Docket ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g1a_owner_candidate_selection_docket_status}`);
    console.log(`Eligible candidates: ${result.summary.eligible_candidate_count}`);
    console.log(`Selected candidate now: ${result.summary.selected_candidate_now}`);
    console.log(`Candidate hash bound now: ${result.summary.candidate_hash_bound_now}`);
    console.log(`Owner selection required: ${result.summary.owner_selection_required_now}`);
    console.log(`G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_G1A_OWNER_CANDIDATE_SELECTION_DOCKET_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
  };
}

function normalizeSelectionRequest(options) {
  const packetSha = normalizeSha(options.selectedCandidatePacketSha256 ?? options.boundCandidatePacketSha256);
  const manifestSha = normalizeSha(options.selectedCandidateManifestSha256 ?? options.boundCandidateManifestSha256);
  return {
    schema_version: "factory-g1a-owner-candidate-selection-request.v1",
    selected_candidate_packet_sha256: packetSha,
    selected_candidate_manifest_sha256: manifestSha,
    selected_candidate_now: Boolean(packetSha || manifestSha),
    exactly_one_hash_selected_now: Boolean(packetSha || manifestSha) && !(packetSha && manifestSha),
  };
}

function buildSelectionRows({ candidateReviewDocket, selectionRequest, generatedAt }) {
  const rows = candidateReviewDocket.factory_candidate_review_docket_rows ?? [];
  return rows.map((row) => {
    const eligible = isEligibleCandidateRow(row);
    const selectedByPacket = Boolean(selectionRequest.selected_candidate_packet_sha256)
      && row.candidate_packet_sha256 === selectionRequest.selected_candidate_packet_sha256;
    const selectedByManifest = Boolean(selectionRequest.selected_candidate_manifest_sha256)
      && row.candidate_manifest_sha256 === selectionRequest.selected_candidate_manifest_sha256;
    const selectedNow = selectedByPacket || selectedByManifest;
    const draft = {
      schema_version: "factory-g1a-owner-candidate-selection-row.v1",
      selection_row_id: `g1a-owner-candidate-selection.${normalizeKey(row.product_id)}.g1a`,
      review_docket_id: row.review_docket_id,
      product_id: row.product_id,
      candidate_packet_id: row.candidate_packet_id,
      candidate_manifest_id: row.candidate_manifest_id,
      candidate_packet_sha256: row.candidate_packet_sha256,
      candidate_manifest_sha256: row.candidate_manifest_sha256,
      candidate_hash_bound_to_manifest: row.candidate_hash_bound_to_manifest,
      review_status: row.review_status,
      preflight_status: row.preflight_status,
      preflight_executed_now: row.preflight_executed_now,
      eligible_for_owner_selection_now: eligible,
      eligibility_status: eligible ? "eligible_owner_can_select_hash" : "ineligible_fail_closed",
      selected_now: selectedNow,
      selection_source: selectedNow ? (selectedByPacket ? "candidate_packet_sha256" : "candidate_manifest_sha256") : null,
      owner_selection_required_now: !selectionRequest.selected_candidate_now,
      independent_review_required_before_apply: true,
      owner_signature_required_before_opening: true,
      selection_is_not_signature: true,
      selection_opens_gate_now: false,
      owner_prebind_packet_command: `npm run factory:g1a-owner-signing-handoff -- --bound-candidate-packet-sha256 ${row.candidate_packet_sha256} --check --require-pass`,
      owner_prebind_manifest_command: `npm run factory:g1a-owner-signing-handoff -- --bound-candidate-manifest-sha256 ${row.candidate_manifest_sha256} --check --require-pass`,
      next_allowed_action: selectedNow ? "owner_may_use_prebind_command_then_sign_receipt_manually" : "owner_may_select_this_candidate_hash_without_applying",
      ...CLOSED_AUTHORITY_FLAGS,
      generated_at: generatedAt,
    };
    return { ...draft, selection_row_sha256: sha256(canonicalize(draft)) };
  });
}

function isEligibleCandidateRow(row) {
  return isSha(row?.candidate_packet_sha256)
    && isSha(row?.candidate_manifest_sha256)
    && row?.candidate_hash_bound_to_manifest === true
    && row?.preflight_status === "passed"
    && row?.preflight_executed_now === true
    && row?.review_status === "review_required_not_approved"
    && row?.approval_allowed_now === false
    && row?.apply_allowed_now === false;
}

function buildPrebindCommandRows({ selectionRows, generatedAt }) {
  return selectionRows.flatMap((row) => [
    prebindCommandRow(row, "candidate_packet_sha256", row.candidate_packet_sha256, row.owner_prebind_packet_command, generatedAt),
    prebindCommandRow(row, "candidate_manifest_sha256", row.candidate_manifest_sha256, row.owner_prebind_manifest_command, generatedAt),
  ]);
}

function prebindCommandRow(selectionRow, hashKind, hashValue, command, generatedAt) {
  const draft = {
    schema_version: "factory-g1a-owner-prebind-command-row.v1",
    command_row_id: `${selectionRow.selection_row_id}.${hashKind}`,
    selection_row_id: selectionRow.selection_row_id,
    product_id: selectionRow.product_id,
    candidate_packet_id: selectionRow.candidate_packet_id,
    candidate_manifest_id: selectionRow.candidate_manifest_id,
    hash_kind: hashKind,
    hash_value: hashValue,
    command,
    command_is_preview_only: true,
    command_signs_receipt_now: false,
    command_opens_gate_now: false,
    command_mutates_source_now: false,
    command_allowed_for_owner_after_selection: selectionRow.eligible_for_owner_selection_now,
    ...CLOSED_AUTHORITY_FLAGS,
    generated_at: generatedAt,
  };
  return { ...draft, command_row_sha256: sha256(canonicalize(draft)) };
}

function buildSelectionPolicy({ selectionRows, selectionRequest, generatedAt }) {
  const selectedRows = selectionRows.filter((row) => row.selected_now);
  const eligibleRows = selectionRows.filter((row) => row.eligible_for_owner_selection_now);
  const policy = {
    schema_version: "factory-g1a-owner-candidate-selection-policy.v1",
    policy_id: "g1a.owner_candidate_hash_selection",
    generated_at: generatedAt,
    policy_status: eligibleRows.length > 0 ? "owner_selection_ready" : "owner_selection_blocked_no_eligible_candidates",
    owner_must_select_exactly_one_candidate_hash_before_signing: true,
    no_default_selection_allowed: true,
    codex_selection_allowed_now: false,
    claude_selection_allowed_now: false,
    fable_selection_allowed_now: false,
    selected_candidate_now: selectionRequest.selected_candidate_now,
    exactly_one_hash_selected_now: selectionRequest.exactly_one_hash_selected_now && selectedRows.length === 1,
    selected_candidate_packet_sha256: selectedRows[0]?.candidate_packet_sha256 ?? null,
    selected_candidate_manifest_sha256: selectedRows[0]?.candidate_manifest_sha256 ?? null,
    selected_product_id: selectedRows[0]?.product_id ?? null,
    selected_candidate_packet_id: selectedRows[0]?.candidate_packet_id ?? null,
    selected_candidate_manifest_id: selectedRows[0]?.candidate_manifest_id ?? null,
    selected_row_count: selectedRows.length,
    eligible_candidate_count: eligibleRows.length,
    selection_is_hash_binding_only: true,
    selection_signs_owner_receipt_now: false,
    selection_opens_gate_now: false,
    selection_mutates_source_now: false,
    owner_selection_required_now: !selectionRequest.selected_candidate_now,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...policy, selection_policy_sha256: sha256(canonicalize(policy)) };
}

function buildSourceChainRows({ candidateReviewDocket, ownerSigningHandoff, selectionRows, selectionPolicy, generatedAt }) {
  return [
    sourceChainRow("source.fc3_candidate_review_docket_ready", "source", candidateReviewDocket.validation?.valid === true && candidateReviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket", "FC.3 candidate review docket is ready", generatedAt),
    sourceChainRow("source.owner_signing_handoff_ready", "source", ownerSigningHandoff.validation?.valid === true && ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status === "ready_g1a_owner_signature_handoff", "G1a owner signing handoff remains ready", generatedAt),
    sourceChainRow("selection.eligible_candidates_present", "selection", selectionRows.some((row) => row.eligible_for_owner_selection_now), "At least one eligible candidate hash is visible to owner", generatedAt),
    sourceChainRow("selection.no_default_selection", "selection", selectionPolicy.no_default_selection_allowed === true && (!selectionPolicy.selected_candidate_now || selectionPolicy.exactly_one_hash_selected_now), "No default selection is made; explicit selected hash must match exactly one row", generatedAt),
    sourceChainRow("authority.no_opening", "authority", authorityFlagsClosed(selectionPolicy) && ownerSigningHandoff.summary?.g1a_project_creation_gate_open_now === false, "Candidate selection docket does not sign, apply, or open G1a", generatedAt),
  ];
}

function sourceChainRow(rowId, category, passed, message, generatedAt) {
  const row = {
    schema_version: "factory-g1a-owner-candidate-selection-source-chain-row.v1",
    row_id: rowId,
    category,
    current_verdict: passed ? "pass" : "fail",
    message,
    generated_at: generatedAt,
  };
  return { ...row, row_sha256: sha256(canonicalize(row)) };
}

function buildIndependentReviewPacket({ generatedAt, outputDir }) {
  const rawOutputPath = relativeArtifactPath(outputDir, "raw-output.json");
  const promptPath = relativeArtifactPath(outputDir, "review-prompt.md");
  const packet = {
    schema_version: "factory-g1a-owner-candidate-selection-review-packet.v1",
    review_id: "G-SERIES.G1a.owner-candidate-selection-docket",
    generated_at: generatedAt,
    review_status: "packet_ready_review_not_run",
    method: "law_firm_os_style_claude_opus_4_8_max_compact_packet",
    reviewer_lane: "Claude Code Opus max",
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    permission_mode: "dontAsk",
    read_only: true,
    prompt_path: promptPath,
    raw_output_path: rawOutputPath,
    review_request_path: relativeArtifactPath(outputDir, "review-request.json"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    launch_command: `claude -p "$(cat ${promptPath})" --model ${REVIEW_MODEL} --effort ${REVIEW_EFFORT} --permission-mode dontAsk --output-format json --max-budget-usd 4 --no-session-persistence > ${rawOutputPath}`,
    evidence_validation_command: `npm run factory:claude-review-evidence -- --review-id g1a-owner-candidate-selection-docket-opus-4-8-lawos-style --program-range ${PROGRAM_RANGE} --raw-review ${rawOutputPath} --prompt ${promptPath} --out-dir ${relativeArtifactPath(outputDir, "evidence-validation")} --check --require-valid`,
    review_questions: [
      "Does the docket expose only eligible FC.3 candidate packet and manifest hashes for owner selection?",
      "Does it avoid choosing a default candidate on behalf of the owner?",
      "If a selected hash is provided, does it match exactly one candidate row and only pre-bind the signing handoff?",
      "Does every preview command keep receipt signing, source mutation, approval, apply, and G1a opening closed?",
      "Does the Review API expose this data read-only and deny mutating methods?",
    ],
    invalid_evidence_rules: [
      "empty output is invalid",
      "auth or login failure is invalid",
      "quota or usage-limit failure is invalid",
      "interrupted or cancelled output is invalid",
      "malformed JSON review payload is invalid",
      "tool-call-shaped output without verdict is invalid",
      "Claude final approval, production PASS, enterprise PASS, source mutation, owner signature, or owner selection claims invalidate the evidence",
    ],
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...packet, packet_sha256: sha256(canonicalize(packet)) };
}

function buildReviewRequest({ generatedAt, outputDir, reviewSchema }) {
  const request = {
    schema_version: "hermes.g1a-owner-candidate-selection-review-request.v1",
    created_at: generatedAt,
    scope_id: "factory_g1a_owner_candidate_selection_docket",
    program_range: PROGRAM_RANGE,
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
    output_format: "json",
    raw_output_path: relativeArtifactPath(outputDir, "raw-output.json"),
    prompt_path: relativeArtifactPath(outputDir, "review-prompt.md"),
    review_schema_path: relativeArtifactPath(outputDir, "review-schema.json"),
    review_schema_sha256: sha256(canonicalize(reviewSchema)),
    counts_as_final_approval: false,
    selects_owner_candidate_now: false,
    opens_gate_now: false,
    signs_owner_receipt_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
  return { ...request, review_request_sha256: sha256(canonicalize(request)) };
}

function buildReviewSchema() {
  return {
    schema_version: "hermes.g1a-owner-candidate-selection-review-schema.v1",
    type: "object",
    additionalProperties: false,
    required: [
      "verdict",
      "blocking_findings",
      "non_blocking_findings",
      "changes_required_before_commit",
      "validated_commands",
      "review_notes",
      "engine_resolved_model_id",
      "is_final_approval",
      "production_pass_enabled",
      "enterprise_pass_enabled",
      "source_mutation_performed",
      "owner_signature_performed",
      "owner_selection_performed",
    ],
    properties: {
      verdict: { enum: ["APPROVE", "APPROVE_WITH_FINDINGS", "BLOCK"] },
      blocking_findings: { type: "array" },
      non_blocking_findings: { type: "array" },
      changes_required_before_commit: { type: "boolean" },
      validated_commands: { type: "array", items: { type: "string" } },
      review_notes: { type: "string" },
      engine_resolved_model_id: { type: "string" },
      is_final_approval: { const: false },
      production_pass_enabled: { const: false },
      enterprise_pass_enabled: { const: false },
      source_mutation_performed: { const: false },
      owner_signature_performed: { const: false },
      owner_selection_performed: { const: false },
    },
  };
}

function buildBoundary({ selectionRows, selectionPolicy, sourceChainRows, ownerSigningHandoff, generatedAt }) {
  const failCount = sourceChainRows.filter((row) => row.current_verdict === "fail").length;
  const eligibleCandidateCount = selectionRows.filter((row) => row.eligible_for_owner_selection_now).length;
  const selectedCandidateNow = selectionPolicy.selected_candidate_now && selectionPolicy.exactly_one_hash_selected_now;
  return {
    schema_version: "factory-g1a-owner-candidate-selection-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    docket_only: true,
    owner_selection_required_now: !selectedCandidateNow,
    eligible_candidate_count: eligibleCandidateCount,
    selected_candidate_now: selectedCandidateNow,
    candidate_hash_bound_now: selectedCandidateNow && ownerSigningHandoff.summary?.candidate_hash_bound_now === true,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    opens_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
    source_chain_fail_count: failCount,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({
  packageJson,
  candidateReviewDocket,
  ownerSigningHandoff,
  selectionRows,
  prebindCommandRows,
  selectionPolicy,
  sourceChainRows,
  boundary,
  minimumEligibleCandidateCount,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script_registered", "package", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g1a-owner-candidate-selection-docket.mjs"), "package.json does not register factory:g1a-owner-candidate-selection-docket"),
    validationItem("source.candidate_review_docket_ready", "source", candidateReviewDocket.validation?.valid === true && candidateReviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket", "Source candidate review docket is not ready"),
    validationItem("source.owner_signing_handoff_ready", "source", ownerSigningHandoff.validation?.valid === true && ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status === "ready_g1a_owner_signature_handoff", "Owner signing handoff is not ready"),
    validationItem("selection.eligible_count", "selection", selectionRows.filter((row) => row.eligible_for_owner_selection_now).length >= minimumEligibleCandidateCount, `At least ${minimumEligibleCandidateCount} eligible candidate(s) are required`),
    validationItem("selection.rows_eligible", "selection", selectionRows.length > 0 && selectionRows.every((row) => row.eligible_for_owner_selection_now && isSha(row.selection_row_sha256)), "Every candidate selection row must be eligible and hash-bound"),
    validationItem("selection.explicit_match", "selection", !selectionPolicy.selected_candidate_now || selectionPolicy.exactly_one_hash_selected_now, "Selected candidate hash must match exactly one row and only one hash kind"),
    validationItem("commands.preview_only", "command", prebindCommandRows.length === selectionRows.length * 2 && prebindCommandRows.every((row) => row.command_is_preview_only === true && row.command_signs_receipt_now === false && row.command_opens_gate_now === false && row.command_mutates_source_now === false), "Prebind commands must be preview-only and non-mutating"),
    validationItem("source_chain.no_failures", "source_chain", sourceChainRows.every((row) => row.current_verdict === "pass"), "Source chain has failed rows"),
    validationItem("boundary.authority_closed", "authority", authorityClosed(boundary), "Candidate selection docket opened forbidden authority"),
  ];
}

function buildSummary({ selectionRows, selectionPolicy, sourceChainRows, boundary, validation }) {
  const ready = validation.valid === true && authorityClosed(boundary);
  return {
    factory_g1a_owner_candidate_selection_docket_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    owner_selection_required_now: boundary.owner_selection_required_now,
    selected_candidate_now: boundary.selected_candidate_now,
    candidate_hash_bound_now: boundary.candidate_hash_bound_now,
    selected_product_id: selectionPolicy.selected_product_id,
    selected_candidate_packet_id: selectionPolicy.selected_candidate_packet_id,
    selected_candidate_manifest_id: selectionPolicy.selected_candidate_manifest_id,
    eligible_candidate_count: boundary.eligible_candidate_count,
    selection_row_count: selectionRows.length,
    prebind_command_count: selectionRows.length * 2,
    source_chain_pass_count: sourceChainRows.filter((row) => row.current_verdict === "pass").length,
    source_chain_fail_count: boundary.source_chain_fail_count,
    signs_owner_receipt_now: false,
    source_mutation_allowed_now: false,
    source_literal_opening_commit_applied_now: false,
    first_use_audit_present: false,
    opens_gate_now: false,
    g1a_project_creation_gate_open_now: false,
    project_creation_allowed_now: false,
    factory_promotion_goal_complete_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function summarizeOwnerSigningHandoffPreview(ownerSigningHandoff) {
  return {
    schema_version: "factory-g1a-owner-signing-handoff-preview.v1",
    status: ownerSigningHandoff.summary?.factory_g1a_owner_signing_handoff_status ?? null,
    candidate_hash_bound_now: ownerSigningHandoff.summary?.candidate_hash_bound_now ?? false,
    ready_for_owner_signature_now: ownerSigningHandoff.summary?.ready_for_owner_signature_now ?? false,
    owner_gate_opening_receipt_signed_now: false,
    signs_owner_receipt_now: false,
    g1a_project_creation_gate_open_now: false,
    source_mutation_allowed_now: false,
    signable_receipt_draft_sha256: ownerSigningHandoff.summary?.signable_receipt_draft_sha256 ?? null,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g1a-owner-candidate-selection-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
  }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function renderReviewPrompt(result) {
  return [
    `You are the independent Claude Code Opus Max reviewer for Hermes ${PROGRAM_RANGE}.`,
    "",
    "Review only the compact packet and listed source/test/doc files. Do not edit files. Do not choose a candidate for the owner. Do not sign owner receipts. Do not claim final approval, production PASS, enterprise PASS, source mutation, protected closeout, or that G1a is open.",
    "Return JSON only, with no markdown fences.",
    "",
    `Artifact root: ${relativeArtifactPath(result.output_dir)}`,
    "",
    "Read these files first:",
    "- artifacts/factory-g1a-owner-candidate-selection-docket/latest/factory-g1a-owner-candidate-selection-docket.json",
    "- artifacts/factory-g1a-owner-candidate-selection-docket/latest/candidate-selection-rows.json",
    "- artifacts/factory-g1a-owner-candidate-selection-docket/latest/owner-prebind-command-rows.json",
    "- src/factory-g1a-owner-candidate-selection-docket.mjs",
    "- src/factory-candidate-review-docket.mjs",
    "- src/factory-g1a-owner-signing-handoff.mjs",
    "- src/review-api.mjs",
    "- test/factory-g1a-owner-candidate-selection-docket.test.mjs",
    "- docs/factory-promotion/g1a-owner-candidate-selection-docket.md",
    "",
    "Review questions:",
    ...result.independent_review_packet.review_questions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "Required JSON shape:",
    JSON.stringify({
      verdict: "APPROVE_WITH_FINDINGS or APPROVE or BLOCK",
      blocking_findings: [],
      non_blocking_findings: [],
      changes_required_before_commit: false,
      validated_commands: [
        "node --check src/factory-g1a-owner-candidate-selection-docket.mjs scripts/factory-g1a-owner-candidate-selection-docket.mjs src/review-api.mjs scripts/review-api-smoke.mjs : observed-or-not-run",
        "node --test test/factory-g1a-owner-candidate-selection-docket.test.mjs : observed-or-not-run",
        "npm run factory:g1a-owner-candidate-selection-docket -- --check --require-pass : observed-or-not-run",
        "npm run api:smoke : observed-or-not-run",
        "npm run contracts:validate -- --check : observed-or-not-run",
        "git diff --check : observed-or-not-run",
      ],
      review_notes: "string",
      engine_resolved_model_id: REVIEW_MODEL,
      is_final_approval: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      source_mutation_performed: false,
      owner_signature_performed: false,
      owner_selection_performed: false,
    }, null, 2),
    "",
    "Authority boundary that must remain true:",
    JSON.stringify({
      owner_selection_performed: false,
      owner_gate_opening_receipt_signed_now: false,
      signs_owner_receipt_now: false,
      g1a_project_creation_gate_open_now: false,
      project_creation_allowed_now: false,
      source_mutation_performed: false,
      source_literal_opening_commit_applied_now: false,
      claude_is_final_approver: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    }, null, 2),
    "",
  ].join("\n");
}

function renderMarkdown(result) {
  return [
    "# Factory G1a Owner Candidate Selection Docket",
    "",
    `Status: ${result.summary.factory_g1a_owner_candidate_selection_docket_status}`,
    `Program: ${result.program_range}`,
    `Eligible candidates: ${result.summary.eligible_candidate_count}`,
    `Selected candidate now: ${result.summary.selected_candidate_now}`,
    `Candidate hash bound now: ${result.summary.candidate_hash_bound_now}`,
    `Owner selection required: ${result.summary.owner_selection_required_now}`,
    `G1a open now: ${result.summary.g1a_project_creation_gate_open_now}`,
    `Project creation allowed: ${result.summary.project_creation_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--selected-candidate-packet-sha256" || arg === "--bound-candidate-packet-sha256") args.selectedCandidatePacketSha256 = argv[++index];
    else if (arg === "--selected-candidate-manifest-sha256" || arg === "--bound-candidate-manifest-sha256") args.selectedCandidateManifestSha256 = argv[++index];
    else if (arg === "--minimum-eligible-candidate-count") args.minimumEligibleCandidateCount = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g1a-owner-candidate-selection-docket.mjs [--check] [--require-pass] [--no-write] [--out-dir <dir>] [--run-at <iso>] [--selected-candidate-packet-sha256 <sha>] [--selected-candidate-manifest-sha256 <sha>]

Builds a read-only owner candidate selection docket for G1a. It exposes eligible
candidate packet/manifest hashes and prebind command previews. It never selects
a default candidate, signs receipts, mutates source, applies candidates, opens
G1a, or grants project creation authority.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text, error: null };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const {
    markdown: _markdown,
    review_prompt: _reviewPrompt,
    _source_candidate_review_docket_result: _sourceCandidateReviewDocketResult,
    _source_owner_signing_handoff_result: _sourceOwnerSigningHandoffResult,
    ...json
  } = result;
  return json;
}

function normalizeSha(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return HASH_RE.test(normalized) ? normalized : null;
}

function isSha(value) {
  return HASH_RE.test(String(value ?? ""));
}

function authorityClosed(value) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g1a_project_creation_gate_open_now",
    "claude_final_approval_allowed_now",
    "codex_final_approval_allowed_now",
    "fable_final_approval_allowed_now",
  ].every((flag) => value?.[flag] === false);
}

function authorityFlagsClosed(value) {
  return Object.keys(CLOSED_AUTHORITY_FLAGS).every((flag) => value?.[flag] === false);
}

function relativeArtifactPath(baseDir, fileName) {
  const relative = path.relative(process.cwd(), fileName ? path.join(baseDir, fileName) : baseDir);
  return relative || ".";
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObject(item)]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runFactoryG1aOwnerCandidateSelectionDocketCli();
}
