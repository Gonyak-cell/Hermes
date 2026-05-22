import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_APPROVAL_QUEUE_PATH = "artifacts/approval-queue/latest/approval-queue.json";
export const DEFAULT_APPROVAL_DECISIONS_PATH = "artifacts/approval-queue/latest/decision-template.json";
export const DEFAULT_APPROVAL_DECISIONS_OUT_DIR = "artifacts/approval-decisions/latest";
export const DEFAULT_RESOURCE_EVIDENCE_PATH = "artifacts/resource-ingest/latest/resource-evidence.json";

const APPROVED_DECISIONS = new Set(["approved", "approve", "approve_evidence"]);
const REJECTED_DECISIONS = new Set(["rejected", "reject", "reject_evidence"]);
const CHANGES_REQUESTED_DECISIONS = new Set(["changes_requested", "request_changes", "request_reextract", "reextract_requested"]);
const RESOLVED_DECISIONS = new Set(["resolved", "resolve", "waived", "waive_with_reason"]);
const CANCELLED_DECISIONS = new Set(["cancelled", "canceled"]);

export async function runApprovalDecisions(options = {}) {
  const result = await buildApprovalDecisions(options);
  if (options.write !== false) await writeApprovalDecisions(result, result.output_dir);
  return result;
}

export async function buildApprovalDecisions(options = {}) {
  const queuePath = path.resolve(options.queuePath ?? DEFAULT_APPROVAL_QUEUE_PATH);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_APPROVAL_DECISIONS_PATH);
  const resourceEvidencePath = options.resourceEvidencePath === false
    ? null
    : path.resolve(options.resourceEvidencePath ?? DEFAULT_RESOURCE_EVIDENCE_PATH);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_DECISIONS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const queue = JSON.parse(await readFile(queuePath, "utf8"));
  const decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
  const resourceEvidence = resourceEvidencePath ? await readJsonIfExists(resourceEvidencePath) : null;
  const queueById = new Map(queue.items.map((item) => [item.queue_item_id, item]));
  const decisionById = new Map((decisions.decisions ?? []).map((decision) => [decision.queue_item_id, decision]));
  const appliedItems = [];
  const unappliedItems = [];
  const auditEvents = [];
  const patchedResourceEvidence = resourceEvidence ? structuredClone(resourceEvidence) : null;

  for (const queueItem of queue.items) {
    const decision = decisionById.get(queueItem.queue_item_id);
    if (!decision || normalizeDecision(decision.decision) === "pending") {
      unappliedItems.push(toUnappliedItem(queueItem, decision));
      continue;
    }

    const applied = applyDecision(queueItem, decision, {
      generatedAt,
      patchedResourceEvidence,
    });
    appliedItems.push(applied);
    auditEvents.push(buildDecisionAuditEvent(queue, queueItem, decision, generatedAt));
  }

  const result = {
    schema_version: "approval-decision-result.v1",
    generated_at: generatedAt,
    source_queue: queuePath,
    source_decisions: decisionsPath,
    output_dir: outputDir,
    summary: summarizeDecisions(queue.items, appliedItems, unappliedItems),
    applied_items: appliedItems,
    unapplied_items: unappliedItems,
    audit_events: auditEvents,
    patched_resource_evidence: patchedResourceEvidence,
    decision_errors: validateDecisions(decisions, queueById),
  };

  return {
    ...result,
    markdown: renderApprovalDecisionSummary(result),
  };
}

export async function writeApprovalDecisions(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "approval-decision-result.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    source_queue: result.source_queue,
    source_decisions: result.source_decisions,
    summary: result.summary,
    applied_items: result.applied_items,
    unapplied_items: result.unapplied_items,
    audit_events: result.audit_events,
    patched_resource_evidence: result.patched_resource_evidence,
    decision_errors: result.decision_errors,
  });
  if (result.patched_resource_evidence) {
    await writeJson(path.join(outDir, "resource-evidence.patched.json"), result.patched_resource_evidence);
  }
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runApprovalDecisionsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runApprovalDecisions(args);
  console.log(`Approval decisions written to ${result.output_dir}`);
  console.log(`Applied: ${result.summary.applied_count}`);
  console.log(`Pending: ${result.summary.pending_count}`);
  console.log(`Audit events: ${result.audit_events.length}`);
  if (result.decision_errors.length > 0) console.log(`Decision errors: ${result.decision_errors.length}`);
}

