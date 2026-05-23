import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-queue/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_INPUTS = {
  completionReadinessPath: "artifacts/human-review-cycle-receipt-completion-readiness/latest/human-review-cycle-receipt-completion-readiness.json",
};

const COMMAND_KIND_BY_STEP = {
  rerun_completion_verification: "verification_refresh",
  rerun_completion_workbench: "workbench_refresh",
  rerun_completion_runbook: "runbook_refresh",
  rebuild_dashboard: "dashboard_refresh",
  rerun_api_smoke: "api_smoke",
  rerun_correction_merge: "post_input_merge",
  rerun_correction_validation: "post_input_validation",
  rerun_receipt_field_audit: "post_input_field_audit",
  apply_human_gate_receipts_after_explicit_approval: "protected_application",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleReceiptCompletionCommandQueue(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandQueue(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandQueue(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandQueue(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionReadinessPath = path.resolve(options.completionReadinessPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_INPUTS.completionReadinessPath);
  const readinessResult = await readJsonOrError(completionReadinessPath);
  const readiness = readinessResult.value;
  const commandQueueItems = buildCommandQueueItems(readiness?.command_gates ?? []);
  const heldCommandItems = buildHeldCommandItems(readiness?.command_gates ?? []);
  const actorCommandQueues = buildActorCommandQueues(readiness?.actor_readiness ?? [], commandQueueItems, heldCommandItems, outputDir);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_readiness", "Human Review Cycle Receipt Completion Readiness", completionReadinessPath, readinessResult),
  ];
  const validation = validateCommandQueue({ sources, readinessResult, commandQueueItems, heldCommandItems, actorCommandQueues });
  const commandQueue = {
    schema_version: "human-review-cycle-receipt-completion-command-queue.v1",
    generated_at: generatedAt,
    command_queue_id: `human-review-cycle-receipt-completion-command-queue.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    queue_status: deriveQueueStatus(validation, commandQueueItems, heldCommandItems),
    safe_handling: {
      auto_execute_allowed: false,
      command_queue_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeCommandQueue(commandQueueItems, heldCommandItems, actorCommandQueues, sources, readinessResult, validation),
    command_queue_items: commandQueueItems,
    held_command_items: heldCommandItems,
    actor_command_queues: actorCommandQueues,
    validation,
  };

  return {
    ...commandQueue,
    markdown: renderCommandQueueMarkdown(commandQueue),
    html: renderCommandQueueHtml(commandQueue),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-queue.json"), serializableCommandQueue(result));
  await writeJson(path.join(outDir, "command-queue-items.json"), {
    generated_at: result.generated_at,
    count: result.command_queue_items.length,
    command_queue_items: result.command_queue_items,
  });
  await writeJson(path.join(outDir, "held-command-items.json"), {
    generated_at: result.generated_at,
    count: result.held_command_items.length,
    held_command_items: result.held_command_items,
  });
  await writeJson(path.join(outDir, "actor-command-queues.json"), {
    generated_at: result.generated_at,
    count: result.actor_command_queues.length,
    actor_command_queues: result.actor_command_queues,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandQueue(args);
    console.log(`Human review cycle receipt completion command queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Queue status: ${result.queue_status}`);
    console.log(`Ready command items: ${result.summary.command_queue_item_count}`);
    console.log(`Held command items: ${result.summary.held_command_item_count}`);
    console.log(`Actor command queues: ${result.summary.actor_command_queue_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCommandQueueItems(commandGates) {
  return commandGates
    .filter((gate) => gate.command_allowed_now)
    .map((gate, index) => ({
      queue_item_id: `human-review-cycle-receipt-completion-command-queue.item.${String(index + 1).padStart(2, "0")}.${slugify(gate.step_key)}`,
      command_gate_id: gate.command_gate_id,
      runbook_step_id: gate.runbook_step_id,
      step_key: gate.step_key,
      step_rank: gate.step_rank,
      queue_rank: index + 1,
      command_kind: deriveCommandKind(gate.step_key),
      command: gate.command,
      command_status: gate.command_status,
      queue_status: "ready_to_run_manually",
      requires_explicit_human_approval: false,
      source_refs: gate.source_refs ?? {},
      safe_handling: buildStepSafeHandling(),
    }));
}

function buildHeldCommandItems(commandGates) {
  return commandGates
    .filter((gate) => !gate.command_allowed_now)
    .map((gate, index) => ({
      held_command_id: `human-review-cycle-receipt-completion-command-queue.held.${String(index + 1).padStart(2, "0")}.${slugify(gate.step_key)}`,
      command_gate_id: gate.command_gate_id,
      runbook_step_id: gate.runbook_step_id,
      step_key: gate.step_key,
      step_rank: gate.step_rank,
      hold_rank: index + 1,
      command_kind: deriveCommandKind(gate.step_key),
      command: gate.command,
      command_status: gate.command_status,
      hold_status: gate.requires_explicit_human_approval ? "requires_explicit_human_approval" : "held_until_manual_input",
      hold_reason: gate.blocked_reason ?? "Command is not available now.",
      requires_explicit_human_approval: Boolean(gate.requires_explicit_human_approval),
      source_refs: gate.source_refs ?? {},
      safe_handling: buildStepSafeHandling(),
    }));
}

function buildActorCommandQueues(actorReadiness, commandQueueItems, heldCommandItems, outputDir) {
  return (actorReadiness ?? []).map((actor) => ({
    actor_command_queue_id: `human-review-cycle-receipt-completion-command-queue.actor.${slugify(actor.required_actor)}`,
    actor_readiness_id: actor.actor_readiness_id,
    required_actor: actor.required_actor,
    readiness_status: actor.readiness_status,
    priority: actor.priority,
    command_queue_item_count: commandQueueItems.length,
    held_command_item_count: heldCommandItems.length,
    next_commands: commandQueueItems.map((item) => item.command),
    held_commands: heldCommandItems.map((item) => ({
      step_key: item.step_key,
      command: item.command,
      hold_status: item.hold_status,
      hold_reason: item.hold_reason,
    })),
    actor_runbook_html_path: actor.actor_runbook_html_path,
    workbench_html_path: actor.workbench_html_path,
    command_queue_json_path: path.join(outputDir, "command-queue-items.json"),
    held_commands_json_path: path.join(outputDir, "held-command-items.json"),
    safe_handling: {
      auto_execute_allowed: false,
      command_queue_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
  })).sort(compareActorQueues);
}

function validateCommandQueue({ sources, readinessResult, commandQueueItems, heldCommandItems, actorCommandQueues }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const commandGateCount = readinessResult.value?.summary?.command_gate_count ?? 0;
  if (commandGateCount > 0 && commandQueueItems.length + heldCommandItems.length !== commandGateCount) {
    errors.push({ path: "command_queue_items", message: "Command queue and held command items must cover every command gate." });
  }
  const actorReadinessCount = readinessResult.value?.summary?.actor_readiness_count ?? 0;
  if (actorReadinessCount > 0 && actorCommandQueues.length !== actorReadinessCount) {
    errors.push({ path: "actor_command_queues", message: "Actor command queue count must match actor readiness count." });
  }
  for (const item of commandQueueItems) {
    if (item.requires_explicit_human_approval) {
      errors.push({ path: `command_queue_items.${item.queue_item_id}.requires_explicit_human_approval`, message: "Protected commands must not enter the ready command queue." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `command_queue_items.${item.queue_item_id}.safe_handling`, message: "Command queue must not execute commands or protected actions." });
    }
  }
  for (const item of heldCommandItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `held_command_items.${item.held_command_id}.safe_handling`, message: "Held command queue must not execute commands or protected actions." });
    }
  }
  if ((readinessResult.value?.summary?.pending_human_input_count ?? 0) > 0 && heldCommandItems.length === 0) {
    errors.push({ path: "held_command_items", message: "Pending human input requires at least one held command." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCommandQueue(commandQueueItems, heldCommandItems, actorCommandQueues, sources, readinessResult, validation) {
  return {
    queue_status: deriveQueueStatus(validation, commandQueueItems, heldCommandItems),
    source_available: sources.every((source) => source.available),
    source_readiness_status: readinessResult.value?.readiness_status ?? null,
    source_command_gate_count: readinessResult.value?.summary?.command_gate_count ?? 0,
    source_allowed_command_count: readinessResult.value?.summary?.allowed_command_count ?? 0,
    source_blocked_command_count: readinessResult.value?.summary?.blocked_command_count ?? 0,
    command_queue_item_count: commandQueueItems.length,
    held_command_item_count: heldCommandItems.length,
    actor_command_queue_count: actorCommandQueues.length,
    protected_held_command_count: heldCommandItems.filter((item) => item.requires_explicit_human_approval).length,
    manual_input_hold_count: heldCommandItems.filter((item) => item.command_status === "blocked_until_manual_input").length,
    pending_human_input_count: readinessResult.value?.summary?.pending_human_input_count ?? 0,
    pending_prompt_count: readinessResult.value?.summary?.pending_prompt_count ?? 0,
    validation_error_count: validation.errors.length,
    by_command_kind: countBy([...commandQueueItems, ...heldCommandItems], "command_kind"),
    by_command_status: countBy([...commandQueueItems, ...heldCommandItems], "command_status"),
    by_hold_status: countBy(heldCommandItems, "hold_status"),
    by_required_actor: countBy(actorCommandQueues, "required_actor"),
  };
}

function deriveQueueStatus(validation, commandQueueItems, heldCommandItems) {
  if (!validation.valid) return "blocked";
  if (commandQueueItems.length > 0 && heldCommandItems.length > 0) return "ready_with_holds";
  if (commandQueueItems.length > 0) return "ready";
  if (heldCommandItems.length > 0) return "waiting_for_human_input";
  return "empty";
}

function deriveCommandKind(stepKey) {
  return COMMAND_KIND_BY_STEP[stepKey] ?? "other";
}

function buildStepSafeHandling() {
  return {
    auto_execute_allowed: false,
    command_queue_only: true,
    protected_actions_executed: false,
    receipt_edits_must_be_manual: true,
  };
}

function renderCommandQueueMarkdown(commandQueue) {
  const lines = [
    "# Human Review Cycle Receipt Completion Command Queue",
    "",
    `- Queue status: ${commandQueue.queue_status}`,
    `- Ready command items: ${commandQueue.summary.command_queue_item_count}`,
    `- Held command items: ${commandQueue.summary.held_command_item_count}`,
    `- Actor command queues: ${commandQueue.summary.actor_command_queue_count}`,
    `- Validation errors: ${commandQueue.summary.validation_error_count}`,
    "",
    "## Ready To Run Manually",
    "",
  ];
  for (const item of commandQueue.command_queue_items) {
    lines.push(`- ${item.queue_rank}. ${item.step_key}: \`${item.command}\``);
  }
  lines.push("", "## Held Commands", "");
  for (const item of commandQueue.held_command_items) {
    lines.push(`- ${item.hold_rank}. ${item.step_key}: ${item.hold_status} - ${item.hold_reason}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderCommandQueueHtml(commandQueue) {
  const metricHtml = [
    ["Ready", commandQueue.summary.command_queue_item_count],
    ["Held", commandQueue.summary.held_command_item_count],
    ["Actors", commandQueue.summary.actor_command_queue_count],
    ["Protected Held", commandQueue.summary.protected_held_command_count],
  ].map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const readyRows = commandQueue.command_queue_items.map((item) => `
    <tr>
      <td>${escapeHtml(item.queue_rank)}</td>
      <td><span class="badge ready">${escapeHtml(item.queue_status)}</span></td>
      <td>${escapeHtml(item.command_kind)}</td>
      <td>${escapeHtml(item.step_key)}</td>
      <td><code>${escapeHtml(item.command)}</code></td>
    </tr>`).join("");
  const heldRows = commandQueue.held_command_items.map((item) => `
    <tr>
      <td>${escapeHtml(item.hold_rank)}</td>
      <td><span class="badge held">${escapeHtml(item.hold_status)}</span></td>
      <td>${escapeHtml(item.command_kind)}</td>
      <td>${escapeHtml(item.step_key)}</td>
      <td><code>${escapeHtml(item.command)}</code></td>
      <td>${escapeHtml(item.hold_reason)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Human Review Cycle Receipt Completion Command Queue</title>
  <style>
    :root { color-scheme: light; --ink:#162033; --muted:#647086; --line:#d9e0ea; --bg:#f7f9fc; --panel:#ffffff; --good:#0f766e; --warn:#9f580a; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 28px 32px 20px; background: var(--panel); border-bottom: 1px solid var(--line); }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 26px 0 12px; font-size: 17px; letter-spacing: 0; }
    main { padding: 24px 32px 40px; }
    .status { color: var(--muted); font-size: 14px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 18px 0; }
    .metric { border: 1px solid var(--line); background: var(--panel); padding: 12px; border-radius: 8px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 4px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); }
    th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { color: var(--muted); font-weight: 700; background: #eef3f8; }
    code { white-space: normal; overflow-wrap: anywhere; font-size: 12px; color: #334155; }
    .badge { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
    .ready { color: var(--good); border-color: #9fd3ca; background: #ecfdf9; }
    .held { color: var(--warn); border-color: #f2c078; background: #fff8eb; }
  </style>
</head>
<body>
  <header>
    <h1>Human Review Cycle Receipt Completion Command Queue</h1>
    <div class="status">Status: ${escapeHtml(commandQueue.queue_status)}. This queue executes nothing and only separates ready manual commands from held commands.</div>
  </header>
  <main>
    <section class="metrics">${metricHtml}</section>
    <h2>Ready To Run Manually</h2>
    <table>
      <thead><tr><th>Rank</th><th>Status</th><th>Kind</th><th>Step</th><th>Command</th></tr></thead>
      <tbody>${readyRows}</tbody>
    </table>
    <h2>Held Commands</h2>
    <table>
      <thead><tr><th>Rank</th><th>Status</th><th>Kind</th><th>Step</th><th>Command</th><th>Reason</th></tr></thead>
      <tbody>${heldRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function serializableCommandQueue(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    command_queue_id: result.command_queue_id,
    output_dir: result.output_dir,
    queue_status: result.queue_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    command_queue_items: result.command_queue_items,
    held_command_items: result.held_command_items,
    actor_command_queues: result.actor_command_queues,
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

function compareActorQueues(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--completion-readiness") args.completionReadinessPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-queue.mjs [options]

Options:
  --completion-readiness <path> Human Review Cycle Receipt Completion Readiness artifact
  --out-dir <dir>               Output directory
  --run-at <iso>                Override generated_at
  --check                       Exit non-zero when structural validation fails
`);
}
