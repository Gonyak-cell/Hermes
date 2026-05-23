import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_APPROVAL_INBOX_DECISIONS_OUT_DIR = "artifacts/approval-inbox-decisions/latest";
export const DEFAULT_APPROVAL_INBOX_PATH = "artifacts/approval-inbox/latest/approval-inbox.json";
export const DEFAULT_APPROVAL_INBOX_DECISIONS_PATH = "artifacts/approval-inbox/latest/decision-template.json";
export const DEFAULT_DELIVERY_QUEUE_PATH = "artifacts/delivery-queue/latest/protected-delivery-queue.json";
export const DEFAULT_OUTPUT_CATALOG_PATH = "artifacts/output-catalog/latest/output-catalog.json";

const APPROVAL_REQUEST_DECISIONS = new Set(["approve", "request_changes", "reject", "defer"]);
const GATE_REVIEW_DECISIONS = new Set(["mark_resolved", "waive_for_now", "keep_blocked", "defer"]);
const APPROVED_DECISIONS = new Set(["approve", "approved"]);
const CHANGES_REQUESTED_DECISIONS = new Set(["request_changes", "changes_requested"]);
const REJECTED_DECISIONS = new Set(["reject", "rejected"]);
const RESOLVED_DECISIONS = new Set(["mark_resolved", "resolve", "resolved"]);
const WAIVED_DECISIONS = new Set(["waive_for_now", "waive", "waived"]);
const KEEP_BLOCKED_DECISIONS = new Set(["keep_blocked", "blocked"]);
const DEFERRED_DECISIONS = new Set(["defer", "deferred"]);

export async function runApprovalInboxDecisions(options = {}) {
  const result = await buildApprovalInboxDecisions(options);
  if (options.write !== false) await writeApprovalInboxDecisions(result, result.output_dir);
  return result;
}

export async function buildApprovalInboxDecisions(options = {}) {
  const inboxPath = path.resolve(options.inboxPath ?? DEFAULT_APPROVAL_INBOX_PATH);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_APPROVAL_INBOX_DECISIONS_PATH);
  const deliveryQueuePath = options.deliveryQueuePath === false
    ? null
    : path.resolve(options.deliveryQueuePath ?? DEFAULT_DELIVERY_QUEUE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_OUTPUT_CATALOG_PATH);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_INBOX_DECISIONS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const inbox = JSON.parse(await readFile(inboxPath, "utf8"));
  const decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
  const deliveryQueue = deliveryQueuePath ? await readJsonIfExists(deliveryQueuePath) : null;
  const outputCatalog = outputCatalogPath ? await readJsonIfExists(outputCatalogPath) : null;
  const patchedDeliveryQueue = deliveryQueue ? structuredClone(deliveryQueue) : null;
  const patchedOutputCatalog = outputCatalog ? structuredClone(outputCatalog) : null;
  const inboxById = new Map((inbox.items ?? []).map((item) => [item.approval_item_id, item]));
  const decisionById = new Map((decisions.decisions ?? []).map((decision) => [decision.approval_item_id, decision]));
  const appliedItems = [];
  const unappliedItems = [];
  const auditEvents = [];
  const decisionErrors = validateDecisions(decisions, inboxById);
  const erroredDecisionIds = new Set(decisionErrors.map((error) => error.approval_item_id));

  for (const inboxItem of inbox.items ?? []) {
    const rawDecision = decisionById.get(inboxItem.approval_item_id);
    const decision = normalizeDecision(rawDecision?.decision);
    if (!rawDecision || decision === "pending") {
      unappliedItems.push(toUnappliedItem(inboxItem, rawDecision));
      continue;
    }
    if (erroredDecisionIds.has(inboxItem.approval_item_id)) {
      unappliedItems.push(toUnappliedItem(inboxItem, rawDecision, "decision_error"));
      continue;
    }

    const applied = applyInboxDecision(inbox, inboxItem, rawDecision, {
      decision,
      generatedAt,
      patchedDeliveryQueue,
      patchedOutputCatalog,
    });
    appliedItems.push(applied);
    auditEvents.push(buildDecisionAuditEvent(inbox, inboxItem, rawDecision, decision, generatedAt));
  }

  if (patchedDeliveryQueue) {
    patchedDeliveryQueue.generated_at = generatedAt;
    patchedDeliveryQueue.summary = summarizeDeliveryQueue(patchedDeliveryQueue);
  }
  if (patchedOutputCatalog) {
    patchedOutputCatalog.generated_at = generatedAt;
    patchedOutputCatalog.summary = summarizeOutputCatalog(patchedOutputCatalog);
  }

  const result = {
    schema_version: "approval-inbox-decision-result.v1",
    generated_at: generatedAt,
    source_inbox: inboxPath,
    source_decisions: decisionsPath,
    source_delivery_queue: deliveryQueuePath,
    source_output_catalog: outputCatalogPath,
    output_dir: outputDir,
    summary: summarizeInboxDecisions(inbox.items ?? [], appliedItems, unappliedItems, decisionErrors, patchedDeliveryQueue, patchedOutputCatalog),
    applied_items: appliedItems,
    unapplied_items: unappliedItems,
    audit_events: auditEvents,
    patched_delivery_queue: patchedDeliveryQueue,
    patched_output_catalog: patchedOutputCatalog,
    decision_errors: decisionErrors,
  };

  return {
    ...result,
    markdown: renderApprovalInboxDecisionSummary(result),
  };
}

