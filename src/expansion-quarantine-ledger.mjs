import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXPANSION_QUARANTINE_LEDGER_OUT_DIR = "artifacts/expansion-quarantine-ledger/latest";
export const DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  expansionCursorLedgerPath: "artifacts/expansion-cursor-ledger/latest/expansion-cursor-ledger.json",
  expansionDedupLedgerPath: "artifacts/expansion-dedup-ledger/latest/expansion-dedup-ledger.json",
  backfillJobContractPath: "artifacts/backfill-job-contract/latest/backfill-job-contract.json",
};

const LEDGER_SCHEMA_VERSION = "expansion-quarantine-ledger.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.expansion_quarantine_ledger";
const PHASE_SLOT = "P280";
const PREVIOUS_PHASE_SLOT = "P279";
const NEXT_PHASE_SLOT = "P281";
const HUMAN_REVIEW_NOTE = "Expansion Quarantine Ledger is a read-only failure and hold-classification report. It does not execute backfill, retry extraction, read source file contents, mutate resources or state, release quarantined files, deliver output, produce legal advice, or create client-facing output.";
const REQUIRED_QUARANTINE_CATEGORIES = [
  "sensitive_or_secret",
  "extraction_failure",
  "materialization_required",
  "oversized_file",
  "unsupported_or_unknown_type",
];
const HOLD_DECISIONS = new Set(["hold_for_human_review", "failed_hold"]);

export async function runExpansionQuarantineLedger(options = {}) {
  const result = await buildExpansionQuarantineLedger(options);
  if (options.write !== false) await writeExpansionQuarantineLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Expansion quarantine ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExpansionQuarantineLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const expansionCursorLedgerRead = await readJsonOrError(inputs.expansion_cursor_ledger_path);
  const expansionDedupLedgerRead = await readJsonOrError(inputs.expansion_dedup_ledger_path);
  const backfillJobContractRead = await readJsonOrError(inputs.backfill_job_contract_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const expansionCursorLedger = expansionCursorLedgerRead.value ?? {};
  const expansionDedupLedger = expansionDedupLedgerRead.value ?? {};
  const backfillJobContract = backfillJobContractRead.value ?? {};
  const ruleRows = buildRuleRows(generatedAt);
  const decisionRows = buildDecisionRows(resourceExpansion, generatedAt);
  const holdRows = decisionRows.filter((row) => HOLD_DECISIONS.has(row.quarantine_decision));
  const statusAudits = buildStatusAudits(holdRows, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    expansionDedupLedgerRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    backfillJobContract,
    ruleRows,
    decisionRows,
    holdRows,
    statusAudits,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeQuarantineLedger({
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    backfillJobContract,
    ruleRows,
    decisionRows,
    holdRows,
    statusAudits,
    boundary,
    validation,
  });

  const result = {
    schema_version: LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    expansion_quarantine_ledger_id: `expansion-quarantine-ledger.${dateStamp(generatedAt)}`,
    expansion_quarantine_ledger_status: summary.expansion_quarantine_ledger_status,
    output_dir: outputDir,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      expansionCursorLedgerRead,
      expansionDedupLedgerRead,
      backfillJobContractRead,
    }),
    expansion_quarantine_contract: buildQuarantineContract({ generatedAt, ruleRows, holdRows }),
    quarantine_rule_rows: ruleRows,
    quarantine_decision_rows: decisionRows,
    quarantine_hold_rows: holdRows,
    quarantine_status_audits: statusAudits,
    quarantine_resume_checks: validationItems,
    expansion_quarantine_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummary(result),
  };
}

