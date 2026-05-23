import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REVIEW_DASHBOARD_OUT_DIR = "artifacts/dashboard/latest";
export const DEFAULT_REVIEW_DASHBOARD_INPUTS = {
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  evidenceViewerPath: "artifacts/evidence-viewer/latest/evidence-viewer.json",
  approvalQueuePath: "artifacts/approval-queue/latest/approval-queue.json",
  approvalDecisionPath: "artifacts/approval-decisions/latest/approval-decision-result.json",
  approvalInboxPath: "artifacts/approval-inbox/latest/approval-inbox.json",
  approvalInboxDecisionPath: "artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  matterCockpitPath: "artifacts/matter-cockpit/latest/matter-cockpit.json",
  deliveryExecutionDraftPath: "artifacts/delivery-execution/latest/delivery-execution-draft.json",
  deliveryReceiptLedgerPath: "artifacts/delivery-receipts/latest/delivery-receipt-ledger.json",
  postDeliveryReconciliationPath: "artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json",
  deliveryCloseoutQueuePath: "artifacts/delivery-closeout/latest/delivery-closeout-queue.json",
  closeoutReceiptValidationPath: "artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json",
  lawFirmLddSummaryPath: "artifacts/law-firm-ldd-slice/latest/summary.json",
  personalDevSummaryPath: "artifacts/personal-dev-slice/latest/summary.json",
  creativeDocumentSummaryPath: "artifacts/creative-document-slice/latest/summary.json",
};

const SOURCE_DEFINITIONS = [
  {
    option: "resourceExpansionPath",
    source_id: "resource_expansion",
    label: "Resource Expansion",
  },
  {
    option: "resourceIngestPath",
    source_id: "resource_ingest",
    label: "Resource Ingest",
  },
  {
    option: "evidenceViewerPath",
    source_id: "evidence_viewer",
    label: "Evidence Viewer",
  },
  {
    option: "approvalQueuePath",
    source_id: "approval_queue",
    label: "Approval Queue",
  },
  {
    option: "approvalDecisionPath",
    source_id: "approval_decisions",
    label: "Approval Decisions",
  },
  {
    option: "approvalInboxPath",
    source_id: "approval_inbox",
    label: "Approval Inbox",
  },
  {
    option: "approvalInboxDecisionPath",
    source_id: "approval_inbox_decisions",
    label: "Approval Inbox Decisions",
  },
  {
    option: "domainPackRegistryPath",
    source_id: "domain_pack_registry",
    label: "Domain Pack Registry",
  },
  {
    option: "outputArtifactCatalogPath",
    source_id: "output_artifact_catalog",
    label: "Output Artifact Catalog",
  },
  {
    option: "observabilityCatalogPath",
    source_id: "observability_catalog",
    label: "Observability Catalog",
  },
  {
    option: "protectedDeliveryQueuePath",
    source_id: "protected_delivery_queue",
    label: "Protected Delivery Queue",
  },
  {
    option: "matterCockpitPath",
    source_id: "matter_cockpit",
    label: "Matter Cockpit",
  },
  {
    option: "deliveryExecutionDraftPath",
    source_id: "delivery_execution_draft",
    label: "Delivery Execution Draft",
  },
  {
    option: "deliveryReceiptLedgerPath",
    source_id: "delivery_receipt_ledger",
    label: "Delivery Receipt Ledger",
  },
  {
    option: "postDeliveryReconciliationPath",
    source_id: "post_delivery_reconciliation",
    label: "Post-Delivery Reconciliation",
  },
  {
    option: "deliveryCloseoutQueuePath",
    source_id: "delivery_closeout_queue",
    label: "Delivery Closeout Queue",
  },
  {
    option: "closeoutReceiptValidationPath",
    source_id: "closeout_receipt_validation",
    label: "Closeout Receipt Validation",
  },
  {
    option: "lawFirmLddSummaryPath",
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
  },
  {
    option: "personalDevSummaryPath",
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
  },
  {
    option: "creativeDocumentSummaryPath",
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
  },
];

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runReviewDashboard(options = {}) {
  const result = await buildReviewDashboard(options);
  if (options.write !== false) await writeReviewDashboard(result, result.output_dir);
  return result;
}

export async function buildReviewDashboard(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REVIEW_DASHBOARD_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceReadResults = await readDashboardSources(options);
  const artifacts = Object.fromEntries(
    sourceReadResults
      .filter((source) => source.available)
      .map((source) => [source.source_id, source.data]),
  );
  const sources = sourceReadResults.map(({ data, ...source }) => source);
  const stageStatuses = buildStageStatuses(artifacts, sources);
  const actionItems = buildActionItems(artifacts).sort(compareActionItems);
  const summary = buildDashboardSummary(artifacts, stageStatuses, actionItems);
  const result = {
    schema_version: "review-dashboard.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary,
    sources,
    stage_statuses: stageStatuses,
    action_items: actionItems,
  };

  return {
    ...result,
    html: renderReviewDashboardHtml(result),
    markdown: renderReviewDashboardMarkdown(result),
  };
}

export async function writeReviewDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "review-dashboard.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    stage_statuses: result.stage_statuses,
    action_items: result.action_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runReviewDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runReviewDashboard(args);
  console.log(`Review dashboard written to ${result.output_dir}`);
  console.log(`Overall status: ${result.summary.overall_status}`);
  console.log(`Pending approvals: ${result.summary.pending_approval_count}`);
  console.log(`Blocking gates: ${result.summary.blocking_gate_count}`);
  console.log(`Action items: ${result.summary.action_item_count}`);
}

async function readDashboardSources(options) {
  const results = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const configuredPath = options[definition.option] ?? DEFAULT_REVIEW_DASHBOARD_INPUTS[definition.option];
    if (configuredPath === false) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: null,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: "disabled",
      });
      continue;
    }

    const resolvedPath = path.resolve(configuredPath);
    try {
      const data = JSON.parse(await readFile(resolvedPath, "utf8"));
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: true,
        schema_version: data.schema_version ?? null,
        generated_at: data.generated_at ?? null,
        summary: summarizeSource(definition.source_id, data),
        error: null,
        data,
      });
    } catch (error) {
      results.push({
        source_id: definition.source_id,
        label: definition.label,
        path: resolvedPath,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        error: error.code === "ENOENT" ? "not_found" : error.message,
      });
    }
  }
  return results;
}

function summarizeSource(sourceId, data) {
  if (sourceId === "resource_expansion") {
    return {
      discovered_count: data.summary?.discovered_count ?? 0,
      extracted_count: data.summary?.extracted_count ?? 0,
      quarantine_count: data.summary?.quarantine_count ?? 0,
      failed_count: data.summary?.failed_count ?? 0,
      remaining_count: data.summary?.remaining_count ?? data.batch?.remaining_count ?? 0,
    };
  }
  if (sourceId === "resource_ingest") return data.summary ?? {};
  if (sourceId === "evidence_viewer") return data.summary ?? data.review_packet?.summary ?? {};
  if (sourceId === "approval_queue") return data.summary ?? {};
  if (sourceId === "approval_decisions") return data.summary ?? {};
  if (sourceId === "approval_inbox") return data.summary ?? {};
  if (sourceId === "approval_inbox_decisions") return data.summary ?? {};
  if (sourceId === "domain_pack_registry") {
    return {
      valid: data.validation?.valid ?? false,
      pack_count: data.summary?.pack_count ?? 0,
      enabled_pack_count: data.summary?.enabled_pack_count ?? 0,
      capability_count: data.summary?.capability_count ?? 0,
      invalid_pack_count: data.summary?.invalid_pack_count ?? 0,
      invalid_capability_count: data.summary?.invalid_capability_count ?? 0,
      error_count: data.summary?.error_count ?? data.validation?.errors?.length ?? 0,
    };
  }
  if (sourceId === "output_artifact_catalog") {
    return {
      artifact_count: data.summary?.artifact_count ?? 0,
      approval_pending_count: data.summary?.approval_pending_count ?? 0,
      blocked_delivery_count: data.summary?.blocked_delivery_count ?? 0,
      blocking_gate_count: data.summary?.blocking_gate_count ?? 0,
      by_artifact_type: data.summary?.by_artifact_type ?? {},
      by_delivery_state: data.summary?.by_delivery_state ?? {},
    };
  }
  if (sourceId === "observability_catalog") {
    return {
      workflow_run_count: data.summary?.workflow_run_count ?? 0,
      event_count: data.summary?.event_count ?? 0,
      agent_run_count: data.summary?.agent_run_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocking_gate_count: data.summary?.blocking_gate_count ?? 0,
      total_runtime_seconds: data.summary?.total_runtime_seconds ?? 0,
      error_record_count: data.summary?.error_record_count ?? 0,
      blocked_run_count: data.summary?.blocked_run_count ?? 0,
      by_runtime_id: data.summary?.by_runtime_id ?? {},
      by_run_status: data.summary?.by_run_status ?? {},
    };
  }
  if (sourceId === "protected_delivery_queue") {
    return {
      delivery_action_count: data.summary?.delivery_action_count ?? 0,
      protected_action_count: data.summary?.protected_action_count ?? 0,
      blocked_action_count: data.summary?.blocked_action_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocked_by_gate_count: data.summary?.blocked_by_gate_count ?? 0,
      ready_action_count: data.summary?.ready_action_count ?? 0,
      delivered_action_count: data.summary?.delivered_action_count ?? 0,
      by_delivery_status: data.summary?.by_delivery_status ?? {},
      by_delivery_channel: data.summary?.by_delivery_channel ?? {},
    };
  }
  if (sourceId === "matter_cockpit") {
    return {
      matter_count: data.summary?.matter_count ?? 0,
      blocked_matter_count: data.summary?.blocked_matter_count ?? 0,
      pending_review_matter_count: data.summary?.pending_review_matter_count ?? 0,
      ready_matter_count: data.summary?.ready_matter_count ?? 0,
      resource_count: data.summary?.resource_count ?? 0,
      evidence_count: data.summary?.evidence_count ?? 0,
      output_artifact_count: data.summary?.output_artifact_count ?? 0,
      workflow_run_count: data.summary?.workflow_run_count ?? 0,
      delivery_action_count: data.summary?.delivery_action_count ?? 0,
      pending_approval_count: data.summary?.pending_approval_count ?? 0,
      blocked_delivery_count: data.summary?.blocked_delivery_count ?? 0,
    };
  }
  if (sourceId === "delivery_execution_draft") return data.summary ?? {};
  if (sourceId === "delivery_receipt_ledger") return data.summary ?? {};
  if (sourceId === "post_delivery_reconciliation") return data.summary ?? {};
  if (sourceId === "delivery_closeout_queue") return data.summary ?? {};
  if (sourceId === "closeout_receipt_validation") return data.summary ?? {};
  if (sourceId === "law_firm_ldd_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      workflow_run_id: data.workflow_run_id ?? null,
      approval_id: data.approval_id ?? null,
      issue_count: data.issue_count ?? 0,
      rfi_count: data.rfi_count ?? 0,
      citation_count: data.citation_count ?? 0,
    };
  }
  if (sourceId === "personal_dev_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      actual_isolation: data.actual_isolation ?? null,
      approval_id: data.approval_id ?? null,
    };
  }
  if (sourceId === "creative_document_slice") {
    return {
      status: data.status ?? "unknown",
      blocked_reason: data.blocked_reason ?? null,
      workflow_run_id: data.workflow_run_id ?? null,
      approval_id: data.approval_id ?? null,
      slide_count: data.slide_count ?? 0,
      artifact_count: data.artifact_count ?? 0,
      format_validation_status: data.format_validation_status ?? "unknown",
    };
  }
  return {};
}

