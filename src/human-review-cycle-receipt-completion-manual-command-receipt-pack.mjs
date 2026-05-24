import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_INPUTS = {
  baselinePath: "artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json",
  commandReceiptWorkspacePath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace/latest/human-review-cycle-receipt-completion-command-receipt-workspace.json",
};

export async function runHumanReviewCycleReceiptCompletionManualCommandReceiptPack(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionManualCommandReceiptPack(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionManualCommandReceiptPack(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion manual command receipt pack failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionManualCommandReceiptPack(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const baselinePath = path.resolve(options.baselinePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_INPUTS.baselinePath);
  const commandReceiptWorkspacePath = path.resolve(options.commandReceiptWorkspacePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_INPUTS.commandReceiptWorkspacePath);
  const baselineResult = await readJsonOrError(baselinePath);
  const workspaceResult = await readJsonOrError(commandReceiptWorkspacePath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", baselinePath, baselineResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_workspace", "Human Review Cycle Receipt Completion Command Receipt Workspace", commandReceiptWorkspacePath, workspaceResult),
  ];
  const pendingReceiptBlockers = (baselineResult.value?.blocker_inventory ?? []).filter((blocker) => blocker.blocker_type === "pending_command_receipt");
  const nonReceiptBlockers = (baselineResult.value?.blocker_inventory ?? []).filter((blocker) => blocker.blocker_type !== "pending_command_receipt");
  const packItems = buildPackItems({ pendingReceiptBlockers, workspace: workspaceResult.value, outputDir });
  const actorReceiptPacks = buildActorReceiptPacks({ packItems, workspace: workspaceResult.value, outputDir });
  const validation = validateManualCommandReceiptPack({ sources, baseline: baselineResult.value, workspace: workspaceResult.value, pendingReceiptBlockers, packItems, actorReceiptPacks });
  const packStatus = derivePackStatus(validation, packItems);
  const pack = {
    schema_version: "human-review-cycle-receipt-completion-manual-command-receipt-pack.v1",
    generated_at: generatedAt,
    pack_id: `human-review-cycle-receipt-completion-manual-command-receipt-pack.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    pack_status: packStatus,
    safe_handling: {
      auto_execute_allowed: false,
      pack_only: true,
      command_receipt_edits_must_be_manual: true,
      source_artifact_mutation_allowed: false,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizePack({ baseline: baselineResult.value, pendingReceiptBlockers, nonReceiptBlockers, packItems, actorReceiptPacks, validation, packStatus }),
    actor_receipt_packs: actorReceiptPacks,
    pack_items: packItems,
    non_receipt_blockers: nonReceiptBlockers,
    validation,
  };

  return {
    ...pack,
    markdown: renderPackMarkdown(pack),
  };
}

export async function writeHumanReviewCycleReceiptCompletionManualCommandReceiptPack(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack.json"), serializablePack(result));
  await writeJson(path.join(outDir, "actor-receipt-packs.json"), {
    generated_at: result.generated_at,
    count: result.actor_receipt_packs.length,
    actor_receipt_packs: result.actor_receipt_packs,
  });
  await writeJson(path.join(outDir, "pack-items.json"), {
    generated_at: result.generated_at,
    count: result.pack_items.length,
    pack_items: result.pack_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorPack of result.actor_receipt_packs) {
    const actorDir = path.join(outDir, "actors", actorPack.required_actor);
    const items = result.pack_items.filter((item) => item.required_actor === actorPack.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "manual-command-receipt-pack.json"), {
      generated_at: result.generated_at,
      required_actor: actorPack.required_actor,
      pack_status: actorPack.pack_status,
      target_receipt_input_path: actorPack.target_receipt_input_path,
      receipt_row_count: actorPack.receipt_row_count,
      required_receipt_fields: actorPack.required_receipt_fields,
      pack_items: items,
    });
    await writeJson(path.join(actorDir, "receipt-input-template.json"), {
      schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
      generated_at: result.generated_at,
      command_queue_id: actorPack.command_queue_id,
      instructions: actorPack.instructions,
      receipts: items.map((item) => item.editable_receipt),
    });
    await writeFile(path.join(actorDir, "README.md"), renderActorPackMarkdown(actorPack, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionManualCommandReceiptPackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionManualCommandReceiptPack(args);
    console.log(`Human review cycle receipt completion manual command receipt pack written to ${result.output_dir}`);
    console.log(`Pack status: ${result.pack_status}`);
    console.log(`Actor packs: ${result.summary.actor_receipt_pack_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_pack_item_count}`);
    console.log(`Target receipt paths: ${result.summary.target_receipt_path_count}`);
    console.log(`Missing required fields: ${result.summary.missing_required_field_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPackItems({ pendingReceiptBlockers, workspace, outputDir }) {
  const workspaceItemsByQueueId = new Map((workspace?.workspace_items ?? []).map((item) => [item.queue_item_id, item]));
  return pendingReceiptBlockers.map((blocker, index) => {
    const workspaceItem = workspaceItemsByQueueId.get(blocker.queue_item_id);
    const requiredActor = blocker.required_actor ?? workspaceItem?.required_actor ?? "human_reviewer";
    const targetReceiptInputPath = workspaceItem?.actor_receipt_input_path ?? path.join(outputDir, "actors", requiredActor, "receipt-input-template.json");
    const editableReceipt = workspaceItem?.editable_receipt ?? buildFallbackEditableReceipt(blocker);
    const requiredReceiptFields = workspaceItem?.required_receipt_fields ?? editableReceipt.required_receipt_fields ?? [];
    const missingRequiredFields = requiredReceiptFields.filter((field) => !(field in editableReceipt));
    return {
      pack_item_id: `human-review-cycle-receipt-completion-manual-command-receipt-pack.item.${String(index + 1).padStart(2, "0")}.${slugify(blocker.queue_item_id)}`,
      blocker_id: blocker.blocker_id,
      source_reconciliation_item_id: blocker.source_reconciliation_item_id,
      source_workspace_item_id: workspaceItem?.workspace_item_id ?? null,
      required_actor: requiredActor,
      priority: blocker.priority ?? workspaceItem?.priority ?? "medium",
      queue_item_id: blocker.queue_item_id,
      command_gate_id: blocker.command_gate_id,
      runbook_step_id: blocker.runbook_step_id,
      step_key: blocker.step_key,
      command_kind: blocker.command_kind,
      command: blocker.command,
      target_receipt_input_path: targetReceiptInputPath,
      target_template_path: path.join(outputDir, "actors", requiredActor, "receipt-input-template.json"),
      required_receipt_fields: requiredReceiptFields,
      missing_required_fields: missingRequiredFields,
      editable_receipt: editableReceipt,
      instructions: [
        "Run the command manually only if it is still needed.",
        "Fill every required receipt field in the actor receipt input file.",
        "Rerun workspace merge, validation, and application after saving receipts.",
        "Do not execute protected actions from this pack.",
      ],
      safe_handling: {
        auto_execute_allowed: false,
        manual_receipt_input_pack_only: true,
        protected_actions_executed: false,
      },
    };
  });
}

function buildActorReceiptPacks({ packItems, workspace, outputDir }) {
  return Object.entries(groupBy(packItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const workspaceActor = (workspace?.actor_workspaces ?? []).find((actor) => actor.required_actor === requiredActor);
      const targetReceiptInputPath = workspaceActor?.receipt_input_path ?? path.join(outputDir, "actors", requiredActor, "receipt-input-template.json");
      const targetTemplatePath = path.join(outputDir, "actors", requiredActor, "receipt-input-template.json");
      const requiredFields = unique(items.flatMap((item) => item.required_receipt_fields));
      return {
        actor_receipt_pack_id: `human-review-cycle-receipt-completion-manual-command-receipt-pack.actor.${slugify(requiredActor)}`,
        required_actor: requiredActor,
        pack_status: items.some((item) => item.missing_required_fields.length > 0 || !item.target_receipt_input_path) ? "needs_fix" : "ready_for_manual_receipts",
        priority: highestPriority(items),
        command_queue_id: inferCommandQueueId(workspace),
        receipt_row_count: items.length,
        target_receipt_input_path: targetReceiptInputPath,
        target_template_path: targetTemplatePath,
        actor_pack_path: path.join(outputDir, "actors", requiredActor, "manual-command-receipt-pack.json"),
        readme_path: path.join(outputDir, "actors", requiredActor, "README.md"),
        required_receipt_fields: requiredFields,
        required_field_count: requiredFields.length,
        missing_required_field_count: items.reduce((count, item) => count + item.missing_required_fields.length, 0),
        pack_item_ids: items.map((item) => item.pack_item_id),
        queue_item_ids: items.map((item) => item.queue_item_id),
        commands_to_run: items.map((item) => item.command).filter(Boolean),
        instructions: `Manual command receipt pack for ${requiredActor}. Edit the target receipt input path, complete every required field, and rerun merge/validation/application. This pack does not execute commands or protected actions.`,
        safe_handling: {
          auto_execute_allowed: false,
          manual_receipt_input_pack_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorPacks);
}

function buildFallbackEditableReceipt(blocker) {
  const requiredReceiptFields = ["receipt_status", "command_result", "executed_by", "executed_at", "output_reference", "notes", "commands_run"];
  return {
    receipt_id: `human-review-cycle-receipt-completion-command-receipt.${slugify(blocker.queue_item_id)}`,
    queue_item_id: blocker.queue_item_id,
    command_gate_id: blocker.command_gate_id,
    runbook_step_id: blocker.runbook_step_id,
    step_key: blocker.step_key,
    command_kind: blocker.command_kind,
    command: blocker.command,
    receipt_status: blocker.receipt_status ?? "pending",
    command_result: blocker.command_result ?? "not_run",
    executed_by: "",
    executed_at: "",
    output_reference: "",
    notes: "",
    commands_run: [blocker.command].filter(Boolean),
    required_receipt_fields: requiredReceiptFields,
  };
}

function validateManualCommandReceiptPack({ sources, baseline, workspace, pendingReceiptBlockers, packItems, actorReceiptPacks }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  if (baseline?.validation && !baseline.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_baseline.validation", message: "Baseline source is not valid." });
  }
  if (workspace?.validation && !workspace.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_workspace.validation", message: "Command receipt workspace source is not valid." });
  }
  if ((baseline?.summary?.pending_command_receipt_count ?? 0) !== packItems.length) {
    errors.push({ path: "pack_items", message: "Pack item count must match baseline pending command receipt count." });
  }
  if (pendingReceiptBlockers.length !== packItems.length) {
    errors.push({ path: "blocker_inventory.pending_command_receipt", message: "Every pending command receipt blocker must have one pack item." });
  }
  for (const item of packItems) {
    if (!item.target_receipt_input_path) {
      errors.push({ path: `pack_items.${item.pack_item_id}.target_receipt_input_path`, message: "Pack item is missing target receipt input path." });
    }
    if (item.required_receipt_fields.length === 0) {
      errors.push({ path: `pack_items.${item.pack_item_id}.required_receipt_fields`, message: "Pack item must list required receipt fields." });
    }
    for (const field of item.missing_required_fields) {
      errors.push({ path: `pack_items.${item.pack_item_id}.editable_receipt.${field}`, message: "Editable receipt is missing a required field placeholder." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `pack_items.${item.pack_item_id}.safe_handling`, message: "Manual command receipt pack must not execute commands or protected actions." });
    }
  }
  for (const actorPack of actorReceiptPacks) {
    if (!actorPack.target_receipt_input_path) {
      errors.push({ path: `actor_receipt_packs.${actorPack.actor_receipt_pack_id}.target_receipt_input_path`, message: "Actor receipt pack is missing target receipt input path." });
    }
    if (actorPack.required_receipt_fields.length === 0) {
      errors.push({ path: `actor_receipt_packs.${actorPack.actor_receipt_pack_id}.required_receipt_fields`, message: "Actor receipt pack must list required receipt fields." });
    }
    if (actorPack.missing_required_field_count > 0) {
      errors.push({ path: `actor_receipt_packs.${actorPack.actor_receipt_pack_id}.missing_required_field_count`, message: "Actor receipt pack has missing required field placeholders." });
    }
    if (actorPack.safe_handling.auto_execute_allowed || actorPack.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_receipt_packs.${actorPack.actor_receipt_pack_id}.safe_handling`, message: "Actor receipt pack must remain manual and non-executing." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function derivePackStatus(validation, packItems) {
  if (!validation.valid) return "blocked";
  if (packItems.length > 0) return "ready_for_manual_receipts";
  return "no_manual_receipts_required";
}

function summarizePack({ baseline, pendingReceiptBlockers, nonReceiptBlockers, packItems, actorReceiptPacks, validation, packStatus }) {
  return {
    pack_status: packStatus,
    source_baseline_status: baseline?.baseline_status ?? null,
    actor_receipt_pack_count: actorReceiptPacks.length,
    receipt_pack_item_count: packItems.length,
    pending_command_receipt_blocker_count: pendingReceiptBlockers.length,
    non_receipt_blocker_count: nonReceiptBlockers.length,
    target_receipt_path_count: actorReceiptPacks.filter((actor) => Boolean(actor.target_receipt_input_path)).length,
    missing_target_receipt_path_count: actorReceiptPacks.filter((actor) => !actor.target_receipt_input_path).length + packItems.filter((item) => !item.target_receipt_input_path).length,
    required_field_count: unique(packItems.flatMap((item) => item.required_receipt_fields)).length,
    missing_required_field_count: packItems.reduce((count, item) => count + item.missing_required_fields.length, 0),
    command_count: packItems.filter((item) => Boolean(item.command)).length,
    validation_error_count: validation.errors.length,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_required_actor: countBy(packItems, "required_actor"),
    by_command_kind: countBy(packItems, "command_kind"),
  };
}

function renderPackMarkdown(pack) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Manual Command Receipt Pack");
  lines.push("");
  lines.push(`Generated: ${pack.generated_at}`);
  lines.push(`Pack status: ${pack.pack_status}`);
  lines.push("");
  lines.push(`- Actor receipt packs: ${pack.summary.actor_receipt_pack_count}`);
  lines.push(`- Receipt rows: ${pack.summary.receipt_pack_item_count}`);
  lines.push(`- Target receipt paths: ${pack.summary.target_receipt_path_count}`);
  lines.push(`- Missing target paths: ${pack.summary.missing_target_receipt_path_count}`);
  lines.push(`- Required fields: ${pack.summary.required_field_count}`);
  lines.push(`- Missing required fields: ${pack.summary.missing_required_field_count}`);
  lines.push(`- Non-receipt blockers kept for later phases: ${pack.summary.non_receipt_blocker_count}`);
  lines.push("");
  lines.push("## Actor Packs");
  lines.push("");
  for (const actor of pack.actor_receipt_packs) {
    lines.push(`- ${actor.required_actor}: ${actor.receipt_row_count} receipt row(s) -> ${actor.target_receipt_input_path}`);
  }
  if (pack.actor_receipt_packs.length === 0) lines.push("- No manual command receipt packs.");
  lines.push("");
  lines.push("## Pack Items");
  lines.push("");
  for (const item of pack.pack_items) {
    lines.push(`- ${item.step_key}: ${item.command} (${item.required_actor})`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorPackMarkdown(actorPack, items) {
  const lines = [];
  lines.push(`# Manual Command Receipt Pack: ${actorPack.required_actor}`);
  lines.push("");
  lines.push(`Target receipt input: ${actorPack.target_receipt_input_path}`);
  lines.push(`Receipt input template: ${actorPack.target_template_path}`);
  lines.push("");
  lines.push("Required fields:");
  for (const field of actorPack.required_receipt_fields) lines.push(`- ${field}`);
  lines.push("");
  lines.push("Commands:");
  for (const item of items) lines.push(`- ${item.step_key}: ${item.command}`);
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

function serializablePack(result) {
  const { markdown, ...artifact } = result;
  return artifact;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function inferCommandQueueId(workspace) {
  const firstQueueItem = workspace?.workspace_items?.find((item) => item.queue_item_id)?.queue_item_id;
  return firstQueueItem?.split(".item.")[0] ?? "human-review-cycle-receipt-completion-command-queue";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function unique(items) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== ""))];
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function highestPriority(items) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...items].sort((left, right) => (order[left.priority] ?? 99) - (order[right.priority] ?? 99))[0]?.priority ?? "medium";
}

function compareActorPacks(left, right) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[left.priority] ?? 99) - (order[right.priority] ?? 99) || left.required_actor.localeCompare(right.required_actor);
}

function parseArgs(argv) {
  const parsed = {
    baselinePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_INPUTS.baselinePath,
    commandReceiptWorkspacePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_INPUTS.commandReceiptWorkspacePath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_COMMAND_RECEIPT_PACK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--baseline") parsed.baselinePath = argv[++index];
    else if (arg === "--workspace") parsed.commandReceiptWorkspacePath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-manual-command-receipt-pack.mjs [options]

Options:
  --baseline <path>    receipt completion baseline artifact path.
  --workspace <path>   command receipt workspace artifact path.
  --out-dir <path>     output directory.
  --run-at <iso>       fixed generated_at timestamp.
  --check              fail when manual command receipt pack validation has errors.
  --help               show this help.
`);
}
