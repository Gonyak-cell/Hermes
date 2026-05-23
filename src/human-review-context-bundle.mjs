import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CONTEXT_BUNDLE_OUT_DIR = "artifacts/human-review-context-bundle/latest";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_WORKSPACE_MERGE_PATH = "artifacts/human-review-receipt-workspace-merge/latest/human-review-receipt-workspace-merge.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_WORKSPACE_PATH = "artifacts/human-review-receipt-workspace/latest/human-review-receipt-workspace.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_HUMAN_GATES_PATH = "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_ACTION_PLAN_PATH = "artifacts/control-plane-action-plan/latest/control-plane-action-plan.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_EVIDENCE_VIEWER_PATH = "artifacts/evidence-viewer/latest/evidence-viewer.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_APPROVAL_INBOX_PATH = "artifacts/approval-inbox/latest/approval-inbox.json";
export const DEFAULT_HUMAN_REVIEW_CONTEXT_MATTER_COCKPIT_PATH = "artifacts/matter-cockpit/latest/matter-cockpit.json";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewContextBundle(options = {}) {
  const result = await buildHumanReviewContextBundle(options);
  if (options.write !== false) await writeHumanReviewContextBundle(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review context bundle failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewContextBundle(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CONTEXT_BUNDLE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const paths = {
    workspaceMergePath: path.resolve(options.workspaceMergePath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_WORKSPACE_MERGE_PATH),
    workspacePath: path.resolve(options.workspacePath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_WORKSPACE_PATH),
    humanGatesPath: path.resolve(options.humanGatesPath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_HUMAN_GATES_PATH),
    actionPlanPath: path.resolve(options.actionPlanPath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_ACTION_PLAN_PATH),
    evidenceViewerPath: path.resolve(options.evidenceViewerPath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_EVIDENCE_VIEWER_PATH),
    approvalInboxPath: path.resolve(options.approvalInboxPath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_APPROVAL_INBOX_PATH),
    matterCockpitPath: path.resolve(options.matterCockpitPath ?? DEFAULT_HUMAN_REVIEW_CONTEXT_MATTER_COCKPIT_PATH),
  };
  const results = {
    workspaceMerge: await readJsonOrError(paths.workspaceMergePath),
    workspace: await readJsonOrError(paths.workspacePath),
    humanGates: await readJsonOrError(paths.humanGatesPath),
    actionPlan: await readJsonOrError(paths.actionPlanPath),
    evidenceViewer: await readJsonOrError(paths.evidenceViewerPath),
    approvalInbox: await readJsonOrError(paths.approvalInboxPath),
    matterCockpit: await readJsonOrError(paths.matterCockpitPath),
  };
  const lookups = buildLookups(results);
  const contextCards = buildContextCards(results.workspaceMerge.value?.merge_items ?? [], lookups);
  const actorContextBundles = buildActorContextBundles(contextCards, outputDir);
  const validation = validateContextBundle({ results, contextCards });
  const bundle = {
    schema_version: "human-review-context-bundle.v1",
    generated_at: generatedAt,
    bundle_id: `human-review-context-bundle.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    bundle_status: deriveBundleStatus(validation, contextCards),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      context_only: true,
      protected_actions_executed: false,
    },
    sources: [
      buildSource("human_review_receipt_workspace_merge", "Human Review Receipt Workspace Merge", paths.workspaceMergePath, results.workspaceMerge),
      buildSource("human_review_receipt_workspace", "Human Review Receipt Workspace", paths.workspacePath, results.workspace),
      buildSource("control_plane_human_gates", "Control Plane Human Gates", paths.humanGatesPath, results.humanGates),
      buildSource("control_plane_action_plan", "Control Plane Action Plan", paths.actionPlanPath, results.actionPlan),
      buildSource("evidence_viewer", "Evidence Viewer", paths.evidenceViewerPath, results.evidenceViewer),
      buildSource("approval_inbox", "Approval Inbox", paths.approvalInboxPath, results.approvalInbox),
      buildSource("matter_cockpit", "Matter Cockpit", paths.matterCockpitPath, results.matterCockpit),
    ],
    summary: summarizeBundle(actorContextBundles, contextCards, validation),
    actor_context_bundles: actorContextBundles,
    context_cards: contextCards,
    validation,
  };

  return {
    ...bundle,
    markdown: renderBundleMarkdown(bundle),
  };
}

export async function writeHumanReviewContextBundle(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-context-bundle.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    bundle_id: result.bundle_id,
    output_dir: result.output_dir,
    bundle_status: result.bundle_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_context_bundles: result.actor_context_bundles,
    context_cards: result.context_cards,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "context-cards.json"), {
    generated_at: result.generated_at,
    count: result.context_cards.length,
    context_cards: result.context_cards,
  });
  await writeJson(path.join(outDir, "actor-context-bundles.json"), {
    generated_at: result.generated_at,
    count: result.actor_context_bundles.length,
    actor_context_bundles: result.actor_context_bundles,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorBundle of result.actor_context_bundles) {
    const actorDir = path.join(outDir, "actors", actorBundle.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "context-cards.json"), {
      generated_at: result.generated_at,
      required_actor: actorBundle.required_actor,
      count: actorBundle.context_card_ids.length,
      context_cards: result.context_cards.filter((card) => card.required_actor === actorBundle.required_actor),
    });
    await writeFile(path.join(actorDir, "context.md"), renderActorContextMarkdown(actorBundle, result.context_cards), "utf8");
  }
}

export async function runHumanReviewContextBundleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewContextBundle(args);
    console.log(`Human review context bundle ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Bundle status: ${result.bundle_status}`);
    console.log(`Context cards: ${result.summary.context_card_count}`);
    console.log(`Actor bundles: ${result.summary.actor_context_bundle_count}`);
    console.log(`Evidence contexts: ${result.summary.evidence_context_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLookups(results) {
  const gateById = new Map((results.humanGates.value?.gate_items ?? []).map((item) => [item.gate_item_id, item]));
  const planById = new Map((results.actionPlan.value?.plan_items ?? []).map((item) => [item.plan_item_id, item]));
  const workspaceEntryByReceipt = new Map((results.workspace.value?.workspace_entries ?? []).map((entry) => [entry.receipt_id, entry]));
  const evidenceById = new Map((results.evidenceViewer.value?.review_packet?.evidence_cards ?? []).map((card) => [card.evidence_id, card]));
  const approvalItems = results.approvalInbox.value?.items ?? [];
  const approvalById = new Map();
  for (const item of approvalItems) {
    for (const key of [item.approval_item_id, item.approval_id, item.delivery_action_id, item.artifact_id].filter(Boolean)) approvalById.set(key, item);
  }
  const matters = results.matterCockpit.value?.matters ?? [];
  const matterByKey = new Map();
  for (const matter of matters) {
    matterByKey.set(matter.matter_key, matter);
    matterByKey.set(matter.matter_id, matter);
  }
  return { gateById, planById, workspaceEntryByReceipt, evidenceById, approvalById, matterByKey };
}

function buildContextCards(mergeItems, lookups) {
  return mergeItems.map((mergeItem) => {
    const gateItem = lookups.gateById.get(mergeItem.gate_item_id);
    const planItem = lookups.planById.get(mergeItem.source_plan_item_id);
    const workspaceEntry = lookups.workspaceEntryByReceipt.get(mergeItem.receipt_id);
    const subjectRef = gateItem?.subject_ref ?? planItem?.subject_ref ?? null;
    const evidenceContext = subjectRef?.subject_type === "evidence_item" ? lookups.evidenceById.get(subjectRef.subject_id) ?? null : null;
    const approvalContext = findApprovalContext(subjectRef, mergeItem, lookups);
    const matterContext = findMatterContext(subjectRef, evidenceContext, approvalContext, lookups);
    const gateContext = gateItem ? summarizeGate(gateItem) : null;
    const planContext = planItem ? summarizePlan(planItem) : null;
    const reviewContract = buildReviewContract(mergeItem, workspaceEntry);
    const contextRefs = buildContextRefs({ gateItem, planItem, workspaceEntry, evidenceContext, approvalContext, matterContext });
    const missing = [];
    if (!gateItem) missing.push("gate_item");
    if (!planItem) missing.push("action_plan_item");
    if (subjectRef?.subject_type === "evidence_item" && !evidenceContext) missing.push("evidence_card");
    if ((approvalContext?.matter_key || subjectRef?.subject_type === "matter") && !matterContext) missing.push("matter_context");
    return {
      context_card_id: `human-review-context-card.${slugify(mergeItem.gate_item_id)}`,
      merge_item_id: mergeItem.merge_item_id,
      receipt_id: mergeItem.receipt_id,
      gate_item_id: mergeItem.gate_item_id,
      source_plan_item_id: mergeItem.source_plan_item_id,
      gate_type: mergeItem.gate_type,
      priority: mergeItem.priority,
      required_actor: mergeItem.required_actor,
      protected_action: mergeItem.protected_action,
      subject_ref: subjectRef,
      title: gateItem?.title ?? planItem?.title ?? `Review ${mergeItem.gate_type}`,
      reason: gateItem?.reason ?? planItem?.reason ?? "",
      gate_context: gateContext,
      plan_context: planContext,
      recommended_actions: unique([...(gateItem?.recommended_actions ?? []), ...(planItem?.recommended_actions ?? [])]),
      next_commands: unique([...(gateItem?.next_commands ?? []), ...(planItem?.next_commands ?? [])]),
      receipt_status: mergeItem.receipt_status,
      outcome: mergeItem.outcome,
      review_contract: reviewContract,
      evidence_context: evidenceContext ? summarizeEvidence(evidenceContext) : null,
      approval_context: approvalContext ? summarizeApproval(approvalContext) : null,
      matter_context: matterContext ? summarizeMatter(matterContext) : null,
      context_refs: contextRefs,
      context_flags: {
        requires_human: true,
        protected_action: mergeItem.protected_action,
        gate_context_present: Boolean(gateContext),
        plan_context_present: Boolean(planContext),
        evidence_context_present: Boolean(evidenceContext),
        approval_context_present: Boolean(approvalContext),
        matter_context_present: Boolean(matterContext),
      },
      context_status: missing.length > 0 ? "attention" : "ready",
      missing_context: missing,
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        context_only: true,
      },
    };
  }).sort(compareContextCards);
}

function findApprovalContext(subjectRef, mergeItem, lookups) {
  for (const key of [
    subjectRef?.subject_id,
    mergeItem.source_plan_item_id?.replace(/^action-plan\.dashboard\.dashboard\.action\./, ""),
    mergeItem.receipt?.source_plan_item_id,
  ].filter(Boolean)) {
    const direct = lookups.approvalById.get(key);
    if (direct) return direct;
  }
  return null;
}

function findMatterContext(subjectRef, evidenceContext, approvalContext, lookups) {
  for (const key of [
    subjectRef?.subject_type === "matter" ? subjectRef.subject_id : null,
    approvalContext?.matter_key,
    approvalContext?.matter_id,
    evidenceContext?.matter_id,
  ].filter(Boolean)) {
    const matter = lookups.matterByKey.get(key);
    if (matter) return matter;
  }
  return null;
}

function buildContextRefs({ gateItem, planItem, workspaceEntry, evidenceContext, approvalContext, matterContext }) {
  const refs = [];
  if (gateItem) refs.push({ source_id: "control_plane_human_gates", ref_type: "gate_item", ref_id: gateItem.gate_item_id });
  if (planItem) refs.push({ source_id: "control_plane_action_plan", ref_type: "plan_item", ref_id: planItem.plan_item_id });
  if (workspaceEntry) refs.push({ source_id: "human_review_receipt_workspace", ref_type: "workspace_entry", ref_id: workspaceEntry.workspace_entry_id });
  if (evidenceContext) refs.push({ source_id: "evidence_viewer", ref_type: "evidence_card", ref_id: evidenceContext.evidence_id });
  if (approvalContext) refs.push({ source_id: "approval_inbox", ref_type: "approval_item", ref_id: approvalContext.approval_item_id });
  if (matterContext) refs.push({ source_id: "matter_cockpit", ref_type: "matter", ref_id: matterContext.matter_key });
  return refs;
}

function buildActorContextBundles(contextCards, outputDir) {
  return Object.entries(groupBy(contextCards, (card) => card.required_actor))
    .map(([requiredActor, cards]) => ({
      actor_context_bundle_id: `human-review-context-bundle.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      bundle_status: cards.some((card) => card.context_status === "attention")
        ? "attention"
        : cards.some((card) => card.receipt_status === "pending")
          ? "pending_human_review"
          : "ready",
      priority: highestPriority(cards),
      context_card_count: cards.length,
      pending_receipt_count: cards.filter((card) => card.receipt_status === "pending").length,
      evidence_context_count: cards.filter((card) => card.evidence_context).length,
      approval_context_count: cards.filter((card) => card.approval_context).length,
      matter_context_count: cards.filter((card) => card.matter_context).length,
      protected_action_count: cards.filter((card) => card.protected_action).length,
      attention_context_count: cards.filter((card) => card.context_status === "attention").length,
      context_card_ids: cards.map((card) => card.context_card_id),
      context_json_path: path.join(outputDir, "actors", requiredActor, "context-cards.json"),
      context_markdown_path: path.join(outputDir, "actors", requiredActor, "context.md"),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        context_only: true,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorBundles);
}

function validateContextBundle({ results, contextCards }) {
  const errors = [];
  for (const [sourceId, result] of Object.entries(results)) {
    if (!result.ok) errors.push({ path: `sources.${sourceId}`, message: `Source unavailable: ${result.error}` });
  }
  for (const card of contextCards) {
    if (card.safe_handling.auto_execute_allowed || card.safe_handling.protected_actions_executed) {
      errors.push({ path: `context_cards.${card.context_card_id}.safe_handling`, message: "Context bundles must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeBundle(actorBundles, contextCards, validation) {
  return {
    actor_context_bundle_count: actorBundles.length,
    context_card_count: contextCards.length,
    pending_receipt_count: contextCards.filter((card) => card.receipt_status === "pending").length,
    ready_context_count: contextCards.filter((card) => card.context_status === "ready").length,
    attention_context_count: contextCards.filter((card) => card.context_status === "attention").length,
    gate_context_count: contextCards.filter((card) => card.gate_context).length,
    plan_context_count: contextCards.filter((card) => card.plan_context).length,
    evidence_context_count: contextCards.filter((card) => card.evidence_context).length,
    approval_context_count: contextCards.filter((card) => card.approval_context).length,
    matter_context_count: contextCards.filter((card) => card.matter_context).length,
    protected_action_context_count: contextCards.filter((card) => card.protected_action).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(contextCards, "required_actor"),
    by_gate_type: countBy(contextCards, "gate_type"),
    by_context_status: countBy(contextCards, "context_status"),
  };
}

function deriveBundleStatus(validation, contextCards) {
  if (!validation.valid) return "blocked";
  if (contextCards.some((card) => card.context_status === "attention")) return "attention";
  if (contextCards.some((card) => card.receipt_status === "pending")) return "pending_human_review";
  return "ready";
}

function summarizeGate(item) {
  return {
    gate_item_id: item.gate_item_id,
    gate_type: item.gate_type,
    source_stage: item.source_stage,
    status: item.status,
    title: item.title,
    reason: item.reason,
    recommended_actions: item.recommended_actions ?? [],
    next_commands: item.next_commands ?? [],
    source_refs: item.source_refs ?? [],
  };
}

function summarizePlan(item) {
  return {
    plan_item_id: item.plan_item_id,
    source_type: item.source_type,
    source_stage: item.source_stage,
    status: item.status,
    title: item.title,
    reason: item.reason,
    recommended_actions: item.recommended_actions ?? [],
    next_commands: item.next_commands ?? [],
    source_refs: item.source_refs ?? [],
  };
}

function buildReviewContract(mergeItem, workspaceEntry) {
  return {
    receipt_id: mergeItem.receipt_id,
    receipt_status: mergeItem.receipt_status,
    outcome: mergeItem.outcome,
    allowed_outcomes: workspaceEntry?.allowed_outcomes ?? [],
    required_receipt_fields: workspaceEntry?.required_receipt_fields ?? mergeItem.receipt?.required_receipt_fields ?? [],
    decision_reference: mergeItem.receipt?.decision_reference ?? workspaceEntry?.decision_reference ?? "",
    decision_notes: mergeItem.receipt?.decision_notes ?? workspaceEntry?.decision_notes ?? "",
    ready_for_validation: Boolean(mergeItem.ready_for_validation),
    validation_required_before_application: true,
    protected_action_reference: mergeItem.receipt?.protected_action_reference ?? null,
  };
}

function summarizeEvidence(card) {
  return {
    evidence_id: card.evidence_id,
    matter_id: card.matter_id,
    review_status: card.review_status,
    reliability: card.reliability,
    evidence_type: card.evidence_type,
    summary: card.summary,
    source: card.source,
    span_locator: card.span_locator ?? null,
    span_preview: trimText(card.span_text, 700),
  };
}

function summarizeApproval(item) {
  return {
    approval_item_id: item.approval_item_id,
    item_type: item.item_type,
    status: item.status,
    matter_key: item.matter_key,
    domain_pack: item.domain_pack,
    artifact_id: item.artifact_id,
    delivery_action_id: item.delivery_action_id,
    required_decision: item.required_decision,
    allowed_decisions: item.allowed_decisions ?? [],
    context: item.context ?? null,
  };
}

function summarizeMatter(matter) {
  return {
    matter_key: matter.matter_key,
    tenant_id: matter.tenant_id,
    matter_id: matter.matter_id,
    matter_label: matter.matter_label,
    status: matter.status,
    domain_packs: matter.domain_packs ?? [],
    evidence_count: matter.evidence_count ?? 0,
    output_artifact_count: matter.output_artifact_count ?? 0,
    pending_approval_count: matter.pending_approval_count ?? 0,
    blocked_delivery_count: matter.blocked_delivery_count ?? 0,
    blocking_gate_count: matter.blocking_gate_count ?? 0,
  };
}

function renderBundleMarkdown(bundle) {
  const lines = [
    "# Human Review Context Bundle",
    "",
    `- Bundle status: ${bundle.bundle_status}`,
    `- Actor bundles: ${bundle.summary.actor_context_bundle_count}`,
    `- Context cards: ${bundle.summary.context_card_count}`,
    `- Pending receipts: ${bundle.summary.pending_receipt_count}`,
    `- Evidence contexts: ${bundle.summary.evidence_context_count}`,
    `- Approval contexts: ${bundle.summary.approval_context_count}`,
    `- Matter contexts: ${bundle.summary.matter_context_count}`,
    `- Validation errors: ${bundle.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This artifact provides context only.",
    "- It does not apply receipts or execute protected actions.",
    "- Receipt validation and application remain separate gated stages.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of bundle.actor_context_bundles) {
    lines.push(`- ${actor.required_actor}: ${actor.context_card_count} card(s), ${actor.attention_context_count} attention, ${actor.context_markdown_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorContextMarkdown(actorBundle, contextCards) {
  const cards = contextCards.filter((card) => card.required_actor === actorBundle.required_actor);
  const lines = [
    `# Human Review Context: ${actorBundle.required_actor}`,
    "",
    `- Bundle status: ${actorBundle.bundle_status}`,
    `- Context cards: ${actorBundle.context_card_count}`,
    `- Pending receipts: ${actorBundle.pending_receipt_count}`,
    `- Evidence contexts: ${actorBundle.evidence_context_count}`,
    `- Protected actions: ${actorBundle.protected_action_count}`,
    "",
    "## Cards",
    "",
  ];
  for (const card of cards) {
    lines.push(`### ${card.title}`);
    lines.push("");
    lines.push(`- Gate: ${card.gate_item_id}`);
    lines.push(`- Type: ${card.gate_type}`);
    lines.push(`- Status: ${card.context_status}`);
    lines.push(`- Subject: ${card.subject_ref?.subject_type ?? "unknown"}:${card.subject_ref?.subject_id ?? "unknown"}`);
    if (card.evidence_context) lines.push(`- Evidence: ${card.evidence_context.evidence_id} (${card.evidence_context.review_status})`);
    if (card.approval_context) lines.push(`- Approval: ${card.approval_context.approval_item_id} (${card.approval_context.status})`);
    if (card.matter_context) lines.push(`- Matter: ${card.matter_context.matter_key} (${card.matter_context.status})`);
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

function compareContextCards(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || a.gate_item_id.localeCompare(b.gate_item_id);
}

function compareActorBundles(a, b) {
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function trimText(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
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
    else if (arg === "--workspace-merge") args.workspaceMergePath = argv[++index];
    else if (arg === "--workspace") args.workspacePath = argv[++index];
    else if (arg === "--human-gates") args.humanGatesPath = argv[++index];
    else if (arg === "--action-plan") args.actionPlanPath = argv[++index];
    else if (arg === "--evidence-viewer") args.evidenceViewerPath = argv[++index];
    else if (arg === "--approval-inbox") args.approvalInboxPath = argv[++index];
    else if (arg === "--matter-cockpit") args.matterCockpitPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-context-bundle.mjs [options]

Options:
  --workspace-merge <path> Human review receipt workspace merge artifact
  --workspace <path>       Human review receipt workspace artifact
  --human-gates <path>     Control Plane human gates artifact
  --action-plan <path>     Control Plane action plan artifact
  --evidence-viewer <path> Evidence viewer artifact
  --approval-inbox <path>  Approval inbox artifact
  --matter-cockpit <path>  Matter cockpit artifact
  --out-dir <dir>          Output directory
  --run-at <iso>           Override generated_at
  --check                  Exit non-zero when validation fails
`);
}