export async function writeApprovalInboxDecisions(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "approval-inbox-decision-result.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    source_inbox: result.source_inbox,
    source_decisions: result.source_decisions,
    source_delivery_queue: result.source_delivery_queue,
    source_output_catalog: result.source_output_catalog,
    summary: result.summary,
    applied_items: result.applied_items,
    unapplied_items: result.unapplied_items,
    audit_events: result.audit_events,
    patched_delivery_queue: result.patched_delivery_queue,
    patched_output_catalog: result.patched_output_catalog,
    decision_errors: result.decision_errors,
  });
  if (result.patched_delivery_queue) {
    await writeJson(path.join(outDir, "patched-delivery-queue.json"), result.patched_delivery_queue);
  }
  if (result.patched_output_catalog) {
    await writeJson(path.join(outDir, "patched-output-catalog.json"), result.patched_output_catalog);
  }
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runApprovalInboxDecisionsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runApprovalInboxDecisions(args);
  console.log(`Approval inbox decisions written to ${result.output_dir}`);
  console.log(`Applied: ${result.summary.applied_count}`);
  console.log(`Pending: ${result.summary.pending_count}`);
  console.log(`Ready for delivery: ${result.summary.ready_for_delivery_count}`);
  if (result.decision_errors.length > 0) console.log(`Decision errors: ${result.decision_errors.length}`);
}

function applyInboxDecision(inbox, inboxItem, rawDecision, context) {
  const statusAfter = mapDecisionToStatusAfter(context.decision);
  const deliveryPatch = context.patchedDeliveryQueue
    ? patchDeliveryQueue(context.patchedDeliveryQueue, inboxItem, context.decision, rawDecision)
    : null;
  const outputPatch = context.patchedOutputCatalog
    ? patchOutputCatalog(context.patchedOutputCatalog, inboxItem, context.decision, rawDecision)
    : null;

  return {
    approval_item_id: inboxItem.approval_item_id,
    item_type: inboxItem.item_type,
    subject_ref: {
      subject_type: inboxItem.item_type === "approval_request" ? "approval" : "delivery_action",
      subject_id: inboxItem.approval_id ?? inboxItem.delivery_action_id,
    },
    priority: inboxItem.priority,
    status_before: inboxItem.status,
    status_after: statusAfter,
    decision: context.decision,
    decided_by: rawDecision.decided_by ?? null,
    decided_at: rawDecision.decided_at || context.generatedAt,
    comment: rawDecision.comment ?? "",
    follow_up_action: rawDecision.follow_up_action ?? "",
    delivery_patch: deliveryPatch,
    output_patch: outputPatch,
    correlation_id: inbox.inbox_id,
  };
}

