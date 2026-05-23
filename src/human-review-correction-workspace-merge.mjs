import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_OUT_DIR = "artifacts/human-review-correction-workspace-merge/latest";
export const DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_WORKSPACE_PATH = "artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json";

const APPLY_RECEIPT_STATUSES = new Set(["resolved", "deferred", "rejected", "failed", "cancelled"]);
const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCorrectionWorkspaceMerge(options = {}) {
  const result = await buildHumanReviewCorrectionWorkspaceMerge(options);
  if (options.write !== false) await writeHumanReviewCorrectionWorkspaceMerge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review correction workspace merge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCorrectionWorkspaceMerge(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const workspacePath = path.resolve(options.workspacePath ?? DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_WORKSPACE_PATH);
  const workspaceResult = await readJsonOrError(workspacePath);
  const actorInputs = await readActorInputs(workspaceResult.value?.actor_workspaces ?? []);
  const mergeItems = buildMergeItems(workspaceResult.value, actorInputs);
  const validation = validateMerge({ workspaceResult, actorInputs, mergeItems });
  const receiptInput = buildMergedReceiptInput(generatedAt, workspaceResult.value, mergeItems);
  const merge = {
    schema_version: "human-review-correction-workspace-merge.v1",
    generated_at: generatedAt,
    merge_id: `human-review-correction-workspace-merge.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    merge_status: deriveMergeStatus(validation, mergeItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      merge_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_correction_workspace", "Human Review Correction Workspace", workspacePath, workspaceResult),
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

export async function writeHumanReviewCorrectionWorkspaceMerge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-correction-workspace-merge.json"), {
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

export async function runHumanReviewCorrectionWorkspaceMergeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCorrectionWorkspaceMerge(args);
    console.log(`Human review correction workspace merge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Merge status: ${result.merge_status}`);
    console.log(`Actor inputs: ${result.summary.actor_input_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_row_count}`);
    console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
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
    const result = await readJsonOrError(workspace.receipt_input_path);
    const receipts = result.value?.receipts ?? [];
    return {
      actor_input_id: `human-review-correction-workspace-merge.actor.${slugify(workspace.required_actor)}`,
      actor_correction_workspace_id: workspace.actor_correction_workspace_id,
      required_actor: workspace.required_actor,
      input_path: workspace.receipt_input_path,
      correction_json_path: workspace.correction_json_path,
      available: result.ok,
      expected_receipt_count: workspace.receipt_row_count ?? 0,
      receipt_count: receipts.length,
      pending_receipt_count: receipts.filter((receipt) => normalizeReceiptStatus(receipt.receipt_status) === "pending").length,
      ready_for_validation_count: receipts.filter((receipt) => APPLY_RECEIPT_STATUSES.has(normalizeReceiptStatus(receipt.receipt_status))).length,
      receipt_ids: receipts.map((receipt) => receipt.receipt_id).filter(Boolean),
      errors: result.ok ? [] : [{ path: `actor_inputs.${workspace.required_actor}`, message: `Actor correction receipt input unavailable: ${result.error}` }],
      receipt_input: result.value ?? null,
    };
  }));
}

function buildMergeItems(workspace, actorInputs) {
  const expectedItems = workspace?.correction_items ?? [];
  const expectedByReceipt = new Map(expectedItems.map((item) => [item.receipt_id, item]));
  const actorByReceipt = new Map();
  for (const actorInput of actorInputs) {
    for (const receiptId of actorInput.receipt_ids) {
      if (!actorByReceipt.has(receiptId)) actorByReceipt.set(receiptId, []);
      actorByReceipt.get(receiptId).push(actorInput.required_actor);
    }
  }

  const items = [];
  for (const actorInput of actorInputs) {
    for (const receipt of actorInput.receipt_input?.receipts ?? []) {
      const expected = expectedByReceipt.get(receipt.receipt_id);
      items.push(buildMergeItem({ actorInput, receipt, expected, duplicateActors: actorByReceipt.get(receipt.receipt_id) ?? [] }));
    }
  }

  const seenReceiptIds = new Set(items.map((item) => item.receipt_id).filter(Boolean));
  for (const expected of expectedItems) {
    if (seenReceiptIds.has(expected.receipt_id)) continue;
    items.push(buildMissingMergeItem(expected));
  }

  return items.sort(compareMergeItems);
}

function buildMergeItem({ actorInput, receipt, expected, duplicateActors }) {
  const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
  const outcome = normalizeOutcome(receipt.outcome);
  const errors = [];
  if (!expected) {
    errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.receipt_id`, message: "Actor correction input contains a receipt outside the correction workspace." });
  } else {
    if (expected.required_actor !== actorInput.required_actor) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.required_actor`, message: `Receipt belongs to ${expected.required_actor}, not ${actorInput.required_actor}.` });
    }
    if (expected.gate_item_id !== receipt.gate_item_id) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.gate_item_id`, message: "Receipt gate item does not match the correction item." });
    }
    if (expected.source_plan_item_id !== receipt.source_plan_item_id) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.source_plan_item_id`, message: "Receipt source plan item does not match the correction item." });
    }
    if (expected.gate_type !== receipt.gate_type) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.gate_type`, message: "Receipt gate type does not match the correction item." });
    }
    if (receiptStatus !== "pending" && !expected.allowed_outcomes.includes(outcome)) {
      errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.outcome`, message: "Receipt outcome is not allowed by the correction workspace." });
    }
  }
  if (duplicateActors.length > 1) {
    errors.push({ path: `actor_inputs.${receipt.receipt_id}`, message: `Receipt appears in multiple actor correction inputs: ${duplicateActors.join(", ")}.` });
  }
  if (receiptStatus !== "pending" && !APPLY_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push({ path: `actor_inputs.${actorInput.required_actor}.${receipt.receipt_id}.receipt_status`, message: "Receipt status must be pending or an applicable terminal status before validation." });
  }
  return {
    merge_item_id: `human-review-correction-workspace-merge.${expected ? slugify(expected.gate_item_id) : `unknown.${slugify(receipt.receipt_id)}`}`,
    actor_input_id: actorInput.actor_input_id,
    actor_correction_workspace_id: actorInput.actor_correction_workspace_id,
    required_actor: actorInput.required_actor,
    correction_item_id: expected?.correction_item_id ?? null,
    feedback_item_id: expected?.feedback_item_id ?? null,
    merge_item_source_id: expected?.merge_item_id ?? null,
    validation_item_id: expected?.validation_item_id ?? null,
    decision_row_id: expected?.decision_row_id ?? null,
    context_card_id: expected?.context_card_id ?? null,
    receipt_id: receipt.receipt_id ?? null,
    gate_item_id: receipt.gate_item_id ?? expected?.gate_item_id ?? null,
    source_plan_item_id: receipt.source_plan_item_id ?? expected?.source_plan_item_id ?? null,
    gate_type: receipt.gate_type ?? expected?.gate_type ?? "unknown",
    priority: expected?.priority ?? "medium",
    protected_action: Boolean(expected?.protected_action),
    evidence_decision: (receipt.gate_type ?? expected?.gate_type) === "evidence_decision",
    receipt_status: receiptStatus,
    outcome,
    allowed_outcomes: expected?.allowed_outcomes ?? [],
    target_receipt_input_path: expected?.target_receipt_input_path ?? null,
    target_decision_json_path: expected?.target_decision_json_path ?? null,
    merge_status: deriveMergeItemStatus(receiptStatus, errors, expected),
    ready_for_validation: errors.length === 0 && receiptStatus !== "pending",
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
  const errors = [{ path: `correction_items.${expected.correction_item_id}.receipt_id`, message: "Expected correction receipt was not found in any actor correction input." }];
  return {
    merge_item_id: `human-review-correction-workspace-merge.missing.${slugify(expected.gate_item_id)}`,
    actor_input_id: null,
    actor_correction_workspace_id: null,
    required_actor: expected.required_actor,
    correction_item_id: expected.correction_item_id,
    feedback_item_id: expected.feedback_item_id,
    merge_item_source_id: expected.merge_item_id,
    validation_item_id: expected.validation_item_id,
    decision_row_id: expected.decision_row_id,
    context_card_id: expected.context_card_id,
    receipt_id: expected.receipt_id,
    gate_item_id: expected.gate_item_id,
    source_plan_item_id: expected.source_plan_item_id,
    gate_type: expected.gate_type,
    priority: expected.priority,
    protected_action: Boolean(expected.protected_action),
    evidence_decision: expected.gate_type === "evidence_decision",
    receipt_status: "missing",
    outcome: "missing",
    allowed_outcomes: expected.allowed_outcomes ?? [],
    target_receipt_input_path: expected.target_receipt_input_path ?? null,
    target_decision_json_path: expected.target_decision_json_path ?? null,
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

function deriveMergeItemStatus(receiptStatus, errors, expected) {
  if (!expected) return "unknown_receipt";
  if (errors.some((item) => item.message.includes("multiple actor correction inputs"))) return "duplicate_receipt";
  if (errors.length > 0) return "invalid_correction_receipt";
  if (receiptStatus === "pending") return "pending_receipt";
  return "ready_for_validation";
}

function validateMerge({ workspaceResult, actorInputs, mergeItems }) {
  const errors = [];
  if (!workspaceResult.ok) {
    errors.push({ path: "sources.human_review_correction_workspace", message: `Human review correction workspace unavailable: ${workspaceResult.error}` });
  }
  if (workspaceResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_correction_workspace.safe_handling.auto_execute_allowed", message: "Correction workspace merge requires auto execution to remain disabled." });
  }
  for (const actorInput of actorInputs) errors.push(...actorInput.errors);
  for (const item of mergeItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `merge_items.${item.merge_item_id}.safe_handling`, message: "Correction workspace merge must not execute protected actions." });
    }
    errors.push(...item.errors);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildMergedReceiptInput(generatedAt, workspace, mergeItems) {
  const receiptsById = new Map(mergeItems.filter((item) => item.receipt).map((item) => [item.receipt_id, item.receipt]));
  const expectedOrder = workspace?.correction_items?.map((item) => item.receipt_id) ?? [];
  const orderedReceipts = expectedOrder.map((receiptId) => receiptsById.get(receiptId)).filter(Boolean);
  const unknownReceipts = mergeItems
    .filter((item) => item.merge_status === "unknown_receipt" && item.receipt)
    .map((item) => item.receipt);
  return {
    schema_version: "control-plane-human-gate-receipts-input.v1",
    generated_at: generatedAt,
    human_gate_id: workspace?.actor_workspaces?.find((actor) => actor.human_gate_id)?.human_gate_id ?? "control-plane-human-gates.from-correction-workspace-merge",
    instructions: "Merged from actor-specific correction receipt inputs. Validate this file before applying receipts. It does not write back to decision registers or execute protected actions.",
    receipts: [...orderedReceipts, ...unknownReceipts],
  };
}

function summarizeMerge(actorInputs, mergeItems, workspace, validation) {
  return {
    actor_input_count: actorInputs.length,
    available_actor_input_count: actorInputs.filter((input) => input.available).length,
    expected_receipt_count: workspace?.summary?.correction_item_count ?? workspace?.correction_items?.length ?? 0,
    merge_item_count: mergeItems.length,
    receipt_row_count: mergeItems.filter((item) => item.receipt).length,
    pending_receipt_count: mergeItems.filter((item) => item.merge_status === "pending_receipt").length,
    ready_for_validation_count: mergeItems.filter((item) => item.merge_status === "ready_for_validation").length,
    missing_receipt_count: mergeItems.filter((item) => item.merge_status === "missing_actor_receipt").length,
    duplicate_receipt_count: mergeItems.filter((item) => item.merge_status === "duplicate_receipt").length,
    unknown_receipt_count: mergeItems.filter((item) => item.merge_status === "unknown_receipt").length,
    invalid_correction_receipt_count: mergeItems.filter((item) => item.merge_status === "invalid_correction_receipt").length,
    protected_action_count: mergeItems.filter((item) => item.protected_action).length,
    evidence_decision_count: mergeItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(mergeItems, "required_actor"),
    by_gate_type: countBy(mergeItems, "gate_type"),
    by_merge_status: countBy(mergeItems, "merge_status"),
  };
}

function deriveMergeStatus(validation, mergeItems) {
  if (!validation.valid) return "blocked";
  if (mergeItems.some((item) => item.merge_status === "pending_receipt")) return "pending_receipts";
  if (mergeItems.some((item) => item.merge_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function renderMergeMarkdown(merge) {
  const lines = [
    "# Human Review Correction Workspace Merge",
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
    "- This merge only combines actor correction receipt inputs.",
    "- It does not write back to decision registers.",
    "- It does not apply receipts or execute protected actions.",
    "- The merged `receipt-input.json` must pass human gate receipt validation before application.",
    "",
    "## Actor Inputs",
    "",
  ];
  for (const actorInput of merge.actor_inputs) {
    lines.push(`- ${actorInput.required_actor}: ${actorInput.receipt_count}/${actorInput.expected_receipt_count} receipt(s), available=${actorInput.available}`);
  }
  return `${lines.join("\n")}\n`;
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
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
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
  return String(status ?? "missing").trim().toLowerCase() || "missing";
}

function normalizeOutcome(outcome) {
  return String(outcome ?? "missing").trim().toLowerCase() || "missing";
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
    else if (arg === "--workspace") args.workspacePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-correction-workspace-merge.mjs [options]

Options:
  --workspace <path> Human review correction workspace artifact
  --out-dir <dir>    Output directory
  --run-at <iso>     Override generated_at
  --check            Exit non-zero when validation fails
`);
}
