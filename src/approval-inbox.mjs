import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_APPROVAL_INBOX_OUT_DIR = "artifacts/approval-inbox/latest";
export const DEFAULT_DELIVERY_QUEUE_PATH = "artifacts/delivery-queue/latest/protected-delivery-queue.json";
export const DEFAULT_MATTER_COCKPIT_PATH = "artifacts/matter-cockpit/latest/matter-cockpit.json";

export async function runApprovalInbox(options = {}) {
  const result = await buildApprovalInbox(options);
  if (options.write !== false) await writeApprovalInbox(result, result.output_dir);
  return result;
}

export async function buildApprovalInbox(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_INBOX_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const deliveryQueuePath = path.resolve(options.deliveryQueuePath ?? DEFAULT_DELIVERY_QUEUE_PATH);
  const matterCockpitPath = options.matterCockpitPath === false ? null : path.resolve(options.matterCockpitPath ?? DEFAULT_MATTER_COCKPIT_PATH);
  const deliveryQueueResult = await readJsonOrError(deliveryQueuePath);
  const matterCockpitResult = matterCockpitPath ? await readJsonOrError(matterCockpitPath) : { ok: false, value: null, error: "disabled" };
  const matterContext = new Map((matterCockpitResult.value?.matters ?? []).map((matter) => [matter.matter_key, matter]));
  const items = (deliveryQueueResult.value?.delivery_actions ?? [])
    .filter((action) => needsHumanReview(action))
    .map((action) => buildInboxItem(action, matterContext.get(`${action.tenant_id}:${action.matter_id}`)))
    .sort(compareInboxItems);
  const inbox = {
    schema_version: "approval-inbox.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    inbox_id: `approval-inbox.${dateStamp(generatedAt)}`,
    summary: summarizeInbox(deliveryQueueResult, matterCockpitResult, items),
    sources: [
      buildSource("protected_delivery_queue", "Protected Delivery Queue", deliveryQueuePath, deliveryQueueResult),
      buildSource("matter_cockpit", "Matter Cockpit", matterCockpitPath, matterCockpitResult),
    ],
    items,
    decision_template: buildDecisionTemplate(generatedAt, items),
  };

  return {
    ...inbox,
    markdown: renderApprovalInboxMarkdown(inbox),
  };
}

export async function writeApprovalInbox(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "approval-inbox.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    inbox_id: result.inbox_id,
    summary: result.summary,
    sources: result.sources,
    items: result.items,
    decision_template: result.decision_template,
  });
  await writeJson(path.join(outDir, "decision-template.json"), result.decision_template);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runApprovalInboxCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runApprovalInbox(args);
  console.log(`Approval inbox written to ${result.output_dir}`);
  console.log(`Inbox items: ${result.summary.inbox_item_count}`);
  console.log(`Approval requests: ${result.summary.approval_request_count}`);
  console.log(`Gate reviews: ${result.summary.gate_review_count}`);
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

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    error: result.ok ? null : result.error,
  };
}

function needsHumanReview(action) {
  return action.delivery_status !== "delivered" && action.delivery_status !== "ready_for_delivery";
}

function buildInboxItem(action, matter) {
  const itemType = action.delivery_status === "blocked_pending_approval" ? "approval_request" : "gate_blocker_review";
  const allowedDecisions = itemType === "approval_request"
    ? ["approve", "request_changes", "reject", "defer"]
    : ["mark_resolved", "waive_for_now", "keep_blocked", "defer"];
  return {
    approval_item_id: `approval-inbox.${slugify(action.delivery_action_id)}`,
    item_type: itemType,
    priority: action.priority,
    status: "pending",
    tenant_id: action.tenant_id,
    matter_id: action.matter_id,
    matter_key: `${action.tenant_id}:${action.matter_id}`,
    domain_pack: action.domain_pack,
    approval_id: action.required_approval_id,
    approval_status: action.approval_status,
    artifact_id: action.artifact_id,
    artifact_type: action.artifact_type,
    delivery_action_id: action.delivery_action_id,
    delivery_status: action.delivery_status,
    delivery_target: action.delivery_target,
    delivery_channel: action.delivery_channel,
    workflow_run_id: action.workflow_run_id,
    title: buildTitle(action, itemType),
    reason: buildReason(action, itemType),
    required_decision: itemType === "approval_request" ? "approve_or_request_changes" : "resolve_or_waive_gate_blocker",
    allowed_decisions: allowedDecisions,
    recommended_actions: action.recommended_actions ?? [],
    blocked_reasons: action.blocked_reasons ?? [],
    source_refs: {
      delivery_action_id: action.delivery_action_id,
      artifact_id: action.artifact_id,
      workflow_run_id: action.workflow_run_id,
      matter_key: `${action.tenant_id}:${action.matter_id}`,
    },
    context: {
      matter_status: matter?.status ?? null,
      matter_pending_approval_count: matter?.pending_approval_count ?? 0,
      matter_blocked_delivery_count: matter?.blocked_delivery_count ?? 0,
      matter_blocking_gate_count: matter?.blocking_gate_count ?? 0,
      runtime_seconds: action.runtime_seconds ?? 0,
      citation_count: action.metadata?.citation_count ?? 0,
      output_status: action.metadata?.output_status ?? null,
    },
  };
}

