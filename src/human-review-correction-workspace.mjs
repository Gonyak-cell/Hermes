import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_OUT_DIR = "artifacts/human-review-correction-workspace/latest";
export const DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_FEEDBACK_PATH = "artifacts/human-review-validation-feedback/latest/human-review-validation-feedback.json";
export const DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_PATH = "artifacts/human-review-decision-register-merge/latest/human-review-decision-register-merge.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CORRECTION_FEEDBACK_STATUSES = new Set(["needs_human_decision", "needs_correction"]);

export async function runHumanReviewCorrectionWorkspace(options = {}) {
  const result = await buildHumanReviewCorrectionWorkspace(options);
  if (options.write !== false) await writeHumanReviewCorrectionWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review correction workspace failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCorrectionWorkspace(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const feedbackPath = path.resolve(options.feedbackPath ?? DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_FEEDBACK_PATH);
  const mergePath = path.resolve(options.mergePath ?? DEFAULT_HUMAN_REVIEW_CORRECTION_WORKSPACE_MERGE_PATH);
  const feedbackResult = await readJsonOrError(feedbackPath);
  const mergeResult = await readJsonOrError(mergePath);
  const actorInputById = new Map((mergeResult.value?.actor_inputs ?? []).map((actorInput) => [actorInput.actor_input_id, actorInput]));
  const correctionItems = buildCorrectionItems(feedbackResult.value?.feedback_items ?? [], actorInputById);
  const actorWorkspaces = buildActorWorkspaces(correctionItems, outputDir);
  const validation = validateWorkspace({ feedbackResult, mergeResult, correctionItems });
  const workspace = {
    schema_version: "human-review-correction-workspace.v1",
    generated_at: generatedAt,
    correction_workspace_id: `human-review-correction-workspace.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    workspace_status: deriveWorkspaceStatus(validation, correctionItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      correction_workspace_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_validation_feedback", "Human Review Validation Feedback", feedbackPath, feedbackResult),
      buildSource("human_review_decision_register_merge", "Human Review Decision Register Merge", mergePath, mergeResult),
    ],
    summary: summarizeWorkspace(actorWorkspaces, correctionItems, validation),
    actor_workspaces: actorWorkspaces,
    correction_items: correctionItems,
    validation,
  };

  return {
    ...workspace,
    markdown: renderWorkspaceMarkdown(workspace),
  };
}

export async function writeHumanReviewCorrectionWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-correction-workspace.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    correction_workspace_id: result.correction_workspace_id,
    output_dir: result.output_dir,
    workspace_status: result.workspace_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_workspaces: result.actor_workspaces,
    correction_items: result.correction_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "correction-items.json"), {
    generated_at: result.generated_at,
    count: result.correction_items.length,
    correction_items: result.correction_items,
  });
  await writeJson(path.join(outDir, "actor-workspaces.json"), {
    generated_at: result.generated_at,
    count: result.actor_workspaces.length,
    actor_workspaces: result.actor_workspaces,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_workspaces) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.correction_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "correction-workspace.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      workspace_status: actor.workspace_status,
      count: items.length,
      correction_items: items,
    });
    await writeJson(path.join(actorDir, "receipt-input.json"), {
      schema_version: "control-plane-human-gate-receipts-input.v1",
      generated_at: result.generated_at,
      human_gate_id: actor.human_gate_id,
      instructions: `Actor-specific correction receipt input for ${actor.required_actor}. Fill decisions, rerun correction merge workflow, and do not execute protected actions from this file.`,
      receipts: items.map((item) => item.editable_receipt),
    });
    await writeFile(path.join(actorDir, "corrections.md"), renderActorWorkspaceMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCorrectionWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCorrectionWorkspace(args);
    console.log(`Human review correction workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Workspace status: ${result.workspace_status}`);
    console.log(`Actor workspaces: ${result.summary.actor_workspace_count}`);
    console.log(`Correction items: ${result.summary.correction_item_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCorrectionItems(feedbackItems, actorInputById) {
  return (feedbackItems ?? [])
    .filter((item) => CORRECTION_FEEDBACK_STATUSES.has(item.feedback_status))
    .map((item) => buildCorrectionItem(item, actorInputById.get(item.actor_input_id)))
    .sort(compareCorrectionItems);
}

function buildCorrectionItem(feedbackItem, actorInput) {
  const correctionStatus = feedbackItem.feedback_status === "needs_correction" ? "needs_correction" : "pending_decision";
  const editableReceipt = buildEditableReceipt(feedbackItem);
  return {
    correction_item_id: `human-review-correction-workspace.${slugify(feedbackItem.gate_item_id)}`,
    feedback_item_id: feedbackItem.feedback_item_id,
    merge_item_id: feedbackItem.merge_item_id,
    validation_item_id: feedbackItem.validation_item_id,
    actor_input_id: feedbackItem.actor_input_id,
    actor_decision_register_id: feedbackItem.actor_decision_register_id,
    required_actor: feedbackItem.required_actor,
    decision_row_id: feedbackItem.decision_row_id,
    context_card_id: feedbackItem.context_card_id,
    receipt_id: feedbackItem.receipt_id,
    gate_item_id: feedbackItem.gate_item_id,
    source_plan_item_id: feedbackItem.source_plan_item_id,
    gate_type: feedbackItem.gate_type,
    priority: feedbackItem.priority,
    protected_action: feedbackItem.protected_action,
    evidence_decision: feedbackItem.evidence_decision,
    correction_status: correctionStatus,
    feedback_status: feedbackItem.feedback_status,
    validation_status: feedbackItem.validation_status,
    receipt_status: feedbackItem.receipt_status,
    outcome: feedbackItem.outcome,
    target_receipt_input_path: actorInput?.input_path ?? null,
    target_decision_json_path: actorInput?.decision_json_path ?? null,
    allowed_outcomes: feedbackItem.allowed_outcomes ?? [],
    required_receipt_fields: feedbackItem.required_receipt_fields ?? [],
    errors: feedbackItem.errors ?? [],
    next_actions: feedbackItem.next_actions ?? [],
    editable_receipt: editableReceipt,
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      correction_workspace_only: true,
    },
  };
}

function buildEditableReceipt(feedbackItem) {
  const receipt = {
    ...(feedbackItem.receipt ?? {}),
    receipt_id: feedbackItem.receipt_id,
    gate_item_id: feedbackItem.gate_item_id,
    source_plan_item_id: feedbackItem.source_plan_item_id,
    gate_type: feedbackItem.gate_type,
    receipt_status: feedbackItem.receipt_status === "pending" ? "pending" : feedbackItem.receipt_status,
    outcome: feedbackItem.outcome === "missing" ? "pending" : feedbackItem.outcome,
    required_receipt_fields: feedbackItem.required_receipt_fields ?? [],
  };
  for (const field of feedbackItem.required_receipt_fields ?? []) {
    if (receipt[field] === undefined || receipt[field] === null) {
      receipt[field] = isArrayPlaceholder(field) ? [] : "";
    }
  }
  if (!Array.isArray(receipt.commands_run)) receipt.commands_run = [];
  if (!Array.isArray(receipt.completed_action_refs)) receipt.completed_action_refs = [];
  return receipt;
}

function isArrayPlaceholder(field) {
  return ["commands_run", "completed_action_refs"].includes(field);
}

function buildActorWorkspaces(correctionItems, outputDir) {
  return Object.entries(groupBy(correctionItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => ({
      actor_correction_workspace_id: `human-review-correction-workspace.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      workspace_status: deriveActorWorkspaceStatus(items),
      priority: highestPriority(items),
      correction_item_count: items.length,
      receipt_row_count: items.length,
      pending_decision_count: items.filter((item) => item.correction_status === "pending_decision").length,
      needs_correction_count: items.filter((item) => item.correction_status === "needs_correction").length,
      protected_action_count: items.filter((item) => item.protected_action).length,
      evidence_decision_count: items.filter((item) => item.evidence_decision).length,
      correction_item_ids: items.map((item) => item.correction_item_id),
      human_gate_id: inferHumanGateId(items),
      correction_json_path: path.join(outputDir, "actors", requiredActor, "correction-workspace.json"),
      receipt_input_path: path.join(outputDir, "actors", requiredActor, "receipt-input.json"),
      correction_markdown_path: path.join(outputDir, "actors", requiredActor, "corrections.md"),
      target_receipt_input_paths: [...new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean))],
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        correction_workspace_only: true,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorWorkspaces);
}

function validateWorkspace({ feedbackResult, mergeResult, correctionItems }) {
  const errors = [];
  if (!feedbackResult.ok) {
    errors.push({ path: "sources.human_review_validation_feedback", message: `Validation feedback unavailable: ${feedbackResult.error}` });
  }
  if (!mergeResult.ok) {
    errors.push({ path: "sources.human_review_decision_register_merge", message: `Decision register merge unavailable: ${mergeResult.error}` });
  }
  if (feedbackResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_validation_feedback.safe_handling.auto_execute_allowed", message: "Correction workspace requires auto execution to remain disabled." });
  }
  for (const item of correctionItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `correction_items.${item.correction_item_id}.safe_handling`, message: "Correction workspace must not execute protected actions." });
    }
    if (!item.target_receipt_input_path) {
      errors.push({ path: `correction_items.${item.correction_item_id}.target_receipt_input_path`, message: "Correction item is missing the target actor receipt input path." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeWorkspace(actorWorkspaces, correctionItems, validation) {
  return {
    actor_workspace_count: actorWorkspaces.length,
    correction_item_count: correctionItems.length,
    receipt_row_count: correctionItems.length,
    pending_decision_count: correctionItems.filter((item) => item.correction_status === "pending_decision").length,
    needs_correction_count: correctionItems.filter((item) => item.correction_status === "needs_correction").length,
    protected_action_count: correctionItems.filter((item) => item.protected_action).length,
    evidence_decision_count: correctionItems.filter((item) => item.evidence_decision).length,
    editable_file_count: actorWorkspaces.length * 3,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(correctionItems, "required_actor"),
    by_gate_type: countBy(correctionItems, "gate_type"),
    by_correction_status: countBy(correctionItems, "correction_status"),
  };
}

function deriveWorkspaceStatus(validation, correctionItems) {
  if (!validation.valid) return "blocked";
  if (correctionItems.some((item) => item.correction_status === "needs_correction")) return "attention";
  if (correctionItems.some((item) => item.correction_status === "pending_decision")) return "pending_human_review";
  return "clear";
}

function deriveActorWorkspaceStatus(items) {
  if (items.some((item) => item.correction_status === "needs_correction")) return "attention";
  if (items.some((item) => item.correction_status === "pending_decision")) return "pending_human_review";
  return "clear";
}

function inferHumanGateId(items) {
  const receipt = items.find((item) => item.editable_receipt)?.editable_receipt;
  return receipt?.human_gate_id ?? "control-plane-human-gates.from-correction-workspace";
}

function renderWorkspaceMarkdown(workspace) {
  const lines = [
    "# Human Review Correction Workspace",
    "",
    `- Workspace status: ${workspace.workspace_status}`,
    `- Actor workspaces: ${workspace.summary.actor_workspace_count}`,
    `- Correction items: ${workspace.summary.correction_item_count}`,
    `- Receipt rows: ${workspace.summary.receipt_row_count}`,
    `- Pending decisions: ${workspace.summary.pending_decision_count}`,
    `- Needs correction: ${workspace.summary.needs_correction_count}`,
    `- Validation errors: ${workspace.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This workspace only prepares editable correction receipt inputs.",
    "- It does not write back to actor decision registers.",
    "- It does not apply receipts or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of workspace.actor_workspaces) {
    lines.push(`- ${actor.required_actor}: ${actor.correction_item_count} correction item(s), ${actor.receipt_input_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorWorkspaceMarkdown(actor, items) {
  const lines = [
    `# Human Review Corrections: ${actor.required_actor}`,
    "",
    `- Workspace status: ${actor.workspace_status}`,
    `- Correction items: ${actor.correction_item_count}`,
    `- Pending decisions: ${actor.pending_decision_count}`,
    `- Needs correction: ${actor.needs_correction_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Correction status: ${item.correction_status}`);
    lines.push(`- Validation status: ${item.validation_status}`);
    lines.push(`- Allowed outcomes: ${item.allowed_outcomes.join(", ")}`);
    lines.push(`- Required fields: ${item.required_receipt_fields.join(", ")}`);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
    if (item.errors.length > 0) {
      lines.push(`- Errors: ${item.errors.map((error) => `${error.field}: ${error.message}`).join(" | ")}`);
    }
    lines.push("");
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareCorrectionItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorWorkspaces(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
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
    else if (arg === "--feedback") args.feedbackPath = argv[++index];
    else if (arg === "--merge") args.mergePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-correction-workspace.mjs [options]

Options:
  --feedback <path> Human review validation feedback artifact
  --merge <path>    Human review decision register merge artifact
  --out-dir <dir>   Output directory
  --run-at <iso>    Override generated_at
  --check           Exit non-zero when validation fails
`);
}