export async function writeExpansionQuarantineLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableExpansionQuarantineLedger(result);
  await writeJson(path.join(outDir, "expansion-quarantine-ledger.json"), serializable);
  await writeJson(path.join(outDir, "quarantine-rule-rows.json"), {
    schema_version: "expansion-quarantine-rule-rows.v1",
    generated_at: result.generated_at,
    rule_count: result.quarantine_rule_rows.length,
    quarantine_rule_rows: result.quarantine_rule_rows,
  });
  await writeJson(path.join(outDir, "quarantine-decision-rows.json"), {
    schema_version: "expansion-quarantine-decision-rows.v1",
    generated_at: result.generated_at,
    decision_count: result.quarantine_decision_rows.length,
    quarantine_decision_rows: result.quarantine_decision_rows,
  });
  await writeJson(path.join(outDir, "quarantine-hold-rows.json"), {
    schema_version: "expansion-quarantine-hold-rows.v1",
    generated_at: result.generated_at,
    hold_count: result.quarantine_hold_rows.length,
    quarantine_hold_rows: result.quarantine_hold_rows,
  });
  await writeJson(path.join(outDir, "quarantine-status-audits.json"), {
    schema_version: "expansion-quarantine-status-audits.v1",
    generated_at: result.generated_at,
    audit_count: result.quarantine_status_audits.length,
    quarantine_status_audits: result.quarantine_status_audits,
  });
  await writeJson(path.join(outDir, "quarantine-resume-checks.json"), {
    schema_version: "expansion-quarantine-resume-checks.v1",
    generated_at: result.generated_at,
    check_count: result.quarantine_resume_checks.length,
    quarantine_resume_checks: result.quarantine_resume_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "expansion-quarantine-ledger-validation-report.v1",
    generated_at: result.generated_at,
    expansion_quarantine_ledger_id: result.expansion_quarantine_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runExpansionQuarantineLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExpansionQuarantineLedger(args);
    console.log(`Expansion quarantine ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.expansion_quarantine_ledger_status}`);
    console.log(`Decisions: ${result.summary.passed_quarantine_decision_count}/${result.summary.quarantine_decision_count}`);
    console.log(`Held items: ${result.summary.quarantine_hold_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const validationError of error.validation.errors) console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRuleRows(generatedAt) {
  return REQUIRED_QUARANTINE_CATEGORIES.map((category) => ({
    quarantine_rule_row_id: `expansion-quarantine-rule.${category}`,
    generated_at: generatedAt,
    category,
    rule_status: "registered",
    trigger_statuses: triggerStatusesFor(category),
    trigger_reasons: triggerReasonsFor(category),
    default_quarantine_decision: category === "extraction_failure" ? "failed_hold" : "hold_for_human_review",
    retrieval_allowed_for_hold: false,
    external_transfer_allowed_for_hold: false,
    output_delivery_allowed_for_hold: false,
    automatic_release_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
  }));
}

function buildDecisionRows(resourceExpansion, generatedAt) {
  return (resourceExpansion.items ?? []).map((item, index) => {
    const classification = classifyItem(item);
    const quarantineDecision = decisionForItem(item, classification);
    const hold = HOLD_DECISIONS.has(quarantineDecision);
    const statusHistory = Array.isArray(item.status_history) ? item.status_history : [];
    const statusHistoryContainsDecision = !hold || statusHistory.some((event) => ["quarantined", "failed"].includes(event.status));
    const reasonPresent = !hold || Boolean(classification.reason);
    const passed = reasonPresent && statusHistoryContainsDecision;
    return {
      quarantine_decision_row_id: `expansion-quarantine-decision.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      resource_version_id: item.resource_version_id ?? null,
      relative_path: item.relative_path ?? null,
      extension: item.extension ?? null,
      size_bytes: integerOrNull(item.size_bytes),
      data_classification: item.data_classification ?? "unknown",
      item_status: item.status ?? "unknown",
      quarantine_candidate: hold,
      quarantine_decision: quarantineDecision,
      quarantine_category: classification.category,
      quarantine_reason: classification.reason,
      hold_status: hold ? "held_for_human_review" : "not_held",
      decision_status: passed ? "passed" : "attention",
      status_history_contains_decision: statusHistoryContainsDecision,
      retrieval_allowed: !hold,
      external_transfer_allowed: !hold,
      output_delivery_allowed: !hold,
      automatic_release_allowed: false,
      release_requires_human_review: hold,
      retry_execution_performed: false,
      source_file_content_read_performed: false,
      source_path_used_for_hold_identity: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function buildStatusAudits(holdRows, generatedAt) {
  return holdRows.map((row, index) => ({
    quarantine_status_audit_id: `expansion-quarantine-status-audit.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    item_id: row.item_id,
    item_status: row.item_status,
    quarantine_decision: row.quarantine_decision,
    quarantine_category: row.quarantine_category,
    hold_status: row.hold_status,
    audit_status: row.status_history_contains_decision ? "passed" : "attention",
    status_history_contains_decision: row.status_history_contains_decision,
    release_event_present: false,
    automatic_release_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
  }));
}

function classifyItem(item) {
  if (item.status === "failed") {
    return { category: "extraction_failure", reason: item.error?.name ?? item.error?.message ?? "expansion_failed" };
  }
  if (item.status === "quarantined" || item.quarantine_reason) {
    return classifyReason(item.quarantine_reason ?? "quarantined");
  }
  if (item.data_classification === "P5_SECRET") {
    return { category: "sensitive_or_secret", reason: "secret_or_credential_path" };
  }
  return { category: "none", reason: null };
}

function classifyReason(reason) {
  const value = String(reason ?? "");
  if (value.includes("secret") || value.includes("credential") || value.includes("token")) {
    return { category: "sensitive_or_secret", reason: value };
  }
  if (value.includes("materialization")) {
    return { category: "materialization_required", reason: value };
  }
  if (value.includes("too_large") || value.includes("oversized")) {
    return { category: "oversized_file", reason: value };
  }
  if (value.includes("unsupported") || value.includes("unknown")) {
    return { category: "unsupported_or_unknown_type", reason: value };
  }
  return { category: "extraction_failure", reason: value || "quarantined" };
}

function decisionForItem(item, classification) {
  if (item.status === "failed") return "failed_hold";
  if (classification.category !== "none") return "hold_for_human_review";
  if (item.status === "queued") return "pending_backfill";
  return "no_hold";
}

function buildQuarantineContract({ generatedAt, ruleRows, holdRows }) {
  return {
    schema_version: "expansion-quarantine-contract.v1",
    generated_at: generatedAt,
    contract_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    required_quarantine_categories: REQUIRED_QUARANTINE_CATEGORIES,
    quarantine_rule_count: ruleRows.length,
    quarantine_hold_count: holdRows.length,
    hold_rule: "Failed, sensitive, unknown, unsupported, dataless/materialization-required, and oversized expansion items are held for human review before retrieval, transfer, or delivery.",
    release_rule: "This ledger cannot release, retry, mutate, or promote a held item; release requires a later explicit human-reviewed artifact.",
    source_file_content_read_allowed: false,
    absolute_path_hold_identity_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "expansion-quarantine-ledger.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    quarantine_ledger_report_only: true,
    source_artifact_read_performed: true,
    backfill_execution_performed: false,
    extraction_retry_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    quarantine_release_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready_count: 0,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildCheckpoints(context) {
  const {
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    expansionDedupLedgerRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    backfillJobContract,
    ruleRows,
    decisionRows,
    holdRows,
    statusAudits,
    boundary,
  } = context;
  const items = resourceExpansion.items ?? [];
  const summary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  const expectedHoldCount = integerOrZero(summary.quarantine_count) + integerOrZero(summary.failed_count);
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.expansion_cursor_ledger", expansionCursorLedgerRead.available && cursorSummary.expansion_cursor_ledger_status === "complete" && cursorSummary.phase_slot === "P278", "P278 Expansion Cursor Ledger is complete."),
    checkpoint("source.expansion_dedup_ledger", expansionDedupLedgerRead.available && dedupSummary.expansion_dedup_ledger_status === "complete" && dedupSummary.phase_slot === "P279", "P279 Expansion Dedup Ledger is complete."),
    checkpoint("source.backfill_job_contract", backfillJobContractRead.available && backfillSummary.backfill_job_contract_status === "complete" && backfillSummary.phase_slot === "P277", "P277 Backfill Job Contract is complete."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:expansion-quarantine-ledger"), "package.json exposes resource:expansion-quarantine-ledger."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["expansion_quarantine_ledger", "resource:expansion-quarantine-ledger"]) && includesAll(reviewDashboardText.value, ["expansion_quarantine_ledger", "buildExpansionQuarantineLedgerStage"]) && includesAll(reviewApiText.value, ["/api/expansion-quarantine-ledgers", "/api/expansion-quarantine-holds"]), "Control-plane loop, dashboard, and API expose Expansion Quarantine Ledger."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P280", "expansion quarantine ledger"]) && includesAll(implementationRoadmapText.value, ["Phase 280", "Expansion Quarantine Ledger"]), "Ledger and implementation roadmap promote Phase 280."),
    checkpoint("rules.required_categories", REQUIRED_QUARANTINE_CATEGORIES.every((category) => ruleRows.some((row) => row.category === category && row.rule_status === "registered")), "Required quarantine categories are registered."),
    checkpoint("rules.block_hold_access", ruleRows.every((row) => row.retrieval_allowed_for_hold === false && row.external_transfer_allowed_for_hold === false && row.output_delivery_allowed_for_hold === false), "Hold rules block retrieval, transfer, and delivery."),
    checkpoint("decisions.coverage", decisionRows.length === items.length && decisionRows.length > 0, "Quarantine decision rows cover every expansion item."),
    checkpoint("decisions.passed", decisionRows.every((row) => row.decision_status === "passed"), "Every quarantine decision row passes validation."),
    checkpoint("holds.counts", holdRows.length === expectedHoldCount, "Held row count matches Resource Expansion failed/quarantined counts."),
    checkpoint("holds.reasons", holdRows.every((row) => row.quarantine_reason && row.quarantine_category !== "none"), "Every held row has a quarantine reason and category."),
    checkpoint("holds.status_history", holdRows.every((row) => row.status_history_contains_decision) && statusAudits.every((row) => row.audit_status === "passed"), "Held rows retain quarantine or failure status history."),
    checkpoint("holds.no_release", holdRows.every((row) => row.automatic_release_allowed === false && row.release_requires_human_review === true), "Held rows cannot auto-release and require human review."),
    checkpoint("identity.path_portable", decisionRows.every((row) => row.source_path_used_for_hold_identity === false), "Hold identity does not rely on absolute source paths."),
    checkpoint("boundary.no_execution", boundary.backfill_execution_performed === false && boundary.extraction_retry_performed === false && boundary.file_content_read_performed === false, "No backfill execution, retry, or source file content read occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.quarantine_release_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state mutation, quarantine release, or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No legal advice or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && dedupSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeQuarantineLedger({ resourceExpansion, expansionCursorLedger, expansionDedupLedger, backfillJobContract, ruleRows, decisionRows, holdRows, statusAudits, boundary, validation }) {
  const summary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  return {
    expansion_quarantine_ledger_status: validation.valid ? "complete" : "attention",
    expansion_quarantine_ledger_id: LEDGER_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_expansion_cursor_ledger_status: cursorSummary.expansion_cursor_ledger_status ?? "unknown",
    source_expansion_cursor_phase_slot: cursorSummary.phase_slot ?? null,
    source_expansion_dedup_ledger_status: dedupSummary.expansion_dedup_ledger_status ?? "unknown",
    source_expansion_dedup_phase_slot: dedupSummary.phase_slot ?? null,
    source_backfill_job_contract_status: backfillSummary.backfill_job_contract_status ?? "unknown",
    source_backfill_job_contract_phase_slot: backfillSummary.phase_slot ?? null,
    discovered_count: integerOrZero(summary.discovered_count),
    terminal_count: integerOrZero(summary.terminal_count),
    extracted_count: integerOrZero(summary.extracted_count),
    skipped_duplicate_count: integerOrZero(summary.skipped_duplicate_count),
    source_quarantine_count: integerOrZero(summary.quarantine_count),
    source_failed_count: integerOrZero(summary.failed_count),
    source_dataless_count: integerOrZero(summary.dataless_count),
    quarantine_rule_count: ruleRows.length,
    required_quarantine_category_count: REQUIRED_QUARANTINE_CATEGORIES.length,
    quarantine_decision_count: decisionRows.length,
    passed_quarantine_decision_count: decisionRows.filter((row) => row.decision_status === "passed").length,
    quarantine_hold_count: holdRows.length,
    sensitive_or_secret_hold_count: holdRows.filter((row) => row.quarantine_category === "sensitive_or_secret").length,
    extraction_failure_hold_count: holdRows.filter((row) => row.quarantine_category === "extraction_failure").length,
    materialization_required_hold_count: holdRows.filter((row) => row.quarantine_category === "materialization_required").length,
    oversized_file_hold_count: holdRows.filter((row) => row.quarantine_category === "oversized_file").length,
    unsupported_or_unknown_type_hold_count: holdRows.filter((row) => row.quarantine_category === "unsupported_or_unknown_type").length,
    held_retrieval_allowed_count: holdRows.filter((row) => row.retrieval_allowed).length,
    held_external_transfer_allowed_count: holdRows.filter((row) => row.external_transfer_allowed).length,
    held_output_delivery_allowed_count: holdRows.filter((row) => row.output_delivery_allowed).length,
    automatic_release_allowed_count: holdRows.filter((row) => row.automatic_release_allowed).length,
    human_review_required_hold_count: holdRows.filter((row) => row.release_requires_human_review).length,
    quarantine_status_audit_count: statusAudits.length,
    passed_quarantine_status_audit_count: statusAudits.filter((row) => row.audit_status === "passed").length,
    source_path_used_for_hold_identity_count: decisionRows.filter((row) => row.source_path_used_for_hold_identity).length,
    read_only: boundary.read_only,
    quarantine_ledger_report_only: boundary.quarantine_ledger_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    extraction_retry_performed: boundary.extraction_retry_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    quarantine_release_performed: boundary.quarantine_release_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved && dedupSummary.windows_baseline_stability_preserved === true,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.items.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts(reads) {
  return [
    sourceContract("package.json", reads.packageJson),
    sourceContract("final-completion-phase-ledger", reads.roadmapText),
    sourceContract("implementation-roadmap", reads.implementationRoadmapText),
    sourceContract("control-plane-loop", reads.controlPlaneLoopText),
    sourceContract("review-dashboard", reads.reviewDashboardText),
    sourceContract("review-api", reads.reviewApiText),
    sourceContract("resource-expansion-job", reads.resourceExpansionRead),
    sourceContract("expansion-cursor-ledger", reads.expansionCursorLedgerRead),
    sourceContract("expansion-dedup-ledger", reads.expansionDedupLedgerRead),
    sourceContract("backfill-job-contract", reads.backfillJobContractRead),
  ];
}

function sourceContract(label, readResult) {
  return {
    label,
    available: readResult.available,
    schema_version: readResult.value?.schema_version ?? null,
    content_hash: readResult.content_hash ?? null,
    error: readResult.error ?? null,
  };
}

function renderSummary(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Expansion Quarantine Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.expansion_quarantine_ledger_status}`);
  lines.push(`Phase: ${summary.phase_slot}`);
  lines.push(`Source job: ${summary.source_resource_expansion_job_id}`);
  lines.push("");
  lines.push("## Quarantine");
  lines.push("");
  lines.push(`- Decisions: ${summary.passed_quarantine_decision_count}/${summary.quarantine_decision_count}`);
  lines.push(`- Held items: ${summary.quarantine_hold_count}`);
  lines.push(`- Sensitive/secret holds: ${summary.sensitive_or_secret_hold_count}`);
  lines.push(`- Failed holds: ${summary.extraction_failure_hold_count}`);
  lines.push(`- Status audits: ${summary.passed_quarantine_status_audit_count}/${summary.quarantine_status_audit_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The ledger reads existing Resource Expansion artifacts only.");
  lines.push("- It performs no backfill execution, extraction retry, source ingest, source file content read, mutation, quarantine release, delivery, protected action, legal advice, or client-facing output.");
  lines.push("- Held rows remain human-review gated and not client-facing.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function triggerStatusesFor(category) {
  if (category === "extraction_failure") return ["failed"];
  return ["quarantined"];
}

function triggerReasonsFor(category) {
  if (category === "sensitive_or_secret") return ["secret_or_credential_path", "P5_SECRET"];
  if (category === "extraction_failure") return ["extract", "ingest_or_extract", "expansion_failed"];
  if (category === "materialization_required") return ["materialization_required"];
  if (category === "oversized_file") return ["file_too_large_for_default_expansion"];
  if (category === "unsupported_or_unknown_type") return ["unsupported_or_unknown_type", "recorded_unknown_type"];
  return [];
}

function serializableExpansionQuarantineLedger(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
    items,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.resourceExpansionPath,
    expansion_cursor_ledger_path: options.expansionCursorLedgerPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.expansionCursorLedgerPath,
    expansion_dedup_ledger_path: options.expansionDedupLedgerPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.expansionDedupLedgerPath,
    backfill_job_contract_path: options.backfillJobContractPath ?? DEFAULT_EXPANSION_QUARANTINE_LEDGER_INPUTS.backfillJobContractPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--expansion-cursor-ledger") parsed.expansionCursorLedgerPath = argv[++index];
    else if (arg === "--expansion-dedup-ledger") parsed.expansionDedupLedgerPath = argv[++index];
    else if (arg === "--backfill-job-contract") parsed.backfillJobContractPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/expansion-quarantine-ledger.mjs [options]

Options:
  --resource-expansion <path>          resource-expansion-job.json path.
  --expansion-cursor-ledger <path>     expansion-cursor-ledger.json path.
  --expansion-dedup-ledger <path>      expansion-dedup-ledger.json path.
  --backfill-job-contract <path>       backfill-job-contract.json path.
  --out-dir <folder>                   Output folder.
  --check                              Fail if validation does not pass.
  -h, --help                           Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: JSON.parse(text),
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: null,
      error: String(error?.message ?? error),
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: "",
      error: String(error?.message ?? error),
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EIO", "ENOENT", "EBUSY", "EPERM"].includes(error?.code) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function integerOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
