import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_EVIDENCE_REVIEW_DRAFT_QUEUE_PATH = "artifacts/approval-queue/latest/approval-queue.json";
export const DEFAULT_EVIDENCE_REVIEW_DRAFT_OUT_DIR = "artifacts/evidence-review-draft/latest";

export async function runEvidenceReviewDraft(options = {}) {
  const result = await buildEvidenceReviewDraft(options);
  if (options.write !== false) await writeEvidenceReviewDraft(result, result.output_dir);
  return result;
}

export async function buildEvidenceReviewDraft(options = {}) {
  const queuePath = path.resolve(options.queuePath ?? DEFAULT_EVIDENCE_REVIEW_DRAFT_QUEUE_PATH);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_REVIEW_DRAFT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const queue = JSON.parse(await readFile(queuePath, "utf8"));
  const reviewer = options.reviewer ?? null;
  const applySafeDefaults = Boolean(options.applySafeDefaults ?? false);
  const reviewItems = (queue.items ?? [])
    .filter((item) => item.item_type === "evidence_review")
    .map((item) => buildReviewItem(item, { generatedAt, reviewer, applySafeDefaults }));
  const decisionDraft = buildDecisionDraft(queue, reviewItems, {
    generatedAt,
    reviewer,
    applySafeDefaults,
  });
  const draft = {
    schema_version: "evidence-review-draft.v1",
    generated_at: generatedAt,
    draft_id: `evidence-review-draft.${dateStamp(generatedAt)}`,
    source_queue: queuePath,
    source_queue_id: queue.queue_id ?? null,
    output_dir: outputDir,
    review_policy: {
      draft_mode: applySafeDefaults ? "safe_internal_auto_prefill" : "suggest_only",
      reviewer,
      p1_internal_default: applySafeDefaults ? "approve_evidence" : "pending",
      p2_client_confidential_default: "pending_attorney_review",
      p3_privileged_default: "pending_attorney_review",
      p4_highly_restricted_default: "pending_attorney_review",
      p5_secret_default: "reject_or_keep_quarantined",
    },
    summary: summarizeDraft(reviewItems, decisionDraft),
    review_items: reviewItems,
    decision_draft: decisionDraft,
  };

  return {
    ...draft,
    markdown: renderEvidenceReviewDraftMarkdown(draft),
  };
}

export async function writeEvidenceReviewDraft(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "evidence-review-draft.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    draft_id: result.draft_id,
    source_queue: result.source_queue,
    source_queue_id: result.source_queue_id,
    output_dir: result.output_dir,
    review_policy: result.review_policy,
    summary: result.summary,
    review_items: result.review_items,
    decision_draft: result.decision_draft,
  });
  await writeJson(path.join(outDir, "approval-decisions.draft.json"), result.decision_draft);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceReviewDraftCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runEvidenceReviewDraft(args);
  console.log(`Evidence review draft written to ${result.output_dir}`);
  console.log(`Review items: ${result.summary.review_item_count}`);
  console.log(`Suggested approve: ${result.summary.suggested_approve_count}`);
  console.log(`Attorney review: ${result.summary.attorney_review_count}`);
  console.log(`Pending decisions: ${result.summary.pending_decision_count}`);
}

function buildReviewItem(item, context) {
  const classification = item.classification ?? "unknown";
  const suggestedDecision = suggestedDecisionFor(item, context);
  const decision = context.applySafeDefaults && suggestedDecision === "approve_evidence"
    ? "approve_evidence"
    : "pending";
  const requiresAttorneyReview = ["P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED"].includes(classification);
  const blockedFromAutoApproval = requiresAttorneyReview || classification === "P5_SECRET" || item.priority === "critical";
  return {
    review_item_id: `evidence-review-item.${shortHash(item.queue_item_id)}`,
    queue_item_id: item.queue_item_id,
    evidence_id: item.subject_ref?.subject_id ?? null,
    priority: item.priority,
    classification,
    matter_id: item.matter_id ?? null,
    source_uri: item.source_uri ?? null,
    capability_ids: item.metadata?.capability_ids ?? [],
    review_status: blockedFromAutoApproval ? "attorney_review_required" : "ready_for_review",
    suggested_decision: suggestedDecision,
    draft_decision: decision,
    auto_approvable: suggestedDecision === "approve_evidence" && !blockedFromAutoApproval,
    reason: reasonFor(item, classification, suggestedDecision),
    source_queue_item: {
      title: item.title,
      required_decision: item.required_decision,
      reason: item.reason,
    },
  };
}

function suggestedDecisionFor(item, context) {
  const classification = item.classification ?? "unknown";
  if (classification === "P5_SECRET") return "reject_evidence";
  if (["P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED"].includes(classification)) {
    return "pending_attorney_review";
  }
  if (item.priority === "critical") return "pending_attorney_review";
  if (classification === "P1_INTERNAL") return context.applySafeDefaults ? "approve_evidence" : "pending_human_review";
  return "pending_human_review";
}