function buildStageStatuses(artifacts, sources) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  return [
    buildResourceExpansionStage(artifacts.resource_expansion, sourceById.get("resource_expansion")),
    buildResourceIngestStage(artifacts.resource_ingest, sourceById.get("resource_ingest")),
    buildEvidenceViewerStage(artifacts.evidence_viewer, sourceById.get("evidence_viewer")),
    buildApprovalQueueStage(artifacts.approval_queue, sourceById.get("approval_queue"), artifacts.approval_decisions),
    buildApprovalDecisionStage(artifacts.approval_decisions, sourceById.get("approval_decisions")),
    buildApprovalInboxStage(artifacts.approval_inbox, sourceById.get("approval_inbox")),
    buildApprovalInboxDecisionStage(artifacts.approval_inbox_decisions, sourceById.get("approval_inbox_decisions")),
    buildDomainPackRegistryStage(artifacts.domain_pack_registry, sourceById.get("domain_pack_registry")),
    buildOutputArtifactCatalogStage(artifacts.output_artifact_catalog, sourceById.get("output_artifact_catalog")),
    buildObservabilityCatalogStage(artifacts.observability_catalog, sourceById.get("observability_catalog")),
    buildProtectedDeliveryQueueStage(artifacts.protected_delivery_queue, sourceById.get("protected_delivery_queue")),
    buildMatterCockpitStage(artifacts.matter_cockpit, sourceById.get("matter_cockpit")),
    buildDeliveryExecutionDraftStage(artifacts.delivery_execution_draft, sourceById.get("delivery_execution_draft")),
    buildDeliveryReceiptLedgerStage(artifacts.delivery_receipt_ledger, sourceById.get("delivery_receipt_ledger")),
    buildPostDeliveryReconciliationStage(artifacts.post_delivery_reconciliation, sourceById.get("post_delivery_reconciliation")),
    buildDeliveryCloseoutQueueStage(artifacts.delivery_closeout_queue, sourceById.get("delivery_closeout_queue")),
    buildCloseoutReceiptValidationStage(artifacts.closeout_receipt_validation, sourceById.get("closeout_receipt_validation")),
    buildLawFirmLddStage(artifacts.law_firm_ldd_slice, sourceById.get("law_firm_ldd_slice")),
    buildPersonalDevStage(artifacts.personal_dev_slice, sourceById.get("personal_dev_slice")),
    buildCreativeDocumentStage(artifacts.creative_document_slice, sourceById.get("creative_document_slice")),
  ];
}

function buildResourceExpansionStage(expansion, source) {
  if (!expansion) return missingStage("resource_expansion", "Resource Expansion", source);
  const remaining = expansion.summary?.remaining_count ?? expansion.batch?.remaining_count ?? 0;
  const quarantine = expansion.summary?.quarantine_count ?? 0;
  const failed = expansion.summary?.failed_count ?? 0;
  const status = failed > 0 || quarantine > 0 ? "attention" : remaining > 0 ? "pending" : "passed";
  return {
    stage_id: "resource_expansion",
    label: "Resource Expansion",
    status,
    message: status === "passed"
      ? "All discovered resources reached terminal states."
      : `${remaining} remaining, ${quarantine} quarantined, ${failed} failed.`,
    source_path: source?.path ?? null,
    metrics: {
      discovered_count: expansion.summary?.discovered_count ?? 0,
      extracted_count: expansion.summary?.extracted_count ?? 0,
      remaining_count: remaining,
      quarantine_count: quarantine,
      failed_count: failed,
    },
  };
}

function buildResourceIngestStage(ingest, source) {
  if (!ingest) return missingStage("resource_ingest", "Resource Ingest", source);
  const blocked = ingest.summary?.blocked_count ?? 0;
  const status = ingest.summary?.gate_status === "blocked" || blocked > 0 ? "blocked" : "passed";
  return {
    stage_id: "resource_ingest",
    label: "Resource Ingest",
    status,
    message: status === "passed"
      ? "Extracted resources were promoted into Resource/Evidence contracts."
      : `${blocked} blocked item(s) require review before full promotion.`,
    source_path: source?.path ?? null,
    metrics: {
      promoted_resource_count: ingest.summary?.promoted_resource_count ?? 0,
      promoted_evidence_count: ingest.summary?.promoted_evidence_count ?? 0,
      blocked_count: blocked,
      duplicate_count: ingest.summary?.duplicate_count ?? 0,
    },
  };
}

function buildEvidenceViewerStage(viewer, source) {
  if (!viewer) return missingStage("evidence_viewer", "Evidence Viewer", source);
  const summary = viewer.summary ?? viewer.review_packet?.summary ?? {};
  const status = summary.blocking_gate_count > 0 ? "blocked" : summary.needs_review_count > 0 ? "pending" : "passed";
  return {
    stage_id: "evidence_viewer",
    label: "Evidence Viewer",
    status,
    message: `${summary.evidence_count ?? 0} evidence card(s), ${summary.needs_review_count ?? 0} waiting for review.`,
    source_path: source?.path ?? null,
    metrics: {
      evidence_count: summary.evidence_count ?? 0,
      needs_review_count: summary.needs_review_count ?? 0,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
      blocked_item_count: summary.blocked_item_count ?? 0,
    },
  };
}

function buildApprovalQueueStage(queue, source, decisions) {
  if (!queue) return missingStage("approval_queue", "Approval Queue", source);
  const appliedIds = new Set((decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const remainingItems = (queue.items ?? []).filter((item) => !appliedIds.has(item.queue_item_id));
  const pending = remainingItems.filter((item) => item.status === "pending").length;
  const critical = remainingItems.filter((item) => item.priority === "critical").length;
  const criticalOrHigh = remainingItems.filter((item) => ["critical", "high"].includes(item.priority)).length;
  const status = critical > 0 ? "blocked" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_queue",
    label: "Approval Queue",
    status,
    message: `${pending} pending approval item(s), ${critical} critical.`,
    source_path: source?.path ?? null,
    metrics: {
      total_items: queue.summary?.total_items ?? 0,
      remaining_items: remainingItems.length,
      pending_count: pending,
      critical_count: critical,
      critical_or_high_count: criticalOrHigh,
    },
  };
}

function buildApprovalDecisionStage(decisions, source) {
  if (!decisions) return missingStage("approval_decisions", "Approval Decisions", source);
  const errors = decisions.decision_errors?.length ?? 0;
  const pending = decisions.summary?.pending_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_decisions",
    label: "Approval Decisions",
    status,
    message: `${decisions.summary?.applied_count ?? 0} decision(s) applied, ${pending} pending.`,
    source_path: source?.path ?? null,
    metrics: {
      applied_count: decisions.summary?.applied_count ?? 0,
      pending_count: pending,
      approved_count: decisions.summary?.approved_count ?? 0,
      rejected_count: decisions.summary?.rejected_count ?? 0,
      audit_event_count: decisions.audit_events?.length ?? 0,
      decision_error_count: errors,
    },
  };
}

