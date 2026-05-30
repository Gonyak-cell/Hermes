import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_FIELD_AUDIT_OUT_DIR = "artifacts/human-review-cycle-receipt-field-audit/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_FIELD_AUDIT_INPUTS = {
  reviewerConsolePath: "artifacts/human-review-cycle-reviewer-console/latest/human-review-cycle-reviewer-console.json",
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
  pending_human_review: 2,
  ready_for_validation: 3,
  clear: 4,
};

const PENDING_VALUES = new Set(["", "pending", "not_started", "needs_review", "todo"]);

export async function runHumanReviewCycleReceiptFieldAudit(options = {}) {
  const result = await buildHumanReviewCycleReceiptFieldAudit(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptFieldAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt field audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptFieldAudit(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_FIELD_AUDIT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const reviewerConsolePath = path.resolve(options.reviewerConsolePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_FIELD_AUDIT_INPUTS.reviewerConsolePath);
  const consoleResult = await readJsonOrError(reviewerConsolePath);
  const targetCache = new Map();
  const fieldAuditItems = [];
  for (const item of consoleResult.value?.console_items ?? []) {
    fieldAuditItems.push(await buildFieldAuditItem(item, targetCache));
  }
  const actorFieldAudits = buildActorFieldAudits(consoleResult.value?.actor_consoles ?? [], fieldAuditItems, outputDir);
  const source = buildSource("human_review_cycle_reviewer_console", "Human Review Cycle Reviewer Console", reviewerConsolePath, consoleResult);
  const validation = validateFieldAudit({ source, consoleResult, actorFieldAudits, fieldAuditItems });
  const audit = {
    schema_version: "human-review-cycle-receipt-field-audit.v1",
    generated_at: generatedAt,
    field_audit_id: `human-review-cycle-receipt-field-audit.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    field_audit_status: deriveFieldAuditStatus(validation, fieldAuditItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      audit_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [source],
    summary: summarizeFieldAudit(actorFieldAudits, fieldAuditItems, source, consoleResult, validation),
    actor_field_audits: actorFieldAudits,
    field_audit_items: fieldAuditItems,
    validation,
  };

  return {
    ...audit,
    markdown: renderFieldAuditMarkdown(audit),
  };
}

export async function writeHumanReviewCycleReceiptFieldAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-field-audit.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    field_audit_id: result.field_audit_id,
    output_dir: result.output_dir,
    field_audit_status: result.field_audit_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_field_audits: result.actor_field_audits,
    field_audit_items: result.field_audit_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "field-audit-items.json"), {
    generated_at: result.generated_at,
    count: result.field_audit_items.length,
    field_audit_items: result.field_audit_items,
  });
  await writeJson(path.join(outDir, "actor-field-audits.json"), {
    generated_at: result.generated_at,
    count: result.actor_field_audits.length,
    actor_field_audits: result.actor_field_audits,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_field_audits) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.field_audit_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "field-audit.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      field_audit_status: actor.field_audit_status,
      count: items.length,
      actor_field_audit: actor,
      field_audit_items: items,
    });
    await writeFile(path.join(actorDir, "field-audit.md"), renderActorFieldAuditMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptFieldAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptFieldAudit(args);
    console.log(`Human review cycle receipt field audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Field audit status: ${result.field_audit_status}`);
    console.log(`Actor field audits: ${result.summary.actor_field_audit_count}`);
    console.log(`Field audit items: ${result.summary.field_audit_item_count}`);
    console.log(`Pending human review: ${result.summary.pending_human_review_count}`);
    console.log(`Missing required field values: ${result.summary.missing_required_field_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function buildFieldAuditItem(consoleItem, targetCache) {
  const target = await readReceiptTarget(consoleItem.target_receipt_input_path, targetCache);
  const receipt = target.receipts.find((candidate) => candidate.gate_item_id === consoleItem.gate_item_id || candidate.receipt_id === consoleItem.receipt_id) ?? null;
  const requiredFields = unique([...(consoleItem.required_receipt_fields ?? []), ...(receipt?.required_receipt_fields ?? [])]);
  const missingRequiredFieldKeys = receipt ? requiredFields.filter((field) => !(field in receipt)) : requiredFields;
  const missingRequiredFieldValues = receipt
    ? requiredFields.filter((field) => field in receipt && isEmptyReceiptField(receipt[field]))
    : requiredFields;
  const mismatchFields = [];
  if (receipt && consoleItem.receipt_id && receipt.receipt_id !== consoleItem.receipt_id) mismatchFields.push("receipt_id");
  if (receipt && consoleItem.gate_type && receipt.gate_type !== consoleItem.gate_type) mismatchFields.push("gate_type");
  const pendingReceipt = isPendingReceipt(receipt);
  const terminalReceipt = Boolean(receipt) && !pendingReceipt;
  const fieldAuditStatus = deriveFieldAuditItemStatus({
    target,
    receipt,
    consoleItem,
    missingRequiredFieldKeys,
    missingRequiredFieldValues,
    mismatchFields,
    pendingReceipt,
  });
  return {
    field_audit_item_id: `human-review-cycle-receipt-field-audit.${slugify(consoleItem.gate_item_id)}`,
    console_item_id: consoleItem.console_item_id,
    triage_item_id: consoleItem.triage_item_id,
    gate_item_id: consoleItem.gate_item_id,
    receipt_id: consoleItem.receipt_id,
    required_actor: consoleItem.required_actor,
    gate_type: consoleItem.gate_type,
    priority: consoleItem.priority,
    console_status: consoleItem.console_status,
    field_audit_status: fieldAuditStatus,
    protected_action: Boolean(consoleItem.protected_action),
    evidence_decision: Boolean(consoleItem.evidence_decision),
    target_receipt_input_path: consoleItem.target_receipt_input_path,
    target_file_available: target.available,
    target_file_error: target.error,
    receipt_row_present: Boolean(receipt),
    receipt_row_status: receipt?.receipt_status ?? null,
    receipt_row_outcome: receipt?.outcome ?? null,
    pending_receipt: pendingReceipt,
    terminal_receipt: terminalReceipt,
    required_receipt_fields: requiredFields,
    missing_required_field_keys: missingRequiredFieldKeys,
    missing_required_field_values: missingRequiredFieldValues,
    completed_required_fields: requiredFields.filter((field) => receipt && field in receipt && !isEmptyReceiptField(receipt[field])),
    missing_required_field_count: missingRequiredFieldValues.length,
    field_completion_ratio: requiredFields.length === 0 ? 1 : roundRatio((requiredFields.length - missingRequiredFieldValues.length) / requiredFields.length),
    mismatch_fields: mismatchFields,
    allowed_outcomes: consoleItem.allowed_outcomes ?? [],
    title: consoleItem.title,
    reason: consoleItem.reason,
    manual_next_action: buildManualNextAction(fieldAuditStatus),
    next_actions: buildFieldAuditNextActions(fieldAuditStatus),
    source_refs: {
      console_item_id: consoleItem.console_item_id,
      context_card_id: consoleItem.context_card_id,
      decision_row_id: consoleItem.decision_row_id,
      target_receipt_input_path: consoleItem.target_receipt_input_path,
    },
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      audit_only: true,
      receipt_edits_must_be_manual: true,
    },
  };
}

function buildActorFieldAudits(actorConsoles, fieldAuditItems, outputDir) {
  const consoleByActor = new Map((actorConsoles ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(fieldAuditItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const actorConsole = consoleByActor.get(requiredActor);
      return {
        actor_field_audit_id: `human-review-cycle-receipt-field-audit.actor.${slugify(requiredActor)}`,
        actor_console_id: actorConsole?.actor_console_id ?? null,
        required_actor: requiredActor,
        field_audit_status: deriveActorFieldAuditStatus(items),
        priority: highestPriority(items),
        field_audit_item_count: items.length,
        pending_human_review_count: items.filter((item) => item.field_audit_status === "pending_human_review").length,
        ready_for_validation_count: items.filter((item) => item.field_audit_status === "ready_for_validation").length,
        attention_count: items.filter((item) => item.field_audit_status === "attention").length,
        blocked_count: items.filter((item) => item.field_audit_status === "blocked").length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        receipt_row_count: items.filter((item) => item.receipt_row_present).length,
        missing_required_field_count: sum(items.map((item) => item.missing_required_field_count)),
        terminal_receipt_count: items.filter((item) => item.terminal_receipt).length,
        pending_receipt_count: items.filter((item) => item.pending_receipt).length,
        top_field_audit_item_ids: items.slice(0, 8).map((item) => item.field_audit_item_id),
        field_audit_json_path: path.join(outputDir, "actors", requiredActor, "field-audit.json"),
        field_audit_markdown_path: path.join(outputDir, "actors", requiredActor, "field-audit.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          audit_only: true,
          protected_actions_executed: false,
          receipt_edits_must_be_manual: true,
        },
      };
    })
    .sort(compareActorFieldAudits);
}

function validateFieldAudit({ source, consoleResult, actorFieldAudits, fieldAuditItems }) {
  const errors = [];
  if (!source.available) errors.push({ path: "sources.human_review_cycle_reviewer_console", message: `Human Review Cycle Reviewer Console unavailable: ${source.error}` });
  const expectedItemCount = consoleResult.value?.summary?.console_item_count ?? 0;
  const expectedActorCount = consoleResult.value?.summary?.actor_console_count ?? 0;
  if (expectedItemCount > 0 && fieldAuditItems.length !== expectedItemCount) {
    errors.push({ path: "field_audit_items", message: "Field audit item count must match console item count." });
  }
  if (expectedActorCount > 0 && actorFieldAudits.length !== expectedActorCount) {
    errors.push({ path: "actor_field_audits", message: "Actor field audit count must match actor console count." });
  }
  for (const item of fieldAuditItems) {
    if (!item.target_file_available) {
      errors.push({ path: `field_audit_items.${item.field_audit_item_id}.target_receipt_input_path`, message: "Target receipt input file is unavailable." });
    }
    if (!item.receipt_row_present) {
      errors.push({ path: `field_audit_items.${item.field_audit_item_id}.receipt_row`, message: "Target receipt row is unavailable." });
    }
    if (item.missing_required_field_keys.length > 0) {
      errors.push({ path: `field_audit_items.${item.field_audit_item_id}.required_receipt_fields`, message: "Target receipt row is missing required field keys." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `field_audit_items.${item.field_audit_item_id}.safe_handling`, message: "Receipt field audit must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFieldAudit(actorFieldAudits, fieldAuditItems, source, consoleResult, validation) {
  return {
    field_audit_status: deriveFieldAuditStatus(validation, fieldAuditItems),
    source_available: source.available,
    source_console_status: consoleResult.value?.console_status ?? null,
    source_console_item_count: consoleResult.value?.summary?.console_item_count ?? 0,
    source_actor_console_count: consoleResult.value?.summary?.actor_console_count ?? 0,
    actor_field_audit_count: actorFieldAudits.length,
    field_audit_item_count: fieldAuditItems.length,
    pending_human_review_count: fieldAuditItems.filter((item) => item.field_audit_status === "pending_human_review").length,
    ready_for_validation_count: fieldAuditItems.filter((item) => item.field_audit_status === "ready_for_validation").length,
    attention_count: fieldAuditItems.filter((item) => item.field_audit_status === "attention").length,
    blocked_count: fieldAuditItems.filter((item) => item.field_audit_status === "blocked").length,
    target_file_count: new Set(fieldAuditItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    receipt_row_count: fieldAuditItems.filter((item) => item.receipt_row_present).length,
    missing_receipt_row_count: fieldAuditItems.filter((item) => !item.receipt_row_present).length,
    missing_required_field_count: sum(fieldAuditItems.map((item) => item.missing_required_field_count)),
    missing_required_field_item_count: fieldAuditItems.filter((item) => item.missing_required_field_count > 0).length,
    missing_required_field_key_count: sum(fieldAuditItems.map((item) => item.missing_required_field_keys.length)),
    terminal_receipt_count: fieldAuditItems.filter((item) => item.terminal_receipt).length,
    pending_receipt_count: fieldAuditItems.filter((item) => item.pending_receipt).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(fieldAuditItems, "required_actor"),
    by_gate_type: countBy(fieldAuditItems, "gate_type"),
    by_field_audit_status: countBy(fieldAuditItems, "field_audit_status"),
    by_priority: countBy(fieldAuditItems, "priority"),
  };
}

function deriveFieldAuditStatus(validation, fieldAuditItems) {
  if (!validation.valid) return "blocked";
  if (fieldAuditItems.some((item) => item.field_audit_status === "blocked")) return "blocked";
  if (fieldAuditItems.some((item) => item.field_audit_status === "attention")) return "attention";
  if (fieldAuditItems.some((item) => item.field_audit_status === "pending_human_review")) return "pending_human_review";
  if (fieldAuditItems.some((item) => item.field_audit_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveActorFieldAuditStatus(items) {
  if (items.some((item) => item.field_audit_status === "blocked")) return "blocked";
  if (items.some((item) => item.field_audit_status === "attention")) return "attention";
  if (items.some((item) => item.field_audit_status === "pending_human_review")) return "pending_human_review";
  if (items.some((item) => item.field_audit_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveFieldAuditItemStatus({ target, receipt, consoleItem, missingRequiredFieldKeys, missingRequiredFieldValues, mismatchFields, pendingReceipt }) {
  if (!target.available || !receipt || consoleItem.console_status === "blocked") return "blocked";
  if (consoleItem.console_status === "attention" || missingRequiredFieldKeys.length > 0 || mismatchFields.length > 0) return "attention";
  if (pendingReceipt) return "pending_human_review";
  if (missingRequiredFieldValues.length > 0) return "attention";
  return "ready_for_validation";
}

function buildManualNextAction(status) {
  if (status === "pending_human_review") return "Open the target receipt input, complete the missing required field values manually, then rerun the correction merge/validation cycle.";
  if (status === "ready_for_validation") return "Rerun receipt merge and validation before applying any receipt.";
  if (status === "attention") return "Inspect the target receipt row because it is terminal but incomplete or has mismatched metadata.";
  if (status === "blocked") return "Regenerate the reviewer console or correction workspace so the target receipt input and row exist.";
  return "No action required.";
}

function buildFieldAuditNextActions(status) {
  if (status === "pending_human_review") return ["open_target_receipt_input", "complete_missing_required_field_values", "rerun_review_cycle_after_decision"];
  if (status === "ready_for_validation") return ["rerun_correction_merge", "rerun_correction_validation", "rerun_receipt_field_audit"];
  if (status === "attention") return ["inspect_receipt_field_audit_item", "repair_terminal_receipt_fields", "rerun_receipt_field_audit"];
  if (status === "blocked") return ["regenerate_reviewer_console", "regenerate_correction_workspace", "rerun_receipt_field_audit"];
  return ["no_action_required"];
}

function isPendingReceipt(receipt) {
  if (!receipt) return false;
  const receiptStatus = normalizePendingValue(receipt.receipt_status);
  const outcome = normalizePendingValue(receipt.outcome);
  return PENDING_VALUES.has(receiptStatus) || PENDING_VALUES.has(outcome);
}

function normalizePendingValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isEmptyReceiptField(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

async function readReceiptTarget(filePath, cache) {
  if (!filePath) return { available: false, error: "missing_path", receipts: [] };
  if (cache.has(filePath)) return cache.get(filePath);
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    const result = { available: true, error: null, receipts: value.receipts ?? [], value };
    cache.set(filePath, result);
    return result;
  } catch (error) {
    const result = { available: false, error: error.code === "ENOENT" ? "not_found" : error.message, receipts: [] };
    cache.set(filePath, result);
    return result;
  }
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

function renderFieldAuditMarkdown(audit) {
  const lines = [
    "# Human Review Cycle Receipt Field Audit",
    "",
    `- Field audit status: ${audit.field_audit_status}`,
    `- Actor field audits: ${audit.summary.actor_field_audit_count}`,
    `- Field audit items: ${audit.summary.field_audit_item_count}`,
    `- Pending human review: ${audit.summary.pending_human_review_count}`,
    `- Ready for validation: ${audit.summary.ready_for_validation_count}`,
    `- Missing required field values: ${audit.summary.missing_required_field_count}`,
    `- Validation errors: ${audit.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is audit-only.",
    "- It reads target receipt inputs and does not edit or apply receipts.",
    "- Missing human decision fields stay pending until a human reviewer fills them.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of audit.actor_field_audits) {
    lines.push(`- ${actor.required_actor}: ${actor.field_audit_item_count} item(s), ${actor.pending_human_review_count} pending, ${actor.missing_required_field_count} missing field value(s), ${actor.field_audit_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorFieldAuditMarkdown(actor, items) {
  const lines = [
    `# Human Review Receipt Field Audit: ${actor.required_actor}`,
    "",
    `- Field audit status: ${actor.field_audit_status}`,
    `- Field audit items: ${actor.field_audit_item_count}`,
    `- Pending human review: ${actor.pending_human_review_count}`,
    `- Ready for validation: ${actor.ready_for_validation_count}`,
    `- Attention: ${actor.attention_count}`,
    `- Blocked: ${actor.blocked_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Field audit status: ${item.field_audit_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Receipt row status: ${item.receipt_row_status ?? "missing"}`);
    lines.push(`- Outcome: ${item.receipt_row_outcome ?? "missing"}`);
    lines.push(`- Missing field values: ${item.missing_required_field_values.join(", ") || "none"}`);
    lines.push(`- Completed fields: ${item.completed_required_fields.join(", ") || "none"}`);
    lines.push(`- Next action: ${item.manual_next_action}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function compareActorFieldAudits(a, b) {
  return (STATUS_ORDER[a.field_audit_status] ?? 99) - (STATUS_ORDER[b.field_audit_status] ?? 99)
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

function roundRatio(value) {
  return Math.round(value * 1000) / 1000;
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
    else if (arg === "--console") args.reviewerConsolePath = argv[++index];
    else if (arg === "--reviewer-console") args.reviewerConsolePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-field-audit.mjs [options]

Options:
  --console <path>            Human Review Cycle Reviewer Console artifact
  --out-dir <dir>             Output directory
  --run-at <iso>              Override generated_at
  --check                     Exit non-zero when validation fails
`);
}
