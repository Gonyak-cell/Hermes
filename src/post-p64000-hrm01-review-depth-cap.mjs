import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_HRM01_REVIEW_DEPTH_CAP_OUT_DIR = "artifacts/post-p64000-hrm01-review-depth-cap/latest";
export const DEFAULT_POST_P64000_HRM01_REVIEW_DEPTH_CAP_INPUTS = {
  schemaPath: "schemas/post-p64000-hrm01-review-depth-cap.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p66401-p66800.md",
  architectureDocPath: "docs/architecture.md",
  hrm03WindowCapPath: "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json",
  handoffFreezePath: "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json",
};

const COMMAND_NAME = "platform:post-p64000-hrm01-review-depth-cap";
const SCHEMA_VERSION = "post-p64000-hrm01-review-depth-cap.v1";
const CAPABILITY_ID = "platform.post_p64000_hrm01_review_depth_cap";
const PROGRAM_RANGE = "P66401-P66800";
const SOURCE_PROGRAM_RANGE = "P66001-P66400";
const NEXT_PROGRAM_RANGE = "P66801-P67200";
const HRM01_ID = "HRM-01";
const MAX_REVIEW_DEPTH = 1;
const MAX_REVIEW_TOKENS_WITHOUT_WAIVER = 2;
const CASCADING_REVIEW_TOKEN_THRESHOLD = 3;

const NEGATIVE_FIXTURES = [
  "missing_p66400_hrm03_source",
  "missing_hrm01_finding",
  "review_depth_over_cap_treated_as_clean",
  "missing_review_depth_cap_policy",
  "missing_cascade_detector",
  "review_depth_waiver_without_receipt",
  "new_cascading_review_file_allowed_without_waiver",
  "hrm01_auto_resolved_claim",
  "source_mutation_claim",
  "source_collapse_claim",
  "final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "reviewer_mutation_claim",
  "finding_resolution_claim",
];

const EXTRA_FALSE_FLAGS = [
  "review_depth_over_cap_clean_allowed_now",
  "review_depth_waiver_without_receipt_allowed_now",
  "new_cascading_review_file_allowed_now",
  "hrm01_auto_resolved_allowed_now",
  "review_depth_source_collapse_claim_allowed_now",
  "reviewer_mutation_allowed_now",
  "reviewer_final_closeout_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "source_mutation_from_review_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "review_depth_cap_final_approval_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "post_p66800_production_pass_claim_allowed_now",
  "post_p66800_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-hrm01-review-depth-cap.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-hrm01-review-depth-cap.mjs"],
  ["unit.test", "node --test test/post-p64000-hrm01-review-depth-cap.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-hrm01-review-depth-cap -- --check"],
  ["adjacent.hrm03", "node --test test/post-p64000-hrm03-review-window-cap.test.mjs test/post-p64000-hrm01-review-depth-cap.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-hrm01-review-depth-cap.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000Hrm01ReviewDepthCap(options = {}) {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 HRM-01 review depth cap failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000Hrm01ReviewDepthCap(result, result.output_dir);
  return result;
}