function buildApprovalInboxStage(inbox, source) {
  if (!inbox) return missingStage("approval_inbox", "Approval Inbox", source);
  const summary = inbox.summary ?? {};
  const pending = summary.pending_item_count ?? 0;
  const highPriority = summary.high_priority_count ?? 0;
  const status = highPriority > 0 ? "pending" : pending > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_inbox",
    label: "Approval Inbox",
    status,
    message: `${summary.inbox_item_count ?? 0} inbox item(s), ${summary.approval_request_count ?? 0} approval request(s), ${summary.gate_review_count ?? 0} gate review(s).`,
    source_path: source?.path ?? null,
    metrics: {
      inbox_item_count: summary.inbox_item_count ?? 0,
      pending_item_count: pending,
      approval_request_count: summary.approval_request_count ?? 0,
      gate_review_count: summary.gate_review_count ?? 0,
      high_priority_count: highPriority,
    },
  };
}

function buildApprovalInboxDecisionStage(result, source) {
  if (!result) return missingStage("approval_inbox_decisions", "Approval Inbox Decisions", source);
  const summary = result.summary ?? {};
  const errors = summary.decision_error_count ?? 0;
  const pending = summary.pending_count ?? 0;
  const ready = summary.ready_for_delivery_count ?? 0;
  const blocked = summary.patched_delivery_blocked_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : blocked > 0 ? "pending" : "passed";
  return {
    stage_id: "approval_inbox_decisions",
    label: "Approval Inbox Decisions",
    status,
    message: `${summary.applied_count ?? 0} applied, ${pending} pending, ${ready} ready for delivery after patch.`,
    source_path: source?.path ?? null,
    metrics: {
      inbox_item_count: summary.inbox_item_count ?? 0,
      applied_count: summary.applied_count ?? 0,
      pending_count: pending,
      ready_for_delivery_count: ready,
      patched_delivery_blocked_count: blocked,
      decision_error_count: errors,
    },
  };
}

function buildDomainPackRegistryStage(registry, source) {
  if (!registry) return missingStage("domain_pack_registry", "Domain Pack Registry", source);
  const summary = registry.summary ?? {};
  const errorCount = summary.error_count ?? registry.validation?.errors?.length ?? 0;
  const invalidPackCount = summary.invalid_pack_count ?? 0;
  const invalidCapabilityCount = summary.invalid_capability_count ?? 0;
  const status = errorCount > 0 || invalidPackCount > 0 || invalidCapabilityCount > 0 ? "blocked" : "passed";
  return {
    stage_id: "domain_pack_registry",
    label: "Domain Pack Registry",
    status,
    message: status === "passed"
      ? `${summary.pack_count ?? 0} pack(s), ${summary.capability_count ?? 0} capability contract(s) registered.`
      : `${invalidPackCount} invalid pack(s), ${invalidCapabilityCount} invalid capability contract(s), ${errorCount} error(s).`,
    source_path: source?.path ?? null,
    metrics: {
      valid: registry.validation?.valid ?? false,
      pack_count: summary.pack_count ?? 0,
      enabled_pack_count: summary.enabled_pack_count ?? 0,
      capability_count: summary.capability_count ?? 0,
      invalid_pack_count: invalidPackCount,
      invalid_capability_count: invalidCapabilityCount,
      error_count: errorCount,
    },
  };
}

function buildOutputArtifactCatalogStage(catalog, source) {
  if (!catalog) return missingStage("output_artifact_catalog", "Output Artifact Catalog", source);
  const summary = catalog.summary ?? {};
  const pending = summary.approval_pending_count ?? 0;
  const blockedDelivery = summary.blocked_delivery_count ?? 0;
  const status = blockedDelivery > 0 || pending > 0 ? "pending" : "passed";
  return {
    stage_id: "output_artifact_catalog",
    label: "Output Artifact Catalog",
    status,
    message: `${summary.artifact_count ?? 0} output artifact(s), ${pending} pending approval, ${blockedDelivery} blocked for delivery.`,
    source_path: source?.path ?? null,
    metrics: {
      artifact_count: summary.artifact_count ?? 0,
      approval_pending_count: pending,
      blocked_delivery_count: blockedDelivery,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
    },
  };
}

function buildObservabilityCatalogStage(catalog, source) {
  if (!catalog) return missingStage("observability_catalog", "Observability Catalog", source);
  const summary = catalog.summary ?? {};
  const errors = summary.error_record_count ?? 0;
  const missingSources = summary.missing_source_count ?? 0;
  const blockedRuns = summary.blocked_run_count ?? 0;
  const pendingApprovals = summary.pending_approval_count ?? 0;
  const status = errors > 0 || missingSources > 0
    ? "attention"
    : blockedRuns > 0 || pendingApprovals > 0
      ? "pending"
      : "passed";
  return {
    stage_id: "observability_catalog",
    label: "Observability Catalog",
    status,
    message: `${summary.workflow_run_count ?? 0} run(s), ${summary.event_count ?? 0} event(s), ${summary.total_runtime_seconds ?? 0}s runtime.`,
    source_path: source?.path ?? null,
    metrics: {
      workflow_run_count: summary.workflow_run_count ?? 0,
      event_count: summary.event_count ?? 0,
      agent_run_count: summary.agent_run_count ?? 0,
      pending_approval_count: pendingApprovals,
      blocking_gate_count: summary.blocking_gate_count ?? 0,
      total_runtime_seconds: summary.total_runtime_seconds ?? 0,
      error_record_count: errors,
      blocked_run_count: blockedRuns,
    },
  };
}

function buildProtectedDeliveryQueueStage(queue, source) {
  if (!queue) return missingStage("protected_delivery_queue", "Protected Delivery Queue", source);
  const summary = queue.summary ?? {};
  const blocked = summary.blocked_action_count ?? 0;
  const ready = summary.ready_action_count ?? 0;
  const status = blocked > 0 ? "pending" : ready > 0 ? "ready" : "passed";
  return {
    stage_id: "protected_delivery_queue",
    label: "Protected Delivery Queue",
    status,
    message: `${summary.delivery_action_count ?? 0} protected delivery action(s), ${blocked} blocked, ${ready} ready.`,
    source_path: source?.path ?? null,
    metrics: {
      delivery_action_count: summary.delivery_action_count ?? 0,
      protected_action_count: summary.protected_action_count ?? 0,
      blocked_action_count: blocked,
      pending_approval_count: summary.pending_approval_count ?? 0,
      blocked_by_gate_count: summary.blocked_by_gate_count ?? 0,
      ready_action_count: ready,
    },
  };
}

function buildMatterCockpitStage(cockpit, source) {
  if (!cockpit) return missingStage("matter_cockpit", "Matter Cockpit", source);
  const summary = cockpit.summary ?? {};
  const blocked = summary.blocked_matter_count ?? 0;
  const pending = summary.pending_review_matter_count ?? 0;
  const ready = summary.ready_matter_count ?? 0;
  const status = blocked > 0 ? "blocked" : pending > 0 ? "pending" : ready > 0 ? "ready" : "passed";
  return {
    stage_id: "matter_cockpit",
    label: "Matter Cockpit",
    status,
    message: `${summary.matter_count ?? 0} matter/project record(s), ${blocked} blocked, ${pending} pending review.`,
    source_path: source?.path ?? null,
    metrics: {
      matter_count: summary.matter_count ?? 0,
      blocked_matter_count: blocked,
      pending_review_matter_count: pending,
      ready_matter_count: ready,
      resource_count: summary.resource_count ?? 0,
      evidence_count: summary.evidence_count ?? 0,
      output_artifact_count: summary.output_artifact_count ?? 0,
      delivery_action_count: summary.delivery_action_count ?? 0,
      pending_approval_count: summary.pending_approval_count ?? 0,
    },
  };
}

function buildDeliveryExecutionDraftStage(draft, source) {
  if (!draft) return missingStage("delivery_execution_draft", "Delivery Execution Draft", source);
  const summary = draft.summary ?? {};
  const ready = summary.ready_candidate_count ?? 0;
  const packets = summary.execution_packet_count ?? 0;
  const status = ready > 0 ? "ready" : "passed";
  return {
    stage_id: "delivery_execution_draft",
    label: "Delivery Execution Draft",
    status,
    message: `${ready} ready candidate(s) grouped into ${packets} draft packet(s); execution remains manual.`,
    source_path: source?.path ?? null,
    metrics: {
      execution_mode: draft.execution_mode ?? "unknown",
      ready_candidate_count: ready,
      blocked_candidate_count: summary.blocked_candidate_count ?? 0,
      execution_packet_count: packets,
      manual_execution_required_count: summary.manual_execution_required_count ?? 0,
      final_check_required_count: summary.final_check_required_count ?? 0,
    },
  };
}

function buildDeliveryReceiptLedgerStage(ledger, source) {
  if (!ledger) return missingStage("delivery_receipt_ledger", "Delivery Receipt Ledger", source);
  const summary = ledger.summary ?? {};
  const errors = summary.receipt_error_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const delivered = summary.delivered_artifact_count ?? 0;
  const status = errors > 0 ? "attention" : pending > 0 ? "pending" : delivered > 0 ? "passed" : "pending";
  return {
    stage_id: "delivery_receipt_ledger",
    label: "Delivery Receipt Ledger",
    status,
    message: `${summary.applied_receipt_count ?? 0} receipt(s) applied, ${pending} pending, ${delivered} delivered artifact(s) recorded.`,
    source_path: source?.path ?? null,
    metrics: {
      execution_draft_packet_count: summary.execution_draft_packet_count ?? 0,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      pending_receipt_count: pending,
      delivered_packet_count: summary.delivered_packet_count ?? 0,
      delivered_artifact_count: delivered,
      audit_event_count: summary.audit_event_count ?? 0,
      receipt_error_count: errors,
    },
  };
}

