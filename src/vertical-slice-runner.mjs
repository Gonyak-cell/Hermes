import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateEventLedger,
  validateVerticalSlice,
} from "./core-contract-validator.mjs";

export const DEFAULT_VERTICAL_SLICE_INPUT = "examples/core/sample-board-minutes.md";
export const DEFAULT_VERTICAL_SLICE_OUT_DIR = "artifacts/vertical-slice/latest";

const DEFAULT_IDS = {
  tenantId: "tenant.amic",
  userId: "user.jws",
  clientId: "client.alpha",
  matterId: "matter.alpha.ldd",
  policySnapshotId: "policy.default.law_firm.v1",
};

export async function runVerticalSlice(options = {}) {
  const result = await buildVerticalSliceRun(options);
  const schemas = await loadCoreSchemas(options.schemaDir);
  const verticalSliceValidation = validateVerticalSlice(result.vertical_slice, schemas);
  const eventLedgerValidation = validateEventLedger(result.event_ledger, schemas, result.vertical_slice);

  if (!verticalSliceValidation.valid || !eventLedgerValidation.valid) {
    return {
      ...result,
      validation: {
        valid: false,
        vertical_slice: verticalSliceValidation,
        event_ledger: eventLedgerValidation,
      },
    };
  }

  if (options.outDir) {
    await writeVerticalSliceRun(result, options.outDir);
  }

  return {
    ...result,
    validation: {
      valid: true,
      vertical_slice: verticalSliceValidation,
      event_ledger: eventLedgerValidation,
    },
  };
}

