import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-reconciliation/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS = {
  completionReadinessPath: "artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json",
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
  commandReceiptApplicationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/human-review-cycle-receipt-completion-command-receipt-application.json",
};

export async function runHumanReviewCycleReceiptCompletionReconciliation(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionReconciliation(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionReconciliation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion reconciliation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionReconciliation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionReadinessPath = path.resolve(options.completionReadinessPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.completionReadinessPath);
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.commandQueuePath);
  const commandReceiptApplicationPath = path.resolve(options.commandReceiptApplicationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.commandReceiptApplicationPath);
  const readinessResult = await readJsonOrError(completionReadinessPath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const applicationResult = await readJsonOrError(commandReceiptApplicationPath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_readiness", "Human Review Cycle Receipt Completion Readiness", completionReadinessPath, readinessResult),
    buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_application", "Human Review Cycle Receipt Completion Command Receipt Application", commandReceiptApplicationPath, applicationResult),
  ];
  const validation = validateReconciliation({ sources, readinessResult, commandQueueResult, applicationResult });
  const reconciliationItems = buildReconciliationItems({ readinessResult, commandQueueResult, applicationResult });
  const actorStatuses = buildActorStatuses({ readinessResult, commandQueueResult, applicationResult });
  const reconciliationStatus = deriveReconciliationStatus(validation, reconciliationItems);
  const reconciliation = {
    schema_version: "human-review-cycle-receipt-completion-reconciliation.v1",
    generated_at: generatedAt,
    reconciliation_id: `human-review-cycle-receipt-completion-reconciliation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    reconciliation_status: reconciliationStatus,
    safe_handling: {
      auto_execute_allowed: false,
      reconciliation_only: true,
      receipt_edits_must_be_manual: true,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeReconciliation({
      readinessResult,
      commandQueueResult,
      applicationResult,
      validation,
      reconciliationItems,
      actorStatuses,
      reconciliationStatus,
    }),
    reconciliation_items: reconciliationItems,
    actor_statuses: actorStatuses,
    recommended_next_actions: buildRecommendedNextActions(reconciliationStatus, reconciliationItems),
    validation,
  };

  return {
    ...reconciliation,
    markdown: renderReconciliationMarkdown(reconciliation),
  };
}

export async function writeHumanReviewCycleReceiptCompletionReconciliation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-reconciliation.json"), serializableReconciliation(result));
  await writeJson(path.join(outDir, "reconciliation-items.json"), {
    generated_at: result.generated_at,
    count: result.reconciliation_items.length,
    reconciliation_items: result.reconciliation_items,
  });
  await writeJson(path.join(outDir, "actor-statuses.json"), {
    generated_at: result.generated_at,
    count: result.actor_statuses.length,
    actor_statuses: result.actor_statuses,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionReconciliationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionReconciliation(args);
    console.log(`Human review cycle receipt completion reconciliation written to ${result.output_dir}`);
    console.log(`Reconciliation status: ${result.reconciliation_status}`);
    console.log(`Items: ${result.summary.reconciliation_item_count}`);
    console.log(`Pending command receipts: ${result.summary.pending_command_receipt_count}`);
    console.log(`Held commands: ${result.summary.held_command_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildReconciliationItems({ readinessResult, commandQueueResult, applicationResult }) {
  const items = [];
  let rank = 1;
  for (const item of applicationResult.value?.pending_command_receipts ?? []) {
    items.push({
      reconciliation_item_id: `human-review-cycle-receipt-completion-reconciliation.item.${String(rank++).padStart(2, "0")}.${slugify(item.queue_item_id)}`,
      item_type: "pending_command_receipt",
      reconciliation_status: "waiting_for_manual_command_receipt",
      priority: "high",
      required_actor: "human_reviewer",
      queue_item_id: item.queue_item_id,
      command_gate_id: item.command_gate_id,
      runbook_step_id: item.runbook_step_id,
      step_key: item.step_key,
      command_kind: item.command_kind,
      command: item.command,
      receipt_status: item.receipt_status,
      command_result: item.command_result,
      source_ref: item.validation_item_id,
      recommended_action: "manually_run_command_and_fill_command_receipt",
    });
  }
  for (const receipt of applicationResult.value?.applied_command_receipts ?? []) {
    items.push({
      reconciliation_item_id: `human-review-cycle-receipt-completion-reconciliation.item.${String(rank++).padStart(2, "0")}.${slugify(receipt.queue_item_id)}`,
      item_type: "applied_command_receipt",
      reconciliation_status: "command_receipt_applied",
      priority: "medium",
      required_actor: receipt.executed_by,
      queue_item_id: receipt.queue_item_id,
      command_gate_id: receipt.command_gate_id,
      runbook_step_id: receipt.runbook_step_id,
      step_key: receipt.step_key,
      command_kind: receipt.command_kind,
      command: receipt.command,
      receipt_status: receipt.receipt_status,
      command_result: receipt.command_result,
      source_ref: receipt.receipt_id,
      recommended_action: "rerun_follow_on_validation_or_dashboard_refresh",
    });
  }
  for (const held of commandQueueResult.value?.held_command_items ?? []) {
    items.push({
      reconciliation_item_id: `human-review-cycle-receipt-completion-reconciliation.item.${String(rank++).padStart(2, "0")}.${slugify(held.held_command_id)}`,
      item_type: "held_command",
      reconciliation_status: held.requires_explicit_human_approval ? "waiting_for_explicit_human_approval" : "waiting_for_manual_input",
      priority: held.requires_explicit_human_approval ? "critical" : "high",
      required_actor: held.requires_explicit_human_approval ? "authorized_operator" : "human_reviewer",
      queue_item_id: null,
      command_gate_id: held.command_gate_id,
      runbook_step_id: held.runbook_step_id,
      step_key: held.step_key,
      command_kind: held.command_kind,
      command: held.command,
      receipt_status: null,
      command_result: null,
      source_ref: held.held_command_id,
      recommended_action: held.requires_explicit_human_approval ? "obtain_explicit_human_approval_before_protected_application" : "complete_manual_receipt_input_before_running_held_command",
    });
  }
  if (items.length === 0 && readinessResult.value?.readiness_status === "ready") {
    items.push({
      reconciliation_item_id: "human-review-cycle-receipt-completion-reconciliation.item.01.clear",
      item_type: "clear",
      reconciliation_status: "ready_for_follow_on_application",
      priority: "low",
      required_actor: "system",
      queue_item_id: null,
      command_gate_id: null,
      runbook_step_id: null,
      step_key: "ready",
      command_kind: "none",
      command: "",
      receipt_status: null,
      command_result: null,
      source_ref: readinessResult.value?.readiness_id ?? "readiness",
      recommended_action: "continue_control_plane_loop",
    });
  }
  return items;
}

function buildActorStatuses({ readinessResult, commandQueueResult, applicationResult }) {
  const pendingCommandReceiptCount = applicationResult.value?.summary?.pending_receipt_count ?? 0;
  const actorQueues = commandQueueResult.value?.actor_command_queues ?? [];
  const readinessByActor = new Map((readinessResult.value?.actor_readiness ?? []).map((actor) => [actor.required_actor, actor]));
  return actorQueues.map((actor, index) => {
    const readiness = readinessByActor.get(actor.required_actor);
    const heldCommandCount = actor.held_commands?.length ?? 0;
    return {
      actor_status_id: `human-review-cycle-receipt-completion-reconciliation.actor.${String(index + 1).padStart(2, "0")}.${slugify(actor.required_actor)}`,
      required_actor: actor.required_actor,
      readiness_status: readiness?.readiness_status ?? actor.readiness_status ?? "unknown",
      reconciliation_status: deriveActorReconciliationStatus(actor, pendingCommandReceiptCount),
      priority: readiness?.priority ?? actor.priority ?? "medium",
      command_queue_item_count: actor.command_queue_item_count ?? 0,
      held_command_item_count: heldCommandCount,
      pending_command_receipt_count: actor.required_actor === "human_reviewer" ? pendingCommandReceiptCount : 0,
      applied_command_receipt_count: applicationResult.value?.summary?.applied_receipt_count ?? 0,
      next_commands: actor.next_commands ?? [],
      held_commands: actor.held_commands ?? [],
      recommended_action: heldCommandCount > 0 ? "resolve_manual_input_or_explicit_approval_hold" : "review_pending_command_receipts",
    };
  });
}

function deriveActorReconciliationStatus(actor, pendingCommandReceiptCount) {
  if (actor.required_actor === "human_reviewer" && pendingCommandReceiptCount > 0) return "waiting_for_manual_command_receipts";
  if ((actor.held_command_item_count ?? actor.held_commands?.length ?? 0) > 0) return "waiting_for_manual_input";
  return "ready";
}

function validateReconciliation({ sources, readinessResult, commandQueueResult, applicationResult }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const readinessErrors = readinessResult.value?.summary?.validation_error_count ?? 0;
  const queueErrors = commandQueueResult.value?.summary?.validation_error_count ?? 0;
  const applicationErrors = applicationResult.value?.summary?.validation_error_count ?? applicationResult.value?.summary?.receipt_error_count ?? 0;
  if (readinessErrors > 0) errors.push({ path: "human_review_cycle_receipt_completion_readiness.validation_error_count", message: "Completion readiness has validation errors." });
  if (queueErrors > 0) errors.push({ path: "human_review_cycle_receipt_completion_command_queue.validation_error_count", message: "Command queue has validation errors." });
  if (applicationErrors > 0) errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_application.validation_error_count", message: "Command receipt application has validation errors." });
  if (applicationResult.value?.safe_handling?.auto_execute_allowed || applicationResult.value?.safe_handling?.protected_actions_executed) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_application.safe_handling", message: "Command receipt application must not auto-execute commands or protected actions." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function deriveReconciliationStatus(validation, items) {
  if (!validation.valid) return "blocked";
  if (items.some((item) => item.reconciliation_status === "waiting_for_manual_command_receipt")) return "waiting_for_manual_command_receipts";
  if (items.some((item) => item.reconciliation_status === "waiting_for_explicit_human_approval")) return "waiting_for_explicit_human_approval";
  if (items.some((item) => item.reconciliation_status === "waiting_for_manual_input")) return "waiting_for_manual_input";
  if (items.some((item) => item.reconciliation_status === "command_receipt_applied")) return "ready_for_follow_on_application";
  return "clear";
}

function summarizeReconciliation(context) {
  const items = context.reconciliationItems;
  return {
    reconciliation_status: context.reconciliationStatus,
    readiness_available: context.readinessResult.ok,
    command_queue_available: context.commandQueueResult.ok,
    command_receipt_application_available: context.applicationResult.ok,
    readiness_status: context.readinessResult.value?.readiness_status ?? null,
    queue_status: context.commandQueueResult.value?.queue_status ?? null,
    command_receipt_application_status: context.applicationResult.value?.application_status ?? null,
    reconciliation_item_count: items.length,
    actor_status_count: context.actorStatuses.length,
    pending_command_receipt_count: context.applicationResult.value?.summary?.pending_receipt_count ?? 0,
    applied_command_receipt_count: context.applicationResult.value?.summary?.applied_receipt_count ?? 0,
    held_command_count: context.commandQueueResult.value?.summary?.held_command_item_count ?? 0,
    protected_held_command_count: context.commandQueueResult.value?.summary?.protected_held_command_count ?? 0,
    pending_human_input_count: context.readinessResult.value?.summary?.pending_human_input_count ?? 0,
    pending_prompt_count: context.readinessResult.value?.summary?.pending_prompt_count ?? 0,
    ready_follow_on_count: items.filter((item) => item.reconciliation_status === "command_receipt_applied" || item.reconciliation_status === "ready_for_follow_on_application").length,
    blocked_follow_on_count: items.filter((item) => item.reconciliation_status.startsWith("waiting_for")).length,
    validation_error_count: context.validation.errors.length,
    refresh_command_executed_by_harness_count: context.applicationResult.value?.summary?.refresh_command_executed_by_harness_count ?? 0,
    protected_action_executed_count: context.applicationResult.value?.summary?.protected_action_executed_count ?? 0,
    by_reconciliation_status: countBy(items, "reconciliation_status"),
    by_item_type: countBy(items, "item_type"),
    by_required_actor: countBy(items, "required_actor"),
  };
}

function buildRecommendedNextActions(status, items) {
  if (status === "waiting_for_manual_command_receipts") {
    return [
      "manually_run_ready_refresh_commands",
      "fill_actor_command_receipt_workspace",
      "rerun_command_receipt_workspace_merge_validation_and_application",
    ];
  }
  if (status === "waiting_for_explicit_human_approval") return ["obtain_explicit_human_approval", "rerun_control_plane_human_gate_receipt_application"];
  if (status === "waiting_for_manual_input") return ["complete_manual_receipt_fields", "rerun_human_review_correction_merge_and_validation"];
  if (status === "ready_for_follow_on_application") return ["rerun_control_plane_loop", "review_human_gate_receipt_application"];
  if (items.length === 0) return ["continue_control_plane_loop"];
  return ["inspect_reconciliation_items"];
}

function renderReconciliationMarkdown(reconciliation) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Reconciliation");
  lines.push("");
  lines.push(`Generated: ${reconciliation.generated_at}`);
  lines.push(`Reconciliation status: ${reconciliation.reconciliation_status}`);
  lines.push("");
  lines.push(`- Reconciliation items: ${reconciliation.summary.reconciliation_item_count}`);
  lines.push(`- Pending command receipts: ${reconciliation.summary.pending_command_receipt_count}`);
  lines.push(`- Applied command receipts: ${reconciliation.summary.applied_command_receipt_count}`);
  lines.push(`- Held commands: ${reconciliation.summary.held_command_count}`);
  lines.push(`- Protected held commands: ${reconciliation.summary.protected_held_command_count}`);
  lines.push(`- Pending human inputs: ${reconciliation.summary.pending_human_input_count}`);
  lines.push(`- Validation errors: ${reconciliation.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Recommended Next Actions");
  lines.push("");
  for (const action of reconciliation.recommended_next_actions) lines.push(`- ${action}`);
  lines.push("");
  lines.push("## Reconciliation Items");
  lines.push("");
  for (const item of reconciliation.reconciliation_items) {
    lines.push(`- ${item.reconciliation_status}: ${item.step_key} (${item.recommended_action})`);
  }
  if (reconciliation.reconciliation_items.length === 0) lines.push("- No reconciliation items.");
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

function serializableReconciliation(result) {
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
    completionReadinessPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.completionReadinessPath,
    commandQueuePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.commandQueuePath,
    commandReceiptApplicationPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_INPUTS.commandReceiptApplicationPath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RECONCILIATION_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--readiness") parsed.completionReadinessPath = argv[++index];
    else if (arg === "--command-queue") parsed.commandQueuePath = argv[++index];
    else if (arg === "--command-receipt-application") parsed.commandReceiptApplicationPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-reconciliation.mjs [options]

Options:
  --readiness <path>                    completion readiness artifact path.
  --command-queue <path>                command queue artifact path.
  --command-receipt-application <path>  command receipt application artifact path.
  --out-dir <path>                      output directory.
  --run-at <iso>                        fixed generated_at timestamp.
  --check                               fail when reconciliation validation has errors.
  --help                                show this help.
`);
}