function applyDecision(queueItem, decision, context) {
  const normalizedDecision = normalizeDecision(decision.decision);
  const statusAfter = CANCELLED_DECISIONS.has(normalizedDecision) ? "cancelled" : "decided";
  const resourcePatch = queueItem.item_type === "evidence_review" && context.patchedResourceEvidence
    ? patchEvidenceReviewStatus(context.patchedResourceEvidence, queueItem.subject_ref.subject_id, normalizedDecision, decision)
    : null;

  return {
    queue_item_id: queueItem.queue_item_id,
    item_type: queueItem.item_type,
    subject_ref: queueItem.subject_ref,
    priority: queueItem.priority,
    status_before: queueItem.status,
    status_after: statusAfter,
    decision: normalizedDecision,
    decided_by: decision.decided_by ?? null,
    decided_at: decision.decided_at ?? context.generatedAt,
    comment: decision.comment ?? "",
    follow_up_action: decision.follow_up_action ?? "",
    resource_patch: resourcePatch,
  };
}

function patchEvidenceReviewStatus(resourceEvidence, evidenceId, decision, rawDecision) {
  const evidence = (resourceEvidence.evidence_items ?? []).find((item) => item.id === evidenceId);
  if (!evidence) {
    return {
      patched: false,
      reason: "evidence_item_not_found",
      evidence_id: evidenceId,
    };
  }

  const before = evidence.review_status;
  evidence.review_status = mapDecisionToReviewStatus(decision);
  evidence.metadata = {
    ...(evidence.metadata ?? {}),
    approval_decision: {
      decision,
      decided_by: rawDecision.decided_by ?? null,
      decided_at: rawDecision.decided_at ?? null,
      comment: rawDecision.comment ?? "",
      follow_up_action: rawDecision.follow_up_action ?? "",
    },
  };

  return {
    patched: true,
    evidence_id: evidenceId,
    review_status_before: before,
    review_status_after: evidence.review_status,
  };
}

function mapDecisionToReviewStatus(decision) {
  if (APPROVED_DECISIONS.has(decision)) return "approved";
  if (REJECTED_DECISIONS.has(decision)) return "rejected";
  if (CHANGES_REQUESTED_DECISIONS.has(decision)) return "needs_review";
  return "needs_review";
}

function buildDecisionAuditEvent(queue, queueItem, decision, generatedAt) {
  const normalizedDecision = normalizeDecision(decision.decision);
  return {
    schema_version: "audit-event.v1",
    id: `event.approval_decision.${shortHash(`${queue.queue_id}:${queueItem.queue_item_id}:${normalizedDecision}`)}`,
    type: "approval.decided",
    time: decision.decided_at ?? generatedAt,
    tenant_id: "tenant.personal.jws",
    actor: {
      actor_type: decision.decided_by ? "human" : "manual",
      actor_id: decision.decided_by ?? "manual.unassigned",
      display_name: decision.decided_by ?? "Unassigned Reviewer",
    },
    subject: {
      subject_type: queueItem.subject_ref.subject_type,
      subject_id: queueItem.subject_ref.subject_id,
    },
    correlation_id: queue.queue_id,
    data: {
      queue_item_id: queueItem.queue_item_id,
      decision: normalizedDecision,
      comment: decision.comment ?? "",
      follow_up_action: decision.follow_up_action ?? "",
    },
    metadata: {
      source_queue_id: queue.queue_id,
      item_type: queueItem.item_type,
    },
  };
}

