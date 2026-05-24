import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_INPUTS = {
  commandReceiptFeedbackPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-feedback/latest/human-review-cycle-receipt-completion-command-receipt-feedback.json",
  commandReceiptsPath: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command receipt workspace failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const commandReceiptFeedbackPath = path.resolve(options.commandReceiptFeedbackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_INPUTS.commandReceiptFeedbackPath);
  const commandReceiptsPath = path.resolve(options.commandReceiptsPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_INPUTS.commandReceiptsPath);
  const feedbackResult = await readJsonOrError(commandReceiptFeedbackPath);
  const commandReceiptsResult = await readJsonOrError(commandReceiptsPath);
  const workspaceItems = buildWorkspaceItems(feedbackResult.value?.feedback_items ?? [], outputDir);
  const actorWorkspaces = buildActorWorkspaces(workspaceItems, outputDir);
  const validation = validateWorkspace({ feedbackResult, commandReceiptsResult, workspaceItems, actorWorkspaces });
  const workspace = {
    schema_version: "human-review-cycle-receipt-completion-command-receipt-workspace.v1",
    generated_at: generatedAt,
    workspace_id: `human-review-cycle-receipt-completion-command-receipt-workspace.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    workspace_status: deriveWorkspaceStatus(validation, workspaceItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      command_receipt_workspace_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [
      buildSource("human_review_cycle_receipt_completion_command_receipt_feedback", "Human Review Cycle Receipt Completion Command Receipt Feedback", commandReceiptFeedbackPath, feedbackResult),
      buildSource("human_review_cycle_receipt_completion_command_receipts", "Human Review Cycle Receipt Completion Command Receipts", commandReceiptsPath, commandReceiptsResult),
    ],
    summary: summarizeWorkspace(actorWorkspaces, workspaceItems, validation),
    actor_workspaces: actorWorkspaces,
    workspace_items: workspaceItems,
    validation,
  };

  return {
    ...workspace,
    markdown: renderWorkspaceMarkdown(workspace),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace.json"), serializableWorkspace(result));
  await writeJson(path.join(outDir, "workspace-items.json"), {
    generated_at: result.generated_at,
    count: result.workspace_items.length,
    workspace_items: result.workspace_items,
  });
  await writeJson(path.join(outDir, "actor-workspaces.json"), {
    generated_at: result.generated_at,
    count: result.actor_workspaces.length,
    actor_workspaces: result.actor_workspaces,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_workspaces) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.workspace_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "command-receipt-workspace.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      workspace_status: actor.workspace_status,
      count: items.length,
      workspace_items: items,
    });
    await writeJson(path.join(actorDir, "receipt-input.json"), {
      schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
      generated_at: result.generated_at,
      command_queue_id: inferCommandQueueId(result),
      instructions: `Editable command receipt input for ${actor.required_actor}. Manually run commands if still needed, fill receipt rows, rerun command receipt validation, and do not execute protected actions from this file.`,
      receipts: items.map((item) => item.editable_receipt),
    });
    await writeFile(path.join(actorDir, "workspace.md"), renderActorWorkspaceMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceiptWorkspace(args);
    console.log(`Human review cycle receipt completion command receipt workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Workspace status: ${result.workspace_status}`);
    console.log(`Actor workspaces: ${result.summary.actor_workspace_count}`);
    console.log(`Workspace items: ${result.summary.workspace_item_count}`);
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

function buildWorkspaceItems(feedbackItems, outputDir) {
  return (feedbackItems ?? [])
    .map((item) => buildWorkspaceItem(item, outputDir))
    .sort(compareWorkspaceItems);
}

function buildWorkspaceItem(feedbackItem, outputDir) {
  const workspaceStatus = deriveItemWorkspaceStatus(feedbackItem.feedback_status);
  const requiredActor = feedbackItem.required_actor ?? "human_reviewer";
  return {
    workspace_item_id: `human-review-cycle-receipt-completion-command-receipt-workspace.${slugify(feedbackItem.queue_item_id)}`,
    feedback_item_id: feedbackItem.feedback_item_id,
    validation_item_id: feedbackItem.validation_item_id,
    receipt_requirement_id: feedbackItem.receipt_requirement_id,
    receipt_id: feedbackItem.receipt_id,
    queue_item_id: feedbackItem.queue_item_id,
    command_gate_id: feedbackItem.command_gate_id,
    runbook_step_id: feedbackItem.runbook_step_id,
    step_key: feedbackItem.step_key,
    command_kind: feedbackItem.command_kind,
    command: feedbackItem.command,
    required_actor: requiredActor,
    priority: feedbackItem.priority ?? "medium",
    workspace_status: workspaceStatus,
    feedback_status: feedbackItem.feedback_status,
    validation_status: feedbackItem.validation_status,
    receipt_status: feedbackItem.receipt_status,
    command_result: feedbackItem.command_result,
    ready_to_confirm: Boolean(feedbackItem.ready_to_confirm),
    error_count: feedbackItem.error_count ?? 0,
    errors: feedbackItem.errors ?? [],
    required_receipt_fields: feedbackItem.required_receipt_fields ?? [],
    acceptance_criteria: feedbackItem.acceptance_criteria ?? [],
    next_actions: buildWorkspaceNextActions(feedbackItem),
    source_receipt_input_path: feedbackItem.receipt_input_path ?? null,
    actor_receipt_input_path: path.join(outputDir, "actors", requiredActor, "receipt-input.json"),
    editable_receipt: buildEditableCommandReceipt(feedbackItem),
    safe_handling: {
      auto_execute_allowed: false,
      command_receipt_workspace_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
  };
}

function buildEditableCommandReceipt(feedbackItem) {
  const receipt = {
    ...(feedbackItem.receipt ?? {}),
    receipt_id: feedbackItem.receipt_id,
    queue_item_id: feedbackItem.queue_item_id,
    command_gate_id: feedbackItem.command_gate_id,
    runbook_step_id: feedbackItem.runbook_step_id,
    step_key: feedbackItem.step_key,
    command_kind: feedbackItem.command_kind,
    command: feedbackItem.command,
    receipt_status: feedbackItem.receipt_status === "missing" ? "pending" : feedbackItem.receipt_status ?? "pending",
    command_result: feedbackItem.command_result === "missing" ? "not_run" : feedbackItem.command_result ?? "not_run",
    required_receipt_fields: feedbackItem.required_receipt_fields ?? [],
  };
  for (const field of feedbackItem.required_receipt_fields ?? []) {
    if (receipt[field] !== undefined && receipt[field] !== null) continue;
    receipt[field] = field === "commands_run" ? [feedbackItem.command].filter(Boolean) : "";
  }
  if (!Array.isArray(receipt.commands_run)) receipt.commands_run = [feedbackItem.command].filter(Boolean);
  if (receipt.commands_run.length === 0 && feedbackItem.command) receipt.commands_run.push(feedbackItem.command);
  return receipt;
}

function buildWorkspaceNextActions(feedbackItem) {
  if (feedbackItem.feedback_status === "ready_for_confirmation") {
    return ["review_validated_command_receipt", "confirm_before_any_follow_on_application"];
  }
  if (feedbackItem.feedback_status === "needs_correction") {
    return ["fix_command_receipt_input", "rerun_command_receipt_validation", "rerun_command_receipt_feedback", "rerun_command_receipt_workspace"];
  }
  return [
    "run_command_manually_if_still_needed",
    "fill_actor_command_receipt_input",
    "merge_actor_command_receipt_inputs_when_available",
    "rerun_command_receipt_validation",
  ];
}

function deriveItemWorkspaceStatus(feedbackStatus) {
  if (feedbackStatus === "needs_command_receipt") return "needs_command_receipt";
  if (feedbackStatus === "needs_correction") return "needs_correction";
  if (feedbackStatus === "ready_for_confirmation") return "ready_for_confirmation";
  return "attention";
}

function buildActorWorkspaces(workspaceItems, outputDir) {
  return Object.entries(groupBy(workspaceItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => ({
      actor_workspace_id: `human-review-cycle-receipt-completion-command-receipt-workspace.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      workspace_status: deriveActorWorkspaceStatus(items),
      priority: highestPriority(items),
      workspace_item_count: items.length,
      receipt_row_count: items.length,
      pending_receipt_count: items.filter((item) => item.workspace_status === "needs_command_receipt").length,
      needs_correction_count: items.filter((item) => item.workspace_status === "needs_correction").length,
      ready_for_confirmation_count: items.filter((item) => item.workspace_status === "ready_for_confirmation").length,
      workspace_item_ids: items.map((item) => item.workspace_item_id),
      receipt_input_path: path.join(outputDir, "actors", requiredActor, "receipt-input.json"),
      workspace_json_path: path.join(outputDir, "actors", requiredActor, "command-receipt-workspace.json"),
      workspace_markdown_path: path.join(outputDir, "actors", requiredActor, "workspace.md"),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        command_receipt_workspace_only: true,
        protected_actions_executed: false,
        receipt_edits_must_be_manual: true,
      },
    }))
    .sort(compareActorWorkspaces);
}