function buildPostDeliveryReconciliationStage(reconciliation, source) {
  if (!reconciliation) return missingStage("post_delivery_reconciliation", "Post-Delivery Reconciliation", source);
  const summary = reconciliation.summary ?? {};
  const errors = summary.receipt_error_count ?? 0;
  const blocked = summary.blocked_matter_count ?? 0;
  const outstanding = summary.outstanding_receipt_count ?? 0;
  const deliveredArtifacts = summary.delivered_artifact_count ?? 0;
  const deliveredMatters = summary.delivered_matter_count ?? 0;
  const status = errors > 0 || blocked > 0
    ? "attention"
    : outstanding > 0
      ? "pending"
      : deliveredArtifacts > 0
        ? "passed"
        : "pending";
  return {
    stage_id: "post_delivery_reconciliation",
    label: "Post-Delivery Reconciliation",
    status,
    message: `${deliveredMatters} delivered matter(s), ${deliveredArtifacts} delivered artifact(s), ${outstanding} outstanding receipt(s).`,
    source_path: source?.path ?? null,
    metrics: {
      reconciled_matter_count: summary.reconciled_matter_count ?? 0,
      delivered_matter_count: deliveredMatters,
      ready_matter_count: summary.ready_matter_count ?? 0,
      awaiting_receipt_matter_count: summary.awaiting_receipt_matter_count ?? 0,
      blocked_matter_count: blocked,
      delivered_artifact_count: deliveredArtifacts,
      outstanding_receipt_count: outstanding,
      applied_receipt_count: summary.applied_receipt_count ?? 0,
      receipt_error_count: errors,
    },
  };
}

function buildDeliveryCloseoutQueueStage(queue, source) {
  if (!queue) return missingStage("delivery_closeout_queue", "Delivery Closeout Queue", source);
  const summary = queue.summary ?? {};
  const blocked = summary.blocked_closeout_count ?? 0;
  const awaiting = summary.awaiting_execution_count ?? 0;
  const items = summary.closeout_item_count ?? 0;
  const status = blocked > 0 ? "attention" : awaiting > 0 ? "pending" : "passed";
  return {
    stage_id: "delivery_closeout_queue",
    label: "Delivery Closeout Queue",
    status,
    message: `${items} closeout item(s), ${awaiting} awaiting manual execution, ${blocked} blocked.`,
    source_path: source?.path ?? null,
    metrics: {
      closeout_item_count: items,
      awaiting_execution_count: awaiting,
      blocked_closeout_count: blocked,
      receipt_form_count: summary.receipt_form_count ?? 0,
      high_priority_count: summary.high_priority_count ?? 0,
      artifact_count: summary.artifact_count ?? 0,
    },
  };
}

function buildCloseoutReceiptValidationStage(validation, source) {
  if (!validation) return missingStage("closeout_receipt_validation", "Closeout Receipt Validation", source);
  const summary = validation.summary ?? {};
  const errors = summary.error_count ?? 0;
  const invalid = summary.invalid_receipt_count ?? 0;
  const missing = summary.missing_receipt_count ?? 0;
  const pending = summary.pending_receipt_count ?? 0;
  const ready = summary.ready_to_apply_count ?? 0;
  const status = errors > 0 || invalid > 0
    ? "attention"
    : pending > 0 || missing > 0
      ? "pending"
      : ready > 0
        ? "ready"
        : "passed";
  return {
    stage_id: "closeout_receipt_validation",
    label: "Closeout Receipt Validation",
    status,
    message: `${ready} ready receipt(s), ${pending} pending, ${invalid} invalid, ${missing} missing.`,
    source_path: source?.path ?? null,
    metrics: {
      closeout_item_count: summary.closeout_item_count ?? 0,
      receipt_count: summary.receipt_count ?? 0,
      ready_to_apply_count: ready,
      pending_receipt_count: pending,
      missing_receipt_count: missing,
      invalid_receipt_count: invalid,
      unknown_packet_count: summary.unknown_packet_count ?? 0,
      error_count: errors,
      fully_ready_to_apply: summary.fully_ready_to_apply ?? false,
    },
  };
}

function buildLawFirmLddStage(summary, source) {
  if (!summary) return missingStage("law_firm_ldd_slice", "Law Firm LDD Slice", source);
  const status = summary.status === "blocked" ? "blocked" : summary.status === "completed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.issue_count ?? 0} issue candidate(s), ${summary.citation_count ?? 0} citation(s), blocked: ${summary.blocked_reason}`
      : `${summary.issue_count ?? 0} issue candidate(s), ${summary.citation_count ?? 0} citation(s).`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      issue_count: summary.issue_count ?? 0,
      rfi_count: summary.rfi_count ?? 0,
      citation_count: summary.citation_count ?? 0,
      approval_id: summary.approval_id ?? null,
    },
  };
}

function buildPersonalDevStage(summary, source) {
  if (!summary) return missingStage("personal_dev_slice", "Personal Dev Slice", source);
  const status = summary.status === "blocked" ? "pending" : summary.status === "passed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.status}: ${summary.blocked_reason}`
      : `${summary.status ?? "unknown"} with ${summary.actual_isolation ?? "unknown"} isolation.`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      actual_isolation: summary.actual_isolation ?? null,
    },
  };
}

function buildCreativeDocumentStage(summary, source) {
  if (!summary) return missingStage("creative_document_slice", "Creative Document Slice", source);
  const status = summary.status === "blocked" ? "pending" : summary.status === "passed" ? "passed" : summary.status ?? "attention";
  return {
    stage_id: "creative_document_slice",
    label: "Creative Document Slice",
    status,
    message: summary.blocked_reason
      ? `${summary.slide_count ?? 0} slide(s), format ${summary.format_validation_status ?? "unknown"}, blocked: ${summary.blocked_reason}`
      : `${summary.slide_count ?? 0} slide(s), format ${summary.format_validation_status ?? "unknown"}.`,
    source_path: source?.path ?? null,
    metrics: {
      status: summary.status ?? "unknown",
      blocked_reason: summary.blocked_reason ?? null,
      slide_count: summary.slide_count ?? 0,
      artifact_count: summary.artifact_count ?? 0,
      format_validation_status: summary.format_validation_status ?? "unknown",
      approval_id: summary.approval_id ?? null,
    },
  };
}

function missingStage(stageId, label, source) {
  return {
    stage_id: stageId,
    label,
    status: "missing",
    message: source?.error === "disabled" ? "Stage disabled for this dashboard run." : "Source artifact is not available.",
    source_path: source?.path ?? null,
    metrics: {},
  };
}