export async function buildVerticalSliceRun(options = {}) {
  const inputPath = options.inputPath ?? DEFAULT_VERTICAL_SLICE_INPUT;
  const absoluteInputPath = path.resolve(inputPath);
  const text = await readFile(inputPath, "utf8");
  const contentHash = sha256(text);
  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const idSuffix = contentHash.slice(0, 12);
  const createdAt = runAt;
  const ids = { ...DEFAULT_IDS, ...options.ids };
  const resourceId = `resource.vertical_slice.${idSuffix}`;
  const resourceVersionId = `resource-version.vertical_slice.${idSuffix}.v1`;
  const normalizedTextId = `normalized.vertical_slice.${idSuffix}`;
  const workflowId = "workflow.law_firm.ldd.issue_candidate_from_file.v1";
  const capabilityId = "law_firm.ldd.issue_candidate_from_file";
  const workflowRunId = `workflow-run.vertical_slice.${idSuffix}`;
  const agentRunId = `agent-run.vertical_slice.${idSuffix}`;
  const outputArtifactId = `output.vertical_slice.${idSuffix}`;
  const approvalId = `approval.vertical_slice.${idSuffix}`;
  const evidenceGateResultId = `gate-result.vertical_slice.${idSuffix}.evidence`;
  const approvalGateResultId = `gate-result.vertical_slice.${idSuffix}.approval`;
  const costRecordId = `cost.vertical_slice.${idSuffix}`;
  const paragraphs = splitParagraphs(text);
  const sourceSpans = paragraphs.map((paragraph, index) => ({
    schema_version: "source-span.v1",
    id: `span.vertical_slice.${idSuffix}.p${index + 1}`,
    resource_id: resourceId,
    resource_version_id: resourceVersionId,
    location_type: "paragraph",
    locator: {
      paragraph: index + 1,
    },
    text: paragraph,
    hash: sha256(paragraph),
    metadata: {
      heading: paragraph.startsWith("#"),
    },
  }));
  const selectedSpan = selectEvidenceSpan(sourceSpans);
  const evidenceId = `evidence.vertical_slice.${idSuffix}.001`;
  const factId = `fact.vertical_slice.${idSuffix}.001`;
  const issueId = `issue.vertical_slice.${idSuffix}.001`;
  const citationId = `citation.vertical_slice.${idSuffix}.p1`;
  const issueDraft = draftIssue(selectedSpan.text, {
    clientName: options.clientName ?? "Alpha Client",
  });
  const outputMarkdown = renderIssueCandidateMarkdown({
    matterName: options.matterName ?? "Alpha LDD Pilot",
    issueTitle: issueDraft.issueTitle,
    factStatement: issueDraft.factStatement,
    evidenceText: selectedSpan.text,
    sourceUri: absoluteInputPath,
  });
  const outputUri = options.outputUri ?? path.join(options.outDir ?? DEFAULT_VERTICAL_SLICE_OUT_DIR, "output.md");

  const identityPolicy = buildIdentityPolicy(ids, createdAt);
  const resourceEvidence = {
    schema_version: "resource-evidence.v1",
    resources: [
      {
        schema_version: "resource-core.v1",
        id: resourceId,
        tenant_id: ids.tenantId,
        source_system: "local_filesystem",
        source_uri: absoluteInputPath,
        resource_type: "file",
        content_hash: contentHash,
        classification: "P2_CLIENT_CONFIDENTIAL",
        matter_id: ids.matterId,
        materialization_status: "not_required",
        ingestion_status: "normalized",
        created_at: isoAt(runAt, 0),
        created_by: {
          actor_type: "connector",
          actor_id: "connector.local_filesystem",
          display_name: "Local Filesystem",
        },
        metadata: {
          filename: path.basename(inputPath),
        },
      },
    ],
    resource_versions: [
      {
        schema_version: "resource-version.v1",
        id: resourceVersionId,
        resource_id: resourceId,
        version_label: "v1",
        content_hash: contentHash,
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    normalized_texts: [
      {
        schema_version: "normalized-text.v1",
        id: normalizedTextId,
        resource_id: resourceId,
        resource_version_id: resourceVersionId,
        text_hash: sha256(text),
        language: "ko",
        extractor_id: "extractor.plain_text.v1",
        quality: "high",
        text_preview: preview(text),
        metadata: {
          paragraph_count: paragraphs.length,
        },
      },
    ],
    source_spans: sourceSpans,
    evidence_items: [
      {
        schema_version: "evidence-item.v1",
        id: evidenceId,
        matter_id: ids.matterId,
        source_span_ids: [selectedSpan.id],
        evidence_type: "document_text",
        summary: issueDraft.evidenceSummary,
        reliability: "client_provided",
        review_status: "needs_review",
        metadata: {
          generated_by: "vertical_slice_runner",
        },
      },
    ],
    facts: [
      {
        schema_version: "fact.v1",
        id: factId,
        matter_id: ids.matterId,
        evidence_item_ids: [evidenceId],
        statement: issueDraft.factStatement,
        fact_type: issueDraft.factType,
        confidence: issueDraft.confidence,
        review_status: "needs_review",
        metadata: {},
      },
    ],
    issues: [
      {
        schema_version: "issue.v1",
        id: issueId,
        matter_id: ids.matterId,
        issue_type: issueDraft.issueType,
        title: issueDraft.issueTitle,
        linked_fact_ids: [factId],
        severity: issueDraft.severity,
        status: "candidate",
        metadata: {
          next_action: "attorney_review",
        },
      },
    ],
    citations: [
      {
        schema_version: "citation.v1",
        id: citationId,
        output_artifact_id: outputArtifactId,
        target_path: "paragraphs[0]",
        source_span_ids: [selectedSpan.id],
        evidence_item_ids: [evidenceId],
        citation_status: "candidate",
        metadata: {},
      },
    ],
  };

  const workflowRuntime = {
    schema_version: "workflow-runtime.v1",
    capabilities: [buildVerticalSliceCapability()],
    workflows: [buildVerticalSliceWorkflow(workflowId, capabilityId, resourceId, normalizedTextId, outputArtifactId)],
    workflow_runs: [
      {
        schema_version: "workflow-run.v1",
        id: workflowRunId,
        workflow_id: workflowId,
        capability_id: capabilityId,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        status: "blocked",
        input_refs: [resourceId],
        output_refs: [outputArtifactId],
        policy_snapshot_id: ids.policySnapshotId,
        created_at: isoAt(runAt, 4),
        created_by: {
          actor_type: "harness",
          actor_id: "harness.orchestrator",
          display_name: "Harness Orchestrator",
        },
        metadata: {
          blocked_reason: "human_approval_pending",
        },
      },
    ],
    agent_runs: [
      {
        schema_version: "agent-run.v1",
        id: agentRunId,
        workflow_run_id: workflowRunId,
        runtime_id: "local_script",
        status: "completed",
        input_ref: resourceId,
        output_ref: evidenceId,
        logs_ref: `logs/${agentRunId}.log`,
        started_at: isoAt(runAt, 5),
        completed_at: isoAt(runAt, 7),
        metadata: {
          extractor_id: "extractor.plain_text.v1",
        },
      },
    ],
  };

  const governanceOutput = {
    schema_version: "governance-output.v1",
    gate_results: [
      {
        schema_version: "gate-result.v1",
        id: evidenceGateResultId,
        workflow_run_id: workflowRunId,
        gate_id: "evidence_coverage_gate",
        gate_stage: "post_run",
        status: "passed",
        findings: [],
        blocking: false,
        created_at: isoAt(runAt, 8),
        metadata: {
          evidence_item_ids: [evidenceId],
          citation_ids: [citationId],
        },
      },
      {
        schema_version: "gate-result.v1",
        id: approvalGateResultId,
        workflow_run_id: workflowRunId,
        gate_id: "human_approval_gate",
        gate_stage: "post_run",
        status: "pending",
        findings: [
          {
            finding_id: `finding.vertical_slice.${idSuffix}.approval_pending`,
            severity: "info",
            message: "Attorney review is required before the output can leave draft status.",
            refs: [outputArtifactId],
          },
        ],
        blocking: true,
        created_at: isoAt(runAt, 9),
        metadata: {},
      },
    ],
    approvals: [
      {
        schema_version: "approval.v1",
        id: approvalId,
        workflow_run_id: workflowRunId,
        output_artifact_id: outputArtifactId,
        requested_from: ids.userId,
        approval_status: "pending",
        decision: null,
        decided_at: null,
        created_at: isoAt(runAt, 9),
        metadata: {
          approval_type: "attorney_review",
        },
      },
    ],
    output_artifacts: [
      {
        schema_version: "output-artifact.v1",
        id: outputArtifactId,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        artifact_type: "markdown",
        artifact_uri: outputUri,
        content_hash: sha256(outputMarkdown),
        status: "pending_review",
        citation_ids: [citationId],
        created_by_run_id: agentRunId,
        created_at: isoAt(runAt, 8),
        metadata: {
          title: issueDraft.issueTitle,
        },
      },
    ],
    audit_events: [
      buildAuditEvent({
        id: `event.resource.ingested.vertical_slice.${idSuffix}`,
        type: "resource.ingested",
        time: isoAt(runAt, 0),
        tenantId: ids.tenantId,
        actor: localFilesystemActor(),
        subjectType: "resource",
        subjectId: resourceId,
        correlationId: workflowRunId,
        data: {
          matter_id: ids.matterId,
          content_hash: contentHash,
        },
      }),
      buildAuditEvent({
        id: `event.approval.requested.vertical_slice.${idSuffix}`,
        type: "approval.requested",
        time: isoAt(runAt, 9),
        tenantId: ids.tenantId,
        actor: harnessActor(),
        subjectType: "approval",
        subjectId: approvalId,
        correlationId: workflowRunId,
        data: {
          output_artifact_id: outputArtifactId,
        },
      }),
    ],
  };

  const verticalSlice = {
    schema_version: "vertical-slice-run.v1",
    generated_at: isoAt(runAt, 10),
    identity_policy: identityPolicy,
    resource_evidence: resourceEvidence,
    workflow_runtime: workflowRuntime,
    governance_output: governanceOutput,
  };

  const eventLedger = buildEventLedger({
    runAt,
    idSuffix,
    ids,
    resourceId,
    normalizedTextId,
    evidenceId,
    factId,
    issueId,
    workflowRunId,
    capabilityId,
    agentRunId,
    evidenceGateResultId,
    approvalGateResultId,
    outputArtifactId,
    approvalId,
    costRecordId,
  });

  return {
    vertical_slice: verticalSlice,
    event_ledger: eventLedger,
    output_markdown: outputMarkdown,
    summary: {
      input_path: absoluteInputPath,
      workflow_run_id: workflowRunId,
      resource_id: resourceId,
      issue_id: issueId,
      output_artifact_id: outputArtifactId,
      approval_id: approvalId,
      status: "blocked",
      blocked_reason: "human_approval_pending",
    },
  };
}

export async function writeVerticalSliceRun(result, outDir = DEFAULT_VERTICAL_SLICE_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "vertical-slice.json"), result.vertical_slice);
  await writeJson(path.join(outDir, "event-ledger.json"), result.event_ledger);
  await writeJson(path.join(outDir, "summary.json"), result.summary);
  await writeFile(path.join(outDir, "output.md"), result.output_markdown, "utf8");
}

