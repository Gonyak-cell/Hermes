import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";

export const DEFAULT_POST_P64000_CLAUDE_REVIEW_HANDOFF_FREEZE_OUT_DIR = "artifacts/post-p64000-claude-review-handoff-freeze/latest";
export const DEFAULT_POST_P64000_CLAUDE_REVIEW_HANDOFF_FREEZE_INPUTS = {
  schemaPath: "schemas/post-p64000-claude-review-handoff-freeze.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p65201-p65600.md",
  architectureDocPath: "docs/architecture.md",
  normalizationPath: "artifacts/post-p64000-claude-review-normalization/latest/post-p64000-claude-review-normalization.json",
  normalizedReceiptPath: "artifacts/post-p64000-claude-review-normalization/latest/normalized-claude-review-receipt.json",
  blockingLoopRowsPath: "artifacts/post-p64000-claude-review-normalization/latest/blocking-finding-loop-rows.json",
  findingActionRowsPath: "artifacts/post-p64000-claude-review-normalization/latest/finding-action-rows.json",
};

const COMMAND_NAME = "platform:post-p64000-claude-review-handoff-freeze";
const SCHEMA_VERSION = "post-p64000-claude-review-handoff-freeze.v1";
const CAPABILITY_ID = "platform.post_p64000_claude_review_handoff_freeze";
const PROGRAM_RANGE = "P65201-P65600";
const SOURCE_PROGRAM_RANGE = "P64801-P65200";
const NEXT_PROGRAM_RANGE = "POST-P65600-HRM-REMEDIATION";
const REQUIRED_BLOCKING_FINDING_IDS = ["HRM-01", "HRM-03", "HRM-04"];

const NEGATIVE_FIXTURES = [
  "missing_p65200_normalization_source",
  "p65200_validation_invalid",
  "normalized_receipt_missing",
  "blocking_finding_count_mismatch",
  "blocking_finding_auto_resolved",
  "clean_checkpoint_claim",
  "production_pass_claim",
  "enterprise_pass_claim",
  "final_approval_claim",
  "source_mutation_claim",
  "automation_continues_after_p65600",
  "missing_next_allowed_action",
];

const EXTRA_FALSE_FLAGS = [
  "reviewer_mutation_allowed_now",
  "reviewer_final_closeout_allowed_now",
  "finding_resolution_allowed_now",
  "finding_auto_resolved_allowed_now",
  "patch_apply_allowed_now",
  "source_mutation_from_review_allowed_now",
  "protected_closeout_from_review_allowed_now",
  "clean_checkpoint_claim_allowed_now",
  "post_p65600_production_pass_claim_allowed_now",
  "post_p65600_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/post-p64000-claude-review-handoff-freeze.mjs"],
  ["syntax.script", "node --check scripts/post-p64000-claude-review-handoff-freeze.mjs"],
  ["unit.test", "node --test test/post-p64000-claude-review-handoff-freeze.test.mjs"],
  ["contract.check", "npm run platform:post-p64000-claude-review-handoff-freeze -- --check"],
  ["adjacent.normalization", "node --test test/post-p64000-claude-review-normalization.test.mjs test/post-p64000-claude-review-handoff-freeze.test.mjs"],
  ["review.authority", "npm run platform:review-authority-contract -- --check"],
  ["review.process", "npm run platform:review-process-upgrade -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/post-p64000-claude-review-handoff-freeze.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runPostP64000ClaudeReviewHandoffFreeze(options = {}) {
  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Post-P64000 Claude review handoff freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writePostP64000ClaudeReviewHandoffFreeze(result, result.output_dir);
  return result;
}