function buildTitle(action, itemType) {
  if (itemType === "approval_request") return `Review approval for ${action.artifact_type}`;
  return `Review blocker for ${action.artifact_type}`;
}

function buildReason(action, itemType) {
  if (itemType === "approval_request") {
    return `Approval ${action.required_approval_id ?? "unassigned"} is pending before ${action.delivery_target}.`;
  }
  const blockers = action.blocked_reasons?.join(", ") || action.delivery_status;
  return `Delivery is blocked before ${action.delivery_target}: ${blockers}.`;
}

function buildDecisionTemplate(generatedAt, items) {
  return {
    schema_version: "approval-inbox-decision-template.v1",
    generated_at: generatedAt,
    instructions: "Set decision, decided_by, decided_at, and comment for each item that should be applied by a later decision applier.",
    decisions: items.map((item) => ({
      approval_item_id: item.approval_item_id,
      item_type: item.item_type,
      subject_ref: {
        subject_type: item.item_type === "approval_request" ? "approval" : "delivery_action",
        subject_id: item.approval_id ?? item.delivery_action_id,
      },
      allowed_decisions: item.allowed_decisions,
      decision: "pending",
      decided_by: "",
      decided_at: "",
      comment: "",
      follow_up_action: "",
    })),
  };
}

function summarizeInbox(deliveryQueueResult, matterCockpitResult, items) {
  return {
    delivery_queue_available: deliveryQueueResult.ok,
    matter_cockpit_available: matterCockpitResult.ok,
    inbox_item_count: items.length,
    pending_item_count: items.filter((item) => item.status === "pending").length,
    approval_request_count: items.filter((item) => item.item_type === "approval_request").length,
    gate_review_count: items.filter((item) => item.item_type === "gate_blocker_review").length,
    high_priority_count: items.filter((item) => ["critical", "high"].includes(item.priority)).length,
    law_firm_count: items.filter((item) => item.domain_pack === "law-firm").length,
    personal_dev_count: items.filter((item) => item.domain_pack === "personal-dev").length,
    creative_document_count: items.filter((item) => item.domain_pack === "creative-document").length,
    by_item_type: countBy(items, "item_type"),
    by_priority: countBy(items, "priority"),
    by_domain_pack: countBy(items, "domain_pack"),
    by_delivery_target: countBy(items, "delivery_target"),
  };
}

function renderApprovalInboxMarkdown(inbox) {
  const lines = [];
  lines.push("# Approval Inbox");
  lines.push("");
  lines.push(`Generated: ${inbox.generated_at}`);
  lines.push("");
  lines.push(`- Inbox items: ${inbox.summary.inbox_item_count}`);
  lines.push(`- Approval requests: ${inbox.summary.approval_request_count}`);
  lines.push(`- Gate reviews: ${inbox.summary.gate_review_count}`);
  lines.push(`- High priority: ${inbox.summary.high_priority_count}`);
  lines.push("");
  lines.push("## Items");
  lines.push("");
  for (const item of inbox.items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.item_type}, ${item.matter_id})`);
  }
  if (inbox.items.length === 0) lines.push("- No approval inbox items found.");
  return `${lines.join("\n")}\n`;
}

function compareInboxItems(left, right) {
  return (
    priorityRank(left.priority) - priorityRank(right.priority) ||
    left.matter_id.localeCompare(right.matter_id) ||
    left.artifact_id.localeCompare(right.artifact_id)
  );
}

function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
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
    .slice(0, 160) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_APPROVAL_INBOX_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--matter-cockpit") parsed.matterCockpitPath = argv[++index];
    else if (arg === "--no-matter-cockpit") parsed.matterCockpitPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-inbox.mjs [options]

Options:
  --delivery-queue <path>     protected-delivery-queue.json path.
  --matter-cockpit <path>     matter-cockpit.json path.
  --no-matter-cockpit         Do not enrich approval items with matter context.
  --out-dir <folder>          Output directory.
  --run-at <iso>              Deterministic generated_at timestamp.
  -h, --help                  Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
