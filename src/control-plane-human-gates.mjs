import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_HUMAN_GATES_ACTION_PLAN_PATH = "artifacts/control-plane-action-plan/latest/control-plane-action-plan.json";
export const DEFAULT_CONTROL_PLANE_HUMAN_GATES_OUT_DIR = "artifacts/control-plane-human-gates/latest";

export async function runControlPlaneHumanGates(options = {}) {
  const result = await buildControlPlaneHumanGates(options);
  if (options.write !== false) await writeControlPlaneHumanGates(result, result.output_dir);
  return result;
}

export async function buildControlPlaneHumanGates(options = {}) {
  const actionPlanPath = path.resolve(options.actionPlanPath ?? DEFAULT_CONTROL_PLANE_HUMAN_GATES_ACTION_PLAN_PATH);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_HUMAN_GATES_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const actionPlan = JSON.parse(await readFile(actionPlanPath, "utf8"));
  const gateItems = (actionPlan.plan_items ?? [])
    .filter((item) => item.requires_human || item.protected_action || ["blocked", "waiting_for_human"].includes(item.status))
    .map((item) => buildGateItem(item));
  const agenda = buildAgenda(gateItems);
  const result = {
    schema_version: "control-plane-human-gates.v1",
    generated_at: generatedAt,
    human_gate_id: `control-plane-human-gates.${dateStamp(generatedAt)}`,
    source_action_plan: actionPlanPath,
    source_action_plan_id: actionPlan.plan_id ?? null,
    output_dir: outputDir,
    policy: {
      auto_execute_allowed: false,
      protected_actions_require_receipt: true,
      evidence_decisions_require_human: true,
      generated_outputs_remain_draft_only: true,
    },
    summary: summarizeGateItems(gateItems),
    agenda,
    gate_items: gateItems,
  };

  return {
    ...result,
    markdown: renderHumanGateMarkdown(result),
  };
}