function patchDeliveryQueue(queue, inboxItem, decision, rawDecision) {
  const action = (queue.delivery_actions ?? []).find((candidate) => candidate.delivery_action_id === inboxItem.delivery_action_id);
  if (!action) {
    return {
      patched: false,
      reason: "delivery_action_not_found",
      delivery_action_id: inboxItem.delivery_action_id,
    };
  }

  const before = snapshotDeliveryAction(action);
  const patchState = derivePatchedState(inboxItem, decision, {
    current_status: action.delivery_status,
    approval_status: action.approval_status,
    blocking_gate_ids: action.blocking_gate_ids ?? [],
  });
  action.delivery_status = patchState.delivery_status;
  action.approval_status = patchState.approval_status;
  action.blocking_gate_ids = patchState.blocking_gate_ids;
  action.blocked_reasons = patchState.blocked_reasons;
  action.recommended_actions = patchState.recommended_actions;
  action.protected_action = patchState.delivery_status !== "delivered";
  action.priority = derivePriority(action.domain_pack, patchState.delivery_status);
  action.metadata = {
    ...(action.metadata ?? {}),
    approval_inbox_decision: buildDecisionMetadata(decision, rawDecision),
  };

  return {
    patched: true,
    delivery_action_id: action.delivery_action_id,
    before,
    after: snapshotDeliveryAction(action),
  };
}

function patchOutputCatalog(catalog, inboxItem, decision, rawDecision) {
  const artifact = (catalog.artifacts ?? []).find((candidate) => candidate.artifact_id === inboxItem.artifact_id);
  if (!artifact) {
    return {
      patched: false,
      reason: "output_artifact_not_found",
      artifact_id: inboxItem.artifact_id,
    };
  }

  const before = snapshotOutputArtifact(artifact);
  const patchState = derivePatchedState(inboxItem, decision, {
    current_status: artifact.delivery_state,
    approval_status: artifact.approval_status,
    blocking_gate_ids: artifact.blocking_gate_ids ?? [],
  });
  artifact.delivery_state = patchState.delivery_status;
  artifact.approval_status = patchState.approval_status;
  artifact.blocking_gate_ids = patchState.blocking_gate_ids;
  artifact.blocking_gate_count = patchState.blocking_gate_ids.length;
  artifact.status = deriveArtifactStatus(artifact.status, decision, patchState.delivery_status);
  artifact.metadata = {
    ...(artifact.metadata ?? {}),
    approval_inbox_decision: buildDecisionMetadata(decision, rawDecision),
  };

  return {
    patched: true,
    artifact_id: artifact.artifact_id,
    before,
    after: snapshotOutputArtifact(artifact),
  };
}

