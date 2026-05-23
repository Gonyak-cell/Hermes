import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_VERIFICATION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-verification/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_VERIFICATION_INPUTS = {
  completionPackPath: "artifacts/human-review-cycle-receipt-completion-pack/latest/human-review-cycle-receipt-completion-pack.json",
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
  pending_human_input: 2,
  ready_for_validation: 3,
  clear: 4,
};

const TERMINAL_RECEIPT_STATUS_VALUES = ["resolved", "deferred", "rejected", "failed", "cancelled"];
const COMMAND_RESULT_VALUES = ["passed", "failed", "skipped", "not_applicable"];
const PENDING_STRING_VALUES = new Set(["", "pending", "not_started", "needs_review", "todo", "tbd", "null", "undefined"]);

export async function runHumanReviewCycleReceiptCompletionVerification(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionVerification(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionVerification(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion verification failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionVerification(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_VERIFICATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionPackPath = path.resolve(options.completionPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_VERIFICATION_INPUTS.completionPackPath);
  const completionPackResult = await readJsonOrError(completionPackPath);
  const receiptCache = new Map();
  const verificationItems = await buildVerificationItems(completionPackResult.value?.completion_items ?? [], receiptCache);
  const actorVerifications = buildActorVerifications(completionPackResult.value?.actor_completion_packs ?? [], verificationItems, outputDir);
  const source = buildSource("human_review_cycle_receipt_completion_pack", "Human Review Cycle Receipt Completion Pack", completionPackPath, completionPackResult);
  const validation = validateCompletionVerification({ source, completionPackResult, actorVerifications, verificationItems });
  const verification = {
    schema_version: "human-review-cycle-receipt-completion-verification.v1",
    generated_at: generatedAt,
    verification_id: `human-review-cycle-receipt-completion-verification.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    verification_status: deriveVerificationStatus(validation, verificationItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      verification_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [source],
    summary: summarizeCompletionVerification(actorVerifications, verificationItems, source, completionPackResult, validation),
    actor_verifications: actorVerifications,
    verification_items: verificationItems,
    validation,
  };

  return {
    ...verification,
    markdown: renderCompletionVerificationMarkdown(verification),
  };
}

export async function writeHumanReviewCycleReceiptCompletionVerification(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-verification.json"), serializableCompletionVerification(result));
  await writeJson(path.join(outDir, "verification-items.json"), {
    generated_at: result.generated_at,
    count: result.verification_items.length,
    verification_items: result.verification_items,
  });
  await writeJson(path.join(outDir, "actor-verifications.json"), {
    generated_at: result.generated_at,
    count: result.actor_verifications.length,
    actor_verifications: result.actor_verifications,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_verifications) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.verification_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "completion-verification.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      verification_status: actor.verification_status,
      count: items.length,
      actor_verification: actor,
      verification_items: items,
    });
    await writeFile(path.join(actorDir, "completion-verification.md"), renderActorCompletionVerificationMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionVerificationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionVerification(args);
    console.log(`Human review cycle receipt completion verification ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Verification status: ${result.verification_status}`);
    console.log(`Actor verifications: ${result.summary.actor_verification_count}`);
    console.log(`Verification items: ${result.summary.verification_item_count}`);
    console.log(`Pending human input: ${result.summary.pending_human_input_count}`);
    console.log(`Ready for validation: ${result.summary.ready_for_validation_count}`);
    console.log(`Pending prompt fields: ${result.summary.pending_prompt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function buildVerificationItems(completionItems, receiptCache) {
  const items = [];
  for (const item of completionItems) {
    const receiptFile = await readReceiptInput(item.target_receipt_input_path, receiptCache);
    const receiptRow = findReceiptRow(receiptFile.value?.receipts ?? [], item);
    const fieldResults = buildFieldResults(item, receiptRow);
    const verificationStatus = deriveVerificationItemStatus(item, receiptFile, receiptRow, fieldResults);
    items.push({
      verification_item_id: `human-review-cycle-receipt-completion-verification.${slugify(item.gate_item_id)}`,
      completion_item_id: item.completion_item_id,
      field_audit_item_id: item.field_audit_item_id,
      console_item_id: item.console_item_id,
      gate_item_id: item.gate_item_id,
      receipt_id: item.receipt_id,
      required_actor: item.required_actor,
      gate_type: item.gate_type,
      priority: item.priority,
      verification_status: verificationStatus,
      completion_status: item.completion_status,
      protected_action: Boolean(item.protected_action),
      evidence_decision: Boolean(item.evidence_decision),
      target_receipt_input_path: item.target_receipt_input_path,
      target_file_available: receiptFile.ok,
      target_file_error: receiptFile.error,
      receipt_row_present: Boolean(receiptRow),
      source_receipt_row_present: Boolean(item.receipt_row_present),
      field_prompt_count: item.field_prompts?.length ?? 0,
      completed_prompt_count: fieldResults.filter((field) => field.field_status === "complete").length,
      pending_prompt_count: fieldResults.filter((field) => field.field_status === "pending").length,
      invalid_prompt_count: fieldResults.filter((field) => field.field_status === "invalid").length,
      field_results: fieldResults,
      actual_receipt_status: normalizeReceiptValue(receiptRow?.receipt_status),
      actual_outcome: normalizeReceiptValue(receiptRow?.outcome),
      completion_applied: verificationStatus === "ready_for_validation" || verificationStatus === "clear",
      manual_next_action: buildManualNextAction(verificationStatus),
      next_actions: buildVerificationNextActions(verificationStatus),
      source_refs: {
        completion_item_id: item.completion_item_id,
        field_audit_item_id: item.field_audit_item_id,
        target_receipt_input_path: item.target_receipt_input_path,
      },
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        verification_only: true,
        receipt_edits_must_be_manual: true,
      },
    });
  }
  return items.sort(compareVerificationItems).map((item, index) => ({ ...item, verification_rank: index + 1 }));
}

function buildFieldResults(item, receiptRow) {
  const prompts = item.field_prompts ?? [];
  return prompts.map((prompt) => {
    const actualValue = receiptRow ? receiptRow[prompt.field_name] : undefined;
    const result = evaluatePromptField(prompt, actualValue);
    return {
      field_name: prompt.field_name,
      expected_value_type: prompt.expected_value_type,
      allowed_values: prompt.allowed_values ?? [],
      placeholder_value: prompt.placeholder_value ?? null,
      actual_value_preview: previewValue(actualValue),
      field_status: result.status,
      reason: result.reason,
    };
  });
}

function evaluatePromptField(prompt, actualValue) {
  const fieldName = prompt.field_name;
  const allowedValues = prompt.allowed_values ?? [];
  if (actualValue === undefined) return { status: "pending", reason: "Receipt row does not include this prompted field." };

  if (Array.isArray(actualValue)) {
    if (actualValue.length === 0) return { status: "pending", reason: "Prompted array field is empty." };
    if (actualValue.some((value) => isPendingValue(value))) return { status: "pending", reason: "Prompted array field still contains placeholder or pending values." };
    return { status: "complete", reason: "Prompted array field has manual values." };
  }

  if (fieldName === "command_result") {
    if (isPendingValue(actualValue)) return { status: "pending", reason: "Command result is not filled." };
    if (!COMMAND_RESULT_VALUES.includes(String(actualValue))) return { status: "invalid", reason: "Command result must be passed, failed, skipped, or not_applicable." };
    return { status: "complete", reason: "Command result is terminal." };
  }

  if (fieldName === "receipt_status") {
    if (isPendingValue(actualValue)) return { status: "pending", reason: "Receipt status is still pending." };
    if (!TERMINAL_RECEIPT_STATUS_VALUES.includes(String(actualValue))) return { status: "invalid", reason: "Receipt status must be terminal." };
    return { status: "complete", reason: "Receipt status is terminal." };
  }

  if (fieldName === "outcome") {
    if (isPendingValue(actualValue)) return { status: "pending", reason: "Outcome is still pending." };
    if (allowedValues.length > 0 && !allowedValues.includes(String(actualValue))) return { status: "invalid", reason: "Outcome is outside the allowed values for this gate type." };
    return { status: "complete", reason: "Outcome is filled with an allowed value." };
  }

  if (fieldName === "decided_at") {
    if (isPendingValue(actualValue)) return { status: "pending", reason: "Decision timestamp is not filled." };
    if (Number.isNaN(Date.parse(String(actualValue)))) return { status: "invalid", reason: "Decision timestamp must be ISO 8601 parseable." };
    return { status: "complete", reason: "Decision timestamp is parseable." };
  }

  if (isPendingValue(actualValue)) return { status: "pending", reason: "Prompted field is empty, pending, or still a placeholder." };
  return { status: "complete", reason: "Prompted field has a manual value." };
}

function deriveVerificationItemStatus(item, receiptFile, receiptRow, fieldResults) {
  if (item.completion_status === "blocked" || !item.receipt_row_present || !receiptFile.ok || !receiptRow) return "blocked";
  if (item.completion_status === "attention" || fieldResults.some((field) => field.field_status === "invalid")) return "attention";
  if (fieldResults.some((field) => field.field_status === "pending")) return "pending_human_input";
  if (fieldResults.length > 0) return "ready_for_validation";
  return "clear";
}

function buildActorVerifications(actorCompletionPacks, verificationItems, outputDir) {
  const sourceByActor = new Map((actorCompletionPacks ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(verificationItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const sourceActor = sourceByActor.get(requiredActor);
      return {
        actor_verification_id: `human-review-cycle-receipt-completion-verification.actor.${slugify(requiredActor)}`,
        actor_completion_pack_id: sourceActor?.actor_completion_pack_id ?? null,
        required_actor: requiredActor,
        verification_status: deriveActorVerificationStatus(items),
        priority: highestPriority(items),
        verification_item_count: items.length,
        pending_human_input_count: items.filter((item) => item.verification_status === "pending_human_input").length,
        ready_for_validation_count: items.filter((item) => item.verification_status === "ready_for_validation").length,
        attention_count: items.filter((item) => item.verification_status === "attention").length,
        blocked_count: items.filter((item) => item.verification_status === "blocked").length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        receipt_row_count: items.filter((item) => item.receipt_row_present).length,
        missing_receipt_row_count: items.filter((item) => !item.receipt_row_present).length,
        field_prompt_count: sum(items.map((item) => item.field_prompt_count)),
        completed_prompt_count: sum(items.map((item) => item.completed_prompt_count)),
        pending_prompt_count: sum(items.map((item) => item.pending_prompt_count)),
        invalid_prompt_count: sum(items.map((item) => item.invalid_prompt_count)),
        verification_item_ids: items.map((item) => item.verification_item_id),
        verification_json_path: path.join(outputDir, "actors", requiredActor, "completion-verification.json"),
        verification_markdown_path: path.join(outputDir, "actors", requiredActor, "completion-verification.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          verification_only: true,
          protected_actions_executed: false,
          receipt_edits_must_be_manual: true,
        },
      };
    })
    .sort(compareActorVerifications);
}

function validateCompletionVerification({ source, completionPackResult, actorVerifications, verificationItems }) {
  const errors = [];
  if (!source.available) errors.push({ path: "sources.human_review_cycle_receipt_completion_pack", message: `Human Review Cycle Receipt Completion Pack unavailable: ${source.error}` });
  const expectedItemCount = completionPackResult.value?.summary?.completion_item_count ?? 0;
  const expectedActorCount = completionPackResult.value?.summary?.actor_completion_pack_count ?? 0;
  if (expectedItemCount > 0 && verificationItems.length !== expectedItemCount) {
    errors.push({ path: "verification_items", message: "Verification item count must match completion pack item count." });
  }
  if (expectedActorCount > 0 && actorVerifications.length !== expectedActorCount) {
    errors.push({ path: "actor_verifications", message: "Actor verification count must match actor completion pack count." });
  }
  for (const item of verificationItems) {
    if (!item.target_file_available) {
      errors.push({ path: `verification_items.${item.verification_item_id}.target_file_available`, message: "Target receipt input file must be readable for completion verification." });
    }
    if (!item.receipt_row_present) {
      errors.push({ path: `verification_items.${item.verification_item_id}.receipt_row_present`, message: "Target receipt row must exist for completion verification." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `verification_items.${item.verification_item_id}.safe_handling`, message: "Receipt completion verification must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCompletionVerification(actorVerifications, verificationItems, source, completionPackResult, validation) {
  return {
    verification_status: deriveVerificationStatus(validation, verificationItems),
    source_available: source.available,
    source_completion_status: completionPackResult.value?.completion_status ?? null,
    source_completion_item_count: completionPackResult.value?.summary?.completion_item_count ?? 0,
    source_actor_completion_pack_count: completionPackResult.value?.summary?.actor_completion_pack_count ?? 0,
    actor_verification_count: actorVerifications.length,
    verification_item_count: verificationItems.length,
    pending_human_input_count: verificationItems.filter((item) => item.verification_status === "pending_human_input").length,
    ready_for_validation_count: verificationItems.filter((item) => item.verification_status === "ready_for_validation").length,
    attention_count: verificationItems.filter((item) => item.verification_status === "attention").length,
    blocked_count: verificationItems.filter((item) => item.verification_status === "blocked").length,
    target_file_count: new Set(verificationItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    receipt_row_count: verificationItems.filter((item) => item.receipt_row_present).length,
    missing_receipt_row_count: verificationItems.filter((item) => !item.receipt_row_present).length,
    field_prompt_count: sum(verificationItems.map((item) => item.field_prompt_count)),
    completed_prompt_count: sum(verificationItems.map((item) => item.completed_prompt_count)),
    pending_prompt_count: sum(verificationItems.map((item) => item.pending_prompt_count)),
    invalid_prompt_count: sum(verificationItems.map((item) => item.invalid_prompt_count)),
    protected_action_count: verificationItems.filter((item) => item.protected_action).length,
    evidence_decision_count: verificationItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(verificationItems, "required_actor"),
    by_gate_type: countBy(verificationItems, "gate_type"),
    by_verification_status: countBy(verificationItems, "verification_status"),
    by_priority: countBy(verificationItems, "priority"),
  };
}

function deriveVerificationStatus(validation, verificationItems) {
  if (!validation.valid) return "blocked";
  if (verificationItems.some((item) => item.verification_status === "blocked")) return "blocked";
  if (verificationItems.some((item) => item.verification_status === "attention")) return "attention";
  if (verificationItems.some((item) => item.verification_status === "pending_human_input")) return "pending_human_input";
  if (verificationItems.some((item) => item.verification_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveActorVerificationStatus(items) {
  if (items.some((item) => item.verification_status === "blocked")) return "blocked";
  if (items.some((item) => item.verification_status === "attention")) return "attention";
  if (items.some((item) => item.verification_status === "pending_human_input")) return "pending_human_input";
  if (items.some((item) => item.verification_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function buildManualNextAction(status) {
  if (status === "pending_human_input") return "Open the actor completion template, fill the target receipt input manually, then rerun this verification.";
  if (status === "ready_for_validation") return "Rerun correction merge, correction validation, and receipt field audit before applying receipts.";
  if (status === "attention") return "Inspect invalid receipt values before rerunning completion verification.";
  if (status === "blocked") return "Regenerate the completion pack or repair missing target receipt files and rows.";
  return "No action required.";
}

function buildVerificationNextActions(status) {
  if (status === "pending_human_input") return ["open_actor_completion_template", "manually_fill_target_receipt_input", "rerun_completion_verification"];
  if (status === "ready_for_validation") return ["rerun_correction_merge", "rerun_correction_validation", "rerun_receipt_field_audit"];
  if (status === "attention") return ["inspect_completion_verification_item", "repair_invalid_receipt_values", "rerun_completion_verification"];
  if (status === "blocked") return ["regenerate_completion_pack", "regenerate_field_audit", "rerun_completion_verification"];
  return ["no_action_required"];
}

async function readReceiptInput(filePath, cache) {
  if (!filePath) return { ok: false, value: null, error: "missing_target_receipt_input_path" };
  const resolvedPath = path.resolve(filePath);
  if (!cache.has(resolvedPath)) cache.set(resolvedPath, readJsonOrError(resolvedPath));
  return cache.get(resolvedPath);
}

function findReceiptRow(receipts, item) {
  return receipts.find((receipt) => receipt.receipt_id === item.receipt_id)
    ?? receipts.find((receipt) => receipt.gate_item_id === item.gate_item_id)
    ?? null;
}

function renderCompletionVerificationMarkdown(verification) {
  const lines = [
    "# Human Review Cycle Receipt Completion Verification",
    "",
    `- Verification status: ${verification.verification_status}`,
    `- Actor verifications: ${verification.summary.actor_verification_count}`,
    `- Verification items: ${verification.summary.verification_item_count}`,
    `- Pending human input: ${verification.summary.pending_human_input_count}`,
    `- Ready for validation: ${verification.summary.ready_for_validation_count}`,
    `- Pending prompt fields: ${verification.summary.pending_prompt_count}`,
    `- Validation errors: ${verification.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is verification-only.",
    "- It reads target receipt inputs but does not edit them.",
    "- It does not apply receipts or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of verification.actor_verifications) {
    lines.push(`- ${actor.required_actor}: ${actor.verification_item_count} item(s), ${actor.pending_prompt_count} pending prompt field(s), ${actor.verification_markdown_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorCompletionVerificationMarkdown(actor, items) {
  const lines = [
    `# Human Review Receipt Completion Verification: ${actor.required_actor}`,
    "",
    `- Verification status: ${actor.verification_status}`,
    `- Verification items: ${actor.verification_item_count}`,
    `- Pending human input: ${actor.pending_human_input_count}`,
    `- Ready for validation: ${actor.ready_for_validation_count}`,
    `- Pending prompt fields: ${actor.pending_prompt_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.verification_rank}. ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Verification status: ${item.verification_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Prompt fields: ${item.field_prompt_count}`);
    lines.push(`- Pending prompt fields: ${item.pending_prompt_count}`);
    lines.push(`- Invalid prompt fields: ${item.invalid_prompt_count}`);
    lines.push(`- Next action: ${item.manual_next_action}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function serializableCompletionVerification(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    verification_id: result.verification_id,
    output_dir: result.output_dir,
    verification_status: result.verification_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_verifications: result.actor_verifications,
    verification_items: result.verification_items,
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

function compareVerificationItems(a, b) {
  return (STATUS_ORDER[a.verification_status] ?? 99) - (STATUS_ORDER[b.verification_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorVerifications(a, b) {
  return (STATUS_ORDER[a.verification_status] ?? 99) - (STATUS_ORDER[b.verification_status] ?? 99)
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

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function isPendingValue(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0 || value.some((item) => isPendingValue(item));
  const normalized = String(value).trim();
  return PENDING_STRING_VALUES.has(normalized.toLowerCase()) || isPlaceholder(normalized);
}

function isPlaceholder(value) {
  const normalized = String(value ?? "").trim();
  return normalized.startsWith("<") && normalized.endsWith(">");
}

function normalizeReceiptValue(value) {
  if (value === undefined) return null;
  return value;
}

function previewValue(value) {
  if (value === undefined) return null;
  const serialized = JSON.stringify(value);
  if (!serialized) return "";
  return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
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
    else if (arg === "--completion-pack") args.completionPackPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-verification.mjs [options]

Options:
  --completion-pack <path>   Human Review Cycle Receipt Completion Pack artifact
  --out-dir <dir>            Output directory
  --run-at <iso>             Override generated_at
  --check                    Exit non-zero when structural validation fails
`);
}