export async function buildPostP64000Hrm01ReviewDepthCap(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_HRM01_REVIEW_DEPTH_CAP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const hrm03WindowCap = Object.prototype.hasOwnProperty.call(options, "hrm03WindowCap")
    ? normalizeInlineJsonSource("inline.hrm03_window_cap", options.hrm03WindowCap)
    : await readJsonSource(inputs.hrm03_window_cap_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);
  const handoffFreeze = Object.prototype.hasOwnProperty.call(options, "handoffFreeze")
    ? normalizeInlineJsonSource("inline.p65600_handoff_freeze", options.handoffFreeze)
    : await readJsonSource(inputs.handoff_freeze_path);

  const fileInventory = Object.prototype.hasOwnProperty.call(options, "fileInventory")
    ? normalizeFileInventory(options.fileInventory)
    : readGitFileInventory(inputs.repo_root);
  const depthObservation = buildReviewDepthObservation(fileInventory);
  const policy = buildReviewDepthCapPolicy({ depthObservation, overrides: options.policyOverrides, generatedAt });
  const sourceRows = buildSourceRows({ hrm03WindowCap, normalizedReceipt, handoffFreeze, fileInventory, generatedAt });
  const inventoryRows = buildDepthInventoryRows({ depthObservation, generatedAt });
  const policyRows = buildDepthCapPolicyRows({ policy, generatedAt });
  const guardRows = buildCascadingReviewGuardRows({ depthObservation, policy, generatedAt });
  const remediationRows = buildHrm01RemediationRows({ normalizedReceipt, depthObservation, policy, guardRows, generatedAt });
  const authorityRows = buildAuthorityRows({ normalizedReceipt, policy, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, remediationRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, depthObservation, policy, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      hrm03_window_cap_path: hrm03WindowCap.path,
      normalized_receipt_path: normalizedReceipt.path,
      handoff_freeze_path: handoffFreeze.path,
      file_inventory_ref: fileInventory.path,
    },
    post_p64000_hrm01_review_depth_cap_contract: {
      contract_id: "post_p64000_hrm01_review_depth_cap",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      max_review_depth: policy.max_review_depth,
      max_review_tokens_per_file_path_without_waiver: policy.max_review_tokens_per_file_path_without_waiver,
      cascading_review_token_threshold: policy.cascading_review_token_threshold,
      over_depth_requires_collapse_or_waiver: true,
      clean_candidate_allowed_when_over_depth: false,
      source_collapse_performed: false,
      hrm01_remediated_candidate: true,
      clean_checkpoint_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    review_depth_cap_policy: policy,
    p66400_hrm03_source_rows: sourceRows,
    review_depth_inventory_rows: inventoryRows,
    review_depth_cap_policy_rows: policyRows,
    cascading_review_guard_rows: guardRows,
    hrm01_remediation_rows: remediationRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p66800_wiring_rows: wiringRows,
    p66800_closeout_rows: closeoutRows,
    p66801_handoff_rows: handoffRows,
    post_p64000_hrm01_review_depth_cap_boundary: boundary,
    post_p64000_hrm01_review_depth_cap_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_hrm01_review_depth_cap")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_hrm01_review_depth_cap_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_hrm01_review_depth_cap_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000Hrm01ReviewDepthCap(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-hrm01-review-depth-cap.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-depth-cap-policy.json"), result.review_depth_cap_policy);
  await writeJson(path.join(outDir, "review-depth-inventory-rows.json"), collectionEnvelope("review-depth-inventory-rows.v1", "review_depth_inventory_rows", result.review_depth_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "cascading-review-guard-rows.json"), collectionEnvelope("cascading-review-guard-rows.v1", "cascading_review_guard_rows", result.cascading_review_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "hrm01-remediation-rows.json"), collectionEnvelope("hrm01-remediation-rows.v1", "hrm01_remediation_rows", result.hrm01_remediation_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000Hrm01ReviewDepthCapCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000Hrm01ReviewDepthCap(args);
  console.log(`Post-P64000 HRM-01 review depth cap ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_hrm01_review_depth_cap_status}`);
  console.log(`Cascading review files: ${result.summary.cascading_review_file_count}`);
  console.log(`Max review token count: ${result.summary.max_review_token_count}`);
  console.log(`Over-depth now: ${result.summary.review_depth_over_cap_now}`);
  console.log(`Collapse or waiver required: ${result.summary.collapse_or_waiver_required_now}`);
  console.log(`HRM-01 remediated candidate: ${result.summary.hrm01_remediated_candidate_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P66801 handoff: ${result.summary.ready_for_p66801_handoff}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ hrm03WindowCap, normalizedReceipt, handoffFreeze, fileInventory, generatedAt }) {
  return [
    row("source.hrm03_window_cap_available", "source_binding", "P66400 HRM-03 window cap artifact is available", hrm03WindowCap.available === true, hrm03WindowCap.path, generatedAt),
    row("source.hrm03_window_cap_valid", "source_binding", "P66400 HRM-03 window cap validation is valid", hrm03WindowCap.data?.validation?.valid === true, hrm03WindowCap.path, generatedAt),
    row("source.hrm03_ready_for_p66401", "source_binding", "P66400 is ready for P66401 handoff", hrm03WindowCap.data?.summary?.ready_for_p66401_handoff === true, hrm03WindowCap.path, generatedAt),
    row("source.normalized_receipt_available", "source_binding", "Normalized review receipt is available", normalizedReceipt.data?.schema_version === "post-p64000-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.hrm01_open", "source_binding", "HRM-01 is present as an open blocker before remediation", hasHrm01Open(normalizedReceipt.data), normalizedReceipt.path, generatedAt),
    row("source.handoff_freeze_valid", "source_binding", "P65600 handoff freeze preserves HRM blockers", handoffFreeze.data?.validation?.valid === true && handoffFreeze.data?.summary?.ready_for_post_p65600_handoff === true, handoffFreeze.path, generatedAt),
    row("source.file_inventory_available", "source_binding", "Repo file inventory is available for review-depth observation", fileInventory.available === true && fileInventory.files.length > 0, fileInventory.path, generatedAt, { file_count: fileInventory.files.length }),
  ];
}

function buildReviewDepthObservation(fileInventory) {
  const fileRows = fileInventory.files.map((filePath) => {
    const reviewTokenCount = countReviewTokens(filePath);
    return {
      file_path: filePath,
      review_token_count: reviewTokenCount,
      is_review_bearing: reviewTokenCount > 0,
      is_cascading_review_file: reviewTokenCount >= CASCADING_REVIEW_TOKEN_THRESHOLD,
      stem: normalizedStem(filePath),
      family: path.dirname(filePath).split("/")[0] || "",
    };
  });
  const reviewBearingFiles = fileRows.filter((rowItem) => rowItem.is_review_bearing);
  const cascadingFiles = fileRows.filter((rowItem) => rowItem.is_cascading_review_file);
  const quartetRows = buildQuartetRows(cascadingFiles);
  const maxReviewTokenCount = Math.max(0, ...fileRows.map((rowItem) => rowItem.review_token_count));
  return {
    schema_version: "review-depth-observation.v1",
    file_count: fileRows.length,
    review_bearing_file_count: reviewBearingFiles.length,
    cascading_review_file_count: cascadingFiles.length,
    cascading_review_quartet_count: quartetRows.length,
    max_review_token_count: maxReviewTokenCount,
    max_review_depth_observed: Math.max(0, maxReviewTokenCount - 1),
    over_depth_file_sample: cascadingFiles.slice(0, 30),
    cascading_review_quartet_sample: quartetRows.slice(0, 20),
  };
}

function buildQuartetRows(cascadingFiles) {
  const byStem = new Map();
  for (const fileRow of cascadingFiles) {
    if (!byStem.has(fileRow.stem)) byStem.set(fileRow.stem, new Set());
    byStem.get(fileRow.stem).add(fileRow.family);
  }
  return [...byStem.entries()]
    .map(([stem, families]) => ({ stem, families: [...families].sort() }))
    .filter((entry) => ["schemas", "scripts", "src", "test"].every((family) => entry.families.includes(family)));
}

function buildReviewDepthCapPolicy({ depthObservation, overrides = {}, generatedAt }) {
  const overDepth = depthObservation.max_review_token_count > MAX_REVIEW_TOKENS_WITHOUT_WAIVER
    || depthObservation.cascading_review_file_count > 0;
  const policy = {
    schema_version: "review-depth-cap-policy.v1",
    generated_at: generatedAt,
    max_review_depth: MAX_REVIEW_DEPTH,
    max_review_tokens_per_file_path_without_waiver: MAX_REVIEW_TOKENS_WITHOUT_WAIVER,
    cascading_review_token_threshold: CASCADING_REVIEW_TOKEN_THRESHOLD,
    observed_review_depth_over_cap: overDepth,
    observed_cascading_review_files: depthObservation.cascading_review_file_count,
    observed_cascading_review_quartets: depthObservation.cascading_review_quartet_count,
    clean_candidate_allowed_when_over_depth: false,
    over_depth_requires_collapse_or_waiver: true,
    explicit_waiver_receipt_required: true,
    new_cascading_review_file_allowed_without_waiver: false,
    source_collapse_performed_now: false,
    packaging_check_required: true,
    next_allowed_action_when_over_depth: "collapse_parameterized_review_chain_or_record_explicit_waiver_before_clean_candidate",
  };
  return { ...policy, ...overrides };
}

function buildDepthInventoryRows({ depthObservation, generatedAt }) {
  return [
    row("inventory.file_count_present", "review_depth_inventory", "Repo file inventory count is present", depthObservation.file_count > 0, "git ls-files", generatedAt, { file_count: depthObservation.file_count }),
    row("inventory.review_bearing_files_present", "review_depth_inventory", "Review-bearing files are observable", depthObservation.review_bearing_file_count > 0, "git ls-files", generatedAt, { review_bearing_file_count: depthObservation.review_bearing_file_count }),
    row("inventory.cascading_files_detected", "review_depth_inventory", "Cascading review files are detected", depthObservation.cascading_review_file_count > 0, "git ls-files", generatedAt, { cascading_review_file_count: depthObservation.cascading_review_file_count }),
    row("inventory.max_review_token_over_cap", "review_depth_inventory", "Max review token count exceeds cap", depthObservation.max_review_token_count > MAX_REVIEW_TOKENS_WITHOUT_WAIVER, "git ls-files", generatedAt, { max_review_token_count: depthObservation.max_review_token_count }),
    row("inventory.quartets_detected", "review_depth_inventory", "Cascading schema/script/src/test quartets are detected", depthObservation.cascading_review_quartet_count > 0, "git ls-files", generatedAt, { cascading_review_quartet_count: depthObservation.cascading_review_quartet_count }),
  ];
}

function buildDepthCapPolicyRows({ policy, generatedAt }) {
  return [
    row("policy.schema", "review_depth_cap_policy", "Review depth cap policy schema is present", policy.schema_version === "review-depth-cap-policy.v1", "artifacts/post-p64000-hrm01-review-depth-cap/latest/review-depth-cap-policy.json", generatedAt),
    row("policy.max_depth", "review_depth_cap_policy", "Maximum review depth is one", Number(policy.max_review_depth) <= MAX_REVIEW_DEPTH, "docs/hermes-roadmap-p66401-p66800.md", generatedAt, { max_review_depth: policy.max_review_depth }),
    row("policy.token_cap", "review_depth_cap_policy", "Review token count cap is at most two without waiver", Number(policy.max_review_tokens_per_file_path_without_waiver) <= MAX_REVIEW_TOKENS_WITHOUT_WAIVER, "docs/hermes-roadmap-p66401-p66800.md", generatedAt, { max_review_tokens_per_file_path_without_waiver: policy.max_review_tokens_per_file_path_without_waiver }),
    row("policy.clean_candidate_blocked", "review_depth_cap_policy", "Clean candidate is blocked when review depth is over cap", policy.clean_candidate_allowed_when_over_depth === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("policy.collapse_or_waiver_required", "review_depth_cap_policy", "Over-depth chain requires collapse or explicit waiver", policy.over_depth_requires_collapse_or_waiver === true, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("policy.waiver_receipt_required", "review_depth_cap_policy", "Review-depth waiver requires explicit receipt", policy.explicit_waiver_receipt_required === true, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("policy.new_cascade_blocked", "review_depth_cap_policy", "New cascading review files are blocked without waiver", policy.new_cascading_review_file_allowed_without_waiver === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("policy.packaging_check_required", "review_depth_cap_policy", "Packaging check is required for cascading review path pattern", policy.packaging_check_required === true, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
  ];
}

function buildCascadingReviewGuardRows({ depthObservation, policy, generatedAt }) {
  const overDepth = depthObservation.max_review_token_count > policy.max_review_tokens_per_file_path_without_waiver
    || depthObservation.cascading_review_file_count > 0;
  return [
    row("guard.over_depth_detected", "cascading_review_guard", "Over-depth review chain is detected", overDepth, "git ls-files", generatedAt, { max_review_token_count: depthObservation.max_review_token_count }),
    row("guard.clean_candidate_blocked", "cascading_review_guard", "Clean candidate is blocked while review depth is over cap", overDepth && policy.clean_candidate_allowed_when_over_depth === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("guard.collapse_or_waiver_required", "cascading_review_guard", "Collapse or explicit waiver is required", overDepth && policy.over_depth_requires_collapse_or_waiver === true, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("guard.no_source_collapse_now", "cascading_review_guard", "This tranche does not claim source collapse was performed", policy.source_collapse_performed_now === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("guard.new_cascade_blocked", "cascading_review_guard", "New cascading review file path is blocked without waiver", policy.new_cascading_review_file_allowed_without_waiver === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("guard.next_allowed_action_present", "cascading_review_guard", "Next allowed action is declared for over-depth chain", overDepth && hasText(policy.next_allowed_action_when_over_depth), "docs/hermes-roadmap-p66401-p66800.md", generatedAt, { next_allowed_action: policy.next_allowed_action_when_over_depth }),
  ];
}

function buildHrm01RemediationRows({ normalizedReceipt, depthObservation, policy, guardRows, generatedAt }) {
  const finding = findHrm01(normalizedReceipt.data);
  return [
    row("hrm01.finding_present", "hrm01_remediation", "HRM-01 finding is present", finding?.id === HRM01_ID, normalizedReceipt.path, generatedAt),
    row("hrm01.finding_open_before_remediation", "hrm01_remediation", "HRM-01 was open before review-depth cap remediation", finding?.normalized_status === "blocking_open", normalizedReceipt.path, generatedAt),
    row("hrm01.source_of_truth_drift_category", "hrm01_remediation", "HRM-01 is source-of-truth drift", finding?.category === "source_of_truth_drift", normalizedReceipt.path, generatedAt),
    row("hrm01.unbounded_issue_reflected", "hrm01_remediation", "HRM-01 issue describes unbounded review recursion", /unbounded|recursion|cascading/i.test(finding?.issue ?? ""), normalizedReceipt.path, generatedAt),
    row("hrm01.proposed_cap_reflected", "hrm01_remediation", "Policy reflects HRM-01 review-depth cap and collapse requirement", Number(policy.max_review_depth) <= MAX_REVIEW_DEPTH && policy.over_depth_requires_collapse_or_waiver === true, "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("hrm01.detector_catches_current_chain", "hrm01_remediation", "Detector catches current cascading review chain", depthObservation.cascading_review_file_count > 0 && depthObservation.max_review_token_count > MAX_REVIEW_TOKENS_WITHOUT_WAIVER, "git ls-files", generatedAt, { cascading_review_file_count: depthObservation.cascading_review_file_count, max_review_token_count: depthObservation.max_review_token_count }),
    row("hrm01.guard_ready", "hrm01_remediation", "Cascading review guard is ready", guardRows.every(pass), "artifacts/post-p64000-hrm01-review-depth-cap/latest/cascading-review-guard-rows.json", generatedAt),
    row("hrm01.remediated_candidate", "hrm01_remediation", "HRM-01 is remediated as a review-depth cap candidate", true, "artifacts/post-p64000-hrm01-review-depth-cap/latest/review-depth-cap-policy.json", generatedAt, {
      finding_id: HRM01_ID,
      remediation_status: "remediated_candidate_pending_future_review",
      next_allowed_action: "continue_to_hrm_revalidation_and_clean_candidate_review_packet",
    }),
  ];
}

function buildAuthorityRows({ normalizedReceipt, policy, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(normalizedReceipt.data, policy, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p66401-p66800.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(receipt, policy, flag) {
  if (flag === "review_depth_over_cap_clean_allowed_now" && policy.clean_candidate_allowed_when_over_depth === true) return true;
  if (flag === "review_depth_waiver_without_receipt_allowed_now" && policy.explicit_waiver_receipt_required !== true) return true;
  if (flag === "new_cascading_review_file_allowed_now" && policy.new_cascading_review_file_allowed_without_waiver === true) return true;
  if (flag === "hrm01_auto_resolved_allowed_now" && !hasHrm01Open(receipt)) return true;
  if (flag === "review_depth_source_collapse_claim_allowed_now" && policy.source_collapse_performed_now === true) return true;
  if (flag === "claude_final_approval_allowed" && receipt?.reviewer_final_approval_allowed === true) return true;
  if (flag === "reviewer_mutation_allowed_now" && receipt?.reviewer_mutation_allowed === true) return true;
  if (flag === "reviewer_final_closeout_allowed_now" && receipt?.reviewer_final_closeout_allowed === true) return true;
  if (flag === "finding_resolution_allowed_now" && receipt?.finding_resolution_allowed === true) return true;
  if (flag === "finding_auto_resolved_allowed_now" && receipt?.finding_auto_resolved_allowed === true) return true;
  if (flag === "patch_apply_allowed_now" && receipt?.patch_apply_allowed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt?.source_mutation_performed === true) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && receipt?.protected_closeout_allowed === true) return true;
  if (flag === "post_p66800_production_pass_claim_allowed_now" && receipt?.production_pass_allowed === true) return true;
  if (flag === "post_p66800_enterprise_pass_claim_allowed_now" && receipt?.enterprise_pass_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks HRM-01 review-depth closeout`,
    true,
    "docs/hermes-roadmap-p66401-p66800.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-hrm01-review-depth-cap.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P66401-P66800 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P66401-P66800") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P66401-P66800 HRM-01 review depth cap", architectureDoc.available && architectureDoc.text.includes("P66401-P66800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p66800.source_ready", "P66400 and review receipt sources are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p66800.depth_inventory_observed", "Review depth inventory rows pass", inventoryRows.every(pass), generatedAt),
    closeoutRow("p66800.policy_ready", "Review depth cap policy rows pass", policyRows.every(pass), generatedAt),
    closeoutRow("p66800.cascading_guard_ready", "Cascading review guard rows pass", guardRows.every(pass), generatedAt),
    closeoutRow("p66800.hrm01_remediation_candidate", "HRM-01 remediation candidate is recorded", remediationRows.every(pass), generatedAt),
    closeoutRow("p66800.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p66800.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p66800.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p66800.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, remediationRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.hrm01_review_depth_remediated", "p66801_handoff", "HRM-01 review-depth cap remediation is ready for future review", ready, "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json", generatedAt, {
      next_allowed_action: ready ? "continue_to_hrm_revalidation_and_clean_candidate_review_packet" : "resolve_hrm01_review_depth_blockers",
    }),
    row("handoff.hrm01_not_clean_checkpoint", "p66801_handoff", "HRM-01 remediation candidate is not clean checkpoint or final approval", remediationRows.every(pass), "docs/hermes-roadmap-p66401-p66800.md", generatedAt),
    row("handoff.p66801_revalidation", "p66801_handoff", "P66801 may start HRM remediation revalidation and clean-candidate review packet", ready, "docs/hermes-roadmap-p66401-p66800.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
    }),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, depthObservation, policy, normalizedReceipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const overDepth = depthObservation.max_review_token_count > policy.max_review_tokens_per_file_path_without_waiver
    || depthObservation.cascading_review_file_count > 0;
  const boundary = {
    post_p64000_hrm01_review_depth_cap_ready: closeoutRows.every(pass),
    source_binding_ready_now: sourceRows.every(pass),
    review_depth_inventory_ready_now: inventoryRows.every(pass),
    review_depth_cap_policy_ready_now: policyRows.every(pass),
    cascading_review_guard_ready_now: guardRows.every(pass),
    hrm01_remediated_candidate_now: remediationRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p66801_handoff: handoffRows.every(pass),
    file_count: depthObservation.file_count,
    review_bearing_file_count: depthObservation.review_bearing_file_count,
    cascading_review_file_count: depthObservation.cascading_review_file_count,
    cascading_review_quartet_count: depthObservation.cascading_review_quartet_count,
    max_review_token_count: depthObservation.max_review_token_count,
    max_review_depth_observed: depthObservation.max_review_depth_observed,
    review_depth_over_cap_now: overDepth,
    cascading_review_files_detected_now: depthObservation.cascading_review_file_count > 0,
    cascading_review_quartets_detected_now: depthObservation.cascading_review_quartet_count > 0,
    collapse_or_waiver_required_now: overDepth && policy.over_depth_requires_collapse_or_waiver === true,
    clean_candidate_allowed_when_over_depth_now: policy.clean_candidate_allowed_when_over_depth === true,
    source_collapse_performed_now: policy.source_collapse_performed_now === true,
    clean_checkpoint_allowed_now: false,
    review_verdict: normalizedReceipt.data?.overall_verdict ?? "",
    blocks_clean_checkpoint: normalizedReceipt.data?.blocks_clean_checkpoint === true,
    blocking_finding_count: Number(normalizedReceipt.data?.normalized_blocking_finding_count ?? 0),
    finding_count: Number(normalizedReceipt.data?.finding_count ?? 0),
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p66800_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p66800_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, inventoryRows, policyRows, guardRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.ready", "source_binding", sourceRows.every(pass), "P66400 and review receipt sources must be valid"),
    validationItem("depth.inventory", "review_depth_inventory", inventoryRows.every(pass), "Review depth inventory must detect cascading review chain"),
    validationItem("policy.ready", "review_depth_cap_policy", policyRows.every(pass), "Review depth cap policy must pass"),
    validationItem("cascading.guard", "cascading_review_guard", guardRows.every(pass), "Cascading review guard must pass"),
    validationItem("hrm01.remediated_candidate", "hrm01_remediation", remediationRows.every(pass), "HRM-01 remediation rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P66800 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P66801 handoff rows must pass"),
    validationItem("boundary.over_depth", "cascading_review_guard", boundary.review_depth_over_cap_now === true, "Current review chain must be recognized as over depth"),
    validationItem("boundary.collapse_or_waiver", "cascading_review_guard", boundary.collapse_or_waiver_required_now === true, "Over-depth chain must require collapse or explicit waiver"),
    validationItem("boundary.clean_candidate_blocked", "cascading_review_guard", boundary.clean_candidate_allowed_when_over_depth_now === false, "Clean candidate must remain blocked when over depth"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p66801_handoff
    ? "hrm01_review_depth_cap_remediated_candidate_ready_for_p66801"
    : validation.valid
      ? "valid_block_p66801_handoff_pending"
      : "blocked_post_p64000_hrm01_review_depth_cap";
  return {
    post_p64000_hrm01_review_depth_cap_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    source_binding_ready_now: boundary.source_binding_ready_now,
    review_depth_cap_policy_ready_now: boundary.review_depth_cap_policy_ready_now,
    cascading_review_guard_ready_now: boundary.cascading_review_guard_ready_now,
    hrm01_remediated_candidate_now: boundary.hrm01_remediated_candidate_now,
    ready_for_p66801_handoff: boundary.ready_for_p66801_handoff,
    file_count: boundary.file_count,
    review_bearing_file_count: boundary.review_bearing_file_count,
    cascading_review_file_count: boundary.cascading_review_file_count,
    cascading_review_quartet_count: boundary.cascading_review_quartet_count,
    max_review_token_count: boundary.max_review_token_count,
    max_review_depth_observed: boundary.max_review_depth_observed,
    review_depth_over_cap_now: boundary.review_depth_over_cap_now,
    cascading_review_files_detected_now: boundary.cascading_review_files_detected_now,
    cascading_review_quartets_detected_now: boundary.cascading_review_quartets_detected_now,
    collapse_or_waiver_required_now: boundary.collapse_or_waiver_required_now,
    clean_candidate_allowed_when_over_depth_now: boundary.clean_candidate_allowed_when_over_depth_now,
    source_collapse_performed_now: boundary.source_collapse_performed_now,
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

function findHrm01(receipt) {
  return (receipt?.findings ?? []).find((finding) => finding.id === HRM01_ID);
}

function hasHrm01Open(receipt) {
  return findHrm01(receipt)?.normalized_status === "blocking_open";
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 HRM-01 Review Depth Cap ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_hrm01_review_depth_cap_status}`,
    `- cascading_review_file_count: ${result.summary.cascading_review_file_count}`,
    `- cascading_review_quartet_count: ${result.summary.cascading_review_quartet_count}`,
    `- max_review_token_count: ${result.summary.max_review_token_count}`,
    `- review_depth_over_cap_now: ${result.summary.review_depth_over_cap_now}`,
    `- collapse_or_waiver_required_now: ${result.summary.collapse_or_waiver_required_now}`,
    `- hrm01_remediated_candidate_now: ${result.summary.hrm01_remediated_candidate_now}`,
    `- source_collapse_performed_now: ${result.summary.source_collapse_performed_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p66801_handoff: ${result.summary.ready_for_p66801_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p66801_handoff
      ? "Continue to P66801-P67200 HRM revalidation and clean-candidate review packet. Do not claim clean checkpoint before future review."
      : "Resolve HRM-01 source, depth inventory, cap policy, cascading guard, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p66800_closeout", label, observed, "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_hrm01_review_depth_cap" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--hrm03-window-cap") args.hrm03WindowCapPath = argv[++index];
    else if (arg === "--normalized-receipt") args.normalizedReceiptPath = argv[++index];
    else if (arg === "--handoff-freeze") args.handoffFreezePath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--hrm03-window-cap PATH] [--normalized-receipt PATH] [--handoff-freeze PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_HRM01_REVIEW_DEPTH_CAP_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    hrm03_window_cap_path: path.resolve(repoRoot, options.hrm03WindowCapPath ?? defaults.hrm03WindowCapPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
    handoff_freeze_path: path.resolve(repoRoot, options.handoffFreezePath ?? defaults.handoffFreezePath),
  };
}

function readGitFileInventory(repoRoot) {
  try {
    const stdout = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
    return normalizeFileInventory(stdout.split(/\r?\n/).filter(Boolean), "git ls-files");
  } catch (error) {
    return { path: "git ls-files", available: false, files: [], error: error.message };
  }
}

function normalizeFileInventory(files, sourceId = "inline.file_inventory") {
  return {
    path: sourceId,
    available: Array.isArray(files),
    files: Array.isArray(files) ? files.filter((filePath) => typeof filePath === "string" && filePath.trim().length > 0) : [],
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
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countReviewTokens(filePath) {
  return (String(filePath).match(/review/gi) ?? []).length;
}

function normalizedStem(filePath) {
  return path.basename(filePath)
    .replace(/\.schema\.json$/, "")
    .replace(/\.test\.mjs$/, "")
    .replace(/\.mjs$/, "");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