function derivePatchedState(inboxItem, decision, current) {
  const blockingGateIds = removeHumanApprovalGate(current.blocking_gate_ids);
  if (DEFERRED_DECISIONS.has(decision)) {
    return {
      delivery_status: current.current_status,
      approval_status: current.approval_status,
      blocking_gate_ids: current.blocking_gate_ids,
      blocked_reasons: inboxItem.blocked_reasons ?? [],
      recommended_actions: ["review_later", "rerun_approval_inbox_apply"],
    };
  }
  if (APPROVED_DECISIONS.has(decision)) {
    const deliveryStatus = blockingGateIds.length === 0 ? "ready_for_delivery" : "blocked_by_gate";
    return {
      delivery_status: deliveryStatus,
      approval_status: "approved",
      blocking_gate_ids: blockingGateIds,
      blocked_reasons: deriveBlockedReasons(deliveryStatus, blockingGateIds),
      recommended_actions: deriveRecommendedActions(deliveryStatus),
    };
  }
  if (CHANGES_REQUESTED_DECISIONS.has(decision)) {
    return {
      delivery_status: "blocked_by_decision",
      approval_status: "changes_requested",
      blocking_gate_ids: blockingGateIds,
      blocked_reasons: ["approval_decision_blocked"],
      recommended_actions: ["revise_output_artifact", "rerun_output_catalog", "rerun_delivery_queue"],
    };
  }
  if (REJECTED_DECISIONS.has(decision)) {
    return {
      delivery_status: "blocked_by_decision",
      approval_status: "rejected",
      blocking_gate_ids: blockingGateIds,
      blocked_reasons: ["approval_decision_blocked"],
      recommended_actions: ["archive_or_redraft_output", "rerun_output_catalog", "rerun_delivery_queue"],
    };
  }
  if (RESOLVED_DECISIONS.has(decision) || WAIVED_DECISIONS.has(decision)) {
    const deliveryStatus = blockingGateIds.length === 0 ? "ready_for_delivery" : "blocked_by_gate";
    return {
      delivery_status: deliveryStatus,
      approval_status: current.approval_status,
      blocking_gate_ids: blockingGateIds,
      blocked_reasons: deriveBlockedReasons(deliveryStatus, blockingGateIds),
      recommended_actions: deriveRecommendedActions(deliveryStatus),
    };
  }
  if (KEEP_BLOCKED_DECISIONS.has(decision)) {
    return {
      delivery_status: current.current_status,
      approval_status: current.approval_status,
      blocking_gate_ids: current.blocking_gate_ids,
      blocked_reasons: inboxItem.blocked_reasons ?? [],
      recommended_actions: ["keep_blocked", "document_blocker_reason", "rerun_after_fix"],
    };
  }
  return {
    delivery_status: current.current_status,
    approval_status: current.approval_status,
    blocking_gate_ids: current.blocking_gate_ids,
    blocked_reasons: inboxItem.blocked_reasons ?? [],
    recommended_actions: ["review_decision_value"],
  };
}

function deriveArtifactStatus(currentStatus, decision, deliveryStatus) {
  if (deliveryStatus === "ready_for_delivery") return "approved";
  if (APPROVED_DECISIONS.has(decision)) return "approved";
  if (CHANGES_REQUESTED_DECISIONS.has(decision) || REJECTED_DECISIONS.has(decision)) return "draft";
  return currentStatus;
}

function deriveBlockedReasons(deliveryStatus, blockingGateIds) {
  if (deliveryStatus === "ready_for_delivery") return [];
  if (deliveryStatus === "blocked_by_gate") return ["blocking_gate", ...blockingGateIds.map((gateId) => `gate:${gateId}`)];
  if (deliveryStatus === "blocked_by_decision") return ["approval_decision_blocked"];
  if (deliveryStatus === "blocked_pending_approval") return ["approval_pending", ...blockingGateIds.map((gateId) => `gate:${gateId}`)];
  if (deliveryStatus === "draft_only") return ["draft_only"];
  return [];
}

function deriveRecommendedActions(deliveryStatus) {
  if (deliveryStatus === "ready_for_delivery") return ["confirm_destination", "execute_delivery_after_final_check"];
  if (deliveryStatus === "blocked_by_gate") return ["resolve_blocking_gate", "rerun_output_catalog", "rerun_delivery_queue"];
  if (deliveryStatus === "blocked_by_decision") return ["review_decision", "revise_output_artifact"];
  return ["complete_required_review", "rerun_delivery_queue"];
}

function removeHumanApprovalGate(gateIds) {
  return [...new Set((gateIds ?? []).filter((gateId) => gateId !== "human_approval_gate"))];
}

function derivePriority(domainPack, deliveryStatus) {
  if (deliveryStatus === "ready_for_delivery") return "high";
  if (domainPack === "law-firm" && deliveryStatus.startsWith("blocked_")) return "high";
  if (deliveryStatus.startsWith("blocked_")) return "medium";
  return "low";
}