function validateWorkspace({ feedbackResult, commandReceiptsResult, workspaceItems, actorWorkspaces }) {
  const errors = [];
  if (!feedbackResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_receipt_feedback", message: `Command receipt feedback unavailable: ${feedbackResult.error}` });
  }
  if (!commandReceiptsResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_receipts", message: `Command receipts unavailable: ${commandReceiptsResult.error}` });
  }
  if (feedbackResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_feedback.safe_handling.auto_execute_allowed", message: "Command receipt workspace requires auto execution to remain disabled." });
  }
  for (const item of workspaceItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `workspace_items.${item.workspace_item_id}.safe_handling`, message: "Command receipt workspace must not execute commands or protected actions." });
    }
    if (!item.editable_receipt?.queue_item_id) {
      errors.push({ path: `workspace_items.${item.workspace_item_id}.editable_receipt.queue_item_id`, message: "Editable command receipt is missing queue_item_id." });
    }
    for (const field of item.required_receipt_fields) {
      if (!(field in item.editable_receipt)) {
        errors.push({ path: `workspace_items.${item.workspace_item_id}.editable_receipt.${field}`, message: "Editable command receipt is missing a required field placeholder." });
      }
    }
  }
  for (const actor of actorWorkspaces) {
    if (actor.safe_handling.auto_execute_allowed || actor.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_workspaces.${actor.actor_workspace_id}.safe_handling`, message: "Actor command receipt workspace must remain draft-only and non-executing." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeWorkspace(actorWorkspaces, workspaceItems, validation) {
  return {
    actor_workspace_count: actorWorkspaces.length,
    workspace_item_count: workspaceItems.length,
    receipt_row_count: workspaceItems.length,
    pending_receipt_count: workspaceItems.filter((item) => item.workspace_status === "needs_command_receipt").length,
    needs_correction_count: workspaceItems.filter((item) => item.workspace_status === "needs_correction").length,
    ready_for_confirmation_count: workspaceItems.filter((item) => item.workspace_status === "ready_for_confirmation").length,
    validation_error_count: validation.errors.length,
    editable_file_count: actorWorkspaces.length * 3,
    by_required_actor: countBy(workspaceItems, "required_actor"),
    by_workspace_status: countBy(workspaceItems, "workspace_status"),
    by_feedback_status: countBy(workspaceItems, "feedback_status"),
    by_command_kind: countBy(workspaceItems, "command_kind"),
  };
}

function deriveWorkspaceStatus(validation, workspaceItems) {
  if (!validation.valid) return "blocked";
  if (workspaceItems.some((item) => item.workspace_status === "needs_correction")) return "attention";
  if (workspaceItems.some((item) => item.workspace_status === "needs_command_receipt")) return "pending_human_review";
  if (workspaceItems.some((item) => item.workspace_status === "ready_for_confirmation")) return "ready_for_confirmation";
  return "clear";
}

function deriveActorWorkspaceStatus(items) {
  if (items.some((item) => item.workspace_status === "needs_correction")) return "attention";
  if (items.some((item) => item.workspace_status === "needs_command_receipt")) return "pending_human_review";
  if (items.some((item) => item.workspace_status === "ready_for_confirmation")) return "ready_for_confirmation";
  return "clear";
}

function inferCommandQueueId(workspace) {
  return workspace.sources.find((source) => source.source_id === "human_review_cycle_receipt_completion_command_receipts")?.summary?.source_command_queue_id
    ?? "human-review-cycle-receipt-completion-command-queue.unknown";
}

function renderWorkspaceMarkdown(workspace) {
  const lines = [
    "# Human Review Cycle Receipt Completion Command Receipt Workspace",
    "",
    `- Workspace status: ${workspace.workspace_status}`,
    `- Actor workspaces: ${workspace.summary.actor_workspace_count}`,
    `- Workspace items: ${workspace.summary.workspace_item_count}`,
    `- Pending command receipts: ${workspace.summary.pending_receipt_count}`,
    `- Needs correction: ${workspace.summary.needs_correction_count}`,
    `- Ready for confirmation: ${workspace.summary.ready_for_confirmation_count}`,
    `- Validation errors: ${workspace.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This workspace only prepares actor-specific editable command receipt inputs.",
    "- It does not run commands, merge receipt inputs, apply receipts, or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of workspace.actor_workspaces) {
    lines.push(`- ${actor.required_actor}: ${actor.workspace_item_count} item(s), ${actor.receipt_input_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorWorkspaceMarkdown(actor, items) {
  const lines = [
    `# Command Receipt Workspace: ${actor.required_actor}`,
    "",
    `- Workspace status: ${actor.workspace_status}`,
    `- Workspace items: ${actor.workspace_item_count}`,
    `- Pending command receipts: ${actor.pending_receipt_count}`,
    `- Needs correction: ${actor.needs_correction_count}`,
    `- Ready for confirmation: ${actor.ready_for_confirmation_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.step_key}`);
    lines.push("");
    lines.push(`- Workspace status: ${item.workspace_status}`);
    lines.push(`- Feedback status: ${item.feedback_status}`);
    lines.push(`- Validation status: ${item.validation_status}`);
    lines.push(`- Command result: ${item.command_result}`);
    lines.push(`- Command: \`${item.command}\``);
    lines.push(`- Required fields: ${item.required_receipt_fields.join(", ")}`);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
    if (item.errors.length > 0) {
      lines.push(`- Errors: ${item.errors.map((error) => `${error.field}: ${error.message}`).join(" | ")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function serializableWorkspace(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    workspace_id: result.workspace_id,
    output_dir: result.output_dir,
    workspace_status: result.workspace_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_workspaces: result.actor_workspaces,
    workspace_items: result.workspace_items,
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

function compareWorkspaceItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || String(a.required_actor).localeCompare(String(b.required_actor))
    || String(a.step_key).localeCompare(String(b.step_key));
}

function compareActorWorkspaces(a, b) {
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
    else if (arg === "--feedback") args.commandReceiptFeedbackPath = argv[++index];
    else if (arg === "--command-receipts") args.commandReceiptsPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipt-workspace.mjs [options]

Options:
  --feedback <path>         Command receipt feedback artifact
  --command-receipts <path> Command receipts artifact
  --out-dir <dir>           Output directory
  --run-at <iso>            Override generated_at
  --check                   Exit non-zero when validation fails
`);
}
