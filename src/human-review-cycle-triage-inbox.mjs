import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_TRIAGE_INBOX_OUT_DIR = "artifacts/human-review-cycle-triage-inbox/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_TRIAGE_INBOX_INPUTS = {
  workOrdersPath: "artifacts/human-review-cycle-work-orders/latest/human-review-cycle-work-orders.json",
  targetAuditPath: "artifacts/human-review-cycle-work-order-target-audit/latest/human-review-cycle-work-order-target-audit.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const TRIAGE_STATUS_ORDER = {
  blocked: 0,
  attention: 1,
  ready_for_human_review: 2,
  ready_for_application: 3,
  clear: 4,
};

export async function runHumanReviewCycleTriageInbox(options = {}) {
  const result = await buildHumanReviewCycleTriageInbox(options);
  if (options.write !== false) await writeHumanReviewCycleTriageInbox(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle triage inbox failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleTriageInbox(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_TRIAGE_INBOX_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const inputPaths = resolveInputPaths(options);
  const sourceResults = {
    human_review_cycle_work_orders: await readJsonOrError(inputPaths.workOrdersPath),
    human_review_cycle_target_audit: await readJsonOrError(inputPaths.targetAuditPath),
  };
  const sources = [
    buildSource("human_review_cycle_work_orders", "Human Review Cycle Work Orders", inputPaths.workOrdersPath, sourceResults.human_review_cycle_work_orders),
    buildSource("human_review_cycle_target_audit", "Human Review Cycle Target Audit", inputPaths.targetAuditPath, sourceResults.human_review_cycle_target_audit),
  ];
  const triageItems = buildTriageItems(sourceResults);
  const actorInboxes = buildActorTriageInboxes(sourceResults, triageItems, outputDir);
  const validation = validateTriageInbox({ sources, sourceResults, actorInboxes, triageItems });
  const inbox = {
    schema_version: "human-review-cycle-triage-inbox.v1",
    generated_at: generatedAt,
    triage_inbox_id: `human-review-cycle-triage-inbox.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    triage_status: deriveTriageInboxStatus(validation, triageItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      inbox_only: true,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeTriageInbox(actorInboxes, triageItems, sources, sourceResults, validation),
    actor_triage_inboxes: actorInboxes,
    triage_items: triageItems,
    validation,
  };

  return {
    ...inbox,
    markdown: renderTriageInboxMarkdown(inbox),
  };
}

export async function writeHumanReviewCycleTriageInbox(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-triage-inbox.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    triage_inbox_id: result.triage_inbox_id,
    output_dir: result.output_dir,
    triage_status: result.triage_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_triage_inboxes: result.actor_triage_inboxes,
    triage_items: result.triage_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "triage-items.json"), {
    generated_at: result.generated_at,
    count: result.triage_items.length,
    triage_items: result.triage_items,
  });
  await writeJson(path.join(outDir, "actor-triage-inboxes.json"), {
    generated_at: result.generated_at,
    count: result.actor_triage_inboxes.length,
    actor_triage_inboxes: result.actor_triage_inboxes,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_triage_inboxes) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.triage_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "triage-inbox.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      triage_status: actor.triage_status,
      count: items.length,
      actor_triage_inbox: actor,
      triage_items: items,
    });
    await writeFile(path.join(actorDir, "triage-inbox.md"), renderActorTriageInboxMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleTriageInboxCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleTriageInbox(args);
    console.log(`Human review cycle triage inbox ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Triage status: ${result.triage_status}`);
    console.log(`Actor inboxes: ${result.summary.actor_triage_inbox_count}`);
    console.log(`Triage items: ${result.summary.triage_item_count}`);
    console.log(`Ready for human review: ${result.summary.ready_for_human_review_count}`);
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
    workOrdersPath: path.resolve(options.workOrdersPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_TRIAGE_INBOX_INPUTS.workOrdersPath),
    targetAuditPath: path.resolve(options.targetAuditPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_TRIAGE_INBOX_INPUTS.targetAuditPath),
  };
}

function buildTriageItems(sourceResults) {
  const workOrderItems = sourceResults.human_review_cycle_work_orders.value?.work_order_items ?? [];
  const targetAuditByWorkOrderItem = new Map((sourceResults.human_review_cycle_target_audit.value?.target_audit_items ?? []).map((item) => [item.work_order_item_id, item]));
  return workOrderItems.map((workOrderItem, index) => {
    const targetAudit = targetAuditByWorkOrderItem.get(workOrderItem.work_order_item_id);
    const triageStatus = deriveTriageItemStatus(workOrderItem, targetAudit);
    return {
      triage_item_id: `human-review-cycle-triage.${slugify(workOrderItem.gate_item_id)}`,
      triage_rank: index + 1,
      actor_triage_inbox_id: `human-review-cycle-triage-inbox.actor.${slugify(workOrderItem.required_actor)}`,
      work_order_item_id: workOrderItem.work_order_item_id,
      work_order_id: workOrderItem.work_order_id,
      target_audit_item_id: targetAudit?.target_audit_item_id ?? null,
      cycle_item_id: workOrderItem.cycle_item_id,
      gate_item_id: workOrderItem.gate_item_id,
      receipt_id: workOrderItem.receipt_id,
      required_actor: workOrderItem.required_actor,
      gate_type: workOrderItem.gate_type,
      priority: workOrderItem.priority,
      triage_status: triageStatus,
      work_order_status: workOrderItem.work_order_status,
      target_audit_status: targetAudit?.target_audit_status ?? "missing_target_audit",
      protected_action: Boolean(workOrderItem.protected_action),
      evidence_decision: Boolean(workOrderItem.evidence_decision),
      receipt_row_status: targetAudit?.receipt_row_status ?? workOrderItem.receipt_status ?? null,
      receipt_row_outcome: targetAudit?.receipt_row_outcome ?? workOrderItem.outcome ?? null,
      target_receipt_input_path: workOrderItem.target_receipt_input_path,
      target_decision_json_path: workOrderItem.target_decision_json_path,
      target_file_available: Boolean(targetAudit?.target_file_available),
      receipt_row_present: Boolean(targetAudit?.receipt_row_present),
      required_receipt_fields: workOrderItem.required_receipt_fields ?? [],
      missing_required_fields: targetAudit?.missing_required_fields ?? [],
      mismatch_fields: targetAudit?.mismatch_fields ?? [],
      review_instructions: workOrderItem.review_instructions ?? [],
      next_actions: buildTriageNextActions(triageStatus, workOrderItem, targetAudit),
      source_refs: {
        work_order_item_id: workOrderItem.work_order_item_id,
        target_audit_item_id: targetAudit?.target_audit_item_id ?? null,
        cycle_item_id: workOrderItem.cycle_item_id,
        correction_feedback_item_id: workOrderItem.source_refs?.correction_feedback_item_id ?? null,
      },
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        inbox_only: true,
      },
    };
  }).sort(compareTriageItems).map((item, index) => ({ ...item, triage_rank: index + 1 }));
}

function buildActorTriageInboxes(sourceResults, triageItems, outputDir) {
  const actorWorkOrdersByActor = new Map((sourceResults.human_review_cycle_work_orders.value?.actor_work_orders ?? []).map((actor) => [actor.required_actor, actor]));
  const actorAuditsByActor = new Map((sourceResults.human_review_cycle_target_audit.value?.actor_target_audits ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(triageItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const workOrder = actorWorkOrdersByActor.get(requiredActor);
      const targetAudit = actorAuditsByActor.get(requiredActor);
      return {
        actor_triage_inbox_id: `human-review-cycle-triage-inbox.actor.${slugify(requiredActor)}`,
        work_order_id: workOrder?.work_order_id ?? null,
        actor_target_audit_id: targetAudit?.actor_target_audit_id ?? null,
        required_actor: requiredActor,
        triage_status: deriveActorTriageStatus(items),
        priority: highestPriority(items),
        triage_item_count: items.length,
        ready_for_human_review_count: items.filter((item) => item.triage_status === "ready_for_human_review").length,
        ready_for_application_count: items.filter((item) => item.triage_status === "ready_for_application").length,
        attention_count: items.filter((item) => item.triage_status === "attention").length,
        blocked_count: items.filter((item) => item.triage_status === "blocked").length,
        protected_action_count: items.filter((item) => item.protected_action).length,
        evidence_decision_count: items.filter((item) => item.evidence_decision).length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        top_triage_item_ids: items.slice(0, 5).map((item) => item.triage_item_id),
        triage_json_path: path.join(outputDir, "actors", requiredActor, "triage-inbox.json"),
        triage_markdown_path: path.join(outputDir, "actors", requiredActor, "triage-inbox.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          inbox_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorTriageInboxes);
}

function validateTriageInbox({ sources, sourceResults, actorInboxes, triageItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) {
      errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
    }
  }
  const expectedWorkOrderCount = sourceResults.human_review_cycle_work_orders.value?.summary?.work_order_item_count ?? 0;
  const expectedTargetAuditCount = sourceResults.human_review_cycle_target_audit.value?.summary?.target_audit_item_count ?? 0;
  const expectedActorCount = sourceResults.human_review_cycle_work_orders.value?.summary?.actor_work_order_count ?? 0;
  if (expectedWorkOrderCount > 0 && triageItems.length !== expectedWorkOrderCount) {
    errors.push({ path: "triage_items", message: "Triage item count must match work order item count." });
  }
  if (expectedTargetAuditCount > 0 && triageItems.length !== expectedTargetAuditCount) {
    errors.push({ path: "triage_items", message: "Triage item count must match target audit item count." });
  }
  if (expectedActorCount > 0 && actorInboxes.length !== expectedActorCount) {
    errors.push({ path: "actor_triage_inboxes", message: "Actor triage inbox count must match actor work order count." });
  }
  for (const item of triageItems) {
    if (!item.target_audit_item_id) {
      errors.push({ path: `triage_items.${item.triage_item_id}.target_audit_item_id`, message: "Triage item is missing target audit linkage." });
    }
    if (item.triage_status === "blocked") {
      errors.push({ path: `triage_items.${item.triage_item_id}`, message: "Triage item is blocked by missing target file or row." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `triage_items.${item.triage_item_id}.safe_handling`, message: "Triage inbox must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeTriageInbox(actorInboxes, triageItems, sources, sourceResults, validation) {
  return {
    triage_status: deriveTriageInboxStatus(validation, triageItems),
    source_count: sources.length,
    unavailable_source_count: sources.filter((source) => !source.available).length,
    source_work_order_item_count: sourceResults.human_review_cycle_work_orders.value?.summary?.work_order_item_count ?? 0,
    source_target_audit_item_count: sourceResults.human_review_cycle_target_audit.value?.summary?.target_audit_item_count ?? 0,
    actor_triage_inbox_count: actorInboxes.length,
    triage_item_count: triageItems.length,
    ready_for_human_review_count: triageItems.filter((item) => item.triage_status === "ready_for_human_review").length,
    ready_for_application_count: triageItems.filter((item) => item.triage_status === "ready_for_application").length,
    attention_count: triageItems.filter((item) => item.triage_status === "attention").length,
    blocked_count: triageItems.filter((item) => item.triage_status === "blocked").length,
    protected_action_count: triageItems.filter((item) => item.protected_action).length,
    evidence_decision_count: triageItems.filter((item) => item.evidence_decision).length,
    target_file_count: new Set(triageItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    missing_target_audit_count: triageItems.filter((item) => !item.target_audit_item_id).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(triageItems, "required_actor"),
    by_gate_type: countBy(triageItems, "gate_type"),
    by_triage_status: countBy(triageItems, "triage_status"),
    by_priority: countBy(triageItems, "priority"),
  };
}

function deriveTriageInboxStatus(validation, triageItems) {
  if (!validation.valid) return "blocked";
  if (triageItems.some((item) => item.triage_status === "blocked")) return "blocked";
  if (triageItems.some((item) => item.triage_status === "attention")) return "attention";
  if (triageItems.some((item) => item.triage_status === "ready_for_human_review")) return "ready_for_human_review";
  if (triageItems.some((item) => item.triage_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function deriveActorTriageStatus(items) {
  if (items.some((item) => item.triage_status === "blocked")) return "blocked";
  if (items.some((item) => item.triage_status === "attention")) return "attention";
  if (items.some((item) => item.triage_status === "ready_for_human_review")) return "ready_for_human_review";
  if (items.some((item) => item.triage_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function deriveTriageItemStatus(workOrderItem, targetAudit) {
  if (!targetAudit || targetAudit.target_audit_status === "blocked") return "blocked";
  if (targetAudit.target_audit_status === "attention") return "attention";
  if (workOrderItem.work_order_status === "ready_for_application") return "ready_for_application";
  if (workOrderItem.work_order_status === "pending_human_review" && targetAudit.target_audit_status === "ready_for_human_review") return "ready_for_human_review";
  if (workOrderItem.work_order_status === "attention") return "attention";
  return "clear";
}

function buildTriageNextActions(triageStatus, workOrderItem, targetAudit) {
  if (triageStatus === "ready_for_human_review") return ["open_target_receipt_input", "complete_required_receipt_fields", "rerun_review_cycle_after_decision"];
  if (triageStatus === "ready_for_application") return ["review_validated_receipt", "wait_for_authorized_application_gate"];
  if (triageStatus === "attention") return targetAudit?.next_actions ?? ["inspect_triage_item", "rerun_target_audit"];
  if (triageStatus === "blocked") return ["regenerate_work_orders", "rerun_target_audit"];
  return workOrderItem.next_actions ?? ["no_action_required"];
}

function renderTriageInboxMarkdown(inbox) {
  const lines = [
    "# Human Review Cycle Triage Inbox",
    "",
    `- Triage status: ${inbox.triage_status}`,
    `- Actor inboxes: ${inbox.summary.actor_triage_inbox_count}`,
    `- Triage items: ${inbox.summary.triage_item_count}`,
    `- Ready for human review: ${inbox.summary.ready_for_human_review_count}`,
    `- Attention: ${inbox.summary.attention_count}`,
    `- Blocked: ${inbox.summary.blocked_count}`,
    `- Validation errors: ${inbox.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is inbox-only.",
    "- It does not edit receipts or execute protected actions.",
    "- It points reviewers to verified target receipt input files.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of inbox.actor_triage_inboxes) {
    lines.push(`- ${actor.required_actor}: ${actor.triage_item_count} item(s), ${actor.ready_for_human_review_count} ready, ${actor.triage_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorTriageInboxMarkdown(actor, items) {
  const lines = [
    `# Human Review Cycle Triage Inbox: ${actor.required_actor}`,
    "",
    `- Triage status: ${actor.triage_status}`,
    `- Triage items: ${actor.triage_item_count}`,
    `- Ready for human review: ${actor.ready_for_human_review_count}`,
    `- Attention: ${actor.attention_count}`,
    `- Blocked: ${actor.blocked_count}`,
    "",
    "## Top Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.triage_rank}. ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Triage status: ${item.triage_status}`);
    lines.push(`- Gate type: ${item.gate_type}`);
    lines.push(`- Priority: ${item.priority}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
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

function compareTriageItems(a, b) {
  return (TRIAGE_STATUS_ORDER[a.triage_status] ?? 99) - (TRIAGE_STATUS_ORDER[b.triage_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorTriageInboxes(a, b) {
  return (TRIAGE_STATUS_ORDER[a.triage_status] ?? 99) - (TRIAGE_STATUS_ORDER[b.triage_status] ?? 99)
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
    else if (arg === "--work-orders") args.workOrdersPath = argv[++index];
    else if (arg === "--target-audit") args.targetAuditPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-triage-inbox.mjs [options]

Options:
  --work-orders <path>           Human Review Cycle Work Orders artifact
  --target-audit <path>          Human Review Cycle Target Audit artifact
  --out-dir <dir>                Output directory
  --run-at <iso>                 Override generated_at
  --check                        Exit non-zero when validation fails
`);
}
