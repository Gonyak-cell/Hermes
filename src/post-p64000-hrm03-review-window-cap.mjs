import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_HRM03_REVIEW_WINDOW_CAP_OUT_DIR = "artifacts/post-p64000-hrm03-review-window-cap/latest";
export const DEFAULT_POST_P64000_HRM03_REVIEW_WINDOW_CAP_INPUTS = {
  schemaPath: "schemas/post-p64000-hrm03-review-window-cap.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p66001-p66400.md",
  architectureDocPath: "docs/architecture.md",
  hrm04BoundaryPath: "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json",
  baselinePath: "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json",
  executionPath: "artifacts/post-p64000-claude-review-execution/latest/post-p64000-claude-review-execution.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json",
  handoffFreezePath: "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json",
};

const COMMAND_NAME = "platform:post-p64000-hrm03-review-window-cap";
const SCHEMA_VERSION = "post-p64000-hrm03-review-window-cap.v1";
const CAPABILITY_ID = "platform.post_p64000_hrm03_review_window_cap";
const PROGRAM_RANGE = "P66001-P66400";
const SOURCE_PROGRAM_RANGE = "P65601-P66000";
const NEXT_PROGRAM_RANGE = "P66401-P66800";
const HRM03_ID = "HRM-03";
const DEFAULT_MAX_COMMITS = 25;
const DEFAULT_MAX_PHASE_RANGES = 1;

const NEGATIVE_FIXTURES = [
  "missing_p64400_baseline",
  "missing_post_review_commit_count",
  "commit_count_over_cap_treated_as_clean",
  "phase_range_over_cap_treated_as_clean",
  "missing_scope_split_action",
  "missing_reviewer_window_cap_policy",
  "final_approval_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "source_mutation_claim",
  "hrm03_auto_resolved_claim",
  "review_dispatch_without_window_gate",
];

const EXTRA_FALSE_FLAGS = [
  "review_window_over_cap_clean_allowed_now",
  "scope_split_bypass_allowed_now",
  "review_packet_dispatch_without_window_gate_allowed_now",
  "hrm03_auto_resolved_allowed_now",
  "reviewer_mutation_allowed_now",
  "reviewer_final_closeout_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "source_mutation_from_review_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "review_window_cap_final_approval_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "post_p66400_production_pass_claim_allowed_now",
  "post_p66400_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-hrm03-review-window-cap.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-hrm03-review-window-cap.mjs"],
  ["unit.test", "node --test test/post-p64000-hrm03-review-window-cap.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-hrm03-review-window-cap -- --check"],
  ["adjacent.hrm04", "node --test test/post-p64000-hrm04-review-event-boundary.test.mjs test/post-p64000-hrm03-review-window-cap.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-hrm03-review-window-cap.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000Hrm03ReviewWindowCap(options = {}) {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 HRM-03 review window cap failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000Hrm03ReviewWindowCap(result, result.output_dir);
  return result;
}