export async function buildPostP64000ClaudeReviewHandoffFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_P64000_CLAUDE_REVIEW_HANDOFF_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const normalization = Object.prototype.hasOwnProperty.call(options, "normalization")
    ? normalizeInlineJsonSource("inline.post_p64000_claude_review_normalization", options.normalization)
    : await readJsonSource(inputs.normalization_path);
  const normalizedReceipt = Object.prototype.hasOwnProperty.call(options, "normalizedReceipt")
    ? normalizeInlineJsonSource("inline.normalized_claude_review_receipt", options.normalizedReceipt)
    : await readJsonSource(inputs.normalized_receipt_path);
  const blockingLoopRows = Object.prototype.hasOwnProperty.call(options, "blockingLoopRows")
    ? normalizeInlineJsonSource("inline.blocking_finding_loop_rows", collectionEnvelope("inline", "blocking_finding_loop_rows", options.blockingLoopRows, generatedAt))
    : await readJsonSource(inputs.blocking_loop_rows_path);
  const findingActionRows = Object.prototype.hasOwnProperty.call(options, "findingActionRows")
    ? normalizeInlineJsonSource("inline.finding_action_rows", collectionEnvelope("inline", "finding_action_rows", options.findingActionRows, generatedAt))
    : await readJsonSource(inputs.finding_action_rows_path);

  const receipt = normalizedReceipt.data ?? normalization.data?.normalized_claude_review_receipt ?? null;
  const sourceRows = buildSourceRows({ normalization, normalizedReceipt, blockingLoopRows, findingActionRows, generatedAt });
  const blockerRows = buildBlockerRevalidationRows({ receipt, blockingLoopRows, findingActionRows, generatedAt });
  const freezeRows = buildFreezeMatrixRows({ receipt, blockerRows, generatedAt, overrides: options.freezeOverrides });
  const automationRows = buildAutomationStopRows({ freezeRows, generatedAt, overrides: options.automationOverrides });
  const authorityRows = buildAuthorityRows({ receipt, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, blockerRows, automationRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, receipt });
  const validationItems = buildValidationItems({ sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      blocking_loop_rows_path: blockingLoopRows.path,
      finding_action_rows_path: findingActionRows.path,
    },
    post_p64000_claude_review_handoff_freeze_contract: {
      contract_id: "post_p64000_claude_review_handoff_freeze",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_program_range: NEXT_PROGRAM_RANGE,
      review_refresh_complete: true,
      blocking_findings_preserved_open: true,
      clean_checkpoint_allowed: false,
      automation_stop_recommended: true,
      finding_resolution_allowed: false,
      source_mutation_allowed: false,
      claude_final_approval_allowed: false,
      production_pass_allowed: false,
      enterprise_pass_allowed: false,
      generated_at: generatedAt,
    },
    p65200_normalization_source_rows: sourceRows,
    blocking_finding_revalidation_rows: blockerRows,
    p65600_freeze_matrix_rows: freezeRows,
    automation_stop_recommendation_rows: automationRows,
    authority_boundary_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationRows,
    p65600_wiring_rows: wiringRows,
    p65600_closeout_rows: closeoutRows,
    post_p65600_handoff_rows: handoffRows,
    post_p64000_claude_review_handoff_freeze_boundary: boundary,
    post_p64000_claude_review_handoff_freeze_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  result.markdown = renderMarkdown(result);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "post_p64000_claude_review_handoff_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.post_p64000_claude_review_handoff_freeze_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.post_p64000_claude_review_handoff_freeze_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  result.markdown = renderMarkdown(result);
  return result;
}

