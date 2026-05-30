import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_MERGE_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_MERGE_WORKSPACE_PATH = "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json";

const TERMINAL_RECEIPT_STATUSES = new Set(["resolved", "failed", "skipped", "deferred"]);
const TERMINAL_COMMAND_RESULTS = new Set(["run_success", "run_failed", "skipped", "deferred"]);
const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command receipt workspace merge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_MERGE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const workspacePath = path.resolve(options.workspacePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_WORKSPACE_MERGE_WORKSPACE_PATH);
  const workspaceResult = await readJsonOrError(workspacePath);
  const actorInputs = await readActorInputs(workspaceResult.value?.actor_workspaces ?? []);
  const mergeItems = buildMergeItems(workspaceResult.value, actorInputs);
  const validation = validateMerge({ workspaceResult, actorInputs, mergeItems });
  const receiptInput = buildMergedReceiptInput(generatedAt, workspaceResult.value, mergeItems, actorInputs);
  const merge = {
    schema_version: "human-review-cycle-receipt-completion-command-receipt-workspace-merge.v1",
    generated_at: generatedAt,
    merge_id: `human-review-cycle-receipt-completion-command-receipt-workspace-merge.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    merge_status: deriveMergeStatus(validation, mergeItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      command_receipt_workspace_merge_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
      validation_required_before_application: true,
    },
    sources: [
      buildSource("human_review_cycle_receipt_completion_command_receipt_workspace", "Human Review Cycle Receipt Completion Command Receipt Workspace", workspacePath, workspaceResult),
    ],
    summary: summarizeMerge(actorInputs, mergeItems, workspaceResult.value, validation),
    actor_inputs: actorInputs,
    merge_items: mergeItems,
    receipt_input: receiptInput,
    validation,
  };

  return {
    ...merge,
    markdown: renderMergeMarkdown(merge),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    merge_id: result.merge_id,
    output_dir: result.output_dir,
    merge_status: result.merge_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_inputs: result.actor_inputs,
    merge_items: result.merge_items,
    receipt_input: result.receipt_input,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "receipt-input.json"), result.receipt_input);
  await writeJson(path.join(outDir, "merge-items.json"), {
    generated_at: result.generated_at,
    count: result.merge_items.length,
    merge_items: result.merge_items,
  });
  await writeJson(path.join(outDir, "actor-inputs.json"), {
    generated_at: result.generated_at,
    count: result.actor_inputs.length,
    actor_inputs: result.actor_inputs,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge(args);
    console.log(`Human review cycle receipt completion command receipt workspace merge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Merge status: ${result.merge_status}`);
    console.log(`Actor inputs: ${result.summary.actor_input_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_row_count}`);
    console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
    console.log(`Ready for validation: ${result.summary.ready_for_validation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readActorInputs(actorWorkspaces) {
  return Promise.all((actorWorkspaces ?? []).map(async (workspace) => {
    const inputPath = path.resolve(workspace.receipt_input_path);
    const result = await readJsonOrError(inputPath);
    const receipts = result.value?.receipts ?? [];
    return {
      actor_input_id: `human-review-cycle-receipt-completion-command-receipt-workspace-merge.actor.${slugify(workspace.required_actor)}`,
      actor_workspace_id: workspace.actor_workspace_id,
      required_actor: workspace.required_actor,
      workspace_status: workspace.workspace_status,
      input_path: inputPath,
      workspace_json_path: workspace.workspace_json_path ?? null,
      available: result.ok,
      expected_receipt_count: workspace.receipt_row_count ?? 0,
      receipt_count: receipts.length,
      pending_receipt_count: receipts.filter((receipt) => isPendingCommandReceipt(receipt)).length,
      ready_for_validation_count: receipts.filter((receipt) => isReadyCommandReceipt(receipt)).length,
      receipt_ids: receipts.map((receipt) => receipt.receipt_id).filter(Boolean),
      queue_item_ids: receipts.map((receipt) => receipt.queue_item_id).filter(Boolean),
      errors: buildActorInputErrors(workspace, result),
      receipt_input: result.value ?? null,
    };
  }));
}

function buildActorInputErrors(workspace, result) {
  if (!result.ok) {
    return [{ path: `actor_inputs.${workspace.required_actor}`, message: `Actor command receipt input unavailable: ${result.error}` }];
  }
  if (result.value?.schema_version !== "human-review-cycle-receipt-completion-command-receipts-input.v1") {
    return [{ path: `actor_inputs.${workspace.required_actor}.schema_version`, message: "Actor command receipt input has an unexpected schema_version." }];
  }
  return [];
}

function buildMergeItems(workspace, actorInputs) {
  const expectedItems = workspace?.workspace_items ?? [];
  const expectedByQueueItemId = new Map(expectedItems.map((item) => [item.queue_item_id, item]));
  const actorByQueueItemId = new Map();
  for (const actorInput of actorInputs) {
    for (const queueItemId of actorInput.queue_item_ids) {
      if (!actorByQueueItemId.has(queueItemId)) actorByQueueItemId.set(queueItemId, []);
      actorByQueueItemId.get(queueItemId).push(actorInput.required_actor);
    }
  }

  const items = [];
  for (const actorInput of actorInputs) {
    for (const receipt of actorInput.receipt_input?.receipts ?? []) {
      const expected = expectedByQueueItemId.get(receipt.queue_item_id);
      items.push(buildMergeItem({ actorInput, receipt, expected, duplicateActors: actorByQueueItemId.get(receipt.queue_item_id) ?? [] }));
    }
  }

  const seenQueueItemIds = new Set(items.map((item) => item.queue_item_id).filter(Boolean));
  for (const expected of expectedItems) {
    if (seenQueueItemIds.has(expected.queue_item_id)) continue;
    items.push(buildMissingMergeItem(expected));
  }

  return items.sort(compareMergeItems);
}

function buildMergeItem({ actorInput, receipt, expected, duplicateActors }) {
  const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
  const commandResult = normalizeCommandResult(receipt.command_result);
  const errors = [];
  if (!expected) {
    errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.queue_item_id`, message: "Actor command receipt input contains a receipt outside the command receipt workspace." });
  } else {
    if (expected.required_actor !== actorInput.required_actor) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.required_actor`, message: `Receipt belongs to ${expected.required_actor}, not ${actorInput.required_actor}.` });
    }
    if (expected.receipt_id !== receipt.receipt_id) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.receipt_id`, message: "Receipt id does not match the command receipt workspace item." });
    }
    if (expected.command_gate_id !== receipt.command_gate_id) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.command_gate_id`, message: "Receipt command gate does not match the command receipt workspace item." });
    }
    if (expected.runbook_step_id !== receipt.runbook_step_id) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.runbook_step_id`, message: "Receipt runbook step does not match the command receipt workspace item." });
    }
    if (expected.command_kind !== receipt.command_kind) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.command_kind`, message: "Receipt command kind does not match the command receipt workspace item." });
    }
    if (expected.command !== receipt.command) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.command`, message: "Receipt command does not match the command receipt workspace item." });
    }
  }
  if (duplicateActors.length > 1) {
    errors.push({ path: `actor_inputs.${receipt.queue_item_id}`, message: `Command receipt appears in multiple actor inputs: ${duplicateActors.join(", ")}.` });
  }
  if (receiptStatus !== "pending" && !TERMINAL_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.receipt_status`, message: "Receipt status must be pending or a terminal command receipt status before validation." });
  }
  if (receiptStatus !== "pending" && !TERMINAL_COMMAND_RESULTS.has(commandResult)) {
    errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.queue_item_id}.command_result`, message: "Command result must be terminal before a non-pending receipt can be validated." });
  }
  return {
    merge_item_id: `human-review-cycle-receipt-completion-command-receipt-workspace-merge.${expected ? slugify(expected.queue_item_id) : `unknown.${slugify(receipt.queue_item_id)}`}`,
    actor_input_id: actorInput.actor_input_id,
    actor_workspace_id: actorInput.actor_workspace_id,
    required_actor: actorInput.required_actor,
    workspace_item_id: expected?.workspace_item_id ?? null,
    feedback_item_id: expected?.feedback_item_id ?? null,
    validation_item_id: expected?.validation_item_id ?? null,
    receipt_requirement_id: expected?.receipt_requirement_id ?? null,
    receipt_id: receipt.receipt_id ?? null,
    queue_item_id: receipt.queue_item_id ?? expected?.queue_item_id ?? null,
    command_gate_id: receipt.command_gate_id ?? expected?.command_gate_id ?? null,
    runbook_step_id: receipt.runbook_step_id ?? expected?.runbook_step_id ?? null,
    step_key: receipt.step_key ?? expected?.step_key ?? "unknown",
    command_kind: receipt.command_kind ?? expected?.command_kind ?? "unknown",
    command: receipt.command ?? expected?.command ?? "unknown",
    priority: expected?.priority ?? "medium",
    receipt_status: receiptStatus,
    command_result: commandResult,
    merge_status: deriveMergeItemStatus(receiptStatus, commandResult, errors, expected),
    ready_for_validation: errors.length === 0 && isReadyCommandReceipt(receipt),
    error_count: errors.length,
    errors,
    receipt,
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      validation_required_before_application: true,
    },
  };
}

function buildMissingMergeItem(expected) {
  const errors = [{ path: `workspace_items.${expected.workspace_item_id}.queue_item_id`, message: "Expected command receipt was not found in any actor command receipt input." }];
  return {
    merge_item_id: `human-review-cycle-receipt-completion-command-receipt-workspace-merge.missing.${slugify(expected.queue_item_id)}`,
    actor_input_id: null,
    actor_workspace_id: null,
    required_actor: expected.required_actor,
    workspace_item_id: expected.workspace_item_id,
    feedback_item_id: expected.feedback_item_id,
    validation_item_id: expected.validation_item_id,
    receipt_requirement_id: expected.receipt_requirement_id,
    receipt_id: expected.receipt_id,
    queue_item_id: expected.queue_item_id,
    command_gate_id: expected.command_gate_id,
    runbook_step_id: expected.runbook_step_id,
    step_key: expected.step_key,
    command_kind: expected.command_kind,
    command: expected.command,
    priority: expected.priority,
    receipt_status: "missing",
    command_result: "missing",
    merge_status: "missing_actor_receipt",
    ready_for_validation: false,
    error_count: errors.length,
    errors,
    receipt: null,
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      validation_required_before_application: true,
    },
  };
}

function deriveMergeItemStatus(receiptStatus, commandResult, errors, expected) {
  if (!expected) return "unknown_receipt";
  if (errors.some((item) => item.message.includes("multiple actor inputs"))) return "duplicate_receipt";
  if (errors.length > 0) return "invalid_actor_receipt";
  if (receiptStatus === "pending" || commandResult === "not_run") return "pending_receipt";
  if (TERMINAL_RECEIPT_STATUSES.has(receiptStatus) && TERMINAL_COMMAND_RESULTS.has(commandResult)) return "ready_for_validation";
  return "invalid_actor_receipt";
}

function validateMerge({ workspaceResult, actorInputs, mergeItems }) {
  const errors = [];
  if (!workspaceResult.ok) {
    errors.push({ path: "sources.human_review_cycle_receipt_completion_command_receipt_workspace", message: `Command receipt workspace unavailable: ${workspaceResult.error}` });
  }
  if (workspaceResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_workspace.safe_handling.auto_execute_allowed", message: "Command receipt workspace merge requires auto execution to remain disabled." });
  }
  for (const actorInput of actorInputs) errors.push(...actorInput.errors);
  for (const item of mergeItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `merge_items.${item.merge_item_id}.safe_handling`, message: "Command receipt workspace merge must not execute commands or protected actions." });
    }
    errors.push(...item.errors);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildMergedReceiptInput(generatedAt, workspace, mergeItems, actorInputs) {
  const receiptsByQueueItemId = new Map(mergeItems.filter((item) => item.receipt).map((item) => [item.queue_item_id, item.receipt]));
  const expectedOrder = workspace?.workspace_items?.map((item) => item.queue_item_id) ?? [];
  const orderedReceipts = expectedOrder.map((queueItemId) => receiptsByQueueItemId.get(queueItemId)).filter(Boolean);
  const unknownReceipts = mergeItems
    .filter((item) => item.merge_status === "unknown_receipt" && item.receipt)
    .map((item) => item.receipt);
  return {
    schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
    generated_at: generatedAt,
    command_queue_id: inferCommandQueueId(workspace, actorInputs),
    instructions: "Merged from actor-specific command receipt workspaces. Validate this file before confirming command receipts. This merge does not run commands, edit target receipt inputs, or execute protected actions.",
    receipts: [...orderedReceipts, ...unknownReceipts],
  };
}

function summarizeMerge(actorInputs, mergeItems, workspace, validation) {
  return {
    actor_input_count: actorInputs.length,
    available_actor_input_count: actorInputs.filter((input) => input.available).length,
    expected_receipt_count: workspace?.summary?.receipt_row_count ?? workspace?.workspace_items?.length ?? 0,
    merge_item_count: mergeItems.length,
    receipt_row_count: mergeItems.filter((item) => item.receipt).length,
    pending_receipt_count: mergeItems.filter((item) => item.merge_status === "pending_receipt").length,
    ready_for_validation_count: mergeItems.filter((item) => item.merge_status === "ready_for_validation").length,
    missing_receipt_count: mergeItems.filter((item) => item.merge_status === "missing_actor_receipt").length,
    duplicate_receipt_count: mergeItems.filter((item) => item.merge_status === "duplicate_receipt").length,
    unknown_receipt_count: mergeItems.filter((item) => item.merge_status === "unknown_receipt").length,
    invalid_actor_receipt_count: mergeItems.filter((item) => item.merge_status === "invalid_actor_receipt").length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(mergeItems, "required_actor"),
    by_merge_status: countBy(mergeItems, "merge_status"),
    by_command_kind: countBy(mergeItems, "command_kind"),
  };
}

function deriveMergeStatus(validation, mergeItems) {
  if (!validation.valid) return "blocked";
  if (mergeItems.some((item) => item.merge_status === "pending_receipt")) return "pending_human_review";
  if (mergeItems.some((item) => item.merge_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function renderMergeMarkdown(merge) {
  const lines = [
    "# Human Review Cycle Receipt Completion Command Receipt Workspace Merge",
    "",
    `- Merge status: ${merge.merge_status}`,
    `- Actor inputs: ${merge.summary.actor_input_count}`,
    `- Receipt rows: ${merge.summary.receipt_row_count}`,
    `- Pending receipts: ${merge.summary.pending_receipt_count}`,
    `- Ready for validation: ${merge.summary.ready_for_validation_count}`,
    `- Validation errors: ${merge.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This merge only combines actor command receipt inputs.",
    "- It does not run commands, apply receipts, or execute protected actions.",
    "- The merged `receipt-input.json` must pass command receipt validation before any confirmation step.",
    "",
    "## Actor Inputs",
    "",
  ];
  for (const actorInput of merge.actor_inputs) {
    lines.push(`- ${actorInput.required_actor}: ${actorInput.receipt_count}/${actorInput.expected_receipt_count} receipt(s), available=${actorInput.available}`);
  }
  return `${lines.join("\n")}\n`;
}