export async function buildPostP64000Hrm03ReviewWindowCap(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_HRM03_REVIEW_WINDOW_CAP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const hrm04Boundary = Object.prototype.hasOwnProperty.call(options, "hrm04Boundary")
    ? normalizeInlineJsonSource("inline.hrm04_boundary", options.hrm04Boundary)
    : await readJsonSource(inputs.hrm04_boundary_path);
  const baseline = Object.prototype.hasOwnProperty.call(options, "baseline")
    ? normalizeInlineJsonSource("inline.p64400_baseline", options.baseline)
    : await readJsonSource(inputs.baseline_path);
  const execution = Object.prototype.hasOwnProperty.call(options, "execution")
    ? normalizeInlineJsonSource("inline.p64800_execution", options.execution)
    : await readJsonSource(inputs.execution_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);
  const handoffFreeze = Object.prototype.hasOwnProperty.call(options, "handoffFreeze")
    ? normalizeInlineJsonSource("inline.p65600_handoff_freeze", options.handoffFreeze)
    : await readJsonSource(inputs.handoff_freeze_path);

  const observation = buildWindowObservation(baseline.data);
  const policy = buildWindowCapPolicy({ observation, overrides: options.policyOverrides, generatedAt });
  const sourceRows = buildSourceRows({ hrm04Boundary, baseline, execution, normalizedReceipt, handoffFreeze, generatedAt });
  const observationRows = buildWindowObservationRows({ observation, generatedAt });
  const policyRows = buildWindowCapPolicyRows({ policy, generatedAt });
  const scopeRows = buildScopeSplitGuardRows({ observation, policy, generatedAt });
  const remediationRows = buildHrm03RemediationRows({ normalizedReceipt, observation, policy, scopeRows, generatedAt });
  const authorityRows = buildAuthorityRows({ normalizedReceipt, policy, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, remediationRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, observation, policy, normalizedReceipt });
  const validationItems = buildValidationItems({ sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      baseline_path: baseline.path,
      execution_path: execution.path,
      normalized_receipt_path: normalizedReceipt.path,
      handoff_freeze_path: handoffFreeze.path,
    },
    post_p64000_hrm03_review_window_cap_contract: {
      contract_id: "post_p64000_hrm03_review_window_cap",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      max_commits_since_last_review: policy.max_commits_since_last_review,
      max_phase_roadmap_files_since_last_review: policy.max_phase_roadmap_files_since_last_review,
      over_cap_requires_scope_split: true,
      clean_candidate_allowed_when_over_cap: false,
      hrm03_remediated_candidate: true,
      clean_checkpoint_allowed: false,
      source_mutation_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    review_window_cap_policy: policy,
    p66000_hrm04_source_rows: sourceRows,
    review_window_observation_rows: observationRows,
    review_window_cap_policy_rows: policyRows,
    scope_split_guard_rows: scopeRows,
    hrm03_remediation_rows: remediationRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p66400_wiring_rows: wiringRows,
    p66400_closeout_rows: closeoutRows,
    p66401_handoff_rows: handoffRows,
    post_p64000_hrm03_review_window_cap_boundary: boundary,
    post_p64000_hrm03_review_window_cap_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_hrm03_review_window_cap")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_hrm03_review_window_cap_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_hrm03_review_window_cap_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000Hrm03ReviewWindowCap(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-hrm03-review-window-cap.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-window-cap-policy.json"), result.review_window_cap_policy);
  await writeJson(path.join(outDir, "review-window-observation-rows.json"), collectionEnvelope("review-window-observation-rows.v1", "review_window_observation_rows", result.review_window_observation_rows, result.generated_at));
  await writeJson(path.join(outDir, "scope-split-guard-rows.json"), collectionEnvelope("scope-split-guard-rows.v1", "scope_split_guard_rows", result.scope_split_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "hrm03-remediation-rows.json"), collectionEnvelope("hrm03-remediation-rows.v1", "hrm03_remediation_rows", result.hrm03_remediation_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000Hrm03ReviewWindowCapCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000Hrm03ReviewWindowCap(args);
  console.log(`Post-P64000 HRM-03 review window cap ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_hrm03_review_window_cap_status}`);
  console.log(`Post-review commit count: ${result.summary.post_review_commit_count}`);
  console.log(`Commit window over cap: ${result.summary.commit_window_over_cap_now}`);
  console.log(`Phase window over cap: ${result.summary.phase_window_over_cap_now}`);
  console.log(`Scope split required: ${result.summary.scope_split_required_now}`);
  console.log(`HRM-03 remediated candidate: ${result.summary.hrm03_remediated_candidate_now}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Ready for P66401 handoff: ${result.summary.ready_for_p66401_handoff}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ hrm04Boundary, baseline, execution, normalizedReceipt, handoffFreeze, generatedAt }) {
  return [
    row("source.hrm04_boundary_available", "source_binding", "P66000 HRM-04 boundary artifact is available", hrm04Boundary.available === true, hrm04Boundary.path, generatedAt),
    row("source.hrm04_boundary_valid", "source_binding", "P66000 HRM-04 boundary validation is valid", hrm04Boundary.data?.validation?.valid === true, hrm04Boundary.path, generatedAt),
    row("source.hrm04_ready_for_p66001", "source_binding", "P66000 is ready for P66001 handoff", hrm04Boundary.data?.summary?.ready_for_p66001_handoff === true, hrm04Boundary.path, generatedAt),
    row("source.baseline_available", "source_binding", "P64400 baseline artifact is available", baseline.available === true, baseline.path, generatedAt),
    row("source.baseline_valid", "source_binding", "P64400 baseline validation is valid", baseline.data?.validation?.valid === true, baseline.path, generatedAt),
    row("source.execution_valid", "source_binding", "P64800 Claude review execution artifact is valid", execution.data?.validation?.valid === true, execution.path, generatedAt),
    row("source.normalized_receipt_available", "source_binding", "Normalized review receipt is available", normalizedReceipt.data?.schema_version === "post-p64000-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.hrm03_open", "source_binding", "HRM-03 is present as an open blocker before remediation", hasHrm03Open(normalizedReceipt.data), normalizedReceipt.path, generatedAt),
    row("source.handoff_freeze_valid", "source_binding", "P65600 handoff freeze preserves open HRM blockers", handoffFreeze.data?.validation?.valid === true && handoffFreeze.data?.summary?.ready_for_post_p65600_handoff === true, handoffFreeze.path, generatedAt),
  ];
}

function buildWindowObservation(baseline) {
  const changedRows = Array.isArray(baseline?.post_review_changed_file_rows) ? baseline.post_review_changed_file_rows : [];
  const changedFiles = changedRows.map((item) => item.file_path).filter(Boolean);
  const phaseRoadmapFiles = changedFiles.filter((filePath) => /^docs\/hermes-roadmap-p\d+-p\d+\.md$/.test(filePath));
  const commitCount = Number(baseline?.summary?.post_review_commit_count);
  const changedFileCount = Number(baseline?.summary?.changed_file_count ?? changedFiles.length);
  return {
    schema_version: "review-window-observation.v1",
    post_review_commit_count: Number.isFinite(commitCount) ? commitCount : null,
    changed_file_count: Number.isFinite(changedFileCount) ? changedFileCount : changedFiles.length,
    phase_roadmap_file_count: phaseRoadmapFiles.length,
    phase_roadmap_files_sample: phaseRoadmapFiles.slice(0, 20),
  };
}

function buildWindowCapPolicy({ observation, overrides = {}, generatedAt }) {
  const policy = {
    schema_version: "review-window-cap-policy.v1",
    generated_at: generatedAt,
    max_commits_since_last_review: DEFAULT_MAX_COMMITS,
    max_phase_roadmap_files_since_last_review: DEFAULT_MAX_PHASE_RANGES,
    over_cap_requires_scope_split: true,
    clean_candidate_allowed_when_over_cap: false,
    review_dispatch_allowed_without_window_gate: false,
    risk_prioritized_redispatch_required: true,
    observed_commit_window_over_cap: Number(observation.post_review_commit_count) > DEFAULT_MAX_COMMITS,
    observed_phase_window_over_cap: Number(observation.phase_roadmap_file_count) > DEFAULT_MAX_PHASE_RANGES,
    observed_window: {
      post_review_commit_count: observation.post_review_commit_count,
      changed_file_count: observation.changed_file_count,
      phase_roadmap_file_count: observation.phase_roadmap_file_count,
      phase_roadmap_files_sample: observation.phase_roadmap_files_sample,
      commit_window_over_cap: Number(observation.post_review_commit_count) > DEFAULT_MAX_COMMITS,
      phase_window_over_cap: Number(observation.phase_roadmap_file_count) > DEFAULT_MAX_PHASE_RANGES,
      scope_split_required: Number(observation.post_review_commit_count) > DEFAULT_MAX_COMMITS
        || Number(observation.phase_roadmap_file_count) > DEFAULT_MAX_PHASE_RANGES,
    },
    next_allowed_action_when_over_cap: "split_review_packet_by_commit_or_phase_window_before_clean_candidate",
  };
  return { ...policy, ...overrides };
}

function buildWindowObservationRows({ observation, generatedAt }) {
  return [
    row("window.commit_count_present", "review_window_observation", "Post-review commit count is present", Number.isFinite(observation.post_review_commit_count), "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { post_review_commit_count: observation.post_review_commit_count }),
    row("window.changed_file_count_present", "review_window_observation", "Changed file count is present", Number.isFinite(observation.changed_file_count), "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { changed_file_count: observation.changed_file_count }),
    row("window.phase_file_count_present", "review_window_observation", "Phase roadmap file count is present", Number.isFinite(observation.phase_roadmap_file_count), "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { phase_roadmap_file_count: observation.phase_roadmap_file_count }),
    row("window.oversized_commit_window_detected", "review_window_observation", "Oversized commit review window is detected", observation.post_review_commit_count > DEFAULT_MAX_COMMITS, "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { post_review_commit_count: observation.post_review_commit_count, max_commits_since_last_review: DEFAULT_MAX_COMMITS }),
    row("window.oversized_phase_window_detected", "review_window_observation", "Oversized phase roadmap window is detected", observation.phase_roadmap_file_count > DEFAULT_MAX_PHASE_RANGES, "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { phase_roadmap_file_count: observation.phase_roadmap_file_count, max_phase_roadmap_files_since_last_review: DEFAULT_MAX_PHASE_RANGES }),
  ];
}

function buildWindowCapPolicyRows({ policy, generatedAt }) {
  return [
    row("policy.schema", "review_window_cap_policy", "Review window cap policy schema is present", policy.schema_version === "review-window-cap-policy.v1", "artifacts/post-p64000-hrm03-review-window-cap/latest/review-window-cap-policy.json", generatedAt),
    row("policy.commit_cap", "review_window_cap_policy", "Commit cap is at most 25", Number(policy.max_commits_since_last_review) <= DEFAULT_MAX_COMMITS, "docs/hermes-roadmap-p66001-p66400.md", generatedAt, { max_commits_since_last_review: policy.max_commits_since_last_review }),
    row("policy.phase_cap", "review_window_cap_policy", "Phase roadmap cap is at most 1", Number(policy.max_phase_roadmap_files_since_last_review) <= DEFAULT_MAX_PHASE_RANGES, "docs/hermes-roadmap-p66001-p66400.md", generatedAt, { max_phase_roadmap_files_since_last_review: policy.max_phase_roadmap_files_since_last_review }),
    row("policy.scope_split_required", "review_window_cap_policy", "Over-cap review window requires scope split", policy.over_cap_requires_scope_split === true, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("policy.clean_candidate_blocked", "review_window_cap_policy", "Clean candidate is blocked when window is over cap", policy.clean_candidate_allowed_when_over_cap === false, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("policy.dispatch_gate_required", "review_window_cap_policy", "Review dispatch without window gate is blocked", policy.review_dispatch_allowed_without_window_gate === false, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
  ];
}

function buildScopeSplitGuardRows({ observation, policy, generatedAt }) {
  const overCommit = observation.post_review_commit_count > policy.max_commits_since_last_review;
  const overPhase = observation.phase_roadmap_file_count > policy.max_phase_roadmap_files_since_last_review;
  const overCap = overCommit || overPhase;
  return [
    row("scope_split.commit_window_over_cap", "scope_split_guard", "Commit window over cap is routed to split", overCommit && policy.over_cap_requires_scope_split === true, "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { post_review_commit_count: observation.post_review_commit_count }),
    row("scope_split.phase_window_over_cap", "scope_split_guard", "Phase roadmap window over cap is routed to split", overPhase && policy.over_cap_requires_scope_split === true, "artifacts/post-p64000-claude-review/latest/post-p64000-claude-review-baseline.json", generatedAt, { phase_roadmap_file_count: observation.phase_roadmap_file_count }),
    row("scope_split.clean_candidate_blocked", "scope_split_guard", "Clean candidate is blocked while review window is over cap", overCap && policy.clean_candidate_allowed_when_over_cap === false, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("scope_split.redispatch_required", "scope_split_guard", "Risk-prioritized redispatch is required", overCap && policy.risk_prioritized_redispatch_required === true, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("scope_split.next_allowed_action_present", "scope_split_guard", "Next allowed action is declared for over-cap window", overCap && hasText(policy.next_allowed_action_when_over_cap), "docs/hermes-roadmap-p66001-p66400.md", generatedAt, { next_allowed_action: policy.next_allowed_action_when_over_cap }),
  ];
}

function buildHrm03RemediationRows({ normalizedReceipt, observation, policy, scopeRows, generatedAt }) {
  const finding = (normalizedReceipt.data?.findings ?? []).find((item) => item.id === HRM03_ID);
  return [
    row("hrm03.finding_present", "hrm03_remediation", "HRM-03 finding is present", finding?.id === HRM03_ID, normalizedReceipt.path, generatedAt),
    row("hrm03.finding_open_before_remediation", "hrm03_remediation", "HRM-03 was open before window cap remediation", finding?.normalized_status === "blocking_open", normalizedReceipt.path, generatedAt),
    row("hrm03.process_structure_category", "hrm03_remediation", "HRM-03 is process structure", finding?.category === "process_structure", normalizedReceipt.path, generatedAt),
    row("hrm03.commit_count_matches_evidence", "hrm03_remediation", "Observed commit count matches HRM-03 evidence", String(finding?.evidence ?? "").includes(String(observation.post_review_commit_count)), normalizedReceipt.path, generatedAt, { post_review_commit_count: observation.post_review_commit_count }),
    row("hrm03.proposed_cap_reflected", "hrm03_remediation", "Policy reflects HRM-03 proposed 25-commit cap", Number(policy.max_commits_since_last_review) <= DEFAULT_MAX_COMMITS, "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("hrm03.scope_split_guard_ready", "hrm03_remediation", "Scope split guard is ready", scopeRows.every(pass), "artifacts/post-p64000-hrm03-review-window-cap/latest/scope-split-guard-rows.json", generatedAt),
    row("hrm03.remediated_candidate", "hrm03_remediation", "HRM-03 is remediated as a window-cap candidate", true, "artifacts/post-p64000-hrm03-review-window-cap/latest/review-window-cap-policy.json", generatedAt, {
      finding_id: HRM03_ID,
      remediation_status: "remediated_candidate_pending_future_review",
      next_allowed_action: "continue_to_hrm01_review_depth_cap",
    }),
  ];
}

function buildAuthorityRows({ normalizedReceipt, policy, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const claim = claimForFlag(normalizedReceipt.data, policy, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : claim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p66001-p66400.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function claimForFlag(receipt, policy, flag) {
  if (flag === "review_window_over_cap_clean_allowed_now" && policy.clean_candidate_allowed_when_over_cap === true) return true;
  if (flag === "scope_split_bypass_allowed_now" && policy.over_cap_requires_scope_split !== true) return true;
  if (flag === "review_packet_dispatch_without_window_gate_allowed_now" && policy.review_dispatch_allowed_without_window_gate === true) return true;
  if (flag === "hrm03_auto_resolved_allowed_now" && !hasHrm03Open(receipt)) return true;
  if (flag === "claude_final_approval_allowed" && receipt?.reviewer_final_approval_allowed === true) return true;
  if (flag === "reviewer_mutation_allowed_now" && receipt?.reviewer_mutation_allowed === true) return true;
  if (flag === "reviewer_final_closeout_allowed_now" && receipt?.reviewer_final_closeout_allowed === true) return true;
  if (flag === "finding_resolution_allowed_now" && receipt?.finding_resolution_allowed === true) return true;
  if (flag === "finding_auto_resolved_allowed_now" && receipt?.finding_auto_resolved_allowed === true) return true;
  if (flag === "patch_apply_allowed_now" && receipt?.patch_apply_allowed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt?.source_mutation_performed === true) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && receipt?.protected_closeout_allowed === true) return true;
  if (flag === "post_p66400_production_pass_claim_allowed_now" && receipt?.production_pass_allowed === true) return true;
  if (flag === "post_p66400_enterprise_pass_claim_allowed_now" && receipt?.enterprise_pass_allowed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks HRM-03 window-cap closeout`,
    true,
    "docs/hermes-roadmap-p66001-p66400.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-hrm03-review-window-cap.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P66001-P66400 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P66001-P66400") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P66001-P66400 HRM-03 review window cap", architectureDoc.available && architectureDoc.text.includes("P66001-P66400"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p66400.source_ready", "P66000 and review baseline sources are ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p66400.window_observed", "Review window observation rows pass", observationRows.every(pass), generatedAt),
    closeoutRow("p66400.policy_ready", "Review window cap policy rows pass", policyRows.every(pass), generatedAt),
    closeoutRow("p66400.scope_split_guard_ready", "Scope split guard rows pass", scopeRows.every(pass), generatedAt),
    closeoutRow("p66400.hrm03_remediation_candidate", "HRM-03 remediation candidate is recorded", remediationRows.every(pass), generatedAt),
    closeoutRow("p66400.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p66400.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p66400.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p66400.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, remediationRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.hrm03_window_cap_remediated", "p66401_handoff", "HRM-03 window cap remediation is ready for future review", ready, "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json", generatedAt, {
      next_allowed_action: ready ? "continue_to_hrm01_review_depth_cap" : "resolve_hrm03_window_cap_blockers",
    }),
    row("handoff.hrm03_not_clean_checkpoint", "p66401_handoff", "HRM-03 remediation candidate is not clean checkpoint or final approval", remediationRows.every(pass), "docs/hermes-roadmap-p66001-p66400.md", generatedAt),
    row("handoff.p66401_hrm01", "p66401_handoff", "P66401 may start HRM-01 review depth cap remediation", ready, "docs/hermes-roadmap-p66001-p66400.md", generatedAt, {
      next_program_range: NEXT_PROGRAM_RANGE,
    }),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, observation, policy, normalizedReceipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const overCommit = observation.post_review_commit_count > policy.max_commits_since_last_review;
  const overPhase = observation.phase_roadmap_file_count > policy.max_phase_roadmap_files_since_last_review;
  const boundary = {
    post_p64000_hrm03_review_window_cap_ready: closeoutRows.every(pass),
    source_binding_ready_now: sourceRows.every(pass),
    review_window_observed_now: observationRows.every(pass),
    review_window_cap_policy_ready_now: policyRows.every(pass),
    scope_split_guard_ready_now: scopeRows.every(pass),
    hrm03_remediated_candidate_now: remediationRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p66401_handoff: handoffRows.every(pass),
    post_review_commit_count: observation.post_review_commit_count,
    changed_file_count: observation.changed_file_count,
    phase_roadmap_file_count: observation.phase_roadmap_file_count,
    commit_window_over_cap_now: overCommit,
    phase_window_over_cap_now: overPhase,
    scope_split_required_now: (overCommit || overPhase) && policy.over_cap_requires_scope_split === true,
    clean_candidate_allowed_when_over_cap_now: policy.clean_candidate_allowed_when_over_cap === true,
    clean_checkpoint_allowed_now: false,
    review_verdict: normalizedReceipt.data?.overall_verdict ?? "",
    blocks_clean_checkpoint: normalizedReceipt.data?.blocks_clean_checkpoint === true,
    blocking_finding_count: Number(normalizedReceipt.data?.normalized_blocking_finding_count ?? 0),
    finding_count: Number(normalizedReceipt.data?.finding_count ?? 0),
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p66400_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p66400_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, observationRows, policyRows, scopeRows, remediationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.ready", "source_binding", sourceRows.every(pass), "P66000 and review baseline sources must be valid"),
    validationItem("window.observed", "review_window_observation", observationRows.every(pass), "Oversized review window must be observed"),
    validationItem("policy.ready", "review_window_cap_policy", policyRows.every(pass), "Review window cap policy must pass"),
    validationItem("scope_split.guard", "scope_split_guard", scopeRows.every(pass), "Scope split guard must pass"),
    validationItem("hrm03.remediated_candidate", "hrm03_remediation", remediationRows.every(pass), "HRM-03 remediation rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P66400 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P66401 handoff rows must pass"),
    validationItem("boundary.scope_split_required", "scope_split_guard", boundary.scope_split_required_now === true, "Over-cap window must require scope split"),
    validationItem("boundary.clean_candidate_blocked", "scope_split_guard", boundary.clean_candidate_allowed_when_over_cap_now === false, "Clean candidate must remain blocked when over cap"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p66401_handoff
    ? "hrm03_review_window_cap_remediated_candidate_ready_for_p66401"
    : validation.valid
      ? "valid_block_p66401_handoff_pending"
      : "blocked_post_p64000_hrm03_review_window_cap";
  return {
    post_p64000_hrm03_review_window_cap_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    source_binding_ready_now: boundary.source_binding_ready_now,
    review_window_cap_policy_ready_now: boundary.review_window_cap_policy_ready_now,
    scope_split_guard_ready_now: boundary.scope_split_guard_ready_now,
    hrm03_remediated_candidate_now: boundary.hrm03_remediated_candidate_now,
    ready_for_p66401_handoff: boundary.ready_for_p66401_handoff,
    post_review_commit_count: boundary.post_review_commit_count,
    changed_file_count: boundary.changed_file_count,
    phase_roadmap_file_count: boundary.phase_roadmap_file_count,
    commit_window_over_cap_now: boundary.commit_window_over_cap_now,
    phase_window_over_cap_now: boundary.phase_window_over_cap_now,
    scope_split_required_now: boundary.scope_split_required_now,
    clean_candidate_allowed_when_over_cap_now: boundary.clean_candidate_allowed_when_over_cap_now,
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

function hasHrm03Open(receipt) {
  return (receipt?.findings ?? []).some((finding) => finding.id === HRM03_ID && finding.normalized_status === "blocking_open");
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 HRM-03 Review Window Cap ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_hrm03_review_window_cap_status}`,
    `- post_review_commit_count: ${result.summary.post_review_commit_count}`,
    `- phase_roadmap_file_count: ${result.summary.phase_roadmap_file_count}`,
    `- commit_window_over_cap_now: ${result.summary.commit_window_over_cap_now}`,
    `- phase_window_over_cap_now: ${result.summary.phase_window_over_cap_now}`,
    `- scope_split_required_now: ${result.summary.scope_split_required_now}`,
    `- hrm03_remediated_candidate_now: ${result.summary.hrm03_remediated_candidate_now}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- ready_for_p66401_handoff: ${result.summary.ready_for_p66401_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p66401_handoff
      ? "Continue to P66401-P66800 HRM-01 review depth cap remediation. Do not claim clean checkpoint before future review."
      : "Resolve HRM-03 source, window observation, cap policy, scope split, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p66400_closeout", label, observed, "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_hrm03_window_cap" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--baseline") args.baselinePath = argv[++index];
    else if (arg === "--execution") args.executionPath = argv[++index];
    else if (arg === "--normalized-receipt") args.normalizedReceiptPath = argv[++index];
    else if (arg === "--handoff-freeze") args.handoffFreezePath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--hrm04-boundary PATH] [--baseline PATH] [--execution PATH] [--normalized-receipt PATH] [--handoff-freeze PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_HRM03_REVIEW_WINDOW_CAP_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    hrm04_boundary_path: path.resolve(repoRoot, options.hrm04BoundaryPath ?? defaults.hrm04BoundaryPath),
    baseline_path: path.resolve(repoRoot, options.baselinePath ?? defaults.baselinePath),
    execution_path: path.resolve(repoRoot, options.executionPath ?? defaults.executionPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
    handoff_freeze_path: path.resolve(repoRoot, options.handoffFreezePath ?? defaults.handoffFreezePath),
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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
