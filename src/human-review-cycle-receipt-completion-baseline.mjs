import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-baseline/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_INPUTS = {
  reconciliationPath: "artifacts/human-review-cycle-receipt-completion-reconciliation/latest/human-review-cycle-receipt-completion-reconciliation.json",
};

export async function runHumanReviewCycleReceiptCompletionBaseline(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionBaseline(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionBaseline(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion baseline failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionBaseline(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const reconciliationPath = path.resolve(options.reconciliationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_INPUTS.reconciliationPath);
  const reconciliationResult = await readJsonOrError(reconciliationPath);
  const source = buildSource("human_review_cycle_receipt_completion_reconciliation", "Human Review Cycle Receipt Completion Reconciliation", reconciliationPath, reconciliationResult);
  const reconciliation = reconciliationResult.value;
  const blockerInventory = buildBlockerInventory(reconciliation);
  const countChecks = buildCountChecks(reconciliation, blockerInventory);
  const validation = validateBaseline({ source, reconciliation, blockerInventory, countChecks });
  const baselineStatus = deriveBaselineStatus(validation, blockerInventory);
  const baselineReport = buildBaselineReport({
    generatedAt,
    source,
    reconciliation,
    blockerInventory,
    countChecks,
    baselineStatus,
  });
  const baseline = {
    schema_version: "human-review-cycle-receipt-completion-baseline.v1",
    generated_at: generatedAt,
    baseline_id: `human-review-cycle-receipt-completion-baseline.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    baseline_status: baselineStatus,
    safe_handling: {
      auto_execute_allowed: false,
      baseline_only: true,
      source_artifact_mutation_allowed: false,
      receipt_edits_must_be_manual: true,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    source,
    summary: summarizeBaseline({ reconciliation, blockerInventory, countChecks, validation, baselineStatus }),
    baseline_report: baselineReport,
    blocker_inventory: blockerInventory,
    count_checks: countChecks,
    validation,
  };

  return {
    ...baseline,
    markdown: renderBaselineMarkdown(baseline),
  };
}

export async function writeHumanReviewCycleReceiptCompletionBaseline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-baseline.json"), serializableBaseline(result));
  await writeJson(path.join(outDir, "baseline-report.json"), {
    generated_at: result.generated_at,
    baseline_report: result.baseline_report,
  });
  await writeJson(path.join(outDir, "blocker-inventory.json"), {
    generated_at: result.generated_at,
    count: result.blocker_inventory.length,
    blocker_inventory: result.blocker_inventory,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionBaselineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionBaseline(args);
    console.log(`Human review cycle receipt completion baseline written to ${result.output_dir}`);
    console.log(`Baseline status: ${result.baseline_status}`);
    console.log(`Blockers: ${result.summary.blocker_count}`);
    console.log(`Pending command receipts: ${result.summary.pending_command_receipt_count}`);
    console.log(`Held commands: ${result.summary.held_command_count}`);
    console.log(`Protected holds: ${result.summary.protected_hold_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildBlockerInventory(reconciliation) {
  const items = reconciliation?.reconciliation_items ?? [];
  return items
    .filter((item) => String(item.reconciliation_status ?? "").startsWith("waiting_for"))
    .map((item, index) => ({
      blocker_id: `human-review-cycle-receipt-completion-baseline.blocker.${String(index + 1).padStart(2, "0")}.${slugify(item.reconciliation_item_id)}`,
      blocker_type: item.item_type,
      blocker_status: item.reconciliation_status,
      priority: item.priority,
      required_actor: item.required_actor,
      queue_item_id: item.queue_item_id,
      command_gate_id: item.command_gate_id,
      runbook_step_id: item.runbook_step_id,
      step_key: item.step_key,
      command_kind: item.command_kind,
      command: item.command,
      receipt_status: item.receipt_status,
      command_result: item.command_result,
      protected_hold: item.reconciliation_status === "waiting_for_explicit_human_approval",
      source_reconciliation_item_id: item.reconciliation_item_id,
      source_ref: item.source_ref,
      recommended_action: item.recommended_action,
    }));
}

function buildCountChecks(reconciliation, blockerInventory) {
  const summary = reconciliation?.summary ?? {};
  const actual = {
    pending_command_receipt_count: blockerInventory.filter((item) => item.blocker_type === "pending_command_receipt").length,
    held_command_count: blockerInventory.filter((item) => item.blocker_type === "held_command").length,
    protected_hold_count: blockerInventory.filter((item) => item.protected_hold).length,
    blocker_count: blockerInventory.length,
    reconciliation_item_count: reconciliation?.reconciliation_items?.length ?? 0,
    actor_status_count: reconciliation?.actor_statuses?.length ?? 0,
  };
  const expected = {
    pending_command_receipt_count: summary.pending_command_receipt_count ?? 0,
    held_command_count: summary.held_command_count ?? 0,
    protected_hold_count: summary.protected_held_command_count ?? 0,
    blocker_count: summary.blocked_follow_on_count ?? 0,
    reconciliation_item_count: summary.reconciliation_item_count ?? 0,
    actor_status_count: summary.actor_status_count ?? 0,
  };

  return Object.keys(expected).map((countKey) => ({
    count_check_id: `human-review-cycle-receipt-completion-baseline.count.${countKey}`,
    count_key: countKey,
    expected_count: expected[countKey],
    actual_count: actual[countKey],
    status: expected[countKey] === actual[countKey] ? "matched" : "mismatch",
  }));
}

function validateBaseline({ source, reconciliation, blockerInventory, countChecks }) {
  const errors = [];
  if (!source.available) {
    errors.push({ path: "source", message: `${source.label} unavailable: ${source.error}` });
  }
  if (reconciliation?.validation && !reconciliation.validation.valid) {
    errors.push({ path: "source.validation", message: "Source reconciliation validation is not valid." });
  }
  for (const check of countChecks) {
    if (check.status !== "matched") {
      errors.push({
        path: `count_checks.${check.count_key}`,
        message: `Expected ${check.expected_count} but found ${check.actual_count}.`,
      });
    }
  }
  if (reconciliation?.summary?.refresh_command_executed_by_harness_count !== 0) {
    errors.push({ path: "source.summary.refresh_command_executed_by_harness_count", message: "Baseline source must not include harness-executed refresh commands." });
  }
  if (reconciliation?.summary?.protected_action_executed_count !== 0) {
    errors.push({ path: "source.summary.protected_action_executed_count", message: "Baseline source must not include executed protected actions." });
  }
  if (!source.available && blockerInventory.length > 0) {
    errors.push({ path: "blocker_inventory", message: "Blocker inventory cannot be generated from an unavailable source." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function deriveBaselineStatus(validation, blockerInventory) {
  if (!validation.valid) return "blocked";
  if (blockerInventory.length > 0) return "frozen_with_blockers";
  return "frozen_clear";
}

function summarizeBaseline({ reconciliation, blockerInventory, countChecks, validation, baselineStatus }) {
  return {
    baseline_status: baselineStatus,
    source_reconciliation_status: reconciliation?.reconciliation_status ?? null,
    source_reconciliation_item_count: reconciliation?.summary?.reconciliation_item_count ?? 0,
    source_actor_status_count: reconciliation?.summary?.actor_status_count ?? 0,
    blocker_count: blockerInventory.length,
    pending_command_receipt_count: blockerInventory.filter((item) => item.blocker_type === "pending_command_receipt").length,
    held_command_count: blockerInventory.filter((item) => item.blocker_type === "held_command").length,
    protected_hold_count: blockerInventory.filter((item) => item.protected_hold).length,
    source_pending_command_receipt_count: reconciliation?.summary?.pending_command_receipt_count ?? 0,
    source_held_command_count: reconciliation?.summary?.held_command_count ?? 0,
    source_protected_held_command_count: reconciliation?.summary?.protected_held_command_count ?? 0,
    matched_count_check_count: countChecks.filter((check) => check.status === "matched").length,
    mismatched_count_check_count: countChecks.filter((check) => check.status !== "matched").length,
    validation_error_count: validation.errors.length,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_blocker_status: countBy(blockerInventory, "blocker_status"),
    by_blocker_type: countBy(blockerInventory, "blocker_type"),
    by_required_actor: countBy(blockerInventory, "required_actor"),
  };
}

function buildBaselineReport({ generatedAt, source, reconciliation, blockerInventory, countChecks, baselineStatus }) {
  return {
    report_status: baselineStatus,
    freeze_scope: "human_review_cycle_receipt_completion_reconciliation",
    frozen_at: generatedAt,
    source_reconciliation_id: reconciliation?.reconciliation_id ?? null,
    source_generated_at: reconciliation?.generated_at ?? null,
    source_path: source.path,
    source_schema_version: source.schema_version,
    source_reconciliation_status: reconciliation?.reconciliation_status ?? null,
    source_counts: {
      pending_command_receipt_count: reconciliation?.summary?.pending_command_receipt_count ?? 0,
      held_command_count: reconciliation?.summary?.held_command_count ?? 0,
      protected_held_command_count: reconciliation?.summary?.protected_held_command_count ?? 0,
      reconciliation_item_count: reconciliation?.summary?.reconciliation_item_count ?? 0,
      actor_status_count: reconciliation?.summary?.actor_status_count ?? 0,
    },
    inventory_counts: {
      blocker_count: blockerInventory.length,
      pending_command_receipt_count: blockerInventory.filter((item) => item.blocker_type === "pending_command_receipt").length,
      held_command_count: blockerInventory.filter((item) => item.blocker_type === "held_command").length,
      protected_hold_count: blockerInventory.filter((item) => item.protected_hold).length,
    },
    count_checks: countChecks,
    safety_invariants: {
      auto_execute_allowed: false,
      source_artifact_mutation_allowed: false,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
  };
}

function renderBaselineMarkdown(baseline) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Baseline");
  lines.push("");
  lines.push(`Generated: ${baseline.generated_at}`);
  lines.push(`Baseline status: ${baseline.baseline_status}`);
  lines.push(`Source reconciliation: ${baseline.baseline_report.source_reconciliation_id ?? "unavailable"}`);
  lines.push("");
  lines.push(`- Blockers: ${baseline.summary.blocker_count}`);
  lines.push(`- Pending command receipts: ${baseline.summary.pending_command_receipt_count}`);
  lines.push(`- Held commands: ${baseline.summary.held_command_count}`);
  lines.push(`- Protected holds: ${baseline.summary.protected_hold_count}`);
  lines.push(`- Count mismatches: ${baseline.summary.mismatched_count_check_count}`);
  lines.push(`- Validation errors: ${baseline.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Count Checks");
  lines.push("");
  for (const check of baseline.count_checks) {
    lines.push(`- ${check.count_key}: ${check.status} (${check.actual_count}/${check.expected_count})`);
  }
  lines.push("");
  lines.push("## Blocker Inventory");
  lines.push("");
  for (const blocker of baseline.blocker_inventory) {
    lines.push(`- ${blocker.blocker_status}: ${blocker.step_key} (${blocker.recommended_action})`);
  }
  if (baseline.blocker_inventory.length === 0) lines.push("- No blockers frozen in this baseline.");
  return `${lines.join("\n")}\n`;
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.ok ? null : result.error,
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function serializableBaseline(result) {
  const { markdown, ...artifact } = result;
  return artifact;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const parsed = {
    reconciliationPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_INPUTS.reconciliationPath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_BASELINE_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--reconciliation") parsed.reconciliationPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-baseline.mjs [options]

Options:
  --reconciliation <path>  receipt completion reconciliation artifact path.
  --out-dir <path>        output directory.
  --run-at <iso>          fixed generated_at timestamp.
  --check                 fail when baseline validation has errors.
  --help                  show this help.
`);
}
