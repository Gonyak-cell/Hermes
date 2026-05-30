import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDER_TARGET_AUDIT_OUT_DIR = "artifacts/human-review-cycle-work-order-target-audit/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDER_TARGET_AUDIT_INPUTS = {
  workOrdersPath: "artifacts/human-review-cycle-work-orders/latest/human-review-cycle-work-orders.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleWorkOrderTargetAudit(options = {}) {
  const result = await buildHumanReviewCycleWorkOrderTargetAudit(options);
  if (options.write !== false) await writeHumanReviewCycleWorkOrderTargetAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle work order target audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleWorkOrderTargetAudit(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDER_TARGET_AUDIT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const workOrdersPath = path.resolve(options.workOrdersPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_WORK_ORDER_TARGET_AUDIT_INPUTS.workOrdersPath);
  const workOrdersResult = await readJsonOrError(workOrdersPath);
  const targetCache = new Map();
  const auditItems = [];
  for (const item of workOrdersResult.value?.work_order_items ?? []) {
    auditItems.push(await buildTargetAuditItem(item, targetCache));
  }
  const actorAudits = buildActorTargetAudits(workOrdersResult.value?.actor_work_orders ?? [], auditItems, outputDir);
  const source = buildSource("human_review_cycle_work_orders", "Human Review Cycle Work Orders", workOrdersPath, workOrdersResult);
  const validation = validateTargetAudit({ source, workOrdersResult, actorAudits, auditItems });
  const audit = {
    schema_version: "human-review-cycle-work-order-target-audit.v1",
    generated_at: generatedAt,
    target_audit_id: `human-review-cycle-work-order-target-audit.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    target_audit_status: deriveTargetAuditStatus(validation, auditItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      audit_only: true,
      protected_actions_executed: false,
    },
    sources: [source],
    summary: summarizeTargetAudit(actorAudits, auditItems, source, workOrdersResult, validation),
    actor_target_audits: actorAudits,
    target_audit_items: auditItems,
    validation,
  };

  return {
    ...audit,
    markdown: renderTargetAuditMarkdown(audit),
  };
}

export async function writeHumanReviewCycleWorkOrderTargetAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-work-order-target-audit.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    target_audit_id: result.target_audit_id,
    output_dir: result.output_dir,
    target_audit_status: result.target_audit_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_target_audits: result.actor_target_audits,
    target_audit_items: result.target_audit_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "target-audit-items.json"), {
    generated_at: result.generated_at,
    count: result.target_audit_items.length,
    target_audit_items: result.target_audit_items,
  });
  await writeJson(path.join(outDir, "actor-target-audits.json"), {
    generated_at: result.generated_at,
    count: result.actor_target_audits.length,
    actor_target_audits: result.actor_target_audits,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_target_audits) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.target_audit_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "target-audit.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      target_audit_status: actor.target_audit_status,
      count: items.length,
      actor_target_audit: actor,
      target_audit_items: items,
    });
    await writeFile(path.join(actorDir, "target-audit.md"), renderActorTargetAuditMarkdown(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleWorkOrderTargetAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleWorkOrderTargetAudit(args);
    console.log(`Human review cycle work order target audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Target audit status: ${result.target_audit_status}`);
    console.log(`Target audit items: ${result.summary.target_audit_item_count}`);
    console.log(`Ready targets: ${result.summary.ready_target_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function buildTargetAuditItem(workOrderItem, targetCache) {
  const target = await readTarget(workOrderItem.target_receipt_input_path, targetCache);
  const decisionTarget = await readTargetPresence(workOrderItem.target_decision_json_path, targetCache);
  const receipt = target.receipts.find((candidate) => candidate.gate_item_id === workOrderItem.gate_item_id || candidate.receipt_id === workOrderItem.receipt_id) ?? null;
  const requiredFieldNames = workOrderItem.required_receipt_fields ?? [];
  const missingRequiredFields = receipt
    ? requiredFieldNames.filter((field) => !(field in receipt))
    : requiredFieldNames;
  const mismatches = [];
  if (receipt && workOrderItem.receipt_id && receipt.receipt_id !== workOrderItem.receipt_id) mismatches.push("receipt_id");
  if (receipt && workOrderItem.source_plan_item_id && receipt.source_plan_item_id !== workOrderItem.source_plan_item_id) mismatches.push("source_plan_item_id");
  if (receipt && workOrderItem.gate_type && receipt.gate_type !== workOrderItem.gate_type) mismatches.push("gate_type");
  const targetStatus = deriveTargetStatus(target, decisionTarget, receipt, missingRequiredFields, mismatches);
  return {
    target_audit_item_id: `human-review-cycle-work-order-target-audit.${slugify(workOrderItem.gate_item_id)}`,
    work_order_item_id: workOrderItem.work_order_item_id,
    work_order_id: workOrderItem.work_order_id,
    cycle_item_id: workOrderItem.cycle_item_id,
    gate_item_id: workOrderItem.gate_item_id,
    receipt_id: workOrderItem.receipt_id,
    required_actor: workOrderItem.required_actor,
    gate_type: workOrderItem.gate_type,
    priority: workOrderItem.priority,
    work_order_status: workOrderItem.work_order_status,
    target_audit_status: targetStatus,
    target_receipt_input_path: workOrderItem.target_receipt_input_path,
    target_decision_json_path: workOrderItem.target_decision_json_path,
    target_file_available: target.available,
    target_file_error: target.error,
    target_decision_file_available: decisionTarget.available,
    target_decision_file_error: decisionTarget.error,
    receipt_row_present: Boolean(receipt),
    receipt_row_status: receipt?.receipt_status ?? null,
    receipt_row_outcome: receipt?.outcome ?? null,
    required_receipt_fields: requiredFieldNames,
    missing_required_fields: missingRequiredFields,
    mismatch_fields: mismatches,
    next_actions: buildTargetAuditNextActions(targetStatus),
    safe_handling: {
      auto_execute_allowed: false,
      protected_actions_executed: false,
      audit_only: true,
    },
  };
}

function buildActorTargetAudits(actorWorkOrders, auditItems, outputDir) {
  const workOrderByActor = new Map((actorWorkOrders ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(auditItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const workOrder = workOrderByActor.get(requiredActor);
      return {
        actor_target_audit_id: `human-review-cycle-work-order-target-audit.actor.${slugify(requiredActor)}`,
        work_order_id: workOrder?.work_order_id ?? null,
        required_actor: requiredActor,
        target_audit_status: deriveActorTargetAuditStatus(items),
        priority: highestPriority(items),
        target_audit_item_count: items.length,
        ready_target_count: items.filter((item) => item.target_audit_status === "ready_for_human_review").length,
        attention_count: items.filter((item) => item.target_audit_status === "attention").length,
        blocked_count: items.filter((item) => item.target_audit_status === "blocked").length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        target_audit_item_ids: items.map((item) => item.target_audit_item_id),
        target_audit_json_path: path.join(outputDir, "actors", requiredActor, "target-audit.json"),
        target_audit_markdown_path: path.join(outputDir, "actors", requiredActor, "target-audit.md"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          audit_only: true,
          protected_actions_executed: false,
        },
      };
    })
    .sort(compareActorTargetAudits);
}

function validateTargetAudit({ source, workOrdersResult, actorAudits, auditItems }) {
  const errors = [];
  if (!source.available) errors.push({ path: "sources.human_review_cycle_work_orders", message: `Human Review Cycle Work Orders unavailable: ${source.error}` });
  const expectedItemCount = workOrdersResult.value?.summary?.work_order_item_count ?? 0;
  const expectedActorCount = workOrdersResult.value?.summary?.actor_work_order_count ?? 0;
  if (expectedItemCount > 0 && auditItems.length !== expectedItemCount) {
    errors.push({ path: "target_audit_items", message: "Target audit item count must match work order item count." });
  }
  if (expectedActorCount > 0 && actorAudits.length !== expectedActorCount) {
    errors.push({ path: "actor_target_audits", message: "Actor target audit count must match actor work order count." });
  }
  for (const item of auditItems) {
    if (item.target_audit_status === "blocked") {
      errors.push({ path: `target_audit_items.${item.target_audit_item_id}`, message: "Target receipt input file or row is unavailable." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `target_audit_items.${item.target_audit_item_id}.safe_handling`, message: "Target audit must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeTargetAudit(actorAudits, auditItems, source, workOrdersResult, validation) {
  return {
    target_audit_status: deriveTargetAuditStatus(validation, auditItems),
    source_available: source.available,
    source_work_order_status: workOrdersResult.value?.work_order_status ?? null,
    source_work_order_item_count: workOrdersResult.value?.summary?.work_order_item_count ?? 0,
    source_actor_work_order_count: workOrdersResult.value?.summary?.actor_work_order_count ?? 0,
    actor_target_audit_count: actorAudits.length,
    target_audit_item_count: auditItems.length,
    ready_target_count: auditItems.filter((item) => item.target_audit_status === "ready_for_human_review").length,
    attention_count: auditItems.filter((item) => item.target_audit_status === "attention").length,
    blocked_count: auditItems.filter((item) => item.target_audit_status === "blocked").length,
    target_file_count: new Set(auditItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    missing_target_file_count: auditItems.filter((item) => !item.target_file_available).length,
    missing_decision_file_count: auditItems.filter((item) => !item.target_decision_file_available).length,
    missing_receipt_row_count: auditItems.filter((item) => !item.receipt_row_present).length,
    missing_required_field_count: auditItems.filter((item) => item.missing_required_fields.length > 0).length,
    mismatch_count: auditItems.filter((item) => item.mismatch_fields.length > 0).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(auditItems, "required_actor"),
    by_gate_type: countBy(auditItems, "gate_type"),
    by_target_audit_status: countBy(auditItems, "target_audit_status"),
  };
}

function deriveTargetAuditStatus(validation, auditItems) {
  if (!validation.valid) return "blocked";
  if (auditItems.some((item) => item.target_audit_status === "blocked")) return "blocked";
  if (auditItems.some((item) => item.target_audit_status === "attention")) return "attention";
  if (auditItems.some((item) => item.target_audit_status === "ready_for_human_review")) return "ready_for_human_review";
  return "clear";
}

function deriveActorTargetAuditStatus(items) {
  if (items.some((item) => item.target_audit_status === "blocked")) return "blocked";
  if (items.some((item) => item.target_audit_status === "attention")) return "attention";
  if (items.some((item) => item.target_audit_status === "ready_for_human_review")) return "ready_for_human_review";
  return "clear";
}

function deriveTargetStatus(target, decisionTarget, receipt, missingRequiredFields, mismatches) {
  if (!target.available || !receipt) return "blocked";
  if (!decisionTarget.available || missingRequiredFields.length > 0 || mismatches.length > 0) return "attention";
  return "ready_for_human_review";
}

function buildTargetAuditNextActions(status) {
  if (status === "ready_for_human_review") return ["open_target_receipt_input", "complete_human_decision", "rerun_correction_merge_validation_feedback_cycle"];
  if (status === "attention") return ["inspect_target_audit_item", "repair_target_metadata_or_required_fields", "rerun_work_order_target_audit"];
  if (status === "blocked") return ["regenerate_human_review_cycle_work_orders", "regenerate_correction_workspace", "rerun_work_order_target_audit"];
  return ["no_action_required"];
}

async function readTarget(filePath, cache) {
  if (!filePath) return { available: false, error: "missing_path", receipts: [] };
  const cached = cache.get(filePath);
  if (cached?.receipts) return cached;
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

async function readTargetPresence(filePath, cache) {
  if (!filePath) return { available: false, error: "missing_path" };
  const cacheKey = `presence:${filePath}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    await access(filePath);
    const result = { available: true, error: null };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    const result = { available: false, error: error.code === "ENOENT" ? "not_found" : error.message };
    cache.set(cacheKey, result);
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

function renderTargetAuditMarkdown(audit) {
  const lines = [
    "# Human Review Cycle Work Order Target Audit",
    "",
    `- Target audit status: ${audit.target_audit_status}`,
    `- Actor target audits: ${audit.summary.actor_target_audit_count}`,
    `- Target audit items: ${audit.summary.target_audit_item_count}`,
    `- Ready targets: ${audit.summary.ready_target_count}`,
    `- Attention: ${audit.summary.attention_count}`,
    `- Blocked: ${audit.summary.blocked_count}`,
    `- Validation errors: ${audit.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact is audit-only.",
    "- It reads target receipt inputs and does not edit or apply receipts.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of audit.actor_target_audits) {
    lines.push(`- ${actor.required_actor}: ${actor.target_audit_item_count} item(s), ${actor.ready_target_count} ready, ${actor.target_audit_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorTargetAuditMarkdown(actor, items) {
  const lines = [
    `# Human Review Work Order Target Audit: ${actor.required_actor}`,
    "",
    `- Target audit status: ${actor.target_audit_status}`,
    `- Target audit items: ${actor.target_audit_item_count}`,
    `- Ready targets: ${actor.ready_target_count}`,
    `- Attention: ${actor.attention_count}`,
    `- Blocked: ${actor.blocked_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Target audit status: ${item.target_audit_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Receipt row present: ${item.receipt_row_present}`);
    lines.push(`- Missing required fields: ${item.missing_required_fields.join(", ") || "none"}`);
    lines.push(`- Mismatch fields: ${item.mismatch_fields.join(", ") || "none"}`);
    lines.push(`- Next actions: ${item.next_actions.join(", ")}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function compareActorTargetAudits(a, b) {
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
    else if (arg === "--work-orders") args.workOrdersPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-work-order-target-audit.mjs [options]

Options:
  --work-orders <path>           Human Review Cycle Work Orders artifact
  --out-dir <dir>                Output directory
  --run-at <iso>                 Override generated_at
  --check                        Exit non-zero when validation fails
`);
}
