import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_OUT_DIR = "artifacts/human-review-cycle-work-orders/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_INPUTS = {
  cycleLedgerPath: "artifacts/human-review-cycle-ledger/latest/human-review-cycle-ledger.json",
  correctionWorkspacePath: "artifacts/human-review-correction-workspace/latest/human-review-correction-workspace.json",
  correctionFeedbackPath: "artifacts/human-review-correction-feedback/latest/human-review-correction-feedback.json",
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
  ready_for_application: 3,
  clear: 4,
};

export async function runHumanReviewCycleWorkOrders(options = {}) {
  const result = await buildHumanReviewCycleWorkOrders(options);
  if (options.write !== false) await writeHumanReviewCycleWorkOrders(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle work orders failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleWorkOrders(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const inputPaths = resolveInputPaths(options);
  const sourceResults = {
    human_review_cycle_ledger: await readJsonOrError(inputPaths.cycleLedgerPath),
    human_review_correction_workspace: await readJsonOrError(inputPaths.correctionWorkspacePath),
    human_review_correction_feedback: await readJsonOrError(inputPaths.correctionFeedbackPath),
  };
  const sources = [
    buildSource("human_review_cycle_ledger", "Human Review Cycle Ledger", inputPaths.cycleLedgerPath, sourceResults.human_review_cycle_ledger),
    buildSource("human_review_correction_workspace", "Human Review Correction Workspace", inputPaths.correctionWorkspacePath, sourceResults.human_review_correction_workspace),
    buildSource("human_review_correction_feedback", "Human Review Correction Feedback", inputPaths.correctionFeedbackPath, sourceResults.human_review_correction_feedback),
  ];
  const workOrderItems = buildWorkOrderItems(sourceResults);
  const actorWorkOrders = buildActorWorkOrders(sourceResults, workOrderItems, outputDir);
  const validation = validateCycleWorkOrders({ sources, sourceResults, actorWorkOrders, workOrderItems });
  const workOrders = {
    schema_version: "human-review-cycle-work-orders.v1",
    generated_at: generatedAt,
    work_order_run_id: `human-review-cycle-work-orders.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    work_order_status: deriveWorkOrderRunStatus(validation, actorWorkOrders),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      work_order_only: true,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeCycleWorkOrders(actorWorkOrders, workOrderItems, sources, sourceResults, validation),
    actor_work_orders: actorWorkOrders,
    work_order_items: workOrderItems,
    validation,
  };

  return {
    ...workOrders,
    markdown: renderCycleWorkOrdersMarkdown(workOrders),
  };
}

export async function writeHumanReviewCycleWorkOrders(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-work-orders.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    work_order_run_id: result.work_order_run_id,
    output_dir: result.output_dir,
    work_order_status: result.work_order_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_work_orders: result.actor_work_orders,
    work_order_items: result.work_order_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "work-order-items.json"), {
    generated_at: result.generated_at,
    count: result.work_order_items.length,
    work_order_items: result.work_order_items,
  });
  await writeJson(path.join(outDir, "actor-work-orders.json"), {
    generated_at: result.generated_at,
    count: result.actor_work_orders.length,
    actor_work_orders: result.actor_work_orders,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const workOrder of result.actor_work_orders) {
    const actorDir = path.join(outDir, "actors", workOrder.required_actor);
    const items = result.work_order_items.filter((item) => item.work_order_id === workOrder.work_order_id);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "work-order.json"), {
      generated_at: result.generated_at,
      required_actor: workOrder.required_actor,
      work_order_status: workOrder.work_order_status,
      count: items.length,
      work_order: workOrder,
      work_order_items: items,
    });
    await writeFile(path.join(actorDir, "work-order.md"), renderActorWorkOrderMarkdown(workOrder, items), "utf8");
  }
}

export async function runHumanReviewCycleWorkOrdersCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleWorkOrders(args);
    console.log(`Human review cycle work orders ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Work order status: ${result.work_order_status}`);
    console.log(`Actor work orders: ${result.summary.actor_work_order_count}`);
    console.log(`Work order items: ${result.summary.work_order_item_count}`);
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
    cycleLedgerPath: path.resolve(options.cycleLedgerPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_INPUTS.cycleLedgerPath),
    correctionWorkspacePath: path.resolve(options.correctionWorkspacePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_INPUTS.correctionWorkspacePath),
    correctionFeedbackPath: path.resolve(options.correctionFeedbackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDERS_INPUTS.correctionFeedbackPath),
  };
}

function buildWorkOrderItems(sourceResults) {
  const ledger = sourceResults.human_review_cycle_ledger.value;
  if (!ledger) return [];
  const feedbackByGate = mapByGate(sourceResults.human_review_correction_feedback.value?.feedback_items ?? []);
  const correctionWorkspaceByActor = new Map((sourceResults.human_review_correction_workspace.value?.actor_workspaces ?? []).map((actor) => [actor.required_actor, actor]));
  const actorCycleByActor = new Map((ledger.actor_cycles ?? []).map((actor) => [actor.required_actor, actor]));
  return (ledger.cycle_items ?? [])
    .map((cycleItem) => {
      const feedback = feedbackByGate.get(cycleItem.gate_item_id);
      const correctionWorkspace = correctionWorkspaceByActor.get(cycleItem.required_actor);
      const actorCycle = actorCycleByActor.get(cycleItem.required_actor);
      const workOrderId = `human-review-cycle-work-order.${slugify(cycleItem.required_actor)}`;
      const workOrderStatus = normalizeWorkOrderStatus(cycleItem.cycle_status);
      return {
        work_order_item_id: `${workOrderId}.item.${slugify(cycleItem.gate_item_id ?? cycleItem.cycle_item_id)}`,
        work_order_id: workOrderId,
        cycle_id: ledger.cycle_id ?? null,
        actor_cycle_id: actorCycle?.actor_cycle_id ?? null,
        cycle_item_id: cycleItem.cycle_item_id,
        gate_item_id: cycleItem.gate_item_id,
        source_plan_item_id: cycleItem.source_plan_item_id ?? null,
        required_actor: cycleItem.required_actor,
        gate_type: cycleItem.gate_type,
        priority: cycleItem.priority,
        work_order_status: workOrderStatus,
        cycle_status: cycleItem.cycle_status,
        protected_action: Boolean(cycleItem.protected_action),
        evidence_decision: Boolean(cycleItem.evidence_decision),
        receipt_id: cycleItem.receipt_id ?? null,
        receipt_status: cycleItem.receipt_status ?? null,
        outcome: cycleItem.outcome ?? null,
        correction_feedback_item_id: cycleItem.correction_feedback_item_id ?? null,
        correction_feedback_status: cycleItem.correction_feedback_status ?? null,
        correction_validation_item_id: cycleItem.correction_validation_item_id ?? null,
        correction_validation_status: cycleItem.correction_validation_status ?? null,
        ready_to_apply: Boolean(cycleItem.ready_to_apply),
        allowed_outcomes: feedback?.allowed_outcomes ?? [],
        required_receipt_fields: feedback?.required_receipt_fields ?? [],
        target_receipt_input_path: correctionWorkspace?.receipt_input_path ?? feedback?.target_receipt_input_path ?? null,
        target_decision_json_path: correctionWorkspace?.correction_json_path ?? feedback?.target_decision_json_path ?? null,
        next_actions: normalizeNextActions(cycleItem),
        review_instructions: buildReviewInstructions(cycleItem, feedback),
        source_refs: {
          cycle_item_id: cycleItem.cycle_item_id,
          actor_cycle_id: actorCycle?.actor_cycle_id ?? null,
          correction_feedback_item_id: cycleItem.correction_feedback_item_id ?? null,
          correction_item_id: cycleItem.correction_item_id ?? null,
          correction_merge_item_id: cycleItem.correction_merge_item_id ?? null,
          correction_validation_item_id: cycleItem.correction_validation_item_id ?? null,
        },
        safe_handling: {
          auto_execute_allowed: false,
          protected_actions_executed: false,
          work_order_only: true,
        },
      };
    })
    .sort(compareWorkOrderItems);
}

function buildActorWorkOrders(sourceResults, workOrderItems, outputDir) {
  const ledger = sourceResults.human_review_cycle_ledger.value;
  if (!ledger) return [];
  const cycleByActor = new Map((ledger.actor_cycles ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(workOrderItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const actorCycle = cycleByActor.get(requiredActor);
      const workOrderId = `human-review-cycle-work-order.${slugify(requiredActor)}`;
      return {
        work_order_id: workOrderId,
        cycle_id: ledger.cycle_id ?? null,
        actor_cycle_id: actorCycle?.actor_cycle_id ?? null,
        actor_feedback_id: actorCycle?.actor_feedback_id ?? null,
        required_actor: requiredActor,
        work_order_status: deriveActorWorkOrderStatus(items),
        priority: highestPriority(items),
        work_order_item_count: items.length,
        pending_human_review_count: items.filter((item) => item.work_order_status === "pending_human_review").length,
        ready_for_application_count: items.filter((item) => item.work_order_status === "ready_for_application").length,
        attention_count: items.filter((item) => item.work_order_status === "attention").length,
        clear_count: items.filter((item) => item.work_order_status === "clear").length,
        protected_action_count: items.filter((item) => item.protected_action).length,
        evidence_decision_count: items.filter((item) => item.evidence_decision).length,
        work_order_item_ids: items.map((item) => item.work_order_item_id),
        source_cycle_json_path: actorCycle?.cycle_json_path ?? null,
        source_cycle_markdown_path: actorCycle?.cycle_markdown_path ?? null,
        work_order_json_path: path.join(outputDir, "actors", requiredActor, "work-order.json"),
        work_order_markdown_path: path.join(outputDir, "actors", requiredActor, "work-order.md"),
        checklist: buildActorChecklist(requiredActor, items),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          work_order_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorWorkOrders);
}

function validateCycleWorkOrders({ sources, sourceResults, actorWorkOrders, workOrderItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) {
      errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
    }
  }
  const cycleItemCount = sourceResults.human_review_cycle_ledger.value?.summary?.cycle_item_count ?? 0;
  const actorCycleCount = sourceResults.human_review_cycle_ledger.value?.summary?.actor_cycle_count ?? 0;
  if (cycleItemCount > 0 && workOrderItems.length !== cycleItemCount) {
    errors.push({ path: "work_order_items", message: "Work order item count must match cycle ledger item count." });
  }
  if (actorCycleCount > 0 && actorWorkOrders.length !== actorCycleCount) {
    errors.push({ path: "actor_work_orders", message: "Actor work order count must match cycle ledger actor cycle count." });
  }
  for (const item of workOrderItems) {
    if (!item.cycle_item_id || !item.gate_item_id || !item.work_order_id) {
      errors.push({ path: `work_order_items.${item.work_order_item_id}`, message: "Work order item must keep cycle, gate, and work order linkage." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `work_order_items.${item.work_order_item_id}.safe_handling`, message: "Work orders must not execute protected actions." });
    }
  }
  for (const order of actorWorkOrders) {
    if (order.safe_handling.auto_execute_allowed || order.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_work_orders.${order.work_order_id}.safe_handling`, message: "Actor work orders must not execute protected actions." });
    }
    if (order.work_order_item_count !== order.work_order_item_ids.length) {
      errors.push({ path: `actor_work_orders.${order.work_order_id}.work_order_item_ids`, message: "Actor work order item ids must match item count." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCycleWorkOrders(actorWorkOrders, workOrderItems, sources, sourceResults, validation) {
  return {
    work_order_status: deriveWorkOrderRunStatus(validation, actorWorkOrders),
    source_count: sources.length,
    unavailable_source_count: sources.filter((source) => !source.available).length,
    source_cycle_id: sourceResults.human_review_cycle_ledger.value?.cycle_id ?? null,
    source_cycle_status: sourceResults.human_review_cycle_ledger.value?.cycle_status ?? null,
    source_cycle_item_count: sourceResults.human_review_cycle_ledger.value?.summary?.cycle_item_count ?? 0,
    source_actor_cycle_count: sourceResults.human_review_cycle_ledger.value?.summary?.actor_cycle_count ?? 0,
    actor_work_order_count: actorWorkOrders.length,
    work_order_item_count: workOrderItems.length,
    pending_human_review_count: workOrderItems.filter((item) => item.work_order_status === "pending_human_review").length,
    ready_for_application_count: workOrderItems.filter((item) => item.work_order_status === "ready_for_application").length,
    attention_count: workOrderItems.filter((item) => item.work_order_status === "attention").length,
    clear_count: workOrderItems.filter((item) => item.work_order_status === "clear").length,
    protected_action_count: workOrderItems.filter((item) => item.protected_action).length,
    evidence_decision_count: workOrderItems.filter((item) => item.evidence_decision).length,
    missing_target_path_count: workOrderItems.filter((item) => item.work_order_status !== "clear" && !item.target_receipt_input_path).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(workOrderItems, "required_actor"),
    by_gate_type: countBy(workOrderItems, "gate_type"),
    by_work_order_status: countBy(workOrderItems, "work_order_status"),
    by_priority: countBy(workOrderItems, "priority"),
  };
}

function deriveWorkOrderRunStatus(validation, actorWorkOrders) {
  if (!validation.valid) return "blocked";
  if (actorWorkOrders.some((order) => order.work_order_status === "attention")) return "attention";
  if (actorWorkOrders.some((order) => order.work_order_status === "pending_human_review")) return "pending_human_review";
  if (actorWorkOrders.some((order) => order.work_order_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function deriveActorWorkOrderStatus(items) {
  if (items.some((item) => item.work_order_status === "attention")) return "attention";
  if (items.some((item) => item.work_order_status === "pending_human_review")) return "pending_human_review";
  if (items.some((item) => item.work_order_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function normalizeWorkOrderStatus(cycleStatus) {
  if (cycleStatus === "attention") return "attention";
  if (cycleStatus === "pending_human_review") return "pending_human_review";
  if (cycleStatus === "ready_for_application") return "ready_for_application";
  return "clear";
}

function normalizeNextActions(cycleItem) {
  const actions = cycleItem.next_actions ?? [];
  if (actions.length > 0) return actions;
  if (cycleItem.cycle_status === "pending_human_review") return ["open_actor_work_order", "complete_required_receipt_fields", "rerun_review_cycle"];
  if (cycleItem.cycle_status === "ready_for_application") return ["review_validated_receipt", "wait_for_authorized_application_gate"];
  if (cycleItem.cycle_status === "attention") return ["inspect_cycle_errors", "rerun_review_cycle_after_fix"];
  return ["no_action_required"];
}

function buildReviewInstructions(cycleItem, feedback) {
  if (cycleItem.cycle_status === "pending_human_review") {
    const fields = feedback?.required_receipt_fields?.length > 0
      ? `Required fields: ${feedback.required_receipt_fields.join(", ")}.`
      : "Fill all required receipt fields.";
    return [
      "Review the source gate item and any linked context before deciding.",
      fields,
      "Set receipt_status and outcome to a terminal human decision, then rerun the correction merge and validation stages.",
    ];
  }
  if (cycleItem.cycle_status === "ready_for_application") {
    return [
      "Review the validated receipt before application.",
      "Do not apply protected actions without the separate authorized application gate.",
    ];
  }
  if (cycleItem.cycle_status === "attention") {
    return [
      "Inspect the linked correction feedback and validation errors.",
      "Fix the actor receipt input, then rerun the review cycle.",
    ];
  }
  return ["No human action is currently required for this item."];
}

function buildActorChecklist(requiredActor, items) {
  const checklist = [
    `Open the ${requiredActor} work order artifact.`,
    "Review each pending or attention item before editing any receipt input.",
  ];
  if (items.some((item) => item.target_receipt_input_path)) checklist.push("Use the target receipt input paths listed on each item for edits.");
  if (items.some((item) => item.protected_action)) checklist.push("Protected actions remain draft-only until an authorized application gate runs.");
  if (items.some((item) => item.evidence_decision)) checklist.push("Evidence decisions must preserve citation/evidence lineage notes.");
  checklist.push("Rerun npm run control-plane:review-cycle:work-orders after correction stages refresh.");
  return checklist;
}

function renderCycleWorkOrdersMarkdown(workOrders) {
  const lines = [
    "# Human Review Cycle Work Orders",
    "",
    `- Work order status: ${workOrders.work_order_status}`,
    `- Actor work orders: ${workOrders.summary.actor_work_order_count}`,
    `- Work order items: ${workOrders.summary.work_order_item_count}`,
    `- Pending human review: ${workOrders.summary.pending_human_review_count}`,
    `- Ready for application: ${workOrders.summary.ready_for_application_count}`,
    `- Attention: ${workOrders.summary.attention_count}`,
    `- Validation errors: ${workOrders.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is work-order-only.",
    "- It does not apply receipts or execute protected actions.",
    "- It converts the review cycle ledger into actor-specific review queues.",
    "",
    "## Actors",
    "",
  ];
  for (const order of workOrders.actor_work_orders) {
    lines.push(`- ${order.required_actor}: ${order.work_order_item_count} item(s), ${order.pending_human_review_count} pending, ${order.work_order_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorWorkOrderMarkdown(workOrder, items) {
  const lines = [
    `# Human Review Cycle Work Order: ${workOrder.required_actor}`,
    "",
    `- Work order status: ${workOrder.work_order_status}`,
    `- Work order items: ${workOrder.work_order_item_count}`,
    `- Pending human review: ${workOrder.pending_human_review_count}`,
    `- Ready for application: ${workOrder.ready_for_application_count}`,
    `- Attention: ${workOrder.attention_count}`,
    "",
    "## Checklist",
    "",
    ...workOrder.checklist.map((item) => `- ${item}`),
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Work order status: ${item.work_order_status}`);
    lines.push(`- Gate type: ${item.gate_type}`);
    lines.push(`- Priority: ${item.priority}`);
    lines.push(`- Receipt status: ${item.receipt_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
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

function compareWorkOrderItems(a, b) {
  return (STATUS_ORDER[a.work_order_status] ?? 99) - (STATUS_ORDER[b.work_order_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorWorkOrders(a, b) {
  return (STATUS_ORDER[a.work_order_status] ?? 99) - (STATUS_ORDER[b.work_order_status] ?? 99)
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
    else if (arg === "--cycle-ledger") args.cycleLedgerPath = argv[++index];
    else if (arg === "--correction-workspace") args.correctionWorkspacePath = argv[++index];
    else if (arg === "--correction-feedback") args.correctionFeedbackPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-work-orders.mjs [options]

Options:
  --cycle-ledger <path>          Human review cycle ledger artifact
  --correction-workspace <path>  Human review correction workspace artifact for actor receipt paths
  --correction-feedback <path>   Human review correction feedback artifact for target receipt paths
  --out-dir <dir>                Output directory
  --run-at <iso>                 Override generated_at
  --check                        Exit non-zero when validation fails
`);
}