function buildActionItems(artifacts) {
  const items = [];
  const queueItems = artifacts.approval_queue?.items ?? [];
  const appliedIds = new Set((artifacts.approval_decisions?.applied_items ?? []).map((item) => item.queue_item_id));
  const unappliedIds = new Set((artifacts.approval_decisions?.unapplied_items ?? []).map((item) => item.queue_item_id));
  const appliedApprovalInboxIds = new Set((artifacts.approval_inbox_decisions?.applied_items ?? []).map((item) => item.approval_item_id));

  for (const item of queueItems) {
    if (appliedIds.has(item.queue_item_id)) continue;
    items.push({
      action_item_id: `dashboard.action.${item.queue_item_id}`,
      source_stage: "approval_queue",
      priority: item.priority,
      status: unappliedIds.has(item.queue_item_id) ? "pending_decision" : item.status,
      title: item.title,
      subject_ref: item.subject_ref,
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.queue_item_id,
    });
  }

  for (const error of artifacts.approval_decisions?.decision_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.decision_error.${error.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: "high",
      status: "needs_fix",
      title: `Fix approval decision: ${error.queue_item_id}`,
      subject_ref: {
        subject_type: "approval_decision",
        subject_id: error.queue_item_id,
      },
      reason: error.message,
      recommended_actions: ["fix_decision_file", "rerun_approval_apply"],
      source_ref: error.queue_item_id,
    });
  }

  for (const item of artifacts.approval_decisions?.applied_items ?? []) {
    if (!item.follow_up_action) continue;
    items.push({
      action_item_id: `dashboard.action.follow_up.${item.queue_item_id}`,
      source_stage: "approval_decisions",
      priority: item.priority ?? "medium",
      status: "follow_up_required",
      title: `Follow up: ${item.follow_up_action}`,
      subject_ref: item.subject_ref,
      reason: item.comment || item.follow_up_action,
      recommended_actions: [item.follow_up_action],
      source_ref: item.queue_item_id,
    });
  }

  for (const error of artifacts.domain_pack_registry?.validation?.errors ?? []) {
    const subjectId = error.path ?? "domain_pack_registry";
    items.push({
      action_item_id: `dashboard.action.domain_pack_registry.${slugify(subjectId)}`,
      source_stage: "domain_pack_registry",
      priority: "high",
      status: "needs_fix",
      title: "Fix domain pack registry validation",
      subject_ref: {
        subject_type: "domain_pack_registry_error",
        subject_id: subjectId,
      },
      reason: error.message,
      recommended_actions: ["fix_pack_manifest", "rerun_packs_validate", "rebuild_dashboard"],
      source_ref: subjectId,
    });
  }

  if (artifacts.personal_dev_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.personal_dev.${artifacts.personal_dev_slice.approval_id ?? "merge"}`,
      source_stage: "personal_dev_slice",
      priority: "high",
      status: "pending_approval",
      title: "Review personal-dev merge approval",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.personal_dev_slice.approval_id ?? "personal_dev.merge",
      },
      reason: artifacts.personal_dev_slice.blocked_reason ?? "merge approval pending",
      recommended_actions: ["review_pr_draft", "run_canonical_tests", "approve_or_request_changes"],
      source_ref: artifacts.personal_dev_slice.workflow_run_id ?? null,
    });
  }

  if (artifacts.law_firm_ldd_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.law_firm_ldd.${artifacts.law_firm_ldd_slice.approval_id ?? "attorney_review"}`,
      source_stage: "law_firm_ldd_slice",
      priority: "high",
      status: "pending_approval",
      title: "Review law-firm LDD issue report",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.law_firm_ldd_slice.approval_id ?? "law_firm_ldd.attorney_review",
      },
      reason: artifacts.law_firm_ldd_slice.blocked_reason ?? "attorney approval pending",
      recommended_actions: ["review_citations", "review_issue_candidates", "approve_or_request_changes"],
      source_ref: artifacts.law_firm_ldd_slice.workflow_run_id ?? null,
    });
  }

  if (artifacts.creative_document_slice?.status === "blocked") {
    items.push({
      action_item_id: `dashboard.action.creative_document.${artifacts.creative_document_slice.approval_id ?? "human_review"}`,
      source_stage: "creative_document_slice",
      priority: "medium",
      status: "pending_approval",
      title: "Review creative-document draft deck",
      subject_ref: {
        subject_type: "approval",
        subject_id: artifacts.creative_document_slice.approval_id ?? "creative_document.human_review",
      },
      reason: artifacts.creative_document_slice.blocked_reason ?? "human approval pending",
      recommended_actions: ["review_deck_outline", "inspect_pptx_draft", "approve_or_request_changes"],
      source_ref: artifacts.creative_document_slice.workflow_run_id ?? null,
    });
  }

  for (const action of artifacts.protected_delivery_queue?.delivery_actions ?? []) {
    if (["delivered", "ready_for_delivery"].includes(action.delivery_status)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery.${slugify(action.delivery_action_id)}`,
      source_stage: "protected_delivery_queue",
      priority: action.priority,
      status: action.delivery_status,
      title: `Resolve delivery blocker for ${action.artifact_type}`,
      subject_ref: {
        subject_type: "delivery_action",
        subject_id: action.delivery_action_id,
      },
      reason: action.blocked_reasons.length > 0 ? action.blocked_reasons.join(", ") : action.delivery_status,
      recommended_actions: action.recommended_actions ?? [],
      source_ref: action.artifact_id,
    });
  }

  for (const matter of artifacts.matter_cockpit?.matters ?? []) {
    if (matter.status !== "blocked") continue;
    items.push({
      action_item_id: `dashboard.action.matter.${slugify(matter.matter_key)}`,
      source_stage: "matter_cockpit",
      priority: matter.high_priority_action_count > 0 ? "high" : "medium",
      status: "blocked",
      title: `Resolve blocked matter/project: ${matter.matter_id}`,
      subject_ref: {
        subject_type: "matter",
        subject_id: matter.matter_key,
      },
      reason: `${matter.blocked_delivery_count} blocked delivery action(s), ${matter.blocking_gate_count} blocking gate(s).`,
      recommended_actions: ["open_matter_cockpit", "resolve_gate_or_approval_blockers", "rerun_matter_cockpit"],
      source_ref: matter.matter_key,
    });
  }

  for (const item of artifacts.approval_inbox?.items ?? []) {
    if (appliedApprovalInboxIds.has(item.approval_item_id)) continue;
    items.push({
      action_item_id: `dashboard.action.approval_inbox.${slugify(item.approval_item_id)}`,
      source_stage: "approval_inbox",
      priority: item.priority,
      status: item.status,
      title: item.title,
      subject_ref: {
        subject_type: item.item_type,
        subject_id: item.approval_item_id,
      },
      reason: item.reason,
      recommended_actions: item.recommended_actions ?? [],
      source_ref: item.approval_id ?? item.delivery_action_id,
    });
  }

  for (const error of artifacts.approval_inbox_decisions?.decision_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.approval_inbox_decision_error.${slugify(error.approval_item_id)}`,
      source_stage: "approval_inbox_decisions",
      priority: "high",
      status: "needs_fix",
      title: "Fix approval inbox decision",
      subject_ref: {
        subject_type: "approval_inbox_decision",
        subject_id: error.approval_item_id ?? "unknown",
      },
      reason: error.message,
      recommended_actions: ["fix_decision_file", "rerun_approval_inbox_apply", "rebuild_dashboard"],
      source_ref: error.approval_item_id ?? null,
    });
  }

  for (const item of artifacts.approval_inbox_decisions?.applied_items ?? []) {
    if (!item.follow_up_action) continue;
    items.push({
      action_item_id: `dashboard.action.approval_inbox_follow_up.${slugify(item.approval_item_id)}`,
      source_stage: "approval_inbox_decisions",
      priority: item.priority ?? "medium",
      status: "follow_up_required",
      title: `Follow up approval inbox decision: ${item.follow_up_action}`,
      subject_ref: item.subject_ref,
      reason: item.comment || item.follow_up_action,
      recommended_actions: [item.follow_up_action],
      source_ref: item.approval_item_id,
    });
  }

  const receiptLedgerPacketIds = new Set([
    ...(artifacts.delivery_receipt_ledger?.applied_receipts ?? []).map((receipt) => receipt.packet_id),
    ...(artifacts.delivery_receipt_ledger?.pending_receipts ?? []).map((receipt) => receipt.packet_id),
  ]);
  for (const packet of artifacts.delivery_execution_draft?.execution_packets ?? []) {
    if (receiptLedgerPacketIds.has(packet.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_execution.${slugify(packet.packet_id)}`,
      source_stage: "delivery_execution_draft",
      priority: packet.priority,
      status: packet.execution_status,
      title: `Manually execute delivery packet: ${packet.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_execution_packet",
        subject_id: packet.packet_id,
      },
      reason: `${packet.candidate_count} ready artifact(s) require final manual execution via ${packet.delivery_channel}.`,
      recommended_actions: packet.checklist ?? [],
      source_ref: packet.packet_id,
    });
  }

  const closeoutPacketIds = new Set((artifacts.delivery_closeout_queue?.closeout_items ?? []).map((item) => item.packet_id));
  for (const pending of artifacts.delivery_receipt_ledger?.pending_receipts ?? []) {
    if (closeoutPacketIds.has(pending.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_receipt.${slugify(pending.packet_id)}`,
      source_stage: "delivery_receipt_ledger",
      priority: "high",
      status: "receipt_pending",
      title: `Record delivery receipt: ${pending.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_receipt",
        subject_id: pending.packet_id,
      },
      reason: `${pending.reason}; ${pending.artifact_ids?.length ?? 0} artifact(s) still need receipt recording.`,
      recommended_actions: ["execute_manually_if_not_done", "fill_receipt_template", "rerun_delivery_receipts"],
      source_ref: pending.packet_id,
    });
  }

  for (const error of artifacts.delivery_receipt_ledger?.receipt_errors ?? []) {
    items.push({
      action_item_id: `dashboard.action.delivery_receipt_error.${slugify(error.packet_id)}`,
      source_stage: "delivery_receipt_ledger",
      priority: "high",
      status: "needs_fix",
      title: "Fix delivery receipt",
      subject_ref: {
        subject_type: "delivery_receipt_error",
        subject_id: error.packet_id ?? "unknown",
      },
      reason: error.message,
      recommended_actions: ["fix_receipt_file", "rerun_delivery_receipts", "rebuild_dashboard"],
      source_ref: error.packet_id ?? null,
    });
  }

  const validationItems = artifacts.closeout_receipt_validation?.validation_items ?? [];
  const validationPacketIdsWithAction = new Set(
    validationItems
      .filter((item) => ["ready_to_apply", "invalid_receipt", "missing_receipt"].includes(item.validation_status))
      .map((item) => item.packet_id),
  );
  for (const item of artifacts.delivery_closeout_queue?.closeout_items ?? []) {
    if (validationPacketIdsWithAction.has(item.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.delivery_closeout.${slugify(item.closeout_item_id)}`,
      source_stage: "delivery_closeout_queue",
      priority: item.priority,
      status: item.status,
      title: `Execute delivery closeout: ${item.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_closeout_item",
        subject_id: item.closeout_item_id,
      },
      reason: `${item.reason}; ${item.artifact_count} artifact(s) need manual closeout and receipt recording.`,
      recommended_actions: item.closeout_checklist ?? [],
      source_ref: item.packet_id,
    });
  }

  const validationPacketIds = new Set(validationItems.map((item) => item.packet_id));
  for (const item of validationItems) {
    if (item.validation_status === "ready_to_apply") {
      items.push({
        action_item_id: `dashboard.action.closeout_receipt_ready.${slugify(item.validation_item_id)}`,
        source_stage: "closeout_receipt_validation",
        priority: item.priority ?? "high",
        status: "ready_to_apply",
        title: `Apply validated delivery receipt: ${item.delivery_target}`,
        subject_ref: {
          subject_type: "closeout_receipt_validation",
          subject_id: item.validation_item_id,
        },
        reason: `${item.packet_id} is validated and ready for delivery:receipts.`,
        recommended_actions: ["run_delivery_receipts_with_validated_input", "rerun_delivery_reconcile", "rebuild_dashboard"],
        source_ref: item.packet_id,
      });
      continue;
    }
    if (!["invalid_receipt", "missing_receipt"].includes(item.validation_status)) continue;
    items.push({
      action_item_id: `dashboard.action.closeout_receipt_validation.${slugify(item.validation_item_id)}`,
      source_stage: "closeout_receipt_validation",
      priority: item.priority ?? "high",
      status: item.validation_status,
      title: `Fix closeout receipt: ${item.delivery_target}`,
      subject_ref: {
        subject_type: "closeout_receipt_validation",
        subject_id: item.validation_item_id,
      },
      reason: item.errors?.map((candidate) => candidate.message).join("; ") || item.validation_status,
      recommended_actions: ["fix_receipt_input", "rerun_delivery_closeout_validate"],
      source_ref: item.packet_id,
    });
  }

  const ledgerPendingPacketIds = new Set((artifacts.delivery_receipt_ledger?.pending_receipts ?? []).map((pending) => pending.packet_id));
  for (const pending of artifacts.post_delivery_reconciliation?.outstanding_receipts ?? []) {
    if (ledgerPendingPacketIds.has(pending.packet_id)) continue;
    if (closeoutPacketIds.has(pending.packet_id)) continue;
    if (validationPacketIds.has(pending.packet_id)) continue;
    items.push({
      action_item_id: `dashboard.action.post_delivery_receipt.${slugify(pending.packet_id)}`,
      source_stage: "post_delivery_reconciliation",
      priority: "high",
      status: "receipt_outstanding",
      title: `Close post-delivery receipt: ${pending.delivery_target}`,
      subject_ref: {
        subject_type: "delivery_receipt",
        subject_id: pending.packet_id ?? "unknown",
      },
      reason: `${pending.reason ?? "receipt_outstanding"}; reconciliation still sees ${pending.artifact_ids?.length ?? 0} artifact(s) without receipt.`,
      recommended_actions: ["fill_receipt_template", "rerun_delivery_receipts", "rerun_delivery_reconcile"],
      source_ref: pending.packet_id ?? null,
    });
  }

  return items;
}

