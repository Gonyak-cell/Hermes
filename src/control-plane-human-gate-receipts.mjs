import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_GATE_RECEIPTS_SOURCE_PATH = "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json";
export const DEFAULT_HUMAN_GATE_RECEIPTS_OUT_DIR = "artifacts/control-plane-human-gate-receipts/latest";

export async function runControlPlaneHumanGateReceipts(options = {}) {
  const result = await buildControlPlaneHumanGateReceipts(options);
  if (options.write !== false) await writeControlPlaneHumanGateReceipts(result, result.output_dir);
  return result;
}

export async function buildControlPlaneHumanGateReceipts(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_GATE_RECEIPTS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const humanGatesPath = path.resolve(options.humanGatesPath ?? DEFAULT_HUMAN_GATE_RECEIPTS_SOURCE_PATH);
  const humanGatesResult = await readJsonOrError(humanGatesPath);
  const gateItems = humanGatesResult.value?.gate_items ?? [];
  const receiptRequirements = gateItems.map((item) => buildReceiptRequirement(item, generatedAt));
  const receiptInputDraft = buildReceiptInputDraft(generatedAt, humanGatesResult.value, receiptRequirements);
  const result = {
    schema_version: "control-plane-human-gate-receipt-drafts.v1",
    generated_at: generatedAt,
    receipt_draft_id: `control-plane-human-gate-receipts.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    receipt_status: deriveReceiptStatus(humanGatesResult, receiptRequirements),
    sources: [
      buildSource("control_plane_human_gates", "Control Plane Human Gates", humanGatesPath, humanGatesResult),
    ],
    summary: summarizeReceiptDrafts(humanGatesResult, receiptRequirements, receiptInputDraft),
    receipt_requirements: receiptRequirements,
    receipt_input_draft: receiptInputDraft,
  };

  return {
    ...result,
    markdown: renderReceiptDraftsMarkdown(result),
  };
}

export async function writeControlPlaneHumanGateReceipts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-human-gate-receipt-drafts.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    receipt_draft_id: result.receipt_draft_id,
    output_dir: result.output_dir,
    receipt_status: result.receipt_status,
    sources: result.sources,
    summary: result.summary,
    receipt_requirements: result.receipt_requirements,
    receipt_input_draft: result.receipt_input_draft,
  });
  await writeJson(path.join(outDir, "receipt-input-draft.json"), result.receipt_input_draft);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneHumanGateReceiptsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneHumanGateReceipts(args);
  console.log(`Control plane human gate receipt drafts written to ${result.output_dir}`);
  console.log(`Receipt status: ${result.receipt_status}`);
  console.log(`Receipt drafts: ${result.summary.receipt_draft_count}`);
  console.log(`Protected receipts: ${result.summary.protected_receipt_count}`);
}

function buildReceiptRequirement(gateItem, generatedAt) {
  const requiredFields = requiredFieldsForGate(gateItem);
  return {
    receipt_requirement_id: `human-gate-receipt-requirement.${slugify(gateItem.gate_item_id)}`,
    gate_item_id: gateItem.gate_item_id,
    source_plan_item_id: gateItem.source_plan_item_id,
    source_stage: gateItem.source_stage,
    gate_type: gateItem.gate_type,
    priority: gateItem.priority,
    gate_status: gateItem.status,
    subject_ref: gateItem.subject_ref,
    requires_human: gateItem.requires_human,
    protected_action: gateItem.protected_action,
    required_actor: gateItem.safe_handling?.required_actor ?? "human_reviewer",
    receipt_required: Boolean(gateItem.safe_handling?.receipt_required),
    decision_required: Boolean(gateItem.safe_handling?.decision_required),
    allowed_outcomes: allowedOutcomesForGate(gateItem.gate_type),
    required_receipt_fields: requiredFields,
    acceptance_criteria: acceptanceCriteriaForGate(gateItem),
    next_commands: gateItem.next_commands ?? [],
    receipt_form_draft: buildReceiptFormDraft(gateItem, requiredFields, generatedAt),
  };
}

function buildReceiptFormDraft(gateItem, requiredFields, generatedAt) {
  return {
    receipt_id: `human-gate-receipt.${slugify(gateItem.gate_item_id)}`,
    gate_item_id: gateItem.gate_item_id,
    source_plan_item_id: gateItem.source_plan_item_id,
    gate_type: gateItem.gate_type,
    receipt_status: "pending",
    outcome: "pending",
    decided_by: "",
    decided_at: "",
    reviewer: gateItem.requires_human ? "" : null,
    decision_reference: "",
    decision_notes: "",
    protected_action_reference: gateItem.protected_action ? "" : null,
    command_result: gateItem.next_commands?.length > 0 ? "not_run" : null,
    commands_run: gateItem.next_commands ?? [],
    completed_action_refs: [],
    required_receipt_fields: requiredFields,
    generated_at: generatedAt,
  };
}

function buildReceiptInputDraft(generatedAt, humanGateArtifact, requirements) {
  return {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: humanGateArtifact?.human_gate_id ?? "control-plane-human-gates.unknown",
    instructions: "Fill one receipt row after a human decision, protected delivery, merge, or manual closeout. Pending rows do not close gates and do not trigger protected actions.",
    receipts: requirements.map((requirement) => requirement.receipt_form_draft),
  };
}

function requiredFieldsForGate(gateItem) {
  const fields = ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes"];
  if (gateItem.requires_human) fields.push("reviewer");
  if (gateItem.protected_action || gateItem.safe_handling?.receipt_required) fields.push("protected_action_reference");
  if ((gateItem.next_commands ?? []).length > 0) fields.push("command_result", "commands_run");
  fields.push("completed_action_refs");
  return [...new Set(fields)];
}

function allowedOutcomesForGate(gateType) {
  if (gateType === "evidence_decision") return ["approve_evidence", "reject_evidence", "request_reextract", "assign_matter", "defer"];
  if (gateType === "protected_delivery") return ["delivered", "failed", "cancelled", "defer"];
  if (gateType === "merge_review") return ["approve_merge", "request_changes", "reject_merge", "defer"];
  if (gateType === "attorney_review") return ["approve", "request_changes", "reject", "defer"];
  if (gateType === "content_review") return ["approve", "request_changes", "reject", "defer"];
  if (gateType === "closeout_receipt") return ["resolved", "failed", "cancelled", "defer"];
  return ["approve", "request_changes", "reject", "waive_with_reason", "defer"];
}

function acceptanceCriteriaForGate(gateItem) {
  const criteria = [
    "receipt_status is resolved, deferred, rejected, failed, or cancelled for non-pending rows",
    "decided_by and decided_at are filled for non-pending rows",
    "decision_reference points to the approval, evidence decision, delivery receipt, merge review, or manual record",
  ];
  if (gateItem.requires_human) criteria.push("reviewer records the person who made or verified the decision");
  if (gateItem.protected_action || gateItem.safe_handling?.receipt_required) criteria.push("protected_action_reference is filled before closeout");
  if ((gateItem.next_commands ?? []).length > 0) criteria.push("command_result records whether follow-up commands were run after the human decision");
  return [...new Set(criteria)];
}

function deriveReceiptStatus(humanGatesResult, receiptRequirements) {
  if (!humanGatesResult.ok) return "blocked_missing_human_gates";
  if (receiptRequirements.length > 0) return "pending_receipts";
  return "clear";
}

function summarizeReceiptDrafts(humanGatesResult, receiptRequirements, receiptInputDraft) {
  return {
    receipt_status: deriveReceiptStatus(humanGatesResult, receiptRequirements),
    human_gates_available: humanGatesResult.ok,
    source_human_gate_id: humanGatesResult.value?.human_gate_id ?? null,
    source_gate_item_count: humanGatesResult.value?.summary?.gate_item_count ?? 0,
    receipt_requirement_count: receiptRequirements.length,
    receipt_draft_count: receiptInputDraft.receipts.length,
    pending_receipt_count: receiptInputDraft.receipts.filter((receipt) => receipt.receipt_status === "pending").length,
    protected_receipt_count: receiptRequirements.filter((item) => item.protected_action).length,
    human_receipt_count: receiptRequirements.filter((item) => item.requires_human).length,
    evidence_decision_receipt_count: receiptRequirements.filter((item) => item.gate_type === "evidence_decision").length,
    command_receipt_count: receiptRequirements.filter((item) => item.next_commands.length > 0).length,
    required_field_count: receiptRequirements.reduce((total, item) => total + item.required_receipt_fields.length, 0),
    by_gate_type: countBy(receiptRequirements, "gate_type"),
    by_source_stage: countBy(receiptRequirements, "source_stage"),
  };
}

function renderReceiptDraftsMarkdown(result) {
  const lines = [];
  lines.push("# Control Plane Human Gate Receipt Drafts");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Receipt status: ${result.receipt_status}`);
  lines.push("");
  lines.push(`- Receipt requirements: ${result.summary.receipt_requirement_count}`);
  lines.push(`- Receipt drafts: ${result.summary.receipt_draft_count}`);
  lines.push(`- Human receipts: ${result.summary.human_receipt_count}`);
  lines.push(`- Protected receipts: ${result.summary.protected_receipt_count}`);
  lines.push(`- Evidence decision receipts: ${result.summary.evidence_decision_receipt_count}`);
  lines.push(`- Command receipts: ${result.summary.command_receipt_count}`);
  lines.push("");
  lines.push("## Requirements");
  lines.push("");
  for (const requirement of result.receipt_requirements) {
    lines.push(`- [${requirement.priority}] ${requirement.gate_item_id} (${requirement.gate_type})`);
    lines.push(`  - Required actor: ${requirement.required_actor}`);
    lines.push(`  - Allowed outcomes: ${requirement.allowed_outcomes.join(", ")}`);
    lines.push(`  - Required fields: ${requirement.required_receipt_fields.join(", ")}`);
  }
  if (result.receipt_requirements.length === 0) lines.push("- No receipt requirements.");
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
    humanGatesPath: DEFAULT_HUMAN_GATE_RECEIPTS_SOURCE_PATH,
    outDir: DEFAULT_HUMAN_GATE_RECEIPTS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--human-gates") parsed.humanGatesPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-human-gate-receipts.mjs [options]

Options:
  --human-gates <path>  control-plane-human-gates.json path.
  --out-dir <folder>   Output directory.
  --run-at <iso>       Deterministic generated_at timestamp.
  -h, --help           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
