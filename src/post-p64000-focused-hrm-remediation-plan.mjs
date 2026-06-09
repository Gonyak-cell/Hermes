import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_FOCUSED_HRM_REMEDIATION_PLAN_OUT_DIR = "artifacts/post-p64000-focused-hrm-remediation-plan/latest";
export const DEFAULT_POST_P64000_FOCUSED_HRM_REMEDIATION_PLAN_INPUTS = {
  schemaPath: "schemas/post-p64000-focused-hrm-remediation-plan.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p68001-p68400.md",
  architectureDocPath: "docs/architecture.md",
  normalizationPath: "artifacts/post-p64000-claude-review-receipt-normalization/latest/post-p64000-claude-review-receipt-normalization.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-receipt-normalization/latest/normalized-claude-review-receipt.json",
  findingLoopRowsPath: "artifacts/post-p64000-claude-review-receipt-normalization/latest/finding-loop-rows.json",
  findingActionRowsPath: "artifacts/post-p64000-claude-review-receipt-normalization/latest/finding-action-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-focused-hrm-remediation-plan";
const SCHEMA_VERSION = "post-p64000-focused-hrm-remediation-plan.v1";
const CAPABILITY_ID = "platform.post_p64000_focused_hrm_remediation_plan";
const PROGRAM_RANGE = "P68001-P68400";
const SOURCE_PROGRAM_RANGE = "P67601-P68000";
const NEXT_PROGRAM_RANGE = "P68401-P68800";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const CANDIDATE_SOURCE_BY_HRM_ID = {
  "HRM-04": "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json",
  "HRM-03": "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json",
  "HRM-01": "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json",
};

const NEGATIVE_FIXTURES = [
  "missing_p68000_normalization_source",
  "p68000_normalization_invalid",
  "missing_normalized_receipt",
  "missing_raw_hash",
  "missing_hrm_blocking_finding",
  "hrm_finding_auto_resolved",
  "focused_plan_claims_fixed",
  "focused_plan_claims_verified",
  "missing_candidate_source_ref",
  "missing_candidate_digest",
  "missing_verification_packet",
  "missing_per_finding_next_action",
  "patch_apply_claim",
  "write_action_claim",
  "clean_checkpoint_claim",
  "protected_closeout_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "codex_final_approval_claim",
  "claude_final_approval_claim",
  "reviewer_mutation_claim",
  "source_mutation_claim",
  "finding_resolution_claim",
];

const EXTRA_FALSE_FLAGS = [
  "focused_plan_fixed_claim_allowed_now",
  "focused_plan_verified_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "source_mutation_from_review_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "write_action_from_plan_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "protected_closeout_from_plan_allowed_now",
  "post_p68400_production_pass_claim_allowed_now",
  "post_p68400_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-focused-hrm-remediation-plan.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-focused-hrm-remediation-plan.mjs"],
  ["unit.test", "node --test test/post-p64000-focused-hrm-remediation-plan.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-focused-hrm-remediation-plan -- --check"],
  ["adjacent.normalization", "node --test test/post-p64000-claude-review-receipt-normalization.test.mjs test/post-p64000-focused-hrm-remediation-plan.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-focused-hrm-remediation-plan.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000FocusedHrmRemediationPlan(options = {}) {
  const result = await buildPostP64000FocusedHrmRemediationPlan(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 focused HRM remediation plan failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000FocusedHrmRemediationPlan(result, result.output_dir);
  return result;
}

export async function buildPostP64000FocusedHrmRemediationPlan(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_FOCUSED_HRM_REMEDIATION_PLAN_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const normalization = Object.prototype.hasOwnProperty.call(options, "normalization")
    ? normalizeInlineJsonSource("inline.p68000_normalization", options.normalization)
    : await readJsonSource(inputs.normalization_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);
  const findingLoopRows = Object.prototype.hasOwnProperty.call(options, "findingLoopRows")
    ? normalizeInlineJsonSource("inline.finding_loop_rows", options.findingLoopRows)
    : await readJsonSource(inputs.finding_loop_rows_path);
  const findingActionRows = Object.prototype.hasOwnProperty.call(options, "findingActionRows")
    ? normalizeInlineJsonSource("inline.finding_action_rows", options.findingActionRows)
    : await readJsonSource(inputs.finding_action_rows_path);
  const candidateSources = await readCandidateSources({ repoRoot: inputs.repo_root, overrides: options.candidateSources });

  const sourceRows = buildSourceRows({ normalization, normalizedReceipt, findingLoopRows, findingActionRows, generatedAt });
  const focusedPlanRows = buildFocusedPlanRows({ normalizedReceipt, candidateSources, generatedAt });
  const verificationRows = buildVerificationPacketRows({ normalizedReceipt, candidateSources, generatedAt });
  const stateRows = buildFindingStatePreservationRows({ normalizedReceipt, focusedPlanRows, generatedAt });
  const authorityRows = buildAuthorityRows({ normalizedReceipt, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, verificationRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      normalization_path: normalization.path,
      normalized_receipt_path: normalizedReceipt.path,
      finding_loop_rows_path: findingLoopRows.path,
      finding_action_rows_path: findingActionRows.path,
    },
    post_p64000_focused_hrm_remediation_plan_contract: {
      contract_id: "post_p64000_focused_hrm_remediation_plan",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      focused_plan_only: true,
      verification_packet_only: true,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      patch_apply_allowed: false,
      clean_checkpoint_allowed: false,
      protected_closeout_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p68000_receipt_source_rows: sourceRows,
    focused_hrm_plan_rows: focusedPlanRows,
    verification_packet_rows: verificationRows,
    finding_state_preservation_rows: stateRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p68400_wiring_rows: wiringRows,
    p68400_closeout_rows: closeoutRows,
    p68401_handoff_rows: handoffRows,
    post_p64000_focused_hrm_remediation_plan_boundary: boundary,
    post_p64000_focused_hrm_remediation_plan_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.verification_packet_markdown = renderVerificationPacket(result, normalizedReceipt.data);
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_focused_hrm_remediation_plan")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_focused_hrm_remediation_plan_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_focused_hrm_remediation_plan_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  result.verification_packet_markdown = renderVerificationPacket(result, normalizedReceipt.data);
  return result;
}

export async function writePostP64000FocusedHrmRemediationPlan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-focused-hrm-remediation-plan.json"), serializableResult(result));
  await writeJson(path.join(outDir, "focused-hrm-plan-rows.json"), collectionEnvelope("focused-hrm-plan-rows.v1", "focused_hrm_plan_rows", result.focused_hrm_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "verification-packet-rows.json"), collectionEnvelope("verification-packet-rows.v1", "verification_packet_rows", result.verification_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-state-preservation-rows.json"), collectionEnvelope("finding-state-preservation-rows.v1", "finding_state_preservation_rows", result.finding_state_preservation_rows, result.generated_at));
  await writeFile(path.join(outDir, "focused-hrm-verification-packet.md"), result.verification_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000FocusedHrmRemediationPlanCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000FocusedHrmRemediationPlan(args);
  console.log(`Post-P64000 focused HRM remediation plan ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_focused_hrm_remediation_plan_status}`);
  console.log(`P68000 source ready: ${result.summary.p68000_receipt_ready_now}`);
  console.log(`Focused plans ready: ${result.summary.focused_hrm_plans_ready_now}`);
  console.log(`Verification packets ready: ${result.summary.verification_packets_ready_now}`);
  console.log(`Blocking findings preserved: ${result.summary.blocking_findings_preserved_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P68401 handoff: ${result.summary.ready_for_p68401_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ normalization, normalizedReceipt, findingLoopRows, findingActionRows, generatedAt }) {
  const summary = normalization.data?.summary ?? {};
  return [
    row("source.p68000_normalization_available", "p68000_receipt_source", "P68000 normalization artifact is available", normalization.available === true, normalization.path, generatedAt),
    row("source.p68000_program", "p68000_receipt_source", "P68000 normalization program range matches", normalization.data?.program_range === SOURCE_PROGRAM_RANGE, normalization.path, generatedAt),
    row("source.p68000_validation", "p68000_receipt_source", "P68000 normalization validation is valid", normalization.data?.validation?.valid === true, normalization.path, generatedAt),
    row("source.p68000_handoff", "p68000_receipt_source", "P68000 is ready for P68001 handoff", summary.ready_for_p68001_handoff === true, normalization.path, generatedAt),
    row("source.normalized_receipt_available", "p68000_receipt_source", "Normalized receipt is available", normalizedReceipt.data?.schema_version === "post-p64000-hrm-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.raw_hash_present", "p68000_receipt_source", "Normalized receipt preserves raw output hash", hasText(normalizedReceipt.data?.raw_output_sha256), normalizedReceipt.path, generatedAt, { raw_output_sha256: normalizedReceipt.data?.raw_output_sha256 }),
    row("source.finding_loop_rows_available", "p68000_receipt_source", "Finding loop rows are available", Array.isArray(findingLoopRows.data?.rows), findingLoopRows.path, generatedAt),
    row("source.finding_action_rows_available", "p68000_receipt_source", "Finding action rows are available", Array.isArray(findingActionRows.data?.rows), findingActionRows.path, generatedAt),
    row("source.required_hrm_blockers", "p68000_receipt_source", "HRM-04/03/01 remain blocking_open", REQUIRED_HRM_IDS.every((id) => findFinding(normalizedReceipt.data, id)?.normalized_status === "blocking_open"), normalizedReceipt.path, generatedAt, { required_hrm_ids: REQUIRED_HRM_IDS }),
  ];
}

function buildFocusedPlanRows({ normalizedReceipt, candidateSources, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const finding = findFinding(normalizedReceipt.data, findingId);
    const candidate = candidateSources[findingId];
    const ready = finding?.normalized_status === "blocking_open" && candidate?.available === true && hasText(candidate.sha256);
    return row(`plan.${normalizeId(findingId)}`, "focused_hrm_plan", `${findingId} focused remediation or verification plan is ready`, ready, candidate?.path ?? CANDIDATE_SOURCE_BY_HRM_ID[findingId], generatedAt, {
      finding_id: findingId,
      finding_status: finding?.normalized_status,
      candidate_source_ref: candidate?.path ?? CANDIDATE_SOURCE_BY_HRM_ID[findingId],
      candidate_sha256: candidate?.sha256,
      plan_kind: "focused_verification_plan",
      resolution_claimed_now: false,
      fixed_claimed_now: false,
      verified_claimed_now: false,
      next_allowed_action: "prepare_readonly_candidate_verification_capture",
    });
  });
}

function buildVerificationPacketRows({ normalizedReceipt, candidateSources, generatedAt }) {
  return REQUIRED_HRM_IDS.map((findingId) => {
    const finding = findFinding(normalizedReceipt.data, findingId);
    const candidate = candidateSources[findingId];
    const ready = finding?.normalized_status === "blocking_open"
      && candidate?.available === true
      && hasText(candidate.sha256)
      && hasText(finding?.proposed_change);
    return row(`verification_packet.${normalizeId(findingId)}`, "verification_packet", `${findingId} verification packet row is ready`, ready, candidate?.path ?? CANDIDATE_SOURCE_BY_HRM_ID[findingId], generatedAt, {
      finding_id: findingId,
      candidate_source_ref: candidate?.path ?? CANDIDATE_SOURCE_BY_HRM_ID[findingId],
      candidate_sha256: candidate?.sha256,
      expected_future_verdicts: ["fixed", "partially_fixed", "not_fixed", "false_positive", "needs_human_override"],
      reviewer_lane: "claude-code-opus-max-readonly",
      source_mutation_allowed_now: false,
      finding_resolution_allowed_now: false,
      next_allowed_action: "capture_focused_verification_evidence_without_patch_apply",
    });
  });
}

function buildFindingStatePreservationRows({ normalizedReceipt, focusedPlanRows, generatedAt }) {
  const receipt = normalizedReceipt.data ?? {};
  return [
    row("state.blocking_count_preserved", "finding_state_preservation", "Blocking finding count remains at least three", Number(receipt.normalized_blocking_finding_count ?? 0) >= REQUIRED_HRM_IDS.length, normalizedReceipt.path, generatedAt, { blocking_finding_count: Number(receipt.normalized_blocking_finding_count ?? 0) }),
    row("state.required_hrm_blocking_open", "finding_state_preservation", "HRM findings stay blocking_open", REQUIRED_HRM_IDS.every((id) => findFinding(receipt, id)?.normalized_status === "blocking_open"), normalizedReceipt.path, generatedAt),
    row("state.no_fixed_claim", "finding_state_preservation", "Focused plan does not claim fixed status", focusedPlanRows.every((item) => item.fixed_claimed_now === false), "docs/hermes-roadmap-p68001-p68400.md", generatedAt),
    row("state.no_verified_claim", "finding_state_preservation", "Focused plan does not claim verified status", focusedPlanRows.every((item) => item.verified_claimed_now === false), "docs/hermes-roadmap-p68001-p68400.md", generatedAt),
    row("state.clean_checkpoint_blocked", "finding_state_preservation", "Clean checkpoint remains blocked", receipt.clean_checkpoint_allowed === false && receipt.blocks_clean_checkpoint === true, normalizedReceipt.path, generatedAt),
  ];
}

function buildAuthorityRows({ normalizedReceipt, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(normalizedReceipt.data, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p68001-p68400.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(receipt, flag) {
  if (!receipt) return false;
  if (flag === "finding_resolution_allowed_now" && receipt.finding_resolution_performed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt.source_mutation_performed === true) return true;
  if (flag === "clean_checkpoint_claim_allowed_now" && receipt.clean_checkpoint_allowed === true) return true;
  if (flag === "post_p68400_production_pass_claim_allowed_now" && receipt.production_pass_allowed === true) return true;
  if (flag === "post_p68400_enterprise_pass_claim_allowed_now" && receipt.enterprise_pass_allowed === true) return true;
  if (flag === "claude_final_approval_allowed" && receipt.reviewer_final_approval_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P68400 closeout`,
    true,
    "docs/hermes-roadmap-p68001-p68400.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-focused-hrm-remediation-plan.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P68001-P68400 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P68001-P68400") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p68001-p68400.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P68001-P68400 focused HRM remediation plan", architectureDoc.available && architectureDoc.text.includes("P68001-P68400"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p68400.source_ready", "P68000 receipt source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p68400.focused_plans", "Focused HRM plan rows are ready", focusedPlanRows.length === REQUIRED_HRM_IDS.length && focusedPlanRows.every(pass), generatedAt),
    closeoutRow("p68400.verification_packets", "Verification packet rows are ready", verificationRows.length === REQUIRED_HRM_IDS.length && verificationRows.every(pass), generatedAt),
    closeoutRow("p68400.finding_state_preserved", "Finding state remains open and visible", stateRows.every(pass), generatedAt),
    closeoutRow("p68400.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p68400.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p68400.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p68400.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, verificationRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p68401_focused_verification", "p68401_handoff", "P68401 may capture focused verification evidence", ready && verificationRows.every(pass), "artifacts/post-p64000-focused-hrm-remediation-plan/latest/focused-hrm-verification-packet.md", generatedAt, {
      next_allowed_action: ready ? "capture_focused_verification_evidence_for_each_hrm_candidate" : "resolve_p68400_planning_blockers",
    }),
    row("handoff.no_resolution_claim", "p68401_handoff", "P68400 handoff is not finding resolution or clean checkpoint", ready, "docs/hermes-roadmap-p68001-p68400.md", generatedAt),
    row("handoff.authority_false", "p68401_handoff", "P68401 opens verification evidence only, not write or protected action", ready, "docs/hermes-roadmap-p68001-p68400.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, normalizedReceipt } = parts;
  const receipt = normalizedReceipt.data ?? {};
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_focused_hrm_remediation_plan_ready: closeoutRows.every(pass),
    p68000_receipt_ready_now: sourceRows.every(pass),
    focused_hrm_plans_ready_now: focusedPlanRows.length === REQUIRED_HRM_IDS.length && focusedPlanRows.every(pass),
    verification_packets_ready_now: verificationRows.length === REQUIRED_HRM_IDS.length && verificationRows.every(pass),
    blocking_findings_preserved_now: stateRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p68401_handoff: handoffRows.every(pass),
    required_hrm_ids: REQUIRED_HRM_IDS,
    blocking_finding_count: Number(receipt.normalized_blocking_finding_count ?? 0),
    finding_count: Number(receipt.finding_count ?? 0),
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    focused_plan_fixed_claim_allowed_now: false,
    focused_plan_verified_claim_allowed_now: false,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p68400_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p68400_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, focusedPlanRows, verificationRows, stateRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p68000", "source_binding", sourceRows.every(pass), "P68000 normalized receipt source must be ready"),
    validationItem("plan.focused_hrm", "focused_hrm_plan", focusedPlanRows.length === REQUIRED_HRM_IDS.length && focusedPlanRows.every(pass), "Focused HRM plans must exist for HRM-04/03/01"),
    validationItem("packet.verification", "verification_packet", verificationRows.length === REQUIRED_HRM_IDS.length && verificationRows.every(pass), "Verification packet rows must exist for HRM-04/03/01"),
    validationItem("state.findings_preserved", "finding_state", stateRows.every(pass), "Blocking findings must remain open and unresolved"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P68400 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P68401 handoff rows must pass"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.finding_resolution_false", "authority_boundary", boundary.finding_resolution_allowed_now === false, "Finding resolution must remain false"),
    validationItem("boundary.fixed_verified_false", "authority_boundary", boundary.focused_plan_fixed_claim_allowed_now === false && boundary.focused_plan_verified_claim_allowed_now === false, "Focused plan cannot claim fixed or verified"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p68401_handoff
    ? "focused_hrm_remediation_plan_ready_for_p68401"
    : validation.valid
      ? "valid_block_p68401_handoff_pending"
      : "blocked_post_p64000_focused_hrm_remediation_plan";
  return {
    post_p64000_focused_hrm_remediation_plan_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p68000_receipt_ready_now: boundary.p68000_receipt_ready_now,
    focused_hrm_plans_ready_now: boundary.focused_hrm_plans_ready_now,
    verification_packets_ready_now: boundary.verification_packets_ready_now,
    blocking_findings_preserved_now: boundary.blocking_findings_preserved_now,
    ready_for_p68401_handoff: boundary.ready_for_p68401_handoff,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    finding_resolution_allowed_now: boundary.finding_resolution_allowed_now,
    focused_plan_fixed_claim_allowed_now: boundary.focused_plan_fixed_claim_allowed_now,
    focused_plan_verified_claim_allowed_now: boundary.focused_plan_verified_claim_allowed_now,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderVerificationPacket(result, receipt) {
  const rows = result.verification_packet_rows.map((item) => `- ${item.finding_id}: ${item.candidate_source_ref} sha256=${item.candidate_sha256}`).join("\n");
  return [
    "# Post-P64000 Focused HRM Verification Packet",
    "",
    "## Scope",
    "",
    "Verify HRM-04, HRM-03, and HRM-01 remediation candidates in focused read-only passes. This packet is not a fix, not a clean checkpoint, and not final approval.",
    "",
    "## Source Receipt",
    "",
    `- normalized_receipt_schema: ${receipt?.schema_version ?? ""}`,
    `- raw_output_sha256: ${receipt?.raw_output_sha256 ?? ""}`,
    `- review_verdict: ${receipt?.overall_verdict ?? ""}`,
    `- blocking_finding_count: ${receipt?.normalized_blocking_finding_count ?? ""}`,
    "",
    "## Candidate Sources",
    "",
    rows,
    "",
    "## Expected Future Verdicts",
    "",
    "- fixed",
    "- partially_fixed",
    "- not_fixed",
    "- false_positive",
    "- needs_human_override",
    "",
    "## Authority Boundary",
    "",
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
    `# Post-P64000 Focused HRM Remediation Plan ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_focused_hrm_remediation_plan_status}`,
    `- p68000_receipt_ready_now: ${result.summary.p68000_receipt_ready_now}`,
    `- focused_hrm_plans_ready_now: ${result.summary.focused_hrm_plans_ready_now}`,
    `- verification_packets_ready_now: ${result.summary.verification_packets_ready_now}`,
    `- blocking_findings_preserved_now: ${result.summary.blocking_findings_preserved_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- finding_resolution_allowed_now: ${result.summary.finding_resolution_allowed_now}`,
    `- ready_for_p68401_handoff: ${result.summary.ready_for_p68401_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p68401_handoff
      ? "Continue to P68401-P68800 focused verification evidence capture. Do not claim fixed, verified, resolved, or clean checkpoint from this planning tranche."
      : "Resolve source, candidate digest, verification packet, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

async function readCandidateSources({ repoRoot, overrides }) {
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
    const filePath = path.resolve(repoRoot, CANDIDATE_SOURCE_BY_HRM_ID[findingId]);
    const source = await readJsonSource(filePath);
    return [findingId, { ...source, sha256: source.text ? sha256(source.text) : "" }];
  }));
  return Object.fromEntries(entries);
}

function findFinding(receipt, findingId) {
  return (receipt?.findings ?? []).find((finding) => finding.id === findingId);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p68400_closeout", label, observed, "artifacts/post-p64000-focused-hrm-remediation-plan/latest/post-p64000-focused-hrm-remediation-plan.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_hrm_verification_planning" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--normalization") args.normalizationPath = argv[++index];
    else if (arg === "--normalized-receipt") args.normalizedReceiptPath = argv[++index];
    else if (arg === "--finding-loop-rows") args.findingLoopRowsPath = argv[++index];
    else if (arg === "--finding-action-rows") args.findingActionRowsPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--normalization PATH] [--normalized-receipt PATH] [--finding-loop-rows PATH] [--finding-action-rows PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_FOCUSED_HRM_REMEDIATION_PLAN_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    normalization_path: path.resolve(repoRoot, options.normalizationPath ?? defaults.normalizationPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
    finding_loop_rows_path: path.resolve(repoRoot, options.findingLoopRowsPath ?? defaults.findingLoopRowsPath),
    finding_action_rows_path: path.resolve(repoRoot, options.findingActionRowsPath ?? defaults.findingActionRowsPath),
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
  const { markdown, verification_packet_markdown: packetMarkdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