function buildDashboardSummary(artifacts, stageStatuses, actionItems) {
  const patchedEvidence = artifacts.approval_decisions?.patched_resource_evidence;
  const reviewCounts = countReviewStatuses(patchedEvidence?.evidence_items ?? []);
  const viewerSummary = artifacts.evidence_viewer?.summary ?? artifacts.evidence_viewer?.review_packet?.summary ?? {};
  const decisionSummary = artifacts.approval_decisions?.summary ?? {};
  const queueSummary = artifacts.approval_queue?.summary ?? {};
  const blockingGateCount = viewerSummary.blocking_gate_count ?? countBlockingGates(artifacts.resource_ingest?.gate_results ?? []);
  const pendingApprovalCount = (
    decisionSummary.pending_count ?? queueSummary.by_status?.pending ?? queueSummary.total_items ?? 0
  ) + pendingSliceApprovalCount(artifacts.law_firm_ldd_slice)
    + pendingSliceApprovalCount(artifacts.personal_dev_slice)
    + pendingSliceApprovalCount(artifacts.creative_document_slice);
  const blockedResourceCount = artifacts.resource_ingest?.summary?.blocked_count ?? viewerSummary.blocked_item_count ?? 0;
  const decisionErrorCount = artifacts.approval_decisions?.decision_errors?.length ?? 0;

  return {
    overall_status: deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount),
    stage_count: stageStatuses.length,
    missing_stage_count: stageStatuses.filter((stage) => stage.status === "missing").length,
    blocked_stage_count: stageStatuses.filter((stage) => stage.status === "blocked").length,
    pending_stage_count: stageStatuses.filter((stage) => stage.status === "pending").length,
    resource_count: artifacts.resource_ingest?.summary?.promoted_resource_count ?? viewerSummary.resource_count ?? 0,
    evidence_count: artifacts.resource_ingest?.summary?.promoted_evidence_count ?? viewerSummary.evidence_count ?? 0,
    evidence_needs_review_count: patchedEvidence ? reviewCounts.needs_review ?? 0 : viewerSummary.needs_review_count ?? 0,
    evidence_approved_count: patchedEvidence ? reviewCounts.approved ?? 0 : 0,
    evidence_rejected_count: patchedEvidence ? reviewCounts.rejected ?? 0 : 0,
    blocking_gate_count: blockingGateCount,
    blocked_resource_count: blockedResourceCount,
    approval_queue_item_count: queueSummary.total_items ?? 0,
    approval_applied_count: decisionSummary.applied_count ?? 0,
    pending_approval_count: pendingApprovalCount,
    approval_inbox_item_count: artifacts.approval_inbox?.summary?.inbox_item_count ?? 0,
    approval_inbox_request_count: artifacts.approval_inbox?.summary?.approval_request_count ?? 0,
    approval_inbox_gate_review_count: artifacts.approval_inbox?.summary?.gate_review_count ?? 0,
    approval_inbox_high_priority_count: artifacts.approval_inbox?.summary?.high_priority_count ?? 0,
    approval_inbox_applied_count: artifacts.approval_inbox_decisions?.summary?.applied_count ?? 0,
    approval_inbox_decision_pending_count: artifacts.approval_inbox_decisions?.summary?.pending_count ?? 0,
    approval_inbox_ready_for_delivery_count: artifacts.approval_inbox_decisions?.summary?.ready_for_delivery_count ?? 0,
    approval_inbox_decision_error_count: artifacts.approval_inbox_decisions?.summary?.decision_error_count ?? 0,
    domain_pack_count: artifacts.domain_pack_registry?.summary?.pack_count ?? 0,
    domain_pack_capability_count: artifacts.domain_pack_registry?.summary?.capability_count ?? 0,
    invalid_domain_pack_count: artifacts.domain_pack_registry?.summary?.invalid_pack_count ?? 0,
    invalid_domain_pack_capability_count: artifacts.domain_pack_registry?.summary?.invalid_capability_count ?? 0,
    domain_pack_error_count: artifacts.domain_pack_registry?.summary?.error_count ?? artifacts.domain_pack_registry?.validation?.errors?.length ?? 0,
    output_artifact_count: artifacts.output_artifact_catalog?.summary?.artifact_count ?? 0,
    output_artifact_pending_approval_count: artifacts.output_artifact_catalog?.summary?.approval_pending_count ?? 0,
    output_artifact_blocked_delivery_count: artifacts.output_artifact_catalog?.summary?.blocked_delivery_count ?? 0,
    observability_run_count: artifacts.observability_catalog?.summary?.workflow_run_count ?? 0,
    observability_event_count: artifacts.observability_catalog?.summary?.event_count ?? 0,
    observability_runtime_seconds: artifacts.observability_catalog?.summary?.total_runtime_seconds ?? 0,
    observability_error_count: artifacts.observability_catalog?.summary?.error_record_count ?? 0,
    delivery_action_count: artifacts.protected_delivery_queue?.summary?.delivery_action_count ?? 0,
    delivery_blocked_action_count: artifacts.protected_delivery_queue?.summary?.blocked_action_count ?? 0,
    delivery_ready_action_count: artifacts.protected_delivery_queue?.summary?.ready_action_count ?? 0,
    delivery_pending_approval_count: artifacts.protected_delivery_queue?.summary?.pending_approval_count ?? 0,
    delivery_execution_ready_candidate_count: artifacts.delivery_execution_draft?.summary?.ready_candidate_count ?? 0,
    delivery_execution_packet_count: artifacts.delivery_execution_draft?.summary?.execution_packet_count ?? 0,
    delivery_execution_manual_required_count: artifacts.delivery_execution_draft?.summary?.manual_execution_required_count ?? 0,
    delivery_execution_blocked_candidate_count: artifacts.delivery_execution_draft?.summary?.blocked_candidate_count ?? 0,
    delivery_receipt_applied_count: artifacts.delivery_receipt_ledger?.summary?.applied_receipt_count ?? 0,
    delivery_receipt_pending_count: artifacts.delivery_receipt_ledger?.summary?.pending_receipt_count ?? 0,
    delivery_receipt_delivered_artifact_count: artifacts.delivery_receipt_ledger?.summary?.delivered_artifact_count ?? 0,
    delivery_receipt_error_count: artifacts.delivery_receipt_ledger?.summary?.receipt_error_count ?? 0,
    post_delivery_delivered_artifact_count: artifacts.post_delivery_reconciliation?.summary?.delivered_artifact_count ?? 0,
    post_delivery_delivered_matter_count: artifacts.post_delivery_reconciliation?.summary?.delivered_matter_count ?? 0,
    post_delivery_ready_matter_count: artifacts.post_delivery_reconciliation?.summary?.ready_matter_count ?? 0,
    post_delivery_outstanding_receipt_count: artifacts.post_delivery_reconciliation?.summary?.outstanding_receipt_count ?? 0,
    delivery_closeout_item_count: artifacts.delivery_closeout_queue?.summary?.closeout_item_count ?? 0,
    delivery_closeout_awaiting_count: artifacts.delivery_closeout_queue?.summary?.awaiting_execution_count ?? 0,
    delivery_closeout_blocked_count: artifacts.delivery_closeout_queue?.summary?.blocked_closeout_count ?? 0,
    closeout_receipt_ready_count: artifacts.closeout_receipt_validation?.summary?.ready_to_apply_count ?? 0,
    closeout_receipt_pending_count: artifacts.closeout_receipt_validation?.summary?.pending_receipt_count ?? 0,
    closeout_receipt_invalid_count: artifacts.closeout_receipt_validation?.summary?.invalid_receipt_count ?? 0,
    closeout_receipt_error_count: artifacts.closeout_receipt_validation?.summary?.error_count ?? 0,
    matter_count: artifacts.matter_cockpit?.summary?.matter_count ?? 0,
    blocked_matter_count: artifacts.matter_cockpit?.summary?.blocked_matter_count ?? 0,
    pending_review_matter_count: artifacts.matter_cockpit?.summary?.pending_review_matter_count ?? 0,
    ready_matter_count: artifacts.matter_cockpit?.summary?.ready_matter_count ?? 0,
    law_firm_issue_count: artifacts.law_firm_ldd_slice?.issue_count ?? 0,
    law_firm_rfi_count: artifacts.law_firm_ldd_slice?.rfi_count ?? 0,
    law_firm_citation_count: artifacts.law_firm_ldd_slice?.citation_count ?? 0,
    creative_slide_count: artifacts.creative_document_slice?.slide_count ?? 0,
    creative_artifact_count: artifacts.creative_document_slice?.artifact_count ?? 0,
    audit_event_count: (artifacts.approval_decisions?.audit_events?.length ?? 0)
      + (artifacts.delivery_receipt_ledger?.audit_events?.length ?? 0),
    follow_up_count: decisionSummary.follow_up_count ?? 0,
    decision_error_count: decisionErrorCount,
    action_item_count: actionItems.length,
  };
}