export async function runVerticalSliceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runVerticalSlice({
    inputPath: args.inputPath,
    outDir: args.outDir,
    runAt: args.runAt,
  });

  if (!result.validation.valid) {
    console.error("Vertical slice validation failed.");
    for (const [section, validation] of Object.entries(result.validation)) {
      if (section === "valid" || validation.valid) continue;
      for (const error of validation.errors) {
        console.error(`- ${section}.${error.path}: ${error.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Vertical slice written to ${path.resolve(args.outDir)}`);
  console.log(`Workflow run: ${result.summary.workflow_run_id}`);
  console.log(`Issue: ${result.summary.issue_id}`);
  console.log(`Output: ${result.summary.output_artifact_id}`);
  console.log("Status: blocked (human approval pending)");
}

function buildIdentityPolicy(ids, createdAt) {
  return {
    schema_version: "identity-policy.v1",
    tenants: [
      {
        schema_version: "tenant.v1",
        id: ids.tenantId,
        name: "AMIC Harness Lab",
        tenant_type: "law_firm",
        default_policy_id: ids.policySnapshotId,
        created_at: isoAt(createdAt, 0),
        metadata: {},
      },
    ],
    users: [
      {
        schema_version: "user.v1",
        id: ids.userId,
        tenant_id: ids.tenantId,
        display_name: "jws",
        roles: ["owner", "partner", "developer"],
        status: "active",
        created_at: isoAt(createdAt, 0),
        metadata: {},
      },
    ],
    clients: [
      {
        schema_version: "client.v1",
        id: ids.clientId,
        tenant_id: ids.tenantId,
        name: "Alpha Client",
        classification_floor: "P2_CLIENT_CONFIDENTIAL",
        created_at: isoAt(createdAt, 0),
        metadata: {},
      },
    ],
    matters: [
      {
        schema_version: "matter-core.v1",
        id: ids.matterId,
        tenant_id: ids.tenantId,
        client_id: ids.clientId,
        matter_name: "Alpha LDD Pilot",
        practice_area: "ldd",
        status: "active",
        classification: "P2_CLIENT_CONFIDENTIAL",
        matter_team: [
          {
            user_id: ids.userId,
            matter_role: "responsible_partner",
          },
        ],
        wall_ids: ["wall.alpha.default"],
        created_at: isoAt(createdAt, 0),
        metadata: {},
      },
    ],
    policy_snapshots: [
      {
        schema_version: "policy-snapshot.v1",
        id: ids.policySnapshotId,
        tenant_id: ids.tenantId,
        created_at: isoAt(createdAt, 0),
        classification_rules: {
          default_classification: "P2_CLIENT_CONFIDENTIAL",
        },
        runtime_permissions: {
          P2_CLIENT_CONFIDENTIAL: ["harness", "local_script", "document_renderer", "manual"],
          P3_PRIVILEGED: ["harness", "local_script", "manual"],
        },
        model_permissions: {
          external_model_for_P2: "approval_required",
          external_model_for_P3: "forbidden",
        },
        output_permissions: {
          client_delivery: "partner_approval_required",
        },
        approval_rules: {
          law_firm_output: "attorney_review_required",
        },
        metadata: {},
      },
    ],
  };
}

function buildVerticalSliceCapability() {
  return {
    schema_version: "capability.v1",
    id: "law_firm.ldd.issue_candidate_from_file",
    version: "0.1.0",
    domain_pack: "law-firm",
    description: "Create an evidence-backed LDD issue candidate from one local file.",
    input_schema: "resource-evidence.v1",
    output_schema: "governance-output.v1",
    allowed_runtimes: ["harness", "local_script", "manual"],
    required_gates: {
      pre_run: ["matter_access_gate", "classification_gate"],
      in_run: [],
      post_run: ["evidence_coverage_gate", "human_approval_gate"],
    },
    data_policy: {
      external_model: "forbidden_for_default_slice",
    },
    approval_policy: {
      output_status: "pending_review",
    },
    timeout_policy: {
      max_seconds: 120,
    },
    retry_policy: {
      max_attempts: 1,
    },
    cost_policy: {
      max_usd: 0,
    },
    metadata: {},
  };
}

function buildVerticalSliceWorkflow(workflowId, capabilityId, resourceId, normalizedTextId, outputArtifactId) {
  return {
    schema_version: "workflow.v1",
    id: workflowId,
    capability_id: capabilityId,
    version: "0.1.0",
    steps: [
      {
        step_id: "step.extract_text",
        step_type: "extract",
        runtime_id: "local_script",
        input_refs: [resourceId],
        output_contract: "normalized-text.v1",
      },
      {
        step_id: "step.create_evidence",
        step_type: "script",
        runtime_id: "harness",
        input_refs: [normalizedTextId],
        output_contract: "evidence-item.v1",
      },
      {
        step_id: "step.request_approval",
        step_type: "approval",
        runtime_id: "manual",
        input_refs: [outputArtifactId],
        output_contract: "approval.v1",
      },
    ],
    state_machine: {
      initial: "queued",
      terminal: ["completed", "failed", "cancelled"],
    },
    metadata: {},
  };
}

function buildEventLedger(context) {
  const events = [
    event(context, 0, "resource.ingested", "resource", context.resourceId, null, localFilesystemActor(), {
      matter_id: context.ids.matterId,
    }),
    event(context, 1, "resource.normalized", "normalized_text", context.normalizedTextId, "resource.ingested", scriptActor("extractor.plain_text.v1", "Plain Text Extractor"), {
      resource_id: context.resourceId,
    }),
    event(context, 2, "evidence.created", "evidence_item", context.evidenceId, "resource.normalized", harnessActor(), {
      source: context.normalizedTextId,
    }),
    event(context, 3, "fact.extracted", "fact", context.factId, "evidence.created", harnessActor(), {
      evidence_item_id: context.evidenceId,
    }),
    event(context, 4, "issue.created", "issue", context.issueId, "fact.extracted", harnessActor(), {
      fact_id: context.factId,
    }),
    event(context, 5, "workflow.started", "workflow_run", context.workflowRunId, "issue.created", harnessActor(), {
      capability_id: context.capabilityId,
    }),
    event(context, 6, "agent_run.started", "agent_run", context.agentRunId, "workflow.started", scriptActor(context.agentRunId, "Local Script Runtime"), {
      runtime_id: "local_script",
    }),
    event(context, 7, "agent_run.completed", "agent_run", context.agentRunId, "agent_run.started", scriptActor(context.agentRunId, "Local Script Runtime"), {
      status: "completed",
      output_ref: context.evidenceId,
    }),
    event(context, 8, "gate.passed", "gate_result", context.evidenceGateResultId, "agent_run.completed", harnessActor("gate.evidence_coverage", "Evidence Coverage Gate"), {
      gate_id: "evidence_coverage_gate",
    }),
    event(context, 9, "output.rendered", "output_artifact", context.outputArtifactId, "gate.passed", harnessActor(), {
      artifact_type: "markdown",
      status: "pending_review",
    }),
    event(context, 10, "approval.requested", "approval", context.approvalId, "output.rendered", harnessActor(), {
      output_artifact_id: context.outputArtifactId,
    }),
    event(context, 11, "cost.recorded", "cost_record", context.costRecordId, "agent_run.completed", harnessActor(), {
      cost_type: "runtime_seconds",
      amount: 2,
    }),
  ];

  return {
    schema_version: "event-ledger.v1",
    ledger_id: `ledger.vertical_slice.${context.idSuffix}`,
    generated_at: isoAt(context.runAt, 12),
    events,
    run_ledgers: [
      {
        schema_version: "run-ledger.v1",
        id: `run-ledger.vertical_slice.${context.idSuffix}`,
        tenant_id: context.ids.tenantId,
        workflow_run_id: context.workflowRunId,
        capability_id: context.capabilityId,
        policy_snapshot_id: context.ids.policySnapshotId,
        status: "blocked",
        input_refs: [context.resourceId],
        agent_run_ids: [context.agentRunId],
        gate_result_ids: [context.evidenceGateResultId, context.approvalGateResultId],
        approval_ids: [context.approvalId],
        output_artifact_ids: [context.outputArtifactId],
        event_ids: events.map((item) => item.id),
        cost_records: [
          {
            cost_record_id: context.costRecordId,
            cost_type: "runtime_seconds",
            amount: 2,
            unit: "seconds",
            created_at: isoAt(context.runAt, 11),
            metadata: {},
          },
        ],
        error_records: [],
        created_at: isoAt(context.runAt, 5),
        updated_at: isoAt(context.runAt, 12),
        metadata: {
          blocked_reason: "human_approval_pending",
        },
      },
    ],
    metadata: {},
  };
}

function event(context, secondOffset, type, subjectType, subjectId, causationType, actor, data) {
  return {
    schema_version: "event.v1",
    id: `event.${type}.vertical_slice.${context.idSuffix}`,
    type,
    time: isoAt(context.runAt, secondOffset),
    tenant_id: context.ids.tenantId,
    correlation_id: context.workflowRunId,
    causation_id: causationType ? `event.${causationType}.vertical_slice.${context.idSuffix}` : null,
    actor,
    subject: {
      subject_type: subjectType,
      subject_id: subjectId,
    },
    policy_snapshot_id: context.ids.policySnapshotId,
    data,
    metadata: {},
  };
}

function draftIssue(text, options) {
  const normalized = text.toLowerCase();
  const date = extractKoreanDate(text);
  if (text.includes("차입") || normalized.includes("borrowing")) {
    return {
      evidenceSummary: "이사회에서 신규 차입 승인 또는 관련 확인사항이 논의되었다는 근거 문단",
      factStatement: `${options.clientName}는 ${date ?? "해당 문서상"} 이사회에서 신규 차입 승인 관련 안건을 논의하였다.`,
      factType: "approval",
      confidence: 0.78,
      issueType: "rfi",
      issueTitle: "신규 차입 승인 관련 결의 요건 및 실행 자료 확인 필요",
      severity: "medium",
    };
  }

  return {
    evidenceSummary: "검토 대상 문서에서 LDD 확인이 필요한 사실관계 후보가 추출되었다.",
    factStatement: `${options.clientName} 관련 문서에서 추가 검토가 필요한 사실관계 후보가 발견되었다.`,
    factType: "general",
    confidence: 0.62,
    issueType: "general",
    issueTitle: "원자료 기반 추가 검토 필요",
    severity: "low",
  };
}

function renderIssueCandidateMarkdown({ matterName, issueTitle, factStatement, evidenceText, sourceUri }) {
  return [
    `# ${issueTitle}`,
    "",
    `Matter: ${matterName}`,
    "",
    "## Fact Candidate",
    "",
    factStatement,
    "",
    "## Evidence",
    "",
    `> ${evidenceText}`,
    "",
    `Source: ${sourceUri}`,
    "",
    "## Gate Status",
    "",
    "- Evidence coverage: passed",
    "- Human approval: pending attorney review",
    "",
  ].join("\n");
}

function splitParagraphs(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function selectEvidenceSpan(sourceSpans) {
  const candidates = sourceSpans.filter((span) => !span.text.startsWith("#"));
  return candidates.find((span) => /차입|승인|계약|의무|담보|동의|소송|증거|기한/.test(span.text)) ?? candidates[0] ?? sourceSpans[0];
}

function extractKoreanDate(text) {
  return text.match(/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./)?.[0] ?? null;
}

function buildAuditEvent({ id, type, time, tenantId, actor, subjectType, subjectId, correlationId, data }) {
  return {
    schema_version: "audit-event.v1",
    id,
    type,
    time,
    tenant_id: tenantId,
    actor,
    subject: {
      subject_type: subjectType,
      subject_id: subjectId,
    },
    correlation_id: correlationId,
    data,
    metadata: {},
  };
}

function harnessActor(actorId = "harness.orchestrator", displayName = "Harness Orchestrator") {
  return {
    actor_type: "harness",
    actor_id: actorId,
    display_name: displayName,
  };
}

function localFilesystemActor() {
  return {
    actor_type: "connector",
    actor_id: "connector.local_filesystem",
    display_name: "Local Filesystem",
  };
}

function scriptActor(actorId, displayName) {
  return {
    actor_type: "script",
    actor_id: actorId,
    display_name: displayName,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoAt(baseIso, seconds) {
  return new Date(new Date(baseIso).getTime() + seconds * 1000).toISOString();
}

function preview(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_VERTICAL_SLICE_INPUT,
    outDir: DEFAULT_VERTICAL_SLICE_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else parsed.inputPath = arg;
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-vertical-slice.mjs [input-file] [options]

Options:
  --out-dir <path>   Output directory for vertical-slice.json, event-ledger.json, summary.json, and output.md.
  --run-at <iso>     Fixed ISO timestamp for deterministic runs.
  -h, --help         Show this help.
`);
}
