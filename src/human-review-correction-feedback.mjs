import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_OUT_DIR = "artifacts/human-review-correction-feedback/latest";
export const DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_MERGE_PATH = "artifacts/human-review-correction-workspace-merge/latest/human-review-correction-workspace-merge.json";
export const DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_VALIDATION_PATH = "artifacts/human-review-correction-validation/latest/control-plane-human-gate-receipt-validation.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCorrectionFeedback(options = {}) {
  const result = await buildHumanReviewCorrectionFeedback(options);
  if (options.write !== false) await writeHumanReviewCorrectionFeedback(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review correction feedback failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCorrectionFeedback(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const mergePath = path.resolve(options.mergePath ?? DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_MERGE_PATH);
  const validationPath = path.resolve(options.validationPath ?? DEFAULT_HUMAN_REVIEW_CORRECTION_FEEDBACK_VALIDATION_PATH);
  const mergeResult = await readJsonOrError(mergePath);
  const correctionValidationResult = await readJsonOrError(validationPath);
  const feedbackItems = buildFeedbackItems(mergeResult.value, correctionValidationResult.value);
  const actorFeedback = buildActorFeedback(feedbackItems, mergeResult.value?.actor_inputs ?? [], outputDir);
  const validation = validateFeedback({ mergeResult, correctionValidationResult, feedbackItems });
  const feedback = {
    schema_version: "human-review-correction-feedback.v1",
    generated_at: generatedAt,
    feedback_id: `human-review-correction-feedback.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    feedback_status: deriveFeedbackStatus(validation, feedbackItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      feedback_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_correction_workspace_merge", "Human Review Correction Workspace Merge", mergePath, mergeResult),
      buildSource("human_review_correction_validation", "Human Review Correction Validation", validationPath, correctionValidationResult),
    ],
    summary: summarizeFeedback(actorFeedback, feedbackItems, validation),
    actor_feedback: actorFeedback,
    feedback_items: feedbackItems,
    validation,
  };

  return {
    ...feedback,
    markdown: renderFeedbackMarkdown(feedback),
  };
}

export async function writeHumanReviewCorrectionFeedback(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-correction-feedback.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    feedback_id: result.feedback_id,
    output_dir: result.output_dir,
    feedback_status: result.feedback_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_feedback: result.actor_feedback,
    feedback_items: result.feedback_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "feedback-items.json"), {
    generated_at: result.generated_at,
    count: result.feedback_items.length,
    feedback_items: result.feedback_items,
  });
  await writeJson(path.join(outDir, "actor-feedback.json"), {
    generated_at: result.generated_at,
    count: result.actor_feedback.length,
    actor_feedback: result.actor_feedback,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_feedback) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.feedback_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "feedback.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      feedback_status: actor.feedback_status,
      count: items.length,
      feedback_items: items,
    });
    await writeFile(path.join(actorDir, "feedback.md"), renderActorFeedbackMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCorrectionFeedbackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCorrectionFeedback(args);
    console.log(`Human review correction feedback ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Feedback status: ${result.feedback_status}`);
    console.log(`Actor feedback: ${result.summary.actor_feedback_count}`);
    console.log(`Feedback items: ${result.summary.feedback_item_count}`);
    console.log(`Pending correction receipts: ${result.summary.pending_receipt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFeedbackItems(merge, correctionValidation) {
  const validationByGate = new Map((correctionValidation?.validation_items ?? []).map((item) => [item.gate_item_id, item]));
  return (merge?.merge_items ?? [])
    .map((mergeItem) => buildFeedbackItem(mergeItem, validationByGate.get(mergeItem.gate_item_id)))
    .sort(compareFeedbackItems);
}

function buildFeedbackItem(mergeItem, validationItem) {
  const validationStatus = validationItem?.validation_status ?? "missing_validation";
  const feedbackStatus = deriveItemFeedbackStatus(validationStatus);
  return {
    feedback_item_id: `human-review-correction-feedback.${slugify(mergeItem.gate_item_id)}`,
    merge_item_id: mergeItem.merge_item_id,
    actor_input_id: mergeItem.actor_input_id,
    actor_correction_workspace_id: mergeItem.actor_correction_workspace_id,
    required_actor: mergeItem.required_actor,
    correction_item_id: mergeItem.correction_item_id,
    source_feedback_item_id: mergeItem.feedback_item_id,
    source_merge_item_id: mergeItem.merge_item_source_id,
    source_validation_item_id: mergeItem.validation_item_id,
    validation_item_id: validationItem?.validation_item_id ?? null,
    decision_row_id: mergeItem.decision_row_id,
    context_card_id: mergeItem.context_card_id,
    receipt_id: mergeItem.receipt_id,
    gate_item_id: mergeItem.gate_item_id,
    source_plan_item_id: mergeItem.source_plan_item_id,
    gate_type: mergeItem.gate_type,
    priority: mergeItem.priority,
    protected_action: mergeItem.protected_action,
    evidence_decision: mergeItem.evidence_decision,
    receipt_status: validationItem?.receipt_status ?? mergeItem.receipt_status,
    outcome: validationItem?.outcome ?? mergeItem.outcome,
    validation_status: validationStatus,
    feedback_status: feedbackStatus,
    ready_to_apply: Boolean(validationItem?.ready_to_apply),
    merge_status: mergeItem.merge_status,
    ready_for_validation: Boolean(mergeItem.ready_for_validation),
    allowed_outcomes: validationItem?.allowed_outcomes ?? mergeItem.allowed_outcomes ?? [],
    required_receipt_fields: validationItem?.required_receipt_fields ?? mergeItem.receipt?.required_receipt_fields ?? [],
    target_receipt_input_path: mergeItem.target_receipt_input_path,
    target_decision_json_path: mergeItem.target_decision_json_path,
    error_count: validationItem?.error_count ?? 1,
    errors: validationItem?.errors ?? [{ gate_item_id: mergeItem.gate_item_id ?? "unknown", field: "validation_item", message: "No correction validation item was found for this merged correction receipt." }],
    next_actions: buildNextActions(validationStatus, validationItem),
    receipt: validationItem?.receipt ?? mergeItem.receipt ?? null,
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      feedback_only: true,
    },
  };
}

function deriveItemFeedbackStatus(validationStatus) {
  if (validationStatus === "ready_to_apply") return "ready_for_application";
  if (validationStatus === "pending_receipt") return "needs_human_decision";
  if (["invalid_receipt", "missing_receipt", "unknown_human_gate", "missing_validation"].includes(validationStatus)) return "needs_correction";
  return "attention";
}

function buildNextActions(validationStatus, validationItem) {
  if (validationStatus === "ready_to_apply") {
    return ["review_validated_correction_receipt", "run_human_gate_receipt_application_when_authorized"];
  }
  if (validationStatus === "pending_receipt") {
    return [
      "open_actor_correction_receipt_input",
      "set_receipt_status_to_resolved_deferred_rejected_failed_or_cancelled",
      "fill_required_receipt_fields",
      "rerun_correction_workspace_merge_and_validation",
    ];
  }
  if (validationStatus === "missing_validation") {
    return ["rerun_human_review_correction_validation", "check_gate_item_mapping", "rerun_human_review_correction_feedback"];
  }
  const fields = (validationItem?.errors ?? []).map((error) => error.field).filter(Boolean);
  return [
    "fix_actor_correction_receipt_input",
    ...(fields.length > 0 ? [`check_fields:${[...new Set(fields)].join(",")}`] : []),
    "rerun_human_review_correction_workspace_merge",
    "rerun_human_review_correction_validation",
  ];
}

function buildActorFeedback(feedbackItems, actorInputs, outputDir) {
  const actorByKey = new Map(actorInputs.map((actorInput) => [actorInput.required_actor, actorInput]));
  return Object.entries(groupBy(feedbackItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const actorInput = actorByKey.get(requiredActor);
      return {
        actor_feedback_id: `human-review-correction-feedback.actor.${slugify(requiredActor)}`,
        actor_input_id: actorInput?.actor_input_id ?? null,
        actor_correction_workspace_id: actorInput?.actor_correction_workspace_id ?? null,
        required_actor: requiredActor,
        feedback_status: deriveActorFeedbackStatus(items),
        priority: highestPriority(items),
        feedback_item_count: items.length,
        pending_receipt_count: items.filter((item) => item.feedback_status === "needs_human_decision").length,
        ready_for_application_count: items.filter((item) => item.feedback_status === "ready_for_application").length,
        needs_correction_count: items.filter((item) => item.feedback_status === "needs_correction").length,
        protected_action_count: items.filter((item) => item.protected_action).length,
        evidence_decision_count: items.filter((item) => item.evidence_decision).length,
        feedback_item_ids: items.map((item) => item.feedback_item_id),
        feedback_json_path: path.join(outputDir, "actors", requiredActor, "feedback.json"),
        feedback_markdown_path: path.join(outputDir, "actors", requiredActor, "feedback.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          feedback_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorFeedback);
}

function deriveActorFeedbackStatus(items) {
  if (items.some((item) => item.feedback_status === "needs_correction")) return "attention";
  if (items.some((item) => item.feedback_status === "needs_human_decision")) return "pending_human_review";
  if (items.some((item) => item.feedback_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function validateFeedback({ mergeResult, correctionValidationResult, feedbackItems }) {
  const errors = [];
  if (!mergeResult.ok) {
    errors.push({ path: "sources.human_review_correction_workspace_merge", message: `Correction workspace merge unavailable: ${mergeResult.error}` });
  }
  if (!correctionValidationResult.ok) {
    errors.push({ path: "sources.human_review_correction_validation", message: `Correction receipt validation unavailable: ${correctionValidationResult.error}` });
  }
  if (mergeResult.value?.safe_handling?.auto_execute_allowed) {
    errors.push({ path: "human_review_correction_workspace_merge.safe_handling.auto_execute_allowed", message: "Correction feedback requires auto execution to remain disabled." });
  }
  for (const item of feedbackItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `feedback_items.${item.feedback_item_id}.safe_handling`, message: "Correction feedback must not execute protected actions." });
    }
    if (item.validation_status === "missing_validation") {
      errors.push({ path: `feedback_items.${item.feedback_item_id}.validation_item_id`, message: "Merged correction receipt is missing a correction validation item." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFeedback(actorFeedback, feedbackItems, validation) {
  return {
    actor_feedback_count: actorFeedback.length,
    feedback_item_count: feedbackItems.length,
    pending_receipt_count: feedbackItems.filter((item) => item.feedback_status === "needs_human_decision").length,
    ready_for_application_count: feedbackItems.filter((item) => item.feedback_status === "ready_for_application").length,
    needs_correction_count: feedbackItems.filter((item) => item.feedback_status === "needs_correction").length,
    missing_validation_count: feedbackItems.filter((item) => item.validation_status === "missing_validation").length,
    invalid_receipt_count: feedbackItems.filter((item) => item.validation_status === "invalid_receipt").length,
    missing_receipt_count: feedbackItems.filter((item) => item.validation_status === "missing_receipt").length,
    unknown_receipt_count: feedbackItems.filter((item) => item.validation_status === "unknown_human_gate").length,
    protected_action_count: feedbackItems.filter((item) => item.protected_action).length,
    evidence_decision_count: feedbackItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(feedbackItems, "required_actor"),
    by_gate_type: countBy(feedbackItems, "gate_type"),
    by_validation_status: countBy(feedbackItems, "validation_status"),
    by_feedback_status: countBy(feedbackItems, "feedback_status"),
  };
}

function deriveFeedbackStatus(validation, feedbackItems) {
  if (!validation.valid) return "blocked";
  if (feedbackItems.some((item) => item.feedback_status === "needs_correction")) return "attention";
  if (feedbackItems.some((item) => item.feedback_status === "needs_human_decision")) return "pending_human_review";
  if (feedbackItems.some((item) => item.feedback_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function renderFeedbackMarkdown(feedback) {
  const lines = [
    "# Human Review Correction Feedback",
    "",
    `- Feedback status: ${feedback.feedback_status}`,
    `- Actor feedback: ${feedback.summary.actor_feedback_count}`,
    `- Feedback items: ${feedback.summary.feedback_item_count}`,
    `- Pending correction receipts: ${feedback.summary.pending_receipt_count}`,
    `- Ready for application: ${feedback.summary.ready_for_application_count}`,
    `- Needs correction: ${feedback.summary.needs_correction_count}`,
    `- Validation errors: ${feedback.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact only routes correction validation feedback back to reviewers.",
    "- It does not apply receipts or execute protected actions.",
    "- Actor feedback files are work queues for updating correction receipt inputs.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of feedback.actor_feedback) {
    lines.push(`- ${actor.required_actor}: ${actor.feedback_item_count} item(s), ${actor.pending_receipt_count} pending, ${actor.feedback_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorFeedbackMarkdown(actor, items) {
  const lines = [
    `# Human Review Correction Feedback: ${actor.required_actor}`,
    "",
    `- Feedback status: ${actor.feedback_status}`,
    `- Feedback items: ${actor.feedback_item_count}`,
    `- Pending correction receipts: ${actor.pending_receipt_count}`,
    `- Ready for application: ${actor.ready_for_application_count}`,
    `- Needs correction: ${actor.needs_correction_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Feedback status: ${item.feedback_status}`);
    lines.push(`- Validation status: ${item.validation_status}`);
    lines.push(`- Receipt status: ${item.receipt_status}`);
    lines.push(`- Outcome: ${item.outcome}`);
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

function compareFeedbackItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorFeedback(a, b) {
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
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--merge") args.mergePath = argv[++index];
    else if (arg === "--validation") args.validationPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-correction-feedback.mjs [options]

Options:
  --merge <path>      Human review correction workspace merge artifact
  --validation <path> Human review correction validation artifact
  --out-dir <dir>     Output directory
  --run-at <iso>      Override generated_at
  --check             Exit non-zero when validation fails
`);
}