function pendingSliceApprovalCount(summary) {
  return summary?.status === "blocked" && /approval/i.test(summary.blocked_reason ?? "") ? 1 : 0;
}

function deriveOverallStatus(stageStatuses, pendingApprovalCount, decisionErrorCount) {
  if (stageStatuses.some((stage) => stage.status === "missing")) return "incomplete";
  if (decisionErrorCount > 0) return "attention";
  if (stageStatuses.some((stage) => stage.status === "blocked")) return "blocked";
  if (pendingApprovalCount > 0 || stageStatuses.some((stage) => stage.status === "pending")) return "pending_review";
  if (stageStatuses.some((stage) => stage.status === "attention")) return "attention";
  return "ready";
}

export function renderReviewDashboardHtml(dashboard) {
  const stages = dashboard.stage_statuses.map(renderStageHtml).join("\n");
  const actions = dashboard.action_items.map(renderActionHtml).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Review Dashboard</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#5d6673; --line:#d8dee8; --panel:#f7f9fb; --ok:#166534; --warn:#9a6700; --danger:#b42318; --accent:#0f766e; }
    * { box-sizing:border-box; }
    body { margin:0; background:#fff; color:var(--ink); font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding:28px 32px 20px; border-bottom:1px solid var(--line); }
    main { max-width:1200px; margin:0 auto; padding:22px 32px 42px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.2; }
    h2 { margin:28px 0 12px; font-size:18px; }
    h3 { margin:0 0 8px; font-size:16px; }
    .meta { color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:18px; }
    .stat, .stage, .action { border:1px solid var(--line); border-radius:8px; background:#fff; }
    .stat { padding:12px; background:var(--panel); }
    .stat strong { display:block; font-size:24px; }
    .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0; }
    .section { border-top:1px solid var(--line); margin-top:24px; padding-top:4px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
    .stage, .action { padding:14px; }
    .badge { display:inline-flex; align-items:center; min-height:24px; border-radius:999px; padding:3px 9px; font-size:12px; border:1px solid var(--line); color:var(--muted); }
    .status-passed, .status-ready { color:var(--ok); border-color:#b7dec2; background:#f0faf3; }
    .status-pending, .status-pending_review { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-blocked, .priority-critical { color:var(--danger); border-color:#efb4ad; background:#fff1f0; }
    .status-attention, .status-incomplete, .priority-high { color:var(--warn); border-color:#ead089; background:#fff8df; }
    .status-missing { color:var(--muted); border-color:var(--line); background:#f2f4f7; }
    .muted { color:var(--muted); }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
    ul { padding-left:20px; }
    @media (max-width:640px) { header, main { padding-left:18px; padding-right:18px; } h1 { font-size:24px; } }
  </style>
</head>
<body>
  <header>
    <h1>Hermes Review Dashboard</h1>
    <div class="meta">Generated ${escapeHtml(dashboard.generated_at)}</div>
    <div class="meta">Overall <span class="badge status-${escapeHtml(dashboard.summary.overall_status)}">${escapeHtml(dashboard.summary.overall_status)}</span></div>
    <div class="stats">
      ${stat("Resources", dashboard.summary.resource_count)}
      ${stat("Evidence", dashboard.summary.evidence_count)}
      ${stat("Needs Review", dashboard.summary.evidence_needs_review_count)}
      ${stat("Pending Approvals", dashboard.summary.pending_approval_count)}
      ${stat("Approval Inbox", dashboard.summary.approval_inbox_item_count)}
      ${stat("Inbox Applied", dashboard.summary.approval_inbox_applied_count)}
      ${stat("Matters", dashboard.summary.matter_count)}
      ${stat("Domain Packs", dashboard.summary.domain_pack_count)}
      ${stat("Outputs", dashboard.summary.output_artifact_count)}
      ${stat("Delivery", dashboard.summary.delivery_action_count)}
      ${stat("Execution Packets", dashboard.summary.delivery_execution_packet_count)}
      ${stat("Receipts", dashboard.summary.delivery_receipt_applied_count)}
      ${stat("Post Delivery", dashboard.summary.post_delivery_delivered_artifact_count)}
      ${stat("Closeout", dashboard.summary.delivery_closeout_item_count)}
      ${stat("Receipt Gate", dashboard.summary.closeout_receipt_ready_count)}
      ${stat("Runs", dashboard.summary.observability_run_count)}
      ${stat("Blocking Gates", dashboard.summary.blocking_gate_count)}
      ${stat("Action Items", dashboard.summary.action_item_count)}
    </div>
  </header>
  <main>
    <section class="section">
      <h2>Control Plane Stages</h2>
      <div class="grid">${stages}</div>
    </section>
    <section class="section">
      <h2>Action Queue</h2>
      ${actions || "<p class=\"muted\">No action items.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

export function renderReviewDashboardMarkdown(dashboard) {
  const lines = [];
  lines.push("# Hermes Review Dashboard");
  lines.push("");
  lines.push(`Generated: ${dashboard.generated_at}`);
  lines.push(`Overall status: ${dashboard.summary.overall_status}`);
  lines.push("");
  lines.push(`- Resources: ${dashboard.summary.resource_count}`);
  lines.push(`- Evidence: ${dashboard.summary.evidence_count}`);
  lines.push(`- Evidence needs review: ${dashboard.summary.evidence_needs_review_count}`);
  lines.push(`- Pending approvals: ${dashboard.summary.pending_approval_count}`);
  lines.push(`- Approval inbox items: ${dashboard.summary.approval_inbox_item_count ?? 0}`);
  lines.push(`- Approval inbox requests: ${dashboard.summary.approval_inbox_request_count ?? 0}`);
  lines.push(`- Approval inbox decisions applied: ${dashboard.summary.approval_inbox_applied_count ?? 0}`);
  lines.push(`- Approval inbox ready for delivery: ${dashboard.summary.approval_inbox_ready_for_delivery_count ?? 0}`);
  lines.push(`- Matters: ${dashboard.summary.matter_count ?? 0}`);
  lines.push(`- Blocked matters: ${dashboard.summary.blocked_matter_count ?? 0}`);
  lines.push(`- Domain packs: ${dashboard.summary.domain_pack_count ?? 0}`);
  lines.push(`- Domain pack capabilities: ${dashboard.summary.domain_pack_capability_count ?? 0}`);
  lines.push(`- Output artifacts: ${dashboard.summary.output_artifact_count ?? 0}`);
  lines.push(`- Output delivery blocked: ${dashboard.summary.output_artifact_blocked_delivery_count ?? 0}`);
  lines.push(`- Delivery actions: ${dashboard.summary.delivery_action_count ?? 0}`);
  lines.push(`- Delivery blocked: ${dashboard.summary.delivery_blocked_action_count ?? 0}`);
  lines.push(`- Delivery ready: ${dashboard.summary.delivery_ready_action_count ?? 0}`);
  lines.push(`- Delivery execution ready candidates: ${dashboard.summary.delivery_execution_ready_candidate_count ?? 0}`);
  lines.push(`- Delivery execution packets: ${dashboard.summary.delivery_execution_packet_count ?? 0}`);
  lines.push(`- Delivery receipts applied: ${dashboard.summary.delivery_receipt_applied_count ?? 0}`);
  lines.push(`- Delivery receipts pending: ${dashboard.summary.delivery_receipt_pending_count ?? 0}`);
  lines.push(`- Delivery receipt delivered artifacts: ${dashboard.summary.delivery_receipt_delivered_artifact_count ?? 0}`);
  lines.push(`- Post-delivery delivered artifacts: ${dashboard.summary.post_delivery_delivered_artifact_count ?? 0}`);
  lines.push(`- Post-delivery delivered matters: ${dashboard.summary.post_delivery_delivered_matter_count ?? 0}`);
  lines.push(`- Post-delivery outstanding receipts: ${dashboard.summary.post_delivery_outstanding_receipt_count ?? 0}`);
  lines.push(`- Delivery closeout items: ${dashboard.summary.delivery_closeout_item_count ?? 0}`);
  lines.push(`- Delivery closeout awaiting execution: ${dashboard.summary.delivery_closeout_awaiting_count ?? 0}`);
  lines.push(`- Closeout receipts ready: ${dashboard.summary.closeout_receipt_ready_count ?? 0}`);
  lines.push(`- Closeout receipts pending: ${dashboard.summary.closeout_receipt_pending_count ?? 0}`);
  lines.push(`- Closeout receipt errors: ${dashboard.summary.closeout_receipt_error_count ?? 0}`);
  lines.push(`- Observability runs: ${dashboard.summary.observability_run_count ?? 0}`);
  lines.push(`- Observability events: ${dashboard.summary.observability_event_count ?? 0}`);
  lines.push(`- Runtime seconds: ${dashboard.summary.observability_runtime_seconds ?? 0}`);
  lines.push(`- Law firm issues: ${dashboard.summary.law_firm_issue_count ?? 0}`);
  lines.push(`- Law firm citations: ${dashboard.summary.law_firm_citation_count ?? 0}`);
  lines.push(`- Creative slides: ${dashboard.summary.creative_slide_count ?? 0}`);
  lines.push(`- Blocking gates: ${dashboard.summary.blocking_gate_count}`);
  lines.push(`- Blocked resources: ${dashboard.summary.blocked_resource_count}`);
  lines.push(`- Audit events: ${dashboard.summary.audit_event_count}`);
  lines.push(`- Action items: ${dashboard.summary.action_item_count}`);
  lines.push("");
  lines.push("## Stages");
  lines.push("");
  for (const stage of dashboard.stage_statuses) {
    lines.push(`- ${stage.label}: ${stage.status} - ${stage.message}`);
  }
  lines.push("");
  lines.push("## Action Items");
  lines.push("");
  for (const item of dashboard.action_items) {
    lines.push(`- [${item.priority}] ${item.title} (${item.status})`);
  }
  if (dashboard.action_items.length === 0) lines.push("- No action items.");
  return `${lines.join("\n")}\n`;
}

function renderStageHtml(stage) {
  const metricItems = Object.entries(stage.metrics ?? {})
    .map(([key, value]) => `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>`)
    .join("");
  return `<article class="stage">
  <h3>${escapeHtml(stage.label)}</h3>
  <div class="badge status-${escapeHtml(stage.status)}">${escapeHtml(stage.status)}</div>
  <p>${escapeHtml(stage.message)}</p>
  <div class="meta">${escapeHtml(stage.source_path ?? "no source")}</div>
  ${metricItems ? `<ul>${metricItems}</ul>` : ""}
</article>`;
}

function renderActionHtml(item) {
  const actions = item.recommended_actions.map((action) => `<span class="badge">${escapeHtml(action)}</span>`).join(" ");
  return `<article class="action">
  <h3>${escapeHtml(item.title)}</h3>
  <div>
    <span class="badge priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
    <span class="badge">${escapeHtml(item.status)}</span>
  </div>
  <p>${escapeHtml(item.reason)}</p>
  <div class="meta">${escapeHtml(item.subject_ref.subject_type)}:<code>${escapeHtml(item.subject_ref.subject_id)}</code></div>
  <p>${actions}</p>
</article>`;
}

function stat(label, value) {
  return `<div class="stat"><strong>${Number(value ?? 0)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function compareActionItems(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

function countReviewStatuses(evidenceItems) {
  return evidenceItems.reduce((counts, item) => {
    const status = item.review_status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function countBlockingGates(gates) {
  return gates.filter((gate) => gate.blocking || gate.status !== "passed").length;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_REVIEW_DASHBOARD_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--evidence-viewer") parsed.evidenceViewerPath = argv[++index];
    else if (arg === "--approval-queue") parsed.approvalQueuePath = argv[++index];
    else if (arg === "--approval-decisions") parsed.approvalDecisionPath = argv[++index];
    else if (arg === "--approval-inbox") parsed.approvalInboxPath = argv[++index];
    else if (arg === "--no-approval-inbox") parsed.approvalInboxPath = false;
    else if (arg === "--approval-inbox-decisions") parsed.approvalInboxDecisionPath = argv[++index];
    else if (arg === "--no-approval-inbox-decisions") parsed.approvalInboxDecisionPath = false;
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--no-domain-pack-registry") parsed.domainPackRegistryPath = false;
    else if (arg === "--output-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputArtifactCatalogPath = false;
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--no-observability-catalog") parsed.observabilityCatalogPath = false;
    else if (arg === "--delivery-queue") parsed.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--no-delivery-queue") parsed.protectedDeliveryQueuePath = false;
    else if (arg === "--matter-cockpit") parsed.matterCockpitPath = argv[++index];
    else if (arg === "--no-matter-cockpit") parsed.matterCockpitPath = false;
    else if (arg === "--delivery-execution") parsed.deliveryExecutionDraftPath = argv[++index];
    else if (arg === "--no-delivery-execution") parsed.deliveryExecutionDraftPath = false;
    else if (arg === "--delivery-receipts") parsed.deliveryReceiptLedgerPath = argv[++index];
    else if (arg === "--no-delivery-receipts") parsed.deliveryReceiptLedgerPath = false;
    else if (arg === "--post-delivery-reconciliation") parsed.postDeliveryReconciliationPath = argv[++index];
    else if (arg === "--no-post-delivery-reconciliation") parsed.postDeliveryReconciliationPath = false;
    else if (arg === "--delivery-closeout") parsed.deliveryCloseoutQueuePath = argv[++index];
    else if (arg === "--no-delivery-closeout") parsed.deliveryCloseoutQueuePath = false;
    else if (arg === "--closeout-receipt-validation") parsed.closeoutReceiptValidationPath = argv[++index];
    else if (arg === "--no-closeout-receipt-validation") parsed.closeoutReceiptValidationPath = false;
    else if (arg === "--law-firm-ldd-summary") parsed.lawFirmLddSummaryPath = argv[++index];
    else if (arg === "--no-law-firm-ldd-summary") parsed.lawFirmLddSummaryPath = false;
    else if (arg === "--personal-dev-summary") parsed.personalDevSummaryPath = argv[++index];
    else if (arg === "--no-personal-dev-summary") parsed.personalDevSummaryPath = false;
    else if (arg === "--creative-document-summary") parsed.creativeDocumentSummaryPath = argv[++index];
    else if (arg === "--no-creative-document-summary") parsed.creativeDocumentSummaryPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/review-dashboard.mjs [options]

Options:
  --resource-expansion <path>    resource-expansion-job.json path.
  --resource-ingest <path>       resource-ingest.json path.
  --evidence-viewer <path>       evidence-viewer.json path.
  --approval-queue <path>        approval-queue.json path.
  --approval-decisions <path>    approval-decision-result.json path.
  --approval-inbox <path>        approval-inbox.json path.
  --no-approval-inbox            Do not include Approval Inbox status.
  --approval-inbox-decisions <path>
                                  approval-inbox-decision-result.json path.
  --no-approval-inbox-decisions  Do not include Approval Inbox Decisions status.
  --domain-pack-registry <path>  domain-pack-registry.json path.
  --no-domain-pack-registry      Do not include Domain Pack Registry status.
  --output-catalog <path>        output-catalog.json path.
  --no-output-catalog            Do not include Output Artifact Catalog status.
  --observability-catalog <path> observability-catalog.json path.
  --no-observability-catalog     Do not include Observability Catalog status.
  --delivery-queue <path>        protected-delivery-queue.json path.
  --no-delivery-queue            Do not include Protected Delivery Queue status.
  --matter-cockpit <path>        matter-cockpit.json path.
  --no-matter-cockpit            Do not include Matter Cockpit status.
  --delivery-execution <path>    delivery-execution-draft.json path.
  --no-delivery-execution        Do not include Delivery Execution Draft status.
  --delivery-receipts <path>     delivery-receipt-ledger.json path.
  --no-delivery-receipts         Do not include Delivery Receipt Ledger status.
  --post-delivery-reconciliation <path>
                                  post-delivery-reconciliation.json path.
  --no-post-delivery-reconciliation
                                  Do not include Post-Delivery Reconciliation status.
  --delivery-closeout <path>      delivery-closeout-queue.json path.
  --no-delivery-closeout          Do not include Delivery Closeout Queue status.
  --closeout-receipt-validation <path>
                                  closeout-receipt-validation.json path.
  --no-closeout-receipt-validation
                                  Do not include Closeout Receipt Validation status.
  --law-firm-ldd-summary <path>  Law Firm LDD summary.json path.
  --no-law-firm-ldd-summary      Do not include Law Firm LDD slice status.
  --personal-dev-summary <path>  personal-dev summary.json path.
  --no-personal-dev-summary      Do not include personal-dev slice status.
  --creative-document-summary <path>
                                  Creative Document summary.json path.
  --no-creative-document-summary Do not include Creative Document slice status.
  --out-dir <folder>             Output directory.
  --run-at <iso>                 Deterministic generated_at timestamp.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}