export async function writeControlPlaneHumanGates(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-human-gates.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    human_gate_id: result.human_gate_id,
    source_action_plan: result.source_action_plan,
    source_action_plan_id: result.source_action_plan_id,
    output_dir: result.output_dir,
    policy: result.policy,
    summary: result.summary,
    agenda: result.agenda,
    gate_items: result.gate_items,
  });
  await writeJson(path.join(outDir, "human-gate-items.json"), {
    generated_at: result.generated_at,
    count: result.gate_items.length,
    items: result.gate_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneHumanGatesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneHumanGates(args);
  console.log(`Control plane human gates written to ${result.output_dir}`);
  console.log(`Gate items: ${result.summary.gate_item_count}`);
  console.log(`Waiting for human: ${result.summary.waiting_for_human_count}`);
  console.log(`Protected actions: ${result.summary.protected_action_count}`);
}

function buildGateItem(planItem) {
  const gateType = classifyGateType(planItem);
  return {
    gate_item_id: `human-gate.${shortHash(planItem.plan_item_id)}`,
    source_plan_item_id: planItem.plan_item_id,
    source_stage: planItem.source_stage,
    gate_type: gateType,
    priority: planItem.priority,
    status: planItem.status,
    title: planItem.title,
    subject_ref: planItem.subject_ref,
    reason: planItem.reason,
    recommended_actions: planItem.recommended_actions ?? [],
    next_commands: planItem.next_commands ?? [],
    requires_human: Boolean(planItem.requires_human),
    protected_action: Boolean(planItem.protected_action),
    safe_handling: {
      auto_execute_allowed: false,
      required_actor: requiredActorFor(gateType),
      receipt_required: Boolean(planItem.protected_action) || gateType === "closeout_receipt",
      decision_required: Boolean(planItem.requires_human),
      draft_only: true,
    },
    source_refs: planItem.source_refs ?? [],
  };
}

function classifyGateType(item) {
  const actions = new Set(item.recommended_actions ?? []);
  if (actions.has("approve_evidence") || actions.has("reject_evidence") || actions.has("request_reextract")) return "evidence_decision";
  if (actions.has("perform_manual_delivery_or_merge") || item.protected_action) return "protected_delivery";
  if (item.source_stage === "delivery_closeout_queue" || item.source_stage === "closeout_receipt_validation") return "closeout_receipt";
  if (item.source_stage === "law_firm_ldd_slice" || actions.has("review_citations")) return "attorney_review";
  if (item.source_stage === "personal_dev_slice" || actions.has("review_pr_draft")) return "merge_review";
  if (item.source_stage === "creative_document_slice" || actions.has("review_deck_outline")) return "content_review";
  if (item.source_stage === "approval_inbox" || actions.has("review_output_artifact")) return "approval_request";
  if (item.source_stage === "matter_cockpit") return "matter_cockpit_blocker";
  if (item.source_stage === "approval_decisions") return "follow_up";
  return "human_gate";
}

function requiredActorFor(gateType) {
  if (gateType === "attorney_review" || gateType === "evidence_decision") return "attorney_or_designated_reviewer";
  if (gateType === "merge_review") return "developer_owner";
  if (gateType === "protected_delivery" || gateType === "closeout_receipt") return "authorized_operator";
  if (gateType === "content_review") return "content_owner";
  return "human_reviewer";
}

function buildAgenda(gateItems) {
  return Object.entries(groupBy(gateItems, "gate_type"))
    .map(([gateType, items]) => ({
      gate_type: gateType,
      item_count: items.length,
      protected_action_count: items.filter((item) => item.protected_action).length,
      waiting_for_human_count: items.filter((item) => item.status === "waiting_for_human").length,
      blocked_count: items.filter((item) => item.status === "blocked").length,
      highest_priority: highestPriority(items),
      required_actor: requiredActorFor(gateType),
      sample_item_ids: items.slice(0, 5).map((item) => item.gate_item_id),
    }))
    .sort(compareAgendaItems);
}

function summarizeGateItems(gateItems) {
  return {
    gate_item_count: gateItems.length,
    waiting_for_human_count: gateItems.filter((item) => item.status === "waiting_for_human").length,
    blocked_count: gateItems.filter((item) => item.status === "blocked").length,
    protected_action_count: gateItems.filter((item) => item.protected_action).length,
    human_required_count: gateItems.filter((item) => item.requires_human).length,
    evidence_decision_count: gateItems.filter((item) => item.gate_type === "evidence_decision").length,
    approval_request_count: gateItems.filter((item) => item.gate_type === "approval_request").length,
    protected_delivery_count: gateItems.filter((item) => item.gate_type === "protected_delivery").length,
    closeout_receipt_count: gateItems.filter((item) => item.gate_type === "closeout_receipt").length,
    auto_execute_allowed_count: gateItems.filter((item) => item.safe_handling.auto_execute_allowed).length,
    next_command_count: gateItems.reduce((sum, item) => sum + item.next_commands.length, 0),
    by_gate_type: countBy(gateItems, "gate_type"),
    by_priority: countBy(gateItems, "priority"),
    by_status: countBy(gateItems, "status"),
    by_source_stage: countBy(gateItems, "source_stage"),
  };
}

function renderHumanGateMarkdown(result) {
  const lines = [];
  lines.push("# Control Plane Human Gates");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source action plan: ${result.source_action_plan}`);
  lines.push("");
  lines.push(`- Gate items: ${result.summary.gate_item_count}`);
  lines.push(`- Waiting for human: ${result.summary.waiting_for_human_count}`);
  lines.push(`- Blocked: ${result.summary.blocked_count}`);
  lines.push(`- Protected actions: ${result.summary.protected_action_count}`);
  lines.push(`- Evidence decisions: ${result.summary.evidence_decision_count}`);
  lines.push(`- Auto-executable: ${result.summary.auto_execute_allowed_count}`);
  lines.push("");
  lines.push("## Agenda");
  lines.push("");
  for (const item of result.agenda) {
    lines.push(`- ${item.gate_type}: ${item.item_count} item(s), ${item.highest_priority} priority, actor ${item.required_actor}`);
  }
  if (result.agenda.length === 0) lines.push("- No human gates.");
  lines.push("");
  lines.push("## Gate Items");
  lines.push("");
  for (const item of result.gate_items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.gate_type}, ${item.status})`);
  }
  if (result.gate_items.length === 0) lines.push("- No gate items.");
  return `${lines.join("\n")}\n`;
}

function highestPriority(items) {
  const order = ["critical", "high", "medium", "low"];
  return order.find((priority) => items.some((item) => item.priority === priority)) ?? "low";
}

function compareAgendaItems(a, b) {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return (
    priorityOrder[a.highest_priority] - priorityOrder[b.highest_priority]
    || b.item_count - a.item_count
    || a.gate_type.localeCompare(b.gate_type)
  );
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] ?? "unknown";
    groups[value] = groups[value] ?? [];
    groups[value].push(item);
    return groups;
  }, {});
}

function countBy(items, key) {
  return Object.fromEntries(
    Object.entries(groupBy(items, key)).map(([value, group]) => [value, group.length]).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function parseArgs(argv) {
  const parsed = {
    actionPlanPath: DEFAULT_CONTROL_PLANE_HUMAN_GATES_ACTION_PLAN_PATH,
    outDir: DEFAULT_CONTROL_PLANE_HUMAN_GATES_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--action-plan") parsed.actionPlanPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-human-gates.mjs [options]

Options:
  --action-plan <path>     control-plane-action-plan.json path.
  --out-dir <folder>       Output directory.
  --run-at <iso>           Deterministic generated_at timestamp.
  -h, --help               Show this help.
`);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function shortHash(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