function inferCommandQueueId(workspace, actorInputs) {
  return actorInputs.find((actorInput) => actorInput.receipt_input?.command_queue_id)?.receipt_input?.command_queue_id
    ?? workspace?.sources?.find((source) => source.source_id === "human_review_cycle_receipt_completion_command_receipts")?.summary?.source_command_queue_id
    ?? "human-review-cycle-receipt-completion-command-queue.unknown";
}

function isPendingCommandReceipt(receipt) {
  return normalizeReceiptStatus(receipt?.receipt_status) === "pending" || normalizeCommandResult(receipt?.command_result) === "not_run";
}

function isReadyCommandReceipt(receipt) {
  return TERMINAL_RECEIPT_STATUSES.has(normalizeReceiptStatus(receipt?.receipt_status))
    && TERMINAL_COMMAND_RESULTS.has(normalizeCommandResult(receipt?.command_result));
}

async function readJsonOrError(filePath) {
  if (!filePath) return { ok: false, value: null, error: "disabled" };
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return { ok: true, value, error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
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

function compareMergeItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.command_kind.localeCompare(b.command_kind)
    || String(a.step_key ?? "").localeCompare(String(b.step_key ?? ""))
    || String(a.queue_item_id ?? "").localeCompare(String(b.queue_item_id ?? ""));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeReceiptStatus(status) {
  return String(status ?? "missing").trim() || "missing";
}

function normalizeCommandResult(result) {
  return String(result ?? "missing").trim() || "missing";
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
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--workspace") args.workspacePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipt-workspace-merge.mjs [options]

Options:
  --workspace <path> Command receipt workspace artifact
  --out-dir <dir>    Output directory
  --run-at <iso>     Override generated_at
  --check            Exit non-zero when validation fails
`);
}