function validateDecisions(decisions, queueById) {
  const errors = [];
  for (const decision of decisions.decisions ?? []) {
    if (!queueById.has(decision.queue_item_id)) {
      errors.push({
        queue_item_id: decision.queue_item_id,
        message: "Decision references an unknown queue item.",
      });
    }
    const normalized = normalizeDecision(decision.decision);
    if (normalized !== "pending" && !decision.decided_by) {
      errors.push({
        queue_item_id: decision.queue_item_id,
        message: "Non-pending decision should include decided_by.",
      });
    }
  }
  return errors;
}

function summarizeDecisions(queueItems, appliedItems, unappliedItems) {
  const byDecision = countBy(appliedItems, "decision");
  return {
    queue_item_count: queueItems.length,
    applied_count: appliedItems.length,
    pending_count: unappliedItems.length,
    by_decision: byDecision,
    approved_count: appliedItems.filter((item) => APPROVED_DECISIONS.has(item.decision)).length,
    rejected_count: appliedItems.filter((item) => REJECTED_DECISIONS.has(item.decision)).length,
    changes_requested_count: appliedItems.filter((item) => CHANGES_REQUESTED_DECISIONS.has(item.decision)).length,
    resolved_or_waived_count: appliedItems.filter((item) => RESOLVED_DECISIONS.has(item.decision)).length,
    follow_up_count: appliedItems.filter((item) => item.follow_up_action).length,
  };
}

function toUnappliedItem(queueItem, decision) {
  return {
    queue_item_id: queueItem.queue_item_id,
    item_type: queueItem.item_type,
    subject_ref: queueItem.subject_ref,
    status: queueItem.status,
    reason: decision ? "decision_pending" : "decision_missing",
  };
}

function renderApprovalDecisionSummary(result) {
  const lines = [];
  lines.push("# Approval Decision Result");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source queue: ${result.source_queue}`);
  lines.push(`Source decisions: ${result.source_decisions}`);
  lines.push("");
  lines.push(`- Queue items: ${result.summary.queue_item_count}`);
  lines.push(`- Applied: ${result.summary.applied_count}`);
  lines.push(`- Pending: ${result.summary.pending_count}`);
  lines.push(`- Approved: ${result.summary.approved_count}`);
  lines.push(`- Rejected: ${result.summary.rejected_count}`);
  lines.push(`- Changes requested: ${result.summary.changes_requested_count}`);
  lines.push(`- Resolved or waived: ${result.summary.resolved_or_waived_count}`);
  lines.push(`- Audit events: ${result.audit_events.length}`);
  lines.push("");
  lines.push("## Applied Items");
  lines.push("");
  for (const item of result.applied_items) {
    lines.push(`- ${item.queue_item_id}: ${item.decision} -> ${item.status_after}`);
  }
  if (result.applied_items.length === 0) lines.push("- No decisions applied.");
  lines.push("");
  if (result.decision_errors.length > 0) {
    lines.push("## Decision Errors");
    lines.push("");
    for (const error of result.decision_errors) {
      lines.push(`- ${error.queue_item_id}: ${error.message}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const parsed = {
    queuePath: DEFAULT_APPROVAL_QUEUE_PATH,
    decisionsPath: DEFAULT_APPROVAL_DECISIONS_PATH,
    resourceEvidencePath: DEFAULT_RESOURCE_EVIDENCE_PATH,
    outDir: DEFAULT_APPROVAL_DECISIONS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--queue") parsed.queuePath = argv[++index];
    else if (arg === "--decisions") parsed.decisionsPath = argv[++index];
    else if (arg === "--resource-evidence") parsed.resourceEvidencePath = argv[++index];
    else if (arg === "--no-resource-evidence") parsed.resourceEvidencePath = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-decisions.mjs [options]

Options:
  --queue <path>                approval-queue.json path.
  --decisions <path>            approval decisions JSON path.
  --resource-evidence <path>    Optional resource-evidence.json to patch.
  --no-resource-evidence        Do not read or write resource evidence patch.
  --out-dir <folder>            Output directory.
  --run-at <iso>                Deterministic generated_at timestamp.
  -h, --help                    Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeDecision(value) {
  return String(value ?? "pending").trim().toLowerCase();
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function shortHash(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}
