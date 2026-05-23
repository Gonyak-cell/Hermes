import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_OUT_DIR = "artifacts/human-review-cycle-ledger/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS = {
  validationFeedbackPath: "artifacts/human-review-validation-feedback/latest/human-review-validation-feedback.json",
  correctionWorkspacePath: "artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json",
  correctionWorkspaceMergePath: "artifacts/human-review-correction-workspace-merge/latest/human-review-correction-workspace-merge.json",
  correctionValidationPath: "artifacts/human-review-correction-validation/latest/control-plane-human-gate-receipt-validation.json",
  correctionFeedbackPath: "artifacts/human-review-correction-feedback/latest/human-review-correction-feedback.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleLedger(options = {}) {
  const result = await buildHumanReviewCycleLedger(options);
  if (options.write !== false) await writeHumanReviewCycleLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const inputPaths = resolveInputPaths(options);
  const sourceResults = {
    human_review_validation_feedback: await readJsonOrError(inputPaths.validationFeedbackPath),
    human_review_correction_workspace: await readJsonOrError(inputPaths.correctionWorkspacePath),
    human_review_correction_workspace_merge: await readJsonOrError(inputPaths.correctionWorkspaceMergePath),
    human_review_correction_validation: await readJsonOrError(inputPaths.correctionValidationPath),
    human_review_correction_feedback: await readJsonOrError(inputPaths.correctionFeedbackPath),
  };
  const sources = [
    buildSource("human_review_validation_feedback", "Human Review Validation Feedback", inputPaths.validationFeedbackPath, sourceResults.human_review_validation_feedback),
    buildSource("human_review_correction_workspace", "Human Review Correction Workspace", inputPaths.correctionWorkspacePath, sourceResults.human_review_correction_workspace),
    buildSource("human_review_correction_workspace_merge", "Human Review Correction Workspace Merge", inputPaths.correctionWorkspaceMergePath, sourceResults.human_review_correction_workspace_merge),
    buildSource("human_review_correction_validation", "Human Review Correction Validation", inputPaths.correctionValidationPath, sourceResults.human_review_correction_validation),
    buildSource("human_review_correction_feedback", "Human Review Correction Feedback", inputPaths.correctionFeedbackPath, sourceResults.human_review_correction_feedback),
  ];
  const cycleItems = buildCycleItems(sourceResults);
  const actorCycles = buildActorCycles(cycleItems, sourceResults.human_review_correction_feedback.value?.actor_feedback ?? [], outputDir);
  const validation = validateCycleLedger({ sources, sourceResults, cycleItems });
  const ledger = {
    schema_version: "human-review-cycle-ledger.v1",
    generated_at: generatedAt,
    cycle_id: `human-review-cycle-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cycle_status: deriveCycleStatus(validation, cycleItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      ledger_only: true,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeCycleLedger(actorCycles, cycleItems, sources, sourceResults, validation),
    actor_cycles: actorCycles,
    cycle_items: cycleItems,
    validation,
  };

  return {
    ...ledger,
    markdown: renderCycleLedgerMarkdown(ledger),
  };
}

export async function writeHumanReviewCycleLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    cycle_id: result.cycle_id,
    output_dir: result.output_dir,
    cycle_status: result.cycle_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_cycles: result.actor_cycles,
    cycle_items: result.cycle_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "cycle-items.json"), {
    generated_at: result.generated_at,
    count: result.cycle_items.length,
    cycle_items: result.cycle_items,
  });
  await writeJson(path.join(outDir, "actor-cycles.json"), {
    generated_at: result.generated_at,
    count: result.actor_cycles.length,
    actor_cycles: result.actor_cycles,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_cycles) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.cycle_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "cycle.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      cycle_status: actor.cycle_status,
      count: items.length,
      cycle_items: items,
    });
    await writeFile(path.join(actorDir, "cycle.md"), renderActorCycleMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleLedger(args);
    console.log(`Human review cycle ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Cycle status: ${result.cycle_status}`);
    console.log(`Actors: ${result.summary.actor_cycle_count}`);
    console.log(`Cycle items: ${result.summary.cycle_item_count}`);
    console.log(`Pending human items: ${result.summary.pending_human_review_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function resolveInputPaths(options) {
  return {
    validationFeedbackPath: path.resolve(options.validationFeedbackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS.validationFeedbackPath),
    correctionWorkspacePath: path.resolve(options.correctionWorkspacePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS.correctionWorkspacePath),
    correctionWorkspaceMergePath: path.resolve(options.correctionWorkspaceMergePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS.correctionWorkspaceMergePath),
    correctionValidationPath: path.resolve(options.correctionValidationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS.correctionValidationPath),
    correctionFeedbackPath: path.resolve(options.correctionFeedbackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_LEDGER_INPUTS.correctionFeedbackPath),
  };
}

function buildCycleItems(sourceResults) {
  const validationFeedbackByGate = mapByGate(sourceResults.human_review_validation_feedback.value?.feedback_items ?? []);
  const correctionWorkspaceByGate = mapByGate(sourceResults.human_review_correction_workspace.value?.correction_items ?? []);
  const correctionMergeByGate = mapByGate(sourceResults.human_review_correction_workspace_merge.value?.merge_items ?? []);
  const correctionValidationByGate = mapByGate(sourceResults.human_review_correction_validation.value?.validation_items ?? []);
  const correctionFeedbackByGate = mapByGate(sourceResults.human_review_correction_feedback.value?.feedback_items ?? []);
  const gateIds = new Set([
    ...validationFeedbackByGate.keys(),
    ...correctionWorkspaceByGate.keys(),
    ...correctionMergeByGate.keys(),
    ...correctionValidationByGate.keys(),
    ...correctionFeedbackByGate.keys(),
  ]);

  return [...gateIds].map((gateId) => {
    const validationFeedback = validationFeedbackByGate.get(gateId);
    const correctionWorkspace = correctionWorkspaceByGate.get(gateId);
    const correctionMerge = correctionMergeByGate.get(gateId);
    const correctionValidation = correctionValidationByGate.get(gateId);
    const correctionFeedback = correctionFeedbackByGate.get(gateId);
    const base = correctionFeedback ?? correctionMerge ?? correctionWorkspace ?? validationFeedback ?? correctionValidation ?? {};
    const item = {
      cycle_item_id: `human-review-cycle-item.${slugify(gateId)}`,
      gate_item_id: gateId,
      required_actor: base.required_actor ?? "unknown",
      gate_type: base.gate_type ?? correctionValidation?.gate_type ?? "unknown",
      priority: base.priority ?? correctionValidation?.priority ?? "medium",
      protected_action: Boolean(base.protected_action ?? correctionValidation?.protected_action),
      evidence_decision: Boolean(base.evidence_decision ?? (base.gate_type ?? correctionValidation?.gate_type) === "evidence_decision"),
      receipt_id: base.receipt_id ?? correctionValidation?.receipt?.receipt_id ?? null,
      source_plan_item_id: base.source_plan_item_id ?? correctionValidation?.source_plan_item_id ?? null,
      original_feedback_item_id: validationFeedback?.feedback_item_id ?? null,
      original_feedback_status: validationFeedback?.feedback_status ?? null,
      original_validation_status: validationFeedback?.validation_status ?? null,
      correction_item_id: correctionWorkspace?.correction_item_id ?? null,
      correction_status: correctionWorkspace?.correction_status ?? null,
      correction_merge_item_id: correctionMerge?.merge_item_id ?? null,
      correction_merge_status: correctionMerge?.merge_status ?? null,
      correction_validation_item_id: correctionValidation?.validation_item_id ?? null,
      correction_validation_status: correctionValidation?.validation_status ?? null,
      correction_feedback_item_id: correctionFeedback?.feedback_item_id ?? null,
      correction_feedback_status: correctionFeedback?.feedback_status ?? null,
      receipt_status: correctionFeedback?.receipt_status ?? correctionValidation?.receipt_status ?? correctionMerge?.receipt_status ?? correctionWorkspace?.editable_receipt?.receipt_status ?? validationFeedback?.receipt_status ?? null,
      outcome: correctionFeedback?.outcome ?? correctionValidation?.outcome ?? correctionMerge?.outcome ?? correctionWorkspace?.editable_receipt?.outcome ?? validationFeedback?.outcome ?? null,
      ready_to_apply: Boolean(correctionFeedback?.ready_to_apply ?? correctionValidation?.ready_to_apply),
      next_actions: buildCycleNextActions({ correctionFeedback, correctionValidation, correctionMerge, correctionWorkspace, validationFeedback }),
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        ledger_only: true,
      },
    };
    return {
      ...item,
      cycle_status: deriveCycleItemStatus(item),
    };
  }).sort(compareCycleItems);
}

function buildCycleNextActions({ correctionFeedback, correctionValidation, correctionMerge, correctionWorkspace, validationFeedback }) {
  if (correctionFeedback?.next_actions?.length > 0) return correctionFeedback.next_actions;
  if (correctionValidation?.validation_status === "ready_to_apply") return ["review_validated_correction_receipt", "run_human_gate_receipt_application_when_authorized"];
  if (correctionValidation?.validation_status === "pending_receipt") return ["open_actor_correction_receipt_input", "fill_required_receipt_fields", "rerun_correction_workspace_merge_and_validation"];
  if (correctionMerge?.merge_status && correctionMerge.merge_status !== "ready_for_validation" && correctionMerge.merge_status !== "pending_receipt") {
    return ["fix_actor_correction_receipt_input", "rerun_human_review_correction_workspace_merge"];
  }
  if (correctionWorkspace?.correction_status === "pending_decision" || validationFeedback?.feedback_status === "needs_human_decision") {
    return ["open_actor_correction_receipt_input", "set_receipt_status_to_terminal_decision", "rerun_review_cycle"];
  }
  return ["inspect_human_review_cycle"];
}

function deriveCycleItemStatus(item) {
  const invalidStatuses = new Set(["invalid_receipt", "missing_receipt", "unknown_human_gate", "missing_validation"]);
  const invalidMergeStatuses = new Set(["missing_actor_receipt", "duplicate_receipt", "unknown_receipt", "invalid_correction_receipt"]);
  if (item.correction_feedback_status === "needs_correction" || invalidStatuses.has(item.correction_validation_status) || invalidMergeStatuses.has(item.correction_merge_status)) return "attention";
  if (item.correction_feedback_status === "needs_human_decision" || item.correction_validation_status === "pending_receipt" || item.correction_status === "pending_decision") return "pending_human_review";
  if (item.correction_feedback_status === "ready_for_application" || item.correction_validation_status === "ready_to_apply" || item.ready_to_apply) return "ready_for_application";
  return "clear";
}

function buildActorCycles(cycleItems, actorFeedback, outputDir) {
  const feedbackByActor = new Map(actorFeedback.map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(cycleItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const feedback = feedbackByActor.get(requiredActor);
      return {
        actor_cycle_id: `human-review-cycle.actor.${slugify(requiredActor)}`,
        actor_feedback_id: feedback?.actor_feedback_id ?? null,
        required_actor: requiredActor,
        cycle_status: deriveActorCycleStatus(items),
        priority: highestPriority(items),
        cycle_item_count: items.length,
        pending_human_review_count: items.filter((item) => item.cycle_status === "pending_human_review").length,
        ready_for_application_count: items.filter((item) => item.cycle_status === "ready_for_application").length,
        attention_count: items.filter((item) => item.cycle_status === "attention").length,
        protected_action_count: items.filter((item) => item.protected_action).length,
        evidence_decision_count: items.filter((item) => item.evidence_decision).length,
        cycle_item_ids: items.map((item) => item.cycle_item_id),
        cycle_json_path: path.join(outputDir, "actors", requiredActor, "cycle.json"),
        cycle_markdown_path: path.join(outputDir, "actors", requiredActor, "cycle.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          ledger_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorCycles);
}

function deriveActorCycleStatus(items) {
  if (items.some((item) => item.cycle_status === "attention")) return "attention";
  if (items.some((item) => item.cycle_status === "pending_human_review")) return "pending_human_review";
  if (items.some((item) => item.cycle_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function validateCycleLedger({ sources, sourceResults, cycleItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) {
      errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
    }
  }
  const validationFeedbackCount = sourceResults.human_review_validation_feedback.value?.summary?.feedback_item_count ?? 0;
  const correctionFeedbackCount = sourceResults.human_review_correction_feedback.value?.summary?.feedback_item_count ?? 0;
  if (validationFeedbackCount > 0 && cycleItems.length < validationFeedbackCount) {
    errors.push({ path: "cycle_items", message: "Cycle ledger has fewer items than validation feedback items." });
  }
  if (correctionFeedbackCount > 0 && cycleItems.length < correctionFeedbackCount) {
    errors.push({ path: "cycle_items", message: "Cycle ledger has fewer items than correction feedback items." });
  }
  for (const item of cycleItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `cycle_items.${item.cycle_item_id}.safe_handling`, message: "Cycle ledger must not execute protected actions." });
    }
    if (!item.correction_feedback_item_id) {
      errors.push({ path: `cycle_items.${item.cycle_item_id}.correction_feedback_item_id`, message: "Cycle item is missing correction feedback linkage." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCycleLedger(actorCycles, cycleItems, sources, sourceResults, validation) {
  const correctionMerge = sourceResults.human_review_correction_workspace_merge.value;
  const correctionValidation = sourceResults.human_review_correction_validation.value;
  return {
    cycle_status: deriveCycleStatus(validation, cycleItems),
    source_count: sources.length,
    unavailable_source_count: sources.filter((source) => !source.available).length,
    actor_cycle_count: actorCycles.length,
    cycle_item_count: cycleItems.length,
    pending_human_review_count: cycleItems.filter((item) => item.cycle_status === "pending_human_review").length,
    ready_for_application_count: cycleItems.filter((item) => item.cycle_status === "ready_for_application").length,
    attention_count: cycleItems.filter((item) => item.cycle_status === "attention").length,
    clear_count: cycleItems.filter((item) => item.cycle_status === "clear").length,
    original_feedback_item_count: sourceResults.human_review_validation_feedback.value?.summary?.feedback_item_count ?? 0,
    original_pending_count: sourceResults.human_review_validation_feedback.value?.summary?.pending_receipt_count ?? 0,
    original_ready_count: sourceResults.human_review_validation_feedback.value?.summary?.ready_for_application_count ?? 0,
    original_correction_count: sourceResults.human_review_validation_feedback.value?.summary?.needs_correction_count ?? 0,
    correction_workspace_item_count: sourceResults.human_review_correction_workspace.value?.summary?.correction_item_count ?? 0,
    correction_workspace_pending_count: sourceResults.human_review_correction_workspace.value?.summary?.pending_decision_count ?? 0,
    correction_workspace_correction_count: sourceResults.human_review_correction_workspace.value?.summary?.needs_correction_count ?? 0,
    correction_merge_item_count: correctionMerge?.summary?.merge_item_count ?? 0,
    correction_merge_pending_count: correctionMerge?.summary?.pending_receipt_count ?? 0,
    correction_merge_ready_count: correctionMerge?.summary?.ready_for_validation_count ?? 0,
    correction_merge_error_count: correctionMerge?.summary?.validation_error_count ?? 0,
    correction_validation_item_count: correctionValidation?.summary?.validation_item_count ?? 0,
    correction_validation_pending_count: correctionValidation?.summary?.pending_receipt_count ?? 0,
    correction_validation_ready_count: correctionValidation?.summary?.ready_to_apply_count ?? 0,
    correction_validation_error_count: correctionValidation?.summary?.error_count ?? 0,
    correction_feedback_item_count: sourceResults.human_review_correction_feedback.value?.summary?.feedback_item_count ?? 0,
    correction_feedback_pending_count: sourceResults.human_review_correction_feedback.value?.summary?.pending_receipt_count ?? 0,
    correction_feedback_ready_count: sourceResults.human_review_correction_feedback.value?.summary?.ready_for_application_count ?? 0,
    correction_feedback_correction_count: sourceResults.human_review_correction_feedback.value?.summary?.needs_correction_count ?? 0,
    protected_action_count: cycleItems.filter((item) => item.protected_action).length,
    evidence_decision_count: cycleItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(cycleItems, "required_actor"),
    by_gate_type: countBy(cycleItems, "gate_type"),
    by_cycle_status: countBy(cycleItems, "cycle_status"),
  };
}

function deriveCycleStatus(validation, cycleItems) {
  if (!validation.valid) return "blocked";
  if (cycleItems.some((item) => item.cycle_status === "attention")) return "attention";
  if (cycleItems.some((item) => item.cycle_status === "pending_human_review")) return "pending_human_review";
  if (cycleItems.some((item) => item.cycle_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function renderCycleLedgerMarkdown(ledger) {
  const lines = [
    "# Human Review Cycle Ledger",
    "",
    `- Cycle status: ${ledger.cycle_status}`,
    `- Actor cycles: ${ledger.summary.actor_cycle_count}`,
    `- Cycle items: ${ledger.summary.cycle_item_count}`,
    `- Pending human review: ${ledger.summary.pending_human_review_count}`,
    `- Ready for application: ${ledger.summary.ready_for_application_count}`,
    `- Attention: ${ledger.summary.attention_count}`,
    `- Validation errors: ${ledger.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is ledger-only.",
    "- It does not apply receipts or execute protected actions.",
    "- It connects validation feedback, correction workspace, correction validation, and correction feedback into one review cycle view.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of ledger.actor_cycles) {
    lines.push(`- ${actor.required_actor}: ${actor.cycle_item_count} item(s), ${actor.pending_human_review_count} pending, ${actor.cycle_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorCycleMarkdown(actor, items) {
  const lines = [
    `# Human Review Cycle: ${actor.required_actor}`,
    "",
    `- Cycle status: ${actor.cycle_status}`,
    `- Cycle items: ${actor.cycle_item_count}`,
    `- Pending human review: ${actor.pending_human_review_count}`,
    `- Ready for application: ${actor.ready_for_application_count}`,
    `- Attention: ${actor.attention_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Cycle status: ${item.cycle_status}`);
    lines.push(`- Correction feedback: ${item.correction_feedback_status}`);
    lines.push(`- Correction validation: ${item.correction_validation_status}`);
    lines.push(`- Receipt status: ${item.receipt_status}`);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function mapByGate(items) {
  return new Map((items ?? []).map((item) => [item.gate_item_id, item]));
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

function compareCycleItems(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorCycles(a, b) {
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
    else if (arg === "--validation-feedback") args.validationFeedbackPath = argv[++index];
    else if (arg === "--correction-workspace") args.correctionWorkspacePath = argv[++index];
    else if (arg === "--correction-merge") args.correctionWorkspaceMergePath = argv[++index];
    else if (arg === "--correction-validation") args.correctionValidationPath = argv[++index];
    else if (arg === "--correction-feedback") args.correctionFeedbackPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-ledger.mjs [options]

Options:
  --validation-feedback <path>   Human review validation feedback artifact
  --correction-workspace <path>  Human review correction workspace artifact
  --correction-merge <path>      Human review correction workspace merge artifact
  --correction-validation <path> Human review correction validation artifact
  --correction-feedback <path>   Human review correction feedback artifact
  --out-dir <dir>                Output directory
  --run-at <iso>                 Override generated_at
  --check                        Exit non-zero when validation fails
`);
}
