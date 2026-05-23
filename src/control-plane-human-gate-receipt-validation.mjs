import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_OUT_DIR = "artifacts/control-plane-human-gate-receipt-validation/latest";
export const DEFAULT_HUMAN_GATE_RECEIPT_DRAFTS_PATH = "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json";
export const DEFAULT_HUMAN_GATE_RECEIPT_INPUT_PATH = "artifacts/control-plane-human-gate-receipts/latest/receipt-input-draft.json";

const APPLY_RECEIPT_STATUSES = new Set(["resolved", "deferred", "rejected", "failed", "cancelled"]);
const COMMAND_RESULTS = new Set(["passed", "failed", "skipped", "not_applicable"]);

export async function runControlPlaneHumanGateReceiptValidation(options = {}) {
  const result = await buildControlPlaneHumanGateReceiptValidation(options);
  if (options.write !== false) await writeControlPlaneHumanGateReceiptValidation(result, result.output_dir);
  return result;
}

export async function buildControlPlaneHumanGateReceiptValidation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const receiptDraftsPath = path.resolve(options.receiptDraftsPath ?? DEFAULT_HUMAN_GATE_RECEIPT_DRAFTS_PATH);
  const receiptInputPath = path.resolve(options.receiptInputPath ?? DEFAULT_HUMAN_GATE_RECEIPT_INPUT_PATH);
  const receiptDraftsResult = await readJsonOrError(receiptDraftsPath);
  const receiptInputResult = await readJsonOrError(receiptInputPath);
  const requirements = receiptDraftsResult.value?.receipt_requirements ?? [];
  const receipts = receiptInputResult.value?.receipts ?? [];
  const requirementByGateItemId = new Map(requirements.map((requirement) => [requirement.gate_item_id, requirement]));
  const receiptByGateItemId = new Map(receipts.map((receipt) => [receipt.gate_item_id, receipt]));
  const validationItems = [];
  const receiptErrors = [];

  for (const requirement of requirements) {
    const receipt = receiptByGateItemId.get(requirement.gate_item_id);
    const item = validateHumanGateReceipt(requirement, receipt);
    validationItems.push(item);
    receiptErrors.push(...item.errors);
  }

  for (const receipt of receipts) {
    if (requirementByGateItemId.has(receipt.gate_item_id)) continue;
    const validationItem = unknownGateValidationItem(receipt);
    validationItems.push(validationItem);
    receiptErrors.push(...validationItem.errors);
  }

  const readyReceipts = validationItems
    .filter((item) => item.ready_to_apply)
    .map((item) => item.receipt);
  const validatedReceiptsToApply = {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: receiptInputResult.value?.human_gate_id ?? receiptDraftsResult.value?.receipt_input_draft?.human_gate_id ?? "control-plane-human-gates.unknown",
    instructions: "Validated human gate receipts ready for a future human gate receipt application stage. This file does not execute protected actions.",
    receipts: readyReceipts,
  };
  const result = {
    schema_version: "control-plane-human-gate-receipt-validation.v1",
    generated_at: generatedAt,
    validation_id: `control-plane-human-gate-receipt-validation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    validation_status: deriveValidationStatus(receiptDraftsResult, receiptInputResult, validationItems, receiptErrors),
    sources: [
      buildSource("human_gate_receipt_drafts", "Human Gate Receipt Drafts", receiptDraftsPath, receiptDraftsResult),
      buildSource("human_gate_receipt_input", "Human Gate Receipt Input", receiptInputPath, receiptInputResult),
    ],
    summary: summarizeValidation(receiptDraftsResult, receiptInputResult, requirements, receipts, validationItems, receiptErrors),
    validation_items: validationItems,
    receipt_errors: receiptErrors,
    validated_receipts_to_apply: validatedReceiptsToApply,
  };

  return {
    ...result,
    markdown: renderValidationMarkdown(result),
  };
}

export async function writeControlPlaneHumanGateReceiptValidation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-human-gate-receipt-validation.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    validation_id: result.validation_id,
    output_dir: result.output_dir,
    validation_status: result.validation_status,
    sources: result.sources,
    summary: result.summary,
    validation_items: result.validation_items,
    receipt_errors: result.receipt_errors,
    validated_receipts_to_apply: result.validated_receipts_to_apply,
  });
  await writeJson(path.join(outDir, "validated-human-gate-receipts.json"), result.validated_receipts_to_apply);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneHumanGateReceiptValidationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneHumanGateReceiptValidation(args);
  console.log(`Control plane human gate receipt validation written to ${result.output_dir}`);
  console.log(`Validation status: ${result.validation_status}`);
  console.log(`Ready to apply: ${result.summary.ready_to_apply_count}`);
  console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
  console.log(`Invalid receipts: ${result.summary.invalid_receipt_count}`);
}

function validateHumanGateReceipt(requirement, receipt) {
  const receiptStatus = normalizeReceiptStatus(receipt?.receipt_status);
  const outcome = normalizeOutcome(receipt?.outcome);
  const errors = [];
  if (!receipt) {
    errors.push(error(requirement.gate_item_id, "gate_item_id", "Missing receipt row for human gate."));
    return buildValidationItem(requirement, null, "missing_receipt", receiptStatus, outcome, errors);
  }
  if (receiptStatus === "pending") {
    return buildValidationItem(requirement, receipt, "pending_receipt", receiptStatus, outcome, errors);
  }
  if (!APPLY_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push(error(requirement.gate_item_id, "receipt_status", `Unsupported receipt status: ${receiptStatus}`));
  }
  if (!requirement.allowed_outcomes?.includes(outcome)) {
    errors.push(error(requirement.gate_item_id, "outcome", `Outcome must be one of ${(requirement.allowed_outcomes ?? []).join(", ")}.`));
  }
  for (const field of requirement.required_receipt_fields ?? []) {
    validateRequiredField(requirement, receipt, receiptStatus, field, errors);
  }
  return buildValidationItem(
    requirement,
    receipt,
    errors.length > 0 ? "invalid_receipt" : "ready_to_apply",
    receiptStatus,
    outcome,
    errors,
  );
}

function validateRequiredField(requirement, receipt, receiptStatus, field, errors) {
  if (["completed_action_refs", "commands_run"].includes(field)) {
    if (!Array.isArray(receipt[field])) {
      errors.push(error(requirement.gate_item_id, field, `${field} must be an array.`));
    }
    return;
  }
  if (field === "command_result") {
    if (!COMMAND_RESULTS.has(receipt.command_result)) {
      errors.push(error(requirement.gate_item_id, field, `Command result must be one of ${[...COMMAND_RESULTS].join(", ")} for non-pending receipts.`));
    }
    return;
  }
  if (!receipt[field]) {
    errors.push(error(requirement.gate_item_id, field, `${field} is required for ${receiptStatus} human gate receipts.`));
  }
}

function buildValidationItem(requirement, receipt, validationStatus, receiptStatus, outcome, errors) {
  return {
    validation_item_id: `human-gate-receipt-validation.${slugify(requirement.gate_item_id)}`,
    receipt_requirement_id: requirement.receipt_requirement_id,
    gate_item_id: requirement.gate_item_id,
    source_plan_item_id: requirement.source_plan_item_id,
    gate_type: requirement.gate_type,
    source_stage: requirement.source_stage,
    priority: requirement.priority,
    validation_status: validationStatus,
    receipt_status: receiptStatus,
    outcome,
    ready_to_apply: validationStatus === "ready_to_apply",
    error_count: errors.length,
    requires_human: requirement.requires_human,
    protected_action: requirement.protected_action,
    receipt_required: requirement.receipt_required,
    decision_required: requirement.decision_required,
    allowed_outcomes: requirement.allowed_outcomes ?? [],
    required_receipt_fields: requirement.required_receipt_fields ?? [],
    errors,
    receipt: receipt ?? null,
  };
}

function unknownGateValidationItem(receipt) {
  const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
  const outcome = normalizeOutcome(receipt.outcome);
  const itemError = error(receipt.gate_item_id ?? "unknown", "gate_item_id", "Receipt input references a human gate outside the current requirement set.");
  return {
    validation_item_id: `human-gate-receipt-validation.unknown.${slugify(receipt.gate_item_id)}`,
    receipt_requirement_id: null,
    gate_item_id: receipt.gate_item_id ?? "unknown",
    source_plan_item_id: receipt.source_plan_item_id ?? "unknown",
    gate_type: receipt.gate_type ?? "unknown",
    source_stage: receipt.source_stage ?? "unknown",
    priority: "medium",
    validation_status: "unknown_human_gate",
    receipt_status: receiptStatus,
    outcome,
    ready_to_apply: false,
    error_count: 1,
    requires_human: false,
    protected_action: false,
    receipt_required: false,
    decision_required: false,
    allowed_outcomes: [],
    required_receipt_fields: [],
    errors: [itemError],
    receipt,
  };
}

function deriveValidationStatus(receiptDraftsResult, receiptInputResult, validationItems, receiptErrors) {
  if (!receiptDraftsResult.ok || !receiptInputResult.ok) return "blocked_missing_source";
  if (receiptErrors.length > 0) return "blocked_invalid_receipts";
  if (validationItems.some((item) => item.validation_status === "pending_receipt" || item.validation_status === "missing_receipt")) return "pending_receipts";
  if (validationItems.some((item) => item.ready_to_apply)) return "ready_to_apply";
  return "clear";
}

function summarizeValidation(receiptDraftsResult, receiptInputResult, requirements, receipts, validationItems, receiptErrors) {
  return {
    validation_status: deriveValidationStatus(receiptDraftsResult, receiptInputResult, validationItems, receiptErrors),
    receipt_drafts_available: receiptDraftsResult.ok,
    receipt_input_available: receiptInputResult.ok,
    receipt_requirement_count: requirements.length,
    receipt_count: receipts.length,
    validation_item_count: validationItems.length,
    ready_to_apply_count: validationItems.filter((item) => item.ready_to_apply).length,
    pending_receipt_count: validationItems.filter((item) => item.validation_status === "pending_receipt").length,
    missing_receipt_count: validationItems.filter((item) => item.validation_status === "missing_receipt").length,
    invalid_receipt_count: validationItems.filter((item) => item.validation_status === "invalid_receipt").length,
    unknown_receipt_count: validationItems.filter((item) => item.validation_status === "unknown_human_gate").length,
    error_count: receiptErrors.length,
    protected_ready_count: validationItems.filter((item) => item.ready_to_apply && item.protected_action).length,
    human_ready_count: validationItems.filter((item) => item.ready_to_apply && item.requires_human).length,
    evidence_decision_ready_count: validationItems.filter((item) => item.ready_to_apply && item.gate_type === "evidence_decision").length,
    command_ready_count: validationItems.filter((item) => item.ready_to_apply && (item.receipt?.commands_run ?? []).length > 0).length,
    by_validation_status: countBy(validationItems, "validation_status"),
    by_receipt_status: countBy(validationItems, "receipt_status"),
    by_gate_type: countBy(validationItems, "gate_type"),
    by_source_stage: countBy(validationItems, "source_stage"),
  };
}

function renderValidationMarkdown(result) {
  const lines = [];
  lines.push("# Control Plane Human Gate Receipt Validation");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Validation status: ${result.validation_status}`);
  lines.push("");
  lines.push(`- Validation items: ${result.summary.validation_item_count}`);
  lines.push(`- Ready to apply: ${result.summary.ready_to_apply_count}`);
  lines.push(`- Pending receipts: ${result.summary.pending_receipt_count}`);
  lines.push(`- Invalid receipts: ${result.summary.invalid_receipt_count}`);
  lines.push(`- Errors: ${result.summary.error_count}`);
  lines.push("");
  lines.push("## Items");
  lines.push("");
  for (const item of result.validation_items) {
    lines.push(`- ${item.gate_item_id}: ${item.validation_status} (${item.receipt_status}, ${item.outcome})`);
  }
  if (result.validation_items.length === 0) lines.push("- No validation items.");
  return `${lines.join("\n")}\n`;
}

function normalizeReceiptStatus(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
}

function normalizeOutcome(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
}

function error(gateItemId, field, message) {
  return {
    gate_item_id: gateItemId,
    field,
    message,
  };
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    receiptDraftsPath: DEFAULT_HUMAN_GATE_RECEIPT_DRAFTS_PATH,
    receiptInputPath: DEFAULT_HUMAN_GATE_RECEIPT_INPUT_PATH,
    outDir: DEFAULT_HUMAN_GATE_RECEIPT_VALIDATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--receipt-drafts") parsed.receiptDraftsPath = argv[++index];
    else if (arg === "--receipt-input") parsed.receiptInputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-human-gate-receipt-validation.mjs [options]

Options:
  --receipt-drafts <path>  control-plane-human-gate-receipt-drafts.json path.
  --receipt-input <path>   receipt-input-draft.json or filled receipt input path.
  --out-dir <folder>       Output directory.
  --run-at <iso>           Deterministic generated_at timestamp.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