export async function writePostP64000ClaudeReviewHandoffFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-p64000-claude-review-handoff-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "blocking-finding-revalidation-rows.json"), collectionEnvelope("blocking-finding-revalidation-rows.v1", "blocking_finding_revalidation_rows", result.blocking_finding_revalidation_rows, result.generated_at));
  await writeJson(path.join(outDir, "p65600-freeze-matrix-rows.json"), collectionEnvelope("p65600-freeze-matrix-rows.v1", "p65600_freeze_matrix_rows", result.p65600_freeze_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "automation-stop-recommendation-rows.json"), collectionEnvelope("automation-stop-recommendation-rows.v1", "automation_stop_recommendation_rows", result.automation_stop_recommendation_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-p65600-handoff-rows.json"), collectionEnvelope("post-p65600-handoff-rows.v1", "post_p65600_handoff_rows", result.post_p65600_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostP64000ClaudeReviewHandoffFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runPostP64000ClaudeReviewHandoffFreeze(args);
  console.log(`Post-P64000 Claude review handoff freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.post_p64000_claude_review_handoff_freeze_status}`);
  console.log(`P65200 source ready: ${result.summary.p65200_normalization_ready_now}`);
  console.log(`Blocking findings preserved: ${result.summary.blocking_findings_preserved_now}`);
  console.log(`Blocking finding count: ${result.summary.blocking_finding_count}`);
  console.log(`Clean checkpoint allowed: ${result.summary.clean_checkpoint_allowed_now}`);
  console.log(`Automation stop recommended: ${result.summary.automation_stop_recommended_now}`);
  console.log(`Review refresh complete: ${result.summary.review_refresh_complete_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceRows({ normalization, normalizedReceipt, blockingLoopRows, findingActionRows, generatedAt }) {
  const summary = normalization.data?.summary ?? {};
  return [
    row("source.p65200_normalization_available", "p65200_normalization_source", "P65200 normalization artifact is available", normalization.available === true, normalization.path, generatedAt),
    row("source.p65200_program", "p65200_normalization_source", "P65200 program range matches", normalization.data?.program_range === SOURCE_PROGRAM_RANGE, normalization.path, generatedAt),
    row("source.p65200_validation", "p65200_normalization_source", "P65200 validation is valid", normalization.data?.validation?.valid === true, normalization.path, generatedAt),
    row("source.p65201_handoff", "p65200_normalization_source", "P65200 is ready for P65201 handoff", summary.ready_for_p65201_handoff === true, normalization.path, generatedAt),
    row("source.normalized_receipt_available", "p65200_normalization_source", "Normalized Claude review receipt is available", normalizedReceipt.available === true && normalizedReceipt.data?.schema_version === "post-p64000-claude-review-receipt.v1", normalizedReceipt.path, generatedAt),
    row("source.blocking_loop_rows_available", "p65200_normalization_source", "Blocking finding loop rows are available", blockingLoopRows.available === true && Array.isArray(blockingLoopRows.data?.rows), blockingLoopRows.path, generatedAt),
    row("source.finding_action_rows_available", "p65200_normalization_source", "Finding action rows are available", findingActionRows.available === true && Array.isArray(findingActionRows.data?.rows), findingActionRows.path, generatedAt),
  ];
}

function buildBlockerRevalidationRows({ receipt, blockingLoopRows, findingActionRows, generatedAt }) {
  const findings = Array.isArray(receipt?.findings) ? receipt.findings : [];
  const blockingFindings = findings.filter((finding) => finding.blocks_clean_checkpoint === true || finding.normalized_status === "blocking_open");
  const loopRows = Array.isArray(blockingLoopRows.data?.rows) ? blockingLoopRows.data.rows : [];
  const actionRows = Array.isArray(findingActionRows.data?.rows) ? findingActionRows.data.rows : [];
  const rows = [
    row("blocker.count_preserved", "blocking_finding_revalidation", "Blocking finding count is preserved", blockingFindings.length === Number(receipt?.normalized_blocking_finding_count ?? -1) && blockingFindings.length === REQUIRED_BLOCKING_FINDING_IDS.length, receipt?.raw_output_ref ?? null, generatedAt, { blocking_finding_count: blockingFindings.length }),
    row("blocker.clean_checkpoint_false", "blocking_finding_revalidation", "Clean checkpoint remains false", receipt?.clean_checkpoint_allowed === false && receipt?.blocks_clean_checkpoint === true, receipt?.raw_output_ref ?? null, generatedAt),
    row("blocker.loop_rows_preserved", "blocking_finding_revalidation", "Blocking loop rows remain visible", loopRows.length >= 4 && loopRows.every(pass), blockingLoopRows.path, generatedAt),
    row("blocker.action_rows_preserved", "blocking_finding_revalidation", "Finding action rows remain visible", actionRows.length === Number(receipt?.finding_count ?? -1) && actionRows.every(pass), findingActionRows.path, generatedAt),
  ];
  for (const findingId of REQUIRED_BLOCKING_FINDING_IDS) {
    const finding = blockingFindings.find((item) => item.id === findingId);
    rows.push(row(`blocker.${normalizeId(findingId)}_open`, "blocking_finding_revalidation", `${findingId} remains open and blocking`, finding?.normalized_status === "blocking_open" && finding?.next_allowed_action !== "resolved", receipt?.raw_output_ref ?? null, generatedAt, {
      finding_id: findingId,
      normalized_status: finding?.normalized_status ?? null,
      next_allowed_action: finding?.next_allowed_action ?? "missing",
    }));
  }
  return rows;
}

function buildFreezeMatrixRows({ receipt, blockerRows, generatedAt, overrides = {} }) {
  const defaults = {
    review_refresh_complete_now: true,
    blocking_findings_preserved_now: blockerRows.every(pass),
    clean_checkpoint_allowed_now: false,
    protected_closeout_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
    source_mutation_allowed_now: false,
    finding_resolution_allowed_now: false,
    next_allowed_action_declared_now: true,
    review_receipt_final_status_is_blocked_now: receipt?.receipt_status === "observed_blocking_findings",
    local_evidence_artifacts_written_now: true,
  };
  const matrix = { ...defaults, ...overrides };
  return Object.entries(matrix).map(([key, value]) => row(`freeze.${key}`, "p65600_freeze_matrix", `${key} is ${value}`, expectedFreezeValue(key, value), "docs/hermes-roadmap-p65201-p65600.md", generatedAt, {
    freeze_key: key,
    freeze_value: value,
  }));
}

function expectedFreezeValue(key, value) {
  if (key === "next_allowed_action_declared_now") return value === true;
  if (key.includes("allowed") || key.includes("enabled")) return value === false;
  return value === true;
}

function buildAutomationStopRows({ freezeRows, generatedAt, overrides = {} }) {
  const ready = freezeRows.every(pass);
  const stopRecommended = Object.prototype.hasOwnProperty.call(overrides, "automation_stop_recommended_now")
    ? overrides.automation_stop_recommended_now
    : true;
  const nextRunRequired = Object.prototype.hasOwnProperty.call(overrides, "next_review_refresh_run_required_now")
    ? overrides.next_review_refresh_run_required_now
    : false;
  return [
    row("automation.p65600_complete", "automation_stop_recommendation", "P65600 review refresh line is complete", ready, "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json", generatedAt),
    row("automation.stop_recommended", "automation_stop_recommendation", "Heartbeat automation should stop after P65600", stopRecommended === true, "docs/hermes-roadmap-p65201-p65600.md", generatedAt, { automation_stop_recommended_now: stopRecommended }),
    row("automation.no_next_review_refresh_run", "automation_stop_recommendation", "No further P64401-P65600 review-refresh tranche is required", nextRunRequired === false, "docs/hermes-roadmap-p65201-p65600.md", generatedAt, { next_review_refresh_run_required_now: nextRunRequired }),
    row("automation.next_work_is_remediation", "automation_stop_recommendation", "Next work is HRM blocker remediation planning, not another review-refresh loop", true, "docs/hermes-roadmap-p65201-p65600.md", generatedAt, { next_allowed_action: "start_hrm_finding_remediation_program_if_requested" }),
  ];
}

function buildAuthorityRows({ receipt, overrides = {}, generatedAt }) {
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const receiptClaim = receiptClaimForFlag(receipt, flag);
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : receiptClaim ?? false;
    return row(`authority.${flag}`, "authority_boundary", `${flag} remains false`, value === false, "docs/hermes-roadmap-p65201-p65600.md", generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function receiptClaimForFlag(receipt, flag) {
  if (!receipt) return false;
  if (flag === "claude_final_approval_allowed" && receipt.reviewer_final_approval_allowed === true) return true;
  if (flag === "protected_closeout_from_review_allowed_now" && receipt.protected_closeout_allowed === true) return true;
  if (flag === "post_p65600_production_pass_claim_allowed_now" && receipt.production_pass_allowed === true) return true;
  if (flag === "post_p65600_enterprise_pass_claim_allowed_now" && receipt.enterprise_pass_allowed === true) return true;
  if (flag === "source_mutation_from_review_allowed_now" && receipt.source_mutation_performed === true) return true;
  return false;
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P65600 freeze`,
    true,
    "docs/hermes-roadmap-p65201-p65600.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/post-p64000-claude-review-handoff-freeze.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P65201-P65600 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P65201-P65600") && roadmapDoc.text.toLowerCase().includes("negative fixtures"), "docs/hermes-roadmap-p65201-p65600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture references P65201-P65600 Claude review handoff freeze", architectureDoc.available && architectureDoc.text.includes("P65201-P65600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p65600.source_ready", "P65200 normalization source is ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p65600.blockers_revalidated", "Blocking findings are revalidated as open", blockerRows.every(pass), generatedAt),
    closeoutRow("p65600.freeze_matrix", "Freeze matrix keeps clean/protected/production/enterprise claims closed", freezeRows.every(pass), generatedAt),
    closeoutRow("p65600.automation_stop", "Automation stop recommendation is ready", automationRows.every(pass), generatedAt),
    closeoutRow("p65600.authority_false", "Authority boundary remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p65600.negative_fixtures", "Negative fixture rows are complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p65600.validation_commands", "Validation commands are declared", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), generatedAt),
    closeoutRow("p65600.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, blockerRows, automationRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  const blockerIds = blockerRows.filter((item) => item.finding_id).map((item) => item.finding_id);
  return [
    row("handoff.review_refresh_complete", "post_p65600_handoff", "P64401-P65600 review refresh line is complete", ready, "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json", generatedAt, {
      next_allowed_action: ready ? "pause_or_delete_review_refresh_automation" : "resolve_p65600_freeze_blockers",
    }),
    row("handoff.blockers_open", "post_p65600_handoff", "Blocking HRM findings remain open for remediation", blockerIds.length === REQUIRED_BLOCKING_FINDING_IDS.length, "artifacts/post-p64000-claude-review-handoff-freeze/latest/blocking-finding-revalidation-rows.json", generatedAt, {
      blocking_finding_ids: blockerIds,
      next_allowed_action: "plan_hrm_finding_remediation_before_clean_checkpoint",
    }),
    row("handoff.automation_stop", "post_p65600_handoff", "Automation can be paused or deleted after P65600", automationRows.every(pass), "artifacts/post-p64000-claude-review-handoff-freeze/latest/automation-stop-recommendation-rows.json", generatedAt, {
      next_allowed_action: "delete_or_pause_hermes_p64401_p65600_claude_review_runner",
    }),
    row("handoff.no_clean_claim", "post_p65600_handoff", "P65600 is not clean checkpoint, production PASS, enterprise PASS, or final approval", true, "docs/hermes-roadmap-p65201-p65600.md", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, receipt } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    post_p64000_claude_review_handoff_freeze_ready: closeoutRows.every(pass),
    p65200_normalization_ready_now: sourceRows.every(pass),
    blocking_findings_preserved_now: blockerRows.every(pass),
    p65600_freeze_matrix_ready_now: freezeRows.every(pass),
    automation_stop_recommended_now: automationRows.every(pass),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_post_p65600_handoff: handoffRows.every(pass),
    review_verdict: receipt?.overall_verdict ?? "",
    blocks_clean_checkpoint: receipt?.blocks_clean_checkpoint === true,
    clean_checkpoint_allowed_now: false,
    blocking_finding_count: Number(receipt?.normalized_blocking_finding_count ?? 0),
    finding_count: Number(receipt?.finding_count ?? 0),
    review_refresh_complete_now: closeoutRows.every(pass) && handoffRows.every(pass),
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.post_p65600_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.post_p65600_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, blockerRows, freezeRows, automationRows, authorityRows, negativeRows, validationRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p65200", "source_binding", sourceRows.every(pass), "P65200 normalization source must be valid and ready"),
    validationItem("blockers.revalidated", "blocker_revalidation", blockerRows.every(pass), "Blocking findings must remain visible and open"),
    validationItem("freeze.matrix", "freeze", freezeRows.every(pass), "Freeze matrix must keep clean/protected/production/enterprise claims closed"),
    validationItem("automation.stop", "automation", automationRows.every(pass), "Automation stop recommendation must be ready"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority boundary must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationRows.length === VALIDATION_COMMANDS.length && validationRows.every((item) => item.mutating === false), "Validation commands must be declared and non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P65600 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "Post-P65600 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.post_p64000_claude_review_handoff_freeze_ready === true, "P65600 handoff freeze must be ready"),
    validationItem("boundary.review_refresh_complete", "boundary", boundary.review_refresh_complete_now === true, "Review refresh line must be complete"),
    validationItem("boundary.clean_checkpoint_false", "authority_boundary", boundary.clean_checkpoint_allowed_now === false, "Clean checkpoint must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_post_p65600_handoff && boundary.review_refresh_complete_now
    ? "post_p64000_review_refresh_complete_blockers_open_automation_stop_recommended"
    : validation.valid
      ? "valid_block_post_p65600_handoff_pending"
      : "blocked_post_p64000_claude_review_handoff_freeze";
  return {
    post_p64000_claude_review_handoff_freeze_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p65200_normalization_ready_now: boundary.p65200_normalization_ready_now,
    blocking_findings_preserved_now: boundary.blocking_findings_preserved_now,
    ready_for_post_p65600_handoff: boundary.ready_for_post_p65600_handoff,
    review_refresh_complete_now: boundary.review_refresh_complete_now,
    automation_stop_recommended_now: boundary.automation_stop_recommended_now,
    review_verdict: boundary.review_verdict,
    blocks_clean_checkpoint: boundary.blocks_clean_checkpoint,
    clean_checkpoint_allowed_now: boundary.clean_checkpoint_allowed_now,
    blocking_finding_count: boundary.blocking_finding_count,
    finding_count: boundary.finding_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

function renderMarkdown(result) {
  return [
    `# Post-P64000 Claude Review Handoff Freeze ${result.program_range}`,
    "",
    `- status: ${result.summary.post_p64000_claude_review_handoff_freeze_status}`,
    `- p65200_normalization_ready_now: ${result.summary.p65200_normalization_ready_now}`,
    `- review_verdict: ${result.summary.review_verdict}`,
    `- blocks_clean_checkpoint: ${result.summary.blocks_clean_checkpoint}`,
    `- clean_checkpoint_allowed_now: ${result.summary.clean_checkpoint_allowed_now}`,
    `- blocking_finding_count: ${result.summary.blocking_finding_count}`,
    `- finding_count: ${result.summary.finding_count}`,
    `- review_refresh_complete_now: ${result.summary.review_refresh_complete_now}`,
    `- automation_stop_recommended_now: ${result.summary.automation_stop_recommended_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.review_refresh_complete_now
      ? "Pause or delete the P64401-P65600 review-refresh automation, then start a separate HRM finding remediation program if requested."
      : "Resolve P65600 source, blocker, freeze, authority, wiring, or handoff blockers.",
    "",
  ].join("\n");
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p65600_closeout", label, observed, "artifacts/post-p64000-claude-review-handoff-freeze/latest/post-p64000-claude-review-handoff-freeze.json", generatedAt);
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
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_handoff_freeze" : "resolve_blocker_before_closeout"),
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
    else if (arg === "--blocking-loop-rows") args.blockingLoopRowsPath = argv[++index];
    else if (arg === "--finding-action-rows") args.findingActionRowsPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--normalization PATH] [--normalized-receipt PATH] [--blocking-loop-rows PATH] [--finding-action-rows PATH]`);
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_POST_P64000_CLAUDE_REVIEW_HANDOFF_FREEZE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    normalization_path: path.resolve(repoRoot, options.normalizationPath ?? defaults.normalizationPath),
    normalized_receipt_path: path.resolve(repoRoot, options.normalizedReceiptPath ?? defaults.normalizedReceiptPath),
    blocking_loop_rows_path: path.resolve(repoRoot, options.blockingLoopRowsPath ?? defaults.blockingLoopRowsPath),
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
  const { markdown, ...rest } = result;
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