function buildDecisionAuditEvent(inbox, inboxItem, rawDecision, decision, generatedAt) {
  return {
    schema_version: "audit-event.v1",
    id: `event.approval_inbox_decision.${shortHash(`${inbox.inbox_id}:${inboxItem.approval_item_id}:${decision}`)}`,
    type: "approval_inbox.decided",
    time: rawDecision.decided_at || generatedAt,
    tenant_id: inboxItem.tenant_id,
    actor: {
      actor_type: rawDecision.decided_by ? "human" : "manual",
      actor_id: rawDecision.decided_by || "manual.unassigned",
      display_name: rawDecision.decided_by || "Unassigned Reviewer",
    },
    subject: {
      subject_type: inboxItem.item_type === "approval_request" ? "approval" : "delivery_action",
      subject_id: inboxItem.approval_id ?? inboxItem.delivery_action_id,
    },
    correlation_id: inbox.inbox_id,
    data: {
      approval_item_id: inboxItem.approval_item_id,
      delivery_action_id: inboxItem.delivery_action_id,
      artifact_id: inboxItem.artifact_id,
      decision,
      comment: rawDecision.comment ?? "",
      follow_up_action: rawDecision.follow_up_action ?? "",
    },
    metadata: {
      item_type: inboxItem.item_type,
      domain_pack: inboxItem.domain_pack,
      matter_id: inboxItem.matter_id,
    },
  };
}

function validateDecisions(decisions, inboxById) {
  const errors = [];
  const seen = new Set();
  for (const decision of decisions.decisions ?? []) {
    const approvalItemId = decision.approval_item_id;
    const inboxItem = inboxById.get(approvalItemId);
    if (seen.has(approvalItemId)) {
      errors.push({
        approval_item_id: approvalItemId,
        message: "Duplicate decision for approval inbox item.",
      });
    }
    seen.add(approvalItemId);
    if (!inboxItem) {
      errors.push({
        approval_item_id: approvalItemId,
        message: "Decision references an unknown approval inbox item.",
      });
      continue;
    }

    const normalized = normalizeDecision(decision.decision);
    if (normalized === "pending") continue;
    if (!decision.decided_by) {
      errors.push({
        approval_item_id: approvalItemId,
        message: "Non-pending decision should include decided_by.",
      });
    }
    const allowed = inboxItem.item_type === "approval_request" ? APPROVAL_REQUEST_DECISIONS : GATE_REVIEW_DECISIONS;
    if (!allowed.has(normalized)) {
      errors.push({
        approval_item_id: approvalItemId,
        message: `Decision ${normalized} is not allowed for ${inboxItem.item_type}.`,
      });
    }
  }
  return errors;
}

function summarizeInboxDecisions(inboxItems, appliedItems, unappliedItems, decisionErrors, patchedDeliveryQueue, patchedOutputCatalog) {
  const readyForDeliveryCount = patchedDeliveryQueue?.summary?.ready_action_count ?? 0;
  return {
    inbox_item_count: inboxItems.length,
    applied_count: appliedItems.length,
    pending_count: unappliedItems.length,
    approved_count: appliedItems.filter((item) => APPROVED_DECISIONS.has(item.decision)).length,
    rejected_count: appliedItems.filter((item) => REJECTED_DECISIONS.has(item.decision)).length,
    changes_requested_count: appliedItems.filter((item) => CHANGES_REQUESTED_DECISIONS.has(item.decision)).length,
    gate_resolved_or_waived_count: appliedItems.filter((item) => RESOLVED_DECISIONS.has(item.decision) || WAIVED_DECISIONS.has(item.decision)).length,
    keep_blocked_count: appliedItems.filter((item) => KEEP_BLOCKED_DECISIONS.has(item.decision)).length,
    deferred_count: appliedItems.filter((item) => DEFERRED_DECISIONS.has(item.decision)).length,
    follow_up_count: appliedItems.filter((item) => item.follow_up_action).length,
    decision_error_count: decisionErrors.length,
    audit_event_count: appliedItems.length,
    ready_for_delivery_count: readyForDeliveryCount,
    patched_delivery_blocked_count: patchedDeliveryQueue?.summary?.blocked_action_count ?? 0,
    patched_output_blocked_count: patchedOutputCatalog?.summary?.blocked_delivery_count ?? 0,
    by_decision: countBy(appliedItems, "decision"),
    by_item_type: countBy(appliedItems, "item_type"),
  };
}

