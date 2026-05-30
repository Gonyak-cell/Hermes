import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PACK_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-pack/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PACK_INPUTS = {
  fieldAuditPath: "artifacts/human-review-cycle-receipt-field-audit/latest/human-review-cycle-receipt-field-audit.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER = {
  blocked: 0,
  attention: 1,
  ready_for_human_input: 2,
  ready_for_validation: 3,
  clear: 4,
};

const RECEIPT_STATUS_VALUES = ["resolved", "deferred", "rejected", "failed", "cancelled"];
const COMMAND_RESULT_VALUES = ["passed", "failed", "skipped", "not_applicable"];

export async function runHumanReviewCycleReceiptCompletionPack(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionPack(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionPack(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion pack failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionPack(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PACK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const fieldAuditPath = path.resolve(options.fieldAuditPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_PACK_INPUTS.fieldAuditPath);
  const fieldAuditResult = await readJsonOrError(fieldAuditPath);
  const completionItems = buildCompletionItems(fieldAuditResult.value?.field_audit_items ?? []);
  const actorCompletionPacks = buildActorCompletionPacks(fieldAuditResult.value?.actor_field_audits ?? [], completionItems, outputDir);
  const source = buildSource("human_review_cycle_receipt_field_audit", "Human Review Cycle Receipt Field Audit", fieldAuditPath, fieldAuditResult);
  const validation = validateCompletionPack({ source, fieldAuditResult, actorCompletionPacks, completionItems });
  const completionPack = {
    schema_version: "human-review-cycle-receipt-completion-pack.v1",
    generated_at: generatedAt,
    completion_pack_id: `human-review-cycle-receipt-completion-pack.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    completion_status: deriveCompletionPackStatus(validation, completionItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      template_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [source],
    summary: summarizeCompletionPack(actorCompletionPacks, completionItems, source, fieldAuditResult, validation),
    actor_completion_packs: actorCompletionPacks,
    completion_items: completionItems,
    validation,
  };

  return {
    ...completionPack,
    markdown: renderCompletionPackMarkdown(completionPack),
  };
}

export async function writeHumanReviewCycleReceiptCompletionPack(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-pack.json"), serializableCompletionPack(result));
  await writeJson(path.join(outDir, "completion-items.json"), {
    generated_at: result.generated_at,
    count: result.completion_items.length,
    completion_items: result.completion_items,
  });
  await writeJson(path.join(outDir, "actor-completion-packs.json"), {
    generated_at: result.generated_at,
    count: result.actor_completion_packs.length,
    actor_completion_packs: result.actor_completion_packs,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_completion_packs) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.completion_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "completion-pack.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      completion_status: actor.completion_status,
      count: items.length,
      actor_completion_pack: actor,
      completion_items: items,
    });
    await writeJson(path.join(actorDir, "receipt-completion-template.json"), buildActorReceiptCompletionTemplate(actor, items, result.generated_at));
    await writeFile(path.join(actorDir, "completion-pack.md"), renderActorCompletionPackMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionPackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionPack(args);
    console.log(`Human review cycle receipt completion pack ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Completion status: ${result.completion_status}`);
    console.log(`Actor completion packs: ${result.summary.actor_completion_pack_count}`);
    console.log(`Completion items: ${result.summary.completion_item_count}`);
    console.log(`Ready for human input: ${result.summary.ready_for_human_input_count}`);
    console.log(`Template field prompts: ${result.summary.template_field_prompt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCompletionItems(fieldAuditItems) {
  return fieldAuditItems.map((item) => {
    const fieldPrompts = buildFieldPrompts(item);
    const completionStatus = deriveCompletionItemStatus(item, fieldPrompts);
    return {
      completion_item_id: `human-review-cycle-receipt-completion-pack.${slugify(item.gate_item_id)}`,
      field_audit_item_id: item.field_audit_item_id,
      console_item_id: item.console_item_id,
      gate_item_id: item.gate_item_id,
      receipt_id: item.receipt_id,
      required_actor: item.required_actor,
      gate_type: item.gate_type,
      priority: item.priority,
      completion_status: completionStatus,
      field_audit_status: item.field_audit_status,
      protected_action: Boolean(item.protected_action),
      evidence_decision: Boolean(item.evidence_decision),
      target_receipt_input_path: item.target_receipt_input_path,
      receipt_row_present: Boolean(item.receipt_row_present),
      pending_receipt: Boolean(item.pending_receipt),
      terminal_receipt: Boolean(item.terminal_receipt),
      title: item.title,
      reason: item.reason,
      required_receipt_fields: item.required_receipt_fields ?? [],
      completed_required_fields: item.completed_required_fields ?? [],
      missing_required_field_values: item.missing_required_field_values ?? [],
      template_field_prompt_count: fieldPrompts.length,
      field_prompts: fieldPrompts,
      completion_template_row: buildCompletionTemplateRow(item, fieldPrompts),
      manual_next_action: buildManualNextAction(completionStatus),
      next_actions: buildCompletionNextActions(completionStatus),
      source_refs: {
        field_audit_item_id: item.field_audit_item_id,
        console_item_id: item.console_item_id,
        target_receipt_input_path: item.target_receipt_input_path,
      },
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        template_only: true,
        receipt_edits_must_be_manual: true,
      },
    };
  }).sort(compareCompletionItems).map((item, index) => ({ ...item, completion_rank: index + 1 }));
}

function buildFieldPrompts(item) {
  const fieldsToPrompt = unique([
    ...((item.pending_receipt && (item.required_receipt_fields ?? []).includes("receipt_status")) ? ["receipt_status"] : []),
    ...((item.pending_receipt && (item.required_receipt_fields ?? []).includes("outcome")) ? ["outcome"] : []),
    ...(item.missing_required_field_values ?? []),
  ]);
  return fieldsToPrompt.map((fieldName) => ({
    field_name: fieldName,
    expected_value_type: expectedValueType(fieldName),
    allowed_values: allowedValuesForField(fieldName, item),
    placeholder_value: placeholderValueForField(fieldName, item),
    instruction: instructionForField(fieldName, item),
  }));
}

function buildCompletionTemplateRow(item, fieldPrompts) {
  return {
    receipt_id: item.receipt_id,
    gate_item_id: item.gate_item_id,
    target_receipt_input_path: item.target_receipt_input_path,
    completion_status: deriveCompletionItemStatus(item, fieldPrompts),
    fields_to_fill: Object.fromEntries(fieldPrompts.map((prompt) => [prompt.field_name, prompt.placeholder_value])),
    allowed_outcomes: item.allowed_outcomes ?? [],
    receipt_status_allowed_values: RECEIPT_STATUS_VALUES,
    notes: "Replace placeholders manually in the target receipt input. This template is not applied automatically.",
  };
}

function buildActorCompletionPacks(actorFieldAudits, completionItems, outputDir) {
  const auditByActor = new Map((actorFieldAudits ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(completionItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const fieldAudit = auditByActor.get(requiredActor);
      return {
        actor_completion_pack_id: `human-review-cycle-receipt-completion-pack.actor.${slugify(requiredActor)}`,
        actor_field_audit_id: fieldAudit?.actor_field_audit_id ?? null,
        required_actor: requiredActor,
        completion_status: deriveActorCompletionPackStatus(items),
        priority: highestPriority(items),
        completion_item_count: items.length,
        ready_for_human_input_count: items.filter((item) => item.completion_status === "ready_for_human_input").length,
        ready_for_validation_count: items.filter((item) => item.completion_status === "ready_for_validation").length,
        attention_count: items.filter((item) => item.completion_status === "attention").length,
        blocked_count: items.filter((item) => item.completion_status === "blocked").length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        template_field_prompt_count: sum(items.map((item) => item.template_field_prompt_count)),
        completion_item_ids: items.map((item) => item.completion_item_id),
        completion_pack_json_path: path.join(outputDir, "actors", requiredActor, "completion-pack.json"),
        completion_pack_markdown_path: path.join(outputDir, "actors", requiredActor, "completion-pack.md"),
        receipt_completion_template_path: path.join(outputDir, "actors", requiredActor, "receipt-completion-template.json"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          template_only: true,
          protected_actions_executed: false,
          receipt_edits_must_be_manual: true,
        },
      };
    })
    .sort(compareActorCompletionPacks);
}

function buildActorReceiptCompletionTemplate(actor, items, generatedAt) {
  return {
    schema_version: "human-review-cycle-receipt-completion-template.v1",
    generated_at: generatedAt,
    required_actor: actor.required_actor,
    completion_status: actor.completion_status,
    instructions: [
      "This file is a manual completion template only.",
      "Copy the placeholder values into the target receipt-input.json rows only after a human reviewer has made the decision.",
      "Do not run protected actions from this template.",
      "After editing the target receipt inputs, rerun correction merge, validation, receipt field audit, and completion pack.",
    ],
    target_receipt_input_paths: [...new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean))],
    completion_rows: items.map((item) => item.completion_template_row),
  };
}

function validateCompletionPack({ source, fieldAuditResult, actorCompletionPacks, completionItems }) {
  const errors = [];
  if (!source.available) errors.push({ path: "sources.human_review_cycle_receipt_field_audit", message: `Human Review Cycle Receipt Field Audit unavailable: ${source.error}` });
  const expectedItemCount = fieldAuditResult.value?.summary?.field_audit_item_count ?? 0;
  const expectedActorCount = fieldAuditResult.value?.summary?.actor_field_audit_count ?? 0;
  if (expectedItemCount > 0 && completionItems.length !== expectedItemCount) {
    errors.push({ path: "completion_items", message: "Completion item count must match receipt field audit item count." });
  }
  if (expectedActorCount > 0 && actorCompletionPacks.length !== expectedActorCount) {
    errors.push({ path: "actor_completion_packs", message: "Actor completion pack count must match actor field audit count." });
  }
  for (const item of completionItems) {
    if (item.completion_status === "blocked") {
      errors.push({ path: `completion_items.${item.completion_item_id}`, message: "Completion item cannot be prepared because its source receipt row is blocked." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `completion_items.${item.completion_item_id}.safe_handling`, message: "Receipt completion pack must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCompletionPack(actorCompletionPacks, completionItems, source, fieldAuditResult, validation) {
  return {
    completion_status: deriveCompletionPackStatus(validation, completionItems),
    source_available: source.available,
    source_field_audit_status: fieldAuditResult.value?.field_audit_status ?? null,
    source_field_audit_item_count: fieldAuditResult.value?.summary?.field_audit_item_count ?? 0,
    source_actor_field_audit_count: fieldAuditResult.value?.summary?.actor_field_audit_count ?? 0,
    actor_completion_pack_count: actorCompletionPacks.length,
    completion_item_count: completionItems.length,
    ready_for_human_input_count: completionItems.filter((item) => item.completion_status === "ready_for_human_input").length,
    ready_for_validation_count: completionItems.filter((item) => item.completion_status === "ready_for_validation").length,
    attention_count: completionItems.filter((item) => item.completion_status === "attention").length,
    blocked_count: completionItems.filter((item) => item.completion_status === "blocked").length,
    target_file_count: new Set(completionItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    template_field_prompt_count: sum(completionItems.map((item) => item.template_field_prompt_count)),
    protected_action_count: completionItems.filter((item) => item.protected_action).length,
    evidence_decision_count: completionItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(completionItems, "required_actor"),
    by_gate_type: countBy(completionItems, "gate_type"),
    by_completion_status: countBy(completionItems, "completion_status"),
    by_priority: countBy(completionItems, "priority"),
  };
}

function deriveCompletionPackStatus(validation, completionItems) {
  if (!validation.valid) return "blocked";
  if (completionItems.some((item) => item.completion_status === "blocked")) return "blocked";
  if (completionItems.some((item) => item.completion_status === "attention")) return "attention";
  if (completionItems.some((item) => item.completion_status === "ready_for_human_input")) return "ready_for_human_input";
  if (completionItems.some((item) => item.completion_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveActorCompletionPackStatus(items) {
  if (items.some((item) => item.completion_status === "blocked")) return "blocked";
  if (items.some((item) => item.completion_status === "attention")) return "attention";
  if (items.some((item) => item.completion_status === "ready_for_human_input")) return "ready_for_human_input";
  if (items.some((item) => item.completion_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveCompletionItemStatus(item, fieldPrompts) {
  if (item.field_audit_status === "blocked" || !item.receipt_row_present) return "blocked";
  if (item.field_audit_status === "attention") return "attention";
  if (item.field_audit_status === "ready_for_validation") return "ready_for_validation";
  if (item.field_audit_status === "pending_human_review" || fieldPrompts.length > 0) return "ready_for_human_input";
  return "clear";
}

function expectedValueType(fieldName) {
  if (["completed_action_refs", "commands_run"].includes(fieldName)) return "array";
  if (["protected_action_reference", "command_result"].includes(fieldName)) return "string_or_null";
  return "string";
}

function allowedValuesForField(fieldName, item) {
  if (fieldName === "receipt_status") return RECEIPT_STATUS_VALUES;
  if (fieldName === "outcome") return item.allowed_outcomes ?? [];
  if (fieldName === "command_result") return COMMAND_RESULT_VALUES;
  return [];
}

function placeholderValueForField(fieldName, item) {
  if (fieldName === "receipt_status") return "<resolved|deferred|rejected|failed|cancelled>";
  if (fieldName === "outcome") return `<${(item.allowed_outcomes ?? []).join("|") || "allowed_outcome"}>`;
  if (fieldName === "decided_at") return "<YYYY-MM-DDTHH:mm:ss.sssZ>";
  if (fieldName === "completed_action_refs") return ["<manual_action_or_review_reference>"];
  if (fieldName === "commands_run") return [];
  if (fieldName === "command_result") return "<passed|failed|skipped|not_applicable>";
  if (fieldName === "reviewer" || fieldName === "decided_by") return "<human_reviewer_name_or_id>";
  if (fieldName === "decision_reference") return "<approval_or_review_reference_id>";
  if (fieldName === "decision_notes") return "<brief_human_decision_notes>";
  if (fieldName === "protected_action_reference") return "<protected_action_reference_if_applicable>";
  return `<${fieldName}>`;
}

function instructionForField(fieldName, item) {
  if (fieldName === "receipt_status") return "Use a terminal receipt status after a human decision has been made.";
  if (fieldName === "outcome") return `Use one of the allowed outcomes for ${item.gate_type}.`;
  if (fieldName === "decided_at") return "Record the human decision timestamp in ISO 8601 format.";
  if (fieldName === "completed_action_refs") return "List manual review, approval, or action references that support this receipt.";
  if (fieldName === "commands_run") return "List follow-up command references only if commands were actually run.";
  if (fieldName === "command_result") return "Record the follow-up command result only when command execution was required.";
  if (fieldName === "reviewer" || fieldName === "decided_by") return "Record the human reviewer or decision maker.";
  if (fieldName === "decision_reference") return "Link the approval, evidence decision, delivery receipt, merge review, or manual record.";
  if (fieldName === "decision_notes") return "Summarize the human decision briefly.";
  if (fieldName === "protected_action_reference") return "Fill only when a protected action has an approved external reference.";
  return "Fill this required receipt field manually.";
}

function buildManualNextAction(status) {
  if (status === "ready_for_human_input") return "Open the target receipt input and use the completion template as a manual checklist; do not apply it automatically.";
  if (status === "ready_for_validation") return "Rerun correction merge and validation before applying receipts.";
  if (status === "attention") return "Inspect the field audit item before preparing a terminal receipt.";
  if (status === "blocked") return "Regenerate field audit after repairing missing target receipt files or rows.";
  return "No action required.";
}

function buildCompletionNextActions(status) {
  if (status === "ready_for_human_input") return ["open_actor_completion_template", "manually_fill_target_receipt_input", "rerun_correction_merge_validation_cycle"];
  if (status === "ready_for_validation") return ["rerun_correction_merge", "rerun_correction_validation", "rerun_completion_pack"];
  if (status === "attention") return ["inspect_receipt_field_audit", "repair_receipt_metadata_or_values", "rerun_completion_pack"];
  if (status === "blocked") return ["regenerate_receipt_field_audit", "regenerate_reviewer_console", "rerun_completion_pack"];
  return ["no_action_required"];
}

function renderCompletionPackMarkdown(pack) {
  const lines = [
    "# Human Review Cycle Receipt Completion Pack",
    "",
    `- Completion status: ${pack.completion_status}`,
    `- Actor completion packs: ${pack.summary.actor_completion_pack_count}`,
    `- Completion items: ${pack.summary.completion_item_count}`,
    `- Ready for human input: ${pack.summary.ready_for_human_input_count}`,
    `- Template field prompts: ${pack.summary.template_field_prompt_count}`,
    `- Validation errors: ${pack.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is template-only.",
    "- It does not edit target receipt inputs.",
    "- It does not apply receipts or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of pack.actor_completion_packs) {
    lines.push(`- ${actor.required_actor}: ${actor.completion_item_count} item(s), ${actor.template_field_prompt_count} field prompt(s), ${actor.receipt_completion_template_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorCompletionPackMarkdown(actor, items) {
  const lines = [
    `# Human Review Receipt Completion Pack: ${actor.required_actor}`,
    "",
    `- Completion status: ${actor.completion_status}`,
    `- Completion items: ${actor.completion_item_count}`,
    `- Ready for human input: ${actor.ready_for_human_input_count}`,
    `- Template field prompts: ${actor.template_field_prompt_count}`,
    `- Template JSON: ${actor.receipt_completion_template_path}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.completion_rank}. ${item.title}`);
    lines.push("");
    lines.push(`- Completion status: ${item.completion_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Gate type: ${item.gate_type}`);
    lines.push(`- Priority: ${item.priority}`);
    lines.push(`- Fields to fill: ${item.field_prompts.map((prompt) => prompt.field_name).join(", ") || "none"}`);
    lines.push(`- Next action: ${item.manual_next_action}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function serializableCompletionPack(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    completion_pack_id: result.completion_pack_id,
    output_dir: result.output_dir,
    completion_status: result.completion_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_completion_packs: result.actor_completion_packs,
    completion_items: result.completion_items,
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

function compareCompletionItems(a, b) {
  return (STATUS_ORDER[a.completion_status] ?? 99) - (STATUS_ORDER[b.completion_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorCompletionPacks(a, b) {
  return (STATUS_ORDER[a.completion_status] ?? 99) - (STATUS_ORDER[b.completion_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function highestPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))[0]?.priority ?? "low";
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    if (!groups[key]) groups[key] = [];
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
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
    else if (arg === "--field-audit") args.fieldAuditPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-pack.mjs [options]

Options:
  --field-audit <path>        Human Review Cycle Receipt Field Audit artifact
  --out-dir <dir>             Output directory
  --run-at <iso>              Override generated_at
  --check                     Exit non-zero when validation fails
`);
}
