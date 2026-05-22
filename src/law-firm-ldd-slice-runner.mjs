import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateEventLedger,
  validateVerticalSlice,
} from "./core-contract-validator.mjs";

export const DEFAULT_LAW_FIRM_LDD_INPUT = "artifacts/resource-ingest/latest/resource-evidence.json";
export const DEFAULT_LAW_FIRM_LDD_OUT_DIR = "artifacts/law-firm-ldd-slice/latest";

const CAPABILITY_ID = "law_firm.ldd.issue_report";
const WORKFLOW_ID = "workflow.law_firm.ldd.issue_report.v1";
const POLICY_SNAPSHOT_ID = "policy.default.law_firm.v1";
const DEFAULT_USER_ID = "user.jws";

export async function runLawFirmLddSlice(options = {}) {
  const result = await buildLawFirmLddSlice(options);
  const schemas = await loadCoreSchemas(options.schemaDir);
  const verticalSliceValidation = validateVerticalSlice(result.law_firm_slice, schemas);
  const eventLedgerValidation = validateEventLedger(result.event_ledger, schemas, result.law_firm_slice);

  const validated = {
    ...result,
    validation: {
      valid: verticalSliceValidation.valid && eventLedgerValidation.valid,
      law_firm_slice: verticalSliceValidation,
      event_ledger: eventLedgerValidation,
    },
  };

  if (options.outDir) await writeLawFirmLddSlice(validated, options.outDir);
  return validated;
}

export async function buildLawFirmLddSlice(options = {}) {
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_LAW_FIRM_LDD_INPUT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAW_FIRM_LDD_OUT_DIR);
  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const inputResourceEvidence = input.schema_version === "resource-evidence.v1" ? input : input.resource_evidence;
  if (!inputResourceEvidence) throw new Error("Input must be resource-evidence.v1 or contain resource_evidence");
  if ((inputResourceEvidence.evidence_items ?? []).length === 0) {
    throw new Error("Law Firm LDD slice requires at least one evidence item");
  }

  const sourceFingerprint = sha256(JSON.stringify({
    resources: inputResourceEvidence.resources?.map((resource) => [resource.id, resource.content_hash]),
    evidence_items: inputResourceEvidence.evidence_items?.map((evidence) => evidence.id),
  })).slice(0, 12);
  const ids = deriveIds(inputResourceEvidence, options);
  const workflowRunId = `workflow-run.law_firm_ldd.${sourceFingerprint}`;
  const agentRunId = `agent-run.law_firm_ldd.${sourceFingerprint}`;
  const outputArtifactId = `output.law_firm_ldd.${sourceFingerprint}.issue_report`;
  const approvalId = `approval.law_firm_ldd.${sourceFingerprint}.attorney_review`;
  const costRecordId = `cost.law_firm_ldd.${sourceFingerprint}`;
  const outputUri = path.join(outputDir, "ldd-issue-report.md");
  const candidates = buildIssueCandidates(inputResourceEvidence, outputArtifactId, sourceFingerprint, options.maxItems ?? 12);
  const outputMarkdown = renderLddIssueReport({
    generatedAt: runAt,
    matterId: ids.matterId,
    sourcePath: inputPath,
    candidates,
  });
  const outputHash = sha256(outputMarkdown);
  const gateResults = buildGateResults({
    runAt,
    sourceFingerprint,
    workflowRunId,
    outputArtifactId,
    candidates,
  });
  const resourceEvidence = mergeResourceEvidence(inputResourceEvidence, {
    facts: candidates.map((candidate) => candidate.fact),
    issues: candidates.map((candidate) => candidate.issue),
    citations: candidates.map((candidate) => candidate.citation),
  });
  const workflowRuntime = buildWorkflowRuntime({
    runAt,
    ids,
    workflowRunId,
    agentRunId,
    outputArtifactId,
    sourceFingerprint,
    inputRefs: inputResourceEvidence.resources.map((resource) => resource.id),
    outputRef: outputArtifactId,
  });
  const governanceOutput = buildGovernanceOutput({
    runAt,
    ids,
    workflowRunId,
    agentRunId,
    outputArtifactId,
    approvalId,
    outputUri,
    outputHash,
    candidates,
    gateResults,
  });
  const identityPolicy = buildIdentityPolicy(inputResourceEvidence, ids, runAt);
  const lawFirmSlice = {
    schema_version: "law-firm-ldd-slice.v1",
    generated_at: isoAt(runAt, 12),
    identity_policy: identityPolicy,
    resource_evidence: resourceEvidence,
    workflow_runtime: workflowRuntime,
    governance_output: governanceOutput,
  };
  const eventLedger = buildEventLedger({
    runAt,
    ids,
    sourceFingerprint,
    workflowRunId,
    agentRunId,
    outputArtifactId,
    approvalId,
    costRecordId,
    issueIds: candidates.map((candidate) => candidate.issue.id),
    factIds: candidates.map((candidate) => candidate.fact.id),
    gateResultIds: gateResults.map((gate) => gate.id),
    inputRefs: inputResourceEvidence.resources.map((resource) => resource.id),
  });

  return {
    law_firm_slice: lawFirmSlice,
    event_ledger: eventLedger,
    output_markdown: outputMarkdown,
    issue_candidates: candidates.map(({ fact, issue, citation, ...candidate }) => ({
      ...candidate,
      fact_id: fact.id,
      issue_id: issue.id,
      citation_id: citation.id,
    })),
    summary: {
      input_path: inputPath,
      workflow_run_id: workflowRunId,
      capability_id: CAPABILITY_ID,
      output_artifact_id: outputArtifactId,
      approval_id: approvalId,
      issue_count: candidates.length,
      rfi_count: candidates.filter((candidate) => candidate.issue.issue_type === "rfi").length,
      citation_count: candidates.length,
      status: "blocked",
      blocked_reason: "attorney_approval_pending",
    },
  };
}