function summarizeDeliveryQueue(queue) {
  const actions = queue.delivery_actions ?? [];
  return {
    output_catalog_available: queue.summary?.output_catalog_available ?? false,
    observability_catalog_available: queue.summary?.observability_catalog_available ?? false,
    delivery_action_count: actions.length,
    protected_action_count: actions.filter((action) => action.protected_action).length,
    blocked_action_count: actions.filter((action) => action.delivery_status.startsWith("blocked_") || action.delivery_status === "draft_only").length,
    pending_approval_count: actions.filter((action) => action.delivery_status === "blocked_pending_approval").length,
    blocked_by_gate_count: actions.filter((action) => action.delivery_status === "blocked_by_gate").length,
    ready_action_count: actions.filter((action) => action.delivery_status === "ready_for_delivery").length,
    delivered_action_count: actions.filter((action) => action.delivery_status === "delivered").length,
    law_firm_action_count: actions.filter((action) => action.domain_pack === "law-firm").length,
    personal_dev_action_count: actions.filter((action) => action.domain_pack === "personal-dev").length,
    creative_document_action_count: actions.filter((action) => action.domain_pack === "creative-document").length,
    total_runtime_seconds: actions.reduce((sum, action) => sum + Number(action.runtime_seconds ?? 0), 0),
    by_delivery_status: countBy(actions, "delivery_status"),
    by_delivery_channel: countBy(actions, "delivery_channel"),
    by_delivery_target: countBy(actions, "delivery_target"),
    by_domain_pack: countBy(actions, "domain_pack"),
  };
}

function summarizeOutputCatalog(catalog) {
  const artifacts = catalog.artifacts ?? [];
  return {
    source_count: catalog.sources?.length ?? 0,
    available_source_count: (catalog.sources ?? []).filter((source) => source.available).length,
    missing_source_count: (catalog.sources ?? []).filter((source) => !source.available).length,
    artifact_count: artifacts.length,
    draft_count: artifacts.filter((artifact) => artifact.status === "draft").length,
    pending_review_count: artifacts.filter((artifact) => artifact.status === "pending_review").length,
    approved_count: artifacts.filter((artifact) => artifact.status === "approved").length,
    delivered_count: artifacts.filter((artifact) => artifact.status === "delivered").length,
    approval_pending_count: artifacts.filter((artifact) => artifact.approval_status === "pending").length,
    blocked_delivery_count: artifacts.filter((artifact) => artifact.delivery_state.startsWith("blocked_")).length,
    blocking_gate_count: artifacts.reduce((count, artifact) => count + Number(artifact.blocking_gate_count ?? 0), 0),
    by_artifact_type: countBy(artifacts, "artifact_type"),
    by_domain_pack: countBy(artifacts, "domain_pack"),
    by_delivery_state: countBy(artifacts, "delivery_state"),
  };
}