function reasonFor(item, classification, suggestedDecision) {
  if (suggestedDecision === "approve_evidence") return "P1 internal evidence can be prefilled for approval in safe-default mode.";
  if (suggestedDecision === "pending_attorney_review") return `${classification} evidence requires attorney review before downstream use.`;
  if (suggestedDecision === "reject_evidence") return `${classification} evidence cannot be auto-approved.`;
  return item.reason ?? "Evidence requires review before downstream use.";
}

function buildDecisionDraft(queue, reviewItems, context) {
  const decisionsByQueueId = new Map(reviewItems.map((item) => [item.queue_item_id, item]));
  return {
    schema_version: "approval-decisions.v1",
    generated_at: context.generatedAt,
    source_queue_id: queue.queue_id ?? null,
    decisions: (queue.items ?? []).map((queueItem) => {
      const reviewItem = decisionsByQueueId.get(queueItem.queue_item_id);
      return {
        queue_item_id: queueItem.queue_item_id,
        decision: reviewItem?.draft_decision ?? "pending",
        decided_by: reviewItem?.draft_decision === "pending" ? null : context.reviewer ?? "system.evidence_review_draft",
        decided_at: reviewItem?.draft_decision === "pending" ? null : context.generatedAt,
        comment: reviewItem
          ? `${reviewItem.suggested_decision}: ${reviewItem.reason}`
          : "Non-evidence approval queue item left pending by evidence review draft.",
        follow_up_action: reviewItem?.review_status === "attorney_review_required" ? "attorney_review_required" : "",
      };
    }),
  };
}

function summarizeDraft(reviewItems, decisionDraft) {
  return {
    review_item_count: reviewItems.length,
    ready_for_review_count: reviewItems.filter((item) => item.review_status === "ready_for_review").length,
    attorney_review_count: reviewItems.filter((item) => item.review_status === "attorney_review_required").length,
    auto_approvable_count: reviewItems.filter((item) => item.auto_approvable).length,
    suggested_approve_count: reviewItems.filter((item) => item.suggested_decision === "approve_evidence").length,
    suggested_pending_count: reviewItems.filter((item) => item.suggested_decision.startsWith("pending")).length,
    suggested_reject_count: reviewItems.filter((item) => item.suggested_decision === "reject_evidence").length,
    generated_decision_count: decisionDraft.decisions.length,
    pending_decision_count: decisionDraft.decisions.filter((decision) => decision.decision === "pending").length,
    by_classification: countBy(reviewItems, "classification"),
    by_priority: countBy(reviewItems, "priority"),
    by_review_status: countBy(reviewItems, "review_status"),
    by_suggested_decision: countBy(reviewItems, "suggested_decision"),
  };
}

function renderEvidenceReviewDraftMarkdown(draft) {
  const lines = [];
  lines.push("# Evidence Review Draft");
  lines.push("");
  lines.push(`Generated: ${draft.generated_at}`);
  lines.push(`Source queue: ${draft.source_queue}`);
  lines.push(`Draft mode: ${draft.review_policy.draft_mode}`);
  lines.push("");
  lines.push(`- Review items: ${draft.summary.review_item_count}`);
  lines.push(`- Ready for review: ${draft.summary.ready_for_review_count}`);
  lines.push(`- Attorney review: ${draft.summary.attorney_review_count}`);
  lines.push(`- Suggested approve: ${draft.summary.suggested_approve_count}`);
  lines.push(`- Pending decisions: ${draft.summary.pending_decision_count}`);
  lines.push("");
  lines.push("## Review Items");
  lines.push("");
  for (const item of draft.review_items) {
    lines.push(`- ${item.evidence_id}: ${item.review_status}, suggested ${item.suggested_decision}`);
  }
  if (draft.review_items.length === 0) lines.push("- No evidence review items.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {
    queuePath: DEFAULT_EVIDENCE_REVIEW_DRAFT_QUEUE_PATH,
    outDir: DEFAULT_EVIDENCE_REVIEW_DRAFT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--queue") parsed.queuePath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--reviewer") parsed.reviewer = argv[++index];
    else if (arg === "--apply-safe-defaults") parsed.applySafeDefaults = true;
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-review-draft.mjs [options]

Options:
  --queue <path>              approval-queue.json path.
  --out-dir <folder>          Output directory.
  --reviewer <id>             Reviewer id for safe-default prefilled approvals.
  --apply-safe-defaults       Prefill P1 internal evidence approvals; protected data remains pending.
  --run-at <iso>              Deterministic generated_at timestamp.
  -h, --help                  Show this help.
`);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
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