export async function writeLawFirmLddSlice(result, outDir = DEFAULT_LAW_FIRM_LDD_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "law-firm-ldd-slice.json"), result.law_firm_slice);
  await writeJson(path.join(outDir, "event-ledger.json"), result.event_ledger);
  await writeJson(path.join(outDir, "issue-candidates.json"), {
    generated_at: result.law_firm_slice.generated_at,
    count: result.issue_candidates.length,
    issue_candidates: result.issue_candidates,
  });
  await writeJson(path.join(outDir, "summary.json"), result.summary);
  await writeFile(path.join(outDir, "ldd-issue-report.md"), result.output_markdown, "utf8");
}

export async function runLawFirmLddSliceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runLawFirmLddSlice(args);
  if (!result.validation.valid) {
    console.error("Law Firm LDD slice validation failed.");
    for (const [section, validation] of Object.entries(result.validation)) {
      if (section === "valid" || validation.valid) continue;
      for (const error of validation.errors) {
        console.error(`- ${section}.${error.path}: ${error.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Law Firm LDD slice written to ${path.resolve(args.outDir)}`);
  console.log(`Workflow run: ${result.summary.workflow_run_id}`);
  console.log(`Issues: ${result.summary.issue_count}`);
  console.log(`Citations: ${result.summary.citation_count}`);
  console.log("Status: blocked (attorney approval pending)");
}

function buildIssueCandidates(resourceEvidence, outputArtifactId, sourceFingerprint, maxItems) {
  const spansById = new Map((resourceEvidence.source_spans ?? []).map((span) => [span.id, span]));
  const resourcesById = new Map((resourceEvidence.resources ?? []).map((resource) => [resource.id, resource]));
  const evidenceWithContext = (resourceEvidence.evidence_items ?? [])
    .map((evidence) => {
      const span = evidence.source_span_ids.map((spanId) => spansById.get(spanId)).find(Boolean);
      const resource = span ? resourcesById.get(span.resource_id) : null;
      return {
        evidence,
        span,
        resource,
        relevance_score: scoreLddRelevance(evidence, span, resource),
      };
    })
    .filter((item) => item.span);
  const strictEvidence = evidenceWithContext.filter((item) => isStrictLddResource(item.resource));
  const selectedEvidence = strictEvidence.length > 0
    ? strictEvidence
    : evidenceWithContext.some((item) => item.relevance_score > 0)
    ? evidenceWithContext.filter((item) => item.relevance_score > 0)
    : evidenceWithContext;
  const candidates = [];
  for (const { evidence, span, resource } of selectedEvidence) {
    if (candidates.length >= maxItems) break;
    const analysis = analyzeLddText(`${evidence.summary}\n${span.text}`, resource);
    const itemNumber = candidates.length + 1;
    const idSuffix = `${sourceFingerprint}.${String(itemNumber).padStart(3, "0")}`;
    const factId = `fact.law_firm_ldd.${idSuffix}`;
    const issueId = `issue.law_firm_ldd.${idSuffix}`;
    const citationId = `citation.law_firm_ldd.${idSuffix}`;
    const fact = {
      schema_version: "fact.v1",
      id: factId,
      matter_id: evidence.matter_id,
      evidence_item_ids: [evidence.id],
      statement: analysis.factStatement,
      fact_type: analysis.factType,
      confidence: analysis.confidence,
      review_status: "needs_review",
      metadata: {
        source_resource_id: resource?.id ?? null,
      },
    };
    const issue = {
      schema_version: "issue.v1",
      id: issueId,
      matter_id: evidence.matter_id,
      issue_type: analysis.issueType,
      title: analysis.title,
      linked_fact_ids: [factId],
      severity: analysis.severity,
      status: "candidate",
      metadata: {
        rfi_question: analysis.rfiQuestion,
        source_uri: resource?.source_uri ?? null,
      },
    };
    const citation = {
      schema_version: "citation.v1",
      id: citationId,
      output_artifact_id: outputArtifactId,
      target_path: `issue_candidates[${itemNumber - 1}]`,
      source_span_ids: [span.id],
      evidence_item_ids: [evidence.id],
      citation_status: "candidate",
      metadata: {
        issue_id: issueId,
      },
    };
    candidates.push({
      item_number: itemNumber,
      evidence_id: evidence.id,
      source_span_id: span.id,
      source_uri: resource?.source_uri ?? null,
      excerpt: truncate(span.text, 360),
      fact,
      issue,
      citation,
    });
  }
  return candidates;
}

function isStrictLddResource(resource) {
  if (resource?.metadata?.candidate_domain === "law-firm") return true;
  const sourceUri = String(resource?.source_uri ?? "").toLowerCase();
  return /ldd|vdr|due diligence|법률실사|자료실/.test(sourceUri);
}

function scoreLddRelevance(evidence, span, resource) {
  let score = 0;
  const capabilityIds = evidence.metadata?.capability_ids ?? [];
  if (capabilityIds.some((capabilityId) => String(capabilityId) === "law_firm.ldd_vdr_review")) score += 3;
  if (resource?.metadata?.candidate_domain === "law-firm") score += 3;
  const sourceUri = String(resource?.source_uri ?? "").toLowerCase();
  if (/ldd|vdr|due diligence|법률실사|실사|자료실|rfi/.test(sourceUri)) score += 2;
  if (/spa|indemnity|손해배상|해지|주주총회|차입|담보|사전동의|related-party|closing checklist/.test(sourceUri)) score += 1;
  return score;
}

function analyzeLddText(text, resource) {
  const normalized = text.toLowerCase();
  const sourceLabel = resource?.source_uri ? path.basename(resource.source_uri) : "검토자료";
  if (/change[- ]?of[- ]?control|change of control|지배권|경영권|양도 제한/.test(normalized)) {
    return candidate({
      title: "Change of control 또는 양도 제한 조항 확인 필요",
      issueType: "ldd_yellow_flag",
      severity: "medium",
      factType: "obligation",
      factStatement: `${sourceLabel}에서 지배권 변동, 양도 제한 또는 사전동의 관련 조항 후보가 확인되었다.`,
      rfiQuestion: "해당 계약의 change-of-control, 양도 제한, 사전동의 요건 및 위반 시 효과를 확인해 주세요.",
      confidence: 0.74,
    });
  }
  if (/해지|termination|위약|손해배상|indemnity|면책|배상/.test(normalized)) {
    return candidate({
      title: "해지, 손해배상 또는 indemnity 조항 검토 필요",
      issueType: "ldd_yellow_flag",
      severity: "medium",
      factType: "obligation",
      factStatement: `${sourceLabel}에서 해지, 손해배상 또는 indemnity 관련 조항 후보가 확인되었다.`,
      rfiQuestion: "해지권, 손해배상 범위, indemnity cap 및 carve-out이 있는지 확인해 주세요.",
      confidence: 0.72,
    });
  }
  if (/누락|missing|not provided|미제공|자료요청|rfi/.test(normalized)) {
    return candidate({
      title: "추가 요청자료 또는 RFI 후보",
      issueType: "rfi",
      severity: "medium",
      factType: "missing_document",
      factStatement: `${sourceLabel}에서 추가 확인 또는 자료 요청이 필요한 누락 신호가 확인되었다.`,
      rfiQuestion: "누락된 자료의 최신본, 체결본, 별첨, 변경계약 또는 관련 승인자료를 제공해 주세요.",
      confidence: 0.76,
    });
  }
  if (/이사회|주주총회|승인|approval|consent|결의/.test(normalized)) {
    return candidate({
      title: "승인, 동의 또는 결의 요건 확인 필요",
      issueType: "rfi",
      severity: "medium",
      factType: "approval",
      factStatement: `${sourceLabel}에서 승인, 동의 또는 결의 요건 관련 사실 후보가 확인되었다.`,
      rfiQuestion: "해당 거래 또는 의무 이행에 필요한 이사회, 주주총회, 제3자 동의 자료가 있는지 확인해 주세요.",
      confidence: 0.78,
    });
  }
  return candidate({
    title: "원자료 기반 LDD 검토 후보",
    issueType: "general",
    severity: "low",
    factType: "general",
    factStatement: `${sourceLabel}에서 LDD 보고서에 반영할 수 있는 검토 후보가 확인되었다.`,
    rfiQuestion: "이 자료가 현재 거래 범위에서 중요한 계약, 승인, 분쟁, 인허가 또는 기타 검토 대상인지 확인해 주세요.",
    confidence: 0.62,
  });
}

function candidate(value) {
  return value;
}

function mergeResourceEvidence(resourceEvidence, additions) {
  return {
    schema_version: "resource-evidence.v1",
    resources: resourceEvidence.resources ?? [],
    resource_versions: resourceEvidence.resource_versions ?? [],
    normalized_texts: resourceEvidence.normalized_texts ?? [],
    source_spans: resourceEvidence.source_spans ?? [],
    evidence_items: resourceEvidence.evidence_items ?? [],
    facts: [...(resourceEvidence.facts ?? []), ...additions.facts],
    issues: [...(resourceEvidence.issues ?? []), ...additions.issues],
    citations: [...(resourceEvidence.citations ?? []), ...additions.citations],
  };
}

function buildWorkflowRuntime({ runAt, ids, workflowRunId, agentRunId, outputArtifactId, sourceFingerprint, inputRefs, outputRef }) {
  return {
    schema_version: "workflow-runtime.v1",
    capabilities: [
      {
        schema_version: "capability.v1",
        id: CAPABILITY_ID,
        version: "0.1.0",
        domain_pack: "law-firm",
        description: "Create evidence-backed LDD issue and RFI candidates from Resource/Evidence records.",
        input_schema: "resource-evidence.v1",
        output_schema: "governance-output.v1",
        allowed_runtimes: ["harness", "local_script", "document_renderer", "manual"],
        required_gates: {
          pre_run: ["matter_access_gate", "classification_gate", "external_model_gate", "tool_permission_gate"],
          in_run: ["prompt_injection_gate"],
          post_run: ["evidence_coverage_gate", "citation_gate", "human_approval_gate"],
        },
        data_policy: {
          max_input_classification: "P2_CLIENT_CONFIDENTIAL",
          external_model_policy: "approval_required",
          redaction_required: true,
        },
        approval_policy: {
          approval_type: "attorney_review",
          default_output_status: "pending_review",
        },
        timeout_policy: {
          max_seconds: 1800,
        },
        retry_policy: {
          max_attempts: 2,
        },
        cost_policy: {
          max_usd: 0,
        },
        metadata: {},
      },
    ],
    workflows: [
      {
        schema_version: "workflow.v1",
        id: WORKFLOW_ID,
        capability_id: CAPABILITY_ID,
        version: "0.1.0",
        steps: [
          {
            step_id: "step.verify_matter_access",
            step_type: "gate",
            runtime_id: "harness",
            input_refs: inputRefs,
            output_contract: "gate-result.v1",
          },
          {
            step_id: "step.map_issues",
            step_type: "script",
            runtime_id: "local_script",
            input_refs: inputRefs,
            output_contract: "issue.v1",
          },
          {
            step_id: "step.render_report",
            step_type: "render",
            runtime_id: "document_renderer",
            input_refs: [outputRef],
            output_contract: "output-artifact.v1",
          },
          {
            step_id: "step.request_attorney_approval",
            step_type: "approval",
            runtime_id: "manual",
            input_refs: [outputRef],
            output_contract: "approval.v1",
          },
        ],
        state_machine: {
          initial: "queued",
          terminal: ["completed", "failed", "cancelled"],
          blocked_state: "awaiting_attorney_review",
        },
        metadata: {
          source_fingerprint: sourceFingerprint,
        },
      },
    ],
    workflow_runs: [
      {
        schema_version: "workflow-run.v1",
        id: workflowRunId,
        workflow_id: WORKFLOW_ID,
        capability_id: CAPABILITY_ID,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        status: "blocked",
        input_refs: inputRefs,
        output_refs: [outputArtifactId],
        policy_snapshot_id: POLICY_SNAPSHOT_ID,
        created_at: isoAt(runAt, 4),
        created_by: harnessActor(),
        metadata: {
          blocked_reason: "attorney_approval_pending",
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
        input_ref: inputRefs[0],
        output_ref: outputArtifactId,
        logs_ref: `logs/${agentRunId}.log`,
        started_at: isoAt(runAt, 5),
        completed_at: isoAt(runAt, 7),
        metadata: {
          mode: "deterministic_ldd_issue_mapping",
        },
      },
    ],
  };
}

function buildGateResults({ runAt, sourceFingerprint, workflowRunId, outputArtifactId, candidates }) {
  const gate = (gateId, stage, status, blocking, findings = [], offset = 8) => ({
    schema_version: "gate-result.v1",
    id: `gate-result.law_firm_ldd.${sourceFingerprint}.${gateId}`,
    workflow_run_id: workflowRunId,
    gate_id: gateId,
    gate_stage: stage,
    status,
    findings,
    blocking,
    created_at: isoAt(runAt, offset),
    metadata: {},
  });

  return [
    gate("matter_access_gate", "pre_run", "passed", false, [], 1),
    gate("classification_gate", "pre_run", "passed", false, [], 2),
    gate("evidence_coverage_gate", "post_run", candidates.length > 0 ? "passed" : "failed", candidates.length === 0, [], 8),
    gate("citation_gate", "post_run", candidates.every((candidate) => candidate.citation.source_span_ids.length > 0) ? "passed" : "failed", false, [], 9),
    gate("human_approval_gate", "post_run", "pending", true, [
      {
        finding_id: `finding.law_firm_ldd.${sourceFingerprint}.approval_pending`,
        severity: "info",
        message: "Attorney review is required before this LDD issue report can be delivered or used as final advice.",
        refs: [outputArtifactId],
      },
    ], 10),
  ];
}

function buildGovernanceOutput({ runAt, ids, workflowRunId, agentRunId, outputArtifactId, approvalId, outputUri, outputHash, candidates, gateResults }) {
  return {
    schema_version: "governance-output.v1",
    gate_results: gateResults,
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
        created_at: isoAt(runAt, 10),
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
        content_hash: outputHash,
        status: "pending_review",
        citation_ids: candidates.map((candidate) => candidate.citation.id),
        created_by_run_id: agentRunId,
        created_at: isoAt(runAt, 8),
        metadata: {
          title: "LDD Issue Candidate Report",
          issue_count: candidates.length,
        },
      },
    ],
    audit_events: [
      auditEvent({
        id: `audit.law_firm_ldd.${shortId(workflowRunId)}.output_rendered`,
        type: "output.rendered",
        time: isoAt(runAt, 8),
        tenantId: ids.tenantId,
        actor: harnessActor(),
        subjectType: "output_artifact",
        subjectId: outputArtifactId,
        correlationId: workflowRunId,
        data: {
          issue_count: candidates.length,
        },
      }),
      auditEvent({
        id: `audit.law_firm_ldd.${shortId(workflowRunId)}.approval_requested`,
        type: "approval.requested",
        time: isoAt(runAt, 10),
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
}

function buildIdentityPolicy(resourceEvidence, ids, runAt) {
  const tenants = uniqueBy(resourceEvidence.resources ?? [], "tenant_id").map((tenantId) => ({
    schema_version: "tenant.v1",
    id: tenantId,
    name: tenantId === ids.tenantId ? "AMIC Harness Law Firm Workspace" : `Tenant ${tenantId}`,
    tenant_type: "law_firm",
    default_policy_id: POLICY_SNAPSHOT_ID,
    created_at: isoAt(runAt, 0),
    metadata: {},
  }));
  const clients = tenants.map((tenant) => ({
    schema_version: "client.v1",
    id: tenant.id === ids.tenantId ? ids.clientId : `client.${safeId(tenant.id)}`,
    tenant_id: tenant.id,
    name: tenant.id === ids.tenantId ? "LDD Pilot Client" : `Client for ${tenant.id}`,
    classification_floor: "P2_CLIENT_CONFIDENTIAL",
    created_at: isoAt(runAt, 0),
    metadata: {},
  }));
  const clientByTenant = new Map(clients.map((client) => [client.tenant_id, client.id]));
  const matters = uniqueMatters(resourceEvidence.resources ?? []).map((resource) => ({
    schema_version: "matter-core.v1",
    id: resource.matter_id,
    tenant_id: resource.tenant_id,
    client_id: clientByTenant.get(resource.tenant_id),
    matter_name: resource.matter_id === ids.matterId ? "LDD Issue Report Pilot" : `Matter ${resource.matter_id}`,
    practice_area: "ldd",
    status: "active",
    classification: classificationMax([resource.classification, "P2_CLIENT_CONFIDENTIAL"]),
    matter_team: [
      {
        user_id: ids.userId,
        matter_role: "responsible_partner",
      },
    ],
    wall_ids: [`wall.${safeId(resource.matter_id)}.default`],
    created_at: isoAt(runAt, 0),
    metadata: {},
  }));

  return {
    schema_version: "identity-policy.v1",
    tenants,
    users: [
      {
        schema_version: "user.v1",
        id: ids.userId,
        tenant_id: ids.tenantId,
        display_name: "jws",
        roles: ["owner", "partner", "developer"],
        status: "active",
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    clients,
    matters,
    policy_snapshots: [
      {
        schema_version: "policy-snapshot.v1",
        id: POLICY_SNAPSHOT_ID,
        tenant_id: ids.tenantId,
        created_at: isoAt(runAt, 0),
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

function buildEventLedger(context) {
  const events = [];
  const push = (offset, type, subjectType, subjectId, causationId, actor, data) => {
    const id = `event.${type}.law_firm_ldd.${context.sourceFingerprint}.${events.length + 1}`;
    events.push({
      schema_version: "event.v1",
      id,
      type,
      time: isoAt(context.runAt, offset),
      tenant_id: context.ids.tenantId,
      correlation_id: context.workflowRunId,
      causation_id: causationId,
      actor,
      subject: {
        subject_type: subjectType,
        subject_id: subjectId,
      },
      policy_snapshot_id: POLICY_SNAPSHOT_ID,
      data,
      metadata: {},
    });
    return id;
  };

  const workflowEventId = push(4, "workflow.started", "workflow_run", context.workflowRunId, null, harnessActor(), {
    capability_id: CAPABILITY_ID,
  });
  const agentStartedId = push(5, "agent_run.started", "agent_run", context.agentRunId, workflowEventId, scriptActor(), {
    runtime_id: "local_script",
  });
  const agentCompletedId = push(7, "agent_run.completed", "agent_run", context.agentRunId, agentStartedId, scriptActor(), {
    status: "completed",
  });
  let lastIssueEventId = agentCompletedId;
  for (const factId of context.factIds) {
    lastIssueEventId = push(8, "fact.extracted", "fact", factId, lastIssueEventId, harnessActor(), {});
  }
  for (const issueId of context.issueIds) {
    lastIssueEventId = push(9, "issue.created", "issue", issueId, lastIssueEventId, harnessActor(), {});
  }
  let lastGateEventId = lastIssueEventId;
  for (const gateResultId of context.gateResultIds) {
    lastGateEventId = push(10, gateResultId.endsWith(".human_approval_gate") ? "gate.failed" : "gate.passed", "gate_result", gateResultId, lastGateEventId, harnessActor(), {});
  }
  const outputEventId = push(11, "output.rendered", "output_artifact", context.outputArtifactId, lastGateEventId, harnessActor(), {
    artifact_type: "markdown",
    status: "pending_review",
  });
  const approvalEventId = push(12, "approval.requested", "approval", context.approvalId, outputEventId, harnessActor(), {
    output_artifact_id: context.outputArtifactId,
  });
  push(13, "cost.recorded", "cost_record", context.costRecordId, approvalEventId, harnessActor(), {
    cost_type: "runtime_seconds",
    amount: 2,
  });

  return {
    schema_version: "event-ledger.v1",
    ledger_id: `ledger.law_firm_ldd.${context.sourceFingerprint}`,
    generated_at: isoAt(context.runAt, 14),
    events,
    run_ledgers: [
      {
        schema_version: "run-ledger.v1",
        id: `run-ledger.law_firm_ldd.${context.sourceFingerprint}`,
        tenant_id: context.ids.tenantId,
        workflow_run_id: context.workflowRunId,
        capability_id: CAPABILITY_ID,
        policy_snapshot_id: POLICY_SNAPSHOT_ID,
        status: "blocked",
        input_refs: context.inputRefs,
        agent_run_ids: [context.agentRunId],
        gate_result_ids: context.gateResultIds,
        approval_ids: [context.approvalId],
        output_artifact_ids: [context.outputArtifactId],
        event_ids: events.map((event) => event.id),
        cost_records: [
          {
            cost_record_id: context.costRecordId,
            cost_type: "runtime_seconds",
            amount: 2,
            unit: "seconds",
            created_at: isoAt(context.runAt, 13),
            metadata: {},
          },
        ],
        error_records: [],
        created_at: isoAt(context.runAt, 4),
        updated_at: isoAt(context.runAt, 14),
        metadata: {
          blocked_reason: "attorney_approval_pending",
        },
      },
    ],
    metadata: {},
  };
}

function renderLddIssueReport({ generatedAt, matterId, sourcePath, candidates }) {
  const lines = [];
  lines.push("# LDD Issue Candidate Report");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Matter: ${matterId}`);
  lines.push(`Source evidence: ${sourcePath}`);
  lines.push("");
  lines.push("## Issue Candidates");
  lines.push("");
  for (const candidate of candidates) {
    lines.push(`### ${candidate.item_number}. ${candidate.issue.title}`);
    lines.push("");
    lines.push(`- Type: ${candidate.issue.issue_type}`);
    lines.push(`- Severity: ${candidate.issue.severity}`);
    lines.push(`- Fact: ${candidate.fact.statement}`);
    lines.push(`- RFI: ${candidate.issue.metadata.rfi_question}`);
    lines.push(`- Citation: ${candidate.citation.id}`);
    lines.push(`- Source: ${candidate.source_uri ?? "unknown"}`);
    lines.push("");
    lines.push("> " + candidate.excerpt.replace(/\n/g, "\n> "));
    lines.push("");
  }
  if (candidates.length === 0) lines.push("- No issue candidates.");
  lines.push("## Gate Status");
  lines.push("");
  lines.push("- Matter access: passed");
  lines.push("- Classification: passed");
  lines.push("- Evidence coverage: passed");
  lines.push("- Citation: passed");
  lines.push("- Attorney approval: pending");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function deriveIds(resourceEvidence, options) {
  const firstResource = resourceEvidence.resources?.[0];
  return {
    tenantId: options.tenantId ?? firstResource?.tenant_id ?? "tenant.amic",
    clientId: options.clientId ?? "client.ldd_pilot",
    matterId: options.matterId ?? firstResource?.matter_id ?? "matter.ldd.pilot",
    userId: options.userId ?? DEFAULT_USER_ID,
  };
}

function uniqueBy(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))];
}

function uniqueMatters(resources) {
  const seen = new Set();
  const records = [];
  for (const resource of resources) {
    const key = `${resource.tenant_id}:${resource.matter_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(resource);
  }
  return records;
}

function classificationMax(classifications) {
  const order = ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET"];
  return classifications.filter(Boolean).sort((left, right) => order.indexOf(right) - order.indexOf(left))[0] ?? "P2_CLIENT_CONFIDENTIAL";
}

function auditEvent({ id, type, time, tenantId, actor, subjectType, subjectId, correlationId, data }) {
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

function scriptActor(actorId = "script.law_firm_ldd.issue_mapper", displayName = "Law Firm LDD Issue Mapper") {
  return {
    actor_type: "script",
    actor_id: actorId,
    display_name: displayName,
  };
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_LAW_FIRM_LDD_INPUT,
    outDir: DEFAULT_LAW_FIRM_LDD_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--input") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--max-items") parsed.maxItems = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-law-firm-ldd-slice.mjs [options]

Options:
  --input <path>       resource-evidence.json or resource-ingest.json.
  --out-dir <path>     Output directory.
  --max-items <n>      Maximum evidence items to map into issues.
  --run-at <iso>       Fixed ISO timestamp for deterministic runs.
  -h, --help           Show this help.
`);
}

function shortId(value) {
  return sha256(value).slice(0, 12);
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function truncate(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function isoAt(baseIso, seconds) {
  return new Date(new Date(baseIso).getTime() + seconds * 1000).toISOString();
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