function renderApprovalInboxDecisionSummary(result) {
  const lines = [];
  lines.push("# Approval Inbox Decision Result");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source inbox: ${result.source_inbox}`);
  lines.push(`Source decisions: ${result.source_decisions}`);
  lines.push("");
  lines.push(`- Inbox items: ${result.summary.inbox_item_count}`);
  lines.push(`- Applied: ${result.summary.applied_count}`);
  lines.push(`- Pending: ${result.summary.pending_count}`);
  lines.push(`- Approved: ${result.summary.approved_count}`);
  lines.push(`- Gate resolved or waived: ${result.summary.gate_resolved_or_waived_count}`);
  lines.push(`- Ready for delivery: ${result.summary.ready_for_delivery_count}`);
  lines.push(`- Decision errors: ${result.summary.decision_error_count}`);
  lines.push("");
  lines.push("## Applied Items");
  lines.push("");
  for (const item of result.applied_items) {
    lines.push(`- ${item.approval_item_id}: ${item.decision} -> ${item.status_after}`);
  }
  if (result.applied_items.length === 0) lines.push("- No inbox decisions applied.");
  if (result.decision_errors.length > 0) {
    lines.push("");
    lines.push("## Decision Errors");
    lines.push("");
    for (const error of result.decision_errors) {
      lines.push(`- ${error.approval_item_id}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function toUnappliedItem(inboxItem, decision, reason = null) {
  return {
    approval_item_id: inboxItem.approval_item_id,
    item_type: inboxItem.item_type,
    delivery_action_id: inboxItem.delivery_action_id,
    artifact_id: inboxItem.artifact_id,
    status: inboxItem.status,
    reason: reason ?? (decision ? "decision_pending" : "decision_missing"),
  };
}

function mapDecisionToStatusAfter(decision) {
  if (APPROVED_DECISIONS.has(decision)) return "approved";
  if (CHANGES_REQUESTED_DECISIONS.has(decision)) return "changes_requested";
  if (REJECTED_DECISIONS.has(decision)) return "rejected";
  if (RESOLVED_DECISIONS.has(decision)) return "resolved";
  if (WAIVED_DECISIONS.has(decision)) return "waived";
  if (KEEP_BLOCKED_DECISIONS.has(decision)) return "kept_blocked";
  if (DEFERRED_DECISIONS.has(decision)) return "deferred";
  return "decided";
}

function snapshotDeliveryAction(action) {
  return {
    delivery_status: action.delivery_status,
    approval_status: action.approval_status,
    blocking_gate_ids: action.blocking_gate_ids ?? [],
    blocked_reasons: action.blocked_reasons ?? [],
    protected_action: action.protected_action,
    priority: action.priority,
  };
}

function snapshotOutputArtifact(artifact) {
  return {
    status: artifact.status,
    delivery_state: artifact.delivery_state,
    approval_status: artifact.approval_status,
    blocking_gate_count: artifact.blocking_gate_count,
    blocking_gate_ids: artifact.blocking_gate_ids ?? [],
  };
}

function buildDecisionMetadata(decision, rawDecision) {
  return {
    decision,
    decided_by: rawDecision.decided_by ?? null,
    decided_at: rawDecision.decided_at ?? null,
    comment: rawDecision.comment ?? "",
    follow_up_action: rawDecision.follow_up_action ?? "",
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeDecision(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  if (normalized === "" || normalized === "pending") return "pending";
  if (APPROVED_DECISIONS.has(normalized)) return "approve";
  if (CHANGES_REQUESTED_DECISIONS.has(normalized)) return "request_changes";
  if (REJECTED_DECISIONS.has(normalized)) return "reject";
  if (RESOLVED_DECISIONS.has(normalized)) return "mark_resolved";
  if (WAIVED_DECISIONS.has(normalized)) return "waive_for_now";
  if (KEEP_BLOCKED_DECISIONS.has(normalized)) return "keep_blocked";
  if (DEFERRED_DECISIONS.has(normalized)) return "defer";
  return normalized;
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

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function parseArgs(argv) {
  const parsed = {
    inboxPath: DEFAULT_APPROVAL_INBOX_PATH,
    decisionsPath: DEFAULT_APPROVAL_INBOX_DECISIONS_PATH,
    deliveryQueuePath: DEFAULT_DELIVERY_QUEUE_PATH,
    outputCatalogPath: DEFAULT_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_APPROVAL_INBOX_DECISIONS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--inbox") parsed.inboxPath = argv[++index];
    else if (arg === "--decisions") parsed.decisionsPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--no-delivery-queue") parsed.deliveryQueuePath = false;
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputCatalogPath = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-inbox-decisions.mjs [options]

Options:
  --inbox <path>             approval-inbox.json path.
  --decisions <path>         decision-template.json or filled decision file path.
  --delivery-queue <path>    protected-delivery-queue.json to patch.
  --no-delivery-queue        Do not write patched delivery queue.
  --output-catalog <path>    output-catalog.json to patch.
  --no-output-catalog        Do not write patched output catalog.
  --out-dir <folder>         Output directory.
  --run-at <iso>             Deterministic generated_at timestamp.
  -h, --help                 Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
