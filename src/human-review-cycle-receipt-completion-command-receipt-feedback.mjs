import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_INPUTS = {
  commandReceiptValidationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
  commandReceiptsPath: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json",
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleReceiptCompletionCommandReceiptFeedback(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceiptFeedback(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceiptFeedback(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command receipt feedback failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceiptFeedback(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const commandReceiptValidationPath = path.resolve(options.commandReceiptValidationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_INPUTS.commandReceiptValidationPath);
  const commandReceiptsPath = path.resolve(options.commandReceiptsPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_INPUTS.commandReceiptsPath);
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_FEEDBACK_INPUTS.commandQueuePath);
  const commandReceiptValidationResult = await readJsonOrError(commandReceiptValidationPath);
  const commandReceiptsResult = await readJsonOrError(commandReceiptsPath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const feedbackItems = buildFeedbackItems(commandReceiptValidationResult.value, commandReceiptsResult.value, commandQueueResult.value);
  const actorFeedback = buildActorFeedback(feedbackItems, commandQueueResult.value?.actor_command_queues ?? [], outputDir);
  const validation = validateFeedback({ commandReceiptValidationResult, commandReceiptsResult, commandQueueResult, feedbackItems });
  const feedback = {
    schema_version: "human-review-cycle-receipt-completion-command-receipt-feedback.v1",
    generated_at: generatedAt,
    feedback_id: `human-review-cycle-receipt-completion-command-receipt-feedback.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    feedback_status: deriveFeedbackStatus(validation, feedbackItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      feedback_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_cycle_receipt_completion_command_receipt_validation", "Human Review Cycle Receipt Completion Command Receipt Validation", commandReceiptValidationPath, commandReceiptValidationResult),
      buildSource("human_review_cycle_receipt_completion_command_receipts", "Human Review Cycle Receipt Completion Command Receipts", commandReceiptsPath, commandReceiptsResult),
      buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
    ],
    summary: summarizeFeedback(actorFeedback, feedbackItems, validation),
    actor_feedback: actorFeedback,
    feedback_items: feedbackItems,
    validation,
  };

  return {
    ...feedback,
    markdown: renderFeedbackMarkdown(feedback),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceiptFeedback(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback.json"), serializableFeedback(result));
  await writeJson(path.join(outDir, "feedback-items.json"), {
    generated_at: result.generated_at,
    count: result.feedback_items.length,
    feedback_items: result.feedback_items,
  });
  await writeJson(path.join(outDir, "actor-feedback.json"), {
    generated_at: result.generated_at,
    count: result.actor_feedback.length,
    actor_feedback: result.actor_feedback,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_feedback) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.feedback_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "feedback.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      feedback_status: actor.feedback_status,
      count: items.length,
      feedback_items: items,
    });
    await writeFile(path.join(actorDir, "feedback.md"), renderActorFeedbackMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptFeedbackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceiptFeedback(args);
    console.log(`Human review cycle receipt completion command receipt feedback ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Feedback status: ${result.feedback_status}`);
    console.log(`Actor feedback: ${result.summary.actor_feedback_count}`);
    console.log(`Feedback items: ${result.summary.feedback_item_count}`);
    console.log(`Pending command receipts: ${result.summary.pending_receipt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFeedbackItems(commandReceiptValidation, commandReceipts, commandQueue) {
  const requirementByQueueItemId = new Map((commandReceipts?.receipt_requirements ?? []).map((requirement) => [requirement.queue_item_id, requirement]));
  const actorByCommand = buildActorByCommand(commandQueue?.actor_command_queues ?? []);
  return (commandReceiptValidation?.validation_items ?? [])
    .map((validationItem) => buildFeedbackItem(validationItem, requirementByQueueItemId.get(validationItem.queue_item_id), actorByCommand))
    .sort(compareFeedbackItems);
}

function buildFeedbackItem(validationItem, requirement, actorByCommand) {
  const feedbackStatus = deriveItemFeedbackStatus(validationItem.validation_status);
  const requiredActor = actorByCommand.get(validationItem.command) ?? "human_reviewer";
  return {
    feedback_item_id: `human-review-cycle-receipt-completion-command-receipt-feedback.${slugify(validationItem.queue_item_id)}`,
    validation_item_id: validationItem.validation_item_id,
    receipt_requirement_id: validationItem.receipt_requirement_id ?? requirement?.receipt_requirement_id ?? null,
    receipt_id: validationItem.receipt?.receipt_id ?? requirement?.receipt_form_draft?.receipt_id ?? null,
    queue_item_id: validationItem.queue_item_id,
    command_gate_id: validationItem.command_gate_id,
    runbook_step_id: validationItem.runbook_step_id,
    step_key: validationItem.step_key,
    command_kind: validationItem.command_kind,
    command: validationItem.command,
    required_actor: requiredActor,
    priority: feedbackStatus === "needs_correction" ? "high" : "medium",
    validation_status: validationItem.validation_status,
    feedback_status: feedbackStatus,
    receipt_status: validationItem.receipt_status,
    command_result: validationItem.command_result,
    ready_to_confirm: Boolean(validationItem.ready_to_confirm),
    error_count: validationItem.error_count ?? 0,
    errors: validationItem.errors ?? [],
    required_receipt_fields: validationItem.required_receipt_fields ?? requirement?.required_receipt_fields ?? [],
    acceptance_criteria: requirement?.acceptance_criteria ?? [],
    next_actions: buildNextActions(validationItem.validation_status, validationItem),
    receipt_input_path: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-input-draft.json",
    receipt: validationItem.receipt ?? null,
    safe_handling: {
      auto_execute_allowed: false,
      feedback_only: true,
      protected_actions_executed: false,
    },
  };
}

function buildActorByCommand(actorCommandQueues) {
  const actorByCommand = new Map();
  for (const actorQueue of actorCommandQueues) {
    for (const command of actorQueue.next_commands ?? []) {
      if (!actorByCommand.has(command)) actorByCommand.set(command, actorQueue.required_actor);
    }
  }
  return actorByCommand;
}

function deriveItemFeedbackStatus(validationStatus) {
  if (validationStatus === "ready_to_confirm") return "ready_for_confirmation";
  if (validationStatus === "pending_receipt") return "needs_command_receipt";
  if (["invalid_receipt", "missing_receipt", "unknown_command_receipt"].includes(validationStatus)) return "needs_correction";
  return "attention";
}

function buildNextActions(validationStatus, validationItem) {
  if (validationStatus === "ready_to_confirm") {
    return ["review_validated_command_receipt", "rerun_completion_command_receipt_feedback"];
  }
  if (validationStatus === "pending_receipt") {
    return [
      "run_command_manually_if_still_needed",
      "fill_command_receipt_status_result_actor_time_output_reference_and_notes",
      "rerun_completion_command_receipt_validation",
      "rerun_completion_command_receipt_feedback",
    ];
  }
  const fields = (validationItem.errors ?? []).map((error) => error.field).filter(Boolean);
  return [
    "fix_command_receipt_input",
    ...(fields.length > 0 ? [`check_fields:${[...new Set(fields)].join(",")}`] : []),
    "rerun_completion_command_receipt_validation",
  ];
}

function buildActorFeedback(feedbackItems, actorCommandQueues, outputDir) {
  const actorByKey = new Map(actorCommandQueues.map((actorQueue) => [actorQueue.required_actor, actorQueue]));
  return Object.entries(groupBy(feedbackItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const actorQueue = actorByKey.get(requiredActor);
      return {
        actor_feedback_id: `human-review-cycle-receipt-completion-command-receipt-feedback.actor.${slugify(requiredActor)}`,
        actor_command_queue_id: actorQueue?.actor_command_queue_id ?? null,
        required_actor: requiredActor,
        feedback_status: deriveActorFeedbackStatus(items),
        priority: highestPriority(items),
        feedback_item_count: items.length,
        pending_receipt_count: items.filter((item) => item.feedback_status === "needs_command_receipt").length,
        ready_for_confirmation_count: items.filter((item) => item.feedback_status === "ready_for_confirmation").length,
        needs_correction_count: items.filter((item) => item.feedback_status === "needs_correction").length,
        feedback_item_ids: items.map((item) => item.feedback_item_id),
        feedback_json_path: path.join(outputDir, "actors", requiredActor, "feedback.json"),
        feedback_markdown_path: path.join(outputDir, "actors", requiredActor, "feedback.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          feedback_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorFeedback);
}

function deriveActorFeedbackStatus(items) {
  if (items.some((item) => item.feedback_status === "needs_correction")) return "attention";
  if (items.some((item) => item.feedback_status === "needs_command_receipt")) return "pending_human_review";
  if (items.some((item) => item.feedback_status === "ready_for_confirmation")) return "ready_for_confirmation";
  return "clear";
}

function validateFeedback({ commandReceiptValidationResult, commandReceiptsResult, commandQueueResult, feedbackItems }) {
  const errors = [];
  if (!commandReceiptValidationResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_receipt_validation", message: `Command receipt validation unavailable: ${commandReceiptValidationResult.error}` });
  }
  if (!commandReceiptsResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_receipts", message: `Command receipts unavailable: ${commandReceiptsResult.error}` });
  }
  if (!commandQueueResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_queue", message: `Command queue unavailable: ${commandQueueResult.error}` });
  }
  if (commandReceiptValidationResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_validation.safe_handling.auto_execute_allowed", message: "Command receipt feedback requires auto execution to remain disabled." });
  }
  for (const item of feedbackItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `feedback_items.${item.feedback_item_id}.safe_handling`, message: "Command receipt feedback must not execute commands or protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFeedback(actorFeedback, feedbackItems, validation) {
  return {
    actor_feedback_count: actorFeedback.length,
    feedback_item_count: feedbackItems.length,
    pending_receipt_count: feedbackItems.filter((item) => item.feedback_status === "needs_command_receipt").length,
    ready_for_confirmation_count: feedbackItems.filter((item) => item.feedback_status === "ready_for_confirmation").length,
    needs_correction_count: feedbackItems.filter((item) => item.feedback_status === "needs_correction").length,
    invalid_receipt_count: feedbackItems.filter((item) => item.validation_status === "invalid_receipt").length,
    missing_receipt_count: feedbackItems.filter((item) => item.validation_status === "missing_receipt").length,
    unknown_receipt_count: feedbackItems.filter((item) => item.validation_status === "unknown_command_receipt").length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(feedbackItems, "required_actor"),
    by_command_kind: countBy(feedbackItems, "command_kind"),
    by_validation_status: countBy(feedbackItems, "validation_status"),
    by_feedback_status: countBy(feedbackItems, "feedback_status"),
  };
}

function deriveFeedbackStatus(validation, feedbackItems) {
  if (!validation.valid) return "blocked";
  if (feedbackItems.some((item) => item.feedback_status === "needs_correction")) return "attention";
  if (feedbackItems.some((item) => item.feedback_status === "needs_command_receipt")) return "pending_human_review";
  if (feedbackItems.some((item) => item.feedback_status === "ready_for_confirmation")) return "ready_for_confirmation";
  return "clear";
}

function renderFeedbackMarkdown(feedback) {
  const lines = [
    "# Human Review Cycle Receipt Completion Command Receipt Feedback",
    "",
    `- Feedback status: ${feedback.feedback_status}`,
    `- Actor feedback: ${feedback.summary.actor_feedback_count}`,
    `- Feedback items: ${feedback.summary.feedback_item_count}`,
    `- Pending command receipts: ${feedback.summary.pending_receipt_count}`,
    `- Ready for confirmation: ${feedback.summary.ready_for_confirmation_count}`,
    `- Needs correction: ${feedback.summary.needs_correction_count}`,
    `- Validation errors: ${feedback.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact only routes command receipt validation feedback back to reviewers.",
    "- It does not run commands, edit receipt inputs, apply receipts, or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of feedback.actor_feedback) {
    lines.push(`- ${actor.required_actor}: ${actor.feedback_item_count} item(s), ${actor.pending_receipt_count} pending, ${actor.feedback_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorFeedbackMarkdown(actor, items) {
  const lines = [
    `# Command Receipt Feedback: ${actor.required_actor}`,
    "",
    `- Feedback status: ${actor.feedback_status}`,
    `- Feedback items: ${actor.feedback_item_count}`,
    `- Pending command receipts: ${actor.pending_receipt_count}`,
    `- Ready for confirmation: ${actor.ready_for_confirmation_count}`,
    `- Needs correction: ${actor.needs_correction_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.step_key}`);
    lines.push("");
    lines.push(`- Feedback status: ${item.feedback_status}`);
    lines.push(`- Validation status: ${item.validation_status}`);
    lines.push(`- Receipt status: ${item.receipt_status}`);
    lines.push(`- Command result: ${item.command_result}`);
    lines.push(`- Command: \`${item.command}\``);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
    if (item.errors.length > 0) {
      lines.push(`- Errors: ${item.errors.map((error) => `${error.field}: ${error.message}`).join(" | ")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function serializableFeedback(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    feedback_id: result.feedback_id,
    output_dir: result.output_dir,
    feedback_status: result.feedback_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_feedback: result.actor_feedback,
    feedback_items: result.feedback_items,
    validation: result.validation,
  };
}

async function readJsonOrError(filePath) {
  if (!filePath) return { ok: false, value: null, error: "disabled" };
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return { ok: true, value, error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.code === "ENOENT" ? "not_found" : error.message };
  }
}

function buildSource(sourceId, label, filePath, result) {
  return {
    source_id: sourceId,
    label,
    path: filePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.error ?? null,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareFeedbackItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || String(a.required_actor).localeCompare(String(b.required_actor))
    || String(a.step_key).localeCompare(String(b.step_key));
}

function compareActorFeedback(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || String(a.required_actor).localeCompare(String(b.required_actor));
}

function highestPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))[0]?.priority ?? "low";
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(value) {
  return value.replaceAll(":", "").replaceAll(".", "").replace("T", ".").replace("Z", "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--command-receipt-validation") args.commandReceiptValidationPath = argv[++index];
    else if (arg === "--command-receipts") args.commandReceiptsPath = argv[++index];
    else if (arg === "--command-queue") args.commandQueuePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipt-feedback.mjs [options]

Options:
  --command-receipt-validation <path> Command receipt validation artifact
  --command-receipts <path>            Command receipts artifact
  --command-queue <path>               Command queue artifact
  --out-dir <dir>                      Output directory
  --run-at <iso>                       Override generated_at
  --check                              Exit non-zero when structural validation fails
`);
}
