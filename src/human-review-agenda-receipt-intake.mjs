import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_OUT_DIR = "artifacts/human-review-agenda-receipt-intake/latest";
export const DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_AGENDA_PATH = "artifacts/human-review-agenda/latest/human-review-agenda.json";
export const DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_DRAFTS_PATH = "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json";

const APPLY_RECEIPT_STATUSES = new Set(["resolved", "deferred", "rejected", "failed", "cancelled"]);

export async function runHumanReviewAgendaReceiptIntake(options = {}) {
  const result = await buildHumanReviewAgendaReceiptIntake(options);
  if (options.write !== false) await writeHumanReviewAgendaReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review agenda receipt intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewAgendaReceiptIntake(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const agendaPath = path.resolve(options.agendaPath ?? DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_AGENDA_PATH);
  const receiptDraftsPath = path.resolve(options.receiptDraftsPath ?? DEFAULT_HUMAN_REVIEW_AGENDA_RECEIPT_INTAKE_DRAFTS_PATH);
  const agendaResult = await readJsonOrError(agendaPath);
  const receiptDraftsResult = await readJsonOrError(receiptDraftsPath);
  const requirements = receiptDraftsResult.value?.receipt_requirements ?? [];
  const templateRows = agendaResult.value?.decision_template?.receipts ?? [];
  const intakeItems = buildIntakeItems(requirements, templateRows, generatedAt);
  const validation = validateIntake({ agendaResult, receiptDraftsResult, requirements, templateRows, intakeItems });
  const receiptInput = buildReceiptInput(generatedAt, receiptDraftsResult.value, intakeItems);
  const intake = {
    schema_version: "human-review-agenda-receipt-intake.v1",
    generated_at: generatedAt,
    intake_id: `human-review-agenda-receipt-intake.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    intake_status: deriveIntakeStatus(validation, intakeItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      validates_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_agenda", "Human Review Agenda", agendaPath, agendaResult),
      buildSource("control_plane_human_gate_receipts", "Human Gate Receipt Drafts", receiptDraftsPath, receiptDraftsResult),
    ],
    summary: summarizeIntake(intakeItems, validation),
    intake_items: intakeItems,
    receipt_input: receiptInput,
    validation,
  };

  return {
    ...intake,
    markdown: renderIntakeMarkdown(intake),
  };
}

export async function writeHumanReviewAgendaReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-agenda-receipt-intake.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    intake_id: result.intake_id,
    output_dir: result.output_dir,
    intake_status: result.intake_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    intake_items: result.intake_items,
    receipt_input: result.receipt_input,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "receipt-input.json"), result.receipt_input);
  await writeJson(path.join(outDir, "receipt-intake-items.json"), {
    generated_at: result.generated_at,
    count: result.intake_items.length,
    intake_items: result.intake_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewAgendaReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewAgendaReceiptIntake(args);
    console.log(`Human review agenda receipt intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Intake status: ${result.intake_status}`);
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

function buildIntakeItems(requirements, templateRows, generatedAt) {
  const templateByGate = new Map(templateRows.map((row) => [row.gate_item_id, row]));
  const items = requirements.map((requirement) => {
    const templateRow = templateByGate.get(requirement.gate_item_id);
    const receipt = mergeReceipt(requirement.receipt_form_draft, templateRow, generatedAt);
    const errors = validateTemplateRow(requirement, templateRow, receipt);
    return {
      intake_item_id: `human-review-agenda-receipt-intake.${slugify(requirement.gate_item_id)}`,
      receipt_requirement_id: requirement.receipt_requirement_id,
      gate_item_id: requirement.gate_item_id,
      source_plan_item_id: requirement.source_plan_item_id,
      source_stage: requirement.source_stage,
      gate_type: requirement.gate_type,
      priority: requirement.priority,
      required_actor: requirement.required_actor,
      requires_human: requirement.requires_human,
      protected_action: requirement.protected_action,
      receipt_id: receipt?.receipt_id ?? requirement.receipt_form_draft?.receipt_id ?? null,
      receipt_status: normalizeReceiptStatus(receipt?.receipt_status),
      outcome: normalizeOutcome(receipt?.outcome),
      intake_status: deriveItemStatus(templateRow, receipt, errors),
      ready_for_validation: deriveItemStatus(templateRow, receipt, errors) === "ready_for_validation",
      template_row_present: Boolean(templateRow),
      error_count: errors.length,
      errors,
      receipt,
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
      },
    };
  });

  const requirementGateIds = new Set(requirements.map((requirement) => requirement.gate_item_id));
  for (const row of templateRows) {
    if (requirementGateIds.has(row.gate_item_id)) continue;
    items.push(unknownTemplateRowItem(row, generatedAt));
  }
  return items;
}

function mergeReceipt(draft, templateRow, generatedAt) {
  if (!draft && !templateRow) return null;
  return {
    ...(draft ?? {}),
    receipt_id: templateRow?.receipt_id ?? draft?.receipt_id ?? null,
    gate_item_id: templateRow?.gate_item_id ?? draft?.gate_item_id ?? null,
    source_plan_item_id: draft?.source_plan_item_id ?? templateRow?.source_plan_item_id ?? null,
    gate_type: templateRow?.gate_type ?? draft?.gate_type ?? null,
    receipt_status: templateRow?.receipt_status ?? draft?.receipt_status ?? "pending",
    outcome: templateRow?.outcome ?? draft?.outcome ?? "pending",
    decided_by: templateRow?.decided_by ?? draft?.decided_by ?? "",
    decided_at: templateRow?.decided_at ?? draft?.decided_at ?? "",
    reviewer: templateRow?.reviewer ?? draft?.reviewer ?? null,
    decision_reference: templateRow?.decision_reference ?? draft?.decision_reference ?? "",
    decision_notes: templateRow?.decision_notes ?? draft?.decision_notes ?? "",
    protected_action_reference: templateRow?.protected_action_reference ?? draft?.protected_action_reference ?? null,
    command_result: templateRow?.command_result ?? draft?.command_result ?? null,
    commands_run: templateRow?.commands_run ?? draft?.commands_run ?? [],
    completed_action_refs: templateRow?.completed_action_refs ?? draft?.completed_action_refs ?? [],
    required_receipt_fields: templateRow?.required_receipt_fields ?? draft?.required_receipt_fields ?? [],
    generated_at: templateRow?.generated_at ?? draft?.generated_at ?? generatedAt,
  };
}

function validateTemplateRow(requirement, templateRow, receipt) {
  const errors = [];
  if (!templateRow) {
    errors.push({ path: `template_rows.${requirement.gate_item_id}`, message: "Agenda decision template is missing a receipt row for this human gate." });
    return errors;
  }
  if (templateRow.receipt_id !== requirement.receipt_form_draft?.receipt_id) {
    errors.push({ path: `template_rows.${requirement.gate_item_id}.receipt_id`, message: "Agenda receipt row does not match the current receipt draft id." });
  }
  if (normalizeReceiptStatus(receipt.receipt_status) === "pending") return errors;
  if (!APPLY_RECEIPT_STATUSES.has(normalizeReceiptStatus(receipt.receipt_status))) {
    errors.push({ path: `template_rows.${requirement.gate_item_id}.receipt_status`, message: "Receipt status must be pending or an applyable terminal status." });
  }
  if (!requirement.allowed_outcomes?.includes(normalizeOutcome(receipt.outcome))) {
    errors.push({ path: `template_rows.${requirement.gate_item_id}.outcome`, message: `Outcome must be one of ${(requirement.allowed_outcomes ?? []).join(", ")}.` });
  }
  return errors;
}

function unknownTemplateRowItem(row, generatedAt) {
  const receipt = mergeReceipt(null, row, generatedAt);
  const errors = [{ path: `template_rows.${row.gate_item_id ?? "unknown"}`, message: "Agenda decision template contains a row outside the current human gate requirement set." }];
  return {
    intake_item_id: `human-review-agenda-receipt-intake.unknown.${slugify(row.gate_item_id)}`,
    receipt_requirement_id: null,
    gate_item_id: row.gate_item_id ?? "unknown",
    source_plan_item_id: row.source_plan_item_id ?? "unknown",
    source_stage: "unknown",
    gate_type: row.gate_type ?? "unknown",
    priority: "medium",
    required_actor: row.required_actor ?? "unknown",
    requires_human: false,
    protected_action: false,
    receipt_id: row.receipt_id ?? null,
    receipt_status: normalizeReceiptStatus(row.receipt_status),
    outcome: normalizeOutcome(row.outcome),
    intake_status: "unknown_requirement",
    ready_for_validation: false,
    template_row_present: true,
    error_count: errors.length,
    errors,
    receipt,
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
    },
  };
}

function deriveItemStatus(templateRow, receipt, errors) {
  if (errors.length > 0) return templateRow ? "invalid_template_row" : "missing_template_row";
  if (normalizeReceiptStatus(receipt?.receipt_status) === "pending") return "pending_receipt";
  return "ready_for_validation";
}

function validateIntake({ agendaResult, receiptDraftsResult, templateRows, intakeItems }) {
  const errors = [];
  if (!agendaResult.ok) {
    errors.push({ path: "sources.human_review_agenda", message: `Human review agenda unavailable: ${agendaResult.error}` });
  }
  if (!receiptDraftsResult.ok) {
    errors.push({ path: "sources.control_plane_human_gate_receipts", message: `Human gate receipt drafts unavailable: ${receiptDraftsResult.error}` });
  }
  if (agendaResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_agenda.safe_handling.auto_execute_allowed", message: "Agenda receipt intake requires auto execution to remain disabled." });
  }
  for (const item of intakeItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `intake_items.${item.intake_item_id}.safe_handling`, message: "Receipt intake must not execute protected actions." });
    }
    errors.push(...item.errors);
  }
  if (!Array.isArray(templateRows)) {
    errors.push({ path: "decision_template.receipts", message: "Agenda decision template receipts must be an array." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildReceiptInput(generatedAt, receiptDrafts, intakeItems) {
  return {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: receiptDrafts?.receipt_input_draft?.human_gate_id ?? "control-plane-human-gates.unknown",
    instructions: "Generated from Human Review Agenda decision template. Validate this file before applying receipts. It does not execute protected actions.",
    receipts: intakeItems.filter((item) => item.receipt_requirement_id).map((item) => item.receipt),
  };
}

function deriveIntakeStatus(validation, intakeItems) {
  if (!validation.valid) return "blocked";
  if (intakeItems.some((item) => item.ready_for_validation)) return "ready_for_validation";
  if (intakeItems.some((item) => item.intake_status === "pending_receipt")) return "pending_receipts";
  return "clear";
}

function summarizeIntake(intakeItems, validation) {
  return {
    intake_item_count: intakeItems.length,
    receipt_row_count: intakeItems.filter((item) => item.receipt_requirement_id).length,
    pending_receipt_count: intakeItems.filter((item) => item.intake_status === "pending_receipt").length,
    ready_for_validation_count: intakeItems.filter((item) => item.ready_for_validation).length,
    invalid_template_row_count: intakeItems.filter((item) => item.intake_status === "invalid_template_row").length,
    missing_template_row_count: intakeItems.filter((item) => item.intake_status === "missing_template_row").length,
    unknown_requirement_count: intakeItems.filter((item) => item.intake_status === "unknown_requirement").length,
    protected_action_count: intakeItems.filter((item) => item.protected_action).length,
    human_required_count: intakeItems.filter((item) => item.requires_human).length,
    evidence_decision_count: intakeItems.filter((item) => item.gate_type === "evidence_decision").length,
    validation_error_count: validation.errors.length,
    by_intake_status: countBy(intakeItems, "intake_status"),
    by_receipt_status: countBy(intakeItems, "receipt_status"),
    by_gate_type: countBy(intakeItems, "gate_type"),
    by_required_actor: countBy(intakeItems, "required_actor"),
  };
}

function renderIntakeMarkdown(intake) {
  const lines = [];
  lines.push("# Human Review Agenda Receipt Intake");
  lines.push("");
  lines.push(`Generated: ${intake.generated_at}`);
  lines.push(`Intake status: ${intake.intake_status}`);
  lines.push("");
  lines.push(`- Receipt rows: ${intake.summary.receipt_row_count}`);
  lines.push(`- Pending receipts: ${intake.summary.pending_receipt_count}`);
  lines.push(`- Ready for validation: ${intake.summary.ready_for_validation_count}`);
  lines.push(`- Protected actions: ${intake.summary.protected_action_count}`);
  lines.push(`- Validation errors: ${intake.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Items");
  lines.push("");
  for (const item of intake.intake_items) {
    lines.push(`- [${item.priority}] ${item.gate_item_id}: ${item.intake_status} (${item.receipt_status}/${item.outcome})`);
  }
  if (intake.intake_items.length === 0) lines.push("- No intake items.");
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

function normalizeReceiptStatus(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
}

function normalizeOutcome(value) {
  return String(value ?? "pending").trim().toLowerCase() || "pending";
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

function dateStamp(value) {
  return value.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--agenda") parsed.agendaPath = argv[++index];
    else if (arg === "--receipt-drafts") parsed.receiptDraftsPath = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-agenda-receipt-intake.mjs [options]

Options:
  --agenda <path>          human-review-agenda.json path.
  --receipt-drafts <path>  control-plane-human-gate-receipt-drafts.json path.
  --out-dir <path>         Output directory.
  --run-at <iso>           Fixed generation timestamp.
  --check                  Exit non-zero when validation errors are present.
  --help                   Show this help.
`);
}
