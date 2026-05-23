import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPTS_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipts/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPTS_INPUTS = {
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
};

export async function runHumanReviewCycleReceiptCompletionCommandReceipts(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceipts(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceipts(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command receipts failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceipts(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPTS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPTS_INPUTS.commandQueuePath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const commandQueue = commandQueueResult.value;
  const receiptRequirements = (commandQueue?.command_queue_items ?? []).map((item) => buildReceiptRequirement(item, generatedAt));
  const heldCommandReferences = (commandQueue?.held_command_items ?? []).map((item, index) => buildHeldCommandReference(item, index + 1));
  const receiptInputDraft = buildReceiptInputDraft(generatedAt, commandQueue, receiptRequirements);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
  ];
  const validation = validateCommandReceipts({ sources, commandQueueResult, receiptRequirements, receiptInputDraft, heldCommandReferences });
  const commandReceipts = {
    schema_version: "human-review-cycle-receipt-completion-command-receipts.v1",
    generated_at: generatedAt,
    command_receipt_draft_id: `human-review-cycle-receipt-completion-command-receipts.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    receipt_status: deriveReceiptStatus(commandQueueResult, receiptRequirements),
    safe_handling: {
      auto_execute_allowed: false,
      command_receipts_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeCommandReceipts(commandQueueResult, receiptRequirements, receiptInputDraft, heldCommandReferences, validation),
    receipt_requirements: receiptRequirements,
    receipt_input_draft: receiptInputDraft,
    held_command_references: heldCommandReferences,
    validation,
  };

  return {
    ...commandReceipts,
    markdown: renderCommandReceiptsMarkdown(commandReceipts),
    html: renderCommandReceiptsHtml(commandReceipts),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceipts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipts.json"), serializableCommandReceipts(result));
  await writeJson(path.join(outDir, "receipt-input-draft.json"), result.receipt_input_draft);
  await writeJson(path.join(outDir, "receipt-requirements.json"), {
    generated_at: result.generated_at,
    count: result.receipt_requirements.length,
    receipt_requirements: result.receipt_requirements,
  });
  await writeJson(path.join(outDir, "held-command-references.json"), {
    generated_at: result.generated_at,
    count: result.held_command_references.length,
    held_command_references: result.held_command_references,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceipts(args);
    console.log(`Human review cycle receipt completion command receipts ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Receipt status: ${result.receipt_status}`);
    console.log(`Receipt drafts: ${result.summary.receipt_draft_count}`);
    console.log(`Held command references: ${result.summary.held_command_reference_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildReceiptRequirement(queueItem, generatedAt) {
  const requiredFields = requiredFieldsForCommandReceipt();
  return {
    receipt_requirement_id: `human-review-cycle-receipt-completion-command-receipt-requirement.${slugify(queueItem.queue_item_id)}`,
    queue_item_id: queueItem.queue_item_id,
    command_gate_id: queueItem.command_gate_id,
    runbook_step_id: queueItem.runbook_step_id,
    step_key: queueItem.step_key,
    command_kind: queueItem.command_kind,
    command: queueItem.command,
    queue_status: queueItem.queue_status,
    required_receipt_fields: requiredFields,
    acceptance_criteria: acceptanceCriteriaForCommand(queueItem),
    receipt_form_draft: buildReceiptFormDraft(queueItem, requiredFields, generatedAt),
  };
}

function buildReceiptFormDraft(queueItem, requiredFields, generatedAt) {
  return {
    receipt_id: `human-review-cycle-receipt-completion-command-receipt.${slugify(queueItem.queue_item_id)}`,
    queue_item_id: queueItem.queue_item_id,
    command_gate_id: queueItem.command_gate_id,
    runbook_step_id: queueItem.runbook_step_id,
    step_key: queueItem.step_key,
    command_kind: queueItem.command_kind,
    command: queueItem.command,
    receipt_status: "pending",
    command_result: "not_run",
    executed_by: "",
    executed_at: "",
    output_reference: "",
    notes: "",
    commands_run: [queueItem.command],
    required_receipt_fields: requiredFields,
    generated_at: generatedAt,
  };
}

function buildHeldCommandReference(heldCommand, rank) {
  return {
    held_command_ref_id: `human-review-cycle-receipt-completion-command-receipts.held.${String(rank).padStart(2, "0")}.${slugify(heldCommand.step_key)}`,
    held_command_id: heldCommand.held_command_id,
    command_gate_id: heldCommand.command_gate_id,
    step_key: heldCommand.step_key,
    command_kind: heldCommand.command_kind,
    command: heldCommand.command,
    command_status: heldCommand.command_status,
    hold_status: heldCommand.hold_status,
    hold_reason: heldCommand.hold_reason,
    requires_explicit_human_approval: heldCommand.requires_explicit_human_approval,
  };
}

function buildReceiptInputDraft(generatedAt, commandQueue, requirements) {
  return {
    schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
    generated_at: generatedAt,
    command_queue_id: commandQueue?.command_queue_id ?? "human-review-cycle-receipt-completion-command-queue.unknown",
    instructions: "Fill one receipt row after a ready refresh command is manually run. Pending rows do not mark commands complete and do not execute protected actions.",
    receipts: requirements.map((requirement) => requirement.receipt_form_draft),
  };
}

function requiredFieldsForCommandReceipt() {
  return ["receipt_status", "command_result", "executed_by", "executed_at", "output_reference", "notes", "commands_run"];
}

function acceptanceCriteriaForCommand(queueItem) {
  return [
    "receipt_status is resolved, failed, skipped, or deferred for non-pending rows",
    "command_result records run_success, run_failed, skipped, or deferred",
    "executed_by and executed_at are filled for non-pending rows",
    "output_reference points to terminal output, artifact path, commit, or dashboard/API result",
    `commands_run includes ${queueItem.command}`,
  ];
}

function deriveReceiptStatus(commandQueueResult, receiptRequirements) {
  if (!commandQueueResult.ok) return "blocked_missing_command_queue";
  if (receiptRequirements.length > 0) return "pending_command_receipts";
  return "clear";
}

function validateCommandReceipts({ sources, commandQueueResult, receiptRequirements, receiptInputDraft, heldCommandReferences }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const readyCommandCount = commandQueueResult.value?.summary?.command_queue_item_count ?? 0;
  if (readyCommandCount > 0 && receiptRequirements.length !== readyCommandCount) {
    errors.push({ path: "receipt_requirements", message: "Receipt requirement count must match ready command queue item count." });
  }
  if (receiptInputDraft.receipts.length !== receiptRequirements.length) {
    errors.push({ path: "receipt_input_draft.receipts", message: "Receipt input draft count must match receipt requirement count." });
  }
  const heldCommandCount = commandQueueResult.value?.summary?.held_command_item_count ?? 0;
  if (heldCommandCount > 0 && heldCommandReferences.length !== heldCommandCount) {
    errors.push({ path: "held_command_references", message: "Held command references must match held command count." });
  }
  if (heldCommandReferences.some((item) => item.requires_explicit_human_approval) && receiptRequirements.some((item) => item.command_kind === "protected_application")) {
    errors.push({ path: "receipt_requirements", message: "Protected application commands must stay out of ready command receipts." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCommandReceipts(commandQueueResult, receiptRequirements, receiptInputDraft, heldCommandReferences, validation) {
  return {
    receipt_status: deriveReceiptStatus(commandQueueResult, receiptRequirements),
    command_queue_available: commandQueueResult.ok,
    source_command_queue_id: commandQueueResult.value?.command_queue_id ?? null,
    source_ready_command_count: commandQueueResult.value?.summary?.command_queue_item_count ?? 0,
    source_held_command_count: commandQueueResult.value?.summary?.held_command_item_count ?? 0,
    receipt_requirement_count: receiptRequirements.length,
    receipt_draft_count: receiptInputDraft.receipts.length,
    pending_receipt_count: receiptInputDraft.receipts.filter((receipt) => receipt.receipt_status === "pending").length,
    command_receipt_count: receiptRequirements.length,
    held_command_reference_count: heldCommandReferences.length,
    protected_held_command_count: heldCommandReferences.filter((item) => item.requires_explicit_human_approval).length,
    required_field_count: receiptRequirements.reduce((total, item) => total + item.required_receipt_fields.length, 0),
    validation_error_count: validation.errors.length,
    by_command_kind: countBy(receiptRequirements, "command_kind"),
    by_hold_status: countBy(heldCommandReferences, "hold_status"),
  };
}

function renderCommandReceiptsMarkdown(result) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Command Receipts");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Receipt status: ${result.receipt_status}`);
  lines.push("");
  lines.push(`- Receipt requirements: ${result.summary.receipt_requirement_count}`);
  lines.push(`- Receipt drafts: ${result.summary.receipt_draft_count}`);
  lines.push(`- Held command references: ${result.summary.held_command_reference_count}`);
  lines.push(`- Protected held commands: ${result.summary.protected_held_command_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Receipt Requirements");
  lines.push("");
  for (const requirement of result.receipt_requirements) {
    lines.push(`- ${requirement.step_key}: \`${requirement.command}\``);
    lines.push(`  - Required fields: ${requirement.required_receipt_fields.join(", ")}`);
  }
  if (result.receipt_requirements.length === 0) lines.push("- No ready command receipt requirements.");
  lines.push("", "## Held Command References", "");
  for (const item of result.held_command_references) {
    lines.push(`- ${item.step_key}: ${item.hold_status} - ${item.hold_reason}`);
  }
  if (result.held_command_references.length === 0) lines.push("- No held commands.");
  return `${lines.join("\n")}\n`;
}

function renderCommandReceiptsHtml(result) {
  const metricHtml = [
    ["Receipt Drafts", result.summary.receipt_draft_count],
    ["Held References", result.summary.held_command_reference_count],
    ["Protected Held", result.summary.protected_held_command_count],
    ["Validation Errors", result.summary.validation_error_count],
  ].map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const receiptRows = result.receipt_requirements.map((item) => `
    <tr>
      <td>${escapeHtml(item.step_key)}</td>
      <td>${escapeHtml(item.command_kind)}</td>
      <td><code>${escapeHtml(item.command)}</code></td>
      <td>${escapeHtml(item.required_receipt_fields.join(", "))}</td>
    </tr>`).join("");
  const heldRows = result.held_command_references.map((item) => `
    <tr>
      <td>${escapeHtml(item.step_key)}</td>
      <td>${escapeHtml(item.hold_status)}</td>
      <td><code>${escapeHtml(item.command)}</code></td>
      <td>${escapeHtml(item.hold_reason)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Human Review Cycle Receipt Completion Command Receipts</title>
  <style>
    :root { color-scheme: light; --ink:#162033; --muted:#647086; --line:#d9e0ea; --bg:#f7f9fc; --panel:#ffffff; }
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
  </style>
</head>
<body>
  <header>
    <h1>Human Review Cycle Receipt Completion Command Receipts</h1>
    <div class="status">Status: ${escapeHtml(result.receipt_status)}. This stage only creates receipt drafts for manually run commands.</div>
  </header>
  <main>
    <section class="metrics">${metricHtml}</section>
    <h2>Ready Command Receipt Drafts</h2>
    <table>
      <thead><tr><th>Step</th><th>Kind</th><th>Command</th><th>Required Fields</th></tr></thead>
      <tbody>${receiptRows}</tbody>
    </table>
    <h2>Held Command References</h2>
    <table>
      <thead><tr><th>Step</th><th>Hold Status</th><th>Command</th><th>Reason</th></tr></thead>
      <tbody>${heldRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function serializableCommandReceipts(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    command_receipt_draft_id: result.command_receipt_draft_id,
    output_dir: result.output_dir,
    receipt_status: result.receipt_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    receipt_requirements: result.receipt_requirements,
    receipt_input_draft: result.receipt_input_draft,
    held_command_references: result.held_command_references,
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
    else if (arg === "--command-queue") args.commandQueuePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipts.mjs [options]

Options:
  --command-queue <path> Human Review Cycle Receipt Completion Command Queue artifact
  --out-dir <dir>        Output directory
  --run-at <iso>         Override generated_at
  --check                Exit non-zero when structural validation fails
`);
}
